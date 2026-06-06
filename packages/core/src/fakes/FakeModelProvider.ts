import type { ModelProvider, ModelMessage, ModelOptions, ModelResponse } from '../interfaces.js'

export type FakeResponse = string | Error | (() => string | Error)

/**
 * Deterministic ModelProvider for tests.
 *
 * Usage:
 *   const fake = new FakeModelProvider()
 *   fake.enqueue('{"categories": [...]}')  // next call returns this
 *   fake.enqueue(new Error('timeout'))      // next call throws this
 *
 * If the queue is empty, throws to catch unexpected calls.
 */
export class FakeModelProvider implements ModelProvider {
  private queue: FakeResponse[] = []
  public calls: Array<{ messages: ModelMessage[]; options?: ModelOptions }> = []

  enqueue(response: FakeResponse): this {
    this.queue.push(response)
    return this
  }

  enqueueMany(responses: FakeResponse[]): this {
    this.queue.push(...responses)
    return this
  }

  async complete(messages: ModelMessage[], options?: ModelOptions): Promise<ModelResponse> {
    this.calls.push({ messages, options })

    if (this.queue.length === 0) {
      throw new Error(
        'FakeModelProvider: queue exhausted — did you enqueue enough responses for this test?',
      )
    }

    const next = this.queue.shift()!
    const resolved = typeof next === 'function' ? next() : next

    if (resolved instanceof Error) throw resolved

    return {
      content: resolved,
      modelUsed: 'fake-model',
      promptTokens: 100,
      completionTokens: 50,
    }
  }

  get callCount(): number {
    return this.calls.length
  }

  reset(): void {
    this.queue = []
    this.calls = []
  }
}
