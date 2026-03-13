
function initResearch() {
  if (!S.research) S.research = researchDefaults();
  _rTab = _rTab || 'business';
  renderResearchNav();
  renderResearchTabContent();
}

function researchDefaults() {
  return {
    // Business
    client_name:'', business_overview:'', value_proposition:'',
    industry:'', sub_industry:'', business_model:'',
    years_in_business:'', team_size:'', locations_count:'',
    primary_services:[], top_offers:[],
    pricing_notes:'', pricing_model:'',
    capacity_constraints:'', seasonality_notes:'',
    strategic_recommendations:[],
    // Audience
    primary_audience_description:'', buyer_roles_titles:[],
    target_geography:'', best_customer_examples:'',
    pain_points_top5:[], objections_top5:[],
    lead_channels_today:[], sales_cycle_length:'',
    lead_qualification_criteria:'', close_rate_estimate:'',
    top_reasons_leads_dont_close:'', booking_flow_description:'',
    primary_goal:'', secondary_goals:[], target_audience:[],
    geography:{ primary:'', secondary:[] },
    // Brand
    brand_name:'', slogan_or_tagline:'', brand_voice_style:'',
    tone_and_voice:'', words_to_use:[], words_to_avoid:[],
    key_differentiators:[], proof_points:[],
    brand_colours:[], fonts:[],
    brand_guidelines_link:'', logo_files_link:'',
    photo_library_link:'', video_library_link:'',
    existing_ad_creatives_link:'', do_not_use_assets_notes:'',
    reference_brands:[],
    // Schema
    schema_business_type:'', schema_primary_category:'',
    schema_price_range:'', schema_payment_methods:[],
    schema_has_physical_locations:false,
    schema_street_address:'', schema_city:'', schema_region:'',
    schema_postal_code:'', schema_country:'',
    social_profiles:[], schema_services:[],
    has_location_pages:'', has_service_pages:'',
    has_blog:'', has_faq_section:'',
    schema_injection_method:'',
    faqs:[], reviews:[],
    // Competitors
    competitors:[],
  };
}

function renderResearchNav() {
  const nav = document.getElementById('research-tab-nav');
  if (!nav) return;
  nav.innerHTML = RESEARCH_TABS.map(t => {
    const active = _rTab === t.id;
    const done = _enrichDone.has(t.id);
    const enrichingThis = _enriching === t.id;
    const badge = enrichingThis
      ? `<span class="spinner" style="width:10px;height:10px;display:inline-block;margin-left:5px;vertical-align:middle"></span>`
      : done
        ? `<span style="color:var(--green);font-size:10px;margin-left:4px;font-weight:600">✓</span>`
        : '';
    return `<button onclick="switchRTab('${t.id}')" style="padding:9px 16px;border:none;border-bottom:2px solid ${active?'var(--green)':'transparent'};background:none;font-family:var(--font);font-size:13px;color:${active?'var(--dark)':'var(--n2)'};cursor:pointer;white-space:nowrap;font-weight:${active?500:400};transition:color .15s;margin-bottom:-2px"><i class="ti ${t.icon}" style="margin-right:5px;font-size:12px"></i>${t.label}${badge}</button>`;
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
  const lHtml = `<label for="${id}" style="font-size:10px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">${label}</label>`;
  const base = 'width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:7px 10px;font-size:13px;color:var(--dark);font-family:var(--font);outline:none;box-sizing:border-box';
  const span = (type==='textarea'||type==='textarea-array'||opts.span) ? 'grid-column:1/-1;' : '';
  let input = '';

  if (type === 'textarea') {
    input = `<textarea id="${id}" rows="${opts.rows||3}" style="${base}" onchange="setRF('${key}',this.value)">${esc(value||'')}</textarea>`;
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
  return `<div style="${span}">${lHtml}${input}</div>`;
}

function rSec(title, fieldsHtml) {
  return `<div class="card" style="margin-bottom:10px">
    <div class="eyebrow" style="margin-bottom:14px">${title}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${fieldsHtml}</div>
  </div>`;
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
  const parts = key.split('.');
  let obj = S.research;
  for (let i = 0; i < parts.length - 1; i++) { obj[parts[i]] = obj[parts[i]] || {}; obj = obj[parts[i]]; }
  obj[parts[parts.length-1]] = value;
  scheduleSave();
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
}

function addRFRep(key) {
  if (!S.research) S.research = researchDefaults();
  if (!S.research[key]) S.research[key] = [];
  S.research[key].push({});
  scheduleSave();
  renderResearchTabContent();
}

function removeRFRep(key, idx) {
  if (!S.research || !S.research[key]) return;
  S.research[key].splice(idx, 1);
  scheduleSave();
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
  let html = rTabActions('business');
  html += rSec('Core Identity',
    rField('business_overview','Business Overview', r.business_overview, 'textarea', {rows:3}) +
    rField('value_proposition','Value Proposition', r.value_proposition, 'textarea', {rows:3}) +
    rField('industry','Industry', r.industry) +
    rField('sub_industry','Sub-Industry / Niche', r.sub_industry) +
    rField('business_model','Business Model', r.business_model, 'select', {options:['','b2b','b2c','b2b2c','marketplace','saas','nonprofit']}) +
    rField('years_in_business','Years in Business', r.years_in_business) +
    rField('team_size','Team Size', r.team_size) +
    rField('locations_count','Number of Locations', r.locations_count)
  );
  html += rSec('Services & Pricing',
    rField('primary_services','Primary Services (one per line)', r.primary_services, 'textarea-array', {rows:5}) +
    rField('pricing_notes','Pricing Notes', r.pricing_notes, 'textarea', {rows:3}) +
    rField('pricing_model','Pricing Model', r.pricing_model, 'select', {options:['','quote_based','fixed_menu','subscription']}) +
    rField('capacity_constraints','Capacity Constraints', r.capacity_constraints) +
    rField('seasonality_notes','Seasonality Notes', r.seasonality_notes)
  );
  html += rSec('Strategic Recommendations',
    rField('strategic_recommendations','Recommendations (one per line)', r.strategic_recommendations, 'textarea-array', {rows:5})
  );
  html += rRepGroup('top_offers','Top Offers',
    [{key:'offer_name',label:'Offer Name'},{key:'priority',label:'Priority',width:'80px'},{key:'notes',label:'Notes'}],
    '+ Add Offer'
  );
  return html;
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
    rField('lead_qualification_criteria','Lead Qualification Criteria', r.lead_qualification_criteria, 'textarea', {rows:2}) +
    rField('top_reasons_leads_dont_close','Top Reasons Leads Don\'t Close', r.top_reasons_leads_dont_close, 'textarea', {rows:2}) +
    rField('booking_flow_description','Booking / Intake Flow', r.booking_flow_description, 'textarea', {rows:2})
  );
  return html;
}

function renderRBrand(r) {
  let html = rTabActions('brand');
  html += rSec('Brand Identity',
    rField('brand_name','Brand Name', r.brand_name) +
    rField('slogan_or_tagline','Slogan / Tagline', r.slogan_or_tagline) +
    rField('brand_voice_style','Voice Style', r.brand_voice_style, 'select', {options:['','direct','playful','premium','technical','warm','other']}) +
    rField('tone_and_voice','Tone & Voice Notes', r.tone_and_voice, 'textarea', {rows:2}) +
    rField('words_to_use','Words to Use (comma-separated)', r.words_to_use, 'text-csv') +
    rField('words_to_avoid','Words to Avoid (comma-separated)', r.words_to_avoid, 'text-csv')
  );
  html += rSec('Positioning & Proof',
    rField('key_differentiators','Key Differentiators (one per line)', r.key_differentiators, 'textarea-array', {rows:4}) +
    rField('proof_points','Proof Points / Awards / Certs (one per line)', r.proof_points, 'textarea-array', {rows:4})
  );
  html += rSec('Visual Assets',
    rField('brand_colours','Brand Colours — hex codes (comma-separated)', r.brand_colours, 'text-csv') +
    rField('fonts','Fonts (comma-separated)', r.fonts, 'text-csv') +
    rField('brand_guidelines_link','Brand Guidelines Link', r.brand_guidelines_link) +
    rField('logo_files_link','Logo Files Link', r.logo_files_link) +
    rField('photo_library_link','Photo Library Link', r.photo_library_link) +
    rField('video_library_link','Video Library Link', r.video_library_link) +
    rField('existing_ad_creatives_link','Existing Ad Creatives Link', r.existing_ad_creatives_link) +
    rField('do_not_use_assets_notes','Do Not Use (assets/phrases)', r.do_not_use_assets_notes, 'textarea', {rows:2})
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
    if (g.social_profiles && g.social_profiles.length > 0) rd.social_profiles = g.social_profiles;
    if (g.reviews && g.reviews.length > 0) rd.reviews = g.reviews;
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
    rField('schema_country','Country', r.schema_country)
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
  html += rRepGroup('faqs','FAQs',
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
    [{key:'name',label:'Competitor',width:'160px'},{key:'url',label:'URL',width:'200px'},{key:'why_they_win',label:'Why They Win / Strengths'}],
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

async function enrichAll(forceAll) {
  const tabs = ['business','audience','brand','schema','competitors'];
  const btn = document.getElementById('research-enrich-btn');
  const statusEl = document.getElementById('research-enrich-status');
  const msgEl = document.getElementById('research-enrich-msg');
  const progEl = document.getElementById('research-enrich-progress');
  var _s = S.setup || {};
  if (_s.client && !S.research.client_name) S.research.client_name = _s.client;
  if (_s.client && !S.research.brand_name) S.research.brand_name = _s.client;
  _enrichDone.clear();
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;display:inline-block"></span> Enriching...'; }
  if (statusEl) statusEl.style.display = 'flex';
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const label = tab.charAt(0).toUpperCase()+tab.slice(1);
    _enriching = tab;
    _rTab = tab;
    if (msgEl) msgEl.textContent = 'Enriching ' + label + '...';
    if (progEl) progEl.textContent = (i+1)+' / '+tabs.length;
    renderResearchNav();
    renderResearchTabContent();
    await enrichRTab(tab, forceAll);
    _enrichDone.add(tab);
    // Pause between tabs to avoid Anthropic rate limits
    if (i < tabs.length - 1) await new Promise(function(res){ setTimeout(res, 2000); });
  }
  _enriching = false;
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
function mergeEnriched(target, source, forceAll) {
  Object.keys(source).forEach(function(key) {
    if (key === 'geography') return;
    var existing = target[key];
    var incoming = source[key];
    if (incoming === null || incoming === undefined) return;
    if (!forceAll) {
      if (typeof existing === 'string' && existing.trim()) return;
      if (Array.isArray(existing) && existing.length > 0) return;
      // booleans: always allow enrichment to set them (false = unfilled)
    }
    target[key] = incoming;
  });
}

function parseEnrichResult(result) {
  var parsed = null;
  try { parsed = JSON.parse(result.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim()); } catch(e) {}
  if (!parsed) {
    try {
      var si = result.indexOf('{'), ei = result.lastIndexOf('}');
      if (si >= 0 && ei > si) parsed = JSON.parse(result.slice(si, ei+1));
    } catch(e) {}
  }
  return parsed;
}

async function enrichRTab(tab, forceAll) {
  if (!S.research) S.research = researchDefaults();
  var r = S.research;
  var s = S.setup || {};
  var ctx = buildEnrichCtx();

  var sys = 'You are a senior digital marketing strategist at Setsail Marketing. Extract REAL information from the provided documents. Do NOT use placeholder text. Return ONLY valid JSON — no preamble, no markdown fences, no backticks.';

  var b = '\n  ';
  var prompts = {
    business: ctx + '\n\nExtract and return a JSON object. Use actual values from the documents, not placeholder text:\n{\n'
      + b + '"business_overview": "2-3 sentence factual description of what this business does",\n'
      + b + '"value_proposition": "the core promise to customers in one sentence",\n'
      + b + '"industry": "e.g. Healthcare, Construction, Legal Services",\n'
      + b + '"sub_industry": "specific niche within that industry",\n'
      + b + '"business_model": "one of: b2b b2c b2b2c marketplace saas nonprofit",\n'
      + b + '"years_in_business": "number as string or empty string if unknown",\n'
      + b + '"team_size": "approximate headcount as string or empty string if unknown",\n'
      + b + '"primary_services": ["actual service 1", "actual service 2", "actual service 3"],\n'
      + b + '"pricing_notes": "how pricing works",\n'
      + b + '"pricing_model": "one of: quote_based fixed_menu subscription",\n'
      + b + '"top_offers": [{"offer_name": "specific offer name", "priority": "1", "notes": "why this is a top offer"}],\n'
      + b + '"strategic_recommendations": ["specific rec 1", "specific rec 2", "specific rec 3"]\n}',

    audience: ctx + '\n\nExtract audience and sales process information. Return a JSON object with actual values:\n{\n'
      + b + '"primary_audience_description": "2-3 sentence profile of who buys from this business",\n'
      + b + '"buyer_roles_titles": ["decision maker title 1", "decision maker title 2"],\n'
      + b + '"target_geography": "one of: local regional national international",\n'
      + b + '"best_customer_examples": "description of the ideal customer archetype",\n'
      + b + '"pain_points_top5": ["specific pain 1", "specific pain 2", "specific pain 3", "specific pain 4", "specific pain 5"],\n'
      + b + '"objections_top5": ["real objection 1", "real objection 2", "real objection 3", "real objection 4", "real objection 5"],\n'
      + b + '"lead_channels_today": ["current lead source 1", "current lead source 2"],\n'
      + b + '"sales_cycle_length": "one of: same_day 1_7_days 14_30_days 30_plus_days",\n'
      + b + '"close_rate_estimate": "percentage as string e.g. 30% or empty string if unknown",\n'
      + b + '"lead_qualification_criteria": "what makes a lead qualified for this business",\n'
      + b + '"top_reasons_leads_dont_close": "main reasons deals fall through",\n'
      + b + '"booking_flow_description": "how a prospect becomes a client - steps in the intake process",\n'
      + b + '"primary_goal": "one of: leads sales bookings traffic awareness",\n'
      + b + '"geography": {"primary": "City, Province", "secondary": ["secondary city 1"]},\n'
      + b + '"target_audience": [{"persona": "persona label", "pain_points": ["pain 1"], "motivators": ["motivator 1"]}]\n}',

    brand: ctx + '\nBusiness: ' + (S.setup && S.setup.client ? S.setup.client : '') + '\n\nReturn a JSON object. For brand_colours/fonts: only include values explicitly in reference docs, use [] if not found. Do NOT invent values.\nFor tone, differentiators, voice: extract specifically from strategy and brand docs.\nReturn ONLY valid JSON, no preamble.\n{\n'
      + b + '"brand_name": "' + ((S.setup && S.setup.client) || 'brand name') + '",\n'
      + b + '"slogan_or_tagline": "tagline from docs, or empty string",\n'
      + b + '"brand_voice_style": "one of: direct playful premium technical warm other",\n'
      + b + '"tone_and_voice": "2-3 sentences on tone and personality from the docs",\n'
      + b + '"words_to_use": ["power words fitting this brand voice"],\n'
      + b + '"words_to_avoid": ["words that conflict with this brand voice"],\n'
      + b + '"key_differentiators": ["real differentiator from the docs"],\n'
      + b + '"proof_points": ["real cert/award/stat from docs, or []"],\n'
      + b + '"brand_colours": ["hex from brand guide only, or []"],\n'
      + b + '"fonts": ["font from brand guide only, or []"]\n}',

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
      + b + '"faqs": [{"question": "real customer question 1", "answer": "direct answer"}, {"question": "real customer question 2", "answer": "direct answer"}],\n'
      + b + '"has_service_pages": "Yes or Planned or No",\n'
      + b + '"has_blog": "Yes or Planned or No",\n'
      + b + '"has_faq_section": "Yes or Planned or No"\n}',

    competitors: 'Business: ' + (S.setup && S.setup.client ? S.setup.client : '') + '\n'
      + 'URL: ' + (S.setup && S.setup.url ? S.setup.url : '') + '\n'
      + 'Location: ' + (S.setup && S.setup.geo ? S.setup.geo : '') + '\n'
      + 'Industry: ' + (S.research && S.research.industry ? S.research.industry : 'unknown') + '\n'
      + 'Services: ' + (S.research && S.research.primary_services && S.research.primary_services.length ? S.research.primary_services.join(', ') : 'see strategy doc') + '\n'
      + (S.setup && S.setup.competitors ? 'Competitors named by client: ' + S.setup.competitors + '\n' : '')
      + '\nStrategy doc excerpt:\n' + ((S.setup && S.setup.strategy) ? S.setup.strategy.slice(0, 2000) : '') + '\n'
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
      + b + '"competitors": [{"name": "Real Business Name", "url": "https://domain.com", "why_they_win": "specific strength"}]\n}'
  };

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
    var result;
    try {
      window._aiBarLabel = 'Research: ' + tab;
      result = await callClaude(activeSys, prompts[tab], null, 3500);
    } catch(rateErr) {
      if (rateErr.message && rateErr.message.toLowerCase().indexOf('rate') !== -1) {
        var _retryEl = document.getElementById('research-enrich-msg');
        if (_retryEl) _retryEl.textContent = 'Rate limit on ' + tab + ' - retrying in 8s...';
        await new Promise(function(res){ setTimeout(res, 8000); });
        result = await callClaude(activeSys, prompts[tab], null, 3500);
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
      scheduleSave();
      _rTab = tab;  // ensure we re-render the tab that was just enriched
      renderResearchTabContent();
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