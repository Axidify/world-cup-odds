# World Cup Odds 2026

AI-powered odds calculator for the 2026 FIFA World Cup — predictions, tournament simulation, champion odds, and an office betting pool (MYR).

## Stack

- Next.js 15, TypeScript, Tailwind CSS v4
- SQLite + Drizzle ORM (`better-sqlite3`)
- Pluggable LLMs (vLLM, OpenAI, OpenRouter, Gemini, Anthropic)

## Quick start

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Tip:** Stop the dev server before running `npm run build`. Running both at once can corrupt `.next` and cause 500 errors in dev. If that happens, delete `.next` and restart `npm run dev`.

### Flags

Team flags are bundled under `public/flags/`. To refresh:

```bash
node scripts/download-flags.mjs
```

### Database

SQLite file at `./data/worldcup.db` (gitignored). Migrations run automatically on first `getDb()` call.

### AI setup

Copy `.env.local.example` to `.env.local` and set `LLM_PROVIDER` plus matching credentials.

For local vLLM on an H100, see **[docs/LOCAL_LLM_GUIDE.md](docs/LOCAL_LLM_GUIDE.md)**.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/health` | GET | Active provider status |
| `/api/settings/llm` | GET/PATCH | Switch LLM provider |
| `/api/analyze/match` | GET/POST | Single-match analysis |
| `/api/analyze/bulk` | GET/POST/DELETE | Bulk analyze job + status / cancel |
| `/api/analyze/tournament` | POST | Run simulation (Monte Carlo) |
| `/api/odds/champion` | GET | Latest champion odds cache |
| `/api/results/pending` | GET | Unconfirmed match results queue |
| `/api/results/[matchId]/confirm` | POST | Admin confirm pending result (`ADMIN_PIN`) |
| `/api/sync/results` | POST | Admin manual result entry (`ADMIN_PIN`) |
| `/api/accuracy` | GET | Prediction accuracy metrics |
| `/api/news/[matchId]` | GET | Squad news + Elo for both teams |
| `/api/sync/news` | POST | On-demand news refresh (`matchId` or `teamId`) |
| `/api/bettors` | GET/POST | List / register office bettors |
| `/api/bets` | GET/POST | List / place bets (match or champion) |
| `/api/bets/[id]/void` | POST | Admin void bet (`ADMIN_PIN`) |
| `/api/office/leaderboard` | GET | P&L leaderboard + pool summary |
| `/api/betting/lines` | GET | Odds snapshot for match or champion team |
| `/api/admin/export` | GET | JSON backup (`?pin=`) |

**Bulk analyze** (dashboard → “Analyze all matches”): 72 group fixtures + 276 top-24 knockout pairings, then gap-fill for modal-path knockouts. Progress polls every 2s.

**Simulation** (dashboard / champion → “Run simulation”): requires cached predictions; 5,000-iteration Monte Carlo by default.

**Poller** (separate process): `npm run poller` — syncs match results (every 15 min) and squad news (every 6 h) via Tavily/Serper. Results auto-confirm when 2+ snippets agree. Requires `TAVILY_API_KEY` (or `SERPER_API_KEY`). Production: `npm run start:all`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run poller` | Background poller (Phase 5+) |
| `npm run start:all` | App + poller (production) |
| `npm test` | Vitest unit tests |

## Implementation status

- **Phase 1:** Scaffold, design system, seed data, read-only UI
- **Phase 2:** Pluggable LLMs, prediction cache, match analysis
- **Phase 3:** Standings, bracket (Annex C), Monte Carlo simulation
- **Phase 4:** Bulk analyze, progress UI, local LLM guide
- **Phase 5A:** Results pipeline, poller, accuracy dashboard
- **Phase 5B:** Team news polling, Elo tracking, prompt memory in analysis
- **Phase 5C:** Optional statistical calibration (`CALIBRATION_ENABLED`)
- **Phase 6 (current):** Office betting pool — MYR stakes, AI odds lines, auto-settlement, leaderboard

Office betting uses an office-trust model (name picker, no login). Set `ADMIN_PIN` for voids and result confirm. Bets lock at kickoff; champion bets lock at `TOURNAMENT_LOCK_AT` (defaults to first kickoff).

Design reference: `World Cup Odds - v0 Mockup.html`
