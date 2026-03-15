import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { updateBalance } from '@/lib/balance-utils';

// Create a new transaction
export async function POST(req: NextRequest) {
  try {
    const { roomId, senderId, receiverId, amount, phase, proposedById } = await req.json();

    if (!roomId || !senderId || !receiverId || amount === undefined) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const parsedAmount = parseInt(amount);

    const sender = store.getParticipant(senderId);
    const receiver = store.getParticipant(receiverId);

    if (!sender || !receiver) {
      return NextResponse.json({ error: 'Participants not found' }, { status: 404 });
    }

    // Phase 2: Create voting transaction (distributed consensus)
    // Multiple proposals allowed simultaneously; proposer auto-votes in favor
    if (phase === 2) {
      const proposer = proposedById || senderId;
      const transaction = store.createTransaction(roomId, {
        senderId,
        receiverId,
        amount: parsedAmount,
        status: 'voting',
        proposedById: proposer,
        votesFor: 1,
        votesAgainst: 0,
        voterIds: [proposer],
        isHighlighted: false,
        isFlagged: false,
      });

      // Check if auto-vote already reaches majority (edge case: 1 active student)
      const state = store.getRoomById(roomId);
      const activeVoters = state
        ? Array.from(state.participants.values()).filter(p => p.isActive)
        : [];
      const majorityNeeded = Math.floor(activeVoters.length / 2) + 1;

      if (transaction.votesFor >= majorityNeeded) {
        store.updateTransaction(transaction.id, { status: 'approved' });
        store.updateParticipant(senderId, {
          coinFile: updateBalance(sender.coinFile, -parsedAmount),
        });
        store.updateParticipant(receiverId, {
          coinFile: updateBalance(receiver.coinFile, parsedAmount),
        });
      }

      return NextResponse.json({
        transaction: { ...transaction, sender, receiver }
      });
    }

    // Phase 1: Create pending transaction (bank needs to approve)
    if (phase === 1) {
      const transaction = store.createTransaction(roomId, {
        senderId,
        receiverId,
        amount: parsedAmount,
        status: 'pending',
        isHighlighted: false,
        isFlagged: false,
      });

      return NextResponse.json({
        transaction: { ...transaction, sender, receiver }
      });
    }

    // Phase 0: Create approved transaction and update balances immediately
    const newSenderCoinFile = updateBalance(sender.coinFile, -parsedAmount);
    const newReceiverCoinFile = updateBalance(receiver.coinFile, parsedAmount);

    const transaction = store.createTransaction(roomId, {
      senderId,
      receiverId,
      amount: parsedAmount,
      status: 'approved',
      isHighlighted: false,
      isFlagged: false,
    });

    store.updateParticipant(senderId, { coinFile: newSenderCoinFile });
    store.updateParticipant(receiverId, { coinFile: newReceiverCoinFile });

    return NextResponse.json({
      transaction: { ...transaction, sender: { ...sender, coinFile: newSenderCoinFile }, receiver: { ...receiver, coinFile: newReceiverCoinFile } }
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}

// Get transactions for a room
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    const transactions = store.getTransactionsByRoom(roomId)
      .map(tx => ({
        ...tx,
        sender: store.getParticipant(tx.senderId) || null,
        receiver: store.getParticipant(tx.receiverId) || null,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
