import type { Match } from "@/lib/types";
import { getAllMatches } from "@/lib/data/load";

const KNOCKOUT_STAGES = new Set([
  "knockout",
  "r32",
  "r16",
  "qf",
  "sf",
  "final",
  "third_place",
]);

export function isKnockoutStage(stage: string): boolean {
  return KNOCKOUT_STAGES.has(stage);
}

export function getEarliestKickoff(): string | null {
  const matches = getAllMatches().filter(
    (m) => m.homeTeamId !== "TBD" && m.awayTeamId !== "TBD",
  );
  if (matches.length === 0) return null;
  return matches.reduce((min, m) => (m.date < min ? m.date : min), matches[0].date);
}

/** ISO timestamp when champion bets lock (env override or earliest kickoff). */
export function getTournamentLockAt(): string | null {
  const configured = process.env.TOURNAMENT_LOCK_AT?.trim();
  if (configured) return configured;
  return getEarliestKickoff();
}

export function isTournamentLocked(now = new Date()): boolean {
  const lockAt = getTournamentLockAt();
  if (!lockAt) return false;
  return now.getTime() >= new Date(lockAt).getTime();
}

export function isMatchBettingLocked(match: Match, now = new Date()): boolean {
  return now.getTime() >= new Date(match.date).getTime();
}

/** Office pool runs on a fixed champion-bet stake (default RM 100). */
export function getFixedStakeMyr(): number {
  const raw = Number(process.env.POOL_FIXED_STAKE_MYR ?? 100);
  if (!Number.isFinite(raw) || raw <= 0) return 100;
  return raw;
}
