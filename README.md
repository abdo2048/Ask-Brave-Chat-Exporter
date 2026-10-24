<h1 align="center">
  <br>
  <img width="430" height="215" alt="Ask Brave Chat Exporter main page" src="https://github.com/user-attachments/assets/e097cac0-8ac3-4c69-a400-dfc0c8f94bec" />
  <br>
  Ask Brave Chat Exporter
  <br>
</h1>

<h4 align="center">browser userscript that exports Ask Brave conversations to Markdown, standalone HTML, and print-to-PDF — with cited Sources and captured shopping results.<br>
  (((Built with AI tools)))</h4>

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
- **Multi-format export** — select Markdown (.md), HTML (.html), PDF, or combine them in one export action
- **Two PDF profiles** — Reading retains HTML-like light-reader surfaces and the HTML font stack where available, plus screen-scale type, cited Sources, and light accent fills; Print-friendly uses smaller print-scale type, hides Sources, and flattens fills; both open a sandboxed browser print preview for Save as PDF
- **Three capture methods** — Auto / API only / Clipboard only
- **Custom conversation titles**
- **Sources per answer** — every answer's citations appear as a numbered list in both Markdown and HTML
- **Font-size controls** — 16px body/master with independent Questions, Answers, Headings, and shared inline/block Code sliders; code defaults to 0.78rem (12.48px); settings persist
- **Shopping results** — includes matching, passively captured product results at their answer position in Markdown, HTML, and Reading PDF; product prices are Brave-reported and may be cached
- **Search-to-Ask continuity** — the Export button is available on Brave Search and Safe Search pages and remains available when a search-results follow-up opens Ask without refreshing
- **HTML print options** — saved Sources and shopping settings control Ctrl+P from downloaded HTML only; direct PDF profiles use their own rules

### Markdown output
- Callout question blocks (`> [!question] Q1`) — renders as a styled callout in Obsidian, plain blockquote elsewhere
- Horizontal rules between Q&A pairs
- Metadata header with title, export date, capture method, and the complete **Chat URL** (query and fragment preserved)
- **Shopping results** appear in a three-column table, separately from formal Sources; only the product title is linked, and prices/merchant domains stay plain text
- **Sources** section after each answer, linking cited URLs

### HTML output
- **Theme control** — Light / Dark only; the first visit or a legacy `auto` preference follows the OS, and an explicit selection persists; printing always uses light tokens
- **Nord code palette** — Nord5 `#E5E9F0` in light mode and Nord0 `#2E3440` in dark mode for both inline and block code; syntax colors are contrast-adjusted
- **Offline-ready highlighting** — Highlight.js tokenizes supported languages at export time; highlighted HTML and CSS travel with the export, while unknown languages remain plain text
- **Slate/Indigo page palette retained** — no page-wide Nord recolor
- **Sticky table of contents** with active-section highlighting and auto-scroll
- **Chat URL** shown as a link, preserving the complete current URL including query parameters and fragment
- **Mobile-responsive** with hamburger menu
- **Copy buttons** for code blocks and questions (appear on hover)
- **Three-dot table menu** — Copy for Excel (TSV), Copy as Text, or Copy Markdown (appears on hover)
- **Print-optimized** — downloaded HTML uses its own print stylesheet for Ctrl+P; it requests 0.5in margins, adds a styled clickable contents page, hides screen UI/export metadata, prints a crisp title, repeats table headers, and uses the 0.78 body / 0.92 code print scale. Direct PDF profiles use a separate sandboxed preview
- **Shopping results** appear in a three-column grid at their answer positions; URLs are deduplicated by the approved rules, and alternate offers are clearly labeled as Brave-reported
- **Sources block** after each answer with favicons and clickable links

### Compatibility
- **Search-to-Ask testing:** Before the v1.5.10 metadata bump, I tested the flow on both standard Brave Search and Safe Search, including direct Ask, Back/Forward, an older sidebar conversation, and New Conversation. Answers and Sources matched where available, and no duplicate button appeared. The v1.5.10 change is version metadata; runtime code is otherwise unchanged.
- **Offline regressions:** the 6-case shopping/diagnostics suite and 14-case answer/Sources suite pass; the final JavaScript artifacts pass syntax checks.
- **Firefox-specific handling** — observes the page's clipboard-write calls instead of trying to read the clipboard without a user gesture.
- **Localized copy-button detection** — recognizes the supplied Brave copy-button labels for 49 display-language entries (38 distinct fallback labels, including legacy aliases).

### Userscript managers

| Manager | Support | Notes |
|---|---|---|
| **Tampermonkey** | Supported | Intended target. |
| **Violentmonkey** | Supported | Intended target. |
| **Greasemonkey** | Not supported | No compatibility promise. |

---

## Installation

### Requirements

Install **Tampermonkey** (recommended) or **Violentmonkey**:

- [Chrome Web Store — Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox Add-ons — Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
- [Firefox Add-ons — Violentmonkey](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/)
- [Microsoft Edge Add-ons — Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### Install the script

**Method 1 (Greasy Fork):** Visit [the Greasy Fork page](https://greasyfork.org/en/scripts/561042-ask-brave-chat-exporter) and click *Install this script*.

**Method 2 (GitHub):** Open or download the [latest script](https://raw.githubusercontent.com/abdo2048/Ask-Brave-Chat-Exporter/main/Ask-Brave-Chat-Exporter.js). If your browser or manager does not show an install prompt for the `.js` link, use Tampermonkey or Violentmonkey’s **Install from URL** option with that link (or import/paste the script), then review and confirm the installation.

### 🛑 Notes

If the browser asks for clipboard access, choose **Allow** when you want to export. The script uses Brave’s Copy controls to capture the text currently shown; declining may prevent clipboard-based capture.

<img width="49%" alt="Brave clipboard permission prompt" src="https://github.com/user-attachments/assets/163137af-ddb7-4545-bd02-10db670be13c" />

### Use

1. Open an Ask conversation directly at [search.brave.com/ask](https://search.brave.com/ask) or [safe.search.brave.com/ask](https://safe.search.brave.com/ask), or start from either Brave Search page and use a search-result follow-up to enter Ask.
2. Click the **💾 Export** button (bottom-right corner). It may already be visible on the search page; it remains available through the transition, so no refresh is needed.
3. Choose formats, a PDF profile if needed, capture method, title, fonts, and print settings
4. Click **Export selected formats**; if PDF is selected, use **Save as PDF** in the browser print dialog

---

## Export options explained

| Option | What it does |
|---|---|
| **Formats** | Select Markdown, HTML, PDF, or any combination. Markdown and HTML download as files; PDF opens the browser print preview. |
| **PDF profile** | Choose Reading or Print-friendly for exporter-generated PDF. The comparison below explains the difference. HTML print options do not affect these profiles. |
| **Capture method** | Choose Auto, API only, or Clipboard only. See the quick comparison below. Checking answers may change clipboard contents and take longer on long chats. |
| **Include Sources when printing HTML** | Applies only to Ctrl+P from downloaded HTML. It does not change the screen view or direct PDF profiles. |
| **Include shopping results when printing HTML** | Also applies only to Ctrl+P from downloaded HTML. Captured results appear only when Brave supplied matching data. |
| **Font size** | Five saved sliders: Base, Questions, Answers, Headings, and Code (inline and block code together; default 0.78rem / 12.48px at the 16px base). |

### Capture methods at a glance

| Mode | Answer text | Sources |
|---|---|---|
| **Auto** | Keeps the answer currently shown; captured API text is used only for a verified match. | Adds captured Sources only when the match is clear; otherwise keeps the visible answer without uncertain Sources. |
| **API only** | Requires every visible answer to be verified against captured API data. | Stops if any visible answer cannot be verified. |
| **Clipboard only** | Uses the text copied by Brave's Copy controls. | Can still include captured Sources when the answer match is verified. |

---

## Print and PDF: choose a route

There are two print routes. Use the table to pick the one that matches what you want to do:

| Route | Use it when… | Steps | Settings that apply |
|---|---|---|---|
| **Exporter-generated PDF** | You want a PDF using one of the exporter's two layouts. | Select **PDF**, choose **Reading** or **Print-friendly**, then choose **Save as PDF** in the browser preview. | The selected PDF profile applies. The HTML print checkboxes do not. |
| **Print downloaded HTML** | You already have an `.html` export and want to print it or use its HTML-only print controls. | Open the `.html` file and press **Ctrl+P** (or **Cmd+P** on macOS). | The saved **Include Sources** and **Include shopping results** settings apply only to this route; they do not change the HTML screen view. |

### PDF profile comparison

| Profile | Best for | Sources and shopping | Page style |
|---|---|---|---|
| **Reading** | On-screen reading | Keeps available cited Sources and captured shopping results. | Screen-scale type, light reader-style surfaces, and the HTML font stack where available. |
| **Print-friendly** | Paper printing | Hides cited Sources and shopping results. | Smaller print-scale type, system fonts, and white fills. |

Both PDF profiles open the sandboxed browser print preview. The PDF is a paginated document—not a screenshot of the HTML screen—with a printed Contents page in place of the sidebar. The downloaded HTML has its own embedded print stylesheet and requests 0.5in margins; the browser print dialog can override them.

### Print tips

- To request CSS accent backgrounds, enable **Background graphics** in the browser dialog where available. Browser settings can override CSS colors; Print-friendly intentionally uses white fills.
- Font availability and metrics vary by browser, so line wrapping can change. Reading uses the HTML font stack where available; Print-friendly PDF and downloaded HTML use system fonts to reduce PDF text-mapping issues.
- PDF text selection and appearance can vary with the browser and print settings. If your PDF editor cannot select text, try opening the file in Firefox or Adobe Reader.

---

## How does it work?

To remain active when Brave navigates from search results into Ask within the same document, the userscript matches pages on both Brave Search hosts. The Export button is therefore also visible on search pages.

The script uses a **passive dual-path capture**:

### Path 1 — Passive API capture
Ask Brave fetches conversation data from `/api/tap/v1/stream` using a **newline-delimited JSON** format. The script wraps `window.fetch` at document-start and clones the response body via `ReadableStream.tee()`, parsing events without disturbing the page. The API store retains answer text and citation URLs, including earlier answer versions when Brave regenerates a response.

### Path 2 — Verify what is visible
At export time, the script clicks each answer's Brave Copy button and compares the copied answer with captured API candidates for the same question. It uses captured answer text and attaches cited Sources only when the visible version is verified; ambiguous matches with conflicting citation sets fail closed. `Auto` keeps unmatched visible text without unverified Sources. `API only` stops if any visible answer cannot be verified. `Clipboard only` uses the copied text, while still allowing Sources for a verified match. No clipboard reads are used; the page's clipboard-write calls are observed instead.

### Shopping results
For shopping, the script passively observes matching Brave tool responses and associates them with their answer positions. It renders static product cards, applies the URL and nested-offer exclusions, and keeps them separate from formal Sources. It does not visit retailer pages; displayed prices are Brave-reported and may be cached.

### Hybrid output
Questions come from the DOM. The answer version comes from what Brave currently shows; captured API text and Sources are used only when that exact answer (ignoring whitespace differences) can be matched. Answer verification uses Brave's Copy buttons, so clipboard contents may change and long conversations may take longer. This generic fallback is not a promise of support for unsupported managers.

**Full technical details:** see [TECHNICAL.md](https://github.com/abdo2048/Ask-Brave-Chat-Exporter/blob/main/TECHNICAL.md).

---

## Known limitations

- **Current conversation only.** The script exports the conversation currently open in the browser.
- **Greasemonkey is unsupported.** The project targets Tampermonkey and Violentmonkey, but only browser/manager/version combinations actually tested should be treated as verified.
- **Browser print variation.** PDF rendering and background colors can vary with browser versions and print-dialog settings; the browser may override CSS color requests.
- **Localized UI.** The copy-button fallback covers the 49 display-language entries in the supplied Brave list. If a new label is missing, open an issue with the exact button text.
- **Standalone HTML is not sanitized.** Treat exported HTML as untrusted if its conversation content is untrusted. The sandboxed PDF preview's CSP does not protect downloaded HTML.
- **Deep Research mode** exports correctly, but its specialized UI timeline isn't captured — only the final answer and sources.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the public release history:

- **v1.5.10** — Search-to-Ask continuity across standard and Safe Search, with a version bump so userscript managers can offer the update.
- **v1.5.9** — visible-answer/source matching, combined export and PDF profiles, Safe Search, localized Copy labels, shopping results, and Markdown spacing.
- **v1.5.2** — per-answer Sources, capture-method and font controls, and print improvements.
- **v1.2 (2025-12)** — initial Markdown and HTML export.

---

## Contributing

Bug reports, pull requests or suggestions are welcome.

When reporting a bug, please include:
- Browser name and version
- Userscript manager and exact version (Tampermonkey / Violentmonkey are intended targets; Greasemonkey is unsupported)
- Ask Brave URL only if the conversation and its URL are safe to share; otherwise omit it
- A concise, redacted console error if relevant. Do **not** post `window.__ABX`, private prompts/answers, tokens, cookies, request headers, session data, or a private conversation URL
- A screenshot if the issue is visual, after removing any private conversation content

See [TECHNICAL.md](https://github.com/abdo2048/Ask-Brave-Chat-Exporter/blob/main/TECHNICAL.md) for architecture details before submitting code changes.

## Roadmap

Status legend: ✅ **Done** · 🚧 **In progress** · 📋 **Planned** · ⏸️ **Deferred** · ❌ **Not feasible as originally scoped**

### Phase 1 — Core export ✅ *(shipped in v1.2)*
- **Markdown + HTML export** via clipboard copy buttons
- **Custom conversation titles**
- **Styled HTML theme** with dark mode and responsive layout

### Phase 2

- ✅ **PDF Export** — *Shipped in v1.5.2.*
  Print-optimized stylesheet; hides sidebar and interactive UI, repeats table headers across pages, avoids orphan headings, keeps rows intact across page breaks.

- ✅ **Chat URL in exports** — *Included in v1.5.9.* The exported link preserves the full current URL, including query parameters and fragment.

- 📋 **Editable HTML Metadata** — *Planned.*
  Allow editing the title and Chat URL directly in the exported HTML file.

### Phase 3

- ✅ **Resources Section** — *Shipped in v1.5.2.*
  Every answer now includes a numbered **Sources** list in both Markdown and HTML.

- ✅ **Brave shopping results in exports** — *Included in v1.5.9.* Static result cards stay at their answer positions in Markdown, HTML, and Reading PDF. Prices are source-reported and may be cached. The exporter applies the approved URL and nested-offer exclusions; it does not scrape retailers or click “View all.”

- ✅ **Configurable Export Options** — *Partially shipped.*
  Current options: three capture methods, font-size sliders, sources-in-print toggle. All persisted.
  Remaining: resources toggle (`none` / `cited` / `all`), title length, consolidated options panel.

- 📋 **Session-scoped bulk export** — *Planned.*
  "Export every conversation whose state we captured this session."

- 📋 **Full sidebar bulk export** — *Planned, larger.*
  Requires reverse-engineering the sidebar's own data source and signing chain.

- ⏸️ **Markdown-to-HTML converter** — *A separate utility.*
  Convert any Markdown file into a standalone HTML page using the Ask Brave Chat Exporter theme. The converter can only include information present in the Markdown file.

## Dependencies
- **marked.js**: Markdown to HTML conversion
- **Inter font**: UI typography
- **JetBrains Mono**: Code block typography
