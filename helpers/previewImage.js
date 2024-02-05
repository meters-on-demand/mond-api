import axios from "axios";
import sharp from "sharp";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const __static = join(__dirname, "../static");

export default async function previewImage(skin) {
  try {
    const { previewImage } = skin;

    console.log(`Downloading ${skin.name} previewImage`);

    const sharpStream = sharp();

    await axios
      .get(previewImage, { responseType: "stream" })
      .then((res) => res.data)
      .then((stream) => {
        stream.pipe(sharpStream);
      })
      .catch((error) => {
        throw error;
      });

    await sharpStream
      .clone()
      .resize({
        width: 800,
        height: 400,
        fit: "cover",
        withoutEnlargement: true,
      })
      .jpeg({ mozjpeg: true })
      .toFile(`${__static}/${skin._id}.jpg`);

    console.log(chalk.green(`Saved previewImage`));
    return true;
  } catch (error) {
    console.log(
      `Failed to get ${skin.fullName} previewImage: ${error.message}`
    );
    return false;
  }
}
