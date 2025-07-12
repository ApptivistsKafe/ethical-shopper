import { EthicalStatus } from './ethicalStatus';

const ethicalStatusAddendum = `Prepend the ethical status with one of the following descriptors (effectively representing a 1-5 rating scale), based on which best describes the ethical status of the company, followed by a colon and a space:
${EthicalStatus.Poor}, // 1 - The company has a fairly poor reputation and, as a pattern, engages in practices which are generally considered unethical, or has engaged in isolated incidents considered extremely unethical.
${EthicalStatus.Concerning}, // 2 - The company has engaged in unethical behavior and doesn't have many redeeming factors, at least not proportional to the unethical behavior.
${EthicalStatus.Mixed}, // 3 - The company may have encountered some controversy, but has attempted to make legitimate, proportional amends or has engaged in other behavior positive (and proportional) enough that it may balance out their reputation.
${EthicalStatus.Good}, // 4 - The company has a mostly-good reputation without major controversy.
${EthicalStatus.Excellent}, // 5 - The company does not have major controversies (or the controversies are minor enough not to move the needle) and has gone out of their way to affect positive change through their mission or action.
. When doing this, attempt to differentiate between a company's core mission, PR and lipwork designed to help their image, 
their actual actions behind closed doors, what issues may have been isolated incidents and which may be emblematic of a larger pattern.
Also, consider if they donate extensively to Democrats, Republicans, or both political parties, which might be considered 'Good', 'Poor', or 'Mixed', respectively, in isolation (but maybe not always, depending on the context of their larger reputation / actions).
Err on the side of making a positive or negative judgment, rather than mixed, to help the user make a decision, but feel free to use mixed if it truly seems to be the best choice.
Lack of information is not enough to give a company a mixed or negative rating. If you cannot find specific controversies associated with a company, it should be rated Good or higher.
If a company is not associated with specific controversies, AND they attempt positive change through their mission or actions, it should likely be rated as Excellent.
On the other hand, if a company (like Walmart, Amazon, oil companies, Elon Musk's companies, Comcast, Meta/Facebook, Twitter, Fox BP, the Trump Organization, Bitcoin or many crypto companies, ) is KNOWN to regularly engage in severely unethical practices
(e.g. (union-busting, unfair labor, disproportionately supporting or donating to Republicans, child labor, unsafe worker conditions, disinformation, fraud, surveillance, unnecessary environmental impact, unnecessary animal cruelty, anti-democratic or dramatically anti-competitive or other massive negative externalities),
it almost doesn't matter what positives they provide, they should be regarded as Concerning or Poor.
Actions cowtowing to corrupt countries and politicians like donating to trump's inaugural fund, rolling back DEI initiatives, censoring information for the Chinese government about Taiwan, Tiananmen Square, etc, or cooperating in government surveillance programs (unless they had absolutely no other choice) should earn a company a Mixed or lower rating.`;
const ethicalStatus = `A brief description of the perceived ethical standing of the INSERT_HERE, including reasoning. ${ethicalStatusAddendum}`;
const brandEthicalStatus = ethicalStatus.split('INSERT_HERE').join(`original product's brand`);
const sellingCompanyEthicalStatus = ethicalStatus
  .split('INSERT_HERE')
  .join(
    `retail/outlet company SELLING the branded product (which may or may not be the same as the brand, but often isn't)`
  );
const Product = `
interface Product {
  name: string; // The product name / title of the product listing, MINUS the brand, e.g. if the product name starts with a string that matches / nearly matches the identified brand, remove it.
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
