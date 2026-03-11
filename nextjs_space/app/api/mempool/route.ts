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
      propagationColor: nextTxColor(),
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
// Realistic protocol: every node that receives a TX for the first time
// forwards it to ALL its neighbors. If a neighbor already has it,
// the message still travels (visually) but the neighbor ignores it
// and doesn't forward further. This matches how Bitcoin gossip works.

// Palette of distinct, vibrant colors for TX animations
const TX_COLORS = [
  '#facc15', // yellow
  '#38bdf8', // sky blue
  '#fb923c', // orange
  '#a78bfa', // violet
  '#4ade80', // green
  '#f472b6', // pink
  '#22d3ee', // cyan
  '#fbbf24', // amber
  '#c084fc', // purple
  '#34d399', // emerald
  '#f87171', // red
  '#60a5fa', // blue
];
let txColorIndex = 0;
function nextTxColor(): string {
  const color = TX_COLORS[txColorIndex % TX_COLORS.length];
  txColorIndex++;
  return color;
}

interface PlannedWave {
  delay: number;
  edges: { fromNodeId: string; toNodeId: string; startTime: number; duration: number; redundant: boolean }[];
  newNodes: string[];
}

function computePropagationPlan(roomId: string, originNodeId: string, createdAtMs: number) {
  const allParticipants = store.getParticipantsByRoom(roomId)
    .filter(p => p.isActive && p.role === 'student' && !p.isNodeDisconnected);
  const totalNodes = allParticipants.length;

  if (totalNodes <= 1) {
    return { waves: [] as PlannedWave[], totalNodes, allParticipantIds: allParticipants.map(p => p.id) };
  }

  // Tracks which nodes have the TX (for data: who actually stores it)
  const propagatedSet = new Set<string>([originNodeId]);
  // Tracks who sent the TX to each node (so we skip sending back to sender)
  const receivedFrom = new Map<string, string>(); // nodeId → senderId
  // Tracks which nodes will forward in the next wave (only first-time receivers)
  let currentWave = [originNodeId];
  let cumulativeDelay = 0;
  const waves: PlannedWave[] = [];

  while (currentWave.length > 0) {
    const hopDuration = 1500 + Math.random() * 1000; // 1.5-2.5s per hop
    const waveStartTime = createdAtMs + cumulativeDelay;
    cumulativeDelay += hopDuration;

    const nextWave: string[] = [];
    const edges: PlannedWave['edges'] = [];

    for (const nodeId of currentWave) {
      const neighborIds = store.getConnectedNodeIds(nodeId, roomId);
      // Who sent the TX to this node? Don't send it back to them.
      const sender = receivedFrom.get(nodeId);

      for (const neighborId of neighborIds) {
        // Skip the node that sent us this TX — we know they have it
        if (neighborId === sender) continue;

        const neighbor = store.getParticipant(neighborId);
        if (!neighbor || neighbor.isNodeDisconnected || !neighbor.isActive) continue;

        if (propagatedSet.has(neighborId)) {
          // Redundant: the neighbor already has the TX, but this node
          // doesn't know that — so it still sends the message.
          edges.push({
            fromNodeId: nodeId,
            toNodeId: neighborId,
            startTime: waveStartTime,
            duration: hopDuration,
            redundant: true,
          });
        } else {
          // New: first time this node receives the TX
          propagatedSet.add(neighborId);
          receivedFrom.set(neighborId, nodeId);
          nextWave.push(neighborId);
          edges.push({
            fromNodeId: nodeId,
            toNodeId: neighborId,
            startTime: waveStartTime,
            duration: hopDuration,
            redundant: false,
          });
        }
      }
    }

    if (edges.length > 0) {
      waves.push({ delay: cumulativeDelay, edges, newNodes: nextWave });
    }
    currentWave = nextWave;
  }

  return { waves, totalNodes, allParticipantIds: allParticipants.map(p => p.id) };
}

async function simulateGraphPropagation(txId: string, roomId: string, originNodeId: string) {
  monitor.propagationStart();
  try {
    const tx = store.getMempoolTransaction(txId);
    if (!tx) return;

    const createdAtMs = tx.createdAt.getTime();
    const plan = computePropagationPlan(roomId, originNodeId, createdAtMs);

    if (plan.waves.length === 0) {
      store.updateMempoolTransaction(txId, {
        status: 'in_mempool',
        propagationProgress: 100,
        propagatedTo: plan.allParticipantIds,
      });
      const roomCode = store.getRoomCodeById(roomId);
      if (roomCode) broadcastRoomUpdate(roomCode);
      return;
    }

    // Store the full propagation plan so the client can animate immediately
    const allEdges = plan.waves.flatMap(w => w.edges);
    store.updateMempoolTransaction(txId, { propagationEdges: allEdges });
    const roomCode = store.getRoomCodeById(roomId);
    if (roomCode) broadcastRoomUpdate(roomCode);

    // Execute waves with real delays (for propagatedTo consistency)
    const propagatedSet = new Set<string>([originNodeId]);
    for (const wave of plan.waves) {
      // Wait until this wave should complete
      const elapsed = Date.now() - createdAtMs;
      const remaining = wave.delay - elapsed;
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }

      for (const nodeId of wave.newNodes) {
        propagatedSet.add(nodeId);
      }

      const progress = Math.round((propagatedSet.size / plan.totalNodes) * 100);
      store.updateMempoolTransaction(txId, {
        propagatedTo: Array.from(propagatedSet),
        propagationProgress: progress,
        status: progress >= 100 ? 'in_mempool' : 'propagating',
      });

      if (roomCode) broadcastRoomUpdate(roomCode);
    }

    // Final: mark as in_mempool if still propagating
    const finalTx = store.getMempoolTransaction(txId);
    if (finalTx && finalTx.status === 'propagating') {
      store.updateMempoolTransaction(txId, {
        status: 'in_mempool',
        propagationProgress: Math.round((propagatedSet.size / plan.totalNodes) * 100),
      });
      if (roomCode) broadcastRoomUpdate(roomCode);
    }
  } catch (error) {
    console.error('Error during graph propagation:', error);
  } finally {
    monitor.propagationEnd();
  }
}
