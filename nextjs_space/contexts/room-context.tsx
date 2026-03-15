'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useRoomPolling, type DifficultyInfo } from '@/hooks/use-room-polling';
import type { Participant } from '@/lib/types';

export type { DifficultyInfo };

type PollingReturn = ReturnType<typeof useRoomPolling>;

interface RoomContextValue extends PollingReturn {
  participant: Participant | null;
  isTeacher: boolean;
  participantId: string | null;
}

const RoomContext = createContext<RoomContextValue | null>(null);

interface RoomProviderProps {
  children: ReactNode;
  roomCode: string;
  participantId: string;
  participantRole: 'teacher' | 'student';
  enabled?: boolean;
}

export function RoomProvider({ children, roomCode, participantId, participantRole, enabled = true }: RoomProviderProps) {
  const polling = useRoomPolling({
    roomId: roomCode,
    participantId,
    enabled,
  });

  const participant = polling.room?.participants?.find(p => p.id === participantId) ?? null;
  const isTeacher = participantRole === 'teacher';

  const value = useMemo<RoomContextValue>(() => ({
    ...polling,
    participant,
    isTeacher,
    participantId,
  }), [polling, participant, isTeacher, participantId]);

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used within a RoomProvider');
  return ctx;
}

export function useRoomData() {
  const { room, loading, error, refetch } = useRoom();
  return { room, loading, error, refetch };
}

export function useRoomBlocks() {
  return useRoom().blocks;
}

export function useRoomMempool() {
  return useRoom().mempoolTransactions;
}
