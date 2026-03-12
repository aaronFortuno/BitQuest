'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Users,
  AlertTriangle,
  AlertCircle,
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
  Send,
  User,
  ShieldCheck,
  Wallet,
  Link,
  Trophy,
  Pickaxe,
  Users2,
} from 'lucide-react';
import { Room, Transaction, Participant, CoinFile, SignedMessage, UTXO, UTXOTransaction, UTXOOutput, MempoolTransaction, NodeConnection, Block, HalvingInfo, EconomicStats, SimulationStats, ChallengeType, ChallengeData, MiningPool } from '@/lib/types';
import { DifficultyInfo } from '@/hooks/use-room-polling';
import { type RSAKeyPair, type KeyGenSteps } from '@/lib/crypto';
import Phase3CryptoPanel from './phase3-crypto-panel';
import Phase4UtxoPanel from './phase4-utxo-panel';
import Phase3UserInterface from './phase3-user-interface';
import Phase5TeacherPanel from './phase5-teacher-panel';
import Phase6BlockchainPanel from './phase6-blockchain-panel';
import { BlockchainVisualization } from './blockchain-visualization';

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
  onUpdateTransferLimit?: (limit: number) => Promise<void>;
  onApproveTransaction?: (transactionId: string) => Promise<void>;
  onRejectTransaction?: (transactionId: string, reason: string) => Promise<void>;
  onForceTransaction?: (transactionId: string, action: 'accept' | 'reject') => Promise<void>;
  onVote?: (transactionId: string, vote: 'for' | 'against') => Promise<void>;
  // Phase 3 teacher-as-participant
  participant?: Participant;
  onGenerateKeys?: () => { publicKey: string; privateKey: RSAKeyPair['privateKey']; steps: KeyGenSteps } | null;
  onBroadcastKey?: (publicKey: string) => Promise<boolean>;
  onSendSignedMessage?: (content: string, messageHash: string, signature: string) => Promise<void>;
  // Phase 5
  onToggleNodeDisconnection?: (nodeId: string, isDisconnected: boolean) => Promise<void>;
  onFillMempool?: (count?: number) => Promise<void>;
  onInitializeNetwork?: (regenerate?: boolean) => Promise<void>;
  onCreateTeacherTransaction?: (originNodeId: string) => Promise<void>;
  onDestroyConnection?: (connectionId: string) => Promise<void>;
  onToggleStudentSending?: (enabled: boolean) => Promise<void>;
  // Phase 6 & 7
  onCreatePendingBlock?: () => Promise<Block | null>;
  onCreateGenesisBlock?: () => Promise<void>;
  onResetBlockchain?: () => Promise<void>;
  onToggleMining?: () => Promise<void>;
  onForceDifficultyAdjustment?: (newDifficulty: number) => Promise<{ success: boolean; error?: string }>;
  onUpdateDifficultySettings?: (settings: { targetBlockTime?: number; adjustmentInterval?: number }) => Promise<{ success: boolean; error?: string }>;
  onUpdateRigSettings?: (participantId: string, settings: { maxRigs?: number; allowUpgrade?: boolean }) => Promise<void>;
  // Phase 7: Mining pools
  miningPools?: MiningPool[];
  poolsEnabled?: boolean;
  onTogglePools?: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  onDeletePool?: (poolId: string) => Promise<{ success: boolean; error?: string }>;
  // Phase 8
  onForceHalving?: () => Promise<{ success: boolean; previousReward?: number; newReward?: number; error?: string }>;
  onUpdateHalvingSettings?: (settings: { halvingInterval?: number; blockReward?: number }) => Promise<{ success: boolean; error?: string }>;
  autoMineSettings?: { autoMineInterval: number; autoMineCapacity: number };
  onUpdatePhase8Settings?: (settings: { autoMineInterval?: number; autoMineCapacity?: number }) => Promise<{ success: boolean; error?: string }>;
  // Phase 9
  simulationStats?: SimulationStats | null;
  onStartSimulation?: () => Promise<{ success: boolean; error?: string }>;
  onResetSimulation?: () => Promise<{ success: boolean; error?: string }>;
  onLaunchChallenge?: (challengeType: ChallengeType) => Promise<{ success: boolean; challengeData?: ChallengeData; error?: string }>;
  onEndChallenge?: () => Promise<{ success: boolean; error?: string }>;
  onFillSimulationMempool?: () => Promise<{ success: boolean; error?: string }>;
  onAccelerateHalvings?: (count: number) => Promise<{ success: boolean; newReward?: number; error?: string }>;
  onUpdateParticipantBalance?: (participantId: string, coinFile: string) => Promise<void>;
  onProposeTransaction?: (senderId: string, receiverId: string, amount: number, proposedById: string) => Promise<void>;
  // Phase 4: Teacher sends BTC to students
  onTeacherSendUtxo?: (participantId: string, amount: number) => Promise<UTXO[] | null>;
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
  onUpdateTransferLimit,
  onApproveTransaction,
  onRejectTransaction,
  onForceTransaction,
  onVote,
  participant,
  onGenerateKeys,
  onBroadcastKey,
  onSendSignedMessage,
  onToggleNodeDisconnection,
  onFillMempool,
  onInitializeNetwork,
  onCreateTeacherTransaction,
  onDestroyConnection,
  onToggleStudentSending,
  onCreatePendingBlock,
  onCreateGenesisBlock,
  onResetBlockchain,
  onToggleMining,
  onForceDifficultyAdjustment,
  onUpdateDifficultySettings,
  onUpdateRigSettings,
  // Phase 7: Mining pools
  miningPools = [],
  poolsEnabled = false,
  onTogglePools,
  onDeletePool,
  onForceHalving,
  onUpdateHalvingSettings,
  autoMineSettings = { autoMineInterval: 20, autoMineCapacity: 3 },
  onUpdatePhase8Settings,
  // Phase 9
  simulationStats,
  onStartSimulation,
  onResetSimulation,
  onLaunchChallenge,
  onEndChallenge,
  onFillSimulationMempool,
  onAccelerateHalvings,
  onUpdateParticipantBalance,
  onProposeTransaction,
  onTeacherSendUtxo,
}: TeacherDashboardProps) {
  const { t } = useTranslation();
  const [processingTx, setProcessingTx] = useState<string | null>(null);
  // Phase 7: Time since last block counter
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

  // Phase 8 state
  const [newBlockReward, setNewBlockReward] = useState<number>(50);
  const [forcingHalving, setForcingHalving] = useState(false);
  // Phase 9 state
  const [launchingChallenge, setLaunchingChallenge] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeType>(null);
  const [editingBalances, setEditingBalances] = useState<Record<string, string>>({});
  // Phase 4 teacher send BTC state
  const [sendBtcAmount, setSendBtcAmount] = useState<number>(10);
  const [sendBtcSubmitting, setSendBtcSubmitting] = useState(false);
  const [sendBtcFeedback, setSendBtcFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sendBtcSelectedStudents, setSendBtcSelectedStudents] = useState<Set<string>>(new Set());
  // Phase 4 teacher local TX validation (same as students)
  const [teacherValidatedTxIds, setTeacherValidatedTxIds] = useState<string[]>([]);
  // Phase 2 teacher-as-participant state
  const [selectedSender, setSelectedSender] = useState<string>('');
  const [selectedReceiver, setSelectedReceiver] = useState<string>('');
  const [txAmount, setTxAmount] = useState<number>(1);
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txFeedback, setTxFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  // Phase 4: Teacher TX validation localStorage
  useEffect(() => {
    if (participant?.id) {
      try {
        const stored = localStorage.getItem(`bitquest_validatedTxs_${participant.id}`);
        if (stored) setTeacherValidatedTxIds(JSON.parse(stored));
      } catch {}
    }
  }, [participant?.id]);

  const saveTeacherValidatedTxIds = useCallback((ids: string[]) => {
    setTeacherValidatedTxIds(ids);
    if (participant?.id) {
      localStorage.setItem(`bitquest_validatedTxs_${participant.id}`, JSON.stringify(ids));
    }
  }, [participant?.id]);

  const handleTeacherValidateTx = useCallback((txId: string) => {
    if (!teacherValidatedTxIds.includes(txId)) {
      saveTeacherValidatedTxIds([...teacherValidatedTxIds, txId]);
    }
  }, [teacherValidatedTxIds, saveTeacherValidatedTxIds]);

  const teacherPendingTxs = useMemo(() =>
    utxoTransactions.filter(tx => !teacherValidatedTxIds.includes(tx.id)),
    [utxoTransactions, teacherValidatedTxIds]
  );

  const teacherVerifiedTxs = useMemo(() =>
    teacherValidatedTxIds
      .map(id => utxoTransactions.find(tx => tx.id === id))
      .filter((tx): tx is UTXOTransaction => tx !== undefined),
    [utxoTransactions, teacherValidatedTxIds]
  );

  const getParticipantName = useCallback((id: string) => {
    const p = room?.participants?.find(p => p.id === id);
    return p ? p.name : 'Unknown';
  }, [room?.participants]);

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
    
    // Calculate sender's balance before this transaction (only count approved txs)
    let senderBalance = 10; // Initial balance
    for (const prevTx of previousTxs) {
      if (prevTx.status !== 'approved') continue;
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
    const sent = transactions.filter((tx) => tx.senderId === student.id && tx.status === 'approved');
    const received = transactions.filter((tx) => tx.receiverId === student.id && tx.status === 'approved');
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
  const votingTransactions = transactions.filter((tx) => tx.status === 'voting');
  const proposedTransactions = transactions.filter((tx) =>
    tx.status === 'voting' || tx.status === 'approved' || tx.status === 'rejected'
  );
  const processedTransactions = transactions.filter((tx) =>
    tx.status === 'approved' || tx.status === 'rejected'
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
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

  // Phase 3 stats
  const studentsWithKeys = students.filter(s => s.publicKey).length;
  const totalMessages = messages.length;

  return (
    <div className="space-y-6">

      {/* Phase 0: Student Activity + Transaction History */}
      {currentPhase === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Student Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="zone-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-heading">{t('studentActivity')}</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[12%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-default">
                    <th className="text-left py-2 px-2 font-medium text-secondary">{t('name')}</th>
                    <th className="text-center py-2 px-2 font-medium text-secondary">TX</th>
                    <th className="text-center py-2 px-2 font-medium text-secondary">{t('sent')}</th>
                    <th className="text-center py-2 px-2 font-medium text-secondary">{t('received')}</th>
                    <th className="text-center py-2 px-2 font-medium text-secondary">{t('coinFileBalance')}</th>
                    <th className="text-center py-2 px-2 font-medium text-secondary">{t('realBalance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const stats = getStudentStats(student);
                    return (
                      <tr
                        key={student.id}
                        className={`border-b border-subtle hover:bg-surface-alt ${
                          stats.discrepancy ? 'bg-red-50 dark:bg-red-500/10' : ''
                        }`}
                      >
                        <td className="py-2 px-2 font-medium text-heading flex items-center gap-1">
                          {student.name}
                          {stats.discrepancy && (
                            <span title={t('balanceDiscrepancy')}><AlertTriangle className="w-3.5 h-3.5 text-red-500" /></span>
                          )}
                          {stats.hasOverspent && (
                            <span title={t('overspent')}><AlertCircle className="w-3.5 h-3.5 text-amber-500" /></span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center text-secondary">{stats.transactionCount}</td>
                        <td className="py-2 px-2 text-center text-secondary">{stats.totalSent}</td>
                        <td className="py-2 px-2 text-center text-secondary">{stats.totalReceived}</td>
                        <td className={`py-2 px-2 text-center font-medium ${
                          stats.discrepancy ? 'text-red-600' : 'text-body'
                        }`}>
                          {stats.claimedBalance}
                        </td>
                        <td className="py-2 px-2 text-center font-medium text-emerald-600">
                          {stats.calculatedBalance}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {students.length === 0 && (
              <p className="text-center text-muted py-4">{t('noStudentsYet')}</p>
            )}

            {students.some(s => getStudentStats(s).discrepancy) && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t('discrepancyDetected')}
                </p>
              </div>
            )}
          </motion.div>

          {/* Right Column: Transaction History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="zone-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-violet-500" />
              <h2 className="font-semibold text-heading">{t('transactionRegistry')}</h2>
              <span className="text-xs text-muted ml-auto">{transactions.length} {t('totalTransactions').toLowerCase()}</span>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-center text-muted py-4">{t('noTransactionsYet')}</p>
              ) : (
                [...transactions].sort((a, b) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ).map((tx) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      isTransactionSuspicious(tx)
                        ? 'bg-red-50 dark:bg-red-500/10 border-l-4 border-red-400'
                        : tx.isHighlighted
                          ? 'bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400'
                          : 'bg-surface-alt'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-body">{tx.sender?.name}</span>
                      <span className="text-faint">→</span>
                      <span className="font-medium text-body">{tx.receiver?.name}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{tx.amount}</span>
                      {isTransactionSuspicious(tx) && (
                        <span className="badge-red rounded-full text-xs px-2 py-0.5 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {t('impossibleTransactions')}
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
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Phase 1: 2-column layout */}
      {currentPhase === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Bank Panel + Pending Queue + Bank Accounts */}
          <div className="space-y-6">
            {/* Bank Control Panel — compact 1 row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="zone-card phase-panel-emerald"
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-heading">{t('bankPanel')}</h2>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => onToggleBankDisconnection && onToggleBankDisconnection(!isBankDisconnected)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isBankDisconnected
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {isBankDisconnected ? (
                      <><Plug className="w-3.5 h-3.5" /> {t('reconnectBank')}</>
                    ) : (
                      <><Unplug className="w-3.5 h-3.5" /> {t('closeBank')}</>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <label className="text-sm text-secondary whitespace-nowrap">{t('transferLimit')}:</label>
                    <input
                      type="number"
                      min="1"
                      value={room?.maxTransferAmount ?? 5}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val > 0 && onUpdateTransferLimit) onUpdateTransferLimit(val);
                      }}
                      className="input-field w-12 text-center py-1"
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Pending Transactions Queue */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="zone-card"
            >
              <h3 className="font-medium text-heading mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                {t('pendingRequests')}
                {pendingTransactions.length > 0 && (
                  <span className="px-2 py-0.5 badge-amber rounded-full text-xs font-medium">
                    {pendingTransactions.length}
                  </span>
                )}
              </h3>
              {pendingTransactions.length > 0 ? (
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
                        className="p-3 bg-surface rounded-lg border border-amber-200 dark:border-amber-500/30 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-body">{tx.sender?.name}</span>
                            <span className="text-faint">→</span>
                            <span className="font-medium text-body">{tx.receiver?.name}</span>
                            <span className="text-amber-600 font-bold">{tx.amount} <i className="fa-solid fa-cent-sign" /></span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            hasSufficientBalance
                              ? 'badge-green'
                              : 'badge-red'
                          }`}>
                            {hasSufficientBalance ? t('sufficientBalance') : t('insufficientBalance')}
                            {' '}({senderBalance})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(tx.id)}
                            disabled={isProcessing || isBankDisconnected}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {t('approve')}
                          </button>
                          <button
                            onClick={() => handleReject(tx.id, hasSufficientBalance)}
                            disabled={isProcessing || isBankDisconnected}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 dark:disabled:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {t('reject')}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted py-4 bg-surface rounded-lg">
                  {t('noPendingRequests')}
                </p>
              )}
            </motion.div>

            {/* Bank Accounts Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="zone-card"
            >
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-heading">{t('bankAccounts')}</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[14%]" />
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-default">
                      <th className="text-left py-2 px-2 font-medium text-secondary">Nom</th>
                      <th className="text-center py-2 px-2 font-medium text-secondary">TX</th>
                      <th className="text-center py-2 px-2 font-medium text-secondary">Enviat</th>
                      <th className="text-center py-2 px-2 font-medium text-secondary">Rebut</th>
                      <th className="text-center py-2 px-2 font-medium text-secondary">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const stats = getStudentStats(student);
                      const editVal = editingBalances[student.id];
                      const displayBalance = editVal !== undefined ? editVal : String(stats.claimedBalance);

                      const commitBalance = (val: string) => {
                        const num = parseInt(val);
                        if (!isNaN(num) && onUpdateParticipantBalance) {
                          try {
                            const coinFile = JSON.parse(student.coinFile ?? '{}');
                            coinFile.saldo = num;
                            onUpdateParticipantBalance(student.id, JSON.stringify(coinFile));
                          } catch {
                            onUpdateParticipantBalance(student.id, JSON.stringify({ propietari: student.name, saldo: num }));
                          }
                        }
                        setEditingBalances(prev => {
                          const next = { ...prev };
                          delete next[student.id];
                          return next;
                        });
                      };

                      return (
                        <tr key={student.id} className="border-b border-subtle hover:bg-surface-alt">
                          <td className="py-2 px-2 font-medium text-heading">{student.name}</td>
                          <td className="py-2 px-2 text-center text-secondary">{stats.transactionCount}</td>
                          <td className="py-2 px-2 text-center text-secondary">{stats.totalSent}</td>
                          <td className="py-2 px-2 text-center text-secondary">{stats.totalReceived}</td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              value={displayBalance}
                              onChange={(e) => setEditingBalances(prev => ({ ...prev, [student.id]: e.target.value }))}
                              onBlur={(e) => commitBalance(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitBalance((e.target as HTMLInputElement).value); }}
                              className={`w-16 text-center input-field py-0.5 font-medium ${
                                stats.claimedBalance < 0 ? 'text-red-600' : 'text-green-600'
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {students.length === 0 && (
                <p className="text-center text-muted py-4">No hi ha estudiants encara</p>
              )}
            </motion.div>
          </div>

          {/* Right Column: Transaction Registry */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="zone-card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-violet-500" />
              <h2 className="font-semibold text-heading">{t('transactionRegistry')}</h2>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-center text-muted py-4">No hi ha transaccions encara</p>
              ) : (
                transactions.map((tx) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      tx.status === 'pending'
                        ? 'bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400'
                        : tx.status === 'rejected'
                        ? 'bg-red-50 dark:bg-red-500/10 border-l-4 border-red-400'
                        : 'bg-surface-alt'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {tx.status === 'pending' && <Clock className="w-4 h-4 text-amber-500" />}
                      {tx.status === 'approved' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                      {tx.status === 'rejected' && <XCircle className="w-4 h-4 text-red-500" />}
                      <span className="font-medium text-body">{tx.sender?.name}</span>
                      <span className="text-faint">→</span>
                      <span className="font-medium text-body">{tx.receiver?.name}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{tx.amount} <i className="fa-solid fa-cent-sign" /></span>
                      {tx.status === 'rejected' && tx.rejectReason && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 badge-red rounded-full text-xs">
                          {tx.rejectReason}
                        </span>
                      )}
                      {tx.status === 'approved' && isTransactionSuspicious(tx) && (
                        <span className="badge-red rounded-full text-xs px-2 py-0.5 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {t('insufficientBalance')}
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
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Phase 2 Voting Control Panel */}
      {currentPhase === 2 && (() => {
        const teacherParticipant = room.participants?.find(p => p.role === 'teacher');
        const allParticipants = (room.participants ?? []).filter(p => p.isActive);
        const teacherBalance = (() => {
          if (!teacherParticipant?.coinFile) return 10;
          try { return (JSON.parse(teacherParticipant.coinFile) as CoinFile)?.saldo ?? 10; } catch { return 10; }
        })();
        const getBalance = (p: Participant): number => {
          try { return (JSON.parse(p.coinFile) as CoinFile)?.saldo ?? 0; } catch { return 0; }
        };
        const totalVoters = students.length;
        const otherUsers = allParticipants.filter(p => p.id !== selectedSender);

        const handlePropose = async () => {
          if (!selectedReceiver || txAmount <= 0 || !onProposeTransaction || !teacherParticipant) return;
          const sender = selectedSender || teacherParticipant.id;
          setTxSubmitting(true);
          try {
            await onProposeTransaction(sender, selectedReceiver, txAmount, teacherParticipant.id);
            if (sender !== teacherParticipant.id) {
              setTxFeedback({ type: 'warning', message: t('falseProposalWarning') });
            } else {
              setTxFeedback({ type: 'success', message: t('proposalSent') });
            }
            setTxAmount(1);
            setSelectedReceiver('');
            setSelectedSender(teacherParticipant.id);
          } catch {
            setTxFeedback({ type: 'error', message: t('connectionError') });
          } finally {
            setTxSubmitting(false);
            setTimeout(() => setTxFeedback(null), 5000);
          }
        };

        // Initialize selectedSender to teacher if empty
        if (!selectedSender && teacherParticipant) {
          setSelectedSender(teacherParticipant.id);
        }

        return (
        <div className="flex flex-col gap-4">
          {/* Feedback */}
          <AnimatePresence>
            {txFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`p-3 rounded-xl border text-sm ${
                  txFeedback.type === 'success'
                    ? 'bg-green-500/20 border-green-500/30 text-green-300'
                    : txFeedback.type === 'error'
                    ? 'bg-red-500/20 border-red-500/30 text-red-300'
                    : 'bg-orange-500/20 border-orange-500/30 text-orange-300'
                }`}
              >
                {txFeedback.message}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-4">
              {/* Balance + Form */}
              <div className="zone-card bg-surface">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-purple-500" />
                  <h3 className="font-semibold text-heading">{teacherParticipant?.name ?? 'Professor'}</h3>
                  <span className="ml-auto text-amber-500 font-bold text-lg">
                    {t('availableBalance')}: {teacherBalance} ¢
                  </span>
                </div>

                {/* Form row */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSender}
                    onChange={(e) => {
                      setSelectedSender(e.target.value);
                      if (e.target.value === selectedReceiver) setSelectedReceiver('');
                    }}
                    className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-amber-400 transition-colors bg-white dark:bg-zinc-800 dark:text-zinc-100 text-sm"
                    disabled={txSubmitting}
                  >
                    {allParticipants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({getBalance(p)}¢)
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedReceiver}
                    onChange={(e) => setSelectedReceiver(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-amber-400 transition-colors bg-white dark:bg-zinc-800 dark:text-zinc-100 text-sm"
                    disabled={txSubmitting}
                  >
                    <option value="">-- {t('recipient')} --</option>
                    {otherUsers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={txAmount}
                    onChange={(e) => setTxAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="!w-16 flex-shrink-0 px-2 py-2 border-2 border-gray-200 dark:border-zinc-600 rounded-lg focus:outline-none focus:border-amber-400 transition-colors bg-white dark:bg-zinc-800 dark:text-zinc-100 text-sm text-center"
                    disabled={txSubmitting}
                  />

                  <button
                    onClick={handlePropose}
                    disabled={txSubmitting || !selectedReceiver}
                    className="p-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>

                {teacherParticipant && selectedSender !== teacherParticipant.id && (
                  <p className="text-xs text-orange-400 flex items-center gap-1 mt-2">
                    <AlertCircle className="w-3 h-3" />
                    {t('falseProposalWarning')}
                  </p>
                )}
              </div>

              {/* Pending Votations */}
              <div className="zone-card bg-surface flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-purple-500" />
                  <h3 className="font-semibold text-heading">{t('pendingVotations')}</h3>
                  <button
                    onClick={() => setShowReflection(!showReflection)}
                    className="ml-auto p-1 text-muted hover:text-body transition-colors"
                    title={t('consensusQuestion')}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>

                {showReflection && (
                  <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-300">
                    {t('consensusQuestion')}
                  </div>
                )}

                {votingTransactions.length === 0 ? (
                  <p className="text-sm text-muted text-center py-4">{t('noPendingVotations')}</p>
                ) : (
                  <div className="space-y-2">
                    {votingTransactions.map((tx) => {
                      const senderBalance = (() => {
                        const s = allParticipants.find(p => p.id === tx.senderId);
                        return s ? getBalance(s) : 0;
                      })();
                      const pending = totalVoters - tx.votesFor - tx.votesAgainst;
                      const hasVoted = tx.voterIds?.includes(teacherParticipant?.id ?? '') || false;

                      return (
                        <div key={tx.id} className="p-2 bg-surface-alt rounded-lg text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-body font-medium">
                              {tx.sender?.name} → {tx.receiver?.name}: {tx.amount}
                            </span>
                            <span className="text-muted">({t('availableBalance')}: {senderBalance})</span>

                            <span className="flex items-center gap-0.5 text-green-500">
                              <CheckCircle className="w-3.5 h-3.5" />{tx.votesFor}
                            </span>
                            <span className="flex items-center gap-0.5 text-red-500">
                              <XCircle className="w-3.5 h-3.5" />{tx.votesAgainst}
                            </span>
                            <span className="flex items-center gap-0.5 text-amber-500">
                              <Clock className="w-3.5 h-3.5" />{pending}
                            </span>
                          </div>

                          <div className="flex gap-1.5 mt-2 flex-wrap items-center">
                            {/* Normal vote buttons */}
                            <button
                              onClick={() => onVote && onVote(tx.id, 'for')}
                              disabled={hasVoted}
                              className="p-1 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-500 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onVote && onVote(tx.id, 'against')}
                              disabled={hasVoted}
                              className="p-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-500 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                            {hasVoted && (
                              <span className="text-xs text-muted">{t('voted')}</span>
                            )}
                            {/* Force buttons (teacher-only) */}
                            <button
                              onClick={() => onForceTransaction && onForceTransaction(tx.id, 'accept')}
                              disabled={processingTx === tx.id}
                              className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1 ml-auto"
                            >
                              <CheckCircle className="w-3 h-3" /> {t('forceAccept')}
                            </button>
                            <button
                              onClick={() => onForceTransaction && onForceTransaction(tx.id, 'reject')}
                              disabled={processingTx === tx.id}
                              className="px-2 py-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" /> {t('forceReject')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-4">
              {/* Accepted Transactions */}
              <div className="zone-card bg-surface flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h3 className="font-semibold text-heading">{t('acceptedTransactions')}</h3>
                </div>

                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {approvedTransactions.length === 0 ? (
                    <p className="text-sm text-muted text-center py-4">{t('noTransactionsYet')}</p>
                  ) : (
                    approvedTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-2 p-1.5 text-sm">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        <span className="text-body">
                          {tx.sender?.name} → {tx.receiver?.name}: {tx.amount}
                        </span>
                        <span className="text-muted text-xs ml-auto">
                          (✓{tx.votesFor} ✗{tx.votesAgainst})
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rejected Transactions */}
              <div className="zone-card bg-surface flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <h3 className="font-semibold text-heading">{t('rejectedTransactions')}</h3>
                </div>

                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {rejectedTransactions.length === 0 ? (
                    <p className="text-sm text-muted text-center py-4">{t('noTransactionsYet')}</p>
                  ) : (
                    rejectedTransactions.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-2 p-1.5 text-sm">
                        <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <span className="text-body">
                          {tx.sender?.name} → {tx.receiver?.name}: {tx.amount}
                        </span>
                        <span className="text-muted text-xs ml-auto">
                          (✓{tx.votesFor} ✗{tx.votesAgainst})
                        </span>
                        {tx.rejectReason && (
                          <span className="text-xs text-red-400">
                            — {tx.rejectReason}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Phase 3: Interactive Crypto Panel + Teacher-as-Participant */}
      {currentPhase === 3 && (
        <div className="space-y-6">
          {/* Row 1: Interactive Public Key Cryptography Panel */}
          <Phase3CryptoPanel />

          {/* Row 2: Teacher uses same interface as students */}
          {participant && onGenerateKeys && onBroadcastKey && onSendSignedMessage ? (
            <Phase3UserInterface
              room={room}
              participant={participant}
              messages={messages}
              onGenerateKeys={onGenerateKeys}
              onBroadcastKey={onBroadcastKey}
              onSendMessage={onSendSignedMessage}
            />
          ) : (
            <div className="zone-card">
              <p className="text-center text-muted py-4">{t('loading')}</p>
            </div>
          )}

        </div>
      )}

      {/* Phase 4 UTXO Educational Panel */}
      {currentPhase === 4 && participant && (
        <Phase4UtxoPanel
          participant={participant}
          room={room}
          utxos={utxos ?? []}
          utxoTransactions={utxoTransactions ?? []}
        />
      )}

      {/* Phase 4 UTXO Control Panel — two-column layout */}
      {currentPhase === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left column: Model UTXO (send BTC) + Pending TX */}
          <div className="space-y-4">
            {/* Model UTXO — Send BTC to students */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="zone-card"
            >
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-heading" />
                <h2 className="font-semibold text-heading">{t('phase4')}</h2>
              </div>

              {/* Student toggle buttons */}
              <div className="mb-4">
                <label className="text-xs text-muted block mb-2">{t('phase4.selectStudent')}</label>
                <div className="flex flex-wrap gap-2">
                  {students.map(s => {
                    const isSelected = sendBtcSelectedStudents.has(s.id);
                    const studentUtxos = utxos.filter(u => u.ownerId === s.id && !u.isSpent);
                    const totalBalance = studentUtxos.reduce((sum, u) => sum + u.amount, 0);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSendBtcSelectedStudents(prev => {
                            const next = new Set(prev);
                            if (next.has(s.id)) next.delete(s.id);
                            else next.add(s.id);
                            return next;
                          });
                        }}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors border ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-surface border-gray-300 dark:border-gray-600 text-body hover:border-blue-400'
                        }`}
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-1 text-xs opacity-70">{totalBalance} BTC</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount + Send */}
              <div className="flex items-end gap-3">
                <div className="w-28">
                  <label className="text-xs text-muted block mb-1">{t('phase4.sendAmount')}</label>
                  <input
                    type="number"
                    min="1"
                    value={sendBtcAmount}
                    onChange={(e) => setSendBtcAmount(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-body"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (sendBtcSelectedStudents.size === 0 || !onTeacherSendUtxo) return;
                    setSendBtcSubmitting(true);
                    setSendBtcFeedback(null);
                    try {
                      const names: string[] = [];
                      for (const sid of sendBtcSelectedStudents) {
                        const result = await onTeacherSendUtxo(sid, sendBtcAmount);
                        if (result) {
                          names.push(students.find(s => s.id === sid)?.name ?? '?');
                        }
                      }
                      if (names.length > 0) {
                        setSendBtcFeedback({ type: 'success', message: t('phase4.sentToStudent', { amount: sendBtcAmount, name: names.join(', ') }) });
                        setSendBtcSelectedStudents(new Set());
                      } else {
                        setSendBtcFeedback({ type: 'error', message: t('error') });
                      }
                    } catch {
                      setSendBtcFeedback({ type: 'error', message: t('error') });
                    } finally {
                      setSendBtcSubmitting(false);
                      setTimeout(() => setSendBtcFeedback(null), 4000);
                    }
                  }}
                  disabled={sendBtcSelectedStudents.size === 0 || sendBtcSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  {sendBtcSubmitting ? '...' : `${t('phase4.sendToStudent')} (${sendBtcSelectedStudents.size})`}
                </button>
              </div>
              {sendBtcFeedback && (
                <p className={`mt-3 text-sm ${sendBtcFeedback.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {sendBtcFeedback.type === 'success' ? <CheckCircle className="w-4 h-4 inline mr-1" /> : <XCircle className="w-4 h-4 inline mr-1" />}
                  {sendBtcFeedback.message}
                </p>
              )}
            </motion.div>

            {/* Pending Transactions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="zone-card"
            >
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-muted" />
                <h3 className="font-semibold text-heading">{t('phase4.pendingTransactions')}</h3>
              </div>

              {teacherPendingTxs.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">{t('phase4.noPendingYet')}</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {teacherPendingTxs.map(tx => (
                    <div
                      key={tx.id}
                      className={`p-3 rounded-lg border ${
                        tx.isValid
                          ? 'bg-surface border-gray-200 dark:border-gray-700'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-bold text-heading">{tx.txId}</span>
                        <div className="flex items-center gap-2">
                          {tx.isValid ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <CheckCircle className="w-3 h-3" /> {t('phase4.valid')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                              <XCircle className="w-3 h-3" /> {t('phase4.invalid')}
                            </span>
                          )}
                          <button
                            onClick={() => handleTeacherValidateTx(tx.id)}
                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                          >
                            {t('phase4.validateTx')}
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-muted mb-1">
                        {getParticipantName(tx.senderId)}
                      </div>
                      <div className="text-xs space-y-1">
                        <div className="text-faint">
                          Inputs: {tx.inputUtxoIds.join(', ')} ({tx.totalInput} BTC)
                        </div>
                        <div className="text-faint">
                          Outputs:
                          {(tx.outputs as UTXOOutput[]).map((out, i) => (
                            <span key={i} className="ml-1">
                              {out.recipientName}: {out.amount} BTC ({out.newUtxoId})
                              {i < tx.outputs.length - 1 && ','}
                            </span>
                          ))}
                        </div>
                      </div>
                      {!tx.isValid && tx.invalidReason && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                          {tx.invalidReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Right column: Verified Transactions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="zone-card border-green-200 dark:border-green-500/30"
          >
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h3 className="font-semibold text-heading">{t('phase4.verifiedTransactions')}</h3>
              <span className="text-xs text-muted ml-auto">{teacherVerifiedTxs.length} TX</span>
            </div>

            {teacherVerifiedTxs.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">{t('phase4.noVerifiedYet')}</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {teacherVerifiedTxs.map((tx, idx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-lg border border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-900/10"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">#{idx + 1}</span>
                        <span className="font-mono text-sm font-bold text-heading">{tx.txId}</span>
                      </div>
                      {tx.isValid ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle className="w-3 h-3" /> {t('phase4.valid')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <XCircle className="w-3 h-3" /> {t('phase4.invalid')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {getParticipantName(tx.senderId)} — {tx.totalInput} BTC
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Phase 5 Network & Mempool Control Panel */}
      {currentPhase === 5 && (
        <Phase5TeacherPanel
          room={room}
          students={students}
          mempoolTransactions={mempoolTransactions}
          nodeConnections={nodeConnections}
          onInitializeNetwork={onInitializeNetwork}
          onToggleNodeDisconnection={onToggleNodeDisconnection}
          onCreateTeacherTransaction={onCreateTeacherTransaction}
          onDestroyConnection={onDestroyConnection}
          onToggleStudentSending={onToggleStudentSending}
          t={t}
        />
      )}

      {/* Phase 6 Educational Panel */}
      {currentPhase === 6 && (
        <Phase6BlockchainPanel participantNames={students.map(s => s.name)} />
      )}

      {/* Phase 6: Blockchain Visualization with Genesis Button */}
      {currentPhase === 6 && (
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
                onClick={() => onCreateGenesisBlock?.()}
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
      )}

      {/* Phase 6: Network Stats + Miner Ranking (2 columns) */}
      {currentPhase === 6 && blocks.filter(b => b.status === 'mined').length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Left: Network Stats */}
          <div className="zone-card">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-heading" />
              <h2 className="text-sm font-semibold text-heading">{t('phase6.networkStats')}</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-surface-alt rounded-lg text-center">
                <p className="text-xs text-muted">{t('phase6.currentBlock')}</p>
                <p className="font-bold text-heading text-xl">
                  #{blocks.find(b => b.status === 'pending')?.blockNumber || (blocks.filter(b => b.status === 'mined').sort((a, b) => b.blockNumber - a.blockNumber)[0]?.blockNumber || 0) + 1}
                </p>
              </div>
              <div className="p-3 bg-surface-alt rounded-lg text-center">
                <p className="text-xs text-muted">{t('phase6.totalHashAttempts')}</p>
                <p className="font-bold text-heading text-xl">
                  {students.reduce((sum, s) => sum + (s.hashAttempts || 0), 0)}
                </p>
              </div>
              <div className="p-3 bg-surface-alt rounded-lg text-center">
                <p className="text-xs text-muted">{t('phase6.activeMiners')}</p>
                <p className="font-bold text-heading text-xl">
                  {students.filter(s => (s.hashAttempts || 0) > 0).length}/{students.length}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Miner Ranking */}
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
                  const attempts = student.hashAttempts || 0;
                  return (
                    <div
                      key={student.id}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        blocksCount > 0
                          ? 'bg-amber-50 dark:bg-amber-900/10'
                          : 'bg-surface-alt'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {index === 0 && blocksCount > 0 && (
                          <Trophy className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-body truncate">{student.name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                        <span className="text-green-600 dark:text-green-400 font-semibold">{reward} BTC</span>
                        <span className="text-muted">{blocksCount} {t('phase6.blocksShort')} · {attempts} h</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Phase 7: Blockchain Visualization with Genesis Button */}
      {currentPhase === 7 && (
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
                onClick={() => onCreateGenesisBlock?.()}
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
      )}

      {/* Phase 7: Time since last block */}
      {currentPhase === 7 && lastMinedBlock && (
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

      {/* Phase 7: Network Stats + Rig Controls + Miner Ranking */}
      {currentPhase === 7 && blocks.filter(b => b.status === 'mined').length > 0 && (
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
                        onClick={() => onUpdateRigSettings?.(s.id, { maxRigs: n })}
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
                    onClick={() => onUpdateRigSettings?.(s.id, { allowUpgrade: !(s.allowUpgrade || false) })}
                    className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      s.allowUpgrade
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-surface text-muted'
                    }`}
                  >
                    {s.allowUpgrade ? 'UPG' : '—'}
                  </button>
                </div>
              ))}
              {students.length === 0 && (
                <p className="text-xs text-muted text-center py-2">—</p>
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

      {/* Phase 7: Pools + Period History (left) | Difficulty Adjustment (right) */}
      {currentPhase === 7 && blocks.filter(b => b.status === 'mined').length > 0 && (
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
                  onClick={() => onTogglePools?.(!poolsEnabled)}
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
                            <span>·</span>
                            <span>{poolShare}% {t('pool.networkShare')}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => onDeletePool?.(pool.id)}
                          className="text-red-500 hover:text-red-700 text-xs px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          ✕
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
                        await onUpdateDifficultySettings?.({ targetBlockTime: sec });
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

      {/* Phase 8 Fee Market Control Panel */}
      {currentPhase === 8 && (() => {
        const phase8MinedBlocks = blocks.filter(b => b.status === 'mined').sort((a, b) => a.blockNumber - b.blockNumber);
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
                          onChange={(e) => onUpdatePhase8Settings?.({ autoMineInterval: parseInt(e.target.value) })}
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
                          onChange={(e) => onUpdatePhase8Settings?.({ autoMineCapacity: parseInt(e.target.value) })}
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
                        onClick={() => onFillMempool?.(15)}
                        className="px-4 py-2 bg-zinc-700 hover:bg-zinc-800 dark:bg-zinc-600 dark:hover:bg-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {t('phase8.addTxWithFees')}
                      </button>

                      {halvingInfo && (
                        <button
                          onClick={async () => {
                            setForcingHalving(true);
                            await onForceHalving?.();
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
      })()}

      {/* Phase 9 Free Simulation Control Panel */}
      {currentPhase === 9 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="zone-card phase-panel-purple"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎓</span>
              <h2 className="font-semibold text-heading">{t('phase9InstructionTitle')}</h2>
            </div>
            {room.simulationStarted && (
              <span className="px-3 py-1 badge-green text-sm rounded-full">
                ✓ {t('phase9.simulationActive')}
              </span>
            )}
          </div>

          {/* Global Statistics */}
          {simulationStats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
              <div className="p-3 bg-surface rounded-lg">
                <p className="text-xs text-muted">{t('phase9.totalBlocks')}</p>
                <p className="font-semibold text-blue-600 text-xl">{simulationStats.totalBlocks}</p>
              </div>
              <div className="p-3 bg-surface rounded-lg">
                <p className="text-xs text-muted">{t('phase9.totalTxs')}</p>
                <p className="font-semibold text-green-600 text-xl">{simulationStats.totalTransactions}</p>
              </div>
              <div className="p-3 bg-surface rounded-lg">
                <p className="text-xs text-muted">{t('phase9.btcCirculation')}</p>
                <p className="font-semibold text-yellow-600 text-xl">{simulationStats.btcInCirculation.toFixed(1)} BTC</p>
              </div>
              <div className="p-3 bg-surface rounded-lg">
                <p className="text-xs text-muted">{t('phase9.hashrate')}</p>
                <p className="font-semibold text-orange-600 text-xl">{simulationStats.totalHashrate}</p>
              </div>
              <div className="p-3 bg-surface rounded-lg">
                <p className="text-xs text-muted">{t('phase9.energySpent')}</p>
                <p className="font-semibold text-red-600 text-xl">{simulationStats.totalEnergySpent} kWh</p>
              </div>
            </div>
          )}

          {/* Wealth Distribution */}
          {simulationStats && simulationStats.wealthDistribution.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium text-body mb-2">{t('phase9.wealthDistribution')}</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {simulationStats.wealthDistribution.map((entry, idx) => (
                  <div key={entry.participantId} className={`p-2 rounded text-sm flex items-center justify-between ${idx === 0 ? 'bg-yellow-100 dark:bg-yellow-500/20' : 'bg-surface-alt'}`}>
                    <span className="font-medium">{idx + 1}. {entry.name}</span>
                    <span className="font-semibold text-yellow-600">{entry.balance.toFixed(2)} BTC</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Challenge Controls */}
          <div className="p-4 bg-surface rounded-lg border border-purple-200 dark:border-purple-500/30 mb-4">
            <h3 className="font-medium text-body mb-3">🎯 {t('phase9.challenges')}</h3>
            
            {room.activeChallenge ? (
              <div className="space-y-3">
                <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/30">
                  <p className="font-medium text-red-700 dark:text-red-400">
                    {t(`phase9.challenge.${room.activeChallenge}.title`)}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">
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
                  className="p-3 bg-red-100 hover:bg-red-200 dark:bg-red-500/20 dark:hover:bg-red-500/30 rounded-lg text-left transition-colors"
                >
                  <span className="font-medium text-red-700 dark:text-red-400">⚔️ {t('phase9.challenge.51_attack.title')}</span>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">{t('phase9.challenge.51_attack.short')}</p>
                </button>
                <button
                  onClick={async () => {
                    setLaunchingChallenge(true);
                    await onLaunchChallenge?.('congestion');
                    setLaunchingChallenge(false);
                  }}
                  disabled={launchingChallenge}
                  className="p-3 bg-orange-100 hover:bg-orange-200 dark:bg-orange-500/20 dark:hover:bg-orange-500/30 rounded-lg text-left transition-colors"
                >
                  <span className="font-medium text-orange-700 dark:text-orange-400">🚦 {t('phase9.challenge.congestion.title')}</span>
                  <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">{t('phase9.challenge.congestion.short')}</p>
                </button>
                <button
                  onClick={async () => {
                    setLaunchingChallenge(true);
                    await onLaunchChallenge?.('fork');
                    setLaunchingChallenge(false);
                  }}
                  disabled={launchingChallenge}
                  className="p-3 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-500/20 dark:hover:bg-yellow-500/30 rounded-lg text-left transition-colors"
                >
                  <span className="font-medium text-yellow-700 dark:text-yellow-400">🔀 {t('phase9.challenge.fork.title')}</span>
                  <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">{t('phase9.challenge.fork.short')}</p>
                </button>
                <button
                  onClick={async () => {
                    setLaunchingChallenge(true);
                    await onLaunchChallenge?.('economy');
                    setLaunchingChallenge(false);
                  }}
                  disabled={launchingChallenge}
                  className="p-3 bg-green-100 hover:bg-green-200 dark:bg-green-500/20 dark:hover:bg-green-500/30 rounded-lg text-left transition-colors"
                >
                  <span className="font-medium text-green-700 dark:text-green-400">📈 {t('phase9.challenge.economy.title')}</span>
                  <p className="text-xs text-green-600 dark:text-green-300 mt-1">{t('phase9.challenge.economy.short')}</p>
                </button>
                <button
                  onClick={async () => {
                    setLaunchingChallenge(true);
                    await onLaunchChallenge?.('environment');
                    setLaunchingChallenge(false);
                  }}
                  disabled={launchingChallenge}
                  className="p-3 bg-teal-100 hover:bg-teal-200 dark:bg-teal-500/20 dark:hover:bg-teal-500/30 rounded-lg text-left transition-colors col-span-full md:col-span-1"
                >
                  <span className="font-medium text-teal-700 dark:text-teal-400">🌍 {t('phase9.challenge.environment.title')}</span>
                  <p className="text-xs text-teal-600 dark:text-teal-300 mt-1">{t('phase9.challenge.environment.short')}</p>
                </button>
              </div>
            )}
          </div>

          {/* Demo Controls */}
          <div className="p-4 bg-surface rounded-lg border border-purple-200 dark:border-purple-500/30">
            <h3 className="font-medium text-body mb-3">🎮 {t('phase9.demoControls')}</h3>
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


    </div>
  );
}
