# Roadmap: validation & credibility

Audited plan for World Cup Odds 2026 — from external reviewer feedback, production bugs, and internal gaps. **North star:** prove match probabilities are calibrated, not just simulate a bracket.

## Success criteria

| Milestone | Done when |
|-----------|-----------|
| Trustworthy UI | Champion/survival align; pages refresh on results **and** new sims without manual reload |
| Understandable | Users see uncertainty framing + methodology |
| Match predictor validated | AI Brier beats Elo-only on 30+ confirmed matches |
| Draws handled | Group draw calibration bins improve after MD2+ |
| Externally credible | Published live metrics + methodology; optional historical backtest |

---

## Phase 0 — Complete

| Item | Status | Notes |
|------|--------|-------|
| Tournament depth champion double-count | ✅ | `lib/simulator.ts` — final winner counted once |
| Champion “what changed” baseline | ✅ | `getComparisonBaselineSimulation()` skips duplicate sims at same confirm count |
| Auto-refresh on confirmed results | ✅ | `TournamentStatusRefresher` |
| Auto-pipeline on results / startup | ✅ | `AUTO_PIPELINE_*` env flags |
| React hydration (#418) on dates/theme | ✅ | `ClientDateText.tsx`; theme via `ThemeScript` only |
| Graded matches sort on `/accuracy` | ✅ | Newest kickoff first (was Brier worst-first) |
| Admin PIN on costly HTTP routes | ✅ | Analyze, news sync, LLM switch, sim, confirm |

**Edge case (resolved):** Code-only sim fixes do not auto-rerun if `needsSimulationRerun()` is false. One manual re-sim or wait for next confirmed result. Documented in methodology.

---

## Phase 1 — Polish & discoverability (this branch)

| # | Task | Status | Acceptance criteria | Files |
|---|------|--------|---------------------|-------|
| 1.1 | Uncertainty copy on `/champion` | ✅ | Top favorite shows fail %; links to methodology + accuracy | `ChampionUncertaintyNote.tsx`, `app/champion/page.tsx` |
| 1.2 | `/how-it-works` methodology page | ✅ | Pipeline, news caps, validation, known limits | `app/how-it-works/page.tsx` |
| 1.3 | Auto-refresh on new simulation | ✅ | `simulation.runAt` change triggers `router.refresh()`; 5s poll while pipeline active | `TournamentStatusRefresher.tsx`, `lib/tournament/status-sync.ts` |
| 1.4 | Surface `/accuracy` from champion | ✅ | Early-sample callout; link when matches graded | `ChampionAccuracyCallout` |
| 1.5 | Champion column uses `championOdds` | ✅ | Tournament depth Champion column matches main table even if cache stale | `SurvivalOddsTable.tsx` |

---

## Phase 2 — Validate during WC 2026

| # | Task | Status | Acceptance criteria | Depends on |
|---|------|--------|---------------------|------------|
| 2.1 | Live grading (Brier, log loss, bins) | ✅ built | Auto-updates on each confirm | — |
| 2.2 | Elo-only baseline comparison | ✅ this branch | `/accuracy` shows AI vs Elo-at-kickoff Brier | `lib/calibration/elo-at-kickoff.ts` |
| 2.3 | News vs AI-base comparison | ✅ built | Already on `/accuracy` | — |
| 2.4 | Early-sample guard | ✅ this branch | Banner when `count < MIN_ACCURACY_SAMPLE` (10) | `MIN_ACCURACY_SAMPLE` |
| 2.5 | Brazil / market spot check | 🔲 manual | Document gap at match level vs de-vigged books | External odds source |
| 2.6 | One-match sensitivity script | 🔲 | Flip one result → measure Δ champion % for top 10 | `scripts/sensitivity-one-match.mjs` |
| 2.7 | Draw-specific calibration bins | 🔲 | Separate bins for draw probability vs draw outcomes | MD2+ data |
| 2.8 | Publish interim validation note | 🔲 | After 30+ matches: AI vs Elo, draw performance | 2.2, 2.7 |

### Reviewer concern → response → status

| Concern | Response | Status |
|---------|----------|--------|
| “Is the model broken?” | Match predictor is the model; sim is plumbing | Framed in `/how-it-works` |
| Brazil undervalued | Investigate at **match** level vs markets | 2.5 manual |
| Propagation too aggressive | Austria–Jordan moved favorites &lt;1pp | Acceptable; 2.6 will automate |
| Only 5k sims noisy | Fixed seed → stable UI; ~±0.6pp for 24% favorite | Documented; CI optional in Phase 3 |
| Calibration missing | `/accuracy` exists | 1.2, 1.4 improve discoverability |
| Users misread 24% | Uncertainty copy | 1.1 ✅ |
| News narrative bias | Structured events + ±35 Elo cap + decay | Documented; validate via 2.3 |
| Historical backtest | Gold standard | Phase 4 |

---

## Phase 3 — Model improvements (data-driven only)

Do **not** start until Phase 2 shows where weakness is.

| # | Task | Trigger | Guardrails |
|---|------|---------|------------|
| 3.1 | Group draw calibration | Draw bins off in MD2+ | `DRAW_CALIBRATION_K` env; skip Elo-seeded preds |
| 3.2 | Empirical host bonus (USA/MEX/CAN) | Estimate from 1990+ hosts → Elo pts | No hard-coded %; document on `/how-it-works` |
| 3.3 | Champion odds confidence intervals | Optional credibility feature | Prod: fixed seed; research: multi-seed CI |
| 3.4 | Betting site comparison UI | Match-level calibration understood | External API, fixture map, de-vig |
| 3.5 | Bump `SIMULATION_ITERATIONS` | Seed-sweep shows tail noise &gt;1pp | Env-only change; measure runtime on Railway |

---

## Phase 4 — Research-grade credibility

| # | Task | Output |
|---|------|--------|
| 4.1 | Historical backtest (2010–2022) | Table: tournament → Brier → log loss |
| 4.2 | Point-in-time Elo + predictions | No lookahead; pre-kickoff info only |
| 4.3 | Public validation summary | Static page or post linking live + backtest |

---

## Out of scope (unless data proves need)

- Replacing LLM with pure Elo because markets disagree on Brazil
- Hard-coded host % bonuses without historical estimate
- 50k sims as first-line fix for champion odds
- LLM calls inside Monte Carlo loop

---

## Automation reference

| Event | Behavior | Config |
|-------|----------|--------|
| Result confirmed | Debounced re-sim (~5s) | `AUTO_SIMULATE_ON_RESULTS=1` |
| Server startup | Re-sim if `needsSimulationRerun()` | `AUTO_PIPELINE_ON_START=1` |
| Bulk analyze done | Always schedules re-sim | `AUTO_PIPELINE_ENABLED=1` |
| Client UI | Refresh on confirm count/timestamp or `simulation.runAt` | `TournamentStatusRefresher` |
| Code deploy only | No auto re-sim unless stale | By design |

### `needsSimulationRerun()` is true when

- New confirmed results since last sim
- Predictions newer than last sim
- LLM provider mismatch

### `needsSimulationRerun()` is false when

- Only sim math changed in a deploy (one manual re-sim or wait for next result)

---

## Environment variables (validation-relevant)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SIMULATION_ITERATIONS` | 5000 | Monte Carlo count |
| `SIMULATION_SEED` | 42 | Reproducible odds |
| `NEWS_IMPACT_ENABLED` | true | Squad news overlay |
| `NEWS_IMPACT_MAX_DELTA` | 35 | ±Elo cap per team |
| `NEWS_IMPACT_FIXTURE_DAYS` | 14 | Decay window before kickoff |
| `DRAW_CALIBRATION_K` | — | Phase 3; not implemented |
| `AUTO_PIPELINE_*` | see `.env.local.example` | Auto re-sim |

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Small sample over-interpreted | `MIN_ACCURACY_SAMPLE=10` + early banner |
| Stale survival odds after bugfix | Champion column reads `championOdds`; re-sim clears cache |
| News overweighting narratives | Capped deltas; grade on `/accuracy` |
| Reviewer assumes pure Elo | `/how-it-works` states LLM + Elo hybrid |
| Build fails on `better-sqlite3` | Retry deploy; Dockerfile has native build tools |

---

## Open questions (resolved)

| Question | Decision |
|----------|----------|
| Manual re-sim after every deploy? | No — only when data stale or sim math changed |
| Nav item for methodology? | Link from champion + accuracy (avoid 6th mobile tab) |
| Elo baseline at current or kickoff Elo? | Kickoff — replay seeds + prior results only |

---

## Next actions (ordered)

1. Merge this branch (Phase 1 + 2.2–2.4)
2. Let WC 2026 accumulate graded matches
3. Run 2.5 Brazil spot check after MD2
4. Implement 2.6 sensitivity script
5. Phase 3.1 draw calibration when draw bins show bias
6. Phase 4.1 backtest when live validation justifies the investment
