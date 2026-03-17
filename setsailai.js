/* ============================================================
   SetSailOS — SetsailAI
   Loaded AFTER index.html + all stage files.
   ============================================================ */

/* ---------- 1. State & Init ---------- */

var _sai = {
  open: false,
  mode: 'ask',
  messages: [],
  auditResults: [],
  pendingFiles: [],
  _streaming: false,
  _abortCtrl: null,
  _lastAuditAt: 0
};

/* ---------- 1b. File Upload ---------- */

var _SAI_MAX_IMAGE = 5 * 1024 * 1024;
var _SAI_MAX_PDF = 10 * 1024 * 1024;
var _SAI_MAX_TEXT = 50 * 1024;
var _SAI_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function saiAttachFile() {
  var fi = document.getElementById('sai-file-input');
  if (fi) { fi.value = ''; fi.click(); }
}

function _saiHandleFiles(fileList) {
  if (!fileList || !fileList.length) return;
  var pending = [];
  for (var i = 0; i < fileList.length; i++) pending.push(fileList[i]);

  pending.forEach(function(file) {
    var ext = (file.name || '').toLowerCase().split('.').pop();
    var category = null;
    var maxSize = 0;

    if (_SAI_IMAGE_TYPES.indexOf(file.type) !== -1) {
      category = 'image'; maxSize = _SAI_MAX_IMAGE;
    } else if (file.type === 'application/pdf' || ext === 'pdf') {
      category = 'pdf'; maxSize = _SAI_MAX_PDF;
    } else if (['txt', 'md', 'csv'].indexOf(ext) !== -1 || (file.type && file.type.startsWith('text/'))) {
      category = 'text'; maxSize = _SAI_MAX_TEXT;
    }

    if (!category) {
      if (typeof aiBarNotify === 'function') aiBarNotify('Unsupported file type: ' + file.name, { duration: 4000 });
      return;
    }
    if (file.size > maxSize) {
      var limitMB = (maxSize / (1024 * 1024)).toFixed(0);
      if (typeof aiBarNotify === 'function') aiBarNotify('File too large: ' + file.name + ' (max ' + limitMB + 'MB)', { duration: 4000 });
      return;
    }

    if (category === 'text') {
      var reader = new FileReader();
      reader.onload = function(e) {
        _sai.pendingFiles.push({ name: file.name, type: file.type, category: 'text', data: e.target.result, size: file.size });
        _saiRenderFileChips();
      };
      reader.readAsText(file);
    } else {
      var reader2 = new FileReader();
      reader2.onload = function(e) {
        var dataUrl = e.target.result || '';
        var base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
        var mediaType = category === 'pdf' ? 'application/pdf' : file.type;
        _sai.pendingFiles.push({ name: file.name, type: mediaType, category: category, data: base64, size: file.size });
        _saiRenderFileChips();
      };
      reader2.readAsDataURL(file);
    }
  });
}

function _saiRenderFileChips() {
  var el = document.getElementById('sai-file-chips');
  if (!el) return;
  if (!_sai.pendingFiles.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'flex';
  el.innerHTML = '';
  _sai.pendingFiles.forEach(function(f, idx) {
    var chip = document.createElement('div');
    chip.className = 'sai-file-chip';
    var iconClass = f.category === 'image' ? 'ti-photo' : f.category === 'pdf' ? 'ti-file-type-pdf' : 'ti-file-text';
    var sizeLabel = f.size < 1024 ? f.size + 'B' : f.size < 1048576 ? (f.size / 1024).toFixed(0) + 'KB' : (f.size / 1048576).toFixed(1) + 'MB';
    var icon = document.createElement('i');
    icon.className = 'ti ' + iconClass;
    icon.style.cssText = 'font-size:12px;flex-shrink:0';
    var nameSpan = document.createElement('span');
    nameSpan.textContent = f.name;
    var sizeSpan = document.createElement('span');
    sizeSpan.style.cssText = 'font-size:9px;color:var(--n2);flex-shrink:0';
    sizeSpan.textContent = sizeLabel;
    var removeBtn = document.createElement('button');
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = (function(i) { return function() { _saiRemoveFile(i); }; })(idx);
    chip.appendChild(icon);
    chip.appendChild(nameSpan);
    chip.appendChild(sizeSpan);
    chip.appendChild(removeBtn);
    el.appendChild(chip);
  });
}

function _saiRemoveFile(idx) {
  _sai.pendingFiles.splice(idx, 1);
  _saiRenderFileChips();
}

function initSai() {
  /* Note: toggle, send, mode buttons, and overlay already have inline onclick
     handlers in index.html. Do NOT add duplicate addEventListener here. */

  var input = document.getElementById('sai-input');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saiSend();
      }
    });
    /* Paste handler for images */
    input.addEventListener('paste', function(e) {
      var items = (e.clipboardData || {}).items;
      if (!items) return;
      var imageFiles = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          var f = items[i].getAsFile();
          if (f) imageFiles.push(f);
        }
      }
      if (imageFiles.length) {
        e.preventDefault();
        _saiHandleFiles(imageFiles);
      }
    });
  }

  /* File input change handler */
  var fileInput = document.getElementById('sai-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      _saiHandleFiles(this.files);
    });
  }

  /* Drag-and-drop on panel */
  var panel = document.getElementById('sai-panel');
  if (panel) {
    panel.addEventListener('dragover', function(e) {
      e.preventDefault();
      panel.classList.add('sai-dragover');
    });
    panel.addEventListener('dragleave', function(e) {
      e.preventDefault();
      panel.classList.remove('sai-dragover');
    });
    panel.addEventListener('drop', function(e) {
      e.preventDefault();
      panel.classList.remove('sai-dragover');
      if (e.dataTransfer && e.dataTransfer.files.length) {
        _saiHandleFiles(e.dataTransfer.files);
      }
    });
  }

  document.addEventListener('click', _saiExplainHandler, true);

  setTimeout(function() { runSaiAudit(); }, 2000);
}

/* ---------- 2. Panel Toggle & Mode Switch ---------- */

function toggleSai() {
  _sai.open = !_sai.open;
  var panel = document.getElementById('sai-panel');
  var overlay = document.getElementById('sai-overlay');
  if (panel) panel.classList.toggle('open', _sai.open);
  if (overlay) overlay.classList.toggle('open', _sai.open);
  document.body.classList.toggle('sai-open', _sai.open);

  /* Close help panel if open */
  var helpPanel = document.getElementById('help-panel');
  if (helpPanel && helpPanel.classList.contains('open')) {
    helpPanel.classList.remove('open');
  }

  if (_sai.open && _sai.mode === 'audit') {
    _renderAuditPanel();
  }
}

function setSaiMode(mode) {
  _sai.mode = mode;
  var modes = ['ask', 'audit', 'explain'];
  modes.forEach(function(m) {
    var btn = document.getElementById('sai-mode-' + m);
    if (btn) btn.classList.toggle('active', m === mode);
  });

  var askArea = document.getElementById('sai-ask-area');
  var auditArea = document.getElementById('sai-audit-area');
  var inputRow = document.getElementById('sai-input');
  var sendBtn = document.getElementById('sai-send');

  if (askArea) askArea.style.display = (mode === 'ask' || mode === 'explain') ? '' : 'none';
  if (auditArea) auditArea.style.display = (mode === 'audit') ? 'block' : 'none';
  if (inputRow) inputRow.style.display = (mode === 'audit') ? 'none' : '';
  if (sendBtn) sendBtn.style.display = (mode === 'audit') ? 'none' : '';
  var attachBtn = document.getElementById('sai-attach');
  if (attachBtn) attachBtn.style.display = (mode === 'audit') ? 'none' : '';
  var chipRow = document.getElementById('sai-file-chips');
  if (chipRow && mode === 'audit') chipRow.style.display = 'none';

  /* Toggle explain-mode highlight class on body */
  document.body.classList.toggle('sai-explain', mode === 'explain');

  var hintArea = document.getElementById('sai-explain-hint');
  if (hintArea) hintArea.style.display = (mode === 'explain') ? '' : 'none';

  if (mode === 'audit') {
    /* Always run a fresh audit when switching to audit mode */
    if (S && S.projectId) runSaiAudit();
    _renderAuditPanel();
  }
  if (mode === 'explain') {
    _addSaiSystemMsg('Explain mode active — click any highlighted element to learn about it.');
  }
}

function _addSaiSystemMsg(text) {
  var area = document.getElementById('sai-ask-area');
  if (!area) return;
  var div = document.createElement('div');
  div.className = 'sai-system-msg';
  div.style.cssText = 'padding:8px 12px;margin:6px 0;font-size:12px;color:#8899aa;text-align:center;font-style:italic;';
  div.textContent = text;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

/* ---------- 3. Chat / Ask Mode ---------- */

function _saiCallClaude(system, userMsg, onChunk) {
  if (_sai._abortCtrl) _sai._abortCtrl.abort();
  _sai._abortCtrl = new AbortController();
  _sai._streaming = true;

  var body = {
    model: 'claude-sonnet-4-20250514',
    system: system,
    messages: [{ role: 'user', content: userMsg }],
    max_tokens: Array.isArray(userMsg) ? 4096 : 2048,
    stream: true
  };

  /* Include recent conversation history (last 6 turns) for continuity */
  if (_sai.messages.length > 1) {
    var hist = _sai.messages.slice(-7, -1).map(function(m) {
      return { role: m.role, content: m.content };
    });
    body.messages = hist.concat(body.messages);
  }

  return fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: _sai._abortCtrl.signal
  }).then(function(res) {
    if (!res.ok) throw new Error('Claude API returned ' + res.status);
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    function pump() {
      return reader.read().then(function(result) {
        if (result.done) {
          _sai._streaming = false;
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(function(line) {
          if (!line.startsWith('data: ')) return;
          var raw = line.slice(6).trim();
          if (raw === '[DONE]') return;
          try {
            var evt = JSON.parse(raw);
            if (evt.type === 'content_block_delta' && evt.delta && evt.delta.text) {
              onChunk(evt.delta.text);
            }
          } catch (_e) { /* skip unparseable */ }
        });
        return pump();
      });
    }
    return pump();
  }).catch(function(err) {
    _sai._streaming = false;
    if (err.name === 'AbortError') return;
    throw err;
  });
}

function saiSend() {
  var input = document.getElementById('sai-input');
  if (!input) return;
  var text = input.value.trim();
  var hasFiles = _sai.pendingFiles.length > 0;
  if ((!text && !hasFiles) || _sai._streaming) return;
  input.value = '';

  /* Build content blocks when files are attached */
  var userContent = text;
  var historyContent = text;
  var bubbleContent = text;

  if (hasFiles) {
    var contentBlocks = [];
    var fileDescriptions = [];

    _sai.pendingFiles.forEach(function(f) {
      if (f.category === 'image') {
        contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: f.type, data: f.data } });
        fileDescriptions.push('[Attached image: ' + f.name + ']');
      } else if (f.category === 'pdf') {
        contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
        fileDescriptions.push('[Attached PDF: ' + f.name + ']');
      } else if (f.category === 'text') {
        contentBlocks.push({ type: 'text', text: '--- File: ' + f.name + ' ---\n' + f.data });
        fileDescriptions.push('[Attached text: ' + f.name + ']');
      }
    });

    if (text) contentBlocks.push({ type: 'text', text: text });
    userContent = contentBlocks;
    historyContent = (fileDescriptions.length ? fileDescriptions.join('\n') + '\n' : '') + text;
    bubbleContent = (fileDescriptions.length ? fileDescriptions.join(' ') + (text ? '\n' + text : '') : text);
  }

  _sai.messages.push({ role: 'user', content: historyContent, ts: Date.now() });
  _addChatBubble('user', bubbleContent, false);

  var system = _assembleSaiContext(text, hasFiles);
  var bubble = _addChatBubble('assistant', '', true);
  var fullText = '';

  _saiCallClaude(system, userContent, function(chunk) {
    fullText += chunk;
    /* Hide action block from live render — show only the explanation */
    var displayText = fullText.replace(/:::ACTION[\s\S]*?:::END/g, '\n\n*Preparing proposed changes…*').replace(/:::ACTION[\s\S]*$/g, '\n\n*Preparing proposed changes…*');
    bubble.innerHTML = _saiMd(displayText);
    var area = document.getElementById('sai-ask-area');
    if (area) area.scrollTop = area.scrollHeight;
  }).then(function() {
    _sai.messages.push({ role: 'assistant', content: fullText, ts: Date.now() });
    /* Clear staged files */
    _sai.pendingFiles = [];
    _saiRenderFileChips();
    /* Parse and render any action blocks */
    var actionMatch = fullText.match(/:::ACTION\s*([\s\S]*?)\s*:::END/);
    var displayText = fullText.replace(/:::ACTION[\s\S]*?:::END/g, '').trim();
    bubble.innerHTML = _saiMd(displayText);
    if (actionMatch) {
      try {
        var actionJson = actionMatch[1].trim();
        /* Strip markdown code fences if Claude wrapped it */
        actionJson = actionJson.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');
        var action = JSON.parse(actionJson);
        _renderActionConfirmation(action, bubble);
      } catch (parseErr) {
        var errDiv = document.createElement('div');
        errDiv.style.cssText = 'margin-top:8px;padding:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:11px;color:#991b1b;';
        errDiv.textContent = 'Could not parse proposed action: ' + parseErr.message;
        bubble.appendChild(errDiv);
      }
    }
    var area = document.getElementById('sai-ask-area');
    if (area) area.scrollTop = area.scrollHeight;
  }).catch(function(err) {
    bubble.innerHTML = '<span style="color:#e74c3c;">Error: ' + esc(err.message) + '</span>';
  });
}

function _assembleSaiContext(question, hasFiles) {
  var ctx = '';
  var q = (question || '').toLowerCase();

  /* --- Layer 0: core identifiers (~200 tokens) --- */
  var l0 = {};
  if (S && S.setup) {
    l0.client_name = S.setup.client_name || '';
    l0.url = S.setup.url || '';
    l0.geo = S.setup.geo || '';
  }
  if (S && S.research) {
    l0.industry = S.research.industry || '';
    l0.primary_services = (S.research.primary_services || []).slice(0, 5);
  }
  if (S && S.strategy && S.strategy.positioning) {
    l0.selected_direction = S.strategy.positioning.selected_direction || '';
  }
  // Client goals (from Setup → Research)
  if (S && S.research && S.research.goal_statement) {
    l0.client_goal = S.research.goal_statement;
    if (S.research.goal_target) l0.goal_target = S.research.goal_target;
    if (S.research.goal_timeline) l0.goal_timeline = S.research.goal_timeline;
  }
  l0.current_stage = (S && S.stage) || 'unknown';
  ctx += 'CORE:\n' + JSON.stringify(l0, null, 0) + '\n\n';

  /* --- Layer 1: strategy overview (~500 tokens) --- */
  if (S && S.strategy) {
    if (S.strategy.compiled_output) {
      ctx += 'STRATEGY OVERVIEW:\n' + _saiTruncate(S.strategy.compiled_output, 2000) + '\n\n';
    } else {
      var stratSummary = {};
      if (S.strategy.positioning) stratSummary.positioning = S.strategy.positioning.selected_direction || '';
      if (S.strategy.audience) stratSummary.audience_summary = (S.strategy.audience.target_definition || '').slice(0, 300);
      if (S.strategy.unit_economics) {
        stratSummary.cpl = S.strategy.unit_economics.cpl;
        stratSummary.ltv = S.strategy.unit_economics.ltv;
      }
      if (S.strategy.overall_score) stratSummary.overall_score = S.strategy.overall_score;
      ctx += 'STRATEGY SUMMARY:\n' + JSON.stringify(stratSummary, null, 0) + '\n\n';
    }
  }

  /* --- Layer 2: stage-specific context --- */
  var stage = (S && S.stage) || '';
  if (stage === 'research' && S && S.research) {
    ctx += 'RESEARCH DATA:\n' + _saiTruncate(S.research, 3000) + '\n\n';
  } else if (stage === 'strategy' && S && S.strategy) {
    var tabKey = _saiCurrentStrategyTab();
    if (tabKey && S.strategy[tabKey]) {
      ctx += 'CURRENT STRATEGY TAB (' + tabKey + '):\n' + _saiTruncate(S.strategy[tabKey], 2500) + '\n\n';
    }
  } else if (stage === 'keywords' && S && S.kwResearch) {
    var kwSummary = {};
    kwSummary.seeds_count = (S.kwResearch.seeds || []).length;
    kwSummary.keywords_count = (S.kwResearch.keywords || []).length;
    var sorted = (S.kwResearch.keywords || []).slice().sort(function(a, b) { return (b.vol || 0) - (a.vol || 0); });
    kwSummary.top_20_by_volume = sorted.slice(0, 20).map(function(k) { return { kw: k.kw, vol: k.vol, kd: k.kd, bid: k.high_bid || null, ad_comp: k.ad_competition || null }; });
    kwSummary.cluster_names = (S.kwResearch.clusters || []).map(function(c) { return c.name || c.label; });
    ctx += 'KEYWORDS:\n' + JSON.stringify(kwSummary, null, 0) + '\n\n';
  } else if (stage === 'sitemap' && S && S.pages) {
    var pageCompact = (S.pages || []).slice(0, 40).map(function(p) {
      return { slug: p.slug, page_type: p.page_type, primary_keyword: p.primary_keyword, vol: p.vol, awareness_stage: p.awareness_stage };
    });
    ctx += 'SITEMAP (' + (S.pages || []).length + ' pages):\n' + JSON.stringify(pageCompact, null, 0) + '\n\n';
  } else if (stage === 'briefs' && S && S.briefs) {
    var currentSlug = _saiCurrentBriefSlug();
    if (currentSlug && S.briefs[currentSlug]) {
      ctx += 'CURRENT BRIEF (' + currentSlug + '):\n' + _saiTruncate(S.briefs[currentSlug], 3000) + '\n\n';
    }
  } else if (stage === 'copy' && S && S.copy) {
    var cpSlug = _saiCurrentCopySlug();
    if (cpSlug && S.copy[cpSlug]) {
      ctx += 'CURRENT COPY (' + cpSlug + '):\n' + _saiTruncate(S.copy[cpSlug], 3000) + '\n\n';
    }
  }

  /* --- Layer 3: question-keyword routing --- */
  if (q.indexOf('keyword') !== -1 || q.indexOf(' kw') !== -1 || q.indexOf('seo') !== -1) {
    if (S && S.kwResearch && S.kwResearch.keywords) {
      var kwBrief = {};
      kwBrief.total = S.kwResearch.keywords.length;
      var s2 = S.kwResearch.keywords.slice().sort(function(a, b) { return (b.vol || 0) - (a.vol || 0); });
      kwBrief.top_15 = s2.slice(0, 15).map(function(k) { return k.kw + ' (' + (k.vol || 0) + ')'; });
      kwBrief.clusters = (S.kwResearch.clusters || []).length;
      ctx += 'KEYWORD DETAIL:\n' + JSON.stringify(kwBrief, null, 0) + '\n\n';
    }
  }
  if (q.indexOf('budget') !== -1 || q.indexOf('cost') !== -1 || q.indexOf('invest') !== -1 || q.indexOf('price') !== -1) {
    if (S && S.strategy) {
      var econ = {};
      if (S.strategy.unit_economics) econ.unit_economics = S.strategy.unit_economics;
      if (S.strategy.engagement_scope) econ.engagement_scope = S.strategy.engagement_scope;
      ctx += 'ECONOMICS:\n' + _saiTruncate(econ, 2000) + '\n\n';
    }
  }
  if (q.indexOf('competitor') !== -1) {
    if (S && S.research && S.research.competitors) {
      ctx += 'COMPETITORS:\n' + _saiTruncate(S.research.competitors, 2000) + '\n\n';
    }
  }
  if (q.indexOf('persona') !== -1 || q.indexOf('audience') !== -1) {
    if (S && S.strategy && S.strategy.audience) {
      ctx += 'AUDIENCE:\n' + _saiTruncate(S.strategy.audience, 2000) + '\n\n';
    }
  }
  if (q.indexOf('position') !== -1 || q.indexOf('brand') !== -1 || q.indexOf('direction') !== -1) {
    if (S && S.strategy && S.strategy.positioning) {
      ctx += 'POSITIONING:\n' + _saiTruncate(S.strategy.positioning, 2000) + '\n\n';
    }
  }
  /* slug-specific routing */
  if (q.indexOf('page') !== -1 || q.indexOf('slug') !== -1 || q.indexOf('/') !== -1) {
    if (S && S.pages) {
      var matchedPage = null;
      S.pages.forEach(function(p) {
        if (p.slug && q.indexOf(p.slug) !== -1) matchedPage = p;
      });
      if (matchedPage) {
        ctx += 'PAGE DETAIL (' + matchedPage.slug + '):\n' + _saiTruncate(matchedPage, 2000) + '\n\n';
        if (S.briefs && S.briefs[matchedPage.slug]) {
          ctx += 'BRIEF FOR ' + matchedPage.slug + ':\n' + _saiTruncate(S.briefs[matchedPage.slug], 1500) + '\n\n';
        }
        if (S.copy && S.copy[matchedPage.slug]) {
          ctx += 'COPY FOR ' + matchedPage.slug + ':\n' + _saiTruncate(S.copy[matchedPage.slug], 1500) + '\n\n';
        }
      }
    }
  }

  var systemPrompt = 'You are a senior marketing strategist embedded in SetSailOS, a website build pipeline tool for digital agencies. You answer questions from the account manager or strategist working on this project.\n\n'
    + 'RULES:\n'
    + '- Ground every answer in the project data provided. If data doesn\'t exist yet, say so: "This hasn\'t been generated yet — run [specific step] first."\n'
    + '- Cite your source: "According to D2 (Competitive Position)...", "The sitemap shows...", "Page /services has..."\n'
    + '- Canadian spelling (colour, centre, analyse, favour, behaviour)\n'
    + '- Be concise — bullet points for lists, no filler\n'
    + '- Never fabricate data. If uncertain, say so.\n'
    + '- When giving recommendations, reference specific diagnostics, scores, or metrics.\n\n'
    + 'ACTIONS — MODIFYING THE PROJECT:\n'
    + 'When the user asks you to CHANGE something (add pages, remove pages, rename, reassign keywords, update fields, etc.), you can propose an action.\n'
    + 'ALWAYS explain what you are about to do BEFORE the action block. Be explicit about what will change and what the consequences are.\n'
    + 'Output the action as a fenced JSON block with the marker :::ACTION and :::END like this:\n\n'
    + ':::ACTION\n'
    + '{"type":"<action_type>", ...params}\n'
    + ':::END\n\n'
    + 'Supported action types:\n\n'
    + '1. **sitemap_replace** — Replace entire sitemap with new pages:\n'
    + '   {"type":"sitemap_replace","pages":[{"slug":"/about","page_name":"About Us","page_type":"about","primary_keyword":"about company name","search_intent":"navigational"},...]}\n'
    + '   Each page needs: slug, page_name, page_type (home/service/blog/about/contact/location/industry/case-study/faq/resource/portfolio/utility), primary_keyword (optional), search_intent (informational/commercial/transactional/navigational, optional).\n\n'
    + '2. **sitemap_add** — Add pages to existing sitemap:\n'
    + '   {"type":"sitemap_add","pages":[{"slug":"/new-page","page_name":"New Page","page_type":"service","primary_keyword":"target keyword"}]}\n\n'
    + '3. **sitemap_remove** — Remove pages by slug:\n'
    + '   {"type":"sitemap_remove","slugs":["/old-page","/unused-page"]}\n\n'
    + '4. **sitemap_update** — Update specific fields on existing pages:\n'
    + '   {"type":"sitemap_update","changes":[{"slug":"/services","fields":{"primary_keyword":"new keyword","page_type":"service","awareness_stage":"product_aware","target_persona":"The Decision Maker"}}]}\n\n'
    + '5. **research_update** — Update research fields:\n'
    + '   {"type":"research_update","fields":{"industry":"SaaS","primary_services":["SEO","PPC"]}}\n\n'
    + '6. **strategy_update** — Update strategy fields (use carefully):\n'
    + '   {"type":"strategy_update","path":"positioning.selected_direction","value":"The Growth Partner"}\n\n'
    + 'SAFETY RULES FOR ACTIONS:\n'
    + '- NEVER propose an action unless the user explicitly asks for a change.\n'
    + '- ALWAYS explain the full impact before the action block (e.g. "This will remove 3 pages and their briefs/copy will be orphaned").\n'
    + '- For sitemap_replace: warn that this replaces ALL existing pages, briefs, and associated data.\n'
    + '- For destructive actions (remove, replace): list exactly what will be lost.\n'
    + '- Only ONE action block per response. If multiple changes are needed, do them in one block or ask which to do first.\n'
    + '- If the user is vague, ask clarifying questions INSTEAD of proposing an action.\n\n'
    + 'PROJECT CONTEXT:\n' + ctx;

  if (hasFiles) {
    systemPrompt += '\n\nFILE ATTACHMENTS:\n'
      + 'The user has attached files to this message. Analyse them thoroughly.\n'
      + '- If it is a sitemap or page list, you can propose a sitemap_replace or sitemap_add action.\n'
      + '- If it is a document with research data, you can propose a research_update action.\n'
      + '- If it is a screenshot or image, describe what you see and relate it to the project context.\n'
      + '- Always summarise the key content of the file before proposing actions.\n';
  }

  return systemPrompt;
}

function _saiCurrentStrategyTab() {
  var tabs = document.querySelectorAll('.strategy-tab.active, .strat-tab.active, [data-strat-tab].active');
  if (tabs.length) {
    return tabs[0].getAttribute('data-strat-tab') || tabs[0].getAttribute('data-tab') || '';
  }
  return '';
}

function _saiCurrentBriefSlug() {
  var el = document.querySelector('.brief-active, .brief-editor[data-slug]');
  return el ? (el.getAttribute('data-slug') || '') : '';
}

function _saiCurrentCopySlug() {
  var el = document.querySelector('.copy-active, .copy-editor[data-slug]');
  return el ? (el.getAttribute('data-slug') || '') : '';
}

function _renderSaiChat() {
  var area = document.getElementById('sai-ask-area');
  if (!area) return;
  area.innerHTML = '';
  _sai.messages.forEach(function(m) {
    _addChatBubble(m.role, m.content, false);
  });
}

function _addChatBubble(role, content, streaming) {
  var area = document.getElementById('sai-ask-area');
  if (!area) return null;
  var wrap = document.createElement('div');
  wrap.className = 'sai-msg sai-msg-' + role;
  wrap.style.cssText = 'margin:8px 0;padding:10px 14px;border-radius:10px;font-size:13px;line-height:1.55;max-width:92%;word-wrap:break-word;';
  if (role === 'user') {
    wrap.style.cssText += 'background:#e8f0fe;align-self:flex-end;margin-left:auto;';
  } else {
    wrap.style.cssText += 'background:#f4f5f7;align-self:flex-start;';
  }
  if (streaming) {
    wrap.innerHTML = '<span class="sai-typing" style="opacity:0.5;">Thinking…</span>';
  } else {
    wrap.innerHTML = role === 'user' ? esc(content) : _saiMd(content);
  }
  area.appendChild(wrap);
  area.scrollTop = area.scrollHeight;
  return wrap;
}

function _saiMd(text) {
  if (!text) return '';
  var html = esc(text);
  /* code blocks */
  html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#1e1e2e;color:#cdd6f4;padding:10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:6px 0;"><code>$1</code></pre>');
  /* inline code */
  html = html.replace(/`([^`]+)`/g, '<code style="background:#e8e8ee;padding:1px 5px;border-radius:3px;font-size:12px;">$1</code>');
  /* bold */
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  /* italic */
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  /* bullet lists — lines starting with "- " */
  html = html.replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc;">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="padding-left:4px;margin:4px 0;">$&</ul>');
  /* numbered lists */
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin-left:16px;list-style:decimal;">$1</li>');
  /* line breaks */
  html = html.replace(/\n/g, '<br>');
  return html;
}

/* ---------- 4. Audit Engine ---------- */

var SAI_AUDIT_CHECKS = [
  /* --- RESEARCH --- */
  { id: 'r-no-name', stage: 'research', severity: 'error', message: 'Client name is missing',
    test: function() { return !(S && S.research && S.research.client_name); },
    fix_action: { stage: 'research' } },
  { id: 'r-no-services', stage: 'research', severity: 'error', message: 'Primary services list is empty',
    test: function() { return !(S && S.research && S.research.primary_services && S.research.primary_services.length); },
    fix_action: { stage: 'research' } },
  { id: 'r-no-audience', stage: 'research', severity: 'warning', message: 'Primary audience description is missing',
    test: function() { return !(S && S.research && S.research.primary_audience_description); },
    fix_action: { stage: 'research' } },
  { id: 'r-no-industry', stage: 'research', severity: 'error', message: 'Industry field is empty',
    test: function() { return !(S && S.research && S.research.industry); },
    fix_action: { stage: 'research' } },
  { id: 'r-no-pain', stage: 'research', severity: 'warning', message: 'Pain points (top 5) not documented',
    test: function() { return !(S && S.research && S.research.pain_points_top5 && S.research.pain_points_top5.length); },
    fix_action: { stage: 'research' } },

  /* --- KEYWORDS --- */
  { id: 'kw-none', stage: 'keywords', severity: 'error', message: 'No keywords collected',
    test: function() { return !(S && S.kwResearch && S.kwResearch.keywords && S.kwResearch.keywords.length); },
    fix_action: { stage: 'keywords' } },
  { id: 'kw-no-clusters', stage: 'keywords', severity: 'warning', message: 'Keywords have not been clustered',
    test: function() { return S && S.kwResearch && S.kwResearch.keywords && S.kwResearch.keywords.length && !(S.kwResearch.clusters && S.kwResearch.clusters.length); },
    fix_action: { stage: 'keywords' } },
  { id: 'kw-low-count', stage: 'keywords', severity: 'warning', message: 'Fewer than 20 keywords — consider expanding',
    test: function() { return S && S.kwResearch && S.kwResearch.keywords && S.kwResearch.keywords.length > 0 && S.kwResearch.keywords.length < 20; },
    fix_action: { stage: 'keywords' } },
  { id: 'kw-no-gkp', stage: 'keywords', severity: 'info', message: 'Keywords not enriched with Google Ads bid data — enrich for more accurate CPC estimates',
    test: function() { return S && S.kwResearch && S.kwResearch.keywords && S.kwResearch.keywords.length > 10 && !S.kwResearch.keywords.some(function(k) { return k.low_bid; }); },
    fix_action: { stage: 'strategy', tab: 'economics' } },

  /* --- STRATEGY --- */
  { id: 'st-not-run', stage: 'strategy', severity: 'error', message: 'Strategy has not been generated yet',
    test: function() { return !(S && S.strategy && S.strategy._meta && S.strategy._meta.current_version > 0); },
    fix_action: { stage: 'strategy' } },
  { id: 'st-no-direction', stage: 'strategy', severity: 'error', message: 'No competitive direction selected',
    test: function() { return S && S.strategy && S.strategy._meta && S.strategy._meta.current_version > 0 && !(S.strategy.positioning && S.strategy.positioning.selected_direction); },
    fix_action: { stage: 'strategy', tab: 'positioning' } },
  { id: 'st-no-compile', stage: 'strategy', severity: 'warning', message: 'Strategy has not been compiled',
    test: function() { return S && S.strategy && S.strategy._meta && S.strategy._meta.current_version > 0 && !S.strategy.compiled_output; },
    fix_action: { stage: 'strategy' } },
  { id: 'st-low-score', stage: 'strategy', severity: 'warning', message: 'Overall strategy score is below 5.0',
    test: function() { return S && S.strategy && typeof S.strategy.overall_score === 'number' && S.strategy.overall_score < 5.0; },
    detail: function() { return 'Current score: ' + (S.strategy.overall_score || 0).toFixed(1) + '/10'; },
    fix_action: { stage: 'strategy' } },
  { id: 'st-kw-stale', stage: 'strategy', severity: 'warning', message: 'Strategy may be stale — keywords changed since last run',
    test: function() { return S && S.strategy && S.strategy._kwDataStale === true; },
    fix_action: { stage: 'strategy' } },
  { id: 'st-research-stale', stage: 'strategy', severity: 'warning', message: 'Research was updated after strategy was generated — strategy may be based on outdated data',
    test: function() {
      if (!(S && S.strategy && S.strategy._meta && S.strategy._meta._completedAt && S.research && S.research._updatedAt)) return false;
      return S.research._updatedAt > S.strategy._meta._completedAt;
    },
    detail: function() {
      var rDate = new Date(S.research._updatedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      var sDate = new Date(S.strategy._meta._completedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return 'Research updated ' + rDate + ' — Strategy last run ' + sDate;
    },
    fix_action: { stage: 'strategy' } },
  { id: 'st-no-econ', stage: 'strategy', severity: 'warning', message: 'Unit economics (CPL) not calculated',
    test: function() { return S && S.strategy && S.strategy._meta && S.strategy._meta.current_version > 0 && !(S.strategy.unit_economics && S.strategy.unit_economics.cpl); },
    fix_action: { stage: 'strategy', tab: 'economics' } },
  { id: 'st-no-perception', stage: 'strategy', severity: 'info', message: 'Category perception analysis not available',
    test: function() { return S && S.strategy && S.strategy._meta && S.strategy._meta.current_version > 0 && !(S.strategy.positioning && S.strategy.positioning.category_perception); },
    fix_action: { stage: 'strategy', tab: 'positioning' } },
  { id: 'st-no-alternatives', stage: 'strategy', severity: 'info', message: 'Perceived alternatives list is thin (fewer than 2)',
    test: function() {
      if (!(S && S.strategy && S.strategy.audience && S.strategy.audience.perceived_alternatives)) return true;
      return S.strategy.audience.perceived_alternatives.length < 2;
    },
    fix_action: { stage: 'strategy', tab: 'audience' } },

  /* --- SITEMAP --- */
  { id: 'sm-no-pages', stage: 'sitemap', severity: 'error', message: 'No pages in the sitemap',
    test: function() { return !(S && S.pages && S.pages.length); },
    fix_action: { stage: 'sitemap' } },
  { id: 'sm-no-kw', stage: 'sitemap', severity: 'warning', message: 'Some pages are missing a primary keyword',
    test: function() {
      if (!(S && S.pages && S.pages.length)) return false;
      var skip = ['/', '/home', '/about', '/contact', '/about-us', '/contact-us'];
      return S.pages.some(function(p) { return skip.indexOf(p.slug) === -1 && !p.primary_keyword; });
    },
    detail: function() {
      var skip = ['/', '/home', '/about', '/contact', '/about-us', '/contact-us'];
      var missing = (S.pages || []).filter(function(p) { return skip.indexOf(p.slug) === -1 && !p.primary_keyword; });
      return missing.map(function(p) { return p.slug; }).join(', ');
    },
    fix_action: { stage: 'sitemap' } },
  { id: 'sm-cannibal', stage: 'sitemap', severity: 'error', message: 'Duplicate primary keywords detected (cannibalisation risk)',
    test: function() {
      if (!(S && S.pages && S.pages.length)) return false;
      var seen = {};
      var dupes = false;
      S.pages.forEach(function(p) {
        if (!p.primary_keyword) return;
        var k = p.primary_keyword.toLowerCase().trim();
        if (seen[k]) dupes = true;
        seen[k] = (seen[k] || 0) + 1;
      });
      return dupes;
    },
    detail: function() {
      var seen = {};
      (S.pages || []).forEach(function(p) {
        if (!p.primary_keyword) return;
        var k = p.primary_keyword.toLowerCase().trim();
        seen[k] = seen[k] || [];
        seen[k].push(p.slug);
      });
      var lines = [];
      Object.keys(seen).forEach(function(k) {
        if (seen[k].length > 1) lines.push('"' + k + '" on: ' + seen[k].join(', '));
      });
      return lines.join('; ');
    },
    fix_action: { stage: 'sitemap' } },
  { id: 'sm-no-type', stage: 'sitemap', severity: 'warning', message: 'Some pages are missing a page type',
    test: function() {
      if (!(S && S.pages && S.pages.length)) return false;
      return S.pages.some(function(p) { return !p.page_type; });
    },
    fix_action: { stage: 'sitemap' } },
  { id: 'sm-no-awareness', stage: 'sitemap', severity: 'info', message: 'Some pages lack an awareness stage assignment',
    test: function() {
      if (!(S && S.pages && S.pages.length)) return false;
      return S.pages.some(function(p) { return !p.awareness_stage; });
    },
    fix_action: { stage: 'sitemap' } },
  { id: 'sm-strategy-stale', stage: 'sitemap', severity: 'warning', message: 'Strategy was updated after sitemap was built — sitemap may not reflect current strategy',
    test: function() {
      if (!(S && S._sitemapBuiltAt && S.strategy && S.strategy._meta && S.strategy._meta._completedAt)) return false;
      return S.strategy._meta._completedAt > S._sitemapBuiltAt;
    },
    detail: function() {
      var smDate = new Date(S._sitemapBuiltAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      var stDate = new Date(S.strategy._meta._completedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return 'Sitemap built ' + smDate + ' — Strategy updated ' + stDate;
    },
    fix_action: { stage: 'sitemap' } },

  /* --- BRIEFS --- */
  { id: 'br-missing', stage: 'briefs', severity: 'warning', message: 'Some pages do not have briefs generated',
    test: function() {
      if (!(S && S.pages && S.pages.length)) return false;
      if (!S.briefs) return true;
      return S.pages.some(function(p) { return !S.briefs[p.slug]; });
    },
    detail: function() {
      if (!(S && S.pages)) return '';
      return S.pages.filter(function(p) { return !(S.briefs && S.briefs[p.slug]); }).map(function(p) { return p.slug; }).slice(0, 15).join(', ');
    },
    fix_action: { stage: 'briefs' } },
  { id: 'br-stale', stage: 'briefs', severity: 'warning', message: 'Some briefs may be outdated — strategy was updated after they were generated',
    test: function() {
      if (!(S && S.strategy && S.strategy._meta && S.strategy._meta._completedAt)) return false;
      var stratAt = S.strategy._meta._completedAt;
      if (!S.pages || !S.pages.length) return false;
      return S.pages.some(function(p) {
        return p.brief && p.brief.generatedAt && p.brief.generatedAt < stratAt;
      });
    },
    detail: function() {
      var stratAt = S.strategy._meta._completedAt;
      var stale = (S.pages || []).filter(function(p) { return p.brief && p.brief.generatedAt && p.brief.generatedAt < stratAt; });
      return stale.map(function(p) { return p.slug; }).slice(0, 10).join(', ');
    },
    fix_action: { stage: 'briefs' } },

  /* --- COPY --- */
  { id: 'cp-missing', stage: 'copy', severity: 'warning', message: 'Some pages do not have copy written',
    test: function() {
      if (!(S && S.pages && S.pages.length)) return false;
      if (!S.copy) return true;
      return S.pages.some(function(p) { return !S.copy[p.slug]; });
    },
    detail: function() {
      if (!(S && S.pages)) return '';
      return S.pages.filter(function(p) { return !(S.copy && S.copy[p.slug]); }).map(function(p) { return p.slug; }).slice(0, 15).join(', ');
    },
    fix_action: { stage: 'copy' } },
  { id: 'cp-stale', stage: 'copy', severity: 'info', message: 'Some copy is older than its corresponding brief',
    test: function() {
      if (!(S && S.copy && S.briefs)) return false;
      return Object.keys(S.copy).some(function(slug) {
        var c = S.copy[slug];
        var b = S.briefs[slug];
        return c && b && c._ts && b._ts && c._ts < b._ts;
      });
    },
    fix_action: { stage: 'copy' } },
  { id: 'cp-audit-fail', stage: 'copy', severity: 'warning', message: 'Some pages have failed copy audits',
    test: function() {
      if (!(S && S.copy)) return false;
      return Object.keys(S.copy).some(function(slug) {
        var c = S.copy[slug];
        return c && c.audit && c.audit.passed === false;
      });
    },
    detail: function() {
      if (!S.copy) return '';
      return Object.keys(S.copy).filter(function(slug) {
        var c = S.copy[slug];
        return c && c.audit && c.audit.passed === false;
      }).slice(0, 10).join(', ');
    },
    fix_action: { stage: 'copy' } },

  /* --- LATER STAGES --- */
  { id: 'ly-none', stage: 'layout', severity: 'info', message: 'Layout stage has not been started',
    test: function() { return !(S && S.layout && Object.keys(S.layout).length); },
    fix_action: { stage: 'layout' } },
  { id: 'ly-brief-stale', stage: 'layout', severity: 'warning', message: 'Some layouts were generated before their briefs were updated',
    test: function() {
      if (!(S && S.layout && S.pages && S.pages.length)) return false;
      return S.pages.some(function(p) {
        var ly = S.layout[p.slug];
        return ly && ly.generatedAt && p.brief && p.brief.generatedAt && ly.generatedAt < p.brief.generatedAt;
      });
    },
    fix_action: { stage: 'layout' } },
  { id: 'sc-none', stage: 'schema', severity: 'info', message: 'Schema markup has not been generated',
    test: function() { return !(S && S.schema && Object.keys(S.schema).length); },
    fix_action: { stage: 'schema' } },
  { id: 'im-none', stage: 'images', severity: 'info', message: 'Image generation has not been started',
    test: function() { return !(S && S.images && Object.keys(S.images).length); },
    fix_action: { stage: 'images' } }
];

function runSaiAudit() {
  /* Skip audit when no project is loaded — checks would fire against empty state */
  if (!(S && S.projectId)) {
    _sai.auditResults = [];
    _sai._lastAuditAt = 0;
    _updateSaiBadge();
    if (_sai.open && _sai.mode === 'audit') _renderAuditPanel();
    return [];
  }
  var results = [];
  SAI_AUDIT_CHECKS.forEach(function(check) {
    try {
      if (check.test()) {
        var item = {
          id: check.id,
          stage: check.stage,
          severity: check.severity,
          message: check.message,
          fix_action: check.fix_action
        };
        if (check.detail) {
          try { item.detail = check.detail(); } catch (_e) { item.detail = ''; }
        }
        results.push(item);
      }
    } catch (_e) { /* skip broken check */ }
  });

  /* Sort: error first, then warning, then info */
  var order = { error: 0, warning: 1, info: 2 };
  results.sort(function(a, b) { return (order[a.severity] || 9) - (order[b.severity] || 9); });

  _sai.auditResults = results;
  _sai._lastAuditAt = Date.now();
  _updateSaiBadge();

  if (_sai.open && _sai.mode === 'audit') {
    _renderAuditPanel();
  }

  return results;
}

function _renderAuditPanel() {
  var area = document.getElementById('sai-audit-area');
  if (!area) return;
  area.innerHTML = '';

  if (!_sai.auditResults.length) {
    if (!(S && S.projectId)) {
      area.innerHTML = '<div style="padding:32px 20px;text-align:center;color:#8899aa;font-size:13px;line-height:1.6;">'
        + '<i class="ti ti-folder-open" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.5"></i>'
        + 'Open a project to run the audit.<br>'
        + '<span style="font-size:11px;">The audit checks research, strategy, sitemap, briefs, and copy for gaps, staleness, and issues.</span>'
        + '</div>';
    } else {
      area.innerHTML = '<div style="padding:32px 20px;text-align:center;color:var(--green);font-size:13px;line-height:1.6;">'
        + '<i class="ti ti-circle-check" style="font-size:28px;display:block;margin-bottom:10px"></i>'
        + 'No issues found — looking good!<br>'
        + '<span style="font-size:11px;color:#8899aa;">' + SAI_AUDIT_CHECKS.length + ' checks passed across all stages.</span>'
        + '</div>';
    }
    return;
  }

  /* Group by stage */
  var groups = {};
  var stageOrder = [];
  _sai.auditResults.forEach(function(r) {
    if (!groups[r.stage]) {
      groups[r.stage] = [];
      stageOrder.push(r.stage);
    }
    groups[r.stage].push(r);
  });

  stageOrder.forEach(function(stage) {
    var items = groups[stage];
    /* Header */
    var header = document.createElement('div');
    header.style.cssText = 'padding:10px 14px 4px;font-size:12px;font-weight:600;text-transform:uppercase;color:#667788;display:flex;align-items:center;gap:6px;margin-top:8px;';
    header.innerHTML = '<i class="' + _saiStageIcon(stage) + '" style="font-size:14px;"></i> ' + esc(stage) + ' <span style="background:#e8eaee;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:500;">' + items.length + '</span>';
    area.appendChild(header);

    items.forEach(function(issue) {
      var card = document.createElement('div');
      card.style.cssText = 'margin:4px 10px;padding:10px 12px;background:var(--white);border-radius:8px;border:1px solid var(--border);display:flex;align-items:flex-start;gap:8px;font-size:13px;';

      var icon = '';
      if (issue.severity === 'error') {
        icon = '<span style="color:#e74c3c;font-size:10px;line-height:1;margin-top:3px;">&#9679;</span>';
      } else if (issue.severity === 'warning') {
        icon = '<span style="color:#f39c12;font-size:12px;line-height:1;margin-top:1px;">&#9650;</span>';
      } else {
        icon = '<span style="color:#aab3bb;font-size:10px;line-height:1;margin-top:3px;">&#9679;</span>';
      }

      var detailHtml = '';
      if (issue.detail) {
        detailHtml = '<div style="font-size:11px;color:#8899aa;margin-top:3px;word-break:break-all;">' + esc(issue.detail) + '</div>';
      }

      card.innerHTML = icon + '<div style="flex:1;">' + esc(issue.message) + detailHtml + '</div>';

      var goBtn = document.createElement('button');
      goBtn.textContent = 'Go \u2192';
      goBtn.style.cssText = 'flex-shrink:0;background:none;border:1px solid #d0d5dd;border-radius:5px;padding:3px 10px;font-size:11px;cursor:pointer;color:#3366cc;white-space:nowrap;';
      goBtn.onclick = (function(iss) { return function() { _saiGoToIssue(iss); }; })(issue);
      card.appendChild(goBtn);

      area.appendChild(card);
    });
  });
}

function _updateSaiBadge() {
  var badge = document.getElementById('sai-badge');
  if (!badge) return;
  var errors = 0;
  var warnings = 0;
  _sai.auditResults.forEach(function(r) {
    if (r.severity === 'error') errors++;
    if (r.severity === 'warning') warnings++;
  });
  var total = errors + warnings;
  if (total === 0) {
    badge.style.display = 'none';
    badge.textContent = '';
  } else {
    badge.style.display = '';
    badge.textContent = total;
    badge.style.background = errors > 0 ? '#e74c3c' : '#f39c12';
    badge.style.color = '#fff';
  }
}

function _saiGoToIssue(issue) {
  if (!issue || !issue.fix_action) return;
  var stage = issue.fix_action.stage;
  /* Keywords lives inside strategy stage */
  if (stage === 'keywords') stage = 'strategy';
  if (typeof goTo === 'function') goTo(stage);
  if (issue.fix_action.tab) {
    setTimeout(function() {
      var tab = issue.fix_action.tab;
      /* Strategy tabs: set _sTab directly and re-render */
      if (stage === 'strategy' && typeof _sTab !== 'undefined') {
        _sTab = tab;
        if (typeof renderStrategyNav === 'function') renderStrategyNav();
        if (typeof renderStrategyTabContent === 'function') renderStrategyTabContent();
        return;
      }
      /* Fallback: try clicking a matching tab button */
      var tabBtn = document.querySelector('[data-strat-tab="' + tab + '"], [data-tab="' + tab + '"]');
      if (tabBtn) tabBtn.click();
    }, 300);
  }
  /* Close the SetsailAI panel so the user can see the destination */
  if (_sai.open) toggleSai();
}

/* ---------- 5. Explain Mode ---------- */

function _saiExplainHandler(e) {
  if (!_sai.open || _sai.mode !== 'explain') return;

  var el = e.target;
  var depth = 0;
  while (el && depth < 8) {
    if (el.hasAttribute && el.hasAttribute('data-sai-explain')) {
      e.preventDefault();
      e.stopPropagation();
      var key = el.getAttribute('data-sai-explain');
      _saiExplain(key);
      return;
    }
    el = el.parentElement;
    depth++;
  }
}

function _saiExplain(key) {
  if (!key) return;
  var parts = key.split(':');
  var type = parts[0] || '';
  var identifier = parts.slice(1).join(':') || '';
  var context = '';
  var label = key;

  if (type === 'diagnostic') {
    var diagMap = { D0: 'audience', D1: 'demand_landscape', D2: 'positioning', D3: 'content_strategy', D4: 'channel_strategy', D5: 'unit_economics' };
    var diagKey = diagMap[identifier] || identifier;
    if (S && S.strategy && S.strategy[diagKey]) {
      context = JSON.stringify(S.strategy[diagKey]).slice(0, 3000);
    }
    label = 'Diagnostic ' + identifier + ' (' + (diagKey) + ')';
  } else if (type === 'page') {
    if (S && S.pages) {
      var pg = S.pages.find(function(p) { return p.slug === identifier; });
      if (pg) context = JSON.stringify(pg).slice(0, 3000);
    }
    label = 'Page ' + identifier;
  } else if (type === 'cluster') {
    if (S && S.kwResearch && S.kwResearch.clusters) {
      var cl = S.kwResearch.clusters.find(function(c) { return (c.name || c.label) === identifier; });
      if (cl) context = JSON.stringify(cl).slice(0, 3000);
    }
    label = 'Keyword cluster "' + identifier + '"';
  } else if (type === 'field') {
    if (S && S.research && S.research[identifier] !== undefined) {
      context = JSON.stringify(S.research[identifier]).slice(0, 2000);
    }
    label = 'Research field "' + identifier + '"';
  }

  /* Switch to ask mode and auto-send */
  setSaiMode('ask');
  var question = 'Explain this: ' + label + '. Why does it have its current value? What data drove this?';
  if (context) question += '\n\nData:\n' + context;

  _sai.messages.push({ role: 'user', content: question, ts: Date.now() });
  _addChatBubble('user', 'Explain: ' + label, false);

  var system = _assembleSaiContext(question);
  var bubble = _addChatBubble('assistant', '', true);
  var fullText = '';

  _saiCallClaude(system, question, function(chunk) {
    fullText += chunk;
    bubble.innerHTML = _saiMd(fullText);
    var area = document.getElementById('sai-ask-area');
    if (area) area.scrollTop = area.scrollHeight;
  }).then(function() {
    _sai.messages.push({ role: 'assistant', content: fullText, ts: Date.now() });
    bubble.innerHTML = _saiMd(fullText);
  }).catch(function(err) {
    bubble.innerHTML = '<span style="color:#e74c3c;">Error: ' + esc(err.message) + '</span>';
  });
}

/* ---------- 6. Proactive Notifications ---------- */

function _saiPostGenAudit() {
  var previousIds = {};
  _sai.auditResults.forEach(function(r) { previousIds[r.id] = true; });

  var results = runSaiAudit();
  var newIssues = results.filter(function(r) {
    return !previousIds[r.id] && r.severity !== 'info';
  });

  if (newIssues.length > 0) {
    var errCount = newIssues.filter(function(r) { return r.severity === 'error'; }).length;
    var warnCount = newIssues.filter(function(r) { return r.severity === 'warning'; }).length;
    var parts = [];
    if (errCount) parts.push(errCount + ' error' + (errCount > 1 ? 's' : ''));
    if (warnCount) parts.push(warnCount + ' warning' + (warnCount > 1 ? 's' : ''));
    var msg = 'SetsailAI found ' + parts.join(' and ') + ' — open the SetsailAI panel to review.';
    if (typeof aiBarNotify === 'function') {
      aiBarNotify(msg, { type: errCount ? 'error' : 'warning', duration: 5000 });
    }
  }
}

/* ---------- 7. Utility ---------- */

function _saiStageIcon(stage) {
  var icons = {
    research: 'ti ti-search',
    keywords: 'ti ti-key',
    strategy: 'ti ti-chess',
    sitemap: 'ti ti-sitemap',
    briefs: 'ti ti-file-text',
    copy: 'ti ti-pencil',
    layout: 'ti ti-layout',
    schema: 'ti ti-code',
    images: 'ti ti-photo',
    export: 'ti ti-download'
  };
  return icons[stage] || 'ti ti-circle';
}

function _saiTruncate(obj, maxChars) {
  var str;
  if (typeof obj === 'string') {
    str = obj;
  } else {
    try { str = JSON.stringify(obj); } catch (_e) { str = String(obj); }
  }
  if (str.length > maxChars) return str.slice(0, maxChars) + '…';
  return str;
}

/* ---------- 8. Action System — SetsailAI Modifications ---------- */

/**
 * Render an action confirmation card below the assistant bubble.
 * Shows exactly what will change + Apply / Dismiss buttons.
 */
function _renderActionConfirmation(action, parentBubble) {
  var card = document.createElement('div');
  card.style.cssText = 'margin-top:10px;border:1px solid #d1d5db;border-radius:8px;overflow:hidden;font-size:11px;';

  /* Header */
  var header = document.createElement('div');
  header.style.cssText = 'background:#f0fdf4;padding:8px 12px;border-bottom:1px solid #d1d5db;display:flex;align-items:center;gap:6px;';
  header.innerHTML = '<i class="ti ti-edit" style="color:#16a34a;font-size:13px;"></i><strong style="color:#15803d;">Proposed Change</strong><span style="color:#6b7280;margin-left:auto;font-size:10px;">' + esc(action.type || 'unknown') + '</span>';
  card.appendChild(header);

  /* Impact summary */
  var body = document.createElement('div');
  body.style.cssText = 'padding:10px 12px;background:var(--white);';
  var impact = _describeActionImpact(action);
  body.innerHTML = impact;
  card.appendChild(body);

  /* Buttons */
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'padding:8px 12px;border-top:1px solid #e5e7eb;display:flex;gap:8px;justify-content:flex-end;background:#fafafa;';

  var dismissBtn = document.createElement('button');
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.style.cssText = 'padding:4px 14px;border-radius:4px;border:1px solid #d1d5db;background:var(--white);color:#6b7280;font-size:11px;cursor:pointer;font-family:var(--font);';
  dismissBtn.onclick = function() {
    card.style.opacity = '0.5';
    card.style.pointerEvents = 'none';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'text-align:center;padding:6px;color:#9ca3af;font-size:10px;font-style:italic;';
    lbl.textContent = 'Dismissed';
    card.innerHTML = '';
    card.appendChild(lbl);
    card.style.opacity = '1';
    _sai.messages.push({ role: 'assistant', content: '[Action dismissed by user]', ts: Date.now() });
  };

  var applyBtn = document.createElement('button');
  applyBtn.textContent = 'Apply Changes';
  applyBtn.style.cssText = 'padding:4px 14px;border-radius:4px;border:none;background:#16a34a;color:white;font-size:11px;cursor:pointer;font-family:var(--font);font-weight:600;';
  applyBtn.onclick = function() {
    var result = _executeAction(action);
    card.innerHTML = '';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'text-align:center;padding:10px;font-size:11px;';
    if (result.ok) {
      lbl.style.color = '#16a34a';
      lbl.innerHTML = '<i class="ti ti-check" style="font-size:13px;margin-right:4px;"></i>' + esc(result.message);
    } else {
      lbl.style.color = '#dc2626';
      lbl.innerHTML = '<i class="ti ti-alert-triangle" style="font-size:13px;margin-right:4px;"></i>' + esc(result.message);
    }
    card.appendChild(lbl);
    _sai.messages.push({ role: 'assistant', content: '[Action applied: ' + result.message + ']', ts: Date.now() });
  };

  btnRow.appendChild(dismissBtn);
  btnRow.appendChild(applyBtn);
  card.appendChild(btnRow);

  parentBubble.appendChild(card);
}

/**
 * Generate a human-readable impact description for an action.
 */
function _describeActionImpact(action) {
  var html = '';
  var t = action.type || '';

  if (t === 'sitemap_replace') {
    var newPages = action.pages || [];
    var existing = (S.pages || []).length;
    html += '<div style="margin-bottom:6px;color:#991b1b;font-weight:600;"><i class="ti ti-alert-triangle" style="font-size:11px;"></i> This will replace all ' + existing + ' existing pages with ' + newPages.length + ' new pages.</div>';
    html += '<div style="margin-bottom:4px;color:#6b7280;">Existing briefs and copy for removed pages will be orphaned.</div>';
    html += '<div style="margin-top:6px;font-weight:600;">New pages:</div><ul style="margin:4px 0 0 16px;">';
    newPages.forEach(function(p) {
      html += '<li><code>' + esc(p.slug || '') + '</code> — ' + esc(p.page_name || '') + ' <span style="color:#6b7280;">(' + esc(p.page_type || '?') + ')</span></li>';
    });
    html += '</ul>';
  } else if (t === 'sitemap_add') {
    var addPages = action.pages || [];
    html += '<div style="margin-bottom:6px;">Adding <strong>' + addPages.length + ' page' + (addPages.length !== 1 ? 's' : '') + '</strong> to the sitemap:</div>';
    html += '<ul style="margin:0 0 0 16px;">';
    addPages.forEach(function(p) {
      html += '<li><code>' + esc(p.slug || '') + '</code> — ' + esc(p.page_name || '') + ' <span style="color:#6b7280;">(' + esc(p.page_type || '?') + ')</span></li>';
    });
    html += '</ul>';
  } else if (t === 'sitemap_remove') {
    var slugs = action.slugs || [];
    html += '<div style="margin-bottom:6px;color:#991b1b;"><i class="ti ti-alert-triangle" style="font-size:11px;"></i> Removing <strong>' + slugs.length + ' page' + (slugs.length !== 1 ? 's' : '') + '</strong>:</div>';
    html += '<ul style="margin:0 0 0 16px;">';
    slugs.forEach(function(sl) {
      html += '<li><code>' + esc(sl) + '</code></li>';
    });
    html += '</ul>';
    html += '<div style="margin-top:4px;color:#6b7280;">Briefs and copy for these pages will remain but become orphaned.</div>';
  } else if (t === 'sitemap_update') {
    var changes = action.changes || [];
    html += '<div style="margin-bottom:6px;">Updating <strong>' + changes.length + ' page' + (changes.length !== 1 ? 's' : '') + '</strong>:</div>';
    changes.forEach(function(ch) {
      html += '<div style="margin:4px 0;"><code>' + esc(ch.slug || '') + '</code>:';
      var fields = ch.fields || {};
      Object.keys(fields).forEach(function(k) {
        html += ' <span style="color:#6b7280;">' + esc(k) + '</span> → <strong>' + esc(String(fields[k])) + '</strong>';
      });
      html += '</div>';
    });
  } else if (t === 'research_update') {
    var fields = action.fields || {};
    var keys = Object.keys(fields);
    html += '<div style="margin-bottom:6px;">Updating <strong>' + keys.length + ' research field' + (keys.length !== 1 ? 's' : '') + '</strong>:</div>';
    keys.forEach(function(k) {
      var val = fields[k];
      var display = Array.isArray(val) ? val.join(', ') : String(val);
      if (display.length > 80) display = display.slice(0, 80) + '…';
      html += '<div style="margin:2px 0;"><span style="color:#6b7280;">' + esc(k) + '</span> → <strong>' + esc(display) + '</strong></div>';
    });
  } else if (t === 'strategy_update') {
    html += '<div style="margin-bottom:6px;">Updating strategy field:</div>';
    html += '<div><span style="color:#6b7280;">' + esc(action.path || '') + '</span> → <strong>' + esc(String(action.value || '').slice(0, 120)) + '</strong></div>';
  } else {
    html += '<div style="color:#6b7280;">Unknown action type: ' + esc(t) + '</div>';
  }

  return html;
}

/**
 * Execute a confirmed action — modifies S.* state, re-renders, saves.
 * Returns {ok: bool, message: string}
 */
function _executeAction(action) {
  var t = action.type || '';

  try {
    if (t === 'sitemap_replace') {
      return _execSitemapReplace(action);
    } else if (t === 'sitemap_add') {
      return _execSitemapAdd(action);
    } else if (t === 'sitemap_remove') {
      return _execSitemapRemove(action);
    } else if (t === 'sitemap_update') {
      return _execSitemapUpdate(action);
    } else if (t === 'research_update') {
      return _execResearchUpdate(action);
    } else if (t === 'strategy_update') {
      return _execStrategyUpdate(action);
    }
    return { ok: false, message: 'Unknown action type: ' + t };
  } catch (err) {
    return { ok: false, message: 'Error: ' + err.message };
  }
}

/* --- Sitemap Replace --- */
function _execSitemapReplace(action) {
  var newPages = action.pages || [];
  if (!newPages.length) return { ok: false, message: 'No pages provided' };

  S.pages = newPages.map(function(p) {
    var page = {
      slug: (p.slug || '').replace(/^\//, '/'),
      page_name: p.page_name || p.slug || '',
      page_type: p.page_type || 'utility',
      primary_keyword: p.primary_keyword || '',
      search_intent: p.search_intent || '',
      keywords: [],
      supporting_keywords: [],
      vol: 0,
      priority: p.priority || 'medium',
      target_persona: p.target_persona || '',
      voice_overlay: p.voice_overlay || '',
      awareness_stage: p.awareness_stage || '',
      page_goal: p.page_goal || '',
      brief: null,
      content_pillar: p.content_pillar || ''
    };
    /* Auto-infer awareness stage if not provided */
    if (!page.awareness_stage && typeof _inferAwarenessStage === 'function') {
      page.awareness_stage = _inferAwarenessStage(page);
    }
    return page;
  });

  S._sitemapBuiltAt = Date.now();
  _saiReRenderAndSave('sitemap');
  return { ok: true, message: 'Sitemap replaced with ' + S.pages.length + ' pages. Review and assign keywords.' };
}

/* --- Sitemap Add --- */
function _execSitemapAdd(action) {
  var newPages = action.pages || [];
  if (!newPages.length) return { ok: false, message: 'No pages to add' };
  if (!S.pages) S.pages = [];

  /* Check for duplicate slugs */
  var existingSlugs = {};
  S.pages.forEach(function(p) { existingSlugs[p.slug] = true; });
  var added = 0;

  newPages.forEach(function(p) {
    var slug = (p.slug || '').replace(/^([^/])/, '/$1');
    if (existingSlugs[slug]) return; /* skip duplicates */
    var page = {
      slug: slug,
      page_name: p.page_name || slug,
      page_type: p.page_type || 'utility',
      primary_keyword: p.primary_keyword || '',
      search_intent: p.search_intent || '',
      keywords: [],
      supporting_keywords: [],
      vol: 0,
      priority: p.priority || 'medium',
      target_persona: p.target_persona || '',
      voice_overlay: p.voice_overlay || '',
      awareness_stage: p.awareness_stage || '',
      page_goal: p.page_goal || '',
      brief: null,
      content_pillar: p.content_pillar || ''
    };
    if (!page.awareness_stage && typeof _inferAwarenessStage === 'function') {
      page.awareness_stage = _inferAwarenessStage(page);
    }
    S.pages.push(page);
    existingSlugs[slug] = true;
    added++;
  });

  _saiReRenderAndSave('sitemap');
  return { ok: true, message: 'Added ' + added + ' page' + (added !== 1 ? 's' : '') + '. Total: ' + S.pages.length };
}

/* --- Sitemap Remove --- */
function _execSitemapRemove(action) {
  var slugs = action.slugs || [];
  if (!slugs.length) return { ok: false, message: 'No slugs to remove' };
  if (!S.pages) return { ok: false, message: 'No sitemap exists' };

  var removeSet = {};
  slugs.forEach(function(s) { removeSet[s] = true; });
  var before = S.pages.length;
  S.pages = S.pages.filter(function(p) { return !removeSet[p.slug]; });
  var removed = before - S.pages.length;

  _saiReRenderAndSave('sitemap');
  return { ok: true, message: 'Removed ' + removed + ' page' + (removed !== 1 ? 's' : '') + '. ' + S.pages.length + ' remaining.' };
}

/* --- Sitemap Update --- */
function _execSitemapUpdate(action) {
  var changes = action.changes || [];
  if (!changes.length) return { ok: false, message: 'No changes specified' };
  if (!S.pages) return { ok: false, message: 'No sitemap exists' };

  var updated = 0;
  var slugIndex = {};
  S.pages.forEach(function(p, i) { slugIndex[p.slug] = i; });

  changes.forEach(function(ch) {
    var idx = slugIndex[ch.slug];
    if (idx === undefined) return;
    var fields = ch.fields || {};
    /* Whitelist of safe fields to update */
    var SAFE_FIELDS = ['page_name', 'page_type', 'primary_keyword', 'search_intent', 'priority',
      'target_persona', 'voice_overlay', 'awareness_stage', 'page_goal', 'content_pillar', 'slug'];
    Object.keys(fields).forEach(function(k) {
      if (SAFE_FIELDS.indexOf(k) === -1) return; /* skip unsafe fields */
      S.pages[idx][k] = fields[k];
    });
    updated++;
  });

  _saiReRenderAndSave('sitemap');
  return { ok: true, message: 'Updated ' + updated + ' page' + (updated !== 1 ? 's' : '') + '.' };
}

/* --- Research Update --- */
function _execResearchUpdate(action) {
  var fields = action.fields || {};
  var keys = Object.keys(fields);
  if (!keys.length) return { ok: false, message: 'No fields to update' };
  if (!S.research) S.research = {};

  /* Whitelist of safe research fields */
  var SAFE_RESEARCH = ['client_name', 'industry', 'primary_services', 'secondary_services',
    'primary_audience_description', 'service_areas', 'pain_points_top5', 'buying_triggers',
    'decision_factors', 'unique_value_proposition', 'brand_voice_tone', 'brand_personality',
    'tagline', 'content_themes', 'notable_clients', 'awards'];
  var updated = 0;

  keys.forEach(function(k) {
    if (SAFE_RESEARCH.indexOf(k) === -1) return;
    S.research[k] = fields[k];
    updated++;
  });

  _saiReRenderAndSave('research');
  return { ok: true, message: 'Updated ' + updated + ' research field' + (updated !== 1 ? 's' : '') + '.' };
}

/* --- Strategy Update --- */
function _execStrategyUpdate(action) {
  var path = action.path || '';
  var value = action.value;
  if (!path) return { ok: false, message: 'No path specified' };
  if (!S.strategy) return { ok: false, message: 'Strategy not initialised' };

  /* Only allow safe top-level paths */
  var SAFE_PATHS = ['positioning.selected_direction', 'positioning.value_proposition',
    'brand_strategy.voice', 'brand_strategy.tone', 'channel_strategy.recommended_tier'];
  if (SAFE_PATHS.indexOf(path) === -1) {
    return { ok: false, message: 'Path "' + path + '" is not modifiable via SetsailAI. Only these are allowed: ' + SAFE_PATHS.join(', ') };
  }

  var parts = path.split('.');
  var obj = S.strategy;
  for (var i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]]) obj[parts[i]] = {};
    obj = obj[parts[i]];
  }
  obj[parts[parts.length - 1]] = value;

  _saiReRenderAndSave('strategy');
  return { ok: true, message: 'Updated strategy.' + path };
}

/**
 * Re-render the relevant stage and trigger save after an action.
 */
function _saiReRenderAndSave(stage) {
  /* Re-render current stage if it matches, or the target stage */
  if (S.stage === stage) {
    if (typeof renderStageContent === 'function') renderStageContent(stage);
    if (stage === 'sitemap' && typeof renderSitemapResults === 'function') {
      setTimeout(function() {
        var sr = document.getElementById('sitemap-results');
        if (sr) sr.style.display = '';
        renderSitemapResults(true);
      }, 100);
    }
    if (stage === 'research' && typeof renderResearch === 'function') {
      setTimeout(function() { renderResearch(); }, 100);
    }
    if (stage === 'strategy') {
      if (typeof renderStrategyScorecard === 'function') renderStrategyScorecard();
      if (typeof renderStrategyTabContent === 'function') renderStrategyTabContent();
    }
  }
  scheduleSave();
  /* Re-run audit to catch any new/resolved issues */
  setTimeout(function() { if (typeof runSaiAudit === 'function') runSaiAudit(); }, 300);
}

/* ---------- Auto-init ---------- */
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initSai();
} else {
  document.addEventListener('DOMContentLoaded', initSai);
}
