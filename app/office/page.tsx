import Link from "next/link";
import { OfficePoolPanel } from "@/components/OfficePoolPanel";
import { PendingResultsPanel } from "@/components/PendingResultsPanel";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/utils/currency";
import { getPoolName } from "@/lib/betting/leaderboard";
import { getFixedStakeMyr } from "@/lib/betting/locks";

export const dynamic = "force-dynamic";

export default function OfficePage() {
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Office Pool · MYR</p>
          <h1 className="mt-2 font-[family-name:var(--font-archivo)] text-3xl font-bold">{getPoolName()}</h1>
          <p className="mt-2 text-sm text-text-muted">
            One market: World Cup winner. Fixed {formatMoney(getFixedStakeMyr())} stake per bet —
            settle offline among colleagues.
          </p>
        </div>
        <Link href="/office/bets">
          <Button>Place bet</Button>
        </Link>
      </div>

      <OfficePoolPanel />

      <section>
        <h2 className="text-sm font-bold">Pending results</h2>
        <p className="mt-1 text-xs text-text-muted">
          Bets settle only after results are confirmed (auto when 2+ sources agree, or admin PIN).
        </p>
        <div className="mt-4">
          <PendingResultsPanel />
        </div>
      </section>
    </div>
  );
}
