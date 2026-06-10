import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public/flags");
mkdirSync(outDir, { recursive: true });

const teamList = JSON.parse(readFileSync(join(root, "data/teams.json"), "utf8"));

for (const team of teamList) {
  const code = team.flagCode;
  const out = join(outDir, `${code}.svg`);
  if (existsSync(out)) {
    console.log(`skip ${code}`);
    continue;
  }
  const url = `https://flagcdn.com/${code}.svg`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.statusText);
    const svg = await res.text();
    writeFileSync(out, svg);
    console.log(`OK ${code}`);
  } catch (e) {
    console.warn(`FAIL ${code}:`, e.message);
  }
}

console.log("Done");
