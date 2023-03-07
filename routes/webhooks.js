const express = require("express");
const Router = express.Router();

// Models
const mongoose = require("mongoose");
const Skin = mongoose.model("skin");

// Dependencies
const ini = require("ini");
const axios = require("axios").create({ baseURL: "https://api.github.com" });
const headers = (raw = false) => ({
  Accept: `application/vnd.github${raw ? ".raw" : "+json"}`,
  Authentication: `Bearer ${process.env.GITHUB_PAT}`,
  "X-GitHub-Api-Version": "2022-11-28",
});

// MonD.inc options to Skin schema paths
const incOptionToSkinPath = {
  SkinName: "skin_name",
  Author: "owner.name",
  ProfilePicture: "owner.avatar_url",
  Description: "description",
};

Router.post("/webhooks/github", async function (req, res, next) {
  const { body: payload } = req;

  switch (payload.action) {
    case "ping": {
      const updatedSkin = await updateSkin(payload);
      const latestRelease = await updateRelease(payload);
      return res.json({ updatedSkin, latestRelease });
    }
    case "released": {
      console.log(payload.release);
    }
    default: {
      console.log(payload.action);
    }
  }
});

async function updateSkin(payload) {
  const { repository } = payload;
  const { full_name } = repository;
  const {
    owner: { login, avatar_url },
  } = repository;

  // Get MonD.inc
  const inc = await getMondInc(full_name);
  // Get the override values from MonD.inc
  const overrides = incOverrides(inc);

  if (!overrides.skin_name) throw Error("MonD.inc did not contain SkinName");

  // Update or upsert skin with new info
  await Skin.findOneAndUpdate(
    { full_name },
    { ...repository, owner: { name: login, avatar_url } },
    { upsert: true }
  );

  // Override github API values with values from MonD.inc
  const updatedSkin = await Skin.findOneAndUpdate({ full_name }, overrides, {
    new: true,
  });
  return updatedSkin;
}

async function updateRelease(payload) {
  console.error("Implement updateRelease()");
  return {};
}

function incOverrides(inc) {
  const overrides = {};
  for (const [option, key] of Object.entries(incOptionToSkinPath)) {
    if (inc[option]) overrides[key] = inc[option];
  }
  return overrides;
}

async function getMondInc(full_name) {
  const response = await axios({
    method: "GET",
    url: `/repos/${full_name}/contents/@Resources/MonD.inc`,
    headers: headers(true),
  });
  const data = response.data;
  if (!data) throw Error("No MonD.inc found");
  const inc = ini.parse(data);
  const section = inc["MonD"];
  if (!section) throw Error("No [MonD] section in MonD.inc");
  return section;
}

module.exports = Router;
