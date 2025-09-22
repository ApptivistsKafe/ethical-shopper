import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import cors from "cors";
import eBay from "ebay-api";
import { google } from "googleapis";
import * as cheerio from "cheerio";
import https from "https";
import http from "http";
import { URL } from "url"; // Import URL
import parseBodyData from "./parseBodyData.js";
import snoowrap from "snoowrap";

// Load environment variables
dotenv.config();

// Initialize snoowrap for Reddit API access
const reddit = new snoowrap({
  userAgent: process.env.REDDIT_USER_AGENT!,
  clientId: process.env.REDDIT_CLIENT_ID!,
  clientSecret: process.env.REDDIT_CLIENT_SECRET!,
  username: process.env.REDDIT_USERNAME!,
  password: process.env.REDDIT_PASSWORD!,
});

// Initialize Express app
const app = express();
const port = process.env.BACKEND_PORT || 3000;

// Configure middleware
app.use(
  cors({
    origin: "*",
    credentials: true,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add a basic home route for testing
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Backend API is running" });
});

// Add a GET endpoint for testing
app.get("/identify-product", (req: Request, res: Response) => {
  res.json({ message: "POST to this endpoint to identify a product" });
});

app.get("/find-alternatives", (req: Request, res: Response) => {
  res.json({ message: "POST to this endpoint to find alternatives" });
});

// --- Type Definitions (Copied from frontend/src/services/aiService.ts for now) ---
// TODO: Consider creating a shared types package or directory if types are needed in both frontend and backend
interface AIRequestParams {
  step: 1 | 2;
  modelName: string;
  basePrompt: string;
  pageMarkdown?: string; // Required for step 1
  identifiedProductJson?: string; // Required for step 2
}

interface AIResponse {
  data: string;
  timeMs: number;
}

// --- Initialize API Clients ---
let genAI: GoogleGenerativeAI | null = null;
let openai: OpenAI = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "Snevil", // Optional. Site URL for rankings on openrouter.ai.
    "X-Title": "Snevil", // Optional. Site title for rankings on openrouter.ai.
  },
});

// Initialize Gemini Client
if (process.env.GOOGLE_AI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
} else {
  console.warn(
    "Google AI API Key not found in environment variables. Gemini models will not be available."
  );
}

// TODO: Initialize DeepSeek client if/when needed and library/API details are known

// --- Async Handler Wrapper ---
// Utility function to wrap async route handlers and catch errors
const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// --- AI Call Handler (Adapted from frontend/ethical-shopper-extension/src/background/background.ts) ---
async function handleAICall(params: AIRequestParams): Promise<AIResponse> {
  const startTime = performance.now();
  let responseText = "";
  let modelExecutionTimeMs: number | undefined = undefined;

  try {
    // 1. Construct Final Prompt
    let finalPrompt = params.basePrompt;
    if (params.step === 1 && params.pageMarkdown) {
      finalPrompt = `Page Content (Markdown):\n\`\`\`markdown\n${params.pageMarkdown}\n\`\`\`\n\nInstructions:\n${params.basePrompt}`;
    } else if (params.step === 2 && params.identifiedProductJson) {
      finalPrompt = params.basePrompt.replace(
        "[IDENTIFIED_PRODUCT_JSON]",
        params.identifiedProductJson
      );
    } else if (params.step === 1 && !params.pageMarkdown) {
      throw new Error("Page markdown is required for Step 1.");
    } else if (params.step === 2 && !params.identifiedProductJson) {
      throw new Error("Identified product JSON is required for Step 2.");
    }

    // 2. Route to appropriate API based on string
    const modelName: string = params.modelName;

    const apiStartTime = performance.now();
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "user",
          content: finalPrompt,
        },
      ],
    });
    const apiEndTime = performance.now();
    modelExecutionTimeMs = Math.round(apiEndTime - apiStartTime);

    // Process the output array from responses.create based on the example structure
    try {
      responseText = extractResponseText(completion);
    } catch (error) {
      console.warn("Error processing OpenAI response:", error);

      // Attempt fallback parsing if possible
      try {
        // Try to extract any text content available in the response
        const stringified = JSON.stringify(completion);
        const textMatch = stringified.match(/"text"\s*:\s*"([^"]+)"/);
        if (textMatch && textMatch[1]) {
          responseText = textMatch[1];
          console.log("Used fallback text extraction method");
        } else {
          responseText =
            "[Error processing OpenAI response: " +
            (error instanceof Error ? error.message : String(error)) +
            "]";
        }
      } catch (fallbackError) {
        responseText = "[Failed to parse OpenAI response]";
      }
    }
  } catch (error) {
    console.error("Error during AI call in backend:", error);
    throw error;
  }

  const endTime = performance.now();
  const totalTimeMs = Math.round(endTime - startTime);

  return {
    data: responseText,
    timeMs: modelExecutionTimeMs ?? totalTimeMs,
  };
}

// API endpoint for identifying the product on the page
app.post(
  "/identify-product",
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("Received request to identify product.");

      // Validate required parameters
      const { pageContent, basePrompt, modelName } = req.body;
      if (!pageContent || !basePrompt || !modelName) {
        return res.status(400).json({
          success: false,
          error:
            "Missing required parameters: pageContent, basePrompt, or string.",
        });
      }

      // Log parameters for debugging (excluding large page content)
      console.log(
        `Using model: ${modelName}, prompt length: ${basePrompt.length}, content length: ${pageContent.length}`
      );
      // Make the AI call
      const aiResponse = await handleAICall({
        step: 1,
        modelName: modelName,
        basePrompt: basePrompt,
        pageMarkdown: pageContent,
      });

      console.log(`Identification completed in ${aiResponse.timeMs}ms`);

      // Try to parse the response as JSON to validate format
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(aiResponse.data);
        // If we get here, it's valid JSON
      } catch (parseError) {
        console.warn(
          "AI returned non-JSON response:",
          aiResponse.data.substring(0, 100) + "..."
        );
        // We'll still return the data as-is and let the frontend handle it
      }

      // Return successful response
      res.json({
        success: true,
        data: aiResponse.data,
        timeMs: aiResponse.timeMs,
        isValidJson: !!parsedResponse,
      });
    } catch (error) {
      console.error("Error identifying product:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType:
          error instanceof Error ? error.constructor.name : "UnknownError",
      });
    }
  })
);

// API endpoint for finding alternative products
app.post(
  "/find-alternatives",
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("Received request to find alternatives.");

      // Validate required parameters
      const { productDetails, basePrompt, modelName } = req.body;
      if (!productDetails || !basePrompt || !modelName) {
        return res.status(400).json({
          success: false,
          error:
            "Missing required parameters: productDetails, basePrompt, or modelName.",
        });
      }

      // Validate JSON format of productDetails
      try {
        JSON.parse(productDetails);
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          error: "productDetails must be a valid JSON string",
          details:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        });
      }

      // Log parameters for debugging
      console.log(
        `Using model: ${modelName}, prompt length: ${basePrompt.length}, product details length: ${productDetails.length}`
      );

      // Make the AI call
      const aiResponse = await handleAICall({
        step: 2,
        modelName: modelName,
        basePrompt: basePrompt,
        identifiedProductJson: productDetails,
      });

      console.log(`Alternatives found in ${aiResponse.timeMs}ms`);

      // Parse the AI response to extract the list of alternative products
      let alternatives;
      try {
        alternatives = JSON.parse(aiResponse.data)?.comparableProducts;
        if (!Array.isArray(alternatives)) {
          throw new Error("AI response is not an array");
        }
      } catch (error) {
        console.error("Error parsing AI response:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to parse AI response",
        });
      }

      // Initialize eBay API
      const ebay = new eBay({
        appId: process.env.EBAY_APP_ID!,
        certId: process.env.EBAY_CERT_ID!,
        // Add other necessary eBay API configurations here
      });

      // Search for each alternative product on eBay
      const ebayProducts = [];
      for (const alternative of alternatives) {
        try {
          const productsResponse = await ebay.buy.browse.search({
            q: alternative.brand + " " + alternative?.name,
            limit: 1,
            filter: {
              buyingOptions: "FIXED_PRICE",
            },
          });

          const products = productsResponse.itemSummaries;
          if (products && products.length > 0) {
            const product = products[0];
            ebayProducts.push({
              ...alternative,
              title: product.title,
              thumbnail: product.thumbnailImages?.[0]?.imageUrl,
              price: parseFloat(product.price.value),
              // description: product.subtitle || "N/A",
              url: product.itemWebUrl,
            });
          } else {
            ebayProducts.push({
              title: "No product found",
              thumbnail: "",
              price: "N/A",
              description: "No product found",
              url: "",
              ...alternative,
            });
          }
        } catch (error) {
          console.error(`Error searching for ${alternative}:`, error);
          ebayProducts.push({
            title: "Error searching for product",
            thumbnail: "",
            price: "N/A",
            description: "Error searching for product",
            url: "",
          });
        }
      }

      // Return successful response
      res.json({
        success: true,
        data: ebayProducts,
        timeMs: aiResponse.timeMs,
      });
    } catch (error) {
      console.error("Error finding alternatives:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType:
          error instanceof Error ? error.constructor.name : "UnknownError",
      });
    }
  })
);

// Helper function to format parsed Reddit comments for AI context
function formatCommentsForAI(comments: any[], depth: number = 0): string {
  if (!Array.isArray(comments)) return "";

  const indent = "  ".repeat(depth);
  let result = "";

  for (const comment of comments) {
    if (typeof comment === "string") {
      // Simple string comment
      result += `${indent}- ${comment.substring(0, 200)}\n`;
    } else if (comment && typeof comment === "object") {
      // Object with body and potentially children
      if (comment.body) {
        result += `${indent}- ${comment.body.substring(0, 200)}\n`;
      }
      if (comment.children && Array.isArray(comment.children)) {
        result += formatCommentsForAI(comment.children, depth + 1);
      }
    }
  }

  return result;
}

// Helper function to count comments in parsed Reddit data
function countComments(parsedComments: any): number {
  if (!parsedComments || !parsedComments.children) return 0;

  let count = 0;
  function countRecursive(comments: any[]): void {
    for (const comment of comments) {
      if (typeof comment === "string") {
        count++;
      } else if (comment && typeof comment === "object") {
        if (comment.body) count++;
        if (comment.children && Array.isArray(comment.children)) {
          countRecursive(comment.children);
        }
      }
    }
  }

  countRecursive(parsedComments.children);
  return count;
}

// Enhanced scraping function that handles Reddit URLs specially
interface ScrapeResult {
  content: string;
  redditComments?: any;
  redditPost?: any; // Added for snoowrap post data
  isReddit: boolean;
  timeMs: number;
}

async function scrapeUrl(url: string): Promise<string> {
  const result = await scrapeUrlEnhanced(url);
  return result.content;
}

async function scrapeUrlEnhanced(url: string): Promise<ScrapeResult> {
  const startTime = performance.now(); // Start timer for the entire scrapeUrlEnhanced function
  const currentUrl = url; // Capture url for consistent access
  try {
    console.log(`Scraping: ${currentUrl}`);

    // Check if this is a Reddit URL
    const isRedditUrl = currentUrl.includes("reddit.com");

    if (isRedditUrl) {
      console.log(`Reddit URL detected, using snoowrap: ${currentUrl}`);
      const redditScrapeStartTime = performance.now(); // Start timer for Reddit scraping
      const submissionIdMatch = currentUrl.match(
        /(?:reddit.com\/r\/.*?\/\w+\/)([a-z0-9]+)/i
      );
      if (!submissionIdMatch || !submissionIdMatch[1]) {
        console.error(
          `Could not extract Reddit submission ID from URL: ${currentUrl}`
        );
        const redditScrapeEndTime = performance.now();
        const redditScrapeTimeMs = Math.round(
          redditScrapeEndTime - redditScrapeStartTime
        );
        console.log(
          `❌ Reddit scraping failed (invalid URL) for ${currentUrl} in ${redditScrapeTimeMs}ms`
        );
        return {
          content: "",
          isReddit: true,
          timeMs: redditScrapeTimeMs,
        };
      }
      const submissionId = submissionIdMatch[1];

      try {
        // Optimized approach: Fetch submission without expanding replies, then limit comments manually
        const submission: any = await reddit.getSubmission(submissionId);
        const postContent = `${submission.title}\n${
          submission.selftext || ""
        }`.trim();

        // Log comment retrieval metrics for investigation
        console.log(
          `🔍 Reddit submission ${submissionId}: Retrieved ${submission.comments.length} top-level comments`
        );

        // Manually limit to top 5 comments by score for better performance
        const limitedComments = submission.comments
          .sort((a: any, b: any) => b.score - a.score) // Sort by score descending
          .slice(0, 5); // Take only top 5 comments

        const rawComments = limitedComments.map((comment: any) => ({
          author: comment.author.name,
          body: comment.body,
          score: comment.score,
        }));

        // Log total comment processing metrics
        console.log(
          `🔍 Reddit submission ${submissionId}: Processing ${rawComments.length} comments (limited from ${submission.comments.length}) for AI analysis`
        );

        // Transform rawComments to match the expected input of parseBodyData
        // The original parseBodyData expects a structure like { data: { children: [{ data: ... }] } }
        const transformedCommentsForParseBodyData = {
          data: {
            children: rawComments.map((comment: any) => ({ data: comment })),
          },
        };
        const parsedComments = parseBodyData(
          transformedCommentsForParseBodyData
        );

        let commentsText = "";
        if (parsedComments && parsedComments.children) {
          commentsText = formatCommentsForAI(parsedComments.children);
        }

        const fullContent =
          postContent + (commentsText ? `\n\nComments:\n${commentsText}` : "");

        const redditScrapeEndTime = performance.now();
        const redditScrapeTimeMs = Math.round(
          redditScrapeEndTime - redditScrapeStartTime
        );
        console.log(
          `✅ Reddit scraping completed for ${currentUrl} in ${redditScrapeTimeMs}ms`
        );
        return {
          content: fullContent.substring(0, 8000),
          redditPost: submission,
          redditComments: rawComments,
          isReddit: true,
          timeMs: redditScrapeTimeMs,
        };
      } catch (error) {
        console.error(
          `Error fetching Reddit submission with snoowrap for ${currentUrl}:`,
          error
        );
        const redditScrapeEndTime = performance.now();
        const redditScrapeTimeMs = Math.round(
          redditScrapeEndTime - redditScrapeStartTime
        );
        console.log(
          `❌ Reddit scraping failed for ${currentUrl} in ${redditScrapeTimeMs}ms`
        );
        return {
          content: "",
          isReddit: true,
          timeMs: redditScrapeTimeMs,
        };
      }
    } else {
      const nonRedditScrapeStartTime = performance.now(); // Start timer for non-Reddit scraping
      // Original logic for non-Reddit URLs
      const urlObj = new URL(currentUrl);
      const isHttps = urlObj.protocol === "https:";
      const client = isHttps ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 10000,
      };

      return new Promise((resolve) => {
        // Wrapped client.request in a new Promise
        const req = client.request(options, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            try {
              const $ = cheerio.load(data);

              // Comprehensively remove all non-content elements
              $(
                "script, style, nav, footer, header, aside, .ad, .advertisement, .sidebar, .menu, .navigation, .breadcrumb, .social, .share, .pagination, .metadata, .tags, .category, .author-info, .related, .recommended, button, .cookie, .popup, .modal, .overlay, .banner"
              ).remove();

              // Remove elements by common class patterns
              $(
                '[class*="ad-"], [class*="banner"], [class*="promo"], [class*="newsletter"], [id*="ad-"], [id*="banner"], [id*="promo"]'
              ).remove();

              // Extract clean text content from main content areas
              let content = "";

              // Priority selectors for main content
              const contentSelectors = [
                "main",
                "article",
                ".content",
                ".post-content",
                ".entry-content",
                ".article-content",
                ".post-body",
                ".text-content",
                ".description",
                ".post",
                ".entry",
                ".commentarea",
              ];

              // Try to get the best content area
              for (const selector of contentSelectors) {
                const element = $(selector);
                if (element.length > 0) {
                  const text = element.text().trim();
                  if (text && text.length > content.length) {
                    content = text;
                  }
                }
              }

              // If no main content found, extract from body but exclude common non-content areas
              if (!content || content.length < 200) {
                // Clone body and remove more potential noise
                const bodyClone = $("body").clone();
                bodyClone
                  .find("script, style, nav, footer, header, aside, .sidebar")
                  .remove();
                content = bodyClone.text().trim();
              }

              // Clean up the content thoroughly
              content = content
                .replace(/\s+/g, " ") // Multiple spaces to single space
                .replace(/\n+/g, "\n") // Multiple newlines to single newline
                .replace(/\t+/g, " ") // Tabs to spaces
                .replace(/[^\w\s\.\,\!\?\;\:\-\(\)]/g, "") // Remove special characters except basic punctuation
                .trim()
                .substring(0, 6000); // Limit to 6000 chars to stay within token limits

              // Remove very short lines (likely navigation/UI text)
              const lines = content.split("\n");
              content = lines
                .filter((line) => line.trim().length > 10) // Keep only substantial lines
                .join("\n")
                .trim();

              const nonRedditScrapeEndTime = performance.now();
              resolve({
                content,
                isReddit: false,
                timeMs: Math.round(
                  nonRedditScrapeEndTime - nonRedditScrapeStartTime
                ),
              });
            } catch (error) {
              console.error(
                `Error parsing content from ${currentUrl}:`,
                error instanceof Error ? error.message : String(error)
              );
              const nonRedditScrapeEndTime = performance.now();
              resolve({
                content: "",
                isReddit: false,
                timeMs: Math.round(
                  nonRedditScrapeEndTime - nonRedditScrapeStartTime
                ),
              });
            }
          });
        });

        req.on("error", (error) => {
          console.error(`Error scraping ${currentUrl}:`, error.message);
          const nonRedditScrapeEndTime = performance.now();
          resolve({
            content: "",
            isReddit: false,
            timeMs: Math.round(
              nonRedditScrapeEndTime - nonRedditScrapeStartTime
            ),
          });
        });

        req.on("timeout", () => {
          console.error(`Timeout scraping ${currentUrl}`);
          req.destroy();
          const nonRedditScrapeEndTime = performance.now();
          resolve({
            content: "",
            isReddit: false,
            timeMs: Math.round(
              nonRedditScrapeEndTime - nonRedditScrapeStartTime
            ),
          });
        });

        req.end();
      });
    }
  } catch (error) {
    console.error(
      `Error scraping ${currentUrl}:`,
      error instanceof Error ? error.message : String(error)
    );
    const endTime = performance.now(); // End timer for the entire function in case of early error
    const totalTimeMs = Math.round(endTime - startTime);
    console.log(
      `🕐 ❌ Web scraping failed (general error) for ${currentUrl} in ${totalTimeMs}ms`
    );
    return {
      content: "",
      isReddit: false,
      timeMs: totalTimeMs,
    };
  }
}

// Search across ethical shopping sites using Google Custom Search API
app.get(
  "/google-search",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { q, limit = 10 } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          error: "Query parameter 'q' is required",
        });
      }

      console.log(
        `Searching ethical sites for: "${q}" using Google Custom Search`
      );

      const searchLimit = Math.min(Number(limit) || 5, 5); // Limit to 5 for scraping

      // Google Custom Search API parameters
      const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;
      const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;

      if (!cx || !apiKey) {
        return res.status(500).json({
          success: false,
          error:
            "Google Custom Search credentials not configured. Please set GOOGLE_CUSTOM_SEARCH_CX and GOOGLE_CUSTOM_SEARCH_API_KEY environment variables.",
        });
      }

      // Sites to search: reddit.com, quora.com, goodonyou.eco, ethicalelephant.com
      const siteRestriction =
        "site:reddit.com OR site:quora.com OR site:goodonyou.eco OR site:ethicalelephant.com";
      const searchQuery = `${q} ${siteRestriction}`;

      console.log(`Searching for: "${searchQuery}" using Google APIs client`);

      // Initialize Google Custom Search client with custom configuration
      const customsearch = google.customsearch({
        version: "v1",
        auth: apiKey,
      });

      // Make the search request with timing
      const googleSearchStartTime = performance.now();
      const searchResponse = await customsearch.cse.list({
        cx: cx,
        q: searchQuery,
        num: searchLimit,
      });
      const googleSearchEndTime = performance.now();
      const googleSearchTimeMs = Math.round(
        googleSearchEndTime - googleSearchStartTime
      );
      console.log(
        `🕐 ✅ Google Custom Search completed in ${googleSearchTimeMs}ms`
      );

      const data = searchResponse.data;

      // Check if we have search results
      if (!data.items || data.items.length === 0) {
        return res.json({
          success: true,
          data: {
            query: q,
            total_results: 0,
            results: [],
          },
        });
      }

      // Format the results to match our expected interface
      const posts = data.items.map((item: any, index: number) => {
        // Extract domain from URL
        let domain = "unknown";
        try {
          const url = new URL(item.link);
          domain = url.hostname.replace("www.", "");
        } catch (e) {
          console.warn("Could not parse URL:", item.link);
        }

        return {
          id: `google-${index}`,
          title: item.title,
          domain: domain,
          source: domain,
          score: 0, // Google doesn't provide score
          url: item.link,
          permalink: item.link,
          created_utc: 0, // Google doesn't provide creation time
          num_comments: 0, // Google doesn't provide comment count
          snippet: item.snippet || null,
          thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || null,
        };
      });

      // Scrape content from the first 5 URLs for AI analysis
      console.log(
        `Scraping content from ${posts.length} URLs for AI analysis...`
      );
      // Add delays between requests to avoid rate limiting, especially for Reddit
      const scrapingPromises = posts.slice(0, 5).map(async (post, index) => {
        // Add progressive delay for Reddit URLs to avoid overwhelming their servers
        if (post.url.includes("reddit.com")) {
          await new Promise((resolve) => setTimeout(resolve, index * 2000)); // 2 second delays for Reddit
        } else {
          await new Promise((resolve) => setTimeout(resolve, index * 500)); // 500ms for other sites
        }

        const result = await scrapeUrlEnhanced(post.url);
        let sourceInfo = post.source;
        if (result.isReddit) {
          sourceInfo += ` [Reddit post]`;
        }
        return {
          url: post.url,
          title: post.title,
          sourceInfo: sourceInfo,
          content: result.content,
          redditComments: result.redditComments,
          redditPost: result.redditPost,
        };
      });

      const scrapedResults = await Promise.all(scrapingPromises);

      // Combine scraped content with original post data
      const resultsWithContent = posts.map((post) => {
        const scraped = scrapedResults.find((s) => s.url === post.url);
        return {
          ...post,
          content: scraped?.content || post.snippet, // Fallback to snippet if scraping failed
          sourceInfo: scraped?.sourceInfo || post.source,
          redditComments: scraped?.redditComments || undefined,
          redditPost: scraped?.redditPost || undefined,
        };
      });

      // Filter out empty results
      const validResults = scrapedResults.filter(
        (result) => result.content.length > 50
      );

      // Generate AI summary if we have content
      let aiSummary = null;
      if (validResults.length > 0) {
        try {
          console.log(
            `Generating AI summary from ${validResults.length} scraped pages...`
          );

          // Combine all scraped content for AI analysis, with special handling for Reddit
          const combinedContent = validResults
            .map((result) => {
              let contentPreview = result.content.substring(0, 1500);
              let sourceInfo = `Source: ${result.title} (${result.url})`;

              if (result.isReddit && result.redditComments) {
                sourceInfo += ` [Reddit post with ${countComments(
                  result.redditComments
                )} comments]`;
                // For Reddit posts, include a note about comment analysis
                contentPreview +=
                  "\n[Reddit comments included for comprehensive analysis]";
              }

              return `${sourceInfo}\nContent: ${contentPreview}`;
            })
            .join("\n\n---\n\n");

          // Initialize Gemini AI
          const genAI = new GoogleGenerativeAI(
            process.env.GOOGLE_AI_API_KEY || "missing api key"
          );
          const model = genAI.getGenerativeModel({
            // model: "gemini-2.0-flash-exp",
            model: "models/gemini-2.5-flash-lite",
          });

          const redditContext = validResults.some((r) => r.isReddit)
            ? "\n\nNote: Reddit posts include community discussions and user opinions from comments, providing real-world usage insights and recommendations."
            : "";

          const prompt = `Based on the following scraped content from ethical shopping websites, generate a concise numbered list of 3-5 brand / model recommendations for the following query: "${q}".

Content from websites:
${combinedContent}${redditContext}

Please provide:
1. A numbered list (1. 2. 3. etc.) of specific brand / model recommendations, preferably 5 total.
2. Sometimes we may only have have an alternative *brand*, and you will need to infer a suitable model / specific product for that brand that is a good alternative to the original product. However, models / specific products that have been explicitly mentioned take precedence over brand recommendations.
3. Just list the names of the brand and model / specific products. Do not list any more information.
4. Do some sentiment analysis on the products mentioned and only include them in the results if they are discussed in a favorable or neutral context. Do NOT recommend products that are discussed in a negative context.
5. For Reddit content: Pay special attention to user comments and discussions, as these often contain valuable real-world recommendations and experiences.
6. Ideally the recommended products would be from different brands than the original we are finding alternatives for.
7. DO NOT include the product and/or brand we are asking for alternatives for in the results
8. DO NOT just suggest brands- instead, infer and provide a suggested model based on the context of the discussion
9. DO NOT include any extra context in the numbered lists, JUST the brand and model

Format your response as a simple numbered list without additional formatting or information.`;

          const aiStartTime = Date.now();
          const result = await model.generateContent(prompt);
          const response = await result.response;
          aiSummary = response.text();
          const aiEndTime = Date.now();
          const aiDuration = aiEndTime - aiStartTime;

          console.log(`AI summary generated successfully in ${aiDuration}ms`);
        } catch (error) {
          console.error("Error generating AI summary:", error);
          aiSummary = "Unable to generate AI summary at this time.";
        }
      }

      res.json({
        success: true,
        data: {
          query: q,
          total_results: data.searchInformation?.totalResults,
          results: resultsWithContent,
          ai_summary: aiSummary,
          scraped_urls: validResults.length,
        },
      });
    } catch (error) {
      console.error("Error during Google Search:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType:
          error instanceof Error ? error.constructor.name : "UnknownError",
      });
    }
  })
);

// Start the server
app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
  console.log("Registered routes:");
  if (app._router && app._router.stack) {
    app._router.stack.forEach((r: any) => {
      if (r.route && r.route.path) {
        console.log(
          `- ${r.route.stack[0].method.toUpperCase()} ${r.route.path}`
        );
      }
    });
  } else {
    console.log("Unable to introspect routes - router stack not available");
  }
});

// Helper function to extract response text from OpenAI completion
function extractResponseText(completion: any): string {
  if (
    completion &&
    completion.choices &&
    completion.choices.length > 0 &&
    completion.choices[0].message &&
    completion.choices[0].message.content
  ) {
    return completion.choices[0].message.content;
  }
  throw new Error("Could not extract response text from OpenAI completion.");
}
