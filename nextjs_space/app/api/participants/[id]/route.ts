import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

// Track pending auto-reconnection timers per node
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

const RECONNECT_DELAY_MS = 4000; // 4 seconds before auto-reconnect

// PATCH: Update participant properties (including disconnect status for Phase 5)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const updates = await request.json();

    // Validate allowed updates
    const allowedFields = ['isNodeDisconnected', 'isActive', 'name', 'coinFile', 'publicKey', 'privateKey'];
    const sanitizedUpdates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = value;
      }
    }

    const participant = store.updateParticipant(id, sanitizedUpdates);

    if (!participant) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    const roomId = participant.roomId;

    // ── Node disconnection: deactivate connections + schedule auto-reconnect ──
    if (sanitizedUpdates.isNodeDisconnected === true) {
      // Cancel any pending reconnect for this node
      const existingTimer = reconnectTimers.get(id);
      if (existingTimer) clearTimeout(existingTimer);

      // Deactivate all connections for this node
      const connections = store.getActiveConnectionsForNode(id, roomId);
      for (const conn of connections) {
        store.deactivateNodeConnection(conn.id, roomId);
      }

      
      // Schedule auto-reconnection after delay
      const timer = setTimeout(() => {
        reconnectTimers.delete(id);
        autoReconnectNode(id, roomId);
      }, RECONNECT_DELAY_MS);
      reconnectTimers.set(id, timer);
    }

    // ── Node manual reconnection: cancel timer, reconnect immediately ──
    if (sanitizedUpdates.isNodeDisconnected === false) {
      const existingTimer = reconnectTimers.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        reconnectTimers.delete(id);
      }
      // Create 2-3 new connections for this node
      autoReconnectNode(id, roomId);
    }

        return NextResponse.json(participant);
  } catch (error) {
    console.error('Error updating participant:', error);
    return NextResponse.json(
      { error: 'Failed to update participant' },
      { status: 500 }
    );
  }
}

// Auto-reconnect: set node as connected + create 2-3 new connections
function autoReconnectNode(nodeId: string, roomId: string) {
  // Mark node as connected again
  store.updateParticipant(nodeId, { isNodeDisconnected: false });

  // Find 2-3 peers to connect to
  const targetDegree = 2 + Math.floor(Math.random() * 2); // 2 or 3
  for (let i = 0; i < targetDegree; i++) {
    const currentNeighborIds = new Set(store.getConnectedNodeIds(nodeId, roomId));
    const participants = store.getParticipantsByRoom(roomId)
      .filter(p => p.isActive && p.role === 'student' && !p.isNodeDisconnected && p.id !== nodeId);

    const candidates = participants.filter(p => {
      if (currentNeighborIds.has(p.id)) return false;
      const theirConns = store.getActiveConnectionsForNode(p.id, roomId);
      return theirConns.length < 3;
    });

    if (candidates.length === 0) break;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    store.createNodeConnection(roomId, {
      nodeAId: nodeId,
      nodeBId: target.id,
      isActive: true,
    });
  }

  }

// GET: Get a specific participant
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const participant = store.getParticipant(id);

    if (!participant) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(participant);
  } catch (error) {
    console.error('Error fetching participant:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participant' },
      { status: 500 }
    );
  }
}
