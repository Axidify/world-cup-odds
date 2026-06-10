import type { SearchProviderId, SearchSnippet } from "./types";

export function resolveSearchProvider(): SearchProviderId {
  const raw = (process.env.SEARCH_PROVIDER ?? "tavily").toLowerCase();
  return raw === "serper" ? "serper" : "tavily";
}

export function isSearchConfigured(): boolean {
  const provider = resolveSearchProvider();
  if (provider === "serper") {
    return Boolean(process.env.SERPER_API_KEY?.trim());
  }
  return Boolean(process.env.TAVILY_API_KEY?.trim());
}

export async function checkSearchHealth(): Promise<boolean> {
  if (!isSearchConfigured()) return false;
  try {
    const snippets = await searchWeb("FIFA World Cup 2026", { maxResults: 1 });
    return snippets.length > 0;
  } catch {
    return false;
  }
}

/** Credentials-only check — avoids burning search quota on frequent health polls. */
export function isSearchReady(): boolean {
  return isSearchConfigured();
}

export async function searchWeb(
  query: string,
  options: { maxResults?: number } = {},
): Promise<SearchSnippet[]> {
  if (!isSearchConfigured()) {
    throw new Error("No search provider is configured. Set TAVILY_API_KEY or SERPER_API_KEY.");
  }
  const maxResults = options.maxResults ?? 5;
  const provider = resolveSearchProvider();
  if (provider === "serper") return searchSerper(query, maxResults);
  return searchTavily(query, maxResults);
}

async function searchTavily(query: string, maxResults: number): Promise<SearchSnippet[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Tavily search failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    content: r.content ?? "",
  }));
}

async function searchSerper(query: string, maxResults: number): Promise<SearchSnippet[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) throw new Error("SERPER_API_KEY is not set");

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: query, num: maxResults }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Serper search failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  return (data.organic ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.link ?? "",
    content: r.snippet ?? "",
  }));
}
