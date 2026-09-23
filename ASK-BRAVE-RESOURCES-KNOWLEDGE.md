# Ask Brave Resources/Citations — Verified Knowledge Base
> Compiled 2026-09-23 from real captured data (HAR + debug JSONs), NOT guesses.
> Primary source: `ask-brave-debug-1790148661939.json` → `apiResponses["/api/tap/v1/get_current_state"]`
> (4 full conversations, 14 user turns, 174 citation events).

---

## 1. Where resources live (the single source of truth)

The conversation state is a **list of event streams** (one per conversation). Each turn is a flat
sequence of typed events. Resources are NOT a separate "sources panel" object — they are
**events interleaved with the answer text**:

| Event type | Role | Key fields |
|---|---|---|
| `user` | The question | `query`, `quote`, `thumbnails` (base64 images), `document_filenames`, `initial_response` |
| `debug_labels` | Model/pipeline metadata | `labels[]`: e.g. `answer_model: qwen3.8-27b`, `category: simple_qa`, `pipeline: v2-native` |
| `text_start` / `text_delta` / `text_stop` | Streaming markdown answer | `text_stop.text` = full segment; multiple segments per answer |
| `augment_with_inline_citation` | **A resource/reference** | `url`, `title`, `snippet`, `favicon` |
| `rag` | URLs fed to the model (context, not shown) | `queries[]`, `urls[]` |
| `tool_use` | AI called a tool | `name` (`web_search`, `augment_with_images`…), `arguments.queries[]` |
| `reasoning_progress` / `thinking_summary` | "Searching for…" UI text | `text` / `summary` |
| `inline_entity` | Entity chip (e.g. "Google") | `name`, `conversation` |
| `followups` | Suggested next questions | `followups[]` |
| final object (`event:"citation"`) | Per-answer citation index | `answer`, `citations[]` with `number`, `start_index`, `end_index`, `url`, `snippet`, `favicon` |

### Augmentation families (resource TYPES users can see on the page)
Captured counts across the 4 conversations:
- `augment_with_inline_citation` ×174 → numbered [1][2]… references (web pages)
- `augment_with_web` ×3 → follow-up web searches (with signed params: `conversation`, `index`, `q`, `sig`, `nonce`)
- `augment_with_videos` ×4, `augment_with_images` ×2, `augment_with_news` ×1,
  `augment_with_discussions` ×1, `augment_with_shopping` ×1 → media/gallery panels
- `enrichments` ×1 → raw LLM text block (no citations)

So the visible "types" of resources are: **Web links (inline citations), Videos, Images, News, Discussions (Reddit-style), Shopping, and entity chips**.

---

## 2. How [n] markers map to resources (VERIFIED)

The final per-answer object contains `citations[]` where each entry has:
```json
{"event":"citation","number":1,"start_index":0,"end_index":279,
 "url":"https://www.create-learn.us/...","favicon":"https://imgs.search.brave.com/...",
 "snippet":"Create & Learn offers a 'Free Intro to Python Coding' class..."}
```
- `number` = the [n] badge shown in the text.
- `start_index`/`end_index` = character range in `answer` that the citation supports.
- **Same URL keeps the same number but appears multiple times with different snippets**
  (e.g. create-learn.us cited at indices 0–279 AND 414–503, both as [1]).
- Numbering is **per-turn**, not per-conversation.

---

## 3. Why resources appear REPEATED (VERIFIED, quantified)

Per-turn stats from real data:

| Turn example | citation events | unique URLs |
|---|---|---|
| "intro to python … for kids" | 29 | 11 |
| "give me some news about pyton" | 30 | 20 |
| "hello meaning in spanish" | 25 | 14 |
| whole conv0 (Japanese greetings) | 41 | 23 |
| whole conv2 (python kids) | 78 | 45 |

Mechanism: every time the model cites a passage, an `augment_with_inline_citation` event fires —
so **one URL generates many events** (create-learn.us appeared 7×, ulpa.jp 4×). Dedup key must be
the **URL** (optionally normalized: strip trailing slash/query), and keep first-seen title/snippet,
or merge snippets.

## 4. Why some resources look UNRELATED (EXPLAINED)

Three verified causes:
1. **Multi-tool search fan-out.** Deep-research turns run several `web_search` calls with
   reformulated queries (`rag.queries[]`). E.g. the "python classes for kids" conversation also
   triggered `augment_with_news {q:"Python news"}` and shopping searches — pulling in
   versionlog.com/python, docs.python.org/3.14, thenewstack.io articles that have nothing to do
   with kids' classes. They're results of *auxiliary* searches the AI decided to run.
2. **Context carry-over.** Follow-up turns reuse earlier sources ("Arabic greetings" turn re-shows
   Spanish-greeting pages from the previous turn's pool).
3. **Conversation-level vs turn-level rendering.** The sidebar/resources strip often shows the union
   of ALL augmentations in the conversation, while inline [n] badges are per-turn. That's why the
   footer list looks bigger/noisier than what the answer actually cites.

**Rule for our exporter:** inline-cited URLs (in `final.citations[]`) = high-confidence resources.
`rag.urls[]` = fetched-but-not-necessarily-cited context. Media galleries (`videos/images/news/
discussions/shopping`) = separate optional sections. Offer a config option:
"cited only" vs "all augmented".

## 5. Relationship to DOM/UI
- Inline badges `[1]` in message text ↔ `final.citations[].number`.
- Hover card on badge ↔ that citation's `title`+`snippet`+`favicon`.
- Bottom "Resources/Sources" strip ↔ deduped `augment_with_inline_citation` events (+ media panels
  for videos/images/etc.).
- Favicons are proxied through `https://imgs.search.brave.com/<hash>/rs:fit:32:32:1:0/g:ce/<b64-of-original-url>` — decodable if we want original favicon URLs.

## 6. Implications for the exporter script (Phase 3 "Resources Section")
1. Best extraction path = read `get_current_state` response (or SSE stream events), NOT DOM:
   gives clean `url/title/snippet/number/start/end` per turn — impossible via copy-button text.
2. Deduplicate by URL within each turn; optionally across conversation (flag).
3. Group by family: Citations / Videos / Images / News / Discussions / Shopping.
4. Mark provenance: `cited` (has [n] in answer) vs `augmented-only` (shown in strip but uncited) —
   solves the "unrelated resources" complaint transparently instead of guessing.
5. Keep clipboard export as fallback; API path fixes long-conversation truncation too.
6. Signed params (`sig`,`nonce`,`symKey`) mean we cannot replay arbitrary requests ourselves easily —
   but we don't need to: the page already fetches `get_current_state`; we just intercept it.

## 7. Open items (to verify next capture)
- Exact shape of video/image/news/discussion/shopping result arrays (we saw the trigger events;
  their `service_response` was null in cached state — need a live SSE capture to see payloads).
- Whether shared-link pages expose the same state without auth.
