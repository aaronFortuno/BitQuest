'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  FileJson,
  Send,
  List,
  HelpCircle,
  AlertTriangle,
  Save,
} from 'lucide-react';
import { useRoom } from '@/contexts/room-context';

export default function StudentInterface() {
  const { room, participant, sendTransaction, updateCoinFile } = useRoom();
  const { t } = useTranslation();
  const [coinFileText, setCoinFileText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedReceiver, setSelectedReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (participant?.coinFile && !isEditing) {
      setCoinFileText(participant.coinFile);
    }
  }, [participant?.coinFile, isEditing]);

  const otherStudents = (room?.participants ?? []).filter(
    (p) => p.id !== participant?.id && p.role === 'student' && p.isActive
  );

  const transactions = room?.transactions ?? [];

  const handleSaveFile = async () => {
    await updateCoinFile(coinFileText);
    setIsEditing(false);
    setIsDirty(false);
  };

  const handleSendTransaction = async () => {
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

    let currentBalance = 10;
    try {
      const coinFile = JSON.parse(participant?.coinFile ?? '{}');
      currentBalance = coinFile?.saldo ?? 10;
    } catch {}

    const amountNum = parseInt(amount);
    const newBalance = currentBalance - amountNum;

    setSending(true);
    const tx = await sendTransaction(selectedReceiver, amountNum, 0);
    setSending(false);

    if (tx) {
      const receiver = otherStudents.find((s) => s.id === selectedReceiver);
      const receiverName = receiver?.name ?? '';

      if (newBalance < 0) {
        setFeedback(t('transactionSentNegative', { amount: amountNum, name: receiverName }));
      } else {
        setFeedback(t('transactionSent', { amount: amountNum, name: receiverName }));
      }

      setSelectedReceiver('');
      setAmount('');
      setTimeout(() => setFeedback(''), 5000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left column: Send + File editor */}
      <div className="space-y-4">
        {/* Send row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card"
        >
          <div className="flex items-center gap-2 mb-3">
            <Send className="w-4 h-4 text-violet-500" />
            <h2 className="font-semibold text-gray-800 dark:text-zinc-100 text-sm">{t('sendCoins')}</h2>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 dark:text-zinc-500 mb-1">{t('whoToSend')}</label>
              <select
                value={selectedReceiver}
                onChange={(e) => setSelectedReceiver(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-400 transition-colors"
              >
                <option value="">--</option>
                {otherStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-20">
              <label className="block text-xs text-gray-500 dark:text-zinc-500 mb-1">{t('howManyCoins')}</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                className="w-full px-3 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg text-sm text-center bg-white dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-400 transition-colors"
                placeholder="0"
              />
            </div>

            <button
              onClick={handleSendTransaction}
              disabled={sending || !selectedReceiver || !amount}
              className="p-2.5 bg-violet-500 hover:bg-violet-600 disabled:bg-gray-300 dark:disabled:bg-zinc-600 text-white rounded-lg transition-colors flex-shrink-0"
              title={t('send')}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {feedback && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded-lg"
            >
              {feedback}
            </motion.p>
          )}
        </motion.div>

        {/* Coin file editor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="zone-card"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-amber-500" />
              <h2 className="font-semibold text-gray-800 dark:text-zinc-100 text-sm">{t('myCoinFile')}</h2>
            </div>
            <div className="flex items-center gap-1">
              {isDirty && (
                <button
                  onClick={handleSaveFile}
                  className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                  title={t('save')}
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-full"
              >
                <HelpCircle className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
              </button>
            </div>
          </div>

          {showHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-3 p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-xs text-blue-700 dark:text-blue-400"
            >
              {t('coinFileDescription')}
            </motion.div>
          )}

          <div
            onClick={() => { if (!isEditing) { setIsEditing(true); } }}
            className={`relative cursor-text rounded-lg transition-colors ${
              isEditing
                ? 'ring-2 ring-amber-400 dark:ring-amber-500'
                : 'hover:ring-1 hover:ring-gray-300 dark:hover:ring-zinc-600'
            }`}
          >
            <textarea
              value={coinFileText}
              onChange={(e) => {
                setCoinFileText(e.target.value);
                setIsDirty(true);
                if (!isEditing) setIsEditing(true);
              }}
              onBlur={() => {
                if (isDirty) handleSaveFile();
                else setIsEditing(false);
              }}
              readOnly={!isEditing}
              className="json-editor w-full h-28 resize-none text-xs"
              spellCheck={false}
            />
          </div>

          <p className="mt-2 text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {t('cheatingWarning')}
          </p>
        </motion.div>
      </div>

      {/* Right column: Transaction history */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <List className="w-4 h-4 text-green-500" />
          <h2 className="font-semibold text-gray-800 dark:text-zinc-100 text-sm">{t('transactionRegistry')}</h2>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-gray-500 dark:text-zinc-500 text-sm text-center py-4">
              {t('noTransactionsYet') || 'No hi ha transaccions encara'}
            </p>
          ) : (
            transactions.map((tx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`transaction-item ${
                  tx.isHighlighted ? 'transaction-highlighted' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700 dark:text-zinc-300">{tx.sender?.name}</span>
                  <span className="text-gray-400 dark:text-zinc-600">&rarr;</span>
                  <span className="font-medium text-gray-700 dark:text-zinc-300">{tx.receiver?.name}</span>
                </div>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">{tx.amount}</span>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
