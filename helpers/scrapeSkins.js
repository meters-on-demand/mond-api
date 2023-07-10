const { REPO_QUERY, BLOCKLIST } = process.env;

// Models
import mongoose from "mongoose";

// Helpers
import getSkinNameFromPackage from "./stream.js";
import chalk from "chalk";
import OctoClient from "./octokit.js";
import ini from "ini";

const Skin = mongoose.model("skin");

// MonD.inc options to Skin schema paths
const incOptionToSkinPath = {
  Author: "owner.name",
  ProfilePicture: "owner.avatar_url",
  Description: "description",
  PreviewImage: "preview_image",
};

async function applyMondIncOverloads(skin) {
  const { full_name } = skin;
  const [owner, repo] = full_name.split("/");

  // Get MonD.inc
  const inc = await getMondInc({ owner, repo });
  if (!inc) return skin;

  // Get the override values from MonD.inc
  const overrides = incOverrides(inc);

  console.log(chalk.blue(`MonD.inc overrides:`));
  console.log(overrides);

  // Override github API values with values from MonD.inc
  const updatedSkin = await Skin.findOneAndUpdate({ full_name }, overrides, {
    new: true,
  });
  return updatedSkin;
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

export async function handleRepo(repo, force = false) {
  const { name, owner, full_name } = repo;
  const { login: user } = owner;

  const blockedUsers = BLOCKLIST.split(",").map((e) => e.trim());

  if (blockedUsers.includes(user))
    return console.log(
      `\nSkipped repo ${name} by blocked user: `,
      chalk.red(user)
    );

  console.log(`\n`, chalk.blueBright(full_name));

  try {
    const latest = await OctoClient.rest.repos.getLatestRelease({
      owner: user,
      repo: name,
    });

    const { headers, data: releaseData } = latest;
    const {
      ["x-ratelimit-limit"]: limit,
      ["x-ratelimit-remaining"]: remaining,
    } = headers;

    console.log(chalk.yellow(`x-ratelimit ${remaining}/${limit}`));

    function getDownloadUrl({ assets }) {
      for (const asset of assets) {
        const { name, browser_download_url } = asset;
        if (name.match(/\.rmskin$/i)) return browser_download_url;
      }
      throw Error("Release doesn't contain an .rmskin package");
    }

    async function getSkinName({ browser_download_url }) {
      return await getSkinNameFromPackage(browser_download_url);
    }

    const { tag_name } = releaseData;
    const latest_release = {
      tag_name,
      browser_download_url: getDownloadUrl(releaseData),
      name: releaseData.name,
    };

    const existing = await Skin.findOne({ full_name }).lean();
    if (!force && existing?.latest_release?.tag_name == tag_name) {
      return console.log(chalk.green(`${full_name} has already been added.`));
    }

    const skin = await Skin.findOneAndUpdate(
      { full_name },
      {
        name: repo.name,
        skin_name: await getSkinName(latest_release),
        topics: repo.topics,
        description: repo.description,
        owner: {
          name: user,
          avatar_url: owner.avatar_url,
        },
        latest_release,
      },
      { upsert: true, new: true }
    );

    await applyMondIncOverloads(skin).catch((error) => {
      console.log(chalk.yellow(`Couldn't apply mond.inc`));
      console.log(error.message);
    });

    return console.log(
      chalk.greenBright(`Added ${full_name} ${latest_release.tag_name}!`)
    );
  } catch (error) {
    console.log(chalk.red(error.message));
    return console.log(chalk.red(`${user}/${name} has no releases`));
  }
}

export async function scrape({ query = REPO_QUERY } = {}) {
  const repos = await OctoClient.paginate(OctoClient.rest.search.repos, {
    q: query,
  });
  console.log(chalk.green(`Found ${repos.length} matching repos!`));
  for (const repo of repos) {
    await handleRepo(repo);
  }
  console.log(`Processed all ${repos.length} matching repos!`);
}
