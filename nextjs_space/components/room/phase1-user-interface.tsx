'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  User,
  Send,
  List,
  BookOpen,
  HelpCircle,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Room, Participant, Transaction, CoinFile } from '@/lib/types';

interface Phase1UserInterfaceProps {
  room: Room;
  participant: Participant | null;
  onRequestTransaction: (receiverId: string, amount: number) => Promise<Transaction | null>;
}

// Maximum transfer amount per transaction
const MAX_TRANSFER_AMOUNT = 5;

export default function Phase1UserInterface({
  room,
  participant,
  onRequestTransaction,
}: Phase1UserInterfaceProps) {
  const { t } = useTranslation();
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
    
    // Check for max transfer amount
    const amountNum = parseInt(amount);
    if (amountNum > MAX_TRANSFER_AMOUNT) {
      setFeedback(t('maxAmountExceeded', { maxAmount: MAX_TRANSFER_AMOUNT }));
      setTimeout(() => setFeedback(''), 6000);
      return;
    }

    setSending(true);
    const tx = await onRequestTransaction(selectedReceiver, parseInt(amount));
    setSending(false);

    if (tx) {
      const receiver = otherUsers.find((s) => s.id === selectedReceiver);
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Zone 1: My Account */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="zone-card"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-violet-500" />
            <h2 className="font-semibold text-gray-800">{t('myAccount')}</h2>
          </div>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <HelpCircle className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {showHelp && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700"
          >
            {t('yourBalanceControlled')}
          </motion.div>
        )}

        <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-violet-500 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-violet-600">{t('userRole')}: {participant?.name}</p>
              <p className="text-2xl font-bold text-violet-800">
                {currentBalance} <span className="text-lg">🪙</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-amber-50 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700">
            <Lock className="w-4 h-4" />
            <p className="text-sm">{t('yourBalanceControlled')}</p>
          </div>
        </div>
      </motion.div>

      {/* Zone 2: Request Transaction */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-5 h-5 text-emerald-500" />
          <h2 className="font-semibold text-gray-800">{t('requestTransaction')}</h2>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
              {pendingCount} {t('pending').toLowerCase()}
            </span>
          )}
        </div>

        {isBankDisconnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
          >
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm font-medium">{t('bankUnavailable')}</p>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('whoToSend')}
            </label>
            <select
              value={selectedReceiver}
              onChange={(e) => setSelectedReceiver(e.target.value)}
              className="input-field"
              disabled={isBankDisconnected}
            >
              <option value="">-- Selecciona --</option>
              {otherUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('howManyCoins')}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              max={MAX_TRANSFER_AMOUNT}
              className="input-field"
              placeholder="0"
              disabled={isBankDisconnected}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('maxTransferAmount', { maxAmount: MAX_TRANSFER_AMOUNT })}
            </p>
          </div>

          <button
            onClick={handleRequestTransaction}
            disabled={sending || !selectedReceiver || !amount || isBankDisconnected}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? t('loading') : t('sendRequest')}
          </button>

          {feedback && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`p-3 rounded-lg text-sm ${
                feedback.includes('aprovada') || feedback.includes('Esperant') || feedback.includes('enviada')
                  ? 'bg-emerald-50 text-emerald-700'
                  : feedback.includes('rebutjada') || feedback.includes('disponible')
                  ? 'bg-red-50 text-red-700'
                  : feedback.includes('oficina') || feedback.includes('presencialment')
                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {feedback}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Zone 3: My Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <List className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-800">{t('myTransactions')}</h2>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {myTransactions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
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
                    className={`p-3 rounded-lg ${
                      tx.status === 'pending'
                        ? 'bg-amber-50 border-l-4 border-amber-400'
                        : tx.status === 'approved'
                        ? 'bg-emerald-50 border-l-4 border-emerald-400'
                        : 'bg-red-50 border-l-4 border-red-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tx.status === 'pending' && <Clock className="w-4 h-4 text-amber-500" />}
                        {tx.status === 'approved' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                        {tx.status === 'rejected' && <XCircle className="w-4 h-4 text-red-500" />}
                        <span className="text-sm text-gray-700">
                          {isSender ? `Enviat a ${otherParty}` : `Rebut de ${otherParty}`}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-amber-600">
                        {isSender ? '-' : '+'}{tx.amount} 🪙
                      </span>
                    </div>
                    {tx.status === 'rejected' && tx.rejectReason && (
                      <p className="text-xs text-red-600 mt-1">{t('reason')}: {tx.rejectReason}</p>
                    )}
                    {tx.status === 'pending' && (
                      <p className="text-xs text-amber-600 mt-1">{t('waitingApproval')}</p>
                    )}
                  </motion.div>
                );
              })
          )}
        </div>
      </motion.div>

      {/* Zone 4: Context/Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="zone-card lg:col-span-3"
      >
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-gray-800">Fase 1: {t('phase1')}</h2>
        </div>

        <div className="prose prose-sm max-w-none">
          <p className="text-gray-600">{t('helpPhase1')}</p>
          <div className="mt-4 p-4 bg-emerald-50 rounded-lg">
            <p className="text-emerald-700 font-medium">
              🤔 {t('phase1Question')}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
