import { createHash } from 'crypto';

// Simulated max BTC (scaled down for classroom)
export const MAX_BTC_SUPPLY = 2100;

// SHA-256 hash function
export function calculateHashFn(blockContent: string, nonce: number): string {
  const data = `${blockContent}:${nonce}`;
  return createHash('sha256').update(data).digest('hex');
}

// Phase 6: Check if hash meets difficulty requirement (leading zeros)
export function isValidHash(hash: string, difficulty: number): boolean {
  const target = '0'.repeat(difficulty);
  return hash.startsWith(target);
}

// Phase 7+: Target-based difficulty check (first 4 hex chars < target)
export function isValidHashTarget(hash: string, miningTarget: number): boolean {
  const hashPrefix = parseInt(hash.substring(0, 4), 16);
  return hashPrefix < miningTarget;
}

// Calculate halving info
export function getHalvingInfo(blockNumber: number, halvingInterval: number, currentBlockReward: number, totalBtcEmitted: number) {
  const halvingNumber = Math.floor((blockNumber - 1) / halvingInterval);
  const blocksUntilNextHalving = halvingInterval - ((blockNumber - 1) % halvingInterval);
  const nextReward = currentBlockReward / 2;

  return {
    currentBlockReward,
    halvingInterval,
    blocksUntilNextHalving,
    halvingNumber,
    nextReward: nextReward >= 0.01 ? nextReward : 0,
    totalBtcEmitted,
    maxBtc: MAX_BTC_SUPPLY
  };
}

// Generate random transactions for a block (Phase 6 only, without fees)
export function generateBlockTransactions(participants: { id: string; name: string }[]): string {
  const students = participants.filter(p => p.name !== 'Professor');
  if (students.length < 2) {
    return JSON.stringify([]);
  }

  const numTx = Math.min(3 + Math.floor(Math.random() * 3), Math.floor(students.length / 2) + 1);
  const transactions = [];

  for (let i = 0; i < numTx; i++) {
    const senderIdx = Math.floor(Math.random() * students.length);
    let receiverIdx = Math.floor(Math.random() * students.length);
    while (receiverIdx === senderIdx && students.length > 1) {
      receiverIdx = Math.floor(Math.random() * students.length);
    }

    transactions.push({
      sender: students[senderIdx].name,
      receiver: students[receiverIdx].name,
      amount: Math.floor(Math.random() * 10) + 1
    });
  }

  return JSON.stringify(transactions);
}

// Phase 6: Calculate difficulty adjustment (integer leading zeros)
export function calculateDifficultyAdjustment(
  avgTimePerBlock: number,
  targetTimePerBlock: number,
  currentDifficulty: number
): { newDifficulty: number; adjustmentResult: 'increased' | 'decreased' | 'stable' } {
  const ratio = avgTimePerBlock / targetTimePerBlock;

  if (ratio >= 0.8 && ratio <= 1.2) {
    return { newDifficulty: currentDifficulty, adjustmentResult: 'stable' };
  }

  if (ratio < 0.8) {
    const newDifficulty = Math.min(currentDifficulty + 1, 5);
    return {
      newDifficulty,
      adjustmentResult: newDifficulty > currentDifficulty ? 'increased' : 'stable'
    };
  } else {
    const newDifficulty = Math.max(currentDifficulty - 1, 1);
    return {
      newDifficulty,
      adjustmentResult: newDifficulty < currentDifficulty ? 'decreased' : 'stable'
    };
  }
}

// Phase 7+: Target-based difficulty adjustment (granular, ratio-based like real Bitcoin)
export function calculateTargetAdjustment(
  avgTimePerBlock: number,
  targetTimePerBlock: number,
  currentTarget: number
): { newTarget: number; adjustmentResult: 'increased' | 'decreased' | 'stable' } {
  const ratio = avgTimePerBlock / targetTimePerBlock;

  if (ratio >= 0.85 && ratio <= 1.15) {
    return { newTarget: currentTarget, adjustmentResult: 'stable' };
  }

  // New target = current * ratio (if blocks are slow, target goes up = easier)
  // Clamp adjustment to 4x max change per period
  const clampedRatio = Math.max(0.25, Math.min(4, ratio));
  const newTarget = Math.round(currentTarget * clampedRatio);
  const clamped = Math.max(1, Math.min(65535, newTarget));

  if (clamped < currentTarget) {
    return { newTarget: clamped, adjustmentResult: 'increased' }; // harder
  } else if (clamped > currentTarget) {
    return { newTarget: clamped, adjustmentResult: 'decreased' }; // easier
  }
  return { newTarget: clamped, adjustmentResult: 'stable' };
}

// Get period info for a given block number
export function getPeriodInfo(blockNumber: number, adjustmentInterval: number) {
  const periodNumber = Math.floor((blockNumber - 1) / adjustmentInterval) + 1;
  const startBlock = (periodNumber - 1) * adjustmentInterval + 1;
  const endBlock = periodNumber * adjustmentInterval;
  const positionInPeriod = ((blockNumber - 1) % adjustmentInterval) + 1;

  return { periodNumber, startBlock, endBlock, positionInPeriod };
}

// Response type for all action handlers
export interface ActionResponse {
  status: number;
  body: Record<string, unknown>;
}
