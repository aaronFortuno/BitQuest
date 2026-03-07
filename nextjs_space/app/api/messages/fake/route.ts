import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';


// Simple hash function
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

// Generate a random fake signature
function randomSignature(): string {
  return Math.random().toString(16).substring(2, 8).toUpperCase();
}

// POST: Create a fake demo message (teacher only)
export async function POST(request: NextRequest) {
  try {
    const { roomId, teacherId, content, claimedBy } = await request.json();

    if (!roomId || !teacherId || !content || !claimedBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify sender is a teacher
    const teacher = store.getParticipant(teacherId);

    if (!teacher || teacher.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can send fake demo messages' }, { status: 403 });
    }

    // Calculate hash but use a random (invalid) signature
    const messageHash = simpleHash(content);
    const fakeSignature = randomSignature();

    // Create fake demo message
    const message = store.createSignedMessage(roomId, {
      senderId: teacherId,
      content,
      messageHash,
      signature: fakeSignature,
      claimedBy,
      isFakeDemo: true,
    });

    const roomCode = store.getRoomCodeById(roomId);
    if (roomCode) broadcastRoomUpdate(roomCode);
    return NextResponse.json({
      ...message,
      sender: { id: teacher.id, name: teacher.name, publicKey: teacher.publicKey },
    });
  } catch (error) {
    console.error('Error creating fake message:', error);
    return NextResponse.json({ error: 'Failed to create fake message' }, { status: 500 });
  }
}
