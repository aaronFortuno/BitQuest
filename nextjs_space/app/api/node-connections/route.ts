import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';


// GET: Fetch all active node connections for a room
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

    const connections = store.getNodeConnectionsByRoom(roomId)
      .filter(c => c.isActive);

    return NextResponse.json(connections);
  } catch (error) {
    console.error('Error fetching node connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch node connections' },
      { status: 500 }
    );
  }
}

// POST: Initialize or refresh network connections for a room
// New topology: each node gets exactly 2-3 connections, graph is connected
export async function POST(request: NextRequest) {
  try {
    const { roomId, regenerate = false } = await request.json();

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400 }
      );
    }

    // Check if connections already exist
    const existingCount = store.countNodeConnections(roomId);

    if (existingCount > 0 && !regenerate) {
      const connections = store.getNodeConnectionsByRoom(roomId).filter(c => c.isActive);
      return NextResponse.json(connections);
    }

    // If regenerating, delete existing connections
    if (regenerate) {
      store.deleteNodeConnectionsByRoom(roomId);
    }

    // Get all active student participants (nodes)
    const participants = store.getParticipantsByRoom(roomId)
      .filter(p => p.isActive && p.role === 'student');

    if (participants.length < 2) {
      return NextResponse.json([]);
    }

    const connectionsData = buildConstrainedTopology(participants.map(p => p.id));

    // Create connections in store
    store.createManyNodeConnections(roomId, connectionsData.map(c => ({
      nodeAId: c.nodeAId,
      nodeBId: c.nodeBId,
      isActive: true,
    })));

    const createdConnections = store.getNodeConnectionsByRoom(roomId).filter(c => c.isActive);
    const roomCode = store.getRoomCodeById(roomId);
    if (roomCode) broadcastRoomUpdate(roomCode);
    return NextResponse.json(createdConnections);
  } catch (error) {
    console.error('Error initializing node connections:', error);
    return NextResponse.json(
      { error: 'Failed to initialize node connections' },
      { status: 500 }
    );
  }
}

// DELETE: Destroy a specific connection between two nodes.
// Auto-reconnection is delayed so the user can see the connection disappear
// and the affected nodes "searching" for new peers before reconnecting.
const CONN_RECONNECT_DELAY_MS = 3000; // 3 seconds

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const roomId = searchParams.get('roomId');

    if (!connectionId || !roomId) {
      return NextResponse.json(
        { error: 'connectionId and roomId are required' },
        { status: 400 }
      );
    }

    const conn = store.deactivateNodeConnection(connectionId, roomId);
    if (!conn) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    const roomCode = store.getRoomCodeById(roomId);
    if (roomCode) broadcastRoomUpdate(roomCode);

    // Schedule delayed reconnection for affected nodes
    const affectedNodes = [conn.nodeAId, conn.nodeBId];
    setTimeout(() => {
      for (const nodeId of affectedNodes) {
        // Skip if node is disconnected
        const participant = store.getParticipant(nodeId);
        if (!participant || participant.isNodeDisconnected) continue;

        const currentConns = store.getActiveConnectionsForNode(nodeId, roomId);
        if (currentConns.length < 2) {
          findReconnection(nodeId, roomId);
        }
      }
      if (roomCode) broadcastRoomUpdate(roomCode);
    }, CONN_RECONNECT_DELAY_MS);

    return NextResponse.json({
      deactivated: conn,
    });
  } catch (error) {
    console.error('Error destroying connection:', error);
    return NextResponse.json(
      { error: 'Failed to destroy connection' },
      { status: 500 }
    );
  }
}

// PATCH: Trigger manual reconnection for a specific node
export async function PATCH(request: NextRequest) {
  try {
    const { nodeId, roomId } = await request.json();

    if (!nodeId || !roomId) {
      return NextResponse.json(
        { error: 'nodeId and roomId are required' },
        { status: 400 }
      );
    }

    const newConn = findReconnection(nodeId, roomId);

    const roomCode = store.getRoomCodeById(roomId);
    if (roomCode) broadcastRoomUpdate(roomCode);

    return NextResponse.json({ reconnection: newConn || null });
  } catch (error) {
    console.error('Error reconnecting node:', error);
    return NextResponse.json(
      { error: 'Failed to reconnect node' },
      { status: 500 }
    );
  }
}


// ─── Topology builder: 2-3 connections per node, connected graph ───

function buildConstrainedTopology(nodeIds: string[]): { nodeAId: string; nodeBId: string }[] {
  const n = nodeIds.length;
  if (n < 2) return [];
  if (n === 2) return [{ nodeAId: nodeIds[0], nodeBId: nodeIds[1] }];

  const connectionSet = new Set<string>();
  const connections: { nodeAId: string; nodeBId: string }[] = [];
  const degree = new Map<string, number>();
  nodeIds.forEach(id => degree.set(id, 0));

  const connKey = (a: string, b: string) => [a, b].sort().join('-');

  const addConnection = (a: string, b: string): boolean => {
    const key = connKey(a, b);
    if (connectionSet.has(key) || a === b) return false;
    if ((degree.get(a) || 0) >= 3 || (degree.get(b) || 0) >= 3) return false;
    connectionSet.add(key);
    connections.push({ nodeAId: a, nodeBId: b });
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
    return true;
  };

  // Step 1: Shuffle nodes and create a spanning path (guarantees connected graph)
  const shuffled = [...nodeIds].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffled.length - 1; i++) {
    addConnection(shuffled[i], shuffled[i + 1]);
  }

  // Step 2: Add extra connections to bring every node to at least 2 connections
  // (the path endpoints only have 1 connection so far)
  for (const nodeId of shuffled) {
    while ((degree.get(nodeId) || 0) < 2) {
      // Find candidate nodes: not already connected, degree < 3
      const currentNeighbors = new Set<string>();
      for (const c of connections) {
        if (c.nodeAId === nodeId) currentNeighbors.add(c.nodeBId);
        if (c.nodeBId === nodeId) currentNeighbors.add(c.nodeAId);
      }

      const candidates = nodeIds.filter(
        id => id !== nodeId && !currentNeighbors.has(id) && (degree.get(id) || 0) < 3
      );

      if (candidates.length === 0) break; // no viable candidates
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      addConnection(nodeId, target);
    }
  }

  return connections;
}


// ─── Auto-reconnection: find a new peer for a node that lost a connection ───

function findReconnection(nodeId: string, roomId: string) {
  const currentNeighborIds = new Set(store.getConnectedNodeIds(nodeId, roomId));

  // Get all active, non-disconnected participants
  const participants = store.getParticipantsByRoom(roomId)
    .filter(p => p.isActive && p.role === 'student' && !p.isNodeDisconnected);

  // Find candidates: not already a neighbor, not self, degree < 3
  const candidates = participants.filter(p => {
    if (p.id === nodeId) return false;
    if (currentNeighborIds.has(p.id)) return false;
    const theirConns = store.getActiveConnectionsForNode(p.id, roomId);
    return theirConns.length < 3;
  });

  if (candidates.length === 0) {
    // Fallback: allow connecting to any node not already a neighbor (even if degree >= 3)
    const fallback = participants.filter(p =>
      p.id !== nodeId && !currentNeighborIds.has(p.id)
    );
    if (fallback.length === 0) return null;
    const target = fallback[Math.floor(Math.random() * fallback.length)];
    return store.createNodeConnection(roomId, {
      nodeAId: nodeId,
      nodeBId: target.id,
      isActive: true,
    });
  }

  const target = candidates[Math.floor(Math.random() * candidates.length)];
  return store.createNodeConnection(roomId, {
    nodeAId: nodeId,
    nodeBId: target.id,
    isActive: true,
  });
}
