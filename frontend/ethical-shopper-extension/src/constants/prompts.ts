// Step 1: Identify the product on the page
export const productIdentificationPrompt = `Analyze the provided page content (Markdown format). Identify the primary product the user seems to be viewing or intending to purchase. If we are on a cart or checkout page, it should be the product in the cart.

The only output should be a JSON object representing the identified product. No extra text, no newlines, no preceding identifiers. The first character should be '{' and the last should be '}'.

Return a single JSON object with the following keys. Ensure all string values are properly escaped within the JSON.

  name: The product name / title of the product listing, MINUS the brand.
  brand: The brand of the product itself.
  sellingCompany: The company selling the product (the shopping site we are currently on).
  price: The price of the product as listed.
  thumbnail: The URL of the product's primary thumbnail image. Ensure this is a direct image URL.
  brandEthicalStatus: A brief description of the perceived ethical standing of the original product's brand, including reasoning.
  sellingCompanyEthicalStatus: A brief description of the perceived ethical standing of the retail/outlet company SELLING the branded product, including reasoning. This may or may not be the same as the brand, but often isn't.
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
  brandEthicalStatus: string;
  sellingCompanyEthicalStatus: string;
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

\`brandEthicalStatus\`: A brief description of the perceived ethical standing of the original product's brand, including reasoning.
\`sellingCompanyEthicalStatus\`: A brief description of the perceived ethical standing of the retail/outlet company SELLING the branded product, including reasoning. This may or may not be the same as the brand, but often isn't.
\`ethicalAlternatives\`: (Optional) An array of alternative *companies* considered more ethical than the original seller, including their name, logo thumbnail URL, and reasoning.
\`comparableProducts\`: An array of specific alternative *products*. Aim for up to 3, but fewer is acceptable. Each product should include:
    *   \`name\`: Alternative product name, MINUS the brand.
    *   \`brand\`: Alternative product brand.
    *   \`sellingCompany\`: parent company of the alternative brand, if applicable.
    *   \`price\`: Price of the alternative.
    *   \`brandEthicalStatus\`: A brief description of the perceived ethical standing of the original product's brand, including reasoning.
    *   \`sellingCompanyEthicalStatus\`: A brief description of the perceived ethical standing of the retail/outlet company SELLING the branded product, including reasoning. This may or may not be the same as the brand, but often isn't.

Make sure that all URLs provided (thumbnails, purchase links, logos) are REAL, accessible, and likely seen during training or verifiable via web search if the model has that capability.

The returned JSON object should match the \`EthicalAnalysisResult\` interface in the following TypeScript definition:

\`\`\`typescript
interface EthicalAnalysisResult {
  brandEthicalStatus: string;
  sellingCompanyEthicalStatus: string;
  ethicalAlternatives?: CompanyAlternative[]; // More ethical companies
  comparableProducts?: EthicalProduct[]; // Specific product alternatives
}

interface CompanyAlternative {
  name: string;
  logoThumbnail: string; // URL of the company logo
  reasoning: string; // Why they are considered more ethical
}

interface EthicalProduct {
  name: string; // The product name / title of the product listing, MINUS the brand.
  brand: string; // The brand of the product itself.
  sellingCompany: string; // The company selling the product (the shopping site we are currently on).
  price: number; // The price of the product as listed.
  thumbnail: string; // The URL of the product's primary thumbnail image. Ensure this is a direct image URL.
  brandEthicalStatus: string; // A brief description of the perceived ethical standing of the original product's brand, including reasoning.
  sellingCompanyEthicalStatus: string; // A brief description of the perceived ethical standing of the retail/outlet company SELLING the branded product, including reasoning. This may or may not be the same as the brand, but often isn't.
}
\`\`\`
`;