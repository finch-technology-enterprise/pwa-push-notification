import { describe, it, expect, beforeAll } from 'vitest'
import { hashPassword, generateId, generateSequenceId, nowUnix, parseTags, parseActions } from '../middleware'
import { TOPIC_REGEX, DISALLOWED_TOPICS_DEFAULT } from '../types'

describe('hashPassword & verifyPassword', () => {
  it('should hash a password and verify it', async () => {
    const password = 'test-password-123!'
    const hash = await hashPassword(password)
    expect(hash).toBeTruthy()
    expect(hash.startsWith('scrypt$')).toBe(true)

    const parts = hash.split('$')
    expect(parts.length).toBe(4)
    expect(parts[0]!).toBe('scrypt')
    expect(() => atob(parts[1]!)).not.toThrow()
    expect(() => atob(parts[2]!)).not.toThrow()
    expect(() => atob(parts[3]!)).not.toThrow()
  })

  it('should produce different hashes for same password', async () => {
    const password = 'same-password'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    expect(hash1).not.toBe(hash2)
  })
})

describe('generateId', () => {
  it('should generate an ID of default length', () => {
    const id = generateId()
    expect(id.length).toBe(12)
  })

  it('should generate an ID of custom length', () => {
    const id = generateId(20)
    expect(id.length).toBe(20)
  })

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })

  it('should only contain alphanumeric characters', () => {
    const id = generateId()
    expect(id).toMatch(/^[0-9a-zA-Z]+$/)
  })
})

describe('generateSequenceId', () => {
  it('should generate a string', () => {
    const id = generateSequenceId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('should generate unique sequence IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSequenceId()))
    expect(ids.size).toBe(100)
  })
})

describe('nowUnix', () => {
  it('should return current unix timestamp', () => {
    const now = nowUnix()
    const expected = Math.floor(Date.now() / 1000)
    expect(Math.abs(now - expected)).toBeLessThan(2)
  })
})

describe('parseTags', () => {
  it('should parse comma-separated tags', () => {
    expect(parseTags('tag1,tag2,tag3')).toEqual(['tag1', 'tag2', 'tag3'])
  })

  it('should handle empty string', () => {
    expect(parseTags('')).toEqual([])
  })

  it('should trim whitespace', () => {
    expect(parseTags(' tag1 , tag2 ')).toEqual(['tag1', 'tag2'])
  })

  it('should filter empty entries', () => {
    expect(parseTags('tag1,,tag2')).toEqual(['tag1', 'tag2'])
  })
})

describe('parseActions', () => {
  it('should parse valid actions JSON', () => {
    const actions = JSON.stringify([
      { action: 'view', label: 'Open', url: 'https://example.com' },
    ])
    const result = parseActions(actions)
    expect(JSON.parse(result)).toHaveLength(1)
  })

  it('should return empty array for empty input', () => {
    expect(parseActions('')).toBe('[]')
    expect(parseActions('[]')).toBe('[]')
  })

  it('should return empty array for invalid JSON', () => {
    expect(parseActions('not-json')).toBe('[]')
  })

  it('should return empty array for non-array JSON', () => {
    expect(parseActions('{"action": "view"}')).toBe('[]')
  })
})

describe('TOPIC_REGEX', () => {
  it('should match valid topic names', () => {
    expect(TOPIC_REGEX.test('mytopic')).toBe(true)
    expect(TOPIC_REGEX.test('my-topic_123')).toBe(true)
    expect(TOPIC_REGEX.test('A')).toBe(true)
  })

  it('should reject invalid topic names', () => {
    expect(TOPIC_REGEX.test('')).toBe(false)
    expect(TOPIC_REGEX.test('topic with spaces')).toBe(false)
    expect(TOPIC_REGEX.test('topic!')).toBe(false)
    expect(TOPIC_REGEX.test('topic@name')).toBe(false)
  })

  it('should reject topics exceeding 64 characters', () => {
    const longTopic = 'a'.repeat(65)
    expect(TOPIC_REGEX.test(longTopic)).toBe(false)
  })

  it('should accept topics up to 64 characters', () => {
    const topic = 'a'.repeat(64)
    expect(TOPIC_REGEX.test(topic)).toBe(true)
  })
})

describe('DISALLOWED_TOPICS_DEFAULT', () => {
  it('should contain system topic names', () => {
    expect(DISALLOWED_TOPICS_DEFAULT).toContain('docs')
    expect(DISALLOWED_TOPICS_DEFAULT).toContain('static')
    expect(DISALLOWED_TOPICS_DEFAULT).toContain('v1')
    expect(DISALLOWED_TOPICS_DEFAULT).toContain('account')
  })
})
