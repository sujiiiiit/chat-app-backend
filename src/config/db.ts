import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

// Load environment variables. Prefer an existing .env.local if present, otherwise fall back to default .env
dotenv.config({ path: ".env.local" });
dotenv.config(); // second call is a no-op if already loaded; ensures fallback

// Support both naming conventions
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  throw new Error("MongoDB connection string env var (MONGODB_URI or MONGO_URI) is not defined");
}
export const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

export const connectDB = async () => {
  try {
    await client.connect();
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

export const db = client.db("chatapp");
export const userCollection = db.collection("user");
