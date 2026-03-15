import { getParticipantTransactions, filterByStatus, getPendingVotes } from './transaction-utils';
import type { Transaction } from './types';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx1',
    roomId: 'r1',
    senderId: 'alice',
    receiverId: 'bob',
    amount: 5,
    status: 'approved',
    isHighlighted: false,
    isFlagged: false,
    votesFor: 0,
    votesAgainst: 0,
    voterIds: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('getParticipantTransactions', () => {
  const txs = [
    makeTx({ id: 'tx1', senderId: 'alice', receiverId: 'bob' }),
    makeTx({ id: 'tx2', senderId: 'bob', receiverId: 'carol' }),
    makeTx({ id: 'tx3', senderId: 'carol', receiverId: 'alice' }),
    makeTx({ id: 'tx4', senderId: 'dave', receiverId: 'carol' }),
  ];

  it('returns transactions where participant is sender', () => {
    const result = getParticipantTransactions(txs, 'alice');
    expect(result.map(t => t.id)).toContain('tx1');
  });

  it('returns transactions where participant is receiver', () => {
    const result = getParticipantTransactions(txs, 'alice');
    expect(result.map(t => t.id)).toContain('tx3');
  });

  it('returns all matching transactions', () => {
    const result = getParticipantTransactions(txs, 'alice');
    expect(result).toHaveLength(2);
  });

  it('returns empty array for unknown participant', () => {
    expect(getParticipantTransactions(txs, 'unknown')).toHaveLength(0);
  });

  it('handles empty transaction list', () => {
    expect(getParticipantTransactions([], 'alice')).toHaveLength(0);
  });
});

describe('filterByStatus', () => {
  const txs = [
    makeTx({ id: 'tx1', status: 'approved' }),
    makeTx({ id: 'tx2', status: 'pending' }),
    makeTx({ id: 'tx3', status: 'voting' }),
    makeTx({ id: 'tx4', status: 'approved' }),
    makeTx({ id: 'tx5', status: 'rejected' }),
  ];

  it('filters approved transactions', () => {
    const result = filterByStatus(txs, 'approved');
    expect(result).toHaveLength(2);
    expect(result.every(t => t.status === 'approved')).toBe(true);
  });

  it('filters pending transactions', () => {
    expect(filterByStatus(txs, 'pending')).toHaveLength(1);
  });

  it('filters voting transactions', () => {
    expect(filterByStatus(txs, 'voting')).toHaveLength(1);
  });

  it('filters rejected transactions', () => {
    expect(filterByStatus(txs, 'rejected')).toHaveLength(1);
  });

  it('returns empty array when no match', () => {
    const allApproved = [makeTx({ status: 'approved' })];
    expect(filterByStatus(allApproved, 'rejected')).toHaveLength(0);
  });
});

describe('getPendingVotes', () => {
  const txs = [
    makeTx({ id: 'tx1', status: 'voting', voterIds: ['alice'] }),
    makeTx({ id: 'tx2', status: 'voting', voterIds: ['bob'] }),
    makeTx({ id: 'tx3', status: 'voting', voterIds: ['alice', 'bob'] }),
    makeTx({ id: 'tx4', status: 'approved', voterIds: [] }),
    makeTx({ id: 'tx5', status: 'voting', voterIds: [] }),
  ];

  it('returns voting transactions where participant has not voted', () => {
    const result = getPendingVotes(txs, 'alice');
    expect(result.map(t => t.id)).toEqual(['tx2', 'tx5']);
  });

  it('excludes transactions participant already voted on', () => {
    const result = getPendingVotes(txs, 'alice');
    expect(result.map(t => t.id)).not.toContain('tx1');
    expect(result.map(t => t.id)).not.toContain('tx3');
  });

  it('excludes non-voting transactions', () => {
    const result = getPendingVotes(txs, 'dave');
    expect(result.map(t => t.id)).not.toContain('tx4');
  });

  it('returns all voting transactions for a new participant', () => {
    const result = getPendingVotes(txs, 'newbie');
    expect(result).toHaveLength(4); // tx1, tx2, tx3, tx5
  });

  it('handles empty list', () => {
    expect(getPendingVotes([], 'alice')).toHaveLength(0);
  });
});
