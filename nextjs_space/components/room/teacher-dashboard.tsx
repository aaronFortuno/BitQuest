'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Users,
  AlertTriangle,
  HelpCircle,
  Eye,
  Star,
  Activity,
  TrendingUp,
  Landmark,
  Unplug,
  Plug,
  UserCog,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Room, Transaction, Participant, CoinFile, SignedMessage, UTXO, UTXOTransaction, MempoolTransaction, NodeConnection, Block, HalvingInfo, EconomicStats, SimulationStats, ChallengeType, ChallengeData } from '@/lib/types';
import { DifficultyInfo } from '@/hooks/use-room-polling';

interface TeacherDashboardProps {
  room: Room;
  messages?: SignedMessage[];
  utxos?: UTXO[];
  utxoTransactions?: UTXOTransaction[];
  // Phase 5
  mempoolTransactions?: MempoolTransaction[];
  nodeConnections?: NodeConnection[];
  // Phase 6, 7 & 8
  blocks?: Block[];
  difficultyInfo?: DifficultyInfo | null;
  halvingInfo?: HalvingInfo | null;
  economicStats?: EconomicStats | null;
  onHighlightTransaction: (transactionId: string, isHighlighted: boolean) => Promise<void>;
  onToggleBankDisconnection?: (isDisconnected: boolean) => Promise<void>;
  onApproveTransaction?: (transactionId: string) => Promise<void>;
  onRejectTransaction?: (transactionId: string, reason: string) => Promise<void>;
  onForceTransaction?: (transactionId: string, action: 'accept' | 'reject') => Promise<void>;
  onSendFakeMessage?: (content: string, claimedBy: string) => Promise<SignedMessage | null>;
  // Phase 5
  onToggleNodeDisconnection?: (nodeId: string, isDisconnected: boolean) => Promise<void>;
  onFillMempool?: (count?: number) => Promise<void>;
  onInitializeNetwork?: (regenerate?: boolean) => Promise<void>;
  // Phase 6 & 7
  onCreatePendingBlock?: () => Promise<Block | null>;
  onResetBlockchain?: () => Promise<void>;
  onToggleMining?: () => Promise<void>;
  onForceDifficultyAdjustment?: (newDifficulty: number) => Promise<{ success: boolean; error?: string }>;
  onUpdateDifficultySettings?: (settings: { targetBlockTime?: number; adjustmentInterval?: number }) => Promise<{ success: boolean; error?: string }>;
  // Phase 8
  onForceHalving?: () => Promise<{ success: boolean; previousReward?: number; newReward?: number; error?: string }>;
  onUpdateHalvingSettings?: (settings: { halvingInterval?: number; blockReward?: number }) => Promise<{ success: boolean; error?: string }>;
  // Phase 9
  simulationStats?: SimulationStats | null;
  onStartSimulation?: () => Promise<{ success: boolean; error?: string }>;
  onResetSimulation?: () => Promise<{ success: boolean; error?: string }>;
  onLaunchChallenge?: (challengeType: ChallengeType) => Promise<{ success: boolean; challengeData?: ChallengeData; error?: string }>;
  onEndChallenge?: () => Promise<{ success: boolean; error?: string }>;
  onFillSimulationMempool?: () => Promise<{ success: boolean; error?: string }>;
  onAccelerateHalvings?: (count: number) => Promise<{ success: boolean; newReward?: number; error?: string }>;
}

export default function TeacherDashboard({
  room,
  messages = [],
  utxos = [],
  utxoTransactions = [],
  mempoolTransactions = [],
  nodeConnections = [],
  blocks = [],
  difficultyInfo,
  halvingInfo,
  economicStats,
  onHighlightTransaction,
  onToggleBankDisconnection,
  onApproveTransaction,
  onRejectTransaction,
  onForceTransaction,
  onSendFakeMessage,
  onToggleNodeDisconnection,
  onFillMempool,
  onInitializeNetwork,
  onCreatePendingBlock,
  onResetBlockchain,
  onToggleMining,
  onForceDifficultyAdjustment,
  onUpdateDifficultySettings,
  onForceHalving,
  onUpdateHalvingSettings,
  // Phase 9
  simulationStats,
  onStartSimulation,
  onResetSimulation,
  onLaunchChallenge,
  onEndChallenge,
  onFillSimulationMempool,
  onAccelerateHalvings,
}: TeacherDashboardProps) {
  const { t } = useTranslation();
  const [processingTx, setProcessingTx] = useState<string | null>(null);
  const [fakeMessageContent, setFakeMessageContent] = useState('');
  const [fakeClaimedBy, setFakeClaimedBy] = useState('');
  const [sendingFake, setSendingFake] = useState(false);
  // Phase 7 state
  const [newTargetTime, setNewTargetTime] = useState<number>(30);
  const [adjustingDifficulty, setAdjustingDifficulty] = useState(false);
  // Phase 8 state
  const [newBlockReward, setNewBlockReward] = useState<number>(50);
  const [forcingHalving, setForcingHalving] = useState(false);
  // Phase 9 state
  const [launchingChallenge, setLaunchingChallenge] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeType>(null);
  const currentPhase = room?.currentPhase ?? 0;

  const transactions = room?.transactions ?? [];
  const students = (room?.participants ?? []).filter((p) => p.role === 'student' && p.isActive);

  // Sort transactions by creation time for balance calculation
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  );

  // Check if a transaction is suspicious (sender didn't have enough balance at the time)
  const isTransactionSuspicious = (tx: Transaction): boolean => {
    // Find all transactions before this one
    const txIndex = sortedTransactions.findIndex(t => t.id === tx.id);
    const previousTxs = sortedTransactions.slice(0, txIndex);
    
    // Calculate sender's balance before this transaction
    let senderBalance = 10; // Initial balance
    for (const prevTx of previousTxs) {
      if (prevTx.senderId === tx.senderId) {
        senderBalance -= prevTx.amount ?? 0;
      }
      if (prevTx.receiverId === tx.senderId) {
        senderBalance += prevTx.amount ?? 0;
      }
    }
    
    // Transaction is suspicious if sender didn't have enough balance
    return senderBalance < (tx.amount ?? 0);
  };

  // Calculate statistics
  const getStudentStats = (student: Participant) => {
    const sent = transactions.filter((tx) => tx.senderId === student.id);
    const received = transactions.filter((tx) => tx.receiverId === student.id);
    const totalSent = sent.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);
    const totalReceived = received.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);
    
    // Real balance based on transactions: initial (10) - sent + received
    const calculatedBalance = 10 - totalSent + totalReceived;
    
    let currentBalance = 10;
    try {
      const coinFile = JSON.parse(student.coinFile ?? '{}') as CoinFile;
      currentBalance = coinFile?.saldo ?? 10;
    } catch {}
    
    // Discrepancy: if the claimed balance doesn't match what transactions say
    const discrepancy = currentBalance !== calculatedBalance;

    // Check if any sent transaction was an overspend (sent more than available at that point)
    const hasOverspent = sent.some(tx => isTransactionSuspicious(tx));

    return {
      transactionCount: sent.length,
      totalSent,
      totalReceived,
      claimedBalance: currentBalance,
      calculatedBalance,
      discrepancy,
      hasOverspent,
    };
  };

  // Phase 1 specific data
  const isBankDisconnected = room?.isBankDisconnected ?? false;
  const pendingTransactions = transactions.filter((tx) => tx.status === 'pending');
  const approvedTransactions = transactions.filter((tx) => tx.status === 'approved');
  const rejectedTransactions = transactions.filter((tx) => tx.status === 'rejected');
  
  // Phase 2 specific data
  const votingTransaction = transactions.find((tx) => tx.status === 'voting');
  const proposedTransactions = transactions.filter((tx) => 
    tx.status === 'voting' || tx.status === 'approved' || tx.status === 'rejected'
  );
  
  // Calculate voting participation per student
  const getVotingParticipation = (studentId: string): { voted: number; total: number } => {
    const completedVotingTxs = transactions.filter(
      (tx) => (tx.status === 'approved' || tx.status === 'rejected') && tx.voterIds && tx.voterIds.length > 0
    );
    const voted = completedVotingTxs.filter((tx) => tx.voterIds?.includes(studentId)).length;
    return { voted, total: completedVotingTxs.length };
  };
  
  // Count censorship acts (rejected transactions where sender had sufficient balance)
  const censorshipActs = rejectedTransactions.filter((tx) => {
    const senderBalance = 10 - transactions
      .filter((t) => t.senderId === tx.senderId && t.status === 'approved' && new Date(t.createdAt) < new Date(tx.createdAt))
      .reduce((sum, t) => sum + (t.amount ?? 0), 0)
      + transactions
      .filter((t) => t.receiverId === tx.senderId && t.status === 'approved' && new Date(t.createdAt) < new Date(tx.createdAt))
      .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    return senderBalance >= (tx.amount ?? 0);
  }).length;

  // Get sender's current balance for a transaction
  const getSenderBalance = (tx: Transaction): number => {
    const sender = students.find((s) => s.id === tx.senderId);
    if (!sender?.coinFile) return 10;
    try {
      const coinFile = JSON.parse(sender.coinFile) as CoinFile;
      return coinFile?.saldo ?? 10;
    } catch {
      return 10;
    }
  };

  const handleApprove = async (txId: string) => {
    if (onApproveTransaction) {
      setProcessingTx(txId);
      await onApproveTransaction(txId);
      setProcessingTx(null);
    }
  };

  const handleReject = async (txId: string, hasSufficientBalance: boolean) => {
    if (onRejectTransaction) {
      setProcessingTx(txId);
      const reason = hasSufficientBalance ? t('censorship') : t('insufficientFunds');
      await onRejectTransaction(txId, reason);
      setProcessingTx(null);
    }
  };

  // Phase 3 handlers
  const handleSendFakeMessage = async () => {
    if (onSendFakeMessage && fakeMessageContent.trim() && fakeClaimedBy.trim()) {
      setSendingFake(true);
      await onSendFakeMessage(fakeMessageContent, fakeClaimedBy);
      setFakeMessageContent('');
      setFakeClaimedBy('');
      setSendingFake(false);
    }
  };

  // Phase 3 stats
  const studentsWithKeys = students.filter(s => s.publicKey).length;
  const totalMessages = messages.length;
  const verifiedMessages = messages.filter(m => m.isVerified !== null && m.isVerified !== undefined).length;
  const invalidMessages = messages.filter(m => m.isVerified === false).length;

  return (
    <div className="space-y-6">

      {/* Phase 1 Bank Control Panel */}
      {currentPhase === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('bankPanel')}</h2>
              <span className="px-2 py-1 bg-emerald-200 text-emerald-800 rounded-full text-xs font-medium">
                {t('youAreTheBank')}
              </span>
            </div>
            {isBankDisconnected && (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium flex items-center gap-1">
                <Unplug className="w-3 h-3" />
                Desconnectat
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('pendingRequests')}</p>
              <p className="font-semibold text-amber-600 text-xl">{pendingTransactions.length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('approvedTransactions')}</p>
              <p className="font-semibold text-emerald-600 text-xl">{approvedTransactions.length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('rejectedTransactions')}</p>
              <p className="font-semibold text-gray-600 dark:text-zinc-400 text-xl">{rejectedTransactions.length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('actsOfCensorship')}</p>
              <p className="font-semibold text-red-600 text-xl">{censorshipActs}</p>
            </div>
          </div>

          {/* Bank Disconnection Toggle */}
          <div className="mb-4">
            <button
              onClick={() => onToggleBankDisconnection && onToggleBankDisconnection(!isBankDisconnected)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isBankDisconnected 
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white' 
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {isBankDisconnected ? (
                <><Plug className="w-4 h-4" /> {t('reconnectBank')}</>
              ) : (
                <><Unplug className="w-4 h-4" /> {t('disconnectBank')}</>
              )}
            </button>
          </div>

          {/* Pending Transactions Queue */}
          {pendingTransactions.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                {t('pendingRequests')} ({pendingTransactions.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pendingTransactions.map((tx) => {
                  const senderBalance = getSenderBalance(tx);
                  const hasSufficientBalance = senderBalance >= (tx.amount ?? 0);
                  const isProcessing = processingTx === tx.id;
                  
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-3 bg-white rounded-lg border border-amber-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-700 dark:text-zinc-300">{tx.sender?.name}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium text-gray-700 dark:text-zinc-300">{tx.receiver?.name}</span>
                          <span className="text-amber-600 font-bold">{tx.amount} <i className="fa-solid fa-cent-sign" /></span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          hasSufficientBalance 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {hasSufficientBalance ? t('sufficientBalance') : t('insufficientBalance')}
                          {' '}({senderBalance})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(tx.id)}
                          disabled={isProcessing || isBankDisconnected}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {t('approve')}
                        </button>
                        <button
                          onClick={() => handleReject(tx.id, hasSufficientBalance)}
                          disabled={isProcessing || isBankDisconnected}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {t('reject')}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {pendingTransactions.length === 0 && (
            <p className="text-center text-gray-500 dark:text-zinc-500 py-4 bg-white rounded-lg">
              {t('noPendingRequests')}
            </p>
          )}
        </motion.div>
      )}

      {/* Phase 2 Voting Control Panel */}
      {currentPhase === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('phase2')}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('proposedTransactions')}</p>
              <p className="font-semibold text-purple-600 text-xl">{proposedTransactions.length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('acceptedTransactions')}</p>
              <p className="font-semibold text-emerald-600 text-xl">{approvedTransactions.length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('rejectedTransactions')}</p>
              <p className="font-semibold text-red-600 text-xl">{rejectedTransactions.length}</p>
            </div>
          </div>

          {/* Current Voting Proposal */}
          {votingTransaction && (
            <div className="mt-4 p-4 bg-white rounded-lg border-2 border-purple-300">
              <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-500" />
                {t('currentProposal')}
              </h3>
              <div className="space-y-3">
                <p className="text-gray-800">
                  <span className="font-medium">{votingTransaction.sender?.name}</span>
                  {' → '}
                  <span className="font-medium">{votingTransaction.receiver?.name}</span>
                  {': '}
                  <span className="text-amber-600 font-bold">{votingTransaction.amount} <i className="fa-solid fa-cent-sign" /></span>
                </p>
                {votingTransaction.proposedById !== votingTransaction.senderId && (
                  <p className="text-xs text-orange-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t('proposedBy')}: {students.find(s => s.id === votingTransaction.proposedById)?.name || 'Unknown'}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {t('inFavor')}: {votingTransaction.votesFor}
                  </span>
                  <span className="text-red-600 flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    {t('against')}: {votingTransaction.votesAgainst}
                  </span>
                  <span className="text-amber-600 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {t('pendingVotes')}: {students.length - votingTransaction.votesFor - votingTransaction.votesAgainst}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onForceTransaction && onForceTransaction(votingTransaction.id, 'accept')}
                    disabled={processingTx === votingTransaction.id}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {t('forceAccept')}
                  </button>
                  <button
                    onClick={() => onForceTransaction && onForceTransaction(votingTransaction.id, 'reject')}
                    disabled={processingTx === votingTransaction.id}
                    className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {t('forceReject')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!votingTransaction && (
            <p className="text-center text-gray-500 dark:text-zinc-500 py-4 bg-white rounded-lg">
              {t('noProposalsYet')}
            </p>
          )}

          {/* Voting Participation Stats */}
          {proposedTransactions.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-500" />
                {t('votingParticipation')}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {students.map((student) => {
                  const participation = getVotingParticipation(student.id);
                  const percentage = participation.total > 0 
                    ? Math.round((participation.voted / participation.total) * 100) 
                    : 0;
                  return (
                    <div key={student.id} className="p-2 bg-white rounded-lg">
                      <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 truncate">{student.name}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-500">
                        {participation.voted}/{participation.total} ({percentage}%)
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Phase 3 Digital Signatures Control Panel */}
      {currentPhase === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-indigo-600" />
              <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('phase3')}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('studentsWithKeys')}</p>
              <p className="font-semibold text-indigo-600 text-xl">{studentsWithKeys}/{students.length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('messagesSent')}</p>
              <p className="font-semibold text-emerald-600 text-xl">{totalMessages}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('signaturesVerified')}</p>
              <p className="font-semibold text-blue-600 text-xl">{verifiedMessages}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('invalidSignatures')}</p>
              <p className="font-semibold text-red-600 text-xl">{invalidMessages}</p>
            </div>
          </div>

          {/* Send Fake Message Demo */}
          <div className="p-4 bg-white rounded-lg border border-orange-200">
            <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              {t('sendFakeMessageDemo')}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-zinc-400 block mb-1">{t('claimedIdentity')}</label>
                <select
                  value={fakeClaimedBy}
                  onChange={(e) => setFakeClaimedBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-700"
                >
                  <option value="">{t('selectStudent')}</option>
                  {students.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-zinc-400 block mb-1">{t('fakeMessageContent')}</label>
                <input
                  type="text"
                  value={fakeMessageContent}
                  onChange={(e) => setFakeMessageContent(e.target.value)}
                  placeholder={t('fakeMessagePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-700"
                />
              </div>
              <button
                onClick={handleSendFakeMessage}
                disabled={sendingFake || !fakeMessageContent.trim() || !fakeClaimedBy}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {sendingFake ? t('sending') : t('sendFakeMessage')}
              </button>
            </div>
          </div>

          {/* Student Key Status */}
          <div className="mt-4">
            <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              {t('studentActivity')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {students.map((student) => {
                const msgCount = messages.filter(m => m.senderId === student.id).length;
                return (
                  <div key={student.id} className="p-2 bg-white rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 truncate">{student.name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-2">
                      {student.publicKey ? (
                        <span className="text-green-600">✅ {t('keysGenerated')}</span>
                      ) : (
                        <span className="text-amber-600">⏳ {t('pendingKeys')}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{msgCount} {t('messages')}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Phase 4 UTXO Control Panel */}
      {currentPhase === 4 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-600" />
              <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('phase4')}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('totalUtxos')}</p>
              <p className="font-semibold text-amber-600 text-xl">{utxos.filter(u => !u.isSpent).length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('spentUtxos')}</p>
              <p className="font-semibold text-gray-600 dark:text-zinc-400 text-xl">{utxos.filter(u => u.isSpent).length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('utxoTransactions')}</p>
              <p className="font-semibold text-emerald-600 text-xl">{utxoTransactions.length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('invalidTransactions')}</p>
              <p className="font-semibold text-red-600 text-xl">{utxoTransactions.filter(tx => !tx.isValid).length}</p>
            </div>
          </div>

          {/* Student UTXO Status */}
          <div className="mt-4">
            <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-500" />
              {t('studentActivity')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {students.map((student) => {
                const studentUtxos = utxos.filter(u => u.ownerId === student.id && !u.isSpent);
                const totalBalance = studentUtxos.reduce((sum, u) => sum + u.amount, 0);
                const txCount = utxoTransactions.filter(tx => tx.senderId === student.id).length;
                return (
                  <div key={student.id} className="p-2 bg-white rounded-lg">
                    <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 truncate">{student.name}</p>
                    <p className="text-xs text-amber-600 font-semibold">{totalBalance} BTC</p>
                    <p className="text-xs text-gray-400">{studentUtxos.length} UTXOs • {txCount} TX</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Phase 5 Mempool & Network Control Panel */}
      {currentPhase === 5 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('phase5InstructionTitle')}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase5.activeNodes')}</p>
              <p className="font-semibold text-purple-600 text-xl">{students.filter(s => !s.isNodeDisconnected).length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase5.connections')}</p>
              <p className="font-semibold text-blue-600 text-xl">{nodeConnections.filter(c => c.isActive).length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('mempoolTransactions')}</p>
              <p className="font-semibold text-indigo-600 text-xl">{mempoolTransactions.filter(tx => tx.status === 'in_mempool').length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('disconnectedNodes')}</p>
              <p className="font-semibold text-red-600 text-xl">{students.filter(s => s.isNodeDisconnected).length}</p>
            </div>
          </div>

          {/* Demo controls */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => onInitializeNetwork?.(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
            >
              {t('phase5.initializeNetwork')}
            </button>
            <button
              onClick={() => onFillMempool?.(10)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
            >
              {t('fillMempool')}
            </button>
          </div>

          {/* Node Status with disconnect controls */}
          <div className="mt-4">
            <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              {t('studentActivity')} - {t('disconnectNode')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {students.map((student) => {
                const isDisconnected = student.isNodeDisconnected || false;
                const receivedTxs = mempoolTransactions.filter(tx => 
                  tx.propagatedTo?.includes(student.id)
                ).length;
                return (
                  <div 
                    key={student.id} 
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${
                      isDisconnected 
                        ? 'bg-red-100 border border-red-300' 
                        : 'bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => onToggleNodeDisconnection?.(student.id, !isDisconnected)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 truncate">{student.name}</p>
                      {isDisconnected ? (
                        <Unplug className="w-4 h-4 text-red-500" />
                      ) : (
                        <Plug className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {receivedTxs} {t('phase5.receivedTransactions').toLowerCase()}
                    </p>
                    <p className="text-xs mt-1">
                      {isDisconnected ? (
                        <span className="text-red-500">{t('reconnectNode')}</span>
                      ) : (
                        <span className="text-gray-400">{t('disconnectNode')}</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Phase 6 Mining Control Panel */}
      {currentPhase === 6 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('phase6InstructionTitle')}</h2>
            </div>
          </div>

          {/* Mining Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase6.currentBlock')}</p>
              <p className="font-semibold text-orange-600 text-xl">
                #{blocks.find(b => b.status === 'pending')?.blockNumber || (blocks.filter(b => b.status === 'mined').length > 0 ? blocks.filter(b => b.status === 'mined').sort((a, b) => b.blockNumber - a.blockNumber)[0].blockNumber + 1 : 1)}
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase6.minedBlocks')}</p>
              <p className="font-semibold text-green-600 text-xl">{blocks.filter(b => b.status === 'mined').length}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase6.totalHashAttempts')}</p>
              <p className="font-semibold text-blue-600 text-xl">
                {students.reduce((sum, s) => sum + (s.hashAttempts || 0), 0)}
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase6.activeMiners')}</p>
              <p className="font-semibold text-purple-600 text-xl">
                {students.filter(s => (s.hashAttempts || 0) > 0).length}/{students.length}
              </p>
            </div>
          </div>

          {/* Demo controls */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => onCreatePendingBlock?.()}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors"
            >
              {t('phase6.createBlock')}
            </button>
            <button
              onClick={() => onResetBlockchain?.()}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              {t('phase6.resetBlockchain')}
            </button>
          </div>

          {/* Miner Rankings */}
          <div className="mt-4">
            <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" />
              {t('phase6.minerRanking')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[...students]
                .sort((a, b) => (b.blocksMinedCount || 0) - (a.blocksMinedCount || 0))
                .map((student, index) => {
                  const blocksCount = student.blocksMinedCount || 0;
                  const reward = student.totalMiningReward || 0;
                  const attempts = student.hashAttempts || 0;
                  return (
                    <div 
                      key={student.id} 
                      className={`p-2 rounded-lg ${
                        blocksCount > 0 
                          ? 'bg-gradient-to-r from-yellow-100 to-orange-100 border border-yellow-300' 
                          : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 truncate">{student.name}</p>
                        {index === 0 && blocksCount > 0 && (
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        )}
                      </div>
                      <p className="text-xs text-green-600 font-semibold">{reward} BTC</p>
                      <p className="text-xs text-gray-400">{blocksCount} {t('phase6.blocksShort')} • {attempts} {t('phase6.attemptsShort')}</p>
                    </div>
                  );
                })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Phase 7 Difficulty Adjustment Control Panel */}
      {currentPhase === 7 && difficultyInfo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('phase7InstructionTitle')}</h2>
            </div>
          </div>

          {/* Difficulty Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase7.currentDifficulty')}</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: difficultyInfo.currentDifficulty }, (_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="ml-1 text-xl font-semibold text-purple-600">({difficultyInfo.currentDifficulty})</span>
              </div>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase7.targetBlockTime')}</p>
              <p className="font-semibold text-blue-600 text-xl">{difficultyInfo.targetBlockTime}s</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase7.avgTimePerBlock')}</p>
              <p className={`font-semibold text-xl ${
                difficultyInfo.avgTimePerBlock > 0
                  ? difficultyInfo.avgTimePerBlock < difficultyInfo.targetBlockTime * 0.8
                    ? 'text-red-600'
                    : difficultyInfo.avgTimePerBlock > difficultyInfo.targetBlockTime * 1.2
                      ? 'text-blue-600'
                      : 'text-green-600'
                  : 'text-gray-600 dark:text-zinc-400'
              }`}>
                {difficultyInfo.avgTimePerBlock > 0 ? `${difficultyInfo.avgTimePerBlock}s` : '--'}
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase7.blocksInPeriod')}</p>
              <p className="font-semibold text-indigo-600 text-xl">
                {difficultyInfo.blocksInCurrentPeriod}/{difficultyInfo.adjustmentInterval}
              </p>
            </div>
          </div>

          {/* Period History */}
          {difficultyInfo.periodHistory.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-2">{t('phase7.periodHistory')}</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {difficultyInfo.periodHistory.slice().reverse().map((period, idx) => (
                  <div key={period.periodNumber} className={`p-2 rounded text-sm ${
                    idx === 0 ? 'bg-purple-100' : 'bg-gray-50'
                  }`}>
                    <span className="font-medium">P{period.periodNumber}:</span>{' '}
                    <span>{period.totalTimeSeconds}s</span>{' '}
                    <span className="text-gray-500">({t('phase7.difficulty')}: {'⭐'.repeat(period.difficulty)})</span>
                    {period.avgTimePerBlock > 0 && (
                      <span className={
                        period.avgTimePerBlock < difficultyInfo.targetBlockTime * 0.8
                          ? ' text-red-500'
                          : period.avgTimePerBlock > difficultyInfo.targetBlockTime * 1.2
                            ? ' text-blue-500'
                            : ' text-green-500'
                      }>
                        {' → '}{period.avgTimePerBlock < difficultyInfo.targetBlockTime * 0.8 
                          ? t('phase7.tooFast') 
                          : period.avgTimePerBlock > difficultyInfo.targetBlockTime * 1.2 
                            ? t('phase7.tooSlow') 
                            : t('phase7.onTarget')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Demo Controls */}
          <div className="p-4 bg-white rounded-lg border border-purple-200">
            <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3">{t('phase7.demoControls')}</h3>
            <div className="space-y-4">
              {/* Force Difficulty */}
              <div>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-2">{t('phase7.forceDifficulty')}</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((d) => (
                    <button
                      key={d}
                      onClick={async () => {
                        setAdjustingDifficulty(true);
                        await onForceDifficultyAdjustment?.(d);
                        setAdjustingDifficulty(false);
                      }}
                      disabled={adjustingDifficulty || difficultyInfo.currentDifficulty === d}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        difficultyInfo.currentDifficulty === d
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      } disabled:opacity-50`}
                    >
                      {'⭐'.repeat(d)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change Target Time */}
              <div>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-2">{t('phase7.changeTargetTime')}</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={newTargetTime}
                    onChange={(e) => setNewTargetTime(parseInt(e.target.value) || 30)}
                    className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                  />
                  <span className="text-sm text-gray-500">{t('phase7.seconds')}</span>
                  <button
                    onClick={async () => {
                      await onUpdateDifficultySettings?.({ targetBlockTime: newTargetTime });
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('phase7.apply')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Phase 8 Economic Incentives Control Panel */}
      {currentPhase === 8 && halvingInfo && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-600" />
              <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('phase8InstructionTitle')}</h2>
            </div>
          </div>

          {/* Halving Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase8.currentReward')}</p>
              <p className="font-semibold text-yellow-600 text-xl">{halvingInfo.currentBlockReward} BTC</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase8.blocksToHalving')}</p>
              <p className="font-semibold text-orange-600 text-xl">{halvingInfo.blocksUntilNextHalving}</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase8.nextReward')}</p>
              <p className="font-semibold text-red-600 text-xl">{halvingInfo.nextReward.toFixed(2)} BTC</p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase8.totalEmitted')}</p>
              <p className="font-semibold text-green-600 text-xl">{halvingInfo.totalBtcEmitted.toFixed(1)} / {halvingInfo.maxBtc}</p>
            </div>
          </div>

          {/* Economic Stats */}
          {economicStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase8.avgFee')}</p>
                <p className="font-semibold text-blue-600 text-xl">{economicStats.averageFee} BTC</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase8.totalFeesPaid')}</p>
                <p className="font-semibold text-purple-600 text-xl">{economicStats.totalFeesPaid} BTC</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase8.totalBlockRewards')}</p>
                <p className="font-semibold text-indigo-600 text-xl">{economicStats.totalBlockRewardsPaid} BTC</p>
              </div>
            </div>
          )}

          {/* Miner Earnings Ranking */}
          {economicStats && economicStats.minerEarnings.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-2">{t('phase8.minerEarnings')}</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {economicStats.minerEarnings.map((miner, idx) => (
                  <div key={miner.minerId} className={`p-2 rounded text-sm ${idx === 0 ? 'bg-yellow-100' : 'bg-gray-50'}`}>
                    <span className="font-medium">{idx + 1}. {miner.minerName}:</span>{' '}
                    <span className="text-yellow-600">{miner.blockRewards} BTC</span>{' '}
                    <span className="text-gray-500">({t('phase8.rewards')})</span> +{' '}
                    <span className="text-green-600">{miner.fees} BTC</span>{' '}
                    <span className="text-gray-500">({t('phase8.fees')})</span> ={' '}
                    <span className="font-bold text-orange-600">{miner.total} BTC</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Demo Controls */}
          <div className="p-4 bg-white rounded-lg border border-yellow-200">
            <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3">{t('phase8.demoControls')}</h3>
            <div className="space-y-4">
              {/* Force Halving */}
              <div>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-2">{t('phase8.forceHalving')}</p>
                <button
                  onClick={async () => {
                    setForcingHalving(true);
                    await onForceHalving?.();
                    setForcingHalving(false);
                  }}
                  disabled={forcingHalving || halvingInfo.currentBlockReward < 0.1}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  🔥 {t('phase8.triggerHalving')} ({halvingInfo.currentBlockReward} → {(halvingInfo.currentBlockReward / 2).toFixed(2)} BTC)
                </button>
              </div>

              {/* Change Block Reward */}
              <div>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-2">{t('phase8.changeBlockReward')}</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="0.01"
                    max="100"
                    step="0.1"
                    value={newBlockReward}
                    onChange={(e) => setNewBlockReward(parseFloat(e.target.value) || 50)}
                    className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                  />
                  <span className="text-sm text-gray-500">BTC</span>
                  <button
                    onClick={async () => {
                      await onUpdateHalvingSettings?.({ blockReward: newBlockReward });
                    }}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('phase8.apply')}
                  </button>
                </div>
              </div>

              {/* Fill Mempool with varying fees */}
              <div>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-2">{t('phase8.fillMempoolWithFees')}</p>
                <button
                  onClick={() => onFillMempool?.(15)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  📨 {t('phase8.addTxWithFees')}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Phase 9 Free Simulation Control Panel */}
      {currentPhase === 9 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎓</span>
              <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('phase9InstructionTitle')}</h2>
            </div>
            {room.simulationStarted && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                ✓ {t('phase9.simulationActive')}
              </span>
            )}
          </div>

          {/* Global Statistics */}
          {simulationStats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase9.totalBlocks')}</p>
                <p className="font-semibold text-blue-600 text-xl">{simulationStats.totalBlocks}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase9.totalTxs')}</p>
                <p className="font-semibold text-green-600 text-xl">{simulationStats.totalTransactions}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase9.btcCirculation')}</p>
                <p className="font-semibold text-yellow-600 text-xl">{simulationStats.btcInCirculation.toFixed(1)} BTC</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase9.hashrate')}</p>
                <p className="font-semibold text-orange-600 text-xl">{simulationStats.totalHashrate}</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-500 dark:text-zinc-500">{t('phase9.energySpent')}</p>
                <p className="font-semibold text-red-600 text-xl">{simulationStats.totalEnergySpent} kWh</p>
              </div>
            </div>
          )}

          {/* Wealth Distribution */}
          {simulationStats && simulationStats.wealthDistribution.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-2">{t('phase9.wealthDistribution')}</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {simulationStats.wealthDistribution.map((entry, idx) => (
                  <div key={entry.participantId} className={`p-2 rounded text-sm flex items-center justify-between ${idx === 0 ? 'bg-yellow-100' : 'bg-gray-50'}`}>
                    <span className="font-medium">{idx + 1}. {entry.name}</span>
                    <span className="font-semibold text-yellow-600">{entry.balance.toFixed(2)} BTC</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Challenge Controls */}
          <div className="p-4 bg-white rounded-lg border border-purple-200 mb-4">
            <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3">🎯 {t('phase9.challenges')}</h3>
            
            {room.activeChallenge ? (
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="font-medium text-red-700">
                    {t(`phase9.challenge.${room.activeChallenge}.title`)}
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {t(`phase9.challenge.${room.activeChallenge}.description`)}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await onEndChallenge?.();
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  ⏹️ {t('phase9.endChallenge')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    setLaunchingChallenge(true);
                    await onLaunchChallenge?.('51_attack');
                    setLaunchingChallenge(false);
                  }}
                  disabled={launchingChallenge}
                  className="p-3 bg-red-100 hover:bg-red-200 rounded-lg text-left transition-colors"
                >
                  <span className="font-medium text-red-700">⚔️ {t('phase9.challenge.51_attack.title')}</span>
                  <p className="text-xs text-red-600 mt-1">{t('phase9.challenge.51_attack.short')}</p>
                </button>
                <button
                  onClick={async () => {
                    setLaunchingChallenge(true);
                    await onLaunchChallenge?.('congestion');
                    setLaunchingChallenge(false);
                  }}
                  disabled={launchingChallenge}
                  className="p-3 bg-orange-100 hover:bg-orange-200 rounded-lg text-left transition-colors"
                >
                  <span className="font-medium text-orange-700">🚦 {t('phase9.challenge.congestion.title')}</span>
                  <p className="text-xs text-orange-600 mt-1">{t('phase9.challenge.congestion.short')}</p>
                </button>
                <button
                  onClick={async () => {
                    setLaunchingChallenge(true);
                    await onLaunchChallenge?.('fork');
                    setLaunchingChallenge(false);
                  }}
                  disabled={launchingChallenge}
                  className="p-3 bg-yellow-100 hover:bg-yellow-200 rounded-lg text-left transition-colors"
                >
                  <span className="font-medium text-yellow-700">🔀 {t('phase9.challenge.fork.title')}</span>
                  <p className="text-xs text-yellow-600 mt-1">{t('phase9.challenge.fork.short')}</p>
                </button>
                <button
                  onClick={async () => {
                    setLaunchingChallenge(true);
                    await onLaunchChallenge?.('economy');
                    setLaunchingChallenge(false);
                  }}
                  disabled={launchingChallenge}
                  className="p-3 bg-green-100 hover:bg-green-200 rounded-lg text-left transition-colors"
                >
                  <span className="font-medium text-green-700">📈 {t('phase9.challenge.economy.title')}</span>
                  <p className="text-xs text-green-600 mt-1">{t('phase9.challenge.economy.short')}</p>
                </button>
                <button
                  onClick={async () => {
                    setLaunchingChallenge(true);
                    await onLaunchChallenge?.('environment');
                    setLaunchingChallenge(false);
                  }}
                  disabled={launchingChallenge}
                  className="p-3 bg-teal-100 hover:bg-teal-200 rounded-lg text-left transition-colors col-span-full md:col-span-1"
                >
                  <span className="font-medium text-teal-700">🌍 {t('phase9.challenge.environment.title')}</span>
                  <p className="text-xs text-teal-600 mt-1">{t('phase9.challenge.environment.short')}</p>
                </button>
              </div>
            )}
          </div>

          {/* Demo Controls */}
          <div className="p-4 bg-white rounded-lg border border-purple-200">
            <h3 className="font-medium text-gray-700 dark:text-zinc-300 mb-3">🎮 {t('phase9.demoControls')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {!room.simulationStarted ? (
                <button
                  onClick={async () => {
                    await onStartSimulation?.();
                  }}
                  className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  ▶️ {t('phase9.startSimulation')}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await onResetSimulation?.();
                  }}
                  className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  🔄 {t('phase9.resetSimulation')}
                </button>
              )}
              <button
                onClick={async () => {
                  await onFillSimulationMempool?.();
                }}
                className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                📨 {t('phase9.fillMempool')}
              </button>
              <button
                onClick={async () => {
                  await onAccelerateHalvings?.(3);
                }}
                className="p-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
              >
                ⏩ {t('phase9.accelerateHalvings')}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student Activity Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="zone-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('studentActivity')}</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-700">
                  <th className="text-left py-2 px-2 font-medium text-gray-600 dark:text-zinc-400 dark:text-zinc-400">Nom</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600 dark:text-zinc-400 dark:text-zinc-400">TX</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600 dark:text-zinc-400 dark:text-zinc-400">Enviat</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600 dark:text-zinc-400 dark:text-zinc-400">Rebut</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600 dark:text-zinc-400 dark:text-zinc-400">Saldo</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600 dark:text-zinc-400 dark:text-zinc-400">Sospitós?</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const stats = getStudentStats(student);
                  return (
                    <tr key={student.id} className="border-b border-gray-100 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700/50">
                      <td className="py-2 px-2 font-medium text-gray-800 dark:text-zinc-200">{student.name}</td>
                      <td className="py-2 px-2 text-center text-gray-600 dark:text-zinc-400 dark:text-zinc-400">{stats.transactionCount}</td>
                      <td className="py-2 px-2 text-center text-gray-600 dark:text-zinc-400 dark:text-zinc-400">{stats.totalSent}</td>
                      <td className="py-2 px-2 text-center text-gray-600 dark:text-zinc-400 dark:text-zinc-400">{stats.totalReceived}</td>
                      <td className={`py-2 px-2 text-center font-medium ${
                        stats.claimedBalance < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {stats.claimedBalance}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {stats.discrepancy ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded-full text-xs">
                            <AlertTriangle className="w-3 h-3" />
                            Sí
                          </span>
                        ) : stats.hasOverspent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full text-xs" title="Ha enviat més del saldo disponible">
                            <HelpCircle className="w-3 h-3" />
                            ?
                          </span>
                        ) : (
                          <span className="text-green-500">✔</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {students.length === 0 && (
            <p className="text-center text-gray-500 dark:text-zinc-500 py-4">No hi ha estudiants encara</p>
          )}
        </motion.div>

        {/* Transaction Registry */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="zone-card"
        >
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-violet-500" />
            <h2 className="font-semibold text-gray-800 dark:text-zinc-100">{t('transactionRegistry')}</h2>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {transactions.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-zinc-500 py-4">No hi ha transaccions encara</p>
            ) : (
              transactions.map((tx) => {
                const isSuspicious = isTransactionSuspicious(tx);
                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      tx.isHighlighted
                        ? 'bg-amber-100 dark:bg-amber-500/20 border-2 border-amber-400 dark:border-amber-500/50'
                        : isSuspicious
                        ? 'bg-red-50 dark:bg-red-500/10 border-l-4 border-red-400 dark:border-red-500'
                        : 'bg-gray-50 dark:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700 dark:text-zinc-300">{tx.sender?.name}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-medium text-gray-700 dark:text-zinc-300">{tx.receiver?.name}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{tx.amount} <i className="fa-solid fa-cent-sign" /></span>
                      {isSuspicious && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded-full text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          Saldo insuficient
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => onHighlightTransaction(tx.id, !tx.isHighlighted)}
                      className={`p-2 rounded-lg transition-colors ${
                        tx.isHighlighted
                          ? 'bg-amber-200 dark:bg-amber-500/30 text-amber-700 dark:text-amber-400'
                          : 'hover:bg-gray-200 dark:hover:bg-zinc-600 text-gray-400 dark:text-zinc-500'
                      }`}
                      title={t('highlightTransaction')}
                    >
                      <Star className={`w-4 h-4 ${tx.isHighlighted ? 'fill-current' : ''}`} />
                    </button>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

    </div>
  );
}
