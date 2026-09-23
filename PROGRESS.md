# Progress Log — v1.3 development

## 2026-09-23 — STEP 1: API-mode extraction ✅ CODE COMPLETE (unit-tested)

**File:** `Ask Brave Chat Exporter v1.3.js` (new; v1.2 left untouched as fallback/reference)

What was built:
- `@run-at document-start` added so the interceptor exists before Brave's first fetch.
- Passive network capture (`__ABX` store on window):
  - Wraps `window.fetch`: tees `/api/tap/v1/stream*` (SSE, streamed reader pump) and
    `/api/tap/v1/get_current_state` (cloned JSON). All other URLs pass through untouched.
  - XHR backup wrapper for the same endpoints.
  - Event reducer understands verified event types: `question`, `answer`,
    `augment_with_inline_citation` (dedup by id/url), `tool_use` (augment_with_* recorded),
    `rag` (urls), `final`. Turn pairing is index-based → immune to missing copy buttons
    and DOM virtualization (fixes long-conversation + quick-answer bugs).
- `buildConversationFromApiState()` produces the exact message array shape the existing
  Markdown/HTML generators consume; attaches `sourcesByTurn` metadata for Step 3.
- `startExport`: mode = `CONFIG.EXPORT_MODE` ('auto' default) → tries API first, falls back
  to clipboard with console warning. Exports record their method (MD header + HTML meta).
- Export dialog shows data-source status line (✅ API ready N turns / ⚠️ will use clipboard)
  and title placeholder falls back to first captured question when DOM lacks it.

Tests (`tests/test-step1-api-mode.mjs`, Node harness with fake fetch/SSE):
- multi-turn assembly, answer-chunk concatenation, citation dedupe, rag/tool_use capture ✔
- SSE frame parsing incl. [DONE] ✔; live fetch streaming ✔; passthrough of non-API URLs ✔
- get_current_state JSON walk ✔
All passed. `node --check` clean.

Not yet done (deliberately): "Reload capture" trigger button (plan Step 1.3 fallback nicety),
Step 2 hardening, Steps 3–6.

### Manual test checklist for user (live browser)
1. Install v1.3 (replace v1.2; keep both disabled-checked: only one enabled).
2. Open a NEW conversation, ask 2–3 questions. Dialog should show "✅ API data ready".
3. Export → MD/HTML contain full markdown answers; no clipboard prompts; works in Firefox
   with clipboard permission denied.
4. Open an OLD conversation created before installing script: status shows ⚠️ → export uses
   clipboard fallback (v1.2 behavior). After any reload that triggers get_current_state,
   API mode becomes available.
5. Long conversation (the previously failing kind) → should now export fully via API.
