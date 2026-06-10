/**
 * One-off: parse Wikipedia Annex C table text → data/third-place-combos.json
 * Usage: node scripts/parse-third-place-table.mjs <wiki-text-file>
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
if (!input) {
  console.error("Usage: node parse-third-place-table.mjs <wiki-text-file>");
  process.exit(1);
}

const text = readFileSync(input, "utf8");
const lines = text.split("\n").filter((l) => l.startsWith("|") && !l.includes("---"));

const slots = ["1A", "1B", "1D", "1E", "1G", "1I", "1K", "1L"];
const map = {};

for (const line of lines) {
  const cells = line
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  if (cells.length < 17) continue;
  if (cells[0] === "No." || cells[0] === "Combinations of matches in the round of 32") continue;

  const groups = cells.slice(1, 9).sort().join("");
  const assignments = cells.slice(9, 17);
  const entry = {};
  for (let i = 0; i < slots.length; i++) {
    entry[slots[i]] = assignments[i];
  }
  map[groups] = entry;
}

const out = join(__dirname, "..", "data", "third-place-combos.json");
writeFileSync(out, JSON.stringify(map, null, 0));
console.log(`Wrote ${Object.keys(map).length} combinations to ${out}`);
