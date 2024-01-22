import { dirname, join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const routeDir = dirname(__filename);
const ignore = basename(__filename);

export default async function (app) {
    for (const file of readdirSync(routeDir)) {
        if (file == ignore) continue;
        const route = await import(pathToFileURL(join(routeDir, file)));
        const router = route.default;
        app.use(router);
    }
}