import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function spreadInWindow(count, startISO, endISO) {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (count === 1) return [new Date(start)];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => new Date(start + step * i));
}

function winner(matchId) {
  return `W:${matchId}`;
}

function loser(matchId) {
  return `L:${matchId}`;
}

const rounds = [
  { stage: "r32", count: 16, start: "2026-06-28T20:00:00.000Z", end: "2026-07-03T20:00:00.000Z", prefix: "r32" },
  { stage: "r16", count: 8, start: "2026-07-04T20:00:00.000Z", end: "2026-07-07T20:00:00.000Z", prefix: "r16" },
  { stage: "qf", count: 4, start: "2026-07-09T20:00:00.000Z", end: "2026-07-10T20:00:00.000Z", prefix: "qf" },
  { stage: "sf", count: 2, start: "2026-07-14T20:00:00.000Z", end: "2026-07-15T20:00:00.000Z", prefix: "sf" },
  { stage: "third_place", count: 1, start: "2026-07-18T20:00:00.000Z", end: "2026-07-18T20:00:00.000Z", prefix: "3rd" },
  { stage: "final", count: 1, start: "2026-07-19T20:00:00.000Z", end: "2026-07-19T20:00:00.000Z", prefix: "final" },
];

const venues = [
  "MetLife Stadium, New Jersey",
  "AT&T Stadium, Dallas",
  "SoFi Stadium, Los Angeles",
  "Mercedes-Benz Stadium, Atlanta",
];

function slotsFor(stage, index) {
  const i = index + 1;
  if (stage === "r32") return {};
  if (stage === "r16") {
    return {
      homeSlot: winner(`r32-${i * 2 - 1}`),
      awaySlot: winner(`r32-${i * 2}`),
    };
  }
  if (stage === "qf") {
    return {
      homeSlot: winner(`r16-${i * 2 - 1}`),
      awaySlot: winner(`r16-${i * 2}`),
    };
  }
  if (stage === "sf") {
    return {
      homeSlot: winner(`qf-${i * 2 - 1}`),
      awaySlot: winner(`qf-${i * 2}`),
    };
  }
  if (stage === "third_place") {
    return {
      homeSlot: loser("sf-1"),
      awaySlot: loser("sf-2"),
    };
  }
  if (stage === "final") {
    return {
      homeSlot: winner("sf-1"),
      awaySlot: winner("sf-2"),
    };
  }
  return {};
}

const matches = [];
let n = 0;

for (const r of rounds) {
  const dates = spreadInWindow(r.count, r.start, r.end);
  for (let i = 1; i <= r.count; i++) {
    const id =
      r.stage === "final"
        ? "final-1"
        : r.stage === "third_place"
          ? "3rd-1"
          : `${r.prefix}-${i}`;
    matches.push({
      id,
      stage: r.stage,
      homeTeamId: "TBD",
      awayTeamId: "TBD",
      ...slotsFor(r.stage, i - 1),
      date: dates[i - 1].toISOString(),
      venue: venues[n % venues.length],
      knockoutRound: r.count,
    });
    n++;
  }
}

writeFileSync(join(root, "data/knockout-fixtures.json"), JSON.stringify(matches, null, 2));
console.log(`Wrote ${matches.length} knockout fixtures`);
