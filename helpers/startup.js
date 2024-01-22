import "dotenv/config";
const { MONGO_URL } = process.env;

import mongoose from "mongoose";

await mongoose.connect(MONGO_URL).catch(console.error);
console.log("Connected to the database");

process.on("beforeExit", () => mongoose.disconnect());

// Load models
import "../models/Skin.js";
