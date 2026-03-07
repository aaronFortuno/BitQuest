import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';

export const dynamic = 'force-dynamic';

// Generate a human-readable UTXO ID like UTXO#A1
function generateUtxoId(participantName: string, index: number): string {
  const letter = participantName.charAt(0).toUpperCase();
  return `UTXO#${letter}${index}`;
}

// GET: Fetch all UTXOs for a room
export async function GET(request: NextRequest) {
  try {
    const roomId = request.nextUrl.searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const utxos = store.getUTXOsByRoom(roomId)
      .map(utxo => ({
        ...utxo,
        owner: store.getParticipant(utxo.ownerId) || null,
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return NextResponse.json(utxos);
  } catch (error) {
    console.error('Error fetching UTXOs:', error);
    return NextResponse.json({ error: 'Failed to fetch UTXOs' }, { status: 500 });
  }
}

// POST: Initialize UTXOs for a participant (3 UTXOs with values 10, 5, 2)
export async function POST(request: NextRequest) {
  try {
    const { roomId, participantId } = await request.json();

    if (!roomId || !participantId) {
      return NextResponse.json({ error: 'roomId and participantId are required' }, { status: 400 });
    }

    // Check if participant already has UTXOs
    const existingUtxos = store.getUTXOsByOwner(roomId, participantId);

    if (existingUtxos.length > 0) {
      return NextResponse.json({ message: 'Participant already has UTXOs', utxos: existingUtxos });
    }

    // Get participant info for UTXO ID generation
    const participant = store.getParticipant(participantId);

    if (!participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
    }

    const baseIndex = 1;

    // Create 3 initial UTXOs with values 10, 5, 2
    const initialValues = [10, 5, 2];
    const utxos = initialValues.map((amount, idx) => {
      const utxo = store.createUTXO(roomId, {
        utxoId: generateUtxoId(participant.name, baseIndex + idx),
        ownerId: participantId,
        amount,
        isSpent: false,
      });
      return { ...utxo, owner: participant };
    });

    const roomCode = store.getRoomCodeById(roomId);
    if (roomCode) broadcastRoomUpdate(roomCode);
    return NextResponse.json(utxos);
  } catch (error) {
    console.error('Error initializing UTXOs:', error);
    return NextResponse.json({ error: 'Failed to initialize UTXOs' }, { status: 500 });
  }
}
