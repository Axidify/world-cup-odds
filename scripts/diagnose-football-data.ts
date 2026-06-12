import { loadEnvLocal } from "./load-env";

loadEnvLocal();

async function main() {
  const { getDb } = await import("@/lib/db");
  const { getResult } = await import("@/lib/results/store");
  const { runResultsPollJob } = await import("@/lib/jobs/poll-results");
  const { fetchWorldCupMatches } = await import("@/lib/results/football-data/client");
  const { indexFinishedMatches } = await import("@/lib/results/football-data/sync");
  const { getMatch } = await import("@/lib/data/load");

  getDb();

  const matches = await fetchWorldCupMatches();
  const finished = matches.filter((m) => m.status === "FINISHED").length;
  console.log(`API: ${matches.length} matches, ${finished} FINISHED`);

  const local = getMatch("grp-a-2");
  if (local) {
    const indexed = indexFinishedMatches(matches, [local]);
    console.log("grp-a-2 link:", indexed.get("grp-a-2") ?? "no match");
  }

  console.log("before:", getResult("grp-a-2"));
  const poll = await runResultsPollJob();
  console.log("poll:", poll);
  console.log("after:", getResult("grp-a-2"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
