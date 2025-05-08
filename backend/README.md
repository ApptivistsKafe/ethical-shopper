# Backend Service

This directory contains the backend service for the Ethical Shopper browser extension. Its primary responsibility is to handle computationally intensive tasks, specifically interacting with external AI models for ethical analysis and alternative product suggestions, offloading this work from the browser extension itself.

## Technologies Used

- **Node.js:** The runtime environment for the server.
- **Express:** A minimal and flexible Node.js web application framework.
- **TypeScript:** Provides static typing for improved code maintainability and developer experience.
- **ts-node:** Executes TypeScript files directly in Node.js.
- **dotenv:** Loads environment variables from a `.env` file.
- **@google/generative-ai:** Client library for interacting with Google's Generative AI models (Gemini).
- **openai:** Client library for interacting with OpenAI models.

## Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Variables:**
    Create a `.env` file in the `backend/` directory based on the `.env.example` file. This file will contain your API keys for the AI services.
    ```dotenv
    GOOGLE_AI_API_KEY=YOUR_GEMINI_API_KEY
    OPENAI_API_KEY=YOUR_OPENAI_API_KEY
    BACKEND_PORT=3000 # Optional: specify a port, defaults to 3000
    ```
    Replace `YOUR_GEMINI_API_KEY` and `YOUR_OPENAI_API_KEY` with your actual API keys.

## Running the Backend

To start the backend server, use the following command from the `backend/` directory:

```bash
npm start
```

This command first compiles the TypeScript code using `tsc` and then runs the compiled JavaScript file (`dist/index.js`) using Node.js. The server will listen on the port specified in your `.env` file (defaulting to 3000).

## API Endpoints

The backend provides the following API endpoints for the frontend extension:

-   `POST /identify-product`:
    -   **Description:** Analyzes the provided page content (in Markdown format) to identify the product being viewed.
    -   **Request Body:**
        ```json
        {
          "pageContent": "string", // Markdown content of the page
          "basePrompt": "string",  // Base prompt for the AI model
          "modelName": "gemini-flash-2.0" // Expected model for this step
        }
        ```
    -   **Response Body:**
        ```json
        {
          "success": boolean,
          "data": "string", // Identified product details (likely JSON string)
          "timeMs": number // Time taken for the AI call in milliseconds
        }
        ```
-   `POST /find-alternatives`:
    -   **Description:** Finds ethical alternatives based on the identified product details.
    -   **Request Body:**
        ```json
        {
          "productDetails": "string", // JSON string of the identified product from /identify-product
          "basePrompt": "string",     // Base prompt for the AI model (including [IDENTIFIED_PRODUCT_JSON] placeholder)
          "modelName": "openai-gpt-o3-mini" | "gemini-flash-2.0-grounded" // Selected model for this step
        }
        ```
    -   **Response Body:**
        ```json
        {
          "success": boolean,
          "data": "string", // Ethical alternatives and analysis
          "timeMs": number // Time taken for the AI call in milliseconds
        }
        ```

## AI Model Integration

The backend integrates with the following AI models:

-   **Google Gemini:** Used for the initial product identification step (`gemini-flash-2.0`) and potentially for grounded alternatives (`gemini-flash-2.0-grounded`).
-   **OpenAI:** Used for finding ethical alternatives (`openai-gpt-o3-mini`), leveraging its web search capabilities via the `responses.create` API.

## Testing

To test the API endpoints, a test script is included:

```bash
# Make the script executable
chmod +x test-api.sh

# Run the test script (defaults to http://localhost:3000)
./test-api.sh

# Specify a different API URL
./test-api.sh http://localhost:8000
```

The test script simulates:
1. A product identification request (`/identify-product`) using Gemini Flash
2. A find alternatives request (`/find-alternatives`) using OpenAI O3 Mini
3. A find alternatives request (`/find-alternatives`) using Gemini Grounded

For proper testing, both API keys (Gemini and OpenAI) must be correctly set in your `.env` file.

## Further Context

For a broader understanding of the project's vision, core features, and overall architecture, please refer to the main project README and the Memory Bank documentation in the root directory.