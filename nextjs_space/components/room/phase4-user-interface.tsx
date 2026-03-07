'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  Coins, 
  ArrowRight, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Send,
  Package,
  Clock
} from 'lucide-react';
import { Room, Participant, UTXO, UTXOTransaction, UTXOOutput } from '@/lib/types';

interface Phase4UserInterfaceProps {
  room: Room;
  participant: Participant;
  utxos: UTXO[];
  utxoTransactions: UTXOTransaction[];
  onInitializeUtxos: () => Promise<UTXO[] | null>;
  onSendTransaction: (
    inputUtxoIds: string[],
    outputs: { recipientId: string; amount: number }[]
  ) => Promise<{ success: boolean; transaction?: UTXOTransaction; error?: string; invalidReason?: string }>;
}

export default function Phase4UserInterface({
  room,
  participant,
  utxos,
  utxoTransactions,
  onInitializeUtxos,
  onSendTransaction,
}: Phase4UserInterfaceProps) {
  const { t } = useTranslation();
  const [selectedUtxoIds, setSelectedUtxoIds] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<{ recipientId: string; amount: number }[]>([{ recipientId: '', amount: 0 }]);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // Get my UTXOs (only unspent)
  const myUtxos = useMemo(() => 
    utxos.filter(u => u.ownerId === participant.id && !u.isSpent),
    [utxos, participant.id]
  );

  // Get all unspent UTXOs for display
  const allUnspentUtxos = useMemo(() => 
    utxos.filter(u => !u.isSpent),
    [utxos]
  );

  // Calculate totals
  const totalMyBalance = useMemo(() => 
    myUtxos.reduce((sum, u) => sum + u.amount, 0),
    [myUtxos]
  );

  const selectedUtxos = useMemo(() => 
    myUtxos.filter(u => selectedUtxoIds.includes(u.utxoId)),
    [myUtxos, selectedUtxoIds]
  );

  const totalInputs = useMemo(() => 
    selectedUtxos.reduce((sum, u) => sum + u.amount, 0),
    [selectedUtxos]
  );

  const totalOutputs = useMemo(() => 
    outputs.reduce((sum, o) => sum + (o.amount || 0), 0),
    [outputs]
  );

  // Get other participants for output selection
  const otherParticipants = useMemo(() => 
    room.participants.filter(p => p.role === 'student' && p.isActive),
    [room.participants]
  );

  // Auto-dismiss feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleUtxoToggle = (utxoId: string) => {
    setSelectedUtxoIds(prev => 
      prev.includes(utxoId) 
        ? prev.filter(id => id !== utxoId)
        : [...prev, utxoId]
    );
  };

  const handleAddOutput = () => {
    setOutputs(prev => [...prev, { recipientId: '', amount: 0 }]);
  };

  const handleRemoveOutput = (index: number) => {
    if (outputs.length > 1) {
      setOutputs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleOutputChange = (index: number, field: 'recipientId' | 'amount', value: string | number) => {
    setOutputs(prev => prev.map((output, i) => 
      i === index ? { ...output, [field]: value } : output
    ));
  };

  const handleAddChangeOutput = () => {
    const change = totalInputs - totalOutputs;
    if (change > 0) {
      setOutputs(prev => [...prev, { recipientId: participant.id, amount: change }]);
    }
  };

  const handleInitialize = async () => {
    setIsInitializing(true);
    try {
      const result = await onInitializeUtxos();
      if (result) {
        setFeedback({ message: t('phase4.utxosInitialized'), type: 'success' });
      }
    } catch {
      setFeedback({ message: t('error'), type: 'error' });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (selectedUtxoIds.length === 0) {
      setFeedback({ message: t('phase4.selectAtLeastOneUtxo'), type: 'error' });
      return;
    }

    const validOutputs = outputs.filter(o => o.recipientId && o.amount > 0);
    if (validOutputs.length === 0) {
      setFeedback({ message: t('phase4.addAtLeastOneOutput'), type: 'error' });
      return;
    }

    if (totalOutputs > totalInputs) {
      setFeedback({ 
        message: t('phase4.outputsExceedInputs', { outputs: totalOutputs, inputs: totalInputs }), 
        type: 'error' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSendTransaction(selectedUtxoIds, validOutputs);
      
      if (result.success) {
        setFeedback({ message: t('phase4.transactionSuccess'), type: 'success' });
        // Reset form
        setSelectedUtxoIds([]);
        setOutputs([{ recipientId: '', amount: 0 }]);
      } else {
        setFeedback({ 
          message: result.invalidReason || result.error || t('error'), 
          type: 'error' 
        });
      }
    } catch {
      setFeedback({ message: t('error'), type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getParticipantName = (id: string) => {
    const p = room.participants.find(p => p.id === id);
    return p ? p.name : 'Unknown';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`col-span-full p-4 rounded-lg flex items-center gap-3 ${
              feedback.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              feedback.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
              'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
          >
            {feedback.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {feedback.type === 'error' && <XCircle className="w-5 h-5" />}
            {feedback.type === 'info' && <AlertCircle className="w-5 h-5" />}
            <span>{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zone 1: My Wallet */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">{t('phase4.myWallet')}</h3>
        </div>

        {myUtxos.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-4">{t('phase4.noUtxos')}</p>
            <button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isInitializing ? '...' : t('phase4.initializeUtxos')}
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-3">{t('phase4.availableUtxos')}:</p>
            <div className="space-y-2 mb-4">
              {myUtxos.map(utxo => (
                <label
                  key={utxo.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    selectedUtxoIds.includes(utxo.utxoId)
                      ? 'bg-yellow-500/20 border border-yellow-500/50'
                      : 'bg-gray-700/50 border border-gray-600/50 hover:border-gray-500/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUtxoIds.includes(utxo.utxoId)}
                    onChange={() => handleUtxoToggle(utxo.utxoId)}
                    className="w-4 h-4 rounded border-gray-500 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm font-mono text-gray-300">{utxo.utxoId}</span>
                  <span className="ml-auto font-bold text-yellow-400">{utxo.amount} BTC</span>
                </label>
              ))}
            </div>
            <div className="pt-3 border-t border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t('phase4.totalBalance')}:</span>
                <span className="text-xl font-bold text-white">{totalMyBalance} BTC</span>
              </div>
            </div>
            {selectedUtxoIds.length > 0 && (
              <p className="mt-3 text-sm text-blue-400">
                💼 {t('phase4.selectedUtxos', { total: totalInputs })}
              </p>
            )}
          </>
        )}
      </div>

      {/* Zone 2: Transaction Builder */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">{t('phase4.buildTransaction')}</h3>
        </div>

        {/* Inputs Section */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">{t('phase4.inputs')}</h4>
          {selectedUtxos.length === 0 ? (
            <p className="text-sm text-gray-500 italic">{t('phase4.selectUtxosToSpend')}</p>
          ) : (
            <div className="space-y-1">
              {selectedUtxos.map(utxo => (
                <div key={utxo.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="font-mono text-gray-300">{utxo.utxoId}:</span>
                  <span className="text-yellow-400">{utxo.amount} BTC</span>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-700 mt-2">
                <span className="text-gray-400">{t('phase4.totalInputs')}: </span>
                <span className="font-bold text-white">{totalInputs} BTC</span>
              </div>
            </div>
          )}
        </div>

        {/* Outputs Section */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">{t('phase4.outputs')}</h4>
          <div className="space-y-3">
            {outputs.map((output, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={output.recipientId}
                  onChange={(e) => handleOutputChange(index, 'recipientId', e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                >
                  <option value="">{t('phase4.recipient')}</option>
                  {otherParticipants.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.id === participant.id ? `(${t('you')})` : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  value={output.amount || ''}
                  onChange={(e) => handleOutputChange(index, 'amount', parseInt(e.target.value) || 0)}
                  placeholder="BTC"
                  className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                />
                {outputs.length > 1 && (
                  <button
                    onClick={() => handleRemoveOutput(index)}
                    className="p-1 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAddOutput}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
            >
              <Plus className="w-4 h-4" /> {t('phase4.addOutput')}
            </button>
            {totalInputs > totalOutputs && totalOutputs > 0 && (
              <button
                onClick={handleAddChangeOutput}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-500 rounded text-white"
              >
                <ArrowRight className="w-4 h-4" /> {t('phase4.changeForMe')} ({totalInputs - totalOutputs} BTC)
              </button>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="p-3 bg-gray-700/50 rounded-lg mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{t('phase4.totalOutputs')}:</span>
            <span className={`font-bold ${
              totalOutputs > totalInputs ? 'text-red-400' : 
              totalOutputs === totalInputs ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {totalOutputs} BTC
              {totalOutputs > totalInputs && ' ⚠️'}
              {totalOutputs === totalInputs && selectedUtxoIds.length > 0 && ' ✅'}
            </span>
          </div>
          {totalInputs > totalOutputs && totalOutputs > 0 && (
            <div className="text-xs text-yellow-400 mt-1">
              ⚠️ {totalInputs - totalOutputs} BTC no assignats (afegeix canvi!)
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || selectedUtxoIds.length === 0 || totalOutputs === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors"
        >
          <Send className="w-5 h-5" />
          {isSubmitting ? '...' : t('phase4.signAndSend')}
        </button>
      </div>

      {/* Zone 3: Global Transactions */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">{t('phase4.globalTransactions')}</h3>
        </div>

        {utxoTransactions.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">{t('phase4.noTransactionsYet')}</p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {utxoTransactions.map(tx => (
              <div
                key={tx.id}
                className={`p-3 rounded-lg border ${
                  tx.isValid 
                    ? 'bg-gray-700/50 border-gray-600/50' 
                    : 'bg-red-900/20 border-red-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-bold text-white">{tx.txId}</span>
                  {tx.isValid ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle className="w-3 h-3" /> {t('phase4.valid')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <XCircle className="w-3 h-3" /> {t('phase4.invalid')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mb-1">
                  {getParticipantName(tx.senderId)}
                </div>
                <div className="text-xs space-y-1">
                  <div className="text-gray-500">
                    Inputs: {tx.inputUtxoIds.join(', ')} ({tx.totalInput} BTC)
                  </div>
                  <div className="text-gray-500">
                    Outputs:
                    {(tx.outputs as UTXOOutput[]).map((out, i) => (
                      <span key={i} className="ml-1">
                        {out.recipientName}: {out.amount} BTC ({out.newUtxoId})
                        {i < tx.outputs.length - 1 && ','}
                      </span>
                    ))}
                  </div>
                </div>
                {!tx.isValid && tx.invalidReason && (
                  <div className="mt-2 text-xs text-red-400">
                    ❌ {tx.invalidReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Phase Question */}
      <div className="col-span-full mt-4 p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl border border-purple-500/30">
        <p className="text-center text-purple-200">
          🤔 {t('phase4.question')}
        </p>
      </div>
    </div>
  );
}
