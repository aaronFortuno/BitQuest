'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Pickaxe, Globe, Send, Coins, Trophy, Clock, Star, Hash,
  CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw,
  ArrowRight, Zap, Info, TrendingDown, DollarSign, Percent,
  ListChecks, Timer, Gift, Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Room, Participant, Block, MempoolTransaction, HalvingInfo, EconomicStats } from '@/lib/types';
import { DifficultyInfo } from '@/hooks/use-room-polling';

interface Phase8UserInterfaceProps {
  room: Room;
  participant: Participant;
  blocks: Block[];
  mempoolTransactions: MempoolTransaction[];
  difficultyInfo?: DifficultyInfo | null;
  halvingInfo?: HalvingInfo | null;
  economicStats?: EconomicStats | null;
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
    fees?: number;
    totalReward?: number;
    halvingEvent?: {
      previousReward: number;
      newReward: number;
      halvingNumber: number;
    };
  }>;
  onSelectTransactions: (txIds: string[]) => Promise<{ success: boolean; totalFees?: number; error?: string }>;
  onCreateTransaction: (receiverId: string, amount: number, fee: number) => Promise<{ success: boolean; error?: string }>;
}

export function Phase8UserInterface({
  room,
  participant,
  blocks,
  mempoolTransactions,
  difficultyInfo,
  halvingInfo,
  economicStats,
  onCreatePendingBlock,
  onCalculateHash,
  onSubmitBlock,
  onSelectTransactions,
  onCreateTransaction
}: Phase8UserInterfaceProps) {
  const { t } = useTranslation();
  const [currentNonce, setCurrentNonce] = useState(Math.floor(Math.random() * 10000));
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [isValidHash, setIsValidHash] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isMining, setIsMining] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info' | 'halving'; message: string } | null>(null);
  const [timeSinceLastBlock, setTimeSinceLastBlock] = useState(0);
  
  // Transaction creation state
  const [txReceiverId, setTxReceiverId] = useState('');
  const [txAmount, setTxAmount] = useState(1);
  const [txFee, setTxFee] = useState(0.5);
  const [isCreatingTx, setIsCreatingTx] = useState(false);
  
  // Transaction selection state
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isSelectingTxs, setIsSelectingTxs] = useState(false);

  // Get current pending block and last mined block
  const pendingBlock = blocks.find(b => b.status === 'pending');
  const minedBlocks = blocks.filter(b => b.status === 'mined').sort((a, b) => b.blockNumber - a.blockNumber);
  const lastMinedBlock = minedBlocks[0];
  const myMinedBlocks = minedBlocks.filter(b => b.minerId === participant.id);

  // Filter mempool for unconfirmed transactions
  const pendingMempoolTxs = mempoolTransactions
    .filter(tx => tx.status === 'in_mempool')
    .sort((a, b) => b.fee - a.fee); // Sort by fee descending

  // Other students for transaction recipient
  const otherStudents = room.participants.filter(
    p => p.isActive && p.role === 'student' && p.id !== participant.id
  );

  // Calculate selected transactions fees
  const selectedTxs = pendingMempoolTxs.filter(tx => selectedTxIds.includes(tx.id));
  const totalSelectedFees = selectedTxs.reduce((sum, tx) => sum + tx.fee, 0);
  const currentBlockReward = halvingInfo?.currentBlockReward ?? 50;
  const potentialTotalReward = currentBlockReward + totalSelectedFees;

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
      const timeout = setTimeout(() => setFeedback(null), feedback.type === 'halving' ? 8000 : 4000);
      return () => clearTimeout(timeout);
    }
  }, [feedback]);

  // Handle transaction creation with fee
  const handleCreateTransaction = async () => {
    if (!txReceiverId || txAmount <= 0) return;
    setIsCreatingTx(true);
    
    const result = await onCreateTransaction(txReceiverId, txAmount, txFee);
    
    if (result.success) {
      setFeedback({ type: 'success', message: t('phase8.txCreated') });
      setTxReceiverId('');
      setTxAmount(1);
      setTxFee(0.5);
    } else {
      setFeedback({ type: 'error', message: result.error || t('phase8.txFailed') });
    }
    
    setIsCreatingTx(false);
  };

  // Handle transaction selection toggle
  const toggleTxSelection = (txId: string) => {
    setSelectedTxIds(prev => 
      prev.includes(txId) 
        ? prev.filter(id => id !== txId)
        : [...prev, txId]
    );
  };

  // Handle select all high-fee transactions
  const selectTopTransactions = () => {
    const topTxIds = pendingMempoolTxs.slice(0, 5).map(tx => tx.id);
    setSelectedTxIds(topTxIds);
  };

  // Apply selected transactions to pending block
  const handleApplySelectedTxs = async () => {
    if (!pendingBlock) return;
    setIsSelectingTxs(true);
    
    const result = await onSelectTransactions(selectedTxIds);
    
    if (result.success) {
      setFeedback({ 
        type: 'success', 
        message: `${t('phase8.txSelected')}: ${selectedTxIds.length} | ${t('phase8.totalFees')}: ${result.totalFees} BTC`
      });
    } else {
      setFeedback({ type: 'error', message: result.error || t('phase8.selectionFailed') });
    }
    
    setIsSelectingTxs(false);
  };

  // Try mining with current nonce
  const handleTryNonce = async () => {
    if (!pendingBlock || isMining) return;
    setIsMining(true);

    const result = await onCalculateHash(currentNonce);
    if (result) {
      setLastHash(result.hash);
      setIsValidHash(result.isValid);
      setAttempts(prev => prev + 1);
    }

    setIsMining(false);
  };

  // Submit valid block
  const handleSubmitBlock = async () => {
    if (!lastHash || !isValidHash || isSubmitting) return;
    setIsSubmitting(true);

    const result = await onSubmitBlock(currentNonce, lastHash);
    
    if (result.success) {
      const totalReward = (result.reward || 0) + (result.fees || 0);
      setFeedback({ 
        type: 'success', 
        message: `${t('phase6.blockMinedSuccess')} +${totalReward} BTC (${result.reward} + ${result.fees} ${t('phase8.fees')})`
      });
      
      // Check for halving event
      if (result.halvingEvent) {
        setTimeout(() => {
          setFeedback({
            type: 'halving',
            message: `🎉 ${t('phase8.halvingOccurred')}! ${result.halvingEvent!.previousReward} → ${result.halvingEvent!.newReward} BTC`
          });
        }, 2000);
      }
      
      setLastHash(null);
      setIsValidHash(false);
      setSelectedTxIds([]);
    } else {
      if (result.code === 'ALREADY_MINED') {
        setFeedback({ type: 'error', message: t('phase6.blockAlreadyMined') });
        setLastHash(null);
        setIsValidHash(false);
      } else {
        setFeedback({ type: 'error', message: result.error || t('phase6.submitFailed') });
      }
    }

    setIsSubmitting(false);
  };

  // Get fee level indicator
  const getFeeLevel = (fee: number): { label: string; color: string } => {
    const avgFee = economicStats?.averageFee ?? 0.5;
    if (fee >= avgFee * 1.5) return { label: t('phase8.highFee'), color: 'text-green-500' };
    if (fee >= avgFee * 0.5) return { label: t('phase8.mediumFee'), color: 'text-yellow-500' };
    return { label: t('phase8.lowFee'), color: 'text-red-500' };
  };

  return (
    <div className="space-y-6">
      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 rounded-lg flex items-center gap-3 ${
              feedback.type === 'success' ? 'bg-green-500/20 border border-green-500' :
              feedback.type === 'halving' ? 'bg-yellow-500/20 border border-yellow-500' :
              feedback.type === 'info' ? 'bg-blue-500/20 border border-blue-500' :
              'bg-red-500/20 border border-red-500'
            }`}
          >
            {feedback.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
            {feedback.type === 'halving' && <Flame className="w-5 h-5 text-yellow-500" />}
            {feedback.type === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
            {feedback.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
            <span className={feedback.type === 'halving' ? 'font-bold text-yellow-400' : ''}>{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Halving Monitor Panel */}
      {halvingInfo && (
        <Card className="border-2 border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-500">
              <Flame className="w-5 h-5" />
              {t('phase8.halvingMonitor')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{halvingInfo.currentBlockReward} BTC</div>
                <div className="text-sm text-muted-foreground">{t('phase8.currentReward')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{halvingInfo.blocksUntilNextHalving}</div>
                <div className="text-sm text-muted-foreground">{t('phase8.blocksToHalving')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{halvingInfo.nextReward.toFixed(2)} BTC</div>
                <div className="text-sm text-muted-foreground">{t('phase8.nextReward')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{halvingInfo.totalBtcEmitted.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">{t('phase8.totalEmitted')} / {halvingInfo.maxBtc}</div>
              </div>
            </div>
            {/* Progress bar to next halving */}
            <div className="mt-4">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
                  style={{ 
                    width: `${((halvingInfo.halvingInterval - halvingInfo.blocksUntilNextHalving) / halvingInfo.halvingInterval) * 100}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Transaction Creation & Selection */}
        <div className="space-y-6">
          {/* Create Transaction with Fee */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                {t('phase8.createTransaction')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">{t('phase8.recipient')}</label>
                <select
                  value={txReceiverId}
                  onChange={(e) => setTxReceiverId(e.target.value)}
                  className="w-full mt-1 bg-background border rounded-lg p-2"
                >
                  <option value="">{t('phase8.selectRecipient')}</option>
                  {otherStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">{t('phase8.amount')} (BTC)</label>
                  <Input
                    type="number"
                    min="1"
                    value={txAmount}
                    onChange={(e) => setTxAmount(parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">{t('phase8.fee')} (BTC)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={txFee}
                    onChange={(e) => setTxFee(parseFloat(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                {t('phase8.feeInfo')}
              </div>
              <Button
                onClick={handleCreateTransaction}
                disabled={!txReceiverId || txAmount <= 0 || isCreatingTx}
                className="w-full"
              >
                {isCreatingTx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="ml-2">{t('phase8.sendTx')}</span>
              </Button>
            </CardContent>
          </Card>

          {/* Transaction Selector for Miners */}
          <Card className="border-2 border-purple-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <ListChecks className="w-5 h-5" />
                {t('phase8.selectTransactions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">{t('phase8.mempoolTxs')}: {pendingMempoolTxs.length}</span>
                <Button size="sm" variant="outline" onClick={selectTopTransactions}>
                  {t('phase8.selectTop5')}
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {pendingMempoolTxs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    {t('phase8.noTxInMempool')}
                  </div>
                ) : (
                  pendingMempoolTxs.map(tx => {
                    const feeLevel = getFeeLevel(tx.fee);
                    return (
                      <div 
                        key={tx.id}
                        className={`flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors ${
                          selectedTxIds.includes(tx.id) 
                            ? 'border-purple-500 bg-purple-500/10' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                        onClick={() => toggleTxSelection(tx.id)}
                      >
                        <Checkbox checked={selectedTxIds.includes(tx.id)} />
                        <div className="flex-1 text-sm">
                          <span className="font-medium">{tx.sender?.name}</span>
                          <ArrowRight className="w-3 h-3 inline mx-1" />
                          <span>{tx.receiver?.name}</span>
                          <span className="text-muted-foreground ml-2">({tx.amount} BTC)</span>
                        </div>
                        <Badge className={feeLevel.color}>
                          {tx.fee} BTC
                        </Badge>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>{t('phase8.selectedCount')}:</span>
                  <span className="font-bold">{selectedTxIds.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('phase8.totalFees')}:</span>
                  <span className="font-bold text-green-400">{totalSelectedFees.toFixed(2)} BTC</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span>{t('phase8.potentialReward')}:</span>
                  <span className="font-bold text-yellow-400">
                    {currentBlockReward} + {totalSelectedFees.toFixed(2)} = {potentialTotalReward.toFixed(2)} BTC
                  </span>
                </div>
              </div>
              <Button
                onClick={handleApplySelectedTxs}
                disabled={!pendingBlock || isSelectingTxs}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                {isSelectingTxs ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                <span className="ml-2">{t('phase8.applySelection')}</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Mining Zone */}
        <div className="space-y-6">
          {/* Mining Zone */}
          <Card className="border-2 border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-400">
                <Pickaxe className="w-5 h-5" />
                {t('phase6.miningZone')}
                <Badge className="ml-auto">
                  {t('phase6.block')} #{pendingBlock?.blockNumber || (lastMinedBlock?.blockNumber || 0) + 1}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingBlock ? (
                <>
                  {/* Block Info */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('phase6.difficulty')}:</span>
                      <span className="flex">
                        {Array.from({ length: pendingBlock.difficulty }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        ))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('phase8.blockReward')}:</span>
                      <span className="text-yellow-400 font-bold">{pendingBlock.reward} BTC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('phase8.selectedFees')}:</span>
                      <span className="text-green-400 font-bold">{pendingBlock.totalFees || 0} BTC</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">{t('phase8.totalReward')}:</span>
                      <span className="text-amber-400 font-bold text-lg">
                        {(pendingBlock.reward + (pendingBlock.totalFees || 0)).toFixed(2)} BTC
                      </span>
                    </div>
                  </div>

                  {/* Nonce Input */}
                  <div>
                    <label className="text-sm text-muted-foreground">{t('phase6.nonce')}</label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        value={currentNonce}
                        onChange={(e) => setCurrentNonce(parseInt(e.target.value) || 0)}
                        className="font-mono"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentNonce(prev => prev + 1)}
                        disabled={isMining}
                      >
                        +1
                      </Button>
                    </div>
                  </div>

                  {/* Hash Result */}
                  {lastHash && (
                    <div className={`p-3 rounded-lg border ${
                      isValidHash ? 'border-green-500 bg-green-500/10' : 'border-red-500/50 bg-red-500/5'
                    }`}>
                      <div className="text-sm text-muted-foreground">{t('phase6.resultHash')}:</div>
                      <div className="font-mono text-sm break-all">
                        <span className={isValidHash ? 'text-green-500' : 'text-red-400'}>
                          {lastHash.substring(0, pendingBlock.difficulty)}
                        </span>
                        <span className="text-muted-foreground">
                          {lastHash.substring(pendingBlock.difficulty)}
                        </span>
                      </div>
                      {isValidHash && (
                        <div className="text-green-500 font-bold mt-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          {t('phase6.validHash')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mining Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleTryNonce}
                      disabled={isMining || isSubmitting}
                      className="flex-1"
                    >
                      {isMining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                      <span className="ml-2">{t('phase6.tryNonce')}</span>
                    </Button>
                    {isValidHash && (
                      <Button
                        onClick={handleSubmitBlock}
                        disabled={isSubmitting}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span className="ml-2">{t('phase6.submitBlock')}</span>
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Pickaxe className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('phase6.noPendingBlock')}</p>
                  <Button onClick={onCreatePendingBlock} className="mt-4">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t('phase6.createBlock')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Mining Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                {t('phase6.myStats')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-400">{myMinedBlocks.length}</div>
                  <div className="text-xs text-muted-foreground">{t('phase6.blocksMined')}</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{participant.totalMiningReward || 0}</div>
                  <div className="text-xs text-muted-foreground">{t('phase8.totalEarnings')} BTC</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-400">{attempts}</div>
                  <div className="text-xs text-muted-foreground">{t('phase6.attempts')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Block History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('phase6.blockchain')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {minedBlocks.slice(0, 10).map((block, idx) => (
              <div
                key={block.id}
                className={`flex-shrink-0 w-32 p-3 rounded-lg border ${
                  block.minerId === participant.id
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-border bg-muted/30'
                }`}
              >
                <div className="font-bold">#{block.blockNumber}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {block.miner?.name || 'Unknown'}
                </div>
                <div className="text-xs text-yellow-400">
                  {block.reward} + {(block.totalFees || 0).toFixed(1)} BTC
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
