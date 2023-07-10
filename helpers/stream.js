import axios from "axios";
import unzip from "unzipper";

import stream from "stream";
import { promisify } from "util";

const finished = promisify(stream.finished);

export default function getSkinNameFromPackage(uri) {
  // Store the result to detect completion while streaming,
  // because JS is so slow that you can end up with half the zip
  // already downloaded before the request is aborted
  let skinName = null;
  const rootConfigPattern = /^Skins[\/|\\](.*?)[\/|\\]/;

  const controller = new AbortController();
  const { signal } = controller;

  return new Promise((resolve, reject) => {
    const parser = unzip.Parse();
    console.log(`Streaming ${uri}`);

    axios
      .get(uri, {
        responseType: "stream",
        signal,
      })
      .then((response) => {
        response.data.pipe(parser).on("entry", function (entry) {
          if (skinName) return entry.autodrain();

          const fileName = entry.path;
          const match = fileName.match(rootConfigPattern);

          console.log(`Matching ${fileName}`);

          if (match) {
            controller.abort();
            entry.autodrain();
            parser.destroy();
            skinName = match[1];
            console.log(`Found ROOTCONFIG ${skinName}`);
            return resolve(skinName);
          }

          entry.autodrain();
        });
      })
      .catch(reject);

    finished(parser)
      .then((finished) => {
        if (skinName) return resolve(skinName);
        reject(`Package doesn't contain any skins`);
      })
      .catch((error) => {
        if (skinName) return resolve(skinName);
        reject(error);
      });
  });
}
