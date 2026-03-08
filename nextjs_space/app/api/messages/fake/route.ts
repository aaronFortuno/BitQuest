import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { broadcastRoomUpdate } from '@/lib/io';
import { miniHash } from '@/lib/crypto';

// Generate a random fake signature (will fail verification)
function randomSignature(): string {
  return Math.floor(Math.random() * 99999).toString();
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
    const { hash: messageHash } = miniHash(content);
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
