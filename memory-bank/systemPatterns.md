## System Architecture

### Core Components

1. Extension Components
   - Popup (`Popup.tsx`): User interface for checkout detection status, AI model selection (Step 1: Gemini Flash; Step 2: O3 Mini, Gemini Grounded Flash), triggering AI steps, and displaying results (identified product, ethical analysis, alternatives, timing).
   - Background Service (`background.ts`): Manages extension state (e.g., pause), initializes and manages AI API clients (Gemini, OpenAI), handles structured AI call messages (`CALL_AI_MODEL`), routes requests to the appropriate AI model/API (Gemini Flash, `openai.responses.create` with `web_search_preview_2025_03_11` tool for O3 Mini, Gemini Grounded Flash), performs timing, returns structured responses (without cost). Handles the nested array output from `openai.responses.create` to extract text content.
   - Content Scripts (`content.tsx`): Injects Popup on checkout pages, potentially performs initial checkout check via messaging.
   - Development UI (`src/dev/`): Testing interface (current focus is checkout detection, could be expanded).

2. Services
   - `checkoutDetector.ts`: Core checkout page detection logic (URL patterns, DOM analysis, caching, storage abstraction).
   - `aiService.ts`: Acts as a facade/service layer for the frontend (`Popup.tsx`) to interact with the AI backend. Detects environment (extension vs. direct), formats requests for the background script (`CALL_AI_MODEL` message) or makes direct calls (limited), exports HTML processing function (`processHtmlForAI`), defines shared types (simplified model list) for AI requests/responses (without cost fields).

### Design Patterns

1. Adapter Pattern
   - Storage abstraction for different environments
   - Common interface for chrome.storage and development storage
   - Seamless switching between implementations

2. Strategy Pattern
   - Multiple detection strategies (URL patterns, DOM analysis) in `checkoutDetector`.
   - Multiple AI models selectable for Step 2 (alternatives: O3 Mini, Gemini Grounded Flash) - allows choosing different strategies for AI analysis. Step 1 uses a single defined model (Gemini Flash).
   - Background script routes to different AI API implementation strategies based on user selection.

3. Observer Pattern
   - Real-time UI updates based on detection results
   - Asynchronous page analysis
   - State management in development UI

4. Factory Pattern (Potential)
   - Document creation for testing.
   - Storage implementation selection.
   - Test data generation.
   - Potentially used implicitly in background script for selecting/instantiating AI model clients based on configuration/request.
5. Facade Pattern
   - `aiService.ts` provides a simplified interface (`callAIModel`) for the `Popup.tsx` to interact with the complex underlying AI request handling (environment detection, messaging vs. direct calls, parameter formatting).
6. Command Pattern (Messaging)
   - Structured messages (`CALL_AI_MODEL` with parameters like `step`, `modelName`, etc.) sent from `aiService.ts` to `background.ts` encapsulate AI requests as objects.

### Development Patterns

1. Test-First Development
   - Comprehensive test coverage
   - Behavior-driven development
   - Isolated component testing

2. Environment-Aware Architecture
   - Development vs Production modes
   - Mock implementations for browser APIs
   - Testing-friendly abstractions


3. Build System (Webpack)
   - Uses Webpack for bundling TypeScript, React, and SCSS.
   - Configuration (`webpack.config.cjs`) handles:
     - Multiple entry points (popup, content, background, dev).
     - TypeScript compilation (`ts-loader`).
     - SCSS/CSS processing (`sass-loader`, `css-loader`, `style-loader`).
     - HTML generation (`HtmlWebpackPlugin`).
     - Static asset copying (`CopyWebpackPlugin`).
     - Environment variable injection (`DotenvWebpackPlugin`).
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
            S3[Send CALL_AI_MODEL msg]
            S4[Receive Step 1 Response]
            S5[callAIModel(Step 2 params)]
            S6[Send CALL_AI_MODEL msg]
            S7[Receive Step 2 Response]
            %% processHtmlForAI is now called by Popup directly
        end

        subgraph background.ts
            B1[Receive CALL_AI_MODEL msg (Step 1 w/ Markdown)]
            B2{Route to Model API (Step 1)}
            B3[Call External AI API 1]
            B4[Format Step 1 Response (Data/Time)]
            B5[Send Step 1 Response]
            B6[Receive CALL_AI_MODEL msg (Step 2)]
            B7{Route to Model API (Step 2)}
            B8[Call External AI API 2 (e.g., openai.responses.create w/ web search if O3 Mini selected)]
            B9[Format Step 2 Response (Data/Time)]
            B10[Send Step 2 Response]
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
   - Graceful degradation
   - Detailed error logging
   - User-friendly error states

2. Performance
   - Result caching
   - Efficient DOM traversal
   - Minimal storage operations

3. Testing
   - Isolated component tests
   - Integration testing
   - Real-world scenario validation