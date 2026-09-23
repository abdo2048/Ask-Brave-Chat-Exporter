# Ask Brave Chat Exporter — Implementation Plan (v1.3)

Status: ✅ Ready to code. All research questions resolved (see `ASK-BRAVE-RESOURCES-KNOWLEDGE.md`).
This plan is ordered by dependency + impact. Each step lists the GitHub issue it closes.

---

## Current state of v1.2 (audited 2026-09-23)

- Clipboard-only extraction: `copyUserMessages()` / `copyAIAnswers()` click copy buttons,
  then `navigator.clipboard.readText()` (2 call sites).
- Hardcoded English selectors only: `aria-label="Copy"` ×2, `.tap-round`, `.message.user`.
- No fetch/XHR interception, no API-mode, no resources section, no PDF export, no options UI.
- `CONFIG = { COPY_DELAY: 200, MAX_TITLE_LENGTH: 40 }` — not user-configurable.

## Known issues mapped from repo/issues + your reports

| # | Problem | Root cause | Fix step |
|---|---------|-----------|----------|
| 1 | Long conversations fail to export | Clipboard round-trips per message; timing/rate limits; DOM must contain all turns (virtualization); `readText()` needs page focus | **Step 1** (API mode removes clipboard entirely) |
| 2 | Firefox clipboard permission errors (`Document is not focused`, NotAllowedError) | Programmatic `readText()` restrictions | **Step 1** primary; Step 2 fallback hardening |
| 3 | Non-English UI breaks extraction (Spanish "Copiar") | Hardcoded `aria-label="Copy"` | **Step 2** |
| 4 | Quick-answer misalignment (Q1 gets A2) | First answer had no copy button (Brave fixed server-side) but old bug class remains for any buttonless turn | **Step 1** (index-based pairing from API data, immune) + Step 2 graceful skip |
| 5 | Issue #1: PDF export requested | Missing feature | **Step 4** |
| 6 | Resources/citations wanted, with duplicates & unrelated noise | Never implemented; now fully understood via knowledge base | **Step 3** |

---

## STEP 1 — API-mode extraction (PRIMARY FIX; solves issues 1, 2, 4)

Add a passive network interceptor installed at `@run-at document-start`:

1. Wrap `window.fetch` (and XHR as backup) early; when a response URL matches
   `/api/tap/v1/get_current_state` or `/ask/__data.json`, clone and parse the JSON body,
   store latest in `window.__braveExportState`.
2. On export click, if state exists → build conversation directly from it:
   - turns = question text + `answer` events (markdown segments concatenated)
   - pairing is index-based → immune to missing copy buttons and DOM virtualization
   - `final.citations[]` + `augmentations[].sources[]` captured here too (feeds Step 3)
3. Fallback: if no state captured (e.g., tab opened before userscript, SPA edge cases),
   add a **"Reload capture"** action that re-triggers `get_current_state` by navigating
   `history.replaceState` + soft reload of the conversation (proven in debugging sessions),
   and finally fall back to the existing clipboard mode with a clear warning banner.
4. Keep clipboard mode as `mode: "clipboard" | "api" | "auto"` (default auto).

Acceptance test: export a 50+ turn conversation in Firefox with clipboard perms denied → succeeds via API mode.

## STEP 2 — Clipboard-mode hardening (fallback quality; issues 2, 3)

Only applies when API state unavailable:

1. Localized copy-button detection: replace exact `aria-label="Copy"` with a selector set:
   `[aria-label="Copy"], [aria-label="Copiar"], [aria-label="Kopieren"], [aria-label="复制"], [aria-label="コピー"]`
   plus heuristic: `button[data-copy], button.copy` inside `.tap-round-footer-actions`,
   and last-resort title/text match on button content.
2. Robust clipboard read: try `navigator.clipboard.readText()`; on `NotAllowedError`,
   retry once after focusing a hidden textarea; if still failing, prompt user to press
   Ctrl+V into a provided dialog textarea (manual paste mode) instead of aborting.
3. Per-turn resilience: missing copy button → push placeholder `(⚠️ could not capture)`
   and keep alignment (never shift answers onto wrong questions).
4. Adaptive delays: increase `COPY_DELAY` every N messages; catch quota errors with backoff.

## STEP 3 — Resources & Citations section (new feature; uses verified knowledge)

From API state per turn:

1. Collect `final.citations[]` (cited, numbered) and augmentation sources (videos/images/news/discussions/shopping).
2. Dedupe by normalized URL (strip utm/tracking params, trailing slash, lowercase host).
3. Render per-answer "Sources" block (cited only) and/or global "Resources" appendix:
   - Options toggle: `cited_only` (default) vs `all_augmented` — transparency for the
     "unrelated resources" complaint (causes documented in knowledge base §"unrelated").
4. Markdown: `### Sources` list with `[n] [title](url)`; HTML theme: styled citation cards.
5. Mark media-gallery payload shapes as best-effort until one live SSE capture lands
   (open item in knowledge base §9).

## STEP 4 — PDF export (Issue #1)

No library needed: add "PDF" option = open print-optimized view (`@media print` CSS:
sidebar/export button/dialog removed, clean typography, page-break rules between turns)
→ user chooses "Save as PDF". Document in README that this is browser print-to-PDF.

## STEP 5 — Configurable options UI (Phase 3 item, small effort)

Gear icon → panel persisted in `GM_setValue`/localStorage:
export mode (auto/api/clipboard), include resources (none/cited/all), formats, title length, copy delay.
Also makes bulk-export groundwork easy (conversation_id list via `has_current_state` — report-2 finding).

## STEP 6 — Housekeeping

- Version bump 1.2.0 → 1.3.0; update README limitations section:
  quick-answer note (Brave added copy button), long-conversation fix, localization.
- Close/comment on issues #1 (PDF), #3 (Firefox clipboard), #5 (localization).
- Standalone converter (Phase 3): DEFERRED — proven impossible against signed APIs;
  offline side only parses exported JSON (report-2 caveat). Revisit only if you start
  shipping `state.json` alongside exports (recommended: do ship it — cheap, enables future tooling).

---

## Suggested build order & effort

| Order | Step | Effort | Risk |
|-------|------|--------|------|
| 1 | Step 1 API mode | Medium (~half day) | Low — additive, clipboard stays as fallback |
| 2 | Step 2 hardening | Small | Very low |
| 3 | Step 3 resources | Medium | Low — data model fully verified |
| 4 | Step 4 PDF | Small | Very low |
| 5 | Step 5 options | Small | Low |
| 6 | Step 6 docs | Trivial | None |

We start with **Step 1** because it simultaneously kills the three worst bugs
(long conversations, Firefox clipboard, quick-answer misalignment) and is the data
foundation Steps 3–5 depend on.
