// Cryptographic keys & signed messages store operations

import {
  SignedMessageData,
  rooms,
  genId,
  getRoomStateById,
} from './types';

export const cryptoStore = {
  // ---- SignedMessage ----
  createSignedMessage(roomId: string, data: Partial<SignedMessageData>): SignedMessageData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const msg: SignedMessageData = {
      id: genId(),
      roomId,
      senderId: data.senderId || '',
      content: data.content || '',
      messageHash: data.messageHash || '',
      signature: data.signature || '',
      claimedBy: data.claimedBy || null,
      isFakeDemo: data.isFakeDemo || false,
      createdAt: new Date(),
    };
    state.signedMessages.set(msg.id, msg);
    return msg;
  },

  getSignedMessage(id: string): SignedMessageData | undefined {
    for (const state of rooms.values()) {
      const m = state.signedMessages.get(id);
      if (m) return m;
    }
    return undefined;
  },

  updateSignedMessage(id: string, data: Partial<SignedMessageData>): SignedMessageData | undefined {
    const msg = this.getSignedMessage(id);
    if (!msg) return undefined;
    Object.assign(msg, data);
    return msg;
  },

  getSignedMessagesByRoom(roomId: string): SignedMessageData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.signedMessages.values());
  },
};
