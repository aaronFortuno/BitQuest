import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Simplified cryptography for educational purposes
function generateSimpleKeyPair(): { publicKey: string; privateKey: string } {
  const randomHex = () => Math.random().toString(16).substring(2, 8).toUpperCase();
  const publicKey = randomHex();
  const privateKey = randomHex();
  return { publicKey, privateKey };
}

// POST: Generate keys for a participant
export async function POST(request: NextRequest) {
  try {
    const { participantId } = await request.json();

    if (!participantId) {
      return NextResponse.json({ error: 'Participant ID required' }, { status: 400 });
    }

    const existing = store.getParticipant(participantId);

    if (!existing) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    if (existing.publicKey && existing.privateKey) {
      return NextResponse.json({
        publicKey: existing.publicKey,
        privateKey: existing.privateKey,
        alreadyExisted: true
      });
    }

    // Generate new key pair
    const { publicKey, privateKey } = generateSimpleKeyPair();

    // Save to store
    store.updateParticipant(participantId, { publicKey, privateKey });

    return NextResponse.json({
      publicKey,
      privateKey,
      alreadyExisted: false
    });
  } catch (error) {
    console.error('Error generating keys:', error);
    return NextResponse.json({ error: 'Failed to generate keys' }, { status: 500 });
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
      .filter(p => p.isActive && p.role === 'student')
      .map(p => ({ id: p.id, name: p.name, publicKey: p.publicKey }));

    return NextResponse.json({ participants });
  } catch (error) {
    console.error('Error fetching public keys:', error);
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
  }
}
