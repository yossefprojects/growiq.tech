---
name: Claude chat integration (Jarvis)
description: Constraints when calling Anthropic claude-opus-4-8 via Replit AI Integrations for the chat endpoint.
---

The main chat endpoint streams from Anthropic `claude-opus-4-8` (Replit AI Integrations, env `AI_INTEGRATIONS_ANTHROPIC_*`). Other AI flows stay on OpenAI.

**Constraints (cost real retries if ignored):**
- Do NOT pass `temperature` / `top_p` / `top_k` to `claude-opus-4-8` → returns HTTP 400. Only `model`, `max_tokens`, `system`, `messages`.
- `system` is a TOP-LEVEL param, not a message in the array (unlike OpenAI's system role).
- Stream events: filter `event.type === "content_block_delta" && event.delta.type === "text_delta"`, then read `event.delta.text`.
- `@anthropic-ai/sdk` is a dep of lib `@workspace/integrations-anthropic-ai`, NOT hoisted to api-server — can't `import` it from the repo root or api-server dir in ad-hoc node/sandbox scripts; resolve via `require.resolve` with `paths`.

**Why:** keeps the SSE wire format identical (`data:{content}` + `data:{done:true}`) so the React client is untouched while swapping providers.
