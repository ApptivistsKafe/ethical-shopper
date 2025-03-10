# Checkout Detection Extension Plan

## Project Structure

```
ethical-shopper-extension/
├── public/
│   └── manifest.json
├── src/
│   ├── components/
│   │   └── Popup.tsx
│   ├── services/
│   │   └── checkoutDetector.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.scss
├── test/
│   └── services/
│       └── checkoutDetector.test.ts
├── .eslintrc.js
├── .prettierrc.js
├── vite.config.ts
└── README.md
```

## `checkoutDetector.ts` Plan

1.  **Website List:** A `websites` array with `domain` and `checkoutPatterns` (regular expressions) for at least 50 e-commerce sites.

    ```typescript
    interface Website {
      domain: string;
      checkoutPatterns: RegExp[];
    }

    const websites: Website[] = [
      {
        domain: "amazon.com",
        checkoutPatterns: [/amazon\\.com\/gp\/buy\/spc\/handlers\/display\.html/, /amazon\\.com\/gp\/cart\/view\.html/],
      },
      {
        domain: "ebay.com",
        checkoutPatterns: [/ebay\.com\/myb\/PurchaseHistory/, /ebay\.com\/csc\/home/],
      },
      {
        domain: "etsy.com",
        checkoutPatterns: [/etsy\.com\/cart/, /etsy\.com\/your\/purchases/],
      },
      {
        domain: "walmart.com",
        checkoutPatterns: [/walmart\.com\/checkout/],
      },
      {
        domain: "target.com",
        checkoutPatterns: [/target\.com\/co-cart/],
      },
      // ... more websites will be added later ...
    ];
    ```

2.  **`isCheckoutPage(url, doc)` Function:**

    *   Checks cache (chrome.storage.local, 30-second expiry).
    *   Matches domain and URL against the website list.
    *   Performs heuristic checks (URL keywords, limited DOM analysis within `<form>` elements) if no domain match.
        *   URL Keywords: Check for "checkout", "cart", "order", "pay" (whole words).
        *   DOM Analysis (inside `<form>` elements only):
            *   Input fields: `type="email"`, `type="tel"`, `type="password"`, `type="number"`.
            *   Form `action` attribute: "checkout", "cart", etc.
            * Check for keywords in element IDs, classes, or text content within the entire document: "checkout", "cart", "shipping", "payment", "subtotal", "total".
    *   Returns `true` if either domain-specific patterns match or multiple heuristic checks pass.
    *   Returns `false` on error during DOM analysis.

    ```typescript
        export function isCheckoutPage(url: string, doc: Document): boolean {
          // 1. Caching (check cache first)
          // ... (Implementation details below) ...

          // 2. Domain Matching
          const matchedWebsite = websites.find((website) =>
            url.includes(website.domain)
          );

          // 3. Domain-Specific URL Matching
          if (matchedWebsite) {
            for (const pattern of matchedWebsite.checkoutPatterns) {
              if (pattern.test(url)) {
                // Cache result (true)
                // ... (Implementation details below) ...
                return true;
              }
            }
          }

          // 4. Heuristic Detection (Fallback)
          // ... (Implementation details below) ...

          // Cache result (false)
          // ... (Implementation details below) ...
          return false;
        }
    ```
   **Caching Implementation:**

    ```typescript
        // Inside isCheckoutPage, at the beginning:
        chrome.storage.local.get([url], (result) => {
          if (result[url] && result[url].expiry > Date.now()) {
            return result[url].isCheckout;
          }
        });

        // Inside isCheckoutPage, before returning true or false:
        const cacheData = { isCheckout: true, expiry: Date.now() + 30000 }; // 30 seconds
        chrome.storage.local.set({ [url]: cacheData });
    ```

   **Heuristic Detection Implementation:**

    ```typescript
    // Inside isCheckoutPage, after domain-specific matching fails:
    let confidence = 0;

    // URL Keywords
    const urlKeywords = ["checkout", "cart", "order", "pay"];
    if (urlKeywords.some((keyword) => url.match(new RegExp(`\\b${keyword}\\b`, 'i')))) {
      confidence++;
    }

    // DOM Analysis (Limited to <form> elements)
    try {
      const forms = doc.querySelectorAll("form");
      forms.forEach((form) => {
        // Input Fields
        if (
          form.querySelector(
            'input[type="email"], input[type="tel"], input[type="password"], input[type="number"]'
          )
        ) {
          confidence++;
        }

        // Form Action
        if (form.action && urlKeywords.some((keyword) => form.action.includes(keyword))) {
          confidence++;
        }
      });

      // Check for keywords in element IDs, classes, or text content within the entire document
      const keywords = ["checkout", "cart", "shipping", "payment", "subtotal", "total"];
      if (keywords.some(keyword => doc.body.innerHTML.match(new RegExp(`\\b${keyword}\\b`, 'i')))) {
          confidence += 0.5; // Lower confidence for broad text matches
      }

    } catch (error) {
      console.error("Error during DOM analysis:", error);
      return false; // Return false on error
    }

    return confidence >= 2;
    ```

3.  **Unit Tests:** Extensive tests for all aspects of the service, including positive and negative cases, caching, and error handling.

## Other Files

*   Standard configuration files for Vite, ESLint, and Prettier.
*   `manifest.json` with necessary permissions.
*   `README.md` with build/install/test instructions.