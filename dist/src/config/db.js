"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userCollection = exports.db = exports.connectDB = exports.client = void 0;
const mongodb_1 = require("mongodb");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables. Prefer an existing .env.local if present, otherwise fall back to default .env
dotenv_1.default.config({ path: ".env.local" });
dotenv_1.default.config(); // second call is a no-op if already loaded; ensures fallback
// Support both naming conventions
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
    throw new Error("MongoDB connection string env var (MONGODB_URI or MONGO_URI) is not defined");
}
exports.client = new mongodb_1.MongoClient(uri, {
    serverApi: {
        version: mongodb_1.ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});
const connectDB = async () => {
    try {
        await exports.client.connect();
        console.log("MongoDB connected");
    }
    catch (err) {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
exports.db = exports.client.db("chatapp");
exports.userCollection = exports.db.collection("user");
//# sourceMappingURL=db.js.map