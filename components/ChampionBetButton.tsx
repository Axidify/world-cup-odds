"use client";

import { useEffect, useState } from "react";
import { BetSlip } from "@/components/BetSlip";
import { Button } from "@/components/ui/Button";

export function ChampionBetButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Bet
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Bet on ${teamName}`}
      onClick={() => setOpen(false)}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        <BetSlip teamId={teamId} teamName={teamName} />
      </div>
    </div>
  );
}
