import { store } from '@/lib/store';
import type { ActionResponse } from './mining-utils';

export function reset(body: Record<string, unknown>): ActionResponse {
  const { roomId } = body;
  const state = store.getRoomById(roomId as string)!;

  store.deleteBlocksByRoom(roomId as string);
  store.deleteAllMiningPools(roomId as string);

  // Reset all participant mining stats
  for (const p of state.participants.values()) {
    p.blocksMinedCount = 0;
    p.totalMiningReward = 0;
    p.hashAttempts = 0;
  }

  // Reset room economic state
  store.updateRoom(roomId as string, {
    currentBlockReward: 50,
    totalBtcEmitted: 0,
    currentDifficulty: 2,
    miningTarget: 4096,
  });

  // Reset mempool transactions to in_mempool status
  for (const tx of state.mempoolTransactions.values()) {
    if (tx.status === 'confirmed') {
      tx.status = 'in_mempool';
    }
  }

  return {
    status: 200,
    body: { success: true, message: 'Blockchain reset' }
  };
}
