import chalk from "chalk";

const { GITHUB_PAT } = process.env;
if (!GITHUB_PAT)
  throw Error(
    `Cannot create the octokit client without a GitHub Personal Access Token. Provide GITHUB_PAT in .env`
  );

// Octokit
import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
const Throttled = Octokit.plugin(throttling);
const OctoClient = new Throttled({
  auth: GITHUB_PAT,
  throttle: {
    onRateLimit: (retryAfter, options) => {
      OctoClient.log.warn(
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

export default OctoClient;

export function logRateLimit(response) {
  const { headers } = response;
  const { ["x-ratelimit-limit"]: limit, ["x-ratelimit-remaining"]: remaining } =
    headers;
  console.log(chalk.yellow(`x-ratelimit ${remaining}/${limit}`));
  return response;
}
