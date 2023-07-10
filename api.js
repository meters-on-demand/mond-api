import "./helpers/startup.js";

const { LOGGING, PORT } = process.env;

import express from "express";
import cors from "cors";

import SkinsRouter from "./routes/skins.js";
import WebhookRouter from "./routes/webhooks.js";

const API = express();
API.use(express.json());
API.use(cors());

if (LOGGING)
  API.use((req, res, next) =>
    next(console.log(req.method, req.originalUrl, req.body))
  );

// Use routers
API.use(SkinsRouter);
API.use(WebhookRouter);

// Error handler
API.use(function (error, req, res, next) {
  console.error(error);
  res.status = 500;
  return res.json({ message: error.message, error: true });
});

// Query GitHub API once a day
import cron from "node-cron";
import { scrape } from "./helpers/scrapeSkins.js";
cron.schedule("45 23 * * *", () => scrape());

API.listen(PORT);
