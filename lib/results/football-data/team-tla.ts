import { getTeams } from "@/lib/data/load";

/** FIFA 3-letter codes used by football-data.org for World Cup teams. */
const TEAM_ID_TO_TLA: Record<string, string> = {
  mex: "MEX",
  rsa: "RSA",
  kor: "KOR",
  cze: "CZE",
  can: "CAN",
  bih: "BIH",
  qat: "QAT",
  sui: "SUI",
  bra: "BRA",
  mar: "MAR",
  hai: "HAI",
  sco: "SCO",
  usa: "USA",
  par: "PAR",
  aus: "AUS",
  tur: "TUR",
  ger: "GER",
  cuw: "CUW",
  civ: "CIV",
  ecu: "ECU",
  ned: "NED",
  jpn: "JPN",
  swe: "SWE",
  tun: "TUN",
  bel: "BEL",
  egy: "EGY",
  irn: "IRN",
  nzl: "NZL",
  esp: "ESP",
  cpv: "CPV",
  ksa: "KSA",
  uru: "URU",
  fra: "FRA",
  sen: "SEN",
  irq: "IRQ",
  nor: "NOR",
  arg: "ARG",
  alg: "ALG",
  aut: "AUT",
  jor: "JOR",
  por: "POR",
  cod: "COD",
  uzb: "UZB",
  col: "COL",
  eng: "ENG",
  cro: "CRO",
  gha: "GHA",
  pan: "PAN",
};

const TLA_TO_TEAM_ID = Object.fromEntries(
  Object.entries(TEAM_ID_TO_TLA).map(([id, tla]) => [tla, id]),
) as Record<string, string>;

const NAME_ALIASES: Record<string, string> = {
  "korea republic": "kor",
  "south korea": "kor",
  "czechia": "cze",
  "czech republic": "cze",
  "côte d'ivoire": "civ",
  "cote d'ivoire": "civ",
  "ivory coast": "civ",
  "bosnia and herzegovina": "bih",
  "bosnia-herzegovina": "bih",
  "usa": "usa",
  "united states": "usa",
  "ir iran": "irn",
  "iran": "irn",
  "türkiye": "tur",
  "turkey": "tur",
  "congo dr": "cod",
  "dr congo": "cod",
  "cabo verde": "cpv",
  "cape verde": "cpv",
  "curacao": "cuw",
  "curaçao": "cuw",
  "saudi arabia": "ksa",
  haiti: "hai",
  scotland: "sco",
};

export type FootballDataTeamRef = {
  name?: string;
  shortName?: string;
  tla?: string;
};

export function teamIdToTla(teamId: string): string | null {
  return TEAM_ID_TO_TLA[teamId] ?? null;
}

export function resolveTeamIdFromApi(team: FootballDataTeamRef): string | null {
  const tla = team.tla?.trim().toUpperCase();
  if (tla) {
    if (TLA_TO_TEAM_ID[tla]) return TLA_TO_TEAM_ID[tla];
    if (tla === "HTI") return "hai";
  }

  const candidates = [team.shortName, team.name].filter(Boolean) as string[];
  for (const raw of candidates) {
    const key = raw.trim().toLowerCase();
    if (NAME_ALIASES[key]) return NAME_ALIASES[key];
    const byName = getTeams().find((t) => t.name.toLowerCase() === key);
    if (byName) return byName.id;
  }
  return null;
}
