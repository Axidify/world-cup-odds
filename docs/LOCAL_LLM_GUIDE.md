# Local LLM Guide (vLLM on H100)

This app defaults to a local vLLM server for bulk match analysis. Use cloud providers (OpenAI, OpenRouter, Gemini, Anthropic) when vLLM is unreachable.

## Recommended models (2026)

| Priority | Model | Notes |
|----------|-------|-------|
| Primary | `Qwen/Qwen3.6-35B-A3B-FP8` | Fits 1× H100; strong open-weight MoE |
| Fallback | `Qwen/Qwen3-30B-A3B-Instruct-2507` | Proven vLLM swap-in |
| Cloud | `alibaba/qwen3.7-plus` via OpenRouter | No self-hosting |

Do **not** use Qwen3-Coder models for match analysis.

## Serve command (primary)

```bash
vllm serve Qwen/Qwen3.6-35B-A3B-FP8 \
  --host 0.0.0.0 \
  --port 8001 \
  --served-model-name Qwen3.6-35B-A3B-FP8 \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.90 \
  --max-num-seqs 8 \
  --max-num-batched-tokens 8192 \
  --enable-prefix-caching \
  --language-model-only \
  --reasoning-parser qwen3 \
  --dtype auto \
  --trust-remote-code
```

Requires **vLLM ≥ 0.19.0**.

## App `.env.local`

```env
LLM_PROVIDER=vllm
VLLM_BASE_URL=http://192.168.28.230:8001/v1
VLLM_MODEL=Qwen3.6-35B-A3B-FP8
VLLM_CONCURRENCY=4
LLM_CONCURRENCY=4
VLLM_MAX_TOKENS=512
VLLM_TIMEOUT_MS=120000
```

`VLLM_MODEL` must match `--served-model-name`.

## Concurrency tuning

1. Start with `VLLM_CONCURRENCY=4`
2. Run **Analyze all matches** on the dashboard (~348 LLM calls)
3. If stable, try 6–8; if OOM/timeouts, reduce to 2–3

Target: ~3–8 s/match → full bulk in **10–25 min** on H100.

## Health check

```bash
curl http://192.168.28.230:8001/v1/models
```

Or open the app → header provider badge → `/api/ai/health`.

## Prefix caching

The match analysis system prompt is **byte-identical** across all calls. Only the user message (teams, stage) changes. Enable `--enable-prefix-caching` on vLLM for ~30–50% faster bulk runs.

## Network split

- **Local / office LAN:** vLLM at `192.168.28.230:8001`
- **Railway / cloud deploy:** use OpenRouter or OpenAI — vLLM is not reachable unless VPN’d to your LAN

## Monitoring

- GPU: `nvidia-smi dmon`
- App: dashboard bulk progress bar during **Analyze all matches**
