"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUserIndexes = ensureUserIndexes;
exports.createUser = createUser;
exports.getUserByUsername = getUserByUsername;
exports.getUsersByIds = getUsersByIds;
exports.listAllUsers = listAllUsers;
const db_1 = require("../config/db");
const users = db_1.db.collection('users');
async function ensureUserIndexes() {
    await users.createIndex({ username: 1 }, { unique: true });
}
async function createUser(username, displayName) {
    // First quick check (fast path)
    const existing = await users.findOne({ username });
    if (existing)
        return existing;
    const doc = { username, displayName, createdAt: new Date() };
    try {
        const { insertedId } = await users.insertOne(doc);
        return { ...doc, _id: insertedId };
    }
    catch (e) {
        // Handle race: another request inserted same username between findOne and insert
        if (e.code === 11000) {
            const retry = await users.findOne({ username });
            if (retry)
                return retry;
        }
        throw e;
    }
}
async function getUserByUsername(username) {
    return users.findOne({ username });
}
async function getUsersByIds(ids) {
    return users.find({ _id: { $in: ids } }).toArray();
}
async function listAllUsers() {
    return users.find({}).sort({ createdAt: 1 }).toArray();
}
//# sourceMappingURL=users.js.map