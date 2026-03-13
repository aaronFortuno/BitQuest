import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';


// GET: Fetch Phase 9 state (addresses, UTXOs, mempool txs)
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

    const addresses = store.getPhase9AddressesByRoom(roomId).map(a => ({
      id: a.id,
      address: a.address,
      roomId: a.roomId,
      ownerId: a.ownerId,
      createdAt: a.createdAt.toISOString(),
    }));

    const utxos = store.getPhase9UTXOsByRoom(roomId).map(u => ({
      id: u.id,
      utxoId: u.utxoId,
      roomId: u.roomId,
      address: u.address,
      ownerId: u.ownerId,
      amount: u.amount,
      isSpent: u.isSpent,
      spentInTxId: u.spentInTxId,
      createdInTxId: u.createdInTxId,
      createdAt: u.createdAt.toISOString(),
    }));

    const mempoolTxs = store.getPhase9MempoolTxsByRoom(roomId).map(tx => ({
      id: tx.id,
      txId: tx.txId,
      roomId: tx.roomId,
      senderParticipantId: tx.senderParticipantId,
      inputUtxoIds: tx.inputUtxoIds,
      inputs: tx.inputs,
      outputs: tx.outputs,
      totalInput: tx.totalInput,
      totalOutput: tx.totalOutput,
      fee: tx.fee,
      status: tx.status,
      createdAt: tx.createdAt.toISOString(),
    }));

    return NextResponse.json({ addresses, utxos, mempoolTxs });
  } catch (error) {
    console.error('Error fetching Phase 9 data:', error);
    return NextResponse.json({ error: 'Failed to fetch Phase 9 data' }, { status: 500 });
  }
}

// POST: Phase 9 actions
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

      // ---- Initialize Phase 9 ----
      // Creates 1 address + 1 UTXO of 50 BTC for each student
      case 'init-phase9': {
        // Clear any previous data
        store.deletePhase9DataByRoom(roomId);
        store.deleteBlocksByRoom(roomId);

        // All participants (students + teacher) get an initial address + 50 BTC UTXO
        let utxoCounter = 1;

        for (const p of participants) {
          const addr = store.generateBitcoinAddress(roomId, p.id);
          store.createPhase9UTXO(roomId, {
            utxoId: `UTXO#${utxoCounter}`,
            address: addr.address,
            ownerId: p.id,
            amount: 50,
          });
          utxoCounter++;
        }

        // Create genesis block
        const genesisHash = createHash('sha256')
          .update('1:0000000000000000:[]:0')
          .digest('hex');
        store.createBlock(roomId, {
          blockNumber: 1,
          previousHash: '0000000000000000',
          status: 'mined',
          difficulty: room.currentDifficulty,
          reward: 0,
          transactions: '[]',
          selectedTxIds: [],
          totalFees: 0,
          nonce: 0,
          hash: genesisHash,
          minedAt: new Date(),
          minerId: null,
        });

        store.updateRoom(roomId, {
          simulationStarted: true,
          currentBlockReward: 50,
          totalBtcEmitted: 0,
        });

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, message: 'Phase 9 initialized' });
      }

      // ---- Reset Phase 9 ----
      case 'reset-phase9': {
        store.deletePhase9DataByRoom(roomId);
        store.deleteBlocksByRoom(roomId);

        store.updateRoom(roomId, {
          simulationStarted: false,
          currentBlockReward: 50,
          totalBtcEmitted: 0,
        });

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, message: 'Phase 9 reset' });
      }

      // ---- Fund all nodes: give 50 BTC to every participant without UTXOs ----
      case 'fund-all-nodes': {
        let utxoCounter = store.getPhase9UTXOsByRoom(roomId).length + 1;
        let funded = 0;

        for (const p of participants) {
          const existingUtxos = store.getPhase9UTXOsByRoom(roomId)
            .filter(u => u.ownerId === p.id && !u.isSpent);

          if (existingUtxos.length === 0) {
            // Generate address if needed
            let addr = store.getPhase9AddressesByRoom(roomId).find(a => a.ownerId === p.id);
            if (!addr) {
              addr = store.generateBitcoinAddress(roomId, p.id);
            }
            store.createPhase9UTXO(roomId, {
              utxoId: `UTXO#${utxoCounter}`,
              address: addr.address,
              ownerId: p.id,
              amount: 50,
            });
            utxoCounter++;
            funded++;
          }
        }

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, funded });
      }

      // ---- Generate new Bitcoin address ----
      case 'generate-address': {
        const { participantId } = data;
        if (!participantId) {
          return NextResponse.json({ error: 'Participant ID required' }, { status: 400 });
        }

        const addr = store.generateBitcoinAddress(roomId, participantId);

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({
          success: true,
          address: {
            id: addr.id,
            address: addr.address,
            roomId: addr.roomId,
            ownerId: addr.ownerId,
            createdAt: addr.createdAt.toISOString(),
          },
        });
      }

      // ---- Create UTXO-based transaction with addresses ----
      case 'create-transaction': {
        const { participantId, inputUtxoIds, outputs, fee } = data as {
          participantId: string;
          inputUtxoIds: string[];
          outputs: { address: string; amount: number }[];
          fee: number;
        };

        if (!participantId || !inputUtxoIds?.length || !outputs?.length) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate and collect input UTXOs
        const inputUtxos = [];
        for (const utxoId of inputUtxoIds) {
          const utxo = store.getPhase9UTXO(utxoId);
          if (!utxo) {
            return NextResponse.json({ error: `UTXO ${utxoId} not found` }, { status: 400 });
          }
          if (utxo.ownerId !== participantId) {
            return NextResponse.json({ error: `UTXO ${utxo.utxoId} does not belong to you` }, { status: 400 });
          }
          if (utxo.isSpent) {
            return NextResponse.json({ error: `UTXO ${utxo.utxoId} is already spent` }, { status: 400 });
          }
          inputUtxos.push(utxo);
        }

        const totalInput = inputUtxos.reduce((sum, u) => sum + u.amount, 0);
        const totalOutput = outputs.reduce((sum, o) => sum + o.amount, 0);
        const feeAmount = Math.round((fee || 0) * 10) / 10; // 1 decimal

        // Validate conservation: inputs must cover outputs + fee
        if (Math.round((totalOutput + feeAmount) * 10) / 10 > Math.round(totalInput * 10) / 10) {
          return NextResponse.json({
            error: 'Insufficient inputs: outputs + fee exceed input total'
          }, { status: 400 });
        }

        // Calculate change
        const changeAmount = Math.round((totalInput - totalOutput - feeAmount) * 10) / 10;

        // Mark input UTXOs as spent
        const txCount = store.countPhase9MempoolTxs(roomId);
        const txId = `TX#${txCount + 1}`;

        for (const utxo of inputUtxos) {
          store.updatePhase9UTXO(utxo.id, { isSpent: true, spentInTxId: txId });
        }

        // Build input summaries for display
        const inputSummaries = inputUtxos.map(u => ({
          address: u.address,
          amount: u.amount,
        }));

        // Build output UTXOs
        let utxoCount = store.countPhase9UTXOs(roomId);
        const txOutputs = [];

        for (const output of outputs) {
          utxoCount++;
          const newUtxoId = `UTXO#${utxoCount}`;

          // Check if destination address exists (has an owner)
          const destAddr = store.findPhase9AddressByString(roomId, output.address);
          const destOwnerId = destAddr?.ownerId || ''; // empty = burned

          // Create the output UTXO (even if burned — the UTXO exists but is unclaimable)
          store.createPhase9UTXO(roomId, {
            utxoId: newUtxoId,
            address: output.address,
            ownerId: destOwnerId,
            amount: Math.round(output.amount * 10) / 10,
            createdInTxId: txId,
          });

          txOutputs.push({
            address: output.address,
            amount: Math.round(output.amount * 10) / 10,
            isChange: false,
            newUtxoId,
          });
        }

        // Auto-generate change output if there's change
        let changeAddress = '';
        if (changeAmount > 0) {
          utxoCount++;
          const newUtxoId = `UTXO#${utxoCount}`;
          const changeAddr = store.generateBitcoinAddress(roomId, participantId);
          changeAddress = changeAddr.address;

          store.createPhase9UTXO(roomId, {
            utxoId: newUtxoId,
            address: changeAddr.address,
            ownerId: participantId,
            amount: changeAmount,
            createdInTxId: txId,
          });

          txOutputs.push({
            address: changeAddr.address,
            amount: changeAmount,
            isChange: true,
            newUtxoId,
          });
        }

        // Create mempool transaction
        const mempoolTx = store.createPhase9MempoolTx(roomId, {
          txId,
          senderParticipantId: participantId,
          inputUtxoIds,
          inputs: inputSummaries,
          outputs: txOutputs,
          totalInput,
          totalOutput: totalOutput + changeAmount,
          fee: feeAmount,
          status: 'in_mempool',
        });

        // Check for burned outputs (address not found)
        const burnedOutputs = outputs.filter(o => !store.findPhase9AddressByString(roomId, o.address));

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({
          success: true,
          transaction: {
            ...mempoolTx,
            createdAt: mempoolTx.createdAt.toISOString(),
          },
          changeAddress: changeAddress || null,
          changeAmount,
          burnedOutputs: burnedOutputs.map(o => o.address),
        });
      }

      // ---- Auto-mine tick (same pattern as Phase 8) ----
      case 'auto-mine-tick': {
        let blocks = store.getBlocksByRoom(roomId);

        // Guard: reject if last block was mined too recently
        const minedBlocks = blocks.filter(b => b.status === 'mined');
        if (minedBlocks.length > 0) {
          const lastMined = minedBlocks.reduce((a, b) => a.blockNumber > b.blockNumber ? a : b);
          if (lastMined.minedAt) {
            const elapsed = (Date.now() - new Date(lastMined.minedAt).getTime()) / 1000;
            const minInterval = (room.autoMineInterval || 20) * 0.7;
            if (elapsed < minInterval) {
              return NextResponse.json({ success: false, skipped: true, message: 'Too soon since last block' });
            }
          }
        }

        // Auto-create genesis block if none exists
        if (blocks.length === 0) {
          const genesisHash = createHash('sha256')
            .update('1:0000000000000000:[]:0')
            .digest('hex');
          store.createBlock(roomId, {
            blockNumber: 1,
            previousHash: '0000000000000000',
            status: 'mined',
            difficulty: room.currentDifficulty,
            reward: 0,
            transactions: '[]',
            selectedTxIds: [],
            totalFees: 0,
            nonce: 0,
            hash: genesisHash,
            minedAt: new Date(),
            minerId: null,
          });
          blocks = store.getBlocksByRoom(roomId);
        }

        // Clean up any stale pending blocks
        const existingPending = blocks.find(b => b.status === 'pending');
        if (existingPending) {
          store.updateBlock(existingPending.id, { status: 'mined', minedAt: new Date(), hash: 'auto', nonce: 0 });
        }

        const lastBlock = blocks
          .filter(b => b.status === 'mined')
          .sort((a, b) => b.blockNumber - a.blockNumber)[0] || null;

        const newBlockNumber = (lastBlock?.blockNumber ?? 0) + 1;
        const previousHash = lastBlock?.hash || '0000000000000000';

        // Select top N Phase 9 mempool transactions by fee
        const capacity = room.autoMineCapacity || 3;
        const mempoolTxs = store.getPhase9MempoolTxsByRoom(roomId)
          .filter(tx => tx.status === 'in_mempool')
          .sort((a, b) => b.fee - a.fee)
          .slice(0, capacity);

        const totalFees = Math.round(mempoolTxs.reduce((sum, tx) => sum + tx.fee, 0) * 10) / 10;
        const selectedTxIds = mempoolTxs.map(tx => tx.id);

        // Build transaction summaries for block display (using addresses, not names)
        const txSummaries = mempoolTxs.map(tx => {
          // First input address as "sender", first non-change output as "receiver"
          const senderAddr = tx.inputs[0]?.address || '???';
          const receiverOutput = tx.outputs.find(o => !o.isChange) || tx.outputs[0];
          return {
            sender: senderAddr,
            receiver: receiverOutput?.address || '???',
            amount: receiverOutput?.amount || 0,
            fee: tx.fee,
          };
        });

        const currentReward = Math.round(room.currentBlockReward * 10) / 10;
        const blockHash = createHash('sha256')
          .update(`${newBlockNumber}:${previousHash}:${JSON.stringify(txSummaries)}:auto`)
          .digest('hex');

        const newBlock = store.createBlock(roomId, {
          blockNumber: newBlockNumber,
          previousHash,
          status: 'mined',
          difficulty: room.currentDifficulty,
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
          store.updatePhase9MempoolTx(txId, { status: 'confirmed' });
        }

        // Update total BTC emitted
        store.updateRoom(roomId, { totalBtcEmitted: room.totalBtcEmitted + currentReward });

        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({
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
        });
      }

      // ---- Update auto-mine settings (teacher) ----
      case 'update-settings': {
        const { autoMineInterval, autoMineCapacity } = data;
        const updates: { autoMineInterval?: number; autoMineCapacity?: number } = {};

        if (autoMineInterval !== undefined) {
          if (autoMineInterval < 10 || autoMineInterval > 60) {
            return NextResponse.json({ error: 'Interval must be 10-60 seconds' }, { status: 400 });
          }
          updates.autoMineInterval = autoMineInterval;
        }

        if (autoMineCapacity !== undefined) {
          if (autoMineCapacity < 1 || autoMineCapacity > 10) {
            return NextResponse.json({ error: 'Capacity must be 1-10' }, { status: 400 });
          }
          updates.autoMineCapacity = autoMineCapacity;
        }

        store.updateRoom(roomId, updates);
        if (roomCode) broadcastRoomUpdate(roomCode);
        return NextResponse.json({ success: true, ...updates });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in Phase 9 action:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}
