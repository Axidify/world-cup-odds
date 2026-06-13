"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  error?: string | null;
  onSubmit: (pin: string) => void | Promise<void>;
};

export function AdminPinDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  loading = false,
  error,
  onSubmit,
}: Props) {
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const busy = loading || submitting;

  useEffect(() => {
    if (!open) return;
    setPin("");
    setSubmitting(false);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || busy) return;
    setSubmitting(true);
    try {
      await onSubmit(pin);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => !busy && onClose()}
    >
      <Card
        className="relative w-full max-w-md border-brand/25 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
          onClick={onClose}
          disabled={busy}
        >
          <X size={16} />
        </button>

        <p className="num text-xs font-semibold uppercase tracking-widest text-brand">Admin</p>
        <h2
          id={titleId}
          className="mt-1 pr-8 font-[family-name:var(--font-archivo)] text-xl font-bold"
        >
          {title}
        </h2>
        {description ? <p className="mt-2 text-sm text-text-muted">{description}</p> : null}

        <form
          ref={formRef}
          className="mt-5 space-y-4"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <label className="block text-xs font-semibold text-text-muted">
            Admin PIN
            <input
              ref={inputRef}
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || busy) return;
                e.preventDefault();
                formRef.current?.requestSubmit();
              }}
              placeholder="Enter PIN"
              autoComplete="off"
              enterKeyHint="go"
              disabled={busy}
              className="mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors focus:border-brand"
            />
          </label>

          {error ? <p className="text-xs text-loss">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={busy || !pin.trim()}
              className="order-2"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? "Working…" : confirmLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={busy}
              className="order-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
