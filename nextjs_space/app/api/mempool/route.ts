import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';
import { monitor } from '@/lib/server-monitor';


// Generate a human-readable mempool transaction ID
function generateMempoolTxId(roomId: string): string {
  const count = store.countMempoolTransactions(roomId);
  return `TX#${count + 1}`;
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
// Used by both students (senderId = themselves) and teacher (originNodeId = any node)
export async function POST(request: NextRequest) {
  try {
    const { roomId, senderId, receiverId, amount, originNodeId } = await request.json();

    if (!roomId || !receiverId || amount === undefined) {
      return NextResponse.json(
        { error: 'roomId, receiverId, and amount are required' },
        { status: 400 }
      );
    }

    // Determine the origin node: teacher can specify originNodeId, students use senderId
    const effectiveSenderId = originNodeId || senderId;
    if (!effectiveSenderId) {
      return NextResponse.json(
        { error: 'senderId or originNodeId is required' },
        { status: 400 }
      );
    }

    // Check if origin node is disconnected
    const originNode = store.getParticipant(effectiveSenderId);
    if (originNode?.isNodeDisconnected) {
      return NextResponse.json(
        { error: 'Origin node is disconnected from the network' },
        { status: 400 }
      );
    }

    const txId = generateMempoolTxId(roomId);

    // Create the mempool transaction with initial status "propagating"
    // fee is always 0 in Phase 5 (fees removed from this phase)
    const mempoolTx = store.createMempoolTransaction(roomId, {
      txId,
      senderId: effectiveSenderId,
      receiverId,
      amount,
      fee: 0,
      status: 'propagating',
      propagatedTo: [effectiveSenderId],
      propagationProgress: 0,
    });

    const result = {
      ...mempoolTx,
      sender: store.getParticipant(effectiveSenderId) || null,
      receiver: store.getParticipant(receiverId) || null,
    };

    // Start BFS propagation through the connection graph (async)
    simulateGraphPropagation(mempoolTx.id, roomId, effectiveSenderId);

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

// ─── BFS propagation through the real connection graph ───
// Each hop between nodes takes 1500-3000ms (random).
// At each step, a node that receives the TX forwards it to its neighbors
// that haven't received it yet. Disconnected nodes and inactive connections
// are skipped.
async function simulateGraphPropagation(txId: string, roomId: string, originNodeId: string) {
  monitor.propagationStart();
  try {
    // Count total reachable nodes (active, non-disconnected students)
    const allParticipants = store.getParticipantsByRoom(roomId)
      .filter(p => p.isActive && p.role === 'student' && !p.isNodeDisconnected);
    const totalNodes = allParticipants.length;

    if (totalNodes <= 1) {
      store.updateMempoolTransaction(txId, {
        status: 'in_mempool',
        propagationProgress: 100,
        propagatedTo: allParticipants.map(p => p.id),
      });
      const roomCode = store.getRoomCodeById(roomId);
      if (roomCode) broadcastRoomUpdate(roomCode);
      return;
    }

    const propagatedSet = new Set<string>([originNodeId]);

    // BFS queue: each entry is a node that just received the TX
    // and will forward it to its neighbors in the next wave
    let currentWave = [originNodeId];

    while (currentWave.length > 0) {
      // Delay before this wave propagates (simulates network latency)
      const delay = 3000 + Math.random() * 2000; // 3-5s per hop
      await new Promise(resolve => setTimeout(resolve, delay));

      const nextWave: string[] = [];

      for (const nodeId of currentWave) {
        // Get this node's active neighbors via real connections
        const neighborIds = store.getConnectedNodeIds(nodeId, roomId);

        for (const neighborId of neighborIds) {
          // Skip already propagated nodes
          if (propagatedSet.has(neighborId)) continue;

          // Skip disconnected nodes
          const neighbor = store.getParticipant(neighborId);
          if (!neighbor || neighbor.isNodeDisconnected || !neighbor.isActive) continue;

          propagatedSet.add(neighborId);
          nextWave.push(neighborId);
        }
      }

      // Update transaction state after this wave
      if (nextWave.length > 0) {
        const progress = Math.round((propagatedSet.size / totalNodes) * 100);
        store.updateMempoolTransaction(txId, {
          propagatedTo: Array.from(propagatedSet),
          propagationProgress: progress,
          status: progress >= 100 ? 'in_mempool' : 'propagating',
        });

        const roomCode = store.getRoomCodeById(roomId);
        if (roomCode) broadcastRoomUpdate(roomCode);
      }

      currentWave = nextWave;
    }

    // Final check: mark as in_mempool even if some nodes are unreachable
    const tx = store.getMempoolTransaction(txId);
    if (tx && tx.status === 'propagating') {
      store.updateMempoolTransaction(txId, {
        status: 'in_mempool',
        propagationProgress: Math.round((propagatedSet.size / totalNodes) * 100),
      });
      const roomCode = store.getRoomCodeById(roomId);
      if (roomCode) broadcastRoomUpdate(roomCode);
    }
  } catch (error) {
    console.error('Error during graph propagation:', error);
  } finally {
    monitor.propagationEnd();
  }
}
