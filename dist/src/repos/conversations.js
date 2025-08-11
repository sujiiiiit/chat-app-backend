"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureConversationIndexes = ensureConversationIndexes;
exports.getOrCreateDirectConversation = getOrCreateDirectConversation;
exports.createGroupConversation = createGroupConversation;
exports.listUserConversations = listUserConversations;
const db_1 = require("../config/db");
const conversations = db_1.db.collection('conversations');
async function ensureConversationIndexes() {
    // Drop legacy problematic unique index on (memberIds,type) if it exists (causes multi-key uniqueness collisions)
    try {
        const existing = await conversations.indexes();
        const legacy = existing.find(i => i.key && i.key.memberIds === 1 && i.key.type === 1);
        if (legacy) {
            await conversations.dropIndex(legacy.name);
            console.log('[conversations] Dropped legacy index', legacy.name);
        }
    }
    catch (e) {
        console.warn('[conversations] Failed checking/dropping legacy index', e);
    }
    // Ensure non-unique supporting indexes
    await conversations.createIndex({ memberIds: 1 }).catch(() => { });
    await conversations.createIndex({ updatedAt: -1 }).catch(() => { });
    // Unique direct conversation key independent of member array order
    await conversations.createIndex({ participantsKey: 1 }, { unique: true, partialFilterExpression: { type: 'direct' } }).catch(() => { });
}
async function getOrCreateDirectConversation(a, b) {
    const members = [a, b].sort((x, y) => x.toString().localeCompare(y.toString()));
    const key = members.map(m => m.toString()).join(':');
    const existing = await conversations.findOne({ type: 'direct', participantsKey: key });
    if (existing)
        return existing;
    try {
        const doc = { type: 'direct', memberIds: members, participantsKey: key, createdAt: new Date(), updatedAt: new Date() };
        const { insertedId } = await conversations.insertOne(doc);
        return { ...doc, _id: insertedId };
    }
    catch (e) {
        if (e.code === 11000) {
            const retry = await conversations.findOne({ type: 'direct', participantsKey: key });
            if (retry)
                return retry;
        }
        throw e;
    }
}
async function createGroupConversation(memberIds, title) {
    const doc = { type: 'group', memberIds, title, createdAt: new Date(), updatedAt: new Date() };
    const { insertedId } = await conversations.insertOne(doc);
    return { ...doc, _id: insertedId };
}
async function listUserConversations(userId) {
    return conversations.find({ memberIds: userId }).sort({ updatedAt: -1 }).toArray();
}
//# sourceMappingURL=conversations.js.map