/**
 * Client-side SHA-256 using Web Crypto API.
 * Matches the server's: createHash('sha256').update(data).digest('hex')
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate block hash exactly matching server logic.
 * Server does: `${blockNumber}:${previousHash}:${transactions}:${nonce}`
 * where transactions is the raw JSON string.
 */
export async function calculateBlockHash(
  blockNumber: number,
  previousHash: string,
  transactionsRaw: string,
  nonce: number
): Promise<string> {
  const blockContent = `${blockNumber}:${previousHash}:${transactionsRaw}`;
  const data = `${blockContent}:${nonce}`;
  return sha256Hex(data);
}

/**
 * Phase 6: Check if hash meets difficulty (starts with N leading hex zeros).
 */
export function isHashValidLeadingZeros(hash: string, difficulty: number): boolean {
  const target = '0'.repeat(difficulty);
  return hash.startsWith(target);
}

/**
 * Phase 7+: Target-based difficulty check.
 * Compares first 4 hex chars (16-bit) against a numeric target.
 * Lower target = harder. Range: 1 (hardest) to 65535 (easiest).
 *
 * Example targets:
 *   4096 = ~d1 (1/16 chance, first char must be '0')
 *   256  = ~d2 (1/256 chance, first 2 chars must be '00')
 *   16   = ~d3 (1/4096 chance)
 */
export function isHashValidTarget(hash: string, miningTarget: number): boolean {
  const hashPrefix = parseInt(hash.substring(0, 4), 16);
  return hashPrefix < miningTarget;
}

/**
 * Convert a target to an approximate display string.
 * Shows the hex threshold that hashes must be below.
 */
export function targetToDisplayHex(target: number): string {
  return target.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Calculate initial mining target for a given hashrate and desired block time.
 * target = 65536 / (hashrate * blockTime)
 */
export function calculateTarget(totalHashrate: number, targetBlockTimeSeconds: number): number {
  if (totalHashrate <= 0) return 4096; // fallback
  const target = Math.round(65536 / (totalHashrate * targetBlockTimeSeconds));
  return Math.max(1, Math.min(65535, target));
}
