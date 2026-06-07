import type { ModelProvider, ExtractCartFn, Cart } from '@ethical-shopper/core'
import { parseCart } from '@ethical-shopper/core'

// Max markdown chars to send to the extraction model.
// Gemini Flash Lite has a large context window; 16k chars covers most cart pages.
const MAX_MARKDOWN_CHARS = 16_000

const SYSTEM_PROMPT = `You are a precise data extraction model.
Your task is to extract shopping cart contents from a webpage's markdown content.
Return ONLY valid JSON — no markdown fences, no explanation, no commentary.

Extract:
- items: array of cart line items (name, brand, sellingCompany, price, url)
- sourceUrl: the URL of the page provided

For each item's sellingCompany:
- Use the marketplace or retailer name when buying through a third-party platform (Amazon, eBay, Walmart, Target, etc.)
- Use the brand name when buying directly from a brand's own website
- If ambiguous, use the primary domain name (e.g. "bestbuy.com" → "Best Buy")

Return JSON in this exact shape:
{
  "items": [
    {
      "name": "Product display name",
      "brand": "Brand name, or null if unknown",
      "sellingCompany": "Company you are transacting with",
      "price": 29.99,
      "url": "https://..." or null
    }
  ],
  "sourceUrl": "https://..."
}`

/**
 * Extracts a Cart from the markdown representation of a checkout/cart page.
 *
 * Uses a cheap, fast model (e.g. Gemini 2.5 Flash-Lite) for structured extraction.
 * Validates the result against CartSchema so callers always receive a well-typed Cart.
 *
 * @throws {ZodError}  if the model returns JSON that doesn't match CartSchema
 * @throws {SyntaxError}  if the model returns invalid JSON
 * @throws {Error}  if the model call fails
 */
export const extractCart: ExtractCartFn = async (
  markdown: string,
  provider: ModelProvider,
): Promise<Cart> => {
  const truncated = markdown.slice(0, MAX_MARKDOWN_CHARS)

  const response = await provider.complete(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Extract the shopping cart from this page content:\n\n${truncated}`,
      },
    ],
    { jsonMode: true, maxTokens: 1024, temperature: 0 },
  )

  const parsed: unknown = JSON.parse(response.content)
  return parseCart(parsed)
}
