'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Clock,
  PenTool,
  Undo2,
  ShieldCheck,
} from 'lucide-react';
import { Room, Participant, UTXO, UTXOTransaction, UTXOOutput } from '@/lib/types';

interface Phase4UserInterfaceProps {
  room: Room;
  participant: Participant;
  utxos: UTXO[];
  utxoTransactions: UTXOTransaction[];
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
  onSendTransaction,
}: Phase4UserInterfaceProps) {
  const { t } = useTranslation();
  const [selectedUtxoIds, setSelectedUtxoIds] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<{ recipientId: string; amount: number }[]>([{ recipientId: '', amount: 0 }]);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Local validation state (persisted in localStorage)
  const [validatedTxIds, setValidatedTxIds] = useState<string[]>([]);

  // Load validated TX IDs from localStorage on mount
  useEffect(() => {
    const key = `bitquest_validatedTxs_${participant.id}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) setValidatedTxIds(JSON.parse(stored));
    } catch {}
  }, [participant.id]);

  // Save validated TX IDs to localStorage on change
  const saveValidatedTxIds = useCallback((ids: string[]) => {
    setValidatedTxIds(ids);
    localStorage.setItem(`bitquest_validatedTxs_${participant.id}`, JSON.stringify(ids));
  }, [participant.id]);

  const handleValidateTx = useCallback((txId: string) => {
    if (!validatedTxIds.includes(txId)) {
      saveValidatedTxIds([...validatedTxIds, txId]);
    }
  }, [validatedTxIds, saveValidatedTxIds]);

  // Split transactions into pending (not validated) and verified (validated, in local order)
  const pendingTransactions = useMemo(() =>
    utxoTransactions.filter(tx => !validatedTxIds.includes(tx.id)),
    [utxoTransactions, validatedTxIds]
  );

  const verifiedTransactions = useMemo(() =>
    validatedTxIds
      .map(id => utxoTransactions.find(tx => tx.id === id))
      .filter((tx): tx is UTXOTransaction => tx !== undefined),
    [utxoTransactions, validatedTxIds]
  );

  // Two-step flow: sign first, then broadcast
  const [signedTx, setSignedTx] = useState<{
    inputUtxoIds: string[];
    outputs: { recipientId: string; amount: number }[];
    totalInput: number;
    totalOutput: number;
  } | null>(null);

  // Get my UTXOs (only unspent)
  const myUtxos = useMemo(() => 
    utxos.filter(u => u.ownerId === participant.id && !u.isSpent),
    [utxos, participant.id]
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

  // Step 1: Sign the transaction (local, no network call)
  const handleSign = () => {
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

    setSignedTx({
      inputUtxoIds: [...selectedUtxoIds],
      outputs: validOutputs,
      totalInput: totalInputs,
      totalOutput: totalOutputs,
    });
    setFeedback({ message: t('phase4.txSigned'), type: 'info' });
  };

  // Cancel before broadcast
  const handleCancelSign = () => {
    setSignedTx(null);
    setFeedback(null);
  };

  // Step 2: Broadcast the signed transaction (sends to network)
  const handleBroadcast = async () => {
    if (!signedTx) return;

    setIsSubmitting(true);
    try {
      const result = await onSendTransaction(signedTx.inputUtxoIds, signedTx.outputs);

      if (result.success) {
        setFeedback({ message: t('phase4.transactionSuccess'), type: 'success' });
        setSelectedUtxoIds([]);
        setOutputs([{ recipientId: '', amount: 0 }]);
        setSignedTx(null);
      } else {
        setFeedback({
          message: result.invalidReason || result.error || t('error'),
          type: 'error'
        });
        setSignedTx(null);
      }
    } catch {
      setFeedback({ message: t('error'), type: 'error' });
      setSignedTx(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getParticipantName = (id: string) => {
    const p = room.participants.find(p => p.id === id);
    return p ? p.name : 'Unknown';
  };

  return (
    <div className="space-y-4">
      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-lg flex items-center gap-3 ${
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

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column: Wallet + Transaction Builder */}
        <div className="space-y-4">
          {/* My Wallet */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">{t('phase4.myWallet')}</h3>
            </div>

            {myUtxos.length === 0 ? (
              <div className="text-center py-6">
                <Package className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">{t('phase4.noUtxos')}</p>
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
                    {t('phase4.selectedUtxos', { total: totalInputs })}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Transaction Builder */}
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

            {/* Sign & Broadcast — two separate steps */}
            {!signedTx ? (
              <button
                onClick={handleSign}
                disabled={selectedUtxoIds.length === 0 || totalOutputs === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors"
              >
                <PenTool className="w-5 h-5" />
                {t('phase4.signTx')}
              </button>
            ) : (
              <div className="space-y-3">
                {/* Signed TX preview */}
                <div className="p-3 rounded-lg bg-gray-700/50 border border-gray-600/50">
                  <div className="flex items-center gap-2 mb-2">
                    <PenTool className="w-4 h-4 text-gray-300" />
                    <span className="text-sm font-medium text-gray-300">{t('phase4.txSignedLabel')}</span>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>Inputs: {signedTx.inputUtxoIds.join(', ')} ({signedTx.totalInput} BTC)</p>
                    <p>Outputs: {signedTx.outputs.map(o => `${getParticipantName(o.recipientId)}: ${o.amount}`).join(', ')} ({signedTx.totalOutput} BTC)</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{t('phase4.txSignedHint')}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCancelSign}
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 rounded-lg font-medium text-white transition-colors"
                  >
                    <Undo2 className="w-4 h-4" />
                    {t('phase4.cancelTx')}
                  </button>
                  <button
                    onClick={handleBroadcast}
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-medium text-white transition-colors"
                  >
                    <Send className="w-5 h-5" />
                    {isSubmitting ? '...' : t('phase4.broadcastTx')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Pending + Verified Transactions */}
        <div className="space-y-4">
          {/* Pending Transactions */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">{t('phase4.pendingTransactions')}</h3>
            </div>

            {pendingTransactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">{t('phase4.noPendingYet')}</p>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto">
                {pendingTransactions.map(tx => (
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
                      <div className="flex items-center gap-2">
                        {tx.isValid ? (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <CheckCircle className="w-3 h-3" /> {t('phase4.valid')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <XCircle className="w-3 h-3" /> {t('phase4.invalid')}
                          </span>
                        )}
                        <button
                          onClick={() => handleValidateTx(tx.id)}
                          className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                        >
                          {t('phase4.validateTx')}
                        </button>
                      </div>
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
                        {tx.invalidReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verified Transactions */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold text-white">{t('phase4.verifiedTransactions')}</h3>
              <span className="text-xs text-gray-400 ml-auto">{verifiedTransactions.length} TX</span>
            </div>

            {verifiedTransactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">{t('phase4.noVerifiedYet')}</p>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto">
                {verifiedTransactions.map((tx, idx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-lg border border-green-500/20 bg-green-900/10"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-green-400">#{idx + 1}</span>
                        <span className="font-mono text-sm font-bold text-white">{tx.txId}</span>
                      </div>
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
                    <div className="text-xs text-gray-400">
                      {getParticipantName(tx.senderId)} — {tx.totalInput} BTC
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase Question */}
      <div className="p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl border border-purple-500/30">
        <p className="text-center text-purple-200">
          {t('phase4.question')}
        </p>
      </div>
    </div>
  );
}
