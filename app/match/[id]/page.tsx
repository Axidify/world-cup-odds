import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { MatchAnalysis } from "@/components/MatchAnalysis";
import { MatchStatusCard } from "@/components/MatchStatusCard";
import { TeamNewsPanel } from "@/components/TeamNewsPanel";
import { getEloRating } from "@/lib/calibration/elo";
import { getPredictionForPair, toMatchView } from "@/lib/ai/predictions";
import { applyNewsImpactToView } from "@/lib/news/impact";
import { getBracketTemplate, getTeam } from "@/lib/data/load";
import { getResolvedMatch } from "@/lib/data/resolved";
import { getResult } from "@/lib/results/store";
import { getLiveScoresPollIntervalSeconds } from "@/lib/jobs/poll-live-scores";
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
    <div className="space-y-5">
      <Link
        href={match.stage === "group" ? "/groups" : "/bracket"}
        className="inline-block text-xs font-semibold text-brand hover:underline"
      >
        ← Back to {match.stage === "group" ? "groups" : "bracket"}
      </Link>

      <div>
        <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Match</p>
        {home && away ? (
          <h1 className="sr-only">{title}</h1>
        ) : (
          <h1 className="mt-1 font-[family-name:var(--font-archivo)] text-xl font-bold leading-tight sm:text-2xl">
            {title}
          </h1>
        )}
      </div>

      <MatchStatusCard
        matchId={match.id}
        kickoffIso={match.date}
        venue={match.venue}
        stage={match.stage}
        group={match.group}
        livePollIntervalSeconds={getLiveScoresPollIntervalSeconds()}
        home={
          home
            ? {
                name: home.name,
                flagCode: home.flagCode,
                fifaRank: home.fifaRank,
                elo: getEloRating(home.id),
              }
            : undefined
        }
        away={
          away
            ? {
                name: away.name,
                flagCode: away.flagCode,
                fifaRank: away.fifaRank,
                elo: getEloRating(away.id),
              }
            : undefined
        }
        confirmed={
          result?.confirmed &&
          result.homeScore != null &&
          result.awayScore != null
            ? {
                homeScore: result.homeScore,
                awayScore: result.awayScore,
                et: result.et,
                pens: result.pens,
              }
            : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-4 sm:p-6">
          {home && away ? (
            <MatchAnalysis
              matchId={match.id}
              homeName={home.name}
              awayName={away.name}
              initial={initialPrediction}
            />
          ) : (
            <div className="rounded-lg bg-surface-2 p-6 text-center text-sm text-text-muted sm:p-8">
              Teams not yet determined — analysis available after bracket resolves.
            </div>
          )}
        </Card>

        {home && away ? <TeamNewsPanel matchId={match.id} /> : null}
      </div>
    </div>
  );
}
