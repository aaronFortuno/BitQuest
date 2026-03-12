'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateBlockHash, isHashValidLeadingZeros, isHashValidTarget } from '@/lib/client-hash';
import { Block, Room, Participant } from '@/lib/types';

export interface RigState {
  id: number;
  isActive: boolean;
  isLocked: boolean;
  speed: number;
  currentNonce: number;
  lastHash: string | null;
  lastHashValid: boolean;
  totalHashes: number;
}

interface UseAutoMiningProps {
  room: Room | null;
  participant: Participant | null | undefined;
  blocks: Block[];
  enabled: boolean;
  onCreatePendingBlock: () => Promise<Block | null>;
  onSubmitBlock: (nonce: number, hash: string) => Promise<{
    success: boolean;
    error?: string;
    code?: string;
    block?: Block;
    reward?: number;
    difficultyAdjustment?: {
      previousDifficulty: number;
      newDifficulty: number;
      result: 'increased' | 'decreased' | 'stable';
    };
  }>;
  onBatchHashUpdate: (hashCount: number, activeRigs?: number) => Promise<void>;
}

export interface AutoMiningResult {
  rigs: RigState[];
  totalHashrate: number;
  isAnyMining: boolean;
  lastBlockEvent: BlockEvent | null;
  toggleRig: (rigId: number) => void;
}

export interface BlockEvent {
  type: 'mined' | 'lost' | 'error';
  message: string;
  reward?: number;
  difficultyChange?: { from: number; to: number; result: string };
  timestamp: number;
}

export function useAutoMining({
  room,
  participant,
  blocks,
  enabled,
  onCreatePendingBlock,
  onSubmitBlock,
  onBatchHashUpdate,
}: UseAutoMiningProps): AutoMiningResult {
  const maxRigs = participant?.maxRigs || 1;
  const rigSpeed = participant?.rigSpeed || 4;
  const currentPhase = room?.currentPhase || 6;

  const [rigs, setRigs] = useState<RigState[]>(() =>
    [0, 1, 2].map(id => ({
      id,
      isActive: id === 0,
      isLocked: id >= maxRigs,
      speed: rigSpeed,
      currentNonce: Math.floor(Math.random() * 1000000),
      lastHash: null,
      lastHashValid: false,
      totalHashes: 0,
    }))
  );

  const [lastBlockEvent, setLastBlockEvent] = useState<BlockEvent | null>(null);

  // Refs for mutable mining state (avoid re-renders per hash)
  const miningRef = useRef({
    isSubmitting: false,
    hashCountSinceLastBatch: 0,
    pendingBlockId: null as string | null,
    nonces: [
      Math.floor(Math.random() * 1000000),
      Math.floor(Math.random() * 1000000),
      Math.floor(Math.random() * 1000000),
    ],
    totalHashes: [0, 0, 0],
    lastHashes: [null as string | null, null as string | null, null as string | null],
    lastHashValid: [false, false, false],
    creatingPending: false,
  });

  const pendingBlock = blocks.find(b => b.status === 'mined' ? false : b.status === 'pending');
  const hasGenesis = blocks.some(b => b.status === 'mined' && b.blockNumber === 1);

  // Update rig lock state when maxRigs changes
  useEffect(() => {
    setRigs(prev => prev.map(rig => ({
      ...rig,
      isLocked: rig.id >= maxRigs,
      isActive: rig.id >= maxRigs ? false : rig.isActive,
      speed: rigSpeed,
    })));
  }, [maxRigs, rigSpeed]);

  // Auto-create pending block when none exists
  useEffect(() => {
    if (!enabled || !hasGenesis || pendingBlock || miningRef.current.creatingPending) return;

    const timer = setTimeout(async () => {
      if (miningRef.current.creatingPending) return;
      miningRef.current.creatingPending = true;
      try {
        await onCreatePendingBlock();
      } catch {
        // Ignore — another student may have created it
      }
      miningRef.current.creatingPending = false;
    }, 500 + Math.random() * 1000);

    return () => clearTimeout(timer);
  }, [enabled, hasGenesis, pendingBlock, onCreatePendingBlock]);

  // Track pending block changes
  useEffect(() => {
    if (pendingBlock?.id !== miningRef.current.pendingBlockId) {
      miningRef.current.pendingBlockId = pendingBlock?.id || null;
      miningRef.current.isSubmitting = false;
      // Reset nonces for new block
      miningRef.current.nonces = [
        Math.floor(Math.random() * 1000000),
        Math.floor(Math.random() * 1000000),
        Math.floor(Math.random() * 1000000),
      ];
    }
  }, [pendingBlock?.id]);

  // Main mining loop
  useEffect(() => {
    if (!enabled || !pendingBlock || !pendingBlock.transactionsRaw) return;

    const activeRigs = rigs.filter(r => r.isActive && !r.isLocked);
    if (activeRigs.length === 0) return;

    const { blockNumber, previousHash, transactionsRaw, difficulty, miningTarget } = pendingBlock;

    // Calculate hashes per tick: we run at 20 ticks/second (50ms)
    // Each rig does `speed` hashes/second, so per tick = speed / 20
    const TICK_MS = 50;
    const hashesPerTickPerRig = new Map<number, number>();
    let fractionalAccum = new Map<number, number>();

    for (const rig of activeRigs) {
      const hpt = rig.speed / (1000 / TICK_MS);
      hashesPerTickPerRig.set(rig.id, hpt);
      fractionalAccum.set(rig.id, 0);
    }

    const intervalId = setInterval(async () => {
      if (miningRef.current.isSubmitting) return;

      for (const rig of activeRigs) {
        const hpt = hashesPerTickPerRig.get(rig.id) || 0;
        const accum = (fractionalAccum.get(rig.id) || 0) + hpt;
        const hashesToDo = Math.floor(accum);
        fractionalAccum.set(rig.id, accum - hashesToDo);

        for (let i = 0; i < hashesToDo; i++) {
          const nonce = miningRef.current.nonces[rig.id]++;
          const hash = await calculateBlockHash(blockNumber, previousHash, transactionsRaw!, nonce);
          miningRef.current.totalHashes[rig.id]++;
          miningRef.current.hashCountSinceLastBatch++;
          miningRef.current.lastHashes[rig.id] = hash;

          const hashIsValid = miningTarget && currentPhase >= 7
            ? isHashValidTarget(hash, miningTarget)
            : isHashValidLeadingZeros(hash, difficulty);

          if (hashIsValid) {
            miningRef.current.lastHashValid[rig.id] = true;
            miningRef.current.isSubmitting = true;

            try {
              const result = await onSubmitBlock(nonce, hash);
              if (result.success) {
                setLastBlockEvent({
                  type: 'mined',
                  message: `Block #${blockNumber} mined!`,
                  reward: result.reward,
                  difficultyChange: result.difficultyAdjustment
                    ? { from: result.difficultyAdjustment.previousDifficulty, to: result.difficultyAdjustment.newDifficulty, result: result.difficultyAdjustment.result }
                    : undefined,
                  timestamp: Date.now(),
                });
              } else if (result.code === 'ALREADY_MINED') {
                setLastBlockEvent({
                  type: 'lost',
                  message: `Block #${blockNumber} — someone was faster`,
                  timestamp: Date.now(),
                });
              }
            } catch {
              // Error submitting, will retry on next pending block
            }
            miningRef.current.isSubmitting = false;
            return; // Stop processing this tick
          } else {
            miningRef.current.lastHashValid[rig.id] = false;
          }
        }
      }
    }, TICK_MS);

    return () => clearInterval(intervalId);
  }, [enabled, pendingBlock?.id, pendingBlock?.transactionsRaw, pendingBlock?.blockNumber, pendingBlock?.previousHash, pendingBlock?.difficulty, pendingBlock?.miningTarget, currentPhase, rigs, onSubmitBlock]);

  // Batch hash update (every 2 seconds)
  useEffect(() => {
    if (!enabled) return;

    const batchInterval = setInterval(() => {
      const count = miningRef.current.hashCountSinceLastBatch;
      if (count > 0) {
        miningRef.current.hashCountSinceLastBatch = 0;
        const activeCount = rigs.filter(r => r.isActive && !r.isLocked).length;
        onBatchHashUpdate(count, activeCount);
      }
    }, 2000);

    return () => clearInterval(batchInterval);
  }, [enabled, rigs, onBatchHashUpdate]);

  // UI state sync (every 500ms to avoid constant re-renders)
  useEffect(() => {
    if (!enabled) return;

    const uiInterval = setInterval(() => {
      setRigs(prev => prev.map(rig => ({
        ...rig,
        currentNonce: miningRef.current.nonces[rig.id],
        lastHash: miningRef.current.lastHashes[rig.id],
        lastHashValid: miningRef.current.lastHashValid[rig.id],
        totalHashes: miningRef.current.totalHashes[rig.id],
        speed: rigSpeed,
        isLocked: rig.id >= maxRigs,
      })));
    }, 500);

    return () => clearInterval(uiInterval);
  }, [enabled, rigSpeed, maxRigs]);

  // Clear block event after 4 seconds
  useEffect(() => {
    if (!lastBlockEvent) return;
    const timer = setTimeout(() => setLastBlockEvent(null), 4000);
    return () => clearTimeout(timer);
  }, [lastBlockEvent]);

  const toggleRig = useCallback((rigId: number) => {
    if (rigId >= maxRigs) return;
    setRigs(prev => prev.map(rig =>
      rig.id === rigId ? { ...rig, isActive: !rig.isActive } : rig
    ));
  }, [maxRigs]);

  const activeRigs = rigs.filter(r => r.isActive && !r.isLocked);
  const totalHashrate = activeRigs.reduce((sum, r) => sum + r.speed, 0);

  return {
    rigs,
    totalHashrate,
    isAnyMining: activeRigs.length > 0 && !!pendingBlock && enabled,
    lastBlockEvent,
    toggleRig,
  };
}
