import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { generateRoomCode, createInitialCoinFile } from '@/lib/room-utils';
import { broadcastRoomUpdate } from '@/lib/io';

export const dynamic = 'force-dynamic';

// Create a new room (teacher)
export async function POST(req: NextRequest) {
  try {
    const { teacherName } = await req.json();

    if (!teacherName?.trim()) {
      return NextResponse.json({ error: 'Teacher name is required' }, { status: 400 });
    }

    // Generate unique room code
    let code = generateRoomCode();
    while (store.getRoom(code)) {
      code = generateRoomCode();
    }

    // Create room
    const state = store.createRoom(code);

    // Create teacher participant
    const teacher = store.addParticipant(state.room.id, {
      name: teacherName.trim(),
      role: 'teacher',
      coinFile: createInitialCoinFile(teacherName.trim()),
      isActive: true,
    });

    const room = {
      ...state.room,
      participants: [teacher],
      transactions: [],
    };

    broadcastRoomUpdate(code);
    return NextResponse.json({ room, participantId: teacher.id });
  } catch (error) {
    console.error('Error creating room:', error);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}

// Get room by code
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
    }

    const state = store.getRoom(code.toUpperCase());

    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const participants = Array.from(state.participants.values())
      .filter(p => p.isActive)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const transactions = Array.from(state.transactions.values())
      .map(tx => ({
        ...tx,
        sender: state.participants.get(tx.senderId) || null,
        receiver: state.participants.get(tx.receiverId) || null,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const room = {
      ...state.room,
      participants,
      transactions,
    };

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json({ error: 'Failed to fetch room' }, { status: 500 });
  }
}
