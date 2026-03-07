'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Landmark,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { Room, Participant, Transaction, CoinFile } from '@/lib/types';

interface BankInterfaceProps {
  room: Room;
  participant: Participant | null;
  onApproveTransaction: (transactionId: string) => Promise<void>;
  onRejectTransaction: (transactionId: string, reason: string) => Promise<void>;
}

export default function BankInterface({
  room,
  participant,
  onApproveTransaction,
  onRejectTransaction,
}: BankInterfaceProps) {
  const { t } = useTranslation();
  const [processing, setProcessing] = useState<string | null>(null);

  const students = (room?.participants ?? []).filter(
    (p) => p.role === 'student' && p.isActive && !p.isBank
  );

  const pendingTransactions = (room?.transactions ?? []).filter(
    (tx) => tx.status === 'pending'
  );

  const approvedTransactions = (room?.transactions ?? []).filter(
    (tx) => tx.status === 'approved'
  );

  const rejectedTransactions = (room?.transactions ?? []).filter(
    (tx) => tx.status === 'rejected'
  );

  const getBalance = (participantId: string): number => {
    const p = room?.participants?.find((pp) => pp.id === participantId);
    if (!p) return 0;
    try {
      const coinFile = JSON.parse(p.coinFile) as CoinFile;
      return coinFile?.saldo ?? 0;
    } catch {
      return 0;
    }
  };

  const handleApprove = async (txId: string) => {
    setProcessing(txId);
    await onApproveTransaction(txId);
    setProcessing(null);
  };

  const handleReject = async (txId: string, reason: string) => {
    setProcessing(txId);
    await onRejectTransaction(txId, reason);
    setProcessing(null);
  };

  return (
    <div className="space-y-6">
      {/* Bank Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="zone-card bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
            <Landmark className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-emerald-800">{t('youAreTheBank')}</h2>
            <p className="text-sm text-emerald-600">Tens el poder d'aprovar o rebutjar transaccions</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* All User Balances */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="zone-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold text-gray-800">{t('allBalances')}</h3>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {students.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No hi ha usuaris</p>
            ) : (
              students.map((student) => {
                const balance = getBalance(student.id);
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <span className="font-medium text-gray-700">{student.name}</span>
                    <span className={`font-mono font-semibold ${
                      balance < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {balance} 🪙
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="zone-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-violet-500" />
            <h3 className="font-semibold text-gray-800">Estadístiques</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-amber-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-600">{pendingTransactions.length}</p>
              <p className="text-xs text-amber-700">{t('pending')}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-emerald-600">{approvedTransactions.length}</p>
              <p className="text-xs text-emerald-700">{t('approved')}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600">{rejectedTransactions.length}</p>
              <p className="text-xs text-red-700">{t('rejected')}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Pending Requests */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-800">{t('pendingRequests')}</h3>
          {pendingTransactions.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
              {pendingTransactions.length}
            </span>
          )}
        </div>

        <div className="space-y-3">
          {pendingTransactions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No hi ha sol·licituds pendents</p>
          ) : (
            pendingTransactions.map((tx) => {
              const senderBalance = getBalance(tx.senderId);
              const hasSufficientBalance = senderBalance >= (tx.amount ?? 0);

              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-gray-50 rounded-xl border-2 border-amber-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-800">
                        <span className="text-amber-600">{tx.sender?.name}</span>
                        {' '}{t('wantsToSend')}{' '}
                        <span className="font-bold">{tx.amount}</span>
                        {' '}{t('coinsTo')}{' '}
                        <span className="text-violet-600">{tx.receiver?.name}</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {t('balanceOf')} {tx.sender?.name}: <span className={hasSufficientBalance ? 'text-emerald-600' : 'text-red-600'}>{senderBalance}</span>
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      hasSufficientBalance ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {hasSufficientBalance ? (
                        <><CheckCircle className="w-3 h-3" /> {t('sufficientBalance')}</>
                      ) : (
                        <><AlertTriangle className="w-3 h-3" /> {t('insufficientBalance')}</>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(tx.id)}
                      disabled={processing === tx.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {t('approve')}
                    </button>
                    <button
                      onClick={() => handleReject(tx.id, hasSufficientBalance ? t('censorship') : t('insufficientFunds'))}
                      disabled={processing === tx.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      {t('reject')}
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Transaction History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold text-gray-800">{t('transactionRegistry')}</h3>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {[...approvedTransactions, ...rejectedTransactions].length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No hi ha transaccions processades</p>
          ) : (
            [...approvedTransactions, ...rejectedTransactions]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((tx) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    tx.status === 'approved' ? 'bg-emerald-50' : 'bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {tx.status === 'approved' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-gray-700">
                      {tx.sender?.name} → {tx.receiver?.name}
                    </span>
                    <span className="text-sm font-semibold text-amber-600">{tx.amount} 🪙</span>
                  </div>
                  {tx.status === 'rejected' && tx.rejectReason && (
                    <span className="text-xs text-red-600">{tx.rejectReason}</span>
                  )}
                </div>
              ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
