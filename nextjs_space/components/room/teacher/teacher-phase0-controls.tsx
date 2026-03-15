'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity,
  Eye,
  Star,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { Transaction, Participant, CoinFile } from '@/lib/types';
import { useRoom } from '@/contexts/room-context';

export default function TeacherPhase0Controls() {
  const { t } = useTranslation();
  const { room, highlightTransaction } = useRoom();

  const transactions = room?.transactions ?? [];
  const students = (room?.participants ?? []).filter((p) => p.role === 'student' && p.isActive);

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: Student Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-indigo-500" />
          <h2 className="font-semibold text-heading">{t('studentActivity')}</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-default">
                <th className="text-left py-2 px-2 font-medium text-secondary">{t('name')}</th>
                <th className="text-center py-2 px-2 font-medium text-secondary">TX</th>
                <th className="text-center py-2 px-2 font-medium text-secondary">{t('sent')}</th>
                <th className="text-center py-2 px-2 font-medium text-secondary">{t('received')}</th>
                <th className="text-center py-2 px-2 font-medium text-secondary">{t('coinFileBalance')}</th>
                <th className="text-center py-2 px-2 font-medium text-secondary">{t('realBalance')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const stats = getStudentStats(student);
                return (
                  <tr
                    key={student.id}
                    className={`border-b border-subtle hover:bg-surface-alt ${
                      stats.discrepancy ? 'bg-red-50 dark:bg-red-500/10' : ''
                    }`}
                  >
                    <td className="py-2 px-2 font-medium text-heading flex items-center gap-1">
                      {student.name}
                      {stats.discrepancy && (
                        <span title={t('balanceDiscrepancy')}><AlertTriangle className="w-3.5 h-3.5 text-red-500" /></span>
                      )}
                      {stats.hasOverspent && (
                        <span title={t('overspent')}><AlertCircle className="w-3.5 h-3.5 text-amber-500" /></span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center text-secondary">{stats.transactionCount}</td>
                    <td className="py-2 px-2 text-center text-secondary">{stats.totalSent}</td>
                    <td className="py-2 px-2 text-center text-secondary">{stats.totalReceived}</td>
                    <td className={`py-2 px-2 text-center font-medium ${
                      stats.discrepancy ? 'text-red-600' : 'text-body'
                    }`}>
                      {stats.claimedBalance}
                    </td>
                    <td className="py-2 px-2 text-center font-medium text-emerald-600">
                      {stats.calculatedBalance}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {students.length === 0 && (
          <p className="text-center text-muted py-4">{t('noStudentsYet')}</p>
        )}

        {students.some(s => getStudentStats(s).discrepancy) && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {t('discrepancyDetected')}
            </p>
          </div>
        )}
      </motion.div>

      {/* Right Column: Transaction History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-violet-500" />
          <h2 className="font-semibold text-heading">{t('transactionRegistry')}</h2>
          <span className="text-xs text-muted ml-auto">{transactions.length} {t('totalTransactions').toLowerCase()}</span>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-center text-muted py-4">{t('noTransactionsYet')}</p>
          ) : (
            [...transactions].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ).map((tx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-lg flex items-center justify-between ${
                  isTransactionSuspicious(tx)
                    ? 'bg-red-50 dark:bg-red-500/10 border-l-4 border-red-400'
                    : tx.isHighlighted
                      ? 'bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400'
                      : 'bg-surface-alt'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-body">{tx.sender?.name}</span>
                  <span className="text-faint">→</span>
                  <span className="font-medium text-body">{tx.receiver?.name}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">{tx.amount}</span>
                  {isTransactionSuspicious(tx) && (
                    <span className="badge-red rounded-full text-xs px-2 py-0.5 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {t('impossibleTransactions')}
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
