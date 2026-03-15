'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  User,
  Send,
  List,
  HelpCircle,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { CoinFile } from '@/lib/types';
import { useRoom } from '@/contexts/room-context';

export default function Phase1UserInterface() {
  const { room, participant, sendTransaction } = useRoom();
  const { t } = useTranslation();
  const maxTransferAmount = room?.maxTransferAmount ?? 5;
  const [selectedReceiver, setSelectedReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const otherUsers = (room?.participants ?? []).filter(
    (p) => p.id !== participant?.id && p.role === 'student' && p.isActive
  );

  const myTransactions = (room?.transactions ?? []).filter(
    (tx) => tx.senderId === participant?.id || tx.receiverId === participant?.id
  );

  const pendingCount = myTransactions.filter((tx) => tx.status === 'pending' && tx.senderId === participant?.id).length;

  const getBalance = (): number => {
    if (!participant?.coinFile) return 10;
    try {
      const coinFile = JSON.parse(participant.coinFile) as CoinFile;
      return coinFile?.saldo ?? 10;
    } catch {
      return 10;
    }
  };

  const currentBalance = getBalance();
  const isBankDisconnected = room?.isBankDisconnected ?? false;

  const handleRequestTransaction = async () => {
    if (isBankDisconnected) {
      setFeedback(t('bankUnavailable'));
      setTimeout(() => setFeedback(''), 5000);
      return;
    }

    if (!selectedReceiver) {
      setFeedback(t('selectRecipient'));
      setTimeout(() => setFeedback(''), 3000);
      return;
    }
    if (!amount || parseInt(amount) <= 0) {
      setFeedback(t('enterAmount'));
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    const amountNum = parseInt(amount);
    if (amountNum > maxTransferAmount) {
      setFeedback(t('maxAmountExceeded', { maxAmount: maxTransferAmount }));
      setTimeout(() => setFeedback(''), 6000);
      return;
    }

    setSending(true);
    const tx = await sendTransaction(selectedReceiver, parseInt(amount), 1);
    setSending(false);

    if (tx) {
      setFeedback(t('waitingApproval'));
      setSelectedReceiver('');
      setAmount('');
      setTimeout(() => setFeedback(''), 5000);
    }
  };

  // Check for newly approved/rejected transactions
  useEffect(() => {
    const recentTx = myTransactions.find(
      (tx) => tx.senderId === participant?.id &&
      (tx.status === 'approved' || tx.status === 'rejected') &&
      new Date(tx.createdAt).getTime() > Date.now() - 5000
    );
    if (recentTx) {
      if (recentTx.status === 'approved') {
        setFeedback(t('transactionApproved'));
      } else if (recentTx.status === 'rejected') {
        setFeedback(`${t('transactionRejected')} ${recentTx.rejectReason ? `(${recentTx.rejectReason})` : ''}`);
      }
      setTimeout(() => setFeedback(''), 5000);
    }
  }, [myTransactions, participant?.id, t]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column: My Account + Send Transfer */}
      <div className="space-y-6">
        {/* My Account — simplified */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-violet-500" />
              <h2 className="font-semibold text-heading">{t('myAccount')}</h2>
            </div>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-full"
            >
              <HelpCircle className="w-4 h-4 text-faint" />
            </button>
          </div>

          {showHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-sm text-blue-700 dark:text-blue-400"
            >
              {t('yourBalanceControlled')}
            </motion.div>
          )}

          <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-violet-500 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-violet-600">{t('userRole')}: {participant?.name}</p>
                <p className="text-2xl font-bold text-violet-800">
                  {currentBalance} <i className="fa-solid fa-cent-sign" />
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Send Transfer — compact 1 row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="zone-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-5 h-5 text-emerald-500" />
            <h2 className="font-semibold text-heading">{t('sendTransfer')}</h2>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:text-amber-400 rounded-full text-xs">
                {pendingCount} {t('pending').toLowerCase()}
              </span>
            )}
          </div>

          {isBankDisconnected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-3 p-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 rounded-lg"
            >
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-sm font-medium">{t('bankUnavailable')}</p>
              </div>
            </motion.div>
          )}

          <div className="flex items-center gap-2">
            <select
              value={selectedReceiver}
              onChange={(e) => setSelectedReceiver(e.target.value)}
              className="!w-auto flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-amber-400 transition-colors bg-white dark:bg-zinc-800 dark:text-zinc-100"
              disabled={isBankDisconnected}
            >
              <option value="">-- {t('whoToSend')} --</option>
              {otherUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              max={maxTransferAmount}
              className="!w-16 flex-shrink-0 px-2 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-amber-400 transition-colors bg-white dark:bg-zinc-800 dark:text-zinc-100 text-center"
              placeholder="0"
              disabled={isBankDisconnected}
            />

            <button
              onClick={handleRequestTransaction}
              disabled={sending || !selectedReceiver || !amount || isBankDisconnected}
              className="flex-shrink-0 p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('sendTransfer')}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-muted mt-1.5">
            {t('maxTransferAmount', { maxAmount: maxTransferAmount })}
          </p>

          {feedback && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`mt-3 p-3 rounded-lg text-sm ${
                feedback.includes('aprovada') || feedback.includes('Esperant') || feedback.includes('enviada')
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : feedback.includes('rebutjada') || feedback.includes('disponible')
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                  : feedback.includes('oficina') || feedback.includes('presencialment')
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200'
                  : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
            >
              {feedback}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Right Column: My Transactions — bank style */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <List className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-heading">{t('myTransactions')}</h2>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {myTransactions.length === 0 ? (
            <p className="text-muted text-sm text-center py-4">
              No tens transaccions encara
            </p>
          ) : (
            myTransactions
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((tx) => {
                const isSender = tx.senderId === participant?.id;
                const otherParty = isSender ? tx.receiver?.name : tx.sender?.name;

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg border-l-4 ${
                      tx.status === 'pending'
                        ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-400'
                        : tx.status === 'rejected'
                        ? 'bg-gray-50 dark:bg-zinc-800/50 border-gray-300 dark:border-zinc-600'
                        : isSender
                        ? 'bg-red-50 dark:bg-red-500/10 border-red-400'
                        : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tx.status === 'pending' && <Clock className="w-4 h-4 text-amber-500" />}
                        {tx.status === 'approved' && isSender && <Send className="w-4 h-4 text-red-500" />}
                        {tx.status === 'approved' && !isSender && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        {tx.status === 'rejected' && <XCircle className="w-4 h-4 text-gray-400" />}
                        <span className="text-sm text-body">
                          {isSender ? `${t('sentTo')} ${otherParty}` : `${t('receivedFrom')} ${otherParty}`}
                        </span>
                      </div>
                      <span className={`text-sm font-semibold ${
                        tx.status === 'rejected'
                          ? 'text-gray-400'
                          : isSender
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {isSender ? '-' : '+'}{tx.amount} <i className="fa-solid fa-cent-sign" />
                      </span>
                    </div>
                    {tx.status === 'rejected' && tx.rejectReason && (
                      <p className="text-xs text-gray-500 mt-1">{t('reason')}: {tx.rejectReason}</p>
                    )}
                    {tx.status === 'pending' && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('waitingApproval')}</p>
                    )}
                  </motion.div>
                );
              })
          )}
        </div>
      </motion.div>
    </div>
  );
}
