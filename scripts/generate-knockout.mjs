import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function winner(matchId) {
  return `W:${matchId}`;
}

function loser(matchId) {
  return `L:${matchId}`;
}

const rounds = [
  { stage: "r32", count: 16, prefix: "r32" },
  { stage: "r16", count: 8, prefix: "r16" },
  { stage: "qf", count: 4, prefix: "qf" },
  { stage: "sf", count: 2, prefix: "sf" },
  { stage: "third_place", count: 1, prefix: "3rd" },
  { stage: "final", count: 1, prefix: "final" },
];

const schedule = JSON.parse(
  readFileSync(join(root, "data/knockout-schedule.json"), "utf8"),
);

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

function matchIdForRound(round, index) {
  if (round.stage === "final") return "final-1";
  if (round.stage === "third_place") return "3rd-1";
  return `${round.prefix}-${index}`;
}

const matches = [];

for (const r of rounds) {
  for (let i = 1; i <= r.count; i++) {
    const id = matchIdForRound(r, i);
    const kickoff = schedule[id];
    if (!kickoff?.date || !kickoff?.venue) {
      throw new Error(`Missing official schedule for ${id} in data/knockout-schedule.json`);
    }

    matches.push({
      id,
      stage: r.stage,
      homeTeamId: "TBD",
      awayTeamId: "TBD",
      ...slotsFor(r.stage, i - 1),
      date: kickoff.date,
      venue: kickoff.venue,
      knockoutRound: r.count,
    });
  }
}

writeFileSync(join(root, "data/knockout-fixtures.json"), JSON.stringify(matches, null, 2));
console.log(`Wrote ${matches.length} knockout fixtures from official schedule`);
