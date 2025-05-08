import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isCheckoutPage } from '../../src/services/checkoutDetector';

// Mock chrome.storage.local
const mockStorage = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.stubGlobal('chrome', {
  storage: {
    local: mockStorage,
  },
});

describe('checkoutDetector', () => {
  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();
    mockStorage.get.mockReset();
    mockStorage.set.mockReset();
  });

  describe('isCheckoutPage', () => {
    // Test cache handling
    it('should return cached result if valid', async () => {
      const url = 'https://amazon.com/checkout';
      const cachedResult = {
        [url]: {
          isCheckout: true,
          expiry: Date.now() + 10000,
        },
      };
      mockStorage.get.mockResolvedValue(cachedResult);

      const result = await isCheckoutPage(url, document);
      expect(result).toBe(true);
      expect(mockStorage.get).toHaveBeenCalledWith([url]);
    });

    // Test domain-specific matching
    it('should detect Amazon checkout pages', async () => {
      mockStorage.get.mockResolvedValue({});
      const url = 'https://amazon.com/gp/buy/spc/handlers/display.html';
      const result = await isCheckoutPage(url, document);
      expect(result).toBe(true);
    });

    it('should detect eBay checkout pages', async () => {
      mockStorage.get.mockResolvedValue({});
      const url = 'https://ebay.com/myb/PurchaseHistory';
      const result = await isCheckoutPage(url, document);
      expect(result).toBe(true);
    });

    // Test heuristic detection
    it('should detect checkout pages using heuristics', async () => {
      mockStorage.get.mockResolvedValue({});
      const url = 'https://example.com/checkout';
      
      // Create a mock document with checkout indicators
      const mockDoc = {
        querySelectorAll: vi.fn().mockReturnValue([{
          querySelector: vi.fn().mockReturnValue(true),
          action: 'https://example.com/checkout/process'
        }]),
        body: {
          innerHTML: '<div>Checkout</div><div>Payment</div><div>Total</div>'
        }
      };

      const result = await isCheckoutPage(url, mockDoc as any);
      expect(result).toBe(true);
    });

    // Test non-checkout pages
    it('should return false for non-checkout pages', async () => {
      mockStorage.get.mockResolvedValue({});
      const url = 'https://example.com/products';
      
      const mockDoc = {
        querySelectorAll: vi.fn().mockReturnValue([]),
        body: {
          innerHTML: '<div>Products</div>'
        }
      };

      const result = await isCheckoutPage(url, mockDoc as any);
      expect(result).toBe(false);
    });

    // Test error handling
    it('should handle DOM analysis errors gracefully', async () => {
      mockStorage.get.mockResolvedValue({});
      const url = 'https://example.com/checkout';
      
      const mockDoc = {
        querySelectorAll: vi.fn().mockImplementation(() => {
          throw new Error('DOM error');
        }),
        body: {
          innerHTML: '<div>Checkout</div>'
        }
      };

      const result = await isCheckoutPage(url, mockDoc as any);
      expect(result).toBe(false);
    });

    // Test caching behavior
    it('should cache results with 30-second expiry', async () => {
      mockStorage.get.mockResolvedValue({});
      const url = 'https://amazon.com/gp/cart/view.html';
      await isCheckoutPage(url, document);
      
      expect(mockStorage.set).toHaveBeenCalledWith({
        [url]: {
          isCheckout: true,
          expiry: expect.any(Number),
        },
      });

      const setCall = mockStorage.set.mock.calls[0][0];
      const expiryTime = setCall[url].expiry - Date.now();
      expect(expiryTime).toBeGreaterThan(29000); // Should be close to 30 seconds
      expect(expiryTime).toBeLessThan(30100);
    });
  });
});