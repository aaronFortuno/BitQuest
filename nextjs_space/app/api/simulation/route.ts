import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';


// GET: Fetch simulation stats for Phase 9
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    const state = store.getRoomById(roomId);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const room = state.room;
    const participants = Array.from(state.participants.values())
      .filter(p => p.isActive)
      .sort((a, b) => b.simulationBalance - a.simulationBalance);

    // Get block statistics
    const blocks = store.getBlocksByRoom(roomId)
      .filter(b => b.status === 'mined')
      .sort((a, b) => a.blockNumber - b.blockNumber);

    // Get mempool transaction count
    const mempoolTxCount = store.countMempoolTransactions(roomId);

    // Calculate total energy spent
    const totalEnergySpent = participants.reduce(
      (sum, p) => sum + (p.totalEnergySpent || 0), 0
    );

    const totalHashAttempts = participants.reduce(
      (sum, p) => sum + (p.hashAttempts || 0), 0
    );

    // Build wealth distribution
    const wealthDistribution = participants
      .filter(p => p.role === 'student')
      .map(p => ({
        participantId: p.id,
        name: p.name,
        balance: p.simulationBalance || 0
      }))
      .sort((a, b) => b.balance - a.balance);

    // Build difficulty history from blocks
    const difficultyHistory = blocks.map(b => ({
      blockNumber: b.blockNumber,
      difficulty: b.difficulty
    }));

    // Parse challenge data if exists
    let challengeData = null;
    if (room.challengeData) {
      try {
        challengeData = JSON.parse(room.challengeData);
      } catch {
        challengeData = null;
      }
    }

    const stats = {
      totalBlocks: blocks.length,
      totalTransactions: mempoolTxCount,
      btcInCirculation: room.totalBtcEmitted || 0,
      totalHashrate: totalHashAttempts,
      totalEnergySpent,
      wealthDistribution,
      difficultyHistory,
      transactionVolume: [],
      activeChallenge: room.activeChallenge,
      challengeData,
      simulationStarted: room.simulationStarted
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching simulation stats:', error);
    return NextResponse.json({ error: 'Failed to fetch simulation stats' }, { status: 500 });
  }
}

// POST: Manage simulation actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, action, ...data } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    const state = store.getRoomById(roomId);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const room = state.room;
    const participants = Array.from(state.participants.values()).filter(p => p.isActive);
    const roomCode = store.getRoomCodeById(roomId);

    switch (action) {
      case 'start-simulation': {
        for (const p of participants) {
          if (p.role === 'student') {
            p.simulationBalance = 100;
            p.totalEnergySpent = 0;
          }
        }

        store.updateRoom(roomId, {
          simulationStarted: true,
          activeChallenge: null,
          challengeData: null,
        });

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, message: 'Simulation started' });
      }

      case 'reset-simulation': {
        for (const p of participants) {
          if (p.role === 'student') {
            p.simulationBalance = 100;
            p.totalEnergySpent = 0;
            p.blocksMinedCount = 0;
            p.totalMiningReward = 0;
            p.hashAttempts = 0;
          }
        }

        store.updateRoom(roomId, {
          activeChallenge: null,
          challengeData: null,
          simulationStarted: false,
          currentBlockReward: 50,
          totalBtcEmitted: 0,
          currentDifficulty: 2,
        });

        store.deleteBlocksByRoom(roomId);
        store.deleteMempoolTransactionsByRoom(roomId);

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, message: 'Simulation reset' });
      }

      case 'update-role': {
        const { participantId, newRole } = data;
        if (!participantId || !newRole) {
          return NextResponse.json({ error: 'Participant ID and new role required' }, { status: 400 });
        }

        store.updateParticipant(participantId, { simulationRole: newRole });
        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, message: 'Role updated' });
      }

      case 'launch-challenge': {
        const { challengeType } = data;
        const validChallenges = ['51_attack', 'congestion', 'fork', 'economy', 'environment'];

        if (!challengeType || !validChallenges.includes(challengeType)) {
          return NextResponse.json({ error: 'Invalid challenge type' }, { status: 400 });
        }

        let challengeData: Record<string, unknown> = {
          type: challengeType,
          startedAt: new Date().toISOString()
        };

        if (challengeType === '51_attack') {
          const students = participants.filter(p => p.role === 'student');
          const midpoint = Math.ceil(students.length / 2);
          challengeData.honestGroup = students.slice(0, midpoint).map(s => s.id);
          challengeData.attackingGroup = students.slice(midpoint).map(s => s.id);
          challengeData.mainChainLength = 0;
          challengeData.alternativeChainLength = 0;
        } else if (challengeType === 'fork') {
          const blocks = store.getBlocksByRoom(roomId)
            .filter(b => b.status === 'mined')
            .sort((a, b) => b.blockNumber - a.blockNumber);
          challengeData.forkBlockNumber = blocks[0]?.blockNumber || 0;
          challengeData.forkDetected = false;
        } else if (challengeType === 'congestion') {
          challengeData.congestionLevel = 0;
        }

        store.updateRoom(roomId, {
          activeChallenge: challengeType,
          challengeData: JSON.stringify(challengeData),
        });

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, challengeData });
      }

      case 'end-challenge': {
        store.updateRoom(roomId, { activeChallenge: null, challengeData: null });
        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, message: 'Challenge ended' });
      }

      case 'create-transaction': {
        const { senderId, receiverId, amount, fee = 0 } = data;

        const sender = store.getParticipant(senderId);
        if (!sender || (sender.simulationBalance || 0) < amount + fee) {
          return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
        }

        // Deduct from sender balance
        sender.simulationBalance -= (amount + fee);

        // Create mempool transaction
        const txCount = store.countMempoolTransactions(roomId);
        const txId = `SIM-TX#${txCount + 1}`;

        const transaction = store.createMempoolTransaction(roomId, {
          txId,
          senderId,
          receiverId,
          amount,
          fee,
          status: 'in_mempool',
          propagatedTo: [senderId],
          propagationProgress: 100,
        });

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({
          success: true,
          transaction: {
            ...transaction,
            sender: store.getParticipant(senderId),
            receiver: store.getParticipant(receiverId),
          }
        });
      }

      case 'mine-block': {
        const { minerId, nonce, hash, selectedTxIds = [] } = data;

        // Get current pending block or create one
        const blocks = store.getBlocksByRoom(roomId);
        let pendingBlock = blocks.find(b => b.status === 'pending');

        if (!pendingBlock) {
          const lastBlock = blocks
            .filter(b => b.status === 'mined')
            .sort((a, b) => b.blockNumber - a.blockNumber)[0] || null;

          const newBlockNumber = (lastBlock?.blockNumber || 0) + 1;
          const previousHash = lastBlock?.hash || '0'.repeat(64);

          pendingBlock = store.createBlock(roomId, {
            blockNumber: newBlockNumber,
            previousHash,
            difficulty: room.currentDifficulty,
            reward: Math.round(room.currentBlockReward),
            status: 'pending',
          });
        }

        // Verify hash meets difficulty
        const requiredPrefix = '0'.repeat(pendingBlock.difficulty);
        if (!hash.startsWith(requiredPrefix)) {
          return NextResponse.json({ error: 'Invalid hash - does not meet difficulty requirement' }, { status: 400 });
        }

        // Get selected mempool transactions
        const allMempoolTxs = store.getMempoolTransactionsByRoom(roomId);
        const selectedTxs = allMempoolTxs.filter(tx => selectedTxIds.includes(tx.id) && tx.status === 'in_mempool');

        const totalFees = selectedTxs.reduce((sum, tx) => sum + tx.fee, 0);
        const totalReward = pendingBlock.reward + totalFees;

        // Mark transactions as confirmed and credit receivers
        for (const tx of selectedTxs) {
          tx.status = 'confirmed';
          const receiver = store.getParticipant(tx.receiverId);
          if (receiver) {
            receiver.simulationBalance += tx.amount;
          }
        }

        // Update miner stats and balance
        const miner = store.getParticipant(minerId);
        if (miner) {
          miner.blocksMinedCount += 1;
          miner.totalMiningReward += totalReward;
          miner.simulationBalance += totalReward;
          miner.totalEnergySpent += 1;
        }

        // Update block as mined
        store.updateBlock(pendingBlock.id, {
          status: 'mined',
          nonce,
          hash,
          minerId,
          minedAt: new Date(),
          selectedTxIds,
          totalFees,
        });

        const minedBlock = store.getBlock(pendingBlock.id)!;

        // Update room stats
        room.totalBtcEmitted += pendingBlock.reward;

        // Check for halving
        if (minedBlock.blockNumber % room.halvingInterval === 0 && room.currentBlockReward > 0.01) {
          room.currentBlockReward = room.currentBlockReward / 2;
        }

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({
          success: true,
          block: { ...minedBlock, miner: store.getParticipant(minerId) },
          reward: totalReward,
          feesEarned: totalFees
        });
      }

      case 'fill-mempool': {
        const students = participants.filter(p => p.role === 'student' && p.isActive);
        if (students.length < 2) {
          return NextResponse.json({ error: 'Need at least 2 students' }, { status: 400 });
        }

        const txCount = store.countMempoolTransactions(roomId);
        const transactions = [];

        for (let i = 0; i < 20; i++) {
          const sender = students[Math.floor(Math.random() * students.length)];
          let receiver = students[Math.floor(Math.random() * students.length)];
          while (receiver.id === sender.id) {
            receiver = students[Math.floor(Math.random() * students.length)];
          }

          const amount = Math.floor(Math.random() * 5) + 1;
          const fee = Math.floor(Math.random() * 10) + 1;

          transactions.push({
            txId: `SIM-TX#${txCount + i + 1}`,
            senderId: sender.id,
            receiverId: receiver.id,
            amount,
            fee,
            status: 'in_mempool',
            propagatedTo: [sender.id],
            propagationProgress: 100,
          });
        }

        store.createManyMempoolTransactions(roomId, transactions);

        // Update challenge data if congestion challenge is active
        if (room.activeChallenge === 'congestion') {
          const currentData = room.challengeData ? JSON.parse(room.challengeData) : {};
          currentData.congestionLevel = (currentData.congestionLevel || 0) + 20;
          store.updateRoom(roomId, { challengeData: JSON.stringify(currentData) });
        }

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, created: transactions.length });
      }

      case 'accelerate-halvings': {
        const { halvingCount = 3 } = data;
        let currentReward = room.currentBlockReward;

        for (let i = 0; i < halvingCount; i++) {
          currentReward = currentReward / 2;
          if (currentReward < 0.01) break;
        }

        store.updateRoom(roomId, { currentBlockReward: currentReward });

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, newReward: currentReward });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in simulation action:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}
