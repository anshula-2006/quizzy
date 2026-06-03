import mongoose from "mongoose";
import { env } from "./env.js";

let connectionPromise = null;

export async function connectDatabase() {
  if (!env.mongoUri) {
    console.warn("MONGODB_URI is not set. Mongo-backed features are disabled.");
    return null;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.mongoUri).then((instance) => {
      console.log("MongoDB connected");
      return instance.connection;
    }).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }

  return connectionPromise;
}
