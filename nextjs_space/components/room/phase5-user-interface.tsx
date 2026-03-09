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
const PULSE_DUR_S = 1.2;
const FLASH_DUR_S = 0.5;

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
  pulses,
  flashes,
}: {
  participant: Participant;
  myNeighbors: Participant[];
  nodeConnections: NodeConnection[];
  pulses: { id: string; fromId: string; toId: string }[];
  flashes: { nodeId: string; time: number }[];
}) {
  const cx = 160;
  const cy = 100;
  const radius = 80;

  const connKey = (a: string, b: string) => [a, b].sort().join('-');

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
      {/* Connection lines (static — animation is on nodes, lines connect centers) */}
      {myConnectionIds.map(({ peerId, key }) => {
        const nPos = neighborPositions.find(n => n.id === peerId);
        if (!nPos) return null;
        return (
          <g key={key}>
            <line
              x1={cx} y1={cy}
              x2={nPos.x} y2={nPos.y}
              stroke="rgba(99, 130, 206, 0.4)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* Neighbor nodes — each with its own floating animation */}
      {neighborPositions.map((nPos) => (
        <g key={nPos.id}>
          <animateTransform
            attributeName="transform"
            type="translate"
            values={nPos.float.values}
            dur={nPos.float.dur}
            repeatCount="indefinite"
            additive="sum"
          />
          <circle
            cx={nPos.x}
            cy={nPos.y}
            r={22}
            fill={nPos.disconnected ? '#991b1b' : '#1e3a5f'}
            stroke={nPos.disconnected ? '#ef4444' : '#3b82f6'}
            strokeWidth={2}
            opacity={nPos.disconnected ? 0.5 : 1}
          />
          <text
            x={nPos.x}
            y={nPos.y + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="10"
            fontWeight="500"
          >
            {nPos.name.length > 7 ? nPos.name.slice(0, 6) + '..' : nPos.name}
          </text>
        </g>
      ))}

      {/* My node (center, bigger, highlighted) — with floating */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={myFloat.values}
          dur={myFloat.dur}
          repeatCount="indefinite"
          additive="sum"
        />
        <circle
          cx={cx} cy={cy}
          r={28}
          fill="#065f46"
          stroke="#34d399"
          strokeWidth={3}
        />
        <text
          x={cx} y={cy - 5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#6ee7b7"
          fontSize="10"
          fontWeight="bold"
        >
          {participant.name.length > 8 ? participant.name.slice(0, 7) + '..' : participant.name}
        </text>
        <text
          x={cx} y={cy + 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#a7f3d0"
          fontSize="8"
        >
          (tu)
        </text>
      </g>

      {/* ─── Propagation pulse dots ─── */}
      {pulses.map(pulse => {
        const isToMe = pulse.toId === participant.id;
        const isFromMe = pulse.fromId === participant.id;
        const fromPos = isFromMe ? { x: cx, y: cy }
                      : neighborPositions.find(n => n.id === pulse.fromId);
        const toPos = isToMe ? { x: cx, y: cy }
                    : neighborPositions.find(n => n.id === pulse.toId);
        if (!fromPos || !toPos) return null;
        return (
          <circle
            key={pulse.id}
            cx={fromPos.x}
            cy={fromPos.y}
            r={5}
            fill="#facc15"
            filter="url(#mini-pulse-glow)"
            opacity={0}
          >
            <animate attributeName="cx" from={fromPos.x} to={toPos.x} dur={`${PULSE_DUR_S}s`} fill="freeze" />
            <animate attributeName="cy" from={fromPos.y} to={toPos.y} dur={`${PULSE_DUR_S}s`} fill="freeze" />
            <animate attributeName="opacity" values="0;0.95;0.95;0.7" dur={`${PULSE_DUR_S}s`} fill="freeze" />
          </circle>
        );
      })}

      {/* ─── Node flash (glow + expanding ring) ─── */}
      {flashes.map(flash => {
        const isMe = flash.nodeId === participant.id;
        const pos = isMe ? { x: cx, y: cy }
                  : neighborPositions.find(n => n.id === flash.nodeId);
        const r = isMe ? 28 : 22;
        if (!pos) return null;
        return (
          <g key={`flash-${flash.nodeId}-${flash.time}`}>
            {/* Inner glow overlay */}
            <circle cx={pos.x} cy={pos.y} r={r} fill="#facc15" opacity={0}>
              <animate attributeName="opacity" values="0;0.45;0.25;0" dur={`${FLASH_DUR_S}s`} fill="freeze" />
            </circle>
            {/* Expanding ring */}
            <circle cx={pos.x} cy={pos.y} r={r} fill="none" stroke="#facc15" strokeWidth={2} opacity={0}>
              <animate attributeName="r" from={`${r}`} to={`${r + 16}`} dur={`${FLASH_DUR_S}s`} fill="freeze" />
              <animate attributeName="opacity" values="0;0.6;0.3;0" dur={`${FLASH_DUR_S}s`} fill="freeze" />
            </circle>
          </g>
        );
      })}
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

  // ─── Propagation pulse tracking (BFS cascade) ───
  const prevPropRef = useRef<Map<string, Set<string>>>(new Map());
  const [activePulses, setActivePulses] = useState<{ id: string; fromId: string; toId: string; createdAt: number }[]>([]);
  const [flashes, setFlashes] = useState<{ nodeId: string; time: number }[]>([]);

  useEffect(() => {
    const prevMap = prevPropRef.current;
    const now = Date.now();
    const myId = participant.id;
    const relevantIds = new Set([myId, ...myNeighborIds]);

    for (const tx of mempoolTransactions) {
      const currentSet = new Set(tx.propagatedTo || []);
      const prevSet = prevMap.get(tx.id) || new Set<string>();

      // Find newly added relevant nodes
      const newNodes = new Set<string>();
      for (const nodeId of currentSet) {
        if (!prevSet.has(nodeId) && relevantIds.has(nodeId)) newNodes.add(nodeId);
      }

      if (newNodes.size > 0) {
        // BFS from prev frontier to reconstruct cascade
        const visited = new Set<string>();
        for (const id of prevSet) { if (relevantIds.has(id)) visited.add(id); }
        // Also include non-relevant prev nodes as "already visited" to find correct sources
        for (const id of prevSet) visited.add(id);

        let bfsFrontier = [...prevSet].filter(id => relevantIds.has(id) || prevSet.has(id));
        const layers: { fromId: string; toId: string }[][] = [];

        while (bfsFrontier.length > 0) {
          const layerPulses: { fromId: string; toId: string }[] = [];
          const nextFrontier: string[] = [];

          for (const sourceId of bfsFrontier) {
            for (const conn of nodeConnections) {
              if (!conn.isActive) continue;
              const nId = conn.nodeAId === sourceId ? conn.nodeBId
                        : conn.nodeBId === sourceId ? conn.nodeAId : null;
              if (!nId || visited.has(nId) || !currentSet.has(nId)) continue;
              visited.add(nId);
              nextFrontier.push(nId);
              // Only create visual pulse if both ends are relevant (visible)
              if (relevantIds.has(sourceId) && relevantIds.has(nId)) {
                layerPulses.push({ fromId: sourceId, toId: nId });
              }
            }
          }

          if (layerPulses.length > 0) layers.push(layerPulses);
          bfsFrontier = nextFrontier;
        }

        // Schedule each layer with staggered timing
        layers.forEach((layer, layerIdx) => {
          const delay = layerIdx * PULSE_DUR_S * 1000;
          const pulses = layer.map((p, i) => ({
            id: `p-${tx.id}-${p.fromId}-${p.toId}-${now}-L${layerIdx}-${i}`,
            fromId: p.fromId,
            toId: p.toId,
            createdAt: now + layerIdx,
          }));

          setTimeout(() => {
            setActivePulses(prev => [...prev, ...pulses]);
            setTimeout(() => {
              const flashTime = Date.now();
              const newFlashes = pulses.map(p => ({ nodeId: p.toId, time: flashTime }));
              setFlashes(prev => [...prev, ...newFlashes]);
              setTimeout(() => {
                setFlashes(prev => prev.filter(f => f.time !== flashTime));
              }, FLASH_DUR_S * 1000 + 200);
            }, PULSE_DUR_S * 1000);
            setTimeout(() => {
              const ids = new Set(pulses.map(p => p.id));
              setActivePulses(prev => prev.filter(p => !ids.has(p.id)));
            }, PULSE_DUR_S * 1000 + 400);
          }, delay);
        });
      }

      prevMap.set(tx.id, currentSet);
    }
  }, [mempoolTransactions, nodeConnections, participant.id, myNeighborIds]);

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
              pulses={activePulses}
              flashes={flashes}
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
