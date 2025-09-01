import express, { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import cors from "cors";
import eBay from "ebay-api";
import Snoowrap from "snoowrap";

// Load environment variables
dotenv.config();

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

// Initialize Reddit Client (Snoowrap)
let reddit: Snoowrap | null = null;
if (
  process.env.REDDIT_CLIENT_ID &&
  process.env.REDDIT_CLIENT_SECRET &&
  process.env.REDDIT_USERNAME &&
  process.env.REDDIT_PASSWORD
) {
  try {
    reddit = new Snoowrap({
      clientId: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      username: process.env.REDDIT_USERNAME,
      password: process.env.REDDIT_PASSWORD,
      userAgent: process.env.REDDIT_USER_AGENT || "EthicalShopper/1.0.0",
    });
    console.log("Reddit client initialized successfully");
  } catch (error) {
    console.warn("Failed to initialize Reddit client:", error);
  }
} else {
  console.warn(
    "Reddit API credentials not found in environment variables. Reddit search will not be available."
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
    // const completion = await openai.responses.create({
    //   model: string, // Updated to use the correct O3 Mini model
    //   input: finalPrompt,
    // });
    // const completion = await openai.responses.create({
    //   model: string,
    //   input: finalPrompt,
    // });
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
      // if (!completion.output || !Array.isArray(completion.output)) {
      //   throw new Error("Invalid completion output format: expected an array");
      // }

      // const messageItem = completion.output.find(
      //   (item: any) =>
      //     typeof item === "object" && item !== null && item.type === "message"
      // );

      // if (!messageItem) {
      //   throw new Error("No 'message' item found in output array");
      // }

      // // Need to cast to any due to incomplete type definitions
      // const messageItemAny = messageItem as any;

      // if (!messageItemAny.content || !Array.isArray(messageItemAny.content)) {
      //   throw new Error("No 'content' array found in message item");
      // }

      // const textItem = messageItemAny.content.find(
      //   (contentItem: any) =>
      //     typeof contentItem === "object" &&
      //     contentItem !== null &&
      //     contentItem.type === "output_text"
      // );

      // if (!textItem || typeof textItem.text !== "string") {
      //   throw new Error("No valid 'output_text' item found in content array");
      // }

      // responseText = textItem.text;
      // console.log(
      //   "Successfully processed response from openai.responses.create"
      // );

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

// Reddit search endpoint
// Reddit search endpoint using Snoowrap
app.get(
  "/reddit-search",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      if (!reddit) {
        return res.status(503).json({
          success: false,
          error:
            "Reddit client not initialized. Please check your Reddit API credentials.",
        });
      }

      const {
        q,
        subreddit,
        limit = 10,
        sort = "relevance",
        t = "all",
      } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({
          success: false,
          error: "Query parameter 'q' is required",
        });
      }

      console.log(`Searching Reddit for: "${q}" using Snoowrap`);

      let searchResults;
      const searchLimit = Math.min(Number(limit) || 10, 100);

      if (subreddit && typeof subreddit === "string") {
        // Search within specific subreddit
        console.log(`Searching in r/${subreddit}`);
        const subredditObj = reddit.getSubreddit(subreddit);

        // Map sort parameters to snoowrap sort options
        let sortOption: "relevance" | "hot" | "top" | "new" | "comments" =
          "relevance";
        if (
          ["relevance", "hot", "top", "new", "comments"].includes(
            sort as string
          )
        ) {
          sortOption = sort as "relevance" | "hot" | "top" | "new" | "comments";
        }

        // Map time filter to snoowrap time options
        let timeOption: "hour" | "day" | "week" | "month" | "year" | "all" =
          "all";
        if (
          ["hour", "day", "week", "month", "year", "all"].includes(t as string)
        ) {
          timeOption = t as "hour" | "day" | "week" | "month" | "year" | "all";
        }

        searchResults = await subredditObj.search({
          query: q,
          sort: sortOption,
          time: timeOption,
        });
      } else {
        // Search all of Reddit
        console.log("Searching all of Reddit");

        // Map sort parameters to snoowrap sort options
        let sortOption: "relevance" | "hot" | "top" | "new" | "comments" =
          "relevance";
        if (
          ["relevance", "hot", "top", "new", "comments"].includes(
            sort as string
          )
        ) {
          sortOption = sort as "relevance" | "hot" | "top" | "new" | "comments";
        }

        // Map time filter to snoowrap time options
        let timeOption: "hour" | "day" | "week" | "month" | "year" | "all" =
          "all";
        if (
          ["hour", "day", "week", "month", "year", "all"].includes(t as string)
        ) {
          timeOption = t as "hour" | "day" | "week" | "month" | "year" | "all";
        }

        searchResults = await reddit.search({
          query: q,
          sort: sortOption,
          time: timeOption,
        });
      }

      // Format the results to match our expected interface and apply limit
      const posts = searchResults
        .slice(0, searchLimit)
        .map((submission: any) => ({
          id: submission.id,
          title: submission.title,
          subreddit:
            submission.subreddit_name_prefixed?.replace("r/", "") ||
            submission.subreddit?.display_name ||
            "unknown",
          author: submission.author?.name || "[deleted]",
          score: submission.score || 0,
          url: submission.url,
          permalink: `https://www.reddit.com${submission.permalink}`,
          created_utc: submission.created_utc,
          num_comments: submission.num_comments || 0,
          selftext: submission.selftext || null,
          thumbnail:
            submission.thumbnail &&
            submission.thumbnail !== "self" &&
            submission.thumbnail !== "default" &&
            submission.thumbnail !== "nsfw" &&
            submission.thumbnail.startsWith("http")
              ? submission.thumbnail
              : null,
        }));

      res.json({
        success: true,
        data: {
          query: q,
          subreddit: subreddit || "all",
          total_results: posts.length,
          posts: posts,
        },
      });
    } catch (error) {
      console.error("Error searching Reddit with Snoowrap:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType:
          error instanceof Error ? error.constructor.name : "UnknownError",
      });
    }
  })
);

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);

  // Log all registered routes for debugging
  console.log("Registered routes:");
  if (app._router && app._router.stack) {
    app._router.stack.forEach((r: any) => {
      if (r.route && r.route.path) {
        console.log(`${Object.keys(r.route.methods)} ${r.route.path}`);
      }
    });
  } else {
    console.log("Unable to introspect routes - router stack not available");
  }
});
function extractResponseText(
  completion: OpenAI.Chat.Completions.ChatCompletion & {
    _request_id?: string | null;
  }
): string {
  const text = completion.choices[0].message.content || "";
  // Use regex to find all JSON code blocks
  // This regex captures the content inside ```json ... ```
  const regex = /```json\s*([\s\S]*?)```/g;
  const matches = [...text.matchAll(regex)];

  if (matches.length === 1) {
    // Extract just the JSON content
    const jsonContents = matches.map((match) => match[1]);
    return jsonContents[0];
  }
  return text;
}
