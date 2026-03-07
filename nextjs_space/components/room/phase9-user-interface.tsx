'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  Wallet, 
  Send, 
  Pickaxe, 
  Eye, 
  Inbox, 
  Activity,
  Star,
  Zap,
  ChevronDown,
  Clock,
  Check,
  AlertTriangle,
  TrendingUp,
  Users,
  Coins,
  Hash
} from 'lucide-react';
import { Room, Participant, Block, MempoolTransaction, SimulationStats, ChallengeData } from '@/lib/types';
import crypto from 'crypto';

interface Phase9UserInterfaceProps {
  room: Room;
  participant: Participant;
  blocks: Block[];
  mempoolTransactions: MempoolTransaction[];
  simulationStats: SimulationStats | null;
  onUpdateRole: (role: 'user' | 'miner' | 'both') => Promise<{ success: boolean; error?: string }>;
  onCreateTransaction: (receiverId: string, amount: number, fee: number) => Promise<{ success: boolean; error?: string }>;
  onMineBlock: (nonce: number, hash: string, selectedTxIds: string[]) => Promise<{ success: boolean; block?: Block; reward?: number; feesEarned?: number; error?: string }>;
}

export default function Phase9UserInterface({
  room,
  participant,
  blocks,
  mempoolTransactions,
  simulationStats,
  onUpdateRole,
  onCreateTransaction,
  onMineBlock,
}: Phase9UserInterfaceProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'transaction' | 'mining' | 'blockchain' | 'mempool'>('transaction');
  const [selectedRole, setSelectedRole] = useState<'user' | 'miner' | 'both'>(participant.simulationRole || 'both');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  
  // Transaction state
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('');
  const [txFeedback, setTxFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Mining state
  const [isMining, setIsMining] = useState(false);
  const [currentNonce, setCurrentNonce] = useState(0);
  const [currentHash, setCurrentHash] = useState('');
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [miningFeedback, setMiningFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  
  // Activity log
  const [activityLog, setActivityLog] = useState<{ id: string; message: string; timestamp: Date }[]>([]);
  
  const otherStudents = useMemo(() => 
    room.participants.filter(p => p.id !== participant.id && p.role === 'student' && p.isActive),
    [room.participants, participant.id]
  );
  
  const pendingMempoolTxs = useMemo(() =>
    mempoolTransactions.filter(tx => tx.status === 'in_mempool'),
    [mempoolTransactions]
  );
  
  const currentBlockReward = room.currentBlockReward || 50;
  const currentDifficulty = room.currentDifficulty || 2;
  const myBalance = participant.simulationBalance || 100;
  const myBlocksMined = participant.blocksMinedCount || 0;
  const lastBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;
  
  // Parse challenge data
  const challengeData: ChallengeData | null = useMemo(() => {
    if (room.challengeData) {
      try {
        return JSON.parse(room.challengeData);
      } catch {
        return null;
      }
    }
    return null;
  }, [room.challengeData]);
  
  const handleRoleChange = async (newRole: 'user' | 'miner' | 'both') => {
    setSelectedRole(newRole);
    setRoleDropdownOpen(false);
    await onUpdateRole(newRole);
  };
  
  const handleCreateTransaction = async () => {
    if (!receiverId || !amount) {
      setTxFeedback({ type: 'error', message: t('phase9.selectRecipientAndAmount') });
      return;
    }
    
    const amountNum = parseFloat(amount);
    const feeNum = parseFloat(fee) || 0;
    
    if (amountNum + feeNum > myBalance) {
      setTxFeedback({ type: 'error', message: t('phase9.insufficientBalance') });
      return;
    }
    
    const result = await onCreateTransaction(receiverId, amountNum, feeNum);
    if (result.success) {
      setTxFeedback({ type: 'success', message: t('phase9.transactionCreated') });
      setReceiverId('');
      setAmount('');
      setFee('');
      const receiverName = otherStudents.find(s => s.id === receiverId)?.name || 'Unknown';
      addToActivityLog(`${t('phase9.sentTransaction')}: ${amountNum} BTC → ${receiverName}`);
    } else {
      setTxFeedback({ type: 'error', message: result.error || t('phase9.transactionFailed') });
    }
    
    setTimeout(() => setTxFeedback(null), 3000);
  };
  
  const calculateHash = (data: string): string => {
    return crypto.createHash('sha256').update(data).digest('hex');
  };
  
  const startMining = () => {
    setIsMining(true);
    setCurrentNonce(0);
    setMiningFeedback({ type: 'info', message: t('phase9.miningStarted') });
  };
  
  const performMiningStep = async () => {
    if (!isMining) return;
    
    const previousHash = lastBlock?.hash || '0'.repeat(64);
    const blockNumber = (lastBlock?.blockNumber || 0) + 1;
    const dataToHash = `${blockNumber}|${previousHash}|${currentNonce}|${selectedTxIds.join(',')}`;
    const hash = calculateHash(dataToHash);
    
    setCurrentHash(hash);
    
    const requiredPrefix = '0'.repeat(currentDifficulty);
    if (hash.startsWith(requiredPrefix)) {
      // Found valid hash!
      setIsMining(false);
      const result = await onMineBlock(currentNonce, hash, selectedTxIds);
      if (result.success) {
        const totalReward = (result.reward || currentBlockReward) + (result.feesEarned || 0);
        setMiningFeedback({ type: 'success', message: `${t('phase9.blockMined')}! +${totalReward} BTC` });
        addToActivityLog(`${t('phase9.minedBlock')} #${blockNumber} (+${totalReward} BTC)`);
        setSelectedTxIds([]);
      } else {
        setMiningFeedback({ type: 'error', message: result.error || t('phase9.miningFailed') });
      }
    } else {
      setCurrentNonce(prev => prev + 1);
    }
  };
  
  const stopMining = () => {
    setIsMining(false);
    setMiningFeedback({ type: 'info', message: t('phase9.miningStopped') });
  };
  
  const toggleTxSelection = (txId: string) => {
    setSelectedTxIds(prev => 
      prev.includes(txId) 
        ? prev.filter(id => id !== txId)
        : [...prev, txId]
    );
  };
  
  const selectTopFees = () => {
    const sorted = [...pendingMempoolTxs].sort((a, b) => b.fee - a.fee);
    setSelectedTxIds(sorted.slice(0, 5).map(tx => tx.id));
  };
  
  const addToActivityLog = (message: string) => {
    setActivityLog(prev => [{
      id: Date.now().toString(),
      message,
      timestamp: new Date()
    }, ...prev].slice(0, 10));
  };
  
  // Mining loop
  useEffect(() => {
    if (!isMining) return;
    
    const interval = setInterval(performMiningStep, 100);
    return () => clearInterval(interval);
  }, [isMining, currentNonce]);
  
  const selectedFeesTotal = useMemo(() => 
    pendingMempoolTxs
      .filter(tx => selectedTxIds.includes(tx.id))
      .reduce((sum, tx) => sum + tx.fee, 0),
    [pendingMempoolTxs, selectedTxIds]
  );
  
  const canMine = selectedRole === 'miner' || selectedRole === 'both';
  const canTransact = selectedRole === 'user' || selectedRole === 'both';
  
  const roleLabels = {
    user: t('phase9.roleUser'),
    miner: t('phase9.roleMiner'),
    both: t('phase9.roleBoth'),
  };
  
  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-4 border border-purple-500/30"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="text-2xl">🌐</div>
            <div>
              <h2 className="text-xl font-bold text-white">{t('phase9.title')}</h2>
              <p className="text-gray-400 text-sm">{t('phase9.subtitle')}</p>
            </div>
          </div>
          
          {/* Role Selector */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg border border-gray-600 hover:border-purple-500 transition-colors"
            >
              <span className="text-gray-300">{t('phase9.myRole')}:</span>
              <span className="font-semibold text-purple-400">{roleLabels[selectedRole]}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            
            <AnimatePresence>
              {roleDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 bg-gray-800 rounded-lg border border-gray-600 shadow-xl z-50 min-w-[150px]"
                >
                  {(['user', 'miner', 'both'] as const).map(role => (
                    <button
                      key={role}
                      onClick={() => handleRoleChange(role)}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors ${
                        selectedRole === role ? 'text-purple-400 bg-purple-900/30' : 'text-gray-300'
                      } first:rounded-t-lg last:rounded-b-lg`}
                    >
                      {roleLabels[role]}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-400">
              <Wallet className="w-4 h-4" />
              <span className="text-sm">{t('phase9.myBalance')}</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{myBalance.toFixed(2)} BTC</div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-400">
              <Pickaxe className="w-4 h-4" />
              <span className="text-sm">{t('phase9.blocksMined')}</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">{myBlocksMined}</div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-400">
              <Hash className="w-4 h-4" />
              <span className="text-sm">{t('phase9.currentBlock')}</span>
            </div>
            <div className="text-xl font-bold text-white mt-1">#{(lastBlock?.blockNumber || 0) + 1}</div>
          </div>
          
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-orange-400">
              <Star className="w-4 h-4" />
              <span className="text-sm">{t('phase9.difficulty')}</span>
            </div>
            <div className="text-xl font-bold text-white mt-1 flex items-center gap-1">
              {Array.from({ length: currentDifficulty }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-orange-400 text-orange-400" />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Challenge Alert */}
      {room.activeChallenge && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-red-900/40 to-orange-900/40 rounded-xl p-4 border border-red-500/50"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <div>
              <h3 className="font-bold text-red-300">
                {t(`phase9.challenge.${room.activeChallenge}.title`)}
              </h3>
              <p className="text-sm text-red-200/80">
                {t(`phase9.challenge.${room.activeChallenge}.description`)}
              </p>
            </div>
          </div>
          
          {challengeData?.type === '51_attack' && challengeData.attackingGroup && (
            <div className="mt-3 text-sm">
              <span className="text-red-300">
                {challengeData.attackingGroup.includes(participant.id) 
                  ? `⚔️ ${t('phase9.youAreAttacker')}`
                  : `🛡️ ${t('phase9.youAreDefender')}`
                }
              </span>
            </div>
          )}
        </motion.div>
      )}
      
      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap">
        {canTransact && (
          <button
            onClick={() => setActiveTab('transaction')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'transaction'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Send className="w-4 h-4" />
            {t('phase9.createTransaction')}
          </button>
        )}
        {canMine && (
          <button
            onClick={() => setActiveTab('mining')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'mining'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Pickaxe className="w-4 h-4" />
            {t('phase9.mineBlock')}
          </button>
        )}
        <button
          onClick={() => setActiveTab('blockchain')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'blockchain'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <Eye className="w-4 h-4" />
          {t('phase9.viewBlockchain')}
        </button>
        <button
          onClick={() => setActiveTab('mempool')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'mempool'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <Inbox className="w-4 h-4" />
          {t('phase9.viewMempool')} ({pendingMempoolTxs.length})
        </button>
      </div>
      
      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content Area */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {/* Transaction Tab */}
            {activeTab === 'transaction' && canTransact && (
              <motion.div
                key="transaction"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Send className="w-5 h-5 text-purple-400" />
                  {t('phase9.createTransaction')}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('phase9.recipient')}</label>
                    <select
                      value={receiverId}
                      onChange={(e) => setReceiverId(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">{t('phase9.selectRecipient')}</option>
                      {otherStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{t('phase9.amount')} (BTC)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="0.01"
                        step="0.01"
                        max={myBalance}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{t('phase9.fee')} (BTC)</label>
                      <input
                        type="number"
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    {t('phase9.totalCost')}: <span className="text-white font-semibold">
                      {((parseFloat(amount) || 0) + (parseFloat(fee) || 0)).toFixed(2)} BTC
                    </span>
                  </div>
                  
                  <button
                    onClick={handleCreateTransaction}
                    disabled={!receiverId || !amount}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {t('phase9.sendTransaction')}
                  </button>
                  
                  {txFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-lg text-center ${
                        txFeedback.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      {txFeedback.message}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
            
            {/* Mining Tab */}
            {activeTab === 'mining' && canMine && (
              <motion.div
                key="mining"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Pickaxe className="w-5 h-5 text-orange-400" />
                  {t('phase9.miningZone')}
                </h3>
                
                <div className="space-y-4">
                  {/* Potential Reward */}
                  <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-lg p-3 border border-yellow-500/30">
                    <div className="text-sm text-yellow-400">{t('phase9.potentialReward')}</div>
                    <div className="text-2xl font-bold text-yellow-300">
                      {currentBlockReward} + {selectedFeesTotal} = {currentBlockReward + selectedFeesTotal} BTC
                    </div>
                    <div className="text-xs text-yellow-400/70 mt-1">
                      {t('phase9.blockReward')} + {t('phase9.fees')}
                    </div>
                  </div>
                  
                  {/* Transaction Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">{t('phase9.selectTransactions')}</span>
                      <button
                        onClick={selectTopFees}
                        className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                      >
                        {t('phase9.selectTopFees')}
                      </button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {pendingMempoolTxs.length === 0 ? (
                        <div className="text-center text-gray-500 py-2">{t('phase9.noTransactions')}</div>
                      ) : (
                        pendingMempoolTxs.slice(0, 10).map(tx => (
                          <div
                            key={tx.id}
                            onClick={() => toggleTxSelection(tx.id)}
                            className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                              selectedTxIds.includes(tx.id)
                                ? 'bg-purple-900/50 border border-purple-500'
                                : 'bg-gray-700/50 hover:bg-gray-600/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                selectedTxIds.includes(tx.id) ? 'bg-purple-500 border-purple-500' : 'border-gray-500'
                              }`}>
                                {selectedTxIds.includes(tx.id) && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-sm text-gray-300">{tx.txId}</span>
                            </div>
                            <span className="text-sm text-green-400">+{tx.fee} BTC</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Mining Status */}
                  {isMining && (
                    <div className="bg-gray-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />
                        <span className="text-sm text-gray-300">{t('phase9.mining')}...</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        <div>Nonce: <span className="text-white font-mono">{currentNonce}</span></div>
                        <div className="truncate">Hash: <span className="text-white font-mono">{currentHash.substring(0, 32)}...</span></div>
                        <div>{t('phase9.looking')}: <span className="text-orange-400">{'0'.repeat(currentDifficulty)}...</span></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Mining Button */}
                  <button
                    onClick={isMining ? stopMining : startMining}
                    className={`w-full py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      isMining
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                    }`}
                  >
                    <Pickaxe className="w-5 h-5" />
                    {isMining ? t('phase9.stopMining') : t('phase9.startMining')}
                  </button>
                  
                  {miningFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-lg text-center ${
                        miningFeedback.type === 'success' ? 'bg-green-900/50 text-green-300' :
                        miningFeedback.type === 'error' ? 'bg-red-900/50 text-red-300' :
                        'bg-blue-900/50 text-blue-300'
                      }`}
                    >
                      {miningFeedback.message}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
            
            {/* Blockchain Tab */}
            {activeTab === 'blockchain' && (
              <motion.div
                key="blockchain"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-400" />
                  {t('phase9.blockchain')}
                </h3>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {blocks.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">{t('phase9.noBlocks')}</div>
                  ) : (
                    [...blocks].reverse().map(block => (
                      <div
                        key={block.id}
                        className="bg-gray-700/50 rounded-lg p-3 border border-gray-600"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-white">#{block.blockNumber}</span>
                          <span className="text-sm text-gray-400">
                            {block.miner?.name || 'Unknown'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 truncate font-mono mb-1">
                          {block.hash?.substring(0, 32)}...
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-yellow-400">+{block.reward} BTC</span>
                          {block.totalFees > 0 && (
                            <span className="text-green-400">+{block.totalFees} fees</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
            
            {/* Mempool Tab */}
            {activeTab === 'mempool' && (
              <motion.div
                key="mempool"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-purple-400" />
                  {t('phase9.mempool')} ({pendingMempoolTxs.length} {t('phase9.pending')})
                </h3>
                
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {pendingMempoolTxs.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">{t('phase9.mempoolEmpty')}</div>
                  ) : (
                    pendingMempoolTxs.map(tx => (
                      <div
                        key={tx.id}
                        className="bg-gray-700/50 rounded-lg p-3 border border-gray-600"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-sm text-white">{tx.txId}</span>
                          <span className="text-sm text-green-400">Fee: {tx.fee} BTC</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {tx.sender?.name} → {tx.receiver?.name}: {tx.amount} BTC
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Activity Log Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 h-full">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              {t('phase9.recentActivity')}
            </h3>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {activityLog.length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">{t('phase9.noActivity')}</div>
              ) : (
                activityLog.map(entry => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-gray-700/50 rounded-lg p-2 text-sm"
                  >
                    <div className="text-gray-300">{entry.message}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {entry.timestamp.toLocaleTimeString()}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
            
            {/* Quick Stats */}
            {simulationStats && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">{t('phase9.networkStats')}</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-700/30 rounded p-2">
                    <div className="text-gray-500">{t('phase9.totalBlocks')}</div>
                    <div className="text-white font-semibold">{simulationStats.totalBlocks}</div>
                  </div>
                  <div className="bg-gray-700/30 rounded p-2">
                    <div className="text-gray-500">{t('phase9.btcCirculation')}</div>
                    <div className="text-white font-semibold">{simulationStats.btcInCirculation.toFixed(1)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
