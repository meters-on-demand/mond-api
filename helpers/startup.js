require("dotenv/config");

const { MONGO_URL } = process.env;

/* Connect to database and load models */
const mongoose = require("mongoose");
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("Connected to database"))
  .catch((error) => console.error(error));

process.on("beforeExit", () => mongoose.disconnect());