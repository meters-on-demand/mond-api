import "dotenv/config";
const { MONGO_URL } = process.env;

// Connect mongoose
import mongoose from "mongoose";
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("Connected to database"))
  .catch((error) => console.error(error));

process.on("beforeExit", () => mongoose.disconnect());

// Load models
import "../models/Skin.js";
