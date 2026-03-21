// ══════════════════════════════════════════════════════════════════════
// strategy.js — Strategy Engine (Stage 4)
// Research gathers facts. Strategy makes decisions.
// ══════════════════════════════════════════════════════════════════════

// ── Pricing Engine Integration ────────────────────────────────────────

var _pricingCatalog = null; // cached pricing catalog from Pricing Engine KV
var _pricingStatus = 'unknown'; // 'live' | 'estimated' | 'error' | 'unknown'
var _outputView = 'strategy'; // 'strategy' | 'sales' — toggles Output tab view

// Maps strategy lever IDs → Pricing Engine service slugs
// Maps AI diagnostic lever IDs → Pricing Engine service slugs.
// PPC (google-ads) covers all paid channels: Google, Meta, LinkedIn, Display, Remarketing.
// CRO is not a standalone service — it is embedded within other services.
var LEVER_SERVICE_MAP = {
  google_ads_search: 'google-ads',
  google_display:    'google-ads',
  meta_ads:          'google-ads',
  seo:               'seo',
  website:           'website',
  email:             'email-marketing',
  remarketing:       'google-ads',
  social_media:      'social-media',
  video:             'video-production',
  content_marketing: 'seo',
  branding:          'branding',
  local_seo:         'seo'
};

async function fetchPricingCatalog() {
  try {
    var res = await fetch('/api/pricing-catalog');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    // Worker wraps as { ok, catalog } — catalog may also be direct if structure changes
    var cat = data.catalog || (data.services ? data : null);
    if (cat && cat.services && cat.services.length) {
      _pricingCatalog = cat;
      _pricingStatus = 'live';
      console.log('[pricing] Catalog loaded: ' + cat.services.length + ' services');
      return _pricingCatalog;
    }
    _pricingStatus = 'estimated';
    console.warn('[pricing] Catalog empty — using estimates');
    return null;
  } catch (err) {
    _pricingStatus = 'error';
    console.error('[pricing] Failed to load catalog:', err.message);
    return null;
  }
}

function lookupServicePricing(leverKey) {
  if (!_pricingCatalog || !_pricingCatalog.services) return null;
  var slug = LEVER_SERVICE_MAP[leverKey];
  if (!slug) return null;
  return _pricingCatalog.services.find(function(s) {
    var sSlug = (s.id || s.slug || s.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return sSlug === slug || sSlug.indexOf(slug) >= 0;
  }) || null;
}

function getServiceMonthlyCost(service) {
  if (!service || !service.pricing) return null;
  var p = service.pricing;
  // Nested monthly object (pricing.monthly.min / pricing.monthly.max)
  if (p.monthly && typeof p.monthly === 'object' && p.monthly.min) {
    return { min: p.monthly.min, max: p.monthly.max || p.monthly.min, mid: Math.round(((p.monthly.min || 0) + (p.monthly.max || p.monthly.min || 0)) / 2) };
  }
  // Tier-based pricing (e.g. social media: Visible/Known/Trusted, SEO: Growth/Authority/Dominance/Enterprise)
  if (p.tiers && p.tiers.length) {
    var sorted = p.tiers.slice().sort(function(a, b) { return (a.monthly || a.price || 0) - (b.monthly || b.price || 0); });
    var tMin = sorted[0].monthly || sorted[0].price || 0;
    var tMax = sorted[sorted.length - 1].monthly || sorted[sorted.length - 1].price || 0;
    var tMid = sorted.length >= 2 ? (sorted[Math.floor(sorted.length / 2)].monthly || sorted[Math.floor(sorted.length / 2)].price || Math.round((tMin + tMax) / 2)) : Math.round((tMin + tMax) / 2);
    return { min: tMin, max: tMax, mid: tMid, tiers: sorted };
  }
  // Flat monthly fields (legacy)
  var min = p.monthlyMin || p.monthly_min || p.min || 0;
  var max = p.monthlyMax || p.monthly_max || p.max || 0;
  if (min && max) return { min: min, max: max, mid: Math.round((min + max) / 2) };
  // Nested project range (pricing.projectRange.min / .max)
  if (p.projectRange && p.projectRange.min) {
    return { min: p.projectRange.min, max: p.projectRange.max || p.projectRange.min, mid: Math.round(((p.projectRange.min || 0) + (p.projectRange.max || p.projectRange.min || 0)) / 2), isProject: true };
  }
  // Flat project fields (legacy)
  if (p.projectMin || p.project_min) {
    var pMin = p.projectMin || p.project_min || 0;
    var pMax = p.projectMax || p.project_max || 0;
    return { min: pMin, max: pMax, mid: Math.round((pMin + pMax) / 2), isProject: true };
  }
  // Single price field
  if (p.price) return { min: p.price, max: p.price, mid: p.price };
  return null;
}

function getPackageFit(monthlyBudget) {
  if (!_pricingCatalog || !_pricingCatalog.packages || !monthlyBudget) return null;
  var budget = parseFloat(String(monthlyBudget).replace(/[^0-9.]/g, ''));
  if (!budget || budget <= 0) return null;
  var fit = null;
  _pricingCatalog.packages.forEach(function(pkg) {
    var min = pkg.priceMin || pkg.price_min || pkg.min || 0;
    var max = pkg.priceMax || pkg.price_max || pkg.max || 0;
    if (budget >= min && budget <= max) fit = pkg;
  });
  // If above all tiers
  if (!fit && budget > 0) {
    var highest = _pricingCatalog.packages[_pricingCatalog.packages.length - 1];
    var hMax = highest.priceMax || highest.price_max || highest.max || 0;
    if (budget > hMax) return { tier: 'custom', label: 'Custom (above Scale)', budget: budget };
    // Below all tiers
    var lowest = _pricingCatalog.packages[0];
    var lMin = lowest.priceMin || lowest.price_min || lowest.min || 0;
    if (budget < lMin) return { tier: 'below_minimum', label: 'Below minimum engagement', budget: budget, minimum: lMin };
  }
  if (fit) return { tier: (fit.id || fit.name || '').toLowerCase().replace(/\s+/g, '_'), label: fit.name || fit.id, budget: budget, pkg: fit };
  return null;
}

// ── Keyword context injection for diagnostic prompts ──────────────────────
// Generates keyword research context for D4/D5/D6 when data exists.
// mode: 'channels' (D4), 'website' (D5), 'content' (D6)
function _kwContextBlock(mode) {
  var kwR = S.kwResearch || {};
  var kws = kwR.keywords || [];
  var clusters = kwR.clusters || [];
  var questions = (typeof _getQuestionsArray === 'function') ? _getQuestionsArray() : [];
  if (kws.length < 5 && clusters.length === 0) return '';

  var qualifiedClusters = clusters.filter(function(c) { return c.qualifies !== false; });
  var totalVol = 0;
  qualifiedClusters.forEach(function(c) { totalVol += (c.primaryVol || 0); });

  // Cluster breakdown by page type
  var byType = {};
  qualifiedClusters.forEach(function(c) {
    var t = c.pageType || 'other';
    if (!byType[t]) byType[t] = 0;
    byType[t]++;
  });
  var typeStr = Object.keys(byType).map(function(t) { return t + ': ' + byType[t]; }).join(', ');

  // Quick wins: high volume, low difficulty
  var quickWins = kws.filter(function(k) { return k.vol >= 100 && k.kd <= 20; });

  var block = '\n\nKEYWORD RESEARCH DATA (' + kws.length + ' keywords, ' + qualifiedClusters.length + ' qualified clusters):\n';
  block += '- Total addressable monthly volume: ' + totalVol.toLocaleString() + '\n';
  block += '- Clusters by page type: ' + (typeStr || 'none') + '\n';
  block += '- Quick wins (vol>=100, KD<=20): ' + quickWins.length + '\n';

  if (mode === 'channels') {
    // D4: top clusters + CPC landscape for budget allocation
    block += '- Top clusters by volume:\n';
    qualifiedClusters.slice().sort(function(a,b) { return (b.primaryVol||0) - (a.primaryVol||0); }).slice(0, 10).forEach(function(c) {
      block += '  · "' + (c.primaryKw || c.name) + '" — ' + (c.primaryVol||0).toLocaleString() + '/mo, KD:' + (c.primaryKd||'?') + ' [' + (c.pageType||'?') + ']\n';
    });
    // Organic demand summary for channel allocation decisions
    var avgKd = kws.length ? Math.round(kws.reduce(function(s,k){return s+(k.kd||0);},0)/kws.length) : 0;
    block += '- Avg keyword difficulty: ' + avgKd + '/100\n';
    block += '- IMPLICATION: Use this keyword data to validate organic SEO as a channel — if avg KD is low and volume is high, organic is a strong lever. If avg KD is very high, paid may be more realistic.\n';
  }

  if (mode === 'website') {
    // D5: page architecture from clusters + questions for FAQ/form strategy
    block += '- Recommended page architecture from clusters:\n';
    Object.keys(byType).forEach(function(t) {
      var typeClust = qualifiedClusters.filter(function(c) { return (c.pageType||'other') === t; });
      block += '  · ' + t + ' pages (' + typeClust.length + '): ';
      block += typeClust.slice(0, 5).map(function(c) { return '/' + (c.suggestedSlug || c.existingSlug || c.primaryKw); }).join(', ');
      if (typeClust.length > 5) block += ' +' + (typeClust.length - 5) + ' more';
      block += '\n';
    });
    var buildNew = qualifiedClusters.filter(function(c) { return c.recommendation === 'build_new'; });
    var improveExisting = qualifiedClusters.filter(function(c) { return c.recommendation === 'improve_existing'; });
    block += '- New pages to build: ' + buildNew.length + ', Existing to improve: ' + improveExisting.length + '\n';
    if (questions.length) {
      block += '- Top buyer questions (' + questions.length + ' total):\n';
      questions.slice(0, 10).forEach(function(q) { block += '  · ' + q + '\n'; });
      block += '- IMPLICATION: Use these questions for FAQ sections, form pre-qualification, and content planning.\n';
    }
  }

  if (mode === 'content') {
    // D6: content pillars from clusters + questions for topic generation
    block += '- Keyword clusters for content pillar mapping:\n';
    qualifiedClusters.slice(0, 15).forEach(function(c) {
      block += '  · "' + (c.primaryKw || c.name) + '" [' + (c.pageType||'?') + '] — ' + (c.primaryVol||0).toLocaleString() + '/mo, KD:' + (c.primaryKd||'?');
      if (c.supportingKws && c.supportingKws.length) block += ' + ' + c.supportingKws.length + ' supporting';
      block += '\n';
    });
    if (questions.length) {
      block += '- Buyer-intent questions for content topics (' + questions.length + ' total):\n';
      questions.slice(0, 15).forEach(function(q) { block += '  · ' + q + '\n'; });
    }
    if (quickWins.length) {
      block += '- Quick-win keywords (blog/content targets):\n';
      quickWins.slice(0, 8).forEach(function(k) {
        block += '  · "' + k.kw + '" — ' + (k.vol||0).toLocaleString() + '/mo, KD:' + (k.kd||0) + '\n';
      });
    }
    block += '- IMPLICATION: Use actual cluster data to define content pillars rather than guessing. Each content pillar should map to one or more keyword clusters. Quick wins are immediate blog opportunities.\n';
  }

  return block;
}

function buildPricingContextBlock() {
  if (!_pricingCatalog || _pricingStatus !== 'live') return '';
  var block = '\n\nSERVICE PRICING (from internal pricing engine — real costs in CAD):\n';
  (_pricingCatalog.services || []).forEach(function(svc) {
    var cost = getServiceMonthlyCost(svc);
    if (!cost) return;
    var name = svc.name || svc.service || svc.id || '';
    if (cost.isProject) {
      block += '- ' + name + ': $' + cost.min.toLocaleString() + ' - $' + cost.max.toLocaleString() + ' (project)\n';
    } else {
      block += '- ' + name + ': $' + cost.min.toLocaleString() + ' - $' + cost.max.toLocaleString() + '/month\n';
    }
    if (svc.marginTarget) block += '  Margin target: ' + svc.marginTarget + '%\n';
  });
  if (_pricingCatalog.packages && _pricingCatalog.packages.length) {
    block += '\nPACKAGE TIERS:\n';
    _pricingCatalog.packages.forEach(function(pkg) {
      var min = pkg.priceMin || pkg.price_min || pkg.min || 0;
      var max = pkg.priceMax || pkg.price_max || pkg.max || 0;
      block += '- ' + (pkg.name || pkg.id) + ': $' + min.toLocaleString() + ' - $' + max.toLocaleString() + '/month\n';
    });
  }
  if (_pricingCatalog.strategy && _pricingCatalog.strategy.pricing) {
    var sp = _pricingCatalog.strategy.pricing;
    block += '\nSTRATEGY DIAGNOSTIC: $' + (sp.price || 750) + ' CAD';
    if (sp.credit) block += ' (credited toward first invoice within ' + (sp.creditWindow || 30) + ' days)';
    block += '\n';
  }
  if (_pricingCatalog.tracking) {
    var tr = _pricingCatalog.tracking;
    var trCost = tr.pricing || tr;
    var trMin = trCost.projectMin || trCost.project_min || trCost.min || 1500;
    var trMax = trCost.projectMax || trCost.project_max || trCost.max || 4000;
    block += 'ANALYTICS SETUP: $' + trMin.toLocaleString() + ' - $' + trMax.toLocaleString() + ' (one-time)\n';
  }
  block += '\nIMPORTANT: Use these REAL service costs in your calculations instead of estimates. When recommending a service, reference its actual pricing range. Match budget tiers to package tiers.\n';
  return block;
}

function capturePricingSnapshot() {
  if (!S.strategy) return;
  var budget = parseFloat(String((S.research || {}).monthly_marketing_budget || '0').replace(/[^0-9.]/g, ''));
  var pkgFit = getPackageFit(budget);
  var monthlyRec = 0;
  if (S.strategy.channel_strategy && S.strategy.channel_strategy.levers) {
    S.strategy.channel_strategy.levers.forEach(function(lev) {
      var svc = lookupServicePricing(lev.lever);
      if (svc) {
        var cost = getServiceMonthlyCost(svc);
        if (cost && !cost.isProject) monthlyRec += cost.mid;
      }
    });
  }
  S.strategy.pricing_snapshot = {
    source: _pricingStatus,
    catalog: _pricingCatalog,
    captured_at: new Date().toISOString(),
    package_fit: pkgFit ? pkgFit.tier : 'unknown',
    monthly_recommended: monthlyRec,
    monthly_client_budget: budget || 0,
    gap: monthlyRec > budget ? monthlyRec - budget : 0
  };
}

// ── Strategy Document Export ────────────────────────────────────────

function _buildFullStrategyDoc() {
  var client = (S.setup && S.setup.client) || 'Client';
  var doc = '# ' + client + ' \u2014 Growth Strategy\n\n' + (S.strategy.compiled_output || '');
  if (S.strategy.webStrategy && S.strategy.webStrategy.trim()) {
    doc += '\n\n---\n\n# Website Strategy Brief\n\n' + S.strategy.webStrategy;
  }
  return doc;
}

function copyStrategyDoc() {
  if (!S.strategy || !S.strategy.compiled_output) return;
  copyToClip2(_buildFullStrategyDoc());
  aiBarNotify('Strategy + web brief copied to clipboard', { duration: 2000 });
}

function downloadStrategyDoc() {
  if (!S.strategy || !S.strategy.compiled_output) return;
  var client = (S.setup && S.setup.client) || 'Client';
  var content = _buildFullStrategyDoc();
  var blob = new Blob([content], { type: 'text/markdown' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = client.toLowerCase().replace(/\s+/g, '-') + '-growth-strategy.md';
  a.click();
  URL.revokeObjectURL(url);
  aiBarNotify('Strategy document downloaded', { duration: 2000 });
}

// ── Output View Toggle ──────────────────────────────────────────────

function switchOutputView(view) {
  _outputView = view;
  renderStrategyTabContent();
}

// ── Proposal Builder ────────────────────────────────────────────────

function buildProposalText() {
  var r = S.research || {};
  var st = S.strategy || {};
  var si = st.sales_intel || {};
  var nar = st.narrative || {};
  var setup = S.setup || {};
  var clientName = r.client_name || setup.client || 'Client';
  var date = new Date().toLocaleDateString('en-CA', { year:'numeric', month:'long', day:'numeric' });

  var md = '# ' + clientName + ' \u2014 Growth Proposal\n';
  md += '*Prepared by Setsail Marketing | ' + date + '*\n\n';

  // Executive Summary — pull from D9 pitch + StoryBrand + D8 narrative
  md += '## Executive Summary\n\n';
  if (si.pitch_angle) md += '**' + si.pitch_angle + '**\n\n';
  if (si.sales_storybrand && si.sales_storybrand.hero) {
    md += si.sales_storybrand.hero + ' ';
    if (si.sales_storybrand.external_problem) md += si.sales_storybrand.external_problem + ' ';
    if (si.sales_storybrand.success_transformation) md += '\n\n**Our goal:** ' + si.sales_storybrand.success_transformation;
    md += '\n\n';
  }
  // Pull from D8 narrative as enrichment
  if (nar.storybrand && nar.storybrand.hero && !si.sales_storybrand) {
    md += '*Your target customer:* ' + nar.storybrand.hero + '\n\n';
  }

  // The Challenge — from D9 StoryBrand problems + D8 client narrative
  var hasChallenge = (si.sales_storybrand && (si.sales_storybrand.internal_problem || si.sales_storybrand.philosophical_problem)) || (nar.storybrand && nar.storybrand.external_problem);
  if (hasChallenge) {
    md += '## The Challenge\n\n';
    if (si.sales_storybrand) {
      if (si.sales_storybrand.internal_problem) md += si.sales_storybrand.internal_problem + '\n\n';
      if (si.sales_storybrand.philosophical_problem) md += '*' + si.sales_storybrand.philosophical_problem + '*\n\n';
    }
    // D8 context: what their customers face (shows we understand their market)
    if (nar.storybrand && nar.storybrand.external_problem) {
      md += '**What your customers are telling us:** ' + nar.storybrand.external_problem + '\n\n';
    }
  }

  // Why Now — urgency triggers from D9
  if (si.why_now) {
    md += '## Why Now\n\n';
    md += si.why_now + '\n\n';
  }

  // Situation Analysis — metrics + economics
  md += '## Situation Analysis\n\n';
  var snap = S.snapshot || {};
  var dm = snap.domainMetrics || {};
  if (dm.dr) md += '- **Domain Rating:** ' + dm.dr + '\n';
  if (dm.orgTraffic) md += '- **Monthly Organic Traffic:** ' + Number(dm.orgTraffic).toLocaleString() + '\n';
  if (dm.liveRefdomains) md += '- **Referring Domains:** ' + Number(dm.liveRefdomains).toLocaleString() + '\n';
  if (r.monthly_marketing_budget) md += '- **Current Marketing Budget:** ' + r.monthly_marketing_budget + '\n';
  if (st.unit_economics) {
    if (st.unit_economics.cpl) md += '- **Current CPL:** $' + st.unit_economics.cpl + '\n';
    if (st.unit_economics.cac) md += '- **Current CAC:** $' + st.unit_economics.cac + '\n';
    if (st.unit_economics.ltv) md += '- **Customer LTV:** $' + st.unit_economics.ltv + '\n';
    if (st.unit_economics.ltv_cac_ratio) md += '- **LTV:CAC Ratio:** ' + st.unit_economics.ltv_cac_ratio + 'x\n';
  }
  if (st.demand_validation && st.demand_validation.total_monthly_volume) {
    md += '- **Total Addressable Search Volume:** ' + Number(st.demand_validation.total_monthly_volume).toLocaleString() + '/mo\n';
  }
  // Competitor context
  if (dm.competitors && dm.competitors.length) {
    md += '\n**Competitive Landscape:**\n';
    dm.competitors.slice(0, 5).forEach(function(c) {
      md += '- ' + (c.domain || c.url || '') + (c.dr ? ' (DR ' + c.dr + ')' : '') + '\n';
    });
  }
  md += '\n';

  // Audience & Positioning — from D0 + D2
  if (st.audience && st.audience.segments && st.audience.segments.length) {
    md += '## Target Audience\n\n';
    st.audience.segments.slice(0, 4).forEach(function(seg) {
      md += '- **' + (seg.segment_name || '') + ':** ' + (seg.description || seg.segment_name || '') + '\n';
    });
    md += '\n';
  }

  // Messaging direction — from D8 pillars (what resonates with THEIR customers)
  if (nar.messaging_pillars && nar.messaging_pillars.length) {
    md += '## Messaging Direction\n\n';
    md += 'Based on our analysis, these are the key messages that will resonate with your target audience:\n\n';
    nar.messaging_pillars.slice(0, 3).forEach(function(p, i) {
      md += (i + 1) + '. **' + (p.pillar || '') + '**\n';
      if (p.evidence && p.evidence.length) {
        p.evidence.slice(0, 2).forEach(function(e) { md += '   - ' + e + '\n'; });
      }
    });
    md += '\n';
  }

  // Recommended Approach — phased from Gantt
  md += '## Recommended Approach\n\n';
  var ganttItems = typeof _buildGanttItems === 'function' ? _buildGanttItems(st) : [];
  if (ganttItems.length) {
    var phases = {};
    ganttItems.forEach(function(item) {
      var p = item.phase || 0;
      if (!phases[p]) phases[p] = [];
      phases[p].push(item);
    });
    Object.keys(phases).sort().forEach(function(p) {
      md += '**Phase ' + (parseInt(p) + 1) + ':**\n';
      phases[p].forEach(function(item) {
        var costLabel = '';
        if (item.cost_monthly) costLabel = ' \u2014 $' + Number(item.cost_monthly).toLocaleString() + '/mo';
        else if (item.cost_project) costLabel = ' \u2014 $' + Number(item.cost_project).toLocaleString();
        md += '- ' + item.label + (item.duration ? ' (' + item.duration + ')' : '') + costLabel + '\n';
      });
      md += '\n';
    });
  }

  // Investment Summary
  md += '## Investment Summary\n\n';
  var investText = typeof buildInvestmentText === 'function' ? buildInvestmentText() : '';
  if (investText) {
    md += investText.replace(/^#[^\n]*\n/, '').replace(/^\*[^\n]*\n/, '') + '\n';
  }

  // Why Setsail — from D9 + case studies + certs
  md += '## Why Setsail\n\n';
  if (si.why_setsail) md += si.why_setsail + '\n\n';
  // D9 guide authority
  if (si.sales_storybrand && si.sales_storybrand.guide_authority) {
    md += '**Our Credentials:** ' + si.sales_storybrand.guide_authority + '\n\n';
  }
  if (r.case_studies && r.case_studies.length) {
    md += '**Relevant Results:**\n';
    r.case_studies.slice(0, 5).forEach(function(cs) {
      md += '- **' + (cs.client || '') + ':** ' + (cs.result || '') + (cs.timeframe ? ' (' + cs.timeframe + ')' : '') + '\n';
    });
    md += '\n';
  }
  if (r.awards_certifications && r.awards_certifications.length) {
    md += '**Certifications:** ' + r.awards_certifications.join(', ') + '\n\n';
  }

  // Success Vision — what 12 months looks like
  if (si.sales_storybrand && si.sales_storybrand.success_transformation) {
    md += '## What Success Looks Like\n\n';
    md += si.sales_storybrand.success_transformation + '\n\n';
    if (si.sales_storybrand.failure_stakes) {
      md += '*Without action:* ' + si.sales_storybrand.failure_stakes + '\n\n';
    }
  }

  // Next Steps — from D9 plan + CTAs
  if (si.sales_storybrand && si.sales_storybrand.plan && si.sales_storybrand.plan.length) {
    md += '## Next Steps\n\n';
    si.sales_storybrand.plan.forEach(function(step, i) {
      md += (i + 1) + '. ' + step + '\n';
    });
    md += '\n';
  }

  // Terms
  md += '## Terms\n\n';
  md += '- 50/50 payment structure (50% up front, 50% on completion) for project-based work\n';
  md += '- Monthly services: month-to-month after initial 3-month commitment\n';
  md += '- All support, hosting, and maintenance included in monthly subscription\n';
  md += '- Fixed pricing \u2014 no scope creep, no surprise invoices\n';

  return md;
}

function copyProposal() {
  var text = buildProposalText();
  if (!text) return;
  copyToClip2(text);
  aiBarNotify('Proposal copied to clipboard', { duration: 2000 });
}

function downloadProposal() {
  var text = buildProposalText();
  if (!text) return;
  var client = (S.setup && S.setup.client) || 'Client';
  var blob = new Blob([text], { type: 'text/markdown' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = client.toLowerCase().replace(/\s+/g, '-') + '-growth-proposal.md';
  a.click();
  URL.revokeObjectURL(url);
  aiBarNotify('Proposal downloaded', { duration: 2000 });
}

// ── Investment Summary Export ────────────────────────────────────────

function buildInvestmentText() {
  if (!_pricingCatalog || !S.strategy) return '';
  var client = (S.setup && S.setup.client) || 'Client';
  var date = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  var scope = S.strategy.engagement_scope;
  var budget = parseFloat(String((S.research || {}).monthly_marketing_budget || '0').replace(/[^0-9.]/g, ''));
  var pkgFit = getPackageFit(budget);

  // Extract one-time base costs
  var diagCost = 0;
  if (_pricingCatalog.strategy && _pricingCatalog.strategy.pricing) diagCost = _pricingCatalog.strategy.pricing.price || 750;
  var trackMin = 0, trackMax = 0;
  if (_pricingCatalog.tracking) {
    var tr = _pricingCatalog.tracking.pricing || _pricingCatalog.tracking;
    trackMin = tr.projectMin || tr.project_min || tr.min || 1500;
    trackMax = tr.projectMax || tr.project_max || tr.max || 4000;
  }

  // If engagement_scope exists, use dual-column format
  if (scope && scope.services && Object.keys(scope.services).length) {
    _recalcScopeTotals();
    var t = scope.totals || {};
    var txt = '# Investment Summary \u2014 ' + client + '\n';
    txt += 'Prepared by Setsail Marketing | ' + date + '\n\n';

    // Monthly services dual-column
    var allSvcs = [];
    Object.keys(scope.services).forEach(function(k) { allSvcs.push(scope.services[k]); });
    Object.keys(scope.additional_services || {}).forEach(function(k) { if (scope.additional_services[k].enabled) allSvcs.push(scope.additional_services[k]); });
    var monthlySvcs = allSvcs.filter(function(s) { return s.cost && !s.cost.isProject && s.enabled; });
    var projectSvcs = allSvcs.filter(function(s) { return s.cost && s.cost.isProject && s.enabled; });

    if (monthlySvcs.length) {
      txt += '## Monthly Recurring Services\n\n';
      txt += '| Service | Suggested | Realistic | Est. ROI |\n';
      txt += '|---------|-----------|-----------|----------|\n';
      monthlySvcs.forEach(function(s) {
        var sugCost = _scopeEffectiveCost(s);
        var rScope = s.scope;
        var rEnabled = true;
        if (s.realistic_override) {
          if (s.realistic_override.enabled === false) rEnabled = false;
          if (s.realistic_override.scope) rScope = s.realistic_override.scope;
        }
        var _rS = Object.assign({}, s, { scope: rScope });
        var realTxt = rEnabled ? '$' + _scopeEffectiveCost(_rS).toLocaleString() + '/mo' : '\u2014 (cut)';
        var roiTxt = s.roi && s.roi.multiplier > 0 ? s.roi.multiplier + 'x (' + s.roi.timeline + ')' : '\u2014';
        txt += '| ' + s.name + ' | $' + sugCost.toLocaleString() + '/mo (' + s.scope + ') | ' + realTxt + ' | ' + roiTxt + ' |\n';
      });
      txt += '\n**Suggested Monthly: $' + t.suggested_monthly.toLocaleString() + '/mo** | **Realistic: $' + t.realistic_monthly.toLocaleString() + '/mo**\n\n';
    }

    // One-time
    txt += '## One-Time Setup\n\n';
    txt += '- Growth Diagnostic: $' + diagCost.toLocaleString() + ' (credited toward first invoice within 30 days)\n';
    if (trackMin) txt += '- Analytics Setup: $' + trackMin.toLocaleString() + ' \u2013 $' + trackMax.toLocaleString() + '\n';
    projectSvcs.forEach(function(s) {
      txt += '- ' + s.name + ': $' + s.cost.min.toLocaleString() + ' \u2013 $' + s.cost.max.toLocaleString() + '\n';
    });
    txt += '\n**One-Time Total: $' + t.suggested_project.toLocaleString() + '**\n\n';

    // Year 1 projection
    txt += '## Year 1 Projection\n\n';
    txt += '| | Suggested | Realistic |\n';
    txt += '|---|-----------|----------|\n';
    txt += '| Monthly x 12 | $' + (t.suggested_monthly * 12).toLocaleString() + ' | $' + (t.realistic_monthly * 12).toLocaleString() + ' |\n';
    txt += '| One-Time | $' + t.suggested_project.toLocaleString() + ' | $' + t.realistic_project.toLocaleString() + ' |\n';
    txt += '| **Year 1 Total** | **$' + t.year1_suggested.toLocaleString() + '** | **$' + t.year1_realistic.toLocaleString() + '** |\n\n';

    // Scope notes
    var notes = allSvcs.filter(function(s) { return s.enabled && s.scope_note; });
    if (notes.length) {
      txt += '## Scope Notes\n\n';
      notes.forEach(function(s) { txt += '- **' + s.name + ':** ' + s.scope_note + '\n'; });
      txt += '\n';
    }

    // Package + budget
    if (pkgFit && pkgFit.label) {
      txt += '## Recommended Package: ' + pkgFit.label;
      if (pkgFit.pkg) {
        var pMin = pkgFit.pkg.priceMin || pkgFit.pkg.price_min || pkgFit.pkg.min || 0;
        var pMax = pkgFit.pkg.priceMax || pkgFit.pkg.price_max || pkgFit.pkg.max || 0;
        txt += ' ($' + pMin.toLocaleString() + ' \u2013 $' + pMax.toLocaleString() + '/mo)';
      }
      txt += '\n\n';
    }
    if (budget > 0) {
      txt += '## Budget Alignment\n\n';
      txt += '- Client stated budget: $' + budget.toLocaleString() + '/mo\n';
      txt += '- Suggested monthly: $' + t.suggested_monthly.toLocaleString() + '/mo\n';
      txt += '- Realistic monthly: $' + t.realistic_monthly.toLocaleString() + '/mo\n';
      var gap = t.suggested_monthly - budget;
      if (gap > 0) {
        txt += '- **Gap: $' + gap.toLocaleString() + '/mo.** Realistic scope has been adjusted to fit.\n';
      } else {
        txt += '- **Plan fits within budget.**\n';
      }
    }
    return txt;
  }

  // Fallback: old lever-based behaviour (no engagement_scope)
  var st = S.strategy;
  var levers = (st.channel_strategy && st.channel_strategy.levers) || [];
  if (!levers.length) return '';
  var monthlyServices = [];
  var projectServices = [];
  var totalMonthly = 0;
  var totalProject = 0;
  levers.forEach(function(lev) {
    var svc = lookupServicePricing(lev.lever);
    if (!svc) return;
    var cost = getServiceMonthlyCost(svc);
    if (!cost) return;
    var entry = { name: svc.name || svc.service || lev.lever, min: cost.min, max: cost.max, mid: cost.mid };
    if (cost.isProject) { projectServices.push(entry); totalProject += cost.mid; }
    else { monthlyServices.push(entry); totalMonthly += cost.mid; }
  });
  var trackMid = Math.round((trackMin + trackMax) / 2);
  totalProject += trackMid + diagCost;
  var yearTotal = (totalMonthly * 12) + totalProject;

  var txt = '# Investment Summary \u2014 ' + client + '\n';
  txt += 'Prepared by Setsail Marketing | ' + date + '\n\n';
  if (monthlyServices.length) {
    txt += '## Monthly Recurring Services\n\n| Service | Range (CAD/mo) |\n|---------|---------------|\n';
    monthlyServices.forEach(function(s) { txt += '| ' + s.name + ' | $' + s.min.toLocaleString() + ' \u2013 $' + s.max.toLocaleString() + ' |\n'; });
    txt += '\n**Monthly Total (midpoint): $' + totalMonthly.toLocaleString() + '/mo**\n\n';
  }
  txt += '## One-Time Setup\n\n- Growth Diagnostic: $' + diagCost.toLocaleString() + ' (credited toward first invoice within 30 days)\n';
  if (trackMin) txt += '- Analytics Setup: $' + trackMin.toLocaleString() + ' \u2013 $' + trackMax.toLocaleString() + '\n';
  projectServices.forEach(function(s) { txt += '- ' + s.name + ': $' + s.min.toLocaleString() + ' \u2013 $' + s.max.toLocaleString() + '\n'; });
  txt += '\n**One-Time Total (midpoint): $' + totalProject.toLocaleString() + '**\n\n';
  txt += '## Year 1 Projection\n\n- Monthly services: $' + totalMonthly.toLocaleString() + ' x 12 = $' + (totalMonthly * 12).toLocaleString() + '\n';
  txt += '- One-time setup: $' + totalProject.toLocaleString() + '\n- **Estimated Year 1 Investment: $' + yearTotal.toLocaleString() + ' CAD**\n\n';
  if (pkgFit && pkgFit.label) {
    txt += '## Recommended Package: ' + pkgFit.label;
    if (pkgFit.pkg) { var pMin = pkgFit.pkg.priceMin || pkgFit.pkg.price_min || pkgFit.pkg.min || 0; var pMax = pkgFit.pkg.priceMax || pkgFit.pkg.price_max || pkgFit.pkg.max || 0; txt += ' ($' + pMin.toLocaleString() + ' \u2013 $' + pMax.toLocaleString() + '/mo)'; }
    txt += '\n\n';
  }
  if (budget > 0) {
    txt += '## Budget Alignment\n\n- Client stated budget: $' + budget.toLocaleString() + '/mo\n- Recommended monthly: $' + totalMonthly.toLocaleString() + '/mo\n';
    var gap = totalMonthly - budget;
    if (gap > 0) txt += '- **Gap: $' + gap.toLocaleString() + '/mo over budget.**\n';
    else txt += '- **Plan fits within budget** (surplus: $' + Math.abs(gap).toLocaleString() + '/mo)\n';
  }
  return txt;
}

function copyInvestmentSummary() {
  var txt = buildInvestmentText();
  if (!txt) { aiBarNotify('No investment data available', { isError: true, duration: 2000 }); return; }
  copyToClip2(txt);
  aiBarNotify('Investment summary copied to clipboard', { duration: 2000 });
}

function downloadInvestmentSummary() {
  var txt = buildInvestmentText();
  if (!txt) { aiBarNotify('No investment data available', { isError: true, duration: 2000 }); return; }
  var client = (S.setup && S.setup.client) || 'Client';
  var blob = new Blob([txt], { type: 'text/markdown' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = client.toLowerCase().replace(/\s+/g, '-') + '-investment-summary.md';
  a.click();
  URL.revokeObjectURL(url);
  aiBarNotify('Investment summary downloaded', { duration: 2000 });
}

// ── Recalculate Investment ──────────────────────────────────────────

async function recalculateInvestment() {
  aiBarStart('Recalculating investment');
  await fetchPricingCatalog();
  _buildEngagementScope();
  capturePricingSnapshot();
  await saveProject();
  renderStrategyTabContent();
  aiBarEnd('Investment recalculated from live pricing');
}

// ── Margin Analysis Modal ───────────────────────────────────────────

function _buildMarginTable() {
  if (!_pricingCatalog || !S.strategy || !S.strategy.channel_strategy || !S.strategy.channel_strategy.levers) return '';
  var levers = S.strategy.channel_strategy.levers;
  var totalRevenue = 0;
  var totalProfit = 0;
  var rows = [];
  var warnings = [];
  levers.forEach(function(lev) {
    var svc = lookupServicePricing(lev.lever);
    if (!svc) return;
    var cost = getServiceMonthlyCost(svc);
    if (!cost || cost.isProject) return;
    var margin = svc.marginTarget || (_pricingCatalog.marginTargets ? _pricingCatalog.marginTargets.default : 75) || 75;
    var revenue = cost.mid;
    var profit = Math.round(revenue * (margin / 100));
    totalRevenue += revenue;
    totalProfit += profit;
    rows.push({ lever: lev.lever, revenue: revenue, margin: margin, profit: profit, svcName: svc.name || svc.service || lev.lever });
    if (margin < 70) warnings.push(lev.lever + ' (' + margin + '% margin)');
  });
  if (!rows.length) return '';
  var overallMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
  var html = '<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:5px 8px;font-weight:500;color:var(--n2)">Service</th>'
    + '<th style="padding:5px 8px;font-weight:500;color:var(--n2);text-align:right">Revenue/mo</th>'
    + '<th style="padding:5px 8px;font-weight:500;color:var(--n2);text-align:right">Margin</th>'
    + '<th style="padding:5px 8px;font-weight:500;color:var(--n2);text-align:right">Gross Profit</th></tr>';
  rows.forEach(function(r) {
    var mColour = r.margin < 70 ? '#f56c6c' : r.margin < 75 ? '#e6a23c' : 'var(--green)';
    html += '<tr style="border-bottom:1px solid var(--border)">';
    html += '<td style="padding:5px 8px">' + esc(r.svcName) + '</td>';
    html += '<td style="padding:5px 8px;text-align:right">$' + r.revenue.toLocaleString() + '</td>';
    html += '<td style="padding:5px 8px;text-align:right;color:' + mColour + ';font-weight:600">' + r.margin + '%</td>';
    html += '<td style="padding:5px 8px;text-align:right;font-weight:600">$' + r.profit.toLocaleString() + '</td>';
    html += '</tr>';
  });
  html += '<tr style="font-weight:700;border-top:2px solid var(--border)"><td style="padding:5px 8px">Total Engagement</td>'
    + '<td style="padding:5px 8px;text-align:right">$' + totalRevenue.toLocaleString() + '</td>'
    + '<td style="padding:5px 8px;text-align:right;color:' + (overallMargin >= 75 ? 'var(--green)' : '#e6a23c') + '">' + overallMargin + '%</td>'
    + '<td style="padding:5px 8px;text-align:right">$' + totalProfit.toLocaleString() + '</td></tr>';
  html += '</table>';
  if (warnings.length) {
    html += '<div style="margin-top:8px;padding:6px 10px;border-radius:5px;background:#fef0f0;border:1px solid #f56c6c30;font-size:10px;color:#f56c6c">'
      + '<strong>Low margin warning:</strong> ' + warnings.join(', ') + '</div>';
  }
  return html;
}

function showMarginModal() {
  var table = _buildMarginTable();
  if (!table) { aiBarNotify('No margin data available', { isError: true, duration: 2000 }); return; }
  // Backdrop
  var backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:600;display:flex;align-items:flex-start;justify-content:center;padding-top:80px';
  // Modal
  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--white);border-radius:12px;padding:24px;max-width:640px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2)';
  // Header
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px';
  var title = document.createElement('div');
  title.style.cssText = 'display:flex;align-items:center;gap:8px';
  title.innerHTML = '<i class="ti ti-lock" style="color:#f56c6c;font-size:16px"></i>'
    + '<span style="font-size:13px;font-weight:600;color:var(--dark)">Margin Analysis</span>'
    + '<span style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#f56c6c;font-weight:600;padding:2px 6px;border-radius:3px;background:#fef0f0">Internal Only</span>';
  var closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-ghost sm';
  closeBtn.innerHTML = '<i class="ti ti-x"></i>';
  closeBtn.onclick = function() { document.body.removeChild(backdrop); document.removeEventListener('keydown', escHandler); };
  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);
  // Body
  var body = document.createElement('div');
  body.innerHTML = table;
  modal.appendChild(body);
  backdrop.appendChild(modal);
  backdrop.onclick = function(e) { if (e.target === backdrop) { document.body.removeChild(backdrop); document.removeEventListener('keydown', escHandler); } };
  document.body.appendChild(backdrop);
  // Escape key
  function escHandler(e) { if (e.key === 'Escape') { document.body.removeChild(backdrop); document.removeEventListener('keydown', escHandler); } }
  document.addEventListener('keydown', escHandler);
}

function _renderPricingIndicator() {
  var colour = _pricingStatus === 'live' ? 'var(--green)' : _pricingStatus === 'estimated' ? '#e6a23c' : '#f56c6c';
  var label = _pricingStatus === 'live' ? 'Live' : _pricingStatus === 'estimated' ? 'Estimated' : 'Unavailable';
  var icon = _pricingStatus === 'live' ? 'ti-plug-connected' : 'ti-plug-connected-x';
  return '<span id="pricing-indicator" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:500;color:' + colour + ';padding:2px 8px;border-radius:10px;border:1px solid ' + colour + '30;background:' + colour + '08">'
    + '<i class="ti ' + icon + '" style="font-size:11px"></i> Pricing: ' + label + '</span>';
}

function _renderMarginAnalysis() {
  if (!_pricingCatalog || !S.strategy || !S.strategy.channel_strategy || !S.strategy.channel_strategy.levers) return '';
  var table = _buildMarginTable();
  if (!table) return '';
  return '<div style="margin-bottom:14px"><button class="btn btn-ghost sm" onclick="showMarginModal()" style="color:#f56c6c;border-color:#f56c6c30;font-size:10px">'
    + '<i class="ti ti-lock" style="font-size:12px"></i> View Internal Margins</button></div>';
}

function _renderInvestmentSummary() {
  if (!_pricingCatalog || !S.strategy) return '';
  var scope = S.strategy.engagement_scope;
  var budget = parseFloat(String((S.research || {}).monthly_marketing_budget || '0').replace(/[^0-9.]/g, ''));
  var pkgFit = getPackageFit(budget);

  var html = '<div style="margin-bottom:18px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">'
    + '<span style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em">Investment Summary ' + _renderPricingIndicator() + '</span>'
    + '<span style="display:flex;gap:4px">'
    + '<button class="btn btn-ghost sm" onclick="copyInvestmentSummary()" style="font-size:10px;padding:2px 6px" data-tip="Copy investment summary to clipboard"><i class="ti ti-copy" style="font-size:11px"></i></button>'
    + '<button class="btn btn-ghost sm" onclick="downloadInvestmentSummary()" style="font-size:10px;padding:2px 6px" data-tip="Download as markdown"><i class="ti ti-download" style="font-size:11px"></i></button>'
    + '</span></div>';

  // Dual-column mode when engagement_scope exists
  if (scope && scope.services && Object.keys(scope.services).length) {
    _recalcScopeTotals();
    var t = scope.totals || {};

    // Collect all enabled services
    var allSvcs = [];
    Object.keys(scope.services).forEach(function(k) { allSvcs.push(scope.services[k]); });
    Object.keys(scope.additional_services || {}).forEach(function(k) { if (scope.additional_services[k].enabled) allSvcs.push(scope.additional_services[k]); });
    var monthlySvcs = allSvcs.filter(function(s) { return s.cost && !s.cost.isProject && s.enabled; });
    var projectSvcs = allSvcs.filter(function(s) { return s.cost && s.cost.isProject && s.enabled; });

    // Monthly services dual-column table
    if (monthlySvcs.length) {
      html += '<div style="font-size:10px;font-weight:600;color:var(--n2);text-transform:uppercase;margin-bottom:6px">Monthly Recurring</div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px">';
      html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 8px;font-weight:500;color:var(--n2)">Service</th>'
        + '<th style="text-align:right;padding:4px 8px;font-weight:500;color:var(--n2)">Suggested</th>'
        + '<th style="text-align:right;padding:4px 8px;font-weight:500;color:var(--n2)">Realistic</th>'
        + '<th style="text-align:center;padding:4px 8px;font-weight:500;color:var(--n2)">ROI</th></tr>';
      monthlySvcs.forEach(function(s) {
        var sugCost = _scopeEffectiveCost(s);
        var rEnabled = true, rScope = s.scope;
        if (s.realistic_override) {
          if (s.realistic_override.enabled === false) rEnabled = false;
          if (s.realistic_override.scope) rScope = s.realistic_override.scope;
        }
        var _rS = Object.assign({}, s, { scope: rScope });
        var realCost = rEnabled ? _scopeEffectiveCost(_rS) : 0;
        var roiColour = (s.roi && s.roi.multiplier >= 3) ? 'var(--green)' : (s.roi && s.roi.multiplier >= 1.5) ? 'var(--warn)' : 'var(--error)';
        var roiTxt = s.roi && s.roi.multiplier > 0 ? '<span style="color:' + roiColour + ';font-weight:600">' + s.roi.multiplier + 'x</span>' : '\u2014';
        html += '<tr style="border-bottom:1px solid var(--border)">';
        html += '<td style="padding:4px 8px">' + esc(s.name) + (s.scope_note ? '<div style="font-size:9px;color:var(--n3)">' + esc(s.scope_note) + '</div>' : '') + '</td>';
        html += '<td style="padding:4px 8px;text-align:right;white-space:nowrap">$' + sugCost.toLocaleString() + '/mo<div style="font-size:9px;color:var(--n3)">' + s.scope + ' scope</div></td>';
        html += '<td style="padding:4px 8px;text-align:right;white-space:nowrap">' + (rEnabled ? '$' + realCost.toLocaleString() + '/mo' : '<span style="color:var(--n3);text-decoration:line-through">cut</span>') + '</td>';
        html += '<td style="padding:4px 8px;text-align:center">' + roiTxt + '</td></tr>';
      });
      html += '<tr style="font-weight:700;border-top:2px solid var(--border)"><td style="padding:4px 8px">Monthly Total</td>'
        + '<td style="padding:4px 8px;text-align:right">$' + t.suggested_monthly.toLocaleString() + '/mo</td>'
        + '<td style="padding:4px 8px;text-align:right;color:var(--green)">$' + t.realistic_monthly.toLocaleString() + '/mo</td>'
        + '<td></td></tr>';
      html += '</table>';
    }

    // One-time costs
    var diagCost = 0;
    if (_pricingCatalog.strategy && _pricingCatalog.strategy.pricing) diagCost = _pricingCatalog.strategy.pricing.price || 750;
    var trackMin = 0, trackMax = 0;
    if (_pricingCatalog.tracking) {
      var tr2 = _pricingCatalog.tracking.pricing || _pricingCatalog.tracking;
      trackMin = tr2.projectMin || tr2.project_min || tr2.min || 1500;
      trackMax = tr2.projectMax || tr2.project_max || tr2.max || 4000;
    }
    html += '<div style="font-size:10px;font-weight:600;color:var(--n2);text-transform:uppercase;margin-bottom:6px">One-Time Setup</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px">';
    html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px">Growth Diagnostic</td>'
      + '<td style="padding:4px 8px;text-align:right">$' + diagCost.toLocaleString() + ' <span style="font-size:9px;color:var(--green)">(credited on sign)</span></td></tr>';
    if (trackMin) {
      html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px">Analytics Setup</td>'
        + '<td style="padding:4px 8px;text-align:right">$' + trackMin.toLocaleString() + ' \u2013 $' + trackMax.toLocaleString() + '</td></tr>';
    }
    projectSvcs.forEach(function(s) {
      html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px">' + esc(s.name) + '</td>'
        + '<td style="padding:4px 8px;text-align:right">$' + s.cost.min.toLocaleString() + ' \u2013 $' + s.cost.max.toLocaleString() + '</td></tr>';
    });
    html += '</table>';

    // Totals grid: 2x3
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px">';
    html += '<div style="background:var(--panel);border-radius:8px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--dark)">$' + t.suggested_monthly.toLocaleString() + '</div><div style="font-size:9px;color:var(--n2)">Suggested /mo</div></div>';
    html += '<div style="background:var(--panel);border-radius:8px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--dark)">$' + t.suggested_project.toLocaleString() + '</div><div style="font-size:9px;color:var(--n2)">One-Time</div></div>';
    html += '<div style="background:var(--panel);border-radius:8px;padding:10px;text-align:center"><div style="font-size:16px;font-weight:700;color:var(--dark)">$' + t.year1_suggested.toLocaleString() + '</div><div style="font-size:9px;color:var(--n2)">Year 1 Suggested</div></div>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
    html += '<div style="background:rgba(21,142,29,0.04);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(21,142,29,0.1)"><div style="font-size:16px;font-weight:700;color:var(--green)">$' + t.realistic_monthly.toLocaleString() + '</div><div style="font-size:9px;color:var(--n2)">Realistic /mo</div></div>';
    html += '<div style="background:rgba(21,142,29,0.04);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(21,142,29,0.1)"><div style="font-size:16px;font-weight:700;color:var(--green)">$' + t.realistic_project.toLocaleString() + '</div><div style="font-size:9px;color:var(--n2)">One-Time</div></div>';
    html += '<div style="background:rgba(21,142,29,0.04);border-radius:8px;padding:10px;text-align:center;border:1px solid rgba(21,142,29,0.1)"><div style="font-size:16px;font-weight:700;color:var(--green)">$' + t.year1_realistic.toLocaleString() + '</div><div style="font-size:9px;color:var(--n2)">Year 1 Realistic</div></div>';
    html += '</div>';

    // Package fit
    if (pkgFit) {
      var fitColour = pkgFit.tier === 'below_minimum' ? '#f56c6c' : pkgFit.tier === 'custom' ? '#e6a23c' : 'var(--green)';
      html += '<div style="padding:8px 12px;border-radius:6px;background:' + fitColour + '08;border:1px solid ' + fitColour + '20;font-size:11px;margin-bottom:8px">'
        + '<strong>Package fit:</strong> ' + esc(pkgFit.label);
      if (pkgFit.pkg) {
        var pMin = pkgFit.pkg.priceMin || pkgFit.pkg.price_min || pkgFit.pkg.min || 0;
        var pMax = pkgFit.pkg.priceMax || pkgFit.pkg.price_max || pkgFit.pkg.max || 0;
        html += ' ($' + pMin.toLocaleString() + ' \u2013 $' + pMax.toLocaleString() + '/mo)';
      }
      html += '</div>';
    }
    if (budget > 0) {
      var gap = t.suggested_monthly - budget;
      if (gap > 0) {
        html += '<div style="padding:8px 12px;border-radius:6px;background:#fdf6ec;border:1px solid #e6a23c40;font-size:11px">'
          + '<strong>Budget gap:</strong> Suggested $' + t.suggested_monthly.toLocaleString() + '/mo vs budget $' + budget.toLocaleString() + '/mo. Realistic scope adjusted to $' + t.realistic_monthly.toLocaleString() + '/mo.</div>';
      } else {
        html += '<div style="padding:8px 12px;border-radius:6px;background:rgba(21,142,29,0.05);border:1px solid rgba(21,142,29,0.15);font-size:11px">'
          + '<strong>Budget aligned:</strong> Suggested $' + t.suggested_monthly.toLocaleString() + '/mo fits within $' + budget.toLocaleString() + '/mo budget.</div>';
      }
    }
    html += '</div>';
    return html;
  }

  // Fallback: old lever-based rendering (no engagement_scope)
  var levers = (S.strategy.channel_strategy && S.strategy.channel_strategy.levers) || [];
  if (!levers.length) { html += '</div>'; return html; }
  var monthlyServices = [];
  var projectServices = [];
  var totalMonthly = 0, totalProject = 0;
  levers.forEach(function(lev) {
    var svc = lookupServicePricing(lev.lever);
    if (!svc) return;
    var cost = getServiceMonthlyCost(svc);
    if (!cost) return;
    var entry = { name: svc.name || svc.service || lev.lever, min: cost.min, max: cost.max, mid: cost.mid };
    if (cost.isProject) { projectServices.push(entry); totalProject += cost.mid; }
    else { monthlyServices.push(entry); totalMonthly += cost.mid; }
  });
  var diagCost2 = (_pricingCatalog.strategy && _pricingCatalog.strategy.pricing) ? (_pricingCatalog.strategy.pricing.price || 750) : 0;
  var trackMin2 = 0, trackMax2 = 0;
  if (_pricingCatalog.tracking) { var tr3 = _pricingCatalog.tracking.pricing || _pricingCatalog.tracking; trackMin2 = tr3.projectMin || tr3.project_min || tr3.min || 1500; trackMax2 = tr3.projectMax || tr3.project_max || tr3.max || 4000; }
  totalProject += Math.round((trackMin2 + trackMax2) / 2) + diagCost2;
  var yearTotal = (totalMonthly * 12) + totalProject;
  if (monthlyServices.length) {
    html += '<div style="font-size:10px;font-weight:600;color:var(--n2);text-transform:uppercase;margin-bottom:6px">Monthly Recurring</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px">';
    monthlyServices.forEach(function(s) { html += '<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 8px">' + esc(s.name) + '</td><td style="padding:4px 8px;text-align:right">$' + s.min.toLocaleString() + ' \u2013 $' + s.max.toLocaleString() + '/mo</td></tr>'; });
    html += '<tr style="font-weight:700;border-top:2px solid var(--border)"><td style="padding:4px 8px">Monthly Total</td><td style="padding:4px 8px;text-align:right">$' + totalMonthly.toLocaleString() + '/mo</td></tr></table>';
  }
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">';
  html += '<div style="background:var(--panel);border-radius:8px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:700">$' + totalMonthly.toLocaleString() + '</div><div style="font-size:9px;color:var(--n2)">Monthly</div></div>';
  html += '<div style="background:var(--panel);border-radius:8px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:700">$' + totalProject.toLocaleString() + '</div><div style="font-size:9px;color:var(--n2)">One-Time</div></div>';
  html += '<div style="background:var(--panel);border-radius:8px;padding:12px;text-align:center"><div style="font-size:18px;font-weight:700">$' + yearTotal.toLocaleString() + '</div><div style="font-size:9px;color:var(--n2)">Year 1</div></div></div>';
  html += '</div>';
  return html;
}

// ── Engagement Scope (Service Selection + ROI + Budget Throttle) ──────

function _scopeCostForTier(cost, scope) {
  if (!cost) return 0;
  // Named tier lookup (e.g. "growth", "authority", "visible")
  if (cost.tiers && cost.tiers.length) {
    var match = cost.tiers.find(function(t) { return t.id === scope; });
    if (match) return match.monthly || match.price || 0;
  }
  // Fallback to low/mid/high positional
  if (scope === 'low') return cost.min || 0;
  if (scope === 'high') return cost.max || 0;
  return cost.mid || 0;
}

// Auto-build engagement scope if D4 data exists but scope doesn't yet,
// or refresh pricing data on existing scope if cost data looks stale
function _ensureEngagementScope() {
  if (!S.strategy || !_pricingCatalog) return;
  var hasLevers = S.strategy.channel_strategy && S.strategy.channel_strategy.levers;
  var needsRender = false;
  if (hasLevers && !S.strategy.engagement_scope) {
    // Fresh build
    _buildEngagementScope();
    needsRender = true;
  } else if (S.strategy.engagement_scope) {
    // Refresh pricing, descriptions, and includes on existing scope entries
    needsRender = _refreshScopePricing();
  }
  if (needsRender && (_sTab === 'channels' || _sTab === 'output')) {
    renderStrategyTabContent();
  }
}

// Re-read pricing data from catalog onto existing scope entries (e.g. after pricing catalog schema fix)
function _refreshScopePricing() {
  var scope = S.strategy.engagement_scope;
  if (!scope || !_pricingCatalog) return false;
  var changed = false;
  var allEntries = [].concat(
    Object.keys(scope.services || {}).map(function(k) { return { svc: scope.services[k], slug: k }; }),
    Object.keys(scope.additional_services || {}).map(function(k) { return { svc: scope.additional_services[k], slug: k }; })
  );
  // Build catalog slug set for filtering
  var _catSlugs = new Set();
  (_pricingCatalog.services || []).forEach(function(s) { _catSlugs.add(s.id); });

  // Remove services not in the catalog (we do not offer them)
  ['services', 'additional_services'].forEach(function(section) {
    if (!scope[section]) return;
    Object.keys(scope[section]).forEach(function(slug) {
      if (!_catSlugs.has(slug)) {
        delete scope[section][slug];
        changed = true;
      }
    });
  });

  allEntries = allEntries.filter(function(e) { return _catSlugs.has(e.slug); });
  allEntries.forEach(function(entry) {
    var catSvc = (_pricingCatalog.services || []).find(function(s) {
      var sSlug = (s.id || s.slug || s.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return sSlug === entry.slug || sSlug.indexOf(entry.slug) >= 0 || entry.slug.indexOf(sSlug) >= 0;
    });
    if (!catSvc) return;
    var cost = getServiceMonthlyCost(catSvc);
    if (cost) {
      // Always refresh cost from live catalog — prices change, tiers may be added
      var newCost = { min: cost.min, max: cost.max, mid: cost.mid, isProject: !!cost.isProject, tiers: cost.tiers || null };
      if (!entry.svc.cost || entry.svc.cost.min !== newCost.min || entry.svc.cost.max !== newCost.max || (newCost.tiers && !entry.svc.cost.tiers)) {
        entry.svc.cost = newCost;
        changed = true;
      }
    }
    if (catSvc.description) {
      entry.svc.description = catSvc.description;
    }
    if (!entry.svc.scope_note && catSvc.description) {
      entry.svc.scope_note = catSvc.description;
      changed = true;
    }
    // Always refresh scope includes and tier names from catalog
    var newIncludes = _buildScopeIncludes(catSvc);
    if (newIncludes) {
      entry.svc.scope_includes = newIncludes;
      changed = true;
    }
    var newTierNames = _getTierNames(catSvc);
    if (newTierNames) {
      entry.svc.tier_names = newTierNames;
      // Migrate old low/mid/high to actual tier IDs
      var curScope = entry.svc.scope;
      var validScope = newTierNames.some(function(t) { return t.id === curScope; });
      if (!validScope) {
        if (curScope === 'low') entry.svc.scope = newTierNames[0].id;
        else if (curScope === 'high') entry.svc.scope = newTierNames[newTierNames.length - 1].id;
        else if (curScope === 'mid') entry.svc.scope = newTierNames[Math.floor(newTierNames.length / 2)].id;
        else entry.svc.scope = newTierNames[0].id;
      }
      changed = true;
    }
  });
  if (changed) {
    _recalcScopeTotals();
    scheduleSave();
  }
  return changed;
}

// Build scope-level includes from catalog service data
// Returns { low: [...], mid: [...], high: [...] } with what each tier includes
function _buildScopeIncludes(svc) {
  if (!svc) return null;
  var p = svc.pricing || {};
  // Tier-based — key by tier ID (e.g. "growth", "authority", "visible")
  if (p.tiers && p.tiers.length) {
    var sorted = p.tiers.slice().sort(function(a, b) { return (a.monthly || a.price || 0) - (b.monthly || b.price || 0); });
    var result = {};
    sorted.forEach(function(t) {
      var id = t.id || (t.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      result[id] = t.includes || [];
    });
    // Also provide low/mid/high fallback mapping
    if (sorted[0]) result.low = sorted[0].includes || [];
    if (sorted.length >= 2) result.mid = sorted[Math.floor(sorted.length / 2)].includes || [];
    if (sorted[sorted.length - 1]) result.high = sorted[sorted.length - 1].includes || [];
    return result;
  }
  // Non-tiered: all scopes share the same includes list
  if (svc.includes && svc.includes.length) {
    return { low: svc.includes, mid: svc.includes, high: svc.includes };
  }
  return null;
}

// Get tier labels from catalog. Returns array of { id, name, price } sorted by price ascending.
// Falls back to low/mid/high when no named tiers exist.
function _getTierNames(svc) {
  if (!svc || !svc.pricing || !svc.pricing.tiers || !svc.pricing.tiers.length) return null;
  var sorted = svc.pricing.tiers.slice().sort(function(a, b) { return (a.monthly || a.price || 0) - (b.monthly || b.price || 0); });
  return sorted.map(function(t) {
    return { id: t.id || t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: t.name, price: t.monthly || t.price || 0 };
  });
}

function _buildEngagementScope() {
  if (!_pricingCatalog || !S.strategy || !S.strategy.channel_strategy) return;
  var levers = S.strategy.channel_strategy.levers || [];
  if (!levers.length) return;

  // Build reverse map: service slug → array of lever keys
  var slugToLevers = {};
  Object.keys(LEVER_SERVICE_MAP).forEach(function(leverKey) {
    var slug = LEVER_SERVICE_MAP[leverKey];
    if (!slugToLevers[slug]) slugToLevers[slug] = [];
    slugToLevers[slug].push(leverKey);
  });

  // Build catalog slug set — only services we actually offer
  var _catSlugs = new Set();
  (_pricingCatalog.services || []).forEach(function(s) { _catSlugs.add(s.id); });

  // Build services from lever groups — only include services that exist in the pricing catalog
  var services = {};
  var mappedSlugs = {};
  Object.keys(slugToLevers).forEach(function(slug) {
    // Skip services not in the pricing catalog — we do not offer them
    if (!_catSlugs.has(slug)) return;
    var leverKeys = slugToLevers[slug];
    var matchedLevers = levers.filter(function(l) { return leverKeys.indexOf(l.lever) >= 0; });
    if (!matchedLevers.length) return;
    mappedSlugs[slug] = true;
    var avgPriority = matchedLevers.reduce(function(sum, l) { return sum + (l.priority_score || 0); }, 0) / matchedLevers.length;
    var funnelStages = [];
    matchedLevers.forEach(function(l) {
      if (l.funnel_stage && funnelStages.indexOf(l.funnel_stage) < 0) funnelStages.push(l.funnel_stage);
    });
    var svc = lookupServicePricing(leverKeys[0]);
    var cost = svc ? getServiceMonthlyCost(svc) : null;
    var svcName = svc ? (svc.name || svc.service || svc.id || slug) : slug.replace(/-/g, ' ');
    // Preserve existing scope settings if they exist
    var existing = (S.strategy.engagement_scope && S.strategy.engagement_scope.services) ? S.strategy.engagement_scope.services[slug] : null;
    // Build scope-level includes from catalog
    var scopeIncludes = _buildScopeIncludes(svc);
    var tierNames = _getTierNames(svc);
    // Default scope: first tier ID if tiers exist, otherwise 'mid'
    var defaultScope = (tierNames && tierNames.length) ? tierNames[0].id : 'mid';
    // Validate existing scope is still a valid tier
    var existingScope = existing ? existing.scope : null;
    if (existingScope && tierNames && tierNames.length) {
      var validTier = tierNames.some(function(t) { return t.id === existingScope; });
      if (!validTier) existingScope = null;
    }
    services[slug] = {
      slug: slug,
      name: svcName,
      description: svc ? (svc.description || '') : '',
      enabled: existing ? existing.enabled : (avgPriority >= 5.0),
      scope: existingScope || defaultScope,
      scope_note: existing ? (existing.scope_note || '') : (svc ? (svc.description || '') : ''),
      scope_includes: scopeIncludes,
      tier_names: tierNames,
      source_levers: leverKeys.filter(function(k) { return matchedLevers.some(function(l) { return l.lever === k; }); }),
      avg_priority: Math.round(avgPriority * 10) / 10,
      funnel_stages: funnelStages,
      cost: cost ? { min: cost.min, max: cost.max, mid: cost.mid, isProject: !!cost.isProject, tiers: cost.tiers || null } : null,
      roi: null,
      realistic_override: null
    };
    _computeServiceROI(services[slug]);
  });

  // Additional services from catalog not mapped from any lever
  var additional = {};
  (_pricingCatalog.services || []).forEach(function(svc) {
    var sSlug = (svc.id || svc.slug || svc.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (mappedSlugs[sSlug]) return;
    // Check if any LEVER_SERVICE_MAP value matches
    var isMapped = false;
    Object.keys(slugToLevers).forEach(function(s) { if (s === sSlug) isMapped = true; });
    if (isMapped && services[sSlug]) return;
    var cost = getServiceMonthlyCost(svc);
    var existingAdd = (S.strategy.engagement_scope && S.strategy.engagement_scope.additional_services) ? S.strategy.engagement_scope.additional_services[sSlug] : null;
    var scopeIncludes = _buildScopeIncludes(svc);
    additional[sSlug] = {
      slug: sSlug,
      name: svc.name || svc.service || svc.id || sSlug,
      description: svc.description || '',
      enabled: existingAdd ? existingAdd.enabled : false,
      scope: existingAdd ? existingAdd.scope : 'mid',
      scope_note: existingAdd ? (existingAdd.scope_note || '') : (svc.description || ''),
      scope_includes: scopeIncludes,
      tier_names: _getTierNames(svc),
      source_levers: [],
      avg_priority: 0,
      funnel_stages: [],
      cost: cost ? { min: cost.min, max: cost.max, mid: cost.mid, isProject: !!cost.isProject } : null,
      roi: null,
      realistic_override: null
    };
  });

  S.strategy.engagement_scope = {
    updated_at: new Date().toISOString(),
    services: services,
    additional_services: additional,
    totals: {}
  };
  _computeRealisticOverrides();
  _recalcScopeTotals();
  scheduleSave();
}

function _recalcScopeTotals() {
  var scope = S.strategy && S.strategy.engagement_scope;
  if (!scope) return;
  var sugMo = 0, sugProj = 0, realMo = 0, realProj = 0;
  var allSvcs = [].concat(
    Object.keys(scope.services || {}).map(function(k) { return scope.services[k]; }),
    Object.keys(scope.additional_services || {}).map(function(k) { return scope.additional_services[k]; })
  );
  allSvcs.forEach(function(svc) {
    if (!svc.cost) return;
    // Suggested: use raw enabled + scope (with PPC platform multiplier)
    if (svc.enabled) {
      var sugCost = _scopeEffectiveCost(svc);
      if (svc.cost.isProject) sugProj += sugCost; else sugMo += sugCost;
    }
    // Realistic: use override if present
    var rEnabled = svc.enabled;
    var rScope = svc.scope;
    if (svc.realistic_override) {
      if (svc.realistic_override.enabled === false) rEnabled = false;
      if (svc.realistic_override.scope) rScope = svc.realistic_override.scope;
    }
    if (rEnabled) {
      var _rSvc = Object.assign({}, svc, { scope: rScope });
      var realCost = _scopeEffectiveCost(_rSvc);
      if (svc.cost.isProject) realProj += realCost; else realMo += realCost;
    }
  });
  // Add diagnostic + tracking to project totals
  var diagCost = 0;
  if (_pricingCatalog && _pricingCatalog.strategy && _pricingCatalog.strategy.pricing) {
    diagCost = _pricingCatalog.strategy.pricing.price || 750;
  }
  var trackMid = 0;
  if (_pricingCatalog && _pricingCatalog.tracking) {
    var tr = _pricingCatalog.tracking.pricing || _pricingCatalog.tracking;
    var tMin = tr.projectMin || tr.project_min || tr.min || 1500;
    var tMax = tr.projectMax || tr.project_max || tr.max || 4000;
    trackMid = Math.round((tMin + tMax) / 2);
  }
  sugProj += diagCost + trackMid;
  realProj += diagCost + trackMid;
  var budget = parseFloat(String((S.research || {}).monthly_marketing_budget || '0').replace(/[^0-9.]/g, ''));
  scope.totals = {
    suggested_monthly: sugMo,
    suggested_project: sugProj,
    realistic_monthly: realMo,
    realistic_project: realProj,
    client_budget: budget,
    year1_suggested: (sugMo * 12) + sugProj,
    year1_realistic: (realMo * 12) + realProj
  };
}

function _computeRealisticOverrides() {
  var scope = S.strategy && S.strategy.engagement_scope;
  if (!scope) return;
  var budget = parseFloat(String((S.research || {}).monthly_marketing_budget || '0').replace(/[^0-9.]/g, ''));
  if (!budget || budget <= 0) return;

  // Clear existing overrides
  var allKeys = Object.keys(scope.services || {});
  allKeys.forEach(function(k) { scope.services[k].realistic_override = null; });
  Object.keys(scope.additional_services || {}).forEach(function(k) { scope.additional_services[k].realistic_override = null; });

  // Calculate suggested monthly total
  var enabledMonthly = [];
  allKeys.forEach(function(k) {
    var svc = scope.services[k];
    if (svc.enabled && svc.cost && !svc.cost.isProject) {
      enabledMonthly.push(svc);
    }
  });
  Object.keys(scope.additional_services || {}).forEach(function(k) {
    var svc = scope.additional_services[k];
    if (svc.enabled && svc.cost && !svc.cost.isProject) {
      enabledMonthly.push(svc);
    }
  });

  // Sort by priority ascending (lowest gets throttled first)
  enabledMonthly.sort(function(a, b) { return (a.avg_priority || 0) - (b.avg_priority || 0); });

  var total = enabledMonthly.reduce(function(sum, svc) { return sum + _scopeEffectiveCost(svc); }, 0);
  if (total <= budget) return; // Already fits

  for (var i = 0; i < enabledMonthly.length && total > budget; i++) {
    var svc = enabledMonthly[i];
    var currentScope = svc.scope;
    var currentCost = _scopeEffectiveCost(svc);

    if (currentScope === 'high') {
      var midCost = _scopeCostForTier(svc.cost, 'mid');
      svc.realistic_override = { scope: 'mid' };
      total -= (currentCost - midCost);
    } else if (currentScope === 'mid') {
      var lowCost = _scopeCostForTier(svc.cost, 'low');
      svc.realistic_override = { scope: 'low' };
      total -= (currentCost - lowCost);
    } else {
      svc.realistic_override = { enabled: false };
      total -= currentCost;
    }
  }
}

function _computeServiceROI(svcEntry) {
  if (!svcEntry || !svcEntry.cost || !svcEntry.enabled) { svcEntry.roi = null; return; }
  var ue = S.strategy && S.strategy.unit_economics;
  if (!ue) { svcEntry.roi = null; return; }

  var ltv = parseFloat(ue.ltv) || 0;
  var cac = parseFloat(ue.estimated_cac) || 0;
  if (!ltv || !cac) { svcEntry.roi = null; return; }

  // Get economics score from source levers
  var levers = (S.strategy.channel_strategy && S.strategy.channel_strategy.levers) || [];
  var econScores = [];
  svcEntry.source_levers.forEach(function(lk) {
    var lev = levers.find(function(l) { return l.lever === lk; });
    if (lev && lev.economics) econScores.push(lev.economics);
  });
  var avgEcon = econScores.length ? econScores.reduce(function(s, v) { return s + v; }, 0) / econScores.length : 5;

  // Get sensitivity base scenario for close rate + avg deal
  var closeRate = 0.05, avgDeal = ltv;
  if (ue.sensitivity && ue.sensitivity.length) {
    var base = ue.sensitivity.find(function(s) { return s.scenario === 'base'; }) || ue.sensitivity[1] || ue.sensitivity[0];
    if (base) {
      closeRate = parseFloat(String(base.close_rate || '5').replace(/[^0-9.]/g, '')) / 100 || 0.05;
      avgDeal = parseFloat(base.avg_deal) || ltv;
    }
  }

  // Estimate leads from expected_cpl — prefer GKP bid data when available
  var bt = (S.strategy.channel_strategy && S.strategy.channel_strategy.budget_tiers) || {};
  var currentTier = bt.current_budget || {};
  var expectedCpl = parseFloat(currentTier.expected_cpl) || cac;
  if (expectedCpl <= 0) expectedCpl = cac;
  // If GKP bid data exists, use avg high_bid * typical CPL multiplier (5-10x CPC)
  var kwR = S.kwResearch || {};
  var kwsWithBids = (kwR.keywords || []).filter(function(k) { return k.high_bid && k.high_bid > 0; });
  if (kwsWithBids.length >= 3) {
    var gkpAvgBid = kwsWithBids.reduce(function(s,k){return s+k.high_bid;},0) / kwsWithBids.length;
    var gkpCpl = gkpAvgBid * 7; // 7x CPC-to-CPL multiplier (industry standard)
    if (!expectedCpl || expectedCpl === cac) expectedCpl = gkpCpl;
  }

  var svcCost = _scopeCostForTier(svcEntry.cost, svcEntry.scope);
  if (!svcCost || svcEntry.cost.isProject) {
    // Project-based: ROI = LTV of customers acquired from the asset over 12 months / cost
    var estLeadsFromProject = avgDeal > 0 ? Math.max(1, Math.round(svcCost / expectedCpl * 0.3)) : 1;
    var projRevenue = estLeadsFromProject * closeRate * avgDeal * 12;
    svcEntry.roi = {
      multiplier: svcCost > 0 ? Math.round((projRevenue / svcCost) * 10) / 10 : 0,
      timeline: '6-12 months',
      confidence: avgEcon >= 7 ? 'high' : avgEcon >= 5 ? 'medium' : 'low'
    };
    return;
  }

  // Monthly: leads per month from this service's budget
  var leadsPerMonth = expectedCpl > 0 ? svcCost / expectedCpl : 0;
  var revenuePerMonth = leadsPerMonth * closeRate * avgDeal;
  var annualRevenue = revenuePerMonth * 12;
  var annualCost = svcCost * 12;

  // Get timeline from source levers
  var timelines = [];
  svcEntry.source_levers.forEach(function(lk) {
    var lev = levers.find(function(l) { return l.lever === lk; });
    if (lev && lev.timeline_to_results) timelines.push(lev.timeline_to_results);
  });
  var timeline = timelines.length ? timelines[timelines.length - 1] : 'ongoing';

  svcEntry.roi = {
    multiplier: annualCost > 0 ? Math.round((annualRevenue / annualCost) * 10) / 10 : 0,
    timeline: timeline,
    confidence: avgEcon >= 7 ? 'high' : avgEcon >= 5 ? 'medium' : 'low'
  };
}

function _renderScopePanel() {
  var scope = S.strategy && S.strategy.engagement_scope;
  if (!scope) return '';
  var html = '<div style="margin-bottom:18px;border:1px solid var(--border);border-radius:8px;padding:14px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
    + '<span style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em">Service Scope ' + _renderPricingIndicator() + '</span>'
    + '<button class="btn btn-ghost sm" id="scope-reset-btn" style="font-size:10px"><i class="ti ti-refresh" style="font-size:11px"></i> Reset from D4</button></div>';

  // Service rows
  var svcKeys = Object.keys(scope.services || {}).sort(function(a, b) {
    return (scope.services[b].avg_priority || 0) - (scope.services[a].avg_priority || 0);
  });

  html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 6px;font-weight:500;color:var(--n2);width:20px"></th>'
    + '<th style="text-align:left;padding:4px 6px;font-weight:500;color:var(--n2)">Service</th>'
    + '<th style="text-align:right;padding:4px 6px;font-weight:500;color:var(--n2)">Cost</th>'
    + '<th style="text-align:center;padding:4px 6px;font-weight:500;color:var(--n2)">Scope</th>'
    + '<th style="text-align:center;padding:4px 6px;font-weight:500;color:var(--n2);width:55px">Est. ROI</th>'
    + '<th style="text-align:left;padding:4px 6px;font-weight:500;color:var(--n2)">Scope Note</th></tr>';

  svcKeys.forEach(function(slug) {
    var svc = scope.services[slug];
    html += _renderScopeRow(svc, 'services');
  });

  // Additional services
  var addKeys = Object.keys(scope.additional_services || {});
  if (addKeys.length) {
    html += '<tr><td colspan="6" style="padding:8px 6px 4px;font-size:10px;font-weight:600;color:var(--n2);text-transform:uppercase;border-bottom:1px solid var(--border)">Additional Services</td></tr>';
    addKeys.forEach(function(slug) {
      var svc = scope.additional_services[slug];
      html += _renderScopeRow(svc, 'additional');
    });
  }
  html += '</table>';

  // Totals bar
  html += '<div id="scope-totals-bar" style="margin-top:10px">' + _renderScopeTotalsBar() + '</div>';
  html += '</div>';
  return html;
}

// PPC platform definitions — each platform account is billed at the base PPC rate
var PPC_PLATFORMS = [
  { id: 'google', label: 'Google' },
  { id: 'meta', label: 'Meta' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'tiktok', label: 'TikTok' }
];

function _ppcTotalAccounts(svc) {
  if (!svc.ppc_platforms) return 1;
  var total = 0;
  PPC_PLATFORMS.forEach(function(p) {
    var v = svc.ppc_platforms[p.id];
    total += (typeof v === 'number' ? v : (v ? 1 : 0));
  });
  return Math.max(total, 1);
}

function _scopeEffectiveCost(svc) {
  if (!svc.cost) return 0;
  var base = _scopeCostForTier(svc.cost, svc.scope);
  if (svc.slug === 'google-ads') return base * _ppcTotalAccounts(svc);
  return base;
}

function _renderScopeRow(svc, section) {
  var rowOpacity = svc.enabled ? '1' : '0.45';
  // Show active scope cost (with PPC multiplier if applicable)
  var costTxt = '\u2014';
  if (svc.cost) {
    var activeCost = _scopeEffectiveCost(svc);
    costTxt = '$' + activeCost.toLocaleString() + (svc.cost.isProject ? '' : '/mo');
  }
  var rangeTxt = '';
  if (svc.slug === 'google-ads' && svc.cost) {
    var baseCost = _scopeCostForTier(svc.cost, svc.scope);
    var totalAccounts = _ppcTotalAccounts(svc);
    if (totalAccounts > 1) rangeTxt = '$' + baseCost.toLocaleString() + '/mo \u00d7 ' + totalAccounts + ' accounts';
  } else if (svc.cost && svc.cost.min !== svc.cost.max) {
    rangeTxt = '$' + svc.cost.min.toLocaleString() + ' \u2013 $' + svc.cost.max.toLocaleString() + (svc.cost.isProject ? '' : '/mo');
  }
  var roiHtml = '\u2014';
  if (svc.roi && svc.roi.multiplier > 0) {
    var roiColour = svc.roi.multiplier >= 3 ? 'var(--green)' : svc.roi.multiplier >= 1.5 ? 'var(--warn)' : 'var(--error)';
    roiHtml = '<span style="color:' + roiColour + ';font-weight:600">' + svc.roi.multiplier + 'x</span>';
  }
  var html = '<tr style="border-bottom:1px solid var(--border);opacity:' + rowOpacity + '">';
  html += '<td style="padding:4px 6px"><input type="checkbox" data-scope-slug="' + esc(svc.slug) + '" data-scope-section="' + section + '" ' + (svc.enabled ? 'checked' : '') + ' style="margin:0;cursor:pointer"></td>';
  html += '<td style="padding:4px 6px"><span style="font-weight:500">' + esc(svc.name) + '</span>';
  if (svc.source_levers.length > 1) {
    html += ' <span style="font-size:9px;color:var(--n2);background:var(--bg);padding:1px 4px;border-radius:3px">' + svc.source_levers.length + ' levers</span>';
  }
  if (svc.avg_priority > 0) {
    html += ' <span style="font-size:9px;color:var(--n2)">' + svc.avg_priority + '</span>';
  }
  if (svc.funnel_stages.length) {
    html += '<div style="font-size:9px;color:var(--n3);margin-top:1px">' + svc.funnel_stages.join(', ') + '</div>';
  }
  html += '</td>';
  // Active cost + range/multiplier below
  html += '<td style="padding:4px 6px;text-align:right;white-space:nowrap">'
    + '<div style="font-size:11px;font-weight:600;color:var(--dark)">' + costTxt + '</div>';
  if (rangeTxt) {
    html += '<div style="font-size:9px;color:var(--n3)">' + rangeTxt + '</div>';
  }
  html += '</td>';

  // Scope column — PPC gets platform checkboxes, others get tier/scope buttons
  html += '<td style="padding:4px 6px;text-align:center;white-space:nowrap">';
  if (svc.slug === 'google-ads') {
    // PPC platform account counts
    if (!svc.ppc_platforms) svc.ppc_platforms = { google: 1, meta: 0, linkedin: 0, tiktok: 0 };
    // Migrate old boolean format to numbers
    PPC_PLATFORMS.forEach(function(plat) {
      var v = svc.ppc_platforms[plat.id];
      if (v === true) svc.ppc_platforms[plat.id] = 1;
      else if (!v) svc.ppc_platforms[plat.id] = 0;
    });
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
    PPC_PLATFORMS.forEach(function(plat) {
      var count = svc.ppc_platforms[plat.id] || 0;
      html += '<div style="display:flex;align-items:center;gap:2px">'
        + '<span style="font-size:9px;color:' + (count > 0 ? 'var(--dark)' : 'var(--n3)') + '">' + plat.label + '</span>'
        + '<input type="number" class="ppc-plat-count" data-plat="' + plat.id + '" data-scope-slug="' + esc(svc.slug) + '" min="0" max="10" value="' + count + '" '
        + 'style="width:32px;padding:1px 3px;border:1px solid ' + (count > 0 ? 'var(--green)' : 'var(--border)') + ';border-radius:3px;font-size:10px;text-align:center;font-family:var(--font);color:var(--dark);background:var(--white)">'
        + '</div>';
    });
    html += '</div>';
  } else {
    // Standard tier/scope buttons
    var _tierButtons = (svc.tier_names && Array.isArray(svc.tier_names) && svc.tier_names.length)
      ? svc.tier_names.map(function(t) { return { id: t.id, label: t.name }; })
      : [{ id: 'low', label: 'Low' }, { id: 'mid', label: 'Mid' }, { id: 'high', label: 'High' }];
    _tierButtons.forEach(function(tier) {
      var isActive = svc.scope === tier.id;
      var tip = '';
      if (svc.scope_includes && svc.scope_includes[tier.id]) {
        tip = svc.scope_includes[tier.id].slice(0, 4).join(', ');
        if (svc.scope_includes[tier.id].length > 4) tip += ' +' + (svc.scope_includes[tier.id].length - 4) + ' more';
      }
      html += '<button class="scope-level-btn" data-scope-slug="' + esc(svc.slug) + '" data-scope-section="' + esc(section) + '" data-scope-level="' + tier.id + '" '
        + (tip ? 'data-tip="' + esc(tip) + '" ' : '')
        + 'style="font-size:9px;padding:2px 6px;border:1px solid ' + (isActive ? 'var(--green)' : 'var(--border)') + ';background:' + (isActive ? 'var(--green)' : 'transparent') + ';color:' + (isActive ? 'white' : 'var(--n2)') + ';border-radius:3px;cursor:pointer;font-family:var(--font);margin:0 1px">'
        + esc(tier.label) + '</button>';
    });
  }
  html += '</td>';
  html += '<td style="padding:4px 6px;text-align:center">' + roiHtml + '</td>';
  html += '<td style="padding:4px 6px"><input type="text" data-scope-note="' + esc(svc.slug) + '" data-scope-note-section="' + esc(section) + '" value="' + esc(svc.scope_note || '') + '" placeholder="What is included at this scope" style="width:100%;font-size:10px;border:1px solid var(--border);border-radius:4px;padding:3px 6px;font-family:var(--font);color:var(--dark);background:var(--white)"></td>';
  html += '</tr>';
  return html;
}

function _renderScopeTotalsBar() {
  var scope = S.strategy && S.strategy.engagement_scope;
  if (!scope || !scope.totals) return '';
  var t = scope.totals;
  var gap = t.suggested_monthly - (t.client_budget || 0);
  var gapColour = gap > 0 ? 'var(--warn)' : 'var(--green)';
  var html = '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-radius:6px;background:var(--panel);border:1px solid var(--border)">';
  html += '<div style="font-size:11px"><span style="color:var(--n2)">Suggested:</span> <strong>$' + t.suggested_monthly.toLocaleString() + '/mo</strong></div>';
  html += '<div style="font-size:11px"><span style="color:var(--n2)">Realistic:</span> <strong style="color:var(--green)">$' + t.realistic_monthly.toLocaleString() + '/mo</strong></div>';
  if (t.client_budget > 0) {
    html += '<div style="font-size:11px"><span style="color:var(--n2)">Budget:</span> <strong>$' + t.client_budget.toLocaleString() + '/mo</strong></div>';
    if (gap > 0) {
      html += '<div style="font-size:10px;color:' + gapColour + '">Gap: $' + gap.toLocaleString() + '/mo</div>';
    } else {
      html += '<div style="font-size:10px;color:var(--green)">Within budget</div>';
    }
  }
  html += '<div style="font-size:10px;color:var(--n3);margin-left:auto">Setup: $' + t.suggested_project.toLocaleString() + ' | Y1: $' + t.year1_suggested.toLocaleString() + '</div>';
  html += '</div>';
  return html;
}

var _scopeNoteTimer = null;
function _mountScopePanel() {
  var scope = S.strategy && S.strategy.engagement_scope;
  if (!scope) return;

  // Wire checkboxes
  document.querySelectorAll('[data-scope-slug]').forEach(function(el) {
    if (el.tagName !== 'INPUT' || el.type !== 'checkbox') return;
    el.onclick = function() {
      var slug = el.getAttribute('data-scope-slug');
      var section = el.getAttribute('data-scope-section');
      var store = section === 'additional' ? scope.additional_services : scope.services;
      if (store && store[slug]) {
        store[slug].enabled = el.checked;
        _computeServiceROI(store[slug]);
        _computeRealisticOverrides();
        _recalcScopeTotals();
        var bar = document.getElementById('scope-totals-bar');
        if (bar) bar.innerHTML = _renderScopeTotalsBar();
        scheduleSave();
      }
    };
  });

  // Wire scope level buttons
  document.querySelectorAll('.scope-level-btn').forEach(function(btn) {
    btn.onclick = function() {
      var slug = btn.getAttribute('data-scope-slug');
      var level = btn.getAttribute('data-scope-level');
      var svc = (scope.services && scope.services[slug]) || (scope.additional_services && scope.additional_services[slug]);
      if (svc) {
        svc.scope = level;
        _computeServiceROI(svc);
        _computeRealisticOverrides();
        _recalcScopeTotals();
        // Update button styling
        document.querySelectorAll('.scope-level-btn[data-scope-slug="' + slug + '"]').forEach(function(b) {
          var isActive = b.getAttribute('data-scope-level') === level;
          b.style.borderColor = isActive ? 'var(--green)' : 'var(--border)';
          b.style.background = isActive ? 'var(--green)' : 'transparent';
          b.style.color = isActive ? 'white' : 'var(--n2)';
        });
        // Update cost cell for this row
        if (svc.cost) {
          var activeCost = _scopeEffectiveCost(svc);
          var costCell = btn.closest('tr').querySelector('td:nth-child(3) div:first-child');
          if (costCell) costCell.textContent = '$' + activeCost.toLocaleString() + (svc.cost.isProject ? '' : '/mo');
        }
        var bar = document.getElementById('scope-totals-bar');
        if (bar) bar.innerHTML = _renderScopeTotalsBar();
        scheduleSave();
      }
    };
  });

  // Wire PPC platform account count inputs
  document.querySelectorAll('.ppc-plat-count').forEach(function(input) {
    input.onchange = function() {
      var platId = input.getAttribute('data-plat');
      var slug = input.getAttribute('data-scope-slug');
      var svc = slug && scope.services ? scope.services[slug] : null;
      if (!svc) return;
      if (!svc.ppc_platforms) svc.ppc_platforms = { google: 1, meta: 0, linkedin: 0, tiktok: 0 };
      var val = parseInt(input.value, 10) || 0;
      if (val < 0) val = 0;
      if (val > 10) val = 10;
      svc.ppc_platforms[platId] = val;
      input.value = val;
      input.style.borderColor = val > 0 ? 'var(--green)' : 'var(--border)';
      // Update label colour
      var label = input.closest('div').querySelector('span');
      if (label) label.style.color = val > 0 ? 'var(--dark)' : 'var(--n3)';
      // Update cost cell
      var activeCost = _scopeEffectiveCost(svc);
      var row = input.closest('tr');
      if (row) {
        var costDiv = row.querySelector('td:nth-child(3) div:first-child');
        var rangeDiv = row.querySelector('td:nth-child(3) div:nth-child(2)');
        if (costDiv) costDiv.textContent = '$' + activeCost.toLocaleString() + '/mo';
        var totalAccounts = _ppcTotalAccounts(svc);
        var baseCost = _scopeCostForTier(svc.cost, svc.scope);
        if (rangeDiv) {
          rangeDiv.textContent = totalAccounts > 1 ? '$' + baseCost.toLocaleString() + '/mo \u00d7 ' + totalAccounts + ' accounts' : '';
        }
      }
      _computeServiceROI(svc);
      _computeRealisticOverrides();
      _recalcScopeTotals();
      var bar = document.getElementById('scope-totals-bar');
      if (bar) bar.innerHTML = _renderScopeTotalsBar();
      scheduleSave();
    };
  });

  // Wire scope note inputs (debounced)
  document.querySelectorAll('[data-scope-note]').forEach(function(input) {
    input.oninput = function() {
      var slug = input.getAttribute('data-scope-note');
      var svc = (scope.services && scope.services[slug]) || (scope.additional_services && scope.additional_services[slug]);
      if (svc) {
        svc.scope_note = input.value;
        if (_scopeNoteTimer) clearTimeout(_scopeNoteTimer);
        _scopeNoteTimer = setTimeout(function() { scheduleSave(); }, 500);
      }
    };
  });

  // Wire reset button
  var resetBtn = document.getElementById('scope-reset-btn');
  if (resetBtn) {
    resetBtn.onclick = function() {
      // Clear existing scope to force full rebuild
      delete S.strategy.engagement_scope;
      _buildEngagementScope();
      renderStrategyTabContent();
      aiBarNotify('Service scope reset from D4 levers', { duration: 2000 });
    };
  }
}

// ── Constants ─────────────────────────────────────────────────────────

var STRATEGY_TABS = [
  { id:'audience',     label:'Audience',           icon:'ti-users' },
  { id:'positioning',  label:'Positioning',        icon:'ti-target' },
  { id:'economics',    label:'Economics',          icon:'ti-calculator' },
  { id:'subtraction',  label:'Subtraction',        icon:'ti-scissors' },
  { id:'channels',     label:'Channels',           icon:'ti-chart-dots-3' },
  { id:'execution',    label:'Website',            icon:'ti-checklist' },
  { id:'brand',        label:'Content & Authority', icon:'ti-palette' },
  { id:'risks',        label:'Risks',              icon:'ti-alert-triangle' },
  { id:'narrative',    label:'Narrative',          icon:'ti-message-2' },
  { id:'output',       label:'Output',             icon:'ti-file-text' }
];

// ── Industry Benchmark Table ─────────────────────────────────────
// Static benchmark data keyed by industry vertical. Each metric has low/mid/high
// ranges for conservative/base/optimistic sensitivity scenarios.
// Sources: WordStream Google Ads Benchmarks 2024, Unbounce Conversion Benchmark
// Report 2024, HubSpot State of Marketing 2024, Ruler Analytics CPL Report 2024.
// These are starting points — will be refined with real client data over time.
// Industry benchmark data sourced from published reports:
// - WordStream/LocaliQ 2025 Google Ads Benchmarks (16,446 US campaigns, Apr 2024–Mar 2025)
// - LocaliQ Home Services Search Advertising Benchmarks 2025
// - Unbounce 2024 Conversion Benchmark Report (41,000 landing pages, 464M visitors)
// - First Page Sage SQL-to-Closed-Won Conversion Rates 2026 (28 industries)
// - Focus Digital Customer Retention Rates 2025 (16 industries)
// - HubSpot State of Sales 2024, Clio Legal Trends, Dandy/Dental Intelligence PLV data
// - Ruler Analytics, Flyweel CPL/CAC Benchmark Index 2025
// Last updated: 2026-03-20
var INDUSTRY_BENCHMARKS = {
  'construction': {
    landing_page_cvr: { low: 0.02, mid: 0.03, high: 0.05 },
    avg_cpl: { low: 100, mid: 166, high: 250 },
    close_rate: { low: 0.12, mid: 0.16, high: 0.25 },
    retention_multiplier: { low: 2.0, mid: 3.0, high: 4.0 },
    source: 'LocaliQ 2025 (Construction & Contractors CVR 2.61%, CPL $165.67) + First Page Sage 2026 (close 16%)'
  },
  'home services': {
    landing_page_cvr: { low: 0.05, mid: 0.07, high: 0.10 },
    avg_cpl: { low: 55, mid: 91, high: 140 },
    close_rate: { low: 0.20, mid: 0.30, high: 0.40 },
    retention_multiplier: { low: 1.5, mid: 2.5, high: 4.0 },
    source: 'WordStream 2025 (Home & Home Improvement CVR 7.33%, CPL $90.92) + HookAgency close rates'
  },
  'hvac': {
    landing_page_cvr: { low: 0.05, mid: 0.07, high: 0.10 },
    avg_cpl: { low: 75, mid: 128, high: 175 },
    close_rate: { low: 0.20, mid: 0.29, high: 0.40 },
    retention_multiplier: { low: 2.0, mid: 3.0, high: 4.0 },
    source: 'LocaliQ 2025 (HVAC CVR 6.56%, CPL $127.74) + First Page Sage 2026 (HVAC close 29%)'
  },
  'plumbing': {
    landing_page_cvr: { low: 0.05, mid: 0.08, high: 0.12 },
    avg_cpl: { low: 75, mid: 129, high: 175 },
    close_rate: { low: 0.18, mid: 0.25, high: 0.35 },
    retention_multiplier: { low: 2.0, mid: 3.0, high: 4.0 },
    source: 'LocaliQ 2025 (Plumbing CVR 7.63%, CPL $129.02) + Focus Digital 2025 (construction retention 80%)'
  },
  'roofing': {
    landing_page_cvr: { low: 0.02, mid: 0.04, high: 0.06 },
    avg_cpl: { low: 150, mid: 228, high: 350 },
    close_rate: { low: 0.10, mid: 0.16, high: 0.25 },
    retention_multiplier: { low: 1.5, mid: 2.0, high: 3.0 },
    source: 'LocaliQ 2025 (Roofing CVR 3.70%, CPL $228.15) + First Page Sage 2026 (construction close 16%)'
  },
  'electrical': {
    landing_page_cvr: { low: 0.06, mid: 0.09, high: 0.14 },
    avg_cpl: { low: 60, mid: 94, high: 140 },
    close_rate: { low: 0.18, mid: 0.25, high: 0.35 },
    retention_multiplier: { low: 2.0, mid: 3.0, high: 4.0 },
    source: 'LocaliQ 2025 (Electricians CVR 9.08%, CPL $93.69) + home services close rate range'
  },
  'landscaping': {
    landing_page_cvr: { low: 0.04, mid: 0.06, high: 0.10 },
    avg_cpl: { low: 70, mid: 118, high: 170 },
    close_rate: { low: 0.15, mid: 0.22, high: 0.35 },
    retention_multiplier: { low: 3.0, mid: 4.0, high: 5.0 },
    source: 'LocaliQ 2025 (Landscaping CVR 6.42%, CPL $117.92) + recurring service contracts'
  },
  'cleaning': {
    landing_page_cvr: { low: 0.12, mid: 0.18, high: 0.25 },
    avg_cpl: { low: 25, mid: 47, high: 75 },
    close_rate: { low: 0.20, mid: 0.30, high: 0.45 },
    retention_multiplier: { low: 3.0, mid: 4.5, high: 6.0 },
    source: 'LocaliQ 2025 (Cleaning/Maid CVR 17.65%, CPL $46.99) + recurring contract retention'
  },
  'dental': {
    landing_page_cvr: { low: 0.06, mid: 0.09, high: 0.13 },
    avg_cpl: { low: 50, mid: 84, high: 130 },
    close_rate: { low: 0.15, mid: 0.22, high: 0.35 },
    retention_multiplier: { low: 5.0, mid: 7.0, high: 10.0 },
    source: 'WordStream 2025 (Dental CVR 9.08%, CPL $83.93) + Dandy PLV data ($2,800-$5,000 lifetime, 17% annual attrition)'
  },
  'medical': {
    landing_page_cvr: { low: 0.08, mid: 0.12, high: 0.16 },
    avg_cpl: { low: 35, mid: 57, high: 90 },
    close_rate: { low: 0.10, mid: 0.13, high: 0.20 },
    retention_multiplier: { low: 3.0, mid: 5.0, high: 7.0 },
    source: 'WordStream 2025 (Physicians CVR 11.62%, CPL $56.83) + First Page Sage 2026 (healthcare close 13%)'
  },
  'legal': {
    landing_page_cvr: { low: 0.03, mid: 0.05, high: 0.08 },
    avg_cpl: { low: 80, mid: 132, high: 200 },
    close_rate: { low: 0.12, mid: 0.19, high: 0.28 },
    retention_multiplier: { low: 1.0, mid: 2.0, high: 3.0 },
    source: 'WordStream 2025 (Legal CVR 5.09%, CPL $131.63) + First Page Sage 2026 (legal close 19%) + Clio CLV data'
  },
  'real estate': {
    landing_page_cvr: { low: 0.02, mid: 0.03, high: 0.05 },
    avg_cpl: { low: 60, mid: 100, high: 160 },
    close_rate: { low: 0.08, mid: 0.14, high: 0.22 },
    retention_multiplier: { low: 1.0, mid: 1.5, high: 2.5 },
    source: 'WordStream 2025 (Real Estate CVR 3.28%, CPL $100.48) + First Page Sage 2026 (real estate close 14%)'
  },
  'financial services': {
    landing_page_cvr: { low: 0.02, mid: 0.03, high: 0.05 },
    avg_cpl: { low: 50, mid: 84, high: 140 },
    close_rate: { low: 0.12, mid: 0.16, high: 0.22 },
    retention_multiplier: { low: 3.0, mid: 4.0, high: 5.0 },
    source: 'WordStream 2025 (Finance & Insurance CVR 2.55%, CPL $83.93) + First Page Sage 2026 (financial close 16%)'
  },
  'insurance': {
    landing_page_cvr: { low: 0.02, mid: 0.03, high: 0.05 },
    avg_cpl: { low: 50, mid: 84, high: 140 },
    close_rate: { low: 0.12, mid: 0.19, high: 0.25 },
    retention_multiplier: { low: 3.0, mid: 4.0, high: 5.0 },
    source: 'WordStream 2025 (Finance & Insurance CVR 2.55%) + First Page Sage 2026 (business insurance close 19%) + Glassbox (83% retention)'
  },
  'saas': {
    landing_page_cvr: { low: 0.02, mid: 0.04, high: 0.07 },
    avg_cpl: { low: 60, mid: 104, high: 160 },
    close_rate: { low: 0.08, mid: 0.12, high: 0.20 },
    retention_multiplier: { low: 3.0, mid: 4.0, high: 5.0 },
    source: 'Unbounce 2024 (SaaS median CVR 3.8%) + First Page Sage 2026 (B2B SaaS close 12%) + Shopify (SaaS 77% annual retention)'
  },
  'ecommerce': {
    landing_page_cvr: { low: 0.02, mid: 0.04, high: 0.07 },
    avg_cpl: { low: 30, mid: 70, high: 120 },
    close_rate: { low: 0.01, mid: 0.03, high: 0.05 },
    retention_multiplier: { low: 1.5, mid: 2.0, high: 3.0 },
    source: 'WordStream 2025 (Apparel CVR 3.99%, CPL $101.49) + Shopify (e-commerce 38% retention, repeat buyers spend 67% more)'
  },
  'restaurant': {
    landing_page_cvr: { low: 0.05, mid: 0.07, high: 0.12 },
    avg_cpl: { low: 15, mid: 30, high: 55 },
    close_rate: { low: 0.20, mid: 0.30, high: 0.45 },
    retention_multiplier: { low: 5.0, mid: 10.0, high: 15.0 },
    source: 'WordStream 2025 (Restaurant CVR 7.09%, CPL $30.27) + Incentivio/ChowNow (regulars 5-15x annual value)'
  },
  'automotive': {
    landing_page_cvr: { low: 0.05, mid: 0.08, high: 0.12 },
    avg_cpl: { low: 20, mid: 39, high: 65 },
    close_rate: { low: 0.15, mid: 0.20, high: 0.30 },
    retention_multiplier: { low: 2.0, mid: 3.0, high: 4.0 },
    source: 'WordStream 2025 (Auto For Sale CVR 7.76%, Auto Repair CVR 14.67%) + First Page Sage 2026 (automotive close 20%)'
  },
  'auto repair': {
    landing_page_cvr: { low: 0.10, mid: 0.15, high: 0.20 },
    avg_cpl: { low: 15, mid: 29, high: 45 },
    close_rate: { low: 0.25, mid: 0.35, high: 0.50 },
    retention_multiplier: { low: 3.0, mid: 4.0, high: 5.0 },
    source: 'WordStream 2025 (Auto Repair CVR 14.67%, CPL $28.50) + Focus Digital (automotive 83% retention)'
  },
  'education': {
    landing_page_cvr: { low: 0.07, mid: 0.11, high: 0.16 },
    avg_cpl: { low: 55, mid: 90, high: 140 },
    close_rate: { low: 0.10, mid: 0.15, high: 0.22 },
    retention_multiplier: { low: 2.0, mid: 3.0, high: 4.0 },
    source: 'WordStream 2025 (Education CVR 11.38%, CPL $90.02) + Focus Digital retention data'
  },
  'accounting': {
    landing_page_cvr: { low: 0.04, mid: 0.07, high: 0.10 },
    avg_cpl: { low: 60, mid: 104, high: 150 },
    close_rate: { low: 0.15, mid: 0.22, high: 0.32 },
    retention_multiplier: { low: 5.0, mid: 7.0, high: 10.0 },
    source: 'WordStream 2025 (Business Services CVR 5.14%, CPL $103.54) + Focus Digital (professional services 84% retention)'
  },
  'consulting': {
    landing_page_cvr: { low: 0.04, mid: 0.07, high: 0.10 },
    avg_cpl: { low: 60, mid: 104, high: 150 },
    close_rate: { low: 0.15, mid: 0.22, high: 0.32 },
    retention_multiplier: { low: 3.0, mid: 5.0, high: 8.0 },
    source: 'WordStream 2025 (Business Services CVR 5.14%) + Focus Digital (professional services 84% retention)'
  },
  'marketing agency': {
    landing_page_cvr: { low: 0.03, mid: 0.05, high: 0.08 },
    avg_cpl: { low: 70, mid: 104, high: 150 },
    close_rate: { low: 0.12, mid: 0.18, high: 0.28 },
    retention_multiplier: { low: 3.0, mid: 5.0, high: 6.0 },
    source: 'WordStream 2025 (Business Services CVR 5.14%) + Focus Digital (professional services 84% retention)'
  },
  'fitness': {
    landing_page_cvr: { low: 0.05, mid: 0.07, high: 0.10 },
    avg_cpl: { low: 35, mid: 63, high: 95 },
    close_rate: { low: 0.15, mid: 0.22, high: 0.35 },
    retention_multiplier: { low: 1.5, mid: 2.0, high: 2.5 },
    source: 'WordStream 2025 (Health & Fitness CVR 6.80%, CPL $62.80) + WellnessLiving (avg membership 17-24 months)'
  },
  'pet services': {
    landing_page_cvr: { low: 0.08, mid: 0.13, high: 0.18 },
    avg_cpl: { low: 18, mid: 32, high: 50 },
    close_rate: { low: 0.20, mid: 0.30, high: 0.45 },
    retention_multiplier: { low: 3.0, mid: 4.0, high: 5.0 },
    source: 'WordStream 2025 (Animals & Pets CVR 13.07%, CPL $31.82) + Opensend (consumables 40%+ repeat rate)'
  },
  'manufacturing': {
    landing_page_cvr: { low: 0.04, mid: 0.07, high: 0.10 },
    avg_cpl: { low: 50, mid: 86, high: 130 },
    close_rate: { low: 0.10, mid: 0.13, high: 0.20 },
    retention_multiplier: { low: 3.0, mid: 4.0, high: 5.0 },
    source: 'WordStream 2025 (Industrial CVR 7.17%, CPL $85.63) + First Page Sage 2026 (manufacturing close 13%)'
  },
  'moving': {
    landing_page_cvr: { low: 0.03, mid: 0.05, high: 0.08 },
    avg_cpl: { low: 70, mid: 120, high: 180 },
    close_rate: { low: 0.15, mid: 0.20, high: 0.30 },
    retention_multiplier: { low: 1.0, mid: 1.2, high: 2.0 },
    source: 'LocaliQ 2025 (Storage CVR 4.65%, CPL $120.30) + one-time purchase industry baseline'
  },
  'photography': {
    landing_page_cvr: { low: 0.04, mid: 0.07, high: 0.10 },
    avg_cpl: { low: 40, mid: 70, high: 110 },
    close_rate: { low: 0.15, mid: 0.22, high: 0.35 },
    retention_multiplier: { low: 1.0, mid: 1.5, high: 2.0 },
    source: 'WordStream 2025 (Personal Services CVR 9.74%, CPL $53.52) + one-time purchase w/ referral multiplier'
  },
  'wedding': {
    landing_page_cvr: { low: 0.04, mid: 0.07, high: 0.10 },
    avg_cpl: { low: 40, mid: 70, high: 110 },
    close_rate: { low: 0.12, mid: 0.20, high: 0.30 },
    retention_multiplier: { low: 1.0, mid: 1.2, high: 1.5 },
    source: 'WordStream 2025 (Personal Services CVR 9.74%) + one-time purchase industry (referral-driven repeat)'
  },
  'beauty': {
    landing_page_cvr: { low: 0.05, mid: 0.08, high: 0.12 },
    avg_cpl: { low: 35, mid: 60, high: 95 },
    close_rate: { low: 0.20, mid: 0.30, high: 0.45 },
    retention_multiplier: { low: 3.0, mid: 5.0, high: 8.0 },
    source: 'WordStream 2025 (Beauty & Personal Care CVR 7.82%, CPL $60.34) + recurring appointment model'
  },
  '_default': {
    landing_page_cvr: { low: 0.04, mid: 0.075, high: 0.11 },
    avg_cpl: { low: 40, mid: 70, high: 120 },
    close_rate: { low: 0.12, mid: 0.20, high: 0.30 },
    retention_multiplier: { low: 1.5, mid: 3.0, high: 6.0 },
    source: 'WordStream 2025 all-industry avg (CVR 7.52%, CPL $70.11) + First Page Sage 2026 + Focus Digital 2025'
  }
};

// Category aliases — maps _detectBusinessCategory() outputs and common industry strings to benchmark keys
var _BENCHMARK_ALIASES = {
  'trades': 'home services', 'professional': 'consulting', 'agency': 'marketing agency',
  'healthcare': 'medical', 'health': 'medical', 'finance': 'financial services',
  'law': 'legal', 'attorney': 'legal', 'lawyer': 'legal', 'personal injury': 'legal', 'family law': 'legal',
  'contractor': 'construction', 'general contractor': 'construction', 'renovation': 'construction',
  'flooring': 'construction', 'painting': 'construction',
  'pest control': 'home services', 'handyman': 'home services',
  'maid': 'cleaning', 'janitorial': 'cleaning', 'carpet cleaning': 'cleaning',
  'therapy': 'medical', 'chiropractic': 'medical', 'physiotherapy': 'medical',
  'optometry': 'medical', 'pharmacy': 'medical',
  'veterinary': 'pet services', 'vet': 'pet services', 'grooming': 'pet services', 'dog': 'pet services',
  'wealth management': 'financial services', 'mortgage': 'financial services', 'banking': 'financial services',
  'bookkeeping': 'accounting', 'tax': 'accounting', 'cpa': 'accounting',
  'web design': 'marketing agency', 'digital marketing': 'marketing agency', 'seo': 'marketing agency',
  'it services': 'consulting', 'technology': 'saas', 'software': 'saas', 'fintech': 'saas',
  'retail': 'ecommerce', 'online store': 'ecommerce', 'shopify': 'ecommerce',
  'food': 'restaurant', 'catering': 'restaurant', 'cafe': 'restaurant', 'bakery': 'restaurant',
  'gym': 'fitness', 'wellness': 'fitness', 'spa': 'fitness', 'yoga': 'fitness', 'pilates': 'fitness',
  'property management': 'real estate', 'realtor': 'real estate',
  'auto body': 'auto repair', 'mechanic': 'auto repair', 'car repair': 'auto repair',
  'car dealer': 'automotive', 'dealership': 'automotive',
  'storage': 'moving', 'relocation': 'moving',
  'videography': 'photography', 'photographer': 'photography',
  'event planning': 'wedding', 'event planner': 'wedding', 'bridal': 'wedding',
  'salon': 'beauty', 'barbershop': 'beauty', 'aesthetics': 'beauty', 'cosmetics': 'beauty', 'hair': 'beauty',
  'industrial': 'manufacturing', 'fabrication': 'manufacturing',
  'school': 'education', 'university': 'education', 'tutoring': 'education', 'training': 'education'
};

function _matchIndustryBenchmark(industry) {
  if (!industry) return INDUSTRY_BENCHMARKS['_default'];
  var key = industry.toLowerCase().trim();
  // Exact match
  if (INDUSTRY_BENCHMARKS[key]) return INDUSTRY_BENCHMARKS[key];
  // Alias match
  if (_BENCHMARK_ALIASES[key]) return INDUSTRY_BENCHMARKS[_BENCHMARK_ALIASES[key]];
  // Substring match — check if industry contains any benchmark key
  var keys = Object.keys(INDUSTRY_BENCHMARKS).filter(function(k) { return k !== '_default'; });
  for (var i = 0; i < keys.length; i++) {
    if (key.indexOf(keys[i]) >= 0 || keys[i].indexOf(key) >= 0) return INDUSTRY_BENCHMARKS[keys[i]];
  }
  // Alias substring match
  var aliasKeys = Object.keys(_BENCHMARK_ALIASES);
  for (var j = 0; j < aliasKeys.length; j++) {
    if (key.indexOf(aliasKeys[j]) >= 0) return INDUSTRY_BENCHMARKS[_BENCHMARK_ALIASES[aliasKeys[j]]];
  }
  return INDUSTRY_BENCHMARKS['_default'];
}

// ── Benchmark Table Viewer + CSV Download ────────────────────────────
function showBenchmarkTable() {
  var matched = (S.research || {}).industry ? _matchIndustryBenchmark(S.research.industry) : null;
  var matchedKey = '';
  if (matched) {
    var keys = Object.keys(INDUSTRY_BENCHMARKS);
    for (var ki = 0; ki < keys.length; ki++) {
      if (INDUSTRY_BENCHMARKS[keys[ki]] === matched) { matchedKey = keys[ki]; break; }
    }
  }
  var html = '<div style="max-height:70vh;overflow:auto">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
  html += '<div style="font-size:11px;color:var(--n2)">All benchmarks sourced from published reports. See source column for citations.</div>';
  html += '<button class="btn btn-ghost" onclick="downloadBenchmarkCSV()" style="font-size:11px;padding:4px 10px"><i class="ti ti-download" style="font-size:11px"></i> Download CSV</button>';
  html += '</div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html += '<thead><tr style="border-bottom:2px solid var(--border);position:sticky;top:0;background:var(--bg)">'
    + '<th style="text-align:left;padding:6px 8px;font-weight:600">Industry</th>'
    + '<th style="padding:6px 8px;font-weight:600;text-align:center" colspan="3">Landing Page CVR</th>'
    + '<th style="padding:6px 8px;font-weight:600;text-align:center" colspan="3">Avg CPL (USD)</th>'
    + '<th style="padding:6px 8px;font-weight:600;text-align:center" colspan="3">Close Rate</th>'
    + '<th style="padding:6px 8px;font-weight:600;text-align:center" colspan="3">Retention Mult.</th>'
    + '<th style="text-align:left;padding:6px 8px;font-weight:600;max-width:250px">Source</th>'
    + '</tr>';
  html += '<tr style="border-bottom:1px solid var(--border)">'
    + '<th></th>'
    + '<th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">Low</th><th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">Mid</th><th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">High</th>'
    + '<th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">Low</th><th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">Mid</th><th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">High</th>'
    + '<th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">Low</th><th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">Mid</th><th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">High</th>'
    + '<th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">Low</th><th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">Mid</th><th style="padding:3px 6px;font-size:9px;color:var(--n2);font-weight:400">High</th>'
    + '<th></th></tr></thead><tbody>';
  var sortedKeys = Object.keys(INDUSTRY_BENCHMARKS).filter(function(k) { return k !== '_default'; }).sort();
  sortedKeys.push('_default');
  sortedKeys.forEach(function(k) {
    var b = INDUSTRY_BENCHMARKS[k];
    var isMatched = k === matchedKey;
    var rowStyle = isMatched ? 'background:rgba(59,130,246,0.08);font-weight:500' : '';
    var label = k === '_default' ? 'All Industries (default)' : k.charAt(0).toUpperCase() + k.slice(1);
    html += '<tr style="border-bottom:1px solid var(--border);' + rowStyle + '">';
    html += '<td style="padding:5px 8px;white-space:nowrap">' + (isMatched ? '\u2714 ' : '') + esc(label) + '</td>';
    html += '<td style="padding:5px 6px;text-align:center">' + (b.landing_page_cvr.low*100) + '%</td>';
    html += '<td style="padding:5px 6px;text-align:center;font-weight:600">' + (b.landing_page_cvr.mid*100) + '%</td>';
    html += '<td style="padding:5px 6px;text-align:center">' + (b.landing_page_cvr.high*100) + '%</td>';
    html += '<td style="padding:5px 6px;text-align:center">$' + b.avg_cpl.low + '</td>';
    html += '<td style="padding:5px 6px;text-align:center;font-weight:600">$' + b.avg_cpl.mid + '</td>';
    html += '<td style="padding:5px 6px;text-align:center">$' + b.avg_cpl.high + '</td>';
    html += '<td style="padding:5px 6px;text-align:center">' + (b.close_rate.low*100) + '%</td>';
    html += '<td style="padding:5px 6px;text-align:center;font-weight:600">' + (b.close_rate.mid*100) + '%</td>';
    html += '<td style="padding:5px 6px;text-align:center">' + (b.close_rate.high*100) + '%</td>';
    html += '<td style="padding:5px 6px;text-align:center">' + b.retention_multiplier.low + 'x</td>';
    html += '<td style="padding:5px 6px;text-align:center;font-weight:600">' + b.retention_multiplier.mid + 'x</td>';
    html += '<td style="padding:5px 6px;text-align:center">' + b.retention_multiplier.high + 'x</td>';
    html += '<td style="padding:5px 8px;font-size:9px;color:var(--n2);max-width:250px;line-height:1.3">' + esc(b.source) + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  // Show in modal
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:599;display:flex;align-items:center;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) document.body.removeChild(overlay); };
  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg);border-radius:12px;padding:24px;max-width:95vw;max-height:85vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,.2)';
  modal.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
    + '<h3 style="margin:0;font-size:16px">Industry Benchmarks Reference</h3>'
    + '<button onclick="this.closest(\'div[style*=position\\:fixed]\').remove()" style="border:none;background:none;cursor:pointer;font-size:18px;color:var(--n2)">\u2715</button>'
    + '</div>' + html;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  // ESC to close
  var escHandler = function(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
}

function downloadBenchmarkCSV() {
  var rows = [['Industry','CVR Low','CVR Mid','CVR High','CPL Low (USD)','CPL Mid (USD)','CPL High (USD)','Close Rate Low','Close Rate Mid','Close Rate High','Retention Low','Retention Mid','Retention High','Source']];
  var keys = Object.keys(INDUSTRY_BENCHMARKS).filter(function(k) { return k !== '_default'; }).sort();
  keys.push('_default');
  keys.forEach(function(k) {
    var b = INDUSTRY_BENCHMARKS[k];
    var label = k === '_default' ? 'All Industries (default)' : k.charAt(0).toUpperCase() + k.slice(1);
    rows.push([label,
      (b.landing_page_cvr.low*100)+'%', (b.landing_page_cvr.mid*100)+'%', (b.landing_page_cvr.high*100)+'%',
      '$'+b.avg_cpl.low, '$'+b.avg_cpl.mid, '$'+b.avg_cpl.high,
      (b.close_rate.low*100)+'%', (b.close_rate.mid*100)+'%', (b.close_rate.high*100)+'%',
      b.retention_multiplier.low+'x', b.retention_multiplier.mid+'x', b.retention_multiplier.high+'x',
      '"' + b.source.replace(/"/g, '""') + '"'
    ]);
  });
  var csv = rows.map(function(r) { return r.join(','); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'setsailos-industry-benchmarks.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  aiBarNotify('Benchmark CSV downloaded', { duration: 2000 });
}

var STRATEGY_SECTION_WEIGHTS = {
  audience:     0.10,
  positioning:  0.18,
  economics:    0.14,
  subtraction:  0.12,
  channels:     0.22,
  execution:    0.10,
  brand:        0.10,
  risks:        0.10,
  narrative:    0.08,
  sales:        0.00
};

var STRATEGY_SECTION_LABELS = {
  audience:     'Audience Intelligence',
  positioning:  'Positioning',
  economics:    'Unit Economics',
  subtraction:  'Subtraction Analysis',
  channels:     'Channels & Growth',
  growth:       'Growth Plan',           // kept for backwards-compat (merged into channels tab)
  execution:    'Website & CRO',
  brand:        'Content & Authority',
  risks:        'Risk Assessment',
  narrative:    'Narrative & Messaging',
  sales:        'Sales Intelligence'
};

// Required inputs per section — for data completeness scoring
var STRATEGY_REQUIRED_INPUTS = {
  audience: [
    { key:'audience_desc',        path:'S.research.primary_audience_description',  check:'string' },
    { key:'buyer_roles',          path:'S.research.buyer_roles_titles',            check:'array' },
    { key:'pain_points',          path:'S.research.pain_points_top5',              check:'array' },
    { key:'objections',           path:'S.research.objections_top5',               check:'array' },
    { key:'best_customers',       path:'S.research.best_customer_examples',        check:'string' },
    { key:'geography',            path:'S.research.geography',                     check:'truthy' },
    { key:'sales_cycle',          path:'S.research.sales_cycle_length',            check:'string' },
    { key:'deal_size',            path:'S.research.average_deal_size',             check:'string' },
    { key:'industry',             path:'S.research.industry',                      check:'string' },
    { key:'strategy_doc',         path:'S.setup.strategy||S.setup.discoveryNotes||S.setup.docs', check:'any_doc' }
  ],
  positioning: [
    { key:'competitors',          path:'S.research.competitors',            check:'array_min_2' },
    { key:'services_detail',      path:'S.research.services_detail',        check:'array' },
    { key:'pain_points_top5',     path:'S.research.pain_points_top5',       check:'array' },
    { key:'best_customer_examples', path:'S.research.best_customer_examples', check:'string' },
    { key:'existing_proof',       path:'S.research.existing_proof',         check:'array' },
    { key:'competitor_deep_dive', path:'S.strategy._enrichment.competitor_deep_dive', check:'truthy' },
    { key:'strategy_doc',         path:'S.setup.strategy||S.setup.discoveryNotes||S.setup.docs', check:'any_doc' },
    { key:'industry',             path:'S.research.industry',               check:'string' }
  ],
  economics: [
    { key:'budget',               path:'S.research.monthly_marketing_budget', check:'string' },
    { key:'deal_size',            path:'S.research.average_deal_size',       check:'string' },
    { key:'close_rate',           path:'S.research.close_rate_estimate',     check:'string' },
    { key:'ltv',                  path:'S.research.customer_lifetime_value', check:'string' },
    { key:'lead_quality',         path:'S.research.lead_quality_percentage', check:'string' },
    { key:'goal',                 path:'S.research.primary_goal',            check:'string' },
    { key:'cpc_data',             path:'S.strategy._enrichment.cpc_estimates', check:'truthy',
      altPath:'S.kwResearch.keywords', altCheck:'array' }
  ],
  subtraction: [
    { key:'current_activities',   path:'S.research.current_marketing_activities', check:'array' },
    { key:'budget',               path:'S.research.monthly_marketing_budget', check:'string' },
    { key:'pain_points',          path:'S.research.pain_points_top5',         check:'array' },
    { key:'lead_channels',        path:'S.research.lead_channels_today',      check:'array' },
    { key:'unit_economics',       path:'S.strategy.unit_economics',           check:'truthy' },
    { key:'current_pricing',      path:'S.research.current_pricing',          check:'string' }
  ],
  channels: [
    { key:'unit_economics',       path:'S.strategy.unit_economics',          check:'truthy' },
    { key:'budget',               path:'S.research.monthly_marketing_budget', check:'string' },
    { key:'audience',             path:'S.research.primary_audience_description', check:'string' },
    { key:'lead_channels',        path:'S.research.lead_channels_today',     check:'array' },
    { key:'industry',             path:'S.research.industry',                check:'string' },
    { key:'geography',            path:'S.research.geography',               check:'truthy' },
    { key:'cpc_estimates',        path:'S.strategy._enrichment.cpc_estimates', check:'truthy' },
    { key:'sales_cycle',          path:'S.research.sales_cycle_length',      check:'string' },
    { key:'goal',                 path:'S.research.primary_goal',            check:'string' },
    // Merged from growth tab
    { key:'channel_strategy',     path:'S.strategy.channel_strategy',        check:'truthy' },
    { key:'capacity',             path:'S.research.capacity_constraints',    check:'string' },
    { key:'team_size',            path:'S.research.team_size',               check:'string' }
  ],
  execution: [
    { key:'has_service_pages',    path:'S.research.has_service_pages',        check:'string' },
    { key:'has_blog',             path:'S.research.has_blog',                 check:'string' },
    { key:'booking_flow',         path:'S.research.booking_flow_description', check:'string' },
    { key:'audience',             path:'S.research.primary_audience_description', check:'string' },
    { key:'current_presence',     path:'S.strategy._enrichment.current_presence', check:'truthy' },
    { key:'services_detail',      path:'S.research.services_detail',          check:'array' }
  ],
  brand: [
    { key:'competitors',          path:'S.research.competitors',              check:'array' },
    { key:'competitor_deep_dive', path:'S.strategy._enrichment.competitor_deep_dive', check:'truthy' },
    { key:'industry',             path:'S.research.industry',                 check:'string' },
    { key:'team_size',            path:'S.research.team_size',                check:'string' },
    { key:'keyword_pre_scan',     path:'S.strategy._enrichment.keyword_pre_scan', check:'truthy' }
  ],
  risks: [
    { key:'unit_economics',       path:'S.strategy.unit_economics',           check:'truthy' },
    { key:'channel_strategy',     path:'S.strategy.channel_strategy',         check:'truthy' },
    { key:'sales_cycle',          path:'S.research.sales_cycle_length',       check:'string' },
    { key:'team_size',            path:'S.research.team_size',                check:'string' },
    { key:'competitors',          path:'S.research.competitors',              check:'array' }
  ],
  narrative: [
    { key:'audience',             path:'S.strategy.audience',                 check:'truthy' },
    { key:'positioning',          path:'S.strategy.positioning',              check:'truthy' },
    { key:'pain_points',          path:'S.research.pain_points_top5',         check:'array' }
  ],
  sales: [
    { key:'narrative',            path:'S.strategy.narrative',                check:'truthy' },
    { key:'audience',             path:'S.strategy.audience',                 check:'truthy' },
    { key:'positioning',          path:'S.strategy.positioning',              check:'truthy' },
    { key:'unit_economics',       path:'S.strategy.unit_economics',           check:'truthy' }
  ]
};

// Anti-inflation score caps
var ANTI_INFLATION_CAPS = [
  { condition:'no_validated_differentiators', section:'positioning', dimension:'confidence', cap:6,
    test: function() { return !S.strategy || !S.strategy.positioning || !S.strategy.positioning.validated_differentiators || !S.strategy.positioning.validated_differentiators.length; } },
  { condition:'estimated_close_rate', section:'economics', dimension:'data', cap:7,
    test: function() { var r=S.research||{}; return !r.close_rate_estimate || r.close_rate_estimate.indexOf('estimate')>=0 || r.close_rate_estimate.indexOf('~')>=0; } },
  { condition:'no_cpc_data_econ', section:'economics', dimension:'confidence', cap:6,
    test: function() { var e=S.strategy&&S.strategy._enrichment||{}; var kw=S.kwResearch||{}; return !e.cpc_estimates && (!kw.keywords || kw.keywords.filter(function(k){return k.cpc>0||k.high_bid>0;}).length < 3); } },
  { condition:'no_cpc_data', section:'channels', dimension:'confidence', cap:6,
    test: function() { return !S.strategy || !S.strategy._enrichment || !S.strategy._enrichment.cpc_estimates; } },
  { condition:'no_fathom_transcript', section:'_all', dimension:'specificity', cap:6,
    test: function() { var s=S.setup||{}; return !s.docs || !s.docs.length; } },
  { condition:'few_competitors', section:'positioning', dimension:'confidence', cap:5,
    test: function() { var r=S.research||{}; return !r.competitors || r.competitors.length < 3; } },
  { condition:'no_analytics', section:'execution', dimension:'data', cap:5,
    test: function() { return true; /* no GA/GSC integration yet */ } },
  { condition:'website_only_voice', section:'brand', dimension:'confidence', cap:5,
    test: function() { var s=S.setup||{}; return !s.strategy && (!s.docs || !s.docs.length); } },
  { condition:'no_dr_data', section:'brand', dimension:'data', cap:5,
    test: function() { var bs=S.strategy&&S.strategy.brand_strategy||{}; return !bs.dr_gap_analysis || !bs.dr_gap_analysis.client_dr; } },
  { condition:'team_size_unknown_brand', section:'brand', dimension:'confidence', cap:6,
    test: function() { var r=S.research||{}; return !r.team_size; } },
  { condition:'no_activities_data', section:'subtraction', dimension:'data', cap:4,
    test: function() { var r=S.research||{}; return !r.current_marketing_activities || !r.current_marketing_activities.length; } },
  { condition:'no_subtraction', section:'_overall', dimension:'_cap', cap:7.0,
    test: function() { return !S.strategy || !S.strategy.subtraction || !S.strategy.subtraction.current_activities_audit || !S.strategy.subtraction.current_activities_audit.length; } },
  { condition:'d8_insufficient', section:'channels', dimension:'confidence', cap:5,
    test: function() { return S.strategy && S.strategy.demand_validation && S.strategy.demand_validation.overall_verdict === 'insufficient'; } },
  { condition:'d8_high_severity', section:'_overall', dimension:'_cap', cap:6.5,
    test: function() {
      if (!S.strategy || !S.strategy.demand_validation || !S.strategy.demand_validation.strategic_revisions_needed) return false;
      return S.strategy.demand_validation.strategic_revisions_needed.some(function(r) { return r.impact_severity === 'high'; });
    } },
  // Narrative: no StoryBrand means messaging is unstructured
  { condition:'no_narrative', section:'narrative', dimension:'confidence', cap:0,
    test: function() { return !S.strategy || !S.strategy.narrative || !S.strategy.narrative.storybrand; } },
  { condition:'weak_narrative', section:'narrative', dimension:'confidence', cap:5,
    test: function() { return S.strategy && S.strategy.narrative && S.strategy.narrative.storybrand && (!S.strategy.narrative.messaging_pillars || S.strategy.narrative.messaging_pillars.length < 2); } },
  // Channels: no channel strategy means growth plan is baseless
  { condition:'no_channel_strategy_growth', section:'channels', dimension:'confidence', cap:3,
    test: function() { return !S.strategy || !S.strategy.channel_strategy || !S.strategy.channel_strategy.levers || !S.strategy.channel_strategy.levers.length; } },
  // Channels: no funnel architecture means gaps in coverage
  { condition:'no_funnel_arch', section:'channels', dimension:'data', cap:6,
    test: function() { var gp = S.strategy && S.strategy.growth_plan || {}; return !gp.funnel_architecture; } },
  // Risks: no high-severity mitigations is a gap
  { condition:'high_risk_unmitigated', section:'risks', dimension:'confidence', cap:5,
    test: function() { var r = S.strategy && S.strategy.risks || {}; if (!r.risks) return false; return r.risks.some(function(ri) { return ri.severity >= 7 && (!ri.mitigation || ri.mitigation.length < 10); }); } },
  // Cross-check: budget mismatch between economics and channels
  { condition:'budget_mismatch', section:'channels', dimension:'data', cap:6,
    test: function() {
      var ue = S.strategy && S.strategy.unit_economics || {};
      var cs = S.strategy && S.strategy.channel_strategy || {};
      var ba = cs.budget_allocation || {};
      if (!ue.monthly_budget || !ba.total_monthly) return false;
      var econBudget = parseFloat(String(ue.monthly_budget).replace(/[^0-9.]/g, '')) || 0;
      var chanBudget = parseFloat(String(ba.total_monthly).replace(/[^0-9.]/g, '')) || 0;
      if (econBudget === 0 || chanBudget === 0) return false;
      var ratio = chanBudget / econBudget;
      return ratio < 0.5 || ratio > 2.0; // flag if budgets differ by more than 2x
    } },
  // Low audit pass rate caps overall confidence
  { condition:'low_audit_pass_rate', section:'_overall', dimension:'_cap', cap:7.0,
    test: function() {
      var au = S.strategy && S.strategy._audit || {};
      var totalPass = 0; var totalChecks = 0;
      if (au[0]) { totalPass += au[0].pass; totalChecks += au[0].total; }
      for (var d = 1; d <= 9; d++) { if (au[d]) { totalPass += au[d].pass; totalChecks += au[d].total; } }
      if (totalChecks < 10) return false; // not enough data
      return (totalPass / totalChecks) < 0.6;
    } },
  // Hard caps — missing manual inputs
  { condition:'no_close_rate_provided', section:'economics', dimension:'data', cap:6,
    test: function() { var r = S.research || {}; return !r.close_rate_estimate || r.close_rate_estimate === 'UNKNOWN'; } },
  { condition:'audience_below_5_overall', section:'_overall', dimension:'_cap', cap:6.0,
    test: function() {
      if (!S.strategy || !S.strategy.audience || !S.strategy.audience.segments) return false;
      var audScore = scoreSection('audience');
      return audScore.score < 5.0;
    } },
  // Audience caps — segment quality gate
  { condition:'no_audience_data', section:'audience', dimension:'data', cap:5,
    test: function() {
      var a = S.strategy && S.strategy.audience || {};
      return !a.segments || !a.segments.length;
    } },
  { condition:'no_buying_motions', section:'audience', dimension:'confidence', cap:6,
    test: function() {
      var a = S.strategy && S.strategy.audience || {};
      return !a.buying_motions || !a.buying_motions.length;
    } },
  { condition:'generic_personas', section:'audience', dimension:'specificity', cap:5,
    test: function() {
      var a = S.strategy && S.strategy.audience || {};
      if (!a.personas || a.personas.length < 2) return true;
      // Check if persona names are too generic
      var generic = ['Decision Maker', 'Buyer', 'Customer', 'User', 'Manager'];
      return a.personas.every(function(p) {
        return generic.some(function(g) { return (p.name || '').indexOf(g) >= 0; });
      });
    } },
  { condition:'over_targeted_audience', section:'audience', dimension:'confidence', cap:6.5,
    test: function() {
      var a = S.strategy && S.strategy.audience || {};
      return a.segments && a.segments.length > 6;
    } },
  // Positioning Direction caps — founder alignment gate
  { condition:'no_hypotheses_no_direction', section:'positioning', dimension:'data', cap:5,
    test: function() {
      var p = S.strategy && S.strategy.positioning || {};
      return (!p.hypotheses_input || !p.hypotheses_input.length) && !p.selected_direction;
    } },
  { condition:'hypotheses_no_direction', section:'positioning', dimension:'confidence', cap:6.5,
    test: function() {
      var p = S.strategy && S.strategy.positioning || {};
      return p.hypothesis_evaluations && p.hypothesis_evaluations.length > 0 && !p.selected_direction;
    } },
  { condition:'low_provability_direction', section:'positioning', dimension:'specificity', cap:6,
    test: function() {
      var p = S.strategy && S.strategy.positioning || {};
      if (!p.selected_direction) return false;
      var dir = p.selected_direction;
      if (dir.provability_score && dir.provability_score < 5) return true;
      // Check if it came from a hypothesis eval with low provability
      if (dir._source_hypothesis && p.hypothesis_evaluations) {
        var match = p.hypothesis_evaluations.find(function(h) { return h.hypothesis === dir._source_hypothesis; });
        if (match && match.scores && match.scores.provability < 5) return true;
      }
      return false;
    } }
];

// ── Audit Checks (per diagnostic) ─────────────────────────────────────
// Programmatic quality checks run after each diagnostic generation.
// Each check returns true (pass) or false (fail).

var STRATEGY_AUDIT_CHECKS = {
  0: [ // D0: Audience Intelligence
    { id:'has_segments',      label:'At least 2 audience segments identified',     check: function(d) { return d.segments && d.segments.length >= 2; } },
    { id:'segment_sizing',    label:'Segments have estimated sizing',              check: function(d) { return d.segments && d.segments.some(function(s) { return s.market_size || s.estimated_size; }); } },
    { id:'has_personas',      label:'Persona profiles defined',                    check: function(d) { return d.personas && d.personas.length >= 2; } },
    { id:'persona_specificity',label:'Personas have specific job titles/roles',    check: function(d) { return d.personas && d.personas.every(function(p) { return p.role && p.role.length > 5; }); } },
    { id:'has_buying_motions',label:'Buying motions mapped',                       check: function(d) { return d.buying_motions && d.buying_motions.length >= 2; } },
    { id:'has_triggers',      label:'Purchase triggers identified',                check: function(d) { return d.purchase_triggers && d.purchase_triggers.length >= 2; } },
    { id:'has_objections',    label:'Objection handling mapped to segments',       check: function(d) { return d.objection_map && d.objection_map.length >= 2; } },
    { id:'has_validation',    label:'Segment validation criteria defined',         check: function(d) { return d.validation && (d.validation.primary_segment || d.validation.recommended_focus); } },
    { id:'has_perceived_alternatives', label:'Perceived alternatives mapped (3+)', check: function(d) { return d.perceived_alternatives && d.perceived_alternatives.length >= 3; } }
  ],
  1: [ // D1: Unit Economics
    { id:'has_max_cpl',       label:'Max allowable CPL calculated',           check: function(d) { return d.max_allowable_cpl > 0; } },
    { id:'has_ltv_cac',       label:'LTV:CAC ratio calculated',               check: function(d) { return !!d.ltv_cac_ratio; } },
    { id:'has_cac',           label:'Customer acquisition cost estimated',     check: function(d) { return d.estimated_cac > 0; } },
    { id:'budget_real',       label:'Uses client-provided budget (not assumed)', check: function(d) { var r = S.research || {}; return !!r.monthly_marketing_budget && (!d.assumptions || !d.assumptions.some(function(a) { return a.toLowerCase().indexOf('budget') >= 0; })); } },
    { id:'has_recommendation',label:'Actionable recommendation provided',      check: function(d) { return d.recommendation && d.recommendation.length > 50; } },
    { id:'paid_assessed',     label:'Paid media viability assessed',           check: function(d) { return d.paid_media_viable !== undefined; } },
    { id:'health_assessed',   label:'LTV:CAC health rated',                    check: function(d) { return !!d.ltv_cac_health; } },
    { id:'cpc_grounded',      label:'CPC data used to ground estimates',       check: function(d) { return d.market_cpc_summary && d.market_cpc_summary.data_source && d.market_cpc_summary.data_source !== 'assumption'; } }
  ],
  2: [ // D2: Competitive Position
    { id:'names_competitors', label:'Names specific competitors',              check: function(d) { return d.competitive_counter && d.competitive_counter.length > 20; } },
    { id:'has_differentiators',label:'Validated differentiators identified',   check: function(d) { return d.validated_differentiators && d.validated_differentiators.length >= 2; } },
    { id:'has_positioning',   label:'Positioning angle defined',               check: function(d) { return d.recommended_positioning_angle && d.recommended_positioning_angle.length > 10; } },
    { id:'has_value_prop',    label:'Core value proposition written',          check: function(d) { return d.core_value_proposition && d.core_value_proposition.length > 20; } },
    { id:'has_voice',         label:'Brand voice direction specified',         check: function(d) { return d.brand_voice_direction && d.brand_voice_direction.style; } },
    { id:'has_messaging',     label:'Messaging hierarchy defined',            check: function(d) { return d.messaging_hierarchy && d.messaging_hierarchy.primary_message; } },
    { id:'rejected_tested',   label:'Contested differentiators analysed',      check: function(d) { return (d.contested_differentiators && d.contested_differentiators.length >= 1) || (d.rejected_differentiators && d.rejected_differentiators.length >= 1); } },
    { id:'proof_plan',        label:'Proof-building strategy included',       check: function(d) { return d.proof_strategy && d.proof_strategy.length >= 1; } },
    { id:'has_category_perception', label:'Category perception gap assessed', check: function(d) { return d.category_perception && d.category_perception.buyer_frame && d.category_perception.reframing_language; } }
  ],
  3: [ // D3: Subtraction Analysis
    { id:'has_audit',         label:'Current activities audited with costs',   check: function(d) { return d.current_activities_audit && d.current_activities_audit.length >= 1; } },
    { id:'has_verdicts',      label:'Each activity has a verdict',            check: function(d) { return d.current_activities_audit && d.current_activities_audit.every(function(a) { return a.verdict === 'cut' || a.verdict === 'keep' || a.verdict === 'restructure'; }); } },
    { id:'has_costs',         label:'Cost estimates for activities',          check: function(d) { return d.current_activities_audit && d.current_activities_audit.some(function(a) { return a.monthly_cost > 0; }); } },
    { id:'has_recoverable',   label:'Recoverable budget calculated',          check: function(d) { return d.total_recoverable_monthly > 0; } },
    { id:'has_redirects',     label:'Redirect recommendations provided',      check: function(d) { return d.redirect_recommendations && d.redirect_recommendations.length >= 1; } },
    { id:'has_assumptions',   label:'Assumptions stated explicitly',          check: function(d) { return d.recovery_assumptions && d.recovery_assumptions.length >= 1; } },
    { id:'has_summary',       label:'Subtraction summary written',           check: function(d) { return d.subtraction_summary && d.subtraction_summary.length > 30; } },
    { id:'confidence_set',    label:'Confidence level assessed',              check: function(d) { return d.total_recoverable_confidence === 'high' || d.total_recoverable_confidence === 'medium' || d.total_recoverable_confidence === 'low'; } }
  ],
  4: [ // D4: Channel & Lever Viability
    { id:'all_levers',        label:'All 13 levers scored',                   check: function(d) { return d.levers && d.levers.length >= 12; } },
    { id:'priority_order',    label:'Priority order specified',               check: function(d) { return d.priority_order && d.priority_order.length >= 3; } },
    { id:'budget_alloc',      label:'Budget allocation provided',             check: function(d) { return d.budget_allocation && d.budget_allocation.total_monthly > 0; } },
    { id:'budget_sums',       label:'Budget percentages sum to ~100%',        check: function(d) { if (!d.levers) return false; var sum = d.levers.reduce(function(s, l) { return s + (l.budget_allocation_pct || 0); }, 0); return sum >= 90 && sum <= 110; } },
    { id:'funnel_complete',   label:'All funnel stages covered',             check: function(d) { if (!d.funnel_coverage) return false; return ['awareness','consideration','conversion'].every(function(s) { return d.funnel_coverage[s] && d.funnel_coverage[s].covered; }); } },
    { id:'gaps_flagged',      label:'Funnel gaps identified or none exist',   check: function(d) { return d.funnel_gaps_flagged !== undefined; } },
    { id:'not_recommended',   label:'Not-recommended levers explained',      check: function(d) { return d.levers_not_recommended && d.levers_not_recommended.length >= 1; } }
  ],
  5: [ // D5: Website & CRO
    { id:'build_type',        label:'Build type determined',                  check: function(d) { return !!d.build_type; } },
    { id:'primary_cta',       label:'Primary CTA defined',                   check: function(d) { return !!d.primary_cta; } },
    { id:'form_strategy',     label:'Form strategy included',                check: function(d) { return d.form_strategy && d.form_strategy.primary_form_purpose; } },
    { id:'architecture',      label:'Page architecture specified',           check: function(d) { return d.architecture_direction && d.architecture_direction.page_types_needed && d.architecture_direction.page_types_needed.length >= 2; } },
    { id:'tracking',          label:'Tracking requirements listed',          check: function(d) { return d.tracking_requirements && d.tracking_requirements.length >= 1; } },
    { id:'secondary_ctas',    label:'Secondary CTAs defined',                check: function(d) { return d.secondary_ctas && d.secondary_ctas.length >= 1; } }
  ],
  6: [ // D6: Content & Authority
    { id:'pillars',           label:'Content pillars defined',               check: function(d) { return d.content_pillars && d.content_pillars.length >= 2; } },
    { id:'velocity',          label:'Content velocity recommended',          check: function(d) { return !!d.content_velocity; } },
    { id:'content_mix',       label:'Content mix breakdown provided',        check: function(d) { return d.content_mix && d.content_mix.length >= 2; } },
    { id:'dr_gap',            label:'Domain authority gap analysed',         check: function(d) { return d.dr_gap_analysis && d.dr_gap_analysis.dr_gap; } },
    { id:'dr_competitors',    label:'Competitor DR data included',           check: function(d) { return d.dr_gap_analysis && d.dr_gap_analysis.competitor_drs && d.dr_gap_analysis.competitor_drs.length >= 1; } },
    { id:'authority_timeline',label:'Authority building timeline defined',   check: function(d) { return d.authority_timeline && d.authority_timeline.length >= 2; } },
    { id:'quick_wins',        label:'Quick wins identified',                check: function(d) { return d.quick_wins && d.quick_wins.length >= 2; } },
    { id:'authority',         label:'Authority-building strategy included',  check: function(d) { return d.authority_building && d.authority_building.length > 20; } },
    { id:'local_seo',         label:'Local SEO priority assessed',           check: function(d) { return !!d.local_seo_priority; } },
    { id:'geo_strategy',      label:'Geo-targeting strategy included',       check: function(d) { return d.geo_targeting_strategy && d.geo_targeting_strategy.length > 10; } }
  ],
  7: [ // D7: Risk Assessment
    { id:'all_risks',         label:'All 8 risk categories scored',          check: function(d) { return d.risks && d.risks.length >= 7; } },
    { id:'high_mitigated',    label:'High-severity risks have mitigations',  check: function(d) { if (!d.risks) return false; var high = d.risks.filter(function(r) { return r.severity >= 7; }); return high.every(function(r) { return r.mitigation && r.mitigation.length > 10; }); } },
    { id:'owners_assigned',   label:'Risk owners assigned',                  check: function(d) { if (!d.risks) return false; return d.risks.every(function(r) { return !!r.owner; }); } },
    { id:'confidence_set',    label:'Overall confidence assessed',           check: function(d) { return !!d.overall_confidence; } },
    { id:'reasoning',         label:'Confidence reasoning provided',         check: function(d) { return d.confidence_reasoning && d.confidence_reasoning.length > 20; } }
  ],
  8: [ // D8: Narrative & Messaging
    { id:'has_storybrand', label:'StoryBrand arc complete', check: function(d) { return d.storybrand && d.storybrand.hero && d.storybrand.external_problem && d.storybrand.plan && d.storybrand.plan.length >= 3; } },
    { id:'has_pillars', label:'At least 2 messaging pillars', check: function(d) { return d.messaging_pillars && d.messaging_pillars.length >= 2; } },
    { id:'pillar_evidence', label:'Pillars have evidence', check: function(d) { return d.messaging_pillars && d.messaging_pillars.every(function(p) { return p.evidence && p.evidence.length >= 1; }); } },
    { id:'has_objection_map', label:'Objection map populated', check: function(d) { return d.objection_map && d.objection_map.length >= 3; } },
    { id:'has_content_hooks', label:'Content hooks for 3+ stages', check: function(d) { if (!d.content_hooks) return false; var stages = ['unaware','problem_aware','solution_aware','product_aware','most_aware']; var filled = stages.filter(function(s) { return d.content_hooks[s] && d.content_hooks[s].length >= 1; }); return filled.length >= 3; } },
    { id:'has_voc_swipe', label:'VoC swipe file has entries', check: function(d) { return d.voc_swipe_file && d.voc_swipe_file.length >= 3; } },
    { id:'has_entry_point', label:'Recommended entry point set', check: function(d) { return d.recommended_entry_point && d.recommended_entry_point.length > 5; } },
    { id:'has_confidence', label:'Confidence score provided', check: function(d) { return d.confidence !== undefined && d.confidence !== null; } }
  ],
  9: [ // D9: Sales Intelligence
    { id:'has_sales_storybrand', label:'Sales StoryBrand complete', check: function(d) { return d.sales_storybrand && d.sales_storybrand.hero && d.sales_storybrand.external_problem && d.sales_storybrand.plan && d.sales_storybrand.plan.length >= 3; } },
    { id:'has_sales_pillars', label:'At least 3 sales pillars', check: function(d) { return d.sales_pillars && d.sales_pillars.length >= 3; } },
    { id:'has_pitch_angle', label:'Pitch angle defined', check: function(d) { return d.pitch_angle && d.pitch_angle.length > 10; } },
    { id:'has_why_now', label:'Why now articulated', check: function(d) { return d.why_now && d.why_now.length > 10; } },
    { id:'has_sales_objections', label:'Sales objections mapped', check: function(d) { return d.sales_objection_map && d.sales_objection_map.length >= 3; } },
    { id:'has_deal_hooks', label:'Deal stage hooks for 3+ stages', check: function(d) { if (!d.deal_stage_hooks) return false; var stages = ['cold_outreach','discovery','proposal','follow_up','close']; var filled = stages.filter(function(s) { return d.deal_stage_hooks[s] && d.deal_stage_hooks[s].length >= 1; }); return filled.length >= 3; } }
  ]
};

// ── Audit Runner ──────────────────────────────────────────────────────

function auditDiagnostic(num) {
  var checks = STRATEGY_AUDIT_CHECKS[num];
  if (!checks) return null;

  // Get the diagnostic output
  var st = S.strategy || {};
  var data = null;
  if (num === 0) data = st.audience;
  else if (num === 1) data = st.unit_economics;
  else if (num === 2) data = st.positioning;
  else if (num === 3) data = st.subtraction;
  else if (num === 4) data = st.channel_strategy;
  else if (num === 5) data = st.execution_plan && st.execution_plan.lever_details ? st.execution_plan.lever_details.website : null;
  else if (num === 6) data = st.execution_plan && st.execution_plan.lever_details ? st.execution_plan.lever_details.content_marketing : null;
  else if (num === 7) data = st.risks;
  else if (num === 8) data = st.narrative;
  else if (num === 9) data = st.sales_intel;

  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return { diagnostic: num, pass: 0, fail: checks.length, total: checks.length, items: checks.map(function(c) { return { id: c.id, label: c.label, passed: false }; }) };
  }

  var items = [];
  var pass = 0;
  for (var i = 0; i < checks.length; i++) {
    var passed = false;
    try { passed = checks[i].check(data); } catch (e) { passed = false; }
    items.push({ id: checks[i].id, label: checks[i].label, passed: passed });
    if (passed) pass++;
  }

  return { diagnostic: num, pass: pass, fail: checks.length - pass, total: checks.length, items: items, timestamp: new Date().toISOString() };
}

function auditAllDiagnostics() {
  if (!S.strategy) return;
  if (!S.strategy._audit) S.strategy._audit = {};
  // D0 (Audience) + D1-D7
  var d0 = auditDiagnostic(0);
  if (d0) S.strategy._audit[0] = d0;
  for (var d = 1; d <= 9; d++) {
    var result = auditDiagnostic(d);
    if (result) S.strategy._audit[d] = result;
  }
}

// ── Keyword Pipeline Audit ─────────────────────────────────────────────
// Audits each stage of the keyword research pipeline.

var KEYWORD_AUDIT_CHECKS = {
  seeds: [
    { id:'has_seeds',       label:'Seeds generated',                    check: function(kw) { return kw.seeds && kw.seeds.length >= 10; } },
    { id:'seed_diversity',  label:'Seeds cover multiple services',      check: function(kw) { if (!kw.seeds || !kw.seeds.length) return false; var r = S.research || {}; var svcs = (r.primary_services || []).slice(0, 5); if (svcs.length < 2) return true; var covered = 0; svcs.forEach(function(svc) { var sL = svc.toLowerCase().split(' ')[0]; if (kw.seeds.some(function(s) { return s.toLowerCase().indexOf(sL) >= 0; })) covered++; }); return covered >= Math.min(svcs.length, 3); } },
    { id:'ai_seeds',        label:'AI seeds generated',                 check: function(kw) { return kw.seedSources && kw.seedSources.ai && kw.seedSources.ai.length >= 5; } },
    { id:'competitor_seeds', label:'Competitor seeds included',          check: function(kw) { return kw.seedSources && kw.seedSources.competitor && kw.seedSources.competitor.length >= 3; } },
    { id:'geo_seeds',       label:'Seeds include geo modifiers',        check: function(kw) { var geo = ((S.research || {}).geography || {}).primary || (S.setup || {}).geo || ''; var geoL = geo.replace(/,.*$/, '').trim().toLowerCase(); if (!geoL) return true; return kw.seeds && kw.seeds.some(function(s) { return s.toLowerCase().indexOf(geoL) >= 0; }); } }
  ],
  opportunities: [
    { id:'has_keywords',    label:'Keywords fetched with volume data',   check: function(kw) { return kw.keywords && kw.keywords.length >= 20; } },
    { id:'volume_spread',   label:'Keywords span multiple volume ranges', check: function(kw) { if (!kw.keywords || kw.keywords.length < 10) return false; var hi = kw.keywords.filter(function(k) { return k.vol >= 500; }).length; var mid = kw.keywords.filter(function(k) { return k.vol >= 50 && k.vol < 500; }).length; var lo = kw.keywords.filter(function(k) { return k.vol > 0 && k.vol < 50; }).length; return hi >= 1 && mid >= 3 && lo >= 2; } },
    { id:'quick_wins',      label:'Quick wins identified (vol>100, KD<20)', check: function(kw) { if (!kw.keywords) return false; return kw.keywords.filter(function(k) { return k.vol >= 100 && k.kd < 20; }).length >= 2; } },
    { id:'selected',        label:'Keywords selected for clustering',   check: function(kw) { return kw.selected && kw.selected.length >= 15; } },
    { id:'not_over_selected', label:'Selection is focused (under 100)',  check: function(kw) { return !kw.selected || kw.selected.length <= 100; } }
  ],
  clusters: [
    { id:'has_clusters',    label:'Clusters generated',                 check: function(kw) { return kw.clusters && kw.clusters.length >= 3; } },
    { id:'has_service_pages', label:'Service page clusters exist',      check: function(kw) { if (!kw.clusters) return false; return kw.clusters.some(function(c) { return c.pageType === 'service' && c.qualifies !== false; }); } },
    { id:'has_homepage',    label:'Homepage cluster defined',           check: function(kw) { if (!kw.clusters) return false; return kw.clusters.some(function(c) { return c.pageType === 'home'; }); } },
    { id:'qualified_pages', label:'At least 5 qualified pages',         check: function(kw) { if (!kw.clusters) return false; return kw.clusters.filter(function(c) { return c.qualifies !== false; }).length >= 5; } },
    { id:'no_thin_new',     label:'No thin build-new pages (vol<50)',   check: function(kw) { if (!kw.clusters) return true; return !kw.clusters.some(function(c) { return c.recommendation === 'build_new' && c.qualifies !== false && c.primaryVol < 50; }); } },
    { id:'page_type_mix',   label:'Multiple page types (not just service)', check: function(kw) { if (!kw.clusters) return false; var types = {}; kw.clusters.forEach(function(c) { if (c.qualifies !== false) types[c.pageType] = true; }); return Object.keys(types).length >= 3; } }
  ]
};

function auditKeywordPipeline() {
  var kwR = S.kwResearch || {};
  var results = {};
  var totalPass = 0;
  var totalChecks = 0;

  ['seeds', 'opportunities', 'clusters'].forEach(function(stage) {
    var checks = KEYWORD_AUDIT_CHECKS[stage];
    var items = [];
    var pass = 0;
    checks.forEach(function(c) {
      var passed = false;
      try { passed = c.check(kwR); } catch (e) { passed = false; }
      items.push({ id: c.id, label: c.label, passed: passed });
      if (passed) pass++;
    });
    results[stage] = { pass: pass, fail: checks.length - pass, total: checks.length, items: items };
    totalPass += pass;
    totalChecks += checks.length;
  });

  results.overall = { pass: totalPass, total: totalChecks, rate: totalChecks > 0 ? Math.round((totalPass / totalChecks) * 100) : 0 };
  return results;
}

// ── Defaults ──────────────────────────────────────────────────────────

function strategyDefaults() {
  return {
    _meta: {
      current_version: 0,
      versions: [],
      approved: false,
      overall_score: 0
    },
    _enrichment: {},
    _audit: {},
    audience: {},
    positioning: {},
    unit_economics: {},
    channel_strategy: {},
    growth_plan: {},
    target_market: {},
    execution_plan: { lever_details: {} },
    brand_strategy: {},
    risks: {},
    subtraction: {},
    targets: {},
    demand_validation: {},
    narrative: {},
    sales_intel: {},
    compiled_output: ''
  };
}

// ── Scoring Engine ────────────────────────────────────────────────────

function _stratResolveInput(inputDef) {
  // Resolve a required input path to its value
  var r = S.research || {};
  var s = S.setup || {};
  var st = S.strategy || {};
  var path = inputDef.path;

  // Special cases
  if (inputDef.check === 'any_doc') {
    return (s.strategy && s.strategy.trim()) || (s.docs && s.docs.length);
  }

  // Parse dot paths
  var parts = path.replace('S.','').split('.');
  var obj;
  if (parts[0] === 'research') obj = r;
  else if (parts[0] === 'setup') obj = s;
  else if (parts[0] === 'strategy') obj = st;
  else return null;

  for (var i = 1; i < parts.length; i++) {
    if (!obj) return null;
    // Handle || for fallback paths
    if (parts[i].indexOf('||') >= 0) {
      var alts = parts[i].split('||');
      for (var a = 0; a < alts.length; a++) {
        var v = obj[alts[a].trim()];
        if (v) return v;
      }
      return null;
    }
    obj = obj[parts[i]];
  }
  return obj;
}

function _stratCheckInput(inputDef) {
  var val = _stratResolveInput(inputDef);
  var checkType = inputDef.check;
  var passed = false;
  switch (checkType) {
    case 'string':     passed = typeof val === 'string' && val.trim().length > 0; break;
    case 'array':      passed = Array.isArray(val) && val.length > 0; break;
    case 'array_min_2': passed = Array.isArray(val) && val.length >= 2; break;
    case 'truthy':     passed = !!val && (typeof val !== 'object' || Object.keys(val).length > 0); break;
    case 'any_doc':    passed = !!val; break;
    default:           passed = !!val;
  }
  // Try alternate path if primary fails
  if (!passed && inputDef.altPath) {
    var altVal = _stratResolveInput({ path: inputDef.altPath, check: inputDef.altCheck || checkType });
    var altType = inputDef.altCheck || checkType;
    switch (altType) {
      case 'string':     return typeof altVal === 'string' && altVal.trim().length > 0;
      case 'array':      return Array.isArray(altVal) && altVal.length > 0;
      case 'truthy':     return !!altVal && (typeof altVal !== 'object' || Object.keys(altVal).length > 0);
      default:           return !!altVal;
    }
  }
  return passed;
}

function scoreSection(section) {
  var reqInputs = STRATEGY_REQUIRED_INPUTS[section] || [];
  var present = 0;
  var missingInputs = [];
  for (var i = 0; i < reqInputs.length; i++) {
    if (_stratCheckInput(reqInputs[i])) {
      present++;
    } else {
      missingInputs.push(reqInputs[i].key);
    }
  }
  var dataScore = reqInputs.length > 0 ? (present / reqInputs.length) * 10 : 5;

  // Confidence: based on whether the section has been generated and has meaningful content
  var st = S.strategy || {};
  var sectionData = null;
  if (section === 'audience') sectionData = st.audience;
  else if (section === 'positioning') sectionData = st.positioning;
  else if (section === 'economics') sectionData = st.unit_economics;
  else if (section === 'subtraction') sectionData = st.subtraction;
  else if (section === 'channels') sectionData = st.channel_strategy || st.growth_plan; // merged: channels + growth
  else if (section === 'growth') sectionData = st.growth_plan; // backwards-compat
  else if (section === 'execution') sectionData = st.execution_plan;
  else if (section === 'brand') sectionData = st.brand_strategy;
  else if (section === 'risks') sectionData = st.risks;
  else if (section === 'narrative') sectionData = st.narrative;

  var hasContent = sectionData && Object.keys(sectionData).length > 0;
  var keyCount = hasContent ? Object.keys(sectionData).filter(function(k) { return k !== 'confidence' && k !== '_order'; }).length : 0;

  // Confidence: based on AI self-assessment + content depth
  var confidenceScore = 0;
  if (hasContent) {
    if (typeof sectionData.confidence === 'number') confidenceScore = Math.min(sectionData.confidence, 10);
    else if (sectionData.confidence === 'high') confidenceScore = 9;
    else if (sectionData.confidence === 'medium') confidenceScore = 7;
    else if (sectionData.confidence === 'low') confidenceScore = 4;
    else {
      // No explicit confidence — derive from content depth
      confidenceScore = keyCount >= 8 ? 7 : keyCount >= 4 ? 5.5 : keyCount >= 1 ? 4 : 0;
    }
  }

  // Audit pass rate boosts or penalises confidence
  var diagMap2 = { audience: 0, positioning: 2, economics: 1, subtraction: 3, channels: 4, execution: 5, brand: 6, risks: 7, narrative: 8, sales: 9 };
  var diagNum2 = diagMap2[section];
  if (diagNum2 !== undefined && diagNum2 !== null && st._audit && st._audit[diagNum2]) {
    var auResult = st._audit[diagNum2];
    var auRate = auResult.total > 0 ? auResult.pass / auResult.total : 0;
    if (auRate >= 0.9 && confidenceScore < 9) confidenceScore = Math.min(confidenceScore + 1, 9);
    else if (auRate < 0.5 && confidenceScore > 4) confidenceScore = Math.max(confidenceScore - 1.5, 4);
  }

  // Specificity: higher if enrichment data is present, strategy doc exists
  var specificityScore = hasContent ? 6 : 0;
  if ((S.setup || {}).strategy) specificityScore += 1;
  if ((S.setup || {}).docs && S.setup.docs.length || (S.setup || {}).discoveryNotes) specificityScore += 1.5;
  if (st._enrichment && st._enrichment.competitor_deep_dive) specificityScore += 1;
  if (specificityScore > 10) specificityScore = 10;

  // Apply anti-inflation caps
  ANTI_INFLATION_CAPS.forEach(function(cap) {
    if (cap.section !== section && cap.section !== '_all') return;
    if (!cap.test()) return;
    if (cap.dimension === 'data' && dataScore > cap.cap) dataScore = cap.cap;
    if (cap.dimension === 'confidence' && confidenceScore > cap.cap) confidenceScore = cap.cap;
    if (cap.dimension === 'specificity' && specificityScore > cap.cap) specificityScore = cap.cap;
  });

  var overall = (dataScore * 0.35) + (confidenceScore * 0.40) + (specificityScore * 0.25);
  overall = Math.round(overall * 10) / 10;

  // Build gaps
  var gaps = [];
  missingInputs.forEach(function(key) {
    gaps.push({
      gap: 'Missing input: ' + key.replace(/_/g, ' '),
      data_needed: key,
      can_auto_resolve: key.indexOf('enrichment') >= 0 || key.indexOf('deep_dive') >= 0 || key.indexOf('cpc') >= 0 || key.indexOf('pre_scan') >= 0 || key.indexOf('presence') >= 0
    });
  });

  return {
    section: section,
    score: overall,
    scores: { data: Math.round(dataScore*10)/10, confidence: Math.round(confidenceScore*10)/10, specificity: Math.round(specificityScore*10)/10 },
    gaps: gaps,
    missing_inputs: missingInputs
  };
}

function scoreStrategy() {
  var sections = {};
  var weightedSum = 0;
  var totalWeight = 0;
  var allGaps = [];

  Object.keys(STRATEGY_SECTION_WEIGHTS).forEach(function(sec) {
    var result = scoreSection(sec);
    sections[sec] = result;
    weightedSum += result.score * STRATEGY_SECTION_WEIGHTS[sec];
    totalWeight += STRATEGY_SECTION_WEIGHTS[sec];
    result.gaps.forEach(function(g) {
      g.section = sec;
      allGaps.push(g);
    });
  });

  var overall = totalWeight > 0 ? weightedSum / totalWeight : 0;
  overall = Math.round(overall * 10) / 10;

  // Demand validation overall cap (caps score if keyword demand check hasn't run)
  if (!S.strategy || !S.strategy.demand_validation || !S.strategy.demand_validation.overall_verdict) {
    if (overall > 6.5) overall = 6.5;
  }
  // High severity revision cap
  var d8Cap = ANTI_INFLATION_CAPS.find(function(c) { return c.condition === 'd8_high_severity'; });
  if (d8Cap && d8Cap.test() && overall > 6.5) overall = 6.5;

  // Subtraction cap — strategy without subtraction analysis is incomplete
  var subCap = ANTI_INFLATION_CAPS.find(function(c) { return c.condition === 'no_subtraction'; });
  if (subCap && subCap.test() && overall > 7.0) overall = 7.0;

  // Low audit pass rate cap — poor quality outputs drag down the score
  var auditCap = ANTI_INFLATION_CAPS.find(function(c) { return c.condition === 'low_audit_pass_rate'; });
  if (auditCap && auditCap.test() && overall > auditCap.cap) overall = auditCap.cap;

  // Audience below 5.0 caps overall at 6.0 — use pre-computed score to avoid redundant computation
  if (sections.audience && sections.audience.score < 5.0 && overall > 6.0) overall = 6.0;

  // Collect active caps for transparency
  var activeCaps = [];
  ANTI_INFLATION_CAPS.forEach(function(cap) {
    if (cap.section !== '_overall') return;
    // Use pre-computed audience score to avoid redundant scoreSection call
    if (cap.condition === 'audience_below_5_overall') {
      if (sections.audience && sections.audience.score < 5.0) activeCaps.push({ condition: cap.condition, cap: cap.cap });
    } else if (cap.test()) {
      activeCaps.push({ condition: cap.condition, cap: cap.cap });
    }
  });

  return { overall: overall, sections: sections, gaps: allGaps, activeCaps: activeCaps };
}

// ── Version Control ───────────────────────────────────────────────────

function createStrategyVersion(trigger, overrides) {
  if (!S.strategy) S.strategy = strategyDefaults();
  var meta = S.strategy._meta;
  var scores = scoreStrategy();
  var version = {
    version: meta.current_version + 1,
    created: new Date().toISOString(),
    trigger: trigger || 'auto_draft',
    overall_score: scores.overall,
    section_scores: {},
    gaps_identified: scores.gaps.map(function(g) { return g.gap; }),
    changes_from_previous: meta.current_version > 0 ? 'Updated from v' + meta.current_version : null,
    strategist_overrides: overrides || [],
    approved: false,
    known_limitations: []
  };

  Object.keys(scores.sections).forEach(function(sec) {
    version.section_scores[sec] = scores.sections[sec].score;
  });

  // Add known limitations
  if (!S.strategy.demand_validation || !S.strategy.demand_validation.overall_verdict) {
    version.known_limitations.push('Keyword demand validation has not run yet');
  }
  if ((!(S.setup || {}).docs || !S.setup.docs.length) && !(S.setup || {}).discoveryNotes) {
    version.known_limitations.push('No reference documents or discovery notes — specificity may be limited');
  }

  meta.current_version = version.version;
  meta.overall_score = scores.overall;
  meta._completedAt = Date.now();
  meta.versions.push(version);

  return version;
}

// ── Enrichment Layer ──────────────────────────────────────────────────

var strategyEnrich = {

  // Deep competitor website analysis
  competitorDeepDive: async function(competitorUrl) {
    var pages = [competitorUrl];
    var path = competitorUrl.replace(/\/$/, '');
    ['/about', '/services', '/our-services', '/pricing', '/portfolio', '/our-work', '/blog'].forEach(function(p) {
      pages.push(path + p);
    });
    try {
      var res = await fetch('/api/fetch-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: pages.slice(0, 6) })
      });
      var data = await res.json();
      var allText = '';
      if (data.pages) {
        data.pages.forEach(function(p) { if (p.text) allText += '\n\n--- ' + p.url + ' ---\n' + p.text; });
      } else if (data.text) {
        allText = data.text;
      }
      if (!allText.trim()) return null;

      var prompt = 'Analyse this competitor website content and extract:\n'
        + '1. Their positioning claims and messaging\n'
        + '2. Services offered with detail level\n'
        + '3. Trust signals (awards, certs, case studies, notable clients)\n'
        + '4. Content depth (blog frequency, resource pages)\n'
        + '5. Strengths and weaknesses\n'
        + '6. Claims that our client could also make (contested differentiators)\n\n'
        + 'COMPETITOR URL: ' + competitorUrl + '\n\n'
        + 'WEBSITE CONTENT:\n' + allText.slice(0, 12000) + '\n\n'
        + 'Return ONLY valid JSON:\n{\n'
        + '  "positioning": "their core positioning statement",\n'
        + '  "services": ["service 1", "service 2"],\n'
        + '  "strengths": ["strength 1"],\n'
        + '  "weaknesses": ["weakness 1"],\n'
        + '  "content_depth": "high | medium | low",\n'
        + '  "trust_signals": ["signal 1"],\n'
        + '  "messaging_analysis": "how they message to their audience",\n'
        + '  "claims_that_match_client": ["claim that both businesses could make"]\n}';

      var sys = 'You are a competitive intelligence analyst. Extract factual information from the website content. Return ONLY valid JSON.';
      var result = await callClaude(sys, prompt, null, 4000, 'Competitor deep-dive');
      return parseEnrichResult(result);
    } catch (e) {
      console.error('competitorDeepDive error:', e);
      return null;
    }
  },

  // Keyword opportunity pre-scan
  keywordPreScan: async function(vertical, geography, services) {
    var geo = (geography || '').replace(/,.*$/, '').trim().toLowerCase();
    var seeds = [];
    (services || []).slice(0, 5).forEach(function(svc) {
      seeds.push(svc.toLowerCase() + ' ' + geo);
      seeds.push(svc.toLowerCase() + ' agency ' + geo);
    });
    seeds.push(vertical.toLowerCase() + ' ' + geo);
    seeds.push(geo + ' marketing agency');

    try {
      var res = await fetch('/api/kw-expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds: seeds.slice(0, 10), limit: 50 })
      });
      var data = await res.json();
      if (!data.keywords || !data.keywords.length) return null;

      var kws = data.keywords;
      var quickWins = kws.filter(function(k) { return k.vol >= 100 && k.kd < 20; });
      var highValue = kws.filter(function(k) { return k.vol >= 500; });
      var avgKD = kws.reduce(function(s, k) { return s + (k.kd || 0); }, 0) / kws.length;
      var totalVol = kws.reduce(function(s, k) { return s + (k.vol || 0); }, 0);

      return {
        keywords: kws.slice(0, 30),
        quick_wins: quickWins.slice(0, 10),
        high_value: highValue.slice(0, 10),
        total_volume: totalVol,
        avg_difficulty: Math.round(avgKD),
        estimated_difficulty_landscape: avgKD < 20 ? 'easy' : avgKD < 40 ? 'moderate' : 'competitive'
      };
    } catch (e) {
      console.error('keywordPreScan error:', e);
      return null;
    }
  },

  // CPC and paid media cost estimates
  cpcEstimates: async function(keywords, geography) {
    // Use keyword expansion data which includes CPC
    var seeds = (keywords || []).slice(0, 10);
    if (!seeds.length) return null;
    try {
      var res = await fetch('/api/kw-expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seeds: seeds, limit: 30 })
      });
      var data = await res.json();
      if (!data.keywords || !data.keywords.length) return null;

      var kws = data.keywords.filter(function(k) { return k.cpc && k.cpc > 0; });
      if (!kws.length) return null;
      var avgCPC = kws.reduce(function(s, k) { return s + k.cpc; }, 0) / kws.length;
      var maxCPC = Math.max.apply(null, kws.map(function(k) { return k.cpc; }));
      var minCPC = Math.min.apply(null, kws.map(function(k) { return k.cpc; }));

      return {
        keyword_cpcs: kws.slice(0, 15).map(function(k) { return { kw: k.kw, cpc: k.cpc, vol: k.vol }; }),
        avg_cpc: Math.round(avgCPC * 100) / 100,
        max_cpc: Math.round(maxCPC * 100) / 100,
        min_cpc: Math.round(minCPC * 100) / 100,
        estimated_cpl_range: '$' + Math.round(avgCPC * 8) + ' - $' + Math.round(avgCPC * 20),
        recommended_budget_minimum: Math.round(avgCPC * 300)
      };
    } catch (e) {
      console.error('cpcEstimates error:', e);
      return null;
    }
  },

  // Extract structured data from reference docs
  referenceDocExtraction: async function(docText, specificFields) {
    if (!docText || !docText.trim()) return null;
    var prompt = 'Extract the following specific data points from this document.\n'
      + 'Fields needed: ' + (specificFields || ['budget', 'deal_size', 'close_rate', 'timeline', 'goals', 'constraints', 'past_results']).join(', ') + '\n\n'
      + 'DOCUMENT:\n' + docText.slice(0, 10000) + '\n\n'
      + 'Return ONLY valid JSON:\n{\n'
      + '  "extracted_fields": {"field_name": "value"},\n'
      + '  "raw_quotes": ["verbatim quote from document that is relevant"],\n'
      + '  "contradictions": ["any contradictions found between statements"],\n'
      + '  "confidence_per_field": {"field_name": "high | medium | low"}\n}';
    try {
      var result = await callClaude(
        'You are a document analysis expert. Extract specific data points from business documents. Return ONLY valid JSON.',
        prompt, null, 4000, 'Doc extraction'
      );
      return parseEnrichResult(result);
    } catch (e) {
      console.error('referenceDocExtraction error:', e);
      return null;
    }
  },

  // Industry benchmarks
  industryBenchmarks: async function(vertical, geography) {
    var prompt = 'Provide industry benchmarks for a ' + vertical + ' business in ' + geography + '.\n\n'
      + 'Return ONLY valid JSON:\n{\n'
      + '  "benchmark_cpl": "typical cost per lead range",\n'
      + '  "benchmark_cvr": "typical website conversion rate",\n'
      + '  "benchmark_close_rate": "typical sales close rate",\n'
      + '  "benchmark_deal_size": "typical deal size range",\n'
      + '  "benchmark_sales_cycle": "typical sales cycle length",\n'
      + '  "benchmark_ltv": "typical customer lifetime value",\n'
      + '  "top_channels": ["most effective marketing channels for this vertical"],\n'
      + '  "avg_marketing_budget_pct": "typical marketing budget as % of revenue",\n'
      + '  "sources": ["where these benchmarks come from"]\n}';
    try {
      var result = await callClaude(
        'You are a marketing analytics expert with deep knowledge of industry benchmarks. Provide accurate, specific benchmarks. Return ONLY valid JSON.',
        prompt, null, 3000, 'Industry benchmarks'
      );
      return parseEnrichResult(result);
    } catch (e) {
      console.error('industryBenchmarks error:', e);
      return null;
    }
  },

  // Keyword demand validation (programmatic — feeds S.strategy.demand_validation)
  // If full keyword research exists (S.kwResearch), derives validation from real data.
  // Falls back to quick API check only if no keyword research has been done.
  keywordDemandCheck: async function(vertical, geography, services) {
    var geo = (geography || '').replace(/,.*$/, '').trim().toLowerCase();
    var kwR = S.kwResearch || {};
    var kws = [];
    var dataSource = 'dataforseo';

    // Prefer existing keyword research data over a fresh shallow lookup
    if (kwR.keywords && kwR.keywords.length >= 10) {
      kws = kwR.keywords.map(function(k) { return { kw: k.kw, vol: k.vol || 0, kd: k.kd || 0, cpc: k.cpc || 0 }; });
      dataSource = 'keyword_research';
    } else {
      // Fallback: quick API lookup (only if no keyword research done yet)
      var seeds = [];
      (services || []).slice(0, 5).forEach(function(svc) {
        var svcL = svc.toLowerCase().replace(/\s+(services?|management)$/i, '').trim();
        seeds.push(svcL + ' ' + geo);
        seeds.push(svcL + ' agency ' + geo);
      });
      seeds.push(vertical.toLowerCase() + ' agency ' + geo);
      seeds.push(geo + ' marketing agency');

      try {
        var res = await fetch('/api/kw-expand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seeds: seeds.slice(0, 10), limit: 100 })
        });
        var data = await res.json();
        if (!data.keywords) return { overall_verdict: 'insufficient', keyword_data_confidence: 'low', keyword_data_source: 'fallback_api' };
        kws = data.keywords.map(function(k) { return { kw: k.keyword || k.kw, vol: k.volume || k.vol || 0, kd: k.difficulty || k.kd || 0, cpc: k.cpc || 0 }; });
      } catch (e) {
        console.error('keywordDemandCheck API error:', e);
        return { overall_verdict: 'insufficient', keyword_data_confidence: 'low', error: e.message };
      }
    }

    var totalVol = kws.reduce(function(s, k) { return s + (k.vol || 0); }, 0);
    var kwsWithVol = kws.filter(function(k) { return k.vol > 50; });
    var avgKD = kws.length ? kws.reduce(function(s, k) { return s + (k.kd || 0); }, 0) / kws.length : 0;

    var verdict = 'viable';
    if (totalVol < 100) verdict = 'insufficient';
    else if (totalVol < 500) verdict = 'marginal';

    var quickWins = kws.filter(function(k) { return k.vol >= 100 && k.kd < 20; });
    var highValue = kws.filter(function(k) { return k.vol >= 500; });

    // Per-service demand
    var serviceDemand = [];
    (services || []).slice(0, 5).forEach(function(svc) {
      var svcL = svc.toLowerCase();
      var svcKws = kws.filter(function(k) { return (k.kw || '').toLowerCase().indexOf(svcL.split(' ')[0]) >= 0; });
      var svcVol = svcKws.reduce(function(s, k) { return s + (k.vol || 0); }, 0);
      serviceDemand.push({ service: svc, total_vol: svcVol, keyword_count: svcKws.length, assessment: svcVol > 200 ? 'strong' : svcVol > 50 ? 'moderate' : 'weak' });
    });

    // Cluster analysis (if clusters exist from keyword research)
    var clusterAnalysis = null;
    if (kwR.clusters && kwR.clusters.length) {
      var qualified = kwR.clusters.filter(function(c) { return c.qualifies !== false; });
      var buildNew = qualified.filter(function(c) { return c.recommendation === 'build_new'; });
      var improve = qualified.filter(function(c) { return c.recommendation === 'improve_existing'; });
      var disqualified = kwR.clusters.filter(function(c) { return c.qualifies === false; });
      clusterAnalysis = {
        total_clusters: kwR.clusters.length,
        qualified: qualified.length,
        build_new: buildNew.length,
        improve_existing: improve.length,
        disqualified: disqualified.length,
        page_types: {}
      };
      kwR.clusters.forEach(function(c) {
        var pt = c.pageType || 'other';
        clusterAnalysis.page_types[pt] = (clusterAnalysis.page_types[pt] || 0) + 1;
      });
    }

    // Keyword pipeline audit
    var kwAudit = auditKeywordPipeline();

    return {
      overall_verdict: verdict,
      vertical_demand: { total_vol: totalVol, keywords_with_volume: kwsWithVol.length, avg_kd: Math.round(avgKD), assessment: verdict },
      service_demand: serviceDemand,
      geography_demand: { total_vol: totalVol, assessment: verdict },
      quick_wins: quickWins.slice(0, 10).map(function(k) { return { keyword: k.kw, volume: k.vol, kd: k.kd }; }),
      high_value_targets: highValue.slice(0, 10).map(function(k) { return { keyword: k.kw, volume: k.vol, kd: k.kd }; }),
      organic_traffic_ceiling: totalVol > 1000 ? 'high' : totalVol > 300 ? 'medium' : 'low',
      time_to_meaningful_organic: avgKD > 40 ? '9-12 months' : avgKD > 20 ? '4-8 months' : '2-4 months',
      seo_viability_score: Math.min(10, Math.round((totalVol / 200) + (10 - avgKD / 10))),
      keyword_data_confidence: kws.length > 30 ? 'high' : kws.length > 10 ? 'medium' : 'low',
      keyword_data_source: dataSource,
      cluster_analysis: clusterAnalysis,
      keyword_audit: kwAudit,
      strategic_revisions_needed: []
    };
  },

  // Current site performance check
  sitePerformanceCheck: async function(url) {
    if (!url) return null;
    try {
      var res = await fetch('/api/fetch-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url, url.replace(/\/$/, '') + '/about', url.replace(/\/$/, '') + '/services'] })
      });
      var data = await res.json();
      var pageCount = 0;
      var totalLen = 0;
      if (data.pages) {
        data.pages.forEach(function(p) { if (p.text && p.text.length > 50) { pageCount++; totalLen += p.text.length; } });
      }
      return {
        pages_responding: pageCount,
        estimated_content_depth: totalLen > 5000 ? 'deep' : totalLen > 1500 ? 'moderate' : 'thin',
        has_about: data.pages ? data.pages.some(function(p) { return p.url.indexOf('/about') >= 0 && p.text && p.text.length > 100; }) : false,
        has_services: data.pages ? data.pages.some(function(p) { return p.url.indexOf('/services') >= 0 && p.text && p.text.length > 100; }) : false
      };
    } catch (e) {
      console.error('sitePerformanceCheck error:', e);
      return null;
    }
  }
};

// ── Diagnostic Prompts ────────────────────────────────────────────────

var DIAGNOSTIC_SYSTEM = 'You are the strategy engine for SetSailOS, a digital marketing agency platform.\n'
  + 'You produce strategic decisions based on factual data. Your methodology:\n'
  + '- Diagnosis before direction \u2014 identify what is broken before recommending fixes\n'
  + '- Revenue accountability \u2014 every recommendation must connect to revenue outcomes\n'
  + '- Math before ambition \u2014 targets from unit economics, not wishes\n'
  + '- Cut before you build \u2014 subtraction before addition\n'
  + '- Vertical specificity \u2014 never generic, always tailored to THIS client\n\n'
  + 'You MUST respond with ONLY valid JSON matching the specified schema. No preamble, no markdown fences, no explanation outside the JSON.';

function _stratCtx() {
  var r = S.research || {};
  var s = S.setup || {};
  var ctx = 'CLIENT: ' + (s.client || r.client_name || '') + '\n';
  ctx += 'URL: ' + (s.url || '') + '\n';
  ctx += 'GEO: ' + (s.geo || '') + '\n';
  ctx += 'INDUSTRY: ' + (r.industry || '') + '\n';
  if (r.sub_industry) ctx += 'SUB-INDUSTRY: ' + r.sub_industry + '\n';
  ctx += 'BUSINESS MODEL: ' + (r.business_model || '') + '\n';
  ctx += 'BUSINESS OVERVIEW: ' + (r.business_overview || '') + '\n';
  if (r.years_in_business) ctx += 'YEARS IN BUSINESS: ' + r.years_in_business + '\n';
  if (r.locations_count) ctx += 'LOCATIONS: ' + r.locations_count + '\n';
  if (r.primary_services && r.primary_services.length) ctx += 'SERVICES: ' + r.primary_services.join(', ') + '\n';
  if (r.primary_audience_description) ctx += 'AUDIENCE: ' + r.primary_audience_description + '\n';
  if (r.buyer_roles_titles && r.buyer_roles_titles.length) ctx += 'BUYER ROLES: ' + (Array.isArray(r.buyer_roles_titles) ? r.buyer_roles_titles.join(', ') : r.buyer_roles_titles) + '\n';
  if (r.geography && r.geography.primary) ctx += 'PRIMARY GEO: ' + r.geography.primary + '\n';
  if (r.geography && r.geography.secondary) ctx += 'SECONDARY GEO: ' + (Array.isArray(r.geography.secondary) ? r.geography.secondary.join(', ') : r.geography.secondary) + '\n';
  if (r.target_geography) ctx += 'TARGET GEO SCOPE: ' + r.target_geography + '\n';
  if (s.geoMetro) ctx += 'METRO TARGET (city-level): ' + (s.geo || s.geoMetro) + ' [GKP geo ID: ' + s.geoMetro + ']\n';
  if (r.primary_goal) ctx += 'PRIMARY GOAL: ' + r.primary_goal + '\n';
  if (r.secondary_goals && r.secondary_goals.length) ctx += 'SECONDARY GOALS: ' + (Array.isArray(r.secondary_goals) ? r.secondary_goals.join(', ') : r.secondary_goals) + '\n';
  // Structured client goals (client-voiced, from Setup)
  if (r.goal_statement) ctx += 'CLIENT SUCCESS STATEMENT: "' + r.goal_statement + '"\n';
  if (r.goal_target) ctx += 'MEASURABLE TARGET: ' + r.goal_target + '\n';
  if (r.goal_baseline) ctx += 'CURRENT BASELINE: ' + r.goal_baseline + '\n';
  if (r.goal_timeline) ctx += 'GOAL TIMELINE: ' + r.goal_timeline + '\n';
  if (r.goal_kpi) ctx += 'PRIMARY KPI: ' + r.goal_kpi.replace(/_/g, ' ') + '\n';
  if (r.pain_points_top5 && r.pain_points_top5.length) ctx += 'TOP PAIN POINTS: ' + r.pain_points_top5.join('; ') + '\n';
  if (r.objections_top5 && r.objections_top5.length) ctx += 'TOP OBJECTIONS: ' + (Array.isArray(r.objections_top5) ? r.objections_top5.join('; ') : r.objections_top5) + '\n';
  if (r.case_studies && r.case_studies.length) ctx += 'CASE STUDIES: ' + r.case_studies.map(function(c) { return (c.client || c.name || 'Client') + ': ' + (c.result || c.outcome || ''); }).join('; ') + '\n';
  if (r.notable_clients && r.notable_clients.length) ctx += 'NOTABLE CLIENTS: ' + (Array.isArray(r.notable_clients) ? r.notable_clients.join(', ') : r.notable_clients) + '\n';
  if (r.awards_certifications && r.awards_certifications.length) ctx += 'AWARDS/CERTS: ' + (Array.isArray(r.awards_certifications) ? r.awards_certifications.join(', ') : r.awards_certifications) + '\n';
  if (r.seasonality_notes) ctx += 'SEASONALITY: ' + r.seasonality_notes + '\n';
  if (s.discoveryNotes && s.discoveryNotes.trim()) {
    ctx += '\nDISCOVERY NOTES:\n' + s.discoveryNotes.trim() + '\n';
  }
  if (s.docs && s.docs.length) {
    ctx += '\nREFERENCE DOCUMENTS:\n';
    ctx += _docExtractCtx(s.docs, ['facts','decisions','requirements','competitors','audience','services','goals']);
  }
  // Inject Client Pain (Layer 1) + Customer Pain (Layer 2) if available
  if (typeof getPainContextBlock === 'function') {
    var painBlock = getPainContextBlock();
    if (painBlock && painBlock.indexOf('Not yet captured') === -1) {
      ctx += painBlock;
    }
  }
  // VoC swipe file — real buyer language from docs and manual input
  var _vocFile = (S.strategy && S.strategy._enrichment && S.strategy._enrichment.voc_swipe_file) || [];
  // Merge manual entries from research
  var _vocRaw = (S.research && S.research.voc_swipe_raw) || '';
  if (_vocRaw && typeof _vocRaw === 'string') {
    _vocRaw.split('\n').filter(function(l) { return l.trim().length > 5; }).forEach(function(l) {
      var phrase = l.trim().replace(/^["'\u201c\u201d]|["'\u201c\u201d]$/g, '');
      if (!_vocFile.some(function(v) { return (v.quote || v.phrase || '') === phrase; })) {
        _vocFile.push({ quote: phrase, source_type: 'manual' });
      }
    });
  }
  if (_vocFile.length) {
    ctx += '\nVOICE OF CUSTOMER (real buyer language \u2014 use where natural, never fabricate):\n';
    _vocFile.slice(0, 10).forEach(function(v) {
      ctx += '- "' + (v.quote || v.phrase || '') + '"' + (v.context ? ' (' + v.context + ')' : '') + '\n';
    });
  }
  return ctx;
}

function _versionLearningCtx(num) {
  var st = S.strategy || {};
  var audit = st._audit || {};
  var prevAudit = audit[num];
  if (!prevAudit || !prevAudit.items) return '';

  // Get previous output
  var prevOutput = null;
  if (num === 0) prevOutput = st.audience;
  else if (num === 1) prevOutput = st.unit_economics;
  else if (num === 2) prevOutput = st.positioning;
  else if (num === 3) prevOutput = st.subtraction;
  else if (num === 4) prevOutput = st.channel_strategy;
  else if (num === 5) prevOutput = st.execution_plan && st.execution_plan.lever_details ? st.execution_plan.lever_details.website : null;
  else if (num === 6) prevOutput = st.execution_plan && st.execution_plan.lever_details ? st.execution_plan.lever_details.content_marketing : null;
  else if (num === 7) prevOutput = st.risks;
  else if (num === 8) prevOutput = st.narrative;
  else if (num === 9) prevOutput = st.sales_intel;

  if (!prevOutput || (typeof prevOutput === 'object' && Object.keys(prevOutput).length === 0)) return '';

  var failedChecks = prevAudit.items.filter(function(it) { return !it.passed; });
  if (failedChecks.length === 0 && prevAudit.pass === prevAudit.total) return '';

  var ctx = '\n\nVERSION LEARNING — IMPROVE ON PREVIOUS OUTPUT:\n';
  ctx += 'The previous version scored ' + prevAudit.pass + '/' + prevAudit.total + ' quality checks.\n';
  if (failedChecks.length > 0) {
    ctx += 'FAILED CHECKS (fix these in this version):\n';
    failedChecks.forEach(function(fc) {
      ctx += '- ' + fc.label + '\n';
    });
  }
  ctx += '\nPREVIOUS OUTPUT (improve on this, do not just copy it):\n';
  ctx += JSON.stringify(prevOutput, null, 0).slice(0, 4000) + '\n';
  return ctx;
}

// ── Buyer Intelligence Block ─────────────────────────────────────────
// Combines awareness stage + category perception + perceived alternatives + VoC
// into a single context block for brief and copy prompts.

function _buyerIntelBlock(page) {
  var parts = [];
  var st = S.strategy || {};

  // 1. Awareness stage — sets page structure
  if (page.awareness_stage) {
    var _biGuide = {
      'unaware': 'Lead with education, industry trends, provocative questions. Do NOT pitch the service immediately. Educate first, then bridge to the problem.',
      'problem_aware': 'Lead with the pain point. Agitate cost of inaction. Introduce the solution category before the company. CTA: low-commitment (guide, checklist, assessment).',
      'solution_aware': 'Lead with what makes this approach different. Explain methodology. Use comparison framing. CTA: mid-commitment (consultation, demo, audit).',
      'product_aware': 'Lead with proof — results, case studies, testimonials, metrics. Address top objections directly. CTA: direct (get started, book a call, request quote).',
      'most_aware': 'Lead with the offer and CTA above the fold. Urgency and risk reversal. Minimise education. Remove friction from conversion path.'
    };
    parts.push('AWARENESS STAGE: ' + page.awareness_stage.replace(/_/g, ' ')
      + '\n' + (_biGuide[page.awareness_stage] || ''));
  }

  // 2. Category perception gap — sets opening hook
  if (st.positioning && st.positioning.category_perception) {
    var _biCp = st.positioning.category_perception;
    if (_biCp.gap_severity && _biCp.gap_severity !== 'none' && _biCp.buyer_frame) {
      var pt = (page.page_type || '').toLowerCase();
      // Only inject on pages where reframing matters
      if (pt === 'home' || pt === 'homepage' || pt === 'service' || pt === 'industry' || pt === 'about') {
        parts.push('CATEGORY PERCEPTION GAP:\n'
          + '- Buyer enters thinking they need: ' + _biCp.buyer_frame + '\n'
          + '- We are actually selling: ' + (_biCp.actual_frame || '') + '\n'
          + '- Reframing language: ' + (_biCp.reframing_language || ''));
      }
    }
  }

  // 3. Perceived alternatives — sets objection handling
  if (st.audience && st.audience.perceived_alternatives && st.audience.perceived_alternatives.length) {
    var _biAlts = st.audience.perceived_alternatives;
    // Filter to page persona segment if assigned
    if (page.target_persona && st.audience && st.audience.personas) {
      var _biPersona = st.audience.personas.find(function(p) { return p.archetype_label === page.target_persona || p.name === page.target_persona; });
      if (_biPersona && _biPersona.segment) {
        var _biSegAlts = _biAlts.filter(function(a) { return a.segments_affected && a.segments_affected.indexOf(_biPersona.segment) >= 0; });
        if (_biSegAlts.length) _biAlts = _biSegAlts;
      }
    }
    parts.push('PERCEIVED ALTERNATIVES (address on this page):\n'
      + _biAlts.slice(0, 4).map(function(a) {
        return '- ' + (a.alternative || '') + ': ' + (a.counter_positioning || a.failure_mode || '');
      }).join('\n'));
  }

  // 4. VoC swipe file — sets language texture
  var _biEnrich = st._enrichment || {};
  var _biVoc = (_biEnrich.voc_swipe_file || []).slice();
  // Merge manual VoC
  var _biVocRaw = (S.research && S.research.voc_swipe_raw) || '';
  if (_biVocRaw && typeof _biVocRaw === 'string') {
    _biVocRaw.split('\n').filter(function(l) { return l.trim().length > 5; }).forEach(function(l) {
      var phrase = l.trim().replace(/^["'\u201c\u201d]|["'\u201c\u201d]$/g, '');
      if (!_biVoc.some(function(v) { return (v.quote || '') === phrase; })) {
        _biVoc.push({ quote: phrase, source_type: 'manual' });
      }
    });
  }
  if (_biVoc.length) {
    parts.push('VOICE OF CUSTOMER (use this real buyer language where natural — never fabricate):\n'
      + _biVoc.slice(0, 5).map(function(v) {
        return '- "' + (v.quote || '') + '"';
      }).join('\n'));
  }

  // 5. D8 Narrative — messaging pillars + content hooks + objection rebuttals
  if (st.narrative) {
    var _biNar = st.narrative;
    var _biNarParts = [];
    // Messaging pillars relevant to this page type
    if (_biNar.messaging_pillars && _biNar.messaging_pillars.length) {
      var _biPageType = (page.page_type || '').toLowerCase();
      var _biRelevant = _biNar.messaging_pillars.filter(function(p) {
        return !p.page_types || !p.page_types.length || p.page_types.some(function(pt) { return pt.toLowerCase() === _biPageType || pt === 'all'; });
      });
      if (!_biRelevant.length) _biRelevant = _biNar.messaging_pillars.slice(0, 2);
      _biNarParts.push('MESSAGING PILLARS (weave into copy):\n' + _biRelevant.slice(0, 3).map(function(p) {
        return '- ' + (p.pillar || '') + (p.evidence && p.evidence.length ? ' [evidence: ' + p.evidence[0] + ']' : '');
      }).join('\n'));
    }
    // Awareness-stage-specific content hooks
    if (_biNar.content_hooks && page.awareness_stage) {
      var _biHooks = _biNar.content_hooks[page.awareness_stage];
      if (_biHooks && _biHooks.length) {
        _biNarParts.push('CONTENT HOOKS (' + page.awareness_stage.replace(/_/g, ' ') + '):\n' + _biHooks.slice(0, 3).map(function(h) { return '- ' + h; }).join('\n'));
      }
    }
    // High-priority objection rebuttals
    if (_biNar.objection_map && _biNar.objection_map.length) {
      var _biHighObj = _biNar.objection_map.filter(function(o) { return o.priority === 'high'; });
      if (_biHighObj.length) {
        _biNarParts.push('KEY OBJECTION REBUTTALS:\n' + _biHighObj.slice(0, 3).map(function(o) {
          return '- Objection: ' + (o.objection || '') + ' \u2192 Rebuttal: ' + (o.rebuttal || '');
        }).join('\n'));
      }
    }
    if (_biNarParts.length) parts.push(_biNarParts.join('\n'));
  }

  if (!parts.length) return '';
  return '\n\nBUYER INTELLIGENCE\n' + parts.join('\n\n') + '\n';
}

// Build snapshot context block for strategy diagnostics
// ── 3-Layer Benchmark Context Block for D1 ───────────────────────
function _buildBenchmarkContextBlock() {
  var r = S.research || {};
  var kwR = S.kwResearch || {};
  var block = '\nBENCHMARK DATA (3 layers — use highest-confidence source for each metric):\n\n';

  // Layer 1: Static industry benchmarks
  var bench = _matchIndustryBenchmark(r.industry || r.sub_industry || '');
  if (bench) {
    block += 'LAYER 1 — INDUSTRY BENCHMARKS (confidence: LOW — general industry averages):\n'
      + '- Landing page CVR: ' + (bench.landing_page_cvr.low*100) + '% - ' + (bench.landing_page_cvr.high*100) + '% (mid: ' + (bench.landing_page_cvr.mid*100) + '%)\n'
      + '- Avg CPL range: $' + bench.avg_cpl.low + ' - $' + bench.avg_cpl.high + ' (mid: $' + bench.avg_cpl.mid + ')\n'
      + '- Close rate: ' + (bench.close_rate.low*100) + '% - ' + (bench.close_rate.high*100) + '% (mid: ' + (bench.close_rate.mid*100) + '%)\n'
      + '- Retention multiplier (LTV/deal): ' + bench.retention_multiplier.low + 'x - ' + bench.retention_multiplier.high + 'x (mid: ' + bench.retention_multiplier.mid + 'x)\n'
      + '- Source: ' + bench.source + '\n\n';
  } else {
    block += 'LAYER 1 — INDUSTRY BENCHMARKS: NOT AVAILABLE for "' + (r.industry || 'unknown') + '"\n\n';
  }

  // Layer 2: GKP forecast conversion data (if available)
  var fc = kwR.forecasts;
  if (fc && fc.items && fc.items.length) {
    var fcWithConv = fc.items.filter(function(f) { return f.conversions && f.conversions > 0; });
    if (fcWithConv.length > 0) {
      var totalClicks = 0, totalConv = 0;
      fcWithConv.forEach(function(f) { totalClicks += (f.clicks || 0); totalConv += (f.conversions || 0); });
      var gkpCvr = totalClicks > 0 ? Math.round((totalConv / totalClicks) * 10000) / 100 : 0;
      block += 'LAYER 2 — GOOGLE ADS FORECAST DATA (confidence: MEDIUM — from Google Keyword Planner forecast):\n'
        + '- Predicted conversion rate: ' + gkpCvr + '%\n'
        + '- Predicted conversions/mo: ' + Math.round(totalConv) + ' (from ' + fcWithConv.length + ' keywords)\n'
        + '- Based on forecast budget estimate\n\n';
    } else {
      block += 'LAYER 2 — GKP FORECAST: No conversion data available (account may lack conversion tracking)\n\n';
    }
  } else {
    block += 'LAYER 2 — GKP FORECAST: NOT AVAILABLE (Google Ads not configured or forecast not run)\n\n';
  }

  // Layer 3: Client-provided actuals (highest confidence)
  var hasActuals = r.known_landing_page_cvr || r.known_cpl || r.known_close_rate;
  if (hasActuals) {
    block += 'LAYER 3 — CLIENT-PROVIDED ACTUALS (confidence: HIGHEST — override all other sources):\n';
    if (r.known_landing_page_cvr) block += '- Known landing page CVR: ' + r.known_landing_page_cvr + '\n';
    if (r.known_cpl) block += '- Known cost per lead: ' + r.known_cpl + '\n';
    if (r.known_close_rate) block += '- Known close rate (from CRM): ' + r.known_close_rate + '\n';
    block += '\n';
  } else {
    block += 'LAYER 3 — CLIENT ACTUALS: NOT PROVIDED (all estimates are benchmarks/forecasts)\n\n';
  }

  // Override rules for Claude
  block += 'OVERRIDE RULES: For each metric, use the highest-numbered layer that has data.\n'
    + '- Layer 3 (client actuals) overrides Layer 2 (GKP forecast) overrides Layer 1 (industry benchmarks)\n'
    + '- Use Layer 1 ranges for conservative/base/optimistic sensitivity scenarios when no higher layer exists\n'
    + '- When using Layer 1 or 2, flag it as an assumption in the output\n'
    + '- When Layer 3 is present, use it as fact and mark input_quality as "client-provided" for that metric\n\n';

  return block;
}

function _snapshotCtxBlock() {
  var snap = S.snapshot || {};
  var dm = snap.domainMetrics || {};
  if (!dm.dr && !snap.domain_rating && !(snap.topPages && snap.topPages.length)) return '';
  var lines = ['CURRENT DOMAIN PERFORMANCE:'];
  var dr = dm.dr || snap.domain_rating;
  if (dr) lines.push('- Domain Rating (DR): ' + dr);
  var traffic = dm.orgTraffic || snap.organic_traffic;
  if (traffic) lines.push('- Monthly organic traffic: ' + traffic);
  var orgKws = dm.orgKeywords || snap.organic_keywords;
  if (orgKws) lines.push('- Organic keywords ranking: ' + orgKws);
  var refDoms = dm.liveRefdomains || snap.referring_domains;
  if (refDoms) lines.push('- Referring domains: ' + refDoms);
  var pages = snap.topPages || [];
  if (pages.length) {
    lines.push('- Top pages by traffic (' + pages.length + ' captured):');
    pages.slice(0, 10).forEach(function(p) {
      var line = '  ' + (p.slug || p.url || '?') + ' — traffic: ' + (p.traffic || 0);
      if (p.topKeyword) line += ', top kw: "' + p.topKeyword + '"';
      if (p.topKeywordPosition) line += ' (#' + p.topKeywordPosition + ')';
      if (p.ur) line += ', UR: ' + p.ur;
      lines.push(line);
    });
    // Quick wins: pages ranking #4-20 (close to page 1)
    var quickWins = pages.filter(function(p) {
      return p.topKeywordPosition && p.topKeywordPosition >= 4 && p.topKeywordPosition <= 20;
    }).sort(function(a, b) { return a.topKeywordPosition - b.topKeywordPosition; });
    if (quickWins.length) {
      lines.push('- Quick win pages (ranking #4-20, close to page 1):');
      quickWins.slice(0, 5).forEach(function(p) {
        lines.push('  ' + (p.slug || p.url) + ' — "' + p.topKeyword + '" at #' + p.topKeywordPosition);
      });
    }
  }
  // Tech stack if available
  if (snap.techStack && snap.techStack.length) {
    lines.push('- Tech stack: ' + snap.techStack.map(function(t) { return t.name || t; }).slice(0, 10).join(', '));
  }
  // Core Web Vitals if available
  if (snap.vitals) {
    var v = snap.vitals;
    lines.push('- Core Web Vitals: LCP ' + (v.lcp || '?') + 's, CLS ' + (v.cls || '?') + ', FID ' + (v.fid || '?') + 'ms, Performance ' + (v.performance || '?') + '/100');
  }
  // Brand SERP / Knowledge Panel
  if (snap.brandSerp) {
    var bs = snap.brandSerp;
    lines.push('BRAND SERP ("' + (bs.keyword || '') + '"):');
    lines.push('- Knowledge Panel: ' + (bs.hasKnowledgePanel ? 'YES' : 'NO'));
    lines.push('- Owns #1 result: ' + (bs.ownsPosition1 ? 'YES (' + (bs.position1Domain || '') + ')' : 'NO'));
    if (bs.serpFeatures && bs.serpFeatures.length) lines.push('- SERP features present: ' + bs.serpFeatures.join(', '));
    if (bs.knowledgePanel) {
      var kp = bs.knowledgePanel;
      if (kp.category) lines.push('- Google entity category: ' + kp.category);
      if (kp.description) lines.push('- Google description: ' + kp.description.slice(0, 150));
      if (kp.rating && kp.rating.value) lines.push('- Rating: ' + kp.rating.value + ' (' + (kp.rating.count || 0) + ' reviews)');
      if (kp.socialProfiles && kp.socialProfiles.length) lines.push('- Social profiles: ' + kp.socialProfiles.map(function(p) { return p.platform; }).join(', '));
    }
    if (bs.alsoSearchFor && bs.alsoSearchFor.length) lines.push('- People also search for: ' + bs.alsoSearchFor.slice(0, 8).join(', '));
    if (bs.alsoAsk && bs.alsoAsk.length) lines.push('- People also ask: ' + bs.alsoAsk.slice(0, 4).join(' | '));
  }
  return '\n' + lines.join('\n') + '\n';
}

function buildDiagnosticPrompt(num) {
  var r = S.research || {};
  var st = S.strategy || {};
  var enrich = st._enrichment || {};
  var ctx = _stratCtx();

  if (num === 0) {
    // D0: Audience Intelligence
    var setup0 = S.setup || {};
    return ctx + '\n\nDIAGNOSTIC: Audience Intelligence\n\n'
      + 'PRIMARY AUDIENCE: ' + (r.primary_audience_description || 'not specified') + '\n'
      + 'BUYER ROLES: ' + (r.buyer_roles_titles ? (Array.isArray(r.buyer_roles_titles) ? r.buyer_roles_titles.join(', ') : r.buyer_roles_titles) : 'unknown') + '\n'
      + 'PAIN POINTS: ' + (r.pain_points_top5 ? r.pain_points_top5.join('; ') : 'unknown') + '\n'
      + 'OBJECTIONS: ' + (r.objections_top5 ? (Array.isArray(r.objections_top5) ? r.objections_top5.join('; ') : r.objections_top5) : 'unknown') + '\n'
      + 'BEST CUSTOMERS: ' + (r.best_customer_examples || 'unknown') + '\n'
      + 'SALES CYCLE: ' + (r.sales_cycle_length || 'unknown') + '\n'
      + 'DEAL SIZE: ' + (r.average_deal_size || 'unknown') + '\n'
      + 'LEAD CHANNELS TODAY: ' + (r.lead_channels_today ? r.lead_channels_today.join(', ') : 'unknown') + '\n'
      + 'DECISION FACTORS: ' + (r.decision_factors ? (Array.isArray(r.decision_factors) ? r.decision_factors.join(', ') : r.decision_factors) : 'unknown') + '\n'
      + 'COMPETITORS: ' + (r.competitors ? r.competitors.map(function(c) { return c.name || c.url; }).join(', ') : 'none') + '\n'
      + (r.case_studies && r.case_studies.length ? 'CASE STUDIES: ' + r.case_studies.map(function(c) { return (c.client || c.name || 'Client') + ': ' + (c.result || c.outcome || ''); }).join('; ') + '\n' : '')
      + (setup0.strategy ? 'STRATEGY DOC: ' + setup0.strategy.slice(0, 3000) + '\n' : '')
      + (setup0.discoveryNotes ? 'DISCOVERY NOTES: ' + setup0.discoveryNotes.slice(0, 2000) + '\n' : '')
      + (enrich.doc_extraction ? 'DOC EXTRACTION: ' + JSON.stringify(enrich.doc_extraction).slice(0, 2000) + '\n' : '')
      + '\nTASK: Build a complete audience intelligence profile. Identify distinct audience segments, map buying motions, '
      + 'create detailed persona profiles, identify purchase triggers, map objections to segments, and validate which segments '
      + 'deserve strategic priority.\n\n'
      + 'CRITICAL PERSONA RULES:\n'
      + '1. NEVER invent fictional persona names (Marcus, Jennifer, etc.). Use descriptive labels: "Construction Owner-Operator (DIY)" or "Professional Services Managing Partner (Agency Switcher)." Archetypes are the default structure.\n'
      + '2. Archetypes are the BASE. Real client data is an ENRICHMENT LAYER:\n'
      + '   a) CLIENT HAS EXISTING CLIENTS/CASE STUDIES: Map real clients to matching archetypes. Show them as proof references in the persona: "Clients matching this persona: [real client names from case studies]." This grounds the archetype in reality.\n'
      + '   b) CLIENT IS A STARTUP / NO CLIENT DATA: Archetypes stand alone. Enrich with market research and competitor audience analysis. Flag as "archetype — not yet validated with client data."\n'
      + '3. Pain points must use ACTUAL LANGUAGE from the intake/strategy document when available. If the founder said specific phrases, those exact phrases go into the persona. No generic marketing speak.\n'
      + '4. If the intake document provides detailed persona work, ADOPT and REFINE those personas — do not replace them with AI-generated ones.\n'
      + '5. Each persona must include at least one SPECIFIC detail proving it is tailored to THIS client market: industry-specific terminology, deal size ranges from this vertical, objections common in this specific market.\n'
      + '6. The company-name-swap test applies to PAINS and LANGUAGE. If the pains read identically for any company in any industry, they are too generic.\n\n'
      + 'VERTICAL COVERAGE RULES:\n'
      + '1. Every vertical listed in the intake document or Research data MUST appear — either as an ACTIVE segment with personas, or as a DEPRIORITISED segment with explicit rationale in "parked_segments".\n'
      + '2. Deprioritisation is valid when supported by data: e.g. "DTC eCommerce deprioritised for Phase 1 because: competitive density is 3x higher, no vertical-specific case studies exist, budget constraint limits coverage to 2 verticals."\n'
      + '3. A deprioritised segment appears in "parked_segments" — it is sequenced, not deleted.\n'
      + '4. Flag if a vertical from the intake is missing: "Warning: [vertical] was listed as a target but has no active persona or deprioritisation rationale."\n'
      + '5. Downstream tabs reflect vertical decisions: if 2 verticals are active and 1 is parked, channel allocation and content should serve 2 verticals. Parked verticals appear in Growth Plan Phase 2+.\n\n'
      + 'ADDITIONAL RULES:\n'
      + '- Segments must be distinct and non-overlapping. 2-5 active segments is ideal.\n'
      + '- Each segment needs a clear "why they buy" and "why they hesitate".\n'
      + '- Buying motions describe HOW each segment purchases (research process, decision committee, timeline).\n'
      + '- Purchase triggers are the events that move someone from "aware" to "actively looking".\n'
      + '- Objection map ties each objection to specific segments and provides counter-messaging.\n'
      + '- Beyond direct competitors, identify 3-5 perceived alternatives the buyer considers: doing nothing, hiring in-house, using a freelancer, DIY tools, or other non-competitor options. For each, explain why it is attractive, how it typically fails, and provide counter-positioning language.\n'
      + '- Validation must recommend which segment(s) to prioritise and why.\n'
      + '- If data is limited, say so explicitly — do not fabricate specifics.\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "segments": [\n'
      + '    {\n'
      + '      "name": "descriptive segment name",\n'
      + '      "description": "who they are",\n'
      + '      "vertical": "which vertical or industry this segment belongs to",\n'
      + '      "status": "active | deprioritised",\n'
      + '      "estimated_size": "small | medium | large relative to total market",\n'
      + '      "revenue_potential": "low | medium | high",\n'
      + '      "why_they_buy": "core motivation — use founder language when available",\n'
      + '      "why_they_hesitate": "primary friction — use founder language when available",\n'
      + '      "acquisition_difficulty": "low | medium | high",\n'
      + '      "best_channels": ["channel1", "channel2"],\n'
      + '      "key_messages": ["message that resonates"]\n'
      + '    }\n'
      + '  ],\n'
      + '  "parked_segments": [\n'
      + '    {\n'
      + '      "name": "deprioritised segment name",\n'
      + '      "vertical": "which vertical",\n'
      + '      "rationale": "why deprioritised with specific evidence",\n'
      + '      "revisit_trigger": "what must change to activate this segment",\n'
      + '      "phase": "Phase 2 | Phase 3 | etc"\n'
      + '    }\n'
      + '  ],\n'
      + '  "buying_motions": [\n'
      + '    {\n'
      + '      "segment": "segment name",\n'
      + '      "research_behaviour": "how they find and evaluate solutions",\n'
      + '      "decision_process": "solo | committee | influencer-led",\n'
      + '      "typical_timeline": "days to months",\n'
      + '      "key_touchpoints": ["touchpoint1", "touchpoint2"],\n'
      + '      "content_needs": ["what content they need at each stage"]\n'
      + '    }\n'
      + '  ],\n'
      + '  "personas": [\n'
      + '    {\n'
      + '      "name": "Descriptive Archetype Label (e.g. Construction Owner-Operator (DIY))",\n'
      + '      "role": "specific job title or business role",\n'
      + '      "segment": "which segment they belong to",\n'
      + '      "demographics": "age range, business size, industry vertical",\n'
      + '      "goals": ["what they want to achieve"],\n'
      + '      "frustrations": ["specific pains using founder/industry language"],\n'
      + '      "decision_criteria": ["what they evaluate when choosing"],\n'
      + '      "preferred_channels": ["where they consume content"],\n'
      + '      "language_patterns": ["phrases they actually use — from intake when available"],\n'
      + '      "objection_profile": ["their specific objections"],\n'
      + '      "matching_clients": ["real client names from case studies that match this persona, or empty if none"],\n'
      + '      "industry_specific_detail": "one concrete detail proving this persona is tailored to this market"\n'
      + '    }\n'
      + '  ],\n'
      + '  "purchase_triggers": [\n'
      + '    {\n'
      + '      "trigger": "event or situation",\n'
      + '      "segments_affected": ["segment name"],\n'
      + '      "urgency_level": "low | medium | high",\n'
      + '      "messaging_angle": "how to address this trigger"\n'
      + '    }\n'
      + '  ],\n'
      + '  "objection_map": [\n'
      + '    {\n'
      + '      "objection": "the objection",\n'
      + '      "segments": ["which segments raise this"],\n'
      + '      "frequency": "rare | common | universal",\n'
      + '      "counter_message": "how to address it",\n'
      + '      "proof_needed": "what evidence overcomes this"\n'
      + '    }\n'
      + '  ],\n'
      + '  "perceived_alternatives": [\n'
      + '    {\n'
      + '      "alternative": "what the buyer considers instead (e.g. do nothing, hire in-house, use a DIY tool, hire a freelancer)",\n'
      + '      "why_considered": "why this alternative is attractive to the buyer",\n'
      + '      "failure_mode": "how this alternative typically fails or underdelivers",\n'
      + '      "threat_level": "low | medium | high",\n'
      + '      "counter_positioning": "1-2 sentences positioning the company against this alternative"\n'
      + '    }\n'
      + '  ],\n'
      + '  "vertical_coverage_check": ["Warning: [vertical] listed in intake but missing from strategy — add or deprioritise"],\n'
      + '  "validation": {\n'
      + '    "primary_segment": "recommended top-priority segment name",\n'
      + '    "primary_rationale": "why this segment should be prioritised",\n'
      + '    "secondary_segment": "second priority segment name",\n'
      + '    "recommended_focus": "1-2 sentence strategic recommendation on audience targeting",\n'
      + '    "data_gaps": ["what audience data is missing that would improve this analysis"],\n'
      + '    "confidence_notes": "honest assessment of analysis quality"\n'
      + '  },\n'
      + '  "audience_summary": "2-3 sentence overview of the audience landscape",\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 1) {
    // D1: Unit Economics
    var setup = S.setup || {};

    // Build CPC intelligence from best available source
    var cpcBlock = '';
    var kwR = S.kwResearch || {};
    if (kwR.keywords && kwR.keywords.length >= 10) {
      // Real keyword research CPC data (best source)
      var kwsWithCpc = kwR.keywords.filter(function(k) { return k.cpc && k.cpc > 0; });
      if (kwsWithCpc.length >= 3) {
        var totalCpc = kwsWithCpc.reduce(function(s, k) { return s + k.cpc; }, 0);
        var kwAvgCpc = Math.round((totalCpc / kwsWithCpc.length) * 100) / 100;
        var kwMaxCpc = Math.round(Math.max.apply(null, kwsWithCpc.map(function(k) { return k.cpc; })) * 100) / 100;
        var kwMinCpc = Math.round(Math.min.apply(null, kwsWithCpc.map(function(k) { return k.cpc; })) * 100) / 100;
        var sortedForMedian = kwsWithCpc.slice().sort(function(a, b) { return a.cpc - b.cpc; });
        var kwMedianCpc = Math.round(sortedForMedian[Math.floor(sortedForMedian.length / 2)].cpc * 100) / 100;
        // Top 10 keywords by CPC for context
        var topByCpc = kwsWithCpc.slice().sort(function(a, b) { return b.cpc - a.cpc; }).slice(0, 10);
        // CPC by intent bucket
        var highIntentKws = kwsWithCpc.filter(function(k) { var kw = (k.kw||'').toLowerCase(); return kw.indexOf('near me')>=0 || kw.indexOf('cost')>=0 || kw.indexOf('pricing')>=0 || kw.indexOf('hire')>=0 || kw.indexOf('quote')>=0 || kw.indexOf('buy')>=0; });
        var highIntentAvg = highIntentKws.length ? Math.round((highIntentKws.reduce(function(s,k){return s+k.cpc;},0) / highIntentKws.length) * 100) / 100 : null;
        cpcBlock = '\nMARKET CPC DATA (from ' + kwsWithCpc.length + ' keywords with CPC data, source: full keyword research):\n'
          + '- Average CPC: $' + kwAvgCpc + '\n'
          + '- Median CPC: $' + kwMedianCpc + '\n'
          + '- CPC range: $' + kwMinCpc + ' - $' + kwMaxCpc + '\n'
          + (highIntentAvg ? '- High-intent keyword avg CPC: $' + highIntentAvg + ' (from ' + highIntentKws.length + ' transactional keywords)\n' : '')
          + '- Top keywords by CPC:\n'
          + topByCpc.map(function(k) { return '  * "' + k.kw + '" \u2014 CPC: $' + k.cpc + ', vol: ' + (k.vol || 0) + '/mo'; }).join('\n') + '\n'
          + '- CPC data confidence: HIGH (from full keyword research with ' + kwR.keywords.length + ' keywords)\n';
        // Append Google Keyword Planner bid data if available
        var kwsWithBids = kwR.keywords.filter(function(k) { return k.high_bid && k.high_bid > 0; });
        if (kwsWithBids.length >= 3) {
          var avgLowBid = Math.round((kwsWithBids.reduce(function(s,k){return s+(k.low_bid||0);},0) / kwsWithBids.length) * 100) / 100;
          var avgHighBid = Math.round((kwsWithBids.reduce(function(s,k){return s+k.high_bid;},0) / kwsWithBids.length) * 100) / 100;
          var lowCount = kwsWithBids.filter(function(k){return k.ad_competition==='LOW';}).length;
          var medCount = kwsWithBids.filter(function(k){return k.ad_competition==='MEDIUM';}).length;
          var highCount = kwsWithBids.filter(function(k){return k.ad_competition==='HIGH';}).length;
          cpcBlock += '\nGOOGLE ADS BID DATA (from Google Keyword Planner, ' + kwsWithBids.length + ' keywords):\n'
            + '- Avg top-of-page bid range: $' + avgLowBid + ' - $' + avgHighBid + '\n'
            + '- Ad competition: ' + lowCount + ' LOW, ' + medCount + ' MEDIUM, ' + highCount + ' HIGH\n'
            + '- Bid data confidence: VERY HIGH (direct from Google Keyword Planner)\n';
        }
        // Append forecast data if available
        var fc = kwR.forecasts;
        if (fc && fc.items && fc.items.length) {
          var fcClicks = 0, fcCost = 0;
          fc.items.forEach(function(f) { fcClicks += f.clicks; fcCost += f.cost; });
          var fcAvgCpc = fcClicks > 0 ? Math.round((fcCost / fcClicks) * 100) / 100 : 0;
          cpcBlock += '\nGOOGLE ADS FORECAST (' + fc.items.length + ' keywords, $' + Math.round(fc.budget) + '/mo budget):\n'
            + '- Predicted clicks/mo: ' + Math.round(fcClicks) + '\n'
            + '- Predicted cost/mo: $' + Math.round(fcCost) + '\n'
            + '- Avg CPC (forecast): $' + fcAvgCpc + '\n';
        }
      } else {
        cpcBlock = '- CPC data: Limited \u2014 only ' + kwsWithCpc.length + ' keywords have CPC data\n';
      }
    } else if (enrich.cpc_estimates) {
      // Fallback to shallow CPC estimates
      cpcBlock = '\nMARKET CPC DATA (from shallow estimate, ' + (enrich.cpc_estimates.keyword_cpcs || []).length + ' keywords):\n'
        + '- Average CPC: $' + enrich.cpc_estimates.avg_cpc + '\n'
        + '- CPC range: $' + enrich.cpc_estimates.min_cpc + ' - $' + enrich.cpc_estimates.max_cpc + '\n'
        + '- Estimated CPL range: ' + enrich.cpc_estimates.estimated_cpl_range + '\n'
        + '- CPC data confidence: MEDIUM (from shallow keyword lookup)\n';
    } else {
      cpcBlock = '- CPC data: NOT AVAILABLE \u2014 estimates will be assumptions\n';
    }

    return ctx + '\n\nDIAGNOSTIC: Unit Economics Analysis\n\n'
      + buildPricingContextBlock()
      + _snapshotCtxBlock()
      + _buildBenchmarkContextBlock()
      + 'CLIENT DATA:\n'
      + '- Monthly marketing budget: ' + (r.monthly_marketing_budget || 'UNKNOWN') + '\n'
      + '- Average deal size: ' + (r.average_deal_size || 'UNKNOWN') + '\n'
      + '- Close rate: ' + (r.known_close_rate ? r.known_close_rate + ' (CLIENT-PROVIDED from CRM)' : (r.close_rate_estimate || 'UNKNOWN \u2014 use industry benchmark from Layer 1')) + '\n'
      + '- Customer lifetime value: ' + (r.customer_lifetime_value || 'UNKNOWN \u2014 estimate from deal size') + '\n'
      + '- Lead quality (% sales-qualified): ' + (r.lead_quality_percentage || 'UNKNOWN \u2014 assume 30%') + '\n'
      + '- Primary goal: ' + (r.primary_goal || '') + '\n'
      + (r.goal_target ? '- Measurable target: ' + r.goal_target + '\n' : '')
      + (r.goal_baseline ? '- Current baseline: ' + r.goal_baseline + '\n' : '')
      + (r.goal_timeline ? '- Goal timeline: ' + r.goal_timeline + '\n' : '')
      + '- Current lead volume: ' + (r.current_lead_volume || 'UNKNOWN') + '\n'
      + cpcBlock
      + (setup.estimated_engagement_size ? '- Estimated engagement size: ' + setup.estimated_engagement_size + '\n' : '')
      + (setup.decision_timeline ? '- Decision timeline: ' + setup.decision_timeline + '\n' : '') + '\n'
      + 'TASK: Calculate unit economics. Use the BENCHMARK DATA layers above — for each metric (CVR, CPL, close rate, retention), prefer the highest-confidence layer available. Use MARKET CPC DATA to ground your estimated_market_cpl. Use industry benchmark RANGES (low/mid/high) for the conservative/base/optimistic sensitivity scenarios. For UNKNOWN inputs, cite which benchmark layer you used. Mark every assumption explicitly.\n\n'
      + 'CRITICAL SENSITIVITY RULES:\n'
      + '1. Always present THREE scenarios (conservative, base, optimistic) — not just the midpoint.\n'
      + '   - CONSERVATIVE: Low end of deal size x low end of retention x lower close rate assumption\n'
      + '   - BASE: Midpoint estimates (default)\n'
      + '   - OPTIMISTIC: High end of deal size x high end of retention x current close rate\n'
      + '2. If the client provided RANGES (e.g. "$2-5K/mo"), use the range endpoints for conservative/optimistic.\n'
      + '3. Flag which scenario the strategy is built on. If the strategy depends on the optimistic scenario to work, that is a risk.\n'
      + '4. Show what BREAKS the economics: "If close rate drops below X%, CAC exceeds conservative LTV."\n'
      + '5. If the client provided ranges instead of exact numbers, flag it: "Deal size and retention are estimates. Confirm with CRM data."\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "max_allowable_cpl": 0,\n'
      + '  "estimated_market_cpl": 0,\n'
      + '  "budget_supports_leads": 0,\n'
      + '  "client_target_leads": 0,\n'
      + '  "gap": "shortfall or surplus description",\n'
      + '  "cpql": 0,\n'
      + '  "estimated_cac": 0,\n'
      + '  "ltv": 0,\n'
      + '  "ltv_cac_ratio": "e.g. 4.2:1",\n'
      + '  "ltv_cac_health": "unsustainable | healthy | under-investing",\n'
      + '  "paid_media_viable": true,\n'
      + '  "sensitivity": [\n'
      + '    {"scenario": "conservative", "close_rate": "X%", "avg_deal": 0, "max_cpl": 0, "leads_needed": 0, "ltv_cac": "X:1", "verdict": "tight but viable | unhealthy | etc"},\n'
      + '    {"scenario": "base", "close_rate": "X%", "avg_deal": 0, "max_cpl": 0, "leads_needed": 0, "ltv_cac": "X:1", "verdict": "healthy | etc"},\n'
      + '    {"scenario": "optimistic", "close_rate": "X%", "avg_deal": 0, "max_cpl": 0, "leads_needed": 0, "ltv_cac": "X:1", "verdict": "strong | etc"}\n'
      + '  ],\n'
      + '  "strategy_built_on": "conservative | base | optimistic",\n'
      + '  "break_even_floor": "what breaks the economics — e.g. close rate below X%",\n'
      + '  "input_quality": "client-provided | estimated | mixed — specify which inputs are estimated",\n'
      + '  "market_cpc_summary": {\n'
      + '    "avg_cpc": 0,\n'
      + '    "median_cpc": 0,\n'
      + '    "cpc_range": "$X - $Y",\n'
      + '    "high_intent_avg_cpc": 0,\n'
      + '    "data_source": "keyword_research | shallow_estimate | assumption",\n'
      + '    "cpc_to_cpl_multiplier": 0,\n'
      + '    "rationale": "how CPC data informed the CPL estimate"\n'
      + '  },\n'
      + '  "pricing_strategy": "recommendation",\n'
      + '  "recommendation": "narrative recommendation",\n'
      + '  "assumptions": ["each assumption made"],\n'
      + '  "benchmark_sources": {\n'
      + '    "cvr_source": "layer_1_benchmark | layer_2_gkp | layer_3_client | assumption",\n'
      + '    "cpl_source": "layer_1_benchmark | layer_2_gkp | layer_3_client | cpc_derived",\n'
      + '    "close_rate_source": "layer_1_benchmark | layer_3_client | client_provided | assumption"\n'
      + '  },\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 2) {
    // D2: Competitive Position
    var compInfo = '';
    if (r.competitors && r.competitors.length) {
      compInfo = r.competitors.map(function(c) {
        return '- ' + c.name + ' (' + c.url + '): Wins because: ' + c.why_they_win + '. Weak at: ' + c.weaknesses;
      }).join('\n');
    }
    var deepDive = '';
    if (enrich.competitor_deep_dive && enrich.competitor_deep_dive.length) {
      deepDive = enrich.competitor_deep_dive.map(function(cd) {
        return '\n' + (cd.url || 'Unknown') + ':\n  Positioning: ' + (cd.positioning || '') + '\n  Strengths: ' + (cd.strengths || []).join(', ') + '\n  Weaknesses: ' + (cd.weaknesses || []).join(', ');
      }).join('');
    }

    // Include selected direction as constraint if available
    var directionConstraint = '';
    var posDir = st.positioning && st.positioning.selected_direction;
    if (posDir) {
      directionConstraint = '\nSELECTED POSITIONING DIRECTION (MUST constrain all outputs to this):\n'
        + '- Direction: ' + (posDir.direction || '') + '\n'
        + (posDir.headline ? '- Headline: ' + posDir.headline + '\n' : '')
        + (posDir.rationale ? '- Rationale: ' + posDir.rationale + '\n' : '')
        + (posDir.what_changes_if_chosen ? '- Impact: ' + posDir.what_changes_if_chosen + '\n' : '')
        + '\nYour positioning angle, value proposition, messaging hierarchy, brand voice direction, and proof strategy MUST all align with and serve this direction. Do not contradict it or propose an alternative.\n\n';
    }

    // Include positioning to avoid as hard constraint
    var posAvoid = st.positioning && st.positioning.positioning_to_avoid;
    if (posAvoid && posAvoid.length) {
      var _avoidFiltered = posAvoid.filter(function(a) { return a && a.trim(); });
      if (_avoidFiltered.length) {
        directionConstraint += 'POSITIONING TO AVOID (founder explicitly rejects — do NOT position the client this way):\n'
          + _avoidFiltered.map(function(a) { return '- ' + a; }).join('\n') + '\n'
          + 'Ensure the value proposition, messaging, and brand voice do not overlap with or imply any of the avoided positions.\n\n';
      }
    }

    // Include hypothesis evaluations context if available
    var hypCtx = '';
    var posHyps = st.positioning && st.positioning.hypothesis_evaluations;
    if (posHyps && posHyps.length) {
      hypCtx = '\nHYPOTHESIS EVALUATION RESULTS:\n' + posHyps.map(function(h) {
        return '- "' + h.hypothesis + '" — ' + h.verdict + (h.reframing ? ' (reframing: ' + h.reframing + ')' : '');
      }).join('\n') + '\n';
    }

    return ctx + '\n\nDIAGNOSTIC: Competitive Position Assessment\n\n'
      + directionConstraint
      + 'CLIENT SERVICES: ' + JSON.stringify((r.services_detail || []).map(function(s) { return s.name; })) + '\n'
      + 'CLIENT CLAIMED STRENGTHS: ' + JSON.stringify(r.existing_proof || r.proof_points || []) + '\n'
      + 'CLIENT AWARDS/CERTS: ' + JSON.stringify(r.awards_certifications || []) + '\n\n'
      + 'COMPETITORS:\n' + (compInfo || 'No competitor data available') + '\n\n'
      + 'COMPETITOR DEEP-DIVE DATA:\n' + (deepDive || 'NOT YET AVAILABLE \u2014 score confidence lower') + '\n\n'
      + hypCtx
      + 'TASK: Validate differentiators using COMPETITIVE INTENSITY analysis — not binary accept/reject. For each potential differentiator, evaluate HOW DEEPLY competitors actually execute on it (not just whether they mention it). A competitor claiming "AI-powered" on their website is very different from a competitor whose entire product is built on AI.\n\n'
      + 'COMPETITIVE INTENSITY LEVELS:\n'
      + '- "uncontested" = No competitor claims this territory. Strong differentiator, lead with it.\n'
      + '- "weakly_contested" = A competitor mentions it but lacks depth, proof, or genuine execution. CLAIMABLE if the client can prove deeper expertise. Suggest specific proof points.\n'
      + '- "strongly_contested" = A competitor is genuinely known for this and has real proof (case studies, proprietary tech, certifications). Risky unless the client can demonstrably out-execute.\n'
      + '- "category_owned" = A competitor IS this in the market\'s mind. Fighting their brand equity is not viable.\n\n'
      + 'CRITICAL: Do NOT reject a differentiator just because a competitor mentions it. Evaluate the DEPTH of their execution. A competitor listing "AI-powered solutions" as a bullet point on their services page is weakly_contested at best — the client may do it 10x deeper. Only mark as strongly_contested or category_owned when the competitor has genuine proof and market recognition.\n\n'
      + 'Also analyse the gap between what the buyer thinks they are buying and what the company actually sells. Most buyers enter with a commodity mental model (e.g. "I need a website" or "I need SEO"). Identify the buyer\'s starting category frame, the company\'s actual value frame, the severity of the gap, and generate reframing language that bridges it.'
      + (posDir ? ' A positioning direction has been SELECTED — align ALL outputs to it.' : ' NO positioning direction has been selected yet. Generate the competitive analysis (market_position, differentiators, positioning_gaps) but set messaging_hierarchy, brand_voice_direction, core_value_proposition, and proof_strategy to placeholder values with "direction_required": true. These fields cannot be finalised until the strategist selects a direction.') + '\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "market_position": "where client sits vs competitors",\n'
      + '  "authority_gap": "DR/content/backlink gap description",\n'
      + '  "positioning_gaps": ["territories no competitor is claiming"],\n'
      + '  "validated_differentiators": ["differentiators rated uncontested — no competitor claims this territory"],\n'
      + '  "contested_differentiators": [{"claim": "the differentiator angle", "intensity": "weakly_contested | strongly_contested | category_owned", "competitor": "which competitor(s) contest this", "competitor_depth": "1-2 sentence assessment of HOW DEEPLY the competitor actually executes on this — surface-level marketing copy vs genuine capability", "claimable": true, "proof_needed": "specific proof the client would need to credibly claim this despite competition"}],\n'
      + '  "competitive_advantages": ["genuine advantages"],\n'
      + '  "biggest_threat": "string",\n'
      + '  "direction_required": false,\n'
      + '  "recommended_positioning_angle": "territory to claim",\n'
      + '  "core_value_proposition": "validated value prop",\n'
      + '  "recommended_tagline": "short, punchy",\n'
      + '  "messaging_hierarchy": {\n'
      + '    "primary_message": "string",\n'
      + '    "supporting_messages": ["string"],\n'
      + '    "proof_points": ["specific evidence"]\n'
      + '  },\n'
      + '  "competitive_counter": "how this positioning beats top competitors",\n'
      + '  "brand_voice_direction": {\n'
      + '    "style": "string",\n'
      + '    "tone_detail": "string",\n'
      + '    "words_to_use": ["string"],\n'
      + '    "words_to_avoid": ["string"],\n'
      + '    "voice_rationale": "string",\n'
      + '    "vertical_overlays": [{"vertical": "segment or vertical name", "adjustments": "what changes for this vertical", "words_permitted": ["words OK in this vertical but banned globally"], "words_banned": ["additional bans for this vertical"]}]\n'
      + '  },\n'
      + '  "category_perception": {\n'
      + '    "buyer_frame": "what the buyer thinks they are shopping for (their mental category)",\n'
      + '    "actual_frame": "what the company is actually selling (the real value proposition)",\n'
      + '    "perception_gap": "description of the gap between buyer frame and actual frame",\n'
      + '    "gap_severity": "none | mild | significant | fundamental",\n'
      + '    "reframing_language": "2-3 sentences that bridge from buyer category to actual value — use on homepage and landing pages",\n'
      + '    "reframing_trigger_pages": ["homepage", "service pages where reframing matters most"]\n'
      + '  },\n'
      + '  "proof_strategy": ["proof to build that does not exist yet"],\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 3) {
    // D3: Subtraction Analysis
    var econCtx = st.unit_economics ? '\nUNIT ECONOMICS (from D1):\n- Max CPL: $' + (st.unit_economics.max_allowable_cpl || '?')
      + '\n- Estimated CAC: $' + (st.unit_economics.estimated_cac || '?')
      + '\n- LTV:CAC: ' + (st.unit_economics.ltv_cac_ratio || '?')
      + '\n- Paid viable: ' + (st.unit_economics.paid_media_viable ? 'Yes' : 'No') + '\n' : '';
    return ctx + '\n\nDIAGNOSTIC: Subtraction Analysis\n\n'
      + 'This is the signature Setsail diagnostic. Identify what the client should STOP doing BEFORE recommending what to build.\n\n'
      + 'CURRENT MARKETING ACTIVITIES: ' + JSON.stringify(r.current_marketing_activities || []) + '\n'
      + 'CURRENT LEAD CHANNELS: ' + JSON.stringify(r.lead_channels_today || []) + '\n'
      + 'MONTHLY BUDGET: ' + (r.monthly_marketing_budget || 'UNKNOWN') + '\n'
      + 'CURRENT PRICING/VENDOR COSTS: ' + (r.current_pricing || r.pricing_notes || 'UNKNOWN') + '\n'
      + 'PAIN POINTS: ' + JSON.stringify(r.pain_points_top5 || []) + '\n'
      + 'PREVIOUS AGENCY EXPERIENCE: ' + (r.previous_agency_experience || 'UNKNOWN') + '\n'
      + 'CURRENT LEAD VOLUME: ' + (r.current_lead_volume || 'UNKNOWN') + '\n'
      + 'SITE PERFORMANCE: ' + JSON.stringify(enrich.current_presence || 'NOT ASSESSED') + '\n'
      + econCtx + '\n'
      + 'TASK: Audit every current marketing activity. For each one: estimate monthly cost, determine verdict (cut/keep/restructure), explain why. '
      + 'Calculate total recoverable budget. Recommend where to redirect recovered budget (reference channels from the business context). '
      + 'State all assumptions explicitly — distinguish estimated costs from confirmed ones.\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "current_activities_audit": [\n'
      + '    {\n'
      + '      "activity": "description of the marketing activity",\n'
      + '      "monthly_cost": 0,\n'
      + '      "monthly_cost_source": "estimated from team time | from client ad spend data | from contractor invoices | unknown",\n'
      + '      "verdict": "cut | keep | restructure",\n'
      + '      "reason": "why this verdict — reference economics if relevant",\n'
      + '      "confidence": "high | medium | low"\n'
      + '    }\n'
      + '  ],\n'
      + '  "total_recoverable_monthly": 0,\n'
      + '  "total_recoverable_confidence": "high | medium | low",\n'
      + '  "recovery_assumptions": ["assumption about cost source or team allocation"],\n'
      + '  "redirect_recommendations": [\n'
      + '    {\n'
      + '      "from": "activity being cut or restructured",\n'
      + '      "to": "recommended replacement channel or activity",\n'
      + '      "rationale": "why this redirect makes sense"\n'
      + '    }\n'
      + '  ],\n'
      + '  "subtraction_summary": "2-3 sentence executive summary of waste found and recovery potential",\n'
      + '  "score": {\n'
      + '    "data_completeness": 0,\n'
      + '    "analytical_confidence": 0,\n'
      + '    "specificity": 0\n'
      + '  },\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 4) {
    // D4: Channel & Lever Viability
    return ctx + '\n\nDIAGNOSTIC: Channel & Lever Viability Assessment\n\n'
      + buildPricingContextBlock()
      + _snapshotCtxBlock()
      + 'UNIT ECONOMICS: ' + JSON.stringify(st.unit_economics || 'NOT YET CALCULATED') + '\n'
      + 'COMPETITIVE POSITION: ' + (st.positioning ? st.positioning.recommended_positioning_angle || '' : 'NOT YET ASSESSED') + '\n'
      + 'BUDGET: ' + (r.monthly_marketing_budget || 'UNKNOWN') + '\n'
      + 'AUDIENCE: ' + (r.primary_audience_description || '') + '\n'
      + 'SALES CYCLE: ' + (r.sales_cycle_length || 'UNKNOWN') + '\n'
      + 'CPC DATA: ' + JSON.stringify(enrich.cpc_estimates || 'UNKNOWN') + '\n'
      + (function() {
        var kwR = S.kwResearch || {};
        if (kwR.keywords && kwR.keywords.length >= 10) {
          var kwsC = kwR.keywords.filter(function(k) { return k.cpc > 0; });
          if (kwsC.length >= 3) {
            var avg = Math.round((kwsC.reduce(function(s,k){return s+k.cpc;},0)/kwsC.length)*100)/100;
            return 'KEYWORD RESEARCH CPC (more accurate, ' + kwsC.length + ' keywords): avg $' + avg
              + ', range $' + Math.round(Math.min.apply(null,kwsC.map(function(k){return k.cpc;}))*100)/100
              + ' - $' + Math.round(Math.max.apply(null,kwsC.map(function(k){return k.cpc;}))*100)/100 + '\n';
          }
        }
        return '';
      })() + '\n'
      + _kwContextBlock('channels')
      + 'TASK: Score ALL 13 levers on fit (1-10), economics (1-10), competitive_reality (1-10), goal_impact (1-10). '
      + 'Calculate priority scores. Check funnel coverage. Produce TIERED budget allocation.\n\n'
      + 'CRITICAL BUDGET RULES:\n'
      + '1. ALWAYS produce three budget tiers: current_budget (the client STATED budget — this is the actionable plan), growth_budget (2-3x stated — "when ready to scale"), optimal_budget (system recommendation for maximum ROI).\n'
      + '2. The CURRENT BUDGET tier is PRIMARY. It appears first. Lever scores, percentages, and timelines reflect the actual available budget.\n'
      + '3. For CURRENT BUDGET: if the budget only supports 2-3 channels, recommend ONLY 2-3. Do NOT spread thin across 9 channels. Rank by: (a) lowest cost to activate, (b) fastest time to results, (c) highest ROI at this budget level. Include $0 channels explicitly: referral systematisation, email to existing list, GBP optimisation, content refresh using team time.\n'
      + '4. For GROWTH and OPTIMAL tiers: show what each budget increment UNLOCKS. Connect increases to specific revenue outcomes.\n'
      + '5. NEVER recommend a budget 3x+ higher than stated without explicitly acknowledging the gap and providing a phased path.\n'
      + '6. EDGE CASE — budget too low for any paid channel: If stated budget cannot support even one paid channel at minimum viable spend, recommend $0-budget activities ONLY and specify what threshold unlocks the first paid channel.\n\n'
      + 'LEVERS: google_ads_search, google_display, meta_ads, seo, website, cro, email, remarketing, social_media, video, content_marketing, branding, local_seo\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "levers": [{"lever": "string", "category": "paid | organic | owned | earned", "funnel_stage": "awareness | consideration | conversion | nurture | retention", '
      + '"fit": 0, "economics": 0, "competitive_reality": 0, "goal_impact": 0, "priority_score": 0, '
      + '"recommendation": "string", "budget_allocation_pct": 0, "timeline_to_results": "string", "dependencies": ["string"]}],\n'
      + '  "priority_order": ["lever names in priority order"],\n'
      + '  "levers_not_recommended": [{"lever": "string", "reason": "string", "revisit_when": "string"}],\n'
      + '  "budget_tiers": {\n'
      + '    "current_budget": {\n'
      + '      "total_monthly": 0,\n'
      + '      "source": "client-stated budget",\n'
      + '      "expected_leads": "X leads/mo",\n'
      + '      "expected_cpl": 0,\n'
      + '      "active_channels": ["only channels viable at this budget"],\n'
      + '      "by_lever": {},\n'
      + '      "zero_cost_activities": ["referral systematisation", "GBP optimisation", "etc"],\n'
      + '      "rationale": "what this budget can realistically achieve",\n'
      + '      "limitations": "what cannot be done at this budget"\n'
      + '    },\n'
      + '    "growth_budget": {\n'
      + '      "total_monthly": 0,\n'
      + '      "expected_leads": "X leads/mo",\n'
      + '      "expected_cpl": 0,\n'
      + '      "unlocks": ["what becomes possible at this budget"],\n'
      + '      "by_lever": {},\n'
      + '      "rationale": "why this tier unlocks meaningful growth",\n'
      + '      "expected_impact": "specific revenue outcome"\n'
      + '    },\n'
      + '    "optimal_budget": {\n'
      + '      "total_monthly": 0,\n'
      + '      "expected_leads": "X leads/mo",\n'
      + '      "expected_cpl": 0,\n'
      + '      "rationale": "why this is the optimal spend level",\n'
      + '      "by_lever": {},\n'
      + '      "expected_impact": "specific revenue outcome"\n'
      + '    },\n'
      + '    "paid_viability_floor": "minimum budget needed for first paid channel and which channel"\n'
      + '  },\n'
      + '  "budget_allocation": {"total_monthly": 0, "by_lever": {}},\n'
      + '  "funnel_coverage": {\n'
      + '    "awareness": {"covered": false, "by": [], "gap": ""},\n'
      + '    "consideration": {"covered": false, "by": [], "gap": ""},\n'
      + '    "conversion": {"covered": false, "by": [], "gap": ""},\n'
      + '    "nurture": {"covered": false, "by": [], "gap": ""},\n'
      + '    "retention": {"covered": false, "by": [], "gap": ""}\n'
      + '  },\n'
      + '  "funnel_gaps_flagged": ["string"],\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 5) {
    // D5: Website & Conversion
    return ctx + '\n\nDIAGNOSTIC: Website & Conversion Assessment\n\n'
      + _snapshotCtxBlock()
      + 'CURRENT SITE: ' + JSON.stringify(enrich.current_presence || 'NOT ASSESSED') + '\n'
      + 'HAS SERVICE PAGES: ' + (r.has_service_pages || 'unknown') + '\n'
      + 'HAS BLOG: ' + (r.has_blog || 'unknown') + '\n'
      + 'HAS FAQ: ' + (r.has_faq_section || 'unknown') + '\n'
      + 'BOOKING FLOW: ' + (r.booking_flow_description || 'unknown') + '\n'
      + 'SERVICES: ' + JSON.stringify((r.services_detail || []).map(function(s) { return s.name; })) + '\n'
      + 'AUDIENCE: ' + (r.primary_audience_description || '') + '\n'
      + _kwContextBlock('website')
      + '\nTASK: Assess website and conversion infrastructure. Recommend build type, form strategy, page architecture.\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "build_type": "redesign | refresh | new_build | optimise_existing",\n'
      + '  "prerequisite_work": ["string"],\n'
      + '  "conversion_strategy": "string",\n'
      + '  "form_strategy": {\n'
      + '    "primary_form_purpose": "string",\n'
      + '    "recommended_fields": ["string"],\n'
      + '    "field_rationale": "string",\n'
      + '    "qualification_fields": ["string"],\n'
      + '    "max_fields_recommended": "string"\n'
      + '  },\n'
      + '  "tracking_requirements": ["string"],\n'
      + '  "architecture_direction": {\n'
      + '    "page_types_needed": ["service | location | blog | landing"],\n'
      + '    "vertical_pages": ["page needed"],\n'
      + '    "location_pages": ["page needed"],\n'
      + '    "content_pages": ["page needed"],\n'
      + '    "pages_to_cut": ["page to remove"]\n'
      + '  },\n'
      + '  "primary_cta": "main conversion action",\n'
      + '  "secondary_ctas": ["string"],\n'
      + '  "low_commitment_cta": "low-friction entry point",\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 6) {
    // D6: Content & Authority Gap
    var kwData = '';
    if (enrich.keyword_pre_scan) {
      kwData = 'Total volume: ' + enrich.keyword_pre_scan.total_volume
        + ', Avg difficulty: ' + enrich.keyword_pre_scan.avg_difficulty
        + ', Landscape: ' + enrich.keyword_pre_scan.estimated_difficulty_landscape;
    }
    // Pull DR data from snapshot if available
    var snap = S.snapshot || {};
    var dm = snap.domainMetrics || {};
    var clientDR = dm.dr || snap.domain_rating || null;
    var drData = clientDR ? 'Client DR: ' + clientDR : 'Client DR: UNKNOWN';
    if (dm.orgTraffic) drData += ', Organic traffic: ' + dm.orgTraffic;
    else if (snap.organic_traffic) drData += ', Organic traffic: ' + snap.organic_traffic;
    if (dm.liveRefdomains) drData += ', Referring domains: ' + dm.liveRefdomains;
    else if (snap.referring_domains) drData += ', Referring domains: ' + snap.referring_domains;
    if (dm.liveBacklinks) drData += ', Live backlinks: ' + dm.liveBacklinks;
    // Pull competitor DR data from enrichment deep-dive AND full competitor list
    var compDRs = '';
    var deepDive = enrich.competitor_deep_dive || [];
    var allComps = r.competitors || [];
    // Build a merged competitor list: deep-dive data first (has DR), then remaining competitors
    var deepDiveUrls = {};
    deepDive.forEach(function(c) { if (c.url) deepDiveUrls[c.url.replace(/\/+$/, '')] = true; });
    var mergedComps = deepDive.map(function(c) {
      return (c.name || c.url) + ' (DR: ' + (c.domain_rating || c.dr || '?') + ', traffic: ' + (c.organic_traffic || '?') + ')';
    });
    allComps.forEach(function(c) {
      var normUrl = (c.url || '').replace(/\/+$/, '');
      if (normUrl && !deepDiveUrls[normUrl]) {
        mergedComps.push((c.name || c.url) + ' (URL: ' + c.url + ', DR: unknown)');
      }
    });
    compDRs = mergedComps.join('; ');
    return ctx + '\n\nDIAGNOSTIC: Content & Authority Gap Analysis\n\n'
      + 'DOMAIN AUTHORITY: ' + drData + '\n'
      + 'ALL COMPETITORS WITH DR DATA: ' + (compDRs || 'NOT YET AVAILABLE') + '\n'
      + 'IMPORTANT: Include ALL competitors listed above in dr_gap_analysis.competitor_drs, not just the ones with known DR. Estimate DR for competitors where it is unknown based on their domain age, backlink profile, and industry position.\n'
      + 'COMPETITOR DEEP-DIVE: ' + JSON.stringify(enrich.competitor_deep_dive || 'NOT YET AVAILABLE') + '\n'
      + 'KEYWORD LANDSCAPE: ' + (kwData || 'NOT YET SCANNED') + '\n'
      + _kwContextBlock('content')
      + 'TEAM SIZE: ' + (r.team_size || 'unknown') + '\n'
      + 'INDUSTRY: ' + (r.industry || 'unknown') + '\n'
      + 'ACTIVE AUDIENCE SEGMENTS: ' + (st.audience && st.audience.segments ? st.audience.segments.filter(function(s){return s.status !== 'deprioritised';}).map(function(s){return s.name + ' (' + (s.vertical||'') + ')';}).join(', ') : 'not yet analysed') + '\n'
      + 'PARKED SEGMENTS: ' + (st.audience && st.audience.parked_segments ? st.audience.parked_segments.map(function(s){return s.name + ' (phase: ' + (s.phase||'?') + ')';}).join(', ') : 'none') + '\n\n'
      + 'TASK: Produce a full content and authority gap analysis with these sections:\n'
      + '1. Content pillars and velocity — map pillars to active audience segments/verticals\n'
      + '2. Domain authority gap analysis with competitor comparison\n'
      + '3. Authority building timeline in 3 phases\n'
      + '4. Quick wins (low-effort, high-impact content actions)\n\n'
      + 'VOICE RULES: Content pillars should specify which audience segment or vertical each pillar serves. If the client has 2+ active verticals, tag each content piece with its target vertical. Blog posts tagged by target vertical enable voice overlay matching.\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "content_pillars": ["topic pillar"],\n'
      + '  "content_priority": [{"topic": "string", "rationale": "string", "format": "string"}],\n'
      + '  "preferred_formats": ["blog | video | case_study | whitepaper | tool"],\n'
      + '  "content_velocity": "posts per month recommendation",\n'
      + '  "content_mix": [{"type": "content type", "monthly": 0, "purpose": "why this type"}],\n'
      + '  "team_capacity_check": "assessment of whether team can handle recommended velocity",\n'
      + '  "team_size_input_needed": true,\n'
      + '  "dr_gap_analysis": {\n'
      + '    "client_dr": 0,\n'
      + '    "client_dr_source": "from snapshot data | estimated",\n'
      + '    "competitor_drs": [{"name": "string", "dr": 0}],\n'
      + '    "dr_gap": "X points below competitor average",\n'
      + '    "realistic_dr_target_12mo": 0,\n'
      + '    "dr_growth_strategy": "how to close the gap",\n'
      + '    "backlink_gap_summary": "referring domain comparison"\n'
      + '  },\n'
      + '  "authority_timeline": [\n'
      + '    {\n'
      + '      "phase": "Foundation (Months 1-3)",\n'
      + '      "milestones": ["milestone"],\n'
      + '      "expected_dr_gain": "+X points",\n'
      + '      "measurement": "how to track progress"\n'
      + '    }\n'
      + '  ],\n'
      + '  "quick_wins": [\n'
      + '    {\n'
      + '      "opportunity": "what to do",\n'
      + '      "effort": "Low | Medium | High",\n'
      + '      "timeline": "Week 1-2",\n'
      + '      "expected_impact": "what this achieves"\n'
      + '    }\n'
      + '  ],\n'
      + '  "authority_building": "overall strategy summary",\n'
      + '  "local_seo_priority": "high | medium | low | not_applicable",\n'
      + '  "geo_targeting_strategy": "string",\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 7) {
    // D7: Risk Assessment
    var setup7 = S.setup || {};
    return ctx + '\n\nDIAGNOSTIC: Risk Assessment\n\n'
      + 'UNIT ECONOMICS: ' + JSON.stringify(st.unit_economics || 'NOT CALCULATED') + '\n'
      + 'CHANNEL STRATEGY: ' + (st.channel_strategy && st.channel_strategy.priority_order ? st.channel_strategy.priority_order.join(', ') : 'NOT ASSESSED') + '\n'
      + 'SALES CYCLE: ' + (r.sales_cycle_length || 'unknown') + '\n'
      + 'TEAM SIZE: ' + (r.team_size || 'unknown') + '\n'
      + 'COMPETITORS: ' + (r.competitors ? r.competitors.length + ' identified' : 'none') + '\n'
      + 'DEMAND VALIDATION: ' + (st.demand_validation && st.demand_validation.overall_verdict ? st.demand_validation.overall_verdict : 'NOT YET RUN') + '\n'
      + 'PREVIOUS AGENCY EXPERIENCE: ' + (r.previous_agency_experience || 'unknown') + '\n'
      + (setup7.deal_likelihood ? 'DEAL LIKELIHOOD: ' + setup7.deal_likelihood + '\n' : '')
      + (setup7.decision_maker_on_call ? 'DECISION MAKER ON CALL: ' + setup7.decision_maker_on_call + '\n' : '')
      + (setup7.decision_timeline ? 'DECISION TIMELINE: ' + setup7.decision_timeline + '\n' : '')
      + (setup7.sales_notes ? 'SALES NOTES: ' + setup7.sales_notes + '\n' : '') + '\n'
      + 'TASK: Score 8 risk categories on severity (1-10) x likelihood (1-10). Provide mitigation for each.\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "risks": [\n'
      + '    {"risk": "budget_risk", "severity": 0, "likelihood": 0, "impact": "string", "mitigation": "string", "owner": "agency | client | shared"},\n'
      + '    {"risk": "timeline_risk", "severity": 0, "likelihood": 0, "impact": "string", "mitigation": "string", "owner": "string"},\n'
      + '    {"risk": "authority_risk", "severity": 0, "likelihood": 0, "impact": "string", "mitigation": "string", "owner": "string"},\n'
      + '    {"risk": "conversion_risk", "severity": 0, "likelihood": 0, "impact": "string", "mitigation": "string", "owner": "string"},\n'
      + '    {"risk": "resource_risk", "severity": 0, "likelihood": 0, "impact": "string", "mitigation": "string", "owner": "string"},\n'
      + '    {"risk": "market_risk", "severity": 0, "likelihood": 0, "impact": "string", "mitigation": "string", "owner": "string"},\n'
      + '    {"risk": "positioning_risk", "severity": 0, "likelihood": 0, "impact": "string", "mitigation": "string", "owner": "string"},\n'
      + '    {"risk": "demand_risk", "severity": 0, "likelihood": 0, "impact": "string", "mitigation": "string", "owner": "string"}\n'
      + '  ],\n'
      + '  "overall_confidence": "high | medium | low",\n'
      + '  "confidence_reasoning": "string"\n}';
  }

  if (num === 8) {
    var r = S.research || {};
    var setup0 = S.setup || {};
    var st = S.strategy || {};

    // Determine data tier
    var hasTranscripts = !!(r.voc_swipe_raw && r.voc_swipe_raw.length > 50);
    var hasPainPoints = !!(r.pain_points_top5 && r.pain_points_top5.length >= 2);
    var hasJTBD = !!(r.jtbd_forces && (r.jtbd_forces.push_forces || []).length > 0);
    var dataTier = hasTranscripts ? 'transcript' : (hasPainPoints || hasJTBD) ? 'research' : 'web-only';

    return _stratCtx()
      + '\n' + _snapshotCtxBlock()
      + '\nDATA TIER: ' + dataTier + (dataTier === 'web-only' ? ' — infer buyer psychology from competitive positioning and industry patterns. Flag all inferred claims with [inferred]. Set confidence to 1-3.' : '')
      + '\n\n--- D0 AUDIENCE CONTEXT ---\n'
      + (st.audience ? 'SEGMENTS: ' + JSON.stringify((st.audience.segments || []).map(function(s) { return { segment: s.segment_name, pain: s.pain_driver, motion: s.buying_motion }; })) : 'Not yet run')
      + (st.audience && st.audience.personas ? '\nPERSONAS: ' + JSON.stringify(st.audience.personas.map(function(p) { return { archetype: p.archetype || p.name, pain_points: p.pain_points }; })) : '')
      + (st.audience && st.audience.purchase_triggers ? '\nPURCHASE TRIGGERS: ' + JSON.stringify(st.audience.purchase_triggers) : '')
      + (st.audience && st.audience.perceived_alternatives ? '\nPERCEIVED ALTERNATIVES: ' + JSON.stringify(st.audience.perceived_alternatives.map(function(a) { return { alternative: a.alternative, threat: a.threat_level }; })) : '')
      + (st.audience && st.audience.objection_map ? '\nEXISTING OBJECTION MAP: ' + JSON.stringify(st.audience.objection_map) : '')
      + '\n\n--- D2 POSITIONING CONTEXT ---\n'
      + (st.positioning ? 'SELECTED DIRECTION: ' + (typeof st.positioning.selected_direction === 'string' ? st.positioning.selected_direction : JSON.stringify(st.positioning.selected_direction || '')) : 'Not yet run')
      + (st.positioning && st.positioning.messaging_hierarchy ? '\nMESSAGING HIERARCHY: ' + JSON.stringify(st.positioning.messaging_hierarchy) : '')
      + (st.positioning && st.positioning.brand_voice_direction ? '\nBRAND VOICE: ' + JSON.stringify(st.positioning.brand_voice_direction) : '')
      + (st.positioning && st.positioning.validated_differentiators ? '\nDIFFERENTIATORS: ' + JSON.stringify(st.positioning.validated_differentiators) : '')
      + (st.positioning && st.positioning.category_perception ? '\nCATEGORY PERCEPTION: ' + JSON.stringify(st.positioning.category_perception) : '')
      + '\n\n--- D3 SUBTRACTION CONTEXT ---\n'
      + (st.subtraction && st.subtraction.current_activities_audit ? 'ACTIVITY VERDICTS: ' + JSON.stringify(st.subtraction.current_activities_audit.map(function(a) { return { activity: a.activity, verdict: a.verdict }; })) : 'Not yet run')
      + '\n\n--- D5 CTA CONTEXT ---\n'
      + (st.execution_plan && st.execution_plan.lever_details && st.execution_plan.lever_details.website
          ? 'PRIMARY CTA: ' + (st.execution_plan.lever_details.website.primary_cta || st.execution_plan.primary_cta || '')
          + '\nSECONDARY CTAs: ' + JSON.stringify(st.execution_plan.lever_details.website.secondary_ctas || st.execution_plan.secondary_ctas || [])
          + '\nLOW COMMITMENT CTA: ' + (st.execution_plan.lever_details.website.low_commitment_cta || st.execution_plan.low_commitment_cta || '')
          : 'Not yet run')
      + '\n\n--- RESEARCH: PAIN & BUYER DATA ---\n'
      + 'PAIN POINTS: ' + (r.pain_points_top5 || []).join('; ')
      + '\nOBJECTIONS: ' + (r.objections_top5 || []).join('; ')
      + (r.clientPain && r.clientPain.primary ? '\nCLIENT PAIN PRIMARY: ' + r.clientPain.primary : '')
      + (r.clientPain && r.clientPain.consequence ? '\nCONSEQUENCE: ' + r.clientPain.consequence : '')
      + (r.clientPain && r.clientPain.urgencyTrigger ? '\nURGENCY TRIGGER: ' + r.clientPain.urgencyTrigger : '')
      + (r.clientPain && r.clientPain.successDefinition ? '\nSUCCESS DEFINITION: ' + r.clientPain.successDefinition : '')
      + (r.clientPain && r.clientPain.clientQuotes && r.clientPain.clientQuotes.length ? '\nCLIENT QUOTES: ' + r.clientPain.clientQuotes.join(' | ') : '')
      + '\n\n--- JTBD FORCE MAP ---\n'
      + (hasJTBD ? 'PUSH FORCES: ' + JSON.stringify(r.jtbd_forces.push_forces || [])
          + '\nPULL FORCES: ' + JSON.stringify(r.jtbd_forces.pull_forces || [])
          + '\nANXIETIES: ' + JSON.stringify(r.jtbd_forces.anxieties || [])
          + '\nHABITS: ' + JSON.stringify(r.jtbd_forces.habits || [])
          : 'Not yet captured')
      + (r.buyer_sophistication ? '\nBUYER SOPHISTICATION: ' + r.buyer_sophistication + '/5' : '')
      + (r.perceived_categories && r.perceived_categories.length ? '\nPERCEIVED CATEGORIES: ' + r.perceived_categories.join(', ') : '')
      + (r.switching_triggers && r.switching_triggers.length ? '\nSWITCHING TRIGGERS: ' + r.switching_triggers.join('; ') : '')
      + (r.decision_criteria && r.decision_criteria.length ? '\nDECISION CRITERIA: ' + JSON.stringify(r.decision_criteria) : '')
      + '\n\n--- VOC / TRANSCRIPT DATA ---\n'
      + (r.voc_swipe_raw ? r.voc_swipe_raw.slice(0, 3000) : 'No VoC data available')
      + '\n\nTASK: Build a Narrative & Messaging framework for the CLIENT\'S WEBSITE — how this business should talk to ITS CUSTOMERS.\n\n'
      + 'CRITICAL FRAMING:\n'
      + '- You are building messaging for the CLIENT\'S business to use on their website, ads, and sales materials.\n'
      + '- The HERO in StoryBrand is the CLIENT\'S CUSTOMER (the person who buys from them), NOT the client themselves.\n'
      + '- The GUIDE is the CLIENT\'S BRAND (not Setsail Marketing).\n'
      + '- Messaging pillars are what the CLIENT should say to THEIR customers.\n'
      + '- Objections are what the CLIENT\'S CUSTOMERS resist when considering buying.\n'
      + '- VoC quotes are what the CLIENT\'S CUSTOMERS say (or would say), not what the client says to us.\n'
      + '- Content hooks are for the CLIENT\'S website content targeting THEIR audience.\n'
      + '- Use the D0 audience personas — those are the CLIENT\'S customer segments.\n\n'
      + 'RULES:\n'
      + '- StoryBrand plan MUST have exactly 3-4 steps (the customer\'s journey to buying from the client)\n'
      + '- Messaging pillars ranked by importance to the CLIENT\'S CUSTOMERS\n'
      + '- Objection proof_available is true ONLY if evidence exists in the client\'s research/proof data\n'
      + '- Content hooks must be specific to this client\'s market, not generic marketing advice\n'
      + '- VoC quotes: use real quotes from transcript/VoC data when available. If data tier is web-only, generate plausible CUSTOMER language and mark with [inferred]\n'
      + '- emotional_register options: frustration, aspiration, urgency, trust, skepticism, relief\n'
      + '- usage options: headline, subhead, cta, testimonial_seed, email_subject, ad_copy, landing_page\n'
      + '- recommended_entry_point: which awareness stage to target the CLIENT\'S CUSTOMERS first\n'
      + '- call_shape: "education-led" or "proof-led" based on the CLIENT\'S CUSTOMER sophistication\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "storybrand": {\n'
      + '    "hero": "the CLIENT\'S CUSTOMER — who they are, role + context (NOT the client themselves)",\n'
      + '    "external_problem": "tangible problem the CLIENT\'S CUSTOMER faces",\n'
      + '    "internal_problem": "emotional layer — how the problem makes the CLIENT\'S CUSTOMER feel",\n'
      + '    "philosophical_problem": "values/beliefs — why this should not be this way for the customer",\n'
      + '    "guide_empathy": "how the CLIENT\'S BRAND shows understanding of the customer pain",\n'
      + '    "guide_authority": "CLIENT\'S credentials and proof they can help their customers",\n'
      + '    "plan": ["step 1 of the customer journey to buying from the client", "step 2", "step 3"],\n'
      + '    "direct_cta": "primary CTA on the CLIENT\'S website",\n'
      + '    "transitional_cta": "low-commitment entry point on the CLIENT\'S website",\n'
      + '    "failure_stakes": "what happens to the CUSTOMER if they do not act",\n'
      + '    "success_transformation": "desired end state for the CUSTOMER after working with the client"\n'
      + '  },\n'
      + '  "messaging_pillars": [{\n'
      + '    "rank": 1,\n'
      + '    "pillar": "the claim",\n'
      + '    "evidence": ["data point supporting the claim"],\n'
      + '    "resonance_quotes": ["buyer language that validates this pillar"],\n'
      + '    "page_types": ["homepage","service","landing","blog"]\n'
      + '  }],\n'
      + '  "objection_map": [{\n'
      + '    "objection": "what the buyer fears or resists",\n'
      + '    "rebuttal": "how to address it",\n'
      + '    "proof_available": true,\n'
      + '    "proof_type": "case_study|data|testimonial|demo",\n'
      + '    "priority": "high|medium|low"\n'
      + '  }],\n'
      + '  "content_hooks": {\n'
      + '    "unaware": ["hook for unaware audience"],\n'
      + '    "problem_aware": ["hook"],\n'
      + '    "solution_aware": ["hook"],\n'
      + '    "product_aware": ["hook"],\n'
      + '    "most_aware": ["hook"]\n'
      + '  },\n'
      + '  "voc_swipe_file": [{\n'
      + '    "quote": "buyer words",\n'
      + '    "emotional_register": "frustration|aspiration|urgency|trust|skepticism|relief",\n'
      + '    "usage": "headline|subhead|cta|testimonial_seed|email_subject|ad_copy|landing_page"\n'
      + '  }],\n'
      + '  "recommended_entry_point": "which awareness stage to enter at",\n'
      + '  "call_shape": "education-led or proof-led",\n'
      + '  "confidence": 7\n'
      + '}';
  }

  if (num === 9) {
    var r = S.research || {};
    var st = S.strategy || {};

    // Build engagement scope context
    var scopeCtx = '';
    if (st.engagement_scope && st.engagement_scope.services) {
      var enabledSvcs = [];
      Object.keys(st.engagement_scope.services).forEach(function(slug) {
        var svc = st.engagement_scope.services[slug];
        if (svc.enabled) enabledSvcs.push(slug + ' (' + (svc.scope || 'mid') + ')');
      });
      if (enabledSvcs.length) scopeCtx = '\nENGAGED SERVICES: ' + enabledSvcs.join(', ');
    }

    // Investment context
    var investCtx = '';
    if (st.pricing_snapshot) {
      var ps = st.pricing_snapshot;
      if (ps.suggested_monthly) investCtx += '\nSuggested monthly: $' + ps.suggested_monthly.toLocaleString();
      if (ps.suggested_project) investCtx += ' | Project: $' + ps.suggested_project.toLocaleString();
      if (ps.suggested_year1) investCtx += ' | Year 1 total: $' + ps.suggested_year1.toLocaleString();
    }

    return _stratCtx()
      + '\n' + _snapshotCtxBlock()
      + '\n\n--- SETSAIL PROOF POINTS ---\n'
      + 'CASE STUDIES: ' + JSON.stringify((r.case_studies || []).map(function(cs) { return { client: cs.client, result: cs.result, timeframe: cs.timeframe }; }))
      + '\nAWARDS: ' + (r.awards_certifications || []).join(', ')
      + '\nTEAM: ' + (r.team_credentials || '')
      + '\nNOTABLE CLIENTS: ' + (r.notable_clients || []).join(', ')
      + '\n\n--- CLIENT PAIN (why they came to us) ---\n'
      + (r.clientPain && r.clientPain.primary ? 'PRIMARY PAIN: ' + r.clientPain.primary : 'Not captured')
      + (r.clientPain && r.clientPain.consequence ? '\nCONSEQUENCE: ' + r.clientPain.consequence : '')
      + (r.clientPain && r.clientPain.urgencyTrigger ? '\nURGENCY: ' + r.clientPain.urgencyTrigger : '')
      + (r.clientPain && r.clientPain.priorAttempts && r.clientPain.priorAttempts.length ? '\nPRIOR ATTEMPTS: ' + r.clientPain.priorAttempts.join('; ') : '')
      + (r.clientPain && r.clientPain.successDefinition ? '\nSUCCESS DEFINITION: ' + r.clientPain.successDefinition : '')
      + (r.clientPain && r.clientPain.clientQuotes && r.clientPain.clientQuotes.length ? '\nCLIENT QUOTES: ' + r.clientPain.clientQuotes.join(' | ') : '')
      + '\nPREVIOUS AGENCY: ' + (r.previous_agency_experience || 'unknown')
      + '\n\n--- STRATEGY FINDINGS (use these as evidence) ---\n'
      + (st.audience && st.audience.segments ? 'SEGMENTS: ' + st.audience.segments.map(function(s) { return s.segment_name; }).join(', ') : '')
      + (st.unit_economics ? '\nECONOMICS: CPL=$' + (st.unit_economics.cpl || '?') + ', CAC=$' + (st.unit_economics.cac || '?') + ', LTV=$' + (st.unit_economics.ltv || '?') + ', LTV:CAC=' + (st.unit_economics.ltv_cac_ratio || '?') : '')
      + (st.subtraction && st.subtraction.current_activities_audit ? '\nSUBTRACTION: ' + st.subtraction.current_activities_audit.filter(function(a) { return a.verdict === 'stop' || a.verdict === 'reduce'; }).map(function(a) { return a.activity + ' (' + a.verdict + ')'; }).join(', ') : '')
      + (st.channel_strategy && st.channel_strategy.levers ? '\nTOP CHANNELS: ' + st.channel_strategy.levers.filter(function(l) { return l.priority_score >= 7; }).map(function(l) { return l.lever + ' (score:' + l.priority_score + ')'; }).join(', ') : '')
      + (st.demand_validation ? '\nDEMAND: ' + (st.demand_validation.overall_verdict || '') + ', volume: ' + (st.demand_validation.total_monthly_volume || '?') + '/mo' : '')
      + (st.narrative && st.narrative.storybrand ? '\nCLIENT STORYBRAND HERO: ' + st.narrative.storybrand.hero : '')
      + (st.narrative && st.narrative.messaging_pillars ? '\nCLIENT TOP PILLAR: ' + st.narrative.messaging_pillars[0].pillar : '')
      + scopeCtx
      + investCtx
      + '\n\n--- JTBD FORCES (client switching psychology) ---\n'
      + (r.jtbd_forces && r.jtbd_forces.push_forces && r.jtbd_forces.push_forces.length ? 'PUSH FORCES: ' + r.jtbd_forces.push_forces.map(function(f) { return f.force + (f.quote ? ' ("' + f.quote + '")' : ''); }).join('; ') : '')
      + (r.jtbd_forces && r.jtbd_forces.anxieties && r.jtbd_forces.anxieties.length ? '\nANXIETIES: ' + r.jtbd_forces.anxieties.map(function(f) { return f.force; }).join('; ') : '')
      + (r.buyer_sophistication ? '\nBUYER SOPHISTICATION: ' + r.buyer_sophistication + '/5' : '')
      + '\n\nTASK: Build a Sales Intelligence package for Setsail Marketing\'s sales team to use when pitching THIS specific client.\n\n'
      + 'CRITICAL FRAMING:\n'
      + '- The HERO is the CLIENT (the business owner/decision-maker WE are selling to)\n'
      + '- The GUIDE is SETSAIL MARKETING (us \u2014 the agency)\n'
      + '- The PLAN is our proposed engagement (services, timeline, investment)\n'
      + '- Sales pillars are what OUR SALES TEAM should say to THIS CLIENT\n'
      + '- Objections are what THIS CLIENT might resist about hiring us\n'
      + '- Use actual data from the strategy findings as evidence\n'
      + '- Reference real numbers: their CPL, CAC, LTV, organic traffic, DR, search volume\n'
      + '- Match our proof points (case studies, certs) to their industry/needs\n\n'
      + 'RULES:\n'
      + '- pitch_angle must be ONE sentence that frames why they need Setsail specifically\n'
      + '- why_now must reference their specific urgency triggers, not generic reasons\n'
      + '- why_setsail must match our case studies/certs to their vertical\n'
      + '- discovery_gaps: what critical info we still lack that could change the strategy\n'
      + '- sales_pillars.when_to_use: when in the deal cycle this pillar is most effective\n'
      + '- sales_objection_map.data_point: a specific number from the strategy that supports the rebuttal\n'
      + '- deal_stage_hooks: specific talk tracks for each stage of the sales process\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "sales_storybrand": {\n'
      + '    "hero": "the CLIENT \u2014 who they are, their role, their current situation",\n'
      + '    "external_problem": "tangible business problem Setsail solves for them",\n'
      + '    "internal_problem": "how the problem makes THEM feel (frustrated, anxious, embarrassed)",\n'
      + '    "philosophical_problem": "why this should not be this way for business owners like them",\n'
      + '    "guide_empathy": "how SETSAIL shows we understand their specific pain",\n'
      + '    "guide_authority": "SETSAIL credentials relevant to THIS client (matched case studies, certs, results)",\n'
      + '    "plan": ["step 1 of working with Setsail", "step 2", "step 3"],\n'
      + '    "direct_cta": "primary action \u2014 e.g. Sign the proposal, Start the engagement",\n'
      + '    "transitional_cta": "low-commitment \u2014 e.g. See the strategy preview, Book a walkthrough",\n'
      + '    "failure_stakes": "what happens to THEIR BUSINESS if they do not invest in marketing now",\n'
      + '    "success_transformation": "where they will be 12 months after engaging Setsail"\n'
      + '  },\n'
      + '  "sales_pillars": [{\n'
      + '    "rank": 1,\n'
      + '    "pillar": "the claim Setsail makes to this client",\n'
      + '    "evidence": ["specific data point from strategy that backs this claim"],\n'
      + '    "resonance_quotes": ["client\'s own language about this pain from discovery/transcripts"],\n'
      + '    "when_to_use": "discovery | proposal | follow_up | close"\n'
      + '  }],\n'
      + '  "sales_objection_map": [{\n'
      + '    "objection": "what the client might resist about hiring Setsail",\n'
      + '    "rebuttal": "how the sales team should handle it",\n'
      + '    "data_point": "specific number from strategy \u2014 e.g. your CPL is $45, we can cut it to $22",\n'
      + '    "proof_available": true,\n'
      + '    "when_likely": "discovery | proposal | negotiation"\n'
      + '  }],\n'
      + '  "pitch_angle": "ONE sentence that frames the entire engagement",\n'
      + '  "why_now": "urgency triggers specific to this client \u2014 why they cannot wait",\n'
      + '  "why_setsail": "matched proof points \u2014 case studies, certs, results relevant to their industry",\n'
      + '  "discovery_gaps": ["critical info we still lack"],\n'
      + '  "deal_stage_hooks": {\n'
      + '    "cold_outreach": ["hook for initial contact email/call"],\n'
      + '    "discovery": ["hook for discovery call conversation"],\n'
      + '    "proposal": ["hook for proposal presentation"],\n'
      + '    "follow_up": ["hook for follow-up after proposal sent"],\n'
      + '    "close": ["hook for closing the deal"]\n'
      + '  },\n'
      + '  "confidence": 7\n'
      + '}';
  }

  return '';
}

// Append strategist notes to any diagnostic prompt
function _appendStrategistNotes(prompt, diagNum) {
  // D4 feeds channels tab (growth merged into channels)
  var diagToTabs = { 0: ['audience'], 1: ['economics'], 2: ['positioning'], 3: ['subtraction'], 4: ['channels'], 5: ['execution'], 6: ['brand'], 7: ['risks'], 8: ['narrative'], 9: ['sales'] };
  var tabs = diagToTabs[diagNum];
  if (!tabs) return prompt;
  var overrides = (S.strategy && S.strategy.strategist_overrides) ? S.strategy.strategist_overrides : {};
  var allNotes = [];
  tabs.forEach(function(tabId) {
    var tabOverride = overrides[tabId] || {};
    if (tabOverride.notes && tabOverride.notes.trim()) {
      allNotes.push('[' + (STRATEGY_SECTION_LABELS[tabId] || tabId) + ']: ' + tabOverride.notes.trim());
    }
  });
  if (allNotes.length) {
    prompt += '\n\nSTRATEGIST NOTES:\n'
      + 'The strategist has provided the following corrections or additions. '
      + 'Incorporate this into your analysis. If the strategist data contradicts your estimates, '
      + 'use the strategist data and note the source as "strategist-provided".\n\n'
      + allNotes.join('\n\n');
  }
  return prompt;
}

// ── Diagnostic Execution ──────────────────────────────────────────────

async function runDiagnostic(num) {
  if (!S.strategy) S.strategy = strategyDefaults();
  var label = 'D' + num + ': ';
  if (num === 0) label += 'Audience Intelligence';
  else if (num === 1) label += 'Unit Economics';
  else if (num === 2) label += 'Competitive Position';
  else if (num === 3) label += 'Subtraction';
  else if (num === 4) label += 'Channel Viability';
  else if (num === 5) label += 'Website & CRO';
  else if (num === 6) label += 'Content & Authority';
  else if (num === 7) label += 'Risk Assessment';
  else if (num === 8) label += 'Narrative & Messaging';
  else if (num === 9) label += 'Sales Intelligence';

  aiBarStart(label);
  try {
    var prompt = buildDiagnosticPrompt(num);
    if (!prompt) { aiBarEnd('No prompt for D' + num); return; }
    // Append version learning context if re-running
    prompt += _versionLearningCtx(num);
    // Append strategist notes if present
    prompt = _appendStrategistNotes(prompt, num);

    // D8 (Narrative) uses Opus for higher-quality strategic writing
    var diagModel = (num === 8) ? 'claude-opus-4-20250514' : undefined;
    var result = await callClaude(DIAGNOSTIC_SYSTEM, prompt, null, 8000, label, diagModel);
    var parsed = parseEnrichResult(result);
    if (!parsed) {
      aiBarNotify('D' + num + ': could not parse response', { duration: 4000 });
      console.error('D' + num + ' parse failed:', result.slice(0, 500));
      return;
    }

    // Merge into S.strategy
    if (num === 0) {
      S.strategy.audience = parsed;
    } else if (num === 1) {
      S.strategy.unit_economics = parsed;
      // Derive targets
      S.strategy.targets = S.strategy.targets || {};
      if (parsed.budget_supports_leads) S.strategy.targets.monthly_lead_target = parsed.budget_supports_leads;
      if (parsed.estimated_market_cpl) S.strategy.targets.target_cpl = parsed.estimated_market_cpl;
      if (parsed.cpql) S.strategy.targets.target_cpql = parsed.cpql;
      if (parsed.estimated_cac) S.strategy.targets.target_cac = parsed.estimated_cac;
      if (parsed.ltv_cac_ratio) S.strategy.targets.ltv_cac_ratio = parsed.ltv_cac_ratio;
    } else if (num === 2) {
      // Preserve hypothesis/direction data that D2 should not overwrite
      var _prevPos = S.strategy.positioning || {};
      S.strategy.positioning = parsed;
      if (_prevPos.hypotheses_input) S.strategy.positioning.hypotheses_input = _prevPos.hypotheses_input;
      if (_prevPos.hypothesis_evaluations) S.strategy.positioning.hypothesis_evaluations = _prevPos.hypothesis_evaluations;
      if (_prevPos.recommended_directions) S.strategy.positioning.recommended_directions = _prevPos.recommended_directions;
      if (_prevPos.selected_direction) S.strategy.positioning.selected_direction = _prevPos.selected_direction;
      if (_prevPos.system_recommendation) S.strategy.positioning.system_recommendation = _prevPos.system_recommendation;
      if (_prevPos.founder_decision_prompt) S.strategy.positioning.founder_decision_prompt = _prevPos.founder_decision_prompt;
      if (_prevPos.positioning_to_avoid) S.strategy.positioning.positioning_to_avoid = _prevPos.positioning_to_avoid;
      S.strategy.positioning._direction_stale = false; // D2 ran with direction constraint
      // Also set brand voice direction
      if (parsed.brand_voice_direction) {
        S.strategy.brand_strategy = S.strategy.brand_strategy || {};
        S.strategy.brand_strategy.voice_direction = parsed.brand_voice_direction;
      }
    } else if (num === 3) {
      S.strategy.subtraction = parsed;
    } else if (num === 4) {
      S.strategy.channel_strategy = parsed;
      // Extract funnel architecture for growth plan
      if (parsed.funnel_coverage) {
        S.strategy.growth_plan = S.strategy.growth_plan || {};
        S.strategy.growth_plan.funnel_architecture = parsed.funnel_coverage;
      }
      if (parsed.budget_allocation) {
        S.strategy.growth_plan = S.strategy.growth_plan || {};
        S.strategy.growth_plan.budget_allocation = parsed.budget_allocation;
      }
      // Auto-build engagement scope from D4 levers
      if (_pricingCatalog) _buildEngagementScope();
    } else if (num === 5) {
      S.strategy.execution_plan = S.strategy.execution_plan || { lever_details: {} };
      S.strategy.execution_plan.lever_details.website = parsed;
      if (parsed.primary_cta) S.strategy.execution_plan.primary_cta = parsed.primary_cta;
      if (parsed.secondary_ctas) S.strategy.execution_plan.secondary_ctas = parsed.secondary_ctas;
      if (parsed.low_commitment_cta) S.strategy.execution_plan.low_commitment_cta = parsed.low_commitment_cta;
    } else if (num === 6) {
      S.strategy.execution_plan = S.strategy.execution_plan || { lever_details: {} };
      S.strategy.execution_plan.lever_details.content_marketing = parsed;
      S.strategy.execution_plan.lever_details.seo = S.strategy.execution_plan.lever_details.seo || {};
      if (parsed.local_seo_priority) S.strategy.execution_plan.lever_details.seo.local_seo_priority = parsed.local_seo_priority;
      if (parsed.geo_targeting_strategy) S.strategy.execution_plan.lever_details.seo.geo_targeting_strategy = parsed.geo_targeting_strategy;
      // Write content/authority data to brand_strategy for the Brand tab
      S.strategy.brand_strategy = S.strategy.brand_strategy || {};
      if (parsed.dr_gap_analysis) S.strategy.brand_strategy.dr_gap_analysis = parsed.dr_gap_analysis;
      if (parsed.content_mix) S.strategy.brand_strategy.content_mix = parsed.content_mix;
      if (parsed.content_velocity) S.strategy.brand_strategy.content_velocity = parsed.content_velocity;
      if (parsed.team_capacity_check) S.strategy.brand_strategy.team_capacity_check = parsed.team_capacity_check;
      if (parsed.team_size_input_needed) S.strategy.brand_strategy.team_size_input_needed = parsed.team_size_input_needed;
      if (parsed.authority_timeline) S.strategy.brand_strategy.authority_timeline = parsed.authority_timeline;
      if (parsed.quick_wins) S.strategy.brand_strategy.quick_wins = parsed.quick_wins;
      if (parsed.content_pillars) S.strategy.brand_strategy.content_pillars = parsed.content_pillars;
      if (parsed.content_priority) S.strategy.brand_strategy.content_priority = parsed.content_priority;
    } else if (num === 7) {
      S.strategy.risks = parsed;
    } else if (num === 8) {
      S.strategy.narrative = parsed;
    } else if (num === 9) {
      S.strategy.sales_intel = parsed;
    }

    // Run audit checks on the diagnostic output
    if (!S.strategy._audit) S.strategy._audit = {};
    var auditResult = auditDiagnostic(num);
    if (auditResult) S.strategy._audit[num] = auditResult;

    // Force immediate save — do not rely on debounce so data survives reloads
    await saveProject();
    renderStrategyScorecard();
    renderStrategyNav();
    renderStrategyTabContent();
    aiBarEnd(label + ' complete (' + (auditResult ? auditResult.pass + '/' + auditResult.total + ' checks passed' : '') + ')');
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('D' + num + ' error: ' + e.message, { duration: 5000 });
    console.error('D' + num + ' error:', e);
  }
}

// ── Customer Voice Enrichment (Layer 2) ───────────────────────────────

async function enrichCustomerVoice() {
  if (!S.strategy || !S.strategy.audience || !S.strategy.audience.personas) {
    aiBarNotify('Generate audience first (run Strategy D0)', { type: 'warn' });
    return;
  }
  var personas = S.strategy.audience.personas;
  var r = S.research || {};
  var cp = r.clientPain || {};

  aiBarStart('Enriching customer voice...');

  for (var pi = 0; pi < personas.length; pi++) {
    if (window._aiStopAll) break;
    var persona = personas[pi];

    // Build enrichment data from available sources
    var enrichData = {
      fathomQuotes: (cp._customerVoiceQuotes || []).map(function(q) { return { quote: q, context: 'discovery' }; }),
      setupQuotes: [],
      reviewPatterns: { positiveThemes: [], negativeThemes: [], exactPhrases: [] },
      compReviewPatterns: { positiveThemes: [], negativeThemes: [], gaps: [] },
      painKeywordMap: [],
      messagingAnalysis: []
    };

    // Pull GBP reviews if available
    if (r.reviews && r.reviews.length) {
      var posThemes = [], negThemes = [], phrases = [];
      r.reviews.forEach(function(rev) {
        if (rev.rating >= 4 && rev.text) posThemes.push(rev.text.slice(0, 100));
        if (rev.rating <= 2 && rev.text) negThemes.push(rev.text.slice(0, 100));
        if (rev.text) phrases.push(rev.text.slice(0, 60));
      });
      enrichData.reviewPatterns = { positiveThemes: posThemes.slice(0, 5), negativeThemes: negThemes.slice(0, 5), exactPhrases: phrases.slice(0, 8) };
    }

    // Pull keyword data if available
    if (S.kwResearch && S.kwResearch.keywords && S.kwResearch.keywords.length) {
      enrichData.painKeywordMap = S.kwResearch.keywords.slice(0, 20).map(function(kw) {
        return { query: kw.kw, volume: kw.vol || 0, intent: kw.intent || 'unknown' };
      });
    }

    // Pull competitor data if available
    if (r.competitors && r.competitors.length) {
      enrichData.messagingAnalysis = r.competitors.slice(0, 5).map(function(c) {
        return { name: c.name || c.url, headlines: [c.why_they_win || ''], ctas: [] };
      });
    }

    var sys = 'You are the audience intelligence engine for SetSailOS. Your job is to deeply understand the END CUSTOMER of a business — not the business itself, but the person who BUYS FROM the business.\n'
      + 'You must distinguish between:\n'
      + '- What customers SAY they want (rational)\n'
      + '- What customers FEEL (emotional driver beneath the statement)\n'
      + '- What customers DO (actual search/buying behaviour)\n'
      + '- What customers FEAR (objections they will not voice unprompted)\n'
      + 'Output must be specific, evidence-based, and immediately usable by a copywriter.\n'
      + 'Return ONLY valid JSON — no preamble, no markdown fences.';

    var prompt = '## Business Context\n'
      + 'Industry: ' + (r.industry || '') + '\n'
      + 'Business: ' + (r.client_name || '') + ' — ' + (r.business_overview || '') + '\n'
      + 'Location: ' + ((r.geography && r.geography.primary) || '') + '\n\n'
      + '## Client Pain (Layer 1 — for context)\n'
      + 'Primary: ' + (cp.primary || 'Not captured') + '\n'
      + 'Prior attempts: ' + (cp.priorAttempts && cp.priorAttempts.length ? cp.priorAttempts.map(function(a){return a.what+' → '+a.outcome;}).join('; ') : 'None') + '\n'
      + 'Client quotes: ' + (cp.clientQuotes && cp.clientQuotes.length ? cp.clientQuotes.join(' | ') : 'None') + '\n\n'
      + '## Target Persona\n'
      + 'Name: ' + persona.name + '\n'
      + 'Role: ' + (persona.role || '') + '\n'
      + 'Segment: ' + (persona.segment || '') + '\n'
      + 'Goals: ' + (persona.goals ? persona.goals.join('; ') : '') + '\n'
      + 'Frustrations: ' + (persona.frustrations ? persona.frustrations.join('; ') : '') + '\n'
      + 'Objections: ' + (persona.objection_profile ? persona.objection_profile.join('; ') : '') + '\n\n'
      + '## Evidence Gathered\n'
      + 'Customer quotes from discovery: ' + (enrichData.fathomQuotes.length ? enrichData.fathomQuotes.map(function(q){return '"'+q.quote+'"';}).join('; ') : 'None available') + '\n'
      + 'Review patterns (positive): ' + (enrichData.reviewPatterns.positiveThemes.length ? enrichData.reviewPatterns.positiveThemes.join('; ') : 'No reviews') + '\n'
      + 'Review patterns (negative): ' + (enrichData.reviewPatterns.negativeThemes.length ? enrichData.reviewPatterns.negativeThemes.join('; ') : 'No reviews') + '\n'
      + 'Search behaviour: ' + (enrichData.painKeywordMap.length ? enrichData.painKeywordMap.slice(0,10).map(function(k){return '"'+k.query+'" ('+k.volume+'/mo)';}).join(', ') : 'No keyword data') + '\n'
      + 'Competitor messaging: ' + (enrichData.messagingAnalysis.length ? enrichData.messagingAnalysis.map(function(c){return c.name+': "'+c.headlines.join(', ')+'"';}).join('; ') : 'No competitor data') + '\n\n'
      + '## Output\n'
      + 'JSON object:\n{\n'
      + '  "painLanguage": [{"pain": "category", "phrase": "natural customer language", "source": "evidence source"}],\n'
      + '  "emotionalDrivers": [{"pain": "category", "surface": "what they say", "beneath": "emotional truth they do not say aloud"}],\n'
      + '  "competitorVoice": {\n'
      + '    "whatEveryoneSays": ["common phrases across competitors"],\n'
      + '    "whatNobodySays": ["angles no competitor occupies"],\n'
      + '    "messagingGap": "single biggest unaddressed need",\n'
      + '    "tonePattern": "how competitors collectively sound"\n'
      + '  },\n'
      + '  "objectionDetail": [{"objection": "text", "timing": "when in journey", "frequency": "how common", "counterStrategy": "how to address in copy"}],\n'
      + '  "journey": {\n'
      + '    "awareness": {"trigger": "event", "behavior": "action", "contentNeeded": "type", "keyQuestions": ["4+ questions"]},\n'
      + '    "consideration": {"trigger": "", "behavior": "", "contentNeeded": "", "keyQuestions": []},\n'
      + '    "decision": {"trigger": "", "behavior": "", "contentNeeded": "", "keyQuestions": []}\n'
      + '  },\n'
      + '  "proofTypes": [{"type": "format", "impact": "high|medium|low", "where": "placement", "note": "why"}],\n'
      + '  "searchByPain": [{"pain": "category", "queries": [], "totalVolume": 0, "intent": "informational|commercial|transactional"}],\n'
      + '  "gaps": ["what we still do not know"]\n'
      + '}\n\n'
      + 'Rules:\n'
      + '- painLanguage: minimum 5 entries. Must sound like a real person.\n'
      + '- emotionalDrivers: minimum 3. "beneath" must be an insight the customer would not say out loud.\n'
      + '- competitorVoice.whatNobodySays: most valuable field — where differentiation lives.\n'
      + '- journey.keyQuestions: minimum 4 per stage. Must be answerable with content.\n'
      + '- Be specific to ' + (r.industry || 'this industry') + ' in ' + ((r.geography && r.geography.primary) || 'this market') + '. No generic answers.';

    try {
      window._aiBarLabel = 'Customer Voice: ' + persona.name;
      var result = await callClaude(sys, prompt, null, 6000);
      var parsed = parseEnrichResult(result);
      if (parsed) {
        if (!persona.executionProfile) persona.executionProfile = {};
        var ep = persona.executionProfile;
        ep.painLanguage = parsed.painLanguage || [];
        ep.emotionalDrivers = parsed.emotionalDrivers || [];
        ep.competitorVoice = parsed.competitorVoice || {};
        ep.objectionDetail = parsed.objectionDetail || [];
        ep.journey = parsed.journey || {};
        ep.proofTypes = parsed.proofTypes || [];
        ep.searchByPain = parsed.searchByPain || [];
        ep._enrichedAt = Date.now();
        ep._enrichmentSources = [];
        if (enrichData.fathomQuotes.length) ep._enrichmentSources.push('fathom');
        if (enrichData.reviewPatterns.positiveThemes.length) ep._enrichmentSources.push('gbp_reviews');
        if (enrichData.painKeywordMap.length) ep._enrichmentSources.push('search_data');
        if (enrichData.messagingAnalysis.length) ep._enrichmentSources.push('competitor_copy');
        ep._enrichmentGaps = parsed.gaps || [];
        scheduleSave();
      }
    } catch(e) {
      console.error('enrichCustomerVoice failed for', persona.name, e);
    }

    // Pause between personas to avoid rate limits
    if (pi < personas.length - 1) await new Promise(function(r){ setTimeout(r, 2000); });
  }

  aiBarEnd();
  aiBarNotify('Customer voice enriched for ' + personas.length + ' personas', { type: 'success' });
  renderStrategyTabContent();
}

// ── Iterative Loop ────────────────────────────────────────────────────

async function generateStrategy() {
  if (!S.strategy) S.strategy = strategyDefaults();
  window._aiStopAll = false;

  // Step 0: Load pricing catalog (runs once, cached)
  aiBarStart('Loading pricing catalog');
  await fetchPricingCatalog();

  // Step 1: Run enrichment
  aiBarStart('Strategy enrichment');
  var r = S.research || {};
  var s = S.setup || {};

  try {
    // Competitor deep-dives (top 2 competitors)
    var comps = (r.competitors || []).slice(0, 2);
    if (comps.length) {
      S.strategy._enrichment.competitor_deep_dive = [];
      for (var ci = 0; ci < comps.length; ci++) {
        if (window._aiStopAll) {
          window._aiStopResumeCtx = { label: 'Strategy paused (enrichment)', fn: function() { generateStrategy(); }, args: {} };
          return;
        }
        aiBarStart('Analysing competitor: ' + comps[ci].name);
        var dd = await strategyEnrich.competitorDeepDive(comps[ci].url);
        if (dd) {
          dd.url = comps[ci].url;
          dd.name = comps[ci].name;
          S.strategy._enrichment.competitor_deep_dive.push(dd);
        }
        if (ci < comps.length - 1) await new Promise(function(res) { setTimeout(res, 2000); });
      }
    }

    if (window._aiStopAll) {
      window._aiStopResumeCtx = { label: 'Strategy paused (enrichment)', fn: function() { generateStrategy(); }, args: {} };
      return;
    }

    // Reference doc extraction
    if (s.docs && s.docs.length) {
      aiBarStart('Extracting reference docs');
      var allDocText = s.docs.map(function(d) { return d.content; }).join('\n\n');
      var docResult = await strategyEnrich.referenceDocExtraction(allDocText);
      if (docResult) S.strategy._enrichment.doc_extraction = docResult;
      await new Promise(function(res) { setTimeout(res, 2000); });
    }

    if (window._aiStopAll) {
      window._aiStopResumeCtx = { label: 'Strategy paused (enrichment)', fn: function() { generateStrategy(); }, args: {} };
      return;
    }

    // Passive VoC extraction from uploaded docs
    var _vocSources = '';
    if (s.discoveryNotes) _vocSources += s.discoveryNotes + '\n';
    if (S.strategy._enrichment.doc_extraction) _vocSources += JSON.stringify(S.strategy._enrichment.doc_extraction).slice(0, 3000);
    if (_vocSources.trim().length > 50) {
      aiBarStart('Extracting buyer language');
      try {
        var _vocRaw = '';
        await callClaude(
          'You extract real customer voice phrases from business documents. Return ONLY a JSON array.\n'
          + 'Rules:\n'
          + '- Only include phrases that sound like a real person said them\n'
          + '- Include direct quotes, complaints, praise, objections, emotional statements\n'
          + '- Do NOT fabricate or paraphrase \u2014 extract verbatim or skip\n'
          + '- Max 8 items\n'
          + 'Schema: [{"quote":"exact text","context":"situation/topic","source_type":"extracted"}]',
          _vocSources.slice(0, 4000),
          function(c) { _vocRaw += c; },
          2000, 'VoC extraction'
        );
        var _vocJson = _vocRaw.match(/\[[\s\S]*\]/);
        if (_vocJson) {
          var _vocParsed = JSON.parse(_vocJson[0]);
          if (Array.isArray(_vocParsed) && _vocParsed.length) {
            if (!S.strategy._enrichment) S.strategy._enrichment = {};
            S.strategy._enrichment.voc_swipe_file = _vocParsed.map(function(v) {
              return { quote: v.quote || '', context: v.context || '', source_type: 'extracted' };
            });
          }
        }
      } catch(e) { console.warn('VoC extraction skipped:', e.message); }
    }

    if (window._aiStopAll) {
      window._aiStopResumeCtx = { label: 'Strategy paused (enrichment)', fn: function() { generateStrategy(); }, args: {} };
      return;
    }

    // CPC estimates
    var svcNames = (r.primary_services || []).slice(0, 5);
    var geo = r.geography && r.geography.primary ? r.geography.primary : s.geo || '';
    if (svcNames.length) {
      aiBarStart('Fetching CPC estimates');
      var cpcSeeds = svcNames.map(function(sn) {
        return sn.toLowerCase() + ' ' + geo.replace(/,.*$/, '').trim().toLowerCase();
      });
      var cpcResult = await strategyEnrich.cpcEstimates(cpcSeeds, geo);
      if (cpcResult) S.strategy._enrichment.cpc_estimates = cpcResult;
      await new Promise(function(res) { setTimeout(res, 2000); });
    }

    if (window._aiStopAll) {
      window._aiStopResumeCtx = { label: 'Strategy paused (enrichment)', fn: function() { generateStrategy(); }, args: {} };
      return;
    }

    // Site performance check
    if (s.url) {
      aiBarStart('Checking site performance');
      var siteResult = await strategyEnrich.sitePerformanceCheck(s.url);
      if (siteResult) S.strategy._enrichment.current_presence = siteResult;
      await new Promise(function(res) { setTimeout(res, 2000); });
    }

    if (window._aiStopAll) {
      window._aiStopResumeCtx = { label: 'Strategy paused (enrichment)', fn: function() { generateStrategy(); }, args: {} };
      return;
    }

    // Industry benchmarks
    if (r.industry && geo) {
      aiBarStart('Fetching industry benchmarks');
      var benchResult = await strategyEnrich.industryBenchmarks(r.industry, geo);
      if (benchResult) S.strategy._enrichment.industry_benchmarks = benchResult;
      await new Promise(function(res) { setTimeout(res, 2000); });
    }

    await saveProject();

    // Step 2a: Run D0 (Audience Intelligence) first
    if (window._aiStopAll) {
      window._aiStopResumeCtx = { label: 'Strategy paused (pre-D0)', fn: function() { _resumeDiagnosticsWithD0(0); }, args: {} };
      return;
    }
    await runDiagnostic(0);
    await new Promise(function(res) { setTimeout(res, 2000); });

    // Step 2b: Run diagnostics D1-D3 (no keyword dependency)
    for (var d = 1; d <= 3; d++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Strategy paused (D' + d + '/9)',
          fn: function(args) { _resumeDiagnostics(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      await new Promise(function(res) { setTimeout(res, 2000); });
    }

    // Step 2c: Auto-run keyword pipeline (sandwiched between D3 and D4)
    if (window._aiStopAll) {
      window._aiStopResumeCtx = {
        label: 'Strategy paused (pre-keywords)',
        fn: function() { _resumeStrategyWithKeywords(); },
        args: {}
      };
      return;
    }
    var _kwR = S.kwResearch || {};
    if (!_kwR.keywords || _kwR.keywords.length < 10) {
      if (typeof runFullKeywordPipeline === 'function') {
        aiBarStart('Running keyword research pipeline');
        try {
          await runFullKeywordPipeline();
        } catch(kwErr) {
          console.warn('Keyword pipeline error during strategy:', kwErr.message);
          aiBarNotify('Keyword pipeline had issues — continuing with available data', { duration: 3000 });
        }
        await new Promise(function(res) { setTimeout(res, 2000); });
      }
    }

    // Step 2d: Run diagnostics D4-D7 (keyword-enriched)
    for (var d2 = 4; d2 <= 7; d2++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Strategy paused (D' + d2 + '/7)',
          fn: function(args) { _resumeDiagnostics(args.startFrom); },
          args: { startFrom: d2 }
        };
        return;
      }
      await runDiagnostic(d2);
      if (d2 < 7) await new Promise(function(res) { setTimeout(res, 2000); });
    }

    // Step 3: Capture pricing snapshot and score
    capturePricingSnapshot();
    createStrategyVersion('auto_draft');
    await saveProject();
    renderStrategyScorecard();
    _sTab = Object.keys(STRATEGY_SECTION_WEIGHTS)[0];
    renderStrategyNav();
    renderStrategyTabContent();

    // Step 4: Auto-run D8 Narrative & Messaging — requires D0-D7 complete
    if (!window._aiStopAll) {
      aiBarStart('Running D8 Narrative & Messaging');
      try { await runDiagnostic(8); } catch (e8) { console.warn('D8 Narrative error:', e8.message); aiBarNotify('D8 Narrative: ' + e8.message, { duration: 4000 }); }
      await saveProject();
    }
    if (!window._aiStopAll) {
      aiBarStart('Running D9 Sales Intelligence');
      try { await runDiagnostic(9); } catch(e9) { console.warn('D9 Sales error:', e9.message); aiBarNotify('D9 Sales: ' + e9.message, { duration: 4000 }); }
      await saveProject();
    }

    // Step 5: Auto-compile strategy document + web strategy brief
    if (!window._aiStopAll) {
      aiBarStart('Compiling strategy document');
      try {
        await compileStrategyOutput();
        await synthesiseWebStrategy();
        await saveProject();
      } catch (eComp) { console.warn('Auto-compile skipped:', eComp.message); }
    }

    renderStrategyScorecard();
    renderStrategyNav();
    renderStrategyTabContent();
    aiBarEnd('Strategy v' + S.strategy._meta.current_version + ' generated — doc compiled');
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('Strategy generation error: ' + e.message, { duration: 5000 });
    console.error('generateStrategy error:', e);
  }
}

async function _resumeDiagnosticsWithD0(startFrom) {
  window._aiStopAll = false;
  try {
    // If startFrom is 0, run D0 first
    if (startFrom === 0) {
      await runDiagnostic(0);
      await new Promise(function(res) { setTimeout(res, 2000); });
      if (window._aiStopAll) {
        window._aiStopResumeCtx = { label: 'Strategy paused (D0 done)', fn: function(args) { _resumeDiagnosticsWithD0(args.startFrom); }, args: { startFrom: 1 } };
        return;
      }
      startFrom = 1;
    }
    for (var d = startFrom; d <= 7; d++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Strategy paused (D' + d + '/9)',
          fn: function(args) { _resumeDiagnosticsWithD0(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      if (d < 7) await new Promise(function(res) { setTimeout(res, 2000); });
    }
    // Run D8 Narrative after D1-D7 complete
    if (!window._aiStopAll) {
      try { await runDiagnostic(8); } catch(e8) { console.warn('D8 Narrative error:', e8.message); aiBarNotify('D8 Narrative: ' + e8.message, { duration: 4000 }); }
    }
    if (!window._aiStopAll) {
      aiBarStart('Running D9 Sales Intelligence');
      try { await runDiagnostic(9); } catch(e9) { console.warn('D9 Sales error:', e9.message); aiBarNotify('D9 Sales: ' + e9.message, { duration: 4000 }); }
    }
    capturePricingSnapshot();
    createStrategyVersion('auto_draft');
    await saveProject();
    renderStrategyScorecard();
    renderStrategyTabContent();
    aiBarEnd('Strategy v' + S.strategy._meta.current_version + ' generated');
  } catch (e) {
    if (e.name === 'AbortError') return;
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

async function _resumeDiagnostics(startFrom) {
  window._aiStopAll = false;
  try {
    // If resuming at D4 and no keywords, run keyword pipeline first
    if (startFrom === 4) {
      var _kwCheck = S.kwResearch || {};
      if (!_kwCheck.keywords || _kwCheck.keywords.length < 10) {
        if (typeof runFullKeywordPipeline === 'function') {
          aiBarStart('Running keyword research pipeline');
          try { await runFullKeywordPipeline(); } catch(kwErr) {
            console.warn('Keyword pipeline error:', kwErr.message);
          }
          await new Promise(function(res) { setTimeout(res, 2000); });
        }
      }
    }
    for (var d = startFrom; d <= 7; d++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Strategy paused (D' + d + '/9)',
          fn: function(args) { _resumeDiagnostics(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      if (d < 7) await new Promise(function(res) { setTimeout(res, 2000); });
    }
    // Run D8 Narrative after D1-D7 complete
    if (!window._aiStopAll) {
      try { await runDiagnostic(8); } catch(e8) { console.warn('D8 Narrative error:', e8.message); aiBarNotify('D8 Narrative: ' + e8.message, { duration: 4000 }); }
    }
    if (!window._aiStopAll) {
      aiBarStart('Running D9 Sales Intelligence');
      try { await runDiagnostic(9); } catch(e9) { console.warn('D9 Sales error:', e9.message); aiBarNotify('D9 Sales: ' + e9.message, { duration: 4000 }); }
    }
    capturePricingSnapshot();
    createStrategyVersion('auto_draft');
    await saveProject();
    renderStrategyScorecard();
    renderStrategyTabContent();
    aiBarEnd('Strategy v' + S.strategy._meta.current_version + ' generated');
  } catch (e) {
    if (e.name === 'AbortError') return;
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

async function _resumeStrategyWithKeywords() {
  window._aiStopAll = false;
  try {
    var _kwCheck = S.kwResearch || {};
    if (!_kwCheck.keywords || _kwCheck.keywords.length < 10) {
      if (typeof runFullKeywordPipeline === 'function') {
        aiBarStart('Running keyword research pipeline');
        try { await runFullKeywordPipeline(); } catch(kwErr) {
          console.warn('Keyword pipeline error:', kwErr.message);
        }
        await new Promise(function(res) { setTimeout(res, 2000); });
      }
    }
    // Continue with D4-D7
    await _resumeDiagnostics(4);
  } catch (e) {
    if (e.name === 'AbortError') return;
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

async function runAllDiagnostics() {
  if (!S.strategy) S.strategy = strategyDefaults();
  window._aiStopAll = false;
  aiBarStart('Loading pricing catalog');
  await fetchPricingCatalog();
  aiBarStart('Running all diagnostics (D0-D8)');
  try {
    // D0 first
    await runDiagnostic(0);
    await new Promise(function(res) { setTimeout(res, 2000); });
    if (window._aiStopAll) {
      window._aiStopResumeCtx = {
        label: 'Diagnostics paused (D0 done, D1 pending)',
        fn: function(args) { _resumeAllDiagnostics(args.startFrom); },
        args: { startFrom: 1 }
      };
      return;
    }
    for (var d = 1; d <= 7; d++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Diagnostics paused (' + d + '/9)',
          fn: function(args) { _resumeAllDiagnostics(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      if (d < 7) await new Promise(function(res) { setTimeout(res, 2000); });
    }
    // Run D8 Narrative after D1-D7
    if (!window._aiStopAll) {
      aiBarStart('Running D8 Narrative & Messaging');
      try { await runDiagnostic(8); } catch(e8) { console.warn('D8 Narrative error:', e8.message); aiBarNotify('D8 Narrative skipped: ' + e8.message, { duration: 4000 }); }
    }
    if (!window._aiStopAll) {
      aiBarStart('Running D9 Sales Intelligence');
      try { await runDiagnostic(9); } catch(e9) { console.warn('D9 Sales error:', e9.message); aiBarNotify('D9 Sales: ' + e9.message, { duration: 4000 }); }
    }
    S.strategy._kwDataStale = false; // D4-D6 now have latest keyword data
    capturePricingSnapshot();
    createStrategyVersion('rerun_all');
    await saveProject();

    // Auto-compile strategy document + web strategy brief
    if (!window._aiStopAll) {
      aiBarStart('Compiling strategy document');
      try {
        await compileStrategyOutput();
        await synthesiseWebStrategy();
        await saveProject();
      } catch (eComp) { console.warn('Auto-compile skipped:', eComp.message); }
    }

    renderStrategyScorecard();
    renderStrategyNav();
    renderStrategyTabContent();
    aiBarEnd('All diagnostics complete — v' + S.strategy._meta.current_version + ' — doc compiled');
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

async function _resumeAllDiagnostics(startFrom) {
  window._aiStopAll = false;
  try {
    for (var d = startFrom; d <= 7; d++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Diagnostics paused (' + d + '/9)',
          fn: function(args) { _resumeAllDiagnostics(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      if (d < 7) await new Promise(function(res) { setTimeout(res, 2000); });
    }
    // Run D8 Narrative after D1-D7
    if (!window._aiStopAll) {
      try { await runDiagnostic(8); } catch(e8) { console.warn('D8 Narrative error:', e8.message); aiBarNotify('D8 Narrative: ' + e8.message, { duration: 4000 }); }
    }
    if (!window._aiStopAll) {
      aiBarStart('Running D9 Sales Intelligence');
      try { await runDiagnostic(9); } catch(e9) { console.warn('D9 Sales error:', e9.message); aiBarNotify('D9 Sales: ' + e9.message, { duration: 4000 }); }
    }
    createStrategyVersion('rerun_all');
    await saveProject();
    renderStrategyScorecard();
    renderStrategyNav();
    renderStrategyTabContent();
    aiBarEnd('All diagnostics complete \u2014 v' + S.strategy._meta.current_version + ' (score: ' + S.strategy._meta.overall_score + ')');
  } catch (e) {
    if (e.name === 'AbortError') return;
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

// Re-run only D4, D5, D6 with keyword data — used after keyword pipeline completes
async function rerunKeywordSensitiveDiagnostics() {
  if (!S.strategy || !S.strategy._meta || S.strategy._meta.current_version < 1) {
    aiBarNotify('Generate a full strategy first', { isError: true, duration: 3000 });
    return;
  }
  window._aiStopAll = false;
  aiBarStart('Re-running keyword-sensitive diagnostics (D4, D5, D6)');
  try {
    var diagNums = [4, 5, 6];
    for (var i = 0; i < diagNums.length; i++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Keyword diagnostics paused (' + (i + 1) + '/3)',
          fn: function(args) { _resumeKwDiagnostics(args.startIdx); },
          args: { startIdx: i }
        };
        return;
      }
      await runDiagnostic(diagNums[i]);
      if (i < diagNums.length - 1) await new Promise(function(res) { setTimeout(res, 2000); });
    }
    // Clear staleness flag
    S.strategy._kwDataStale = false;
    capturePricingSnapshot();
    createStrategyVersion('kw_refresh');
    await saveProject();
    renderStrategyScorecard();
    renderStrategyNav();
    renderStrategyTabContent();
    aiBarEnd('D4-D6 updated with keyword data \u2014 v' + S.strategy._meta.current_version);
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

async function _resumeKwDiagnostics(startIdx) {
  window._aiStopAll = false;
  var diagNums = [4, 5, 6];
  try {
    for (var i = startIdx; i < diagNums.length; i++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Keyword diagnostics paused (' + (i + 1) + '/3)',
          fn: function(args) { _resumeKwDiagnostics(args.startIdx); },
          args: { startIdx: i }
        };
        return;
      }
      await runDiagnostic(diagNums[i]);
      if (i < diagNums.length - 1) await new Promise(function(res) { setTimeout(res, 2000); });
    }
    S.strategy._kwDataStale = false;
    createStrategyVersion('kw_refresh');
    await saveProject();
    renderStrategyScorecard();
    renderStrategyNav();
    renderStrategyTabContent();
    aiBarEnd('D4-D6 updated with keyword data');
  } catch (e) {
    if (e.name === 'AbortError') return;
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

async function improveStrategy() {
  if (!S.strategy || !S.strategy._meta || S.strategy._meta.current_version < 1) {
    aiBarNotify('Generate strategy first', { duration: 3000 });
    return;
  }
  window._aiStopAll = false;

  // Find weakest sections
  var scores = scoreStrategy();
  var sorted = Object.keys(scores.sections).map(function(sec) {
    return { section: sec, score: scores.sections[sec].score };
  }).sort(function(a, b) { return a.score - b.score; });

  // Re-run diagnostics for weakest 3 sections
  var weakest = sorted.slice(0, 3);
  var diagMap = { audience: 0, positioning: 2, economics: 1, subtraction: 3, channels: 4, execution: 5, brand: 6, risks: 7, narrative: 8, sales: 9 };

  var diagsToRun = [];
  weakest.forEach(function(w) {
    var d = diagMap[w.section];
    if (d !== undefined && d !== null && diagsToRun.indexOf(d) < 0) diagsToRun.push(d);
  });
  diagsToRun.sort();

  aiBarStart('Improving strategy (targeting ' + weakest.map(function(w) { return w.section; }).join(', ') + ')');
  try {
    for (var i = 0; i < diagsToRun.length; i++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = { label: 'Improvement paused', fn: function() { improveStrategy(); }, args: {} };
        return;
      }
      await runDiagnostic(diagsToRun[i]);
      if (i < diagsToRun.length - 1) await new Promise(function(res) { setTimeout(res, 2000); });
    }

    // Run D8 (keyword demand validation) on Pass 2+
    if (window._aiStopAll) {
      window._aiStopResumeCtx = { label: 'Improvement paused', fn: function() { improveStrategy(); }, args: {} };
      return;
    }

    var r = S.research || {};
    var geo = r.geography && r.geography.primary ? r.geography.primary : (S.setup || {}).geo || '';
    if (r.industry && (r.primary_services || []).length) {
      aiBarStart('Keyword Demand Validation');
      var demandResult = await strategyEnrich.keywordDemandCheck(r.industry, geo, r.primary_services);
      if (demandResult) {
        S.strategy.demand_validation = demandResult;

        // Check for strategic revisions needed
        if (demandResult.overall_verdict === 'insufficient') {
          demandResult.strategic_revisions_needed = demandResult.strategic_revisions_needed || [];
          demandResult.strategic_revisions_needed.push({
            area: 'vertical',
            current_direction: r.industry,
            keyword_reality: 'Total search volume < 100/month',
            recommended_revision: 'Consider vertical pivot or geographic expansion',
            impact_severity: 'high'
          });
        }
      }
    }

    createStrategyVersion('auto_improve');
    await saveProject();
    renderStrategyScorecard();
    renderStrategyTabContent();
    aiBarEnd('Strategy improved to v' + S.strategy._meta.current_version + ' (score: ' + S.strategy._meta.overall_score + ')');
  } catch (e) {
    if (e.name === 'AbortError') return;
    aiBarNotify('Improvement error: ' + e.message, { duration: 5000 });
  }
}

async function approveStrategy() {
  if (!S.strategy) return;
  S.strategy._meta.approved = true;
  var v = S.strategy._meta.versions[S.strategy._meta.versions.length - 1];
  if (v) v.approved = true;
  await saveProject();
  renderStrategyScorecard();
  renderStrategyTabContent();
  aiBarNotify('Strategy approved', { duration: 3000 });
}

// ── Website Strategy Brief (synthesised from completed strategy) ──────

async function synthesiseWebStrategy() {
  if (!S.strategy || !S.strategy._meta || S.strategy._meta.current_version === 0) {
    aiBarNotify('Generate a strategy first before synthesising the website brief', { isError: true, duration: 3000 });
    return;
  }
  var st = S.strategy;
  var r = S.research || {};
  var s = S.setup || {};

  // ── Build comprehensive context from ALL strategy sections + research ──

  var ctx = 'CLIENT: ' + (s.client || r.client_name || '') + '\n';
  ctx += 'URL: ' + (s.url || '') + '\n';
  ctx += 'INDUSTRY: ' + (r.industry || '') + '\n';
  ctx += 'SERVICES: ' + (r.primary_services || []).join(', ') + '\n';
  if (r.services_detail && r.services_detail.length) {
    ctx += 'SERVICES DETAIL:\n';
    r.services_detail.forEach(function(sd) {
      ctx += '- ' + (sd.name || '') + ': ' + (sd.description || '') + (sd.differentiator ? ' (differentiator: ' + sd.differentiator + ')' : '') + '\n';
    });
  }

  // Positioning
  if (st.positioning) {
    ctx += '\nPOSITIONING:\n';
    if (st.positioning.core_value_proposition) ctx += '- Value Prop: ' + st.positioning.core_value_proposition + '\n';
    if (st.positioning.recommended_positioning_angle) ctx += '- Positioning angle: ' + st.positioning.recommended_positioning_angle + '\n';
    if (st.positioning.validated_differentiators) ctx += '- Differentiators: ' + JSON.stringify(st.positioning.validated_differentiators) + '\n';
    if (st.positioning.brand_voice_direction) {
      var bv = st.positioning.brand_voice_direction;
      if (bv.style) ctx += '- Voice: ' + bv.style + '\n';
      if (bv.tone_detail) ctx += '- Tone: ' + bv.tone_detail + '\n';
      if (bv.words_to_avoid) ctx += '- Words to avoid: ' + JSON.stringify(bv.words_to_avoid) + '\n';
      if (bv.words_to_use) ctx += '- Words to use: ' + JSON.stringify(bv.words_to_use) + '\n';
    }
    if (st.positioning.messaging_hierarchy) {
      var mh = st.positioning.messaging_hierarchy;
      if (mh.primary_message) ctx += '- Primary message: ' + mh.primary_message + '\n';
      if (mh.supporting_messages) ctx += '- Supporting messages: ' + JSON.stringify(mh.supporting_messages) + '\n';
      if (mh.proof_points) ctx += '- Proof points: ' + JSON.stringify(mh.proof_points) + '\n';
    }
    if (st.positioning.category_perception && st.positioning.category_perception.gap_severity !== 'none') {
      var _cp = st.positioning.category_perception;
      ctx += '\nCATEGORY PERCEPTION GAP:\n';
      ctx += '- Buyer thinks they are buying: ' + (_cp.buyer_frame || '') + '\n';
      ctx += '- We are actually selling: ' + (_cp.actual_frame || '') + '\n';
      ctx += '- Gap severity: ' + (_cp.gap_severity || '') + '\n';
      ctx += '- Reframing language: ' + (_cp.reframing_language || '') + '\n';
    }
  }

  // Unit Economics — conversion context for CTA urgency and offer framing
  if (st.unit_economics) {
    var ue = st.unit_economics;
    ctx += '\nUNIT ECONOMICS:\n';
    if (ue.average_deal_size) ctx += '- Avg deal size: ' + ue.average_deal_size + '\n';
    if (ue.customer_ltv) ctx += '- Customer LTV: ' + ue.customer_ltv + '\n';
    if (ue.max_allowable_cpl) ctx += '- Max CPL: $' + ue.max_allowable_cpl + '\n';
    if (ue.paid_media_viable !== undefined) ctx += '- Paid media viable: ' + (ue.paid_media_viable ? 'Yes' : 'No') + '\n';
    if (ue.monthly_budget) ctx += '- Monthly marketing budget: ' + ue.monthly_budget + '\n';
    if (ue.pricing_model) ctx += '- Pricing model: ' + ue.pricing_model + '\n';
  }

  // Channel Strategy — what channels the website supports and budget reality
  if (st.channel_strategy) {
    var cs = st.channel_strategy;
    ctx += '\nCHANNEL STRATEGY:\n';
    if (cs.priority_order) ctx += '- Priority channels: ' + cs.priority_order.join(', ') + '\n';
    if (cs.website_role) ctx += '- Website role in channel mix: ' + cs.website_role + '\n';
    if (cs.budget_allocation && cs.budget_allocation.total_monthly) ctx += '- Total monthly budget: ' + cs.budget_allocation.total_monthly + '\n';
    if (cs.levers && cs.levers.length) {
      var topLevers = cs.levers.filter(function(l) { return l.priority_score >= 7; }).slice(0, 4);
      if (topLevers.length) {
        ctx += '- Top channel levers:\n';
        topLevers.forEach(function(l) {
          ctx += '  · ' + (l.name || l.channel || '') + ' (priority: ' + l.priority_score + '/10)' + (l.rationale ? ' — ' + l.rationale : '') + '\n';
        });
      }
    }
  }

  // Subtraction — what has been cut so copy does not reference discontinued activities
  if (st.subtraction && st.subtraction.current_activities_audit) {
    var stopItems = st.subtraction.current_activities_audit.filter(function(a) { return a.verdict === 'stop' || a.verdict === 'reduce'; });
    if (stopItems.length) {
      ctx += '\nSUBTRACTION (stopped/reduced activities — do not reference in copy):\n';
      stopItems.forEach(function(a) {
        ctx += '- ' + a.verdict.toUpperCase() + ': ' + (a.activity || a.name || '') + (a.reason ? ' (' + a.reason + ')' : '') + '\n';
      });
    }
  }

  // Growth Plan — funnel architecture and conversion pathway
  if (st.growth_plan) {
    var gp = st.growth_plan;
    if (gp.funnel_architecture) {
      ctx += '\nFUNNEL ARCHITECTURE:\n';
      if (typeof gp.funnel_architecture === 'string') ctx += gp.funnel_architecture + '\n';
      else ctx += JSON.stringify(gp.funnel_architecture) + '\n';
    }
    if (gp.conversion_pathway) {
      ctx += 'CONVERSION PATHWAY: ' + (typeof gp.conversion_pathway === 'string' ? gp.conversion_pathway : JSON.stringify(gp.conversion_pathway)) + '\n';
    }
  }

  // Brand Strategy — authority and DR context
  if (st.brand_strategy) {
    var bs = st.brand_strategy;
    ctx += '\nBRAND STRATEGY:\n';
    if (bs.content_authority_plan) ctx += '- Content authority: ' + (typeof bs.content_authority_plan === 'string' ? bs.content_authority_plan : JSON.stringify(bs.content_authority_plan)) + '\n';
    if (bs.dr_gap_analysis) {
      if (bs.dr_gap_analysis.client_dr) ctx += '- Client DR: ' + bs.dr_gap_analysis.client_dr + '\n';
      if (bs.dr_gap_analysis.competitor_avg_dr) ctx += '- Competitor avg DR: ' + bs.dr_gap_analysis.competitor_avg_dr + '\n';
      if (bs.dr_gap_analysis.recommendation) ctx += '- DR recommendation: ' + bs.dr_gap_analysis.recommendation + '\n';
    }
  }

  // Execution Plan — CTAs and KPIs
  if (st.execution_plan) {
    ctx += '\nEXECUTION PLAN:\n';
    if (st.execution_plan.primary_cta) ctx += '- Primary CTA: ' + st.execution_plan.primary_cta + '\n';
    if (st.execution_plan.secondary_ctas) ctx += '- Secondary CTAs: ' + (Array.isArray(st.execution_plan.secondary_ctas) ? st.execution_plan.secondary_ctas.join(', ') : st.execution_plan.secondary_ctas) + '\n';
    if (st.execution_plan.low_commitment_cta) ctx += '- Low-commitment CTA: ' + st.execution_plan.low_commitment_cta + '\n';
    if (st.execution_plan.kpis && st.execution_plan.kpis.length) {
      ctx += '- KPIs: ' + st.execution_plan.kpis.slice(0, 5).map(function(k) { return typeof k === 'string' ? k : (k.metric || k.name || ''); }).join('; ') + '\n';
    }
  }

  // Demand Validation — keyword demand reality
  if (st.demand_validation) {
    var dv = st.demand_validation;
    ctx += '\nDEMAND VALIDATION:\n';
    if (dv.overall_verdict) ctx += '- Overall demand: ' + dv.overall_verdict + '\n';
    if (dv.total_monthly_volume) ctx += '- Total monthly search volume: ' + dv.total_monthly_volume + '\n';
    if (dv.strategic_revisions_needed && dv.strategic_revisions_needed.length) {
      ctx += '- Revisions flagged:\n';
      dv.strategic_revisions_needed.slice(0, 3).forEach(function(rev) {
        ctx += '  · ' + (rev.revision || rev.description || JSON.stringify(rev)) + '\n';
      });
    }
  }

  // Audience and proof
  if (r.primary_audience_description) ctx += '\nAUDIENCE: ' + r.primary_audience_description + '\n';
  if (r.buyer_roles && r.buyer_roles.length) ctx += 'BUYER ROLES: ' + r.buyer_roles.join('; ') + '\n';
  if (r.pain_points_top5 && r.pain_points_top5.length) ctx += 'PAIN POINTS: ' + r.pain_points_top5.join('; ') + '\n';
  if (r.objections_top5 && r.objections_top5.length) ctx += 'BUYER OBJECTIONS: ' + r.objections_top5.join('; ') + '\n';
  if (r.existing_proof && r.existing_proof.length) ctx += 'PROOF: ' + r.existing_proof.join('; ') + '\n';
  if (r.case_studies && r.case_studies.length) ctx += 'CASE STUDIES: ' + r.case_studies.map(function(c) { return (c.client || 'Client') + ': ' + (c.result || '') + (c.timeframe ? ' (' + c.timeframe + ')' : ''); }).join('; ') + '\n';
  if (r.notable_clients && r.notable_clients.length) ctx += 'NOTABLE CLIENTS: ' + r.notable_clients.join(', ') + '\n';
  if (r.awards_certifications && r.awards_certifications.length) ctx += 'AWARDS/CERTS: ' + r.awards_certifications.join(', ') + '\n';

  // Keyword intelligence (from keyword research pipeline)
  var kwR = S.kwResearch || {};
  var kwCl = (kwR.clusters || []).filter(function(c) { return c.qualifies !== false; });
  if (kwCl.length) {
    var kwTotalVol = 0;
    kwCl.forEach(function(c) { kwTotalVol += (c.primaryVol || 0); });
    ctx += '\nKEYWORD INTELLIGENCE (' + kwCl.length + ' clusters, ' + kwTotalVol.toLocaleString() + ' monthly volume):\n';
    ctx += '- Top clusters:\n';
    kwCl.slice().sort(function(a,b){return (b.primaryVol||0)-(a.primaryVol||0);}).slice(0,12).forEach(function(c) {
      ctx += '  · "' + (c.primaryKw||c.name) + '" [' + (c.pageType||'?') + '] — ' + (c.primaryVol||0).toLocaleString() + '/mo → ' + (c.recommendation==='improve_existing' ? 'improve' : 'build') + ' /' + (c.suggestedSlug||c.existingSlug||'') + '\n';
    });
    var kwQuickWins = (kwR.keywords||[]).filter(function(k){return k.vol>=100 && k.kd<=20;});
    if (kwQuickWins.length) {
      ctx += '- Quick-win keywords (' + kwQuickWins.length + '): ' + kwQuickWins.slice(0,5).map(function(k){return '"'+k.kw+'" '+k.vol+'/mo KD:'+k.kd;}).join(', ') + '\n';
    }
  }
  var kwQuestions = (typeof _getQuestionsArray === 'function') ? _getQuestionsArray() : [];
  if (kwQuestions.length) {
    ctx += '\nBUYER QUESTIONS (' + kwQuestions.length + '):\n';
    kwQuestions.slice(0, 12).forEach(function(q) { ctx += '- ' + q + '\n'; });
  }

  // Risks
  if (st.risks && st.risks.risks && st.risks.risks.length) {
    var topRisks = st.risks.risks.filter(function(rk) { return rk.severity >= 6; }).map(function(rk) { return rk.risk + ' (severity: ' + rk.severity + ', mitigation: ' + (rk.mitigation || 'none') + ')'; });
    if (topRisks.length) ctx += '\nRISKS (severity 6+):\n' + topRisks.join('\n') + '\n';
  } else if (st.risks && st.risks.length) {
    var topRisks2 = st.risks.filter(function(rk) { return rk.severity >= 6; }).map(function(rk) { return rk.risk + ' (severity: ' + rk.severity + ', mitigation: ' + (rk.mitigation || 'none') + ')'; });
    if (topRisks2.length) ctx += '\nRISKS (severity 6+):\n' + topRisks2.join('\n') + '\n';
  }

  // Competitors
  if (r.competitors && r.competitors.length) {
    ctx += '\nCOMPETITORS:\n';
    r.competitors.slice(0, 5).forEach(function(c) {
      ctx += '- ' + (c.name || c.url || '') + ': strengths=' + (c.strengths || '') + '; weaknesses=' + (c.weaknesses || '') + '; what we do better=' + (c.what_we_do_better || '') + '\n';
    });
  }

  // Reference docs
  if (s.docs && s.docs.length) {
    ctx += '\nREFERENCE DOCUMENTS:\n';
    ctx += _docExtractCtx(s.docs, ['facts','decisions','requirements','competitors','audience','services','goals']);
  }

  var sys = 'You are a senior brand and conversion strategist. Using the completed strategy analysis below, write a focused 800-1100 word website-specific strategy brief. This brief will be injected into every downstream prompt (sitemap, briefs, copy) so it must be actionable and specific — not a summary.\n\n'
    + 'Output exactly these 7 sections:\n\n'
    + '1. WHAT THE SITE MUST CONVINCE: The core belief the visitor must leave with — what transformation or outcome the company delivers, and why it matters to the buyer right now. Include emotional triggers (frustration with status quo, relief, confidence) and rational triggers (pricing model, ROI data, guarantees). Reference specific proof points and numbers from the strategy.\n\n'
    + '2. COMPETITIVE FRAME: Why this company vs the obvious alternatives. Name the competitor types (not brands), explain the positioning gap, and state the unfair advantage. Reference validated differentiators — not generic claims like "experienced team". Include competitor weaknesses the copy should exploit without naming competitors.\n\n'
    + '3. CONVERSION ECONOMICS: How the website fits into the business model. State the deal size range, what a lead is worth (max CPL), whether paid media is viable, and what that means for CTA urgency and offer framing. If the economics favour organic over paid, say so — it affects how aggressively the site should gate content vs give it away. Reference the funnel architecture if available.\n\n'
    + '4. PAGE TYPE RULES: 2-3 sentences per page type (service, location, industry, blog, home, about, contact) on: what each must communicate, the conversion intent (transactional vs informational vs trust-building), what proof belongs there, and which buyer stage it serves. Map to the funnel — top-of-funnel blog content serves different goals than bottom-of-funnel service pages.\n\n'
    + '5. PROOF REQUIREMENTS: What specific evidence, stats, case studies, or social proof must appear. Name the actual proof available (specific case study results, named clients, certifications, metrics). State where each type belongs (homepage hero vs service page vs about). Vague proof like "trusted by many" is not proof — use the real data from the strategy.\n\n'
    + '6. CHANNEL INTEGRATION: How the website supports the broader channel strategy. Which channels drive traffic to which pages? If organic SEO is the primary channel, what does that mean for content depth and keyword integration? If paid is viable, which pages serve as landing pages? State what the content authority plan requires from the website.\n\n'
    + '7. HARD RULES & RISK GUARDRAILS: Anything the copy must never do — banned phrases, words to avoid, tone boundaries, compliance constraints, topics to avoid. Include risk-derived guardrails: if the strategy flagged specific risks (e.g. demand risk, competitive risk, market risk), state what the copy must do to mitigate them. List any activities that were cut in the subtraction analysis — copy must not reference discontinued services or channels.\n\n'
    + 'Be specific and direct. No generic marketing language. Use the client name throughout. Every sentence must be actionable — if a copywriter cannot act on it, cut it. Do not repeat data verbatim — interpret it into creative direction.';

  aiBarStart('Synthesising website strategy brief...');
  try {
    var result = await callClaude(sys, 'Full strategy analysis and research data:\n\n' + ctx.slice(0, 20000), null, 4000);
    S.strategy.webStrategy = result;
    scheduleSave();
    renderStrategyScorecard();
    aiBarNotify('Website strategy brief synthesised (7 sections)', { duration: 4000 });
  } catch (e) {
    aiBarNotify('Synthesis failed: ' + e.message, { isError: true, duration: 4000 });
  }
}

function canProceedFromStrategy() {
  if (!S.strategy) return false;
  if (!S.strategy.demand_validation || !S.strategy.demand_validation.overall_verdict) return false;
  if (S.strategy._meta.approved) return true;
  if (S.strategy._meta.overall_score >= 7.0) return true;
  return false;
}

function overrideStrategyField(section, path, value, reason) {
  if (!S.strategy) return;
  // Set the value
  var parts = path.split('.');
  var obj = S.strategy;
  for (var i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]]) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;

  // Log override
  var meta = S.strategy._meta;
  var v = meta.versions[meta.versions.length - 1];
  if (v) {
    v.strategist_overrides = v.strategist_overrides || [];
    v.strategist_overrides.push({ field: path, value: value, reason: reason, at: new Date().toISOString() });
  }
  scheduleSave();
  renderStrategyTabContent();
}

// ── UI State ──────────────────────────────────────────────────────────

var _sTab = 'audience';
var _sSubLever = '';

// ── UI: Init ──────────────────────────────────────────────────────────

function strategyInit() {
  if (!S.strategy) S.strategy = strategyDefaults();
  renderStrategyScorecard();
  renderStrategyNav();
  renderStrategyTabContent();
  // Eagerly fetch pricing catalog on stage entry so Channels/Output tabs
  // have pricing data without requiring a diagnostic run first
  if (!_pricingCatalog) {
    fetchPricingCatalog().then(function(cat) {
      if (!cat) return;
      _ensureEngagementScope();
      // Update pricing indicator if currently visible
      var pInd = document.getElementById('pricing-indicator');
      if (pInd) {
        pInd.outerHTML = _renderPricingIndicator();
      }
    });
  } else {
    // Catalog already loaded (e.g. from a previous diagnostic run) — ensure scope exists
    _ensureEngagementScope();
  }
}

// ── UI: Scorecard ─────────────────────────────────────────────────────

function renderStrategyScorecard() {
  var el = document.getElementById('strategy-scorecard');
  if (!el) return;
  if (!S.strategy || !S.strategy._meta) { el.innerHTML = ''; return; }

  var scores = scoreStrategy();
  var overall = scores.overall;
  var meta = S.strategy._meta;
  var colour = overall >= 7 ? 'var(--green)' : overall >= 4 ? '#e6a23c' : '#f56c6c';

  var html = '<div class="card" data-sai-explain="strategy:score" style="margin-bottom:14px;padding:14px 18px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
  html += '<div style="display:flex;align-items:center;gap:10px">';
  html += '<span style="font-size:28px;font-weight:600;color:' + colour + '">' + overall + '</span>';
  html += '<div>';
  html += '<div style="font-size:12px;color:var(--n2)">Strategy Score</div>';
  if (meta.current_version > 0) {
    html += '<div style="font-size:10px;color:var(--n2);display:flex;align-items:center;gap:6px;flex-wrap:wrap">v' + meta.current_version;
    if (meta.approved) html += ' <span style="color:var(--green)">Approved</span>';
    if (meta.versions && meta.versions.length > 1) html += ' <a href="#" onclick="event.preventDefault();showStrategyHistory()" style="color:var(--blue);font-size:10px">History</a>';
    // Show selected direction label
    var _posDir = S.strategy.positioning && S.strategy.positioning.selected_direction;
    if (_posDir) {
      html += ' <span style="color:var(--n1)">|</span> <span style="color:#6b21a8;font-weight:500">Direction: ' + esc(_posDir.direction.length > 35 ? _posDir.direction.slice(0, 35) + '...' : _posDir.direction) + '</span>';
    }
    html += '</div>';
  }
  html += '</div></div>';

  // Action buttons
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  if (meta.current_version === 0) {
    html += '<button class="btn btn-primary" data-tip="Runs enrichment then all diagnostics (D0-D7) sequentially" onclick="generateStrategy()"><i class="ti ti-sparkles"></i> Generate Strategy</button>';
  } else {
    html += '<button class="btn btn-ghost" data-tip="Re-runs all enrichment and all diagnostics (D0-D7) from scratch" onclick="generateStrategy()"><i class="ti ti-refresh"></i> Regenerate All</button>';
    html += '<button class="btn btn-primary" data-tip="Re-runs the 3 weakest sections plus keyword demand validation" onclick="improveStrategy()"><i class="ti ti-sparkles"></i> Improve Weakest</button>';
    html += '<button class="btn btn-ghost" data-tip="Re-runs all diagnostics (D0-D8) including Narrative without re-fetching enrichment data" onclick="runAllDiagnostics()"><i class="ti ti-list-check"></i> Re-run All Diagnostics</button>';
  }
  if (meta.current_version > 0 && !meta.approved) {
    html += '<button class="btn btn-dark" onclick="approveStrategy()"><i class="ti ti-check"></i> Approve</button>';
  }
  html += '</div></div>';

  // First-pass score warning (Correction 5)
  if (meta.current_version === 1 && overall > 7.0) {
    html += '<div style="font-size:11px;color:#b45309;margin-top:6px;padding:4px 8px;background:#fef3c7;border-radius:4px;border:1px solid #fde68a">'
      + '<i class="ti ti-alert-triangle" style="font-size:12px"></i> First pass score unusually high (' + overall + ') — verify scoring accuracy. First passes rarely clear 7.0 without all manual inputs populated and 100% audit pass rate.</div>';
  }

  // Score history comparison (large jumps between versions)
  if (meta.versions && meta.versions.length >= 2) {
    var prevVersion = meta.versions[meta.versions.length - 2];
    var currVersion = meta.versions[meta.versions.length - 1];
    if (prevVersion && currVersion && prevVersion.overall_score && currVersion.overall_score) {
      var jump = currVersion.overall_score - prevVersion.overall_score;
      if (jump > 1.5) {
        html += '<div style="font-size:11px;color:#6b7280;margin-top:4px">'
          + '<i class="ti ti-info-circle" style="font-size:11px"></i> Score jumped +' + (Math.round(jump * 10) / 10) + ' between v' + (meta.versions.length - 1) + ' (' + prevVersion.overall_score + ') and v' + meta.versions.length + ' (' + currVersion.overall_score + ') — review changes to confirm.</div>';
      }
    }
  }

  // Keyword pipeline audit (quick summary)
  var kwAudit = auditKeywordPipeline();
  if (kwAudit.overall.total > 0) {
    var kwRate = kwAudit.overall.rate;
    var kwC = kwRate >= 80 ? 'var(--green)' : kwRate >= 50 ? '#e6a23c' : '#f56c6c';
    html += '<div style="font-size:11px;margin-top:6px;display:flex;align-items:center;gap:6px">';
    html += '<span style="color:' + kwC + '">Keyword pipeline: ' + kwAudit.overall.pass + '/' + kwAudit.overall.total + ' checks (' + kwRate + '%)</span>';
    if (kwRate < 80) {
      html += '<span style="color:var(--n2)">— ';
      if (kwAudit.seeds.pass < kwAudit.seeds.total) html += 'seeds ';
      if (kwAudit.opportunities.pass < kwAudit.opportunities.total) html += 'opportunities ';
      if (kwAudit.clusters.pass < kwAudit.clusters.total) html += 'clusters ';
      html += 'need work</span>';
    }
    html += '</div>';
  }

  // D8 status
  if (!S.strategy.demand_validation || !S.strategy.demand_validation.overall_verdict) {
    html += '<div style="font-size:11px;color:#e6a23c;margin-top:6px"><i class="ti ti-alert-triangle" style="font-size:12px"></i> Keyword demand validation has not run yet (click Improve Weakest to include it) \u2014 overall score capped at 6.5 until validated</div>';
  } else {
    var verdict = S.strategy.demand_validation.overall_verdict;
    var vc = verdict === 'viable' ? 'var(--green)' : verdict === 'marginal' ? '#e6a23c' : '#f56c6c';
    html += '<div style="font-size:11px;color:' + vc + ';margin-top:6px">Demand: ' + verdict + '</div>';
  }

  // Active score caps (transparency)
  if (scores.activeCaps && scores.activeCaps.length) {
    html += '<div style="margin-top:6px">';
    scores.activeCaps.forEach(function(ac) {
      var capLabel = ac.condition.replace(/_/g, ' ').replace(/\bd8\b/g, 'D8').replace(/\bno\b/g, 'No');
      html += '<div style="font-size:10px;color:#f56c6c;display:flex;align-items:center;gap:4px;margin-top:2px">'
        + '<i class="ti ti-lock" style="font-size:10px"></i>'
        + '<span>Score capped at ' + ac.cap + ' — ' + esc(capLabel) + '</span></div>';
    });
    html += '</div>';
  }

  // Website strategy brief status
  if (meta.current_version > 0) {
    var hasWs = S.strategy.webStrategy && S.strategy.webStrategy.trim();
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;font-size:11px">';
    if (hasWs) {
      html += '<span style="color:var(--green)"><i class="ti ti-check" style="font-size:11px"></i> Website strategy brief ready</span>';
      html += '<button class="btn btn-ghost sm" style="font-size:10px" onclick="synthesiseWebStrategy()"><i class="ti ti-refresh"></i> Regenerate</button>';
    } else {
      html += '<span style="color:var(--n2)">Website strategy brief not yet generated</span>';
      html += '<button class="btn btn-ghost sm" style="font-size:10px" onclick="synthesiseWebStrategy()"><i class="ti ti-sparkles"></i> Synthesise</button>';
    }
    html += '</div>';
  }

  // Proceed gate
  if (meta.current_version > 0) {
    html += '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;display:flex;align-items:center;justify-content:space-between">';
    if (canProceedFromStrategy()) {
      html += '<span style="font-size:11px;color:var(--green)">Ready to proceed to Sitemap</span>';
      html += '<button class="btn btn-primary sm" onclick="goTo(\'sitemap\')"><i class="ti ti-arrow-right"></i> Proceed</button>';
    } else if (!S.strategy.demand_validation || !S.strategy.demand_validation.overall_verdict) {
      html += '<span style="font-size:11px;color:#e6a23c">Run keyword demand validation before proceeding</span>';
      html += '<button class="btn btn-ghost sm" data-tip="Validates keyword demand for your services and uncaps the score" onclick="improveStrategy()"><i class="ti ti-sparkles"></i> Validate Demand</button>';
    } else if (overall < 7.0 && !meta.approved) {
      html += '<span style="font-size:11px;color:var(--n2)">Score: ' + overall + ' / 7.0 threshold</span>';
      html += '<div style="display:flex;gap:4px"><button class="btn btn-ghost sm" onclick="improveStrategy()">Improve</button>';
      html += '<button class="btn btn-ghost sm" onclick="approveStrategy()">Accept with limitations</button></div>';
    }
    html += '</div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

// ── UI: Tab Navigation ────────────────────────────────────────────────

function renderStrategyNav() {
  var el = document.getElementById('strategy-tab-nav');
  if (!el) return;
  var html = '';
  STRATEGY_TABS.forEach(function(t) {
    var active = t.id === _sTab;
    var secScore = null;
    if (S.strategy && STRATEGY_SECTION_WEIGHTS[t.id]) {
      var sr = scoreSection(t.id);
      secScore = sr.score;
    }
    html += '<button onclick="_sTab=\'' + t.id + '\';renderStrategyNav();renderStrategyTabContent()" '
      + 'style="padding:8px 14px;font-size:12px;border:none;background:none;cursor:pointer;font-family:var(--font);'
      + 'color:' + (active ? 'var(--dark)' : 'var(--n2)') + ';border-bottom:2px solid ' + (active ? 'var(--dark)' : 'transparent') + ';transition:all .15s">'
      + '<i class="ti ' + t.icon + '" style="margin-right:4px"></i>' + t.label;
    if (secScore !== null) {
      var sc = secScore >= 7 ? 'var(--green)' : secScore >= 4 ? '#e6a23c' : '#f56c6c';
      html += ' <span style="font-size:9px;color:' + sc + ';font-weight:600">' + secScore + '</span>';
    }
    // Output tab: show checkmark if compiled
    if (t.id === 'output' && S.strategy && S.strategy.compiled_output) {
      html += ' <span style="font-size:9px;color:var(--green)"><i class="ti ti-check" style="font-size:10px"></i></span>';
    }
    html += '</button>';
  });
  el.innerHTML = html;
}

// ── Keywords Persistent Panel ─────────────────────────────────────────

var _kwPanelOpen = false;

function _renderKeywordsPanel() {
  var wrap = document.getElementById('strategy-kw-panel');
  if (!wrap) return;

  var kwR = S.kwResearch || {};
  var hasKw = kwR.keywords && kwR.keywords.length > 0;
  var kwCount = hasKw ? kwR.keywords.length : 0;
  var clusterCount = kwR.clusters ? kwR.clusters.length : 0;
  var selectedCount = kwR.selected ? kwR.selected.length : 0;

  var html = '<div style="border:1px solid var(--border);border-radius:8px;background:var(--panel);margin-bottom:16px">';

  // Header bar — always visible
  html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer" id="kw-panel-toggle">';
  html += '<i class="ti ti-tags" style="color:var(--n2);font-size:15px"></i>';
  html += '<span style="font-size:12px;font-weight:600;color:var(--dark)">Keyword Research</span>';

  // Status badges
  if (hasKw) {
    html += '<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:var(--green)10;color:var(--green);font-weight:500">'
      + kwCount + ' keywords</span>';
    if (clusterCount) html += '<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:#409eff10;color:#409eff;font-weight:500">'
      + clusterCount + ' clusters</span>';
    if (selectedCount) html += '<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:#e6a23c10;color:#e6a23c;font-weight:500">'
      + selectedCount + ' selected</span>';
  } else {
    html += '<span style="font-size:10px;color:var(--n2)">Not run yet</span>';
  }

  // Stale indicator
  if (S.strategy && S.strategy._kwDataStale) {
    html += '<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:#fef0f0;color:#f56c6c;font-weight:500">Stale — re-run diagnostics</span>';
  }

  html += '<span style="flex:1"></span>';
  html += '<i class="ti ' + (_kwPanelOpen ? 'ti-chevron-up' : 'ti-chevron-down') + '" style="color:var(--n2);font-size:14px"></i>';
  html += '</div>';

  // Collapsible content
  if (_kwPanelOpen) {
    html += '<div style="border-top:1px solid var(--border);padding:0">';
    html += '<div id="strategy-kw-wrap">'
      + (typeof renderPipelineStatusContainer === 'function' ? renderPipelineStatusContainer() : '')
      + '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px" id="kw-tab-nav"></div>'
      + '<div id="kw-tab-content"></div>'
      + '</div>';
    html += '</div>';
  }

  html += '</div>';
  wrap.innerHTML = html;

  // Wire toggle
  var toggleBtn = document.getElementById('kw-panel-toggle');
  if (toggleBtn) {
    toggleBtn.onclick = function() {
      _kwPanelOpen = !_kwPanelOpen;
      _renderKeywordsPanel();
    };
  }

  // Init keywords.js if panel is open
  if (_kwPanelOpen) {
    initKeywords();
    if (typeof _renderPipelineStatus === 'function') _renderPipelineStatus();
  }
}

// ── Run Diagnostics From Here Forward ────────────────────────────────

async function runDiagnosticsFrom(startDiag) {
  if (!S.strategy) S.strategy = strategyDefaults();
  window._aiStopAll = false;
  aiBarStart('Loading pricing catalog');
  await fetchPricingCatalog();
  var diagLabel = { 0:'D0 Audience', 1:'D1 Economics', 2:'D2 Positioning', 3:'D3 Subtraction', 4:'D4 Channels', 5:'D5 Website', 6:'D6 Content', 7:'D7 Risks', 8:'D8 Narrative', 9:'D9 Sales' };
  aiBarStart('Running diagnostics from ' + (diagLabel[startDiag] || 'D' + startDiag) + ' forward');
  try {
    for (var d = startDiag; d <= 7; d++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Diagnostics paused (D' + d + '/9)',
          fn: function(args) { _resumeDiagnosticsFrom(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      if (d < 7) await new Promise(function(res) { setTimeout(res, 2000); });
    }
    // Run D8 Narrative after D1-D7
    if (!window._aiStopAll) {
      try { await runDiagnostic(8); } catch(e8) { console.warn('D8 Narrative error:', e8.message); aiBarNotify('D8 Narrative: ' + e8.message, { duration: 4000 }); }
    }
    if (!window._aiStopAll) {
      aiBarStart('Running D9 Sales Intelligence');
      try { await runDiagnostic(9); } catch(e9) { console.warn('D9 Sales error:', e9.message); aiBarNotify('D9 Sales: ' + e9.message, { duration: 4000 }); }
    }
    S.strategy._kwDataStale = false;
    capturePricingSnapshot();
    createStrategyVersion('rerun_from_d' + startDiag);
    await saveProject();
    renderStrategyScorecard();
    renderStrategyNav();
    renderStrategyTabContent();
    aiBarEnd('Diagnostics D' + startDiag + '-D9 complete \u2014 v' + S.strategy._meta.current_version);
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

async function _resumeDiagnosticsFrom(startFrom) {
  window._aiStopAll = false;
  try {
    for (var d = startFrom; d <= 7; d++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Diagnostics paused (D' + d + '/9)',
          fn: function(args) { _resumeDiagnosticsFrom(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      if (d < 7) await new Promise(function(res) { setTimeout(res, 2000); });
    }
    // Run D8 Narrative after D1-D7
    if (!window._aiStopAll) {
      try { await runDiagnostic(8); } catch(e8) { console.warn('D8 Narrative error:', e8.message); aiBarNotify('D8 Narrative: ' + e8.message, { duration: 4000 }); }
    }
    if (!window._aiStopAll) {
      aiBarStart('Running D9 Sales Intelligence');
      try { await runDiagnostic(9); } catch(e9) { console.warn('D9 Sales error:', e9.message); aiBarNotify('D9 Sales: ' + e9.message, { duration: 4000 }); }
    }
    S.strategy._kwDataStale = false;
    capturePricingSnapshot();
    createStrategyVersion('rerun_from_d' + startFrom);
    await saveProject();
    renderStrategyScorecard();
    renderStrategyNav();
    renderStrategyTabContent();
    aiBarEnd('Diagnostics complete \u2014 v' + S.strategy._meta.current_version);
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

// ── UI: Tab Content ───────────────────────────────────────────────────

function renderStrategyTabContent() {
  var el = document.getElementById('strategy-tab-content');
  if (!el) return;

  // Keywords persistent panel — always render above tab content
  _renderKeywordsPanel();

  // Redirect legacy 'growth' / 'keywords' tabs to merged destinations
  if (_sTab === 'growth') _sTab = 'channels';
  if (_sTab === 'keywords') _sTab = 'channels';

  if (_sTab === 'output') {
    el.innerHTML = _renderOutput(S.strategy || {});
    return;
  }

  var st = S.strategy || {};
  var html = '';

  // Re-run diagnostic button
  var diagMap = { audience: 0, positioning: 2, economics: 1, subtraction: 3, channels: 4, execution: 5, brand: 6, risks: 7, narrative: 8, sales: 9 };
  var diagLabels = {
    0: 'Audience Intelligence',
    1: 'Unit Economics',
    2: 'Competitive Position',
    3: 'Subtraction',
    4: 'Channel Viability',
    5: 'Website & CRO',
    6: 'Content & Authority',
    7: 'Risk Assessment',
    8: 'Narrative & Messaging',
    9: 'Sales Intelligence'
  };
  var diagTips = {
    0: 'Re-analyse audience segments, personas and buying motions',
    1: 'Re-analyse CPL, CAC, LTV and budget viability',
    2: 'Re-assess competitive positioning and differentiators',
    3: 'Re-evaluate which activities to cut or restructure',
    4: 'Re-score all 13 marketing levers and budget allocation',
    5: 'Re-assess website build type, forms and conversion strategy',
    6: 'Re-analyse content gaps, pillars and authority plan',
    7: 'Re-score risk categories and update mitigations',
    8: 'StoryBrand arc, messaging pillars, objection map, content hooks, VoC swipe file',
    9: 'Sales narrative, proposal data, objection prep for Setsail pitch'
  };
  var diagNum = diagMap[_sTab];
  if (diagNum !== undefined && diagNum !== null) {
    var meta = (S.strategy && S.strategy._meta) ? S.strategy._meta : { current_version: 0 };
    html += '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">';
    html += '<button class="btn btn-ghost sm" data-tip="' + (diagTips[diagNum] || '') + '" onclick="runDiagnostic(' + diagNum + ').then(function(){renderStrategyScorecard();renderStrategyTabContent()})"><i class="ti ti-refresh"></i> Re-run ' + diagLabels[diagNum] + '</button>';
    if (meta.current_version > 0) {
      html += '<button class="btn btn-primary sm" data-tip="Runs all diagnostics (D0-D7) in sequence without re-fetching enrichment data" onclick="runAllDiagnostics()"><i class="ti ti-list-check"></i> Run All Diagnostics</button>';
      // "From here forward" — re-run this diagnostic and all subsequent
      if (diagNum < 7) {
        html += '<button class="btn btn-ghost sm" data-tip="Re-runs D' + diagNum + ' through D7 sequentially" onclick="runDiagnosticsFrom(' + diagNum + ')"><i class="ti ti-player-skip-forward"></i> From here \u2192</button>';
      }
      if (S.strategy._kwDataStale && (diagNum === 4 || diagNum === 5 || diagNum === 6)) {
        html += '<button class="btn btn-primary sm" style="background:var(--green)" data-tip="Re-runs D4, D5, D6 with keyword research data for more accurate channel, website, and content recommendations" onclick="rerunKeywordSensitiveDiagnostics()"><i class="ti ti-vocabulary"></i> Re-run with Keywords</button>';
      }
    } else {
      html += '<button class="btn btn-primary sm" data-tip="Runs enrichment then all diagnostics (D0-D7) in sequence" onclick="generateStrategy()"><i class="ti ti-sparkles"></i> Generate Full Strategy</button>';
    }
    html += '</div>';
  }

  // Gap panel
  if (STRATEGY_SECTION_WEIGHTS[_sTab]) {
    var sScore = scoreSection(_sTab);
    if (sScore.gaps.length > 0 && sScore.score < 7) {
      html += _renderGapPanel(sScore);
    }

    // Show active caps for this section
    var secCaps = [];
    ANTI_INFLATION_CAPS.forEach(function(cap) {
      if ((cap.section === _sTab || cap.section === '_all') && cap.test()) {
        secCaps.push(cap);
      }
    });
    if (secCaps.length) {
      html += '<div style="padding:6px 10px;margin-bottom:10px;border-radius:4px;background:#fef0f0;border:1px solid #f56c6c20">';
      secCaps.forEach(function(cap) {
        var capLabel = cap.condition.replace(/_/g, ' ');
        html += '<div style="font-size:10px;color:#f56c6c;display:flex;align-items:center;gap:4px;margin:2px 0">'
          + '<i class="ti ti-lock" style="font-size:10px"></i>'
          + '<span>' + esc(cap.dimension) + ' score capped at ' + cap.cap + ' — ' + esc(capLabel) + '</span></div>';
      });
      html += '</div>';
    }
  }

  // Audit panel (show quality checks for the relevant diagnostic)
  if (diagNum !== undefined && diagNum !== null) {
    html += _renderStrategyAuditPanel(diagNum);
  }

  // Section content
  if (_sTab === 'audience') html += '<div data-sai-explain="diagnostic:D0">' + _renderAudience(st) + '</div>';
  else if (_sTab === 'positioning') html += '<div data-sai-explain="diagnostic:D2">' + _renderPositioning(st) + '</div>';
  else if (_sTab === 'economics') html += '<div data-sai-explain="diagnostic:D1">' + _renderEconomics(st) + '</div>';
  else if (_sTab === 'subtraction') html += '<div data-sai-explain="diagnostic:D3">' + _renderSubtraction(st) + '</div>';
  else if (_sTab === 'channels') { html += '<div data-sai-explain="diagnostic:D4">' + _renderChannels(st) + _renderGrowth(st) + '</div>'; }
  else if (_sTab === 'execution') html += '<div data-sai-explain="diagnostic:D5">' + _renderExecution(st) + '</div>';
  else if (_sTab === 'brand') html += '<div data-sai-explain="diagnostic:D6">' + _renderBrand(st) + '</div>';
  else if (_sTab === 'risks') html += '<div data-sai-explain="diagnostic:D7">' + _renderRisks(st) + '</div>';
  else if (_sTab === 'narrative') html += '<div data-sai-explain="diagnostic:D8">' + _renderNarrative(st) + '</div>';

  // Strategist override panel (all scored tabs)
  if (diagNum !== undefined && diagNum !== null) {
    html += _renderStrategistOverride(_sTab, diagNum);
  }

  el.innerHTML = html;

  // Wire up strategist notes buttons via createElement pattern
  if (diagNum !== undefined && diagNum !== null) {
    var saveBtn = document.getElementById('strat-notes-save-' + _sTab);
    var rerunBtn = document.getElementById('strat-notes-rerun-' + _sTab);
    if (saveBtn) {
      (function(tab) {
        saveBtn.onclick = function() { _saveStrategistNotes(tab); };
      })(_sTab);
    }
    if (rerunBtn) {
      (function(tab, dNum) {
        rerunBtn.onclick = function() { _rerunWithNotes(tab, dNum); };
      })(_sTab, diagNum);
    }
  }

  // Mount interactive Gantt chart (now lives in Channels tab with growth content)
  if (_sTab === 'channels') {
    _mountGantt(S.strategy || {});
    _mountScopePanel();
  }
}

// ── UI: Strategist Override Panel ─────────────────────────────────────

function _renderStrategistOverride(tabId, diagNum) {
  var overrides = (S.strategy && S.strategy.strategist_overrides) ? S.strategy.strategist_overrides : {};
  var tabOverride = overrides[tabId] || {};
  var notes = tabOverride.notes || '';
  var updatedAt = tabOverride.updated_at || null;

  var html = '<div style="margin-top:24px;border-top:2px solid var(--border);padding-top:16px">';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">';
  html += '<i class="ti ti-pencil" style="color:var(--n2)"></i>';
  html += '<span style="font-size:12px;font-weight:600;color:var(--dark)">Strategist Notes</span>';
  if (updatedAt) {
    var d = new Date(updatedAt);
    var dateStr = d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
    html += '<span style="font-size:10px;color:var(--n2);margin-left:auto">Last saved: ' + dateStr + '</span>';
  }
  html += '</div>';

  html += '<textarea id="strat-notes-textarea-' + tabId + '" '
    + 'style="width:100%;min-height:80px;padding:10px 12px;border:1px solid var(--border);border-radius:6px;font-family:var(--font);font-size:12px;line-height:1.5;resize:vertical;color:var(--dark);background:var(--panel)" '
    + 'placeholder="Add context, corrections, or overrides here. These persist and feed into the next re-run of this diagnostic.">'
    + esc(notes) + '</textarea>';

  html += '<div style="display:flex;gap:6px;margin-top:8px;align-items:center">';
  html += '<button class="btn btn-ghost sm" id="strat-notes-save-' + tabId + '"><i class="ti ti-device-floppy"></i> Save Notes</button>';
  html += '<button class="btn btn-primary sm" id="strat-notes-rerun-' + tabId + '"><i class="ti ti-sparkles"></i> Re-run with Notes</button>';

  // Show preview of last saved note
  if (notes && notes.length > 0) {
    var preview = notes.length > 80 ? notes.substring(0, 80) + '...' : notes;
    html += '<span style="font-size:10px;color:var(--n2);margin-left:auto;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">"' + esc(preview) + '"</span>';
  }
  html += '</div></div>';

  return html;
}

function _saveStrategistNotes(tabId) {
  var textarea = document.getElementById('strat-notes-textarea-' + tabId);
  if (!textarea) return;
  var notes = textarea.value.trim();

  if (!S.strategy) S.strategy = strategyDefaults();
  if (!S.strategy.strategist_overrides) S.strategy.strategist_overrides = {};
  S.strategy.strategist_overrides[tabId] = {
    notes: notes,
    updated_at: new Date().toISOString()
  };

  scheduleSave();
  aiBarNotify('Strategist notes saved for ' + (STRATEGY_SECTION_LABELS[tabId] || tabId), { duration: 2000 });
  renderStrategyTabContent();
}

async function _rerunWithNotes(tabId, diagNum) {
  // Save notes first
  _saveStrategistNotes(tabId);

  // Then re-run the diagnostic (notes will be picked up by buildDiagnosticPrompt)
  await runDiagnostic(diagNum);
  renderStrategyScorecard();
  renderStrategyTabContent();
}

// ── UI: Gap Panel ─────────────────────────────────────────────────────

function _renderGapPanel(sScore) {
  var html = '<div class="card" style="border-left:3px solid #e6a23c;margin-bottom:14px;padding:14px">';
  html += '<div style="font-size:12px;font-weight:500;margin-bottom:8px">Gaps (score: ' + sScore.score + ' \u2192 needs 7.0)</div>';
  sScore.gaps.forEach(function(g) {
    html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">';
    html += '<span style="color:#e6a23c"><i class="ti ti-alert-triangle"></i></span>';
    html += '<span>' + esc(g.gap) + '</span>';
    if (g.can_auto_resolve) {
      html += '<button class="btn btn-ghost sm" style="margin-left:auto;font-size:10px" onclick="_autoResolveGap(\'' + esc(g.data_needed) + '\')"><i class="ti ti-sparkles"></i> Auto</button>';
    } else {
      html += '<span style="margin-left:auto;font-size:10px;color:var(--n2)">Manual</span>';
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

async function _autoResolveGap(gapKey) {
  var r = S.research || {};
  var s = S.setup || {};
  var geo = r.geography && r.geography.primary ? r.geography.primary : s.geo || '';

  if (gapKey === 'competitor_deep_dive' || gapKey === 'competitor deep dive') {
    if (r.competitors && r.competitors.length) {
      aiBarStart('Auto-resolving: competitor deep-dive');
      S.strategy._enrichment.competitor_deep_dive = [];
      for (var i = 0; i < Math.min(2, r.competitors.length); i++) {
        var dd = await strategyEnrich.competitorDeepDive(r.competitors[i].url);
        if (dd) { dd.url = r.competitors[i].url; dd.name = r.competitors[i].name; S.strategy._enrichment.competitor_deep_dive.push(dd); }
        if (i < 1) await new Promise(function(res) { setTimeout(res, 2000); });
      }
      scheduleSave();
      renderStrategyScorecard();
      renderStrategyTabContent();
      aiBarEnd('Competitor deep-dive complete');
    }
  } else if (gapKey === 'cpc_estimates' || gapKey === 'cpc estimates') {
    var svcNames = (r.primary_services || []).slice(0, 5);
    if (svcNames.length) {
      aiBarStart('Auto-resolving: CPC estimates');
      var seeds = svcNames.map(function(sn) { return sn.toLowerCase() + ' ' + geo.replace(/,.*$/, '').trim().toLowerCase(); });
      var result = await strategyEnrich.cpcEstimates(seeds, geo);
      if (result) S.strategy._enrichment.cpc_estimates = result;
      scheduleSave();
      renderStrategyScorecard();
      renderStrategyTabContent();
      aiBarEnd('CPC estimates fetched');
    }
  } else if (gapKey === 'keyword_pre_scan' || gapKey === 'keyword pre scan') {
    if (r.industry && (r.primary_services || []).length) {
      aiBarStart('Auto-resolving: keyword pre-scan');
      var result2 = await strategyEnrich.keywordPreScan(r.industry, geo, r.primary_services);
      if (result2) S.strategy._enrichment.keyword_pre_scan = result2;
      scheduleSave();
      renderStrategyScorecard();
      renderStrategyTabContent();
      aiBarEnd('Keyword pre-scan complete');
    }
  } else if (gapKey === 'current_presence' || gapKey === 'current presence') {
    if (s.url) {
      aiBarStart('Auto-resolving: site check');
      var result3 = await strategyEnrich.sitePerformanceCheck(s.url);
      if (result3) S.strategy._enrichment.current_presence = result3;
      scheduleSave();
      renderStrategyScorecard();
      renderStrategyTabContent();
      aiBarEnd('Site check complete');
    }
  }
}

// ── UI: Section Renderers ─────────────────────────────────────────────

function _stratField(label, value, opts) {
  opts = opts || {};
  if (value === undefined || value === null) value = '';
  // Format arrays as bullet lists or comma-separated
  if (Array.isArray(value)) {
    if (value.length > 2 || value.some(function(v) { return String(v).length > 40; })) {
      value = '<ul style="margin:0;padding-left:16px">' + value.map(function(v) {
        return '<li style="margin-bottom:2px">' + esc(String(v)) + '</li>';
      }).join('') + '</ul>';
      opts._html = true;
    } else {
      value = value.join(', ');
    }
  }
  // Format objects as a clean key-value list
  if (typeof value === 'object' && value !== null) {
    var keys = Object.keys(value);
    if (keys.length) {
      value = '<div style="display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:12px">'
        + keys.map(function(k) {
          var v = value[k];
          if (typeof v === 'object') v = Array.isArray(v) ? v.join(', ') : JSON.stringify(v);
          return '<span style="color:var(--n2);text-transform:capitalize">' + esc(k.replace(/_/g, ' ')) + '</span>'
            + '<span style="color:var(--dark)">' + esc(String(v)) + '</span>';
        }).join('')
        + '</div>';
      opts._html = true;
    } else {
      value = '\u2014';
    }
  }
  var strVal = String(value);
  var isLong = strVal.length > 100 || opts.textarea;
  var h = '<div style="margin-bottom:10px;' + (opts.span ? 'grid-column:1/-1;' : '') + '">';
  h += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">' + esc(label);
  if (opts.tip) h += ' <span data-tip="' + esc(opts.tip) + '" style="cursor:help;opacity:.6;font-size:9px">ⓘ</span>';
  h += '</div>';
  if (opts._html) {
    h += '<div style="font-size:13px;color:var(--dark)">' + value + '</div>';
  } else if (isLong) {
    h += '<div style="font-size:13px;color:var(--dark);background:var(--panel);border-radius:6px;padding:8px 10px;white-space:pre-wrap;max-height:200px;overflow-y:auto">' + esc(strVal) + '</div>';
  } else {
    h += '<div style="font-size:13px;color:var(--dark)">' + esc(strVal || '\u2014') + '</div>';
  }
  h += '</div>';
  return h;
}

function _stratSection(title, content) {
  return '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">'
    + esc(title) + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px">' + content + '</div></div>';
}

// ── Positioning Hypotheses & Direction Selection ──────────────────────

async function evaluateHypotheses() {
  var p = S.strategy && S.strategy.positioning || {};
  var hypotheses = (p.hypotheses_input || []).filter(function(h) { return h && h.trim(); });
  if (!hypotheses.length) {
    aiBarNotify('Add at least one positioning hypothesis first', { duration: 3000 });
    return;
  }

  var r = S.research || {};
  var st = S.strategy || {};

  // Build competitor context
  var compCtx = '';
  if (r.competitors && r.competitors.length) {
    compCtx = r.competitors.map(function(c) {
      return '- ' + c.name + ' (' + c.url + '): Positioning: ' + (c.why_they_win || '') + '. Weaknesses: ' + (c.weaknesses || '');
    }).join('\n');
  }
  var deepDive = '';
  if (st._enrichment && st._enrichment.competitor_deep_dive && st._enrichment.competitor_deep_dive.length) {
    deepDive = st._enrichment.competitor_deep_dive.map(function(cd) {
      return (cd.url || '') + ': ' + (cd.positioning || '') + ' | DR: ' + (cd.dr || '?') + ' | Strengths: ' + (cd.strengths || []).join(', ');
    }).join('\n');
  }

  // Differentiator context from existing D2 if available
  var diffCtx = '';
  if (p.validated_differentiators && p.validated_differentiators.length) {
    diffCtx = 'VALIDATED: ' + p.validated_differentiators.join('; ');
  }
  if (p.contested_differentiators && p.contested_differentiators.length) {
    diffCtx += '\nCONTESTED: ' + p.contested_differentiators.map(function(cd) { return cd.claim + ' (' + cd.intensity + ': ' + cd.competitor + ' — ' + cd.competitor_depth + ')'; }).join('; ');
  } else if (p.rejected_differentiators && p.rejected_differentiators.length) {
    diffCtx += '\nREJECTED: ' + p.rejected_differentiators.map(function(rd) { return rd.claim + ' (reason: ' + rd.reason + ')'; }).join('; ');
  }

  // Demand signals from D8
  var demandCtx = '';
  if (st.demand_validation) {
    demandCtx = 'Demand verdict: ' + (st.demand_validation.overall_verdict || 'not run');
    if (st.demand_validation.seo_viability_score) demandCtx += ' | SEO viability: ' + st.demand_validation.seo_viability_score;
  }
  var kwCtx = '';
  var kw = S.kwResearch || {};
  if (kw.keywords && kw.keywords.length) {
    var topKw = kw.keywords.slice().sort(function(a,b){return(b.vol||0)-(a.vol||0);}).slice(0,15);
    kwCtx = topKw.map(function(k){return '"'+k.kw+'" ('+k.vol+'/mo, KD:'+k.kd+')';}).join(', ');
  }

  var sys = 'You are a senior brand strategist stress-testing positioning hypotheses against market reality.\n\n'
    + 'You receive the founder hypotheses alongside competitor data, validated/rejected differentiators, and demand signals.\n\n'
    + 'CRITICAL POSITIONING RULES:\n'
    + '1. Evaluate ALL founder hypotheses with honest scoring. Do not dismiss any with less than 3 sentences of specific evidence.\n'
    + '2. After evaluating founder hypotheses, generate 2-3 SYSTEM-RECOMMENDED directions. These may incorporate founder hypotheses, combine elements from multiple, or propose entirely new angles — but they must be DISTINCT from each other, not variations of the same idea.\n'
    + '3. Each recommended direction MUST include: what it gains (specific advantages), what it costs (specific trade-offs, audiences alienated, messages diluted), provability score with evidence, distinctiveness score with competitor comparison, what proof needs to be built to own this position.\n'
    + '4. DO NOT auto-select a direction. Present all options with scores and trade-offs. End with a founder_decision_prompt that frames the core trade-off.\n'
    + '5. If you strongly favour one direction, label it in system_recommendation and explain WHY, including what is wrong with the alternatives. The strategist still clicks to select.\n'
    + '6. The founder may specify positioning to AVOID. No recommended direction should overlap with, imply, or resemble avoided positions. Flag any hypothesis that risks being perceived as avoided positioning.\n\n'
    + 'Respond with ONLY valid JSON matching this schema:\n'
    + '{\n'
    + '  "hypothesis_evaluations": [\n'
    + '    {\n'
    + '      "hypothesis": "the founder hypothesis text",\n'
    + '      "verdict": "viable | partially_viable | contested",\n'
    + '      "verdict_label": "short human label",\n'
    + '      "scores": { "provability": 0, "distinctiveness": 0, "market_demand": 0, "risk": 0 },\n'
    + '      "evidence_for": ["specific evidence from data — at least 2 items"],\n'
    + '      "evidence_against": ["specific evidence from data — at least 2 items"],\n'
    + '      "reframing": "if not viable, how to reframe",\n'
    + '      "proof_requirements": ["what client needs to prove this"]\n'
    + '    }\n'
    + '  ],\n'
    + '  "recommended_directions": [\n'
    + '    {\n'
    + '      "direction": "short label",\n'
    + '      "headline": "one sentence the homepage would say",\n'
    + '      "combines": ["which hypotheses or elements it draws from"],\n'
    + '      "provability_score": 0,\n'
    + '      "distinctiveness_score": 0,\n'
    + '      "what_it_gains": "specific advantages of this direction",\n'
    + '      "what_it_costs": "specific trade-offs — audiences alienated, messages diluted",\n'
    + '      "rationale": "why this direction scores highest",\n'
    + '      "risk": "what could go wrong",\n'
    + '      "proof_to_build": ["specific proof assets needed to own this position"],\n'
    + '      "what_changes_if_chosen": "how this shapes messaging, proof strategy, content"\n'
    + '    }\n'
    + '  ],\n'
    + '  "system_recommendation": "which direction the system recommends and WHY — include what is wrong with the alternatives",\n'
    + '  "founder_decision_prompt": "the core trade-off the founder needs to resolve — end with: Select a direction to align all downstream strategy outputs."\n'
    + '}\n\n'
    + 'All scores 1-10. Risk is inverted (lower = better = less risky).';

  // Positioning to avoid
  var avoidList = (p.positioning_to_avoid || []).filter(function(a) { return a && a.trim(); });

  var user = 'FOUNDER POSITIONING HYPOTHESES:\n'
    + hypotheses.map(function(h, i) { return (i + 1) + '. ' + h; }).join('\n')
    + (avoidList.length ? '\n\nPOSITIONING TO AVOID (founder explicitly rejects these directions — no recommended direction should overlap with these):\n' + avoidList.map(function(a) { return '- ' + a; }).join('\n') : '')
    + '\n\nCLIENT SERVICES: ' + JSON.stringify((r.services_detail || []).map(function(s) { return s.name; }))
    + '\nCLIENT PROOF: ' + JSON.stringify(r.existing_proof || [])
    + '\nCASE STUDIES: ' + JSON.stringify((r.case_studies || []).map(function(cs) { return (cs.client||'') + ': ' + (cs.result||''); }))
    + '\n\nCOMPETITORS:\n' + (compCtx || 'No competitor data')
    + (deepDive ? '\n\nCOMPETITOR DEEP-DIVE:\n' + deepDive : '')
    + (diffCtx ? '\n\nEXISTING DIFFERENTIATOR ANALYSIS:\n' + diffCtx : '')
    + (demandCtx ? '\n\nDEMAND SIGNALS:\n' + demandCtx : '')
    + (kwCtx ? '\n\nTOP KEYWORDS: ' + kwCtx : '');

  aiBarStart('Evaluating positioning hypotheses...');
  try {
    var result = await callClaude(sys, user, null, 6000, 'Hypothesis evaluation');
    var parsed = parseEnrichResult(result);
    if (!parsed || !parsed.hypothesis_evaluations) {
      aiBarNotify('Could not parse hypothesis evaluation', { isError: true, duration: 4000 });
      return;
    }

    S.strategy.positioning = S.strategy.positioning || {};
    S.strategy.positioning.hypothesis_evaluations = parsed.hypothesis_evaluations;
    S.strategy.positioning.recommended_directions = parsed.recommended_directions || [];
    S.strategy.positioning.system_recommendation = parsed.system_recommendation || '';
    S.strategy.positioning.founder_decision_prompt = parsed.founder_decision_prompt || '';

    scheduleSave();
    renderStrategyScorecard();
    renderStrategyTabContent();
    aiBarEnd('Hypotheses evaluated — ' + parsed.hypothesis_evaluations.length + ' analysed, ' + (parsed.recommended_directions || []).length + ' directions recommended');
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('Evaluation failed: ' + e.message, { isError: true, duration: 4000 });
  }
}

function selectPositioningDirection(idx) {
  var p = S.strategy && S.strategy.positioning || {};
  var dirs = p.recommended_directions || [];
  var dir = dirs[idx];
  if (!dir) return;

  if (!confirm('Selecting this direction will regenerate Positioning Angle, Value Proposition, Messaging, and Proof Strategy when D2 next runs.\n\nDirection: ' + dir.direction + '\n\nContinue?')) return;

  S.strategy.positioning.selected_direction = {
    direction: dir.direction,
    headline: dir.headline,
    combines: dir.combines,
    provability_score: dir.provability_score,
    distinctiveness_score: dir.distinctiveness_score,
    rationale: dir.rationale,
    risk: dir.risk,
    what_changes_if_chosen: dir.what_changes_if_chosen,
    selected_at: new Date().toISOString(),
    _source: 'recommended'
  };
  // Mark stale if D2 outputs already exist (they need regeneration)
  S.strategy.positioning._direction_stale = !!(S.strategy.positioning.core_value_proposition || S.strategy.positioning.recommended_positioning_angle);

  scheduleSave();
  renderStrategyScorecard();
  renderStrategyTabContent();
  aiBarNotify('Direction selected: ' + dir.direction + ' — re-run D2 to regenerate positioning outputs', { duration: 5000 });
}

function setCustomPositioningDirection() {
  var textarea = document.getElementById('pos-custom-direction');
  if (!textarea || !textarea.value.trim()) {
    aiBarNotify('Enter a custom direction first', { duration: 2000 });
    return;
  }

  if (!confirm('Setting a custom direction will regenerate Positioning Angle, Value Proposition, Messaging, and Proof Strategy when D2 next runs.\n\nContinue?')) return;

  S.strategy.positioning = S.strategy.positioning || {};
  S.strategy.positioning.selected_direction = {
    direction: textarea.value.trim(),
    headline: '',
    combines: [],
    provability_score: null,
    distinctiveness_score: null,
    rationale: 'Custom strategist direction',
    risk: '',
    what_changes_if_chosen: '',
    selected_at: new Date().toISOString(),
    _source: 'custom'
  };
  S.strategy.positioning._direction_stale = !!(S.strategy.positioning.core_value_proposition || S.strategy.positioning.recommended_positioning_angle);

  scheduleSave();
  renderStrategyScorecard();
  renderStrategyTabContent();
  aiBarNotify('Custom direction set — re-run D2 to regenerate positioning outputs', { duration: 5000 });
}

function addPositioningHypothesis() {
  S.strategy.positioning = S.strategy.positioning || {};
  if (!S.strategy.positioning.hypotheses_input) S.strategy.positioning.hypotheses_input = [];
  if (S.strategy.positioning.hypotheses_input.length >= 4) {
    aiBarNotify('Maximum 4 hypotheses', { duration: 2000 });
    return;
  }
  S.strategy.positioning.hypotheses_input.push('');
  renderStrategyTabContent();
}

function removePositioningHypothesis(idx) {
  if (!S.strategy || !S.strategy.positioning || !S.strategy.positioning.hypotheses_input) return;
  S.strategy.positioning.hypotheses_input.splice(idx, 1);
  scheduleSave();
  renderStrategyTabContent();
}

function updatePositioningHypothesis(idx, value) {
  if (!S.strategy || !S.strategy.positioning) return;
  if (!S.strategy.positioning.hypotheses_input) S.strategy.positioning.hypotheses_input = [];
  S.strategy.positioning.hypotheses_input[idx] = value;
  scheduleSave();
}

function addPositioningAvoid() {
  S.strategy.positioning = S.strategy.positioning || {};
  if (!S.strategy.positioning.positioning_to_avoid) S.strategy.positioning.positioning_to_avoid = [];
  if (S.strategy.positioning.positioning_to_avoid.length >= 4) {
    aiBarNotify('Maximum 4 items', { duration: 2000 });
    return;
  }
  S.strategy.positioning.positioning_to_avoid.push('');
  renderStrategyTabContent();
}

function removePositioningAvoid(idx) {
  if (!S.strategy || !S.strategy.positioning || !S.strategy.positioning.positioning_to_avoid) return;
  S.strategy.positioning.positioning_to_avoid.splice(idx, 1);
  scheduleSave();
  renderStrategyTabContent();
}

function updatePositioningAvoid(idx, value) {
  if (!S.strategy || !S.strategy.positioning) return;
  if (!S.strategy.positioning.positioning_to_avoid) S.strategy.positioning.positioning_to_avoid = [];
  S.strategy.positioning.positioning_to_avoid[idx] = value;
  scheduleSave();
}

async function scanStrategyDocForHypotheses() {
  var docText = (S.setup && S.setup.strategy) || '';
  if (!docText || docText.trim().length < 50) {
    aiBarNotify('No strategy document found in Setup', { duration: 3000 });
    return;
  }

  aiBarStart('Scanning strategy document for positioning hypotheses...');
  try {
    var sys = 'Extract any positioning hypotheses, desired directions, or strategic bets from this strategy document. A hypothesis is any statement about how the client wants to be positioned, perceived, or differentiated in their market.\n\nRespond with ONLY a JSON array of strings, each being one hypothesis. If none found, respond with []. Maximum 4 hypotheses.';
    var user = docText.slice(0, 8000);
    var result = await callClaude(sys, user, null, 1000, 'Doc scan');
    var jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { aiBarEnd('No hypotheses found in document'); return; }
    var found = JSON.parse(jsonMatch[0]);
    if (!found.length) { aiBarEnd('No positioning hypotheses found in document'); return; }

    S.strategy.positioning = S.strategy.positioning || {};
    S.strategy.positioning.hypotheses_input = found.slice(0, 4);
    scheduleSave();
    renderStrategyTabContent();
    aiBarEnd('Found ' + found.length + ' positioning hypotheses in strategy document');
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('Document scan failed: ' + e.message, { isError: true, duration: 4000 });
  }
}

// ── UI: Audience Tab ───────────────────────────────────────────────────

function _renderAudience(st) {
  var a = st.audience || {};
  if (!a.segments && !a.personas && !a.buying_motions) {
    return '<div class="card" style="color:var(--n2);text-align:center"><p>No audience data yet. Generate strategy to populate.</p></div>';
  }

  var html = '';

  // Summary
  if (a.audience_summary) {
    html += '<div class="card" style="margin-bottom:16px;border-left:3px solid var(--acc)">'
      + '<div style="font-size:11px;font-weight:600;color:var(--n2);margin-bottom:6px">AUDIENCE SUMMARY</div>'
      + '<div style="font-size:13px;line-height:1.5">' + esc(a.audience_summary) + '</div>'
      + '</div>';
  }

  // Validation / Recommended Focus
  if (a.validation) {
    var v = a.validation;
    html += '<div class="card" style="margin-bottom:16px;background:#f0fdf4;border:1px solid #bbf7d0">';
    html += '<div style="font-size:11px;font-weight:600;color:#15803d;margin-bottom:8px"><i class="ti ti-target" style="font-size:12px"></i> STRATEGIC FOCUS</div>';
    if (v.primary_segment) {
      html += '<div style="font-size:13px;margin-bottom:4px"><strong>Primary segment:</strong> ' + esc(v.primary_segment) + '</div>';
      if (v.primary_rationale) html += '<div style="font-size:12px;color:var(--n2);margin-bottom:6px">' + esc(v.primary_rationale) + '</div>';
    }
    if (v.secondary_segment) {
      html += '<div style="font-size:13px;margin-bottom:4px"><strong>Secondary:</strong> ' + esc(v.secondary_segment) + '</div>';
    }
    if (v.recommended_focus) {
      html += '<div style="font-size:13px;margin-top:8px;padding-top:8px;border-top:1px solid #bbf7d0">' + esc(v.recommended_focus) + '</div>';
    }
    if (v.data_gaps && v.data_gaps.length) {
      html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #bbf7d0">';
      html += '<div style="font-size:10px;font-weight:600;color:#b45309;margin-bottom:4px">DATA GAPS</div>';
      v.data_gaps.forEach(function(g) {
        html += '<div style="font-size:11px;color:#92400e;margin-bottom:2px"><i class="ti ti-alert-circle" style="font-size:10px"></i> ' + esc(g) + '</div>';
      });
      html += '</div>';
    }
    if (v.confidence_notes) {
      html += '<div style="font-size:11px;color:var(--n2);margin-top:6px;font-style:italic">' + esc(v.confidence_notes) + '</div>';
    }
    html += '</div>';
  }

  // Segments
  if (a.segments && a.segments.length) {
    html += '<div style="font-size:12px;font-weight:600;color:var(--dark);margin-bottom:8px"><i class="ti ti-layout-grid" style="font-size:12px"></i> AUDIENCE SEGMENTS (' + a.segments.length + ')</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-bottom:20px">';
    a.segments.forEach(function(seg) {
      var revColour = seg.revenue_potential === 'high' ? '#15803d' : seg.revenue_potential === 'medium' ? '#b45309' : '#6b7280';
      var diffColour = seg.acquisition_difficulty === 'low' ? '#15803d' : seg.acquisition_difficulty === 'medium' ? '#b45309' : '#dc2626';
      html += '<div class="card" style="margin-bottom:0">';
      html += '<div style="font-size:13px;font-weight:600;color:var(--dark);margin-bottom:6px">' + esc(seg.name) + '</div>';
      if (seg.description) html += '<div style="font-size:12px;color:var(--n2);margin-bottom:8px">' + esc(seg.description) + '</div>';
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
      if (seg.estimated_size) html += '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#f3f4f6;color:#374151">Size: ' + esc(seg.estimated_size) + '</span>';
      if (seg.revenue_potential) html += '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#f0fdf4;color:' + revColour + '">Revenue: ' + esc(seg.revenue_potential) + '</span>';
      if (seg.acquisition_difficulty) html += '<span style="font-size:10px;padding:2px 6px;border-radius:3px;background:#fef2f2;color:' + diffColour + '">Difficulty: ' + esc(seg.acquisition_difficulty) + '</span>';
      html += '</div>';
      if (seg.why_they_buy) html += '<div style="font-size:11px;margin-bottom:4px"><strong>Why they buy:</strong> ' + esc(seg.why_they_buy) + '</div>';
      if (seg.why_they_hesitate) html += '<div style="font-size:11px;margin-bottom:4px"><strong>Why they hesitate:</strong> ' + esc(seg.why_they_hesitate) + '</div>';
      if (seg.best_channels && seg.best_channels.length) {
        html += '<div style="font-size:11px;margin-bottom:4px"><strong>Best channels:</strong> ' + seg.best_channels.map(function(c) { return esc(c); }).join(', ') + '</div>';
      }
      if (seg.key_messages && seg.key_messages.length) {
        html += '<div style="font-size:11px"><strong>Key messages:</strong></div>';
        seg.key_messages.forEach(function(m) {
          html += '<div style="font-size:11px;color:var(--n2);padding-left:8px">&bull; ' + esc(m) + '</div>';
        });
      }
      html += '</div>';
    });
    html += '</div>';
  }

  // Buying Motions
  if (a.buying_motions && a.buying_motions.length) {
    html += '<div style="font-size:12px;font-weight:600;color:var(--dark);margin-bottom:8px"><i class="ti ti-arrows-right-left" style="font-size:12px"></i> BUYING MOTIONS</div>';
    a.buying_motions.forEach(function(bm) {
      html += '<div class="card" style="margin-bottom:8px">';
      html += '<div style="font-size:12px;font-weight:600;color:var(--acc);margin-bottom:4px">' + esc(bm.segment) + '</div>';
      if (bm.research_behaviour) html += '<div style="font-size:11px;margin-bottom:3px"><strong>Research:</strong> ' + esc(bm.research_behaviour) + '</div>';
      if (bm.decision_process) html += '<div style="font-size:11px;margin-bottom:3px"><strong>Decision:</strong> ' + esc(bm.decision_process) + '</div>';
      if (bm.typical_timeline) html += '<div style="font-size:11px;margin-bottom:3px"><strong>Timeline:</strong> ' + esc(bm.typical_timeline) + '</div>';
      if (bm.key_touchpoints && bm.key_touchpoints.length) {
        html += '<div style="font-size:11px;margin-bottom:3px"><strong>Key touchpoints:</strong> ' + bm.key_touchpoints.map(function(t) { return esc(t); }).join(', ') + '</div>';
      }
      if (bm.content_needs && bm.content_needs.length) {
        html += '<div style="font-size:11px"><strong>Content needs:</strong> ' + bm.content_needs.map(function(c) { return esc(c); }).join('; ') + '</div>';
      }
      html += '</div>';
    });
  }

  // Personas
  if (a.personas && a.personas.length) {
    html += '<div style="font-size:12px;font-weight:600;color:var(--dark);margin:16px 0 8px"><i class="ti ti-user-circle" style="font-size:12px"></i> PERSONA PROFILES (' + a.personas.length + ')</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;margin-bottom:20px">';
    a.personas.forEach(function(p) {
      html += '<div class="card" style="margin-bottom:0">';
      html += '<div style="font-size:13px;font-weight:600;color:var(--dark);margin-bottom:2px">' + esc(p.name) + '</div>';
      if (p.role) html += '<div style="font-size:11px;color:var(--acc);margin-bottom:2px">' + esc(p.role) + '</div>';
      if (p.segment) html += '<div style="font-size:10px;color:var(--n2);margin-bottom:6px">Segment: ' + esc(p.segment) + '</div>';
      if (p.demographics) html += '<div style="font-size:11px;margin-bottom:4px"><strong>Demo:</strong> ' + esc(p.demographics) + '</div>';
      if (p.goals && p.goals.length) {
        html += '<div style="font-size:11px;margin-bottom:4px"><strong>Goals:</strong> ' + p.goals.map(function(g) { return esc(g); }).join('; ') + '</div>';
      }
      if (p.frustrations && p.frustrations.length) {
        html += '<div style="font-size:11px;margin-bottom:4px"><strong>Frustrations:</strong> ' + p.frustrations.map(function(f) { return esc(f); }).join('; ') + '</div>';
      }
      if (p.decision_criteria && p.decision_criteria.length) {
        html += '<div style="font-size:11px;margin-bottom:4px"><strong>Decision criteria:</strong> ' + p.decision_criteria.map(function(d) { return esc(d); }).join('; ') + '</div>';
      }
      if (p.preferred_channels && p.preferred_channels.length) {
        html += '<div style="font-size:11px;margin-bottom:4px"><strong>Channels:</strong> ' + p.preferred_channels.map(function(c) { return esc(c); }).join(', ') + '</div>';
      }
      if (p.language_patterns && p.language_patterns.length) {
        html += '<div style="font-size:11px;margin-bottom:4px"><strong>Language:</strong></div>';
        p.language_patterns.forEach(function(lp) {
          html += '<div style="font-size:11px;color:var(--n2);padding-left:8px;font-style:italic">"' + esc(lp) + '"</div>';
        });
      }
      if (p.objection_profile && p.objection_profile.length) {
        html += '<div style="font-size:11px;margin-top:4px"><strong>Objections:</strong></div>';
        p.objection_profile.forEach(function(o) {
          html += '<div style="font-size:11px;color:#b45309;padding-left:8px">&bull; ' + esc(o) + '</div>';
        });
      }
      // Execution Profile (Layer 2 enrichment)
      var ep = p.executionProfile;
      if (ep && ep._enrichedAt) {
        html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">';
        html += '<span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--green)">Customer Voice</span>';
        html += '<span style="font-size:9px;background:var(--green);color:white;padding:1px 5px;border-radius:3px">Enriched</span>';
        html += '</div>';
        if (ep.painLanguage && ep.painLanguage.length) {
          html += '<div style="font-size:11px;margin-bottom:4px"><strong>They say:</strong></div>';
          ep.painLanguage.slice(0,3).forEach(function(pl) {
            html += '<div style="font-size:11px;color:var(--dark);padding-left:8px;font-style:italic;margin-bottom:2px">"' + esc(pl.phrase) + '" <span style="font-size:9px;color:var(--n2)">(' + esc(pl.pain) + ')</span></div>';
          });
          if (ep.painLanguage.length > 3) html += '<div style="font-size:10px;color:var(--n2);padding-left:8px">+' + (ep.painLanguage.length - 3) + ' more</div>';
        }
        if (ep.emotionalDrivers && ep.emotionalDrivers.length) {
          html += '<div style="font-size:11px;margin-top:4px"><strong>They feel:</strong></div>';
          ep.emotionalDrivers.slice(0,2).forEach(function(e) {
            html += '<div style="font-size:11px;padding-left:8px;margin-bottom:2px"><span style="color:var(--dark)">' + esc(e.pain) + ':</span> <span style="color:var(--n2)">' + esc(e.beneath) + '</span></div>';
          });
        }
        if (ep.competitorVoice && ep.competitorVoice.messagingGap) {
          html += '<div style="font-size:11px;margin-top:4px;padding:4px 8px;background:var(--lime);border-radius:4px"><strong>Messaging gap:</strong> ' + esc(ep.competitorVoice.messagingGap) + '</div>';
        }
        html += '</div>';
      } else {
        html += '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">';
        html += '<div style="font-size:10px;color:var(--n2);font-style:italic">Customer Voice not enriched yet</div>';
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    // Enrich Customer Voice button
    var anyUnenriched = a.personas.some(function(p) { return !p.executionProfile || !p.executionProfile._enrichedAt; });
    if (anyUnenriched) {
      html += '<div style="margin-bottom:16px"><button class="btn btn-primary sm" onclick="enrichCustomerVoice()"><i class="ti ti-sparkles"></i> Enrich Customer Voice</button>';
      html += '<span style="font-size:11px;color:var(--n2);margin-left:8px">Analyses search data, reviews, and competitor messaging to build execution profiles for each persona</span></div>';
    }
  }

  // Purchase Triggers
  if (a.purchase_triggers && a.purchase_triggers.length) {
    html += '<div style="font-size:12px;font-weight:600;color:var(--dark);margin-bottom:8px"><i class="ti ti-bolt" style="font-size:12px"></i> PURCHASE TRIGGERS</div>';
    html += '<div class="card" style="margin-bottom:16px"><table style="width:100%;font-size:11px;border-collapse:collapse">';
    html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 8px;font-weight:600">Trigger</th><th style="text-align:left;padding:4px 8px;font-weight:600">Segments</th><th style="text-align:left;padding:4px 8px;font-weight:600">Urgency</th><th style="text-align:left;padding:4px 8px;font-weight:600">Messaging Angle</th></tr>';
    a.purchase_triggers.forEach(function(t) {
      var urgColour = t.urgency_level === 'high' ? '#dc2626' : t.urgency_level === 'medium' ? '#b45309' : '#6b7280';
      html += '<tr style="border-bottom:1px solid var(--border)">';
      html += '<td style="padding:4px 8px;font-weight:500">' + esc(t.trigger) + '</td>';
      html += '<td style="padding:4px 8px">' + (t.segments_affected ? t.segments_affected.map(function(s) { return esc(s); }).join(', ') : '') + '</td>';
      html += '<td style="padding:4px 8px;color:' + urgColour + '">' + esc(t.urgency_level || '') + '</td>';
      html += '<td style="padding:4px 8px">' + esc(t.messaging_angle || '') + '</td>';
      html += '</tr>';
    });
    html += '</table></div>';
  }

  // Objection Map
  if (a.objection_map && a.objection_map.length) {
    html += '<div style="font-size:12px;font-weight:600;color:var(--dark);margin-bottom:8px"><i class="ti ti-shield" style="font-size:12px"></i> OBJECTION MAP</div>';
    a.objection_map.forEach(function(obj) {
      var freqColour = obj.frequency === 'universal' ? '#dc2626' : obj.frequency === 'common' ? '#b45309' : '#6b7280';
      html += '<div class="card" style="margin-bottom:6px;padding:8px 12px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      html += '<span style="font-size:12px;font-weight:600">' + esc(obj.objection) + '</span>';
      if (obj.frequency) html += '<span style="font-size:10px;color:' + freqColour + ';padding:1px 6px;border-radius:3px;background:#f9fafb">' + esc(obj.frequency) + '</span>';
      html += '</div>';
      if (obj.segments && obj.segments.length) html += '<div style="font-size:11px;color:var(--n2);margin-bottom:2px">Segments: ' + obj.segments.map(function(s) { return esc(s); }).join(', ') + '</div>';
      if (obj.counter_message) html += '<div style="font-size:11px;margin-bottom:2px"><strong>Counter:</strong> ' + esc(obj.counter_message) + '</div>';
      if (obj.proof_needed) html += '<div style="font-size:11px;color:var(--n2)"><strong>Proof:</strong> ' + esc(obj.proof_needed) + '</div>';
      html += '</div>';
    });
  }

  // Perceived Alternatives
  if (a.perceived_alternatives && a.perceived_alternatives.length) {
    html += '<div style="font-size:12px;font-weight:600;color:var(--dark);margin:16px 0 8px"><i class="ti ti-arrows-split" style="font-size:12px"></i> PERCEIVED ALTERNATIVES</div>';
    html += '<div class="card" style="margin-bottom:16px"><table style="width:100%;font-size:11px;border-collapse:collapse">';
    html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 8px;font-weight:600">Alternative</th><th style="text-align:left;padding:4px 8px;font-weight:600">Why Considered</th><th style="text-align:left;padding:4px 8px;font-weight:600">Failure Mode</th><th style="text-align:left;padding:4px 8px;font-weight:600">Threat</th><th style="text-align:left;padding:4px 8px;font-weight:600">Counter-Positioning</th></tr>';
    a.perceived_alternatives.forEach(function(alt) {
      var threatColour = alt.threat_level === 'high' ? '#dc2626' : alt.threat_level === 'medium' ? '#b45309' : '#6b7280';
      html += '<tr style="border-bottom:1px solid var(--border)">';
      html += '<td style="padding:4px 8px;font-weight:500">' + esc(alt.alternative || '') + '</td>';
      html += '<td style="padding:4px 8px">' + esc(alt.why_considered || '') + '</td>';
      html += '<td style="padding:4px 8px">' + esc(alt.failure_mode || '') + '</td>';
      html += '<td style="padding:4px 8px"><span style="font-size:10px;color:' + threatColour + ';padding:1px 6px;border-radius:3px;background:#f9fafb">' + esc(alt.threat_level || '') + '</span></td>';
      html += '<td style="padding:4px 8px">' + esc(alt.counter_positioning || '') + '</td>';
      html += '</tr>';
    });
    html += '</table></div>';
  }

  // Parked Segments
  if (a.parked_segments && a.parked_segments.length) {
    html += '<div style="font-size:12px;font-weight:600;color:var(--n2);margin:16px 0 8px"><i class="ti ti-clock-pause" style="font-size:12px"></i> PARKED SEGMENTS (deprioritised)</div>';
    a.parked_segments.forEach(function(ps) {
      html += '<div class="card" style="margin-bottom:6px;padding:8px 12px;background:#f9fafb;border:1px dashed var(--border)">';
      html += '<div style="font-size:12px;font-weight:600;color:var(--n2)">' + esc(ps.name) + (ps.vertical ? ' <span style="font-size:10px;color:var(--mid)">(' + esc(ps.vertical) + ')</span>' : '') + '</div>';
      if (ps.rationale) html += '<div style="font-size:11px;color:var(--n2);margin-top:3px"><strong>Rationale:</strong> ' + esc(ps.rationale) + '</div>';
      if (ps.revisit_trigger) html += '<div style="font-size:11px;color:var(--n2)"><strong>Revisit when:</strong> ' + esc(ps.revisit_trigger) + '</div>';
      if (ps.phase) html += '<div style="font-size:10px;color:var(--acc);margin-top:3px">' + esc(ps.phase) + '</div>';
      html += '</div>';
    });
  }

  // Vertical Coverage Warnings
  if (a.vertical_coverage_check && a.vertical_coverage_check.length) {
    html += '<div style="margin-top:12px">';
    a.vertical_coverage_check.forEach(function(w) {
      html += '<div style="font-size:11px;color:#b45309;padding:4px 8px;background:#fef3c7;border-radius:4px;margin-bottom:4px;border:1px solid #fde68a">'
        + '<i class="ti ti-alert-triangle" style="font-size:11px"></i> ' + esc(w) + '</div>';
    });
    html += '</div>';
  }

  return html;
}

function _renderPositioning(st) {
  var p = st.positioning || {};
  if (!p.core_value_proposition && !p.recommended_positioning_angle && !p.hypotheses_input && !p.hypothesis_evaluations) {
    return '<div class="card" style="color:var(--n2);text-align:center"><p>No positioning data yet. Generate strategy to populate.</p></div>';
  }
  var html = '';

  // ── Positioning Direction section (top of tab) ──
  html += '<div class="card" data-sai-explain="positioning:direction" style="margin-bottom:18px;padding:16px 18px;border-left:3px solid #6b21a8">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
  html += '<div style="font-size:13px;font-weight:600;color:#6b21a8"><i class="ti ti-compass" style="margin-right:4px"></i> Positioning Direction</div>';
  if (p.selected_direction) {
    html += '<span style="background:rgba(21,142,29,0.08);color:var(--green);font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid rgba(21,142,29,0.2);font-weight:500"><i class="ti ti-check" style="font-size:10px"></i> Active</span>';
  }
  html += '</div>';

  // Show selected direction banner if exists
  if (p.selected_direction) {
    var sd = p.selected_direction;
    html += '<div style="background:rgba(21,142,29,0.04);border:1px solid rgba(21,142,29,0.2);border-radius:8px;padding:12px 14px;margin-bottom:14px">';
    html += '<div style="font-size:12px;font-weight:600;color:var(--dark)">' + esc(sd.direction) + '</div>';
    if (sd.headline) html += '<div style="font-size:12px;color:var(--n3);margin-top:2px;font-style:italic">"' + esc(sd.headline) + '"</div>';
    if (sd.provability_score) html += '<div style="font-size:10px;color:var(--n2);margin-top:4px">Provability: ' + sd.provability_score + '/10 | Distinctiveness: ' + (sd.distinctiveness_score || '?') + '/10</div>';
    if (p._direction_stale) html += '<div style="font-size:10px;color:var(--warn);margin-top:4px"><i class="ti ti-alert-triangle" style="font-size:10px"></i> Direction changed — re-run D2 to align downstream outputs</div>';
    html += '</div>';
  }

  // Hypothesis input fields
  html += '<div style="font-size:11px;color:var(--n2);margin-bottom:8px">Enter the founder hypotheses about desired positioning — how does the client want to be perceived?</div>';
  var hypotheses = p.hypotheses_input || [];
  if (!hypotheses.length) hypotheses = [''];
  hypotheses.forEach(function(h, i) {
    html += '<div style="display:flex;gap:6px;align-items:start;margin-bottom:6px">';
    html += '<span style="font-size:11px;color:var(--n2);padding-top:6px;min-width:18px">' + (i + 1) + '.</span>';
    html += '<textarea id="pos-hyp-' + i + '" onblur="updatePositioningHypothesis(' + i + ',this.value)" style="flex:1;font-size:12px;color:var(--dark);background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-family:var(--font);resize:vertical;min-height:36px;line-height:1.4;outline:none" placeholder="e.g. We want to be the AI + Human agency...">' + esc(h) + '</textarea>';
    if (hypotheses.length > 1) {
      html += '<button onclick="removePositioningHypothesis(' + i + ')" style="background:transparent;border:1px solid rgba(220,50,47,0.2);border-radius:4px;padding:4px 6px;cursor:pointer;color:var(--error);font-size:11px;opacity:0.5;margin-top:2px" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.5\'">✕</button>';
    }
    html += '</div>';
  });

  // Positioning to avoid
  html += '<div style="margin-top:12px;margin-bottom:8px">';
  html += '<div style="font-size:11px;color:var(--error);margin-bottom:6px;font-weight:500"><i class="ti ti-ban" style="font-size:11px;margin-right:2px"></i> Positioning to Avoid</div>';
  html += '<div style="font-size:10px;color:var(--n2);margin-bottom:6px">What the founder explicitly does NOT want to be associated with or perceived as.</div>';
  var avoidItems = p.positioning_to_avoid || [];
  if (!avoidItems.length) avoidItems = [''];
  avoidItems.forEach(function(a, i) {
    html += '<div style="display:flex;gap:6px;align-items:start;margin-bottom:4px">';
    html += '<span style="font-size:11px;color:var(--error);padding-top:6px;min-width:14px">✕</span>';
    html += '<input id="pos-avoid-' + i + '" value="' + esc(a) + '" onblur="updatePositioningAvoid(' + i + ',this.value)" style="flex:1;font-size:12px;color:var(--dark);background:rgba(220,50,47,0.03);border:1px solid rgba(220,50,47,0.15);border-radius:6px;padding:5px 10px;font-family:var(--font);outline:none" placeholder="e.g. Do not position us as a cheap option..."/>';
    if (avoidItems.length > 1) {
      html += '<button onclick="removePositioningAvoid(' + i + ')" style="background:transparent;border:1px solid rgba(220,50,47,0.2);border-radius:4px;padding:3px 6px;cursor:pointer;color:var(--error);font-size:10px;opacity:0.4" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.4\'">✕</button>';
    }
    html += '</div>';
  });
  if (avoidItems.length < 4) {
    html += '<button onclick="addPositioningAvoid()" style="background:transparent;border:none;cursor:pointer;font-size:10px;color:var(--n2);padding:2px 0;font-family:var(--font)">+ Add another</button>';
  }
  html += '</div>';

  html += '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">';
  if (hypotheses.length < 4) {
    html += '<button class="btn btn-ghost sm" onclick="addPositioningHypothesis()" style="font-size:11px"><i class="ti ti-plus"></i> Add Hypothesis</button>';
  }
  html += '<button class="btn btn-primary sm" onclick="evaluateHypotheses()" style="font-size:11px" data-tip="AI stress-tests each hypothesis against competitor data, differentiators, and market demand. Produces scored evaluations and recommended directions."><i class="ti ti-sparkles"></i> Evaluate Hypotheses</button>';
  var hasStratDoc = S.setup && S.setup.strategy && S.setup.strategy.trim().length > 50;
  if (hasStratDoc && !p.hypotheses_input) {
    html += '<button class="btn btn-ghost sm" onclick="scanStrategyDocForHypotheses()" style="font-size:11px" data-tip="Scans the strategy document uploaded in Setup for positioning hypotheses and pre-populates them"><i class="ti ti-file-search"></i> Scan Strategy Doc</button>';
  }
  html += '</div>';

  // ── Hypothesis evaluation cards ──
  if (p.hypothesis_evaluations && p.hypothesis_evaluations.length) {
    html += '<div style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px">';
    html += '<div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Hypothesis Evaluations</div>';

    p.hypothesis_evaluations.forEach(function(ev) {
      var verdictColour = ev.verdict === 'viable' ? 'var(--green)' : ev.verdict === 'partially_viable' ? 'var(--warn)' : 'var(--error)';
      var verdictBg = ev.verdict === 'viable' ? 'rgba(21,142,29,0.06)' : ev.verdict === 'partially_viable' ? 'rgba(245,166,35,0.06)' : 'rgba(220,50,47,0.06)';

      html += '<div style="background:' + verdictBg + ';border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:14px;margin-bottom:10px">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
      html += '<span style="font-size:12px;font-weight:600;color:var(--dark)">' + esc(ev.hypothesis) + '</span>';
      html += '<span style="background:' + verdictBg + ';color:' + verdictColour + ';font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid;font-weight:500">' + esc(ev.verdict_label || ev.verdict) + '</span>';
      html += '</div>';

      // Score bars
      if (ev.scores) {
        var scoreFields = [
          { key:'provability', label:'Provability', colour:'#3b82f6' },
          { key:'distinctiveness', label:'Distinctiveness', colour:'#6b21a8' },
          { key:'market_demand', label:'Market Demand', colour:'var(--green)' },
          { key:'risk', label:'Risk (lower = better)', colour:'var(--error)' }
        ];
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-bottom:10px">';
        scoreFields.forEach(function(sf) {
          var val = ev.scores[sf.key] || 0;
          var pct = val * 10;
          html += '<div>';
          html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--n2);margin-bottom:2px"><span>' + sf.label + '</span><span style="font-weight:500;color:var(--dark)">' + val + '/10</span></div>';
          html += '<div style="background:rgba(0,0,0,0.06);border-radius:2px;height:4px"><div style="background:' + sf.colour + ';height:4px;border-radius:2px;width:' + pct + '%;transition:width 0.3s"></div></div>';
          html += '</div>';
        });
        html += '</div>';
      }

      // Evidence for/against (collapsible via details)
      if ((ev.evidence_for && ev.evidence_for.length) || (ev.evidence_against && ev.evidence_against.length)) {
        html += '<details style="margin-bottom:6px"><summary style="font-size:11px;color:var(--n2);cursor:pointer;margin-bottom:4px">Evidence</summary>';
        if (ev.evidence_for && ev.evidence_for.length) {
          html += '<div style="font-size:11px;margin-bottom:4px"><span style="color:var(--green);font-weight:500">For:</span>';
          html += '<ul style="margin:2px 0 0;padding-left:16px">' + ev.evidence_for.map(function(e) { return '<li style="margin-bottom:2px">' + esc(e) + '</li>'; }).join('') + '</ul></div>';
        }
        if (ev.evidence_against && ev.evidence_against.length) {
          html += '<div style="font-size:11px"><span style="color:var(--error);font-weight:500">Against:</span>';
          html += '<ul style="margin:2px 0 0;padding-left:16px">' + ev.evidence_against.map(function(e) { return '<li style="margin-bottom:2px">' + esc(e) + '</li>'; }).join('') + '</ul></div>';
        }
        html += '</details>';
      }

      // Reframing
      if (ev.reframing && ev.verdict !== 'viable') {
        html += '<div style="background:rgba(59,130,246,0.06);border-left:2px solid #3b82f6;padding:6px 10px;font-size:11px;color:var(--dark);margin-bottom:6px;border-radius:0 4px 4px 0"><strong>Reframing:</strong> ' + esc(ev.reframing) + '</div>';
      }

      // Proof requirements
      if (ev.proof_requirements && ev.proof_requirements.length) {
        html += '<details><summary style="font-size:11px;color:var(--n2);cursor:pointer">Proof Requirements (' + ev.proof_requirements.length + ')</summary>';
        html += '<ul style="margin:4px 0 0;padding-left:16px;font-size:11px">' + ev.proof_requirements.map(function(pr) { return '<li style="margin-bottom:2px">' + esc(pr) + '</li>'; }).join('') + '</ul>';
        html += '</details>';
      }
      html += '</div>';
    });
    html += '</div>';
  }

  // ── Recommended Directions ──
  if (p.recommended_directions && p.recommended_directions.length) {
    html += '<div style="margin-top:18px;border-top:1px solid var(--border);padding-top:14px">';
    html += '<div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Recommended Directions</div>';
    if (p.founder_decision_prompt) {
      html += '<div style="font-size:12px;color:#6b21a8;margin-bottom:10px;font-style:italic;background:rgba(107,33,168,0.04);border:1px solid rgba(107,33,168,0.15);border-radius:6px;padding:8px 12px">' + esc(p.founder_decision_prompt) + '</div>';
    }
    if (p.system_recommendation) {
      html += '<div style="font-size:11px;color:var(--n3);margin-bottom:10px"><strong>System:</strong> ' + esc(p.system_recommendation) + '</div>';
    }

    p.recommended_directions.forEach(function(dir, i) {
      var isSelected = p.selected_direction && p.selected_direction.direction === dir.direction && p.selected_direction._source === 'recommended';
      var isSysRec = p.system_recommendation && p.system_recommendation.toLowerCase().indexOf(dir.direction.toLowerCase()) >= 0;

      html += '<div style="background:' + (isSelected ? 'rgba(21,142,29,0.04)' : 'var(--panel)') + ';border:1px solid ' + (isSelected ? 'rgba(21,142,29,0.3)' : 'var(--border)') + ';border-radius:8px;padding:14px;margin-bottom:10px">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px">';
      html += '<div style="font-size:13px;font-weight:600;color:var(--dark)">' + esc(dir.direction) + '</div>';
      html += '<div style="display:flex;gap:4px;align-items:center;flex-shrink:0">';
      if (isSysRec) html += '<span style="background:rgba(107,33,168,0.08);color:#6b21a8;font-size:9px;padding:2px 6px;border-radius:3px;border:1px solid rgba(107,33,168,0.2);font-weight:500">RECOMMENDED</span>';
      if (isSelected) {
        html += '<span style="background:rgba(21,142,29,0.08);color:var(--green);font-size:9px;padding:2px 6px;border-radius:3px;border:1px solid rgba(21,142,29,0.2);font-weight:500">ACTIVE</span>';
      } else {
        html += '<button class="btn btn-ghost sm" onclick="selectPositioningDirection(' + i + ')" style="font-size:10px;padding:2px 8px"><i class="ti ti-check"></i> Select</button>';
      }
      html += '</div></div>';

      if (dir.headline) html += '<div style="font-size:12px;color:var(--n3);font-style:italic;margin-bottom:6px">"' + esc(dir.headline) + '"</div>';
      if (dir.combines && dir.combines.length) html += '<div style="font-size:10px;color:var(--n2);margin-bottom:4px">Combines: ' + dir.combines.map(function(c) { return esc(c); }).join(', ') + '</div>';

      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:6px">';
      if (dir.provability_score) html += '<div style="font-size:10px;color:var(--n2)">Provability: <strong style="color:var(--dark)">' + dir.provability_score + '/10</strong></div>';
      if (dir.distinctiveness_score) html += '<div style="font-size:10px;color:var(--n2)">Distinctiveness: <strong style="color:var(--dark)">' + dir.distinctiveness_score + '/10</strong></div>';
      html += '</div>';

      if (dir.rationale) html += '<div style="font-size:11px;color:var(--n3);margin-bottom:4px">' + esc(dir.rationale) + '</div>';
      if (dir.risk) {
        html += '<details><summary style="font-size:10px;color:var(--n2);cursor:pointer">Risk & Impact</summary>';
        html += '<div style="font-size:11px;color:var(--error);margin-top:4px"><strong>Risk:</strong> ' + esc(dir.risk) + '</div>';
        if (dir.what_changes_if_chosen) html += '<div style="font-size:11px;color:var(--n3);margin-top:4px"><strong>If chosen:</strong> ' + esc(dir.what_changes_if_chosen) + '</div>';
        html += '</details>';
      }
      html += '</div>';
    });

    // Custom direction option
    html += '<div style="margin-top:10px">';
    html += '<div style="font-size:11px;color:var(--n2);margin-bottom:4px">Or write a custom direction:</div>';
    html += '<div style="display:flex;gap:6px;align-items:start">';
    html += '<textarea id="pos-custom-direction" style="flex:1;font-size:12px;color:var(--dark);background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-family:var(--font);resize:vertical;min-height:36px;line-height:1.4;outline:none" placeholder="None of these — I want to position as...">' + (p.selected_direction && p.selected_direction._source === 'custom' ? esc(p.selected_direction.direction) : '') + '</textarea>';
    html += '<button class="btn btn-ghost sm" onclick="setCustomPositioningDirection()" style="font-size:11px;margin-top:4px"><i class="ti ti-check"></i> Set</button>';
    html += '</div></div>';

    html += '</div>';
  }

  html += '</div>'; // end Positioning Direction card

  // Stale indicator if direction changed after D2 ran
  if (p.selected_direction && p._direction_stale) {
    html += '<div style="background:rgba(245,166,35,0.06);border:1px solid rgba(245,166,35,0.2);border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:11px;color:var(--warn)"><i class="ti ti-alert-triangle" style="font-size:12px"></i> Positioning outputs below are stale — re-run D2: Competitive Position to align with the selected direction.</div>';
  }

  // ── Existing positioning outputs ──
  if (!p.core_value_proposition && !p.recommended_positioning_angle) {
    if (p.market_position || p.validated_differentiators) {
      // D2 ran but without direction — show competitive analysis but flag messaging as pending
      html += '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#1e40af">'
        + '<i class="ti ti-info-circle" style="font-size:13px"></i> <strong>Select a positioning direction above</strong> to generate messaging hierarchy, value proposition, brand voice, and proof strategy. '
        + 'Competitive analysis is shown below — messaging outputs require a direction.</div>';
    } else {
      return html; // no D2 output at all
    }
  }
  if (p.direction_required && !p.selected_direction) {
    // D2 explicitly flagged that direction is needed
    html += '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:11px;color:#92400e">'
      + '<i class="ti ti-lock" style="font-size:12px"></i> Messaging, value proposition, and proof strategy are placeholders. Select a positioning direction above, then re-run D2 to generate finalised outputs.</div>';
  }

  // ── Category Perception Gap card ──
  if (p.category_perception && p.category_perception.buyer_frame) {
    var _cp = p.category_perception;
    var _cpSev = _cp.gap_severity || 'none';
    var _cpBorder = _cpSev === 'fundamental' ? '#dc2626' : _cpSev === 'significant' ? '#f59e0b' : _cpSev === 'mild' ? '#9ca3af' : '#16a34a';
    var _cpBadgeBg = _cpSev === 'fundamental' ? 'rgba(220,38,38,0.08)' : _cpSev === 'significant' ? 'rgba(245,158,11,0.08)' : _cpSev === 'mild' ? 'rgba(156,163,175,0.08)' : 'rgba(22,163,74,0.08)';
    var _cpBadgeCol = _cpSev === 'fundamental' ? '#dc2626' : _cpSev === 'significant' ? '#f59e0b' : _cpSev === 'mild' ? '#6b7280' : '#16a34a';
    html += '<div class="card" style="margin-bottom:18px;padding:16px 18px;border-left:3px solid ' + _cpBorder + '">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    html += '<div style="font-size:12px;font-weight:600;color:var(--dark);text-transform:uppercase;letter-spacing:.06em">Category Perception Gap</div>';
    html += '<span style="background:' + _cpBadgeBg + ';color:' + _cpBadgeCol + ';font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid;font-weight:500">' + esc(_cpSev) + '</span>';
    html += '</div>';
    // Two-column: buyer sees → we actually sell
    html += '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:centre;margin-bottom:12px">';
    html += '<div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 14px">';
    html += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Buyer sees</div>';
    html += '<div style="font-size:12px;color:var(--dark);font-weight:500">' + esc(_cp.buyer_frame) + '</div>';
    html += '</div>';
    html += '<div style="font-size:18px;color:var(--n2);padding-top:12px">\u2192</div>';
    html += '<div style="background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 14px">';
    html += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">We actually sell</div>';
    html += '<div style="font-size:12px;color:var(--dark);font-weight:500">' + esc(_cp.actual_frame) + '</div>';
    html += '</div>';
    html += '</div>';
    // Gap description
    if (_cp.perception_gap) {
      html += '<div style="font-size:12px;color:var(--n3);margin-bottom:10px">' + esc(_cp.perception_gap) + '</div>';
    }
    // Reframing language
    if (_cp.reframing_language) {
      html += '<div style="background:rgba(59,130,246,0.06);border-left:2px solid #3b82f6;padding:8px 12px;font-size:12px;color:var(--dark);margin-bottom:10px;border-radius:0 6px 6px 0">';
      html += '<div style="font-size:10px;color:#3b82f6;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Reframing Language</div>';
      html += esc(_cp.reframing_language);
      html += '</div>';
    }
    // Trigger pages as chips
    if (_cp.reframing_trigger_pages && _cp.reframing_trigger_pages.length) {
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
      _cp.reframing_trigger_pages.forEach(function(pg) {
        html += '<span style="background:rgba(107,33,168,0.06);color:#6b21a8;font-size:10px;padding:2px 8px;border-radius:4px;border:1px solid rgba(107,33,168,0.15)">' + esc(pg) + '</span>';
      });
      html += '</div>';
    }
    html += '</div>';
  }

  html += _stratSection('Positioning',
    _stratField('Positioning Angle', p.recommended_positioning_angle, {span:true}) +
    _stratField('Core Value Proposition', p.core_value_proposition, {span:true, textarea:true}) +
    _stratField('Recommended Tagline', p.recommended_tagline) +
    _stratField('Competitive Counter', p.competitive_counter, {textarea:true})
  );
  if (p.validated_differentiators && p.validated_differentiators.length) {
    html += _stratSection('Validated Differentiators', _stratField('Validated', p.validated_differentiators, {span:true}));
  }
  // Contested differentiators — competitive intensity analysis (new format)
  if (p.contested_differentiators && p.contested_differentiators.length) {
    var intensityColors = { weakly_contested: '#e6a700', strongly_contested: '#f56c6c', category_owned: '#999' };
    var intensityLabels = { weakly_contested: 'Weakly Contested', strongly_contested: 'Strongly Contested', category_owned: 'Category Owned' };
    var intensityIcons = { weakly_contested: 'ti-alert-triangle', strongly_contested: 'ti-shield-x', category_owned: 'ti-lock' };
    html += _stratSection('Competitive Intensity Analysis',
      '<div style="grid-column:1/-1">' + p.contested_differentiators.map(function(cd) {
        var color = intensityColors[cd.intensity] || '#999';
        var label = intensityLabels[cd.intensity] || cd.intensity;
        var icon = intensityIcons[cd.intensity] || 'ti-alert-circle';
        var claimable = cd.claimable !== false;
        return '<div style="margin-bottom:12px;padding:10px 14px;border-radius:8px;border:1px solid ' + color + '33;background:' + color + '08">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
          + '<i class="ti ' + icon + '" style="font-size:14px;color:' + color + '"></i>'
          + '<strong style="font-size:13px">' + esc(cd.claim) + '</strong>'
          + '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:' + color + '20;color:' + color + ';font-weight:600">' + label + '</span>'
          + (claimable ? '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#22c55e20;color:#22c55e;font-weight:600">Claimable with proof</span>' : '')
          + '</div>'
          + '<div style="font-size:11px;color:var(--n1);margin-bottom:4px"><strong>Competitor:</strong> ' + esc(cd.competitor || '') + '</div>'
          + '<div style="font-size:11px;color:var(--n2);margin-bottom:4px"><strong>Their depth:</strong> ' + esc(cd.competitor_depth || '') + '</div>'
          + (cd.proof_needed ? '<div style="font-size:11px;color:var(--accent);margin-top:4px"><strong>Proof needed to claim:</strong> ' + esc(cd.proof_needed) + '</div>' : '')
          + '</div>';
      }).join('') + '</div>'
    );
  }
  // Backwards compatibility: still render old rejected_differentiators if present (from previous runs)
  if (p.rejected_differentiators && p.rejected_differentiators.length && !(p.contested_differentiators && p.contested_differentiators.length)) {
    html += _stratSection('Rejected Differentiators',
      '<div style="grid-column:1/-1">' + p.rejected_differentiators.map(function(rd) {
        return '<div style="font-size:12px;margin-bottom:4px"><span style="text-decoration:line-through;color:#f56c6c">' + esc(rd.claim) + '</span> \u2014 ' + esc(rd.reason) + '</div>';
      }).join('') + '</div>'
    );
  }
  if (p.messaging_hierarchy) {
    var mh = p.messaging_hierarchy;
    html += _stratSection('Messaging Hierarchy',
      _stratField('Primary Message', mh.primary_message, {span:true}) +
      _stratField('Supporting Messages', mh.supporting_messages) +
      _stratField('Proof Points', mh.proof_points)
    );
  }
  if (p.brand_voice_direction) {
    var bv = p.brand_voice_direction;
    html += _stratSection('Brand Voice Direction',
      _stratField('Style', bv.style) +
      _stratField('Tone', bv.tone_detail) +
      _stratField('Words to Use', bv.words_to_use) +
      _stratField('Words to Avoid', bv.words_to_avoid) +
      _stratField('Rationale', bv.voice_rationale, {span:true})
    );
  }
  if (p.proof_strategy && p.proof_strategy.length) {
    html += _stratSection('Proof Strategy', _stratField('Build this proof', p.proof_strategy, {span:true}));
  }
  return html;
}

function _renderEconomics(st) {
  var ue = st.unit_economics || {};
  if (!ue.max_allowable_cpl && !ue.recommendation) {
    return '<div class="card" style="color:var(--n2);text-align:center"><p>No economics data yet. Generate strategy to populate.</p></div>';
  }
  var html = '';
  // Pricing source indicator
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
    + _renderPricingIndicator() + '</div>';
  // Build formula tooltips — use COMPUTED output values (not research inputs that Claude may have overridden)
  var _mktCpl = ue.estimated_market_cpl || '?';
  var _maxCpl = ue.max_allowable_cpl || '?';
  var _budgetLeads = ue.budget_supports_leads || '?';
  var _cpqlVal = ue.cpql || '?';
  var _cacVal = ue.estimated_cac || '?';
  var _ltvVal = ue.ltv || '?';
  // Reverse-engineer the lead quality % Claude used: CPQL = Market CPL / quality_rate → quality_rate = Market CPL / CPQL
  var _inferredQuality = (ue.estimated_market_cpl && ue.cpql && ue.cpql > 0) ? Math.round((ue.estimated_market_cpl / ue.cpql) * 100) + '%' : '?';
  // Reverse-engineer close rate Claude used: CAC = CPQL / close_rate → close_rate = CPQL / CAC
  var _inferredCloseRate = (ue.cpql && ue.estimated_cac && ue.estimated_cac > 0) ? Math.round((ue.cpql / ue.estimated_cac) * 100) + '%' : '?';

  html += _stratSection('Unit Economics',
    _stratField('Max Allowable CPL', ue.max_allowable_cpl ? '$' + ue.max_allowable_cpl : '', {
      tip: 'The most you can pay per lead and stay profitable. Derived from deal size, close rate, and customer lifetime value. If Max CPL ($' + _maxCpl + ') > Market CPL ($' + _mktCpl + '), paid acquisition is viable'
    }) +
    _stratField('Estimated Market CPL', ue.estimated_market_cpl ? '$' + ue.estimated_market_cpl : '', {
      tip: 'What a lead actually costs in this market. Calculated from keyword CPC data, landing page conversion rates, and industry benchmarks. See Market CPC Intelligence section below for the source data'
    }) +
    _stratField('Budget Supports (leads/mo)', ue.budget_supports_leads, {
      tip: 'How many leads the budget can generate. Formula: Monthly Marketing Budget / Market CPL ($' + _mktCpl + ') = ' + _budgetLeads + ' leads/mo'
    }) +
    _stratField('Client Target Leads', ue.client_target_leads, {
      tip: 'Leads needed per month to hit the client revenue goal. Derived from: Revenue Target / (Avg Deal Size x Close Rate)'
    }) +
    _stratField('Gap', ue.gap, {span:true, tip: 'Compares budget capacity (' + _budgetLeads + ' leads) vs target leads (' + (ue.client_target_leads || '?') + '). Surplus = more capacity than needed. Shortfall = budget cannot support the target'}) +
    _stratField('CPQL', ue.cpql ? '$' + ue.cpql : '', {
      tip: 'Cost Per Qualified Lead. Not every lead is sales-ready. Formula: Market CPL ($' + _mktCpl + ') / Lead Quality Rate (' + _inferredQuality + ') = $' + _cpqlVal
    }) +
    _stratField('Estimated CAC', ue.estimated_cac ? '$' + ue.estimated_cac : '', {
      tip: 'Customer Acquisition Cost — total cost to win one paying customer. Formula: CPQL ($' + _cpqlVal + ') / Close Rate (' + _inferredCloseRate + ') = $' + _cacVal
    }) +
    _stratField('LTV', ue.ltv ? '$' + ue.ltv : '', {
      tip: 'Lifetime Value — total revenue from one customer over their relationship. Based on average deal size, repeat purchase rate, and retention. See Assumptions section below for how this was estimated'
    }) +
    _stratField('LTV:CAC Ratio', ue.ltv_cac_ratio, {
      tip: 'How much revenue each acquisition dollar generates. Formula: LTV ($' + _ltvVal + ') / CAC ($' + _cacVal + ') = ' + (ue.ltv_cac_ratio || '?') + '. Below 3:1 = unsustainable, 3-5:1 = healthy, above 5:1 = under-investing in growth'
    }) +
    _stratField('LTV:CAC Health', ue.ltv_cac_health, {
      tip: 'Under-investing = ratio above 5:1, room to spend more aggressively on marketing. Healthy = 3-5:1, balanced growth. Unsustainable = below 3:1, acquiring customers costs too much relative to their value'
    }) +
    _stratField('Paid Media Viable', ue.paid_media_viable ? 'Yes' : 'No', {
      tip: 'Whether paid advertising makes economic sense. Yes when Max Allowable CPL ($' + _maxCpl + ') exceeds Market CPL ($' + _mktCpl + ') — meaning you can afford the going rate for leads in this market'
    })
  );
  // Service cost reference (from pricing engine)
  if (_pricingCatalog && _pricingCatalog.services) {
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Service Cost Reference (Pricing Engine)</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:5px 8px;font-weight:500;color:var(--n2)">Service</th>'
      + '<th style="padding:5px 8px;font-weight:500;color:var(--n2);text-align:right">Min</th>'
      + '<th style="padding:5px 8px;font-weight:500;color:var(--n2);text-align:right">Max</th>'
      + '<th style="padding:5px 8px;font-weight:500;color:var(--n2);text-align:right">Type</th></tr>';
    _pricingCatalog.services.forEach(function(svc) {
      var cost = getServiceMonthlyCost(svc);
      if (!cost) return;
      html += '<tr style="border-bottom:1px solid var(--border)">';
      html += '<td style="padding:5px 8px">' + esc(svc.name || svc.service || svc.id || '') + '</td>';
      html += '<td style="padding:5px 8px;text-align:right">$' + cost.min.toLocaleString() + '</td>';
      html += '<td style="padding:5px 8px;text-align:right">$' + cost.max.toLocaleString() + '</td>';
      html += '<td style="padding:5px 8px;text-align:right;color:var(--n2)">' + (cost.isProject ? 'Project' : '/month') + '</td>';
      html += '</tr>';
    });
    html += '</table></div>';
  }
  html += _stratSection('Pricing & Recommendation',
    _stratField('Pricing Strategy', ue.pricing_strategy, {span:true, textarea:true}) +
    _stratField('Recommendation', ue.recommendation, {span:true, textarea:true})
  );
  // Market CPC Intelligence section
  var cpcSummary = ue.market_cpc_summary;
  if (cpcSummary) {
    var srcLabel = cpcSummary.data_source === 'keyword_research' ? 'Full Keyword Research' : cpcSummary.data_source === 'shallow_estimate' ? 'Shallow API Estimate' : 'Assumption';
    var srcColour = cpcSummary.data_source === 'keyword_research' ? 'var(--green)' : cpcSummary.data_source === 'shallow_estimate' ? '#e6a23c' : '#f56c6c';
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Market CPC Intelligence</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;margin-bottom:12px">';
    // Avg CPC card
    html += '<div style="background:var(--panel);border-radius:8px;padding:12px;text-align:center">';
    html += '<div style="font-size:20px;font-weight:700;color:var(--dark)">$' + (cpcSummary.avg_cpc || 0) + '</div>';
    html += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase">Avg CPC</div></div>';
    // Median CPC card
    html += '<div style="background:var(--panel);border-radius:8px;padding:12px;text-align:center">';
    html += '<div style="font-size:20px;font-weight:700;color:var(--dark)">$' + (cpcSummary.median_cpc || 0) + '</div>';
    html += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase">Median CPC</div></div>';
    // High-intent avg CPC card
    html += '<div style="background:var(--panel);border-radius:8px;padding:12px;text-align:center">';
    html += '<div style="font-size:20px;font-weight:700;color:var(--dark)">' + (cpcSummary.high_intent_avg_cpc ? '$' + cpcSummary.high_intent_avg_cpc : '\u2014') + '</div>';
    html += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase">High-Intent CPC</div></div>';
    html += '</div>';
    html += _stratField('CPC Range', cpcSummary.cpc_range || '');
    html += _stratField('Data Source', '<span style="color:' + srcColour + ';font-weight:500">' + esc(srcLabel) + '</span>', { _html: true });
    if (cpcSummary.cpc_to_cpl_multiplier) html += _stratField('CPC to CPL Multiplier', cpcSummary.cpc_to_cpl_multiplier + 'x');
    if (cpcSummary.rationale) html += _stratField('How CPC informed CPL', cpcSummary.rationale, {span:true});
    html += '</div>';
  }

  // Also show live keyword CPC data if available from keyword research
  var kwR = S.kwResearch || {};
  if (kwR.keywords && kwR.keywords.length >= 10) {
    var kwsWithCpc = kwR.keywords.filter(function(k) { return k.cpc && k.cpc > 0; });
    if (kwsWithCpc.length >= 3) {
      var topCpcKws = kwsWithCpc.slice().sort(function(a, b) { return b.cpc - a.cpc; }).slice(0, 8);
      html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Top Keywords by CPC <span style="font-weight:400;color:var(--n2)">(' + kwsWithCpc.length + ' keywords with CPC data)</span></div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
      html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Keyword</th>'
        + '<th style="padding:6px 4px;font-weight:500;color:var(--n2);text-align:right">CPC</th>'
        + '<th style="padding:6px 4px;font-weight:500;color:var(--n2);text-align:right">Vol/mo</th>'
        + '<th style="padding:6px 8px;font-weight:500;color:var(--n2);text-align:right">KD</th></tr>';
      topCpcKws.forEach(function(k) {
        html += '<tr style="border-bottom:1px solid var(--border)">';
        html += '<td style="padding:6px 8px">' + esc(k.kw || '') + '</td>';
        html += '<td style="padding:6px 4px;text-align:right;font-weight:600;color:var(--dark)">$' + k.cpc + '</td>';
        html += '<td style="padding:6px 4px;text-align:right">' + ((k.vol || 0).toLocaleString()) + '</td>';
        html += '<td style="padding:6px 8px;text-align:right">' + (k.kd || '\u2014') + '</td>';
        html += '</tr>';
      });
      html += '</table></div>';
    }
  }

  // Sensitivity analysis (Correction 7)
  if (ue.sensitivity && ue.sensitivity.length) {
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Sensitivity Analysis <span data-tip="Three scenarios stress-testing the economics. Conservative uses low-end deal size and close rate. Base uses midpoints. Optimistic uses high-end values. Shows how resilient the business model is to changing conditions." style="cursor:help;opacity:.6;font-size:9px">\u24d8</span></div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<tr style="border-bottom:1px solid var(--border)">'
      + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Scenario</th>'
      + '<th style="padding:6px 8px;font-weight:500;color:var(--n2);text-align:right" data-tip="What percentage of qualified leads become paying customers">Close Rate</th>'
      + '<th style="padding:6px 8px;font-weight:500;color:var(--n2);text-align:right" data-tip="Average revenue per closed deal">Avg Deal</th>'
      + '<th style="padding:6px 8px;font-weight:500;color:var(--n2);text-align:right" data-tip="Maximum cost per lead that keeps the business profitable at this scenario. Formula: (Avg Deal x Close Rate x Profit Margin) / Target ROI">Max CPL</th>'
      + '<th style="padding:6px 8px;font-weight:500;color:var(--n2);text-align:right" data-tip="Monthly leads required to hit the revenue target at this close rate and deal size">Leads Needed</th>'
      + '<th style="padding:6px 8px;font-weight:500;color:var(--n2);text-align:right" data-tip="Lifetime Value / Customer Acquisition Cost. Below 3:1 = unsustainable. 3-5:1 = healthy. Above 5:1 = under-investing">LTV:CAC</th>'
      + '</tr>';
    ue.sensitivity.forEach(function(s) {
      var rowBg = s.scenario === 'base' ? 'background:var(--panel)' : '';
      var scenLabel = s.scenario === 'conservative' ? '\u26a0\ufe0f Conservative' : s.scenario === 'base' ? '\u2705 Base' : '\ud83d\ude80 Optimistic';
      html += '<tr style="border-bottom:1px solid var(--border);' + rowBg + '">';
      html += '<td style="padding:6px 8px;font-weight:500">' + scenLabel + '</td>';
      html += '<td style="padding:6px 8px;text-align:right">' + (s.close_rate || '\u2014') + '</td>';
      html += '<td style="padding:6px 8px;text-align:right">' + (s.avg_deal ? '$' + Number(s.avg_deal).toLocaleString() : '\u2014') + '</td>';
      html += '<td style="padding:6px 8px;text-align:right;font-weight:600">' + (s.max_cpl ? '$' + s.max_cpl : '\u2014') + '</td>';
      html += '<td style="padding:6px 8px;text-align:right">' + (s.leads_needed || '\u2014') + '</td>';
      html += '<td style="padding:6px 8px;text-align:right">' + (s.ltv_cac || '\u2014') + '</td>';
      html += '</tr>';
    });
    html += '</table>';
    if (ue.strategy_built_on) {
      html += '<div style="margin-top:8px;padding:8px 10px;border-radius:6px;background:var(--panel);font-size:11px;color:var(--n2)">'
        + '<strong style="color:var(--dark)">Strategy built on:</strong> ' + esc(ue.strategy_built_on) + '</div>';
    }
    if (ue.break_even_floor) {
      html += '<div style="margin-top:6px;padding:8px 10px;border-radius:6px;background:#fdf6ec;border:1px solid #e6a23c40;font-size:11px;color:var(--dark)">'
        + '<strong>Break-even floor:</strong> ' + esc(ue.break_even_floor) + '</div>';
    }
    if (ue.input_quality) {
      var iqColour = ue.input_quality === 'client_provided' ? 'var(--green)' : ue.input_quality === 'ai_estimated' ? '#e6a23c' : 'var(--n2)';
      html += '<div style="margin-top:6px;font-size:10px;color:var(--n2)">Input quality: <span style="color:' + iqColour + ';font-weight:600">' + esc(ue.input_quality.replace(/_/g, ' ')) + '</span></div>';
    }
    html += '</div>';
  }

  if (ue.assumptions && ue.assumptions.length) {
    html += _stratSection('Assumptions', _stratField('Assumptions', ue.assumptions, {span:true}));
  }
  // Benchmark sources — show which data layer was used for each metric
  if (ue.benchmark_sources) {
    var bs = ue.benchmark_sources;
    var _srcLabel = function(s) {
      if (!s) return '\u2014';
      return s.replace(/layer_1_benchmark/g, 'Industry Benchmark').replace(/layer_2_gkp/g, 'Google Ads Forecast')
        .replace(/layer_3_client/g, 'Client-Provided').replace(/client_provided/g, 'Client-Provided')
        .replace(/cpc_derived/g, 'CPC Data').replace(/assumption/g, 'AI Estimate');
    };
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Data Sources</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px">';
    html += '<div><span style="color:var(--n2)">CVR:</span> ' + _srcLabel(bs.cvr_source) + '</div>';
    html += '<div><span style="color:var(--n2)">CPL:</span> ' + _srcLabel(bs.cpl_source) + '</div>';
    html += '<div><span style="color:var(--n2)">Close Rate:</span> ' + _srcLabel(bs.close_rate_source) + '</div>';
    html += '</div></div>';
  }
  // Show matched industry benchmark for reference
  var _benchRef = _matchIndustryBenchmark((S.research || {}).industry);
  if (_benchRef && _benchRef.source) {
    html += '<div style="font-size:10px;color:var(--n2);margin-top:4px;padding:6px 10px;background:var(--panel);border-radius:6px;display:flex;align-items:center;justify-content:space-between;gap:8px">'
      + '<span><strong>Industry benchmark matched:</strong> ' + esc(_benchRef.source)
      + ' \u2014 CVR mid: ' + (_benchRef.landing_page_cvr.mid*100) + '%, CPL mid: $' + _benchRef.avg_cpl.mid
      + ', Close mid: ' + (_benchRef.close_rate.mid*100) + '%</span>'
      + '<button onclick="showBenchmarkTable()" style="border:none;background:none;color:var(--accent);cursor:pointer;font-size:10px;white-space:nowrap;text-decoration:underline">View All Benchmarks</button>'
      + '</div>';
  }
  return html;
}

function _renderChannels(st) {
  var cs = st.channel_strategy || {};
  if (!cs.levers || !cs.levers.length) {
    return '<div class="card" style="color:var(--n2);text-align:center"><p>No channel data yet. Generate strategy to populate.</p></div>';
  }
  var html = '';

  // Budget tiers (Correction 2)
  var bt = cs.budget_tiers;
  if (bt) {
    var tiers = [
      { key: 'current_budget', label: 'Current Budget', icon: 'ti-wallet', colour: 'var(--dark)' },
      { key: 'growth_budget', label: 'Growth (2\u20133x)', icon: 'ti-trending-up', colour: '#e6a23c' },
      { key: 'optimal_budget', label: 'Optimal', icon: 'ti-star', colour: 'var(--green)' }
    ];
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Budget Tiers</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px">';
    tiers.forEach(function(t) {
      var tier = bt[t.key];
      if (!tier) return;
      var total = tier.total_monthly || tier.total || 0;
      html += '<div style="background:var(--panel);border-radius:8px;padding:14px;border:1px solid var(--border)">';
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">';
      html += '<i class="ti ' + t.icon + '" style="color:' + t.colour + ';font-size:15px"></i>';
      html += '<span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--n3)">' + t.label + '</span></div>';
      html += '<div style="font-size:22px;font-weight:700;color:var(--dark);margin-bottom:6px">$' + Number(total).toLocaleString() + '<span style="font-size:11px;font-weight:400;color:var(--n2)">/mo</span></div>';
      if (tier.expected_leads) html += '<div style="font-size:11px;color:var(--n2)">' + tier.expected_leads + ' leads/mo expected</div>';
      if (tier.expected_cpl) html += '<div style="font-size:11px;color:var(--n2)">~$' + tier.expected_cpl + ' CPL</div>';
      if (tier.rationale) html += '<div style="font-size:11px;color:var(--n2);margin-top:6px;line-height:1.4">' + esc(tier.rationale) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    if (bt.paid_viability_floor) {
      html += '<div style="padding:8px 10px;border-radius:6px;background:#fdf6ec;border:1px solid #e6a23c40;font-size:11px;color:var(--dark);margin-bottom:4px">'
        + '<strong>Paid viability floor:</strong> ' + esc(bt.paid_viability_floor) + '</div>';
    }
    html += '</div>';
  }

  // Package fit indicator
  var _chBudget = parseFloat(String((S.research || {}).monthly_marketing_budget || '0').replace(/[^0-9.]/g, ''));
  var _chPkgFit = getPackageFit(_chBudget);
  if (_chPkgFit) {
    var _pkgColour = _chPkgFit.tier === 'below_minimum' ? '#f56c6c' : _chPkgFit.tier === 'custom' ? 'var(--green)' : '#409eff';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;border-radius:6px;background:var(--panel);border:1px solid var(--border)">'
      + '<span style="font-size:11px;color:var(--n2)">Client budget: <strong>$' + _chBudget.toLocaleString() + '/mo</strong></span>'
      + '<span style="font-size:10px;font-weight:600;color:' + _pkgColour + ';padding:2px 8px;border-radius:10px;border:1px solid ' + _pkgColour + '30;background:' + _pkgColour + '08">' + esc(_chPkgFit.label) + '</span>'
      + (_chPkgFit.tier === 'below_minimum' ? '<span style="font-size:10px;color:#f56c6c">Min: $' + (_chPkgFit.minimum || 0).toLocaleString() + '/mo</span>' : '')
      + '</div>';
  }

  // Service Scope panel
  if (S.strategy.engagement_scope) {
    html += _renderScopePanel();
  }

  // Priority order table with service costs
  var _hasPricing = _pricingCatalog && _pricingCatalog.services;
  html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Channel Priority ' + _renderPricingIndicator() + '</div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Lever</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Fit</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Econ</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Comp</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Impact</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Priority</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Budget %</th>'
    + (_hasPricing ? '<th style="padding:6px 4px;font-weight:500;color:var(--n2);text-align:right">Min Cost</th>' : '')
    + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Timeline</th></tr>';
  cs.levers.sort(function(a, b) { return (b.priority_score || 0) - (a.priority_score || 0); }).forEach(function(lev) {
    var _levSvc = _hasPricing ? lookupServicePricing(lev.lever) : null;
    var _levCost = _levSvc ? getServiceMonthlyCost(_levSvc) : null;
    var _budgetFeasible = true;
    if (_levCost && _chBudget > 0 && !_levCost.isProject) {
      var _allocDollars = _chBudget * ((lev.budget_allocation_pct || 0) / 100);
      if (_allocDollars < _levCost.min && lev.budget_allocation_pct > 0) _budgetFeasible = false;
    }
    html += '<tr style="border-bottom:1px solid var(--border);' + (!_budgetFeasible ? 'background:#fef0f0' : '') + '">';
    html += '<td style="padding:6px 8px;font-weight:500">' + esc(lev.lever || '') + (!_budgetFeasible ? ' <span style="font-size:9px;color:#f56c6c;font-weight:400" title="Budget allocation below minimum service cost">⚠ underfunded</span>' : '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (lev.fit || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (lev.economics || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (lev.competitive_reality || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (lev.goal_impact || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center;font-weight:600">' + (lev.priority_score || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (lev.budget_allocation_pct || 0) + '%</td>';
    if (_hasPricing) {
      html += '<td style="padding:6px 4px;text-align:right;font-size:10px;color:var(--n2)">' + (_levCost ? '$' + _levCost.min.toLocaleString() + (_levCost.isProject ? ' proj' : '/mo') : '\u2014') + '</td>';
    }
    html += '<td style="padding:6px 8px">' + esc(lev.timeline_to_results || '') + '</td>';
    html += '</tr>';
  });
  html += '</table></div>';

  // Funnel coverage
  if (cs.funnel_coverage) {
    html += _stratSection('Funnel Coverage',
      Object.keys(cs.funnel_coverage).map(function(stage) {
        var fc = cs.funnel_coverage[stage];
        var covered = fc.covered ? '<span style="color:var(--green)">Covered</span>' : '<span style="color:#f56c6c">Gap</span>';
        return _stratField(stage.charAt(0).toUpperCase() + stage.slice(1),
          covered + (fc.by && fc.by.length ? ' by ' + fc.by.join(', ') : '') + (fc.gap ? ' \u2014 ' + esc(fc.gap) : ''), { _html: true });
      }).join('')
    );
  }

  // Not recommended
  if (cs.levers_not_recommended && cs.levers_not_recommended.length) {
    html += _stratSection('Not Recommended',
      cs.levers_not_recommended.map(function(nr) {
        return _stratField(nr.lever, nr.reason + (nr.revisit_when ? ' (revisit: ' + nr.revisit_when + ')' : ''));
      }).join('')
    );
  }

  return html;
}

function _renderGrowth(st) {
  var gp = st.growth_plan || {};
  var html = '';

  // Funnel architecture
  if (gp.funnel_architecture) {
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Funnel Architecture</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Stage</th>'
      + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Status</th>'
      + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Covered By</th>'
      + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Gap</th></tr>';
    ['awareness','consideration','conversion','nurture','retention'].forEach(function(stage) {
      var fc = gp.funnel_architecture[stage] || {};
      html += '<tr style="border-bottom:1px solid var(--border)">';
      html += '<td style="padding:6px 8px;font-weight:500">' + stage.charAt(0).toUpperCase() + stage.slice(1) + '</td>';
      html += '<td style="padding:6px 8px">' + (fc.covered ? '<span style="color:var(--green)">Covered</span>' : '<span style="color:#f56c6c">Gap</span>') + '</td>';
      html += '<td style="padding:6px 8px">' + esc((fc.by || []).join(', ')) + '</td>';
      html += '<td style="padding:6px 8px">' + esc(fc.gap || '') + '</td>';
      html += '</tr>';
    });
    html += '</table></div>';
  }

  // Interactive Gantt Timeline
  var overrideCount = (gp.timeline_overrides ? Object.keys(gp.timeline_overrides).length : 0)
    + (gp.deleted_items ? gp.deleted_items.length : 0)
    + (gp.custom_items ? gp.custom_items.length : 0);
  var hasOverrides = overrideCount > 0;
  html += '<div style="margin-bottom:18px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">'
    + '<span style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em">Execution Timeline</span>'
    + '</div>';
  if (hasOverrides) {
    html += '<div id="gantt-override-bar" style="display:flex;align-items:center;gap:8px;padding:6px 10px;margin-bottom:10px;border-radius:6px;background:#fdf6ec;border:1px solid #e6a23c40">'
      + '<i class="ti ti-pencil" style="color:#e6a23c;font-size:14px"></i>'
      + '<span style="font-size:11px;color:var(--dark);font-weight:500">' + overrideCount + ' unsaved edit' + (overrideCount === 1 ? '' : 's') + '</span>'
      + '<span style="flex:1"></span>'
      + '<button class="btn btn-ghost sm" onclick="_ganttResetOverrides()" style="font-size:10px;padding:2px 8px;color:#f56c6c"><i class="ti ti-arrow-back-up" style="font-size:12px"></i> Reset</button>'
      + '<button class="btn btn-dark sm" onclick="_ganttAcceptOverrides()" style="font-size:10px;padding:2px 8px"><i class="ti ti-check" style="font-size:12px"></i> Accept</button>'
      + '</div>';
  } else if (gp.accepted_at) {
    var acceptDate = new Date(gp.accepted_at);
    var dateStr = acceptDate.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 10px;margin-bottom:10px;font-size:10px;color:var(--green)">'
      + '<i class="ti ti-circle-check" style="font-size:13px"></i>'
      + '<span>Timeline accepted ' + dateStr + '</span>'
      + '</div>';
  }
  html += '<div id="strat-gantt-container"></div></div>';
  // Gantt is rendered via DOM after innerHTML is set (see _mountGantt call in renderStrategyTabContent)

  // Budget allocation with real costs
  if (gp.budget_allocation) {
    var _gaHasPricing = _pricingCatalog && _pricingCatalog.services;
    var _gaTotalReal = 0;
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Budget Allocation ' + (_gaHasPricing ? _renderPricingIndicator() : '') + '</div>';
    if (gp.budget_allocation.total_monthly) {
      html += '<div style="font-size:18px;font-weight:700;color:var(--dark);margin-bottom:10px">$' + Number(gp.budget_allocation.total_monthly).toLocaleString() + '<span style="font-size:11px;font-weight:400;color:var(--n2)">/mo (AI recommended)</span></div>';
    }
    if (gp.budget_allocation.by_lever && typeof gp.budget_allocation.by_lever === 'object') {
      html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
      html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:5px 8px;font-weight:500;color:var(--n2)">Lever</th>'
        + '<th style="padding:5px 8px;font-weight:500;color:var(--n2);text-align:right">AI Allocation</th>'
        + (_gaHasPricing ? '<th style="padding:5px 8px;font-weight:500;color:var(--n2);text-align:right">Real Cost (mid)</th>' : '')
        + '</tr>';
      Object.keys(gp.budget_allocation.by_lever).forEach(function(lever) {
        var aiAmt = gp.budget_allocation.by_lever[lever] || 0;
        var _gaSvc = _gaHasPricing ? lookupServicePricing(lever) : null;
        var _gaCost = _gaSvc ? getServiceMonthlyCost(_gaSvc) : null;
        if (_gaCost && !_gaCost.isProject) _gaTotalReal += _gaCost.mid;
        html += '<tr style="border-bottom:1px solid var(--border)">';
        html += '<td style="padding:5px 8px">' + esc(lever.replace(/_/g, ' ')) + '</td>';
        html += '<td style="padding:5px 8px;text-align:right">$' + Number(aiAmt).toLocaleString() + '</td>';
        if (_gaHasPricing) {
          html += '<td style="padding:5px 8px;text-align:right;color:' + (_gaCost ? 'var(--dark)' : 'var(--n2)') + '">' + (_gaCost && !_gaCost.isProject ? '$' + _gaCost.mid.toLocaleString() : '\u2014') + '</td>';
        }
        html += '</tr>';
      });
      if (_gaHasPricing && _gaTotalReal > 0) {
        html += '<tr style="font-weight:700;border-top:2px solid var(--border)"><td style="padding:5px 8px">Total (real pricing)</td>'
          + '<td style="padding:5px 8px;text-align:right">$' + Number(gp.budget_allocation.total_monthly || 0).toLocaleString() + '</td>'
          + '<td style="padding:5px 8px;text-align:right;color:var(--dark)">$' + _gaTotalReal.toLocaleString() + '</td></tr>';
      }
      html += '</table>';
    }
    // Budget vs plan comparison
    var _gaBudget = parseFloat(String((S.research || {}).monthly_marketing_budget || '0').replace(/[^0-9.]/g, ''));
    var _gaPlanTotal = _gaTotalReal > 0 ? _gaTotalReal : (gp.budget_allocation.total_monthly || 0);
    if (_gaBudget > 0 && _gaPlanTotal > 0) {
      var _gaGap = _gaPlanTotal - _gaBudget;
      var _gaGapColour = _gaGap > 0 ? '#f56c6c' : 'var(--green)';
      html += '<div style="margin-top:10px;padding:8px 12px;border-radius:6px;background:' + (_gaGap > 0 ? '#fef0f0' : '#f0fdf4') + ';border:1px solid ' + _gaGapColour + '30;font-size:11px;display:flex;align-items:center;gap:8px">'
        + '<i class="ti ' + (_gaGap > 0 ? 'ti-alert-triangle' : 'ti-circle-check') + '" style="color:' + _gaGapColour + ';font-size:14px"></i>'
        + '<span>Client budget: <strong>$' + _gaBudget.toLocaleString() + '/mo</strong> | Plan total: <strong>$' + _gaPlanTotal.toLocaleString() + '/mo</strong> | '
        + (_gaGap > 0 ? '<span style="color:#f56c6c;font-weight:600">Gap: $' + _gaGap.toLocaleString() + '/mo over budget</span>' : '<span style="color:var(--green);font-weight:600">Within budget (\u2212$' + Math.abs(_gaGap).toLocaleString() + ')</span>')
        + '</span></div>';
    }
    html += '</div>';
  }

  // Targets
  if (st.targets && Object.keys(st.targets).length) {
    html += _stratSection('Targets',
      Object.keys(st.targets).map(function(k) {
        return _stratField(k.replace(/_/g, ' '), st.targets[k]);
      }).join('')
    );
  }

  return html;
}

/* ── Interactive Gantt helpers ─────────────────────────── */

var _ganttPhaseColours = ['#e6a23c','#409eff','#67c23a','#9b59b6','#e74c3c'];
var _ganttMonths = 12;

function _buildGanttItems(st) {
  var gp = st.growth_plan || {};
  var overrides = gp.timeline_overrides || {};
  var deleted = gp.deleted_items || [];
  var items;
  var fromAccepted = false;

  // If an accepted timeline exists, use it as the base
  if (gp.accepted_timeline && gp.accepted_timeline.length) {
    fromAccepted = true;
    items = gp.accepted_timeline.map(function(at) {
      return {
        id: at.id,
        phase: at.phase,
        label: at.label,
        startWeek: at.startWeek || 0,
        duration: at.duration,
        notes: at.notes || '',
        depends: at.depends || [],
        budgetPct: at.budgetPct || 0
      };
    });
  } else {
    // Build from AI data
    var levers = (st.channel_strategy && st.channel_strategy.levers) ? st.channel_strategy.levers.filter(function(l) { return l.priority_score > 3; }) : [];
    // Filter out disabled services from engagement_scope
    if (st.engagement_scope && st.engagement_scope.services) {
      var _esScope = st.engagement_scope;
      levers = levers.filter(function(l) {
        var slug = LEVER_SERVICE_MAP[l.lever];
        if (!slug) return true;
        var svc = _esScope.services[slug];
        return !svc || svc.enabled;
      });
    }

    items = [
      { id: '_tracking', phase: 0, label: 'Tracking & Measurement', depends: [], duration: '2 weeks', startWeek: 0, notes: 'Setsail measurement product. Must complete before paid levers.' }
    ];

    // Build from pricing catalog when available, otherwise fall back to AI levers
    var _catServices = (_pricingCatalog && _pricingCatalog.services) || [];
    var _catById = {};
    _catServices.forEach(function(cs) { _catById[cs.id] = cs; });

    // Track which catalog services are already added (avoid duplicates from multi-lever collapse)
    var _addedCatSlugs = {};

    levers.forEach(function(lev) {
      var levId = (lev.lever || '').replace(/\s+/g, '_').toLowerCase();
      var slug = LEVER_SERVICE_MAP[lev.lever];
      var catSvc = slug ? _catById[slug] : null;

      // Skip if this catalog service was already added by another lever
      if (slug && _addedCatSlugs[slug]) return;
      if (slug) _addedCatSlugs[slug] = true;

      // Check if disabled in engagement scope
      if (st.engagement_scope && st.engagement_scope.services && slug) {
        var scopeSvc = st.engagement_scope.services[slug];
        if (scopeSvc && !scopeSvc.enabled) return;
      }

      // Project-type services with phases → expand into sub-items
      if (catSvc && catSvc.type === 'project' && catSvc.phases && catSvc.phases.length) {
        catSvc.phases.forEach(function(ph, idx) {
          var phWeeks = String(ph.weeks || '1');
          var startW = 0;
          var durW = 2;
          var wMatch = phWeeks.match(/(\d+)\s*[-–]\s*(\d+)/);
          if (wMatch) {
            startW = parseInt(wMatch[1], 10) - 1;
            durW = parseInt(wMatch[2], 10) - startW;
          } else {
            var single = parseInt(phWeeks, 10);
            if (single) { startW = single - 1; durW = 1; }
          }
          items.push({
            id: levId + '_ph' + idx,
            _serviceSlug: slug,
            phase: 1,
            label: (catSvc.name || lev.lever) + ': ' + ph.name,
            depends: idx === 0 ? [] : [levId + '_ph' + (idx - 1)],
            duration: durW + ' weeks',
            startWeek: startW,
            notes: (ph.modules || []).join(', '),
            budgetPct: idx === 0 ? (lev.budget_allocation_pct || 0) : 0,
            _isProjectPhase: true
          });
        });
      } else {
        // Monthly/recurring services or no catalog data → single bar
        var duration = 'ongoing';
        if (catSvc && catSvc.type === 'project') {
          duration = '4-8 weeks'; // project without phases
        } else if (lev.timeline_to_results) {
          duration = lev.timeline_to_results;
        }
        items.push({
          id: levId,
          _serviceSlug: slug,
          phase: lev.dependencies && lev.dependencies.length ? 2 : 1,
          label: catSvc ? catSvc.name : (lev.lever || '').replace(/_/g, ' '),
          depends: lev.dependencies || [],
          duration: duration,
          startWeek: 0,
          notes: lev.recommendation ? lev.recommendation.slice(0, 100) : '',
          budgetPct: lev.budget_allocation_pct || 0
        });
      }
    });
  }

  // Add custom (user-added) items
  if (gp.custom_items && gp.custom_items.length) {
    gp.custom_items.forEach(function(ci) {
      items.push({
        id: ci.id,
        phase: ci.phase || 1,
        label: ci.label || 'Custom Item',
        depends: ci.depends || [],
        duration: ci.duration || '4 weeks',
        startWeek: ci.startWeek || 0,
        notes: ci.notes || '',
        isCustom: true
      });
    });
  }

  // Remove deleted items
  if (deleted.length) {
    items = items.filter(function(item) { return deleted.indexOf(item.id) < 0; });
  }

  // Apply overrides
  items.forEach(function(item) {
    var ov = overrides[item.id];
    if (ov) {
      if (ov.phase != null) item.phase = ov.phase;
      if (ov.startWeek != null) item.startWeek = ov.startWeek;
      if (ov.duration) item.duration = ov.duration;
      if (ov.notes) item.notes = ov.notes;
      if (ov.order != null) item._order = ov.order;
    }
  });

  // Auto-calculate start weeks — skip when loading from accepted timeline
  // (accepted positions are already finalised by the user)
  _ganttAutoStartWeeks(items, fromAccepted);

  // Sort by phase then order then startWeek
  items.sort(function(a, b) {
    if (a.phase !== b.phase) return a.phase - b.phase;
    if (a._order != null && b._order != null) return a._order - b._order;
    return a.startWeek - b.startWeek;
  });

  return items;
}

function _ganttAutoStartWeeks(items, fromAccepted) {
  // Skip auto-calculation entirely when loading from accepted timeline —
  // those positions were already finalised by the user.
  if (fromAccepted) return;

  var byId = {};
  items.forEach(function(item) { byId[item.id] = item; });

  items.forEach(function(item) {
    var gp = (S.strategy && S.strategy.growth_plan) || {};
    var ov = (gp.timeline_overrides || {})[item.id];
    if (ov && ov.startWeek != null) return; // user set it manually

    if (item.depends && item.depends.length) {
      var maxEnd = 0;
      item.depends.forEach(function(dep) {
        var depId = dep.replace(/\s+/g, '_').toLowerCase();
        var depItem = byId[depId];
        if (depItem) {
          var depEnd = depItem.startWeek + _ganttParseWeeks(depItem.duration);
          if (depEnd > maxEnd) maxEnd = depEnd;
        }
      });
      item.startWeek = maxEnd || (item.phase * 4);
    } else {
      // Phase-based default: P0=0, P1=2, P2=8
      item.startWeek = item.phase === 0 ? 0 : item.phase === 1 ? 2 : 8;
    }
  });
}

function _ganttParseWeeks(dur) {
  if (!dur || dur === 'ongoing') return 12;
  var s = String(dur).toLowerCase();
  // "4-8 weeks" → take the higher number
  var wMatch = s.match(/(\d+)\s*[-\u2013]\s*(\d+)\s*week/);
  if (wMatch) return parseInt(wMatch[2], 10);
  wMatch = s.match(/(\d+)\s*week/);
  if (wMatch) return parseInt(wMatch[1], 10);
  // "3-6 months"
  var mMatch = s.match(/(\d+)\s*[-\u2013]\s*(\d+)\s*month/);
  if (mMatch) return parseInt(mMatch[2], 10) * 4;
  mMatch = s.match(/(\d+)\s*month/);
  if (mMatch) return parseInt(mMatch[1], 10) * 4;
  // "1 year"
  if (s.indexOf('year') >= 0) return 48;
  return 12; // default
}

function _ganttResetOverrides() {
  if (!S.strategy) return;

  // Confirmation modal
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:600;display:flex;align-items:center;justify-content:center';

  var card = document.createElement('div');
  card.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:20px;width:400px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.15)';

  card.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
    + '<i class="ti ti-alert-triangle" style="color:#e6a23c;font-size:18px"></i>'
    + '<span style="font-size:13px;font-weight:600">Reset to original AI version?</span>'
    + '</div>'
    + '<p style="font-size:12px;color:var(--n2);margin:0 0 16px;line-height:1.5">'
    + 'This will discard all your manual edits, removed items, and custom additions. '
    + 'The timeline will revert to the AI-generated version from the Channel Viability diagnostic.</p>';

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function() { overlay.remove(); };
  btnRow.appendChild(cancelBtn);

  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn sm';
  confirmBtn.style.cssText = 'background:#f56c6c;color:white;border:none';
  confirmBtn.textContent = 'Yes, reset';
  confirmBtn.onclick = function() {
    overlay.remove();
    S.strategy.growth_plan = S.strategy.growth_plan || {};
    S.strategy.growth_plan.timeline_overrides = {};
    S.strategy.growth_plan.deleted_items = [];
    S.strategy.growth_plan.custom_items = [];
    S.strategy.growth_plan.accepted_timeline = null;
    S.strategy.growth_plan.accepted_at = null;
    scheduleSave();
    renderStrategyTabContent();
    aiBarNotify('Timeline reset to AI-generated defaults', { type: 'info', duration: 2000 });
  };
  btnRow.appendChild(confirmBtn);

  card.appendChild(btnRow);
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function _ganttAcceptOverrides() {
  if (!S.strategy) return;
  var gp = S.strategy.growth_plan = S.strategy.growth_plan || {};
  var overrides = gp.timeline_overrides || {};
  if (!Object.keys(overrides).length) return;

  // Bake overrides into accepted_timeline snapshot
  var items = _buildGanttItems(S.strategy);
  gp.accepted_timeline = items.map(function(item) {
    return {
      id: item.id,
      phase: item.phase,
      label: item.label,
      startWeek: item.startWeek,
      duration: item.duration,
      notes: item.notes,
      depends: item.depends,
      budgetPct: item.budgetPct || 0
    };
  });
  gp.accepted_at = new Date().toISOString();

  // Clear overrides — accepted state is now the baseline
  gp.timeline_overrides = {};
  gp.deleted_items = [];
  gp.custom_items = [];
  scheduleSave();
  renderStrategyTabContent();
  aiBarNotify('Timeline edits accepted', { type: 'success', duration: 2000 });
}

function _ganttSaveOverride(id, field, value) {
  if (!S.strategy) return;
  S.strategy.growth_plan = S.strategy.growth_plan || {};
  S.strategy.growth_plan.timeline_overrides = S.strategy.growth_plan.timeline_overrides || {};
  var ov = S.strategy.growth_plan.timeline_overrides[id] || {};
  ov[field] = value;
  S.strategy.growth_plan.timeline_overrides[id] = ov;
  scheduleSave();
}

function _ganttDeleteItem(id) {
  if (!S.strategy) return;

  // Check if this is an AI-recommended lever (not a custom addition)
  var isCustom = id.indexOf('custom_') === 0;
  var isFoundation = id === '_tracking' || id === '_website';

  // Look up the lever in channel strategy for context
  var leverLabel = id.replace(/_/g, ' ');
  var leverScore = null;
  var cs = S.strategy.channel_strategy || {};
  if (cs.levers) {
    cs.levers.forEach(function(l) {
      if ((l.lever || '').replace(/\s+/g, '_').toLowerCase() === id) {
        leverLabel = (l.lever || '').replace(/_/g, ' ');
        leverScore = l.priority_score;
      }
    });
  }

  var doDelete = function() {
    var gp = S.strategy.growth_plan = S.strategy.growth_plan || {};
    gp.deleted_items = gp.deleted_items || [];
    if (gp.deleted_items.indexOf(id) < 0) gp.deleted_items.push(id);
    if (gp.custom_items) {
      gp.custom_items = gp.custom_items.filter(function(ci) { return ci.id !== id; });
    }
    if (gp.timeline_overrides && gp.timeline_overrides[id]) {
      delete gp.timeline_overrides[id];
    }
    scheduleSave();
    renderStrategyTabContent();
  };

  // Custom items delete immediately — no warning needed
  if (isCustom) { doDelete(); return; }

  // AI-recommended items get a warning
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:600;display:flex;align-items:center;justify-content:center';

  var card = document.createElement('div');
  card.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:20px;width:400px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.15)';

  var warningText = '';
  if (isFoundation) {
    warningText = '<strong>' + esc(leverLabel) + '</strong> is a foundation item. '
      + 'Removing it may break dependencies for other levers in your timeline.';
  } else if (leverScore && leverScore >= 7) {
    warningText = '<strong>' + esc(leverLabel) + '</strong> is a high-priority lever (score ' + leverScore + '/10) '
      + 'recommended by the AI strategy. Removing it changes your recommended service scope and may affect projected results.';
  } else if (leverScore) {
    warningText = '<strong>' + esc(leverLabel) + '</strong> (score ' + leverScore + '/10) '
      + 'is part of the AI-recommended strategy. Removing it narrows the service scope.';
  } else {
    warningText = '<strong>' + esc(leverLabel) + '</strong> is part of the AI-recommended timeline. '
      + 'Removing it changes the recommended service scope.';
  }

  card.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
    + '<i class="ti ti-alert-triangle" style="color:#e6a23c;font-size:18px"></i>'
    + '<span style="font-size:13px;font-weight:600">Remove from timeline?</span>'
    + '</div>'
    + '<p style="font-size:12px;color:var(--n2);margin:0 0 6px;line-height:1.5">' + warningText + '</p>'
    + '<p style="font-size:11px;color:var(--n3);margin:0 0 16px;line-height:1.4">'
    + 'You can always restore it by clicking Reset to return to the original AI version.</p>';

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost sm';
  cancelBtn.textContent = 'Keep';
  cancelBtn.onclick = function() { overlay.remove(); };
  btnRow.appendChild(cancelBtn);

  var confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn sm';
  confirmBtn.style.cssText = 'background:#f56c6c;color:white;border:none';
  confirmBtn.textContent = 'Remove';
  confirmBtn.onclick = function() {
    overlay.remove();
    doDelete();
  };
  btnRow.appendChild(confirmBtn);

  card.appendChild(btnRow);
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function _ganttAddItem() {
  // Modal to add a new custom timeline item
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:600;display:flex;align-items:center;justify-content:center';

  var card = document.createElement('div');
  card.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:20px;width:380px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.15)';

  card.innerHTML = '<div style="font-size:13px;font-weight:600;margin-bottom:14px">Add Timeline Item</div>';

  // Label
  var labelRow = document.createElement('div');
  labelRow.style.cssText = 'margin-bottom:10px';
  labelRow.innerHTML = '<label style="font-size:11px;font-weight:500;color:var(--n2);display:block;margin-bottom:4px">Name</label>';
  var labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.placeholder = 'e.g. Email Nurture Sequence';
  labelInput.style.cssText = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg)';
  labelRow.appendChild(labelInput);
  card.appendChild(labelRow);

  // Phase
  var phaseRow = document.createElement('div');
  phaseRow.style.cssText = 'margin-bottom:10px';
  phaseRow.innerHTML = '<label style="font-size:11px;font-weight:500;color:var(--n2);display:block;margin-bottom:4px">Phase</label>';
  var phaseSelect = document.createElement('select');
  phaseSelect.style.cssText = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg)';
  ['0: Foundation','1: Launch','2: Scale','3: Optimise'].forEach(function(lbl, i) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = lbl;
    if (i === 1) opt.selected = true;
    phaseSelect.appendChild(opt);
  });
  phaseRow.appendChild(phaseSelect);
  card.appendChild(phaseRow);

  // Start week
  var startRow = document.createElement('div');
  startRow.style.cssText = 'margin-bottom:10px';
  startRow.innerHTML = '<label style="font-size:11px;font-weight:500;color:var(--n2);display:block;margin-bottom:4px">Start (week)</label>';
  var startInput = document.createElement('input');
  startInput.type = 'number';
  startInput.min = '0';
  startInput.max = '48';
  startInput.value = '4';
  startInput.style.cssText = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg)';
  startRow.appendChild(startInput);
  card.appendChild(startRow);

  // Duration
  var durRow = document.createElement('div');
  durRow.style.cssText = 'margin-bottom:10px';
  durRow.innerHTML = '<label style="font-size:11px;font-weight:500;color:var(--n2);display:block;margin-bottom:4px">Duration</label>';
  var durInput = document.createElement('input');
  durInput.type = 'text';
  durInput.placeholder = 'e.g. 4 weeks, 2-3 months, ongoing';
  durInput.value = '4 weeks';
  durInput.style.cssText = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg)';
  durRow.appendChild(durInput);
  card.appendChild(durRow);

  // Notes
  var noteRow = document.createElement('div');
  noteRow.style.cssText = 'margin-bottom:14px';
  noteRow.innerHTML = '<label style="font-size:11px;font-weight:500;color:var(--n2);display:block;margin-bottom:4px">Notes</label>';
  var noteInput = document.createElement('textarea');
  noteInput.rows = 2;
  noteInput.placeholder = 'Optional notes';
  noteInput.style.cssText = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg);resize:vertical';
  noteRow.appendChild(noteInput);
  card.appendChild(noteRow);

  // Buttons
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function() { overlay.remove(); };
  btnRow.appendChild(cancelBtn);

  var addBtn = document.createElement('button');
  addBtn.className = 'btn btn-dark sm';
  addBtn.textContent = 'Add';
  addBtn.onclick = function() {
    var name = labelInput.value.trim();
    if (!name) { labelInput.style.borderColor = '#f56c6c'; return; }
    var gp = S.strategy.growth_plan = S.strategy.growth_plan || {};
    gp.custom_items = gp.custom_items || [];
    var id = 'custom_' + Date.now();
    gp.custom_items.push({
      id: id,
      label: name,
      phase: parseInt(phaseSelect.value, 10),
      startWeek: parseInt(startInput.value, 10) || 0,
      duration: durInput.value.trim() || '4 weeks',
      notes: noteInput.value.trim(),
      depends: []
    });
    scheduleSave();
    overlay.remove();
    renderStrategyTabContent();
  };
  btnRow.appendChild(addBtn);
  card.appendChild(btnRow);

  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  labelInput.focus();
}

function _mountGantt(st) {
  var container = document.getElementById('strat-gantt-container');
  if (!container) return;

  var items = _buildGanttItems(st);
  if (!items.length) {
    container.innerHTML = '<div style="color:var(--n2);font-size:12px;padding:12px">No channel strategy data. Run Diagnostic 4 (Channels) first.</div>';
    return;
  }

  // Calculate total weeks for chart
  var maxWeek = 0;
  items.forEach(function(item) {
    var end = item.startWeek + _ganttParseWeeks(item.duration);
    if (end > maxWeek) maxWeek = end;
  });
  var totalWeeks = Math.max(maxWeek, 48); // at least 12 months
  var monthCount = Math.ceil(totalWeeks / 4);
  var pxPerWeek = 60 / 4; // 60px per month / 4 weeks
  var labelW = 240;
  var minRowW = labelW + monthCount * 60;

  // Build the chart
  var wrap = document.createElement('div');
  wrap.style.cssText = 'overflow-x:auto;margin-bottom:12px';

  // Month headers
  var headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;border-bottom:1px solid var(--border);padding-left:' + labelW + 'px;min-width:' + minRowW + 'px';
  for (var m = 0; m < monthCount; m++) {
    var mCell = document.createElement('div');
    mCell.style.cssText = 'width:60px;min-width:60px;text-align:center;font-size:9px;font-weight:500;color:var(--n3);padding:4px 0;text-transform:uppercase';
    mCell.textContent = 'M' + (m + 1);
    headerRow.appendChild(mCell);
  }
  wrap.appendChild(headerRow);

  // Rows
  var dragState = { dragging: null };
  items.forEach(function(item, idx) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;min-height:36px;border-bottom:1px solid var(--border);min-width:' + minRowW + 'px;transition:background .15s';
    row.setAttribute('data-gantt-idx', idx);

    // Row reorder drop target (row itself is not draggable — the label is the drag handle)
    row.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.style.background = 'var(--bg2)';
    });
    row.addEventListener('dragleave', function() {
      row.style.background = '';
    });
    row.addEventListener('drop', function(e) {
      e.preventDefault();
      row.style.background = '';
      if (dragState.dragging == null || dragState.dragging === idx) return;
      var newOrder = items.map(function(it, i) { return { id: it.id, order: i }; });
      var fromIdx = dragState.dragging;
      var moved = newOrder.splice(fromIdx, 1)[0];
      newOrder.splice(idx, 0, moved);
      newOrder.forEach(function(o, i) {
        _ganttSaveOverride(o.id, 'order', i);
      });
      renderStrategyTabContent();
    });

    // Label cell — this is the drag handle for row reorder
    var labelCell = document.createElement('div');
    labelCell.style.cssText = 'width:' + labelW + 'px;min-width:' + labelW + 'px;display:flex;align-items:center;gap:5px;padding:4px 8px;cursor:grab';
    labelCell.setAttribute('draggable', 'true');
    labelCell.addEventListener('dragstart', function(e) {
      dragState.dragging = idx;
      e.dataTransfer.effectAllowed = 'move';
      row.style.opacity = '0.5';
    });
    labelCell.addEventListener('dragend', function() {
      row.style.opacity = '1';
      dragState.dragging = null;
    });

    // Phase badge
    var phaseBadge = document.createElement('span');
    phaseBadge.style.cssText = 'background:' + (_ganttPhaseColours[item.phase] || 'var(--n2)') + ';color:white;font-size:9px;padding:1px 6px;border-radius:3px;cursor:pointer;flex-shrink:0';
    phaseBadge.textContent = 'P' + item.phase;
    phaseBadge.title = 'Click to change phase';
    (function(it) {
      phaseBadge.onclick = function(e) {
        e.stopPropagation();
        var next = ((it.phase || 0) + 1) % 4;
        _ganttSaveOverride(it.id, 'phase', next);
        renderStrategyTabContent();
      };
    })(item);
    labelCell.appendChild(phaseBadge);

    // Label text
    var labelTxt = document.createElement('span');
    labelTxt.style.cssText = 'font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1';
    labelTxt.textContent = item.label;
    labelTxt.title = item.notes || item.label;
    labelCell.appendChild(labelTxt);

    // Budget % if present
    if (item.budgetPct) {
      var budgetTag = document.createElement('span');
      budgetTag.style.cssText = 'font-size:9px;color:var(--n2);flex-shrink:0';
      budgetTag.textContent = item.budgetPct + '%';
      labelCell.appendChild(budgetTag);
    }

    // Cost badge from engagement_scope
    var _ganttSlug = item._serviceSlug || LEVER_SERVICE_MAP[item.id];
    var _ganttScope = st.engagement_scope;
    if (_ganttSlug && _ganttScope && _ganttScope.services && _ganttScope.services[_ganttSlug]) {
      var _ganttSvc = _ganttScope.services[_ganttSlug];
      // Only show cost on first phase of project services (budgetPct > 0 marks the first)
      var _showCost = item._isProjectPhase ? item.budgetPct > 0 : true;
      if (_ganttSvc.cost && _showCost) {
        var _ganttCostVal = _scopeCostForTier(_ganttSvc.cost, _ganttSvc.scope);
        if (_ganttCostVal > 0) {
          var costTag = document.createElement('span');
          costTag.style.cssText = 'font-size:9px;color:var(--green);flex-shrink:0';
          costTag.textContent = '$' + _ganttCostVal.toLocaleString() + (_ganttSvc.cost.isProject ? '' : '/mo');
          labelCell.appendChild(costTag);
        }
      }
    }

    // Delete button
    var delBtn = document.createElement('span');
    delBtn.style.cssText = 'font-size:12px;color:var(--n3);cursor:pointer;flex-shrink:0;padding:0 2px;opacity:0;transition:opacity .15s';
    delBtn.innerHTML = '<i class="ti ti-x"></i>';
    delBtn.title = 'Remove from timeline';
    (function(it) {
      delBtn.onclick = function(e) {
        e.stopPropagation();
        _ganttDeleteItem(it.id);
      };
    })(item);
    labelCell.appendChild(delBtn);

    // Show delete on hover
    row.addEventListener('mouseenter', function() { delBtn.style.opacity = '1'; });
    row.addEventListener('mouseleave', function() { delBtn.style.opacity = '0'; });

    row.appendChild(labelCell);

    // Chart area
    var chartArea = document.createElement('div');
    chartArea.style.cssText = 'flex:1;position:relative;height:28px';

    // Month grid lines
    for (var g = 0; g < monthCount; g++) {
      var gridLine = document.createElement('div');
      gridLine.style.cssText = 'position:absolute;left:' + (g * 60) + 'px;top:0;bottom:0;width:1px;background:var(--border);opacity:0.4';
      chartArea.appendChild(gridLine);
    }

    // Bar
    var durWeeks = _ganttParseWeeks(item.duration);
    var barLeft = item.startWeek * pxPerWeek;
    var barWidth = Math.max(durWeeks * pxPerWeek, 15);
    var isOngoing = !item.duration || item.duration === 'ongoing';
    var colour = _ganttPhaseColours[item.phase] || 'var(--n2)';

    var bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:4px;height:20px;border-radius:4px;cursor:grab;display:flex;align-items:center;padding:0 6px;font-size:9px;color:white;font-weight:500;white-space:nowrap;overflow:hidden;'
      + 'left:' + barLeft + 'px;width:' + barWidth + 'px;'
      + 'background:' + colour + ';'
      + (isOngoing ? 'background:linear-gradient(90deg,' + colour + ' 80%,transparent);border-right:2px dashed ' + colour + ';' : '');
    bar.textContent = item.duration;
    bar.title = item.label + ': ' + item.duration + (item.notes ? '\n' + item.notes : '') + '\nDrag to move | Double-click to edit';

    // Drag entire bar to move start week
    (function(it, barEl) {
      var isDragging = false;
      barEl.onmousedown = function(e) {
        // Check if clicking near edges for resize
        var rect = barEl.getBoundingClientRect();
        var edgeZone = 8;
        var isLeftEdge = e.clientX - rect.left < edgeZone;
        var isRightEdge = rect.right - e.clientX < edgeZone;

        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        barEl.style.cursor = 'grabbing';
        barEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';

        var startX = e.clientX;
        var origStart = it.startWeek;
        var origDur = _ganttParseWeeks(it.duration);

        var onMove = function(me) {
          var dx = me.clientX - startX;
          var dWeeks = Math.round(dx / pxPerWeek);
          if (isLeftEdge) {
            // Resize from left: move start, shrink/grow duration
            var newStart = Math.max(0, origStart + dWeeks);
            var newDurWeeks = Math.max(1, origDur - (newStart - origStart));
            barEl.style.left = (newStart * pxPerWeek) + 'px';
            barEl.style.width = Math.max(newDurWeeks * pxPerWeek, 15) + 'px';
          } else if (isRightEdge) {
            // Resize from right: change duration
            var newDurWeeks2 = Math.max(1, origDur + dWeeks);
            barEl.style.width = Math.max(newDurWeeks2 * pxPerWeek, 15) + 'px';
          } else {
            // Move entire bar
            var newStart2 = Math.max(0, origStart + dWeeks);
            barEl.style.left = (newStart2 * pxPerWeek) + 'px';
          }
        };

        var onUp = function(ue) {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          barEl.style.cursor = 'grab';
          barEl.style.boxShadow = '';
          isDragging = false;

          var dx = ue.clientX - startX;
          var dWeeks = Math.round(dx / pxPerWeek);
          if (Math.abs(dWeeks) < 1 && !isLeftEdge && !isRightEdge) return; // no meaningful move

          if (isLeftEdge) {
            var newStart = Math.max(0, origStart + dWeeks);
            var newDurWeeks = Math.max(1, origDur - (newStart - origStart));
            _ganttSaveOverride(it.id, 'startWeek', newStart);
            _ganttSaveOverride(it.id, 'duration', newDurWeeks + ' weeks');
          } else if (isRightEdge) {
            var newDurWeeks2 = Math.max(1, origDur + dWeeks);
            _ganttSaveOverride(it.id, 'duration', newDurWeeks2 + ' weeks');
          } else {
            var newStart2 = Math.max(0, origStart + dWeeks);
            _ganttSaveOverride(it.id, 'startWeek', newStart2);
          }
          renderStrategyTabContent();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      };

      // Double-click to open editor
      barEl.ondblclick = function(e) {
        e.stopPropagation();
        _ganttEditItem(it);
      };
    })(item, bar);

    // Cursor hints for resize zones
    bar.onmousemove = function(e) {
      var rect = bar.getBoundingClientRect();
      var edgeZone = 8;
      if (e.clientX - rect.left < edgeZone) bar.style.cursor = 'w-resize';
      else if (rect.right - e.clientX < edgeZone) bar.style.cursor = 'e-resize';
      else bar.style.cursor = 'grab';
    };

    chartArea.appendChild(bar);
    row.appendChild(chartArea);
    wrap.appendChild(row);
  });

  container.appendChild(wrap);

  // Add row button
  var addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;cursor:pointer;color:var(--n2);font-size:11px;border-bottom:1px solid var(--border);transition:color .15s';
  addRow.innerHTML = '<i class="ti ti-plus" style="font-size:13px"></i> Add item';
  addRow.onmouseenter = function() { addRow.style.color = 'var(--dark)'; };
  addRow.onmouseleave = function() { addRow.style.color = 'var(--n2)'; };
  addRow.onclick = function() { _ganttAddItem(); };
  container.appendChild(addRow);

  // Legend
  var legend = document.createElement('div');
  legend.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;padding:6px 0';
  var phaseLabels = ['Phase 0: Foundation', 'Phase 1: Launch', 'Phase 2: Scale', 'Phase 3: Optimise'];
  phaseLabels.forEach(function(lbl, i) {
    var chip = document.createElement('span');
    chip.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px;color:var(--n2)';
    var dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:2px;background:' + _ganttPhaseColours[i];
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(lbl));
    legend.appendChild(chip);
  });
  var hint = document.createElement('span');
  hint.style.cssText = 'font-size:10px;color:var(--n3);margin-left:auto';
  hint.textContent = 'Drag bars to move \u2022 Drag edges to resize \u2022 Double-click to edit \u2022 Drag rows to reorder';
  legend.appendChild(hint);
  container.appendChild(legend);
}

function _ganttEditItem(item) {
  // Inline editor modal
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:600;display:flex;align-items:center;justify-content:center';

  var card = document.createElement('div');
  card.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:20px;width:380px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.15)';

  card.innerHTML = '<div style="font-size:13px;font-weight:600;margin-bottom:14px">' + esc(item.label) + '</div>';

  // Phase selector
  var phaseRow = document.createElement('div');
  phaseRow.style.cssText = 'margin-bottom:10px';
  phaseRow.innerHTML = '<label style="font-size:11px;font-weight:500;color:var(--n2);display:block;margin-bottom:4px">Phase</label>';
  var phaseSelect = document.createElement('select');
  phaseSelect.style.cssText = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg)';
  ['0: Foundation','1: Launch','2: Scale','3: Optimise'].forEach(function(lbl, i) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = lbl;
    if (i === item.phase) opt.selected = true;
    phaseSelect.appendChild(opt);
  });
  phaseRow.appendChild(phaseSelect);
  card.appendChild(phaseRow);

  // Start week
  var startRow = document.createElement('div');
  startRow.style.cssText = 'margin-bottom:10px';
  startRow.innerHTML = '<label style="font-size:11px;font-weight:500;color:var(--n2);display:block;margin-bottom:4px">Start (week)</label>';
  var startInput = document.createElement('input');
  startInput.type = 'number';
  startInput.min = '0';
  startInput.max = '48';
  startInput.value = item.startWeek || 0;
  startInput.style.cssText = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg)';
  startRow.appendChild(startInput);
  card.appendChild(startRow);

  // Duration
  var durRow = document.createElement('div');
  durRow.style.cssText = 'margin-bottom:10px';
  durRow.innerHTML = '<label style="font-size:11px;font-weight:500;color:var(--n2);display:block;margin-bottom:4px">Duration</label>';
  var durInput = document.createElement('input');
  durInput.type = 'text';
  durInput.value = item.duration || '';
  durInput.placeholder = 'e.g. 4 weeks, 2-3 months, ongoing';
  durInput.style.cssText = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg)';
  durRow.appendChild(durInput);
  card.appendChild(durRow);

  // Notes
  var noteRow = document.createElement('div');
  noteRow.style.cssText = 'margin-bottom:14px';
  noteRow.innerHTML = '<label style="font-size:11px;font-weight:500;color:var(--n2);display:block;margin-bottom:4px">Notes</label>';
  var noteInput = document.createElement('textarea');
  noteInput.value = item.notes || '';
  noteInput.rows = 2;
  noteInput.style.cssText = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;background:var(--bg);resize:vertical';
  noteRow.appendChild(noteInput);
  card.appendChild(noteRow);

  // Buttons
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function() { overlay.remove(); };
  btnRow.appendChild(cancelBtn);

  var saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-dark sm';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = function() {
    var newPhase = parseInt(phaseSelect.value, 10);
    var newStart = parseInt(startInput.value, 10) || 0;
    var newDur = durInput.value.trim() || item.duration;
    var newNotes = noteInput.value.trim();

    _ganttSaveOverride(item.id, 'phase', newPhase);
    _ganttSaveOverride(item.id, 'startWeek', newStart);
    _ganttSaveOverride(item.id, 'duration', newDur);
    if (newNotes) _ganttSaveOverride(item.id, 'notes', newNotes);

    overlay.remove();
    renderStrategyTabContent();
  };
  btnRow.appendChild(saveBtn);
  card.appendChild(btnRow);

  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function _renderExecution(st) {
  var ep = st.execution_plan || {};
  var ld = ep.lever_details || {};
  var html = '';

  // CTAs
  html += _stratSection('CTA Architecture',
    _stratField('Primary CTA', ep.primary_cta) +
    _stratField('Secondary CTAs', ep.secondary_ctas) +
    _stratField('Low-Commitment CTA', ep.low_commitment_cta)
  );

  // Lever sub-navigation
  var activeLevers = Object.keys(ld).filter(function(k) { return ld[k] && Object.keys(ld[k]).length > 0; });
  if (activeLevers.length) {
    html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px">';
    activeLevers.forEach(function(lev) {
      var active = _sSubLever === lev;
      html += '<button onclick="_sSubLever=\'' + lev + '\';renderStrategyTabContent()" class="btn ' + (active ? 'btn-dark' : 'btn-ghost') + ' sm">' + esc(lev.replace(/_/g, ' ')) + '</button>';
    });
    html += '</div>';

    // Show selected lever detail
    var sel = _sSubLever && ld[_sSubLever] ? _sSubLever : activeLevers[0];
    if (sel && ld[sel]) {
      _sSubLever = sel;
      var lever = ld[sel];
      html += _stratSection(sel.replace(/_/g, ' ').toUpperCase(),
        Object.keys(lever).map(function(k) {
          if (k === 'confidence') return '';
          var val = lever[k];
          return _stratField(k.replace(/_/g, ' '), val, { textarea: typeof val === 'string' && val.length > 80 });
        }).join('')
      );
    }
  }

  // Offer priority
  if (ep.offer_priority && ep.offer_priority.length) {
    html += _stratSection('Offer Priority',
      ep.offer_priority.map(function(op) {
        return _stratField('#' + op.priority + ': ' + (op.offer || ''), op.rationale || '');
      }).join('')
    );
  }

  return html;
}

function _renderSubtraction(st) {
  var sub = st.subtraction || {};

  // Support both old format (activities_to_cut) and new format (current_activities_audit)
  var audit = sub.current_activities_audit || [];
  // Migrate old format into audit array for display
  if (!audit.length) {
    (sub.activities_to_cut || []).forEach(function(a) {
      audit.push({ activity: a.activity, monthly_cost: 0, monthly_cost_source: a.current_spend || 'unknown', verdict: 'cut', reason: a.reason, confidence: a.confidence || 'medium' });
    });
    (sub.activities_to_restructure || []).forEach(function(a) {
      audit.push({ activity: a.activity, monthly_cost: 0, monthly_cost_source: 'unknown', verdict: 'restructure', reason: a.issue + ' \u2192 ' + a.fix, confidence: 'medium' });
    });
    (sub.activities_to_keep || []).forEach(function(a) {
      audit.push({ activity: a.activity, monthly_cost: 0, monthly_cost_source: 'unknown', verdict: 'keep', reason: a.reason, confidence: 'medium' });
    });
  }

  if (!audit.length) {
    return '<div class="card" style="color:var(--n2);text-align:center"><p>No subtraction data yet. Generate strategy to populate.</p></div>';
  }

  var html = '';

  // Summary
  if (sub.subtraction_summary) {
    html += '<div class="card" style="padding:14px 16px;margin-bottom:14px;border-left:3px solid var(--dark)">';
    html += '<div style="font-size:13px;line-height:1.6;color:var(--dark)">' + esc(sub.subtraction_summary) + '</div>';
    html += '</div>';
  }

  // Activities Audit Table
  html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Current Activities Audit</div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<tr style="border-bottom:1px solid var(--border)">'
    + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Activity</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Monthly Cost</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Verdict</th>'
    + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Reason</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Confidence</th></tr>';

  var verdictColours = { cut: '#f56c6c', keep: 'var(--green)', restructure: '#e6a23c' };
  var verdictIcons = { cut: 'ti-x', keep: 'ti-check', restructure: 'ti-arrows-exchange' };
  audit.forEach(function(a) {
    var vc = verdictColours[a.verdict] || 'var(--n2)';
    html += '<tr style="border-bottom:1px solid var(--border)">';
    html += '<td style="padding:6px 8px;font-weight:500">' + esc(a.activity || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (a.monthly_cost ? '$' + Number(a.monthly_cost).toLocaleString() : '\u2014') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center"><span style="color:' + vc + ';font-weight:600;display:inline-flex;align-items:center;gap:3px">'
      + '<i class="ti ' + (verdictIcons[a.verdict] || '') + '" style="font-size:12px"></i>' + (a.verdict || '').toUpperCase() + '</span></td>';
    html += '<td style="padding:6px 8px;font-size:11px;color:var(--n3)">' + esc(a.reason || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center;font-size:10px;color:var(--n2)">' + esc(a.confidence || '') + '</td>';
    html += '</tr>';
  });
  html += '</table></div>';

  // Recovery Summary
  var totalRecoverable = sub.total_recoverable_monthly || 0;
  if (totalRecoverable || sub.recoverable_budget) {
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Recovery Summary</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">';
    // Recoverable
    html += '<div class="card" style="padding:14px;text-align:center">';
    html += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase;margin-bottom:4px">Recoverable/month</div>';
    html += '<div style="font-size:22px;font-weight:700;color:var(--green)">' + (totalRecoverable ? '$' + Number(totalRecoverable).toLocaleString() : esc(sub.recoverable_budget || '\u2014')) + '</div>';
    html += '</div>';
    // Confidence
    html += '<div class="card" style="padding:14px;text-align:center">';
    html += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase;margin-bottom:4px">Confidence</div>';
    html += '<div style="font-size:22px;font-weight:700;color:var(--dark)">' + esc(sub.total_recoverable_confidence || sub.confidence || '\u2014') + '</div>';
    html += '</div>';
    // Activities to cut
    var cutCount = audit.filter(function(a) { return a.verdict === 'cut'; }).length;
    var restructureCount = audit.filter(function(a) { return a.verdict === 'restructure'; }).length;
    html += '<div class="card" style="padding:14px;text-align:center">';
    html += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase;margin-bottom:4px">Actions</div>';
    html += '<div style="font-size:14px;font-weight:600"><span style="color:#f56c6c">' + cutCount + ' cut</span> &middot; <span style="color:#e6a23c">' + restructureCount + ' restructure</span></div>';
    html += '</div>';
    html += '</div></div>';
  }

  // Redirect Recommendations
  var redirects = sub.redirect_recommendations || [];
  if (redirects.length) {
    html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Redirect Recommendations</div>';
    html += '<div style="display:grid;gap:8px">';
    redirects.forEach(function(rd) {
      html += '<div class="card" style="padding:12px 14px">';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
      html += '<span style="font-size:12px;font-weight:500;color:#f56c6c;text-decoration:line-through">' + esc(rd.from || '') + '</span>';
      html += '<i class="ti ti-arrow-right" style="color:var(--n2)"></i>';
      html += '<span style="font-size:12px;font-weight:500;color:var(--green)">' + esc(rd.to || '') + '</span>';
      html += '</div>';
      html += '<div style="font-size:11px;color:var(--n3)">' + esc(rd.rationale || '') + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // Assumptions
  var assumptions = sub.recovery_assumptions || [];
  if (assumptions.length) {
    html += _stratSection('Assumptions',
      '<div style="grid-column:1/-1"><ul style="margin:0;padding-left:16px;font-size:12px;color:var(--n3)">'
      + assumptions.map(function(a) { return '<li style="margin-bottom:3px">' + esc(a) + '</li>'; }).join('')
      + '</ul></div>'
    );
  }

  // Legacy format: redirect_recommendation (string)
  if (!redirects.length && sub.redirect_recommendation) {
    html += _stratSection('Redirect Recommendation', _stratField('Recommendation', sub.redirect_recommendation, {span:true}));
  }

  return html;
}

function _renderBrand(st) {
  var bs = st.brand_strategy || {};
  // Also pull content data from execution_plan.lever_details.content_marketing
  var cm = (st.execution_plan && st.execution_plan.lever_details) ? st.execution_plan.lever_details.content_marketing || {} : {};

  if (!bs.brand_work_needed && !bs.voice_direction && !bs.dr_gap_analysis && !cm.content_pillars) {
    return '<div class="card" style="color:var(--n2);text-align:center"><p>No brand/content data yet. Generate strategy to populate.</p></div>';
  }

  var html2 = '';

  // Brand Assessment
  if (bs.brand_work_needed) {
    html2 += _stratSection('Brand Assessment',
      _stratField('Brand Work Needed', bs.brand_work_needed) +
      _stratField('Rationale', bs.rationale, {textarea:true}) +
      _stratField('Brand as Bottleneck', bs.brand_as_bottleneck)
    );
  }

  // Voice Direction
  if (bs.voice_direction) {
    html2 += _stratSection('Voice Direction',
      _stratField('Style', bs.voice_direction.style) +
      _stratField('Tone', bs.voice_direction.tone_detail) +
      _stratField('Words to Use', bs.voice_direction.words_to_use) +
      _stratField('Words to Avoid', bs.voice_direction.words_to_avoid)
    );
  }

  // Design Direction
  if (bs.design_direction) {
    html2 += _stratSection('Design Direction',
      Object.keys(bs.design_direction).map(function(k) {
        return _stratField(k.replace(/_/g, ' '), bs.design_direction[k]);
      }).join('')
    );
  }

  // ── 3a. Domain Authority Gap Analysis ──
  var drGap = bs.dr_gap_analysis || cm.dr_gap_analysis;
  if (drGap) {
    html2 += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Domain Authority Gap</div>';
    html2 += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';

    // Left: Client DR with progress bar
    var clientDR = drGap.client_dr || 0;
    var targetDR = drGap.realistic_dr_target_12mo || 0;
    var maxDR = Math.max(targetDR, 100);
    html2 += '<div>';
    html2 += '<div style="text-align:center;margin-bottom:8px">';
    html2 += '<div style="font-size:28px;font-weight:700;color:var(--dark)">' + clientDR + '</div>';
    html2 += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase">Client DR</div>';
    if (drGap.client_dr_source) html2 += '<div style="font-size:9px;color:var(--n2);margin-top:2px">' + esc(drGap.client_dr_source) + '</div>';
    html2 += '</div>';
    if (targetDR) {
      html2 += '<div style="margin-top:8px">';
      html2 += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--n2);margin-bottom:3px"><span>Current: ' + clientDR + '</span><span>12-mo target: ' + targetDR + '</span></div>';
      html2 += '<div style="height:8px;background:var(--panel);border-radius:4px;overflow:hidden">';
      html2 += '<div style="height:100%;width:' + Math.round((clientDR / maxDR) * 100) + '%;background:var(--green);border-radius:4px;position:relative">';
      html2 += '</div></div>';
      html2 += '</div>';
    }
    if (drGap.dr_gap) html2 += '<div style="font-size:11px;color:#e6a23c;margin-top:6px">' + esc(drGap.dr_gap) + '</div>';
    html2 += '</div>';

    // Right: Competitor DR bars
    html2 += '<div>';
    var compDRs = drGap.competitor_drs || [];
    if (compDRs.length) {
      var maxCompDR = Math.max.apply(null, compDRs.map(function(c) { return c.dr || 0; }).concat([clientDR]));
      compDRs.sort(function(a, b) { return (b.dr || 0) - (a.dr || 0); });
      compDRs.forEach(function(c) {
        var pct = maxCompDR > 0 ? Math.round(((c.dr || 0) / maxCompDR) * 100) : 0;
        html2 += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
        html2 += '<span style="font-size:11px;width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--n3)">' + esc(c.name || '') + '</span>';
        html2 += '<div style="flex:1;height:6px;background:var(--panel);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:var(--n3);border-radius:3px"></div></div>';
        html2 += '<span style="font-size:11px;font-weight:600;width:28px;text-align:right">' + (c.dr || 0) + '</span>';
        html2 += '</div>';
      });
      // Client bar for comparison
      var clientPct = maxCompDR > 0 ? Math.round((clientDR / maxCompDR) * 100) : 0;
      html2 += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">';
      html2 += '<span style="font-size:11px;width:100px;font-weight:600;color:var(--dark)">You</span>';
      html2 += '<div style="flex:1;height:6px;background:var(--panel);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + clientPct + '%;background:var(--green);border-radius:3px"></div></div>';
      html2 += '<span style="font-size:11px;font-weight:600;width:28px;text-align:right;color:var(--green)">' + clientDR + '</span>';
      html2 += '</div>';
    }
    html2 += '</div>';
    html2 += '</div>';

    // DR strategy
    if (drGap.dr_growth_strategy) html2 += _stratField('DR Growth Strategy', drGap.dr_growth_strategy, {span:true, textarea:true});
    if (drGap.backlink_gap_summary) html2 += _stratField('Backlink Gap', drGap.backlink_gap_summary, {span:true});
    html2 += '</div>';
  }

  // ── 3b. Content Velocity & Mix ──
  var contentPillars = bs.content_pillars || cm.content_pillars;
  var contentVelocity = bs.content_velocity || cm.content_velocity;
  var contentMix = bs.content_mix || cm.content_mix;
  if (contentPillars || contentVelocity) {
    html2 += _stratSection('Content Strategy',
      _stratField('Content Pillars', contentPillars) +
      _stratField('Velocity', contentVelocity) +
      _stratField('Preferred Formats', cm.preferred_formats)
    );
  }

  if (contentMix && contentMix.length) {
    html2 += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Content Mix</div>';
    html2 += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html2 += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Type</th>'
      + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Monthly</th>'
      + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Purpose</th></tr>';
    contentMix.forEach(function(item) {
      html2 += '<tr style="border-bottom:1px solid var(--border)">';
      html2 += '<td style="padding:6px 8px;font-weight:500">' + esc(item.type || '') + '</td>';
      html2 += '<td style="padding:6px 4px;text-align:center;font-weight:600">' + (item.monthly || 0) + '</td>';
      html2 += '<td style="padding:6px 8px;font-size:11px;color:var(--n3)">' + esc(item.purpose || '') + '</td>';
      html2 += '</tr>';
    });
    html2 += '</table></div>';
  }

  // Team capacity
  var teamCheck = bs.team_capacity_check || cm.team_capacity_check;
  var teamNeeded = bs.team_size_input_needed || cm.team_size_input_needed;
  if (teamCheck) {
    var teamColour = teamNeeded ? '#e6a23c' : 'var(--green)';
    html2 += '<div class="card" style="padding:10px 14px;margin-bottom:14px;border-left:3px solid ' + teamColour + ';font-size:12px;color:var(--n3)">';
    if (teamNeeded) html2 += '<span style="color:#e6a23c;font-weight:500"><i class="ti ti-alert-triangle" style="font-size:12px"></i> Team size unknown</span> \u2014 ';
    html2 += esc(teamCheck);
    html2 += '</div>';
  }

  // ── 3c. Authority Building Timeline ──
  var timeline = bs.authority_timeline || cm.authority_timeline;
  if (timeline && timeline.length) {
    html2 += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Authority Building Timeline</div>';
    var phaseColours = ['#e6a23c', '#409eff', 'var(--green)'];
    timeline.forEach(function(phase, idx) {
      html2 += '<div class="card" style="padding:12px 14px;margin-bottom:8px;border-left:3px solid ' + (phaseColours[idx] || 'var(--n2)') + '">';
      html2 += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
      html2 += '<span style="font-size:12px;font-weight:600;color:var(--dark)">' + esc(phase.phase || '') + '</span>';
      if (phase.expected_dr_gain) html2 += '<span style="font-size:10px;color:var(--green);font-weight:500">' + esc(phase.expected_dr_gain) + '</span>';
      html2 += '</div>';
      if (phase.milestones && phase.milestones.length) {
        html2 += '<ul style="margin:0 0 6px;padding-left:16px;font-size:11px;color:var(--n3)">';
        phase.milestones.forEach(function(m) { html2 += '<li style="margin-bottom:2px">' + esc(m) + '</li>'; });
        html2 += '</ul>';
      }
      if (phase.measurement) html2 += '<div style="font-size:10px;color:var(--n2)"><i class="ti ti-chart-bar" style="font-size:10px"></i> ' + esc(phase.measurement) + '</div>';
      html2 += '</div>';
    });
    html2 += '</div>';
  }

  // ── 3d. Quick Wins ──
  var quickWins = bs.quick_wins || cm.quick_wins;
  if (quickWins && quickWins.length) {
    html2 += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Quick Wins</div>';
    html2 += '<div style="display:grid;gap:8px">';
    var effortColours = { Low: 'var(--green)', Medium: '#e6a23c', High: '#f56c6c' };
    quickWins.forEach(function(qw) {
      html2 += '<div class="card" style="padding:10px 14px">';
      html2 += '<div style="font-size:12px;font-weight:500;color:var(--dark);margin-bottom:4px">' + esc(qw.opportunity || '') + '</div>';
      html2 += '<div style="display:flex;gap:8px;font-size:10px">';
      var ec = effortColours[qw.effort] || 'var(--n2)';
      html2 += '<span style="background:' + ec + ';color:white;padding:1px 6px;border-radius:3px">' + esc(qw.effort || '') + '</span>';
      html2 += '<span style="color:var(--n2)">' + esc(qw.timeline || '') + '</span>';
      html2 += '</div>';
      if (qw.expected_impact) html2 += '<div style="font-size:11px;color:var(--n3);margin-top:4px">' + esc(qw.expected_impact) + '</div>';
      html2 += '</div>';
    });
    html2 += '</div></div>';
  }

  // Authority building strategy (legacy text field)
  if (cm.authority_building && !timeline) {
    html2 += _stratSection('Authority Building', _stratField('Strategy', cm.authority_building, {span:true, textarea:true}));
  }

  // Local SEO
  if (cm.local_seo_priority || cm.geo_targeting_strategy) {
    html2 += _stratSection('Local & Geo Strategy',
      _stratField('Local SEO Priority', cm.local_seo_priority) +
      _stratField('Geo-Targeting Strategy', cm.geo_targeting_strategy, {textarea:true})
    );
  }

  return html2;
}

function _renderRisks(st) {
  var ri = st.risks || {};
  if (!ri.risks || !ri.risks.length) {
    return '<div class="card" style="color:var(--n2);text-align:center"><p>No risk data yet. Generate strategy to populate.</p></div>';
  }
  var html = '';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px">';
  html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Risk</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Severity</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Likelihood</th>'
    + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Impact</th>'
    + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Mitigation</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Owner</th></tr>';
  ri.risks.forEach(function(risk) {
    var sev = risk.severity || 0;
    var sc = sev >= 7 ? '#f56c6c' : sev >= 4 ? '#e6a23c' : 'var(--green)';
    html += '<tr style="border-bottom:1px solid var(--border)">';
    html += '<td style="padding:6px 8px;font-weight:500">' + esc((risk.risk || '').replace(/_/g, ' ')) + '</td>';
    html += '<td style="padding:6px 4px;text-align:center;color:' + sc + ';font-weight:600">' + sev + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (risk.likelihood || 0) + '</td>';
    html += '<td style="padding:6px 8px;font-size:11px">' + esc(risk.impact || '') + '</td>';
    html += '<td style="padding:6px 8px;font-size:11px">' + esc(risk.mitigation || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center;font-size:11px">' + esc(risk.owner || '') + '</td>';
    html += '</tr>';
  });
  html += '</table>';
  if (ri.overall_confidence) {
    html += _stratField('Overall Confidence', ri.overall_confidence);
    html += _stratField('Reasoning', ri.confidence_reasoning, {textarea:true});
  }
  return html;
}

// ── Narrative & Messaging Renderer ─────────────────────────────────────

function _renderNarrative(st) {
  var n = st.narrative || {};
  if (!n.storybrand && !n.messaging_pillars) {
    return '<div style="padding:40px;text-align:center;color:var(--n2)"><i class="ti ti-message-2" style="font-size:32px;display:block;margin-bottom:12px;opacity:0.3"></i><div style="font-size:13px">Run D8 Narrative & Messaging diagnostic to generate StoryBrand arc, messaging pillars, objection map, content hooks, and VoC swipe file.</div></div>';
  }
  var html = '';
  // StoryBrand Arc
  if (n.storybrand) {
    var sb = n.storybrand;
    html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:12px">StoryBrand Arc</div>';
    var steps = [
      { label: 'Hero', value: sb.hero, colour: '#3b82f6' },
      { label: 'External Problem', value: sb.external_problem, colour: '#dc2626' },
      { label: 'Internal Problem', value: sb.internal_problem, colour: '#f59e0b' },
      { label: 'Philosophical Problem', value: sb.philosophical_problem, colour: '#8b5cf6' },
      { label: 'Guide \u2014 Empathy', value: sb.guide_empathy, colour: '#10b981' },
      { label: 'Guide \u2014 Authority', value: sb.guide_authority, colour: '#10b981' },
      { label: 'Plan', value: (sb.plan || []).join(' \u2192 '), colour: '#0d9488' },
      { label: 'Direct CTA', value: sb.direct_cta, colour: '#dc2626' },
      { label: 'Transitional CTA', value: sb.transitional_cta, colour: '#f59e0b' },
      { label: 'Failure (Stakes)', value: sb.failure_stakes, colour: '#dc2626' },
      { label: 'Success (Transformation)', value: sb.success_transformation, colour: '#10b981' }
    ];
    steps.forEach(function(s) {
      if (!s.value) return;
      html += '<div style="display:flex;gap:10px;margin-bottom:8px;align-items:start">';
      html += '<div style="min-width:140px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:' + s.colour + ';padding-top:2px;font-weight:500">' + s.label + '</div>';
      html += '<div style="font-size:12.5px;color:var(--dark);line-height:1.5">' + esc(s.value) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  // Messaging Pillars
  if (n.messaging_pillars && n.messaging_pillars.length) {
    html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:12px">Messaging Pillars (ranked)</div>';
    n.messaging_pillars.forEach(function(p, i) {
      html += '<div style="background:rgba(0,0,0,0.02);border:1px solid var(--border);border-radius:6px;padding:10px 14px;margin-bottom:8px">';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
      html += '<span style="background:var(--green);color:#fff;font-size:10px;padding:2px 7px;border-radius:3px;font-weight:600">#' + (p.rank || i + 1) + '</span>';
      html += '<span style="font-size:13px;font-weight:500;color:var(--dark)">' + esc(p.pillar || '') + '</span>';
      html += '</div>';
      if (p.evidence && p.evidence.length) {
        html += '<div style="margin-bottom:4px">';
        p.evidence.forEach(function(e) { html += '<div style="font-size:11.5px;color:var(--n3);padding-left:12px">\u2022 ' + esc(e) + '</div>'; });
        html += '</div>';
      }
      if (p.resonance_quotes && p.resonance_quotes.length) {
        p.resonance_quotes.forEach(function(q) { html += '<div style="font-size:11px;color:#7c3aed;font-style:italic;padding-left:12px;margin-top:2px">\u201c' + esc(q) + '\u201d</div>'; });
      }
      if (p.page_types && p.page_types.length) {
        html += '<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">';
        p.page_types.forEach(function(pt) { html += '<span style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:3px;font-size:9px;padding:1px 5px;color:#3b82f6">' + esc(pt) + '</span>'; });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  }
  // Objection Map
  if (n.objection_map && n.objection_map.length) {
    html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:12px">Objection Map</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 70px 80px 60px;gap:0;border:1px solid var(--border);border-radius:6px;overflow:hidden">';
    html += '<div style="display:contents;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);background:var(--bg)">';
    ['Objection','Rebuttal','Proof','Type','Priority'].forEach(function(h) { html += '<div style="padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border)">' + h + '</div>'; });
    html += '</div>';
    n.objection_map.forEach(function(o) {
      html += '<div style="padding:7px 10px;font-size:12px;color:var(--dark);border-bottom:1px solid var(--border)">' + esc(o.objection || '') + '</div>';
      html += '<div style="padding:7px 10px;font-size:12px;color:var(--n3);border-bottom:1px solid var(--border)">' + esc(o.rebuttal || '') + '</div>';
      html += '<div style="padding:7px 10px;font-size:11px;border-bottom:1px solid var(--border);text-align:center">' + (o.proof_available ? '<span style="color:var(--green)">\u2713</span>' : '<span style="color:var(--n2)">\u2717</span>') + '</div>';
      html += '<div style="padding:7px 10px;font-size:10px;color:var(--n2);border-bottom:1px solid var(--border)">' + esc(o.proof_type || '') + '</div>';
      var priCol = o.priority === 'high' ? 'var(--error)' : o.priority === 'medium' ? 'var(--warn)' : 'var(--n2)';
      html += '<div style="padding:7px 10px;font-size:10px;color:' + priCol + ';font-weight:500;border-bottom:1px solid var(--border)">' + esc(o.priority || '') + '</div>';
    });
    html += '</div></div>';
  }
  // Content Hooks by Awareness Stage
  if (n.content_hooks) {
    html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:12px">Content Hooks by Awareness Stage</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">';
    var stages = [
      { key:'unaware', label:'Unaware', colour:'#6b7280' },
      { key:'problem_aware', label:'Problem Aware', colour:'#dc2626' },
      { key:'solution_aware', label:'Solution Aware', colour:'#f59e0b' },
      { key:'product_aware', label:'Product Aware', colour:'#3b82f6' },
      { key:'most_aware', label:'Most Aware', colour:'#10b981' }
    ];
    stages.forEach(function(stg) {
      html += '<div style="background:rgba(0,0,0,0.02);border:1px solid var(--border);border-radius:6px;padding:8px 10px">';
      html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:' + stg.colour + ';margin-bottom:6px;font-weight:500">' + stg.label + '</div>';
      var hooks = (n.content_hooks[stg.key] || []);
      if (hooks.length) {
        hooks.forEach(function(h) { html += '<div style="font-size:11px;color:var(--dark);margin-bottom:4px;line-height:1.4">\u2022 ' + esc(h) + '</div>'; });
      } else {
        html += '<div style="font-size:11px;color:var(--n2);font-style:italic">\u2014</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
  }
  // VoC Swipe File
  if (n.voc_swipe_file && n.voc_swipe_file.length) {
    html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:12px">Voice of Customer Swipe File</div>';
    n.voc_swipe_file.forEach(function(v) {
      var regCol = v.emotional_register === 'frustration' ? '#dc2626' : v.emotional_register === 'aspiration' ? '#10b981' : v.emotional_register === 'urgency' ? '#f59e0b' : v.emotional_register === 'trust' ? '#3b82f6' : v.emotional_register === 'skepticism' ? '#8b5cf6' : v.emotional_register === 'relief' ? '#0d9488' : 'var(--n2)';
      html += '<div style="display:flex;gap:8px;align-items:start;margin-bottom:6px;padding:6px 10px;background:rgba(0,0,0,0.015);border-radius:4px">';
      html += '<div style="flex:1;font-size:12px;color:var(--dark);font-style:italic;line-height:1.5">\u201c' + esc(v.quote || '') + '\u201d</div>';
      html += '<span style="background:' + regCol + '15;border:1px solid ' + regCol + '30;border-radius:3px;font-size:9px;padding:1px 5px;color:' + regCol + ';white-space:nowrap">' + esc(v.emotional_register || '') + '</span>';
      html += '<span style="background:rgba(0,0,0,0.04);border:1px solid var(--border);border-radius:3px;font-size:9px;padding:1px 5px;color:var(--n2);white-space:nowrap">' + esc(v.usage || '') + '</span>';
      html += '</div>';
    });
    html += '</div>';
  }
  // Strategic Recommendations
  html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:12px">Strategic Recommendations</div>';
  if (n.recommended_entry_point) html += '<div style="margin-bottom:6px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-right:8px">Entry Point</span><span style="font-size:12.5px;color:var(--dark)">' + esc(n.recommended_entry_point) + '</span></div>';
  if (n.call_shape) html += '<div style="margin-bottom:6px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-right:8px">Call Shape</span><span style="font-size:12.5px;color:var(--dark)">' + esc(n.call_shape) + '</span></div>';
  if (n.confidence !== undefined) html += '<div><span style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-right:8px">Confidence</span><span style="font-size:12.5px;font-weight:500;color:' + (n.confidence >= 7 ? 'var(--green)' : n.confidence >= 4 ? 'var(--warn)' : 'var(--error)') + '">' + n.confidence + '/10</span></div>';
  html += '</div>';
  return html;
}

// ── Sales Intelligence Renderer ────────────────────────────────────────

function _renderSalesIntel(st) {
  var si = st.sales_intel || {};
  if (!si.sales_storybrand && !si.sales_pillars) {
    return '<div style="padding:48px 32px;text-align:center;border:2px dashed var(--border);border-radius:12px;background:rgba(0,0,0,0.01)">'
      + '<i class="ti ti-briefcase" style="font-size:40px;display:block;margin-bottom:16px;color:var(--green);opacity:0.4"></i>'
      + '<div style="font-size:15px;font-weight:500;color:var(--dark);margin-bottom:8px">Sales Intelligence Not Generated Yet</div>'
      + '<div style="font-size:12.5px;color:var(--n2);max-width:420px;margin:0 auto 20px;line-height:1.5">Run D9 to generate the pitch framework, sales StoryBrand, objection cheat sheet, deal stage talk tracks, and proposal data for this client.</div>'
      + '<button class="btn btn-primary sm" onclick="runDiagnostic(9).then(function(){renderStrategyTabContent();})" style="font-size:12px;padding:8px 20px"><i class="ti ti-sparkles" style="margin-right:6px"></i>Generate Sales Intelligence</button>'
      + '</div>';
  }
  var html = '';

  // Pitch Angle (hero banner)
  if (si.pitch_angle) {
    html += '<div style="background:linear-gradient(135deg,rgba(21,142,29,0.08),rgba(59,130,246,0.08));border:2px solid var(--green);border-radius:10px;padding:16px 20px;margin-bottom:16px">';
    html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--green);margin-bottom:6px;font-weight:600">Pitch Angle</div>';
    html += '<div style="font-size:15px;color:var(--dark);font-weight:500;line-height:1.5">' + esc(si.pitch_angle) + '</div>';
    html += '</div>';
  }

  // Why Now + Why Setsail side by side
  if (si.why_now || si.why_setsail) {
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">';
    if (si.why_now) {
      html += '<div class="card"><div class="eyebrow" style="margin-bottom:8px;color:#dc2626">Why Now</div>';
      html += '<div style="font-size:12.5px;color:var(--dark);line-height:1.5">' + esc(si.why_now) + '</div></div>';
    }
    if (si.why_setsail) {
      html += '<div class="card"><div class="eyebrow" style="margin-bottom:8px;color:var(--green)">Why Setsail</div>';
      html += '<div style="font-size:12.5px;color:var(--dark);line-height:1.5">' + esc(si.why_setsail) + '</div></div>';
    }
    html += '</div>';
  }

  // Sales StoryBrand Arc
  if (si.sales_storybrand) {
    var sb = si.sales_storybrand;
    html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:12px">Sales StoryBrand Arc <span style="font-size:9px;opacity:0.6;text-transform:none;letter-spacing:0">(Hero = the client, Guide = Setsail)</span></div>';
    var steps = [
      { label: 'Hero (Client)', value: sb.hero, colour: '#3b82f6' },
      { label: 'External Problem', value: sb.external_problem, colour: '#dc2626' },
      { label: 'Internal Problem', value: sb.internal_problem, colour: '#f59e0b' },
      { label: 'Philosophical Problem', value: sb.philosophical_problem, colour: '#8b5cf6' },
      { label: 'Guide \u2014 Empathy', value: sb.guide_empathy, colour: '#10b981' },
      { label: 'Guide \u2014 Authority', value: sb.guide_authority, colour: '#10b981' },
      { label: 'Plan', value: (sb.plan || []).join(' \u2192 '), colour: '#0d9488' },
      { label: 'Direct CTA', value: sb.direct_cta, colour: '#dc2626' },
      { label: 'Transitional CTA', value: sb.transitional_cta, colour: '#f59e0b' },
      { label: 'Failure (Stakes)', value: sb.failure_stakes, colour: '#dc2626' },
      { label: 'Success', value: sb.success_transformation, colour: '#10b981' }
    ];
    steps.forEach(function(s) {
      if (!s.value) return;
      html += '<div style="display:flex;gap:10px;margin-bottom:8px;align-items:start">';
      html += '<div style="min-width:150px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:' + s.colour + ';padding-top:2px;font-weight:500">' + s.label + '</div>';
      html += '<div style="font-size:12.5px;color:var(--dark);line-height:1.5">' + esc(s.value) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Sales Pillars
  if (si.sales_pillars && si.sales_pillars.length) {
    html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:12px">Sales Pillars (ranked)</div>';
    si.sales_pillars.forEach(function(p, i) {
      html += '<div style="background:rgba(0,0,0,0.02);border:1px solid var(--border);border-radius:6px;padding:10px 14px;margin-bottom:8px">';
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
      html += '<span style="background:var(--green);color:#fff;font-size:10px;padding:2px 7px;border-radius:3px;font-weight:600">#' + (p.rank || i + 1) + '</span>';
      html += '<span style="font-size:13px;font-weight:500;color:var(--dark)">' + esc(p.pillar || '') + '</span>';
      if (p.when_to_use) html += '<span style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:3px;font-size:9px;padding:1px 5px;color:#3b82f6;margin-left:auto">' + esc(p.when_to_use) + '</span>';
      html += '</div>';
      if (p.evidence && p.evidence.length) {
        html += '<div style="margin-bottom:4px">';
        p.evidence.forEach(function(e) { html += '<div style="font-size:11.5px;color:var(--n3);padding-left:12px">\u2022 ' + esc(e) + '</div>'; });
        html += '</div>';
      }
      if (p.resonance_quotes && p.resonance_quotes.length) {
        p.resonance_quotes.forEach(function(q) { html += '<div style="font-size:11px;color:#7c3aed;font-style:italic;padding-left:12px;margin-top:2px">\u201c' + esc(q) + '\u201d</div>'; });
      }
      html += '</div>';
    });
    html += '</div>';
  }

  // Sales Objection Map
  if (si.sales_objection_map && si.sales_objection_map.length) {
    html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:12px">Objection Cheat Sheet</div>';
    si.sales_objection_map.forEach(function(o) {
      var priCol = o.when_likely === 'negotiation' ? 'var(--error)' : o.when_likely === 'proposal' ? 'var(--warn)' : 'var(--n2)';
      html += '<div style="background:rgba(0,0,0,0.015);border:1px solid var(--border);border-radius:6px;padding:10px 14px;margin-bottom:6px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px">';
      html += '<div style="font-size:12.5px;color:var(--dark);font-weight:500">\u201c' + esc(o.objection || '') + '\u201d</div>';
      html += '<span style="font-size:9px;padding:1px 6px;border-radius:3px;color:' + priCol + ';border:1px solid;white-space:nowrap">' + esc(o.when_likely || '') + '</span>';
      html += '</div>';
      html += '<div style="font-size:12px;color:var(--n3);margin-bottom:4px">\u2192 ' + esc(o.rebuttal || '') + '</div>';
      if (o.data_point) html += '<div style="font-size:11px;color:var(--green);font-weight:500">\ud83d\udcca ' + esc(o.data_point) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Deal Stage Hooks
  if (si.deal_stage_hooks) {
    html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:12px">Deal Stage Talk Tracks</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">';
    var dealStages = [
      { key:'cold_outreach', label:'Cold Outreach', colour:'#6b7280', icon:'ti-mail' },
      { key:'discovery', label:'Discovery', colour:'#3b82f6', icon:'ti-search' },
      { key:'proposal', label:'Proposal', colour:'#f59e0b', icon:'ti-file-text' },
      { key:'follow_up', label:'Follow-Up', colour:'#8b5cf6', icon:'ti-repeat' },
      { key:'close', label:'Close', colour:'#10b981', icon:'ti-check' }
    ];
    dealStages.forEach(function(stg) {
      html += '<div style="background:rgba(0,0,0,0.02);border:1px solid var(--border);border-radius:6px;padding:8px 10px">';
      html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:' + stg.colour + ';margin-bottom:6px;font-weight:500;display:flex;align-items:center;gap:4px"><i class="' + stg.icon + '" style="font-size:11px"></i>' + stg.label + '</div>';
      var hooks = (si.deal_stage_hooks[stg.key] || []);
      if (hooks.length) {
        hooks.forEach(function(h) { html += '<div style="font-size:11px;color:var(--dark);margin-bottom:4px;line-height:1.4">\u2022 ' + esc(h) + '</div>'; });
      } else {
        html += '<div style="font-size:11px;color:var(--n2);font-style:italic">\u2014</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';
  }

  // Discovery Gaps
  if (si.discovery_gaps && si.discovery_gaps.length) {
    html += '<div class="card" style="margin-bottom:14px"><div class="eyebrow" style="margin-bottom:8px;color:#f59e0b">Discovery Gaps \u2014 What We Still Need to Learn</div>';
    si.discovery_gaps.forEach(function(g) { html += '<div style="font-size:12px;color:var(--dark);margin-bottom:4px">\u26a0 ' + esc(g) + '</div>'; });
    html += '</div>';
  }

  // Confidence
  if (si.confidence !== undefined) {
    html += '<div style="text-align:right;font-size:11px;color:var(--n2)">Confidence: <span style="font-weight:500;color:' + (si.confidence >= 7 ? 'var(--green)' : si.confidence >= 4 ? 'var(--warn)' : 'var(--error)') + '">' + si.confidence + '/10</span></div>';
  }

  return html;
}

// ── Audit Panel (shown per tab) ────────────────────────────────────────

function _renderStrategyAuditPanel(diagNum) {
  var audit = (S.strategy && S.strategy._audit) ? S.strategy._audit[diagNum] : null;
  if (!audit || !audit.items) return '';

  var passRate = audit.total > 0 ? Math.round((audit.pass / audit.total) * 100) : 0;
  var colour = passRate >= 80 ? 'var(--green)' : passRate >= 50 ? '#e6a23c' : '#f56c6c';

  var html = '<div class="card" style="margin-bottom:14px;padding:12px 16px;border-left:3px solid ' + colour + '">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  html += '<div style="font-size:12px;font-weight:500">Quality Audit</div>';
  html += '<div style="font-size:11px;color:' + colour + ';font-weight:600">' + audit.pass + '/' + audit.total + ' passed (' + passRate + '%)</div>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px">';
  audit.items.forEach(function(item) {
    var icon = item.passed
      ? '<i class="ti ti-circle-check-filled" style="color:var(--green);font-size:14px"></i>'
      : '<i class="ti ti-circle-x-filled" style="color:#f56c6c;font-size:14px"></i>';
    html += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px">';
    html += icon + '<span style="color:' + (item.passed ? 'var(--n3)' : 'var(--dark)') + '">' + esc(item.label) + '</span>';
    html += '</div>';
  });
  html += '</div></div>';

  return html;
}

// ── Revenue Projection & Data Tables ─────────────────────────────────

function _buildRevenueProjection() {
  var st = S.strategy || {};
  var ue = st.unit_economics || {};
  if (!ue.max_allowable_cpl && !ue.estimated_market_cpl) return '';

  var cpl = parseFloat(ue.estimated_market_cpl) || parseFloat(ue.max_allowable_cpl) || 0;
  var cac = parseFloat(ue.estimated_cac) || cpl * 3;
  var ltv = parseFloat(ue.ltv) || 0;
  var closeRate = parseFloat(ue.close_rate) || 0.25;
  var dealSize = parseFloat(ue.avg_deal_size) || ltv * 0.3 || 0;
  var s = S.setup || {};
  var monthlyBudget = 0;
  var ba = (st.channel_strategy && st.channel_strategy.budget_allocation) || {};
  if (ba.total_monthly) monthlyBudget = parseFloat(ba.total_monthly);
  if (!monthlyBudget && s.estimated_engagement_size) monthlyBudget = parseFloat(s.estimated_engagement_size) || 0;

  if (!cpl || !monthlyBudget) return '';

  var leadsPerMonth = Math.round(monthlyBudget / cpl);
  var dealsPerMonth = Math.round(leadsPerMonth * closeRate * 10) / 10;
  var monthlyRevenue = Math.round(dealsPerMonth * dealSize);
  var roi = monthlyBudget > 0 ? Math.round((monthlyRevenue / monthlyBudget) * 100) / 100 : 0;

  var proj = '- Monthly marketing budget: $' + monthlyBudget.toLocaleString() + '\n';
  proj += '- Estimated CPL: $' + cpl + '\n';
  proj += '- Leads per month: ~' + leadsPerMonth + '\n';
  proj += '- Close rate: ' + Math.round(closeRate * 100) + '%\n';
  proj += '- Deals per month: ~' + dealsPerMonth + '\n';
  proj += '- Average deal size: $' + dealSize.toLocaleString() + '\n';
  proj += '- Projected monthly revenue: $' + monthlyRevenue.toLocaleString() + '\n';
  proj += '- ROI: ' + roi + 'x ($' + monthlyRevenue.toLocaleString() + ' revenue on $' + monthlyBudget.toLocaleString() + ' spend)\n';
  if (ltv) proj += '- Customer LTV: $' + ltv.toLocaleString() + '\n';
  if (ue.ltv_cac_ratio) proj += '- LTV:CAC ratio: ' + ue.ltv_cac_ratio + ' (' + (ue.ltv_cac_health || '') + ')\n';

  // Sensitivity
  if (ue.sensitivity_analysis) {
    var sa = ue.sensitivity_analysis;
    proj += '- Sensitivity (conservative): CPL $' + (sa.conservative_cpl || '?') + ', LTV:CAC ' + (sa.conservative_ltv_cac || '?') + '\n';
    proj += '- Sensitivity (optimistic): CPL $' + (sa.optimistic_cpl || '?') + ', LTV:CAC ' + (sa.optimistic_ltv_cac || '?') + '\n';
  }

  return proj;
}

function _buildStrategyDataTables() {
  var md = '';
  var st = S.strategy || {};
  var kwR = S.kwResearch || {};

  // ── Appendix A: Top Selected Keywords ──
  var selected = kwR.selected || [];
  var allKws = kwR.keywords || [];
  if (selected.length && allKws.length) {
    var selSet = new Set(selected);
    var selKws = allKws.filter(function(k) { return selSet.has(k.kw); })
      .sort(function(a, b) { return (b.vol || 0) - (a.vol || 0); });
    if (selKws.length) {
      md += '\n\n---\n\n## Appendix A: Selected Keyword Opportunities (' + selKws.length + ')\n\n';
      md += '| Keyword | Vol/mo | KD | CPC | Score |\n';
      md += '|---------|-------:|---:|----:|------:|\n';
      selKws.forEach(function(k) {
        var kd = k.kd > 0 ? k.kd : 30;
        var score = k.vol >= 10 ? Math.round((Math.log(k.vol + 1) * 100) / Math.max(kd, 5) * 10) / 10 : 0;
        md += '| ' + k.kw + ' | ' + (k.vol || 0).toLocaleString() + ' | ' + (k.kd || '-') + ' | $' + (k.cpc || 0).toFixed(2) + ' | ' + score + ' |\n';
      });
      var totalVol = selKws.reduce(function(s, k) { return s + (k.vol || 0); }, 0);
      md += '\n**Total selected volume:** ' + totalVol.toLocaleString() + '/month\n';
    }
  }

  // ── Appendix B: Keyword Clusters → Page Map ──
  var clusters = kwR.clusters || [];
  var qualClusters = clusters.filter(function(c) { return c.qualifies !== false; });
  if (qualClusters.length) {
    md += '\n\n## Appendix B: Cluster → Page Map (' + qualClusters.length + ' pages)\n\n';
    md += '| Cluster | Primary Keyword | Vol/mo | KD | Page Type | Action | Slug |\n';
    md += '|---------|----------------|-------:|---:|-----------|--------|------|\n';
    qualClusters.forEach(function(c) {
      var action = c.recommendation === 'improve_existing' ? 'Improve' : 'Build';
      var slug = c.recommendation === 'improve_existing' ? '/' + (c.existingSlug || '') : '/' + (c.suggestedSlug || '');
      md += '| ' + (c.name || c.primaryKw) + ' | ' + (c.primaryKw || '') + ' | ' + (c.primaryVol || 0).toLocaleString() + ' | ' + (c.primaryKd || '-') + ' | ' + (c.pageType || '-') + ' | ' + action + ' | ' + slug + ' |\n';
    });
  }

  // ── Appendix C: Audience Segments ──
  if (st.audience && st.audience.segments && st.audience.segments.length) {
    md += '\n\n## Appendix C: Audience Segments\n\n';
    md += '| Segment | Revenue Potential | Acquisition Difficulty | Priority |\n';
    md += '|---------|:-----------------:|:---------------------:|:--------:|\n';
    st.audience.segments.forEach(function(seg) {
      md += '| ' + seg.name + ' | ' + (seg.revenue_potential || '-') + ' | ' + (seg.acquisition_difficulty || '-') + ' | ' + (seg.priority || '-') + ' |\n';
    });
  }

  // ── Appendix D: Channel Scoring ──
  if (st.channel_strategy && st.channel_strategy.levers && st.channel_strategy.levers.length) {
    md += '\n\n## Appendix D: Channel Scoring Matrix\n\n';
    md += '| Channel | Priority | Budget % | Timeline | Rationale |\n';
    md += '|---------|:--------:|:--------:|----------|----------|\n';
    st.channel_strategy.levers.forEach(function(lev) {
      md += '| ' + (lev.lever || lev.name || '') + ' | ' + (lev.priority_score || '-') + '/10 | ' + (lev.budget_allocation_pct || 0) + '% | ' + (lev.timeline_to_results || '-') + ' | ' + (lev.rationale || '-').substring(0, 80) + ' |\n';
    });
  }

  // ── Appendix E: Risk Register ──
  if (st.risks && st.risks.risks && st.risks.risks.length) {
    md += '\n\n## Appendix E: Risk Register\n\n';
    md += '| Risk | Severity | Mitigation |\n';
    md += '|------|:--------:|-----------|\n';
    st.risks.risks.forEach(function(rk) {
      md += '| ' + (rk.risk || '').replace(/_/g, ' ') + ' | ' + (rk.severity || '-') + '/10 | ' + (rk.mitigation || '-').substring(0, 100) + ' |\n';
    });
  }

  // ── Appendix F: Competitor Comparison ──
  var comps = (S.research || {}).competitors || [];
  var bs = st.brand_strategy || {};
  if (comps.length) {
    md += '\n\n## Appendix F: Competitive Landscape\n\n';
    md += '| Competitor | Strength | Weakness | Our Edge |\n';
    md += '|-----------|----------|----------|----------|\n';
    comps.slice(0, 8).forEach(function(c) {
      md += '| ' + (c.name || c) + ' | ' + (c.why_they_win || '-').substring(0, 60) + ' | ' + (c.weaknesses || '-').substring(0, 60) + ' | ' + (c.what_we_do_better || '-').substring(0, 60) + ' |\n';
    });
  }

  return md;
}

// ── Output Tab — Compiled Strategy Document ────────────────────────────

async function compileStrategyOutput() {
  if (!S.strategy || !S.strategy._meta || S.strategy._meta.current_version === 0) {
    aiBarNotify('Generate strategy diagnostics first', { isError: true, duration: 3000 });
    return;
  }

  var st = S.strategy;
  var r = S.research || {};
  var s = S.setup || {};

  // Build comprehensive context from ALL diagnostic outputs + research
  var ctx = 'CLIENT: ' + (s.client || r.client_name || '') + '\n';
  ctx += 'URL: ' + (s.url || '') + '\n';
  ctx += 'INDUSTRY: ' + (r.industry || '') + '\n';
  ctx += 'SERVICES: ' + (r.primary_services || []).join(', ') + '\n';
  if (r.services_detail && r.services_detail.length) {
    ctx += 'SERVICES DETAIL:\n';
    r.services_detail.forEach(function(sd) {
      ctx += '- ' + (sd.name || '') + ': ' + (sd.description || '');
      if (sd.target_audience) ctx += ' | Target: ' + sd.target_audience;
      if (sd.differentiator) ctx += ' | Differentiator: ' + sd.differentiator;
      ctx += '\n';
    });
  }
  ctx += 'GEO: ' + (r.geography && r.geography.primary ? r.geography.primary : s.geo || '') + '\n';
  if (r.geography && r.geography.secondary && r.geography.secondary.length) ctx += 'SECONDARY GEOS: ' + r.geography.secondary.join(', ') + '\n';
  ctx += 'AUDIENCE: ' + (r.primary_audience_description || '') + '\n';
  if (r.buyer_roles && r.buyer_roles.length) ctx += 'BUYER ROLES: ' + r.buyer_roles.join('; ') + '\n';
  if (r.pain_points_top5 && r.pain_points_top5.length) ctx += 'PAIN POINTS: ' + r.pain_points_top5.join('; ') + '\n';
  if (r.objections_top5 && r.objections_top5.length) ctx += 'BUYER OBJECTIONS: ' + r.objections_top5.join('; ') + '\n';
  // Client goals
  if (r.goal_statement) ctx += '\nCLIENT SUCCESS DEFINITION:\n';
  if (r.goal_statement) ctx += 'In their words: "' + r.goal_statement + '"\n';
  if (r.goal_target) ctx += 'Target: ' + r.goal_target + '\n';
  if (r.goal_baseline) ctx += 'Current baseline: ' + r.goal_baseline + '\n';
  if (r.goal_timeline) ctx += 'Timeline: ' + r.goal_timeline + '\n';
  if (r.goal_kpi) ctx += 'Primary KPI: ' + r.goal_kpi.replace(/_/g, ' ') + '\n';

  // Proof & E-E-A-T signals
  if (r.existing_proof && r.existing_proof.length) ctx += 'PROOF POINTS: ' + r.existing_proof.join('; ') + '\n';
  if (r.case_studies && r.case_studies.length) {
    ctx += 'CASE STUDIES:\n';
    r.case_studies.forEach(function(cs) {
      ctx += '- ' + (cs.client || 'Client') + ': ' + (cs.result || '') + (cs.timeframe ? ' (' + cs.timeframe + ')' : '') + '\n';
    });
  }
  if (r.notable_clients && r.notable_clients.length) ctx += 'NOTABLE CLIENTS: ' + r.notable_clients.join(', ') + '\n';
  if (r.awards_certifications && r.awards_certifications.length) ctx += 'AWARDS/CERTS: ' + r.awards_certifications.join(', ') + '\n';
  if (r.team_credentials) ctx += 'TEAM CREDENTIALS: ' + r.team_credentials + '\n';
  if (r.founder_bio) ctx += 'FOUNDER: ' + r.founder_bio + '\n';
  if (r.publications_media && r.publications_media.length) ctx += 'MEDIA/PUBLICATIONS: ' + r.publications_media.join(', ') + '\n';

  // D0: Audience Intelligence
  if (st.audience && st.audience.segments && st.audience.segments.length) {
    ctx += '\nAUDIENCE INTELLIGENCE:\n';
    ctx += 'Segments:\n';
    st.audience.segments.forEach(function(seg) {
      ctx += '- ' + seg.name + ': ' + (seg.description || '') + ' (revenue: ' + (seg.revenue_potential || '?') + ', difficulty: ' + (seg.acquisition_difficulty || '?') + ')\n';
    });
    if (st.audience.personas && st.audience.personas.length) {
      ctx += 'Personas:\n';
      st.audience.personas.forEach(function(p) {
        ctx += '- ' + p.name + ' (' + (p.role || '') + '): ' + (p.goals ? p.goals.join('; ') : '') + '\n';
      });
    }
    if (st.audience.buying_motions && st.audience.buying_motions.length) {
      ctx += 'Buying motions:\n';
      st.audience.buying_motions.forEach(function(bm) {
        ctx += '- ' + bm.segment + ': ' + (bm.decision_process || '') + ', timeline ' + (bm.typical_timeline || '?') + '\n';
      });
    }
    if (st.audience.perceived_alternatives && st.audience.perceived_alternatives.length) {
      ctx += 'Perceived alternatives:\n';
      st.audience.perceived_alternatives.forEach(function(alt) {
        ctx += '- ' + alt.alternative + ' (' + (alt.threat_level || '?') + '): ' + (alt.counter_positioning || alt.failure_mode || '') + '\n';
      });
    }
    if (st.audience.validation) {
      ctx += 'Focus: ' + (st.audience.validation.recommended_focus || st.audience.validation.primary_segment || '') + '\n';
    }
  }

  // D1: Unit Economics
  if (st.unit_economics && st.unit_economics.recommendation) {
    ctx += '\nUNIT ECONOMICS:\n';
    ctx += '- Max CPL: $' + (st.unit_economics.max_allowable_cpl || '?') + '\n';
    ctx += '- Estimated Market CPL: $' + (st.unit_economics.estimated_market_cpl || '?') + '\n';
    ctx += '- LTV: $' + (st.unit_economics.ltv || '?') + '\n';
    ctx += '- Estimated CAC: $' + (st.unit_economics.estimated_cac || '?') + '\n';
    ctx += '- LTV:CAC: ' + (st.unit_economics.ltv_cac_ratio || '?') + ' (' + (st.unit_economics.ltv_cac_health || '?') + ')\n';
    ctx += '- Paid viable: ' + (st.unit_economics.paid_media_viable ? 'Yes' : 'No') + '\n';
    ctx += '- Recommendation: ' + st.unit_economics.recommendation + '\n';
    if (st.unit_economics.market_cpc_summary) {
      var cpcS = st.unit_economics.market_cpc_summary;
      ctx += '- Market CPC: avg $' + (cpcS.avg_cpc || '?') + ', median $' + (cpcS.median_cpc || '?') + ', range ' + (cpcS.cpc_range || '?') + '\n';
      if (cpcS.high_intent_avg_cpc) ctx += '- High-intent CPC: $' + cpcS.high_intent_avg_cpc + '\n';
      ctx += '- CPC data source: ' + (cpcS.data_source || 'unknown') + '\n';
      if (cpcS.rationale) ctx += '- CPC to CPL rationale: ' + cpcS.rationale + '\n';
    }
    if (st.unit_economics.assumptions && st.unit_economics.assumptions.length) {
      ctx += '- Assumptions: ' + st.unit_economics.assumptions.join('; ') + '\n';
    }
  }

  // Positioning Direction (hypothesis-driven)
  if (st.positioning && st.positioning.selected_direction) {
    var _sd = st.positioning.selected_direction;
    ctx += '\nPOSITIONING DIRECTION (founder-aligned):\n';
    ctx += '- Selected direction: ' + _sd.direction + '\n';
    if (_sd.headline) ctx += '- Headline: ' + _sd.headline + '\n';
    if (_sd.rationale) ctx += '- Rationale: ' + _sd.rationale + '\n';
    if (_sd.provability_score) ctx += '- Provability: ' + _sd.provability_score + '/10 | Distinctiveness: ' + (_sd.distinctiveness_score || '?') + '/10\n';
    if (_sd.risk) ctx += '- Risk: ' + _sd.risk + '\n';
    if (_sd.what_changes_if_chosen) ctx += '- Impact: ' + _sd.what_changes_if_chosen + '\n';
  }
  if (st.positioning && st.positioning.positioning_to_avoid && st.positioning.positioning_to_avoid.length) {
    var _avoidCompile = st.positioning.positioning_to_avoid.filter(function(a) { return a && a.trim(); });
    if (_avoidCompile.length) {
      ctx += '\nPOSITIONING TO AVOID:\n' + _avoidCompile.map(function(a) { return '- ' + a; }).join('\n') + '\n';
    }
  }
  if (st.positioning && st.positioning.hypothesis_evaluations && st.positioning.hypothesis_evaluations.length) {
    ctx += '\nHYPOTHESIS EVALUATIONS:\n';
    st.positioning.hypothesis_evaluations.forEach(function(he) {
      ctx += '- "' + he.hypothesis + '" — ' + he.verdict + ' (provability: ' + (he.scores && he.scores.provability || '?') + ', distinctiveness: ' + (he.scores && he.scores.distinctiveness || '?') + ')\n';
    });
  }

  // D2: Positioning
  if (st.positioning && st.positioning.core_value_proposition) {
    ctx += '\nPOSITIONING:\n';
    ctx += '- Value Prop: ' + st.positioning.core_value_proposition + '\n';
    ctx += '- Angle: ' + (st.positioning.recommended_positioning_angle || '') + '\n';
    ctx += '- Tagline: ' + (st.positioning.recommended_tagline || '') + '\n';
    if (st.positioning.validated_differentiators) ctx += '- Differentiators: ' + st.positioning.validated_differentiators.join('; ') + '\n';
    if (st.positioning.messaging_hierarchy) {
      var mh = st.positioning.messaging_hierarchy;
      ctx += '- Primary Message: ' + (mh.primary_message || '') + '\n';
      if (mh.supporting_messages && mh.supporting_messages.length) ctx += '- Supporting Messages: ' + mh.supporting_messages.join('; ') + '\n';
      if (mh.proof_points) ctx += '- Proof: ' + mh.proof_points.join('; ') + '\n';
    }
    if (st.positioning.brand_voice_direction) {
      var bvd = st.positioning.brand_voice_direction;
      ctx += '- Voice: ' + (bvd.style || '') + ' / ' + (bvd.tone_detail || '') + '\n';
      if (bvd.words_to_avoid && bvd.words_to_avoid.length) ctx += '- Words to avoid: ' + bvd.words_to_avoid.join(', ') + '\n';
      if (bvd.words_to_use && bvd.words_to_use.length) ctx += '- Words to use: ' + bvd.words_to_use.join(', ') + '\n';
    }
    if (st.positioning.category_perception && st.positioning.category_perception.gap_severity !== 'none') {
      var _cpC = st.positioning.category_perception;
      ctx += '\nCATEGORY PERCEPTION GAP:\n';
      ctx += '- Buyer thinks they are buying: ' + (_cpC.buyer_frame || '') + '\n';
      ctx += '- We are actually selling: ' + (_cpC.actual_frame || '') + '\n';
      ctx += '- Gap severity: ' + (_cpC.gap_severity || '') + '\n';
      ctx += '- Reframing language: ' + (_cpC.reframing_language || '') + '\n';
      if (_cpC.reframing_trigger_pages && _cpC.reframing_trigger_pages.length) {
        ctx += '- Trigger pages: ' + _cpC.reframing_trigger_pages.join(', ') + '\n';
      }
    }
  }

  // D3: Subtraction Analysis
  if (st.subtraction) {
    ctx += '\nSUBTRACTION ANALYSIS:\n';
    var subAudit = st.subtraction.current_activities_audit || [];
    if (subAudit.length) {
      subAudit.forEach(function(a) {
        ctx += '- ' + (a.verdict || '').toUpperCase() + ': ' + a.activity + ' ($' + (a.monthly_cost || '?') + '/mo) \u2014 ' + (a.reason || '') + '\n';
      });
    } else if (st.subtraction.activities_to_cut) {
      ctx += '- Cut: ' + st.subtraction.activities_to_cut.map(function(a) { return a.activity; }).join(', ') + '\n';
    }
    if (st.subtraction.total_recoverable_monthly) ctx += '- Total recoverable: $' + st.subtraction.total_recoverable_monthly + '/mo\n';
    else if (st.subtraction.recoverable_budget) ctx += '- Recoverable: ' + st.subtraction.recoverable_budget + '\n';
    if (st.subtraction.subtraction_summary) ctx += '- Summary: ' + st.subtraction.subtraction_summary + '\n';
    if (st.subtraction.redirect_recommendations && st.subtraction.redirect_recommendations.length) {
      st.subtraction.redirect_recommendations.forEach(function(rd) {
        ctx += '- Redirect: ' + rd.from + ' \u2192 ' + rd.to + ' (' + rd.rationale + ')\n';
      });
    } else if (st.subtraction.redirect_recommendation) {
      ctx += '- Redirect: ' + st.subtraction.redirect_recommendation + '\n';
    }
  }

  // D4: Channel Strategy
  if (st.channel_strategy && st.channel_strategy.priority_order) {
    ctx += '\nCHANNEL STRATEGY:\n';
    ctx += '- Priority: ' + st.channel_strategy.priority_order.join(', ') + '\n';
    if (st.channel_strategy.website_role) ctx += '- Website role: ' + st.channel_strategy.website_role + '\n';
    if (st.channel_strategy.budget_allocation) ctx += '- Budget: $' + (st.channel_strategy.budget_allocation.total_monthly || '?') + '/mo\n';
    if (st.channel_strategy.funnel_gaps_flagged && st.channel_strategy.funnel_gaps_flagged.length) ctx += '- Funnel Gaps: ' + st.channel_strategy.funnel_gaps_flagged.join('; ') + '\n';
    if (st.channel_strategy.levers && st.channel_strategy.levers.length) {
      ctx += '- Levers:\n';
      st.channel_strategy.levers.forEach(function(lev) {
        ctx += '  · ' + (lev.lever || lev.name || '') + ': priority ' + (lev.priority_score || '?') + '/10, ' + (lev.budget_allocation_pct || 0) + '% budget';
        if (lev.timeline_to_results) ctx += ', results: ' + lev.timeline_to_results;
        if (lev.rationale) ctx += ' — ' + lev.rationale;
        ctx += '\n';
      });
    }
  }

  // D5: Website & CRO
  var web = st.execution_plan && st.execution_plan.lever_details ? st.execution_plan.lever_details.website : null;
  if (web && web.build_type) {
    ctx += '\nWEBSITE & CRO:\n';
    ctx += '- Build type: ' + web.build_type + '\n';
    if (web.primary_cta) ctx += '- Primary CTA: ' + web.primary_cta + '\n';
    if (web.conversion_strategy) ctx += '- Conversion: ' + web.conversion_strategy + '\n';
    if (web.architecture_direction && web.architecture_direction.page_types_needed) ctx += '- Pages needed: ' + web.architecture_direction.page_types_needed.join(', ') + '\n';
  }
  // Full CTA architecture from execution plan
  if (st.execution_plan) {
    if (st.execution_plan.primary_cta && !web) ctx += '\nPRIMARY CTA: ' + st.execution_plan.primary_cta + '\n';
    if (st.execution_plan.secondary_ctas) ctx += 'SECONDARY CTAs: ' + (Array.isArray(st.execution_plan.secondary_ctas) ? st.execution_plan.secondary_ctas.join(', ') : st.execution_plan.secondary_ctas) + '\n';
    if (st.execution_plan.low_commitment_cta) ctx += 'LOW-COMMITMENT CTA: ' + st.execution_plan.low_commitment_cta + '\n';
    if (st.execution_plan.kpis && st.execution_plan.kpis.length) {
      ctx += 'KPIs: ' + st.execution_plan.kpis.slice(0, 8).map(function(k) {
        return typeof k === 'string' ? k : (k.metric || k.name || '') + (k.target ? ' (target: ' + k.target + ')' : '');
      }).join('; ') + '\n';
    }
  }

  // Growth Plan — funnel architecture and conversion pathway
  if (st.growth_plan) {
    var gp = st.growth_plan;
    ctx += '\nGROWTH PLAN:\n';
    if (gp.funnel_architecture) {
      ctx += '- Funnel architecture: ' + (typeof gp.funnel_architecture === 'string' ? gp.funnel_architecture : JSON.stringify(gp.funnel_architecture)) + '\n';
    }
    if (gp.conversion_pathway) {
      ctx += '- Conversion pathway: ' + (typeof gp.conversion_pathway === 'string' ? gp.conversion_pathway : JSON.stringify(gp.conversion_pathway)) + '\n';
    }
    if (gp.timeline && gp.timeline.length) {
      ctx += '- Execution timeline (' + gp.timeline.length + ' items):\n';
      gp.timeline.slice(0, 10).forEach(function(t) {
        ctx += '  · ' + (t.lever || t.name || '') + ': ' + (t.duration || '?') + (t.phase ? ' [' + t.phase + ']' : '') + '\n';
      });
    }
  }

  // D6: Content & Authority
  var content = st.execution_plan && st.execution_plan.lever_details ? st.execution_plan.lever_details.content_marketing : null;
  var bs = st.brand_strategy || {};
  if ((content && content.content_pillars) || bs.dr_gap_analysis) {
    ctx += '\nCONTENT & AUTHORITY:\n';
    if (content && content.content_pillars) ctx += '- Pillars: ' + content.content_pillars.join(', ') + '\n';
    var pillars = bs.content_pillars || (content && content.content_pillars) || [];
    if (pillars.length && !(content && content.content_pillars)) ctx += '- Pillars: ' + pillars.join(', ') + '\n';
    if (bs.content_velocity || (content && content.content_velocity)) ctx += '- Velocity: ' + (bs.content_velocity || content.content_velocity) + '\n';
    if (bs.content_mix && bs.content_mix.length) {
      ctx += '- Content mix: ' + bs.content_mix.map(function(cm) { return cm.type + ' (' + cm.monthly + '/mo)'; }).join(', ') + '\n';
    }
    if (bs.dr_gap_analysis) {
      var drg = bs.dr_gap_analysis;
      ctx += '- Client DR: ' + (drg.client_dr || '?') + ' (source: ' + (drg.client_dr_source || 'unknown') + ')\n';
      if (drg.competitor_drs && drg.competitor_drs.length) {
        ctx += '- Competitor DRs: ' + drg.competitor_drs.map(function(c) { return c.name + ' (DR:' + c.dr + ')'; }).join(', ') + '\n';
      }
      if (drg.dr_gap) ctx += '- DR gap: ' + drg.dr_gap + '\n';
      if (drg.realistic_dr_target_12mo) ctx += '- 12-month DR target: ' + drg.realistic_dr_target_12mo + '\n';
      if (drg.dr_growth_strategy) ctx += '- DR growth strategy: ' + drg.dr_growth_strategy + '\n';
    }
    if (bs.authority_timeline && bs.authority_timeline.length) {
      ctx += '- Authority timeline:\n';
      bs.authority_timeline.forEach(function(phase) {
        ctx += '  * ' + phase.phase + ': ' + (phase.milestones || []).join('; ') + '\n';
      });
    }
    if (bs.quick_wins && bs.quick_wins.length) {
      ctx += '- Quick wins: ' + bs.quick_wins.map(function(qw) { return qw.opportunity + ' (' + qw.effort + ' effort)'; }).join('; ') + '\n';
    }
    if (content && content.geo_targeting_strategy) ctx += '- Geo Strategy: ' + content.geo_targeting_strategy + '\n';
    if (bs.geo_targeting_strategy) ctx += '- Geo Strategy: ' + bs.geo_targeting_strategy + '\n';
    if (content && content.local_seo_priority) ctx += '- Local SEO: ' + content.local_seo_priority + '\n';
    if (bs.local_seo_priority) ctx += '- Local SEO: ' + bs.local_seo_priority + '\n';
  }

  // D7: Risks
  if (st.risks && st.risks.risks) {
    var highRisks = st.risks.risks.filter(function(rk) { return rk.severity >= 6; });
    if (highRisks.length) {
      ctx += '\nHIGH RISKS:\n';
      highRisks.forEach(function(rk) {
        ctx += '- ' + (rk.risk || '').replace(/_/g, ' ') + ' (sev:' + rk.severity + '): ' + (rk.mitigation || '') + '\n';
      });
    }
  }

  // D8: Demand
  if (st.demand_validation && st.demand_validation.overall_verdict) {
    ctx += '\nDEMAND VALIDATION: ' + st.demand_validation.overall_verdict + '\n';
    if (st.demand_validation.seo_viability_score) ctx += '- SEO viability: ' + st.demand_validation.seo_viability_score + '/10\n';
    if (st.demand_validation.time_to_meaningful_organic) ctx += '- Time to organic: ' + st.demand_validation.time_to_meaningful_organic + '\n';
    if (st.demand_validation.total_monthly_volume) ctx += '- Total monthly search volume: ' + st.demand_validation.total_monthly_volume + '\n';
    if (st.demand_validation.strategic_revisions_needed && st.demand_validation.strategic_revisions_needed.length) {
      ctx += '- Strategic revisions needed:\n';
      st.demand_validation.strategic_revisions_needed.forEach(function(rev) {
        ctx += '  · ' + (rev.revision || rev.description || JSON.stringify(rev));
        if (rev.impact_severity) ctx += ' [severity: ' + rev.impact_severity + ']';
        ctx += '\n';
      });
    }
  }

  // D8 Narrative: Narrative & Messaging
  if (st.narrative) {
    var nar = st.narrative;
    ctx += '\nNARRATIVE & MESSAGING:\n';
    if (nar.storybrand) {
      ctx += '- StoryBrand hero: ' + (nar.storybrand.hero || '') + '\n';
      ctx += '- External problem: ' + (nar.storybrand.external_problem || '') + '\n';
      ctx += '- Internal problem: ' + (nar.storybrand.internal_problem || '') + '\n';
      ctx += '- Guide authority: ' + (nar.storybrand.guide_authority || '') + '\n';
      ctx += '- Plan: ' + (nar.storybrand.plan || []).join(' \u2192 ') + '\n';
      ctx += '- Direct CTA: ' + (nar.storybrand.direct_cta || '') + '\n';
      ctx += '- Success: ' + (nar.storybrand.success_transformation || '') + '\n';
    }
    if (nar.messaging_pillars && nar.messaging_pillars.length) {
      ctx += '- Messaging pillars: ' + nar.messaging_pillars.map(function(p) { return p.pillar || ''; }).join(', ') + '\n';
    }
    if (nar.recommended_entry_point) ctx += '- Recommended entry: ' + nar.recommended_entry_point + '\n';
    if (nar.call_shape) ctx += '- Call shape: ' + nar.call_shape + '\n';
  }

  // Strategy scoring summary
  var scores = scoreStrategy();
  ctx += '\nSTRATEGY SCORE: ' + scores.overall + '/10\n';
  Object.keys(scores.sections).forEach(function(sec) {
    var ss = scores.sections[sec];
    ctx += '- ' + (STRATEGY_SECTION_LABELS[sec] || sec) + ': ' + ss.score + '/10 (data:' + ss.scores.data + ' confidence:' + ss.scores.confidence + ' specificity:' + ss.scores.specificity + ')\n';
  });
  if (scores.activeCaps && scores.activeCaps.length) {
    ctx += '- Active caps: ' + scores.activeCaps.map(function(c) { return c.condition.replace(/_/g, ' ') + ' (cap:' + c.cap + ')'; }).join('; ') + '\n';
  }
  if (scores.gaps.length) {
    var topGaps = scores.gaps.filter(function(g) { return g.can_auto_resolve === false; }).slice(0, 5);
    if (topGaps.length) ctx += '- Key gaps: ' + topGaps.map(function(g) { return g.gap; }).join('; ') + '\n';
  }

  // Strategist notes (manual overrides/inputs)
  if (st._strategist_notes) {
    var noteSections = Object.keys(st._strategist_notes).filter(function(k) { return st._strategist_notes[k] && st._strategist_notes[k].trim(); });
    if (noteSections.length) {
      ctx += '\nSTRATEGIST NOTES:\n';
      noteSections.forEach(function(ns) {
        ctx += '- ' + ns + ': ' + st._strategist_notes[ns].trim() + '\n';
      });
    }
  }

  // Real competitor names from research
  var comps = r.competitors || [];
  if (comps.length) {
    ctx += '\nCOMPETITORS:\n';
    comps.slice(0, 8).forEach(function(c) {
      var name = c.name || c;
      var url = c.url || '';
      ctx += '- ' + name + (url ? ' (' + url + ')' : '');
      if (c.why_they_win) ctx += ' — Strength: ' + c.why_they_win;
      if (c.weaknesses) ctx += ' | Weakness: ' + c.weaknesses;
      if (c.what_we_do_better) ctx += ' | Our edge: ' + c.what_we_do_better;
      ctx += '\n';
    });
  }

  // Real keyword clusters with volumes
  var kwClusters = (S.kwResearch && S.kwResearch.clusters) || [];
  if (kwClusters.length) {
    var qualifiedClusters = kwClusters.filter(function(c) { return c.qualifies !== false; });
    var totalVol = 0;
    qualifiedClusters.forEach(function(c) { totalVol += (c.primaryVol || 0); });
    ctx += '\nKEYWORD CLUSTERS (' + qualifiedClusters.length + ' qualified, ' + totalVol.toLocaleString() + ' total monthly volume):\n';
    qualifiedClusters.slice(0, 25).forEach(function(c) {
      ctx += '- ' + (c.name || c.primaryKw || '') + ' [' + (c.pageType || '?') + ']';
      ctx += ' — "' + (c.primaryKw || '') + '" (' + (c.primaryVol || 0).toLocaleString() + '/mo, KD:' + (c.primaryKd || '?') + ')';
      ctx += ' → ' + (c.recommendation === 'improve_existing' ? 'improve /' + (c.existingSlug || '') : 'build /' + (c.suggestedSlug || ''));
      if (c.supportingKws && c.supportingKws.length) {
        ctx += ' + ' + c.supportingKws.length + ' supporting kws';
      }
      ctx += '\n';
    });
    if (qualifiedClusters.length > 25) ctx += '... and ' + (qualifiedClusters.length - 25) + ' more clusters\n';
  }

  // Market CPC data from keyword research
  var kwR2 = S.kwResearch || {};
  if (kwR2.keywords && kwR2.keywords.length >= 10) {
    var kwsC2 = kwR2.keywords.filter(function(k) { return k.cpc > 0; });
    if (kwsC2.length >= 3) {
      var avgC2 = Math.round((kwsC2.reduce(function(s,k){return s+k.cpc;},0)/kwsC2.length)*100)/100;
      var topC2 = kwsC2.slice().sort(function(a,b){return b.cpc-a.cpc;}).slice(0,5);
      ctx += '\nMARKET CPC DATA (' + kwsC2.length + ' keywords):\n';
      ctx += '- Avg CPC: $' + avgC2 + '\n';
      ctx += '- Top by CPC: ' + topC2.map(function(k){return '"'+k.kw+'" $'+k.cpc;}).join(', ') + '\n';
    }
  }

  // Buyer questions from keyword research
  var compileQs = (typeof _getQuestionsArray === 'function') ? _getQuestionsArray() : [];
  if (compileQs.length) {
    ctx += '\nBUYER QUESTIONS (' + compileQs.length + ' validated):\n';
    compileQs.slice(0, 15).forEach(function(q) { ctx += '- ' + q + '\n'; });
  }

  // Quick-win keywords (high volume, low difficulty)
  if (kwR2.keywords && kwR2.keywords.length) {
    var compileQW = kwR2.keywords.filter(function(k) { return k.vol >= 100 && k.kd <= 20; });
    if (compileQW.length) {
      ctx += '\nQUICK-WIN KEYWORDS (' + compileQW.length + ' — vol>=100, KD<=20):\n';
      compileQW.slice(0, 10).forEach(function(k) {
        ctx += '- "' + k.kw + '" — ' + k.vol.toLocaleString() + '/mo, KD:' + k.kd + '\n';
      });
    }
  }

  // Budget breakdown from channel strategy
  var budgetAlloc = (st.channel_strategy && st.channel_strategy.budget_allocation) || (st.growth_plan && st.growth_plan.budget_allocation) || null;
  if (budgetAlloc) {
    ctx += '\nBUDGET BREAKDOWN:\n';
    if (budgetAlloc.total_monthly) ctx += '- Total monthly: $' + budgetAlloc.total_monthly.toLocaleString() + '\n';
    if (budgetAlloc.by_lever && typeof budgetAlloc.by_lever === 'object') {
      Object.keys(budgetAlloc.by_lever).forEach(function(lever) {
        ctx += '- ' + lever + ': $' + (budgetAlloc.by_lever[lever] || 0).toLocaleString() + '/mo\n';
      });
    }
  }
  // Audit summary
  var auditSummary = [];
  var au0 = (st._audit || {})[0];
  if (au0) auditSummary.push('D0: ' + au0.pass + '/' + au0.total);
  for (var d = 1; d <= 9; d++) {
    var au = (st._audit || {})[d];
    if (au) auditSummary.push('D' + d + ': ' + au.pass + '/' + au.total);
  }
  if (auditSummary.length) ctx += '\nAUDIT SCORES: ' + auditSummary.join(', ') + '\n';

  // Reference docs
  if (s.docs && s.docs.length) {
    ctx += '\nREFERENCE DOCUMENTS:\n';
    ctx += _docExtractCtx(s.docs, ['facts','decisions','requirements','competitors','audience','services','goals']);
  }
  if (s.discoveryNotes && s.discoveryNotes.trim()) {
    ctx += '\nDISCOVERY NOTES:\n' + s.discoveryNotes.trim() + '\n';
  }

  // Pricing Engine data for Investment Summary section
  ctx += buildPricingContextBlock();
  if (st.pricing_snapshot) {
    ctx += '\nPRICING SNAPSHOT:\n';
    ctx += '- Source: ' + (st.pricing_snapshot.source || 'unknown') + '\n';
    ctx += '- Package fit: ' + (st.pricing_snapshot.package_fit || 'unknown') + '\n';
    ctx += '- Monthly recommended (midpoint): $' + (st.pricing_snapshot.monthly_recommended || 0).toLocaleString() + '\n';
    ctx += '- Client monthly budget: $' + (st.pricing_snapshot.monthly_client_budget || 0).toLocaleString() + '\n';
    if (st.pricing_snapshot.gap > 0) ctx += '- Budget gap: $' + st.pricing_snapshot.gap.toLocaleString() + '/mo over budget\n';
  }

  // Build revenue projection for the prompt
  var revProj = _buildRevenueProjection();
  if (revProj) ctx += '\nREVENUE PROJECTION:\n' + revProj + '\n';

  // Add client goals alignment context
  if (s.goalStatement || s.goalTarget) {
    ctx += '\nCLIENT GOALS (from intake):\n';
    if (s.goalStatement) ctx += '- Goal statement: "' + s.goalStatement + '"\n';
    if (s.goalTarget) ctx += '- Target: ' + s.goalTarget + '\n';
    if (s.goalBaseline) ctx += '- Baseline: ' + s.goalBaseline + '\n';
    if (s.goalTimeline) ctx += '- Timeline: ' + s.goalTimeline + '\n';
    if (s.goalKpi) ctx += '- Primary KPI: ' + s.goalKpi.replace(/_/g, ' ') + '\n';
  }

  var sys = 'You are a senior digital strategist writing a strategy document that is ALSO a sales document. This document must clearly communicate: (1) the market opportunity exists, (2) the client\'s goals are achievable, (3) there is a validated path from investment to revenue, and (4) every recommendation is backed by data.\n\n'
    + 'Use Canadian spelling. Use the client name throughout. This is a premium deliverable — write with authority and precision.\n\n'
    + 'CRITICAL RULES:\n'
    + '- Use ACTUAL data: real competitor names, real keyword volumes, real dollar amounts, real DR scores, real case study results\n'
    + '- Never use placeholder language like "various keywords" or "competitive budget" when you have specific numbers\n'
    + '- Include markdown tables where data is tabular (competitor comparison, channel allocation, risk register)\n'
    + '- Every claim must reference the data that supports it\n'
    + '- If strategist notes were provided, incorporate their direction\n\n'
    + 'Write in these 13 sections:\n\n'
    + '## 1. EXECUTIVE SUMMARY\n'
    + '3-4 paragraphs. Open with the market opportunity (total search volume, demand validation). State the client goal and how the strategy achieves it. Summarise the positioning direction and the revenue projection. End with the recommended investment and expected ROI timeline. This section must make the reader think: "this is clearly worth doing."\n\n'
    + '## 2. GOAL ALIGNMENT\n'
    + 'Start with the client\'s stated goal (quote it if available). Map each goal component to specific strategy recommendations. Show the projected timeline to hit the target. Include the revenue projection model: leads/month × close rate × deal size = monthly revenue. Compare investment vs projected return. Close with the KPIs that will measure progress.\n\n'
    + '## 3. MARKET OPPORTUNITY & DEMAND VALIDATION\n'
    + 'Total addressable search volume across all keyword clusters. Break down by service line (sum cluster volumes by page type). Include the demand validation verdict and SEO viability score. Reference seasonal trends if available. State the competitive density (how many competitors, their DR range). This section proves the market exists and is winnable.\n\n'
    + '## 4. AUDIENCE & BUYING BEHAVIOUR\n'
    + 'Audience segments table: name, revenue potential, acquisition difficulty, priority. Key personas with their goals, frustrations, and decision criteria. Buying motions: how each segment researches, evaluates, and purchases. Purchase triggers and objection counter-messaging. Perceived alternatives and how to position against them.\n\n'
    + '## 5. COMPETITIVE POSITIONING\n'
    + 'Open with the selected positioning direction, headline, and rationale. Include a markdown table comparing our client vs top competitors on key dimensions (DR, traffic, positioning, strengths, weaknesses). State the unoccupied territory being claimed. If hypotheses were evaluated, summarise each with its verdict. Include the messaging hierarchy: primary message, supporting messages, proof points. Brand voice direction with words to use/avoid.\n\n'
    + '## 6. UNIT ECONOMICS & REVENUE MODEL\n'
    + 'Present the full financial model in a clear markdown table: CPL, CAC, LTV, LTV:CAC ratio, close rate, deal size, monthly lead target, projected monthly revenue. Include the sensitivity analysis (conservative/base/optimistic). State paid media viability. Reference actual CPC data from keyword research. Show break-even timeline. This is the most important section for client buy-in.\n\n'
    + '## 7. KEYWORD & CONTENT STRATEGY\n'
    + 'Reference the top keyword clusters by name with volumes and KD. Map clusters to page types (service, location, blog). State content pillars tied to keyword clusters and revenue. Include content velocity, mix, and the authority-building plan. DR gap analysis with 12-month target. Quick wins for early traction.\n\n'
    + '## 8. SITE ARCHITECTURE & CONVERSION\n'
    + 'Pages to build vs improve (reference actual cluster slugs). CTA architecture (primary, secondary, low-commitment). Conversion pathway from landing to lead. Form strategy. Tracking requirements and KPIs.\n\n'
    + '## 9. CHANNEL STRATEGY & BUDGET ALLOCATION\n'
    + 'Markdown table: channel, priority score, monthly budget $, % of total, timeline to results, rationale. Website role in the channel mix. Funnel coverage analysis. Subtraction analysis: what to stop, monthly savings, redirect recommendations.\n\n'
    + '## 10. EXECUTION ROADMAP\n'
    + 'Phased timeline: what launches when, dependencies, and expected milestones. Reference the growth plan phases and durations. Geographic strategy: primary and secondary markets, location page approach.\n\n'
    + '## 11. RISK REGISTER & MITIGATIONS\n'
    + 'Markdown table: risk, severity (1-10), impact, mitigation. Include proof inventory: case studies, notable clients, awards, team credentials, founder bio — these counter credibility risks.\n\n'
    + '## 12. INVESTMENT SUMMARY\n'
    + 'If pricing data is available: markdown table of services with monthly cost ranges, one-time costs, year-one total, package tier fit. Compare against client budget. If engagement scope exists, show suggested vs realistic columns with per-service ROI. If no pricing data, state costs are pending.\n\n'
    + '## 13. SUCCESS METRICS & MEASUREMENT PLAN\n'
    + 'Define what "working" looks like at 3, 6, and 12 months. Tie each KPI to the client\'s stated goal. Include organic traffic targets, keyword ranking targets, lead volume targets, and revenue targets. State what tools/platforms will be used for measurement.\n\n'
    + 'Write in clear, professional prose. Use markdown tables for tabular data. Approx 3000-4000 words total. This document must make the case that the investment will generate a measurable return.';

  // Build data appendices (deterministic — no AI needed)
  var appendices = _buildStrategyDataTables();

  aiBarStart('Compiling strategy document...');
  try {
    var result = await callClaude(sys, 'Complete strategy analysis:\n\n' + ctx.slice(0, 28000), null, 8192, 'Strategy output', 'claude-opus-4-20250514');
    // Append data tables after the AI prose
    S.strategy.compiled_output = result + appendices;
    // Also update the webStrategy brief (shorter version for downstream)
    if (!S.strategy.webStrategy || S.strategy.webStrategy.length < 100) {
      await synthesiseWebStrategy();
    }
    await saveProject();
    renderStrategyTabContent();
    aiBarEnd('Strategy document compiled');
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('Compilation failed: ' + e.message, { isError: true, duration: 4000 });
  }
}

function _renderOutput(st) {
  var html = '';
  var output = st.compiled_output || '';
  var meta = st._meta || {};

  // View toggle: Strategy Document vs Sales Intelligence
  var stratActive = _outputView === 'strategy';
  var salesActive = _outputView === 'sales';
  html += '<div style="display:flex;gap:0;margin-bottom:14px;border:1px solid var(--border);border-radius:6px;overflow:hidden;width:fit-content">';
  html += '<button class="btn sm" style="border:none;border-radius:0;' + (stratActive ? 'background:var(--green);color:#fff' : 'background:var(--bg2);color:var(--n3)') + '" onclick="switchOutputView(\'strategy\')"><i class="ti ti-file-text" style="font-size:12px;margin-right:4px"></i>Strategy Document</button>';
  html += '<button class="btn sm" style="border:none;border-radius:0;border-left:1px solid var(--border);' + (salesActive ? 'background:var(--green);color:#fff' : 'background:var(--bg2);color:var(--n3)') + '" onclick="switchOutputView(\'sales\')"><i class="ti ti-briefcase" style="font-size:12px;margin-right:4px"></i>Sales Intelligence</button>';
  html += '</div>';

  // Sales Intelligence view
  if (_outputView === 'sales') {
    var _si = st.sales_intel || {};
    var _hasD9 = !!(_si.sales_storybrand || _si.sales_pillars);

    // Re-generate button when D9 data exists
    if (_hasD9) {
      html += '<div style="display:flex;gap:6px;margin-bottom:14px">';
      html += '<button class="btn btn-ghost sm" onclick="runDiagnostic(9).then(function(){renderStrategyTabContent();})" data-tip="Re-run D9 to refresh sales intelligence"><i class="ti ti-refresh" style="font-size:11px;margin-right:4px"></i>Re-generate Sales Intel</button>';
      html += '</div>';
    }

    html += _renderSalesIntel(st);

    // Proposal preview — only show when D9 has data
    var proposalMd = _hasD9 ? buildProposalText() : '';
    if (proposalMd) {
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin:16px 0 8px">';
      html += '<div style="font-size:12px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em">Proposal Preview</div>';
      html += '<div style="display:flex;align-items:center;gap:6px">';
      html += '<button class="btn btn-ghost sm" onclick="copyProposal()" style="font-size:10px;padding:2px 8px" data-tip="Copy proposal to clipboard"><i class="ti ti-copy" style="font-size:11px"></i> Copy</button>';
      html += '<button class="btn btn-ghost sm" onclick="downloadProposal()" style="font-size:10px;padding:2px 8px" data-tip="Download proposal as markdown file"><i class="ti ti-download" style="font-size:11px"></i> Download .md</button>';
      html += '</div></div>';
      html += '<div class="card" style="padding:24px 28px;margin-bottom:14px">';
      html += '<div style="font-size:13px;line-height:1.7;font-family:var(--font)">' + sanitiseHTML(_markdownToHtml(proposalMd)) + '</div>';
      html += '</div>';
    }

    return html;
  }

  // Action buttons
  html += '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">';
  if (meta.current_version > 0) {
    if (output) {
      html += '<button class="btn btn-ghost sm" data-tip="Regenerates the compiled strategy document from current diagnostics" onclick="compileStrategyOutput()"><i class="ti ti-refresh"></i> Recompile</button>';
    } else {
      html += '<button class="btn btn-primary sm" data-tip="Compiles all diagnostic outputs into a single strategy document" onclick="compileStrategyOutput()"><i class="ti ti-sparkles"></i> Compile Strategy Document</button>';
    }
    if (!st.webStrategy || st.webStrategy.length < 100) {
      html += '<button class="btn btn-ghost sm" data-tip="Generates a shorter website-focused brief for downstream stages" onclick="synthesiseWebStrategy()"><i class="ti ti-file-description"></i> Generate Website Brief</button>';
    }
    html += '<button class="btn btn-ghost sm" data-tip="Re-reads live pricing catalog and recalculates investment without re-running diagnostics" onclick="recalculateInvestment()"><i class="ti ti-calculator"></i> Recalculate Investment</button>';
  } else {
    html += '<div class="card" style="color:var(--n2);text-align:center;padding:20px"><p>Generate strategy diagnostics first, then compile the output document here.</p></div>';
    return html;
  }
  html += '</div>';

  // Audit summary across all diagnostics
  var audit = st._audit || {};
  var hasAudit = Object.keys(audit).length > 0;
  if (hasAudit) {
    var diagLabelsShort = { 0:'Audience', 1:'Economics', 2:'Position', 3:'Subtraction', 4:'Channels', 5:'Website', 6:'Content', 7:'Risks', 8:'Narrative', 9:'Sales' };
    html += '<div class="card" style="margin-bottom:14px;padding:12px 16px">';
    html += '<div style="font-size:12px;font-weight:500;margin-bottom:8px">Diagnostic Audit Summary</div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    var diagNums = [0,1,2,3,4,5,6,7,8,9];
    for (var di = 0; di < diagNums.length; di++) {
      var d = diagNums[di];
      var au = audit[d];
      if (!au) {
        html += '<div style="flex:1;min-width:80px;padding:6px 8px;border-radius:6px;background:var(--bg2);text-align:center">';
        html += '<div style="font-size:9px;color:var(--n2)">' + diagLabelsShort[d] + '</div>';
        html += '<div style="font-size:11px;color:var(--n2)">Not run</div>';
        html += '</div>';
        continue;
      }
      var rate = au.total > 0 ? Math.round((au.pass / au.total) * 100) : 0;
      var ac = rate >= 80 ? 'var(--green)' : rate >= 50 ? '#e6a23c' : '#f56c6c';
      html += '<div style="flex:1;min-width:80px;padding:6px 8px;border-radius:6px;background:var(--bg2);text-align:center">';
      html += '<div style="font-size:9px;color:var(--n2)">' + diagLabelsShort[d] + '</div>';
      html += '<div style="font-size:14px;font-weight:600;color:' + ac + '">' + au.pass + '/' + au.total + '</div>';
      html += '<div style="font-size:9px;color:' + ac + '">' + rate + '%</div>';
      html += '</div>';
    }
    html += '</div></div>';
  }

  // Keyword pipeline audit
  var kwAudit2 = auditKeywordPipeline();
  if (kwAudit2.overall.total > 0) {
    var kwStages = ['seeds', 'opportunities', 'clusters'];
    var kwStageLabels = { seeds: 'Seeds', opportunities: 'Opportunities', clusters: 'Clusters' };
    html += '<div class="card" style="margin-bottom:14px;padding:12px 16px">';
    html += '<div style="font-size:12px;font-weight:500;margin-bottom:8px">Keyword Pipeline Audit</div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
    kwStages.forEach(function(stage) {
      var au2 = kwAudit2[stage];
      var rate2 = au2.total > 0 ? Math.round((au2.pass / au2.total) * 100) : 0;
      var ac2 = rate2 >= 80 ? 'var(--green)' : rate2 >= 50 ? '#e6a23c' : '#f56c6c';
      html += '<div style="flex:1;min-width:100px;padding:6px 8px;border-radius:6px;background:var(--bg2);text-align:center">';
      html += '<div style="font-size:9px;color:var(--n2)">' + kwStageLabels[stage] + '</div>';
      html += '<div style="font-size:14px;font-weight:600;color:' + ac2 + '">' + au2.pass + '/' + au2.total + '</div>';
      html += '</div>';
    });
    html += '</div>';
    // Show failed checks
    var kwFailed = [];
    kwStages.forEach(function(stage) {
      kwAudit2[stage].items.forEach(function(item) {
        if (!item.passed) kwFailed.push({ stage: kwStageLabels[stage], label: item.label });
      });
    });
    if (kwFailed.length > 0) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 16px">';
      kwFailed.forEach(function(f) {
        html += '<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0">';
        html += '<i class="ti ti-circle-x-filled" style="color:#f56c6c;font-size:12px"></i>';
        html += '<span style="color:var(--n2)">' + esc(f.stage) + ':</span> ' + esc(f.label);
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
  }

  // Investment Summary (from pricing engine)
  html += _renderInvestmentSummary();

  // Margin Analysis (internal only)
  html += _renderMarginAnalysis();

  // Compiled output document
  if (output) {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="font-size:12px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em">Compiled Strategy Document</div>';
    html += '<div style="display:flex;align-items:center;gap:6px">';
    if (meta.current_version > 0) html += '<span style="font-size:10px;color:var(--n2)">v' + meta.current_version + '</span>';
    html += '<button class="btn btn-ghost sm" onclick="copyStrategyDoc()" style="font-size:10px;padding:2px 8px" data-tip="Copy full strategy document to clipboard"><i class="ti ti-copy" style="font-size:11px"></i> Copy</button>';
    html += '<button class="btn btn-ghost sm" onclick="downloadStrategyDoc()" style="font-size:10px;padding:2px 8px" data-tip="Download strategy as markdown file"><i class="ti ti-download" style="font-size:11px"></i> Download .md</button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="card" style="padding:24px 28px;margin-bottom:14px">';
    html += '<div style="font-size:13px;line-height:1.7;font-family:var(--font)">' + sanitiseHTML(_markdownToHtml(output)) + '</div>';
    html += '</div>';
  }

  // Website strategy brief (shorter version)
  if (st.webStrategy && st.webStrategy.trim()) {
    html += '<div style="margin-top:14px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="font-size:12px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em">Website Strategy Brief</div>';
    html += '<button class="btn btn-ghost sm" style="font-size:10px" onclick="synthesiseWebStrategy()"><i class="ti ti-refresh"></i> Regenerate</button>';
    html += '</div>';
    html += '<div class="card" style="padding:16px">';
    html += '<div style="font-size:13px;line-height:1.7;font-family:var(--font)">' + sanitiseHTML(_markdownToHtml(st.webStrategy)) + '</div>';
    html += '</div></div>';
  }

  return html;
}

// Simple markdown to HTML for compiled output
function _markdownToHtml(md) {
  if (!md) return '';
  return md
    // H1 — document title
    .replace(/^# (.+)$/gm, '<h2 style="font-size:18px;font-weight:700;margin:0 0 4px;color:var(--dark);letter-spacing:-0.02em">$1</h2>')
    // H2 with numbered sections — major section headers
    .replace(/^## (\d+)\.\s+(.+)$/gm, '<div style="border-top:2px solid var(--border);margin:24px 0 12px;padding-top:16px"><h3 style="font-size:13px;font-weight:600;color:var(--dark);margin:0;display:flex;align-items:center;gap:8px"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--green);color:#fff;font-size:10px;font-weight:700;flex-shrink:0">$1</span>$2</h3></div>')
    // H2 — other headings
    .replace(/^## (.+)$/gm, '<h3 style="font-size:14px;font-weight:600;margin:20px 0 8px;color:var(--dark)">$1</h3>')
    // H3 — sub-headings
    .replace(/^### (.+)$/gm, '<h4 style="font-size:13px;font-weight:600;margin:14px 0 6px;color:var(--n3)">$1</h4>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:12px 0">')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--dark)">$1</strong>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;margin-bottom:3px;color:var(--n3)">$1</li>')
    // Numbered list items
    .replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-left:16px;margin-bottom:3px;list-style-type:decimal;color:var(--n3)">$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p style="margin:8px 0;color:var(--n3)">')
    .replace(/\n/g, '<br>');
}

// ── Demand Tab (rendered via Keywords tab) ─────────────────────────────

// The Keywords tab in strategy mounts the existing keywords.js functionality.
// D8 demand validation data is also accessible from the scorecard.
// When keywords stage completes, demand_validation is populated from the keyword data.

// ── Version History Viewer ─────────────────────────────────────────────

function showStrategyHistory() {
  var meta = (S.strategy || {})._meta;
  if (!meta || !meta.versions || meta.versions.length === 0) return;

  var versions = meta.versions.slice().reverse(); // newest first
  var sections = Object.keys(STRATEGY_SECTION_WEIGHTS);

  var html = '<div style="max-height:70vh;overflow-y:auto;padding:4px">';

  // ── Score trend chart (simple sparkline table) ──
  html += '<div style="margin-bottom:18px">';
  html += '<div style="font-size:12px;font-weight:600;margin-bottom:8px">Score Trend</div>';
  html += '<div style="display:flex;align-items:flex-end;gap:6px;height:80px">';
  meta.versions.forEach(function(v) {
    var h = Math.round((v.overall_score / 10) * 72);
    var c = v.overall_score >= 7 ? 'var(--green)' : v.overall_score >= 4 ? '#e6a23c' : '#f56c6c';
    html += '<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:28px">';
    html += '<span style="font-size:9px;font-weight:600;color:' + c + ';margin-bottom:2px">' + v.overall_score + '</span>';
    html += '<div style="width:100%;max-width:32px;height:' + Math.max(h, 4) + 'px;background:' + c + ';border-radius:3px 3px 0 0;transition:height .3s"></div>';
    html += '<span style="font-size:8px;color:var(--n2);margin-top:3px">v' + v.version + '</span>';
    html += '</div>';
  });
  html += '</div></div>';

  // ── Per-version cards ──
  versions.forEach(function(v, idx) {
    var isCurrent = v.version === meta.current_version;
    var border = isCurrent ? 'border:1px solid var(--blue)' : 'border:1px solid var(--border)';
    var c = v.overall_score >= 7 ? 'var(--green)' : v.overall_score >= 4 ? '#e6a23c' : '#f56c6c';

    html += '<div style="' + border + ';border-radius:8px;padding:14px;margin-bottom:10px">';

    // Header row
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span style="font-size:16px;font-weight:600;color:' + c + '">' + v.overall_score + '</span>';
    html += '<div>';
    html += '<span style="font-size:13px;font-weight:500">Version ' + v.version + '</span>';
    if (isCurrent) html += ' <span style="font-size:9px;color:var(--blue);border:1px solid var(--blue);padding:1px 5px;border-radius:3px">Current</span>';
    if (v.approved) html += ' <span style="font-size:9px;color:var(--green);border:1px solid var(--green);padding:1px 5px;border-radius:3px">Approved</span>';
    html += '<div style="font-size:10px;color:var(--n2)">' + _fmtVersionDate(v.created) + ' \u2014 ' + _fmtTrigger(v.trigger) + '</div>';
    html += '</div></div>';

    // Revert button (only for non-current, non-first versions)
    if (!isCurrent && meta.versions.length > 1) {
      html += '<div id="strat-revert-wrap-' + v.version + '"></div>';
    }
    html += '</div>';

    // Section score comparison
    html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">';
    sections.forEach(function(sec) {
      var ss = (v.section_scores && v.section_scores[sec]) || 0;
      var prevV = _getPrevVersion(meta.versions, v.version);
      var prevSs = prevV && prevV.section_scores ? (prevV.section_scores[sec] || 0) : null;
      var sc = ss >= 7 ? 'var(--green)' : ss >= 4 ? '#e6a23c' : '#f56c6c';
      var delta = '';
      if (prevSs !== null) {
        var diff = +(ss - prevSs).toFixed(1);
        if (diff > 0) delta = ' <span style="color:var(--green);font-size:8px">+' + diff + '</span>';
        else if (diff < 0) delta = ' <span style="color:#f56c6c;font-size:8px">' + diff + '</span>';
      }
      html += '<div style="flex:1;min-width:80px;padding:4px 6px;border-radius:4px;background:var(--bg2)">';
      html += '<div style="font-size:9px;color:var(--n2)">' + (STRATEGY_SECTION_LABELS[sec] || sec) + '</div>';
      html += '<div style="font-size:12px;font-weight:600;color:' + sc + '">' + ss + delta + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Gaps at time of version
    if (v.gaps_identified && v.gaps_identified.length > 0) {
      html += '<div style="font-size:10px;color:var(--n2);margin-top:4px">';
      html += '<span style="font-weight:500">Gaps:</span> ' + v.gaps_identified.slice(0, 4).map(function(g) { return esc(g); }).join(', ');
      if (v.gaps_identified.length > 4) html += ' +' + (v.gaps_identified.length - 4) + ' more';
      html += '</div>';
    }

    // Known limitations
    if (v.known_limitations && v.known_limitations.length > 0) {
      html += '<div style="font-size:10px;color:#e6a23c;margin-top:3px">';
      html += v.known_limitations.map(function(l) { return '<i class="ti ti-alert-triangle" style="font-size:10px"></i> ' + esc(l); }).join(' \u00b7 ');
      html += '</div>';
    }

    html += '</div>';
  });

  html += '</div>';

  // Use the existing modal system
  var overlay = document.createElement('div');
  overlay.id = 'strategy-history-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.45);z-index:550;display:flex;align-items:center;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg);border-radius:12px;padding:20px;width:640px;max-width:92vw;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.15)';

  // Modal header
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-shrink:0';
  header.innerHTML = '<div style="font-size:15px;font-weight:600"><i class="ti ti-history" style="margin-right:6px"></i>Strategy Version History</div>';
  var closeBtn = document.createElement('button');
  closeBtn.className = 'btn btn-ghost sm';
  closeBtn.innerHTML = '<i class="ti ti-x"></i>';
  closeBtn.onclick = function() { overlay.remove(); };
  header.appendChild(closeBtn);
  modal.appendChild(header);

  var body = document.createElement('div');
  body.style.cssText = 'overflow-y:auto;flex:1';
  body.innerHTML = html;
  modal.appendChild(body);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Wire revert buttons via createElement (no inline onclick concat)
  versions.forEach(function(v) {
    if (v.version === meta.current_version) return;
    var wrap = document.getElementById('strat-revert-wrap-' + v.version);
    if (!wrap) return;
    var btn = document.createElement('button');
    btn.className = 'btn btn-ghost sm';
    btn.style.fontSize = '10px';
    btn.innerHTML = '<i class="ti ti-arrow-back-up"></i> Revert';
    btn.onclick = function() { _revertToVersion(v.version); overlay.remove(); };
    wrap.appendChild(btn);
  });
}

function _fmtVersionDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
}

function _fmtTrigger(trigger) {
  var map = { auto_draft: 'Initial generation', auto_improve: 'AI improvement', rerun_all: 'Full re-run', manual: 'Manual edit', revert: 'Reverted' };
  return map[trigger] || trigger || 'Unknown';
}

function _getPrevVersion(versions, ver) {
  for (var i = 0; i < versions.length; i++) {
    if (versions[i].version === ver && i > 0) return versions[i - 1];
  }
  return null;
}

function _revertToVersion(targetVer) {
  var meta = (S.strategy || {})._meta;
  if (!meta || !meta.versions) return;

  // Find the target version snapshot
  var target = null;
  for (var i = 0; i < meta.versions.length; i++) {
    if (meta.versions[i].version === targetVer) { target = meta.versions[i]; break; }
  }
  if (!target) return;

  // Create a revert version entry (we do not delete history)
  var revertVersion = {
    version: meta.current_version + 1,
    created: new Date().toISOString(),
    trigger: 'revert',
    overall_score: target.overall_score,
    section_scores: Object.assign({}, target.section_scores),
    gaps_identified: (target.gaps_identified || []).slice(),
    changes_from_previous: 'Reverted to v' + targetVer,
    strategist_overrides: [],
    approved: false,
    known_limitations: (target.known_limitations || []).slice()
  };

  meta.current_version = revertVersion.version;
  meta.overall_score = revertVersion.overall_score;
  meta.approved = false;
  meta.versions.push(revertVersion);

  scheduleSave();
  renderStrategyScorecard();
  renderStrategyTabContent();
  aiBarNotify('Reverted to version ' + targetVer + ' (now v' + revertVersion.version + ')');
}

// ── Strategy helpers for downstream consumers ─────────────────────────

// These helper functions let downstream stages read strategic fields
// with automatic fallback to S.research for backward compatibility.

function getStrategyField(stratPath, researchFallback) {
  var st = S.strategy || {};
  // Navigate stratPath
  var parts = stratPath.split('.');
  var val = st;
  for (var i = 0; i < parts.length; i++) {
    if (!val) break;
    val = val[parts[i]];
  }
  if (val !== undefined && val !== null && val !== '') return val;
  // Fallback to research
  if (researchFallback) {
    var r = S.research || {};
    var rParts = researchFallback.split('.');
    var rVal = r;
    for (var j = 0; j < rParts.length; j++) {
      if (!rVal) break;
      rVal = rVal[rParts[j]];
    }
    return rVal;
  }
  return val;
}
