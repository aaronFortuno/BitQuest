import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { initIO } from './lib/io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    // Skip Socket.io requests — they are handled by Socket.io's own middleware
    if (req.url?.startsWith('/api/socketio')) {
      return;
    }
    handle(req, res);
  });

  const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    cors: {
      origin: CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
  });

  // Store IO instance globally for API routes to use
  initIO(io);

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('join-room', (roomCode: string) => {
      socket.join(`room:${roomCode}`);
      console.log(`[Socket.io] ${socket.id} joined room:${roomCode}`);
    });

    socket.on('leave-room', (roomCode: string) => {
      socket.leave(`room:${roomCode}`);
      console.log(`[Socket.io] ${socket.id} left room:${roomCode}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io listening on path /api/socketio`);
  });
});
