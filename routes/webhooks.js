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
  PreviewImage: "preview_image",
};

Router.post("/webhooks/github", async function (req, res, next) {
  const { body: payload } = req;

  const isRelease = payload.action === "released";
  const isPing = !!payload?.hook;

  if (isRelease || isPing) {
    if (!payload.repository.full_name)
      throw Error("payload.repository does not contain full_name");
    await updateSkin(payload);
    const updated = await updateRelease(payload);
    return res.json(updated);
  }
  return res.end("OK");
});

async function updateSkin(payload) {
  const { full_name } = payload.repository;
  const repository = await getRepoInformation(full_name);
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
  const { full_name } = payload.repository;
  const latest_release = await getLatestRelease(full_name);

  if (!latest_release.assets)
    throw Error(`${full_name} latest release contains no assets`);

  const rmskin = latest_release.assets.find((asset) =>
    asset.name.match(/.*\.rmskin$/)
  );
  latest_release.browser_download_url = rmskin.browser_download_url;

  const updatedSkin = await Skin.findOneAndUpdate(
    { full_name },
    { latest_release },
    { new: true }
  );

  return updatedSkin;
}

async function getLatestRelease(full_name) {
  try {
    const response = await axios({
      method: "GET",
      url: `/repos/${full_name}/releases/latest`,
      headers: headers(),
    });
    const data = response.data;
    return data;
  } catch (error) {
    console.error(error);
    throw Error(`Couldn't get the latest release of ${full_name}`);
  }
}

async function getRepoInformation(full_name) {
  try {
    const response = await axios({
      method: "GET",
      url: `/repos/${full_name}`,
      headers: headers(),
    });
    const data = response.data;
    return data;
  } catch (error) {
    console.error(error);
    throw Error(`Couldn't get repository information of ${full_name}`);
  }
}

async function getMondIncEntry(full_name) {
  const notFound = Error("MonD.inc not found");
  const mondIncFilter = (file) =>
    file.name.match(/mond\.inc/i) && file.type === "file";
  try {
    const resourcesFiles = await axios({
      method: "GET",
      url: `/repos/${full_name}/contents/@Resources`,
      headers: headers(),
    }).then((response) => response.data);
    let mondIncEntry = resourcesFiles.find(mondIncFilter);
    if (mondIncEntry) return mondIncEntry;

    const rootFiles = await axios({
      method: "GET",
      url: `/repos/${full_name}/contents`,
      headers: headers(),
    }).then((response) => response.data);
    mondIncEntry = rootFiles.find(mondIncFilter);
    if (mondIncEntry) return mondIncEntry;

    throw notFound;
  } catch (error) {
    console.error(error);
    throw notFound;
  }
}

async function getMondIncContent(full_name) {
  try {
    const mondIncEntry = await getMondIncEntry(full_name);
    return await axios({
      method: "GET",
      baseURL: mondIncEntry.url,
      headers: headers(true),
    }).then((response) => response.data);
  } catch (error) {
    console.error(error);
    throw Error("Cannot load MonD.inc content");
  }
}

async function getMondInc(full_name) {
  const mondIncContent = await getMondIncContent(full_name);
  // Parse the inc
  const mondInc = ini.parse(mondIncContent);
  const mondSection =
    mondInc[Object.keys(mondInc).find((k) => k.toLowerCase() === "mond")];
  if (!mondSection) throw Error("No [MonD] section in MonD.inc");
  return mondSection;
}

function incOverrides(inc) {
  const overrides = {};
  for (const [option, key] of Object.entries(incOptionToSkinPath)) {
    const incKey = Object.keys(inc).find(
      (k) => k.toLowerCase() == option.toLowerCase()
    );
    const incValue = inc[incKey];
    if (incValue) overrides[key] = stripQuotes(incValue);
  }
  return overrides;
}

function stripQuotes(s) {
  const strippable = ["'", '"'];
  if (strippable.includes(s.at(0)) && strippable.includes(s.at(-1))) {
    s = s.slice(1, -1);
  }
  s = s.trim();
  return s;
}

module.exports = Router;
