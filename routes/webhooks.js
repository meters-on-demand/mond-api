import express from "express";

import { handleRepo } from "../helpers/scrapeSkins.js";
import OctoClient from "../helpers/octokit.js";

const Router = express.Router();

Router.post("/webhooks/github", async function (req, res, next) {
  const { body: payload } = req;

  const isRelease = ["released", "edited"].includes(payload.action);
  const isPing = !!payload?.hook;

  const full_name = payload?.repository?.full_name;
  const [owner, repo] = full_name.split("/");

  if (isRelease || isPing) {
    if (!full_name)
      throw Error("payload.repository does not contain full_name");

    const { data } = await OctoClient.rest.repos.get({ owner, repo });
    await handleRepo(data);
  }

  return res.end("OK");
});

export default Router;
