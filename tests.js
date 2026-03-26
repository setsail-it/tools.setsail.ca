#!/usr/bin/env node
// SetSailOS Unit Tests — run with: node tests.js
// Tests the 5 most critical business logic functions

var _pass = 0, _fail = 0, _errors = [];

function assert(condition, name) {
  if (condition) { _pass++; process.stdout.write('\x1b[32m✓\x1b[0m ' + name + '\n'); }
  else { _fail++; _errors.push(name); process.stdout.write('\x1b[31m✗\x1b[0m ' + name + '\n'); }
}
function assertEq(actual, expected, name) {
  assert(actual === expected, name + ' (got: ' + JSON.stringify(actual) + ', expected: ' + JSON.stringify(expected) + ')');
}
function assertIncludes(arr, item, name) {
  assert(arr.indexOf(item) >= 0, name + ' — expected "' + item + '" in array');
}

// ── MOCK GLOBALS ─────────────────────────────────────────────────
var S = { setup: {}, research: {}, strategy: null, snapshot: null, kwResearch: null, pages: [] };

// Mock helpers that _computeAlignment and _suggestPriority depend on
var _mockLevers = {};
function _leverForPageType(pt) {
  var map = { service: 'seo', location: 'local_seo', blog: 'content_marketing', industry: 'seo', landing: 'cro' };
  return map[pt] || pt;
}
function _findLever(id) { return _mockLevers[id] || null; }

// ══════════════════════════════════════════════════════════════════
// 1. _computeAlignment(page)
// ══════════════════════════════════════════════════════════════════
function _computeAlignment(page) {
  var st = S.strategy;
  if (!st || !st._meta || st._meta.current_version === 0) return 'review';
  if (st.subtraction && st.subtraction.current_activities_audit) {
    var pageName = (page.page_name || '').toLowerCase();
    var pageSlug = (page.slug || '').toLowerCase();
    var cut = st.subtraction.current_activities_audit.some(function(a) {
      if (a.verdict !== 'stop' && a.verdict !== 'reduce') return false;
      var activity = (a.activity || a.name || '').toLowerCase();
      return pageName.indexOf(activity) >= 0 || pageSlug.indexOf(activity) >= 0 || activity.indexOf(pageName) >= 0;
    });
    if (cut) return 'cut';
  }
  if (page.is_structural) return 'aligned';
  var leverId = _leverForPageType(page.page_type);
  var lever = _findLever(leverId);
  if (lever && lever.priority_score >= 5) return 'aligned';
  var web = st.execution_plan && st.execution_plan.lever_details && st.execution_plan.lever_details.website;
  if (web && web.architecture_direction && web.architecture_direction.page_types_needed) {
    var needed = web.architecture_direction.page_types_needed.map(function(t) { return t.toLowerCase(); });
    if (needed.indexOf((page.page_type || '').toLowerCase()) >= 0) return 'aligned';
  }
  if (lever && lever.priority_score >= 3) return 'review';
  return 'review';
}

console.log('\n\x1b[1m═══ _computeAlignment ═══\x1b[0m');

// No strategy → review
S.strategy = null;
assertEq(_computeAlignment({ slug: 'seo', page_type: 'service' }), 'review', 'No strategy returns review');

// With strategy, structural page → aligned
S.strategy = { _meta: { current_version: 1 } };
assertEq(_computeAlignment({ slug: '', page_type: 'home', is_structural: true }), 'aligned', 'Structural page is always aligned');

// Subtraction verdict = stop → cut
S.strategy = { _meta: { current_version: 1 }, subtraction: { current_activities_audit: [{ activity: 'social media', verdict: 'stop' }] } };
assertEq(_computeAlignment({ slug: 'social-media', page_name: 'Social Media', page_type: 'service' }), 'cut', 'Subtraction stop verdict returns cut');

// Subtraction verdict = keep → not cut
S.strategy = { _meta: { current_version: 1 }, subtraction: { current_activities_audit: [{ activity: 'social media', verdict: 'keep' }] } };
_mockLevers = {};
assertEq(_computeAlignment({ slug: 'social-media', page_name: 'Social Media', page_type: 'service' }), 'review', 'Subtraction keep verdict does not cut');

// Lever with score >= 5 → aligned
S.strategy = { _meta: { current_version: 1 } };
_mockLevers = { seo: { priority_score: 7, lever: 'SEO' } };
assertEq(_computeAlignment({ slug: 'seo-services', page_type: 'service' }), 'aligned', 'Lever score >= 5 returns aligned');

// Lever with score 3-4 → review
_mockLevers = { seo: { priority_score: 4, lever: 'SEO' } };
assertEq(_computeAlignment({ slug: 'seo-services', page_type: 'service' }), 'review', 'Lever score 3-4 returns review');

// Page type in architecture_direction.page_types_needed → aligned
S.strategy = { _meta: { current_version: 1 }, execution_plan: { lever_details: { website: { architecture_direction: { page_types_needed: ['blog', 'location'] } } } } };
_mockLevers = {};
assertEq(_computeAlignment({ slug: 'my-blog', page_type: 'blog' }), 'aligned', 'Page type in page_types_needed returns aligned');

// ══════════════════════════════════════════════════════════════════
// 2. _suggestPriority(page)
// ══════════════════════════════════════════════════════════════════
function _suggestPriority(page) {
  var st = S.strategy;
  if (!st || !st._meta || st._meta.current_version === 0) return null;
  if (page.is_structural) {
    var t = (page.page_type || '').toLowerCase();
    return (t === 'home' || t === 'contact') ? 'P1' : 'P2';
  }
  var leverId = _leverForPageType(page.page_type);
  var lever = _findLever(leverId);
  var leverScore = lever ? (lever.priority_score || 0) : 0;
  var gp = st.growth_plan || {};
  var timelineItems = gp.accepted_timeline || [];
  if (!timelineItems.length && st.channel_strategy && st.channel_strategy.levers) {
    timelineItems = st.channel_strategy.levers.filter(function(l) { return l.priority_score > 3; }).map(function(l) {
      return { id: (l.lever || '').replace(/\s+/g, '_').toLowerCase(), phase: l.dependencies && l.dependencies.length ? 2 : 1 };
    });
    timelineItems.unshift({ id: '_website', phase: 1 });
    timelineItems.unshift({ id: '_tracking', phase: 0 });
  }
  var tlItem = timelineItems.find(function(t) {
    var tid = (t.id || t.label || '').toLowerCase().replace(/\s+/g, '_');
    return tid === leverId || tid.indexOf(leverId) >= 0 || leverId.indexOf(tid) >= 0;
  });
  var phase = tlItem ? (tlItem.phase || 0) : 3;
  var basePriority;
  if (phase <= 1 && leverScore >= 7) basePriority = 'P1';
  else if (phase <= 1 && leverScore >= 5) basePriority = 'P1';
  else if (phase <= 2 && leverScore >= 5) basePriority = 'P2';
  else basePriority = 'P3';
  var suggested = basePriority;
  var align = _computeAlignment(page);
  if (align === 'aligned' && suggested === 'P2') suggested = 'P1';
  else if (align === 'aligned' && suggested === 'P3') suggested = 'P2';
  if (align === 'cut') suggested = 'P3';
  if ((page.primary_vol || 0) >= 500 && suggested !== 'P1') suggested = 'P1';
  return suggested;
}

console.log('\n\x1b[1m═══ _suggestPriority ═══\x1b[0m');

// No strategy → null
S.strategy = null;
assertEq(_suggestPriority({ slug: 'seo', page_type: 'service' }), null, 'No strategy returns null');

// Structural home → P1
S.strategy = { _meta: { current_version: 1 } };
assertEq(_suggestPriority({ slug: '', page_type: 'home', is_structural: true }), 'P1', 'Structural home returns P1');

// Structural about → P2
assertEq(_suggestPriority({ slug: 'about', page_type: 'about', is_structural: true }), 'P2', 'Structural about returns P2');

// Structural contact → P1
assertEq(_suggestPriority({ slug: 'contact', page_type: 'contact', is_structural: true }), 'P1', 'Structural contact returns P1');

// High volume override → P1
S.strategy = { _meta: { current_version: 1 } };
_mockLevers = {};
assertEq(_suggestPriority({ slug: 'seo', page_type: 'service', primary_vol: 600 }), 'P1', 'Volume >= 500 overrides to P1');

// Phase 1 lever score 7 → P1
S.strategy = { _meta: { current_version: 1 }, growth_plan: { accepted_timeline: [{ id: 'seo', phase: 1 }] } };
_mockLevers = { seo: { priority_score: 7, lever: 'SEO' } };
assertEq(_suggestPriority({ slug: 'seo-services', page_type: 'service', primary_vol: 100 }), 'P1', 'Phase 1 + score 7 = P1');

// Phase 2 lever score 5 → P2 (but alignment boost to P1 if aligned)
S.strategy = { _meta: { current_version: 1 }, growth_plan: { accepted_timeline: [{ id: 'seo', phase: 2 }] } };
_mockLevers = { seo: { priority_score: 5, lever: 'SEO' } };
assertEq(_suggestPriority({ slug: 'seo-services', page_type: 'service', primary_vol: 100 }), 'P1', 'Phase 2 + score 5 + aligned = P1 (alignment boost)');

// Cut page → P3
S.strategy = { _meta: { current_version: 1 }, subtraction: { current_activities_audit: [{ activity: 'social media', verdict: 'stop' }] } };
_mockLevers = {};
assertEq(_suggestPriority({ slug: 'social-media', page_name: 'Social Media', page_type: 'service', primary_vol: 100 }), 'P3', 'Cut page always P3');

// ══════════════════════════════════════════════════════════════════
// 3. _triagePages(pages)
// ══════════════════════════════════════════════════════════════════
function _triagePages(pages) {
  var keep = [];
  var removed = [];
  var _hasStrategy = S.strategy && S.strategy._meta && S.strategy._meta.current_version > 0;
  var kwCount = {};
  pages.forEach(function(p) {
    var kw = (p.primary_keyword || '').toLowerCase().trim();
    if (kw) kwCount[kw] = (kwCount[kw] || 0) + 1;
  });
  var cannibalKept = {};
  pages.forEach(function(p, i) {
    if (p.is_structural || p._d5_source || p._cta_source) { keep.push(p); return; }
    if ((p.existing_traffic || 0) > 0) { keep.push(p); return; }
    var slug = (p.slug || '').toLowerCase();
    var reason = null;
    if (/[\?&=]|\/page\/\d|\/tag\/|\/category\/|\/author\/|\/feed\/?$|\/amp\/?$/.test(slug)) { reason = 'Parameter/filter page'; }
    if (!reason && (p.page_type || '').toLowerCase() === 'utility') {
      var isNeeded = /privacy|terms|cookie/.test(slug);
      if (!isNeeded) reason = 'Utility page with no traffic';
    }
    if (!reason && /^team\/|^author\/|^staff\//.test(slug) && (p.existing_traffic || 0) === 0) {
      if (slug.split('/').filter(Boolean).length > 1) { reason = 'Team sub-page with no traffic'; }
    }
    if (!reason && p.primary_keyword) {
      var kwLower = p.primary_keyword.toLowerCase().trim();
      if (kwCount[kwLower] > 1) {
        if (!cannibalKept[kwLower]) {
          var bestIdx = -1; var bestVol = -1;
          pages.forEach(function(pp, j) {
            if ((pp.primary_keyword || '').toLowerCase().trim() === kwLower) {
              var v = pp.primary_vol || 0;
              if (v > bestVol || (v === bestVol && (pp.score || 0) > (pages[bestIdx] ? pages[bestIdx].score || 0 : 0))) { bestVol = v; bestIdx = j; }
            }
          });
          cannibalKept[kwLower] = bestIdx;
        }
        if (cannibalKept[kwLower] !== i) { reason = 'Cannibalised keyword "' + p.primary_keyword + '"'; }
      }
    }
    if (!reason && _hasStrategy) {
      var align = _computeAlignment(p);
      if (align === 'cut') { reason = 'Off-strategy — lever not prioritised'; }
    }
    if (reason) { p._removeReason = reason; removed.push(p); } else { keep.push(p); }
  });
  return { keep: keep, removed: removed };
}

console.log('\n\x1b[1m═══ _triagePages ═══\x1b[0m');
S.strategy = null;

// Structural pages always kept
var r1 = _triagePages([{ slug: '', page_type: 'home', is_structural: true }]);
assertEq(r1.keep.length, 1, 'Structural page always kept');
assertEq(r1.removed.length, 0, 'Structural page never removed');

// D5 source pages always kept
var r2 = _triagePages([{ slug: 'new-page', page_type: 'industry', _d5_source: true }]);
assertEq(r2.keep.length, 1, 'D5 source page always kept');

// CTA source pages always kept
var r3 = _triagePages([{ slug: 'get-quote', page_type: 'landing', _cta_source: true }]);
assertEq(r3.keep.length, 1, 'CTA source page always kept');

// Pages with traffic always kept
var r4 = _triagePages([{ slug: 'old-page', page_type: 'service', existing_traffic: 50 }]);
assertEq(r4.keep.length, 1, 'Page with traffic always kept');

// Parameter page → removed
var r5 = _triagePages([{ slug: 'products?page=2', page_type: 'service' }]);
assertEq(r5.removed.length, 1, 'Parameter page removed');
assertEq(r5.removed[0]._removeReason, 'Parameter/filter page', 'Parameter page reason correct');

// Tag page → removed
var r5b = _triagePages([{ slug: 'blog/tag/seo', page_type: 'blog' }]);
assertEq(r5b.removed.length, 1, 'Tag page removed');

// Utility page (non-legal) → removed
var r6 = _triagePages([{ slug: 'thank-you', page_type: 'utility' }]);
assertEq(r6.removed.length, 1, 'Utility thank-you page removed');

// Utility page (legal) → kept
var r7 = _triagePages([{ slug: 'privacy-policy', page_type: 'utility' }]);
assertEq(r7.keep.length, 1, 'Privacy policy page kept (legal)');

// Terms page → kept
var r7b = _triagePages([{ slug: 'terms-of-service', page_type: 'utility' }]);
assertEq(r7b.keep.length, 1, 'Terms page kept (legal)');

// Team sub-page with no traffic → removed
var r8 = _triagePages([{ slug: 'team/john-doe', page_type: 'team', existing_traffic: 0 }]);
assertEq(r8.removed.length, 1, 'Team sub-page with no traffic removed');

// Team sub-page WITH traffic → kept
var r8b = _triagePages([{ slug: 'team/john-doe', page_type: 'team', existing_traffic: 10 }]);
assertEq(r8b.keep.length, 1, 'Team sub-page with traffic kept');

// Cannibalised keyword — keeps best, removes rest
var r9 = _triagePages([
  { slug: 'seo-services', page_type: 'service', primary_keyword: 'seo', primary_vol: 500, score: 10 },
  { slug: 'seo-agency', page_type: 'service', primary_keyword: 'seo', primary_vol: 100, score: 5 }
]);
assertEq(r9.keep.length, 1, 'Cannibalisation: keeps 1 page');
assertEq(r9.removed.length, 1, 'Cannibalisation: removes 1 page');
assertEq(r9.keep[0].slug, 'seo-services', 'Cannibalisation: keeps highest volume page');

// ══════════════════════════════════════════════════════════════════
// 4. _detectBusinessCategory()
// ══════════════════════════════════════════════════════════════════
function _detectBusinessCategory() {
  var r = S.research || {};
  var setup = S.setup || {};
  var industry = (r.industry || setup.industry || '').toLowerCase();
  var subIndustry = (r.sub_industry || '').toLowerCase();
  var bizModel = (r.business_model || '').toLowerCase();
  var schemaType = (r.schema_business_type || '').toLowerCase();
  var category = (r.schema_primary_category || '').toLowerCase();
  var all = industry + ' ' + subIndustry + ' ' + bizModel + ' ' + schemaType + ' ' + category;
  if (/e-?commerce|retail|shop|store|product|merch/.test(all)) return 'ecommerce';
  if (/saas|software|platform|app|tech(?:nology)?/.test(all) && !/agency/.test(all)) return 'saas';
  if (/medical|dental|clinic|health|doctor|physician|optom|chiro|physio|derma|aestheti|plastic surg/.test(all)) return 'medical';
  if (/construct|plumb|electric(?:al|ian)|hvac|roof|landscap|paving|concrete|renovation|remodel|contractor|trades/.test(all)) return 'trades';
  if (/restaurant|food|caf[eé]|bar|dining|catering|bakery|pizza/.test(all)) return 'restaurant';
  if (/law(?:yer)?|legal|attorney|litigation|family law|criminal|immigration/.test(all)) return 'legal';
  if (/real\s*estate|realtor|property|mortgage|brokerage/.test(all)) return 'realestate';
  if (/agency|marketing|advertising|digital|creative|design|branding|consult/.test(all)) return 'agency';
  if (/account|financial|insurance|advisory|consult/.test(all)) return 'professional';
  return 'agency';
}

console.log('\n\x1b[1m═══ _detectBusinessCategory ═══\x1b[0m');

S.research = { industry: 'Digital Marketing' }; S.setup = {};
assertEq(_detectBusinessCategory(), 'agency', 'Digital Marketing → agency');

S.research = { industry: 'Dental Laboratory' };
assertEq(_detectBusinessCategory(), 'medical', 'Dental Laboratory → medical');

S.research = { industry: 'E-commerce', sub_industry: 'Fashion retail' };
assertEq(_detectBusinessCategory(), 'ecommerce', 'E-commerce → ecommerce');

S.research = { industry: 'Technology', schema_primary_category: 'SaaS Platform' };
assertEq(_detectBusinessCategory(), 'saas', 'SaaS Platform → saas');

S.research = { industry: 'Construction', sub_industry: 'Residential renovation' };
assertEq(_detectBusinessCategory(), 'trades', 'Construction → trades');

S.research = { industry: 'Legal', sub_industry: 'Family Law' };
assertEq(_detectBusinessCategory(), 'legal', 'Family Law → legal');

S.research = { industry: 'Real Estate', schema_primary_category: 'Realtor' };
assertEq(_detectBusinessCategory(), 'realestate', 'Real Estate → realestate');

S.research = { industry: 'Food & Beverage', schema_primary_category: 'Restaurant' };
assertEq(_detectBusinessCategory(), 'restaurant', 'Restaurant → restaurant');

S.research = { industry: 'Accounting', sub_industry: 'Tax Advisory' };
assertEq(_detectBusinessCategory(), 'professional', 'Accounting → professional');

S.research = {}; S.setup = {};
assertEq(_detectBusinessCategory(), 'agency', 'Empty → agency (safe default)');

// Edge case: "technology consulting agency" should be agency not saas
S.research = { industry: 'Technology consulting agency' };
assertEq(_detectBusinessCategory(), 'agency', 'Tech consulting agency → agency (not saas)');

// ══════════════════════════════════════════════════════════════════
// 5. _parseAiJson (JSON repair)
// ══════════════════════════════════════════════════════════════════
function _cleanAiJson(raw) {
  return raw
    .replace(/```json\s*/gi, '').replace(/```\s*/g, '')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/,\s*([\]}])/g, '$1')
    .trim();
}
function _parseAiJson(raw) {
  var clean = _cleanAiJson(raw);
  try { return JSON.parse(clean); } catch(e) {}
  try { var s = clean.indexOf('['); var e = clean.lastIndexOf(']'); if (s >= 0 && e > s) return JSON.parse(clean.slice(s, e + 1)); } catch(e) {}
  try { var s2 = clean.indexOf('['); if (s2 >= 0) { var lastBrace = clean.lastIndexOf('}'); if (lastBrace > s2) return JSON.parse(clean.slice(s2, lastBrace + 1) + ']'); } } catch(e) {}
  try { var matches = clean.match(/\{[^{}]*\}/g); if (matches && matches.length) { var arr = matches.map(function(m) { try { return JSON.parse(m); } catch(e) { return null; } }).filter(Boolean); if (arr.length) return arr; } } catch(e) {}
  throw new Error('Could not parse AI response as JSON');
}

console.log('\n\x1b[1m═══ _parseAiJson ═══\x1b[0m');

// Clean JSON
var r10 = _parseAiJson('[{"slug":"seo","keyword":"seo services"}]');
assertEq(r10.length, 1, 'Clean JSON parses correctly');
assertEq(r10[0].slug, 'seo', 'Clean JSON: slug correct');

// Markdown fenced
var r11 = _parseAiJson('```json\n[{"slug":"test","keyword":"test kw"}]\n```');
assertEq(r11.length, 1, 'Markdown-fenced JSON parses');

// Trailing comma
var r12 = _parseAiJson('[{"slug":"a","keyword":"b"},]');
assertEq(r12.length, 1, 'Trailing comma handled');

// Control characters inside string
var r13 = _parseAiJson('[{"slug":"seo","keyword":"seo\nservices"}]');
assertEq(r13.length, 1, 'Control characters stripped');

// Truncated response — missing closing ]
var r14 = _parseAiJson('[{"slug":"a","keyword":"b"},{"slug":"c","keyword":"d"}');
assertEq(r14.length, 2, 'Truncated array (missing ]) repaired');

// Truncated mid-object — salvages complete objects
var r15 = _parseAiJson('[{"slug":"a","keyword":"b"},{"slug":"c","keyw');
assertEq(r15.length >= 1, true, 'Truncated mid-object: salvages at least 1 object');
assertEq(r15[0].slug, 'a', 'Truncated mid-object: first object intact');

// Preamble text before JSON
var r16 = _parseAiJson('Here are the keywords:\n[{"slug":"x","keyword":"y"}]');
assertEq(r16.length, 1, 'Preamble text before JSON handled');

// Completely broken → throws
var threw = false;
try { _parseAiJson('this is not json at all'); } catch(e) { threw = true; }
assert(threw, 'Completely broken JSON throws error');


// ══════════════════════════════════════════════════════════════════
// 6. Layered Pipeline Infrastructure (async tests)
// ══════════════════════════════════════════════════════════════════

// Speed up tests — collapse 1500ms inter-step delays to 0
var _origTimeout = global.setTimeout;
global.setTimeout = function(fn) { return _origTimeout(fn, 0); };

// Browser globals
if (typeof window === 'undefined') global.window = {};
window._aiStopAll = false;
window._aiStopResumeCtx = null;

// Pipeline mock state
var _pLog = [];
var _pVersionLabel = null;
var _pFinalized = false;
var _kwFails = {};
var _diagFails = {};
var _diagStopAfter = null;

function _resetPipe() {
  _pLog = [];
  _pVersionLabel = null;
  _pFinalized = false;
  _kwFails = {};
  _diagFails = {};
  _diagStopAfter = null;
  window._aiStopAll = false;
  window._aiStopResumeCtx = null;
  S.strategy = { _meta: { current_version: 1, overall_score: 7.5 }, _kwDataStale: true };
}

// Mock implementations
function runDiagnostic(num) {
  if (_diagFails['D' + num]) return Promise.reject(new Error('D' + num + ' forced fail'));
  _pLog.push('D' + num);
  if (_diagStopAfter === num) window._aiStopAll = true;
  return Promise.resolve();
}
function kwPhase1_DataCollection() {
  if (_kwFails.KW1) return Promise.reject(new Error('KW1 forced fail'));
  _pLog.push('KW1');
  return Promise.resolve();
}
function kwPhase2_Selection() {
  if (_kwFails.KW2) return Promise.reject(new Error('KW2 forced fail'));
  _pLog.push('KW2');
  return Promise.resolve();
}
function kwPhase3_Clustering() {
  if (_kwFails.KW3) return Promise.reject(new Error('KW3 forced fail'));
  _pLog.push('KW3');
  return Promise.resolve();
}
function compileStrategyOutput() { _pLog.push('COMPILE'); return Promise.resolve(); }
function synthesiseWebStrategy() { _pLog.push('WEBBRIEF'); return Promise.resolve(); }
function aiBarStart() {}
function aiBarEnd() {}
function aiBarNotify() {}
function capturePricingSnapshot() { _pFinalized = true; }
function createStrategyVersion(label) { _pVersionLabel = label; }
function saveProject() { return Promise.resolve(); }
function renderStrategyScorecard() {}
function renderStrategyNav() {}
function renderStrategyTabContent() {}
function fetchPricingCatalog() { return Promise.resolve(); }
function strategyDefaults() { return { _meta: { current_version: 0, overall_score: 0 }, _kwDataStale: false }; }

// Suppress console.warn noise from optional-step error handling
var _origWarn = console.warn;

// Array comparison helper
function assertArrayEq(actual, expected, name) {
  var same = actual.length === expected.length && actual.every(function(v, i) { return v === expected[i]; });
  assert(same, name + (same ? '' : ' — got: [' + actual.join(', ') + '], expected: [' + expected.join(', ') + ']'));
}

// ── Copy pipeline infrastructure from strategy.js ────────────────

var _LAYER_STEPS = [
  { id: 'D0',  label: 'D0 Audience Intelligence',   run: function() { return runDiagnostic(0); } },
  { id: 'KW1', label: 'Keyword data collection',    run: function() { return typeof kwPhase1_DataCollection === 'function' ? kwPhase1_DataCollection() : Promise.resolve(); }, optional: true },
  { id: 'D1',  label: 'D1 Economics',               run: function() { return runDiagnostic(1); } },
  { id: 'D2',  label: 'D2 Positioning',             run: function() { return runDiagnostic(2); } },
  { id: 'D3',  label: 'D3 Subtraction',             run: function() { return runDiagnostic(3); } },
  { id: 'D4',  label: 'D4 Channel Strategy',        run: function() { return runDiagnostic(4); } },
  { id: 'KW2', label: 'AI-Select Keywords',         run: function() { return typeof kwPhase2_Selection === 'function' ? kwPhase2_Selection() : Promise.resolve(); }, optional: true },
  { id: 'D5',  label: 'D5 Website & CRO',           run: function() { return runDiagnostic(5); } },
  { id: 'KW3', label: 'Keyword Clustering',         run: function() { return typeof kwPhase3_Clustering === 'function' ? kwPhase3_Clustering() : Promise.resolve(); }, optional: true },
  { id: 'D6',  label: 'D6 Content & Authority',     run: function() { return runDiagnostic(6); } },
  { id: 'D7',  label: 'D7 Risk Assessment',         run: function() { return runDiagnostic(7); } },
  { id: 'D8',  label: 'D8 Narrative & Messaging',   run: function() { return runDiagnostic(8); }, optional: true },
  { id: 'D9',  label: 'D9 Sales Intelligence',      run: function() { return runDiagnostic(9); }, optional: true },
  { id: 'COMPILE', label: 'Compiling strategy document', run: function() { return compileStrategyOutput().then(function() { return synthesiseWebStrategy(); }); }, optional: true }
];

var _DIAG_TO_STEP = { 0:0, 1:2, 2:3, 3:4, 4:5, 5:7, 6:9, 7:10, 8:11, 9:12 };

async function _runLayeredPipeline(fromStep, toStep, versionLabel) {
  if (typeof toStep !== 'number') toStep = _LAYER_STEPS.length - 1;
  try {
    for (var i = fromStep; i <= toStep; i++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Pipeline paused at ' + _LAYER_STEPS[i].label,
          fn: function(args) { _resumeLayeredPipeline(args.step, args.toStep, args.versionLabel); },
          args: { step: i, toStep: toStep, versionLabel: versionLabel }
        };
        return;
      }
      var step = _LAYER_STEPS[i];
      aiBarStart(step.label);
      if (step.optional) {
        try { await step.run(); } catch(e) { console.warn('[pipeline] ' + step.id + ' error:', e.message); }
      } else {
        await step.run();
      }
      if (i < toStep) await new Promise(function(res) { setTimeout(res, 1500); });
    }
    S.strategy._kwDataStale = false;
    capturePricingSnapshot();
    createStrategyVersion(versionLabel || 'layered_run');
    await saveProject();
    renderStrategyScorecard();
    renderStrategyNav();
    renderStrategyTabContent();
    var endMsg = toStep >= _LAYER_STEPS.length - 1 ? 'complete — doc compiled' : 'complete';
    aiBarEnd('Diagnostics ' + endMsg + ' — v' + S.strategy._meta.current_version);
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

async function _resumeLayeredPipeline(step, toStep, versionLabel) {
  window._aiStopAll = false;
  await _runLayeredPipeline(step, toStep, versionLabel);
}

// ── Wrapper functions (same as strategy.js) ──────────────────────

async function runAllDiagnostics() {
  if (!S.strategy) S.strategy = strategyDefaults();
  window._aiStopAll = false;
  await fetchPricingCatalog();
  await _runLayeredPipeline(0, _LAYER_STEPS.length - 1, 'rerun_all');
}

async function rerunKeywordSensitiveDiagnostics() {
  if (!S.strategy || !S.strategy._meta || S.strategy._meta.current_version < 1) return;
  window._aiStopAll = false;
  await _runLayeredPipeline(5, 9, 'kw_refresh');
}

async function runDiagnosticsFrom(startDiag) {
  if (!S.strategy) S.strategy = strategyDefaults();
  window._aiStopAll = false;
  await fetchPricingCatalog();
  var startStep = _DIAG_TO_STEP[startDiag];
  if (startStep === undefined) startStep = 0;
  await _runLayeredPipeline(startStep, _LAYER_STEPS.length - 1, 'rerun_from_d' + startDiag);
}

// ══════════════════════════════════════════════════════════════════
// RUN ASYNC TESTS + PRINT RESULTS
// ══════════════════════════════════════════════════════════════════

(async function() {

  // ── 6a. Step table structure ───────────────────────────────────
  console.log('\n\x1b[1m═══ _LAYER_STEPS table ═══\x1b[0m');

  assertEq(_LAYER_STEPS.length, 14, 'Step table has exactly 14 entries');

  var expectedIds = ['D0','KW1','D1','D2','D3','D4','KW2','D5','KW3','D6','D7','D8','D9','COMPILE'];
  var actualIds = _LAYER_STEPS.map(function(s) { return s.id; });
  assertArrayEq(actualIds, expectedIds, 'Step IDs in correct layer order');

  // KW phases sit between correct diagnostics
  assertEq(_LAYER_STEPS[5].id, 'D4', 'D4 is at step 5');
  assertEq(_LAYER_STEPS[6].id, 'KW2', 'KW2 (AI-Select) immediately follows D4 at step 6');
  assertEq(_LAYER_STEPS[7].id, 'D5', 'D5 follows KW2 at step 7');
  assertEq(_LAYER_STEPS[8].id, 'KW3', 'KW3 (Clustering) immediately follows D5 at step 8');

  // Optional flags: KW1, KW2, KW3, D8, D9, COMPILE are optional; D0-D7 are not
  var optionalIds = _LAYER_STEPS.filter(function(s) { return s.optional; }).map(function(s) { return s.id; });
  assertArrayEq(optionalIds, ['KW1','KW2','KW3','D8','D9','COMPILE'], 'Optional steps are KW1, KW2, KW3, D8, D9, COMPILE');

  var requiredIds = _LAYER_STEPS.filter(function(s) { return !s.optional; }).map(function(s) { return s.id; });
  assertArrayEq(requiredIds, ['D0','D1','D2','D3','D4','D5','D6','D7'], 'Required steps are D0-D7');

  // Every step has a run function
  var allHaveRun = _LAYER_STEPS.every(function(s) { return typeof s.run === 'function'; });
  assert(allHaveRun, 'Every step has a run function');

  // ── 6b. Diagnostic-to-step mapping ────────────────────────────
  console.log('\n\x1b[1m═══ _DIAG_TO_STEP mapping ═══\x1b[0m');

  assertEq(Object.keys(_DIAG_TO_STEP).length, 10, 'All 10 diagnostics mapped (D0-D9)');
  assertEq(_DIAG_TO_STEP[0], 0, 'D0 → step 0');
  assertEq(_DIAG_TO_STEP[1], 2, 'D1 → step 2 (after KW1)');
  assertEq(_DIAG_TO_STEP[4], 5, 'D4 → step 5');
  assertEq(_DIAG_TO_STEP[5], 7, 'D5 → step 7 (after KW2)');
  assertEq(_DIAG_TO_STEP[6], 9, 'D6 → step 9 (after KW3)');
  assertEq(_DIAG_TO_STEP[9], 12, 'D9 → step 12');

  // D0=0 is falsy in JS — verify mapping returns 0, not undefined
  var d0Step = _DIAG_TO_STEP[0];
  assert(d0Step === 0 && d0Step !== undefined, 'D0 mapping returns 0 (not undefined) — D0-falsy guard');

  // Every mapped step points to the correct diagnostic
  assertEq(_LAYER_STEPS[_DIAG_TO_STEP[0]].id, 'D0', 'Mapped D0 resolves to D0 step');
  assertEq(_LAYER_STEPS[_DIAG_TO_STEP[4]].id, 'D4', 'Mapped D4 resolves to D4 step');
  assertEq(_LAYER_STEPS[_DIAG_TO_STEP[9]].id, 'D9', 'Mapped D9 resolves to D9 step');

  // ── 6c. Full pipeline execution order ─────────────────────────
  console.log('\n\x1b[1m═══ _runLayeredPipeline — execution order ═══\x1b[0m');

  _resetPipe();
  await _runLayeredPipeline(0, _LAYER_STEPS.length - 1, 'test_full');
  assertArrayEq(_pLog,
    ['D0','KW1','D1','D2','D3','D4','KW2','D5','KW3','D6','D7','D8','D9','COMPILE','WEBBRIEF'],
    'Full pipeline (0→13) executes all 15 operations in correct layer order');
  assertEq(_pFinalized, true, 'Full pipeline finalises (capturePricingSnapshot called)');
  assertEq(_pVersionLabel, 'test_full', 'Version label propagated correctly');
  assertEq(S.strategy._kwDataStale, false, '_kwDataStale cleared after full run');

  // ── 6d. Partial pipeline ranges ───────────────────────────────
  console.log('\n\x1b[1m═══ _runLayeredPipeline — partial ranges ═══\x1b[0m');

  // rerunKeywordSensitiveDiagnostics range: steps 5-9 = D4 → KW2 → D5 → KW3 → D6
  _resetPipe();
  await _runLayeredPipeline(5, 9, 'kw_refresh');
  assertArrayEq(_pLog, ['D4','KW2','D5','KW3','D6'],
    'Steps 5-9 (kw_refresh) runs D4 → KW2 → D5 → KW3 → D6');

  // runDiagnosticsFrom(D5) → steps 7-13 = D5 → KW3 → D6 → D7 → D8 → D9 → COMPILE + WEBBRIEF
  _resetPipe();
  await _runLayeredPipeline(7, _LAYER_STEPS.length - 1, 'from_d5');
  assertArrayEq(_pLog, ['D5','KW3','D6','D7','D8','D9','COMPILE','WEBBRIEF'],
    'Steps 7-13 (from D5) runs D5 → KW3 → D6 → D7-D9 → COMPILE');

  // runDiagnosticsFrom(D6) → steps 9-13 = D6 → D7 → D8 → D9 → COMPILE + WEBBRIEF (no KW phases)
  _resetPipe();
  await _runLayeredPipeline(9, _LAYER_STEPS.length - 1, 'from_d6');
  assertArrayEq(_pLog, ['D6','D7','D8','D9','COMPILE','WEBBRIEF'],
    'Steps 9-13 (from D6) skips KW phases — no keyword work needed');

  // Single step: D0 only (step 0 to 0)
  _resetPipe();
  await _runLayeredPipeline(0, 0, 'just_d0');
  assertArrayEq(_pLog, ['D0'], 'Single step (0→0) runs only D0');
  assertEq(_pFinalized, true, 'Single step still finalises');

  // COMPILE only (step 13 to 13)
  _resetPipe();
  await _runLayeredPipeline(13, 13, 'just_compile');
  assertArrayEq(_pLog, ['COMPILE','WEBBRIEF'], 'Single step (13→13) runs COMPILE + WEBBRIEF');

  // ── 6e. Stop / Resume ─────────────────────────────────────────
  console.log('\n\x1b[1m═══ Pipeline stop/resume ═══\x1b[0m');

  // Stop after D3 — pipeline should halt before D4
  _resetPipe();
  _diagStopAfter = 3;
  await _runLayeredPipeline(0, _LAYER_STEPS.length - 1, 'stop_test');
  assertArrayEq(_pLog, ['D0','KW1','D1','D2','D3'],
    'Pipeline stops after D3 — D4 not executed');
  assert(window._aiStopResumeCtx !== null, 'Resume context is set after stop');
  assertEq(window._aiStopResumeCtx.args.step, 5, 'Resume step is 5 (D4) — the next step after D3');
  assertEq(window._aiStopResumeCtx.args.versionLabel, 'stop_test', 'Resume preserves version label');
  assertEq(_pFinalized, false, 'Stopped pipeline does not finalise');

  // Resume from where we stopped
  _diagStopAfter = null;
  await _resumeLayeredPipeline(
    window._aiStopResumeCtx.args.step,
    window._aiStopResumeCtx.args.toStep,
    window._aiStopResumeCtx.args.versionLabel
  );
  assertArrayEq(_pLog,
    ['D0','KW1','D1','D2','D3','D4','KW2','D5','KW3','D6','D7','D8','D9','COMPILE','WEBBRIEF'],
    'Resume continues from D4 and completes the full pipeline');
  assertEq(_pFinalized, true, 'Resumed pipeline finalises');

  // Stop before first step (pre-stopped)
  _resetPipe();
  window._aiStopAll = true;
  await _runLayeredPipeline(0, _LAYER_STEPS.length - 1, 'pre_stop');
  assertArrayEq(_pLog, [], 'Pre-stopped pipeline executes nothing');
  assertEq(window._aiStopResumeCtx.args.step, 0, 'Pre-stop resume starts at step 0');

  // Stop after D4 — resume should include KW2
  _resetPipe();
  _diagStopAfter = 4;
  await _runLayeredPipeline(0, _LAYER_STEPS.length - 1, 'stop_d4');
  assert(_pLog.indexOf('KW2') === -1, 'KW2 not executed before stop at D4');
  assertEq(window._aiStopResumeCtx.args.step, 6, 'Resume after D4 starts at step 6 (KW2)');

  // ── 6f. Error handling ─────────────────────────────────────────
  console.log('\n\x1b[1m═══ Pipeline error handling ═══\x1b[0m');
  console.warn = function() {}; // suppress expected warnings

  // Optional step (KW1) error — pipeline continues
  _resetPipe();
  _kwFails.KW1 = true;
  await _runLayeredPipeline(0, 5, 'kw1_fail');
  assert(_pLog.indexOf('KW1') === -1, 'Failed KW1 not in execution log');
  assertArrayEq(_pLog, ['D0','D1','D2','D3','D4'],
    'Pipeline continues past failed optional KW1 — all diagnostics run');
  assertEq(_pFinalized, true, 'Pipeline finalises despite optional failure');

  // Optional step (D8) error — D9 and COMPILE still run
  _resetPipe();
  _diagFails.D8 = true;
  await _runLayeredPipeline(10, 13, 'optional_d8_fail');
  assert(_pLog.indexOf('D8') === -1, 'Failed D8 not in execution log');
  assertArrayEq(_pLog, ['D7','D9','COMPILE','WEBBRIEF'],
    'D8 failure does not block D9 or COMPILE');

  // Required step (D1) error — propagates to error handler, stops pipeline
  _resetPipe();
  _diagFails.D1 = true;
  await _runLayeredPipeline(0, 5, 'required_fail');
  assert(_pLog.indexOf('D2') === -1, 'D2 not executed after D1 failure');
  assertEq(_pFinalized, false, 'Required step failure prevents finalisation');

  console.warn = _origWarn; // restore

  // ── 6g. Wrapper functions ──────────────────────────────────────
  console.log('\n\x1b[1m═══ Wrapper functions ═══\x1b[0m');

  // runAllDiagnostics — full pipeline
  _resetPipe();
  await runAllDiagnostics();
  assertArrayEq(_pLog,
    ['D0','KW1','D1','D2','D3','D4','KW2','D5','KW3','D6','D7','D8','D9','COMPILE','WEBBRIEF'],
    'runAllDiagnostics runs full layered pipeline');
  assertEq(_pVersionLabel, 'rerun_all', 'runAllDiagnostics version label is rerun_all');

  // rerunKeywordSensitiveDiagnostics — D4 through D6 with KW phases
  _resetPipe();
  await rerunKeywordSensitiveDiagnostics();
  assertArrayEq(_pLog, ['D4','KW2','D5','KW3','D6'],
    'rerunKeywordSensitiveDiagnostics runs D4 → KW2 → D5 → KW3 → D6');
  assertEq(_pVersionLabel, 'kw_refresh', 'rerunKeywordSensitiveDiagnostics version label is kw_refresh');

  // rerunKeywordSensitiveDiagnostics guard — no strategy
  _resetPipe();
  S.strategy = null;
  await rerunKeywordSensitiveDiagnostics();
  assertArrayEq(_pLog, [], 'rerunKeywordSensitiveDiagnostics with no strategy runs nothing');

  // runDiagnosticsFrom(0) — D0 is falsy but should still work
  _resetPipe();
  await runDiagnosticsFrom(0);
  assertEq(_pLog[0], 'D0', 'runDiagnosticsFrom(0) starts with D0 (D0-falsy guard)');
  assertEq(_pLog.length, 15, 'runDiagnosticsFrom(0) runs all 15 operations');
  assertEq(_pVersionLabel, 'rerun_from_d0', 'runDiagnosticsFrom(0) version label correct');

  // runDiagnosticsFrom(4) — starts at D4, includes KW2 + KW3
  _resetPipe();
  await runDiagnosticsFrom(4);
  assertEq(_pLog[0], 'D4', 'runDiagnosticsFrom(4) starts with D4');
  assertEq(_pLog[1], 'KW2', 'runDiagnosticsFrom(4) runs KW2 after D4');
  assertEq(_pLog[2], 'D5', 'runDiagnosticsFrom(4) runs D5 after KW2');
  assert(_pLog.indexOf('D0') === -1, 'runDiagnosticsFrom(4) does not re-run D0');
  assert(_pLog.indexOf('KW1') === -1, 'runDiagnosticsFrom(4) does not re-run KW1');

  // runDiagnosticsFrom(6) — starts at D6, no KW phases needed
  _resetPipe();
  await runDiagnosticsFrom(6);
  assertEq(_pLog[0], 'D6', 'runDiagnosticsFrom(6) starts with D6');
  assert(_pLog.indexOf('KW2') === -1, 'runDiagnosticsFrom(6) skips KW2');
  assert(_pLog.indexOf('KW3') === -1, 'runDiagnosticsFrom(6) skips KW3');

  // runDiagnosticsFrom(8) — starts at D8 (optional), includes D9 + COMPILE
  _resetPipe();
  await runDiagnosticsFrom(8);
  assertArrayEq(_pLog, ['D8','D9','COMPILE','WEBBRIEF'],
    'runDiagnosticsFrom(8) runs D8 → D9 → COMPILE');

  // Restore setTimeout
  global.setTimeout = _origTimeout;

  // ══════════════════════════════════════════════════════════════════
  // RESULTS
  // ══════════════════════════════════════════════════════════════════
  console.log('\n\x1b[1m═══════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m  ' + _pass + ' passed, ' + _fail + ' failed\x1b[0m');
  if (_fail > 0) {
    console.log('\x1b[31m  FAILURES:\x1b[0m');
    _errors.forEach(function(e) { console.log('    \x1b[31m✗\x1b[0m ' + e); });
    process.exit(1);
  } else {
    console.log('\x1b[32m  ALL TESTS PASSED ✓\x1b[0m');
  }
  console.log('');
})();
