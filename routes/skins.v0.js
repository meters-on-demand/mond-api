import express from "express";
import mongoose from "mongoose";

const Skin = mongoose.model("skin");

const allowedOptions = ["limit", "skip"];

function parseQuery(query) {
  return [parseFilter(query), parseOptions(query)];
}

function parseOptions(query) {
  const options = {
    lean: { virtuals: true },
    sort: { _id: -1 },
  };

  // Handle sort option
  if (query.sort || query.direction) {
    const sort = query.sort || "_id";
    const direction = query.direction == "ascending" ? 1 : -1;
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
      // Handle regexes
      if (value.at(0) == "/" && value.at(-1) == "/")
        value = { $regex: value.slice(1, -1), $options: "i" };
      // Set the filter
      filter[key] = value;
    }
  }
  return filter;
}

const Router = express.Router();

/* Routes */
Router.get("/skins", async function (req, res, next) {
  const { query } = req;
  const [filter, options] = parseQuery(query);
  return res.json(await Skin.find(filter).setOptions(options));
});

export default Router;
