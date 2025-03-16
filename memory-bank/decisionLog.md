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