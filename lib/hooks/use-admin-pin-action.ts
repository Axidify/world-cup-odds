"use client";

import { useCallback, useRef, useState } from "react";
import {
  clearAdminPinSession,
  getAdminPinSession,
  isInvalidAdminPinStatus,
  setAdminPinSession,
} from "@/lib/admin-pin-session";

export type AdminPinActionResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export type AdminPinAction = (pin: string) => Promise<AdminPinActionResult>;

export function useAdminPinGate(config: {
  title: string;
  description?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionRef = useRef<AdminPinAction | null>(null);

  const attempt = useCallback(async (pin: string) => {
    const action = actionRef.current;
    if (!action) return false;

    const normalized = pin.trim();
    if (!normalized) return false;

    setError(null);
    setLoading(true);
    try {
      const result = await action(normalized);
      if (result.ok) {
        setAdminPinSession(normalized);
        setOpen(false);
        return true;
      }
      if (isInvalidAdminPinStatus(result.status)) clearAdminPinSession();
      setError(result.error);
      setOpen(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const request = useCallback(async (action: AdminPinAction) => {
    actionRef.current = action;
    const cached = getAdminPinSession()?.trim();
    if (cached) {
      const ok = await attempt(cached);
      if (ok) return true;
      // attempt already surfaced the error and opened the dialog
      return false;
    }
    setError(null);
    setOpen(true);
    return false;
  }, [attempt]);

  const submit = useCallback(
    async (pin: string) => {
      await attempt(pin);
    },
    [attempt],
  );

  return {
    open,
    setOpen,
    loading,
    error,
    setError,
    request,
    dialogProps: {
      open,
      onClose: () => {
        if (!loading) setOpen(false);
      },
      title: config.title,
      description: config.description,
      confirmLabel: config.confirmLabel,
      loading,
      error,
      onSubmit: submit,
    },
  };
}
