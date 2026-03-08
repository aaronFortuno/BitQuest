import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';
import { monitor } from '@/lib/server-monitor';


// Generate a human-readable mempool transaction ID
function generateMempoolTxId(roomId: string): string {
  const count = store.countMempoolTransactions(roomId);
  return `MEMPOOL-TX#${count + 1}`;
}

// GET: Fetch all mempool transactions for a room
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400 }
      );
    }

    const mempoolTxs = store.getMempoolTransactionsByRoom(roomId)
      .map(tx => ({
        ...tx,
        sender: store.getParticipant(tx.senderId) || null,
        receiver: store.getParticipant(tx.receiverId) || null,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json(mempoolTxs);
  } catch (error) {
    console.error('Error fetching mempool transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mempool transactions' },
      { status: 500 }
    );
  }
}

// POST: Create a new mempool transaction and simulate propagation
export async function POST(request: NextRequest) {
  try {
    const { roomId, senderId, receiverId, amount, fee = 0 } = await request.json();

    if (!roomId || !senderId || !receiverId || amount === undefined) {
      return NextResponse.json(
        { error: 'roomId, senderId, receiverId, and amount are required' },
        { status: 400 }
      );
    }

    // Check if sender is disconnected
    const sender = store.getParticipant(senderId);

    if (sender?.isNodeDisconnected) {
      return NextResponse.json(
        { error: 'Your node is disconnected from the network' },
        { status: 400 }
      );
    }

    const txId = generateMempoolTxId(roomId);

    // Create the mempool transaction with initial status "propagating"
    const mempoolTx = store.createMempoolTransaction(roomId, {
      txId,
      senderId,
      receiverId,
      amount,
      fee,
      status: 'propagating',
      propagatedTo: [senderId],
      propagationProgress: 0,
    });

    const result = {
      ...mempoolTx,
      sender: store.getParticipant(senderId) || null,
      receiver: store.getParticipant(receiverId) || null,
    };

    // Start propagation simulation (async)
    simulatePropagation(mempoolTx.id, roomId);

    const roomCode = store.getRoomCodeById(roomId);
    if (roomCode) broadcastRoomUpdate(roomCode);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error creating mempool transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create mempool transaction' },
      { status: 500 }
    );
  }
}

// Simulate transaction propagation through the network
async function simulatePropagation(txId: string, roomId: string) {
  monitor.propagationStart();
  try {
    // Get all active, non-disconnected participants
    const participants = store.getParticipantsByRoom(roomId)
      .filter(p => p.isActive && !p.isNodeDisconnected);

    const totalNodes = participants.length;
    if (totalNodes <= 1) {
      store.updateMempoolTransaction(txId, {
        status: 'in_mempool',
        propagationProgress: 100,
        propagatedTo: participants.map(p => p.id),
      });
      return;
    }

    // Get current transaction state
    const tx = store.getMempoolTransaction(txId);
    if (!tx) return;

    // Propagate to remaining nodes in waves
    const propagatedSet = new Set(tx.propagatedTo);
    const remainingNodes = participants.filter(p => !propagatedSet.has(p.id));

    for (let i = 0; i < remainingNodes.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

      propagatedSet.add(remainingNodes[i].id);
      const progress = Math.round((propagatedSet.size / totalNodes) * 100);

      store.updateMempoolTransaction(txId, {
        propagatedTo: Array.from(propagatedSet),
        propagationProgress: progress,
        status: progress === 100 ? 'in_mempool' : 'propagating',
      });

      // Broadcast after each propagation step
      const roomCode = store.getRoomCodeById(roomId);
      if (roomCode) broadcastRoomUpdate(roomCode);
    }
  } catch (error) {
    console.error('Error during propagation simulation:', error);
  } finally {
    monitor.propagationEnd();
  }
}
