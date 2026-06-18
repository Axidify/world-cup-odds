import { eq } from "drizzle-orm";
import { getTeam } from "@/lib/data/load";
import { getDb } from "@/lib/db";
import { actualResults, predictionLog } from "@/lib/db/schema";
import { getPredictionForPair } from "@/lib/ai/predictions";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { fixtureProbabilitiesWithNews } from "@/lib/news/impact";
import type { Match, Prediction } from "@/lib/types";
import { getResolvedMatch } from "@/lib/data/resolved";
import { formatStageLabel } from "@/lib/utils/match-label";
import { eloProbabilitiesAtKickoff } from "@/lib/calibration/elo-at-kickoff";

import { MIN_ACCURACY_SAMPLE } from "@/lib/calibration/constants";

export type ActualOutcome = "home" | "draw" | "away";

export type StoredPredicted = {
  home: number;
  draw: number;
  away: number;
  baseline?: { home: number; draw: number; away: number };
};

export type PredictionLogEntry = {
  id: string;
  matchId: string;
  cacheKey: string | null;
  predicted: StoredPredicted;
  actual: ActualOutcome;
  brier: number;
  logLoss: number;
  directionCorrect: boolean;
  createdAt: string;
};

export type NewsAccuracyComparison = {
  countWithBaseline: number;
  avgBaselineBrier: number | null;
  avgNewsBrier: number | null;
  /** Positive when news-adjusted Brier is lower (better) than baseline. */
  brierImprovement: number | null;
  newsAdjustedCount: number;
};

export type EloAccuracyComparison = {
  count: number;
  avgAiBrier: number | null;
  avgEloBrier: number | null;
  /** Positive when AI Brier is lower (better) than pure Elo at kickoff. */
  brierImprovement: number | null;
};

export type AccuracySummary = {
  count: number;
  avgBrier: number | null;
  avgLogLoss: number | null;
  directionAccuracy: number | null;
  newsImpact: NewsAccuracyComparison | null;
  eloBaseline: EloAccuracyComparison | null;
  sampleMaturity: "none" | "early" | "meaningful";
  byStage: Record<string, { count: number; avgBrier: number | null; directionAccuracy: number | null }>;
  calibrationBins: Array<{ bin: string; predicted: number; actual: number; count: number }>;
  worstMisses: Array<{
    matchId: string;
    matchLabel: string;
    stage: string;
    stageLabel: string;
    predicted: string;
    actual: string;
    brier: number;
    directionCorrect: boolean;
  }>;
};

function formatFavoritePick(predicted: StoredPredicted, match: Match): string {
  const fav = pickFavoriteOutcome(predicted, match.stage);
  const home = getTeam(match.homeTeamId)?.name ?? "Home";
  const away = getTeam(match.awayTeamId)?.name ?? "Away";
  const pct = Math.round(predicted[fav]);
  if (fav === "home") return `${home} to win (${pct}%)`;
  if (fav === "away") return `${away} to win (${pct}%)`;
  return `Draw (${pct}%)`;
}

function formatActualOutcome(outcome: ActualOutcome, match: Match): string {
  const home = getTeam(match.homeTeamId)?.name ?? "Home";
  const away = getTeam(match.awayTeamId)?.name ?? "Away";
  if (outcome === "home") return `${home} won`;
  if (outcome === "away") return `${away} won`;
  return "Draw";
}

/** Returns null when a knockout winner cannot be determined (level score, no valid winnerTeamId). */
export function deriveActualOutcome(
  match: Match,
  result: { homeScore: number; awayScore: number; winnerTeamId: string | null },
): ActualOutcome | null {
  if (match.stage !== "group") {
    if (result.winnerTeamId === match.homeTeamId) return "home";
    if (result.winnerTeamId === match.awayTeamId) return "away";
    if (result.homeScore > result.awayScore) return "home";
    if (result.awayScore > result.homeScore) return "away";
    return null;
  }
  if (result.homeScore > result.awayScore) return "home";
  if (result.homeScore < result.awayScore) return "away";
  return "draw";
}

export function orientProbabilities(
  prediction: Prediction,
  homeTeamId: string,
): { home: number; draw: number; away: number } {
  if (prediction.teamA === homeTeamId) {
    return {
      home: prediction.homeWinPct / 100,
      draw: prediction.drawPct / 100,
      away: prediction.awayWinPct / 100,
    };
  }
  return {
    home: prediction.awayWinPct / 100,
    draw: prediction.drawPct / 100,
    away: prediction.homeWinPct / 100,
  };
}

export function computeBrier(probs: { home: number; draw: number; away: number }, actual: ActualOutcome): number {
  const actualVec = {
    home: actual === "home" ? 1 : 0,
    draw: actual === "draw" ? 1 : 0,
    away: actual === "away" ? 1 : 0,
  };
  return (
    (probs.home - actualVec.home) ** 2 +
    (probs.draw - actualVec.draw) ** 2 +
    (probs.away - actualVec.away) ** 2
  );
}

export function computeLogLoss(probs: { home: number; draw: number; away: number }, actual: ActualOutcome): number {
  const p = Math.max(0.001, probs[actual]);
  return -Math.log(p);
}

function rankOutcomes(
  probs: { home: number; draw: number; away: number },
  allowDraw: boolean,
): Array<[ActualOutcome, number]> {
  const ranked: Array<[ActualOutcome, number]> = [
    ["home", probs.home],
    ["away", probs.away],
  ];
  if (allowDraw) ranked.push(["draw", probs.draw]);
  ranked.sort((a, b) => b[1] - a[1]);
  return ranked;
}

export function isDirectionCorrect(
  probs: { home: number; draw: number; away: number },
  actual: ActualOutcome,
  options: { allowDraw?: boolean } = {},
): boolean {
  return rankOutcomes(probs, options.allowDraw !== false)[0][0] === actual;
}

export function storedPredictedToProbs(predicted: StoredPredicted) {
  return {
    home: predicted.home / 100,
    draw: predicted.draw / 100,
    away: predicted.away / 100,
  };
}

function pctFromProbs(probs: { home: number; draw: number; away: number }): StoredPredicted {
  return {
    home: Math.round(probs.home * 1000) / 10,
    draw: Math.round(probs.draw * 1000) / 10,
    away: Math.round(probs.away * 1000) / 10,
  };
}

function parseStoredPredicted(raw: string): StoredPredicted {
  const parsed = JSON.parse(raw) as StoredPredicted;
  return {
    home: parsed.home,
    draw: parsed.draw,
    away: parsed.away,
    baseline: parsed.baseline,
  };
}

function computeNewsAccuracyComparison(entries: PredictionLogEntry[]): NewsAccuracyComparison | null {
  const withBaseline = entries.filter((e) => e.predicted.baseline != null);
  if (withBaseline.length === 0) return null;

  let baselineBrierSum = 0;
  let newsBrierSum = 0;
  let newsAdjustedCount = 0;

  for (const e of withBaseline) {
    const baseline = e.predicted.baseline!;
    const baselineProbs = storedPredictedToProbs(baseline);
    const newsProbs = storedPredictedToProbs(e.predicted);
    baselineBrierSum += computeBrier(baselineProbs, e.actual);
    newsBrierSum += computeBrier(newsProbs, e.actual);
    if (
      baseline.home !== e.predicted.home ||
      baseline.draw !== e.predicted.draw ||
      baseline.away !== e.predicted.away
    ) {
      newsAdjustedCount += 1;
    }
  }

  const avgBaselineBrier = baselineBrierSum / withBaseline.length;
  const avgNewsBrier = newsBrierSum / withBaseline.length;

  return {
    countWithBaseline: withBaseline.length,
    avgBaselineBrier: Math.round(avgBaselineBrier * 1000) / 1000,
    avgNewsBrier: Math.round(avgNewsBrier * 1000) / 1000,
    brierImprovement: Math.round((avgBaselineBrier - avgNewsBrier) * 1000) / 1000,
    newsAdjustedCount,
  };
}

function computeEloAccuracyComparison(entries: PredictionLogEntry[]): EloAccuracyComparison | null {
  if (entries.length === 0) return null;

  let aiBrierSum = 0;
  let eloBrierSum = 0;
  let count = 0;

  for (const e of entries) {
    const eloProbs = eloProbabilitiesAtKickoff(e.matchId);
    if (!eloProbs) continue;
    const aiProbs = storedPredictedToProbs(e.predicted);
    aiBrierSum += computeBrier(aiProbs, e.actual);
    eloBrierSum += computeBrier(eloProbs, e.actual);
    count += 1;
  }

  if (count === 0) return null;

  const avgAiBrier = aiBrierSum / count;
  const avgEloBrier = eloBrierSum / count;

  return {
    count,
    avgAiBrier: Math.round(avgAiBrier * 1000) / 1000,
    avgEloBrier: Math.round(avgEloBrier * 1000) / 1000,
    brierImprovement: Math.round((avgEloBrier - avgAiBrier) * 1000) / 1000,
  };
}

function sampleMaturity(count: number): AccuracySummary["sampleMaturity"] {
  if (count === 0) return "none";
  if (count < MIN_ACCURACY_SAMPLE) return "early";
  return "meaningful";
}

export function pickFavoriteOutcome(
  predicted: { home: number; draw: number; away: number },
  stage?: string,
): ActualOutcome {
  const allowDraw = !stage || stage === "group";
  return rankOutcomes(storedPredictedToProbs(predicted), allowDraw)[0][0];
}

function findPredictionForLogging(match: Match): Prediction | null {
  const provider = resolveActiveProvider();
  if (!provider) return null;
  return getPredictionForPair(match.homeTeamId, match.awayTeamId, match.stage, provider);
}

function parseLogRow(row: typeof predictionLog.$inferSelect): PredictionLogEntry {
  const predicted = parseStoredPredicted(row.predicted);
  const actual = row.actual as ActualOutcome;
  const probs = storedPredictedToProbs(predicted);
  const match = getResolvedMatch(row.matchId);
  const allowDraw = match?.stage === "group";
  return {
    id: row.id,
    matchId: row.matchId,
    cacheKey: row.cacheKey,
    predicted,
    actual,
    brier: row.brier ?? computeBrier(probs, actual),
    logLoss: row.logLoss ?? computeLogLoss(probs, actual),
    directionCorrect: isDirectionCorrect(probs, actual, { allowDraw }),
    createdAt: row.createdAt,
  };
}

export function logPredictionAccuracy(matchId: string): PredictionLogEntry | null {
  const match = getResolvedMatch(matchId);
  if (!match || match.homeTeamId === "TBD" || match.awayTeamId === "TBD") return null;

  const db = getDb();
  const existing = db.select().from(predictionLog).where(eq(predictionLog.matchId, matchId)).get();

  const resultRow = db
    .select()
    .from(actualResults)
    .where(eq(actualResults.matchId, matchId))
    .get();
  if (!resultRow || resultRow.confirmed !== 1) {
    return existing ? parseLogRow(existing) : null;
  }
  if (resultRow.homeScore == null || resultRow.awayScore == null) {
    return existing ? parseLogRow(existing) : null;
  }

  const prediction = findPredictionForLogging(match);
  if (!prediction) return existing ? parseLogRow(existing) : null;

  const baselineProbs = orientProbabilities(prediction, match.homeTeamId);
  const kickoffMs = new Date(match.date).getTime();
  const adjusted = fixtureProbabilitiesWithNews(prediction, match.homeTeamId, match.awayTeamId, {
    kickoffIso: match.date,
    referenceTimeMs: kickoffMs,
  });
  const probs = {
    home: adjusted.home,
    draw: adjusted.draw,
    away: adjusted.away,
  };
  const actual = deriveActualOutcome(match, {
    homeScore: resultRow.homeScore,
    awayScore: resultRow.awayScore,
    winnerTeamId: resultRow.winnerTeamId,
  });
  if (!actual) return existing ? parseLogRow(existing) : null;
  const brier = computeBrier(probs, actual);
  const logLoss = computeLogLoss(probs, actual);
  const predictedJson = JSON.stringify({
    ...pctFromProbs(probs),
    baseline: pctFromProbs(baselineProbs),
  });

  if (existing) {
    return parseLogRow(existing);
  }

  const id = `log-${matchId}`;
  const now = new Date().toISOString();

  db.insert(predictionLog)
    .values({
      id,
      matchId,
      cacheKey: prediction.cacheKey,
      predicted: predictedJson,
      actual,
      brier,
      logLoss,
      createdAt: now,
    })
    .run();

  return parseLogRow(db.select().from(predictionLog).where(eq(predictionLog.id, id)).get()!);
}

/** Grade confirmed matches that were logged before a prediction existed. Skips existing rows. */
export function backfillPredictionAccuracyLogs(): { attempted: number; added: number } {
  const db = getDb();
  const confirmed = db
    .select({ matchId: actualResults.matchId })
    .from(actualResults)
    .where(eq(actualResults.confirmed, 1))
    .all();
  const loggedIds = new Set(
    db.select({ matchId: predictionLog.matchId }).from(predictionLog).all().map((r) => r.matchId),
  );

  let attempted = 0;
  let added = 0;
  for (const { matchId } of confirmed) {
    if (loggedIds.has(matchId)) continue;
    attempted += 1;
    const entry = logPredictionAccuracy(matchId);
    if (entry) {
      added += 1;
      loggedIds.add(matchId);
    }
  }

  return { attempted, added };
}

export function getAccuracySummary(): AccuracySummary {
  backfillPredictionAccuracyLogs();

  const db = getDb();
  const rows = db.select().from(predictionLog).all();
  const entries = rows.map(parseLogRow);

  if (entries.length === 0) {
    return {
      count: 0,
      avgBrier: null,
      avgLogLoss: null,
      directionAccuracy: null,
      newsImpact: null,
      eloBaseline: null,
      sampleMaturity: "none",
      byStage: {},
      calibrationBins: [],
      worstMisses: [],
    };
  }

  const avgBrier = entries.reduce((s, e) => s + e.brier, 0) / entries.length;
  const avgLogLoss = entries.reduce((s, e) => s + e.logLoss, 0) / entries.length;
  const directionHits = entries.filter((e) => e.directionCorrect).length;

  const byStage: AccuracySummary["byStage"] = {};
  for (const e of entries) {
    const match = getResolvedMatch(e.matchId);
    const stage = match?.stage ?? "unknown";
    if (!byStage[stage]) byStage[stage] = { count: 0, avgBrier: null, directionAccuracy: null };
    byStage[stage].count += 1;
  }
  for (const stage of Object.keys(byStage)) {
    const stageEntries = entries.filter((e) => (getResolvedMatch(e.matchId)?.stage ?? "unknown") === stage);
    byStage[stage].avgBrier = stageEntries.reduce((s, e) => s + e.brier, 0) / stageEntries.length;
    byStage[stage].directionAccuracy =
      Math.round(
        (stageEntries.filter((e) => e.directionCorrect).length / stageEntries.length) * 1000,
      ) / 10;
  }

  const bins = Array.from({ length: 10 }, (_, i) => ({
    bin: `${i * 10}-${(i + 1) * 10}%`,
    predicted: 0,
    actual: 0,
    count: 0,
  }));

  for (const e of entries) {
    const match = getResolvedMatch(e.matchId);
    if (!match) continue;
    const fav = pickFavoriteOutcome(e.predicted, match.stage);
    const favProb = e.predicted[fav] / 100;
    const binIdx = Math.min(9, Math.floor(favProb * 10));
    bins[binIdx].count += 1;
    bins[binIdx].predicted += favProb;
    bins[binIdx].actual += e.directionCorrect ? 1 : 0;
  }

  const calibrationBins = bins
    .filter((b) => b.count > 0)
    .map((b) => ({
      bin: b.bin,
      predicted: Math.round((b.predicted / b.count) * 100),
      actual: Math.round((b.actual / b.count) * 100),
      count: b.count,
    }));

  const worstMisses = [...entries]
    .sort((a, b) => {
      const dateA = getResolvedMatch(a.matchId)?.date ?? "";
      const dateB = getResolvedMatch(b.matchId)?.date ?? "";
      return dateB.localeCompare(dateA);
    })
    .map((e) => {
      const match = getResolvedMatch(e.matchId);
      if (!match) {
        return {
          matchId: e.matchId,
          matchLabel: e.matchId,
          stage: "?",
          stageLabel: "Unknown",
          predicted: "—",
          actual: e.actual,
          brier: Math.round(e.brier * 1000) / 1000,
          directionCorrect: e.directionCorrect,
        };
      }
      const home = getTeam(match.homeTeamId)?.name ?? "Home";
      const away = getTeam(match.awayTeamId)?.name ?? "Away";
      return {
        matchId: e.matchId,
        matchLabel: `${home} vs ${away}`,
        stage: match.stage,
        stageLabel: formatStageLabel(match.stage),
        predicted: formatFavoritePick(e.predicted, match),
        actual: formatActualOutcome(e.actual, match),
        brier: Math.round(e.brier * 1000) / 1000,
        directionCorrect: e.directionCorrect,
      };
    });

  return {
    count: entries.length,
    avgBrier: Math.round(avgBrier * 1000) / 1000,
    avgLogLoss: Math.round(avgLogLoss * 1000) / 1000,
    directionAccuracy: Math.round((directionHits / entries.length) * 1000) / 10,
    newsImpact: computeNewsAccuracyComparison(entries),
    eloBaseline: computeEloAccuracyComparison(entries),
    sampleMaturity: sampleMaturity(entries.length),
    byStage,
    calibrationBins,
    worstMisses,
  };
}
