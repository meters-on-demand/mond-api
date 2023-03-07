require("dotenv/config");

const fs = require("fs");
const { join } = require("path");

/* Connect to database and load models */
const mongoose = require("mongoose");
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("Connected to database"))
  .catch((error) => console.error(error));

process.on("beforeExit", () => mongoose.disconnect());

const models = join(__dirname, "models");
fs.readdirSync(models).forEach((file) => {
  require(join(models, file));
});

/* Initialize API and load routers */
const express = require("express");
const API = express();
API.use(express.json());

if (process.env.LOGGING)
  API.use((req, res, next) =>
    next(console.log("debug", req.originalUrl, req.body))
  );

const routes = join(__dirname, "routes");
fs.readdirSync(routes).forEach((file) => {
  API.use(require(join(routes, file)));
});

API.use(function (error, req, res, next) {
  console.error(error);
  return res.status(500).json({ message: error.message, error: true });
});

API.listen(process.env.PORT);
