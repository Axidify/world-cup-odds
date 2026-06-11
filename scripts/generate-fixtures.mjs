/**
 * @deprecated Use `node scripts/import-fifa-schedule.mjs` — synthetic dates are wrong.
 */
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const dir = dirname(fileURLToPath(import.meta.url));
console.warn("generate-fixtures.mjs is deprecated — importing official FIFA schedule instead.");
const r = spawnSync("node", [join(dir, "import-fifa-schedule.mjs")], { stdio: "inherit" });
process.exit(r.status ?? 1);
