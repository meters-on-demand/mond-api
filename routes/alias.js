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
  return res.redirect(302, `https://github.com/${fullName}`);
});

export default Router;
