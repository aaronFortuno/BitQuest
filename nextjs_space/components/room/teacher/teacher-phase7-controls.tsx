'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Clock,
  Link,
  Trophy,
  Pickaxe,
  TrendingUp,
  Users2,
} from 'lucide-react';
import { useRoom } from '@/contexts/room-context';
import { BlockchainVisualization } from '@/components/room/blockchain-visualization';

export default function TeacherPhase7Controls() {
  const { t } = useTranslation();
  const {
    room,
    blocks,
    difficultyInfo,
    miningPools,
    poolsEnabled,
    createPendingBlock,
    createGenesisBlock,
    resetBlockchain,
    toggleMining,
    forceDifficultyAdjustment,
    updateDifficultySettings,
    updateRigSettings,
    togglePools,
    deletePool,
  } = useRoom();

  const students = useMemo(
    () => (room?.participants ?? []).filter(p => p.role === 'student' && p.isActive),
    [room?.participants]
  );

  const [timeSinceLastBlock, setTimeSinceLastBlock] = useState<number>(0);
  const lastMinedBlock = useMemo(() => {
    if (!blocks || blocks.length === 0) return null;
    const mined = blocks.filter(b => b.status === 'mined' && b.minedAt);
    if (mined.length === 0) return null;
    return mined.reduce((a, b) => new Date(a.minedAt!).getTime() > new Date(b.minedAt!).getTime() ? a : b);
  }, [blocks]);

  useEffect(() => {
    if (!lastMinedBlock?.minedAt) { setTimeSinceLastBlock(0); return; }
    const update = () => {
      const elapsed = Math.floor((Date.now() - new Date(lastMinedBlock.minedAt!).getTime()) / 1000);
      setTimeSinceLastBlock(Math.max(0, elapsed));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastMinedBlock?.minedAt]);

  if (!room) return null;

  return (
    <>
      {/* Blockchain Visualization with Genesis Button */}
      <div className="zone-card">
        <div className="flex items-center gap-2 mb-3">
          <Link className="w-4 h-4 text-heading" />
          <h2 className="font-semibold text-heading">{t('phase6.blockchain')}</h2>
        </div>
        {blocks.filter(b => b.status === 'mined').length === 0 && !blocks.find(b => b.status === 'pending') ? (
          <div className="text-center py-6">
            <Pickaxe className="w-10 h-10 mx-auto text-muted mb-3" />
            <p className="text-secondary mb-3">{t('phase6.noBlocksYet')}</p>
            <button
              onClick={() => createGenesisBlock?.()}
              disabled={blocks.length > 0}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <Pickaxe className="w-4 h-4" />
              {t('phase6.createGenesis')}
            </button>
          </div>
        ) : (
          <BlockchainVisualization
            blocks={blocks}
            pendingBlock={blocks.find(b => b.status === 'pending')}
            currentParticipantId=""
            difficulty={blocks.find(b => b.status === 'pending')?.difficulty || room.currentDifficulty || 2}
          />
        )}
      </div>

      {/* Time since last block */}
      {lastMinedBlock && (
        <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-surface-alt">
          <Clock className="w-4 h-4 text-muted" />
          <span className="text-sm text-secondary">{t('phase7.timeSinceLastBlock')}:</span>
          <span className={`text-sm font-bold tabular-nums ${
            timeSinceLastBlock > (difficultyInfo?.targetBlockTime || 30) * 1.5
              ? 'text-red-500'
              : timeSinceLastBlock > (difficultyInfo?.targetBlockTime || 30)
                ? 'text-amber-500'
                : 'text-heading'
          }`}>
            {timeSinceLastBlock}s
          </span>
        </div>
      )}

      {/* Network Stats + Rig Controls + Miner Ranking */}
      {blocks.filter(b => b.status === 'mined').length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          {/* Network Stats */}
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-heading" />
              <h2 className="text-sm font-semibold text-heading">{t('phase6.networkStats')}</h2>
            </div>
            <div className="space-y-2">
              <div className="p-2 bg-surface-alt rounded-lg text-center">
                <p className="text-xs text-muted">{t('phase6.currentBlock')}</p>
                <p className="font-bold text-heading text-lg">
                  #{blocks.find(b => b.status === 'pending')?.blockNumber || (blocks.filter(b => b.status === 'mined').sort((a, b) => b.blockNumber - a.blockNumber)[0]?.blockNumber || 0) + 1}
                </p>
              </div>
              <div className="p-2 bg-surface-alt rounded-lg text-center">
                <p className="text-xs text-muted">{t('phase7.totalHashrate')}</p>
                <p className="font-bold text-heading text-lg">
                  {students.reduce((sum, s) => sum + ((s.activeRigs ?? 0) * (s.rigSpeed || 4)), 0)} h/s
                </p>
              </div>
              <div className="p-2 bg-surface-alt rounded-lg text-center">
                <p className="text-xs text-muted">{t('phase6.activeMiners')}</p>
                <p className="font-bold text-heading text-lg">
                  {students.filter(s => (s.hashAttempts || 0) > 0).length}/{students.length}
                </p>
              </div>
            </div>
          </div>

          {/* Per-Student Rig Controls */}
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-3">
              <Pickaxe className="w-4 h-4 text-heading" />
              <h2 className="text-sm font-semibold text-heading">{t('phase7.rigControls')}</h2>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {students.map(s => (
                <div key={s.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-surface-alt">
                  <span className="text-xs font-medium text-heading flex-shrink-0 w-20 truncate">{s.name}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        onClick={() => updateRigSettings?.(s.id, { maxRigs: n })}
                        className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                          (s.maxRigs || 1) === n
                            ? 'bg-amber-600 text-white'
                            : 'bg-surface text-muted hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => updateRigSettings?.(s.id, { allowUpgrade: !(s.allowUpgrade || false) })}
                    className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      s.allowUpgrade
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-surface text-muted'
                    }`}
                  >
                    {s.allowUpgrade ? 'UPG' : '\u2014'}
                  </button>
                </div>
              ))}
              {students.length === 0 && (
                <p className="text-xs text-muted text-center py-2">\u2014</p>
              )}
            </div>
          </div>

          {/* Miner Ranking */}
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-semibold text-heading">{t('phase6.minerRanking')}</h2>
            </div>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {[...students]
                .sort((a, b) => (b.blocksMinedCount || 0) - (a.blocksMinedCount || 0))
                .map((student, index) => {
                  const blocksCount = student.blocksMinedCount || 0;
                  const reward = student.totalMiningReward || 0;
                  const rigs = student.activeRigs ?? 0;
                  const speed = student.rigSpeed || 4;
                  return (
                    <div
                      key={student.id}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        blocksCount > 0 ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-surface-alt'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {index === 0 && blocksCount > 0 && (
                          <Trophy className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                        )}
                        {student.poolId && (() => {
                          const pool = miningPools.find(p => p.memberIds.includes(student.id));
                          return pool ? (
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: pool.colorHex }}
                              title={pool.name}
                            />
                          ) : null;
                        })()}
                        <span className="text-sm font-medium text-body truncate">{student.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                        <span className="text-green-600 dark:text-green-400 font-semibold">{reward} BTC</span>
                        <span className="text-muted">{rigs}×{speed}h</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Pools + Period History (left) | Difficulty Adjustment (right) */}
      {blocks.filter(b => b.status === 'mined').length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left column: Pools + Period History */}
          <div className="flex flex-col gap-4">
            {/* Mining Pools Controls */}
            <div className="zone-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users2 className="w-4 h-4 text-heading" />
                  <h2 className="text-sm font-semibold text-heading">{t('pool.title')}</h2>
                </div>
                <button
                  onClick={() => togglePools?.(!poolsEnabled)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    poolsEnabled
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {poolsEnabled ? t('pool.disablePools') : t('pool.enablePools')}
                </button>
              </div>

              {poolsEnabled && miningPools.length > 0 && (
                <div className="space-y-2">
                  {miningPools.map(pool => {
                    const networkHashrate = students.reduce((sum, s) => sum + ((s.activeRigs ?? 0) * (s.rigSpeed || 4)), 0);
                    const poolShare = networkHashrate > 0 ? Math.round((pool.totalHashrate / networkHashrate) * 100) : 0;
                    return (
                      <div key={pool.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-alt">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: pool.colorHex }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-heading truncate">{pool.name}</span>
                            <span className="text-[10px] text-muted">{pool.memberIds.length} {t('pool.members').toLowerCase()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted">
                            <span>{pool.totalHashrate} h/s</span>
                            <span>&middot;</span>
                            <span>{poolShare}% {t('pool.networkShare')}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => deletePool?.(pool.id)}
                          className="text-red-500 hover:text-red-700 text-xs px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          &#x2715;
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {poolsEnabled && miningPools.length === 0 && (
                <p className="text-xs text-muted text-center py-3">{t('pool.noPool')}</p>
              )}

              {!poolsEnabled && (
                <p className="text-xs text-muted text-center py-3">{t('pool.poolsDisabled')}</p>
              )}
            </div>

            {/* Period History */}
            {difficultyInfo && (
              <div className="zone-card">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-heading" />
                  <h2 className="text-sm font-semibold text-heading">{t('phase7.periodHistory')}</h2>
                </div>
                {difficultyInfo.periodHistory.length > 0 ? (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {difficultyInfo.periodHistory.slice().reverse().map((period, idx) => (
                      <div key={period.periodNumber} className={`p-2 rounded text-sm ${
                        idx === 0 ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-surface-alt'
                      }`}>
                        <span className="font-medium">P{period.periodNumber}:</span>{' '}
                        <span>{period.totalTimeSeconds}s</span>{' '}
                        <span className="text-muted">({t('phase7.avgShort')}: {period.avgTimePerBlock}s)</span>
                        {period.avgTimePerBlock > 0 && (
                          <span className={
                            period.avgTimePerBlock < difficultyInfo.targetBlockTime * 0.8
                              ? ' text-red-500'
                              : period.avgTimePerBlock > difficultyInfo.targetBlockTime * 1.2
                                ? ' text-blue-500'
                                : ' text-green-500'
                          }>
                            {' \u2192 '}{period.avgTimePerBlock < difficultyInfo.targetBlockTime * 0.8
                              ? t('phase7.tooFast')
                              : period.avgTimePerBlock > difficultyInfo.targetBlockTime * 1.2
                                ? t('phase7.tooSlow')
                                : t('phase7.onTarget')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted text-center py-4">{t('phase7.noPeriodYet')}</p>
                )}
              </div>
            )}
          </div>

          {/* Right column: Difficulty Adjustment */}
          {difficultyInfo && (
            <div className="zone-card">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-heading" />
                <h2 className="text-sm font-semibold text-heading">{t('phase7.difficultyAdjustment')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-2 bg-surface-alt rounded-lg text-center">
                  <p className="text-[10px] text-muted">{t('phase7.currentDifficulty')}</p>
                  <p className="font-bold text-heading text-lg">
                    {difficultyInfo.miningTarget
                      ? difficultyInfo.miningTarget.toString(16).toUpperCase().padStart(4, '0')
                      : difficultyInfo.currentDifficulty}
                  </p>
                  {difficultyInfo.miningTarget && difficultyInfo.avgTimePerBlock > 0 && (() => {
                    const ratio = difficultyInfo.avgTimePerBlock / difficultyInfo.targetBlockTime;
                    if (ratio >= 0.85 && ratio <= 1.15) return null;
                    const clamped = Math.max(0.25, Math.min(4, ratio));
                    const est = Math.max(1, Math.min(65535, Math.round(difficultyInfo.miningTarget! * clamped)));
                    return (
                      <p className={`text-[10px] mt-0.5 ${est < difficultyInfo.miningTarget! ? 'text-red-500' : 'text-blue-500'}`}>
                        {t('phase7.estimatedNext')}: {est.toString(16).toUpperCase().padStart(4, '0')}
                      </p>
                    );
                  })()}
                </div>
                <div className="p-2 bg-surface-alt rounded-lg text-center">
                  <p className="text-[10px] text-muted">{t('phase7.targetBlockTime')}</p>
                  <p className="font-bold text-heading text-lg">{difficultyInfo.targetBlockTime}s</p>
                </div>
                <div className="p-2 bg-surface-alt rounded-lg text-center">
                  <p className="text-[10px] text-muted">{t('phase7.avgTimePerBlock')}</p>
                  <p className={`font-bold text-lg ${
                    difficultyInfo.avgTimePerBlock > 0
                      ? difficultyInfo.avgTimePerBlock < difficultyInfo.targetBlockTime * 0.8
                        ? 'text-red-500'
                        : difficultyInfo.avgTimePerBlock > difficultyInfo.targetBlockTime * 1.2
                          ? 'text-blue-500'
                          : 'text-green-500'
                      : 'text-heading'
                  }`}>
                    {difficultyInfo.avgTimePerBlock > 0 ? `${difficultyInfo.avgTimePerBlock}s` : '--'}
                  </p>
                </div>
                <div className="p-2 bg-surface-alt rounded-lg text-center">
                  <p className="text-[10px] text-muted">{t('phase7.blocksInPeriod')}</p>
                  <p className="font-bold text-heading text-lg">
                    {difficultyInfo.blocksInCurrentPeriod}/{difficultyInfo.adjustmentInterval}
                  </p>
                </div>
              </div>
              {/* Target Time Selector */}
              <div className="flex items-center justify-between p-2 bg-surface-alt rounded-lg">
                <p className="text-xs text-muted">{t('phase7.targetBlockTime')}</p>
                <div className="flex gap-1.5">
                  {[15, 30].map(sec => (
                    <button
                      key={sec}
                      onClick={async () => {
                        await updateDifficultySettings?.({ targetBlockTime: sec });
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        difficultyInfo.targetBlockTime === sec
                          ? 'bg-amber-600 text-white'
                          : 'bg-surface text-muted hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
