import seedData from "@/data/world-football-elo.json";
import { getTeam } from "@/lib/data/load";

/** 2-letter codes used in https://www.eloratings.net/World.tsv */
export const TEAM_ID_TO_ELO_CODE: Record<string, string> = {
  mex: "MX",
  rsa: "ZA",
  kor: "KR",
  cze: "CZ",
  can: "CA",
  bih: "BA",
  qat: "QA",
  sui: "CH",
  bra: "BR",
  mar: "MA",
  hai: "HT",
  sco: "SQ",
  usa: "US",
  par: "PY",
  aus: "AU",
  tur: "TR",
  ger: "DE",
  cuw: "CW",
  civ: "CI",
  ecu: "EC",
  ned: "NL",
  jpn: "JP",
  swe: "SE",
  tun: "TN",
  bel: "BE",
  egy: "EG",
  irn: "IR",
  nzl: "NZ",
  esp: "ES",
  cpv: "CV",
  ksa: "SA",
  uru: "UY",
  fra: "FR",
  sen: "SN",
  irq: "IQ",
  nor: "NO",
  arg: "AR",
  alg: "DZ",
  aut: "AT",
  jor: "JO",
  por: "PT",
  cod: "CD",
  uzb: "UZ",
  col: "CO",
  eng: "EN",
  cro: "HR",
  gha: "GH",
  pan: "PA",
};

export type WorldFootballEloData = {
  source: string;
  asOf: string;
  ratings: Record<string, number>;
};

const bundled = seedData as WorldFootballEloData;

let liveOverlay: WorldFootballEloData | null = null;

export function getWorldFootballEloData(): WorldFootballEloData {
  return liveOverlay ?? bundled;
}

export function setLiveWorldFootballEloData(next: WorldFootballEloData): void {
  liveOverlay = next;
}

export function clearLiveWorldFootballEloData(): void {
  liveOverlay = null;
}

/** Starting Elo from World Football Elo Ratings (eloratings.net). */
export function getWorldFootballEloSeed(teamId: string): number | null {
  const ratings = getWorldFootballEloData().ratings;
  return ratings[teamId] ?? null;
}

export function getWorldFootballEloSeedForTeam(teamId: string): number {
  const seed = getWorldFootballEloSeed(teamId);
  if (seed != null) return seed;
  const team = getTeam(teamId);
  if (!team) return 1500;
  throw new Error(
    `No World Football Elo seed for ${teamId} — run: node scripts/import-world-football-elo.mjs`,
  );
}
