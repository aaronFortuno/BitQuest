import { describe, it, expect } from 'vitest'
import {
  generateRoomCode,
  formatRoomCode,
  validateRoomCode,
  createInitialCoinFile,
} from './room-utils'

describe('generateRoomCode', () => {
  it('returns code in XXX-XXX format', () => {
    const code = generateRoomCode()
    expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/)
  })

  it('generates different codes', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('formatRoomCode', () => {
  it('formats 6-char input with dash', () => {
    expect(formatRoomCode('ABCDEF')).toBe('ABC-DEF')
  })

  it('handles lowercase', () => {
    expect(formatRoomCode('abcdef')).toBe('ABC-DEF')
  })

  it('strips non-alphanumeric characters', () => {
    expect(formatRoomCode('A-B-C-D-E-F')).toBe('ABC-DEF')
  })

  it('handles short input', () => {
    expect(formatRoomCode('AB')).toBe('AB')
    expect(formatRoomCode('ABC')).toBe('ABC')
  })
})

describe('validateRoomCode', () => {
  it('accepts valid codes', () => {
    expect(validateRoomCode('ABC-123')).toBe(true)
    expect(validateRoomCode('XYZ-789')).toBe(true)
  })

  it('rejects invalid formats', () => {
    expect(validateRoomCode('ABCDEF')).toBe(false)
    expect(validateRoomCode('AB-CDEF')).toBe(false)
    expect(validateRoomCode('')).toBe(false)
    expect(validateRoomCode('ABC-12')).toBe(false)
  })

  it('is case insensitive', () => {
    expect(validateRoomCode('abc-def')).toBe(true)
  })
})

describe('createInitialCoinFile', () => {
  it('creates valid JSON with owner and balance 10', () => {
    const result = createInitialCoinFile('Alice')
    const parsed = JSON.parse(result)
    expect(parsed.propietari).toBe('Alice')
    expect(parsed.saldo).toBe(10)
  })
})
