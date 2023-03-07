const mongoose = require("mongoose");

const SkinSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    skin_name: { type: String, required: true },
    full_name: { type: String, required: true, unique: true },
    topics: [String],
    description: String,
    latest_release: {
      tag_name: String,
      browser_download_url: String,
      name: String,
    },
    owner: {
      name: String,
      avatar_url: String,
    },
  },
  { timestamps: true, strict: true, strictQuery: true }
);

SkinSchema.virtual("version").get(function () {
  return this.latest_release.tag_name;
});

SkinSchema.virtual("owner.github").get(function () {
  return `https://github.com/${this.full_name.split("/")[0]}`;
});

SkinSchema.plugin(require("mongoose-lean-virtuals"));

mongoose.model("skin", SkinSchema);
