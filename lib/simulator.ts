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
} from "@/lib/types";
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

function buildGroupResults(
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
