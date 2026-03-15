import type { Transaction } from './types';

export function getParticipantTransactions(txs: Transaction[], participantId: string): Transaction[] {
  return txs.filter(tx => tx.senderId === participantId || tx.receiverId === participantId);
}

export function filterByStatus(txs: Transaction[], status: Transaction['status']): Transaction[] {
  return txs.filter(tx => tx.status === status);
}

export function getPendingVotes(txs: Transaction[], participantId: string): Transaction[] {
  return txs.filter(tx =>
    tx.status === 'voting' &&
    !tx.voterIds?.includes(participantId)
  );
}
