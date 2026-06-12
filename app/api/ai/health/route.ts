import { NextResponse } from "next/server";
import { checkProviderHealth } from "@/lib/ai/llm";
import { listProviderInfos, PROVIDER_LABELS, getModelForProvider } from "@/lib/ai/config";
import { resolveActiveProvider } from "@/lib/ai/settings";
import { resolveResultsProvider } from "@/lib/jobs/poll-results";
import {
  getFootballDataStatus,
  isFootballDataConfigured,
} from "@/lib/results/football-data";
import {
  isSearchConfigured,
  isSearchReady,
  resolveSearchProvider,
} from "@/lib/search/provider";
import { getDb } from "@/lib/db";

export async function GET() {
  getDb();
  const active = resolveActiveProvider();
  const providers = listProviderInfos();

  let online = false;
  if (active) {
    online = await checkProviderHealth(active);
  }

  const searchConfigured = isSearchConfigured();
  const searchOnline = searchConfigured ? isSearchReady() : false;
  const resultsProvider = resolveResultsProvider();
  const footballDataConfigured = isFootballDataConfigured();
  const footballData =
    footballDataConfigured && resultsProvider === "football-data"
      ? await getFootballDataStatus()
      : null;

  return NextResponse.json({
    active: active
      ? {
          provider: active,
          label: PROVIDER_LABELS[active],
          model: getModelForProvider(active),
          online,
        }
      : null,
    providers,
    search: {
      provider: resolveSearchProvider(),
      configured: searchConfigured,
      online: searchOnline,
    },
    results: {
      provider: resultsProvider,
      configured: footballDataConfigured || searchConfigured,
      online: resultsProvider === "football-data" ? Boolean(footballData?.ok) : searchOnline,
      footballData: footballData
        ? {
            season: footballData.season,
            matchCount: footballData.matchCount,
            finishedCount: footballData.finishedCount,
            error: footballData.error,
          }
        : undefined,
    },
    db: true,
  });
}
