import { store } from '@/lib/store';
import type { ActionResponse } from './mining-utils';

export function selectTransactions(body: Record<string, unknown>): ActionResponse {
  const { roomId, txIds } = body;

  if (!txIds || !Array.isArray(txIds)) {
    return { status: 400, body: { error: 'txIds array is required' } };
  }

  const blocks = store.getBlocksByRoom(roomId as string);
  const pendingBlock = blocks.find(b => b.status === 'pending');

  if (!pendingBlock) {
    return { status: 400, body: { error: 'No pending block' } };
  }

  // Get selected mempool transactions and calculate total fees
  const allMempoolTxs = store.getMempoolTransactionsByRoom(roomId as string);
  const selectedTxs = allMempoolTxs.filter(tx => (txIds as string[]).includes(tx.id));
  const totalFees = selectedTxs.reduce((sum, tx) => sum + tx.fee, 0);

  // Build transactions array from selected mempool txs
  const txSummaries = selectedTxs.map(tx => {
    const sender = store.getParticipant(tx.senderId);
    const receiver = store.getParticipant(tx.receiverId);
    return {
      sender: sender?.name || 'Unknown',
      receiver: receiver?.name || 'Unknown',
      amount: tx.amount,
      fee: tx.fee
    };
  });

  store.updateBlock(pendingBlock.id, {
    selectedTxIds: txIds as string[],
    totalFees,
    transactions: JSON.stringify(txSummaries),
  });

  return {
    status: 200,
    body: {
      ...store.getBlock(pendingBlock.id),
      transactions: txSummaries,
      selectedTxIds: txIds,
      totalFees
    }
  };
}
