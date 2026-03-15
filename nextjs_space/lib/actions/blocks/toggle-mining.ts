import { store } from '@/lib/store';
import type { ActionResponse } from './mining-utils';

export function toggleMining(body: Record<string, unknown>): ActionResponse {
  const { roomId } = body;

  const blocks = store.getBlocksByRoom(roomId as string);
  const pendingBlock = blocks.find(b => b.status === 'pending' || b.status === 'mining');

  if (!pendingBlock) {
    return { status: 400, body: { error: 'No block to toggle' } };
  }

  const newStatus = pendingBlock.status === 'pending' ? 'mining' : 'pending';
  store.updateBlock(pendingBlock.id, { status: newStatus });

  const updatedBlock = store.getBlock(pendingBlock.id)!;

  return {
    status: 200,
    body: {
      ...updatedBlock,
      transactions: JSON.parse(updatedBlock.transactions)
    }
  };
}
