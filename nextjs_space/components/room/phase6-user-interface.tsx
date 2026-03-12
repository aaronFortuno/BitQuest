'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Pickaxe, Send, Hash, Activity,
  CheckCircle, XCircle, AlertTriangle, Loader2,
  ArrowRight, Zap, Info, Settings, TrendingUp, TrendingDown, Minus,
  Link, Coins, Clock,
} from 'lucide-react';
import { Room, Participant, Block, BlockTransaction } from '@/lib/types';
import { DifficultyInfo } from '@/hooks/use-room-polling';
import { BlockchainVisualization } from './blockchain-visualization';
import Phase6BlockchainPanel from './phase6-blockchain-panel';

interface Phase6UserInterfaceProps {
  room: Room;
  participant: Participant;
  blocks: Block[];
  difficultyInfo?: DifficultyInfo | null;
  onCreatePendingBlock: () => Promise<Block | null>;
  onCalculateHash: (nonce: number) => Promise<{
    hash: string;
    hashShort: string;
    isValid: boolean;
    difficulty: number;
    blockNumber: number;
  } | null>;
  onSubmitBlock: (nonce: number, hash: string) => Promise<{
    success: boolean;
    error?: string;
    code?: string;
    block?: Block;
    reward?: number;
    difficultyAdjustment?: {
      previousDifficulty: number;
      newDifficulty: number;
      result: 'increased' | 'decreased' | 'stable';
    };
  }>;
}

export function Phase6UserInterface({
  room,
  participant,
  blocks,
  difficultyInfo,
  onCreatePendingBlock,
  onCalculateHash,
  onSubmitBlock
}: Phase6UserInterfaceProps) {
  const { t } = useTranslation();
  const [currentNonce, setCurrentNonce] = useState(Math.floor(Math.random() * 10000));
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [isValidHash, setIsValidHash] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isMining, setIsMining] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const pendingBlock = blocks.find(b => b.status === 'pending');
  const minedBlocks = blocks.filter(b => b.status === 'mined').sort((a, b) => b.blockNumber - a.blockNumber);
  const lastMinedBlock = minedBlocks[0];

  // Has genesis been created?
  const hasGenesis = blocks.some(b => b.status === 'mined' && b.blockNumber === 1);

  // Participant names for educational panel
  const participantNames = room.participants?.map((p: Participant) => p.name) || [];

  useEffect(() => {
    if (pendingBlock) {
      setLastHash(null);
      setIsValidHash(false);
      setAttempts(0);
      setCurrentNonce(Math.floor(Math.random() * 10000));
    }
  }, [pendingBlock?.id]);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleMineClick = useCallback(async () => {
    if (!pendingBlock || isMining || isValidHash) return;

    setIsMining(true);

    const newNonce = currentNonce + 1;
    setCurrentNonce(newNonce);

    const result = await onCalculateHash(newNonce);

    if (result) {
      setLastHash(result.hash);
      setIsValidHash(result.isValid);
      setAttempts(prev => prev + 1);

      if (result.isValid) {
        setFeedback({
          type: 'success',
          message: t('phase6.foundValidHash')
        });
      }
    }

    setIsMining(false);
  }, [pendingBlock, currentNonce, isMining, isValidHash, onCalculateHash, t]);

  const handleSubmitBlock = useCallback(async () => {
    if (!pendingBlock || !lastHash || isSubmitting) return;

    setIsSubmitting(true);

    const result = await onSubmitBlock(currentNonce, lastHash);

    if (result.success) {
      let message = t('phase6.blockAccepted', { reward: result.reward || 50 });
      if (result.difficultyAdjustment) {
        const { previousDifficulty, newDifficulty, result: adjustment } = result.difficultyAdjustment;
        if (adjustment === 'increased') {
          message += ' ' + t('phase7.difficultyIncreased', { from: previousDifficulty, to: newDifficulty });
        } else if (adjustment === 'decreased') {
          message += ' ' + t('phase7.difficultyDecreased', { from: previousDifficulty, to: newDifficulty });
        }
      }
      setFeedback({ type: 'success', message });
      setLastHash(null);
      setIsValidHash(false);
      setAttempts(0);
      setCurrentNonce(Math.floor(Math.random() * 10000));
    } else {
      if (result.code === 'ALREADY_MINED') {
        setFeedback({ type: 'error', message: t('phase6.tooLate') });
        setLastHash(null);
        setIsValidHash(false);
        setAttempts(0);
        setCurrentNonce(Math.floor(Math.random() * 10000));
      } else if (result.code === 'HASH_NOT_VALID') {
        setFeedback({ type: 'error', message: t('phase6.invalidHash') });
      } else {
        setFeedback({ type: 'error', message: result.error || t('phase6.submitError') });
      }
    }

    setIsSubmitting(false);
  }, [pendingBlock, lastHash, currentNonce, isSubmitting, onSubmitBlock, t]);

  const previousHashDisplay = pendingBlock?.previousHash || lastMinedBlock?.hash || null;
  const previousBlockNumber = pendingBlock
    ? pendingBlock.blockNumber - 1
    : lastMinedBlock?.blockNumber || 0;
  const isGenesisParent = previousHashDisplay === '0000000000000000';

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto">
      {/* Educational Panel — collapsed by default for students */}
      <Phase6BlockchainPanel defaultCollapsed={true} participantNames={participantNames} />

      {/* Feedback Messages */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-3 rounded-xl flex items-center gap-2 ${
              feedback.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
              feedback.type === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
              'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
             feedback.type === 'error' ? <XCircle className="w-5 h-5" /> :
             <Info className="w-5 h-5" />}
            <span>{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 7: Difficulty Adjustment Panel */}
      {room.currentPhase >= 7 && difficultyInfo && (
        <div className="zone-card">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-5 h-5 text-purple-500" />
            <h2 className="font-semibold text-heading">{t('phase7.difficultyAdjustment')}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span className="text-sm text-secondary">{t('phase7.currentPeriod')}</span>
              <span className="text-xl font-bold text-heading">
                {t('phase7.blockRange', {
                  start: difficultyInfo.periodStartBlock,
                  end: difficultyInfo.periodEndBlock
                })}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-secondary">{t('phase7.blocksInPeriod')}</span>
              <span className="text-xl font-bold text-heading">
                {difficultyInfo.blocksInCurrentPeriod}/{difficultyInfo.adjustmentInterval}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-secondary">{t('phase7.avgTimePerBlock')}</span>
              <span className={`text-xl font-bold ${
                difficultyInfo.avgTimePerBlock > 0
                  ? difficultyInfo.avgTimePerBlock < difficultyInfo.targetBlockTime * 0.8
                    ? 'text-red-500'
                    : difficultyInfo.avgTimePerBlock > difficultyInfo.targetBlockTime * 1.2
                      ? 'text-blue-500'
                      : 'text-green-500'
                  : 'text-heading'
              }`}>
                {difficultyInfo.avgTimePerBlock > 0 ? `${difficultyInfo.avgTimePerBlock}s` : '--'}
              </span>
              <span className="text-xs text-muted">
                ({t('phase7.target')}: {difficultyInfo.targetBlockTime}s)
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-secondary">{t('phase7.prediction')}</span>
              <div className="flex items-center gap-2">
                {difficultyInfo.prediction === 'up' ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-red-500" />
                    <span className="text-red-500 font-bold">{t('phase7.willIncrease')}</span>
                  </>
                ) : difficultyInfo.prediction === 'down' ? (
                  <>
                    <TrendingDown className="w-5 h-5 text-blue-500" />
                    <span className="text-blue-500 font-bold">{t('phase7.willDecrease')}</span>
                  </>
                ) : (
                  <>
                    <Minus className="w-5 h-5 text-green-500" />
                    <span className="text-green-500 font-bold">{t('phase7.willStable')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 bg-surface-alt rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 text-purple-500 flex-shrink-0" />
              <p className="text-sm text-secondary">
                {t('phase7.adjustmentInfo', {
                  interval: difficultyInfo.adjustmentInterval,
                  target: difficultyInfo.targetBlockTime
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Waiting for genesis — shown when teacher hasn't started yet */}
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

      {/* Mining + Submit in 2-column grid */}
      {hasGenesis && (
        <div className="grid md:grid-cols-2 gap-4 flex-1">
          {/* Left Column: Mining Zone */}
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-3">
              <Pickaxe className="w-5 h-5 text-heading" />
              <h2 className="font-semibold text-heading">
                {t('phase6.miningBlock')} #{pendingBlock?.blockNumber || '?'}
              </h2>
            </div>

            {!pendingBlock ? (
              <div className="text-center py-6">
                <AlertTriangle className="w-10 h-10 mx-auto text-muted mb-3" />
                <p className="text-secondary">{t('phase6.noPendingBlock')}</p>
                <p className="text-xs text-muted mt-1">{t('phase6.waitingForBlock')}</p>
                <button
                  onClick={async () => {
                    await onCreatePendingBlock();
                  }}
                  className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors inline-flex items-center gap-2"
                >
                  <Pickaxe className="w-4 h-4" />
                  {t('phase6.startMining')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Previous Hash */}
                {previousHashDisplay && (
                  <div className="bg-surface-alt rounded-lg p-2.5 text-sm">
                    <div className="flex items-center justify-center gap-1.5 text-body">
                      <Link className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-medium">
                        {t('phase6.previousBlock')}: {isGenesisParent ? (
                          <span>{t('phase6.genesis')} (0000...)</span>
                        ) : (
                          <span>#{previousBlockNumber} | </span>
                        )}
                      </span>
                      {!isGenesisParent && (
                        <span className="font-mono text-xs">
                          {(() => {
                            const h = previousHashDisplay;
                            const zeros = h.match(/^0+/)?.[0] || '';
                            const rest = h.substring(zeros.length, 8);
                            return (
                              <>
                                <span className="text-green-600 dark:text-green-400 font-bold">{zeros}</span>
                                <span>{rest}</span>...
                              </>
                            );
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Block Content */}
                <div className="bg-surface-alt rounded-lg p-3 text-sm">
                  <p className="font-medium text-body mb-2 text-center">{t('phase6.blockContent')}:</p>
                  <div className="space-y-1">
                    {pendingBlock.transactions.slice(0, 3).map((tx: BlockTransaction, i: number) => (
                      <div key={i} className="flex items-center justify-center gap-1 text-secondary">
                        <ArrowRight className="w-3 h-3" />
                        {tx.sender} → {tx.receiver} ({tx.amount} BTC)
                      </div>
                    ))}
                    {pendingBlock.transactions.length > 3 && (
                      <p className="text-secondary text-center">...+ {pendingBlock.transactions.length - 3} {t('phase6.more')}</p>
                    )}
                    <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 font-medium mt-2">
                      <Coins className="w-3 h-3" />
                      {t('phase6.rewardForMe')}: {pendingBlock.reward} BTC
                    </div>
                  </div>
                </div>

                {/* Hash formula */}
                <div className="bg-surface-alt rounded-lg p-2 text-center">
                  <code className="text-xs text-secondary">
                    Hash = SHA256( #{pendingBlock.blockNumber} : prevHash : txs : <span className="text-amber-600 dark:text-amber-400 font-bold">nonce</span> )
                  </code>
                </div>

                {/* Nonce Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-body">{t('phase6.currentNonce')}:</label>
                  <input
                    type="number"
                    value={currentNonce}
                    onChange={(e) => setCurrentNonce(parseInt(e.target.value) || 0)}
                    readOnly={isValidHash}
                    className="w-full input-field font-mono text-center text-lg py-2"
                  />
                </div>

                {/* Mine Button */}
                <button
                  onClick={handleMineClick}
                  disabled={isMining || isValidHash}
                  className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                    isValidHash
                      ? 'bg-green-600 text-white cursor-default'
                      : 'bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60'
                  }`}
                >
                  {isValidHash ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      {t('phase6.validHashFound')}
                    </>
                  ) : isMining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('phase6.createNewHash')}
                    </>
                  ) : (
                    <>
                      <Hash className="w-5 h-5" />
                      {t('phase6.createNewHash')}
                    </>
                  )}
                </button>

                {/* Hash Result */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-body">{t('phase6.hashResult')}:</label>
                  <div className={`p-3 rounded-lg font-mono text-center text-lg ${
                    lastHash
                      ? isValidHash
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      : 'bg-surface-alt text-muted'
                  }`}>
                    {lastHash ? (
                      <div className="flex items-center justify-center gap-2">
                        <span>{lastHash.substring(0, 8).toUpperCase()}...</span>
                        {isValidHash ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                    ) : (
                      '--------'
                    )}
                  </div>
                  <p className="text-xs text-muted text-center">
                    {t('phase6.target')}: {t('phase6.hashStartsWith')} {'0'.repeat(pendingBlock.difficulty)}...
                  </p>
                </div>

                {/* Attempts counter */}
                <div className="text-center text-sm text-secondary">
                  {t('phase6.attempts')}: <strong>{attempts}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Submit + Node Status stacked */}
          <div className="flex flex-col gap-4">
            {/* Announce Block */}
            <div className="zone-card">
              <div className="flex items-center gap-2 mb-3">
                <Send className="w-5 h-5 text-heading" />
                <h2 className="font-semibold text-heading">{t('phase6.announceBlock')}</h2>
              </div>

              <div className="space-y-4">
                {isValidHash && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-green-100 dark:bg-green-900/20 rounded-lg p-4 text-center"
                  >
                    <Zap className="w-8 h-8 mx-auto text-green-500 mb-2" />
                    <p className="font-medium text-green-700 dark:text-green-400">
                      {t('phase6.validHashFound')}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {t('phase6.submitQuickly')}
                    </p>
                  </motion.div>
                )}

                <button
                  onClick={handleSubmitBlock}
                  disabled={!isValidHash || isSubmitting}
                  className="w-full py-3 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  {t('phase6.submitToNetwork')}
                </button>

                {!isValidHash && (
                  <div className="bg-surface-alt rounded-lg p-3 text-sm">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 text-muted flex-shrink-0" />
                      <p className="text-secondary">{t('phase6.submitInfo')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Node Status */}
            <div className="zone-card">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-heading" />
                <h2 className="text-sm font-semibold text-heading">{t('phase6.nodeStatus')}</h2>
              </div>
              <div className="flex items-center justify-around text-xs text-secondary">
                <div className="flex flex-col items-center">
                  <span className="font-bold text-heading text-sm">
                    {minedBlocks.filter(b => b.minerId === participant.id).length}
                  </span>
                  <span>{t('phase6.blocksMinedShort')}</span>
                </div>
                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />
                <div className="flex flex-col items-center">
                  <span className="font-bold text-heading text-sm">
                    {minedBlocks.filter(b => b.minerId === participant.id).reduce((sum, b) => sum + (b.reward || 0), 0)} BTC
                  </span>
                  <span>{t('phase6.balanceShort')}</span>
                </div>
                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700" />
                <div className="flex flex-col items-center">
                  <span className="font-bold text-heading text-sm">{attempts}</span>
                  <span>{t('phase6.attemptsShort')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
