// ── Competitor Blocklist ──────────────────────────────────────────
// Domains that should never appear as competitors. Checked post-AI.
var _COMPETITOR_BLOCKLIST = [
  // Marketplaces & mega-retailers
  'amazon.com','amazon.ca','amazon.co.uk','amazon.com.au','ebay.com','ebay.ca','ebay.co.uk',
  'walmart.com','walmart.ca','target.com','costco.com','costco.ca','bestbuy.com','bestbuy.ca',
  'homedepot.com','homedepot.ca','lowes.com','lowes.ca','canadiantire.ca',
  'etsy.com','alibaba.com','aliexpress.com','wish.com','temu.com','shein.com',
  'wayfair.com','wayfair.ca','overstock.com','ikea.com','ikea.ca',
  // Review / directory sites
  'clutch.co','designrush.com','upcity.com','expertise.com','goodfirms.co','g2.com',
  'capterra.com','trustpilot.com','yelp.com','yelp.ca','bbb.org','yellowpages.com','yellowpages.ca',
  'bark.com','sortlist.com','thumbtack.com','angi.com','angieslist.com','homeadvisor.com',
  'houzz.com','tripadvisor.com','tripadvisor.ca','healthgrades.com','zocdoc.com','avvo.com',
  // SEO / marketing tools
  'semrush.com','ahrefs.com','moz.com','hubspot.com','mailchimp.com',
  'wordstream.com','searchengineland.com','searchenginejournal.com',
  'neilpatel.com','backlinko.com','sproutsocial.com','hootsuite.com',
  // Website builders / platforms
  'wix.com','squarespace.com','godaddy.com','shopify.com','webflow.com','wordpress.com','wordpress.org',
  // Social platforms
  'facebook.com','instagram.com','linkedin.com','twitter.com','x.com',
  'tiktok.com','pinterest.com','youtube.com','reddit.com','quora.com','medium.com',
  // News / reference
  'wikipedia.org','forbes.com','bbc.com','cnn.com','nytimes.com','globalnews.ca','cbc.ca',
  // Job boards
  'indeed.com','indeed.ca','glassdoor.com','glassdoor.ca','ziprecruiter.com',
  // Tech giants
  'google.com','apple.com','microsoft.com','oracle.com','salesforce.com',
  // Government
  'canada.ca','gc.ca','usa.gov'
];

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
  // Client-provided benchmark actuals
  known_landing_page_cvr: { tab:'audience', label:'Known Landing Page CVR', importance:'optional', source:'manual' },
  known_cpl:              { tab:'audience', label:'Known Cost Per Lead',    importance:'optional', source:'manual' },
  known_close_rate:       { tab:'audience', label:'Known Close Rate (CRM)', importance:'optional', source:'manual' },
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
  reviews:                   { tab:'brand',       label:'Reviews',                  importance:'normal',   source:'ai' },
  testimonials:              { tab:'brand',       label:'Testimonials',             importance:'normal',   source:'ai' },
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
  _sanitiseResearchArrays(S.research);
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
    // Client-provided benchmark actuals
    known_landing_page_cvr:'', known_cpl:'', known_close_rate:'',
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
    reviews:[], testimonials:[],
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
    current_faqs:[],
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

function _sanitiseResearchArrays(r) {
  // Clean undefined/null values from repeat-group array items
  var repeatKeys = ['case_studies','testimonials','reviews','notable_clients','social_profiles','publications_media','reference_brands','services_detail','current_customer_profile','competitors'];
  repeatKeys.forEach(function(key) {
    if (Array.isArray(r[key])) {
      r[key] = r[key].filter(function(item) {
        return item && typeof item === 'object';
      }).map(function(item) {
        var clean = {};
        Object.keys(item).forEach(function(k) {
          clean[k] = (item[k] === undefined || item[k] === null) ? '' : item[k];
        });
        return clean;
      });
    }
  });
  // Also clean string fields that might be literal "undefined"
  Object.keys(r).forEach(function(k) {
    if (r[k] === 'undefined' || r[k] === 'null') r[k] = '';
  });
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
    case 'competitors': el.innerHTML = renderRCompetitors(r); _wireEnrichNewCompetitors(); break;
    default: el.innerHTML = '';
  }
}

function _wireEnrichNewCompetitors() {
  var btn = document.getElementById('enrich-new-competitors-btn');
  if (!btn) return;
  btn.onclick = async function() {
    var r = S.research || researchDefaults();
    var incomplete = (r.competitors || []).filter(function(c) { return c.name && c.name.trim() && (!c.url || !c.why_they_win); });
    if (!incomplete.length) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Enriching...';
    var statusEl = document.getElementById('enrich-comp-status');
    try {
      var clientName = (S.setup && S.setup.client) || '';
      var clientUrl = (S.setup && S.setup.url) || '';
      var geo = (S.setup && S.setup.geo) || '';
      var industry = r.industry || '';
      var services = (r.primary_services || []).join(', ');
      var prompt = 'Business: ' + clientName + '\nURL: ' + clientUrl + '\nLocation: ' + geo + '\nIndustry: ' + industry + '\nServices: ' + services
        + '\n\nI have these competitor names that need enrichment. For EACH one, find their real website URL, specific competitive strengths, weaknesses, and what our client does better.\n\n'
        + 'COMPETITORS TO ENRICH:\n' + incomplete.map(function(c) { return '- ' + c.name + (c.url ? ' (' + c.url + ')' : ''); }).join('\n')
        + '\n\nReturn ONLY a JSON array: [{"name":"...","url":"https://...","why_they_win":"specific strength","weaknesses":"specific weakness","what_we_do_better":"how client beats them"}]';
      var result = '';
      await callClaude('You are a competitive intelligence analyst. Return only valid JSON array.', prompt, function(chunk) { result = chunk; }, 2048, 'comp-enrich');
      var parsed = null;
      try { parsed = JSON.parse(result.replace(/```json\n?|```\n?/g, '').trim()); } catch(e) {
        var m = result.match(/\[[\s\S]*\]/);
        if (m) try { parsed = JSON.parse(m[0]); } catch(e2) {}
      }
      if (Array.isArray(parsed)) {
        var updated = 0;
        parsed.forEach(function(item) {
          var existing = r.competitors.find(function(c) { return c.name && item.name && c.name.toLowerCase().trim() === item.name.toLowerCase().trim(); });
          if (existing) {
            if (!existing.url && item.url) existing.url = item.url;
            if (!existing.why_they_win && item.why_they_win) existing.why_they_win = item.why_they_win;
            if (!existing.weaknesses && item.weaknesses) existing.weaknesses = item.weaknesses;
            if (!existing.what_we_do_better && item.what_we_do_better) existing.what_we_do_better = item.what_we_do_better;
            updated++;
          }
        });
        scheduleSave();
        renderResearchTabContent();
        if (typeof aiBarNotify === 'function') aiBarNotify('Enriched ' + updated + ' competitor' + (updated !== 1 ? 's' : ''), { duration: 3000 });
      } else {
        if (statusEl) statusEl.textContent = 'Could not parse AI response';
      }
    } catch(e) {
      if (statusEl) statusEl.textContent = 'Error: ' + e.message;
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-sparkles"></i> Retry';
    }
  };
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

// Expand JTBD row into a modal for easier editing
function expandJTBDRow(forceType, idx) {
  var item = (_getJTBDForces(forceType))[idx];
  if (!item) return;
  var labels = { push_forces:'Push Force', pull_forces:'Pull Force', anxieties:'Anxiety', habits:'Habit' };
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:600;display:flex;align-items:center;justify-content:center';
  var card = document.createElement('div');
  card.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px;width:520px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.25)';
  card.innerHTML = '<div style="font-size:13px;font-weight:600;color:var(--dark);margin-bottom:14px">' + esc(labels[forceType] || forceType) + ' #' + (idx + 1) + '</div>'
    + '<label style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);display:block;margin-bottom:4px">Force / Behaviour</label>'
    + '<textarea id="_jtbd-force" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px 10px;font-size:13px;font-family:var(--font);color:var(--dark);resize:vertical;box-sizing:border-box">' + esc(item.force || '') + '</textarea>'
    + '<label style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);display:block;margin:12px 0 4px">Supporting Quote</label>'
    + '<textarea id="_jtbd-quote" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px 10px;font-size:13px;font-family:var(--font);color:var(--dark);resize:vertical;font-style:italic;box-sizing:border-box">' + esc(item.quote || '') + '</textarea>'
    + '<div style="display:flex;align-items:center;gap:12px;margin-top:12px">'
    + '<label style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2)">Intensity</label>'
    + '<select id="_jtbd-int" style="width:60px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 4px;font-size:12px;font-family:var(--font);color:var(--dark)">'
    + [1,2,3,4,5].map(function(s) { return '<option value="'+s+'"'+((item.intensity||3)===s?' selected':'')+'>'+s+'</option>'; }).join('')
    + '</select><div style="flex:1"></div>'
    + '<button id="_jtbd-save" class="btn btn-primary" style="font-size:12px;padding:6px 16px">Save</button>'
    + '<button id="_jtbd-cancel" class="btn btn-ghost" style="font-size:12px;padding:6px 12px">Cancel</button>'
    + '</div>';
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  var forceEl = document.getElementById('_jtbd-force');
  forceEl.focus();
  function close() { document.body.removeChild(overlay); }
  function save() {
    setRFJTBD(forceType, idx, 'force', forceEl.value);
    setRFJTBD(forceType, idx, 'quote', document.getElementById('_jtbd-quote').value);
    setRFJTBD(forceType, idx, 'intensity', parseInt(document.getElementById('_jtbd-int').value));
    close();
    renderResearchTabContent();
  }
  document.getElementById('_jtbd-save').onclick = save;
  document.getElementById('_jtbd-cancel').onclick = close;
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });
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

// Expand criterion row into a modal
function expandCriterionRow(idx) {
  var items = (S.research && S.research.decision_criteria) || [];
  var item = items[idx];
  if (!item) return;
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:600;display:flex;align-items:center;justify-content:center';
  var card = document.createElement('div');
  card.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px;width:480px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.25)';
  card.innerHTML = '<div style="font-size:13px;font-weight:600;color:var(--dark);margin-bottom:14px">Decision Criterion #' + (idx + 1) + '</div>'
    + '<label style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);display:block;margin-bottom:4px">Criterion</label>'
    + '<textarea id="_dc-crit" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px 10px;font-size:13px;font-family:var(--font);color:var(--dark);resize:vertical;box-sizing:border-box">' + esc(item.criterion || '') + '</textarea>'
    + '<div style="display:flex;align-items:center;gap:12px;margin-top:12px">'
    + '<label style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--n2)">Priority</label>'
    + '<select id="_dc-pri" style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px;font-family:var(--font);color:var(--dark)">'
    + '<option value="must-have"' + ((item.priority || 'must-have') === 'must-have' ? ' selected' : '') + '>Must-have</option>'
    + '<option value="nice-to-have"' + (item.priority === 'nice-to-have' ? ' selected' : '') + '>Nice-to-have</option>'
    + '</select><div style="flex:1"></div>'
    + '<button id="_dc-save" class="btn btn-primary" style="font-size:12px;padding:6px 16px">Save</button>'
    + '<button id="_dc-cancel" class="btn btn-ghost" style="font-size:12px;padding:6px 12px">Cancel</button>'
    + '</div>';
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  document.getElementById('_dc-crit').focus();
  function close() { document.body.removeChild(overlay); }
  function save() {
    setRFCriterion(idx, 'criterion', document.getElementById('_dc-crit').value);
    setRFCriterion(idx, 'priority', document.getElementById('_dc-pri').value);
    close();
    renderResearchTabContent();
  }
  document.getElementById('_dc-save').onclick = save;
  document.getElementById('_dc-cancel').onclick = close;
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });
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
    html += '<input type="text" value="' + esc(item.force || '') + '" title="' + esc(item.force || '') + '" placeholder="e.g. Manual data entry across 6 systems" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px;font-family:var(--font);color:var(--dark)" onchange="setRFJTBD(\'' + forceType + '\',' + i + ',\'force\',this.value);this.title=this.value">';
    html += '<input type="text" value="' + esc(item.quote || '') + '" title="' + esc(item.quote || '') + '" placeholder="Verbatim quote..." style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px;font-family:var(--font);color:var(--dark);font-style:italic" onchange="setRFJTBD(\'' + forceType + '\',' + i + ',\'quote\',this.value);this.title=this.value">';
    html += '<select style="width:60px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 4px;font-size:12px;font-family:var(--font);color:var(--dark);text-align:center" onchange="setRFJTBD(\'' + forceType + '\',' + i + ',\'intensity\',parseInt(this.value))">';
    for (var s = 1; s <= 5; s++) html += '<option value="' + s + '"' + ((item.intensity || 3) === s ? ' selected' : '') + '>' + s + '</option>';
    html += '</select>';
    html += '<button onclick="expandJTBDRow(\'' + forceType + '\',' + i + ')" style="border:none;background:none;color:var(--n2);cursor:pointer;padding:2px 4px;font-size:14px;line-height:1;flex-shrink:0" title="Expand"><i class="ti ti-arrows-maximize" style="font-size:13px"></i></button>';
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
    html += '<input type="text" value="' + esc(item.criterion || '') + '" title="' + esc(item.criterion || '') + '" placeholder="e.g. Must integrate with PropertyWare" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px;font-family:var(--font);color:var(--dark)" onchange="setRFCriterion(' + i + ',\'criterion\',this.value);this.title=this.value">';
    html += '<select style="width:110px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:5px 4px;font-size:12px;font-family:var(--font);color:var(--dark)" onchange="setRFCriterion(' + i + ',\'priority\',this.value)">';
    html += '<option value="must-have"' + ((item.priority || 'must-have') === 'must-have' ? ' selected' : '') + '>Must-have</option>';
    html += '<option value="nice-to-have"' + (item.priority === 'nice-to-have' ? ' selected' : '') + '>Nice-to-have</option>';
    html += '</select>';
    html += '<button onclick="expandCriterionRow(' + i + ')" style="border:none;background:none;color:var(--n2);cursor:pointer;padding:2px 4px;font-size:14px;line-height:1;flex-shrink:0" title="Expand"><i class="ti ti-arrows-maximize" style="font-size:13px"></i></button>';
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
    await callClaude('You are a buyer psychology analyst. Return only valid JSON.', prompt, function(chunk) { resp = chunk; }, 4000, 'Buyer Psychology');
    var clean = resp.replace(/```json\s*/gi, '').replace(/```\s*/g, '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
    // Extract JSON object boundaries if Claude added prose around it
    var jsonStart = clean.indexOf('{'), jsonEnd = clean.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);
    // Robust JSON repair: fix newlines + unescaped quotes inside strings
    var inStr = false, escaped = false, repaired = '';
    for (var ci = 0; ci < clean.length; ci++) {
      var ch = clean[ci];
      if (escaped) { repaired += ch; escaped = false; continue; }
      if (ch === '\\') { repaired += ch; escaped = true; continue; }
      if (ch === '"') {
        if (!inStr) { inStr = true; repaired += ch; continue; }
        var la = '';
        for (var lk = ci + 1; lk < clean.length && lk < ci + 20; lk++) {
          var lc = clean[lk];
          if (lc !== ' ' && lc !== '\t' && lc !== '\n' && lc !== '\r') { la = lc; break; }
        }
        if (la === ',' || la === ']' || la === '}' || la === ':') {
          inStr = false; repaired += ch; continue;
        }
        repaired += '\\"'; continue;
      }
      if (inStr && (ch === '\n' || ch === '\r')) { repaired += ' '; continue; }
      repaired += ch;
    }
    // Apply structural fixes ONLY outside string values
    var parts = [], inStr2 = false, esc2 = false, seg = '';
    for (var ci2 = 0; ci2 < repaired.length; ci2++) {
      var ch2 = repaired[ci2];
      if (esc2) { seg += ch2; esc2 = false; continue; }
      if (ch2 === '\\' && inStr2) { seg += ch2; esc2 = true; continue; }
      if (ch2 === '"') {
        if (inStr2) { seg += ch2; parts.push(seg); seg = ''; inStr2 = false; }
        else { if (seg) parts.push(seg); seg = '"'; inStr2 = true; }
        continue;
      }
      seg += ch2;
    }
    if (seg) parts.push(seg);
    repaired = parts.map(function(p, idx) {
      if (p.charAt(0) === '"') return p; // string literal — don't touch
      return p
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*)'/g, ': "$1"')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/:\s*True\b/g, ': true').replace(/:\s*False\b/g, ': false').replace(/:\s*None\b/g, ': null');
    }).join('');
    var parsed;
    try { parsed = JSON.parse(repaired); } catch(pe2) {
      console.error('Buyer psych JSON repair failed:', pe2.message, repaired.slice(0, 300));
      throw pe2;
    }

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

// ── Data Source Banner ─────────────────────────────────────────────

var _SOURCE_MAP_RESEARCH = {
  business:    ['website','gmb','documents','discovery','structured','gsc','ga4'],
  audience:    ['website','documents','discovery','gsc','ga4'],
  brand:       ['website','brand_assets','structured','gmb'],
  schema:      ['website','gmb','structured'],
  competitors: ['website','gsc']
};

function _renderSourceBanner(tabName) {
  var sources = _SOURCE_MAP_RESEARCH[tabName] || [];
  if (!sources.length) return '';
  var badges = '';
  sources.forEach(function(src) {
    var label = '';
    var value = '';
    var has = false;
    switch (src) {
      case 'website':
        label = 'Website Scrape';
        // Check cache first, then check if research has fields that indicate a scrape ran
        if (_cachedWebsiteText) {
          var wc = _cachedWebsiteText.split(/\s+/).length;
          value = wc.toLocaleString() + ' words';
          has = true;
        } else {
          var r = S.research || {};
          // If services_detail or team_size were populated, website was likely scraped
          var hadScrape = (r.services_detail && r.services_detail.length > 0) || (r.team_size && r.team_size !== '') || (r._websiteScraped);
          if (hadScrape) { value = 'Previously scraped'; has = true; }
          else { value = 'Not yet run'; }
        }
        break;
      case 'gmb':
        label = 'Google Business';
        var g = _cachedGMBData;
        if (g && (g.title || g.address_parts)) { value = 'Found'; has = true; }
        else {
          // Check if research has GMB-sourced fields
          var rg = S.research || {};
          if (rg.schema_phone || rg.schema_street_address || rg.schema_city) { value = 'Previously pulled'; has = true; }
          else { value = 'Not found'; }
        }
        break;
      case 'documents':
        label = 'Documents';
        var docs = (S.setup && S.setup.docs) ? S.setup.docs : [];
        if (docs.length) { value = docs.length + ' doc' + (docs.length > 1 ? 's' : ''); has = true; }
        else { value = '0'; }
        break;
      case 'discovery':
        label = 'Discovery Notes';
        var dn = (S.setup && S.setup.discoveryNotes) ? S.setup.discoveryNotes.trim() : '';
        if (dn) { value = 'Provided'; has = true; }
        else { value = 'Empty'; }
        break;
      case 'brand_assets':
        label = 'Brand Assets';
        if (_cachedBrandAssets) { value = 'Extracted'; has = true; }
        else {
          var rb = S.research || {};
          if ((rb.brand_colours && rb.brand_colours.length > 3) || (rb.brand_fonts && rb.brand_fonts.length > 3)) { value = 'Previously extracted'; has = true; }
          else { value = 'Not found'; }
        }
        break;
      case 'structured':
        label = 'Structured Scrape';
        if (_cachedStructuredScrape) {
          var parts = [];
          if (_cachedStructuredScrape.social_profiles) parts.push(_cachedStructuredScrape.social_profiles.length + ' social');
          if (_cachedStructuredScrape.faqs) parts.push(_cachedStructuredScrape.faqs.length + ' FAQs');
          if (_cachedStructuredScrape.reviews) parts.push(_cachedStructuredScrape.reviews.length + ' reviews');
          value = parts.length ? parts.join(', ') : 'Found';
          has = true;
        } else {
          // Check if research has fields from structured scrape
          var rs = S.research || {};
          var sp = [];
          if (rs.social_profiles && rs.social_profiles.length) sp.push(rs.social_profiles.length + ' social');
          if (rs.current_faqs && rs.current_faqs.length) sp.push(rs.current_faqs.length + ' FAQs');
          if (rs.reviews && rs.reviews.length) sp.push(rs.reviews.length + ' reviews');
          if (sp.length) { value = sp.join(', '); has = true; }
          else { value = 'No data'; }
        }
        break;
      case 'gsc':
        label = 'GSC Data';
        if (S.snapshot && S.snapshot.gsc && S.snapshot.gsc.queries) {
          var qc = Array.isArray(S.snapshot.gsc.queries) ? S.snapshot.gsc.queries.length : 0;
          value = qc + ' queries';
          has = qc > 0;
        } else { value = '0'; }
        break;
      case 'ga4':
        label = 'GA4 Data';
        var ga4t = S.snapshot && S.snapshot.ga4 && S.snapshot.ga4.totals;
        if (ga4t && ga4t.sessions > 0) {
          value = ga4t.sessions.toLocaleString() + ' sessions';
          has = true;
        } else if (S.snapshot && S.snapshot.ga4 && S.snapshot.ga4.pageMetrics && S.snapshot.ga4.pageMetrics.length) {
          value = S.snapshot.ga4.pageMetrics.length + ' pages';
          has = true;
        } else { value = '0'; }
        break;
    }
    var bg = has ? '#dcfce7' : '#fef3c7';
    var colour = has ? '#166534' : '#92400e';
    // Map source to refresh function
    var refreshFn = {
      website: '_refreshSourceWebsite()',
      gmb: '_refreshSourceGMB()',
      brand_assets: '_refreshSourceBrandAssets()',
      structured: '_refreshSourceStructured()',
      gsc: '_refreshSourceGSC()',
      ga4: '_refreshSourceGA4()'
    }[src] || '';
    var refreshBtn = refreshFn ? '<i class="ti ti-refresh" style="font-size:10px;cursor:pointer;opacity:0.6" onclick="event.stopPropagation();' + refreshFn + '" title="Re-pull this source"></i>' : '';
    badges += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:4px;font-size:10px;margin-right:4px;margin-bottom:4px;background:' + bg + ';color:' + colour + '">'
      + '<span style="font-weight:600">' + label + '</span> ' + value + ' ' + refreshBtn + '</span>';
  });
  return '<div style="padding:8px 12px;background:var(--panel);border-radius:8px;margin-bottom:12px;display:flex;flex-wrap:wrap;align-items:center;gap:4px">'
    + '<span style="font-size:10px;color:var(--n2);margin-right:4px;font-weight:500">SOURCES:</span>'
    + badges + '</div>';
}

// ── Source Refresh Functions ──────────────────────────────────────
async function _refreshSourceWebsite() {
  aiBarStart('Re-scraping website');
  try {
    _cachedWebsiteText = null;
    await _fetchWebsiteText();
    if (_cachedWebsiteText) {
      if (!S.research) S.research = researchDefaults();
      S.research._websiteScraped = true;
      scheduleSave();
      aiBarNotify('Website re-scraped: ' + _cachedWebsiteText.split(/\s+/).length + ' words', { duration: 3000 });
    } else {
      aiBarNotify('No website content found', { duration: 3000 });
    }
  } catch(e) { aiBarNotify('Website scrape failed: ' + e.message, { isError: true, duration: 4000 }); }
  aiBarEnd();
  renderResearchTabContent();
}

async function _refreshSourceGMB() {
  aiBarStart('Pulling Google Business Profile');
  try {
    _cachedGMBData = null;
    await _autoGMB();
    if (_cachedGMBData) {
      aiBarNotify('Google Business Profile updated', { duration: 3000 });
      scheduleSave();
    } else {
      aiBarNotify('No Google Business Profile found', { duration: 3000 });
    }
  } catch(e) { aiBarNotify('GMB pull failed: ' + e.message, { isError: true, duration: 4000 }); }
  aiBarEnd();
  renderResearchTabContent();
}

async function _refreshSourceBrandAssets() {
  aiBarStart('Extracting brand assets');
  try {
    _cachedBrandAssets = null;
    await _fetchBrandAssets();
    if (_cachedBrandAssets) {
      aiBarNotify('Brand assets extracted', { duration: 3000 });
    } else {
      aiBarNotify('No brand assets found', { duration: 3000 });
    }
  } catch(e) { aiBarNotify('Brand assets extraction failed: ' + e.message, { isError: true, duration: 4000 }); }
  aiBarEnd();
  renderResearchTabContent();
}

async function _refreshSourceStructured() {
  aiBarStart('Running structured scrape');
  try {
    _cachedStructuredScrape = null;
    var result = await _fetchStructuredScrape(true);
    if (result) {
      var parts = [];
      if (result.social_profiles && result.social_profiles.length) parts.push(result.social_profiles.length + ' social profiles');
      if (result.faqs && result.faqs.length) parts.push(result.faqs.length + ' FAQs');
      if (result.reviews && result.reviews.length) parts.push(result.reviews.length + ' reviews');
      aiBarNotify('Structured scrape: ' + (parts.length ? parts.join(', ') : 'no data found'), { duration: 3000 });
      scheduleSave();
    } else {
      aiBarNotify('No structured data found', { duration: 3000 });
    }
  } catch(e) { aiBarNotify('Structured scrape failed: ' + e.message, { isError: true, duration: 4000 }); }
  aiBarEnd();
  renderResearchTabContent();
}

async function _refreshSourceGSC() {
  if (!S.setup || !S.setup.gscSiteUrl) { aiBarNotify('Connect GSC in Setup first', { duration: 3000 }); return; }
  aiBarStart('Re-pulling GSC data');
  try {
    if (typeof _pullGSCData === 'function') await _pullGSCData();
    else if (typeof refreshGSCData === 'function') await refreshGSCData();
    else {
      // Inline pull
      var now = new Date();
      var end = now.toISOString().slice(0, 10);
      var start = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
      var qRes = await fetch('/api/gsc-performance', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ siteUrl: S.setup.gscSiteUrl, dimensions: ['query'], startDate: start, endDate: end, rowLimit: 500 }) });
      if (qRes.ok) {
        var qData = await qRes.json();
        if (!S.snapshot) S.snapshot = {};
        if (!S.snapshot.gsc) S.snapshot.gsc = {};
        S.snapshot.gsc.queries = (qData.rows || []).map(function(r) { return { query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }; });
        S.snapshot.gsc._pulledAt = new Date().toISOString();
        scheduleSave();
      }
    }
    var qc = S.snapshot && S.snapshot.gsc && S.snapshot.gsc.queries ? S.snapshot.gsc.queries.length : 0;
    aiBarNotify('GSC refreshed: ' + qc + ' queries', { duration: 3000 });
  } catch(e) { aiBarNotify('GSC refresh failed: ' + e.message, { isError: true, duration: 4000 }); }
  aiBarEnd();
  renderResearchTabContent();
}

async function _refreshSourceGA4() {
  if (!S.setup || !S.setup.ga4PropertyId) { aiBarNotify('Connect GA4 in Setup first', { duration: 3000 }); return; }
  aiBarStart('Re-pulling GA4 data');
  try {
    if (typeof _pullGA4Data === 'function') await _pullGA4Data();
    else if (typeof refreshGA4Data === 'function') await refreshGA4Data();
    var sc = S.snapshot && S.snapshot.ga4 && S.snapshot.ga4.totals ? S.snapshot.ga4.totals.sessions : 0;
    aiBarNotify('GA4 refreshed: ' + sc + ' sessions', { duration: 3000 });
  } catch(e) { aiBarNotify('GA4 refresh failed: ' + e.message, { isError: true, duration: 4000 }); }
  aiBarEnd();
  renderResearchTabContent();
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
  let html = renderCurrentPerformance();
  html += rTabActions('business');
  html += _renderSourceBanner('business');
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

function _closeRateBenchmarkHint(r) {
  if (r.close_rate_estimate && String(r.close_rate_estimate).trim()) {
    return '<div style="grid-column:1/-1;font-size:10px;color:var(--green);padding:2px 0"><i class="ti ti-check" style="font-size:10px"></i> Close rate provided by client or AI</div>';
  }
  if (r.known_close_rate && String(r.known_close_rate).trim()) {
    return '<div style="grid-column:1/-1;font-size:10px;color:var(--green);padding:2px 0"><i class="ti ti-check" style="font-size:10px"></i> CRM close rate provided: ' + esc(r.known_close_rate) + '</div>';
  }
  // Show benchmark hint when empty
  var industry = r.industry || '';
  return '<div style="grid-column:1/-1;font-size:10px;color:#e6a23c;padding:2px 0"><i class="ti ti-info-circle" style="font-size:10px"></i> No close rate provided — Strategy will use industry benchmarks' + (industry ? ' for ' + esc(industry) : '') + '. Provide for higher confidence.</div>';
}

function renderRAudience(r) {
  let html = rTabActions('audience');
  html += _renderSourceBanner('audience');
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
    _closeRateBenchmarkHint(r) +
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
  html += rSec('Known Metrics (Client-Provided)',
    rField('known_landing_page_cvr','Known Landing Page CVR (e.g. 4.2%)', r.known_landing_page_cvr) +
    rField('known_cpl','Known Cost Per Lead (e.g. $45)', r.known_cpl) +
    rField('known_close_rate','Known Close Rate from CRM (e.g. 28%)', r.known_close_rate)
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
  html += _renderSourceBanner('brand');
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
  var _eeatEmpty = function(field, label) {
    var val = r[field];
    var empty = Array.isArray(val) ? !val.length : (!val || !String(val).trim());
    if (!empty) return '';
    return '<div style="grid-column:1/-1;font-size:10px;color:var(--n2);padding:2px 0;font-style:italic"><i class="ti ti-search" style="font-size:10px"></i> No ' + label + ' found on site. Add manually below if available.</div>';
  };
  html += rSec('Proof & E-E-A-T',
    rField('team_credentials','Team Credentials / Expertise', r.team_credentials, 'textarea', {rows:3}) +
    rField('founder_bio','Founder Bio', r.founder_bio, 'textarea', {rows:3}) +
    rField('awards_certifications','Awards & Certifications (one per line)', r.awards_certifications, 'textarea-array', {rows:4}) +
    _eeatEmpty('awards_certifications', 'awards or certifications') +
    rField('notable_clients','Notable Clients (one per line)', r.notable_clients, 'textarea-array', {rows:4}) +
    rField('publications_media','Publications & Media Mentions (one per line)', r.publications_media, 'textarea-array', {rows:3}) +
    _eeatEmpty('publications_media', 'publications or media mentions')
  );
  // VoC source indicator
  var _vocSources = [];
  var _vocRaw = r.voc_swipe_raw || '';
  if (_vocRaw.indexOf('--- FROM CALL TRANSCRIPTS ---') !== -1) {
    var _txLines = _vocRaw.substring(_vocRaw.indexOf('--- FROM CALL TRANSCRIPTS ---')).split('\n').filter(function(l) { return l.trim() && l.indexOf('---') !== 0; });
    if (_txLines.length) _vocSources.push(_txLines.length + ' from transcripts');
  }
  var _vocManual = _vocRaw.indexOf('--- FROM CALL TRANSCRIPTS ---') !== -1 ? _vocRaw.substring(0, _vocRaw.indexOf('--- FROM CALL TRANSCRIPTS ---')).trim() : _vocRaw.trim();
  if (_vocManual) {
    var _manLines = _vocManual.split('\n').filter(function(l) { return l.trim(); });
    if (_manLines.length) _vocSources.push(_manLines.length + ' manual');
  }
  if (S.strategy && S.strategy._enrichment && S.strategy._enrichment.voc_swipe_file && S.strategy._enrichment.voc_swipe_file.length) {
    _vocSources.push(S.strategy._enrichment.voc_swipe_file.length + ' from documents');
  }
  var _vocBadge = _vocSources.length ? '<div style="font-size:10px;color:var(--green);margin-bottom:6px"><i class="ti ti-quote" style="font-size:10px"></i> VoC sources: ' + _vocSources.join(', ') + '</div>' : '<div style="font-size:10px;color:var(--n2);margin-bottom:6px;font-style:italic"><i class="ti ti-info-circle" style="font-size:10px"></i> No VoC data yet. Paste quotes below, upload transcripts in Setup, or run enrichment.</div>';
  html += rSec('Voice of Customer',
    '<div style="grid-column:1/-1">' + _vocBadge + '</div>' +
    rField('voc_swipe_raw','Voice of Customer \u2014 Swipe File', r.voc_swipe_raw || '', 'textarea', {rows:5, placeholder:'Paste real customer quotes, review excerpts, or sales call transcripts \u2014 one per line\ne.g. "I just need someone who picks up the phone"\n"We wasted $30k on the last agency and got nothing"'})
  );
  html += rRepGroup('case_studies','Case Studies',
    [{key:'client',label:'Client',width:'140px'},{key:'result',label:'Result / Outcome'},{key:'timeframe',label:'Timeframe',width:'100px'},{key:'url',label:'URL / Source',width:'150px'}],
    '+ Add Case Study'
  );
  if (!r.case_studies || !r.case_studies.length) {
    html += '<div style="font-size:10px;color:var(--n2);margin:-6px 0 10px 0;font-style:italic;padding-left:4px"><i class="ti ti-search" style="font-size:10px"></i> No case studies found on site. Add manually or run "Scrape Website" in Schema tab.</div>';
  }
  html += rSec('Social Proof');
  html += rRepGroup('testimonials','Testimonials',
    [{key:'quote',label:'Quote'},{key:'author',label:'Author',width:'120px'},{key:'title',label:'Title / Company',width:'140px'},{key:'source',label:'Source',width:'100px'}],
    '+ Add Testimonial'
  );
  if (!r.testimonials || !r.testimonials.length) {
    html += '<div style="font-size:10px;color:var(--n2);margin:-6px 0 10px 0;font-style:italic;padding-left:4px"><i class="ti ti-search" style="font-size:10px"></i> No testimonials found. Add manually or check if site has a /testimonials page.</div>';
  }
  html += rRepGroup('reviews','Reviews',
    [{key:'author_name',label:'Author',width:'120px'},{key:'rating_value',label:'Rating',width:'60px'},{key:'review_body_short',label:'Excerpt'},{key:'source_url',label:'Source',width:'120px'}],
    '+ Add Review'
  );
  if (!r.reviews || !r.reviews.length) {
    html += '<div style="font-size:10px;color:var(--n2);margin:-6px 0 10px 0;font-style:italic;padding-left:4px"><i class="ti ti-search" style="font-size:10px"></i> No reviews found. Pull from Google Business Profile in Schema tab or add manually.</div>';
  }
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
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#e6a23c">' + esc(data.error || 'No listing found') + '</span>'
          + '<span style="margin-left:8px;font-size:11px;color:var(--n2)">Try a different name:</span>'
          + ' <input id="gmb-manual-name" type="text" placeholder="Business name + city" style="padding:3px 8px;border:1px solid var(--border);border-radius:4px;font-size:11px;width:200px">'
          + ' <button id="gmb-manual-retry-btn" class="btn btn-ghost sm" style="font-size:11px;padding:2px 8px">Retry</button>';
        var _retryBtn = document.getElementById('gmb-manual-retry-btn');
        if (_retryBtn) {
          _retryBtn.onclick = async function() {
            var inp = document.getElementById('gmb-manual-name');
            var q = inp ? inp.value.trim() : '';
            if (!q) return;
            statusEl.textContent = 'Searching...';
            try {
              var res2 = await fetch('/api/gmb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: q }) });
              var data2 = await res2.json();
              if (data2.result) {
                _cachedGMBData = data2.result;
                var g2 = data2.result;
                if (!S.research) S.research = researchDefaults();
                var rd2 = S.research;
                var ap2 = g2.address_parts || {};
                if (ap2.address) rd2.schema_street_address = ap2.address;
                if (ap2.city || ap2.borough) rd2.schema_city = ap2.city || ap2.borough;
                if (ap2.region) rd2.schema_region = ap2.region;
                if (ap2.zip) rd2.schema_postal_code = ap2.zip;
                if (g2.category && !rd2.schema_primary_category) rd2.schema_primary_category = g2.category;
                if (g2.phone && !rd2.schema_phone) rd2.schema_phone = g2.phone;
                if (g2.social_profiles && g2.social_profiles.length) rd2.social_profiles = g2.social_profiles;
                if (g2.reviews && g2.reviews.length) rd2.reviews = g2.reviews;
                scheduleSave();
                _rTab = 'schema';
                renderResearchTabContent();
                statusEl.innerHTML = '<span style="color:var(--green)">Found: ' + esc(g2.title || q) + '</span>';
              } else {
                statusEl.innerHTML = '<span style="color:#f56c6c">Still not found for "' + esc(q) + '"</span>';
              }
            } catch(e2) { statusEl.textContent = 'Error: ' + (e2.message || '').slice(0,40); }
          };
        }
      }
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

async function scrapeWebsiteStructured() {
  var btn = document.getElementById('scrape-website-btn');
  var statusEl = document.getElementById('scrape-website-status');
  if (!S.setup || !S.setup.url) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">No website URL set in Setup</span>';
    return;
  }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;display:inline-block"></span> Scraping...'; }
  if (statusEl) statusEl.textContent = '';
  try {
    var result = await _fetchStructuredScrape(true);
    if (result) {
      var parts = [];
      if (result.social_profiles && result.social_profiles.length) parts.push(result.social_profiles.length + ' social profiles');
      if (result.faqs && result.faqs.length) parts.push(result.faqs.length + ' FAQs');
      if (result.reviews && result.reviews.length) parts.push(result.reviews.length + ' reviews');
      if (result.blog_posts && result.blog_posts.length) parts.push(result.blog_posts.length + ' blog posts');
      if (result.case_studies && result.case_studies.length) parts.push(result.case_studies.length + ' case studies');
      if (result.team_members && result.team_members.length) parts.push(result.team_members.length + ' team members');
      if (result.services && result.services.length) parts.push(result.services.length + ' services');
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)">' + (parts.length ? 'Found: ' + parts.join(', ') : 'No structured data found') + '</span>';
      renderResearch();
    } else {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--n2)">No data found</span>';
    }
  } catch(e) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--error)">Error: ' + (e.message || '').slice(0,60) + '</span>';
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-world-search"></i> Scrape Website'; }
}

function renderRSchema(r) {
  let html = rTabActions('schema');
  html += _renderSourceBanner('schema');
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">'
    + '<button class="btn btn-ghost" onclick="pullGMB()" id="gmb-pull-btn"><i class="ti ti-brand-google"></i> Pull from Google Business Profile</button>'
    + '<span id="gmb-pull-status" style="font-size:12px;color:var(--n2)"></span>'
    + '<button class="btn btn-ghost" onclick="scrapeWebsiteStructured()" id="scrape-website-btn"><i class="ti ti-world-search"></i> Scrape Website</button>'
    + '<span id="scrape-website-status" style="font-size:12px;color:var(--n2)"></span>'
    + '</div>';
  // Show detected schema types from Snapshot stage
  if (S.snapshot && S.snapshot.schemas && S.snapshot.schemas.length) {
    html += '<div class="card" style="margin-bottom:10px;border-left:3px solid var(--green)">';
    html += '<div class="eyebrow" style="margin-bottom:8px">Detected Schema Markup <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:var(--green-bg,#10b98115);color:var(--green);margin-left:6px">FROM SNAPSHOT</span></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    S.snapshot.schemas.forEach(function(s) {
      var schemaName = typeof s === 'string' ? s : (s.type || s.name || JSON.stringify(s));
      html += '<span style="font-size:11px;padding:3px 8px;background:var(--panel);border-radius:4px;color:var(--dark)">' + esc(schemaName) + '</span>';
    });
    html += '</div></div>';
  } else if (S.snapshot && S.snapshot.techStack && S.snapshot.techStack.length) {
    // Check if any tech was categorised as "Structured Data"
    var _schTech = S.snapshot.techStack.filter(function(t) { return t.category === 'Structured Data'; });
    if (_schTech.length) {
      html += '<div class="card" style="margin-bottom:10px;border-left:3px solid var(--green)">';
      html += '<div class="eyebrow" style="margin-bottom:8px">Detected Structured Data <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:var(--green-bg,#10b98115);color:var(--green);margin-left:6px">FROM SNAPSHOT</span></div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      _schTech.forEach(function(t) {
        html += '<span style="font-size:11px;padding:3px 8px;background:var(--panel);border-radius:4px;color:var(--dark)">' + esc(t.name) + '</span>';
      });
      html += '</div></div>';
    }
  }
  // Also show JSON-LD types from structured scrape if available
  if (_cachedStructuredScrape && _cachedStructuredScrape.json_ld_types && _cachedStructuredScrape.json_ld_types.length) {
    html += '<div class="card" style="margin-bottom:10px;border-left:3px solid #6366f1">';
    html += '<div class="eyebrow" style="margin-bottom:8px">JSON-LD Types Found <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:#6366f115;color:#6366f1;margin-left:6px">FROM SCRAPE</span></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    _cachedStructuredScrape.json_ld_types.forEach(function(t) {
      html += '<span style="font-size:11px;padding:3px 8px;background:#f5f3ff;border-radius:4px;color:#6366f1">' + esc(t) + '</span>';
    });
    html += '</div></div>';
  }
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
  return html;
}

function renderRCompetitors(r) {
  let html = rTabActions('competitors');
  html += _renderSourceBanner('competitors');
  html += rRepGroup('competitors','Competitor Analysis',
    [{key:'name',label:'Competitor',width:'120px'},{key:'url',label:'URL',width:'140px'},{key:'type',label:'Type',width:'70px',type:'select',options:['direct','indirect']},{key:'why_they_win',label:'Strengths'},{key:'weaknesses',label:'Weaknesses'},{key:'what_we_do_better',label:'What We Do Better'}],
    '+ Add Competitor'
  );
  // Check for incomplete entries (name exists but URL or strengths missing)
  var _incomplete = (r.competitors || []).filter(function(c) { return c.name && c.name.trim() && (!c.url || !c.why_they_win); });
  if (_incomplete.length > 0) {
    html += '<div style="margin-top:8px"><button class="btn btn-primary sm" id="enrich-new-competitors-btn" style="font-size:11px"><i class="ti ti-sparkles"></i> Enrich ' + _incomplete.length + ' New Competitor' + (_incomplete.length !== 1 ? 's' : '') + '</button> <span id="enrich-comp-status" style="font-size:11px;color:var(--n2)"></span></div>';
  }
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
  const steps = ['gmb','website','brand-assets','structured-scrape','business','audience','client-pain','brand','schema','competitors'];
  const stepLabels = { gmb:'Google Business Profile', website:'Website Scrape', 'brand-assets':'Brand Assets', 'structured-scrape':'Structured Data Scrape', business:'Business', audience:'Audience', 'client-pain':'Client Pain', brand:'Brand', schema:'Schema & Local', competitors:'Competitors' };
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
          if (!S.research) S.research = researchDefaults();
          S.research._websiteScraped = true;
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

    // Step 3: Structured website scrape (social links, FAQs, reviews, blog, team, services)
    if (step === 'structured-scrape') {
      try {
        _cachedStructuredScrape = null;
        var scrapeResult = await _fetchStructuredScrape(true);
        if (scrapeResult) {
          _enrichDone.add('structured-scrape');
          var _sp = [];
          if (scrapeResult.social_profiles && scrapeResult.social_profiles.length) _sp.push(scrapeResult.social_profiles.length + ' social profiles');
          if (scrapeResult.faqs && scrapeResult.faqs.length) _sp.push(scrapeResult.faqs.length + ' FAQs');
          if (scrapeResult.reviews && scrapeResult.reviews.length) _sp.push(scrapeResult.reviews.length + ' reviews');
          if (scrapeResult.testimonials && scrapeResult.testimonials.length) _sp.push(scrapeResult.testimonials.length + ' testimonials');
          if (scrapeResult.blog_posts && scrapeResult.blog_posts.length) _sp.push(scrapeResult.blog_posts.length + ' blog posts');
          if (scrapeResult.case_studies && scrapeResult.case_studies.length) _sp.push(scrapeResult.case_studies.length + ' case studies');
          if (scrapeResult.team_members && scrapeResult.team_members.length) _sp.push(scrapeResult.team_members.length + ' team members');
          if (scrapeResult.services && scrapeResult.services.length) _sp.push(scrapeResult.services.length + ' services');
          if (msgEl) msgEl.textContent = 'Structured scrape: ' + (_sp.length ? _sp.join(', ') : 'no structured data found') + ' \u2713';
        } else {
          if (msgEl) msgEl.textContent = 'Structured scrape — no data found, continuing';
        }
      } catch(e) {
        if (msgEl) msgEl.textContent = 'Structured scrape skipped — ' + (e.message || '').slice(0,40);
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

    // After audience tab: sync transcript pain points to research if still empty
    if (step === 'audience' && !window._aiStopAll) {
      var _r = S.research || {};
      if ((!_r.pain_points_top5 || !_r.pain_points_top5.length) && S.setup && S.setup.transcripts) {
        var _txPains = [];
        S.setup.transcripts.forEach(function(t) {
          if (t.extracted && t.extracted.pain_points) {
            t.extracted.pain_points.forEach(function(p) { if (p && _txPains.indexOf(p) === -1) _txPains.push(p); });
          }
        });
        if (_txPains.length) {
          _r.pain_points_top5 = _txPains.slice(0, 5);
          scheduleSave();
        }
      }
    }

    // After client-pain tab: auto-generate missing buyer psychology fields (JTBD Force Map)
    if (step === 'client-pain' && !window._aiStopAll) {
      if (msgEl) msgEl.textContent = 'Generating buyer psychology...';
      try {
        await generateMissingBuyerPsych();
      } catch(e) { console.warn('[enrichAll] buyer psych generation skipped:', (e.message || '').slice(0, 60)); }
      await new Promise(function(res){ setTimeout(res, 1500); });
    }

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

// Cached structured scrape result for enrichment context
var _cachedStructuredScrape = null;

async function _fetchStructuredScrape(force) {
  if (_cachedStructuredScrape && !force) return _cachedStructuredScrape;
  var siteUrl = (S.setup && S.setup.url) || '';
  if (!siteUrl) { _cachedStructuredScrape = null; return null; }
  try {
    var res = await fetch('/api/scrape-structured', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: siteUrl })
    });
    if (!res.ok) { console.warn('[structured-scrape] HTTP', res.status); return null; }
    var data = await res.json();
    _cachedStructuredScrape = data;
    // Auto-populate research fields from deterministic scrape
    if (!S.research) S.research = researchDefaults();
    var r = S.research;
    // Social profiles — merge, deduplicate by platform
    if (data.social_profiles && data.social_profiles.length) {
      if (!r.social_profiles || !r.social_profiles.length) {
        r.social_profiles = data.social_profiles.map(function(sp) { return { platform: sp.platform, url: sp.url }; });
      } else {
        var existing = new Set(r.social_profiles.map(function(sp) { return sp.platform; }));
        data.social_profiles.forEach(function(sp) {
          if (!existing.has(sp.platform)) r.social_profiles.push({ platform: sp.platform, url: sp.url });
        });
      }
    }
    // FAQs
    if (data.faqs && data.faqs.length && (!r.current_faqs || !r.current_faqs.length)) {
      r.current_faqs = data.faqs.map(function(f) { return { question: f.question, answer: f.answer }; });
    }
    // Reviews
    if (data.reviews && data.reviews.length && (!r.reviews || !r.reviews.length)) {
      r.reviews = data.reviews.map(function(rv) { return { author_name: rv.author_name || '', rating_value: rv.rating_value || '', review_body_short: rv.review_body_short || '' }; });
    }
    // Blog
    if (data.has_blog && (!r.has_blog || r.has_blog === 'No')) {
      r.has_blog = 'Yes';
    }
    // FAQ section
    if (data.has_faq_section && (!r.has_faq_section || r.has_faq_section === 'No')) {
      r.has_faq_section = 'Yes';
    }
    // Case studies
    if (data.case_studies && data.case_studies.length && (!r.case_studies || !r.case_studies.length)) {
      r.case_studies = data.case_studies.map(function(cs) { return { client: cs.client, result: cs.result || '', url: cs.url || '' }; });
    }
    // Services — populate schema_services (match AI enrichment field names)
    if (data.services && data.services.length && (!r.schema_services || !r.schema_services.length)) {
      r.schema_services = data.services.map(function(s) { return { service_name: s.name, service_page_url: s.url || '', service_description_short: '' }; });
    }
    // Team credentials
    if (data.team_members && data.team_members.length && !r.team_credentials) {
      r.team_credentials = data.team_members.map(function(t) { return t.name + (t.title ? ' — ' + t.title : ''); }).join(', ');
    }
    // Testimonials from scraper
    if (data.testimonials && data.testimonials.length && (!r.testimonials || !r.testimonials.length)) {
      r.testimonials = data.testimonials.map(function(t) { return { quote: t.quote || '', author: t.author || '', title: t.title || '', source: t.source || '' }; });
    }
    // Schema business data — auto-populate research fields
    if (data.schema_data && data.schema_data.business) {
      var biz = data.schema_data.business;
      if (biz.phone && !r.schema_phone) r.schema_phone = biz.phone;
      if (biz.email && !r.schema_email) r.schema_email = biz.email;
      if (biz.priceRange && !r.schema_price_range) r.schema_price_range = biz.priceRange;
      if (biz.type && !r.schema_business_type) r.schema_business_type = biz.type;
      if (biz.description && !r.business_description) r.business_description = biz.description;
      if (biz.foundingDate && !r.founding_year) r.founding_year = biz.foundingDate;
      if (biz.areaServed && !r.geography) r.geography = { primary: biz.areaServed, secondary: [] };
      if (biz.address) {
        if (biz.address.street && !r.schema_street_address) r.schema_street_address = biz.address.street;
        if (biz.address.city && !r.schema_city) r.schema_city = biz.address.city;
        if (biz.address.region && !r.schema_region) r.schema_region = biz.address.region;
        if (biz.address.postal && !r.schema_postal_code) r.schema_postal_code = biz.address.postal;
        if (biz.address.country && !r.schema_country) r.schema_country = biz.address.country;
      }
    }
    // Products from schema — useful for ecommerce/product businesses
    if (data.schema_data && data.schema_data.products && data.schema_data.products.length > 0) {
      if (!r._schema_products) r._schema_products = [];
      r._schema_products = data.schema_data.products;
    }
    scheduleSave();
    return data;
  } catch(e) {
    console.warn('[structured-scrape] failed:', e.message);
    _cachedStructuredScrape = null;
    return null;
  }
}

function _structuredScrapeCtx() {
  var d = _cachedStructuredScrape;
  if (!d) return '';
  var parts = ['\nSTRUCTURED WEBSITE DATA (deterministic scrape):'];
  if (d.social_profiles && d.social_profiles.length) {
    parts.push('Social Profiles: ' + d.social_profiles.map(function(sp) { return sp.platform + ': ' + sp.url; }).join(', '));
  }
  if (d.faqs && d.faqs.length) {
    parts.push('FAQs found: ' + d.faqs.length);
    d.faqs.slice(0, 5).forEach(function(f) { parts.push('  Q: ' + f.question); });
  }
  if (d.reviews && d.reviews.length) {
    parts.push('Reviews found: ' + d.reviews.length);
    if (d.aggregate_rating) parts.push('  Aggregate rating: ' + d.aggregate_rating.value + '/5 (' + d.aggregate_rating.count + ' reviews)');
    d.reviews.slice(0, 3).forEach(function(rv) { parts.push('  - ' + (rv.author_name || 'Anonymous') + ': "' + (rv.review_body_short || '').slice(0, 100) + '"'); });
  }
  if (d.testimonials && d.testimonials.length) {
    parts.push('Testimonials found: ' + d.testimonials.length);
    d.testimonials.slice(0, 3).forEach(function(t) { parts.push('  - "' + (t.quote || '').slice(0, 100) + '"' + (t.author ? ' — ' + t.author : '')); });
  }
  if (d.blog_posts && d.blog_posts.length) {
    parts.push('Blog posts found: ' + d.blog_posts.length);
    d.blog_posts.slice(0, 3).forEach(function(bp) { parts.push('  - ' + bp.title); });
  }
  if (d.case_studies && d.case_studies.length) {
    parts.push('Case studies/portfolio: ' + d.case_studies.length);
    d.case_studies.slice(0, 3).forEach(function(cs) { parts.push('  - ' + cs.client); });
  }
  if (d.team_members && d.team_members.length) {
    parts.push('Team members found: ' + d.team_members.length);
    d.team_members.slice(0, 5).forEach(function(t) { parts.push('  - ' + t.name + (t.title ? ' (' + t.title + ')' : '')); });
  }
  if (d.services && d.services.length) {
    parts.push('Services listed: ' + d.services.map(function(s) { return s.name; }).join(', '));
  }
  if (d.json_ld_types && d.json_ld_types.length) {
    parts.push('JSON-LD types: ' + d.json_ld_types.join(', '));
  }
  // Schema.org structured data (high-confidence, machine-readable)
  if (d.schema_data) {
    var sd = d.schema_data;
    if (sd.business) {
      parts.push('\nSCHEMA.ORG BUSINESS DATA (from JSON-LD — high confidence):');
      parts.push('  Type: ' + (sd.business.type || 'unknown'));
      if (sd.business.name) parts.push('  Name: ' + sd.business.name);
      if (sd.business.description) parts.push('  Description: ' + sd.business.description.slice(0, 200));
      if (sd.business.phone) parts.push('  Phone: ' + sd.business.phone);
      if (sd.business.priceRange) parts.push('  Price Range: ' + sd.business.priceRange);
      if (sd.business.foundingDate) parts.push('  Founded: ' + sd.business.foundingDate);
      if (sd.business.numberOfEmployees) parts.push('  Employees: ' + sd.business.numberOfEmployees);
      if (sd.business.areaServed) parts.push('  Area Served: ' + sd.business.areaServed);
      if (sd.business.address) {
        parts.push('  Address: ' + [sd.business.address.street, sd.business.address.city, sd.business.address.region, sd.business.address.postal].filter(Boolean).join(', '));
      }
    }
    if (sd.products && sd.products.length) {
      parts.push('\nPRODUCTS (from schema): ' + sd.products.length + ' found');
      sd.products.slice(0, 8).forEach(function(p) {
        parts.push('  - ' + p.name + (p.price ? ' $' + p.price + ' ' + (p.currency || '') : '') + (p.brand ? ' [' + p.brand + ']' : ''));
      });
    }
    if (sd.breadcrumbs && sd.breadcrumbs.length) {
      parts.push('\nSITE HIERARCHY (from breadcrumbs): ' + sd.breadcrumbs.length + ' paths');
      sd.breadcrumbs.slice(0, 5).forEach(function(path) {
        parts.push('  ' + path.map(function(c) { return c.name; }).join(' > '));
      });
    }
    if (sd.siteSearch) parts.push('Site has internal search (SearchAction)');
    if (sd.videos && sd.videos.length) parts.push('Videos found: ' + sd.videos.length);
    if (sd.events && sd.events.length) parts.push('Events found: ' + sd.events.length);
  }
  return parts.length > 1 ? parts.join('\n') : '';
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

  // Pre-fetch website content, GMB data, brand assets, and structured scrape if not already cached (enrichAll pre-fetches all)
  if (!_cachedWebsiteText) await _fetchWebsiteText();
  if (!_cachedGMBData) await _autoGMB();
  if (!_cachedBrandAssets) await _fetchBrandAssets();
  if (!_cachedStructuredScrape) await _fetchStructuredScrape();
  var websiteText = _cachedWebsiteText || '';

  var ctx = buildEnrichCtx();
  if (websiteText) ctx += '\n\nWEBSITE CONTENT (scraped from ' + (s.url || '') + ' and inner pages):\n' + websiteText.slice(0, 14000);
  // Inject Google Business Profile data into context
  ctx += _gmbCtx();
  // Inject brand assets (colours, fonts, logo) into context
  ctx += _brandAssetsCtx();
  // Inject structured scrape data (social links, FAQs, reviews, blog, team, services)
  ctx += _structuredScrapeCtx();
  // Inject strategic directives (global rules)
  if (typeof getDirectivesContext === 'function') {
    var _rdCtx = getDirectivesContext();
    if (_rdCtx) ctx += '\n' + _rdCtx;
  }
  // Inject GSC search performance data
  if (S.snapshot && S.snapshot.gsc && S.snapshot.gsc.queries && S.snapshot.gsc.queries.length) {
    ctx += '\n\nSEARCH CONSOLE DATA (last 90 days, real Google data):\n';
    ctx += 'Top queries by clicks: ' + S.snapshot.gsc.queries.slice(0, 15).map(function(q) {
      return q.query + ' (' + q.clicks + ' clicks, pos ' + q.position.toFixed(1) + ')';
    }).join('; ');
    if (S.snapshot.gsc.pages && S.snapshot.gsc.pages.length) {
      ctx += '\nTop pages by clicks: ' + S.snapshot.gsc.pages.slice(0, 10).map(function(p) {
        return p.page.replace(/^https?:\/\/[^\/]+/, '') + ' (' + p.clicks + ' clicks)';
      }).join('; ');
    }
  }
  // Inject GA4 analytics data
  if (S.snapshot && S.snapshot.ga4 && S.snapshot.ga4.totals) {
    var t = S.snapshot.ga4.totals;
    ctx += '\n\nGOOGLE ANALYTICS DATA (last 90 days, real data):\n';
    ctx += 'Total sessions: ' + t.sessions + ', Total conversions: ' + t.conversions;
    ctx += ', Avg bounce rate: ' + (t.bounceRate * 100).toFixed(1) + '%';
    if (S.snapshot.ga4.pageMetrics && S.snapshot.ga4.pageMetrics.length) {
      var topConverting = S.snapshot.ga4.pageMetrics.filter(function(p) { return p.conversions > 0; }).slice(0, 5);
      if (topConverting.length) {
        ctx += '\nTop converting pages: ' + topConverting.map(function(p) {
          return p.pagePath + ' (' + p.conversions + ' conversions, ' + p.sessions + ' sessions)';
        }).join('; ');
      }
    }
  }

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

  var clientName = (S.setup && S.setup.client) || (S.research && S.research.client_name) || 'the client';
  var sys = 'You are a senior digital marketing strategist at Setsail Marketing. You are researching a CLIENT business called "' + clientName + '" in order to build them a website.\n'
    + 'CRITICAL: You are extracting information ABOUT THE CLIENT\'S BUSINESS — what THEY sell, what THEY do, who THEIR customers are. You are NOT describing what Setsail Marketing would sell to them.\n'
    + 'CRITICAL RULES:\n'
    + '1. The WEBSITE CONTENT section contains live scraped data from the CLIENT\'S actual website — this is your PRIMARY source of truth for factual fields (their services/products, team size, locations, contact info, about info).\n'
    + '2. If the website shows different information than the strategy doc, PREFER the website data — it is more current.\n'
    + '3. Extract ALL services/products the CLIENT offers on their website, not just the top 3. These are the services the CLIENT sells to THEIR customers.\n'
    + '4. For team_size: check /team, /our-team, /about pages and COUNT the actual team members listed. If the website lists individual team members, count them.\n'
    + '5. Do NOT use placeholder text. If you cannot find information, use an empty string or empty array.\n'
    + '6. Return ONLY valid JSON — no preamble, no markdown fences, no backticks.\n'
    + '7. SERVICE-PROVIDER DISAMBIGUATION: Many service providers (real estate agents, insurance agents, financial advisors, lawyers, dentists, contractors) mention "training", "coaching", "mentoring", or "team building" on their websites. This almost always refers to INTERNAL team development — NOT a service they sell to the public. A real estate agent who says "we train our agents" is training their own team to sell houses better, not selling training as a product. The CLIENT\'S customers are the END CONSUMERS of their service (homebuyers/sellers for real estate, policyholders for insurance, patients for dentists, etc.). Only classify the business as B2B training/coaching if training IS the primary revenue-generating service sold to external customers.\n'
    + '8. AUDIENCE IDENTITY: The primary_audience_description must describe who PAYS the business for its core service. For a real estate agent, the audience is homebuyers and sellers — NOT other real estate agents. For an insurance broker, the audience is individuals/businesses buying policies — NOT other brokers. Internal team composition is NOT the audience.';

  var b = '\n  ';
  var prompts = {
    business: ctx + '\n\nExtract and return a JSON object about the CLIENT\'S business ("' + clientName + '"). Use actual values from THEIR website and documents.\nRULES:\n- services_detail = the services or products the CLIENT SELLS to THEIR customers. NOT web design services that Setsail would provide.\n- Include EVERY service/product the client offers from their /services page — do not summarise or skip any\n- For team_size: count every individual person named on /about or /team page\n- For pricing in services_detail: pull actual dollar amounts from the client\'s /pricing page\n- Prefer website data over strategy doc when they conflict\n- Do NOT include value_proposition, strategic_recommendations, or top_offers — those are handled in the Strategy stage\n- SERVICE-PROVIDER vs TRAINER disambiguation: If the website mentions "training", "coaching", or "mentoring" in the context of their INTERNAL TEAM (e.g. "we train our agents to deliver excellence"), this is NOT a service they sell. The business_model should reflect who pays for the CORE service. A real estate brokerage is B2C (consumers buy/sell homes through them), even if they train their own agents internally. Only classify as B2B coaching/training if training is the PRIMARY external revenue service.\n- For target_audience in services_detail: always identify the END CONSUMER who pays for the service, not the team members who deliver it.\n{\n'
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
      + b + '"services_detail": [{"name": "service or product the CLIENT sells (NOT web design services)", "description": "1-2 sentence description of what the client offers", "pricing": "the client\'s pricing from their /pricing page e.g. $1800 setup + $2400/mo, or empty string if not found", "target_audience": "who buys this service from the client", "key_differentiator": "what makes the client\'s offering unique"}]\n}',

    audience: ctx + '\n\nExtract audience and sales process information. Return a JSON object with actual values.\nDo NOT include CTAs (primary_cta, secondary_cta, low_commitment_cta) — those are handled in the Strategy stage.\nCRITICAL: The audience is the END CONSUMER who pays for the core service — NOT internal team members. For a real estate agent, the audience is homebuyers and sellers. For a law firm, the audience is individuals/businesses needing legal help. For a dental practice, the audience is patients. Internal staff, team members, and associates are NOT the audience even if the website mentions training or mentoring them.\n{\n'
      + b + '"primary_audience_description": "2-3 sentence profile of the END CONSUMER who buys from this business — NOT internal staff or team members",\n'
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
      + b + '"previous_agency_experience": "one of: Good experience | Bad experience | No agency | Multiple agencies | empty string if unknown",\n'
      + b + '"known_landing_page_cvr": "extract if client mentions their landing page or form conversion rate, otherwise empty string",\n'
      + b + '"known_cpl": "extract if client mentions their cost per lead from ads or campaigns, otherwise empty string",\n'
      + b + '"known_close_rate": "extract if client mentions their CRM close rate from qualified leads, otherwise empty string",\n'
      + b + '"buyer_sophistication": "1-5 based on how much marketing exposure and prior buying cycles the audience has — 1=naive, 5=highly sophisticated. Infer from industry and business model. Return as string.",\n'
      + b + '"perceived_categories": ["how the buyer frames what they are shopping for — e.g. agency, consultant, software, platform"],\n'
      + b + '"switching_triggers": ["what would make them act now — e.g. growth pressure, contract ending, competitor threat"]\n}',

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
      + b + '"testimonials": [{"quote": "exact customer quote from testimonials page, homepage, or case studies", "author": "person name if stated", "title": "job title or company if stated", "source": "page path where found e.g. /testimonials"}],\n'
      + b + '"reviews": [{"author_name": "reviewer name", "rating_value": "star rating if present", "review_body_short": "review text excerpt (max 300 chars)", "source_url": "Google, Clutch, etc."}],\n'
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

    competitors: (function() {
      var _r = S.research || {};
      var _s = S.setup || {};
      var _businessModel = _r.business_model || _r.revenue_model || '';
      var _revenueModel = _r.revenue_model || '';
      var _geoScope = (_r.geography && _r.geography.primary) || _s.geo || '';
      var _dealSize = _r.average_deal_size || '';
      return 'CLIENT PROFILE:\n'
        + 'Business: ' + (_s.client || '') + '\n'
        + 'URL: ' + (_s.url || '') + '\n'
        + 'Location: ' + _geoScope + '\n'
        + 'Industry: ' + (_r.industry || 'unknown') + '\n'
        + 'Services/Products: ' + (_r.primary_services && _r.primary_services.length ? _r.primary_services.join(', ') : 'see context') + '\n'
        + 'Business Model: ' + (_businessModel || 'infer from context — e.g. agency, SaaS, manufacturer, retailer, DTC, B2B, professional practice') + '\n'
        + 'Revenue Model: ' + (_revenueModel || 'infer — e.g. project-based, retainer, subscription, product sales, commission') + '\n'
        + 'Geographic Scope: ' + (_geoScope || 'infer from context') + '\n'
        + (_dealSize ? 'Average Deal Size: ' + _dealSize + '\n' : '')
        + (_s.competitors ? 'Competitors named by client: ' + _s.competitors + '\n' : '')
        + '\n\nIDENTIFY 5-8 REAL DIRECT COMPETITORS.\n\n'
        + 'A DIRECT COMPETITOR must match ALL of:\n'
        + '1. SAME BUSINESS MODEL — if client is a manufacturer, competitor must be a manufacturer (not a retailer or marketplace). If client is an agency, competitor must be an agency (not a tool or directory).\n'
        + '2. SAME TARGET CUSTOMER — competing for the same buyer. A B2B SaaS does not compete with a consumer app.\n'
        + '3. SIMILAR SCALE — comparable company size. A 10-person local agency does not compete with Deloitte.\n'
        + '4. OVERLAPPING GEOGRAPHY — serves the same market area.\n\n'
        + 'SOURCES in priority order:\n'
        + '1. Competitors named by the client above (always include).\n'
        + '2. Real domains from DataForSEO data (if prepended — but ONLY if they match the business model).\n'
        + '3. Your knowledge of real businesses in this specific industry and geography.\n\n'
        + 'HARD EXCLUDES — NEVER include these types:\n'
        + '- General marketplaces (Amazon, eBay, Walmart, Costco, Best Buy, Canadian Tire, Wayfair)\n'
        + '- Review/directory sites (Clutch, G2, Yelp, BBB, Houzz, Thumbtack, Angi)\n'
        + '- SEO/marketing tools (Semrush, Ahrefs, HubSpot, Mailchimp)\n'
        + '- Social platforms (Facebook, LinkedIn, Instagram, YouTube, Reddit)\n'
        + '- News/content sites (Forbes, Wikipedia, Medium)\n'
        + '- Website builders (Wix, Squarespace, Shopify — unless client is also a website builder)\n'
        + '- Job boards, government sites, educational institutions\n'
        + '- Companies 100x+ larger unless they directly compete in the same niche\n\n'
        + 'For each competitor, classify as:\n'
        + '- "direct" — same products/services, same customer, same geography\n'
        + '- "indirect" — different model but competing for same budget/attention\n\n'
        + 'Return ONLY valid JSON, no preamble.\n{\n'
        + b + '"competitors": [{"name": "Real Business Name", "url": "https://domain.com", "type": "direct or indirect", "why_they_win": "1-2 sentence specific strength", "weaknesses": "specific weakness or gap", "what_we_do_better": "how our client beats them"}]\n}';
    })()
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
    console.log('ENRICH RAW ['+tab+']:', result.slice(0,600));
    var parsed = parseEnrichResult(result);
    console.log('ENRICH PARSED ['+tab+']:', JSON.stringify(parsed));
    if (parsed) {
      // Competitors: validation panel before committing
      if (tab === 'competitors') {
        if (parsed.competitors && Array.isArray(parsed.competitors) && parsed.competitors.length > 0) {
          // Post-AI blocklist filter — remove any domains that slipped through
          var _filtered = parsed.competitors.filter(function(c) {
            if (!c.url) return true; // keep entries without URL, they'll be enriched later
            var domain = c.url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
            return !_COMPETITOR_BLOCKLIST.some(function(bl) { return domain === bl || domain.endsWith('.' + bl); });
          });
          if (_filtered.length < parsed.competitors.length) {
            console.log('[competitors] blocklist removed', parsed.competitors.length - _filtered.length, 'entries');
          }
          window._pendingCompetitors = _filtered;
          window._pendingCompR = r;
          _rTab = 'competitors';
          renderResearchTabContent();
          // Show confirmation banner
          var compContainer = document.getElementById('research-tab-content');
          if (compContainer) {
            var confirmHtml = '<div id="comp-validation-panel" class="card" style="margin-bottom:12px;border-left:3px solid #6366f1;background:#f5f3ff">';
            confirmHtml += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">';
            confirmHtml += '<i class="ti ti-alert-circle" style="color:#6366f1"></i>';
            confirmHtml += '<span style="font-size:12px;font-weight:600;color:var(--dark)">Review Detected Competitors</span>';
            confirmHtml += '<span style="font-size:10px;color:var(--n2)">Uncheck any that are not real competitors</span>';
            confirmHtml += '</div>';
            _filtered.forEach(function(c, ci) {
              var cType = c.type === 'indirect' ? '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#fef3c7;color:#b45309">indirect</span>' : '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:#dcfce7;color:#15803d">direct</span>';
              confirmHtml += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #e5e7eb">';
              confirmHtml += '<input type="checkbox" checked data-comp-idx="' + ci + '" class="comp-confirm-cb" style="width:14px;height:14px">';
              confirmHtml += '<div style="flex:1"><div style="font-size:12px;font-weight:500">' + esc(c.name || '') + ' ' + cType + '</div>';
              if (c.url) confirmHtml += '<div style="font-size:10px;color:var(--n2)">' + esc(c.url) + '</div>';
              if (c.why_they_win) confirmHtml += '<div style="font-size:10px;color:var(--n3)">' + esc(c.why_they_win) + '</div>';
              confirmHtml += '</div></div>';
            });
            confirmHtml += '<div style="display:flex;gap:8px;margin-top:10px">';
            confirmHtml += '<button id="comp-confirm-btn" class="btn btn-primary sm" style="font-size:11px">Confirm Selected</button>';
            confirmHtml += '<button id="comp-confirm-all-btn" class="btn btn-ghost sm" style="font-size:11px">Accept All</button>';
            confirmHtml += '</div></div>';
            compContainer.insertAdjacentHTML('afterbegin', confirmHtml);
            // Wire buttons
            var _confirmBtn = document.getElementById('comp-confirm-btn');
            var _confirmAllBtn = document.getElementById('comp-confirm-all-btn');
            if (_confirmBtn) {
              _confirmBtn.onclick = function() {
                var checked = [];
                document.querySelectorAll('.comp-confirm-cb').forEach(function(cb) {
                  if (cb.checked) checked.push(parseInt(cb.getAttribute('data-comp-idx'), 10));
                });
                var confirmed = window._pendingCompetitors.filter(function(c, i) { return checked.indexOf(i) !== -1; });
                window._pendingCompR.competitors = confirmed;
                console.log('COMPETITORS CONFIRMED:', confirmed.length, 'items');
                scheduleSave();
                window._pendingCompetitors = null;
                renderResearchTabContent();
                scheduleScorecard();
                aiBarNotify('Saved ' + confirmed.length + ' confirmed competitors', { duration: 3000 });
              };
            }
            if (_confirmAllBtn) {
              _confirmAllBtn.onclick = function() {
                window._pendingCompR.competitors = window._pendingCompetitors;
                console.log('COMPETITORS ACCEPTED ALL:', window._pendingCompetitors.length, 'items');
                scheduleSave();
                window._pendingCompetitors = null;
                renderResearchTabContent();
                scheduleScorecard();
                aiBarNotify('Saved all ' + (window._pendingCompR.competitors || []).length + ' competitors', { duration: 3000 });
              };
            }
          }
        } else {
          console.warn('COMPETITORS EMPTY IN PARSED:', JSON.stringify(parsed));
        }
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

// ── Current Performance Card (read-only, from Snapshot) ───────────
function renderCurrentPerformance() {
  var snap = S.snapshot || {};
  var gsc = snap.gsc;
  var ga4 = snap.ga4;
  if (!gsc && !ga4) {
    return '<div class="card" style="margin-bottom:14px;border-left:3px solid var(--border);opacity:.7">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<div class="eyebrow" style="margin:0">Current Performance</div>' +
      '<span style="font-size:9px;background:var(--n3);color:white;padding:1px 6px;border-radius:3px">FROM SNAPSHOT</span>' +
      '</div>' +
      '<p style="font-size:12px;color:var(--n2);margin:0">Connect GSC and GA4 in Setup, then run Snapshot to see real performance data here.</p>' +
      '</div>';
  }

  var html = '<div class="card" style="margin-bottom:14px;border-left:3px solid var(--blue, #3b82f6)">';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
  html += '<div class="eyebrow" style="margin:0">Current Performance</div>';
  html += '<span style="font-size:9px;background:var(--n3);color:white;padding:1px 6px;border-radius:3px">FROM SNAPSHOT</span>';
  html += '</div>';
  html += '<p style="font-size:11px;color:var(--n2);margin:0 0 14px">Real data from Google Search Console and Analytics \u2014 use to verify AI-enriched fields below.</p>';

  // Section 1: GSC Traffic Overview
  if (gsc) {
    var queries = gsc.queries || [];
    var pages = gsc.pages || [];
    var totalClicks = 0, totalImpr = 0, totalCtr = 0, totalPos = 0, qCount = queries.length;
    queries.forEach(function(q) {
      totalClicks += q.clicks || 0;
      totalImpr += q.impressions || 0;
    });
    totalCtr = totalImpr > 0 ? totalClicks / totalImpr : 0;
    var posSum = 0, posCount = 0;
    queries.forEach(function(q) { if (q.position) { posSum += q.position; posCount++; } });
    totalPos = posCount > 0 ? posSum / posCount : 0;

    html += '<div style="margin-bottom:14px">';
    html += '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:8px">Search Console (last 90 days)</div>';
    html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">';
    html += _perfStat('Clicks', _cpFmtNum(totalClicks));
    html += _perfStat('Impressions', _cpFmtNum(totalImpr));
    html += _perfStat('Avg CTR', _cpFmtPct(totalCtr));
    html += _perfStat('Avg Position', totalPos > 0 ? totalPos.toFixed(1) : '\u2014');
    html += '</div>';

    // Top 5 queries
    if (queries.length > 0) {
      var topQ = queries.slice().sort(function(a, b) { return (b.clicks || 0) - (a.clicks || 0); }).slice(0, 5);
      html += '<div style="font-size:10px;font-weight:600;color:var(--n2);margin-bottom:4px">Top Queries by Clicks</div>';
      html += '<table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">';
      html += '<tr style="border-bottom:1px solid var(--border);color:var(--n2)">';
      html += '<th style="text-align:left;padding:3px 6px">Query</th><th style="text-align:right;padding:3px 6px">Clicks</th><th style="text-align:right;padding:3px 6px">Impr</th><th style="text-align:right;padding:3px 6px">CTR</th><th style="text-align:right;padding:3px 6px">Pos</th></tr>';
      topQ.forEach(function(q) {
        html += '<tr style="border-bottom:1px solid var(--border)">';
        html += '<td style="padding:3px 6px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _cpEsc(q.query) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtNum(q.clicks) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtNum(q.impressions) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtPct(q.ctr) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + (q.position ? q.position.toFixed(1) : '\u2014') + '</td>';
        html += '</tr>';
      });
      html += '</table>';
    }

    // Top 5 pages
    if (pages.length > 0) {
      var topP = pages.slice().sort(function(a, b) { return (b.clicks || 0) - (a.clicks || 0); }).slice(0, 5);
      html += '<div style="font-size:10px;font-weight:600;color:var(--n2);margin-bottom:4px">Top Pages by Clicks</div>';
      html += '<table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">';
      html += '<tr style="border-bottom:1px solid var(--border);color:var(--n2)">';
      html += '<th style="text-align:left;padding:3px 6px">Page</th><th style="text-align:right;padding:3px 6px">Clicks</th><th style="text-align:right;padding:3px 6px">Impr</th><th style="text-align:right;padding:3px 6px">CTR</th><th style="text-align:right;padding:3px 6px">Pos</th></tr>';
      topP.forEach(function(p) {
        var pagePath = p.page || '';
        try { pagePath = new URL(pagePath).pathname; } catch(e) {}
        html += '<tr style="border-bottom:1px solid var(--border)">';
        html += '<td style="padding:3px 6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + _cpEsc(p.page) + '">' + _cpEsc(pagePath) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtNum(p.clicks) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtNum(p.impressions) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtPct(p.ctr) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + (p.position ? p.position.toFixed(1) : '\u2014') + '</td>';
        html += '</tr>';
      });
      html += '</table>';
    }
    html += '</div>';
  }

  // Section 2: GA4 Analytics Overview
  if (ga4) {
    var totals = ga4.totals || {};
    html += '<div style="margin-bottom:14px">';
    html += '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:8px">Analytics Overview (last 90 days)</div>';
    html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">';
    html += _perfStat('Sessions', _cpFmtNum(totals.sessions));
    html += _perfStat('Conversions', _cpFmtNum(totals.conversions));
    html += _perfStat('Bounce Rate', _cpFmtPct(totals.bounceRate));
    html += '</div>';
    html += '</div>';

    // Section 3: Traffic Channels
    if (ga4.channels && ga4.channels.length > 0) {
      html += '<div style="margin-bottom:14px">';
      html += '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:8px">Traffic Channels</div>';
      html += '<table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:10px">';
      html += '<tr style="border-bottom:1px solid var(--border);color:var(--n2)">';
      html += '<th style="text-align:left;padding:3px 6px">Channel</th><th style="text-align:right;padding:3px 6px">Sessions</th><th style="text-align:right;padding:3px 6px">Conversions</th><th style="text-align:right;padding:3px 6px">Bounce Rate</th><th style="text-align:right;padding:3px 6px">Avg Duration</th></tr>';
      ga4.channels.forEach(function(ch) {
        html += '<tr style="border-bottom:1px solid var(--border)">';
        html += '<td style="padding:3px 6px">' + _cpEsc(ch.channel) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtNum(ch.sessions) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtNum(ch.conversions) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtPct(ch.bounceRate) + '</td>';
        html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtDur(ch.avgDuration) + '</td>';
        html += '</tr>';
      });
      html += '</table>';
      html += '</div>';
    }

    // Section 4: Top Converting Pages
    if (ga4.pageMetrics && ga4.pageMetrics.length > 0) {
      var converting = ga4.pageMetrics.filter(function(p) { return p.conversions > 0; });
      if (converting.length > 0) {
        converting.sort(function(a, b) { return b.conversions - a.conversions; });
        html += '<div style="margin-bottom:6px">';
        html += '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--n2);margin-bottom:8px">Top Converting Pages</div>';
        html += '<table style="width:100%;font-size:11px;border-collapse:collapse">';
        html += '<tr style="border-bottom:1px solid var(--border);color:var(--n2)">';
        html += '<th style="text-align:left;padding:3px 6px">Page Path</th><th style="text-align:right;padding:3px 6px">Sessions</th><th style="text-align:right;padding:3px 6px">Conversions</th><th style="text-align:right;padding:3px 6px">Bounce Rate</th></tr>';
        converting.forEach(function(p) {
          html += '<tr style="border-bottom:1px solid var(--border)">';
          html += '<td style="padding:3px 6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + _cpEsc(p.pagePath) + '">' + _cpEsc(p.pagePath) + '</td>';
          html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtNum(p.sessions) + '</td>';
          html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtNum(p.conversions) + '</td>';
          html += '<td style="text-align:right;padding:3px 6px">' + _cpFmtPct(p.bounceRate) + '</td>';
          html += '</tr>';
        });
        html += '</table>';
        html += '</div>';
      }
    }
  }

  html += '</div>';
  return html;
}

// ── Current Performance helper functions ──────────────────────────
function _cpEsc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function _cpFmtNum(n) { return n != null ? Number(n).toLocaleString() : '0'; }
function _cpFmtPct(n) { return n != null ? (n * 100).toFixed(1) + '%' : '0.0%'; }
function _cpFmtDur(s) { if (!s && s !== 0) return '\u2014'; var m = Math.floor(s / 60); var sec = Math.round(s % 60); return m + ':' + (sec < 10 ? '0' : '') + sec; }
function _perfStat(label, value) {
  return '<div style="min-width:80px">' +
    '<div style="font-size:10px;color:var(--n2);margin-bottom:2px">' + label + '</div>' +
    '<div style="font-size:16px;font-weight:600;color:var(--dark)">' + value + '</div>' +
    '</div>';
}

// ── Breadcrumb completeness accessor ─────────────────────────────

function getResearchCompleteness() {
  try {
    var c = calcResearchCompleteness();
    return c.total.pct || 0;
  } catch (e) {
    return 0;
  }
}

// ── KEYWORD RESEARCH (DataForSEO — runs after Research stage) ──────