/* ============================================================
   SetSailOS — AI Copilot
   Loaded AFTER index.html + all stage files.
   ============================================================ */

/* ---------- 1. State & Init ---------- */

var _copilot = {
  open: false,
  mode: 'ask',
  messages: [],
  auditResults: [],
  _streaming: false,
  _abortCtrl: null,
  _lastAuditAt: 0
};

function initCopilot() {
  var toggle = document.getElementById('copilot-toggle');
  if (toggle) toggle.addEventListener('click', toggleCopilot);

  var sendBtn = document.getElementById('copilot-send');
  if (sendBtn) sendBtn.addEventListener('click', copilotSend);

  var input = document.getElementById('copilot-input');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        copilotSend();
      }
    });
  }

  var modeAsk = document.getElementById('copilot-mode-ask');
  var modeAudit = document.getElementById('copilot-mode-audit');
  var modeExplain = document.getElementById('copilot-mode-explain');
  if (modeAsk) modeAsk.addEventListener('click', function() { setCopilotMode('ask'); });
  if (modeAudit) modeAudit.addEventListener('click', function() { setCopilotMode('audit'); });
  if (modeExplain) modeExplain.addEventListener('click', function() { setCopilotMode('explain'); });

  var overlay = document.getElementById('copilot-overlay');
  if (overlay) overlay.addEventListener('click', toggleCopilot);

  document.addEventListener('click', _copilotExplainHandler, true);

  setTimeout(function() { runCopilotAudit(); }, 2000);
}

/* ---------- 2. Panel Toggle & Mode Switch ---------- */

function toggleCopilot() {
  _copilot.open = !_copilot.open;
  var panel = document.getElementById('copilot-panel');
  var overlay = document.getElementById('copilot-overlay');
  if (panel) panel.classList.toggle('open', _copilot.open);
  if (overlay) overlay.classList.toggle('open', _copilot.open);
  document.body.classList.toggle('copilot-open', _copilot.open);

  /* Close help panel if open */
  var helpPanel = document.getElementById('help-panel');
  if (helpPanel && helpPanel.classList.contains('open')) {
    helpPanel.classList.remove('open');
  }

  if (_copilot.open && _copilot.mode === 'audit') {
    _renderAuditPanel();
  }
}

function setCopilotMode(mode) {
  _copilot.mode = mode;
  var modes = ['ask', 'audit', 'explain'];
  modes.forEach(function(m) {
    var btn = document.getElementById('copilot-mode-' + m);
    if (btn) btn.classList.toggle('active', m === mode);
  });

  var askArea = document.getElementById('copilot-ask-area');
  var auditArea = document.getElementById('copilot-audit-area');
  var inputRow = document.getElementById('copilot-input');
  var sendBtn = document.getElementById('copilot-send');

  if (askArea) askArea.style.display = (mode === 'ask' || mode === 'explain') ? '' : 'none';
  if (auditArea) auditArea.style.display = (mode === 'audit') ? '' : 'none';
  if (inputRow) inputRow.style.display = (mode === 'audit') ? 'none' : '';
  if (sendBtn) sendBtn.style.display = (mode === 'audit') ? 'none' : '';

  if (mode === 'audit') _renderAuditPanel();
  if (mode === 'explain') {
    _addCopilotSystemMsg('Explain mode active — click any element with an explanation tag to learn about it.');
  }
}

function _addCopilotSystemMsg(text) {
  var area = document.getElementById('copilot-ask-area');
  if (!area) return;
  var div = document.createElement('div');
  div.className = 'copilot-system-msg';
  div.style.cssText = 'padding:8px 12px;margin:6px 0;font-size:12px;color:#8899aa;text-align:centre;font-style:italic;';
  div.textContent = text;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

/* ---------- 3. Chat / Ask Mode ---------- */

function _copilotCallClaude(system, userMsg, onChunk) {
  if (_copilot._abortCtrl) _copilot._abortCtrl.abort();
  _copilot._abortCtrl = new AbortController();
  _copilot._streaming = true;

  var body = {
    model: 'claude-sonnet-4-20250514',
    system: system,
    messages: [{ role: 'user', content: userMsg }],
    max_tokens: 2048,
    stream: true
  };

  /* Include recent conversation history (last 6 turns) for continuity */
  if (_copilot.messages.length > 1) {
    var hist = _copilot.messages.slice(-7, -1).map(function(m) {
      return { role: m.role, content: m.content };
    });
    body.messages = hist.concat(body.messages);
  }

  return fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: _copilot._abortCtrl.signal
  }).then(function(res) {
    if (!res.ok) throw new Error('Claude API returned ' + res.status);
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    function pump() {
      return reader.read().then(function(result) {
        if (result.done) {
          _copilot._streaming = false;
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
    _copilot._streaming = false;
    if (err.name === 'AbortError') return;
    throw err;
  });
}

function copilotSend() {
  var input = document.getElementById('copilot-input');
  if (!input) return;
  var text = input.value.trim();
  if (!text || _copilot._streaming) return;
  input.value = '';

  _copilot.messages.push({ role: 'user', content: text, ts: Date.now() });
  _addChatBubble('user', text, false);

  var system = _assembleCopilotContext(text);
  var bubble = _addChatBubble('assistant', '', true);
  var fullText = '';

  _copilotCallClaude(system, text, function(chunk) {
    fullText += chunk;
    bubble.innerHTML = _copilotMd(fullText);
    var area = document.getElementById('copilot-ask-area');
    if (area) area.scrollTop = area.scrollHeight;
  }).then(function() {
    _copilot.messages.push({ role: 'assistant', content: fullText, ts: Date.now() });
    bubble.innerHTML = _copilotMd(fullText);
  }).catch(function(err) {
    bubble.innerHTML = '<span style="color:#e74c3c;">Error: ' + esc(err.message) + '</span>';
  });
}

function _assembleCopilotContext(question) {
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
  l0.current_stage = (S && S.stage) || 'unknown';
  ctx += 'CORE:\n' + JSON.stringify(l0, null, 0) + '\n\n';

  /* --- Layer 1: strategy overview (~500 tokens) --- */
  if (S && S.strategy) {
    if (S.strategy.compiled_output) {
      ctx += 'STRATEGY OVERVIEW:\n' + _copilotTruncate(S.strategy.compiled_output, 2000) + '\n\n';
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
    ctx += 'RESEARCH DATA:\n' + _copilotTruncate(S.research, 3000) + '\n\n';
  } else if (stage === 'strategy' && S && S.strategy) {
    var tabKey = _copilotCurrentStrategyTab();
    if (tabKey && S.strategy[tabKey]) {
      ctx += 'CURRENT STRATEGY TAB (' + tabKey + '):\n' + _copilotTruncate(S.strategy[tabKey], 2500) + '\n\n';
    }
  } else if (stage === 'keywords' && S && S.kwResearch) {
    var kwSummary = {};
    kwSummary.seeds_count = (S.kwResearch.seeds || []).length;
    kwSummary.keywords_count = (S.kwResearch.keywords || []).length;
    var sorted = (S.kwResearch.keywords || []).slice().sort(function(a, b) { return (b.vol || 0) - (a.vol || 0); });
    kwSummary.top_20_by_volume = sorted.slice(0, 20).map(function(k) { return { kw: k.kw, vol: k.vol, kd: k.kd }; });
    kwSummary.cluster_names = (S.kwResearch.clusters || []).map(function(c) { return c.name || c.label; });
    ctx += 'KEYWORDS:\n' + JSON.stringify(kwSummary, null, 0) + '\n\n';
  } else if (stage === 'sitemap' && S && S.pages) {
    var pageCompact = (S.pages || []).slice(0, 40).map(function(p) {
      return { slug: p.slug, page_type: p.page_type, primary_keyword: p.primary_keyword, vol: p.vol, awareness_stage: p.awareness_stage };
    });
    ctx += 'SITEMAP (' + (S.pages || []).length + ' pages):\n' + JSON.stringify(pageCompact, null, 0) + '\n\n';
  } else if (stage === 'briefs' && S && S.briefs) {
    var currentSlug = _copilotCurrentBriefSlug();
    if (currentSlug && S.briefs[currentSlug]) {
      ctx += 'CURRENT BRIEF (' + currentSlug + '):\n' + _copilotTruncate(S.briefs[currentSlug], 3000) + '\n\n';
    }
  } else if (stage === 'copy' && S && S.copy) {
    var cpSlug = _copilotCurrentCopySlug();
    if (cpSlug && S.copy[cpSlug]) {
      ctx += 'CURRENT COPY (' + cpSlug + '):\n' + _copilotTruncate(S.copy[cpSlug], 3000) + '\n\n';
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
      ctx += 'ECONOMICS:\n' + _copilotTruncate(econ, 2000) + '\n\n';
    }
  }
  if (q.indexOf('competitor') !== -1) {
    if (S && S.research && S.research.competitors) {
      ctx += 'COMPETITORS:\n' + _copilotTruncate(S.research.competitors, 2000) + '\n\n';
    }
  }
  if (q.indexOf('persona') !== -1 || q.indexOf('audience') !== -1) {
    if (S && S.strategy && S.strategy.audience) {
      ctx += 'AUDIENCE:\n' + _copilotTruncate(S.strategy.audience, 2000) + '\n\n';
    }
  }
  if (q.indexOf('position') !== -1 || q.indexOf('brand') !== -1 || q.indexOf('direction') !== -1) {
    if (S && S.strategy && S.strategy.positioning) {
      ctx += 'POSITIONING:\n' + _copilotTruncate(S.strategy.positioning, 2000) + '\n\n';
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
        ctx += 'PAGE DETAIL (' + matchedPage.slug + '):\n' + _copilotTruncate(matchedPage, 2000) + '\n\n';
        if (S.briefs && S.briefs[matchedPage.slug]) {
          ctx += 'BRIEF FOR ' + matchedPage.slug + ':\n' + _copilotTruncate(S.briefs[matchedPage.slug], 1500) + '\n\n';
        }
        if (S.copy && S.copy[matchedPage.slug]) {
          ctx += 'COPY FOR ' + matchedPage.slug + ':\n' + _copilotTruncate(S.copy[matchedPage.slug], 1500) + '\n\n';
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
    + 'PROJECT CONTEXT:\n' + ctx;

  return systemPrompt;
}

function _copilotCurrentStrategyTab() {
  var tabs = document.querySelectorAll('.strategy-tab.active, .strat-tab.active, [data-strat-tab].active');
  if (tabs.length) {
    return tabs[0].getAttribute('data-strat-tab') || tabs[0].getAttribute('data-tab') || '';
  }
  return '';
}

function _copilotCurrentBriefSlug() {
  var el = document.querySelector('.brief-active, .brief-editor[data-slug]');
  return el ? (el.getAttribute('data-slug') || '') : '';
}

function _copilotCurrentCopySlug() {
  var el = document.querySelector('.copy-active, .copy-editor[data-slug]');
  return el ? (el.getAttribute('data-slug') || '') : '';
}

function _renderCopilotChat() {
  var area = document.getElementById('copilot-ask-area');
  if (!area) return;
  area.innerHTML = '';
  _copilot.messages.forEach(function(m) {
    _addChatBubble(m.role, m.content, false);
  });
}

function _addChatBubble(role, content, streaming) {
  var area = document.getElementById('copilot-ask-area');
  if (!area) return null;
  var wrap = document.createElement('div');
  wrap.className = 'copilot-msg copilot-msg-' + role;
  wrap.style.cssText = 'margin:8px 0;padding:10px 14px;border-radius:10px;font-size:13px;line-height:1.55;max-width:92%;word-wrap:break-word;';
  if (role === 'user') {
    wrap.style.cssText += 'background:#e8f0fe;align-self:flex-end;margin-left:auto;';
  } else {
    wrap.style.cssText += 'background:#f4f5f7;align-self:flex-start;';
  }
  if (streaming) {
    wrap.innerHTML = '<span class="copilot-typing" style="opacity:0.5;">Thinking…</span>';
  } else {
    wrap.innerHTML = role === 'user' ? esc(content) : _copilotMd(content);
  }
  area.appendChild(wrap);
  area.scrollTop = area.scrollHeight;
  return wrap;
}

function _copilotMd(text) {
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

var COPILOT_AUDIT_CHECKS = [
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
  { id: 'st-no-econ', stage: 'strategy', severity: 'warning', message: 'Unit economics (CPL) not calculated',
    test: function() { return S && S.strategy && S.strategy._meta && S.strategy._meta.current_version > 0 && !(S.strategy.unit_economics && S.strategy.unit_economics.cpl); },
    fix_action: { stage: 'strategy', tab: 'unit_economics' } },
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
  { id: 'br-stale', stage: 'briefs', severity: 'info', message: 'Some briefs may be outdated — strategy was updated after they were generated',
    test: function() {
      if (!(S && S.briefs && S.strategy && S.strategy._meta)) return false;
      var stratVer = S.strategy._meta.current_version || 0;
      return Object.keys(S.briefs).some(function(slug) {
        var b = S.briefs[slug];
        return b && b._strategyVersion && b._strategyVersion < stratVer;
      });
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
  { id: 'sc-none', stage: 'schema', severity: 'info', message: 'Schema markup has not been generated',
    test: function() { return !(S && S.schema && Object.keys(S.schema).length); },
    fix_action: { stage: 'schema' } },
  { id: 'im-none', stage: 'images', severity: 'info', message: 'Image generation has not been started',
    test: function() { return !(S && S.images && Object.keys(S.images).length); },
    fix_action: { stage: 'images' } }
];

function runCopilotAudit() {
  var results = [];
  COPILOT_AUDIT_CHECKS.forEach(function(check) {
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

  _copilot.auditResults = results;
  _copilot._lastAuditAt = Date.now();
  _updateCopilotBadge();

  if (_copilot.open && _copilot.mode === 'audit') {
    _renderAuditPanel();
  }

  return results;
}

function _renderAuditPanel() {
  var area = document.getElementById('copilot-audit-area');
  if (!area) return;
  area.innerHTML = '';

  if (!_copilot.auditResults.length) {
    area.innerHTML = '<div style="padding:24px;text-align:center;color:#8899aa;font-size:13px;">No issues found — looking good!</div>';
    return;
  }

  /* Group by stage */
  var groups = {};
  var stageOrder = [];
  _copilot.auditResults.forEach(function(r) {
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
    header.innerHTML = '<i class="' + _copilotStageIcon(stage) + '" style="font-size:14px;"></i> ' + esc(stage) + ' <span style="background:#e8eaee;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:500;">' + items.length + '</span>';
    area.appendChild(header);

    items.forEach(function(issue) {
      var card = document.createElement('div');
      card.style.cssText = 'margin:4px 10px;padding:10px 12px;background:#fff;border-radius:8px;border:1px solid #e8eaee;display:flex;align-items:flex-start;gap:8px;font-size:13px;';

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
      goBtn.onclick = (function(iss) { return function() { _copilotGoToIssue(iss); }; })(issue);
      card.appendChild(goBtn);

      area.appendChild(card);
    });
  });
}

function _updateCopilotBadge() {
  var badge = document.getElementById('copilot-badge');
  if (!badge) return;
  var errors = 0;
  var warnings = 0;
  _copilot.auditResults.forEach(function(r) {
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

function _copilotGoToIssue(issue) {
  if (!issue || !issue.fix_action) return;
  if (typeof goTo === 'function') goTo(issue.fix_action.stage);
  if (issue.fix_action.tab) {
    setTimeout(function() {
      /* Try clicking the matching strategy tab */
      var tabBtn = document.querySelector('[data-strat-tab="' + issue.fix_action.tab + '"], [data-tab="' + issue.fix_action.tab + '"]');
      if (tabBtn) tabBtn.click();
    }, 300);
  }
}

/* ---------- 5. Explain Mode ---------- */

function _copilotExplainHandler(e) {
  if (!_copilot.open || _copilot.mode !== 'explain') return;

  var el = e.target;
  var depth = 0;
  while (el && depth < 8) {
    if (el.hasAttribute && el.hasAttribute('data-copilot-explain')) {
      e.preventDefault();
      e.stopPropagation();
      var key = el.getAttribute('data-copilot-explain');
      _copilotExplain(key);
      return;
    }
    el = el.parentElement;
    depth++;
  }
}

function _copilotExplain(key) {
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
  setCopilotMode('ask');
  var question = 'Explain this: ' + label + '. Why does it have its current value? What data drove this?';
  if (context) question += '\n\nData:\n' + context;

  _copilot.messages.push({ role: 'user', content: question, ts: Date.now() });
  _addChatBubble('user', 'Explain: ' + label, false);

  var system = _assembleCopilotContext(question);
  var bubble = _addChatBubble('assistant', '', true);
  var fullText = '';

  _copilotCallClaude(system, question, function(chunk) {
    fullText += chunk;
    bubble.innerHTML = _copilotMd(fullText);
    var area = document.getElementById('copilot-ask-area');
    if (area) area.scrollTop = area.scrollHeight;
  }).then(function() {
    _copilot.messages.push({ role: 'assistant', content: fullText, ts: Date.now() });
    bubble.innerHTML = _copilotMd(fullText);
  }).catch(function(err) {
    bubble.innerHTML = '<span style="color:#e74c3c;">Error: ' + esc(err.message) + '</span>';
  });
}

/* ---------- 6. Proactive Notifications ---------- */

function _copilotPostGenAudit() {
  var previousIds = {};
  _copilot.auditResults.forEach(function(r) { previousIds[r.id] = true; });

  var results = runCopilotAudit();
  var newIssues = results.filter(function(r) {
    return !previousIds[r.id] && r.severity !== 'info';
  });

  if (newIssues.length > 0) {
    var errCount = newIssues.filter(function(r) { return r.severity === 'error'; }).length;
    var warnCount = newIssues.filter(function(r) { return r.severity === 'warning'; }).length;
    var parts = [];
    if (errCount) parts.push(errCount + ' error' + (errCount > 1 ? 's' : ''));
    if (warnCount) parts.push(warnCount + ' warning' + (warnCount > 1 ? 's' : ''));
    var msg = 'Copilot found ' + parts.join(' and ') + ' — open the copilot panel to review.';
    if (typeof aiBarNotify === 'function') {
      aiBarNotify(msg, { type: errCount ? 'error' : 'warning', duration: 5000 });
    }
  }
}

/* ---------- 7. Utility ---------- */

function _copilotStageIcon(stage) {
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

function _copilotTruncate(obj, maxChars) {
  var str;
  if (typeof obj === 'string') {
    str = obj;
  } else {
    try { str = JSON.stringify(obj); } catch (_e) { str = String(obj); }
  }
  if (str.length > maxChars) return str.slice(0, maxChars) + '…';
  return str;
}

/* ---------- Auto-init ---------- */
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initCopilot();
} else {
  document.addEventListener('DOMContentLoaded', initCopilot);
}
