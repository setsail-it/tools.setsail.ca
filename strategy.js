// ══════════════════════════════════════════════════════════════════════
// strategy.js — Strategy Engine (Stage 4)
// Research gathers facts. Strategy makes decisions.
// ══════════════════════════════════════════════════════════════════════

// ── Constants ─────────────────────────────────────────────────────────

var STRATEGY_TABS = [
  { id:'positioning',  label:'Positioning',  icon:'ti-target' },
  { id:'economics',    label:'Economics',    icon:'ti-calculator' },
  { id:'subtraction',  label:'Subtraction',  icon:'ti-scissors' },
  { id:'channels',     label:'Channels',     icon:'ti-chart-dots-3' },
  { id:'growth',       label:'Growth Plan',  icon:'ti-trending-up' },
  { id:'execution',    label:'Execution',    icon:'ti-checklist' },
  { id:'brand',        label:'Brand',        icon:'ti-palette' },
  { id:'risks',        label:'Risks',        icon:'ti-alert-triangle' },
  { id:'keywords',     label:'Keywords',     icon:'ti-tags' },
  { id:'output',       label:'Output',       icon:'ti-file-text' }
];

var STRATEGY_SECTION_WEIGHTS = {
  positioning:  0.18,
  economics:    0.14,
  subtraction:  0.12,
  channels:     0.18,
  growth:       0.12,
  execution:    0.08,
  brand:        0.08,
  risks:        0.10
};

var STRATEGY_SECTION_LABELS = {
  positioning:  'Positioning',
  economics:    'Unit Economics',
  subtraction:  'Subtraction Analysis',
  channels:     'Channel Strategy',
  growth:       'Growth Plan',
  execution:    'Website & CRO',
  brand:        'Content & Authority',
  risks:        'Risk Assessment'
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
  { condition:'no_cpc_data_econ', section:'economics', dimension:'confidence', cap:6,
    test: function() { var e=S.strategy&&S.strategy._enrichment||{}; var kw=S.kwResearch||{}; return !e.cpc_estimates && (!kw.keywords || kw.keywords.filter(function(k){return k.cpc>0;}).length < 3); } },
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
    } }
];

// ── Audit Checks (per diagnostic) ─────────────────────────────────────
// Programmatic quality checks run after each diagnostic generation.
// Each check returns true (pass) or false (fail).

var STRATEGY_AUDIT_CHECKS = {
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
    { id:'rejected_tested',   label:'Rejected differentiators analysed',      check: function(d) { return d.rejected_differentiators && d.rejected_differentiators.length >= 1; } },
    { id:'proof_plan',        label:'Proof-building strategy included',       check: function(d) { return d.proof_strategy && d.proof_strategy.length >= 1; } }
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
    { id:'gaps_flagged',      label:'Funnel gaps identified',                check: function(d) { return d.funnel_gaps_flagged && d.funnel_gaps_flagged.length >= 0; } },
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
  ]
};

// ── Audit Runner ──────────────────────────────────────────────────────

function auditDiagnostic(num) {
  var checks = STRATEGY_AUDIT_CHECKS[num];
  if (!checks) return null;

  // Get the diagnostic output
  var st = S.strategy || {};
  var data = null;
  if (num === 1) data = st.unit_economics;
  else if (num === 2) data = st.positioning;
  else if (num === 3) data = st.subtraction;
  else if (num === 4) data = st.channel_strategy;
  else if (num === 5) data = st.execution_plan && st.execution_plan.lever_details ? st.execution_plan.lever_details.website : null;
  else if (num === 6) data = st.execution_plan && st.execution_plan.lever_details ? st.execution_plan.lever_details.content_marketing : null;
  else if (num === 7) data = st.risks;

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
  for (var d = 1; d <= 7; d++) {
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
  if (section === 'positioning') sectionData = st.positioning;
  else if (section === 'economics') sectionData = st.unit_economics;
  else if (section === 'subtraction') sectionData = st.subtraction;
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

  // D8 overall cap
  if (!S.strategy || !S.strategy.demand_validation || !S.strategy.demand_validation.overall_verdict) {
    if (overall > 6.5) overall = 6.5;
  }
  // High severity revision cap
  var d8Cap = ANTI_INFLATION_CAPS.find(function(c) { return c.condition === 'd8_high_severity'; });
  if (d8Cap && d8Cap.test() && overall > 6.5) overall = 6.5;

  // Subtraction cap — strategy without subtraction analysis is incomplete
  var subCap = ANTI_INFLATION_CAPS.find(function(c) { return c.condition === 'no_subtraction'; });
  if (subCap && subCap.test() && overall > 7.0) overall = 7.0;

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
  if ((!(S.setup || {}).docs || !S.setup.docs.length) && !(S.setup || {}).discoveryNotes) {
    version.known_limitations.push('No reference documents or discovery notes — specificity may be limited');
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
  if (r.primary_goal) ctx += 'PRIMARY GOAL: ' + r.primary_goal + '\n';
  if (r.secondary_goals && r.secondary_goals.length) ctx += 'SECONDARY GOALS: ' + (Array.isArray(r.secondary_goals) ? r.secondary_goals.join(', ') : r.secondary_goals) + '\n';
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
  return ctx;
}

function _versionLearningCtx(num) {
  var st = S.strategy || {};
  var audit = st._audit || {};
  var prevAudit = audit[num];
  if (!prevAudit || !prevAudit.items) return '';

  // Get previous output
  var prevOutput = null;
  if (num === 1) prevOutput = st.unit_economics;
  else if (num === 2) prevOutput = st.positioning;
  else if (num === 3) prevOutput = st.subtraction;
  else if (num === 4) prevOutput = st.channel_strategy;
  else if (num === 5) prevOutput = st.execution_plan && st.execution_plan.lever_details ? st.execution_plan.lever_details.website : null;
  else if (num === 6) prevOutput = st.execution_plan && st.execution_plan.lever_details ? st.execution_plan.lever_details.content_marketing : null;
  else if (num === 7) prevOutput = st.risks;

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

function buildDiagnosticPrompt(num) {
  var r = S.research || {};
  var st = S.strategy || {};
  var enrich = st._enrichment || {};
  var ctx = _stratCtx();

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
      + 'CLIENT DATA:\n'
      + '- Monthly marketing budget: ' + (r.monthly_marketing_budget || 'UNKNOWN') + '\n'
      + '- Average deal size: ' + (r.average_deal_size || 'UNKNOWN') + '\n'
      + '- Close rate: ' + (r.close_rate_estimate || 'UNKNOWN \u2014 estimate from industry') + '\n'
      + '- Customer lifetime value: ' + (r.customer_lifetime_value || 'UNKNOWN \u2014 estimate from deal size') + '\n'
      + '- Lead quality (% sales-qualified): ' + (r.lead_quality_percentage || 'UNKNOWN \u2014 assume 30%') + '\n'
      + '- Primary goal: ' + (r.primary_goal || '') + '\n'
      + '- Current lead volume: ' + (r.current_lead_volume || 'UNKNOWN') + '\n'
      + cpcBlock
      + (setup.estimated_engagement_size ? '- Estimated engagement size: ' + setup.estimated_engagement_size + '\n' : '')
      + (setup.decision_timeline ? '- Decision timeline: ' + setup.decision_timeline + '\n' : '') + '\n'
      + 'TASK: Calculate unit economics. Use the MARKET CPC DATA above to ground your estimated_market_cpl and paid_media_viable assessment \u2014 do not guess CPC when real data is available. For UNKNOWN inputs, state your assumption. Mark every assumption explicitly.\n\n'
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
      + 'TEAM SIZE: ' + (r.team_size || 'unknown') + '\n'
      + 'INDUSTRY: ' + (r.industry || 'unknown') + '\n\n'
      + 'TASK: Produce a full content and authority gap analysis with these sections:\n'
      + '1. Content pillars and velocity\n'
      + '2. Domain authority gap analysis with competitor comparison\n'
      + '3. Authority building timeline in 3 phases\n'
      + '4. Quick wins (low-effort, high-impact content actions)\n\n'
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

  return '';
}

// Append strategist notes to any diagnostic prompt
function _appendStrategistNotes(prompt, diagNum) {
  // D4 feeds both channels and growth tabs
  var diagToTabs = { 1: ['economics'], 2: ['positioning'], 3: ['subtraction'], 4: ['channels', 'growth'], 5: ['execution'], 6: ['brand'], 7: ['risks'] };
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
    // Append version learning context if re-running
    prompt += _versionLearningCtx(num);
    // Append strategist notes if present
    prompt = _appendStrategistNotes(prompt, num);

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

    await saveProject();

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
    await saveProject();
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
    await saveProject();
    renderStrategyScorecard();
    renderStrategyTabContent();
    aiBarEnd('Strategy v' + S.strategy._meta.current_version + ' generated');
  } catch (e) {
    if (e.name === 'AbortError') return;
    aiBarNotify('Error: ' + e.message, { duration: 5000 });
  }
}

async function runAllDiagnostics() {
  if (!S.strategy) S.strategy = strategyDefaults();
  window._aiStopAll = false;
  aiBarStart('Running all diagnostics (1/7)');
  try {
    for (var d = 1; d <= 7; d++) {
      if (window._aiStopAll) {
        window._aiStopResumeCtx = {
          label: 'Diagnostics paused (' + d + '/7)',
          fn: function(args) { _resumeAllDiagnostics(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      if (d < 7) await new Promise(function(res) { setTimeout(res, 2000); });
    }
    createStrategyVersion('rerun_all');
    await saveProject();
    renderStrategyScorecard();
    renderStrategyNav();
    renderStrategyTabContent();
    aiBarEnd('All diagnostics complete \u2014 v' + S.strategy._meta.current_version + ' (score: ' + S.strategy._meta.overall_score + ')');
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
          label: 'Diagnostics paused (' + d + '/7)',
          fn: function(args) { _resumeAllDiagnostics(args.startFrom); },
          args: { startFrom: d }
        };
        return;
      }
      await runDiagnostic(d);
      if (d < 7) await new Promise(function(res) { setTimeout(res, 2000); });
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
  var diagMap = { positioning: 2, economics: 1, subtraction: 3, channels: 4, growth: 4, execution: 5, brand: 6, risks: 7 };

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

  // Build comprehensive context from completed strategy + research
  var ctx = 'CLIENT: ' + (s.client || r.client_name || '') + '\n';
  ctx += 'URL: ' + (s.url || '') + '\n';
  ctx += 'INDUSTRY: ' + (r.industry || '') + '\n';
  ctx += 'SERVICES: ' + (r.primary_services || []).join(', ') + '\n';
  if (st.positioning) {
    ctx += '\nPOSITIONING:\n';
    if (st.positioning.core_value_proposition) ctx += '- Value Prop: ' + st.positioning.core_value_proposition + '\n';
    if (st.positioning.recommended_positioning_angle) ctx += '- Positioning: ' + st.positioning.recommended_positioning_angle + '\n';
    if (st.positioning.validated_differentiators) ctx += '- Differentiators: ' + JSON.stringify(st.positioning.validated_differentiators) + '\n';
    if (st.positioning.brand_voice_direction) {
      var bv = st.positioning.brand_voice_direction;
      if (bv.style) ctx += '- Voice: ' + bv.style + '\n';
      if (bv.tone_detail) ctx += '- Tone: ' + bv.tone_detail + '\n';
      if (bv.words_to_avoid) ctx += '- Words to avoid: ' + JSON.stringify(bv.words_to_avoid) + '\n';
    }
    if (st.positioning.messaging_hierarchy) {
      var mh = st.positioning.messaging_hierarchy;
      if (mh.primary_message) ctx += '- Primary message: ' + mh.primary_message + '\n';
      if (mh.proof_points) ctx += '- Proof points: ' + JSON.stringify(mh.proof_points) + '\n';
    }
  }
  if (st.execution_plan && st.execution_plan.primary_cta) ctx += '\nPRIMARY CTA: ' + st.execution_plan.primary_cta + '\n';
  if (st.channel_strategy && st.channel_strategy.priority_order) ctx += '\nCHANNEL PRIORITY: ' + st.channel_strategy.priority_order.join(', ') + '\n';
  if (r.primary_audience_description) ctx += '\nAUDIENCE: ' + r.primary_audience_description + '\n';
  if (r.pain_points_top5 && r.pain_points_top5.length) ctx += 'PAIN POINTS: ' + r.pain_points_top5.join('; ') + '\n';
  if (r.existing_proof && r.existing_proof.length) ctx += 'PROOF: ' + r.existing_proof.join('; ') + '\n';
  if (r.case_studies && r.case_studies.length) ctx += 'CASE STUDIES: ' + r.case_studies.map(function(c) { return c.client + ': ' + c.result; }).join('; ') + '\n';
  if (st.risks && st.risks.length) {
    var topRisks = st.risks.filter(function(rk) { return rk.severity >= 7; }).map(function(rk) { return rk.risk + ' (' + rk.mitigation + ')'; });
    if (topRisks.length) ctx += '\nHIGH RISKS: ' + topRisks.join('; ') + '\n';
  }
  // Include reference docs
  if (s.docs && s.docs.length) {
    ctx += '\nREFERENCE DOCUMENTS:\n';
    ctx += _docExtractCtx(s.docs, ['facts','decisions','requirements','competitors','audience','services','goals']);
  }

  var sys = 'You are a senior brand strategist. Using the completed strategy analysis below, write a focused 600-800 word website-specific strategy brief. Output exactly these 5 sections:\n'
    + '1. WHAT THE SITE MUST CONVINCE: The core belief the visitor must leave with — what transformation or outcome the company delivers, and why it matters to the buyer right now. Include the emotional and rational triggers.\n'
    + '2. COMPETITIVE FRAME: Why this company vs the obvious alternatives. Name the competitor types (not brands), explain the positioning gap, and state the unfair advantage. Be specific — generic differentiators like "experienced team" are worthless.\n'
    + '3. PAGE TYPE RULES: 2-3 sentences per page type (service, location, industry, blog, home, landing) on what each must communicate, the conversion intent, and what proof belongs there. Different page types serve different buyer stages — reflect that.\n'
    + '4. PROOF REQUIREMENTS: What specific evidence, stats, case studies, or social proof must appear. Name the types of proof (revenue impact, client logos, timelines, guarantees) and where they should show up. Vague proof like "trusted by many" is not proof.\n'
    + '5. HARD RULES: Anything the copy must never do — banned phrases, tone boundaries, compliance constraints, topics to avoid, and any formatting or structural mandates.\n\n'
    + 'Be specific and direct. No generic marketing language. Use the client name throughout. Every sentence should be actionable — if a copywriter cannot act on it, cut it.';

  aiBarStart('Synthesising website strategy brief...');
  try {
    var result = await callClaude(sys, 'Strategy analysis and research:\n\n' + ctx.slice(0, 16000), null, 2500);
    S.strategy.webStrategy = result;
    scheduleSave();
    renderStrategyScorecard();
    aiBarNotify('Website strategy brief synthesised', { duration: 4000 });
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
    html += '<button class="btn btn-primary" data-tip="Runs enrichment then all 7 diagnostics sequentially" onclick="generateStrategy()"><i class="ti ti-sparkles"></i> Generate Strategy</button>';
  } else {
    html += '<button class="btn btn-ghost" data-tip="Re-runs all enrichment and all 7 diagnostics from scratch" onclick="generateStrategy()"><i class="ti ti-refresh"></i> Regenerate All</button>';
    html += '<button class="btn btn-primary" data-tip="Re-runs the 3 weakest sections plus keyword demand validation" onclick="improveStrategy()"><i class="ti ti-sparkles"></i> Improve Weakest</button>';
    html += '<button class="btn btn-ghost" data-tip="Re-runs all 7 diagnostics without re-fetching enrichment data" onclick="runAllDiagnostics()"><i class="ti ti-list-check"></i> Re-run All Diagnostics</button>';
  }
  if (meta.current_version > 0 && !meta.approved) {
    html += '<button class="btn btn-dark" onclick="approveStrategy()"><i class="ti ti-check"></i> Approve</button>';
  }
  html += '</div></div>';

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

// ── UI: Tab Content ───────────────────────────────────────────────────

function renderStrategyTabContent() {
  var el = document.getElementById('strategy-tab-content');
  if (!el) return;

  if (_sTab === 'keywords') {
    // Mount keywords.js into this container
    el.innerHTML = '<div id="strategy-kw-wrap">'
      + (typeof renderPipelineStatusContainer === 'function' ? renderPipelineStatusContainer() : '')
      + '<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px" id="kw-tab-nav"></div>'
      + '<div id="kw-tab-content"></div>'
      + '</div>';
    initKeywords();
    if (typeof _renderPipelineStatus === 'function') _renderPipelineStatus();
    return;
  }

  if (_sTab === 'output') {
    el.innerHTML = _renderOutput(S.strategy || {});
    return;
  }

  var st = S.strategy || {};
  var html = '';

  // Re-run diagnostic button
  var diagMap = { positioning: 2, economics: 1, subtraction: 3, channels: 4, growth: 4, execution: 5, brand: 6, risks: 7 };
  var diagLabels = {
    1: 'Unit Economics',
    2: 'Competitive Position',
    3: 'Subtraction',
    4: 'Channel Viability',
    5: 'Website & CRO',
    6: 'Content & Authority',
    7: 'Risk Assessment'
  };
  var diagTips = {
    1: 'Re-analyse CPL, CAC, LTV and budget viability',
    2: 'Re-assess competitive positioning and differentiators',
    3: 'Re-evaluate which activities to cut or restructure',
    4: 'Re-score all 13 marketing levers and budget allocation',
    5: 'Re-assess website build type, forms and conversion strategy',
    6: 'Re-analyse content gaps, pillars and authority plan',
    7: 'Re-score risk categories and update mitigations'
  };
  var diagNum = diagMap[_sTab];
  if (diagNum) {
    var meta = (S.strategy && S.strategy._meta) ? S.strategy._meta : { current_version: 0 };
    html += '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">';
    html += '<button class="btn btn-ghost sm" data-tip="' + (diagTips[diagNum] || '') + '" onclick="runDiagnostic(' + diagNum + ').then(function(){renderStrategyScorecard();renderStrategyTabContent()})"><i class="ti ti-refresh"></i> Re-run ' + diagLabels[diagNum] + '</button>';
    if (meta.current_version > 0) {
      html += '<button class="btn btn-primary sm" data-tip="Runs all 7 diagnostics in sequence without re-fetching enrichment data" onclick="runAllDiagnostics()"><i class="ti ti-list-check"></i> Run All Diagnostics</button>';
    } else {
      html += '<button class="btn btn-primary sm" data-tip="Runs enrichment then all 7 diagnostics in sequence" onclick="generateStrategy()"><i class="ti ti-sparkles"></i> Generate Full Strategy</button>';
    }
    html += '</div>';
  }

  // Gap panel
  if (STRATEGY_SECTION_WEIGHTS[_sTab]) {
    var sScore = scoreSection(_sTab);
    if (sScore.gaps.length > 0 && sScore.score < 7) {
      html += _renderGapPanel(sScore);
    }
  }

  // Audit panel (show quality checks for the relevant diagnostic)
  if (diagNum) {
    html += _renderAuditPanel(diagNum);
  }

  // Section content
  if (_sTab === 'positioning') html += _renderPositioning(st);
  else if (_sTab === 'economics') html += _renderEconomics(st);
  else if (_sTab === 'subtraction') html += _renderSubtraction(st);
  else if (_sTab === 'channels') html += _renderChannels(st);
  else if (_sTab === 'growth') html += _renderGrowth(st);
  else if (_sTab === 'execution') html += _renderExecution(st);
  else if (_sTab === 'brand') html += _renderBrand(st);
  else if (_sTab === 'risks') html += _renderRisks(st);

  // Strategist override panel (all scored tabs)
  if (diagNum) {
    html += _renderStrategistOverride(_sTab, diagNum);
  }

  el.innerHTML = html;

  // Wire up strategist notes buttons via createElement pattern
  if (diagNum) {
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

  // Mount interactive Gantt chart (DOM-based, after innerHTML)
  if (_sTab === 'growth') {
    _mountGantt(S.strategy || {});
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
  h += '<div style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">' + esc(label) + '</div>';
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

/* ── Interactive Gantt helpers ─────────────────────────── */

var _ganttPhaseColours = ['#e6a23c','#409eff','#67c23a','#9b59b6','#e74c3c'];
var _ganttMonths = 12;

function _buildGanttItems(st) {
  var gp = st.growth_plan || {};
  var overrides = gp.timeline_overrides || {};
  var deleted = gp.deleted_items || [];
  var levers = (st.channel_strategy && st.channel_strategy.levers) ? st.channel_strategy.levers.filter(function(l) { return l.priority_score > 3; }) : [];

  // Base items: tracking + website build
  var items = [
    { id: '_tracking', phase: 0, label: 'Tracking & Measurement', depends: [], duration: '2 weeks', startWeek: 0, notes: 'Setsail measurement product. Must complete before paid levers.' },
    { id: '_website',  phase: 1, label: 'Website Build', depends: [], duration: '4-8 weeks', startWeek: 0, notes: 'Can start in parallel with tracking.' }
  ];

  levers.forEach(function(lev) {
    var id = (lev.lever || '').replace(/\s+/g, '_').toLowerCase();
    items.push({
      id: id,
      phase: lev.dependencies && lev.dependencies.length ? 2 : 1,
      label: (lev.lever || '').replace(/_/g, ' '),
      depends: lev.dependencies || [],
      duration: lev.timeline_to_results || 'ongoing',
      startWeek: 0,
      notes: lev.recommendation ? lev.recommendation.slice(0, 100) : '',
      budgetPct: lev.budget_allocation_pct || 0
    });
  });

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

  // Auto-calculate start weeks for items without overrides
  _ganttAutoStartWeeks(items);

  // Sort by phase then order then startWeek
  items.sort(function(a, b) {
    if (a.phase !== b.phase) return a.phase - b.phase;
    if (a._order != null && b._order != null) return a._order - b._order;
    return a.startWeek - b.startWeek;
  });

  return items;
}

function _ganttAutoStartWeeks(items) {
  // For items without explicit start overrides, calculate from dependencies and phase
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
  S.strategy.growth_plan = S.strategy.growth_plan || {};
  S.strategy.growth_plan.timeline_overrides = {};
  S.strategy.growth_plan.deleted_items = [];
  S.strategy.growth_plan.custom_items = [];
  scheduleSave();
  renderStrategyTabContent();
  aiBarNotify('Timeline reset to AI-generated defaults', { type: 'info', duration: 2000 });
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
      depends: item.depends
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
  var gp = S.strategy.growth_plan = S.strategy.growth_plan || {};
  gp.deleted_items = gp.deleted_items || [];
  if (gp.deleted_items.indexOf(id) < 0) gp.deleted_items.push(id);
  // Also remove from custom items if it was user-added
  if (gp.custom_items) {
    gp.custom_items = gp.custom_items.filter(function(ci) { return ci.id !== id; });
  }
  // Clean up any overrides for deleted item
  if (gp.timeline_overrides && gp.timeline_overrides[id]) {
    delete gp.timeline_overrides[id];
  }
  scheduleSave();
  renderStrategyTabContent();
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
    row.setAttribute('draggable', 'true');

    // Drag handlers for row reorder
    row.addEventListener('dragstart', function(e) {
      dragState.dragging = idx;
      e.dataTransfer.effectAllowed = 'move';
      row.style.opacity = '0.5';
    });
    row.addEventListener('dragend', function() {
      row.style.opacity = '1';
      dragState.dragging = null;
    });
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

    // Label cell
    var labelCell = document.createElement('div');
    labelCell.style.cssText = 'width:' + labelW + 'px;min-width:' + labelW + 'px;display:flex;align-items:center;gap:5px;padding:4px 8px;cursor:grab';

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

// ── Audit Panel (shown per tab) ────────────────────────────────────────

function _renderAuditPanel(diagNum) {
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

// ── Output Tab — Compiled Strategy Document ────────────────────────────

async function compileStrategyOutput() {
  if (!S.strategy || !S.strategy._meta || S.strategy._meta.current_version === 0) {
    aiBarNotify('Generate strategy diagnostics first', { isError: true, duration: 3000 });
    return;
  }

  var st = S.strategy;
  var r = S.research || {};
  var s = S.setup || {};

  // Build comprehensive context from ALL diagnostic outputs
  var ctx = 'CLIENT: ' + (s.client || r.client_name || '') + '\n';
  ctx += 'URL: ' + (s.url || '') + '\n';
  ctx += 'INDUSTRY: ' + (r.industry || '') + '\n';
  ctx += 'SERVICES: ' + (r.primary_services || []).join(', ') + '\n';
  ctx += 'GEO: ' + (r.geography && r.geography.primary ? r.geography.primary : s.geo || '') + '\n';
  ctx += 'AUDIENCE: ' + (r.primary_audience_description || '') + '\n';
  if (r.pain_points_top5 && r.pain_points_top5.length) ctx += 'PAIN POINTS: ' + r.pain_points_top5.join('; ') + '\n';

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

  // D2: Positioning
  if (st.positioning && st.positioning.core_value_proposition) {
    ctx += '\nPOSITIONING:\n';
    ctx += '- Value Prop: ' + st.positioning.core_value_proposition + '\n';
    ctx += '- Angle: ' + (st.positioning.recommended_positioning_angle || '') + '\n';
    ctx += '- Tagline: ' + (st.positioning.recommended_tagline || '') + '\n';
    if (st.positioning.validated_differentiators) ctx += '- Differentiators: ' + st.positioning.validated_differentiators.join('; ') + '\n';
    if (st.positioning.messaging_hierarchy) {
      ctx += '- Primary Message: ' + (st.positioning.messaging_hierarchy.primary_message || '') + '\n';
      if (st.positioning.messaging_hierarchy.proof_points) ctx += '- Proof: ' + st.positioning.messaging_hierarchy.proof_points.join('; ') + '\n';
    }
    if (st.positioning.brand_voice_direction) {
      ctx += '- Voice: ' + (st.positioning.brand_voice_direction.style || '') + ' / ' + (st.positioning.brand_voice_direction.tone_detail || '') + '\n';
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
    if (st.channel_strategy.budget_allocation) ctx += '- Budget: $' + (st.channel_strategy.budget_allocation.total_monthly || '?') + '/mo\n';
    if (st.channel_strategy.funnel_gaps_flagged) ctx += '- Funnel Gaps: ' + st.channel_strategy.funnel_gaps_flagged.join('; ') + '\n';
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
  if (st.execution_plan && st.execution_plan.primary_cta && !web) {
    ctx += '\nPRIMARY CTA: ' + st.execution_plan.primary_cta + '\n';
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
  // Per-lever budget percentages from channel strategy levers
  if (st.channel_strategy && st.channel_strategy.levers && st.channel_strategy.levers.length) {
    ctx += '\nCHANNEL LEVER DETAILS:\n';
    st.channel_strategy.levers.forEach(function(lev) {
      ctx += '- ' + (lev.lever || lev.name || '') + ': ' + (lev.budget_allocation_pct || 0) + '% of budget';
      if (lev.timeline_to_results) ctx += ', results in ' + lev.timeline_to_results;
      if (lev.recommendation) ctx += ' — ' + lev.recommendation;
      ctx += '\n';
    });
  }

  // Audit summary
  var auditSummary = [];
  for (var d = 1; d <= 7; d++) {
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

  var sys = 'You are a senior digital strategist at a marketing agency. Using the completed strategy analysis below, write a comprehensive strategy document that will serve as the single source of truth for all downstream work (sitemap, briefs, copy, design).\n\n'
    + 'Write in these 10 sections. Use the client name. Be specific and actionable — every sentence must be usable by the team.\n\n'
    + 'CRITICAL: Use the ACTUAL data provided — real competitor names, real keyword clusters with their exact volumes and KD scores, real budget dollar amounts and percentage splits, real page slugs, real CPC figures, real DR scores. Never use placeholder language like "various keywords" or "competitive budget" when you have specific numbers.\n\n'
    + '## 1. EXECUTIVE SUMMARY\n'
    + '3-4 paragraphs. Who is the client, what do they need, what is our strategic recommendation, and what outcome we expect. Include the core positioning statement and value proposition.\n\n'
    + '## 2. MARKET ECONOMICS\n'
    + 'Unit economics grounded in real data: max allowable CPL, estimated market CPL (citing actual CPC data and the multiplier used), LTV:CAC ratio and health assessment, paid media viability. State which inputs were client-provided vs estimated. If CPC data came from keyword research, reference the average and high-intent CPC figures.\n\n'
    + '## 3. SUBTRACTION ANALYSIS\n'
    + 'What the client should STOP doing before we build anything new. List each current activity with its verdict (cut/keep/restructure), monthly cost, and reason. State total recoverable budget and where those funds should be redirected. Include any assumptions made about costs.\n\n'
    + '## 4. COMPETITIVE LANDSCAPE\n'
    + 'Name the actual competitors from the data. For each major competitor, state their specific strength and the gap we exploit. Identify the unoccupied territory we are claiming. If DR data is available, reference the authority gap.\n\n'
    + '## 5. KEYWORD & DEMAND STRATEGY\n'
    + 'Reference specific keyword clusters by name with their exact monthly volumes and KD scores. State total addressable search volume. Map clusters to intent tiers (transactional, informational, navigational). Include the realistic organic timeline from demand validation.\n\n'
    + '## 6. CONTENT & AUTHORITY STRATEGY\n'
    + 'Content pillars, formats, velocity, and authority-building plan. Tie each pillar to specific keyword clusters and business revenue. If domain authority gap data exists, include the DR gap analysis, 12-month DR target, and the phased authority timeline. Reference quick wins.\n\n'
    + '## 7. WEBSITE & CONVERSION\n'
    + 'Build type, page architecture referencing specific cluster slugs (e.g. /service-name, /location-name). List the actual pages to build vs improve. CTA strategy (primary, secondary, low-commitment), form strategy, and tracking requirements.\n\n'
    + '## 8. CHANNEL ALLOCATION\n'
    + 'Which levers to activate (in priority order). Include exact budget dollar amounts and percentage splits per channel. State the expected timeline to results for each lever.\n\n'
    + '## 9. GEO & LOCAL STRATEGY\n'
    + 'Geographic targeting approach, local SEO priority, location page strategy. Reference any location-type keyword clusters.\n\n'
    + '## 10. RISKS & CONSTRAINTS\n'
    + 'Top risks with mitigations. Hard rules and constraints the team must follow.\n\n'
    + 'Write in clear, professional prose. No bullet-point dumping — use paragraphs with occasional bullets for lists. Approx 1500-2200 words total.';

  aiBarStart('Compiling strategy document...');
  try {
    var result = await callClaude(sys, 'Complete strategy analysis:\n\n' + ctx.slice(0, 20000), null, 6000, 'Strategy output');
    S.strategy.compiled_output = result;
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
  } else {
    html += '<div class="card" style="color:var(--n2);text-align:center;padding:20px"><p>Generate strategy diagnostics first, then compile the output document here.</p></div>';
    return html;
  }
  html += '</div>';

  // Audit summary across all diagnostics
  var audit = st._audit || {};
  var hasAudit = Object.keys(audit).length > 0;
  if (hasAudit) {
    var diagLabelsShort = { 1:'Economics', 2:'Position', 3:'Subtraction', 4:'Channels', 5:'Website', 6:'Content', 7:'Risks' };
    html += '<div class="card" style="margin-bottom:14px;padding:12px 16px">';
    html += '<div style="font-size:12px;font-weight:500;margin-bottom:8px">Diagnostic Audit Summary</div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    for (var d = 1; d <= 7; d++) {
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

  // Compiled output document
  if (output) {
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
    html += '<div style="font-size:12px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em">Compiled Strategy Document</div>';
    if (meta.current_version > 0) html += '<div style="font-size:10px;color:var(--n2)">v' + meta.current_version + '</div>';
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
    .replace(/^## (\d+)\.\s+(.+)$/gm, '<div style="border-top:2px solid var(--border);margin:24px 0 12px;padding-top:16px"><h3 style="font-size:13px;font-weight:600;color:var(--dark);margin:0;display:flex;align-items:center;gap:8px"><span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--dark);color:white;font-size:10px;font-weight:700;flex-shrink:0">$1</span>$2</h3></div>')
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
