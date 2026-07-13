require("dotenv").config();
const mongoose = require("mongoose");
const seedDatabase = require("./seed");

const connectDB = async () => {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGODB_URL ||
    process.env.db_url ||
    process.env.DB_URL ||
    "mongodb://localhost:27017/equipment";

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    await seedDatabase();
    console.log("MongoDB connected successfully");
    return true;
  } catch (error) {
    console.warn("MongoDB connection unavailable. Continuing without a database.");
    console.warn(`Reason: ${error.message}`);
    console.warn(
      "Install and start MongoDB locally or update your MongoDB connection string in the .env file."
    );
    return false;
  }
};

module.exports = connectDB;
