
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

### TODO status matrix
| Item | Source | Status |
|---|---|---|
| Media gallery payload shapes | section 7 open item | Still needs 1 live SSE capture |
| Bulk export via conversation IDs | report-2 | Endpoint confirmed, ready to implement |
| PDF print CSS | issue #1 | Not started |
| Firefox clipboard permission | issue #3 | README workaround exists; API mode makes it moot |
| Spanish/localized copy buttons | issue #5 | Selector strategy defined above; not yet coded |
