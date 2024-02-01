import mongoose from "mongoose";
import mongooseLeanVirtuals from "mongoose-lean-virtuals";

const OwnerSchema = mongoose.Schema({
  name: { type: String, alias: "login" },
  avatarUrl: { type: String, alias: "avatar_url" },
});

const ReleaseSchema = mongoose.Schema({
  tagName: { type: String, alias: "tag_name" },
  uri: { type: String, alias: "browser_download_url" },
  name: String,
});

const SkinSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    skinName: { type: String, required: true, alias: "skin_name" },
    fullName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      alias: "full_name",
    },
    topics: [String],
    description: String,
    previewImage: { type: String, alias: "preview_image" },
    latestRelease: {
      type: ReleaseSchema,
      alias: "latest_release",
    },
    alias: { type: String, unique: true, sparse: true },
    owner: OwnerSchema,
    lastChecked: { type: Date, alias: "last_checked" },
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
  return this?.latestRelease?.tagName;
});

SkinSchema.virtual("owner.github").get(function () {
  return `https://github.com/${this.fullName.split("/")[0]}`;
});

SkinSchema.plugin(mongooseLeanVirtuals);

const Skin = mongoose.model("skin", SkinSchema);

export default Skin;
