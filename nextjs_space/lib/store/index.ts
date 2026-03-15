// Re-export all types so consumers can import from '@/lib/store'
export type {
  RoomData,
  ParticipantData,
  TransactionData,
  SignedMessageData,
  UTXOData,
  UTXOTransactionData,
  PropagationEdgeData,
  MempoolTransactionData,
  NodeConnectionData,
  BlockData,
  MiningPoolData,
  Phase9AddressData,
  Phase9UTXOData,
  Phase9TxOutputData,
  Phase9MempoolTxData,
  RoomState,
} from './types';

import { roomStore } from './room-store';
import { txStore } from './tx-store';
import { blockStore } from './block-store';
import { networkStore } from './network-store';
import { cryptoStore } from './crypto-store';
import { phase9Store } from './phase9-store';

// Compose the unified store object matching the original API exactly
export const store = {
  // Room & Participants
  ...roomStore,
  // Transactions & UTXOs
  ...txStore,
  // Blocks & Mining Pools
  ...blockStore,
  // Network connections & Mempool
  ...networkStore,
  // Signed messages (crypto)
  ...cryptoStore,
  // Phase 9
  ...phase9Store,
};
