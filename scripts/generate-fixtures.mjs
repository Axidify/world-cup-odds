import { writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const groups = JSON.parse(readFileSync(join(root, "data/groups.json"), "utf8"));

const venues = [
  "Estadio Azteca, Mexico City",
  "MetLife Stadium, New Jersey",
  "SoFi Stadium, Los Angeles",
  "AT&T Stadium, Dallas",
  "Mercedes-Benz Stadium, Atlanta",
  "BC Place, Vancouver",
  "BMO Field, Toronto",
];

// FIFA 2026 group stage: three matchday windows (Jun 11–17, 18–23, 24–27).
const matchdayWindows = [
  { start: "2026-06-11T19:00:00.000Z", spanDays: 7 },
  { start: "2026-06-18T19:00:00.000Z", spanDays: 6 },
  { start: "2026-06-24T19:00:00.000Z", spanDays: 4 },
];

const schedule = [
  [0, 1],
  [2, 3],
  [3, 0],
  [1, 2],
  [0, 2],
  [1, 3],
];

function kickoffFor(groupIndex, matchIndex) {
  const windowIdx = matchIndex < 2 ? 0 : matchIndex < 4 ? 1 : 2;
  const { start, spanDays } = matchdayWindows[windowIdx];
  const d = new Date(start);
  const dayOffset = (groupIndex * 2 + (matchIndex % 2)) % spanDays;
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(19 + (groupIndex % 3));
  return d.toISOString();
}

const fixtures = [];

groups.forEach((g, groupIndex) => {
  const [t1, t2, t3, t4] = g.teamIds;
  const teams = [t1, t2, t3, t4];
  schedule.forEach(([hi, ai], md) => {
    fixtures.push({
      id: `grp-${g.group.toLowerCase()}-${md + 1}`,
      stage: "group",
      group: g.group,
      homeTeamId: teams[hi],
      awayTeamId: teams[ai],
      date: kickoffFor(groupIndex, md),
      venue: venues[(groupIndex + md) % venues.length],
    });
  });
});

// Opening match: Mexico vs South Africa, Jun 11 (FIFA confirmed).
const opener = fixtures.find((m) => m.id === "grp-a-1");
if (opener) opener.date = "2026-06-11T19:00:00.000Z";

writeFileSync(join(root, "data/fixtures.json"), JSON.stringify(fixtures, null, 2));
console.log(`Wrote ${fixtures.length} group fixtures`);
