import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db";
import { getRecentMessages, aggregateUnreadCountsForUser } from './messages';
import { ensureUserIndexes, createUser, getUserByUsername, getUsersByIds, listAllUsers } from './repos/users';
import { ensureConversationIndexes, getOrCreateDirectConversation, createGroupConversation, listUserConversations } from './repos/conversations';
import { ObjectId } from 'mongodb';



dotenv.config();
connectDB().then(()=>{
  // initialize indexes (fire and forget)
  ensureUserIndexes();
  ensureConversationIndexes();
});

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: (origin, cb) => {
    const allowed = process.env.CLIENT_URL ? [process.env.CLIENT_URL] : ['http://localhost:5173', 'http://127.0.0.1:5173'];
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'));
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: "Content-Type,Authorization",
  credentials: true,
}));



// Simple health route
app.get('/health', (_req, res) => res.json({ ok: true }));

// Chat messages retrieval (roomId or conversationId)
app.get('/api/rooms/:id/messages', async (req, res) => {
  try {
    const messages = await getRecentMessages(req.params.id, Number(req.query.limit) || 50);
    res.json(messages.reverse());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Create or fetch user
app.post('/api/users', async (req, res) => {
  try {
    const { username, displayName } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const user = await createUser(username, displayName);
    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Bulk fetch users by ids: /api/users?ids=id1,id2
app.get('/api/users', async (req, res) => {
  try {
    const idsParam = req.query.ids as string | undefined;
    if (!idsParam) return res.status(400).json({ error: 'ids query param required' });
    const ids = idsParam.split(',').filter(Boolean);
    const objectIds = ids.map(id => new ObjectId(id)).filter(oid => ObjectId.isValid(oid.toString()));
    if (!objectIds.length) return res.json([]);
    const users = await getUsersByIds(objectIds);
    res.json(users.map(u => ({ _id: u._id, username: u.username, displayName: u.displayName })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// List all users (for directory / starting chats with offline users)
app.get('/api/users-all', async (_req, res) => {
  try {
    const all = await listAllUsers();
    res.json(all.map(u => ({ _id: u._id, username: u.username, displayName: u.displayName })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Get direct conversation with another user (by username)
app.post('/api/conversations/direct', async (req, res) => {
  try {
    const { me, other } = req.body; // usernames
    if (!me || !other) return res.status(400).json({ error: 'me & other required' });
    const meUser = await getUserByUsername(me);
    const otherUser = await getUserByUsername(other);
    if (!meUser || !otherUser) return res.status(404).json({ error: 'user not found' });
    const convo = await getOrCreateDirectConversation(meUser._id!, otherUser._id!);
    res.json(convo);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get direct conversation' });
  }
});

// Create group conversation
app.post('/api/conversations/group', async (req, res) => {
  try {
    const { memberIds, title } = req.body; // memberIds: string[] of user _ids
    if (!Array.isArray(memberIds) || memberIds.length < 2) return res.status(400).json({ error: 'memberIds >=2 required' });
    const objectIds = memberIds.map((id: string) => new ObjectId(id));
    const convo = await createGroupConversation(objectIds, title || 'Group');
    res.json(convo);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// List conversations for user
app.get('/api/users/:userId/conversations', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!ObjectId.isValid(userId)) return res.status(400).json({ error: 'invalid userId' });
    const convos = await listUserConversations(new ObjectId(userId));
    res.json(convos);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// Unread counts for user
app.get('/api/users/:userId/unread-counts', async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!ObjectId.isValid(userId)) return res.status(400).json({ error: 'invalid userId' });
    const counts = await aggregateUnreadCountsForUser(userId);
    res.json(counts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get unread counts' });
  }
});





export default app;