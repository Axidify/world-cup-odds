import Link from "next/link";
import { Flag } from "@/components/Flag";
import { SimulationPanel } from "@/components/SimulationPanel";
import { Card } from "@/components/ui/Card";
import { formatUtcDate } from "@/lib/utils/dates";
import { formatBracketSlot } from "@/lib/utils/slots";
import {
  getBracketTemplate,
  getKnockoutFixtures,
  getTeamMap,
} from "@/lib/data/load";
import { getLatestSimulation, isSimulationStale } from "@/lib/sim/simulation-cache";
import type { Match, MatchStage } from "@/lib/types";

export const dynamic = "force-dynamic";

const rounds: { stage: MatchStage; label: string }[] = [
  { stage: "r32", label: "Round of 32" },
  { stage: "r16", label: "Round of 16" },
  { stage: "qf", label: "Quarter-finals" },
  { stage: "sf", label: "Semi-finals" },
  { stage: "third_place", label: "Third place" },
  { stage: "final", label: "Final" },
];

function slotLabel(match: Match, bracketSlots: Map<string, { home: string; away: string }>) {
  const slot = bracketSlots.get(match.id);
  if (slot) return `${slot.home} vs ${slot.away}`;
  if (match.homeSlot && match.awaySlot) {
    return `${formatBracketSlot(match.homeSlot)} vs ${formatBracketSlot(match.awaySlot)}`;
  }
  return "TBD vs TBD";
}

export default function BracketPage() {
  const knockout = getKnockoutFixtures();
  const template = getBracketTemplate();
  const bracketSlots = new Map(template.r32.map((s) => [s.matchId, s]));
  const simulation = getLatestSimulation();
  const stale = isSimulationStale();
  const pathByMatch = new Map(
    simulation?.predictedPath.knockout.map((m) => [m.matchId, m]) ?? [],
  );
  const teamMap = getTeamMap();
  const championId = simulation?.predictedPath.championTeamId;
  const champion = championId ? teamMap.get(championId) : null;

  return (
    <div>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Knockout</p>
      <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">Bracket</h1>
      <p className="mt-2 text-sm text-text-muted">
        {knockout.length} knockout slots
        {champion ? ` · modal champion: ${champion.name}` : " · run simulation to resolve teams"}
      </p>

      {stale && simulation && (
        <p className="mt-2 text-xs font-semibold text-loss">
          Predictions updated since last simulation — re-run to refresh bracket.
        </p>
      )}
      <div className="mt-4">
        <SimulationPanel hasSimulation={Boolean(simulation)} lastRunAt={simulation?.runAt ?? null} />
      </div>

      <nav
        aria-label="Bracket rounds"
        className="sticky top-14 z-10 -mx-4 mt-6 flex gap-2 overflow-x-auto border-b border-border bg-bg px-4 py-2 md:hidden"
      >
        {rounds.map(({ stage, label }) => {
          const count = knockout.filter((m) => m.stage === stage).length;
          if (count === 0) return null;
          return (
            <a
              key={stage}
              href={`#bracket-${stage}`}
              className="num shrink-0 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-text-muted transition-colors hover:border-brand hover:text-brand"
            >
              {label}
            </a>
          );
        })}
      </nav>

      <div className="mt-8 space-y-10">
        {rounds.map(({ stage, label }) => {
          const matches = knockout.filter((m) => m.stage === stage);
          if (matches.length === 0) return null;

          return (
            <section key={stage} id={`bracket-${stage}`} className="scroll-mt-24">
              <h2 className="num mb-4 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                {label} · {matches.length} {matches.length === 1 ? "match" : "matches"}
              </h2>
              <div
                className={
                  matches.length > 4 ? "grid gap-3 sm:grid-cols-2" : "grid max-w-xl gap-3"
                }
              >
                {matches.map((m) => {
                  const resolved = pathByMatch.get(m.id);
                  const home = resolved ? teamMap.get(resolved.homeTeamId) : null;
                  const away = resolved ? teamMap.get(resolved.awayTeamId) : null;
                  const winner = resolved ? teamMap.get(resolved.winnerTeamId) : null;

                  return (
                    <Link key={m.id} href={`/match/${m.id}`}>
                      <Card
                        className={`p-3 transition-colors hover:border-brand ${
                          resolved ? "border-solid" : "border-dashed opacity-90"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="num text-[10px] font-semibold uppercase text-text-muted">
                            {m.id}
                          </span>
                          <span className="num text-[10px] text-text-muted">
                            {formatUtcDate(m.date)}
                          </span>
                        </div>
                        {resolved && home && away ? (
                          <div className="mt-2 space-y-1 text-sm">
                            <div
                              className={`flex items-center gap-2 font-semibold ${
                                winner?.id === home.id ? "text-brand" : ""
                              }`}
                            >
                              <Flag code={home.flagCode} alt={home.name} size="sm" />
                              {home.name}
                            </div>
                            <div
                              className={`flex items-center gap-2 font-semibold ${
                                winner?.id === away.id ? "text-brand" : ""
                              }`}
                            >
                              <Flag code={away.flagCode} alt={away.name} size="sm" />
                              {away.name}
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm font-semibold italic text-text-muted">
                            {slotLabel(m, bracketSlots)}
                          </p>
                        )}
                        <p className="mt-1 truncate text-xs text-text-muted">{m.venue}</p>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
