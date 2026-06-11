import { notFound } from "next/navigation";
import Link from "next/link";
import { Flag } from "@/components/Flag";
import { Card } from "@/components/ui/Card";
import { MatchAnalysis } from "@/components/MatchAnalysis";
import { TeamNewsPanel } from "@/components/TeamNewsPanel";
import { getEloRating } from "@/lib/calibration/elo";
import { getPredictionForPair, toMatchView } from "@/lib/ai/predictions";
import { applyNewsImpactToView } from "@/lib/news/impact";
import { getBracketTemplate, getTeam } from "@/lib/data/load";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getResult } from "@/lib/results/store";
import { formatUtcDateTime } from "@/lib/utils/dates";
import { formatBracketSlot } from "@/lib/utils/slots";

function matchTitle(
  home: ReturnType<typeof getTeam>,
  away: ReturnType<typeof getTeam>,
  homeSlot?: string,
  awaySlot?: string,
  matchId?: string,
) {
  if (home && away) return `${home.name} vs ${away.name}`;
  if (homeSlot && awaySlot) {
    return `${formatBracketSlot(homeSlot)} vs ${formatBracketSlot(awaySlot)}`;
  }
  const template = getBracketTemplate().r32.find((s) => s.matchId === matchId);
  if (template) return `${template.home} vs ${template.away}`;
  return "TBD vs TBD";
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = getResolvedMatch(id);
  if (!match) notFound();

  const home =
    match.homeTeamId !== "TBD" ? getTeam(match.homeTeamId) : undefined;
  const away =
    match.awayTeamId !== "TBD" ? getTeam(match.awayTeamId) : undefined;

  const title = matchTitle(home, away, match.homeSlot, match.awaySlot, match.id);

  const initialPrediction =
    home && away
      ? (() => {
          const cached = getPredictionForPair(home.id, away.id, match.stage);
          return cached
            ? applyNewsImpactToView(toMatchView(cached, home.id, away.id, true), home.id, away.id)
            : null;
        })()
      : null;

  const result = getResult(match.id);

  return (
    <div className="space-y-6">
      <Link href={match.stage === "group" ? "/groups" : "/bracket"} className="text-xs font-semibold text-brand hover:underline">
        ← Back to {match.stage === "group" ? "groups" : "bracket"}
      </Link>
      <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Match Detail</p>
      <h1 className="font-[family-name:var(--font-archivo)] text-3xl font-bold">{title}</h1>

      {result?.confirmed && home && away && (
        <Card className="border-brand/50 bg-brand-tint/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">Final result</p>
          <p className="mt-1 text-lg font-bold">
            {home.name} {result.homeScore}–{result.awayScore} {away.name}
            {result.et ? " (aet)" : ""}
            {result.pens ? " (pens)" : ""}
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              {home ? <Flag code={home.flagCode} alt={home.name} size="lg" /> : <span>▢</span>}
              <div className="font-bold">{home?.name ?? (match.homeSlot ? formatBracketSlot(match.homeSlot) : "TBD")}</div>
              {home && (
                <div className="num text-xs text-text-muted">
                  FIFA #{home.fifaRank}
                  {(() => {
                    const elo = getEloRating(home.id);
                    return elo != null ? ` · Elo ${Math.round(elo)}` : "";
                  })()}
                </div>
              )}
            </div>
            <div className="num text-sm text-text-muted uppercase">
              {match.stage}
              {match.group ? ` · Group ${match.group}` : ""}
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              {away ? <Flag code={away.flagCode} alt={away.name} size="lg" /> : <span>▢</span>}
              <div className="font-bold">{away?.name ?? (match.awaySlot ? formatBracketSlot(match.awaySlot) : "TBD")}</div>
              {away && (
                <div className="num text-xs text-text-muted">
                  FIFA #{away.fifaRank}
                  {(() => {
                    const elo = getEloRating(away.id);
                    return elo != null ? ` · Elo ${Math.round(elo)}` : "";
                  })()}
                </div>
              )}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-text-muted">
            {formatUtcDateTime(match.date)} UTC · {match.venue}
          </p>
          <div className="mt-6">
            {home && away ? (
              <MatchAnalysis
                matchId={match.id}
                homeName={home.name}
                awayName={away.name}
                initial={initialPrediction}
              />
            ) : (
              <div className="rounded-lg bg-surface-2 p-8 text-center text-sm text-text-muted">
                Teams not yet determined — analysis available after bracket resolves.
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {home && away && <TeamNewsPanel matchId={match.id} />}
        </div>
      </div>
    </div>
  );
}
