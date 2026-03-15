import { store } from '@/lib/store';
import { generateBlockTransactions } from './mining-utils';
import type { ActionResponse } from './mining-utils';

export function createPending(body: Record<string, unknown>): ActionResponse {
  const { roomId } = body;
  const state = store.getRoomById(roomId as string)!;
  const room = state.room;

  const blocks = store.getBlocksByRoom(roomId as string);
  const existingPending = blocks.find(b => b.status === 'pending');

  if (existingPending) {
    return {
      status: 200,
      body: {
        message: 'Pending block already exists',
        block: {
          ...existingPending,
          transactionsRaw: existingPending.transactions,
          transactions: JSON.parse(existingPending.transactions || '[]'),
          selectedTxIds: existingPending.selectedTxIds || [],
          totalFees: existingPending.totalFees || 0
        }
      }
    };
  }

  const lastBlock = blocks
    .filter(b => b.status === 'mined')
    .sort((a, b) => b.blockNumber - a.blockNumber)[0] || null;

  const newBlockNumber = (lastBlock?.blockNumber ?? 0) + 1;
  const previousHash = lastBlock?.hash || '0000000000000000';

  const participants = store.getParticipantsByRoom(roomId as string)
    .filter(p => p.isActive)
    .map(p => ({ id: p.id, name: p.name }));

  const transactions = generateBlockTransactions(participants);
  const currentReward = Math.floor(room.currentBlockReward);

  const newBlock = store.createBlock(roomId as string, {
    blockNumber: newBlockNumber,
    previousHash,
    status: 'pending',
    difficulty: room.currentDifficulty,
    miningTarget: room.miningTarget,
    reward: currentReward,
    transactions,
    selectedTxIds: [],
    totalFees: 0,
  });

  return {
    status: 200,
    body: {
      ...newBlock,
      transactionsRaw: newBlock.transactions,
      transactions: JSON.parse(newBlock.transactions),
      selectedTxIds: [],
      totalFees: 0
    }
  };
}
