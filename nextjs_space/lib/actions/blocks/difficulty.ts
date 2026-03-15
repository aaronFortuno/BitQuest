import { createHash } from 'crypto';
import { store } from '@/lib/store';
import type { ActionResponse } from './mining-utils';

export function forceAdjustment(body: Record<string, unknown>): ActionResponse {
  const { roomId, newDifficulty } = body;
  const state = store.getRoomById(roomId as string)!;
  const room = state.room;

  if (newDifficulty === undefined || (newDifficulty as number) < 1 || (newDifficulty as number) > 5) {
    return {
      status: 400,
      body: { error: 'Invalid difficulty. Must be between 1 and 5' }
    };
  }

  const previousDifficulty = room.currentDifficulty;
  store.updateRoom(roomId as string, { currentDifficulty: newDifficulty as number });

  // Update pending block difficulty if exists
  const blocks = store.getBlocksByRoom(roomId as string);
  const pendingBlock = blocks.find(b => b.status === 'pending');

  if (pendingBlock) {
    store.updateBlock(pendingBlock.id, { difficulty: newDifficulty as number });
  }

  return {
    status: 200,
    body: {
      success: true,
      previousDifficulty,
      newDifficulty,
      message: `Difficulty changed from ${previousDifficulty} to ${newDifficulty}`
    }
  };
}

export function updateSettings(body: Record<string, unknown>): ActionResponse {
  const { roomId, targetBlockTime, adjustmentInterval } = body;

  const updates: { targetBlockTime?: number; difficultyAdjustmentInterval?: number } = {};

  if (targetBlockTime !== undefined) {
    if ((targetBlockTime as number) < 5 || (targetBlockTime as number) > 120) {
      return {
        status: 400,
        body: { error: 'Invalid target block time. Must be between 5 and 120 seconds' }
      };
    }
    updates.targetBlockTime = targetBlockTime as number;
  }

  if (adjustmentInterval !== undefined) {
    if ((adjustmentInterval as number) < 3 || (adjustmentInterval as number) > 50) {
      return {
        status: 400,
        body: { error: 'Invalid adjustment interval. Must be between 3 and 50 blocks' }
      };
    }
    updates.difficultyAdjustmentInterval = adjustmentInterval as number;
  }

  if (Object.keys(updates).length === 0) {
    return { status: 400, body: { error: 'No valid settings to update' } };
  }

  store.updateRoom(roomId as string, updates);
  const updatedRoom = store.getRoomById(roomId as string)!.room;

  return {
    status: 200,
    body: {
      success: true,
      settings: {
        targetBlockTime: updatedRoom.targetBlockTime,
        difficultyAdjustmentInterval: updatedRoom.difficultyAdjustmentInterval,
        currentDifficulty: updatedRoom.currentDifficulty,
      }
    }
  };
}

export function updateRigSettings(body: Record<string, unknown>): ActionResponse {
  const { participantId, maxRigs, allowUpgrade } = body;

  if (!participantId) {
    return { status: 400, body: { error: 'participantId is required' } };
  }

  const participant = store.getParticipant(participantId as string);
  if (!participant) {
    return { status: 404, body: { error: 'Participant not found' } };
  }

  const updates: Partial<{ maxRigs: number; allowUpgrade: boolean }> = {};

  if (maxRigs !== undefined) {
    if ((maxRigs as number) < 1 || (maxRigs as number) > 3) {
      return { status: 400, body: { error: 'maxRigs must be 1-3' } };
    }
    updates.maxRigs = maxRigs as number;
  }
  if (allowUpgrade !== undefined) {
    updates.allowUpgrade = !!allowUpgrade;
  }

  store.updateParticipant(participantId as string, updates);

  return { status: 200, body: { success: true, participantId, ...updates } };
}

export function batchHashUpdate(body: Record<string, unknown>): ActionResponse {
  const { roomId, minerId, hashCount, activeRigs: rigCount } = body;

  if (!minerId || hashCount === undefined || hashCount === null) {
    return { status: 400, body: { error: 'minerId and hashCount required' } };
  }

  const miner = store.getParticipant(minerId as string);
  if (miner) {
    const pUpdates: Record<string, number> = {};
    if ((hashCount as number) > 0) {
      pUpdates.hashAttempts = miner.hashAttempts + (hashCount as number);
    }
    if (rigCount !== undefined) {
      pUpdates.activeRigs = rigCount as number;
    }
    if (Object.keys(pUpdates).length > 0) {
      store.updateParticipant(minerId as string, pUpdates);
    }
  }

  const blocks = store.getBlocksByRoom(roomId as string);
  const pendingBlock = blocks.find(b => b.status === 'pending');
  if (pendingBlock && (hashCount as number) > 0) {
    store.updateBlock(pendingBlock.id, {
      hashAttempts: pendingBlock.hashAttempts + (hashCount as number),
    });
  }

  return {
    status: 200,
    body: {
      success: true,
      pendingBlockId: pendingBlock?.id || null,
      pendingBlockStatus: pendingBlock?.status || null,
    }
  };
}

export function upgradeRig(body: Record<string, unknown>): ActionResponse {
  const { participantId, newSpeed } = body;

  if (!participantId || ![4, 8, 20].includes(newSpeed as number)) {
    return { status: 400, body: { error: 'Invalid participantId or speed (4/8/20)' } };
  }

  const participant = store.getParticipant(participantId as string);
  if (!participant) {
    return { status: 404, body: { error: 'Participant not found' } };
  }
  if (!participant.allowUpgrade) {
    return { status: 403, body: { error: 'Upgrades not enabled for this student' } };
  }

  store.updateParticipant(participantId as string, { rigSpeed: newSpeed as number });

  return { status: 200, body: { success: true, newSpeed } };
}

export function autoMineTick(body: Record<string, unknown>): ActionResponse {
  const { roomId } = body;
  const state = store.getRoomById(roomId as string)!;
  const room = state.room;

  let blocks = store.getBlocksByRoom(roomId as string);

  // Guard: reject if last block was mined too recently
  const minedBlocks = blocks.filter(b => b.status === 'mined');
  if (minedBlocks.length > 0) {
    const lastMined = minedBlocks.reduce((a, b) => a.blockNumber > b.blockNumber ? a : b);
    if (lastMined.minedAt) {
      const elapsed = (Date.now() - new Date(lastMined.minedAt).getTime()) / 1000;
      const minInterval = (room.autoMineInterval || 20) * 0.7;
      if (elapsed < minInterval) {
        return { status: 200, body: { success: false, skipped: true, message: 'Too soon since last block' } };
      }
    }
  }

  // Auto-create genesis block if none exists
  if (blocks.length === 0) {
    const genesisHash = createHash('sha256')
      .update('1:0000000000000000:[]:0')
      .digest('hex');
    store.createBlock(roomId as string, {
      blockNumber: 1,
      previousHash: '0000000000000000',
      status: 'mined',
      difficulty: room.currentDifficulty,
      miningTarget: room.miningTarget,
      reward: 0,
      transactions: '[]',
      selectedTxIds: [],
      totalFees: 0,
      nonce: 0,
      hash: genesisHash,
      minedAt: new Date(),
    });
    blocks = store.getBlocksByRoom(roomId as string);
  }

  const existingPending = blocks.find(b => b.status === 'pending');

  // Skip if there's already a pending block (shouldn't happen in auto-mine, but safety)
  if (existingPending) {
    store.updateBlock(existingPending.id, { status: 'mined', minedAt: new Date(), hash: 'auto', nonce: 0 });
  }

  const lastBlock = blocks
    .filter(b => b.status === 'mined')
    .sort((a, b) => b.blockNumber - a.blockNumber)[0] || null;

  const newBlockNumber = (lastBlock?.blockNumber ?? 0) + 1;
  const previousHash = lastBlock?.hash || '0000000000000000';

  // Select top N transactions from mempool by fee (highest first)
  const capacity = room.autoMineCapacity || 3;
  const mempoolTxs = store.getMempoolTransactionsByRoom(roomId as string)
    .filter(tx => tx.status === 'in_mempool')
    .sort((a, b) => b.fee - a.fee)
    .slice(0, capacity);

  const totalFees = mempoolTxs.reduce((sum, tx) => sum + tx.fee, 0);
  const selectedTxIds = mempoolTxs.map(tx => tx.id);

  // Build transaction summaries
  const txSummaries = mempoolTxs.map(tx => {
    const sender = store.getParticipant(tx.senderId);
    const receiver = store.getParticipant(tx.receiverId);
    return {
      sender: sender?.name || 'Unknown',
      receiver: receiver?.name || 'Unknown',
      amount: tx.amount,
      fee: tx.fee,
    };
  });

  const currentReward = Math.floor(room.currentBlockReward);
  const blockHash = createHash('sha256')
    .update(`${newBlockNumber}:${previousHash}:${JSON.stringify(txSummaries)}:auto`)
    .digest('hex');

  const newBlock = store.createBlock(roomId as string, {
    blockNumber: newBlockNumber,
    previousHash,
    status: 'mined',
    difficulty: room.currentDifficulty,
    miningTarget: room.miningTarget,
    reward: currentReward,
    transactions: JSON.stringify(txSummaries),
    selectedTxIds,
    totalFees,
    nonce: 0,
    hash: blockHash,
    minedAt: new Date(),
    minerId: null,
  });

  // Mark selected mempool transactions as confirmed
  for (const txId of selectedTxIds) {
    store.updateMempoolTransaction(txId, { status: 'confirmed' });
  }

  // Update total BTC emitted
  const newTotalEmitted = room.totalBtcEmitted + currentReward;
  store.updateRoom(roomId as string, { totalBtcEmitted: newTotalEmitted });

  // Check for halving
  let halvingEvent = null;
  if (newBlockNumber > 0 && newBlockNumber % room.halvingInterval === 0) {
    const newReward = room.currentBlockReward / 2;
    if (newReward >= 0.01) {
      store.updateRoom(roomId as string, { currentBlockReward: newReward });
      halvingEvent = {
        previousReward: room.currentBlockReward,
        newReward,
        halvingNumber: Math.floor(newBlockNumber / room.halvingInterval),
        blockNumber: newBlockNumber,
      };
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      block: {
        ...newBlock,
        miner: null,
        transactions: txSummaries,
        selectedTxIds,
        totalFees,
      },
      includedTxCount: mempoolTxs.length,
      totalFees,
      reward: currentReward,
      halvingEvent,
    }
  };
}

export function updatePhase8Settings(body: Record<string, unknown>): ActionResponse {
  const { roomId, autoMineInterval, autoMineCapacity } = body;

  const updates: { autoMineInterval?: number; autoMineCapacity?: number } = {};

  if (autoMineInterval !== undefined) {
    if ((autoMineInterval as number) < 10 || (autoMineInterval as number) > 60) {
      return {
        status: 400,
        body: { error: 'Invalid auto-mine interval. Must be between 10 and 60 seconds' }
      };
    }
    updates.autoMineInterval = autoMineInterval as number;
  }

  if (autoMineCapacity !== undefined) {
    if ((autoMineCapacity as number) < 1 || (autoMineCapacity as number) > 8) {
      return {
        status: 400,
        body: { error: 'Invalid auto-mine capacity. Must be between 1 and 8 transactions' }
      };
    }
    updates.autoMineCapacity = autoMineCapacity as number;
  }

  if (Object.keys(updates).length === 0) {
    return { status: 400, body: { error: 'No valid settings to update' } };
  }

  store.updateRoom(roomId as string, updates);
  const updatedRoom = store.getRoomById(roomId as string)!.room;

  return {
    status: 200,
    body: {
      success: true,
      settings: {
        autoMineInterval: updatedRoom.autoMineInterval,
        autoMineCapacity: updatedRoom.autoMineCapacity,
      }
    }
  };
}
