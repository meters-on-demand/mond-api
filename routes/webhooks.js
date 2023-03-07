const express = require("express");
const Router = express.Router();

// https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads
// TODO: handle payload.action == ping
// TODO: handle payload.action == release

Router.post("/webhooks/github", async function (req, res, next) {
  const { body: payload } = req;

  console.log(payload.action);
  console.log(payload.repository);
  console.log(payload.release);
});

module.exports = Router;
