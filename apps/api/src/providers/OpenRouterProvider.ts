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
  /**
   * Per-attempt timeout in ms. A hung upstream call must not eat the whole
   * serverless time budget. Default 20s — set lower for fast extraction
   * models, higher for large scoring generations.
   */
  timeoutMs?: number
  /** Retries after a timeout, network error, or 5xx (never after 4xx). Default 1. */
  maxRetries?: number
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
  private readonly timeoutMs: number
  private readonly maxRetries: number

  constructor(config: OpenRouterConfig) {
    this.model = config.model
    this.apiKey = config.apiKey ?? process.env['OPENROUTER_API_KEY'] ?? ''
    this.siteUrl = config.siteUrl ?? process.env['SITE_URL'] ?? 'https://ethical-shopper.vercel.app'
    this.siteName = config.siteName ?? 'Ethical Shopper'
    this.timeoutMs = config.timeoutMs ?? 20_000
    this.maxRetries = config.maxRetries ?? 1

    if (!this.apiKey) {
      throw new Error('OpenRouterProvider: no API key. Set OPENROUTER_API_KEY env var.')
    }
  }

  async complete(messages: ModelMessage[], options?: ModelOptions): Promise<ModelResponse> {
    let lastError: unknown

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.completeOnce(messages, options)
      } catch (err) {
        lastError = err
        if (!isRetryable(err)) throw err
        // retryable: timeout, network error, or 5xx — loop for another attempt
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`OpenRouter failed after retries: ${String(lastError)}`)
  }

  private async completeOnce(
    messages: ModelMessage[],
    options?: ModelOptions,
  ): Promise<ModelResponse> {
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
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      const errorText = await response.text()
      const error = new Error(`OpenRouter ${response.status} for model ${this.model}: ${errorText}`)
      ;(error as Error & { status: number }).status = response.status
      throw error
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

/** Timeouts, network errors, and 5xx responses are retryable; 4xx are not. */
function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    // AbortSignal.timeout fires a DOMException named TimeoutError (AbortError in some runtimes)
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return true
    const status = (err as Error & { status?: number }).status
    if (status !== undefined) return status >= 500
    // No status = network-level failure (fetch TypeError etc.)
    return true
  }
  return false
}
