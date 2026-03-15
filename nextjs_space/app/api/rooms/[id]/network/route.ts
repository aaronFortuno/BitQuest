import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

// PATCH: Toggle Phase 5 network settings (studentSendingEnabled)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: roomId } = params;
    const { studentSendingEnabled } = await req.json();

    const updateData: Partial<{ studentSendingEnabled: boolean }> = {};
    if (studentSendingEnabled !== undefined) updateData.studentSendingEnabled = studentSendingEnabled;

    const room = store.updateRoom(roomId, updateData);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Error updating network settings:', error);
    return NextResponse.json({ error: 'Failed to update network settings' }, { status: 500 });
  }
}
