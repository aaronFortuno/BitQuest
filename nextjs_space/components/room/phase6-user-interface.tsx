'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Pickaxe, Globe, Send, Coins, Trophy, Clock, Star, Hash,
  CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw,
  ArrowRight, Zap, Info, Settings, TrendingUp, TrendingDown, Minus, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Room, Participant, Block, BlockTransaction } from '@/lib/types';
import { DifficultyInfo } from '@/hooks/use-room-polling';

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
  const [timeSinceLastBlock, setTimeSinceLastBlock] = useState(0);

  // Get current pending block and last mined block
  const pendingBlock = blocks.find(b => b.status === 'pending');
  const minedBlocks = blocks.filter(b => b.status === 'mined').sort((a, b) => b.blockNumber - a.blockNumber);
  const lastMinedBlock = minedBlocks[0];
  const myMinedBlocks = minedBlocks.filter(b => b.minerId === participant.id);

  // Count active miners (students who have made hash attempts)
  const activeMiners = room.participants.filter(p => 
    p.isActive && p.role === 'student' && (p.hashAttempts || 0) > 0
  ).length;

  // Calculate time since last block
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastMinedBlock?.minedAt) {
        const elapsed = Math.floor((Date.now() - new Date(lastMinedBlock.minedAt).getTime()) / 1000);
        setTimeSinceLastBlock(elapsed);
      } else if (pendingBlock) {
        const elapsed = Math.floor((Date.now() - new Date(pendingBlock.createdAt).getTime()) / 1000);
        setTimeSinceLastBlock(elapsed);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastMinedBlock, pendingBlock]);

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
    if (!pendingBlock || isMining) return;

    setIsMining(true);
    
    // Increment nonce
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
  }, [pendingBlock, currentNonce, isMining, onCalculateHash, t]);

  // Handle block submission
  const handleSubmitBlock = useCallback(async () => {
    if (!pendingBlock || !lastHash || isSubmitting) return;

    setIsSubmitting(true);
    
    const result = await onSubmitBlock(currentNonce, lastHash);

    if (result.success) {
      // Check if difficulty was adjusted
      let message = t('phase6.blockAccepted', { reward: result.reward || 50 });
      if (result.difficultyAdjustment) {
        const { previousDifficulty, newDifficulty, result: adjustment } = result.difficultyAdjustment;
        if (adjustment === 'increased') {
          message += ' ' + t('phase7.difficultyIncreased', { from: previousDifficulty, to: newDifficulty });
        } else if (adjustment === 'decreased') {
          message += ' ' + t('phase7.difficultyDecreased', { from: previousDifficulty, to: newDifficulty });
        }
      }
      setFeedback({
        type: 'success',
        message
      });
      // Reset for next block
      setLastHash(null);
      setIsValidHash(false);
      setAttempts(0);
      setCurrentNonce(Math.floor(Math.random() * 10000));
    } else {
      if (result.code === 'ALREADY_MINED') {
        setFeedback({
          type: 'error',
          message: t('phase6.tooLate')
        });
        // Reset for next block
        setLastHash(null);
        setIsValidHash(false);
        setAttempts(0);
        setCurrentNonce(Math.floor(Math.random() * 10000));
      } else if (result.code === 'HASH_NOT_VALID') {
        setFeedback({
          type: 'error',
          message: t('phase6.invalidHash')
        });
      } else {
        setFeedback({
          type: 'error',
          message: result.error || t('phase6.submitError')
        });
      }
    }

    setIsSubmitting(false);
  }, [pendingBlock, lastHash, currentNonce, isSubmitting, onSubmitBlock, t]);

  // Initialize pending block if none exists
  const handleInitializeBlock = useCallback(async () => {
    await onCreatePendingBlock();
    setFeedback({
      type: 'info',
      message: t('phase6.blockCreated')
    });
  }, [onCreatePendingBlock, t]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render difficulty stars
  const renderDifficulty = (difficulty: number) => {
    return Array.from({ length: difficulty }, (_, i) => (
      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
    ));
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-auto">
      {/* Feedback Messages */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-3 rounded-lg flex items-center gap-2 ${
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

      {/* Zone 1: Network Status */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="w-5 h-5 text-blue-500" />
            {t('phase6.networkStatus')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">{t('phase6.currentBlock')}</span>
              <span className="text-xl font-bold">#{pendingBlock?.blockNumber || (lastMinedBlock?.blockNumber ?? 0) + 1}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">{t('phase6.difficulty')}</span>
              <div className="flex items-center gap-1">
                {renderDifficulty(pendingBlock?.difficulty || 2)}
                <span className="text-sm ml-1">({pendingBlock?.difficulty || 2} {t('phase6.leadingZeros')})</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">{t('phase6.pendingTx')}</span>
              <span className="text-xl font-bold">{pendingBlock?.transactions.length || 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">{t('phase6.activeMiners')}</span>
              <span className="text-xl font-bold">
                {activeMiners}/{room.participants.filter(p => p.isActive && p.role === 'student').length}
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{t('phase6.timeSinceLastBlock')}: <strong>{formatTime(timeSinceLastBlock)}</strong></span>
            </div>
            {lastMinedBlock && (
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span>{t('phase6.lastMinedBy')}: <strong>{lastMinedBlock.miner?.name || 'Unknown'}</strong></span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Phase 7: Difficulty Adjustment Panel */}
      {room.currentPhase >= 7 && difficultyInfo && (
        <Card className="border-purple-200 dark:border-purple-800">
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

      <div className="grid md:grid-cols-2 gap-4 flex-1">
        {/* Zone 2: My Mining Attempt */}
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pickaxe className="w-5 h-5 text-orange-500" />
              {t('phase6.miningBlock')} #{pendingBlock?.blockNumber || '?'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!pendingBlock ? (
              <div className="text-center py-6">
                <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
                <p className="text-muted-foreground mb-4">{t('phase6.noPendingBlock')}</p>
                <Button onClick={handleInitializeBlock}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('phase6.createBlock')}
                </Button>
              </div>
            ) : (
              <>
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

                {/* Nonce Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('phase6.currentNonce')}:</label>
                  <Input
                    type="number"
                    value={currentNonce}
                    onChange={(e) => setCurrentNonce(parseInt(e.target.value) || 0)}
                    className="font-mono text-center text-lg"
                  />
                  <p className="text-xs text-muted-foreground">{t('phase6.nonceHint')}</p>
                </div>

                {/* Mine Button */}
                <Button
                  onClick={handleMineClick}
                  disabled={isMining}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  size="lg"
                >
                  {isMining ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Hash className="w-5 h-5 mr-2" />
                  )}
                  {t('phase6.createNewHash')}
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

        {/* Zone 3: Submit to Network */}
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Send className="w-5 h-5 text-purple-500" />
              {t('phase6.announceBlock')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleSubmitBlock}
              disabled={!lastHash || isSubmitting}
              className="w-full bg-purple-500 hover:bg-purple-600"
              size="lg"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Send className="w-5 h-5 mr-2" />
              )}
              {t('phase6.submitToNetwork')}
            </Button>

            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 text-blue-500" />
                <p>{t('phase6.submitInfo')}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium">{t('phase6.possibleResults')}:</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="w-4 h-4" />
                  <span>{t('phase6.invalidHashError')}</span>
                </div>
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="w-4 h-4" />
                  <span>{t('phase6.tooLateError')}</span>
                </div>
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>{t('phase6.acceptedSuccess')}</span>
                </div>
              </div>
            </div>

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
          </CardContent>
        </Card>
      </div>

      {/* Zone 4: My Balance and History */}
      <Card className="border-yellow-200 dark:border-yellow-800">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="w-5 h-5 text-yellow-500" />
            {t('phase6.myBalance')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">{t('phase6.blocksMinedByMe')}</p>
              <p className="text-2xl font-bold">{myMinedBlocks.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground">{t('phase6.totalReward')}</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {participant.totalMiningReward || 0} BTC
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center md:col-span-1 col-span-2">
              <p className="text-sm text-muted-foreground">{t('phase6.myAttempts')}</p>
              <p className="text-2xl font-bold">{participant.hashAttempts || 0}</p>
            </div>
          </div>

          {/* Block History */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('phase6.blockHistory')}:</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {minedBlocks.slice(0, 10).map((block) => (
                <div 
                  key={block.id}
                  className={`flex items-center justify-between p-2 rounded text-sm ${
                    block.minerId === participant.id 
                      ? 'bg-green-100 dark:bg-green-900/30' 
                      : 'bg-muted/30'
                  }`}
                >
                  <span>
                    {t('phase6.block')} #{block.blockNumber}:
                    {block.minerId === participant.id ? (
                      <span className="ml-1 text-green-600 dark:text-green-400 font-medium">
                        {t('phase6.minedByMe')} (+{block.reward} BTC)
                      </span>
                    ) : (
                      <span className="ml-1 text-muted-foreground">
                        {t('phase6.minedBy')} {block.miner?.name || 'Unknown'}
                      </span>
                    )}
                  </span>
                  {block.minerId === participant.id && (
                    <Trophy className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
              ))}
              {pendingBlock && (
                <div className="flex items-center justify-between p-2 rounded text-sm bg-orange-100 dark:bg-orange-900/30">
                  <span>
                    {t('phase6.block')} #{pendingBlock.blockNumber}: 
                    <span className="ml-1 text-orange-600 dark:text-orange-400">
                      {t('phase6.mining')}... ⏳
                    </span>
                  </span>
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                </div>
              )}
              {minedBlocks.length === 0 && !pendingBlock && (
                <p className="text-center text-muted-foreground py-4">
                  {t('phase6.noBlocksYet')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
