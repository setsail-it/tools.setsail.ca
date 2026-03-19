// ── Field Metadata Registry ───────────────────────────────────────
// Maps every research field to tab, label, importance, and source.
// source: 'ai' = AI-enrichable, 'manual' = human-only, 'auto' = auto-populated
var RESEARCH_FIELD_META = {
  // Business — factual data about the company (strategic fields moved to Strategy stage)
  client_name:               { tab:'business',    label:'Client Name',              importance:'critical', source:'auto' },
  business_overview:         { tab:'business',    label:'Business Overview',        importance:'critical', source:'ai' },
  industry:                  { tab:'business',    label:'Industry',                 importance:'critical', source:'manual' },
  sub_industry:              { tab:'business',    label:'Sub-Industry / Niche',     importance:'normal',   source:'ai' },
  business_model:            { tab:'business',    label:'Business Model',           importance:'normal',   source:'ai' },
  years_in_business:         { tab:'business',    label:'Years in Business',        importance:'optional', source:'ai' },
  team_size:                 { tab:'business',    label:'Team Size',                importance:'optional', source:'ai' },
  locations_count:           { tab:'business',    label:'Number of Locations',      importance:'optional', source:'ai' },
  primary_services:          { tab:'business',    label:'Primary Services',         importance:'normal',   source:'auto' },
  services_detail:           { tab:'business',    label:'Services (Detailed)',      importance:'critical', source:'ai' },
  current_pricing:           { tab:'business',    label:'Current Pricing',          importance:'normal',   source:'ai' },
  pricing_model:             { tab:'business',    label:'Pricing Model',            importance:'normal',   source:'ai' },
  capacity_constraints:      { tab:'business',    label:'Capacity Constraints',     importance:'optional', source:'ai' },
  seasonality_notes:         { tab:'business',    label:'Seasonality Notes',        importance:'optional', source:'manual' },
  // Audience — who buys and how the sales process works
  primary_audience_description: { tab:'audience', label:'Audience Description',     importance:'critical', source:'ai' },
  buyer_roles_titles:        { tab:'audience',    label:'Buyer Roles / Titles',     importance:'normal',   source:'ai' },
  target_geography:          { tab:'audience',    label:'Target Geography Scope',   importance:'normal',   source:'ai' },
  best_customer_examples:    { tab:'audience',    label:'Ideal Customer Examples',  importance:'normal',   source:'ai' },
  pain_points_top5:          { tab:'audience',    label:'Top Pain Points',          importance:'critical', source:'ai' },
  objections_top5:           { tab:'audience',    label:'Top Objections',           importance:'normal',   source:'ai' },
  lead_channels_today:       { tab:'audience',    label:'Current Lead Channels',    importance:'optional', source:'ai' },
  sales_cycle_length:        { tab:'audience',    label:'Sales Cycle Length',       importance:'optional', source:'ai' },
  current_qualification:     { tab:'audience',    label:'Current Lead Qualification', importance:'optional', source:'ai' },
  close_rate_estimate:       { tab:'audience',    label:'Estimated Close Rate',     importance:'optional', source:'ai' },
  top_reasons_leads_dont_close:{ tab:'audience',  label:'Reasons Leads Do Not Close',importance:'optional',source:'ai' },
  booking_flow_description:  { tab:'audience',    label:'Booking / Intake Flow',    importance:'optional', source:'ai' },
  primary_goal:              { tab:'audience',    label:'Primary Goal',             importance:'critical', source:'ai' },
  secondary_goals:           { tab:'audience',    label:'Secondary Goals',          importance:'normal',   source:'ai' },
  goal_statement:            { tab:'audience',    label:'Success Statement (Client Voice)', importance:'normal', source:'auto' },
  goal_target:               { tab:'audience',    label:'Measurable Target',        importance:'normal',   source:'auto' },
  goal_baseline:             { tab:'audience',    label:'Current Baseline',         importance:'normal',   source:'auto' },
  goal_timeline:             { tab:'audience',    label:'Goal Timeline',            importance:'normal',   source:'auto' },
  goal_kpi:                  { tab:'audience',    label:'Primary KPI',              importance:'normal',   source:'auto' },
  current_customer_profile:  { tab:'audience',    label:'Current Customer Profiles', importance:'normal',  source:'ai' },
  'geography.primary':       { tab:'audience',    label:'Primary City / Region',    importance:'normal',   source:'ai' },
  'geography.secondary':     { tab:'audience',    label:'Secondary Cities',         importance:'optional', source:'ai' },
  // Unit economics & marketing context (manual inputs for Strategy diagnostics)
  monthly_marketing_budget:  { tab:'audience',    label:'Monthly Marketing Budget', importance:'normal',   source:'manual' },
  average_deal_size:         { tab:'audience',    label:'Average Deal Size',        importance:'normal',   source:'manual' },
  customer_lifetime_value:   { tab:'audience',    label:'Customer Lifetime Value',  importance:'normal',   source:'manual' },
  lead_quality_percentage:   { tab:'audience',    label:'Lead Quality %',           importance:'normal',   source:'manual' },
  current_lead_volume:       { tab:'audience',    label:'Current Monthly Leads',    importance:'normal',   source:'manual' },
  current_marketing_activities:{ tab:'audience',  label:'Current Marketing Activities', importance:'normal', source:'manual' },
  previous_agency_experience:{ tab:'audience',    label:'Previous Agency Experience', importance:'optional', source:'manual' },
  // Buyer Psychology — JTBD Force Map + Buyer Context
  'jtbd_forces.push_forces':  { tab:'audience', label:'JTBD Push Forces',         importance:'normal',  source:'ai' },
  'jtbd_forces.pull_forces':  { tab:'audience', label:'JTBD Pull Forces',         importance:'normal',  source:'ai' },
  'jtbd_forces.anxieties':    { tab:'audience', label:'JTBD Anxieties',           importance:'normal',  source:'ai' },
  'jtbd_forces.habits':       { tab:'audience', label:'JTBD Habits',              importance:'normal',  source:'ai' },
  buyer_sophistication:       { tab:'audience', label:'Buyer Sophistication',     importance:'normal',  source:'ai' },
  perceived_categories:       { tab:'audience', label:'Perceived Categories',     importance:'normal',  source:'ai' },
  switching_triggers:         { tab:'audience', label:'Switching Triggers',       importance:'normal',  source:'ai' },
  decision_criteria:          { tab:'audience', label:'Decision Criteria',        importance:'normal',  source:'ai' },
  // Brand — identity and proof (strategic brand fields moved to Strategy)
  brand_name:                { tab:'brand',       label:'Brand Name',               importance:'critical', source:'ai' },
  current_slogan:            { tab:'brand',       label:'Current Slogan / Tagline', importance:'normal',   source:'ai' },
  existing_proof:            { tab:'brand',       label:'Existing Proof Points',    importance:'normal',   source:'ai' },
  brand_colours:             { tab:'brand',       label:'Brand Colours',            importance:'optional', source:'manual' },
  fonts:                     { tab:'brand',       label:'Fonts',                    importance:'optional', source:'manual' },
  brand_guidelines_link:     { tab:'brand',       label:'Brand Guidelines Link',    importance:'optional', source:'manual' },
  logo_files_link:           { tab:'brand',       label:'Logo Files Link',          importance:'optional', source:'manual' },
  logo_url:                  { tab:'brand',       label:'Logo URL (from website)',   importance:'optional', source:'ai' },
  photo_library_link:        { tab:'brand',       label:'Photo Library Link',       importance:'optional', source:'manual' },
  video_library_link:        { tab:'brand',       label:'Video Library Link',       importance:'optional', source:'manual' },
  existing_ad_creatives_link:{ tab:'brand',       label:'Ad Creatives Link',        importance:'optional', source:'manual' },
  do_not_use_assets_notes:   { tab:'brand',       label:'Do Not Use Notes',         importance:'optional', source:'manual' },
  case_studies:              { tab:'brand',       label:'Case Studies',             importance:'critical', source:'ai' },
  notable_clients:           { tab:'brand',       label:'Notable Clients',          importance:'normal',   source:'ai' },
  awards_certifications:     { tab:'brand',       label:'Awards & Certifications',  importance:'normal',   source:'ai' },
  team_credentials:          { tab:'brand',       label:'Team Credentials',         importance:'normal',   source:'ai' },
  founder_bio:               { tab:'brand',       label:'Founder Bio',              importance:'normal',   source:'ai' },
  publications_media:        { tab:'brand',       label:'Publications & Media',     importance:'optional', source:'ai' },
  voc_swipe_raw:             { tab:'brand',       label:'VoC Swipe File',           importance:'optional', source:'manual' },
  reference_brands:          { tab:'brand',       label:'Reference Brands',         importance:'optional', source:'manual' },
  // Schema & Local
  schema_business_type:      { tab:'schema',      label:'Business Type',            importance:'critical', source:'ai' },
  schema_primary_category:   { tab:'schema',      label:'Primary Category',         importance:'critical', source:'ai' },
  schema_price_range:        { tab:'schema',      label:'Price Range',              importance:'optional', source:'ai' },
  schema_payment_methods:    { tab:'schema',      label:'Payment Methods',          importance:'optional', source:'ai' },
  schema_has_physical_locations:{ tab:'schema',   label:'Has Physical Locations',   importance:'normal',   source:'ai' },
  schema_street_address:     { tab:'schema',      label:'Street Address',           importance:'normal',   source:'ai' },
  schema_city:               { tab:'schema',      label:'City',                     importance:'normal',   source:'ai' },
  schema_region:             { tab:'schema',      label:'Province / State',         importance:'normal',   source:'ai' },
  schema_postal_code:        { tab:'schema',      label:'Postal Code',              importance:'normal',   source:'ai' },
  schema_country:            { tab:'schema',      label:'Country',                  importance:'normal',   source:'ai' },
  schema_phone:              { tab:'schema',      label:'Phone Number',             importance:'normal',   source:'ai' },
  social_profiles:           { tab:'schema',      label:'Social Profiles',          importance:'normal',   source:'ai' },
  schema_services:           { tab:'schema',      label:'Schema Services',          importance:'normal',   source:'ai' },
  has_location_pages:        { tab:'schema',      label:'Location Pages',           importance:'normal',   source:'ai' },
  has_service_pages:         { tab:'schema',      label:'Service Pages',            importance:'normal',   source:'ai' },
  has_blog:                  { tab:'schema',      label:'Blog',                     importance:'normal',   source:'ai' },
  has_faq_section:           { tab:'schema',      label:'FAQ Section',              importance:'normal',   source:'ai' },
  schema_injection_method:   { tab:'schema',      label:'Schema Injection Method',  importance:'optional', source:'manual' },
  current_faqs:              { tab:'schema',      label:'Current FAQs',             importance:'normal',   source:'ai' },
  reviews:                   { tab:'schema',      label:'Reviews',                  importance:'optional', source:'manual' },
  // Competitors
  competitors:               { tab:'competitors', label:'Competitors',              importance:'critical', source:'ai' },
};

// ── Economics Field Validation ────────────────────────────────────
// Validates and normalises manual economics inputs that feed D1 Unit Economics.

var ECON_FIELD_VALIDATORS = {
  monthly_marketing_budget: {
    type: 'currency',
    min: 100, max: 500000,
    hint: 'Enter as a number or with $ (e.g. $5,000)',
    warnLow: 'Budget under $500/mo limits paid media viability',
    warnHigh: 'Very high budget — double-check this is monthly, not annual'
  },
  average_deal_size: {
    type: 'currency',
    min: 10, max: 1000000,
    hint: 'Average revenue per deal (e.g. $3,500)',
    warnLow: 'Very low deal size — consider if this is per transaction or per contract',
    warnHigh: 'Very high deal size — confirm this is per deal, not annual contract value'
  },
  customer_lifetime_value: {
    type: 'currency',
    min: 50, max: 10000000,
    hint: 'Total revenue from one customer over their lifetime (e.g. $12,000)',
    warnLow: 'LTV below deal size — customer only buys once?',
    warnHigh: null
  },
  lead_quality_percentage: {
    type: 'percentage',
    min: 1, max: 100,
    hint: 'What percent of leads become sales-qualified (e.g. 40%)',
    warnLow: 'Under 10% suggests a lead quality problem upstream',
    warnHigh: 'Over 80% is unusual — only count leads that go through full qualification'
  },
  current_lead_volume: {
    type: 'number',
    min: 0, max: 50000,
    hint: 'Leads received per month (e.g. 25)',
    warnLow: null,
    warnHigh: 'Over 1,000 leads/mo is unusual for SMB — confirm this is monthly'
  },
  close_rate_estimate: {
    type: 'percentage',
    min: 1, max: 100,
    hint: 'What percent of qualified leads become customers (e.g. 30%)',
    warnLow: 'Under 5% is very low — may indicate lead quality or sales issues',
    warnHigh: 'Over 70% close rate is rare — confirm this is from qualified leads only'
  }
};

function validateEconField(key, rawValue) {
  var validator = ECON_FIELD_VALIDATORS[key];
  if (!validator) return { valid: true, normalised: rawValue, hint: '', warning: '' };

  var str = String(rawValue || '').trim();
  if (!str) return { valid: true, normalised: '', hint: validator.hint, warning: '' };

  // Parse numeric value from the string
  var numStr = str.replace(/[$,\s%]/g, '');
  // Handle K/k suffix (e.g. "5k" = 5000)
  if (/\d[kK]$/.test(numStr)) {
    numStr = String(parseFloat(numStr) * 1000);
  }
  var num = parseFloat(numStr);

  if (isNaN(num)) {
    return { valid: false, normalised: str, hint: validator.hint, warning: 'Could not parse a number from "' + str + '"' };
  }

  // Normalise to clean string format
  var normalised = '';
  if (validator.type === 'currency') {
    normalised = '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } else if (validator.type === 'percentage') {
    normalised = num + '%';
  } else {
    normalised = String(Math.round(num));
  }

  // Range warnings
  var warning = '';
  if (num < validator.min) {
    warning = validator.warnLow || 'Value seems unusually low';
  } else if (validator.type === 'currency' && num > validator.max) {
    warning = validator.warnHigh || 'Value seems unusually high';
  } else if (validator.type === 'percentage' && num > validator.max) {
    warning = 'Percentage cannot exceed 100%';
  } else if (validator.type === 'number' && num > validator.max) {
    warning = validator.warnHigh || 'Value seems unusually high';
  }
  // Cross-field warnings
  if (key === 'customer_lifetime_value' && S.research) {
    var dealSize = parseEconNum(S.research.average_deal_size);
    if (dealSize > 0 && num < dealSize) {
      warning = 'LTV ($' + num.toLocaleString() + ') is less than deal size ($' + dealSize.toLocaleString() + ') — customer only buys once?';
    }
  }

  return { valid: true, normalised: normalised, hint: validator.hint, warning: warning };
}

function parseEconNum(val) {
  if (!val) return 0;
  var s = String(val).replace(/[$,\s%]/g, '');
  if (/\d[kK]$/.test(s)) s = String(parseFloat(s) * 1000);
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ── Completeness Calculation ──────────────────────────────────────

function calcResearchCompleteness() {
  var r = S.research || {};
  var total = { filled:0, count:0 };
  var byTab = {};
  var missing = [];
  var keys = Object.keys(RESEARCH_FIELD_META);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var meta = RESEARCH_FIELD_META[key];
    if (!byTab[meta.tab]) byTab[meta.tab] = { filled:0, count:0 };
    byTab[meta.tab].count++;
    total.count++;
    var val;
    if (key.indexOf('.') !== -1) {
      var parts = key.split('.');
      val = r[parts[0]] ? r[parts[0]][parts[1]] : undefined;
    } else {
      val = r[key];
    }
    var filled = false;
    if (Array.isArray(val)) { filled = val.length > 0; }
    else if (typeof val === 'boolean') { filled = true; }
    else if (typeof val === 'string') { filled = val.trim().length > 0; }
    else if (typeof val === 'number') { filled = true; }
    else if (val && typeof val === 'object') { filled = Object.keys(val).length > 0; }
    if (filled) {
      total.filled++;
      byTab[meta.tab].filled++;
    } else {
      missing.push({ key:key, label:meta.label, tab:meta.tab, importance:meta.importance, source:meta.source });
    }
  }
  total.pct = total.count ? Math.round((total.filled / total.count) * 100) : 0;
  Object.keys(byTab).forEach(function(t) {
    byTab[t].pct = byTab[t].count ? Math.round((byTab[t].filled / byTab[t].count) * 100) : 0;
  });
  return { total:total, byTab:byTab, missing:missing };
}

// ── Scorecard Rendering ───────────────────────────────────────────

var _scorecardTimer = null;
function scheduleScorecard() {
  if (_scorecardTimer) clearTimeout(_scorecardTimer);
  _scorecardTimer = setTimeout(renderResearchScorecard, 300);
}

function renderResearchScorecard() {
  var el = document.getElementById('research-scorecard');
  if (!el) return;
  if (!S.research) { el.innerHTML = ''; return; }
  var c = calcResearchCompleteness();
  var pct = c.total.pct;
  var colour = pct >= 75 ? 'var(--green)' : pct >= 40 ? '#e6a23c' : '#f56c6c';

  // Slim progress bar with overall % and collapsible missing fields
  var html = '<div style="margin-bottom:12px">';

  // Overall progress bar
  html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">';
  html += '<div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden">';
  html += '<div style="height:100%;width:' + pct + '%;background:' + colour + ';border-radius:2px;transition:width .3s"></div>';
  html += '</div>';
  html += '<span style="font-size:11px;font-weight:500;color:' + colour + ';white-space:nowrap">' + pct + '% · ' + c.total.filled + '/' + c.total.count + '</span>';
  html += '</div>';

  // Client Pain indicator (compact)
  var cp = (S.research && S.research.clientPain) || {};
  if (!cp.primary || !cp.primary.trim()) {
    html += '<div style="font-size:10px;color:#f56c6c;margin-bottom:4px"><i class="ti ti-alert-triangle" style="font-size:11px;margin-right:3px;vertical-align:-1px"></i>Client Pain not captured — caps strategy score at 6.0</div>';
  }

  // Missing fields (critical first, then normal — skip optional)
  var critMissing = c.missing.filter(function(m) { return m.importance === 'critical'; });
  var normMissing = c.missing.filter(function(m) { return m.importance === 'normal'; });
  if (critMissing.length || normMissing.length) {
    html += '<details style="margin-bottom:2px"><summary style="font-size:11px;color:var(--n2);cursor:pointer;user-select:none">';
    html += critMissing.length + ' critical, ' + normMissing.length + ' normal fields missing</summary>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;margin-bottom:4px">';
    critMissing.forEach(function(m) {
      var badge = m.source === 'manual' ? '<span style="font-size:9px;color:#e6a23c;margin-left:3px">MANUAL</span>' : '<span style="font-size:9px;color:var(--green);margin-left:3px">AI</span>';
      html += '<button onclick="jumpToResearchField(\'' + m.key + '\',\'' + m.tab + '\')" style="border:1px solid #f56c6c33;background:#f56c6c0d;color:var(--dark);font-size:11px;padding:3px 8px;border-radius:4px;cursor:pointer;font-family:var(--font);white-space:nowrap">'
        + m.label + badge + '</button>';
    });
    normMissing.forEach(function(m) {
      var badge = m.source === 'manual' ? '<span style="font-size:9px;color:#e6a23c;margin-left:3px">MANUAL</span>' : '<span style="font-size:9px;color:var(--green);margin-left:3px">AI</span>';
      html += '<button onclick="jumpToResearchField(\'' + m.key + '\',\'' + m.tab + '\')" style="border:1px solid var(--border);background:var(--bg);color:var(--dark);font-size:11px;padding:3px 8px;border-radius:4px;cursor:pointer;font-family:var(--font);white-space:nowrap">'
        + m.label + badge + '</button>';
    });
    html += '</div></details>';
  }

  html += '</div>';
  el.innerHTML = html;
  // Also refresh tab nav scores
  renderResearchNav();
}

function jumpToResearchField(key, tab) {
  if (_rTab !== tab) {
    _rTab = tab;
    renderResearchNav();
    renderResearchTabContent();
  }
  var fieldId = 'rf-' + key.replace(/[.\[\]]/g, '-');
  setTimeout(function() {
    var fieldEl = document.getElementById(fieldId);
    if (fieldEl) {
      fieldEl.scrollIntoView({ behavior:'smooth', block:'center' });
      fieldEl.style.outline = '2px solid var(--green)';
      fieldEl.style.outlineOffset = '2px';
      setTimeout(function() { fieldEl.style.outline = ''; fieldEl.style.outlineOffset = ''; }, 2000);
    }
  }, 60);
}

function initResearch() {
  if (!S.research) S.research = researchDefaults();
  migrateResearchFields(S.research);
  _cachedWebsiteText = null; // reset website cache on project load
  // Ensure clientPain exists for older projects
  if (!S.research.clientPain) {
    S.research.clientPain = { primary:'', secondary:[], consequence:'', urgencyTrigger:'', priorAttempts:[], successDefinition:'', clientQuotes:[], source:'', _extractedAt:null };
  }
  // Auto-populate client_name from Setup
  if (!S.research.client_name && S.setup && S.setup.client) {
    S.research.client_name = S.setup.client;
    scheduleSave();
  }
  // Auto-populate goal fields from Setup (one-way sync, only if empty)
  if (S.setup) {
    var _goalSync = false;
    if (!S.research.goal_statement && S.setup.goalStatement) { S.research.goal_statement = S.setup.goalStatement; _goalSync = true; }
    if (!S.research.goal_target && S.setup.goalTarget) { S.research.goal_target = S.setup.goalTarget; _goalSync = true; }
    if (!S.research.goal_baseline && S.setup.goalBaseline) { S.research.goal_baseline = S.setup.goalBaseline; _goalSync = true; }
    if (!S.research.goal_timeline && S.setup.goalTimeline) { S.research.goal_timeline = S.setup.goalTimeline; _goalSync = true; }
    if (!S.research.goal_kpi && S.setup.goalKpi) { S.research.goal_kpi = S.setup.goalKpi; _goalSync = true; }
    if (_goalSync) scheduleSave();
  }
  _rTab = _rTab || 'business';
  renderResearchNav();
  renderResearchTabContent();
  scheduleScorecard();
}

function researchDefaults() {
  return {
    // Business
    client_name:'', business_overview:'',
    industry:'', sub_industry:'', business_model:'',
    years_in_business:'', team_size:'', locations_count:'',
    primary_services:[], services_detail:[],
    current_pricing:'', pricing_model:'',
    capacity_constraints:'', seasonality_notes:'',
    // Audience
    primary_audience_description:'', buyer_roles_titles:[],
    target_geography:'', best_customer_examples:'',
    pain_points_top5:[], objections_top5:[],
    lead_channels_today:[], sales_cycle_length:'',
    current_qualification:'', close_rate_estimate:'',
    top_reasons_leads_dont_close:'', booking_flow_description:'',
    primary_goal:'', secondary_goals:[], current_customer_profile:[],
    goal_statement:'', goal_target:'', goal_baseline:'', goal_timeline:'', goal_kpi:'',
    geography:{ primary:'', secondary:[] },
    // Unit economics (manual)
    monthly_marketing_budget:'', average_deal_size:'',
    customer_lifetime_value:'', lead_quality_percentage:'',
    current_lead_volume:'',
    current_marketing_activities:[], previous_agency_experience:'',
    // Brand
    brand_name:'', current_slogan:'',
    existing_proof:[],
    brand_colours:[], fonts:[],
    brand_guidelines_link:'', logo_files_link:'', logo_url:'',
    photo_library_link:'', video_library_link:'',
    existing_ad_creatives_link:'', do_not_use_assets_notes:'',
    reference_brands:[],
    // Proof & E-E-A-T
    case_studies:[], notable_clients:[], awards_certifications:[],
    team_credentials:'', founder_bio:'', publications_media:[], voc_swipe_raw:'',
    // Schema
    schema_business_type:'', schema_primary_category:'',
    schema_price_range:'', schema_payment_methods:[],
    schema_has_physical_locations:false,
    schema_street_address:'', schema_city:'', schema_region:'',
    schema_postal_code:'', schema_country:'',
    schema_phone:'',
    social_profiles:[], schema_services:[],
    has_location_pages:'', has_service_pages:'',
    has_blog:'', has_faq_section:'',
    schema_injection_method:'',
    current_faqs:[], reviews:[],
    // Competitors
    competitors:[],
    // Buyer Psychology — JTBD Force Map
    jtbd_forces: {
      push_forces: [],   // [{force, quote, intensity}]
      pull_forces: [],
      anxieties: [],
      habits: []
    },
    buyer_sophistication: '',   // 1-5 score
    perceived_categories: [],   // array of strings
    switching_triggers: [],     // array of strings
    decision_criteria: [],      // [{criterion, priority}]
    // Client Pain (Layer 1 — why the client hired Setsail)
    clientPain: {
      primary: '',
      secondary: [],
      consequence: '',
      urgencyTrigger: '',
      priorAttempts: [],
      successDefinition: '',
      clientQuotes: [],
      source: '',
      _extractedAt: null
    },
  };
}

// ── KV Migration — rename old field keys to new ones ─────────────
function migrateResearchFields(r) {
  if (!r) return r;
  // Rename map: old key → new key
  var renames = {
    pricing_notes: 'current_pricing',
    slogan_or_tagline: 'current_slogan',
    lead_qualification_criteria: 'current_qualification',
    proof_points: 'existing_proof',
    faqs: 'current_faqs',
    target_audience: 'current_customer_profile'
  };
  Object.keys(renames).forEach(function(oldKey) {
    var newKey = renames[oldKey];
    if (r[oldKey] !== undefined && r[newKey] === undefined) {
      r[newKey] = r[oldKey];
      delete r[oldKey];
    } else if (r[oldKey] !== undefined && !r[newKey]) {
      // New key exists but is empty — use old value
      var oldVal = r[oldKey];
      var hasValue = Array.isArray(oldVal) ? oldVal.length > 0 : (typeof oldVal === 'string' ? oldVal.trim().length > 0 : !!oldVal);
      if (hasValue) r[newKey] = oldVal;
      delete r[oldKey];
    }
  });
  // Removed fields stay in S.research for backward compat but are no longer rendered/scored
  return r;
}

function renderResearchNav() {
  const nav = document.getElementById('research-tab-nav');
  if (!nav) return;
  var c = calcResearchCompleteness();
  nav.innerHTML = RESEARCH_TABS.map(t => {
    const active = _rTab === t.id;
    const done = _enrichDone.has(t.id);
    const enrichingThis = _enriching === t.id;
    const tb = c.byTab[t.id] || { pct:0 };
    const pctColour = tb.pct >= 75 ? 'var(--green)' : tb.pct >= 40 ? '#e6a23c' : 'var(--n2)';
    const statusBadge = enrichingThis
      ? `<span class="spinner" style="width:10px;height:10px;display:inline-block;margin-left:5px;vertical-align:middle"></span>`
      : done
        ? `<span style="color:var(--green);font-size:10px;margin-left:4px;font-weight:600">✓</span>`
        : '';
    const pctBadge = `<span style="font-size:10px;font-weight:500;color:${pctColour};margin-left:5px;opacity:${active?1:0.7}">${tb.pct}%</span>`;
    return `<button onclick="switchRTab('${t.id}')" style="padding:9px 16px;border:none;border-bottom:2px solid ${active?'var(--green)':'transparent'};background:none;font-family:var(--font);font-size:13px;color:${active?'var(--dark)':'var(--n2)'};cursor:pointer;white-space:nowrap;font-weight:${active?500:400};transition:color .15s;margin-bottom:-2px"><i class="ti ${t.icon}" style="margin-right:5px;font-size:12px"></i>${t.label}${pctBadge}${statusBadge}</button>`;
  }).join('');
}

function switchRTab(id) {
  _rTab = id;
  renderResearchNav();
  renderResearchTabContent();
}

function renderResearchTabContent() {
  const el = document.getElementById('research-tab-content');
  if (!el) return;
  const r = S.research || researchDefaults();
  switch(_rTab) {
    case 'business':    el.innerHTML = renderRBusiness(r); break;
    case 'audience':    el.innerHTML = renderRAudience(r); break;
    case 'brand':       el.innerHTML = renderRBrand(r); break;
    case 'schema':      el.innerHTML = renderRSchema(r); break;
    case 'competitors': el.innerHTML = renderRCompetitors(r); break;
    default: el.innerHTML = '';
  }
}

// ── Field helpers ─────────────────────────────────────────────────

function rField(key, label, value, type, opts) {
  type = type || 'text';
  opts = opts || {};
  const id = 'rf-' + key.replace(/[.\[\]]/g,'-');
  var meta = RESEARCH_FIELD_META[key];
  var badge = '';
  if (meta) {
    var isEmpty = Array.isArray(value) ? !value.length : (typeof value === 'string' ? !value.trim() : !value);
    if (meta.source === 'manual') badge = '<span style="font-size:9px;color:#e6a23c;background:#e6a23c15;padding:1px 5px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0">MANUAL</span>';
    else if (meta.source === 'ai' && isEmpty) badge = '<span style="font-size:9px;color:var(--green);background:var(--green-bg,#10b98115);padding:1px 5px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:0">AI</span>';
  }
  const lHtml = `<label for="${id}" style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">${label}${badge}</label>`;
  const base = 'width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-size:13px;color:var(--dark);font-family:var(--font);outline:none;box-sizing:border-box';
  const span = (type==='textarea'||type==='textarea-array'||opts.span) ? 'grid-column:1/-1;' : '';
  let input = '';

  if (type === 'textarea') {
    var phAttr = opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : '';
    input = `<textarea id="${id}" rows="${opts.rows||3}" style="${base}"${phAttr} onchange="setRF('${key}',this.value)">${esc(value||'')}</textarea>`;
  } else if (type === 'textarea-array') {
    const v = Array.isArray(value) ? value.join('\n') : (value||'');
    input = `<textarea id="${id}" rows="${opts.rows||4}" style="${base}" onchange="setRFArr('${key}',this.value)">${esc(v)}</textarea>`;
  } else if (type === 'text-csv') {
    const v = Array.isArray(value) ? value.join(', ') : (value||'');
    input = `<input id="${id}" type="text" value="${esc(v)}" style="${base}" onchange="setRFCSV('${key}',this.value)">`;
  } else if (type === 'select') {
    const optHtml = (opts.options||[]).map(o => `<option value="${o}" ${value===o?'selected':''}>${o.replace(/_/g,' ')}</option>`).join('');
    input = `<select id="${id}" style="${base};height:34px" onchange="setRF('${key}',this.value)">${optHtml}</select>`;
  } else if (type === 'boolean') {
    return `<div style="${span}display:flex;align-items:center;gap:10px;padding:6px 0"><input type="checkbox" id="${id}" ${value?'checked':''} onchange="setRF('${key}',this.checked)" style="width:16px;height:16px;cursor:pointer;flex-shrink:0"><label for="${id}" style="font-size:13px;color:var(--dark);cursor:pointer">${label}</label></div>`;
  } else {
    input = `<input id="${id}" type="text" value="${esc(value||'')}" style="${base}" onchange="setRF('${key}',this.value)">`;
  }
  // Add validation hint and warning for economics fields
  var econExtra = '';
  if (ECON_FIELD_VALIDATORS[key]) {
    var vr = validateEconField(key, value);
    var hintText = vr.hint || '';
    econExtra = `<div style="font-size:10px;color:var(--n2);margin-top:2px">${esc(hintText)}</div>`;
    var warnDisplay = vr.warning ? 'block' : 'none';
    var warnText = vr.warning || '';
    econExtra += `<div id="rf-warn-${key}" style="display:${warnDisplay};font-size:10px;color:#e6a23c;margin-top:2px;padding:3px 6px;background:#e6a23c10;border-radius:4px">${esc(warnText)}</div>`;
  }
  return `<div style="${span}">${lHtml}${input}${econExtra}</div>`;
}

function rSec(title, fieldsHtml) {
  return `<div class="card" style="margin-bottom:10px">
    <div class="eyebrow" style="margin-bottom:14px">${title}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${fieldsHtml}</div>
  </div>`;
}

function renderEconReadiness(r) {
  var fields = [
    { key: 'monthly_marketing_budget', label: 'Budget', impact: 'Controls D1 lead volume estimates, D4 budget allocation, D3 cost analysis' },
    { key: 'average_deal_size', label: 'Deal Size', impact: 'Drives CPL thresholds, LTV calculation, paid viability' },
    { key: 'customer_lifetime_value', label: 'LTV', impact: 'Determines LTV:CAC ratio health, investment ceiling' },
    { key: 'close_rate_estimate', label: 'Close Rate', impact: 'Converts leads to deals — AI estimates if missing (lower confidence)' },
    { key: 'lead_quality_percentage', label: 'Lead Quality %', impact: 'Adjusts CPL to CPQL — AI assumes 30% if missing' },
    { key: 'current_lead_volume', label: 'Lead Volume', impact: 'Gap analysis between current and target lead volume' }
  ];
  var filled = 0;
  var missing = [];
  var warnings = [];
  for (var i = 0; i < fields.length; i++) {
    var val = r[fields[i].key];
    if (val && String(val).trim()) {
      filled++;
      var vr = validateEconField(fields[i].key, val);
      if (vr.warning) warnings.push({ label: fields[i].label, warning: vr.warning });
    } else {
      missing.push(fields[i]);
    }
  }
  var pct = Math.round((filled / fields.length) * 100);
  var colour = pct >= 80 ? 'var(--green)' : pct >= 50 ? '#e6a23c' : '#f56c6c';
  var confidenceLabel = filled >= 5 ? 'High' : filled >= 3 ? 'Medium' : 'Low';
  var confidenceColour = filled >= 5 ? 'var(--green)' : filled >= 3 ? '#e6a23c' : '#f56c6c';

  var html = '<div class="card" style="margin-bottom:10px;border-left:3px solid ' + colour + '">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  html += '<div class="eyebrow" style="margin:0">Strategy Economics Readiness</div>';
  html += '<div style="display:flex;align-items:center;gap:8px">';
  html += '<span style="font-size:10px;color:var(--n2)">D1 Confidence:</span>';
  html += '<span style="font-size:11px;font-weight:600;color:' + confidenceColour + '">' + confidenceLabel + '</span>';
  html += '<span style="font-size:18px;font-weight:700;color:' + colour + '">' + filled + '/' + fields.length + '</span>';
  html += '</div></div>';

  // Progress bar
  html += '<div style="height:4px;background:var(--panel);border-radius:2px;overflow:hidden;margin-bottom:10px">';
  html += '<div style="height:100%;width:' + pct + '%;background:' + colour + ';border-radius:2px;transition:width .3s"></div></div>';

  if (missing.length) {
    html += '<div style="font-size:11px;color:var(--n3);margin-bottom:6px">Missing inputs (AI will estimate with lower confidence):</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">';
    missing.forEach(function(m) {
      html += '<div style="font-size:10px;padding:3px 8px;background:#f56c6c10;color:#f56c6c;border-radius:4px;cursor:pointer" '
        + 'onclick="document.getElementById(\'rf-' + m.key + '\').focus()" title="' + esc(m.impact) + '">'
        + esc(m.label) + ' <i class="ti ti-arrow-right" style="font-size:9px"></i></div>';
    });
    html += '</div>';
  }
  if (warnings.length) {
    html += '<div style="font-size:11px;color:#e6a23c;margin-top:4px">';
    warnings.forEach(function(w) {
      html += '<div style="margin-bottom:2px"><strong>' + esc(w.label) + ':</strong> ' + esc(w.warning) + '</div>';
    });
    html += '</div>';
  }
  if (filled === fields.length && !warnings.length) {
    html += '<div style="font-size:11px;color:var(--green)"><i class="ti ti-circle-check" style="margin-right:4px"></i>All economics inputs provided — D1 will run at full confidence.</div>';
  }
  html += '</div>';
  return html;
}

function rRepGroup(key, label, columns, addLabel) {
  const items = (S.research && S.research[key]) ? S.research[key] : [];
  const headerHtml = items.length ? '<div style="display:flex;gap:6px;margin-bottom:4px">'
    + columns.map(col => `<div style="${col.width?'width:'+col.width+';min-width:'+col.width+';':'flex:1;min-width:0;'}font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);overflow:hidden">${col.label}</div>`).join('')
    + '<div style="width:26px"></div></div>' : '';

  const rowsHtml = items.map((item, i) => {
    const cells = columns.map(col => {
      const v = item[col.key] || '';
      const w = col.width ? 'width:'+col.width+';min-width:'+col.width+';flex-shrink:0;' : 'flex:1;min-width:0;';
      const base = w+'background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px;font-family:var(--font);color:var(--dark)';
      if (col.type === 'select') {
        const optHtml = (col.options||[]).map(o => `<option value="${o}" ${v===o?'selected':''}>${o}</option>`).join('');
        return `<select style="${base}" onchange="setRFRep('${key}',${i},'${col.key}',this.value)">${optHtml}</select>`;
      }
      return `<input type="text" value="${esc(v)}" placeholder="${esc(col.label)}" style="${base}" onchange="setRFRep('${key}',${i},'${col.key}',this.value)">`;
    }).join('');
    return `<div style="display:flex;gap:6px;align-items:center">${cells}<button onclick="removeRFRep('${key}',${i})" style="border:none;background:none;color:var(--n2);cursor:pointer;padding:2px 4px;font-size:18px;line-height:1;flex-shrink:0;margin-top:1px" title="Remove">×</button></div>`;
  }).join('');

  return `<div class="card" style="margin-bottom:10px">
    <div class="eyebrow" style="margin-bottom:12px">${label}</div>
    ${headerHtml}
    <div id="rrep-${key}" style="display:flex;flex-direction:column;gap:6px">${rowsHtml}</div>
    <button class="btn btn-ghost" onclick="addRFRep('${key}')" style="margin-top:8px;font-size:12px;padding:4px 10px">${addLabel||'+ Add Row'}</button>
  </div>`;
}

function setRF(key, value) {
  if (!S.research) S.research = researchDefaults();
  // Validate and normalise economics fields
  if (ECON_FIELD_VALIDATORS[key] && typeof value === 'string' && value.trim()) {
    var vResult = validateEconField(key, value);
    if (vResult.normalised) value = vResult.normalised;
    // Update inline warning if visible
    var warnEl = document.getElementById('rf-warn-' + key);
    if (warnEl) {
      if (vResult.warning) {
        warnEl.textContent = vResult.warning;
        warnEl.style.display = 'block';
      } else {
        warnEl.style.display = 'none';
      }
    }
    // Update the input value to show normalised format
    var inputEl = document.getElementById('rf-' + key);
    if (inputEl && vResult.normalised && inputEl.value !== vResult.normalised) {
      inputEl.value = vResult.normalised;
    }
  }
  const parts = key.split('.');
  let obj = S.research;
  for (let i = 0; i < parts.length - 1; i++) { obj[parts[i]] = obj[parts[i]] || {}; obj = obj[parts[i]]; }
  obj[parts[parts.length-1]] = value;
  S.research._updatedAt = Date.now();
  scheduleSave();
  scheduleScorecard();
}

function setRFArr(key, value) {
  setRF(key, value.split('\n').map(function(s){return s.trim();}).filter(Boolean));
}

function setRFCSV(key, value) {
  setRF(key, value.split(',').map(function(s){return s.trim();}).filter(Boolean));
}

function setRFRep(key, idx, field, value) {
  if (!S.research) S.research = researchDefaults();
  if (!S.research[key]) S.research[key] = [];
  if (!S.research[key][idx]) S.research[key][idx] = {};
  S.research[key][idx][field] = value;
  scheduleSave();
  scheduleScorecard();
}

function addRFRep(key) {
  if (!S.research) S.research = researchDefaults();
  if (!S.research[key]) S.research[key] = [];
  S.research[key].push({});
  scheduleSave();
  renderResearchTabContent();
  scheduleScorecard();
}

function removeRFRep(key, idx) {
  if (!S.research || !S.research[key]) return;
  S.research[key].splice(idx, 1);
  scheduleSave();
  renderResearchTabContent();
  scheduleScorecard();
}

// ── JTBD Force Map Accessors ──────────────────────────────────────
function _getJTBDForces(forceType) {
  if (!S.research || !S.research.jtbd_forces) return [];
  return S.research.jtbd_forces[forceType] || [];
}
function setRFJTBD(forceType, idx, field, value) {
  if (!S.research) S.research = researchDefaults();
  if (!S.research.jtbd_forces) S.research.jtbd_forces = { push_forces:[], pull_forces:[], anxieties:[], habits:[] };
  if (!S.research.jtbd_forces[forceType]) S.research.jtbd_forces[forceType] = [];
  if (!S.research.jtbd_forces[forceType][idx]) S.research.jtbd_forces[forceType][idx] = { force:'', quote:'', intensity:3 };
  S.research.jtbd_forces[forceType][idx][field] = value;
  scheduleSave();
  scheduleScorecard();
}
function addRFJTBD(forceType) {
  if (!S.research) S.research = researchDefaults();
  if (!S.research.jtbd_forces) S.research.jtbd_forces = { push_forces:[], pull_forces:[], anxieties:[], habits:[] };
  if (!S.research.jtbd_forces[forceType]) S.research.jtbd_forces[forceType] = [];
  S.research.jtbd_forces[forceType].push({ force:'', quote:'', intensity:3 });
  scheduleSave();
  renderResearchTabContent();
  scheduleScorecard();
}
function removeRFJTBD(forceType, idx) {
  if (!S.research || !S.research.jtbd_forces || !S.research.jtbd_forces[forceType]) return;
  S.research.jtbd_forces[forceType].splice(idx, 1);
  scheduleSave();
  renderResearchTabContent();
  scheduleScorecard();
}

// Decision criteria accessors
function setRFCriterion(idx, field, value) {
  if (!S.research) S.research = researchDefaults();
  if (!S.research.decision_criteria) S.research.decision_criteria = [];
  if (!S.research.decision_criteria[idx]) S.research.decision_criteria[idx] = { criterion:'', priority:'must-have' };
  S.research.decision_criteria[idx][field] = value;
  scheduleSave();
  scheduleScorecard();
}
function addRFCriterion() {
  if (!S.research) S.research = researchDefaults();
  if (!S.research.decision_criteria) S.research.decision_criteria = [];
  S.research.decision_criteria.push({ criterion:'', priority:'must-have' });
  scheduleSave();
  renderResearchTabContent();
  scheduleScorecard();
}
function removeRFCriterion(idx) {
  if (!S.research || !S.research.decision_criteria) return;
  S.research.decision_criteria.splice(idx, 1);
  scheduleSave();
  renderResearchTabContent();
  scheduleScorecard();
}

// ── JTBD Force Group Renderer ─────────────────────────────────────
function rJTBDForceGroup(forceType, label, icon, colour) {
  var items = _getJTBDForces(forceType);
  var html = '<div style="margin-bottom:12px">';
  html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:' + colour + ';margin-bottom:6px;display:flex;align-items:center;gap:5px"><i class="ti ti-' + icon + '" style="font-size:13px"></i>' + esc(label);
  if (items.length) html += ' <span style="font-size:10px;opacity:0.6">(' + items.length + ')</span>';
  html += '</div>';
  if (items.length) {
    html += '<div style="display:flex;gap:6px;margin-bottom:4px">';
    html += '<div style="flex:1;min-width:0;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2)">Force / Behaviour</div>';
    html += '<div style="flex:1;min-width:0;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2)">Supporting Quote</div>';
    html += '<div style="width:60px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);text-align:center">Intensity</div>';
    html += '<div style="width:26px"></div></div>';
  }
  items.forEach(function(item, i) {
    html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">';
    html += '<input type="text" value="' + esc(item.force || '') + '" placeholder="e.g. Manual data entry across 6 systems" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px;font-family:var(--font);color:var(--dark)" onchange="setRFJTBD(\'' + forceType + '\',' + i + ',\'force\',this.value)">';
    html += '<input type="text" value="' + esc(item.quote || '') + '" placeholder="Verbatim quote..." style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px;font-family:var(--font);color:var(--dark);font-style:italic" onchange="setRFJTBD(\'' + forceType + '\',' + i + ',\'quote\',this.value)">';
    html += '<select style="width:60px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 4px;font-size:12px;font-family:var(--font);color:var(--dark);text-align:center" onchange="setRFJTBD(\'' + forceType + '\',' + i + ',\'intensity\',parseInt(this.value))">';
    for (var s = 1; s <= 5; s++) html += '<option value="' + s + '"' + ((item.intensity || 3) === s ? ' selected' : '') + '>' + s + '</option>';
    html += '</select>';
    html += '<button onclick="removeRFJTBD(\'' + forceType + '\',' + i + ')" style="border:none;background:none;color:var(--n2);cursor:pointer;padding:2px 4px;font-size:18px;line-height:1;flex-shrink:0" title="Remove">\u00d7</button>';
    html += '</div>';
  });
  html += '<button class="btn btn-ghost" onclick="addRFJTBD(\'' + forceType + '\')" style="font-size:11px;padding:3px 8px;color:' + colour + ';border-color:' + colour + '30"><i class="ti ti-plus" style="font-size:10px"></i> Add ' + label.replace(/^JTBD /, '') + '</button>';
  html += '</div>';
  return html;
}

// ── Decision Criteria Renderer ────────────────────────────────────
function rDecisionCriteria() {
  var items = (S.research && S.research.decision_criteria) || [];
  var html = '<div style="margin-bottom:12px">';
  html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:6px">Decision Criteria';
  if (items.length) html += ' <span style="font-size:10px;opacity:0.6">(' + items.length + ')</span>';
  html += '</div>';
  if (items.length) {
    html += '<div style="display:flex;gap:6px;margin-bottom:4px">';
    html += '<div style="flex:1;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2)">Criterion</div>';
    html += '<div style="width:110px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2)">Priority</div>';
    html += '<div style="width:26px"></div></div>';
  }
  items.forEach(function(item, i) {
    html += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">';
    html += '<input type="text" value="' + esc(item.criterion || '') + '" placeholder="e.g. Must integrate with PropertyWare" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px;font-family:var(--font);color:var(--dark)" onchange="setRFCriterion(' + i + ',\'criterion\',this.value)">';
    html += '<select style="width:110px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 4px;font-size:12px;font-family:var(--font);color:var(--dark)" onchange="setRFCriterion(' + i + ',\'priority\',this.value)">';
    html += '<option value="must-have"' + ((item.priority || 'must-have') === 'must-have' ? ' selected' : '') + '>Must-have</option>';
    html += '<option value="nice-to-have"' + (item.priority === 'nice-to-have' ? ' selected' : '') + '>Nice-to-have</option>';
    html += '</select>';
    html += '<button onclick="removeRFCriterion(' + i + ')" style="border:none;background:none;color:var(--n2);cursor:pointer;padding:2px 4px;font-size:18px;line-height:1;flex-shrink:0" title="Remove">\u00d7</button>';
    html += '</div>';
  });
  html += '<button class="btn btn-ghost" onclick="addRFCriterion()" style="font-size:11px;padding:3px 8px"><i class="ti ti-plus" style="font-size:10px"></i> Add Criterion</button>';
  html += '</div>';
  return html;
}

// ── Buyer Psychology Coverage Map ─────────────────────────────────
function renderBuyerPsychCoverage(r) {
  var jf = (r && r.jtbd_forces) || {};
  var checks = [
    { label: 'Push Forces', filled: (jf.push_forces || []).length > 0 },
    { label: 'Pull Forces', filled: (jf.pull_forces || []).length > 0 },
    { label: 'Anxieties', filled: (jf.anxieties || []).length > 0 },
    { label: 'Habits', filled: (jf.habits || []).length > 0 },
    { label: 'Sophistication', filled: !!(r && r.buyer_sophistication) },
    { label: 'Perceived Categories', filled: (r && r.perceived_categories || []).length > 0 },
    { label: 'Switching Triggers', filled: (r && r.switching_triggers || []).length > 0 },
    { label: 'Decision Criteria', filled: (r && r.decision_criteria || []).length > 0 }
  ];
  var filled = checks.filter(function(c) { return c.filled; }).length;
  var pct = Math.round((filled / checks.length) * 100);
  var colour = pct >= 75 ? '#10b981' : pct >= 40 ? '#e6a23c' : '#999';

  var html = '<div style="background:rgba(0,0,0,0.02);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2)">Buyer Psychology Coverage</div>';
  html += '<div style="display:flex;align-items:center;gap:8px">';
  html += '<span style="font-size:12px;font-weight:500;color:' + colour + '">' + pct + '%</span>';
  html += '<button id="btn-gen-buyer-psych" class="btn btn-ghost" style="font-size:11px;padding:3px 10px;color:#3b82f6;border-color:rgba(59,130,246,0.3)" onclick="generateMissingBuyerPsych()"><i class="ti ti-sparkles" style="font-size:10px"></i> AI Generate Missing</button>';
  html += '</div></div>';
  // Progress bar
  html += '<div style="background:var(--border);border-radius:4px;height:4px;margin-bottom:8px"><div style="background:' + colour + ';border-radius:4px;height:4px;width:' + pct + '%;transition:width .3s"></div></div>';
  // Checklist
  html += '<div style="display:flex;flex-wrap:wrap;gap:4px 12px">';
  checks.forEach(function(c) {
    var icon = c.filled ? '<i class="ti ti-check" style="color:#10b981;font-size:11px"></i>' : '<i class="ti ti-x" style="color:#999;font-size:11px"></i>';
    html += '<span style="font-size:11px;color:' + (c.filled ? 'var(--dark)' : 'var(--n2)') + ';display:flex;align-items:center;gap:3px">' + icon + c.label + '</span>';
  });
  html += '</div></div>';
  return html;
}

// ── AI Generate Missing Buyer Psychology ───────────────────────────
async function generateMissingBuyerPsych() {
  var btn = document.getElementById('btn-gen-buyer-psych');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Generating...'; }

  var r = S.research || {};
  var ctx = 'CLIENT: ' + (r.client_name || S.setup.clientName || '') + '\n';
  ctx += 'INDUSTRY: ' + (r.industry || '') + '\n';
  ctx += 'SERVICES: ' + (r.primary_services || []).join(', ') + '\n';
  ctx += 'PAIN POINTS: ' + (r.pain_points_top5 || []).join('; ') + '\n';
  ctx += 'OBJECTIONS: ' + (r.objections_top5 || []).join('; ') + '\n';
  if (r.clientPain && r.clientPain.primary) ctx += 'CLIENT PAIN: ' + r.clientPain.primary + '\n';
  if (r.clientPain && r.clientPain.consequence) ctx += 'CONSEQUENCE: ' + r.clientPain.consequence + '\n';
  if (r.voc_swipe_raw) ctx += 'VOC QUOTES:\n' + r.voc_swipe_raw.slice(0, 2000) + '\n';
  // D0 audience data
  if (S.strategy && S.strategy.audience) {
    var aud = S.strategy.audience;
    if (aud.personas && aud.personas.length) ctx += 'PERSONAS: ' + aud.personas.map(function(p) { return p.archetype || p.name || ''; }).join(', ') + '\n';
    if (aud.purchase_triggers && aud.purchase_triggers.length) ctx += 'PURCHASE TRIGGERS: ' + aud.purchase_triggers.slice(0, 5).join('; ') + '\n';
    if (aud.perceived_alternatives && aud.perceived_alternatives.length) ctx += 'PERCEIVED ALTERNATIVES: ' + aud.perceived_alternatives.map(function(a) { return a.alternative || ''; }).join(', ') + '\n';
  }
  // D2 positioning data
  if (S.strategy && S.strategy.positioning) {
    var pos = S.strategy.positioning;
    if (pos.selected_direction) ctx += 'POSITIONING: ' + (typeof pos.selected_direction === 'string' ? pos.selected_direction : JSON.stringify(pos.selected_direction)) + '\n';
  }

  // Determine which fields are missing
  var jf = r.jtbd_forces || {};
  var missing = [];
  if (!(jf.push_forces || []).length) missing.push('push_forces');
  if (!(jf.pull_forces || []).length) missing.push('pull_forces');
  if (!(jf.anxieties || []).length) missing.push('anxieties');
  if (!(jf.habits || []).length) missing.push('habits');
  if (!r.buyer_sophistication) missing.push('buyer_sophistication');
  if (!(r.perceived_categories || []).length) missing.push('perceived_categories');
  if (!(r.switching_triggers || []).length) missing.push('switching_triggers');
  if (!(r.decision_criteria || []).length) missing.push('decision_criteria');

  if (!missing.length) {
    aiBarNotify('All buyer psychology fields already populated', { duration: 3000 });
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles" style="font-size:10px"></i> AI Generate Missing'; }
    return;
  }

  var prompt = ctx + '\nGENERATE the following missing buyer psychology fields based on the context above. Only generate fields listed below. Return valid JSON.\n\n'
    + 'MISSING FIELDS: ' + missing.join(', ') + '\n\n'
    + 'JSON SCHEMA:\n{\n'
    + (missing.includes('push_forces') ? '  "push_forces": [{"force":"what frustrates them","quote":"their words if available","intensity":1-5}],\n' : '')
    + (missing.includes('pull_forces') ? '  "pull_forces": [{"force":"what attracts them forward","quote":"their words if available","intensity":1-5}],\n' : '')
    + (missing.includes('anxieties') ? '  "anxieties": [{"force":"what they fear about switching","quote":"their words if available","intensity":1-5}],\n' : '')
    + (missing.includes('habits') ? '  "habits": [{"force":"status quo behaviour keeping them stuck","quote":"their words if available","intensity":1-5}],\n' : '')
    + (missing.includes('buyer_sophistication') ? '  "buyer_sophistication": "1-5 (1=naive, 5=highly sophisticated)",\n' : '')
    + (missing.includes('perceived_categories') ? '  "perceived_categories": ["how buyer frames what they are shopping for"],\n' : '')
    + (missing.includes('switching_triggers') ? '  "switching_triggers": ["what made them act now"],\n' : '')
    + (missing.includes('decision_criteria') ? '  "decision_criteria": [{"criterion":"what they evaluate","priority":"must-have|nice-to-have"}],\n' : '')
    + '}\n\nGenerate 3-5 items per array. Use evidence from the context. If no direct quotes available, leave quote empty. Be specific to this client, not generic.';

  try {
    var resp = '';
    await callClaude('You are a buyer psychology analyst. Return only valid JSON.', prompt, function(chunk) { resp += chunk; }, 4000, 'Buyer Psychology');
    var clean = resp.replace(/```json\s*/gi, '').replace(/```\s*/g, '').replace(/[\x00-\x1F\x7F]/g, ' ').replace(/,\s*([\]}])/g, '$1').trim();
    var parsed = JSON.parse(clean);

    if (!S.research.jtbd_forces) S.research.jtbd_forces = { push_forces:[], pull_forces:[], anxieties:[], habits:[] };
    if (parsed.push_forces && !(jf.push_forces || []).length) S.research.jtbd_forces.push_forces = parsed.push_forces;
    if (parsed.pull_forces && !(jf.pull_forces || []).length) S.research.jtbd_forces.pull_forces = parsed.pull_forces;
    if (parsed.anxieties && !(jf.anxieties || []).length) S.research.jtbd_forces.anxieties = parsed.anxieties;
    if (parsed.habits && !(jf.habits || []).length) S.research.jtbd_forces.habits = parsed.habits;
    if (parsed.buyer_sophistication && !r.buyer_sophistication) S.research.buyer_sophistication = String(parsed.buyer_sophistication);
    if (parsed.perceived_categories && !(r.perceived_categories || []).length) S.research.perceived_categories = parsed.perceived_categories;
    if (parsed.switching_triggers && !(r.switching_triggers || []).length) S.research.switching_triggers = parsed.switching_triggers;
    if (parsed.decision_criteria && !(r.decision_criteria || []).length) S.research.decision_criteria = parsed.decision_criteria;

    scheduleSave();
    renderResearchTabContent();
    aiBarNotify('Buyer psychology fields generated (' + missing.length + ' fields)', { duration: 3000 });
  } catch (e) {
    console.error('Buyer psych generation failed:', e);
    aiBarNotify('Buyer psychology generation failed: ' + e.message, { isError: true, duration: 5000 });
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles" style="font-size:10px"></i> AI Generate Missing'; }
}

// ── Tab renderers ─────────────────────────────────────────────────

function rTabActions(tab) {
  var label = tab.charAt(0).toUpperCase() + tab.slice(1);
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">'
    + '<button id="enrich-btn-'+tab+'" class="btn btn-primary" onclick="enrichOneTab(\''+tab+'\')" style="white-space:nowrap"><i class="ti ti-sparkles"></i> Enrich ' + label + '</button>'
    + '<span id="enrich-status-'+tab+'" style="font-size:12px;color:var(--n2)"></span>'
    + '</div>';
}

function renderRBusiness(r) {
  let html = rTabActions('business');
  html += rSec('Core Identity',
    rField('business_overview','Business Overview', r.business_overview, 'textarea', {rows:3}) +
    rField('industry','Industry', r.industry) +
    rField('sub_industry','Sub-Industry / Niche', r.sub_industry) +
    rField('business_model','Business Model', r.business_model, 'select', {options:['','b2b','b2c','b2b2c','marketplace','saas','nonprofit']}) +
    rField('years_in_business','Years in Business', r.years_in_business) +
    rField('team_size','Team Size', r.team_size) +
    rField('locations_count','Number of Locations', r.locations_count)
  );
  html += rSec('Services & Pricing',
    rField('current_pricing','Current Pricing', r.current_pricing, 'textarea', {rows:3}) +
    rField('pricing_model','Pricing Model', r.pricing_model, 'select', {options:['','quote_based','fixed_menu','subscription']}) +
    rField('capacity_constraints','Capacity Constraints', r.capacity_constraints) +
    rField('seasonality_notes','Seasonality Notes', r.seasonality_notes)
  );
  html += rRepGroup('services_detail','Services',
    [{key:'name',label:'Service Name',width:'150px'},{key:'description',label:'Description'},{key:'pricing',label:'Pricing',width:'120px'},{key:'target_audience',label:'Target Audience',width:'130px'},{key:'key_differentiator',label:'Differentiator',width:'130px'}],
    '+ Add Service'
  );
  // Client Pain card (Layer 1)
  html += renderClientPainCard(r);
  return html;
}

function renderClientPainCard(r) {
  var cp = r.clientPain || {};
  var hasPrimary = cp.primary && cp.primary.trim();
  var hasAny = hasPrimary || (cp.secondary && cp.secondary.length) || (cp.clientQuotes && cp.clientQuotes.length);
  var borderColor = hasPrimary ? 'var(--green)' : hasAny ? '#e6a23c' : '#f56c6c';
  var statusBadge = hasPrimary
    ? '<span style="font-size:9px;background:var(--green);color:white;padding:1px 6px;border-radius:3px;margin-left:8px">Extracted</span>'
    : '<span style="font-size:9px;background:#f56c6c;color:white;padding:1px 6px;border-radius:3px;margin-left:8px">Missing</span>';
  if (cp._extractedAt) {
    var d = new Date(cp._extractedAt);
    statusBadge += '<span style="font-size:9px;color:var(--n2);margin-left:6px">Extracted ' + d.toLocaleDateString('en-CA') + '</span>';
  }
  if (cp.source) {
    statusBadge += '<span style="font-size:9px;color:var(--n2);margin-left:4px">via ' + cp.source.replace(/_/g,' ') + '</span>';
  }

  var html = '<div class="card" style="margin-bottom:10px;border-left:3px solid ' + borderColor + '">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
  html += '<div style="display:flex;align-items:center">';
  html += '<div class="eyebrow" style="margin:0;color:#f56c6c">Client Pain</div>';
  html += statusBadge;
  html += '</div>';
  html += '<div style="display:flex;gap:6px">';
  html += '<button class="btn btn-ghost sm" onclick="extractClientPain()"><i class="ti ti-sparkles" style="font-size:11px"></i> Re-extract</button>';
  html += '<button class="btn btn-ghost sm" onclick="toggleClientPainEdit()"><i class="ti ti-edit" style="font-size:11px"></i> Edit</button>';
  html += '</div></div>';
  html += '<p style="font-size:11px;color:var(--n2);margin:0 0 12px">Why this client hired Setsail — extracted from discovery notes and uploaded documents.</p>';

  // Read-only display
  html += '<div id="client-pain-display">';
  // Primary Pain
  html += '<div style="margin-bottom:10px">';
  html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:3px">Primary Pain</div>';
  html += '<div style="font-size:13px;color:var(--dark);padding:6px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--border)">' + esc(cp.primary || 'Not yet captured — run enrichment or edit manually') + '</div>';
  html += '</div>';

  // Secondary Pains
  if (cp.secondary && cp.secondary.length) {
    html += '<div style="margin-bottom:10px">';
    html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:3px">Secondary Pains</div>';
    for (var si = 0; si < cp.secondary.length; si++) {
      html += '<div style="font-size:12px;color:var(--dark);padding:4px 0;display:flex;gap:6px"><span style="color:var(--n2)">·</span>' + esc(cp.secondary[si]) + '</div>';
    }
    html += '</div>';
  }

  // Consequence + Urgency (side by side)
  if (cp.consequence || cp.urgencyTrigger) {
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
    html += '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:3px">Consequence</div>';
    html += '<div style="font-size:12px;color:var(--dark);padding:6px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--border);min-height:28px">' + esc(cp.consequence || 'Not stated') + '</div></div>';
    html += '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:3px">Why Now</div>';
    html += '<div style="font-size:12px;color:var(--dark);padding:6px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--border);min-height:28px">' + esc(cp.urgencyTrigger || 'Not stated') + '</div></div>';
    html += '</div>';
  }

  // Prior Attempts
  if (cp.priorAttempts && cp.priorAttempts.length) {
    html += '<div style="margin-bottom:10px">';
    html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:3px">What They Have Tried</div>';
    for (var pa = 0; pa < cp.priorAttempts.length; pa++) {
      var att = cp.priorAttempts[pa];
      html += '<div style="font-size:12px;padding:6px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--border);margin-bottom:4px">';
      html += '<strong>' + esc(att.what || '') + '</strong>';
      if (att.outcome) html += ' <span style="color:var(--n2)">&rarr;</span> ' + esc(att.outcome);
      var meta = [];
      if (att.spend) meta.push(att.spend);
      if (att.duration) meta.push(att.duration);
      if (meta.length) html += '<div style="font-size:10px;color:var(--n2);margin-top:2px">' + esc(meta.join(' · ')) + '</div>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Success Definition
  if (cp.successDefinition) {
    html += '<div style="margin-bottom:10px">';
    html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:3px">Their Definition of Success</div>';
    html += '<div style="font-size:12px;color:var(--dark);padding:6px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--border)">' + esc(cp.successDefinition) + '</div>';
    html += '</div>';
  }

  // Client Quotes
  if (cp.clientQuotes && cp.clientQuotes.length) {
    html += '<div style="margin-bottom:10px">';
    html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:3px">In Their Words</div>';
    for (var qi = 0; qi < cp.clientQuotes.length; qi++) {
      html += '<div style="font-size:12px;color:var(--dark);padding:6px 10px;border-left:3px solid #e6a23c;background:#e6a23c08;border-radius:0 6px 6px 0;margin-bottom:4px;font-style:italic">"' + esc(cp.clientQuotes[qi]) + '"</div>';
    }
    html += '</div>';
  }

  // Customer Voice Quotes (stashed for Strategy)
  if (cp._customerVoiceQuotes && cp._customerVoiceQuotes.length) {
    html += '<div style="margin-bottom:10px">';
    html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:3px">Customer Voice Quotes <span style="font-size:9px;background:var(--lime);color:var(--dark);padding:1px 5px;border-radius:3px;text-transform:none;letter-spacing:0;vertical-align:middle">feeds Strategy</span></div>';
    for (var cvi = 0; cvi < cp._customerVoiceQuotes.length; cvi++) {
      html += '<div style="font-size:12px;color:var(--dark);padding:6px 10px;border-left:3px solid var(--green);background:var(--green-bg,#10b98108);border-radius:0 6px 6px 0;margin-bottom:4px;font-style:italic">"' + esc(cp._customerVoiceQuotes[cvi]) + '"</div>';
    }
    html += '</div>';
  }
  html += '</div>'; // end #client-pain-display

  // Editable form (hidden by default)
  html += '<div id="client-pain-edit" style="display:none">';
  html += '<div style="display:grid;grid-template-columns:1fr;gap:10px">';
  html += '<div><label style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:3px">Primary Pain</label>';
  html += '<input id="cp-primary" type="text" value="' + esc(cp.primary || '') + '" class="inp" placeholder="The single biggest reason they hired Setsail"></div>';
  html += '<div><label style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:3px">Secondary Pains (one per line)</label>';
  html += '<textarea id="cp-secondary" rows="3" class="inp" placeholder="Other problems mentioned">' + esc((cp.secondary || []).join('\n')) + '</textarea></div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  html += '<div><label style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:3px">Consequence</label>';
  html += '<input id="cp-consequence" type="text" value="' + esc(cp.consequence || '') + '" class="inp" placeholder="What happens if nothing changes"></div>';
  html += '<div><label style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:3px">Why Now</label>';
  html += '<input id="cp-urgency" type="text" value="' + esc(cp.urgencyTrigger || '') + '" class="inp" placeholder="What changed or what deadline"></div>';
  html += '</div>';
  html += '<div><label style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:3px">Success Definition</label>';
  html += '<input id="cp-success" type="text" value="' + esc(cp.successDefinition || '') + '" class="inp" placeholder="How they defined success, in their words"></div>';
  html += '<div><label style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:3px">Client Quotes (one per line)</label>';
  html += '<textarea id="cp-quotes" rows="4" class="inp" placeholder="Direct quotes that capture frustration, fear, or aspiration">' + esc((cp.clientQuotes || []).join('\n')) + '</textarea></div>';
  // Prior Attempts editor (simplified — one per line as "what → outcome | spend | duration")
  html += '<div><label style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:3px">Prior Attempts <span style="font-weight:400;text-transform:none;letter-spacing:0">(one per line: what &rarr; outcome | spend | duration)</span></label>';
  var attLines = (cp.priorAttempts || []).map(function(a) {
    var parts = [a.what || ''];
    if (a.outcome) parts[0] += ' → ' + a.outcome;
    if (a.spend) parts.push(a.spend);
    if (a.duration) parts.push(a.duration);
    return parts.join(' | ');
  });
  html += '<textarea id="cp-attempts" rows="3" class="inp" placeholder="Freelance SEO → no results | $2,000/mo | 6 months">' + esc(attLines.join('\n')) + '</textarea></div>';
  html += '</div>';
  html += '<div style="display:flex;gap:6px;margin-top:10px">';
  html += '<button class="btn btn-primary sm" onclick="saveClientPainEdit()"><i class="ti ti-check"></i> Save</button>';
  html += '<button class="btn btn-ghost sm" onclick="toggleClientPainEdit()">Cancel</button>';
  html += '</div>';
  html += '</div>'; // end #client-pain-edit

  html += '</div>'; // end card
  return html;
}

function toggleClientPainEdit() {
  var display = document.getElementById('client-pain-display');
  var edit = document.getElementById('client-pain-edit');
  if (!display || !edit) return;
  if (edit.style.display === 'none') {
    display.style.display = 'none';
    edit.style.display = 'block';
  } else {
    display.style.display = 'block';
    edit.style.display = 'none';
  }
}

function saveClientPainEdit() {
  if (!S.research) S.research = researchDefaults();
  if (!S.research.clientPain) S.research.clientPain = {};
  var cp = S.research.clientPain;
  cp.primary = (document.getElementById('cp-primary')?.value || '').trim();
  cp.secondary = (document.getElementById('cp-secondary')?.value || '').trim().split('\n').map(function(s){return s.trim();}).filter(Boolean);
  cp.consequence = (document.getElementById('cp-consequence')?.value || '').trim();
  cp.urgencyTrigger = (document.getElementById('cp-urgency')?.value || '').trim();
  cp.successDefinition = (document.getElementById('cp-success')?.value || '').trim();
  cp.clientQuotes = (document.getElementById('cp-quotes')?.value || '').trim().split('\n').map(function(s){return s.trim();}).filter(Boolean);
  // Parse prior attempts from simplified format: "what → outcome | spend | duration"
  var attRaw = (document.getElementById('cp-attempts')?.value || '').trim().split('\n').filter(Boolean);
  cp.priorAttempts = attRaw.map(function(line) {
    var mainParts = line.split('|').map(function(s){return s.trim();});
    var whatOutcome = (mainParts[0] || '').split(/\s*→\s*|\s*->\s*/);
    return {
      what: (whatOutcome[0] || '').trim(),
      outcome: (whatOutcome[1] || '').trim(),
      spend: (mainParts[1] || '').trim(),
      duration: (mainParts[2] || '').trim()
    };
  });
  if (!cp.source) cp.source = 'manual';
  scheduleSave();
  toggleClientPainEdit();
  renderResearchTabContent();
  scheduleScorecard();
}

async function extractClientPain() {
  try {
    aiBarStart('Extracting client pain...');
    await enrichRTab('client-pain', true);
    aiBarEnd();
    aiBarNotify('Client pain extracted', { type: 'success' });
    renderResearchTabContent();
  } catch(e) {
    aiBarEnd();
    aiBarNotify('Client pain extraction failed: ' + (e.message || '').slice(0, 60), { type: 'error' });
  }
}

function renderRAudience(r) {
  let html = rTabActions('audience');
  html += rSec('Buyer Profile',
    rField('primary_audience_description','Audience Description', r.primary_audience_description, 'textarea', {rows:3}) +
    rField('buyer_roles_titles','Buyer Roles / Titles (comma-separated)', r.buyer_roles_titles, 'text-csv') +
    rField('target_geography','Target Geography Scope', r.target_geography, 'select', {options:['local','regional','national','international']}) +
    rField('best_customer_examples','Ideal Customer Examples', r.best_customer_examples, 'textarea', {rows:2}) +
    rField('geography.primary','Primary City / Region', r.geography ? r.geography.primary : '') +
    rField('geography.secondary','Secondary Cities (one per line)', r.geography ? r.geography.secondary : [], 'textarea-array', {rows:3})
  );
  html += rSec('Pain Points & Objections',
    rField('pain_points_top5','Top Pain Points (one per line)', r.pain_points_top5, 'textarea-array', {rows:5}) +
    rField('objections_top5','Top Objections (one per line)', r.objections_top5, 'textarea-array', {rows:5})
  );
  html += rSec('Sales & Goals',
    rField('primary_goal','Primary Goal', r.primary_goal, 'select', {options:['leads','sales','bookings','traffic','awareness','recruitment','retention']}) +
    rField('secondary_goals','Secondary Goals (comma-separated)', r.secondary_goals, 'text-csv') +
    rField('lead_channels_today','Current Lead Channels (comma-separated)', r.lead_channels_today, 'text-csv') +
    rField('sales_cycle_length','Sales Cycle Length', r.sales_cycle_length, 'select', {options:['','same_day','1_7_days','14_30_days','30_plus_days']}) +
    rField('close_rate_estimate','Estimated Close Rate', r.close_rate_estimate) +
    rField('current_qualification','Current Lead Qualification', r.current_qualification, 'textarea', {rows:2}) +
    rField('top_reasons_leads_dont_close','Top Reasons Leads Do Not Close', r.top_reasons_leads_dont_close, 'textarea', {rows:2}) +
    rField('booking_flow_description','Booking / Intake Flow', r.booking_flow_description, 'textarea', {rows:2})
  );
  html += rSec('Client Success Definition',
    rField('goal_statement','Success Statement (Client Voice)', r.goal_statement, 'textarea', {rows:3}) +
    rField('goal_target','Measurable Target', r.goal_target) +
    rField('goal_baseline','Current Baseline', r.goal_baseline) +
    rField('goal_timeline','Goal Timeline', r.goal_timeline, 'select', {options:['','3 months','6 months','12 months','18 months','ongoing']}) +
    rField('goal_kpi','Primary KPI', r.goal_kpi, 'select', {options:['','qualified_leads','revenue','cpl','organic_traffic','rankings','bookings','calls','brand_awareness']})
  );
  // Economics readiness panel
  html += renderEconReadiness(r);
  html += rSec('Unit Economics',
    rField('monthly_marketing_budget','Monthly Marketing Budget (e.g. $5,000)', r.monthly_marketing_budget) +
    rField('average_deal_size','Average Deal Size (e.g. $3,500)', r.average_deal_size) +
    rField('customer_lifetime_value','Customer Lifetime Value (e.g. $12,000)', r.customer_lifetime_value) +
    rField('lead_quality_percentage','Lead Quality % (e.g. 40%)', r.lead_quality_percentage) +
    rField('current_lead_volume','Current Monthly Leads (e.g. 25)', r.current_lead_volume)
  );
  html += rSec('Marketing History',
    rField('current_marketing_activities','Current Marketing Activities (one per line)', r.current_marketing_activities, 'textarea-array', {rows:4}) +
    rField('previous_agency_experience','Previous Agency Experience', r.previous_agency_experience, 'select', {options:['','Good experience','Bad experience','No agency','Multiple agencies']})
  );
  // Buyer Psychology — JTBD Force Map
  html += renderBuyerPsychCoverage(r);
  html += rSec('Buyer Psychology \u2014 JTBD Force Map',
    rJTBDForceGroup('push_forces', 'Push Forces', 'arrow-right', '#dc2626') +
    rJTBDForceGroup('pull_forces', 'Pull Forces', 'arrow-up-right', '#10b981') +
    rJTBDForceGroup('anxieties', 'Anxieties', 'alert-triangle', '#f59e0b') +
    rJTBDForceGroup('habits', 'Habits', 'refresh', '#6b7280')
  );
  html += rSec('Buyer Context',
    rField('buyer_sophistication', 'Buyer Sophistication (1=naive, 5=highly sophisticated)', r.buyer_sophistication, 'select', {options:['','1','2','3','4','5']}) +
    rField('perceived_categories', 'Perceived Categories \u2014 how the buyer frames what they are shopping for (one per line)', r.perceived_categories, 'textarea-array', {rows:3}) +
    rField('switching_triggers', 'Switching Triggers \u2014 what made them act now (one per line)', r.switching_triggers, 'textarea-array', {rows:3}) +
    rDecisionCriteria()
  );
  return html;
}

function renderRBrand(r) {
  let html = rTabActions('brand');
  html += rSec('Brand Identity',
    rField('brand_name','Brand Name', r.brand_name) +
    rField('current_slogan','Current Slogan / Tagline', r.current_slogan) +
    rField('existing_proof','Existing Proof Points (one per line)', r.existing_proof, 'textarea-array', {rows:4})
  );
  html += rSec('Visual Assets',
    rField('brand_colours','Brand Colours — hex codes (comma-separated)', r.brand_colours, 'text-csv') +
    rField('fonts','Fonts (comma-separated)', r.fonts, 'text-csv') +
    rField('logo_url','Logo URL (auto-detected from website)', r.logo_url) +
    rField('brand_guidelines_link','Brand Guidelines Link', r.brand_guidelines_link) +
    rField('logo_files_link','Logo Files Link', r.logo_files_link) +
    rField('photo_library_link','Photo Library Link', r.photo_library_link) +
    rField('video_library_link','Video Library Link', r.video_library_link) +
    rField('existing_ad_creatives_link','Existing Ad Creatives Link', r.existing_ad_creatives_link) +
    rField('do_not_use_assets_notes','Do Not Use (assets/phrases)', r.do_not_use_assets_notes, 'textarea', {rows:2})
  );
  html += rSec('Proof & E-E-A-T',
    rField('team_credentials','Team Credentials / Expertise', r.team_credentials, 'textarea', {rows:3}) +
    rField('founder_bio','Founder Bio', r.founder_bio, 'textarea', {rows:3}) +
    rField('awards_certifications','Awards & Certifications (one per line)', r.awards_certifications, 'textarea-array', {rows:4}) +
    rField('notable_clients','Notable Clients (one per line)', r.notable_clients, 'textarea-array', {rows:4}) +
    rField('publications_media','Publications & Media Mentions (one per line)', r.publications_media, 'textarea-array', {rows:3})
  );
  html += rSec('Voice of Customer',
    rField('voc_swipe_raw','Voice of Customer \u2014 Swipe File', r.voc_swipe_raw || '', 'textarea', {rows:5, placeholder:'Paste real customer quotes, review excerpts, or sales call transcripts \u2014 one per line\ne.g. "I just need someone who picks up the phone"\n"We wasted $30k on the last agency and got nothing"'})
  );
  html += rRepGroup('case_studies','Case Studies',
    [{key:'client',label:'Client',width:'140px'},{key:'result',label:'Result / Outcome'},{key:'timeframe',label:'Timeframe',width:'100px'}],
    '+ Add Case Study'
  );
  html += rRepGroup('reference_brands','Reference Brands',
    [{key:'url',label:'URL'},{key:'what_you_like',label:'What You Like'}],
    '+ Add Reference Brand'
  );
  return html;
}

async function pullGMB() {
  const r = S.research || researchDefaults();
  const s = S.setup || {};
  const btn = document.getElementById('gmb-pull-btn');
  const statusEl = document.getElementById('gmb-pull-status');
  const keyword = s.client || r.client_name || '';
  if (!keyword) { if (statusEl) statusEl.textContent = 'Set client name in Setup first'; return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;display:inline-block"></span> Fetching...'; }
  if (statusEl) statusEl.textContent = '';
  try {
    const res = await fetch('/api/gmb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: keyword + ' ' + (s.geo || '') })
    });
    const data = await res.json();
    if (!data.result) {
      if (statusEl) statusEl.textContent = data.error || 'No listing found';
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-brand-google"></i> Pull from Google Business Profile'; }
      return;
    }
    const g = data.result;
    _cachedGMBData = g;
    if (!S.research) S.research = researchDefaults();
    const rd = S.research;
    const ap = g.address_parts || {};
    if (ap.address) rd.schema_street_address = ap.address;
    if (ap.city || ap.borough) rd.schema_city = ap.city || ap.borough;
    if (ap.region) rd.schema_region = ap.region;
    if (ap.zip) rd.schema_postal_code = ap.zip;
    if (ap.country_code) rd.schema_country = ap.country_code;
    if (g.category && !rd.schema_primary_category) rd.schema_primary_category = g.category;
    if (g.price_level && !rd.schema_price_range) rd.schema_price_range = g.price_level;
    if (g.phone && !rd.schema_phone) rd.schema_phone = g.phone;
    if (g.social_profiles && g.social_profiles.length > 0) rd.social_profiles = g.social_profiles;
    if (g.reviews && g.reviews.length > 0) rd.reviews = g.reviews;
    // Fill geography from GMB address if empty
    if (!rd.geography) rd.geography = { primary: '', secondary: [] };
    if (!rd.geography.primary && (ap.city || ap.borough) && ap.region) {
      rd.geography.primary = (ap.city || ap.borough) + ', ' + ap.region;
    }
    scheduleSave();
    _rTab = 'schema';
    renderResearchTabContent();
    var _dbgKeys = g._debug_keys ? ' [keys: ' + g._debug_keys.join(',') + ']' : '';
    if (statusEl) statusEl.textContent = 'Pulled: address, ' + (g.social_profiles||[]).length + ' social profiles, ' + (g.reviews||[]).length + ' reviews' + _dbgKeys;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-brand-google"></i> Re-pull from Google'; }
  } catch(e) {
    if (statusEl) statusEl.textContent = 'Error: ' + e.message.slice(0,60);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-brand-google"></i> Pull from Google Business Profile'; }
    console.error('pullGMB:', e);
  }
}

function renderRSchema(r) {
  let html = rTabActions('schema');
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">'
    + '<button class="btn btn-ghost" onclick="pullGMB()" id="gmb-pull-btn"><i class="ti ti-brand-google"></i> Pull from Google Business Profile</button>'
    + '<span id="gmb-pull-status" style="font-size:12px;color:var(--n2)"></span>'
    + '</div>';
  html += rSec('Business Info',
    rField('schema_business_type','Business Type', r.schema_business_type, 'select', {options:['LocalBusiness','Organization']}) +
    rField('schema_primary_category','Primary Category', r.schema_primary_category) +
    rField('schema_price_range','Price Range', r.schema_price_range, 'text') +
    rField('schema_payment_methods','Payment Methods (comma-separated)', r.schema_payment_methods, 'text-csv') +
    rField('schema_injection_method','Schema Injection Method', r.schema_injection_method, 'select', {options:['','Global header embed','Per-page embed','Tag Manager','Plugin/App','Dev will implement']}) +
    rField('schema_has_physical_locations','Has Physical Locations?', r.schema_has_physical_locations, 'boolean')
  );
  html += rSec('Primary Address',
    rField('schema_street_address','Street Address', r.schema_street_address, 'text', {span:true}) +
    rField('schema_city','City', r.schema_city) +
    rField('schema_region','Province / State', r.schema_region) +
    rField('schema_postal_code','Postal Code', r.schema_postal_code) +
    rField('schema_country','Country', r.schema_country) +
    rField('schema_phone','Phone Number', r.schema_phone)
  );
  html += rSec('Site Structure',
    rField('has_location_pages','Location Pages', r.has_location_pages, 'select', {options:['Yes','Planned','No']}) +
    rField('has_service_pages','Service Pages', r.has_service_pages, 'select', {options:['Yes','Planned','No']}) +
    rField('has_blog','Blog', r.has_blog, 'select', {options:['Yes','Planned','No']}) +
    rField('has_faq_section','FAQ Section', r.has_faq_section, 'select', {options:['Yes','Planned','No']})
  );
  html += rRepGroup('social_profiles','Social Profiles',
    [{key:'platform',label:'Platform',type:'select',options:['Google Business Profile','Facebook','Instagram','LinkedIn','YouTube','TikTok','X','Pinterest','Other']},{key:'url',label:'URL'}],
    '+ Add Social Profile'
  );
  html += rRepGroup('current_faqs','Current FAQs',
    [{key:'question',label:'Question'},{key:'answer',label:'Answer'}],
    '+ Add FAQ'
  );
  html += rRepGroup('reviews','Reviews',
    [{key:'author_name',label:'Author',width:'120px'},{key:'rating_value',label:'Rating',width:'60px'},{key:'review_body_short',label:'Excerpt'},{key:'source_url',label:'Source URL',width:'150px'}],
    '+ Add Review'
  );
  return html;
}

function renderRCompetitors(r) {
  let html = rTabActions('competitors');
  html += rRepGroup('competitors','Competitor Analysis',
    [{key:'name',label:'Competitor',width:'130px'},{key:'url',label:'URL',width:'160px'},{key:'why_they_win',label:'Strengths'},{key:'weaknesses',label:'Weaknesses'},{key:'what_we_do_better',label:'What We Do Better'}],
    '+ Add Competitor'
  );
  html += '<div id="research-kw-status" style="font-size:11px;color:var(--n2);margin-top:8px;display:flex;align-items:center;gap:6px"></div>';
  return html;
}

function renderRKeywords(el) {
  el.innerHTML = '<div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap">'
    + '<button class="btn btn-primary" onclick="fetchKeywordResearch()"><i class="ti ti-refresh"></i> Run Keyword Research</button>'
    + '<button class="btn btn-ghost" style="font-size:11px" onclick="runKwDebug()"><i class="ti ti-bug"></i> Debug DataForSEO</button>'
    + '</div>'
    + '<div id="research-kw-status" style="font-size:11px;color:var(--n2);margin-bottom:8px;display:flex;align-items:center;gap:6px"></div>'
    + '<div id="kw-debug-output" style="display:none;margin-bottom:10px;font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:10px;font-family:monospace;white-space:pre-wrap;max-height:300px;overflow-y:auto"></div>'
    + '<div id="research-kw-card" style="display:none"></div>';
  if (S.kwResearch) renderKwResearchCard();
}

// ── AI Enrichment ─────────────────────────────────────────────────

async function enrichOneTab(tab) {
  // Clear caches so re-enrich fetches fresh data
  _cachedWebsiteText = null;
  _cachedGMBData = null;
  _cachedBrandAssets = null;
  if (!S.research) S.research = researchDefaults();
  var _s = S.setup || {};
  if (_s.client && !S.research.client_name) S.research.client_name = _s.client;
  if (_s.client && !S.research.brand_name) S.research.brand_name = _s.client;
  var btn = document.getElementById('enrich-btn-'+tab);
  var statusEl = document.getElementById('enrich-status-'+tab);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;display:inline-block"></span> Enriching...'; }
  if (statusEl) statusEl.textContent = '';
  try {
    await enrichRTab(tab, true);
    _enrichDone.add(tab);
    renderResearchNav();
    if (statusEl) statusEl.textContent = 'Done';
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles"></i> Re-enrich'; btn.setAttribute('onclick',"enrichOneTab('"+tab+"')"); }
  } catch(e) {
    if (statusEl) statusEl.textContent = 'Error: ' + e.message.slice(0,60);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles"></i> Retry'; }
    console.error('enrichOneTab ['+tab+']:', e);
  }
}

async function enrichAll(forceAll, startFrom) {
  const steps = ['gmb','website','brand-assets','business','audience','client-pain','brand','schema','competitors'];
  const stepLabels = { gmb:'Google Business Profile', website:'Website Scrape', 'brand-assets':'Brand Assets', business:'Business', audience:'Audience', 'client-pain':'Client Pain', brand:'Brand', schema:'Schema & Local', competitors:'Competitors' };
  const btn = document.getElementById('research-enrich-btn');
  const statusEl = document.getElementById('research-enrich-status');
  const msgEl = document.getElementById('research-enrich-msg');
  const progEl = document.getElementById('research-enrich-progress');
  var _s = S.setup || {};
  if (_s.client && !S.research.client_name) S.research.client_name = _s.client;
  if (_s.client && !S.research.brand_name) S.research.brand_name = _s.client;
  if (!startFrom) _enrichDone.clear();
  window._aiStopAll = false;
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;display:inline-block"></span> Enriching...'; }
  if (statusEl) statusEl.style.display = 'flex';
  var start = startFrom || 0;
  for (let i = start; i < steps.length; i++) {
    if (window._aiStopAll) {
      window._aiStopResumeCtx = {
        label: 'Enrichment paused (' + i + '/' + steps.length + ' steps)',
        fn: function(args) { enrichAll(args.forceAll, args.startFrom); },
        args: { forceAll: forceAll, startFrom: i }
      };
      _enriching = false;
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles"></i> Re-enrich'; }
      return;
    }
    var step = steps[i];
    var label = stepLabels[step] || step;
    if (msgEl) msgEl.textContent = 'Fetching ' + label + '...';
    if (progEl) progEl.textContent = (i+1) + ' / ' + steps.length;

    // Step 0: Google Business Profile pull
    if (step === 'gmb') {
      try {
        _cachedGMBData = null; // reset cache so we get fresh data
        var gmbResult = await _autoGMB(true);
        if (gmbResult) {
          _enrichDone.add('gmb');
          if (msgEl) msgEl.textContent = 'Google Business Profile pulled ✓';
        } else {
          if (msgEl) msgEl.textContent = 'No Google Business Profile found — continuing';
        }
      } catch(e) {
        if (msgEl) msgEl.textContent = 'GMB pull skipped — ' + (e.message || '').slice(0,40);
      }
      await new Promise(function(res){ setTimeout(res, 800); });
      continue;
    }

    // Step 1: Website scrape (pre-fetch for all AI tabs)
    if (step === 'website') {
      try {
        _cachedWebsiteText = '';
        await _fetchWebsiteText();
        if (_cachedWebsiteText) {
          _enrichDone.add('website');
          if (msgEl) msgEl.textContent = 'Website content scraped ✓';
        } else {
          if (msgEl) msgEl.textContent = 'No website content found — continuing';
        }
      } catch(e) {
        if (msgEl) msgEl.textContent = 'Website scrape skipped — ' + (e.message || '').slice(0,40);
      }
      await new Promise(function(res){ setTimeout(res, 800); });
      continue;
    }

    // Step 2: Brand asset extraction (colours, fonts, logo from CSS/HTML)
    if (step === 'brand-assets') {
      try {
        _cachedBrandAssets = null;
        var brandResult = await _fetchBrandAssets(true);
        if (brandResult && (brandResult.colours.length || brandResult.fonts.length || brandResult.logo_url)) {
          _enrichDone.add('brand-assets');
          var _parts = [];
          if (brandResult.colours.length) _parts.push(brandResult.colours.length + ' colours');
          if (brandResult.fonts.length) _parts.push(brandResult.fonts.length + ' fonts');
          if (brandResult.logo_url) _parts.push('logo');
          if (msgEl) msgEl.textContent = 'Brand assets extracted: ' + _parts.join(', ') + ' ✓';
        } else {
          if (msgEl) msgEl.textContent = 'No brand assets detected — continuing';
        }
      } catch(e) {
        if (msgEl) msgEl.textContent = 'Brand asset extraction skipped — ' + (e.message || '').slice(0,40);
      }
      await new Promise(function(res){ setTimeout(res, 800); });
      continue;
    }

    // AI enrichment tabs
    _enriching = step;
    _rTab = step;
    if (msgEl) msgEl.textContent = 'Enriching ' + label + '...';
    renderResearchNav();
    renderResearchTabContent();
    try {
      await enrichRTab(step, forceAll);
    } catch(e) { if (e.name === 'AbortError') return; }
    _enrichDone.add(step);
    // Pause between AI tabs to avoid Anthropic rate limits
    if (i < steps.length - 1) await new Promise(function(res){ setTimeout(res, 2000); });
  }
  _enriching = false;
  S.research._updatedAt = Date.now();
  if (msgEl) msgEl.textContent = 'All sections enriched ✓';
  if (progEl) progEl.textContent = '';
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles"></i> Re-enrich'; btn.setAttribute('onclick','enrichAll(true)'); }
  renderResearchNav();
  // Switch back to business tab to show filled data
  _rTab = 'business';
  renderResearchNav();
  renderResearchTabContent();
  setTimeout(function(){
    if (statusEl) statusEl.style.display = 'none';
    if (btn) { btn.innerHTML = '<i class="ti ti-sparkles"></i> Enrich with AI'; btn.setAttribute('onclick','enrichAll()'); }
  }, 2500);
}

// Smart merge: only fill empty/null/empty-array fields unless forceAll=true
// For array-of-objects fields, appends new unique items instead of skipping
var _MERGE_APPEND_FIELDS = ['case_studies','reference_brands','services_detail','notable_clients','social_profiles','publications_media','current_customer_profile'];

function mergeEnriched(target, source, forceAll) {
  Object.keys(source).forEach(function(key) {
    if (key === 'geography') return;
    var existing = target[key];
    var incoming = source[key];
    if (incoming === null || incoming === undefined) return;

    // Never overwrite with empty — that just deletes existing data
    var incomingEmpty = false;
    if (typeof incoming === 'string' && !incoming.trim()) incomingEmpty = true;
    if (Array.isArray(incoming) && incoming.length === 0) incomingEmpty = true;

    if (incomingEmpty) return; // skip empty values regardless of forceAll

    if (!forceAll) {
      if (typeof existing === 'string' && existing.trim()) return;
      // For appendable array fields: merge new unique items into existing
      if (Array.isArray(existing) && existing.length > 0 && Array.isArray(incoming) && _MERGE_APPEND_FIELDS.indexOf(key) !== -1) {
        incoming.forEach(function(newItem) {
          // Deduplicate by first string value (name, client, url, platform, or the string itself)
          var newId = typeof newItem === 'string' ? newItem.toLowerCase() : (newItem.name || newItem.client || newItem.url || newItem.platform || JSON.stringify(newItem)).toLowerCase();
          var isDupe = existing.some(function(ex) {
            var exId = typeof ex === 'string' ? ex.toLowerCase() : (ex.name || ex.client || ex.url || ex.platform || JSON.stringify(ex)).toLowerCase();
            return exId === newId;
          });
          if (!isDupe) existing.push(newItem);
        });
        return;
      }
      if (Array.isArray(existing) && existing.length > 0) return;
      // booleans: always allow enrichment to set them (false = unfilled)
    }
    target[key] = incoming;
  });
}

function _repairJSON(raw) {
  var s = raw;
  // Strip control chars except newline/tab
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');
  // Fix unquoted keys
  s = s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
  // Fix single-quoted values (but not apostrophes inside words)
  s = s.replace(/:\s*'([^']*)'/g, ':"$1"');
  return s;
}

function parseEnrichResult(result) {
  var cleaned = result.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
  var parsed = null;
  // Attempt 1: direct parse
  try { parsed = JSON.parse(cleaned); } catch(e) {}
  if (parsed) return parsed;
  // Attempt 2: extract JSON block
  var si = cleaned.indexOf('{'), ei = cleaned.lastIndexOf('}');
  if (si >= 0 && ei > si) cleaned = cleaned.slice(si, ei+1);
  try { parsed = JSON.parse(cleaned); } catch(e) {}
  if (parsed) return parsed;
  // Attempt 3: repair then parse
  var repaired = _repairJSON(cleaned);
  try { parsed = JSON.parse(repaired); } catch(e) {}
  if (parsed) return parsed;
  // Attempt 4: aggressive — remove newlines inside strings
  try {
    var agg = repaired.replace(/\n/g, ' ');
    parsed = JSON.parse(agg);
  } catch(e) {}
  return parsed;
}

// Cache website text per session to avoid re-fetching on each tab
var _cachedWebsiteText = null;

async function _fetchWebsiteText() {
  if (_cachedWebsiteText !== null) return _cachedWebsiteText;
  var siteUrl = (S.setup && S.setup.url) || '';
  if (!siteUrl) { _cachedWebsiteText = ''; return ''; }
  // Normalise base URL
  var base = siteUrl.trim().replace(/\/+$/, '');
  if (!base.startsWith('http')) base = 'https://' + base;
  // Scrape homepage + key inner pages for richer data
  var innerPaths = ['/about', '/about-us', '/services', '/our-services', '/pricing', '/our-work', '/portfolio', '/team', '/our-team', '/contact'];
  var urls = [base];
  for (var i = 0; i < innerPaths.length; i++) urls.push(base + innerPaths[i]);
  try {
    var res = await fetch('/api/fetch-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: urls })
    });
    var data = await res.json();
    if (data.pages && data.pages.length > 0) {
      var parts = [];
      for (var j = 0; j < data.pages.length; j++) {
        var p = data.pages[j];
        if (p.text) parts.push('--- PAGE: ' + p.url + ' ---\n' + p.text);
      }
      _cachedWebsiteText = parts.join('\n\n');
    } else {
      _cachedWebsiteText = data.text || '';
    }
  } catch(e) {
    console.warn('Website fetch failed:', e.message);
    _cachedWebsiteText = '';
  }
  return _cachedWebsiteText;
}

// Cached GMB result for enrichment context
var _cachedGMBData = null;

async function _autoGMB(force) {
  var r = S.research || {};
  // Skip if we already have GMB data (address filled) and not forced
  if (!force && (r.schema_street_address || r.schema_city)) {
    // Still cache existing data for enrichment context
    if (!_cachedGMBData && r.schema_street_address) {
      _cachedGMBData = { address_parts: { address: r.schema_street_address, city: r.schema_city, region: r.schema_region, zip: r.schema_postal_code, country_code: r.schema_country }, category: r.schema_primary_category || '', price_level: r.schema_price_range || '' };
    }
    return _cachedGMBData;
  }
  var keyword = (S.setup && S.setup.client) || r.client_name || '';
  if (!keyword) return null;
  try {
    var res = await fetch('/api/gmb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: keyword + ' ' + ((S.setup && S.setup.geo) || '') })
    });
    var data = await res.json();
    if (!data.result) return null;
    var g = data.result;
    _cachedGMBData = g;
    if (!S.research) S.research = researchDefaults();
    var rd = S.research;
    // Schema fields (address, category, price)
    var ap = g.address_parts || {};
    if (ap.address) rd.schema_street_address = ap.address;
    if (ap.city || ap.borough) rd.schema_city = ap.city || ap.borough;
    if (ap.region) rd.schema_region = ap.region;
    if (ap.zip) rd.schema_postal_code = ap.zip;
    if (ap.country_code) rd.schema_country = ap.country_code;
    if (g.category && !rd.schema_primary_category) rd.schema_primary_category = g.category;
    if (g.price_level && !rd.schema_price_range) rd.schema_price_range = g.price_level;
    // Social profiles + reviews
    if (g.social_profiles && g.social_profiles.length > 0 && !rd.social_profiles.length) rd.social_profiles = g.social_profiles;
    if (g.reviews && g.reviews.length > 0 && !rd.reviews.length) rd.reviews = g.reviews;
    // Geography — fill primary from GMB address if empty
    if (!rd.geography) rd.geography = { primary: '', secondary: [] };
    if (!rd.geography.primary && (ap.city || ap.borough) && ap.region) {
      rd.geography.primary = (ap.city || ap.borough) + ', ' + ap.region;
    }
    // Phone number — store for schema
    if (g.phone && !rd.schema_phone) rd.schema_phone = g.phone;
    scheduleSave();
    return g;
  } catch(e) {
    console.warn('Auto GMB pull failed:', e.message);
    return null;
  }
}

// Build GMB context string for enrichment prompts
function _gmbCtx() {
  var g = _cachedGMBData;
  if (!g) return '';
  var parts = ['\nGOOGLE BUSINESS PROFILE DATA:'];
  if (g.title) parts.push('Business name: ' + g.title);
  if (g.category) parts.push('Category: ' + g.category);
  if (g.address) parts.push('Address: ' + g.address);
  if (g.phone) parts.push('Phone: ' + g.phone);
  if (g.website) parts.push('Website: ' + g.website);
  if (g.rating) parts.push('Rating: ' + g.rating + '/5 (' + (g.reviews_count || 0) + ' reviews)');
  if (g.price_level) parts.push('Price level: ' + g.price_level);
  if (g.work_hours && Object.keys(g.work_hours).length > 0) {
    var wh = [];
    for (var day in g.work_hours) { if (g.work_hours[day]) wh.push(day + ': ' + g.work_hours[day]); }
    if (wh.length) parts.push('Hours: ' + wh.join(', '));
  }
  if (g.social_profiles && g.social_profiles.length > 0) {
    parts.push('Social: ' + g.social_profiles.map(function(sp) { return sp.platform + ': ' + sp.url; }).join(', '));
  }
  if (g.reviews && g.reviews.length > 0) {
    parts.push('Sample reviews:');
    g.reviews.forEach(function(rv) {
      parts.push('  - ' + (rv.author_name || 'Anonymous') + ' (' + (rv.rating_value || '?') + '/5): "' + (rv.review_body_short || '').slice(0, 120) + '"');
    });
  }
  return parts.join('\n');
}

// Cached brand assets from website
var _cachedBrandAssets = null;

async function _fetchBrandAssets(force) {
  if (!force && _cachedBrandAssets) return _cachedBrandAssets;
  var siteUrl = (S.setup && S.setup.url) || '';
  if (!siteUrl) return null;
  try {
    var res = await fetch('/api/brand-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: siteUrl })
    });
    var data = await res.json();
    _cachedBrandAssets = data;
    if (!S.research) S.research = researchDefaults();
    var rd = S.research;
    // Fill brand colours if empty
    if (data.colours && data.colours.length > 0 && (!rd.brand_colours || !rd.brand_colours.length)) {
      rd.brand_colours = data.colours;
    }
    // Fill fonts if empty
    if (data.fonts && data.fonts.length > 0 && (!rd.fonts || !rd.fonts.length)) {
      rd.fonts = data.fonts;
    }
    // Fill logo URL if empty
    if (data.logo_url && !rd.logo_url) {
      rd.logo_url = data.logo_url;
    }
    scheduleSave();
    return data;
  } catch(e) {
    console.warn('Brand asset extraction failed:', e.message);
    return null;
  }
}

// Build brand assets context string for enrichment prompts
function _brandAssetsCtx() {
  var b = _cachedBrandAssets;
  if (!b) return '';
  var parts = ['\nBRAND ASSETS (extracted from website CSS/HTML):'];
  if (b.colours && b.colours.length) parts.push('Colours found: ' + b.colours.join(', '));
  if (b.fonts && b.fonts.length) parts.push('Fonts found: ' + b.fonts.join(', '));
  if (b.logo_url) parts.push('Logo URL: ' + b.logo_url);
  return parts.length > 1 ? parts.join('\n') : '';
}

async function enrichRTab(tab, forceAll) {
  if (!S.research) S.research = researchDefaults();
  var r = S.research;
  var s = S.setup || {};

  // Pre-fetch website content, GMB data, and brand assets if not already cached (enrichAll pre-fetches all)
  if (!_cachedWebsiteText) await _fetchWebsiteText();
  if (!_cachedGMBData) await _autoGMB();
  if (!_cachedBrandAssets) await _fetchBrandAssets();
  var websiteText = _cachedWebsiteText || '';

  var ctx = buildEnrichCtx();
  if (websiteText) ctx += '\n\nWEBSITE CONTENT (scraped from ' + (s.url || '') + ' and inner pages):\n' + websiteText.slice(0, 14000);
  // Inject Google Business Profile data into context
  ctx += _gmbCtx();
  // Inject brand assets (colours, fonts, logo) into context
  ctx += _brandAssetsCtx();

  // Cross-tab context: pass already-enriched fields so later tabs can build on them
  var crossCtx = '';
  if (r.business_overview) crossCtx += '\nBUSINESS: ' + r.business_overview;
  if (r.primary_services && r.primary_services.length) crossCtx += '\nSERVICES: ' + r.primary_services.join(', ');
  if (r.industry) crossCtx += '\nINDUSTRY: ' + r.industry;
  if (r.team_size) crossCtx += '\nTEAM SIZE: ' + r.team_size;
  if (r.primary_audience_description) crossCtx += '\nAUDIENCE: ' + r.primary_audience_description;
  if (r.primary_goal) crossCtx += '\nPRIMARY GOAL: ' + r.primary_goal;
  if (r.geography && r.geography.primary) crossCtx += '\nGEOGRAPHY: ' + r.geography.primary;
  if (crossCtx) ctx += '\n\nALREADY EXTRACTED (from other research tabs):' + crossCtx;

  var sys = 'You are a senior digital marketing strategist at Setsail Marketing. Extract REAL information from the provided documents and website content.\n'
    + 'CRITICAL RULES:\n'
    + '1. The WEBSITE CONTENT section contains live scraped data from the actual website — this is your PRIMARY source of truth for factual fields (services, team size, locations, contact info, about info).\n'
    + '2. If the website shows different information than the strategy doc, PREFER the website data — it is more current.\n'
    + '3. Extract ALL services listed on the website, not just the top 3. Check /services and /our-services pages carefully.\n'
    + '4. For team_size: check /team, /our-team, /about pages and COUNT the actual team members listed. If the website lists individual team members, count them.\n'
    + '5. Do NOT use placeholder text. If you cannot find information, use an empty string or empty array.\n'
    + '6. Return ONLY valid JSON — no preamble, no markdown fences, no backticks.';

  var b = '\n  ';
  var prompts = {
    business: ctx + '\n\nExtract and return a JSON object. Use actual values from the website and documents.\nRULES:\n- Include EVERY service from the /services page — do not summarise or skip any\n- For team_size: count every individual person named on /about or /team page\n- For pricing in services_detail: pull actual dollar amounts from the /pricing page\n- Prefer website data over strategy doc when they conflict\n- Do NOT include value_proposition, strategic_recommendations, or top_offers — those are handled in the Strategy stage\n{\n'
      + b + '"business_overview": "2-3 sentence factual description of what this business does",\n'
      + b + '"industry": "e.g. Healthcare, Construction, Legal Services",\n'
      + b + '"sub_industry": "specific niche within that industry",\n'
      + b + '"business_model": "one of: b2b b2c b2b2c marketplace saas nonprofit",\n'
      + b + '"years_in_business": "number as string or empty string if unknown",\n'
      + b + '"team_size": "COUNT every individual team member name found on /about or /team pages and return that number as a string — if 12 people are listed, return 12",\n'
      + b + '"current_pricing": "how pricing works — actual dollar amounts from website if available",\n'
      + b + '"pricing_model": "one of: quote_based fixed_menu subscription",\n'
      + b + '"locations_count": "number of physical locations as string, or empty string if unknown",\n'
      + b + '"capacity_constraints": "any limits on capacity, throughput, or availability — or empty string",\n'
      + b + '"seasonality_notes": "seasonal patterns in demand or revenue — or empty string",\n'
      + b + '"services_detail": [{"name": "service name from website", "description": "1-2 sentence description", "pricing": "pricing from /pricing page e.g. $1800 setup + $2400/mo, or empty string if not found", "target_audience": "who buys this service", "key_differentiator": "what makes this unique"}]\n}',

    audience: ctx + '\n\nExtract audience and sales process information. Return a JSON object with actual values.\nDo NOT include CTAs (primary_cta, secondary_cta, low_commitment_cta) — those are handled in the Strategy stage.\n{\n'
      + b + '"primary_audience_description": "2-3 sentence profile of who buys from this business",\n'
      + b + '"buyer_roles_titles": ["decision maker title 1", "decision maker title 2"],\n'
      + b + '"target_geography": "one of: local regional national international",\n'
      + b + '"best_customer_examples": "description of the ideal customer archetype",\n'
      + b + '"pain_points_top5": ["specific pain 1", "specific pain 2", "specific pain 3", "specific pain 4", "specific pain 5"],\n'
      + b + '"objections_top5": ["real objection 1", "real objection 2", "real objection 3", "real objection 4", "real objection 5"],\n'
      + b + '"lead_channels_today": ["current lead source 1", "current lead source 2"],\n'
      + b + '"sales_cycle_length": "one of: same_day 1_7_days 14_30_days 30_plus_days",\n'
      + b + '"close_rate_estimate": "percentage as string e.g. 30% or empty string if unknown",\n'
      + b + '"current_qualification": "what makes a lead qualified for this business",\n'
      + b + '"top_reasons_leads_dont_close": "main reasons deals fall through",\n'
      + b + '"booking_flow_description": "how a prospect becomes a client - steps in the intake process",\n'
      + b + '"primary_goal": "one of: leads sales bookings traffic awareness",\n'
      + b + '"secondary_goals": ["secondary goal 1", "secondary goal 2"],\n'
      + b + '"geography": {"primary": "City, Province", "secondary": ["secondary city 1"]},\n'
      + b + '"current_customer_profile": [{"persona": "persona label", "pain_points": ["pain 1"], "motivators": ["motivator 1"]}],\n'
      + b + '"monthly_marketing_budget": "extract from docs/transcript if mentioned, otherwise empty string — do NOT guess",\n'
      + b + '"average_deal_size": "extract from docs/transcript if mentioned, otherwise empty string — do NOT guess",\n'
      + b + '"customer_lifetime_value": "extract from docs/transcript if mentioned, otherwise empty string — do NOT guess",\n'
      + b + '"lead_quality_percentage": "extract from docs/transcript if mentioned, otherwise empty string — do NOT guess",\n'
      + b + '"current_lead_volume": "extract from docs/transcript if mentioned, otherwise empty string — do NOT guess",\n'
      + b + '"current_marketing_activities": ["extract any mentioned marketing channels — Google Ads, SEO, social media, referrals, etc. — or empty array if not found"],\n'
      + b + '"previous_agency_experience": "one of: Good experience | Bad experience | No agency | Multiple agencies | empty string if unknown"\n}',

    brand: ctx + '\nBusiness: ' + (S.setup && S.setup.client ? S.setup.client : '') + '\n\nReturn a JSON object.\nRULES:\n- For brand_colours: extract actual hex colour codes used on the website from the WEBSITE CONTENT and BRAND ASSETS sections. If brand assets data is available, use those colours.\n- For fonts: extract actual font names used on the website from the WEBSITE CONTENT and BRAND ASSETS sections. If brand assets data is available, use those fonts.\n- For case_studies: extract EVERY project, case study, or client showcase from /our-work, /portfolio, /case-studies, /projects pages. Even if no metrics are stated, still include the client name and describe the work done. Use "ongoing" for timeframe if not specified. NEVER return an empty array — if the website shows any client work at all, include it.\n- For notable_clients: list EVERY client or brand name mentioned anywhere on the website — check /our-work, /portfolio, /about, testimonials, logos sections.\n- For reference_brands: ONLY include brands the client explicitly mentioned as inspiration in discovery notes or uploaded documents. Do NOT guess or suggest random brands. Return [] if not mentioned.\n- Do NOT include brand_voice_style, tone_and_voice, words_to_use, words_to_avoid, or key_differentiators — those are handled in the Strategy stage.\n- Return ONLY valid JSON, no preamble.\n{\n'
      + b + '"brand_name": "' + ((S.setup && S.setup.client) || 'brand name') + '",\n'
      + b + '"current_slogan": "current tagline from docs or website. If none found, generate a short punchy tagline (under 8 words) based on the business name, services, differentiators and location",\n'
      + b + '"existing_proof": ["real cert/award/stat/number from docs or website, e.g. 273 Projects, 10+ Years, B Corp Certified"],\n'
      + b + '"brand_colours": ["hex from brand guide only, or []"],\n'
      + b + '"fonts": ["font from brand guide only, or []"],\n'
      + b + '"case_studies": [{"client": "client name from /our-work page", "result": "specific measurable outcome with numbers", "timeframe": "e.g. 90 days or ongoing"}],\n'
      + b + '"notable_clients": ["EVERY client name found on the website — check /our-work, /portfolio, /about, testimonials"],\n'
      + b + '"awards_certifications": ["real award or certification — check /about page for partnerships and certs"],\n'
      + b + '"team_credentials": "founder/team qualifications, years of experience, specialisations from /about page",\n'
      + b + '"founder_bio": "founder background and expertise from /about page",\n'
      + b + '"publications_media": ["media mention or publication from docs or website"],\n'
      + b + '"reference_brands": [{"url": "https://example.com", "what_you_like": "specific element the client admires — ONLY include if the client explicitly mentioned reference brands in discovery notes or uploaded documents. If not mentioned, return []"}]\n}',

    schema: ctx + '\n\nExtract structured data for Schema.org markup. Return a JSON object:\n{\n'
      + b + '"schema_business_type": "LocalBusiness or Organization",\n'
      + b + '"schema_primary_category": "Google Business Profile category e.g. Marketing agency",\n'
      + b + '"schema_price_range": "e.g. $$ or $$$ or empty string",\n'
      + b + '"schema_has_physical_locations": true or false,\n'
      + b + '"schema_street_address": "street address or empty string",\n'
      + b + '"schema_city": "city",\n'
      + b + '"schema_region": "province or state",\n'
      + b + '"schema_postal_code": "postal or zip",\n'
      + b + '"schema_country": "2-letter code e.g. CA",\n'
      + b + '"schema_payment_methods": ["Credit Card", "Invoice"],\n'
      + b + '"social_profiles": [{"platform": "Facebook", "url": "https://..."}],\n'
      + b + '"schema_services": [{"service_name": "actual service", "service_page_url": "/services/slug", "service_description_short": "one sentence"}],\n'
      + b + '"current_faqs": [{"question": "real customer question 1", "answer": "direct answer"}, {"question": "real customer question 2", "answer": "direct answer"}],\n'
      + b + '"has_location_pages": "Yes or Planned or No",\n'
      + b + '"has_service_pages": "Yes or Planned or No",\n'
      + b + '"has_blog": "Yes or Planned or No",\n'
      + b + '"has_faq_section": "Yes or Planned or No"\n}',

    competitors: 'Business: ' + (S.setup && S.setup.client ? S.setup.client : '') + '\n'
      + 'URL: ' + (S.setup && S.setup.url ? S.setup.url : '') + '\n'
      + 'Location: ' + (S.setup && S.setup.geo ? S.setup.geo : '') + '\n'
      + 'Industry: ' + (S.research && S.research.industry ? S.research.industry : 'unknown') + '\n'
      + 'Services: ' + (S.research && S.research.primary_services && S.research.primary_services.length ? S.research.primary_services.join(', ') : 'see strategy doc') + '\n'
      + (S.setup && S.setup.competitors ? 'Competitors named by client: ' + S.setup.competitors + '\n' : '')
      + '\n\nIdentify 5-8 REAL, verifiable competitors for this business. Sources in priority order:\n'
      + '1. Any competitors named by the client above.\n'
      + '2. Real domains from DataForSEO data (if any was prepended to this prompt).\n'
      + '3. Your own knowledge of real businesses competing in this industry and geography.\n'
      + 'You MUST return a full list. Never return an empty array. Use your training knowledge to fill gaps.\n'
      + 'ONLY include actual competing businesses (agencies, consultancies, service providers).\n'
      + 'EXCLUDE: review directories (Clutch, DesignRush, UpCity), SEO tools (Semrush, Ahrefs, Moz), '
      + 'job boards, news sites, social platforms, or any site that is not a direct service competitor.\n'
      + 'For each: actual business name, full URL with https://, 1-2 sentence specific competitive strength.\n'
      + 'Return ONLY valid JSON, no preamble.\n{\n'
      + b + '"competitors": [{"name": "Real Business Name", "url": "https://domain.com", "why_they_win": "specific strength", "weaknesses": "specific weakness or gap", "what_we_do_better": "how our client beats them"}]\n}'
  };

  // ── Client Pain extraction (dedicated step — separate from audience tab) ──
  if (tab === 'client-pain') {
    var cpCtx = ctx;
    // Inject already-extracted audience data for cross-reference
    if (r.pain_points_top5 && r.pain_points_top5.length) cpCtx += '\n\nAUDIENCE PAIN POINTS (already extracted): ' + r.pain_points_top5.join('; ');
    if (r.objections_top5 && r.objections_top5.length) cpCtx += '\nAUDIENCE OBJECTIONS: ' + r.objections_top5.join('; ');
    if (r.primary_audience_description) cpCtx += '\nAUDIENCE: ' + r.primary_audience_description;
    if (r.previous_agency_experience) cpCtx += '\nPREVIOUS AGENCY EXPERIENCE: ' + r.previous_agency_experience;
    if (r.current_marketing_activities && r.current_marketing_activities.length) cpCtx += '\nCURRENT MARKETING: ' + r.current_marketing_activities.join(', ');

    var cpSys = 'You are a senior business strategist at Setsail Marketing. Your job is to extract the CLIENT\'S OWN business problems — why they are seeking marketing help. This is about the CLIENT (the business that hired Setsail), NOT their end customers.\n'
      + 'Use the client\'s actual language. "I need better jobs, not more leads" not "Client desires higher lead quality."\n'
      + 'If something was not explicitly stated, leave the field empty. Do not infer.\n'
      + 'Return ONLY valid JSON — no preamble, no markdown fences, no backticks.';

    var cpPrompt = cpCtx + '\n\nFrom the discovery notes, uploaded documents, and any other context provided, extract the CLIENT\'S OWN business problems.\n'
      + 'Focus on: Why did they reach out? What is broken? What did they try before? What does success look like?\n\n'
      + 'Return a JSON object:\n{\n'
      + '  "primary": "The single biggest reason they hired Setsail. Use their words. e.g. Unpredictable lead flow — 90% referral dependent",\n'
      + '  "secondary": ["Other problems mentioned, up to 5. Each in their words."],\n'
      + '  "consequence": "What happens if nothing changes. Leave empty string if not stated.",\n'
      + '  "urgencyTrigger": "Why NOW — what changed or what deadline. Leave empty string if not stated.",\n'
      + '  "priorAttempts": [{"what": "what they tried", "outcome": "what happened", "spend": "how much e.g. $2,000/mo", "duration": "how long e.g. 6 months"}],\n'
      + '  "successDefinition": "How they defined success, in their words.",\n'
      + '  "clientQuotes": ["3-5 direct quotes that vividly capture their frustration, fear, or aspiration. Emotionally resonant sentences."],\n'
      + '  "customerVoiceQuotes": ["Any time the client describes what their CUSTOMERS say, think, worry about, or do. Tag these separately — they feed the Strategy stage."],\n'
      + '  "source": "discovery_notes or fathom_transcript or intake_form or manual"\n}';

    try {
      window._aiBarLabel = 'Research: Client Pain';
      var cpResult = await callClaude(cpSys, cpPrompt, null, 4000);
      var cpParsed = parseEnrichResult(cpResult);
      if (cpParsed) {
        if (!r.clientPain) r.clientPain = {};
        // Merge — only fill empty fields unless forceAll
        if (forceAll || !r.clientPain.primary) r.clientPain.primary = cpParsed.primary || '';
        if (forceAll || !r.clientPain.secondary || !r.clientPain.secondary.length) r.clientPain.secondary = cpParsed.secondary || [];
        if (forceAll || !r.clientPain.consequence) r.clientPain.consequence = cpParsed.consequence || '';
        if (forceAll || !r.clientPain.urgencyTrigger) r.clientPain.urgencyTrigger = cpParsed.urgencyTrigger || '';
        if (forceAll || !r.clientPain.priorAttempts || !r.clientPain.priorAttempts.length) r.clientPain.priorAttempts = cpParsed.priorAttempts || [];
        if (forceAll || !r.clientPain.successDefinition) r.clientPain.successDefinition = cpParsed.successDefinition || '';
        if (forceAll || !r.clientPain.clientQuotes || !r.clientPain.clientQuotes.length) r.clientPain.clientQuotes = cpParsed.clientQuotes || [];
        r.clientPain.source = cpParsed.source || 'discovery_notes';
        r.clientPain._extractedAt = Date.now();
        // Stash customerVoiceQuotes for Strategy enrichment
        if (cpParsed.customerVoiceQuotes && cpParsed.customerVoiceQuotes.length) {
          r.clientPain._customerVoiceQuotes = cpParsed.customerVoiceQuotes;
        }
        scheduleSave();
        _rTab = 'business'; // stay on current tab
        renderResearchTabContent();
        scheduleScorecard();
      }
    } catch(e) {
      var _emsgCP = document.getElementById('research-enrich-msg');
      if (_emsgCP) _emsgCP.textContent = 'Client Pain extraction failed: ' + (e.message || '').slice(0, 60);
      console.error('enrichRTab [client-pain]:', e);
    }
    return;
  }

  if (!prompts[tab]) return;

  // For competitors tab: pre-fetch organic competitors from DataForSEO, inject into prompt
  if (tab === 'competitors' && S.setup && S.setup.url) {
    try {
      var _compRes = await fetch('/api/organic-competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: S.setup.url })
      });
      var _compData = await _compRes.json();
      if (_compData.competitors && _compData.competitors.length > 0) {
        var _compLines = _compData.competitors.map(function(c) {
          return c.domain + ' (shared keywords: ' + c.intersections + ', est. traffic: ' + c.etv + ')';
        }).join('\n');
        prompts['competitors'] = '\nDataForSEO Organic Competitors (real domains ranked for overlapping keywords):\n'
          + _compLines + '\n\n' + prompts['competitors']
          + '\n\nIMPORTANT: The DataForSEO list above contains REAL competitor domains with verified organic search overlap. '
          + 'Use these domains as your primary source. For each, infer the business name from the domain, find their real URL, '
          + 'and describe their specific SEO/market strength based on the industry context.';
      }
    } catch(e) {
      console.warn('organic-competitors fetch failed, falling back to inference:', e.message);
    }
  }

  try {
    var activeSys = tab === 'competitors'
      ? 'You are a competitive intelligence expert with deep knowledge of businesses across all industries. '
      + 'Use both the provided context AND your own training knowledge to identify real competitors. '
      + 'You MUST return a populated competitors array. Never return an empty array. '
      + 'Return ONLY valid JSON, no preamble, no markdown fences, no backticks.'
      : sys;
    // Brand tab needs more tokens for case studies, clients, credentials
    var tabTokens = (tab === 'brand' || tab === 'business') ? 8000 : 6000;
    var result;
    try {
      window._aiBarLabel = 'Research: ' + tab;
      result = await callClaude(activeSys, prompts[tab], null, tabTokens);
    } catch(rateErr) {
      if (rateErr.message && rateErr.message.toLowerCase().indexOf('rate') !== -1) {
        var _retryEl = document.getElementById('research-enrich-msg');
        if (_retryEl) _retryEl.textContent = 'Rate limit on ' + tab + ' - retrying in 8s...';
        await new Promise(function(res){ setTimeout(res, 8000); });
        result = await callClaude(activeSys, prompts[tab], null, tabTokens);
      } else { throw rateErr; }
    }
    console.error('ENRICH RAW ['+tab+']:', result.slice(0,600));
    var parsed = parseEnrichResult(result);
    console.error('ENRICH PARSED ['+tab+']:', JSON.stringify(parsed));
    if (parsed) {
      // Competitors: direct write, skip mergeEnriched entirely
      if (tab === 'competitors') {
        if (parsed.competitors && Array.isArray(parsed.competitors) && parsed.competitors.length > 0) {
          r.competitors = parsed.competitors;
          console.error('COMPETITORS WRITTEN:', r.competitors.length, 'items', JSON.stringify(r.competitors[0]));
        } else {
          console.error('COMPETITORS EMPTY IN PARSED:', JSON.stringify(parsed));
        }
        scheduleSave();
        _rTab = 'competitors';
        renderResearchTabContent();
        scheduleScorecard();
        return;
      }
      if (parsed.geography) {
        if (!r.geography) r.geography = {};
        if (forceAll || !r.geography.primary) r.geography.primary = parsed.geography.primary || r.geography.primary;
        if (forceAll || !(r.geography.secondary && r.geography.secondary.length)) {
          r.geography.secondary = parsed.geography.secondary || r.geography.secondary;
        }
        delete parsed.geography;
      }
      mergeEnriched(r, parsed, forceAll);
      // Auto-derive primary_services from services_detail (keeps downstream consumers in sync)
      if (r.services_detail && r.services_detail.length > 0) {
        r.primary_services = r.services_detail.map(function(sd) { return sd.name; });
      }
      scheduleSave();
      _rTab = tab;  // ensure we re-render the tab that was just enriched
      renderResearchTabContent();
      scheduleScorecard();
    } else {
      console.error('ENRICH PARSE FAILED ['+tab+']: raw:', result.slice(0,500));
      var _statusFail = document.getElementById('enrich-status-'+tab);
      if (_statusFail) _statusFail.textContent = 'Parse failed - check console';
      var _emsg2 = document.getElementById('research-enrich-msg');
      if (_emsg2) _emsg2.textContent = '\u26a0 ' + tab + ': could not parse AI response \u2014 check console';
    }
  } catch(e) {
    var _emsg = document.getElementById('research-enrich-msg');
    if (_emsg) _emsg.textContent = 'Error on ' + tab + ': ' + e.message;
    console.error('enrichRTab ['+tab+']:', e);
  }
}


async function runResearch() {
  await enrichAll();
  fetchKeywordResearch();
}

// Shim for backward compat with saved state load + old call sites
function renderResearchResults(r) {
  if (r) S.research = r;
  if (!S.research) S.research = researchDefaults();
  initResearch();
}

function saveResearchEdits() { /* deprecated — fields save on change */ }

function attemptResearchParse() { /* deprecated */ }

// ── KEYWORD RESEARCH (DataForSEO — runs after Research stage) ──────