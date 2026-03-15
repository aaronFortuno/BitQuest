'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Activity,
  CheckCircle,
  Pickaxe,
  TrendingUp,
} from 'lucide-react';
import { useRoom } from '@/contexts/room-context';

export default function TeacherPhase8Controls() {
  const { t } = useTranslation();
  const {
    room,
    blocks,
    halvingInfo,
    mempoolTransactions,
    autoMineSettings,
    fillMempool,
    forceHalving,
    updatePhase8Settings,
  } = useRoom();

  const [forcingHalving, setForcingHalving] = useState(false);

  if (!room) return null;

  const phase8MinedBlocks = (blocks || []).filter(b => b.status === 'mined').sort((a, b) => a.blockNumber - b.blockNumber);
  const phase8DisplayBlocks = phase8MinedBlocks.slice(-10);
  const pendingTxCount = mempoolTransactions?.filter(tx => tx.status === 'in_mempool').length ?? 0;

  return (
    <>
      {/* Blockchain visualization — same as student view */}
      {phase8DisplayBlocks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card"
        >
          <div className="flex items-center gap-2 mb-3">
            <Pickaxe className="w-4 h-4 text-heading" />
            <h2 className="text-sm font-semibold text-heading">{t('phase6.blockchain')}</h2>
            <span className="text-xs text-muted ml-auto">{phase8MinedBlocks.length} {t('phase8.blocksMinedCount')}</span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2" ref={(el) => {
            if (el) el.scrollLeft = el.scrollWidth;
          }}>
            {phase8DisplayBlocks.map((block) => {
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
                          <span className="text-muted">→</span>
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
        </motion.div>
      )}

      {/* Two-column layout: Controls (left) + Mempool (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Controls */}
        <div className="space-y-4">
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-heading" />
              <h2 className="font-semibold text-heading">{t('phase8InstructionTitle')}</h2>
            </div>

            {/* Auto-mine settings */}
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div className="p-3 bg-surface-alt rounded-lg">
                <p className="text-xs text-muted mb-2">{t('phase8.blockInterval')}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="10"
                    max="60"
                    step="5"
                    value={autoMineSettings.autoMineInterval}
                    onChange={(e) => updatePhase8Settings?.({ autoMineInterval: parseInt(e.target.value) })}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="text-sm font-bold text-heading w-10 text-right">{autoMineSettings.autoMineInterval}s</span>
                </div>
              </div>

              <div className="p-3 bg-surface-alt rounded-lg">
                <p className="text-xs text-muted mb-2">{t('phase8.blockCapacity')}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="8"
                    step="1"
                    value={autoMineSettings.autoMineCapacity}
                    onChange={(e) => updatePhase8Settings?.({ autoMineCapacity: parseInt(e.target.value) })}
                    className="flex-1 accent-amber-500"
                  />
                  <span className="text-sm font-bold text-heading w-10 text-right">{autoMineSettings.autoMineCapacity} tx</span>
                </div>
              </div>
            </div>

            {/* Mempool count */}
            <div className="p-3 bg-surface-alt rounded-lg mb-4">
              <p className="text-xs text-muted">{t('phase8.mempoolTxs')}</p>
              <p className="font-semibold text-heading text-xl">
                {pendingTxCount} tx {t('phase8.pending')}
              </p>
            </div>

            {/* Demo Controls */}
            <div className="p-4 bg-surface-alt rounded-lg">
              <h3 className="font-medium text-body mb-3">{t('phase8.demoControls')}</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => fillMempool?.(15)}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-800 dark:bg-zinc-600 dark:hover:bg-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {t('phase8.addTxWithFees')}
                </button>

                {halvingInfo && (
                  <button
                    onClick={async () => {
                      setForcingHalving(true);
                      await forceHalving?.();
                      setForcingHalving(false);
                    }}
                    disabled={forcingHalving || halvingInfo.currentBlockReward < 0.1}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-800 dark:bg-zinc-600 dark:hover:bg-zinc-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {t('phase8.triggerHalving')} ({halvingInfo.currentBlockReward} → {(halvingInfo.currentBlockReward / 2).toFixed(2)} BTC)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Mempool viewer (same as student view) */}
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
              const pendingTxs = (mempoolTransactions || [])
                .filter(tx => tx.status === 'in_mempool')
                .sort((a, b) => b.fee - a.fee);
              const cap = autoMineSettings.autoMineCapacity;

              if (pendingTxs.length === 0) {
                return (
                  <div className="text-center text-muted py-6 text-sm">
                    {t('phase8.noTxInMempool')}
                  </div>
                );
              }

              return (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {pendingTxs.map((tx, idx) => {
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
                          <span className="text-secondary font-medium">{tx.sender?.name || '?'}</span>
                          <span className="text-muted">→</span>
                          <span className="text-secondary truncate">{tx.receiver?.name || '?'}</span>
                          <span className="text-muted">({tx.amount})</span>
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
        </div>
      </div>
    </>
  );
}
