const axios = require("axios");
const unzip = require("unzipper");

function getSkinNameFromPackage(uri) {
  // Store the result to detect completion while streaming,
  // because JS is so slow that you can end up with half the zip
  // already downloaded before the request is aborted
  let skinName = null;
  const rootConfigPattern = /^Skins\/(.*?)\//;

  const controller = new AbortController();
  const { signal } = controller;

  return new Promise((resolve, reject) => {
    axios
      .get(uri, {
        responseType: "stream",
        signal,
      })
      .then((response) => {
        response.data
          .pipe(unzip.Parse())
          .on("entry", function (entry) {
            if (skinName) return entry.autodrain();
            const fileName = entry.path;
            const match = fileName.match(rootConfigPattern);
            if (match) {
              controller.abort();
              skinName = match[1];
              resolve(skinName);
            }
            return entry.autodrain();
          })
          .on("error", reject)
          .on("finish", () =>
            reject(new Error(`Couldn't find the root config name.`))
          );
      })
      .catch((error) => reject(error));
  });
}

module.exports = getSkinNameFromPackage;
