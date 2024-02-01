import express from "express";
import mongoose from "mongoose";

const Skin = mongoose.model("skin");

const Router = express.Router();

Router.all("/alias/:alias", async function (req, res, next) {
  const alias = req.params.alias;
  const skin = await Skin.findOne({ alias }, { fullName: 1 }).lean();
  if (!skin) return res.sendStatus(404);
  return res.redirect(302, `https://github.com/${skin.fullName}`);
});

export default Router;
