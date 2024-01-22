import "./helpers/startup.js";

const { LOGGING, PORT } = process.env;

import express from "express";
import cors from "cors";

const API = express();
API.use(express.json());
API.use(cors());

if (LOGGING)
  API.use((req, res, next) =>
    next(console.log(req.method, req.originalUrl, req.body || ""))
  );

import routes from "./routes/index.js";
await routes(API);

// Error handler
API.use(function (error, req, res, next) {
  console.error(error);
  res.status = 500;
  return res.json({ message: error.message || error, error: true });
});

// Query GitHub API once a day
import cron from "node-cron";
import { scrape, checkExisting } from "./helpers/scrapeSkins.js";
cron.schedule("42 02 * * *", () => scrape());
cron.schedule("32 18 * * *", () => checkExisting());

API.listen(PORT);
