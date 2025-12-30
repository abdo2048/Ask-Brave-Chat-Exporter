// ==UserScript==
// @name         Brave Ask Exporter v1.0
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Export Brave Ask conversations to Markdown and/or HTML
// @author       You
// @match        https://search.brave.com/ask*
// @require      https://cdn.jsdelivr.net/npm/marked/marked.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    /* global marked */

    // =============================================
    // CONFIGURATION
    // =============================================
    const CONFIG = {
        COPY_DELAY: 200, // ms between copy operations
        MAX_TITLE_LENGTH: 40
    };

    // =============================================
    // MAIN EXPORT BUTTON
    // =============================================
    function createExportButton() {
        const btn = document.createElement('button');
        btn.innerHTML = '📥 Export';
        btn.id = 'brave-export-btn';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;

        btn.addEventListener('mouseover', function() {
            this.style.transform = 'translateY(-2px)';
        });

        btn.addEventListener('mouseout', function() {
            this.style.transform = 'translateY(0)';
        });

        btn.onclick = showExportDialog;
        document.body.appendChild(btn);
    }

    // =============================================
    // EXPORT DIALOG
    // =============================================
    function showExportDialog() {
        // Get default title from first user message
        const firstUserMsg = document.querySelector('.message.user .user-bubble');
        const defaultTitle = firstUserMsg ?
            truncateTitle(firstUserMsg.textContent.trim(), CONFIG.MAX_TITLE_LENGTH) :
            'Brave Ask Conversation';

        const dialog = document.createElement('div');
        dialog.id = 'brave-export-dialog';
        dialog.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 999998; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; border-radius: 12px; padding: 30px; max-width: 450px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                    <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #333;">Export Conversation</h2>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #555;">Title</label>
                        <input type="text" id="export-title-input" placeholder="${escapeHtml(defaultTitle)}"
                            style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                    </div>

                    <div style="margin-bottom: 25px;">
                        <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #555;">Export formats</label>
                        <div style="display: flex; gap: 20px;">
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="checkbox" id="export-markdown" checked style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 14px;">Markdown</span>
                            </label>
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="checkbox" id="export-html" checked style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;">
                                <span style="font-size: 14px;">HTML</span>
                            </label>
                        </div>
                        <div style="margin-top: 12px; font-size: 13px; color: #666;">
                            Need something? <a href="https://github.com/abdo2048/Ask-Brave-Chat-Exporter" target="_blank" style="color: #667eea; text-decoration: none; font-weight: 600;">Visit GitHub repo</a>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button id="export-cancel-btn" style="padding: 10px 24px; border: 2px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; color: #666;">
                            Cancel
                        </button>
                        <button id="export-download-btn" style="padding: 10px 24px; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">
                            Download
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Event listeners
        document.getElementById('export-cancel-btn').onclick = function() {
            dialog.remove();
        };

        document.getElementById('export-download-btn').onclick = function() {
            const titleInput = document.getElementById('export-title-input').value.trim();
            const title = titleInput || defaultTitle;
            const exportMd = document.getElementById('export-markdown').checked;
            const exportHtml = document.getElementById('export-html').checked;

            if (!exportMd && !exportHtml) {
                alert('Please select at least one export format.');
                return;
            }

            dialog.remove();
            startExport(title, exportMd, exportHtml);
        };

        // Focus title input
        document.getElementById('export-title-input').focus();
    }

    // =============================================
    // EXPORT PROCESS
    // =============================================
    async function startExport(title, exportMd, exportHtml) {
        showOverlay();

        try {
            updateOverlay('Copying user messages...');
            const userMessages = await copyUserMessages();
            console.log('User messages:', userMessages.length);

            updateOverlay('Copying AI answers...');
            const aiAnswers = await copyAIAnswers();
            console.log('AI answers:', aiAnswers.length);

            updateOverlay('Building conversation...');
            const conversation = buildConversation(userMessages, aiAnswers);

            if (exportMd) {
                updateOverlay('Generating Markdown...');
                const markdown = generateMarkdown(title, conversation);
                downloadFile(markdown, sanitizeFilename(title) + '.md', 'text/markdown');
            }

            if (exportHtml) {
                updateOverlay('Generating HTML...');
                const html = generateHTML(title, conversation);
                downloadFile(html, sanitizeFilename(title) + '.html', 'text/html');
            }

            updateOverlay('Export complete! ✓');
            await sleep(1000);
            hideOverlay();

        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Check console for details.');
            hideOverlay();
        }
    }

    // =============================================
    // COPY OPERATIONS
    // =============================================
    async function copyUserMessages() {
        const messages = [];
        const userMsgContainers = document.querySelectorAll('.message.user');

        for (let i = 0; i < userMsgContainers.length; i++) {
            const container = userMsgContainers[i];
            const copyBtn = container.querySelector('.user-message-actions button[aria-label="Copy"]');

            if (copyBtn) {
                copyBtn.click();
                await sleep(CONFIG.COPY_DELAY);
                const text = await navigator.clipboard.readText();
                messages.push(text.trim());
            }
        }

        return messages;
    }

    async function copyAIAnswers() {
        const answers = [];
        const answerContainers = document.querySelectorAll('.tap-round');

        console.log('Found AI answer containers:', answerContainers.length);

        for (let i = 0; i < answerContainers.length; i++) {
            const container = answerContainers[i];
            const copyBtn = container.querySelector('.tap-round-footer-actions button.tap-round-footer-action[aria-label="Copy"]');

            if (copyBtn) {
                console.log('Clicking answer copy button', i + 1);
                copyBtn.click();
                await sleep(CONFIG.COPY_DELAY);
                const text = await navigator.clipboard.readText();
                answers.push(text.trim());
            } else {
                console.warn('No copy button found in answer container', i + 1);
            }
        }

        console.log('Total answers copied:', answers.length);
        return answers;
    }

    // =============================================
    // BUILD CONVERSATION
    // =============================================
    function buildConversation(userMessages, aiAnswers) {
        const conversation = [];

        for (let i = 0; i < Math.max(userMessages.length, aiAnswers.length); i++) {
            if (userMessages[i]) {
                conversation.push({
                    type: 'user',
                    content: userMessages[i],
                    index: i + 1
                });
            }
            if (aiAnswers[i]) {
                conversation.push({
                    type: 'assistant',
                    content: aiAnswers[i],
                    index: i + 1
                });
            }
        }

        return conversation;
    }

    // =============================================
    // MARKDOWN GENERATION
    // =============================================
    function generateMarkdown(title, conversation) {
        const now = new Date();
        const dateStr = formatDate(now);

        let md = '';

        // Header
        md += '---\n';
        md += '**Title:** ' + title + '\n';
        md += '**Exported:** ' + dateStr + '\n';
        md += '\n---\n';

        // Questions and Answers
        let currentQ = 0;

        for (let idx = 0; idx < conversation.length; idx++) {
            const msg = conversation[idx];

            if (msg.type === 'user') {
                currentQ++;

                // Top divider
                md += '◤━━━━━━ Q' + currentQ + ' ━━━━━◥\n';

                // User question (raw, no formatting)
                md += msg.content + '\n';

                // Bottom divider
                md += '◣━━━━━━ Q' + currentQ + ' ━━━━━◢\n\n';

            } else {
                // AI answer
                md += msg.content + '\n\n';

                // Add horizontal line separator after each Q&A pair (except the last one)
                if (idx < conversation.length - 1) {
                    md += '---\n\n';
                }
            }
        }

        return md;
    }

    // =============================================
    // HTML GENERATION
    // =============================================
    function generateHTML(title, conversation) {
        const now = new Date();
        const dateStr = formatDate(now);

        // Check if marked is available
        if (typeof marked === 'undefined') {
            console.error('marked.js library not loaded!');
            alert('HTML export failed: marked.js library not loaded.');
            return '';
        }

        // Configure marked to add IDs to headings
        const renderer = {
        heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');
        return `<h${depth} id="${escapedText}">${text}</h${depth}>`;
    }
};

marked.use({ renderer });


        // Convert markdown to HTML using marked.js
        let contentHTML = '';
        let currentQ = 0;

        for (let i = 0; i < conversation.length; i++) {
            const msg = conversation[i];

            if (msg.type === 'user') {
                currentQ++;

                if (currentQ > 1) {
                    contentHTML += '<div class="separator">───────</div>\n';
                }

                contentHTML += '<div id="Q' + currentQ + '" class="question">\n';
                contentHTML += '<blockquote><strong>Q' + currentQ + ':</strong><br>\n';
                contentHTML += '<pre class="question-text">' + escapeHtml(msg.content) + '</pre>\n';
                contentHTML += '</blockquote>\n';
                contentHTML += '</div>\n';

            } else {
                contentHTML += '<div class="answer">\n';
                // eslint-disable-next-line no-undef
                contentHTML += marked.parse(msg.content);
                contentHTML += '</div>\n';
            }
        }

        // Generate TOC HTML
        const tocHTML = generateTOCHTML(conversation);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <link rel="preconnect" href="https://rsms.me/">
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css">
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5/index.css">
    <style>
/* --- EPIC THEME SYSTEM (WCAG AA+, Dark Mode, Fluid Scaling) --- */
:root {
  /* Colors - Light Mode (Default) */
  --bg-body: #f8fafc;       /* Slate-50 */
  --bg-surface: #ffffff;    /* White */
  --bg-sidebar: #ffffff;

  /* Blockquote Colors */
  --bg-blockquote-q: #f1f5f9;  /* Slate-100 (Questions) */
  --bg-blockquote-note: #f8fafc; /* Lighter for Notes */
  --border-note: #cbd5e1;      /* Slate-300 */

  /* Code Colors */
  --bg-code-block: #1e293b;    /* Slate-800 (Dark block in light mode) */
  --bg-code-inline: #e2e8f0;   /* Slate-200 (Distinct from white surface) */
  --text-code-block: #e2e8f0;
  --text-code-inline: #0f172a; /* Slate-900 (High contrast on Slate-200) */

  --text-primary: #0f172a;  /* Slate-900 */
  --text-secondary: #475569; /* Slate-600 */

  --primary: #4f46e5;       /* Indigo-600 */
  --primary-hover: #4338ca; /* Indigo-700 */
  --accent: #0ea5e9;        /* Sky-500 */

  --border-color: #e2e8f0;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-float: 0 10px 15px -3px rgba(0,0,0,0.1);

  /* Typography (Fluid Scaling - Reduced Headers by ~9%) */
  --font-base: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Base text: 16px -> 18px */
  --text-scale-base: clamp(1rem, 1vw + 0.8rem, 1.125rem); 

  /* H1: Was clamp(2rem, 4vw+1rem, 3rem) -> Reduced ~10% */
  --text-scale-h1: clamp(1.8rem, 3.5vw + 0.9rem, 2.7rem);

  /* H2: Was clamp(1.5rem, 3vw+1rem, 2.25rem) -> Reduced ~10% */
  --text-scale-h2: clamp(1.35rem, 2.7vw + 0.9rem, 2rem);

  /* H3: Was clamp(1.25rem, 2vw+1rem, 1.75rem) -> Reduced ~10% */
  --text-scale-h3: clamp(1.1rem, 1.8vw + 0.9rem, 1.55rem);

  /* Layout */
  --sidebar-width: 300px;
  --container-max: 1000px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* --- DARK MODE PREFERENCE --- */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-body: #0f172a;     /* Slate-900 */
    --bg-surface: #1e293b;  /* Slate-800 */
    --bg-sidebar: #1e293b;

    /* Dark Mode Inline Code */
    --bg-code-inline: #334155;  /* Slate-700 */
    --text-code-inline: #e2e8f0; /* Light text for contrast */

    /* Code Blocks - Sunken */
    --bg-code-block: #0B111F;   /* Matching the requested dark tone */
    --text-code-block: #f8fafc;

    /* Blockquotes */
    --bg-blockquote-q: #334155;    /* Slate-700 */
    --bg-blockquote-note: #334155; /* Slate-700 */
    --border-note: #475569;        /* Slate-600 */

    --text-primary: #f1f5f9;  /* Slate-50 */
    --text-secondary: #cbd5e1; /* Slate-300 */

    --primary: #818cf8;     /* Indigo-400 */
    --primary-hover: #6366f1;
    --border-color: #334155;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.5);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.5);
  }
}

/* --- RESET & BASE --- */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
}

body {
  font-family: var(--font-base);
  background-color: var(--bg-body);
  color: var(--text-primary);
  line-height: 1.7;
  font-size: var(--text-scale-base);
  overflow-x: hidden;
}

/* --- ACCESSIBILITY UTILS --- */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  html, body, * {
    scroll-behavior: auto !important;
    transition: none !important;
    animation: none !important;
  }
}

/* --- GRID LAYOUT --- */
.container {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  min-height: 100vh;
  transition: grid-template-columns var(--transition);
}

/* --- SIDEBAR --- */
.toc-sidebar {
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  height: 100vh;
  position: sticky;
  top: 0;
  padding: 2rem;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--text-secondary) transparent;
}

.toc-sidebar h2 {
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
  color: var(--primary);
  letter-spacing: -0.02em;
}

.toc-sidebar ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toc-sidebar a {
  display: block;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 0.95rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  transition: all var(--transition);
  border-left: 3px solid transparent;
}

.toc-sidebar a:hover {
  background: var(--bg-body);
  color: var(--primary);
  transform: translateX(4px);
}

.toc-sidebar a.active {
  background: var(--bg-blockquote-q);
  color: var(--primary);
  border-left-color: var(--primary);
  font-weight: 600;
}

.toc-q { font-weight: 700; margin-top: 1rem; }
.toc-h2 { padding-left: 1rem; font-size: 0.9rem; }

/* --- MAIN CONTENT --- */
.main-content {
  padding: 3rem 4rem;
  width: 100%;
  max-width: var(--container-max);
  margin: 0 auto;
}

.header {
  background: var(--bg-surface);
  padding: 3rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  margin-bottom: 2rem;
  border: 1px solid var(--border-color);
  text-align: center;
}

.header h1 {
  font-size: var(--text-scale-h1);
  line-height: 1.2;
  margin-bottom: 1rem;
  color: var(--primary);
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.header .meta {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-family: var(--font-mono);
  opacity: 0.8;
}

.content {
  background: var(--bg-surface);
  padding: 4rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-color);
}

/* --- TYPOGRAPHY & ELEMENTS --- */
h2 {
  font-size: var(--text-scale-h2);
  margin: 2.5rem 0 1.5rem;
  color: var(--text-primary);
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-color);
}

h3 {
  font-size: var(--text-scale-h3);
  margin: 2rem 0 1rem;
  color: var(--text-secondary);
}

p { margin-bottom: 1.5rem; }

/* --- CODE BLOCKS & INLINE CODE --- */
/* Wrapper for Pre blocks */
.code-wrapper {
  position: relative;
  margin: 2rem 0;
}

pre {
  background: var(--bg-code-block);
  color: var(--text-code-block);
  padding: 1.5rem;
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.9rem;
}

pre code {
  background: none;
  padding: 0;
  font-family: inherit;
}

/* Inline Code Styling (NOT inside pre) */
:not(pre) > code {
  background-color: var(--bg-code-inline);
  color: var(--text-code-inline);
  padding: 0.2em 0.4em;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 0.85em; /* Slightly smaller for better flow */
  border: 1px solid transparent; /* Keeps sizing consistent */
}

/* Dark mode border for inline code to make it pop slightly */
@media (prefers-color-scheme: dark) {
  :not(pre) > code {
    border-color: rgba(255,255,255,0.1);
  }
}

.copy-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: var(--text-code-block);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: var(--transition);
  opacity: 0;
}

.code-wrapper:hover .copy-btn,
.question:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

/* --- BLOCKQUOTES & QUESTIONS --- */

/* 1. Generic Blockquote (Notes, Warnings) */
blockquote {
  background: var(--bg-blockquote-note);
  border-left: 4px solid var(--border-note);
  padding: 1rem 1.5rem;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  margin: 1.5rem 0;
  font-style: italic;
  color: var(--text-secondary);
}

/* 2. Question Blockquote Override */
.question {
  position: relative;
  margin: 3rem 0 1.5rem;
}

.question blockquote {
  background: var(--bg-blockquote-q);
  border-left: 6px solid var(--primary);
  padding: 1.25rem 2rem; /* Reduced padding slightly */
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  font-style: normal; /* Reset italic */
  color: var(--text-primary);
}

.question strong {
  display: block;
  color: var(--primary);
  font-size: 1.1rem;
  margin-bottom: 0.25rem; /* Reduced gap between Qn and Text */
  line-height: 1.2;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.question .copy-btn {
  top: 1rem;
  right: 1rem;
  background: var(--bg-surface);
  color: var(--text-secondary);
  border-color: var(--border-color);
}

/* Reset <pre> inside question */
.question pre.question-text {
  font-family: var(--font-base);
  white-space: pre-wrap;
  font-size: var(--text-scale-h3);
  font-weight: 700;
  color: var(--text-primary);
  background: none;
  padding: 0;
  border: none;
  margin: 0;
  border-radius: 0;
}

.separator { display: none; }

/* --- MOBILE RESPONSIVENESS --- */
@media (max-width: 1024px) {
  .container { grid-template-columns: 1fr; }
  .toc-sidebar {
    position: fixed;
    top: 0; left: 0;
    width: 280px; z-index: 1000;
    transform: translateX(-100%);
    transition: transform var(--transition);
    box-shadow: var(--shadow-float);
  }
  .toc-sidebar.open { transform: translateX(0); }
  .main-content { padding: 1.5rem; }
  .header, .content { padding: 1.5rem; }

  .mobile-menu-btn {
    display: flex !important;
    position: fixed;
    bottom: 20px; right: 20px;
    background: var(--primary);
    color: white;
    width: 50px; height: 50px;
    border-radius: 50%;
    align-items: center; justify-content: center;
    box-shadow: var(--shadow-float);
    z-index: 1100;
    cursor: pointer;
    border: none;
    font-size: 1.5rem;
  }

  .overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999;
    opacity: 0; pointer-events: none;
    transition: opacity var(--transition);
  }
  .overlay.active { opacity: 1; pointer-events: auto; }
}

.mobile-menu-btn { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="toc-sidebar">
            <h2>📑 Contents</h2>
            ${tocHTML}
        </div>
        <div class="main-content">
            <div class="header">
                <h1>${escapeHtml(title)}</h1>
                <div class="meta">Exported: ${dateStr}</div>
            </div>
            <div class="content">
                ${contentHTML}
            </div>
        </div>
    </div>

    <script>

document.addEventListener('DOMContentLoaded', () => {
    // 1. INJECT MOBILE MENU ELEMENTS
    const body = document.body;

    // Create Menu Button
    const btn = document.createElement('button');
    btn.className = 'mobile-menu-btn';
    btn.innerHTML = '☰';
    btn.ariaLabel = 'Toggle Table of Contents';

    // Create Overlay
    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    body.appendChild(btn);
    body.appendChild(overlay);

    // Mobile Toggle Logic
    const sidebar = document.querySelector('.toc-sidebar');

    function toggleMenu() {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
        btn.innerHTML = sidebar.classList.contains('open') ? '✕' : '☰';
    }

    btn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);

    // Close menu when clicking a link
    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 1024) toggleMenu();
        });
    });

    // 2. ACTIVE TOC SPY (Intersection Observer)
    const tocLinks = document.querySelectorAll('.toc-sidebar a');
    const sections = Array.from(tocLinks).map(link => {
        const id = link.getAttribute('href').replace('#', '');
        return document.getElementById(id);
    }).filter(el => el); // Filter out nulls

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove active class from all
                tocLinks.forEach(link => link.classList.remove('active'));

                // Add active class to corresponding link
                const activeLink = document.querySelector('.toc-sidebar a[href="#' + entry.target.id + '"]');
                if (activeLink) {
                    activeLink.classList.add('active');
                    // Smooth scroll sidebar to keep active link in view
                    activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        });
    }, { rootMargin: '-20% 0px -70% 0px' }); // Trigger when section is near top

    sections.forEach(section => observer.observe(section));

    // 3. COPY BUTTON LOGIC
    // Wrap code blocks
    document.querySelectorAll('pre').forEach(pre => {
        // Skip if it's the question text
        if (pre.classList.contains('question-text')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'code-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        addCopyButton(wrapper, pre.innerText);
    });

    // Add copy button to Questions
    document.querySelectorAll('.question').forEach(q => {
        const text = q.querySelector('.question-text')?.innerText || q.innerText;
        addCopyButton(q, text);
    });

    function addCopyButton(parent, textToCopy) {
        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.innerText = 'Copy';

        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(textToCopy).then(() => {
                btn.innerText = 'Copied!';
                setTimeout(() => btn.innerText = 'Copy', 2000);
            });
        });

        parent.appendChild(btn);
    }
});

    </script>
</body>
</html>`;
    }

    function generateTOCHTML(conversation) {
        let html = '<ul>\n';
        let currentQ = 0;

        const userMsgs = conversation.filter(function(msg) {
            return msg.type === 'user';
        });

        for (let i = 0; i < userMsgs.length; i++) {
            const msg = userMsgs[i];
            currentQ++;

            const truncated = truncateTitle(msg.content, 60);
            html += '<li><a href="#Q' + currentQ + '" class="toc-q">Q' + currentQ + ': ' + escapeHtml(truncated) + '</a></li>\n';

            // Find H2 headers in next answer
            const nextAnswerIdx = conversation.findIndex(function(m, idx) {
                return idx > conversation.indexOf(msg) && m.type === 'assistant';
            });

            if (nextAnswerIdx !== -1) {
                const nextAnswer = conversation[nextAnswerIdx];
                const headers = extractH2Headers(nextAnswer.content);

                for (let j = 0; j < headers.length; j++) {
                    const headerId = slugify(headers[j]);
                    html += '<li><a href="#' + headerId + '" class="toc-h2">' + escapeHtml(headers[j]) + '</a></li>\n';
                }
            }
        }

        html += '</ul>';
        return html;
    }

function extractH2Headers(markdown) {
    const headers = [];
    const lines = markdown.split('\n');
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Toggle code block state when encountering triple backticks
        if (trimmedLine.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }

        // Skip if we're inside a code block
        if (inCodeBlock) {
            continue;
        }

        // Skip if line is a blockquote (starts with >)
        if (trimmedLine.startsWith('>')) {
            continue;
        }

        // Extract H2 headers (must start with exactly "## ")
        if (trimmedLine.startsWith('## ')) {
            const headerText = trimmedLine.replace('## ', '').trim();
            headers.push(headerText);
        }
    }

    return headers;
}


    function slugify(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // =============================================
    // OVERLAY
    // =============================================
    function showOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'brave-export-overlay';
        overlay.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); z-index: 999999; display: flex; align-items: center; justify-content: center;">
                <div style="text-align: center; color: white;">
                    <div style="font-size: 60px; margin-bottom: 20px;">⏳</div>
                    <div id="overlay-message" style="font-size: 24px; font-weight: 600;">Processing...</div>
                    <div style="font-size: 14px; margin-top: 12px; opacity: 0.7;">Please do not interact with the page</div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    function updateOverlay(message) {
        const msgEl = document.getElementById('overlay-message');
        if (msgEl) {
            msgEl.textContent = message;
        }
    }

    function hideOverlay() {
        const overlay = document.getElementById('brave-export-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // =============================================
    // UTILITIES
    // =============================================
    function sleep(ms) {
        return new Promise(function(resolve) {
            setTimeout(resolve, ms);
        });
    }

    function truncateTitle(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength).trim() + '...';
    }

    function sanitizeFilename(filename) {
        return filename.replace(/[?<>:*|"]/g, '').substring(0, 200);
    }

    function formatDate(date) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

        const dayName = days[date.getDay()];
        const day = String(date.getDate()).padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;

        return dayName + ' ' + day + '-' + month + '-' + year + ' , ' + String(hours).padStart(2, '0') + ':' + minutes + ' ' + ampm;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // =============================================
    // INITIALIZE
    // =============================================
    function init() {
        // Wait for page to fully load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createExportButton);
        } else {
            createExportButton();
        }
    }

    init();

})();
