'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Scissors,
  Send,
  Zap,
  Users,
  Unplug,
  Lock,
  Unlock,
} from 'lucide-react';
import { Room, Participant, MempoolTransaction, NodeConnection } from '@/lib/types';
import { TFunction } from 'i18next';

// ─── Types ───

interface Phase5TeacherPanelProps {
  room: Room;
  students: Participant[];
  mempoolTransactions: MempoolTransaction[];
  nodeConnections: NodeConnection[];
  onInitializeNetwork?: (regenerate?: boolean) => Promise<void>;
  onToggleNodeDisconnection?: (nodeId: string, isDisconnected: boolean) => Promise<void>;
  onCreateTeacherTransaction?: (originNodeId: string) => Promise<void>;
  onDestroyConnection?: (connectionId: string) => Promise<void>;
  onToggleStudentSending?: (enabled: boolean) => Promise<void>;
  t: TFunction;
}

type TeacherMode = 'tx' | 'disconnect';

// ─── Force-directed layout (simple spring simulation) ───

interface NodePos {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  disconnected: boolean;
  name: string;
}

const NODE_RADIUS = 30;
const MIN_NODE_DISTANCE = NODE_RADIUS * 4; // Minimum distance between node centers

function computeForceLayout(
  nodes: { id: string; name: string; disconnected: boolean }[],
  edges: { id: string; a: string; b: string }[],
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  if (nodes.length === 0) return new Map();

  // Initialize positions in a circle with generous radius
  const positions: NodePos[] = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    const r = Math.min(width, height) * 0.4;
    return {
      id: n.id,
      x: width / 2 + r * Math.cos(angle),
      y: height / 2 + r * Math.sin(angle),
      vx: 0,
      vy: 0,
      disconnected: n.disconnected,
      name: n.name,
    };
  });

  const posMap = new Map<string, NodePos>();
  positions.forEach(p => posMap.set(p.id, p));

  // Force simulation tuned for well-separated nodes
  const iterations = 120;
  const repulsion = 25000; // Strong repulsion to keep nodes apart
  const idealEdgeLength = MIN_NODE_DISTANCE * 1.5; // Target distance for connected nodes
  const edgeStiffness = 0.06;
  const damping = 0.82;
  const centerPull = 0.005;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all pairs (Coulomb's law)
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Extra strong push when nodes overlap
        const minDist = MIN_NODE_DISTANCE;
        let force: number;
        if (dist < minDist) {
          force = repulsion / (minDist * minDist) * (minDist / dist);
        } else {
          force = repulsion / (dist * dist);
        }

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attraction along edges (spring toward ideal length)
    for (const edge of edges) {
      const a = posMap.get(edge.a);
      const b = posMap.get(edge.b);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - idealEdgeLength;
      const fx = (dx / dist) * displacement * edgeStiffness;
      const fy = (dy / dist) * displacement * edgeStiffness;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Gentle center gravity
    for (const p of positions) {
      p.vx += (width / 2 - p.x) * centerPull;
      p.vy += (height / 2 - p.y) * centerPull;
    }

    // Apply velocity + damping
    for (const p of positions) {
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx;
      p.y += p.vy;
    }
  }

  // No clamping to bounds — let the viewBox adapt to actual positions
  const result = new Map<string, { x: number; y: number }>();
  positions.forEach(p => result.set(p.id, { x: p.x, y: p.y }));
  return result;
}


// ─── Main component ───

export default function Phase5TeacherPanel({
  room,
  students,
  mempoolTransactions,
  nodeConnections,
  onInitializeNetwork,
  onToggleNodeDisconnection,
  onCreateTeacherTransaction,
  onDestroyConnection,
  onToggleStudentSending,
  t,
}: Phase5TeacherPanelProps) {
  const [mode, setMode] = useState<TeacherMode>('tx');
  const [feedback, setFeedback] = useState<string | null>(null);

  const sendingEnabled = room.studentSendingEnabled || false;

  // Stats
  const activeNodes = students.filter(s => !s.isNodeDisconnected).length;
  const activeConnections = nodeConnections.filter(c => c.isActive).length;
  const mempoolCount = mempoolTransactions.filter(tx => tx.status === 'in_mempool').length;
  const propagatingCount = mempoolTransactions.filter(tx => tx.status === 'propagating').length;

  // Propagating edges: which connections currently have a TX in transit
  const propagatingEdges = useMemo(() => {
    const edges = new Set<string>();
    const connKey = (a: string, b: string) => [a, b].sort().join('-');
    for (const tx of mempoolTransactions) {
      if (tx.status !== 'propagating') continue;
      const propagatedSet = new Set(tx.propagatedTo || []);
      for (const conn of nodeConnections) {
        if (!conn.isActive) continue;
        const aHas = propagatedSet.has(conn.nodeAId);
        const bHas = propagatedSet.has(conn.nodeBId);
        if (aHas !== bHas) {
          edges.add(connKey(conn.nodeAId, conn.nodeBId));
        }
      }
    }
    return edges;
  }, [mempoolTransactions, nodeConnections]);

  // Force layout — use a larger internal canvas so nodes spread out
  const layoutWidth = 1200;
  const layoutHeight = 800;

  const layoutPositions = useMemo(() => {
    const nodes = students.map(s => ({
      id: s.id,
      name: s.name,
      disconnected: s.isNodeDisconnected || false,
    }));
    const edges = nodeConnections
      .filter(c => c.isActive)
      .map(c => ({ id: c.id, a: c.nodeAId, b: c.nodeBId }));
    return computeForceLayout(nodes, edges, layoutWidth, layoutHeight);
  }, [students, nodeConnections]);

  // Compute a viewBox that fits all nodes with padding
  const fittedViewBox = useMemo(() => {
    if (layoutPositions.size === 0) return `0 0 ${layoutWidth} ${layoutHeight}`;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of layoutPositions.values()) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    }
    const pad = 60; // padding around nodes
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  }, [layoutPositions]);

  // Pan & zoom state
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState(fittedViewBox);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, vb: { x: 0, y: 0, w: 0, h: 0 } });

  // Reset viewBox when layout changes
  useEffect(() => {
    setViewBox(fittedViewBox);
  }, [fittedViewBox]);

  const parseViewBox = (vb: string) => {
    const [x, y, w, h] = vb.split(' ').map(Number);
    return { x, y, w, h };
  };

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 0.87; // zoom out / zoom in
    setViewBox(prev => {
      const vb = parseViewBox(prev);
      const newW = vb.w * factor;
      const newH = vb.h * factor;
      // Zoom toward center
      const newX = vb.x - (newW - vb.w) / 2;
      const newY = vb.y - (newH - vb.h) / 2;
      return `${newX} ${newY} ${newW} ${newH}`;
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Only start pan on middle-click or if clicking on background (not a node/edge)
    const target = e.target as SVGElement;
    if (target.tagName !== 'svg' && target.tagName !== 'rect') return;
    setIsPanning(true);
    const vb = parseViewBox(viewBox);
    panStart.current = { x: e.clientX, y: e.clientY, vb };
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }, [viewBox]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    const svg = e.currentTarget;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const scale = ctm.a; // pixels per SVG unit
    const dx = (e.clientX - panStart.current.x) / scale;
    const dy = (e.clientY - panStart.current.y) / scale;
    const { vb } = panStart.current;
    setViewBox(`${vb.x - dx} ${vb.y - dy} ${vb.w} ${vb.h}`);
  }, [isPanning]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Auto-dismiss feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Handlers
  const handleNodeClick = useCallback(async (nodeId: string) => {
    const student = students.find(s => s.id === nodeId);
    if (!student) return;

    if (mode === 'tx') {
      await onCreateTeacherTransaction?.(nodeId);
      setFeedback(`TX creada des de ${student.name}`);
    } else {
      const isDisc = student.isNodeDisconnected || false;
      await onToggleNodeDisconnection?.(nodeId, !isDisc);
      setFeedback(isDisc ? `${student.name} reconnectat` : `${student.name} desconnectat`);
    }
  }, [mode, students, onCreateTeacherTransaction, onToggleNodeDisconnection]);

  const handleEdgeClick = useCallback(async (connectionId: string) => {
    if (mode !== 'disconnect') return;
    await onDestroyConnection?.(connectionId);
    setFeedback('Connexió destruïda');
  }, [mode, onDestroyConnection]);

  const handleToggleSending = useCallback(async () => {
    await onToggleStudentSending?.(!sendingEnabled);
  }, [sendingEnabled, onToggleStudentSending]);

  const connKey = (a: string, b: string) => [a, b].sort().join('-');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="zone-card phase-panel-purple"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold text-heading">{t('phase5InstructionTitle')}</h2>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Initialize network */}
        <button
          onClick={() => onInitializeNetwork?.(true)}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" />
          {t('phase5.initializeNetwork')}
        </button>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-zinc-600">
          <button
            onClick={() => setMode('tx')}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
              mode === 'tx'
                ? 'bg-blue-600 text-white'
                : 'bg-surface text-muted hover:bg-gray-100 dark:hover:bg-zinc-700'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            {t('phase5.modeTx')}
          </button>
          <button
            onClick={() => setMode('disconnect')}
            className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
              mode === 'disconnect'
                ? 'bg-red-600 text-white'
                : 'bg-surface text-muted hover:bg-gray-100 dark:hover:bg-zinc-700'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            {t('phase5.modeDisconnect')}
          </button>
        </div>

        {/* Toggle student sending */}
        <button
          onClick={handleToggleSending}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
            sendingEnabled
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-surface border border-gray-300 dark:border-zinc-600 text-muted hover:bg-gray-100 dark:hover:bg-zinc-700'
          }`}
        >
          {sendingEnabled ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {sendingEnabled ? t('phase5.studentSendingOn') : t('phase5.studentSendingOff')}
        </button>

        {/* Stats */}
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {activeNodes} {t('phase5.activeNodes').toLowerCase()}
          </span>
          <span>{activeConnections} {t('phase5.connections').toLowerCase()}</span>
          <span>{mempoolCount} tx</span>
          {propagatingCount > 0 && (
            <span className="text-yellow-500 animate-pulse">{propagatingCount} propagant...</span>
          )}
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-sm text-blue-700 dark:text-blue-300"
          >
            {feedback}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode hint */}
      <div className="mb-2 text-xs text-muted">
        {mode === 'tx'
          ? t('phase5.hintTxMode')
          : t('phase5.hintDisconnectMode')
        }
      </div>

      {/* ─── Network map ─── */}
      {students.length === 0 ? (
        <div className="text-center py-12 text-muted">{t('phase5.noStudents')}</div>
      ) : activeConnections === 0 ? (
        <div className="text-center py-12 text-muted">
          <p className="mb-3">{t('phase5.networkNotInitialized')}</p>
        </div>
      ) : (
        <div
          ref={svgContainerRef}
          className="bg-gray-100 dark:bg-zinc-800/50 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700"
        >
          <svg
            viewBox={viewBox}
            className="w-full"
            style={{ height: '55vh', minHeight: '350px', cursor: isPanning ? 'grabbing' : 'grab' }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Background rect for pan events */}
            <rect x={-9999} y={-9999} width={99999} height={99999} fill="transparent" />
            {/* Connection lines */}
            {nodeConnections.filter(c => c.isActive).map(conn => {
              const posA = layoutPositions.get(conn.nodeAId);
              const posB = layoutPositions.get(conn.nodeBId);
              if (!posA || !posB) return null;

              const key = connKey(conn.nodeAId, conn.nodeBId);
              const isPropagating = propagatingEdges.has(key);
              const isDisconnectMode = mode === 'disconnect';

              return (
                <g key={conn.id}>
                  {/* Clickable hit area (wider invisible line) */}
                  {isDisconnectMode && (
                    <line
                      x1={posA.x} y1={posA.y}
                      x2={posB.x} y2={posB.y}
                      stroke="transparent"
                      strokeWidth={20}
                      className="cursor-pointer"
                      onClick={() => handleEdgeClick(conn.id)}
                    />
                  )}
                  {/* Visible line */}
                  <line
                    x1={posA.x} y1={posA.y}
                    x2={posB.x} y2={posB.y}
                    stroke={
                      isPropagating ? '#facc15'
                        : isDisconnectMode ? '#f87171'
                        : '#6b7280'
                    }
                    strokeWidth={isPropagating ? 4 : 2.5}
                    strokeLinecap="round"
                    opacity={isDisconnectMode && !isPropagating ? 0.7 : 1}
                    className={isDisconnectMode ? 'cursor-pointer' : ''}
                    onClick={isDisconnectMode ? () => handleEdgeClick(conn.id) : undefined}
                  />
                  {/* Propagation glow */}
                  {isPropagating && (
                    <line
                      x1={posA.x} y1={posA.y}
                      x2={posB.x} y2={posB.y}
                      stroke="#facc15"
                      strokeWidth={10}
                      strokeLinecap="round"
                      opacity={0.25}
                    >
                      <animate
                        attributeName="opacity"
                        values="0.1;0.4;0.1"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </line>
                  )}
                </g>
              );
            })}

            {/* Node circles */}
            {students.map((student, idx) => {
              const pos = layoutPositions.get(student.id);
              if (!pos) return null;
              const isDisconnected = student.isNodeDisconnected || false;
              const txCount = mempoolTransactions.filter(tx =>
                tx.propagatedTo?.includes(student.id)
              ).length;

              // Floating animation params (unique per node)
              const seed = student.id.charCodeAt(0) + idx * 7;
              const durX = 4 + (seed % 3);
              const durY = 5 + (seed % 4);
              const ampX = 3 + (seed % 3);
              const ampY = 2 + (seed % 3);

              return (
                <g
                  key={student.id}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(student.id)}
                >
                  {/* Floating animation wrapper */}
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values={`0,0; ${ampX},${-ampY}; ${-ampX},${ampY}; 0,0`}
                    dur={`${durX}s`}
                    repeatCount="indefinite"
                    additive="sum"
                  />
                  {/* Node circle */}
                  <circle
                    cx={pos.x} cy={pos.y}
                    r={NODE_RADIUS}
                    fill={isDisconnected ? '#7f1d1d' : '#1e3a5f'}
                    stroke={
                      isDisconnected ? '#ef4444'
                        : mode === 'disconnect' ? '#f87171'
                        : '#3b82f6'
                    }
                    strokeWidth={2.5}
                    opacity={isDisconnected ? 0.6 : 1}
                  />
                  {/* Name */}
                  <text
                    x={pos.x} y={pos.y - 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isDisconnected ? '#fca5a5' : 'white'}
                    fontSize="13"
                    fontWeight="600"
                  >
                    {student.name.length > 9 ? student.name.slice(0, 8) + '..' : student.name}
                  </text>
                  {/* TX count badge */}
                  {txCount > 0 && !isDisconnected && (
                    <>
                      <circle cx={pos.x + 22} cy={pos.y - 22} r={11} fill="#7c3aed" />
                      <text
                        x={pos.x + 22} y={pos.y - 21}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {txCount > 9 ? '9+' : txCount}
                      </text>
                    </>
                  )}
                  {/* Disconnected label */}
                  {isDisconnected && (
                    <text
                      x={pos.x} y={pos.y + 13}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fca5a5"
                      fontSize="10"
                    >
                      {t('phase5.disconnectedLabel')}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </motion.div>
  );
}
