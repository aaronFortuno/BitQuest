import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { updateBalance } from '@/lib/balance-utils';

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
          coinFile: updateBalance(sender.coinFile, -transaction.amount),
        });
        store.updateParticipant(transaction.receiverId, {
          coinFile: updateBalance(receiver.coinFile, transaction.amount),
        });
      }

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
