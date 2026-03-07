import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';


// Simple hash function for educational purposes
function simpleHash(message: string): string {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').substring(0, 6);
  return hexHash;
}

// Simple signature function
function simpleSign(messageHash: string, privateKey: string): string {
  const combined = messageHash + privateKey;
  let sig = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    sig = ((sig << 3) - sig) + char;
    sig = sig & sig;
  }
  return Math.abs(sig).toString(16).toUpperCase().padStart(6, '0').substring(0, 6);
}

// POST: Create a new signed message
export async function POST(request: NextRequest) {
  try {
    const { roomId, senderId, content } = await request.json();

    if (!roomId || !senderId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get sender's keys
    const sender = store.getParticipant(senderId);

    if (!sender) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }

    if (!sender.publicKey || !sender.privateKey) {
      return NextResponse.json({ error: 'Keys not generated' }, { status: 400 });
    }

    // Calculate hash and signature
    const messageHash = simpleHash(content);
    const signature = simpleSign(messageHash, sender.privateKey);

    // Create signed message
    const message = store.createSignedMessage(roomId, {
      senderId,
      content,
      messageHash,
      signature,
      claimedBy: sender.name,
    });

    const roomCode = store.getRoomCodeById(roomId);
    if (roomCode) broadcastRoomUpdate(roomCode);
    return NextResponse.json({
      ...message,
      sender: { id: sender.id, name: sender.name, publicKey: sender.publicKey },
    });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}

// GET: Get all messages for a room
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
    }

    const messages = store.getSignedMessagesByRoom(roomId)
      .map(msg => {
        const sender = store.getParticipant(msg.senderId);
        return {
          ...msg,
          sender: sender ? { id: sender.id, name: sender.name, publicKey: sender.publicKey } : null,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
