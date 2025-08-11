"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveMessage = saveMessage;
exports.getRecentMessages = getRecentMessages;
exports.markMessagesSeen = markMessagesSeen;
exports.addDelivered = addDelivered;
exports.aggregateUnreadCountsForUser = aggregateUnreadCountsForUser;
const db_1 = require("./config/db");
const mongodb_1 = require("mongodb");
const collection = db_1.db.collection('messages');
async function saveMessage(roomId, senderId, text, conversationId, clientMessageId) {
    const doc = { roomId, senderId, text, createdAt: new Date(), conversationId, deliveredTo: [senderId], seenBy: [], clientMessageId };
    const { insertedId } = await collection.insertOne(doc);
    return { ...doc, _id: insertedId };
}
async function getRecentMessages(roomOrConversationId, limit = 50) {
    const query = mongodb_1.ObjectId.isValid(roomOrConversationId)
        ? { conversationId: new mongodb_1.ObjectId(roomOrConversationId) }
        : { roomId: roomOrConversationId };
    return collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}
async function markMessagesSeen(conversationObjectId, viewerId) {
    // Add viewerId to seenBy (only for messages they did NOT send) and also to deliveredTo for basic delivery tracking
    const res = await collection.updateMany({ conversationId: conversationObjectId, senderId: { $ne: viewerId }, seenBy: { $ne: viewerId } }, { $addToSet: { seenBy: viewerId, deliveredTo: viewerId } });
    return res.modifiedCount; // count of messages updated
}
async function addDelivered(conversationObjectId, receiverIds) {
    if (!receiverIds.length)
        return;
    await collection.updateMany({ conversationId: conversationObjectId }, { $addToSet: { deliveredTo: { $each: receiverIds } } });
}
// Count unread messages per conversation for a given user
async function aggregateUnreadCountsForUser(userId) {
    const pipeline = [
        { $match: { senderId: { $ne: userId }, seenBy: { $ne: userId } } },
        { $group: { _id: '$conversationId', count: { $sum: 1 } } }
    ];
    const rows = await collection.aggregate(pipeline).toArray();
    return rows.filter(r => r._id).map(r => ({ conversationId: r._id.toString(), count: r.count }));
}
//# sourceMappingURL=messages.js.map