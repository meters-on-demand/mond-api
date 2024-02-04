const { REPO_QUERY, BLOCKLIST } = process.env;

import chalk from "chalk";
import mongoose from "mongoose";

import getSkinNameFromPackage from "./stream.js";
import OctoClient from "./octokit.js";
import applyMondIncOverloads from "./mond.inc.js";

const Skin = mongoose.model("skin");

export async function handleRepo(repo, force = false) {
  const { name, owner, full_name: fullName } = repo;
  const user = fullName.split("/")[0];

  // Block transphobes and reuploaders
  const blockedUsers = BLOCKLIST.split(",").map((e) => e.trim());
  if (blockedUsers.includes(user)) {
    console.log(`\nSkipped repo ${name} by blocked user: `, chalk.red(user));
    return false;
  }

  console.log(`\n`, chalk.blueBright(fullName));

  try {
    const latest = await OctoClient.rest.repos.getLatestRelease({
      owner: user,
      repo: name,
    });
    function getDownloadUrl({ assets }) {
      for (const asset of assets) {
        const { name, browser_download_url: uri } = asset;
        if (name.match(/\.rmskin$/i)) return uri;
      }
      throw Error("Release doesn't contain an .rmskin package");
    }

    const { headers, data: releaseData } = latest;
    const {
      ["x-ratelimit-limit"]: limit,
      ["x-ratelimit-remaining"]: remaining,
    } = headers;

    console.log(chalk.yellow(`x-ratelimit ${remaining}/${limit}`));

    const { tag_name: tagName } = releaseData;
    const latestRelease = {
      tagName,
      uri: getDownloadUrl(releaseData),
      name: releaseData.name,
    };

    const existing = await Skin.findOne({ fullName }).lean();
    if (!force && existing?.latestRelease?.tagName == tagName) {
      console.log(chalk.green(`${fullName} is up to date.`));
      return await Skin.findOneAndUpdate(
        { fullName },
        { lastChecked: Date.now() }
      ).lean();
    }

    let skin = await Skin.findOneAndUpdate(
      { fullName },
      {
        name: repo.name,
        skinName: await getSkinNameFromPackage(latestRelease.uri),
        topics: repo.topics,
        description: repo.description,
        owner: {
          name: user,
          avatarUrl: owner.avatar_url,
        },
        lastChecked: Date.now(),
        latestRelease,
      },
      { upsert: true, new: true }
    );

    skin = await applyMondIncOverloads(skin).catch((error) => {
      console.log(chalk.yellow(`Couldn't apply mond.inc`));
      console.log(error.message);
    });

    console.log(chalk.greenBright(`Added ${fullName} ${tagName}!`));
    return skin;
  } catch (error) {
    console.log(chalk.red(error.message));
    console.log(chalk.red(`${user}/${name} has no releases`));
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

    if (!existingRepo || existingRepo.full_name != fullName) {
      removeSkin(skin);
      continue;
    }

    const result = await handleRepo(existingRepo);
    if (!result || skin.fullName.localeCompare(result.fullName)) {
      await removeSkin(skin);
    }
  }
  console.log(chalk.green(`Processed ${existing.length} stale repos!`));
}
