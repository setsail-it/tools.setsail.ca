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
