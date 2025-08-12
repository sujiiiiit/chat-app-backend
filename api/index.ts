import http from 'http';
import { Server, type Socket } from 'socket.io';
import app from '../src/app';
import { saveMessage, markMessagesSeen } from '../src/messages';
import { ObjectId } from 'mongodb';
import { createUser, getUserByUsername } from '../src/repos/users';
import { getOrCreateDirectConversation } from '../src/repos/conversations';

const port = process.env.PORT || 5000;

// Create HTTP server and bind Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  },
});

// Presence tracking (in-memory)
interface OnlineUser { userId: string; username: string; sockets: Set<string>; }
const onlineUsers = new Map<string, OnlineUser>(); // key: userId

function broadcastPresence() {
  const list = Array.from(onlineUsers.values()).map(u => ({ userId: u.userId, username: u.username }));
  io.emit('presence:users', list);
}

io.on('connection', (socket: Socket) => {
  console.log('Socket connected', socket.id);

  socket.on('user:online', async (payload: { username: string }, ack?: (user: any) => void) => {
    try {
      const user = await createUser(payload.username);
      socket.data.userId = user._id?.toString();
      socket.data.username = user.username;
      const entry = onlineUsers.get(user._id!.toString());
      if (entry) {
        entry.sockets.add(socket.id);
      } else {
        onlineUsers.set(user._id!.toString(), { userId: user._id!.toString(), username: user.username, sockets: new Set([socket.id]) });
      }
      broadcastPresence();
      ack && ack({ userId: user._id!.toString(), username: user.username });
    } catch (e) {
      console.error('user:online error', e);
      ack && ack(undefined);
    }
  });

  socket.on('join', (conversationId: string) => {
    socket.join(conversationId);
  });

  socket.on('conversation:direct', async (payload: { otherUsername: string }, ack?: (convo: any) => void) => {
    try {
      const meUsername: string | undefined = socket.data.username;
      if (!meUsername) return ack && ack(undefined);
      const me = await getUserByUsername(meUsername);
      const other = await getUserByUsername(payload.otherUsername);
      if (!me || !other) return ack && ack(undefined);
      const convo = await getOrCreateDirectConversation(me._id!, other._id!);
      // Join all sockets of both users to the conversation room (so both get messages even if only one initiated)
      const roomId = convo._id!.toString();
      socket.join(roomId);
      for (const [uid, info] of onlineUsers) {
        if ([me._id!.toString(), other._id!.toString()].includes(uid)) {
          for (const sid of info.sockets) {
            io.sockets.sockets.get(sid)?.join(roomId);
          }
        }
      }
      ack && ack({ _id: convo._id!.toString(), type: convo.type, memberIds: convo.memberIds.map(id=>id.toString()) });
    } catch (e) {
      console.error('conversation:direct error', e);
      ack && ack(undefined);
    }
  });

  socket.on('message:send', async (payload: { conversationId: string; senderId: string; text: string; clientMessageId?: string }) => {
    const { conversationId, senderId, text, clientMessageId } = payload;
    const convoObjId = ObjectId.isValid(conversationId) ? new ObjectId(conversationId) : undefined;
    const stored = await saveMessage(conversationId, senderId, text, convoObjId, clientMessageId);
    io.to(conversationId).emit('message:new', stored);
  });

  socket.on('messages:seen', async (payload: { conversationId: string }) => {
    try {
      const userId: string | undefined = socket.data.userId;
      if (!userId) return;
      if (!ObjectId.isValid(payload.conversationId)) return;
      const modified = await markMessagesSeen(new ObjectId(payload.conversationId), userId);
      if (modified) {
        io.to(payload.conversationId).emit('messages:seen', { conversationId: payload.conversationId, userId });
      }
    } catch (e) {
      console.error('messages:seen error', e);
    }
  });

  socket.on('typing', (data: { conversationId: string; userId: string; isTyping: boolean }) => {
    socket.to(data.conversationId).emit('typing', data);
  });

  socket.on('disconnect', () => {
    const userId: string | undefined = socket.data.userId;
    if (userId) {
      const entry = onlineUsers.get(userId);
      if (entry) {
        entry.sockets.delete(socket.id);
        if (entry.sockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }
      broadcastPresence();
    }
    console.log('Socket disconnected', socket.id);
  });
});

server.listen(port, () => {
  console.log(`HTTP & Socket server listening: http://localhost:${port}`);
});