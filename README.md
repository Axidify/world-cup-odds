# World Cup Odds 2026

AI-powered odds calculator for the 2026 FIFA World Cup — match predictions, tournament simulation, champion odds, and live bracket projections.

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

For cloud hosting, see **[docs/RAILWAY.md](docs/RAILWAY.md)**.

For how predictions, simulation, Elo, and the poller fit together, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — next fixtures, champion odds preview, bulk analyze, status |
| `/groups` | Group standings (official + projected), fixture win % |
| `/bracket` | Official and simulated knockout paths (consensus, leader, random) |
| `/champion` | All 48 teams — champion %, base vs news, survival odds, simulation |
| `/accuracy` | Brier score, log loss, calibration bins from confirmed results |
| `/match/[id]` | Match detail — analysis, squad news, Elo, confirmed score |

## API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/health` | GET | Active provider status |
| `/api/settings/llm` | GET/PATCH | Switch LLM provider |
| `/api/analyze/match` | GET/POST | Single-match analysis |
| `/api/analyze/bulk` | GET/POST/DELETE | Bulk analyze job + status / cancel |
| `/api/analyze/tournament` | POST | Run simulation (Monte Carlo, `ADMIN_PIN`) |
| `/api/odds/champion` | GET | Latest champion odds cache |
| `/api/results/pending` | GET | Unconfirmed match results queue |
| `/api/results/[matchId]/confirm` | POST | Admin confirm pending result (`ADMIN_PIN`) |
| `/api/results/[matchId]/unconfirm` | POST | Admin revert a confirmed result (`ADMIN_PIN`) |
| `/api/sync/results` | POST | Admin manual result entry (`ADMIN_PIN`) |
| `/api/accuracy` | GET | Prediction accuracy metrics |
| `/api/news/[matchId]` | GET | Squad news + Elo for both teams |
| `/api/sync/news` | POST | On-demand news refresh (`matchId` or `teamId`) |
| `/api/tournament/status` | GET | Simulation staleness, pending results, pipeline state |
| `/api/simulation/sample-path` | GET | Random knockout draw for bracket UI |
| `/api/admin/export` | GET | JSON backup (`?pin=`) |
| `/api/admin/poll-results` | POST | Trigger results poll (`ADMIN_PIN`) |

**Bulk analyze** (dashboard → “Analyze all matches”): 72 group fixtures + 276 top-24 knockout pairings, then gap-fill for modal-path knockouts. Progress polls every 2s. Requires `ADMIN_PIN`.

**Simulation** (dashboard / champion → “Run simulation”): requires cached predictions; 5,000-iteration Monte Carlo by default. Requires `ADMIN_PIN`.

**Poller** (separate process): `npm run poller` — syncs match results (every 15 min) and squad news (every 6 h). Results auto-confirm when football-data.org reports a `FINISHED` match, with web search + 2-snippet agreement as last resort. Requires `TAVILY_API_KEY` (or `SERPER_API_KEY`) for news. Production: `npm run start:all`.

**Results provider chain:** football-data.org (if `FOOTBALL_DATA_API_TOKEN`) → Tavily/Serper search.

**Live scores:** Requires `FOOTBALL_DATA_API_TOKEN`. Poller polls football-data.org `LIVE`/`IN_PLAY` every ~60s while matches are in the kickoff→2h window. UI reads `/api/live/scores` (cached in SQLite).

**Auto-pipeline** (poller, on by default): when results confirm, re-runs simulation automatically (debounced). Dashboard shows “Auto-updating odds and bracket…”. Env: `AUTO_PIPELINE_ENABLED`, `AUTO_SIMULATE_ON_RESULTS`, `AUTO_PIPELINE_ON_START`, `AUTO_ANALYZE_MISSING` (optional LLM gap-fill).

**Pending results:** The poller ingests scores but leaves them unconfirmed until sources agree. The dashboard banner shows how many are waiting. There is no in-app confirm UI today — use `POST /api/results/[matchId]/confirm` with `{ "pin": "…" }`, or rely on auto-confirm.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run poller` | Background poller |
| `npm run start:all` | App + poller (production) |
| `npm test` | Vitest unit tests |

## Implementation status

- **Phase 1:** Scaffold, design system, seed data, read-only UI
- **Phase 2:** Pluggable LLMs, prediction cache, match analysis
- **Phase 3:** Standings, bracket (Annex C), Monte Carlo simulation
- **Phase 4:** Bulk analyze, progress UI, local LLM guide
- **Phase 5A:** Results pipeline, poller, accuracy dashboard
- **Phase 5B:** Team news polling, Elo tracking, prompt memory in analysis
- **Phase 5C:** Elo-based seeding and accuracy metrics (`CALIBRATION_ENABLED` reserved for future learning loop)

The core product loop is complete: predict → simulate → display odds → ingest results → refresh. An optional office betting pool was removed — the app is odds-only.

Design reference: `World Cup Odds - v0 Mockup.html`
