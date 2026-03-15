// Transaction & Vote store operations

import {
  TransactionData,
  SignedMessageData,
  UTXOData,
  UTXOTransactionData,
  rooms,
  genId,
  getRoomStateById,
} from './types';

export const txStore = {
  // ---- Transaction ----
  createTransaction(roomId: string, data: Partial<TransactionData>): TransactionData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const tx: TransactionData = {
      id: genId(),
      roomId,
      senderId: data.senderId || '',
      receiverId: data.receiverId || '',
      amount: data.amount || 0,
      status: data.status || 'approved',
      rejectReason: data.rejectReason || null,
      isHighlighted: data.isHighlighted || false,
      isFlagged: data.isFlagged || false,
      proposedById: data.proposedById || null,
      votesFor: data.votesFor || 0,
      votesAgainst: data.votesAgainst || 0,
      voterIds: data.voterIds || [],
      createdAt: new Date(),
    };
    state.transactions.set(tx.id, tx);
    return tx;
  },

  getTransaction(id: string): TransactionData | undefined {
    for (const state of rooms.values()) {
      const tx = state.transactions.get(id);
      if (tx) return tx;
    }
    return undefined;
  },

  updateTransaction(id: string, data: Partial<TransactionData>): TransactionData | undefined {
    const tx = this.getTransaction(id);
    if (!tx) return undefined;
    Object.assign(tx, data);
    return tx;
  },

  getTransactionsByRoom(roomId: string): TransactionData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.transactions.values());
  },

  deleteTransactionsByRoom(roomId: string): void {
    const state = getRoomStateById(roomId);
    if (state) state.transactions.clear();
  },

  // ---- UTXO ----
  createUTXO(roomId: string, data: Partial<UTXOData>): UTXOData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const utxo: UTXOData = {
      id: genId(),
      utxoId: data.utxoId || '',
      roomId,
      ownerId: data.ownerId || '',
      amount: data.amount || 0,
      isSpent: data.isSpent || false,
      spentInTxId: data.spentInTxId || null,
      createdInTxId: data.createdInTxId || null,
      createdAt: new Date(),
    };
    state.utxos.set(utxo.id, utxo);
    return utxo;
  },

  getUTXOsByRoom(roomId: string): UTXOData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.utxos.values());
  },

  getUTXOsByOwner(roomId: string, ownerId: string): UTXOData[] {
    return this.getUTXOsByRoom(roomId).filter(u => u.ownerId === ownerId);
  },

  findUTXOByUtxoId(roomId: string, utxoId: string): UTXOData | undefined {
    return this.getUTXOsByRoom(roomId).find(u => u.utxoId === utxoId);
  },

  updateUTXO(id: string, data: Partial<UTXOData>): UTXOData | undefined {
    for (const state of rooms.values()) {
      const utxo = state.utxos.get(id);
      if (utxo) {
        Object.assign(utxo, data);
        return utxo;
      }
    }
    return undefined;
  },

  // ---- UTXOTransaction ----
  createUTXOTransaction(roomId: string, data: Partial<UTXOTransactionData>): UTXOTransactionData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const tx: UTXOTransactionData = {
      id: genId(),
      txId: data.txId || '',
      roomId,
      senderId: data.senderId || '',
      inputUtxoIds: data.inputUtxoIds || [],
      outputs: data.outputs || '[]',
      totalInput: data.totalInput || 0,
      totalOutput: data.totalOutput || 0,
      signature: data.signature || null,
      isValid: data.isValid ?? true,
      invalidReason: data.invalidReason || null,
      createdAt: new Date(),
    };
    state.utxoTransactions.set(tx.id, tx);
    return tx;
  },

  getUTXOTransactionsByRoom(roomId: string): UTXOTransactionData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.utxoTransactions.values());
  },

  countUTXOTransactions(roomId: string): number {
    const state = getRoomStateById(roomId);
    if (!state) return 0;
    return state.utxoTransactions.size;
  },
};
