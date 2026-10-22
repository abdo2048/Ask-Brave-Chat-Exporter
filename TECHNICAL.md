# Ask Brave Chat Exporter — Technical Overview

This note summarizes the behavior of the v1.5.9 userscript for users and contributors.

## Where it runs

The script runs at `document-start` on the standard Ask Brave and Safe Search conversation pages:

- `https://search.brave.com/ask*`
- `https://safe.search.brave.com/ask*`

It is a client-side userscript. It observes the conversation data Brave already requests in the open tab and uses Brave's own Copy controls when preparing an export. It does not submit additional conversation requests to a separate service.

## Capturing and matching conversation content

Ask Brave's answer stream is newline-delimited JSON. The script observes relevant `fetch` and `XMLHttpRequest` responses without changing the response consumed by the page, then keeps the captured turns and citations in page memory.

At export time, it reads the question shown in the page and uses Brave's Copy control to obtain each visible answer. A captured answer and its cited Sources are used only when they can be matched clearly to the same question and visible answer. This handles regenerated answers without attaching citations from a different version. When matches are ambiguous, the exporter avoids adding uncertain Sources. Auto, API only, and Clipboard only provide different choices for how answer text is collected.

## Shopping results

The script passively observes matching shopping results returned by Brave and associates eligible results with their answer positions. Results are rendered separately from formal Sources in Markdown, HTML, and the Reading PDF profile.

The three-column presentation is a layout, not a three-product limit. The exporter applies its URL and nested-offer exclusions, does not visit or scrape retailer pages, and does not verify prices. Prices are reported by Brave and may be cached.

## Export formats and preferences

The exporter can produce Markdown, standalone HTML, and a browser print-to-PDF preview. Selected formats can be generated together. PDF offers Reading and Print-friendly profiles, with different treatment of Sources, shopping cards, type scale, and page styling. The Contents page and its links are generated from the exported sections.

Theme, typography, and export preferences are saved locally. Marked is pinned to version 15.0.12 and Highlight.js to 11.11.1.

## Privacy and safety notes

- Conversation capture is limited to the page currently open; the script does not crawl other conversations.
- Shopping data comes from Brave's existing page responses. Retailer pages are not contacted for price verification.
- Standalone downloaded HTML is **not sanitized**. Treat it as untrusted when the conversation content is untrusted. The sandboxed PDF preview's Content Security Policy does not protect a separately downloaded HTML file.
- Greasemonkey is unsupported. Tampermonkey and Violentmonkey are supported targets. I tested the final v1.5.9 script and all tests passed.
- PDF appearance, text selection, and print colors can vary with browser versions and print-dialog settings.

## Declared script dependencies

The userscript metadata declares pinned CDN dependencies for Marked 15.0.12 and Highlight.js 11.11.1. These libraries are used for Markdown rendering and syntax highlighting. Pinning the versions avoids a floating dependency version; it does not sanitize exported HTML.
