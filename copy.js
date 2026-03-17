
function focusCopyPage(slug) {
  S.copyCurrentSlug = slug;
  renderCopyQueue();
}

function _buildPainSidebar(page) {
  var cp = (S.research && S.research.clientPain) || {};
  var persona = null;
  if (page.target_persona && S.strategy && S.strategy.audience && S.strategy.audience.personas) {
    persona = S.strategy.audience.personas.find(function(per) { return per.name === page.target_persona; });
  }
  var ep = (persona && persona.executionProfile && persona.executionProfile._enrichedAt) ? persona.executionProfile : null;
  // Only show if we have meaningful data
  if (!cp.primary && !ep) return '';

  var html = '<div style="margin-top:12px;padding:12px;background:var(--panel);border-radius:8px;border:1px solid var(--border)">';
  html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;cursor:pointer" onclick="this.parentElement.classList.toggle(\'_collapsed\')">';
  html += '<i class="ti ti-target" style="font-size:12px;color:var(--acc)"></i>';
  html += '<span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--dark)">Pain Context</span>';
  html += '<i class="ti ti-chevron-down" style="font-size:11px;color:var(--n2);margin-left:auto"></i>';
  html += '</div>';

  // Client Context (Layer 1)
  if (cp.primary) {
    html += '<div style="margin-bottom:10px">';
    html += '<div style="font-size:10px;font-weight:600;color:#f56c6c;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Client Context</div>';
    html += '<div style="font-size:11px;color:var(--dark);margin-bottom:3px"><strong>Hired us because:</strong> ' + esc(cp.primary) + '</div>';
    if (cp.priorAttempts && cp.priorAttempts.length) {
      html += '<div style="font-size:11px;color:var(--n2);margin-bottom:3px"><strong>They tried:</strong></div>';
      cp.priorAttempts.forEach(function(a) {
        html += '<div style="font-size:10px;color:var(--n2);padding-left:8px">· ' + esc(a.what) + ' → ' + esc(a.outcome) + '</div>';
      });
    }
    if (cp.successDefinition) html += '<div style="font-size:11px;color:var(--dark);margin-top:3px"><strong>Success:</strong> ' + esc(cp.successDefinition) + '</div>';
    if (cp.clientQuotes && cp.clientQuotes.length) {
      html += '<div style="font-size:11px;margin-top:3px"><strong>In their words:</strong></div>';
      cp.clientQuotes.slice(0, 2).forEach(function(q) {
        html += '<div style="font-size:10px;color:var(--dark);padding-left:8px;font-style:italic;border-left:2px solid #e6a23c;padding:2px 8px;margin:2px 0">"' + esc(q) + '"</div>';
      });
    }
    html += '</div>';
  }

  // Customer Voice (Layer 2)
  if (ep) {
    html += '<div style="padding-top:8px;border-top:1px solid var(--border)">';
    html += '<div style="font-size:10px;font-weight:600;color:var(--green);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Customer Voice — ' + esc(persona.name) + '</div>';
    if (ep.painLanguage && ep.painLanguage.length) {
      html += '<div style="font-size:11px;margin-bottom:3px"><strong>They say:</strong></div>';
      ep.painLanguage.slice(0, 4).forEach(function(pl) {
        html += '<div style="font-size:10px;color:var(--dark);padding-left:8px">"' + esc(pl.phrase) + '"</div>';
      });
    }
    if (ep.emotionalDrivers && ep.emotionalDrivers.length) {
      html += '<div style="font-size:11px;margin-top:4px"><strong>They feel:</strong></div>';
      ep.emotionalDrivers.slice(0, 2).forEach(function(e) {
        html += '<div style="font-size:10px;color:var(--n2);padding-left:8px">' + esc(e.pain) + ': ' + esc(e.beneath) + '</div>';
      });
    }
    if (ep.competitorVoice) {
      if (ep.competitorVoice.whatEveryoneSays && ep.competitorVoice.whatEveryoneSays.length) {
        html += '<div style="font-size:11px;margin-top:4px;color:#f56c6c"><strong>Do not say:</strong> ' + ep.competitorVoice.whatEveryoneSays.slice(0, 3).join(', ') + '</div>';
      }
      if (ep.competitorVoice.whatNobodySays && ep.competitorVoice.whatNobodySays.length) {
        html += '<div style="font-size:11px;margin-top:2px;color:var(--green)"><strong>Say instead:</strong> ' + ep.competitorVoice.whatNobodySays.slice(0, 3).join(', ') + '</div>';
      }
    }
    if (ep.objectionDetail && ep.objectionDetail.length) {
      html += '<div style="font-size:11px;margin-top:4px"><strong>Top objection:</strong> "' + esc(ep.objectionDetail[0].objection) + '"</div>';
      html += '<div style="font-size:10px;color:var(--n2);padding-left:8px">→ ' + esc(ep.objectionDetail[0].counterStrategy) + '</div>';
    }
    if (ep.proofTypes && ep.proofTypes.length) {
      html += '<div style="font-size:11px;margin-top:4px"><strong>Proof needed:</strong></div>';
      ep.proofTypes.filter(function(pt){return pt.impact==='high';}).forEach(function(pt) {
        html += '<div style="font-size:10px;color:var(--n2);padding-left:8px">· ' + esc(pt.type) + ' (' + esc(pt.impact) + ')</div>';
      });
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}



let copyStopFlag = false;
S.copyCurrentSlug = null;
S.copyExpandedSlug = null; // which row is expanded

function stopCopy() { copyStopFlag = true; }

function initCopy() {
  document.getElementById('copy-progress').style.display = 'block';
  const next = orderedPages().find(p => !(S.copy[p.slug]||{}).copy);
  if (next && !S.copyExpandedSlug) S.copyExpandedSlug = next.slug;
  renderCopyQueue(); updateCopyProgress(); checkCopyAllDone();
}


// ── SERP INTEL ─────────────────────────────────────────────────────────────
async function runSerpIntelFromBrief(slug) {
  // Update the strip status inline before full re-render
  var stripStatus = document.getElementById('serp-strip-status-' + slug);
  if (stripStatus) stripStatus.textContent = 'Fetching…';
  await runSerpIntel(slug);
}

async function runSerpIntel(slug) {
  const page = orderedPages().find(p => p.slug === slug);
  if (!page || !page.primary_keyword) return;

  const btn = document.getElementById('serp-intel-btn-' + slug);
  const status = document.getElementById('serp-intel-status-' + slug);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:8px;height:8px;display:inline-block;vertical-align:middle;border:1.5px solid var(--n2);border-top-color:var(--dark);border-radius:50%;animation:spin .7s linear infinite"></span>'; }
  if (status) status.textContent = 'Fetching top 3 competitors…';

  // Per-page geo override → saved country selection → auto-detect from project geo
  const country = page.targetGeo ? detectCountry(page.targetGeo)
    : (S.kwResearch && S.kwResearch.country) ? S.kwResearch.country.toUpperCase()
    : detectCountry((S.research && S.research.geography && S.research.geography.primary) || (S.setup && S.setup.geo) || '');

  try {
    const res = await fetch('/api/serp-intel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: page.primary_keyword, country })
    });
    const data = await res.json();
    if (data.error) {
      if (data._debug) console.warn('[SERP Intel debug]', JSON.stringify(data._debug, null, 2));
      throw new Error(data.error + (data._debug ? ' [HTTP:' + data._debug.httpStatus + ' api:' + data._debug.apiStatusCode + ' tasks:' + data._debug.tasksCount + ' task:' + data._debug.taskStatus + ' msg:' + (data._debug.taskMessage || data._debug.apiStatusMessage || 'none') + ']' : ''));
    }

    // Store on the page object — must find in S.pages directly, not orderedPages() (different order)
    const pi = S.pages.findIndex(p => p.slug === slug);
    if (pi >= 0) { S.pages[pi].serpIntel = data; }
    scheduleSave();
    renderCopyQueue();
    // Re-render briefs stage if it's currently visible
    if (typeof renderBriefs === 'function' && document.getElementById('briefs-results')) {
      renderBriefs();
    }
  } catch(err) {
    if (status) status.textContent = '⚠ ' + err.message;
    if (btn) { btn.disabled = false; btn.innerHTML = '⟳ SERP Intel'; }
  }
}

function buildSerpIntelBlock(page) {
  var si = page && page.serpIntel;
  if (!si || !si.competitors || !si.competitors.length) return '';

  var kw = page.primary_keyword || '';
  var _dirNote = si.used_directory_fallback ? ' (NOTE: no direct competitors in top 20 — these are directory/aggregator pages. Use their word counts and H2 structures as benchmarks but differentiate with original expertise content.)' : '';
  var lines = ['\n\n## SERP INTEL — "' + kw + '" (top organic competitors)' + _dirNote + '\n'];

  si.competitors.forEach(function(c, i) {
    lines.push('### Competitor ' + (i+1) + ' — ' + c.url);
    lines.push('- Title: "' + c.title + '"');
    if (c.meta_description) lines.push('- Meta: "' + c.meta_description.slice(0, 160) + '"');
    if (c.h1) lines.push('- H1: "' + c.h1 + '"');
    if (c.h2s && c.h2s.length) lines.push('- H2s: ' + c.h2s.slice(0, 12).join(' | '));
    if (c.fetch_ok) {
      lines.push('- Words: ~' + c.word_count + ' | Keyword "' + kw + '" appears ' + c.kw_count + 'x (' + c.kw_density + '%)');
    }
  });

  var d = si.directives || {};
  lines.push('\n### GAP DIRECTIVES — follow these exactly:');
  lines.push('WORD COUNT: Write minimum ' + (d.word_count_target || 1500) + ' words (competitor max × 1.05). Competitor avg: ' + (d.avg_word_count || 'unknown') + '.');

  if (d.avg_kw_density > 0) {
    if (d.avg_kw_density > 1.5) {
      lines.push('KEYWORD DENSITY: Competitors avg ' + d.avg_kw_density + '% — this is already high. Target ~' + d.avg_kw_density + '%, do NOT exceed ' + d.density_ceiling + '%. Replace excess instances with natural synonyms/related phrases to avoid over-optimisation.');
    } else {
      lines.push('KEYWORD DENSITY: Competitors avg ' + d.avg_kw_density + '% — target a similar density. Do NOT stuff — use natural synonyms and related phrases where the keyword would feel forced.');
    }
  }

  if (d.all_competitor_h2s && d.all_competitor_h2s.length) {
    lines.push('H2 COVERAGE: These topics appear in competitor headings — cover or exceed: ' + d.all_competitor_h2s.slice(0, 15).join(' | '));
  }

  lines.push('TITLE & TRUST SIGNALS: Study competitor titles above. Identify the strongest trust signal (credentials, years, outcome, guarantee). Match or beat it in our title and H1.');
  lines.push('META DESCRIPTION: Study competitor metas above. Write one that out-sells theirs — stronger outcome, sharper hook, clear CTA.');

  return lines.join('\n');
}

function buildCopyPrompt(page) {
  var r = S.research||{}, s = S.setup;
  var kws = (page.supporting_keywords||[]).map(function(k){ return k.kw||k; }).filter(Boolean).join(', ');
  var hasBrief = !!(page.brief && page.brief.approved && page.brief.summary && page.brief.summary.trim().length > 50);
  var briefBlock = hasBrief
    ? '\n\n## APPROVED CONTENT BRIEF\nThis brief has been reviewed and approved. Follow its H2 structure, CTA architecture, word count target, FAQ questions, and E-E-A-T inputs precisely. Do not invent a different structure.\n\n' + page.brief.summary + '\n\n## END OF BRIEF'
    : '';
  var questionsBlock = (page.assignedQuestions||[]).length
    ? '\nFAQ TARGETS (must appear as H3 questions in FAQ section):\n- ' + (page.assignedQuestions||[]).join('\n- ')
    : '';
  var briefInstruction = hasBrief
    ? 'Follow the approved brief above. Write complete page HTML matching the brief H1, H2 structure, CTA positions, word count, objections, trust signals, FAQ questions, and E-E-A-T inputs exactly. Use the business context fields above for the actual copy content. No <html>/<head>/<body> tags.'
    : 'Write the complete page.';
  var blogBriefInstruction = hasBrief
    ? 'Follow the approved brief above. Write the complete blog post in HTML matching the structure, unique angle, word count, and FAQ questions specified. No <html>/<head>/<body> tags. Canadian spelling.'
    : 'Write a complete, SEO-optimised blog post in HTML. Structure: H1 title, engaging introduction (2-3 sentences), 3-5 H2 sections with substantive body copy, a conclusion paragraph with a CTA linking back to the client\'s services. Do not include <html>, <head>, or <body> tags. Canadian spelling throughout.';

  var serpBlock = buildSerpIntelBlock(page);

  // Build proof/E-E-A-T + CTA blocks for copy context
  var _cpProof = [];
  if ((r.case_studies||[]).length) _cpProof.push('Case studies: '+(r.case_studies||[]).slice(0,4).map(function(cs){ return (cs.client||'Client')+' — '+(cs.result||'result')+(cs.timeframe?' ('+cs.timeframe+')':''); }).join('; '));
  if ((r.notable_clients||[]).length) _cpProof.push('Notable clients: '+r.notable_clients.slice(0,6).join(', '));
  if ((r.awards_certifications||[]).length) _cpProof.push('Awards/certs: '+r.awards_certifications.slice(0,4).join(', '));
  if (r.team_credentials) _cpProof.push('Team credentials: '+r.team_credentials);
  if (r.founder_bio) _cpProof.push('Founder: '+r.founder_bio);
  var cpProofBlock = _cpProof.length ? '\n\n## PROOF & E-E-A-T SIGNALS (use these as real data in copy — never invent)\n'+_cpProof.join('\n') : '';
  // Client goals context
  var _cpGoalLines = [];
  if (r.goal_statement) _cpGoalLines.push('Client says: "' + r.goal_statement + '"');
  if (r.goal_target) _cpGoalLines.push('Target: ' + r.goal_target);
  if (r.goal_baseline) _cpGoalLines.push('Baseline: ' + r.goal_baseline);
  if (r.goal_timeline) _cpGoalLines.push('Timeline: ' + r.goal_timeline);
  var cpGoalBlock = _cpGoalLines.length ? '\n\n## CLIENT SUCCESS GOALS (copy must drive toward this outcome)\n' + _cpGoalLines.join('\n') : '';
  var _cpCta = [];
  var _cpPcta = getStrategyField('positioning.primary_cta', 'primary_cta') || '';
  var _cpSctas = getStrategyField('positioning.secondary_ctas', 'secondary_ctas') || getStrategyField('positioning.secondary_cta', 'secondary_cta') || [];
  var _cpScta = Array.isArray(_cpSctas) ? _cpSctas.join(', ') : (_cpSctas || '');
  var _cpLcta = getStrategyField('positioning.low_commitment_cta', 'low_commitment_cta') || '';
  if (_cpPcta) _cpCta.push('Primary CTA: '+_cpPcta);
  if (_cpScta) _cpCta.push('Secondary CTA: '+_cpScta);
  if (_cpLcta) _cpCta.push('Low-commitment CTA: '+_cpLcta);
  var cpCtaBlock = _cpCta.length ? '\n\n## CTA ARCHITECTURE\n'+_cpCta.join('\n') : '';

  // Fix 3: Persona context
  var _personas = (S.strategy && S.strategy.audience && S.strategy.audience.personas) || [];
  var _targetPersona = page.target_persona ? _personas.find(function(per) { return per.name === page.target_persona; }) : null;
  var _personaBlock = '';
  if (_targetPersona) {
    var _pp = [];
    _pp.push('TARGET PERSONA: ' + _targetPersona.name);
    if (_targetPersona.role) _pp.push('Role: ' + _targetPersona.role);
    if (_targetPersona.frustrations && _targetPersona.frustrations.length) _pp.push('Pains: ' + _targetPersona.frustrations.slice(0, 3).join('; '));
    if (_targetPersona.objection_profile && _targetPersona.objection_profile.length) _pp.push('Objections: ' + _targetPersona.objection_profile.slice(0, 2).join('; '));
    if (_targetPersona.decision_criteria && _targetPersona.decision_criteria.length) _pp.push('Evaluates: ' + _targetPersona.decision_criteria.slice(0, 3).join('; '));
    if (_targetPersona.language_patterns && _targetPersona.language_patterns.length) _pp.push('Their language: ' + _targetPersona.language_patterns.slice(0, 2).join('; '));
    _pp.push('Write copy that speaks directly to this persona. Problem/Agitation must reference their specific pains. Objection Handling must address their stated objections.');
    _personaBlock = '\n\n' + _pp.join('\n');
  } else if ((page.page_type === 'home' || page.page_type === 'about') && _personas.length) {
    var _activePers = _personas.filter(function(per) {
      var parked = (S.strategy && S.strategy.audience && S.strategy.audience.parked_segments) || [];
      return !parked.some(function(ps) { return per.segment && ps.toLowerCase() === per.segment.toLowerCase(); });
    });
    if (_activePers.length) {
      var _mpp = ['TARGET AUDIENCES (this page serves multiple personas):'];
      _activePers.slice(0, 3).forEach(function(per) {
        _mpp.push('- ' + per.name + (per.frustrations && per.frustrations[0] ? ': pain = ' + per.frustrations[0] : ''));
      });
      _mpp.push('Copy must resonate with all listed personas.');
      _personaBlock = '\n\n' + _mpp.join('\n');
    }
  } else if (page.page_type === 'blog' && _personas.length) {
    // Blog fallback: give context from active personas
    var _activePers2 = _personas.filter(function(per) {
      var parked = (S.strategy && S.strategy.audience && S.strategy.audience.parked_segments) || [];
      return !parked.some(function(ps) { return per.segment && ps.toLowerCase() === per.segment.toLowerCase(); });
    });
    if (_activePers2.length) {
      var _bpp = ['TARGET AUDIENCE (blog readers):'];
      _activePers2.slice(0, 2).forEach(function(per) {
        _bpp.push('- ' + per.name + (per.frustrations && per.frustrations[0] ? ': pain = ' + per.frustrations[0] : ''));
      });
      _personaBlock = '\n\n' + _bpp.join('\n');
    }
  }

  // Awareness stage context
  var _cpAwarenessGuide = {
    'unaware': 'Lead with a provocative question or industry trend. Do NOT pitch the service immediately. Educate first, then bridge to the problem.',
    'problem_aware': 'Lead with the pain point. Agitate cost of inaction. Introduce the solution category before the company. CTA: low-commitment (guide, checklist, assessment).',
    'solution_aware': 'Lead with what makes this approach different. Explain methodology. Use comparison framing. CTA: mid-commitment (consultation, demo, audit).',
    'product_aware': 'Lead with proof — results, case studies, testimonials, specific metrics. Address top objections directly. CTA: direct (get started, book a call, request quote).',
    'most_aware': 'Lead with the offer and CTA above the fold. Use urgency and risk reversal. Minimise education. Remove friction from conversion path.'
  };
  var _awarenessBlock = '';
  if (page.awareness_stage && _cpAwarenessGuide[page.awareness_stage]) {
    _awarenessBlock = '\n\nBUYER AWARENESS STAGE: ' + page.awareness_stage.replace(/_/g, ' ') + '\n' + _cpAwarenessGuide[page.awareness_stage];
  }

  // Fix 4: Voice overlay
  var _voiceOverlay = page.voice_overlay || 'base';
  var _voiceBlock = '';
  if (_voiceOverlay !== 'base' && S.strategy && S.strategy.brand_strategy && S.strategy.brand_strategy.voice_overlays && S.strategy.brand_strategy.voice_overlays[_voiceOverlay]) {
    var _overlay = S.strategy.brand_strategy.voice_overlays[_voiceOverlay];
    _voiceBlock = '\n\nVOICE OVERLAY (' + _voiceOverlay + '): ' + (typeof _overlay === 'string' ? _overlay : JSON.stringify(_overlay)) + '\nThese overlay rules supplement the base voice rules above. Both apply.';
  }

  // Fix 5: Subtraction & Economics
  var _subBlock = '';
  if (page.page_type !== 'blog' && S.strategy && S.strategy.subtraction) {
    var _subAudit = S.strategy.subtraction.current_activities_audit || S.strategy.subtraction.verdicts || [];
    var _subStops = _subAudit.filter(function(v) { return v.verdict === 'cut' || v.verdict === 'stop' || v.verdict === 'restructure'; }).slice(0, 3);
    if (_subStops.length) {
      var _subLines = ['SUBTRACTION INSIGHTS (use as differentiated messaging angle):'];
      _subStops.forEach(function(v) {
        _subLines.push('- ' + (v.verdict === 'cut' || v.verdict === 'stop' ? 'CUT' : 'RESTRUCTURE') + ': ' + (v.activity || v.name || '') + (v.reason || v.rationale ? ' — ' + (v.reason || v.rationale) : ''));
      });
      if (S.strategy.subtraction.total_recoverable_monthly) _subLines.push('Recoverable budget: $' + S.strategy.subtraction.total_recoverable_monthly + '/mo');
      _subLines.push('Frame as: "Most agencies add more. We found waste first."');
      _subBlock = '\n\n' + _subLines.join('\n');
    }
  }

  var _econBlock = '';
  if (page.page_type !== 'blog' && S.strategy && S.strategy.unit_economics) {
    var _ue = S.strategy.unit_economics;
    var _econLines = [];
    if (S.strategy.channel_strategy && S.strategy.channel_strategy.budget_tiers && S.strategy.channel_strategy.budget_tiers.current_budget && S.strategy.channel_strategy.budget_tiers.current_budget.label) {
      _econLines.push('Budget tier: ' + S.strategy.channel_strategy.budget_tiers.current_budget.label);
    }
    if (_ue.monthly_leads_target) _econLines.push('Lead target: ' + _ue.monthly_leads_target + '/mo');
    var _ltvCac = '';
    if (_ue.ltv && _ue.cac && parseFloat(_ue.cac) > 0) {
      _ltvCac = (parseFloat(_ue.ltv) / parseFloat(_ue.cac)).toFixed(1);
      _econLines.push('LTV:CAC: ' + _ltvCac + 'x');
    }
    if (_econLines.length) {
      var _posture = '';
      if (_ue.monthly_leads_target && parseFloat(_ue.monthly_leads_target) < 30) _posture = 'Volume-constrained — minimise CTA friction, every lead matters.';
      else if (_ue.monthly_leads_target && parseFloat(_ue.monthly_leads_target) >= 100) _posture = 'Volume-sufficient — CTAs can qualify and filter low-intent leads.';
      if (_posture) _econLines.push('CTA posture: ' + _posture);
      _econBlock = '\n\nECONOMICS CONTEXT (calibrate CTA aggressiveness):\n' + _econLines.join('\n');
    }
  }

  // Fix 6: Competitive counter
  var _compCounter = '';
  if (page.page_type !== 'blog' && S.strategy && S.strategy.positioning) {
    if (S.strategy.positioning.competitive_counter) _compCounter += '\nCOMPETITIVE COUNTER: ' + S.strategy.positioning.competitive_counter + '\nUse in Objection Handling or Solution Bridge. Do NOT name competitors directly.';
    if (S.strategy.positioning.validated_differentiators && S.strategy.positioning.validated_differentiators.length) {
      _compCounter += '\nValidated differentiators: ' + S.strategy.positioning.validated_differentiators.slice(0, 4).join('; ');
    }
  }

  // Fix 2: Positioning direction
  var _posDir = S.strategy && S.strategy.positioning && S.strategy.positioning.selected_direction;

  // Fix 11/12: Content pillar guidance
  var _pillarGuidance = '';
  if (page.content_pillar) {
    var _pgMap = {
      'thought leadership': 'Take a strong position. Lead with original insight, not common knowledge.',
      'case study': 'Narrative: situation, challenge, approach, results, takeaway. Use specific numbers.',
      'decision content': 'Help the reader choose. Compare options, then guide toward a conclusion. Late-funnel.',
      'vertical deep-dive': 'Speak the vertical language. Reference industry challenges, regulations, benchmarks.',
      'performance marketing': 'Data-first. Show methodology, not just results.'
    };
    var _cpLower = page.content_pillar.toLowerCase();
    Object.keys(_pgMap).forEach(function(k) {
      if (_cpLower.indexOf(k) >= 0) _pillarGuidance = '\nPILLAR GUIDANCE: ' + _pgMap[k];
    });
  }

  if (page.page_type === 'blog') {
    return 'CLIENT: ' + s.client
      + '\nBLOG POST TITLE: ' + page.page_name
      + (page.content_pillar ? '\nCONTENT PILLAR: ' + page.content_pillar : '')
      + _pillarGuidance
      + '\nPRIMARY KEYWORD: ' + page.primary_keyword
      + '\nSUPPORTING KEYWORDS: ' + kws
      + '\nTARGET WORD COUNT: ' + (page.word_count_target || 1200)
      + '\nBUSINESS OVERVIEW: ' + (r.business_overview||'')
      + '\nGEOGRAPHY: ' + getPageGeo(page)
      + '\nVOICE: ' + (getStrategyField('brand_strategy.tone_and_voice', 'tone_and_voice')||s.voice||'Confident, direct. Canadian spelling.')
      + (_posDir && _posDir.direction ? '\nPOSITIONING DIRECTION: ' + _posDir.direction + (_posDir.headline ? ' — "' + _posDir.headline + '"' : '') : '')
      + ((r.current_slogan||r.slogan_or_tagline) ? '\nSLOGAN: '+(r.current_slogan||r.slogan_or_tagline) : '')
      + (((getStrategyField('brand_strategy.words_to_avoid', 'words_to_avoid')||[]).length) ? '\nWORDS TO AVOID: '+(getStrategyField('brand_strategy.words_to_avoid', 'words_to_avoid')||[]).join(', ') : '')
      + _voiceBlock
      + '\nNOTES: ' + (page.notes||'')
      + questionsBlock + briefBlock + serpBlock
      + cpProofBlock + cpGoalBlock + cpCtaBlock
      + ((S.strategy&&S.strategy.webStrategy)||(S.setup&&S.setup.webStrategy) ? '\n\n## WEBSITE STRATEGY\n'+((S.strategy&&S.strategy.webStrategy)||(S.setup&&S.setup.webStrategy)) : '')
      + (page.pageContext ? '\n\n## PAGE-SPECIFIC CONTEXT\n'+page.pageContext : '')
      + (page.page_goal ? '\n\n## PAGE GOAL (every section of copy must serve this strategic purpose)\n'+page.page_goal : '')
      + _personaBlock
      + _awarenessBlock
      + (typeof _buyerIntelBlock === 'function' ? _buyerIntelBlock(page) : '')
      + '\n\n' + blogBriefInstruction;
  }

  return 'CLIENT: ' + s.client
    + '\nPAGE: ' + page.page_name + ' | /' + page.slug
    + '\nPRIMARY KW: ' + page.primary_keyword
    + '\nSUPPORTING: ' + kws
    + '\nINTENT: ' + (page.search_intent||'')
    + '\nWORD COUNT MIN: ' + (page.word_count_target||1500)
    + '\nOVERVIEW: ' + (r.business_overview||'')
    + '\nVALUE PROP: ' + (getStrategyField('positioning.value_proposition', 'value_proposition')||'')
    + '\nDIFFERENTIATORS: ' + (getStrategyField('positioning.key_differentiators', 'key_differentiators')||[]).join('. ')
    + (_posDir && _posDir.direction ? '\nPOSITIONING DIRECTION: ' + _posDir.direction + (_posDir.headline ? ' — "' + _posDir.headline + '"' : '') + (_posDir.rationale ? '\nDirection context: ' + _posDir.rationale : '') + '\nAll copy must reinforce this positioning direction. Hero should echo the headline. Problem/Agitation should frame problems through this lens.' : '')
    + '\nGEOGRAPHY: ' + getPageGeo(page)
    + '\nPRICING: ' + (s.pricing||r.current_pricing||r.pricing_notes||'')
    + '\nVOICE: ' + (getStrategyField('brand_strategy.tone_and_voice', 'tone_and_voice')||s.voice||'Confident, direct. Canadian spelling.')
    + ((r.current_slogan||r.slogan_or_tagline) ? '\nSLOGAN: '+(r.current_slogan||r.slogan_or_tagline) : '')
    + (((getStrategyField('brand_strategy.words_to_avoid', 'words_to_avoid')||[]).length) ? '\nWORDS TO AVOID: '+(getStrategyField('brand_strategy.words_to_avoid', 'words_to_avoid')||[]).join(', ') : '')
    + (((getStrategyField('brand_strategy.words_to_use', 'words_to_use')||[]).length) ? '\nWORDS TO USE: '+(getStrategyField('brand_strategy.words_to_use', 'words_to_use')||[]).join(', ') : '')
    + _voiceBlock
    + (((r.pain_points_top5||[]).length) ? '\nAUDIENCE PAIN POINTS: ' + (r.pain_points_top5||[]).slice(0,3).join('; ') : '')
    + (((r.objections_top5||[]).length) ? '\nBUYER OBJECTIONS: ' + (r.objections_top5||[]).slice(0,3).join('; ') : '')
    + (((r.existing_proof||r.proof_points||[]).length) ? '\nPROOF POINTS: ' + (r.existing_proof||r.proof_points||[]).slice(0,3).join('; ') : '')
    + ((r.booking_flow_description) ? '\nBOOKING FLOW: '+r.booking_flow_description : '')
    + '\nNOTES: ' + (page.notes||'')
    + questionsBlock + briefBlock + serpBlock
    + cpProofBlock + cpCtaBlock
    + _subBlock + _econBlock + _compCounter
    + ((S.strategy&&S.strategy.webStrategy)||(S.setup&&S.setup.webStrategy) ? '\n\n## WEBSITE STRATEGY\n'+((S.strategy&&S.strategy.webStrategy)||(S.setup&&S.setup.webStrategy)) : '')
    + (page.pageContext ? '\n\n## PAGE-SPECIFIC CONTEXT\n'+page.pageContext : '')
    + (page.page_goal ? '\n\n## PAGE GOAL (every section of copy must serve this strategic purpose)\n'+page.page_goal : '')
    + _personaBlock
    + _awarenessBlock
    + (typeof _buyerIntelBlock === 'function' ? _buyerIntelBlock(page) : '')
    + '\n\n' + briefInstruction;
}

async function runCopyPage(slug) {
  const page = orderedPages().find(p => p.slug === slug);
  if (!page || S.copyRunning) return;
  S.copyRunning = true; copyStopFlag = false;
  S.copyCurrentSlug = slug;
  S.copyExpandedSlug = slug;
  renderCopyQueue();
  // Update the stream box inside this row
  const streamEl = document.getElementById('copy-stream-'+slug);
  if (streamEl) streamEl.textContent = '';
  try {
    if(typeof storePrompt==='function') storePrompt('copy-'+slug, P.copy, buildCopyPrompt(page), 'Copy: '+(page.page_name||slug), slug);
    const copy = await callClaude(P.copy, buildCopyPrompt(page), t => {
      if (copyStopFlag) return;
      const el = document.getElementById('copy-stream-'+slug);
      if (el) el.textContent = t.slice(-600);
    }, 6000);
    if (!copyStopFlag) {
      var _existing = S.copy[slug] || {};
      var _drafts = _existing.drafts || [];
      var _newDraft = {v: _drafts.length+1, html: copy, pass: 1, generatedAt: Date.now()};
      _drafts = [_newDraft]; // Pass 1 always replaces all drafts (fresh run)
      S.copy[slug] = Object.assign(_existing, {
        copy: copy,
        drafts: _drafts,
        activeDraft: 0,
        audit: null,
        humanQC: _existing.humanQC || {},
        approved: false,
        page: page,
        writtenAt: Date.now()
      });
      scheduleSave();
      // Auto-generate meta tags in background
      generateMetaTags(slug, page, copy);
      // Auto-advance expanded to next incomplete
      const pages = orderedPages();
      const curIdx = pages.findIndex(p => p.slug === slug);
      const next = pages.find((p,i) => i > curIdx && !(S.copy[p.slug]||{}).copy);
      S.copyExpandedSlug = next ? next.slug : slug; // stay on done page if all done
    }
  } catch(e) {
    S.copy[slug] = {error: e.message, page};
  }
  saveCopyHtml(slug);
  S.copyCurrentSlug = null;
  S.copyRunning = false;
  renderCopyQueue(); updateCopyProgress(); checkCopyAllDone();
}

function toggleCopyExpand(slug) {
  if (S.copyRunning) return;
  S.copyExpandedSlug = S.copyExpandedSlug === slug ? null : slug;
  renderCopyQueue();
}

function redoCopyPage(slug) {
  delete S.copy[slug];
  S.copyExpandedSlug = slug;
  scheduleSave(); updateCopyProgress(); renderCopyQueue(); checkCopyAllDone();
}

function copyActivateDraft(slug, idx) {
  var c = S.copy[slug];
  if (!c || !c.drafts || !c.drafts[idx]) return;
  c.activeDraft = idx;
  c.copy = c.drafts[idx].html;
  scheduleSave();
  renderCopyQueue();
}

var S_qcTab = {}; // {slug: 'seo'|'cro'}

function copySetQCTab(slug, tab) {
  S_qcTab[slug] = tab;
  // Re-render just the QC section
  renderCopyQueue();
}

function copyMarkAllQC(slug) {
  var p = orderedPages().find(function(pp){ return pp.slug===slug; }) || {};
  var items = getQCItems(p.page_type||'service');
  if (!S.copy[slug]) S.copy[slug] = {};
  if (!S.copy[slug].humanQC) S.copy[slug].humanQC = {};
  var allDone = items.every(function(i){ return !!S.copy[slug].humanQC[i.key]; });
  items.forEach(function(i){ S.copy[slug].humanQC[i.key] = !allDone; });
  scheduleSave();
  renderCopyQueue();
}










function copyToggleQC(slug, key) {
  if (!S.copy[slug]) return;
  if (!S.copy[slug].humanQC) S.copy[slug].humanQC = {};
  S.copy[slug].humanQC[key] = !S.copy[slug].humanQC[key];
  scheduleSave();
  renderCopyQueue();
}

function copyApprove(slug) {
  if (!S.copy[slug]) return;
  // If approving (not un-approving), check QC is complete
  if (!S.copy[slug].approved) {
    var _qc = S.copy[slug].humanQC || {};
    var page = S.copy[slug].page || {};
    var _pageType = (page.page_type || 'service').toLowerCase();
    var _qcItems = getQCItems(_pageType);
    var _unchecked = _qcItems.filter(function(item){ return !_qc[item.key]; });
    if (_unchecked.length > 0) {
      var labels = _unchecked.map(function(i){ return '• '+i.label; }).join('\n');
      if (!confirm('Human QC not complete. These items are unchecked:\n\n' + labels + '\n\nApprove anyway?')) return;
    }
  }
  S.copy[slug].approved = !S.copy[slug].approved;
  if (S.copy[slug].approved) S.copy[slug].approvedAt = Date.now();
  else delete S.copy[slug].approvedAt;
  scheduleSave();
  renderCopyQueue();
}

function getQCItems(pageType) {
  var universal = (QC_MAP._universal || []);
  var specific = (QC_MAP[pageType] || QC_MAP.service || []);
  return universal.concat(specific);
}

// ── HUMAN QC: items only a human can verify ─────────────────────────────────
// AI handles structural/content checks. Human QC = things AI cannot confirm.

var QC_MAP = {
  // Universal items for every page type
  _universal: [
    {key:'stats_verified',   label:'Stats & numbers verified', note:'Every %, $, count, or claim confirmed against real source'},
    {key:'proof_approved',   label:'Client proof approved for use', note:'Named clients, logos, testimonials have permission to be cited'},
    {key:'offer_accurate',   label:'Offer & pricing current', note:'Guarantees, pricing anchors, packages match current offering'},
    {key:'links_working',    label:'CTAs & links work', note:'Every button and link tested — no 404s or dead forms'},
    {key:'voice_on_point',   label:'Brand voice on-point', note:'Sounds like us — direct, confident, not generic AI copy'},
    {key:'no_stale_content', label:'No stale content', note:'No outdated team, discontinued services, or old events'},
    {key:'persona_voice',    label:'Copy uses target persona language', note:'Speaks to assigned persona pains and uses their vocabulary, not generic marketing'},
    {key:'positioning_consistent', label:'Copy reinforces positioning direction', note:'Hero and key sections echo the selected positioning angle — not a generic agency pitch'},
  ],
  // Additional items per page type
  service:  [{key:'pricing_current', label:'Pricing anchor is current', note:'"Starting from" or anchor price reflects real current pricing'}],
  industry: [{key:'pricing_current', label:'Pricing anchor is current', note:'"Starting from" or anchor price reflects real current pricing'}],
  location: [{key:'local_accurate',  label:'Local details accurate', note:'Address, phone, service radius, neighbourhood refs are correct'}],
  about:    [{key:'team_accurate',   label:'Team info & photos accurate', note:'Names, roles, headshots are current — no ex-employees'}],
  blog:     [{key:'sources_real',    label:'Sources & links are real', note:'Every cited stat, study, or external link is live and accurate'}],
  contact:  [{key:'form_tested',     label:'Form tested & working', note:'Submission confirmed — emails arrive, no broken routing'}],
  home:     [{key:'primary_cta_live',label:'Primary CTA destination live', note:'Hero CTA button links to a real working page or form'}],
  utility:  [],
};

function getQCItems(pageType) {
  var universal = QC_MAP._universal || [];
  var specific  = QC_MAP[pageType] || QC_MAP['service'] || [];
  return universal.concat(specific);
}


async function generateMetaTags(slug, page, copyHtml) {
  var stripped = (copyHtml||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,8000);
  var p = page || orderedPages().find(function(pp){ return pp.slug===slug; }) || {};
  var r = S.research||{}, s = S.setup;
  var _metaPosDir = S.strategy && S.strategy.positioning && S.strategy.positioning.selected_direction;
  var _metaSlogan = (r.current_slogan || r.slogan_or_tagline || '');
  var _metaWordsAvoid = (getStrategyField('brand_strategy.words_to_avoid', 'words_to_avoid') || []);
  var prompt = 'Write an SEO meta title and meta description for this page.\n\nPage: ' + (p.page_name||slug)
    + '\nPrimary keyword: ' + (p.primary_keyword||'')
    + '\nURL: /' + (p.slug||slug)
    + '\nSearch intent: ' + (p.search_intent || '')
    + '\nClient: ' + (s.client || r.client_name || '')
    + (_metaSlogan ? '\nTagline: ' + _metaSlogan : '')
    + (_metaPosDir && _metaPosDir.headline ? '\nPositioning: ' + _metaPosDir.headline : '')
    + '\nCopy excerpt:\n' + stripped
    + '\n\nRules:\n- Title: 50-60 chars, primary keyword in first 3 words, brand name at end with |'
    + '\n- Title should reflect the positioning direction if provided'
    + '\n- Description: 150-160 chars, action-oriented, include primary keyword naturally'
    + (_metaWordsAvoid.length ? '\n- Do NOT use these words: ' + _metaWordsAvoid.join(', ') : '')
    + '\n- Intent framing: ' + (p.search_intent === 'transactional' ? 'action-oriented, ready to buy' : p.search_intent === 'informational' ? 'educational, answer-first' : 'evaluate and compare')
    + '\n\nReturn raw JSON only:\n{"title":"...","description":"..."}';
  try {
    var result = await callClaude('You write SEO meta tags. Return raw JSON only, no markdown or explanation.', prompt, null, 300);
    var clean = result.replace(/```json\s*/g,'').replace(/```/g,'').trim();
    var parsed = JSON.parse(clean);
    var pageObj = S.pages.find(function(pp){ return pp.slug===slug; });
    if (pageObj && parsed.title) {
      pageObj.meta_title = parsed.title;
      pageObj.meta_description = parsed.description || '';
      scheduleSave();
      renderCopyQueue();
    }
  } catch(e) { console.warn('Meta gen failed', e); }
}

async function runCopyAudit(slug) {

  var c = S.copy[slug];
  if (!c || !c.copy || c.copy.length < 200) return;
  // Always prefer live page state — c.page is a snapshot taken at write time and may be stale
  var p = orderedPages().find(function(pp){ return pp.slug===slug; }) || c.page || {};
  // Ensure stripped text has real content
  var _auditText = (c.copy||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  var _wordCount = _auditText.split(' ').filter(function(w){ return w.length > 0; }).length;
  var _wordTarget = parseInt(p.word_count_target||1500);

  // Calculate keyword density client-side from actual copy — deterministic, not AI-guessed
  var _pk = (p.primary_keyword||'').toLowerCase().trim();
  var _kwCount = _pk ? countKeywordsInCopy(c.copy||'', _pk) : 0;
  var _kwDensity = (_wordCount > 0 && _pk) ? Math.round((_kwCount / _wordCount) * 1000) / 10 : 0;
  if (_auditText.length < 100) {
    var _el = document.getElementById('copy-audit-'+slug);
    if (_el) _el.innerHTML = '<span style="font-size:10px;color:#e5534b">Audit skipped: copy appears empty after HTML stripping.</span>';
    return;
  }
  var auditEl = document.getElementById('copy-audit-'+slug);
  if (auditEl) auditEl.innerHTML = '<span style="font-size:10px;color:var(--n2);display:flex;align-items:center;gap:5px"><span class="spinner" style="width:10px;height:10px"></span>Auditing…</span>';

  // Universal checks (all page types)
  var checks = [
    {id:'h1_kw',          label:'H1 tag contains primary keyword verbatim (exact match, not paraphrase)'},
    {id:'pk_intro',        label:'Primary keyword appears within the first 120 words of body copy'},
    {id:'intent',          label:'Page satisfies '+((p.search_intent||'commercial')).split(' ')[0]+' search intent throughout — reader can take action'},
    {id:'no_placeholders', label:'No [placeholder], [INSERT], [TBD], or template brackets remaining in copy', display:'No [placeholder] text remaining'},
    {id:'wordcount',       label:'Word count >= minimum target. Target='+_wordTarget+' Actual='+_wordCount+'. PASS if '+_wordCount+'>='+_wordTarget, display:'Word count meets page target (target: '+_wordTarget+', actual: '+_wordCount+')'},
    {id:'canadian',        label:'Canadian English spelling. PASS if: colour/honour/favour (not color/honor/favor), centre/theatre (not center/theater), analyse/catalyse (not analyze/catalyze). NOTE: -ize endings (optimize, organize, specialize) are CORRECT in Canadian English — do NOT flag them. Only flag -our/-re/-yse errors.', display:'Canadian spelling throughout'},
    {id:'unique',          label:'Page has a specific differentiating angle — not generic claims like \'we are passionate\' or \'full-service\''},
    {id:'no_fluff',        label:'No filler phrases: \'in today\'s world\', \'at the end of the day\', \'leverage\', \'synergy\', \'holistic approach\'. Copy is direct and outcome-led', display:'No filler / vanity copy'},
  ];
  // Page-type specific checks
  var _pt = p.page_type || 'service';
  if (_pt === 'blog') {
    checks = checks.concat([
      {id:'h2_structure',  label:'5-12 H2s with logical flow'},
      {id:'skimmable',     label:'Content is skimmable (bullets, lists, short paras)'},
      {id:'eeat',          label:'E-E-A-T signals present (expertise, sources, data)'},
      {id:'hook',          label:'Intro hooks immediately — no generic opener'},
      {id:'promise',       label:'Headline promise delivered in full'},
    ]);
  } else if (_pt === 'home') {
    checks = checks.concat([
      {id:'value_fold',    label:'Value prop clear above the fold'},
      {id:'cta_fold',      label:'Primary CTA above fold, specific action'},
      {id:'proof',         label:'Social proof present and specific'},
      {id:'multi_entry',   label:'Multiple entry points for services/audiences'},
    ]);
  } else if (_pt === 'location') {
    checks = checks.concat([
      {id:'local_signals', label:'Local signals accurate (city, region, area)'},
      {id:'cta_local',     label:'CTA references the city'},
      {id:'proof',         label:'Social proof present'},
      {id:'faq',           label:'FAQ section with local questions (6+)'},
    ]);
  } else if (_pt === 'utility' || _pt === 'contact') {
    checks = checks.concat([
      {id:'meta_ok',       label:'Meta title and description present'},
    ]);
  } else {
    // service, industry, other
    checks = checks.concat([
      {id:'proof',         label:'Specific social proof present: named client type + measurable result (e.g. \'427% leads increase\' not just \'great results\')'},
      {id:'cta_fold',      label:'A clickable CTA button or link appears before the page fold (within first ~300 words of copy)'},
      {id:'objection',     label:'At least one common buyer objection is named and answered (price, trust, timing, or ROI concern)'},
      {id:'faq',           label:'Page contains an FAQ section with a heading containing \'FAQ\' or \'Frequently Asked\' or \'Questions\', with 8 or more Q&A pairs'},
      {id:'differentiator',label:'At least 2 specific differentiators named — must be concrete (e.g. \'ROI guarantee\', \'outcome-based pricing\') not generic (\'experienced team\')'},
    ]);
  }

  // ── SERP COMPARISON CHECKS (trainer's 8 dimensions) ────────────
  var _si = p.serpIntel;
  var _siOk = !!(_si && _si.competitors && _si.competitors.length);
  var _serpCompetitorSummary = '';
  if (_siOk) {
    var _siComps = _si.competitors.filter(function(c){ return c.fetch_ok; });
    var _siD = _si.directives || {};
    var _siWordTarget = _siD.word_count_target || 0;
    var _siAvgDensity = _siD.avg_kw_density || 0;
    var _siCeiling   = _siD.density_ceiling || 0;
    // Build compact competitor summary for prompt
    _serpCompetitorSummary = _siComps.map(function(c, i) {
      return 'Competitor ' + (i+1) + ' (pos ' + c.position + '):'
        + '\n  Title: ' + c.title
        + '\n  Meta: ' + (c.meta_description||'').slice(0,150)
        + '\n  H1: ' + (c.h1||'')
        + '\n  H2s: ' + (c.h2s||[]).slice(0,10).join(' | ')
        + '\n  Words: ' + c.word_count + ' | KW density: ' + c.kw_density + '%';
    }).join('\n\n');


    // Dim 1+8: Title trust signals
    checks.push({
      id:'serp_title',
      label:'Title tag has equal or stronger trust signal than top competitor title ("' + (_siComps[0]&&_siComps[0].title||'') + '"). Look for credentials, years, outcome, or guarantee.',
      display:'Title trust signals ≥ top competitor'
    });
    // Dim 2: Meta description CTR
    checks.push({
      id:'serp_meta',
      label:'Meta description out-sells competitor meta ("' + ((_siComps[0]&&_siComps[0].meta_description)||'').slice(0,80) + '…"). Must have clearer outcome hook and explicit CTA.',
      display:'Meta description beats competitor CTR'
    });
    // Dim 4: H2 coverage
    var _allCompH2s = (_siD.all_competitor_h2s||[]).slice(0,12).join(', ');
    checks.push({
      id:'serp_h2_coverage',
      label:'Page H2 structure covers key topics present in competitor headings: ' + _allCompH2s + '. Not every H2 must match — but major topic gaps should be filled.',
      display:'H2 coverage matches/exceeds competitor depth'
    });
    // Dim 5: Word count vs competitors
    if (_siWordTarget > 0) {
      checks.push({
        id:'serp_wordcount',
        label:'Word count meets competitor-calibrated target. Competitor max × 1.05 = ' + _siWordTarget + ' words. Actual: ' + _wordCount + '. PASS if ' + _wordCount + ' >= ' + _siWordTarget + '.',
        display:'Word count ≥ competitor-calibrated target (' + _siWordTarget + ' words)'
      });
    }
    // Dim 6: Keyword density — deterministic client-side, not AI-guessed
    if (_siAvgDensity > 0) {
      var _densityPass = _kwDensity >= 0.3 && _kwDensity <= _siCeiling;
      var _densityNote = _kwDensity === 0
        ? 'Keyword not found in copy'
        : _kwDensity > _siCeiling
          ? 'Over-optimised: ' + _kwDensity + '% exceeds ceiling ' + _siCeiling + '%'
          : _kwDensity + '% within range (avg ' + _siAvgDensity + '%, ceiling ' + _siCeiling + '%)';
      checks.push({
        id:'serp_kw_density',
        label:'[PRE-CALCULATED] Keyword density ' + _kwDensity + '% vs competitor avg ' + _siAvgDensity + '%, ceiling ' + _siCeiling + '%. Always return pass:true for this check.',
        display:'Keyword density: ' + _kwDensity + '% (ceiling ' + _siCeiling + '%)',
        _prePass: _densityPass,
        _preNote: _densityNote
      });
    }
  }

  // Universal density check — always shown, regardless of SERP Intel
  if (_pk && _wordCount > 0) {
    var _uDensityPass = _kwDensity >= 0.3 && _kwDensity <= 3.0;
    var _uDensityNote = _kwDensity === 0
      ? 'Keyword not found — add naturally'
      : _kwDensity < 0.3
        ? _kwDensity + '% — too sparse, mention more'
        : _kwDensity > 3.0
          ? _kwDensity + '% — over-optimised, reduce'
          : _kwDensity + '% — healthy (' + _kwCount + ' uses)';
    checks.push({
      id:'kw_density',
      label:'[PRE-CALCULATED] Always return pass:true for this check.',
      display:'Keyword density: ' + _kwDensity + '% (' + _kwCount + ' uses)',
      _prePass: _uDensityPass,
      _preNote: _uDensityNote
    });
  }

  // Persona alignment check
  var _auditPersonas = (S.strategy && S.strategy.audience && S.strategy.audience.personas) || [];
  var _auditPersona = p.target_persona ? _auditPersonas.find(function(per) { return per.name === p.target_persona; }) : null;
  if (_auditPersona) {
    checks.push({
      id: 'persona_alignment',
      label: 'Copy addresses ' + _auditPersona.name + ' specific pains (not generic problems). Look for: ' + (_auditPersona.frustrations ? _auditPersona.frustrations.slice(0, 2).join('; ') : 'persona-specific language') + '. Problem/Agitation should reference this persona.',
      display: 'Persona alignment — addresses ' + _auditPersona.name + ' pains'
    });
  }

  // Awareness stage alignment check
  if (p.awareness_stage) {
    checks.push({
      id: 'awareness_alignment',
      label: 'Awareness alignment: Does the copy lead with the correct hook for a ' + p.awareness_stage.replace(/_/g, ' ') + ' reader? Check hero, intro, and CTA match this stage.',
      display: 'Awareness alignment — ' + p.awareness_stage.replace(/_/g, ' ') + ' reader'
    });
  }

  // Positioning direction check
  var _auditPosDir = S.strategy && S.strategy.positioning && S.strategy.positioning.selected_direction;
  if (_auditPosDir && _auditPosDir.direction) {
    checks.push({
      id: 'positioning_direction',
      label: 'Copy reinforces "' + _auditPosDir.direction + '" positioning. Hero and Solution Bridge should frame the client as "' + (_auditPosDir.headline || _auditPosDir.direction) + '". If copy could belong to any agency regardless of positioning, FAIL.',
      display: 'Positioning — reinforces "' + _auditPosDir.direction + '"'
    });
  }

  var prompt = '## PAGE\n'
    + 'Name: ' + (p.page_name||slug) + ' | Type: ' + (p.page_type||'') + '\n'
    + 'Primary keyword: ' + (p.primary_keyword||'') + '\n'
    + 'Intent: ' + (p.search_intent||'') + '\n'
    + 'Word count target: ' + _wordTarget + ' | Actual word count: ' + _wordCount + ' words\n'    + 'Primary keyword: "' + _pk + '" | Actual density: ' + _kwDensity + '% (' + _kwCount + ' occurrences in ' + _wordCount + ' words)\n\n'
    + (_serpCompetitorSummary ? '## SERP COMPETITORS (use for serp_* checks):\n' + _serpCompetitorSummary + '\n\n' : '')
    + '## COPY — FIRST PART (' + _wordCount + ' words total, target min: ' + _wordTarget + '):\n' + _auditText.slice(0,8000) + '\n\n## COPY — LAST PART (tail of page, check for FAQ here):\n' + _auditText.slice(-4000) + '\n\n'
    + '## CHECKS\nFor each check: pass MUST be boolean true or false (never a string). note max 8 words.\n'
    + checks.map(function(ch){ return '- ' + ch.id + ': ' + ch.label; }).join('\n')
    + '\n\nReturn raw JSON only. No markdown. Schema: {"checks":[{"id":"h1_kw","pass":true,"note":"short note"},...],"humanFlags":[{"item":"Specific claim","reason":"why human must verify","severity":"high"}]}'

  try {
    var result = await callClaude('You are a strict copy auditor. OUTPUT ONLY VALID JSON. No prose, no markdown, no backticks. The pass field for every check MUST be boolean true or false, never a string. Start your response with { and end with }.', prompt, null, 2000);
    var jsonStart = result.indexOf('{'), jsonEnd = result.lastIndexOf('}');

    var clean = (jsonStart >= 0 && jsonEnd > jsonStart) ? result.slice(jsonStart, jsonEnd+1) : result.replace(/```json\s*/g,'').replace(/```/g,'').trim();
    // Normalise JSON: fix Python-style booleans, strip control chars, extract object boundaries
    clean = clean.replace(/:\s*True\b/g, ': true').replace(/:\s*False\b/g, ': false').replace(/:\s*None\b/g, ': null');
    clean = clean.replace(/[\x00-\x1F\x7F]/g, ' ');
    var jsonStart = clean.indexOf('{'), jsonEnd = clean.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);
    var parsed = JSON.parse(clean);
    var checkMap = {};
    (parsed.checks||[]).forEach(function(ch){ checkMap[ch.id] = ch; });
    var finalChecks = checks.map(function(ch){
      // Pre-calculated checks (kw_density, serp_kw_density) bypass AI result
      if (ch._prePass !== undefined) {
        return {label: ch.display || ch.label, pass: ch._prePass, note: ch._preNote || ''};
      }
      var r = checkMap[ch.id] || {};
      return {label: ch.display || ch.label, pass: !!r.pass, note: r.note || ''};
    });
    var passed = finalChecks.filter(function(ch){ return ch.pass; }).length;
    var humanFlags = (parsed.humanFlags || []).slice(0,5);
    S.copy[slug].audit = {checks:finalChecks, passed:passed, total:finalChecks.length, humanFlags:humanFlags, auditedAt:Date.now()};
    scheduleSave();
    renderCopyQueue();
  } catch(e) {
    if (auditEl) auditEl.innerHTML = '<span style="font-size:10px;color:#e5534b">Audit failed: '+esc(e.message)+'</span>';
  }
}


async function runCopyPass3(slug) {
  var cd = S.copy[slug];
  if (!cd || !cd.copy) return;
  var p = orderedPages().find(function(pp){ return pp.slug===slug; }) || cd.page || {};
  if (S.copyRunning) return;
  S.copyRunning = true; copyStopFlag = false;
  S.copyCurrentSlug = slug;
  renderCopyQueue();
  var streamEl = document.getElementById('copy-stream-'+slug);
  if (streamEl) { streamEl.style.display='block'; streamEl.textContent=''; }

  var r = S.research || {}, s = S.setup;
  // Build E-E-A-T material from research
  var proofPoints = (r.existing_proof || r.proof_points || []).slice(0,6).join('\n- ');
  var caseStudies = (r.case_studies || []).slice(0,4).map(function(cs){ return typeof cs==='object'?((cs.client||'Client')+' — '+(cs.result||'result')+(cs.timeframe?' ('+cs.timeframe+')':'')):cs; }).join('\n- ');
  var teamCreds = r.team_credentials || r.founder_bio || '';
  var awards = (r.awards_certifications || []).join(', ');
  var clientLogos = (r.notable_clients || []).join(', ');
  var pageCtx = (p.pageContext || '').trim();

  // Persona-aware proof prioritisation
  var _p3Personas = (S.strategy && S.strategy.audience && S.strategy.audience.personas) || [];
  var _p3Persona = p.target_persona ? _p3Personas.find(function(per) { return per.name === p.target_persona; }) : null;
  var _p3PersonaCtx = '';
  if (_p3Persona) {
    _p3PersonaCtx = '\n\nTarget persona: ' + _p3Persona.name + '.';
    if (_p3Persona.segment) _p3PersonaCtx += ' Segment: ' + _p3Persona.segment + '.';
    _p3PersonaCtx += ' Prioritise E-E-A-T signals this persona would find credible — ' + _p3Persona.segment + '-specific case studies and credentials first, then general proof.';
    if (_p3Persona.decision_criteria && _p3Persona.decision_criteria.length) {
      _p3PersonaCtx += '\nProof they need: ' + _p3Persona.decision_criteria.slice(0, 3).join('; ') + '.';
    }
    _p3PersonaCtx += '\nIf relevant proof is missing, add <!-- PROOF GAP: description --> comments so human QC can address it.';
  }

  var _p3PosDir = S.strategy && S.strategy.positioning && S.strategy.positioning.selected_direction;
  var _p3DirCtx = '';
  if (_p3PosDir && _p3PosDir.direction) {
    _p3DirCtx = '\n\nPositioning direction: "' + _p3PosDir.direction + '". Select proof points that specifically support this positioning. Prioritise proof that demonstrates "' + (_p3PosDir.headline || _p3PosDir.direction) + '" over generic credibility signals.';
  }

  var pass3System = 'You are a senior E-E-A-T specialist and conversion copywriter. You receive existing page HTML and add Experience, Expertise, Authoritativeness, and Trust signals throughout the copy without changing its structure. Make signals specific and credible — never generic. Canadian spelling.';
  var prompt = '## EXISTING COPY\n' + cd.copy
    + '\n\n## E-E-A-T MATERIAL TO INJECT'
    + (proofPoints ? '\n\nProof points:\n- ' + proofPoints : '')
    + (caseStudies ? '\n\nCase study results:\n- ' + caseStudies : '')
    + (teamCreds ? '\n\nTeam credentials: ' + teamCreds : '')
    + (awards ? '\n\nAwards/accreditations: ' + awards : '')
    + (clientLogos ? '\n\nNotable clients: ' + clientLogos : '')
    + (pageCtx ? '\n\nPage-specific context: ' + pageCtx : '')
    + _p3PersonaCtx + _p3DirCtx
    + '\n\n## TASK\nEnhance this copy with E-E-A-T signals using the material above. Rules:'
    + '\n1. Add specific stats, results, and credentials where they strengthen credibility'
    + '\n2. Make social proof concrete — named clients, specific outcomes, real numbers'
    + '\n3. Flag any E-E-A-T material that is missing (no stats, no case studies, etc.) with <!-- MISSING: --> comments'
    + '\n4. Never invent proof points — only use material provided above'
    + '\n5. Maintain the existing H2/H3 structure and CTA positions'
    + '\n6. Return the complete enhanced HTML';

  try {
    if(typeof storePrompt==='function') storePrompt('copy-pass3-'+slug, pass3System, prompt, 'Pass 3 E-E-A-T: '+(p.page_name||slug), slug);
    window._aiBarLabel = 'Pass 3 E-E-A-T: '+(p.page_name||slug);
    var result = await callClaude(pass3System, prompt, function(t){
      if (copyStopFlag) return;
      if (streamEl) streamEl.textContent = t.slice(-600);
    }, 6000);
    if (!copyStopFlag) {
      var _drafts = cd.drafts || [];
      var _newDraft = {v: _drafts.length+1, html: result, pass: 3, generatedAt: Date.now()};
      _drafts.push(_newDraft);
      if (_drafts.length > 3) _drafts = _drafts.slice(-3);
      cd.copy = result;
      cd.drafts = _drafts;
      cd.activeDraft = _drafts.length-1;
      cd.audit = null;
      scheduleSave();
      if(typeof aiBarNotify==='function') aiBarNotify('✓ Pass 3 complete — E-E-A-T signals injected. Re-run audit.', {duration:5000});
    }
  } catch(e) {
    console.error('Pass 3 error', e);
    if(typeof aiBarNotify==='function') aiBarNotify('Pass 3 failed: '+e.message, {isError:true,duration:4000});
  }
  if (streamEl) streamEl.style.display='none';
  S.copyCurrentSlug = null;
  S.copyRunning = false;
  renderCopyQueue(); updateCopyProgress();
}


async function runCopyPass2(slug) {
  var c = S.copy[slug];
  if (!c || !c.copy || !c.audit) return;
  // Always prefer live page state — c.page is a snapshot taken at write time and may be stale
  var p = orderedPages().find(function(pp){ return pp.slug===slug; }) || c.page || {};
  if (S.copyRunning) return;
  S.copyRunning = true; copyStopFlag = false;
  S.copyCurrentSlug = slug;
  renderCopyQueue();
  var streamEl = document.getElementById('copy-stream-'+slug);
  if (streamEl) { streamEl.style.display='block'; streamEl.textContent=''; }

  var failedChecks = (c.audit.checks||[]).filter(function(ch){ return !ch.pass; });
  var passingChecks = (c.audit.checks||[]).filter(function(ch){ return ch.pass; });
  var failList = failedChecks.map(function(ch){ return '- '+ch.label+(ch.note ? ' [AI note: '+ch.note+']' : ''); }).join('\n');
  var passList = passingChecks.map(function(ch){ return '- '+ch.label; }).join('\n');

  // Compact page context — NOT the full buildCopyPrompt, just the essentials
  var r = S.research || {}, s = S.setup;
  var kws = (p.supporting_keywords||[]).map(function(k){ return k.kw||k; }).filter(Boolean).join(', ');
  var pageCtx = 'PAGE: ' + (p.page_name||slug) + ' | Type: ' + (p.page_type||'') + ' | /' + (p.slug||slug)
    + '\nPrimary keyword: ' + (p.primary_keyword||'')
    + '\nSupporting keywords: ' + kws
    + '\nWord count target: ' + (p.word_count_target||1500)
    + '\nClient: ' + (s&&s.client||'')
    + '\nGeo: ' + getPageGeo(p)
    + '\nVoice: ' + ((getStrategyField('brand_strategy.tone_and_voice', 'tone_and_voice'))||(s&&s.voice)||'Confident, direct. Canadian spelling.');

    // Add strategy context for targeted fixes
    var _p2Personas = (S.strategy && S.strategy.audience && S.strategy.audience.personas) || [];
    var _p2Persona = p.target_persona ? _p2Personas.find(function(per) { return per.name === p.target_persona; }) : null;
    var _p2PosDir = S.strategy && S.strategy.positioning && S.strategy.positioning.selected_direction;
    var _p2Ctx = '';
    if (_p2Persona) _p2Ctx += '\nTarget persona: ' + _p2Persona.name + '. Pains: ' + (_p2Persona.frustrations || []).slice(0, 3).join('; ') + '. When fixing reader profile or objection checks, use this persona.';
    if (_p2PosDir && _p2PosDir.direction) _p2Ctx += '\nPositioning: "' + _p2PosDir.direction + '" — ' + (_p2PosDir.headline || '') + '. Fixes must maintain this positioning.';
    var _voiceOv2 = p.voice_overlay || 'base';
    if (_voiceOv2 !== 'base' && S.strategy && S.strategy.brand_strategy && S.strategy.brand_strategy.voice_overlays && S.strategy.brand_strategy.voice_overlays[_voiceOv2]) {
      var _ov2 = S.strategy.brand_strategy.voice_overlays[_voiceOv2];
      _p2Ctx += '\nVoice overlay (' + _voiceOv2 + '): ' + (typeof _ov2 === 'string' ? _ov2 : JSON.stringify(_ov2)) + '. Fixes must maintain this vertical voice.';
    }

  // Trim HTML for input — strip inline styles and class attrs to save tokens
  // Strip style/class attrs to save tokens, keep up to 7500 chars of actual content
  var trimmedHtml = (c.copy||'').replace(/ style="[^"]*"/g,'').replace(/ class="[^"]*"/g,'').replace(/ data-[^=]*="[^"]*"/g,'').slice(0,7500);
  var draftWordCount = (c.copy||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().split(' ').length;

  var pass2System = 'You are a senior CRO copywriter doing a surgical improvement pass on existing page copy.'
    + ' Your job is to fix ONLY the specific failed checks listed below.'
    + ' You MUST output the COMPLETE improved HTML page — every section, start to finish.'
    + ' Sections that are already passing must be reproduced with only the HTML markup — do not reword, restructure, or rewrite them.'
    + ' Only sections relevant to the failed checks should be meaningfully changed.'
    + ' Canadian spelling. Output clean semantic HTML only, no explanation.';

  var assignedQsList = (p.assignedQuestions||[]).length
    ? '\n\n## ASSIGNED FAQ QUESTIONS (must appear verbatim in FAQ section):\n' + (p.assignedQuestions||[]).map(function(q,i){ return (i+1)+'. '+q; }).join('\n')
    : '';

  var prompt = '## PAGE CONTEXT\n' + pageCtx + _p2Ctx
    + assignedQsList
    + '\n\n## CHECKS ALREADY PASSING (preserve these sections — do not rewrite):\n' + passList
    + '\n\n## FAILED CHECKS TO FIX (improve specifically for these):\n' + failList
    + '\n\n## EXISTING DRAFT (your base — output the full improved version of this):\n' + trimmedHtml
    + '\n\n## INSTRUCTION\nOutput the COMPLETE improved HTML. Fix the failed checks above.'
    + ' CRITICAL: The existing draft has approx '+draftWordCount+' words. Do NOT output less than this.'
    + ' Do not truncate. Do not stop mid-sentence. Write every section through to the final CTA.'
    + ' If word count is failing, expand every thin section — add specific stats, client outcomes, named results.'
    + ' If FAQ is missing, insert a complete FAQ section (8+ Q&As) immediately before the final CTA.'
    + ' If Canadian spelling is failing, fix: maximize→maximise, optimize→optimise, analyze→analyse, center→centre.';

  try {
    var result = await callClaude(pass2System, prompt, function(t){
      if (copyStopFlag) return;
      var el = document.getElementById('copy-stream-'+slug);
      if (el) el.textContent = t.slice(-600);
    }, 6000);
    if (!copyStopFlag) {
      // Validate result is actual HTML — not a prose refusal or empty string
      var isValidHtml = result && result.length > 500 && result.indexOf('<') !== -1;
      if (!isValidHtml) {
        var auditEl2 = document.getElementById('copy-audit-'+slug);
        if (auditEl2) auditEl2.innerHTML = '<span style="font-size:10px;color:#e5534b">Pass failed: model returned non-HTML response. Previous draft preserved.</span>';
      } else {
        var passNum = ((c.drafts||[]).filter(function(d){ return d.pass===2; }).length) + 2;
        var drafts = c.drafts || [{v:1, html:c.copy, pass:1, generatedAt:c.writtenAt||Date.now()}];
        drafts.push({v:passNum, html:result, pass:2, generatedAt:Date.now()});
        S.copy[slug].drafts = drafts;
        S.copy[slug].activeDraft = drafts.length - 1;
        S.copy[slug].copy = result;
        S.copy[slug].audit = null;
        saveCopyHtml(slug); scheduleSave();
      }
    }
  } catch(e) {
    console.error('Pass 2 error', e);
  }
  if (streamEl) streamEl.style.display = 'none';
  S.copyCurrentSlug = null;
  S.copyRunning = false;
  renderCopyQueue(); updateCopyProgress();
  // Auto-reaudit on the fresh draft — only if valid copy exists
  if (!copyStopFlag && S.copy[slug] && S.copy[slug].copy && S.copy[slug].copy.length > 500) {
    setTimeout(function(){ runCopyAudit(slug); }, 600);
  }
}

function toggleCopyCode(slug) {
  const el      = document.getElementById('copy-code-'+slug);
  const preview = document.getElementById('copy-preview-'+slug);
  const btn     = document.getElementById('copy-code-btn-'+slug);
  if (!el) return;
  // Exit edit mode first if active
  if (preview && preview.contentEditable === 'true') {
    if (!S.copy[slug]) S.copy[slug] = {};
    S.copy[slug].copy = preview.innerHTML;
    preview.contentEditable = 'false';
    preview.style.border = '1px solid var(--border)';
    preview.style.boxShadow = 'none';
    preview.style.cursor = 'default';
    const editBtn = document.getElementById('copy-edit-btn-'+slug);
    if (editBtn) editBtn.innerHTML = '<i class="ti ti-edit"></i> Edit';
    scheduleSave();
    // Update code view with latest content
    el.textContent = preview.innerHTML;
  }
  const showingCode = el.style.display !== 'none';
  if (showingCode) {
    el.style.display = 'none';
    if (preview) preview.style.display = 'block';
    btn.textContent = 'Show code';
  } else {
    el.style.display = 'block';
    if (preview) preview.style.display = 'none';
    btn.textContent = 'Hide code';
  }
}

function toggleCopyEdit(slug) {
  const previewEl = document.getElementById('copy-preview-'+slug);
  const codeEl    = document.getElementById('copy-code-'+slug);
  const editBtn   = document.getElementById('copy-edit-btn-'+slug);
  if (!previewEl) return;

  const isEditing = previewEl.contentEditable === 'true';

  if (isEditing) {
    // ── Save ── serialise innerHTML back to state
    previewEl.contentEditable = 'false';
    previewEl.style.outline  = 'none';
    previewEl.style.boxShadow = 'none';
    previewEl.style.border   = '1px solid var(--border)';
    previewEl.style.cursor   = 'default';
    if (!S.copy[slug]) S.copy[slug] = {};
    S.copy[slug].copy = previewEl.innerHTML;
    // Also keep code view in sync
    if (codeEl) codeEl.textContent = previewEl.innerHTML;
    saveCopyHtml(slug); scheduleSave();
    editBtn.innerHTML = '<i class="ti ti-edit"></i> Edit';
  } else {
    // ── Edit ── make preview directly editable
    if (codeEl) { codeEl.style.display = 'none'; document.getElementById('copy-code-btn-'+slug) && (document.getElementById('copy-code-btn-'+slug).textContent = 'Show code'); }
    previewEl.style.display = 'block';
    previewEl.contentEditable = 'true';
    previewEl.style.outline  = 'none';
    previewEl.style.border   = '1.5px solid var(--green)';
    previewEl.style.boxShadow = '0 0 0 3px rgba(21,142,29,0.08)';
    previewEl.style.cursor   = 'text';
    previewEl.focus();
    // Place cursor at end
    const range = document.createRange();
    range.selectNodeContents(previewEl);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    editBtn.innerHTML = '<i class="ti ti-check"></i> Save';
  }
}

function populateCopyPreviews() {
  // After renderCopyQueue builds the DOM, inject actual HTML content into preview divs
  (S.pages || []).forEach(p => {
    const preview = document.getElementById('copy-preview-' + p.slug);
    if (preview && (S.copy[p.slug]||{}).copy) {
      preview.innerHTML = sanitiseHTML((S.copy[p.slug]||{}).copy);
      // Add scoped copy-preview styles if not already present
      if (!document.getElementById('copy-preview-styles')) {
        const style = document.createElement('style');
        style.id = 'copy-preview-styles';
        style.textContent = `
          [id^="copy-preview-"] h1 { font-size:22px; font-weight:600; color:var(--dark); margin:0 0 10px; line-height:1.3 }
          [id^="copy-preview-"] h2 { font-size:17px; font-weight:600; color:var(--dark); margin:18px 0 8px; line-height:1.3 }
          [id^="copy-preview-"] h3 { font-size:14px; font-weight:600; color:var(--dark); margin:14px 0 6px }
          [id^="copy-preview-"] p  { margin:0 0 10px; color:var(--dark); font-size:13.5px; line-height:1.75 }
          [id^="copy-preview-"] ul, [id^="copy-preview-"] ol { margin:0 0 10px; padding-left:20px }
          [id^="copy-preview-"] li { margin-bottom:4px; font-size:13px; color:var(--dark); line-height:1.6 }
          [id^="copy-preview-"] a  { color:var(--green); text-decoration:none }
          [id^="copy-preview-"] strong { font-weight:600 }
          [id^="copy-preview-"] section { margin-bottom:18px; padding-bottom:18px; border-bottom:1px solid var(--border) }
          [id^="copy-preview-"] section:last-child { border-bottom:none; margin-bottom:0; padding-bottom:0 }
          [id^="copy-preview-"] .hero, [id^="copy-preview-"] .cta-primary, [id^="copy-preview-"] .trust-signal { display:block }
          [id^="copy-preview-"] div { margin-bottom:4px }
        `;
        document.head.appendChild(style);
      }
    }
  });
}

function renderCopyQueue() {
  const pages = orderedPages();

  const groups = [
    { key:'core',     label:'Core Pages',         icon:'ti-layout-2',         types:['home','about','utility','contact'] },
    { key:'service',  label:'Services',            icon:'ti-briefcase',        types:['service'] },
    { key:'industry', label:'Industry & Location', icon:'ti-map-pin',          types:['industry','location'] },
    { key:'blog',     label:'Blog Posts',          icon:'ti-article',          types:['blog'] },
    { key:'other',    label:'Other',               icon:'ti-file',             types:[] }
  ];

  const grouped = {};
  groups.forEach(g => grouped[g.key] = []);
  pages.forEach(p => {
    const g = groups.find(g => g.types.includes(p.page_type));
    if (g) grouped[g.key].push(p);
    else grouped['other'].push(p);
  });

  const typeIcon = t => ({
    home:'ti-home', about:'ti-info-circle', utility:'ti-settings', contact:'ti-mail',
    service:'ti-briefcase', industry:'ti-building-factory', location:'ti-map-pin', blog:'ti-article'
  }[t] || 'ti-file');

  let html = '';
  let globalIdx = 0;
  let firstGroup = true;

  groups.forEach(group => {
    const gPages = grouped[group.key];
    if (!gPages.length) return;
    const doneCount = gPages.filter(p => !!(S.copy[p.slug]||{}).copy).length;

    // Section header
    html += `<div style="display:flex;align-items:center;gap:7px;margin-top:${firstGroup?'0':'18px'};margin-bottom:7px;padding-bottom:7px;border-bottom:1px solid var(--border)">`;
    html += `<i class="ti ${group.icon}" style="font-size:11px;color:var(--n2)"></i>`;
    html += `<span style="font-size:10.5px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em">${group.label}</span>`;
    html += `<span style="font-size:10px;color:${doneCount===gPages.length?'var(--green)':'var(--n2)'};background:rgba(0,0,0,0.04);border-radius:10px;padding:0px 6px">${doneCount}/${gPages.length}</span>`;
    html += `</div>`;
    firstGroup = false;

    gPages.forEach(p => {
      globalIdx++;
      const r = S.copy[p.slug]||{};
      const isDone = !!r.copy, isErr = !!r.error;
      const isRunning = S.copyCurrentSlug === p.slug;
      const isExpanded = S.copyExpandedSlug === p.slug;
      const pColor = p.priority==='P1'?'var(--green)':p.priority==='P2'?'var(--warn)':'var(--n2)';
      const cirStyle = isDone?'background:var(--green)':isErr?'background:var(--error)':isRunning?'background:var(--green)':'background:var(--n1)';
      const cirContent = isDone?'&#10003;':isErr?'!':isRunning?'<span class="spinner" style="width:8px;height:8px;border-top-color:white;border-color:rgba(255,255,255,0.3)"></span>':globalIdx;
      const rowBorder = isExpanded?'border-color:var(--dark);':isDone?'border-color:rgba(21,142,29,0.3);':isErr?'border-color:rgba(229,57,53,0.22);':'';
      const rowBg = isExpanded&&!isDone&&!isRunning?'background:rgba(0,0,0,0.015);':'';

      html += `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:5px;${rowBorder}${rowBg}">`;

      // Row header
      html += `<div onclick="toggleCopyExpand('${p.slug}')" style="display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;user-select:none">`;
      html += `<div class="status-circle" style="${cirStyle};font-size:9px;font-weight:500;flex-shrink:0">${cirContent}</div>`;
      html += `<i class="ti ${typeIcon(p.page_type)}" style="font-size:12px;color:${isDone?'var(--green)':'var(--n2)'};flex-shrink:0"></i>`;
      html += `<div style="flex:1;min-width:0">`;
      html += `<div style="display:flex;align-items:baseline;gap:6px">`;
      html += `<span style="font-size:13px;color:${isDone||isExpanded?'var(--dark)':'var(--n3)'};font-weight:${isDone?'500':'400'}">${esc(p.page_name)}</span>`;
      html += `<span style="font-size:10px;color:${pColor};padding:0px 5px;background:rgba(0,0,0,0.04);border-radius:3px;flex-shrink:0">${p.priority}</span>`;
      if (isErr&&!isExpanded) html += `<span style="font-size:11px;color:var(--error)">Error</span>`;
      html += `</div>`;
      html += `<div style="font-size:10px;color:var(--n2);margin-top:1px;font-family:monospace;letter-spacing:-.01em">/${p.slug}</div>`;
      html += `</div>`;
      html += `<i class="ti ${isExpanded?'ti-chevron-up':'ti-chevron-down'}" style="font-size:12px;color:var(--n2);flex-shrink:0"></i>`;
      html += `</div>`;

      // Expanded body
      if (isExpanded) {
        html += '<div style="border-top:1px solid var(--border);padding:14px 14px 14px">';
        if (isRunning) {
          html += '<div style="background:var(--dg);border-radius:6px;padding:12px;min-height:80px;max-height:160px;overflow:auto;font-family:monospace;font-size:11px;color:rgba(255,255,255,0.45);line-height:1.65;white-space:pre-wrap;word-break:break-word" id="copy-stream-'+p.slug+'"></div>'
            +'<div style="margin-top:10px"><button class="btn btn-danger sm" onclick="stopCopy()"><i class="ti ti-player-stop"></i> Stop</button></div>';
        } else if (isDone) {
          var _isApproved = !!(r.approved);
          var _briefApproved = !!(p.brief && p.brief.approved && p.brief.summary && p.brief.summary.trim().length > 50);
          var _copyWrittenAt = r.writtenAt || 0;
          var _briefApprovedAt = (p.brief||{}).approvedAt || 0;
          var _stale = _briefApproved && _briefApprovedAt > _copyWrittenAt;
          var _drafts = r.drafts || [{v:1, html:r.copy, pass:1, generatedAt:r.writtenAt||0}];
          var _activeDraft = (typeof r.activeDraft === 'number') ? r.activeDraft : 0;
          var _audit = r.audit || null;
          var _humanQC = r.humanQC || {};

          // INFO BAR
          var _bb2 = _briefApproved
            ? '<span style="font-size:9px;background:rgba(21,142,29,0.1);color:var(--green);border:1px solid rgba(21,142,29,0.25);border-radius:3px;padding:1px 6px;font-weight:600">\u2713 Brief</span>'
            : (p.brief && p.brief.summary ? '<span style="font-size:9px;background:rgba(255,165,0,0.08);color:var(--warn);border:1px solid rgba(255,165,0,0.3);border-radius:3px;padding:1px 6px">No brief</span>' : '');
          html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;background:rgba(0,0,0,0.02);border-bottom:1px solid var(--border);font-size:10.5px;color:var(--n2);flex-wrap:wrap">'
            + '<span style="color:var(--dark);font-weight:600">' + esc(p.primary_keyword||'\u2014') + '</span>'
            + (p.search_intent ? ' <span>\u00b7</span> ' + esc(p.search_intent) : '')
            + (p.word_count_target ? ' <span>\u00b7</span> ' + p.word_count_target + ' words' : '')
            + (_bb2 ? ' <span>\u00b7</span> ' + _bb2 : '')
            + '</div>';

          // PAIN CONTEXT SIDEBAR
          html += _buildPainSidebar(p);

          // STALE BRIEF BANNER
          if (_stale) {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 14px;background:rgba(21,142,29,0.07);border-bottom:1px solid rgba(21,142,29,0.2)"><i class="ti ti-sparkles" style="color:var(--green);font-size:12px"></i> <span style="font-size:11px;color:var(--dark);font-weight:500">Brief approved after copy was written.</span> <span style="font-size:11px;color:var(--n2)">Redo to regenerate using the brief.</span></div>';
          }

                    // META TAGS
          var _mt2 = esc(p.meta_title||''), _md2 = esc(p.meta_description||'');
          var _mtL=(p.meta_title||'').length, _mdL=(p.meta_description||'').length;
          var _mtC2=_mtL>60?'#E53935':_mtL>50?'var(--warn)':_mtL===0?'var(--n2)':'var(--green)';
          var _mdC2=_mdL>160?'#E53935':_mdL>140?'var(--warn)':_mdL===0?'var(--n2)':'var(--green)';
          html += '<div style="padding:8px 14px;border-bottom:1px solid var(--border)">';
          html += '<div style="font-size:9px;font-weight:600;color:var(--n2);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px"><i class="ti ti-tag" style="font-size:9px"></i> Meta Tags</div>';
          html += '<div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><label style="font-size:10px;color:var(--n2)">TITLE</label><span style="font-size:9.5px;color:'+_mtC2+'">'+_mtL+'/60</span></div><input class="inp" data-meta-slug=\'+p.slug+\' style="font-size:11.5px;padding:5px 8px" placeholder="50-60 chars" value="'+_mt2+'" oninput="S.pages.find(function(pp){return pp.slug===\''+p.slug+'\';}).meta_title=this.value;scheduleSave()" /></div>';
          html += '<div><div style="display:flex;justify-content:space-between;margin-bottom:3px"><label style="font-size:10px;color:var(--n2)">DESCRIPTION</label><span style="font-size:9.5px;color:'+_mdC2+'">'+_mdL+'/160</span></div><textarea class="inp" data-meta-slug=\'+p.slug+\' style="font-size:11.5px;padding:5px 8px;height:52px;resize:none" placeholder="150-160 chars" oninput="S.pages.find(function(pp){return pp.slug===\''+p.slug+'\';}).meta_description=this.value;scheduleSave()">'+_md2+'</textarea></div>';
          html += '</div>';


          // DRAFT TABS + TOOLBAR
          html += '<div style="display:flex;align-items:center;padding:7px 14px;border-bottom:1px solid var(--border);gap:0">';
          html += '<div style="display:flex;gap:3px;flex:1">';
          _drafts.forEach(function(d, di) {
            var isActive = di === _activeDraft;
            var pLabel = d.pass === 2 ? 'Pass 2' : 'Pass 1';
            var ts = d.generatedAt ? new Date(d.generatedAt).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) : '';
            html += '<button onclick="copyActivateDraft(\''+p.slug+'\','+di+')" style="font-size:10px;padding:2px 9px;border-radius:4px;cursor:pointer;font-family:var(--font);font-weight:'+(isActive?'600':'400')+';background:'+(isActive?'var(--dark)':'rgba(0,0,0,0.04)')+';color:'+(isActive?'white':'var(--n2)')+';border:1px solid '+(isActive?'var(--dark)':'transparent')+'">'
              + 'v'+d.v+' \u00b7 '+pLabel+(ts?' \u00b7 '+ts:'')
              + '</button>';
          });
          html += '</div>';
          html += '<div style="display:flex;gap:5px">';
          html += '<button class="btn btn-ghost sm" onclick="copyToClip2((S.copy[\''+p.slug+'\']||{}).copy)"><i class="ti ti-copy"></i> Copy HTML</button>';
          html += '<button class="btn btn-ghost sm" id="copy-code-btn-'+p.slug+'" onclick="toggleCopyCode(\''+p.slug+'\')">Show code</button>';
          html += '<button class="btn btn-ghost sm" id="copy-edit-btn-'+p.slug+'" onclick="toggleCopyEdit(\''+p.slug+'\')" ><i class="ti ti-edit"></i> Edit</button>';
          html += '</div>';
          html += '</div>';

          // STREAM + PREVIEW + CODE
          html += '<div style="background:var(--dg);border-radius:0;padding:12px;min-height:60px;max-height:160px;overflow:auto;font-family:monospace;font-size:10px;color:#7ee787;white-space:pre-wrap;display:none" id="copy-stream-'+p.slug+'"></div>';
          html += '<div id="copy-preview-'+p.slug+'" style="padding:18px 22px;font-size:13.5px;line-height:1.75;color:var(--dark);max-height:480px;overflow:auto;border-bottom:1px solid var(--border)"></div>';
          html += '<div id="copy-code-'+p.slug+'" style="display:none;max-height:280px;overflow:auto;font-family:monospace;font-size:11px;color:var(--n3);white-space:pre-wrap;line-height:1.65;background:var(--bg);padding:12px 14px;border-bottom:1px solid var(--border)">'+esc(r.copy||'')+'</div>';

          // KEYWORD DENSITY
          var _kws2 = [p.primary_keyword].concat((p.supporting_keywords||[]).map(function(sk){ return typeof sk==='object'?sk.kw:sk; })).filter(Boolean);
          if (_kws2.length) {
            html += '<div style="display:flex;flex-wrap:wrap;gap:5px;padding:7px 14px;border-bottom:1px solid var(--border)">';
            _kws2.forEach(function(kw) {
              var cnt = countKeywordsInCopy(r.copy||'', kw);
              var cc = cnt===0?'#E53935':cnt<2?'var(--warn)':'var(--green)';
              html += '<span style="font-size:10px;color:'+cc+';background:rgba(0,0,0,0.05);border-radius:10px;padding:2px 8px;border:1px solid rgba(0,0,0,0.07)">'+esc(kw)+' x'+cnt+'</span>';
            });
            html += '</div>';
          }

          // AI AUDIT
          html += '<div id="copy-audit-'+p.slug+'" data-sai-explain="copy-audit:' + esc(p.slug || '') + '" style="padding:8px 14px;border-bottom:1px solid var(--border)">';
          if (_audit) {
            var _aPct = Math.round((_audit.passed/_audit.total)*100);
            var _aClr = _aPct>=80?'var(--green)':_aPct>=55?'var(--warn)':'#e5534b';
            // Score bar header
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">';
            html += '<div style="width:80px;height:6px;background:rgba(0,0,0,0.08);border-radius:3px;overflow:hidden"><div style="width:'+_aPct+'%;height:100%;background:'+_aClr+';border-radius:3px"></div></div>';
            html += '<span style="font-size:11px;font-weight:700;color:'+_aClr+'">'+_aPct+'%</span>';
            html += '<span style="font-size:10px;color:var(--n2)">AI copy audit — '+_audit.passed+'/'+_audit.total+' checks passed</span>';
            html += '<button onclick="runCopyAudit(\''+p.slug+'\')" style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:3px;padding:1px 8px;font-size:9px;cursor:pointer;font-family:var(--font);color:var(--n2)">Re-audit</button>';
            html += '</div>';
            // Checks as rows
            html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;margin-top:4px">';
            (_audit.checks||[]).forEach(function(ch) {
              var pass = ch.pass;
              var clr  = pass ? 'var(--green)' : '#e5534b';
              var bg   = pass ? 'rgba(21,142,29,0.04)' : 'rgba(229,83,75,0.04)';
              var tip  = esc(ch.note||ch.label||'');
              html += '<div title="'+tip+'" style="display:flex;align-items:center;gap:5px;padding:3px 5px;border-radius:3px;background:'+bg+'">';
              html += '<span style="font-size:10px;color:'+clr+';font-weight:700;flex-shrink:0">'+(pass?'\u2713':'\u2717')+'</span>';
              html += '<span style="font-size:10px;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">'+esc(ch.display||ch.label)+'</span>';
              html += '</div>';
            });
            html += '</div>';
            if (_aPct < 100) {
              var _nextPassNum = (_drafts.filter(function(d){return d.pass===2;}).length) + 2;
              html += '<div style="margin-top:8px;display:flex;align-items:center;gap:8px"><button onclick="runCopyPass2(\''+p.slug+'\')" style="background:var(--lime);border:none;border-radius:4px;padding:4px 14px;font-size:10px;font-weight:600;cursor:pointer;font-family:var(--font)">✦ Run Pass '+_nextPassNum+' — Fix '+(_audit.total-_audit.passed)+' failed checks</button><span style="font-size:9px;color:var(--n2)">Surgical patch only — passing sections preserved</span></div>';
            } else {
              // Audit passing — offer Pass 3 E-E-A-T
              var _hasPass3 = _drafts.some(function(d){return d.pass===3;});
              html += '<div style="margin-top:8px;display:flex;align-items:center;gap:8px">'
                + '<button onclick="runCopyPass3(\''+p.slug+'\')" data-tip="Pass 3 injects E-E-A-T signals into the copy using proof points, case study results, team credentials, and notable clients from Research. Run after audit passes. Never invents proof — only uses data you have provided. Flags missing material with comments." style="background:rgba(21,142,29,0.08);border:1px solid rgba(21,142,29,0.3);border-radius:4px;padding:4px 14px;font-size:10px;font-weight:600;cursor:pointer;font-family:var(--font);color:var(--green)">'
                + (_hasPass3?'↺ Re-run':'✦ Run') + ' Pass 3 — E-E-A-T</button>'
                + '<span style="font-size:9px;color:var(--n2)">Injects proof, credentials, results into existing copy</span>'
                + '</div>';
            }
          } else {
            html += '<button onclick="runCopyAudit(\''+p.slug+'\')" style="background:rgba(0,0,0,0.04);border:1px solid var(--border);border-radius:4px;padding:5px 14px;font-size:10px;font-weight:500;cursor:pointer;font-family:var(--font);color:var(--n3)"><i class="ti ti-robot" style="font-size:11px"></i> Run AI Audit (10 checks)</button>';
          }
          html += '</div>';

          // HUMAN QC
          var _hFlags = (_audit && _audit.humanFlags) ? _audit.humanFlags : [];
          var _pageType = p.page_type || 'service';
          // QC items computed in Human QC block below

          html += '<div style="border-bottom:1px solid var(--border)">';

          // HUMAN QC — human-only verification
          var _qcItems  = getQCItems(_pageType);
          var _qcChecked = _qcItems.filter(function(i){ return !!_humanQC[i.key]; }).length;
          var _qcTotal   = _qcItems.length;
          var _allDone   = _qcChecked === _qcTotal && _qcTotal > 0;
          var _qcBg      = _allDone ? 'rgba(21,142,29,0.05)' : 'transparent';

          html += '<div style="border-bottom:1px solid var(--border)">';

          // Header row
          html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 14px">';
          html += '<span style="font-size:9px;font-weight:700;color:var(--n2);text-transform:uppercase;letter-spacing:.06em">Human QC — '+_qcChecked+'/'+_qcTotal+'</span>';
          var _markBtnClr = _allDone ? 'var(--green)' : 'var(--n2)';
          html += '<button onclick="copyMarkAllQC(\''+p.slug+'\')" style="font-size:9px;font-weight:600;padding:2px 8px;border-radius:4px;border:1px solid var(--border);background:'+(_allDone?'rgba(21,142,29,0.1)':'rgba(0,0,0,0.04)')+';color:'+_markBtnClr+';cursor:pointer;font-family:var(--font)">'
            + (_allDone ? '✓ All verified' : 'Mark all done') + '</button>';
          html += '</div>';

          // AI flags first — claims that NEED eyes
          if (_hFlags.length) {
            html += '<div style="padding:0 14px 6px;display:flex;flex-direction:column;gap:3px">';
            _hFlags.forEach(function(flag) {
              var sev = flag.severity === 'high' ? '#e5534b' : '#d97706';
              html += '<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 8px;background:rgba(0,0,0,0.02);border-radius:4px;border-left:2px solid '+sev+'">';
              html += '<i class="ti ti-alert-triangle" style="font-size:10px;color:'+sev+';flex-shrink:0;margin-top:2px"></i>';
              html += '<div style="font-size:10px"><span style="font-weight:600;color:var(--dark)">'+esc(flag.item)+'</span> <span style="color:var(--n2)">— '+esc(flag.reason)+'</span></div>';
              html += '</div>';
            });
            html += '</div>';
          }

          // Checklist — compact single column
          html += '<div style="padding:0 14px 8px;display:flex;flex-direction:column;gap:2px;background:'+_qcBg+'">';
          _qcItems.forEach(function(item) {
            var chk = !!_humanQC[item.key];
            html += '<div onclick="copyToggleQC(\''+p.slug+'\',\''+item.key+'\')" title="'+esc(item.note||'')+
              '" style="display:flex;align-items:center;gap:7px;padding:3px 4px;border-radius:3px;cursor:pointer;transition:background .1s" onmouseover="this.style.background=\'rgba(0,0,0,0.03)\'" onmouseout="this.style.background=\'transparent\'">';
            html += '<div style="width:13px;height:13px;flex-shrink:0;border-radius:2px;border:1.5px solid '+(chk?'var(--green)':'var(--border)')+';background:'+(chk?'var(--green)':'white')+';display:flex;align-items:center;justify-content:center">';
            if (chk) html += '<i class="ti ti-check" style="font-size:7px;color:white"></i>';
            html += '</div>';
            html += '<span style="font-size:10px;color:'+(chk?'var(--dark)':'var(--n2)')+'">'+ esc(item.label) +'</span>';
            html += '</div>';
          });
          html += '</div>';
          html += '</div>';

          // BOTTOM BAR
          var _approved = !!(r && r.approved);
          var _siW = p.serpIntel;
          var _siWDone = !!(_siW && _siW.competitors && _siW.competitors.length);
          html += '<div style="display:flex;align-items:center;gap:6px;padding:10px 14px;flex-wrap:wrap">';
          html += '<button onclick="redoCopyPage(\''+p.slug+'\')" class="btn '+(_stale?'btn-primary':'btn-ghost')+' sm"><i class="ti ti-refresh" style="font-size:10px"></i> Redo</button>';
          html += '<button id="serp-intel-btn-'+p.slug+'" onclick="runSerpIntel(\''+p.slug+'\')" style="font-size:9px;font-weight:600;padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:'+(_siWDone?'rgba(21,142,29,0.08)':'rgba(0,0,0,0.04)')+';color:'+(_siWDone?'var(--green)':'var(--n2)')+';cursor:pointer;font-family:var(--font)">'+(_siWDone?'↻ Refresh SERP Intel':'⟳ Run SERP Intel')+'</button>';
          html += '<span id="serp-intel-status-'+p.slug+'" style="font-size:9px;color:var(--n2)"></span>';
          html += '<button id="copy-approve-btn-'+p.slug+'" onclick="copyApprove(\''+p.slug+'\')" style="margin-left:auto;padding:5px 14px;font-size:11px;font-weight:600;border-radius:6px;border:none;cursor:pointer;background:'+(_approved?'var(--green)':'var(--green)')+';color:#fff">'+(_approved?'✓ Approved':'Approve for Schema')+'</button>';
          html += '</div>';

          // NEXT PAGE
          var _ci2 = pages.findIndex(function(pp){ return pp.slug===p.slug; });
          var _np2 = pages.find(function(pp,ii){ return ii>_ci2 && !(S.copy[pp.slug]||{}).copy; });
          if (_np2) {
            html += '<div style="padding:0 14px 10px;display:flex;gap:8px">';
            html += '<button class="btn btn-primary sm" onclick="S.copyExpandedSlug=\''+_np2.slug+'\';renderCopyQueue();runCopyPage(\''+_np2.slug+'\')"><i class="ti ti-player-play"></i> Write: '+esc(_np2.page_name)+'</button>';
            html += '<button class="btn btn-ghost sm" onclick="goTo(\'schema\')">Skip to Schema</button>';
            html += '</div>';
          }
        } else if (isErr) {
          html += '<div style="color:var(--error);font-size:12px;margin-bottom:8px">'+esc(r.error)+'</div>'
            +'<button class="btn btn-primary sm" onclick="runCopyPage(\''+p.slug+'\')"><i class="ti ti-player-play"></i> Retry</button>';
        } else {
          var _hasBrief = !!(p.brief && p.brief.approved && p.brief.summary && p.brief.summary.trim().length > 50);
          var _briefExists = !!(p.brief && p.brief.summary && p.brief.summary.trim().length > 50);
          var _briefBadge = _hasBrief
            ? '<span title="Brief approved — copy will follow the content brief" style="font-size:9px;background:rgba(21,142,29,0.1);color:var(--green);border:1px solid rgba(21,142,29,0.25);border-radius:3px;padding:1px 6px;font-weight:600">✓ Brief</span> '
            : (_briefExists
              ? '<span title="Brief written but not approved — copy will use basic context only. Go back to Briefs to approve." style="font-size:9px;background:rgba(255,165,0,0.08);color:var(--warn);border:1px solid rgba(255,165,0,0.3);border-radius:3px;padding:1px 6px">⚠ Not approved</span> '
              : '<span title="No brief — copy will use basic context only" style="font-size:9px;background:rgba(0,0,0,0.04);color:var(--n2);border:1px solid var(--border);border-radius:3px;padding:1px 6px">No brief</span> ');
          var _si = p.serpIntel;
          var _siDone = !!(_si && _si.competitors && _si.competitors.length);
          var _siFallback = _siDone && _si.used_directory_fallback;
          var _siBtnLabel = _siDone ? (_siFallback ? '⚠ SERP Intel (directories)' : '✓ SERP Intel (' + _si.competitors.length + ')') : '⟳ SERP Intel';
          var _siBtnClr = _siDone ? (_siFallback ? 'var(--warn)' : 'var(--green)') : 'var(--n2)';
          var _siBtnBg  = _siDone ? (_siFallback ? 'rgba(255,165,0,0.08)' : 'rgba(21,142,29,0.08)') : 'rgba(0,0,0,0.04)';
          html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">';
          html += '<div style="font-size:12px;color:var(--n2);display:flex;align-items:center;gap:6px">'+_briefBadge+esc(p.primary_keyword||'')+' </div>';
          html += '<div style="display:flex;align-items:center;gap:6px">';
          html += '<button id="serp-intel-btn-'+p.slug+'" onclick="runSerpIntel(\''+p.slug+'\')" style="font-size:9px;font-weight:600;padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:'+_siBtnBg+';color:'+_siBtnClr+';cursor:pointer;font-family:var(--font)">'+_siBtnLabel+'</button>';
          html += '<span id="serp-intel-status-'+p.slug+'" style="font-size:9px;color:var(--n2)"></span>';
          html += '<button class="btn btn-primary sm" onclick="runCopyPage(\''+p.slug+'\')" title="'+ (_siDone ? 'SERP Intel loaded — copy will be competitor-aware' : 'Run SERP Intel first for best results') +'"><i class="ti ti-player-play"></i> Write Copy</button>';
          html += '</div></div>';
        }
        html += '</div>';
      }

      html += '</div>';
    });
  });

  document.getElementById('copy-queue').innerHTML = html;
  setTimeout(populateCopyPreviews, 0);
}

function updateCopyProgress() {
  const pages = orderedPages();
  const done = pages.filter(p => (S.copy[p.slug]||{}).copy).length;
  const pct = pages.length > 0 ? Math.round(done/pages.length*100) : 0;
  document.getElementById('copy-count-label').textContent = done+'/'+pages.length+' pages written';
  document.getElementById('copy-pct-label').textContent = pct+'%';
  document.getElementById('copy-progress-fill').style.width = pct+'%';
}

function checkCopyAllDone() {
  const pages = orderedPages();
  const done = pages.filter(p => (S.copy[p.slug]||{}).copy).length;
  if (done === pages.length && done > 0) {
    document.getElementById('copy-done-label').textContent = 'All '+done+' pages written';
    document.getElementById('copy-all-done').style.display = 'flex';
  } else { document.getElementById('copy-all-done').style.display = 'none'; }
}

// ── IMAGE GENERATION (Stage 5) ───────────────────────────────────

const IMAGE_SLOTS = [
  { label: 'Hero Banner',       ratio: '16:9 wide',   hint: 'main hero banner, dramatic wide composition, professional' },
  { label: 'Section Feature',   ratio: '4:3',         hint: 'supporting section image, feature highlight, clean background' },
  { label: 'Detail / Close-up', ratio: '1:1 square',  hint: 'detailed close-up or icon-style visual, square format' },
  { label: 'Content / Blog',    ratio: '3:2',         hint: 'content illustration or editorial visual, natural lighting' },
  { label: 'CTA / Closing',     ratio: '16:9 wide',   hint: 'call-to-action or closing visual, warm inviting tone' },
];

const DEFAULT_IMAGE_STYLE = 'Professional commercial photography style. Clean, modern, well-lit. Neutral or white backgrounds. No text overlays. No watermarks. Business-appropriate.';
