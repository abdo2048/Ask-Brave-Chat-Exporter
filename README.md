<h1 align="center">
  <br>
  <img width="430" height="215" alt="Ask Brave Chat Exporter main page" src="https://github.com/user-attachments/assets/e097cac0-8ac3-4c69-a400-dfc0c8f94bec" />
  <br>
  Ask Brave Chat Exporter
  <br>
</h1>

<h4 align="center">A browser userscript that exports Ask Brave AI conversations to Markdown and HTML formats with professional styling and enhanced features.<br>
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

### Core Functionality
- **Dual Format Export**: Export conversations to both Markdown (.md) and HTML (.html) formats.
- **Custom Titles**: Edit your conversation title before export.
- **Smart Formatting**: Preserves questions, answers, code blocks, and formatting.

### Markdown Export
- Emoji dividers for visual question separation (`◤━━━━━━ Q# ━━━━━◥`)
- Horizontal rules between Q&A pairs.
- Metadata header with title and export date.

### HTML Export
- **Professional Theme System**
  - WCAG AA+ accessibility compliant.
  - Automatic dark mode support (respects system preference).
  - Fluid responsive typography.
  - Modern color palette (Slate + Indigo).

- **Interactive Features**
  - Sticky sidebar table of contents with active section highlighting.
  - Mobile-responsive hamburger menu.
  - Copy buttons for all code blocks, tables and questions.
  - Smooth scroll navigation.

- **Typography**
  - Inter font for body text and UI.
  - JetBrains Mono for code blocks.
  - Optimized font sizes and spacing.

### How does it work?
- The script clicks copy buttons in chat for user prompts and AI answers, then collect them into one Markdown file with some custom formatting, then uses [Marked](https://github.com/markedjs/marked) library to convert Markdown to HTML, then formatting the HTML with custom theme. More info in [Technical Details About How Does Script Work and Ask Brave Behavior](https://github.com/abdo2048/Ask-Brave-Chat-Exporter#technical-details-about-how-does-script-work-and-ask-brave-behavior)

## Installation

### Requirements
We need **Tampermonkey.**
What is it? `it's a browser extension that lets you run userscripts, which are small programs that can customize websites by adding features or modifying existing ones.`

### Steps

1. **Install Tampermonkey**
   - [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. **Install Script**
- **_Method 1 (Greasyfork):_** Go to https://greasyfork.org/en/scripts/561042-ask-brave-chat-exporter and click the green button `Install this script`.
- **_Method 2 (GitHub):_**
   - Go to latest release of script [latest release of script]([https://github.com/abdo2048/Ask-Brave-Chat-Exporter/releases/tag/v1.2](https://github.com/abdo2048/Ask-Brave-Chat-Exporter/releases/latest))
   - Under **Assets**, rgiht click to copy link of script  `Ask.Brave.Chat.Exporter.x.js`
   - Open Tampermonkey and paste script link in "Import from URL" field in Utilities tab as [shown here in this guide](https://gist.github.com/jesterjunk/0344f1a7c1f67f52ffc716b17ee7f240)

3. **Navigate to Brave Ask**
   - Visit [search.brave.com/ask](https://search.brave.com/ask)
   - The export button will appear at the bottom-right corner.

## Usage

### Basic Export

1. Open any Brave Ask conversation (or start a new one)
2. Click the **Export** button (bottom-right corner)
3. Edit the title (optional)
4. Select export format(s):
   - Markdown
   - HTML
   - Both (default)
5. Click **Download**

### Export Formats

#### Markdown (.md)
```markdown
---
**Title:** Your Conversation Title
**Exported:** Monday 30-12-2025 , 01:55 PM

---
◤━━━━━━ Q1 ━━━━━◥
What are the most known coffee types?
◣━━━━━━ Q1 ━━━━━◢

The most known coffee types...

---
```

#### HTML (.html)
- Standalone file with embedded CSS and JavaScript
- Mobile-friendly and print-optimized
- Dark mode automatically activates based on system preference

## 🛑 Notes
- If you found something off, please open an issue. 
- When reporting bugs, please include:
  - Browser name.
  - Example conversation share URL (if possible).
  - Console error messages if applicable (F12 → Console).

## Roadmap
**⚠️ The script now is in Phase 1, and I'm not sure if I'm going to add more features or make it better, but here's what I think the script will look like:**

### Phase 2
- **Share URL Integration**: Include Brave Ask conversation share URL in exports by scraping or user input them manually in export menu.
- **Editable HTML Metadata**: Allow editing title and URL directly in exported HTML files.
- **PDF Export**: Optimized print-friendly PDF generation (sidebar removed, clean layout).

### Phase 3
- **Resources Section**: Append source (web results, videos, news, citations) at end of exported files.
- **Bulk Export**: Export multiple conversations in one operation.
- **Configurable Export Options**: Toggle what to include (TOC, metadata, resources, etc.)
- **Standalone Converter**: Pre-built binary to convert any chat Markdown to HTML using this theme:
  - Works with any markdown file (not just Brave exports).
  - Offline operation, no dependencies.
  - Apply custom styling to existing markdown files.

## Contributing, Suggestions or want to say hello

Feel free to submit issues or pull requests.

## Technical Details About How Does Script Work and Ask Brave Behavior (still working on this section)

### Dependencies
- **marked.js**: Markdown to HTML conversion
- **Inter font**: UI typography
- **JetBrains Mono**: Code block typography
