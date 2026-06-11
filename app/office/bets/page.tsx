import { PlaceBetClient } from "@/app/office/bets/PlaceBetClient";
import { getTeams } from "@/lib/data/load";

export const dynamic = "force-dynamic";

export default function PlaceBetPage() {
  return <PlaceBetClient teams={getTeams()} />;
}
