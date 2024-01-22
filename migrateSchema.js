import mongoose from "mongoose";

import "./helpers/startup.js";

const Skin = mongoose.model("skin");
const { log, error } = console;

// Disable strict to ignore schema to be able to update the field names
Skin.schema.set(`strict`, false);
Skin.schema.set(`strictQuery`, false);
Skin.schema.childSchemas.forEach((child) => {
    child.schema.set(`strict`, false);
    child.schema.set(`strictQuery`, false);
});

// $rename does an $unset and unique indexes see the unset fields as nulls
// get rid of indexes to avoid duplicate key error
await Skin.collection.dropIndexes().catch(error);

await Skin.updateMany({}, {
    $rename: {
        "owner.avatar_url": "owner.avatarUrl",
        "latest_release.browser_download_url": "latest_release.uri",
        "latest_release.tag_name": "latest_release.tagName",
    }
}).then(log);
await Skin.updateMany({}, {
    $rename: {
        full_name: "fullName",
        skin_name: "skinName",
        preview_image: "previewImage",
        latest_release: "latestRelease",
        last_checked: "lastChecked",
    }
}).then(log);

// Recreate indexes with renamed fields
await Skin.ensureIndexes();

process.exit(0);
