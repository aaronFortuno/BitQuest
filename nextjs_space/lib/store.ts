// In-Memory Store for BitQuest
// Replaces PostgreSQL/Prisma with ephemeral per-room state

import { randomUUID } from 'crypto';

// ============ Data Types ============

export interface RoomData {
  id: string;
  code: string;
  currentPhase: number;
  unlockedPhases: number[];
  isBankDisconnected: boolean;
  maxTransferAmount: number;
  difficultyAdjustmentInterval: number;
  targetBlockTime: number;
  currentDifficulty: number;
  halvingInterval: number;
  currentBlockReward: number;
  totalBtcEmitted: number;
  studentSendingEnabled: boolean;
  miningTarget: number;
  activeChallenge: string | null;
  challengeData: string | null;
  simulationStarted: boolean;
  poolsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParticipantData {
  id: string;
  name: string;
  role: string;
  isBank: boolean;
  roomId: string;
  coinFile: string;
  socketId: string | null;
  isActive: boolean;
  publicKey: string | null;
  privateKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  isNodeDisconnected: boolean;
  blocksMinedCount: number;
  totalMiningReward: number;
  hashAttempts: number;
  activeRigs: number;
  rigSpeed: number;
  maxRigs: number;
  allowUpgrade: boolean;
  simulationRole: string;
  simulationBalance: number;
  totalEnergySpent: number;
  poolId: string | null;
}

export interface TransactionData {
  id: string;
  roomId: string;
  senderId: string;
  receiverId: string;
  amount: number;
  status: string;
  rejectReason: string | null;
  isHighlighted: boolean;
  isFlagged: boolean;
  proposedById: string | null;
  votesFor: number;
  votesAgainst: number;
  voterIds: string[];
  createdAt: Date;
}

export interface SignedMessageData {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  messageHash: string;
  signature: string;
  claimedBy: string | null;
  isFakeDemo: boolean;
  createdAt: Date;
}

export interface UTXOData {
  id: string;
  utxoId: string;
  roomId: string;
  ownerId: string;
  amount: number;
  isSpent: boolean;
  spentInTxId: string | null;
  createdInTxId: string | null;
  createdAt: Date;
}

export interface UTXOTransactionData {
  id: string;
  txId: string;
  roomId: string;
  senderId: string;
  inputUtxoIds: string[];
  outputs: string;
  totalInput: number;
  totalOutput: number;
  signature: string | null;
  isValid: boolean;
  invalidReason: string | null;
  createdAt: Date;
}

export interface PropagationEdgeData {
  fromNodeId: string;
  toNodeId: string;
  startTime: number;
  duration: number;
  redundant?: boolean;
}

export interface MempoolTransactionData {
  id: string;
  txId: string;
  roomId: string;
  senderId: string;
  receiverId: string;
  amount: number;
  fee: number;
  status: string;
  propagatedTo: string[];
  propagationProgress: number;
  propagationEdges: PropagationEdgeData[];
  propagationColor: string;
  createdAt: Date;
}

export interface NodeConnectionData {
  id: string;
  roomId: string;
  nodeAId: string;
  nodeBId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface BlockData {
  id: string;
  blockNumber: number;
  roomId: string;
  previousHash: string;
  nonce: number | null;
  hash: string | null;
  minerId: string | null;
  reward: number;
  difficulty: number;
  miningTarget: number;
  status: string;
  transactions: string;
  hashAttempts: number;
  selectedTxIds: string[];
  totalFees: number;
  poolId: string | null;
  rewardDistribution: string | null;
  createdAt: Date;
  minedAt: Date | null;
}

export interface MiningPoolData {
  id: string;
  roomId: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  colorHex: string;
  createdAt: Date;
}

// ============ Room State ============

interface RoomState {
  room: RoomData;
  participants: Map<string, ParticipantData>;
  transactions: Map<string, TransactionData>;
  signedMessages: Map<string, SignedMessageData>;
  utxos: Map<string, UTXOData>;
  utxoTransactions: Map<string, UTXOTransactionData>;
  mempoolTransactions: Map<string, MempoolTransactionData>;
  nodeConnections: Map<string, NodeConnectionData>;
  blocks: Map<string, BlockData>;
  miningPools: Map<string, MiningPoolData>;
}

// ============ Global Store ============
// Use globalThis to persist across Next.js HMR reloads in dev mode

const globalForStore = globalThis as unknown as {
  __bitquest_rooms?: Map<string, RoomState>;
  __bitquest_roomsById?: Map<string, string>;
};

const rooms = globalForStore.__bitquest_rooms ?? new Map<string, RoomState>();
const roomsById = globalForStore.__bitquest_roomsById ?? new Map<string, string>();

if (process.env.NODE_ENV !== 'production') {
  globalForStore.__bitquest_rooms = rooms;
  globalForStore.__bitquest_roomsById = roomsById;
}

function genId(): string {
  return randomUUID();
}

function createRoomState(code: string): RoomState {
  const id = genId();
  const now = new Date();
  roomsById.set(id, code);
  return {
    room: {
      id,
      code,
      currentPhase: 0,
      unlockedPhases: [0],
      isBankDisconnected: false,
      maxTransferAmount: 5,
      difficultyAdjustmentInterval: 10,
      targetBlockTime: 15,
      currentDifficulty: 2,
      halvingInterval: 20,
      currentBlockReward: 50,
      totalBtcEmitted: 0,
      studentSendingEnabled: false,
      miningTarget: 4096,  // default: ~d=1 leading zeros
      activeChallenge: null,
      challengeData: null,
      simulationStarted: false,
      poolsEnabled: false,
      createdAt: now,
      updatedAt: now,
    },
    participants: new Map(),
    transactions: new Map(),
    signedMessages: new Map(),
    utxos: new Map(),
    utxoTransactions: new Map(),
    mempoolTransactions: new Map(),
    nodeConnections: new Map(),
    blocks: new Map(),
    miningPools: new Map(),
  };
}

// ============ Helper: find room state by room id ============

function getRoomStateById(roomId: string): RoomState | undefined {
  const code = roomsById.get(roomId);
  if (!code) return undefined;
  return rooms.get(code);
}

// ============ Store API ============

export const store = {
  // ---- Room ----
  createRoom(code: string): RoomState {
    const state = createRoomState(code);
    rooms.set(code, state);
    return state;
  },

  getRoom(code: string): RoomState | undefined {
    return rooms.get(code);
  },

  getRoomById(roomId: string): RoomState | undefined {
    return getRoomStateById(roomId);
  },

  getRoomCodeById(roomId: string): string | undefined {
    return roomsById.get(roomId);
  },

  updateRoom(roomId: string, data: Partial<RoomData>): RoomData | undefined {
    const state = getRoomStateById(roomId);
    if (!state) return undefined;
    Object.assign(state.room, data, { updatedAt: new Date() });
    return state.room;
  },

  deleteRoom(code: string): void {
    const state = rooms.get(code);
    if (state) {
      roomsById.delete(state.room.id);
      rooms.delete(code);
    }
  },

  // ---- Participant ----
  addParticipant(roomId: string, data: Partial<ParticipantData>): ParticipantData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const now = new Date();
    const participant: ParticipantData = {
      id: genId(),
      name: data.name || '',
      role: data.role || 'student',
      isBank: data.isBank || false,
      roomId,
      coinFile: data.coinFile || '{"propietari":"","saldo":10}',
      socketId: data.socketId || null,
      isActive: data.isActive ?? true,
      publicKey: data.publicKey || null,
      privateKey: data.privateKey || null,
      createdAt: now,
      updatedAt: now,
      isNodeDisconnected: data.isNodeDisconnected || false,
      blocksMinedCount: data.blocksMinedCount || 0,
      totalMiningReward: data.totalMiningReward || 0,
      hashAttempts: data.hashAttempts || 0,
      activeRigs: data.activeRigs ?? 0,
      rigSpeed: data.rigSpeed || 4,
      maxRigs: data.maxRigs || 1,
      allowUpgrade: data.allowUpgrade || false,
      simulationRole: data.simulationRole || 'both',
      simulationBalance: data.simulationBalance ?? 100,
      totalEnergySpent: data.totalEnergySpent || 0,
      poolId: data.poolId ?? null,
    };
    state.participants.set(participant.id, participant);
    return participant;
  },

  getParticipant(id: string): ParticipantData | undefined {
    for (const state of rooms.values()) {
      const p = state.participants.get(id);
      if (p) return p;
    }
    return undefined;
  },

  getParticipantWithRoom(id: string): { participant: ParticipantData; roomState: RoomState } | undefined {
    for (const state of rooms.values()) {
      const p = state.participants.get(id);
      if (p) return { participant: p, roomState: state };
    }
    return undefined;
  },

  updateParticipant(id: string, data: Partial<ParticipantData>): ParticipantData | undefined {
    const found = this.getParticipantWithRoom(id);
    if (!found) return undefined;
    Object.assign(found.participant, data, { updatedAt: new Date() });
    return found.participant;
  },

  getParticipantsByRoom(roomId: string): ParticipantData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.participants.values());
  },

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

  // ---- SignedMessage ----
  createSignedMessage(roomId: string, data: Partial<SignedMessageData>): SignedMessageData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const msg: SignedMessageData = {
      id: genId(),
      roomId,
      senderId: data.senderId || '',
      content: data.content || '',
      messageHash: data.messageHash || '',
      signature: data.signature || '',
      claimedBy: data.claimedBy || null,
      isFakeDemo: data.isFakeDemo || false,
      createdAt: new Date(),
    };
    state.signedMessages.set(msg.id, msg);
    return msg;
  },

  getSignedMessage(id: string): SignedMessageData | undefined {
    for (const state of rooms.values()) {
      const m = state.signedMessages.get(id);
      if (m) return m;
    }
    return undefined;
  },

  updateSignedMessage(id: string, data: Partial<SignedMessageData>): SignedMessageData | undefined {
    const msg = this.getSignedMessage(id);
    if (!msg) return undefined;
    Object.assign(msg, data);
    return msg;
  },

  getSignedMessagesByRoom(roomId: string): SignedMessageData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.signedMessages.values());
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

  // ---- Block ----
  createBlock(roomId: string, data: Partial<BlockData>): BlockData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const block: BlockData = {
      id: genId(),
      blockNumber: data.blockNumber || 0,
      roomId,
      previousHash: data.previousHash || '0000000000000000',
      nonce: data.nonce ?? null,
      hash: data.hash ?? null,
      minerId: data.minerId ?? null,
      reward: data.reward ?? 50,
      difficulty: data.difficulty ?? 2,
      miningTarget: data.miningTarget ?? 256,
      status: data.status || 'pending',
      transactions: data.transactions || '[]',
      hashAttempts: data.hashAttempts || 0,
      selectedTxIds: data.selectedTxIds || [],
      totalFees: data.totalFees || 0,
      poolId: data.poolId ?? null,
      rewardDistribution: data.rewardDistribution ?? null,
      createdAt: new Date(),
      minedAt: data.minedAt || null,
    };
    state.blocks.set(block.id, block);
    return block;
  },

  getBlock(id: string): BlockData | undefined {
    for (const state of rooms.values()) {
      const b = state.blocks.get(id);
      if (b) return b;
    }
    return undefined;
  },

  updateBlock(id: string, data: Partial<BlockData>): BlockData | undefined {
    const block = this.getBlock(id);
    if (!block) return undefined;
    Object.assign(block, data);
    return block;
  },

  getBlocksByRoom(roomId: string): BlockData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.blocks.values());
  },

  deleteBlocksByRoom(roomId: string): void {
    const state = getRoomStateById(roomId);
    if (state) state.blocks.clear();
  },

  // ---- MiningPool ----
  createMiningPool(roomId: string, data: { name: string; creatorId: string; colorHex: string }): MiningPoolData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const pool: MiningPoolData = {
      id: genId(),
      roomId,
      name: data.name,
      creatorId: data.creatorId,
      memberIds: [data.creatorId],
      colorHex: data.colorHex,
      createdAt: new Date(),
    };
    state.miningPools.set(pool.id, pool);
    // Set creator's poolId
    const creator = state.participants.get(data.creatorId);
    if (creator) creator.poolId = pool.id;
    return pool;
  },

  getMiningPool(poolId: string): MiningPoolData | undefined {
    for (const state of rooms.values()) {
      const pool = state.miningPools.get(poolId);
      if (pool) return pool;
    }
    return undefined;
  },

  getMiningPoolsByRoom(roomId: string): MiningPoolData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.miningPools.values());
  },

  joinMiningPool(poolId: string, participantId: string): MiningPoolData | undefined {
    for (const state of rooms.values()) {
      const pool = state.miningPools.get(poolId);
      if (pool) {
        if (!pool.memberIds.includes(participantId)) {
          pool.memberIds.push(participantId);
        }
        const participant = state.participants.get(participantId);
        if (participant) participant.poolId = poolId;
        return pool;
      }
    }
    return undefined;
  },

  leaveMiningPool(poolId: string, participantId: string): boolean {
    for (const state of rooms.values()) {
      const pool = state.miningPools.get(poolId);
      if (pool) {
        pool.memberIds = pool.memberIds.filter(id => id !== participantId);
        const participant = state.participants.get(participantId);
        if (participant) participant.poolId = null;
        // Delete pool if empty
        if (pool.memberIds.length === 0) {
          state.miningPools.delete(poolId);
        }
        return true;
      }
    }
    return false;
  },

  deleteMiningPool(poolId: string): boolean {
    for (const state of rooms.values()) {
      const pool = state.miningPools.get(poolId);
      if (pool) {
        // Reset all members' poolId
        for (const memberId of pool.memberIds) {
          const p = state.participants.get(memberId);
          if (p) p.poolId = null;
        }
        state.miningPools.delete(poolId);
        return true;
      }
    }
    return false;
  },

  deleteAllMiningPools(roomId: string): void {
    const state = getRoomStateById(roomId);
    if (!state) return;
    // Reset all participants' poolId
    for (const p of state.participants.values()) {
      p.poolId = null;
    }
    state.miningPools.clear();
  },
};
