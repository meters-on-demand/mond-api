const express = require("express");
const Router = express.Router();

// Models
const mongoose = require("mongoose");
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
  const filter = {};

  for (let [key, value] of Object.entries(query)) {
    // Only add to filter if the schema contains the path
    if (Skin.schema.path(key)) {
      // Handle regexes
      if (value.at(0) == "/" && value.at(-1) == "/")
        value = { $regex: value.slice(1, -1) };
      // Set the filter
      filter[key] = value;
    }
  }

  return filter;
}

/* Routes */

Router.get("/skins", async function (req, res, next) {
  const { query } = req;
  const [filter, options] = parseQuery(query);
  console.log(parseQuery(query));
  return res.json(await Skin.find(filter, null, options));
});

module.exports = Router;
