'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, Transaction, Participant, SignedMessage, UTXO, UTXOTransaction, MempoolTransaction, NodeConnection, Block, DifficultyPeriod, HalvingInfo, EconomicStats, SimulationStats, ChallengeData, ChallengeType, MiningPool, BitcoinAddress, Phase9UTXO, Phase9MempoolTransaction } from '@/lib/types';
// TEMPORARILY DISABLED — Socket.io long-polling exhausts browser connection pool
// import { joinRoom as socketJoinRoom, leaveRoom as socketLeaveRoom, onRoomUpdate } from '@/lib/socket';
import { apiUrl } from '@/lib/api';
import { generateRSAKeyPair, serializePublicKey } from '@/lib/crypto';

// Difficulty info from API
export interface DifficultyInfo {
  currentDifficulty: number;
  miningTarget?: number;
  targetBlockTime: number;
  adjustmentInterval: number;
  currentPeriod: number;
  periodStartBlock: number;
  periodEndBlock: number;
  blocksInCurrentPeriod: number;
  avgTimePerBlock: number;
  totalTimeSeconds: number;
  prediction: 'up' | 'down' | 'stable';
  periodHistory: {
    periodNumber: number;
    startBlock: number;
    endBlock: number;
    blocksMinedInPeriod: number;
    totalTimeSeconds: number;
    avgTimePerBlock: number;
    difficulty: number;
  }[];
}

// Re-export types for convenience
export type { HalvingInfo, EconomicStats };

interface UseRoomPollingProps {
  roomId: string | null;
  participantId: string | null;
  enabled?: boolean;
}

export function useRoomPolling({ roomId, participantId, enabled = true }: UseRoomPollingProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<SignedMessage[]>([]);
  const [utxos, setUtxos] = useState<UTXO[]>([]);
  const [utxoTransactions, setUtxoTransactions] = useState<UTXOTransaction[]>([]);
  // Phase 5: Mempool and network
  const [mempoolTransactions, setMempoolTransactions] = useState<MempoolTransaction[]>([]);
  const [nodeConnections, setNodeConnections] = useState<NodeConnection[]>([]);
  // Phase 6, 7 & 8: Blocks, difficulty info, and economic info
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [difficultyInfo, setDifficultyInfo] = useState<DifficultyInfo | null>(null);
  const [halvingInfo, setHalvingInfo] = useState<HalvingInfo | null>(null);
  const [economicStats, setEconomicStats] = useState<EconomicStats | null>(null);
  // Phase 7: Mining pools
  const [miningPools, setMiningPools] = useState<MiningPool[]>([]);
  const [poolsEnabled, setPoolsEnabled] = useState(false);
  // Phase 8: Auto-mine settings
  const [autoMineSettings, setAutoMineSettings] = useState<{ autoMineInterval: number; autoMineCapacity: number }>({ autoMineInterval: 20, autoMineCapacity: 3 });
  // Phase 9: Free simulation (legacy)
  const [simulationStats, setSimulationStats] = useState<SimulationStats | null>(null);
  // Phase 9: Address-based pseudonymity
  const [phase9Addresses, setPhase9Addresses] = useState<BitcoinAddress[]>([]);
  const [phase9Utxos, setPhase9Utxos] = useState<Phase9UTXO[]>([]);
  const [phase9MempoolTxs, setPhase9MempoolTxs] = useState<Phase9MempoolTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastTransactionCount = useRef(0);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  // Stable ref for room UUID — avoids cascading useCallback/useEffect re-runs
  const roomUuidRef = useRef<string | null>(null);
  // Guard against concurrent fetchRoom calls piling up
  const isFetchingRoom = useRef(false);
  // Debounce timer for Socket.io-triggered fetches
  const debouncedFetchTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    // Skip if a previous fetchRoom is still in-flight
    if (isFetchingRoom.current) return;
    isFetchingRoom.current = true;

    try {
      const res = await fetch(apiUrl(`/api/rooms?code=${roomId}`));
      if (res.status === 404) {
        // Room no longer exists (server restarted or room deleted) — stop polling
        setRoom(null);
        setError('Room not found');
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch room');
      const data = await res.json();

      if (data.room) {
        roomUuidRef.current = data.room.id;
        setRoom(data.room as Room);
        setError(null);

        // Track new transactions
        const txCount = data.room.transactions?.length ?? 0;
        if (txCount > lastTransactionCount.current) {
          lastTransactionCount.current = txCount;
        }
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      isFetchingRoom.current = false;
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    fetchRoom();

    // Restart polling interval (called after Socket.io events to avoid overlap)
    const startPolling = () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      pollInterval.current = setInterval(fetchRoom, 2000);
    };
    startPolling();

    // Refetch immediately when tab becomes visible (browsers throttle background intervals)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchRoom();
        startPolling(); // Reset interval after refetch
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Socket.io: TEMPORARILY DISABLED
    // Socket.io long-polling was exhausting the browser's connection pool (~6 conns/origin),
    // causing ALL fetch requests to hang after ~60s. HTTP polling works fine alone.
    // TODO: Re-enable once Socket.io is configured to use WebSocket-only transport.
    // let socketCleanup: (() => void) | null = null;
    // if (room?.code) {
    //   socketJoinRoom(room.code);
    //   socketCleanup = onRoomUpdate(() => {
    //     if (debouncedFetchTimer.current) clearTimeout(debouncedFetchTimer.current);
    //     debouncedFetchTimer.current = setTimeout(() => {
    //       fetchRoom();
    //       startPolling();
    //     }, 300);
    //   });
    // }

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      if (debouncedFetchTimer.current) clearTimeout(debouncedFetchTimer.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [roomId, enabled, fetchRoom]);

  const sendTransaction = useCallback(async (receiverId: string, amount: number, phase: number = 0, senderId?: string, proposedById?: string) => {
    if (!room || !participantId) return null;

    try {
      const res = await fetch(apiUrl('/api/transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          senderId: senderId || participantId,
          receiverId,
          amount,
          phase,
          proposedById: proposedById || participantId,
        }),
      });

      if (!res.ok) throw new Error('Failed to send transaction');
      const data = await res.json();
      
      // Immediately refresh room data
      await fetchRoom();
      
      return data.transaction as Transaction;
    } catch (err) {
      console.error('Transaction error:', err);
      return null;
    }
  }, [room, participantId, fetchRoom]);

  const updateCoinFile = useCallback(async (coinFile: string) => {
    if (!participantId) return;

    try {
      await fetch(apiUrl(`/api/participants/${participantId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coinFile }),
      });
      
      await fetchRoom();
    } catch (err) {
      console.error('Update coin file error:', err);
    }
  }, [participantId, fetchRoom]);

  const highlightTransaction = useCallback(async (transactionId: string, isHighlighted: boolean) => {
    try {
      await fetch(apiUrl(`/api/transactions/${transactionId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHighlighted }),
      });
      
      await fetchRoom();
    } catch (err) {
      console.error('Highlight error:', err);
    }
  }, [fetchRoom]);

  const updatePhase = useCallback(async (currentPhase?: number, unlockPhase?: number) => {
    if (!room) {
      console.warn('[updatePhase] No room, aborting');
      return;
    }

    console.log('[updatePhase] Updating phase:', { currentPhase, unlockPhase, roomId: room.id });
    try {
      const res = await fetch(apiUrl(`/api/rooms/${room.id}/phase`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPhase, unlockPhase }),
      });
      console.log('[updatePhase] Response:', res.status);

      await fetchRoom();
      console.log('[updatePhase] Room refreshed');
    } catch (err) {
      console.error('[updatePhase] Error:', err);
    }
  }, [room, fetchRoom]);

  const resetPhase = useCallback(async () => {
    if (!room) return;

    try {
      await fetch(apiUrl(`/api/rooms/${room.id}/reset`), {
        method: 'POST',
      });

      await fetchRoom();
      // Phase 6+: blocks were cleared server-side, clear local state
      if (room.currentPhase >= 6) {
        setBlocks([]);
      }

      // Phase 9: re-initialize addresses and UTXOs after reset
      if (room.currentPhase === 9) {
        await fetch(apiUrl('/api/simulation'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: room.id, action: 'init-phase9' }),
        });
        await fetchRoom();
      }
    } catch (err) {
      console.error('Reset error:', err);
    }
  }, [room, fetchRoom]);

  // Phase 1: Approve a pending transaction
  const approveTransaction = useCallback(async (transactionId: string) => {
    try {
      await fetch(apiUrl(`/api/transactions/${transactionId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      
      await fetchRoom();
    } catch (err) {
      console.error('Approve transaction error:', err);
    }
  }, [fetchRoom]);

  // Phase 1: Reject a pending transaction
  const rejectTransaction = useCallback(async (transactionId: string, reason: string) => {
    try {
      await fetch(apiUrl(`/api/transactions/${transactionId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectReason: reason }),
      });
      
      await fetchRoom();
    } catch (err) {
      console.error('Reject transaction error:', err);
    }
  }, [fetchRoom]);

  // Phase 1: Change the bank
  const changeBank = useCallback(async (newBankId: string) => {
    if (!room) return;

    try {
      await fetch(apiUrl(`/api/rooms/${room.id}/bank`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newBankId }),
      });
      
      await fetchRoom();
    } catch (err) {
      console.error('Change bank error:', err);
    }
  }, [room, fetchRoom]);

  // Phase 1: Toggle bank disconnection
  const toggleBankDisconnection = useCallback(async (isDisconnected: boolean) => {
    if (!room) return;

    try {
      await fetch(apiUrl(`/api/rooms/${room.id}/bank`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBankDisconnected: isDisconnected }),
      });
      
      await fetchRoom();
    } catch (err) {
      console.error('Toggle bank disconnection error:', err);
    }
  }, [room, fetchRoom]);

  const updateTransferLimit = useCallback(async (limit: number) => {
    if (!room) return;

    try {
      await fetch(apiUrl(`/api/rooms/${room.id}/bank`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxTransferAmount: limit }),
      });

      await fetchRoom();
    } catch (err) {
      console.error('Update transfer limit error:', err);
    }
  }, [room, fetchRoom]);

  // Phase 2: Vote on a transaction
  const voteOnTransaction = useCallback(async (transactionId: string, vote: 'for' | 'against') => {
    if (!participantId) return;

    try {
      await fetch(apiUrl('/api/transactions/vote'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, participantId, vote }),
      });
      
      await fetchRoom();
    } catch (err) {
      console.error('Vote error:', err);
    }
  }, [participantId, fetchRoom]);

  // Phase 2: Force accept/reject a transaction (teacher only)
  const forceTransaction = useCallback(async (transactionId: string, action: 'accept' | 'reject') => {
    if (!participantId) return;

    try {
      await fetch(apiUrl('/api/transactions/force'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId, participantId, action }),
      });
      
      await fetchRoom();
    } catch (err) {
      console.error('Force transaction error:', err);
    }
  }, [participantId, fetchRoom]);

  // Phase 3: Fetch signed messages (uses roomUuidRef for stable reference)
  const fetchMessages = useCallback(async () => {
    const rid = roomUuidRef.current;
    if (!rid) return;

    try {
      const res = await fetch(apiUrl(`/api/messages?roomId=${rid}`));
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  }, []);

  // Poll messages when in Phase 3
  useEffect(() => {
    if (!enabled || !room || room.currentPhase !== 3) return;

    fetchMessages();
    const msgPoll = setInterval(fetchMessages, 5000);

    return () => clearInterval(msgPoll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.currentPhase, room?.id, enabled]);

  // Phase 3: Generate key pair locally (no server call)
  const generateKeys = useCallback((): { publicKey: string; privateKey: { d: number; p: number; q: number; phi: number }; steps: { p: number; q: number; n: number; phi: number; e: number; d: number } } | null => {
    if (!participantId) {
      console.warn('[generateKeys] No participantId, aborting');
      return null;
    }

    const { keys, steps } = generateRSAKeyPair();
    const publicKeyStr = serializePublicKey(keys.publicKey);

    // Store keys in localStorage (never leaves the device)
    localStorage.setItem(
      `bitquest_privateKey_${participantId}`,
      JSON.stringify(keys.privateKey)
    );
    localStorage.setItem(
      `bitquest_publicKey_${participantId}`,
      JSON.stringify(keys.publicKey)
    );

    return { publicKey: publicKeyStr, privateKey: keys.privateKey, steps };
  }, [participantId]);

  // Phase 3: Broadcast public key to the network (register on server)
  const broadcastPublicKey = useCallback(async (publicKey: string): Promise<boolean> => {
    if (!participantId) {
      console.warn('[broadcastPublicKey] No participantId');
      return false;
    }

    const url = apiUrl('/api/keys');
    console.log('[broadcastPublicKey] Sending to server...', { participantId, publicKey, url });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, publicKey }),
      });

      console.log('[broadcastPublicKey] Response:', res.status);
      if (!res.ok) {
        const errText = await res.text();
        console.error('[broadcastPublicKey] Server error:', errText);
        return false;
      }

      fetchRoom();
      return true;
    } catch (err) {
      console.error('[broadcastPublicKey] Failed:', err);
      return false;
    }
  }, [participantId, fetchRoom]);

  // Phase 3: Send a signed message (hash + signature computed client-side)
  const sendSignedMessage = useCallback(async (content: string, messageHash: string, signature: string) => {
    const rid = roomUuidRef.current;
    if (!rid || !participantId) return null;

    try {
      const res = await fetch(apiUrl('/api/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: rid,
          senderId: participantId,
          content,
          messageHash,
          signature,
        }),
      });

      if (!res.ok) {
        const errData = await res.text();
        console.error('Send message server error:', res.status, errData);
        throw new Error('Failed to send message');
      }
      const data = await res.json();

      await fetchMessages();
      return data as SignedMessage;
    } catch (err) {
      console.error('Send message error:', err);
      return null;
    }
  }, [participantId, fetchMessages]);

  // Phase 3: Send a fake message (teacher demo)
  const sendFakeMessage = useCallback(async (content: string, claimedBy: string) => {
    const rid = roomUuidRef.current;
    if (!rid || !participantId) return null;

    try {
      const res = await fetch(apiUrl('/api/messages/fake'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: rid,
          teacherId: participantId,
          content,
          claimedBy,
        }),
      });

      if (!res.ok) throw new Error('Failed to send fake message');
      const data = await res.json();

      await fetchMessages();
      return data as SignedMessage;
    } catch (err) {
      console.error('Send fake message error:', err);
      return null;
    }
  }, [participantId, fetchMessages]);

  // Phase 4: Fetch all UTXOs for the room (uses roomUuidRef for stable reference)
  const fetchUtxos = useCallback(async () => {
    const rid = roomUuidRef.current;
    if (!rid) return;

    try {
      const res = await fetch(apiUrl(`/api/utxos?roomId=${rid}`));
      if (!res.ok) throw new Error('Failed to fetch UTXOs');
      const data = await res.json();
      setUtxos(data || []);
    } catch (err) {
      console.error('Fetch UTXOs error:', err);
    }
  }, []);

  // Phase 4: Fetch all UTXO transactions for the room (uses roomUuidRef for stable reference)
  const fetchUtxoTransactions = useCallback(async () => {
    const rid = roomUuidRef.current;
    if (!rid) return;

    try {
      const res = await fetch(apiUrl(`/api/utxo-transactions?roomId=${rid}`));
      if (!res.ok) throw new Error('Failed to fetch UTXO transactions');
      const data = await res.json();
      setUtxoTransactions(data || []);
    } catch (err) {
      console.error('Fetch UTXO transactions error:', err);
    }
  }, []);

  // Poll UTXOs and UTXO transactions when in Phase 4
  useEffect(() => {
    if (!enabled || !room || room.currentPhase !== 4) return;

    fetchUtxos();
    fetchUtxoTransactions();
    const utxoPoll = setInterval(() => {
      fetchUtxos();
      fetchUtxoTransactions();
    }, 5000);

    return () => clearInterval(utxoPoll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.currentPhase, room?.id, enabled]);

  // Phase 4: Initialize UTXOs for a participant
  const initializeUtxos = useCallback(async () => {
    if (!room || !participantId) return null;

    try {
      const res = await fetch(apiUrl('/api/utxos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          participantId,
        }),
      });

      if (!res.ok) throw new Error('Failed to initialize UTXOs');
      const data = await res.json();
      
      await fetchUtxos();
      return data as UTXO[];
    } catch (err) {
      console.error('Initialize UTXOs error:', err);
      return null;
    }
  }, [room, participantId, fetchUtxos]);

  // Phase 4: Teacher sends BTC to a student (mint)
  const teacherSendUtxo = useCallback(async (
    targetParticipantId: string,
    amount: number
  ): Promise<UTXO[] | null> => {
    if (!room) return null;

    try {
      const res = await fetch(apiUrl('/api/utxos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          participantId: targetParticipantId,
          teacherMint: true,
          amount,
        }),
      });

      if (!res.ok) throw new Error('Failed to send UTXOs');
      const data = await res.json();

      await fetchUtxos();
      return data as UTXO[];
    } catch (err) {
      console.error('Teacher send UTXO error:', err);
      return null;
    }
  }, [room, fetchUtxos]);

  // Phase 4: Send a UTXO transaction
  const sendUtxoTransaction = useCallback(async (
    inputUtxoIds: string[],
    outputs: { recipientId: string; amount: number }[],
    signature?: string
  ): Promise<{ success: boolean; transaction?: UTXOTransaction; error?: string; invalidReason?: string }> => {
    if (!room || !participantId) {
      return { success: false, error: 'No room or participant' };
    }

    try {
      const res = await fetch(apiUrl('/api/utxo-transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          senderId: participantId,
          inputUtxoIds,
          outputs,
          signature,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        return { 
          success: false, 
          error: data.error || 'Failed to send transaction',
          invalidReason: data.invalidReason
        };
      }
      
      await fetchUtxos();
      await fetchUtxoTransactions();
      return { success: true, transaction: data as UTXOTransaction };
    } catch (err) {
      console.error('Send UTXO transaction error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, participantId, fetchUtxos, fetchUtxoTransactions]);

  // Phase 5: Fetch mempool transactions (uses roomUuidRef for stable reference)
  const fetchMempoolTransactions = useCallback(async () => {
    const rid = roomUuidRef.current;
    if (!rid) return;

    try {
      const res = await fetch(apiUrl(`/api/mempool?roomId=${rid}`));
      if (!res.ok) throw new Error('Failed to fetch mempool transactions');
      const data = await res.json();
      setMempoolTransactions(data || []);
    } catch (err) {
      console.error('Fetch mempool transactions error:', err);
    }
  }, []);

  // Phase 5: Fetch node connections (uses roomUuidRef for stable reference)
  const fetchNodeConnections = useCallback(async () => {
    const rid = roomUuidRef.current;
    if (!rid) return;

    try {
      const res = await fetch(apiUrl(`/api/node-connections?roomId=${rid}`));
      if (!res.ok) throw new Error('Failed to fetch node connections');
      const data = await res.json();
      setNodeConnections(data || []);
    } catch (err) {
      console.error('Fetch node connections error:', err);
    }
  }, []);

  // Poll mempool and connections when in Phase 5
  useEffect(() => {
    if (!enabled || !room || room.currentPhase !== 5) return;

    fetchMempoolTransactions();
    fetchNodeConnections();
    const mempoolPoll = setInterval(() => {
      fetchMempoolTransactions();
      fetchNodeConnections();
    }, 2500); // Fast polling to see propagation wave by wave

    return () => clearInterval(mempoolPoll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.currentPhase, room?.id, enabled]);

  // Phase 5: Initialize network connections
  const initializeNetwork = useCallback(async (regenerate = false) => {
    if (!room) return;

    try {
      const res = await fetch(apiUrl('/api/node-connections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          regenerate,
        }),
      });

      if (!res.ok) throw new Error('Failed to initialize network');
      const data = await res.json();
      setNodeConnections(data || []);
      return data;
    } catch (err) {
      console.error('Initialize network error:', err);
      return null;
    }
  }, [room]);

  // Phase 5: Create a mempool transaction
  const createMempoolTransaction = useCallback(async (
    receiverId: string,
    amount: number,
    fee: number = 0
  ): Promise<{ success: boolean; error?: string }> => {
    if (!room || !participantId) {
      return { success: false, error: 'No room or participant' };
    }

    try {
      const res = await fetch(apiUrl('/api/mempool'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          senderId: participantId,
          receiverId,
          amount,
          fee,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.error || 'Failed to create transaction' };
      }

      await fetchMempoolTransactions();
      return { success: true };
    } catch (err) {
      console.error('Create mempool transaction error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, participantId, fetchMempoolTransactions]);

  // Phase 5: Toggle node disconnection (teacher demo)
  const toggleNodeDisconnection = useCallback(async (nodeId: string, isDisconnected: boolean) => {
    try {
      await fetch(apiUrl(`/api/participants/${nodeId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isNodeDisconnected: isDisconnected }),
      });

      await fetchRoom();
    } catch (err) {
      console.error('Toggle node disconnection error:', err);
    }
  }, [fetchRoom]);

  // Phase 5: Fill mempool with demo transactions (teacher only)
  const fillMempool = useCallback(async (count: number = 10) => {
    if (!room) return;

    const students = room.participants.filter(p => p.isActive && p.role === 'student');
    if (students.length < 2) return;

    // Create random transactions between students
    for (let i = 0; i < count; i++) {
      const senderIdx = Math.floor(Math.random() * students.length);
      let receiverIdx = Math.floor(Math.random() * students.length);
      while (receiverIdx === senderIdx) {
        receiverIdx = Math.floor(Math.random() * students.length);
      }

      try {
        await fetch(apiUrl('/api/mempool'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: room.id,
            senderId: students[senderIdx].id,
            receiverId: students[receiverIdx].id,
            amount: Math.floor(Math.random() * 10) + 1,
            fee: Math.round((Math.random() * 4.9 + 0.1) * 10) / 10, // 0.1 to 5.0 BTC fees
          }),
        });
      } catch (err) {
        console.error('Fill mempool error:', err);
      }
    }

    await fetchMempoolTransactions();
  }, [room, fetchMempoolTransactions]);

  // Phase 5: Create a teacher-initiated transaction from any node
  const createTeacherTransaction = useCallback(async (originNodeId: string) => {
    if (!room) return;

    const students = room.participants.filter(p => p.isActive && p.role === 'student' && p.id !== originNodeId);
    if (students.length === 0) return;

    const receiver = students[Math.floor(Math.random() * students.length)];
    const amount = Math.floor(Math.random() * 5) + 1;

    try {
      await fetch(apiUrl('/api/mempool'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          originNodeId,
          receiverId: receiver.id,
          amount,
        }),
      });
      await fetchMempoolTransactions();
    } catch (err) {
      console.error('Create teacher transaction error:', err);
    }
  }, [room, fetchMempoolTransactions]);

  // Phase 5: Destroy a specific connection
  const destroyConnection = useCallback(async (connectionId: string) => {
    if (!room) return;

    try {
      await fetch(apiUrl(`/api/node-connections?connectionId=${connectionId}&roomId=${room.id}`), {
        method: 'DELETE',
      });
      await fetchNodeConnections();
    } catch (err) {
      console.error('Destroy connection error:', err);
    }
  }, [room, fetchNodeConnections]);

  // Phase 5: Toggle student sending permission
  const toggleStudentSending = useCallback(async (enabled: boolean) => {
    if (!room) return;

    try {
      await fetch(apiUrl(`/api/rooms/${room.id}/network`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentSendingEnabled: enabled }),
      });
      await fetchRoom();
    } catch (err) {
      console.error('Toggle student sending error:', err);
    }
  }, [room, fetchRoom]);

  // Phase 6, 7 & 8: Fetch blocks, difficulty info, halving info, and economic stats (uses roomUuidRef)
  const fetchBlocks = useCallback(async () => {
    const rid = roomUuidRef.current;
    if (!rid) return;

    try {
      const res = await fetch(apiUrl(`/api/blocks?roomId=${rid}`));
      if (!res.ok) throw new Error('Failed to fetch blocks');
      const data = await res.json();
      if (data.blocks) {
        setBlocks(data.blocks);
      }
      if (data.difficultyInfo) {
        setDifficultyInfo(data.difficultyInfo);
      }
      if (data.halvingInfo) {
        setHalvingInfo(data.halvingInfo);
      }
      if (data.economicStats) {
        setEconomicStats(data.economicStats);
      }
      if (data.autoMineSettings) {
        setAutoMineSettings(data.autoMineSettings);
      }
    } catch (err) {
      console.error('Fetch blocks error:', err);
    }
  }, []);

  // Phase 7: Fetch mining pools
  const fetchPools = useCallback(async () => {
    const rid = roomUuidRef.current;
    if (!rid) return;

    try {
      const res = await fetch(apiUrl(`/api/pools?roomId=${rid}`));
      if (!res.ok) return;
      const data = await res.json();
      setMiningPools(data.pools || []);
      setPoolsEnabled(data.poolsEnabled || false);
    } catch (err) {
      console.error('Fetch pools error:', err);
    }
  }, []);

  // Poll blocks when in Phase 6, 7, or 8
  useEffect(() => {
    if (!enabled || !room || (room.currentPhase !== 6 && room.currentPhase !== 7 && room.currentPhase !== 8)) return;

    fetchBlocks();
    fetchMempoolTransactions(); // Also fetch mempool for Phase 8 transaction selection
    if (room.currentPhase === 7) fetchPools();
    const blocksPoll = setInterval(() => {
      fetchBlocks();
      fetchMempoolTransactions();
      if (room.currentPhase === 7) fetchPools();
    }, 2000); // Uses base poll interval (Socket.io handles real-time)

    return () => clearInterval(blocksPoll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.currentPhase, room?.id, enabled]);

  // Phase 6: Create pending block
  const createPendingBlock = useCallback(async (): Promise<Block | null> => {
    if (!room) return null;

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-pending',
          roomId: room.id,
        }),
      });

      if (!res.ok) throw new Error('Failed to create pending block');
      const data = await res.json();
      
      await fetchBlocks();
      return data.block || data;
    } catch (err) {
      console.error('Create pending block error:', err);
      return null;
    }
  }, [room, fetchBlocks]);

  // Phase 6: Calculate hash for mining attempt
  const calculateMiningHash = useCallback(async (nonce: number): Promise<{
    hash: string;
    hashShort: string;
    isValid: boolean;
    difficulty: number;
    blockNumber: number;
  } | null> => {
    if (!room || !participantId) return null;

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate-hash',
          roomId: room.id,
          minerId: participantId,
          nonce,
        }),
      });

      if (!res.ok) throw new Error('Failed to calculate hash');
      return await res.json();
    } catch (err) {
      console.error('Calculate hash error:', err);
      return null;
    }
  }, [room, participantId]);

  // Phase 6: Submit mined block
  const submitMinedBlock = useCallback(async (nonce: number, hash: string): Promise<{
    success: boolean;
    error?: string;
    code?: string;
    block?: Block;
    reward?: number;
  }> => {
    if (!room || !participantId) {
      return { success: false, error: 'No room or participant' };
    }

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-block',
          roomId: room.id,
          minerId: participantId,
          nonce,
          hash,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        return { 
          success: false, 
          error: data.error,
          code: data.code
        };
      }

      await fetchBlocks();
      await fetchRoom();
      return { success: true, block: data.block, reward: data.reward };
    } catch (err) {
      console.error('Submit block error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, participantId, fetchBlocks, fetchRoom]);

  // Phase 6: Create genesis block (teacher only)
  const createGenesisBlock = useCallback(async () => {
    if (!room) return;

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-genesis',
          roomId: room.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error('Create genesis error:', data.error);
        return;
      }

      await fetchBlocks();
    } catch (err) {
      console.error('Create genesis error:', err);
    }
  }, [room, fetchBlocks]);

  // Phase 6: Reset blockchain (teacher only)
  const resetBlockchain = useCallback(async () => {
    if (!room) return;

    try {
      await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          roomId: room.id,
        }),
      });

      await fetchBlocks();
      await fetchRoom();
    } catch (err) {
      console.error('Reset blockchain error:', err);
    }
  }, [room, fetchBlocks, fetchRoom]);

  // Phase 6: Toggle mining (pause/unpause)
  const toggleMining = useCallback(async () => {
    if (!room) return;

    try {
      await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-mining',
          roomId: room.id,
        }),
      });

      await fetchBlocks();
    } catch (err) {
      console.error('Toggle mining error:', err);
    }
  }, [room, fetchBlocks]);

  // Phase 7: Force difficulty adjustment (teacher only)
  const forceDifficultyAdjustment = useCallback(async (newDifficulty: number): Promise<{
    success: boolean;
    previousDifficulty?: number;
    newDifficulty?: number;
    error?: string;
  }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force-adjustment',
          roomId: room.id,
          newDifficulty,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }

      await fetchBlocks();
      await fetchRoom();
      return { 
        success: true, 
        previousDifficulty: data.previousDifficulty,
        newDifficulty: data.newDifficulty 
      };
    } catch (err) {
      console.error('Force difficulty adjustment error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchBlocks, fetchRoom]);

  // Phase 7: Update difficulty settings (teacher only)
  const updateDifficultySettings = useCallback(async (settings: {
    targetBlockTime?: number;
    adjustmentInterval?: number;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-settings',
          roomId: room.id,
          ...settings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }

      await fetchBlocks();
      await fetchRoom();
      return { success: true };
    } catch (err) {
      console.error('Update difficulty settings error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchBlocks, fetchRoom]);

  // Phase 7: Update rig settings per-participant (teacher only)
  const updateRigSettings = useCallback(async (targetParticipantId: string, settings: {
    maxRigs?: number;
    allowUpgrade?: boolean;
  }): Promise<void> => {
    if (!room) return;
    try {
      await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-rig-settings',
          roomId: room.id,
          participantId: targetParticipantId,
          ...settings,
        }),
      });
      await fetchRoom();
    } catch (err) {
      console.error('Update rig settings error:', err);
    }
  }, [room, fetchRoom]);

  // Phase 7: Batch hash update (auto-mining stats)
  const batchHashUpdate = useCallback(async (hashCount: number, activeRigs?: number): Promise<void> => {
    if (!room || !participantId) return;
    try {
      await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch-hash-update',
          roomId: room.id,
          minerId: participantId,
          hashCount,
          activeRigs,
        }),
      });
    } catch (err) {
      console.error('Batch hash update error:', err);
    }
  }, [room, participantId]);

  // Phase 7: Upgrade rig speed (student)
  const upgradeRig = useCallback(async (newSpeed: number): Promise<void> => {
    if (!room || !participantId) return;
    try {
      await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upgrade-rig',
          roomId: room.id,
          participantId,
          newSpeed,
        }),
      });
      await fetchRoom();
    } catch (err) {
      console.error('Upgrade rig error:', err);
    }
  }, [room, participantId, fetchRoom]);

  // Phase 7: Pool actions
  const createPool = useCallback(async (name: string): Promise<{ success: boolean; error?: string }> => {
    if (!room || !participantId) return { success: false, error: 'No room' };
    try {
      const res = await fetch(apiUrl('/api/pools'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-pool', roomId: room.id, name, creatorId: participantId }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      await fetchPools();
      await fetchRoom();
      return { success: true };
    } catch (err) {
      console.error('Create pool error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, participantId, fetchPools, fetchRoom]);

  const joinPool = useCallback(async (poolId: string): Promise<{ success: boolean; error?: string }> => {
    if (!room || !participantId) return { success: false, error: 'No room' };
    try {
      const res = await fetch(apiUrl('/api/pools'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join-pool', roomId: room.id, poolId, participantId }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      await fetchPools();
      await fetchRoom();
      return { success: true };
    } catch (err) {
      console.error('Join pool error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, participantId, fetchPools, fetchRoom]);

  const leavePool = useCallback(async (poolId: string): Promise<{ success: boolean; error?: string }> => {
    if (!room || !participantId) return { success: false, error: 'No room' };
    try {
      const res = await fetch(apiUrl('/api/pools'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave-pool', roomId: room.id, poolId, participantId }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      await fetchPools();
      await fetchRoom();
      return { success: true };
    } catch (err) {
      console.error('Leave pool error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, participantId, fetchPools, fetchRoom]);

  const deletePool = useCallback(async (poolId: string): Promise<{ success: boolean; error?: string }> => {
    if (!room) return { success: false, error: 'No room' };
    try {
      const res = await fetch(apiUrl('/api/pools'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-pool', roomId: room.id, poolId }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      await fetchPools();
      await fetchRoom();
      return { success: true };
    } catch (err) {
      console.error('Delete pool error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchPools, fetchRoom]);

  const togglePools = useCallback(async (enabled: boolean): Promise<{ success: boolean; error?: string }> => {
    if (!room) return { success: false, error: 'No room' };
    try {
      const res = await fetch(apiUrl('/api/pools'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-pools', roomId: room.id, enabled }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      await fetchPools();
      await fetchRoom();
      return { success: true };
    } catch (err) {
      console.error('Toggle pools error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchPools, fetchRoom]);

  // Phase 8: Select transactions for block (miner selects which txs to include)
  const selectTransactionsForBlock = useCallback(async (txIds: string[]): Promise<{
    success: boolean;
    totalFees?: number;
    error?: string;
  }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'select-transactions',
          roomId: room.id,
          txIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }

      await fetchBlocks();
      return { success: true, totalFees: data.totalFees };
    } catch (err) {
      console.error('Select transactions error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchBlocks]);

  // Phase 8: Force halving (teacher only)
  const forceHalving = useCallback(async (): Promise<{
    success: boolean;
    previousReward?: number;
    newReward?: number;
    error?: string;
  }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'force-halving',
          roomId: room.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }

      await fetchBlocks();
      await fetchRoom();
      return { 
        success: true, 
        previousReward: data.previousReward,
        newReward: data.newReward 
      };
    } catch (err) {
      console.error('Force halving error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchBlocks, fetchRoom]);

  // Phase 8: Update halving settings (teacher only)
  const updateHalvingSettings = useCallback(async (settings: {
    halvingInterval?: number;
    blockReward?: number;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-halving-settings',
          roomId: room.id,
          ...settings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }

      await fetchBlocks();
      await fetchRoom();
      return { success: true };
    } catch (err) {
      console.error('Update halving settings error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchBlocks, fetchRoom]);

  // Phase 8: Trigger auto-mine tick (system mines a block with top-fee txs)
  const autoMineTick = useCallback(async (): Promise<{
    success: boolean;
    includedTxCount?: number;
    totalFees?: number;
    halvingEvent?: { previousReward: number; newReward: number };
    error?: string;
  }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto-mine-tick',
          roomId: room.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }

      await fetchBlocks();
      await fetchMempoolTransactions();
      return {
        success: true,
        includedTxCount: data.includedTxCount,
        totalFees: data.totalFees,
        halvingEvent: data.halvingEvent,
      };
    } catch (err) {
      console.error('Auto-mine tick error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchBlocks, fetchMempoolTransactions]);

  // Phase 8: Update auto-mine settings (teacher only)
  const updatePhase8Settings = useCallback(async (settings: {
    autoMineInterval?: number;
    autoMineCapacity?: number;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/blocks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-phase8-settings',
          roomId: room.id,
          ...settings,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }

      await fetchBlocks();
      return { success: true };
    } catch (err) {
      console.error('Update Phase 8 settings error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchBlocks]);

  // Phase 9: Fetch addresses, UTXOs, mempool txs
  const fetchPhase9Data = useCallback(async () => {
    const rid = roomUuidRef.current;
    if (!rid) return;

    try {
      const res = await fetch(apiUrl(`/api/simulation?roomId=${rid}`));
      if (!res.ok) throw new Error('Failed to fetch Phase 9 data');
      const data = await res.json();
      setPhase9Addresses(data.addresses || []);
      setPhase9Utxos(data.utxos || []);
      setPhase9MempoolTxs(data.mempoolTxs || []);
    } catch (err) {
      console.error('Fetch Phase 9 data error:', err);
    }
  }, []);

  // Phase 9: Poll data
  useEffect(() => {
    if (!enabled || !room || room.currentPhase !== 9) return;

    fetchPhase9Data();
    fetchBlocks();

    const simPoll = setInterval(() => {
      fetchPhase9Data();
      fetchBlocks();
    }, 2500);

    return () => clearInterval(simPoll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.currentPhase, room?.id, enabled]);

  // Phase 9: Initialize (teacher)
  const initPhase9 = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/simulation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, action: 'init-phase9' }),
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      await fetchRoom();
      await fetchPhase9Data();
      await fetchBlocks();
      return { success: true };
    } catch (err) {
      console.error('Init Phase 9 error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchRoom, fetchPhase9Data, fetchBlocks]);

  // Phase 9: Reset (teacher)
  const resetPhase9 = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/simulation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, action: 'reset-phase9' }),
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      await fetchRoom();
      await fetchPhase9Data();
      setBlocks([]);
      return { success: true };
    } catch (err) {
      console.error('Reset Phase 9 error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchRoom, fetchPhase9Data]);

  // Phase 9: Fund all nodes (teacher) — gives 50 BTC to nodes without UTXOs
  const fundAllPhase9Nodes = useCallback(async (): Promise<{ success: boolean; funded?: number; error?: string }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/simulation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, action: 'fund-all-nodes' }),
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      await fetchPhase9Data();
      return { success: true, funded: data.funded };
    } catch (err) {
      console.error('Fund all nodes error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchPhase9Data]);

  // Phase 9: Generate new Bitcoin address (student)
  const generateAddress = useCallback(async (): Promise<{ success: boolean; address?: BitcoinAddress; error?: string }> => {
    if (!room || !participantId) return { success: false, error: 'No room or participant' };

    try {
      const res = await fetch(apiUrl('/api/simulation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, action: 'generate-address', participantId }),
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      await fetchPhase9Data();
      return { success: true, address: data.address };
    } catch (err) {
      console.error('Generate address error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, participantId, fetchPhase9Data]);

  // Phase 9: Create UTXO-based transaction with addresses
  const createPhase9Transaction = useCallback(async (
    inputUtxoIds: string[],
    outputs: { address: string; amount: number }[],
    fee: number
  ): Promise<{ success: boolean; changeAddress?: string; changeAmount?: number; burnedOutputs?: string[]; error?: string }> => {
    if (!room || !participantId) return { success: false, error: 'No room or participant' };

    try {
      const res = await fetch(apiUrl('/api/simulation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          action: 'create-transaction',
          participantId,
          inputUtxoIds,
          outputs,
          fee,
        }),
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      await fetchPhase9Data();
      return {
        success: true,
        changeAddress: data.changeAddress,
        changeAmount: data.changeAmount,
        burnedOutputs: data.burnedOutputs,
      };
    } catch (err) {
      console.error('Create Phase 9 transaction error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, participantId, fetchPhase9Data]);

  // Phase 9: Auto-mine tick (called by client timer)
  const autoMineTickPhase9 = useCallback(async (): Promise<{
    success: boolean;
    includedTxCount?: number;
    totalFees?: number;
    halvingEvent?: { previousReward: number; newReward: number };
    error?: string;
  }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/simulation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, action: 'auto-mine-tick' }),
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      if (data.skipped) return { success: false };

      await fetchPhase9Data();
      await fetchBlocks();
      return {
        success: true,
        includedTxCount: data.includedTxCount,
        totalFees: data.totalFees,
        halvingEvent: data.halvingEvent,
      };
    } catch (err) {
      console.error('Auto-mine tick Phase 9 error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchPhase9Data, fetchBlocks]);

  // Phase 9: Update auto-mine settings (teacher)
  const updatePhase9Settings = useCallback(async (settings: {
    autoMineInterval?: number;
    autoMineCapacity?: number;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!room) return { success: false, error: 'No room' };

    try {
      const res = await fetch(apiUrl('/api/simulation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, action: 'update-settings', ...settings }),
      });

      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };

      await fetchRoom();
      return { success: true };
    } catch (err) {
      console.error('Update Phase 9 settings error:', err);
      return { success: false, error: 'Network error' };
    }
  }, [room, fetchRoom]);

  // Update any participant's coin file (teacher editing balances)
  const updateParticipantCoinFile = useCallback(async (targetId: string, coinFile: string) => {
    try {
      await fetch(apiUrl(`/api/participants/${targetId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coinFile }),
      });
      await fetchRoom();
    } catch (err) {
      console.error('Update participant coin file error:', err);
    }
  }, [fetchRoom]);

  return {
    room,
    messages,
    utxos,
    utxoTransactions,
    // Phase 5
    mempoolTransactions,
    nodeConnections,
    // Phase 6, 7 & 8
    blocks,
    difficultyInfo,
    halvingInfo,
    economicStats,
    // Phase 9 (legacy — for old UI until rewritten)
    simulationStats,
    // Phase 9: Addresses & Pseudonymity
    phase9Addresses,
    phase9Utxos,
    phase9MempoolTxs,
    loading,
    error,
    sendTransaction,
    updateCoinFile,
    highlightTransaction,
    updatePhase,
    resetPhase,
    approveTransaction,
    rejectTransaction,
    changeBank,
    toggleBankDisconnection,
    updateTransferLimit,
    voteOnTransaction,
    forceTransaction,
    // Phase 3
    generateKeys,
    broadcastPublicKey,
    sendSignedMessage,
    sendFakeMessage,
    // Phase 4
    initializeUtxos,
    teacherSendUtxo,
    sendUtxoTransaction,
    // Phase 5
    initializeNetwork,
    createMempoolTransaction,
    toggleNodeDisconnection,
    fillMempool,
    createTeacherTransaction,
    destroyConnection,
    toggleStudentSending,
    // Phase 6 & 7
    createPendingBlock,
    createGenesisBlock,
    calculateMiningHash,
    submitMinedBlock,
    resetBlockchain,
    toggleMining,
    forceDifficultyAdjustment,
    updateDifficultySettings,
    updateRigSettings,
    batchHashUpdate,
    upgradeRig,
    // Phase 7: Mining pools
    miningPools,
    poolsEnabled,
    createPool,
    joinPool,
    leavePool,
    deletePool,
    togglePools,
    // Phase 8
    selectTransactionsForBlock,
    forceHalving,
    updateHalvingSettings,
    autoMineTick,
    updatePhase8Settings,
    autoMineSettings,
    // Phase 9: Addresses & Pseudonymity
    initPhase9,
    resetPhase9,
    fundAllPhase9Nodes,
    generateAddress,
    createPhase9Transaction,
    autoMineTickPhase9,
    updatePhase9Settings,
    updateParticipantCoinFile,
    refetch: fetchRoom,
  };
}
