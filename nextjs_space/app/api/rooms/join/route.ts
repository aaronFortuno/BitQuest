import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { createInitialCoinFile } from '@/lib/room-utils';
import { broadcastRoomUpdate } from '@/lib/io';


export async function POST(req: NextRequest) {
  try {
    const { code, studentName } = await req.json();

    if (!code?.trim() || !studentName?.trim()) {
      return NextResponse.json({ error: 'Room code and name are required' }, { status: 400 });
    }

    const formattedCode = code.toUpperCase().replace(/[^A-Z0-9-]/g, '');

    const state = store.getRoom(formattedCode);

    if (!state) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check participant limit (30 max)
    const activeParticipants = Array.from(state.participants.values()).filter(p => p.isActive);
    if (activeParticipants.length >= 30) {
      return NextResponse.json({ error: 'Room is full' }, { status: 400 });
    }

    // Create new participant
    const participant = store.addParticipant(state.room.id, {
      name: studentName.trim(),
      role: 'student',
      coinFile: createInitialCoinFile(studentName.trim()),
      isActive: true,
    });

    // Auto-connect to network if Phase 5 connections already exist
    const existingConnections = store.getNodeConnectionsByRoom(state.room.id);
    if (existingConnections.filter(c => c.isActive).length > 0) {
      // Find 2-3 random active students (not self) with fewer than 3 connections
      const otherStudents = Array.from(state.participants.values())
        .filter(p => p.isActive && p.role === 'student' && p.id !== participant.id && !p.isNodeDisconnected);

      const shuffled = otherStudents.sort(() => Math.random() - 0.5);
      const targetConns = 2 + (Math.random() > 0.5 ? 1 : 0); // 2 or 3
      let connected = 0;

      for (const peer of shuffled) {
        if (connected >= targetConns) break;
        const peerConns = store.getActiveConnectionsForNode(peer.id, state.room.id);
        if (peerConns.length < 4) { // allow connecting even if peer has 3
          store.createNodeConnection(state.room.id, {
            nodeAId: participant.id,
            nodeBId: peer.id,
            isActive: true,
          });
          connected++;
        }
      }
    }

    // Build updated room response
    const participants = Array.from(state.participants.values())
      .filter(p => p.isActive)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const transactions = Array.from(state.transactions.values())
      .map(tx => ({
        ...tx,
        sender: state.participants.get(tx.senderId) || null,
        receiver: state.participants.get(tx.receiverId) || null,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const updatedRoom = {
      ...state.room,
      participants,
      transactions,
    };

    broadcastRoomUpdate(formattedCode);
    return NextResponse.json({ room: updatedRoom, participantId: participant.id });
  } catch (error) {
    console.error('Error joining room:', error);
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}
