import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

// POST: Create a new signed message (hash and signature computed client-side)
export async function POST(request: NextRequest) {
  try {
    const { roomId, senderId, content, messageHash, signature } = await request.json();

    if (!roomId || !senderId || !content || !messageHash || !signature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const sender = store.getParticipant(senderId);

    if (!sender) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }

    if (!sender.publicKey) {
      return NextResponse.json({ error: 'Keys not generated' }, { status: 400 });
    }

    // Server is a simple relay: store the message as received
    const message = store.createSignedMessage(roomId, {
      senderId,
      content,
      messageHash,
      signature,
      claimedBy: sender.name,
    });

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
