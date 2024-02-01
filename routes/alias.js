import express from "express";
import mongoose from "mongoose";

const Skin = mongoose.model("skin");

const Router = express.Router();

Router.all("/alias/:alias", async function (req, res, next) {
  const { params } = req;
  const { alias } = params;
  const { fullName } = await Skin.find({ alias })
    .projection({ fullName: 1 })
    .lean();
  if (!fullName) return res.sendStatus(404);
  return res.redirect(302, `https://github.com/${fullName}`);
});

export default Router;
