import { NextResponse } from "next/server";
import { z } from "zod";
import { listProviderInfos, PROVIDER_LABELS, getModelForProvider } from "@/lib/ai/config";
import { checkProviderHealth } from "@/lib/ai/llm";
import { resolveActiveProvider, setActiveProvider } from "@/lib/ai/settings";
import { getDb } from "@/lib/db";
import type { LLMProvider } from "@/lib/types";
import { rejectUnlessAdminPin } from "@/lib/utils/admin";

const patchSchema = z.object({
  provider: z.enum(["vllm", "openai", "openrouter", "gemini", "anthropic"]),
  pin: z.string().min(1),
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
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const denied = rejectUnlessAdminPin(parsed.data.pin);
  if (denied) return denied;

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
