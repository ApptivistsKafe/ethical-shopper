interface Website {
  domain: string;
  checkoutPatterns: RegExp[];
}

const websites: Website[] = [
  {
    domain: "amazon.com",
    checkoutPatterns: [/amazon\.com\/gp\/buy\/spc\/handlers\/display\.html/, /amazon\.com\/gp\/cart\/view\.html/],
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
  // Add more major e-commerce websites
  {
    domain: "bestbuy.com",
    checkoutPatterns: [/bestbuy\.com\/checkout/, /bestbuy\.com\/cart/],
  },
  {
    domain: "wayfair.com",
    checkoutPatterns: [/wayfair\.com\/checkout/, /wayfair\.com\/cart/],
  },
  {
    domain: "homedepot.com",
    checkoutPatterns: [/homedepot\.com\/checkout/, /homedepot\.com\/cart/],
  },
  {
    domain: "nike.com",
    checkoutPatterns: [/nike\.com\/checkout/, /nike\.com\/cart/],
  },
  {
    domain: "apple.com",
    checkoutPatterns: [/apple\.com\/shop\/checkout/, /apple\.com\/shop\/cart/],
  }
];

interface CacheData {
  isCheckout: boolean;
  expiry: number;
}

async function setCacheResult(url: string, isCheckout: boolean): Promise<void> {
  const cacheData: CacheData = {
    isCheckout,
    expiry: Date.now() + 30000, // 30 seconds
  };
  await chrome.storage.local.set({ [url]: cacheData });
}

export async function isCheckoutPage(url: string, doc: Document): Promise<boolean> {
  try {
    // 1. Check cache
    const cacheResult = await chrome.storage.local.get([url]);
    if (cacheResult[url]) {
      const cacheData = cacheResult[url] as CacheData;
      if (cacheData.expiry > Date.now()) {
        return cacheData.isCheckout;
      }
    }

    // 2. Domain Matching
    const matchedWebsite = websites.find((website) =>
      url.toLowerCase().includes(website.domain)
    );

    // 3. Domain-Specific URL Matching
    if (matchedWebsite) {
      for (const pattern of matchedWebsite.checkoutPatterns) {
        if (pattern.test(url)) {
          await setCacheResult(url, true);
          return true;
        }
      }
    }

    // 4. Heuristic Detection (Fallback)
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
      await setCacheResult(url, false);
      return false;
    }

    const result = confidence >= 2;
    await setCacheResult(url, result);
    return result;

  } catch (error) {
    console.error("Error in isCheckoutPage:", error);
    return false;
  }
}