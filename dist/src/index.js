"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const messages_1 = require("./messages");
const mongodb_1 = require("mongodb");
const users_1 = require("./repos/users");
const conversations_1 = require("./repos/conversations");
const port = process.env.PORT || 5000;
// Create HTTP server and bind Socket.IO
const server = http_1.default.createServer(app_1.default);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || '*',
        credentials: true,
    },
});
const onlineUsers = new Map(); // key: userId
function broadcastPresence() {
    const list = Array.from(onlineUsers.values()).map(u => ({ userId: u.userId, username: u.username }));
    io.emit('presence:users', list);
}
io.on('connection', (socket) => {
    console.log('Socket connected', socket.id);
    socket.on('user:online', async (payload, ack) => {
        try {
            const user = await (0, users_1.createUser)(payload.username);
            socket.data.userId = user._id?.toString();
            socket.data.username = user.username;
            const entry = onlineUsers.get(user._id.toString());
            if (entry) {
                entry.sockets.add(socket.id);
            }
            else {
                onlineUsers.set(user._id.toString(), { userId: user._id.toString(), username: user.username, sockets: new Set([socket.id]) });
            }
            broadcastPresence();
            ack && ack({ userId: user._id.toString(), username: user.username });
        }
        catch (e) {
            console.error('user:online error', e);
            ack && ack(undefined);
        }
    });
    socket.on('join', (conversationId) => {
        socket.join(conversationId);
    });
    socket.on('conversation:direct', async (payload, ack) => {
        try {
            const meUsername = socket.data.username;
            if (!meUsername)
                return ack && ack(undefined);
            const me = await (0, users_1.getUserByUsername)(meUsername);
            const other = await (0, users_1.getUserByUsername)(payload.otherUsername);
            if (!me || !other)
                return ack && ack(undefined);
            const convo = await (0, conversations_1.getOrCreateDirectConversation)(me._id, other._id);
            // Join all sockets of both users to the conversation room (so both get messages even if only one initiated)
            const roomId = convo._id.toString();
            socket.join(roomId);
            for (const [uid, info] of onlineUsers) {
                if ([me._id.toString(), other._id.toString()].includes(uid)) {
                    for (const sid of info.sockets) {
                        io.sockets.sockets.get(sid)?.join(roomId);
                    }
                }
            }
            ack && ack({ _id: convo._id.toString(), type: convo.type, memberIds: convo.memberIds.map(id => id.toString()) });
        }
        catch (e) {
            console.error('conversation:direct error', e);
            ack && ack(undefined);
        }
    });
    socket.on('message:send', async (payload) => {
        const { conversationId, senderId, text, clientMessageId } = payload;
        const convoObjId = mongodb_1.ObjectId.isValid(conversationId) ? new mongodb_1.ObjectId(conversationId) : undefined;
        const stored = await (0, messages_1.saveMessage)(conversationId, senderId, text, convoObjId, clientMessageId);
        io.to(conversationId).emit('message:new', stored);
    });
    socket.on('messages:seen', async (payload) => {
        try {
            const userId = socket.data.userId;
            if (!userId)
                return;
            if (!mongodb_1.ObjectId.isValid(payload.conversationId))
                return;
            const modified = await (0, messages_1.markMessagesSeen)(new mongodb_1.ObjectId(payload.conversationId), userId);
            if (modified) {
                io.to(payload.conversationId).emit('messages:seen', { conversationId: payload.conversationId, userId });
            }
        }
        catch (e) {
            console.error('messages:seen error', e);
        }
    });
    socket.on('typing', (data) => {
        socket.to(data.conversationId).emit('typing', data);
    });
    socket.on('disconnect', () => {
        const userId = socket.data.userId;
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
//# sourceMappingURL=index.js.map