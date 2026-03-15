import { store } from '@/lib/store';
import { calculateHashFn, isValidHash, isValidHashTarget } from './mining-utils';
import type { ActionResponse } from './mining-utils';

export function calculateHash(body: Record<string, unknown>): ActionResponse {
  const { roomId, minerId, nonce } = body;

  if (nonce === undefined) {
    return { status: 400, body: { error: 'nonce is required' } };
  }

  const state = store.getRoomById(roomId as string)!;
  const room = state.room;

  const blocks = store.getBlocksByRoom(roomId as string);
  const pendingBlock = blocks.find(b => b.status === 'pending');

  if (!pendingBlock) {
    return { status: 400, body: { error: 'No pending block' } };
  }

  // Increment hash attempts
  store.updateBlock(pendingBlock.id, {
    hashAttempts: pendingBlock.hashAttempts + 1,
  });

  // Increment participant's hash attempts
  if (minerId) {
    const miner = store.getParticipant(minerId as string);
    if (miner) {
      store.updateParticipant(minerId as string, {
        hashAttempts: miner.hashAttempts + 1,
      });
    }
  }

  const blockContent = `${pendingBlock.blockNumber}:${pendingBlock.previousHash}:${pendingBlock.transactions}`;
  const calculatedHash = calculateHashFn(blockContent, nonce as number);

  const valid = pendingBlock.miningTarget && room.currentPhase >= 7
    ? isValidHashTarget(calculatedHash, pendingBlock.miningTarget)
    : isValidHash(calculatedHash, pendingBlock.difficulty);

  return {
    status: 200,
    body: {
      hash: calculatedHash,
      hashShort: calculatedHash.substring(0, 8).toUpperCase(),
      isValid: valid,
      difficulty: pendingBlock.difficulty,
      miningTarget: pendingBlock.miningTarget,
      nonce,
      blockNumber: pendingBlock.blockNumber
    }
  };
}
