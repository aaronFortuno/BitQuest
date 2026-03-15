// This file re-exports from lib/store/ for backwards compatibility.
// The actual implementation is split into domain-specific modules under lib/store/.
export { store } from './store/index';
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
} from './store/index';
