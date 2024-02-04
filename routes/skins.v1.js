import express from "express";
import mongoose from "mongoose";

const Skin = mongoose.model("skin");

const allowedOptions = ["limit", "skip"];

function parseQuery(query) {
  return [parseFilter(query), parseOptions(query)];
}

function parseOptions(query) {
  const options = {
    lean: { virtuals: false },
    projection: "-__v -owner._id -latestRelease._id",
    sort: { _id: -1 },
  };

  // Handle sort option
  if (query.sort instanceof Object) {
    options.sort = query.sort;
  } else if (query.sort || query.direction) {
    const sort = query.sort || "_id";
    const direction =
      Number(query.direction) || query.direction == "ascending" ? 1 : -1;
    options.sort = { [sort]: direction };
  }

  allowedOptions.forEach((option) => {
    if (query[option]) options[option] = query[option];
  });

  return options;
}

function parseFilter(query) {
  const filter = Skin.translateAliases(query);
  for (let [key, value] of Object.entries(query)) {
    // Only add to filter if the schema contains the path
    if (Skin.schema.path(key)) {
      // If value looks like a regex, make regex query
      if (value.match?.(/^\/.*?\/.*?/)) {
        const parts = value.split("/");
        if (!parts[1]) throw "Invalid regex";
        value = { $regex: parts[1], $options: parts[2] || "" };
      }
      // Set the filter
      filter[key] = value;
    }
  }
  return filter;
}

const Router = express.Router();

Router.get("/v1/skins", async function (req, res, next) {
  const { query } = req;
  const [filter, options] = parseQuery(query);
  return res.json(await Skin.find(filter).setOptions(options));
});

Router.post("/v1/skins", async function (req, res, next) {
  const { body = {} } = req;
  const { query = {}, options = {} } = body;
  return res.json(
    await Skin.find(parseFilter(query)).setOptions(parseOptions(options))
  );
});

export default Router;
