import "./helpers/startup.js";
const { GITHUB_PAT } = process.env;

// Models
import mongoose from "mongoose";

// Helpers
import getSkinNameFromPackage from "./helpers/stream.js";
import chalk from "chalk";

// Octokit
import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";

const Throttled = Octokit.plugin(throttling);

chalk.blueBright();
const Skin = mongoose.model("skin");

const octokit = new Throttled({
  auth: GITHUB_PAT,
  throttle: {
    onRateLimit: (retryAfter, options) => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`
      );
      // Retry twice after hitting a rate limit error, then give up
      if (options.request.retryCount <= 2) {
        console.log(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onSecondaryRateLimit: (retryAfter, options, octokit) => {
      // does not retry, only logs a warning
      octokit.log.warn(
        `Secondary quota detected for request ${options.method} ${options.url}`
      );
    },
  },
});

async function handleRepo(repo) {
  const { name, owner, full_name } = repo;
  const { login: user } = owner;

  console.log(`\n`, chalk.blueBright(full_name));

  try {
    const latest = await octokit.rest.repos.getLatestRelease({
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
    if (existing?.latest_release?.tag_name == tag_name) {
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

    // TODO: Get mond.inc and update database

    return console.log(
      chalk.greenBright(`Added ${full_name} ${latest_release.tag_name}!`)
    );
  } catch (error) {
    console.log(chalk.red(error.message));
    return console.log(chalk.red(`${user}/${name} has no releases`));
  }
}

async function scrape() {
  const repos = await octokit.paginate(octokit.rest.search.repos, {
    q: "rainmeter OR rmskin OR rainmeter-skin in:topics",
  });
  console.log(chalk.green(`Found ${repos.length} matching repos!`));
  for (const repo of repos) {
    await handleRepo(repo);
  }
  console.log(`Done!`);
}

(async () => {
  await scrape();
})();
