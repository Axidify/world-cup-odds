import { NextResponse } from "next/server";
import { z } from "zod";
import { listProviderInfos, PROVIDER_LABELS, getModelForProvider } from "@/lib/ai/config";
import { checkProviderHealth } from "@/lib/ai/llm";
import { resolveActiveProvider, setActiveProvider } from "@/lib/ai/settings";
import { getDb } from "@/lib/db";
import type { LLMProvider } from "@/lib/types";

const patchSchema = z.object({
  provider: z.enum(["vllm", "openai", "openrouter", "gemini", "anthropic"]),
});

export async function GET() {
  getDb();
  const active = resolveActiveProvider();
  const online = active ? await checkProviderHealth(active) : false;

  return NextResponse.json({
    active: active
      ? {
          provider: active,
          label: PROVIDER_LABELS[active],
          model: getModelForProvider(active),
          online,
        }
      : null,
    providers: listProviderInfos(),
  });
}

export async function PATCH(request: Request) {
  getDb();
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  try {
    setActiveProvider(parsed.data.provider as LLMProvider);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to set provider";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const active = resolveActiveProvider();
  const online = active ? await checkProviderHealth(active) : false;

  return NextResponse.json({
    active: active
      ? {
          provider: active,
          label: PROVIDER_LABELS[active],
          model: getModelForProvider(active),
          online,
        }
      : null,
  });
}
