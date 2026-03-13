export interface CoinFile {
  propietari: string;
  saldo: number;
}

export interface Participant {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  isBank: boolean;
  roomId: string;
  coinFile: string;
  socketId?: string;
  isActive: boolean;
  // Phase 3: Cryptographic keys
  publicKey?: string;
  privateKey?: string;
  // Phase 5: Node network
  isNodeDisconnected?: boolean;
  // Phase 6: Mining stats
  blocksMinedCount?: number;
  totalMiningReward?: number;
  hashAttempts?: number;
  // Phase 7: Auto-mining rig settings
  activeRigs?: number;       // 1-3
  rigSpeed?: number;         // 4, 8, or 20 h/s
  maxRigs?: number;          // 1-3, per-student control
  allowUpgrade?: boolean;    // per-student control
  // Phase 9: Free simulation
  simulationRole?: 'user' | 'miner' | 'both';
  simulationBalance?: number;
  totalEnergySpent?: number;
  // Phase 7: Mining pools
  poolId?: string | null;
}

export interface Transaction {
  id: string;
  roomId: string;
  senderId: string;
  receiverId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'voting';
  rejectReason?: string;
  isHighlighted: boolean;
  isFlagged: boolean;
  // Phase 2: Voting fields
  proposedById?: string;
  votesFor: number;
  votesAgainst: number;
  voterIds: string[];
  createdAt: string;
  sender?: Participant;
  receiver?: Participant;
}

export interface Room {
  id: string;
  code: string;
  currentPhase: number;
  unlockedPhases: number[];
  isBankDisconnected: boolean;
  maxTransferAmount: number;
  // Phase 7: Difficulty adjustment settings
  difficultyAdjustmentInterval: number;
  targetBlockTime: number;
  currentDifficulty: number;
  // Phase 8: Economic incentives (halving & fees)
  halvingInterval: number;
  currentBlockReward: number;
  totalBtcEmitted: number;
  // Phase 5: Network control
  studentSendingEnabled?: boolean;
  // Phase 7: Target-based difficulty (granular)
  miningTarget?: number;     // hash target (first 4 hex chars < target). Lower = harder.
  // Phase 9: Free simulation
  activeChallenge?: string | null;
  challengeData?: string | null;
  simulationStarted?: boolean;
  // Phase 7: Mining pools
  poolsEnabled?: boolean;
  // Phase 8: Auto-mining settings
  autoMineInterval?: number;   // seconds between auto-mined blocks
  autoMineCapacity?: number;   // max tx per auto-mined block
  participants: Participant[];
  transactions: Transaction[];
}

export interface PhaseInfo {
  id: number;
  name: string;
  status: 'completed' | 'current' | 'locked';
}

// Phase 3: Signed messages
export interface SignedMessage {
  id: string;
  roomId: string;
  senderId: string;
  sender?: Participant;
  content: string;
  messageHash: string;
  signature: string;
  claimedBy?: string;
  isFakeDemo: boolean;
  createdAt: string;
}

// Phase 4: UTXO (Unspent Transaction Output)
export interface UTXO {
  id: string;
  utxoId: string; // Human-readable ID like UTXO#A1
  roomId: string;
  ownerId: string;
  owner?: Participant;
  amount: number;
  isSpent: boolean;
  spentInTxId?: string | null;
  createdInTxId?: string | null;
  createdAt: string;
}

// Phase 4: UTXO Transaction output
export interface UTXOOutput {
  recipientId: string;
  recipientName: string;
  amount: number;
  newUtxoId: string;
}

// Phase 4: UTXO-based transaction
export interface UTXOTransaction {
  id: string;
  txId: string; // Human-readable ID like TX#1
  roomId: string;
  senderId: string;
  sender?: Participant;
  inputUtxoIds: string[];
  outputs: UTXOOutput[];
  totalInput: number;
  totalOutput: number;
  signature?: string;
  isValid: boolean;
  invalidReason?: string | null;
  createdAt: string;
}

// Phase 5: Mempool transaction
// Edge in the propagation plan — describes one hop of the BFS
export interface PropagationEdge {
  fromNodeId: string;
  toNodeId: string;
  startTime: number;  // absolute timestamp (ms) when pulse begins
  duration: number;    // ms for pulse to travel this edge
  redundant?: boolean; // true if toNode already had the TX (realistic: node still sends it)
}

export interface MempoolTransaction {
  id: string;
  txId: string;
  roomId: string;
  senderId: string;
  sender?: Participant;
  receiverId: string;
  receiver?: Participant;
  amount: number;
  fee: number;
  status: 'propagating' | 'in_mempool' | 'confirmed';
  propagatedTo: string[];
  propagationProgress: number;
  propagationEdges?: PropagationEdge[];
  propagationColor?: string;  // unique color for this TX's animation
  createdAt: string;
}

// Phase 5: Node connection
export interface NodeConnection {
  id: string;
  roomId: string;
  nodeAId: string;
  nodeBId: string;
  isActive: boolean;
  createdAt: string;
}

// Phase 6: Block transaction summary (simplified for display)
export interface BlockTransaction {
  sender: string;
  receiver: string;
  amount: number;
}

// Phase 6: Blockchain block for Proof of Work
export interface Block {
  id: string;
  blockNumber: number;
  roomId: string;
  previousHash: string;
  nonce?: number | null;
  hash?: string | null;
  minerId?: string | null;
  miner?: Participant | null;
  reward: number;
  difficulty: number;
  miningTarget?: number;     // Phase 7+: target-based difficulty
  status: 'pending' | 'mining' | 'mined';
  transactions: BlockTransaction[];
  transactionsRaw?: string;   // Raw JSON string for client-side hashing
  hashAttempts: number;
  // Phase 8: Economic incentives
  selectedTxIds: string[];
  totalFees: number;
  // Phase 7: Mining pools
  poolId?: string | null;
  rewardDistribution?: RewardShare[] | null;
  createdAt: string;
  minedAt?: string | null;
}

// Phase 8: Halving info
export interface HalvingInfo {
  currentBlockReward: number;
  halvingInterval: number;
  blocksUntilNextHalving: number;
  halvingNumber: number;
  nextReward: number;
  totalBtcEmitted: number;
  maxBtc: number; // 21 million simulated
}

// Phase 8: Economic statistics
export interface EconomicStats {
  averageFee: number;
  totalFeesPaid: number;
  totalBlockRewardsPaid: number;
  minerEarnings: { minerId: string; minerName: string; blockRewards: number; fees: number; total: number }[];
}

// Phase 6: Mining state for local UI
export interface MiningState {
  currentNonce: number;
  lastHash: string;
  isValidHash: boolean;
  attempts: number;
}

// Phase 7: Difficulty adjustment period info
export interface DifficultyPeriod {
  periodNumber: number;
  startBlock: number;
  endBlock: number;
  blocksMinedInPeriod: number;
  totalTimeSeconds: number;
  avgTimePerBlock: number;
  targetTimePerBlock: number;
  difficulty: number;
  adjustmentResult?: 'increased' | 'decreased' | 'stable';
}

// Phase 9: Bitcoin Address (pseudonymity)
export interface BitcoinAddress {
  id: string;
  address: string;      // "bc1q" + 6 random alphanumeric lowercase
  roomId: string;
  ownerId: string;      // participant ID
  createdAt: string;
}

// Phase 9: Address-based UTXO
export interface Phase9UTXO {
  id: string;
  utxoId: string;       // e.g. "UTXO#1"
  roomId: string;
  address: string;      // the bc1q... address that owns this
  ownerId: string;      // participant ID (for lookup convenience, empty if burned)
  amount: number;
  isSpent: boolean;
  spentInTxId: string | null;
  createdInTxId: string | null;
  createdAt: string;
}

// Phase 9: Transaction output (address-based)
export interface Phase9TxOutput {
  address: string;      // destination bc1q... address
  amount: number;
  isChange: boolean;    // auto-generated change output
  newUtxoId: string;    // UTXO ID created by this output
}

// Phase 9: Address-based mempool transaction
export interface Phase9MempoolTransaction {
  id: string;
  txId: string;         // e.g. "TX#1"
  roomId: string;
  senderParticipantId: string;  // who created it (for highlighting own TXs)
  inputUtxoIds: string[];       // UTXO IDs consumed
  inputs: { address: string; amount: number }[];  // for display
  outputs: Phase9TxOutput[];
  totalInput: number;
  totalOutput: number;
  fee: number;          // totalInput - totalOutput
  status: 'in_mempool' | 'confirmed';
  createdAt: string;
}

// Phase 9 (legacy — will be removed when UI is rewritten)
export type ChallengeType = '51_attack' | 'congestion' | 'fork' | 'economy' | 'environment' | null;
export interface SimulationStats {
  totalBlocks: number;
  totalTransactions: number;
  btcInCirculation: number;
  totalHashrate: number;
  totalEnergySpent: number;
  wealthDistribution: { participantId: string; name: string; balance: number }[];
  difficultyHistory: { blockNumber: number; difficulty: number }[];
  transactionVolume: { timestamp: string; count: number }[];
}
export interface ChallengeData {
  type: ChallengeType;
  startedAt?: string;
  attackingGroup?: string[];
  honestGroup?: string[];
  alternativeChainLength?: number;
  mainChainLength?: number;
  forkBlockNumber?: number;
  forkDetected?: boolean;
  congestionLevel?: number;
}

// Phase 7: Mining Pools
export interface MiningPool {
  id: string;
  roomId: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  members?: Participant[];
  colorHex: string;
  totalHashrate: number;
  createdAt: string;
}

export interface RewardShare {
  participantId: string;
  participantName: string;
  hashrate: number;
  sharePercent: number;
  amount: number;
}

export type SocketEventType =
  | 'join-room'
  | 'leave-room'
  | 'participant-joined'
  | 'participant-left'
  | 'send-transaction'
  | 'new-transaction'
  | 'update-coin-file'
  | 'coin-file-updated'
  | 'highlight-transaction'
  | 'transaction-highlighted'
  | 'advance-phase'
  | 'phase-advanced'
  | 'unlock-phase'
  | 'phase-unlocked'
  | 'force-navigation'
  | 'navigated-to-phase'
  | 'room-state'
  | 'error';
