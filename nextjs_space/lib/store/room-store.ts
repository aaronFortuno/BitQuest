// Room & Participant store operations

import {
  RoomData,
  RoomState,
  ParticipantData,
  rooms,
  roomsById,
  genId,
  getRoomStateById,
  createRoomState,
} from './types';

export const roomStore = {
  // ---- Room ----
  createRoom(code: string): RoomState {
    const state = createRoomState(code);
    rooms.set(code, state);
    return state;
  },

  getRoom(code: string): RoomState | undefined {
    return rooms.get(code);
  },

  getRoomById(roomId: string): RoomState | undefined {
    return getRoomStateById(roomId);
  },

  getRoomCodeById(roomId: string): string | undefined {
    return roomsById.get(roomId);
  },

  updateRoom(roomId: string, data: Partial<RoomData>): RoomData | undefined {
    const state = getRoomStateById(roomId);
    if (!state) return undefined;
    Object.assign(state.room, data, { updatedAt: new Date() });
    return state.room;
  },

  deleteRoom(code: string): void {
    const state = rooms.get(code);
    if (state) {
      roomsById.delete(state.room.id);
      rooms.delete(code);
    }
  },

  // ---- Participant ----
  addParticipant(roomId: string, data: Partial<ParticipantData>): ParticipantData {
    const state = getRoomStateById(roomId);
    if (!state) throw new Error('Room not found');
    const now = new Date();
    const participant: ParticipantData = {
      id: genId(),
      name: data.name || '',
      role: data.role || 'student',
      isBank: data.isBank || false,
      roomId,
      coinFile: data.coinFile || '{"propietari":"","saldo":10}',
      socketId: data.socketId || null,
      isActive: data.isActive ?? true,
      publicKey: data.publicKey || null,
      privateKey: data.privateKey || null,
      createdAt: now,
      updatedAt: now,
      isNodeDisconnected: data.isNodeDisconnected || false,
      blocksMinedCount: data.blocksMinedCount || 0,
      totalMiningReward: data.totalMiningReward || 0,
      hashAttempts: data.hashAttempts || 0,
      activeRigs: data.activeRigs ?? 0,
      rigSpeed: data.rigSpeed || 4,
      maxRigs: data.maxRigs || 1,
      allowUpgrade: data.allowUpgrade || false,
      simulationRole: data.simulationRole || 'both',
      simulationBalance: data.simulationBalance ?? 100,
      totalEnergySpent: data.totalEnergySpent || 0,
      poolId: data.poolId ?? null,
    };
    state.participants.set(participant.id, participant);
    return participant;
  },

  getParticipant(id: string): ParticipantData | undefined {
    for (const state of rooms.values()) {
      const p = state.participants.get(id);
      if (p) return p;
    }
    return undefined;
  },

  getParticipantWithRoom(id: string): { participant: ParticipantData; roomState: RoomState } | undefined {
    for (const state of rooms.values()) {
      const p = state.participants.get(id);
      if (p) return { participant: p, roomState: state };
    }
    return undefined;
  },

  updateParticipant(id: string, data: Partial<ParticipantData>): ParticipantData | undefined {
    const found = this.getParticipantWithRoom(id);
    if (!found) return undefined;
    Object.assign(found.participant, data, { updatedAt: new Date() });
    return found.participant;
  },

  getParticipantsByRoom(roomId: string): ParticipantData[] {
    const state = getRoomStateById(roomId);
    if (!state) return [];
    return Array.from(state.participants.values());
  },
};
