import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from '../config';
import {
    AIRequestParams,
    AIResponse,
    ModelName,
    ExtensionAICallPayload, // Renamed for clarity if needed, but using AIRequestParams is fine
    StepOneModel,
    StepTwoModel
} from '../services/aiService'; // Import necessary types

// Check if we're in the extension context
const isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;

// --- Initialize API Clients ---
let genAI: GoogleGenerativeAI | null = null;
let openai: OpenAI | null = null;

if (isExtensionContext) {
    // Initialize Gemini Client
    if (config.GOOGLE_AI_API_KEY) {
        genAI = new GoogleGenerativeAI(config.GOOGLE_AI_API_KEY);
    } else {
        console.warn("Google AI API Key not found in config. Gemini models will not be available.");
    }

    // Initialize OpenAI Client
    if (config.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: config.OPENAI_API_KEY,
            // dangerouslyAllowBrowser: true // Avoid this if possible, keep API calls in background
        });
    } else {
        console.warn("OpenAI API Key not found in config. OpenAI models will not be available.");
    }

    // TODO: Initialize DeepSeek client if/when needed and library/API details are known
}

// --- Message Listener ---
if (isExtensionContext) {
    chrome.runtime.onMessage.addListener((message: ExtensionAICallPayload | { type: string, paused?: boolean }, sender, sendResponse) => {
        if (message.type === 'CALL_AI_MODEL') {
            console.log('Background received CALL_AI_MODEL:', message);
            handleAICall(message as AIRequestParams) // Cast message
                .then(response => {
                    console.log('Background sending success response:', response);
                    sendResponse({ success: true, data: response });
                })
                .catch(error => {
                    console.error('Background script error handling AI call:', error);
                    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
                });
            return true; // Indicate asynchronous response
        } else if (message.type === 'SET_PAUSE_STATE') {
            const newPauseState = (message as { type: string, paused: boolean }).paused;
            chrome.storage.local.set({ extensionPaused: newPauseState }, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true });
                }
            });
            return true; // Indicate asynchronous response
        }
        // Optional: Handle other message types or return false/undefined
    });
}

// --- AI Call Handler ---
async function handleAICall(params: AIRequestParams): Promise<AIResponse> {
    const startTime = performance.now();
    let responseText = '';
    // Removed cost variable
    let modelExecutionTimeMs: number | undefined = undefined; // Time measured by this handler

    try {
        // 1. Construct Final Prompt
        let finalPrompt = params.basePrompt;
        if (params.step === 1 && params.pageMarkdown) {
            finalPrompt = `Page Content (Markdown):\n\`\`\`markdown\n${params.pageMarkdown}\n\`\`\`\n\nInstructions:\n${params.basePrompt}`;
        } else if (params.step === 2 && params.identifiedProductJson) {
            finalPrompt = params.basePrompt.replace('[IDENTIFIED_PRODUCT_JSON]', params.identifiedProductJson);
        } else if (params.step === 1 && !params.pageMarkdown) {
             throw new Error("Page markdown is required for Step 1.");
        } else if (params.step === 2 && !params.identifiedProductJson) {
             throw new Error("Identified product JSON is required for Step 2.");
        }


        // 2. Route to appropriate API based on modelName
        const modelName: ModelName = params.modelName;

        // --- Gemini Models ---
        if (modelName.startsWith('gemini')) {
            if (!genAI) throw new Error("Gemini AI client not initialized (API key missing?).");

            let geminiModelId = 'gemini-1.5-flash-latest'; // Default
            let groundingEnabled = false;
            // TODO: Refine model mapping and grounding logic
            // Simplified mapping for allowed Gemini models
            if (modelName === 'gemini-flash-2.0') {
                geminiModelId = 'gemini-1.5-flash-latest';
            } else if (modelName === 'gemini-flash-2.0-grounded') {
                geminiModelId = 'gemini-1.5-flash-latest'; // Still use flash, grounding needs API params
                groundingEnabled = true;
                console.warn("Gemini grounding via Google Search not yet implemented in background script.");
                // TODO: Implement grounding parameters if API supports it
            }
            // No need for 'else' as type checking ensures it's one of the allowed gemini models if startsWith('gemini')

            const model = genAI.getGenerativeModel({
                 model: geminiModelId,
                 // Removed safetySettings
                 // generationConfig: { // Optional: configure temp, topP, etc.
                 //   temperature: 0.7,
                 // }
                });

            const apiStartTime = performance.now();
            const result = await model.generateContent(finalPrompt);
            const response = await result.response;
            const apiEndTime = performance.now();
            modelExecutionTimeMs = Math.round(apiEndTime - apiStartTime);

            responseText = response.text();
            // TODO: Extract token usage from 'result' or 'response' if available for cost calculation
            // Removed cost calculation comment

        // --- OpenAI Models ---
        } else if (modelName.startsWith('openai')) {
            if (!openai) throw new Error("OpenAI client not initialized (API key missing?).");
            // Using openai.responses.create with web_search_preview tool
            // Note: The model 'gpt-4o-mini' is hardcoded here as per the example.
            // The 'openaiModelId' variable derived from modelName is currently unused.
            if (modelName !== 'openai-gpt-o3-mini') {
                 // Defensively check if the requested model is the one we are implementing for
                 throw new Error(`Unsupported OpenAI model name for responses.create: ${modelName}`);
            }

            console.log("Using openai.responses.create with web_search_preview tool for prompt:", finalPrompt);
            const apiStartTime = performance.now();
            const completion = await openai.responses.create({
                model: "gpt-4o-mini", // Using the model specified in the example
                input: finalPrompt, // Using the dynamically constructed prompt
                tools: [{ type: "web_search_preview_2025_03_11" }],
                tool_choice: {type: "web_search_preview"}
            });
            const apiEndTime = performance.now();
            modelExecutionTimeMs = Math.round(apiEndTime - apiStartTime);

            // Process the output array from responses.create based on the example structure
            if (completion.output && Array.isArray(completion.output)) {
                // Find the message object within the output array
                const messageItem = completion.output.find(item => typeof item === 'object' && item !== null && item.type === 'message');

                if (messageItem && messageItem.content && Array.isArray(messageItem.content)) {
                    // Find the output_text object within the message's content array
                    const textItem = messageItem.content.find(contentItem => typeof contentItem === 'object' && contentItem !== null && contentItem.type === 'output_text');

                    if (textItem && typeof textItem.text === 'string') {
                        responseText = textItem.text;
                        console.log("Received and processed response from openai.responses.create:", responseText);
                    } else {
                        console.warn("Could not find 'output_text' item or 'text' property within the message content.");
                        responseText = "[Could not extract text from OpenAI responses.create output]";
                    }
                } else {
                    console.warn("Could not find 'message' item or 'content' array within the output.");
                    responseText = "[Could not find message content in OpenAI responses.create output]";
                }
            } else {
                 console.warn("No output array received or output is not an array from openai.responses.create");
                 responseText = "[No valid output array received from OpenAI responses.create]";
            }

            // TODO: Determine how to extract token usage from 'completion' object for responses.create
            // Removed cost calculation comment

        // Removed DeepSeek handling block

        } else {
            throw new Error(`Unsupported model name: ${modelName}`);
        }

    } catch (error) {
        console.error('Error during AI call in background:', error);
        // Re-throw to be caught by the message listener's catch block
        throw error;
    }

    const endTime = performance.now();
    const totalTimeMs = Math.round(endTime - startTime); // Total time including logic

    // Removed cost estimation section

    return {
        data: responseText,
        timeMs: modelExecutionTimeMs ?? totalTimeMs, // Prefer model execution time if available
        // Removed cost fields from return object
    };
}

// Removed placeholder cost calculation functions

console.log("Ethical Shopper Background Script Loaded"); // Log successful load
