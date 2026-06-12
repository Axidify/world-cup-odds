import type { MatchPredictionView, Prediction } from "@/lib/types";
import { getTeamEvents, type TeamEventRow } from "@/lib/news/store";

/**
 * Deterministic news-impact model: converts current squad news (injuries,
 * suspensions, returns) into an Elo-equivalent delta per team, then shifts
 * cached AI win probabilities accordingly. Updates instantly whenever the
 * news poller lands fresh events — no LLM re-run needed.
 */

export type TeamNewsImpact = {
  teamId: string;
  /** Elo-equivalent strength delta (negative = weakened). */
  eloDelta: number;
  reasons: string[];
};

export type AdjustedProbabilities = {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  adjusted: boolean;
};

const SEVERITY_BASE: Record<string, number> = {
  minor: 8,
  moderate: 20,
  major: 40,
};

const KEY_PLAYER_MULTIPLIER = 1.5;
const MAX_TEAM_DELTA = 80;

export function isNewsImpactEnabled(): boolean {
  const raw = process.env.NEWS_IMPACT_ENABLED;
  return raw !== "false" && raw !== "0";
}

function eventDelta(e: Pick<TeamEventRow, "type" | "severity" | "keyPlayer">): number {
  const base = SEVERITY_BASE[e.severity ?? "moderate"] ?? SEVERITY_BASE.moderate;
  const scaled = e.keyPlayer ? base * KEY_PLAYER_MULTIPLIER : base;

  switch (e.type) {
    case "injury":
    case "suspension":
      return -scaled;
    case "return":
      // A returning player restores part of the lost strength.
      return scaled * 0.5;
    case "card":
      // Card accumulation is suspension *risk*, not an absence.
      return -scaled * 0.25;
    default:
      return 0;
  }
}

export function computeImpactFromEvents(
  teamId: string,
  events: Array<Pick<TeamEventRow, "type" | "player" | "severity" | "keyPlayer">>,
): TeamNewsImpact {
  let delta = 0;
  const reasons: string[] = [];

  for (const e of events) {
    const d = eventDelta(e);
    if (d === 0) continue;
    delta += d;
    const who = e.player ?? "unnamed player";
    const tag = e.keyPlayer ? " (key player)" : "";
    reasons.push(`${e.type}: ${who}${tag} ${d > 0 ? "+" : ""}${Math.round(d)}`);
  }

  const capped = Math.max(-MAX_TEAM_DELTA, Math.min(MAX_TEAM_DELTA, delta));
  return { teamId, eloDelta: Math.round(capped), reasons };
}

const CACHE_TTL_MS = 30_000;
const impactCache = new Map<string, { at: number; impact: TeamNewsImpact }>();

export function getTeamNewsImpact(teamId: string): TeamNewsImpact {
  const hit = impactCache.get(teamId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.impact;

  const impact = computeImpactFromEvents(teamId, getTeamEvents(teamId));
  impactCache.set(teamId, { at: Date.now(), impact });
  return impact;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Shift win probabilities by an Elo-equivalent delta using the standard Elo
 * expected-score curve. The draw share is held constant; home/away split moves.
 */
export function adjustProbabilities(
  homeWinPct: number,
  drawPct: number,
  awayWinPct: number,
  homeEloDelta: number,
  awayEloDelta: number,
): AdjustedProbabilities {
  const net = homeEloDelta - awayEloDelta;
  if (net === 0) {
    return { homeWinPct, drawPct, awayWinPct, adjusted: false };
  }

  const expected0 = clamp((homeWinPct + drawPct / 2) / 100, 0.02, 0.98);
  const impliedDiff = -400 * Math.log10(1 / expected0 - 1);
  const expected1 = 1 / (1 + 10 ** (-(impliedDiff + net) / 400));

  const newHome = clamp(expected1 * 100 - drawPct / 2, 1, 99 - drawPct);
  const newAway = 100 - drawPct - newHome;

  return {
    homeWinPct: Math.round(newHome * 10) / 10,
    drawPct,
    awayWinPct: Math.round(newAway * 10) / 10,
    adjusted: true,
  };
}

export type PairNewsImpact = {
  home: TeamNewsImpact;
  away: TeamNewsImpact;
};

export function getPairNewsImpact(homeTeamId: string, awayTeamId: string): PairNewsImpact {
  return {
    home: getTeamNewsImpact(homeTeamId),
    away: getTeamNewsImpact(awayTeamId),
  };
}

/** Fixture-oriented win percentages (0–100) with optional news overlay. */
export function fixturePercentagesWithNews(
  prediction: Prediction,
  homeTeamId: string,
  awayTeamId: string,
): {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  newsAdjusted: boolean;
} {
  const homeIsTeamA = prediction.teamA === homeTeamId;
  const homeWinPct = homeIsTeamA ? prediction.homeWinPct : prediction.awayWinPct;
  const drawPct = prediction.drawPct;
  const awayWinPct = homeIsTeamA ? prediction.awayWinPct : prediction.homeWinPct;

  if (!isNewsImpactEnabled()) {
    return { homeWinPct, drawPct, awayWinPct, newsAdjusted: false };
  }

  const { home, away } = getPairNewsImpact(homeTeamId, awayTeamId);
  const result = adjustProbabilities(homeWinPct, drawPct, awayWinPct, home.eloDelta, away.eloDelta);
  return {
    homeWinPct: result.homeWinPct,
    drawPct: result.drawPct,
    awayWinPct: result.awayWinPct,
    newsAdjusted: result.adjusted,
  };
}

/** Fixture-oriented probabilities (0–1) with optional news overlay. */
export function fixtureProbabilitiesWithNews(
  prediction: Prediction,
  homeTeamId: string,
  awayTeamId: string,
): { home: number; draw: number; away: number; newsAdjusted: boolean } {
  const pct = fixturePercentagesWithNews(prediction, homeTeamId, awayTeamId);
  return {
    home: pct.homeWinPct / 100,
    draw: pct.drawPct / 100,
    away: pct.awayWinPct / 100,
    newsAdjusted: pct.newsAdjusted,
  };
}

/** Apply news overlay to a teamA-oriented stored prediction. */
export function applyNewsImpactToStoredPrediction(prediction: Prediction): Prediction {
  if (!isNewsImpactEnabled()) return prediction;

  const { home, away } = getPairNewsImpact(prediction.teamA, prediction.teamB);
  const result = adjustProbabilities(
    prediction.homeWinPct,
    prediction.drawPct,
    prediction.awayWinPct,
    home.eloDelta,
    away.eloDelta,
  );
  if (!result.adjusted) return prediction;

  return {
    ...prediction,
    homeWinPct: result.homeWinPct,
    drawPct: result.drawPct,
    awayWinPct: result.awayWinPct,
  };
}

/** Apply current news impact to a prediction view (no-op when disabled or no impact). */
export function applyNewsImpactToView(
  view: MatchPredictionView,
  homeTeamId: string,
  awayTeamId: string,
): MatchPredictionView {
  if (!isNewsImpactEnabled()) return view;

  const { home, away } = getPairNewsImpact(homeTeamId, awayTeamId);
  const result = adjustProbabilities(
    view.homeWinPct,
    view.drawPct,
    view.awayWinPct,
    home.eloDelta,
    away.eloDelta,
  );
  if (!result.adjusted) return view;

  return {
    ...view,
    homeWinPct: result.homeWinPct,
    drawPct: result.drawPct,
    awayWinPct: result.awayWinPct,
    newsAdjusted: true,
    newsImpact: { homeEloDelta: home.eloDelta, awayEloDelta: away.eloDelta },
  };
}
