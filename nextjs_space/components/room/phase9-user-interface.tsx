'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Send, Clock, ArrowRight, Info, Plus, Copy, Check,
  CheckCircle, XCircle, ArrowDown, Wallet, Trash2,
} from 'lucide-react';
import { Phase9UTXO } from '@/lib/types';
import { useRoom } from '@/contexts/room-context';

export default function Phase9UserInterface() {
  const {
    room,
    participant,
    blocks,
    phase9Addresses: addresses,
    phase9Utxos: utxos,
    phase9MempoolTxs: mempoolTxs,
    autoMineSettings,
    generateAddress: onGenerateAddress,
    createPhase9Transaction: onCreateTransaction,
    autoMineTickPhase9: onAutoMineTick,
  } = useRoom();
  const { t } = useTranslation();

  // Transaction state
  const [selectedUtxoIds, setSelectedUtxoIds] = useState<string[]>([]);
  const [outputs, setOutputs] = useState<{ address: string; amount: string }[]>([{ address: '', amount: '' }]);
  const [txFee, setTxFee] = useState(0.5);
  const [isCreatingTx, setIsCreatingTx] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info' | 'burned'; message: string } | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Auto-mine countdown
  const [countdown, setCountdown] = useState(autoMineSettings.autoMineInterval);
  const lastTickTimeRef = useRef<number>(Date.now());
  const isMiningRef = useRef(false);
  const onAutoMineTickRef = useRef(onAutoMineTick);
  useEffect(() => { onAutoMineTickRef.current = onAutoMineTick; }, [onAutoMineTick]);

  // Blockchain scroll ref
  const blockchainScrollRef = useRef<HTMLDivElement>(null);

  // Derived data
  const myAddresses = useMemo(() =>
    addresses.filter(a => a.ownerId === participant?.id),
    [addresses, participant?.id]
  );

  const myUtxos = useMemo(() =>
    utxos.filter(u => u.ownerId === participant?.id && !u.isSpent),
    [utxos, participant?.id]
  );

  const myBalance = useMemo(() =>
    myUtxos.reduce((sum, u) => sum + u.amount, 0),
    [myUtxos]
  );

  const pendingMempoolTxs = useMemo(() =>
    mempoolTxs
      .filter(tx => tx.status === 'in_mempool')
      .sort((a, b) => b.fee - a.fee),
    [mempoolTxs]
  );

  const capacity = autoMineSettings.autoMineCapacity;

  const minedBlocks = useMemo(() =>
    blocks.filter(b => b.status === 'mined').sort((a, b) => a.blockNumber - b.blockNumber),
    [blocks]
  );

  const displayBlocks = minedBlocks.slice(-10);

  // Selected UTXOs total
  const selectedTotal = useMemo(() =>
    myUtxos.filter(u => selectedUtxoIds.includes(u.id)).reduce((sum, u) => sum + u.amount, 0),
    [myUtxos, selectedUtxoIds]
  );

  const outputsTotal = useMemo(() =>
    outputs.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0),
    [outputs]
  );

  const changeAmount = useMemo(() =>
    Math.round((selectedTotal - outputsTotal - txFee) * 10) / 10,
    [selectedTotal, outputsTotal, txFee]
  );

  // Auto-scroll blockchain
  useEffect(() => {
    if (blockchainScrollRef.current) {
      blockchainScrollRef.current.scrollLeft = blockchainScrollRef.current.scrollWidth;
    }
  }, [minedBlocks.length]);

  // Feedback clear
  useEffect(() => {
    if (feedback) {
      const timeout = setTimeout(() => setFeedback(null), feedback.type === 'burned' ? 6000 : 4000);
      return () => clearTimeout(timeout);
    }
  }, [feedback]);

  // Auto-mine timer
  useEffect(() => {
    lastTickTimeRef.current = Date.now();
    setCountdown(autoMineSettings.autoMineInterval);

    const tick = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastTickTimeRef.current) / 1000);
      const remaining = Math.max(0, autoMineSettings.autoMineInterval - elapsed);
      setCountdown(remaining);

      if (remaining <= 0 && !isMiningRef.current) {
        isMiningRef.current = true;
        lastTickTimeRef.current = Date.now();
        setCountdown(autoMineSettings.autoMineInterval);

        onAutoMineTickRef.current().then(() => {
          isMiningRef.current = false;
        }).catch(() => {
          isMiningRef.current = false;
        });
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [autoMineSettings.autoMineInterval, t]);

  // Fee confidence
  const getFeeConfidence = useCallback((fee: number) => {
    if (pendingMempoolTxs.length === 0) {
      return { label: t('phase8.highChance'), color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' };
    }
    const txsAhead = pendingMempoolTxs.filter(tx => tx.fee > fee).length;
    if (txsAhead < capacity) {
      return { label: t('phase8.highChance'), color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' };
    }
    if (txsAhead < capacity * 2) {
      return { label: t('phase8.mediumChance'), color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' };
    }
    return { label: t('phase8.lowChance'), color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' };
  }, [pendingMempoolTxs, capacity, t]);

  const feeConfidence = getFeeConfidence(txFee);

  // Handlers
  const toggleUtxo = (utxoId: string) => {
    setSelectedUtxoIds(prev =>
      prev.includes(utxoId) ? prev.filter(id => id !== utxoId) : [...prev, utxoId]
    );
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch {
      // Fallback: select text
    }
  };

  const handleAddOutput = () => {
    setOutputs(prev => [...prev, { address: '', amount: '' }]);
  };

  const handleRemoveOutput = (index: number) => {
    if (outputs.length <= 1) return;
    setOutputs(prev => prev.filter((_, i) => i !== index));
  };

  const handleOutputChange = (index: number, field: 'address' | 'amount', value: string) => {
    setOutputs(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
  };

  const handleCreateTransaction = async () => {
    if (selectedUtxoIds.length === 0) {
      setFeedback({ type: 'error', message: t('phase9.selectInputs') });
      return;
    }

    const validOutputs = outputs.filter(o => o.address && parseFloat(o.amount) > 0);
    if (validOutputs.length === 0) {
      setFeedback({ type: 'error', message: t('phase9.needOutput') });
      return;
    }

    if (changeAmount < 0) {
      setFeedback({ type: 'error', message: t('phase9.insufficientInputs') });
      return;
    }

    setIsCreatingTx(true);

    const result = await onCreateTransaction(
      selectedUtxoIds,
      validOutputs.map(o => ({ address: o.address, amount: Math.round(parseFloat(o.amount) * 10) / 10 })),
      txFee
    );

    if (result.success) {
      if (result.burnedOutputs && result.burnedOutputs.length > 0) {
        setFeedback({ type: 'burned', message: `${t('phase9.txCreatedButBurned')}: ${result.burnedOutputs.join(', ')}` });
      } else {
        setFeedback({ type: 'success', message: t('phase9.txCreated') });
      }
      setSelectedUtxoIds([]);
      setOutputs([{ address: '', amount: '' }]);
      setTxFee(0.5);
    } else {
      setFeedback({ type: 'error', message: result.error || t('phase9.txFailed') });
    }

    setIsCreatingTx(false);
  };

  // Group UTXOs by address for display
  const utxosByAddress = useMemo(() => {
    const map = new Map<string, Phase9UTXO[]>();
    for (const utxo of myUtxos) {
      const list = map.get(utxo.address) || [];
      list.push(utxo);
      map.set(utxo.address, list);
    }
    return map;
  }, [myUtxos]);

  if (!room || !participant) return null;

  return (
    <div className="space-y-4">
      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-3 rounded-lg flex items-center gap-3 text-sm ${
              feedback.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
              feedback.type === 'burned' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
              feedback.type === 'info' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
              'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}
          >
            {feedback.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
            {feedback.type === 'burned' && <XCircle className="w-4 h-4 flex-shrink-0" />}
            {feedback.type === 'error' && <XCircle className="w-4 h-4 flex-shrink-0" />}
            {feedback.type === 'info' && <Info className="w-4 h-4 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next block countdown */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-surface-alt">
        <Clock className="w-4 h-4 text-muted" />
        <span className="text-sm text-secondary">{t('phase8.nextBlockIn')}:</span>
        <span className={`text-sm font-bold tabular-nums ${
          countdown <= 5 ? 'text-red-500' : countdown <= 10 ? 'text-amber-500' : 'text-heading'
        }`}>
          {countdown}s
        </span>
        <span className="text-xs text-muted ml-2">
          ({t('phase8.capacity')}: {capacity} tx)
        </span>
      </div>

      {/* Blockchain viewer */}
      <div className="zone-card">
        <h3 className="text-sm font-semibold text-heading mb-2">{t('phase6.blockchain')}</h3>
        <div ref={blockchainScrollRef} className="overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
            {displayBlocks.map(block => {
              const txs: { sender: string; receiver: string; amount: number; fee?: number }[] =
                typeof block.transactions === 'string' ? JSON.parse(block.transactions || '[]') : (block.transactions || []);
              const isGenesis = block.blockNumber === 1 && txs.length === 0;

              return (
                <div
                  key={block.id}
                  className={`rounded-lg p-2 border min-w-[180px] max-w-[200px] ${
                    isGenesis
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600'
                      : 'bg-surface border-default'
                  }`}
                >
                  <div className="mb-1">
                    <span className="text-xs font-bold text-heading">#{block.blockNumber}</span>
                  </div>
                  {isGenesis ? (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 italic">Genesis</div>
                  ) : txs.length === 0 ? (
                    <div className="text-[10px] text-muted italic">{t('phase8.emptyBlock')}</div>
                  ) : (
                    <div className="space-y-0.5">
                      {txs.map((tx, i) => (
                        <div key={i} className="flex items-center gap-1 text-[10px]">
                          <span className="text-secondary truncate max-w-[60px] font-mono">{tx.sender}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-muted flex-shrink-0" />
                          <span className="text-secondary truncate max-w-[60px] font-mono">{tx.receiver}</span>
                          {tx.fee !== undefined && (
                            <span className="ml-auto text-green-600 dark:text-green-400 font-medium">{tx.fee}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column: Addresses/UTXOs + Transaction builder */}
        <div className="space-y-4">

          {/* My Addresses & UTXOs */}
          <div className="zone-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-heading flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                {t('phase9.myAddresses')}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-heading">{myBalance.toFixed(1)} BTC</span>
                <button
                  onClick={onGenerateAddress}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {t('phase9.generateAddress')}
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {myAddresses.length === 0 ? (
                <div className="text-center text-muted text-sm py-4">{t('phase9.noAddresses')}</div>
              ) : (
                Array.from(utxosByAddress.entries()).map(([address, addrUtxos]) => (
                  <div key={address} className="bg-surface-alt rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-secondary">{address}</span>
                      <button
                        onClick={() => handleCopyAddress(address)}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title={t('phase9.copyAddress')}
                      >
                        {copiedAddress === address
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3 text-muted" />
                        }
                      </button>
                    </div>
                    <div className="space-y-1">
                      {addrUtxos.map(utxo => (
                        <label
                          key={utxo.id}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                            selectedUtxoIds.includes(utxo.id)
                              ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUtxoIds.includes(utxo.id)}
                            onChange={() => toggleUtxo(utxo.id)}
                            className="accent-amber-500"
                          />
                          <span className="text-xs text-muted">{utxo.utxoId}</span>
                          <span className="text-xs font-semibold text-heading ml-auto">{utxo.amount.toFixed(1)} BTC</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {/* Addresses without unspent UTXOs (show as empty) */}
              {myAddresses
                .filter(a => !utxosByAddress.has(a.address))
                .map(a => (
                  <div key={a.id} className="bg-surface-alt rounded-lg p-2 opacity-50">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted">{a.address}</span>
                      <button
                        onClick={() => handleCopyAddress(a.address)}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        {copiedAddress === a.address
                          ? <Check className="w-3 h-3 text-green-500" />
                          : <Copy className="w-3 h-3 text-muted" />
                        }
                      </button>
                      <span className="text-[10px] text-muted ml-auto italic">{t('phase9.empty')}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Transaction Builder */}
          <div className="zone-card">
            <h3 className="text-sm font-semibold text-heading mb-3 flex items-center gap-2">
              <Send className="w-4 h-4" />
              {t('phase9.buildTransaction')}
            </h3>

            {/* Inputs hint */}
            <div className={`mb-3 p-2 rounded-lg border text-xs font-medium ${
              selectedUtxoIds.length > 0
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-muted'
            }`}>
              <ArrowDown className="w-3 h-3 inline mr-1" />
              {selectedUtxoIds.length > 0
                ? <>{t('phase9.selectedInputs')}: {selectedUtxoIds.length} UTXO{selectedUtxoIds.length > 1 ? 's' : ''} = <span className="font-bold">{selectedTotal.toFixed(1)} BTC</span></>
                : t('phase9.inputsLabel')
              }
            </div>


            {/* Outputs */}
            <div className="space-y-2 mb-3">
              <div className="text-xs text-muted font-medium">{t('phase9.outputs')}:</div>
              {outputs.map((output, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={output.address}
                    onChange={(e) => handleOutputChange(index, 'address', e.target.value)}
                    placeholder={t('phase9.pasteAddress')}
                    className="flex-1 px-2 py-1.5 text-xs font-mono bg-surface border border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-body"
                  />
                  <input
                    type="number"
                    value={output.amount}
                    onChange={(e) => handleOutputChange(index, 'amount', e.target.value)}
                    placeholder="BTC"
                    min="0.1"
                    step="0.1"
                    className="w-20 px-2 py-1.5 text-xs bg-surface border border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-body"
                  />
                  {outputs.length > 1 && (
                    <button
                      onClick={() => handleRemoveOutput(index)}
                      className="p-1 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={handleAddOutput}
                className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
              >
                <Plus className="w-3 h-3" />
                {t('phase9.addOutput')}
              </button>
            </div>

            {/* Fee slider */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted">{t('phase8.fee')}:</span>
                <span className="text-xs font-semibold text-heading">{txFee.toFixed(1)} BTC</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={txFee}
                onChange={(e) => setTxFee(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className={`text-xs mt-1 px-2 py-1 rounded ${feeConfidence.bgColor} ${feeConfidence.color}`}>
                {feeConfidence.label}
              </div>
            </div>

            {/* Transaction summary */}
            {selectedUtxoIds.length > 0 && outputsTotal > 0 && (
              <div className="mb-3 p-2 bg-surface-alt rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted">{t('phase9.totalInputs')}:</span>
                  <span className="text-heading font-semibold">{selectedTotal.toFixed(1)} BTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('phase9.totalOutputs')}:</span>
                  <span className="text-heading">{outputsTotal.toFixed(1)} BTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('phase8.fee')}:</span>
                  <span className="text-amber-600 dark:text-amber-400">{txFee.toFixed(1)} BTC</span>
                </div>
                {changeAmount > 0 && (
                  <div className="flex justify-between border-t border-default pt-1">
                    <span className="text-muted">{t('phase9.autoChange')}:</span>
                    <span className="text-green-600 dark:text-green-400">{changeAmount.toFixed(1)} BTC</span>
                  </div>
                )}
                {changeAmount < 0 && (
                  <div className="text-red-600 dark:text-red-400 font-medium">
                    {t('phase9.insufficientInputs')}
                  </div>
                )}
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleCreateTransaction}
              disabled={isCreatingTx || selectedUtxoIds.length === 0 || outputsTotal <= 0 || changeAmount < 0}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Send className="w-4 h-4" />
              {isCreatingTx ? t('phase9.sending') : t('phase9.sendTransaction')}
            </button>
          </div>
        </div>

        {/* Right column: Mempool */}
        <div>
          <div className="zone-card h-full">
            <h3 className="text-sm font-semibold text-heading mb-2">
              Mempool ({pendingMempoolTxs.length})
            </h3>

            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {pendingMempoolTxs.length === 0 ? (
                <div className="text-center text-muted text-sm py-8">{t('phase8.mempoolEmpty')}</div>
              ) : (
                pendingMempoolTxs.map((tx, index) => {
                  const isMyTx = tx.senderParticipantId === participant.id;
                  const willEnterNextBlock = index < capacity;
                  const showCutLine = index === capacity;

                  return (
                    <div key={tx.id}>
                      {showCutLine && (
                        <div className="flex items-center gap-2 py-1.5 my-1">
                          <div className="flex-1 border-t-2 border-dashed border-red-400" />
                          <span className="text-[10px] text-red-500 font-medium whitespace-nowrap">
                            <ArrowDown className="w-3 h-3 inline mr-0.5" />
                            {t('phase8.wontEnter')}
                          </span>
                          <div className="flex-1 border-t-2 border-dashed border-red-400" />
                        </div>
                      )}
                      <div className={`p-2 rounded-lg text-xs ${
                        isMyTx
                          ? willEnterNextBlock
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                          : willEnterNextBlock
                            ? 'bg-green-50/50 dark:bg-green-900/10'
                            : 'bg-surface-alt'
                      }`}>
                        <div className="flex items-center gap-1">
                          {isMyTx && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium">
                              {t('phase8.myTx')}
                            </span>
                          )}
                          {willEnterNextBlock && <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />}
                          <span className="font-mono text-muted truncate max-w-[70px]">
                            {tx.inputs[0]?.address || '???'}
                          </span>
                          <ArrowRight className="w-3 h-3 text-muted flex-shrink-0" />
                          <span className="font-mono text-muted truncate max-w-[70px]">
                            {tx.outputs.find(o => !o.isChange)?.address || '???'}
                          </span>
                          <span className="ml-auto font-bold text-green-600 dark:text-green-400">
                            {tx.fee.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
