import http from 'http';
import { Server } from 'socket.io';
import app, { attachSocket } from './app';

const port = process.env.PORT || 5000;

// Create HTTP server and bind Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  },
});
attachSocket(io);

server.listen(port, () => {
  console.log(`HTTP & Socket server listening: http://localhost:${port}`);
});