
global.window = { };
global.location = { search: '?conversation=abc123' };
class FakeBody { constructor(frames){ this.frames = frames.slice(); } getReader(){ const f=this.frames; let i=0; return { read: async ()=> i<f.length ? {done:false, value:new TextEncoder().encode(f[i++])} : {done:true} }; } }
class FakeRes { constructor(text){ this._t=text; this.body=new FakeBody([text]); } clone(){ return new FakeRes(this._t); } json(){ return Promise.resolve(JSON.parse(this._t)); } }
let fetchCalls = 0;
global.window.fetch = async (url, init) => { fetchCalls++; return new FakeRes(global.__nextResponse__); };
global.window.XMLHttpRequest = function(){};
global.__nextResponse__ = '';

import { readFileSync } from 'fs';
const block = readFileSync('/tmp/step1_block.js','utf8');
const fn = new Function('window','location','console','TextDecoder', block + '\nreturn { abxHandleEvent, abxParseSSE, getCurrentConversationId, buildConversationFromApiState, __ABX };');
const api = fn(global.window, global.location, console, TextDecoder);

const cid = 'abc123';
api.abxHandleEvent({type:'question', conversation:cid, index:0, text:'What is Python?'});
api.abxHandleEvent({type:'answer', conversation:cid, index:0, content:'Python is a'});
api.abxHandleEvent({type:'answer', conversation:cid, index:0, content:' language.'});
api.abxHandleEvent({type:'augment_with_inline_citation', conversation:cid, index:0, citation:{id:'c1', number:1, url:'https://python.org', title:'Python.org'}});
api.abxHandleEvent({type:'augment_with_inline_citation', conversation:cid, index:0, citation:{id:'c1', number:1, url:'https://python.org', title:'Python.org'}});
api.abxHandleEvent({type:'tool_use', conversation:cid, index:0, name:'augment_with_web', arguments:{q:'python history'}});
api.abxHandleEvent({type:'rag', conversation:cid, index:0, urls:['https://a.com','https://b.com']});
api.abxHandleEvent({type:'final', conversation:cid, index:0});
api.abxHandleEvent({type:'question', conversation:cid, index:1, text:'And Java?'});
api.abxHandleEvent({type:'answer', conversation:cid, index:1, content:'Java is different.'});

const conv = api.buildConversationFromApiState();
if (!conv) throw new Error('FAIL: no conversation built');
if (conv.length !== 4) throw new Error('FAIL: expected 4 messages, got ' + conv.length);
if (conv[0].content !== 'What is Python?') throw new Error('FAIL q1');
if (conv[1].content !== 'Python is a language.') throw new Error('FAIL a1 concat');
if (conv[2].content !== 'And Java?') throw new Error('FAIL q2');
if (conv.sourcesByTurn[0].citations.length !== 1) throw new Error('FAIL dedupe citations');
if (conv.sourcesByTurn[0].ragUrls.length !== 2) throw new Error('FAIL rag urls');
if (conv.sourcesByTurn[0].augmentations[0].type !== 'augment_with_web') throw new Error('FAIL aug type');

api.abxParseSSE('data: {"type":"question","conversation":"abc123","index":2,"text":"Q3?"}\n\ndata: [DONE]\n\n');
const conv2 = api.buildConversationFromApiState();
if (conv2.length !== 5) throw new Error('FAIL sse parse, len=' + conv2.length);
if (conv2[4].content !== 'Q3?') throw new Error('FAIL sse q3');

global.__nextResponse__ = 'data: {"type":"question","conversation":"abc123","index":3,"text":"Q4 streamed?"}\n\n';
await global.window.fetch('/api/tap/v1/stream?x=1');
await new Promise(r=>setTimeout(r,50));
const conv3 = api.buildConversationFromApiState();
if (conv3.length !== 6 || conv3[5].content !== 'Q4 streamed?') throw new Error('FAIL fetch stream');

global.__nextResponse__ = 'garbage';
await global.window.fetch('/api/suggest?q=hi');
if (fetchCalls !== 2) throw new Error('FAIL fetch passthrough count');

// get_current_state JSON path through the wrapped fetch
global.__nextResponse__ = JSON.stringify({events:[{type:'question', conversation:'abc123', index:9, text:'from get_current_state'}]});
await global.window.fetch('/api/tap/v1/get_current_state?conversation=abc123');
await new Promise(r=>setTimeout(r,50));
const conv4 = api.buildConversationFromApiState();
if (conv4.length !== 7 || conv4[6].content !== 'from get_current_state') throw new Error('FAIL state json capture, len=' + conv4.length);

console.log('ALL STEP-1 UNIT TESTS PASSED OK');
