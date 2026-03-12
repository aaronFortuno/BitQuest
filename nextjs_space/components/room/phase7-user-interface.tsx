'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pickaxe, Clock, Lock, Unlock, Zap, Activity,
  CheckCircle, XCircle, TrendingUp, TrendingDown, Minus,
  Info, Settings, Link, ArrowUp,
} from 'lucide-react';
import { Room, Participant, Block } from '@/lib/types';
import { DifficultyInfo } from '@/hooks/use-room-polling';
import { RigState, BlockEvent } from '@/hooks/use-auto-mining';
import { BlockchainVisualization } from './blockchain-visualization';

interface Phase7UserInterfaceProps {
  room: Room;
  participant: Participant;
  blocks: Block[];
  difficultyInfo?: DifficultyInfo | null;
  // Auto-mining
  rigs: RigState[];
  totalHashrate: number;
  isAnyMining: boolean;
  lastBlockEvent: BlockEvent | null;
  onToggleRig: (rigId: number) => void;
  onUpgradeRig: (newSpeed: number) => Promise<void>;
  onCreateGenesisBlock: () => Promise<void>;
}

function RigCard({
  rig,
  maxRigs,
  allowUpgrade,
  onToggle,
  onUpgrade,
}: {
  rig: RigState;
  maxRigs: number;
  allowUpgrade: boolean;
  onToggle: () => void;
  onUpgrade: (speed: number) => void;
}) {
  const { t } = useTranslation();
  const nextSpeed = rig.speed === 4 ? 8 : rig.speed === 8 ? 20 : null;

  if (rig.isLocked) {
    return (
      <div className="zone-card opacity-60 flex flex-col items-center justify-center py-6 gap-2">
        <Lock className="w-8 h-8 text-muted" />
        <p className="text-xs text-muted text-center">{t('phase7.lockedRig')}</p>
      </div>
    );
  }

  return (
    <div className={`zone-card flex flex-col gap-3 ${rig.isActive ? '' : 'opacity-70'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Pickaxe className={`w-4 h-4 ${rig.isActive ? 'text-amber-500' : 'text-muted'}`} />
          <span className="text-sm font-semibold text-heading">
            {t('phase7.rig')} {rig.id + 1}
          </span>
        </div>
        <button
          onClick={onToggle}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            rig.isActive
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          {rig.isActive ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Speed */}
      <div className="text-center">
        <span className="text-2xl font-bold text-heading">{rig.speed}</span>
        <span className="text-xs text-muted ml-1">h/s</span>
      </div>

      {/* Animation / Hash Display */}
      <div className="bg-surface-alt rounded-lg p-2 min-h-[48px] flex items-center justify-center">
        {rig.isActive && rig.lastHash ? (
          <div className="text-center">
            <code className={`text-[10px] font-mono ${rig.lastHashValid ? 'text-green-500 font-bold' : 'text-muted'}`}>
              {rig.lastHash.substring(0, 12)}...
            </code>
            <div className="text-[9px] text-muted mt-0.5">
              nonce: {rig.currentNonce.toLocaleString()}
            </div>
          </div>
        ) : rig.isActive ? (
          <div className="flex items-center gap-1.5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Pickaxe className="w-4 h-4 text-amber-500" />
            </motion.div>
            <span className="text-xs text-muted">{t('phase7.waiting')}...</span>
          </div>
        ) : (
          <span className="text-xs text-muted">{t('phase7.inactive')}</span>
        )}
      </div>

      {/* Stats */}
      <div className="text-center text-xs text-muted">
        {rig.totalHashes.toLocaleString()} hashes
      </div>

      {/* Upgrade button */}
      {allowUpgrade && nextSpeed && rig.isActive && (
        <button
          onClick={() => onUpgrade(nextSpeed)}
          className="w-full py-1.5 rounded-lg text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30 transition-colors flex items-center justify-center gap-1"
        >
          <ArrowUp className="w-3 h-3" />
          {t('phase7.upgrade')} → {nextSpeed} h/s
        </button>
      )}
    </div>
  );
}

export function Phase7UserInterface({
  room,
  participant,
  blocks,
  difficultyInfo,
  rigs,
  totalHashrate,
  isAnyMining,
  lastBlockEvent,
  onToggleRig,
  onUpgradeRig,
  onCreateGenesisBlock,
}: Phase7UserInterfaceProps) {
  const { t } = useTranslation();
  const pendingBlock = blocks.find(b => b.status === 'pending');
  const minedBlocks = blocks.filter(b => b.status === 'mined').sort((a, b) => b.blockNumber - a.blockNumber);
  const hasGenesis = blocks.some(b => b.status === 'mined' && b.blockNumber === 1);
  const myBlocks = minedBlocks.filter(b => b.minerId === participant.id);
  const myReward = myBlocks.reduce((sum, b) => sum + (b.reward || 0), 0);
  const maxRigs = participant.maxRigs || 1;
  const allowUpgrade = participant.allowUpgrade || false;

  // Time since last block counter
  const [timeSinceLastBlock, setTimeSinceLastBlock] = useState(0);
  const lastMinedBlock = useMemo(() => {
    if (minedBlocks.length === 0) return null;
    return minedBlocks[0]; // already sorted desc
  }, [minedBlocks]);

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

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto">
      {/* Block Event Notification */}
      <AnimatePresence>
        {lastBlockEvent && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-3 rounded-xl flex items-center gap-2 ${
              lastBlockEvent.type === 'mined'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : lastBlockEvent.type === 'lost'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {lastBlockEvent.type === 'mined' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span className="text-sm">
              {lastBlockEvent.message}
              {lastBlockEvent.reward && ` (+${lastBlockEvent.reward} BTC)`}
              {lastBlockEvent.difficultyChange && lastBlockEvent.difficultyChange.result !== 'stable' && (
                <span className="ml-2">
                  | {t('phase7.difficulty')}: {lastBlockEvent.difficultyChange.from} → {lastBlockEvent.difficultyChange.to}
                </span>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waiting for genesis */}
      {!hasGenesis && (
        <div className="zone-card">
          <div className="text-center py-8">
            <Clock className="w-10 h-10 mx-auto text-muted mb-3" />
            <p className="text-body font-medium mb-1">{t('phase6.waitingForGenesis')}</p>
            <p className="text-sm text-secondary">{t('phase6.teacherWillStart')}</p>
          </div>
        </div>
      )}

      {/* Blockchain Visualization */}
      {hasGenesis && (
        <div className="zone-card">
          <div className="flex items-center gap-2 mb-3">
            <Link className="w-4 h-4 text-heading" />
            <h2 className="font-semibold text-heading">{t('phase6.blockchain')}</h2>
          </div>
          <BlockchainVisualization
            blocks={blocks}
            pendingBlock={pendingBlock}
            currentParticipantId={participant.id}
            difficulty={pendingBlock?.difficulty || room.currentDifficulty || 2}
          />
        </div>
      )}

      {/* Time since last block */}
      {hasGenesis && lastMinedBlock && (
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-surface-alt">
          <Clock className="w-3.5 h-3.5 text-muted" />
          <span className="text-xs text-secondary">{t('phase7.timeSinceLastBlock')}:</span>
          <span className={`text-xs font-bold tabular-nums ${
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

      {/* Difficulty Info + Node Status side by side */}
      {hasGenesis && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left: Difficulty Adjustment Info */}
          {difficultyInfo && (
            <div className="zone-card">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="w-4 h-4 text-heading" />
                <h2 className="text-sm font-semibold text-heading">{t('phase7.difficultyAdjustment')}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface-alt rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted">{t('phase7.currentDifficulty')}</p>
                  <p className="font-bold text-heading text-lg font-mono">
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
                <div className="bg-surface-alt rounded-lg p-2 text-center">
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
                  <p className="text-[10px] text-muted">({t('phase7.target')}: {difficultyInfo.targetBlockTime}s)</p>
                </div>
                <div className="bg-surface-alt rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted">{t('phase7.blocksInPeriod')}</p>
                  <p className="font-bold text-heading text-lg">
                    {difficultyInfo.blocksInCurrentPeriod}/{difficultyInfo.adjustmentInterval}
                  </p>
                </div>
                <div className="bg-surface-alt rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted">{t('phase7.prediction')}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {difficultyInfo.prediction === 'up' ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-bold text-red-500">{t('phase7.willIncrease')}</span>
                      </>
                    ) : difficultyInfo.prediction === 'down' ? (
                      <>
                        <TrendingDown className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-bold text-blue-500">{t('phase7.willDecrease')}</span>
                      </>
                    ) : (
                      <>
                        <Minus className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-bold text-green-500">{t('phase7.willStable')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right: Node Status */}
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-heading" />
              <h2 className="text-sm font-semibold text-heading">{t('phase6.nodeStatus')}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-alt rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted">{t('phase6.blocksMinedShort')}</p>
                <p className="font-bold text-heading text-lg">{myBlocks.length}</p>
              </div>
              <div className="bg-surface-alt rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted">{t('phase6.balanceShort')}</p>
                <p className="font-bold text-green-600 dark:text-green-400 text-lg">{myReward} BTC</p>
              </div>
              <div className="bg-surface-alt rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted">{t('phase7.hashrate')}</p>
                <p className="font-bold text-heading text-lg">{totalHashrate} h/s</p>
              </div>
              <div className="bg-surface-alt rounded-lg p-2 text-center">
                <p className="text-[10px] text-muted">{t('phase7.rigs')}</p>
                <p className="font-bold text-heading text-lg">
                  {rigs.filter(r => r.isActive && !r.isLocked).length}/{maxRigs}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mining Rigs */}
      {hasGenesis && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Pickaxe className="w-4 h-4 text-heading" />
            <h2 className="text-sm font-semibold text-heading">{t('phase7.miningRigs')}</h2>
            {isAnyMining && (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Zap className="w-3 h-3" /> {totalHashrate} h/s
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {rigs.map(rig => (
              <RigCard
                key={rig.id}
                rig={rig}
                maxRigs={maxRigs}
                allowUpgrade={allowUpgrade}
                onToggle={() => onToggleRig(rig.id)}
                onUpgrade={onUpgradeRig}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
