'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Radio,
  CheckCircle2,
  Clock,
  ArrowRight,
  Lock,
  Database,
} from 'lucide-react';
import { Room, Participant, MempoolTransaction, NodeConnection } from '@/lib/types';

// ─── Types ───

interface Phase5UserInterfaceProps {
  room: Room;
  participant: Participant;
  mempoolTransactions: MempoolTransaction[];
  nodeConnections: NodeConnection[];
  onCreateTransaction: (receiverId: string, amount: number) => Promise<{ success: boolean; error?: string }>;
}

// ─── Helpers ───

// Floating animation for nodes: each node gently drifts in a small loop
function useFloatingOffset(seed: number) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    let frame: number;
    const speed = 0.0004 + (seed % 7) * 0.00005;
    const radiusX = 3 + (seed % 5);
    const radiusY = 2 + (seed % 4);
    const phaseX = seed * 1.3;
    const phaseY = seed * 0.7;
    const animate = (t: number) => {
      setOffset({
        x: Math.sin(t * speed + phaseX) * radiusX,
        y: Math.cos(t * speed * 0.8 + phaseY) * radiusY,
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [seed]);
  return offset;
}

// ─── Mini node graph: shows only this student's node + their 2-3 peers ───

function MiniNodeGraph({
  participant,
  myNeighbors,
  nodeConnections,
  propagatingEdges,
}: {
  participant: Participant;
  myNeighbors: Participant[];
  nodeConnections: NodeConnection[];
  propagatingEdges: Set<string>;
}) {
  // Center position for "me"
  const cx = 160;
  const cy = 100;
  const radius = 80;

  // Position neighbors around the center
  const neighborPositions = useMemo(() => {
    return myNeighbors.map((n, i) => {
      const angle = ((2 * Math.PI) / Math.max(myNeighbors.length, 1)) * i - Math.PI / 2;
      return {
        id: n.id,
        name: n.name,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        disconnected: n.isNodeDisconnected || false,
      };
    });
  }, [myNeighbors]);

  // Floating offsets
  const myFloat = useFloatingOffset(participant.id.charCodeAt(0));
  const neighborFloats = myNeighbors.map((n, i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useFloatingOffset(n.id.charCodeAt(0) + i * 13)
  );

  // Build connection key helper
  const connKey = (a: string, b: string) => [a, b].sort().join('-');

  // Find which connections relate to me
  const myConnectionIds = useMemo(() => {
    const myId = participant.id;
    return nodeConnections
      .filter(c => c.isActive && (c.nodeAId === myId || c.nodeBId === myId))
      .map(c => ({
        connId: c.id,
        peerId: c.nodeAId === myId ? c.nodeBId : c.nodeAId,
        key: connKey(c.nodeAId, c.nodeBId),
      }));
  }, [nodeConnections, participant.id]);

  return (
    <svg viewBox="0 0 320 200" className="w-full h-full">
      {/* Connection lines */}
      {myConnectionIds.map(({ peerId, key }) => {
        const nPos = neighborPositions.find(n => n.id === peerId);
        if (!nPos) return null;
        const nIdx = myNeighbors.findIndex(n => n.id === peerId);
        const nFloat = neighborFloats[nIdx] || { x: 0, y: 0 };

        const isPropagating = propagatingEdges.has(key);
        return (
          <g key={key}>
            {/* Base line */}
            <line
              x1={cx + myFloat.x}
              y1={cy + myFloat.y}
              x2={nPos.x + nFloat.x}
              y2={nPos.y + nFloat.y}
              stroke={isPropagating ? '#facc15' : 'rgba(99, 130, 206, 0.4)'}
              strokeWidth={isPropagating ? 3 : 2}
              strokeLinecap="round"
            />
            {/* Propagation glow */}
            {isPropagating && (
              <line
                x1={cx + myFloat.x}
                y1={cy + myFloat.y}
                x2={nPos.x + nFloat.x}
                y2={nPos.y + nFloat.y}
                stroke="#facc15"
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.3}
              >
                <animate
                  attributeName="opacity"
                  values="0.1;0.5;0.1"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </line>
            )}
          </g>
        );
      })}

      {/* Neighbor nodes */}
      {neighborPositions.map((nPos, idx) => {
        const nFloat = neighborFloats[idx] || { x: 0, y: 0 };
        return (
          <g key={nPos.id}>
            <circle
              cx={nPos.x + nFloat.x}
              cy={nPos.y + nFloat.y}
              r={22}
              fill={nPos.disconnected ? '#991b1b' : '#1e3a5f'}
              stroke={nPos.disconnected ? '#ef4444' : '#3b82f6'}
              strokeWidth={2}
              opacity={nPos.disconnected ? 0.5 : 1}
            />
            <text
              x={nPos.x + nFloat.x}
              y={nPos.y + nFloat.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="10"
              fontWeight="500"
            >
              {nPos.name.length > 7 ? nPos.name.slice(0, 6) + '..' : nPos.name}
            </text>
          </g>
        );
      })}

      {/* My node (center, bigger, highlighted) */}
      <circle
        cx={cx + myFloat.x}
        cy={cy + myFloat.y}
        r={28}
        fill="#065f46"
        stroke="#34d399"
        strokeWidth={3}
      />
      <text
        x={cx + myFloat.x}
        y={cy + myFloat.y - 5}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#6ee7b7"
        fontSize="10"
        fontWeight="bold"
      >
        {participant.name.length > 8 ? participant.name.slice(0, 7) + '..' : participant.name}
      </text>
      <text
        x={cx + myFloat.x}
        y={cy + myFloat.y + 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#a7f3d0"
        fontSize="8"
      >
        (tu)
      </text>
    </svg>
  );
}


// ─── Main component ───

export default function Phase5UserInterface({
  room,
  participant,
  mempoolTransactions,
  nodeConnections,
  onCreateTransaction,
}: Phase5UserInterfaceProps) {
  const { t } = useTranslation();
  const [selectedReceiver, setSelectedReceiver] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDisconnected = participant.isNodeDisconnected || false;
  const sendingEnabled = room.studentSendingEnabled || false;

  // My neighbors: nodes I'm directly connected to
  const myNeighborIds = useMemo(() => {
    const myId = participant.id;
    const ids = new Set<string>();
    for (const c of nodeConnections) {
      if (!c.isActive) continue;
      if (c.nodeAId === myId) ids.add(c.nodeBId);
      if (c.nodeBId === myId) ids.add(c.nodeAId);
    }
    return ids;
  }, [nodeConnections, participant.id]);

  const myNeighbors = useMemo(() =>
    room.participants.filter(p => myNeighborIds.has(p.id) && p.isActive && p.role === 'student'),
    [room.participants, myNeighborIds]
  );

  // All other students (for the TX form dropdown)
  const otherStudents = useMemo(() =>
    room.participants.filter(p => p.isActive && p.role === 'student' && p.id !== participant.id),
    [room.participants, participant.id]
  );

  // TX that have arrived at my node
  const myTransactions = useMemo(() =>
    mempoolTransactions
      .filter(tx => tx.propagatedTo?.includes(participant.id) || tx.senderId === participant.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [mempoolTransactions, participant.id]
  );

  // Edges currently propagating: a TX is propagating through an edge if
  // I have it but a neighbor doesn't (or vice versa)
  const propagatingEdges = useMemo(() => {
    const edges = new Set<string>();
    const connKey = (a: string, b: string) => [a, b].sort().join('-');
    for (const tx of mempoolTransactions) {
      if (tx.status !== 'propagating') continue;
      const myHasIt = tx.propagatedTo?.includes(participant.id);
      for (const neighborId of myNeighborIds) {
        const neighborHasIt = tx.propagatedTo?.includes(neighborId);
        if (myHasIt !== neighborHasIt) {
          edges.add(connKey(participant.id, neighborId));
        }
      }
    }
    return edges;
  }, [mempoolTransactions, participant.id, myNeighborIds]);

  // Auto-dismiss feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handleSend = useCallback(async () => {
    if (!selectedReceiver || !amount || parseInt(amount) <= 0) return;
    setIsSubmitting(true);
    try {
      const result = await onCreateTransaction(selectedReceiver, parseInt(amount));
      if (result.success) {
        setFeedback({ type: 'success', message: t('phase5.transactionCreated') });
        setSelectedReceiver('');
        setAmount('');
      } else {
        setFeedback({ type: 'error', message: result.error || 'Error' });
      }
    } catch {
      setFeedback({ type: 'error', message: t('connectionError') });
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedReceiver, amount, onCreateTransaction, t]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'propagating':
        return <Radio className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />;
      case 'in_mempool':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'confirmed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  // ─── Waiting for network ───
  if (nodeConnections.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-muted">
          <Clock className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p>{t('phase5.waitingForNetwork')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 h-full">

      {/* ─── LEFT COLUMN: Node graph + Send TX ─── */}
      <div className="flex flex-col gap-4">

        {/* Zone A: My node + neighbors */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 rounded-xl border border-gray-700 p-3 flex-1 min-h-[240px]"
        >
          <h3 className="text-sm font-semibold text-body mb-1 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            {t('phase5.myNode')}: {participant.name}
            {myNeighbors.length > 0 && (
              <span className="text-xs text-muted font-normal ml-auto">
                {myNeighbors.length} {myNeighbors.length === 1 ? 'peer' : 'peers'}
              </span>
            )}
          </h3>

          {myNeighbors.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted text-sm">
              {isDisconnected ? t('phase5.nodeDisconnected') : t('phase5.noConnections')}
            </div>
          ) : (
            <MiniNodeGraph
              participant={participant}
              myNeighbors={myNeighbors}
              nodeConnections={nodeConnections}
              propagatingEdges={propagatingEdges}
            />
          )}
        </motion.div>

        {/* Zone B: Send TX (locked until teacher enables) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 rounded-xl border border-gray-700 p-3 relative"
        >
          {!sendingEnabled && (
            <div className="absolute inset-0 bg-gray-900/70 rounded-xl z-10 flex items-center justify-center backdrop-blur-[2px]">
              <div className="text-center text-muted text-sm flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {t('phase5.sendingLocked')}
              </div>
            </div>
          )}

          <h3 className="text-sm font-semibold text-body mb-2 flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-400" />
            {t('phase5.sendTransaction')}
          </h3>

          <div className="flex gap-2 items-end">
            <select
              value={selectedReceiver}
              onChange={(e) => setSelectedReceiver(e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-body"
              disabled={isDisconnected || !sendingEnabled}
            >
              <option value="">{t('phase5.selectRecipient')}</option>
              {otherStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="BTC"
              min="1"
              max="5"
              className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-body"
              disabled={isDisconnected || !sendingEnabled}
            />
            <button
              onClick={handleSend}
              disabled={isDisconnected || !sendingEnabled || isSubmitting || !selectedReceiver || !amount}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {feedback && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`text-xs mt-2 ${feedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
              >
                {feedback.message}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ─── RIGHT COLUMN: My Mempool ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-gray-800/50 rounded-xl border border-gray-700 p-3 flex flex-col"
      >
        <h3 className="text-sm font-semibold text-body mb-2 flex items-center gap-2">
          <Database className="w-4 h-4 text-purple-400" />
          {t('phase5.myMempool')}
          {myTransactions.length > 0 && (
            <span className="text-xs text-muted font-normal ml-auto">
              {myTransactions.length} tx
            </span>
          )}
        </h3>

        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[200px] max-h-[500px]">
          {myTransactions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted text-sm">
              <p>{t('phase5.noTransactionsYet')}</p>
            </div>
          ) : (
            myTransactions.map(tx => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-2 bg-gray-700/40 rounded-lg text-sm flex items-center gap-2"
              >
                {getStatusIcon(tx.status)}
                <span className="text-xs font-mono text-purple-400/80">{tx.txId}</span>
                <span className="text-body truncate">
                  {tx.sender?.name || '?'}
                </span>
                <ArrowRight className="w-3 h-3 text-muted flex-shrink-0" />
                <span className="text-body truncate">
                  {tx.receiver?.name || '?'}
                </span>
                <span className="ml-auto text-yellow-400 font-medium text-xs whitespace-nowrap">
                  {tx.amount} BTC
                </span>
              </motion.div>
            ))
          )}
        </div>

        {/* Propagation info */}
        {myTransactions.some(tx => tx.status === 'propagating') && (
          <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
            <p className="text-xs text-yellow-300/80 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              {t('phase5.propagatingInfo')}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
