import { db } from '../config/db';
import { ObjectId, WithId } from 'mongodb';

export type ConversationType = 'direct' | 'group';

export interface Conversation {
  _id?: ObjectId;
  type: ConversationType;
  memberIds: ObjectId[]; // users
  participantsKey?: string; // sorted member ids joined for uniqueness in direct chats
  title?: string; // for groups
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
}

const conversations = db.collection<Conversation>('conversations');

export async function ensureConversationIndexes() {
  // Drop legacy problematic unique index on (memberIds,type) if it exists (causes multi-key uniqueness collisions)
  try {
    const existing = await conversations.indexes();
    const legacy = existing.find(i => i.key && i.key.memberIds === 1 && i.key.type === 1);
    if (legacy) {
  await conversations.dropIndex(legacy.name as string);
      console.log('[conversations] Dropped legacy index', legacy.name);
    }
  } catch (e) {
    console.warn('[conversations] Failed checking/dropping legacy index', e);
  }
  // Ensure non-unique supporting indexes
  await conversations.createIndex({ memberIds: 1 }).catch(()=>{});
  await conversations.createIndex({ updatedAt: -1 }).catch(()=>{});
  // Unique direct conversation key independent of member array order
  await conversations.createIndex({ participantsKey: 1 }, { unique: true, partialFilterExpression: { type: 'direct' } }).catch(()=>{});
}

export async function getOrCreateDirectConversation(a: ObjectId, b: ObjectId) {
  const members = [a, b].sort((x,y)=> x.toString().localeCompare(y.toString()));
  const key = members.map(m=>m.toString()).join(':');
  const existing = await conversations.findOne({ type: 'direct', participantsKey: key });
  if (existing) return existing as WithId<Conversation>;
  try {
    const doc: Conversation = { type: 'direct', memberIds: members, participantsKey: key, createdAt: new Date(), updatedAt: new Date() };
    const { insertedId } = await conversations.insertOne(doc);
    return { ...doc, _id: insertedId } as WithId<Conversation>;
  } catch (e: any) {
    if (e.code === 11000) {
      const retry = await conversations.findOne({ type: 'direct', participantsKey: key });
      if (retry) return retry as WithId<Conversation>;
    }
    throw e;
  }
}

export async function createGroupConversation(memberIds: ObjectId[], title: string) {
  const doc: Conversation = { type: 'group', memberIds, title, createdAt: new Date(), updatedAt: new Date() };
  const { insertedId } = await conversations.insertOne(doc);
  return { ...doc, _id: insertedId } as WithId<Conversation>;
}

export async function listUserConversations(userId: ObjectId) {
  return conversations.find({ memberIds: userId }).sort({ updatedAt: -1 }).toArray();
}
