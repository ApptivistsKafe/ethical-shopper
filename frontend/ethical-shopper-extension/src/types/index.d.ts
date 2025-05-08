npm /// <reference types="chrome"/>

declare module '*.scss' {
  const content: { [className: string]: string };
  export default content;
}

interface Window {
  chrome: typeof chrome;
}

// Extend the Document interface to ensure TypeScript knows about our custom properties
interface Document {
  chrome?: typeof chrome;
}

// Add custom interfaces for our extension
interface Website {
  domain: string;
  checkoutPatterns: RegExp[];
}

interface CacheData {
  isCheckout: boolean;
  expiry: number;
}