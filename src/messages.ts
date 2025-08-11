import { db } from './config/db';
import { ObjectId, WithId } from 'mongodb';

export interface ChatMessage {
  _id?: ObjectId;
  roomId: string; // deprecated; for backward compatibility
  conversationId?: ObjectId; // new multi-room identifier
  senderId: string; // user _id as string
  text: string;
  createdAt: Date;
  deliveredTo?: string[]; // userIds who received
  seenBy?: string[]; // userIds who saw
  clientMessageId?: string; // from client for optimistic reconciliation
}

const collection = db.collection<ChatMessage>('messages');

export async function saveMessage(roomId: string, senderId: string, text: string, conversationId?: ObjectId, clientMessageId?: string): Promise<WithId<ChatMessage>> {
  const doc: ChatMessage = { roomId, senderId, text, createdAt: new Date(), conversationId, deliveredTo: [senderId], seenBy: [], clientMessageId };
  const { insertedId } = await collection.insertOne(doc);
  return { ...doc, _id: insertedId } as WithId<ChatMessage>;
}

export async function getRecentMessages(roomOrConversationId: string, limit = 50): Promise<WithId<ChatMessage>[]> {
  const query = ObjectId.isValid(roomOrConversationId)
    ? { conversationId: new ObjectId(roomOrConversationId) }
    : { roomId: roomOrConversationId };
  return collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function markMessagesSeen(conversationObjectId: ObjectId, viewerId: string) {
  // Add viewerId to seenBy (only for messages they did NOT send) and also to deliveredTo for basic delivery tracking
  const res = await collection.updateMany(
    { conversationId: conversationObjectId, senderId: { $ne: viewerId }, seenBy: { $ne: viewerId } },
    { $addToSet: { seenBy: viewerId, deliveredTo: viewerId } }
  );
  return res.modifiedCount; // count of messages updated
}

export async function addDelivered(conversationObjectId: ObjectId, receiverIds: string[]) {
  if (!receiverIds.length) return;
  await collection.updateMany({ conversationId: conversationObjectId }, { $addToSet: { deliveredTo: { $each: receiverIds } } });
}

// Count unread messages per conversation for a given user
export async function aggregateUnreadCountsForUser(userId: string) {
  const pipeline = [
    { $match: { senderId: { $ne: userId }, seenBy: { $ne: userId } } },
    { $group: { _id: '$conversationId', count: { $sum: 1 } } }
  ];
  const rows = await collection.aggregate(pipeline).toArray();
  return rows.filter(r => r._id).map(r => ({ conversationId: r._id.toString(), count: r.count }));
}
