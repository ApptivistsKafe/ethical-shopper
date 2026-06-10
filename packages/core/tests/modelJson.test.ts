import { describe, it, expect } from 'vitest'
import { extractJsonObject } from '../src/modelJson.js'

describe('extractJsonObject', () => {
  it('parses clean JSON directly', () => {
    expect(extractJsonObject('{"a": 1}')).toEqual({ a: 1 })
  })

  it('parses JSON with surrounding whitespace', () => {
    expect(extractJsonObject('  \n {"a": 1} \n ')).toEqual({ a: 1 })
  })

  it('parses JSON inside ```json fences', () => {
    const raw = '```json\n{"categories": []}\n```'
    expect(extractJsonObject(raw)).toEqual({ categories: [] })
  })

  it('parses JSON inside bare ``` fences', () => {
    const raw = '```\n{"a": true}\n```'
    expect(extractJsonObject(raw)).toEqual({ a: true })
  })

  it('parses JSON preceded by a leading sentence', () => {
    const raw = 'Here is the requested analysis:\n\n{"score": "Good"}'
    expect(extractJsonObject(raw)).toEqual({ score: 'Good' })
  })

  it('parses fenced JSON preceded by prose', () => {
    const raw =
      'Sure! Here you go:\n```json\n{"items": [1, 2]}\n```\nLet me know if you need anything else.'
    expect(extractJsonObject(raw)).toEqual({ items: [1, 2] })
  })

  it('handles nested objects when scanning for balance', () => {
    const raw = 'prefix {"outer": {"inner": {"deep": 1}}} suffix'
    expect(extractJsonObject(raw)).toEqual({ outer: { inner: { deep: 1 } } })
  })

  it('ignores braces inside JSON strings', () => {
    const raw = 'text {"blurb": "uses { and } in prose", "n": 2} more'
    expect(extractJsonObject(raw)).toEqual({ blurb: 'uses { and } in prose', n: 2 })
  })

  it('handles escaped quotes inside strings', () => {
    const raw = 'note: {"quote": "she said \\"hello\\""}'
    expect(extractJsonObject(raw)).toEqual({ quote: 'she said "hello"' })
  })

  it('throws SyntaxError when no JSON object is present', () => {
    expect(() => extractJsonObject('no json here at all')).toThrow(SyntaxError)
  })

  it('throws on empty input', () => {
    expect(() => extractJsonObject('')).toThrow(SyntaxError)
  })
})
