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
const FLASH_DUR_S = 0.5; // seconds for node flash ring

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

  // Force layout — stable: only recomputes on explicit init or student count change.
  // Individual connection changes do NOT trigger layout recalculation.
  const layoutWidth = 1200;
  const layoutHeight = 800;
  const [layoutVersion, setLayoutVersion] = useState(0);
  const prevStudentCount = useRef(0);

  // Bump layout version when student count changes
  useEffect(() => {
    if (students.length !== prevStudentCount.current && students.length > 0) {
      prevStudentCount.current = students.length;
      setLayoutVersion(v => v + 1);
    }
  }, [students.length]);

  // Base positions from force-layout (computed on init / student count change)
  const baseLayoutPositions = useMemo(() => {
    void layoutVersion;
    const nodes = students.map(s => ({
      id: s.id,
      name: s.name,
      disconnected: s.isNodeDisconnected || false,
    }));
    const edges = nodeConnections
      .filter(c => c.isActive)
      .map(c => ({ id: c.id, a: c.nodeAId, b: c.nodeBId }));
    return computeForceLayout(nodes, edges, layoutWidth, layoutHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutVersion]);

  // Manual drag overrides — stores absolute positions for dragged nodes
  const [dragPositions, setDragPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  // Reset drag positions when layout recomputes
  useEffect(() => {
    setDragPositions(new Map());
  }, [layoutVersion]);

  // Final positions: manual override takes precedence over force-layout
  const layoutPositions = useMemo(() => {
    const merged = new Map<string, { x: number; y: number }>();
    for (const [id, pos] of baseLayoutPositions) {
      merged.set(id, dragPositions.get(id) || pos);
    }
    return merged;
  }, [baseLayoutPositions, dragPositions]);

  // ─── Node drag & drop ───
  const dragRef = useRef<{
    nodeId: string;
    startX: number; startY: number;
    origX: number; origY: number;
  } | null>(null);
  const didDragRef = useRef(false);

  const handleNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation(); // don't start pan
    const pos = layoutPositions.get(nodeId);
    if (!pos) return;
    didDragRef.current = false;
    dragRef.current = {
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }, [layoutPositions]);

  const handleNodePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    // Only start dragging after a minimum threshold (5px)
    if (!didDragRef.current && Math.abs(dx) + Math.abs(dy) < 5) return;
    didDragRef.current = true;

    const svg = (e.target as SVGElement).closest('svg');
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const scale = ctm.a;
    const newPos = {
      x: dragRef.current.origX + dx / scale,
      y: dragRef.current.origY + dy / scale,
    };
    setDragPositions(prev => {
      const next = new Map(prev);
      next.set(dragRef.current!.nodeId, newPos);
      return next;
    });
  }, []);

  const handleNodePointerUp = useCallback(() => {
    dragRef.current = null;
    // didDragRef stays true until next pointerDown — onClick reads it
  }, []);

  // ─── Propagation animation (rAF-based, NOT SMIL) ───
  // Uses propagationEdges from the server for precise timing.
  // Each TX has its own color. Redundant edges (node already has TX) show
  // a dimmer pulse with no flash — realistic gossip protocol visualization.

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
      if (timestamp - lastFrame < 33) { // ~30fps
        rAFRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrame = timestamp;
      const now = Date.now();

      // Process pulses — each pulse has its own duration + color
      const activePulses: PulseData[] = [];
      const pulsePositions: typeof renderedPulses = [];
      const completedPulses: PulseData[] = [];

      for (const pulse of pulsesRef.current) {
        const elapsed = now - pulse.startTime;
        if (elapsed < 0) { activePulses.push(pulse); continue; }
        const progress = elapsed / pulse.duration;
        if (progress < 1) {
          const t = 1 - Math.pow(1 - progress, 2); // ease-out
          const baseOpacity = pulse.redundant ? 0.4 : 0.95;
          pulsePositions.push({
            id: pulse.id,
            x: pulse.fromX + (pulse.toX - pulse.fromX) * t,
            y: pulse.fromY + (pulse.toY - pulse.fromY) * t,
            opacity: progress < 0.1 ? (progress * 10) * baseOpacity : baseOpacity,
            r: 5 + 4 * Math.sin(progress * Math.PI),
            color: pulse.color,
          });
          activePulses.push(pulse);
        } else {
          completedPulses.push(pulse);
        }
      }
      pulsesRef.current = activePulses;
      setRenderedPulses(pulsePositions);

      // Create flashes only for non-redundant completed pulses
      if (completedPulses.length > 0) {
        const newFlashes = completedPulses
          .filter(p => !p.redundant)
          .map(p => ({
            id: `f-${p.toNodeId}-${now}-${p.id.slice(-4)}`,
            cx: p.toX, cy: p.toY,
            startTime: now, color: p.color,
          }));
        flashesRef.current = [...flashesRef.current, ...newFlashes];
      }

      // Process flashes
      const activeFlashes: FlashData[] = [];
      const flashPositions: typeof renderedFlashes = [];
      for (const flash of flashesRef.current) {
        const progress = (now - flash.startTime) / (FLASH_DUR_S * 1000);
        if (progress < 1) {
          const glowOpacity = progress < 0.3 ? (progress / 0.3) * 0.45 : 0.45 * (1 - (progress - 0.3) / 0.7);
          const ringR = NODE_RADIUS + 22 * progress;
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

  // Cleanup rAF on unmount
  useEffect(() => () => cancelAnimationFrame(rAFRef.current), []);

  // Read propagationEdges from server and create pulses with exact timestamps.
  // If we detect edges late (e.g. polling delay), shift all times forward
  // so the cascade is still visible from the earliest unseen edge.
  useEffect(() => {
    const seen = seenEdgesRef.current;
    let hasNew = false;

    for (const tx of mempoolTransactions) {
      const edges = tx.propagationEdges;
      if (!edges || edges.length === 0) continue;
      const color = tx.propagationColor || '#facc15';

      // Find unseen edges for this TX
      const unseenEdges = edges.filter(e => !seen.has(`${tx.id}-${e.fromNodeId}-${e.toNodeId}`));
      if (unseenEdges.length === 0) continue;

      // If the earliest edge is already past, shift all forward so we still see the cascade
      const now = Date.now();
      const earliestStart = Math.min(...unseenEdges.map(e => e.startTime));
      const timeOffset = now > earliestStart ? now - earliestStart : 0;

      for (const edge of unseenEdges) {
        const edgeKey = `${tx.id}-${edge.fromNodeId}-${edge.toNodeId}`;
        seen.add(edgeKey);

        const from = layoutPositions.get(edge.fromNodeId);
        const to = layoutPositions.get(edge.toNodeId);
        if (!from || !to) continue;

        pulsesRef.current.push({
          id: `p-${edgeKey}`,
          fromX: from.x, fromY: from.y,
          toX: to.x, toY: to.y,
          toNodeId: edge.toNodeId,
          startTime: edge.startTime + timeOffset,
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
  }, [mempoolTransactions, layoutPositions, startAnimation]);

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
          onClick={async () => {
            await onInitializeNetwork?.(true);
            setLayoutVersion(v => v + 1);
          }}
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
            <defs>
              <filter id="pulse-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect x={-9999} y={-9999} width={99999} height={99999} fill="transparent" />
            {/* Connection lines — hide if either node is disconnected */}
            {nodeConnections.filter(c => {
              if (!c.isActive) return false;
              const sA = students.find(s => s.id === c.nodeAId);
              const sB = students.find(s => s.id === c.nodeBId);
              if (sA?.isNodeDisconnected || sB?.isNodeDisconnected) return false;
              return true;
            }).map(conn => {
              const posA = layoutPositions.get(conn.nodeAId);
              const posB = layoutPositions.get(conn.nodeBId);
              if (!posA || !posB) return null;

              const isDisconnectMode = mode === 'disconnect';
              // Detect new connections (created recently) for fade-in
              const connAge = Date.now() - new Date(conn.createdAt).getTime();
              const isNew = connAge < 2000;
              const fadeOpacity = isNew ? Math.min(1, connAge / 1500) : 1;

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
                    stroke={isDisconnectMode ? '#f87171' : isNew ? '#34d399' : '#6b7280'}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    opacity={(isDisconnectMode ? 0.7 : 1) * fadeOpacity}
                    className={isDisconnectMode ? 'cursor-pointer' : ''}
                    onClick={isDisconnectMode ? () => handleEdgeClick(conn.id) : undefined}
                  />
                </g>
              );
            })}

            {/* Radar waves for nodes searching for peers (disconnected OR orphaned) */}
            {students.filter(s => {
              if (s.isNodeDisconnected) return true;
              // Orphan: no active connections
              const conns = nodeConnections.filter(c =>
                c.isActive && (c.nodeAId === s.id || c.nodeBId === s.id)
              );
              return conns.length === 0;
            }).map(student => {
              const pos = layoutPositions.get(student.id);
              if (!pos) return null;
              const isDisc = student.isNodeDisconnected;
              const color = isDisc ? '#ef4444' : '#f59e0b'; // red if disconnected, amber if orphan
              return (
                <g key={`radar-${student.id}`}>
                  {[0, 1, 2].map(i => (
                    <circle key={i} cx={pos.x} cy={pos.y} r={NODE_RADIUS}
                      fill="none" stroke={color} strokeWidth={1.5}>
                      <animate attributeName="r" from={String(NODE_RADIUS)}
                        to={String(NODE_RADIUS + 60)} dur="2.5s"
                        begin={`${i * 0.8}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.6" to="0"
                        dur="2.5s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
                    </circle>
                  ))}
                </g>
              );
            })}

            {/* Node circles */}
            {students.map((student, idx) => {
              const pos = layoutPositions.get(student.id);
              if (!pos) return null;
              const isDisconnected = student.isNodeDisconnected || false;
              const isOrphan = !isDisconnected && nodeConnections.filter(c =>
                c.isActive && (c.nodeAId === student.id || c.nodeBId === student.id)
              ).length === 0;
              const isSearching = isDisconnected || isOrphan;
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
                  style={{ touchAction: 'none' }}
                  onClick={() => { if (!didDragRef.current) handleNodeClick(student.id); }}
                  onPointerDown={(e) => handleNodePointerDown(e, student.id)}
                  onPointerMove={handleNodePointerMove}
                  onPointerUp={handleNodePointerUp}
                >
                  {/* Floating animation — amplified when searching for peers */}
                  <animateTransform
                      attributeName="transform"
                      type="translate"
                      values={isSearching
                        ? `0,0; ${ampX * 3},${-ampY * 2}; ${-ampX * 2},${ampY * 3}; 0,0`
                        : `0,0; ${ampX},${-ampY}; ${-ampX},${ampY}; 0,0`}
                      dur={isSearching ? `${durX * 1.5}s` : `${durX}s`}
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

            {/* ─── Propagation pulse dots (rAF-driven, per-TX color) ─── */}
            {renderedPulses.map(p => (
              <circle key={p.id} cx={p.x} cy={p.y} r={p.r}
                fill={p.color} opacity={p.opacity} filter="url(#pulse-glow)" />
            ))}

            {/* ─── Node flash effects (rAF-driven, per-TX color) ─── */}
            {renderedFlashes.map(f => (
              <g key={f.id}>
                <circle cx={f.cx} cy={f.cy} r={NODE_RADIUS}
                  fill={f.color} opacity={f.glowOpacity} />
                <circle cx={f.cx} cy={f.cy} r={f.ringR}
                  fill="none" stroke={f.color} strokeWidth={2.5} opacity={f.ringOpacity} />
              </g>
            ))}
          </svg>
        </div>
      )}
    </motion.div>
  );
}
