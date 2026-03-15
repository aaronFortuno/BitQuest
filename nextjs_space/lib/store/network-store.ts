// Network connections & Mempool store operations

import {
  MempoolTransactionData,
  NodeConnectionData,
  rooms,
  genId,
  getRoomStateById,
} from './types';

export const networkStore = {
  // ---- MempoolTransaction ----
  createMempoolTransaction(roomId: string, data: Partial<MempoolTransactionData>): MempoolTransactionData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const tx: MempoolTransactionData = {
      id: genId(),
      txId: data.txId || '',
      roomId,
      senderId: data.senderId || '',
      receiverId: data.receiverId || '',
      amount: data.amount || 0,
      fee: data.fee || 0,
      status: data.status || 'propagating',
      propagatedTo: data.propagatedTo || [],
      propagationProgress: data.propagationProgress || 0,
      propagationEdges: data.propagationEdges || [],
      propagationColor: data.propagationColor || '#facc15',
      createdAt: new Date(),
    };
    state.mempoolTransactions.set(tx.id, tx);
    return tx;
  },

  getMempoolTransaction(id: string): MempoolTransactionData | undefined {
    for (const state of rooms.values()) {
      const tx = state.mempoolTransactions.get(id);
      if (tx) return tx;
    }
    return undefined;
  },

  updateMempoolTransaction(id: string, data: Partial<MempoolTransactionData>): MempoolTransactionData | undefined {
    const tx = this.getMempoolTransaction(id);
    if (!tx) return undefined;
    Object.assign(tx, data);
    return tx;
  },

  getMempoolTransactionsByRoom(roomId: string): MempoolTransactionData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.mempoolTransactions.values());
  },

  countMempoolTransactions(roomId: string): number {
    const state = getRoomStateById(roomId);
    if (!state) return 0;
    return state.mempoolTransactions.size;
  },

  deleteMempoolTransactionsByRoom(roomId: string): void {
    const state = getRoomStateById(roomId);
    if (state) state.mempoolTransactions.clear();
  },

  createManyMempoolTransactions(roomId: string, items: Partial<MempoolTransactionData>[]): MempoolTransactionData[] {
    return items.map(item => this.createMempoolTransaction(roomId, item));
  },

  // ---- NodeConnection ----
  createNodeConnection(roomId: string, data: Partial<NodeConnectionData>): NodeConnectionData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const conn: NodeConnectionData = {
      id: genId(),
      roomId,
      nodeAId: data.nodeAId || '',
      nodeBId: data.nodeBId || '',
      isActive: data.isActive ?? true,
      createdAt: new Date(),
    };
    state.nodeConnections.set(conn.id, conn);
    return conn;
  },

  getNodeConnectionsByRoom(roomId: string): NodeConnectionData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.nodeConnections.values());
  },

  countNodeConnections(roomId: string): number {
    const state = getRoomStateById(roomId);
    if (!state) return 0;
    return state.nodeConnections.size;
  },

  deleteNodeConnectionsByRoom(roomId: string): void {
    const state = getRoomStateById(roomId);
    if (state) state.nodeConnections.clear();
  },

  createManyNodeConnections(roomId: string, items: Partial<NodeConnectionData>[]): NodeConnectionData[] {
    return items.map(item => this.createNodeConnection(roomId, item));
  },

  deactivateNodeConnection(connectionId: string, roomId: string): NodeConnectionData | undefined {
    const state = getRoomStateById(roomId);
    if (!state) return undefined;
    const conn = state.nodeConnections.get(connectionId);
    if (conn) {
      conn.isActive = false;
    }
    return conn;
  },

  getNodeConnectionById(connectionId: string, roomId: string): NodeConnectionData | undefined {
    const state = getRoomStateById(roomId);
    if (!state) return undefined;
    return state.nodeConnections.get(connectionId);
  },

  getActiveConnectionsForNode(nodeId: string, roomId: string): NodeConnectionData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.nodeConnections.values()).filter(
      c => c.isActive && (c.nodeAId === nodeId || c.nodeBId === nodeId)
    );
  },

  getConnectedNodeIds(nodeId: string, roomId: string): string[] {
    return this.getActiveConnectionsForNode(nodeId, roomId).map(c =>
      c.nodeAId === nodeId ? c.nodeBId : c.nodeAId
    );
  },
};
