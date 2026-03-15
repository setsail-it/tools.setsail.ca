// ══════════════════════════════════════════════════════════════════════
// strategy.js — Strategy Engine (Stage 4)
// Research gathers facts. Strategy makes decisions.
// ══════════════════════════════════════════════════════════════════════

// ── Constants ─────────────────────────────────────────────────────────

var STRATEGY_TABS = [
  { id:'positioning',  label:'Positioning',  icon:'ti-target' },
  { id:'economics',    label:'Economics',    icon:'ti-calculator' },
  { id:'channels',     label:'Channels',     icon:'ti-chart-dots-3' },
  { id:'growth',       label:'Growth Plan',  icon:'ti-trending-up' },
  { id:'execution',    label:'Execution',    icon:'ti-checklist' },
  { id:'brand',        label:'Brand',        icon:'ti-palette' },
  { id:'risks',        label:'Risks',        icon:'ti-alert-triangle' },
  { id:'keywords',     label:'Keywords',     icon:'ti-tags' }
];

var STRATEGY_SECTION_WEIGHTS = {
  positioning: 0.20,
  economics:   0.15,
  channels:    0.20,
  growth:      0.15,
  execution:   0.10,
  brand:       0.10,
  risks:       0.10
};

var STRATEGY_SECTION_LABELS = {
  positioning: 'Positioning',
  economics:   'Unit Economics',
  channels:    'Channel Strategy',
  growth:      'Growth Plan',
  execution:   'Website & CRO',
  brand:       'Content & Authority',
  risks:       'Risk Assessment'
};

// Required inputs per section — for data completeness scoring
var STRATEGY_REQUIRED_INPUTS = {
  positioning: [
    { key:'competitors',          path:'S.research.competitors',            check:'array_min_2' },
    { key:'services_detail',      path:'S.research.services_detail',        check:'array' },
    { key:'pain_points_top5',     path:'S.research.pain_points_top5',       check:'array' },
    { key:'best_customer_examples', path:'S.research.best_customer_examples', check:'string' },
    { key:'existing_proof',       path:'S.research.existing_proof',         check:'array' },
    { key:'competitor_deep_dive', path:'S.strategy._enrichment.competitor_deep_dive', check:'truthy' },
    { key:'strategy_doc',         path:'S.setup.strategy||S.setup.docs',    check:'any_doc' },
    { key:'industry',             path:'S.research.industry',               check:'string' }
  ],
  economics: [
    { key:'budget',               path:'S.research.monthly_marketing_budget', check:'string' },
    { key:'deal_size',            path:'S.research.average_deal_size',       check:'string' },
    { key:'close_rate',           path:'S.research.close_rate_estimate',     check:'string' },
    { key:'ltv',                  path:'S.research.customer_lifetime_value', check:'string' },
    { key:'lead_quality',         path:'S.research.lead_quality_percentage', check:'string' },
    { key:'goal',                 path:'S.research.primary_goal',            check:'string' },
    { key:'cpc_estimates',        path:'S.strategy._enrichment.cpc_estimates', check:'truthy' }
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
    { key:'goal',                 path:'S.research.primary_goal',            check:'string' }
  ],
  growth: [
    { key:'channel_strategy',     path:'S.strategy.channel_strategy',        check:'truthy' },
    { key:'unit_economics',       path:'S.strategy.unit_economics',          check:'truthy' },
    { key:'goal',                 path:'S.research.primary_goal',            check:'string' },
    { key:'budget',               path:'S.research.monthly_marketing_budget', check:'string' },
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
  ]
};

// Anti-inflation score caps
var ANTI_INFLATION_CAPS = [
  { condition:'no_validated_differentiators', section:'positioning', dimension:'confidence', cap:6,
    test: function() { return !S.strategy || !S.strategy.positioning || !S.strategy.positioning.validated_differentiators || !S.strategy.positioning.validated_differentiators.length; } },
  { condition:'estimated_close_rate', section:'economics', dimension:'data', cap:7,
    test: function() { var r=S.research||{}; return !r.close_rate_estimate || r.close_rate_estimate.indexOf('estimate')>=0 || r.close_rate_estimate.indexOf('~')>=0; } },
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
  { condition:'d8_insufficient', section:'channels', dimension:'confidence', cap:5,
    test: function() { return S.strategy && S.strategy.demand_validation && S.strategy.demand_validation.overall_verdict === 'insufficient'; } },
  { condition:'d8_high_severity', section:'_overall', dimension:'_cap', cap:6.5,
    test: function() {
      if (!S.strategy || !S.strategy.demand_validation || !S.strategy.demand_validation.strategic_revisions_needed) return false;
      return S.strategy.demand_validation.strategic_revisions_needed.some(function(r) { return r.impact_severity === 'high'; });
    } }
];

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
    demand_validation: {}
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
  switch (inputDef.check) {
    case 'string':     return typeof val === 'string' && val.trim().length > 0;
    case 'array':      return Array.isArray(val) && val.length > 0;
    case 'array_min_2': return Array.isArray(val) && val.length >= 2;
    case 'truthy':     return !!val && (typeof val !== 'object' || Object.keys(val).length > 0);
    case 'any_doc':    return !!val;
    default:           return !!val;
  }
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
  if (section === 'positioning') sectionData = st.positioning;
  else if (section === 'economics') sectionData = st.unit_economics;
  else if (section === 'channels') sectionData = st.channel_strategy;
  else if (section === 'growth') sectionData = st.growth_plan;
  else if (section === 'execution') sectionData = st.execution_plan;
  else if (section === 'brand') sectionData = st.brand_strategy;
  else if (section === 'risks') sectionData = st.risks;

  var hasContent = sectionData && Object.keys(sectionData).length > 0;
  var confidenceScore = hasContent ? 7 : 0;
  if (hasContent && sectionData.confidence === 'high') confidenceScore = 9;
  else if (hasContent && sectionData.confidence === 'medium') confidenceScore = 7;
  else if (hasContent && sectionData.confidence === 'low') confidenceScore = 4;

  // Specificity: higher if enrichment data is present, strategy doc exists
  var specificityScore = hasContent ? 6 : 0;
  if ((S.setup || {}).strategy) specificityScore += 1;
  if ((S.setup || {}).docs && S.setup.docs.length) specificityScore += 1.5;
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

  // D8 overall cap
  if (!S.strategy || !S.strategy.demand_validation || !S.strategy.demand_validation.overall_verdict) {
    if (overall > 6.5) overall = 6.5;
  }
  // High severity revision cap
  var d8Cap = ANTI_INFLATION_CAPS.find(function(c) { return c.condition === 'd8_high_severity'; });
  if (d8Cap && d8Cap.test() && overall > 6.5) overall = 6.5;

  return { overall: overall, sections: sections, gaps: allGaps };
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
    version.known_limitations.push('Keyword demand validation (D8) has not run yet');
  }
  if (!(S.setup || {}).docs || !S.setup.docs.length) {
    version.known_limitations.push('No reference documents uploaded — specificity may be limited');
  }

  meta.current_version = version.version;
  meta.overall_score = scores.overall;
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

  // Keyword demand validation (D8 data source)
  keywordDemandCheck: async function(vertical, geography, services) {
    var geo = (geography || '').replace(/,.*$/, '').trim().toLowerCase();
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
      if (!data.keywords) return { overall_verdict: 'insufficient', keyword_data_confidence: 'low' };

      var kws = data.keywords;
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
        var svcKws = kws.filter(function(k) { return k.kw.toLowerCase().indexOf(svcL.split(' ')[0]) >= 0; });
        var svcVol = svcKws.reduce(function(s, k) { return s + (k.vol || 0); }, 0);
        serviceDemand.push({ service: svc, total_vol: svcVol, keyword_count: svcKws.length, assessment: svcVol > 200 ? 'strong' : svcVol > 50 ? 'moderate' : 'weak' });
      });

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
        keyword_data_source: 'dataforseo',
        strategic_revisions_needed: []
      };
    } catch (e) {
      console.error('keywordDemandCheck error:', e);
      return { overall_verdict: 'insufficient', keyword_data_confidence: 'low', error: e.message };
    }
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
  ctx += 'BUSINESS MODEL: ' + (r.business_model || '') + '\n';
  ctx += 'BUSINESS OVERVIEW: ' + (r.business_overview || '') + '\n';
  if (r.primary_services && r.primary_services.length) ctx += 'SERVICES: ' + r.primary_services.join(', ') + '\n';
  if (r.primary_audience_description) ctx += 'AUDIENCE: ' + r.primary_audience_description + '\n';
  if (r.geography && r.geography.primary) ctx += 'PRIMARY GEO: ' + r.geography.primary + '\n';
  if (r.primary_goal) ctx += 'PRIMARY GOAL: ' + r.primary_goal + '\n';
  if (s.strategy) ctx += '\nSTRATEGY DOCUMENT:\n' + s.strategy.slice(0, 8000) + '\n';
  if (s.docs && s.docs.length) {
    ctx += '\nREFERENCE DOCUMENTS:\n';
    s.docs.forEach(function(d) { ctx += '\n--- ' + d.name + ' ---\n' + d.content.slice(0, 6000); });
  }
  return ctx;
}

function buildDiagnosticPrompt(num) {
  var r = S.research || {};
  var st = S.strategy || {};
  var enrich = st._enrichment || {};
  var ctx = _stratCtx();

  if (num === 1) {
    // D1: Unit Economics
    return ctx + '\n\nDIAGNOSTIC: Unit Economics Analysis\n\n'
      + 'CLIENT DATA:\n'
      + '- Monthly marketing budget: ' + (r.monthly_marketing_budget || 'UNKNOWN') + '\n'
      + '- Average deal size: ' + (r.average_deal_size || 'UNKNOWN') + '\n'
      + '- Close rate: ' + (r.close_rate_estimate || 'UNKNOWN \u2014 estimate from industry') + '\n'
      + '- Customer lifetime value: ' + (r.customer_lifetime_value || 'UNKNOWN \u2014 estimate from deal size') + '\n'
      + '- Lead quality (% sales-qualified): ' + (r.lead_quality_percentage || 'UNKNOWN \u2014 assume 30%') + '\n'
      + '- Primary goal: ' + (r.primary_goal || '') + '\n'
      + '- Current lead volume: ' + (r.current_lead_volume || 'UNKNOWN') + '\n'
      + '- Estimated CPC range: ' + (enrich.cpc_estimates ? '$' + enrich.cpc_estimates.min_cpc + ' - $' + enrich.cpc_estimates.max_cpc : 'UNKNOWN') + '\n\n'
      + 'TASK: Calculate unit economics. For UNKNOWN inputs, state your assumption. Mark every assumption explicitly.\n\n'
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
      + '  "pricing_strategy": "recommendation",\n'
      + '  "recommendation": "narrative recommendation",\n'
      + '  "assumptions": ["each assumption made"],\n'
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

    return ctx + '\n\nDIAGNOSTIC: Competitive Position Assessment\n\n'
      + 'CLIENT SERVICES: ' + JSON.stringify((r.services_detail || []).map(function(s) { return s.name; })) + '\n'
      + 'CLIENT CLAIMED STRENGTHS: ' + JSON.stringify(r.existing_proof || r.proof_points || []) + '\n'
      + 'CLIENT AWARDS/CERTS: ' + JSON.stringify(r.awards_certifications || []) + '\n\n'
      + 'COMPETITORS:\n' + (compInfo || 'No competitor data available') + '\n\n'
      + 'COMPETITOR DEEP-DIVE DATA:\n' + (deepDive || 'NOT YET AVAILABLE \u2014 score confidence lower') + '\n\n'
      + 'TASK: Validate differentiators against competitor reality. Identify unoccupied positioning territory.\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "market_position": "where client sits vs competitors",\n'
      + '  "authority_gap": "DR/content/backlink gap description",\n'
      + '  "positioning_gaps": ["territories no competitor is claiming"],\n'
      + '  "validated_differentiators": ["differentiators that survive scrutiny"],\n'
      + '  "rejected_differentiators": [{"claim": "string", "reason": "which competitor contests this"}],\n'
      + '  "competitive_advantages": ["genuine advantages"],\n'
      + '  "biggest_threat": "string",\n'
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
      + '    "voice_rationale": "string"\n'
      + '  },\n'
      + '  "proof_strategy": ["proof to build that does not exist yet"],\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 3) {
    // D3: Subtraction Analysis
    return ctx + '\n\nDIAGNOSTIC: Subtraction Analysis\n\n'
      + 'CURRENT LEAD CHANNELS: ' + JSON.stringify(r.lead_channels_today || []) + '\n'
      + 'CURRENT LEAD VOLUME: ' + (r.current_lead_volume || 'UNKNOWN') + '\n'
      + 'MONTHLY BUDGET: ' + (r.monthly_marketing_budget || 'UNKNOWN') + '\n'
      + 'SITE PERFORMANCE: ' + JSON.stringify(enrich.current_presence || 'NOT ASSESSED') + '\n\n'
      + 'TASK: Analyse current marketing. For each activity: is it producing? CPL viable? Contributing to revenue?\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "activities_to_cut": [{"activity": "string", "current_spend": "string", "reason": "string", "confidence": "high | medium | low"}],\n'
      + '  "activities_to_restructure": [{"activity": "string", "issue": "string", "fix": "string"}],\n'
      + '  "activities_to_keep": [{"activity": "string", "reason": "string", "optimize": "string"}],\n'
      + '  "recoverable_budget": "string",\n'
      + '  "redirect_recommendation": "string",\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 4) {
    // D4: Channel & Lever Viability
    return ctx + '\n\nDIAGNOSTIC: Channel & Lever Viability Assessment\n\n'
      + 'UNIT ECONOMICS: ' + JSON.stringify(st.unit_economics || 'NOT YET CALCULATED') + '\n'
      + 'COMPETITIVE POSITION: ' + (st.positioning ? st.positioning.recommended_positioning_angle || '' : 'NOT YET ASSESSED') + '\n'
      + 'BUDGET: ' + (r.monthly_marketing_budget || 'UNKNOWN') + '\n'
      + 'AUDIENCE: ' + (r.primary_audience_description || '') + '\n'
      + 'SALES CYCLE: ' + (r.sales_cycle_length || 'UNKNOWN') + '\n'
      + 'CPC DATA: ' + JSON.stringify(enrich.cpc_estimates || 'UNKNOWN') + '\n\n'
      + 'TASK: Score ALL 13 levers on fit (1-10), economics (1-10), competitive_reality (1-10), goal_impact (1-10). '
      + 'Calculate priority scores. Check funnel coverage. Produce budget allocation.\n\n'
      + 'LEVERS: google_ads_search, google_display, meta_ads, seo, website, cro, email, remarketing, social_media, video, content_marketing, branding, local_seo\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "levers": [{"lever": "string", "category": "paid | organic | owned | earned", "funnel_stage": "awareness | consideration | conversion | nurture | retention", '
      + '"fit": 0, "economics": 0, "competitive_reality": 0, "goal_impact": 0, "priority_score": 0, '
      + '"recommendation": "string", "budget_allocation_pct": 0, "timeline_to_results": "string", "dependencies": ["string"]}],\n'
      + '  "priority_order": ["lever names in priority order"],\n'
      + '  "levers_not_recommended": [{"lever": "string", "reason": "string", "revisit_when": "string"}],\n'
      + '  "funnel_coverage": {\n'
      + '    "awareness": {"covered": false, "by": [], "gap": ""},\n'
      + '    "consideration": {"covered": false, "by": [], "gap": ""},\n'
      + '    "conversion": {"covered": false, "by": [], "gap": ""},\n'
      + '    "nurture": {"covered": false, "by": [], "gap": ""},\n'
      + '    "retention": {"covered": false, "by": [], "gap": ""}\n'
      + '  },\n'
      + '  "funnel_gaps_flagged": ["string"],\n'
      + '  "budget_allocation": {"total_monthly": 0, "by_lever": {}},\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 5) {
    // D5: Website & Conversion
    return ctx + '\n\nDIAGNOSTIC: Website & Conversion Assessment\n\n'
      + 'CURRENT SITE: ' + JSON.stringify(enrich.current_presence || 'NOT ASSESSED') + '\n'
      + 'HAS SERVICE PAGES: ' + (r.has_service_pages || 'unknown') + '\n'
      + 'HAS BLOG: ' + (r.has_blog || 'unknown') + '\n'
      + 'HAS FAQ: ' + (r.has_faq_section || 'unknown') + '\n'
      + 'BOOKING FLOW: ' + (r.booking_flow_description || 'unknown') + '\n'
      + 'SERVICES: ' + JSON.stringify((r.services_detail || []).map(function(s) { return s.name; })) + '\n'
      + 'AUDIENCE: ' + (r.primary_audience_description || '') + '\n\n'
      + 'TASK: Assess website and conversion infrastructure. Recommend build type, form strategy, page architecture.\n\n'
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
    return ctx + '\n\nDIAGNOSTIC: Content & Authority Gap Analysis\n\n'
      + 'COMPETITORS: ' + JSON.stringify((r.competitors || []).map(function(c) { return c.name + ' (' + c.url + ')'; })) + '\n'
      + 'COMPETITOR DEEP-DIVE: ' + JSON.stringify(enrich.competitor_deep_dive || 'NOT YET AVAILABLE') + '\n'
      + 'KEYWORD LANDSCAPE: ' + (kwData || 'NOT YET SCANNED') + '\n'
      + 'TEAM SIZE: ' + (r.team_size || 'unknown') + '\n\n'
      + 'TASK: Assess content and authority gap. Recommend content pillars, velocity, formats.\n\n'
      + 'JSON SCHEMA:\n{\n'
      + '  "content_pillars": ["topic pillar"],\n'
      + '  "content_priority": [{"topic": "string", "rationale": "string", "format": "string"}],\n'
      + '  "preferred_formats": ["blog | video | case_study | whitepaper | tool"],\n'
      + '  "content_velocity": "posts per month recommendation",\n'
      + '  "authority_building": "strategy for building domain authority",\n'
      + '  "local_seo_priority": "high | medium | low | not_applicable",\n'
      + '  "geo_targeting_strategy": "string",\n'
      + '  "confidence": "high | medium | low"\n}';
  }

  if (num === 7) {
    // D7: Risk Assessment
    return ctx + '\n\nDIAGNOSTIC: Risk Assessment\n\n'
      + 'UNIT ECONOMICS: ' + JSON.stringify(st.unit_economics || 'NOT CALCULATED') + '\n'
      + 'CHANNEL STRATEGY: ' + (st.channel_strategy && st.channel_strategy.priority_order ? st.channel_strategy.priority_order.join(', ') : 'NOT ASSESSED') + '\n'
      + 'SALES CYCLE: ' + (r.sales_cycle_length || 'unknown') + '\n'
      + 'TEAM SIZE: ' + (r.team_size || 'unknown') + '\n'
      + 'COMPETITORS: ' + (r.competitors ? r.competitors.length + ' identified' : 'none') + '\n'
      + 'DEMAND VALIDATION: ' + (st.demand_validation && st.demand_validation.overall_verdict ? st.demand_validation.overall_verdict : 'NOT YET RUN') + '\n\n'
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

  return '';
}

// ── Diagnostic Execution ──────────────────────────────────────────────

async function runDiagnostic(num) {
  if (!S.strategy) S.strategy = strategyDefaults();
  var label = 'D' + num + ': ';
  if (num === 1) label += 'Unit Economics';
  else if (num === 2) label += 'Competitive Position';
  else if (num === 3) label += 'Subtraction';
  else if (num === 4) label += 'Channel Viability';
  else if (num === 5) label += 'Website & CRO';
  else if (num === 6) label += 'Content & Authority';
  else if (num === 7) label += 'Risk Assessment';

  aiBarStart(label);
  try {
    var prompt = buildDiagnosticPrompt(num);
    if (!prompt) { aiBarEnd('No prompt for D' + num); return; }

    var result = await callClaude(DIAGNOSTIC_SYSTEM, prompt, null, 8000, label);
    var parsed = parseEnrichResult(result);
    if (!parsed) {
      aiBarNotify('D' + num + ': could not parse response', { duration: 4000 });
      console.error('D' + num + ' parse failed:', result.slice(0, 500));
      return;
    }

    // Merge into S.strategy
    if (num === 1) {
      S.strategy.unit_economics = parsed;
      // Derive targets
      S.strategy.targets = S.strategy.targets || {};
      if (parsed.budget_supports_leads) S.strategy.targets.monthly_lead_target = parsed.budget_supports_leads;
      if (parsed.estimated_market_cpl) S.strategy.targets.target_cpl = parsed.estimated_market_cpl;
      if (parsed.cpql) S.strategy.targets.target_cpql = parsed.cpql;
      if (parsed.estimated_cac) S.strategy.targets.target_cac = parsed.estimated_cac;
      if (parsed.ltv_cac_ratio) S.strategy.targets.ltv_cac_ratio = parsed.ltv_cac_ratio;
    } else if (num === 2) {
      S.strategy.positioning = parsed;
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
    } else if (num === 7) {
      S.strategy.risks = parsed;
    }

    scheduleSave();
    aiBarEnd(label + ' complete');
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('D' + num + ' error: ' + e.message, { duration: 5000 });
    console.error('D' + num + ' error:', e);
  }
}

// ── Iterative Loop ────────────────────────────────────────────────────

async function generateStrategy() {
  if (!S.strategy) S.strategy = strategyDefaults();
  window._aiStopAll = false;

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

    scheduleSave();

    // Step 2: Run diagnostics D1-D7 sequentially
    for (var d = 1; d <= 7; d++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Strategy paused (D' + d + '/7)',
          fn: function(args) { _resumeDiagnostics(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      if (d < 7) await new Promise(function(res) { setTimeout(res, 2000); });
    }

    // Step 3: Score and create version
    createStrategyVersion('auto_draft');
    scheduleSave();
    renderStrategyScorecard();
    _sTab = Object.keys(STRATEGY_SECTION_WEIGHTS)[0];
    renderStrategyNav();
    renderStrategyTabContent();
    aiBarEnd('Strategy v' + S.strategy._meta.current_version + ' generated');
  } catch (e) {
    if (e.name === 'AbortError') { aiBarEnd('Stopped'); return; }
    aiBarNotify('Strategy generation error: ' + e.message, { duration: 5000 });
    console.error('generateStrategy error:', e);
  }
}

async function _resumeDiagnostics(startFrom) {
  window._aiStopAll = false;
  try {
    for (var d = startFrom; d <= 7; d++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Strategy paused (D' + d + '/7)',
          fn: function(args) { _resumeDiagnostics(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      if (d < 7) await new Promise(function(res) { setTimeout(res, 2000); });
    }
    createStrategyVersion('auto_draft');
    scheduleSave();
    renderStrategyScorecard();
    renderStrategyTabContent();
    aiBarEnd('Strategy v' + S.strategy._meta.current_version + ' generated');
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
  var diagMap = { positioning: 2, economics: 1, channels: 4, growth: 4, execution: 5, brand: 6, risks: 7 };

  var diagsToRun = [];
  weakest.forEach(function(w) {
    var d = diagMap[w.section];
    if (d && diagsToRun.indexOf(d) < 0) diagsToRun.push(d);
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
      aiBarStart('D8: Keyword Demand Validation');
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
    scheduleSave();
    renderStrategyScorecard();
    renderStrategyTabContent();
    aiBarEnd('Strategy improved to v' + S.strategy._meta.current_version + ' (score: ' + S.strategy._meta.overall_score + ')');
  } catch (e) {
    if (e.name === 'AbortError') return;
    aiBarNotify('Improvement error: ' + e.message, { duration: 5000 });
  }
}

function approveStrategy() {
  if (!S.strategy) return;
  S.strategy._meta.approved = true;
  var v = S.strategy._meta.versions[S.strategy._meta.versions.length - 1];
  if (v) v.approved = true;
  scheduleSave();
  renderStrategyScorecard();
  renderStrategyTabContent();
  aiBarNotify('Strategy approved', { duration: 3000 });
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

var _sTab = 'positioning';
var _sSubLever = '';

// ── UI: Init ──────────────────────────────────────────────────────────

function strategyInit() {
  if (!S.strategy) S.strategy = strategyDefaults();
  renderStrategyScorecard();
  renderStrategyNav();
  renderStrategyTabContent();
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

  var html = '<div class="card" style="margin-bottom:14px;padding:14px 18px">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
  html += '<div style="display:flex;align-items:center;gap:10px">';
  html += '<span style="font-size:28px;font-weight:600;color:' + colour + '">' + overall + '</span>';
  html += '<div>';
  html += '<div style="font-size:12px;color:var(--n2)">Strategy Score</div>';
  if (meta.current_version > 0) {
    html += '<div style="font-size:10px;color:var(--n2);display:flex;align-items:center;gap:6px">v' + meta.current_version;
    if (meta.approved) html += ' <span style="color:var(--green)">Approved</span>';
    if (meta.versions && meta.versions.length > 1) html += ' <a href="#" onclick="event.preventDefault();showStrategyHistory()" style="color:var(--blue);font-size:10px">History</a>';
    html += '</div>';
  }
  html += '</div></div>';

  // Action buttons
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  if (meta.current_version === 0) {
    html += '<button class="btn btn-primary" onclick="generateStrategy()"><i class="ti ti-sparkles"></i> Generate Strategy</button>';
  } else {
    html += '<button class="btn btn-ghost" onclick="generateStrategy()"><i class="ti ti-refresh"></i> Regenerate</button>';
    html += '<button class="btn btn-primary" onclick="improveStrategy()"><i class="ti ti-sparkles"></i> Improve Weakest</button>';
  }
  if (meta.current_version > 0 && !meta.approved) {
    html += '<button class="btn btn-dark" onclick="approveStrategy()"><i class="ti ti-check"></i> Approve</button>';
  }
  html += '</div></div>';

  // Per-section progress bars
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
  Object.keys(STRATEGY_SECTION_WEIGHTS).forEach(function(sec) {
    var secScore = scores.sections[sec] ? scores.sections[sec].score : 0;
    var sc = secScore >= 7 ? 'var(--green)' : secScore >= 4 ? '#e6a23c' : '#f56c6c';
    html += '<div style="flex:1;min-width:90px;cursor:pointer" onclick="_sTab=\'' + sec + '\';renderStrategyNav();renderStrategyTabContent()">';
    html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--n2);margin-bottom:3px">';
    html += '<span>' + (STRATEGY_SECTION_LABELS[sec] || sec) + '</span><span>' + secScore + '</span></div>';
    html += '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">';
    html += '<div style="height:100%;width:' + (secScore * 10) + '%;background:' + sc + ';border-radius:2px;transition:width .3s"></div>';
    html += '</div></div>';
  });
  html += '</div>';

  // D8 status
  if (!S.strategy.demand_validation || !S.strategy.demand_validation.overall_verdict) {
    html += '<div style="font-size:11px;color:#e6a23c;margin-top:6px"><i class="ti ti-alert-triangle" style="font-size:12px"></i> Keyword demand validation has not run yet \u2014 score capped at 6.5</div>';
  } else {
    var verdict = S.strategy.demand_validation.overall_verdict;
    var vc = verdict === 'viable' ? 'var(--green)' : verdict === 'marginal' ? '#e6a23c' : '#f56c6c';
    html += '<div style="font-size:11px;color:' + vc + ';margin-top:6px">Demand: ' + verdict + '</div>';
  }

  // Proceed gate
  if (meta.current_version > 0) {
    html += '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;display:flex;align-items:center;justify-content:space-between">';
    if (canProceedFromStrategy()) {
      html += '<span style="font-size:11px;color:var(--green)">Ready to proceed to Sitemap</span>';
      html += '<button class="btn btn-primary sm" onclick="goTo(\'sitemap\')"><i class="ti ti-arrow-right"></i> Proceed</button>';
    } else if (!S.strategy.demand_validation || !S.strategy.demand_validation.overall_verdict) {
      html += '<span style="font-size:11px;color:#e6a23c">Run keyword demand validation before proceeding</span>';
      html += '<button class="btn btn-ghost sm" onclick="improveStrategy()"><i class="ti ti-sparkles"></i> Run D8</button>';
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
    html += '</button>';
  });
  el.innerHTML = html;
}

// ── UI: Tab Content ───────────────────────────────────────────────────

function renderStrategyTabContent() {
  var el = document.getElementById('strategy-tab-content');
  if (!el) return;

  if (_sTab === 'keywords') {
    // Mount keywords.js into this container
    el.innerHTML = '<div id="strategy-kw-wrap">'
      + '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px" id="kw-tab-nav"></div>'
      + '<div id="kw-tab-content"></div>'
      + '</div>';
    initKeywords();
    return;
  }

  var st = S.strategy || {};
  var html = '';

  // Re-run diagnostic button
  var diagMap = { positioning: 2, economics: 1, channels: 4, growth: 4, execution: 5, brand: 6, risks: 7 };
  var diagNum = diagMap[_sTab];
  if (diagNum) {
    html += '<div style="display:flex;gap:6px;margin-bottom:14px">';
    html += '<button class="btn btn-ghost sm" onclick="runDiagnostic(' + diagNum + ').then(function(){renderStrategyScorecard();renderStrategyTabContent()})"><i class="ti ti-refresh"></i> Re-run D' + diagNum + '</button>';
    html += '</div>';
  }

  // Gap panel
  if (STRATEGY_SECTION_WEIGHTS[_sTab]) {
    var sScore = scoreSection(_sTab);
    if (sScore.gaps.length > 0 && sScore.score < 7) {
      html += _renderGapPanel(sScore);
    }
  }

  // Section content
  if (_sTab === 'positioning') html += _renderPositioning(st);
  else if (_sTab === 'economics') html += _renderEconomics(st);
  else if (_sTab === 'channels') html += _renderChannels(st);
  else if (_sTab === 'growth') html += _renderGrowth(st);
  else if (_sTab === 'execution') html += _renderExecution(st);
  else if (_sTab === 'brand') html += _renderBrand(st);
  else if (_sTab === 'risks') html += _renderRisks(st);

  el.innerHTML = html;
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
  if (Array.isArray(value)) value = value.join(', ');
  if (typeof value === 'object') value = JSON.stringify(value, null, 2);
  var isLong = String(value).length > 100 || opts.textarea;
  var h = '<div style="margin-bottom:10px;' + (opts.span ? 'grid-column:1/-1;' : '') + '">';
  h += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">' + esc(label) + '</div>';
  if (isLong) {
    h += '<div style="font-size:13px;color:var(--dark);background:var(--panel);border-radius:6px;padding:8px 10px;white-space:pre-wrap;max-height:200px;overflow-y:auto">' + esc(String(value)) + '</div>';
  } else {
    h += '<div style="font-size:13px;color:var(--dark)">' + esc(String(value) || '\u2014') + '</div>';
  }
  h += '</div>';
  return h;
}

function _stratSection(title, content) {
  return '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">'
    + esc(title) + '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px">' + content + '</div></div>';
}

function _renderPositioning(st) {
  var p = st.positioning || {};
  if (!p.core_value_proposition && !p.recommended_positioning_angle) {
    return '<div class="card" style="color:var(--n2);text-align:centre"><p>No positioning data yet. Generate strategy to populate.</p></div>';
  }
  var html = '';
  html += _stratSection('Positioning',
    _stratField('Positioning Angle', p.recommended_positioning_angle, {span:true}) +
    _stratField('Core Value Proposition', p.core_value_proposition, {span:true, textarea:true}) +
    _stratField('Recommended Tagline', p.recommended_tagline) +
    _stratField('Competitive Counter', p.competitive_counter, {textarea:true})
  );
  if (p.validated_differentiators && p.validated_differentiators.length) {
    html += _stratSection('Validated Differentiators', _stratField('Validated', p.validated_differentiators, {span:true}));
  }
  if (p.rejected_differentiators && p.rejected_differentiators.length) {
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
    return '<div class="card" style="color:var(--n2);text-align:centre"><p>No economics data yet. Generate strategy to populate.</p></div>';
  }
  var html = '';
  html += _stratSection('Unit Economics',
    _stratField('Max Allowable CPL', ue.max_allowable_cpl ? '$' + ue.max_allowable_cpl : '') +
    _stratField('Estimated Market CPL', ue.estimated_market_cpl ? '$' + ue.estimated_market_cpl : '') +
    _stratField('Budget Supports (leads/mo)', ue.budget_supports_leads) +
    _stratField('Client Target Leads', ue.client_target_leads) +
    _stratField('Gap', ue.gap, {span:true}) +
    _stratField('CPQL', ue.cpql ? '$' + ue.cpql : '') +
    _stratField('Estimated CAC', ue.estimated_cac ? '$' + ue.estimated_cac : '') +
    _stratField('LTV', ue.ltv ? '$' + ue.ltv : '') +
    _stratField('LTV:CAC Ratio', ue.ltv_cac_ratio) +
    _stratField('LTV:CAC Health', ue.ltv_cac_health) +
    _stratField('Paid Media Viable', ue.paid_media_viable ? 'Yes' : 'No')
  );
  html += _stratSection('Pricing & Recommendation',
    _stratField('Pricing Strategy', ue.pricing_strategy, {span:true, textarea:true}) +
    _stratField('Recommendation', ue.recommendation, {span:true, textarea:true})
  );
  if (ue.assumptions && ue.assumptions.length) {
    html += _stratSection('Assumptions', _stratField('Assumptions', ue.assumptions, {span:true}));
  }
  return html;
}

function _renderChannels(st) {
  var cs = st.channel_strategy || {};
  if (!cs.levers || !cs.levers.length) {
    return '<div class="card" style="color:var(--n2);text-align:centre"><p>No channel data yet. Generate strategy to populate.</p></div>';
  }
  var html = '';

  // Priority order table
  html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Channel Priority</div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Lever</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Fit</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Econ</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Comp</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Impact</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Priority</th>'
    + '<th style="padding:6px 4px;font-weight:500;color:var(--n2)">Budget %</th>'
    + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Timeline</th></tr>';
  cs.levers.sort(function(a, b) { return (b.priority_score || 0) - (a.priority_score || 0); }).forEach(function(lev) {
    html += '<tr style="border-bottom:1px solid var(--border)">';
    html += '<td style="padding:6px 8px;font-weight:500">' + esc(lev.lever || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (lev.fit || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (lev.economics || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (lev.competitive_reality || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (lev.goal_impact || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center;font-weight:600">' + (lev.priority_score || '') + '</td>';
    html += '<td style="padding:6px 4px;text-align:center">' + (lev.budget_allocation_pct || 0) + '%</td>';
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
          covered + (fc.by && fc.by.length ? ' by ' + fc.by.join(', ') : '') + (fc.gap ? ' \u2014 ' + fc.gap : ''));
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

  // Timeline table (replaces Gantt)
  html += '<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--border)">Execution Timeline</div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Phase</th>'
    + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Lever</th>'
    + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Depends On</th>'
    + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Duration</th>'
    + '<th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--n2)">Notes</th></tr>';

  // Build timeline from channel strategy levers
  var levers = (st.channel_strategy && st.channel_strategy.levers) ? st.channel_strategy.levers.filter(function(l) { return l.priority_score > 3; }) : [];
  // Always include tracking/website as prerequisites
  var timelineItems = [
    { phase: 0, label: 'Tracking & Measurement', depends: [], duration: '2 weeks', notes: 'Setsail measurement product. Must complete before paid levers.' },
    { phase: 1, label: 'Website Build', depends: [], duration: '4-8 weeks', notes: 'Can start in parallel with tracking.' }
  ];
  levers.forEach(function(lev, idx) {
    timelineItems.push({
      phase: lev.dependencies && lev.dependencies.length ? 2 : 1,
      label: (lev.lever || '').replace(/_/g, ' '),
      depends: lev.dependencies || [],
      duration: lev.timeline_to_results || 'ongoing',
      notes: lev.recommendation ? lev.recommendation.slice(0, 80) : ''
    });
  });
  timelineItems.sort(function(a, b) { return a.phase - b.phase; });

  var phaseColours = { 0: '#e6a23c', 1: '#409eff', 2: 'var(--green)', 3: '#67c23a' };
  timelineItems.forEach(function(item) {
    html += '<tr style="border-bottom:1px solid var(--border)">';
    html += '<td style="padding:6px 8px"><span style="background:' + (phaseColours[item.phase] || 'var(--n2)') + ';color:white;font-size:9px;padding:1px 6px;border-radius:3px">P' + item.phase + '</span></td>';
    html += '<td style="padding:6px 8px;font-weight:500">' + esc(item.label) + '</td>';
    html += '<td style="padding:6px 8px;color:var(--n2)">' + esc((item.depends || []).join(', ') || '\u2014') + '</td>';
    html += '<td style="padding:6px 8px">' + esc(item.duration) + '</td>';
    html += '<td style="padding:6px 8px;color:var(--n2);font-size:11px">' + esc(item.notes) + '</td>';
    html += '</tr>';
  });
  html += '</table></div>';

  // Budget allocation
  if (gp.budget_allocation) {
    html += _stratSection('Budget Allocation',
      _stratField('Total Monthly', gp.budget_allocation.total_monthly ? '$' + gp.budget_allocation.total_monthly : '') +
      _stratField('By Lever', gp.budget_allocation.by_lever || {})
    );
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
          if (typeof val === 'object' && val !== null) val = JSON.stringify(val, null, 2);
          return _stratField(k.replace(/_/g, ' '), val, { textarea: String(val).length > 80 });
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

function _renderBrand(st) {
  var bs = st.brand_strategy || {};
  if (!bs.brand_work_needed && !bs.voice_direction) {
    // Show subtraction data if available
    var sub = st.subtraction || {};
    if (sub.activities_to_cut || sub.activities_to_restructure) {
      var html = '';
      if (sub.activities_to_cut && sub.activities_to_cut.length) {
        html += _stratSection('Activities to Cut',
          sub.activities_to_cut.map(function(a) {
            return _stratField(a.activity, a.reason + (a.current_spend ? ' (spend: ' + a.current_spend + ')' : ''));
          }).join('')
        );
      }
      if (sub.activities_to_restructure && sub.activities_to_restructure.length) {
        html += _stratSection('Activities to Restructure',
          sub.activities_to_restructure.map(function(a) {
            return _stratField(a.activity, a.issue + ' \u2192 ' + a.fix);
          }).join('')
        );
      }
      if (sub.recoverable_budget) {
        html += _stratField('Recoverable Budget', sub.recoverable_budget);
      }
      return html;
    }
    return '<div class="card" style="color:var(--n2);text-align:centre"><p>No brand/content data yet. Generate strategy to populate.</p></div>';
  }
  var html2 = '';
  html2 += _stratSection('Brand Assessment',
    _stratField('Brand Work Needed', bs.brand_work_needed) +
    _stratField('Rationale', bs.rationale, {textarea:true}) +
    _stratField('Brand as Bottleneck', bs.brand_as_bottleneck)
  );
  if (bs.voice_direction) {
    html2 += _stratSection('Voice Direction',
      _stratField('Style', bs.voice_direction.style) +
      _stratField('Tone', bs.voice_direction.tone_detail) +
      _stratField('Words to Use', bs.voice_direction.words_to_use) +
      _stratField('Words to Avoid', bs.voice_direction.words_to_avoid)
    );
  }
  if (bs.design_direction) {
    html2 += _stratSection('Design Direction',
      Object.keys(bs.design_direction).map(function(k) {
        return _stratField(k.replace(/_/g, ' '), bs.design_direction[k]);
      }).join('')
    );
  }
  return html2;
}

function _renderRisks(st) {
  var ri = st.risks || {};
  if (!ri.risks || !ri.risks.length) {
    return '<div class="card" style="color:var(--n2);text-align:centre"><p>No risk data yet. Generate strategy to populate.</p></div>';
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
  var map = { auto_draft: 'Initial generation', auto_improve: 'AI improvement', manual: 'Manual edit', revert: 'Reverted' };
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
