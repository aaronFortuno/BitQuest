'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  AlertTriangle,
  Eye,
  Star,
  Landmark,
  Unplug,
  Plug,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Transaction, Participant, CoinFile } from '@/lib/types';
import { useRoom } from '@/contexts/room-context';

export default function TeacherPhase1Controls() {
  const { t } = useTranslation();
  const {
    room,
    highlightTransaction,
    approveTransaction,
    rejectTransaction,
    toggleBankDisconnection,
    updateTransferLimit,
    updateParticipantCoinFile,
  } = useRoom();

  const [processingTx, setProcessingTx] = useState<string | null>(null);
  const [editingBalances, setEditingBalances] = useState<Record<string, string>>({});

  const transactions = room?.transactions ?? [];
  const students = (room?.participants ?? []).filter((p) => p.role === 'student' && p.isActive);
  const isBankDisconnected = room?.isBankDisconnected ?? false;

  const pendingTransactions = transactions.filter((tx) => tx.status === 'pending');
  const approvedTransactions = transactions.filter((tx) => tx.status === 'approved');
  const rejectedTransactions = transactions.filter((tx) => tx.status === 'rejected');

  const sortedTransactions = useMemo(() =>
    [...transactions].sort((a, b) =>
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
    ), [transactions]);

  const isTransactionSuspicious = (tx: Transaction): boolean => {
    const txIndex = sortedTransactions.findIndex(t => t.id === tx.id);
    const previousTxs = sortedTransactions.slice(0, txIndex);

    let senderBalance = 10;
    for (const prevTx of previousTxs) {
      if (prevTx.status !== 'approved') continue;
      if (prevTx.senderId === tx.senderId) {
        senderBalance -= prevTx.amount ?? 0;
      }
      if (prevTx.receiverId === tx.senderId) {
        senderBalance += prevTx.amount ?? 0;
      }
    }

    return senderBalance < (tx.amount ?? 0);
  };

  const getStudentStats = (student: Participant) => {
    const sent = transactions.filter((tx) => tx.senderId === student.id && tx.status === 'approved');
    const received = transactions.filter((tx) => tx.receiverId === student.id && tx.status === 'approved');
    const totalSent = sent.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);
    const totalReceived = received.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

    const calculatedBalance = 10 - totalSent + totalReceived;

    let currentBalance = 10;
    try {
      const coinFile = JSON.parse(student.coinFile ?? '{}') as CoinFile;
      currentBalance = coinFile?.saldo ?? 10;
    } catch {}

    const discrepancy = currentBalance !== calculatedBalance;
    const hasOverspent = sent.some(tx => isTransactionSuspicious(tx));

    return {
      transactionCount: sent.length,
      totalSent,
      totalReceived,
      claimedBalance: currentBalance,
      calculatedBalance,
      discrepancy,
      hasOverspent,
    };
  };

  const getSenderBalance = (tx: Transaction): number => {
    const sender = students.find((s) => s.id === tx.senderId);
    if (!sender?.coinFile) return 10;
    try {
      const coinFile = JSON.parse(sender.coinFile) as CoinFile;
      return coinFile?.saldo ?? 10;
    } catch {
      return 10;
    }
  };

  const handleApprove = async (txId: string) => {
    setProcessingTx(txId);
    await approveTransaction(txId);
    setProcessingTx(null);
  };

  const handleReject = async (txId: string, hasSufficientBalance: boolean) => {
    setProcessingTx(txId);
    const reason = hasSufficientBalance ? t('censorship') : t('insufficientFunds');
    await rejectTransaction(txId, reason);
    setProcessingTx(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Bank Panel + Pending Queue + Bank Accounts */}
      <div className="space-y-6">
        {/* Bank Control Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card phase-panel-emerald"
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-heading">{t('bankPanel')}</h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => toggleBankDisconnection(!isBankDisconnected)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isBankDisconnected
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {isBankDisconnected ? (
                  <><Plug className="w-3.5 h-3.5" /> {t('reconnectBank')}</>
                ) : (
                  <><Unplug className="w-3.5 h-3.5" /> {t('closeBank')}</>
                )}
              </button>

              <div className="flex items-center gap-1.5">
                <label className="text-sm text-secondary whitespace-nowrap">{t('transferLimit')}:</label>
                <input
                  type="number"
                  min="1"
                  value={room?.maxTransferAmount ?? 5}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val > 0) updateTransferLimit(val);
                  }}
                  className="input-field w-12 text-center py-1"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Pending Transactions Queue */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="zone-card"
        >
          <h3 className="font-medium text-heading mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            {t('pendingRequests')}
            {pendingTransactions.length > 0 && (
              <span className="px-2 py-0.5 badge-amber rounded-full text-xs font-medium">
                {pendingTransactions.length}
              </span>
            )}
          </h3>
          {pendingTransactions.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pendingTransactions.map((tx) => {
                const senderBalance = getSenderBalance(tx);
                const hasSufficientBalance = senderBalance >= (tx.amount ?? 0);
                const isProcessing = processingTx === tx.id;

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-surface rounded-lg border border-amber-200 dark:border-amber-500/30 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-body">{tx.sender?.name}</span>
                        <span className="text-faint">→</span>
                        <span className="font-medium text-body">{tx.receiver?.name}</span>
                        <span className="text-amber-600 font-bold">{tx.amount} <i className="fa-solid fa-cent-sign" /></span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        hasSufficientBalance
                          ? 'badge-green'
                          : 'badge-red'
                      }`}>
                        {hasSufficientBalance ? t('sufficientBalance') : t('insufficientBalance')}
                        {' '}({senderBalance})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(tx.id)}
                        disabled={isProcessing || isBankDisconnected}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {t('approve')}
                      </button>
                      <button
                        onClick={() => handleReject(tx.id, hasSufficientBalance)}
                        disabled={isProcessing || isBankDisconnected}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 dark:disabled:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {t('reject')}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted py-4 bg-surface rounded-lg">
              {t('noPendingRequests')}
            </p>
          )}
        </motion.div>

        {/* Bank Accounts Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="zone-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-heading">{t('bankAccounts')}</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-default">
                  <th className="text-left py-2 px-2 font-medium text-secondary">Nom</th>
                  <th className="text-center py-2 px-2 font-medium text-secondary">TX</th>
                  <th className="text-center py-2 px-2 font-medium text-secondary">Enviat</th>
                  <th className="text-center py-2 px-2 font-medium text-secondary">Rebut</th>
                  <th className="text-center py-2 px-2 font-medium text-secondary">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const stats = getStudentStats(student);
                  const editVal = editingBalances[student.id];
                  const displayBalance = editVal !== undefined ? editVal : String(stats.claimedBalance);

                  const commitBalance = (val: string) => {
                    const num = parseInt(val);
                    if (!isNaN(num)) {
                      try {
                        const coinFile = JSON.parse(student.coinFile ?? '{}');
                        coinFile.saldo = num;
                        updateParticipantCoinFile(student.id, JSON.stringify(coinFile));
                      } catch {
                        updateParticipantCoinFile(student.id, JSON.stringify({ propietari: student.name, saldo: num }));
                      }
                    }
                    setEditingBalances(prev => {
                      const next = { ...prev };
                      delete next[student.id];
                      return next;
                    });
                  };

                  return (
                    <tr key={student.id} className="border-b border-subtle hover:bg-surface-alt">
                      <td className="py-2 px-2 font-medium text-heading">{student.name}</td>
                      <td className="py-2 px-2 text-center text-secondary">{stats.transactionCount}</td>
                      <td className="py-2 px-2 text-center text-secondary">{stats.totalSent}</td>
                      <td className="py-2 px-2 text-center text-secondary">{stats.totalReceived}</td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          value={displayBalance}
                          onChange={(e) => setEditingBalances(prev => ({ ...prev, [student.id]: e.target.value }))}
                          onBlur={(e) => commitBalance(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitBalance((e.target as HTMLInputElement).value); }}
                          className={`w-16 text-center input-field py-0.5 font-medium ${
                            stats.claimedBalance < 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {students.length === 0 && (
            <p className="text-center text-muted py-4">No hi ha estudiants encara</p>
          )}
        </motion.div>
      </div>

      {/* Right Column: Transaction Registry */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-violet-500" />
          <h2 className="font-semibold text-heading">{t('transactionRegistry')}</h2>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-center text-muted py-4">No hi ha transaccions encara</p>
          ) : (
            transactions.map((tx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-lg flex items-center justify-between ${
                  tx.status === 'pending'
                    ? 'bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400'
                    : tx.status === 'rejected'
                    ? 'bg-red-50 dark:bg-red-500/10 border-l-4 border-red-400'
                    : 'bg-surface-alt'
                }`}
              >
                <div className="flex items-center gap-2">
                  {tx.status === 'pending' && <Clock className="w-4 h-4 text-amber-500" />}
                  {tx.status === 'approved' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  {tx.status === 'rejected' && <XCircle className="w-4 h-4 text-red-500" />}
                  <span className="font-medium text-body">{tx.sender?.name}</span>
                  <span className="text-faint">→</span>
                  <span className="font-medium text-body">{tx.receiver?.name}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">{tx.amount} <i className="fa-solid fa-cent-sign" /></span>
                  {tx.status === 'rejected' && tx.rejectReason && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 badge-red rounded-full text-xs">
                      {tx.rejectReason}
                    </span>
                  )}
                  {tx.status === 'approved' && isTransactionSuspicious(tx) && (
                    <span className="badge-red rounded-full text-xs px-2 py-0.5 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {t('insufficientBalance')}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => highlightTransaction(tx.id, !tx.isHighlighted)}
                  className={`p-2 rounded-lg transition-colors ${
                    tx.isHighlighted
                      ? 'bg-amber-200 dark:bg-amber-500/30 text-amber-700 dark:text-amber-400'
                      : 'hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-400 dark:text-zinc-500'
                  }`}
                  title={t('highlightTransaction')}
                >
                  <Star className={`w-4 h-4 ${tx.isHighlighted ? 'fill-current' : ''}`} />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
