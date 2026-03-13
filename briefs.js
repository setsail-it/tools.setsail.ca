
function briefTogglePicker(pidx, type) {
  var pickerId = 'brief-'+type+'-picker-'+pidx;
  var el = document.getElementById(pickerId);
  if (!el) return;
  if (el.style.display !== 'none') {
    el.style.display = 'none';
    return;
  }
  var pool = type === 'kw' ? getBriefKwPool(pidx) : getBriefQPool(pidx);
  if (!pool.length) {
    el.innerHTML = '<div style="padding:6px 8px;font-size:9.5px;color:var(--n1);font-style:italic">'
      + (type==='kw' ? 'No unassigned keywords in research yet' : 'No unassigned questions in research yet')
      + '</div>';
    el.style.display = 'block';
    return;
  }
  var html = '<div style="position:absolute;left:0;right:0;top:auto;z-index:999;border:1px solid var(--border);border-radius:4px;margin-top:4px;background:white;box-shadow:0 6px 20px rgba(0,0,0,0.15);max-height:240px;overflow-y:auto">';
  // Search input
  html += '<div style="padding:5px 6px;border-bottom:1px solid var(--border);position:sticky;top:0;background:white;z-index:1">';
  html += '<input id="brief-'+type+'-search-'+pidx+'" data-pidx="'+pidx+'" data-type="'+type+'" placeholder="Filter…" class="brief-picker-search" style="width:100%;font-size:10px;border:1px solid var(--border);border-radius:3px;padding:3px 7px;font-family:var(--font);outline:none;box-sizing:border-box">';
  html += '</div>';
  // Items
  html += '<div id="brief-'+type+'-pickerlist-'+pidx+'">';
  pool.forEach(function(item, i) {
    var esc_item = item.replace(/'/g,'&#39;').replace(/"/g,'&quot;');
    html += '<div class="brief-pick-item" data-pidx="'+pidx+'" data-type="'+type+'" data-val="'+esc_item+'" '
      + 'onclick="briefPickItem(this)" '
      + 'style="padding:5px 10px;font-size:10px;color:var(--n3);cursor:pointer;border-bottom:1px solid rgba(0,0,0,0.04);'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .1s">'
      + esc_item + '</div>';
  });
  html += '</div>';
  // Footer
  html += '<div style="padding:5px 8px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:white;position:sticky;bottom:0">';
  html += '<span id="brief-'+type+'-selcount-'+pidx+'" style="font-size:9.5px;color:var(--n2)">0 selected</span>';
  html += '<button class="brief-add-selected-btn" data-pidx="'+pidx+'" data-type="'+type+'" style="background:var(--dark);color:white;border:none;border-radius:3px;padding:3px 10px;font-size:10px;font-weight:600;cursor:pointer;font-family:var(--font)">Add Selected</button>';
  html += '</div>';
  html += '</div>';
  el.innerHTML = html;
  el.style.display = 'block';
  // Auto-focus search
  setTimeout(function(){ var s = document.getElementById('brief-'+type+'-search-'+pidx); if(s) s.focus(); }, 50);
}

function briefPickItem(el) {
  var pidx = el.dataset.pidx;
  var type = el.dataset.type;
  if (el.dataset.sel) {
    delete el.dataset.sel;
    el.style.background = '';
    el.style.fontWeight = '';
    el.style.color = 'var(--n3)';
  } else {
    el.dataset.sel = '1';
    el.style.background = 'var(--lime)';
    el.style.fontWeight = '600';
    el.style.color = 'var(--dark)';
  }
  // Update count
  var list = document.getElementById('brief-'+type+'-pickerlist-'+pidx);
  var count = list ? list.querySelectorAll('[data-sel]').length : 0;
  var cEl = document.getElementById('brief-'+type+'-selcount-'+pidx);
  if (cEl) cEl.textContent = count + ' selected';
}

function briefFilterPicker(pidx, type) {
  var input = document.getElementById('brief-'+type+'-search-'+pidx);
  var list  = document.getElementById('brief-'+type+'-pickerlist-'+pidx);
  if (!input || !list) return;
  var q = input.value.toLowerCase();
  list.querySelectorAll('.brief-pick-item').forEach(function(el) {
    el.style.display = el.dataset.val.toLowerCase().includes(q) ? '' : 'none';
  });
}

function briefAddSelected(pidx, type) {
  var list = document.getElementById('brief-'+type+'-pickerlist-'+pidx);
  if (!list) return;
  var p = S.pages[pidx];
  if (!p) return;
  var selected = Array.from(list.querySelectorAll('[data-sel]')).map(function(el){ return el.dataset.val; });
  if (!selected.length) return;
  if (type === 'kw') {
    if (!p.supporting_keywords) p.supporting_keywords = [];
    var existing = p.supporting_keywords.map(function(k){ return (typeof k==='object'?(k.kw||''):String(k)).toLowerCase(); });
    selected.forEach(function(kw){ if(!existing.includes(kw.toLowerCase())) p.supporting_keywords.push(kw); });
  } else {
    if (!p.assignedQuestions) p.assignedQuestions = [];
    var existingQ = p.assignedQuestions.map(function(q){ return q.toLowerCase(); });
    selected.forEach(function(q){ if(!existingQ.includes(q.toLowerCase())) p.assignedQuestions.push(q); });
  }
  scheduleSave();
  renderBriefs();
}

// ── BRIEF CARD EDITING HELPERS ──────────────────────────────────────

// Build <datalist> HTML for kw and question pickers
function buildKwDatalist(pidx) {
  var pool = getBriefKwPool(pidx);
  if (!pool.length) return '';
  return '<datalist id="brief-kw-list-'+pidx+'">'
    + pool.map(function(k){ return '<option value="'+k.replace(/"/g,'&quot;')+'">'; }).join('')
    + '</datalist>';
}

function buildQDatalist(pidx) {
  var pool = getBriefQPool(pidx);
  if (!pool.length) return '';
  return '<datalist id="brief-q-list-'+pidx+'">'
    + pool.map(function(q){ return '<option value="'+q.replace(/"/g,'&quot;')+'">'; }).join('')
    + '</datalist>';
}

// Pool of all researched keywords not already on this page
function getBriefKwPool(pageIdx) {
  var p = S.pages[pageIdx] || {};
  var assigned = new Set();
  if (p.primary_keyword) assigned.add(p.primary_keyword.toLowerCase());
  (p.supporting_keywords||[]).forEach(function(k){
    var kw = typeof k==='object'?(k.kw||''):String(k);
    assigned.add(kw.toLowerCase());
  });
  var pool = [];
  var seen = new Set();
  // From clusters
  ((S.kwResearch&&S.kwResearch.clusters)||[]).forEach(function(c){
    (c.supportingKws||[]).forEach(function(sk){
      var kw = typeof sk==='object'?(sk.kw||''):String(sk);
      if (kw && !assigned.has(kw.toLowerCase()) && !seen.has(kw.toLowerCase())) {
        seen.add(kw.toLowerCase());
        pool.push(kw);
      }
    });
    if (c.primaryKw) {
      var pk = typeof c.primaryKw==='object'?(c.primaryKw.kw||''):String(c.primaryKw);
      if (pk && !assigned.has(pk.toLowerCase()) && !seen.has(pk.toLowerCase())) {
        seen.add(pk.toLowerCase()); pool.push(pk);
      }
    }
  });
  // From seeds
  ((S.kwResearch&&S.kwResearch.seeds)||[]).forEach(function(s){
    var kw = typeof s==='object'?(s.kw||s.keyword||''):String(s);
    if (kw && !assigned.has(kw.toLowerCase()) && !seen.has(kw.toLowerCase())) {
      seen.add(kw.toLowerCase()); pool.push(kw);
    }
  });
  return pool.sort();
}

// Pool of all researched questions not already on this page
function getBriefQPool(pageIdx) {
  var p = S.pages[pageIdx] || {};
  var assigned = new Set((p.assignedQuestions||[]).map(function(q){ return q.toLowerCase(); }));
  var pool = [];
  var seen = new Set();
  ((S.contentIntel&&S.contentIntel.paa&&S.contentIntel.paa.questions)||[]).forEach(function(qObj){
    var q = typeof qObj==='object'?(qObj.question||''):String(qObj);
    if (q && !assigned.has(q.toLowerCase()) && !seen.has(q.toLowerCase())) {
      seen.add(q.toLowerCase()); pool.push(q);
    }
  });
  return pool;
}

// ── BRIEF CARD EDITING HELPERS ──────────────────────────────────────
function briefSaveText(pageIdx, val) {
  var p = S.pages[pageIdx];
  if (!p || !p.brief) return;
  p.brief.summary = val;
  scheduleSave();
}

function briefAddKw(pageIdx) {
  var input = document.getElementById('brief-kw-input-'+pageIdx);
  if (!input) return;
  var val = input.value.trim();
  if (!val) return;
  var p = S.pages[pageIdx];
  if (!p) return;
  if (!p.supporting_keywords) p.supporting_keywords = [];
  // Avoid duplicates
  var existing = p.supporting_keywords.map(function(k){ return typeof k==='object'?(k.kw||''):k; });
  if (!existing.includes(val)) p.supporting_keywords.push(val);
  input.value = '';
  scheduleSave();
  renderBriefs();
}

function briefRemoveKw(pageIdx, kwIdx) {
  var p = S.pages[pageIdx];
  if (!p || !p.supporting_keywords) return;
  p.supporting_keywords.splice(kwIdx, 1);
  scheduleSave();
  renderBriefs();
}

function briefAddQ(pageIdx) {
  var input = document.getElementById('brief-q-input-'+pageIdx);
  if (!input) return;
  var val = input.value.trim();
  if (!val) return;
  var p = S.pages[pageIdx];
  if (!p) return;
  if (!p.assignedQuestions) p.assignedQuestions = [];
  if (!p.assignedQuestions.includes(val)) p.assignedQuestions.push(val);
  input.value = '';
  scheduleSave();
  renderBriefs();
}

function briefRemoveQ(pageIdx, qIdx) {
  var p = S.pages[pageIdx];
  if (!p || !p.assignedQuestions) return;
  p.assignedQuestions.splice(qIdx, 1);
  scheduleSave();
  renderBriefs();
}


// ── BRIEF QUALITY SCORECARD ───────────────────────────────────────
function briefToggleApprove(pidx) {
  var p = S.pages[pidx];
  if (!p || !p.brief || !p.brief.generated) return;
  p.brief.approved = !p.brief.approved;
  if (p.brief.approved) p.brief.approvedAt = Date.now();
  else delete p.brief.approvedAt;
  scheduleSave();
  renderBriefs();
}

async function scoreBrief(pageIdx) {
  var p = S.pages[pageIdx];
  if (!p || !p.brief || !p.brief.summary) return;

  var scoreEl = document.getElementById('brief-score-'+pageIdx);
  if (scoreEl) {
    scoreEl.innerHTML = '<span style="font-size:9.5px;color:var(--n2);display:flex;align-items:center;gap:6px">'
      + '<span class="spinner" style="width:10px;height:10px"></span> Evaluating brief…</span>';
  }

  var pt = (p.page_type||'service').toLowerCase();
  var isService = /^(service|location|industry)$/.test(pt);
  var isBlog = /^(blog|faq|resource)$/.test(pt);

  // Build checklist based on page type
  var checks = isService ? [
    { id:'reader',   label:'Reader profile'   },
    { id:'angle',    label:'Unique angle'      },
    { id:'h1',       label:'H1 + title tag'   },
    { id:'cta',      label:'CTA defined'       },
    { id:'objection',label:'Objection named'  },
    { id:'trust',    label:'Trust signals'     },
    { id:'h2s',      label:'5+ H2 sections'   },
    { id:'kws',      label:'Keyword guidance'  },
    { id:'links',    label:'Internal links'    },
    { id:'eeat',     label:'E-E-A-T inputs'    },
    { id:'wordcount',label:'Word count'        },
  ] : isBlog ? [
    { id:'reader',   label:'Reader profile'   },
    { id:'angle',    label:'Unique angle'      },
    { id:'headlines',label:'Headline options'  },
    { id:'h2s',      label:'6+ H2 sections'   },
    { id:'intro',    label:'Intro brief'       },
    { id:'eeat',     label:'E-E-A-T inputs'    },
    { id:'backlink', label:'Backlink hook'     },
    { id:'faq',      label:'FAQ spine'         },
    { id:'links',    label:'Internal links'    },
    { id:'wordcount',label:'Word count'        },
  ] : [
    { id:'purpose',  label:'Page purpose'     },
    { id:'voice',    label:'Brand voice'      },
    { id:'h1',       label:'H1 above-fold'    },
    { id:'h2s',      label:'Sections listed'  },
    { id:'trust',    label:'Trust signals'    },
    { id:'cta',      label:'CTA defined'      },
    { id:'wordcount',label:'Word count'       },
  ];

  // Add SERP-aware checks if serpIntel data exists
  var serpContext = '';
  if (p.serpIntel && p.serpIntel.directives) {
    var siD = p.serpIntel.directives;
    checks.push({ id:'serp_wordcount', label:'Word count meets SERP target ('+siD.word_count_target+' words)' });
    checks.push({ id:'serp_h2_gaps',   label:'H2s cover competitor topic gaps' });
    serpContext = '\n\n## SERP INTEL CONTEXT\n'
      + 'Word count target: '+siD.word_count_target+' words (competitor calibrated)\n'
      + 'Avg competitor density: '+siD.avg_kw_density+'%\n'
      + 'Key H2 topics competitors cover: '+((siD.all_competitor_h2s||[]).slice(0,15).join(', '))+'\n'
      + 'For serp_wordcount: pass ONLY if the brief word count target >= '+siD.word_count_target+'.\n'
      + 'For serp_h2_gaps: pass if the brief H2 skeleton covers at least 3 topics from the competitor H2 list above.';
  }

  var checkList = checks.map(function(c){ return '- '+c.id+': '+c.label; }).join('\n');

  var prompt = 'You are evaluating a content brief for completeness and quality.\n\n'
    + '## BRIEF TO EVALUATE\n'+p.brief.summary+'\n\n'
    + '## PAGE\n'
    + 'Type: '+p.page_type+' | Primary keyword: '+(p.primary_keyword||'none')+'\n\n'
     + serpContext
    + '\n## CHECKS\\nFor each check below, return pass:true  or pass:false plus a one-line note (max 8 words).\n\n'
    + checkList+'\n\n'
    + 'Return raw JSON only — no markdown:\n'
    + '{"checks":[{"id":"reader","pass":true,"note":"Specific ICP defined with pain point"},...]}\n\n'
    + 'Be strict. A vague mention does not count as a pass. The brief must contain real, specific content for each check.';

  try {
    var result = await callClaude(
      'You are a strict content brief evaluator. Return raw JSON only, no markdown.',
      prompt,
      null,
      800
    );
    var clean = result.replace(/```json\s*/g,'').replace(/```/g,'').trim();
    var parsed = JSON.parse(clean);
    // Merge pass/note back onto our check definitions
    var checkMap = {};
    (parsed.checks||[]).forEach(function(c){ checkMap[c.id] = c; });
    var finalChecks = checks.map(function(c){
      var r = checkMap[c.id] || {};
      return { label: c.label, pass: !!r.pass, note: r.note||'' };
    });
    var passed = finalChecks.filter(function(c){ return c.pass; }).length;
    var _scoreObj = { checks: finalChecks, passed: passed, total: finalChecks.length, scoredAt: Date.now() };
    p.brief.score = _scoreObj;
    // Save score back to the active draft too
    if (p.brief.drafts && p.brief.drafts.length > 0) {
      var _ai = p.brief.activeDraft || 0;
      if (p.brief.drafts[_ai]) p.brief.drafts[_ai].score = _scoreObj;
    }
    scheduleSave();
    // Re-render just the score bar
    var pct = Math.round((passed / finalChecks.length) * 100);
    var barClr = pct >= 80 ? 'var(--green)' : pct >= 55 ? 'var(--warn)' : '#e5534b';
    if (scoreEl) {
      scoreEl.innerHTML = '<div style="display:flex;align-items:center;gap:6px;flex:none">'
        + '<div style="width:80px;height:6px;background:rgba(0,0,0,0.08);border-radius:3px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+barClr+';border-radius:3px"></div></div>'
        + '<span style="font-size:10px;font-weight:700;color:'+barClr+'">'+pct+'%</span>'
        + '<span style="font-size:9.5px;color:var(--n2)">brief quality</span>'
        + '</div>'
        + finalChecks.map(function(c){
            var icon = c.pass ? '✓' : '✗';
            var clr = c.pass ? 'var(--green)' : '#e5534b';
            return '<span title="'+esc(c.note)+'" style="display:inline-flex;align-items:center;gap:2px;font-size:9px;color:'+clr+';padding:1px 5px;border:1px solid '+clr+';border-radius:3px;opacity:0.85;cursor:default">'+icon+' '+esc(c.label)+'</span>';
          }).join('')
        + _briefVersionPills(p, pidx)
        + '<button onclick="scoreBrief('+pageIdx+')" style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:3px;padding:2px 7px;font-size:9px;color:var(--n2);cursor:pointer;font-family:var(--font)">Re-evaluate</button>';
    }
  } catch(e) {
    if (scoreEl) scoreEl.innerHTML = '<span style="font-size:9.5px;color:#e5534b">Evaluation failed — '+esc(e.message)+'</span>';
  }
}


// ── BRIEF VERSIONING ─────────────────────────────────────────────────────────

function _briefVersionPills(p, pidx) {
  var drafts = p.brief && p.brief.drafts;
  if (!drafts || drafts.length < 2) return '';
  var activeDraft = p.brief.activeDraft || 0;
  var pills = drafts.map(function(d, i) {
    var isActive = i === activeDraft;
    var hasPassed = d.score && d.score.passed != null;
    var pct = hasPassed ? Math.round((d.score.passed / d.score.total) * 100) : null;
    var label = 'V' + d.v + (pct !== null ? ' · ' + pct + '%' : '');
    var bg = isActive ? 'var(--dark)' : 'transparent';
    var clr = isActive ? 'var(--white)' : 'var(--n2)';
    var border = isActive ? 'var(--dark)' : 'var(--border)';
    return '<button onclick="switchBriefDraft(' + pidx + ',' + i + ')" style="font-size:9px;padding:2px 7px;border-radius:3px;border:1px solid ' + border + ';background:' + bg + ';color:' + clr + ';cursor:pointer;font-family:var(--font);font-weight:' + (isActive?'600':'400') + '">' + label + '</button>';
  }).join('');
  return '<div style="display:flex;gap:4px;align-items:center;margin-left:8px">' + pills + '</div>';
}

function switchBriefDraft(pidx, draftIdx) {
  var p = S.pages[pidx];
  if (!p || !p.brief || !p.brief.drafts) return;
  var draft = p.brief.drafts[draftIdx];
  if (!draft) return;
  p.brief.activeDraft = draftIdx;
  p.brief.summary = draft.summary;
  p.brief.score = draft.score || null;
  scheduleSave();
  renderBriefs();
}

async function generateBriefV2(pageIdx) {
  var p = S.pages[pageIdx];
  if (!p || !p.brief || !p.brief.summary) return;
  // Mark as new version run — generatePageBrief will push a new draft
  p.brief._requestNewVersion = true;
  await generatePageBrief(pageIdx);
}

// ── PER-PAGE ENRICHMENT ACTIONS ──────────────────────────────────────────────
// These call the same endpoints as the global buttons in the toolbar but scoped
// to a single page. Buttons live in the per-card action bar (rightCol top).

async function briefPageNicheExpand(pidx) {
  var p = S.pages[pidx];
  if (!p || !p.primary_keyword) { alert('No primary keyword on this page.'); return; }
  var btn = document.getElementById('brief-niche-btn-'+pidx);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Expanding...'; }
  try {
    var country = (S.kwResearch && S.kwResearch.country) || 'CA';
    var res = await fetch('/api/niche-expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pages: [{ slug: p.slug, primaryKeyword: p.primary_keyword, supportingKws: (p.supporting_keywords||[]).map(function(k){ return typeof k==='object'?k.kw:k; }) }],
        country: country
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Expand failed');
    if (!S.kwResearch) S.kwResearch = {};
    if (!S.kwResearch.keywords) S.kwResearch.keywords = [];
    var existing = new Set(S.kwResearch.keywords.map(function(k){ return (k.kw||'').toLowerCase(); }));
    var added = 0;
    (data.results[0] && data.results[0].keywords || []).forEach(function(k) {
      if (!k.kw || existing.has(k.kw.toLowerCase())) return;
      S.kwResearch.keywords.push({ kw: k.kw, vol: k.vol, kd: k.kd, score: (k.vol||0)*0.5+20, source: 'niche:'+p.slug });
      existing.add(k.kw.toLowerCase());
      added++;
    });
    scheduleSave();
    if (btn) { btn.disabled = false; btn.innerHTML = '✓ '+added+' added'; }
    setTimeout(function(){ if (btn) { btn.disabled = false; btn.innerHTML = '⌖ Niche KW'; } }, 3000);
  } catch(e) {
    console.error('[brief-niche-expand]', e);
    if (btn) { btn.disabled = false; btn.innerHTML = '⌖ Niche KW'; }
    alert('Niche expand failed: '+e.message);
  }
}

async function briefPageQuestions(pidx) {
  var p = S.pages[pidx];
  if (!p || !p.primary_keyword) { alert('No primary keyword on this page.'); return; }
  var btn = document.getElementById('brief-quest-btn-'+pidx);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Generating...'; }
  try {
    var R = S.research || {};
    var siteContext = (R.company_name||'') + ' — ' + (R.primary_services||[]).join(', ') + '. Location: ' + (R.location||'') + '. USP: ' + (R.usp||'');
    var res = await fetch('/api/page-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pages: [{ slug: p.slug, pageType: p.page_type, primaryKeyword: p.primary_keyword, supportingKws: (p.supporting_keywords||[]).map(function(k){ return typeof k==='object'?k.kw:k; }).slice(0,5) }],
        siteContext: siteContext
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Questions failed');
    var added = 0;
    (data.results[0] && data.results[0].questions || []).forEach(function(q) {
      p.pageQuestions = p.pageQuestions || [];
      if (!p.pageQuestions.includes(q)) p.pageQuestions.push(q);
      p.assignedQuestions = p.assignedQuestions || [];
      if (!p.assignedQuestions.includes(q)) { p.assignedQuestions.push(q); added++; }
    });
    scheduleSave();
    renderBriefs();
    if (btn) { btn.disabled = false; btn.innerHTML = '✓ '+added+' added'; }
    setTimeout(function(){ if (btn) { btn.disabled = false; btn.innerHTML = '? Questions'; } }, 3000);
  } catch(e) {
    console.error('[brief-page-questions]', e);
    if (btn) { btn.disabled = false; btn.innerHTML = '? Questions'; }
    alert('Page questions failed: '+e.message);
  }
}

async function briefPageAssign(pidx) {
  var p = S.pages[pidx];
  if (!p) return;
  var btn = document.getElementById('brief-assign-btn-'+pidx);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span> Assigning...'; }
  try {
    var usedPrimaries = new Set((S.pages||[]).map(function(pg){ return (pg.primary_keyword||'').toLowerCase().trim(); }));

    // Current state — passed to Claude so it can keep, drop, or replace
    var currentKws = (p.supporting_keywords||[]).map(function(k){ return typeof k==='object'?k.kw:k; }).filter(Boolean);
    var currentQs  = (p.assignedQuestions||[]).filter(Boolean);

    // Full keyword pool (include currently assigned so Claude can re-evaluate them too)
    var poolKws = (S.kwResearch&&S.kwResearch.keywords||[])
      .filter(function(k){ return k.vol >= 10 && !usedPrimaries.has((k.kw||'').toLowerCase().trim()); })
      .sort(function(a,b){ return (b.score||0)-(a.score||0); })
      .slice(0,100)
      .map(function(k){ return k.kw+'|'+k.vol+'/mo|KD:'+k.kd; });

    // Full question pool (include currently assigned so Claude can re-evaluate them too)
    var poolQs = [];
    if (S.contentIntel && S.contentIntel.paa && S.contentIntel.paa.questions) {
      S.contentIntel.paa.questions.forEach(function(q){ if (q.question) poolQs.push(q.question); });
    }
    // Also include pageQuestions in pool so they survive the re-evaluation
    (p.pageQuestions||[]).forEach(function(q){ if (!poolQs.includes(q)) poolQs.push(q); });

    var nicheKws = (S.kwResearch&&S.kwResearch.keywords||[])
      .filter(function(k){ return (k.source||'').includes(p.slug); })
      .slice(0,10).map(function(k){ return k.kw; }).join(', ');

    var R2 = S.research || {};
    var prompt = '## PAGE\n/'+p.slug+' | '+p.page_type+' | primary: '+(p.primary_keyword||'none')+(nicheKws?' | niche_kws: '+nicheKws:'')
      + '\n\n## CURRENTLY ASSIGNED KEYWORDS\n'+(currentKws.length ? currentKws.join('\n') : 'none')
      + '\n\n## CURRENTLY ASSIGNED QUESTIONS\n'+(currentQs.length ? currentQs.map(function(q,i){ return (i+1)+'. '+q; }).join('\n') : 'none')
      + '\n\n## KEYWORD POOL (keyword|vol|KD)\n'+(poolKws.join('\n')||'none')
      + '\n\n## QUESTION POOL (People Also Ask + page questions)\n'+(poolQs.map(function(q,i){ return (i+1)+'. '+q; }).join('\n')||'none')
      + '\n\n## TASK\nReturn the complete final set for this page — not just additions.\n'
      + 'For keywords: review what is currently assigned. Keep keywords that genuinely match this page\'s search intent. Drop any that are off-topic, too broad, or better suited to another page type. Replace dropped ones with better fits from the pool. Final list: 3-8 keywords.\n'
      + 'For questions: review what is currently assigned. Keep questions a visitor to THIS page would actually ask. Drop any that are generic, irrelevant, or better answered elsewhere. Replace with better fits from the pool. Final list: 4-8 questions.\n'
      + '\nReturn JSON only — the full final lists, not a diff:\n'
      + '[{"slug":"'+p.slug+'","final_keywords":["kw1","kw2",...],"final_questions":["Q1?","Q2?",...],"removed_keywords":["dropped1",...],"removed_questions":["dropped Q?",...]}]';

    var sys = 'You are a senior SEO strategist. Your job is to curate the keyword and question set for a single page — not just add to it. Be ruthless about intent match: a keyword or question that doesn\'t belong on this specific page type hurts the brief. Client: '+(R2.client_name||'')+' | Industry: '+(R2.industry||'')+' | Services: '+((R2.primary_services||[]).join(', ')||'')+'. Return raw JSON array only — no markdown, no preamble.';

    var result = await callClaude(sys, prompt, null, 2000);
    function fixT(s){ return s.replace(/,\s*([\]\}])/g,'$1'); }
    var parsed = null;
    try { parsed = JSON.parse(fixT(result.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim())); } catch(e){}
    if (!parsed) { var s=result.indexOf('['),en=result.lastIndexOf(']'); if(s>=0&&en>s) try{parsed=JSON.parse(fixT(result.slice(s,en+1)));}catch(e2){} }
    if (!parsed || !Array.isArray(parsed) || !parsed[0]) throw new Error('Parse error — check console');
    var asgn = parsed[0];

    // Replace (not merge) — this is a full curation pass
    if (asgn.final_keywords && Array.isArray(asgn.final_keywords)) {
      p.supporting_keywords = asgn.final_keywords.map(function(kw) {
        var kwObj = (S.kwResearch&&S.kwResearch.keywords||[]).find(function(k){ return (k.kw||'').toLowerCase()===kw.toLowerCase(); });
        return kwObj ? { kw: kwObj.kw, vol: kwObj.vol, kd: kwObj.kd } : { kw: kw, vol: 0, kd: 0 };
      });
    }
    if (asgn.final_questions && Array.isArray(asgn.final_questions)) {
      p.assignedQuestions = asgn.final_questions;
    }

    // Log removals to console for visibility
    if ((asgn.removed_keywords||[]).length || (asgn.removed_questions||[]).length) {
      console.log('[brief-assign] Removed keywords:', asgn.removed_keywords||[]);
      console.log('[brief-assign] Removed questions:', asgn.removed_questions||[]);
    }

    scheduleSave();
    renderBriefs();
    var removedCount = (asgn.removed_keywords||[]).length + (asgn.removed_questions||[]).length;
    if (btn) { btn.disabled = false; btn.innerHTML = '✓ Curated' + (removedCount ? ' ('+removedCount+' removed)' : ''); }
    setTimeout(function(){ if (btn) { btn.disabled = false; btn.innerHTML = '✦ Assign'; } }, 4000);
  } catch(e) {
    console.error('[brief-page-assign]', e);
    if (btn) { btn.disabled = false; btn.innerHTML = '✦ Assign'; }
    alert('Assign failed: '+e.message);
  }
}

function initBriefs() {
  renderBriefs();
  // Enter key delegation for kw + question inputs
  if (!window._briefInputsListening) {
    window._briefInputsListening = true;
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      var t = e.target;
      if (t.classList.contains('brief-kw-input')) { e.preventDefault(); briefAddKw(parseInt(t.dataset.pidx)); }
      if (t.classList.contains('brief-q-input'))  { e.preventDefault(); briefAddQ(parseInt(t.dataset.pidx)); }
    });
    document.addEventListener('input', function(e) {
      var t = e.target;
      if (t.classList.contains('brief-picker-search')) {
        briefFilterPicker(parseInt(t.dataset.pidx), t.dataset.type);
      }
      if (t.classList.contains('brief-ta')) {
        t.style.height = 'auto';
        t.style.height = t.scrollHeight + 'px';
      }
    });
    document.addEventListener('blur', function(e) {
      var t = e.target;
      if (t.classList.contains('brief-ta')) {
        briefSaveText(parseInt(t.dataset.pidx), t.value);
      }
    }, true);
    document.addEventListener('click', function(e) {
      var t = e.target.closest('.brief-add-selected-btn');
      if (t) { briefAddSelected(parseInt(t.dataset.pidx), t.dataset.type); return; }
      var tog = e.target.closest('.brief-toggle-picker-btn');
      if (tog) { briefTogglePicker(parseInt(tog.dataset.pidx), tog.dataset.type); return; }
      // Close any open pickers when clicking outside
      if (!e.target.closest('[id^="brief-kw-picker-"]') && !e.target.closest('[id^="brief-q-picker-"]')) {
        document.querySelectorAll('[id^="brief-kw-picker-"],[id^="brief-q-picker-"]').forEach(function(el){
          el.style.display = 'none';
        });
      }
    });
  }
}

function renderBriefs() {
  var el = document.getElementById('briefs-results');
  if (!el) { console.error('[renderBriefs] briefs-results not found'); return; }
  console.log('[renderBriefs] S.pages:', S.pages ? S.pages.length : 'null/undefined');
  if (!S.pages || !S.pages.length) {
    el.innerHTML = '<div style="padding:60px 40px;text-align:center">'
      + '<div style="font-size:32px;margin-bottom:12px">📋</div>'
      + '<div style="font-size:16px;font-weight:600;color:var(--dark);margin-bottom:6px">No sitemap built yet</div>'
      + '<div style="font-size:13px;color:var(--n2);margin-bottom:20px">Go to Stage 5 and build your sitemap from keyword clusters first.<br>Once approved, come back here to generate page briefs.</div>'
      + '<button onclick="goToSitemap()" style="background:var(--lime);border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font)">→ Go to Sitemap</button>'
      + '</div>';
    return;
  }
  var seoPages, briefed, hasQs, hasKws;
  try {
    seoPages = S.pages.filter(function(p){ return p && p.page_type !== 'utility'; });
    briefed  = seoPages.filter(function(p){ return p.brief && p.brief.generated; }).length;
    hasQs    = seoPages.filter(function(p){ return (p.assignedQuestions||[]).length > 0; }).length;
    hasKws   = seoPages.filter(function(p){ return (p.supporting_keywords||[]).length > 0; }).length;
    console.log('[renderBriefs] seoPages:', seoPages.length, 'briefed:', briefed);
  } catch(initErr) {
    el.innerHTML = '<div style="padding:20px;color:#e5534b;font-family:monospace;font-size:12px">Briefs init error: '+initErr.message+'</div>';
    console.error('[renderBriefs] init error', initErr);
    return;
  }
  if (!seoPages || !seoPages.length) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--n2);font-size:13px">No SEO pages found — check your sitemap includes service, blog, or location pages.</div>';
    return;
  }

  var html = '';

  // Step banner
  var _step = (!hasQs && !hasKws) ? 1 : !briefed ? 2 : 3;
  var _bannerTxt = _step === 1
    ? '<b>Step 1:</b> Click <b>AI Assign Keywords + Questions</b> — Claude distributes all remaining keywords and PAQs across your pages in one pass.'
    : _step === 2
    ? '<b>Step 2:</b> Assignments done. Click <b>Generate Brief</b> on each page to write the content brief.'
    : '<b>Step 3:</b> Briefs written. Review them, then <b>Approve &amp; Go to Copy</b>.';
  html += '<div style="background:rgba(21,142,29,0.06);border:1px solid rgba(21,142,29,0.2);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:var(--n3);display:flex;align-items:center;gap:10px">'
    + '<span style="background:var(--green);color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;white-space:nowrap">Step '+_step+' of 3</span>'
    + _bannerTxt + '</div>';

  var approved = seoPages.filter(function(p){ return p.brief && p.brief.approved; }).length;
  html += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;align-items:center">';
  html += '<span style="background:var(--dark);color:white;font-size:11px;padding:3px 10px;border-radius:4px">'+seoPages.length+' pages</span>';
  html += '<span class="chip">'+hasKws+' with keywords</span>';
  html += '<span class="chip">'+hasQs+' with questions</span>';
  html += '<span class="chip '+(briefed===seoPages.length&&briefed>0?'green':'')+'">'+briefed+'/'+seoPages.length+' briefed</span>';
  html += '<span id="briefs-approved-chip" class="chip '+(approved>0?'green':'')+'">'+approved+'/'+seoPages.length+' approved</span>';
  var _canGo = approved > 0;
  html += '<button onclick="if('+approved+'>0)goTo(\'copy\')" style="margin-left:auto;background:'+(_canGo?'var(--lime)':'var(--n1)')+';border:none;padding:6px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:'+(_canGo?'pointer':'not-allowed')+';font-family:var(--font);color:var(--dark);opacity:'+(_canGo?'1':'0.5')+'" title="'+(_canGo?'Go to Copy stage':'Approve at least one brief first')+'">Approve &amp; Go to Copy →</button>';
  html += '</div>';

  function pageCard(p, pidx) {
    var isBriefed = p.brief && (p.brief.generated || p.brief.summary);
    var isApproved = !!(p.brief && p.brief.approved);
    var trafficStr = p.existing_traffic > 0
      ? (p.existing_traffic >= 1000 ? (p.existing_traffic/1000).toFixed(1)+'k' : p.existing_traffic)+'/mo'
      : '';
    var paqCount = (p.assignedQuestions||[]).length;
    var actionBadge = p.action === 'improve_existing'
      ? '<span style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:3px;font-size:9px;padding:1px 5px;color:#3b82f6;font-weight:500">IMPROVE</span>'
      : '<span style="background:rgba(21,142,29,0.08);border:1px solid rgba(21,142,29,0.3);border-radius:3px;font-size:9px;padding:1px 5px;color:var(--green);font-weight:500">BUILD NEW</span>';
    var priBadge = '<span style="background:rgba(0,0,0,0.05);border-radius:3px;font-size:9px;padding:1px 5px;color:var(--n2)">'+(p.priority||'P3')+'</span>';

    // Normalise supporting_keywords — may be objects {kw,vol,kd} or plain strings
    var addlKws = (p.supporting_keywords||[]).map(function(k){ return typeof k==='object'?(k.kw||''):String(k); }).filter(Boolean);
    var assignedQs = (p.assignedQuestions||[]);

    var leftCol = '<div style="padding:12px 14px;border-right:1px solid var(--border);min-width:0;display:flex;flex-direction:column;gap:8px;position:relative">'
      // Header
      + '<div>'
      + '<div style="font-size:13px;font-weight:600;color:var(--dark);margin-bottom:2px">'+esc(p.page_name)+'</div>'
      + '<div style="font-size:10.5px;color:var(--n2);margin-bottom:5px">/'+(p.slug||'')+'</div>'
      + '<div style="display:flex;gap:4px;flex-wrap:wrap">'+actionBadge+priBadge+'</div>'
      + '</div>'
      // Primary keyword
      + '<div style="border-top:1px solid var(--border);padding-top:8px">'
      + '<div style="font-size:9px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px">Primary Keyword</div>'
      + '<div style="font-size:11.5px;color:var(--dark);font-weight:600">'+(p.primary_keyword||'—')+'</div>'
      + '<div style="font-size:10px;color:var(--n2);margin-top:1px">'+(p.primary_vol?p.primary_vol.toLocaleString()+'/mo':'')+' '+(p.primary_kd?'· KD:'+p.primary_kd:'')+'</div>'
      + '</div>'
      // Keywords — chips + editable input
      + '<div style="border-top:1px solid var(--border);padding-top:8px">'
      + '<div style="font-size:9px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Keywords ('+addlKws.length+')</div>'
      + (addlKws.length
          ? addlKws.map(function(k,ki){ return '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(0,0,0,0.04);border:1px solid var(--border);border-radius:3px;font-size:9.5px;padding:1px 5px;margin:1px 2px 1px 0;color:var(--n3)">'
              +esc(k)+'<span onclick="briefRemoveKw('+pidx+','+ki+')" style="cursor:pointer;color:var(--n1);font-size:10px;line-height:1" title="Remove">×</span></span>'; }).join('')
          : '<span style="font-size:9.5px;color:var(--n1);font-style:italic">None yet</span>')
      + '<div style="display:flex;gap:4px;margin-top:5px">'
      + '<button class="brief-toggle-picker-btn" data-pidx="'+pidx+'" data-type="kw" style="width:100%;text-align:left;background:rgba(0,0,0,0.03);border:1px dashed var(--border);border-radius:3px;padding:4px 8px;font-size:9.5px;color:var(--n2);cursor:pointer;font-family:var(--font);margin-top:2px">＋ Pick from researched keywords…</button>'
      + '<div id="brief-kw-picker-'+pidx+'" style="display:none"></div>'
      + '</div>'
      + '</div>'
      // Questions — list + editable
      + '<div style="border-top:1px solid var(--border);padding-top:8px">'
      + '<div style="font-size:9px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Questions ('+assignedQs.length+')</div>'
      + (assignedQs.length
          ? assignedQs.map(function(q,qi){ return '<div style="display:flex;align-items:flex-start;gap:4px;padding:3px 0;border-bottom:1px dashed rgba(0,0,0,0.06)">'
              +'<span style="font-size:9.5px;color:var(--n3);line-height:1.4;flex:1">'+esc(q)+'</span>'
              +'<span onclick="briefRemoveQ('+pidx+','+qi+')" style="cursor:pointer;color:var(--n1);font-size:11px;flex-shrink:0;margin-top:1px" title="Remove">×</span>'
              +'</div>'; }).join('')
          : '<div style="font-size:9.5px;color:var(--n1);font-style:italic">None assigned — run AI Assign or add manually</div>')
      + '<div style="display:flex;gap:4px;margin-top:5px">'
      + '<button class="brief-toggle-picker-btn" data-pidx="'+pidx+'" data-type="q" style="width:100%;text-align:left;background:rgba(0,0,0,0.03);border:1px dashed var(--border);border-radius:3px;padding:4px 8px;font-size:9.5px;color:var(--n2);cursor:pointer;font-family:var(--font);margin-top:2px">＋ Pick from researched questions…</button>'
      + '<div id="brief-q-picker-'+pidx+'" style="display:none"></div>'
      + '</div>'
      + '</div>'
      // Traffic
      + (trafficStr ? '<div style="border-top:1px solid var(--border);padding-top:6px">'
        + '<div style="font-size:9px;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Existing Traffic</div>'
        + '<div style="font-size:11px;color:var(--green);font-weight:500">'+trafficStr+'</div></div>' : '')
      + '</div>';

    var scoreHtml = '';
    var _hasBriefText = p.brief && (p.brief.generated || p.brief.summary);
    if (_hasBriefText && p.brief.score) {
      var sc = p.brief.score;
      var pct = Math.round((sc.passed / sc.total) * 100);
      var barClr = pct >= 80 ? 'var(--green)' : pct >= 55 ? 'var(--warn)' : '#e5534b';
      scoreHtml = '<div id="brief-score-'+pidx+'" style="border-bottom:1px solid var(--border);padding:8px 14px;background:rgba(0,0,0,0.02);display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        + '<div style="display:flex;align-items:center;gap:6px;flex:none">'
        + '<div style="width:80px;height:6px;background:rgba(0,0,0,0.08);border-radius:3px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+barClr+';border-radius:3px"></div></div>'
        + '<span style="font-size:10px;font-weight:700;color:'+barClr+'">'+pct+'%</span>'
        + '<span style="font-size:9.5px;color:var(--n2)">brief quality</span>'
        + '</div>'
        + (sc.checks||[]).map(function(c){
            var icon = c.pass ? '✓' : '✗';
            var clr = c.pass ? 'var(--green)' : '#e5534b';
            return '<span title="'+esc(c.note||'')+'" style="display:inline-flex;align-items:center;gap:2px;font-size:9px;color:'+clr+';padding:1px 5px;border:1px solid '+clr+';border-radius:3px;opacity:0.85;cursor:default">'+icon+' '+esc(c.label)+'</span>';
          }).join('')
        + _briefVersionPills(p, pidx)
        + '<button onclick="scoreBrief('+pidx+')" style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:3px;padding:2px 7px;font-size:9px;color:var(--n2);cursor:pointer;font-family:var(--font)">Re-evaluate</button>'
        + '</div>';
    } else if (_hasBriefText) {
      scoreHtml = '<div id="brief-score-'+pidx+'" style="border-bottom:1px solid var(--border);padding:6px 14px;background:rgba(0,0,0,0.02);display:flex;align-items:center;gap:8px">'
        + '<span style="font-size:9.5px;color:var(--n2)">Brief not yet evaluated</span>'
        + _briefVersionPills(p, pidx)
        + '<button onclick="scoreBrief('+pidx+')" style="background:var(--lime);border:none;border-radius:3px;padding:3px 10px;font-size:9px;font-weight:600;cursor:pointer;font-family:var(--font)">✦ Evaluate Brief</button>'
        + '</div>';
    }

    var taHtml = isBriefed ? '<textarea class="brief-ta" data-pidx="'+pidx+'" style="width:100%;min-height:200px;padding:12px 14px;font-size:11.5px;color:var(--n3);line-height:1.6;border:none;outline:none;resize:vertical;font-family:var(--font);background:transparent;box-sizing:border-box;display:block">'+esc((p.brief&&p.brief.summary)||'')+'</textarea>' : '';
    // SERP INTEL STRIP
    var siStripHtml = '';
    if (p.serpIntel) {
      // Usable = fetched ok AND has at least H2s or word count (some sites block content but title/meta still return)
      var siComps = (p.serpIntel.competitors||[]).filter(function(c){ return c.fetch_ok && (c.word_count > 0 || (c.h2s && c.h2s.length > 0)); });
      var siAllFetched = (p.serpIntel.competitors||[]).filter(function(c){ return c.fetch_ok; });
      var siD = p.serpIntel.directives || {};
      var siHasData = siComps.length > 0 || (siAllFetched.length > 0 && (siD.word_count_target||0) > 0);
      var siPanelId = 'serp-strip-' + pidx;
      if (siHasData) {
        siStripHtml += '<div style="border-bottom:1px solid var(--border)">';
        siStripHtml += '<div onclick="var e=document.getElementById(\''+siPanelId+'\');e.style.display=e.style.display===\'none\'?\'block\':\'none\'" style="display:flex;align-items:center;gap:6px;padding:5px 14px;cursor:pointer;background:rgba(21,142,29,0.03)">';
        siStripHtml += '<span style="font-size:9px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.06em">✓ SERP Intel</span>';
        var siDisplayCount = siComps.length || siAllFetched.length;
        siStripHtml += '<span style="font-size:9px;color:var(--n2)">' + siDisplayCount + ' competitors · avg ' + (siD.avg_word_count||0) + ' words · target ' + (siD.word_count_target||0) + ' words · density ceiling ' + (siD.density_ceiling||0) + '%</span>';
        siStripHtml += '<span style="font-size:9px;color:var(--n2);margin-left:auto">▼ expand</span>';
        siStripHtml += '</div>';
        siStripHtml += '<div id="' + siPanelId + '" style="display:none;padding:6px 14px 8px">';
        siComps.forEach(function(c) {
          siStripHtml += '<div style="margin-bottom:5px;padding:5px 8px;background:rgba(0,0,0,0.02);border-radius:4px;border-left:2px solid var(--border)">';
          siStripHtml += '<div style="font-size:9.5px;font-weight:600;color:var(--dark);margin-bottom:1px">Pos ' + c.position + ' — ' + esc(c.title) + '</div>';
          if (c.meta_description) siStripHtml += '<div style="font-size:9px;color:var(--n2);margin-bottom:2px">' + esc((c.meta_description||'').slice(0,140)) + '</div>';
          if (c.h2s && c.h2s.length) siStripHtml += '<div style="font-size:9px;color:var(--n3)">H2s: ' + esc(c.h2s.slice(0,8).join(' · ')) + '</div>';
          siStripHtml += '<div style="font-size:9px;color:var(--n2);margin-top:2px">' + (c.word_count||0) + ' words · ' + (c.kw_density||0) + '% density</div>';
          siStripHtml += '</div>';
        });
        siStripHtml += '</div></div>';
      } else {
        // SERP Intel ran but fetched no usable data — show warning with re-run button
        siStripHtml += '<div style="border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;padding:5px 14px;background:rgba(229,83,75,0.03)">';
        siStripHtml += '<span style="font-size:9px;font-weight:700;color:#e5534b;text-transform:uppercase;letter-spacing:.06em">⚠ SERP Intel</span>';
        siStripHtml += '<span id="serp-strip-status-'+p.slug+'" style="font-size:9px;color:var(--n2)">No competitor data — some sites block crawlers.</span>';
        siStripHtml += '<button onclick="runSerpIntelFromBrief(\''+p.slug+'\')" style="margin-left:auto;font-size:9px;background:none;border:1px solid var(--border);border-radius:3px;padding:2px 7px;cursor:pointer">Re-run</button>';
        siStripHtml += '</div>';
      }
    }

    // ── RIGHT COL ACTION BAR ─────────────────────────────────────────────────
    var _nextV = (p.brief && p.brief.drafts && p.brief.drafts.length > 0)
      ? p.brief.drafts[p.brief.drafts.length-1].v + 1
      : 1;
    var _approveBtn = isBriefed
      ? (isApproved
          ? '<button onclick="briefToggleApprove('+pidx+')" style="background:rgba(21,142,29,0.08);border:1px solid var(--green);border-radius:4px;padding:4px 10px;font-size:10px;font-weight:600;color:var(--green);cursor:pointer;font-family:var(--font);white-space:nowrap">✓ Approved</button>'
          : '<button onclick="briefToggleApprove('+pidx+')" style="background:var(--white);border:1px solid var(--border);border-radius:4px;padding:4px 10px;font-size:10px;font-weight:500;color:var(--n3);cursor:pointer;font-family:var(--font);white-space:nowrap">Approve Brief</button>'
        )
      : '';
    var _regenBtn = '<button onclick="generatePageBrief('+pidx+')" id="brief-btn-'+pidx+'" style="background:var(--lime);border:none;border-radius:4px;padding:4px 10px;font-size:10px;font-weight:600;cursor:pointer;font-family:var(--font);white-space:nowrap">'
      + (isBriefed ? '↺ Regenerate' : '✦ Generate Brief')
      + '</button>';
    var _runV2Btn = (isBriefed && (p.brief.drafts||[]).length > 0)
      ? '<button onclick="generateBriefV2('+pidx+')" style="background:var(--white);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:9.5px;font-weight:500;color:var(--n2);cursor:pointer;font-family:var(--font);white-space:nowrap">+ V'+_nextV+'</button>'
      : '';
    var _nicheBtn  = '<button onclick="briefPageNicheExpand('+pidx+')"  id="brief-niche-btn-'+pidx+'"  title="Expand niche keywords for this page" style="background:var(--white);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:9.5px;color:var(--n2);cursor:pointer;font-family:var(--font);white-space:nowrap">⌖ Niche KW</button>';
    var _questBtn  = '<button onclick="briefPageQuestions('+pidx+')"    id="brief-quest-btn-'+pidx+'"  title="Generate FAQ questions for this page" style="background:var(--white);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:9.5px;color:var(--n2);cursor:pointer;font-family:var(--font);white-space:nowrap">? Questions</button>';
    var _assignBtn = '<button onclick="briefPageAssign('+pidx+')"       id="brief-assign-btn-'+pidx+'" title="AI assign keywords + questions for this page" style="background:var(--white);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:9.5px;color:var(--n2);cursor:pointer;font-family:var(--font);white-space:nowrap">✦ Assign</button>';
    var actionBar = '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.01)">'
      + _nicheBtn + _questBtn + _assignBtn
      + '<span style="flex:1"></span>'
      + _runV2Btn + _regenBtn + _approveBtn
      + '</div>';

    var rightContent = isBriefed
      ? scoreHtml + siStripHtml + taHtml
      : '<div style="padding:12px 14px;display:flex;align-items:center;justify-content:center;color:var(--n1);font-size:11px;height:100%">No brief yet — click Generate Brief</div>';

    var rightCol = '<div style="min-width:0;display:flex;flex-direction:column">'
      + actionBar
      + '<div id="brief-stream-'+pidx+'" style="display:none;padding:12px 14px;background:#0d1117;font-family:monospace;font-size:10px;color:#7ee787;white-space:pre-wrap;min-height:200px;overflow-y:auto"></div>'
      + '<div id="brief-content-'+pidx+'" style="flex:1">'+rightContent+'</div>'
      + '</div>';

    var cardBorder = isApproved ? '2px solid var(--green)' : '1px solid var(--border)';
    var cardBg = isApproved ? 'rgba(21,142,29,0.02)' : 'var(--white)';
    return '<div class="tbl-row" style="display:grid;grid-template-columns:200px 1fr;border:'+cardBorder+';border-radius:6px;margin-bottom:8px;background:'+cardBg+';position:relative;align-items:stretch">'
      + leftCol + rightCol + '</div>';
  }

  var buildNew = seoPages.filter(function(p){ return (p.action||'build_new') !== 'improve_existing'; });
  var improve  = seoPages.filter(function(p){ return (p.action||'') === 'improve_existing'; });

  try {
    if (buildNew.length) {
      html += '<div style="font-size:11px;font-weight:600;color:var(--n2);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;margin-top:4px">Build New ('+buildNew.length+')</div>';
      buildNew.forEach(function(p){ html += pageCard(p, S.pages.indexOf(p)); });
    }
    if (improve.length) {
      html += '<div style="font-size:11px;font-weight:600;color:var(--n2);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;margin-top:16px">Improve Existing ('+improve.length+')</div>';
      improve.forEach(function(p){ html += pageCard(p, S.pages.indexOf(p)); });
    }
  } catch(renderErr) {
    html += '<div style="padding:20px;color:#e5534b;font-size:12px;font-family:monospace">Render error: '+renderErr.message+'</div>';
  }
  el.innerHTML = html;
  // Auto-size any existing brief textareas
  setTimeout(function(){
    el.querySelectorAll('textarea').forEach(function(ta){
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  }, 0);
}


async function generatePageBrief(pageIdx) {
  var p = S.pages[pageIdx];
  if (!p) return;
  var btn = document.getElementById('brief-btn-'+pageIdx);
  var streamEl = document.getElementById('brief-stream-'+pageIdx);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:10px;height:10px"></span>'; }
  if (streamEl) { streamEl.style.display = 'block'; streamEl.textContent = ''; }

  var assignedQs = (p.assignedQuestions||[]);
  var addlKws = (p.supporting_keywords||[]).map(function(k){ return typeof k==='object'?(k.kw||''):String(k); }).filter(Boolean);
  var existingRkws = (p.existing_ranking_kws||[]).slice(0,5).map(function(k){return k.kw||k;});
  var R = S.research || {};
  var pt = (p.page_type||'service').toLowerCase();

  // ── SHARED CONTEXT ───────────────────────────────────────────────
  var ctxBusiness = [
    'Client: '+(R.client_name||S.setup&&S.setup.client_name||'Unknown'),
    'Industry: '+(R.industry||''),
    'Value proposition: '+(R.value_proposition||''),
    'Key differentiators: '+((R.key_differentiators||[]).join('; ')||'none provided'),
    'Proof points: '+((R.proof_points||[]).join('; ')||'none provided'),
    'Brand voice: '+(R.brand_voice_style||R.tone_and_voice||'professional'),
  ].filter(function(l){ return l.split(': ')[1]; }).join('\n');

  var ctxAudience = [
    'Primary audience: '+(R.primary_audience_description||((R.target_audience||[])[0])||''),
    'Best customer example: '+(R.best_customer_examples||''),
    'Top pain points: '+((R.pain_points_top5||[]).slice(0,3).join('; ')||''),
    'Top objections: '+((R.objections_top5||[]).slice(0,3).join('; ')||''),
    'Geography: '+((R.geography&&R.geography.primary)||R.target_geography||''),
  ].filter(function(l){ return l.split(': ')[1]; }).join('\n');

  var ctxCompetitors = (R.competitors||[]).slice(0,3).map(function(c){
    return '- '+(c.name||c.url||c);
  }).join('\n') || 'None identified';

  var ctxKeywords = '**Primary:** '+(p.primary_keyword||'none')+' ('+( p.primary_vol||0)+'/mo, KD:'+(p.primary_kd||0)+')\n'
    + (addlKws.length ? '**Supporting:** '+addlKws.join(', ') : '')
    + (existingRkws.length ? '\n**Currently ranking for:** '+existingRkws.join(', ') : '');

  var ctxQuestions = assignedQs.length
    ? assignedQs.map(function(q,i){ return (i+1)+'. '+q; }).join('\n')
    : 'None assigned — suggest 4-6 questions matched to search intent';

  var ctxInternalLinks = (S.pages||[]).filter(function(pg){
    return pg.slug !== p.slug && pg.primary_keyword && (pg.page_type==='service'||pg.page_type==='location'||pg.page_type==='industry');
  }).slice(0,8).map(function(pg){ return '- /'+pg.slug+' ('+pg.primary_keyword+')'; }).join('\n') || 'None available yet';

  // ── SERP INTEL (fetch silently before brief generation) ─────────────────
  var serpBriefBlock = '';
  if (p.primary_keyword) {
    try {
      // Use saved country selection (from Keywords stage) — fallback to auto-detect from geo
      var country2 = (S.kwResearch && S.kwResearch.country)
        ? S.kwResearch.country.toUpperCase()
        : (function() {
            var geo2 = ((R.geography && R.geography.primary) || (S.setup && S.setup.geo) || '').toLowerCase();
            if (/australia|sydney|melbourne|brisbane|perth/.test(geo2)) return 'AU';
            if (/canada|\bbc\b|vancouver|calgary|toronto/.test(geo2)) return 'CA';
            if (/united kingdom|\buk\b|london/.test(geo2)) return 'GB';
            if (/new zealand/.test(geo2)) return 'NZ';
            return 'US';
          })();
      if (streamEl) streamEl.textContent = 'Fetching SERP Intel for "' + p.primary_keyword + '"…';
      var siRes = await fetch('/api/serp-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: p.primary_keyword, country: country2 })
      });
      var siData = await siRes.json();
      if (siData.competitors && siData.competitors.length) {
        S.pages[pageIdx].serpIntel = siData;
        scheduleSave();
        serpBriefBlock = buildSerpIntelBlock(p);
      }
    } catch(siErr) { /* non-fatal — continue without */ }
    if (streamEl) streamEl.textContent = 'Writing brief…';
  }

  // ── PAGE TYPE ROUTING ────────────────────────────────────────────
  var isService  = /^(service|location|industry)$/.test(pt);
  var isBlog     = /^(blog|faq|resource)$/.test(pt);
  var isUtility  = /^(home|about|team|utility)$/.test(pt);

  var sysPrompt, prompt;

  if (isService) {
    // ── TEMPLATE 1: SERVICE / LOCATION / INDUSTRY ─────────────────
    // CRO-first. Conversion architecture is the spine.
    sysPrompt = 'You are a senior CRO + SEO strategist. You write conversion-optimised page briefs for service businesses. '
      + 'CRO and SEO are equally important. Every section must serve both search intent AND move the reader toward the primary CTA. '
      + 'Be specific, direct, no generic advice. Canadian spelling.';

    prompt = '## PAGE\n'
      + 'Name: '+p.page_name+'\n'
      + 'URL: /'+p.slug+'\n'
      + 'Type: '+p.page_type+' | Action: '+(p.action||'build_new')+'\n'
      + (p.existing_traffic ? 'Existing traffic: '+p.existing_traffic+'/mo\n' : '')
      + '\n## BUSINESS CONTEXT\n'+ctxBusiness
      + '\n\n## AUDIENCE\n'+ctxAudience
      + '\n\n## KEYWORDS\n'+ctxKeywords
      + '\n\n## QUESTIONS THIS PAGE MUST ANSWER\n'+ctxQuestions
      + '\n\n## INTERNAL LINK OPPORTUNITIES\n'+ctxInternalLinks
      + '\n\n## COMPETITORS TO BEAT\n'+ctxCompetitors
      + (serpBriefBlock ? '\n\n## SERP INTEL\n'+serpBriefBlock : '')
      + '\n\n---\n'
      + '## BRIEF OUTPUT — write each section:\n\n'
      + '### 1. READER PROFILE\n'
      + 'Who is landing on this page, from what search, at what awareness stage? '
      + 'What specific fear or desire brings them here? (2-3 sentences — be a real person, not a persona category)\n\n'
      + '### 2. UNIQUE ANGLE\n'
      + 'What does this page say that the top 3 SERP results do NOT say? '
      + 'What proof, claim, or POV makes this worth clicking over the rest? (1-2 sentences, specific)\n\n'
      + '### 3. H1 + TITLE TAG\n'
      + 'Recommended H1 (primary keyword in first 3 words). '
      + 'Title tag variation under 60 chars (optimised for CTR).\n\n'
      + '### 4. CONVERSION ARCHITECTURE\n'
      + 'Primary CTA (exact label + placement: hero / post-intro / sticky / end). '
      + 'Secondary CTA if needed. '
      + 'Primary objection this page must overcome. '
      + 'Trust signals required (e.g. testimonial, case study, guarantee, logo bar) and where each appears.\n\n'
      + '### 5. PAGE STRUCTURE (H2 SKELETON)\n'
      + 'List 5-10 H2 sections in order. Each H2 should serve both a search intent signal AND a conversion micro-step. '
      + 'Note the purpose of each section in brackets (e.g. [builds trust], [removes objection], [CTA]).\n\n'
      + '### 6. KEYWORD INTEGRATION NOTES\n'
      + 'Where and how often to use the primary keyword. Where to place each supporting keyword. '
      + 'Which entity terms must appear for topical authority.\n\n'
      + '### 7. FAQ SECTION (H3s)\n'
      + 'Use the assigned questions verbatim as H3s. For each, note the answer angle (1 line — not the answer, the direction).\n\n'
      + '### 8. INTERNAL LINKS\n'
      + 'Which 3-5 pages from the internal link list should this page link to, and with what anchor text? '
      + 'Which pages should link TO this page?\n\n'
      + '### 9. WORD COUNT + FORMAT TARGET\n'
      + 'Target word count (justify from intent + page type). '
      + 'Recommended content format (e.g. service landing page with proof blocks, not a listicle).\n\n'
      + '### 10. E-E-A-T INPUTS REQUIRED\n'
      + 'What proof must appear on this page to be credible? '
      + '(e.g. specific case study result, stat, team credential, guarantee). '
      + 'Flag if any of this is missing from what you know about the client.\n';

  } else if (isBlog) {
    // ── TEMPLATE 2: BLOG / FAQ / RESOURCE ────────────────────────
    // E-E-A-T and backlink potential are the priorities alongside SEO.
    sysPrompt = 'You are a senior content strategist and SEO specialist. You write editorial briefs for blog posts and resource pages. '
      + 'E-E-A-T signals, unique insight, and backlink potential are your top priorities alongside search intent match. '
      + 'Never produce a brief that would result in generic AI-flavoured content. Push for real expertise and original angles. '
      + 'Canadian spelling.';

    prompt = '## PAGE\n'
      + 'Name: '+p.page_name+'\n'
      + 'URL: /'+p.slug+'\n'
      + 'Type: blog/resource | Action: '+(p.action||'build_new')+'\n'
      + '\n## BUSINESS CONTEXT\n'+ctxBusiness
      + '\n\n## AUDIENCE\n'+ctxAudience
      + '\n\n## KEYWORDS\n'+ctxKeywords
      + '\n\n## QUESTIONS THIS PAGE MUST ANSWER\n'+ctxQuestions
      + '\n\n## INTERNAL LINK OPPORTUNITIES\n'+ctxInternalLinks
      + (serpBriefBlock ? '\n\n## SERP INTEL\n'+serpBriefBlock : '')
      + '\n\n---\n'
      + '## BRIEF OUTPUT — write each section:\n\n'
      + '### 1. READER PROFILE + AWARENESS STAGE\n'
      + 'Who is searching this, what do they already know, what are they hoping to learn or resolve? '
      + 'What makes them click this over the top result? (2-3 sentences)\n\n'
      + '### 2. UNIQUE ANGLE + CONTRARIAN HOOK\n'
      + 'What does this article say or show that the existing top results do NOT? '
      + 'Is there a contrarian position, proprietary framework, or insider take this business can credibly make? '
      + '(Specific — not "bring a fresh perspective")\n\n'
      + '### 3. HEADLINE OPTIONS\n'
      + 'H1 option (primary keyword in first 3 words, promise-led). '
      + 'Title tag variation under 60 chars. '
      + 'One curiosity-gap alternative headline.\n\n'
      + '### 4. ARTICLE STRUCTURE (H2 SKELETON)\n'
      + 'List 6-12 H2 sections in reading order. '
      + 'Flow must resolve search intent start to finish — reader should feel the article answered their question completely. '
      + 'Note where pull quotes, data callouts, or tables would live.\n\n'
      + '### 5. INTRO REQUIREMENTS\n'
      + 'Primary keyword placement (first 120 words). '
      + 'Hook approach (stat, counterintuitive claim, story, problem statement). '
      + 'What promise does the intro make to the reader?\n\n'
      + '### 6. E-E-A-T INPUTS\n'
      + 'What real experience, data, or proof must appear in this article to be credible? '
      + 'Specific sections where case study, stat, or first-person experience should be injected. '
      + 'Is an expert quote or external source citation needed, and on what claim?\n\n'
      + '### 7. BACKLINK POTENTIAL INPUTS\n'
      + 'What stat, framework, visual, or original research in this article would make other sites want to link to it? '
      + 'Be specific about what to include (e.g. "a comparison table of X vs Y that doesn\'t exist anywhere else").\n\n'
      + '### 8. FAQ SECTION (H3s)\n'
      + 'Use assigned questions verbatim as H3s. Note the answer angle for each (1 line).\n\n'
      + '### 9. INTERNAL LINKS + SOFT CTA\n'
      + 'Which 3-5 internal pages should this link to, and where/why? '
      + 'What soft CTA fits at the end (not pushy — this is an info page)?\n\n'
      + '### 10. WORD COUNT + SKIMMABILITY FORMAT\n'
      + 'Target word count. Required skimmability elements (bullets, table, TL;DR box, pull quote, summary section). '
      + 'Reading time estimate.\n';

  } else {
    // ── TEMPLATE 3: HOME / ABOUT / UTILITY ───────────────────────
    // Intent match + trust signals + brand voice priority.
    sysPrompt = 'You are a senior brand strategist and conversion copywriter. '
      + 'You write briefs for homepage, about, and utility pages where brand voice and trust signals drive performance. '
      + 'Search intent must be matched but these pages are also heavy brand touchpoints. '
      + 'Canadian spelling.';

    prompt = '## PAGE\n'
      + 'Name: '+p.page_name+'\n'
      + 'URL: /'+p.slug+'\n'
      + 'Type: '+p.page_type+' | Action: '+(p.action||'build_new')+'\n'
      + '\n## BUSINESS CONTEXT\n'+ctxBusiness
      + '\n\n## AUDIENCE\n'+ctxAudience
      + '\n\n## KEYWORDS\n'+ctxKeywords
      + '\n\n## QUESTIONS THIS PAGE MUST ANSWER\n'+ctxQuestions
      + '\n\n## COMPETITORS\n'+ctxCompetitors
      + (serpBriefBlock ? '\n\n## SERP INTEL\n'+serpBriefBlock : '')
      + '\n\n---\n'
      + '## BRIEF OUTPUT — write each section:\n\n'
      + '### 1. PAGE PURPOSE + SEARCH INTENT\n'
      + 'What is this page\'s primary job? Who lands here and from where (organic, direct, referral)? '
      + 'What do they need to feel/know/do within 5 seconds of landing?\n\n'
      + '### 2. BRAND VOICE DIRECTION\n'
      + 'Specific tone instructions for this page (e.g. "warm and direct, not corporate"). '
      + 'Words/phrases to use. Words to avoid. One sentence that captures the voice this page should feel like.\n\n'
      + '### 3. H1 + ABOVE-FOLD CONTENT\n'
      + 'Recommended H1. What goes above the fold: headline, subheadline, CTA, visual direction.\n\n'
      + '### 4. PAGE STRUCTURE (H2 SKELETON)\n'
      + 'Section list in order. For home/about pages this is lighter (4-7 sections). '
      + 'Each section note: what trust signal or brand story moment lives here.\n\n'
      + '### 5. TRUST SIGNAL REQUIREMENTS\n'
      + 'Exactly which trust signals must appear and where: '
      + 'testimonials, case study callouts, awards, team credentials, client logos, guarantees, stats. '
      + 'Flag any that are missing from what you know about the client.\n\n'
      + '### 6. CTA ARCHITECTURE\n'
      + 'Primary CTA (what, where, what copy). Secondary CTA if needed. '
      + 'What objection must be removed before a visitor will take action?\n\n'
      + '### 7. KEYWORD + INTENT INTEGRATION\n'
      + 'How to work the primary keyword in naturally without making it feel like an SEO page. '
      + 'For about/team pages: how to integrate expertise signals for E-E-A-T without sounding like a CV.\n\n'
      + '### 8. WORD COUNT + FORMAT\n'
      + 'Target word count (home/about pages are shorter — justify). '
      + 'Format: landing page blocks, narrative, hybrid?\n';
  }

  var contentEl = document.getElementById('brief-content-'+pageIdx);
  if (contentEl) contentEl.style.display = 'none';
  try {
    var briefText = await callClaude(sysPrompt, prompt, function(t){ if(streamEl) { streamEl.style.display = 'block'; streamEl.textContent = t; streamEl.scrollTop = streamEl.scrollHeight; } }, 2500);
    if (!p.brief) p.brief = {};
    p.brief.generated = true;
    p.brief.summary = briefText;
    p.brief.generatedAt = Date.now();
    p.brief.score = null; // reset score — will be evaluated after render
    // Versioning — push to drafts array (mirrors copy versioning)
    var _bDrafts = p.brief.drafts || [];
    var _isNewVer = p.brief._requestNewVersion || false;
    delete p.brief._requestNewVersion;
    if (!_isNewVer && _bDrafts.length > 0) {
      // Regenerate on same version — update current draft in place
      var _activeIdx = p.brief.activeDraft || 0;
      _bDrafts[_activeIdx] = { v: _bDrafts[_activeIdx].v, summary: briefText, score: null, generatedAt: Date.now() };
    } else {
      // New version — push fresh draft, keep last 2 only
      var _bv = (_bDrafts.length > 0 ? _bDrafts[_bDrafts.length-1].v : 0) + 1;
      _bDrafts.push({ v: _bv, summary: briefText, score: null, generatedAt: Date.now() });
      if (_bDrafts.length > 2) _bDrafts = _bDrafts.slice(-2); // drop oldest
      p.brief.activeDraft = _bDrafts.length - 1;
    }
    p.brief.drafts = _bDrafts;
    scheduleSave();
    // Update content div directly without full re-render (preserve scroll position)
    if (streamEl) streamEl.style.display = 'none';
    if (contentEl) {
      contentEl.style.display = 'flex';
      contentEl.innerHTML = '<textarea class="brief-ta" data-pidx="'+pageIdx+'" style="width:100%;min-height:200px;padding:12px 14px;font-size:11.5px;color:var(--n3);line-height:1.6;border:none;outline:none;resize:vertical;font-family:var(--font);background:transparent;box-sizing:border-box;display:block">'+esc(briefText)+'</textarea>';
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '↺ Regenerate'; }
    // Auto-evaluate the brief
    setTimeout(function(){ scoreBrief(pageIdx); }, 300);
  } catch(e) {
    if (streamEl) { streamEl.style.display = 'block'; streamEl.textContent = 'Error: '+e.message; }
    if (btn) { btn.disabled = false; btn.innerHTML = '↺ Retry'; }
  }
}

async function generateAllBriefs() {
  var btn = document.getElementById('briefs-run-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span> Generating...'; }
  var seoPages = S.pages.filter(function(p){ return p.page_type !== 'utility'; });
  for (var i = 0; i < seoPages.length; i++) {
    var idx = S.pages.indexOf(seoPages[i]);
    await generatePageBrief(idx);
    await new Promise(function(r){ setTimeout(r, 400); });
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles"></i> Regenerate All'; }
}

// ── PROGRAMMATIC SITEMAP BUILD FROM CLUSTERS ───────────────────────