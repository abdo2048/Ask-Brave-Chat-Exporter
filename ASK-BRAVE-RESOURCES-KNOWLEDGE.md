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

## 7. Open items — ✅ ALL RESOLVED (see §9 for evidence)
- ~~Exact shape of video/image/news/discussion/shopping result arrays~~ → **RESOLVED**: payloads do NOT
  arrive via SSE (`service_response: null` there by design); they come from **`POST /api/tap/v1/run_tool`
  responses**, which the client re-fires per stored augment event when a conversation loads. Full shapes
  documented in §9 item 1.
- ~~Whether shared-link pages expose the same state without auth~~ → **RESOLVED: YES**, verified in an
  isolated cookie-less browser context. The `#<fragment>` of the share URL IS the complete authorization
  (`symmetric_key`); `source=shared` required. Details in §9 item 2.

---

## 8. APPENDIX: Report-2 Addendum (cross-verified 2026-09-23)

### Confirmed by both analyses
1. **Per-turn citation model** - each answer turn owns its own `augmentations[]`; numbering [n] is scoped per-turn, not global. Exporters must key citations per turn.
2. **Dedupe by normalized URL** - strip utm_*/tracking params, trailing slashes, lowercase host before deduping; same URL re-cited across passages collapses to one entry with merged snippet ranges.
3. **"Cited vs augmented-only" split** - `final.citations[]` = cited (high confidence); `rag.urls[]` and gallery-tab items = augmented-only. Ship as config toggle (`includeUncitedSources`).
4. **Localization fix** - copy-button selectors must be language-agnostic: match `aria-label`, `data-testid`, icon presence rather than text ("Copiar", "Kopieren"...).
5. **Long-conversation fix path** - replace clipboard chain with direct `get_current_state` interception (page already fetches it), clipboard stays as fallback.

### New details from report-2
- **Conversation ID lives in URL** (`?conversation=<32-hex>`); `has_current_state` accepts `{conversation_id}` -> enables bulk export by iterating saved IDs without DOM navigation.
- **Deep-research answers** embed `tool_use` chains (sequential `web_search` calls); resource pool can exceed 40 URLs while citing <15 - reinforcing cited/augmented split as mandatory UX.
- **Suggested exporter schema v2:**

```json
{
  "turn": 1,
  "question": "...",
  "answer_markdown": "...",
  "citations": [{"n": 1, "url": "...", "title": "...", "ranges": [[120, 187]]}],
  "augmented_only": ["url1", "url2"],
  "media": {"videos": [], "images": []}
}
```

- **Standalone-converter risk confirmed:** HMAC signing (nonce + per-conversation symKey) means API-mode export requires an authenticated browser context. A standalone offline converter cannot call these APIs - it would still need clipboard/DOM paste input. This validates keeping the userscript as primary tool.

### TODO status matrix (superseded — see §9 for final statuses)
| Item | Source | Status |
|---|---|---|
| Media gallery payload shapes | section 7 open item | ~~Still needs 1 live SSE capture~~ → RESOLVED via run_tool (§9.1) |
| Bulk export via conversation IDs | report-2 | Endpoint confirmed, ready to implement |
| PDF print CSS | issue #1 | Not started |
| Firefox clipboard permission | issue #3 | README workaround exists; API mode makes it moot |
| Spanish/localized copy buttons | issue #5 | Selector strategy defined above; not yet coded |

## 9. APPENDIX: Section 7 Resolved (live network capture, 2026-09-23)
Source: `SECTION7-RESOLVED.md` (other-AI browser-MCP/DevTools probe). Evidence files:
`rt1084…rt1091.res.network-response` (run_tool responses, 3KB–83KB each).

### 9.1 Media/gallery payload shapes — RESOLVED (and premise corrected)
**Key correction:** result arrays never appear in the SSE stream (`service_response: null` there by
design). They arrive via **`POST /api/tap/v1/run_tool` responses**. When any conversation loads, the
client re-fires one `run_tool` POST per stored `augment_with_*` event (9 observed, reqids 1084–1091).
→ Our capture tooling must target **run_tool response bodies**, not SSE payloads.

| Tool | results live at | count | shape summary |
|---|---|---|---|
| `augment_with_videos` | `service_response.results[]` (NOT under `.web`) | 50 | `{type:'video_result', title, url (youtube watch), description, page_age ISO, age, video:{duration, creator, publisher, tags[], author:{name,url}}, meta_url:{netloc,path}, thumbnail:{src (imgs proxied), original (i.ytimg.com maxresdefault)}}` |
| `augment_with_shopping` | `service_response.results[]` | 1 | Element carries its OWN top-level `signature:{product_name,nonce,sig}` besides request signed_params. `{subtype:'product', product:{name, price, offers:[{priceCurrency}], rating:{ratingValue,bestRating,reviewCount}}}` |
| `augment_with_discussions` | `service_response.web.results[]` filtered by `subtype:'qa'` | 10 | **No dedicated discussions array** — the Reddit/forum strip = web results with `subtype:'qa'` |
| `augment_with_web` | `service_response.web.results[]` | 10 | `{subtype:'generic'|'faq'|'qa'|'article', profile{}, organization{}, faq.items[{question,answer}], thumbnail.original}`; description contains `<strong>` markup |
| `augment_with_news` | `service_response.news.results[]` | 24 | `{title, url, profile{name}, breaking, is_live, thumbnail.src, age, page_age ISO}` |
| `augment_with_images` | `service_response.results[]` | — | `{source (domain), confidence:'high'|'medium'|'low', thumbnail.src, properties:{resized, placeholder}}` |

Exporter implementation pointers:
- Match each run_tool response to its trigger via `signed_params.query` + the wrapper `augment_with_*` event.
- Never parse `service_response` from SSE events (always null).
- Prices/ratings in answer tables come from `product.price` / `offers[]` / `rating{}`.
- Image `confidence` field ranks which images belong to the answer strip.
- Canonical video URL: `url` (watch link) or `thumbnail.original` (maxres poster).

### 9.2 Shared-link auth — RESOLVED: works WITHOUT login (verified)
In a fully isolated, cookie-less Chrome context, loading
`https://search.brave.com/ask?q=…&conversation=<id>#<hash>` caused
`GET /api/tap/v1/get_current_state?id=<id>&symmetric_key=<hash>&source=shared` → **200** with the full
conversation `[timeline, SSE-event-log]`, followed by 9 run_tool re-fires and complete rendering.
- **The `#` fragment IS the complete authorization** (it is the symmetric key).
- `source=shared` is required; `source=cached`/`source=session` → 404.

### 9.3 Architecture impact (with the important caveat)
- **Read side is standalone-capable:** a converter/bulk exporter can fetch `get_current_state` without
  login given only the share URL (with fragment) or a saved `symmetric_key`. This de-risks "API mode".
- **Re-fetch side still needs a browser context:** `run_tool` requests require HMAC-signed `signed_params`
  (nonce+sig) minted the way the SvelteKit app does. So the **userscript remains the primary capture
  tool**; the standalone path covers state reading (citations/text), while media galleries either need
  the userscript's intercepted run_tool bodies or graceful degradation to citation-only export.

### Final TODO status matrix
| Item | Status |
|---|---|
| Media gallery payload shapes (§7 item 1) | ✅ RESOLVED — captured via run_tool responses (§9.1) |
| Shared-link state without auth (§7 item 2) | ✅ RESOLVED — verified stateless via `#fragment` (§9.2) |
| Bulk export via conversation IDs | Ready — recipe: `get_current_state?source=shared` + re-fire run_tool |
| PDF print CSS (issue #1) | Not started |
| Firefox clipboard permission (issue #3) | README workaround; API mode makes it moot |
| Spanish/localized copy buttons (issue #5) | Selector strategy defined; not yet coded |
