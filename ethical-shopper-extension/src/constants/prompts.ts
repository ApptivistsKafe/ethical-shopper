export const alternativesPrompt = `What product(s) is the user buying on this page? If the user doesn't seem to be actively buying a product on this page, does the page seem to be a product listing page? If so, what is the primary product being featured on this page?

The only output should be a stringified JSON object, no extra text. No newline characters, no preceding identifier strings, e.g. the first character in the response should be '[' and the last should be ']'. The second character should be '{', and the second-to-last character should be '}'. 

Return the products as an array in JSON format. Each element of the array will be a product with the following keys:

Make sure that all URLs provided are REAL and accessible, and have been seen before in training by the LLM. It is crucial that the URLs do not break and can be followed by the user.

1. The product name
2. The company selling the product (the shopping site, not necessarily the brand of the product itself)
3. The brand of the product itself (this may or may not be the same as the company selling the product)
4. The price
5. Whether people consider the company ethical or unethical, and why
6. Alternative companies, if any, that people seem to find more ethical
7. Comparable products sold by more ethical companies or brands, with the above info including price, 
and an embedded link to purchase.
8. The URL of the thumbnail for the product

Double check all links for correctness. 
Ideally we would have three product recommendations, but less is alright.
If the brand is ethical but the company selling it isn't, 
then the first result should be to buy the SAME product at a similar price from a different, more ethical seller, if possible.
If this is not possible, just default to the normal behavior.

The returned JSON object should match AlternativeProducts in the following typescript definition:

interface AlternativeProducts {
  name: string;
  thumbnail: string; // URL of the product image
  company: string; // Selling site
  brand: string;
  price: string;
  ethicalStatus: string; // Description of ethics
  ethicalAlternatives?: CompanyAlternative[]; // More ethical companies
  comparableProducts?: EthicalProduct[]; // Specific product alternatives
  purchaseLink?: string; // Added for comparable products
}

interface CompanyAlternative {
  name: string;
  logoThumbnail: string; // URL of the company logo
  reasoning: string; // Why they are considered more ethical
}

interface EthicalProduct {
  name: string;
  thumbnail: string; // URL of the product image
  company: string;
  brand: string;
  price: string;
  purchaseLink: string;
}`;