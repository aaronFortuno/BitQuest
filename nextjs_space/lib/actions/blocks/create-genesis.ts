import { createHash } from 'crypto';
import { store } from '@/lib/store';
import type { ActionResponse } from './mining-utils';

export function createGenesis(body: Record<string, unknown>): ActionResponse {
  const { roomId } = body;
  const state = store.getRoomById(roomId as string)!;
  const room = state.room;

  const blocks = store.getBlocksByRoom(roomId as string);

  if (blocks.length > 0) {
    return {
      status: 400,
      body: { error: 'Blocks already exist in this room', code: 'BLOCKS_EXIST' }
    };
  }

  // Auto-calculate initial difficulty based on connected students
  const activeStudents = state.participants
    ? Array.from(state.participants.values()).filter(p => p.isActive && p.role === 'student').length
    : 0;

  let calculatedDifficulty = 2;
  let initialMiningTarget = 4096; // ~d1 equivalent

  if (room.currentPhase >= 7) {
    // Phase 7+: Target-based difficulty
    const estimatedHashrate = Math.max(activeStudents, 1) * 4;
    const targetSeconds = room.targetBlockTime || 15;
    initialMiningTarget = Math.round(65536 / (estimatedHashrate * targetSeconds));
    initialMiningTarget = Math.max(1, Math.min(65535, initialMiningTarget));
    store.updateRoom(roomId as string, { miningTarget: initialMiningTarget, currentDifficulty: calculatedDifficulty });
  } else {
    // Phase 6: Leading zeros difficulty
    const clicksPerSecond = 2;
    const targetSeconds = 30;
    const optimalAttempts = targetSeconds * Math.max(activeStudents, 1) * clicksPerSecond;
    calculatedDifficulty = Math.max(1, Math.min(4,
      Math.round(Math.log(optimalAttempts) / Math.log(16))
    ));
    store.updateRoom(roomId as string, { currentDifficulty: calculatedDifficulty });
  }

  const genesisHash = createHash('sha256')
    .update('1:0000000000000000:[]:0')
    .digest('hex');

  const genesisBlock = store.createBlock(roomId as string, {
    blockNumber: 1,
    previousHash: '0000000000000000',
    status: 'mined',
    difficulty: calculatedDifficulty,
    miningTarget: initialMiningTarget,
    reward: 0,
    transactions: '[]',
    selectedTxIds: [],
    totalFees: 0,
    nonce: 0,
    hash: genesisHash,
    minedAt: new Date(),
  });

  return {
    status: 200,
    body: {
      success: true,
      block: {
        ...genesisBlock,
        transactions: [],
        selectedTxIds: [],
        totalFees: 0,
        miner: null
      }
    }
  };
}
