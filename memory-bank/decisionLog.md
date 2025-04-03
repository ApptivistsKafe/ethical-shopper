## Decision Log

### [2025-03-15] - Development Environment Support for checkoutDetector
**Context:** The checkoutDetector service needs to work in both production (Chrome extension) and development/test environments, but chrome.storage API is not available in development.

**Decision:** Implement a storage abstraction layer with environment-specific implementations
- Use Map for in-memory storage in development
- Use chrome.storage.local in production
- Detect environment using chrome API availability
- Implement common interface for both environments

**Rationale:**
- Enables testing without chrome.storage dependency
- Maintains consistent behavior across environments
- Simplifies test mocking
- Allows development UI to work properly

**Implementation:**
- Added environment detection
- Created StorageInterface abstraction
- Implemented development storage using Map
- Added proper error handling

### [2025-03-15] - Testing UI for Checkout Detection
**Context:** Need a way to test checkout detection with different URLs and page content during development.

**Decision:** Add a testing interface in main.tsx that allows:
- URL input for testing pattern matching
- HTML form input for testing DOM analysis
- Live preview of detection results

**Rationale:**
- Enables rapid testing of detection logic
- Helps identify issues with pattern matching
- Allows testing DOM-based detection
- Simplifies development workflow

**Implementation:**
- Added test inputs in main.tsx
- Created mock document from HTML input
- Added real-time detection feedback
- Preserved existing preview functionality

### [2025-03-23] - Extension Messaging System Improvement
**Context:** The extension was experiencing "Could not establish connection" errors due to improper handling of asynchronous messaging between popup and content script.

**Decision:** Restructure message handling in content script and build configuration
- Remove duplicate message listener from vite.config.ts
- Improve async message handling in content.ts
- Implement proper Promise handling in message responses

**Rationale:**
- Eliminates message handling conflicts
- Ensures proper async communication
- Improves reliability of popup-content script interaction
- Follows Chrome extension best practices

**Implementation:**
- Removed duplicated listener from vite plugin
- Restructured content script message handling
- Implemented proper async/await pattern
- Added error handling for message responses

### [2025-03-23] - Cross-Browser Compatibility Strategy
**Context:** The extension needs to work across multiple browsers (Chrome, Firefox, Edge, Safari) while maintaining consistent functionality.

**Decision:** Implement browser-specific configurations and maintain compatibility through manifest.json
- Add Firefox-specific settings through gecko configuration
- Configure Edge-specific UI placement
- Set Safari minimum version requirement
- Keep core functionality browser-agnostic

**Rationale:**
- Enables broader user reach
- Maintains consistent functionality across browsers
- Follows each browser's best practices
- Simplifies distribution process

**Implementation:**
- Added browser_specific_settings to manifest.json
- Configured Firefox extension ID and version requirements
- Added Edge UI placement preferences
- Set Safari minimum version compatibility

### [2025-03-23] - AI Integration Architecture
**Context:** Need to implement Google Generative AI integration that works in both development and extension environments while handling CORS and API security.

**Decision:** Create a dual-mode architecture with environment-specific implementations
- Use direct API calls in development environment
- Use background script for API calls in extension context
- Implement environment detection and automatic switching
- Handle API keys through environment variables

**Rationale:**
- Avoids CORS issues in development
- Maintains security of API keys
- Provides consistent behavior across environments
- Simplifies testing and development workflow
- Follows extension best practices for API calls

**Implementation:**
- Created environment-aware AI service
- Implemented background script API handling
- Added development mode direct API calls
- Set up environment variable configuration
- Added proper error handling and loading states
- Implemented secure API key management
- Added user-friendly UI components for AI interaction

**Security Considerations:**
- API keys stored in environment variables
- Keys not exposed in client-side code
- Secure message passing for extension context
- Error handling for API failures
- Rate limiting considerations documented

### [2025-04-03] - Build System Migration: Vite to Webpack
**Context:** The project initially used Vite for building and development. While Vite offers fast development startup, Webpack provides more mature and flexible configuration options, especially for complex build requirements like Chrome extensions, and has wider community support and tooling integration.
**Decision:** Migrate the project's build system from Vite to Webpack.
- Install Webpack, loaders (ts-loader, sass-loader, css-loader, style-loader), and plugins (HtmlWebpackPlugin, CopyWebpackPlugin, DotenvWebpackPlugin).
- Create a `webpack.config.js` file defining entry points (popup, content, background, dev), output, module rules, plugins, and dev server settings.
- Update `package.json` scripts (`dev`, `build`) to use Webpack commands.
- Remove Vite dependencies and configuration files (`vite.config.ts`, `vitest.config.ts`).
**Rationale:**
- Greater configuration flexibility for extension-specific build needs.
- More robust handling of different entry points and asset types.
- Leverage the extensive Webpack ecosystem and community support.
- Standardize on a widely used and well-understood build tool.
**Implementation:**
- Installed necessary npm packages.
- Created `webpack.config.js` (later renamed to `webpack.config.cjs`).
- Updated `package.json` (added `watch` script).
- Removed Vite files and dependencies (`vite.config.ts`, `vitest.config.ts`, `tsconfig.node.json`).
- **Troubleshooting:**
  - Renamed `webpack.config.js` to `.cjs` to resolve ES module/CommonJS conflict.
  - Updated `tsconfig.json` (`noEmit: false`, `isolatedModules: false`, `moduleResolution: node`, `allowSyntheticDefaultImports: true`, removed Vite types/references).
  - Corrected `ReactDOM` import syntax in `.tsx` files.
- Successfully tested `npm run build` and `npm run dev`.
- Updated Memory Bank files (`activeContext.md`, `progress.md`, `decisionLog.md`, `systemPatterns.md`) to reflect the change and troubleshooting.