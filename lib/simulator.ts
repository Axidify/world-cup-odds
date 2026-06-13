import { getBracketTemplate, getFixtures, getGroups, getKnockoutFixtures, getTeams } from "@/lib/data/load";
import {
  buildR32Pairings,
  collectQualifiedThirdGroups,
  resolveKnockoutTeams,
} from "@/lib/bracket";
import {
  buildFifaRankMap,
  buildGroupStandings,
  rankThirdPlaceTeams,
  sortGroupStandings,
} from "@/lib/standings";
import type {
  ChampionOddsMap,
  GroupStanding,
  KnockoutPathMatch,
  Match,
  MatchStage,
  PlayedMatchResult,
  PredictedPath,
  SimulationExtras,
} from "@/lib/types";
import {
  emptySurvivalCounts,
  type SurvivalStage,
  survivalCountsToOdds,
} from "@/lib/sim/survival-stages";
import { buildSanityAlerts } from "@/lib/sim/sanity-alerts";
import {
  goalsFromOutcome,
  modalKnockoutWinner,
  modalOutcome,
  sampleKnockoutWinner,
  sampleOutcome,
} from "@/lib/sim/match-outcomes";
import type { PredictionStore } from "@/lib/sim/prediction-store";
import { createRng, getSimulationSeed } from "@/lib/sim/rng";

const KNOCKOUT_ORDER: MatchStage[] = ["r32", "r16", "qf", "sf", "third_place", "final"];

export function getSimulationIterations(): number {
  const n = Number(process.env.SIMULATION_ITERATIONS ?? 5000);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5000;
}

type TournamentContext = {
  standingsByGroup: Record<string, GroupStanding[]>;
  thirdByGroup: Record<string, GroupStanding>;
  qualifiedThirdGroups: string[];
};

export function buildGroupResults(
  fixtures: Match[],
  store: PredictionStore,
  confirmed: Map<string, PlayedMatchResult>,
  rng: (() => number) | null,
): PlayedMatchResult[] {
  const results: PlayedMatchResult[] = [];
  for (const m of fixtures) {
    if (m.homeTeamId === "TBD" || m.awayTeamId === "TBD") continue;
    const confirmedRow = confirmed.get(m.id);
    if (confirmedRow) {
      results.push({
        matchId: m.id,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeGoals: confirmedRow.homeGoals,
        awayGoals: confirmedRow.awayGoals,
      });
      continue;
    }
    const pred = store.get(m.homeTeamId, m.awayTeamId, "group", m.id);
    const outcome = rng ? sampleOutcome(rng, pred, m.homeTeamId) : modalOutcome(pred, m.homeTeamId);
    const { homeGoals, awayGoals } = goalsFromOutcome(outcome, pred);
    results.push({
      matchId: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeGoals,
      awayGoals,
    });
  }
  return results;
}

function computeTournamentContext(groupResults: PlayedMatchResult[]): TournamentContext {
  const groups = getGroups();
  const teams = getTeams();
  const fifa = buildFifaRankMap(teams);
  const standingsByGroup: Record<string, GroupStanding[]> = {};
  const thirdRows: GroupStanding[] = [];
  const thirdByGroup: Record<string, GroupStanding> = {};

  for (const g of groups) {
    const groupMatches = groupResults.filter(
      (r) => g.teamIds.includes(r.homeTeamId as (typeof g.teamIds)[number]),
    );
    const raw = buildGroupStandings(g.group, [...g.teamIds], groupMatches);
    const sorted = sortGroupStandings(raw, groupMatches, fifa);
    standingsByGroup[g.group] = sorted;
    const third = sorted[2];
    if (third) {
      thirdRows.push(third);
      thirdByGroup[g.group] = third;
    }
  }

  const rankedThird = rankThirdPlaceTeams(thirdRows, fifa);
  const qualifiedThirdGroups = collectQualifiedThirdGroups(rankedThird);

  return { standingsByGroup, thirdByGroup, qualifiedThirdGroups };
}

function pickKnockoutWinner(
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  stage: string,
  store: PredictionStore,
  confirmed: Map<string, PlayedMatchResult>,
  rng: (() => number) | null,
): string {
  const conf = confirmed.get(matchId);
  if (conf) {
    if (conf.winnerTeamId) return conf.winnerTeamId;
    // Decisive confirmed score without explicit winner — derive it rather
    // than falling through to AI predictions.
    if (conf.homeGoals > conf.awayGoals) return homeTeamId;
    if (conf.awayGoals > conf.homeGoals) return awayTeamId;
  }

  const pred = store.get(homeTeamId, awayTeamId, stage, matchId);
  return rng
    ? sampleKnockoutWinner(rng, pred, homeTeamId, awayTeamId)
    : modalKnockoutWinner(pred, homeTeamId, awayTeamId);
}

function runKnockout(
  store: PredictionStore,
  ctx: TournamentContext,
  confirmed: Map<string, PlayedMatchResult>,
  rng: (() => number) | null,
  recordPath: boolean,
): { championTeamId: string; path: KnockoutPathMatch[] } {
  const template = getBracketTemplate();
  const knockout = getKnockoutFixtures();
  const r32 = buildR32Pairings(
    template,
    ctx.standingsByGroup,
    ctx.qualifiedThirdGroups,
    ctx.thirdByGroup,
  );

  const winners = new Map<string, string>();
  const losers = new Map<string, string>();
  const path: KnockoutPathMatch[] = [];

  for (const p of r32) {
    const winner = pickKnockoutWinner(
      p.matchId,
      p.homeTeamId,
      p.awayTeamId,
      "r32",
      store,
      confirmed,
      rng,
    );
    const loser = winner === p.homeTeamId ? p.awayTeamId : p.homeTeamId;
    winners.set(p.matchId, winner);
    losers.set(p.matchId, loser);
    if (recordPath) {
      path.push({
        matchId: p.matchId,
        stage: "r32",
        homeTeamId: p.homeTeamId,
        awayTeamId: p.awayTeamId,
        winnerTeamId: winner,
      });
    }
  }

  const later = knockout
    .filter((m) => m.stage !== "r32")
    .sort((a, b) => KNOCKOUT_ORDER.indexOf(a.stage) - KNOCKOUT_ORDER.indexOf(b.stage));

  for (const m of later) {
    const { homeTeamId, awayTeamId } = resolveKnockoutTeams(m, winners, losers);
    const winner = pickKnockoutWinner(
      m.id,
      homeTeamId,
      awayTeamId,
      m.stage,
      store,
      confirmed,
      rng,
    );
    const loser = winner === homeTeamId ? awayTeamId : homeTeamId;
    winners.set(m.id, winner);
    losers.set(m.id, loser);
    if (recordPath) {
      path.push({
        matchId: m.id,
        stage: m.stage,
        homeTeamId,
        awayTeamId,
        winnerTeamId: winner,
      });
    }
  }

  const finalFixture = knockout.find((m) => m.stage === "final");
  const championTeamId =
    (finalFixture ? winners.get(finalFixture.id) : undefined) ??
    path.find((p) => p.stage === "final")?.winnerTeamId ??
    path[path.length - 1]?.winnerTeamId ??
    "";
  return { championTeamId, path };
}

export function runModalTournament(
  store: PredictionStore,
  confirmed: Map<string, PlayedMatchResult> = new Map(),
): PredictedPath {
  const fixtures = getFixtures();
  const groupResults = buildGroupResults(fixtures, store, confirmed, null);
  const ctx = computeTournamentContext(groupResults);
  const { championTeamId, path } = runKnockout(store, ctx, confirmed, null, true);
  return {
    groupStandings: ctx.standingsByGroup,
    groupResults,
    knockout: path,
    championTeamId,
  };
}

export function runSingleMonteCarloIteration(
  store: PredictionStore,
  rng: () => number,
  confirmed: Map<string, PlayedMatchResult> = new Map(),
): string {
  const fixtures = getFixtures();
  const groupResults = buildGroupResults(fixtures, store, confirmed, rng);
  const ctx = computeTournamentContext(groupResults);
  const { championTeamId } = runKnockout(store, ctx, confirmed, rng, false);
  return championTeamId;
}

/** Full tournament with sampled outcomes and recorded path (one Monte Carlo draw). */
export function runSampledTournament(
  store: PredictionStore,
  rng: () => number,
  confirmed: Map<string, PlayedMatchResult> = new Map(),
): PredictedPath {
  const fixtures = getFixtures();
  const groupResults = buildGroupResults(fixtures, store, confirmed, rng);
  const ctx = computeTournamentContext(groupResults);
  const { championTeamId, path } = runKnockout(store, ctx, confirmed, rng, true);
  return {
    groupStandings: ctx.standingsByGroup,
    groupResults,
    knockout: path,
    championTeamId,
  };
}

export function knockoutPathFingerprint(knockout: KnockoutPathMatch[]): string {
  return knockout.map((m) => `${m.matchId}:${m.winnerTeamId}`).join("|");
}

export function championOddsLeader(odds: ChampionOddsMap): string {
  let leader = "";
  let best = -1;
  for (const [teamId, pct] of Object.entries(odds)) {
    if (pct > best) {
      best = pct;
      leader = teamId;
    }
  }
  return leader;
}

type PathHistogramEntry = {
  count: number;
  path: PredictedPath;
  firstIndex: number;
};

/**
 * Among Monte Carlo runs where the odds leader wins, pick the most common knockout path.
 * Ties break on earliest simulation index (reproducible).
 */
export function buildRepresentativePredictedPath(
  store: PredictionStore,
  championOdds: ChampionOddsMap,
  confirmed: Map<string, PlayedMatchResult>,
  iterations: number,
  seed: number,
): PredictedPath {
  const leader = championOddsLeader(championOdds);
  if (!leader) return runModalTournament(store, confirmed);

  const histogram = new Map<string, PathHistogramEntry>();

  for (let i = 0; i < iterations; i++) {
    const rng = createRng(seed + i);
    const champion = runSingleMonteCarloIteration(store, rng, confirmed);
    if (champion !== leader) continue;

    const sampled = runSampledTournament(store, createRng(seed + i), confirmed);
    const fingerprint = knockoutPathFingerprint(sampled.knockout);
    const existing = histogram.get(fingerprint);
    if (!existing) {
      histogram.set(fingerprint, { count: 1, path: sampled, firstIndex: i });
      continue;
    }
    existing.count += 1;
  }

  if (histogram.size === 0) return runModalTournament(store, confirmed);

  let best: PathHistogramEntry | null = null;
  for (const entry of histogram.values()) {
    if (
      !best ||
      entry.count > best.count ||
      (entry.count === best.count && entry.firstIndex < best.firstIndex)
    ) {
      best = entry;
    }
  }

  return best!.path;
}

export function runMonteCarlo(
  store: PredictionStore,
  iterations = getSimulationIterations(),
  seed = getSimulationSeed(),
  confirmed: Map<string, PlayedMatchResult> = new Map(),
): ChampionOddsMap {
  const teams = getTeams();
  const counts = new Map(teams.map((t) => [t.id, 0]));
  const s = seed;
  for (let i = 0; i < iterations; i++) {
    const rng = createRng(s + i);
    const champion = runSingleMonteCarloIteration(store, rng, confirmed);
    counts.set(champion, (counts.get(champion) ?? 0) + 1);
  }
  const odds: ChampionOddsMap = {};
  for (const [teamId, count] of counts) {
    odds[teamId] = (count / iterations) * 100;
  }
  return odds;
}

export function normalizeChampionOdds(odds: ChampionOddsMap): ChampionOddsMap {
  const sum = Object.values(odds).reduce((a, b) => a + b, 0);
  if (sum <= 0) return odds;
  const out: ChampionOddsMap = {};
  for (const [id, pct] of Object.entries(odds)) {
    out[id] = (pct / sum) * 100;
  }
  return out;
}

function qualifiedTeamIds(ctx: TournamentContext): Set<string> {
  const out = new Set<string>();
  for (const standings of Object.values(ctx.standingsByGroup)) {
    const first = standings.find((s) => s.position === 1);
    const second = standings.find((s) => s.position === 2);
    if (first) out.add(first.teamId);
    if (second) out.add(second.teamId);
  }
  for (const g of ctx.qualifiedThirdGroups) {
    const third = ctx.thirdByGroup[g];
    if (third) out.add(third.teamId);
  }
  return out;
}

function recordSurvival(
  counts: Map<string, Record<SurvivalStage, number>>,
  ctx: TournamentContext,
  path: KnockoutPathMatch[],
  championTeamId: string,
): void {
  for (const id of qualifiedTeamIds(ctx)) {
    const row = counts.get(id);
    if (row) row.qualify += 1;
  }
  const stageMap: Array<{ stage: MatchStage; survival: SurvivalStage }> = [
    { stage: "r32", survival: "r16" },
    { stage: "r16", survival: "qf" },
    { stage: "qf", survival: "sf" },
    { stage: "sf", survival: "final" },
    { stage: "final", survival: "champion" },
  ];
  for (const { stage, survival } of stageMap) {
    for (const m of path.filter((p) => p.stage === stage)) {
      const row = counts.get(m.winnerTeamId);
      if (row) row[survival] += 1;
    }
  }
  if (championTeamId) {
    const row = counts.get(championTeamId);
    if (row) row.champion += 1;
  }
}

type GroupPosHistogram = Map<string, Map<number, Map<string, number>>>;

function recordGroupHistogram(hist: GroupPosHistogram, standings: GroupStanding[]): void {
  for (const row of standings) {
    let groupMap = hist.get(row.group);
    if (!groupMap) {
      groupMap = new Map();
      hist.set(row.group, groupMap);
    }
    let posMap = groupMap.get(row.position);
    if (!posMap) {
      posMap = new Map();
      groupMap.set(row.position, posMap);
    }
    posMap.set(row.teamId, (posMap.get(row.teamId) ?? 0) + 1);
  }
}

export function buildModalGroupStandings(hist: GroupPosHistogram): Record<string, GroupStanding[]> {
  const out: Record<string, GroupStanding[]> = {};
  for (const [group, posMap] of hist) {
    const rows: GroupStanding[] = [];
    for (let position = 1; position <= 4; position += 1) {
      const teamCounts = posMap.get(position);
      if (!teamCounts || teamCounts.size === 0) continue;
      let bestTeam = "";
      let bestCount = -1;
      for (const [teamId, count] of teamCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestTeam = teamId;
        }
      }
      rows.push({
        teamId: bestTeam,
        group,
        played: 3,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: position <= 2 ? 6 : position === 3 ? 3 : 0,
        position,
      });
    }
    rows.sort((a, b) => a.position - b.position);
    out[group] = rows;
  }
  return out;
}

export type MonteCarloBundle = {
  championOdds: ChampionOddsMap;
  survivalOdds: ReturnType<typeof survivalCountsToOdds>;
  modalGroupStandings: Record<string, GroupStanding[]>;
};

/** Single-pass Monte Carlo: champion %, survival-by-round, modal group tables. */
export function runMonteCarloBundle(
  store: PredictionStore,
  iterations = getSimulationIterations(),
  seed = getSimulationSeed(),
  confirmed: Map<string, PlayedMatchResult> = new Map(),
): MonteCarloBundle {
  const teams = getTeams();
  const championCounts = new Map(teams.map((t) => [t.id, 0]));
  const survivalCounts = emptySurvivalCounts(teams.map((t) => t.id));
  const groupHist: GroupPosHistogram = new Map();
  const fixtures = getFixtures();

  for (let i = 0; i < iterations; i++) {
    const rng = createRng(seed + i);
    const groupResults = buildGroupResults(fixtures, store, confirmed, rng);
    const ctx = computeTournamentContext(groupResults);
    for (const standings of Object.values(ctx.standingsByGroup)) {
      recordGroupHistogram(groupHist, standings);
    }
    const { championTeamId, path } = runKnockout(store, ctx, confirmed, rng, true);
    championCounts.set(championTeamId, (championCounts.get(championTeamId) ?? 0) + 1);
    recordSurvival(survivalCounts, ctx, path, championTeamId);
  }

  const championOdds: ChampionOddsMap = {};
  for (const [teamId, count] of championCounts) {
    championOdds[teamId] = (count / iterations) * 100;
  }

  return {
    championOdds,
    survivalOdds: survivalCountsToOdds(survivalCounts, iterations),
    modalGroupStandings: buildModalGroupStandings(groupHist),
  };
}

export function buildSimulationExtras(
  championOdds: ChampionOddsMap,
  championOddsBase: ChampionOddsMap,
  survivalOdds: ReturnType<typeof survivalCountsToOdds>,
  modalGroupStandings: Record<string, GroupStanding[]>,
  iterations: number,
  leaderTeamId: string,
): SimulationExtras {
  const leaderName = getTeams().find((t) => t.id === leaderTeamId)?.name ?? leaderTeamId.toUpperCase();

  return {
    championOddsBase,
    survivalOdds,
    modalGroupStandings,
    sanityAlerts: buildSanityAlerts(championOdds, championOddsBase, modalGroupStandings),
    representativePathNote: `Knockout tree: most common path when ${leaderName} wins the tournament. Group tables below show the most frequent finisher per position across all ${iterations.toLocaleString()} simulations.`,
  };
}
