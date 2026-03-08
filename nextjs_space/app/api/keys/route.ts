import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';

// POST: Register a public key for a participant (generated client-side)
export async function POST(request: NextRequest) {
  console.log('[POST /api/keys] Request received');
  try {
    const { participantId, publicKey } = await request.json();
    console.log('[POST /api/keys] participantId:', participantId, 'publicKey:', publicKey);

    if (!participantId || !publicKey) {
      return NextResponse.json({ error: 'Participant ID and public key required' }, { status: 400 });
    }

    const participant = store.getParticipant(participantId);
    if (!participant) {
      console.log('[POST /api/keys] Participant not found');
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const alreadyExisted = !!participant.publicKey;
    store.updateParticipant(participantId, { publicKey });

    // Broadcast so all clients see the new key in the registry
    const roomCode = store.getRoomCodeById(participant.roomId);
    if (roomCode) {
      console.log('[POST /api/keys] Broadcasting to room:', roomCode);
      broadcastRoomUpdate(roomCode);
    }

    console.log('[POST /api/keys] Success');
    return NextResponse.json({ publicKey, alreadyExisted });
  } catch (error) {
    console.error('[POST /api/keys] Error:', error);
    return NextResponse.json({ error: 'Failed to register public key' }, { status: 500 });
  }
}

// GET: Get all public keys for a room
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
    }

    const allParticipants = store.getParticipantsByRoom(roomId);
    const participants = allParticipants
      .filter(p => p.isActive)
      .map(p => ({ id: p.id, name: p.name, publicKey: p.publicKey }));

    return NextResponse.json({ participants });
  } catch (error) {
    console.error('Error fetching public keys:', error);
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
  }
}
