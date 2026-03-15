// Shared types for BitQuest in-memory store

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
  autoMineInterval: number;   // Phase 8: seconds between auto-mined blocks (15-60)
  autoMineCapacity: number;   // Phase 8: max tx per auto-mined block (2-5)
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

// Phase 9: Bitcoin Address
export interface Phase9AddressData {
  id: string;
  address: string;      // "bc1q" + 6 random alphanumeric lowercase
  roomId: string;
  ownerId: string;      // participant ID
  createdAt: Date;
}

// Phase 9: Address-based UTXO
export interface Phase9UTXOData {
  id: string;
  utxoId: string;       // e.g. "UTXO#1"
  roomId: string;
  address: string;      // the bc1q... address that owns this
  ownerId: string;      // participant ID (empty string if burned)
  amount: number;
  isSpent: boolean;
  spentInTxId: string | null;
  createdInTxId: string | null;
  createdAt: Date;
}

// Phase 9: Transaction output
export interface Phase9TxOutputData {
  address: string;
  amount: number;
  isChange: boolean;
  newUtxoId: string;
}

// Phase 9: Address-based mempool transaction
export interface Phase9MempoolTxData {
  id: string;
  txId: string;
  roomId: string;
  senderParticipantId: string;
  inputUtxoIds: string[];
  inputs: { address: string; amount: number }[];
  outputs: Phase9TxOutputData[];
  totalInput: number;
  totalOutput: number;
  fee: number;
  status: string;       // 'in_mempool' | 'confirmed'
  createdAt: Date;
}

// ============ Room State ============

export interface RoomState {
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
  // Phase 9: Address-based pseudonymity
  phase9Addresses: Map<string, Phase9AddressData>;
  phase9Utxos: Map<string, Phase9UTXOData>;
  phase9MempoolTxs: Map<string, Phase9MempoolTxData>;
}

// ============ Global Store ============
// Use globalThis to persist across Next.js HMR reloads in dev mode

declare global {
  // eslint-disable-next-line no-var
  var __bitquest_rooms: Map<string, RoomState> | undefined;
  // eslint-disable-next-line no-var
  var __bitquest_roomsById: Map<string, string> | undefined;
}

const globalForStore = globalThis as unknown as {
  __bitquest_rooms?: Map<string, RoomState>;
  __bitquest_roomsById?: Map<string, string>;
};

export const rooms = globalForStore.__bitquest_rooms ?? new Map<string, RoomState>();
export const roomsById = globalForStore.__bitquest_roomsById ?? new Map<string, string>();

if (process.env.NODE_ENV !== 'production') {
  globalForStore.__bitquest_rooms = rooms;
  globalForStore.__bitquest_roomsById = roomsById;
}

// ============ Shared Helpers ============

import { randomUUID } from 'crypto';

export function genId(): string {
  return randomUUID();
}

export function getRoomStateById(roomId: string): RoomState | undefined {
  const code = roomsById.get(roomId);
  if (!code) return undefined;
  return rooms.get(code);
}

export function createRoomState(code: string): RoomState {
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
      autoMineInterval: 20,
      autoMineCapacity: 3,
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
    // Phase 9
    phase9Addresses: new Map(),
    phase9Utxos: new Map(),
    phase9MempoolTxs: new Map(),
  };
}
