# Ask Brave Chat Exporter — Technical Reference

This document is for developers who want to fork, extend, or build on top of the userscript. It documents how Ask Brave works, how the script captures and reconstructs conversations, and what pitfalls to avoid.

**Last updated:** 2026-09-25 (v1.5.2)

---

## Table of contents

1. [Architecture overview](#1-architecture-overview)
2. [Ask Brave internals](#2-ask-brave-internals)
3. [Capture pipeline](#3-capture-pipeline)
4. [Event grammar](#4-event-grammar)
5. [Conversation reconstruction](#5-conversation-reconstruction)
6. [DOM structure reference](#6-dom-structure-reference)
7. [Print / pagination rules](#7-print--pagination-rules)
8. [Gotchas and edge cases](#8-gotchas-and-edge-cases)
9. [Testing checklist](#9-testing-checklist)

---

## 1. Architecture overview

The script is a single userscript that runs at `document-start` on `search.brave.com/ask*`. It installs three interceptors before the page's own JavaScript executes:

| Interceptor | Purpose |
|---|---|
| `window.fetch` wrapper | Taps streaming and state responses |
| `XMLHttpRequest` wrapper | Backup for browsers/contexts where fetch isn't used |
| Clipboard write tap | Captures text from `clipboard.writeText`, `.write`, and `execCommand('copy')` |

Intercepted data is reduced into a `window.__ABX` object:

```js
{
  convs: {
    "<conversation-id>": {
      turns: [ { index, question, answerMd, citationsById, augmentations, ragUrls, followups, usage } ],
      updatedAt: 1732…
    }
  },
  lastSeenAt: 1732…,
  chunks: 42
}
```

At export time, `buildConversationFromApiState()` merges turns across all conversations updated within the last 15 minutes (Brave sometimes changes the URL's `conversation=` param mid-session), pairs them with DOM questions, and hands a flat `[{type:'user'|'assistant', content, index}]` array to the generators.

---

## 2. Ask Brave internals

### 2.1 Endpoints used

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/tap/v1/new` | GET | Create conversation, returns id |
| `/api/tap/v1/stream` | GET | **Main answer stream (NDJSON, not SSE)** |
| `/api/tap/v1/stream_multimodal` | POST | Image-mode answers |
| `/api/tap/v1/run_tool` | POST | Auxiliary tool results (news, videos, etc.) |
| `/api/tap/v1/get_current_state` | GET | Full conversation replay on page load |
| `/api/tap/v1/has_current_state` | POST | Check which conversation ids have server state |

All requests carry a per-conversation `symmetric_key` and per-request `nonce` + `sig` (HMAC). The script never forges these — it only clones responses the page already fetched.

### 2.2 The stream is NDJSON, not SSE

This is the single most important fact:

```
{"type":"text_start"}
{"type":"text_delta","delta":"\n\n"}
{"type":"text_stop","text":"\n\n"}
{"type":"rag","queries":[…],"urls":[…]}
```

Each line is a complete JSON object. No `data:` prefix. Split on `\n` (after normalizing `\r\n`), `JSON.parse` each line.

The parser is tolerant of SSE-format streams too (strips `data: ` if present) in case Brave changes format in the future.

### 2.3 Conversation id mismatch

Brave emits certain events — `inline_entity`, some `augment_with_*` — with their own `conversation` field pointing to a per-turn sub-conversation id, **different from the URL's `?conversation=` param**. Also, on follow-up questions, the URL bar may change to the newest sub-conversation id while the earlier turns stay under the original.

**Rule:** key every event by the **stream URL's `id=` param** (not by `evt.conversation`). Then at export time, merge turns across all conversations updated in the last 15 minutes.

### 2.4 Questions are not in the live stream

The live `/stream` response contains no `user` event. The question text only appears via `get_current_state` (which fires on page load for existing conversations). For live-asked questions, the DOM (`.message.user .user-bubble`) is the only source.

**Rule:** questions always come from DOM. The API's `turn.question` field is a bonus for replayed turns.

---

## 3. Capture pipeline

### 3.1 Fetch wrapper

```js
window.fetch = function (input, init) {
  const url = …;
  const isStream = url.indexOf('/api/tap/v1/stream') !== -1;
  const isState  = url.indexOf('/api/tap/v1/get_current_state') !== -1;
  if (!isStream && !isState) return origFetch(input, init);

  return origFetch(input, init).then(res => {
    if (isStream && res.body && res.body.tee) {
      const [pageSide, sniffSide] = res.body.tee();
      // Read sniffSide, return new Response(pageSide)
    }
    if (isState) res.clone().json().then(handleState);
    return res;
  });
};
```

**Why `tee()` instead of `clone()`:** Firefox's `Response.clone()` starves the clone branch when the original is being consumed by the page. `ReadableStream.tee()` gives two fully independent streams. We hand one back to the page (rebuilding the `Response` with stripped `content-encoding` headers) and read the other ourselves.

### 3.2 Clipboard write tap

Firefox blocks `clipboard.readText()` outside user-activation. Since the first `await` in a loop consumes activation, we can only reliably read one message per click.

The fix inverts the flow: instead of reading, we **observe writes**.

```js
const origWriteText = navigator.clipboard.writeText;
navigator.clipboard.writeText = function (text) {
  __ABX_CLIP.text = String(text);
  __ABX_CLIP.at = Date.now();
  const p = origWriteText.apply(this, arguments);
  return (p && p.catch) ? p.catch(() => {}) : p;
};
```

`execCommand('copy')` and `clipboard.write()` (with `ClipboardItem`) are patched similarly. The rejection swallow is intentional — Firefox throws `NotAllowedError` for synthetic clicks, but the page doesn't handle it, so it surfaces as console noise.

---

## 4. Event grammar

### 4.1 Types that carry answer content

| Event | Field | Action |
|---|---|---|
| `text_delta` | `delta` (string) | Append to `answerMd` |
| `text_stop` | `text` (full block) | Use only if no deltas arrived |
| **`inline_entity`** | `name` (string) | **Append to `answerMd`** — this is the visible text of entity chips |

**Critical:** `inline_entity` is not metadata. Its `name` field IS the rendered text ("Google Chrome", "Signal", "Threema"). Omitting it loses content in table cells and headings.

### 4.2 Types that carry sources

| Event | Fields | Action |
|---|---|---|
| `augment_with_inline_citation` | `url`, `title`, `snippet`, `favicon` | Add to `citationsById` (dedupe by URL) |

One URL can fire multiple events (one per cited passage). Dedupe by URL; first-seen title wins.

### 4.3 Types that carry auxiliary data

| Event | Fields | Action |
|---|---|---|
| `augment_with_news` | `query` | Record augmentation |
| `augment_with_discussions` | `query` | Record augmentation |
| `augment_with_videos` | `query` | Record augmentation |
| `augment_with_web` | `query` | Record augmentation |
| `augment_with_images` | `query` | Record augmentation |
| `augment_with_shopping` | `query` | Record augmentation |
| `tool_use` | `name`, `arguments` | Record augmentation |
| `rag` | `queries[]`, `urls[]` | Record context URLs (not cited) |
| `followups` | `followups[]` | Record suggestions |
| `usage` | token counts | Record |

### 4.4 Types to ignore

`text_start`, `thinking_summary`, `reasoning_progress`, `debug_labels`, `search`, `videos`.

---

## 5. Conversation reconstruction

### 5.1 Event → turn mapping

The stream handler builds a `ctx` object from the stream URL:

```js
const m = url.match(/[?&]id=([a-f0-9]+)/i);
const convId = m ? m[1] : '__unknown__';
const conv = __ABX.convs[convId];
const index = conv ? conv.turns.length : 0;
const ctx = { convId, index };
```

Every event dispatched with this `ctx` lands in the same turn. The `index` is incremented by `buildConversationFromApiState` when it pairs turn N with question N (from DOM).

### 5.2 Merge across conversations

On follow-ups, the URL's conversation id may change. To avoid losing earlier turns, `buildConversationFromApiState` collects all conversations updated in the last 15 minutes, groups their turns by `index`, and picks the longest `answerMd` for each index (merging citations from the shorter version).

### 5.3 DOM → API alignment

```
domQs = extractDomQuestions()   // all .message.user .user-bubble
apiTurns = merged API turns (sorted by index)

offset = domQs.length - apiTurns.length
For i in domQs:
  apiIdx = i - offset
  if apiIdx >= 0: use apiTurns[apiIdx]
  else: use domAs[i]  // DOM fallback
```

The offset handles the case where the user reopened an old conversation (DOM has many turns) but only asked one live question (API has one turn). The last DOM question pairs with the API answer; earlier questions use DOM text.

### 5.4 Hybrid clipboard + API sources

When content came from clipboard, `attachApiSources()` attaches `citationsById` from any recent API capture by turn index — using the same offset logic. This is what lets the clipboard export show sources even though clipboard copy strips them.

---

## 6. DOM structure reference

### 6.1 One turn

```html
<div class="tap-round">
  <div class="message user">
    <div class="user-bubble-wrapper">
      <div class="user-bubble">Question text</div>
      <div class="user-message-actions">
        <button class="user-message-action" aria-label="Copy">
      </div>
    </div>
  </div>
  <div class="message"></div>                       <!-- spacer -->
  <div class="message assistant llm-output">        <!-- ANSWER -->
    … rendered markdown …
  </div>
  <div class="message augment">
    <button class="logo-row-button" aria-label="View all">
    <button class="header-button" aria-label="Tools">
    <button class="enrichment-carousel-button-left" aria-label="Previous">
    <button class="enrichment-carousel-button-right" aria-label="Next">
    <button class="enrichment-button" aria-label="View all">
  </div>
  <div class="divider"></div>
  <div class="tap-round-footer">
    <button class="tap-round-footer-action" aria-label="Copy">
    <button class="tap-round-footer-action" aria-label="Good response">
    <button class="tap-round-footer-action" aria-label="Bad response">
  </div>
</div>
```

### 6.2 Correct selectors

| Target | Selector |
|---|---|
| Question text | `.message.user .user-bubble` |
| Question copy button | `button.user-message-action[aria-label="Copy"]` |
| Answer content | `.message.assistant` |
| Answer copy button | `button.tap-round-footer-action[aria-label="Copy"]` |
| All turns | `.tap-round` |

**Warning:** `.tap-round` wraps BOTH question and answer. A naive `querySelector('button[aria-label="Copy"]')` inside `.tap-round` will return the *question's* button, not the answer's. Always specify the class.

---

## 7. Print / pagination rules

These are the rules baked into `buildPrintCSS()`:

| Rule | Purpose |
|---|---|
| `.toc-sidebar, .copy-btn, .table-menu-btn, .overlay, .print-tip { display: none }` | Hide interactive UI |
| `.container { display: block }` | Flatten grid layout |
| `.question blockquote { background: #f1f5f9 !important; color: #0f172a !important }` | Force light mode with literal colors (variables don't cascade reliably in print) |
| `table { width: 100% !important; table-layout: fixed !important }` | Prevent right-side clipping when user reduces margins |
| `thead { display: table-header-group }` | Repeat table headers on every page |
| `tr { break-inside: avoid }` | Keep each row intact |
| `h1, h2, h3 { break-after: avoid }` | Don't orphan headings at page bottom |
| `a[href]:not([href^="#"]):not(.citations-block a)::after { content: " (" attr(href) ")" }` | Show URLs after links EXCEPT in the sources list |

**Anti-rule (do not add):**
```css
/* ❌ This creates blank pages before any table taller than a page */
.table-outer { break-inside: avoid }
```

---

## 8. Gotchas and edge cases

### 8.1 `evt.conversation` is unreliable
Use `ctx.convId` (from the stream URL) instead.

### 8.2 `inline_entity` must be appended to the answer
Missing this causes empty table cells and missing headings.

### 8.3 NDJSON split
Split on `\n`, not `\n\n`. SSE-style `\n\n` frames don't appear.

### 8.4 Firefox `clone()` starves streams
Use `res.body.tee()` instead. Strip `content-encoding` and `content-length` from the rebuilt response headers.

### 8.5 `get_current_state` shape
Returns `[ [timeline events], [event log] ]`. The event log (index 1) is the one to feed into the reducer.

### 8.6 `symmetric_key` rotates
Every page load gets a new `symmetric_key`. Don't cache or hardcode.

### 8.7 Chrome "Background graphics" affects PDF textuality
In some Chrome versions, ticking this checkbox causes image-based PDF output. The script sets `-webkit-print-color-adjust: exact` on `th`, `td`, and `pre`, which appears to tip Chrome toward vector output. If this regresses, the workaround is to print from Firefox.

### 8.8 Multiple Tampermonkey versions
When testing patches, make sure the NEW version is the one enabled. The old script can be enabled side-by-side and will run before or after yours depending on load order.

---

## 9. Testing checklist

Before shipping any change:

- [ ] Fresh conversation, one turn → export both formats, verify content and sources
- [ ] Fresh conversation, three turns → verify all three questions and answers
- [ ] Reopened old conversation → verify API capture works or falls back cleanly
- [ ] Follow-up question in existing conversation → verify cross-conversation merge
- [ ] Firefox → clipboard-write capture works without console errors
- [ ] Chrome → API capture works without console errors
- [ ] HTML export → hover a table, verify three-dot menu appears
- [ ] HTML export → press Escape after opening menu, verify it closes
- [ ] HTML export → Ctrl+P, verify no blank pages, headers repeat, sources render
- [ ] HTML export with sources-in-print unchecked → verify sources absent in print preview
- [ ] Markdown export → verify `**Sources**` section after each answer

---

*End of technical reference.*