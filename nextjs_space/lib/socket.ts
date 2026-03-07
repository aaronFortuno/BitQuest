'use client';

import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(API_URL || window.location.origin, {
      path: '/api/socketio',
      addTrailingSlash: false,
    });
  }
  return socket;
};

export const joinRoom = (roomCode: string) => {
  getSocket().emit('join-room', roomCode);
};

export const leaveRoom = (roomCode: string) => {
  getSocket().emit('leave-room', roomCode);
};

export const onRoomUpdate = (callback: () => void): (() => void) => {
  getSocket().on('room:update', callback);
  return () => {
    getSocket().off('room:update', callback);
  };
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
