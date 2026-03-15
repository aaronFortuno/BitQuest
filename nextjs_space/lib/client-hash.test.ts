import { describe, it, expect } from 'vitest'
import {
  sha256Hex,
  calculateBlockHash,
  isHashValidLeadingZeros,
  isHashValidTarget,
  targetToDisplayHex,
  calculateTarget,
} from './client-hash'

describe('sha256Hex', () => {
  it('returns a 64-char lowercase hex string', async () => {
    const hash = await sha256Hex('hello')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', async () => {
    const a = await sha256Hex('test')
    const b = await sha256Hex('test')
    expect(a).toBe(b)
  })

  it('produces known SHA-256 for "hello"', async () => {
    const hash = await sha256Hex('hello')
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })
})

describe('calculateBlockHash', () => {
  it('produces consistent hash for same inputs', async () => {
    const a = await calculateBlockHash(1, '000000', '[]', 42)
    const b = await calculateBlockHash(1, '000000', '[]', 42)
    expect(a).toBe(b)
  })

  it('different nonces produce different hashes', async () => {
    const a = await calculateBlockHash(1, '000000', '[]', 1)
    const b = await calculateBlockHash(1, '000000', '[]', 2)
    expect(a).not.toBe(b)
  })
})

describe('isHashValidLeadingZeros', () => {
  it('accepts hash with enough leading zeros', () => {
    expect(isHashValidLeadingZeros('000abc', 3)).toBe(true)
    expect(isHashValidLeadingZeros('00abcd', 2)).toBe(true)
    expect(isHashValidLeadingZeros('0abcde', 1)).toBe(true)
  })

  it('rejects hash without enough leading zeros', () => {
    expect(isHashValidLeadingZeros('00abcd', 3)).toBe(false)
    expect(isHashValidLeadingZeros('abcdef', 1)).toBe(false)
  })

  it('difficulty 0 accepts any hash', () => {
    expect(isHashValidLeadingZeros('ffffff', 0)).toBe(true)
  })
})

describe('isHashValidTarget', () => {
  it('accepts hash below target', () => {
    // '0000' prefix = 0, which is < any positive target
    expect(isHashValidTarget('0000abcdef', 1)).toBe(true)
  })

  it('rejects hash above target', () => {
    // 'ffff' prefix = 65535
    expect(isHashValidTarget('ffff000000', 100)).toBe(false)
  })
})

describe('targetToDisplayHex', () => {
  it('pads to 4 hex chars', () => {
    expect(targetToDisplayHex(255)).toBe('00FF')
    expect(targetToDisplayHex(4096)).toBe('1000')
  })
})

describe('calculateTarget', () => {
  it('returns fallback for zero hashrate', () => {
    expect(calculateTarget(0, 10)).toBe(4096)
  })

  it('returns fallback for negative hashrate', () => {
    expect(calculateTarget(-1, 10)).toBe(4096)
  })

  it('clamps to valid range', () => {
    // Very low hashrate → high target, clamped to 65535
    expect(calculateTarget(0.001, 1)).toBeLessThanOrEqual(65535)
    // Very high hashrate → low target, clamped to 1
    expect(calculateTarget(1000000, 1)).toBeGreaterThanOrEqual(1)
  })

  it('calculates expected value', () => {
    // target = 65536 / (10 * 10) = 655.36 → 655
    expect(calculateTarget(10, 10)).toBe(Math.round(65536 / 100))
  })
})
