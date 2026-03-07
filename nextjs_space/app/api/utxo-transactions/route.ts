import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';


// Generate a human-readable transaction ID
function generateTxId(roomId: string): string {
  const count = store.countUTXOTransactions(roomId);
  return `TX#${count + 1}`;
}

// Generate a unique UTXO ID for new outputs
function generateNewUtxoId(recipientName: string, existingCount: number): string {
  const letter = recipientName.charAt(0).toUpperCase();
  return `UTXO#${letter}${existingCount + 1}`;
}

// GET: Fetch all UTXO transactions for a room
export async function GET(request: NextRequest) {
  try {
    const roomId = request.nextUrl.searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const transactions = store.getUTXOTransactionsByRoom(roomId)
      .map(tx => ({
        ...tx,
        sender: store.getParticipant(tx.senderId) || null,
        outputs: JSON.parse(tx.outputs),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching UTXO transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// POST: Create a new UTXO transaction
export async function POST(request: NextRequest) {
  try {
    const { roomId, senderId, inputUtxoIds, outputs, signature } = await request.json();

    if (!roomId || !senderId || !inputUtxoIds || !outputs) {
      return NextResponse.json({ error: 'roomId, senderId, inputUtxoIds, and outputs are required' }, { status: 400 });
    }

    // Validate inputs exist and are not spent
    const allUtxos = store.getUTXOsByRoom(roomId);
    const inputUtxos = allUtxos.filter(u => inputUtxoIds.includes(u.utxoId));

    // Check all inputs exist
    if (inputUtxos.length !== inputUtxoIds.length) {
      const foundIds = inputUtxos.map(u => u.utxoId);
      const missingIds = inputUtxoIds.filter((id: string) => !foundIds.includes(id));
      return NextResponse.json({
        error: 'UTXO not found',
        invalidReason: `UTXO(s) not found: ${missingIds.join(', ')}`,
        isValid: false
      }, { status: 400 });
    }

    // Check if any input is already spent
    const spentUtxos = inputUtxos.filter(u => u.isSpent);
    if (spentUtxos.length > 0) {
      const spentIds = spentUtxos.map(u => u.utxoId);
      return NextResponse.json({
        error: 'UTXO already spent',
        invalidReason: `UTXO already spent: ${spentIds.join(', ')}`,
        isValid: false
      }, { status: 400 });
    }

    // Check all inputs belong to the sender
    const notOwnedUtxos = inputUtxos.filter(u => u.ownerId !== senderId);
    if (notOwnedUtxos.length > 0) {
      const notOwnedIds = notOwnedUtxos.map(u => u.utxoId);
      return NextResponse.json({
        error: 'UTXO not owned',
        invalidReason: `You don't own: ${notOwnedIds.join(', ')}`,
        isValid: false
      }, { status: 400 });
    }

    // Calculate totals
    const totalInput = inputUtxos.reduce((sum, u) => sum + u.amount, 0);
    const totalOutput = outputs.reduce((sum: number, o: { amount: number }) => sum + o.amount, 0);

    if (totalOutput > totalInput) {
      return NextResponse.json({
        error: 'Outputs exceed inputs',
        invalidReason: `Outputs (${totalOutput} BTC) exceed inputs (${totalInput} BTC)`,
        isValid: false
      }, { status: 400 });
    }

    // Generate transaction ID
    const txId = generateTxId(roomId);

    // Create new UTXOs for each output and build outputs array with new UTXO IDs
    const outputsWithUtxoIds = [];

    for (const output of outputs) {
      const recipient = store.getParticipant(output.recipientId);
      if (!recipient) {
        return NextResponse.json({ error: `Recipient not found: ${output.recipientId}` }, { status: 400 });
      }

      const existingCount = store.getUTXOsByOwner(roomId, output.recipientId).length;
      const newUtxoId = generateNewUtxoId(recipient.name, existingCount);

      outputsWithUtxoIds.push({
        recipientId: output.recipientId,
        recipientName: recipient.name,
        amount: output.amount,
        newUtxoId
      });
    }

    // Create the transaction
    const transaction = store.createUTXOTransaction(roomId, {
      txId,
      senderId,
      inputUtxoIds,
      outputs: JSON.stringify(outputsWithUtxoIds),
      totalInput,
      totalOutput,
      signature,
      isValid: true,
    });

    // Mark input UTXOs as spent
    for (const utxo of inputUtxos) {
      store.updateUTXO(utxo.id, {
        isSpent: true,
        spentInTxId: transaction.id,
      });
    }

    // Create new UTXOs for outputs
    for (const output of outputsWithUtxoIds) {
      store.createUTXO(roomId, {
        utxoId: output.newUtxoId,
        ownerId: output.recipientId,
        amount: output.amount,
        isSpent: false,
        createdInTxId: transaction.id,
      });
    }

    const roomCode = store.getRoomCodeById(roomId);
    if (roomCode) broadcastRoomUpdate(roomCode);
    return NextResponse.json({
      ...transaction,
      sender: store.getParticipant(senderId) || null,
      outputs: outputsWithUtxoIds,
    });
  } catch (error) {
    console.error('Error creating UTXO transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
