
function stopSchema() { schemaStopFlag = true; }

function initSchema() {
  document.getElementById('schema-progress').style.display = 'block';
  const next = S.pages.find(p => !(S.schema[p.slug]||{}).schema);
  if (next && !S.schemaExpandedSlug) S.schemaExpandedSlug = next.slug;
  renderSchemaQueue(); updateSchemaProgress(); checkSchemaAllDone();
}

const CMS_VARS = {
  webflow:   { title: '{{name}}', description: '{{summary}}', slug: '{{slug}}', image: '{{main-image.src}}', date: '{{published-on}}', author: '{{author-name}}' },
  wordpress: { title: '<?php the_title(); ?>', description: '<?php the_excerpt(); ?>', slug: '<?php echo get_post_field("post_name"); ?>', image: '<?php the_post_thumbnail_url(); ?>', date: '<?php the_date("c"); ?>', author: '<?php the_author(); ?>' },
  shopify:   { title: '{{ product.title }}', description: '{{ product.description }}', slug: '{{ product.handle }}', image: '{{ product.featured_image | img_url }}', date: '{{ product.created_at }}', author: '' },
  framer:    { title: '{title}', description: '{description}', slug: '{slug}', image: '{image}', date: '{date}', author: '{author}' },
  custom:    { title: '{{title}}', description: '{{description}}', slug: '{{slug}}', image: '{{image}}', date: '{{date}}', author: '{{author}}' },
};

const CMS_PAGE_TYPES = ['blog','article','portfolio','product','event','recipe'];

function buildSchemaPrompt(page) {
  const base = 'https://www.'+(S.setup.url||'example.com');
  const cms = S.setup?.cms || '';
  const isCmsPage = cms && CMS_PAGE_TYPES.includes(page.page_type);
  const vars = isCmsPage ? CMS_VARS[cms] : null;
  const r = S.research || {};
  let prompt = 'CLIENT: '+S.setup.client+'\nBASE URL: '+base+'\nPAGE: '+page.page_name+'\nURL: '+base+'/'+page.slug+'\nTYPE: '+page.page_type+'\nPRIMARY KW: '+page.primary_keyword+'\nSUPPORTING: '+(page.supporting_keywords||[]).join(', ')+'\nBREADCRUMB: Home > '+page.page_name;
  // Inject schema research fields
  if (r.schema_business_type) prompt += '\nBUSINESS TYPE: '+r.schema_business_type;
  if (r.schema_primary_category) prompt += '\nCATEGORY: '+r.schema_primary_category;
  if (r.schema_price_range) prompt += '\nPRICE RANGE: '+r.schema_price_range;
  if (r.schema_street_address) prompt += '\nADDRESS: '+r.schema_street_address+', '+(r.schema_city||'')+', '+(r.schema_region||'')+' '+(r.schema_postal_code||'')+', '+(r.schema_country||'');
  if ((r.social_profiles||[]).length) prompt += '\nSOCIAL: '+(r.social_profiles||[]).map(function(sp){ return (sp.platform||'')+': '+(sp.url||''); }).join(', ');
  if ((r.schema_payment_methods||[]).length) prompt += '\nPAYMENT: '+r.schema_payment_methods.join(', ');
  if (((r.current_faqs||r.faqs)||[]).length && page.page_type !== 'blog') prompt += '\nFAQs AVAILABLE: '+((r.current_faqs||r.faqs)||[]).slice(0,6).map(function(f){ return f.question; }).join(' | ');
  if ((r.reviews||[]).length) prompt += '\nREVIEWS: '+(r.reviews||[]).slice(0,3).map(function(rv){ return (rv.author_name||'')+'('+( rv.rating_value||'5')+'/5)'; }).join(', ');
  if (vars) {
    prompt += '\nCMS PLATFORM: '+cms.charAt(0).toUpperCase()+cms.slice(1);
    prompt += '\nCMS VARIABLES: This is a CMS template page. Use these platform variables in schema values instead of hardcoded text:';
    prompt += '\n  name/title: '+vars.title;
    prompt += '\n  description: '+vars.description;
    prompt += '\n  url slug: '+vars.slug;
    if (vars.image) prompt += '\n  image: '+vars.image;
    if (vars.date) prompt += '\n  date: '+vars.date;
    if (vars.author) prompt += '\n  author: '+vars.author;
    prompt += '\nIMPORTANT: Output ONE schema template that works for ALL items in this CMS collection. Use the variable tokens above wherever the value will change per item. The schema represents a template, not a specific page.';
  }
  return prompt;
}

async function runSchemaPage(slug) {
  const page = S.pages.find(p => p.slug === slug);
  if (!page || S.schemaRunning) return;
  S.schemaRunning = true; schemaStopFlag = false;
  S.schemaCurrentSlug = slug;
  S.schemaExpandedSlug = slug;
  renderSchemaQueue();
  try {
    const schema = await callClaude(P.schema, buildSchemaPrompt(page), null, 4000);
    if (!schemaStopFlag) {
      S.schema[slug] = {schema, page};
      // Parse meta title + description from schema HTML comment
      const _sIdx = S.pages.findIndex(pp => pp.slug === slug);
      if (_sIdx >= 0) {
        const _mT = schema.match(/<!--[\s\S]*?title[^:]*:[\s]*([^\n|<>]+)/i);
        const _mD = schema.match(/<!--[\s\S]*?meta description[^:]*:[\s]*([^\n|<>]+)/i);
        if (_mT && _mT[1].trim() && !S.pages[_sIdx].meta_title) S.pages[_sIdx].meta_title = _mT[1].trim().replace(/^["'`]|["'`]$/g,'').slice(0,70);
        if (_mD && _mD[1].trim() && !S.pages[_sIdx].meta_description) S.pages[_sIdx].meta_description = _mD[1].trim().replace(/^["'`]|["'`]$/g,'').slice(0,170);
      }
      scheduleSave();
      const curIdx = S.pages.findIndex(p => p.slug === slug);
      const next = S.pages.find((p,i) => i > curIdx && !(S.schema[p.slug]||{}).schema);
      S.schemaExpandedSlug = next ? next.slug : slug;
    }
  } catch(e) {
    S.schema[slug] = {error: e.message, page};
  }
  S.schemaCurrentSlug = null;
  S.schemaRunning = false;
  renderSchemaQueue(); updateSchemaProgress(); checkSchemaAllDone();
}

function toggleSchemaExpand(slug) {
  if (S.schemaRunning) return;
  S.schemaExpandedSlug = S.schemaExpandedSlug === slug ? null : slug;
  renderSchemaQueue();
}

function redoSchemaPage(slug) {
  delete S.schema[slug];
  S.schemaExpandedSlug = slug;
  scheduleSave(); updateSchemaProgress(); renderSchemaQueue(); checkSchemaAllDone();
}

function toggleSchemaCode(slug) {
  const el = document.getElementById('schema-code-'+slug);
  const btn = document.getElementById('schema-code-btn-'+slug);
  if (!el) return;
  if (el.style.display === 'none') { el.style.display = 'block'; btn.textContent = 'Hide code'; }
  else { el.style.display = 'none'; btn.textContent = 'Show code'; }
}

async function validateSchema(slug) {
  const r = S.schema[slug];
  const el = document.getElementById('schema-validate-'+slug);
  if (!r?.schema || !el) return;
  el.style.display = 'block';
  el.innerHTML = '<span style="font-size:11px;color:var(--n2)"><span class="spinner" style="width:10px;height:10px;display:inline-block;vertical-align:middle"></span> Validating with schema.org…</span>';
  // Extract JSON-LD blocks from schema output
  const jsonMatches = r.schema.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const jsonBlocks = jsonMatches.map(m => m.replace(/<script[^>]*>|<\/script>/gi,'').trim()).filter(Boolean);
  if (!jsonBlocks.length) {
    el.innerHTML = '<span style="font-size:11px;color:var(--warn)"><i class="ti ti-alert-triangle"></i> No JSON-LD blocks found in schema output.</span>';
    return;
  }
  const errors = [], warnings = [], types = [];
  for (const block of jsonBlocks) {
    try {
      const parsed = JSON.parse(block);
      const t = parsed['@type'];
      if (t) types.push(Array.isArray(t) ? t.join('+') : t);
      if (!parsed['@context']) errors.push('Missing @context in '+( t||'block'));
      if (!parsed['@type']) errors.push('Missing @type in block');
      if (!parsed['@id'] && !parsed.url) warnings.push((t||'block')+': no @id or url anchor');
      // Type-specific checks
      if (t === 'LocalBusiness' || t === 'Organization') {
        if (!parsed.name) errors.push(t+': missing name');
        if (!parsed.address) warnings.push(t+': missing address');
      }
      if (t === 'Service') {
        if (!parsed.name) errors.push('Service: missing name');
        if (!parsed.provider) warnings.push('Service: missing provider');
      }
      if (t === 'FAQPage') {
        const qa = parsed.mainEntity || [];
        if (!qa.length) errors.push('FAQPage: no mainEntity questions');
        else if (qa.length < 3) warnings.push('FAQPage: only '+qa.length+' questions (6+ recommended)');
      }
      if (t === 'BreadcrumbList') {
        if (!(parsed.itemListElement||[]).length) errors.push('BreadcrumbList: empty itemListElement');
      }
    } catch(e) {
      errors.push('Invalid JSON: '+e.message.slice(0,60));
    }
  }
  // Also open Google Rich Results Test in background tab
  const grrUrl = 'https://search.google.com/test/rich-results?url=' + encodeURIComponent('https://www.'+(S.setup?.url||''));
  let html = '';
  if (errors.length === 0 && warnings.length === 0) {
    html = '<div style="font-size:11px;color:var(--green);background:rgba(21,142,29,0.06);border:1px solid rgba(21,142,29,0.2);border-radius:5px;padding:7px 10px">';
    html += '<strong><i class="ti ti-check"></i> All checks passed</strong> — '+jsonBlocks.length+' block(s) valid. Types: '+types.join(', ')+'</div>';
  } else {
    html = '<div style="font-size:11px;background:var(--bg);border:1px solid var(--border);border-radius:5px;padding:8px 10px">';
    if (errors.length) html += '<div style="color:#E53935;font-weight:600;margin-bottom:4px"><i class="ti ti-x"></i> '+errors.length+' error(s)</div>'+errors.map(e=>'<div style="color:#E53935;margin-left:10px">• '+esc(e)+'</div>').join('');
    if (warnings.length) html += '<div style="color:var(--warn);font-weight:600;margin:4px 0 2px"><i class="ti ti-alert-triangle"></i> '+warnings.length+' warning(s)</div>'+warnings.map(w=>'<div style="color:var(--warn);margin-left:10px">• '+esc(w)+'</div>').join('');
    html += '<div style="color:var(--n2);margin-top:4px">Types found: '+esc(types.join(', ') || 'none')+'</div>';
    html += '</div>';
  }
  html += '<div style="margin-top:6px"><a href="'+grrUrl+'" target="_blank" style="font-size:10px;color:var(--green);text-decoration:none"><i class="ti ti-external-link" style="font-size:10px"></i> Open Google Rich Results Test</a></div>';
  el.innerHTML = html;
}

function renderSchemaQueue() {
  let html = '';
  S.pages.forEach((p, i) => {
    const r = S.schema[p.slug]||{};
    const isDone = !!r.schema, isErr = !!r.error;
    const isRunning = S.schemaCurrentSlug === p.slug;
    const isExpanded = S.schemaExpandedSlug === p.slug;
    const cirStyle = isDone?'background:var(--dark)':isErr?'background:var(--error)':isRunning?'background:var(--dark)':'background:var(--n1)';
    const cirContent = isDone?'&#10003;':isErr?'!':isRunning?'<span class="spinner" style="width:8px;height:8px;border-color:rgba(255,255,255,0.3);border-top-color:white"></span>':(i+1);
    const rowBorder = isExpanded?'border-color:var(--dark);':isDone?'border-color:rgba(0,0,0,0.18);':isErr?'border-color:rgba(229,57,53,0.22);':'';

    html += '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:6px;'+rowBorder+'">';

    // Header row
    html += '<div onclick="toggleSchemaExpand(\''+p.slug+'\')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;user-select:none">'
      +'<div class="status-circle" style="'+cirStyle+';font-size:9px;font-weight:500;flex-shrink:0">'+cirContent+'</div>'
      +'<div style="flex:1;min-width:0"><span style="font-size:13px;color:'+(isDone||isExpanded?'var(--dark)':'var(--n2)')+'">'+esc(p.page_name)+'</span>'
      +(isErr&&!isExpanded?'<span style="font-size:11px;color:var(--error);margin-left:8px">Error</span>':'')
      +'</div>'
      +'<i class="ti '+(isExpanded?'ti-chevron-up':'ti-chevron-down')+'" style="font-size:12px;color:var(--n2);flex-shrink:0"></i>'
      +'</div>';

    // Expanded body
    if (isExpanded) {
      html += '<div style="border-top:1px solid var(--border);padding:14px">';
      if (isRunning) {
        html += '<div style="display:flex;align-items:center;gap:8px;color:var(--n2);font-size:13px">'
          +'<span class="spinner" style="width:12px;height:12px"></span> Generating schema markup...</div>'
          +'<div style="margin-top:10px"><button class="btn btn-danger sm" onclick="stopSchema()"><i class="ti ti-player-stop"></i> Stop</button></div>';
      } else if (isDone) {
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
          +'<button class="btn btn-ghost sm" onclick="copyToClip2((S.schema[\''+p.slug+'\']||{}).schema)"><i class="ti ti-copy"></i> Copy Schema</button>'
          +'<button class="btn btn-ghost sm" id="schema-code-btn-'+p.slug+'" onclick="toggleSchemaCode(\''+p.slug+'\')">Show code</button>'
          +'<button class="btn btn-ghost sm" onclick="validateSchema(\''+p.slug+'\')"><i class="ti ti-shield-check"></i> Validate</button>'
          +'<button class="btn btn-danger sm" onclick="redoSchemaPage(\''+p.slug+'\')"><i class="ti ti-refresh"></i> Redo</button>'
          +'</div>'
          +'<div id="schema-validate-'+p.slug+'" style="display:none;margin-bottom:10px"></div>'
          +'<div id="schema-code-'+p.slug+'" style="display:none;max-height:280px;overflow:auto;font-family:monospace;font-size:11px;color:var(--n3);white-space:pre-wrap;line-height:1.65;background:var(--bg);border-radius:5px;padding:10px;border:1px solid var(--border)">'+esc(r.schema)+'</div>';
        const curIdx = S.pages.findIndex(pp => pp.slug === p.slug);
        const nextP = S.pages.find((pp,ii) => ii > curIdx && !(S.schema[pp.slug]||{}).schema);
        if (nextP) {
          html += '<div style="margin-top:10px;display:flex;gap:8px">'
            +'<button class="btn btn-dark sm" onclick="S.schemaExpandedSlug=\''+nextP.slug+'\';renderSchemaQueue();runSchemaPage(\''+nextP.slug+'\')"><i class="ti ti-arrow-right"></i> Next: '+esc(nextP.page_name)+'</button>'
            +'<button class="btn btn-ghost sm" onclick="goTo(\'export\')">Skip to Export</button>'
            +'</div>';
        }
      } else if (isErr) {
        html += '<div style="color:var(--error);font-size:12px;margin-bottom:8px">'+esc(r.error)+'</div>'
          +'<button class="btn btn-dark sm" onclick="runSchemaPage(\''+p.slug+'\')"><i class="ti ti-player-play"></i> Retry</button>';
      } else {
        html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
          +'<div style="font-size:12px;color:var(--n2)">'+esc(p.page_type||'page')+' · JSON-LD + meta + OG'+(S.setup?.cms && CMS_PAGE_TYPES.includes(p.page_type) ? ' · <span style="color:var(--green)">CMS vars ('+S.setup.cms+')</span>' : '')+'</div>'
          +'<button class="btn btn-dark sm" onclick="runSchemaPage(\''+p.slug+'\')"><i class="ti ti-code"></i> Generate Schema</button>'
          +'</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  });
  document.getElementById('schema-queue').innerHTML = html;
}

function updateSchemaProgress() {
  const done = S.pages.filter(p => (S.schema[p.slug]||{}).schema).length;
  const pct = S.pages.length > 0 ? Math.round(done/S.pages.length*100) : 0;
  document.getElementById('schema-count-label').textContent = done+'/'+S.pages.length+' pages complete';
  document.getElementById('schema-pct-label').textContent = pct+'%';
  document.getElementById('schema-progress-fill').style.width = pct+'%';
}

function checkSchemaAllDone() {
  const done = S.pages.filter(p => (S.schema[p.slug]||{}).schema).length;
  if (done === S.pages.length && done > 0) {
    document.getElementById('schema-done-label').textContent = 'All '+done+' pages complete';
    document.getElementById('schema-all-done').style.display = 'flex';
  } else { document.getElementById('schema-all-done').style.display = 'none'; }
}

// ── EXPORT ─────────────────────────────────────────────────────────
let exportCopySlug = null, exportSchemaSlug = null;

function renderSchemaTab() {
  const pages = S.pages.filter(p => S.schema[p.slug]?.schema);
  if (!pages.length) { document.getElementById('export-schema-tab').innerHTML = '<p style="color:var(--n2);font-size:13px">No schema generated yet.</p>'; return; }
  exportSchemaSlug = exportSchemaSlug || pages[0].slug;
  let html = '<div style="display:flex;gap:4px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px">';
  pages.forEach(p => { html += '<button class="tab-btn '+(exportSchemaSlug===p.slug?'active':'')+'" style="flex-shrink:0" onclick="switchExportSchema(\''+esc(p.slug)+'\',this)">'+esc(p.page_name)+'</button>'; });
  html += '</div>';
  html += '<div class="card"><div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn btn-ghost sm" onclick="copyToClip2(S.schema[exportSchemaSlug].schema)"><i class="ti ti-copy"></i> Copy Schema</button></div><div class="code-view" id="export-schema-view">'+esc(S.schema[exportSchemaSlug]?.schema||'')+'</div></div>';
  document.getElementById('export-schema-tab').innerHTML = html;
}

function switchExportSchema(slug, btn) {
  exportSchemaSlug = slug;
  document.querySelectorAll('#export-schema-tab .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('export-schema-view').textContent = S.schema[slug]?.schema||'';
}
