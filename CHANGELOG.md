# Changelog

Public release history.

## v1.5.11

- **Preserve raw question text.** Keep meaningful newlines, tabs, and indentation in exported questions. Remove Brave's expand/collapse controls structurally from a clone so user-written phrases such as “Show more” are retained.
- **PDF preview reliability.** Clear the preview load timer after the preview document is validated and before font readiness / browser printing, avoiding a stale load-timeout warning during a long print-dialog wait.
- **Reading PDF table pagination.** Keep compact heading/table groups with 1–8 body rows together when they fit; larger and oversized tables remain fragmentable with repeated headers.
- **Reading Contents inset.** Add a restrained top/side gutter to the printed Contents title and question rows. Print-friendly and downloaded-HTML print styles remain unchanged.
- **Update delivery.** Bump the script version so userscript managers can offer v1.5.11 to existing installs.

## v1.5.10

- **Search-to-Ask continuity.** Matches all paths on standard Brave Search and Safe Search so the userscript starts before in-page navigation from results into Ask. The Export button may appear on search-result pages before Ask opens; this is intentional.
- **Update delivery.** Bumps the script version so userscript managers can offer this fix to existing installs.

## v1.5.9

- **More reliable answer and source matching.** Exports the answer currently shown, including after regeneration; cited Sources are included only when the match is clear.
- **Flexible exports and PDF profiles.** Select Markdown, HTML, and/or PDF together. Reading and Print-friendly profiles have distinct print layouts, and PDF output includes a clickable Contents page.
- **Brave shopping results.** Eligible results are placed with their associated answers in Markdown, HTML, and Reading PDF. The three-column layout is not a product-count limit. Results remain separate from formal Sources; retailer pages are not scraped, and prices may be cached.
- **Cleaner Markdown.** Shopping tables are followed by one blank line before the next heading or sentence.
- **Safer, broader compatibility.** Adds Safe Search, recognizes the supplied Copy-button labels across 49 display-language entries, and pins Marked to 15.0.12.
- **Interface and print refinements.** Includes saved theme and type controls, improved table and Contents handling, and clearer export-method guidance.

## v1.5.2

- Added per-answer Sources to Markdown and HTML exports.
- Added Auto / API / Clipboard capture choices, persistent font-size controls, and a Sources-in-print setting.
- Added table copy actions and improved print pagination, table layout, and Firefox clipboard capture.
- Improved Brave stream parsing and rendering of entity text and callout questions.

## v1.2 (2025-12)

- Initial release: Markdown and HTML export using Brave's Copy controls.
