import { store } from '@/lib/store';
import { getHalvingInfo, getPeriodInfo } from './mining-utils';
import type { ActionResponse } from './mining-utils';

export function getBlocks(roomId: string): ActionResponse {
  const state = store.getRoomById(roomId);
  if (!state) {
    return { status: 404, body: { error: 'Room not found' } };
  }

  const room = state.room;
  const blocks = store.getBlocksByRoom(roomId)
    .sort((a, b) => a.blockNumber - b.blockNumber);

  // Parse transactions JSON for each block
  const parsedBlocks = blocks.map(block => ({
    ...block,
    miner: block.minerId ? store.getParticipant(block.minerId) || null : null,
    transactionsRaw: block.transactions,
    transactions: JSON.parse(block.transactions || '[]'),
    selectedTxIds: block.selectedTxIds || [],
    totalFees: block.totalFees || 0,
    poolId: block.poolId || null,
    rewardDistribution: block.rewardDistribution ? JSON.parse(block.rewardDistribution) : null,
  }));

  // Calculate current period info
  const minedBlocks = blocks.filter(b => b.status === 'mined');
  const lastMinedBlock = minedBlocks.length > 0
    ? minedBlocks.reduce((a, b) => a.blockNumber > b.blockNumber ? a : b)
    : null;
  const currentBlockNumber = lastMinedBlock ? lastMinedBlock.blockNumber + 1 : 1;
  const periodInfo = getPeriodInfo(currentBlockNumber, room.difficultyAdjustmentInterval);

  // Get blocks in current period
  const currentPeriodBlocks = minedBlocks.filter(
    b => b.blockNumber >= periodInfo.startBlock && b.blockNumber <= periodInfo.endBlock
  ).sort((a, b) => a.blockNumber - b.blockNumber);

  // Calculate average time for current period
  let avgTimePerBlock = 0;
  let totalTimeSeconds = 0;
  if (currentPeriodBlocks.length > 1) {
    const firstBlock = currentPeriodBlocks[0];
    const lastBlock = currentPeriodBlocks[currentPeriodBlocks.length - 1];
    if (firstBlock.minedAt && lastBlock.minedAt) {
      totalTimeSeconds = Math.floor(
        (new Date(lastBlock.minedAt).getTime() - new Date(firstBlock.minedAt).getTime()) / 1000
      );
      avgTimePerBlock = totalTimeSeconds / (currentPeriodBlocks.length - 1);
    }
  }

  // Predict difficulty adjustment
  let prediction: 'up' | 'down' | 'stable' = 'stable';
  if (avgTimePerBlock > 0) {
    const ratio = avgTimePerBlock / room.targetBlockTime;
    if (ratio < 0.8) prediction = 'up';
    else if (ratio > 1.2) prediction = 'down';
  }

  // Build period history
  const periodHistory = [];
  const maxPeriod = Math.floor((lastMinedBlock?.blockNumber || 0) / room.difficultyAdjustmentInterval) + 1;
  for (let p = 1; p <= maxPeriod; p++) {
    const pStartBlock = (p - 1) * room.difficultyAdjustmentInterval + 1;
    const pEndBlock = p * room.difficultyAdjustmentInterval;
    const periodBlocks = minedBlocks.filter(
      b => b.blockNumber >= pStartBlock && b.blockNumber <= pEndBlock
    ).sort((a, b) => a.blockNumber - b.blockNumber);

    if (periodBlocks.length > 0) {
      let pTotalTime = 0;
      let pAvgTime = 0;
      if (periodBlocks.length > 1 && periodBlocks[0].minedAt && periodBlocks[periodBlocks.length - 1].minedAt) {
        pTotalTime = Math.floor(
          (new Date(periodBlocks[periodBlocks.length - 1].minedAt!).getTime() -
           new Date(periodBlocks[0].minedAt!).getTime()) / 1000
        );
        pAvgTime = pTotalTime / (periodBlocks.length - 1);
      }

      const periodDifficulty = periodBlocks[periodBlocks.length - 1].difficulty;

      periodHistory.push({
        periodNumber: p,
        startBlock: pStartBlock,
        endBlock: pEndBlock,
        blocksMinedInPeriod: periodBlocks.length,
        totalTimeSeconds: pTotalTime,
        avgTimePerBlock: Math.round(pAvgTime),
        difficulty: periodDifficulty
      });
    }
  }

  // Phase 8: Halving info
  const halvingInfo = getHalvingInfo(
    currentBlockNumber,
    room.halvingInterval,
    room.currentBlockReward,
    room.totalBtcEmitted
  );

  // Phase 8: Economic statistics
  const totalFeesPaid = minedBlocks.reduce((sum, b) => sum + (b.totalFees || 0), 0);
  const totalBlockRewardsPaid = minedBlocks.reduce((sum, b) => sum + b.reward, 0);

  // Calculate average fee from mempool transactions
  const mempoolTxs = store.getMempoolTransactionsByRoom(roomId);
  const averageFee = mempoolTxs.length > 0
    ? mempoolTxs.reduce((sum, tx) => sum + tx.fee, 0) / mempoolTxs.length
    : 0;

  // Miner earnings breakdown
  const minerEarningsMap = new Map<string, { minerName: string; blockRewards: number; fees: number }>();
  for (const block of minedBlocks) {
    if (block.minerId) {
      const miner = store.getParticipant(block.minerId);
      const existing = minerEarningsMap.get(block.minerId);
      if (existing) {
        existing.blockRewards += block.reward;
        existing.fees += block.totalFees || 0;
      } else {
        minerEarningsMap.set(block.minerId, {
          minerName: miner?.name || 'Unknown',
          blockRewards: block.reward,
          fees: block.totalFees || 0
        });
      }
    }
  }

  const minerEarnings = Array.from(minerEarningsMap.entries()).map(([minerId, data]) => ({
    minerId,
    minerName: data.minerName,
    blockRewards: data.blockRewards,
    fees: data.fees,
    total: data.blockRewards + data.fees
  })).sort((a, b) => b.total - a.total);

  return {
    status: 200,
    body: {
      blocks: parsedBlocks,
      difficultyInfo: {
        currentDifficulty: room.currentDifficulty,
        miningTarget: room.miningTarget,
        targetBlockTime: room.targetBlockTime,
        adjustmentInterval: room.difficultyAdjustmentInterval,
        currentPeriod: periodInfo.periodNumber,
        periodStartBlock: periodInfo.startBlock,
        periodEndBlock: periodInfo.endBlock,
        blocksInCurrentPeriod: currentPeriodBlocks.length,
        avgTimePerBlock: Math.round(avgTimePerBlock),
        totalTimeSeconds,
        prediction,
        periodHistory
      },
      halvingInfo,
      economicStats: {
        averageFee: Math.round(averageFee * 100) / 100,
        totalFeesPaid,
        totalBlockRewardsPaid,
        minerEarnings
      },
      autoMineSettings: {
        autoMineInterval: room.autoMineInterval,
        autoMineCapacity: room.autoMineCapacity,
      }
    }
  };
}
