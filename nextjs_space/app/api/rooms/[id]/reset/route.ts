import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { createInitialCoinFile } from '@/lib/room-utils';
import { broadcastRoomUpdate } from '@/lib/io';

export const dynamic = 'force-dynamic';

// Reset phase (delete all transactions, reset coin files)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const state = store.getRoomById(id);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Delete all transactions
    state.transactions.clear();

    // Reset all participant coin files
    for (const p of state.participants.values()) {
      if (p.isActive) {
        p.coinFile = createInitialCoinFile(p.name);
      }
    }

    const participants = Array.from(state.participants.values()).filter(p => p.isActive);
    const room = {
      ...state.room,
      participants,
      transactions: [],
    };

    const roomCode = store.getRoomCodeById(id);
    if (roomCode) broadcastRoomUpdate(roomCode);
    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error resetting phase:', error);
    return NextResponse.json({ error: 'Failed to reset phase' }, { status: 500 });
  }
}
