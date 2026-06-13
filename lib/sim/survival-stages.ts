/** Knockout progression tracked in Monte Carlo survival odds. */
export const SURVIVAL_STAGES = [
  "qualify",
  "r16",
  "qf",
  "sf",
  "final",
  "champion",
] as const;

export type SurvivalStage = (typeof SURVIVAL_STAGES)[number];

export const SURVIVAL_STAGE_LABELS: Record<SurvivalStage, string> = {
  qualify: "Qualify",
  r16: "Round of 16",
  qf: "Quarter-final",
  sf: "Semi-final",
  final: "Final",
  champion: "Champion",
};

export type TeamSurvivalOdds = Record<SurvivalStage, number>;

export type SurvivalOddsMap = Record<string, TeamSurvivalOdds>;

export function emptySurvivalCounts(teams: string[]): Map<string, Record<SurvivalStage, number>> {
  const map = new Map<string, Record<SurvivalStage, number>>();
  for (const id of teams) {
    map.set(id, {
      qualify: 0,
      r16: 0,
      qf: 0,
      sf: 0,
      final: 0,
      champion: 0,
    });
  }
  return map;
}

export function survivalCountsToOdds(
  counts: Map<string, Record<SurvivalStage, number>>,
  iterations: number,
): SurvivalOddsMap {
  const out: SurvivalOddsMap = {};
  for (const [teamId, row] of counts) {
    out[teamId] = {
      qualify: (row.qualify / iterations) * 100,
      r16: (row.r16 / iterations) * 100,
      qf: (row.qf / iterations) * 100,
      sf: (row.sf / iterations) * 100,
      final: (row.final / iterations) * 100,
      champion: (row.champion / iterations) * 100,
    };
  }
  return out;
}
