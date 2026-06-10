import { z } from "zod";
import type { RawMatchPrediction } from "./types";

export const matchPredictionSchema = z.object({
  homeWinPct: z.coerce.number(),
  drawPct: z.coerce.number(),
  awayWinPct: z.coerce.number(),
  predictedScore: z.string(),
  keyFactors: z.array(z.string()),
  analysis: z.string(),
});

export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

export function normalizePercentages(home: number, draw: number, away: number): [number, number, number] {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  let h = clamp(home);
  let d = clamp(draw);
  let a = clamp(away);
  const sum = h + d + a;
  if (sum <= 0) return [33.3, 33.3, 33.4];
  h = (h / sum) * 100;
  d = (d / sum) * 100;
  a = (a / sum) * 100;
  const rounded = [h, d, a].map((v) => Math.round(v * 10) / 10) as [number, number, number];
  const drift = 100 - (rounded[0] + rounded[1] + rounded[2]);
  rounded[0] = Math.round((rounded[0] + drift) * 10) / 10;
  return rounded;
}

export function parseMatchPrediction(raw: string): RawMatchPrediction {
  const json = extractJsonObject(raw);
  const parsed = matchPredictionSchema.parse(JSON.parse(json));
  const [homeWinPct, drawPct, awayWinPct] = normalizePercentages(
    parsed.homeWinPct,
    parsed.drawPct,
    parsed.awayWinPct,
  );
  return {
    homeWinPct,
    drawPct,
    awayWinPct,
    predictedScore: parsed.predictedScore,
    keyFactors: parsed.keyFactors,
    analysis: parsed.analysis,
  };
}
