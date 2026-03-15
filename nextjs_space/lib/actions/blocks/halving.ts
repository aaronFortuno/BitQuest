import { store } from '@/lib/store';
import type { ActionResponse } from './mining-utils';

export function forceHalving(body: Record<string, unknown>): ActionResponse {
  const { roomId } = body;
  const state = store.getRoomById(roomId as string)!;
  const room = state.room;

  const currentReward = room.currentBlockReward;
  const newReward = currentReward / 2;

  if (newReward < 0.01) {
    return { status: 400, body: { error: 'Reward already at minimum' } };
  }

  store.updateRoom(roomId as string, { currentBlockReward: newReward });

  // Update pending block reward if exists
  const blocks = store.getBlocksByRoom(roomId as string);
  const pendingBlock = blocks.find(b => b.status === 'pending');

  if (pendingBlock) {
    store.updateBlock(pendingBlock.id, { reward: Math.floor(newReward) });
  }

  return {
    status: 200,
    body: {
      success: true,
      previousReward: currentReward,
      newReward,
      message: `Halving forced! Reward reduced from ${currentReward} to ${newReward} BTC`
    }
  };
}

export function updateHalvingSettings(body: Record<string, unknown>): ActionResponse {
  const { roomId, halvingInterval, blockReward } = body;

  const updates: { halvingInterval?: number; currentBlockReward?: number } = {};

  if (halvingInterval !== undefined) {
    if ((halvingInterval as number) < 5 || (halvingInterval as number) > 100) {
      return {
        status: 400,
        body: { error: 'Invalid halving interval. Must be between 5 and 100 blocks' }
      };
    }
    updates.halvingInterval = halvingInterval as number;
  }

  if (blockReward !== undefined) {
    if ((blockReward as number) < 0.01 || (blockReward as number) > 100) {
      return {
        status: 400,
        body: { error: 'Invalid block reward. Must be between 0.01 and 100 BTC' }
      };
    }
    updates.currentBlockReward = blockReward as number;
  }

  if (Object.keys(updates).length === 0) {
    return { status: 400, body: { error: 'No valid settings to update' } };
  }

  store.updateRoom(roomId as string, updates);
  const updatedRoom = store.getRoomById(roomId as string)!.room;

  // Update pending block reward if blockReward was changed
  if (blockReward !== undefined) {
    const blocks = store.getBlocksByRoom(roomId as string);
    const pendingBlock = blocks.find(b => b.status === 'pending');

    if (pendingBlock) {
      store.updateBlock(pendingBlock.id, { reward: Math.floor(blockReward as number) });
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      settings: {
        halvingInterval: updatedRoom.halvingInterval,
        currentBlockReward: updatedRoom.currentBlockReward,
        totalBtcEmitted: updatedRoom.totalBtcEmitted,
      }
    }
  };
}
