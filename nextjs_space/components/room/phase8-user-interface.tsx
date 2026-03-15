'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Send, Coins, Clock, ArrowRight, Info,
  CheckCircle, XCircle, Loader2, Activity,
  Flame, ArrowDown,
} from 'lucide-react';
import { useRoom } from '@/contexts/room-context';

export function Phase8UserInterface() {
  const {
    room,
    participant,
    blocks,
    mempoolTransactions,
    halvingInfo,
    autoMineSettings,
    createMempoolTransaction: onCreateTransaction,
    autoMineTick: onAutoMineTick,
  } = useRoom();
  const { t } = useTranslation();

  // Transaction creation state
  const [txReceiverId, setTxReceiverId] = useState('');
  const [txAmount, setTxAmount] = useState(1);
  const [txFee, setTxFee] = useState(1);
  const [isCreatingTx, setIsCreatingTx] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info' | 'halving'; message: string } | null>(null);

  // Auto-mine countdown
  const [countdown, setCountdown] = useState(autoMineSettings.autoMineInterval);
  const lastTickTimeRef = useRef<number>(Date.now());
  const isMiningRef = useRef(false);

  // Stable ref for onAutoMineTick to avoid restarting the timer
  const onAutoMineTickRef = useRef(onAutoMineTick);
  useEffect(() => { onAutoMineTickRef.current = onAutoMineTick; }, [onAutoMineTick]);

  // Blockchain scroll ref — auto-scroll to show newest block
  const blockchainScrollRef = useRef<HTMLDivElement>(null);

  // Derived data
  const minedBlocks = blocks.filter(b => b.status === 'mined').sort((a, b) => a.blockNumber - b.blockNumber);
  const pendingMempoolTxs = mempoolTransactions
    .filter(tx => tx.status === 'in_mempool')
    .sort((a, b) => b.fee - a.fee);
  const capacity = autoMineSettings.autoMineCapacity;

  // Other students for recipient
  const otherStudents = (room?.participants ?? []).filter(
    p => p.isActive && p.role === 'student' && p.id !== participant?.id
  );

  // My pending transactions
  const myPendingTxs = pendingMempoolTxs.filter(tx => tx.senderId === participant?.id);

  // Median fee for guidance
  const medianFee = pendingMempoolTxs.length > 0
    ? pendingMempoolTxs[Math.floor(pendingMempoolTxs.length / 2)].fee
    : 0;

  // Auto-scroll blockchain to show latest block
  useEffect(() => {
    if (blockchainScrollRef.current) {
      blockchainScrollRef.current.scrollLeft = blockchainScrollRef.current.scrollWidth;
    }
  }, [minedBlocks.length]);

  // Feedback clear
  useEffect(() => {
    if (feedback) {
      const timeout = setTimeout(() => setFeedback(null), feedback.type === 'halving' ? 8000 : 4000);
      return () => clearTimeout(timeout);
    }
  }, [feedback]);

  // Auto-mine timer: count down and trigger auto-mine
  // Only depends on autoMineInterval (stable number), not on callback refs
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

        onAutoMineTickRef.current().then(result => {
          isMiningRef.current = false;
          if (result.halvingEvent) {
            setFeedback({
              type: 'halving',
              message: `${t('phase8.halvingOccurred')}! ${result.halvingEvent.previousReward} → ${result.halvingEvent.newReward} BTC`,
            });
          }
        }).catch(() => {
          isMiningRef.current = false;
        });
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [autoMineSettings.autoMineInterval, t]);

  // Handle transaction creation
  const handleCreateTransaction = async () => {
    if (!txReceiverId || txAmount <= 0) return;
    setIsCreatingTx(true);

    const result = await onCreateTransaction(txReceiverId, txAmount, txFee);

    if (result.success) {
      setFeedback({ type: 'success', message: t('phase8.txCreated') });
      setTxReceiverId('');
      setTxAmount(1);
      setTxFee(1);
    } else {
      setFeedback({ type: 'error', message: result.error || t('phase8.txFailed') });
    }

    setIsCreatingTx(false);
  };

  // Fee confirmation chance indicator
  const getFeeConfidence = (fee: number): { label: string; color: string; bgColor: string } => {
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
  };

  const feeConfidence = getFeeConfidence(txFee);

  // Last 10 blocks for display (newest last, growing right)
  const displayBlocks = minedBlocks.slice(-10);

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
              feedback.type === 'halving' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
              feedback.type === 'info' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
              'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}
          >
            {feedback.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
            {feedback.type === 'halving' && <Flame className="w-4 h-4 flex-shrink-0" />}
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


      {/* Block history with transaction details — grows right, auto-scrolls */}
      {displayBlocks.length > 0 && (
        <div className="zone-card">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="w-4 h-4 text-heading" />
            <h2 className="text-sm font-semibold text-heading">{t('phase6.blockchain')}</h2>
            <span className="text-xs text-muted ml-auto">{minedBlocks.length} {t('phase8.blocksMinedCount')}</span>
          </div>

          <div ref={blockchainScrollRef} className="flex gap-3 overflow-x-auto pb-2">
            {displayBlocks.map((block) => {
              const txs = Array.isArray(block.transactions) ? block.transactions : [];
              const isGenesis = block.blockNumber === 1;
              return (
                <div
                  key={block.id}
                  className={`flex-shrink-0 w-44 rounded-lg border p-2.5 ${
                    isGenesis
                      ? 'border-amber-300/50 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-900/10'
                      : 'border-default bg-surface-alt'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      #{block.blockNumber}
                    </span>
                    <span className="text-[10px] text-muted">
                      {block.reward} + {(block.totalFees || 0).toFixed(1)} BTC
                    </span>
                  </div>

                  {txs.length > 0 ? (
                    <div className="space-y-0.5">
                      {txs.map((tx: { sender: string; receiver: string; amount: number; fee?: number }, i: number) => (
                        <div key={i} className="flex items-center gap-1 text-[10px]">
                          <span className="text-secondary truncate max-w-[40px]">{tx.sender}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-muted flex-shrink-0" />
                          <span className="text-secondary truncate max-w-[40px]">{tx.receiver}</span>
                          {tx.fee !== undefined && (
                            <span className="ml-auto text-green-600 dark:text-green-400 font-medium">{tx.fee}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted text-center py-1">
                      {isGenesis ? 'Genesis' : '0 tx'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Send Transaction */}
        <div className="space-y-4">
          {/* Create Transaction with Fee */}
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-3">
              <Send className="w-4 h-4 text-heading" />
              <h2 className="text-sm font-semibold text-heading">{t('phase8.createTransaction')}</h2>
            </div>

            <div className="space-y-3">
              {/* Recipient */}
              <div>
                <label className="text-xs text-muted mb-1 block">{t('phase8.recipient')}</label>
                <select
                  value={txReceiverId}
                  onChange={(e) => setTxReceiverId(e.target.value)}
                  className="w-full bg-surface-alt border border-default rounded-lg p-2 text-sm text-heading"
                >
                  <option value="">{t('phase8.selectRecipient')}</option>
                  {otherStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount + Fee */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">{t('phase8.amount')} (BTC)</label>
                  <input
                    type="number"
                    min="1"
                    value={txAmount}
                    onChange={(e) => setTxAmount(parseInt(e.target.value) || 1)}
                    className="w-full bg-surface-alt border border-default rounded-lg p-2 text-sm text-heading"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">{t('phase8.fee')} (BTC)</label>
                  <input
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={txFee}
                    onChange={(e) => setTxFee(parseFloat(e.target.value) || 0.1)}
                    className="w-full bg-surface-alt border border-default rounded-lg p-2 text-sm text-heading"
                  />
                </div>
              </div>

              {/* Fee slider */}
              <div>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={txFee}
                  onChange={(e) => setTxFee(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-muted">
                  <span>0.1 BTC</span>
                  <span>2.5 BTC</span>
                  <span>5 BTC</span>
                </div>
              </div>

              {/* Confirmation probability */}
              <div className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs ${feeConfidence.bgColor}`}>
                <Info className="w-3 h-3 flex-shrink-0" />
                <span className={feeConfidence.color}>
                  {t('phase8.confirmationChance')}: <span className="font-bold">{feeConfidence.label}</span>
                </span>
                {medianFee > 0 && (
                  <span className="text-muted ml-auto">
                    ({t('phase8.medianFee')}: {medianFee} BTC)
                  </span>
                )}
              </div>

              <button
                onClick={handleCreateTransaction}
                disabled={!txReceiverId || txAmount <= 0 || isCreatingTx}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreatingTx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t('phase8.sendTx')}
              </button>
            </div>
          </div>

          {/* My pending transactions */}
          {myPendingTxs.length > 0 && (
            <div className="zone-card">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-heading" />
                <h2 className="text-sm font-semibold text-heading">{t('phase8.myPendingTxs')}</h2>
              </div>
              <div className="space-y-1.5">
                {myPendingTxs.map((tx) => {
                  const willEnter = pendingMempoolTxs.indexOf(tx) < capacity;
                  return (
                    <div
                      key={tx.id}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                        willEnter
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                          : 'bg-surface-alt border border-default'
                      }`}
                    >
                      <span className="font-medium text-heading">
                        {tx.amount} BTC
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted" />
                      <span className="text-secondary truncate">{tx.receiver?.name}</span>
                      <span className={`ml-auto font-bold ${willEnter ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {tx.fee} BTC fee
                      </span>
                      {willEnter && <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Mempool viewer */}
        <div className="space-y-4">
          <div className="zone-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-heading" />
                <h2 className="text-sm font-semibold text-heading">Mempool</h2>
              </div>
              <span className="text-xs text-muted">
                {pendingMempoolTxs.length} tx {t('phase8.pending')}
              </span>
            </div>

            {pendingMempoolTxs.length === 0 ? (
              <div className="text-center text-muted py-6 text-sm">
                {t('phase8.noTxInMempool')}
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {pendingMempoolTxs.map((tx, idx) => {
                  const willEnterNextBlock = idx < capacity;
                  const isMine = tx.senderId === participant.id;

                  return (
                    <div key={tx.id}>
                      {/* Cut line: separator between "enters" and "doesn't enter" */}
                      {idx === capacity && (
                        <div className="flex items-center gap-2 py-1.5 my-1">
                          <div className="flex-1 border-t-2 border-dashed border-red-300 dark:border-red-700" />
                          <span className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                            <ArrowDown className="w-3 h-3" />
                            {t('phase8.wontEnterNextBlock')}
                          </span>
                          <div className="flex-1 border-t-2 border-dashed border-red-300 dark:border-red-700" />
                        </div>
                      )}
                      <div
                        className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-colors ${
                          isMine
                            ? willEnterNextBlock
                              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                              : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                            : willEnterNextBlock
                              ? 'bg-green-50/50 dark:bg-green-900/10'
                              : 'bg-surface-alt'
                        }`}
                      >
                        <span className={`font-medium ${isMine ? 'text-amber-600 dark:text-amber-400' : 'text-secondary'}`}>
                          {tx.sender?.name || '?'}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted flex-shrink-0" />
                        <span className="text-secondary truncate">{tx.receiver?.name || '?'}</span>
                        <span className="text-muted">({tx.amount})</span>
                        <span className={`ml-auto font-bold tabular-nums ${
                          willEnterNextBlock ? 'text-green-600 dark:text-green-400' : 'text-muted'
                        }`}>
                          {tx.fee} BTC
                        </span>
                        {willEnterNextBlock && (
                          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-default text-[10px] text-muted">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>{t('phase8.willEnterNextBlock')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-800" />
                <span>{t('phase8.yourTx')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
