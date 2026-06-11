import { getSimulationStaleState } from "@/lib/sim/simulation-cache";
import { formatSimulationStaleMessage } from "@/lib/sim/stale-messages";

type Props = {
  hasSimulation: boolean;
  className?: string;
};

export function SimulationStaleAlert({ hasSimulation, className = "" }: Props) {
  if (!hasSimulation) return null;
  const state = getSimulationStaleState();
  const message = formatSimulationStaleMessage(state);
  if (!message) return null;

  return (
    <p className={`text-xs font-semibold text-loss ${className}`.trim()} role="status">
      {message}
    </p>
  );
}
