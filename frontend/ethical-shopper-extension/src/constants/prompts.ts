import { EthicalStatus } from './ethicalStatus';

const ethicalStatusAddendum = `Prepend the ethical status with one of the following descriptors, based on which best describes the ethical status of the company, followed by a colon and a space:
${EthicalStatus.Excellent},
${EthicalStatus.Good},
${EthicalStatus.Mixed},
${EthicalStatus.Concerning},
${EthicalStatus.Poor},
.`;
const brandEthicalStatus = `A brief description of the perceived ethical standing of the original product's brand, including reasoning. ${ethicalStatusAddendum}`;
const sellingCompanyEthicalStatus = `A brief description of the perceived ethical standing of the retail/outlet company SELLING the branded product, including reasoning. This may or may not be the same as the brand, but often isn't. ${ethicalStatusAddendum}`;
const Product = `
interface Product {
  name: string; // The product name / title of the product listing, MINUS the brand.
  brand: string; // The brand of the product itself.
  sellingCompany: string; // The company selling the product (the shopping site we are currently on).
  price: number; // The price of the product as listed.
  thumbnail: string; // The URL of the product's primary thumbnail image. Ensure this is a direct image URL.
  brandEthicalStatus: string; // ${brandEthicalStatus}
  sellingCompanyEthicalStatus: string; // ${sellingCompanyEthicalStatus}
  description: string; // description of the product
  url: string; // the full url of the product details (if we are on a cart or checkout page, it is not likely to be the current URL).
}`;
// Step 1: Identify the product on the page
export const productIdentificationPrompt = `Analyze the provided page content (Markdown format). Identify the primary product the user seems to be viewing or intending to purchase. If we are on a cart or checkout page, it should be the product in the cart.

The only output should be a JSON object representing the identified product. No extra text, no newlines, no preceding identifiers. The first character should be '{' and the last should be '}'.

Return a single JSON object with the following keys. Ensure all string values are properly escaped within the JSON.

The returned JSON object should match the following TypeScript definition:
${Product}
`;

// Step 2: Find ethical alternatives based on the identified product
// Note: This prompt now expects the identified product JSON as part of the input message.
export const ethicalAlternativesPrompt = `Given the following product identified from a webpage:
[IDENTIFIED_PRODUCT_JSON]

Analyze the ethical status of the product's brand (\`brand\`) and the selling company (\`company\`). Then, find comparable alternative products sold by companies or brands generally considered more ethical.

If the original brand is considered ethical but the selling company is not, prioritize finding the *same product* sold by a more ethical retailer first, if possible at a similar price point.

The only output should be a stringified JSON object. No extra text, no newlines, no preceding identifiers. The first character should be '{' and the last should be '}'.

Return a single JSON object with the following keys. Ensure all string values are properly escaped.

\`brandEthicalStatus\`: string; // ${brandEthicalStatus}
\`sellingCompanyEthicalStatus\`: string; // ${sellingCompanyEthicalStatus}
\`ethicalAlternatives\`: (Optional) An array of alternative *companies* considered more ethical than the original seller, including their name, logo thumbnail URL, and reasoning.
\`comparableProducts\`: An array of specific alternative *products*. Aim for up to 3, but fewer is acceptable. Each product should match the following typescript type / format: ${Product}

Make sure that all URLs provided (thumbnails, purchase links, logos) are REAL, accessible, and likely seen during training or verifiable via web search if the model has that capability.

The returned JSON object should match the \`EthicalAnalysisResult\` interface in the following TypeScript definition:

\`\`\`typescript

${Product}

interface EthicalAnalysisResult {
  brandEthicalStatus: string;
  sellingCompanyEthicalStatus: string;
  ethicalAlternatives?: CompanyAlternative[]; // More ethical companies
  comparableProducts?: Product[]; // Specific product alternatives
}

interface CompanyAlternative {
  name: string;
  thumbnail: string; // URL of the company logo
  reasoning: string; // Why they are considered more ethical than the original company
}

\`\`\`
`;
