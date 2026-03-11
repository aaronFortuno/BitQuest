'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

// ─── Constants ───
const FLASH_DUR_S = 0.5;
const MINI_CX = 160, MINI_CY = 100, MINI_RADIUS = 80;
const MINI_NODE_R = 22, MY_NODE_R = 28;

// ─── Helpers ───

// Generate SVG floating animation params from a seed (no hooks needed)
function floatParams(seed: number) {
  const durX = 4 + (seed % 3);
  const durY = 5 + (seed % 4);
  const ampX = 3 + (seed % 3);
  const ampY = 2 + (seed % 3);
  return { durX, ampX, ampY, values: `0,0; ${ampX},${-ampY}; ${-ampX},${ampY}; 0,0`, dur: `${durX + durY * 0.3}s` };
}

// ─── Mini node graph: shows only this student's node + their 2-3 peers ───

function MiniNodeGraph({
  participant,
  myNeighbors,
  nodeConnections,
  renderedPulses,
  renderedFlashes,
}: {
  participant: Participant;
  myNeighbors: Participant[];
  nodeConnections: NodeConnection[];
  renderedPulses: { id: string; x: number; y: number; opacity: number; r: number; color: string }[];
  renderedFlashes: { id: string; cx: number; cy: number; glowOpacity: number; ringR: number; ringOpacity: number; color: string }[];
}) {
  const connKey = (a: string, b: string) => [a, b].sort().join('-');

  // Position neighbors around the center
  const neighborPositions = useMemo(() => {
    return myNeighbors.map((n, i) => {
      const angle = ((2 * Math.PI) / Math.max(myNeighbors.length, 1)) * i - Math.PI / 2;
      return {
        id: n.id,
        name: n.name,
        x: MINI_CX + MINI_RADIUS * Math.cos(angle),
        y: MINI_CY + MINI_RADIUS * Math.sin(angle),
        disconnected: n.isNodeDisconnected || false,
        float: floatParams(n.id.charCodeAt(0) + i * 13),
      };
    });
  }, [myNeighbors]);

  const myFloat = floatParams(participant.id.charCodeAt(0));

  // My connections
  const myConnectionIds = useMemo(() => {
    const myId = participant.id;
    return nodeConnections
      .filter(c => c.isActive && (c.nodeAId === myId || c.nodeBId === myId))
      .map(c => ({
        peerId: c.nodeAId === myId ? c.nodeBId : c.nodeAId,
        key: connKey(c.nodeAId, c.nodeBId),
      }));
  }, [nodeConnections, participant.id]);

  return (
    <svg viewBox="0 0 320 200" className="w-full h-full">
      <defs>
        <filter id="mini-pulse-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connection lines */}
      {myConnectionIds.map(({ peerId, key }) => {
        const nPos = neighborPositions.find(n => n.id === peerId);
        if (!nPos) return null;
        return (
          <line key={key}
            x1={MINI_CX} y1={MINI_CY} x2={nPos.x} y2={nPos.y}
            stroke="rgba(99, 130, 206, 0.4)" strokeWidth={2} strokeLinecap="round"
          />
        );
      })}

      {/* Neighbor nodes */}
      {neighborPositions.map((nPos) => (
        <g key={nPos.id}>
          <animateTransform attributeName="transform" type="translate"
            values={nPos.float.values} dur={nPos.float.dur}
            repeatCount="indefinite" additive="sum" />
          <circle cx={nPos.x} cy={nPos.y} r={MINI_NODE_R}
            fill={nPos.disconnected ? '#991b1b' : '#1e3a5f'}
            stroke={nPos.disconnected ? '#ef4444' : '#3b82f6'}
            strokeWidth={2} opacity={nPos.disconnected ? 0.5 : 1} />
          <text x={nPos.x} y={nPos.y + 1} textAnchor="middle"
            dominantBaseline="middle" fill="white" fontSize="10" fontWeight="500">
            {nPos.name.length > 7 ? nPos.name.slice(0, 6) + '..' : nPos.name}
          </text>
        </g>
      ))}

      {/* My node (center) */}
      <g>
        <animateTransform attributeName="transform" type="translate"
          values={myFloat.values} dur={myFloat.dur}
          repeatCount="indefinite" additive="sum" />
        <circle cx={MINI_CX} cy={MINI_CY} r={MY_NODE_R}
          fill="#065f46" stroke="#34d399" strokeWidth={3} />
        <text x={MINI_CX} y={MINI_CY - 5} textAnchor="middle"
          dominantBaseline="middle" fill="#6ee7b7" fontSize="10" fontWeight="bold">
          {participant.name.length > 8 ? participant.name.slice(0, 7) + '..' : participant.name}
        </text>
        <text x={MINI_CX} y={MINI_CY + 8} textAnchor="middle"
          dominantBaseline="middle" fill="#a7f3d0" fontSize="8">
          (tu)
        </text>
      </g>

      {/* Pulse dots (rAF-driven, per-TX color) */}
      {renderedPulses.map(p => (
        <circle key={p.id} cx={p.x} cy={p.y} r={p.r}
          fill={p.color} opacity={p.opacity} filter="url(#mini-pulse-glow)" />
      ))}

      {/* Flash effects (rAF-driven, per-TX color) */}
      {renderedFlashes.map(f => (
        <g key={f.id}>
          <circle cx={f.cx} cy={f.cy} r={MINI_NODE_R}
            fill={f.color} opacity={f.glowOpacity} />
          <circle cx={f.cx} cy={f.cy} r={f.ringR}
            fill="none" stroke={f.color} strokeWidth={2} opacity={f.ringOpacity} />
        </g>
      ))}
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

  // TX that have arrived at my node — sorted by LOCAL arrival order, not server creation time
  const firstSeenRef = useRef<Map<string, number>>(new Map());
  const myTransactions = useMemo(() => {
    const now = Date.now();
    const myTxs = mempoolTransactions
      .filter(tx => tx.propagatedTo?.includes(participant.id) || tx.senderId === participant.id);
    // Record first-seen time for newly arrived TX
    for (const tx of myTxs) {
      if (!firstSeenRef.current.has(tx.id)) {
        firstSeenRef.current.set(tx.id, now);
      }
    }
    // Sort by local arrival time (newest first)
    return [...myTxs].sort((a, b) => {
      const aTime = firstSeenRef.current.get(a.id) ?? 0;
      const bTime = firstSeenRef.current.get(b.id) ?? 0;
      return bTime - aTime;
    });
  }, [mempoolTransactions, participant.id]);

  // ─── Propagation animation (rAF-based) ───
  // Compute mini-graph node positions (must match MiniNodeGraph layout)
  const miniGraphPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; r: number }>();
    positions.set(participant.id, { x: MINI_CX, y: MINI_CY, r: MY_NODE_R });
    myNeighbors.forEach((n, i) => {
      const angle = ((2 * Math.PI) / Math.max(myNeighbors.length, 1)) * i - Math.PI / 2;
      positions.set(n.id, {
        x: MINI_CX + MINI_RADIUS * Math.cos(angle),
        y: MINI_CY + MINI_RADIUS * Math.sin(angle),
        r: MINI_NODE_R,
      });
    });
    return positions;
  }, [participant.id, myNeighbors]);

  // Uses propagationEdges from the server for precise timing.
  // Each TX has its own color. Redundant edges show dimmer, no flash.

  interface PulseData {
    id: string; fromX: number; fromY: number; toX: number; toY: number;
    toNodeId: string; startTime: number; duration: number;
    color: string; redundant: boolean;
  }
  interface FlashData {
    id: string; cx: number; cy: number; startTime: number; color: string;
  }

  const seenEdgesRef = useRef<Set<string>>(new Set());
  const pulsesRef = useRef<PulseData[]>([]);
  const flashesRef = useRef<FlashData[]>([]);
  const rAFRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);
  const [renderedPulses, setRenderedPulses] = useState<{ id: string; x: number; y: number; opacity: number; r: number; color: string }[]>([]);
  const [renderedFlashes, setRenderedFlashes] = useState<{ id: string; cx: number; cy: number; glowOpacity: number; ringR: number; ringOpacity: number; color: string }[]>([]);

  const startAnimation = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    let lastFrame = 0;
    const animate = (timestamp: number) => {
      if (timestamp - lastFrame < 33) {
        rAFRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrame = timestamp;
      const now = Date.now();

      const activePulses: PulseData[] = [];
      const pulsePositions: typeof renderedPulses = [];
      const completedPulses: PulseData[] = [];

      for (const pulse of pulsesRef.current) {
        const elapsed = now - pulse.startTime;
        if (elapsed < 0) { activePulses.push(pulse); continue; }
        const progress = elapsed / pulse.duration;
        if (progress < 1) {
          const t = 1 - Math.pow(1 - progress, 2);
          const baseOpacity = pulse.redundant ? 0.4 : 0.95;
          pulsePositions.push({
            id: pulse.id,
            x: pulse.fromX + (pulse.toX - pulse.fromX) * t,
            y: pulse.fromY + (pulse.toY - pulse.fromY) * t,
            opacity: progress < 0.1 ? (progress * 10) * baseOpacity : baseOpacity,
            r: 4 + 3 * Math.sin(progress * Math.PI),
            color: pulse.color,
          });
          activePulses.push(pulse);
        } else {
          completedPulses.push(pulse);
        }
      }
      pulsesRef.current = activePulses;
      setRenderedPulses(pulsePositions);

      if (completedPulses.length > 0) {
        const newFlashes = completedPulses
          .filter(p => !p.redundant)
          .map(p => ({
            id: `f-${p.toNodeId}-${now}-${p.id.slice(-4)}`,
            cx: p.toX, cy: p.toY, startTime: now, color: p.color,
          }));
        flashesRef.current = [...flashesRef.current, ...newFlashes];
      }

      const activeFlashes: FlashData[] = [];
      const flashPositions: typeof renderedFlashes = [];
      for (const flash of flashesRef.current) {
        const progress = (now - flash.startTime) / (FLASH_DUR_S * 1000);
        if (progress < 1) {
          const nodeR = MINI_NODE_R;
          const glowOpacity = progress < 0.3 ? (progress / 0.3) * 0.45 : 0.45 * (1 - (progress - 0.3) / 0.7);
          const ringR = nodeR + 16 * progress;
          const ringOpacity = progress < 0.2 ? (progress / 0.2) * 0.6 : 0.6 * (1 - (progress - 0.2) / 0.8);
          flashPositions.push({ id: flash.id, cx: flash.cx, cy: flash.cy, glowOpacity, ringR, ringOpacity, color: flash.color });
          activeFlashes.push(flash);
        }
      }
      flashesRef.current = activeFlashes;
      setRenderedFlashes(flashPositions);

      if (activePulses.length > 0 || activeFlashes.length > 0) {
        rAFRef.current = requestAnimationFrame(animate);
      } else {
        isAnimatingRef.current = false;
      }
    };
    rAFRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => () => cancelAnimationFrame(rAFRef.current), []);

  // Read propagationEdges from server — only show pulses for edges visible in my mini graph
  useEffect(() => {
    const seen = seenEdgesRef.current;
    const relevantIds = new Set([participant.id, ...myNeighborIds]);
    let hasNew = false;

    for (const tx of mempoolTransactions) {
      const edges = tx.propagationEdges;
      if (!edges || edges.length === 0) continue;
      const color = tx.propagationColor || '#facc15';

      for (const edge of edges) {
        const edgeKey = `${tx.id}-${edge.fromNodeId}-${edge.toNodeId}`;
        if (seen.has(edgeKey)) continue;
        seen.add(edgeKey);

        // Only create visible pulse if both ends are in my view
        if (!relevantIds.has(edge.fromNodeId) || !relevantIds.has(edge.toNodeId)) continue;

        const from = miniGraphPositions.get(edge.fromNodeId);
        const to = miniGraphPositions.get(edge.toNodeId);
        if (!from || !to) continue;

        pulsesRef.current.push({
          id: `p-${edgeKey}`,
          fromX: from.x, fromY: from.y,
          toX: to.x, toY: to.y,
          toNodeId: edge.toNodeId,
          startTime: edge.startTime,
          duration: edge.duration,
          color, redundant: edge.redundant || false,
        });
        hasNew = true;
      }
    }

    if (hasNew) {
      isAnimatingRef.current = false;
      startAnimation();
    }
  }, [mempoolTransactions, participant.id, myNeighborIds, miniGraphPositions, startAnimation]);

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
              renderedPulses={renderedPulses}
              renderedFlashes={renderedFlashes}
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
