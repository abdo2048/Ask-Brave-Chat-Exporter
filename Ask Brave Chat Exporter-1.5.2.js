// ==UserScript==
// @name         Ask Brave Chat Exporter
// @namespace    http://tampermonkey.net/
// @version      1.5.2
// @description  Export Ask Brave conversations to Markdown / styled HTML / PDF (API + clipboard-write capture; font-size settings; print-optimised)
// @author       abdo2048
// @match        https://search.brave.com/ask*
// @require      https://cdn.jsdelivr.net/npm/marked/marked.min.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
'use strict';

/* global marked */

/* =========================================================================
 * CONFIG
 * ========================================================================= */
const CONFIG = {
    COPY_DELAY: 200,
    MAX_TITLE_LENGTH: 40,
    EXPORT_MODE: 'auto',
    INCLUDE_RESOURCES: 'cited',
    FONT_KEY: 'abx_font_settings_v1',
    SOURCES_IN_PRINT_KEY: 'abx_sources_in_print_v1'
};

const DEFAULT_FONT_SETTINGS = {
    base: 16,
    questionScale: 1.0,
    answerScale: 1.0,
    headingScale: 1.0
};

/* Only stores fields the user has actually overridden. Empty object
   means "use the built-in responsive clamp() defaults". */
function loadFontSettings() {
    try {
        const raw = localStorage.getItem(CONFIG.FONT_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
}
function saveFontSettings(s) {
    try { localStorage.setItem(CONFIG.FONT_KEY, JSON.stringify(s)); } catch (e) {}
}
/* For dialog sliders: concrete values with defaults filled in. */
function getDisplayFontSettings() {
    const s = loadFontSettings();
    return {
        base:          s.base          != null ? s.base          : DEFAULT_FONT_SETTINGS.base,
        questionScale: s.questionScale != null ? s.questionScale : DEFAULT_FONT_SETTINGS.questionScale,
        answerScale:   s.answerScale   != null ? s.answerScale   : DEFAULT_FONT_SETTINGS.answerScale,
        headingScale:  s.headingScale  != null ? s.headingScale  : DEFAULT_FONT_SETTINGS.headingScale
    };
}
    function loadSourcesInPrint() {
    try {
        const raw = localStorage.getItem(CONFIG.SOURCES_IN_PRINT_KEY);
        return raw === null ? true : raw === '1'; // default: checked
    } catch (e) { return true; }
}
function saveSourcesInPrint(v) {
    try { localStorage.setItem(CONFIG.SOURCES_IN_PRINT_KEY, v ? '1' : '0'); } catch (e) {}
}

/* =========================================================================
 * API STATE CAPTURE
 * ========================================================================= */
const __ABX = window.__braveExporterData || (window.__braveExporterData = {
    convs: {},
    lastSeenAt: null,
    chunks: 0
});
window.__ABX = __ABX;

const __ABX_CLIP = window.__ABX_clipboardCapture = { text: null, at: 0 };

/* --- Clipboard WRITE tap (Firefox has no user activation for readText) --- */
(function patchClipboardWriters() {
    try {
        const clip = navigator.clipboard;
        if (clip) {
            const ow = clip.writeText;
            if (typeof ow === 'function') {
                clip.writeText = function (text) {
                    try { __ABX_CLIP.text = String(text); __ABX_CLIP.at = Date.now(); } catch (e) {}
                    const p = ow.apply(this, arguments);
                    return (p && typeof p.catch === 'function') ? p.catch(() => {}) : p;
                };
            }
            const owr = clip.write;
            if (typeof owr === 'function') {
                clip.write = function (items) {
                    try {
                        const item = items && items[0];
                        if (item && item.types && item.types.indexOf('text/plain') !== -1) {
                            item.getType('text/plain').then(b => b.text()).then(t => {
                                __ABX_CLIP.text = String(t);
                                __ABX_CLIP.at = Date.now();
                            }).catch(() => {});
                        }
                    } catch (e) {}
                    const p = owr.apply(this, arguments);
                    return (p && typeof p.catch === 'function') ? p.catch(() => {}) : p;
                };
            }
        }
    } catch (e) {}
    try {
        const oe = document.execCommand;
        if (typeof oe === 'function') {
            document.execCommand = function (cmd) {
                if (cmd === 'copy') {
                    try {
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) {
                            const t = sel.toString();
                            if (t) { __ABX_CLIP.text = t; __ABX_CLIP.at = Date.now(); }
                        }
                    } catch (e) {}
                }
                return oe.apply(this, arguments);
            };
        }
    } catch (e) {}
})();

/* --- Conversation / turn store --- */
function abxConv(id) {
    if (!id) id = '__unknown__';
    if (!__ABX.convs[id]) __ABX.convs[id] = { turns: [], updatedAt: 0 };
    return __ABX.convs[id];
}
function abxTurn(conv, index) {
    if (index == null) index = 0;
    let t = conv.turns.find(x => x.index === index);
    if (!t) {
        t = {
            index,
            question: null,
            answerMd: '',
            citationsById: {},
            augmentations: [],
            ragUrls: [],
            ragQueries: [],
            followups: [],
            usage: null,
            sawText: false
        };
        conv.turns.push(t);
        conv.turns.sort((a, b) => a.index - b.index);
    }
    return t;
}

/* --- Event reducer (real Brave stream types) --- */
function abxHandleEvent(evt, ctx) {

    if (!evt || typeof evt !== 'object' || !evt.type) return;

    // IMPORTANT: Brave emits `inline_entity` and some `augment_with_*` events
    // with their OWN `conversation` field that points to a per-turn
    // sub-conversation — different from the URL's root conversation id.
    // Trusting `evt.conversation` splits a single turn across two buckets
    // and loses entity text (e.g. table cells for browser names go missing).
    // We therefore ALWAYS key by ctx (derived from the stream URL).
    const convId = (ctx && ctx.convId) || '__unknown__';
    const turnIndex = (ctx && typeof ctx.index === 'number') ? ctx.index : 0;
    const conv = abxConv(convId);
    const turn = abxTurn(conv, turnIndex);
    conv.updatedAt = Date.now();
    __ABX.lastSeenAt = Date.now();

    switch (evt.type) {
        case 'user':
            if (typeof evt.query === 'string') turn.question = evt.query;
            break;

        case 'text_delta':
            if (typeof evt.delta === 'string') {
                turn.answerMd += evt.delta;
                turn.sawText = true;
            }
            break;

        case 'text_stop':
            if (!turn.sawText && typeof evt.text === 'string') {
                turn.answerMd += evt.text;
            }
            break;

        case 'augment_with_inline_citation': {
            const url = evt.url || '';
            if (!url) break;
            if (!turn.citationsById[url]) {
                turn.citationsById[url] = {
                    url,
                    title: evt.title || '',
                    snippet: evt.snippet || '',
                    favicon: evt.favicon || ''
                };
            }
            break;
        }

        case 'augment_with_news':
        case 'augment_with_discussions':
        case 'augment_with_videos':
        case 'augment_with_web':
        case 'augment_with_images':
        case 'augment_with_shopping':
        case 'augment_with_places':
        case 'augment_with_products':
        case 'tool_use': {
            let name = evt.type;
            let q = evt.query || '';
            const tu = evt.tool_use || {};
            if (tu.name) name = tu.name;
            if (!q && tu.arguments && tu.arguments.q) q = tu.arguments.q;
            if (!q && Array.isArray(tu.arguments && tu.arguments.queries) && tu.arguments.queries.length) {
                q = tu.arguments.queries[0];
            }
            turn.augmentations.push({ type: name, query: q });
            break;
        }

        case 'rag':
            if (Array.isArray(evt.urls)) {
                evt.urls.forEach(u => {
                    if (u && turn.ragUrls.indexOf(u) === -1) turn.ragUrls.push(u);
                });
            }
            if (Array.isArray(evt.queries)) {
                evt.queries.forEach(q => {
                    if (q && turn.ragQueries.indexOf(q) === -1) turn.ragQueries.push(q);
                });
            }
            break;

        case 'followups':
            if (Array.isArray(evt.followups)) {
                turn.followups = evt.followups.slice();
            }
            break;

        case 'usage':
            turn.usage = {
                prompt_tokens: evt.prompt_tokens,
                completion_tokens: evt.completion_tokens,
                reasoning_tokens: evt.reasoning_tokens
            };
            break;

        /* Entity chips ("Google Chrome", "Signal", …) are emitted as their own
           event — NOT inside text_delta. Brave's own Copy button pulls them
           from the rendered DOM, so we must inject them here or headings and
           table cells lose their labels entirely. */
        case 'inline_entity':
            if (typeof evt.name === 'string') {
                turn.answerMd += evt.name;
                turn.sawText = true;
            }
            break;

        /* Explicitly ignored: text_start, thinking_summary, reasoning_progress,
           debug_labels, search, videos (media payloads come via run_tool). */
        default:
            break;
    }
}

/* --- get_current_state parser --- */
function abxHandleState(url, data) {
    __ABX.chunks++;
    const m = (url || '').match(/[?&]id=([a-f0-9]+)/i);
    const convId = m ? m[1] : '__unknown__';

    let eventLog = null;
    if (Array.isArray(data)) {
        if (Array.isArray(data[1])) eventLog = data[1];
        else if (Array.isArray(data[0])) eventLog = data[0];
    }
    if (!eventLog) {
        const found = [];
        const walk = (o, d) => {
            if (!o || typeof o !== 'object' || d > 6) return;
            if (Array.isArray(o)) { o.forEach(x => walk(x, d + 1)); return; }
            if (typeof o.type === 'string') { found.push(o); return; }
            Object.keys(o).forEach(k => walk(o[k], d + 1));
        };
        walk(data, 0);
        eventLog = found;
    }
    let idx = 0;
    eventLog.forEach(evt => {
        if (!evt || typeof evt !== 'object') return;
        if (evt.type === 'user') idx++;
        abxHandleEvent(evt, { convId, index: Math.max(0, idx - 1) });
    });
}

/* --- fetch wrapper --- */
const origFetch = window.fetch.bind(window);
window.fetch = function (input, init) {
    const url = (typeof input === 'string') ? input : (input && input.url) || '';
    const isStream = url.indexOf('/api/tap/v1/stream') !== -1;
    const isState  = url.indexOf('/api/tap/v1/get_current_state') !== -1;

    if (!isStream && !isState) {
        return arguments.length >= 2 ? origFetch(input, init) : origFetch(input);
    }

    let ctx = null;
    if (isStream) {
        const m = url.match(/[?&]id=([a-f0-9]+)/i);
        const convId = m ? m[1] : '__unknown__';
        const conv = __ABX.convs[convId];
        const index = conv ? conv.turns.length : 0;
        ctx = { convId, index };
    }

    const promise = arguments.length >= 2 ? origFetch(input, init) : origFetch(input);

    return promise.then(function (res) {
        try {
            if (isStream && res.body && typeof res.body.tee === 'function') {
                /* tee() instead of clone(): Firefox clone() starves streaming branches. */
                const [pageSide, sniffSide] = res.body.tee();

                (async () => {
                    const rd = sniffSide.getReader();
                    const dc = new TextDecoder();
                    let buf = '';
                    try {
                        while (true) {
                            const { done, value } = await rd.read();
                            if (done) break;
                            buf += dc.decode(value, { stream: true });
                            buf = buf.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                            let i;
                            while ((i = buf.indexOf('\n')) !== -1) {
                                const line = buf.slice(0, i);
                                buf = buf.slice(i + 1);
                                if (!line.trim()) continue;
                                try {
                                    let s = line.trim();
                                    if (s.indexOf('data:') === 0) s = s.slice(5).trim();
                                    if (!s || s === '[DONE]' || s === '"[DONE]"') continue;
                                    const obj = JSON.parse(s);
                                    if (obj && obj.type) abxHandleEvent(obj, ctx);
                                } catch (e) {}
                            }
                        }
                        if (buf.trim()) {
                            try {
                                let s = buf.trim();
                                if (s.indexOf('data:') === 0) s = s.slice(5).trim();
                                const obj = JSON.parse(s);
                                if (obj && obj.type) abxHandleEvent(obj, ctx);
                            } catch (e) {}
                        }
                    } catch (e) {}
                })();

                const headers = new Headers(res.headers);
                headers.delete('content-encoding');
                headers.delete('content-length');
                return new Response(pageSide, {
                    status: res.status,
                    statusText: res.statusText,
                    headers
                });
            }

            if (isState) {
                res.clone().json().then(j => abxHandleState(url, j)).catch(() => {});
            }
        } catch (e) {}
        return res;
    });
};

/* --- XHR backup --- */
const OrigXHR = window.XMLHttpRequest;
function PatchedXHR() {
    const xhr = new OrigXHR();
    let _url = '';
    const oo = xhr.open;
    xhr.open = function (m, u) {
        _url = u || '';
        return oo.apply(xhr, arguments);
    };
    xhr.addEventListener('load', function () {
        try {
            if (_url.indexOf('/api/tap/v1/stream') !== -1 && xhr.responseText) {
                const m = _url.match(/[?&]id=([a-f0-9]+)/i);
                const convId = m ? m[1] : '__unknown__';
                const conv = __ABX.convs[convId];
                const index = conv ? conv.turns.length : 0;
                abxParseStream(xhr.responseText, { convId, index });
            } else if (_url.indexOf('get_current_state') !== -1) {
                abxHandleState(_url, JSON.parse(xhr.responseText));
            }
        } catch (e) {}
    });
    return xhr;
}
PatchedXHR.prototype = OrigXHR.prototype;
window.XMLHttpRequest = PatchedXHR;

function abxParseStream(text, ctx) {
    __ABX.chunks++;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        if (line.indexOf('data:') === 0) line = line.slice(5).trim();
        if (!line || line === '[DONE]' || line === '"[DONE]"') continue;
        try {
            const obj = JSON.parse(line);
            if (obj && obj.type) abxHandleEvent(obj, ctx);
        } catch (e) {}
    }
}

/* =========================================================================
 * CONVERSATION BUILDERS
 * ========================================================================= */
function getCurrentConversationId() {
    try {
        const m = location.search.match(/[?&]conversation=([a-f0-9]+)/i);
        return m ? m[1] : null;
    } catch (e) { return null; }
}

function extractDomQuestions() {
    return Array.from(document.querySelectorAll('.message.user .user-bubble'))
        .map(e => (e.textContent || '').trim())
        .filter(t => t);
}
function extractDomAnswers() {
    return Array.from(document.querySelectorAll('.tap-round'))
        .map(tr => {
            const ans = tr.querySelector('.message.assistant');
            if (!ans) return '';
            const clone = ans.cloneNode(true);
            clone.querySelectorAll(
                'button, [role="toolbar"], ' +
                '.enrichment-carousel-button-left, .enrichment-carousel-button-right, ' +
                '.header-button, .enrichment-button, .logo-row-button'
            ).forEach(el => el.remove());
            return (clone.textContent || '').trim();
        });
}

/* Hybrid: DOM questions + API answers when available, DOM fallback per turn */
function buildConversationFromApiState() {
    const domQs = extractDomQuestions();
    if (domQs.length === 0) return null;

    const domAs = extractDomAnswers();

    // Merge turns from ANY conversation updated in the last 15 minutes.
    // Brave sometimes changes the URL bar's `conversation=` param to point
    // at the newest sub-conversation on a follow-up, which means the root
    // thread's earlier turns live under a different id.
    const RECENT_MS = 15 * 60 * 1000;
    const now = Date.now();
    const byIndex = new Map();
    Object.values(__ABX.convs).forEach(conv => {
        if (!conv || now - conv.updatedAt > RECENT_MS) return;
        conv.turns.forEach(t => {
            if (!t || typeof t.answerMd !== 'string' || !t.answerMd.trim()) return;
            const ex = byIndex.get(t.index);
            if (!ex) { byIndex.set(t.index, t); return; }
            const tLen = t.answerMd.length;
            const eLen = ex.answerMd.length;
            if (tLen > eLen) {
                // Longer answer wins — merge citations from the shorter one.
                t.citationsById = Object.assign({}, ex.citationsById || {}, t.citationsById || {});
                byIndex.set(t.index, t);
            } else {
                ex.citationsById = Object.assign({}, ex.citationsById || {}, t.citationsById || {});
            }
        });
    });
    const apiTurns = Array.from(byIndex.values()).sort((a, b) => a.index - b.index);

    const offset = domQs.length - apiTurns.length;

    const conversation = [];
    const sourcesByTurn = [];

    for (let i = 0; i < domQs.length; i++) {
        const apiIdx = i - offset;
        let answerText = '';
        let src = null;

        if (apiIdx >= 0 && apiIdx < apiTurns.length) {
            const t = apiTurns[apiIdx];
            answerText = t.answerMd.trim();
            src = {
                citations: Object.values(t.citationsById || {}),
                augmentations: t.augmentations || [],
                ragUrls: t.ragUrls || []
            };
        } else if (domAs[i]) {
            answerText = domAs[i];
        }

        conversation.push({ type: 'user', content: domQs[i], index: i + 1 });
        if (answerText) {
            conversation.push({ type: 'assistant', content: answerText, index: i + 1 });
        }
        if (src) {
            sourcesByTurn.push({ index: i + 1, ...src });
        }
    }

    if (conversation.length === 0) return null;
    if (sourcesByTurn.length) conversation.sourcesByTurn = sourcesByTurn;
    return conversation;
}
    /* Attach API-captured sources (citations / augmentations / ragUrls) to a
   conversation whose content came from the clipboard. Matches by turn index
   using the same recent-window rule as buildConversationFromApiState. */
function attachApiSources(conversation) {
    if (!conversation || !Array.isArray(conversation)) return;
    const domQs = extractDomQuestions();
    if (domQs.length === 0) return;

    const RECENT_MS = 15 * 60 * 1000;
    const now = Date.now();
    const byIndex = new Map();

    Object.values(__ABX.convs).forEach(conv => {
        if (!conv || now - conv.updatedAt > RECENT_MS) return;
        conv.turns.forEach(t => {
            if (!t) return;
            const hasSources = t.citationsById && Object.keys(t.citationsById).length > 0;
            const hasAug = (t.augmentations && t.augmentations.length) ||
                           (t.ragUrls && t.ragUrls.length);
            if (!hasSources && !hasAug) return;
            const ex = byIndex.get(t.index);
            if (!ex) { byIndex.set(t.index, t); return; }
            // Merge (a turn may be split across sub-conversations)
            ex.citationsById = Object.assign({}, ex.citationsById || {}, t.citationsById || {});
            ex.augmentations = (ex.augmentations || []).concat(t.augmentations || []);
            ex.ragUrls = Array.from(new Set((ex.ragUrls || []).concat(t.ragUrls || [])));
        });
    });

    const apiTurns = Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
    if (apiTurns.length === 0) return;

    const offset = domQs.length - apiTurns.length;
    const sourcesByTurn = [];

    for (let i = 0; i < domQs.length; i++) {
        const apiIdx = i - offset;
        if (apiIdx < 0 || apiIdx >= apiTurns.length) continue;
        const t = apiTurns[apiIdx];
        const citations = Object.values(t.citationsById || {});
        if (citations.length === 0) continue;
        sourcesByTurn.push({
            index: i + 1,
            citations,
            augmentations: t.augmentations || [],
            ragUrls: t.ragUrls || []
        });
    }

    if (sourcesByTurn.length) conversation.sourcesByTurn = sourcesByTurn;
}

/* =========================================================================
 * MAIN EXPORT BUTTON
 * ========================================================================= */
function createExportButton() {
    const btn = document.createElement('button');
    btn.innerHTML = '💾 Export';
    btn.id = 'brave-export-btn';
    btn.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 99999;
        padding: 12px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white; border: none; border-radius: 8px; cursor: pointer;
        font-weight: 600; font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.3s ease;`;
    btn.onmouseover = function () { this.style.transform = 'translateY(-2px)'; };
    btn.onmouseout  = function () { this.style.transform = 'translateY(0)'; };
    btn.onclick = showExportDialog;
    document.body.appendChild(btn);
}

/* =========================================================================
 * EXPORT DIALOG
 * ========================================================================= */
function truncateTitle(text, max) {
    if (!text) return '';
    return text.length <= max ? text : text.substring(0, max).trim() + '...';
}

function showExportDialog() {
    const firstUserMsg = document.querySelector('.message.user .user-bubble');
    let apiFirstQuestion = null;
    try {
        const cid = getCurrentConversationId();
        const conv = cid && __ABX.convs[cid];
        if (conv && conv.turns.length) {
            for (let i = 0; i < conv.turns.length; i++) {
                const q = conv.turns[i].question;
                if (typeof q === 'string' && q.trim()) { apiFirstQuestion = q.trim(); break; }
            }
        }
    } catch (e) {}

    const defaultTitle = truncateTitle(
        (firstUserMsg ? firstUserMsg.textContent.trim() : '') ||
        apiFirstQuestion || 'Brave Ask Conversation',
        CONFIG.MAX_TITLE_LENGTH
    );

    const cid = getCurrentConversationId();
    const convData = cid ? __ABX.convs[cid] : null;
    let sourceStatus;
    if (CONFIG.EXPORT_MODE === 'clipboard') {
        sourceStatus = '📋 Mode: clipboard only';
    } else if (convData && convData.turns.some(t => t.answerMd && t.answerMd.trim())) {
        const n = convData.turns.filter(t => t.answerMd && t.answerMd.trim()).length;
        sourceStatus = '✅ API data ready (' + n + ' turn' + (n === 1 ? '' : 's') + ' captured this session) — questions from DOM';
    } else {
        sourceStatus = '⚠️ No API data captured yet — questions from DOM, answers via clipboard-write capture.';
    }

    const fs = getDisplayFontSettings();

    const dialog = document.createElement('div');
    dialog.id = 'brave-export-dialog';
    dialog.className = 'export-dialog-wrapper';
    dialog.innerHTML = `
    <div class="export-dialog-content">
        <h2>Export Conversation</h2>

        <div style="margin-bottom: 15px; font-size: 13px; color: var(--text-secondary, #888);">${sourceStatus}</div>

        <div style="margin-bottom: 20px;">
            <label class="export-dialog-label">Title</label>
            <input type="text" id="export-title" class="export-dialog-input" value="" placeholder="${defaultTitle}">
        </div>

        <div style="margin-bottom: 20px;">
            <label class="export-dialog-label">Export formats</label>
            <div class="export-dialog-checkboxes">
                <label class="export-dialog-checkbox-label">
                    <input type="checkbox" id="export-markdown" checked><span>Markdown</span>
                </label>
                <label class="export-dialog-checkbox-label">
                    <input type="checkbox" id="export-html" checked><span>HTML / PDF</span>
                </label>
            </div>
            <label class="export-dialog-checkbox-label" style="margin-top:12px; font-size:13px;" title="Uncheck if you plan to print on paper — sources stay visible on screen but are hidden when you print or save as PDF.">
                <input type="checkbox" id="sources-in-print" ${loadSourcesInPrint() ? 'checked' : ''}>
                <span>Include sources when printing</span>
            </label>
        </div>

        <div style="margin-bottom: 20px;">
            <label class="export-dialog-label">Capture method</label>
            <div class="export-dialog-checkboxes" style="flex-wrap:wrap;">
                <label class="export-dialog-checkbox-label" title="Try API first; fall back to clipboard if API data is missing.">
                    <input type="radio" name="export-mode" value="auto" checked><span>Auto</span>
                </label>
                <label class="export-dialog-checkbox-label" title="Use only API-captured answers. Fails cleanly if nothing was captured.">
                    <input type="radio" name="export-mode" value="api"><span>API only</span>
                </label>
                <label class="export-dialog-checkbox-label" title="Use only clipboard-write capture (clicks each Copy button). Slower but always works.">
                    <input type="radio" name="export-mode" value="clipboard"><span>Clipboard only</span>
                </label>
            </div>
        </div>

        <details id="font-settings-block" style="margin-bottom: 20px;">
            <summary style="cursor:pointer; font-weight:600; font-size:14px; color:var(--text-primary); margin-bottom:10px;">
                ⚙️ Font size (applies to HTML/PDF, saved for next time)
            </summary>

            <div class="font-row">
                <label for="font-base">Base size</label>
                <input type="range" id="font-base" min="12" max="22" step="1" value="${fs.base}">
                <span id="font-base-val">${fs.base}px</span>
            </div>
            <div class="font-row">
                <label for="font-question">Questions</label>
                <input type="range" id="font-question" min="0.7" max="1.5" step="0.05" value="${fs.questionScale}">
                <span id="font-question-val">${fs.questionScale.toFixed(2)}×</span>
            </div>
            <div class="font-row">
                <label for="font-answer">Answers</label>
                <input type="range" id="font-answer" min="0.7" max="1.5" step="0.05" value="${fs.answerScale}">
                <span id="font-answer-val">${fs.answerScale.toFixed(2)}×</span>
            </div>
            <div class="font-row">
                <label for="font-heading">Headings</label>
                <input type="range" id="font-heading" min="0.7" max="1.5" step="0.05" value="${fs.headingScale}">
                <span id="font-heading-val">${fs.headingScale.toFixed(2)}×</span>
            </div>
            <button type="button" id="font-reset-btn" class="export-dialog-btn export-dialog-btn-cancel" style="padding:6px 12px; font-size:12px; margin-top:6px;">Reset to defaults</button>
        </details>

        <div style="margin-top: 4px; margin-bottom: 18px;">
            <span style="font-size:13px; color:var(--text-secondary);">Need something? </span>
            <a href="https://github.com/abdo2048/Ask-Brave-Chat-Exporter" target="_blank" class="export-dialog-link">Visit GitHub repo</a>
        </div>

        <div class="export-dialog-buttons">
            <button id="export-cancel-btn" class="export-dialog-btn export-dialog-btn-cancel">Cancel</button>
            <button id="export-download-btn" class="export-dialog-btn export-dialog-btn-download">Download</button>
        </div>
    </div>`;

    document.body.appendChild(dialog);

    const bindRange = (id, key, isFloat) => {
        const el  = document.getElementById(id);
        const out = document.getElementById(id + '-val');
        if (!el || !out) return;
        el.addEventListener('input', () => {
            const v = parseFloat(el.value);
            out.textContent = isFloat ? v.toFixed(2) + '×' : v + 'px';
            const s = loadFontSettings();
            if (v === DEFAULT_FONT_SETTINGS[key]) {
                delete s[key];
            } else {
                s[key] = v;
            }
            saveFontSettings(s);
        });
    };
    bindRange('font-base', 'base', false);
    bindRange('font-question', 'questionScale', true);
    bindRange('font-answer', 'answerScale', true);
    bindRange('font-heading', 'headingScale', true);

    document.getElementById('font-reset-btn').addEventListener('click', () => {
        saveFontSettings({});
        ['font-base','font-question','font-answer','font-heading'].forEach((id, i) => {
            const key = ['base','questionScale','answerScale','headingScale'][i];
            const el  = document.getElementById(id);
            const out = document.getElementById(id + '-val');
            el.value = DEFAULT_FONT_SETTINGS[key];
            out.textContent = key === 'base'
                ? DEFAULT_FONT_SETTINGS[key] + 'px'
                : DEFAULT_FONT_SETTINGS[key].toFixed(2) + '×';
        });
    });

    const closeDialog = () => {
        if (dialog._enterKeyHandler) document.removeEventListener('keydown', dialog._enterKeyHandler);
        dialog.remove();
    };

    document.getElementById('export-cancel-btn').onclick = closeDialog;

    document.getElementById('export-download-btn').onclick = function () {
        const titleInput = document.getElementById('export-title').value.trim();
        const title = titleInput || defaultTitle;
        const exportMd = document.getElementById('export-markdown').checked;
        const exportHtml = document.getElementById('export-html').checked;
        if (!exportMd && !exportHtml) { alert('Please select at least one export format.'); return; }

        const modeEl = document.querySelector('input[name="export-mode"]:checked');
        const chosenMode = modeEl ? modeEl.value : 'auto';
        const sourcesInPrint = document.getElementById('sources-in-print').checked;
        saveSourcesInPrint(sourcesInPrint);

        closeDialog();
        startExport(title, exportMd, exportHtml, chosenMode, sourcesInPrint);
    };

    const handleEnterKey = function (e) {
        const dlg = document.getElementById('brave-export-dialog');
        if (e.key === 'Enter' && dlg && e.target && e.target.id === 'export-title') {
            e.preventDefault();
            document.getElementById('export-download-btn').click();
        }
    };
    document.addEventListener('keydown', handleEnterKey);
    dialog._enterKeyHandler = handleEnterKey;

    document.getElementById('export-title').focus();
}

/* =========================================================================
 * EXPORT FLOW
 * ========================================================================= */
async function startExport(title, exportMd, exportHtml, modeOverride, sourcesInPrint) {
    showOverlay();
    try {
        let conversation = null;
        let usedMode = 'api';

        const mode = modeOverride || CONFIG.EXPORT_MODE || 'auto';

        if (mode === 'api' || mode === 'auto') {
            updateOverlay('Reading captured conversation data...');
            conversation = buildConversationFromApiState();
            if (!conversation && mode === 'api') {
                alert('API mode selected, but no captured data is available for this conversation. Switch to Auto or Clipboard.');
                hideOverlay();
                return;
            }
        }

        if (!conversation) {
            usedMode = 'clipboard';
            updateOverlay('Capturing user messages...');
            const userMessages = await copyUserMessages();
            updateOverlay('Capturing AI answers...');
            const aiAnswers = await copyAIAnswers();
            updateOverlay('Building conversation...');
            conversation = buildConversationSimple(userMessages, aiAnswers);

            // Hybrid: content came from clipboard, but sources still come from
            // the API (clipboard copy strips citations). Attach them by turn
            // index when API data is available for this session.
            updateOverlay('Attaching sources from API...');
            attachApiSources(conversation);
        }

        console.log('[ABX] Export mode:', usedMode, '| messages:', conversation.length);

        if (exportMd) {
            updateOverlay('Generating Markdown...');
            const md = generateMarkdown(title, conversation, usedMode);
            downloadFile(md, sanitizeFilename(title) + '.md', 'text/markdown');
        }
        if (exportHtml) {
            updateOverlay('Generating HTML...');
            const html = generateHTML(title, conversation, usedMode, sourcesInPrint);
            if (html) downloadFile(html, sanitizeFilename(title) + '.html', 'text/html');
        }

        updateOverlay('Export complete! ✓');
        await sleep(900);
        hideOverlay();
    } catch (err) {
        console.error('Export failed:', err);
        alert('Export failed. Check console for details.');
        hideOverlay();
    }
}

/* =========================================================================
 * CLIPBOARD-WRITE CAPTURE (fallback)
 * ========================================================================= */
async function clickAndCapture(button, timeoutMs) {
    if (!button) return null;
    if (timeoutMs == null) timeoutMs = 800;
    __ABX_CLIP.text = null;
    const before = __ABX_CLIP.at;
    try { button.click(); } catch (e) { return null; }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (__ABX_CLIP.text !== null && __ABX_CLIP.at >= before) return __ABX_CLIP.text;
        await sleep(30);
    }
    return null;
}

const COPY_LABEL_CANDIDATES = [
    'Copy', 'Copiar', 'Kopieren', 'Copia', 'Copie', 'Kopiëren',
    '复制', '複製', 'コピー', '복사', 'Скопировать', 'Скопіювати', 'نسخ'
];

function findCopyButton(root, role) {
    if (!root) return null;

    // Brave's own classes are the strongest signal — use them first.
    if (role === 'user') {
        const b = root.querySelector('button.user-message-action[aria-label="Copy"]');
        if (b) return b;
    } else if (role === 'assistant') {
        const b = root.querySelector('button.tap-round-footer-action[aria-label="Copy"]');
        if (b) return b;
    }

    // Localized aria-label inside the correct footer container.
    const footerSel = role === 'user' ? '.user-message-actions' : '.tap-round-footer-actions';
    const footer = root.querySelector(footerSel);
    if (footer) {
        for (const lbl of COPY_LABEL_CANDIDATES) {
            const b = footer.querySelector('button[aria-label="' + lbl + '"]');
            if (b) return b;
        }
        const buttons = footer.querySelectorAll('button[aria-label], button[title]');
        for (const b of buttons) {
            const s = ((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '')).toLowerCase();
            if (s.includes('copy') || s.includes('copiar') || s.includes('kopier') || s.includes('コピー')) return b;
        }
    }
    return null;
}

async function copyUserMessages() {
    const messages = [];
    const containers = document.querySelectorAll('.message.user');
    for (let i = 0; i < containers.length; i++) {
        const c = containers[i];
        const btn = findCopyButton(c, 'user');
        let text = await clickAndCapture(btn);
        if (text === null) {
            const bubble = c.querySelector('.user-bubble') || c;
            text = (bubble.textContent || '').trim();
        }
        if (text) messages.push(text.trim());
    }
    return messages;
}

async function copyAIAnswers() {
    const answers = [];
    const containers = document.querySelectorAll('.tap-round');
    for (let i = 0; i < containers.length; i++) {
        const tr = containers[i];
        const btn = findCopyButton(tr, 'assistant');
        let text = await clickAndCapture(btn);
        if (text === null) {
            // DOM fallback: only clone the answer subtree.
            const ans = tr.querySelector('.message.assistant');
            if (ans) {
                const clone = ans.cloneNode(true);
                clone.querySelectorAll(
                    'button, [role="toolbar"], ' +
                    '.enrichment-carousel-button-left, .enrichment-carousel-button-right, ' +
                    '.header-button, .enrichment-button, .logo-row-button'
                ).forEach(el => el.remove());
                text = (clone.textContent || '').trim();
            }
        }
        if (text) answers.push(text.trim());
    }
    return answers;
}

function buildConversationSimple(userMessages, aiAnswers) {
    const conversation = [];
    const n = Math.max(userMessages.length, aiAnswers.length);
    for (let i = 0; i < n; i++) {
        if (userMessages[i]) conversation.push({ type: 'user', content: userMessages[i], index: i + 1 });
        if (aiAnswers[i])    conversation.push({ type: 'assistant', content: aiAnswers[i], index: i + 1 });
    }
    return conversation;
}

/* =========================================================================
 * MARKDOWN GENERATION
 * ========================================================================= */
function generateMarkdown(title, conversation, usedMode) {
    const dateStr = formatDate(new Date());
    let md = '';
    md += '---\n';
    md += '**Title:** ' + title + '\n';
    md += '**Exported:** ' + dateStr + '\n';
    md += '**Method:** ' + (usedMode === 'api' ? 'API capture (DOM questions + live answers)' : 'Clipboard-write capture (sources from API)') + '\n';
    md += '\n---\n';

    const sourcesByTurn = {};
    if (Array.isArray(conversation.sourcesByTurn)) {
        conversation.sourcesByTurn.forEach(s => { sourcesByTurn[s.index] = s; });
    }

    let q = 0;
    for (let i = 0; i < conversation.length; i++) {
        const m = conversation[i];
        if (m.type === 'user') {
            q++;
            md += '◤━━━━━━ Q' + q + ' ━━━━━◥\n';
            md += m.content + '\n';
            md += '◣━━━━━━ Q' + q + ' ━━━━━◢\n\n';
        } else {
            md += m.content + '\n\n';

            if (CONFIG.INCLUDE_RESOURCES !== 'none') {
                const src = sourcesByTurn[m.index];
                if (src && src.citations && src.citations.length) {
                    md += '**Sources**\n\n';
                    src.citations.forEach((c, idx) => {
                        const t = (c.title || c.url || '').replace(/[\[\]]/g, '');
                        md += (idx + 1) + '. [' + t + '](' + c.url + ')\n';
                    });
                    md += '\n';
                }
            }

            if (i < conversation.length - 1) md += '---\n\n';
        }
    }
    return md;
}

/* =========================================================================
 * HTML GENERATION
 * ========================================================================= */

/* --- Print-only CSS. Applies exclusively inside @media print. ----------- */
function buildPrintCSS() {
    return `
<style id="print-rules">
@media print {
  /* ---- Hard reset to light mode, no custom-property tricks ---- */
  html, body {
    background: #ffffff !important;
    color: #0f172a !important;
    color-scheme: light !important;
  }

  /* Hide interactive-only UI */
  .toc-sidebar, .mobile-menu-btn, .overlay, .copy-btn,
  .table-menu-btn, .table-dropdown, .separator, .print-tip { display: none !important; }

  /* Flatten the grid layout */
  .container { display: block !important; }
  .main-content { padding: 0 !important; max-width: 100% !important; }
  .header {
    padding: 1.5rem 0 !important;
    margin-bottom: 1rem !important;
    background: #ffffff !important;
    box-shadow: none !important;
    border: none !important;
  }
  .content {
    padding: 0 !important;
    background: #ffffff !important;
    box-shadow: none !important;
    border: none !important;
  }

  /* Question — direct literal colors so nothing can leak through */
  .question { page-break-inside: avoid; }
  .question blockquote {
    background: #f1f5f9 !important;
    border-left: 6px solid #4f46e5 !important;
    box-shadow: none !important;
    color: #0f172a !important;
  }
  .question strong { color: #4f46e5 !important; }
  .question pre.question-text {
    background: transparent !important;
    color: #0f172a !important;
  }

  /* Answer — keep v1.2 spacing, do not shrink fonts */
  .answer { page-break-inside: auto; }
  .answer p { margin-bottom: 1.5rem !important; }

  /* Tables — flow across pages naturally. Rows stay intact; header repeats.
     (Do NOT use break-inside:avoid on the table itself — a table taller than
     a page would be pushed to its own page, leaving whitespace behind.) */
  .table-wrapper {
    overflow: visible !important;
    box-shadow: none !important;
  }
  table {
    width: 100% !important;
    table-layout: fixed !important;
  }
  table th, table td {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  thead th, tbody td {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Don't orphan a heading at the bottom of a page */
  h1, h2, h3 { break-after: avoid; page-break-after: avoid; }

  /* Code blocks keep their dark look in print too */
  pre {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Links: show target URL after the text, except inside sources lists */
  a[href]:not([href^="#"]):not(.citations-block a)::after {
    content: " (" attr(href) ")";
    font-size: 0.85em;
    color: #555;
  }
}
</style>`;
}

/* --- User font overrides. Emits rules ONLY for fields the user set. ------ */
function buildFontOverridesCSS(userFs) {
    const baseSet = userFs.base != null;
    const qSet    = userFs.questionScale != null;
    const aSet    = userFs.answerScale != null;
    const hSet    = userFs.headingScale != null;
    if (!baseSet && !qSet && !aSet && !hSet) return '';

    const rules = [];
    if (baseSet) {
        rules.push('html { font-size: ' + userFs.base + 'px !important; }');
    }
    const baseline = baseSet ? userFs.base : 16;

    if (aSet) {
        rules.push(':root { --text-scale-base: ' + (baseline * userFs.answerScale).toFixed(2) + 'px !important; }');
    }
    if (hSet) {
        rules.push(':root {\n' +
            '  --text-scale-h1: ' + (baseline * userFs.headingScale * 2.2).toFixed(2) + 'px !important;\n' +
            '  --text-scale-h2: ' + (baseline * userFs.headingScale * 1.75).toFixed(2) + 'px !important;\n' +
            '  --text-scale-h3: ' + (baseline * userFs.headingScale * 1.35).toFixed(2) + 'px !important;\n' +
            '}');
    }
    if (qSet) {
        rules.push('.question pre.question-text { font-size: ' + (baseline * userFs.questionScale).toFixed(2) + 'px !important; }');
    }

    return rules.length
        ? '<style id="user-font-overrides">\n' + rules.join('\n') + '\n</style>'
        : '';
}

function renderCitationsHTML(citations) {
    if (!citations || citations.length === 0) return '';
    let out = '<div class="citations-block"><h3>Sources for this answer</h3><ol class="citations-list">';
    citations.forEach(c => {
        const fav = c.favicon ? '<img src="' + escapeHtml(c.favicon) + '" alt="" class="cite-favicon" onerror="this.style.display=\'none\'">' : '';
        const title = c.title || c.url;
        out += '<li>' + fav + '<a href="' + escapeHtml(c.url) + '" target="_blank" rel="noopener">' + escapeHtml(title) + '</a></li>';
    });
    out += '</ol></div>';
    return out;
}

function generateHTML(title, conversation, usedMode, sourcesInPrint) {
    if (sourcesInPrint === undefined) sourcesInPrint = loadSourcesInPrint();
    const dateStr = formatDate(new Date());
    const methodNote = usedMode === 'api' ? ' · API capture' : ' · clipboard';
    if (typeof marked === 'undefined') {
        alert('HTML export failed: marked.js library not loaded.');
        return '';
    }

    const renderer = {
        heading({ tokens, depth }) {
            const text = this.parser.parseInline(tokens);
            const slug = text.toLowerCase().replace(/[^\w]+/g, '-');
            return '<h' + depth + ' id="' + slug + '">' + text + '</h' + depth + '>';
        }
    };
    marked.use({ renderer });

    const fontOverrides = buildFontOverridesCSS(loadFontSettings());
    const printCSS = buildPrintCSS();
    const hideSourcesPrintCSS = sourcesInPrint ? '' : `
<style id="hide-sources-print">
@media print { .citations-block { display: none !important; } }
</style>`;

    const sourcesByTurn = {};
    if (Array.isArray(conversation.sourcesByTurn)) {
        conversation.sourcesByTurn.forEach(s => { sourcesByTurn[s.index] = s; });
    }

    let contentHTML = '';
    let q = 0;

    for (let i = 0; i < conversation.length; i++) {
        const m = conversation[i];
        if (m.type === 'user') {
            q++;
            if (q > 1) contentHTML += '<div class="separator">───────</div>\n';
            contentHTML += '<div id="Q' + q + '" class="question">\n';
            contentHTML += '<blockquote><strong>Q' + q + ':</strong>\n';
            contentHTML += '<pre class="question-text">' + escapeHtml(m.content) + '</pre>\n';
            contentHTML += '</blockquote>\n</div>\n';
        } else {
            contentHTML += '<div class="answer">\n';
            contentHTML += marked.parse(m.content);
            if (CONFIG.INCLUDE_RESOURCES !== 'none') {
                const src = sourcesByTurn[m.index];
                if (src && src.citations && src.citations.length) {
                    contentHTML += renderCitationsHTML(src.citations);
                }
            }
            contentHTML += '</div>\n';
        }
    }

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
:root {
  --bg-body: #f8fafc; --bg-surface: #ffffff; --bg-sidebar: #ffffff;
  --bg-blockquote-q: #f1f5f9; --bg-blockquote-note: #f8fafc; --border-note: #cbd5e1;
  --bg-code-block: #1e293b; --bg-code-inline: #e2e8f0;
  --text-code-block: #e2e8f0; --text-code-inline: #0f172a;
  --text-primary: #0f172a; --text-secondary: #475569;
  --primary: #4f46e5; --primary-hover: #4338ca; --accent: #0ea5e9;
  --border-color: #e2e8f0;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-float: 0 10px 15px -3px rgba(0,0,0,0.1);
  --font-base: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --text-scale-base: clamp(1rem, 1vw + 0.8rem, 1.125rem);
  --text-scale-h1: clamp(1.8rem, 3.5vw + 0.9rem, 2.7rem);
  --text-scale-h2: clamp(1.35rem, 2.7vw + 0.9rem, 2rem);
  --text-scale-h3: clamp(1.1rem, 1.8vw + 0.9rem, 1.55rem);
  --sidebar-width: 300px;
  --container-max: 1000px;
  --radius-md: 12px; --radius-lg: 16px;
  --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg-body: #0f172a; --bg-surface: #1e293b; --bg-sidebar: #1e293b;
    --bg-code-inline: #334155; --text-code-inline: #e2e8f0;
    --bg-code-block: #0B111F; --text-code-block: #f8fafc;
    --bg-blockquote-q: #334155; --bg-blockquote-note: #334155; --border-note: #475569;
    --text-primary: #f1f5f9; --text-secondary: #cbd5e1;
    --primary: #818cf8; --primary-hover: #6366f1;
    --border-color: #334155;
  }
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; font-size: 16px; }
body {
  font-family: var(--font-base); background-color: var(--bg-body); color: var(--text-primary);
  line-height: 1.7; font-size: var(--text-scale-base); overflow-x: hidden;
}
:focus-visible { outline: 2px solid var(--primary); outline-offset: 4px; }

.container { display: grid; grid-template-columns: var(--sidebar-width) 1fr; min-height: 100vh; }
.toc-sidebar {
  background: var(--bg-sidebar); border-right: 1px solid var(--border-color);
  height: 100vh; position: sticky; top: 0; padding: 2rem; overflow-y: auto;
}
.toc-sidebar h2 { font-size: 1.25rem; margin-bottom: 1.5rem; color: var(--primary); }
.toc-sidebar ul { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
.toc-sidebar a {
  display: block; text-decoration: none; color: var(--text-secondary);
  font-size: 0.95rem; padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md); border-left: 3px solid transparent;
  transition: all var(--transition);
}
.toc-sidebar a:hover { background: var(--bg-body); color: var(--primary); transform: translateX(4px); }
.toc-sidebar a.active { background: var(--bg-blockquote-q); color: var(--primary); border-left-color: var(--primary); font-weight: 600; }
.toc-q { font-weight: 700; margin-top: 1rem; }
.toc-h2 { padding-left: 1rem; font-size: 0.9rem; }

.main-content { padding: 3rem 4rem; width: 100%; max-width: var(--container-max); margin: 0 auto; }
.header {
  background: var(--bg-surface); padding: 3rem; border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md); margin-bottom: 2rem; border: 1px solid var(--border-color);
  text-align: center;
}
.header h1 {
  font-size: var(--text-scale-h1); line-height: 1.2; margin-bottom: 1rem;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.header .meta { color: var(--text-secondary); font-size: 0.9rem; font-family: var(--font-mono); opacity: 0.8; }
.content {
  background: var(--bg-surface); padding: 4rem; border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md); border: 1px solid var(--border-color);
}
h2 { font-size: var(--text-scale-h2); margin: 2.5rem 0 1.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--border-color); }
h3 { font-size: var(--text-scale-h3); margin: 2rem 0 1rem; color: var(--text-secondary); }
p { margin-bottom: 1.5rem; }

.code-wrapper { position: relative; margin: 2rem 0; }
pre {
  background: var(--bg-code-block); color: var(--text-code-block);
  padding: 1.5rem; border-radius: var(--radius-md); overflow-x: auto;
  font-family: var(--font-mono); font-size: 0.9rem;
}
pre code { background: none; padding: 0; font-family: inherit; }
:not(pre) > code {
  background-color: var(--bg-code-inline); color: var(--text-code-inline);
  padding: 0.2em 0.4em; border-radius: 6px;
  font-family: var(--font-mono); font-size: 0.85em; border: 1px solid transparent;
}

/* Table structure: outer holds the non-scrolling button/dropdown, inner scrolls */
.table-outer { position: relative; margin: 2rem 0; }
.table-wrapper { overflow-x: auto; border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; background: var(--bg-surface); border: 1px solid var(--border-color); }
thead { background: var(--primary); color: white; }
thead th { padding: 0.875rem 1rem; text-align: left; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
tbody tr { border-bottom: 1px solid var(--border-color); }
tbody tr:nth-child(odd)  { background: var(--bg-surface); }
tbody tr:nth-child(even) { background: var(--bg-body); }
tbody tr:hover { background: var(--bg-blockquote-q); }
tbody td { padding: 0.75rem 1rem; color: var(--text-primary); }
tbody td:first-child { font-weight: 600; }

.copy-btn {
  position: absolute; top: 0.5rem; right: 0.5rem;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  color: var(--text-code-block); padding: 0.25rem 0.5rem;
  border-radius: 6px; cursor: pointer; font-size: 0.8rem;
  opacity: 0; transition: var(--transition);
}
.code-wrapper:hover .copy-btn,
.question:hover .copy-btn { opacity: 1; }
.copy-btn:hover { background: var(--primary); border-color: var(--primary); color: white; }
.question .copy-btn {
  top: 1rem; right: 1rem;
  background: var(--bg-surface); color: var(--text-secondary);
  border-color: var(--border-color);
}

/* Three-dot table menu — hover-only, positioned outside the scroll container */
.table-menu-btn {
  position: absolute; top: 0.75rem; right: 0.75rem;
  background: var(--bg-surface); border: 1px solid var(--border-color);
  border-radius: 6px; width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 16px; color: var(--text-secondary);
  transition: opacity var(--transition), background var(--transition), border-color var(--transition);
  z-index: 10; padding: 0;
  opacity: 0; pointer-events: none;
}
.table-outer:hover .table-menu-btn,
.table-outer.menu-open .table-menu-btn,
.table-menu-btn:focus-visible { opacity: 1; pointer-events: auto; }
.table-menu-btn:hover { background: var(--bg-blockquote-q); border-color: var(--primary); color: var(--primary); }
.table-menu-btn:focus { outline: 2px solid var(--primary); outline-offset: 2px; }

.table-dropdown {
  position: absolute; top: 2.75rem; right: 0.75rem;
  background: var(--bg-surface); border: 1px solid var(--border-color);
  border-radius: var(--radius-md); box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  min-width: 180px; opacity: 0; visibility: hidden;
  transform: translateY(-8px);
  transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
  z-index: 100; overflow: hidden;
}
.table-dropdown.active { opacity: 1; visibility: visible; transform: translateY(0); }
.table-dropdown-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1rem; cursor: pointer;
  font-size: 0.875rem; color: var(--text-primary);
  border: none; background: none; width: 100%;
  text-align: left; transition: background 0.15s ease;
}
.table-dropdown-item:hover { background: var(--bg-blockquote-q); }
.table-dropdown-item span { font-size: 16px; }
.table-dropdown-separator { height: 1px; background: var(--border-color); margin: 0.25rem 0; }

blockquote {
  background: var(--bg-blockquote-note); border-left: 4px solid var(--border-note);
  padding: 1rem 1.5rem; border-radius: 0 var(--radius-md) var(--radius-md) 0;
  margin: 1.5rem 0; font-style: italic; color: var(--text-secondary);
}
.question { position: relative; margin: 3rem 0 1.5rem; }
.question blockquote {
  background: var(--bg-blockquote-q); border-left: 6px solid var(--primary);
  padding: 1.25rem 2rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);
  font-style: normal; color: var(--text-primary);
}
.question strong {
  display: block; color: var(--primary); font-size: 1.1rem;
  margin-bottom: 0.25rem; line-height: 1.2;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.question pre.question-text {
  font-family: var(--font-base); white-space: pre-wrap;
  font-size: var(--text-scale-h3); font-weight: 700;
  color: var(--text-primary);
  background: none; padding: 0; margin: 0; border: none; border-radius: 0;
}
.separator { display: none; }

.citations-block {
  margin-top: 1.5rem; padding: 1rem 1.25rem;
  background: var(--bg-blockquote-note);
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
}
.citations-block h3 { font-size: 0.95rem; margin: 0 0 0.5rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.citations-list { list-style: decimal inside; padding-left: 0.5rem; }
.citations-list li { margin-bottom: 0.35rem; font-size: 0.9rem; }
.citations-list a { color: var(--primary); text-decoration: none; }
.citations-list a:hover { text-decoration: underline; }
@media print {
  .citations-list a { text-decoration: underline; }
}
.cite-favicon { width: 14px; height: 14px; vertical-align: middle; margin-right: 4px; border-radius: 2px; }

.print-tip {
  max-width: var(--container-max); margin: 1.5rem auto 0;
  padding: 0.75rem 1rem;
  background: rgba(79,70,229,0.08);
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  font-size: 0.9rem; color: var(--text-secondary);
}
.print-tip strong { color: var(--primary); }

@media (max-width: 1024px) {
  .container { grid-template-columns: 1fr; }
  .toc-sidebar { position: fixed; top: 0; left: 0; width: 280px; z-index: 1000; transform: translateX(-100%); transition: transform var(--transition); box-shadow: var(--shadow-float); }
  .toc-sidebar.open { transform: translateX(0); }
  .main-content { padding: 1.5rem; }
  .header, .content { padding: 1.5rem; }
  .mobile-menu-btn {
    display: flex !important; position: fixed; bottom: 20px; right: 20px;
    background: var(--primary); color: white; width: 50px; height: 50px; border-radius: 50%;
    align-items: center; justify-content: center; box-shadow: var(--shadow-float);
    z-index: 1100; cursor: pointer; border: none; font-size: 1.5rem;
  }
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; opacity: 0; pointer-events: none; transition: opacity var(--transition); }
  .overlay.active { opacity: 1; pointer-events: auto; }
}
.mobile-menu-btn { display: none; }
</style>
${fontOverrides}
${printCSS}
${hideSourcesPrintCSS}
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
      <div class="meta">Exported: ${dateStr}${methodNote}</div>
    </div>
    <div class="content">
      ${contentHTML}
    </div>
  </div>
</div>

<div class="print-tip">
  <strong>💡 Print tip:</strong> before saving as PDF (Ctrl+P), tick the
  <em>"Background graphics"</em> checkbox in the browser print dialog so the
  question backgrounds, table headers, and code blocks keep their colours.
</div>

<button class="mobile-menu-btn" aria-label="Toggle Table of Contents">☰</button>
<div class="overlay"></div>

<script>
(function () {
  var btn = document.querySelector('.mobile-menu-btn');
  var overlay = document.querySelector('.overlay');
  var sidebar = document.querySelector('.toc-sidebar');
  function toggle() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
    btn.textContent = sidebar.classList.contains('open') ? '✕' : '☰';
  }
  btn.addEventListener('click', toggle);
  overlay.addEventListener('click', toggle);
  sidebar.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { if (window.innerWidth < 1024) toggle(); });
  });

  var tocLinks = document.querySelectorAll('.toc-sidebar a');
  var sections = Array.prototype.map.call(tocLinks, function (link) {
    return document.getElementById(link.getAttribute('href').replace('#', ''));
  }).filter(function (el) { return el; });
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        tocLinks.forEach(function (l) { l.classList.remove('active'); });
        var al = document.querySelector('.toc-sidebar a[href="#' + entry.target.id + '"]');
        if (al) al.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  sections.forEach(function (s) { observer.observe(s); });

  document.querySelectorAll('pre').forEach(function (pre) {
    if (pre.classList.contains('question-text')) return;
    var w = document.createElement('div');
    w.className = 'code-wrapper';
    pre.parentNode.insertBefore(w, pre);
    w.appendChild(pre);
    addCopyButton(w, pre.innerText);
  });

  document.querySelectorAll('.question').forEach(function (q) {
    var txt = (q.querySelector('.question-text') && q.querySelector('.question-text').innerText) || q.innerText;
    addCopyButton(q, txt);
  });

  document.querySelectorAll('table').forEach(function (table) {
    var outer = document.createElement('div');
    outer.className = 'table-outer';
    var inner = document.createElement('div');
    inner.className = 'table-wrapper';
    table.parentNode.insertBefore(outer, table);
    outer.appendChild(inner);
    inner.appendChild(table);
    addTableMenu(outer, table);
  });

  function addCopyButton(parent, textToCopy) {
    var b = document.createElement('button');
    b.className = 'copy-btn';
    b.textContent = 'Copy';
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(textToCopy).then(function () {
        b.textContent = 'Copied!';
        setTimeout(function () { b.textContent = 'Copy'; }, 1500);
      }).catch(function () {});
    });
    parent.appendChild(b);
  }

  function addTableMenu(outer, table) {
    var menuBtn = document.createElement('button');
    menuBtn.className = 'table-menu-btn';
    menuBtn.textContent = '\u22EE';
    menuBtn.setAttribute('aria-label', 'Table options');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-haspopup', 'true');

    var dropdown = document.createElement('div');
    dropdown.className = 'table-dropdown';
    dropdown.setAttribute('role', 'menu');

    var plainText = extractPlainText(table);
    var csvText = extractTSV(table);
    var mdText = extractMarkdown(table);

    var items = [
      { icon: '\uD83D\uDCCA', text: 'Copy for Excel', action: function () { copy(csvText); } },
      { icon: '\uD83D\uDCCB', text: 'Copy as Text', action: function () { copy(plainText); } },
      { sep: true },
      { icon: '\uD83D\uDCDD', text: 'Copy Markdown', action: function () { copy(mdText); } }
    ];

    items.forEach(function (item) {
      if (item.sep) {
        var s = document.createElement('div');
        s.className = 'table-dropdown-separator';
        dropdown.appendChild(s);
      } else {
        var mi = document.createElement('button');
        mi.className = 'table-dropdown-item';
        mi.setAttribute('role', 'menuitem');
        mi.setAttribute('tabindex', '-1');
        mi.innerHTML = '<span>' + item.icon + '</span>' + item.text;
        mi.addEventListener('click', function (e) { e.stopPropagation(); item.action(); closeMenu(); });
        dropdown.appendChild(mi);
      }
    });

    function openMenu() {
      closeAllOtherMenus(dropdown);
      dropdown.classList.add('active');
      outer.classList.add('menu-open');
      menuBtn.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
      dropdown.classList.remove('active');
      outer.classList.remove('menu-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
    function closeAllOtherMenus(except) {
      document.querySelectorAll('.table-dropdown.active').forEach(function (d) {
        if (d !== except) {
          d.classList.remove('active');
          var o = d.closest('.table-outer');
          if (o) o.classList.remove('menu-open');
        }
      });
    }
    function copy(text) {
      navigator.clipboard.writeText(text).then(function () {
        var orig = menuBtn.textContent;
        menuBtn.textContent = '\u2713';
        menuBtn.style.color = 'var(--primary)';
        setTimeout(function () { menuBtn.textContent = orig; menuBtn.style.color = ''; }, 1500);
      }).catch(function () {});
    }

    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dropdown.classList.contains('active')) closeMenu(); else openMenu();
    });

    /* Close when clicking anywhere except the dropdown itself.
       (Clicks on the menu button are handled above and don't reach here.) */
    document.addEventListener('click', function (e) {
      if (!dropdown.classList.contains('active')) return;
      if (dropdown.contains(e.target)) return;
      if (menuBtn.contains(e.target)) return;
      closeMenu();
    });

    /* Escape closes from anywhere on the page */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && dropdown.classList.contains('active')) {
        e.preventDefault();
        closeMenu();
        menuBtn.focus();
      }
    });

    /* Keyboard nav inside the open dropdown */
    dropdown.addEventListener('keydown', function (e) {
      var list = Array.prototype.slice.call(dropdown.querySelectorAll('.table-dropdown-item'));
      var idx = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); list[(idx + 1) % list.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); list[idx <= 0 ? list.length - 1 : idx - 1].focus(); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (document.activeElement.classList.contains('table-dropdown-item')) document.activeElement.click();
      }
    });

    outer.appendChild(menuBtn);
    outer.appendChild(dropdown);
  }

  function extractPlainText(table) {
    var text = '', NL = String.fromCharCode(10);
    var headers = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
    if (headers.length) {
      text += headers.join('  ') + NL;
      text += headers.map(function () { return '---'; }).join('  ') + NL;
    }
    table.querySelectorAll('tbody tr').forEach(function (row) {
      text += Array.prototype.map.call(row.querySelectorAll('td'), function (td) { return td.textContent.trim(); }).join('  ') + NL;
    });
    return text;
  }
  function extractMarkdown(table) {
    var md = '', NL = String.fromCharCode(10);
    var headers = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
    if (headers.length) {
      md += '| ' + headers.join(' | ') + ' |' + NL;
      md += '|' + headers.map(function () { return '---'; }).join('|') + '|' + NL;
    }
    table.querySelectorAll('tbody tr').forEach(function (row) {
      md += '| ' + Array.prototype.map.call(row.querySelectorAll('td'), function (td) { return td.textContent.trim(); }).join(' | ') + ' |' + NL;
    });
    return md;
  }
  function extractTSV(table) {
    var tsv = '', TAB = String.fromCharCode(9), NL = String.fromCharCode(10);
    var headers = Array.prototype.map.call(table.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
    if (headers.length) tsv += headers.join(TAB) + NL;
    table.querySelectorAll('tbody tr').forEach(function (row) {
      tsv += Array.prototype.map.call(row.querySelectorAll('td'), function (td) { return td.textContent.trim(); }).join(TAB) + NL;
    });
    return tsv;
  }
})();
</script>
</body>
</html>`;
}

/* =========================================================================
 * TOC helpers
 * ========================================================================= */
function generateTOCHTML(conversation) {
    let html = '<ul>\n';
    let q = 0;
    for (let i = 0; i < conversation.length; i++) {
        const m = conversation[i];
        if (m.type !== 'user') continue;
        q++;
        const truncated = truncateTitle(m.content, 60);
        html += '<li><a href="#Q' + q + '" class="toc-q">Q' + q + ': ' + escapeHtml(truncated) + '</a></li>\n';
        let nextA = null;
        for (let k = i + 1; k < conversation.length; k++) {
            if (conversation[k].type === 'assistant') { nextA = conversation[k]; break; }
        }
        if (nextA) {
            const headers = extractH2Headers(nextA.content);
            headers.forEach(h => {
                html += '<li><a href="#' + slugify(h) + '" class="toc-h2">' + escapeHtml(h) + '</a></li>\n';
            });
        }
    }
    html += '</ul>';
    return html;
}
function extractH2Headers(md) {
    const out = [];
    const lines = md.split('\n');
    let inCode = false;
    for (const raw of lines) {
        const t = raw.trim();
        if (t.startsWith('```')) { inCode = !inCode; continue; }
        if (inCode) continue;
        if (t.startsWith('>')) continue;
        if (t.startsWith('## ')) out.push(t.slice(3).trim());
    }
    return out;
}
function slugify(text) {
    return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

/* =========================================================================
 * OVERLAY
 * ========================================================================= */
function showOverlay() {
    const el = document.createElement('div');
    el.id = 'brave-export-overlay';
    el.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;">
            <div style="text-align:center;color:white;">
                <div style="font-size:60px;margin-bottom:40px;">⏳</div>
                <div id="overlay-message" style="font-size:24px;font-weight:600;">Processing...</div>
                <div style="font-size:14px;margin-top:12px;opacity:0.7;">Please do not interact with the page</div>
            </div>
        </div>`;
    document.body.appendChild(el);
}
function updateOverlay(message) {
    const el = document.getElementById('overlay-message');
    if (el) el.textContent = message;
}
function hideOverlay() {
    const el = document.getElementById('brave-export-overlay');
    if (el) el.remove();
}

/* =========================================================================
 * UTILITIES
 * ========================================================================= */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sanitizeFilename(s) { return s.replace(/[?<>:*|"]/g, '').substring(0, 200); }
function formatDate(d) {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    let h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return dayName + ' ' + dd + '-' + mm + '-' + yyyy + ', ' + String(h).padStart(2,'0') + ':' + min + ' ' + ampm;
}
function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text == null ? '' : text;
    return d.innerHTML;
}
function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/* =========================================================================
 * DIALOG CSS (into the Brave page)
 * ========================================================================= */
function injectDialogCSS() {
    const style = document.createElement('style');
    style.textContent = `
.export-dialog-wrapper {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 999999; backdrop-filter: blur(4px);
}
.export-dialog-content {
  background: #fff; padding: 30px; border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  max-width: 520px; width: 90%;
  border: 1px solid #e2e8f0;
  max-height: 90vh; overflow-y: auto;
}
.export-dialog-content h2 {
  margin: 0 0 20px; font-size: 22px; color: #0f172a;
  border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;
}
.export-dialog-label { display: block; margin-bottom: 8px; font-weight: 600; color: #0f172a; font-size: 14px; }
.export-dialog-input {
  width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 14px; font-family: Inter, system-ui, sans-serif;
  background: #f8fafc; color: #0f172a; box-sizing: border-box;
}
.export-dialog-input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
.export-dialog-checkboxes { display: flex; gap: 20px; margin-top: 10px; }
.export-dialog-checkbox-label { display: flex; align-items: center; cursor: pointer; color: #0f172a; font-size: 14px; }
.export-dialog-checkbox-label input[type="checkbox"] { margin-right: 8px; width: 18px; height: 18px; accent-color: #4f46e5; cursor: pointer; }
.export-dialog-link { color: #4f46e5; text-decoration: none; font-weight: 600; font-size: 13px; }
.export-dialog-link:hover { color: #4338ca; text-decoration: underline; }
.export-dialog-buttons { display: flex; gap: 15px; justify-content: flex-end; margin-top: 20px; }
.export-dialog-btn {
  padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;
  cursor: pointer; border: none; font-family: Inter, system-ui, sans-serif;
}
.export-dialog-btn-cancel { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
.export-dialog-btn-cancel:hover { background: #f1f5f9; color: #0f172a; }
.export-dialog-btn-download { background: #4f46e5; color: white; }
.export-dialog-btn-download:hover { background: #4338ca; transform: translateY(-1px); }
.font-row { display: grid; grid-template-columns: 110px 1fr 60px; gap: 10px; align-items: center; margin-bottom: 10px; font-size: 13px; }
.font-row label { color: #475569; }
.font-row input[type="range"] { width: 100%; accent-color: #4f46e5; }
.font-row span { font-family: ui-monospace, monospace; color: #0f172a; text-align: right; }
details#font-settings-block > summary { user-select: none; }
details#font-settings-block[open] > summary { margin-bottom: 14px; }

@media (prefers-color-scheme: dark) {
  .export-dialog-content { background: #1e293b; border-color: #334155; }
  .export-dialog-content h2 { color: #f1f5f9; border-bottom-color: #334155; }
  .export-dialog-label { color: #f1f5f9; }
  .export-dialog-input { background: #0f172a; color: #f1f5f9; border-color: #334155; }
  .export-dialog-checkbox-label { color: #f1f5f9; }
  .export-dialog-link { color: #818cf8; }
  .export-dialog-btn-cancel { background: #0f172a; color: #cbd5e1; border-color: #334155; }
  .export-dialog-btn-cancel:hover { background: #334155; color: #f1f5f9; }
  .export-dialog-btn-download { background: #818cf8; }
  .export-dialog-btn-download:hover { background: #6366f1; }
  .font-row label { color: #cbd5e1; }
  .font-row span { color: #f1f5f9; }
}
`;
    document.head.appendChild(style);
}

/* =========================================================================
 * INIT
 * ========================================================================= */
function init() {
    injectDialogCSS();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createExportButton);
    } else {
        createExportButton();
    }
}
init();

})();