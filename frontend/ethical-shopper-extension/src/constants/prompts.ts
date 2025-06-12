// Step 1: Identify the product on the page
export const productIdentificationPrompt = `Analyze the provided page content (Markdown format). Identify the primary product the user seems to be viewing or intending to purchase. If we are on a cart or checkout page, it should be the product in the cart.

The only output should be a JSON object representing the identified product. No extra text, no newlines, no preceding identifiers. The first character should be '{' and the last should be '}'.

Return a single JSON object with the following keys. Ensure all string values are properly escaped within the JSON.

  name: The product name / title of the product listing
  brand: The brand of the product itself.
  sellingCompany: The company selling the product (the shopping site we are currently on).
  price: The price of the product as listed.
  thumbnail: The URL of the product's primary thumbnail image. Ensure this is a direct image URL.
  ethicalStatus: A brief description of the perceived ethical standing of the original product's brand and/or selling company, including reasoning.
  description: The description of the product, if available.
  url: the full url of the product details (if we are on a cart or checkout page, it is not likely to be the current URL).

The returned JSON object should match the \`Product\` interface in the following TypeScript definition:

\`\`\`typescript
interface Product {
  name: string;
  brand: string;
  sellingCompany: string;
  price: number;
  thumbnail: string;
  ethicalStatus: string;
  description: string;
  url: string;
}
\`\`\`
`;

// Step 2: Find ethical alternatives based on the identified product
// Note: This prompt now expects the identified product JSON as part of the input message.
export const ethicalAlternativesPrompt = `Given the following product identified from a webpage:
[IDENTIFIED_PRODUCT_JSON]

Analyze the ethical status of the product's brand (\`brand\`) and the selling company (\`company\`). Then, find comparable alternative products sold by companies or brands generally considered more ethical.

If the original brand is considered ethical but the selling company is not, prioritize finding the *same product* sold by a more ethical retailer first, if possible at a similar price point.

The only output should be a stringified JSON object. No extra text, no newlines, no preceding identifiers. The first character should be '{' and the last should be '}'.

Return a single JSON object with the following keys. Ensure all string values are properly escaped.

1.  \`ethicalStatus\`: A brief description of the perceived ethical standing of the original product's brand and/or selling company, including reasoning.
2.  \`ethicalAlternatives\`: (Optional) An array of alternative *companies* considered more ethical than the original seller, including their name, logo thumbnail URL, and reasoning.
3.  \`comparableProducts\`: An array of specific alternative *products*. Aim for up to 3, but fewer is acceptable. Each product should include:
    *   \`name\`: Alternative product name.
    *   \`brand\`: Alternative product brand.
    *   \`company\`: parent company of the alternative brand, if applicable.
    *   \`price\`: Price of the alternative.
    *   \`ethicalStatus\`: A brief description of the perceived ethical standing of the alternative brand and parent company (if applicable), including reasons.

Make sure that all URLs provided (thumbnails, purchase links, logos) are REAL, accessible, and likely seen during training or verifiable via web search if the model has that capability.

The returned JSON object should match the \`EthicalAnalysisResult\` interface in the following TypeScript definition:

\`\`\`typescript
interface EthicalAnalysisResult {
  ethicalStatus: string; // Description of original product/company ethics
  ethicalAlternatives?: CompanyAlternative[]; // More ethical companies
  comparableProducts?: EthicalProduct[]; // Specific product alternatives
}

interface CompanyAlternative {
  name: string;
  logoThumbnail: string; // URL of the company logo
  reasoning: string; // Why they are considered more ethical
}

interface EthicalProduct {
  name: string;
  thumbnail: string; // URL of the product image
  brand: string;
  ethicalStatus: A brief description of the perceived ethical standing of the alternative brand, including reasons.
}
\`\`\`
`;