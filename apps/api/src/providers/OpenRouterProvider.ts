import type { ModelProvider, ModelMessage, ModelOptions, ModelResponse } from '@ethical-shopper/core'

export interface OpenRouterConfig {
  /** OpenRouter model identifier, e.g. "google/gemini-2.5-flash-lite" */
  model: string
  /** Falls back to OPENROUTER_API_KEY env var. */
  apiKey?: string
  /** Used for OpenRouter HTTP-Referer header. Falls back to SITE_URL env var. */
  siteUrl?: string
  /** Used for X-Title header (shown in OpenRouter usage dashboard). */
  siteName?: string
}

interface OpenRouterChoice {
  message: { content: string }
  finish_reason?: string
}

interface OpenRouterResponse {
  model?: string
  choices: OpenRouterChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
  }
}

/**
 * ModelProvider implementation backed by OpenRouter's OpenAI-compatible API.
 *
 * OpenRouter gives access to 300+ models via a single endpoint. Instantiate
 * once per model role (extraction vs. scoring) with different model names:
 *
 *   const extractionProvider = new OpenRouterProvider({ model: 'google/gemini-2.5-flash-lite' })
 *   const scoringProvider    = new OpenRouterProvider({ model: 'anthropic/claude-sonnet-4-5' })
 */
export class OpenRouterProvider implements ModelProvider {
  private readonly model: string
  private readonly apiKey: string
  private readonly siteUrl: string
  private readonly siteName: string

  constructor(config: OpenRouterConfig) {
    this.model = config.model
    this.apiKey = config.apiKey ?? process.env['OPENROUTER_API_KEY'] ?? ''
    this.siteUrl = config.siteUrl ?? process.env['SITE_URL'] ?? 'https://ethical-shopper.vercel.app'
    this.siteName = config.siteName ?? 'Ethical Shopper'

    if (!this.apiKey) {
      throw new Error('OpenRouterProvider: no API key. Set OPENROUTER_API_KEY env var.')
    }
  }

  async complete(messages: ModelMessage[], options?: ModelOptions): Promise<ModelResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 2048,
    }

    if (options?.jsonMode) {
      body['response_format'] = { type: 'json_object' }
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': this.siteUrl,
        'X-Title': this.siteName,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter ${response.status} for model ${this.model}: ${errorText}`)
    }

    const data = (await response.json()) as OpenRouterResponse
    const choice = data.choices[0]

    if (!choice) {
      throw new Error(`OpenRouter returned no choices for model ${this.model}`)
    }

    return {
      content: choice.message.content,
      modelUsed: data.model ?? this.model,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    }
  }
}
