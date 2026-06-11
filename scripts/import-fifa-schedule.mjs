/**
 * Rebuild data/fixtures.json from the official FIFA World Cup 2026 group schedule.
 * Times are UTC (FIFA kickoffs converted from published local schedules).
 *
 * Run: node scripts/import-fifa-schedule.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const FIFA = {
  MEX: "mex",
  RSA: "rsa",
  KOR: "kor",
  CZE: "cze",
  CAN: "can",
  BIH: "bih",
  QAT: "qat",
  SUI: "sui",
  USA: "usa",
  PAR: "par",
  BRA: "bra",
  MAR: "mar",
  HAI: "hai",
  SCO: "sco",
  AUS: "aus",
  TUR: "tur",
  GER: "ger",
  CUW: "cuw",
  NED: "ned",
  JPN: "jpn",
  CIV: "civ",
  ECU: "ecu",
  SWE: "swe",
  TUN: "tun",
  ESP: "esp",
  CPV: "cpv",
  BEL: "bel",
  EGY: "egy",
  KSA: "ksa",
  URU: "uru",
  IRN: "irn",
  NZL: "nzl",
  FRA: "fra",
  SEN: "sen",
  IRQ: "irq",
  NOR: "nor",
  ARG: "arg",
  ALG: "alg",
  AUT: "aut",
  JOR: "jor",
  POR: "por",
  COD: "cod",
  UZB: "uzb",
  COL: "col",
  ENG: "eng",
  CRO: "cro",
  GHA: "gha",
  PAN: "pan",
};

/** Official group-stage fixtures — home, away, ISO UTC kickoff, venue */
const OFFICIAL = [
  ["A", "MEX", "RSA", "2026-06-11T19:00:00.000Z", "Estadio Azteca, Mexico City"],
  ["A", "KOR", "CZE", "2026-06-12T02:00:00.000Z", "Estadio Akron, Guadalajara"],
  ["B", "CAN", "BIH", "2026-06-12T19:00:00.000Z", "BMO Field, Toronto"],
  ["D", "USA", "PAR", "2026-06-13T01:00:00.000Z", "SoFi Stadium, Los Angeles"],
  ["B", "QAT", "SUI", "2026-06-13T19:00:00.000Z", "Levi's Stadium, San Francisco"],
  ["C", "BRA", "MAR", "2026-06-13T22:00:00.000Z", "MetLife Stadium, New Jersey"],
  ["C", "HAI", "SCO", "2026-06-14T01:00:00.000Z", "Gillette Stadium, Boston"],
  ["D", "AUS", "TUR", "2026-06-14T04:00:00.000Z", "BC Place, Vancouver"],
  ["E", "GER", "CUW", "2026-06-14T17:00:00.000Z", "NRG Stadium, Houston"],
  ["F", "NED", "JPN", "2026-06-14T20:00:00.000Z", "AT&T Stadium, Dallas"],
  ["E", "CIV", "ECU", "2026-06-14T23:00:00.000Z", "Lincoln Financial Field, Philadelphia"],
  ["F", "SWE", "TUN", "2026-06-15T02:00:00.000Z", "Estadio BBVA, Monterrey"],
  ["H", "ESP", "CPV", "2026-06-15T16:00:00.000Z", "Mercedes-Benz Stadium, Atlanta"],
  ["G", "BEL", "EGY", "2026-06-15T19:00:00.000Z", "Lumen Field, Seattle"],
  ["H", "KSA", "URU", "2026-06-15T22:00:00.000Z", "Hard Rock Stadium, Miami"],
  ["G", "IRN", "NZL", "2026-06-16T01:00:00.000Z", "SoFi Stadium, Los Angeles"],
  ["I", "FRA", "SEN", "2026-06-16T19:00:00.000Z", "MetLife Stadium, New Jersey"],
  ["I", "IRQ", "NOR", "2026-06-16T22:00:00.000Z", "Gillette Stadium, Boston"],
  ["J", "ARG", "ALG", "2026-06-17T01:00:00.000Z", "Arrowhead Stadium, Kansas City"],
  ["J", "AUT", "JOR", "2026-06-17T04:00:00.000Z", "Levi's Stadium, San Francisco"],
  ["K", "POR", "COD", "2026-06-17T17:00:00.000Z", "NRG Stadium, Houston"],
  ["L", "ENG", "CRO", "2026-06-17T20:00:00.000Z", "AT&T Stadium, Dallas"],
  ["L", "GHA", "PAN", "2026-06-17T23:00:00.000Z", "BMO Field, Toronto"],
  ["K", "UZB", "COL", "2026-06-18T02:00:00.000Z", "Estadio Azteca, Mexico City"],
  ["A", "CZE", "RSA", "2026-06-18T16:00:00.000Z", "Mercedes-Benz Stadium, Atlanta"],
  ["B", "SUI", "BIH", "2026-06-18T19:00:00.000Z", "SoFi Stadium, Los Angeles"],
  ["B", "CAN", "QAT", "2026-06-18T22:00:00.000Z", "BC Place, Vancouver"],
  ["A", "MEX", "KOR", "2026-06-19T01:00:00.000Z", "Estadio Akron, Guadalajara"],
  ["D", "USA", "AUS", "2026-06-19T19:00:00.000Z", "Lumen Field, Seattle"],
  ["C", "SCO", "MAR", "2026-06-19T22:00:00.000Z", "Gillette Stadium, Boston"],
  ["C", "BRA", "HAI", "2026-06-20T00:30:00.000Z", "Lincoln Financial Field, Philadelphia"],
  ["D", "TUR", "PAR", "2026-06-20T03:00:00.000Z", "Levi's Stadium, San Francisco"],
  ["F", "NED", "SWE", "2026-06-20T17:00:00.000Z", "NRG Stadium, Houston"],
  ["E", "GER", "CIV", "2026-06-20T20:00:00.000Z", "BMO Field, Toronto"],
  ["E", "ECU", "CUW", "2026-06-21T00:00:00.000Z", "Arrowhead Stadium, Kansas City"],
  ["F", "TUN", "JPN", "2026-06-21T04:00:00.000Z", "Estadio BBVA, Monterrey"],
  ["H", "ESP", "KSA", "2026-06-21T16:00:00.000Z", "Mercedes-Benz Stadium, Atlanta"],
  ["G", "BEL", "IRN", "2026-06-21T19:00:00.000Z", "SoFi Stadium, Los Angeles"],
  ["H", "URU", "CPV", "2026-06-21T22:00:00.000Z", "Hard Rock Stadium, Miami"],
  ["G", "NZL", "EGY", "2026-06-22T01:00:00.000Z", "BC Place, Vancouver"],
  ["J", "ARG", "AUT", "2026-06-22T17:00:00.000Z", "AT&T Stadium, Dallas"],
  ["I", "FRA", "IRQ", "2026-06-22T21:00:00.000Z", "Lincoln Financial Field, Philadelphia"],
  ["I", "NOR", "SEN", "2026-06-23T00:00:00.000Z", "MetLife Stadium, New Jersey"],
  ["J", "JOR", "ALG", "2026-06-23T03:00:00.000Z", "Levi's Stadium, San Francisco"],
  ["K", "POR", "UZB", "2026-06-23T17:00:00.000Z", "NRG Stadium, Houston"],
  ["L", "ENG", "GHA", "2026-06-23T20:00:00.000Z", "Gillette Stadium, Boston"],
  ["L", "PAN", "CRO", "2026-06-23T23:00:00.000Z", "BMO Field, Toronto"],
  ["K", "COL", "COD", "2026-06-24T02:00:00.000Z", "Estadio Akron, Guadalajara"],
  ["B", "SUI", "CAN", "2026-06-24T19:00:00.000Z", "BC Place, Vancouver"],
  ["B", "BIH", "QAT", "2026-06-24T19:00:00.000Z", "Lumen Field, Seattle"],
  ["C", "SCO", "BRA", "2026-06-24T22:00:00.000Z", "Hard Rock Stadium, Miami"],
  ["C", "MAR", "HAI", "2026-06-24T22:00:00.000Z", "Mercedes-Benz Stadium, Atlanta"],
  ["A", "CZE", "MEX", "2026-06-25T01:00:00.000Z", "Estadio Azteca, Mexico City"],
  ["A", "RSA", "KOR", "2026-06-25T01:00:00.000Z", "Estadio BBVA, Monterrey"],
  ["E", "CUW", "CIV", "2026-06-25T20:00:00.000Z", "Lincoln Financial Field, Philadelphia"],
  ["E", "ECU", "GER", "2026-06-25T20:00:00.000Z", "MetLife Stadium, New Jersey"],
  ["F", "JPN", "SWE", "2026-06-25T23:00:00.000Z", "AT&T Stadium, Dallas"],
  ["F", "TUN", "NED", "2026-06-25T23:00:00.000Z", "Arrowhead Stadium, Kansas City"],
  ["D", "TUR", "USA", "2026-06-26T02:00:00.000Z", "SoFi Stadium, Los Angeles"],
  ["D", "PAR", "AUS", "2026-06-26T02:00:00.000Z", "Levi's Stadium, San Francisco"],
  ["I", "NOR", "FRA", "2026-06-26T19:00:00.000Z", "Gillette Stadium, Boston"],
  ["I", "SEN", "IRQ", "2026-06-26T19:00:00.000Z", "BMO Field, Toronto"],
  ["H", "CPV", "KSA", "2026-06-27T00:00:00.000Z", "NRG Stadium, Houston"],
  ["H", "URU", "ESP", "2026-06-27T00:00:00.000Z", "Estadio Akron, Guadalajara"],
  ["G", "EGY", "IRN", "2026-06-27T03:00:00.000Z", "Lumen Field, Seattle"],
  ["G", "NZL", "BEL", "2026-06-27T03:00:00.000Z", "BC Place, Vancouver"],
  ["L", "PAN", "ENG", "2026-06-27T21:00:00.000Z", "MetLife Stadium, New Jersey"],
  ["L", "CRO", "GHA", "2026-06-27T21:00:00.000Z", "Lincoln Financial Field, Philadelphia"],
  ["K", "COL", "POR", "2026-06-27T23:30:00.000Z", "Hard Rock Stadium, Miami"],
  ["K", "COD", "UZB", "2026-06-27T23:30:00.000Z", "Mercedes-Benz Stadium, Atlanta"],
  ["J", "ALG", "AUT", "2026-06-28T02:00:00.000Z", "Arrowhead Stadium, Kansas City"],
  ["J", "JOR", "ARG", "2026-06-28T02:00:00.000Z", "AT&T Stadium, Dallas"],
];

const existing = JSON.parse(readFileSync(join(root, "data/fixtures.json"), "utf8"));
const norm = (id) => (id === "alb" ? "swe" : id);
const pairToId = new Map(
  existing.map((m) => [
    `${m.group}:${[norm(m.homeTeamId), norm(m.awayTeamId)].sort().join("-")}`,
    m.id,
  ]),
);

const fixtures = OFFICIAL.map(([group, homeCode, awayCode, date, venue]) => {
  const homeTeamId = FIFA[homeCode];
  const awayTeamId = FIFA[awayCode];
  if (!homeTeamId || !awayTeamId) {
    throw new Error(`Unknown team code: ${homeCode} or ${awayCode}`);
  }
  const key = `${group}:${[homeTeamId, awayTeamId].sort().join("-")}`;
  const id = pairToId.get(key);
  if (!id) {
    throw new Error(`No fixture id for ${group} ${homeTeamId} vs ${awayTeamId}`);
  }
  return {
    id,
    stage: "group",
    group,
    homeTeamId,
    awayTeamId,
    date,
    venue,
  };
});

fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

writeFileSync(join(root, "data/fixtures.json"), JSON.stringify(fixtures, null, 2));
console.log(`Wrote ${fixtures.length} FIFA group fixtures`);
