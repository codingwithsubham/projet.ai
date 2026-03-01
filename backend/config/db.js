const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable not set");

  try {
    await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB || undefined,
    });
    console.log("✅ Connected to MongoDB.");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB", err);
    throw err;
  }
}

async function closeDB() {
  await mongoose.connection.close();
  console.log("❌ MongoDB connection closed");
}

module.exports = { connectDB, closeDB, mongoose };