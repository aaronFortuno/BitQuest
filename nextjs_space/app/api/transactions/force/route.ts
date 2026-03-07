import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';

export const dynamic = 'force-dynamic';

// Helper function to update coinFile balance
function updateCoinFileBalance(coinFile: string, delta: number): string {
  try {
    const parsed = JSON.parse(coinFile);
    parsed.saldo = (parsed.saldo || 0) + delta;
    return JSON.stringify(parsed);
  } catch {
    return JSON.stringify({ propietari: '', saldo: delta });
  }
}

// POST /api/transactions/force - Force accept or reject a transaction (teacher only)
export async function POST(request: NextRequest) {
  try {
    const { transactionId, action, participantId } = await request.json();

    if (!transactionId || !action || !participantId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify the participant is a teacher
    const teacher = store.getParticipant(participantId);

    if (!teacher || teacher.role !== 'teacher') {
      return NextResponse.json(
        { error: 'Unauthorized - only teachers can force actions' },
        { status: 403 }
      );
    }

    // Get the transaction
    const transaction = store.getTransaction(transactionId);

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (transaction.status !== 'voting') {
      return NextResponse.json(
        { error: 'Transaction is not in voting status' },
        { status: 400 }
      );
    }

    if (action === 'accept') {
      // Force accept
      store.updateTransaction(transactionId, { status: 'approved' });

      const sender = store.getParticipant(transaction.senderId);
      const receiver = store.getParticipant(transaction.receiverId);

      if (sender && receiver) {
        store.updateParticipant(transaction.senderId, {
          coinFile: updateCoinFileBalance(sender.coinFile, -transaction.amount),
        });
        store.updateParticipant(transaction.receiverId, {
          coinFile: updateCoinFileBalance(receiver.coinFile, transaction.amount),
        });
      }

      const roomCode = store.getRoomCodeById(transaction.roomId);
      if (roomCode) broadcastRoomUpdate(roomCode);
      return NextResponse.json({
        status: 'approved',
        message: 'Transaction force accepted',
      });
    } else if (action === 'reject') {
      // Force reject
      store.updateTransaction(transactionId, {
        status: 'rejected',
        rejectReason: 'forceRejected',
      });

      const roomCode2 = store.getRoomCodeById(transaction.roomId);
      if (roomCode2) broadcastRoomUpdate(roomCode2);
      return NextResponse.json({
        status: 'rejected',
        message: 'Transaction force rejected',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "accept" or "reject"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error forcing transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
