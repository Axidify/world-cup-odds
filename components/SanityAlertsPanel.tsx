import { Card } from "@/components/ui/Card";
import type { SanityAlert } from "@/lib/types";

export function SanityAlertsPanel({ alerts }: { alerts: SanityAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <Card className="mt-4 border-money/30 bg-money-tint/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-money">Model checks</p>
      <ul className="mt-2 space-y-2 text-xs text-text-muted">
        {alerts.map((a, i) => (
          <li key={`${a.type}-${i}`}>{a.message}</li>
        ))}
      </ul>
    </Card>
  );
}
