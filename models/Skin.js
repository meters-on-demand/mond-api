const mongoose = require("mongoose");

const ReleaseSchema = mongoose.Schema({
  tag_name: String,
  browser_download_url: String,
  name: String,
});

const GithubUser = mongoose.Schema({
  name: String,
  avatar_url: String,
});

const SkinSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    skin_name: { type: String, required: true },
    full_name: { type: String, required: true, unique: true },
    topics: [String],
    latest_release: ReleaseSchema,
    owner: GithubUser,
  },
  { timestamps: true }
);

SkinSchema.virtual("version").get(function () {
  return this.latest_release.tag_name;
});

SkinSchema.plugin(require("mongoose-lean-virtuals"));

mongoose.model("skin", SkinSchema);
