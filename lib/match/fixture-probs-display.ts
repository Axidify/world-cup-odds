import type { FixtureWinProbs } from "@/lib/match/group-fixture-probs";

export type FixtureFavorite = {
  side: "home" | "draw" | "away";
  pct: number;
};

export function favoriteFixtureOutcome(probs: FixtureWinProbs): FixtureFavorite {
  if (probs.home >= probs.draw && probs.home >= probs.away) {
    return { side: "home", pct: probs.home };
  }
  if (probs.away >= probs.draw) {
    return { side: "away", pct: probs.away };
  }
  return { side: "draw", pct: probs.draw };
}

export function teamAbbrev(name: string): string {
  const clean = name.replace(/[^a-zA-Z]/g, "");
  return (clean.slice(0, 3) || name.slice(0, 3)).toUpperCase();
}
