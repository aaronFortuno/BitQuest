import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';


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

// POST: Verify a message signature
export async function POST(request: NextRequest) {
  try {
    const { messageId, verifierId } = await request.json();

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 });
    }

    // Get the message
    const message = store.getSignedMessage(messageId);

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const sender = store.getParticipant(message.senderId);

    // For fake demo messages, the signature won't match
    let isValid = false;

    if (message.isFakeDemo) {
      isValid = false;
    } else if (sender?.privateKey) {
      const expectedHash = simpleHash(message.content);
      const expectedSignature = simpleSign(expectedHash, sender.privateKey);
      const hashMatches = message.messageHash === expectedHash;
      const signatureMatches = message.signature === expectedSignature;
      isValid = hashMatches && signatureMatches;
    }

    // Update message verification status
    store.updateSignedMessage(messageId, { isVerified: isValid });
    const updatedMessage = store.getSignedMessage(messageId)!;

    return NextResponse.json({
      message: {
        ...updatedMessage,
        sender: sender ? { id: sender.id, name: sender.name, publicKey: sender.publicKey } : null,
      },
      isValid,
      verifiedBy: verifierId
    });
  } catch (error) {
    console.error('Error verifying message:', error);
    return NextResponse.json({ error: 'Failed to verify message' }, { status: 500 });
  }
}
