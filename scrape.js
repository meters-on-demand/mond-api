import "./helpers/startup.js";

import { scrape, checkExisting } from "./helpers/scrapeSkins.js";
import chalk from "chalk";

await scrape();
await checkExisting();

console.log(chalk.green(`done!`));
