<h1 align="center">
  <br>
  <img width="430" height="215" alt="Ask Brave Chat Exporter main page" src="https://github.com/user-attachments/assets/e097cac0-8ac3-4c69-a400-dfc0c8f94bec" />
  <br>
  Ask Brave Chat Exporter
  <br>
</h1>

<h4 align="center">browser userscript that exports Ask Brave AI conversations to Markdown and styled HTML — with sources, font-size controls, and print-to-PDF support.<br>
  (((Built with AI tools)))</h4>
<p align="center">
    
  </a>
</p>

&nbsp;

https://github.com/user-attachments/assets/82a15cfe-143a-4831-b41d-70eed53e0b09

&nbsp;

## Screenshots

<div align="center">
  <img src="https://github.com/user-attachments/assets/1d8fc990-4253-402a-8087-95cad625f5cf" width="49%" />
  &nbsp;
  <img src="https://github.com/user-attachments/assets/abda0ce0-c005-4b38-a45e-7dd7e430c38c" width="49%" />
</div>

&nbsp;

<div align="center">
  <img src="https://github.com/user-attachments/assets/58aed5ab-4e66-4f27-98c6-f3434f045e18" width="49%" />
  &nbsp;
  <img src="https://github.com/user-attachments/assets/74c9fd5d-62ab-4a09-9aeb-1b23282e6343" width="49%" />
</div>

&nbsp;

<div align="center">
  <img src="https://github.com/user-attachments/assets/a9b9ebb3-175f-4dcf-9ea1-78902aee3ce4" width="49%" />
  &nbsp;
  <img src="https://github.com/user-attachments/assets/4d3e0677-56bd-437b-95ea-7b5e9c7ef0e5" width="49%" />
</div>

&nbsp;

<div align="center">
  <img src="https://github.com/user-attachments/assets/e4a13af4-dbc5-4ca8-90f1-646ff86f750b" width="50%" />
</div>

## Features

### Core
- **Dual format export** — Markdown (.md) and HTML (.html)
- **Three capture methods** — Auto / API only / Clipboard only
- **Custom conversation titles**
- **Sources per answer** — every answer's citations appear as a numbered list in both Markdown and HTML
- **Font-size controls** — base size, questions, answers, and headings scale independently; saved for next time
- **Sources-in-print toggle** — choose whether source lists appear in printed/PDF output

### Markdown output
- Emoji dividers for question separation (`◤━━━━━━ Q# ━━━━━◥`)
- Horizontal rules between Q&A pairs
- Metadata header with title, export date, and capture method
- **Sources** section after each answer, linking cited URLs

### HTML output
- **Professional theme** — WCAG AA+ compliant, automatic dark mode, fluid responsive typography
- **Sticky table of contents** with active-section highlighting
- **Mobile-responsive** with hamburger menu
- **Copy buttons** for code blocks and questions (appear on hover)
- **Three-dot table menu** — Copy for Excel (TSV), Copy as Text, or Copy Markdown (appears on hover)
- **Print-optimized** — hides UI chrome, repeats table headers across pages, avoids orphan headings
- **Sources block** after each answer with favicons and clickable links

### Compatibility
- Works in **Firefox** and **Chromium-based browsers** (Chrome, Edge, Brave)
- **Firefox-specific fix** — instead of reading the clipboard (which Firefox blocks without user gesture), the script taps the page's clipboard-write calls directly
- **Localized copy-button detection** — falls back through aria-labels in 13+ languages

---

## Installation

### Requirements

Install **Tampermonkey** (or a compatible userscript manager like Violentmonkey):

- [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### Install the script

**Method 1 (Greasy Fork):** Visit [the Greasy Fork page](https://greasyfork.org/en/scripts/561042-ask-brave-chat-exporter) and click *Install this script*.

**Method 2 (GitHub):** Download the latest release's `.js` file, open Tampermonkey → **Utilities** → **Import from URL**, and paste the release asset URL.

### Use

1. Visit [search.brave.com/ask](https://search.brave.com/ask) and open a conversation (or start a new one)
2. Click the **💾 Export** button (bottom-right corner)
3. Choose your options in the dialog (title, formats, capture method, fonts, sources-in-print)
4. Click **Download**

---

## Export options explained

| Option | What it does |
|---|---|
| **Formats** | Choose Markdown, HTML, or both |
| **Capture method** | `Auto` tries API first, falls back to clipboard. `API only` fails cleanly if no capture. `Clipboard only` clicks Copy buttons and reads what the page writes |
| **Include sources when printing** | Uncheck for paper-friendly output (sources stay on screen but hide in print/PDF) |
| **Font size** | Four sliders: base size, questions, answers, headings. Saved automatically |

---

## Print / PDF tips

The HTML export is print-optimized. Before saving as PDF:

1. Open the HTML file in your browser
2. Press **Ctrl+P** (or **Cmd+P**)
3. **Tick "Background graphics"** in the print dialog so colors and table headers render
4. Set margins to your preference (default is fine)
5. Choose **Save as PDF**

In Chrome, "Save as PDF" produces a **text-based PDF** — selectable text and clickable links. If your PDF editor can't select text, try opening the PDF in Firefox or Adobe Reader instead.

---

## How does it work?

The script uses a **passive dual-path capture**:

### Path 1 — API interception (primary)
Ask Brave fetches conversation data from `/api/tap/v1/stream` using a **newline-delimited JSON** format. The script wraps `window.fetch` at document-start and clones the response body via `ReadableStream.tee()`, parsing every event without disturbing the page. Events like `text_delta`, `inline_entity`, and `augment_with_inline_citation` are reduced into a per-turn structure that includes the answer text and all cited URLs.

### Path 2 — Clipboard-write capture (fallback)
When API capture isn't available (older conversations opened mid-session, SPA edge cases), the script clicks each Copy button and captures the text from the page's own `clipboard.writeText` call — no clipboard reads, no Firefox activation issues.

### Hybrid output
Questions always come from the DOM (Brave doesn't echo them back in the live stream). Answers come from the API when available. Sources always come from the API when captured, even when content came from clipboard.

**Full technical details:** see [TECHNICAL.md](TECHNICAL.md) — endpoint reference, event grammar, DOM structure, and architecture notes for anyone forking or extending this script.

---

## Known limitations

- **Share URLs only.** The script exports conversations currently open in the browser. Bulk export from a share URL is on the roadmap.
- **Chrome's "Background graphics" quirk.** In some Chrome versions, the PDF renderer decides between text-based and image-based output based on this checkbox and internal heuristics. The current script produces text-based PDFs in our tests, but browser updates can change this.
- **Localized UI.** The copy-button fallback tries 13+ languages, but if yours isn't covered, please open an issue with the button label text.
- **Deep Research mode** exports correctly, but its specialized UI timeline isn't captured — only the final answer and sources.

---

## Changelog

### v1.5.2 (current)
- **Sources per answer** in both Markdown and HTML
- **Font-size controls** (base / questions / answers / headings), persisted
- **Sources-in-print toggle**, persisted
- **Capture-method selector** (Auto / API / Clipboard)
- **Three-dot table menu** (Copy for Excel / Copy as Text / Copy Markdown)
- **Firefox clipboard fix** — taps write side instead of reading
- **Localized copy-button detection** — 13+ language fallbacks
- **Print CSS overhaul** — pagination, table shrink, orphan control, clean sources
- **Question color and spacing fixes**
- **NDJSON stream parser** — correct handling of Brave's actual response format
- **Entity text injection** — `inline_entity` events appended to answers

### v1.2 (2026-12)
- Initial release
- Markdown and HTML export via clipboard copy buttons

---

## Contributing

Bug reports, pull requests or suggestions are welcome

When reporting a bug, please include:
- Browser name and version
- Conversation share URL (if possible)
- Console output (F12 → Console) — especially `window.__ABX` if it relates to capture issues
- A screenshot if the issue is visual

See [TECHNICAL.md](TECHNICAL.md) for architecture details before submitting code changes.

## 🛑 Notes
- When running the script, the browser may ask you if you want let the script use your clipboard or not. You should press **Allow** so that the script can copy user prompts ans Ai answers to clipboard.
  - <img width="49%" alt="brave_tHOfxefFbvi" src="https://github.com/user-attachments/assets/163137af-ddb7-4545-bd02-10db670be13c" />

## Roadmap

Status legend: ✅ **Done** · 🚧 **In progress** · 📋 **Planned** · ⏸️ **Deferred** · ❌ **Not feasible as originally scoped**

### Phase 1 — Core export ✅ *(shipped in v1.2)*
- **Markdown + HTML export** via clipboard copy buttons
- **Custom conversation titles**
- **Styled HTML theme** with dark mode and responsive layout

### Phase 2

- ✅ **PDF Export** — *Shipped in v1.5.2.*
  Print-optimized stylesheet; hides sidebar and interactive UI, repeats table headers across pages, avoids orphan headings, keeps rows intact across page breaks. Save as PDF via the browser's built-in print dialog.

- 📋 **Share URL Integration** — *Planned.*
  Include the Brave Ask share URL in exports, either by scraping the current conversation or accepting a manually-entered URL in the export dialog. Will let recipients jump back to the original thread.

- 📋 **Editable HTML Metadata** — *Planned.*
  Allow editing title and share URL directly in the exported HTML file (inline editing or a small header editor). Useful when a reader wants to re-share after editing.

### Phase 3

- ✅ **Resources Section** — *Shipped in v1.5.2.*
  Every answer now includes a numbered **Sources** list in both Markdown and HTML. Extracted from Brave's `augment_with_inline_citation` events, deduplicated by URL. A **Sources in print** toggle in the export dialog controls whether sources appear in the printed/PDF output.

- ✅ **Configurable Export Options** — *Partially shipped.*
  Current options: three capture methods (Auto / API only / Clipboard only), font-size sliders (base / questions / answers / headings), sources-in-print toggle. All persisted across sessions.
  Remaining: resources toggle (`none` / `cited` / `all`), title length, and a consolidated options panel.

- 📋 **Bulk Export** — *Planned.*
  Export multiple conversations in a single operation. The relevant endpoints (`has_current_state`, `get_current_state?source=shared`) are mapped and would iterate over a list of saved conversation ids.

- ⏸️ **Standalone Converter** — *Deferred.*
  A pre-built binary to convert any Markdown file to this HTML theme, offline.
  **Why deferred:** Brave's API requests are HMAC-signed with per-conversation symmetric keys generated client-side. A standalone tool cannot mint those signatures, so it can only convert already-exported Markdown — not fetch conversations on its own. The userscript remains the only viable capture tool for live data. The offline Markdown → HTML converter is still achievable as a separate small project, but it belongs outside this userscript.

## Dependencies
- **marked.js**: Markdown to HTML conversion
- **Inter font**: UI typography
- **JetBrains Mono**: Code block typography
