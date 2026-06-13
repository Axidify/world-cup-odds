import { FixtureProbsBadge } from "@/components/FixtureProbsBadge";
import type { FixtureWinProbs } from "@/lib/match/group-fixture-probs";

type Props = {
  probs: FixtureWinProbs | null;
  homeLabel: string;
  awayLabel: string;
};

export function DashboardMatchPrediction({ probs, homeLabel, awayLabel }: Props) {
  if (!probs) return null;
  return <FixtureProbsBadge probs={probs} homeLabel={homeLabel} awayLabel={awayLabel} />;
}
