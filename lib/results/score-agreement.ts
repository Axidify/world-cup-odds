import type { SearchSnippet } from "@/lib/search/types";

export type ParsedScore = {
  homeScore: number;
  awayScore: number;
};

/** Try to find an H-A score pattern in free text (e.g. "2-1", "2 – 0"). */
export function parseScoreFromText(text: string): ParsedScore | null {
  const normalized = text.replace(/\u2013|\u2014/g, "-");
  const patterns = [
    /\b(\d{1,2})\s*[-–]\s*(\d{1,2})\b/,
    /\b(\d{1,2})\s*:\s*(\d{1,2})\b/,
    /\bbeat\b[^0-9]*(\d{1,2})\s*[-–]\s*(\d{1,2})/i,
    /\bwon\s+(\d{1,2})\s*[-–]\s*(\d{1,2})/i,
  ];

  for (const pattern of patterns) {
    const m = normalized.match(pattern);
    if (!m) continue;
    const homeScore = Number(m[1]);
    const awayScore = Number(m[2]);
    if (homeScore <= 10 && awayScore <= 10) {
      return { homeScore, awayScore };
    }
  }
  return null;
}

export function scoresMatch(a: ParsedScore, b: ParsedScore): boolean {
  return a.homeScore === b.homeScore && a.awayScore === b.awayScore;
}

/** Auto-confirm when 2+ snippets independently mention the same score. */
export function snippetsAgreeOnScore(
  snippets: SearchSnippet[],
  expected: ParsedScore,
): boolean {
  let agreements = 0;
  for (const s of snippets) {
    const text = `${s.title} ${s.content}`;
    const parsed = parseScoreFromText(text);
    if (parsed && scoresMatch(parsed, expected)) agreements += 1;
  }
  return agreements >= 2;
}
