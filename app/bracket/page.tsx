import { TournamentBracket } from "@/components/TournamentBracket";
import { buildConsensusKnockoutPath } from "@/lib/bracket/consensus-path";
import { resolveConsensusGroupStandings, isConsensusSeededFromOfficial } from "@/lib/bracket/consensus-standings";
import { buildAdvanceProbsForKnockoutPath } from "@/lib/bracket/knockout-advance-probs";
import { buildOfficialKnockoutPath } from "@/lib/bracket/official-knockout";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { getConfirmedResults } from "@/lib/sim/actual-results";
import { getLatestSimulation, getSimulationStaleState } from "@/lib/sim/simulation-cache";
import { formatSimulationStaleMessage } from "@/lib/sim/stale-messages";
import { buildOfficialStandingsByGroup } from "@/lib/standings/official-standings";
import {
  getBracketTemplate,
  getFixtures,
  getGroups,
  getKnockoutFixtures,
  getTeams,
} from "@/lib/data/load";
import { loadPredictionStore } from "@/lib/sim/prediction-store";

import type { KnockoutPathMatch } from "@/lib/types";

export const dynamic = "force-dynamic";

function buildRepresentativeAdvanceProbs(knockoutPath: KnockoutPathMatch[] | undefined) {
  if (!knockoutPath?.length) return {};
  const provider = resolveActiveProvider();
  if (!provider) return {};
  try {
    const store = loadPredictionStore(provider);
    return buildAdvanceProbsForKnockoutPath(store, knockoutPath);
  } catch {
    return {};
  }
}

export default function BracketPage() {
  const knockout = getKnockoutFixtures();
  const template = getBracketTemplate();
  const bracketSlots = Object.fromEntries(template.r32.map((s) => [s.matchId, s]));
  const simulation = getLatestSimulation();
  const staleState = getSimulationStaleState();
  const confirmed = getConfirmedResults();
  const confirmedScores = Object.fromEntries(confirmed);
  const official = buildOfficialKnockoutPath(confirmed);
  const groupFixtures = getFixtures();
  const hasConfirmedResults =
    groupFixtures.some((f) => confirmed.has(f.id)) || official.hasConfirmedKnockoutResults;
  const representativeAdvanceProbs = buildRepresentativeAdvanceProbs(
    simulation?.predictedPath.knockout,
  );
  const consensusGroupStandings = resolveConsensusGroupStandings(
    confirmed,
    simulation?.extras?.modalGroupStandings,
  );
  const provider = resolveActiveProvider();
  const consensus =
    consensusGroupStandings && provider
      ? (() => {
          try {
            const store = loadPredictionStore(provider);
            const { knockout, championTeamId } = buildConsensusKnockoutPath(
              store,
              consensusGroupStandings,
              confirmed,
            );
            return {
              knockout,
              championTeamId,
              advanceProbs: buildAdvanceProbsForKnockoutPath(store, knockout),
            };
          } catch {
            return null;
          }
        })()
      : null;

  return (
    <TournamentBracket
      groups={getGroups()}
      knockout={knockout}
      bracketSlots={bracketSlots}
      officialStandings={buildOfficialStandingsByGroup(confirmed)}
      projectedStandings={simulation?.predictedPath.groupStandings}
      officialPath={official.knockout}
      projectedPath={simulation?.predictedPath.knockout}
      confirmedScores={confirmedScores}
      teams={getTeams()}
      officialChampionId={official.championTeamId}
      projectedChampionId={simulation?.predictedPath.championTeamId}
      projectedChampionPct={
        simulation?.predictedPath.championTeamId
          ? simulation.championOdds[simulation.predictedPath.championTeamId]
          : undefined
      }
      hasConfirmedKnockoutResults={official.hasConfirmedKnockoutResults}
      hasConfirmedResults={hasConfirmedResults}
      hasSimulation={Boolean(simulation)}
      simulationRunAt={simulation?.runAt ?? null}
      simulationStale={staleState.stale}
      staleMessage={formatSimulationStaleMessage(staleState)}
      modalGroupStandings={simulation?.extras?.modalGroupStandings}
      representativePathNote={simulation?.extras?.representativePathNote}
      championOdds={simulation?.championOdds}
      representativeAdvanceProbs={representativeAdvanceProbs}
      consensusGroupStandings={consensusGroupStandings ?? undefined}
      consensusSeededFromOfficial={isConsensusSeededFromOfficial(confirmed)}
      consensusKnockout={consensus?.knockout}
      consensusChampionId={consensus?.championTeamId}
      consensusAdvanceProbs={consensus?.advanceProbs}
    />
  );
}
