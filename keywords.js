
async function runKwDebug() {
  const out = document.getElementById('kw-debug-output');
  if (!out) return;
  out.style.display = 'block';
  out.textContent = 'Testing DataForSEO endpoints...';

  const services = (S.research?.primary_services || ['seo','digital marketing']).slice(0, 2);
  const city = (S.research?.geography?.primary || 'vancouver').split(',')[0].trim().toLowerCase();
  const testSeeds = services.map(s => s.toLowerCase().replace(/\s+(services?|management)$/i,'').trim() + ' ' + city).slice(0, 3);

  try {
    const res = await fetch('/api/kw-debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seeds: testSeeds })
    });
    const data = await res.json();

    let report = 'TEST SEEDS: ' + JSON.stringify(data.testSeeds) + '\n\n';

    // Expand check
    report += '=== EXPAND (keywords_for_keywords) ===\n';
    if (data.expandError) {
      report += 'ERROR: ' + data.expandError + '\n';
    } else if (data.expandResult) {
      const r = data.expandResult;
      report += 'HTTP Status: ' + r.status + '\n';
      report += 'API status_code: ' + (r.body?.status_code || '?') + '\n';
      report += 'API status_message: ' + (r.body?.status_message || '?') + '\n';
      const tasks = r.body?.tasks || [];
      const resultCount = tasks.reduce((n,t) => n + (t.result?.length || 0), 0);
      report += 'Tasks: ' + tasks.length + ', Results: ' + resultCount + '\n';
      if (tasks[0]?.result?.[0]) {
        report += 'Sample item: ' + JSON.stringify(tasks[0].result[0]).slice(0, 200) + '\n';
      }
    }

    report += '\n=== VOLUME (search_volume/live) ===\n';
    if (data.volError) {
      report += 'ERROR: ' + data.volError + '\n';
    } else if (data.volResult) {
      const r = data.volResult;
      report += 'HTTP Status: ' + r.status + '\n';
      report += 'API status_code: ' + (r.body?.status_code || '?') + '\n';
      report += 'API status_message: ' + (r.body?.status_message || '?') + '\n';
      const tasks = r.body?.tasks || [];
      const resultCount = tasks.reduce((n,t) => n + (t.result?.length || 0), 0);
      report += 'Tasks: ' + tasks.length + ', Results: ' + resultCount + '\n';
      if (tasks[0]?.result?.[0]) {
        report += 'Sample: ' + JSON.stringify(tasks[0].result[0]) + '\n';
      }
    }

    out.textContent = report;
  } catch(e) {
    out.textContent = 'Fetch error: ' + e.message;
  }
}

async function fetchKeywordResearch() {
  const r = S.research || {};
  const setup = S.setup || {};

  const services = r.primary_services || [];
  const primaryGeo = r.geography?.primary || setup.geo || '';
  const secondaryGeos = (r.geography?.secondary || []).slice(0, 3);
  const allGeos = [primaryGeo, ...secondaryGeos].filter(Boolean);

  // Determine country
  const geoStr = allGeos.join(' ').toLowerCase();
  const country = (geoStr.includes('canada') || geoStr.includes(' bc') || geoStr.includes('vancouver') || geoStr.includes('calgary') || geoStr.includes('toronto') || geoStr.includes('alberta')) ? 'CA' : 'US';

  // Always ensure a valid geo -- fall back to 'vancouver' so seeds are never blank
  const _rawCity = (primaryGeo || '').replace(/,.*$/, '').trim().toLowerCase();
  const _fallbackGeo = _rawCity || (setup.geo || '').replace(/,.*$/, '').trim().toLowerCase() || 'vancouver';

  // keywords_for_keywords is unavailable on this DataForSEO plan
  // Generate a rich programmatic seed list and run it straight through search_volume/live
  const seeds = new Set();
  const geoL = _fallbackGeo;
  console.log('[KW] geoL:', geoL, 'services:', services.slice(0,3));

  // Modifiers that produce distinct keyword types
  const suffixMods = ['agency', 'company', 'services', 'consultant', 'specialist', 'expert', 'firm'];
  const prefixMods = ['best', 'top', 'affordable', 'professional', 'local', 'hire'];
  const intentMods = ['cost', 'price', 'near me', 'for small business', 'for startups'];

  // 1. Services x geo matrix
  services.slice(0, 14).forEach(svc => {
    const s = svc.toLowerCase().replace(/\s+(services?|management|agency|solutions?|platform)$/i, '').trim();
    if (s.length < 3) return;
    seeds.add(s + ' ' + geoL);
    seeds.add(geoL + ' ' + s);
    seeds.add(s + ' agency ' + geoL);
    seeds.add(s + ' company ' + geoL);
    seeds.add(s + ' services ' + geoL);
    seeds.add('best ' + s + ' ' + geoL);
    seeds.add(s + ' consultant ' + geoL);
  });

  // 2. Category / brand terms
  seeds.add('digital marketing ' + geoL);
  seeds.add('digital marketing agency ' + geoL);
  seeds.add('marketing agency ' + geoL);
  seeds.add(geoL + ' marketing agency');
  seeds.add('online marketing ' + geoL);
  seeds.add('full service marketing agency ' + geoL);
  seeds.add('marketing company ' + geoL);
  seeds.add('advertising agency ' + geoL);

  // 3. Snapshot page slugs
  const _snapPages = (S.snapshot?.topPages || []).slice(0, 60);
  const _skipSegments = new Set(['services','service','cities','city','industry','post','blog','our-work','about','contact','pricing','team','case-studies','resources']);
  _snapPages.forEach(p => {
    const parts = (p.slug || '').replace(/^\//, '').split('/');
    parts.forEach(seg => {
      if (!seg || _skipSegments.has(seg) || seg.length < 4) return;
      const term = seg.replace(/-/g, ' ').replace(/\bvancouver\b|\btoronto\b|\bcalgary\b|\bbc\b/gi, '').trim();
      if (term.length > 4 && !term.match(/^\d+$/) && !/^(proven|strategies|for|real|growth|what|is|how|guide)/.test(term)) {
        seeds.add(term + ' ' + geoL);
        seeds.add(term + ' agency ' + geoL);
      }
    });
  });

  // 4. Secondary geos
  secondaryGeos.slice(0, 3).forEach(geo => {
    const sg = geo.replace(/,.*$/, '').trim().toLowerCase();
    services.slice(0, 4).forEach(svc => {
      const s = svc.toLowerCase().replace(/\s+(services?|management|agency)$/i, '').trim();
      if (s.length > 3) {
        seeds.add(s + ' ' + sg);
        seeds.add(s + ' agency ' + sg);
      }
    });
  });

  const seedList = [...seeds].filter(k => k.length > 4 && k.split(' ').length >= 2).slice(0, 500);
  if (!seedList.length) return;

  const kwEl = document.getElementById('research-kw-status');
  console.log('[KW] seedList sample:', seedList.slice(0,5), 'total:', seedList.length);
  if (kwEl) kwEl.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Looking up volumes for ' + seedList.length + ' keyword variations…';

  try {
    // Send full seedList directly to volume lookup (keywords_for_keywords unavailable on plan)
    const expandRes = await fetch('/api/kw-expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seeds: seedList, country })
    });
    const expandData = await expandRes.json();

    if (!expandData.keywords || expandData.error) {
      if (kwEl) kwEl.innerHTML = '<span style="color:var(--error);font-size:11px">⚠ ' + esc(expandData.error || 'Expansion failed') + '</span>';
      return;
    }

    const _dbg = expandData.debug || {};
    console.log('[KW] worker response:', { count: expandData.keywords.length, debug: _dbg, error: expandData.error });
    if (expandData.error) { if(kwEl) kwEl.innerHTML = '<span style="color:var(--error);font-size:11px">⚠ ' + esc(expandData.error) + '</span>'; return; }
    const _dbgStr = ' (' + (_dbg.volHits||expandData.keywords.length) + ' with vol data, ' + (_dbg.kwListCount||0) + ' sent)';
    if (kwEl) kwEl.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Found ' + expandData.keywords.length + ' keywords' + _dbgStr + ' — scoring…';

    // Step 2: Score and rank
    // Opportunity score: logarithmic vol / KD — rewards high vol + low KD
    // Penalise KD 0 (often means no data) and vol < 10
    const scored = expandData.keywords
      .filter(k => k.volume >= 0)
      .map(k => {
        const kd = k.difficulty > 0 ? k.difficulty : 30; // KD=0 = no data, assume medium
        const score = k.volume >= 10 ? Math.round((Math.log(k.volume + 1) * 100) / Math.max(kd, 5) * 10) / 10 : 0;
        return { kw: k.keyword, vol: k.volume, kd: k.difficulty, cpc: k.cpc || 0, score, monthly: k.monthly || [] };
      })
      .sort((a, b) => b.score - a.score);

    // Step 3: Deduplicate and take top 100
    const seen = new Set();
    const deduped = scored.filter(k => {
      if (seen.has(k.kw)) return false;
      seen.add(k.kw);
      return true;
    }).slice(0, 300);

    S.kwResearch = {
      keywords: deduped,
      seeds: seedList,
      fetchedAt: Date.now(),
      source: expandData.source || 'dataforseo'
    };
    scheduleSave();
    renderKwResearchCard();

  } catch(e) {
    if (kwEl) kwEl.innerHTML = '<span style="color:var(--error);font-size:11px">⚠ ' + esc(e.message) + '</span>';
  }
}

function renderKwResearchCard() {
  const el = document.getElementById('research-kw-card');
  if (!el || !S.kwResearch?.keywords?.length) return;

  const kws = S.kwResearch.keywords;
  const top = kws.slice(0, 25);
  const ts = S.kwResearch.fetchedAt ? new Date(S.kwResearch.fetchedAt).toLocaleTimeString('en-CA', {hour:'2-digit',minute:'2-digit'}) : '';
  const seedCount = S.kwResearch.seeds?.length || 0;

  let html = '<div class="card hl" style="margin-bottom:8px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">';
  html += '<div><div class="eyebrow" style="color:var(--green)">Keyword Opportunities</div>';
  html += '<div style="font-size:11px;color:var(--n2);margin-top:2px">'
    + kws.length + ' keywords with volume data'
    + (ts ? ' · ' + ts : '') + ' · sorted by opportunity score</div></div>';
  html += '<button class="btn btn-ghost sm" onclick="fetchKeywordResearch()"><i class="ti ti-refresh"></i> Refresh</button>';
  html += '</div>';

  html += '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden">';
  html += '<div style="display:grid;grid-template-columns:1fr 80px 46px 64px 60px 60px;background:var(--bg);padding:6px 12px;border-bottom:1px solid var(--border);font-size:10px;color:var(--n2);letter-spacing:.06em;text-transform:uppercase">'
    + '<span>Keyword</span><span>Vol/mo</span><span>KD</span><span>CPC</span><span>Trend</span><span>Score</span></div>';

  top.forEach((k, i) => {
    const kdColor = k.kd === 0 ? 'var(--n1)' : k.kd < 20 ? 'var(--green)' : k.kd < 40 ? 'var(--warn)' : 'var(--error)';
    const rowBg = i % 2 === 0 ? '' : 'background:var(--bg)';
    const kdLabel = k.kd === 0 ? '?' : k.kd;
    html += '<div class="tbl-row" style="display:grid;grid-template-columns:1fr 80px 46px 64px 60px 60px;padding:6px 12px;border-bottom:1px solid var(--border);font-size:12px;align-items:center;cursor:pointer;'+rowBg+'">'
      + '<span style="color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(k.kw)+'</span>'
      + '<span style="color:'+(k.vol>=500?'var(--green)':(k.vol>=100?'var(--n3)':'var(--n1)'))+';font-weight:500">'+k.vol.toLocaleString()+'</span>'
      + '<span style="color:'+kdColor+';font-weight:500">'+kdLabel+'</span>'
      + '<span style="font-size:11px;color:var(--green)">'+(k.cpc?'$'+k.cpc.toFixed(2):'<span style="color:var(--n1)">-</span>')+'</span>'
      + '<span style="font-size:11px">'+((!k.monthly||k.monthly.length<2)?'<span style="color:var(--n1)">-</span>':(function(){var p=[].concat(k.monthly).reverse().slice(-6);var mx=Math.max.apply(null,p.concat([1]));var b=p.map(function(v){return '<span style="display:inline-block;width:4px;height:'+Math.max(2,Math.round(v/mx*14))+'px;background:'+(v>=mx*0.5?'#158e1d':'#ccc')+';border-radius:1px;vertical-align:bottom"></span>';}).join('');var tr=p[p.length-1]-p[0];return '<span style="display:inline-flex;align-items:flex-end;gap:1px">'+b+'</span>'+(tr>0?'<span style="font-size:9px;color:var(--green)">↑</span>':(tr<0?'<span style="font-size:9px;color:var(--error)">↓</span>':''));})())+'</span>'
      + '<span style="font-size:11px;color:var(--n2)">'+k.score+'</span>'
      + '</div>';
  });

  if (kws.length > 25) {
    html += '<div style="padding:6px 12px;font-size:11px;color:var(--n2);background:var(--bg)">+'+(kws.length-25)+' more injected into sitemap stage</div>';
  }
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--n2);margin-top:8px">'
    + '<i class="ti ti-info-circle" style="font-size:10px"></i>'
    + ' Score = log(volume) ÷ KD. KD shown as ? when DataForSEO has no difficulty data. These are automatically used when generating the sitemap.'
    + '</div></div>';

  el.innerHTML = html;
  el.style.display = 'block';
  const status = document.getElementById('research-kw-status');
  if (status) status.style.display = 'none';
}

// ── SITEMAP ────────────────────────────────────────────────────────// ── SITEMAP ────────────────────────────────────────────────────────

// KEYWORDS STAGE
var _kwTab = 'questions';

function initKeywords() {
  if (!S.kwResearch) {
    var mechSeeds = buildKwSeeds();
    S.kwResearch = { seeds: mechSeeds, seedSources: { mechanical: mechSeeds.slice(), ai: [], competitor: [] }, activeSources: ['mechanical','ai','competitor'], keywords: [], selected: [], clusters: [], paaQuestions: [], fetchedAt: null, clusteredAt: null };
  } else {
    if (!S.kwResearch.seedSources) S.kwResearch.seedSources = { mechanical: (S.kwResearch.seeds || []).slice(), ai: [], competitor: [] };
    if (!S.kwResearch.activeSources) S.kwResearch.activeSources = ['mechanical','ai','competitor'];
    if (!S.kwResearch.seeds || !S.kwResearch.seeds.length) {
      var mechSeeds2 = buildKwSeeds();
      S.kwResearch.seedSources.mechanical = mechSeeds2.slice();
      _rebuildSeeds();
    }
  }
  if (S.kwResearch.keywords.length && (!S.kwResearch.selected || !S.kwResearch.selected.length)) {
    S.kwResearch.selected = S.kwResearch.keywords.slice(0, 50).map(function(k) { return k.kw; });
  }
  renderKwTabNav();
  renderKwTabContent();
  var proceedBtn = document.getElementById('kw-proceed-btn');
  if (proceedBtn) proceedBtn.style.display = (S.kwResearch.clusters && S.kwResearch.clusters.length) ? '' : 'none';
}

function buildKwSeeds() {
  var r = S.research || {};
  var setup = S.setup || {};
  var services = r.primary_services || [];
  var primaryGeo = r.geography && r.geography.primary ? r.geography.primary : (setup.geo || '');
  var _rawCity = (primaryGeo || '').replace(/,.*$/, '').trim().toLowerCase();
  var geoL = _rawCity || (setup.geo || '').replace(/,.*$/, '').trim().toLowerCase() || 'vancouver';
  var secondaryGeos = (r.geography && r.geography.secondary ? r.geography.secondary : []).slice(0, 3);
  var seeds = new Set();
  services.slice(0, 14).forEach(function(svc) {
    var s = svc.toLowerCase().replace(/\s+(services?|management|agency|solutions?|platform)$/i, '').trim();
    if (s.length < 3) return;
    // Geo-qualified (high purchase intent for local search)
    seeds.add(s + ' ' + geoL);
    seeds.add(s + ' agency ' + geoL);
    seeds.add(s + ' company ' + geoL);
    seeds.add(s + ' services ' + geoL);
    seeds.add('best ' + s + ' ' + geoL);
    seeds.add(s + ' consultant ' + geoL);
    // Non-geo bare service terms (national volume, DataForSEO expands these well)
    seeds.add(s + ' agency');
    seeds.add(s + ' services');
    seeds.add(s + ' company');
    seeds.add('best ' + s + ' agency');
    seeds.add(s + ' agency near me');
    seeds.add('hire ' + s + ' agency');
    seeds.add(s + ' pricing');
    seeds.add(s + ' cost');
  });
  // Geo versions of core business type (derived from services, not hardcoded)
  var businessType = setup.businessType || r.business_type || '';
  if (businessType) {
    var bt = businessType.toLowerCase().trim();
    seeds.add(bt + ' ' + geoL);
    seeds.add('best ' + bt + ' ' + geoL);
    seeds.add(bt + ' near me');
    seeds.add(geoL + ' ' + bt);
  }
  var skipSegs = new Set(['services','service','cities','city','industry','post','blog','our-work','about','contact','pricing','resources','team']);
  (S.snapshot && S.snapshot.topPages ? S.snapshot.topPages : []).slice(0, 40).forEach(function(p) {
    var parts = (p.slug || '').replace(/^\//, '').split('/');
    parts.forEach(function(seg) {
      if (!seg || skipSegs.has(seg) || seg.length < 4) return;
      var term = seg.replace(/-/g, ' ').replace(/\bvancouver\b|\btoronto\b|\bcalgary\b|\bbc\b/gi, '').trim();
      if (term.length > 4 && !term.match(/^\d+$/) && !/^(proven|strategies|for|real|growth|what|is|how|guide)/.test(term)) {
        seeds.add(term + ' ' + geoL);
        seeds.add(term + ' agency ' + geoL);
      }
    });
  });
  secondaryGeos.forEach(function(geo) {
    var sg = geo.replace(/,.*$/, '').trim().toLowerCase();
    services.slice(0, 4).forEach(function(svc) {
      var s = svc.toLowerCase().replace(/\s+(services?|management|agency)$/i, '').trim();
      if (s.length > 3) { seeds.add(s + ' ' + sg); seeds.add(s + ' agency ' + sg); }
    });
  });
  // Always merge pinned seeds — they survive Refresh Seeds
  var pinned = (S.kwResearch && S.kwResearch.pinnedSeeds) ? S.kwResearch.pinnedSeeds : [];
  pinned.forEach(function(k) { seeds.add(k); });
  return Array.from(seeds).filter(function(k) { return k.length > 1 && k.split(' ').length <= 7; }).slice(0, 500);
}

function goToSitemap() {
  goTo('sitemap');
  if (S.pages && S.pages.length) {
    var sitemapBtn = document.getElementById('sitemap-run-btn');
    if (sitemapBtn) sitemapBtn.innerHTML = '<i class="ti ti-refresh"></i> Regenerate';
    setTimeout(function() {
      document.getElementById('sitemap-results').style.display = '';
      renderSitemapResults(true);
    }, 100);
    return;
  }
  // Auto-build from clusters if available
  if (S.kwResearch && S.kwResearch.clusters && S.kwResearch.clusters.length) {
    setTimeout(function() { buildSitemapFromClusters(); }, 300);
  }
}

function switchKwTab(i) { _kwTab = ['questions','seeds','opps','clusters'][i] || 'questions'; renderKwTabContent(); }

function renderKwTabNav() {
  var el = document.getElementById('kw-tab-nav');
  if (!el) return;
  var kwr = S.kwResearch || {};
  var tabs = [
    { id: 'questions', label: 'Questions', count: (_getQuestionsArray ? _getQuestionsArray().length : 0), icon: 'ti-help-circle' },
    { id: 'seeds', label: 'Seeds', count: (kwr.seeds || []).length, icon: 'ti-plant' },
    { id: 'opps', label: 'Opportunities', count: (kwr.keywords || []).length, icon: 'ti-chart-bar' },
    { id: 'clusters', label: 'Clusters', count: (kwr.clusters || []).length, icon: 'ti-stack-2' }
  ];
  el.innerHTML = tabs.map(function(t, i) {
    var active = _kwTab === t.id;
    var bg = active ? 'var(--dark)' : 'transparent';
    var clr = active ? '#fff' : 'var(--n3)';
    var fw = active ? '600' : '400';
    var bb = active ? '2px solid var(--lime)' : '2px solid transparent';
    return '<button onclick="switchKwTab(' + i + ')" style="padding:8px 14px;border:none;background:' + bg + ';color:' + clr + ';cursor:pointer;font-size:12px;font-weight:' + fw + ';border-bottom:' + bb + ';white-space:nowrap;display:inline-flex;align-items:center;gap:5px">'
      + '<i class="ti ' + t.icon + '" style="font-size:11px"></i>' + t.label
      + (t.count ? '<span style="background:var(--panel);border-radius:10px;padding:1px 6px;font-size:10px;color:var(--n2)">' + t.count + '</span>' : '')
      + '</button>';
  }).join('');
}

function renderKwTabContent() {
  renderKwTabNav();
  var el = document.getElementById('kw-tab-content');
  if (!el) return;
  if (_kwTab === 'seeds') el.innerHTML = _renderKwSeedsTab();
  else if (_kwTab === 'opps') el.innerHTML = _renderKwOppsTab();
  else if (_kwTab === 'clusters') el.innerHTML = _renderKwClustersTab();
  else if (_kwTab === 'questions') el.innerHTML = _renderKwQuestionsTab();
}


function openCompetitorSeeds() {
  // Show inline panel below button bar
  var existing = document.getElementById('comp-seeds-panel');
  if (existing) { existing.remove(); return; }

  var panel = document.createElement('div');
  panel.id = 'comp-seeds-panel';
  panel.style.cssText = 'background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:12px;';

  // Pre-fill from research competitors
  var r = S.research || {};
  var researchComps = (r.competitors || []).map(function(c) {
    // Prefer URL → strip to bare domain; fall back to name
    var url = c.url || c.domain || '';
    if (url) {
      url = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').trim();
      if (url) return url;
    }
    return c.name || c || '';
  }).filter(Boolean);

  panel.innerHTML = '<div style="font-size:13px;font-weight:600;margin-bottom:8px"><i class="ti ti-building-store" style="margin-right:6px"></i>Competitor Keyword Mining</div>'
    + '<div style="font-size:11px;color:var(--n2);margin-bottom:10px">Paste competitor domains (up to 10). We\'ll pull their top organic keywords and add non-brand terms to your seeds.</div>'
    + '<textarea id="comp-seeds-domains" placeholder="e.g. oceanicdental.au&#10;racedental.com.au&#10;scdlab.com&#10;pearlhealthcare.com.au&#10;adp.com.au" style="width:100%;box-sizing:border-box;height:80px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--dark);resize:vertical;font-family:inherit">'
    + researchComps.join('\n')
    + '</textarea>'
    + '<div style="display:flex;gap:8px;margin-top:10px;align-items:center">'
    + '<button class="btn btn-primary sm" onclick="_runCompetitorSeeds()"><i class="ti ti-download"></i> Pull Keywords</button>'
    + '<button class="btn btn-ghost sm" onclick="document.getElementById(\'comp-seeds-panel\').remove()">Cancel</button>'
    + '<span id="comp-seeds-status" style="font-size:11px;color:var(--n2)"></span>'
    + '</div>';

  // Insert before the seed table
  var tbl = document.querySelector('#kw-tab-content .tbl-row');
  var parent = tbl ? tbl.parentElement : null;
  if (parent) {
    parent.insertBefore(panel, parent.firstChild);
  } else {
    var tabContent = document.getElementById('kw-tab-content');
    if (tabContent) tabContent.insertBefore(panel, tabContent.firstChild);
  }
}

async function _runCompetitorSeeds() {
  var statusEl = document.getElementById('comp-seeds-status');
  var btn = document.querySelector('#comp-seeds-panel .btn-primary');
  var raw = (document.getElementById('comp-seeds-domains') || {}).value || '';
  var domains = raw.split(/[\n,]+/).map(function(d) { return d.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''); }).filter(Boolean);
  if (!domains.length) { if (statusEl) statusEl.textContent = 'Enter at least one domain.'; return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Fetching...'; }
  if (statusEl) statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Pulling organic keywords from ' + domains.length + ' domains...';

  var country = (S.kwResearch && S.kwResearch.country) ? S.kwResearch.country : _autoDetectKwCountry();

  try {
    var res = await fetch('/api/competitor-gap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: domains, country: country, ownKeywords: [] })
    });
    var data = await res.json();
    if (data.error) throw new Error(data.error);

    var newSeeds = (data.keywords || []).map(function(k) { var s = (typeof k === 'string') ? k : (k.keyword || k.kw || ''); return s.toLowerCase().trim(); }).filter(Boolean);
    if (!newSeeds.length) {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">No keywords returned — check domains or plan access.</span>';
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-download"></i> Pull Keywords'; }
      return;
    }

    // Write to competitor source bucket then rebuild
    if (!S.kwResearch.seedSources) S.kwResearch.seedSources = { mechanical: [], ai: [], competitor: [] };
    if (!S.kwResearch.activeSources) S.kwResearch.activeSources = ['mechanical','ai','competitor'];
    // Merge new seeds into competitor bucket (additive)
    var compSet = new Set((S.kwResearch.seedSources.competitor || []).map(function(s){ return s.toLowerCase(); }));
    newSeeds.forEach(function(s) { if (s.length > 2 && !compSet.has(s)) { compSet.add(s); S.kwResearch.seedSources.competitor.push(s); } });
    if (S.kwResearch.activeSources.indexOf('competitor') < 0) S.kwResearch.activeSources.push('competitor');
    _rebuildSeeds();
    var added = newSeeds.length;

    scheduleSave();
    var src = data.source === 'google-suggest' ? ' <span style="opacity:0.6">(via Google Suggest — dataforseo_labs not on plan)</span>' : ' <span style="opacity:0.6">(via DataForSEO)</span>';
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)"><i class="ti ti-check"></i> Added ' + added + ' keywords to seeds</span>' + src;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-download"></i> Pull Keywords'; }
    setTimeout(function() {
      var panel = document.getElementById('comp-seeds-panel');
      if (panel) panel.remove();
      renderKwTabContent();
    }, 1800);
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">Error: ' + e.message + '</span>';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-download"></i> Pull Keywords'; }
  }
}

function _autoDetectKwCountry() {
  var r = S.research || {};
  var setup = S.setup || {};
  var geo = (r.geography && r.geography.primary ? r.geography.primary : (setup.geo || '')).toLowerCase();
  if (geo.indexOf('australia') >= 0 || geo.indexOf('sydney') >= 0 || geo.indexOf('melbourne') >= 0 || geo.indexOf('brisbane') >= 0 || geo.indexOf('perth') >= 0) return 'au';
  if (geo.indexOf('canada') >= 0 || geo.indexOf('vancouver') >= 0 || geo.indexOf('calgary') >= 0 || geo.indexOf('toronto') >= 0) return 'ca';
  if (geo.indexOf('united kingdom') >= 0 || geo.indexOf('london') >= 0) return 'gb';
  if (geo.indexOf('new zealand') >= 0) return 'nz';
  if (geo.indexOf('singapore') >= 0) return 'sg';
  return 'us';
}

function _setKwCountry(val) {
  if (!S.kwResearch) S.kwResearch = {};
  S.kwResearch.country = val;
  scheduleSave();
}


function _rebuildSeeds() {
  if (!S.kwResearch) return;
  if (!S.kwResearch.seedSources) S.kwResearch.seedSources = { mechanical: [], ai: [], competitor: [] };
  var active = S.kwResearch.activeSources || ['mechanical', 'ai', 'competitor'];
  var seen = new Set();
  var result = [];
  active.forEach(function(src) {
    (S.kwResearch.seedSources[src] || []).forEach(function(s) {
      var k = s.toLowerCase().trim();
      if (k && !seen.has(k)) { seen.add(k); result.push(k); }
    });
  });
  // Also preserve any manually pinned seeds not in any source bucket
  var allBucket = new Set();
  Object.values(S.kwResearch.seedSources).forEach(function(arr) { arr.forEach(function(s){ allBucket.add(s.toLowerCase().trim()); }); });
  (S.kwResearch.seeds || []).forEach(function(s) {
    var k = s.toLowerCase().trim();
    if (!allBucket.has(k) && !seen.has(k)) { seen.add(k); result.push(k); }
  });
  S.kwResearch.seeds = result;
}


function _resetToMechanicalSeeds() {
  if (!S.kwResearch) return;
  if (!S.kwResearch.seedSources) S.kwResearch.seedSources = { mechanical: [], ai: [], competitor: [] };
  if (!S.kwResearch.activeSources) S.kwResearch.activeSources = ['mechanical', 'ai', 'competitor'];
  S.kwResearch.seedSources.mechanical = buildKwSeeds();
  if (S.kwResearch.activeSources.indexOf('mechanical') < 0) S.kwResearch.activeSources.push('mechanical');
  _rebuildSeeds();
  scheduleSave();
  renderKwTabContent();
}

function _toggleSeedSource(src) {
  if (!S.kwResearch) return;
  if (!S.kwResearch.activeSources) S.kwResearch.activeSources = ['mechanical', 'ai', 'competitor'];
  var idx = S.kwResearch.activeSources.indexOf(src);
  if (idx >= 0) {
    S.kwResearch.activeSources.splice(idx, 1);
  } else {
    S.kwResearch.activeSources.push(src);
  }
  _rebuildSeeds();
  scheduleSave();
  renderKwTabContent();
}

function _copySeedKeywords(btn) {
  var seeds = S.kwResearch && S.kwResearch.seeds ? S.kwResearch.seeds : [];
  if (!seeds.length) return;
  navigator.clipboard.writeText(seeds.join('\n')).then(function() {
    var icon = btn.querySelector('i');
    icon.className = 'ti ti-check';
    btn.style.color = 'var(--green)';
    setTimeout(function() { icon.className = 'ti ti-copy'; btn.style.color = 'var(--n2)'; }, 1800);
  });
}

function _renderKwSeedsTab() {
  var seeds = S.kwResearch && S.kwResearch.seeds ? S.kwResearch.seeds : [];
  var fetched = S.kwResearch && S.kwResearch.fetchedAt;
  var kwCount = (S.kwResearch && S.kwResearch.keywords) ? S.kwResearch.keywords.length : 0;
  var html = '<div>';
  var aiStatus = S.kwResearch && S.kwResearch.aiSeedsGeneratedAt
    ? '<span style="color:var(--green)"><i class="ti ti-sparkles" style="font-size:10px"></i> AI seeds generated ' + new Date(S.kwResearch.aiSeedsGeneratedAt).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit'}) + '</span>'
    : '';
  html += '<div style="font-size:12px;color:var(--n2);margin-bottom:10px">Seeds are expanded via Google Suggest, then looked up in DataForSEO. Use <strong style=\"color:var(--dark)\">AI Generate Seeds</strong> for head terms, or <strong style=\"color:var(--dark)\">Competitor Keywords</strong> to mine non-brand terms from competitor domains.</div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">';
  html += '<select onchange="_setKwCountry(this.value)" title="Search country" style="padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--dark);cursor:pointer" id="kw-country-sel"><option value="au">🇦🇺 Australia</option><option value="us">🇺🇸 United States</option><option value="ca">🇨🇦 Canada</option><option value="gb">🇬🇧 United Kingdom</option><option value="nz">🇳🇿 New Zealand</option><option value="sg">🇸🇬 Singapore</option><option value="za">🇿🇦 South Africa</option></select>';
  // Set selected value after render via a deferred call
  setTimeout(function(){var s=document.getElementById('kw-country-sel');if(s)s.value=(S.kwResearch&&S.kwResearch.country)||_autoDetectKwCountry();},0);
  html += '<button class="btn btn-primary" onclick="fetchKwVolumes()"><i class="ti ti-chart-bar"></i> Fetch Volumes <span style="font-size:10px;opacity:0.7">(' + seeds.length + ' seeds)</span></button>';
  html += '<button class="btn btn-ghost" onclick="generateAISeeds()" id="ai-seeds-btn"><i class="ti ti-sparkles"></i> AI Generate Seeds</button>';
  html += '<button class="btn btn-ghost" onclick="openCompetitorSeeds()" id="comp-seeds-btn"><i class="ti ti-building-store"></i> Competitor Keywords</button>';
  html += '<button class="btn btn-ghost" onclick="_resetToMechanicalSeeds()" title="Rebuild the mechanical seed list from client/service data and merge back into seeds"><i class="ti ti-refresh"></i> Refresh Seeds</button>';
  var _hasQs = (S.contentIntel && S.contentIntel.paa && S.contentIntel.paa.questions && S.contentIntel.paa.questions.length > 0);
  if (_hasQs) {
    html += '<button class="btn btn-ghost sm" onclick="addAllQuestionsAsSeeds()" title="Convert all questions to seed keywords and add to this list"><i class="ti ti-arrow-left"></i> Pull from Questions</button>';
  }
  html += '<div style="display:flex;gap:6px;align-items:center">';
  html += '<input id="kw-seed-add-input" type="text" placeholder="Add seed..." autocomplete="off" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;width:180px;background:var(--bg);color:var(--dark)" onkeydown="_kwSeedKeydown(event,this)">';
  html += '<button class="btn btn-ghost sm" onclick="_kwSeedAddBtn()"><i class="ti ti-plus"></i></button>';
  html += '</div></div>';
  if (fetched) {
    html += '<div style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:' + (kwCount > 0 ? 'rgba(21,142,29,0.1)' : 'var(--panel)') + ';border-radius:20px;font-size:11px;color:' + (kwCount > 0 ? 'var(--green)' : 'var(--n2)') + ';margin-bottom:10px">'
      + '<i class="ti ti-' + (kwCount > 0 ? 'check' : 'alert-circle') + '"></i> Volumes fetched — ' + kwCount + ' keywords</div>';
  }
  html += '<div id="kw-seeds-status" style="font-size:11px;color:var(--n2);margin-bottom:8px;display:flex;align-items:center;gap:6px"></div>';

  // Pinned seeds section
  var pinned = (S.kwResearch && S.kwResearch.pinnedSeeds) ? S.kwResearch.pinnedSeeds : [];
  html += '<div style="border:1px solid var(--lime,#D8FF29);border-radius:8px;overflow:hidden;margin-bottom:12px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;background:rgba(216,255,41,0.08);padding:6px 12px;border-bottom:1px solid var(--lime,#D8FF29)">';
  html += '<span style="font-size:11px;font-weight:600;color:var(--dark)"><i class="ti ti-pin" style="margin-right:4px"></i>Pinned Keywords <span style="font-weight:400;color:var(--n2)">(always included — survive Reset)</span></span>';
  html += '<div style="display:flex;gap:6px;align-items:center">';
  html += '<input id="kw-pin-input" type="text" placeholder="Add pinned keyword..." autocomplete="off" style="padding:4px 8px;border:1px solid var(--border);border-radius:5px;font-size:12px;width:200px;background:var(--bg);color:var(--dark)" onkeydown="_kwPinKeydown(event,this)">';
  html += '<button class="btn btn-ghost sm" onclick="_kwPinAddBtn()"><i class="ti ti-plus"></i></button>';
  html += '</div></div>';
  if (pinned.length) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px">';
    pinned.forEach(function(kw, i) {
      html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(216,255,41,0.15);border:1px solid rgba(216,255,41,0.4);border-radius:20px;font-size:11px;color:var(--dark)">'
        + esc(kw)
        + '<button onclick="_kwPinRemove(' + i + ')" style="background:none;border:none;cursor:pointer;color:var(--n2);font-size:11px;padding:0;line-height:1;margin-left:2px">&times;</button>'
        + '</span>';
    });
    html += '</div>';
  } else {
    html += '<div style="padding:8px 12px;font-size:11px;color:var(--n2)">No pinned keywords yet. Add your must-have terms here — e.g. \"digital marketing agency vancouver\"</div>';
  }
  html += '</div>';

  // Table layout
  var srcsData = S.kwResearch && S.kwResearch.seedSources ? S.kwResearch.seedSources : {};
  var srcBadgeColors = { mechanical: 'var(--n2)', ai: 'var(--green)', competitor: '#f59e0b', questions: '#8b5cf6' };
  var srcLabels = { mechanical: 'Mechanical', ai: 'AI', competitor: 'Competitor', questions: 'Questions' };
  var srcCounts = {
    mechanical: (srcsData.mechanical || []).length,
    ai: (srcsData.ai || []).length,
    competitor: (srcsData.competitor || []).length,
    questions: (srcsData.questions || []).length,
  };
  // Active source filter (persisted on S)
  var _activeSrcFilter = (S.kwResearch && S.kwResearch._seedFilterSource) || 'all';

  // Filter seeds by source if filter active
  // Build reverse lookup: seed → source
  var seedSourceMap = {};
  ['mechanical','ai','competitor','questions'].forEach(function(src) {
    (srcsData[src] || []).forEach(function(s) { if (!seedSourceMap[s.toLowerCase()]) seedSourceMap[s.toLowerCase()] = src; });
  });
  var displaySeeds = _activeSrcFilter === 'all' ? seeds : seeds.filter(function(s) {
    return (seedSourceMap[s.toLowerCase()] || 'mechanical') === _activeSrcFilter;
  });

  html += '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">';

  // ── Bucket status bar ──────────────────────────────────────────────────────
  html += '<div style="display:flex;align-items:center;gap:0;border-bottom:1px solid var(--border);background:var(--panel)">';
  // Source filter buttons
  var allActive = _activeSrcFilter === 'all';
  html += '<button onclick="_setSeedFilter(\'all\')" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border:none;border-right:1px solid var(--border);background:' + (allActive ? 'var(--dark)' : 'transparent') + ';color:' + (allActive ? 'white' : 'var(--n3)') + ';font-size:11px;font-family:var(--font);cursor:pointer;font-weight:' + (allActive ? '500' : '400') + '">'
    + '<i class="ti ti-list" style="font-size:11px"></i> All <span style="font-size:10px;opacity:.7">' + seeds.length + '</span></button>';
  ['mechanical','ai','competitor','questions'].forEach(function(src) {
    var count = srcCounts[src];
    var isActive = _activeSrcFilter === src;
    var col = srcBadgeColors[src];
    var icon = src === 'mechanical' ? 'ti-settings-2' : src === 'ai' ? 'ti-sparkles' : src === 'questions' ? 'ti-help-circle' : 'ti-building';
    var done = count > 0;
    html += '<button onclick="_setSeedFilter(\'' + src + '\')" style="display:flex;align-items:center;gap:6px;padding:7px 14px;border:none;border-right:1px solid var(--border);background:' + (isActive ? 'var(--dark)' : 'transparent') + ';color:' + (isActive ? 'white' : (done ? 'var(--dark)' : 'var(--n2)')) + ';font-size:11px;font-family:var(--font);cursor:pointer;font-weight:' + (isActive ? '500' : '400') + '">'
      + '<i class="ti ' + icon + '" style="font-size:11px;color:' + (isActive ? 'white' : (done ? col : 'var(--n2)')) + '"></i>'
      + srcLabels[src]
      + (done
          ? ' <span style="font-size:10px;padding:1px 5px;border-radius:8px;background:' + (isActive ? 'rgba(255,255,255,.2)' : col + '20') + ';color:' + (isActive ? 'white' : col) + ';font-weight:500">' + count + '</span>'
          : ' <span style="font-size:10px;opacity:.45">—</span>')
      + '</button>';
  });
  // Copy button right-aligned
  html += '<span style="flex:1"></span>';
  html += '<button onclick="_copySeedKeywords(this)" title="Copy all seeds" style="background:none;border:none;cursor:pointer;padding:7px 14px;color:var(--n2);font-size:13px;line-height:1" onmouseenter="this.style.color=\'var(--dark)\'" onmouseleave="this.style.color=\'var(--n2)\'"><i class="ti ti-copy"></i></button>';
  html += '</div>';

  // Column header
  html += '<div style="display:grid;grid-template-columns:1fr auto;background:var(--panel);padding:5px 12px;border-bottom:1px solid var(--border);font-size:10px;font-weight:500;color:var(--n2);text-transform:uppercase;letter-spacing:.05em">';
  html += '<span>Seed Keyword' + (_activeSrcFilter !== 'all' ? ' — <span style="color:' + srcBadgeColors[_activeSrcFilter] + ';text-transform:none;font-weight:400">' + srcLabels[_activeSrcFilter] + ' only (' + displaySeeds.length + ')</span>' : '') + '</span><span>Remove</span></div>';

  html += '<div style="max-height:360px;overflow-y:auto">';

  displaySeeds.forEach(function(seed, i) {
    var seedSrc = seedSourceMap[seed.toLowerCase()];
    var globalIdx = seeds.indexOf(seed);
    var badge = seedSrc && _activeSrcFilter === 'all' ? '<span style="font-size:9px;padding:1px 5px;border-radius:8px;background:' + srcBadgeColors[seedSrc] + '20;color:' + srcBadgeColors[seedSrc] + ';margin-left:6px;font-weight:500">' + srcLabels[seedSrc].slice(0,4).toUpperCase() + '</span>' : '';
    html += '<div class="tbl-row" style="display:grid;grid-template-columns:1fr auto;padding:5px 12px;border-bottom:1px solid var(--border);align-items:center;' + (i % 2 ? 'background:var(--bg)' : '') + '">'
      + '<span style="font-size:12px;color:var(--dark)">' + esc(seed) + badge + '</span>'
      + '<button onclick="_removeKwSeed(' + globalIdx + ')" style="background:none;border:none;cursor:pointer;color:var(--n2);font-size:13px;padding:2px 6px;border-radius:4px;line-height:1" title="Remove">&times;</button>'
      + '</div>';
  });
  if (!seeds.length) {
    html += '<div style="padding:20px;text-align:center;color:var(--n2);font-size:12px">No seeds — click Rebuild Seeds to generate.</div>';
  }
  html += '</div></div></div>';
  return html;
}


function _setSeedFilter(src) {
  if (!S.kwResearch) return;
  S.kwResearch._seedFilterSource = src;
  renderKwTabContent();
}

function _setKwDR(val) {
  if (!S.kwResearch) S.kwResearch = {};
  var dr = parseInt(val);
  S.kwResearch.siteDR = (dr > 0 && dr <= 100) ? dr : 0;
  scheduleSave();
  renderKwTabContent();
}

function _kwSeedKeydown(e, el) { if (e.key === 'Enter') { _addKwSeed(el.value); el.value = ''; } }
function _kwSeedAddBtn() { var el = document.getElementById('kw-seed-add-input'); if (el) { _addKwSeed(el.value); el.value = ''; } }

function _kwPinKeydown(e, el) { if (e.key === 'Enter') { _kwPinAdd(el.value); el.value = ''; } }
function _kwPinAddBtn() { var el = document.getElementById('kw-pin-input'); if (el) { _kwPinAdd(el.value); el.value = ''; } }
function _kwPinAdd(val) {
  val = (val || '').trim().toLowerCase();
  if (!val || val.length < 2) return;
  if (!S.kwResearch) S.kwResearch = { seeds: [], keywords: [], selected: [], clusters: [] };
  if (!S.kwResearch.pinnedSeeds) S.kwResearch.pinnedSeeds = [];
  if (S.kwResearch.pinnedSeeds.indexOf(val) < 0) {
    S.kwResearch.pinnedSeeds.push(val);
    // Also inject into current seeds list if not already there
    if (!S.kwResearch.seeds) S.kwResearch.seeds = [];
    if (S.kwResearch.seeds.indexOf(val) < 0) S.kwResearch.seeds.push(val);
    scheduleSave();
  }
  renderKwTabContent();
}
function _kwPinRemove(i) {
  if (S.kwResearch && S.kwResearch.pinnedSeeds) {
    var removed = S.kwResearch.pinnedSeeds.splice(i, 1)[0];
    // Also remove from seeds list
    if (removed && S.kwResearch.seeds) {
      var si = S.kwResearch.seeds.indexOf(removed);
      if (si >= 0) S.kwResearch.seeds.splice(si, 1);
    }
    scheduleSave();
    renderKwTabContent();
  }
}

function _addKwSeed(val) {
  val = (val || '').trim().toLowerCase();
  if (!val || val.length < 3) return;
  if (!S.kwResearch) S.kwResearch = { seeds: [], keywords: [], selected: [], clusters: [], paaQuestions: [] };
  if (S.kwResearch.seeds.indexOf(val) < 0) S.kwResearch.seeds.push(val);
  renderKwTabContent();
}

function _removeKwSeed(idx) {
  if (S.kwResearch && S.kwResearch.seeds) { S.kwResearch.seeds.splice(idx, 1); renderKwTabContent(); }
}

async function generateAISeeds() {
  var btn = document.getElementById('ai-seeds-btn');
  var statusEl = document.getElementById('kw-seeds-status');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px;display:inline-block"></span> Generating...'; }
  if (statusEl) statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Analysing client context...';

  var r = S.research || {};
  var setup = S.setup || {};
  var geo = (r.geography && r.geography.primary ? r.geography.primary : (setup.geo || '')).replace(/,.*$/, '').trim();
  var secondaryGeos = (r.geography && r.geography.secondary ? r.geography.secondary : []).slice(0, 3).map(function(g) { return g.replace(/,.*$/,'').trim(); });

  // Build rich context block
  var ctx = '';
  ctx += 'CLIENT: ' + (setup.client || r.client_name || 'Unknown') + '\n';
  ctx += 'INDUSTRY: ' + (r.industry || r.sub_industry || '') + '\n';
  ctx += 'BUSINESS MODEL: ' + (r.business_model || '') + '\n';
  ctx += 'OVERVIEW: ' + (r.business_overview || '') + '\n';
  ctx += 'VALUE PROP: ' + (r.value_proposition || '') + '\n';
  ctx += 'PRIMARY GEO: ' + geo + '\n';
  if (secondaryGeos.length) ctx += 'SECONDARY GEOS: ' + secondaryGeos.join(', ') + '\n';
  ctx += 'SERVICES: ' + (r.primary_services || []).join(', ') + '\n';
  if (r.top_offers && r.top_offers.length) ctx += 'TOP OFFERS: ' + r.top_offers.join(', ') + '\n';
  if (r.key_differentiators && r.key_differentiators.length) ctx += 'DIFFERENTIATORS: ' + r.key_differentiators.join(', ') + '\n';
  if (r.pain_points_top5 && r.pain_points_top5.length) ctx += 'AUDIENCE PAIN POINTS: ' + r.pain_points_top5.join('; ') + '\n';
  if (r.target_audience && r.target_audience.length) ctx += 'TARGET AUDIENCE: ' + r.target_audience.join(', ') + '\n';
  if (r.buyer_roles_titles && r.buyer_roles_titles.length) ctx += 'BUYER ROLES: ' + r.buyer_roles_titles.join(', ') + '\n';
  if (r.competitors && r.competitors.length) {
    ctx += 'COMPETITORS: ' + r.competitors.slice(0,6).map(function(c) { return c.name || c; }).join(', ') + '\n';
  }
  if (setup.competitors) ctx += 'COMPETITOR NOTES: ' + setup.competitors.slice(0, 400) + '\n';
  if (r.pricing_model) ctx += 'PRICING MODEL: ' + r.pricing_model + '\n';

  // PAA questions as context for seed generation
  var paaQs = _getQuestionsArray ? _getQuestionsArray() : [];
  if (paaQs.length) {
    ctx += '\nPEOPLE ALSO ASK (from Google — reveals real search intent):\n' + paaQs.slice(0, 20).map(function(q, i) { return (i+1) + '. ' + q; }).join('\n') + '\n';
  }

  // Strategy doc + uploaded docs (truncated)
  if (setup.strategy && setup.strategy.trim()) {
    ctx += '\nSTRATEGY DOCUMENT (excerpt):\n' + setup.strategy.slice(0, 1200) + '\n';
  }
  if (setup.voice && setup.voice.trim()) {
    ctx += 'BRAND VOICE: ' + setup.voice.slice(0, 300) + '\n';
  }
  var docs = setup.docs || [];
  docs.slice(0, 3).forEach(function(d) {
    if (d.content && d.content.trim()) {
      ctx += '\nDOC [' + (d.name || 'uploaded') + '] (excerpt):\n' + d.content.slice(0, 800) + '\n';
    }
  });

  // Existing top pages for context
  var topPages = (S.snapshot && S.snapshot.topPages ? S.snapshot.topPages : []).slice(0, 15);
  if (topPages.length) {
    ctx += '\nEXISTING TOP PAGES: ' + topPages.map(function(p) { return p.slug; }).join(', ') + '\n';
  }

  var systemPrompt = 'You are an expert SEO strategist. Your job is to generate SHORT HEAD TERMS for keyword research — 2 to 4 words max. These will be fed into Google Autocomplete to generate hundreds of real keyword variations, so they must be broad enough to expand, not specific long-tail phrases.\\n\\nGOAL: Generate the 20-30 most valuable HEAD TERMS a buyer types into Google when searching for this type of business.\\n\\nRULES:\\n- 2 to 4 words MAXIMUM per term — shorter is better\\n- No city names in the terms (city targeting happens via Google Suggest expansion)\\n- Service category first: \"dental laboratory\", \"crown bridge lab\", \"dental prosthetics\"\\n- Include bare service categories, buyer intent modifiers, and problem-aware terms\\n- NO long-tail: never \"dental laboratory services sydney\", never \"affordable crown and bridge lab\"\\n- NO jargon, thought-leadership, or informational terms\\n- Output ONLY a JSON array of strings. No markdown. No explanation. Raw JSON only.\\n\\nGOOD output: [\"dental laboratory\",\"dental lab\",\"crown bridge lab\",\"dental prosthetics\",\"implant laboratory\",\"dental lab near me\",\"best dental lab\",\"dental technician\",\"digital dental lab\",\"same day dental lab\"]\\nBAD output: [\"dental laboratory services sydney\",\"cad cam dental services sydney\",\"affordable implant laboratory\",\"digital dentistry lab services\"]'

  var userPrompt = 'Generate 20-30 SHORT HEAD TERMS (2-4 words max) for this client. These will be expanded by Google Autocomplete — so output BROAD category terms, not specific long-tail phrases. Output ONLY a JSON array.\n\n' + ctx;

  try {
    var result = await callClaude(systemPrompt, userPrompt, null, 8000);
    // Robust JSON repair for truncated or bracket-missing arrays
    var repaired = result.trim();
    // Strip any markdown fences
    repaired = repaired.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
    // Add missing opening bracket
    if (!repaired.startsWith('[') && !repaired.startsWith('{')) {
      repaired = '[' + repaired;
    }
    // If truncated mid-string (ends with partial word or comma), close it cleanly
    if (!repaired.endsWith(']')) {
      // Remove trailing incomplete token (partial quoted string or trailing comma)
      repaired = repaired.replace(/,?\s*"[^"]*$/, '').replace(/,\s*$/, '') + ']';
    }
    // Try bracket-depth extraction as final fallback — handles preamble/postamble from Claude
    if (!safeParseJSON(repaired)) {
      var _start = result.indexOf('[');
      if (_start >= 0) {
        var _depth = 0, _end = -1;
        for (var _i = _start; _i < result.length; _i++) {
          if (result[_i] === '[') _depth++;
          else if (result[_i] === ']') { _depth--; if (_depth === 0) { _end = _i; break; } }
        }
        if (_end > _start) repaired = result.slice(_start, _end + 1);
      }
    }
    var parsed = safeParseJSON(repaired) || safeParseJSON(result);
    if (!Array.isArray(parsed) || !parsed.length) throw new Error('Invalid response: ' + result.slice(0, 100));

    // Normalise + dedupe + cap at 7 words
    var seen = new Set();
    var cleaned = parsed
      .map(function(k) { return String(k).toLowerCase().trim(); })
      .filter(function(k) { return k.length > 3 && k.split(' ').length <= 7 && !seen.has(k) && seen.add(k); })
      .slice(0, 300);

    if (!S.kwResearch) S.kwResearch = { seeds: [], keywords: [], selected: [], clusters: [] };
    // Merge pinned seeds — always included regardless of AI output
    var pinnedKws = S.kwResearch.pinnedSeeds || [];
    pinnedKws.forEach(function(k) { if (cleaned.indexOf(k) < 0) cleaned.push(k); });
    if (!S.kwResearch.seedSources) S.kwResearch.seedSources = { mechanical: [], ai: [], competitor: [] };
    if (!S.kwResearch.activeSources) S.kwResearch.activeSources = ['mechanical','ai','competitor'];
    S.kwResearch.seedSources.ai = cleaned;
    if (S.kwResearch.activeSources.indexOf('ai') < 0) S.kwResearch.activeSources.push('ai');
    _rebuildSeeds();
    S.kwResearch.aiSeedsGeneratedAt = Date.now();
    // Clear stale volume data since seeds changed
    S.kwResearch.keywords = [];
    S.kwResearch.selected = [];
    S.kwResearch.fetchedAt = null;
    scheduleSave();

    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)"><i class="ti ti-check"></i> ' + cleaned.length + ' AI seeds generated — review then click Fetch Volumes</span>';
    renderKwTabContent();
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">Error: ' + esc(e.message) + '</span>';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles"></i> AI Generate Seeds'; }
  }
}

async function fetchKwVolumes() {
  var seeds = S.kwResearch && S.kwResearch.seeds ? S.kwResearch.seeds : buildKwSeeds();
  var statusEl = document.getElementById('kw-seeds-status');
  if (!seeds.length) { if (statusEl) statusEl.textContent = 'No seeds found.'; return; }
  if (statusEl) statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Expanding ' + seeds.length + ' seeds via Google Suggest, then fetching volumes...';
  var r = S.research || {};
  var setup = S.setup || {};
  // Use manually selected country, or auto-detect from geo text
  var country = (S.kwResearch && S.kwResearch.country) ? S.kwResearch.country : (function() {
    var geo = (r.geography && r.geography.primary ? r.geography.primary : (setup.geo || '')).toLowerCase();
    if (geo.indexOf('australia') >= 0 || geo.indexOf(' au') >= 0 || geo.indexOf('sydney') >= 0 || geo.indexOf('melbourne') >= 0 || geo.indexOf('brisbane') >= 0 || geo.indexOf('perth') >= 0) return 'au';
    if (geo.indexOf('canada') >= 0 || geo.indexOf(' bc') >= 0 || geo.indexOf('vancouver') >= 0 || geo.indexOf('calgary') >= 0 || geo.indexOf('toronto') >= 0) return 'ca';
    if (geo.indexOf('united kingdom') >= 0 || geo.indexOf(' uk') >= 0 || geo.indexOf('london') >= 0) return 'gb';
    return 'us';
  })();
  try {
    var res = await fetch('/api/kw-expand', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seeds: seeds, country: country }) });
    var data = await res.json();
    if (!data.keywords || data.error) { if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">Error: ' + esc(data.error || 'No data') + '</span>'; return; }
    console.log('[fetchKwVolumes] received:', data.keywords.length, 'kws, debug:', JSON.stringify(data.debug || {}));
    var scored = data.keywords.map(function(k) {
      var kd = k.difficulty > 0 ? k.difficulty : 30;
      var vol = (k.volume != null && k.volume > 0) ? k.volume : 0;
      var noData = k.volume == null;
      var score = vol >= 10 ? Math.round((Math.log(vol + 1) * 100) / Math.max(kd, 5) * 10) / 10 : 0;
      return { kw: k.keyword, vol: vol, kd: k.difficulty, cpc: k.cpc || 0, score: score, noData: noData, monthly: k.monthly || [] };
    }).sort(function(a, b) { return b.score - a.score; });
    var seen = new Set();
    var deduped = scored.filter(function(k) { if (seen.has(k.kw)) return false; seen.add(k.kw); return true; }).slice(0, 300);
    S.kwResearch.keywords = deduped;
    S.kwResearch.fetchedAt = Date.now();
    S.kwResearch.selected = deduped.slice(0, 50).map(function(k) { return k.kw; });
    scheduleSave();
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)"><i class="ti ti-check"></i> ' + deduped.length + ' keywords found <span style="opacity:0.6;font-size:10px">(Google Suggest + DataForSEO)</span></span>';
    _kwTab = 'opps';
    renderKwTabContent();
  } catch(e) { if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">Error: ' + esc(e.message) + '</span>'; }
}

function sortKwOpps(col) {
  if (!S.kwSort) S.kwSort = { col: 'score', dir: 'desc' };
  if (S.kwSort.col === col) {
    S.kwSort.dir = S.kwSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    S.kwSort.col = col;
    S.kwSort.dir = 'desc';
  }
  renderKwTabContent();
}

function _renderKwOppsTab() {
  var kws = S.kwResearch && S.kwResearch.keywords ? S.kwResearch.keywords : [];
  var selected = new Set(S.kwResearch && S.kwResearch.selected ? S.kwResearch.selected : []);
  if (!kws.length) return '<div style="text-align:center;padding:40px 20px;color:var(--n2)"><i class="ti ti-chart-bar" style="font-size:32px;display:block;margin-bottom:8px"></i><div style="font-size:13px">No volumes yet \u2014 go to Seeds and click Fetch Volumes.</div></div>';
  var html = '<div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">';
  html += '<button class="btn btn-primary" onclick="clusterSelectedKws()"><i class="ti ti-stack-2"></i> Cluster Selected <span style="font-size:10px;opacity:0.7">(' + selected.size + ')</span></button>';
  html += '<button class="btn btn-ghost sm" onclick="selectTopKws(50)">Select Top 50</button>';
  html += '<button class="btn btn-ghost sm" onclick="selectTopKws(0)">Clear</button>';
  html += '<span id="kw-cluster-status" style="font-size:11px;color:var(--n2);display:inline-flex;align-items:center;gap:6px"></span>';
  // DR input for rankability indicator
  var drVal = (S.kwResearch && S.kwResearch.siteDR) ? S.kwResearch.siteDR : '';
  html += '<div style="display:inline-flex;align-items:center;gap:6px;margin-left:auto;padding:4px 10px;background:var(--panel);border-radius:6px;border:1px solid var(--border)">';
  html += '<span style="font-size:11px;color:var(--n2);white-space:nowrap"><i class="ti ti-shield-half" style="margin-right:3px"></i>Site DR</span>';
  html += '<input id="kw-dr-input" type="number" min="0" max="100" placeholder="e.g. 36" value="' + esc(String(drVal)) + '" style="width:56px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg);color:var(--dark)" onchange="_setKwDR(this.value)" oninput="_setKwDR(this.value)">';
  html += '<span style="font-size:10px;color:var(--n2)">→ rankability</span>';
  html += '</div>';
  html += '</div>';
  html += '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">';
  if (!S.kwSort) S.kwSort = { col: 'score', dir: 'desc' };
  var sortCol = S.kwSort.col, sortDir = S.kwSort.dir;
  // Always recalculate score at render time — ensures stale KV data gets updated formula
  kws = kws.map(function(k) {
    var kd = k.kd > 0 ? k.kd : 30;
    var score = k.vol >= 10 ? Math.round((Math.log(k.vol + 1) * 100) / Math.max(kd, 5) * 10) / 10 : 0;
    return Object.assign({}, k, { score: score });
  });
  var sortedKws = kws.slice().sort(function(a, b) {
    var av, bv;
    if (sortCol === 'vol') { av = a.vol; bv = b.vol; }
    else if (sortCol === 'kd') { av = a.kd === 0 ? 999 : a.kd; bv = b.kd === 0 ? 999 : b.kd; }
    else if (sortCol === 'cpc') { av = a.cpc || 0; bv = b.cpc || 0; }
    else { av = a.score; bv = b.score; }
    return sortDir === 'asc' ? av - bv : bv - av;
  });
  function hdrBtn(label, col) {
    var active = sortCol === col;
    var arrow = active ? (sortDir === 'asc' ? ' &#x2191;' : ' &#x2193;') : '';
    var clr = active ? 'var(--dark)' : 'var(--n3)';
    return '<span onclick="sortKwOpps(\'' + col + '\')" style="cursor:pointer;color:' + clr + ';user-select:none;white-space:nowrap" title="Sort by ' + label + '">' + label + arrow + '</span>';
  }
  html += '<div style="display:grid;grid-template-columns:28px 1fr 76px 44px 58px 54px 56px;background:var(--panel);padding:6px 12px;border-bottom:1px solid var(--border);font-size:11px;font-weight:500;gap:4px"><span></span><span style="color:var(--n3)">Keyword</span>' + hdrBtn('Vol','vol') + hdrBtn('KD','kd') + hdrBtn('CPC','cpc') + '<span style="color:var(--n3)">Trend</span>' + hdrBtn('Score','score') + '</div>';
  sortedKws.slice(0, 200).forEach(function(k, i) {
    var isSel = selected.has(k.kw);
    // DR-aware rankability: Green=rankable, Yellow=stretch, Red=out of range, Grey=no data
    var siteDR = (S.kwResearch && S.kwResearch.siteDR) ? parseInt(S.kwResearch.siteDR) : 0;
    var kdClr, kdLabel2, rankTip;
    if (k.kd === 0) {
      kdClr = 'var(--n1)'; kdLabel2 = ''; rankTip = 'No KD data';
    } else if (!siteDR) {
      // No DR set — fallback to old static colouring
      kdClr = k.kd < 20 ? 'var(--green)' : k.kd < 40 ? 'var(--warn)' : 'var(--error)';
      kdLabel2 = ''; rankTip = 'Enter Site DR above for rankability';
    } else {
      var maxGreen = Math.round(siteDR * 0.7);
      var maxYellow = Math.round(siteDR * 1.1);
      if (k.kd <= maxGreen) {
        kdClr = 'var(--green)'; kdLabel2 = ' ✓'; rankTip = 'Rankable (KD within DR range)';
      } else if (k.kd <= maxYellow) {
        kdClr = 'var(--warn)'; kdLabel2 = ' ~'; rankTip = 'Stretch — possible with strong content + links';
      } else {
        kdClr = 'var(--error)'; kdLabel2 = ' ✗'; rankTip = 'Too competitive for current DR (' + siteDR + ')';
      }
    }
    var volClr = k.noData ? 'var(--n1)' : k.vol >= 500 ? 'var(--green)' : k.vol >= 100 ? 'var(--n3)' : 'var(--n2)';
    var rowBg = isSel ? 'rgba(21,142,29,0.05)' : (i % 2 ? 'var(--bg)' : '');
    var spark = '';
    if (k.monthly && k.monthly.length >= 2) {
      var mx = Math.max.apply(null, k.monthly);
      var tr = k.monthly[k.monthly.length - 1] > k.monthly[0] ? '<span style="color:var(--green)">&#x2191;</span>' : '<span style="color:var(--error)">&#x2193;</span>';
      spark = '<span style="display:inline-flex;align-items:flex-end;gap:1px">' + k.monthly.slice(-6).map(function(v) { var h = mx > 0 ? Math.round((v / mx) * 14) + 2 : 2; return '<span style="display:inline-block;width:4px;height:' + h + 'px;background:var(--n1);border-radius:1px;vertical-align:bottom"></span>'; }).join('') + '</span>' + tr;
    } else spark = '<span style="color:var(--n1)">-</span>';
        html += '<div data-kw="' + esc(k.kw) + '" onclick="_toggleKwByAttr(this)" style="display:grid;grid-template-columns:28px 1fr 76px 44px 58px 54px 56px;padding:5px 12px;border-bottom:1px solid var(--border);background:' + rowBg + ';cursor:pointer;align-items:center;gap:4px">'
      + '<input type="checkbox" ' + (isSel ? 'checked' : '') + ' style="pointer-events:none;accent-color:var(--green)">'
      + '<span style="font-size:12px;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(k.kw) + '</span>'
      + '<span style="color:' + volClr + ';font-weight:500;font-size:12px">' + (k.noData ? '—' : (k.vol || 0).toLocaleString()) + '</span>'
      + '<span style="color:' + kdClr + ';font-weight:500;font-size:12px">' + (k.kd === 0 ? '?' : k.kd) + (typeof kdLabel2 !== 'undefined' ? kdLabel2 : '') + '</span>'
      + '<span style="font-size:11px;color:var(--green)">' + (k.cpc ? '$' + k.cpc.toFixed(2) : '<span style="color:var(--n1)">-</span>') + '</span>'
      + '<span style="font-size:11px">' + spark + '</span>'
      + '<span style="font-size:11px;color:var(--n2)">' + k.score + '</span>'
      + '</div>';
  });
  if (sortedKws.length > 200) html += '<div style="padding:6px 12px;font-size:11px;color:var(--n2);background:var(--bg)">+' + (sortedKws.length - 200) + ' more available</div>';
  html += '</div></div>';
  return html;
}

function _toggleKwByAttr(el) {
  var kw = el.getAttribute('data-kw');
  if (!kw) return;
  if (!S.kwResearch) return;
  if (!S.kwResearch.selected) S.kwResearch.selected = [];
  var pos = S.kwResearch.selected.indexOf(kw);
  if (pos >= 0) S.kwResearch.selected.splice(pos, 1);
  else S.kwResearch.selected.push(kw);
  scheduleSave();
  renderKwTabContent();
}

function _toggleKwSel(kwEncoded) {
  if (!S.kwResearch || !S.kwResearch.keywords) return;
  var kw = decodeURIComponent(kwEncoded);
  if (!kw) return;
  if (!S.kwResearch.selected) S.kwResearch.selected = [];
  var pos = S.kwResearch.selected.indexOf(kw);
  if (pos >= 0) S.kwResearch.selected.splice(pos, 1);
  else S.kwResearch.selected.push(kw);
  renderKwTabContent();
}

function selectTopKws(n) {
  if (!S.kwResearch) return;
  S.kwResearch.selected = n > 0 ? S.kwResearch.keywords.slice(0, n).map(function(k) { return k.kw; }) : [];
  renderKwTabContent();
}

async function clusterSelectedKws() {
  var selected = S.kwResearch && S.kwResearch.selected ? S.kwResearch.selected : [];
  if (selected.length < 5) { if(typeof aiBarNotify==='function') aiBarNotify('Select at least 5 keywords first.', {isError:true,duration:3000}); return; }
  var statusEl = document.getElementById('kw-cluster-status');
  if (statusEl) statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Clustering...';
  var reclusterBtn = document.getElementById('recluster-btn');
  if (reclusterBtn) { reclusterBtn.disabled = true; reclusterBtn.innerHTML = '<span class="spinner" style="width:11px;height:11px"></span> Clustering…'; }
  var kwMap = {};
  (S.kwResearch.keywords || []).forEach(function(k) { kwMap[k.kw] = k; });
  var selKws = selected.map(function(s) { return kwMap[s] || { kw: s, vol: 0, kd: 0, score: 0 }; });
  var existingPages = (S.snapshot && S.snapshot.topPages ? S.snapshot.topPages : []).map(function(p) {
    var entry = p.slug;
    if (p.rankingKws && p.rankingKws.length) {
      var topKws = p.rankingKws.slice(0, 3).map(function(k) { return k.kw + '(#' + k.pos + ')'; }).join(', ');
      entry = p.slug + ' [ranking: ' + topKws + ']';
    }
    return entry;
  }).filter(Boolean);
  // Always inject structural pages — these exist on every site but never have SEO traffic so they won't appear in topPages
  var structuralSlugs = ['/about', '/about-us', '/contact', '/contact-us', '/'];
  structuralSlugs.forEach(function(slug) {
    var alreadyIn = existingPages.some(function(p) { return p.startsWith(slug + ' ') || p === slug; });
    if (!alreadyIn) existingPages.unshift(slug + ' [structural — already exists, do NOT recommend build_new]');
  });
  // Also inject any pages from S.pages if available
  if (S.pages && S.pages.length) {
    S.pages.forEach(function(p) {
      var slug = p.slug || p.path || '';
      if (!slug) return;
      var alreadyIn = existingPages.some(function(ep) { return ep.startsWith(slug + ' ') || ep === slug; });
      if (!alreadyIn) existingPages.push(slug + ' [existing page]');
    });
  }
  var r = S.research || {};
  var setup = S.setup || {};
  var geo = r.geography && r.geography.primary ? r.geography.primary : (setup.geo || '');
  var userPrompt = 'KEYWORDS (' + selKws.length + '):\n';
  userPrompt += 'kw | vol | kd | score\n';
  selKws.forEach(function(k) { userPrompt += k.kw + ' | ' + k.vol + ' | ' + k.kd + ' | ' + k.score + '\n'; });
  userPrompt += '\nCLIENT: ' + (setup.client || '') + ' | Services: ' + (r.primary_services || []).join(', ') + ' | Geo: ' + geo;
  if (existingPages.length) userPrompt += '\n\nEXISTING PAGES:\n' + existingPages.slice(0, 20).join('\n');
  var clusterQs = _getQuestionsArray ? _getQuestionsArray().slice(0, 20) : [];
  if (clusterQs.length) userPrompt += '\n\nPEOPLE ALSO ASK (use for blog clusters and FAQ assignments):\n' + clusterQs.map(function(q) { return '- ' + q; }).join('\n');
  var systemPrompt = 'SEO architect. Cluster keywords into page groups. Return ONLY raw JSON array, no markdown.\n\nRules:\n- Homepage(/): broadest brand/agency keyword. Never a specific service term.\n- Service(/services/slug): specific service+city. vol>0 required.\n- Location(/locations/slug): city+marketing. vol>100 required.\n- Industry(/industries/slug): marketing for [industry]. vol>100 required.\n- Blog(/blog/slug): informational intent. vol>50 required.\n- Always include /about and /contact as structural (vol:0 ok). These ALWAYS get recommendation=improve_existing — NEVER build_new.\n- /about, /about-us = same page. /contact, /contact-us = same page. / = homepage. These pages ALWAYS EXIST — treat as improve_existing.\n- If cluster maps to any existing page: recommendation=improve_existing, existingSlug=exact slug from EXISTING PAGES list. Else build_new.\n- Slug matching: match by intent not exact string. Use the EXISTING slug verbatim if matched.\n- CRITICAL: If primaryVol < 50 AND recommendation would be build_new — set qualifies:false, disqualifyReason=\'Low volume — fold into a related existing page or blog pillar instead of building a standalone page\'. NEVER recommend build_new for a page with primaryVol < 50.\n- Set qualifies:false + disqualifyReason if vol thresholds not met.\n\nSchema: [{"name":"","pageType":"service","suggestedSlug":"services/seo-vancouver","primaryKw":"","primaryVol":0,"primaryKd":0,"score":0,"recommendation":"build_new","existingSlug":null,"qualifies":true,"disqualifyReason":null,"supportingKws":["kw1","kw2"]}]';
  try {
    // Use sync endpoint for clustering — streaming cuts off large JSON responses
    var clusterRes = await fetch('/api/claude-sync', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 8000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] })
    });
    var clusterData = await clusterRes.json();
    var result = (clusterData.content && clusterData.content[0] && clusterData.content[0].text) ? clusterData.content[0].text : '';
    var parsed = safeParseJSON(result);
    if (!Array.isArray(parsed) || !parsed.length) throw new Error('Invalid cluster response — raw: ' + (result || '').slice(0,200));
    S.kwResearch.clusters = parsed;
    S.kwResearch.clusteredAt = Date.now();
    scheduleSave();
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)"><i class="ti ti-check"></i> ' + parsed.length + ' clusters</span>';
    var btn = document.getElementById('kw-proceed-btn');
    if (btn) btn.style.display = '';
    _kwTab = 'clusters';
    renderKwTabContent();
    var reclusterBtnDone = document.getElementById('recluster-btn');
    if (reclusterBtnDone) { reclusterBtnDone.disabled = false; reclusterBtnDone.innerHTML = '<i class="ti ti-refresh"></i> Re-cluster'; }
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">Error: ' + esc(e.message) + '</span>';
    var reclusterBtnErr = document.getElementById('recluster-btn');
    if (reclusterBtnErr) { reclusterBtnErr.disabled = false; reclusterBtnErr.innerHTML = '<i class="ti ti-refresh"></i> Re-cluster'; }
  }
}

function _renderKwClustersTab() {
  var clusters = S.kwResearch && S.kwResearch.clusters ? S.kwResearch.clusters : [];
  if (!clusters.length) return '<div style="text-align:center;padding:40px 20px;color:var(--n2)"><i class="ti ti-stack-2" style="font-size:32px;display:block;margin-bottom:8px"></i><div style="font-size:13px">No clusters yet.</div><div style="font-size:12px;margin-top:6px">Select keywords in Opportunities, then click Cluster Selected.</div></div>';
  var ts = S.kwResearch.clusteredAt ? new Date(S.kwResearch.clusteredAt).toLocaleTimeString('en-CA', {hour:'2-digit',minute:'2-digit'}) : '';
  var newCt = clusters.filter(function(c) { return c.recommendation === 'build_new' && c.qualifies !== false; }).length;
  var impCt = clusters.filter(function(c) { return c.recommendation === 'improve_existing'; }).length;
  var flagCt = clusters.filter(function(c) { return c.qualifies === false; }).length;
  var html = '<div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">';
  html += '<button class="btn btn-primary" onclick="goToSitemap()"><i class="ti ti-sitemap"></i> Build Sitemap from Clusters</button>';
  html += '<button id="recluster-btn" class="btn btn-ghost" onclick="clusterSelectedKws()"><i class="ti ti-refresh"></i> Re-cluster</button>';
  if (ts) html += '<span style="font-size:11px;color:var(--n2)">Clustered at ' + ts + '</span>';
  html += '</div>';
  html += '<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">';
  html += '<div style="padding:8px 14px;background:rgba(21,142,29,0.08);border:1px solid rgba(21,142,29,0.2);border-radius:8px;font-size:12px"><strong style="color:var(--green)">' + newCt + '</strong><span style="color:var(--n2);margin-left:4px">Build New</span></div>';
  html += '<div style="padding:8px 14px;background:rgba(250,180,30,0.08);border:1px solid rgba(250,180,30,0.2);border-radius:8px;font-size:12px"><strong style="color:var(--warn)">' + impCt + '</strong><span style="color:var(--n2);margin-left:4px">Improve Existing</span></div>';
  if (flagCt) html += '<div style="padding:8px 14px;background:var(--panel);border-radius:8px;font-size:12px"><strong style="color:var(--n2)">' + flagCt + '</strong><span style="color:var(--n2);margin-left:4px">Flagged</span></div>';
  html += '</div>';
  var ptIcons = {home:'ti-home',service:'ti-briefcase',location:'ti-map-pin',industry:'ti-building-factory',blog:'ti-pencil',structural:'ti-lock'};
  clusters.forEach(function(c) {
    var badgeClr = c.qualifies === false ? 'var(--n2)' : (c.recommendation === 'improve_existing' ? 'var(--warn)' : 'var(--green)');
    var badgeTxt = c.qualifies === false ? 'LOW VOL' : (c.recommendation === 'improve_existing' ? 'IMPROVE' : 'BUILD NEW');
    var ptIcon = (ptIcons[c.pageType] || 'ti-file');
    html += '<div style="border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:8px;background:var(--bg)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">';
    html += '<div style="display:flex;gap:8px;align-items:center"><i class="ti ' + ptIcon + '" style="color:var(--n2);font-size:13px"></i>';
    html += '<div><div style="font-size:13px;font-weight:500">' + esc(c.name || '') + '</div>';
    html += '<div style="font-size:11px;color:var(--n2)">/' + esc(c.suggestedSlug || '') + (c.existingSlug ? ' <span style="color:var(--warn)">(existing: /' + esc(c.existingSlug) + ')</span>' : '') + '</div></div></div>';
    html += '<span style="font-size:10px;font-weight:600;color:' + badgeClr + ';border:1px solid ' + badgeClr + ';padding:2px 7px;border-radius:10px;flex-shrink:0">' + badgeTxt + '</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:12px;font-size:11px;color:var(--n3);flex-wrap:wrap;align-items:center">';
    html += '<strong style="color:var(--dark)">' + esc(c.primaryKw || '') + '</strong>';
    if (c.primaryVol) html += '<span style="color:' + (c.primaryVol >= 500 ? 'var(--green)' : c.primaryVol >= 100 ? 'var(--n3)' : 'var(--n1)') + '">' + c.primaryVol.toLocaleString() + '/mo</span>';
    if (c.primaryKd != null) html += '<span style="color:' + (c.primaryKd < 20 ? 'var(--green)' : c.primaryKd < 40 ? 'var(--warn)' : 'var(--error)') + '">KD:' + (c.primaryKd || '?') + '</span>';
    if (c.score) html += '<span style="color:var(--n2)">score:' + c.score + '</span>';
    html += '</div>';
    if (c.disqualifyReason) html += '<div style="font-size:11px;color:var(--n1);margin-top:4px">' + esc(c.disqualifyReason) + '</div>';
    if (c.supportingKws && c.supportingKws.length) {
      html += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">';
      c.supportingKws.slice(0, 5).forEach(function(sk) { html += '<span style="font-size:10px;padding:2px 7px;background:var(--panel);border-radius:10px;color:var(--n2)">' + esc(typeof sk === 'object' ? sk.kw : sk) + '</span>'; });
      html += '</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

async function validateAndAssignQuestions() {
  var qs = _getQuestionsArray();
  if (!qs.length) { if(typeof aiBarNotify==='function') aiBarNotify('No questions yet — fetch questions first.', {isError:true,duration:3000}); return; }

  var statusEl = document.getElementById('kw-questions-fetch-status');
  var r = S.research || {};
  var setup = S.setup || {};
  var geo = (r.geography && r.geography.primary ? r.geography.primary : (setup.geo || '')).toLowerCase();
  var country = (geo.indexOf('canada') >= 0 || geo.indexOf(' bc') >= 0 || geo.indexOf('vancouver') >= 0) ? 'ca' : 'us';

  // ── Step 1: Volume lookup ────────────────────────────────────────────────
  if (statusEl) statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;display:inline-block;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 0.6s linear infinite"></span> Step 1/2: Checking search volumes...';

  var volMap = {};
  try {
    var volRes = await fetch('/api/kw-expand', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seeds: qs.slice(0, 30), country: country })
    });
    var volData = await volRes.json();
    if (volData.keywords && volData.keywords.length) {
      volData.keywords.forEach(function(k) {
        var qMatch = qs.find(function(q) { return q.toLowerCase() === k.keyword.toLowerCase(); });
        if (qMatch) volMap[qMatch] = k.volume || 0;
      });
    }
  } catch(e) { /* vol lookup failed silently — continue to assignment */ }

  // ── Step 2: AI page assignment ────────────────────────────────────────────
  if (statusEl) statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;display:inline-block;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 0.6s linear infinite"></span> Step 2/2: Assigning questions to pages...';

  // Build page list from snapshot + clusters
  var existingPages = [];
  if (S.snapshot && S.snapshot.topPages) {
    S.snapshot.topPages.forEach(function(p) { existingPages.push(p.slug); });
  }
  if (S.kwResearch && S.kwResearch.clusters) {
    S.kwResearch.clusters.forEach(function(c) {
      if (c.existingSlug && existingPages.indexOf(c.existingSlug) < 0) existingPages.push(c.existingSlug);
      if (c.recommendation === 'build_new' && c.qualifies !== false && existingPages.indexOf(c.slug) < 0) existingPages.push(c.slug);
    });
  }
  // Always include core pages
  ['/', '/about', '/about-us', '/contact', '/services', '/faq'].forEach(function(p) {
    if (existingPages.indexOf(p) < 0) existingPages.push(p);
  });

  var qList = qs.map(function(q, i) { return (i + 1) + '. ' + q; }).join('\n');
  var pageList = existingPages.slice(0, 40).join(', ');
  var businessName = (setup.businessName || 'the business');
  var services = (r.primary_services || []).slice(0, 6).join(', ');

  var sysPrompt = 'You are an SEO architect. Assign each question to the best page on the website. Return ONLY a valid JSON array, no markdown, no explanation.';
  var userPrompt = 'Business: ' + businessName + '\nServices: ' + (services || 'marketing services') + '\nExisting pages: ' + pageList + '\n\nQuestions to assign:\n' + qList + '\n\nFor each question return a JSON object with:\n- i: question number (1-based)\n- slug: best page slug from existing pages, OR a new slug like /blog/how-to-choose-agency if no existing page fits\n- type: "faq_on_page" (belongs as FAQ on a service/about page), "new_blog" (deserves its own blog post), or "sitewide_faq" (generic trust question for /faq or homepage)\n\nRules:\n- Prefer existing pages over new ones\n- "how much does X cost", "how long does X take", "what to expect" -> faq_on_page on the relevant service page\n- "how to choose", "vs", "difference between", "best agency" -> new_blog if vol > 50, else faq_on_page on homepage or /faq\n- Generic trust questions ("are you legit", "do you have reviews") -> sitewide_faq\n- Use existing slugs verbatim when matched';

  try {
    var aiRes = await fetch('/api/claude', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: sysPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    var aiData = await aiRes.json();
    var raw = (aiData.content && aiData.content[0] && aiData.content[0].text) ? aiData.content[0].text.trim() : '';
    raw = raw.replace(/```json|```/g, '').trim();
    var assignments = JSON.parse(raw);

    // Merge vol + assignment back into question objects
    if (!S.contentIntel) S.contentIntel = { paa: null, gap: null, blogTopics: [] };
    if (!S.contentIntel.paa) S.contentIntel.paa = { questions: qs.map(function(q) { return { question: q }; }) };

    // Normalise questions to objects
    S.contentIntel.paa.questions = S.contentIntel.paa.questions.map(function(q) {
      return typeof q === 'object' ? q : { question: q };
    });

    // Apply vol
    S.contentIntel.paa.questions.forEach(function(qObj) {
      if (volMap.hasOwnProperty(qObj.question)) qObj.vol = volMap[qObj.question];
    });

    // Apply assignments
    assignments.forEach(function(a) {
      var idx = (a.i || 1) - 1;
      if (S.contentIntel.paa.questions[idx]) {
        S.contentIntel.paa.questions[idx].assignedSlug = a.slug || null;
        S.contentIntel.paa.questions[idx].contentType = a.type || 'faq_on_page';
      }
    });

    S.contentIntel.paa.validatedAt = Date.now();
    scheduleSave();

    var withVol = S.contentIntel.paa.questions.filter(function(q) { return q.vol > 0; }).length;
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)"><i class="ti ti-check"></i> Validated — ' + withVol + ' questions have search volume, all assigned to pages</span>';
    renderKwTabContent();
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">Assignment error: ' + esc(e.message) + '</span>';
  }
}

function _overrideQuestionAssignment(qi, slug) {
  if (!S.contentIntel || !S.contentIntel.paa || !S.contentIntel.paa.questions) return;
  if (S.contentIntel.paa.questions[qi]) {
    S.contentIntel.paa.questions[qi].assignedSlug = slug;
    scheduleSave();
    renderKwTabContent();
  }
}

function _addQuestionToSitemap(qi) {
  if (!S.contentIntel || !S.contentIntel.paa || !S.contentIntel.paa.questions) return;
  var qObj = S.contentIntel.paa.questions[qi];
  if (!qObj || !qObj.assignedSlug) return;
  // Push to S.kwResearch pending sitemap suggestions
  if (!S.kwResearch) S.kwResearch = { seeds: [], keywords: [], selected: [], clusters: [], paaQuestions: [] };
  if (!S.kwResearch.sitemapSuggestions) S.kwResearch.sitemapSuggestions = [];
  var slug = qObj.assignedSlug.replace(/^\//,'');
  var exists = S.kwResearch.sitemapSuggestions.some(function(s) { return s.slug === slug; });
  if (exists) return;
  S.kwResearch.sitemapSuggestions.push({
    slug: slug,
    question: qObj.question,
    source: 'aeo_question',
    contentType: qObj.contentType || 'new_blog',
    addedAt: Date.now()
  });
  qObj.addedToSitemap = true;
  scheduleSave();
  renderKwTabContent();
}

function _getCoverageSlugs() {
  // Build full set of slugs that are covered by clusters or existing pages
  var covered = new Set();
  if (S.kwResearch && S.kwResearch.clusters) {
    S.kwResearch.clusters.forEach(function(c) {
      if (c.qualifies === false) return;
      if (c.existingSlug) covered.add(c.existingSlug.replace(/^\//,''));
      if (c.suggestedSlug) covered.add(c.suggestedSlug.replace(/^\//,''));
      if (c.slug) covered.add(c.slug.replace(/^\//,''));
    });
  }
  if (S.snapshot && S.snapshot.topPages) {
    S.snapshot.topPages.forEach(function(p) {
      if (p.slug) covered.add(p.slug.replace(/^\//,''));
    });
  }
  if (S.pages && S.pages.length) {
    S.pages.forEach(function(p) {
      if (p.slug) covered.add(p.slug.replace(/^\//,''));
    });
  }
  // Always consider core structural pages covered
  ['', 'about', 'about-us', 'contact', 'services', 'faq', 'pricing'].forEach(function(s) { covered.add(s); });
  return covered;
}

function _renderKwQuestionsTab() {
  // Get questions as full objects (with vol/assignment if validated)
  var rawQs = (S.contentIntel && S.contentIntel.paa && S.contentIntel.paa.questions) ? S.contentIntel.paa.questions : [];
  var normalised = rawQs.map(function(q) { return typeof q === 'object' ? q : { question: q }; });
  var isValidated = !!(S.contentIntel && S.contentIntel.paa && S.contentIntel.paa.validatedAt);

  var html = '<div>';
  if (!normalised.length) {
    html += '<div style="text-align:center;padding:40px 20px;color:var(--n2)">';
    html += '<i class="ti ti-help-circle" style="font-size:32px;display:block;margin-bottom:8px"></i>';
    html += '<div style="font-size:13px;margin-bottom:8px">No questions fetched yet.</div>';
    html += '<div style="font-size:12px;color:var(--n2);margin-bottom:16px">AI-generates bottom-of-funnel questions real buyers ask when evaluating your services.</div>';
    html += '<button class="btn btn-primary" onclick="fetchPAAFromKeywords()"><i class="ti ti-download"></i> Fetch Questions Now</button>';
    html += '</div>';
  } else {
    html += '<div style="font-size:12px;color:var(--n2);margin-bottom:10px">Buyer-intent questions real prospects ask when evaluating your agency. Validate to get search volumes and page assignments — these flow into copy briefs and FAQ schema.</div>';
    html += '<div id="kw-questions-fetch-status" style="font-size:11px;color:var(--n2);margin-bottom:8px"></div>';

    // Action bar
    html += '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">';
    html += '<button class="btn btn-primary" onclick="validateAndAssignQuestions()"><i class="ti ti-bolt"></i> Validate & Assign' + (isValidated ? ' Again' : '') + '</button>';
    html += '<button class="btn btn-ghost" onclick="fetchPAAFromKeywords()"><i class="ti ti-refresh"></i> Re-fetch</button>';
    html += '<button class="btn btn-ghost" onclick="generateMoreQuestions()" id="more-questions-btn"><i class="ti ti-plus"></i> More Questions</button>';
    html += '<button class="btn btn-ghost" onclick="generateBlogSeedsFromQuestions()"><i class="ti ti-sparkles"></i> Blog Seeds</button>';
    html += '<button class="btn btn-ghost sm" onclick="addAllQuestionsAsSeeds()"><i class="ti ti-plus"></i> Add All to Seeds</button>';
    if (isValidated) {
      var withVol = normalised.filter(function(q) { return q.vol > 0; }).length;
      html += '<span style="font-size:11px;color:var(--green);display:inline-flex;align-items:center;gap:4px"><i class="ti ti-check"></i> ' + withVol + '/' + normalised.length + ' have search volume</span>';
    }
    html += '</div>';

    // Sort by vol desc if validated, else keep order
    var sorted = normalised.slice();
    if (isValidated) {
      sorted.sort(function(a, b) { return (b.vol || 0) - (a.vol || 0); });
    }

    // Coverage data
    var hasClusters = !!(S.kwResearch && S.kwResearch.clusters && S.kwResearch.clusters.length);
    var coveredSlugs = hasClusters ? _getCoverageSlugs() : null;

    // Table header
    var cols = '1fr ' + (isValidated ? '80px 160px ' : '') + (hasClusters ? '100px ' : '') + '100px';
    html += '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">';
    html += '<div style="display:grid;grid-template-columns:' + cols + ';background:var(--panel);padding:6px 12px;border-bottom:1px solid var(--border);font-size:11px;font-weight:500;color:var(--n3);gap:8px">';
    html += '<span>Question</span>';
    if (isValidated) {
      html += '<span>Vol</span>';
      html += '<span>Assigned Page</span>';
    }
    if (hasClusters) html += '<span>Coverage</span>';
    html += '<span>Intent</span>';
    html += '</div>';

    sorted.forEach(function(qObj, i) {
      var q = qObj.question || '';
      var origIdx = normalised.indexOf(qObj);
      var vol = qObj.vol;
      var hasVol = typeof vol === 'number';
      var volDisplay = hasVol ? (vol > 0 ? vol.toLocaleString() : '0') : '-';
      var volClr = !hasVol ? 'var(--n2)' : vol >= 100 ? 'var(--green)' : vol > 0 ? 'var(--warn)' : 'var(--n2)';

      var assignedSlug = qObj.assignedSlug || null;
      var contentType = qObj.contentType || null;
      var typeClr = contentType === 'new_blog' ? 'var(--primary)' : contentType === 'sitewide_faq' ? 'var(--warn)' : 'var(--n3)';
      var typeIcon = contentType === 'new_blog' ? 'ti-file-plus' : contentType === 'sitewide_faq' ? 'ti-world' : 'ti-file-text';

      // Intent: use AI assignment type when available, else keyword-based signal
      var intentLabel, intentClr;
      if (contentType === 'new_blog') {
        intentLabel = 'Blog / FAQ'; intentClr = 'var(--green)';
      } else if (contentType === 'sitewide_faq') {
        intentLabel = 'Sitewide FAQ'; intentClr = 'var(--n2)';
      } else if (contentType === 'faq_on_page') {
        intentLabel = 'Service / Landing'; intentClr = 'var(--warn)';
      } else {
        // Fallback: commercial signals win over question words
        var isBOF = q.match(/cost|price|pricing|hire|worth|vs |versus|compare|best |top |near me|agency in|reviews|legit|guarantee|roas|roi|how much|affordable|cheap|budget/i);
        intentLabel = isBOF ? 'Service / Landing' : 'Blog / FAQ';
        intentClr = isBOF ? 'var(--warn)' : 'var(--green)';
      }

      var rowBg = i % 2 ? 'background:var(--bg)' : '';

      // Coverage check
      var assignedSlugClean = assignedSlug ? assignedSlug.replace(/^\//, '') : null;
      var isCovered = false;
      var isGap = false;
      if (hasClusters && assignedSlugClean) {
        // Check exact + fuzzy: structural pages always covered, others check set
        isCovered = coveredSlugs.has(assignedSlugClean);
        // Fuzzy: check if any covered slug starts with the same first segment
        if (!isCovered) {
          var firstSeg = assignedSlugClean.split('/')[0];
          coveredSlugs.forEach(function(s) { if (s.split('/')[0] === firstSeg && firstSeg.length > 2) isCovered = true; });
        }
        isGap = !isCovered;
      }

      html += '<div style="display:grid;grid-template-columns:' + cols + ';padding:8px 12px;border-bottom:1px solid var(--border);' + rowBg + ';gap:8px;align-items:center">';

      // Question text
      html += '<div style="font-size:12px;color:var(--dark)">' + esc(q) + '</div>';

      if (isValidated) {
        // Vol badge
        html += '<div style="font-size:12px;font-weight:600;color:' + volClr + '">' + volDisplay + '</div>';
        // Assigned page
        if (assignedSlug) {
          html += '<div style="display:flex;flex-direction:column;gap:2px">';
          html += '<div style="font-size:10px;color:' + typeClr + ';display:flex;align-items:center;gap:3px"><i class="ti ' + typeIcon + '"></i> ' + (contentType === 'new_blog' ? 'New page' : contentType === 'sitewide_faq' ? 'Sitewide FAQ' : 'FAQ on page') + '</div>';
          html += '<div style="font-size:11px;color:var(--n3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(assignedSlug) + '">' + esc(assignedSlug) + '</div>';
          html += '</div>';
        } else {
          html += '<div style="font-size:11px;color:var(--n2)">—</div>';
        }
      }

      // Coverage cell
      if (hasClusters) {
        if (!assignedSlug) {
          html += '<div style="font-size:11px;color:var(--n2)">—</div>';
        } else if (isCovered) {
          html += '<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--green)"><i class="ti ti-circle-check-filled"></i> Covered</div>';
        } else {
          var alreadyAdded = qObj.addedToSitemap;
          if (alreadyAdded) {
            html += '<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--n3)"><i class="ti ti-check"></i> In sitemap</div>';
          } else {
            html += '<div style="display:flex;flex-direction:column;gap:3px">';
            html += '<span style="font-size:10px;color:var(--warn);display:flex;align-items:center;gap:3px"><i class="ti ti-alert-triangle"></i> Gap</span>';
            if (qObj.contentType === 'new_blog' || qObj.contentType === 'sitewide_faq') {
              html += '<button onclick="_addQuestionToSitemap(' + origIdx + ')" style="font-size:10px;padding:2px 7px;border:1px solid var(--warn);background:rgba(255,160,0,0.08);color:var(--warn);border-radius:4px;cursor:pointer;white-space:nowrap">+ Sitemap</button>';
            }
            html += '</div>';
          }
        }
      }

      // Intent badge
      html += '<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">';
      html += '<span style="font-size:10px;color:' + intentClr + '">' + intentLabel + '</span>';
      html += '</div>';

      html += '</div>';
    });
    html += '</div>';

    if (!isValidated) {
      html += '<div style="margin-top:12px;padding:10px 14px;background:rgba(21,142,29,0.06);border-radius:6px;font-size:11px;color:var(--n3);border:1px solid rgba(21,142,29,0.2)">';
      html += '<strong style="color:var(--dark)"><i class="ti ti-bolt"></i> Run Validate & Assign</strong> to check search volumes and map each question to a page. Questions with vol > 0 become content priorities; all questions feed FAQ schema in Stage 8.';
      html += '</div>';
    } else {
      var gapCount = hasClusters ? normalised.filter(function(q) {
        if (!q.assignedSlug) return false;
        var s = q.assignedSlug.replace(/^\//, '');
        if (coveredSlugs.has(s)) return false;
        var first = s.split('/')[0];
        var fuzzy = false;
        coveredSlugs.forEach(function(cs) { if (cs.split('/')[0] === first && first.length > 2) fuzzy = true; });
        return !fuzzy;
      }).length : 0;
      var suggCount = (S.kwResearch && S.kwResearch.sitemapSuggestions) ? S.kwResearch.sitemapSuggestions.length : 0;
      html += '<div style="margin-top:12px;padding:10px 14px;background:var(--bg);border-radius:6px;font-size:11px;color:var(--n2);border:1px solid var(--border);display:flex;gap:16px;flex-wrap:wrap">';
      if (hasClusters && gapCount > 0) {
        html += '<span style="color:var(--warn)"><i class="ti ti-alert-triangle"></i> <strong>' + gapCount + ' content gaps</strong> — questions with no page to answer them</span>';
      } else if (hasClusters) {
        html += '<span style="color:var(--green)"><i class="ti ti-circle-check-filled"></i> All questions are covered by existing or planned pages</span>';
      }
      if (suggCount > 0) {
        html += '<span style="color:var(--primary)"><i class="ti ti-file-plus"></i> <strong>' + suggCount + ' page' + (suggCount > 1 ? 's' : '') + '</strong> queued for Stage 5 Sitemap</span>';
      }
      html += '<span style="color:var(--n2)"><i class="ti ti-schema"></i> All questions feed FAQ schema in Stage 8</span>';
      html += '</div>';
    }
  }
  html += '</div>';
  return html;
}

var _paaQuestionCache = null;
function _getQuestionsArray() {
  // Primary: contentIntel PAA (from Research stage)
  if (S.contentIntel && S.contentIntel.paa && S.contentIntel.paa.questions && S.contentIntel.paa.questions.length) {
    return S.contentIntel.paa.questions.map(function(q) { return typeof q === 'object' ? (q.question || '') : q; }).filter(Boolean);
  }
  // Fallback: research.paa_questions
  if (S.research && S.research.paa_questions && S.research.paa_questions.length) {
    return S.research.paa_questions.map(function(q) { return typeof q === 'object' ? (q.question || '') : q; }).filter(Boolean);
  }
  // Fallback: research.brand.faqs
  if (S.research && S.research.brand && S.research.brand.faqs) {
    return S.research.brand.faqs.map(function(f) { return typeof f === 'object' ? (f.question || '') : f; }).filter(Boolean);
  }
  return [];
}

function _addQuestionAsSeed(i) {
  var qs = _getQuestionsArray();
  var q = qs[i];
  if (!q) return;
  if (!S.kwResearch) S.kwResearch = { seeds: [], keywords: [], selected: [], clusters: [] };
  if (!S.kwResearch.seeds) S.kwResearch.seeds = [];
  if (S.kwResearch.seeds.indexOf(q) === -1) {
    S.kwResearch.seeds.push(q);
    scheduleSave();
  }
  renderKwTabContent();
}

// Strips a question to its core keyword phrase for seed lookup.
// "how much does dental marketing cost in Sydney" → "dental marketing cost Sydney"
function _questionToSeedKeyword(q) {
  var s = (q || '').trim().toLowerCase()
    // Remove leading question words + connectors
    .replace(/^(how much does|how much is|how do i|how to|how do|how can|what is|what are|what does|what's|who is|who are|why does|why is|when do|where can|where do|which is|which are|can i|do i need|is there|is it|should i|will|does|do)\s+/i, '')
    // Remove filler at end
    .replace(/\s+(work|work\?|\?|near me)$/i, '')
    // Remove possessives and articles mid-phrase
    .replace(/(a |an |the |my |your |our |their |this |that |for a |for an |for the )/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Keep only if 2-7 words (seeds should be tight head terms)
  var words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 7) return null;
  return s;
}

function addAllQuestionsAsSeeds() {
  var qs = _getQuestionsArray();
  if (!qs.length) return;
  if (!S.kwResearch) S.kwResearch = { seeds: [], keywords: [], selected: [], clusters: [] };
  if (!S.kwResearch.seeds) S.kwResearch.seeds = [];
  if (!S.kwResearch.seedSources) S.kwResearch.seedSources = { mechanical: [], ai: [], competitor: [], questions: [] };
  if (!S.kwResearch.seedSources.questions) S.kwResearch.seedSources.questions = [];
  var qSet = new Set(S.kwResearch.seedSources.questions.map(function(s){ return s.toLowerCase(); }));
  var seedSet = new Set(S.kwResearch.seeds.map(function(s){ return s.toLowerCase(); }));
  var added = 0; var skipped = 0;
  qs.forEach(function(q) {
    var kw = _questionToSeedKeyword(q);
    if (!kw) { skipped++; return; }
    if (!seedSet.has(kw)) { S.kwResearch.seeds.push(kw); seedSet.add(kw); added++; }
    if (!qSet.has(kw)) { S.kwResearch.seedSources.questions.push(kw); qSet.add(kw); }
  });
  scheduleSave();
  renderKwTabContent();
  var msg = '✓ ' + added + ' keyword' + (added!==1?'s':'') + ' extracted from ' + qs.length + ' questions';
  if (skipped) msg += ' (' + skipped + ' too long, skipped)';
  if (typeof aiBarNotify==='function') aiBarNotify(msg, {meta:'Next: Fetch Volumes →', duration:5000});
}

async function fetchPAAFromKeywords() {
  var r = S.research || {};
  var setup = S.setup || {};
  var geo = (r.geography && r.geography.primary ? r.geography.primary : (setup.geo || '')).replace(/,.*$/, '').trim();
  var services = (r.primary_services || []).slice(0, 6).join(', ');
  var audience = (r.target_audience && r.target_audience.primary ? r.target_audience.primary : '') ||
                 (r.buyer_personas && r.buyer_personas[0] ? r.buyer_personas[0].role || '' : '');
  var painPoints = (r.pain_points || []).slice(0, 4).join('; ');
  var industry = setup.industry || '';

  var statusEl = document.getElementById('kw-questions-fetch-status');
  if (statusEl) statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;display:inline-block;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 0.6s linear infinite"></span> Generating questions with AI...';

  var systemPrompt = 'You are an SEO strategist. Generate buyer-intent questions that real business owners and marketing managers type into Google when evaluating or hiring a marketing agency. These should be bottom-of-funnel — evaluation, comparison, cost, and trust questions. Never generic educational questions about marketing theory. Return ONLY a JSON array of 20 question strings, no markdown, no explanation.';

  var userPrompt = 'Agency: ' + (setup.businessName || 'marketing agency') + '\n' +
    'Location: ' + (geo || 'Vancouver, BC') + '\n' +
    'Services: ' + (services || 'SEO, paid media, web design') + '\n' +
    'Target audience: ' + (audience || 'small to mid-size businesses') + '\n' +
    (painPoints ? 'Pain points they solve: ' + painPoints + '\n' : '') +
    (industry ? 'Industry focus: ' + industry + '\n' : '') +
    '\nGenerate 20 questions a business owner would Google when deciding whether to hire this agency or evaluating their options. Mix: cost questions, how-to-choose questions, what-to-expect questions, comparison questions, results/ROI questions, red flag questions. Make them specific to the services and location where relevant.';

  try {
    var res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    var data = await res.json();
    var raw = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text.trim() : '';
    raw = raw.replace(/```json|```/g, '').trim();
    var questions = JSON.parse(raw);
    if (!Array.isArray(questions) || !questions.length) throw new Error('Invalid response from AI');

    if (!S.contentIntel) S.contentIntel = { paa: null, gap: null, blogTopics: [] };
    S.contentIntel.paa = { questions: questions.map(function(q) { return { question: q }; }), fetchedAt: Date.now(), source: 'ai' };
    scheduleSave();
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)"><i class="ti ti-check"></i> ' + questions.length + ' buyer-intent questions generated</span>';
    renderKwTabContent();
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">Error: ' + esc(e.message) + '</span>';
  }
}
async function generateMoreQuestions() {
  var r = S.research || {};
  var setup = S.setup || {};
  var geo = (r.geography && r.geography.primary ? r.geography.primary : (setup.geo || '')).replace(/,.*$/, '').trim();
  var services = (r.primary_services || []).slice(0, 6).join(', ');
  var audience = (r.target_audience && r.target_audience.primary ? r.target_audience.primary : '') ||
                 (r.buyer_personas && r.buyer_personas[0] ? r.buyer_personas[0].role || '' : '');
  var industry = setup.industry || '';

  // Get existing questions to avoid duplicates
  var existingQs = _getQuestionsArray();

  var btn = document.getElementById('more-questions-btn');
  var statusEl = document.getElementById('kw-questions-fetch-status');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px;display:inline-block;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 0.6s linear infinite"></span> Generating...'; }
  if (statusEl) statusEl.innerHTML = '<span class="spinner" style="width:10px;height:10px;display:inline-block;border:2px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 0.6s linear infinite"></span> Generating additional questions...';

  var systemPrompt = 'You are an SEO strategist generating bottom-of-funnel buyer questions for a marketing agency website. These are questions a business owner types into Google when they are actively evaluating whether to hire an agency — not learning about marketing in general. Return ONLY a JSON array of question strings — no markdown, no explanation, no wrapper object.';

  var userPrompt = 'Agency: ' + (setup.businessName || 'marketing agency') + '\n' +
    'Location: ' + (geo || 'Vancouver, BC') + '\n' +
    'Services: ' + (services || 'SEO, paid media, web design') + '\n' +
    'Target audience: ' + (audience || 'small to mid-size businesses') + '\n' +
    (industry ? 'Industry focus: ' + industry + '\n' : '') +
    '\nExisting questions (DO NOT duplicate these):\n' + existingQs.slice(0, 40).map(function(q,i){return (i+1)+'. '+q;}).join('\n') +
    '\n\nGenerate 20 NEW bottom-of-funnel questions not yet covered above. These must be purchase-evaluation questions only — someone who has already decided they need marketing help and is now vetting agencies.\n\n' +
    'BOF question types to generate more of:\n' +
    '- Specific service pricing: "how much does seo cost for small business vancouver", "google ads management fees canada"\n' +
    '- ROI and proof: "what roi should i expect from seo", "how long before seo pays off"\n' +
    '- Risk and vetting: "how to know if a marketing agency is legit", "red flags when hiring seo company"\n' +
    '- Direct comparison: "seo agency vs doing seo myself", "retainer vs project based marketing agency"\n' +
    '- Local intent: "best ppc agency vancouver bc", "top rated marketing agencies vancouver"\n' +
    '- Category-specific buying: "how to choose social media agency for restaurant", "seo agency for construction companies vancouver"\n\n' +
    'NEVER generate: how marketing works, what is SEO, educational content, generic industry stats, anything a student would search.\n' +
    'All questions must be lowercase, conversational, specific to services and location where relevant. Return exactly 20 questions as a JSON array.';

  try {
    var res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    var data = await res.json();
    var raw = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text.trim() : '';
    raw = raw.replace(/```json|```/g, '').trim();
    var newQs = JSON.parse(raw);
    if (!Array.isArray(newQs) || !newQs.length) throw new Error('Invalid response from AI');

    // Dedupe against existing
    var existingSet = {};
    existingQs.forEach(function(q){ existingSet[q.toLowerCase()] = true; });
    var fresh = newQs.filter(function(q){ return !existingSet[q.toLowerCase()]; });

    if (!S.contentIntel) S.contentIntel = { paa: null, gap: null, blogTopics: [] };
    if (!S.contentIntel.paa) S.contentIntel.paa = { questions: [], fetchedAt: Date.now(), source: 'ai' };
    // Append new questions to existing list
    var existing = S.contentIntel.paa.questions || [];
    S.contentIntel.paa.questions = existing.concat(fresh.map(function(q){ return { question: q }; }));
    S.contentIntel.paa.fetchedAt = Date.now();
    scheduleSave();
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)"><i class="ti ti-check"></i> +' + fresh.length + ' questions added (' + (newQs.length - fresh.length) + ' dupes skipped)</span>';
    renderKwTabContent();
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">Error: ' + esc(e.message) + '</span>';
  } finally {
    var btn2 = document.getElementById('more-questions-btn');
    if (btn2) { btn2.disabled = false; btn2.innerHTML = '<i class="ti ti-plus"></i> More Questions'; }
  }
}

async function generateBlogSeedsFromQuestions() {
  var qs = _getQuestionsArray();
  if (!qs.length) { if(typeof aiBarNotify==='function') aiBarNotify('No questions found — run Research enrichment first.', {isError:true,duration:3000}); return; }
  var r = S.research || {};
  var setup = S.setup || {};
  var geo = (r.geography && r.geography.primary ? r.geography.primary : (setup.geo || '')).replace(/,.*$/, '').trim();

  var systemPrompt = 'You are an SEO strategist. Given a list of People Also Ask questions and client context, extract the keyword intent from each question and generate search-friendly seed keywords suitable for a DataForSEO volume lookup.\n\nRules:\n- Output ONLY a JSON array of strings, no markdown\n- Max 7 words per keyword, all lowercase\n- Convert questions to keyword form: "how to hire an seo agency" → "hire seo agency vancouver", "how to choose seo company"\n- Include geo where it makes sense for local searches\n- Include blog-intent variants: "seo agency guide", "choosing marketing agency tips"\n- Max 80 seeds, no duplicates\n- Skip questions that are too vague or too broad to be searchable';

  var userPrompt = 'CLIENT: ' + (setup.client || r.client_name || '') + '\nGEO: ' + geo + '\nSERVICES: ' + (r.primary_services || []).join(', ') + '\n\nQUESTIONS:\n' + qs.slice(0, 40).map(function(q, i) { return (i+1) + '. ' + q; }).join('\n');

  var statusEl = document.getElementById('kw-seeds-status');
  try {
    var result = await callClaude(systemPrompt, userPrompt, null, 1500);
    var parsed = safeParseJSON(result);
    if (!Array.isArray(parsed) || !parsed.length) throw new Error('No seeds returned');
    if (!S.kwResearch) S.kwResearch = { seeds: [], keywords: [], selected: [], clusters: [] };
    if (!S.kwResearch.seeds) S.kwResearch.seeds = [];
    var added = 0;
    parsed.forEach(function(k) {
      var kl = String(k).toLowerCase().trim();
      if (kl && kl.split(' ').length <= 7 && S.kwResearch.seeds.indexOf(kl) === -1) {
        S.kwResearch.seeds.push(kl); added++;
      }
    });
    scheduleSave();
    if(typeof aiBarNotify==='function') aiBarNotify('✓ ' + added + ' blog seeds added from Questions', {meta:'Go to Seeds → Fetch Volumes', duration:6000});
    _kwTab = 'seeds';
    renderKwTabContent();
  } catch(e) {
    if(typeof aiBarNotify==='function') aiBarNotify('Blog seeds error: ' + e.message, {isError:true,duration:5000});
  }
}




// ── NICHE KEYWORD EXPANSION ───────────────────────────────────────────────────
// Runs Google Suggest on each page's primary keyword → merges niche variants
// into S.kwResearch.keywords before AI Assign runs

async function runNicheExpand() {
  var btn = document.getElementById('niche-expand-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span> Expanding...'; }

  try {
    var pages = (S.pages || []).filter(function(p) {
      return p.page_type !== 'utility' && p.primary_keyword;
    });
    if (!pages.length) { if(typeof aiBarNotify==='function') aiBarNotify('No pages with keywords — build sitemap first.', {isError:true,duration:3000}); return; }

    var country = (S.kwResearch && S.kwResearch.country) || 'CA';
    var payload = {
      pages: pages.map(function(p) {
        return {
          slug: p.slug,
          primaryKeyword: p.primary_keyword,
          supportingKws: (p.supporting_keywords || []).map(function(k) { return typeof k === 'object' ? k.kw : k; })
        };
      }),
      country: country
    };

    if (btn) btn.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span> Fetching suggestions...';

    var res = await fetch('/api/niche-expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Expand failed');

    // Merge results into keyword pool
    if (!S.kwResearch) S.kwResearch = {};
    if (!S.kwResearch.keywords) S.kwResearch.keywords = [];

    var existingKws = new Set(S.kwResearch.keywords.map(function(k) { return (k.kw || '').toLowerCase(); }));
    var added = 0;

    data.results.forEach(function(pageResult) {
      (pageResult.keywords || []).forEach(function(k) {
        var kwLower = (k.kw || '').toLowerCase();
        if (!kwLower || existingKws.has(kwLower)) return;
        // Score: volume-based + niche source bonus
        var score = (k.vol || 0) * 0.5 + 20; // niche bonus — these are page-specific
        S.kwResearch.keywords.push({
          kw: k.kw, vol: k.vol, kd: k.kd,
          score: Math.round(score),
          source: 'niche:' + pageResult.slug
        });
        existingKws.add(kwLower);
        added++;
      });
    });

    scheduleSave();

    var msg = 'Added ' + added + ' niche keywords across ' + data.results.length + ' pages.';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check" style="color:var(--green)"></i> ' + added + ' keywords added'; }
    setTimeout(function() {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-antenna"></i> Expand Niche Keywords'; }
    }, 3000);

    // Re-render keyword tab if visible
    if (typeof renderKwTabContent === 'function') renderKwTabContent();

    console.log('[niche-expand]', msg);
  } catch(e) {
    console.error('[niche-expand]', e);
    if(typeof aiBarNotify==='function') aiBarNotify('Niche expand failed: ' + e.message, {isError:true,duration:5000});
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-antenna"></i> Expand Niche Keywords'; }
  }
}

// ── PAGE QUESTION GENERATION ──────────────────────────────────────────────────
// Claude generates 6 targeted FAQs per page → stored as p.pageQuestions[]
// These feed into AI Assign and then into Brief generation

async function runPageQuestions() {
  var btn = document.getElementById('page-questions-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span> Generating questions...'; }

  try {
    var pages = (S.pages || []).filter(function(p) {
      return p.page_type !== 'utility' && p.primary_keyword;
    });
    if (!pages.length) { if(typeof aiBarNotify==='function') aiBarNotify('No pages yet — build sitemap first.', {isError:true,duration:3000}); return; }

    var siteContext = '';
    if (S.research) {
      siteContext = (S.research.company_name || '') + ' — '
        + (S.research.primary_services || []).join(', ')
        + '. Location: ' + (S.research.location || '')
        + '. USP: ' + (S.research.usp || '');
    }

    var payload = {
      pages: pages.map(function(p) {
        return {
          slug: p.slug,
          pageType: p.page_type,
          primaryKeyword: p.primary_keyword,
          supportingKws: (p.supporting_keywords || []).map(function(k) { return typeof k === 'object' ? k.kw : k; }).slice(0, 5)
        };
      }),
      siteContext: siteContext
    };

    var res = await fetch('/api/page-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Page questions failed');

    // Store questions on each page
    var assigned = 0;
    data.results.forEach(function(r) {
      var pageIdx = (S.pages || []).findIndex(function(p) { return p.slug === r.slug; });
      if (pageIdx < 0 || !r.questions || !r.questions.length) return;
      S.pages[pageIdx].pageQuestions = r.questions;
      // Also auto-assign to assignedQuestions if not already there
      if (!S.pages[pageIdx].assignedQuestions) S.pages[pageIdx].assignedQuestions = [];
      r.questions.forEach(function(q) {
        if (!S.pages[pageIdx].assignedQuestions.includes(q)) {
          S.pages[pageIdx].assignedQuestions.push(q);
          assigned++;
        }
      });
    });

    scheduleSave();

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-check" style="color:var(--green)"></i> ' + assigned + ' questions assigned';
    }
    setTimeout(function() {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-message-question"></i> Generate Page Questions'; }
    }, 3000);

    // Re-render briefs if visible
    if (typeof renderBriefs === 'function') renderBriefs();

  } catch(e) {
    console.error('[page-questions]', e);
    if(typeof aiBarNotify==='function') aiBarNotify('Page questions failed: ' + e.message, {isError:true,duration:5000});
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-message-question"></i> Generate Page Questions'; }
  }
}

// ── STAGE 6: PAGE BRIEFS ────────────────────────────────────────────

// ── AI KEYWORD + QUESTION ASSIGNMENT (Stage 6 enrichment) ──────────
async function aiAssignKeywordsAndQuestions() {
  var btn = document.getElementById('ai-assign-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span> Assigning...'; }

  var pages = (S.pages||[]).filter(function(p){ return p.page_type !== 'utility'; });
  if (!pages.length) { if(typeof aiBarNotify==='function') aiBarNotify('No pages yet — build sitemap first.', {isError:true,duration:3000}); if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-sparkles"></i> AI Assign Keywords + Questions';} return; }

  // All unassigned / underused keywords
  var usedPrimaries = new Set(pages.map(function(p){ return (p.primary_keyword||'').toLowerCase().trim(); }));
  var allKws = (S.kwResearch&&S.kwResearch.keywords||[])
    .filter(function(k){ return k.vol >= 10 && !usedPrimaries.has((k.kw||'').toLowerCase().trim()); })
    .sort(function(a,b){ return (b.score||0)-(a.score||0); })
    .slice(0,120)
    .map(function(k){ return k.kw+'|'+k.vol+'/mo|KD:'+k.kd; });

  // All PAQ questions (global PAA + any already-generated page questions)
  var allQs = [];
  if (S.contentIntel && S.contentIntel.paa && S.contentIntel.paa.questions) {
    S.contentIntel.paa.questions.forEach(function(q){
      if (q.question) allQs.push(q.question);
    });
  }
  // Collect pageQuestions already assigned — AI Assign will skip re-assigning these
  var alreadyAssignedQs = new Set();
  pages.forEach(function(p) {
    (p.pageQuestions || []).forEach(function(q) { alreadyAssignedQs.add(q); });
    (p.assignedQuestions || []).forEach(function(q) { alreadyAssignedQs.add(q); });
  });
  // Only include unassigned global PAA questions in the pool
  allQs = allQs.filter(function(q) { return !alreadyAssignedQs.has(q); });

  // Page list for prompt
  var pageList = pages.map(function(p,i){
    var pqLine = (p.pageQuestions && p.pageQuestions.length)
      ? ' | page_questions_assigned:' + p.pageQuestions.length
      : '';
    var nicheKws = (S.kwResearch && S.kwResearch.keywords || [])
      .filter(function(k){ return (k.source||'').includes(p.slug); })
      .slice(0, 8).map(function(k){ return k.kw; }).join(', ');
    var nicheLine = nicheKws ? ' | niche_kws:' + nicheKws : '';
    return (i+1)+'. /'+p.slug+' | '+p.page_type+' | primary: '+(p.primary_keyword||'none')+' | '+(p.action||'build_new')+pqLine+nicheLine;
  }).join('\n');

  var prompt = '## PAGES\n'+pageList+'\n\n'
    + '## UNASSIGNED KEYWORDS (format: keyword|vol|KD)\n'+(allKws.join('\n')||'none')+'\n\n'
    + '## AVAILABLE QUESTIONS (People Also Ask)\n'+(allQs.map(function(q,i){return (i+1)+'. '+q;}).join('\n')||'none')+'\n\n'
    + '## TASK\n'
    + 'For each page, assign:\n'
    + '1. additional_keywords — secondary/LSI keywords from the list that belong on this page (3-8 per page, exact strings from the list above)\n'
    + '2. assigned_questions — 3-5 questions from the PAQ list this page should answer (pick based on search intent match)\n\n'
    + 'Rules:\n'
    + '- Each keyword assigned to max 1 page\n'
    + '- Each question assigned to max 1 page (put it where it fits best)\n'
    + '- Match intent: service pages get commercial questions, blog pages get informational questions\n'
    + '- Homepage gets brand/category questions only\n'
    + '- Contact/About get trust/objection questions\n'
    + '- Do not repeat primary keywords as additional_keywords\n\n'
    + 'Return JSON array only:\n'
    + '[{"slug":"services/seo-vancouver","additional_keywords":["seo company bc","..."],"assigned_questions":["How long does SEO take?","..."]},...]';

  var R2 = S.research || {};
  var ctxForAssign = 'Client: '+(R2.client_name||'')
    + ' | Industry: '+(R2.industry||'')
    + ' | Services: '+((R2.primary_services||[]).join(', ')||'')
    + ' | Audience: '+(R2.primary_audience_description||'')
    + ' | Geography: '+((R2.geography&&R2.geography.primary)||R2.target_geography||'');
  var systemPrompt = 'You are a senior SEO content strategist. '
    + 'Assign keywords and questions to pages with precision. '
    + 'Each keyword and question goes on exactly one page — the page where it best matches search intent. '
    + 'Client context: '+ctxForAssign+'. '
    + 'Return raw JSON array only — no markdown, no preamble.';

  try {
    var streamEl = document.getElementById('briefs-assign-stream');
    if (!streamEl) {
      streamEl = document.createElement('div');
      streamEl.id = 'briefs-assign-stream';
      streamEl.style.cssText = 'margin-bottom:12px;padding:10px 14px;background:#0d1117;border-radius:6px;font-family:monospace;font-size:10px;color:#7ee787;max-height:120px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block';
      var resultsEl = document.getElementById('briefs-results');
      if (resultsEl && resultsEl.parentNode) resultsEl.parentNode.insertBefore(streamEl, resultsEl);
    }
    streamEl.style.display = 'block';
    streamEl.textContent = 'Assigning...';

    var result = await callClaude(systemPrompt, prompt,
      function(t){ streamEl.textContent = t.slice(-200); },
      4000
    );

    // Parse
    function fixTrailing(s){ return s.replace(/,\s*([\]\}])/g,'$1'); }
    var parsed = null;
    try { parsed = JSON.parse(fixTrailing(result.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim())); } catch(e){}
    if (!parsed) {
      var s=result.indexOf('['),e=result.lastIndexOf(']');
      if(s>=0&&e>s) try { parsed=JSON.parse(fixTrailing(result.slice(s,e+1))); } catch(e2){}
    }
    if (!parsed || !Array.isArray(parsed)) {
      streamEl.textContent = 'Parse error — try again';
      if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-sparkles"></i> AI Assign Keywords + Questions';}
      return;
    }

    // Apply assignments to S.pages
    parsed.forEach(function(assignment) {
      var slug = (assignment.slug||'').replace(/^\//,'');
      var page = S.pages.find(function(p){ return _normSlug(p.slug) === slug; });
      if (!page) return;
      if (assignment.additional_keywords && assignment.additional_keywords.length) {
        // Merge with existing supporting_keywords, dedupe
        var existing = new Set((page.supporting_keywords||[]).map(function(k){return k.toLowerCase();}));
        assignment.additional_keywords.forEach(function(k){
          if (!existing.has(k.toLowerCase())) {
            if (!page.supporting_keywords) page.supporting_keywords = [];
            page.supporting_keywords.push(k);
          }
        });
      }
      if (assignment.assigned_questions && assignment.assigned_questions.length) {
        if (!page.assignedQuestions) page.assignedQuestions = [];
        assignment.assigned_questions.forEach(function(q){
          if (!page.assignedQuestions.includes(q)) page.assignedQuestions.push(q);
        });
      }
    });

    S.kwResearch = S.kwResearch || {};
    S.kwResearch.aiAssignedAt = Date.now();
    scheduleSave();
    streamEl.style.display = 'none';
    renderBriefs();
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-check"></i> Reassign';}

  } catch(e) {
    var streamEl2 = document.getElementById('briefs-assign-stream');
    if(streamEl2) streamEl2.textContent = 'Error: '+e.message;
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-sparkles"></i> AI Assign Keywords + Questions';}
  }
}


// ── BRIEF MULTI-SELECT PICKER ────────────────────────────────────────

async function openKwFinder(pageIdx) {
  const page = S.pages[pageIdx];
  if (!page) return;

  const btn    = document.getElementById('kw-finder-btn-' + pageIdx);
  const status = document.getElementById('kw-finder-status-' + pageIdx);
  const panel  = document.getElementById('kw-finder-panel-' + pageIdx);

  // Toggle: if panel is already open, collapse it
  if (panel.style.display !== 'none') {
    panel.style.display = 'none';
    btn.innerHTML = '<i class="ti ti-sparkles" style="font-size:9px"></i> Find Keywords';
    return;
  }

  // If we have cached results, just re-show — no fetch
  if (page._kwCache) {
    panel.style.display = 'block';
    btn.innerHTML = '<i class="ti ti-sparkles" style="font-size:9px"></i> Find Keywords';
    _renderKwFinderPanel(pageIdx, page._kwCache.keywords, page._kwCache.aiResult);
    return;
  }

  // ── First open: fetch + run AI ──
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:8px;height:8px;display:inline-block;vertical-align:middle"></span> Fetching…';
  if (status) status.textContent = '';
  panel.style.display = 'block';
  panel.innerHTML = '<div style="padding:10px 16px;font-size:10.5px;color:var(--n2)">Fetching keyword ideas…</div>';

  // Build seeds (geo-stripped)
  const geo      = (S.research?.geography?.primary || S.setup?.geo || '').replace(/,.*$/, '').trim();
  const geoLower = geo.toLowerCase();
  const stripGeo = kw => {
    if (!geoLower) return kw;
    return kw.toLowerCase()
      .replace(new RegExp('\\s+' + geoLower.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*$', 'i'), '')
      .replace(new RegExp('^' + geoLower.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s+', 'i'), '')
      .trim();
  };

  const currentPrimary    = page.primary_keyword || '';
  const currentSupporting = (page.supporting_keywords || []).map(sk => typeof sk === 'object' ? sk.kw : sk).filter(Boolean);
  const pageName          = (page.page_name || '').toLowerCase().replace(/\s+(services?|management|agency|solutions?|page)$/i, '').trim();

  const _genericPageNames = new Set(['home','homepage','about','contact','services','blog','news','faq','team','portfolio','gallery','privacy','terms','sitemap','404','utility']);
  const seedSet = new Set();
  [currentPrimary, ...currentSupporting].filter(Boolean).forEach(kw => {
    const base = stripGeo(kw);
    if (base.length > 3) seedSet.add(base);
  });
  // Only add page name as seed if it's not generic and has no primary keyword yet
  if (pageName.length > 3 && !_genericPageNames.has(pageName.toLowerCase()) && !currentPrimary) {
    seedSet.add(pageName);
    if (geoLower) seedSet.add(pageName + ' ' + geoLower);
  }
  // If still no seeds, fall back to industry from research
  if (seedSet.size === 0) {
    const _ind = (S.research?.primary_services||[]).slice(0,2).join(' ');
    if (_ind) { seedSet.add(_ind); if (geoLower) seedSet.add(_ind + ' ' + geoLower); }
  }
  const seeds = [...seedSet].filter(k => k.length > 3).slice(0, 12);

  const geoStr  = (geo + ' ' + geoLower).toLowerCase();
  const country = (geoStr.includes('canada') || geoStr.includes('bc') || geoStr.includes('vancouver') || geoStr.includes('calgary') || geoStr.includes('toronto') || geoStr.includes('alberta')) ? 'CA' : 'US';

  let keywords = [];
  try {
    const expandRes  = await fetch('/api/kw-expand', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ seeds, country }) });
    const expandData = await expandRes.json();

    if (expandData.keywords && expandData.keywords.length) {
      const seen = new Set();
      keywords = expandData.keywords
        .filter(k => k.volume >= 10)
        .map(k => {
          const kd    = k.difficulty > 0 ? k.difficulty : 50;
          const score = k.volume >= 50 ? Math.round((Math.log(k.volume + 1) * 100 / Math.max(kd, 5)) * 10) / 10 : 0;
          return { kw: k.keyword, vol: k.volume, kd: k.difficulty, score };
        })
        .sort((a, b) => b.score - a.score)
        .filter(k => { if (seen.has(k.kw)) return false; seen.add(k.kw); return true; })
        .slice(0, 60);
    }
  } catch(err) {
    panel.innerHTML = '<div style="padding:10px 16px;font-size:10.5px;color:var(--error)">⚠ ' + err.message + '</div>';
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-sparkles" style="font-size:9px"></i> Find Keywords';
    return;
  }

  if (!keywords.length) {
    panel.innerHTML = '<div style="padding:10px 16px;font-size:10.5px;color:var(--warn)">⚠ No keywords found for these seeds.</div>';
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-sparkles" style="font-size:9px"></i> Find Keywords';
    return;
  }

  // ── Run AI in parallel (non-blocking) ──
  panel.innerHTML = '<div style="padding:10px 16px;font-size:10.5px;color:var(--n2)"><span class="spinner" style="width:8px;height:8px;display:inline-block;vertical-align:middle;margin-right:5px"></span>Asking AI for picks…</div>';
  btn.innerHTML = '<span class="spinner" style="width:8px;height:8px;display:inline-block;vertical-align:middle"></span> Analysing…';

  const kwList = keywords.slice(0, 60).map(k => `${k.kw} (vol:${k.vol}, kd:${k.kd}, score:${k.score})`).join('\n');
  const currentKws = [currentPrimary, ...currentSupporting].filter(Boolean).join(', ');

  const aiSystem = `You are an SEO keyword strategist. Given a page brief and keyword list, recommend the best primary keyword and up to 5 supporting keywords.\n\nRULES:\n- primary_keyword MUST be an exact string from the list\n- supporting_keywords MUST be exact strings from the list\n- Match intent to page type: home→brand/agency, service→service+city, location→city+service, about→brand/trust, blog→informational\n- Prioritise: correct intent first, then highest score\n- Output raw JSON only. No markdown, no backticks.\n\nFormat: {"primary_keyword":"...","primary_vol":0,"primary_kd":0,"primary_score":0,"supporting_keywords":[{"kw":"...","vol":0,"kd":0}],"rationale":"1-2 sentences"}`;

  const aiUser = `PAGE:\nName: ${page.page_name}\nType: ${page.page_type || 'service'}\nSlug: /${page.slug}\nCurrent primary: ${currentPrimary || 'none'}\nCurrent supporting: ${currentKws || 'none'}\n\nKEYWORD LIST:\n${kwList}\n\nRecommend primary + up to 5 supporting keywords.`;

  let aiResult = null;
  try {
    let raw = '';
    await callClaude(aiSystem, aiUser, chunk => { raw += chunk; });
    const stripped = raw.replace(/```json\s*/gi,'').replace(/```/g,'');
    const candidates = [];
    for (let si = 0; si < stripped.length; si++) {
      if (stripped[si] !== '{') continue;
      let depth = 0;
      for (let ei = si; ei < stripped.length; ei++) {
        if (stripped[ei] === '{') depth++;
        else if (stripped[ei] === '}') { depth--; if (depth === 0) { candidates.push(stripped.slice(si, ei+1)); break; } }
      }
    }
    candidates.sort((a,b) => b.length - a.length);
    for (const c of candidates) {
      try { aiResult = JSON.parse(c); if (aiResult.primary_keyword) break; } catch(e) {}
    }
  } catch(aiErr) {
    console.warn('[openKwFinder] AI failed:', aiErr.message);
  }

  // Cache so re-open is instant
  page._kwCache = { keywords, aiResult };
  scheduleSave();

  _renderKwFinderPanel(pageIdx, keywords, aiResult);

  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-sparkles" style="font-size:9px"></i> Find Keywords';
}

function _renderKwFinderPanel(pageIdx, keywords, aiResult) {
  const page  = S.pages[pageIdx];
  const panel = document.getElementById('kw-finder-panel-' + pageIdx);
  if (!page || !panel) return;

  const geo    = (S.research?.geography?.primary || S.setup?.geo || '').replace(/,.*$/, '').trim();
  const kdCol  = d => d===0?'var(--n2)':d<=20?'var(--green)':d<=40?'var(--warn)':'var(--error)';
  const vCol   = v => v===0?'var(--n2)':v<50?'var(--warn)':'var(--n3)';
  const scoreFn = (v,d) => v>0&&d>0 ? Math.round((Math.log(v+1)*100/d)*10)/10 : 0;
  const currentPrimary = (page.primary_keyword || '').toLowerCase();
  const currentSupporting = new Set((page.supporting_keywords || []).map(sk => (typeof sk==='object'?sk.kw:sk).toLowerCase()));

  let html = '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;margin:0 14px 8px;overflow:hidden">';

  // ── Header ──
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--border)">';
  html += `<div style="font-size:10.5px;font-weight:500;color:var(--dark)">Keywords for ${esc(page.page_name)}</div>`;
  html += `<div style="display:flex;align-items:center;gap:8px">`;
  html += `<button onclick="delete S.pages[${pageIdx}]._kwCache;openKwFinder(${pageIdx})" title="Refresh" style="background:transparent;border:none;cursor:pointer;color:var(--n2);font-size:12px;padding:0 2px"><i class="ti ti-refresh" style="font-size:11px"></i></button>`;
  html += `<button onclick="document.getElementById('kw-finder-panel-${pageIdx}').style.display='none'" style="background:transparent;border:none;cursor:pointer;color:var(--n2);font-size:14px;line-height:1;padding:0 2px">✕</button>`;
  html += '</div></div>';

  // ── AI Picks section (if available) ──
  if (aiResult && aiResult.primary_keyword) {
    const pScore = aiResult.primary_score || scoreFn(aiResult.primary_vol||0, aiResult.primary_kd||0);
    html += '<div style="padding:9px 12px;border-bottom:1px solid var(--border);background:rgba(21,142,29,0.03)">';
    html += '<div style="font-size:9.5px;color:var(--green);font-weight:500;text-transform:uppercase;letter-spacing:.05em;margin-bottom:7px;display:flex;align-items:center;gap:4px"><i class="ti ti-sparkles" style="font-size:9px"></i> AI Picks</div>';

    // Primary row
    html += '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;flex-wrap:wrap">';
    html += `<span style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.04em;min-width:56px">Primary</span>`;
    html += `<span style="font-size:12px;color:var(--dark);font-weight:500">${esc(aiResult.primary_keyword)}</span>${intentBadge(aiResult.primary_keyword, geo)}`;
    html += `<span style="font-size:10px;color:${vCol(aiResult.primary_vol||0)}">${(aiResult.primary_vol||0).toLocaleString()}/mo</span>`;
    html += `<span style="font-size:10px;color:${kdCol(aiResult.primary_kd||0)}">KD ${aiResult.primary_kd||'?'}</span>`;
    const alreadyPrimary = currentPrimary === (aiResult.primary_keyword||'').toLowerCase();
    if (alreadyPrimary) {
      html += `<span style="font-size:10px;color:var(--green)">✓ current</span>`;
    } else {
      html += `<button onclick="acceptPrimaryKw(${pageIdx},'${(aiResult.primary_keyword||'').replace(/'/g,'')}',${aiResult.primary_vol||0},${aiResult.primary_kd||0},${pScore})" style="background:var(--green);color:white;border:none;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:var(--font)">Use this</button>`;
    }
    html += '</div>';

    // Supporting rows
    if (aiResult.supporting_keywords?.length) {
      html += '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:3px">';
      html += `<span style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.04em;min-width:56px">Supporting</span>`;
      html += '</div>';
      aiResult.supporting_keywords.forEach(sk => {
        const added = currentSupporting.has((sk.kw||'').toLowerCase()) || currentPrimary === (sk.kw||'').toLowerCase();
        html += `<div style="display:flex;align-items:center;gap:7px;margin-bottom:3px;flex-wrap:wrap;padding-left:64px">`;
        html += `<span style="font-size:11px;color:${added?'var(--n2)':'var(--n3)'}">${esc(sk.kw)}</span>${intentBadge(sk.kw, geo)}`;
        html += `<span style="font-size:10px;color:${vCol(sk.vol||0)}">${(sk.vol||0).toLocaleString()}/mo</span>`;
        html += `<span style="font-size:10px;color:${kdCol(sk.kd||0)}">KD ${sk.kd||'?'}</span>`;
        if (added) {
          html += `<span style="font-size:10px;color:var(--green)">✓</span>`;
        } else {
          html += `<button data-add-kw="${(sk.kw||'').replace(/"/g,'')}" data-page="${pageIdx}" onclick="addSuggestedKw(${pageIdx},'${(sk.kw||'').replace(/'/g,'')}',${sk.vol||0},${sk.kd||0},this)" style="background:transparent;border:1px solid var(--green);color:var(--green);border-radius:4px;padding:1px 6px;font-size:10px;cursor:pointer;font-family:var(--font)">+ Add</button>`;
        }
        html += '</div>';
      });
    }

    if (aiResult.rationale) {
      html += `<div style="font-size:10px;color:var(--n2);font-style:italic;margin-top:4px;padding-top:5px;border-top:1px solid rgba(0,0,0,0.05)">${esc(aiResult.rationale)}</div>`;
    }

    // Accept All
    html += `<div style="margin-top:7px"><button onclick="acceptAllSuggestions(${pageIdx})" style="background:var(--green);color:white;border:none;border-radius:4px;padding:3px 10px;font-size:10.5px;cursor:pointer;font-family:var(--font)">Accept All AI Picks</button></div>`;
    html += '</div>';

    // Store for acceptAllSuggestions
    S.pages[pageIdx]._suggestion = aiResult;
  }

  // ── Full keyword list ──
  html += '<div style="max-height:280px;overflow-y:auto;padding:4px 0">';
  html += '<div style="padding:5px 12px 3px;font-size:9.5px;color:var(--n2);text-transform:uppercase;letter-spacing:.05em;font-weight:500">All Keywords ('+keywords.length+')</div>';
  keywords.forEach(k => {
    const added = currentSupporting.has(k.kw.toLowerCase().trim()) || currentPrimary === k.kw.toLowerCase().trim();
    html += `<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;border-bottom:1px dashed rgba(0,0,0,0.05)">`;
    html += `<div style="flex:1;display:flex;align-items:center;gap:5px"><span style="font-size:11px;color:${added?'var(--n2)':'var(--dark)'}">${esc(k.kw)}</span>${intentBadge(k.kw, geo)}</div>`;
    html += `<span style="font-size:10px;color:${vCol(k.vol)};min-width:52px;text-align:right">${k.vol.toLocaleString()}/mo</span>`;
    html += `<span style="font-size:10px;color:${kdCol(k.kd)};min-width:34px;text-align:right">KD ${k.kd||'?'}</span>`;
    html += `<span style="font-size:10px;color:var(--n2);min-width:36px;text-align:right">${k.score}</span>`;
    if (added) {
      html += `<span style="min-width:38px;text-align:center;font-size:10px;color:var(--green)" id="kw-add-${pageIdx}-${k.kw.replace(/[^a-z0-9]/g,'-')}">✓</span>`;
    } else {
      html += `<button data-add-kw="${k.kw.replace(/"/g,'')}" data-page="${pageIdx}" id="kw-add-${pageIdx}-${k.kw.replace(/[^a-z0-9]/g,'-')}" onclick="addSuggestedKw(${pageIdx},'${k.kw.replace(/'/g,'')}',${k.vol},${k.kd},this)" style="background:transparent;border:1px solid var(--border);color:var(--n2);border-radius:3px;padding:1px 7px;font-size:10px;cursor:pointer;font-family:var(--font);min-width:38px">+ Add</button>`;
    }
    html += '</div>';
  });
  html += '</div>';
  html += '</div>'; // end panel

  panel.innerHTML = html;
  panel.style.display = 'block';
}


function acceptPrimaryKw(pageIdx, kw, vol, kd, score) {
  if (!S.pages[pageIdx]) return;
  S.pages[pageIdx].primary_keyword = kw;
  S.pages[pageIdx].primary_vol = vol;
  S.pages[pageIdx].primary_kd = kd;
  S.pages[pageIdx].score = score;
  scheduleSave();
  renderSitemapResults(S.sitemapApproved);
}

function addSuggestedKw(pageIdx, kw, vol, kd, btn) {
  const page = S.pages[pageIdx];
  if (!page) return;
  const existing = (page.supporting_keywords||[]).map(sk=>(typeof sk==='object'?sk.kw:sk).toLowerCase());
  if (existing.includes(kw.toLowerCase()) || (page.primary_keyword||'').toLowerCase()===kw.toLowerCase()) return;
  if (!page.supporting_keywords) page.supporting_keywords = [];
  page.supporting_keywords.push({ kw, vol, kd });
  scheduleSave();
  // Mark button in-place — no full re-render so Find More / AI panels stay open
  if (btn) {
    btn.textContent = '✓';
    btn.disabled = true;
    btn.style.color = 'var(--green)';
    btn.style.borderColor = 'var(--green)';
  }
  // Also update any other button for same kw across both panels
  document.querySelectorAll('[data-add-kw="'+kw.replace(/"/g,'')+'"][data-page="'+pageIdx+'"]').forEach(el => {
    el.textContent = '✓'; el.disabled = true;
    el.style.color = 'var(--green)'; el.style.borderColor = 'var(--green)';
  });
}

function acceptAllSuggestions(pageIdx) {
  const page = S.pages[pageIdx];
  const sug = page?._suggestion;
  if (!sug) return;
  if (sug.primary_keyword) {
    page.primary_keyword = sug.primary_keyword;
    page.primary_vol = sug.primary_vol || 0;
    page.primary_kd = sug.primary_kd || 0;
    const sc = sug.primary_score || (page.primary_vol>0&&page.primary_kd>0 ? Math.round((Math.log(page.primary_vol+1)*100/page.primary_kd)*10)/10 : 0);
    page.score = sc;
  }
  const existing = new Set((page.supporting_keywords||[]).map(sk=>(typeof sk==='object'?sk.kw:sk).toLowerCase()));
  (sug.supporting_keywords||[]).forEach(sk => {
    if (!existing.has((sk.kw||'').toLowerCase())) {
      if (!page.supporting_keywords) page.supporting_keywords = [];
      page.supporting_keywords.push({ kw: sk.kw, vol: sk.vol||0, kd: sk.kd||0 });
    }
  });
  scheduleSave();
  renderSitemapResults(S.sitemapApproved); // full re-render only on Accept All
}

async function addManualKeyword(pageIdx, rawKw) {
  const kw = rawKw.trim().toLowerCase();
  if (!kw) return;
  const page = S.pages[pageIdx];
  if (!page) return;

  // Check if it's already there
  const existing = (page.supporting_keywords || []).map(sk => (typeof sk === 'object' ? sk.kw : sk).toLowerCase());
  if (existing.includes(kw) || (page.primary_keyword||'').toLowerCase() === kw) return;

  // Look up from kwResearch cache first
  const cached = (S.kwResearch?.keywords || []).find(k => k.kw.toLowerCase() === kw);
  if (cached) {
    if (!page.supporting_keywords) page.supporting_keywords = [];
    page.supporting_keywords.push({ kw: cached.kw, vol: cached.vol, kd: cached.kd });
    scheduleSave();
    renderSitemapResults(S.sitemapApproved);
    return;
  }

  // Live lookup for unknown keyword
  const geo = S.research?.geography?.primary || S.setup?.geo || '';
  const country = geo.toLowerCase().includes('canada')||geo.toLowerCase().includes('bc')||geo.toLowerCase().includes('vancouver') ? 'CA' : 'US';
  try {
    const res = await fetch('/api/ahrefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: [kw], country })
    });
    const data = await res.json();
    const hit = data.keywords?.find(k => k.keyword.toLowerCase() === kw);
    if (!page.supporting_keywords) page.supporting_keywords = [];
    if (hit) {
      page.supporting_keywords.push({ kw: hit.keyword, vol: hit.volume || 0, kd: hit.difficulty || 0 });
    } else {
      page.supporting_keywords.push({ kw, vol: 0, kd: 0 });
    }
  } catch(e) {
    if (!page.supporting_keywords) page.supporting_keywords = [];
    page.supporting_keywords.push({ kw, vol: 0, kd: 0 });
  }
  scheduleSave();
  renderSitemapResults(S.sitemapApproved);
}

function removeKeyword(pageIdx, kw) {
  const page = S.pages[pageIdx];
  if (!page?.supporting_keywords) return;
  page.supporting_keywords = page.supporting_keywords.filter(sk => {
    const k = typeof sk === 'object' ? sk.kw : sk;
    return k.toLowerCase() !== kw.toLowerCase();
  });
  scheduleSave();
  renderSitemapResults(S.sitemapApproved);
}

