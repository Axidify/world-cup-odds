import type { Match, Team } from "@/lib/types";
import { buildLearningContext } from "./build-context";
import { formatTeamStrengthBlock } from "./team-strength";

// Squad news is excluded from the LLM prompt — probabilities are adjusted on read via lib/news/impact.

export const MATCH_ANALYSIS_SYSTEM_PROMPT = `You are a football analyst for the 2026 FIFA World Cup.
Respond with ONLY valid JSON — no markdown, no code fences, no commentary outside the JSON object.

Required JSON shape:
{
  "homeWinPct": number,
  "drawPct": number,
  "awayWinPct": number,
  "predictedScore": "H-A",
  "keyFactors": ["string", "..."],
  "analysis": "2-3 sentence summary"
}

Rules:
- homeWinPct, drawPct, awayWinPct must be numbers 0-100 that sum to 100.
- homeWinPct is for the HOME team named in the user message; awayWinPct for the AWAY team.
- All World Cup matches are on neutral ground — do not apply home-nation advantage; "home" is fixture orientation only.
- Weight World Football Elo (eloratings.net) heavily — it is the best single strength signal provided.
- Use FIFA rank and confederation as secondary context; be realistic for international football.
- predictedScore format: homeGoals-awayGoals e.g. "2-1".`;

const KNOCKOUT_STAGES = new Set([
  "knockout",
  "r32",
  "r16",
  "qf",
  "sf",
  "final",
  "third_place",
]);

export function buildKnockoutPairPrompt(
  home: Team,
  away: Team,
  stageLabel = "Knockout",
): string {
  return `Analyze this potential World Cup knockout matchup and return probabilities.

Match: ${home.name} (HOME) vs ${away.name} (AWAY)
Stage: ${stageLabel} (neutral ground)

${home.name} (HOME):
${formatTeamStrengthBlock(home)}

${away.name} (AWAY):
${formatTeamStrengthBlock(away)}

Knockout rules: no draws — set drawPct to 0; split 100% between homeWinPct and awayWinPct (includes extra time/penalties if needed).

${buildLearningContext(home, away)}

Return JSON only.`;
}

export function buildMatchUserPrompt(
  match: Match,
  home: Team,
  away: Team,
): string {
  const isKnockout = KNOCKOUT_STAGES.has(match.stage);
  const stageLabel =
    match.stage === "group"
      ? `Group ${match.group} (group stage)`
      : match.stage.replace("_", " ").toUpperCase();

  const knockoutNote = isKnockout
    ? "\nKnockout rules: no draws — set drawPct to 0; split 100% between homeWinPct and awayWinPct (includes extra time/penalties if needed)."
    : "";

  return `Analyze this World Cup match and return probabilities.

Match: ${home.name} (HOME) vs ${away.name} (AWAY)
Stage: ${stageLabel}
Date: ${match.date}
Venue: ${match.venue}

${home.name} (HOME):
${formatTeamStrengthBlock(home)}

${away.name} (AWAY):
${formatTeamStrengthBlock(away)}

${buildLearningContext(home, away)}

Return JSON only.${knockoutNote}`;
}
