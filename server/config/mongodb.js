import mongoose from "mongoose";

let connectionPromise;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not configured");

  connectionPromise = mongoose.connect(uri, {
    // Bound per-function pools when Vercel scales out concurrent instances.
    maxPoolSize: 10,
    minPoolSize: 0,
    // Fail clearly during an outage instead of leaving API requests pending.
    serverSelectionTimeoutMS: 10000,
  }).then(() => {
    console.log("Database connected");
    return mongoose.connection;
  }).catch((error) => {
    connectionPromise = null;
    console.log("Database connection failed: ", error.message);
    throw error;
  });

  return connectionPromise;
};

export default connectDB;
