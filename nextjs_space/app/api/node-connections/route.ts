import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';

export const dynamic = 'force-dynamic';

// GET: Fetch all node connections for a room
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

    // Create a mesh network topology
    const connectionSet = new Set<string>();
    const connectionsData: { nodeAId: string; nodeBId: string }[] = [];

    const addConnection = (a: string, b: string) => {
      const key = [a, b].sort().join('-');
      if (!connectionSet.has(key) && a !== b) {
        connectionSet.add(key);
        connectionsData.push({ nodeAId: a, nodeBId: b });
      }
    };

    // First, create a basic ring
    for (let i = 0; i < participants.length; i++) {
      const nextIdx = (i + 1) % participants.length;
      addConnection(participants[i].id, participants[nextIdx].id);
    }

    // Add some random cross-connections
    const numExtraConnections = Math.min(
      Math.floor(participants.length * 1.5),
      participants.length * (participants.length - 1) / 2 - participants.length
    );

    for (let i = 0; i < numExtraConnections; i++) {
      const a = participants[Math.floor(Math.random() * participants.length)];
      const b = participants[Math.floor(Math.random() * participants.length)];
      addConnection(a.id, b.id);
    }

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
