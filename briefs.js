
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
  // Position el directly — it's already position:absolute inside a position:relative wrapper
  el.style.cssText = 'display:block;position:absolute;top:calc(100% + 3px);left:0;min-width:260px;max-width:380px;z-index:9999;border:1px solid var(--border);border-radius:6px;background:white;box-shadow:0 6px 20px rgba(0,0,0,0.15);max-height:220px;overflow-y:auto;overflow-x:hidden';
  var html = '<div>';
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

async function briefContextUpload(pidx, input) {
  var file = input.files[0];
  if (!file || !S.pages[pidx]) return;
  if (!S.pages[pidx].pageFiles) S.pages[pidx].pageFiles = [];
  var isImage = file.type.startsWith('image/');
  if (isImage) {
    // Store image reference (not base64 — too large for KV)
    // Read as base64 for display and prompt injection
    var reader = new FileReader();
    reader.onload = function(e) {
      S.pages[pidx].pageFiles.push({ name: file.name, type: 'image', dataUrl: e.target.result.slice(0,500)+'...' });
      // Append note to pageContext
      var ctx = S.pages[pidx].pageContext || '';
      S.pages[pidx].pageContext = (ctx ? ctx+'\n' : '') + '[Image available: '+file.name+' — reference this image in the copy where relevant]';
      var ta = document.getElementById('brief-ctx-'+pidx);
      if (ta) ta.value = S.pages[pidx].pageContext;
      scheduleSave(); renderBriefs();
    };
    reader.readAsDataURL(file);
  } else {
    // Read text
    var reader2 = new FileReader();
    reader2.onload = function(e) {
      var text = e.target.result.slice(0, 8000);
      S.pages[pidx].pageFiles.push({ name: file.name, type: 'text' });
      var ctx = S.pages[pidx].pageContext || '';
      S.pages[pidx].pageContext = (ctx ? ctx+'\n\n' : '') + '--- ' + file.name + ' ---\n' + text;
      var ta = document.getElementById('brief-ctx-'+pidx);
      if (ta) ta.value = S.pages[pidx].pageContext;
      scheduleSave(); renderBriefs();
      if(typeof aiBarNotify==='function') aiBarNotify('✓ '+file.name+' added to page context', {duration:3000});
    };
    reader2.readAsText(file);
  }
  input.value = '';
}

function briefContextRemoveFile(pidx, fileIdx) {
  if (!S.pages[pidx] || !S.pages[pidx].pageFiles) return;
  var fname = S.pages[pidx].pageFiles[fileIdx].name;
  S.pages[pidx].pageFiles.splice(fileIdx, 1);
  // Remove the file's appended text from context
  var ctx = S.pages[pidx].pageContext || '';
  ctx = ctx.replace('\n\n--- ' + fname + ' ---\n', '\n').replace('--- ' + fname + ' ---\n', '');
  ctx = ctx.replace('[Image available: ' + fname + ' — reference this image in the copy where relevant]', '').trim();
  S.pages[pidx].pageContext = ctx;
  var ta = document.getElementById('brief-ctx-'+pidx);
  if (ta) ta.value = ctx;
  scheduleSave(); renderBriefs();
}

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
function toggleBriefOpen(slug) {
  if (!window._briefOpen) window._briefOpen = new Set();
  if (window._briefOpen.has(slug)) window._briefOpen.delete(slug);
  else window._briefOpen.add(slug);
  renderBriefs();
}

function briefToggleApprove(pidx) {
  var p = S.pages[pidx];
  if (!p || !p.brief || !p.brief.generated) return;
  p.brief.approved = !p.brief.approved;
  if (p.brief.approved) p.brief.approvedAt = Date.now();
  else delete p.brief.approvedAt;
  p.updatedAt = Date.now();
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

  // Add page goal alignment check if page_goal exists
  if (p.page_goal && p.page_goal.trim()) {
    checks.push({ id:'goal_alignment', label:'Brief serves page goal: '+p.page_goal.trim().substring(0,40) });
  }

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
    + 'Type: '+p.page_type+' | Primary keyword: '+(p.primary_keyword||'none')+'\n'
    + (p.page_goal ? 'Page goal: '+p.page_goal+'\n' : '')
    + '\n'
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
      1000
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
    var _pScore = d.score ? Math.round(d.score.pct || 0)+'% quality' : 'not yet evaluated';
    var _pillTip = isActive
      ? 'V'+d.v+' is the active draft ('+_pScore+'). Regen will overwrite this version in place.'
      : 'Switch to V'+d.v+' ('+_pScore+'). This becomes the active draft. Regen and Approve will then act on this version.';
    var hasPassed = d.score && d.score.passed != null;
    var pct = hasPassed ? Math.round((d.score.passed / d.score.total) * 100) : null;
    var label = 'V' + d.v + (pct !== null ? ' · ' + pct + '%' : '');
    var bg = isActive ? 'var(--dark)' : 'transparent';
    var clr = isActive ? 'var(--white)' : 'var(--n2)';
    var border = isActive ? 'var(--dark)' : 'var(--border)';
    return '<button onclick="switchBriefDraft(' + pidx + ',' + i + ')" title="' + _pillTip + '" style="font-size:9px;padding:2px 7px;border-radius:3px;border:1px solid ' + border + ';background:' + bg + ';color:' + clr + ';cursor:pointer;font-family:var(--font);font-weight:' + (isActive?'600':'400') + '">' + label + '</button>';
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


async function improveBrief(pageIdx) {
  var p = S.pages[pageIdx];
  if (!p || !p.brief || !p.brief.summary) return;
  var btn = document.getElementById('brief-improve-btn-'+pageIdx);
  if (btn) { btn.disabled=true; btn.innerHTML='<span class="spinner" style="width:10px;height:10px"></span> Improving...'; }

  // Collect failed checks
  var failures = [];
  if (p.brief.score && p.brief.score.checks) {
    failures = p.brief.score.checks.filter(function(c){ return !c.pass; }).map(function(c){ return '- '+c.label+(c.note?' (note: '+c.note+')':''); });
  }
  if (!failures.length) {
    if(typeof aiBarNotify==='function') aiBarNotify('No failures to fix — brief already passing all checks', {duration:3000});
    if (btn) { btn.disabled=false; btn.innerHTML='↑ Improve'; }
    return;
  }

  var sysPrompt = 'You are a senior SEO and CRO strategist improving a content brief. You will receive an existing brief and a list of failed quality checks. Rewrite ONLY the sections that address those failures — leave all other sections exactly as they are. Output the full revised brief. Canadian spelling.';
  var prompt = '## EXISTING BRIEF\n' + (p.brief.summary||'') + '\n\n## FAILED CHECKS (fix these only)\n' + failures.join('\n') + '\n\n## TASK\nRewrite only the sections that address the failed checks above. Keep all passing sections unchanged. Output the complete revised brief.';

  var streamEl = document.getElementById('brief-stream-'+pageIdx);
  try {
    window._aiBarLabel = '↑ Improving brief: ' + (p.page_name||p.slug);
    if(typeof storePrompt==='function') storePrompt('brief-'+pageIdx, sysPrompt, prompt, '↑ Improve: '+p.page_name, failures.length+' fixes');
    var improved = await callClaude(sysPrompt, prompt, function(t){ if(streamEl){ streamEl.style.display='block'; streamEl.textContent=t; streamEl.scrollTop=streamEl.scrollHeight; } }, 8000);
    // Push as new version
    p.brief._requestNewVersion = true;
    var _bDrafts = p.brief.drafts || [];
    var _bv = (_bDrafts.length > 0 ? _bDrafts[_bDrafts.length-1].v : 0) + 1;
    _bDrafts.push({ v: _bv, summary: improved, score: null, generatedAt: Date.now() });
    if (_bDrafts.length > 2) _bDrafts = _bDrafts.slice(-2);
    p.brief.drafts = _bDrafts;
    p.brief.activeDraft = _bDrafts.length - 1;
    p.brief.summary = improved;
    p.brief.score = null;
    delete p.brief._requestNewVersion;
    scheduleSave();
    if (streamEl) streamEl.style.display='none';
    var contentEl = document.getElementById('brief-content-'+pageIdx);
    if (contentEl) {
      contentEl.style.display='flex';
      contentEl.innerHTML = '<textarea class="brief-ta" data-pidx="'+pageIdx+'" style="width:100%;min-height:200px;padding:14px;font-size:12px;font-family:var(--font);line-height:1.7;border:none;resize:vertical;background:transparent;color:var(--dark);outline:none">'+esc(improved)+'</textarea>';
    }
    setTimeout(function(){ scoreBrief(pageIdx); }, 300);
    if(typeof aiBarNotify==='function') aiBarNotify('✓ Brief improved — re-evaluating', {duration:3000});
  } catch(e) {
    if (streamEl) { streamEl.style.display='block'; streamEl.textContent='Improve failed: '+e.message; }
    if(typeof aiBarNotify==='function') aiBarNotify('Improve failed: '+e.message, {isError:true,duration:4000});
  }
  if (btn) { btn.disabled=false; btn.innerHTML='↑ Improve'; }
}

async function generateBriefV2(pageIdx) {
  var p = S.pages[pageIdx];
  if (!p || !p.brief || !p.brief.summary) return;
  // Mark as new version run — generatePageBrief will push a new draft
  p.brief._requestNewVersion = true;
  await generatePageBrief(pageIdx);
}


// ── INSITES INTENT MATCHING ───────────────────────────────────────────────────
// Maps page type + search intent to the right lead gen tool + placement.
// Insites embed types: audit_widget, chat, form, calendar, exit_intent, scroll_cta
var _TOOL_MAP = [
  // Commercial service/location pages → Insites audit (high-intent, wants proof)
  { types:['service','industry','product','location'], intents:['commercial','transactional'],
    tool:'Insites Audit Widget', placement:'Below hero — "Get your free website audit"', icon:'ti-chart-bar' },
  // Home page → light qualifier (not audit, too early)
  { types:['home'],
    tool:'Insites Audit Widget', placement:'Mid-page — after social proof section', icon:'ti-chart-bar' },
  // Blog/informational → email capture + content upgrade
  { types:['blog','article','resource','event'],
    tool:'Email capture form', placement:'After intro paragraph + exit intent', icon:'ti-mail' },
  // About/team → calendar / discovery call
  { types:['about','team'],
    tool:'Discovery call CTA', placement:'End of page — "Book a 20-min call"', icon:'ti-calendar' },
  // FAQ/utility → chat widget
  { types:['faq','utility','contact'],
    tool:'Live chat / Intercom', placement:'Bottom-right persistent', icon:'ti-message-chatbot' },
];

function getInsitosTool(pageType, searchIntent) {
  var pt = (pageType||'').toLowerCase();
  var si = (searchIntent||'').toLowerCase();
  for (var i=0; i<_TOOL_MAP.length; i++) {
    var rule = _TOOL_MAP[i];
    var typeMatch = rule.types.includes(pt);
    var intentMatch = !rule.intents || rule.intents.includes(si);
    if (typeMatch && intentMatch) return rule;
  }
  // Fallback for unmapped commercial types
  if (['commercial','transactional'].includes(si)) return _TOOL_MAP[0];
  return null;
}

// ── PER-PAGE ENRICHMENT ACTIONS ──────────────────────────────────────────────
// These call the same endpoints as the global buttons in the toolbar but scoped
// to a single page. Buttons live in the per-card action bar (rightCol top).

async function briefPageNicheExpand(pidx) {
  var p = S.pages[pidx];
  if (!p || !p.primary_keyword) { if(typeof aiBarNotify==='function') aiBarNotify('No primary keyword on this page.', {isError:true,duration:3000}); return; }
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
    if(typeof aiBarNotify==='function') aiBarNotify('Niche expand failed: '+e.message, {isError:true,duration:4000});
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
    if(typeof aiBarNotify==='function') aiBarNotify('Page questions failed: '+e.message, {isError:true,duration:4000});
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
    if(typeof aiBarNotify==='function') aiBarNotify('Assign failed: '+e.message, {isError:true,duration:4000});
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
      if (t.classList.contains('brief-ctx-ta')) {
        var _pi = parseInt(t.dataset.pidx);
        if (!isNaN(_pi) && S.pages[_pi]) {
          S.pages[_pi].pageContext = t.value;
          scheduleSave();
        }
      }
    }, true);
    document.addEventListener('click', function(e) {
      var hdr = e.target.closest('.brief-row-header');
      if (hdr && hdr.dataset.briefSlug !== undefined) { toggleBriefOpen(hdr.dataset.briefSlug); return; }
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

    // Normalise supporting_keywords
    var addlKws = (p.supporting_keywords||[]).map(function(k){ return typeof k==='object'?(k.kw||''):String(k); }).filter(Boolean);
    var assignedQs = (p.assignedQuestions||[]);

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

    // ── ACTION BAR ───────────────────────────────────────────────────────────
    var _nextV = (p.brief && p.brief.drafts && p.brief.drafts.length > 0)
      ? p.brief.drafts[p.brief.drafts.length-1].v + 1 : 1;
    var _btnBase = 'border-radius:4px;padding:4px 10px;font-size:10px;cursor:pointer;font-family:var(--font);white-space:nowrap;border:1px solid var(--border);background:var(--white);color:var(--n3)';
    var _btnSm   = 'border-radius:4px;padding:3px 8px;font-size:9.5px;cursor:pointer;font-family:var(--font);white-space:nowrap;border:1px solid var(--border);background:var(--white);color:var(--n2)';
    var _approveBtn = isBriefed
      ? (isApproved
          ? '<button onclick="briefToggleApprove('+pidx+')" data-tip="Brief is approved and locked for copy generation. Click to un-approve if you need to edit or regenerate." style="border-radius:4px;padding:4px 10px;font-size:10px;font-weight:600;cursor:pointer;font-family:var(--font);white-space:nowrap;background:rgba(21,142,29,0.08);border:1px solid var(--green);color:var(--green)">✓ Approved</button>'
          : '<button onclick="briefToggleApprove('+pidx+')" data-tip="Approve the currently active draft. Copy generation is locked until a brief is approved. Make sure you are on the version you want before approving." style="'+_btnBase+';font-weight:500">Approve</button>'
        ) : '';
    var _regenTip = isBriefed
      ? 'Regen overwrites the currently active draft in place — same version number, fresh content. Switch to the version you want to replace first. Use when the active draft needs a full redo.'
      : 'Generate the brief for this page. Runs SERP Intel, then calls Claude with all assigned keywords and questions.';
    var _regenBtn = '<button onclick="generatePageBrief('+pidx+')" id="brief-btn-'+pidx+'" data-tip="'+_regenTip+'" style="background:var(--lime);border:none;border-radius:4px;padding:4px 10px;font-size:10px;font-weight:600;cursor:pointer;font-family:var(--font);white-space:nowrap">'
      + (isBriefed ? '↺ Regen' : '✦ Generate') + '</button>';
    var _hasFailures = isBriefed && p.brief.score && p.brief.score.checks && p.brief.score.checks.some(function(c){ return !c.pass; });
    var _improveBtn = _hasFailures
      ? '<button onclick="improveBrief('+pidx+')" id="brief-improve-btn-'+pidx+'" data-tip="Improve reads the failed checks and asks Claude to fix only those specific sections — leaving passing sections untouched. Pushes as a new version. Use instead of full Regen when the brief is mostly good but a few checks failed." style="background:rgba(21,142,29,0.1);border:1px solid rgba(21,142,29,0.3);border-radius:4px;padding:4px 10px;font-size:10px;font-weight:600;cursor:pointer;font-family:var(--font);white-space:nowrap;color:var(--green)">↑ Improve</button>'
      : '';
    var _v2Tip = '+ V'+_nextV+' generates a new version alongside the current drafts. Only the last 2 drafts are kept — the oldest is dropped. Use when you want a fresh attempt without losing the current active draft. Warning: if V2=92% and V3=85% are both showing, clicking +V4 will drop V2.';
    var _runV2Btn = (isBriefed && (p.brief.drafts||[]).length > 0)
      ? '<button onclick="generateBriefV2('+pidx+')" data-tip="'+_v2Tip+'" style="'+_btnSm+'">+ V'+_nextV+'</button>' : '';
    var _nicheBtn  = '<button onclick="briefPageNicheExpand('+pidx+')" id="brief-niche-btn-'+pidx+'" data-tip="Expands this page primary keyword via Google Suggest with 10 modifiers, gets DataForSEO volumes, and adds niche variants to this pages keyword pool. Run before AI Assign so there are specific variants to assign." style="'+_btnSm+'">⌖ Niche KW</button>';
    var _questBtn  = '<button onclick="briefPageQuestions('+pidx+')"   id="brief-quest-btn-'+pidx+'" data-tip="Generates 8 bottom-of-funnel questions specific to this pages primary keyword and page type. These become FAQ H3s in the brief and feed FAQ schema. Run before Generate or Regen." style="'+_btnSm+'">? Questions</button>';
    var _assignBtn = '<button onclick="briefPageAssign('+pidx+')"      id="brief-assign-btn-'+pidx+'" data-tip="Runs a full curation pass for this page: reviews the global keyword pool and question list, assigns the best matches for this pages intent, removes irrelevant ones, and reports how many were removed. Run after Niche KW and Questions." style="'+_btnSm+'">✦ Assign</button>';

    var _promptBtn = isBriefed ? '<button onclick="showPromptModal(\'brief-'+pidx+'\'" data-tip="View the exact prompt sent to Claude for this brief — system instructions, context, keywords, and task." style="'+_btnSm+'"><i class="ti ti-code" style="font-size:11px"></i></button>' : '';
    var actionBar = '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.015)">'
      + _nicheBtn + _questBtn + _assignBtn
      + '<span style="flex:1"></span>'
      + _promptBtn + _improveBtn + _runV2Btn + _regenBtn + _approveBtn
      + '</div>';

    // ── INFO STRIP ────────────────────────────────────────────────────────────
    var _actionLabel = p.action === 'improve_existing'
      ? '<span style="font-size:9px;font-weight:500;color:#3b82f6;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:3px;padding:1px 5px">IMPROVE</span>'
      : '<span style="font-size:9px;font-weight:500;color:var(--green);background:rgba(21,142,29,0.08);border:1px solid rgba(21,142,29,0.25);border-radius:3px;padding:1px 5px">BUILD NEW</span>';
    var infoStrip = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:7px 12px;border-bottom:1px solid var(--border);background:rgba(0,0,0,0.01);font-size:10px;color:var(--n2)">'
      + _actionLabel
      + (p.primary_keyword ? '<span style="color:var(--dark);font-weight:600">'+esc(p.primary_keyword)+'</span>' : '<span style="color:var(--warn);font-size:10px">⚠ No keyword — use Pick keywords... or Regen uses brand context</span>')
      + (p.primary_vol ? '<span>'+p.primary_vol.toLocaleString()+'/mo</span>' : '')
      + (p.primary_kd  ? '<span>KD: '+p.primary_kd+'</span>' : '')
      + (p.search_intent ? '<span>· '+esc(p.search_intent)+'</span>' : '')
      + (p.word_count_target ? '<span>· '+p.word_count_target+' words</span>' : '')
      + (trafficStr ? '<span style="color:var(--green)">· '+trafficStr+' existing</span>' : '')
      + (function(){
          var _tool = getInsitosTool(p.page_type, p.search_intent);
          return _tool ? '<span style="background:rgba(59,130,246,0.08);color:#2563eb;border:1px solid rgba(59,130,246,0.2);border-radius:3px;font-size:9px;padding:1px 6px;margin-left:4px" title="'+_tool.tool+': '+_tool.placement+'"><i class="ti '+_tool.icon+'" style="font-size:9px"></i> '+_tool.tool+'</span>' : '';
        })()
      + '</div>';

    // ── KEYWORDS + QUESTIONS (two-col within single layout) ───────────────────
    var kwHtml = '<div style="flex:1;min-width:0">'
      + '<div style="font-size:9px;font-weight:600;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Keywords ('+addlKws.length+')</div>'
      + (addlKws.length
          ? addlKws.map(function(k,ki){
              return '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(0,0,0,0.04);border:1px solid var(--border);border-radius:3px;font-size:9.5px;padding:1px 6px;margin:0 3px 3px 0;color:var(--n3)">'
                + esc(k) + '<span onclick="briefRemoveKw('+pidx+','+ki+')" style="cursor:pointer;color:var(--n1);font-size:10px;line-height:1;margin-left:1px">×</span></span>';
            }).join('')
          : '<span style="font-size:9.5px;color:var(--n1);font-style:italic">None yet</span>')
      + '<div style="margin-top:5px;position:relative">'
      + '<button class="brief-toggle-picker-btn" data-pidx="'+pidx+'" data-type="kw" style="text-align:left;background:rgba(0,0,0,0.03);border:1px dashed var(--border);border-radius:3px;padding:3px 8px;font-size:9px;color:var(--n2);cursor:pointer;font-family:var(--font)">＋ Pick keywords…</button>'
      + '<div id="brief-kw-picker-'+pidx+'" style="display:none;position:absolute"></div>'
      + '</div></div>';

    var qHtml = '<div style="flex:1;min-width:0">'
      + '<div style="font-size:9px;font-weight:600;color:var(--n2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Questions ('+assignedQs.length+')</div>'
      + (assignedQs.length
          ? assignedQs.map(function(q,qi){
              return '<div style="display:flex;align-items:flex-start;gap:4px;padding:2px 0;border-bottom:1px dashed rgba(0,0,0,0.05)">'
                + '<span style="font-size:9.5px;color:var(--n3);line-height:1.4;flex:1">'+esc(q)+'</span>'
                + '<span onclick="briefRemoveQ('+pidx+','+qi+')" style="cursor:pointer;color:var(--n1);font-size:11px;flex-shrink:0" title="Remove">×</span></div>';
            }).join('')
          : '<span style="font-size:9.5px;color:var(--n1);font-style:italic">None assigned</span>')
      + '<div style="margin-top:5px;position:relative">'
      + '<button class="brief-toggle-picker-btn" data-pidx="'+pidx+'" data-type="q" style="text-align:left;background:rgba(0,0,0,0.03);border:1px dashed var(--border);border-radius:3px;padding:3px 8px;font-size:9px;color:var(--n2);cursor:pointer;font-family:var(--font)">＋ Pick questions…</button>'
      + '<div id="brief-q-picker-'+pidx+'" style="display:none;position:absolute"></div>'
      + '</div></div>';

    var kwQRow = '<div style="display:flex;gap:16px;padding:10px 12px;border-bottom:1px solid var(--border)">' + kwHtml + qHtml + '</div>';

    // ── BRIEF CONTENT ─────────────────────────────────────────────────────────
    var briefContent = isBriefed
      ? scoreHtml + siStripHtml + taHtml
      : '<div style="padding:20px 12px;color:var(--n1);font-size:11px;text-align:center">No brief yet — click <strong>✦ Generate</strong> to write it.</div>';

    return '<div style="display:flex;flex-direction:column">'
      + actionBar
      + infoStrip
      + kwQRow
      + '<div id="brief-stream-'+pidx+'" style="display:none;padding:12px;background:#0d1117;font-family:monospace;font-size:10px;color:#7ee787;white-space:pre-wrap;max-height:220px;overflow-y:auto"></div>'
      + '<div id="brief-content-'+pidx+'">' + briefContent + '</div>'
      + '<div style="padding:10px 12px;border-top:1px solid var(--border);background:rgba(0,0,0,0.01)">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px">'
      + '<div style="display:flex;align-items:center;gap:6px">'
      + '<span style="font-size:10px;font-weight:500;color:var(--n2);text-transform:uppercase;letter-spacing:.06em">Page Context</span>'
      + '<span style="font-size:10px;color:var(--n2)">— paste case study data, stats, claims, or instructions. Injected verbatim into brief + copy.</span>'
      + '</div>'
      + '<label style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--n2);cursor:pointer;padding:2px 7px;border:1px solid var(--border);border-radius:4px;background:white" data-tip="Upload a text file or image. Text files are extracted and appended to Page Context. Images are noted as available for the copy prompt.">'
      + '<i class="ti ti-upload" style="font-size:11px"></i> Upload file'
      + '<input type="file" accept=".txt,.md,.pdf,.jpg,.jpeg,.png,.webp" style="display:none" onchange="briefContextUpload('+pidx+',this)">'
      + '</label>'
      + '</div>'
      + '<textarea id="brief-ctx-'+pidx+'" data-pidx="'+pidx+'" class="brief-ctx-ta" placeholder="e.g. Case study: reduced CAC by 43% in 90 days. Client: Meridian Health. Lead with this in intro. Never mention competitor X by name." style="width:100%;min-height:52px;font-size:11px;padding:6px 9px;border:1px solid var(--border);border-radius:6px;font-family:var(--font);line-height:1.5;resize:vertical;background:white;color:var(--dark);box-sizing:border-box">' + esc(p.pageContext||'') + '</textarea>'
      + (p.pageFiles && p.pageFiles.length ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">' + p.pageFiles.map(function(f,fi){ return '<span style="font-size:10px;padding:2px 8px;background:var(--n1);border-radius:4px;display:flex;align-items:center;gap:4px"><i class="ti '+(f.type==='image'?'ti-photo':'ti-file-text')+'" style="font-size:10px"></i>'+esc(f.name)+'<button onclick="briefContextRemoveFile('+pidx+','+fi+')" style="background:none;border:none;cursor:pointer;color:var(--n2);padding:0;line-height:1;font-size:11px">&times;</button></span>'; }).join('') + '</div>' : '')
      + '</div>'
      + '</div>';
  }

  // ── GROUP + ACCORDION RENDER ────────────────────────────────────────────────
  // Use orderedPages() order: recent-pinned → core → service → industry → location → blog → other
  // pageCard() only fires for expanded rows (accordion collapsed by default)
  if (!window._briefOpen) window._briefOpen = new Set();

  var TYPE_GROUPS = [
    { key:'recent',   label:'Recently Edited',      types:null,                              recentOnly:true },
    { key:'core',     label:'Core',                  types:['home','about','contact','utility'] },
    { key:'service',  label:'Services',              types:['service'] },
    { key:'industry', label:'Industry',              types:['industry'] },
    { key:'location', label:'Locations',             types:['location'] },
    { key:'blog',     label:'Blog',                  types:['blog'] },
    { key:'other',    label:'Other',                 types:null }
  ];

  // Build ordered list respecting orderedPages() sort
  var _ordered = orderedPages().filter(function(p){ return p && p.page_type !== 'utility' || false; });
  // Re-filter to seoPages set (exclude utility)
  _ordered = orderedPages().filter(function(p){ return p && p.page_type !== 'utility'; });

  // Identify recent slugs (top 3 by updatedAt)
  var _recentSlugs = new Set(
    [...seoPages].filter(function(p){ return p.updatedAt; })
      .sort(function(a,b){ return b.updatedAt - a.updatedAt; })
      .slice(0,3).map(function(p){ return p.slug; })
  );

  // Group pages — recent group only if any exist
  var _grouped = {};
  TYPE_GROUPS.forEach(function(g){ _grouped[g.key] = []; });

  _ordered.forEach(function(p) {
    if (_recentSlugs.has(p.slug)) { _grouped['recent'].push(p); return; }
    var matched = TYPE_GROUPS.find(function(g){
      return !g.recentOnly && g.types && g.types.includes(p.page_type);
    });
    if (matched) _grouped[matched.key].push(p);
    else _grouped['other'].push(p);
  });

  try {
    var _firstGroup = true;
    TYPE_GROUPS.forEach(function(group) {
      var gPages = _grouped[group.key];
      if (!gPages.length) return;

      var gBriefed  = gPages.filter(function(p){ return p.brief && p.brief.generated; }).length;
      var gApproved = gPages.filter(function(p){ return p.brief && p.brief.approved; }).length;

      // Section header
      html += '<div style="display:flex;align-items:center;gap:7px;margin-top:'+(  _firstGroup?'0':'14px')+';margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--border)">';
      html += '<span style="font-size:10.5px;font-weight:600;color:var(--n3);text-transform:uppercase;letter-spacing:.06em">'+group.label+'</span>';
      html += '<span style="font-size:10px;color:var(--n2);background:rgba(0,0,0,0.04);border-radius:10px;padding:0 6px">'+gPages.length+'</span>';
      html += '<span style="font-size:9.5px;color:'+(gApproved===gPages.length&&gPages.length>0?'var(--green)':'var(--n2)')+'">'+(gBriefed)+' briefed · '+gApproved+' approved</span>';
      html += '</div>';
      _firstGroup = false;

      gPages.forEach(function(p) {
        var pidx = S.pages.indexOf(p);
        var isBriefed  = !!(p.brief && (p.brief.generated || p.brief.summary));
        var isApproved = !!(p.brief && p.brief.approved);
        var isOpen     = window._briefOpen.has(p.slug);
        var sc         = isBriefed && p.brief.score;
        var pct        = sc ? Math.round((sc.passed/sc.total)*100) : null;
        var barClr     = pct===null ? 'var(--n1)' : pct>=80 ? 'var(--green)' : pct>=55 ? 'var(--warn)' : '#e5534b';
        var pColor     = p.priority==='P1'?'var(--green)':p.priority==='P2'?'var(--warn)':'var(--n2)';
        var kwCount    = (p.supporting_keywords||[]).length;
        var qCount     = (p.assignedQuestions||[]).length;

        // Status badge
        var statusBadge = isApproved
          ? '<span style="font-size:9px;font-weight:600;color:var(--green);background:rgba(21,142,29,0.08);border:1px solid rgba(21,142,29,0.25);border-radius:3px;padding:1px 6px">✓ Approved</span>'
          : isBriefed
            ? (pct!==null
                ? '<span style="font-size:9px;color:'+barClr+';background:rgba(0,0,0,0.04);border:1px solid '+barClr+';border-radius:3px;padding:1px 6px;font-weight:600">'+pct+'%</span>'
                : '<span style="font-size:9px;color:var(--n2);background:rgba(0,0,0,0.04);border-radius:3px;padding:1px 6px">Briefed</span>')
            : '<span style="font-size:9px;color:var(--n1);background:rgba(0,0,0,0.03);border-radius:3px;padding:1px 6px">No brief</span>';

        var rowBg    = isApproved ? 'rgba(21,142,29,0.02)' : 'var(--white)';
        var rowBorder = isApproved ? '2px solid var(--green)' : isOpen ? '1px solid var(--dark)' : '1px solid var(--border)';

        html += '<div style="border:'+rowBorder+';border-radius:6px;margin-bottom:4px;background:'+rowBg+'">';

        // Collapsed header — always visible
        html += '<div data-brief-slug="'+esc(p.slug)+'" class="brief-row-header" style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;user-select:none">';
        html += '<i class="ti ti-'+(p.page_type==='home'?'home':p.page_type==='service'?'briefcase':p.page_type==='location'?'map-pin':p.page_type==='industry'?'building-factory':p.page_type==='blog'?'article':'file')+'" style="font-size:12px;color:'+(isBriefed?'var(--green)':'var(--n2)')+';flex-shrink:0"></i>';
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap">';
        html += '<span style="font-size:12.5px;font-weight:'+(isApproved?'600':'400')+';color:'+(isApproved||isOpen?'var(--dark)':'var(--n3)')+'">'+esc(p.page_name)+'</span>';
        html += '<span style="font-size:10px;color:'+pColor+';background:rgba(0,0,0,0.04);border-radius:3px;padding:0 5px;flex-shrink:0">'+esc(p.priority||'')+'</span>';
        html += statusBadge;
        if (kwCount) html += '<span style="font-size:9.5px;color:var(--n2)">'+kwCount+' kw</span>';
        if (qCount)  html += '<span style="font-size:9.5px;color:var(--n2)">'+qCount+' q</span>';
        html += '</div>';
        if (p.primary_keyword) html += '<div style="font-size:10px;color:var(--n2);margin-top:1px;font-family:monospace">'+esc(p.primary_keyword)+' · /'+esc(p.slug||'')+'</div>';
        html += '</div>';
        html += '<i class="ti ti-chevron-'+(isOpen?'up':'down')+'" style="font-size:11px;color:var(--n2);flex-shrink:0"></i>';
        html += '</div>';

        // Expanded body — full pageCard
        if (isOpen) {
          html += '<div style="border-top:1px solid var(--border)">';
          try { html += pageCard(p, pidx); } catch(cardErr) { html += '<div style="padding:10px;color:#e5534b;font-size:11px">Card error: '+cardErr.message+'</div>'; }
          html += '</div>';
        }

        html += '</div>';
      });
    });
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

  // ── PRE-GENERATION VALIDATION ─────────────────────────────────────
  var _warnings = [];
  if (!p.primary_keyword && !['home','about','contact','utility','team'].includes(pt)) {
    _warnings.push('No primary keyword assigned — brief will lack keyword targeting');
  }
  if (!assignedQs.length) {
    _warnings.push('No questions assigned — FAQ section will be generic');
  }
  if (!R.business_overview && !getStrategyField('positioning.value_proposition', 'value_proposition')) {
    _warnings.push('Research incomplete — no business overview or value proposition');
  }
  if (!getStrategyField('positioning.primary_cta', 'primary_cta')) {
    _warnings.push('No primary CTA defined in Strategy — CTA architecture will be generic');
  }
  if (_warnings.length && typeof aiBarNotify === 'function') {
    aiBarNotify('Brief warnings: ' + _warnings.join('. '), { duration: 6000 });
  }

  // ── SHARED CONTEXT ───────────────────────────────────────────────
  var _vp = getStrategyField('positioning.value_proposition', 'value_proposition') || '';
  var _kd = getStrategyField('positioning.key_differentiators', 'key_differentiators') || [];
  var _ep = R.existing_proof || R.proof_points || [];
  var _bv = getStrategyField('brand_strategy.voice_style', 'brand_voice_style') || '';
  var _tv = getStrategyField('brand_strategy.tone_and_voice', 'tone_and_voice') || '';
  var _sl = R.current_slogan || R.slogan_or_tagline || '';
  var _wa = getStrategyField('brand_strategy.words_to_avoid', 'words_to_avoid') || [];
  var _wu = getStrategyField('brand_strategy.words_to_use', 'words_to_use') || [];
  var _pn = R.current_pricing || R.pricing_notes || '';
  var ctxBusiness = [
    'Client: '+(R.client_name||S.setup&&S.setup.client_name||'Unknown'),
    'Industry: '+(R.industry||''),
    'Value proposition: '+_vp,
    'Key differentiators: '+(_kd.length ? _kd.join('; ') : 'none provided'),
    'Proof points: '+(_ep.length ? _ep.join('; ') : 'none provided'),
    'Brand voice: '+(_bv||_tv||'professional'),
    (_sl ? 'Slogan: '+_sl : ''),
    (_wa.length ? 'Words to avoid: '+_wa.join(', ') : ''),
    (_wu.length ? 'Words to use: '+_wu.join(', ') : ''),
    (R.booking_flow_description ? 'Booking flow: '+R.booking_flow_description : ''),
    (_pn ? 'Pricing notes: '+_pn : ''),
  ].filter(function(l){ return l && l.split(': ')[1]; }).join('\n');
  var _webStrategy = (S.strategy&&S.strategy.webStrategy&&S.strategy.webStrategy.trim()) || (S.setup&&S.setup.webStrategy&&S.setup.webStrategy.trim()) || '';
  var _pageCtx = (p.pageContext&&p.pageContext.trim()) || '';
  var _pageGoal = (p.page_goal&&p.page_goal.trim()) || '';
  var ctxWebStrategy = _webStrategy ? '\n\n## WEBSITE STRATEGY (follow this strictly)\n'+_webStrategy : '';

  // Proof & E-E-A-T context
  var _proofLines = [];
  if ((R.case_studies||[]).length) _proofLines.push('Case studies: '+(R.case_studies||[]).slice(0,4).map(function(cs){ return (cs.client||'Client')+' — '+(cs.result||'result')+((cs.timeframe)?' ('+cs.timeframe+')':''); }).join('; '));
  if ((R.notable_clients||[]).length) _proofLines.push('Notable clients: '+R.notable_clients.slice(0,6).join(', '));
  if ((R.awards_certifications||[]).length) _proofLines.push('Awards/certs: '+R.awards_certifications.slice(0,4).join(', '));
  if (R.team_credentials) _proofLines.push('Team credentials: '+R.team_credentials);
  if (R.founder_bio) _proofLines.push('Founder: '+R.founder_bio);
  if ((R.publications_media||[]).length) _proofLines.push('Media: '+R.publications_media.slice(0,3).join(', '));
  var ctxProof = _proofLines.length ? '\n\n## PROOF & E-E-A-T SIGNALS\n'+_proofLines.join('\n') : '';

  // CTA architecture context
  var _ctaLines = [];
  var _pCta = getStrategyField('positioning.primary_cta', 'primary_cta') || '';
  var _sCta = getStrategyField('positioning.secondary_cta', 'secondary_cta') || '';
  var _lCta = getStrategyField('positioning.low_commitment_cta', 'low_commitment_cta') || '';
  if (_pCta) _ctaLines.push('Primary CTA: '+_pCta);
  if (_sCta) _ctaLines.push('Secondary CTA: '+_sCta);
  if (_lCta) _ctaLines.push('Low-commitment CTA: '+_lCta);
  var ctxCTA = _ctaLines.length ? '\n\n## CTA ARCHITECTURE\n'+_ctaLines.join('\n') : '';

  // Services detail context
  var ctxServicesDetail = '';
  if ((R.services_detail||[]).length) {
    ctxServicesDetail = '\n\n## SERVICES DETAIL\n'+(R.services_detail||[]).slice(0,8).map(function(sd){ return '- '+sd.name+(sd.description?' — '+sd.description:'')+(sd.pricing?' (pricing: '+sd.pricing+')':'')+(sd.key_differentiator?' [differentiator: '+sd.key_differentiator+']':''); }).join('\n');
  }

  var ctxAudience = [
    'Primary audience: '+(R.primary_audience_description||((R.current_customer_profile||R.target_audience||[])[0])||''),
    'Best customer example: '+(R.best_customer_examples||''),
    'Buyer roles: '+((R.buyer_roles_titles||[]).join(', ')||''),
    'Top pain points: '+((R.pain_points_top5||[]).slice(0,3).join('; ')||''),
    'Top objections: '+((R.objections_top5||[]).slice(0,3).join('; ')||''),
    'Geography: '+(getPageGeo(p)||R.target_geography||''),
  ].filter(function(l){ return l.split(': ')[1]; }).join('\n');

  var ctxCompetitors = (R.competitors||[]).slice(0,3).map(function(c){
    return '- '+(c.name||c.url||c)+(c.weaknesses?' (weakness: '+c.weaknesses+')':'');
  }).join('\n') || 'None identified';

  var _impliedKw = (!p.primary_keyword && ['home','about','contact','utility','team'].includes((p.page_type||'').toLowerCase()))
    ? (((S.research&&S.research.client_name)||(S.setup&&S.setup.client)||'') + ' ' + p.page_name).trim() : '';
  var ctxKeywords = '**Primary:** '+(p.primary_keyword||(_impliedKw?_impliedKw+' (navigational)':'none'))+' ('+( p.primary_vol||0)+'/mo, KD:'+(p.primary_kd||0)+')\n'
    + (addlKws.length ? '**Supporting:** '+addlKws.join(', ') : '')
    + (existingRkws.length ? '\n**Currently ranking for:** '+existingRkws.join(', ') : '');

  var ctxQuestions = assignedQs.length
    ? assignedQs.map(function(q,i){ return (i+1)+'. '+q; }).join('\n')
    : 'None assigned — suggest 4-6 questions matched to search intent';

  var ctxInternalLinks = (S.pages||[]).filter(function(pg){
    return pg.slug !== p.slug && pg.primary_keyword && (pg.page_type==='service'||pg.page_type==='location'||pg.page_type==='industry');
  }).slice(0,8).map(function(pg){ return '- /'+pg.slug+' ('+pg.primary_keyword+')'; }).join('\n') || 'None available yet';

  // ── SERP INTEL (fetch silently before brief generation, cache per keyword) ──
  var serpBriefBlock = '';
  if (p.primary_keyword) {
    // Skip re-fetch if serpIntel already cached for this keyword
    if (p.serpIntel && p.serpIntel.competitors && p.serpIntel.competitors.length && p.serpIntel._keyword === p.primary_keyword) {
      serpBriefBlock = buildSerpIntelBlock(p);
      if (streamEl) streamEl.textContent = 'Using cached SERP Intel…';
    } else {
      try {
        var country2 = p.targetGeo ? detectCountry(p.targetGeo)
          : (S.kwResearch && S.kwResearch.country) ? S.kwResearch.country.toUpperCase()
          : detectCountry((R.geography && R.geography.primary) || (S.setup && S.setup.geo) || '');
        if (streamEl) streamEl.textContent = 'Fetching SERP Intel for "' + p.primary_keyword + '"…';
        var siRes = await fetch('/api/serp-intel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: p.primary_keyword, country: country2 })
        });
        var siData = await siRes.json();
        if (siData.competitors && siData.competitors.length) {
          siData._keyword = p.primary_keyword; // tag for cache check
          S.pages[pageIdx].serpIntel = siData;
          scheduleSave();
          serpBriefBlock = buildSerpIntelBlock(p);
        }
      } catch(siErr) { /* non-fatal — continue without */ }
    }
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
      + (_webStrategy ? '\n\n## WEBSITE STRATEGY\n'+_webStrategy : '')
      + (_pageCtx ? '\n\n## PAGE-SPECIFIC CONTEXT\n'+_pageCtx : '')
      + (_pageGoal ? '\n\n## PAGE GOAL (this is the strategic purpose — every section of the brief must serve this goal)\n'+_pageGoal : '')
      + ctxProof + ctxCTA + ctxServicesDetail
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
      + (_pageGoal ? '\n\n## PAGE GOAL (this is the strategic purpose — the entire brief must serve this goal)\n'+_pageGoal : '')
      + ctxProof + ctxCTA
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
      + (_pageGoal ? '\n\n## PAGE GOAL (this is the strategic purpose — the entire brief must serve this goal)\n'+_pageGoal : '')
      + ctxProof + ctxCTA + ctxServicesDetail
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

  // ── INPUT SIZE ESTIMATION ─────────────────────────────────────────
  var _estimatedInputChars = (sysPrompt + prompt).length;
  var _estimatedInputTokens = Math.round(_estimatedInputChars / 3.5); // ~3.5 chars per token average
  if (_estimatedInputTokens > 12000 && typeof aiBarNotify === 'function') {
    aiBarNotify('Large input (~' + Math.round(_estimatedInputTokens/1000) + 'k tokens) — brief may take longer', { duration: 4000 });
  }

  var contentEl = document.getElementById('brief-content-'+pageIdx);
  if (contentEl) contentEl.style.display = 'none';
  try {
    window._aiBarLabel = 'Brief: ' + (p.page_name || p.slug);
    if(typeof storePrompt==='function') storePrompt('brief-'+pageIdx, sysPrompt, prompt, 'Brief: '+p.page_name, p.slug+' · '+p.page_type+(p.primary_keyword?' · '+p.primary_keyword:''));
    var briefText = await callClaude(sysPrompt, prompt, function(t){ if(streamEl) { streamEl.style.display = 'block'; streamEl.textContent = t; streamEl.scrollTop = streamEl.scrollHeight; } }, 8000);
    if (!p.brief) p.brief = {};
    p.brief.generated = true;
    p.brief.summary = briefText;
    p.brief.generatedAt = Date.now();
    p.brief.score = null; // reset score — will be evaluated after render
    p.updatedAt = Date.now();
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

// ── QUEUE-BASED BULK GENERATION ──────────────────────────────────────────────
// Submits all un-generated briefs to the Cloudflare Queue.
// Tab-close safe: the worker consumer generates server-side.
// Poll /api/queue-status every 4s and reflect results into S.pages.

var _queuePollTimer = null;

async function queueAllBriefs() {
  var btn = document.getElementById('briefs-queue-btn');
  var statusEl = document.getElementById('briefs-queue-status');
  if (!S.pages || !S.pages.length) return;
  if (!S.currentProject) { if(typeof aiBarNotify==='function') aiBarNotify('No project loaded', {isError:true,duration:3000}); return; }

  var seoPages = S.pages.filter(function(p){ return p.page_type !== 'utility'; });
  var ungenerated = seoPages.filter(function(p){ return !p.brief || !p.brief.generated; });

  if (!ungenerated.length) {
    if (statusEl) { statusEl.style.display = 'inline'; statusEl.textContent = 'All briefs already generated.'; }
    return;
  }

  var jobs = ungenerated.map(function(p){
    return { type: 'brief', slug: p.slug, pageIdx: S.pages.indexOf(p) };
  });

  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:11px;height:11px"></span> Submitting...'; }
  if (statusEl) { statusEl.style.display = 'inline'; statusEl.textContent = 'Submitting ' + jobs.length + ' jobs...'; }

  try {
    var res = await fetch('/api/queue-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: S.currentProject, jobs: jobs }),
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Submit failed');
    if (statusEl) statusEl.textContent = data.submitted.length + ' jobs queued — generating server-side...';
    _startQueuePoll();
  } catch(err) {
    if (statusEl) { statusEl.style.display = 'inline'; statusEl.textContent = 'Queue error: ' + err.message; }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-stack-2"></i> Queue All'; }
  }
}

function _startQueuePoll() {
  if (_queuePollTimer) clearInterval(_queuePollTimer);
  window._queueStartTime = Date.now();
  window._aiStopAll = false;
  _queuePollTimer = setInterval(_pollQueueStatus, 4000);
  if (typeof aiBarQueue === 'function') aiBarQueue(0, jobs.length, 12);
  var stopBtn = document.getElementById('ai-bar-stop');
  if (stopBtn) stopBtn.style.display = 'inline-block';
}

async function _pollQueueStatus() {
  if (!S.currentProject) return;
  try {
    var res = await fetch('/api/queue-status?projectId=' + encodeURIComponent(S.currentProject));
    var data = await res.json();
    var jobs = data.jobs || [];
    if (!jobs.length) return;

    var done = 0; var running = 0; var queued = 0; var failed = 0;
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      if (job.status === 'done') {
        done++;
        // Reload project from KV so the brief shows up without a page refresh
        var idx = job.pageIdx;
        if (idx !== undefined && S.pages[idx] && (!S.pages[idx].brief || !S.pages[idx].brief.generated)) {
          // Trigger a project reload to pick up brief written to KV by worker
          _mergeQueuedBrief(job);
        }
      } else if (job.status === 'running') {
        running++;
      } else if (job.status === 'queued') {
        queued++;
      } else if (job.status === 'failed') {
        failed++;
      }
    }

    var total = jobs.length;
    var statusEl = document.getElementById('briefs-queue-status');
    var btn = document.getElementById('briefs-queue-btn');
    var allSettled = (done + failed) >= total;

    // Update AI bar with real queue progress
    var avgSec = done > 0 ? Math.round((Date.now() - (_queueStartTime||Date.now())) / done / 1000) : 12;
    if (typeof aiBarQueue === 'function') aiBarQueue(done, total, avgSec);

    if (statusEl) {
      if (allSettled) {
        statusEl.textContent = '✓ ' + done + '/' + total + ' done' + (failed ? ' · ' + failed + ' failed' : '') + ' — reload to see all briefs';
      } else {
        statusEl.textContent = done + ' done · ' + running + ' running · ' + queued + ' queued' + (failed ? ' · ' + failed + ' failed' : '');
      }
    }

    if (allSettled) {
      clearInterval(_queuePollTimer);
      _queuePollTimer = null;
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-stack-2"></i> Queue All'; }
      // Reload project from server to get all worker-written briefs
      if (typeof loadProject === 'function') await loadProject(S.currentProject);
      renderBriefs();
    }
  } catch(err) {
    console.warn('[queuePoll] error:', err.message);
    if (err.message && err.message.indexOf('Rate limit') >= 0) aiBarNotify('Queue polling rate limited — slowing down', { duration: 3000 });
  }
}

async function _mergeQueuedBrief(job) {
  // Lightweight merge: reload project once from KV and patch S.pages
  try {
    var res = await fetch('/api/projects/' + encodeURIComponent(S.currentProject));
    if (!res.ok) return;
    var data = await res.json();
    if (data.pages) {
      S.pages = data.pages;
      renderBriefs();
    }
  } catch(e) { /* non-fatal */ }
}

async function generateAllBriefs(startFrom) {
  var btn = document.getElementById('briefs-run-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:12px;height:12px"></span> Generating...'; }
  window._aiStopAll = false;
  var seoPages = S.pages.filter(function(p){ return p.page_type !== 'utility'; });
  var start = startFrom || 0;
  for (var i = start; i < seoPages.length; i++) {
    if (window._aiStopAll) {
      window._aiStopResumeCtx = {
        label: 'Briefs paused (' + i + '/' + seoPages.length + ')',
        fn: function(args) { generateAllBriefs(args.startFrom); },
        args: { startFrom: i }
      };
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-pencil"></i> Write All Briefs'; }
      return;
    }
    var idx = S.pages.indexOf(seoPages[i]);
    try {
      await generatePageBrief(idx);
    } catch(e) { if (e.name === 'AbortError') return; }
    await new Promise(function(r){ setTimeout(r, 400); });
  }
  window._aiStopResumeCtx = null;
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-sparkles"></i> Regenerate All'; }
}

// ── PROGRAMMATIC SITEMAP BUILD FROM CLUSTERS ───────────────────────