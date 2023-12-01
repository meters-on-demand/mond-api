import mongoose from "mongoose";
import mongooseLeanVirtuals from "mongoose-lean-virtuals";

const OwnerSchema = mongoose.Schema({
  name: { type: String, alias: "login" },
  avatar_url: String,
});

const SkinSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    skin_name: { type: String, required: true },
    full_name: { type: String, required: true, unique: true, lowercase: true },
    topics: [String],
    description: String,
    preview_image: String,
    latest_release: {
      tag_name: String,
      browser_download_url: String,
      name: String,
    },
    owner: OwnerSchema,
    last_checked: Date,
  },
  {
    timestamps: true,
    strict: true,
    strictQuery: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

SkinSchema.virtual("version").get(function () {
  return this.latest_release.tag_name;
});

SkinSchema.virtual("owner.github").get(function () {
  return `https://github.com/${this.full_name.split("/")[0]}`;
});

SkinSchema.plugin(mongooseLeanVirtuals);

const Skin = mongoose.model("skin", SkinSchema);

export default Skin;
