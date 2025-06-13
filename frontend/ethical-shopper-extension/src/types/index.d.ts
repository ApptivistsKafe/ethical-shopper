npm; /// <reference types="chrome"/>

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
export interface Website {
  domain: string;
  checkoutPatterns: RegExp[];
}

export interface CacheData {
  isCheckout: boolean;
  expiry: number;
}
export interface Product {
  name: string;
  brand: string;
  sellingCompany: string;
  price: number;
  thumbnail: string;
  brandEthicalStatus: string;
  sellingCompanyEthicalStatus: string;
  description: string | null;
  url: string;
}
