import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popup } from '../../src/components/Popup';

// Mock chrome API
const mockChrome = {
  tabs: {
    query: vi.fn(),
  },
  scripting: {
    executeScript: vi.fn(),
  },
};

vi.stubGlobal('chrome', mockChrome);

describe('Popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chrome API mocks
    mockChrome.tabs.query.mockReset();
    mockChrome.scripting.executeScript.mockReset();
  });

  it('should show loading state initially', async () => {
    await act(async () => {
      render(<Popup />);
    });
    expect(screen.getByText('Checking page...')).toBeDefined();
  });

  it('should handle checkout page detection', async () => {
    // Mock tab query response
    mockChrome.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/checkout' },
    ]);

    // Mock successful script execution
    mockChrome.scripting.executeScript.mockResolvedValue([{ result: true }]);

    let rendered;
    await act(async () => {
      rendered = render(<Popup />);
    });

    // Verify initial loading state
    expect(screen.getByText('Checking page...')).toBeDefined();

    // Wait for checkout detection to complete
    await waitFor(() => {
      return expect(screen.getByText('Checkout Detected!')).toBeDefined();
    });

    expect(screen.getByText('Show Alternatives')).toBeDefined();
  });

  it('should handle non-checkout pages', async () => {
    // Mock tab query response
    mockChrome.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://example.com/products' },
    ]);

    // Mock script execution returning false
    mockChrome.scripting.executeScript.mockResolvedValue([{ result: false }]);

    await act(async () => {
      render(<Popup />);
    });

    await waitFor(() => {
      return expect(screen.getByText('Not a Checkout Page')).toBeDefined();
    });

    expect(
      screen.getByText("Keep browsing and we'll notify you when you're ready to checkout!")).toBeDefined();
  });

  it('should handle errors during page check', async () => {
    // Mock tab query failing
    mockChrome.tabs.query.mockRejectedValue(new Error('Failed to get tab'));

    await act(async () => {
      render(<Popup />);
    });

    await waitFor(() => {
      return expect(screen.getByText('Not a Checkout Page')).toBeTruthy();
    });
  });

  it('should use provided isCheckoutForTesting prop when available', async () => {
    await act(async () => {
      render(<Popup isCheckoutForTesting={true} />);
    });

    // Should skip loading state and show checkout detected immediately
    expect(screen.queryByText('Checking page...')).toBeNull();
    expect(screen.getByText('Checkout Detected!')).toBeDefined();
  });

  it('should log when Show Alternatives button is clicked', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await act(async () => {
      render(<Popup isCheckoutForTesting={true} />);
    });

    const button = screen.getByText('Show Alternatives');
    await userEvent.click(button);

    expect(consoleSpy).toHaveBeenCalledWith('Show alternatives clicked');
    consoleSpy.mockRestore();
  });
});