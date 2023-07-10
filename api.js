require("./helpers/startup");

const { LOGGING, PORT } = process.env;

const express = require("express");
const API = express();
API.use(express.json());
API.use(require("cors")());

if (LOGGING)
  API.use((req, res, next) =>
    next(console.log(req.method, req.originalUrl, req.body))
  );

const fs = require("fs");
const { join } = require("path");
const routes = join(__dirname, "routes");
fs.readdirSync(routes).forEach((file) => {
  API.use(require(join(routes, file)));
});

API.use(function (error, req, res, next) {
  console.error(error);
  res.status = 500;
  return res.json({ message: error.message, error: true });
});

API.listen(PORT);
