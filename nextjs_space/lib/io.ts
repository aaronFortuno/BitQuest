import type { Server as SocketIOServer } from 'socket.io';
import { monitor } from './server-monitor';

// Persist across HMR reloads
const globalForIO = globalThis as unknown as {
  __bitquest_io?: SocketIOServer | null;
};

let io: SocketIOServer | null = globalForIO.__bitquest_io ?? null;

export function initIO(server: SocketIOServer) {
  io = server;
  if (process.env.NODE_ENV !== 'production') {
    globalForIO.__bitquest_io = server;
  }
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function broadcastRoomUpdate(roomCode: string) {
  if (io) {
    monitor.incrementBroadcasts();
    io.to(`room:${roomCode}`).emit('room:update');
  }
}
