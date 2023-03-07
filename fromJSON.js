require("dotenv/config");

const mongoose = require("mongoose");
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("Connected to database"))
  .catch((error) => console.error(error));

require("./models/Skin");

const Skin = mongoose.model("skin");
const skins = require("./skins.json");

if (new URL(process.env.MONGO_URL).hostname !== "127.0.0.1") {
  console.log("Don't override the real database thanks");
  process.exit();
}

(async () => {
  for (const skin of skins) {
    const { full_name } = skin;
    console.log(`Adding ${full_name}`);
    await Skin.findOneAndUpdate({ full_name }, skin, { upsert: true });
  }
  mongoose.disconnect();
  process.exit();
})();
