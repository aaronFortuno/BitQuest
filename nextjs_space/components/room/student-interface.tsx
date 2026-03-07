'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  FileJson,
  Send,
  List,
  BookOpen,
  HelpCircle,
  AlertTriangle,
  Copy,
  Check,
  Edit3,
  Save,
} from 'lucide-react';
import { Room, Participant, Transaction, CoinFile } from '@/lib/types';

interface StudentInterfaceProps {
  room: Room;
  participant: Participant | null;
  onSendTransaction: (receiverId: string, amount: number) => Promise<Transaction | null>;
  onUpdateCoinFile: (coinFile: string) => Promise<void>;
}

export default function StudentInterface({
  room,
  participant,
  onSendTransaction,
  onUpdateCoinFile,
}: StudentInterfaceProps) {
  const { t } = useTranslation();
  const [coinFileText, setCoinFileText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedReceiver, setSelectedReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (participant?.coinFile) {
      setCoinFileText(participant.coinFile);
    }
  }, [participant?.coinFile]);

  const otherStudents = (room?.participants ?? []).filter(
    (p) => p.id !== participant?.id && p.role === 'student' && p.isActive
  );

  const transactions = room?.transactions ?? [];

  const handleCopyFile = async () => {
    await navigator.clipboard.writeText(coinFileText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveFile = async () => {
    await onUpdateCoinFile(coinFileText);
    setIsEditing(false);
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

    // Get current balance before transaction
    let currentBalance = 10;
    try {
      const coinFile = JSON.parse(participant?.coinFile ?? '{}');
      currentBalance = coinFile?.saldo ?? 10;
    } catch {}

    const amountNum = parseInt(amount);
    const newBalance = currentBalance - amountNum;

    setSending(true);
    const tx = await onSendTransaction(selectedReceiver, amountNum);
    setSending(false);

    if (tx) {
      const receiver = otherStudents.find((s) => s.id === selectedReceiver);
      const receiverName = receiver?.name ?? '';
      
      // Check if balance will be negative after transaction
      if (newBalance < 0) {
        setFeedback(t('transactionSentNegative', { amount: amountNum, name: receiverName }));
      } else {
        setFeedback(t('transactionSent', { amount: amountNum, name: receiverName }));
      }
      
      setSelectedReceiver('');
      setAmount('');
      
      // Clear feedback after 5 seconds
      setTimeout(() => setFeedback(''), 5000);
    }
  };



  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Zone 1: Coin File Editor */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="zone-card"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-800">{t('myCoinFile')}</h2>
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
            {t('coinFileDescription')}
          </motion.div>
        )}

        <div className="relative">
          <textarea
            value={coinFileText}
            onChange={(e) => setCoinFileText(e.target.value)}
            disabled={!isEditing}
            className="json-editor w-full h-40 resize-none"
            spellCheck={false}
          />
        </div>

        <div className="flex gap-2 mt-4">
          {isEditing ? (
            <button onClick={handleSaveFile} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              {t('save')}
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-outline flex-1 flex items-center justify-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              {t('editFile')}
            </button>
          )}
          <button
            onClick={handleCopyFile}
            className="btn-outline flex items-center justify-center gap-2 px-4"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {t('cheatingWarning')}
        </p>
      </motion.div>

      {/* Zone 2: Transaction Sender */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-5 h-5 text-violet-500" />
          <h2 className="font-semibold text-gray-800">{t('sendCoins')}</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('whoToSend')}
            </label>
            <select
              value={selectedReceiver}
              onChange={(e) => setSelectedReceiver(e.target.value)}
              className="input-field"
            >
              <option value="">-- Selecciona --</option>
              {otherStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
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
              className="input-field"
              placeholder="0"
            />
          </div>

          <button
            onClick={handleSendTransaction}
            disabled={sending || !selectedReceiver || !amount}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? t('loading') : t('send')}
          </button>

          {feedback && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 bg-amber-50 rounded-lg text-sm text-amber-700"
            >
              {feedback}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Zone 3: Transaction Registry */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="zone-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <List className="w-5 h-5 text-green-500" />
          <h2 className="font-semibold text-gray-800">{t('transactionRegistry')}</h2>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No hi ha transaccions encara
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
                  <span className="font-medium text-gray-700">{tx.sender?.name}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium text-gray-700">{tx.receiver?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-600 font-semibold">{tx.amount} 🪙</span>
                </div>
              </motion.div>
            ))
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
          <h2 className="font-semibold text-gray-800">Fase 0: {t('phase0')}</h2>
        </div>

        <div className="prose prose-sm max-w-none">
          <p className="text-gray-600">{t('helpPhase0')}</p>
          <div className="mt-4 p-4 bg-amber-50 rounded-lg">
            <p className="text-amber-700 font-medium">
              🤔 Pregunta clau: "{t('phase0')}" - Per què no podem simplement crear diners digitals com creem un document de Word?
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
