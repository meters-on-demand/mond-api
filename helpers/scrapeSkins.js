const { REPO_QUERY, BLOCKLIST } = process.env;

import chalk from "chalk";
import mongoose from "mongoose";

const Skin = mongoose.model("skin");

import getSkinNameFromPackage from "./stream.js";
import updateIncOverrides from "./mond.inc.js";

import OctoClient from "./octokit.js";
import { logRateLimit } from "./octokit.js";
import previewImage from "./previewImage.js";

async function getRmskinRelease(fullName) {
  try {
    const [owner, repo] = fullName.split("/");
    const releaseResponse = await OctoClient.rest.repos.getLatestRelease({
      owner,
      repo,
    });
    logRateLimit(releaseResponse);

    const { data } = releaseResponse;
    const { tag_name: tagName } = data;
    const name = data.name;

    function getDownloadUrl({ assets }) {
      for (const asset of assets) {
        const { name, browser_download_url: uri } = asset;
        if (name.match(/\.rmskin$/i)) return uri;
      }
      throw Error("Release doesn't contain an .rmskin package");
    }
    const uri = getDownloadUrl(data);

    return { tagName, uri, name };
  } catch (error) {
    console.log(`Couldn't get release: ${chalk.red(error.message)}`);
    return false;
  }
}

async function applyRelease(skin, latestRelease) {
  if (skin?.latestRelease?.tagName == latestRelease.tagName) {
    console.log(chalk.green(`${skin.fullName} is up to date.`));
    return skin;
  }
  skin.latestRelease = latestRelease;
  return skin;
}

async function newSkin(repo) {
  const [userName, repoName] = repo.full_name.split("/");
  return await Skin.create({
    fullName: repo.full_name,
    name: repoName,
    topics: repo.topics,
    description: repo.description,
    owner: {
      name: userName,
      avatarUrl: repo?.owner?.avatar_url,
    },
  });
}

function block(fullName) {
  const [user, repo] = fullName.split("/");
  // Block transphobes and reuploaders
  const blockedUsers = BLOCKLIST.split(",").map((e) => e.trim());
  if (blockedUsers.includes(user)) {
    console.log(`\nSkipped ${repo} by blocked user: `, chalk.red(user));
    return true;
  }
  return false;
}

export async function handleRepo(repo) {
  const fullName = repo.full_name;
  if (block(fullName)) return;

  console.log(`\n`, chalk.blueBright(fullName));

  try {
    const latestRelease = await getRmskinRelease(fullName);
    if (!latestRelease) return;

    const exists = await Skin.exists({ fullName });
    let skin = await (exists ? Skin.findOne(exists) : newSkin(repo));

    skin = await applyRelease(skin, latestRelease);

    if (skin.isModified("latestRelease") || !skin.skinName)
      skin.skinName = await getSkinNameFromPackage(latestRelease.uri);

    skin = await updateIncOverrides(skin);

    if (skin.isModified("previewImage")) {
      await previewImage(skin);
    }

    const timestamps = skin.isModified();
    skin.lastChecked = Date.now();
    await skin.save({ timestamps });

    console.log(chalk.green(`${exists ? "Updated" : "Added"} ${fullName}!`));
    return skin;
  } catch (error) {
    console.log(chalk.red(error.message));
    console.error(error);
    return false;
  }
}

export async function scrape({ query = REPO_QUERY } = {}) {
  try {
    const repos = await OctoClient.paginate(OctoClient.rest.search.repos, {
      q: query,
    });
    console.log(chalk.green(`Found ${repos.length} matching repos!`));
    for (const repo of repos) {
      await handleRepo(repo);
    }
    console.log(`Processed all ${repos.length} matching repos!`);
  } catch (error) {
    console.error(error);
  }
}

async function removeSkin(skin) {
  console.log(chalk.red(`Removing ${skin.fullName}`));
  await Skin.findByIdAndRemove(skin._id);
}

export async function checkExisting() {
  const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
  const existing = await Skin.find({
    $or: [
      { lastChecked: { $lt: new Date(twelveHoursAgo) } },
      { lastChecked: { $exists: false } },
      { lastChecked: null },
    ],
  }).lean({ virtuals: true });

  if (!existing || !existing.length)
    return console.log(chalk.green(`No stale repos!`));

  console.log(chalk.yellow(`Found ${existing.length} stale repos!`));
  for (const skin of existing) {
    const { fullName } = skin;
    const [owner, repo] = fullName.split("/");

    const response = await OctoClient.rest.repos
      .get({
        owner,
        repo,
      })
      .catch((error) => {
        console.error(error);
        return { data: false };
      });

    const { data: existingRepo } = response;

    if (
      !existingRepo ||
      `${existingRepo.full_name}`.toLowerCase() != `${fullName}`.toLowerCase()
    ) {
      removeSkin(skin);
      continue;
    }

    const result = await handleRepo(existingRepo);
    if (
      !result ||
      `${fullName}`.toLowerCase() != `${result.fullName}`.toLowerCase()
    ) {
      await removeSkin(skin);
    }
  }
  console.log(chalk.green(`Processed ${existing.length} stale repos!`));
}
