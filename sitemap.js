
function confirmRunSitemap() {
  if (S.pages && S.pages.length > 0) {
    if (!confirm('Rebuild the sitemap? This will recalculate all pages from clusters.\n\nExisting copy, images, and schema data will be preserved.\n\nContinue?')) return;
  }
  buildSitemapFromClusters();
}

// ── PERSISTENCE ────────────────────────────────────────────────────
let saveTimer = null;
function _normSlug(url) {
  return (url||'').trim().replace(/^https?:\/\/[^/]+/,'').replace(/^\/+/,'').replace(/\/+$/,'').toLowerCase();
}
function _slugToName(slug) {
  if (!slug) return 'Homepage';
  return slug.split(/[/\-_]/).map(function(w){ return w.charAt(0).toUpperCase()+w.slice(1); }).join(' ');
}
function _guessPageType(slug) {
  if (!slug) return 'home';
  var s = slug.toLowerCase();
  if (/about/.test(s)) return 'about';
  if (/contact|quote|consult/.test(s)) return 'contact';
  if (/blog|news|article|post|guide|resource/.test(s)) return 'blog';
  if (/location|city|area|region|near/.test(s)) return 'location';
  if (/case-stud|portfolio|work|project/.test(s)) return 'blog';
  if (/team|people|staff/.test(s)) return 'team';
  if (/faq|faqs/.test(s)) return 'faq';
  if (/privacy|terms|sitemap|thank/.test(s)) return 'utility';
  return 'service';
}

function buildSitemapFromClusters() {
  var btn = document.getElementById('sitemap-run-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span> Building...'; }

  var clusters = (S.kwResearch && S.kwResearch.clusters) || [];
  var topPages = (S.snapshot && S.snapshot.topPages) || [];

  // Build existing slug index
  var importRaw = (document.getElementById('sitemap-import-urls')&&document.getElementById('sitemap-import-urls').value) || S.existingUrlsText || '';
  var importSlugs = importRaw.split('\n').map(_normSlug).filter(Boolean);
  var snapSlugs = topPages.map(function(p){ return _normSlug(p.slug); }).filter(Boolean);
  var allExisting = new Set(importSlugs.concat(snapSlugs));

  // Helpers to pull snapshot data for a slug
  function snapPage(slug) {
    return topPages.find(function(p){ return _normSlug(p.slug) === slug; }) || null;
  }
  function existingTraffic(slug) { var p = snapPage(slug); return p ? (p.traffic||0) : 0; }
  function existingRankKws(slug) { var p = snapPage(slug); return p ? (p.rankingKws||[]) : []; }

  var pages = [];
  var covered = new Set();

  // 1. Structurals — always present
  // Resolve structural slugs against actual existing pages (e.g. about-us vs about)
  function _resolveStructuralSlug(candidates) {
    for (var i=0; i<candidates.length; i++) {
      if (allExisting.has(candidates[i])) return candidates[i];
    }
    return candidates[0]; // default
  }
  var structurals = [
    { slug: _resolveStructuralSlug(['','index']), page_name: 'Homepage', page_type: 'home', is_structural: true, search_intent: 'navigational' },
    { slug: _resolveStructuralSlug(['about','about-us','our-story','who-we-are']), page_name: 'About', page_type: 'about', is_structural: true, search_intent: 'navigational' },
    { slug: _resolveStructuralSlug(['contact','contact-us','get-in-touch','reach-us']), page_name: 'Contact', page_type: 'contact', is_structural: true, search_intent: 'transactional' },
  ];
  structurals.forEach(function(s) {
    var sp = snapPage(s.slug);
    // Assign best ranking kw if available
    var rkws = existingRankKws(s.slug);
    pages.push(Object.assign({}, s, {
      priority: 'P1',
      action: 'improve_existing',
      primary_keyword: sp && rkws.length ? (rkws[0].kw || '') : '',
      primary_vol: sp && rkws.length ? (rkws[0].volume || 0) : 0,
      primary_kd: 0,
      score: 0,
      supporting_keywords: rkws.slice(1,6).map(function(k){ return k.kw||k; }),
      existing_traffic: existingTraffic(s.slug),
      existing_ranking_kws: rkws,
    }));
    covered.add(s.slug);
  });

  // 2. Clusters → pages
  clusters.forEach(function(c) {
    var slug = _normSlug(c.suggestedSlug||'');
    if (covered.has(slug)) return;
    var isExisting = allExisting.has(slug) || c.recommendation === 'improve_existing';
    var vol = c.primaryVol || 0;
    var kd = c.primaryKd || 0;
    var score = vol >= 50 && kd > 0 ? Math.round((Math.log(vol+1)*100/Math.max(kd,5))*10)/10 : 0;
    var priority = vol >= 500 ? 'P1' : vol >= 100 ? 'P2' : 'P3';
    pages.push({
      page_name: c.name || _slugToName(slug),
      slug: slug,
      page_type: c.pageType || 'service',
      is_structural: false,
      priority: priority,
      action: isExisting ? 'improve_existing' : 'build_new',
      primary_keyword: c.primaryKw || '',
      primary_vol: vol,
      primary_kd: kd,
      score: score,
      supporting_keywords: (c.supportingKws||[]).slice(0,10).map(function(k){ return typeof k==='object'?k.kw:k; }),
      search_intent: c.searchIntent || 'commercial',
      existing_traffic: existingTraffic(slug),
      existing_ranking_kws: existingRankKws(slug),
    });
    covered.add(slug);
  });

  // 3. Existing pages not matched by any cluster
  allExisting.forEach(function(slug) {
    if (covered.has(slug)) return;
    var sp = snapPage(slug);
    var rkws = existingRankKws(slug);
    pages.push({
      page_name: _slugToName(slug),
      slug: slug,
      page_type: _guessPageType(slug),
      is_structural: false,
      priority: 'P3',
      action: 'improve_existing',
      primary_keyword: rkws.length ? (rkws[0].kw||'') : '',
      primary_vol: 0, primary_kd: 0, score: 0,
      supporting_keywords: rkws.slice(1,6).map(function(k){ return k.kw||k; }),
      search_intent: 'commercial',
      existing_traffic: sp ? (sp.traffic||0) : 0,
      existing_ranking_kws: rkws,
    });
  });

  // Sort: structurals first, then P1→P3, then by score desc
  var pOrd = {P1:0,P2:1,P3:2};
  pages.sort(function(a,b){
    if (a.is_structural && !b.is_structural) return -1;
    if (!a.is_structural && b.is_structural) return 1;
    var pd = pOrd[a.priority] - pOrd[b.priority];
    if (pd !== 0) return pd;
    return (b.score||0) - (a.score||0);
  });

  S.pages = pages;

  // Inject assigned PAA questions into their matching pages
  var questions = (S.contentIntel && S.contentIntel.paa && S.contentIntel.paa.questions) || [];
  questions.forEach(function(q) {
    if (!q.assignedSlug || !q.question) return;
    var qSlug = q.assignedSlug.replace(/^\//, '');
    var target = S.pages.find(function(p) { return _normSlug(p.slug) === qSlug; });
    if (target) {
      if (!target.assignedQuestions) target.assignedQuestions = [];
      if (!target.assignedQuestions.includes(q.question)) target.assignedQuestions.push(q.question);
    }
  });

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh"></i> Regenerate'; }
  enrichSitemapWithKwData();
  document.getElementById('sitemap-stream-wrap').style.display = 'none';
  document.getElementById('sitemap-results').style.display = '';
  renderSitemapResults(false);
  scheduleSave();
  enrichSitemapWithLiveData();
}

function attemptSitemapParseFromText(text) {
  // Shared parse logic — returns true if successful
  function fixTrailing(s) { return s.replace(/,\s*([\]\}])/g, '$1'); }
  let parsed = null;
  try { parsed = JSON.parse(fixTrailing(text.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim())); } catch(e) {}
  if (!parsed) {
    try { const s=text.indexOf('['),e=text.lastIndexOf(']'); if(s>=0&&e>s) parsed=JSON.parse(fixTrailing(text.slice(s,e+1))); } catch(e) {}
  }
  if (!parsed) {
    try { const s=text.indexOf('['); if(s>=0){ let e=text.length-1; while(e>s&&text[e]!=='}')e--; if(e>s) parsed=JSON.parse(fixTrailing(text.slice(s,e+1))+']'); } } catch(e) {}
  }
  if (!parsed) {
    try { const s=text.indexOf('{'),e=text.lastIndexOf('}'); if(s>=0&&e>s){const obj=JSON.parse(fixTrailing(text.slice(s,e+1)));parsed=Array.isArray(obj)?obj:(obj.pages||obj.sitemap||null);} } catch(e) {}
  }
  if (parsed && Array.isArray(parsed) && parsed.length) {
    S.pages = parsed;
    enrichSitemapWithKwData();
    document.getElementById('sitemap-stream-wrap').style.display = 'none';
    renderSitemapResults(false);
    scheduleSave();
    enrichSitemapWithLiveData();
    return true;
  }
  return false;
}

function attemptSitemapParse() {
  const streamEl = document.getElementById('sitemap-stream');
  const wrap = document.getElementById('sitemap-stream-wrap');
  if (!streamEl) return;
  let text = streamEl.textContent.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
  let parsed = null;

  // 1. Direct parse
  try { parsed = JSON.parse(text); } catch(e) {}

  // 2. Extract array
  if (!parsed) { try { const s=text.indexOf('['),e=text.lastIndexOf(']'); if(s>=0&&e>s) parsed=JSON.parse(text.slice(s,e+1)); } catch(e) {} }

  // 3. Truncated array: find last closing brace and append ]
  if (!parsed) {
    try {
      const s = text.indexOf('[');
      if (s >= 0) {
        let end = text.length - 1;
        while (end > s && text[end] !== '}') end--;
        if (end > s) parsed = JSON.parse(text.slice(s, end + 1) + ']');
      }
    } catch(e) {}
  }

  // 4. Wrapped object
  if (!parsed) {
    try {
      const s=text.indexOf('{'),e=text.lastIndexOf('}');
      if(s>=0&&e>s){const obj=JSON.parse(text.slice(s,e+1));parsed=Array.isArray(obj)?obj:(obj.pages||obj.sitemap||null);}
    } catch(e) {}
  }
  if (parsed) {
    S.pages = Array.isArray(parsed) ? parsed : parsed;
    enrichSitemapWithKwData();
    wrap.style.display = 'none';
    renderSitemapResults(false);
    scheduleSave();
    enrichSitemapWithLiveData();
  } else {
    if(typeof aiBarNotify==='function') aiBarNotify('Could not parse sitemap — try Regenerate', {isError:true,duration:4000});
  }
}

async function runSitemap(withRevisions) {
  const btn = document.getElementById('sitemap-run-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span> Generating...';
  document.getElementById('sitemap-results').style.display = 'none';
  const wrap = document.getElementById('sitemap-stream-wrap');
  const streamEl = document.getElementById('sitemap-stream');
  wrap.style.display = 'block'; streamEl.textContent = '';

  const r = S.research||{};
  const revNote = withRevisions ? document.getElementById('sitemap-revisions') : null;

  // Existing site pages from import panel
  const _importRaw = (document.getElementById('sitemap-import-urls')?.value || S.existingUrlsText || '').trim();
  const _importedPages = _importRaw ? _importRaw.split('\n').map(u=>u.trim()).filter(Boolean) : [];
  if (_importRaw) S.existingUrlsText = _importRaw; // persist across renders

  // Client context — brief, secondary to keyword data
  let prompt = '## CLIENT CONTEXT\n';
  prompt += 'Client: ' + S.setup.client + '\n';
  prompt += 'Primary geo: ' + (r.geography?.primary || S.setup.geo || 'N/A') + '\n';
  prompt += 'Secondary geos: ' + ((r.geography?.secondary || []).join(', ') || 'none') + '\n';
  prompt += 'Services: ' + ((r.primary_services || []).join(', ') || 'N/A') + '\n';
  prompt += 'Value prop: ' + (getStrategyField('positioning.value_proposition', 'value_proposition') || r.business_overview || '') + '\n';
  var _ws = ((S.strategy&&S.strategy.webStrategy)||(S.setup&&S.setup.webStrategy)||'').trim();
  if (_ws) prompt += '\n## WEBSITE STRATEGY (use this to derive page_goal for each page)\n' + _ws.slice(0, 3000) + '\n\n';
  else prompt += '\n';

  // Use pre-clustered data if available (preferred), fall back to raw keywords
  if (S.kwResearch?.clusters?.length) {
    const clusters = S.kwResearch.clusters;
    prompt += '## PRE-CLUSTERED PAGE GROUPS (' + clusters.length + ' clusters)\n';
    prompt += 'Each cluster maps to one page. Use primaryKw as primary_keyword exactly.\n\n';
    clusters.forEach((c, i) => {
      const sk = (c.supportingKws || []).slice(0, 5).map(s => typeof s === 'object' ? s.kw : s).join(', ');
      prompt += (i+1) + '. ' + (c.name||'') + ' | slug: ' + (c.suggestedSlug||'') + ' | type: ' + (c.pageType||'service') + ' | kw: ' + (c.primaryKw||'') + ' | vol: ' + (c.primaryVol||0) + ' | kd: ' + (c.primaryKd||0) + '\n';
      if (sk) prompt += '   supporting: ' + sk + '\n';
      if (c.recommendation) prompt += '   action: ' + c.recommendation + (c.existingSlug ? ' (existing: /' + c.existingSlug + ')' : '') + '\n';
    });
    prompt += '\n## INSTRUCTIONS\n- Convert each cluster to one page object\n- Use EXACT primaryKw string from each cluster\n- improve_existing: use existingSlug; build_new: use suggestedSlug\n- Priority: P1 = vol > 500; P2 = vol 100-500; P3 = rest\n- Always include /about and /contact as structural pages\n';
  } else if (S.kwResearch?.keywords?.length) {
    const kws = S.kwResearch.keywords.filter(k => k.vol > 0).slice(0, 150);
    prompt += '## KEYWORD LIST (' + kws.length + ' keywords)\n';
    kws.forEach((k, i) => { prompt += (i+1) + ' | ' + k.kw + ' | ' + k.vol + ' | ' + k.kd + '\n'; });
    const _ep = Math.min(Math.max(8, Math.ceil(kws.length / 4)), 40);
    prompt += '\n## INSTRUCTIONS\n- Cluster into ' + _ep + '-' + (_ep + 6) + ' pages. Homepage = broadest brand keyword. Service = specific service+city.\n';
  } else {
    prompt += '## TASK\nNo keyword data. Build best-guess sitemap from services list.\n';
  }

    if (withRevisions && revNote?.value.trim()) prompt += '\n## REVISION NOTES\n' + revNote.value;

  try {
    const result = await callClaude(P.sitemap, prompt, t => { streamEl.textContent = t; streamEl.scrollTop = streamEl.scrollHeight; }, 8000);
    const parsed = safeParseJSON(result);
    if (Array.isArray(parsed) && parsed.length) {
      S.pages = parsed; enrichSitemapWithKwData(); wrap.style.display = 'none'; renderSitemapResults(false); scheduleSave(); enrichSitemapWithLiveData();
    } else {
      streamEl.textContent = result;
      // Auto-attempt parse before showing error
      const autoRetry = attemptSitemapParseFromText(result);
      if (autoRetry) { wrap.style.display = 'none'; return; }
      // Add retry button
      const retryDiv = document.createElement('div');
      retryDiv.style.cssText = 'padding:10px;background:rgba(0,0,0,0.3);display:flex;gap:8px;align-items:center;flex-wrap:wrap';
      retryDiv.innerHTML = '<span style="color:rgba(255,255,255,0.5);font-size:11px">Parse failed — click retry to extract JSON</span>'
        + '<button onclick="attemptSitemapParse()" style="background:var(--lime);border:none;padding:5px 10px;border-radius:4px;font-size:11px;cursor:pointer;font-family:var(--font)">⟳ Retry Parse</button>';
      wrap.appendChild(retryDiv);
    }
  } catch(e) { streamEl.textContent = 'Error: '+e.message; }
  btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh"></i> Regenerate';
}

function enrichSitemapWithKwData() {
  // Since Claude pulls keywords verbatim from S.kwResearch, this is a guaranteed lookup
  if (!S.pages?.length) return;
  const cached = {};
  (S.kwResearch?.keywords || []).forEach(k => {
    cached[k.kw.toLowerCase().trim()] = k;
  });
  S.pages = S.pages.map(p => {
    const pk = (p.primary_keyword || '').toLowerCase().trim();
    const hit = cached[pk];
    if (hit) { p.primary_vol = hit.vol; p.primary_kd = hit.kd; p.score = hit.score; }
    if (p.supporting_keywords?.length) {
      p.supporting_keywords = p.supporting_keywords.map(sk => {
        const raw = (typeof sk === 'object' ? (sk.kw || '') : String(sk)).trim();
        const h = cached[raw.toLowerCase()];
        if (h) return { kw: raw, vol: h.vol, kd: h.kd };
        return typeof sk === 'object' ? sk : { kw: raw, vol: 0, kd: 0 };
      });
    }
    return p;
  });
}

async function enrichSitemapWithLiveData(forceAll) {
  // Async pass: lookup keywords grouped by page target geo
  if (!S.pages?.length) return;

  // Group keywords by country (from page targetGeo)
  var geoGroups = {}; // { country: { kws: Set, pageIdxs: [] } }
  S.pages.forEach(function(p, idx) {
    var country = getPageCountry(p);
    if (!geoGroups[country]) geoGroups[country] = { kws: new Set(), pageIdxs: [] };
    geoGroups[country].pageIdxs.push(idx);
    var pk = (p.primary_keyword || '').trim();
    if (pk.length > 2 && (forceAll || !p.primary_vol || p.primary_vol === 0)) geoGroups[country].kws.add(pk);
    (p.supporting_keywords || []).forEach(function(sk) {
      var kw = typeof sk === 'object' ? sk.kw : sk;
      if (kw && kw.length > 2 && (forceAll || !sk.vol || sk.vol === 0)) geoGroups[country].kws.add(kw.trim());
    });
  });

  var totalKws = Object.values(geoGroups).reduce(function(sum, g) { return sum + g.kws.size; }, 0);
  if (!totalKws) return;

  var enrichBadge = document.getElementById('sitemap-enrich-badge');
  var enrichText = document.getElementById('sitemap-enrich-text');
  if (enrichBadge) { enrichBadge.style.display = 'inline-flex'; }
  if (enrichText) enrichText.textContent = 'Fetching ' + totalKws + ' keyword volumes…';

  var countries = Object.keys(geoGroups);
  try {
    for (var ci = 0; ci < countries.length; ci++) {
      var country = countries[ci];
      var kwList = [...geoGroups[country].kws];
      if (!kwList.length) continue;
      if (enrichText && countries.length > 1) enrichText.textContent = 'Fetching ' + kwList.length + ' keywords (' + country + ')…';

      var res = await fetch('/api/ahrefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: kwList, country: country })
      });
      var data = await res.json();
      if (!data.keywords) continue;

      // Build lookup from fresh data
      var fresh = {};
      data.keywords.forEach(function(k) { fresh[k.keyword.toLowerCase().trim()] = k; });

      // Also add to kwResearch cache
      if (!S.kwResearch) S.kwResearch = { keywords: [], fetchedAt: Date.now(), source: 'dataforseo' };
      var existingKws = new Set(S.kwResearch.keywords.map(function(k) { return k.kw.toLowerCase(); }));
      data.keywords.filter(function(k) { return k.volume > 0 && !existingKws.has(k.keyword.toLowerCase()); }).forEach(function(k) {
        var kd = k.difficulty > 0 ? k.difficulty : 50;
        S.kwResearch.keywords.push({ kw: k.keyword, vol: k.volume, kd: k.difficulty, score: Math.round((Math.log(k.volume+1)*100/kd)*10)/10, country: country });
      });

      // Apply fresh data to pages in this geo group
      geoGroups[country].pageIdxs.forEach(function(idx) {
        var p = S.pages[idx];
        var pk = (p.primary_keyword || '').toLowerCase().trim();
        var hit = fresh[pk];
        if (hit && hit.volume > 0) {
          p.primary_vol = hit.volume;
          p.primary_kd = hit.difficulty || 0;
          var kd2 = hit.difficulty > 0 ? hit.difficulty : 50;
          p.score = hit.volume >= 50 ? Math.round((Math.log(hit.volume+1)*100/Math.max(kd2,5))*10)/10 : 0;
        }
        if (p.supporting_keywords && p.supporting_keywords.length) {
          p.supporting_keywords = p.supporting_keywords.map(function(sk) {
            var raw = typeof sk === 'object' ? sk.kw : String(sk);
            var h = fresh[raw.toLowerCase().trim()];
            return h && h.volume > 0 ? { kw: raw, vol: h.volume, kd: h.difficulty || 0 } : (typeof sk === 'object' ? sk : { kw: raw, vol: 0, kd: 0 });
          });
        }
      });
    }

    scheduleSave();
    renderSitemapResults(S.sitemapApproved);
    if (enrichBadge) enrichBadge.style.display = 'none';

  } catch(e) {
    if (enrichBadge) enrichBadge.style.display = 'none';
    console.warn('Live enrich failed:', e.message);
    if (typeof aiBarNotify === 'function') aiBarNotify('Volume fetch failed: ' + e.message, {duration:4000});
  }
}


function toggleSitemapEdit() {
  sitemapEditMode = !sitemapEditMode;
  renderSitemapResults(S.sitemapApproved);
}

function movePage(idx, dir) {
  const pages = S.pages;
  const n = idx + dir;
  if (n < 0 || n >= pages.length) return;
  [pages[idx], pages[n]] = [pages[n], pages[idx]];
  scheduleSave();
  renderSitemapResults(S.sitemapApproved);
}

function deletePage(idx) {
  const name = S.pages[idx]?.page_name || 'this page';
  if (!confirm('Delete "' + name + '"?')) return;
  S.pages.splice(idx, 1);
  scheduleSave();
  renderSitemapResults(S.sitemapApproved);
}

function addNewPage() {
  S.pages.push({
    page_name: 'New Page', slug: 'new-page', page_type: 'service',
    is_structural: false, priority: 'P2', primary_keyword: '',
    primary_vol: 0, primary_kd: 0, score: 0,
    supporting_keywords: [], search_intent: 'commercial',
    word_count_target: 1500, notes: '', meta_title: '', meta_description: '',
    targetGeo: '', page_goal: ''
  });
  scheduleSave();
  renderSitemapResults(S.sitemapApproved);
  setTimeout(() => { const inp = document.querySelector('.page-name-edit:last-of-type'); if(inp) inp.focus(); }, 60);
}

async function generatePageGoal(idx) {
  var p = S.pages[idx];
  if (!p) return;
  var btn = document.getElementById('goal-ai-btn-'+idx);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span>'; }
  var R = S.research || {};
  var ws = ((S.strategy&&S.strategy.webStrategy)||(S.setup&&S.setup.webStrategy)||'').trim();
  var sys = 'You are a senior CRO + SEO strategist. Write a 1-2 sentence page goal — the strategic purpose this page must achieve. Be specific: name the audience segment, the desired action, and the proof required. No generic goals. Canadian spelling.';
  var user = 'Client: '+(R.client_name||S.setup.client||'')+'\n'
    + 'Page: '+p.page_name+' (/'+p.slug+')\n'
    + 'Type: '+(p.page_type||'')+'\n'
    + 'Primary keyword: '+(p.primary_keyword||'none')+' ('+( p.primary_vol||0)+'/mo)\n'
    + 'Intent: '+(p.search_intent||'')+'\n'
    + 'Geo: '+(getPageGeo(p)||'')+'\n'
    + (ws ? '\nWebsite strategy:\n'+ws.slice(0,2000)+'\n' : '')
    + ((getStrategyField('positioning.value_proposition', 'value_proposition')) ? '\nValue prop: '+(getStrategyField('positioning.value_proposition', 'value_proposition'))+'\n' : '')
    + (R.primary_audience_description ? '\nAudience: '+R.primary_audience_description+'\n' : '')
    + '\nOutput ONLY the 1-2 sentence goal. No labels, no bullets, no preamble.';
  try {
    var result = await callClaude(sys, user, null, 300);
    var goal = result.replace(/^["'\s]+|["'\s]+$/g,'').trim();
    S.pages[idx].page_goal = goal;
    var ta = document.getElementById('goal-ta-'+idx);
    if (ta) ta.value = goal;
    scheduleSave();
  } catch(e) { if(typeof aiBarNotify==='function') aiBarNotify('Goal generation failed: '+e.message, {duration:4000}); }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles" style="font-size:9px"></i>'; }
}

async function generateAllPageGoals(startFrom) {
  var pages = S.pages || [];
  var empty = pages.filter(function(p){ return !p.page_goal || !p.page_goal.trim(); });
  if (!empty.length && !startFrom) { if(typeof aiBarNotify==='function') aiBarNotify('All pages already have goals', {duration:3000}); return; }
  window._aiStopAll = false;
  if(typeof aiBarStart==='function') aiBarStart('Generating page goals');
  var start = startFrom || 0;
  var generated = 0;
  for (var i = start; i < pages.length; i++) {
    if (window._aiStopAll) {
      window._aiStopResumeCtx = {
        label: 'Goals paused (' + i + '/' + pages.length + ')',
        fn: function(args) { generateAllPageGoals(args.startFrom); },
        args: { startFrom: i }
      };
      return;
    }
    if (pages[i].page_goal && pages[i].page_goal.trim()) continue;
    if(typeof aiBarNotify==='function') aiBarNotify('Goal '+(i+1)+'/'+pages.length+': '+pages[i].page_name, {duration:2000});
    try {
      await generatePageGoal(i);
      generated++;
    } catch(e) { if (e.name === 'AbortError') return; }
  }
  window._aiStopResumeCtx = null;
  renderSitemapResults(S.sitemapApproved);
  if(typeof aiBarEnd==='function') aiBarEnd();
  if(typeof aiBarNotify==='function') aiBarNotify('Page goals generated for '+generated+' pages', {duration:4000});
}

function updatePageField(idx, field, val) {
  if (!S.pages[idx]) return;
  S.pages[idx][field] = val;
  // Recompute is_structural when page_type changes
  // Only truly utility/boilerplate pages are structural — home/about/contact/blog all need copy & images
  if (field === 'page_type') {
    S.pages[idx].is_structural = val === 'utility';
  }
  scheduleSave();
}

async function updatePrimaryKw(idx, rawKw) {
  const kw = rawKw.trim();
  if (!kw) return;
  if (kw === (S.pages[idx]?.primary_keyword || '')) return;
  S.pages[idx].primary_keyword = kw;
  S.pages[idx].primary_vol = 0; S.pages[idx].primary_kd = 0; S.pages[idx].score = 0;
  // Cache lookup first
  const cached = (S.kwResearch?.keywords || []).find(k => k.kw.toLowerCase() === kw.toLowerCase());
  if (cached) {
    S.pages[idx].primary_keyword = cached.kw;
    S.pages[idx].primary_vol = cached.vol;
    S.pages[idx].primary_kd = cached.kd;
    S.pages[idx].score = cached.score || (cached.vol>=50&&cached.kd>0 ? Math.round((Math.log(cached.vol+1)*100/Math.max(cached.kd,5))*10)/10 : 0);
    scheduleSave(); renderSitemapResults(S.sitemapApproved); return;
  }
  // Live DataForSEO lookup — use page-level geo if set
  const country = getPageCountry(S.pages[idx]);
  try {
    const res = await fetch('/api/ahrefs', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keywords:[kw],country})});
    const data = await res.json();
    const hit = data.keywords?.find(k => k.keyword.toLowerCase() === kw.toLowerCase());
    if (hit) {
      S.pages[idx].primary_keyword = hit.keyword;
      S.pages[idx].primary_vol = hit.volume || 0;
      S.pages[idx].primary_kd = hit.difficulty || 0;
      const v=hit.volume||0,d=hit.difficulty||0;
      S.pages[idx].score = v>=50&&d>0 ? Math.round((Math.log(v+1)*100/Math.max(d,5))*10)/10 : 0;
    }
  } catch(e) { console.error('[sitemap] keyword lookup failed:', e.message); if(typeof aiBarNotify==='function') aiBarNotify('Keyword lookup failed: ' + e.message, {duration:4000}); }
  scheduleSave(); renderSitemapResults(S.sitemapApproved);
}

function showMermaidModal() {
  const pages = S.pages || [];
  const safeId = s => ('N_'+s).replace(/[^a-zA-Z0-9_]/g,'_');
  const pStroke = p => p.priority==='P1'?'#158E1D':p.priority==='P2'?'#e69900':'#aaa';
  let lines = ['graph TD'];
  // Collect parent groups
  const parents = [...new Set(pages.filter(p=>(p.slug||'').includes('/')).map(p=>p.slug.split('/')[0]))];
  // Home
  const home = pages.find(p => !p.slug || p.slug==='' || p.slug==='/');
  const homeId = 'Home';
  if (home) {
    const kl = home.primary_keyword ? `\n${home.primary_keyword} · ${(home.primary_vol||0).toLocaleString()}/mo` : '';
    lines.push(`  ${homeId}["🏠 Home${kl}"]`);
    lines.push(`  style ${homeId} fill:#D8FF29,stroke:#158E1D,color:#111111`);
  }
  // Parent group nodes
  parents.forEach(g => {
    const id = safeId(g);
    const label = g.charAt(0).toUpperCase()+g.slice(1);
    lines.push(`  ${id}["📁 /${g}"]`);
    lines.push(`  style ${id} fill:#f0f0f0,stroke:#ccc,color:#333`);
    if (home) lines.push(`  ${homeId} --> ${id}`);
  });
  // Pages
  pages.forEach(p => {
    if (!p.slug && home) return;
    const slug = p.slug || '';
    const parts = slug.split('/').filter(Boolean);
    const id = safeId(slug || 'home');
    if (id === homeId) return;
    const kl = p.primary_keyword ? `\n${p.primary_keyword}\n${(p.primary_vol||0).toLocaleString()}/mo` : '';
    lines.push(`  ${id}["${p.page_name}${kl}"]`);
    lines.push(`  style ${id} fill:#ffffff,stroke:${pStroke(p)},color:#111111`);
    if (parts.length > 1) {
      const parentId = safeId(parts[0]);
      lines.push(`  ${parentId} --> ${id}`);
    } else if (parts.length === 1) {
      if (home) lines.push(`  ${homeId} --> ${id}`);
    }
  });
  const mermaid = lines.join('\n');
  // Build modal
  let modal = document.getElementById('mermaid-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'mermaid-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  modal.innerHTML = `<div style="background:var(--white);border-radius:12px;padding:24px;max-width:720px;width:100%;max-height:82vh;display:flex;flex-direction:column;gap:14px;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div>
        <div style="font-size:14px;font-weight:500;color:var(--dark)">🌿 Mermaid Sitemap Export</div>
        <div style="font-size:11.5px;color:var(--n2);margin-top:3px">In FigJam: <strong>Insert → Mermaid diagram</strong> → paste → Done</div>
      </div>
      <button onclick="document.getElementById('mermaid-modal').remove()" style="background:transparent;border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;color:var(--n2);white-space:nowrap">✕ Close</button>
    </div>
    <pre id="mermaid-output" style="background:var(--panel);border-radius:8px;padding:14px 16px;font-size:10.5px;font-family:monospace;overflow:auto;white-space:pre;color:var(--dark);border:1px solid var(--border);line-height:1.65;flex:1;max-height:52vh">${mermaid}</pre>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" id="mermaid-copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('mermaid-output').textContent).then(()=>{this.innerHTML='<i class=\'ti ti-check\'></i> Copied!';setTimeout(()=>this.innerHTML='<i class=\'ti ti-copy\'></i> Copy to Clipboard',2200)})"><i class='ti ti-copy'></i> Copy to Clipboard</button>
      <a href="https://www.figma.com/figjam/" target="_blank" class="btn btn-ghost" style="text-decoration:none"><i class="ti ti-external-link"></i> Open FigJam</a>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function showHtmlSitemapModal() {
  const pages = S.pages || [];
  const site = (S.setup?.url || '').replace(/\/$/, '');
  // Group pages
  const groups = [
    { label: 'P1 — Priority', color: '#158E1D', bg: 'rgba(21,142,29,0.07)', pages: pages.filter(p=>p.priority==='P1') },
    { label: 'P2 — Secondary', color: '#F5A623', bg: 'rgba(245,166,35,0.07)', pages: pages.filter(p=>p.priority==='P2') },
    { label: 'P3 — Support', color: '#888', bg: 'rgba(0,0,0,0.03)', pages: pages.filter(p=>p.priority==='P3') },
  ].filter(g => g.pages.length > 0);
  let rows = '';
  groups.forEach(g => {
    rows += `<tr><td colspan="4" style="padding:10px 12px 4px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${g.color};background:${g.bg};border-bottom:1px solid rgba(0,0,0,0.06)">${g.label} (${g.pages.length})</td></tr>`;
    g.pages.forEach((p,i) => {
      const url = site + '/' + p.slug;
      const copyDone = !!(S.copy[p.slug]||{}).copy;
      const schemaDone = !!(S.schema[p.slug]||{}).schema;
      const imgDone = (S.images[p.slug]?.slots||[]).length > 0 && (S.images[p.slug]?.slots||[]).every(s=>s.status==='done');
      const rowBg = i%2===0?'#fff':'#fafaf8';
      rows += `<tr style="background:${rowBg}">`;
      rows += `<td style="padding:7px 12px;font-size:12px;color:#333;font-weight:500">${esc(p.page_name)}</td>`;
      rows += `<td style="padding:7px 10px;font-size:11px;color:#666;font-family:monospace"><a href="${url}" target="_blank" style="color:#158E1D;text-decoration:none">/${esc(p.slug)}</a></td>`;
      rows += `<td style="padding:7px 10px;font-size:11px;color:#555">${esc(p.primary_keyword||'')}</td>`;
      rows += `<td style="padding:7px 10px;text-align:center">`;
      rows += `<span title="Copy" style="font-size:13px">${copyDone?'\xe2\x9c\x85':'\xe2\xac\x9c'}</span> `;
      rows += `<span title="Schema" style="font-size:13px">${schemaDone?'\xe2\x9c\x85':'\xe2\xac\x9c'}</span> `;
      rows += `<span title="Images" style="font-size:13px">${imgDone?'\xe2\x9c\x85':'\xe2\xac\x9c'}</span>`;
      rows += `</td></tr>`;
    });
  });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(S.setup?.client||'Sitemap')} — Sitemap</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;background:#f5f4f0;padding:24px}h1{font-size:20px;font-weight:600;color:#111;margin-bottom:4px}p{font-size:13px;color:#888;margin-bottom:18px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)}th{padding:9px 12px;background:#f0efea;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#666;font-weight:600;text-align:left;border-bottom:2px solid #e5e4e0}td{border-bottom:1px solid #f0f0ee}a{color:#158E1D}</style>
</head><body><h1>${esc(S.setup?.client||'Sitemap')}</h1><p>${site} &mdash; ${pages.length} pages &mdash; Generated ${new Date().toLocaleDateString()}</p>
<table><thead><tr><th>Page</th><th>URL</th><th>Primary Keyword</th><th style="text-align:center">Copy / Schema / Images</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob([html], {type:'text/html'});
  const bUrl = URL.createObjectURL(blob);
  const w = window.open('', '_blank', 'width=960,height=720,scrollbars=yes');
  if (w) { w.document.write(html); w.document.close(); }
  else {
    const a = document.createElement('a'); a.href = bUrl; a.download = (S.setup?.client||'sitemap').toLowerCase().replace(/\s+/g,'-')+'-sitemap.html'; a.click();
  }
}

function switchSitemapTab(tab) { _sitemapCatTab = tab; renderSitemapResults(S.sitemapApproved); }

function renderSitemapResults(approved) {
  try { _renderSitemapResultsInner(approved); } catch(err) {
    console.error('renderSitemapResults crash:', err);
    const el = document.getElementById('sitemap-results');
    if (el) { el.innerHTML = '<div style="padding:20px;color:red;font-family:monospace;font-size:12px;background:#fff1f0;border:1px solid #ffccc7;border-radius:8px;margin:8px 0"><strong>\u26A0 Render error</strong><br>' + esc(err.message) + '<br><br><small>' + esc((err.stack||'').split('\n').slice(0,4).join('\n')).replace(/\n/g,'<br>') + '</small></div>'; el.style.display='block'; }
  }
}
function _renderSitemapResultsInner(approved) {
  const allPages = S.pages;

  // Derive existing slugs from import textarea
  const _importText = document.getElementById('sitemap-import-urls')?.value || S.existingUrlsText || '';
  const _existingSlugs = new Set(
    _importText.split('\n').map(u => u.trim().replace(/^https?:\/\/[^/]+/,'').replace(/^\/$/,'').replace(/^\//,'').replace(/\/$/,''))
      .filter(Boolean)
  );
  const hasImport = _existingSlugs.size > 0;

  // Category filter
  const _catFilter = p => {
    if (_sitemapCatTab === 'all') return true;
    const t = (p.page_type||'').toLowerCase();
    if (_sitemapCatTab === 'service') return ['service','industry','product'].includes(t);
    if (_sitemapCatTab === 'location') return t === 'location';
    if (_sitemapCatTab === 'blog') return ['blog','article','recipe','event','portfolio'].includes(t);
    if (_sitemapCatTab === 'core') return ['home','about','contact','utility','faq','team'].includes(t) || !!p.is_structural;
    return true;
  };
  const pages = allPages.filter(_catFilter);

  const p1 = allPages.filter(p=>p.priority==='P1').length;
  const p2 = allPages.filter(p=>p.priority==='P2').length;
  const p3 = allPages.filter(p=>p.priority==='P3').length;
  const zeroVol = allPages.filter(p => !p.is_structural && (!p.primary_vol || p.primary_vol === 0)).length;
  const hasKwData = S.kwResearch?.keywords?.length > 0;

  let html = '<div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">';
  html += '<span style="background:var(--dark);color:white;font-size:11px;padding:3px 10px;border-radius:4px">'+allPages.length+' pages</span>';
  html += '<span class="chip green">P1: '+p1+'</span><span class="chip warn">P2: '+p2+'</span><span class="chip">P3: '+p3+'</span>';
  if (zeroVol > 0) html += '<span style="background:rgba(220,50,47,0.1);color:var(--error);font-size:11px;padding:3px 10px;border-radius:4px;border:1px solid rgba(220,50,47,0.2)">⚠ '+zeroVol+' zero-vol</span>';
  html += '<span id="sitemap-enrich-badge" style="display:none;background:rgba(21,142,29,0.08);color:var(--green);font-size:11px;padding:3px 10px;border-radius:4px;border:1px solid rgba(21,142,29,0.2);align-items:center;gap:5px"><span class="spinner" style="width:8px;height:8px"></span> <span id="sitemap-enrich-text">Fetching keyword volumes</span></span>';
  html += '</div>';

  // Category tabs
  const _tabCounts = {
    all: allPages.length,
    service: allPages.filter(p => ['service','industry','product'].includes((p.page_type||'').toLowerCase())).length,
    location: allPages.filter(p => (p.page_type||'') === 'location').length,
    blog: allPages.filter(p => ['blog','article','recipe','event','portfolio'].includes((p.page_type||'').toLowerCase())).length,
    core: allPages.filter(p => ['home','about','contact','utility','faq','team'].includes((p.page_type||'').toLowerCase()) || !!p.is_structural).length
  };
  const _tabs = [{id:'all',label:'All'},{id:'service',label:'Services'},{id:'location',label:'Locations'},{id:'blog',label:'Blog'},{id:'core',label:'Core'}];
  html += '<div style="display:flex;gap:0;margin-bottom:12px;border-bottom:2px solid var(--border)">';
  _tabs.forEach(t => {
    if (_tabCounts[t.id] === 0 && t.id !== 'all') return;
    const isAct = _sitemapCatTab === t.id;
    html += '<button onclick="switchSitemapTab(\''+t.id+'\')" style="background:none;border:none;border-bottom:2px solid '+(isAct?'var(--green)':'transparent')+';margin-bottom:-2px;padding:5px 14px;font-size:11.5px;font-family:var(--font);color:'+(isAct?'var(--green)':'var(--n2)')+';cursor:pointer;font-weight:'+(isAct?'500':'400')+';white-space:nowrap">'+t.label+' <span style="font-size:10px;opacity:0.6">'+_tabCounts[t.id]+'</span></button>';
  });
  html += '</div>';

  // Keyword opportunities table
  html += '<div style="margin-bottom:18px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;gap:8px">';
  html += '<div style="font-size:11px;color:var(--n2);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap">Page Performance Map</div>';
  html += '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">';
  if (hasKwData) {
    html += '<span style="font-size:11px;color:var(--green)"><i class="ti ti-database" style="font-size:10px"></i> DataForSEO data live</span>';
    html += '<button class="btn btn-ghost sm" data-tip="Refetches DataForSEO volumes for all keywords in the sitemap, grouped by each page target market. Use after making keyword or market edits." style="font-size:11px;padding:2px 8px" onclick="enrichSitemapWithLiveData(true)"><i class="ti ti-refresh"></i> Refresh</button>';
  }
  html += '<button class="btn btn-ghost sm" data-tip="AI-generates a strategic page goal for every page that does not have one yet. Uses the website strategy, page type, keyword intent, and CRO context." style="font-size:11px;padding:2px 8px" onclick="generateAllPageGoals()"><i class="ti ti-sparkles"></i> Goals</button>';
  html += '<button class="btn btn-ghost sm" data-tip="Generates a visual hierarchy diagram of the sitemap — shows parent/child page relationships. Useful for client presentations and IA review." style="font-size:11px;padding:2px 8px" onclick="showMermaidModal()"><i class="ti ti-sitemap"></i> Mermaid</button>';
  html += '<button class="btn '+(sitemapEditMode?'btn-primary':'btn-ghost')+' sm" style="font-size:11px;padding:2px 8px" data-tip="Toggle edit mode to modify page names, slugs, types, priorities, and keywords inline. Changes auto-save. Exit edit mode before approving." onclick="toggleSitemapEdit()"><i class="ti ti-'+(sitemapEditMode?'check':'pencil')+'"></i> '+(sitemapEditMode?'Done':'Edit')+'</button>';
  html += '</div></div>';
  html += '<div style="font-size:10.5px;color:var(--n2);margin-bottom:8px">Cluster anchors set page scope and SEO purpose. Niche keyword expansion and copy-level keyword assignment happen in Stage 6 — Briefs.</div>';

  // Grid: # | Page + slug | Keyword | Vol | KD | Score | Intent | Priority | Market | Traffic
  const gcols = sitemapEditMode ? '22px 1.4fr 1.1fr 54px 42px 48px 62px 48px 76px 54px' : '22px 1.4fr 1.1fr 54px 42px 48px 62px 52px 76px 54px';
  html += '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">';
  html += '<div style="display:grid;grid-template-columns:'+gcols+';background:var(--bg);padding:7px 14px;border-bottom:1px solid var(--border);font-size:10px;color:var(--n2);letter-spacing:.06em;text-transform:uppercase">'
    + '<span>#</span><span>Page</span><span title="Cluster anchor keyword — sets page scope. Niche variants &amp; copy-level assignment happen in Stage 6 Briefs.">Cluster Anchor <span style="font-size:8px;font-weight:400;opacity:0.6;text-transform:none">↓ Stage 6</span></span><span>Vol/mo</span><span>KD</span><span>Score</span><span title="Search intent of the page">Intent</span><span>Priority</span><span title="Target market — inherits primary market unless overridden">Market</span><span title="Existing monthly organic traffic">Traffic</span>'
    + ''
    + '</div>';

  // Display sort: Core → Service/Industry/Product → Location → Blog → rest
  // Within each type: P1 → P2 → P3, then score desc
  const _typeOrder = { home:0, about:0, contact:0, utility:0, faq:0, team:0,
    service:1, industry:1, product:1,
    location:2,
    blog:3, article:3, recipe:3, event:3, portfolio:3 };
  const _pOrder = { P1:0, P2:1, P3:2 };
  pages.sort(function(a, b) {
    var ta = _typeOrder[( a.page_type||'').toLowerCase()];
    var tb = _typeOrder[(b.page_type||'').toLowerCase()];
    if (ta === undefined) ta = 4;
    if (tb === undefined) tb = 4;
    if (ta !== tb) return ta - tb;
    var pa = _pOrder[a.priority] !== undefined ? _pOrder[a.priority] : 3;
    var pb = _pOrder[b.priority] !== undefined ? _pOrder[b.priority] : 3;
    if (pa !== pb) return pa - pb;
    return (b.score || 0) - (a.score || 0);
  });

  // Render pages split: Active (existing site) | Suggested (to build)
  const _activePgs = hasImport ? pages.filter(p => _existingSlugs.has(p.slug)) : [];
  const _suggestedPgs = hasImport ? pages.filter(p => !_existingSlugs.has(p.slug)) : pages;

  const _renderPageRow = (p) => {
    const i = allPages.indexOf(p);
    let html = ''; // local html for this row
    const pColor = p.priority==='P1'?'var(--green)':p.priority==='P2'?'var(--warn)':'var(--n2)';
    const vol = typeof p.primary_vol === 'number' ? p.primary_vol : (parseInt(p.primary_vol) || 0);
    const kd = typeof p.primary_kd === 'number' ? p.primary_kd : (parseInt(p.primary_kd) || 0);
    const score = p.score || (vol >= 50 && kd > 0 ? Math.round((Math.log(vol+1)*100/Math.max(kd,5))*10)/10 : 0);
    const isStructural = !!p.is_structural;
    const kdColor = kd === 0 ? 'var(--n2)' : kd <= 20 ? 'var(--green)' : kd <= 40 ? 'var(--warn)' : 'var(--error)';
    const isSubPage = (p.slug||'').includes('/');
    const rowBg = i%2===0 ? 'var(--white)' : 'rgba(0,0,0,0.012)';

    // Vol display — colour signal only, no row dimming
    let volHtml;
    if (isStructural && vol === 0) {
      volHtml = '<span style="color:var(--n2);font-size:10px">–</span>';
    } else if (vol === 0) {
      volHtml = '<span style="color:var(--error);font-size:11px;font-weight:500">⚠ 0</span>';
    } else if (vol < 30) {
      volHtml = '<span style="color:var(--warn);font-size:12px;font-weight:500">'+vol.toLocaleString()+'</span>';
    } else {
      volHtml = '<span style="color:var(--dark);font-size:12px;font-weight:500">'+vol.toLocaleString()+'</span>';
    }

    html += '<div>'; // page block

    // ── MAIN ROW ──
    html += '<div style="display:grid;grid-template-columns:'+gcols+';padding:8px 14px;align-items:start;background:'+rowBg+'">';
    html += '<span style="color:var(--n2);font-size:11px;padding-top:2px">'+(i+1)+'</span>';

    if (sitemapEditMode) {
      // ── Edit mode: Page name cell — inputs + compact icon controls ──
      const btnS = 'background:transparent;border:1px solid var(--border);border-radius:3px;padding:1px 6px;font-size:10px;cursor:pointer;font-family:var(--font);color:var(--n2);line-height:1.5';
      html += '<div style="display:flex;flex-direction:column;gap:3px">';
      html += '<input value="'+esc(p.page_name)+'" onblur="updatePageField('+i+',\'page_name\',this.value)" style="font-size:12px;color:var(--dark);background:rgba(0,0,0,0.04);border:1px solid var(--border);border-radius:4px;padding:3px 7px;font-family:var(--font);outline:none;width:100%"/>';
      html += '<input value="'+esc(p.slug||'')+'" onblur="updatePageField('+i+',\'slug\',this.value)" style="font-size:10px;color:var(--n2);background:rgba(0,0,0,0.04);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-family:var(--font);outline:none;width:100%"/>';
      html += '<select onchange="updatePageField('+i+',\'page_type\',this.value)" style="font-size:10px;color:var(--n2);background:rgba(0,0,0,0.04);border:1px solid var(--border);border-radius:4px;padding:2px 5px;font-family:var(--font);outline:none">';
      ['home','service','industry','location','about','blog','utility'].forEach(function(t){ html += '<option value="'+t+'"'+(p.page_type===t?' selected':'')+'>'+t+'</option>'; });
      html += '</select>';
      // Icon-only reorder/delete
      html += '<div style="display:flex;gap:3px;margin-top:1px">';
      html += `<button onclick="movePage(${i},-1)" ${i===0?'disabled':''} title="Move up" style="${btnS};opacity:${i===0?'0.25':'0.7'}" onmouseover="if(!this.disabled)this.style.opacity='1'" onmouseout="if(!this.disabled)this.style.opacity='0.7'">↑</button>`;
      html += `<button onclick="movePage(${i},1)" ${i===pages.length-1?'disabled':''} title="Move down" style="${btnS};opacity:${i===pages.length-1?'0.25':'0.7'}" onmouseover="if(!this.disabled)this.style.opacity='1'" onmouseout="if(!this.disabled)this.style.opacity='0.7'">↓</button>`;
      html += `<button onclick="deletePage(${i})" title="Delete" style="background:transparent;border:1px solid rgba(220,50,47,0.25);border-radius:3px;padding:1px 6px;font-size:10px;cursor:pointer;font-family:var(--font);color:var(--error);line-height:1.5;opacity:0.55" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.55'">✕</button>`;
      html += '</div>';
      html += '<div style="display:flex;gap:3px;align-items:start">';
      html += '<textarea id="goal-ta-'+i+'" placeholder="Page goal — what must this page achieve?" onblur="updatePageField('+i+',\'page_goal\',this.value)" style="font-size:10px;color:#6b21a8;background:rgba(107,33,168,0.04);border:1px solid rgba(107,33,168,0.2);border-radius:4px;padding:3px 7px;font-family:var(--font);outline:none;flex:1;resize:vertical;min-height:28px;line-height:1.4" rows="1">'+(p.page_goal?esc(p.page_goal):'')+'</textarea>';
      html += '<button id="goal-ai-btn-'+i+'" onclick="generatePageGoal('+i+')" title="AI-generate page goal from strategy" style="background:rgba(107,33,168,0.08);border:1px solid rgba(107,33,168,0.25);border-radius:4px;padding:3px 6px;cursor:pointer;color:#6b21a8;font-size:10px;line-height:1;flex-shrink:0"><i class="ti ti-sparkles" style="font-size:9px"></i></button>';
      html += '</div>';
      html += '</div>';

      // ── Edit mode: Keyword cell — input + AI + Find More inline ──
      html += '<div style="display:flex;flex-direction:column;gap:4px">';
      html += '<input value="'+esc(p.primary_keyword||'')+'" placeholder="primary keyword…" onblur="updatePrimaryKw('+i+',this.value)" onkeydown="if(event.key===\'Enter\')this.blur()" style="font-size:11px;color:var(--n3);background:rgba(0,0,0,0.04);border:1px solid var(--border);border-radius:4px;padding:3px 7px;font-family:var(--font);outline:none;width:100%;margin-top:2px"/>';
      html += '<div style="display:flex;gap:4px;align-items:center">';
      html += `<button id="kw-finder-btn-${i}" onclick="openKwFinder(${i})" style="background:transparent;border:1px solid rgba(21,142,29,0.4);border-radius:3px;padding:2px 8px;font-size:10px;color:var(--green);cursor:pointer;font-family:var(--font);white-space:nowrap"><i class="ti ti-sparkles" style="font-size:9px"></i> Find Keywords</button>`;
      html += `<span id="kw-finder-status-${i}" style="font-size:10px;color:var(--n2)"></span>`;
      html += '</div></div>';

    } else {
      // ── View mode: read-only ──
      html += '<div>';
      if (isSubPage) html += '<span style="width:8px;height:8px;border-left:1px solid var(--n1);border-bottom:1px solid var(--n1);display:inline-block;margin-right:6px;margin-bottom:-1px;vertical-align:middle"></span>';
      html += '<span style="color:var(--dark);font-size:12.5px">'+esc(p.page_name)+'</span>';
      if (isStructural) html += '<span style="background:rgba(0,0,0,0.05);border:1px solid var(--border);border-radius:3px;font-size:9px;padding:1px 5px;color:var(--n2);margin-left:6px;vertical-align:middle">STRUCTURAL</span>';
      var _action = p.action || (p.recommendation) || 'build_new';
      if (_action === 'improve_existing') {
        html += '<span style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:3px;font-size:9px;padding:1px 5px;color:#3b82f6;margin-left:6px;vertical-align:middle;font-weight:500">IMPROVE</span>';
      } else if (_action === 'build_new') {
        html += '<span style="background:rgba(21,142,29,0.08);border:1px solid rgba(21,142,29,0.3);border-radius:3px;font-size:9px;padding:1px 5px;color:var(--green);margin-left:6px;vertical-align:middle;font-weight:500">BUILD NEW</span>';
      }
      html += '<div style="color:var(--n2);font-size:10.5px">/'+(p.slug||'')+'</div>';
      if (p.rationale) html += '<div style="font-size:10px;color:var(--n2);font-style:italic;margin-top:1px">'+esc(p.rationale)+'</div>';
      if (p.page_goal) html += '<div style="font-size:10px;color:#6b21a8;margin-top:2px" title="Page goal: '+esc(p.page_goal)+'"><i class="ti ti-target" style="font-size:10px;margin-right:2px"></i>'+esc(p.page_goal.length>80?p.page_goal.slice(0,80)+'…':p.page_goal)+'</div>';
      html += '</div>';
      const _geo1 = (S.research?.geography?.primary || S.setup?.geo || '').replace(/,.*$/,'').trim();
      var _kwDisplay = p.primary_keyword
      ? '<span style="color:var(--n3);font-size:12px">'+esc(p.primary_keyword)+'</span>'+(intentBadge(p.primary_keyword,_geo1)||'')
      : (isStructural ? '<span style="color:var(--n2);font-size:11px">navigational</span>' : '<span style="color:var(--warn);font-size:11px;font-weight:500">⚠ none</span>');
    html += '<div style="display:flex;align-items:center;gap:5px;padding-top:1px">'+_kwDisplay+'</div>';
    }

    html += volHtml;
    html += '<span style="color:'+kdColor+';font-size:12px;font-weight:500">'+(kd||'?')+'</span>';
    html += '<span style="color:var(--n3);font-size:11px">'+score+'</span>';
    // Intent column
    var _intent = (p.search_intent||'').toLowerCase();
    var _intentColor = _intent==='transactional'?'#e65100':_intent==='commercial'?'#1565c0':_intent==='informational'?'#2e7d32':_intent==='navigational'?'var(--n2)':'var(--n2)';
    var _intentLabel = _intent==='transactional'?'trans':_intent==='commercial'?'comm':_intent==='informational'?'info':_intent==='navigational'?'nav':(_intent||'–');
    if (sitemapEditMode) {
      html += `<select onchange="updatePageField(${i},'search_intent',this.value);renderSitemapResults(S.sitemapApproved)" style="font-size:10px;color:${_intentColor};background:var(--n1);border:1px solid var(--border);border-radius:4px;padding:2px 3px;font-family:var(--font);outline:none">`;
      [{v:'commercial',l:'Comm'},{v:'transactional',l:'Trans'},{v:'informational',l:'Info'},{v:'navigational',l:'Nav'}].forEach(function(o){ html += '<option value="'+o.v+'"'+(_intent===o.v?' selected':'')+'>'+o.l+'</option>'; });
      html += '</select>';
    } else {
      html += '<span style="color:'+_intentColor+';font-size:10px;font-weight:500">'+_intentLabel+'</span>';
    }
    if (sitemapEditMode) {
      html += `<select onchange="updatePageField(${i},'priority',this.value);renderSitemapResults(S.sitemapApproved)" style="font-size:11px;color:${pColor};font-weight:500;background:var(--n1);border:1px solid var(--border);border-radius:4px;padding:2px 4px;font-family:var(--font);outline:none">`;
      ['P1','P2','P3'].forEach(pv => { html += `<option value="${pv}"${p.priority===pv?' selected':''}>${pv}</option>`; });
      html += '</select>';
    } else {
      html += '<span style="color:'+pColor+';font-size:11px;font-weight:500">'+esc(p.priority||'–')+'</span>';
    }
    // Market column
    var _defaultGeoLabel = (S.research&&S.research.geography&&S.research.geography.primary)||(S.setup&&S.setup.geo)||'';
    var _pageGeoVal = p.targetGeo || '';
    if (sitemapEditMode) {
      html += '<input value="'+esc(_pageGeoVal)+'" placeholder="'+esc(_defaultGeoLabel||'—')+'" onblur="updatePageField('+i+',\'targetGeo\',this.value.trim());renderSitemapResults(S.sitemapApproved)" style="font-size:10px;color:'+(_pageGeoVal?'var(--dark)':'var(--n2)')+';background:rgba(0,0,0,0.04);border:1px solid var(--border);border-radius:4px;padding:2px 5px;font-family:var(--font);outline:none;width:100%" title="Target market — leave empty to use primary market"/>';
    } else {
      var _geoDisplay = _pageGeoVal || _defaultGeoLabel;
      var _geoColor = _pageGeoVal ? '#3b82f6' : 'var(--n2)';
      html += '<span style="color:'+_geoColor+';font-size:10px" title="'+esc(_pageGeoVal?'Override: '+_pageGeoVal:'Inherited: '+_defaultGeoLabel)+'">'+esc(_geoDisplay.replace(/,.*$/,'').trim()||'—')+'</span>';
    }
    // Traffic column
    var _traffic = p.existing_traffic || 0;
    var _trafficHtml = _traffic > 0
      ? '<span style="color:var(--green);font-size:11px;font-weight:500">'+(_traffic>=1000?((_traffic/1000).toFixed(1)+'k'):_traffic)+'</span>'
      : '<span style="color:var(--n1);font-size:10px">–</span>';
    html += _trafficHtml;
    html += '</div>'; // end main row

    // ── Inline result panels ──
    html += `<div id="kw-finder-panel-${i}" style="display:none"></div>`;

    // ── Supporting keywords ──
    const suppKws = (p.supporting_keywords || []).filter(sk => { const kw = typeof sk==='object'?sk.kw:sk; return kw && kw.length>0; });
    if (suppKws.length) {
      suppKws.forEach((sk, si) => {
        const kw = typeof sk==='object'?sk.kw:sk;
        const v = typeof sk==='object'?(sk.vol||0):0;
        const d = typeof sk==='object'?(sk.kd||0):0;
        const sc = v>0&&d>0?Math.round((Math.log(v+1)*100/d)*10)/10:0;
        const dColor = d===0?'var(--n2)':d<20?'var(--green)':d<40?'var(--warn)':'var(--error)';
        const vColor = v===0?'var(--n2)':v<50?'var(--warn)':'var(--n3)';
        html += '<div style="display:grid;grid-template-columns:'+gcols+';padding:3px 14px;background:'+rowBg+';border-top:1px dashed rgba(0,0,0,0.06);align-items:center">';
        html += '<span style="color:var(--n1);font-size:11px;padding-left:4px">↳</span>';
        const _geoS = (S.research?.geography?.primary || S.setup?.geo || '').replace(/,.*$/,'').trim();
        html += '<div style="display:flex;align-items:center;gap:5px"><span style="color:var(--n2);font-size:11px">'+esc(kw)+'</span>'+intentBadge(kw,_geoS)+'</div>';
        html += '<span></span>';
        html += '<span style="color:'+vColor+';font-size:11px">'+(v>0?v.toLocaleString():'–')+'</span>';
        html += '<span style="color:'+dColor+';font-size:11px">'+(d>0?d:'–')+'</span>';
        html += '<span style="color:var(--n2);font-size:10px">'+(sc>0?sc:'–')+'</span>';
        if (sitemapEditMode) {
          html += `<span style="text-align:right"><button onclick="removeKeyword(${i},'${kw.replace(/'/g,'')}',event)" style="background:transparent;border:none;cursor:pointer;color:var(--n2);font-size:12px;padding:0 4px;line-height:1;opacity:0.35" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.35'">✕</button></span>`;
        } else {
          html += '<span></span>';
        }
        html += '<span></span><span></span><span></span>'; // Intent + Market + Traffic spacers
        html += '</div>';
      });
    }

    // ── Add keyword row (edit mode only) ──
    if (sitemapEditMode) {
      html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 14px;background:${rowBg};border-top:1px dashed rgba(0,0,0,0.06)">`;
      html += `<input id="kw-add-${i}" type="text" placeholder="+ Add keyword…" style="flex:1;background:transparent;border:none;outline:none;font-size:11px;color:var(--n2);font-family:var(--font)" onkeydown="if(event.key===\'Enter\'){addManualKeyword(${i},this.value);this.value=\'\'}"/>`;
      html += `<button onclick="var inp=document.getElementById(\'kw-add-${i}\');addManualKeyword(${i},inp.value);inp.value=\'\'" style="background:transparent;border:1px solid var(--border);border-radius:4px;padding:2px 7px;font-size:10px;color:var(--n2);cursor:pointer;font-family:var(--font)">Add</button>`;
      html += '</div>';
    }

    html += '</div>'; // end page block
    return html;
  }; // end _renderPageRow

  // Section rendering helper
  const _renderSection = (sectionPages, label, badgeStyle) => {
    if (!sectionPages.length) return '';
    let sh = '';
    if (label) {
      sh += '<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--bg);border-bottom:1px solid var(--border)">';
      sh += '<span style="font-size:10px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;'+badgeStyle+'">'+label+'</span>';
      sh += '<span style="font-size:10px;color:var(--n2)">'+sectionPages.length+' page'+(sectionPages.length!==1?'s':'')+'</span>';
      sh += '</div>';
    }
    sectionPages.forEach((p, si) => {
      html += sh; sh = ''; // only render header once (first iteration)
      html += _renderPageRow(p);
      if (si < sectionPages.length-1) html += '<div style="border-bottom:1px solid var(--border)"></div>';
    });
  };

  if (hasImport) {
    _renderSection(_activePgs, 'Active Pages', 'color:var(--green)');
    if (_activePgs.length && _suggestedPgs.length) html += '<div style="border-bottom:2px solid var(--border)"></div>';
    _renderSection(_suggestedPgs, 'Suggested Pages to Build', 'color:var(--warn)');
  } else {
    // No import: render all as one list
    pages.forEach((p, si) => {
      html += _renderPageRow(p);
      if (si < pages.length-1) html += '<div style="border-bottom:1px solid var(--border)"></div>';
    });
  }

  // Add page button (edit mode only)
  if (sitemapEditMode) {
    html += '<div style="padding:8px 14px;border-top:1px solid var(--border);background:var(--white)">';
    html += '<button onclick="addNewPage()" style="background:transparent;border:1px dashed rgba(21,142,29,0.4);border-radius:6px;padding:5px 14px;font-size:11.5px;color:var(--green);cursor:pointer;font-family:var(--font);width:100%"><i class="ti ti-plus" style="font-size:11px"></i> Add Page</button>';
    html += '</div>';
  }
  html += '</div></div>';


  // ── Content Intelligence section ──
  {
    const ci = S.contentIntel || {};
    const blogTopics = ci.blogTopics || [];
    const paaDone   = (ci.paa?.questions?.length || 0);
    const gapDone   = (ci.gap?.keywords?.length || 0);
    const paaQuestions = ci.paa?.questions || [];
    const gapKeywords  = ci.gap?.keywords  || [];

    // Competitor domains source
    const _researchComps = (S.research?.competitors || []).map(c => {
      const u = (c.url||'').replace(/^https?:\/\/(www\.)?/,'').replace(/\/.*$/,'').trim();
      return u || (c.name||'').toLowerCase().replace(/\s+/g,'')+'.com';
    }).filter(Boolean).slice(0,5);
    const _setupRaw = (S.setup?.competitors || '').replace(/\n/g,' ');
    const _setupDomains = _setupRaw.match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)/gi) || [];
    const _setupComps = _setupDomains.map(d=>d.replace(/^https?:\/\/(www\.)?/,'')).filter(Boolean).slice(0,4);
    const _existingGapEl = document.getElementById('ci-gap-domains');
    const _savedGapDomains = _existingGapEl?.value.trim() || '';
    const competitorStr = _savedGapDomains || (_researchComps.length ? _researchComps.join(', ') : _setupComps.join(', '));

    html += '<div class="card" style="margin-bottom:8px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">';
    html += '<div>';
    html += '<div style="font-size:13px;font-weight:500;color:var(--dark);display:flex;align-items:center;gap:6px"><i class="ti ti-bulb" style="color:var(--green)"></i> Blog Content Pipeline</div>';
    html += '<div style="font-size:11px;color:var(--n2);margin-top:2px">PAA + competitor gaps → blog topic pool → copy queue</div>';
    html += '</div>';
    html += '<div id="ci-queue-actions"></div>';
    html += '</div>';

    // Two mini-panels: PAA + Competitor Gap
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';

    // PAA panel
    html += '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 11px;background:var(--bg);border-bottom:1px solid var(--border)">';
    html += '<span style="font-size:11px;font-weight:500;color:var(--dark);display:flex;align-items:center;gap:5px"><i class="ti ti-help-circle" style="font-size:11px;color:var(--n2)"></i> People Also Ask';
    if (paaDone) html += '<span id="ci-paa-count" style="background:var(--n1);border-radius:10px;padding:1px 6px;font-size:10px;color:var(--n3);margin-left:4px">'+paaDone+'</span>'; else html += '<span id="ci-paa-count"></span>';
    html += '</span>';
    html += '<div style="display:flex;align-items:center;gap:6px"><span id="ci-paa-status"></span>';
    html += '<button id="ci-paa-btn" onclick="runPAA()" style="background:transparent;border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:var(--font);color:var(--n2);display:flex;align-items:center;gap:4px"><i class="ti ti-refresh" style="font-size:9px"></i> '+(paaDone?'Refresh':'Run')+'</button></div>';
    html += '</div>';
    const _allKwPages = (S.pages || []).filter(p => p.primary_keyword).sort((a,b) => { const o={'P1':0,'P2':1,'P3':2}; return (o[a.priority]||3)-(o[b.priority]||3); });
    const _seenKws = new Set();
    const _kwEntries = _allKwPages.reduce((acc,p) => { if (!_seenKws.has(p.primary_keyword)) { _seenKws.add(p.primary_keyword); acc.push({ kw: p.primary_keyword, pri: p.priority||'' }); } return acc; }, []);
    const _existingSeedEl = document.getElementById('ci-paa-seeds');
    const paaSeeds = (_existingSeedEl && _existingSeedEl.value.trim()) ? _existingSeedEl.value.trim() : (_kwEntries[0]?.kw || '');
    const _kwOptions = _kwEntries.map(e => '<option value="'+esc(e.kw)+'"'+(e.kw===paaSeeds?' selected':'')+'>'+esc(e.kw)+(e.pri?' ('+e.pri+')':'')+'</option>').join('');
    html += '<div style="padding:5px 10px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02)">';
    html += '<select id="ci-paa-seeds" style="width:100%;font-size:11px;color:var(--dark);background:transparent;border:none;outline:none;font-family:var(--font);cursor:pointer">'+_kwOptions+'</select>';
    html += '</div>';
    html += '<div id="ci-paa-panel" style="max-height:220px;overflow-y:auto">';
    if (!paaDone) html += '<div style="padding:12px;font-size:11px;color:var(--n2)">Select a keyword above and click Run.</div>';
    html += '</div></div>';

    // Competitor Gap panel
    html += '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 11px;background:var(--bg);border-bottom:1px solid var(--border)">';
    html += '<span style="font-size:11px;font-weight:500;color:var(--dark);display:flex;align-items:center;gap:5px"><i class="ti ti-git-compare" style="font-size:11px;color:var(--n2)"></i> Competitor Gaps';
    if (gapDone) html += '<span id="ci-gap-count" style="background:var(--n1);border-radius:10px;padding:1px 6px;font-size:10px;color:var(--n3);margin-left:4px">'+gapDone+'</span>'; else html += '<span id="ci-gap-count"></span>';
    html += '</span>';
    html += '<div style="display:flex;align-items:center;gap:6px"><span id="ci-gap-status"></span>';
    html += '<button id="ci-gap-btn" onclick="runCompetitorGap()" style="background:transparent;border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:var(--font);color:var(--n2);display:flex;align-items:center;gap:4px"><i class="ti ti-refresh" style="font-size:9px"></i> '+(gapDone?'Refresh':'Run')+'</button></div>';
    html += '</div>';
    html += '<div style="padding:5px 10px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.02)">';
    html += '<input id="ci-gap-domains" value="'+esc(competitorStr)+'" placeholder="e.g. brainlabs.com, jellyfish.com" style="width:100%;font-size:11px;color:var(--dark);background:transparent;border:none;outline:none;font-family:var(--font)" />';
    html += '</div>';
    html += '<div id="ci-gap-panel" style="max-height:220px;overflow-y:auto">';
    if (!gapDone) html += '<div style="padding:12px;font-size:11px;color:var(--n2)">Enter competitor domains above and click Run.</div>';
    html += '</div></div>';
    html += '</div>'; // end two-col grid

    // Unified topic pool
    const _allSources = [
      ...paaQuestions.map(q => ({ text: q.question, source: 'paa', meta: q.seed || '' })),
      ...gapKeywords.map(k => ({ text: (k.keyword||k.kw||String(k)), source: 'gap', meta: 'vol: '+(k.volume||k.vol||'?') }))
    ];
    const _selectedTexts = new Set(blogTopics.map(t => t.text));
    if (_allSources.length > 0) {
      html += '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:10px">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;background:var(--bg);border-bottom:1px solid var(--border)">';
      html += '<span style="font-size:11px;font-weight:500;color:var(--dark)">All Blog Opportunities <span style="background:var(--n1);border-radius:10px;padding:1px 6px;font-size:10px;color:var(--n3)">'+_allSources.length+'</span></span>';
      html += '<span style="font-size:10px;color:var(--n2)">Click + Blog to queue a post</span>';
      html += '</div>';
      html += '<div style="max-height:260px;overflow-y:auto">';
      _allSources.forEach(item => {
        const isAdded = _selectedTexts.has(item.text);
        const srcColor = item.source === 'paa' ? 'var(--green)' : 'var(--n2)';
        const safeText = item.text.replace(/'/g,'&#39;').replace(/"/g,'&quot;');
        html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid rgba(0,0,0,0.04)">';
        html += '<span style="font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;color:'+srcColor+';min-width:28px">'+item.source.toUpperCase()+'</span>';
        html += '<span style="flex:1;font-size:11.5px;color:var(--dark)">'+esc(item.text)+'</span>';
        if (item.meta) html += '<span style="font-size:10px;color:var(--n2);white-space:nowrap;margin-right:4px">'+esc(item.meta)+'</span>';
        if (isAdded) {
          html += '<span style="font-size:10px;color:var(--green);font-weight:500">✓ added</span>';
        } else {
          html += '<button onclick="addBlogTopic(\''+item.source+'\',\''+safeText+'\',\''+esc(item.meta)+'\',this)" style="background:transparent;border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:var(--font);color:var(--n2);white-space:nowrap">+ Blog</button>';
        }
        html += '</div>';
      });
      html += '</div></div>';
    }

    // ── Blog Topics bucket ──
    html += '<div style="border:1px solid var(--border);border-radius:6px;padding:10px 12px;background:var(--bg)">';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:7px"><i class="ti ti-notes" style="font-size:12px;color:var(--n2)"></i><span style="font-size:11px;font-weight:500;color:var(--dark)">Blog Topics</span><span style="font-size:10px;color:var(--n2)">(select + Blog on any item above)</span></div>';
    html += '<div id="ci-topics-panel"></div>';
    html += '</div>';

    html += '</div>'; // end card
  }


  if (!approved) {
    html += '<div class="card dg" style="margin-bottom:8px">';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px"><span style="color:var(--lime);font-size:14px">⛳</span><span style="color:var(--lime);font-weight:500;font-size:13px">Gate 1 — PM Sitemap Approval</span></div>';
    html += '<div style="margin-bottom:12px"><label style="font-size:12px;color:rgba(255,255,255,0.45);display:block;margin-bottom:5px">Revision notes — leave blank to approve as-is</label>';
    html += '<textarea id="sitemap-revisions" rows="3" placeholder="e.g. Add /emergency-services. Remove /about-team." style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:8px 12px;color:rgba(255,255,255,0.8);font-size:13px;font-family:var(--font);resize:vertical;outline:none"></textarea></div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    var _missingKw = S.pages ? S.pages.filter(function(p){
      return !p.is_structural && !['home','about','contact','utility','team'].includes((p.page_type||'').toLowerCase()) && !p.primary_keyword;
    }).length : 0;
    if (_missingKw > 0) {
      html += '<div style="padding:8px 14px;background:rgba(192,112,0,0.08);border:1px solid rgba(192,112,0,0.25);border-radius:6px;font-size:12px;color:var(--warn);margin-bottom:12px"><strong>'+_missingKw+' pages missing a primary keyword</strong> — assign keywords before generating briefs. Use Edit mode → click a row → type in the keyword field, or run Keyword Mapping from Stage 4.</div>';
    }
    html += '<button class="btn btn-primary" onclick="approveSitemap()"><i class="ti ti-check"></i> Approve Sitemap</button>';
    html += '<button class="btn btn-primary" onclick="approveSitemap();goTo(\'briefs\')" style="background:var(--lime);color:var(--dark)"><i class="ti ti-file-description"></i> Approve &amp; Build Briefs</button>';
    html += '<button class="btn btn-dg" onclick="runSitemap(true)"><i class="ti ti-refresh"></i> Revise & Regenerate</button>';
    html += '</div></div>';
  } else {
    html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:4px">';
    html += '<div class="success-banner"><i class="ti ti-check"></i>Sitemap approved — '+pages.length+' pages locked</div>';
    html += '<button class="btn btn-primary" onclick="initCopy();goTo(\'copy\')"><i class="ti ti-arrow-right"></i> Generate Copy</button>';
    html += '<button class="btn btn-ghost" onclick="renderSitemapResults(false)"><i class="ti ti-pencil"></i> Revise</button>';
    html += '</div>';
  }

  const el = document.getElementById('sitemap-results');
  el.innerHTML = html;
  el.style.display = 'block';

  // Restore cached Content Intelligence panels if data exists
  if (S.contentIntel?.paa?.questions?.length) renderPAAPanel();
  if (S.contentIntel?.gap?.keywords?.length)  renderGapPanel();
  renderBlogTopics();
}


// ── CONTENT INTELLIGENCE ───────────────────────────────────────────

async function runPAA() {
  const btn    = document.getElementById('ci-paa-btn');
  const status = document.getElementById('ci-paa-status');
  const panel  = document.getElementById('ci-paa-panel');
  if (!S.pages?.length) return;

  // Only use cache if seeds haven't changed
  const _seedInputEl = document.getElementById('ci-paa-seeds');
  const _currentSeeds = _seedInputEl ? _seedInputEl.value.trim() : '';
  if (S.contentIntel?.paa?.questions?.length && S.contentIntel?.paa?.seeds === _currentSeeds) {
    renderPAAPanel();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:8px;height:8px;display:inline-block;vertical-align:middle"></span>';
  status.textContent = '';

  const geo = (S.research?.geography?.primary || S.setup?.geo || '').replace(/,.*$/, '').trim();
  const geoStr = (geo + '').toLowerCase();
  const country = detectCountry(geoStr);

  // Use editable input if available, else fall back to P1 keywords
  const seedInput = document.getElementById('ci-paa-seeds');
  const seedVal = seedInput ? seedInput.value.trim() : '';
  const kwSeeds = seedVal
    ? seedVal.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8)
    : (S.pages || []).filter(p => p.priority === 'P1' && p.primary_keyword && !p.is_structural).map(p => p.primary_keyword).slice(0, 6);

  if (!kwSeeds.length) {
    status.innerHTML = '<span style="font-size:10px;color:var(--warn)">Enter at least one keyword above</span>';
    btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh" style="font-size:9px"></i> Run';
    return;
  }

  console.log('[PAA] seeds →', kwSeeds);
  status.innerHTML = `<span style="font-size:10px;color:var(--n2)">Fetching for: ${kwSeeds.join(', ')}</span>`;
  try {
    const res = await fetch('/api/paa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: kwSeeds, country })
    });
    const data = await res.json();
    console.log('[PAA] response →', data);
    if (!data.questions?.length) {
      const debugInfo = data.debug ? JSON.stringify(data.debug) : '';
      console.warn('[PAA debug]', debugInfo);
      const seeds = data.cleanedSeeds ? ` (tried: ${data.cleanedSeeds.join(', ')})` : '';
      throw new Error((data.error || 'No questions returned') + seeds);
    }

    if (!S.contentIntel) S.contentIntel = { paa: null, gap: null, blogTopics: [] };
    const _savedSeeds = document.getElementById('ci-paa-seeds')?.value.trim() || '';
    S.contentIntel.paa = { questions: data.questions, seeds: _savedSeeds, fetchedAt: Date.now() };
    scheduleSave();
    renderPAAPanel();
  } catch(err) {
    status.innerHTML = '<span style="font-size:10px;color:var(--error)">⚠ ' + err.message + '</span>';
  }
  btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh" style="font-size:9px"></i> Run';
}

function renderPAAPanel() {
  const panel  = document.getElementById('ci-paa-panel');
  const badge  = document.getElementById('ci-paa-count');
  if (!panel) return;
  const questions = S.contentIntel?.paa?.questions || [];
  if (!questions.length) { panel.innerHTML = ''; return; }

  // Group by question word
  const groups = {};
  const qWord = q => {
    const w = q.trim().toLowerCase();
    if (w.startsWith('what')) return 'What';
    if (w.startsWith('how')) return 'How';
    if (w.startsWith('why')) return 'Why';
    if (w.startsWith('when')) return 'When';
    if (w.startsWith('who')) return 'Who';
    if (w.startsWith('where')) return 'Where';
    if (w.startsWith('which')) return 'Which';
    if (w.startsWith('can') || w.startsWith('do ') || w.startsWith('does') || w.startsWith('is ') || w.startsWith('are ')) return 'Yes/No';
    return 'Other';
  };
  questions.forEach(q => {
    const g = qWord(q.question);
    if (!groups[g]) groups[g] = [];
    groups[g].push(q);
  });

  const topics = new Set((S.contentIntel?.blogTopics || []).map(t => t.text));
  if (badge) badge.textContent = questions.length;

  let h = '';
  const groupOrder = ['What','How','Why','When','Who','Where','Which','Yes/No','Other'];
  groupOrder.forEach(g => {
    if (!groups[g]?.length) return;
    h += `<div style="font-size:9.5px;color:var(--n2);text-transform:uppercase;letter-spacing:.05em;font-weight:500;padding:6px 12px 2px">${g}</div>`;
    groups[g].forEach(q => {
      const added = topics.has(q.question);
      h += `<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;border-bottom:1px dashed rgba(0,0,0,0.05)" id="paa-row-${btoa(q.question.slice(0,20)).replace(/[^a-z0-9]/gi,'').slice(0,12)}">`;
      h += `<span style="flex:1;font-size:11.5px;color:var(--dark)">${esc(q.question)}</span>`;
      h += `<span style="font-size:9.5px;color:var(--n2);white-space:nowrap">${esc(q.source)}</span>`;
      if (added) {
        h += `<span style="font-size:10px;color:var(--green);min-width:42px;text-align:center">✓ added</span>`;
      } else {
        h += `<button onclick="addBlogTopic('paa','${q.question.replace(/'/g,'')}','${(q.source||'').replace(/'/g,'')}',this)" style="background:transparent;border:1px solid var(--border);color:var(--n2);border-radius:3px;padding:1px 7px;font-size:10px;cursor:pointer;font-family:var(--font);white-space:nowrap;min-width:42px">+ Blog</button>`;
      }
      h += '</div>';
    });
  });

  panel.innerHTML = h;
  panel.style.display = 'block';
  renderBlogTopics();
}

async function runCompetitorGap() {
  const btn    = document.getElementById('ci-gap-btn');
  const status = document.getElementById('ci-gap-status');
  const panel  = document.getElementById('ci-gap-panel');

  // Get domains from input
  const domainInput = document.getElementById('ci-gap-domains');
  const rawDomains = (domainInput?.value || '').trim();
  const domains = rawDomains.split(/[\s,\n]+/).map(d => d.trim().replace(/^https?:\/\//,'')).filter(d => d.includes('.'));

  if (!domains.length) {
    status.innerHTML = '<span style="font-size:10px;color:var(--warn)">Enter at least one competitor domain</span>';
    return;
  }

  // Check cache (same domains)
  const cacheKey = domains.sort().join(',');
  if (S.contentIntel?.gap?.cacheKey === cacheKey && S.contentIntel.gap.keywords?.length) {
    renderGapPanel();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:8px;height:8px;display:inline-block;vertical-align:middle"></span>';
  status.textContent = '';

  const geo = (S.research?.geography?.primary || S.setup?.geo || '').replace(/,.*$/, '').trim();
  const geoStr = (geo + '').toLowerCase();
  const country = detectCountry(geoStr);

  // Collect all our own keywords for cross-reference
  const ownKeywords = [];
  (S.pages || []).forEach(p => {
    if (p.primary_keyword) ownKeywords.push(p.primary_keyword);
    (p.supporting_keywords || []).forEach(sk => ownKeywords.push(typeof sk === 'object' ? sk.kw : sk));
  });

  try {
    const res = await fetch('/api/competitor-gap', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains, ownKeywords, country })
    });
    const data = await res.json();
    if (!data.keywords?.length) {
      console.warn('[Gap debug]', JSON.stringify(data.debug));
      throw new Error(data.error || 'No gap keywords found — check console for debug');
    }

    if (!S.contentIntel) S.contentIntel = { paa: null, gap: null, blogTopics: [] };
    S.contentIntel.gap = { keywords: data.keywords, domains, cacheKey, fetchedAt: Date.now() };
    scheduleSave();
    renderGapPanel();
  } catch(err) {
    status.innerHTML = '<span style="font-size:10px;color:var(--error)">⚠ ' + err.message + '</span>';
  }
  btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh" style="font-size:9px"></i> Run';
}

function renderGapPanel() {
  const panel = document.getElementById('ci-gap-panel');
  const badge = document.getElementById('ci-gap-count');
  if (!panel) return;
  const keywords = S.contentIntel?.gap?.keywords || [];
  if (!keywords.length) { panel.innerHTML = ''; return; }

  const topics = new Set((S.contentIntel?.blogTopics || []).map(t => t.text));
  const kdCol = d => d===0?'var(--n2)':d<=20?'var(--green)':d<=40?'var(--warn)':'var(--error)';
  const vCol  = v => v===0?'var(--n2)':v<50?'var(--warn)':'var(--n3)';
  const geo   = (S.research?.geography?.primary || S.setup?.geo || '').replace(/,.*$/,'').trim();
  if (badge) badge.textContent = keywords.length;

  // Header row
  let h = `<div style="display:grid;grid-template-columns:1fr 58px 40px 46px 42px;gap:4px;padding:4px 12px;border-bottom:1px solid var(--border)">`;
  h += `<span style="font-size:9.5px;color:var(--n2);text-transform:uppercase;letter-spacing:.04em">Keyword</span>`;
  h += `<span style="font-size:9.5px;color:var(--n2);text-align:right">Vol</span>`;
  h += `<span style="font-size:9.5px;color:var(--n2);text-align:right">KD</span>`;
  h += `<span style="font-size:9.5px;color:var(--n2);text-align:right">Score</span>`;
  h += `<span></span></div>`;

  keywords.slice(0, 80).forEach(k => {
    const added = topics.has(k.kw);
    h += `<div style="display:grid;grid-template-columns:1fr 58px 40px 46px 42px;gap:4px;align-items:center;padding:4px 12px;border-bottom:1px dashed rgba(0,0,0,0.05)">`;
    h += `<div style="display:flex;align-items:center;gap:4px;min-width:0"><span style="font-size:11.5px;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(k.kw)}</span>${intentBadge(k.kw,geo)}</div>`;
    h += `<span style="font-size:10px;color:${vCol(k.vol)};text-align:right">${k.vol.toLocaleString()}</span>`;
    h += `<span style="font-size:10px;color:${kdCol(k.kd)};text-align:right">${k.kd||'?'}</span>`;
    h += `<span style="font-size:10px;color:var(--n2);text-align:right">${k.score}</span>`;
    if (added) {
      h += `<span style="font-size:10px;color:var(--green);text-align:center">✓</span>`;
    } else {
      h += `<button onclick="addBlogTopic('gap','${k.kw.replace(/'/g,'')}','${(k.domain||'').replace(/'/g,'')}',this)" style="background:transparent;border:1px solid var(--border);color:var(--n2);border-radius:3px;padding:1px 5px;font-size:10px;cursor:pointer;font-family:var(--font)">+ Blog</button>`;
    }
    h += '</div>';
  });

  panel.innerHTML = h;
  panel.style.display = 'block';
  renderBlogTopics();
}

function addBlogTopic(source, text, meta, btn) {
  if (!S.contentIntel) S.contentIntel = { paa: null, gap: null, blogTopics: [] };
  if (!S.contentIntel.blogTopics) S.contentIntel.blogTopics = [];
  const exists = S.contentIntel.blogTopics.some(t => t.text === text);
  if (exists) return;
  S.contentIntel.blogTopics.push({ text, source, meta });
  scheduleSave();
  // Update button in-place
  if (btn) { btn.textContent = '✓ added'; btn.disabled = true; btn.style.color = 'var(--green)'; btn.style.borderColor = 'var(--green)'; }
  renderBlogTopics();
}

function removeBlogTopic(text) {
  if (!S.contentIntel?.blogTopics) return;
  S.contentIntel.blogTopics = S.contentIntel.blogTopics.filter(t => t.text !== text);
  scheduleSave();
  renderPAAPanel();
  renderGapPanel();
}

function renderCIQueueActions() {
  const el = document.getElementById('ci-queue-actions');
  if (!el) return;
  const topics = S.contentIntel?.blogTopics || [];
  if (!topics.length) { el.innerHTML = ''; return; }
  const existingSlugs = new Set((S.pages||[]).map(p=>p.slug));
  const newCount = topics.filter(t => !existingSlugs.has('blog/' + t.text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''))).length;
  let h = '<div style="display:flex;gap:6px;align-items:center">';
  if (newCount > 0) {
    h += `<button class="btn btn-primary sm" onclick="addBlogPagesToSitemap()"><i class="ti ti-plus"></i> Add ${newCount} to Copy Queue</button>`;
  } else {
    h += `<span style="font-size:10px;color:var(--green);display:flex;align-items:center;gap:4px"><i class="ti ti-check"></i> All added</span>`;
  }
  h += `<button id="ci-copy-btn" class="btn btn-ghost sm" onclick="copyBlogTopics()"><i class="ti ti-copy"></i> Copy</button>`;
  h += '</div>';
  el.innerHTML = h;
}

function renderBlogTopics() {
  const el = document.getElementById('ci-topics-panel');
  if (!el) return;
  const topics = S.contentIntel?.blogTopics || [];
  renderCIQueueActions();
  if (!topics.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--n2);padding:4px 0">No topics selected yet — click + Blog on any question or gap keyword above.</div>';
    return;
  }
  let h = '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start">';
  topics.forEach(t => {
    const srcColor = t.source === 'paa' ? 'var(--green)' : 'var(--n2)';
    h += `<div style="display:inline-flex;align-items:center;gap:5px;background:var(--n1);border:1px solid var(--border);border-radius:14px;padding:3px 8px 3px 10px;font-size:11px;color:var(--dark);max-width:320px">`;
    h += `<span style="font-size:9px;color:${srcColor};font-weight:500;text-transform:uppercase;letter-spacing:.04em">${t.source==='paa'?'PAA':'GAP'}</span>`;
    h += `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.text)}">${esc(t.text)}</span>`;
    h += `<button onclick="removeBlogTopic('${t.text.replace(/'/g,'')}')" style="background:none;border:none;cursor:pointer;color:var(--n2);font-size:12px;padding:0;line-height:1;margin-left:2px" title="Remove">✕</button>`;
    h += '</div>';
  });
  h += '</div>';
  el.innerHTML = h;
}

function copyBlogTopics() {
  const topics = S.contentIntel?.blogTopics || [];
  if (!topics.length) return;
  const text = topics.map((t,i) => `${i+1}. [${t.source.toUpperCase()}] ${t.text}`).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('ci-copy-btn');
    if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> Copied!'; setTimeout(() => btn.innerHTML = '<i class="ti ti-copy"></i> Copy', 2000); }
  });
}

function addBlogPagesToSitemap() {
  if (!S.contentIntel?.blogTopics?.length) return;
  const existingSlugs = new Set((S.pages||[]).map(p => p.slug));
  let added = 0;
  S.contentIntel.blogTopics.forEach(t => {
    const slug = 'blog/' + t.text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0, 60);
    if (existingSlugs.has(slug)) return;
    existingSlugs.add(slug);
    S.pages.push({
      page_name: t.text,
      slug,
      page_type: 'blog',
      is_structural: false,
      priority: 'P3',
      primary_keyword: t.text,
      primary_vol: 0, primary_kd: 0, score: 0,
      supporting_keywords: [],
      search_intent: 'informational',
      word_count_target: 1200,
      notes: `Source: ${t.source === 'paa' ? 'People Also Ask' : 'Competitor Gap'}${t.meta ? ' — ' + t.meta : ''}`
    });
    added++;
  });
  if (added > 0) {
    scheduleSave();
    renderSitemapResults(S.sitemapApproved);
  }
}

function approveSitemap() {
  S.stage = 'sitemap'; S.sitemapApproved = true; scheduleSave();
  renderSitemapResults(true);
}

function toggleSitemapImport() {
  const panel = document.getElementById('sitemap-import-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) renderExistingSitePanel();
}

function renderExistingSitePanel() {
  const wrap = document.getElementById('existing-site-panel');
  if (!wrap) return;

  const snapPages = (S.snapshot?.topPages || []).slice(0, 80);
  const baseUrl = (S.setup?.url || '').replace(/\/$/, '');
  const mapping = S.existingSiteMapping || {}; // { slug -> { keyword, isNew } }

  // Sync hidden textarea for Active/Suggested split
  const ta = document.getElementById('sitemap-import-urls');
  if (ta && snapPages.length) {
    const urls = snapPages.map(p => baseUrl + p.slug).join('\n');
    ta.value = urls;
    S.existingUrlsText = urls;
  }

  const hasMapping = Object.keys(mapping).length > 0;
  const hasKwData = (S.kwResearch?.keywords?.length || 0) > 0;

  let html = '<div class="card" style="margin-bottom:0">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">';
  html += '<div>';
  html += '<div style="font-size:13px;font-weight:500;color:var(--dark)">Existing Site Analysis</div>';
  html += '<div style="font-size:11px;color:var(--n2);margin-top:2px">'+(snapPages.length ? snapPages.length+' pages from snapshot' : 'No snapshot data')+'</div>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;align-items:center">';
  if (hasKwData) {
    html += '<button onclick="runKeywordMapping()" id="kw-map-btn" class="btn btn-primary sm"><i class="ti ti-git-merge"></i> Map Keywords to Pages</button>';
  } else {
    html += '<span style="font-size:11px;color:var(--warn)">Run keyword research first to enable mapping</span>';
  }
  html += '</div></div>';

  if (!snapPages.length) {
    html += '<div style="font-size:12px;color:var(--n2);padding:12px 0">Run Site Snapshot first to load existing pages.</div>';
    html += '</div>'; wrap.innerHTML = html; return;
  }

  // Pages table
  html += '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:12px">';
  html += '<div style="display:grid;grid-template-columns:1fr 70px 60px 1.2fr;background:var(--bg);padding:7px 12px;border-bottom:1px solid var(--border);font-size:10px;color:var(--n2);letter-spacing:.06em;text-transform:uppercase">';
  html += '<span>Page URL</span><span>Traffic</span><span>KWs</span><span>Mapped Keyword</span></div>';
  html += '<div style="max-height:340px;overflow-y:auto">';
  snapPages.forEach(p => {
    const m = mapping[p.slug];
    const mappedKw = m?.keyword || '';
    const isNew = m?.isNew || false;
    const kwColor = mappedKw ? (isNew ? 'var(--warn)' : 'var(--green)') : 'var(--n2)';
    const traffic = p.traffic || 0;
    const kws = p.keywords || 0;
    const trafficColor = traffic > 100 ? 'var(--green)' : traffic > 20 ? 'var(--warn)' : 'var(--n2)';
    html += '<div class="tbl-row" style="display:grid;grid-template-columns:1fr 70px 60px 1.2fr;padding:7px 12px;border-bottom:1px solid rgba(0,0,0,0.04);align-items:center;cursor:pointer">';
    html += '<span style="font-size:11.5px;color:var(--dark);font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.slug || '/')+'</span>';
    html += '<span style="font-size:11px;font-weight:500;color:'+trafficColor+'">'+(traffic > 0 ? traffic.toLocaleString() : '<span style="color:var(--n1)">0</span>')+'</span>';
    html += '<span style="font-size:11px;color:var(--n2)">'+kws+'</span>';
    html += '<span style="font-size:11px;color:'+kwColor+'">'+esc(mappedKw || (hasMapping ? '(no match)' : ''))+'</span>';
    html += '</div>';
  });
  html += '</div></div>';

  // Mapping stream/status
  html += '<div id="kw-map-stream-wrap" style="display:none;margin-bottom:10px"><div class="stream-box" id="kw-map-stream"></div></div>';

  // Gap summary
  if (hasMapping) {
    const gaps = Object.values(mapping).filter(m => m.isNew);
    if (gaps.length) {
      html += '<div style="border:1px solid rgba(214,158,46,0.3);border-radius:6px;padding:10px 12px;background:rgba(214,158,46,0.05)">';
      html += '<div style="font-size:11px;font-weight:500;color:var(--warn);margin-bottom:6px">';
      html += '<i class="ti ti-plus" style="font-size:11px"></i> '+gaps.length+' New Page Opportunities Identified</div>';
      gaps.forEach(g => {
        html += '<div style="font-size:11px;color:var(--n3);padding:2px 0">';
        html += '<span style="font-family:monospace;color:var(--n2)">/'+esc(g.suggestedSlug||'')+'</span>';
        html += ' <span style="color:var(--warn)">'+esc(g.keyword)+'</span>';
        if (g.vol) html += ' <span style="color:var(--n2);font-size:10px">'+g.vol.toLocaleString()+'/mo</span>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="font-size:11px;color:var(--green)"><i class="ti ti-check"></i> All keywords mapped to existing pages.</div>';
    }
  }

  html += '</div>';
  wrap.innerHTML = html;
}

async function runKeywordMapping() {
  const btn = document.getElementById('kw-map-btn');
  const streamWrap = document.getElementById('kw-map-stream-wrap');
  const streamEl = document.getElementById('kw-map-stream');
  if (!btn || !streamWrap || !streamEl) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Mapping...';
  streamWrap.style.display = 'block';
  streamEl.textContent = '';

  const snapPages = (S.snapshot?.topPages || []).slice(0, 80);
  const kws = (S.kwResearch?.keywords || []).slice(0, 200);

  const existingList = snapPages.map(p => p.slug + (p.traffic ? ' (traffic:'+p.traffic+')' : '')).join('\n');
  const kwList = kws.map(k => k.kw + ' | vol:' + k.vol + ' | kd:' + k.kd + ' | score:' + k.score).join('\n');

  const system = 'You are an SEO architect. Map keywords to pages and identify gaps. Output ONLY raw JSON, no markdown.';
  const prompt = '## EXISTING PAGES\n' + existingList
    + '\n\n## KEYWORD LIST\n' + kwList
    + '\n\n## TASK\nFor each existing page, assign the best matching keyword from the list (by intent + topic). For keywords that have NO good match in existing pages, mark as a gap (new page needed).\n\n'
    + 'Output JSON:\n{"mappings":[{"slug":"/services/seo","keyword":"seo vancouver","vol":2900,"rationale":"exact intent match"}],"gaps":[{"keyword":"google ads vancouver","vol":20,"suggestedSlug":"services/google-ads-vancouver","rationale":"no existing PPC page"}]}';

  try {
    const result = await callClaude(system, prompt, t => { streamEl.textContent = t; }, 4000);
    const parsed = safeParseJSON(result);
    if (parsed && (parsed.mappings || parsed.gaps)) {
      const newMapping = {};
      (parsed.mappings || []).forEach(m => {
        const slug = m.slug.replace(/^\//, '');
        newMapping['/'+slug] = { keyword: m.keyword, vol: m.vol || 0, isNew: false };
      });
      (parsed.gaps || []).forEach(g => {
        newMapping['__gap__'+g.keyword] = { keyword: g.keyword, vol: g.vol || 0, suggestedSlug: g.suggestedSlug || '', isNew: true };
      });
      S.existingSiteMapping = newMapping;
      scheduleSave();
      streamWrap.style.display = 'none';
      renderExistingSitePanel();
    } else {
      streamEl.textContent = 'Parse failed. Raw: ' + result.slice(0, 300);
    }
  } catch(e) {
    streamEl.textContent = 'Error: ' + e.message;
  }
  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-git-merge"></i> Map Keywords to Pages';
}


async function fetchAhrefsMetrics(forceRefresh) {
  if (!S.pages.length) return;
  const btn = document.getElementById('sitemap-ahrefs-btn');
  const statusEl = document.getElementById('sitemap-ahrefs-status');

  // Use cached unless forced
  if (!forceRefresh && S.kwMetrics && Object.keys(S.kwMetrics).length > 0) {
    renderSitemapResults(S.sitemapApproved);
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Fetching...'; }
  if (statusEl) statusEl.textContent = 'Fetching from Ahrefs...';

  const keywords = [...new Set(S.pages.map(p => p.primary_keyword).filter(Boolean))];
  const country = (S.setup?.geo || 'ca').toLowerCase().slice(0,2);

  try {
    const res = await fetch('/api/ahrefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, country })
    });
    const data = await res.json();

    if (data.keywords) {
      S.kwMetrics = {};
      data.keywords.forEach(k => {
        S.kwMetrics[k.keyword] = { volume: k.volume, kd: k.difficulty };
      });
      scheduleSave();
      renderSitemapResults(S.sitemapApproved);
      return;
    }
    const errMsg = data.error || ('HTTP ' + res.status);
    const isNoKey = data.code === 'NO_KEY';
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">'
      + (isNoKey ? '⚠ No keyword API configured — add DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD secrets in Cloudflare Workers (<a href="https://dataforseo.com" target="_blank" style="color:inherit">dataforseo.com</a> — ~$0.0005/kw)' : '⚠ ' + esc(errMsg))
      + '</span>';
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">⚠ ' + esc(e.message) + '</span>';
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-refresh"></i> Retry'; }
}

async function runGapAnalysis() {
  const urls = document.getElementById('sitemap-import-urls')?.value?.trim();
  if (!urls) return;
  const btn = document.getElementById('sitemap-gap-btn');
  const wrap = document.getElementById('sitemap-gap-stream-wrap');
  const streamEl = document.getElementById('sitemap-gap-stream');
  const resultsEl = document.getElementById('sitemap-gap-results');

  btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Analysing...';
  wrap.style.display = 'block'; streamEl.textContent = '';
  resultsEl.style.display = 'none';

  const existingPages = urls.split('\n').map(u => u.trim()).filter(Boolean);
  const generatedPages = S.pages.map(p => ({ page: p.page_name, slug: '/'+p.slug, kw: p.primary_keyword, priority: p.priority }));

  const prompt = 'EXISTING SITE PAGES (currently live):\n' + existingPages.join('\n')
    + '\n\nGENERATED SITEMAP RECOMMENDATIONS:\n' + JSON.stringify(generatedPages, null, 2)
    + '\n\nCLIENT: ' + (S.setup?.client||'') + '\nINDUSTRY: ' + (S.research?.primary_services?.join(', ')||'')
    + '\n\nAnalyse the gap between existing pages and recommended pages. Identify:\n1. Pages in the generated sitemap that are MISSING from the existing site (high-value opportunities)\n2. Existing pages NOT in the generated sitemap that should be kept or improved\n3. Quick wins — low-KD keywords on existing pages that could rank with minor optimisation\n\nFormat as a clear gap analysis report with specific recommendations. Be concise and actionable.';

  const system = 'You are a senior SEO strategist. Analyse the gap between an existing website and an SEO-optimised sitemap. Output a concise, actionable gap analysis. Use markdown-style formatting with ### headers, bullet points, and clear priority labels (🟢 Quick Win, 🟡 Medium-term, 🔴 New Page Needed).';

  try {
    const result = await callClaude(system, prompt, t => { streamEl.textContent = t; streamEl.scrollTop = streamEl.scrollHeight; }, 3000);
    wrap.style.display = 'none';
    resultsEl.innerHTML = '<div style="font-size:12.5px;color:var(--n3);line-height:1.75;white-space:pre-wrap;background:var(--bg);border-radius:6px;padding:14px;border:1px solid var(--border)">'+esc(result)+'</div>';
    resultsEl.style.display = 'block';
  } catch(e) {
    streamEl.textContent = 'Error: '+e.message;
  }
  btn.disabled = false; btn.innerHTML = '<i class="ti ti-search"></i> Analyse Gaps';
}


// ── COPY ───────────────────────────────────────────────────────────