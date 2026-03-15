// Phase 9: Addresses, UTXOs, and Mempool transactions

import {
  Phase9AddressData,
  Phase9UTXOData,
  Phase9MempoolTxData,
  rooms,
  genId,
  getRoomStateById,
} from './types';

export const phase9Store = {
  // ---- Phase 9: Bitcoin Addresses ----

  generateBitcoinAddress(roomId: string, ownerId: string): Phase9AddressData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    const addr: Phase9AddressData = {
      id: genId(),
      address: `bc1q${suffix}`,
      roomId,
      ownerId,
      createdAt: new Date(),
    };
    state.phase9Addresses.set(addr.id, addr);
    return addr;
  },

  getPhase9AddressesByRoom(roomId: string): Phase9AddressData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.phase9Addresses.values());
  },

  getPhase9AddressesByOwner(roomId: string, ownerId: string): Phase9AddressData[] {
    return this.getPhase9AddressesByRoom(roomId).filter(a => a.ownerId === ownerId);
  },

  findPhase9AddressByString(roomId: string, address: string): Phase9AddressData | undefined {
    return this.getPhase9AddressesByRoom(roomId).find(a => a.address === address);
  },

  // ---- Phase 9: UTXOs ----

  createPhase9UTXO(roomId: string, data: Partial<Phase9UTXOData>): Phase9UTXOData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const utxo: Phase9UTXOData = {
      id: genId(),
      utxoId: data.utxoId || '',
      roomId,
      address: data.address || '',
      ownerId: data.ownerId || '',
      amount: data.amount || 0,
      isSpent: data.isSpent || false,
      spentInTxId: data.spentInTxId || null,
      createdInTxId: data.createdInTxId || null,
      createdAt: new Date(),
    };
    state.phase9Utxos.set(utxo.id, utxo);
    return utxo;
  },

  getPhase9UTXOsByRoom(roomId: string): Phase9UTXOData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.phase9Utxos.values());
  },

  getPhase9UTXOsByOwner(roomId: string, ownerId: string): Phase9UTXOData[] {
    return this.getPhase9UTXOsByRoom(roomId).filter(u => u.ownerId === ownerId);
  },

  getPhase9UTXOsByAddress(roomId: string, address: string): Phase9UTXOData[] {
    return this.getPhase9UTXOsByRoom(roomId).filter(u => u.address === address);
  },

  getPhase9UTXO(id: string): Phase9UTXOData | undefined {
    for (const state of rooms.values()) {
      const utxo = state.phase9Utxos.get(id);
      if (utxo) return utxo;
    }
    return undefined;
  },

  updatePhase9UTXO(id: string, data: Partial<Phase9UTXOData>): Phase9UTXOData | undefined {
    const utxo = this.getPhase9UTXO(id);
    if (!utxo) return undefined;
    Object.assign(utxo, data);
    return utxo;
  },

  countPhase9UTXOs(roomId: string): number {
    const state = getRoomStateById(roomId);
    if (!state) return 0;
    return state.phase9Utxos.size;
  },

  // ---- Phase 9: Mempool Transactions ----

  createPhase9MempoolTx(roomId: string, data: Partial<Phase9MempoolTxData>): Phase9MempoolTxData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const tx: Phase9MempoolTxData = {
      id: genId(),
      txId: data.txId || '',
      roomId,
      senderParticipantId: data.senderParticipantId || '',
      inputUtxoIds: data.inputUtxoIds || [],
      inputs: data.inputs || [],
      outputs: data.outputs || [],
      totalInput: data.totalInput || 0,
      totalOutput: data.totalOutput || 0,
      fee: data.fee || 0,
      status: data.status || 'in_mempool',
      createdAt: new Date(),
    };
    state.phase9MempoolTxs.set(tx.id, tx);
    return tx;
  },

  getPhase9MempoolTxsByRoom(roomId: string): Phase9MempoolTxData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.phase9MempoolTxs.values());
  },

  getPhase9MempoolTx(id: string): Phase9MempoolTxData | undefined {
    for (const state of rooms.values()) {
      const tx = state.phase9MempoolTxs.get(id);
      if (tx) return tx;
    }
    return undefined;
  },

  updatePhase9MempoolTx(id: string, data: Partial<Phase9MempoolTxData>): Phase9MempoolTxData | undefined {
    const tx = this.getPhase9MempoolTx(id);
    if (!tx) return undefined;
    Object.assign(tx, data);
    return tx;
  },

  countPhase9MempoolTxs(roomId: string): number {
    const state = getRoomStateById(roomId);
    if (!state) return 0;
    return state.phase9MempoolTxs.size;
  },

  // ---- Phase 9: Reset all data ----

  deletePhase9DataByRoom(roomId: string): void {
    const state = getRoomStateById(roomId);
    if (!state) return;
    state.phase9Addresses.clear();
    state.phase9Utxos.clear();
    state.phase9MempoolTxs.clear();
  },
};
