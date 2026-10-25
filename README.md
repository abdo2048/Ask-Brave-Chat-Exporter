<p align="center">
  <img width="430" alt="Ask Brave Chat Exporter main page" src="https://github.com/user-attachments/assets/e097cac0-8ac3-4c69-a400-dfc0c8f94bec" />
</p>

<h1 align="center">Ask Brave Chat Exporter</h1>

<p align="center">Browser userscript that exports Ask Brave conversations to Markdown, standalone HTML, and print-to-PDF—with cited Sources and captured shopping results.<br />(((Built with AI tools)))</p>

<p align="center"><a href="https://github.com/user-attachments/assets/82a15cfe-143a-4831-b41d-70eed53e0b09">Watch the demo</a></p>

## Screenshots

![Export dialog and Markdown output](https://github.com/user-attachments/assets/1d8fc990-4253-402a-8087-95cad625f5cf)
![HTML export](https://github.com/user-attachments/assets/abda0ce0-c005-4b38-a45e-7dd7e430c38c)

![Reading PDF](https://github.com/user-attachments/assets/58aed5ab-4e66-4f27-98c6-f3434f045e18)
![Print-friendly PDF](https://github.com/user-attachments/assets/74c9fd5d-62ab-4a09-9aeb-1b23282e6343)

![Shopping results in an export](https://github.com/user-attachments/assets/a9b9ebb3-175f-4dcf-9ea1-78902aee3ce4)
![Sources in an export](https://github.com/user-attachments/assets/4d3e0677-56bd-437b-95ea-7b5e9c7ef0e5)

![Mobile layout](https://github.com/user-attachments/assets/e4a13af4-dbc5-4ca8-90f1-646ff86f750b)

## Features

### Core

- **Multi-format export** — select Markdown (`.md`), HTML (`.html`), PDF, or combine them in one export action.
- **Two PDF profiles** — Reading keeps screen-scale type, light reader surfaces, available cited Sources, and captured shopping results. Print-friendly uses smaller print-scale type and hides Sources and shopping cards. Both open a sandboxed browser print preview for Save as PDF.
- **Three capture methods** — Auto, API only, or Clipboard only.
- **Custom conversation titles.**
- **Sources per answer** — cited URLs appear after each answer in Markdown and HTML.
- **Font-size controls** — Base, Questions, Answers, Headings, and Code (inline/block code together); settings persist. Code defaults to `0.78rem` (12.48px at the 16px base).
- **Shopping results** — matching, passively captured products appear with their answer in Markdown, HTML, and Reading PDF. Prices are Brave-reported and may be cached.
- **Search-to-Ask continuity** — the Export button is available on standard Brave Search and Safe Search and remains available when a results-page follow-up opens Ask without a refresh.
- **HTML print options** — saved Sources and shopping settings affect Ctrl+P from downloaded HTML only; they do not change the direct PDF profiles.

### Markdown output

- Question callouts such as `> [!question] Q1` (styled in Obsidian, plain blockquote elsewhere).
- Horizontal rules between Q&A pairs.
- Metadata header with title, export date, capture method, and complete Chat URL, including query and fragment.
- Shopping results in a three-column table, separate from formal Sources. Only product titles are linked; prices and merchant domains are plain text.
- A Sources section after each answer with cited links.

### HTML output

- **Light/Dark theme control.** First visit and legacy `auto` preference follow the OS; explicit selections persist. Printing uses light tokens.
- **Nord code palette** — Nord5 `#E5E9F0` in light mode and Nord0 `#2E3440` in dark mode for inline and block code; syntax colors are contrast-adjusted. The page keeps its Slate/Indigo palette.
- **Offline-ready highlighting** — Highlight.js tokenizes supported languages at export time; highlighted HTML/CSS travel with the export and unknown languages remain plain text.
- Sticky table of contents with active-section highlighting and auto-scroll.
- Complete Chat URL displayed as a link.
- Mobile-responsive layout with a hamburger menu.
- Copy buttons for code blocks and questions (on hover); the three-dot table menu (on hover) offers Copy for Excel (TSV), Copy as Text, or Copy Markdown.
- Downloaded HTML has its own Ctrl+P stylesheet: it requests 0.5in margins, adds a styled clickable Contents page, hides screen UI/export metadata, prints a crisp title, repeats table headers, and uses the 0.78 body / 0.92 code print scale. Direct PDF profiles use a separate sandboxed preview.
- Shopping cards appear in a three-column grid with URL deduplication and clear Brave-reported labels for alternate offers.
- Sources blocks include favicons and clickable links.

### Compatibility and testing

- **Search-to-Ask testing:** Before the v1.5.10 metadata bump, I tested standard Brave Search and Safe Search domains, including direct Ask, Back/Forward, an older sidebar conversation, and New Conversation. Answers and Sources matched where available, with no duplicate button.
- **Automated v1.5.11 regressions:** 11/11 question-text/Markdown checks, 15/15 answer/Sources checks, and 6/6 shopping/diagnostics checks pass. Copy-label/version metadata and JavaScript syntax checks pass; the PDF-preview timeout lifecycle has a mocked regression.
- **PDF layout checks:** Reading table pagination and Contents-padding tests pass in headless Firefox 153.5.0 ESR with A4/0.5in/background-on settings. The tests cover repeated headers and long-table continuation as well as the Reading-only Contents inset. Headless/offline checks do not certify every browser's native print dialog or userscript-manager combination. I tested the native Reading-PDF check passed in Firefox 150.0.3/Tampermonkey 5.5.0; this is one reported configuration, not an exhaustive matrix.
- **Firefox clipboard handling** — observes the page's clipboard-write calls instead of trying to read the clipboard without a user gesture.
- **Localized Copy-button detection** — recognizes the supplied Brave labels for 49 display-language entries (38 distinct fallback labels, including legacy aliases).

### Userscript managers

| Manager | Status | Notes |
|---|---|---|
| **Tampermonkey** | Intended target | Browser/manager/version combinations are not all independently certified. |
| **Violentmonkey** | Intended target | Browser/manager/version combinations are not all independently certified. |
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

1. **Greasy Fork:** open the [Ask Brave Chat Exporter page](https://greasyfork.org/en/scripts/561042-ask-brave-chat-exporter) and select **Install this script**.
2. **GitHub:** open or download the [stable script](https://raw.githubusercontent.com/abdo2048/Ask-Brave-Chat-Exporter/main/Ask-Brave-Chat-Exporter.js). If the `.js` link does not show an install prompt, use your manager's **Install from URL** option or import/paste the script, then review and confirm.

## Use

1. Open an Ask conversation directly at [search.brave.com/ask](https://search.brave.com/ask) or [safe.search.brave.com/ask](https://safe.search.brave.com/ask), or start on either Brave Search page and use a search-result follow-up to enter Ask.
2. Click the **💾 Export** button in the bottom-right. It may appear on the search page and remains available through the transition; no refresh is needed.
3. Choose formats, PDF profile if needed, capture method, title, fonts, and print options.
4. Click **Export selected formats**. If PDF is selected, use **Save as PDF** in the browser print dialog.

## 🛑 Notes

If the browser asks for clipboard access, choose **Allow** when you want to export. The script uses Brave's Copy controls to capture the text currently shown; declining may prevent clipboard-based capture.

![Brave clipboard permission prompt](https://github.com/user-attachments/assets/163137af-ddb7-4545-bd02-10db670be13c)

---

## Export options explained

| Option | What it does |
|---|---|
| **Formats** | Select Markdown, HTML, PDF, or any combination. Markdown and HTML download as files; PDF opens the browser print preview. |
| **PDF profile** | Choose Reading or Print-friendly for exporter-generated PDF. HTML print options do not affect these profiles. |
| **Capture method** | Choose Auto, API only, or Clipboard only. Checking answers may change clipboard contents and take longer on long chats. |
| **Include Sources when printing HTML** | Applies only to Ctrl+P from downloaded HTML; it does not change the screen view or direct PDF profiles. |
| **Include shopping results when printing HTML** | Also applies only to Ctrl+P from downloaded HTML. Captured results appear only when Brave supplied matching data. |
| **Font size** | Five saved sliders: Base, Questions, Answers, Headings, and Code (inline and block code together; default `0.78rem` / 12.48px at the 16px base). |

### Capture methods at a glance

| Mode | Answer text | Sources |
|---|---|---|
| **Auto** | Keeps the answer currently shown; captured API text is used only for a verified match. | Adds captured Sources only when the match is clear; otherwise keeps the visible answer without uncertain Sources. |
| **API only** | Requires every visible answer to be verified against captured API data. | Stops if any visible answer cannot be verified. |
| **Clipboard only** | Uses the text copied by Brave's Copy controls. | Can still include captured Sources when the answer match is verified. |

---

## Print and PDF: choose a route

| Route | Use it when… | Steps | Settings that apply |
|---|---|---|---|
| **Exporter-generated PDF** | You want one of the exporter's two layouts. | Select **PDF**, choose **Reading** or **Print-friendly**, then choose **Save as PDF** in the browser preview. | The selected PDF profile applies. HTML print checkboxes do not. |
| **Print downloaded HTML** | You already have an `.html` export and want to print it or use its HTML-only controls. | Open the `.html` file and press **Ctrl+P** (or **Cmd+P** on macOS). | Saved **Include Sources** and **Include shopping results** settings apply only to this route; they do not change the screen view. |

### PDF profile comparison

| Profile | Best for | Sources and shopping | Page style |
|---|---|---|---|
| **Reading** | On-screen reading | Keeps available cited Sources and captured shopping results. | Screen-scale type, light reader-style surfaces, and the HTML font stack where available. |
| **Print-friendly** | Paper printing | Hides cited Sources and shopping results. | Smaller print-scale type, system fonts, and white fills. |

Both profiles open the sandboxed browser print preview. The PDF is paginated—not a screenshot of the HTML screen—with a printed Contents page in place of the sidebar. Downloaded HTML has its own embedded print stylesheet and requests 0.5in margins; the browser print dialog can override them.

### Print tips

- To request CSS accent backgrounds, enable **Background graphics** in the browser dialog where available. Browser settings can override CSS colors; Print-friendly intentionally uses white fills.
- Font availability and metrics vary by browser, so line wrapping can change. Reading uses the HTML font stack where available; Print-friendly PDF and downloaded HTML use system fonts to reduce PDF text-mapping issues.
- PDF text selection and appearance can vary with browser and print settings. If your PDF editor cannot select text, try opening the file in Firefox or Adobe Reader.

---

## How does it work?

To remain active when Brave navigates from search results into Ask within the same document, the userscript matches both Brave Search hosts. The Export button is therefore also visible on search pages.

### Passive capture and verification

Ask Brave fetches conversation data from `/api/tap/v1/stream` as newline-delimited JSON. The script wraps `window.fetch` at document-start and observes relevant `fetch` and `XMLHttpRequest` responses without disturbing the responses used by the page. Captured turns and citation URLs stay in page memory.

At export time, the script reads questions from the visible page and uses Brave's Copy controls to obtain the currently shown answers. It preserves raw question line breaks, tabs, and indentation; Brave's expand/collapse controls are removed structurally from a clone so user-authored words are not stripped. Normalized question text is used only for identity and matching. Captured answer text and Sources are used only when the visible answer clearly matches the corresponding captured turn. Ambiguous citations fail closed. Auto keeps unmatched visible text without unverified Sources; API only stops if any visible answer cannot be verified; Clipboard only uses the copied answer text, while Sources may still be included when their match is clear.

### Shopping results

The script passively observes matching shopping results returned by Brave and associates eligible products with their answer positions. Results render separately from formal Sources in Markdown, HTML, and Reading PDF. The three-column layout is not a three-product limit. The exporter applies its URL and nested-offer exclusions, does not visit or scrape retailer pages, and does not verify prices; prices are Brave-reported and may be cached.

### PDF preview

The exporter validates the sandboxed preview document before waiting for fonts and handing control to the browser print flow. Reading adds a restrained inset on the printed Contents page and keeps eligible compact heading/table groups together when they fit; long tables remain fragmentable with repeated headers. Print-friendly and downloaded-HTML print rules remain separate.

**Full technical details:** see [TECHNICAL.md](TECHNICAL.md).

---

## Known limitations

- **Current conversation only.** The script exports the conversation currently open in the browser.
- **Greasemonkey is unsupported.** Tampermonkey and Violentmonkey are intended targets; browser/manager/version combinations vary.
- **Browser print variation.** PDF rendering, text selection, and background colors can vary with browser and print-dialog settings; the browser may override CSS color requests.
- **Localized UI.** The Copy-button fallback covers the 49 display-language entries in the supplied Brave list. If a new label is missing, open an issue with the exact button text.
- **Standalone HTML is not sanitized.** Treat exported HTML as untrusted if conversation content is untrusted. The sandboxed PDF preview's CSP does not protect downloaded HTML.
- **Deep Research mode** exports the final answer and Sources, but not the specialized UI timeline.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for public release history:

- **v1.5.11** — preserves raw multiline question text; improves the PDF preview wait lifecycle and Reading layout while retaining long-table fragmentation and repeated headers.
- **v1.5.10** — Search-to-Ask continuity across standard and Safe Search, with a version bump so managers can offer the update.
- **v1.5.9** — visible-answer/Sources matching, combined export and PDF profiles, Safe Search, localized Copy labels, shopping results, and Markdown spacing.
- **v1.5.2** — per-answer Sources, capture-method and font controls, and print improvements.
- **v1.2 (2025-12)** — initial Markdown and HTML export.

---

## Roadmap

Status legend: ✅ **Done** · 🚧 **In progress** · 📋 **Planned** · ⏸️ **Deferred** · ❌ **Not feasible as originally scoped**

### Phase 1 — Core export ✅ *(shipped in v1.2)*

- Markdown + HTML export via Brave's Copy controls.
- Custom conversation titles.
- Styled HTML theme with dark mode and responsive layout.

### Phase 2

- ✅ **PDF export** — shipped in v1.5.2 and refined in v1.5.11. Print layouts hide sidebar/interactivity, repeat table headers, and keep eligible compact heading/table groups together when they fit.
- ✅ **Chat URL in exports** — included in v1.5.9; preserves the full current URL, including query parameters and fragment.
- 📋 **Editable HTML metadata** — planned; allow editing the title and Chat URL directly in the exported HTML.

### Phase 3

- ✅ **Sources section** — shipped in v1.5.2; every answer includes a numbered Sources list in Markdown and HTML.
- ✅ **Brave shopping results** — included in v1.5.9. Static result cards stay at answer positions in Markdown, HTML, and Reading PDF. Prices may be cached; retailers are not scraped or opened.
- ✅ **Configurable export options** — partially shipped. Current options include three capture methods, font-size sliders, and HTML print settings. Remaining: Resources toggle (`none` / `cited` / `all`), title length, and a consolidated options panel.
- 📋 **Session-scoped bulk export** — planned: export conversations whose state was captured during the current session.
- 📋 **Full sidebar bulk export** — planned; requires reverse-engineering the sidebar data source and signing chain.
- ⏸️ **Markdown-to-HTML converter** — deferred as a separate utility; it could include only information present in the supplied Markdown.

## Dependencies

- **Marked.js 15.0.12** — Markdown to HTML conversion.
- **Highlight.js 11.11.1** — syntax highlighting.
- **Inter** and **JetBrains Mono** — exported-page typography where available.

## Contributing

Bug reports, pull requests, and suggestions are welcome. When reporting a bug, include the browser and userscript-manager versions when known, and a concise redacted error if relevant. Share an Ask URL only when the conversation is safe to disclose; otherwise omit it. Do **not** post private prompts/answers, `window.__ABX`, tokens, cookies, request headers, session data, or private conversation URLs.

See [TECHNICAL.md](TECHNICAL.md) for architecture and privacy notes before proposing code changes.
