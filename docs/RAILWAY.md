# Deploy to Railway

This app runs **Next.js + a background poller** in one container (`npm run start:all`). SQLite data must live on a **Railway volume** or it is wiped on every deploy.

## 1. Create the service

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select `world-cup-odds`.
2. Railway picks up `railway.toml` / `railway.json` / `railpack.json` (if configured — see below). Production **`npm start`** runs Next.js **and** the poller.

> **Config file not applied?** In the service **Settings** tab, set **Config file path** to `/railway.toml` (absolute from repo root). Dashboard start commands override Railpack auto-detect only when config-as-code is not loaded.
>
> **Fallback:** `package.json` `"start"` already runs app + poller, so Railpack’s default `npm run start` is correct even without config files.

## 2. Add persistent storage

1. Open your service → **Volumes** → **Add Volume**.
2. Mount path: `/data`
3. In **Variables**, set:

```bash
DATABASE_PATH=/data/worldcup.db
```

Without a volume, predictions, bets, and simulation results reset on each redeploy.

## 3. Required variables

Set these in the service **Variables** tab (use **Raw Editor** for bulk paste).

| Variable | Example / notes |
|----------|-----------------|
| `APP_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` — poller calls the app over HTTP |
| `DATABASE_PATH` | `/data/worldcup.db` |
| `LLM_PROVIDER` | `openrouter`, `gemini`, `openai`, or `anthropic` (not `vllm` unless you expose a GPU endpoint) |
| `OPENROUTER_API_KEY` | If using OpenRouter |
| `GEMINI_API_KEY` | If using Gemini |
| `FOOTBALL_DATA_API_TOKEN` | **Recommended** — official results via [football-data.org](https://www.football-data.org/client/register) (free). Confirms only `FINISHED` matches. |
| `TAVILY_API_KEY` | News polling; results fallback only if `FOOTBALL_DATA_API_TOKEN` is unset |
| `ADMIN_PIN` | PIN for admin actions (void bets, confirm results) |

Railway sets `PORT` automatically — do not hard-code it.

### Recommended production defaults

```bash
APP_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
DATABASE_PATH=/data/worldcup.db
LLM_PROVIDER=openrouter
FOOTBALL_DATA_API_TOKEN=
FOOTBALL_DATA_SEASON=2026
SEARCH_PROVIDER=tavily
AUTO_PIPELINE_ENABLED=1
AUTO_SIMULATE_ON_RESULTS=1
AUTO_PIPELINE_ON_START=1
AUTO_ANALYZE_MISSING=0
```

Copy the rest from `.env.local.example` as needed (pool name, currency, simulation seed, etc.).

## 4. LLM provider notes

- **vLLM** only works if Railway can reach your GPU server (e.g. Tailscale / public URL). For a simple cloud deploy, use **OpenRouter**, **Gemini**, or **OpenAI**.
- Set the matching `*_API_KEY` and `*_MODEL` for your provider.

## 5. Deploy

Push to `main` (or trigger **Deploy** in the dashboard). First build takes a few minutes (native `better-sqlite3` compile).

Open the generated `*.up.railway.app` URL. Migrations run automatically on first request.

## 6. Verify

| Check | URL / action |
|-------|----------------|
| App loads | `/` |
| LLM configured | `/api/ai/health` |
| Poller running | Service **Logs** → `[poller] Scheduled. Press Ctrl+C to stop.` |

## 7. Custom domain (optional)

Railway → service → **Settings** → **Networking** → add domain, then update:

```bash
APP_URL=https://your-domain.com
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails on `better-sqlite3` | Ensure deploy uses the repo `Dockerfile` (not Nixpacks-only). |
| Data lost after redeploy | Attach a volume at `/data` and set `DATABASE_PATH=/data/worldcup.db`. |
| Poller bulk-analyze fails | Set `APP_URL` to your public HTTPS URL (not `localhost`). |
| 502 / app not reachable | Check logs; confirm `HOSTNAME=0.0.0.0` (set in Dockerfile). |

## Cost

- **Hobby** plan or higher is typical once you add a volume (free tier storage is ephemeral).
- LLM + Tavily API usage is billed by those providers separately.
