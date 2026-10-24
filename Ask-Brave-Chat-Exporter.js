// ==UserScript==
// @name         Ask Brave Chat Exporter
// @namespace    http://tampermonkey.net/
// @updateURL    https://raw.githubusercontent.com/abdo2048/Ask-Brave-Chat-Exporter/main/Ask-Brave-Chat-Exporter.js
// @downloadURL  https://raw.githubusercontent.com/abdo2048/Ask-Brave-Chat-Exporter/main/Ask-Brave-Chat-Exporter.js
// @version      1.5.10
// @description  Export Ask Brave conversations to Markdown, HTML, and PDF with Sources, captured shopping results, and saved settings
// @author       abdo2048
// @match        https://search.brave.com/*
// @match        https://safe.search.brave.com/*
// @require      https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function abxMain() {
'use strict';

/* --- ABX guards --- */
(function abxInstallButtonGuard() {
    var BTN = 'brave-export-btn';
    function start() {
        var root = document.documentElement;
        if (!root || root.__abxGuardOn) return;
        root.__abxGuardOn = true;
        function setFont(b) {
            if (!b || b.__abxFontOn) return;
            try {
                var f = getComputedStyle(document.body).fontFamily;
                if (f) b.style.fontFamily = f;
            } catch (e) {}
            b.__abxFontOn = true;
        }
        function moveLive() {
            var b = document.getElementById(BTN);
            if (b && b.parentNode !== root) root.appendChild(b);
            setFont(b);
        }
        new MutationObserver(function (muts) {
            var removed = null;
            muts.forEach(function (m) {
                m.removedNodes.forEach(function (n) {
                    if (removed || n.nodeType !== 1) return;
                    if (n.id === BTN) removed = n;
                    else if (n.querySelector) removed = n.querySelector('#' + BTN);
                });
            });
            if (removed && !document.getElementById(BTN)) {
                setFont(removed);
                root.appendChild(removed);
            } else {
                moveLive();
            }
        }).observe(root, { childList: true, subtree: true });
        moveLive();
    }
    if (document.documentElement) start();
    else document.addEventListener('readystatechange', start, { once: true });
})();

(function abxDetectSandbox() {
    try { var p = window.fetch; window.fetch = p; return; } catch (e) {}
    console.warn('[ABX] Greasemonkey detected. API capture is disabled on this page'
        + ' (Brave CSP blocks the required eval). Clipboard-write capture is active.'
        + ' For full features install Tampermonkey or Violentmonkey.');
    function showBanner() {
        var el = document.createElement('div');
        el.setAttribute('role', 'alert');
        el.style.position = 'fixed';
        el.style.top = '16px';
        el.style.left = '50%';
        el.style.transform = 'translateX(-50%)';
        el.style.maxWidth = '560px';
        el.style.width = 'calc(100% - 32px)';
        el.style.padding = '12px 40px 12px 16px';
        el.style.background = '#dc2626';
        el.style.color = '#fff';
        el.style.borderRadius = '8px';
        el.style.font = '14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif';
        el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
        el.style.zIndex = '2147483647';
        el.innerHTML = '<strong>Greasemonkey: limited mode.</strong> '
            + 'API capture is disabled - clipboard/DOM fallback active. '
            + 'Install <b>Tampermonkey</b> or <b>Violentmonkey</b> for full features.';
        var closeBtn = document.createElement('button');
        closeBtn.textContent = 'X';
        closeBtn.setAttribute('aria-label', 'Dismiss');
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '6px';
        closeBtn.style.right = '8px';
        closeBtn.style.background = 'transparent';
        closeBtn.style.border = '0';
        closeBtn.style.color = '#fff';
        closeBtn.style.fontSize = '18px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.addEventListener('click', function () { el.remove(); });
        el.appendChild(closeBtn);
        document.body.appendChild(el);
        setTimeout(function () { if (el.parentNode) el.remove(); }, 12000);
    }
    if (document.body) showBanner();
    else document.addEventListener('DOMContentLoaded', showBanner, { once: true });
})();


/* global marked, hljs */

/* =========================================================================
 * CONFIG
 * ========================================================================= */
const CONFIG = {
    SCRIPT_VERSION: '1.5.10',
    COPY_DELAY: 200,
    MAX_TITLE_LENGTH: 40,
    EXPORT_MODE: 'auto',
    INCLUDE_RESOURCES: 'cited',
    FONT_KEY: 'abx_font_settings_v1',
    SOURCES_IN_PRINT_KEY: 'abx_sources_in_print_v1',
    SHOPPING_IN_PRINT_KEY: 'abx_shopping_in_print_v1',
    PDF_PROFILE_KEY: 'abx_pdf_profile_v1',
    EXPORT_FORMATS_KEY: 'abx_export_formats_v1'
};

const DEFAULT_FONT_SETTINGS = {
    base: 16,
    questionScale: 1.0,
    answerScale: 1.0,
    headingScale: 1.0,
    codeScale: 1.0
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
        headingScale:  s.headingScale  != null ? s.headingScale  : DEFAULT_FONT_SETTINGS.headingScale,
        codeScale:     s.codeScale     != null ? s.codeScale     : DEFAULT_FONT_SETTINGS.codeScale
    };
}
function loadPdfProfile() {
    try { return localStorage.getItem(CONFIG.PDF_PROFILE_KEY) === 'printing' ? 'printing' : 'reading'; }
    catch (e) { return 'reading'; }
}
function savePdfProfile(profile) {
    if (profile !== 'reading' && profile !== 'printing') return;
    try { localStorage.setItem(CONFIG.PDF_PROFILE_KEY, profile); } catch (e) {}
}
function loadExportFormats() {
    const defaults = { markdown: true, html: true, pdf: false };
    try {
        const raw = localStorage.getItem(CONFIG.EXPORT_FORMATS_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (!saved || typeof saved !== 'object') return defaults;
        return {
            markdown: typeof saved.markdown === 'boolean' ? saved.markdown : defaults.markdown,
            html: typeof saved.html === 'boolean' ? saved.html : defaults.html,
            pdf: typeof saved.pdf === 'boolean' ? saved.pdf : defaults.pdf
        };
    } catch (e) { return defaults; }
}
function saveExportFormats(formats) {
    const saved = {
        markdown: !!(formats && formats.markdown),
        html: !!(formats && formats.html),
        pdf: !!(formats && formats.pdf)
    };
    try { localStorage.setItem(CONFIG.EXPORT_FORMATS_KEY, JSON.stringify(saved)); } catch (e) {}
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
function loadShoppingInPrint() {
    try { return localStorage.getItem(CONFIG.SHOPPING_IN_PRINT_KEY) === '1'; } catch (e) { return false; }
}
function saveShoppingInPrint(v) {
    try { localStorage.setItem(CONFIG.SHOPPING_IN_PRINT_KEY, v ? '1' : '0'); } catch (e) {}
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
const __ABX_SHOPPING_CAPTURE = {
    bySignature: new Map(),
    byQuery: new Map(),
    orphans: new Map(),
    seen: new Set(),
    inflight: new Set()
};
let __ABX_LAST_EXPORT_DIAGNOSTICS = null;

/* --- Conversation selection --- */
function abxRelevantConversations() {
    const convs = __ABX.convs;
    const first = extractDomQuestions()[0] || '';
    const id = new URLSearchParams(location.search).get('conversation');
    return Object.entries(convs).filter(([key, conv]) => {
        if (!conv || !Array.isArray(conv.turns) || key === '__unknown__') return false;
        if (id && key === id) return true;
        if (first && key === 'live:' + first) return true;
        const firstKnown = conv.turns.map(t => abxNormQuestion(t.question)).find(Boolean);
        return !!first && firstKnown === first;
    }).map(([, conv]) => conv);
}


const __ABX_CLIP = window.__ABX_clipboardCapture = { text: null, at: 0 };
let __ABX_NATIVE_CLIPBOARD_WRITE_TEXT = null;

/* --- Clipboard WRITE tap (Firefox has no user activation for readText) --- */
(function patchClipboardWriters() {
    try {
        const clip = navigator.clipboard;
        if (clip) {
            const ow = clip.writeText;
            if (typeof ow === 'function') {
                __ABX_NATIVE_CLIPBOARD_WRITE_TEXT = ow;
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


/* ABX-PATCH:question-guard */
/* True only when BOTH questions are known and clearly different (prefix-tolerant). */
function abxQuestionMismatch(apiQ, domQ) {
    var a = abxNormQuestion(apiQ);
    var d = abxNormQuestion(domQ);
    if (!a || !d) return false;
    return !(a === d || d.indexOf(a) === 0 || a.indexOf(d) === 0);
}


/* ABX-PATCH:live-keying */
/* --- Live-stream keying: /stream URLs carry no conversation id, so a live
   answer is filed under "live:<first question of this chat>" at the absolute
   turn position (question bubbles - 1), instead of one shared __unknown__ bucket. --- */
function abxLiveCtx() {
    var bubbles = document.querySelectorAll('.message.user .user-bubble');
    var n = bubbles.length;
    var first = n ? abxNormQuestion(bubbles[0].textContent) : '';
    var last = n ? abxNormQuestion(bubbles[n - 1].textContent) : '';
    return {
        convId: first ? 'live:' + first : '__unknown__',
        index: n ? n - 1 : 0,
        question: last || null,
        live: true
    };
}
/* Re-resolve at response time (the new bubble is surely rendered by then) and
   clear the target turn so a re-stream replaces the answer instead of appending. */
function abxRefreshLiveCtx(ctx) {
    if (!ctx || !ctx.live) return;
    var r = abxLiveCtx();
    ctx.convId = r.convId;
    ctx.index = r.index;
    ctx.question = r.question;
    var conv = __ABX.convs[ctx.convId];
    var t = conv && conv.turns.find(function (x) { return x.index === ctx.index; });
    if (t) {
        if (t.answerMd && t.answerMd.trim()) {
            const previous = Object.assign({}, t);
            delete previous.abxVersions;
            t.abxVersions = (t.abxVersions || []).concat([previous]);
        }
        t.answerMd = '';
        t.citationsById = {};
        t.augmentations = [];
        t.shoppingBlocks = [];
        t.ragUrls = [];
        t.ragQueries = [];
        t.followups = [];
        t.usage = null;
        t.sawText = false;
    }
}

/* ABX-VISIBLE-VERSION-PATCH v1 */
// Only whitespace normalization: never strip punctuation, links or formatting
// when deciding whether citations belong to the copied answer.
function abxAnswerKey(value) {
    return String(value == null ? '' : value).replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim();
}
function abxVisibleCandidates(question) {
    const q = abxNormQuestion(question);
    if (!q) return [];
    const result = [];
    abxRelevantConversations().forEach(conv => {
        if (!conv || Date.now() - conv.updatedAt > 12 * 60 * 60 * 1000) return;
        (conv.turns || []).forEach(turn => {
            [turn].concat(turn.abxVersions || []).forEach(candidate => {
                if (abxNormQuestion(candidate.question) === q && candidate.answerMd && candidate.answerMd.trim()) {
                    result.push(candidate);
                }
            });
        });
    });
    return result;
}
function abxMatchVisibleAnswer(question, answer) {
    const key = abxAnswerKey(answer);
    if (!key) return null;
    const matches = abxVisibleCandidates(question).filter(t => abxAnswerKey(t.answerMd) === key);
    if (!matches.length) return null;
    // Identical answer text with different citation sets is ambiguous. Do not
    // guess which source set is active; copy text without API citations instead.
    const signature = t => JSON.stringify(Object.keys(t.citationsById || {}).sort());
    if (new Set(matches.map(signature)).size !== 1) return null;
    return matches[0];
}

function abxShoppingCandidateSignature(turn) {
    const blocks = Array.isArray(turn && turn.shoppingBlocks) ? turn.shoppingBlocks : [];
    return JSON.stringify(blocks.map(block => ({
        query: String(block && block.query || ''),
        offset: Number(block && block.offset),
        results: Array.isArray(block && block.results) ? block.results : null
    })));
}
function abxMatchVisibleShopping(question, answer) {
    const key = abxAnswerKey(answer);
    if (!key) return null;
    const matches = abxVisibleCandidates(question).filter(turn => abxAnswerKey(turn.answerMd) === key);
    if (!matches.length) return null;
    /* Identical prose in two captures can still have different product sets. */
    if (new Set(matches.map(abxShoppingCandidateSignature)).size !== 1) return null;
    return matches[0];
}
function abxRawOffsetForKeyOffset(value, keyOffset) {
    const text = String(value == null ? '' : value);
    const target = Math.max(0, Math.floor(Number(keyOffset) || 0));
    if (!target) return text.length - text.trimStart().length;
    let normalized = 0;
    let i = 0;
    let started = false;
    while (i < text.length) {
        if (/\s/.test(text[i])) {
            while (i < text.length && /\s/.test(text[i])) i++;
            if (started && i < text.length) {
                normalized++;
                if (normalized >= target) return i;
            }
        } else {
            i++;
            normalized++;
            started = true;
            if (normalized >= target) return i;
        }
    }
    return text.length;
}
function abxProjectShoppingBlocks(sourceText, targetText, blocks) {
    const source = String(sourceText == null ? '' : sourceText);
    const target = String(targetText == null ? '' : targetText);
    if (abxAnswerKey(source) !== abxAnswerKey(target) || !Array.isArray(blocks)) return [];
    const projected = [];
    blocks.forEach((block, order) => {
        if (!block || !Array.isArray(block.results)) return;
        const rawOffset = Number(block.offset);
        if (!Number.isFinite(rawOffset)) return;
        const safeOffset = Math.max(0, Math.min(source.length, Math.floor(rawOffset)));
        const keyOffset = abxAnswerKey(source.slice(0, safeOffset)).length;
        const targetOffset = source === target
            ? safeOffset
            : Math.max(0, Math.min(target.length, abxRawOffsetForKeyOffset(target, keyOffset)));
        projected.push({ query: String(block.query || ''), offset: targetOffset, results: block.results, order });
    });
    projected.sort((a, b) => a.offset - b.offset || a.order - b.order);
    return projected.map(block => ({ query: block.query, offset: block.offset, results: block.results }));
}
async function abxBuildVisibleConversation(mode) {
    const searchAtStart = location.search;
    const questions = extractDomQuestions();
    const answers = await copyAIAnswers();
    await abxWaitForShoppingRunTools(5000);
    if (location.search !== searchAtStart || JSON.stringify(extractDomQuestions()) !== JSON.stringify(questions)) {
        throw new Error('The conversation changed during capture. Stay on one conversation and export again.');
    }
    const conversation = [];
    const sources = [];
    let answerCount = 0, matchedCount = 0;
    questions.forEach((question, i) => {
        conversation.push({ type: 'user', content: question, index: i + 1 });
        const answer = answers[i] || '';
        if (!answer.trim()) return;
        answerCount++;
        const match = answers.abxCopied && answers.abxCopied[i] ? abxMatchVisibleAnswer(question, answer) : null;
        const shoppingMatch = abxMatchVisibleShopping(question, answer);
        if (match) matchedCount++;
        const assistantContent = match && mode !== 'clipboard' ? match.answerMd.trim() : answer;
        const shoppingBlocks = shoppingMatch
            ? abxProjectShoppingBlocks(shoppingMatch.answerMd, assistantContent, shoppingMatch.shoppingBlocks)
            : [];
        const assistantMessage = { type: 'assistant', content: assistantContent, index: i + 1 };
        if (shoppingBlocks.length) assistantMessage.shoppingBlocks = shoppingBlocks;
        conversation.push(assistantMessage);
        if (match && Object.keys(match.citationsById || {}).length) {
            sources.push({ index: i + 1, citations: Object.values(match.citationsById || {}),
                augmentations: match.augmentations || [], ragUrls: match.ragUrls || [] });
        }
    });
    if (mode === 'api' && matchedCount !== answerCount) {
        throw new Error('API only: not every visible answer could be verified against captured Brave data. Switch to Auto to keep the answers shown and include cited Sources only for verified matches.');
    }
    if (sources.length) conversation.sourcesByTurn = sources;
    conversation.apiTurnCount = matchedCount;
    return { conversation, usedMode: mode !== 'clipboard' && answerCount > 0 && matchedCount === answerCount ? 'api' : 'clipboard' };
}

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
            shoppingBlocks: [],
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

/* --- Shopping result capture: join passive /run_tool responses to answer-position events. --- */
function abxShoppingQueryKey(convId, query) {
    return JSON.stringify([String(convId || ''), String(query || '')]);
}
function abxShoppingCorrelationKey(query, signature, nonce) {
    if (!signature) return '';
    return JSON.stringify([String(query || ''), String(signature), String(nonce || '')]);
}
function abxShoppingAddRef(map, key, ref) {
    if (!key) return;
    const refs = map.get(key) || [];
    if (refs.indexOf(ref) === -1) refs.push(ref);
    map.set(key, refs);
}
function abxShoppingRemoveRef(map, key, ref) {
    if (!key) return;
    const refs = map.get(key);
    if (!refs) return;
    const kept = refs.filter(item => item !== ref);
    if (kept.length) map.set(key, kept);
    else map.delete(key);
}
function abxShoppingRefMatchesRequest(ref, info) {
    if (!ref || !info || ref.query !== info.query) return false;
    if (ref.eventConversationId && info.convId && ref.eventConversationId !== info.convId) return false;
    if (ref.convId && ref.convId.indexOf('live:') !== 0 && info.convId && ref.convId !== info.convId) return false;
    /* Live stream buckets have a synthetic local key. Only bridge them through the
       signed tool-use conversation id, never through the event's top-level conversation field. */
    if (ref.convId && ref.convId.indexOf('live:') === 0 && info.convId && !ref.eventConversationId) return false;
    return true;
}
function abxShoppingForgetOrphan(key, orphan) {
    const list = __ABX_SHOPPING_CAPTURE.orphans.get(key);
    if (!list) return;
    const kept = list.filter(item => item !== orphan && item.expiresAt > Date.now());
    if (kept.length) __ABX_SHOPPING_CAPTURE.orphans.set(key, kept);
    else __ABX_SHOPPING_CAPTURE.orphans.delete(key);
}
function abxShoppingSetResults(ref, results) {
    if (!ref || !ref.block || ref.block.resultsCaptured || !Array.isArray(results)) return false;
    ref.block.results = results.slice();
    ref.block.resultsCaptured = true;
    abxShoppingRemoveRef(__ABX_SHOPPING_CAPTURE.byQuery, ref.queryKey, ref);
    abxShoppingRemoveRef(__ABX_SHOPPING_CAPTURE.bySignature, ref.signatureKey, ref);
    return true;
}
function abxShoppingTryAttachOrphan(ref) {
    if (!ref || !ref.signatureKey) return false;
    const list = __ABX_SHOPPING_CAPTURE.orphans.get(ref.signatureKey) || [];
    const now = Date.now();
    const fresh = list.filter(item => item && item.expiresAt > now);
    if (fresh.length !== list.length) {
        if (fresh.length) __ABX_SHOPPING_CAPTURE.orphans.set(ref.signatureKey, fresh);
        else __ABX_SHOPPING_CAPTURE.orphans.delete(ref.signatureKey);
    }
    const matches = fresh.filter(item => abxShoppingRefMatchesRequest(ref, item.info));
    if (matches.length !== 1) return false;
    const orphan = matches[0];
    const attached = abxShoppingSetResults(ref, orphan.results);
    if (attached) abxShoppingForgetOrphan(ref.signatureKey, orphan);
    return attached;
}
function abxAddShoppingPlaceholder(convId, turn, evt, query) {
    if (!query) return null;
    if (!Array.isArray(turn.shoppingBlocks)) turn.shoppingBlocks = [];
    const tu = evt && evt.tool_use || {};
    const signed = tu.signed_params || {};
    const signature = typeof signed.sig === 'string' ? signed.sig : '';
    const nonce = typeof signed.nonce === 'string' ? signed.nonce : '';
    const signatureKey = abxShoppingCorrelationKey(query, signature, nonce);
    const eventId = tu.id == null ? '' : String(tu.id);
    const seenKey = signatureKey
        ? JSON.stringify([String(convId || ''), String(turn.index), signatureKey])
        : (eventId ? JSON.stringify([String(convId || ''), String(turn.index), eventId, String(query)]) : '');
    if (seenKey && __ABX_SHOPPING_CAPTURE.seen.has(seenKey)) return null;
    if (seenKey) __ABX_SHOPPING_CAPTURE.seen.add(seenKey);

    const block = {
        query: String(query),
        offset: turn.answerMd.length,
        results: null,
        resultsCaptured: false
    };
    const inlineResults = evt && evt.service_response && evt.service_response.results;
    if (Array.isArray(inlineResults)) {
        block.results = inlineResults.slice();
        block.resultsCaptured = true;
    }
    turn.shoppingBlocks.push(block);
    if (block.resultsCaptured) return block;

    const eventConversationId = typeof signed.conversation === 'string' ? signed.conversation : '';
    const queryKey = abxShoppingQueryKey(convId, query);
    const ref = {
        convId: String(convId || ''),
        eventConversationId,
        query: String(query),
        queryKey,
        signatureKey,
        block,
        turn
    };
    abxShoppingAddRef(__ABX_SHOPPING_CAPTURE.byQuery, queryKey, ref);
    if (signatureKey) {
        abxShoppingAddRef(__ABX_SHOPPING_CAPTURE.bySignature, signatureKey, ref);
        abxShoppingTryAttachOrphan(ref);
    }
    return block;
}
function abxShoppingStoreOrphan(info, results, key) {
    if (!key || !Array.isArray(results)) return;
    const list = __ABX_SHOPPING_CAPTURE.orphans.get(key) || [];
    const duplicate = list.some(item => item.info && item.info.convId === info.convId
        && item.info.query === info.query && item.info.signature === info.signature
        && item.info.nonce === info.nonce);
    if (duplicate) return;
    const orphan = {
        info: { convId: info.convId, query: info.query, signature: info.signature, nonce: info.nonce },
        results: results.slice(),
        expiresAt: Date.now() + 120000
    };
    list.push(orphan);
    __ABX_SHOPPING_CAPTURE.orphans.set(key, list);
    setTimeout(() => abxShoppingForgetOrphan(key, orphan), 120000);
}
function abxAttachShoppingResults(info, results) {
    if (!info || !Array.isArray(results)) return false;
    const signatureKey = abxShoppingCorrelationKey(info.query, info.signature, info.nonce);
    const queryKey = abxShoppingQueryKey(info.convId, info.query);
    const signedRefs = signatureKey
        ? (__ABX_SHOPPING_CAPTURE.bySignature.get(signatureKey) || [])
            .filter(ref => !ref.block.resultsCaptured && abxShoppingRefMatchesRequest(ref, info))
        : [];
    if (signedRefs.length === 1) return abxShoppingSetResults(signedRefs[0], results);
    if (signedRefs.length > 1) return false;

    /* A strict query fallback is allowed only when exactly one unresolved block
       exists for this conversation/query. Repeated identical queries stay unpaired. */
    const queryRefs = (__ABX_SHOPPING_CAPTURE.byQuery.get(queryKey) || [])
        .filter(ref => !ref.block.resultsCaptured && abxShoppingRefMatchesRequest(ref, info));
    if (queryRefs.length === 1) return abxShoppingSetResults(queryRefs[0], results);
    if (signatureKey) abxShoppingStoreOrphan(info, results, signatureKey);
    return false;
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
    if (ctx && ctx.question && !turn.question) turn.question = ctx.question;
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

        case 'augment_with_shopping': {
            const q = typeof evt.query === 'string' ? evt.query : '';
            turn.augmentations.push({ type: 'augment_with_shopping', query: q });
            abxAddShoppingPlaceholder(convId, turn, evt, q);
            break;
        }

        case 'augment_with_news':
        case 'augment_with_discussions':
        case 'augment_with_videos':
        case 'augment_with_web':
        case 'augment_with_images':
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

/* --- Passive shopping /run_tool response capture. No request is issued or altered. --- */
function abxIsRunToolEndpoint(url) {
    try {
        const base = window.location && window.location.href || 'https://search.brave.com/ask';
        const target = new URL(String(url || ''), base);
        const origin = window.location && window.location.origin || 'https://search.brave.com';
        return target.origin === origin && target.pathname === '/api/tap/v1/run_tool';
    } catch (e) { return false; }
}
function abxReadFetchRequestBody(input, init) {
    if (init && typeof init.body === 'string') return Promise.resolve(init.body);
    if ((!init || init.body == null) && input && typeof input.clone === 'function') {
        try { return input.clone().text().catch(() => null); } catch (e) {}
    }
    return Promise.resolve(null);
}
function abxParseShoppingRequestInfo(url, body) {
    let payload = null;
    try {
        if (body && typeof body === 'object') payload = body;
        else if (typeof body === 'string' && body) payload = JSON.parse(body);
    } catch (e) { return null; }
    if (payload && payload.data && typeof payload.data === 'object') payload = payload.data;
    if (!payload || payload.name !== 'augment_with_shopping') return null;

    const args = payload.arguments && typeof payload.arguments === 'object' ? payload.arguments : {};
    const signed = payload.signed_params && typeof payload.signed_params === 'object' ? payload.signed_params : {};
    const argumentQuery = typeof args.q === 'string' ? args.q : '';
    const signedQuery = typeof signed.q === 'string' ? signed.q : '';
    if (argumentQuery && signedQuery && argumentQuery !== signedQuery) return null;
    const query = argumentQuery || signedQuery;
    if (!query) return null;

    let urlConversation = '';
    try {
        const base = window.location && window.location.href || 'https://search.brave.com/ask';
        urlConversation = new URL(String(url || ''), base).searchParams.get('live_conversation') || '';
    } catch (e) {}
    const signedConversation = typeof signed.conversation === 'string' ? signed.conversation : '';
    if (urlConversation && signedConversation && urlConversation !== signedConversation) return null;
    const convId = signedConversation || urlConversation;
    if (!convId) return null;

    return {
        name: 'augment_with_shopping',
        convId,
        query,
        signature: typeof signed.sig === 'string' ? signed.sig : '',
        nonce: typeof signed.nonce === 'string' ? signed.nonce : ''
    };
}
function abxCaptureRunToolResponse(info, data) {
    if (!info || info.name !== 'augment_with_shopping') return false;
    const payload = data && data.data !== undefined ? data.data : data;
    const events = Array.isArray(payload) ? payload : (payload && typeof payload === 'object' ? [payload] : []);
    const matches = events.filter(evt => evt && evt.type === 'augment_with_shopping' && evt.query === info.query);
    if (matches.length !== 1) return false;
    const service = matches[0].service_response || {};
    if (service.type && service.type !== 'shopping') return false;
    if (!Array.isArray(service.results)) return false;
    return abxAttachShoppingResults(info, service.results);
}
function abxBeginRunToolRequest(infoPromise) {
    let finish;
    const entry = {
        done: false,
        infoPromise: Promise.resolve(infoPromise).catch(() => null),
        donePromise: new Promise(resolve => { finish = resolve; }),
        finish: null
    };
    entry.finish = finish;
    __ABX_SHOPPING_CAPTURE.inflight.add(entry);
    return entry;
}
function abxFinishRunToolRequest(entry) {
    if (!entry || entry.done) return;
    entry.done = true;
    __ABX_SHOPPING_CAPTURE.inflight.delete(entry);
    try { entry.finish(); } catch (e) {}
}
function abxWaitWithTimeout(promise, timeoutMs) {
    const limit = Math.max(0, Number(timeoutMs) || 0);
    return new Promise(resolve => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve(null);
        }, limit);
        Promise.resolve(promise).then(value => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        }, () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(null);
        });
    });
}
async function abxWaitForShoppingRunTools(timeoutMs) {
    const entries = Array.from(__ABX_SHOPPING_CAPTURE.inflight);
    if (!entries.length) return;
    const limit = Math.max(0, Number(timeoutMs) || 5000);
    const deadline = Date.now() + limit;
    const infos = await abxWaitWithTimeout(Promise.all(entries.map(entry => entry.infoPromise)), limit);
    if (!infos) return;
    const relevant = entries.filter((entry, index) => infos[index] && infos[index].name === 'augment_with_shopping');
    if (!relevant.length) return;
    const remaining = Math.max(0, deadline - Date.now());
    if (remaining) await abxWaitWithTimeout(Promise.all(relevant.map(entry => entry.donePromise)), remaining);
}

/* --- fetch wrapper --- */
const origFetch = window.fetch.bind(window);
var __abxFetchWrapper = function (input, init) {
    const url = (typeof input === 'string') ? input : (input && input.url) || '';
    const isStream = url.indexOf('/api/tap/v1/stream') !== -1;
    const isState  = url.indexOf('/api/tap/v1/get_current_state') !== -1;
    const isRunTool = abxIsRunToolEndpoint(url);

    if (!isStream && !isState && !isRunTool) {
        return arguments.length >= 2 ? origFetch(input, init) : origFetch(input);
    }

    const runToolInfoPromise = isRunTool
        ? abxReadFetchRequestBody(input, init).then(body => abxParseShoppingRequestInfo(url, body)).catch(() => null)
        : Promise.resolve(null);
    const runToolTicket = isRunTool ? abxBeginRunToolRequest(runToolInfoPromise) : null;

    let ctx = null;
    if (isStream) {
        const m = url.match(/[?&]id=([a-f0-9]+)/i);
        if (m) {
            const conv = __ABX.convs[m[1]];
            ctx = { convId: m[1], index: conv ? conv.turns.length : 0 };
        } else {
            ctx = abxLiveCtx();
        }
    }

    const promise = arguments.length >= 2 ? origFetch(input, init) : origFetch(input);

    return promise.then(function (res) {
        try {
            abxRefreshLiveCtx(ctx);
            if (isRunTool) {
                Promise.resolve(runToolInfoPromise)
                    .then(info => {
                        if (!info) return null;
                        return res.clone().json().then(data => {
                            abxCaptureRunToolResponse(info, data);
                        });
                    })
                    .catch(() => {})
                    .then(() => abxFinishRunToolRequest(runToolTicket));
                return res;
            }
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
        } catch (e) {
            abxFinishRunToolRequest(runToolTicket);
        }
        return res;
    }, function (error) {
        abxFinishRunToolRequest(runToolTicket);
        throw error;
    });
};

try { window.fetch = __abxFetchWrapper; }
catch (e) { console.warn('[ABX] fetch wrapper not installable here.'); }

/* --- XHR backup --- */
const OrigXHR = window.XMLHttpRequest;
function PatchedXHR() {
    const xhr = new OrigXHR();
    let _url = '';
    let _runToolInfo = null;
    let _runToolTicket = null;
    const oo = xhr.open;
    xhr.open = function (m, u) {
        _url = u || '';
        return oo.apply(xhr, arguments);
    };
    const os = xhr.send;
    xhr.send = function (body) {
        if (abxIsRunToolEndpoint(_url)) {
            _runToolInfo = abxParseShoppingRequestInfo(_url, body);
            if (_runToolInfo) _runToolTicket = abxBeginRunToolRequest(Promise.resolve(_runToolInfo));
        }
        try { return os.apply(xhr, arguments); }
        catch (error) { abxFinishRunToolRequest(_runToolTicket); throw error; }
    };
    xhr.addEventListener('load', function () {
        try {
            if (_url.indexOf('/api/tap/v1/stream') !== -1 && xhr.responseText) {
                const m = _url.match(/[?&]id=([a-f0-9]+)/i);
                let xctx;
                if (m) {
                    const conv = __ABX.convs[m[1]];
                    xctx = { convId: m[1], index: conv ? conv.turns.length : 0 };
                } else {
                    xctx = abxLiveCtx();
                    abxRefreshLiveCtx(xctx);
                }
                abxParseStream(xhr.responseText, xctx);
            } else if (_url.indexOf('get_current_state') !== -1) {
                abxHandleState(_url, JSON.parse(xhr.responseText));
            } else if (_runToolInfo && xhr.responseText) {
                abxCaptureRunToolResponse(_runToolInfo, JSON.parse(xhr.responseText));
            }
        } catch (e) {}
    });
    xhr.addEventListener('loadend', function () {
        abxFinishRunToolRequest(_runToolTicket);
    });
    return xhr;
}
PatchedXHR.prototype = OrigXHR.prototype;
try { window.XMLHttpRequest = PatchedXHR; }
catch (e) { console.warn('[ABX] XHR wrapper not installable here.'); }

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
        // abxNormQuestion strips Brave's "Show more" affordance. It is a UI
        // control, not part of the question. Truncation itself is only
        // visual (.user-bubble-text is line-clamped), so textContent already
        // holds the full question.
        .map(function (e) { return abxNormQuestion(e.textContent); })
        .filter(function (t) { return t; });
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
    // Legacy synchronous entry point cannot verify selected answer versions.
    return null;
}
    /* Attach API-captured sources (citations / augmentations / ragUrls) to a
   conversation whose content came from the clipboard. Matches by turn index
   using the same recent-window rule as buildConversationFromApiState. */
function attachApiSources(conversation) {
    if (!conversation || !Array.isArray(conversation)) return;
    const sources = [];
    const questions = new Map(conversation.filter(m => m.type === 'user').map(m => [m.index, m.content]));
    conversation.filter(m => m.type === 'assistant').forEach(m => {
        const match = abxMatchVisibleAnswer(questions.get(m.index), m.content);
        if (match && Object.keys(match.citationsById || {}).length) sources.push({ index: m.index,
            citations: Object.values(match.citationsById), augmentations: match.augmentations || [], ragUrls: match.ragUrls || [] });
    });
    conversation.sourcesByTurn = sources;
}

/* =========================================================================
 * SHARED HELPERS
 * ========================================================================= */

/* Append a node to <head>/<body>, falling back to <html>, and retrying once
   the document grows one. At @run-at document-start NONE of them may exist
   yet, and an unguarded document.head.appendChild() used to throw and abort
   init() — which could prevent the Export button from appearing. appendChild on an already-attached node moves it, so
   retries can never duplicate. */
function abxAppendToDoc(node, preferHead) {
    function attempt() {
        var parent = preferHead ? (document.head || document.documentElement)
                                : (document.body || document.documentElement);
        if (!parent) return false;
        parent.appendChild(node);
        return true;
    }
    if (attempt()) return;
    var done = false;
    function retry() { if (!done && attempt()) done = true; }
    document.addEventListener('readystatechange', retry);
    document.addEventListener('DOMContentLoaded', function () { retry(); }, { once: true });
}

/* The ONE question normaliser. extractDomQuestions() used to strip Brave's
   "Show more" affordance while abxRelevantConversations() did not, so the two
   disagreed and the exact-equality match against the API question failed —
   silently discarding captured answers. */
function abxNormQuestion(v) {
    return String(v == null ? '' : v)
        .replace(/\s+Show more\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/* Rendered inline HTML -> plain text. Must run BEFORE entity decoding so a
   decoded '&lt;' cannot be mistaken for a tag. */
function abxHtmlToText(html) {
    return String(html == null ? '' : html)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&#x0*27;/gi, "'")
        .replace(/&nbsp;/g, ' ');
}

/* The ONE slug function. The heading renderer and the TOC used to run two
   different algorithms, so any heading ending in ) ? : . — or containing
   `code`/`**bold**` — got an id the TOC could not link to, and the scrollspy
   silently dropping it. */
function abxSlug(text) {
    var s = String(text == null ? '' : text).toLowerCase()
        .replace(/[^\w\s-]/g, ' ')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return s || 'section';
}

/* Heading ids recorded while marked renders, so the TOC reuses the very same
   ids instead of recomputing them. Populated by the heading renderer and
   consumed by generateTOCHTML(); reset at the top of generateHTML(). */
var __abxTocHeadings = [];
var __abxSlugSeen = Object.create(null);
var __abxCurMsgIdx = -1;

function abxResetSlugs() {
    __abxTocHeadings = [];
    __abxSlugSeen = Object.create(null);
    __abxCurMsgIdx = -1;
}

function abxUniqueSlug(text) {
    var base = abxSlug(text), s = base, n = 2;
    while (__abxSlugSeen[s]) { s = base + '-' + n; n++; }
    __abxSlugSeen[s] = true;
    return s;
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
    abxAppendToDoc(btn, false);
}

/* =========================================================================
 * EXPORT DIALOG
 * ========================================================================= */
function truncateTitle(text, max) {
    if (!text) return '';
    return text.length <= max ? text : text.substring(0, max).trim() + '...';
}

/* --- Local-only Copy diagnostics. Only the allowlisted settings, category, elapsed time, and counts leave this function. --- */
function abxSafeDiagnosticMode(value) {
    return ['auto', 'api', 'clipboard'].indexOf(value) !== -1 ? value : 'auto';
}
function abxSafeDiagnosticProfile(value) {
    return value === 'reading' || value === 'printing' ? value : 'not-selected';
}
function abxSafeDiagnosticCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.min(1000000000, Math.floor(number)) : 0;
}
function abxEmptyDiagnosticCounts() {
    return { questions: 0, visibleAnswers: 0, matches: 0, citations: 0, shoppingBlocks: 0, shoppingItems: 0 };
}
function abxBeginExportDiagnostics(settings) {
    const picked = settings && typeof settings === 'object' ? settings : {};
    const formats = picked.formats && typeof picked.formats === 'object' ? picked.formats : {};
    const selectedFormats = { markdown: !!formats.markdown, html: !!formats.html, pdf: !!formats.pdf };
    const attempt = {
        startedAt: Date.now(),
        mode: abxSafeDiagnosticMode(picked.mode),
        formats: selectedFormats,
        pdfProfile: selectedFormats.pdf ? abxSafeDiagnosticProfile(picked.pdfProfile) : 'not-selected',
        failureCategory: 'in-progress',
        elapsedMs: null,
        counts: abxEmptyDiagnosticCounts()
    };
    __ABX_LAST_EXPORT_DIAGNOSTICS = attempt;
    return attempt;
}
function abxUpdateExportDiagnostics(attempt, conversation) {
    if (!attempt || !Array.isArray(conversation)) return;
    const users = conversation.filter(message => message && message.type === 'user');
    const assistants = conversation.filter(message => message && message.type === 'assistant');
    const sources = Array.isArray(conversation.sourcesByTurn) ? conversation.sourcesByTurn : [];
    const blocks = assistants.reduce((all, message) => all.concat(Array.isArray(message.shoppingBlocks) ? message.shoppingBlocks : []), []);
    const availableBlocks = blocks.filter(block => block && Array.isArray(block.results));
    attempt.counts = {
        questions: users.length,
        visibleAnswers: assistants.length,
        matches: abxSafeDiagnosticCount(conversation.apiTurnCount),
        citations: sources.reduce((sum, source) => sum + (Array.isArray(source && source.citations) ? source.citations.length : 0), 0),
        shoppingBlocks: availableBlocks.length,
        shoppingItems: availableBlocks.reduce((sum, block) => sum + block.results.length, 0)
    };
}
function abxFinishExportDiagnostics(attempt, category) {
    if (!attempt) return;
    const allowed = ['none', 'answer-capture', 'markdown-export', 'html-export', 'pdf-preview', 'unexpected'];
    attempt.failureCategory = allowed.indexOf(category) !== -1 ? category : 'unexpected';
    attempt.elapsedMs = abxSafeDiagnosticCount(Date.now() - attempt.startedAt);
}
function abxBuildDiagnosticsReport(selection) {
    const picked = selection && typeof selection === 'object' ? selection : {};
    const formats = picked.formats && typeof picked.formats === 'object' ? picked.formats : {};
    const selectedFormats = {
        markdown: !!formats.markdown,
        html: !!formats.html,
        pdf: !!formats.pdf
    };
    const last = __ABX_LAST_EXPORT_DIAGNOSTICS;
    const storedCounts = last && last.counts && typeof last.counts === 'object' ? last.counts : {};
    const report = {
        scriptVersion: CONFIG.SCRIPT_VERSION,
        selectedMode: abxSafeDiagnosticMode(picked.mode),
        selectedFormats,
        selectedPdfProfile: selectedFormats.pdf ? abxSafeDiagnosticProfile(picked.pdfProfile) : 'not-selected',
        lastAttempt: {
            mode: last ? abxSafeDiagnosticMode(last.mode) : 'not-run',
            formats: last && last.formats ? {
                markdown: !!last.formats.markdown,
                html: !!last.formats.html,
                pdf: !!last.formats.pdf
            } : { markdown: false, html: false, pdf: false },
            pdfProfile: last && last.formats && last.formats.pdf ? abxSafeDiagnosticProfile(last.pdfProfile) : 'not-selected',
            failureCategory: last && ['in-progress', 'none', 'answer-capture', 'markdown-export', 'html-export', 'pdf-preview', 'unexpected'].indexOf(last.failureCategory) !== -1
                ? last.failureCategory : 'not-run',
            elapsedMs: last && Number.isFinite(Number(last.elapsedMs)) ? abxSafeDiagnosticCount(last.elapsedMs) : null,
            counts: {
                questions: abxSafeDiagnosticCount(storedCounts.questions),
                visibleAnswers: abxSafeDiagnosticCount(storedCounts.visibleAnswers),
                matches: abxSafeDiagnosticCount(storedCounts.matches),
                citations: abxSafeDiagnosticCount(storedCounts.citations),
                shoppingBlocks: abxSafeDiagnosticCount(storedCounts.shoppingBlocks),
                shoppingItems: abxSafeDiagnosticCount(storedCounts.shoppingItems)
            }
        }
    };
    return JSON.stringify(report, null, 2);
}
function abxReadDiagnosticsSelection(dialog) {
    const selectedMode = dialog && dialog.querySelector('input[name="export-mode"]:checked');
    const markdown = dialog && dialog.querySelector('#export-markdown');
    const html = dialog && dialog.querySelector('#export-html');
    const pdf = dialog && dialog.querySelector('#export-pdf');
    const profile = dialog && dialog.querySelector('input[name="pdf-profile"]:checked');
    return {
        mode: selectedMode ? selectedMode.value : 'auto',
        formats: { markdown: !!(markdown && markdown.checked), html: !!(html && html.checked), pdf: !!(pdf && pdf.checked) },
        pdfProfile: profile ? profile.value : loadPdfProfile()
    };
}
async function abxCopyDiagnosticsReport(reportText) {
    const text = String(reportText || '');
    try {
        const clipboard = navigator.clipboard;
        if (clipboard && typeof __ABX_NATIVE_CLIPBOARD_WRITE_TEXT === 'function') {
            await __ABX_NATIVE_CLIPBOARD_WRITE_TEXT.call(clipboard, text);
            return true;
        }
    } catch (e) {}
    let textarea = null;
    try {
        textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('aria-hidden', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-10000px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        return !!document.execCommand('copy');
    } catch (e) {
        return false;
    } finally {
        if (textarea && textarea.parentNode) textarea.parentNode.removeChild(textarea);
    }
}
function showDiagnosticsPreview(selection) {
    const report = abxBuildDiagnosticsReport(selection);
    const overlay = document.createElement('div');
    overlay.className = 'export-dialog-wrapper abx-diagnostics-preview';
    overlay.setAttribute('data-abx-local-only', 'true');

    const panel = document.createElement('div');
    panel.className = 'export-dialog-content abx-diagnostics-content';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'abx-diagnostics-title');

    const heading = document.createElement('h2');
    heading.id = 'abx-diagnostics-title';
    heading.textContent = 'Copy diagnostics';
    const intro = document.createElement('p');
    intro.className = 'export-dialog-hint';
    intro.textContent = 'Generated locally in this tab. Nothing is sent. Review the allowlisted settings, coarse failure category, elapsed time, and counts below.';
    const preview = document.createElement('pre');
    preview.className = 'abx-diagnostics-report';
    preview.textContent = report;
    const warning = document.createElement('p');
    warning.className = 'abx-diagnostics-warning';
    warning.textContent = 'Copying this report will replace whatever is currently on your clipboard.';
    const status = document.createElement('p');
    status.className = 'export-dialog-hint';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const actions = document.createElement('div');
    actions.className = 'export-dialog-buttons abx-diagnostics-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'export-dialog-btn export-dialog-btn-cancel';
    cancel.textContent = 'Cancel';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.id = 'copy-diagnostics-confirm';
    copy.className = 'export-dialog-btn export-dialog-btn-download';
    copy.textContent = 'Copy report';

    actions.appendChild(cancel);
    actions.appendChild(copy);
    panel.appendChild(heading);
    panel.appendChild(intro);
    panel.appendChild(preview);
    panel.appendChild(warning);
    panel.appendChild(status);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    overlay.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    copy.addEventListener('click', async () => {
        copy.disabled = true;
        const copied = await abxCopyDiagnosticsReport(report);
        if (copied) {
            status.textContent = 'Copied. Your clipboard was replaced. Nothing was sent.';
            copy.textContent = 'Copied';
        } else {
            status.textContent = 'Copy failed. No data was sent.';
            copy.disabled = false;
        }
    });
    copy.focus();
    return overlay;
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

    const relevant = abxRelevantConversations();
    let coveredTurns = 0;
    try {
        coveredTurns = relevant.reduce((sum, c) => sum + (c.turns || []).filter(t => t.answerMd && t.answerMd.trim()).length, 0);
    } catch (e) { coveredTurns = 0; }
    let sourceStatus;
    if (CONFIG.EXPORT_MODE === 'clipboard') {
        sourceStatus = 'Clipboard capture uses the answers shown. Sources need a verified match.';
    } else if (coveredTurns > 0) {
        sourceStatus = 'Captured answer data: ' + coveredTurns + ' records. Auto uses it only when an answer matches.';
    } else {
        sourceStatus = 'No captured answer data. Auto still exports visible answers; Sources need a verified match.';
    }

    let shoppingStatus = 'No shopping results captured for this conversation.';
    try {
        let itemCount = 0;
        let pendingBlock = false;
        const now = Date.now();
        relevant.forEach(conv => {
            const updatedAt = Number(conv && conv.updatedAt);
            if (!conv || !Array.isArray(conv.turns) || !Number.isFinite(updatedAt) || now - updatedAt > 12 * 60 * 60 * 1000) return;
            conv.turns.forEach(turn => {
                (Array.isArray(turn.shoppingBlocks) ? turn.shoppingBlocks : []).forEach(block => {
                    if (Array.isArray(block && block.results)) itemCount += block.results.length;
                    else pendingBlock = true;
                });
            });
        });
        if (itemCount > 0) shoppingStatus = itemCount + (itemCount === 1 ? ' shopping result captured.' : ' shopping results captured.');
        else if (pendingBlock) shoppingStatus = 'Shopping results still loading.';
    } catch (e) {}

    const fs = getDisplayFontSettings();
    const formatPrefs = loadExportFormats();

    const dialog = document.createElement('div');
    dialog.id = 'brave-export-dialog';
    dialog.className = 'export-dialog-wrapper';
    dialog.innerHTML = `
    <div class="export-dialog-content export-dialog-main-content" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
        <div class="export-dialog-main-scroll">
        <h2 id="export-dialog-title">Export conversation</h2>

        <div class="export-dialog-status" role="status" aria-live="polite">${sourceStatus}<span id="shopping-capture-status" class="export-dialog-shopping-status">${shoppingStatus}</span></div>

        <div class="export-dialog-field">
            <label class="export-dialog-label" for="export-title">Title</label>
            <input type="text" id="export-title" class="export-dialog-input" value="" placeholder="${defaultTitle}">
        </div>

        <fieldset class="export-dialog-group" aria-labelledby="export-formats-label">
            <legend id="export-formats-label">Export formats</legend>
            <div class="export-dialog-formats">
                <label class="export-dialog-option export-dialog-option--format" for="export-markdown" title="Download Markdown.">
                    <input type="checkbox" id="export-markdown" ${formatPrefs.markdown ? 'checked' : ''}><span>Markdown</span>
                </label>
                <label class="export-dialog-option export-dialog-option--format" for="export-html" title="Download a standalone HTML file.">
                    <input type="checkbox" id="export-html" ${formatPrefs.html ? 'checked' : ''}><span>HTML</span>
                </label>
                <label class="export-dialog-option export-dialog-option--format" for="export-pdf" title="Choose a PDF style and open the print preview.">
                    <input type="checkbox" id="export-pdf" aria-controls="pdf-profile-group" aria-expanded="${formatPrefs.pdf ? 'true' : 'false'}" ${formatPrefs.pdf ? 'checked' : ''}><span>PDF</span>
                </label>
            </div>
            <div id="pdf-profile-group" class="export-dialog-pdf-profile" role="group" aria-labelledby="pdf-profile-label" aria-describedby="pdf-profile-help" hidden>
                <div id="pdf-profile-label" class="export-dialog-label">PDF style</div>
                <div class="export-dialog-profile-options" role="radiogroup" aria-labelledby="pdf-profile-label" aria-describedby="pdf-profile-help">
                    <label class="export-dialog-option export-dialog-option--profile" for="pdf-profile-reading" title="Keep the HTML-like reader look, available Sources, and captured shopping.">
                        <input type="radio" id="pdf-profile-reading" name="pdf-profile" value="reading" ${loadPdfProfile() === 'reading' ? 'checked' : ''}>
                        <span class="export-dialog-profile-copy"><strong>Reading</strong><small>HTML-like look · Sources + shopping</small></span>
                    </label>
                    <label class="export-dialog-option export-dialog-option--profile" for="pdf-profile-printing" title="Use smaller text and hide Sources and shopping for paper.">
                        <input type="radio" id="pdf-profile-printing" name="pdf-profile" value="printing" ${loadPdfProfile() === 'printing' ? 'checked' : ''}>
                        <span class="export-dialog-profile-copy"><strong>Print-friendly</strong><small>Smaller type · hides Sources + shopping</small></span>
                    </label>
                </div>
                <p id="pdf-profile-help" class="export-dialog-hint">Opens the browser print preview. Choose Save as PDF. Turn on Background graphics to keep color fills.</p>
            </div>
            <div id="html-print-options" class="export-dialog-html-print" role="group" aria-labelledby="html-print-label" aria-describedby="html-print-help" hidden>
                <div id="html-print-label" class="export-dialog-label">HTML print options</div>
                <label class="export-dialog-option export-dialog-option--sources" for="sources-in-print">
                    <input type="checkbox" id="sources-in-print" ${loadSourcesInPrint() ? 'checked' : ''}>
                    <span>Include Sources</span>
                </label>
                <label class="export-dialog-option export-dialog-option--sources" for="shopping-in-print">
                    <input type="checkbox" id="shopping-in-print" ${loadShoppingInPrint() ? 'checked' : ''}>
                    <span>Include shopping results</span>
                </label>
                <p id="html-print-help" class="export-dialog-hint">For Ctrl+P from the downloaded HTML only—not its screen view or PDF. Shopping appears only when matching results were captured.</p>
            </div>
        </fieldset>

        <details id="capture-method-block" class="export-dialog-field" aria-labelledby="capture-method-label" aria-describedby="capture-method-help capture-method-note">
            <summary id="capture-method-label" class="export-dialog-summary" title="Choose how answers are captured.">Capture method</summary>
            <div class="export-dialog-segmented" role="radiogroup" aria-labelledby="capture-method-label">
                <label class="export-dialog-option" title="Uses the answer shown. Sources require a verified match.">
                    <input type="radio" name="export-mode" value="auto" checked><span>Auto</span>
                </label>
                <label class="export-dialog-option" title="Requires every answer to match captured data; otherwise export stops.">
                    <input type="radio" name="export-mode" value="api"><span>API only</span>
                </label>
                <label class="export-dialog-option" title="Uses Brave’s Copy buttons. Sources require a verified match.">
                    <input type="radio" name="export-mode" value="clipboard"><span>Clipboard only</span>
                </label>
            </div>
            <p id="capture-method-help" class="export-dialog-hint" aria-live="polite">Auto uses the answer shown. Sources appear only for verified matches.</p>
            <p id="capture-method-note" class="export-dialog-hint">Brave’s Copy buttons may change your clipboard. Longer chats take longer to check.</p>
        </details>

        <details id="font-settings-block" class="export-dialog-field">
            <summary class="export-dialog-summary" title="Adjust base, question, answer, heading, and code sizes; settings are saved.">
                ⚙️ Font size
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
            <div class="font-row">
                <label for="font-code">Code</label>
                <input type="range" id="font-code" min="0.7" max="1.5" step="0.05" value="${fs.codeScale}">
                <span id="font-code-val">${fs.codeScale.toFixed(2)}×</span>
            </div>
            <button type="button" id="font-reset-btn" class="export-dialog-btn export-dialog-btn-cancel export-dialog-btn-small">Reset to defaults</button>
        </details>

        <div class="export-dialog-diagnostics" aria-labelledby="diagnostics-option-title">
            <div id="diagnostics-option-title" class="export-dialog-label">Optional Copy diagnostics</div>
            <p class="export-dialog-hint">The report is generated locally and is never sent. It contains only the script version, selected settings, a coarse failure category, elapsed time, and counts.</p>
            <button type="button" id="review-diagnostics-btn" class="export-dialog-btn export-dialog-btn-cancel export-dialog-btn-small">Review diagnostics</button>
        </div>

        <div class="export-dialog-note">
            <span>Need something? </span>
            <a href="https://github.com/abdo2048/Ask-Brave-Chat-Exporter" target="_blank" rel="noopener" class="export-dialog-link">Visit GitHub repo</a>
        </div>

        </div>

        <div class="export-dialog-buttons">
            <button type="button" id="export-cancel-btn" class="export-dialog-btn export-dialog-btn-cancel">Cancel</button>
            <button type="button" id="export-download-btn" class="export-dialog-btn export-dialog-btn-download">Export selected formats</button>
        </div>
    </div>`;

    document.body.appendChild(dialog);

    const diagnosticsReviewButton = dialog.querySelector('#review-diagnostics-btn');
    if (diagnosticsReviewButton) diagnosticsReviewButton.addEventListener('click', () => {
        showDiagnosticsPreview(abxReadDiagnosticsSelection(dialog));
    });

    const captureMethodHelp = dialog.querySelector('#capture-method-help');
    const captureMethodHelpText = {
        auto: 'Uses the answer shown. Sources appear only for verified matches.',
        api: 'Every answer must match captured data, or export stops.',
        clipboard: 'Uses Brave’s Copy buttons. Sources require a verified match.'
    };
    const updateCaptureMethodHelp = () => {
        const selected = dialog.querySelector('input[name="export-mode"]:checked');
        if (captureMethodHelp) captureMethodHelp.textContent = captureMethodHelpText[selected ? selected.value : 'auto'];
    };
    dialog.querySelectorAll('input[name="export-mode"]').forEach(input => {
        input.addEventListener('change', updateCaptureMethodHelp);
    });
    updateCaptureMethodHelp();

    const persistFormatPreferences = () => saveExportFormats({
        markdown: document.getElementById('export-markdown').checked,
        html: document.getElementById('export-html').checked,
        pdf: document.getElementById('export-pdf').checked
    });
    ['export-markdown', 'export-html', 'export-pdf'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.addEventListener('change', persistFormatPreferences);
    });

    const htmlCheckbox = document.getElementById('export-html');
    const htmlPrintOptions = document.getElementById('html-print-options');
    const syncHtmlPrintVisibility = () => {
        if (htmlPrintOptions) htmlPrintOptions.hidden = !(htmlCheckbox && htmlCheckbox.checked);
    };
    if (htmlCheckbox) htmlCheckbox.addEventListener('change', syncHtmlPrintVisibility);
    syncHtmlPrintVisibility();

    const shoppingPrintCheckbox = document.getElementById('shopping-in-print');
    if (shoppingPrintCheckbox) shoppingPrintCheckbox.addEventListener('change', () => saveShoppingInPrint(shoppingPrintCheckbox.checked));

    const pdfCheckbox = document.getElementById('export-pdf');
    const pdfProfileGroup = document.getElementById('pdf-profile-group');
    const mainScroll = dialog.querySelector('.export-dialog-main-scroll');
    const scrollPdfStyleIntoView = () => {
        if (!mainScroll || !pdfProfileGroup) return;
        requestAnimationFrame(() => {
            const view = mainScroll.getBoundingClientRect();
            const group = pdfProfileGroup.getBoundingClientRect();
            let delta = 0;
            if (group.bottom > view.bottom) delta = group.bottom - view.bottom + 8;
            else if (group.top < view.top) delta = group.top - view.top - 8;
            if (!delta) return;
            let reduceMotion = false;
            try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
            mainScroll.scrollTo({ top: Math.max(0, mainScroll.scrollTop + delta), behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    };
    const syncPdfProfileVisibility = (reveal) => {
        const visible = !!(pdfCheckbox && pdfCheckbox.checked);
        if (pdfProfileGroup) pdfProfileGroup.hidden = !visible;
        if (pdfCheckbox) pdfCheckbox.setAttribute('aria-expanded', String(visible));
        if (visible && reveal) scrollPdfStyleIntoView();
    };
    if (pdfCheckbox) pdfCheckbox.addEventListener('change', () => syncPdfProfileVisibility(true));
    document.querySelectorAll('input[name="pdf-profile"]').forEach(radio => {
        radio.addEventListener('change', () => { if (radio.checked) savePdfProfile(radio.value); });
    });
    syncPdfProfileVisibility(!!(pdfCheckbox && pdfCheckbox.checked));

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
    bindRange('font-code', 'codeScale', true);

    document.getElementById('font-reset-btn').addEventListener('click', () => {
        saveFontSettings({});
        ['font-base','font-question','font-answer','font-heading','font-code'].forEach((id, i) => {
            const key = ['base','questionScale','answerScale','headingScale','codeScale'][i];
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

    const getDialogSettings = () => {
        const titleInput = document.getElementById('export-title').value.trim();
        const modeEl = document.querySelector('input[name="export-mode"]:checked');
        const pdfProfileEl = document.querySelector('input[name="pdf-profile"]:checked');
        const sourcesCheckbox = document.getElementById('sources-in-print');
        const sourcesInPrint = !!(sourcesCheckbox && sourcesCheckbox.checked);
        saveSourcesInPrint(sourcesInPrint);
        const shoppingCheckbox = document.getElementById('shopping-in-print');
        const shoppingInPrint = !!(shoppingCheckbox && shoppingCheckbox.checked);
        saveShoppingInPrint(shoppingInPrint);
        const pdfProfile = pdfProfileEl ? pdfProfileEl.value : loadPdfProfile();
        savePdfProfile(pdfProfile);
        saveExportFormats({
            markdown: document.getElementById('export-markdown').checked,
            html: document.getElementById('export-html').checked,
            pdf: document.getElementById('export-pdf').checked
        });
        return {
            title: titleInput || defaultTitle,
            chosenMode: modeEl ? modeEl.value : 'auto',
            sourcesInPrint: sourcesInPrint,
            shoppingInPrint: shoppingInPrint,
            pdfProfile: pdfProfile
        };
    };

    document.getElementById('export-download-btn').onclick = function () {
        const exportMd = document.getElementById('export-markdown').checked;
        const exportHtml = document.getElementById('export-html').checked;
        const exportPdf = document.getElementById('export-pdf').checked;
        if (!exportMd && !exportHtml && !exportPdf) {
            alert('Select at least one format: Markdown, HTML, or PDF.');
            return;
        }
        const settings = getDialogSettings();
        let printWindow = null;
        if (exportPdf) {
            try { printWindow = window.open('about:blank', '_blank'); } catch (e) {}
            if (!printWindow) {
                alert('The PDF preview was blocked. Allow pop-ups for search.brave.com, then try again.');
                return;
            }
        }
        closeDialog();
        startExport(settings.title, exportMd, exportHtml, settings.chosenMode,
            settings.sourcesInPrint, exportPdf ? settings.pdfProfile : null, printWindow, settings.pdfProfile, settings.shoppingInPrint);
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
/* Make an inert, isolated print document. Loading it as a Blob gives #anchors
   the print document's own URL, so PDF links become internal destinations rather
   than links back to the Brave chat URL. The iframe sandbox and CSP still deny
   scripts, forms, nested frames, objects, and network connections from content. */
function prepareSandboxedPrintHTML(html) {
    const policy = "default-src 'none'; img-src https: data:; font-src https: data:; style-src 'unsafe-inline' https:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src 'none'; frame-src 'none'";
    const csp = '<meta http-equiv="Content-Security-Policy" content="' + policy + '">';
    let safeHTML = String(html || '').replace(/<head([^>]*)>/i, '<head$1>' + csp);
    // A raw answer can contain hostile document-level navigation directives.
    safeHTML = safeHTML.replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])?refresh\1[^>]*>/gi, '');
    return safeHTML;
}

function printHTMLInPopup(printWindow, html) {
    return new Promise((resolve, reject) => {
        if (!printWindow || printWindow.closed) { resolve(); return; }
        let frame = null;
        let previewBlobUrl = null;
        let timeoutId = null;
        let settled = false;
        const revokePreviewURL = () => {
            if (!previewBlobUrl) return;
            try { URL.revokeObjectURL(previewBlobUrl); } catch (e) {}
            previewBlobUrl = null;
        };
        const finish = (error) => {
            if (settled) return;
            settled = true;
            if (timeoutId !== null) clearTimeout(timeoutId);
            if (frame) frame.removeEventListener('load', onFrameLoad);
            if (error) reject(error); else resolve();
        };
        const closePreview = () => {
            try { if (printWindow && !printWindow.closed) printWindow.close(); } catch (e) {}
            setTimeout(revokePreviewURL, 0);
            finish();
        };
        const onPopupPageHide = () => {
            revokePreviewURL();
            finish();
        };
        const onFrameLoad = () => {
            if (settled || !frame || !previewBlobUrl) return;
            try {
                const previewWindow = frame.contentWindow;
                const doc = frame.contentDocument;
                if (!previewWindow || previewWindow.location.href !== previewBlobUrl) return;
                if (!doc || !doc.body || !doc.querySelector('.container')) {
                    finish(new Error('The PDF preview could not load its isolated print document.'));
                    return;
                }
                frame.style.visibility = 'visible';
                const status = printWindow.document.getElementById('abx-print-status');
                const closeButton = printWindow.document.getElementById('abx-print-close');
                if (status) status.style.display = 'none';
                if (closeButton) closeButton.addEventListener('click', closePreview);
                const fontsReady = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
                if (doc.title) printWindow.document.title = doc.title;
                const fontTimeout = new Promise(resolveFonts => setTimeout(resolveFonts, 1800));
                Promise.race([Promise.resolve(fontsReady).catch(() => {}), fontTimeout]).then(() => {
                    if (settled || printWindow.closed) return;
                    try {
                        /* Keep an explicit close control available independently of
                           afterprint timing; Save and Cancel both leave the preview open. */
                        if (closeButton) closeButton.style.display = 'block';
                        printWindow.focus();
                        previewWindow.focus();
                        if (typeof previewWindow.print !== 'function') {
                            throw new Error('The PDF preview is ready but printing is unavailable.');
                        }
                        previewWindow.print();
                        finish();
                    } catch (err) {
                        finish(err);
                    }
                });
            } catch (err) {
                finish(err);
            }
        };
        try {
            const outer = printWindow.document;
            outer.open();
            outer.write('<!doctype html><html><head><meta charset="utf-8"><title>Preparing PDF preview…</title>' +
                '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff;font:15px/1.5 system-ui,sans-serif;color:#334155}#abx-print-status{position:fixed;inset:0;display:grid;place-items:center}#abx-print-frame{position:fixed;inset:0;width:100%;height:100%;border:0;background:#fff;visibility:hidden}#abx-print-close{display:none;position:fixed;right:14px;top:14px;z-index:5;padding:9px 14px;border:1px solid #cbd5e1;border-radius:7px;background:#fff;color:#0f172a;font:600 14px/1.2 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(15,23,42,.16)}#abx-print-close:focus-visible{outline:3px solid #4f46e5;outline-offset:2px}@media print{#abx-print-status,#abx-print-close{display:none!important}}</style>' +
                '</head><body><div id="abx-print-status" role="status">Preparing PDF preview…</div>' +
                '<button type="button" id="abx-print-close" aria-label="Close PDF preview">Close preview</button>' +
                '<iframe id="abx-print-frame" title="PDF print preview" sandbox="allow-same-origin allow-modals"></iframe></body></html>');
            outer.close();
            frame = outer.getElementById('abx-print-frame');
            if (!frame) { finish(new Error('Could not create the PDF preview frame.')); return; }
            printWindow.addEventListener('pagehide', onPopupPageHide, { once: true });
            const printableHTML = prepareSandboxedPrintHTML(html);
            previewBlobUrl = 'about:srcdoc';
            frame.addEventListener('load', onFrameLoad);
            timeoutId = setTimeout(() => finish(new Error('The PDF preview did not finish loading.')), 20000);
            const isFF = /Firefox\//.test(navigator.userAgent);
            frame.srcdoc = isFF
              ? printableHTML.replace(/(<a\b[^>]*?\shref=")#/g, '$1about:srcdoc#')
              : printableHTML;
        } catch (err) {
            finish(err);
        }
    });
}

/* =========================================================================
 * EXPORT FLOW
 * ========================================================================= */
async function startExport(title, exportMd, exportHtml, modeOverride, sourcesInPrint, pdfMode, printWindow, selectedPdfProfile, shoppingInPrint) {
    showOverlay();
    const mode = modeOverride || CONFIG.EXPORT_MODE || 'auto';
    const diagnosticAttempt = abxBeginExportDiagnostics({
        mode,
        formats: { markdown: !!exportMd, html: !!exportHtml, pdf: !!pdfMode },
        pdfProfile: selectedPdfProfile || pdfMode || 'not-selected'
    });
    let failureCategory = 'answer-capture';
    try {
        updateOverlay('Capturing visible answers and verifying API sources...');
        const captured = await abxBuildVisibleConversation(mode);
        const conversation = captured.conversation;
        const usedMode = captured.usedMode;
        abxUpdateExportDiagnostics(diagnosticAttempt, conversation);

        const chatUrl = getCurrentChatURL();

        if (exportMd) {
            failureCategory = 'markdown-export';
            updateOverlay('Generating Markdown...');
            const md = generateMarkdown(title, conversation, usedMode, chatUrl);
            downloadFile(md, sanitizeFilename(title) + '.md', 'text/markdown');
        }
        if (exportHtml) {
            failureCategory = 'html-export';
            updateOverlay('Generating HTML...');
            const html = generateHTML(title, conversation, usedMode, sourcesInPrint, { chatUrl: chatUrl, shoppingInPrint: shoppingInPrint });
            if (html) downloadFile(html, sanitizeFilename(title) + '.html', 'text/html');
        }
        if (pdfMode) {
            failureCategory = 'pdf-preview';
            updateOverlay(pdfMode === 'reading' ? 'Preparing reading PDF preview...' : 'Preparing print PDF preview...');
            const pdfHTML = generateHTML(title, conversation, usedMode, sourcesInPrint, { pdfMode: pdfMode, chatUrl: chatUrl });
            if (!pdfHTML) throw new Error('PDF preview HTML could not be generated.');
            await printHTMLInPopup(printWindow, pdfHTML);
        }

        updateOverlay(pdfMode ? 'Print dialog ready.' : 'Export complete! ✓');
        await sleep(pdfMode ? 300 : 900);
        hideOverlay();
        abxFinishExportDiagnostics(diagnosticAttempt, 'none');
    } catch (err) {
        abxFinishExportDiagnostics(diagnosticAttempt, failureCategory);
        console.error('Export failed:', err);
        if (printWindow && !printWindow.closed) printWindow.close();
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
    "Copy",
    "Copiar",
    "Kopieren",
    "Copia",
    "Copie",
    "Kopiëren",
    "复制",
    "複製",
    "コピー",
    "복사",
    "Скопировать",
    "Скопіювати",
    "نسخ",
    "Kopiyala",
    "Salin",
    "Copier",
    "Kopírovat",
    "Copïo",
    "Kopier",
    "Kopeeri",
    "Kopirajte",
    "Kopēt",
    "Kopijuoti",
    "Másolás",
    "Kopiuj",
    "Kopjoje",
    "Skopírovať",
    "Kopioi",
    "Kopiera",
    "Sao chép",
    "Kopyala",
    "Αντιγραφή",
    "Копиране",
    "Копираj",
    "Копіювати",
    "დაკოპირება",
    "คัดลอก",
    "Копирај",
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
    answers.abxCopied = [];
    const rounds = Array.from(document.querySelectorAll('.tap-round'))
        .filter(tr => tr.querySelector('.message.user .user-bubble'));
    for (const tr of rounds) {
        const assistantNodes = Array.from(tr.querySelectorAll('.message.assistant'));
        if (!assistantNodes.length) { answers.push(''); answers.abxCopied.push(false); continue; }
        const button = findCopyButton(tr, 'assistant');
        let text = await clickAndCapture(button);
        const copied = text !== null && !!String(text).trim();
        if (!copied) {
            const segments = assistantNodes.map(ans => {
                const clone = ans.cloneNode(true);
                clone.querySelectorAll('button, [role="toolbar"], .enrichment-carousel-button-left, .enrichment-carousel-button-right, .header-button, .enrichment-button, .logo-row-button').forEach(el => el.remove());
                return (clone.textContent || '').trim();
            }).filter(Boolean);
            text = segments.join('\n\n');
        }
        answers.push(String(text || '').trim());
        answers.abxCopied.push(copied);
    }
    if (answers.length !== extractDomQuestions().length) {
        throw new Error('Question/answer layout could not be aligned safely. No export was created.');
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
function getCurrentChatURL() {
    try {
        const url = new URL(window.location.href);
        if (url.protocol !== 'https:' || url.hostname !== 'search.brave.com' || !url.pathname.startsWith('/ask')) return '';
        return url.href; // Keep the entire query and symmetric-key fragment.
    } catch (e) { return ''; }
}

function abxShoppingHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const url = new URL(value.trim().replace(/&amp;/gi, '&'));
        return (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : '';
    } catch (e) { return ''; }
}
function abxShoppingText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}
function abxEscapeShoppingMarkdown(value) {
    return abxShoppingText(value)
        .replace(/\\/g, '\\\\')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\|/g, '\\|');
}
function abxShoppingMarkdownLink(label, url) {
    const safeUrl = abxShoppingHttpUrl(url);
    const text = abxEscapeShoppingMarkdown(label);
    if (!safeUrl) return text;
    const destination = safeUrl.replace(/[()|]/g, character => {
        if (character === '(') return '%28';
        if (character === ')') return '%29';
        return '%7C';
    });
    return '[' + text + '](' + destination + ')';
}
function abxShoppingOfferLabel(offer) {
    const currency = abxShoppingText(offer && offer.priceCurrency).toUpperCase();
    const price = offer && offer.price != null ? abxShoppingText(offer.price) : '';
    if (!price) return '';
    if (currency === 'USD') return 'US$' + price;
    return currency ? currency + ' ' + price : price;
}
function abxShoppingPriceKey(value) {
    const raw = abxShoppingText(value);
    if (!raw) return '';
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? 'number:' + String(numeric) : 'text:' + raw;
}
function abxShoppingUrlKey(value) {
    const safeUrl = abxShoppingHttpUrl(value);
    if (!safeUrl) return '';
    try {
        const url = new URL(safeUrl);
        const hostname = url.hostname.replace(/^www\./i, '').toLowerCase();
        const port = url.port ? ':' + url.port : '';
        return url.protocol + '//' + hostname + port + url.pathname + url.search + url.hash;
    } catch (e) { return ''; }
}
function abxShoppingHasWww(value) {
    const safeUrl = abxShoppingHttpUrl(value);
    if (!safeUrl) return false;
    try { return /^www\./i.test(new URL(safeUrl).hostname); }
    catch (e) { return false; }
}
function abxShoppingIsGenericListingUrl(value) {
    const safeUrl = abxShoppingHttpUrl(value);
    if (!safeUrl) return false;
    try {
        const url = new URL(safeUrl);
        const path = url.pathname.toLowerCase();
        if (/(?:^|\/)(?:products?|items?|dp|itm|sku)(?:\/|$)/.test(path)) return false;
        if (/(?:^|\/)(?:category|categories|collection|collections|search|browse|listing|listings)(?:\/|$)/.test(path)) return true;
        if (/\/shop\/(?:all(?:-products|-accessories)?|accessories\/all|categories?|collections?)(?:\/|$)/.test(path)) return true;
        const searchKeys = new Set(['q', 'query', 'search', 'keyword', '_nkw']);
        for (const key of url.searchParams.keys()) {
            if (searchKeys.has(key.toLowerCase())) return true;
        }
        return false;
    } catch (e) { return false; }
}
function abxShoppingChooseProductUrl(item) {
    item = item && typeof item === 'object' ? item : {};
    const product = item.product && typeof item.product === 'object' ? item.product : {};
    const itemUrl = abxShoppingHttpUrl(item.url);
    const productUrl = abxShoppingHttpUrl(product.url);
    if (!itemUrl) return productUrl;
    if (!productUrl) return itemUrl;
    const itemKey = abxShoppingUrlKey(itemUrl);
    const productKey = abxShoppingUrlKey(productUrl);
    if (itemKey && itemKey === productKey) {
        return !abxShoppingHasWww(itemUrl) && abxShoppingHasWww(productUrl) ? productUrl : itemUrl;
    }
    if (abxShoppingIsGenericListingUrl(itemUrl)
        && !abxShoppingIsGenericListingUrl(productUrl)) return productUrl;
    return itemUrl;
}
function abxShoppingDeduplicateResults(results) {
    const source = Array.isArray(results) ? results : [];
    const kept = [];
    const positions = new Map();
    source.forEach((item, index) => {
        const productUrl = abxShoppingPrepareItem(item, index).productUrl;
        const key = abxShoppingUrlKey(productUrl);
        if (!key || !positions.has(key)) {
            if (key) positions.set(key, kept.length);
            kept.push({ item, productUrl });
            return;
        }
        const position = positions.get(key);
        const current = kept[position];
        if (!abxShoppingHasWww(current.productUrl) && abxShoppingHasWww(productUrl)) {
            kept[position] = { item, productUrl };
        }
    });
    return kept.map(record => record.item);
}
function abxShoppingOfferIdentityKey(offer) {
    const rawUrl = abxShoppingText(offer && offer.url);
    const destination = abxShoppingHttpUrl(rawUrl) || rawUrl;
    const price = abxShoppingPriceKey(offer && offer.price);
    const currency = abxShoppingText(offer && offer.priceCurrency).toUpperCase();
    return JSON.stringify([destination, price, currency]);
}
function abxShoppingDeduplicateOffers(offers, primaryOffer) {
    /* The primary price already represents this destination; show only alternate offer URLs. */
    const primaryDestination = abxShoppingUrlKey(primaryOffer && primaryOffer.url);
    const seen = new Set();
    const output = [];
    (Array.isArray(offers) ? offers : []).forEach(offer => {
        const destination = abxShoppingUrlKey(offer && offer.url);
        if (primaryDestination && destination === primaryDestination) return;
        const key = abxShoppingOfferIdentityKey(offer);
        if (seen.has(key)) return;
        seen.add(key);
        output.push(offer);
    });
    return output;
}
function abxShoppingOtherOfferGroups(entry) {
    const item = entry && typeof entry === 'object' ? entry : {};
    const offers = Array.isArray(item.otherOffers) ? item.otherOffers : [];
    const groups = [];
    const byDestination = new Map();
    offers.forEach(offer => {
        const destination = abxShoppingHttpUrl(offer && offer.url);
        if (!destination) {
            groups.push({ destination: '', offers: [offer], sameDestination: false });
            return;
        }
        let group = byDestination.get(destination);
        if (!group) {
            group = { destination, offers: [], sameDestination: false };
            byDestination.set(destination, group);
            groups.push(group);
        }
        group.offers.push(offer);
    });
    return groups.map(group => ({
        destination: group.destination,
        offers: group.offers,
        sameDestination: !!group.destination && group.offers.length > 1
    }));
}

function abxShoppingDomainInfo(item, selectedUrl) {
    const productUrl = abxShoppingHttpUrl(selectedUrl || (item && item.url) || (item && item.product && item.product.url));
    const rawHost = abxShoppingText(item && item.meta_url && item.meta_url.hostname);
    let hostname = '';
    try {
        if (rawHost) {
            const candidate = /^https?:\/\//i.test(rawHost) ? rawHost : 'https://' + rawHost;
            const parsed = new URL(candidate);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') hostname = parsed.hostname;
        }
    } catch (e) {}
    if (!hostname && productUrl) {
        try { hostname = new URL(productUrl).hostname; } catch (e) {}
    }
    let rootUrl = '';
    if (productUrl) {
        try { rootUrl = new URL(productUrl).origin + '/'; } catch (e) {}
    }
    if (!rootUrl && hostname) rootUrl = 'https://' + hostname + '/';
    return { label: hostname.replace(/^www\./i, ''), url: rootUrl };
}
function abxShoppingPrimaryPrice(product, offers) {
    const rawPrice = product && product.price != null ? abxShoppingText(product.price) : '';
    let matchedOfferIndex = -1;
    const numericPrice = rawPrice ? Number(rawPrice) : NaN;
    if (Number.isFinite(numericPrice)) {
        matchedOfferIndex = offers.findIndex(offer => offer && offer.price != null
            && Number.isFinite(Number(offer.price)) && Number(offer.price) === numericPrice);
    }
    /* The bare product.price field can omit currency; display only an offer price/currency. */
    if (matchedOfferIndex < 0) matchedOfferIndex = offers.findIndex(offer => !!abxShoppingOfferLabel(offer));
    if (matchedOfferIndex >= 0) {
        return { label: abxShoppingOfferLabel(offers[matchedOfferIndex]), matchedOfferIndex };
    }
    return { label: '', matchedOfferIndex: -1 };
}
function abxShoppingPrepareItem(item, index) {
    item = item && typeof item === 'object' ? item : {};
    const product = item.product && typeof item.product === 'object' ? item.product : {};
    const productUrl = abxShoppingChooseProductUrl(item);
    const offers = Array.isArray(product.offers) ? product.offers : [];
    const primaryPrice = abxShoppingPrimaryPrice(product, offers);
    const primaryOffer = primaryPrice.matchedOfferIndex >= 0 ? offers[primaryPrice.matchedOfferIndex] : null;
    const otherOffers = abxShoppingDeduplicateOffers(
        offers.filter((offer, offerIndex) => offerIndex !== primaryPrice.matchedOfferIndex), primaryOffer
    );
    return {
        title: abxShoppingText(item.title || product.name || ('Shopping result ' + (index + 1))),
        productUrl,
        domain: abxShoppingDomainInfo(item, productUrl),
        price: primaryPrice.label,
        otherOffers
    };
}
function abxRenderShoppingMarkdown(block) {
    const rawResults = Array.isArray(block && block.results) ? block.results : [];
    const results = abxShoppingDeduplicateResults(rawResults);
    let md = '### Shopping results\n\n';
    if (!results.length) return md + '_No items were returned._\n';
    md += '_Brave-reported prices may be cached and may not match current retailer prices; they are not verified against retailer listings._\n\n';
    md += '| Product | Product | Product |\n| --- | --- | --- |\n';
    for (let rowStart = 0; rowStart < results.length; rowStart += 3) {
        const cells = [];
        for (let column = 0; column < 3; column++) {
            const index = rowStart + column;
            if (index >= results.length) {
                cells.push('');
                continue;
            }
            const entry = abxShoppingPrepareItem(results[index], index);
            const parts = [];
            if (entry.price) parts.push(abxEscapeShoppingMarkdown(entry.price));
            if (entry.domain.label) parts.push(abxEscapeShoppingMarkdown(entry.domain.label));
            parts.push(abxShoppingMarkdownLink(entry.title, entry.productUrl));
            let cell = (index + 1) + '. ' + parts.join(' — ');
            abxShoppingOtherOfferGroups(entry).forEach(group => {
                const prefix = group.sameDestination
                    ? 'Other Brave-reported prices at this alternate destination (not separate verified live offers): '
                    : 'Other Brave-reported offers: ';
                const offers = group.offers.map(offer =>
                    abxShoppingMarkdownLink(abxShoppingOfferLabel(offer) || 'Offer', offer && offer.url));
                cell += ' · ' + prefix + offers.join('; ');
            });
            cells.push(cell);
        }
        md += '| ' + cells.join(' | ') + ' |\n';
    }
    return md + '\n';
}
function abxRenderShoppingHTML(block) {
    const rawResults = Array.isArray(block && block.results) ? block.results : [];
    const results = abxShoppingDeduplicateResults(rawResults);
    let html = '<section class="shopping-block" aria-label="Shopping results">';
    html += '<h3 class="shopping-block-title">Shopping results</h3>';
    if (!results.length) return html + '<p class="shopping-empty">No items were returned.</p></section>';
    html += '<p class="shopping-price-disclaimer">Brave-reported prices may be cached and may not match current retailer prices; they are not verified against retailer listings.</p>';
    const renderLink = (label, url, className) => {
        const text = escapeHtml(label);
        const safeUrl = abxShoppingHttpUrl(url);
        const linkClass = className ? ' class="' + className + '"' : '';
        const textClass = className ? ' class="' + className + '-text"' : '';
        return safeUrl
            ? '<a' + linkClass + ' href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + text + '</a>'
            : '<span' + textClass + '>' + text + '</span>';
    };
    html += '<ol class="shopping-grid" aria-label="Shopping results">';
    results.forEach((item, index) => {
        const entry = abxShoppingPrepareItem(item, index);
        const parts = [];
        if (entry.price) parts.push('<span class="shopping-price">' + escapeHtml(entry.price) + '</span>');
        if (entry.domain.label) parts.push('<span class="shopping-merchant">' + escapeHtml(entry.domain.label) + '</span>');
        parts.push('<span class="shopping-product-title">' + renderLink(entry.title, entry.productUrl, 'shopping-title-link') + '</span>');
        html += '<li class="shopping-item"><article><div class="shopping-item-line"><span class="shopping-number">' + (index + 1) + '.</span> ' + parts.join(' <span class="shopping-separator">—</span> ') + '</div>';
        abxShoppingOtherOfferGroups(entry).forEach(group => {
            const prefix = group.sameDestination
                ? 'Other Brave-reported prices at this alternate destination (not separate verified live offers): '
                : 'Other Brave-reported offers: ';
            html += '<p class="shopping-extra-offers">' + prefix;
            html += group.offers.map(offer => renderLink(
                abxShoppingOfferLabel(offer) || 'Offer', offer && offer.url, 'shopping-offer-link'
            )).join('; ');
            html += '</p>';
        });
        html += '</article></li>';
    });
    return html + '</ol></section>';
}
function abxInsertShoppingBlocks(content, blocks, renderBlock, normalizeMarkdownGap) {
    const text = String(content == null ? '' : content);
    if (!Array.isArray(blocks) || !blocks.length) return text;
    const valid = blocks.map((block, order) => ({ block, order, offset: Number(block && block.offset) }))
        .filter(item => item.block && Array.isArray(item.block.results) && Number.isFinite(item.offset))
        .map(item => ({ block: item.block, order: item.order, offset: Math.max(0, Math.min(text.length, Math.floor(item.offset))) }))
        .sort((a, b) => a.offset - b.offset || a.order - b.order);
    if (!valid.length) return text;
    let output = '';
    let cursor = 0;
    valid.forEach(item => {
        output += text.slice(cursor, item.offset);
        const rendered = String(renderBlock(item.block) || '');
        if (normalizeMarkdownGap) {
            output += '\n\n' + rendered.replace(/\n+$/, '') + '\n\n';
            const followingText = text.slice(item.offset);
            const leadingBlankLines = followingText.match(/^(?:[ \t]*\r?\n)+/);
            cursor = item.offset + (leadingBlankLines ? leadingBlankLines[0].length : 0);
        } else {
            output += '\n\n' + rendered + '\n\n';
            cursor = item.offset;
        }
    });
    return output + text.slice(cursor);
}
function abxMarkdownWithShopping(content, blocks) {
    return abxInsertShoppingBlocks(content, blocks, abxRenderShoppingMarkdown, true);
}
function abxHtmlMarkdownWithShopping(content, blocks) {
    return abxInsertShoppingBlocks(content, blocks, abxRenderShoppingHTML, false);
}

function generateMarkdown(title, conversation, usedMode, chatUrl) {
    const dateStr = formatDate(new Date());
    if (chatUrl === undefined) chatUrl = getCurrentChatURL();
    let md = '';
    md += '---\n';
    md += '**Title:** ' + title + '\n';
    md += '**Exported:** ' + dateStr + '\n';
    md += '**Method:** ' + (usedMode === 'api' ? 'Captured answers verified against what is shown' : 'Answers shown on screen (only verified Sources included)') + '\n';
    if (chatUrl) md += '[Chat URL](' + String(chatUrl).replace(/[()]/g, function (ch) { return ch === '(' ? '%28' : '%29'; }) + ') ↗\n';
    md += '\n---\n\n';

    const sourcesByTurn = {};
    if (Array.isArray(conversation.sourcesByTurn)) {
        conversation.sourcesByTurn.forEach(s => { sourcesByTurn[s.index] = s; });
    }

    let q = 0;
    for (let i = 0; i < conversation.length; i++) {
        const m = conversation[i];
        if (m.type === 'user') {
            q++;
            // S2: Obsidian callout header (works in Obsidian as a styled callout;
// in other readers it's just a blockquote with a "[!question] Q1" line)
const lines = m.content.split('\n');
md += '> [!question] Q' + q + '\n>\n';
for (const line of lines) {
    md += line.length ? '> ' + escapeForMarkdownQuote(line) + '\n' : '>\n';
}
md += '\n';
        } else {
            const shoppingMarkdown = abxMarkdownWithShopping(m.content, m.shoppingBlocks);
            if (Array.isArray(m.shoppingBlocks) && m.shoppingBlocks.some(block => Array.isArray(block && block.results))) {
                md += shoppingMarkdown.replace(/\n+$/, '') + '\n\n';
            } else {
                md += shoppingMarkdown + '\n\n';
            }

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
function buildPrintCSS(userFs, pdfMode) {
    const rawBase = Number(userFs && userFs.base);
    const safeBase = Number.isFinite(rawBase) && rawBase >= 12 && rawBase <= 22 ? rawBase : 16;
    const reading = pdfMode === 'reading';
    const paper = pdfMode === 'printing';
    const printBase = (safeBase * (reading ? 1 : 0.78)).toFixed(2);
    /* The shared code control remains relative to the approved 0.78rem default. */
    const printCodeCorrection = (reading ? 1 : (0.92 / 0.78)).toFixed(8);
    /* Keep the printable sheet white; use profile accents only inside content boxes. */
    const pageBg = reading ? '#f8fafc' : '#ffffff';
    const blockBg = paper ? '#ffffff' : '#E5E9F0';
    const inlineBg = paper ? '#ffffff' : '#E5E9F0';
    const questionBg = paper ? '#ffffff' : '#f1f5f9';
    const tableHeadBg = paper ? '#ffffff' : '#e0e7ff';
    const tableHeadText = paper ? '#0f172a' : '#1e1b4b';
    const tableHeadRule = paper ? '#0f172a' : '#475569';
    const codeBorder = '1px solid #cbd5e1';
    return `
<style id="print-rules">
@page { margin: 0.5in; }
.printed-contents { display: none; }
@media print {
  /* Print is always light; colors are optional accents, never the only cue. */
  :root, :root[data-theme="light"], :root[data-theme="dark"], :root:not([data-theme="light"]) {
    color-scheme: light;
    --bg-body: ${pageBg}; --bg-surface: #ffffff; --bg-sidebar: #ffffff;
    --bg-blockquote-q: ${questionBg}; --bg-blockquote-note: ${paper ? '#ffffff' : '#f8fafc'}; --border-note: #cbd5e1;
    --bg-code-block: ${blockBg}; --bg-code-inline: ${inlineBg};
    --text-code-block: #2E3440; --text-code-inline: #2E3440;
    --text-primary: #0f172a; --text-secondary: #475569;
    --primary: #4f46e5; --primary-hover: #4338ca; --accent: #0C6E7B;
    --text-accent: #4F46E5; --text-on-primary: #ffffff;
    --text-table-head: ${tableHeadText}; --bg-primary-soft: rgba(79,70,229,0.08);
    --border-color: #e2e8f0;
    --code-comment: #586275; --code-keyword: #3B5E85; --code-attribute: #466582;
    --code-function: #0C6E7B; --code-type: #1C7473; --code-string: #51693C;
    --code-number: #7E5A79; --code-name: #9D4E58; --code-operator: #8D563F;
    --code-constant: #7A6012; --code-addition: #51693C; --code-deletion: #9D4E58;
  }

  /* Use platform fonts for standalone HTML printing and Print-friendly PDF.
     Firefox/Cairo ToUnicode mapping can corrupt some glyphs in custom variable fonts;
     Reading opts into the HTML font stack below, with ligatures suppressed. */
  html, body, body * {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    font-variant-ligatures: none !important;
    font-feature-settings: "liga" 0, "clig" 0, "dlig" 0 !important;
    -webkit-print-color-adjust: economy;
    print-color-adjust: economy;
  }
  pre, pre *, code, kbd, samp {
    font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace !important;
    font-variant-ligatures: none !important;
    font-feature-settings: "liga" 0, "clig" 0, "dlig" 0 !important;
  }
  html {
    font-size: ${printBase}px !important;
    background: ${pageBg} !important;
    color: #0f172a !important;
    color-scheme: light !important;
  }
  body {
    background: ${pageBg} !important;
    color: #0f172a !important;
    color-scheme: light !important;
    line-height: 1.38 !important;
  }

  /* Hide interactive-only UI, including both floating TOC controls. */
  .toc-sidebar, .toc-toggle, .toc-toggle--floating, .theme-toggle,
  .mobile-menu-btn, .overlay, .copy-btn, .table-menu-btn,
  .table-dropdown, .separator, .print-tip { display: none !important; }

  /* Compact, Word-style contents: short question labels and nested headings. */
  .printed-contents {
    display: block !important;
    margin: 0 0 0.8rem !important;
    padding: 0 0 0.45rem !important;
    color: #0f172a !important;
    background: transparent !important;
    border: 0 !important;
    border-bottom: 1px solid #cbd5e1 !important;
    border-radius: 0 !important;
    break-after: page;
    page-break-after: always;
  }
  .printed-contents h1 {
    border: 0 !important;
    border-bottom: 1px solid #cbd5e1 !important;
    padding: 0 0 0.3rem !important;
    margin: 0 0 0.45rem !important;
    font-size: 1.25rem !important;
    line-height: 1.2 !important;
    color: #0f172a !important;
  }
  .printed-contents-intro { display: none !important; }
  .printed-contents-list { list-style: none !important; margin: 0 !important; padding: 0 !important; }
  .printed-contents-item {
    display: block;
    margin: 0 !important;
    padding: 0.2rem 0 0.24rem !important;
    background: transparent !important;
    border: 0 !important;
    border-bottom: 1px dotted #cbd5e1 !important;
    border-radius: 0 !important;
    overflow-wrap: anywhere;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .printed-contents-question {
    display: flex;
    align-items: flex-start;
    gap: 0.35rem;
    color: #0f172a !important;
    font-weight: 600;
    line-height: 1.25;
    text-decoration: none !important;
  }
  .printed-contents-number {
    flex: 0 0 auto;
    min-width: 2rem;
    color: #334155 !important;
    font-size: 0.9em;
    font-weight: 700;
  }
  .printed-contents-summary { flex: 1 1 auto; }
  .printed-contents-sections {
    list-style: none !important;
    margin: 0.12rem 0 0.08rem 2.35rem !important;
    padding: 0 0 0 0.58rem !important;
    border-left: 1px solid #94a3b8;
    font-size: 0.86em;
    line-height: 1.22;
  }
  .printed-contents-sections li { margin: 0.1rem 0 !important; break-inside: avoid; page-break-inside: avoid; }
  .printed-contents-sections a {
    color: #334155 !important;
    text-decoration: underline !important;
    text-underline-offset: 0.1em;
  }

  /* Flatten the screen grid; remove the card border that became page-edge rails. */
  .container { display: block !important; }
  .main-content { padding: 0 !important; max-width: 100% !important; }
  .header {
    padding: 0.3rem 0 0.55rem !important;
    margin: 0 0 0.45rem !important;
    background: transparent !important;
    box-shadow: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    outline: 0 !important;
    text-align: center !important;
  }
  .header h1 {
    background: none !important;
    background-image: none !important;
    background-clip: border-box !important;
    -webkit-background-clip: border-box !important;
    -webkit-text-fill-color: #0f172a !important;
    color: #0f172a !important;
    text-shadow: none !important;
    filter: none !important;
    margin: 0 !important;
  }
  .header .meta { display: none !important; }
  .header .chat-url { display: none !important; }
  .content {
    padding: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    outline: 0 !important;
  }

  /* A heading followed by a table is a print unit. This wrapper lets Firefox
     keep the heading with the first table fragment; oversized tables may split. */
  .table-heading-group {
    display: block !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
  .table-heading-group > :is(h1,h2,h3,h4) { break-after: avoid-page; page-break-after: avoid; }
  .table-heading-group > :is(h1,h2,h3,h4) + :is(table,.table-outer) { break-before: avoid-page; page-break-before: avoid; }
  .table-heading-group > .table-outer { margin: 0 !important; break-inside: auto !important; page-break-inside: auto !important; }

  /* Question labels and the left rule remain clear even when backgrounds are off. */
  .question {
    margin: 0.6rem 0 0.42rem !important;
    break-inside: avoid;
    page-break-inside: avoid;
    break-after: avoid-page;
    page-break-after: avoid;
  }
  .question blockquote {
    background: ${questionBg} !important;
    border-left: 5px solid #4f46e5 !important;
    padding: 0.68rem 1rem !important;
    margin: 0 !important;
    border-radius: 4px !important;
    box-shadow: none !important;
    color: #0f172a !important;
  }
  .question strong {
    color: #3730a3 !important;
    font-size: 1rem !important;
    margin-bottom: 0.14rem !important;
  }
  .question pre.question-text {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    font-size: var(--text-scale-question) !important;
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    color: #0f172a !important;
    font-weight: 600 !important;
    line-height: 1.32 !important;
  }

  /* Print type follows the saved Base and role multipliers. */
  .answer { page-break-inside: auto; }
  .answer p { margin-bottom: 1.1rem !important; }
  h1, h2, h3, h4 { break-after: avoid-page; page-break-after: avoid; }

  /* Repeat table headings; keep each row and the first table fragment readable. */
  .table-wrapper {
    overflow: visible !important;
    box-shadow: none !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
  table {
    width: 100% !important;
    table-layout: fixed !important;
    border-left: 0 !important;
    border-right: 0 !important;
    /* Multi-page tables must fragment; avoid-break belongs on rows, not the table. */
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
  table th, table td { overflow-wrap: anywhere; word-break: break-word; }
  thead {
    display: table-header-group !important;
    background: ${tableHeadBg} !important;
    color: ${tableHeadText} !important;
    border-bottom: 1px solid ${tableHeadRule} !important;
    break-after: avoid-page;
    page-break-after: avoid;
    break-inside: avoid-page;
    page-break-inside: avoid;
  }
  thead th {
    background: ${tableHeadBg} !important;
    color: ${tableHeadText} !important;
    border-bottom: 1px solid ${tableHeadRule} !important;
    font-weight: 600 !important;
    -webkit-print-color-adjust: economy;
    print-color-adjust: economy;
  }
  thead th strong { font-weight: inherit !important; }
  tbody { break-before: avoid-page; page-break-before: avoid; }
  tbody tr:first-child { break-before: avoid-page; page-break-before: avoid; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  tbody td {
    color: #0f172a !important;
    -webkit-print-color-adjust: economy;
    print-color-adjust: economy;
  }

  /* Keep code labels and panels together; Chromium otherwise splits short blocks at page edges. */
  .code-heading-group {
    display: block !important;
    break-inside: avoid-page !important;
    page-break-inside: avoid !important;
  }
  .code-heading-group > pre { margin: 0 !important; }

  /* Keep every code panel atomic; the caption wrapper also keeps its short label attached. */
  .answer pre:not(.question-text) { break-inside: avoid-page; page-break-inside: avoid; }

  /* Nord Light stays legible on either Nord5 or white; outlines survive ink-saving. */
  pre {
    background: ${blockBg} !important;
    border: ${codeBorder} !important;
    font-size: calc(var(--text-scale-code) * ${printCodeCorrection}) !important;
    color: #2E3440 !important;
  }
  pre code { font-size: inherit !important; color: inherit !important; }
  :not(pre) > code {
    background: ${inlineBg} !important;
    border: 1px solid #cbd5e1 !important;
    font-size: calc(var(--text-scale-code) * ${printCodeCorrection}) !important;
    color: #2E3440 !important;
  }

  /* Preserve concise linked text in PDF; the anchor href remains clickable. */
  ${reading ? `
  /* Reading keeps the HTML light-reader presentation; print mechanics remain. */
  html, body, body * {
    font-family: var(--font-base) !important;
    font-variant-ligatures: none !important;
    font-feature-settings: "liga" 0, "clig" 0, "dlig" 0 !important;
  }
  pre, pre *, code, kbd, samp {
    font-family: var(--font-mono) !important;
    font-variant-ligatures: none !important;
    font-feature-settings: "liga" 0, "clig" 0, "dlig" 0 !important;
  }
  .question pre.question-text {
    font-family: var(--font-base) !important;
    font-variant-ligatures: none !important;
    font-feature-settings: "liga" 0, "clig" 0, "dlig" 0 !important;
  }
  html, body { background: #f8fafc !important; }
  body { line-height: 1.7 !important; }
  .main-content { padding: 1.25rem 1.4rem !important; max-width: 100% !important; }
  .header {
    padding: 1.5rem 1.75rem !important;
    margin: 0 0 1.1rem !important;
    background: var(--bg-surface) !important;
    box-shadow: var(--shadow-md) !important;
    border: 1px solid var(--border-color) !important;
    border-radius: var(--radius-lg) !important;
    outline: 0 !important;
    text-align: center !important;
  }
  /* The body card spans pages, so keep its screen surface/padding but avoid page-edge rails. */
  .content {
    padding: 1.5rem !important;
    background: var(--bg-surface) !important;
    box-shadow: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    outline: 0 !important;
  }
  .shopping-block {
    background: var(--bg-blockquote-note) !important;
    border-color: var(--border-color) !important;
    border-left-color: var(--accent) !important;
    border-radius: 10px !important;
    color: var(--text-primary) !important;
  }
  .shopping-item {
    background: var(--bg-surface) !important;
    border-color: var(--border-color) !important;
  }
  ` : ''}
  ${paper ? `
  /* Paper profile: white surfaces, outlines, labels, and underlined links. */
  .question blockquote { background: #ffffff !important; }
  thead, thead th { background: #ffffff !important; color: #0f172a !important; }
  thead, thead th { border-bottom: 1px solid #0f172a !important; }
  tbody tr:nth-child(odd), tbody tr:nth-child(even) { background: #ffffff !important; }
  .citations-block { background: #ffffff !important; }
  .shopping-block { display: none !important; }
  ` : ''}
}
</style>`;
}

/* --- User font overrides. Emits rules ONLY for fields the user set. ------ */
function buildFontOverridesCSS(userFs) {
    const baseSet = userFs.base != null;
    const qSet = userFs.questionScale != null;
    const aSet = userFs.answerScale != null;
    const hSet = userFs.headingScale != null;
    const codeSet = userFs.codeScale != null;
    if (!baseSet && !qSet && !aSet && !hSet && !codeSet) return '';

    const rules = [];
    if (baseSet) {
        const base = Number(userFs.base);
        if (Number.isFinite(base) && base >= 12 && base <= 22) {
            rules.push('html { font-size: ' + base + 'px !important; }');
        }
    }
    if (aSet) {
        const answerScale = Number(userFs.answerScale);
        if (Number.isFinite(answerScale) && answerScale >= 0.7 && answerScale <= 1.5) {
            rules.push(':root { --text-scale-base: ' + answerScale.toFixed(3) + 'rem !important; }');
        }
    }
    if (hSet) {
        const headingScale = Number(userFs.headingScale);
        if (Number.isFinite(headingScale) && headingScale >= 0.7 && headingScale <= 1.5) {
            rules.push(':root {\n' +
                '  --text-scale-h1: ' + (1.5 * headingScale).toFixed(3) + 'rem !important;\n' +
                '  --text-scale-h2: ' + (1.375 * headingScale).toFixed(3) + 'rem !important;\n' +
                '  --text-scale-h3: ' + (1.25 * headingScale).toFixed(3) + 'rem !important;\n' +
                '  --text-scale-h4: ' + (1.125 * headingScale).toFixed(3) + 'rem !important;\n' +
                '}');
        }
    }
    if (qSet) {
        const questionScale = Number(userFs.questionScale);
        if (Number.isFinite(questionScale) && questionScale >= 0.7 && questionScale <= 1.5) {
            rules.push(':root { --text-scale-question: ' + questionScale.toFixed(3) + 'rem !important; }');
        }
    }
    if (codeSet) {
        const codeScale = Number(userFs.codeScale);
        if (Number.isFinite(codeScale) && codeScale >= 0.7 && codeScale <= 1.5) {
            rules.push(':root { --text-scale-code: ' + (0.78 * codeScale).toFixed(3) + 'rem !important; }');
        }
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

function compactContentsQuestion(value) {
    let question = String(value || '').replace(/\s+/g, ' ').trim();
    question = question.replace(/^https?:\/\/\S+\s*/i, '').trim();
    question = question.replace(/^(?:[-*•]+|\d+[.)])\s*/, '').trim();
    if (!question) return 'Question';
    const words = question.split(/\s+/);
    if (words.length > 7) return words.slice(0, 7).join(' ').replace(/[\s,;:!?]+$/, '') + '…';
    if (question.length > 62) {
        let cut = question.lastIndexOf(' ', 62);
        if (cut < 40) cut = 62;
        return question.slice(0, cut).replace(/[\s,;:!?]+$/, '') + '…';
    }
    return question;
}

function generatePrintedContentsHTML(conversation) {
    let html = '<nav class="printed-contents" aria-labelledby="printed-contents-title">' +
        '<h1 id="printed-contents-title">Contents</h1>' +
        '<p class="printed-contents-intro">Jump to a question or section.</p>' +
        '<ol class="printed-contents-list">';
    let questionNumber = 0;
    for (let i = 0; i < conversation.length; i++) {
        const message = conversation[i];
        if (message.type !== 'user') continue;
        questionNumber++;
        const question = String(message.content || '').replace(/\s+/g, ' ').trim();
        const shortLabel = compactContentsQuestion(question);
        html += '<li class="printed-contents-item"><a class="printed-contents-question" href="#Q' + questionNumber + '"' +
            ' aria-label="Q' + questionNumber + ': ' + escapeHtml(question) + '" title="' + escapeHtml(question) + '">' +
            '<span class="printed-contents-number">Q' + questionNumber + '</span>' +
            '<span class="printed-contents-summary">' + escapeHtml(shortLabel) + '</span></a>';
        let assistantIndex = -1;
        for (let k = i + 1; k < conversation.length; k++) {
            if (conversation[k].type === 'assistant') { assistantIndex = k; break; }
        }
        const headings = assistantIndex < 0 ? [] : __abxTocHeadings.filter(h => h.msg === assistantIndex);
        if (headings.length) {
            html += '<ul class="printed-contents-sections">';
            headings.forEach(h => {
                html += '<li><a href="#' + escapeHtml(h.id) + '">' + escapeHtml(h.text) + '</a></li>';
            });
            html += '</ul>';
        }
        html += '</li>';
    }
    return html + '</ol></nav>';
}

function wrapHeadingTablePairs(html) {
    /* Wrap only a heading immediately followed by a rendered table. Do not let
       the expression span paragraphs or later headings: that can group a whole
       answer into one oversized print unit and still strand the table heading. */
    const source = String(html || '');
    const headingRe = /<h([1-4])\b[^>]*>[\s\S]*?<\/h\1>/gi;
    let output = '';
    let cursor = 0;
    let match;
    while ((match = headingRe.exec(source)) !== null) {
        output += source.slice(cursor, match.index);
        const afterHeading = match.index + match[0].length;
        const tail = source.slice(afterHeading);
        const spacing = tail.match(/^\s*/)[0];
        const table = tail.slice(spacing.length).match(/^<table\b[\s\S]*?<\/table>/i);
        if (table) {
            const end = afterHeading + spacing.length + table[0].length;
            output += '<div class="table-heading-group">' + source.slice(match.index, end) + '</div>';
            cursor = end;
            headingRe.lastIndex = end;
        } else {
            output += match[0];
            cursor = afterHeading;
        }
    }
    return output + source.slice(cursor);
}

function wrapCodeBlockPairs(html) {
    /* Keep a short paragraph label with its following code panel in print.
       `display: contents` preserves the screen layout; print turns this into a
       break-avoiding unit so engines do not orphan the label or split a snippet. */
    const source = String(html || '');
    const paragraphRe = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
    let output = '';
    let cursor = 0;
    let match;
    while ((match = paragraphRe.exec(source)) !== null) {
        output += source.slice(cursor, match.index);
        const afterParagraph = match.index + match[0].length;
        const tail = source.slice(afterParagraph);
        const spacing = tail.match(/^\s*/)[0];
        const pre = tail.slice(spacing.length).match(/^<pre\b[^>]*>[\s\S]*?<\/pre>/i);
        const captionText = match[0].replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
        if (pre && captionText.length <= 80) {
            const end = afterParagraph + spacing.length + pre[0].length;
            output += '<div class="code-heading-group">' + source.slice(match.index, end) + '</div>';
            cursor = end;
            paragraphRe.lastIndex = end;
        } else {
            output += match[0];
            cursor = afterParagraph;
        }
    }
    return output + source.slice(cursor);
}

function generateHTML(title, conversation, usedMode, sourcesInPrint, options) {
    options = options || {};
    const pdfMode = options.pdfMode || null;
    const chatUrl = options.chatUrl === undefined ? getCurrentChatURL() : String(options.chatUrl || '');
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
            /* Slug the PLAIN TEXT, with the same function the TOC uses.
               Slugging the rendered HTML is what produced ids like
               "the-code-code-code-heading". Only h2 ids are recorded for
               the TOC, because that is the only level it links. */
            const plain = abxHtmlToText(text);
            const slug = (depth === 2) ? abxUniqueSlug(plain) : abxSlug(plain);
            if (depth === 2) __abxTocHeadings.push({ msg: __abxCurMsgIdx, text: plain, id: slug });
            return '<h' + depth + ' id="' + slug + '">' + text + '</h' + depth + '>';
        },
        code({ text, lang }) {
            const raw = String(text == null ? '' : text);
            const label = String(lang || '').trim().split(/\s+/)[0].toLowerCase();
            const aliases = {
                js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
                py: 'python', sh: 'bash', shell: 'bash', yml: 'yaml', html: 'xml',
                svg: 'xml', md: 'markdown'
            };
            const language = aliases[label] || label;
            const safeClass = /^[a-z0-9_+-]+$/.test(label) ? ' language-' + label : '';
            let html = escapeHtml(raw);
            try {
                if (language && typeof hljs !== 'undefined' && hljs.getLanguage(language)) {
                    html = hljs.highlight(raw, { language: language, ignoreIllegals: true }).value;
                }
            } catch (e) {
                /* Keep malformed or unsupported code readable as escaped text. */
                html = escapeHtml(raw);
            }
            return '<pre><code class="hljs' + safeClass + '">' + html + '</code></pre>\n';
        }
    };
    marked.use({ renderer });

    const fontOverrides = buildFontOverridesCSS(loadFontSettings());
    const printCSS = buildPrintCSS(loadFontSettings(), pdfMode);
    const includeSourcesInPrint = pdfMode === 'reading' ? true : (pdfMode === 'printing' ? false : sourcesInPrint);
    const hideSourcesPrintCSS = includeSourcesInPrint ? '' : `
<style id="hide-sources-print">
@media print { .citations-block { display: none !important; } }
</style>`;
    const includeShoppingInPrint = pdfMode === 'reading' ? true : (pdfMode === 'printing' ? false : (options.shoppingInPrint === undefined ? loadShoppingInPrint() : !!options.shoppingInPrint));
    const hideShoppingPrintCSS = includeShoppingInPrint ? '' : `
<style id="hide-shopping-print">
@media print { .shopping-block { display: none !important; } }
</style>`;

    const sourcesByTurn = {};
    if (Array.isArray(conversation.sourcesByTurn)) {
        conversation.sourcesByTurn.forEach(s => { sourcesByTurn[s.index] = s; });
    }

    abxResetSlugs();
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
            __abxCurMsgIdx = i;
            contentHTML += marked.parse(abxHtmlMarkdownWithShopping(m.content, m.shoppingBlocks));
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
    const printedContentsHTML = generatePrintedContentsHTML(conversation);
    contentHTML = wrapHeadingTablePairs(contentHTML);
    contentHTML = wrapCodeBlockPairs(contentHTML);
    const chatUrlHTML = chatUrl
        ? '<p class="chat-url"><a href="' + escapeHtml(chatUrl) + '" target="_blank" rel="noopener noreferrer">Chat URL ↗</a></p>'
        : '';

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
  color-scheme: light;
  --bg-body: #f8fafc; --bg-surface: #ffffff; --bg-sidebar: #ffffff;
  --bg-blockquote-q: #f1f5f9; --bg-blockquote-note: #f8fafc; --border-note: #cbd5e1;
  --bg-code-block: #E5E9F0; --bg-code-inline: #E5E9F0;
  --text-code-block: #2E3440; --text-code-inline: #2E3440;
  --text-primary: #0f172a; --text-secondary: #475569;
  --primary: #4f46e5; --primary-hover: #4338ca; --accent: #0C6E7B;
  --text-accent: #4F46E5; --text-on-primary: #ffffff;
  --text-table-head: #ffffff; --bg-primary-soft: rgba(79,70,229,0.08);
  --border-color: #e2e8f0;
  --code-comment: #586275; --code-keyword: #3B5E85; --code-attribute: #466582;
  --code-function: #0C6E7B; --code-type: #1C7473; --code-string: #51693C;
  --code-number: #7E5A79; --code-name: #9D4E58; --code-operator: #8D563F;
  --code-constant: #7A6012; --code-addition: #51693C; --code-deletion: #9D4E58;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
  --shadow-float: 0 10px 15px -3px rgba(0,0,0,0.1);
  --font-base: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --text-scale-base: 1rem;
  --text-scale-h1: 1.5rem;
  --text-scale-h2: 1.375rem;
  --text-scale-h3: 1.25rem;
  --text-scale-h4: 1.125rem;
  --text-scale-question: 1rem;
  --text-scale-code: 0.78rem;
  --sidebar-width: 300px;
  --container-max: 1000px;
  --radius-md: 12px; --radius-lg: 16px;
  --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg-body: #0f172a; --bg-surface: #1e293b; --bg-sidebar: #1e293b;
    --bg-code-inline: #2E3440; --text-code-inline: #D8DEE9;
    --bg-code-block: #2E3440; --text-code-block: #D8DEE9;
    --bg-blockquote-q: #334155; --bg-blockquote-note: #334155; --border-note: #475569;
    --text-primary: #f1f5f9; --text-secondary: #cbd5e1;
    --primary: #818cf8; --primary-hover: #6366f1; --accent: #88C0D0;
    --text-accent: #A5B4FC; --text-on-primary: #0F172A;
    --text-table-head: #0F172A; --bg-primary-soft: rgba(129,140,248,0.12);
    --border-color: #334155;
    --code-comment: #9AA6B2; --code-keyword: #8EA6C5; --code-attribute: #81A1C1;
    --code-function: #88C0D0; --code-type: #8FBCBB; --code-string: #A3BE8C;
    --code-number: #BC9AB5; --code-name: #D3939A; --code-operator: #D59580;
    --code-constant: #EBCB8B; --code-addition: #A3BE8C; --code-deletion: #D3939A;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg-body: #0f172a; --bg-surface: #1e293b; --bg-sidebar: #1e293b;
  --bg-code-inline: #2E3440; --text-code-inline: #D8DEE9;
  --bg-code-block: #2E3440; --text-code-block: #D8DEE9;
  --bg-blockquote-q: #334155; --bg-blockquote-note: #334155; --border-note: #475569;
  --text-primary: #f1f5f9; --text-secondary: #cbd5e1;
  --primary: #818cf8; --primary-hover: #6366f1; --accent: #88C0D0;
  --text-accent: #A5B4FC; --text-on-primary: #0F172A;
  --text-table-head: #0F172A; --bg-primary-soft: rgba(129,140,248,0.12);
  --border-color: #334155;
  --code-comment: #9AA6B2; --code-keyword: #8EA6C5; --code-attribute: #81A1C1;
  --code-function: #88C0D0; --code-type: #8FBCBB; --code-string: #A3BE8C;
  --code-number: #BC9AB5; --code-name: #D3939A; --code-operator: #D59580;
  --code-constant: #EBCB8B; --code-addition: #A3BE8C; --code-deletion: #D3939A;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
/* Restore list indent after the universal reset (list markers live in
   the padding). See docs/decisions/0006-list-indent-after-reset.md. */
.answer ol, .answer ul { padding-inline-start: 1.5em; }
html { scroll-behavior: smooth; font-size: 16px; }
body {
  font-family: var(--font-base); background-color: var(--bg-body); color: var(--text-primary);
  line-height: 1.7; font-size: var(--text-scale-base); overflow-x: hidden;
}
:focus-visible { outline: 2px solid var(--primary); outline-offset: 4px; }

.container { display: grid; grid-template-columns: var(--sidebar-width) 1fr; min-height: 100vh; }
.toc-sidebar {
  background: var(--bg-sidebar); border-right: 1px solid var(--border-color);
  height: 100vh; position: sticky; top: 0;
  padding: 1.25rem 1rem;
  overflow-y: auto; overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
  transition: padding 0.25s cubic-bezier(0.4,0,0.2,1), border-color 0.25s ease;
}
.toc-sidebar h2 { font-size: 1.1rem; margin: 0; color: var(--text-accent); letter-spacing: -0.01em; }
.toc-sidebar ul { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
.toc-sidebar a {
  display: block; text-decoration: none; color: var(--text-secondary);
  font-size: 0.9rem; padding: 0.45rem 0.7rem;
  overflow-wrap: anywhere; word-break: break-word; line-height: 1.35;
  border-radius: var(--radius-md); border-left: 3px solid transparent;
  transition: all var(--transition);
}
.toc-sidebar a:hover { background: var(--bg-body); color: var(--text-accent); transform: translateX(4px); }
.toc-sidebar a.active { background: var(--bg-blockquote-q); color: var(--text-accent); border-left-color: var(--primary); font-weight: 600; }
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
.header .chat-url { margin: 0.7rem 0 0; font-size: 0.9rem; }
.header .chat-url a { color: var(--text-accent); text-decoration: underline; text-underline-offset: 0.12em; overflow-wrap: anywhere; }
.content {
  background: var(--bg-surface); padding: 4rem; border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md); border: 1px solid var(--border-color);
}
/* Divider model mirrors Brave's own. A dedicated table wrapper lets
   print engines keep a heading with the first table fragment. */
.answer > h1, .answer > h2, .answer > h3, .answer > h4,
.answer > .table-heading-group > h1, .answer > .table-heading-group > h2,
.answer > .table-heading-group > h3, .answer > .table-heading-group > h4 {
  border-top: 1px solid var(--border-color);
  margin-top: 2.5rem;
  padding-top: 2.5rem;
}
.answer > :is(h1,h2,h3,h4):first-child,
.answer > :is(h1,h2,h3,h4) + :is(h1,h2,h3,h4),
.answer > .table-heading-group:first-child > :is(h1,h2,h3,h4),
.answer > :is(h1,h2,h3,h4) + .table-heading-group > :is(h1,h2,h3,h4) {
  border-top: none; padding-top: 0; margin-top: 1.2rem;
}
.answer > hr + h1, .answer > hr + h2,
.answer > hr + h3, .answer > hr + h4,
.answer > hr + .table-heading-group > :is(h1,h2,h3,h4) {
  border-top: none !important; padding-top: 0 !important;
}
h1 { font-size: var(--text-scale-h1); font-weight: 700; }
h2 { font-size: var(--text-scale-h2); font-weight: 600; letter-spacing: -0.5px; margin: 2rem 0 1rem; }
hr { border: 0; height: 1px; background: var(--border-color); margin: 2.5rem 0; }
h3 { font-size: var(--text-scale-h3); font-weight: 600; margin: 1.5rem 0 0.75rem; }
h4 { font-size: var(--text-scale-h4); font-weight: 600; margin: 1.25rem 0 0.75rem; }
p { margin-bottom: 0; }
.answer > * + * { margin-top: 1.5rem; }

.shopping-block {
  margin: 1.5rem 0;
  padding: 1rem 1.15rem;
  border: 1px solid var(--border-color);
  border-left: 4px solid var(--accent);
  border-radius: 10px;
  background: var(--bg-blockquote-note);
  color: var(--text-primary);
}
.shopping-block-title { margin: 0 0 0.6rem; padding: 0; border: 0; color: var(--text-accent); }
.shopping-price-disclaimer { margin: 0 0 0.75rem; color: var(--text-secondary); font-size: 0.9em; line-height: 1.45; }
.shopping-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.shopping-item {
  min-width: 0;
  margin: 0;
  padding: 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-surface);
}
.shopping-item article { min-width: 0; }
.shopping-item-line { line-height: 1.5; overflow-wrap: anywhere; }
.shopping-number, .shopping-price { font-weight: 650; }
.shopping-merchant { color: var(--text-secondary); }
.shopping-title-link, .shopping-offer-link {
  color: var(--text-accent);
  text-decoration: underline;
  text-underline-offset: 0.12em;
  overflow-wrap: anywhere;
}
.shopping-separator { color: var(--text-secondary); }
.shopping-extra-offers { margin: 0.3rem 0 0; color: var(--text-secondary); font-size: 0.9em; line-height: 1.45; overflow-wrap: anywhere; }
.shopping-extra-offers a { color: var(--text-accent); }
.shopping-empty { margin: 0; }
@media screen and (max-width: 720px) {
  .shopping-grid { grid-template-columns: minmax(0, 1fr); }
}
@media print {
  .shopping-block { background: transparent !important; border-color: #cbd5e1 !important; border-left-color: #475569 !important; break-inside: auto; page-break-inside: auto; }
  .shopping-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.4rem; }
  .shopping-item { padding: 0.5rem; break-inside: avoid-page; page-break-inside: avoid; }
}
.table-heading-group { display: contents; }
.code-heading-group { display: contents; }

.code-wrapper { position: relative; margin: 2rem 0; }
pre {
  background: var(--bg-code-block); color: var(--text-code-block);
  padding: 1.5rem; border-radius: var(--radius-md);
  font-family: var(--font-mono); font-size: var(--text-scale-code);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  overflow-x: hidden;
}
pre code { background: none; padding: 0; font-family: inherit; }
pre code.hljs {
  display: block; background: transparent; color: var(--text-code-block);
  font: inherit; white-space: inherit; overflow-wrap: inherit; word-break: inherit;
}
:not(pre) > code {
  background-color: var(--bg-code-inline); color: var(--text-code-inline);
  padding: 0.15em 0.3em; border-radius: 4px;
  font-family: var(--font-mono); font-size: var(--text-scale-code); border: 1px solid transparent;
}
/* Hand-mapped Nord semantic colors; adjusted to >=4.5:1 at 12px on both surfaces. */
.hljs-comment, .hljs-quote, .hljs-doctag { color: var(--code-comment); font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-literal { color: var(--code-keyword); }
.hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable,
.hljs-params, .hljs-selector-class, .hljs-selector-id, .hljs-selector-attr,
.hljs-selector-pseudo { color: var(--code-attribute); }
.hljs-title, .hljs-title.function_, .hljs-title.class_, .hljs-title.class_.inherited__,
.hljs-section { color: var(--code-function); }
.hljs-built_in, .hljs-type { color: var(--code-type); }
.hljs-string, .hljs-regexp, .hljs-link { color: var(--code-string); }
.hljs-number, .hljs-symbol, .hljs-bullet { color: var(--code-number); }
.hljs-name, .hljs-tag { color: var(--code-name); }
.hljs-meta, .hljs-operator, .hljs-punctuation { color: var(--code-operator); }
.hljs-constant { color: var(--code-constant); }
.hljs-addition { color: var(--code-addition); }
.hljs-deletion { color: var(--code-deletion); }
.hljs-subst { color: inherit; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: 700; }

/* Table structure: outer holds the non-scrolling button/dropdown, inner scrolls */
.table-outer { position: relative; margin: 2rem 0; }
.table-wrapper { overflow-x: auto; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; background: var(--bg-surface); border: 1px solid var(--border-color); }
thead { background: var(--primary); color: var(--text-table-head); }
thead th { padding: 0.875rem 1rem; text-align: left; font-weight: 600; font-size: 0.9rem; letter-spacing: 0.02em; }
thead th strong { font-weight: inherit; }
tbody tr { border-bottom: 1px solid var(--border-color); }
tbody tr:nth-child(odd)  { background: var(--bg-surface); }
tbody tr:nth-child(even) { background: var(--bg-body); }
tbody tr:hover { background: var(--bg-blockquote-q); }
tbody td { padding: 0.5rem 0.75rem; color: var(--text-primary); }

.copy-btn {
  position: absolute; top: 0.5rem; right: 0.5rem;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  color: var(--text-code-block); padding: 0.25rem 0.5rem;
  border-radius: 6px; cursor: pointer; font-size: 0.8rem;
  opacity: 0; transition: var(--transition);
}
.code-wrapper:hover .copy-btn,
.question:hover .copy-btn { opacity: 1; }
.copy-btn:hover { background: var(--primary); border-color: var(--primary); color: var(--text-on-primary); }
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
.table-menu-btn:hover { background: var(--bg-blockquote-q); border-color: var(--primary); color: var(--text-accent); }
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
.question { position: relative; margin: 2rem 0 1rem; }
.question blockquote {
  background: var(--bg-blockquote-q); border-left: 6px solid var(--primary);
  padding: 1.25rem 2rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);
  font-style: normal; color: var(--text-primary);
}
.question strong {
  display: block; color: var(--text-accent); font-size: 1.1rem;
  margin-bottom: 0.25rem; line-height: 1.2;
  text-transform: uppercase; letter-spacing: 0.05em;
}
.question pre.question-text {
  font-family: var(--font-base); white-space: pre-wrap;
  font-size: var(--text-scale-question); font-weight: 600;
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
.citations-list a { color: var(--text-accent); text-decoration: none; }
.citations-list a:hover { text-decoration: underline; }
@media print {
  .citations-list a { text-decoration: underline; }
}
.cite-favicon { width: 14px; height: 14px; vertical-align: middle; margin-right: 4px; border-radius: 2px; }

.print-tip {
  max-width: var(--container-max); margin: 1.5rem auto 0;
  padding: 0.75rem 1rem;
  background: var(--bg-primary-soft);
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  font-size: 0.9rem; color: var(--text-secondary);
}
.print-tip strong { color: var(--text-accent); }

@media (max-width: 1024px) {
  .container { grid-template-columns: 1fr; }
  .toc-sidebar { position: fixed; top: 0; left: 0; width: 280px; z-index: 1000; transform: translateX(-100%); transition: transform var(--transition); box-shadow: var(--shadow-float); }
  .toc-sidebar.open { transform: translateX(0); }
  .main-content { padding: 1.5rem; }
  .header, .content { padding: 1.5rem; }
  .mobile-menu-btn {
    display: flex !important; position: fixed; bottom: 20px; right: 20px;
    background: var(--primary); color: var(--text-on-primary); width: 50px; height: 50px; border-radius: 50%;
    align-items: center; justify-content: center; box-shadow: var(--shadow-float);
    z-index: 1100; cursor: pointer; border: none; font-size: 1.5rem;
  }
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999; opacity: 0; pointer-events: none; transition: opacity var(--transition); }
  .overlay.active { opacity: 1; pointer-events: auto; }
}
.mobile-menu-btn { display: none; }

/* Sidebar collapse toggle */
.container { transition: grid-template-columns 0.25s cubic-bezier(0.4,0,0.2,1); }
.container.sidebar-collapsed { grid-template-columns: 0px 1fr; }
.container.sidebar-collapsed .toc-sidebar {
  padding-left: 0; padding-right: 0;
  border-right-color: transparent; overflow: hidden;
}
.toc-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.5rem; margin-bottom: 1rem;
}
.toc-toggle, .toc-toggle--floating {
  background: transparent; color: var(--text-secondary);
  border: 1px solid var(--border-color); border-radius: 6px;
  width: 28px; height: 28px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 15px; line-height: 1;
  transition: all 0.15s ease;
}
.toc-toggle:hover, .toc-toggle--floating:hover {
  background: var(--bg-blockquote-q); color: var(--text-accent); border-color: var(--primary);
}
.toc-toggle--floating {
  position: fixed; top: 16px; left: 16px; z-index: 100;
  width: 34px; height: 34px;
  background: var(--bg-surface); box-shadow: var(--shadow-md);
  border-radius: 8px;
  opacity: 0; pointer-events: none;
  transition: opacity 0.2s ease, background 0.15s ease;
}
.container.sidebar-collapsed ~ .toc-toggle--floating {
  opacity: 1; pointer-events: auto;
}
@media (max-width: 1024px) {
  .container.sidebar-collapsed { grid-template-columns: 0px 1fr; }
  .toc-toggle--floating { display: none; }
}
.theme-toggle {
  position: fixed; top: 16px; right: 16px; z-index: 1200;
  width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border-color); border-radius: 10px;
  background: var(--bg-surface); color: var(--text-primary);
  box-shadow: var(--shadow-md); cursor: pointer; font-size: 18px; line-height: 1;
}
.theme-toggle:hover { border-color: var(--primary); color: var(--text-accent); }
@media (max-width: 1024px) {
  .theme-toggle { top: 12px; right: 12px; }
}
</style>
${fontOverrides}
${printCSS}
${hideSourcesPrintCSS}
${hideShoppingPrintCSS}
</head>
<body>
${printedContentsHTML}
<div class="container">
  <div class="toc-sidebar">
    <div class="toc-header">
      <h2>📑 Contents</h2>
      <button class="toc-toggle" aria-label="Collapse sidebar" title="Collapse sidebar" aria-expanded="true">&#8249;</button>
    </div>
    ${tocHTML}
  </div>
  <div class="main-content">
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      ${chatUrlHTML}
      <div class="meta">Exported: ${dateStr}${methodNote}</div>
    </div>
    <div class="content">
      ${contentHTML}
    </div>
  </div>
</div>

<button class="toc-toggle--floating" aria-label="Expand sidebar" title="Expand sidebar" aria-expanded="false">&#8250;</button>
<button class="theme-toggle" type="button" aria-label="Switch to dark theme" title="Switch to dark theme">☾</button>

<div class="print-tip">
  <strong>💡 Print tip:</strong> Background graphics is optional; the text, question labels,
  table headings, and code remain readable if the browser omits colored fills.
</div>

<button class="mobile-menu-btn" aria-label="Toggle Table of Contents">☰</button>
<div class="overlay"></div>

<script>
(function () {
  var btn = document.querySelector('.mobile-menu-btn');
  var overlay = document.querySelector('.overlay');
  var sidebar = document.querySelector('.toc-sidebar');
  var themeButton = document.querySelector('.theme-toggle');
  var themeKey = 'abx_export_theme_v1';
  var systemTheme = 'light';
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) systemTheme = 'dark';
  } catch (e) {}
  var themeMode = systemTheme;
  try {
    var savedTheme = localStorage.getItem(themeKey);
    if (savedTheme === 'light' || savedTheme === 'dark') themeMode = savedTheme;
    else if (savedTheme === 'auto') localStorage.removeItem(themeKey);
  } catch (e) {}
  function applyThemeMode() {
    document.documentElement.setAttribute('data-theme', themeMode);
    themeButton.textContent = themeMode === 'light' ? '☀' : '☾';
    var nextTheme = themeMode === 'light' ? 'dark' : 'light';
    themeButton.setAttribute('aria-label', 'Switch to ' + nextTheme + ' theme');
    themeButton.title = 'Theme: ' + (themeMode === 'light' ? 'Light' : 'Dark') + ' — click to switch to ' + nextTheme;
  }
  themeButton.addEventListener('click', function () {
    themeMode = themeMode === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(themeKey, themeMode); } catch (e) {}
    applyThemeMode();
  });
  applyThemeMode();
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
  var scrollSpyTicking = false;
  function updateActiveTOC() {
    var pageScrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    var atPageTop = pageScrollTop <= 1;
    var target = null;
    var docTop = pageScrollTop + 90;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].offsetTop <= docTop) target = sections[i];
      else break;
    }
    if (!target) target = sections[0];
    tocLinks.forEach(function (l) {
      l.classList.toggle('active', target ? l.getAttribute('href') === '#' + target.id : false);
    });
    var al = null;
    if (target) {
      al = document.querySelector('.toc-sidebar a[href="#' + target.id + '"]');
      if (al) {
        var sb = document.querySelector('.toc-sidebar');
        if (sb) {
          if (atPageTop) {
            sb.scrollTop = 0;
          } else {
            var sr = sb.getBoundingClientRect();
            var ar = al.getBoundingClientRect();
            var headroom = 60;
            if (ar.top < sr.top + headroom || ar.bottom > sr.bottom - 12) {
              sb.scrollTop += (ar.top - sr.top - headroom);
            }
          }
        }
      }
    } else if (atPageTop) {
      var topSidebar = document.querySelector('.toc-sidebar');
      if (topSidebar) topSidebar.scrollTop = 0;
    }
  }
  window.addEventListener('scroll', function () {
    if (scrollSpyTicking) return;
    scrollSpyTicking = true;
    requestAnimationFrame(function () { updateActiveTOC(); scrollSpyTicking = false; });
  }, { passive: true });
  updateActiveTOC();

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
        menuBtn.style.color = 'var(--text-accent)';
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

<script>
(function () {
  var KEY = 'abx-sidebar-collapsed';
  var container = document.querySelector('.container');
  var toggleBtn = document.querySelector('.toc-toggle');
  var floatingBtn = document.querySelector('.toc-toggle--floating');
  if (!container || !toggleBtn) return;
  function apply(collapsed) {
    container.classList.toggle('sidebar-collapsed', collapsed);
    toggleBtn.setAttribute('aria-expanded', String(!collapsed));
    if (floatingBtn) floatingBtn.setAttribute('aria-expanded', String(!collapsed));
  }
  var stored = false;
  try { stored = localStorage.getItem(KEY) === '1'; } catch (e) {}
  apply(stored);
  function setCollapsed(v) {
    apply(v);
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
  }
  toggleBtn.addEventListener('click', function () {
    setCollapsed(!container.classList.contains('sidebar-collapsed'));
  });
  if (floatingBtn) floatingBtn.addEventListener('click', function () { setCollapsed(false); });
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
        let nextA = null, nextAIdx = -1;
        for (let k = i + 1; k < conversation.length; k++) {
            if (conversation[k].type === 'assistant') { nextA = conversation[k]; nextAIdx = k; break; }
        }
        if (nextA) {
            /* Reuse the ids the heading renderer actually assigned, instead of
               recomputing them. Recomputing is how the two drifted apart. */
            __abxTocHeadings
                .filter(h => h.msg === nextAIdx)
                .forEach(h => {
                    html += '<li><a href="#' + h.id + '" class="toc-h2">' + escapeHtml(h.text) + '</a></li>\n';
                });
        }
    }
    html += '</ul>';
    return html;
}
/* The TOC reuses heading IDs recorded by the renderer; it does not re-parse
   the Markdown to generate them. */
/* abxSlug() is the single slug function used throughout the export. */

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
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
    /* Escape text so a CommonMark reader renders it as literal characters.
   Covers every construct defined by the CommonMark spec — no more rules
   will be discovered after this. */
function escapeForMarkdownQuote(text) {
    let out = String(text == null ? '' : text);
    // Backslash first, so we don't double-escape.
    out = out.replace(/\\/g, '\\\\');
    // Inline constructs (matter anywhere).
    out = out.replace(/([`*_\[\]<>])/g, '\\$1');
    // HTML entity marker — stops accidental &nbsp; rendering.
    out = out.replace(/&/g, '\\&');
    // Block-level markers (only dangerous at line start).
    out = out.replace(/^(\s*)([>#+\-])/gm, '$1\\$2');
    // Ordered list: "1. " at line start.
    out = out.replace(/^(\s*)(\d+)\.(\s)/gm, '$1$2\\.$3');
    return out;
}

/* =========================================================================
 * DIALOG CSS (into the Brave page)
 * ========================================================================= */
function injectDialogCSS() {
    if (document.getElementById('abx-dialog-css')) return;
    const style = document.createElement('style');
    style.id = 'abx-dialog-css';
    style.textContent = `
.export-dialog-wrapper {
  --abx-dialog-overlay: rgba(15,23,42,0.72);
  --abx-dialog-surface: #ffffff;
  --abx-dialog-surface-muted: #f8fafc;
  --abx-dialog-text: #0f172a;
  --abx-dialog-muted: #475569;
  --abx-dialog-border: #e2e8f0;
  --abx-dialog-accent: #4f46e5;
  --abx-dialog-accent-hover: #4338ca;
  --abx-dialog-on-accent: #ffffff;
  --abx-dialog-focus: #4f46e5;
  --abx-dialog-selected: rgba(79,70,229,0.08);
  position: fixed; inset: 0; background: var(--abx-dialog-overlay);
  display: flex; align-items: center; justify-content: center;
  z-index: 999999; padding: 12px; backdrop-filter: blur(4px);
  color: var(--abx-dialog-text); color-scheme: light;
  font-family: Inter, system-ui, sans-serif;
}
.export-dialog-content {
  background: var(--abx-dialog-surface); color: var(--abx-dialog-text);
  padding: 26px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  max-width: 520px; width: min(520px, 100%);
  border: 1px solid var(--abx-dialog-border);
  max-height: 90vh; overflow-y: auto;
}
.export-dialog-content h2 {
  margin: 0 0 16px; font-size: 22px; color: var(--abx-dialog-text);
  border-bottom: 2px solid var(--abx-dialog-border); padding-bottom: 12px;
}
.export-dialog-status { margin: 0 0 16px; font-size: 13px; color: var(--abx-dialog-muted); line-height: 1.45; }
.export-dialog-field { margin: 0 0 18px; }
.export-dialog-label, .export-dialog-group legend {
  display: block; margin: 0 0 8px; padding: 0;
  font-weight: 600; color: var(--abx-dialog-text); font-size: 14px;
}
.export-dialog-input {
  width: 100%; padding: 11px 12px; border: 1px solid var(--abx-dialog-border); border-radius: 8px;
  font-size: 14px; font-family: inherit;
  background: var(--abx-dialog-surface-muted); color: var(--abx-dialog-text); box-sizing: border-box;
}
.export-dialog-input:focus { border-color: var(--abx-dialog-accent); box-shadow: 0 0 0 3px var(--abx-dialog-selected); }
.export-dialog-group { min-width: 0; padding: 0; border: 0; margin: 0 0 18px; }
.export-dialog-formats { display: flex; flex-wrap: wrap; gap: 10px; }
.export-dialog-option {
  display: flex; align-items: center; cursor: pointer; color: var(--abx-dialog-text);
  font-size: 14px; line-height: 1.35; min-height: 36px;
}
.export-dialog-option input[type="checkbox"],
.export-dialog-option input[type="radio"] {
  flex: 0 0 auto; margin: 0 8px 0 0; width: 18px; height: 18px;
  accent-color: var(--abx-dialog-accent); cursor: pointer;
}
.export-dialog-option--format {
  padding: 7px 10px; border: 1px solid var(--abx-dialog-border);
  border-radius: 8px; background: var(--abx-dialog-surface-muted);
}
.export-dialog-option--format:has(input:checked) {
  background: var(--abx-dialog-selected); border-color: var(--abx-dialog-accent); font-weight: 600;
}
.export-dialog-html-print, .export-dialog-pdf-profile { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--abx-dialog-border); }
.export-dialog-html-print[hidden], .export-dialog-pdf-profile[hidden] { display: none !important; }
.export-dialog-html-print .export-dialog-label, .export-dialog-pdf-profile .export-dialog-label { margin-bottom: 7px; }
.export-dialog-option--sources { margin-top: 0; font-size: 13px; }
.export-dialog-segmented {
  display: flex; flex-wrap: wrap; gap: 4px; width: 100%;
  padding: 4px; border: 1px solid var(--abx-dialog-border); border-radius: 10px;
  background: var(--abx-dialog-surface-muted);
}
.export-dialog-segmented .export-dialog-option {
  flex: 1 1 110px; justify-content: center; padding: 7px 9px;
  border: 1px solid transparent; border-radius: 7px; white-space: nowrap;
}
.export-dialog-segmented .export-dialog-option:has(input:checked) {
  background: var(--abx-dialog-surface); border-color: var(--abx-dialog-border);
  box-shadow: 0 1px 2px rgba(15,23,42,0.08); font-weight: 600;
}
.export-dialog-hint { margin: 8px 0 0; color: var(--abx-dialog-muted); font-size: 12px; line-height: 1.45; }
.export-dialog-link { color: var(--abx-dialog-accent); text-decoration: none; font-weight: 600; font-size: 13px; }
.export-dialog-link:hover { color: var(--abx-dialog-accent-hover); text-decoration: underline; }
.export-dialog-note { margin: 2px 0 16px; color: var(--abx-dialog-muted); font-size: 13px; }

.export-dialog-main-content {
  display: flex;
  flex-direction: column;
  height: min(760px, 90vh);
  max-height: calc(100vh - 24px);
  min-height: 0;
  padding: 0;
  overflow: hidden;
}
@supports (height: 100dvh) {
  .export-dialog-main-content {
    height: min(760px, calc(100dvh - 24px));
    max-height: calc(100dvh - 24px);
  }
}
.export-dialog-shopping-status { display: block; margin-top: 4px; font-size: 12px; }
.export-dialog-main-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  overflow-anchor: none;
  scrollbar-gutter: stable;
  scroll-behavior: smooth;
  padding: 26px 26px 0;
}
.export-dialog-main-content .export-dialog-buttons {
  display: flex;
  flex-wrap: wrap;
  flex: 0 0 auto;
  margin: 0;
  padding: 12px 26px 18px;
  border-top: 1px solid var(--abx-dialog-border);
  background: var(--abx-dialog-surface);
}
.export-dialog-content.export-dialog-main-content { padding: 0; }
@media (max-width: 540px) {
  .export-dialog-main-scroll { padding: 20px 20px 0; }
  .export-dialog-main-content .export-dialog-buttons { padding: 12px 20px 16px; }
}
@media (max-height: 680px) {
  .export-dialog-main-scroll { padding-top: 14px; }
  .export-dialog-content h2 { margin-bottom: 10px; padding-bottom: 8px; font-size: 20px; }
  .export-dialog-status { margin-bottom: 10px; }
  .export-dialog-shopping-status { margin-top: 3px; font-size: 11px; }
  .export-dialog-field { margin-bottom: 12px; }
  .export-dialog-group { margin-bottom: 12px; }
  .export-dialog-html-print, .export-dialog-pdf-profile { margin-top: 8px; padding-top: 8px; }
  .export-dialog-main-content .export-dialog-buttons { padding-top: 8px; padding-bottom: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  .export-dialog-main-scroll { scroll-behavior: auto; }
}

.export-dialog-profile-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.export-dialog-option--profile {
  align-items: flex-start;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
  min-height: 64px;
  padding: 9px;
  border: 1px solid var(--abx-dialog-border);
  border-radius: 9px;
  background: var(--abx-dialog-surface-muted);
  white-space: normal;
}
.export-dialog-option--profile:has(input:checked) {
  border-color: var(--abx-dialog-accent);
  background: var(--abx-dialog-selected);
}
.export-dialog-option--profile input[type="radio"] {
  width: 16px;
  height: 16px;
  margin: 2px 0 0;
}
.export-dialog-profile-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.export-dialog-profile-copy strong { font-size: 13px; line-height: 1.2; }
.export-dialog-profile-copy small {
  color: var(--abx-dialog-muted);
  font-size: 11px;
  line-height: 1.35;
}
.export-dialog-pdf-profile .export-dialog-hint { margin-top: 6px; }
@media (max-width: 390px) {
  .export-dialog-option--profile { min-height: 72px; padding: 8px; }
  .export-dialog-profile-copy small { font-size: 10.5px; }
}

.export-dialog-diagnostics {
  margin: 0 0 14px;
  padding: 12px;
  border: 1px solid var(--abx-dialog-border);
  border-radius: 8px;
  background: var(--abx-dialog-surface-muted);
}
.export-dialog-diagnostics .export-dialog-label { margin-bottom: 0; }
.export-dialog-diagnostics .export-dialog-hint { margin: 5px 0 8px; }
.abx-diagnostics-report {
  max-height: 42vh;
  overflow: auto;
  margin: 12px 0;
  padding: 12px;
  border: 1px solid var(--abx-dialog-border);
  border-radius: 8px;
  background: var(--abx-dialog-surface-muted);
  color: var(--abx-dialog-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace !important;
}
.abx-diagnostics-warning {
  margin: 0 0 10px;
  padding: 10px 12px;
  border-left: 4px solid #b45309;
  border-radius: 4px;
  background: #fff7ed;
  color: #7c2d12;
  font-size: 13px;
  line-height: 1.45;
}
.abx-diagnostics-actions { margin-top: 14px; }
@media (prefers-color-scheme: dark) {
  .abx-diagnostics-warning { background: #431407; color: #ffedd5; border-left-color: #fb923c; }
}
.export-dialog-buttons { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }
.export-dialog-btn {
  min-height: 42px; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px;
  cursor: pointer; border: 1px solid transparent; font-family: inherit;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
.export-dialog-btn-cancel { background: var(--abx-dialog-surface-muted); color: var(--abx-dialog-muted); border-color: var(--abx-dialog-border); }
.export-dialog-btn-cancel:hover { background: var(--abx-dialog-border); color: var(--abx-dialog-text); }
.export-dialog-btn-download { background: var(--abx-dialog-accent); color: var(--abx-dialog-on-accent); }
.export-dialog-btn-download:hover { background: var(--abx-dialog-accent-hover); transform: translateY(-1px); }
.export-dialog-btn-small { min-height: 32px; padding: 6px 12px; font-size: 12px; margin-top: 6px; }
.font-row { display: grid; grid-template-columns: 110px 1fr 60px; gap: 10px; align-items: center; margin-bottom: 10px; font-size: 13px; }
.font-row label { color: var(--abx-dialog-muted); }
.font-row input[type="range"] { width: 100%; accent-color: var(--abx-dialog-accent); }
.font-row span { font-family: ui-monospace, monospace; color: var(--abx-dialog-text); text-align: right; }
.export-dialog-summary { cursor: pointer; font-weight: 600; font-size: 14px; color: var(--abx-dialog-text); }
details#font-settings-block[open] > summary, details#capture-method-block[open] > summary { margin-bottom: 14px; }
.export-dialog-content :focus-visible { outline: 2px solid var(--abx-dialog-focus); outline-offset: 3px; }
.export-dialog-input:focus-visible { outline: 2px solid var(--abx-dialog-focus); outline-offset: 2px; }
@media (max-width: 540px) {
  .export-dialog-content { padding: 20px; }
  .export-dialog-buttons { gap: 8px; }
  .export-dialog-btn { padding-left: 14px; padding-right: 14px; }
}
@media (prefers-color-scheme: dark) {
  .export-dialog-wrapper {
    --abx-dialog-overlay: rgba(0,0,0,0.78);
    --abx-dialog-surface: #1e293b;
    --abx-dialog-surface-muted: #0f172a;
    --abx-dialog-text: #f1f5f9;
    --abx-dialog-muted: #cbd5e1;
    --abx-dialog-border: #334155;
    --abx-dialog-accent: #818cf8;
    --abx-dialog-accent-hover: #A5B4FC;
    --abx-dialog-on-accent: #0f172a;
    --abx-dialog-focus: #A5B4FC;
    --abx-dialog-selected: rgba(129,140,248,0.18);
    color-scheme: dark;
  }
}
`;
    abxAppendToDoc(style, true);
}

/* =========================================================================
 * INIT
 * ========================================================================= */
function init() {
    /* Dialog CSS and the Export button are independent. A failure in one
       must never take the other down with it — that coupling, not an SPA
       re-render, is what made the button vanish. */
    try { injectDialogCSS(); }
    catch (e) { console.warn('[ABX] dialog CSS injection failed:', e); }

    if (document.getElementById('brave-export-btn')) return;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createExportButton, { once: true });
    } else {
        createExportButton();
    }
}
init();

})();