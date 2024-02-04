import ini from "ini";

import chalk from "chalk";
import OctoClient from "./octokit.js";
import mongoose from "mongoose";

const Skin = mongoose.model("skin");

const mondIncToSkin = {
  Author: "owner.name",
  ProfilePicture: "owner.avatarUrl",
  Description: "description",
  PreviewImage: "previewImage",
};

export function stripQuotes(s) {
  const strippable = [`'`, `"`];
  if (strippable.includes(s.at(0)) && strippable.includes(s.at(-1))) {
    s = s.slice(1, -1);
  }
  s = s.trim();
  return s;
}

function incOverrides(inc) {
  const overrides = {};
  for (const [option, key] of Object.entries(mondIncToSkin)) {
    const incKey = Object.keys(inc).find(
      (k) => k.toLowerCase() == option.toLowerCase()
    );
    const incValue = inc[incKey];
    if (incValue) overrides[key] = stripQuotes(incValue);
  }
  return overrides;
}

async function getMondIncEntry({ owner, repo }) {
  const mondIncFilter = /mond\.inc/i;
  const resourcesFilter = /\@resources/i;

  const notFound = "Repository doesn't contain mond.inc";

  const { data: rootContent } = await OctoClient.rest.repos.getContent({
    owner,
    repo,
  });

  let atResources;
  for (const entry of rootContent) {
    if (entry.path.match(mondIncFilter)) return entry.path;
    if (entry.path.match(resourcesFilter)) atResources = entry.path;
  }

  if (!atResources) throw notFound;

  const { data: resourcesContent } = await OctoClient.rest.repos.getContent({
    owner,
    repo,
    path: atResources,
  });

  for (const entry of resourcesContent) {
    if (entry.path.match(mondIncFilter)) return entry.path;
  }

  throw notFound;
}

async function getMondIncContent({ owner, repo }) {
  try {
    const mondIncEntry = await getMondIncEntry({ owner, repo });

    const mondIncContent = await OctoClient.rest.repos.getContent({
      mediaType: { format: "raw" },
      owner,
      repo,
      path: mondIncEntry,
    });

    return mondIncContent;
  } catch (error) {
    console.error(error);
    throw Error("Cannot load MonD.inc content");
  }
}

async function getMondInc({ owner, repo }) {
  const { data: mondIncContent } = await getMondIncContent({ owner, repo });
  // Parse the inc
  const mondInc = ini.parse(mondIncContent);
  const mondSection =
    mondInc[Object.keys(mondInc).find((k) => k.toLowerCase() === "mond")];
  if (!mondSection) throw Error("No [MonD] section in MonD.inc");
  return mondSection;
}

export default async function applyMondIncOverloads(skin) {
  const { fullName } = skin;
  const [owner, repo] = fullName.split("/");

  const inc = await getMondInc({ owner, repo });
  if (!inc) return skin;

  const overrides = incOverrides(inc);

  console.log(chalk.blue(`MonD.inc overrides:`));
  console.log(overrides);

  // Override github API values with values from MonD.inc
  const updatedSkin = await Skin.findOneAndUpdate({ fullName }, overrides, {
    new: true,
  });
  return updatedSkin;
}
