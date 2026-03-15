'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  HelpCircle,
  User,
  CheckCircle,
  XCircle,
  Clock,
  Send,
} from 'lucide-react';
import { Transaction, Participant, CoinFile } from '@/lib/types';
import { useRoom } from '@/contexts/room-context';

export default function TeacherPhase2Controls() {
  const { t } = useTranslation();
  const {
    room,
    forceTransaction,
    voteOnTransaction,
    sendTransaction,
    participant,
  } = useRoom();

  const [selectedSender, setSelectedSender] = useState<string>('');
  const [selectedReceiver, setSelectedReceiver] = useState<string>('');
  const [txAmount, setTxAmount] = useState<number>(1);
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txFeedback, setTxFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [processingTx, setProcessingTx] = useState<string | null>(null);

  const transactions = room?.transactions ?? [];
  const students = (room?.participants ?? []).filter((p) => p.role === 'student' && p.isActive);

  const votingTransactions = transactions.filter((tx) => tx.status === 'voting');
  const approvedTransactions = transactions.filter((tx) => tx.status === 'approved');
  const rejectedTransactions = transactions.filter((tx) => tx.status === 'rejected');

  const censorshipActs = rejectedTransactions.filter((tx) => {
    const senderBalance = 10 - transactions
      .filter((t) => t.senderId === tx.senderId && t.status === 'approved' && new Date(t.createdAt) < new Date(tx.createdAt))
      .reduce((sum, t) => sum + (t.amount ?? 0), 0)
      + transactions
      .filter((t) => t.receiverId === tx.senderId && t.status === 'approved' && new Date(t.createdAt) < new Date(tx.createdAt))
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    return senderBalance >= (tx.amount ?? 0);
  }).length;

  const teacherParticipant = room?.participants?.find(p => p.role === 'teacher');
  const allParticipants = (room?.participants ?? []).filter(p => p.isActive);
  const teacherBalance = (() => {
    if (!teacherParticipant?.coinFile) return 10;
    try { return (JSON.parse(teacherParticipant.coinFile) as CoinFile)?.saldo ?? 10; } catch { return 10; }
  })();
  const getBalance = (p: Participant): number => {
    try { return (JSON.parse(p.coinFile) as CoinFile)?.saldo ?? 0; } catch { return 0; }
  };
  const totalVoters = students.length;
  const otherUsers = allParticipants.filter(p => p.id !== selectedSender);

  const handlePropose = async () => {
    if (!selectedReceiver || txAmount <= 0 || !teacherParticipant) return;
    const sender = selectedSender || teacherParticipant.id;
    setTxSubmitting(true);
    try {
      await sendTransaction(selectedReceiver, txAmount, 2, sender, teacherParticipant.id);
      if (sender !== teacherParticipant.id) {
        setTxFeedback({ type: 'warning', message: t('falseProposalWarning') });
      } else {
        setTxFeedback({ type: 'success', message: t('proposalSent') });
      }
      setTxAmount(1);
      setSelectedReceiver('');
      setSelectedSender(teacherParticipant.id);
    } catch {
      setTxFeedback({ type: 'error', message: t('connectionError') });
    } finally {
      setTxSubmitting(false);
      setTimeout(() => setTxFeedback(null), 5000);
    }
  };

  // Initialize selectedSender to teacher if empty
  if (!selectedSender && teacherParticipant) {
    setSelectedSender(teacherParticipant.id);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Feedback */}
      <AnimatePresence>
        {txFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-3 rounded-xl border text-sm ${
              txFeedback.type === 'success'
                ? 'bg-green-500/20 border-green-500/30 text-green-300'
                : txFeedback.type === 'error'
                ? 'bg-red-500/20 border-red-500/30 text-red-300'
                : 'bg-orange-500/20 border-orange-500/30 text-orange-300'
            }`}
          >
            {txFeedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4">
          {/* Balance + Form */}
          <div className="zone-card bg-surface">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-heading">{teacherParticipant?.name ?? 'Professor'}</h3>
              <span className="ml-auto text-amber-500 font-bold text-lg">
                {t('availableBalance')}: {teacherBalance} ¢
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
                disabled={txSubmitting}
              >
                {allParticipants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({getBalance(p)}¢)
                  </option>
                ))}
              </select>

              <select
                value={selectedReceiver}
                onChange={(e) => setSelectedReceiver(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-amber-400 transition-colors bg-white dark:bg-zinc-800 dark:text-zinc-100 text-sm"
                disabled={txSubmitting}
              >
                <option value="">-- {t('recipient')} --</option>
                {otherUsers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                value={txAmount}
                onChange={(e) => setTxAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="!w-16 flex-shrink-0 px-2 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-amber-400 transition-colors bg-white dark:bg-zinc-800 dark:text-zinc-100 text-sm text-center"
                disabled={txSubmitting}
              />

              <button
                onClick={handlePropose}
                disabled={txSubmitting || !selectedReceiver}
                className="p-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {teacherParticipant && selectedSender !== teacherParticipant.id && (
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

            {votingTransactions.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">{t('noPendingVotations')}</p>
            ) : (
              <div className="space-y-2">
                {votingTransactions.map((tx) => {
                  const senderBalance = (() => {
                    const s = allParticipants.find(p => p.id === tx.senderId);
                    return s ? getBalance(s) : 0;
                  })();
                  const pending = totalVoters - tx.votesFor - tx.votesAgainst;
                  const hasVoted = tx.voterIds?.includes(teacherParticipant?.id ?? '') || false;

                  return (
                    <div key={tx.id} className="p-2 bg-surface-alt rounded-lg text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
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
                      </div>

                      <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                        {/* Normal vote buttons */}
                        <button
                          onClick={() => voteOnTransaction(tx.id, 'for')}
                          disabled={hasVoted}
                          className="p-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-500 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => voteOnTransaction(tx.id, 'against')}
                          disabled={hasVoted}
                          className="p-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-500 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        {hasVoted && (
                          <span className="text-xs text-muted">{t('voted')}</span>
                        )}
                        {/* Force buttons (teacher-only) */}
                        <button
                          onClick={() => forceTransaction(tx.id, 'accept')}
                          disabled={processingTx === tx.id}
                          className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1 ml-auto"
                        >
                          <CheckCircle className="w-3 h-3" /> {t('forceAccept')}
                        </button>
                        <button
                          onClick={() => forceTransaction(tx.id, 'reject')}
                          disabled={processingTx === tx.id}
                          className="px-2 py-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> {t('forceReject')}
                        </button>
                      </div>
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
