import { db } from '../config/db';
import { ObjectId, WithId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  username: string; // unique handle
  displayName?: string;
  createdAt: Date;
}

const users = db.collection<User>('users');

export async function ensureUserIndexes() {
  await users.createIndex({ username: 1 }, { unique: true });
}

export async function createUser(username: string, displayName?: string): Promise<WithId<User>> {
  // First quick check (fast path)
  const existing = await users.findOne({ username });
  if (existing) return existing as WithId<User>;
  const doc: User = { username, displayName, createdAt: new Date() };
  try {
    const { insertedId } = await users.insertOne(doc);
    return { ...doc, _id: insertedId } as WithId<User>;
  } catch (e: any) {
    // Handle race: another request inserted same username between findOne and insert
    if (e.code === 11000) {
      const retry = await users.findOne({ username });
      if (retry) return retry as WithId<User>;
    }
    throw e;
  }
}

export async function getUserByUsername(username: string) {
  return users.findOne({ username });
}

export async function getUsersByIds(ids: ObjectId[]) {
  return users.find({ _id: { $in: ids } }).toArray();
}

export async function listAllUsers() {
  return users.find({}).sort({ createdAt: 1 }).toArray();
}
