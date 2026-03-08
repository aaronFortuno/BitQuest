import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';


// Change the bank (assign bank role to a different participant)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: roomId } = params;
    const { newBankId } = await req.json();

    if (!newBankId) {
      return NextResponse.json({ error: 'New bank ID is required' }, { status: 400 });
    }

    const state = store.getRoomById(roomId);
    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Remove bank role from current bank
    for (const p of state.participants.values()) {
      if (p.roomId === roomId && p.isBank) {
        p.isBank = false;
      }
    }

    // Assign bank role to new participant
    const newBank = state.participants.get(newBankId);
    if (newBank) {
      newBank.isBank = true;
    }

    const roomCode = store.getRoomCodeById(roomId);
    if (roomCode) broadcastRoomUpdate(roomCode);
    return NextResponse.json({ bank: newBank });
  } catch (error) {
    console.error('Error changing bank:', error);
    return NextResponse.json({ error: 'Failed to change bank' }, { status: 500 });
  }
}

// Toggle bank disconnection (for demo purposes)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: roomId } = params;
    const { isBankDisconnected, maxTransferAmount } = await req.json();

    const updateData: Partial<{ isBankDisconnected: boolean; maxTransferAmount: number }> = {};
    if (isBankDisconnected !== undefined) updateData.isBankDisconnected = isBankDisconnected;
    if (maxTransferAmount !== undefined) updateData.maxTransferAmount = maxTransferAmount;

    const room = store.updateRoom(roomId, updateData);

    const roomCode2 = store.getRoomCodeById(roomId);
    if (roomCode2) broadcastRoomUpdate(roomCode2);
    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error toggling bank connection:', error);
    return NextResponse.json({ error: 'Failed to toggle bank connection' }, { status: 500 });
  }
}
