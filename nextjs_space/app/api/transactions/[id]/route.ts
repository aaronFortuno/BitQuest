import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';

export const dynamic = 'force-dynamic';

// Helper function to update coin file balance
function updateCoinFileBalance(coinFile: string, delta: number): string {
  try {
    const data = JSON.parse(coinFile);
    if (typeof data.saldo === 'number') {
      data.saldo = data.saldo + delta;
    } else {
      data.saldo = delta;
    }
    return JSON.stringify(data, null, 2);
  } catch {
    return JSON.stringify({ saldo: delta }, null, 2);
  }
}

// Update transaction (approve, reject, highlight)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json();

    // If approving a transaction, update balances
    if (body.status === 'approved') {
      const transaction = store.getTransaction(id);

      if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      if (transaction.status !== 'pending') {
        return NextResponse.json({ error: 'Transaction already processed' }, { status: 400 });
      }

      const sender = store.getParticipant(transaction.senderId);
      const receiver = store.getParticipant(transaction.receiverId);

      if (!sender || !receiver) {
        return NextResponse.json({ error: 'Participants not found' }, { status: 404 });
      }

      // Update balances and transaction status
      const newSenderCoinFile = updateCoinFileBalance(sender.coinFile, -transaction.amount);
      const newReceiverCoinFile = updateCoinFileBalance(receiver.coinFile, transaction.amount);

      store.updateTransaction(id, { status: 'approved' });
      store.updateParticipant(transaction.senderId, { coinFile: newSenderCoinFile });
      store.updateParticipant(transaction.receiverId, { coinFile: newReceiverCoinFile });

      const updatedTx = store.getTransaction(id);
      const roomCode = store.getRoomCodeById(transaction.roomId);
      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
        transaction: {
          ...updatedTx,
          sender: store.getParticipant(transaction.senderId),
          receiver: store.getParticipant(transaction.receiverId),
        }
      });
    }

    // If rejecting or highlighting
    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.rejectReason !== undefined) updates.rejectReason = body.rejectReason;
    if (body.isHighlighted !== undefined) updates.isHighlighted = body.isHighlighted;

    const transaction = store.updateTransaction(id, updates);

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction) {
      const roomCode2 = store.getRoomCodeById(transaction.roomId);
      if (roomCode2) broadcastRoomUpdate(roomCode2);
    }
    return NextResponse.json({
      transaction: {
        ...transaction,
        sender: store.getParticipant(transaction.senderId),
        receiver: store.getParticipant(transaction.receiverId),
      }
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}
