// Block & Mining Pool store operations

import {
  BlockData,
  MiningPoolData,
  rooms,
  genId,
  getRoomStateById,
} from './types';

export const blockStore = {
  // ---- Block ----
  createBlock(roomId: string, data: Partial<BlockData>): BlockData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const block: BlockData = {
      id: genId(),
      blockNumber: data.blockNumber || 0,
      roomId,
      previousHash: data.previousHash || '0000000000000000',
      nonce: data.nonce ?? null,
      hash: data.hash ?? null,
      minerId: data.minerId ?? null,
      reward: data.reward ?? 50,
      difficulty: data.difficulty ?? 2,
      miningTarget: data.miningTarget ?? 256,
      status: data.status || 'pending',
      transactions: data.transactions || '[]',
      hashAttempts: data.hashAttempts || 0,
      selectedTxIds: data.selectedTxIds || [],
      totalFees: data.totalFees || 0,
      poolId: data.poolId ?? null,
      rewardDistribution: data.rewardDistribution ?? null,
      createdAt: new Date(),
      minedAt: data.minedAt || null,
    };
    state.blocks.set(block.id, block);
    return block;
  },

  getBlock(id: string): BlockData | undefined {
    for (const state of rooms.values()) {
      const b = state.blocks.get(id);
      if (b) return b;
    }
    return undefined;
  },

  updateBlock(id: string, data: Partial<BlockData>): BlockData | undefined {
    const block = this.getBlock(id);
    if (!block) return undefined;
    Object.assign(block, data);
    return block;
  },

  getBlocksByRoom(roomId: string): BlockData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.blocks.values());
  },

  deleteBlocksByRoom(roomId: string): void {
    const state = getRoomStateById(roomId);
    if (state) state.blocks.clear();
  },

  // ---- MiningPool ----
  createMiningPool(roomId: string, data: { name: string; creatorId: string; colorHex: string }): MiningPoolData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const pool: MiningPoolData = {
      id: genId(),
      roomId,
      name: data.name,
      creatorId: data.creatorId,
      memberIds: [data.creatorId],
      colorHex: data.colorHex,
      createdAt: new Date(),
    };
    state.miningPools.set(pool.id, pool);
    // Set creator's poolId
    const creator = state.participants.get(data.creatorId);
    if (creator) creator.poolId = pool.id;
    return pool;
  },

  getMiningPool(poolId: string): MiningPoolData | undefined {
    for (const state of rooms.values()) {
      const pool = state.miningPools.get(poolId);
      if (pool) return pool;
    }
    return undefined;
  },

  getMiningPoolsByRoom(roomId: string): MiningPoolData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.miningPools.values());
  },

  joinMiningPool(poolId: string, participantId: string): MiningPoolData | undefined {
    for (const state of rooms.values()) {
      const pool = state.miningPools.get(poolId);
      if (pool) {
        if (!pool.memberIds.includes(participantId)) {
          pool.memberIds.push(participantId);
        }
        const participant = state.participants.get(participantId);
        if (participant) participant.poolId = poolId;
        return pool;
      }
    }
    return undefined;
  },

  leaveMiningPool(poolId: string, participantId: string): boolean {
    for (const state of rooms.values()) {
      const pool = state.miningPools.get(poolId);
      if (pool) {
        pool.memberIds = pool.memberIds.filter(id => id !== participantId);
        const participant = state.participants.get(participantId);
        if (participant) participant.poolId = null;
        // Delete pool if empty
        if (pool.memberIds.length === 0) {
          state.miningPools.delete(poolId);
        }
        return true;
      }
    }
    return false;
  },

  deleteMiningPool(poolId: string): boolean {
    for (const state of rooms.values()) {
      const pool = state.miningPools.get(poolId);
      if (pool) {
        // Reset all members' poolId
        for (const memberId of pool.memberIds) {
          const p = state.participants.get(memberId);
          if (p) p.poolId = null;
        }
        state.miningPools.delete(poolId);
        return true;
      }
    }
    return false;
  },

  deleteAllMiningPools(roomId: string): void {
    const state = getRoomStateById(roomId);
    if (!state) return;
    // Reset all participants' poolId
    for (const p of state.participants.values()) {
      p.poolId = null;
    }
    state.miningPools.clear();
  },
};
