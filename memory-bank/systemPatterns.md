## System Architecture

### Project Structure

```
/
├── backend/
│   ├── src/
│   │   └── index.ts         # Node.js Express server with AI API endpoints
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                 # Backend environment variables (including API keys)
└── frontend/
    └── ethical-shopper-extension/
        ├── public/
        │   └── assets/
        │       └── icon16.png
        ├── src/
        │   ├── background/
        │   │   └── background.ts  # Minimal background script (pause state)
        │   ├── components/
        │   │   └── Popup.tsx      # React UI component
        │   ├── constants/
        │   │   └── prompts.ts     # AI prompts
        │   ├── content/
        │   │   └── content.tsx    # Content script (injects Popup)
        │   ├── dev/
        │   │   ├── index.html
        │   │   └── main.tsx       # Development entry point
        │   ├── services/
        │   │   ├── aiService.ts   # Frontend service to call backend AI API
        │   │   └── checkoutDetector.ts # Checkout detection logic
        │   ├── types/
        │   │   └── index.d.ts     # TypeScript type definitions
        │   ├── config.ts          # Frontend configuration (including backend URL)
        │   └── styles.scss        # SCSS styles
        ├── test/
        │   └── ...                # Frontend tests
        ├── .eslintrc.js
        ├── .gitignore
        ├── .prettierrc.js
        ├── manifest.json          # Extension manifest
        ├── package-lock.json
        ├── package.json           # Frontend dependencies and scripts
        ├── README.md
        ├── tsconfig.json
        └── webpack.config.cjs     # Frontend build configuration
```

### Core Components

1. Backend Service (`backend/src/index.ts`)
   - Node.js Express server.
   - Hosts API endpoints for AI interactions (`/identify-product`, `/find-alternatives`).
   - Initializes and manages AI API clients (Gemini, OpenAI).
   - Contains the core logic for calling external AI models (`handleAICall`).
   - Loads AI API keys from backend environment variables (`.env`).

2. Frontend Extension (`frontend/ethical-shopper-extension/`)
   - **Popup (`src/components/Popup.tsx`):** User interface for checkout detection status, AI model selection, triggering AI steps, and displaying results (identified product, ethical analysis, alternatives, timing). Communicates with the backend API via `aiService.ts`.
   - **Background Service (`src/background/background.ts`):** Minimal script primarily handling extension state (e.g., pause). No longer handles AI API calls directly.
   - **Content Scripts (`src/content/content.tsx`):** Injects Popup on checkout pages.
   - **AI Service (`src/services/aiService.ts`):** Acts as a facade/service layer for the frontend UI to interact with the backend AI API. Uses `fetch` to make HTTP requests to the backend endpoints. Handles request formatting and response parsing.
   - **Checkout Detector (`src/services/checkoutDetector.ts`):** Core checkout page detection logic (URL patterns, DOM analysis, caching, storage abstraction).
   - **Development UI (`src/dev/`):** Testing interface.

### Design Patterns

1. Adapter Pattern
   - Storage abstraction for different environments (in `checkoutDetector.ts`).
   - Common interface for chrome.storage and development storage.
   - Seamless switching between implementations.

2. Strategy Pattern
   - Multiple detection strategies (URL patterns, DOM analysis) in `checkoutDetector`.
   - Multiple AI models selectable for Step 2 (alternatives: O3 Mini, Gemini Grounded Flash) - allows choosing different strategies for AI analysis. Step 1 uses a single defined model (Gemini Flash).
   - Backend routes to different AI API implementation strategies based on user selection.

3. Observer Pattern
   - Real-time UI updates based on detection results.
   - Asynchronous page analysis.
   - State management in development UI.

4. Factory Pattern (Potential)
   - Document creation for testing.
   - Storage implementation selection.
   - Test data generation.
   - Potentially used implicitly in backend for selecting/instantiating AI model clients.

5. Facade Pattern
   - `aiService.ts` provides a simplified interface (`callAIModel`) for the `Popup.tsx` to interact with the backend AI API.

### Development Patterns

1. Test-First Development
   - Comprehensive test coverage.
   - Behavior-driven development.
   - Isolated component testing.

2. Environment-Aware Architecture
   - Development vs Production modes.
   - Mock implementations for browser APIs.
   - Testing-friendly abstractions.
   - Separate frontend and backend environments with distinct configurations.

3. Build System (Webpack)
   - Uses Webpack for bundling frontend assets (TypeScript, React, SCSS).
   - Configuration (`frontend/ethical-shopper-extension/webpack.config.cjs`) handles:
     - Multiple entry points (popup, content, background, dev).
     - TypeScript compilation (`ts-loader`).
     - SCSS/CSS processing (`sass-loader`, `css-loader`, `style-loader`).
     - HTML generation (`HtmlWebpackPlugin`).
     - Static asset copying (`CopyWebpackPlugin`).
     - Environment variable injection (`DotenvWebpackPlugin`) for frontend config (like backend URL).
   - Separate configurations for development (with `webpack-dev-server`) and production.

### Data Flow

1. Checkout Detection

   ```
   URL/DOM Input -> Pattern Matching -> Confidence Scoring -> Cache -> Result
   ```

2. Development Testing

   ```
   User Input -> Mock Document -> Detection Service -> UI Update
   ```

3. Extension Flow (Checkout Detection)

   ```mermaid
   graph LR
       A[Page Load] --> B(Content Script);
       B --> C{Checkout Check?};
       C -- Yes --> D(Inject Popup);
       C -- No --> E(Do Nothing);
   ```

4. Extension Flow (AI Analysis - Two Step)

   ```mermaid
    graph LR
        subgraph Frontend (Extension)
            subgraph Popup UI
                P1[Select Step 1 Model]
                P2[Click Identify Product]
                P2_HTML[Get Page HTML]
                P2_MD[Call processHtmlForAI]
                P3[Display Step 1 Result/Time]
                P4[Select Step 2 Model]
                P5[Click Find Alternatives]
                P6[Display Step 2 Result/Time]
            end
            subgraph aiService.ts
                S1[callAIModel(Step 1 params w/ Markdown)]
                S3[Send HTTP POST to Backend /identify-product]
                S4[Receive Step 1 Response]
                S5[callAIModel(Step 2 params)]
                S6[Send HTTP POST to Backend /find-alternatives]
                S7[Receive Step 2 Response]
                %% processHtmlForAI is called by Popup directly
            end
        end

        subgraph Backend (Node.js Server)
            subgraph index.ts
                B1[Receive /identify-product Request]
                B2[Call handleAICall (Step 1)]
                B3[Call External AI API 1]
                B4[Format Step 1 Response (Data/Time)]
                B5[Send Step 1 Response (JSON)]
                B6[Receive /find-alternatives Request]
                B7[Call handleAICall (Step 2)]
                B8[Call External AI API 2]
                B9[Format Step 2 Response (Data/Time)]
                B10[Send Step 2 Response (JSON)]
            end
        end

        P1 --> P2;
        P2 --> P2_HTML;
        P2_HTML --> P2_MD;
        P2_MD -- Markdown --> S1;
        S1 --> S3;
        S3 --> B1;
        B1 --> B2;
        B2 --> B3;
        B3 --> B4;
        B4 --> B5;
        B5 --> S4;
        S4 --> P3;

        P3 -- Identified Product JSON --> S5;
        P4 --> P5;
        P5 --> S5;
        S5 --> S6;
        S6 --> B6;
        B6 --> B7;
        B7 --> B8;
        B8 --> B9;
        B9 --> B10;
        B10 --> S7;
        S7 --> P6;
   ```

### Best Practices

1. Error Handling
   - Graceful degradation.
   - Detailed error logging (both frontend and backend).
   - User-friendly error states in the frontend.

2. Performance
   - Result caching (in frontend `checkoutDetector`).
   - Efficient DOM traversal (in frontend `processHtmlForAI`).
   - Minimal storage operations.
   - Backend handles potentially long-running AI calls, keeping frontend responsive.

3. Testing
   - Isolated component tests (frontend).
   - Integration testing (frontend calling backend).
   - Unit tests for backend AI logic.
   - Real-world scenario validation.
