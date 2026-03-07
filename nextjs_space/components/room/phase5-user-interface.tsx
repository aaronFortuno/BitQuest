'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, 
  Monitor, 
  Database, 
  Send, 
  Radio, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Wifi,
  WifiOff,
  ArrowRight,
  Info
} from 'lucide-react';
import { Room, Participant, MempoolTransaction, NodeConnection } from '@/lib/types';

interface Phase5UserInterfaceProps {
  room: Room;
  participant: Participant;
  mempoolTransactions: MempoolTransaction[];
  nodeConnections: NodeConnection[];
  onCreateTransaction: (receiverId: string, amount: number, fee?: number) => Promise<{ success: boolean; error?: string }>;
  onInitializeNetwork: () => Promise<void>;
}

export default function Phase5UserInterface({
  room,
  participant,
  mempoolTransactions,
  nodeConnections,
  onCreateTransaction,
  onInitializeNetwork
}: Phase5UserInterfaceProps) {
  const { t } = useTranslation();
  const [selectedReceiver, setSelectedReceiver] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [fee, setFee] = useState<string>('0');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get active students (nodes)
  const activeNodes = useMemo(() => 
    room.participants.filter(p => p.isActive && p.role === 'student'),
    [room.participants]
  );

  // Get other students for transaction
  const otherStudents = useMemo(() =>
    activeNodes.filter(p => p.id !== participant.id),
    [activeNodes, participant.id]
  );

  // Check if current participant is disconnected
  const isDisconnected = participant.isNodeDisconnected || false;

  // Get transactions that have propagated to this node
  const receivedTransactions = useMemo(() =>
    mempoolTransactions.filter(tx => 
      tx.propagatedTo?.includes(participant.id) || tx.senderId === participant.id
    ),
    [mempoolTransactions, participant.id]
  );

  // Calculate network stats
  const networkStats = useMemo(() => {
    const totalConnections = nodeConnections.filter(c => c.isActive).length;
    const disconnectedCount = activeNodes.filter(n => n.isNodeDisconnected).length;
    return {
      activeNodes: activeNodes.length - disconnectedCount,
      totalConnections,
      disconnectedNodes: disconnectedCount
    };
  }, [activeNodes, nodeConnections]);

  // Auto-dismiss feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleCreateTransaction = async () => {
    if (!selectedReceiver) {
      setFeedback({ type: 'error', message: t('selectRecipient') });
      return;
    }
    if (!amount || parseInt(amount) <= 0) {
      setFeedback({ type: 'error', message: t('enterAmount') });
      return;
    }
    if (isDisconnected) {
      setFeedback({ type: 'error', message: t('phase5.nodeDisconnected') });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onCreateTransaction(
        selectedReceiver, 
        parseInt(amount), 
        parseInt(fee) || 0
      );
      
      if (result.success) {
        setFeedback({ type: 'success', message: t('phase5.transactionCreated') });
        setSelectedReceiver('');
        setAmount('');
        setFee('0');
      } else {
        setFeedback({ type: 'error', message: result.error || 'Error' });
      }
    } catch {
      setFeedback({ type: 'error', message: t('connectionError') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'propagating':
        return <Radio className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'in_mempool':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'confirmed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'propagating':
        return t('phase5.propagating');
      case 'in_mempool':
        return t('phase5.inMempool');
      case 'confirmed':
        return t('phase5.confirmed');
      default:
        return status;
    }
  };

  // Simple network visualization using CSS
  const renderNetworkVisualization = () => {
    const nodePositions: { [key: string]: { x: number; y: number } } = {};
    const nodeCount = activeNodes.length;
    
    // Position nodes in a circle
    activeNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodeCount - Math.PI / 2;
      const radius = Math.min(120, 30 + nodeCount * 8);
      nodePositions[node.id] = {
        x: 150 + radius * Math.cos(angle),
        y: 100 + radius * Math.sin(angle)
      };
    });

    return (
      <div className="relative w-full h-[200px] bg-gray-900/50 rounded-lg overflow-hidden">
        {/* Draw connections */}
        <svg className="absolute inset-0 w-full h-full">
          {nodeConnections.filter(c => c.isActive).map((conn, idx) => {
            const posA = nodePositions[conn.nodeAId];
            const posB = nodePositions[conn.nodeBId];
            if (!posA || !posB) return null;
            
            return (
              <line
                key={idx}
                x1={posA.x}
                y1={posA.y}
                x2={posB.x}
                y2={posB.y}
                stroke="rgba(59, 130, 246, 0.4)"
                strokeWidth="2"
              />
            );
          })}
        </svg>
        
        {/* Draw nodes */}
        {activeNodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          
          const isCurrentNode = node.id === participant.id;
          const isNodeDisconnected = node.isNodeDisconnected;
          
          return (
            <motion.div
              key={node.id}
              className={`absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2`}
              style={{ left: pos.x, top: pos.y }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 * activeNodes.indexOf(node) }}
            >
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${isCurrentNode 
                    ? 'bg-green-500 ring-2 ring-green-300' 
                    : isNodeDisconnected
                      ? 'bg-red-500/50'
                      : 'bg-blue-500'
                  }`}
              >
                {isNodeDisconnected ? (
                  <WifiOff className="w-4 h-4 text-white" />
                ) : (
                  node.name.charAt(0).toUpperCase()
                )}
              </div>
              <span className={`text-[10px] mt-1 ${isCurrentNode ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                {node.name.length > 8 ? node.name.slice(0, 8) + '...' : node.name}
              </span>
            </motion.div>
          );
        })}

        {/* Network stats overlay */}
        <div className="absolute bottom-2 left-2 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <Globe className="w-3 h-3" />
            {t('phase5.activeNodes')}: {networkStats.activeNodes}
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-3 h-3" />
            {t('phase5.connections')}: {networkStats.totalConnections}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-3 rounded-lg border ${
              feedback.type === 'success'
                ? 'bg-green-500/20 border-green-500/50 text-green-200'
                : feedback.type === 'error'
                  ? 'bg-red-500/20 border-red-500/50 text-red-200'
                  : 'bg-blue-500/20 border-blue-500/50 text-blue-200'
            }`}
          >
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disconnected warning */}
      {isDisconnected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 rounded-lg border bg-red-500/20 border-red-500/50 text-red-200 flex items-center gap-2"
        >
          <WifiOff className="w-5 h-5" />
          {t('phase5.nodeDisconnected')}
        </motion.div>
      )}

      {/* Zone 1: Network Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/50 rounded-xl border border-gray-700 p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">{t('phase5.nodeNetwork')}</h3>
        </div>
        
        {nodeConnections.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">{t('phase5.initializeNetwork')}</p>
            <button
              onClick={onInitializeNetwork}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {t('phase5.initializeNetwork')}
            </button>
          </div>
        ) : (
          renderNetworkVisualization()
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Zone 2: My Node */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 rounded-xl border border-gray-700 p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">
              {t('phase5.myNode')}: {participant.name}
            </h3>
            {isDisconnected && <WifiOff className="w-4 h-4 text-red-400" />}
          </div>

          {/* Create transaction form */}
          <div className="space-y-3 mb-4">
            <h4 className="text-sm font-medium text-gray-300">{t('phase5.createTransaction')}</h4>
            
            <div className="space-y-2">
              <select
                value={selectedReceiver}
                onChange={(e) => setSelectedReceiver(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                disabled={isDisconnected}
              >
                <option value="">{t('select')}...</option>
                {otherStudents.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="BTC"
                  min="1"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  disabled={isDisconnected}
                />
                <input
                  type="number"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder={t('phase5.fee')}
                  min="0"
                  className="w-24 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  disabled={isDisconnected}
                  title={`${t('phase5.fee')} (${t('phase5.optional')})`}
                />
              </div>
              
              <button
                onClick={handleCreateTransaction}
                disabled={isDisconnected || isSubmitting}
                className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="w-4 h-4" />
                {t('phase5.propagateTransaction')}
              </button>
            </div>
          </div>

          {/* Received transactions */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4 text-yellow-400" />
              <h4 className="text-sm font-medium text-gray-300">{t('phase5.receivedTransactions')}</h4>
            </div>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {receivedTransactions.length === 0 ? (
                <p className="text-gray-500 text-sm">{t('phase5.noTransactionsYet')}</p>
              ) : (
                receivedTransactions.slice(0, 10).map(tx => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(tx.status)}
                      <span className="text-gray-300">
                        {tx.sender?.name || 'Unknown'} <ArrowRight className="w-3 h-3 inline" /> {tx.receiver?.name || 'Unknown'}
                      </span>
                      <span className="text-yellow-400 font-medium">{tx.amount} BTC</span>
                    </div>
                    <span className="text-xs text-gray-500">{getStatusText(tx.status)}</span>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-3 p-2 bg-blue-900/30 rounded-lg">
              <div className="flex items-start gap-2 text-xs text-blue-300">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{t('phase5.propagationInfo')}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Zone 3: Global Mempool */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/50 rounded-xl border border-gray-700 p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">{t('phase5.globalMempool')}</h3>
          </div>

          {/* Mempool stats */}
          <div className="flex items-center gap-2 mb-3 p-2 bg-purple-900/30 rounded-lg">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-200">
              {t('phase5.waitingConfirmation')}: {mempoolTransactions.filter(tx => tx.status === 'in_mempool').length} {t('phase5.pendingTransactions').toLowerCase()}
            </span>
          </div>

          {/* Transaction list */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto mb-3">
            {mempoolTransactions.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">{t('phase5.noTransactionsYet')}</p>
            ) : (
              mempoolTransactions.map(tx => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-purple-400">{tx.txId}</span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(tx.status)}
                      <span className="text-xs text-gray-400">{getStatusText(tx.status)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-300">{tx.sender?.name || 'Unknown'}</span>
                    <ArrowRight className="w-3 h-3 text-gray-500" />
                    <span className="text-gray-300">{tx.receiver?.name || 'Unknown'}</span>
                    <span className="ml-auto text-yellow-400 font-medium">{tx.amount} BTC</span>
                    {tx.fee > 0 && (
                      <span className="text-xs text-green-400">+{tx.fee} fee</span>
                    )}
                  </div>
                  {tx.status === 'propagating' && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>{t('phase5.propagating')}...</span>
                        <span>{tx.propagationProgress}%</span>
                      </div>
                      <div className="h-1 bg-gray-600 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-yellow-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${tx.propagationProgress}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>

          {/* Warning message */}
          <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-200">
                <p>{t('phase5.notConfirmedWarning')}</p>
                {mempoolTransactions.length >= 5 && (
                  <p className="mt-1 font-medium">
                    {t('phase5.mempoolFull', { count: mempoolTransactions.length })} {t('phase5.needMiners')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Key question */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl border border-purple-700/50"
      >
        <p className="text-center text-purple-200 italic">
          🤔 {t('phase5.question')}
        </p>
      </motion.div>
    </div>
  );
}
