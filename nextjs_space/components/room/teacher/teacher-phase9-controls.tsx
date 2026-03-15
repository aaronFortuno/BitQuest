'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle,
  Copy,
  Pickaxe,
  Plus,
  Send,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useRoom } from '@/contexts/room-context';
import type { Phase9UTXO } from '@/lib/types';

export default function TeacherPhase9Controls() {
  const { t } = useTranslation();
  const {
    room,
    blocks,
    phase9Addresses,
    phase9Utxos,
    phase9MempoolTxs,
    participant,
    fundAllPhase9Nodes,
    generateAddress,
    createPhase9Transaction,
    updatePhase9Settings,
  } = useRoom();

  const [p9SelectedUtxoIds, setP9SelectedUtxoIds] = useState<string[]>([]);
  const [p9Outputs, setP9Outputs] = useState<{ address: string; amount: string }[]>([{ address: '', amount: '' }]);
  const [p9TxFee, setP9TxFee] = useState(0.5);
  const [p9IsCreatingTx, setP9IsCreatingTx] = useState(false);
  const [p9Feedback, setP9Feedback] = useState<{ type: 'success' | 'error' | 'burned'; message: string } | null>(null);
  const [p9CopiedAddress, setP9CopiedAddress] = useState<string | null>(null);

  if (!room) return null;

  const students = room.participants.filter(p => p.role === 'student' && p.isActive);
  const unspentUtxos = phase9Utxos.filter(u => !u.isSpent);
  const pendingTxs = phase9MempoolTxs.filter(tx => tx.status === 'in_mempool');
  const pendingTxCount = pendingTxs.length;

  const teacherAddresses = phase9Addresses.filter(a => a.ownerId === participant?.id);
  const teacherUtxos = unspentUtxos.filter(u => u.ownerId === participant?.id);
  const teacherBalance = teacherUtxos.reduce((sum, u) => sum + u.amount, 0);
  const teacherUtxosByAddress = new Map<string, Phase9UTXO[]>();
  for (const utxo of teacherUtxos) {
    const list = teacherUtxosByAddress.get(utxo.address) || [];
    list.push(utxo);
    teacherUtxosByAddress.set(utxo.address, list);
  }
  const p9SelectedTotal = teacherUtxos
    .filter(u => p9SelectedUtxoIds.includes(u.id))
    .reduce((sum, u) => sum + u.amount, 0);
  const p9OutputsTotal = p9Outputs.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
  const p9ChangeAmount = Math.round((p9SelectedTotal - p9OutputsTotal - p9TxFee) * 10) / 10;

  const p9MinedBlocks = (blocks || [])
    .filter(b => b.status === 'mined')
    .sort((a, b) => a.blockNumber - b.blockNumber);
  const p9DisplayBlocks = p9MinedBlocks.slice(-10);

  const handleP9CopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setP9CopiedAddress(address);
      setTimeout(() => setP9CopiedAddress(null), 2000);
    } catch { /* ignore */ }
  };

  const handleP9CreateTransaction = async () => {
    if (p9SelectedUtxoIds.length === 0) {
      setP9Feedback({ type: 'error', message: t('phase9.selectInputs') });
      return;
    }
    const validOutputs = p9Outputs.filter(o => o.address && parseFloat(o.amount) > 0);
    if (validOutputs.length === 0) {
      setP9Feedback({ type: 'error', message: t('phase9.needOutput') });
      return;
    }
    if (p9ChangeAmount < 0) {
      setP9Feedback({ type: 'error', message: t('phase9.insufficientInputs') });
      return;
    }
    setP9IsCreatingTx(true);
    const result = await createPhase9Transaction?.(
      p9SelectedUtxoIds,
      validOutputs.map(o => ({ address: o.address, amount: Math.round(parseFloat(o.amount) * 10) / 10 })),
      p9TxFee
    );
    if (result?.success) {
      if (result.burnedOutputs && result.burnedOutputs.length > 0) {
        setP9Feedback({ type: 'burned', message: `${t('phase9.txCreatedButBurned')}: ${result.burnedOutputs.join(', ')}` });
      } else {
        setP9Feedback({ type: 'success', message: t('phase9.txCreated') });
      }
      setP9SelectedUtxoIds([]);
      setP9Outputs([{ address: '', amount: '' }]);
      setP9TxFee(0.5);
    } else {
      setP9Feedback({ type: 'error', message: result?.error || t('phase9.txFailed') });
    }
    setP9IsCreatingTx(false);
  };

  return (
    <>
      {/* Blockchain viewer — full width on top */}
      {p9DisplayBlocks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card"
        >
          <div className="flex items-center gap-2 mb-3">
            <Pickaxe className="w-4 h-4 text-heading" />
            <h2 className="text-sm font-semibold text-heading">{t('phase6.blockchain')}</h2>
            <span className="text-xs text-muted ml-auto">{p9MinedBlocks.length} {t('phase8.blocksMinedCount')}</span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2" ref={(el) => {
            if (el) el.scrollLeft = el.scrollWidth;
          }}>
            {p9DisplayBlocks.map((block) => {
              const txs = (() => { try { return JSON.parse(block.transactionsRaw || '[]'); } catch { return Array.isArray(block.transactions) ? block.transactions : []; } })();
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
                  <div className="mb-1.5">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      #{block.blockNumber}
                    </span>
                  </div>
                  {txs.length > 0 ? (
                    <div className="space-y-0.5">
                      {txs.map((tx: { sender: string; receiver: string; amount: number; fee?: number }, i: number) => (
                        <div key={i} className="flex items-center gap-1 text-[10px]">
                          <span className="text-secondary truncate max-w-[40px] font-mono">{tx.sender}</span>
                          <span className="text-muted">→</span>
                          <span className="text-secondary truncate max-w-[40px] font-mono">{tx.receiver}</span>
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
        </motion.div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Controls + Teacher addresses & TX builder */}
        <div className="space-y-4">
          {/* Auto-mine controls */}
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-heading" />
              <h2 className="font-semibold text-heading">{t('phase9InstructionTitle')}</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-4">
              <div className="p-3 bg-surface-alt rounded-lg">
                <p className="text-xs text-muted mb-2">{t('phase8.blockInterval')}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="10"
                    max="60"
                    step="5"
                    value={room.autoMineInterval || 20}
                    onChange={(e) => updatePhase9Settings?.({ autoMineInterval: parseInt(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-sm font-bold text-heading w-10 text-right">{room.autoMineInterval || 20}s</span>
                </div>
              </div>

              <div className="p-3 bg-surface-alt rounded-lg">
                <p className="text-xs text-muted mb-2">{t('phase8.blockCapacity')}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={room.autoMineCapacity || 3}
                    onChange={(e) => updatePhase9Settings?.({ autoMineCapacity: parseInt(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-sm font-bold text-heading w-10 text-right">{room.autoMineCapacity || 3} tx</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-surface-alt rounded-lg mb-4">
              <p className="text-xs text-muted">{t('phase8.mempoolTxs')}</p>
              <p className="font-semibold text-heading text-xl">
                {pendingTxCount} tx {t('phase8.pending')}
              </p>
            </div>

            {/* Fund all nodes button */}
            <button
              onClick={async () => {
                const result = await fundAllPhase9Nodes?.();
                if (result?.success) {
                  setP9Feedback({
                    type: 'success',
                    message: `${t('phase9.fundedNodes')}: ${result.funded || 0}`,
                  });
                }
              }}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              {t('phase9.fundAllNodes')}
            </button>

          </div>

          {/* Teacher's Addresses & UTXOs */}
          <div className="zone-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-heading flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                {t('phase9.myAddresses')}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-heading">{teacherBalance.toFixed(1)} BTC</span>
                <button
                  onClick={() => generateAddress?.()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {t('phase9.generateAddress')}
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {teacherAddresses.length === 0 ? (
                <div className="text-center text-muted text-sm py-4">{t('phase9.noAddresses')}</div>
              ) : (
                Array.from(teacherUtxosByAddress.entries()).map(([address, addrUtxos]) => (
                  <div key={address} className="bg-surface-alt rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-secondary">{address}</span>
                      <button
                        onClick={() => handleP9CopyAddress(address)}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        {p9CopiedAddress === address
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
                            p9SelectedUtxoIds.includes(utxo.id)
                              ? 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={p9SelectedUtxoIds.includes(utxo.id)}
                            onChange={() => setP9SelectedUtxoIds(prev =>
                              prev.includes(utxo.id) ? prev.filter(id => id !== utxo.id) : [...prev, utxo.id]
                            )}
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
              {/* Addresses without unspent UTXOs */}
              {teacherAddresses
                .filter(a => !teacherUtxosByAddress.has(a.address))
                .map(a => (
                  <div key={a.id} className="bg-surface-alt rounded-lg p-2 opacity-50">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted">{a.address}</span>
                      <button
                        onClick={() => handleP9CopyAddress(a.address)}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        {p9CopiedAddress === a.address
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

          {/* Teacher's Transaction Builder */}
          <div className="zone-card">
            <h3 className="text-sm font-semibold text-heading mb-3 flex items-center gap-2">
              <Send className="w-4 h-4" />
              {t('phase9.buildTransaction')}
            </h3>

            {/* Feedback */}
            <AnimatePresence>
              {p9Feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mb-3 p-2 rounded-lg flex items-center gap-2 text-xs ${
                    p9Feedback.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                    p9Feedback.type === 'burned' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}
                >
                  {p9Feedback.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span>{p9Feedback.message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inputs hint */}
            <div className={`mb-3 p-2 rounded-lg border text-xs font-medium ${
              p9SelectedUtxoIds.length > 0
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-muted'
            }`}>
              <ArrowRight className="w-3 h-3 inline mr-1" />
              {p9SelectedUtxoIds.length > 0
                ? <>{t('phase9.selectedInputs')}: {p9SelectedUtxoIds.length} UTXO{p9SelectedUtxoIds.length > 1 ? 's' : ''} = <span className="font-bold">{p9SelectedTotal.toFixed(1)} BTC</span></>
                : t('phase9.inputsLabel')
              }
            </div>

            {/* Outputs */}
            <div className="space-y-2 mb-3">
              <div className="text-xs text-muted font-medium">{t('phase9.outputs')}:</div>
              {p9Outputs.map((output, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={output.address}
                    onChange={(e) => setP9Outputs(prev => prev.map((o, i) => i === index ? { ...o, address: e.target.value } : o))}
                    placeholder={t('phase9.pasteAddress')}
                    className="flex-1 px-2 py-1.5 text-xs font-mono bg-surface border border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-body"
                  />
                  <input
                    type="number"
                    value={output.amount}
                    onChange={(e) => setP9Outputs(prev => prev.map((o, i) => i === index ? { ...o, amount: e.target.value } : o))}
                    placeholder="BTC"
                    min="0.1"
                    step="0.1"
                    className="w-20 px-2 py-1.5 text-xs bg-surface border border-default rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 text-body"
                  />
                  {p9Outputs.length > 1 && (
                    <button
                      onClick={() => setP9Outputs(prev => prev.filter((_, i) => i !== index))}
                      className="p-1 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setP9Outputs(prev => [...prev, { address: '', amount: '' }])}
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
                <span className="text-xs font-semibold text-heading">{p9TxFee.toFixed(1)} BTC</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={p9TxFee}
                onChange={(e) => setP9TxFee(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Transaction summary */}
            {p9SelectedUtxoIds.length > 0 && p9OutputsTotal > 0 && (
              <div className="mb-3 p-2 bg-surface-alt rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted">{t('phase9.totalInputs')}:</span>
                  <span className="text-heading font-semibold">{p9SelectedTotal.toFixed(1)} BTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('phase9.totalOutputs')}:</span>
                  <span className="text-heading">{p9OutputsTotal.toFixed(1)} BTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t('phase8.fee')}:</span>
                  <span className="text-amber-600 dark:text-amber-400">{p9TxFee.toFixed(1)} BTC</span>
                </div>
                {p9ChangeAmount > 0 && (
                  <div className="flex justify-between border-t border-default pt-1">
                    <span className="text-muted">{t('phase9.autoChange')}:</span>
                    <span className="text-green-600 dark:text-green-400">{p9ChangeAmount.toFixed(1)} BTC</span>
                  </div>
                )}
                {p9ChangeAmount < 0 && (
                  <div className="text-red-600 dark:text-red-400 font-medium">
                    {t('phase9.insufficientInputs')}
                  </div>
                )}
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleP9CreateTransaction}
              disabled={p9IsCreatingTx || p9SelectedUtxoIds.length === 0 || p9OutputsTotal <= 0 || p9ChangeAmount < 0}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Send className="w-4 h-4" />
              {p9IsCreatingTx ? t('phase9.sending') : t('phase9.sendTransaction')}
            </button>
          </div>
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
                {pendingTxCount} tx {t('phase8.pending')}
              </span>
            </div>

            {(() => {
              const sortedTxs = pendingTxs.sort((a, b) => b.fee - a.fee);
              const cap = room.autoMineCapacity || 3;

              if (sortedTxs.length === 0) {
                return (
                  <div className="text-center text-muted py-6 text-sm">
                    {t('phase8.noTxInMempool')}
                  </div>
                );
              }

              return (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {sortedTxs.map((tx, idx) => {
                    const willEnter = idx < cap;
                    return (
                      <div key={tx.id}>
                        {idx === cap && (
                          <div className="flex items-center gap-2 py-1.5 my-1">
                            <div className="flex-1 border-t-2 border-dashed border-red-300 dark:border-red-700" />
                            <span className="text-[10px] text-red-500 font-medium">
                              {t('phase8.wontEnterNextBlock')}
                            </span>
                            <div className="flex-1 border-t-2 border-dashed border-red-300 dark:border-red-700" />
                          </div>
                        )}
                        <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                          willEnter ? 'bg-green-50/50 dark:bg-green-900/10' : 'bg-surface-alt'
                        }`}>
                          <span className="text-secondary font-mono text-[10px] truncate max-w-[100px]">
                            {tx.inputs?.[0]?.address || '?'}
                          </span>
                          <span className="text-muted">→</span>
                          <span className="text-secondary font-mono text-[10px] truncate max-w-[100px]">
                            {tx.outputs?.[0]?.address || '?'}
                          </span>
                          {tx.outputs && tx.outputs.length > 1 && (
                            <span className="text-muted text-[10px]">+{tx.outputs.length - 1}</span>
                          )}
                          <span className={`ml-auto font-bold tabular-nums ${
                            willEnter ? 'text-green-600 dark:text-green-400' : 'text-muted'
                          }`}>
                            {tx.fee} BTC
                          </span>
                          {willEnter && <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-default text-[10px] text-muted">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span>{t('phase8.willEnterNextBlock')}</span>
              </div>
            </div>
          </div>

          {/* Address Activity per Student */}
          {students.length > 0 && (
            <div className="zone-card">
              <h3 className="text-sm font-semibold text-heading mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t('phase9.addressActivity')}
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {students.map(student => {
                  const studentAddrs = phase9Addresses.filter(a => a.ownerId === student.id);
                  const studentBalance = unspentUtxos
                    .filter(u => u.ownerId === student.id)
                    .reduce((sum, u) => sum + u.amount, 0);
                  return (
                    <div key={student.id} className="p-2 bg-surface-alt rounded-lg text-sm flex items-center justify-between">
                      <div>
                        <span className="font-medium text-body">{student.name}</span>
                        <span className="text-xs text-muted ml-2">{studentAddrs.length} {t('phase9.addresses')}</span>
                      </div>
                      <span className="font-semibold text-yellow-600">{studentBalance.toFixed(1)} BTC</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
