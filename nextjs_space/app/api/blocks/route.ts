import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { createHash } from 'crypto';
import { broadcastRoomUpdate } from '@/lib/io';


// Simulated max BTC (scaled down for classroom)
const MAX_BTC_SUPPLY = 2100;

// SHA-256 hash function (simplified display - first 8 chars)
function calculateHash(blockContent: string, nonce: number): string {
  const data = `${blockContent}:${nonce}`;
  return createHash('sha256').update(data).digest('hex');
}

// Phase 6: Check if hash meets difficulty requirement (leading zeros)
function isValidHash(hash: string, difficulty: number): boolean {
  const target = '0'.repeat(difficulty);
  return hash.startsWith(target);
}

// Phase 7+: Target-based difficulty check (first 4 hex chars < target)
function isValidHashTarget(hash: string, miningTarget: number): boolean {
  const hashPrefix = parseInt(hash.substring(0, 4), 16);
  return hashPrefix < miningTarget;
}

// Calculate halving info
function getHalvingInfo(blockNumber: number, halvingInterval: number, currentBlockReward: number, totalBtcEmitted: number) {
  const halvingNumber = Math.floor((blockNumber - 1) / halvingInterval);
  const blocksUntilNextHalving = halvingInterval - ((blockNumber - 1) % halvingInterval);
  const nextReward = currentBlockReward / 2;

  return {
    currentBlockReward,
    halvingInterval,
    blocksUntilNextHalving,
    halvingNumber,
    nextReward: nextReward >= 0.01 ? nextReward : 0,
    totalBtcEmitted,
    maxBtc: MAX_BTC_SUPPLY
  };
}

// Generate random transactions for a block (Phase 6 only, without fees)
function generateBlockTransactions(participants: { id: string; name: string }[]): string {
  const students = participants.filter(p => p.name !== 'Professor');
  if (students.length < 2) {
    return JSON.stringify([]);
  }

  const numTx = Math.min(3 + Math.floor(Math.random() * 3), Math.floor(students.length / 2) + 1);
  const transactions = [];

  for (let i = 0; i < numTx; i++) {
    const senderIdx = Math.floor(Math.random() * students.length);
    let receiverIdx = Math.floor(Math.random() * students.length);
    while (receiverIdx === senderIdx && students.length > 1) {
      receiverIdx = Math.floor(Math.random() * students.length);
    }

    transactions.push({
      sender: students[senderIdx].name,
      receiver: students[receiverIdx].name,
      amount: Math.floor(Math.random() * 10) + 1
    });
  }

  return JSON.stringify(transactions);
}

// Phase 6: Calculate difficulty adjustment (integer leading zeros)
function calculateDifficultyAdjustment(
  avgTimePerBlock: number,
  targetTimePerBlock: number,
  currentDifficulty: number
): { newDifficulty: number; adjustmentResult: 'increased' | 'decreased' | 'stable' } {
  const ratio = avgTimePerBlock / targetTimePerBlock;

  if (ratio >= 0.8 && ratio <= 1.2) {
    return { newDifficulty: currentDifficulty, adjustmentResult: 'stable' };
  }

  if (ratio < 0.8) {
    const newDifficulty = Math.min(currentDifficulty + 1, 5);
    return {
      newDifficulty,
      adjustmentResult: newDifficulty > currentDifficulty ? 'increased' : 'stable'
    };
  } else {
    const newDifficulty = Math.max(currentDifficulty - 1, 1);
    return {
      newDifficulty,
      adjustmentResult: newDifficulty < currentDifficulty ? 'decreased' : 'stable'
    };
  }
}

// Phase 7+: Target-based difficulty adjustment (granular, ratio-based like real Bitcoin)
function calculateTargetAdjustment(
  avgTimePerBlock: number,
  targetTimePerBlock: number,
  currentTarget: number
): { newTarget: number; adjustmentResult: 'increased' | 'decreased' | 'stable' } {
  const ratio = avgTimePerBlock / targetTimePerBlock;

  if (ratio >= 0.85 && ratio <= 1.15) {
    return { newTarget: currentTarget, adjustmentResult: 'stable' };
  }

  // New target = current * ratio (if blocks are slow, target goes up = easier)
  // Clamp adjustment to 4x max change per period
  const clampedRatio = Math.max(0.25, Math.min(4, ratio));
  const newTarget = Math.round(currentTarget * clampedRatio);
  const clamped = Math.max(1, Math.min(65535, newTarget));

  if (clamped < currentTarget) {
    return { newTarget: clamped, adjustmentResult: 'increased' }; // harder
  } else if (clamped > currentTarget) {
    return { newTarget: clamped, adjustmentResult: 'decreased' }; // easier
  }
  return { newTarget: clamped, adjustmentResult: 'stable' };
}

// Get period info for a given block number
function getPeriodInfo(blockNumber: number, adjustmentInterval: number) {
  const periodNumber = Math.floor((blockNumber - 1) / adjustmentInterval) + 1;
  const startBlock = (periodNumber - 1) * adjustmentInterval + 1;
  const endBlock = periodNumber * adjustmentInterval;
  const positionInPeriod = ((blockNumber - 1) % adjustmentInterval) + 1;

  return { periodNumber, startBlock, endBlock, positionInPeriod };
}

// GET: Fetch all blocks for a room, with difficulty period info and halving info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const state = store.getRoomById(roomId);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
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
      totalFees: block.totalFees || 0
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

    return NextResponse.json({
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
      }
    });
  } catch (error) {
    console.error('Error fetching blocks:', error);
    return NextResponse.json({ error: 'Failed to fetch blocks' }, { status: 500 });
  }
}

// POST: Create pending block or submit mined block
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, roomId, minerId, nonce, hash } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const state = store.getRoomById(roomId);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const room = state.room;
    const roomCode = store.getRoomCodeById(roomId);

    // Action: Create genesis block (teacher only)
    if (action === 'create-genesis') {
      const blocks = store.getBlocksByRoom(roomId);

      if (blocks.length > 0) {
        return NextResponse.json({
          error: 'Blocks already exist in this room',
          code: 'BLOCKS_EXIST'
        }, { status: 400 });
      }

      // Auto-calculate initial difficulty based on connected students
      const activeStudents = state.participants
        ? Array.from(state.participants.values()).filter(p => p.isActive && p.role === 'student').length
        : 0;

      let calculatedDifficulty = 2;
      let initialMiningTarget = 4096; // ~d1 equivalent

      if (room.currentPhase >= 7) {
        // Phase 7+: Target-based difficulty
        // Estimate total hashrate: each student has 1 rig at 4 h/s initially
        const estimatedHashrate = Math.max(activeStudents, 1) * 4;
        const targetSeconds = room.targetBlockTime || 15;
        // target = 65536 / (hashrate * blockTime)
        initialMiningTarget = Math.round(65536 / (estimatedHashrate * targetSeconds));
        initialMiningTarget = Math.max(1, Math.min(65535, initialMiningTarget));
        store.updateRoom(roomId, { miningTarget: initialMiningTarget, currentDifficulty: calculatedDifficulty });
      } else {
        // Phase 6: Leading zeros difficulty
        const clicksPerSecond = 2;
        const targetSeconds = 30;
        const optimalAttempts = targetSeconds * Math.max(activeStudents, 1) * clicksPerSecond;
        calculatedDifficulty = Math.max(1, Math.min(4,
          Math.round(Math.log(optimalAttempts) / Math.log(16))
        ));
        store.updateRoom(roomId, { currentDifficulty: calculatedDifficulty });
      }

      const genesisHash = createHash('sha256')
        .update('1:0000000000000000:[]:0')
        .digest('hex');

      const genesisBlock = store.createBlock(roomId, {
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

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
        success: true,
        block: {
          ...genesisBlock,
          transactions: [],
          selectedTxIds: [],
          totalFees: 0,
          miner: null
        }
      });
    }

    // Action: Create a new pending block
    if (action === 'create-pending') {
      const blocks = store.getBlocksByRoom(roomId);
      const existingPending = blocks.find(b => b.status === 'pending');

      if (existingPending) {
        return NextResponse.json({
          message: 'Pending block already exists',
          block: {
            ...existingPending,
            transactionsRaw: existingPending.transactions,
            transactions: JSON.parse(existingPending.transactions || '[]'),
            selectedTxIds: existingPending.selectedTxIds || [],
            totalFees: existingPending.totalFees || 0
          }
        });
      }

      const lastBlock = blocks
        .filter(b => b.status === 'mined')
        .sort((a, b) => b.blockNumber - a.blockNumber)[0] || null;

      const newBlockNumber = (lastBlock?.blockNumber ?? 0) + 1;
      const previousHash = lastBlock?.hash || '0000000000000000';

      const participants = store.getParticipantsByRoom(roomId)
        .filter(p => p.isActive)
        .map(p => ({ id: p.id, name: p.name }));

      const transactions = generateBlockTransactions(participants);
      const currentReward = Math.floor(room.currentBlockReward);

      const newBlock = store.createBlock(roomId, {
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

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
        ...newBlock,
        transactionsRaw: newBlock.transactions,
        transactions: JSON.parse(newBlock.transactions),
        selectedTxIds: [],
        totalFees: 0
      });
    }

    // Action: Select transactions for a pending block (Phase 8)
    if (action === 'select-transactions') {
      const { txIds } = body;

      if (!txIds || !Array.isArray(txIds)) {
        return NextResponse.json({ error: 'txIds array is required' }, { status: 400 });
      }

      const blocks = store.getBlocksByRoom(roomId);
      const pendingBlock = blocks.find(b => b.status === 'pending');

      if (!pendingBlock) {
        return NextResponse.json({ error: 'No pending block' }, { status: 400 });
      }

      // Get selected mempool transactions and calculate total fees
      const allMempoolTxs = store.getMempoolTransactionsByRoom(roomId);
      const selectedTxs = allMempoolTxs.filter(tx => txIds.includes(tx.id));
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
        selectedTxIds: txIds,
        totalFees,
        transactions: JSON.stringify(txSummaries),
      });

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
        ...store.getBlock(pendingBlock.id),
        transactions: txSummaries,
        selectedTxIds: txIds,
        totalFees
      });
    }

    // Action: Submit a mined block
    if (action === 'submit-block') {
      if (!minerId || nonce === undefined || !hash) {
        return NextResponse.json({ error: 'minerId, nonce, and hash are required' }, { status: 400 });
      }

      const blocks = store.getBlocksByRoom(roomId);
      const pendingBlock = blocks.find(b => b.status === 'pending');

      if (!pendingBlock) {
        return NextResponse.json({
          error: 'No pending block to mine',
          code: 'NO_PENDING_BLOCK'
        }, { status: 400 });
      }

      // Verify the hash
      const blockContent = `${pendingBlock.blockNumber}:${pendingBlock.previousHash}:${pendingBlock.transactions}`;
      const calculatedHash = calculateHash(blockContent, nonce);

      if (calculatedHash !== hash) {
        return NextResponse.json({
          error: 'Hash mismatch - invalid submission',
          code: 'INVALID_HASH'
        }, { status: 400 });
      }

      // Phase 7+: use target-based check; Phase 6: leading zeros
      const hashValid = pendingBlock.miningTarget && room.currentPhase >= 7
        ? isValidHashTarget(hash, pendingBlock.miningTarget)
        : isValidHash(hash, pendingBlock.difficulty);

      if (!hashValid) {
        return NextResponse.json({
          error: 'Hash does not meet difficulty requirement',
          code: 'HASH_NOT_VALID'
        }, { status: 400 });
      }

      // Check if block was already mined (race condition)
      const refreshedBlock = store.getBlock(pendingBlock.id);
      if (refreshedBlock?.status === 'mined') {
        return NextResponse.json({
          error: 'Block already mined by someone else',
          code: 'ALREADY_MINED',
          minerId: refreshedBlock.minerId
        }, { status: 409 });
      }

      const miner = store.getParticipant(minerId);
      if (!miner) {
        return NextResponse.json({ error: 'Miner not found' }, { status: 404 });
      }

      const adjustmentInterval = room.difficultyAdjustmentInterval;
      const targetBlockTime = room.targetBlockTime;
      const currentDifficulty = room.currentDifficulty;
      const halvingInterval = room.halvingInterval;
      const currentBlockReward = room.currentBlockReward;

      const blockFees = pendingBlock.totalFees || 0;
      const totalMinerReward = pendingBlock.reward + blockFees;

      // Mine the block
      store.updateBlock(pendingBlock.id, {
        status: 'mined',
        nonce,
        hash,
        minerId,
        minedAt: new Date(),
      });

      // Update miner stats
      store.updateParticipant(minerId, {
        blocksMinedCount: miner.blocksMinedCount + 1,
        totalMiningReward: miner.totalMiningReward + Math.floor(totalMinerReward),
      });

      const minedBlock = store.getBlock(pendingBlock.id)!;
      const updatedMiner = store.getParticipant(minerId)!;

      // Mark selected mempool transactions as confirmed
      if (pendingBlock.selectedTxIds && pendingBlock.selectedTxIds.length > 0) {
        for (const txId of pendingBlock.selectedTxIds) {
          const tx = store.getMempoolTransaction(txId);
          if (tx) store.updateMempoolTransaction(txId, { status: 'confirmed' });
        }
      }

      // Update total BTC emitted
      const newTotalEmitted = room.totalBtcEmitted + pendingBlock.reward;
      store.updateRoom(roomId, { totalBtcEmitted: newTotalEmitted });

      // Phase 8+: Check for halving (skip for Phase 7 — reward stays constant)
      let halvingEvent = null;
      const blockNumber = minedBlock.blockNumber;
      if (room.currentPhase >= 8 && blockNumber > 0 && blockNumber % halvingInterval === 0) {
        const newReward = currentBlockReward / 2;
        if (newReward >= 0.01) {
          store.updateRoom(roomId, { currentBlockReward: newReward });

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
        const periodBlocks = store.getBlocksByRoom(roomId)
          .filter(b => b.status === 'mined' && b.blockNumber >= periodStartBlock && b.blockNumber <= blockNumber)
          .sort((a, b) => a.blockNumber - b.blockNumber);

        if (periodBlocks.length > 1 && periodBlocks[0].minedAt && periodBlocks[periodBlocks.length - 1].minedAt) {
          const totalTime = Math.floor(
            (new Date(periodBlocks[periodBlocks.length - 1].minedAt!).getTime() -
             new Date(periodBlocks[0].minedAt!).getTime()) / 1000
          );
          const avgTime = totalTime / (periodBlocks.length - 1);

          const updatedRoom = store.getRoomById(roomId)!.room;

          if (updatedRoom.currentPhase >= 7) {
            // Phase 7+: Target-based granular adjustment
            const currentTarget = updatedRoom.miningTarget;
            const targetAdj = calculateTargetAdjustment(avgTime, targetBlockTime, currentTarget);

            if (targetAdj.newTarget !== currentTarget) {
              store.updateRoom(roomId, { miningTarget: targetAdj.newTarget });

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
              store.updateRoom(roomId, { currentDifficulty: adjustment.newDifficulty });

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

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
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
      });
    }

    // Action: Calculate hash for a nonce (for mining attempts)
    if (action === 'calculate-hash') {
      if (nonce === undefined) {
        return NextResponse.json({ error: 'nonce is required' }, { status: 400 });
      }

      const blocks = store.getBlocksByRoom(roomId);
      const pendingBlock = blocks.find(b => b.status === 'pending');

      if (!pendingBlock) {
        return NextResponse.json({ error: 'No pending block' }, { status: 400 });
      }

      // Increment hash attempts
      store.updateBlock(pendingBlock.id, {
        hashAttempts: pendingBlock.hashAttempts + 1,
      });

      // Increment participant's hash attempts
      if (minerId) {
        const miner = store.getParticipant(minerId);
        if (miner) {
          store.updateParticipant(minerId, {
            hashAttempts: miner.hashAttempts + 1,
          });
        }
      }

      const blockContent = `${pendingBlock.blockNumber}:${pendingBlock.previousHash}:${pendingBlock.transactions}`;
      const calculatedHash = calculateHash(blockContent, nonce);

      const valid = pendingBlock.miningTarget && room.currentPhase >= 7
        ? isValidHashTarget(calculatedHash, pendingBlock.miningTarget)
        : isValidHash(calculatedHash, pendingBlock.difficulty);

      return NextResponse.json({
        hash: calculatedHash,
        hashShort: calculatedHash.substring(0, 8).toUpperCase(),
        isValid: valid,
        difficulty: pendingBlock.difficulty,
        miningTarget: pendingBlock.miningTarget,
        nonce,
        blockNumber: pendingBlock.blockNumber
      });
    }

    // Action: Reset blockchain for room
    if (action === 'reset') {
      store.deleteBlocksByRoom(roomId);

      // Reset all participant mining stats
      for (const p of state.participants.values()) {
        p.blocksMinedCount = 0;
        p.totalMiningReward = 0;
        p.hashAttempts = 0;
      }

      // Reset room economic state
      store.updateRoom(roomId, {
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

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({ success: true, message: 'Blockchain reset' });
    }

    // Action: Pause/unpause mining
    if (action === 'toggle-mining') {
      const blocks = store.getBlocksByRoom(roomId);
      const pendingBlock = blocks.find(b => b.status === 'pending' || b.status === 'mining');

      if (!pendingBlock) {
        return NextResponse.json({ error: 'No block to toggle' }, { status: 400 });
      }

      const newStatus = pendingBlock.status === 'pending' ? 'mining' : 'pending';
      store.updateBlock(pendingBlock.id, { status: newStatus });

      const updatedBlock = store.getBlock(pendingBlock.id)!;
      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
        ...updatedBlock,
        transactions: JSON.parse(updatedBlock.transactions)
      });
    }

    // Action: Force immediate difficulty adjustment (teacher only)
    if (action === 'force-adjustment') {
      const { newDifficulty } = body;

      if (newDifficulty === undefined || newDifficulty < 1 || newDifficulty > 5) {
        return NextResponse.json({
          error: 'Invalid difficulty. Must be between 1 and 5'
        }, { status: 400 });
      }

      const previousDifficulty = room.currentDifficulty;
      store.updateRoom(roomId, { currentDifficulty: newDifficulty });

      // Update pending block difficulty if exists
      const blocks = store.getBlocksByRoom(roomId);
      const pendingBlock = blocks.find(b => b.status === 'pending');

      if (pendingBlock) {
        store.updateBlock(pendingBlock.id, { difficulty: newDifficulty });
      }

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
        success: true,
        previousDifficulty,
        newDifficulty,
        message: `Difficulty changed from ${previousDifficulty} to ${newDifficulty}`
      });
    }

    // Action: Update difficulty settings (teacher only)
    if (action === 'update-settings') {
      const { targetBlockTime, adjustmentInterval } = body;

      const updates: { targetBlockTime?: number; difficultyAdjustmentInterval?: number } = {};

      if (targetBlockTime !== undefined) {
        if (targetBlockTime < 5 || targetBlockTime > 120) {
          return NextResponse.json({
            error: 'Invalid target block time. Must be between 5 and 120 seconds'
          }, { status: 400 });
        }
        updates.targetBlockTime = targetBlockTime;
      }

      if (adjustmentInterval !== undefined) {
        if (adjustmentInterval < 3 || adjustmentInterval > 50) {
          return NextResponse.json({
            error: 'Invalid adjustment interval. Must be between 3 and 50 blocks'
          }, { status: 400 });
        }
        updates.difficultyAdjustmentInterval = adjustmentInterval;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({
          error: 'No valid settings to update'
        }, { status: 400 });
      }

      store.updateRoom(roomId, updates);
      const updatedRoom = store.getRoomById(roomId)!.room;

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
        success: true,
        settings: {
          targetBlockTime: updatedRoom.targetBlockTime,
          difficultyAdjustmentInterval: updatedRoom.difficultyAdjustmentInterval,
          currentDifficulty: updatedRoom.currentDifficulty,
        }
      });
    }

    // Action: Update rig settings per-participant (teacher only) - Phase 7
    if (action === 'update-rig-settings') {
      const { participantId, maxRigs, allowUpgrade } = body;

      if (!participantId) {
        return NextResponse.json({ error: 'participantId is required' }, { status: 400 });
      }

      const participant = store.getParticipant(participantId);
      if (!participant) {
        return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
      }

      const updates: Partial<{ maxRigs: number; allowUpgrade: boolean }> = {};

      if (maxRigs !== undefined) {
        if (maxRigs < 1 || maxRigs > 3) {
          return NextResponse.json({ error: 'maxRigs must be 1-3' }, { status: 400 });
        }
        updates.maxRigs = maxRigs;
      }
      if (allowUpgrade !== undefined) {
        updates.allowUpgrade = !!allowUpgrade;
      }

      store.updateParticipant(participantId, updates);
      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({ success: true, participantId, ...updates });
    }

    // Action: Batch hash update (auto-mining) - Phase 7
    if (action === 'batch-hash-update') {
      const { hashCount, activeRigs: rigCount } = body;
      if (!minerId || !hashCount) {
        return NextResponse.json({ error: 'minerId and hashCount required' }, { status: 400 });
      }

      const miner = store.getParticipant(minerId);
      if (miner) {
        const pUpdates: Record<string, number> = {
          hashAttempts: miner.hashAttempts + hashCount,
        };
        if (rigCount !== undefined) {
          pUpdates.activeRigs = rigCount;
        }
        store.updateParticipant(minerId, pUpdates);
      }

      const blocks = store.getBlocksByRoom(roomId);
      const pendingBlock = blocks.find(b => b.status === 'pending');
      if (pendingBlock) {
        store.updateBlock(pendingBlock.id, {
          hashAttempts: pendingBlock.hashAttempts + hashCount,
        });
      }

      return NextResponse.json({
        success: true,
        pendingBlockId: pendingBlock?.id || null,
        pendingBlockStatus: pendingBlock?.status || null,
      });
    }

    // Action: Upgrade rig speed (student) - Phase 7
    if (action === 'upgrade-rig') {
      const { participantId, newSpeed } = body;
      if (!participantId || ![4, 8, 20].includes(newSpeed)) {
        return NextResponse.json({ error: 'Invalid participantId or speed (4/8/20)' }, { status: 400 });
      }
      const participant = store.getParticipant(participantId);
      if (!participant) {
        return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
      }
      if (!participant.allowUpgrade) {
        return NextResponse.json({ error: 'Upgrades not enabled for this student' }, { status: 403 });
      }
      store.updateParticipant(participantId, { rigSpeed: newSpeed });
      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({ success: true, newSpeed });
    }

    // Action: Force immediate halving (teacher only) - Phase 8
    if (action === 'force-halving') {
      const currentReward = room.currentBlockReward;
      const newReward = currentReward / 2;

      if (newReward < 0.01) {
        return NextResponse.json({
          error: 'Reward already at minimum'
        }, { status: 400 });
      }

      store.updateRoom(roomId, { currentBlockReward: newReward });

      // Update pending block reward if exists
      const blocks = store.getBlocksByRoom(roomId);
      const pendingBlock = blocks.find(b => b.status === 'pending');

      if (pendingBlock) {
        store.updateBlock(pendingBlock.id, { reward: Math.floor(newReward) });
      }

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
        success: true,
        previousReward: currentReward,
        newReward,
        message: `Halving forced! Reward reduced from ${currentReward} to ${newReward} BTC`
      });
    }

    // Action: Update halving settings (teacher only) - Phase 8
    if (action === 'update-halving-settings') {
      const { halvingInterval, blockReward } = body;

      const updates: { halvingInterval?: number; currentBlockReward?: number } = {};

      if (halvingInterval !== undefined) {
        if (halvingInterval < 5 || halvingInterval > 100) {
          return NextResponse.json({
            error: 'Invalid halving interval. Must be between 5 and 100 blocks'
          }, { status: 400 });
        }
        updates.halvingInterval = halvingInterval;
      }

      if (blockReward !== undefined) {
        if (blockReward < 0.01 || blockReward > 100) {
          return NextResponse.json({
            error: 'Invalid block reward. Must be between 0.01 and 100 BTC'
          }, { status: 400 });
        }
        updates.currentBlockReward = blockReward;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({
          error: 'No valid settings to update'
        }, { status: 400 });
      }

      store.updateRoom(roomId, updates);
      const updatedRoom = store.getRoomById(roomId)!.room;

      // Update pending block reward if blockReward was changed
      if (blockReward !== undefined) {
        const blocks = store.getBlocksByRoom(roomId);
        const pendingBlock = blocks.find(b => b.status === 'pending');

        if (pendingBlock) {
          store.updateBlock(pendingBlock.id, { reward: Math.floor(blockReward) });
        }
      }

      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
        success: true,
        settings: {
          halvingInterval: updatedRoom.halvingInterval,
          currentBlockReward: updatedRoom.currentBlockReward,
          totalBtcEmitted: updatedRoom.totalBtcEmitted,
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in blocks API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
