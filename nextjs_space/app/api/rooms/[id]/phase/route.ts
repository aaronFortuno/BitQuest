import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { createInitialCoinFile } from '@/lib/room-utils';


// Update room phase
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { currentPhase, unlockPhase } = await req.json();

    const state = store.getRoomById(id);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (currentPhase !== undefined) {
      state.room.currentPhase = currentPhase;

      // Reset transactions and balances when entering Phase 1 or Phase 2
      if (currentPhase === 1 || currentPhase === 2) {
        state.transactions.clear();
        for (const p of state.participants.values()) {
          if (p.isActive) {
            p.coinFile = createInitialCoinFile(p.name);
          }
        }
      }
    }

    if (unlockPhase !== undefined) {
      const currentUnlocked = state.room.unlockedPhases ?? [];
      if (!currentUnlocked.includes(unlockPhase)) {
        state.room.unlockedPhases = [...currentUnlocked, unlockPhase].sort((a, b) => a - b);
      }
    }

    state.room.updatedAt = new Date();

    const participants = Array.from(state.participants.values()).filter(p => p.isActive);
    const transactions = Array.from(state.transactions.values())
      .map(tx => ({
        ...tx,
        sender: state.participants.get(tx.senderId) || null,
        receiver: state.participants.get(tx.receiverId) || null,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const updatedRoom = { ...state.room, participants, transactions };

    return NextResponse.json({ room: updatedRoom });
  } catch (error) {
    console.error('Error updating room phase:', error);
    return NextResponse.json({ error: 'Failed to update phase' }, { status: 500 });
  }
}
