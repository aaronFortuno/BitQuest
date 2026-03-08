// Educational Cryptographic Engine for BitQuest
// Mini-Hash (24-bit) + Simplified RSA with small primes
// All steps are traceable for educational transparency

// ============ Mini-Hash (24-bit → 6 hex chars) ============
// Inspired by SHA-256 but drastically simplified for education

export const HASH_K = [0x428A2F, 0x713748, 0xB5C0FB, 0xE9B5DB, 0x3956C2, 0x59F111, 0x923F82, 0xAB1C5E];
export const HASH_INIT = 0x6A09E6; // Initial state (like H0 in SHA-256)
const K = HASH_K;
const INIT = HASH_INIT;
const MASK = 0xFFFFFF; // 24 bits

function rotateLeft24(val: number, bits: number): number {
  return ((val << bits) | (val >>> (24 - bits))) & MASK;
}

export interface HashStep {
  round: number;
  charCode: number;
  char: string;
  mix: number;
  rotate: number;
  addK: number;
}

export function miniHash(message: string): { hash: string; steps: HashStep[] } {
  let H = INIT;
  const steps: HashStep[] = [];

  for (let i = 0; i < message.length; i++) {
    const c = message.charCodeAt(i);
    const k = K[i % K.length];

    const mixed = (H ^ (c * 0x1F3D)) & MASK;
    const rotated = rotateLeft24(mixed, 7);
    H = (rotated + k) & MASK;

    steps.push({
      round: i + 1,
      charCode: c,
      char: message[i],
      mix: mixed,
      rotate: rotated,
      addK: H,
    });
  }

  return {
    hash: H.toString(16).toUpperCase().padStart(6, '0'),
    steps,
  };
}

// ============ RSA with small primes ============

// Pool of tiny primes (1-2 digits, for educational intro)
export const TINY_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];

// Pool of small primes (100-999 range for readable key sizes)
export const SMALL_PRIMES = [
  101, 103, 107, 109, 113, 127, 131, 137, 139, 149,
  151, 157, 163, 167, 173, 179, 181, 191, 193, 197,
  199, 211, 223, 227, 229, 233, 239, 241, 251, 257,
  263, 269, 271, 277, 281, 283, 293, 307, 311, 313,
  317, 331, 337, 347, 349, 353, 359, 367, 373, 379,
  383, 389, 397, 401, 409, 419, 421, 431, 433, 439,
  443, 449, 457, 461, 463, 467, 479, 487, 491, 499,
  503, 509, 521, 523, 541, 547, 557, 563, 569, 571,
  577, 587, 593, 599, 601, 607, 613, 617, 619, 631,
  641, 643, 647, 653, 659, 661, 673, 677, 683, 691,
  701, 709, 719, 727, 733, 739, 743, 751, 757, 761,
  769, 773, 787, 797, 809, 811, 821, 823, 827, 829,
  839, 853, 857, 859, 863, 877, 881, 883, 887, 907,
  911, 919, 929, 937, 941, 947, 953, 967, 971, 977,
  983, 991, 997,
];

export interface RSAKeyPair {
  publicKey: { e: number; n: number };
  privateKey: { d: number; p: number; q: number; phi: number };
}

export interface KeyGenSteps {
  p: number;
  q: number;
  n: number;
  phi: number;
  e: number;
  d: number;
}

// Extended GCD to find modular inverse
function extendedGcd(a: number, b: number): { gcd: number; x: number; y: number } {
  if (a === 0) return { gcd: b, x: 0, y: 1 };
  const result = extendedGcd(b % a, a);
  return {
    gcd: result.gcd,
    x: result.y - Math.floor(b / a) * result.x,
    y: result.x,
  };
}

export function modInverse(e: number, phi: number): number | null {
  const result = extendedGcd(e % phi, phi);
  if (result.gcd !== 1) return null;
  return ((result.x % phi) + phi) % phi;
}

export function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

// Generate a random prime in a given range [min, max]
export function randomPrimeInRange(min: number, max: number): number {
  // Try random candidates until we find a prime
  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidate = min + Math.floor(Math.random() * (max - min + 1));
    if (isPrime(candidate)) return candidate;
  }
  // Fallback: linear search from a random start
  const start = min + Math.floor(Math.random() * (max - min + 1));
  for (let n = start; n <= max; n++) {
    if (isPrime(n)) return n;
  }
  for (let n = start - 1; n >= min; n--) {
    if (isPrime(n)) return n;
  }
  return 97; // absolute fallback
}

export function findPublicExponent(phi: number): number | null {
  const candidates = [17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
  for (const candidate of candidates) {
    if (candidate < phi && gcd(candidate, phi) === 1) {
      return candidate;
    }
  }
  return null;
}

export function findAllPublicExponents(phi: number): number[] {
  const candidates = [17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
  return candidates.filter(c => c < phi && gcd(c, phi) === 1);
}

export function generateRSAKeyPairFromPrimes(
  p: number,
  q: number
): { keys: RSAKeyPair; steps: KeyGenSteps } | { error: string } {
  if (!isPrime(p)) return { error: `${p} is not prime` };
  if (!isPrime(q)) return { error: `${q} is not prime` };
  if (p === q) return { error: 'p and q must be different' };

  const n = p * q;
  const phi = (p - 1) * (q - 1);
  const e = findPublicExponent(phi);
  if (!e) return { error: 'Could not find public exponent' };
  const d = modInverse(e, phi);
  if (!d) return { error: 'Could not compute private exponent' };

  return {
    keys: { publicKey: { e, n }, privateKey: { d, p, q, phi } },
    steps: { p, q, n, phi, e, d },
  };
}

export function generateRSAKeyPair(): { keys: RSAKeyPair; steps: KeyGenSteps } {
  // Pick two distinct random primes
  let p: number, q: number;
  do {
    p = SMALL_PRIMES[Math.floor(Math.random() * SMALL_PRIMES.length)];
    q = SMALL_PRIMES[Math.floor(Math.random() * SMALL_PRIMES.length)];
  } while (p === q);

  const n = p * q;
  const phi = (p - 1) * (q - 1);

  // Find a small public exponent e coprime with phi
  // Try standard values first, then search
  const candidates = [17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
  let e = 17;
  for (const candidate of candidates) {
    if (candidate < phi && gcd(candidate, phi) === 1) {
      e = candidate;
      break;
    }
  }

  // Compute private exponent d = e^(-1) mod phi
  const d = modInverse(e, phi)!;

  const steps: KeyGenSteps = { p, q, n, phi, e, d };
  const keys: RSAKeyPair = {
    publicKey: { e, n },
    privateKey: { d, p, q, phi },
  };

  return { keys, steps };
}

// Modular exponentiation using BigInt for correctness
export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  return result;
}

export interface SignSteps {
  hashDecimal: number;
  hashMod: number;
  computation: string;
}

export function rsaSign(
  hashHex: string,
  privateKey: { d: number },
  n: number
): { signature: number; steps: SignSteps } {
  const hashDecimal = parseInt(hashHex, 16);
  const hashMod = hashDecimal % n;
  const signature = Number(modPow(BigInt(hashMod), BigInt(privateKey.d), BigInt(n)));

  return {
    signature,
    steps: {
      hashDecimal,
      hashMod,
      computation: `${hashMod}^${privateKey.d} mod ${n} = ${signature}`,
    },
  };
}

export interface VerifySteps {
  recoveredHash: number;
  computation: string;
}

export function rsaVerify(
  signature: number,
  publicKey: { e: number; n: number }
): { recoveredHash: number; steps: VerifySteps } {
  const recoveredHash = Number(modPow(BigInt(signature), BigInt(publicKey.e), BigInt(publicKey.n)));

  return {
    recoveredHash,
    steps: {
      recoveredHash,
      computation: `${signature}^${publicKey.e} mod ${publicKey.n} = ${recoveredHash}`,
    },
  };
}

// Full verification: returns whether a message signature is valid
export function verifySignature(
  message: string,
  signature: number,
  publicKey: { e: number; n: number }
): { isValid: boolean; expectedHash: number; recoveredHash: number } {
  const { hash } = miniHash(message);
  const expectedHash = parseInt(hash, 16) % publicKey.n;
  const { recoveredHash } = rsaVerify(signature, publicKey);
  return {
    isValid: recoveredHash === expectedHash,
    expectedHash,
    recoveredHash,
  };
}

// Parse public key from string format "e:n"
export function parsePublicKey(keyStr: string): { e: number; n: number } | null {
  const parts = keyStr.split(':');
  if (parts.length !== 2) return null;
  const e = parseInt(parts[0], 10);
  const n = parseInt(parts[1], 10);
  if (isNaN(e) || isNaN(n)) return null;
  return { e, n };
}

// Serialize public key to string format "e:n"
export function serializePublicKey(key: { e: number; n: number }): string {
  return `${key.e}:${key.n}`;
}
