import { describe, it, expect } from 'vitest'
import {
  miniHash,
  gcd,
  isPrime,
  modInverse,
  findPublicExponent,
  findAllPublicExponents,
  generateRSAKeyPair,
  generateRSAKeyPairFromPrimes,
  modPow,
  rsaSign,
  rsaVerify,
  verifySignature,
  parsePublicKey,
  serializePublicKey,
  HASH_INIT,
  HASH_K,
  SMALL_PRIMES,
  TINY_PRIMES,
} from './crypto'

// ============ miniHash ============

describe('miniHash', () => {
  it('returns a 6-char uppercase hex string', () => {
    const { hash } = miniHash('hello')
    expect(hash).toMatch(/^[0-9A-F]{6}$/)
  })

  it('is deterministic', () => {
    expect(miniHash('bitcoin').hash).toBe(miniHash('bitcoin').hash)
  })

  it('returns steps matching message length', () => {
    const { steps } = miniHash('abc')
    expect(steps).toHaveLength(3)
    expect(steps[0].char).toBe('a')
    expect(steps[1].char).toBe('b')
    expect(steps[2].char).toBe('c')
  })

  it('empty string returns HASH_INIT as hex', () => {
    const { hash, steps } = miniHash('')
    expect(steps).toHaveLength(0)
    expect(hash).toBe(HASH_INIT.toString(16).toUpperCase().padStart(6, '0'))
  })

  it('different messages produce different hashes', () => {
    expect(miniHash('a').hash).not.toBe(miniHash('b').hash)
  })
})

// ============ Math helpers ============

describe('gcd', () => {
  it('computes greatest common divisor', () => {
    expect(gcd(12, 8)).toBe(4)
    expect(gcd(17, 13)).toBe(1)
    expect(gcd(100, 25)).toBe(25)
  })
})

describe('isPrime', () => {
  it('identifies primes correctly', () => {
    expect(isPrime(2)).toBe(true)
    expect(isPrime(3)).toBe(true)
    expect(isPrime(17)).toBe(true)
    expect(isPrime(97)).toBe(true)
    expect(isPrime(997)).toBe(true)
  })

  it('rejects non-primes', () => {
    expect(isPrime(0)).toBe(false)
    expect(isPrime(1)).toBe(false)
    expect(isPrime(4)).toBe(false)
    expect(isPrime(100)).toBe(false)
  })
})

describe('modInverse', () => {
  it('finds modular inverse when it exists', () => {
    const d = modInverse(17, 3120)
    expect(d).not.toBeNull()
    expect((17 * d!) % 3120).toBe(1)
  })

  it('returns null when no inverse exists', () => {
    expect(modInverse(2, 4)).toBeNull()
  })
})

describe('findPublicExponent', () => {
  it('finds e coprime with phi', () => {
    const phi = 100 * 96 // (101-1)*(97-1)
    const e = findPublicExponent(phi)
    expect(e).not.toBeNull()
    expect(gcd(e!, phi)).toBe(1)
  })
})

describe('findAllPublicExponents', () => {
  it('returns all valid candidates', () => {
    const phi = 100 * 96
    const exponents = findAllPublicExponents(phi)
    expect(exponents.length).toBeGreaterThan(0)
    exponents.forEach(e => {
      expect(gcd(e, phi)).toBe(1)
    })
  })
})

// ============ RSA key generation ============

describe('generateRSAKeyPair', () => {
  it('generates valid key pair', () => {
    const { keys, steps } = generateRSAKeyPair()
    expect(keys.publicKey.e).toBeGreaterThan(1)
    expect(keys.publicKey.n).toBeGreaterThan(1)
    expect(keys.privateKey.d).toBeGreaterThan(1)
    expect(steps.n).toBe(steps.p * steps.q)
    expect(steps.phi).toBe((steps.p - 1) * (steps.q - 1))
  })

  it('keys satisfy e*d ≡ 1 (mod phi)', () => {
    const { keys, steps } = generateRSAKeyPair()
    expect((keys.publicKey.e * keys.privateKey.d) % steps.phi).toBe(1)
  })
})

describe('generateRSAKeyPairFromPrimes', () => {
  it('generates keys from given primes', () => {
    const result = generateRSAKeyPairFromPrimes(101, 103)
    expect('keys' in result).toBe(true)
    if ('keys' in result) {
      expect(result.keys.publicKey.n).toBe(101 * 103)
    }
  })

  it('rejects non-prime input', () => {
    const result = generateRSAKeyPairFromPrimes(100, 103)
    expect('error' in result).toBe(true)
  })

  it('rejects equal primes', () => {
    const result = generateRSAKeyPairFromPrimes(101, 101)
    expect('error' in result).toBe(true)
  })
})

// ============ Sign & Verify ============

describe('modPow', () => {
  it('computes modular exponentiation', () => {
    expect(modPow(2n, 10n, 1000n)).toBe(24n)
    expect(modPow(3n, 4n, 5n)).toBe(1n)
  })
})

describe('rsaSign + rsaVerify roundtrip', () => {
  it('sign then verify recovers the original hash mod n', () => {
    const { keys } = generateRSAKeyPair()
    const { hash } = miniHash('test message')
    const { signature } = rsaSign(hash, keys.privateKey, keys.publicKey.n)
    const { recoveredHash } = rsaVerify(signature, keys.publicKey)
    const expectedHash = parseInt(hash, 16) % keys.publicKey.n
    expect(recoveredHash).toBe(expectedHash)
  })
})

describe('verifySignature', () => {
  it('validates correct signature', () => {
    const { keys } = generateRSAKeyPair()
    const message = 'hello bitcoin'
    const { hash } = miniHash(message)
    const { signature } = rsaSign(hash, keys.privateKey, keys.publicKey.n)
    const result = verifySignature(message, signature, keys.publicKey)
    expect(result.isValid).toBe(true)
  })

  it('rejects wrong signature', () => {
    const { keys } = generateRSAKeyPair()
    const result = verifySignature('hello', 99999, keys.publicKey)
    expect(result.isValid).toBe(false)
  })
})

// ============ Key serialization ============

describe('parsePublicKey / serializePublicKey', () => {
  it('roundtrips correctly', () => {
    const key = { e: 17, n: 10403 }
    const serialized = serializePublicKey(key)
    expect(serialized).toBe('17:10403')
    const parsed = parsePublicKey(serialized)
    expect(parsed).toEqual(key)
  })

  it('returns null for invalid input', () => {
    expect(parsePublicKey('invalid')).toBeNull()
    expect(parsePublicKey('a:b')).toBeNull()
  })
})

// ============ Constants sanity ============

describe('constants', () => {
  it('SMALL_PRIMES are all prime', () => {
    SMALL_PRIMES.forEach(p => expect(isPrime(p)).toBe(true))
  })

  it('TINY_PRIMES are all prime', () => {
    TINY_PRIMES.forEach(p => expect(isPrime(p)).toBe(true))
  })

  it('HASH_K has 8 elements', () => {
    expect(HASH_K).toHaveLength(8)
  })
})
