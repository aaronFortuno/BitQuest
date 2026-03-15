import { store } from '@/lib/store';
import {
  calculateHashFn,
  isValidHash,
  isValidHashTarget,
  calculateDifficultyAdjustment,
  calculateTargetAdjustment,
} from './mining-utils';
import type { ActionResponse } from './mining-utils';

export function submitBlock(body: Record<string, unknown>): ActionResponse {
  const { roomId, minerId, nonce, hash } = body;

  if (!minerId || nonce === undefined || !hash) {
    return { status: 400, body: { error: 'minerId, nonce, and hash are required' } };
  }

  const state = store.getRoomById(roomId as string)!;
  const room = state.room;

  const blocks = store.getBlocksByRoom(roomId as string);
  const pendingBlock = blocks.find(b => b.status === 'pending');

  if (!pendingBlock) {
    return {
      status: 400,
      body: { error: 'No pending block to mine', code: 'NO_PENDING_BLOCK' }
    };
  }

  // Verify the hash
  const blockContent = `${pendingBlock.blockNumber}:${pendingBlock.previousHash}:${pendingBlock.transactions}`;
  const calculatedHash = calculateHashFn(blockContent, nonce as number);

  if (calculatedHash !== hash) {
    return {
      status: 400,
      body: { error: 'Hash mismatch - invalid submission', code: 'INVALID_HASH' }
    };
  }

  // Phase 7+: use target-based check; Phase 6: leading zeros
  const hashValid = pendingBlock.miningTarget && room.currentPhase >= 7
    ? isValidHashTarget(hash as string, pendingBlock.miningTarget)
    : isValidHash(hash as string, pendingBlock.difficulty);

  if (!hashValid) {
    return {
      status: 400,
      body: { error: 'Hash does not meet difficulty requirement', code: 'HASH_NOT_VALID' }
    };
  }

  // Check if block was already mined (race condition)
  const refreshedBlock = store.getBlock(pendingBlock.id);
  if (refreshedBlock?.status === 'mined') {
    return {
      status: 409,
      body: { error: 'Block already mined by someone else', code: 'ALREADY_MINED', minerId: refreshedBlock.minerId }
    };
  }

  const miner = store.getParticipant(minerId as string);
  if (!miner) {
    return { status: 404, body: { error: 'Miner not found' } };
  }

  const adjustmentInterval = room.difficultyAdjustmentInterval;
  const targetBlockTime = room.targetBlockTime;
  const currentDifficulty = room.currentDifficulty;
  const halvingInterval = room.halvingInterval;
  const currentBlockReward = room.currentBlockReward;

  const blockFees = pendingBlock.totalFees || 0;
  const totalMinerReward = pendingBlock.reward + blockFees;

  // Pool reward distribution
  let poolId: string | null = null;
  let rewardDistribution: string | null = null;

  if (miner.poolId) {
    const pool = store.getMiningPool(miner.poolId);
    if (pool) {
      poolId = pool.id;
      const members = pool.memberIds
        .map(id => store.getParticipant(id))
        .filter(Boolean);

      // Calculate hashrate shares
      const memberHashrates = members.map(m => ({
        id: m!.id,
        name: m!.name,
        hashrate: (m!.activeRigs ?? 0) * (m!.rigSpeed || 4),
      }));
      const totalPoolHashrate = memberHashrates.reduce((sum, m) => sum + m.hashrate, 0);

      // If totalPoolHashrate is 0 (e.g. rigs not yet reported), distribute equally
      const useEqual = totalPoolHashrate === 0;
      let distributed = 0;
      const shares = memberHashrates.map(m => {
        const sharePercent = useEqual
          ? 1 / members.length
          : m.hashrate / totalPoolHashrate;
        const amount = Math.floor(totalMinerReward * sharePercent);
        distributed += amount;
        return {
          participantId: m.id,
          participantName: m.name,
          hashrate: m.hashrate,
          sharePercent: Math.round(sharePercent * 1000) / 10,
          amount,
        };
      });

      // Give remainder to the miner who found the block
      const remainder = totalMinerReward - distributed;
      const minerShare = shares.find(s => s.participantId === minerId);
      if (minerShare) minerShare.amount += remainder;

      rewardDistribution = JSON.stringify(shares);

      // Update each pool member's totalMiningReward
      for (const share of shares) {
        const member = store.getParticipant(share.participantId);
        if (member) {
          store.updateParticipant(share.participantId, {
            totalMiningReward: member.totalMiningReward + share.amount,
          });
        }
      }
    }
  }

  // Mine the block
  store.updateBlock(pendingBlock.id, {
    status: 'mined',
    nonce: nonce as number,
    hash: hash as string,
    minerId: minerId as string,
    minedAt: new Date(),
    poolId,
    rewardDistribution,
  });

  // Update miner stats (blocksMinedCount only for the actual miner)
  // If not in a pool, also add the full reward
  if (!poolId) {
    store.updateParticipant(minerId as string, {
      blocksMinedCount: miner.blocksMinedCount + 1,
      totalMiningReward: miner.totalMiningReward + Math.floor(totalMinerReward),
    });
  } else {
    store.updateParticipant(minerId as string, {
      blocksMinedCount: miner.blocksMinedCount + 1,
    });
  }

  const minedBlock = store.getBlock(pendingBlock.id)!;
  const updatedMiner = store.getParticipant(minerId as string)!;

  // Mark selected mempool transactions as confirmed
  if (pendingBlock.selectedTxIds && pendingBlock.selectedTxIds.length > 0) {
    for (const txId of pendingBlock.selectedTxIds) {
      const tx = store.getMempoolTransaction(txId);
      if (tx) store.updateMempoolTransaction(txId, { status: 'confirmed' });
    }
  }

  // Update total BTC emitted
  const newTotalEmitted = room.totalBtcEmitted + pendingBlock.reward;
  store.updateRoom(roomId as string, { totalBtcEmitted: newTotalEmitted });

  // Phase 8+: Check for halving (skip for Phase 7 — reward stays constant)
  let halvingEvent = null;
  const blockNumber = minedBlock.blockNumber;
  if (room.currentPhase >= 8 && blockNumber > 0 && blockNumber % halvingInterval === 0) {
    const newReward = currentBlockReward / 2;
    if (newReward >= 0.01) {
      store.updateRoom(roomId as string, { currentBlockReward: newReward });

      halvingEvent = {
        previousReward: currentBlockReward,
        newReward,
        halvingNumber: Math.floor(blockNumber / halvingInterval),
        blockNumber
      };
    }
  }

  // Check if we need to adjust difficulty
  let difficultyAdjustment = null;
  if (blockNumber % adjustmentInterval === 0 && blockNumber > 0) {
    const periodStartBlock = blockNumber - adjustmentInterval + 1;
    const periodBlocks = store.getBlocksByRoom(roomId as string)
      .filter(b => b.status === 'mined' && b.blockNumber >= periodStartBlock && b.blockNumber <= blockNumber)
      .sort((a, b) => a.blockNumber - b.blockNumber);

    if (periodBlocks.length > 1 && periodBlocks[0].minedAt && periodBlocks[periodBlocks.length - 1].minedAt) {
      const totalTime = Math.floor(
        (new Date(periodBlocks[periodBlocks.length - 1].minedAt!).getTime() -
         new Date(periodBlocks[0].minedAt!).getTime()) / 1000
      );
      const avgTime = totalTime / (periodBlocks.length - 1);

      const updatedRoom = store.getRoomById(roomId as string)!.room;

      if (updatedRoom.currentPhase >= 7) {
        // Phase 7+: Target-based granular adjustment
        const currentTarget = updatedRoom.miningTarget;
        const targetAdj = calculateTargetAdjustment(avgTime, targetBlockTime, currentTarget);

        if (targetAdj.newTarget !== currentTarget) {
          store.updateRoom(roomId as string, { miningTarget: targetAdj.newTarget });

          difficultyAdjustment = {
            previousDifficulty: currentTarget,
            newDifficulty: targetAdj.newTarget,
            result: targetAdj.adjustmentResult,
            avgTimePerBlock: Math.round(avgTime),
            targetTimePerBlock: targetBlockTime,
            totalPeriodTime: totalTime
          };
        }
      } else {
        // Phase 6: Leading zeros adjustment
        const adjustment = calculateDifficultyAdjustment(avgTime, targetBlockTime, currentDifficulty);

        if (adjustment.newDifficulty !== currentDifficulty) {
          store.updateRoom(roomId as string, { currentDifficulty: adjustment.newDifficulty });

          difficultyAdjustment = {
            previousDifficulty: currentDifficulty,
            newDifficulty: adjustment.newDifficulty,
            result: adjustment.adjustmentResult,
            avgTimePerBlock: Math.round(avgTime),
            targetTimePerBlock: targetBlockTime,
            totalPeriodTime: totalTime
          };
        }
      }
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'Block mined successfully!',
      block: {
        ...minedBlock,
        miner: updatedMiner,
        transactions: JSON.parse(minedBlock.transactions),
        selectedTxIds: minedBlock.selectedTxIds || [],
        totalFees: minedBlock.totalFees || 0
      },
      reward: pendingBlock.reward,
      fees: blockFees,
      totalReward: totalMinerReward,
      miner: updatedMiner,
      difficultyAdjustment,
      halvingEvent
    }
  };
}
