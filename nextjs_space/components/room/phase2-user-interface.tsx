'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  User, CheckCircle, XCircle, Clock,
  Send, AlertCircle, HelpCircle
} from 'lucide-react';
import { Room, Participant, CoinFile } from '@/lib/types';

interface Phase2UserInterfaceProps {
  room: Room;
  participant: Participant;
  onProposeTransaction: (senderId: string, receiverId: string, amount: number, proposedById: string) => Promise<void>;
  onVote: (transactionId: string, vote: 'for' | 'against') => Promise<void>;
}

export default function Phase2UserInterface({
  room,
  participant,
  onProposeTransaction,
  onVote,
}: Phase2UserInterfaceProps) {
  const { t } = useTranslation();
  const [selectedSender, setSelectedSender] = useState<string>(participant.id);
  const [selectedReceiver, setSelectedReceiver] = useState<string>('');
  const [amount, setAmount] = useState<number>(1);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReflection, setShowReflection] = useState(false);

  const students = room.participants.filter(p => p.isActive);
  const otherUsers = students.filter(p => p.id !== selectedSender);

  // All voting proposals (multiple allowed)
  const votingProposals = room.transactions.filter(tx => tx.status === 'voting');
  const approvedTransactions = room.transactions.filter(tx => tx.status === 'approved')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const rejectedTransactions = room.transactions.filter(tx => tx.status === 'rejected')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getBalance = (p: Participant): number => {
    try {
      const coinFile: CoinFile = JSON.parse(p.coinFile);
      return coinFile.saldo;
    } catch {
      return 0;
    }
  };

  const myBalance = getBalance(participant);
  const totalVoters = students.length;

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handlePropose = async () => {
    if (!selectedReceiver || amount <= 0) {
      setFeedback({ type: 'error', message: t('selectRecipient') });
      return;
    }

    setIsSubmitting(true);
    try {
      await onProposeTransaction(selectedSender, selectedReceiver, amount, participant.id);

      if (selectedSender !== participant.id) {
        setFeedback({ type: 'warning', message: t('falseProposalWarning') });
      } else {
        setFeedback({ type: 'success', message: t('proposalSent') });
      }

      setAmount(1);
      setSelectedReceiver('');
      setSelectedSender(participant.id);
    } catch {
      setFeedback({ type: 'error', message: t('connectionError') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (transactionId: string, vote: 'for' | 'against') => {
    try {
      await onVote(transactionId, vote);
      setFeedback({ type: 'success', message: t('voteCast') });
    } catch {
      setFeedback({ type: 'error', message: t('connectionError') });
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-3 rounded-xl border text-sm ${
              feedback.type === 'success'
                ? 'bg-green-500/20 border-green-500/30 text-green-300'
                : feedback.type === 'error'
                ? 'bg-red-500/20 border-red-500/30 text-red-300'
                : 'bg-orange-500/20 border-orange-500/30 text-orange-300'
            }`}
          >
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 flex-1">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Balance + Form */}
          <div className="zone-card bg-surface">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-heading">{participant.name}</h3>
              <span className="ml-auto text-amber-500 font-bold text-lg">
                {t('availableBalance')}: {myBalance} ¢
              </span>
            </div>

            {/* Form row */}
            <div className="flex items-center gap-2">
              <select
                value={selectedSender}
                onChange={(e) => {
                  setSelectedSender(e.target.value);
                  if (e.target.value === selectedReceiver) setSelectedReceiver('');
                }}
                className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-amber-400 transition-colors bg-white dark:bg-zinc-800 dark:text-zinc-100 text-sm"
                disabled={isSubmitting}
              >
                {students.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({getBalance(p)}¢)
                  </option>
                ))}
              </select>

              <select
                value={selectedReceiver}
                onChange={(e) => setSelectedReceiver(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-amber-400 transition-colors bg-white dark:bg-zinc-800 dark:text-zinc-100 text-sm"
                disabled={isSubmitting}
              >
                <option value="">-- {t('recipient')} --</option>
                {otherUsers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="!w-16 flex-shrink-0 px-2 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-amber-400 transition-colors bg-white dark:bg-zinc-800 dark:text-zinc-100 text-sm text-center"
                disabled={isSubmitting}
              />

              <button
                onClick={handlePropose}
                disabled={isSubmitting || !selectedReceiver}
                className="p-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {selectedSender !== participant.id && (
              <p className="text-xs text-orange-400 flex items-center gap-1 mt-2">
                <AlertCircle className="w-3 h-3" />
                {t('falseProposalWarning')}
              </p>
            )}
          </div>

          {/* Pending Votations */}
          <div className="zone-card bg-surface flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-heading">{t('pendingVotations')}</h3>
              <button
                onClick={() => setShowReflection(!showReflection)}
                className="ml-auto p-1 text-muted hover:text-body transition-colors"
                title={t('consensusQuestion')}
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>

            {showReflection && (
              <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-300">
                {t('consensusQuestion')}
              </div>
            )}

            {votingProposals.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">{t('noPendingVotations')}</p>
            ) : (
              <div className="space-y-2">
                {votingProposals.map((tx) => {
                  const hasVoted = tx.voterIds?.includes(participant.id) || false;
                  const senderBalance = (() => {
                    const s = students.find(p => p.id === tx.senderId);
                    return s ? getBalance(s) : 0;
                  })();
                  const pending = totalVoters - tx.votesFor - tx.votesAgainst;

                  return (
                    <div key={tx.id} className="flex items-center gap-2 p-2 bg-surface-alt rounded-lg text-sm flex-wrap">
                      <span className="text-body font-medium">
                        {tx.sender?.name} → {tx.receiver?.name}: {tx.amount}
                      </span>
                      <span className="text-muted">({t('availableBalance')}: {senderBalance})</span>

                      <span className="flex items-center gap-0.5 text-green-500">
                        <CheckCircle className="w-3.5 h-3.5" />{tx.votesFor}
                      </span>
                      <span className="flex items-center gap-0.5 text-red-500">
                        <XCircle className="w-3.5 h-3.5" />{tx.votesAgainst}
                      </span>
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <Clock className="w-3.5 h-3.5" />{pending}
                      </span>

                      {hasVoted ? (
                        <span className="text-xs text-muted ml-auto">{t('voted')}</span>
                      ) : (
                        <span className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => handleVote(tx.id, 'for')}
                            className="p-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-500 rounded transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleVote(tx.id, 'against')}
                            className="p-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-500 rounded transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Accepted Transactions */}
          <div className="zone-card bg-surface flex-1">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <h3 className="font-semibold text-heading">{t('acceptedTransactions')}</h3>
            </div>

            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {approvedTransactions.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">{t('noTransactionsYet')}</p>
              ) : (
                approvedTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-2 p-1.5 text-sm">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span className="text-body">
                      {tx.sender?.name} → {tx.receiver?.name}: {tx.amount}
                    </span>
                    <span className="text-muted text-xs ml-auto">
                      (✓{tx.votesFor} ✗{tx.votesAgainst})
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Rejected Transactions */}
          <div className="zone-card bg-surface flex-1">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-red-500" />
              <h3 className="font-semibold text-heading">{t('rejectedTransactions')}</h3>
            </div>

            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {rejectedTransactions.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">{t('noTransactionsYet')}</p>
              ) : (
                rejectedTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-2 p-1.5 text-sm">
                    <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <span className="text-body">
                      {tx.sender?.name} → {tx.receiver?.name}: {tx.amount}
                    </span>
                    <span className="text-muted text-xs ml-auto">
                      (✓{tx.votesFor} ✗{tx.votesAgainst})
                    </span>
                    {tx.rejectReason && (
                      <span className="text-xs text-red-400">
                        — {tx.rejectReason}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
