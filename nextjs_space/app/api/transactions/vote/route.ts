import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { updateBalance } from '@/lib/balance-utils';

// POST /api/transactions/vote - Vote on a transaction
export async function POST(request: NextRequest) {
  try {
    const { transactionId, participantId, vote } = await request.json();

    if (!transactionId || !participantId || !vote) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
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

    // Check if participant already voted
    if (transaction.voterIds.includes(participantId)) {
      return NextResponse.json(
        { error: 'Already voted' },
        { status: 400 }
      );
    }

    // Update vote counts
    store.updateTransaction(transactionId, {
      votesFor: vote === 'for' ? transaction.votesFor + 1 : transaction.votesFor,
      votesAgainst: vote === 'against' ? transaction.votesAgainst + 1 : transaction.votesAgainst,
      voterIds: [...transaction.voterIds, participantId],
    });

    const updatedTransaction = store.getTransaction(transactionId)!;

    // Calculate if majority reached
    const state = store.getRoomById(transaction.roomId);
    const activeVoters = state
      ? Array.from(state.participants.values()).filter(p => p.isActive)
      : [];
    const totalVoters = activeVoters.length;
    const majorityNeeded = Math.floor(totalVoters / 2) + 1;

    // Check if voting is complete
    if (updatedTransaction.votesFor >= majorityNeeded) {
      // Majority in favor - approve and update balances
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
        message: 'Transaction approved by consensus',
      });
    } else if (updatedTransaction.votesAgainst >= majorityNeeded) {
      // Majority against - reject
      const sender = store.getParticipant(transaction.senderId);
      let senderBalance = 0;
      if (sender) {
        try {
          const coinFile = JSON.parse(sender.coinFile);
          senderBalance = coinFile.saldo || 0;
        } catch {
          senderBalance = 0;
        }
      }

      const rejectReason = senderBalance < transaction.amount
        ? 'insufficientFunds'
        : 'majorityAgainst';

      store.updateTransaction(transactionId, {
        status: 'rejected',
        rejectReason,
      });

      return NextResponse.json({
        status: 'rejected',
        message: 'Transaction rejected by consensus',
      });
    }

    return NextResponse.json({
      status: 'voting',
      votesFor: updatedTransaction.votesFor,
      votesAgainst: updatedTransaction.votesAgainst,
    });
  } catch (error) {
    console.error('Error voting on transaction:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
