import { eq } from "drizzle-orm";
import type { LLMProvider } from "@/lib/types";
import { getDb } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import {
  firstConfiguredProvider,
  getEnvProvider,
  isProviderConfigured,
} from "./config";

const SETTINGS_KEY = "llm_provider";

/** Returns null when no provider has credentials / base URL configured. */
export function resolveActiveProvider(): LLMProvider | null {
  try {
    const db = getDb();
    const row = db.select().from(appSettings).where(eq(appSettings.key, SETTINGS_KEY)).get();
    const value = row?.value as LLMProvider | undefined;
    if (value && isProviderConfigured(value)) return value;
  } catch {
    // DB not ready during static build
  }

  const env = getEnvProvider();
  if (isProviderConfigured(env)) return env;

  return firstConfiguredProvider();
}

export function getActiveProvider(): LLMProvider {
  const provider = resolveActiveProvider();
  if (!provider) {
    throw new Error("No LLM provider is configured. Set credentials in .env.local");
  }
  return provider;
}

export function isProviderReady(): boolean {
  return resolveActiveProvider() !== null;
}

export function setActiveProvider(provider: LLMProvider): void {
  if (!isProviderConfigured(provider)) {
    throw new Error(`Provider "${provider}" is not configured`);
  }
  const db = getDb();
  const existing = db.select().from(appSettings).where(eq(appSettings.key, SETTINGS_KEY)).get();
  const previous = existing?.value as LLMProvider | undefined;

  const now = new Date().toISOString();
  db.insert(appSettings)
    .values({ key: SETTINGS_KEY, value: provider, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: provider, updatedAt: now },
    })
    .run();

  if (previous && previous !== provider) {
    void import("@/lib/ai/bulk-job").then(({ resetBulkJobState }) => {
      resetBulkJobState();
    });
  }
}
