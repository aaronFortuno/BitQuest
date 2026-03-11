'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Pickaxe, Send, Coins, Trophy, Clock, Hash,
  CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw,
  ArrowRight, Zap, Info, Settings, TrendingUp, TrendingDown, Minus, Target,
  Lightbulb, ChevronDown, ChevronUp, Link
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Room, Participant, Block, BlockTransaction } from '@/lib/types';
import { DifficultyInfo } from '@/hooks/use-room-polling';
import { BlockchainVisualization } from './blockchain-visualization';

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
  const [showEducational, setShowEducational] = useState(true);

  // Get current pending block and last mined block
  const pendingBlock = blocks.find(b => b.status === 'pending');
  const minedBlocks = blocks.filter(b => b.status === 'mined').sort((a, b) => b.blockNumber - a.blockNumber);
  const lastMinedBlock = minedBlocks[0];
  const myMinedBlocks = minedBlocks.filter(b => b.minerId === participant.id);

  // Reset mining state when pending block changes
  useEffect(() => {
    if (pendingBlock) {
      setLastHash(null);
      setIsValidHash(false);
      setAttempts(0);
      setCurrentNonce(Math.floor(Math.random() * 10000));
    }
  }, [pendingBlock?.id]);

  // Clear feedback after delay
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Handle hash calculation (mining attempt)
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

  // Handle block submission
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

  // Initialize pending block if none exists
  const handleInitializeBlock = useCallback(async () => {
    await onCreatePendingBlock();
    setFeedback({ type: 'info', message: t('phase6.blockCreated') });
  }, [onCreatePendingBlock, t]);

  // Previous hash display info
  const previousHashDisplay = pendingBlock?.previousHash || lastMinedBlock?.hash || null;
  const previousBlockNumber = pendingBlock
    ? pendingBlock.blockNumber - 1
    : lastMinedBlock?.blockNumber || 0;
  const isGenesisParent = previousHashDisplay === '0000000000000000';

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto">
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

      {/* Educational Panel (collapsible) */}
      <Card className="border-amber-200 dark:border-amber-800 rounded-xl">
        <button
          onClick={() => setShowEducational(!showEducational)}
          className="w-full p-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <span className="font-medium text-sm">{t('phase6.howMiningWorks')}</span>
          </div>
          {showEducational ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <AnimatePresence>
          {showEducational && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0 pb-3 px-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                    <span className="text-muted-foreground">{t('phase6.edu1')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                    <span className="text-muted-foreground">{t('phase6.edu2')}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                    <span className="text-muted-foreground">
                      {t('phase6.edu3', { zeros: pendingBlock?.difficulty || room.currentDifficulty || 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Phase 7: Difficulty Adjustment Panel */}
      {room.currentPhase >= 7 && difficultyInfo && (
        <Card className="border-purple-200 dark:border-purple-800 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5 text-purple-500" />
              {t('phase7.difficultyAdjustment')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">{t('phase7.currentPeriod')}</span>
                <span className="text-xl font-bold">
                  {t('phase7.blockRange', {
                    start: difficultyInfo.periodStartBlock,
                    end: difficultyInfo.periodEndBlock
                  })}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">{t('phase7.blocksInPeriod')}</span>
                <span className="text-xl font-bold">
                  {difficultyInfo.blocksInCurrentPeriod}/{difficultyInfo.adjustmentInterval}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">{t('phase7.avgTimePerBlock')}</span>
                <span className={`text-xl font-bold ${
                  difficultyInfo.avgTimePerBlock > 0
                    ? difficultyInfo.avgTimePerBlock < difficultyInfo.targetBlockTime * 0.8
                      ? 'text-red-500'
                      : difficultyInfo.avgTimePerBlock > difficultyInfo.targetBlockTime * 1.2
                        ? 'text-blue-500'
                        : 'text-green-500'
                    : ''
                }`}>
                  {difficultyInfo.avgTimePerBlock > 0 ? `${difficultyInfo.avgTimePerBlock}s` : '--'}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({t('phase7.target')}: {difficultyInfo.targetBlockTime}s)
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">{t('phase7.prediction')}</span>
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
            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 text-purple-500 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {t('phase7.adjustmentInfo', {
                    interval: difficultyInfo.adjustmentInterval,
                    target: difficultyInfo.targetBlockTime
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blockchain Visualization */}
      <Card className="border-amber-200 dark:border-amber-800 rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link className="w-4 h-4 text-amber-500" />
            {t('phase6.blockchain')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <BlockchainVisualization
            blocks={blocks}
            pendingBlock={pendingBlock}
            currentParticipantId={participant.id}
            difficulty={pendingBlock?.difficulty || room.currentDifficulty || 2}
          />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 flex-1">
        {/* Left Column: Mining Zone */}
        <Card className="border-amber-200 dark:border-amber-800 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pickaxe className="w-5 h-5 text-amber-500" />
              {t('phase6.miningBlock')} #{pendingBlock?.blockNumber || '?'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!pendingBlock ? (
              <div className="text-center py-6">
                <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                <p className="text-muted-foreground mb-4">{t('phase6.noPendingBlock')}</p>
                <Button onClick={handleInitializeBlock} className="bg-amber-500 hover:bg-amber-600">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('phase6.createBlock')}
                </Button>
              </div>
            ) : (
              <>
                {/* Previous Hash (Pas 7) */}
                {previousHashDisplay && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 text-sm">
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
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
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium mb-2">{t('phase6.blockContent')}:</p>
                  <ul className="space-y-1">
                    {pendingBlock.transactions.slice(0, 3).map((tx: BlockTransaction, i: number) => (
                      <li key={i} className="flex items-center gap-1 text-muted-foreground">
                        <ArrowRight className="w-3 h-3" />
                        {tx.sender} → {tx.receiver} ({tx.amount} BTC)
                      </li>
                    ))}
                    {pendingBlock.transactions.length > 3 && (
                      <li className="text-muted-foreground">...+ {pendingBlock.transactions.length - 3} {t('phase6.more')}</li>
                    )}
                    <li className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium mt-2">
                      <Coins className="w-3 h-3" />
                      {t('phase6.rewardForMe')}: {pendingBlock.reward} BTC
                    </li>
                  </ul>
                </div>

                {/* Hash formula */}
                <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-lg p-2 text-center">
                  <code className="text-xs text-muted-foreground">
                    Hash = SHA256( #{pendingBlock.blockNumber} : prevHash : txs : <span className="text-amber-600 dark:text-amber-400 font-bold">nonce</span> )
                  </code>
                </div>

                {/* Nonce Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('phase6.currentNonce')}:</label>
                  <Input
                    type="number"
                    value={currentNonce}
                    onChange={(e) => setCurrentNonce(parseInt(e.target.value) || 0)}
                    readOnly={isValidHash}
                    className="font-mono text-center text-lg"
                  />
                </div>

                {/* Mine Button */}
                <Button
                  onClick={handleMineClick}
                  disabled={isMining || isValidHash}
                  className={`w-full ${isValidHash ? 'bg-green-500 hover:bg-green-500 cursor-default' : 'bg-amber-500 hover:bg-amber-600'}`}
                  size="lg"
                >
                  {isValidHash ? (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      {t('phase6.validHashFound')}
                    </>
                  ) : isMining ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t('phase6.createNewHash')}
                    </>
                  ) : (
                    <>
                      <Hash className="w-5 h-5 mr-2" />
                      {t('phase6.createNewHash')}
                    </>
                  )}
                </Button>

                {/* Hash Result */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('phase6.hashResult')}:</label>
                  <div className={`p-3 rounded-lg font-mono text-center text-lg ${
                    lastHash
                      ? isValidHash
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : 'bg-muted text-muted-foreground'
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
                  <p className="text-xs text-muted-foreground text-center">
                    {t('phase6.target')}: {t('phase6.hashStartsWith')} {'0'.repeat(pendingBlock.difficulty)}...
                  </p>
                </div>

                {/* Attempts counter */}
                <div className="text-center text-sm text-muted-foreground">
                  {t('phase6.attempts')}: <strong>{attempts}</strong>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Submit + Stats */}
        <div className="flex flex-col gap-4">
          {/* Submit Block */}
          <Card className="border-amber-200 dark:border-amber-800 rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Send className="w-5 h-5 text-amber-500" />
                {t('phase6.announceBlock')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isValidHash && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-green-100 dark:bg-green-900/30 rounded-lg p-4 text-center"
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

              <Button
                onClick={handleSubmitBlock}
                disabled={!isValidHash || isSubmitting}
                className="w-full bg-amber-600 hover:bg-amber-700"
                size="lg"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Send className="w-5 h-5 mr-2" />
                )}
                {t('phase6.submitToNetwork')}
              </Button>

              {!isValidHash && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 text-amber-500" />
                    <p>{t('phase6.submitInfo')}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Stats */}
          <Card className="border-amber-200 dark:border-amber-800 rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="w-5 h-5 text-amber-500" />
                {t('phase6.myBalance')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('phase6.blocksMinedByMe')}</p>
                  <p className="text-2xl font-bold">{myMinedBlocks.length}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('phase6.totalReward')}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {participant.totalMiningReward || 0} BTC
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{t('phase6.myAttempts')}</p>
                  <p className="text-2xl font-bold">{participant.hashAttempts || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
