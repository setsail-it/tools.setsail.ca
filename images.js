
// ── IMAGE STAGE — Content-Aware Visual Planning Engine ─────────────────────
// Reads copy HTML to determine section structure, assigns visual types,
// builds persona-targeted prompts, supports upload/brief/placeholder/AI routes.

// ── Slot Schema Defaults ───────────────────────────────────────────────────

const SLOT_DEFAULTS = {
  slotType: 'section_break',     // hero | section_break | cta | proof | custom
  label: '',
  ratio: '4:3',
  contentContext: '',
  sectionIndex: null,
  visualType: 'photography',     // photography | photography_people | illustration | diagram | data_viz | social_proof | icon | before_after | screenshot
  sourceType: 'ai_generate',     // ai_generate | upload | brief_only | placeholder
  emotionalTarget: '',
  personaId: null,
  approvalStatus: 'pending',     // pending | approved | redo | replace | removed
  imageBrief: null,
  diagramSpec: null,
  sizeKB: 0,
  altText: '',
  errorMsg: null,
};

// ── Type / Source Maps ─────────────────────────────────────────────────────

const TYPE_SOURCE_MAP = {
  photography: 'ai_generate',
  photography_people: 'placeholder',
  illustration: 'ai_generate',
  diagram: 'placeholder',
  data_viz: 'placeholder',
  social_proof: 'upload',
  icon: 'placeholder',
  before_after: 'brief_only',
  screenshot: 'brief_only',
};

const TYPE_DIRECTIVES = {
  photography: 'Professional commercial photography. Clean, modern, well-lit. Real environments, authentic moments. No people unless needed.',
  photography_people: 'Professional environmental photography. Authentic, not corporate stock. NOTE: This is a placeholder — real photography recommended.',
  illustration: 'Clean modern illustration. Flat or semi-flat. Abstract but communicative. Professional, not clip-art.',
  diagram: 'Placeholder — generate clean process visual with distinct phases. NOT usable as a real diagram.',
  data_viz: 'Placeholder — abstract data-inspired visual. NOT a real chart.',
  social_proof: 'Placeholder — use upload for real photos. Warm, trustworthy composition.',
  icon: 'Minimal icon or spot illustration. Square. Single concept. Clean lines. Modern.',
};

const TYPE_CHIPS = {
  photography:        { icon: '\u{1F4F7}', label: 'Photo',        colour: '#546E7A' },
  photography_people: { icon: '\u{1F465}', label: 'People',       colour: '#E53935' },
  illustration:       { icon: '\u{1F3A8}', label: 'Illustration', colour: '#7E57C2' },
  diagram:            { icon: '\u{1F4CA}', label: 'Diagram',      colour: '#00ACC1' },
  data_viz:           { icon: '\u{1F4C8}', label: 'Data Viz',     colour: '#43A047' },
  social_proof:       { icon: '\u{1F464}', label: 'Proof',        colour: '#FB8C00' },
  icon:               { icon: '\u2B21',    label: 'Icon',         colour: '#78909C' },
  before_after:       { icon: '\u2194',    label: 'Before/After', colour: '#FB8C00' },
  screenshot:         { icon: '\u{1F4F1}', label: 'Screenshot',   colour: '#78909C' },
};

const SOURCE_CHIPS = {
  ai_generate: { label: 'AI',          colour: '#7E57C2' },
  upload:      { label: 'Upload',      colour: '#43A047' },
  brief_only:  { label: 'Brief',       colour: '#FB8C00' },
  placeholder: { label: 'Placeholder', colour: '#BDBDBD' },
};

// ── Global Style ───────────────────────────────────────────────────────────

function getGlobalImageStyle() {
  return (S.setup?.imageStyle || '').trim() || DEFAULT_IMAGE_STYLE;
}

function getBrandVisualStyle() {
  let style = getGlobalImageStyle();
  const voice = S.strategy?.brand_strategy?.voice_direction;
  if (voice && typeof voice === 'string') {
    style += ' Brand voice: ' + voice.substring(0, 120) + '.';
  }
  return style;
}

// ── Copy HTML Parser ───────────────────────────────────────────────────────

function parseCopySections(slug) {
  const copyData = S.copy && S.copy[slug];
  if (!copyData || !copyData.copy) return null;
  const html = typeof copyData.copy === 'string' ? copyData.copy : '';
  if (!html.trim()) return null;

  const div = document.createElement('div');
  div.innerHTML = html;

  const sections = [];
  let currentSection = null;

  function flushSection() {
    if (currentSection) {
      currentSection.wordCount = (currentSection.body || '').split(/\s+/).filter(Boolean).length;
      sections.push(currentSection);
    }
  }

  // Walk all direct and nested children to find heading boundaries
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_ELEMENT, null, false);
  let node = walker.firstChild();

  while (node) {
    const tag = node.tagName ? node.tagName.toUpperCase() : '';
    if (tag === 'H1' || tag === 'H2' || tag === 'H3') {
      flushSection();
      currentSection = {
        heading: (node.textContent || '').trim(),
        body: '',
        wordCount: 0,
        tag: tag.toLowerCase(),
      };
    } else if (currentSection) {
      const txt = (node.textContent || '').trim();
      if (txt && ['P', 'UL', 'OL', 'LI', 'DIV', 'SECTION', 'BLOCKQUOTE', 'TABLE', 'SPAN'].indexOf(tag) >= 0) {
        currentSection.body += (currentSection.body ? ' ' : '') + txt;
      }
    } else {
      // Content before first heading — start an implicit section
      const txt = (node.textContent || '').trim();
      if (txt && ['P', 'UL', 'OL', 'DIV', 'SECTION'].indexOf(tag) >= 0) {
        currentSection = { heading: '', body: txt, wordCount: 0, tag: 'intro' };
      }
    }
    node = walker.nextNode();
  }
  flushSection();

  return sections.length > 0 ? sections : null;
}

// ── Visual Type Detection ──────────────────────────────────────────────────

function determineVisualType(heading, body) {
  const h = (heading || '').toLowerCase();
  const b = (body || '').toLowerCase();

  if (/\b(process|steps?|how (?:it|we) work|phase|stage|workflow)\b/.test(h) ||
      /\b(step \d|phase \d|first.*then.*finally)\b/.test(b)) return 'diagram';
  if (/\b(results?|statistics?|numbers?|roi|percentage|growth)\b/.test(h) ||
      /\b(\d+%|\$\d|x more|x faster)\b/.test(b)) return 'data_viz';
  if (/\b(features?|benefits?|why choose|what you get|includes?)\b/.test(h)) return 'illustration';
  if (/\b(testimonial|review|client|case study|success|before.?after)\b/.test(h)) return 'social_proof';
  if (/\b(faq|question|ask|common)\b/.test(h)) return 'illustration';
  if (/\b(team|about|meet|our people|who we are)\b/.test(h)) return 'photography_people';

  return 'photography';
}

// ── Persona + Emotional Targeting ──────────────────────────────────────────

function getPersonaForPage(page) {
  if (!page) return null;
  const personas = S.strategy?.audience?.personas;
  if (!personas || !personas.length) return null;
  const target = page.target_persona;
  if (target) {
    const match = personas.find(p => p.name === target);
    if (match) return match;
  }
  return personas[0] || null;
}

function getPageEmotionalTarget(page) {
  const journey = (page.journeyStage || '').toLowerCase();
  let tone = '';
  if (journey === 'awareness') tone = 'curiosity, recognition, trust-building';
  else if (journey === 'consideration') tone = 'confidence, clarity, differentiation';
  else if (journey === 'decision') tone = 'urgency, reassurance, proof';
  else tone = 'professional confidence';

  const persona = getPersonaForPage(page);
  if (persona?.executionProfile?.emotionalDrivers) {
    const drivers = persona.executionProfile.emotionalDrivers;
    if (typeof drivers === 'string') tone += '. Persona drivers: ' + drivers.substring(0, 100);
    else if (Array.isArray(drivers)) tone += '. Persona drivers: ' + drivers.slice(0, 3).join(', ');
  }
  return tone;
}

// ── Dynamic Slot Initialisation ────────────────────────────────────────────

function initSlotsFromCopy(page) {
  const sections = parseCopySections(page.slug);
  if (!sections || sections.length === 0) return null;

  const slots = [];
  const emotional = getPageEmotionalTarget(page);
  const persona = getPersonaForPage(page);
  const personaId = persona ? persona.name : null;

  // Hero slot
  const firstHeading = sections[0]?.heading || page.page_name || '';
  slots.push(Object.assign({}, SLOT_DEFAULTS, {
    slotType: 'hero',
    label: 'Hero Banner',
    ratio: '16:9',
    contentContext: firstHeading.substring(0, 120),
    sectionIndex: 0,
    visualType: 'photography',
    sourceType: 'ai_generate',
    emotionalTarget: emotional,
    personaId: personaId,
    status: 'empty', prompt: '', b64: null, mimeType: null,
  }));

  // One slot per H2 section (skip first if it is the hero H1)
  let sectionStart = 0;
  if (sections[0].tag === 'h1' || sections[0].tag === 'intro') sectionStart = 1;

  for (let i = sectionStart; i < sections.length; i++) {
    const sec = sections[i];
    const vType = determineVisualType(sec.heading, sec.body);
    const sType = TYPE_SOURCE_MAP[vType] || 'ai_generate';

    slots.push(Object.assign({}, SLOT_DEFAULTS, {
      slotType: 'section_break',
      label: sec.heading ? sec.heading.substring(0, 60) : 'Section ' + (i + 1),
      ratio: vType === 'icon' ? '1:1' : '4:3',
      contentContext: (sec.heading + '. ' + (sec.body || '').substring(0, 200)).trim(),
      sectionIndex: i,
      visualType: vType,
      sourceType: sType,
      emotionalTarget: emotional,
      personaId: personaId,
      status: 'empty', prompt: '', b64: null, mimeType: null,
    }));

    // Long sections get an extra slot
    if (sec.wordCount > 500) {
      slots.push(Object.assign({}, SLOT_DEFAULTS, {
        slotType: 'section_break',
        label: (sec.heading ? sec.heading.substring(0, 40) : 'Section ' + (i + 1)) + ' (detail)',
        ratio: '3:2',
        contentContext: 'Detailed visual for long section: ' + (sec.heading || '').substring(0, 80),
        sectionIndex: i,
        visualType: 'photography',
        sourceType: 'ai_generate',
        emotionalTarget: emotional,
        personaId: personaId,
        status: 'empty', prompt: '', b64: null, mimeType: null,
      }));
    }
  }

  // CTA slot
  slots.push(Object.assign({}, SLOT_DEFAULTS, {
    slotType: 'cta',
    label: 'CTA / Closing',
    ratio: '16:9',
    contentContext: 'Call-to-action visual for ' + (page.page_name || page.slug),
    sectionIndex: null,
    visualType: 'photography',
    sourceType: 'ai_generate',
    emotionalTarget: emotional,
    personaId: personaId,
    status: 'empty', prompt: '', b64: null, mimeType: null,
  }));

  return slots;
}

function mergeSlotDefaults(slot) {
  // Ensure all SLOT_DEFAULTS keys exist on a slot (backward compat)
  const keys = Object.keys(SLOT_DEFAULTS);
  for (let k = 0; k < keys.length; k++) {
    if (slot[keys[k]] === undefined) {
      slot[keys[k]] = SLOT_DEFAULTS[keys[k]];
    }
  }
  return slot;
}

// ── Stage Init ─────────────────────────────────────────────────────────────

function initImageStage() {
  (S.pages || []).forEach(p => {
    if (!S.images[p.slug]) {
      // Try content-aware init first
      const smartSlots = initSlotsFromCopy(p);
      if (smartSlots) {
        S.images[p.slug] = { styleOverride: null, slots: smartSlots };
        // Build prompts for AI-generate slots
        smartSlots.forEach((sl, i) => {
          if (sl.sourceType === 'ai_generate' || sl.sourceType === 'placeholder') {
            sl.prompt = buildImagePrompt(p, i, null, sl);
          }
        });
      } else {
        // Legacy fallback: 5 fixed slots from IMAGE_SLOTS
        S.images[p.slug] = { styleOverride: null, slots: IMAGE_SLOTS.map((slDef, i) => {
          const slot = Object.assign({}, SLOT_DEFAULTS, {
            slotType: i === 0 ? 'hero' : i === 4 ? 'cta' : 'section_break',
            label: slDef.label,
            ratio: slDef.ratio,
            contentContext: slDef.hint,
            visualType: 'photography',
            sourceType: 'ai_generate',
            status: 'empty', prompt: '', b64: null, mimeType: null,
          });
          slot.prompt = buildImagePrompt(p, i, null, slot);
          return slot;
        })};
      }
    } else {
      // Existing page data — merge defaults into each slot for new fields
      const existing = S.images[p.slug];
      if (!existing.slots || existing.slots.length === 0) {
        existing.slots = IMAGE_SLOTS.map((slDef, i) => {
          const slot = Object.assign({}, SLOT_DEFAULTS, {
            label: slDef.label, ratio: slDef.ratio, contentContext: slDef.hint,
            status: 'empty', prompt: buildImagePrompt(p, i, existing.styleOverride, null), b64: null, mimeType: null,
          });
          return slot;
        });
      } else {
        existing.slots.forEach(sl => mergeSlotDefaults(sl));
      }
    }
  });
  // Prefill global style edit box
  const gEl = document.getElementById('image-style-global-edit');
  if (gEl) gEl.value = getGlobalImageStyle();
  renderImageQueue();
  updateImageProgress();
  // Load persisted images from KV in background
  loadAllPageImages();
}

function reinitFromCopy(slug) {
  const page = (S.pages || []).find(p => p.slug === slug);
  if (!page) return;
  const smartSlots = initSlotsFromCopy(page);
  if (!smartSlots) {
    aiBarNotify('No copy found for this page — cannot reinitialise.', { type: 'warn' });
    return;
  }
  // Preserve any existing images by matching labels
  const oldSlots = S.images[slug]?.slots || [];
  const newSlots = smartSlots;
  newSlots.forEach((ns, i) => {
    if (ns.sourceType === 'ai_generate' || ns.sourceType === 'placeholder') {
      ns.prompt = buildImagePrompt(page, i, S.images[slug]?.styleOverride || null, ns);
    }
  });
  // Try to carry forward done slots that match by label
  newSlots.forEach(ns => {
    const match = oldSlots.find(os => os.label === ns.label && os.status === 'done' && os.b64);
    if (match) {
      ns.b64 = match.b64;
      ns.mimeType = match.mimeType;
      ns.sizeKB = match.sizeKB;
      ns.status = 'done';
      ns.altText = match.altText || ns.altText;
      ns.prompt = match.prompt || ns.prompt;
    }
  });
  S.images[slug] = { styleOverride: S.images[slug]?.styleOverride || null, slots: newSlots };
  scheduleSave();
  renderImageQueue();
  updateImageProgress();
  aiBarNotify('Image slots reinitialised from copy (' + newSlots.length + ' slots).', { type: 'success' });
}

// ── KV Persistence (unchanged pipelines) ───────────────────────────────────

function imgKey(slug) { return encodeURIComponent(slug || '_root'); }

async function savePageImages(slug) {
  if (!S.projectId || !S.images?.[slug]) return;
  try {
    const payload = JSON.stringify(S.images[slug]);
    await fetch('/api/images/' + S.projectId + '/' + imgKey(slug), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });
  } catch(e) { console.warn('[IMG] savePageImages failed:', e); }
}

async function loadAllPageImages() {
  if (!S.projectId) return;
  try {
    const listRes = await fetch('/api/images/' + S.projectId);
    if (!listRes.ok) return;
    const { slugs } = await listRes.json();
    if (!slugs?.length) return;
    let anyLoaded = false;
    await Promise.all(slugs.map(async kvSlug => {
      const slug = kvSlug === '_root' ? '' : decodeURIComponent(kvSlug);
      try {
        const res = await fetch('/api/images/' + S.projectId + '/' + imgKey(slug));
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.slots) return;
        if (!S.images[slug]) {
          S.images[slug] = data;
          // Ensure new fields on loaded data
          data.slots.forEach(sl => mergeSlotDefaults(sl));
        } else {
          // Restore b64 into existing slots
          data.slots.forEach((sl, i) => {
            if (sl?.b64 && S.images[slug].slots[i]) {
              S.images[slug].slots[i].b64 = sl.b64;
              S.images[slug].slots[i].mimeType = sl.mimeType || 'image/png';
              S.images[slug].slots[i].status = 'done';
              // Also restore new fields if present
              if (sl.sizeKB) S.images[slug].slots[i].sizeKB = sl.sizeKB;
              if (sl.altText) S.images[slug].slots[i].altText = sl.altText;
              if (sl.approvalStatus) S.images[slug].slots[i].approvalStatus = sl.approvalStatus;
              if (sl.imageBrief) S.images[slug].slots[i].imageBrief = sl.imageBrief;
            }
          });
        }
        anyLoaded = true;
      } catch(e) { console.warn('[IMG] load failed for', slug, e); }
    }));
    if (anyLoaded) {
      renderImageQueue();
      updateImageProgress();
      if (S.stage === 'layout') renderLayoutQueue();
    }
  } catch(e) { console.warn('[IMG] loadAllPageImages failed:', e); }
}

// ── Prompt Building ────────────────────────────────────────────────────────

function buildImagePrompt(page, slotIdx, styleOverride, slot) {
  // Resolve slot — either passed directly or from S.images
  if (!slot && S.images[page.slug]) {
    slot = S.images[page.slug].slots[slotIdx];
  }
  // If still no slot, use legacy IMAGE_SLOTS def
  const legacyDef = IMAGE_SLOTS[slotIdx] || IMAGE_SLOTS[0];

  // Style cascade: slot custom → page override → global style
  const style = (styleOverride || '').trim() || getGlobalImageStyle();

  // Visual type directive
  const vType = slot?.visualType || 'photography';
  const directive = TYPE_DIRECTIVES[vType] || TYPE_DIRECTIVES.photography;

  // Content context
  const context = slot?.contentContext || legacyDef?.hint || '';

  // Business context
  const client = S.setup?.client || '';
  const geo = (S.research?.geography?.primary || S.setup?.geo || '').replace(/,.*$/, '').trim();
  const industry = (S.research?.primary_services || []).slice(0, 2).join(', ') || page.keyword_cluster || '';
  const pageDesc = page.page_type === 'blog'
    ? `blog post titled "${page.page_name}" about ${page.primary_keyword || page.page_name}`
    : `${page.page_type} page for "${page.page_name}" (${page.primary_keyword || page.page_name})`;

  // Persona + emotional
  const persona = getPersonaForPage(page);
  const emotional = slot?.emotionalTarget || getPageEmotionalTarget(page);

  // Competitor voice avoidance
  let avoidance = '';
  if (persona?.executionProfile?.competitorVoice) {
    avoidance = ' Avoid imagery that feels like: ' + String(persona.executionProfile.competitorVoice).substring(0, 80) + '.';
  }

  // Aspect ratio
  const ratio = slot?.ratio || legacyDef?.ratio || '4:3';
  const slotLabel = slot?.label || legacyDef?.label || 'Image';

  let prompt = style + '\n\n';
  prompt += directive + '\n\n';
  prompt += `Create a ${slotLabel.toLowerCase()} image (${ratio}) for a ${pageDesc}.`;
  if (context) prompt += ` Context: ${context.substring(0, 200)}.`;
  if (client) prompt += ` Business: ${client}.`;
  if (geo) prompt += ` Location: ${geo}.`;
  if (industry) prompt += ` Industry: ${industry}.`;
  if (persona) prompt += ` Target persona: ${persona.name}.`;
  if (emotional) prompt += ` Emotional tone: ${emotional.substring(0, 100)}.`;
  if (avoidance) prompt += avoidance;

  return prompt;
}

// ── Alt Text ───────────────────────────────────────────────────────────────

function buildAltText(prompt, slot, page) {
  if (slot && slot.contentContext) {
    const prefix = {
      photography: 'Photo of',
      photography_people: 'Photo of',
      illustration: 'Illustration of',
      diagram: 'Diagram showing',
      data_viz: 'Chart showing',
      social_proof: 'Client testimonial',
      icon: 'Icon representing',
      before_after: 'Before and after',
      screenshot: 'Screenshot of',
    };
    const parts = [prefix[slot.visualType] || 'Image of'];
    parts.push(slot.contentContext.substring(0, 80).replace(/["\n]/g, ''));
    const geo = S.research?.geography?.primary;
    if (geo && page && ['service', 'industry', 'location'].indexOf(page.page_type) >= 0) {
      parts.push('in ' + geo);
    }
    return parts.join(' ').substring(0, 125);
  }
  // Fallback
  if (!prompt) return '';
  return prompt
    .replace(/professional|commercial|photography|style|clean|modern|well-lit|neutral|white background|no text|no watermark|business-appropriate/gi, '')
    .replace(/\s+/g, ' ').trim().substring(0, 97) + '...';
}

function saveAltText(slug, slotIdx, val) {
  if (!S.images[slug]?.slots[slotIdx]) return;
  S.images[slug].slots[slotIdx].altText = val.slice(0, 125);
  scheduleSave();
}

// ── WebP Compression (unchanged) ───────────────────────────────────────────

async function compressToWebP(b64, srcMime, targetKB) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      if (!img.naturalWidth || !img.naturalHeight) { reject(new Error('Image has zero dimensions')); return; }
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      let quality = 0.88;
      let dataUrl = canvas.toDataURL('image/webp', quality);
      for (let i = 0; i < 8; i++) {
        const kb = Math.round((dataUrl.length - 22) * 3 / 4 / 1024);
        if (kb <= targetKB || quality <= 0.1) break;
        quality = Math.max(0.1, quality - 0.1);
        dataUrl = canvas.toDataURL('image/webp', quality);
      }
      const finalB64 = dataUrl.split(',')[1];
      if (!finalB64 || finalB64.length < 100) { reject(new Error('Canvas produced empty output')); return; }
      const finalKB = Math.round(finalB64.length * 3 / 4 / 1024);
      resolve({ b64: finalB64, sizeKB: finalKB });
    };
    img.onerror = reject;
    img.src = 'data:' + srcMime + ';base64,' + b64;
  });
}

// ── Upload Handler ─────────────────────────────────────────────────────────

function uploadSlotImage(slug, slotIdx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(ev) {
      const b64 = ev.target.result.split(',')[1];
      try {
        const compressed = await compressToWebP(b64, file.type, 200);
        const slot = S.images[slug].slots[slotIdx];
        slot.b64 = compressed.b64;
        slot.sizeKB = compressed.sizeKB;
        slot.mimeType = 'image/webp';
        slot.status = 'done';
        slot.approvalStatus = 'pending';
        if (!slot.altText) slot.altText = buildAltText(slot.prompt, slot, (S.pages || []).find(p => p.slug === slug));
        await savePageImages(slug);
        renderImageQueue();
        updateImageProgress();
      } catch(err) {
        aiBarNotify('Upload compression failed: ' + (err.message || 'unknown error'), { type: 'error' });
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ── Image Brief Generator ──────────────────────────────────────────────────

function generateImageBrief(slug, slotIdx) {
  const slot = S.images[slug]?.slots[slotIdx];
  if (!slot) return;
  const page = (S.pages || []).find(p => p.slug === slug);
  const persona = getPersonaForPage(page);

  const descs = {
    social_proof: 'Portrait/environmental photo of client/customer. Warm, trustworthy, real person.',
    before_after: 'Pair of photos showing same space before and after. Match angles. Before honest, after highlights transformation.',
    photography_people: 'Environmental portrait in natural work setting. Authentic expression.',
    screenshot: 'Capture from live tool/dashboard. Annotate key areas.',
  };

  slot.imageBrief = {
    type: slot.visualType,
    purpose: slot.label,
    forPage: (page?.page_name || slug),
    personaTarget: persona ? persona.name : 'General',
    emotionalTarget: slot.emotionalTarget || '',
    shotDescription: descs[slot.visualType] || 'Custom photo needed.',
    contentContext: slot.contentContext || '',
    aspectRatio: slot.ratio,
    status: 'awaiting_asset',
  };
  slot.status = 'brief_ready';
  slot.approvalStatus = 'pending';
  scheduleSave();
  renderImageQueue();
  updateImageProgress();
  aiBarNotify('Image brief created for "' + slot.label + '".', { type: 'success' });
}

// ── Approval Workflow ──────────────────────────────────────────────────────

function setSlotApproval(slug, slotIdx, status) {
  if (!S.images[slug]?.slots[slotIdx]) return;
  S.images[slug].slots[slotIdx].approvalStatus = status;
  if (status === 'replace') {
    S.images[slug].slots[slotIdx].sourceType = 'upload';
  }
  scheduleSave();
  savePageImages(slug);
  renderImageQueue();
  updateImageProgress();
}

// ── Source/Type Update ─────────────────────────────────────────────────────

function setSlotVisualType(slug, slotIdx, newType) {
  const slot = S.images[slug]?.slots[slotIdx];
  if (!slot) return;
  slot.visualType = newType;
  slot.sourceType = TYPE_SOURCE_MAP[newType] || 'ai_generate';
  // Rebuild prompt if AI
  if (slot.sourceType === 'ai_generate' || slot.sourceType === 'placeholder') {
    const page = (S.pages || []).find(p => p.slug === slug);
    if (page) slot.prompt = buildImagePrompt(page, slotIdx, S.images[slug]?.styleOverride || null, slot);
  }
  scheduleSave();
  renderImageQueue();
}

function setSlotSourceType(slug, slotIdx, newSource) {
  const slot = S.images[slug]?.slots[slotIdx];
  if (!slot) return;
  slot.sourceType = newSource;
  scheduleSave();
  renderImageQueue();
}

// ── Image Generation (with source routing) ─────────────────────────────────

async function generateImage(slug, slotIdx, customPrompt) {
  if (!S.images[slug]) return;
  const page = S.pages.find(p => p.slug === slug);
  if (!page) return;
  const slot = S.images[slug].slots[slotIdx];
  if (!slot) return;

  // Skip removed slots
  if (slot.approvalStatus === 'removed') return;

  // Route by source type
  const source = slot.sourceType || 'ai_generate';
  if (source === 'upload') {
    uploadSlotImage(slug, slotIdx);
    return;
  }
  if (source === 'brief_only') {
    generateImageBrief(slug, slotIdx);
    return;
  }

  // ai_generate and placeholder both go through Gemini
  const prompt = customPrompt || slot.prompt || buildImagePrompt(page, slotIdx, S.images[slug].styleOverride, slot);
  slot.prompt = prompt;
  slot.status = 'generating';
  slot.b64 = null;
  renderImageQueue();

  try {
    const res = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (data.imageData) {
      try {
        const compressed = await compressToWebP(data.imageData, data.mimeType || 'image/png', 100);
        slot.b64 = compressed.b64;
        slot.mimeType = 'image/webp';
        slot.sizeKB = compressed.sizeKB;
      } catch(_ce) {
        slot.b64 = data.imageData;
        slot.mimeType = data.mimeType || 'image/png';
      }
      slot.status = 'done';
      slot.errorMsg = null;
      if (!slot.altText) slot.altText = buildAltText(slot.prompt, slot, page);
      savePageImages(slug);
    } else {
      slot.status = 'error';
      slot.errorMsg = data.error || 'Unknown error';
      if (data.detail) slot.errorMsg += ' \u2014 ' + data.detail;
      console.error('[IMG] generation error:', data.error, data.detail);
    }
  } catch (err) {
    slot.status = 'error';
    slot.errorMsg = err.message || 'Fetch failed';
    console.error('[IMG] fetch error:', err);
  }

  scheduleSave();
  renderImageQueue();
  updateImageProgress();
  checkImageAllDone();
}

async function generateImageWithCustomPrompt(slug, slotIdx) {
  const textarea = document.getElementById(`prompt-text-${slug}-${slotIdx}`);
  const customPrompt = textarea?.value?.trim();
  if (!customPrompt) return;
  if (S.images[slug]?.slots[slotIdx]) {
    S.images[slug].slots[slotIdx].prompt = customPrompt;
  }
  await generateImage(slug, slotIdx, customPrompt);
}

// ── Bulk Generation ────────────────────────────────────────────────────────

async function generateAllImages(slug) {
  if (S.imageGenRunning) return;
  S.imageGenRunning = true;
  S.imageGenStop = false;
  document.getElementById('image-stop-btn').style.display = '';
  document.getElementById('image-progress').style.display = 'block';
  imageExpandedSlug = slug;
  renderImageQueue();

  const slots = S.images[slug]?.slots || [];
  for (let i = 0; i < slots.length; i++) {
    if (S.imageGenStop) break;
    const sl = slots[i];
    if (sl.approvalStatus === 'removed') continue;
    if (sl.status === 'done' && sl.approvalStatus === 'approved') continue;
    await generateImage(slug, i);
    await new Promise(r => setTimeout(r, 500));
  }

  S.imageGenRunning = false;
  document.getElementById('image-stop-btn').style.display = 'none';
  renderImageQueue();
  checkImageAllDone();
}

async function generateAllPagesImages() {
  if (S.imageGenRunning) return;
  S.imageGenRunning = true;
  S.imageGenStop = false;
  document.getElementById('image-stop-btn').style.display = '';
  document.getElementById('image-progress').style.display = 'block';

  const pages = S.pages || [];
  for (const page of pages) {
    if (S.imageGenStop) break;
    imageExpandedSlug = page.slug;
    const slots = S.images[page.slug]?.slots || [];
    for (let i = 0; i < slots.length; i++) {
      if (S.imageGenStop) break;
      const sl = slots[i];
      if (sl.approvalStatus === 'removed') continue;
      if (sl.status === 'done' && sl.approvalStatus === 'approved') continue;
      await generateImage(page.slug, i);
      await new Promise(r => setTimeout(r, 400));
    }
  }

  S.imageGenRunning = false;
  document.getElementById('image-stop-btn').style.display = 'none';
  checkImageAllDone();
}

function stopImageGen() {
  S.imageGenStop = true;
  S.imageGenRunning = false;
  document.getElementById('image-stop-btn').style.display = 'none';
}

// ── Style Panel ────────────────────────────────────────────────────────────

function toggleImageStylePanel() {
  const panel = document.getElementById('image-style-panel');
  const gEl = document.getElementById('image-style-global-edit');
  if (panel.style.display === 'none') {
    gEl.value = getGlobalImageStyle();
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function saveGlobalImageStyle() {
  const val = (document.getElementById('image-style-global-edit')?.value || '').trim();
  if (!S.setup) return;
  S.setup.imageStyle = val;
  document.getElementById('image-style-panel').style.display = 'none';
  scheduleSave();
  // Regenerate prompts for any empty AI slots
  (S.pages || []).forEach(p => {
    if (S.images[p.slug]) {
      const imgData = S.images[p.slug];
      imgData.slots.forEach((sl, i) => {
        if (sl.status === 'empty' && (sl.sourceType === 'ai_generate' || sl.sourceType === 'placeholder')) {
          sl.prompt = buildImagePrompt(p, i, imgData.styleOverride, sl);
        }
      });
    }
  });
  renderImageQueue();
}

function savePageImageStyle(slug) {
  const val = (document.getElementById(`img-style-override-${slug}`)?.value || '').trim();
  if (!S.images[slug]) return;
  S.images[slug].styleOverride = val || null;
  const page = S.pages.find(p => p.slug === slug);
  if (page) {
    S.images[slug].slots.forEach((sl, i) => {
      if (sl.status === 'empty' && (sl.sourceType === 'ai_generate' || sl.sourceType === 'placeholder')) {
        sl.prompt = buildImagePrompt(page, i, val || null, sl);
      }
    });
  }
  scheduleSave();
  renderImageQueue();
}

function clearPageImageStyle(slug) {
  if (!S.images[slug]) return;
  S.images[slug].styleOverride = null;
  scheduleSave();
  renderImageQueue();
}

// ── Slot Management ────────────────────────────────────────────────────────

function addImageSlot(slug) {
  if (!S.images[slug]) return;
  const page = S.pages.find(p => p.slug === slug) || {};
  const i = S.images[slug].slots.length;
  const slot = Object.assign({}, SLOT_DEFAULTS, {
    slotType: 'custom',
    label: 'Custom Image ' + (i + 1),
    ratio: '4:3',
    visualType: 'photography',
    sourceType: 'ai_generate',
    status: 'empty', prompt: '', b64: null, mimeType: null,
  });
  slot.prompt = buildImagePrompt(page, i, S.images[slug].styleOverride, slot);
  S.images[slug].slots.push(slot);
  scheduleSave();
  renderImageQueue();
}

function removeImageSlot(slug, slotIdx) {
  if (!S.images[slug]?.slots[slotIdx]) return;
  S.images[slug].slots[slotIdx].approvalStatus = 'removed';
  scheduleSave();
  renderImageQueue();
  updateImageProgress();
}

function restoreImageSlot(slug, slotIdx) {
  if (!S.images[slug]?.slots[slotIdx]) return;
  S.images[slug].slots[slotIdx].approvalStatus = 'pending';
  scheduleSave();
  renderImageQueue();
  updateImageProgress();
}

// ── Expand / Prompt Editor ─────────────────────────────────────────────────

let imageExpandedSlug = null;

function toggleImageExpand(slug) {
  imageExpandedSlug = imageExpandedSlug === slug ? null : slug;
  renderImageQueue();
}

function openPromptEditor(slug, slotIdx) {
  const editorEl = document.getElementById(`prompt-editor-${slug}-${slotIdx}`);
  if (!editorEl) return;
  editorEl.style.display = editorEl.style.display === 'none' ? 'block' : 'none';
}

function toggleCopyPreview(slug) {
  const body = document.getElementById(`img-copy-body-${slug}`);
  if (!body) return;
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

// ── Render ─────────────────────────────────────────────────────────────────

function _chipHtml(label, colour, textColour) {
  return `<span class="img-type-chip" style="background:${colour};color:${textColour || '#fff'}">${esc(label)}</span>`;
}

function _renderCopyPreview(page) {
  const sections = parseCopySections(page.slug);
  if (!sections) return '';
  const persona = getPersonaForPage(page);
  const journey = page.journeyStage || '';

  let html = `<div class="img-copy-preview">`;
  html += `<div class="img-copy-toggle" onclick="toggleCopyPreview('${page.slug}')">`;
  html += `<span>\u{1F4DD}</span> <span>Copy Context</span> <i class="ti ti-chevron-down" style="margin-left:auto;font-size:12px"></i>`;
  html += `</div>`;
  html += `<div class="img-copy-body" id="img-copy-body-${page.slug}">`;

  sections.forEach((sec, i) => {
    const vType = determineVisualType(sec.heading, sec.body);
    const chip = TYPE_CHIPS[vType] || TYPE_CHIPS.photography;
    const tagLabel = sec.tag === 'h1' ? 'H1' : sec.tag === 'h2' ? 'H2' : sec.tag === 'h3' ? 'H3' : 'Intro';
    html += `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid var(--n1)">`;
    html += `<span style="font-size:10px;font-weight:600;color:var(--n2);min-width:24px">${tagLabel}</span>`;
    html += `<span style="font-size:11px;color:var(--dark);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((sec.heading || 'Intro content').substring(0, 60))}</span>`;
    html += `<span style="font-size:12px">${chip.icon}</span>`;
    html += `<span style="font-size:10px;color:${chip.colour}">${esc(chip.label)}</span>`;
    html += `</div>`;
  });

  if (persona || journey) {
    html += `<div style="padding:4px 0;font-size:10px;color:var(--n2);margin-top:4px">`;
    if (persona) html += `Persona: ${esc(persona.name)}`;
    if (persona && journey) html += ' | ';
    if (journey) html += esc(journey.charAt(0).toUpperCase() + journey.slice(1));
    html += `</div>`;
  }

  html += `</div></div>`;
  return html;
}

function renderImageQueue() {
  const el = document.getElementById('image-queue');
  if (!el) return;
  const pages = (typeof orderedPages === 'function' ? orderedPages() : S.pages) || [];
  if (!pages.length) { el.innerHTML = '<p style="color:var(--n2);font-size:13px">No pages yet \u2014 complete Stage 3 first.</p>'; return; }

  const groups = [
    { label: 'Core Pages',           icon: 'ti-home',         types: ['home','about','contact','case-studies','utility'] },
    { label: 'Services',             icon: 'ti-tool',         types: ['service'] },
    { label: 'Industry & Location',  icon: 'ti-map-pin',      types: ['industry','location'] },
    { label: 'Blog Posts',           icon: 'ti-article',      types: ['blog'] },
    { label: 'Other',                icon: 'ti-file',         types: [] },
  ];
  const typeIconMap = { home:'ti-home', about:'ti-info-circle', service:'ti-tool', industry:'ti-building-factory', location:'ti-map-pin', blog:'ti-article', utility:'ti-settings-2' };

  let html = '';
  groups.forEach(group => {
    const gPages = group.types.length
      ? pages.filter(p => group.types.includes(p.page_type))
      : pages.filter(p => !['home','about','utility','service','industry','location','blog'].includes(p.page_type));
    if (!gPages.length) return;

    const doneCount = gPages.filter(p => {
      const imgData = S.images[p.slug];
      if (!imgData || !imgData.slots.length) return false;
      const active = imgData.slots.filter(s => s.approvalStatus !== 'removed');
      return active.length > 0 && active.every(s => s.status === 'done' || s.status === 'brief_ready');
    }).length;

    html += `<div style="margin-bottom:20px">`;
    html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:2px solid var(--n1);margin-bottom:8px">`;
    html += `<i class="ti ${group.icon}" style="color:var(--n2);font-size:14px"></i>`;
    html += `<span style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--n2)">${group.label}</span>`;
    html += `<span style="font-size:11px;color:var(--n2);margin-left:auto">${doneCount}/${gPages.length}</span>`;
    html += `</div>`;

    gPages.forEach(p => {
      const imgData = S.images[p.slug] || { slots: [], styleOverride: null };
      const activeSlots = (imgData.slots || []).filter(s => s.approvalStatus !== 'removed');
      const doneSlots = activeSlots.filter(s => s.status === 'done' || s.status === 'brief_ready').length;
      const approvedSlots = activeSlots.filter(s => s.approvalStatus === 'approved').length;
      const totalSlots = activeSlots.length;
      const allDone = totalSlots > 0 && doneSlots === totalSlots;
      const allApproved = totalSlots > 0 && approvedSlots === totalSlots;
      const isExpanded = imageExpandedSlug === p.slug;
      const tIcon = typeIconMap[p.page_type] || 'ti-file';
      const pBadgeColor = p.priority === 'P1' ? 'var(--dark)' : p.priority === 'P2' ? 'var(--n2)' : '#bbb';

      html += `<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:6px;overflow:hidden${allApproved ? ';border-color:var(--green)' : allDone ? ';border-color:var(--lime)' : ''}">`;
      // Row header
      html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;background:var(--white)" onclick="toggleImageExpand('${p.slug}')">`;
      html += `<i class="ti ${tIcon}" style="color:var(--n2);font-size:13px;flex-shrink:0"></i>`;
      html += `<div style="flex:1;min-width:0">`;
      html += `<div style="font-size:13px;font-weight:500;color:var(--dark)">${esc(p.page_name)}</div>`;
      html += `<div style="font-size:11px;color:var(--n2);margin-top:1px">/${esc(p.slug)} \u00B7 ${totalSlots} slots</div>`;
      html += `</div>`;

      // READY badge
      if (allApproved) {
        html += `<span style="font-size:10px;font-weight:600;color:var(--green);background:#E8F5E9;padding:2px 8px;border-radius:10px">READY</span>`;
      }

      // Slot mini-dots colour-coded by approval
      html += `<div style="display:flex;gap:3px;align-items:center">`;
      (imgData.slots || []).forEach(sl => {
        let dot = 'var(--n1)';
        if (sl.approvalStatus === 'removed') dot = 'transparent';
        else if (sl.approvalStatus === 'approved') dot = 'var(--green)';
        else if (sl.approvalStatus === 'redo') dot = '#E53935';
        else if (sl.status === 'done' || sl.status === 'brief_ready') dot = 'var(--lime)';
        else if (sl.status === 'generating') dot = '#FFB300';
        else if (sl.status === 'error') dot = '#E53935';
        html += `<div style="width:8px;height:8px;border-radius:2px;background:${dot}${sl.approvalStatus === 'removed' ? ';border:1px solid var(--n1)' : ''}"></div>`;
      });
      html += `</div>`;

      html += `<span style="font-size:10px;font-weight:600;background:${p.priority==='P1'?'var(--dark)':'var(--n1)'};color:${p.priority==='P1'?'white':'var(--n2)'};padding:2px 6px;border-radius:10px;flex-shrink:0">${p.priority}</span>`;
      html += `<button class="btn btn-ghost sm" style="flex-shrink:0" onclick="event.stopPropagation();generateAllImages('${p.slug}')"><i class="ti ti-player-play"></i> Generate</button>`;
      html += `<i class="ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}" style="color:var(--n2);font-size:13px;flex-shrink:0"></i>`;
      html += `</div>`;

      // Expanded panel
      if (isExpanded) {
        html += `<div style="padding:12px 14px 14px;border-top:1px solid var(--border);background:var(--white)">`;

        // Copy preview panel
        html += _renderCopyPreview(p);

        // Per-page style override
        html += `<div style="margin-bottom:12px">`;
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">`;
        html += `<span style="font-size:11px;font-weight:500;color:var(--dark)">Page Style Override</span>`;
        if (imgData.styleOverride) html += `<span style="font-size:10px;background:var(--lime);color:var(--dark);padding:1px 6px;border-radius:10px">active</span>`;
        html += `<button class="img-reinit-btn" onclick="event.stopPropagation();reinitFromCopy('${p.slug}')" style="margin-left:auto"><i class="ti ti-refresh" style="font-size:10px"></i> Reinitialise from Copy</button>`;
        html += `</div>`;
        html += `<div style="display:flex;gap:6px;align-items:flex-start">`;
        html += `<textarea id="img-style-override-${p.slug}" rows="2" style="flex:1;font-size:12px;padding:6px 9px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--dark);font-family:var(--font);outline:none;resize:vertical;line-height:1.5" placeholder="Leave blank to use global style. Describe specific photography/art direction for this page only...">${esc(imgData.styleOverride || '')}</textarea>`;
        html += `<div style="display:flex;flex-direction:column;gap:4px">`;
        html += `<button class="btn btn-ghost sm" onclick="savePageImageStyle('${p.slug}')"><i class="ti ti-check"></i> Save</button>`;
        if (imgData.styleOverride) html += `<button class="btn btn-ghost sm" onclick="clearPageImageStyle('${p.slug}')"><i class="ti ti-x"></i> Clear</button>`;
        html += `</div></div></div>`;

        // Slot grid
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">`;
        const allSlots = imgData.slots || [];
        allSlots.forEach((sl, i) => {
          const isRemoved = sl.approvalStatus === 'removed';
          const typeChip = TYPE_CHIPS[sl.visualType] || TYPE_CHIPS.photography;
          const srcChip = SOURCE_CHIPS[sl.sourceType] || SOURCE_CHIPS.ai_generate;

          html += `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--panel)${isRemoved ? ';opacity:0.35' : ''}">`;

          // Image area
          if (sl.status === 'done' && sl.b64) {
            const _szTag = sl.sizeKB ? `<div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.55);color:#fff;font-size:9px;border-radius:3px;padding:1px 5px">${sl.sizeKB}KB WebP</div>` : '';
            html += `<div style="aspect-ratio:1;overflow:hidden;background:#f0f0f0;position:relative"><img src="data:${sl.mimeType||'image/png'};base64,${sl.b64}" style="width:100%;height:100%;object-fit:cover">${_szTag}</div>`;
          } else if (sl.status === 'generating') {
            html += `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--panel)"><span class="spinner" style="width:20px;height:20px"></span></div>`;
          } else if (sl.status === 'error') {
            const errMsg = sl.errorMsg ? esc(sl.errorMsg.slice(0, 80)) : 'Unknown error';
            html += `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#fff0f0;flex-direction:column;gap:4px;padding:6px"><i class="ti ti-alert-circle" style="color:#E53935;font-size:18px"></i><span style="font-size:9px;color:#E53935;text-align:center;line-height:1.3">${errMsg}</span></div>`;
          } else if (sl.status === 'brief_ready' && sl.imageBrief) {
            html += `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#FFF8E1;flex-direction:column;gap:4px;padding:8px">`;
            html += `<i class="ti ti-file-description" style="color:#FB8C00;font-size:22px"></i>`;
            html += `<span style="font-size:10px;color:#FB8C00;font-weight:600">Brief Ready</span>`;
            html += `<span style="font-size:9px;color:var(--n2);text-align:center;line-height:1.3">${esc((sl.imageBrief.shotDescription || '').substring(0, 60))}</span>`;
            html += `</div>`;
          } else {
            html += `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--panel);flex-direction:column;gap:4px">`;
            html += `<span style="font-size:18px">${typeChip.icon}</span>`;
            html += `<span style="font-size:10px;color:var(--n2)">${esc(sl.ratio || '4:3')}</span>`;
            html += `</div>`;
          }

          // Slot footer
          html += `<div style="padding:7px 8px">`;
          // Label + chips
          html += `<div style="font-size:10px;font-weight:600;color:var(--dark);margin-bottom:3px">${esc(sl.label || 'Image ' + (i+1))}</div>`;
          html += `<div style="margin-bottom:3px">`;
          html += _chipHtml(typeChip.label, typeChip.colour);
          html += _chipHtml(srcChip.label, srcChip.colour);
          html += `</div>`;

          // Content context (truncated)
          if (sl.contentContext) {
            html += `<div class="img-slot-context">${esc(sl.contentContext.substring(0, 80))}</div>`;
          }

          // Type/source dropdowns
          if (!isRemoved) {
            html += `<div style="display:flex;gap:4px;margin-top:5px">`;
            html += `<select style="font-size:9px;padding:2px 4px;border:1px solid var(--border);border-radius:3px;background:var(--white);font-family:var(--font);flex:1" onchange="setSlotVisualType('${p.slug}',${i},this.value)">`;
            Object.keys(TYPE_CHIPS).forEach(vt => {
              html += `<option value="${vt}"${sl.visualType === vt ? ' selected' : ''}>${TYPE_CHIPS[vt].icon} ${TYPE_CHIPS[vt].label}</option>`;
            });
            html += `</select>`;
            html += `<select style="font-size:9px;padding:2px 4px;border:1px solid var(--border);border-radius:3px;background:var(--white);font-family:var(--font);flex:1" onchange="setSlotSourceType('${p.slug}',${i},this.value)">`;
            Object.keys(SOURCE_CHIPS).forEach(st => {
              html += `<option value="${st}"${sl.sourceType === st ? ' selected' : ''}>${SOURCE_CHIPS[st].label}</option>`;
            });
            html += `</select>`;
            html += `</div>`;
          }

          // Action buttons
          html += `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px">`;
          if (!isRemoved && sl.status !== 'generating') {
            if (sl.sourceType === 'upload') {
              html += `<button class="btn btn-ghost sm" style="font-size:10px;padding:3px 7px" onclick="uploadSlotImage('${p.slug}',${i})"><i class="ti ti-upload" style="font-size:10px"></i> Upload</button>`;
            } else if (sl.sourceType === 'brief_only') {
              html += `<button class="btn btn-ghost sm" style="font-size:10px;padding:3px 7px" onclick="generateImageBrief('${p.slug}',${i})"><i class="ti ti-file-description" style="font-size:10px"></i> ${sl.status === 'brief_ready' ? 'Redo Brief' : 'Create Brief'}</button>`;
            } else {
              html += `<button class="btn btn-ghost sm" style="font-size:10px;padding:3px 7px" onclick="generateImage('${p.slug}',${i})"><i class="ti ti-refresh" style="font-size:10px"></i> ${sl.status === 'done' ? 'Redo' : 'Generate'}</button>`;
            }
            html += `<button class="btn btn-ghost sm" style="font-size:10px;padding:3px 7px" onclick="openPromptEditor('${p.slug}',${i})"><i class="ti ti-edit" style="font-size:10px"></i> Prompt</button>`;
          }
          if (isRemoved) {
            html += `<button class="btn btn-ghost sm" style="font-size:10px;padding:3px 7px" onclick="restoreImageSlot('${p.slug}',${i})"><i class="ti ti-arrow-back" style="font-size:10px"></i> Restore</button>`;
          } else {
            html += `<button class="btn btn-ghost sm" style="font-size:10px;padding:3px 7px;color:var(--n2)" onclick="removeImageSlot('${p.slug}',${i})"><i class="ti ti-x" style="font-size:10px"></i></button>`;
          }
          html += `</div>`;

          // Approval buttons for done/brief_ready slots
          if (!isRemoved && (sl.status === 'done' || sl.status === 'brief_ready')) {
            html += `<div class="img-approval">`;
            html += `<button title="Approve" style="font-size:12px" class="${sl.approvalStatus === 'approved' ? 'active' : ''}" onclick="setSlotApproval('${p.slug}',${i},'approved')">\u2713</button>`;
            html += `<button title="Redo" style="font-size:12px" class="${sl.approvalStatus === 'redo' ? 'active' : ''}" onclick="setSlotApproval('${p.slug}',${i},'redo')">\u21BB</button>`;
            html += `<button title="Replace with upload" style="font-size:12px" class="${sl.approvalStatus === 'replace' ? 'active' : ''}" onclick="setSlotApproval('${p.slug}',${i},'replace')">\u{1F4E4}</button>`;
            html += `</div>`;
          }

          // Image brief display
          if (sl.imageBrief && sl.status === 'brief_ready') {
            html += `<div class="img-brief">`;
            html += `<div class="img-brief-label">Image Brief</div>`;
            html += `<div style="font-size:10px"><b>Type:</b> ${esc(sl.imageBrief.type || '')}</div>`;
            html += `<div style="font-size:10px"><b>Shot:</b> ${esc((sl.imageBrief.shotDescription || '').substring(0, 120))}</div>`;
            html += `<div style="font-size:10px"><b>Persona:</b> ${esc(sl.imageBrief.personaTarget || '')} | <b>Ratio:</b> ${esc(sl.imageBrief.aspectRatio || '')}</div>`;
            if (sl.imageBrief.contentContext) html += `<div style="font-size:10px"><b>Context:</b> ${esc(sl.imageBrief.contentContext.substring(0, 100))}</div>`;
            html += `</div>`;
          }

          // Prompt editor (inline)
          html += `<div id="prompt-editor-${p.slug}-${i}" style="display:none;margin-top:6px">`;
          html += `<textarea id="prompt-text-${p.slug}-${i}" rows="4" style="width:100%;font-size:10px;padding:5px 7px;border-radius:5px;border:1px solid var(--border);background:var(--white);color:var(--dark);font-family:var(--font);outline:none;resize:vertical;line-height:1.4">${esc(sl.prompt || '')}</textarea>`;
          html += `<div style="display:flex;gap:4px;margin-top:4px">`;
          html += `<button class="btn btn-primary sm" style="font-size:10px;padding:3px 8px" onclick="generateImageWithCustomPrompt('${p.slug}',${i})"><i class="ti ti-player-play" style="font-size:10px"></i> Generate</button>`;
          html += `<button class="btn btn-ghost sm" style="font-size:10px;padding:3px 7px" onclick="document.getElementById('prompt-editor-${p.slug}-${i}').style.display='none'">Cancel</button>`;
          html += `</div></div>`;

          // Alt text
          if (sl.status === 'done') {
            const altVal = esc(sl.altText || '');
            const altLen = (sl.altText || '').length;
            const altColor = altLen > 100 ? '#E53935' : altLen > 80 ? 'var(--warn)' : 'var(--n2)';
            html += `<div style="margin-top:5px"><div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="font-size:9px;color:var(--n2);text-transform:uppercase;letter-spacing:.04em">Alt Text</span><span style="font-size:9px;color:${altColor}">${altLen}/100</span></div>`;
            html += `<input id="alt-${p.slug}-${i}" value="${altVal}" maxlength="125" placeholder="Describe image for accessibility" style="width:100%;font-size:10px;padding:4px 6px;border-radius:4px;border:1px solid var(--border);background:var(--white);color:var(--dark);font-family:var(--font);outline:none;box-sizing:border-box" oninput="saveAltText('${p.slug}',${i},this.value)" /></div>`;
          }
          html += `</div></div>`;
        });
        html += `</div>`;
        html += `<div style="margin-top:8px"><button class="btn btn-ghost sm" onclick="addImageSlot('${p.slug}')"><i class="ti ti-plus"></i> Add Image Slot</button></div>`;
        html += `</div>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  });
  el.innerHTML = html;
}

// ── Progress ───────────────────────────────────────────────────────────────

function updateImageProgress() {
  const pages = S.pages || [];
  let total = 0;
  let done = 0;
  let approved = 0;
  let needUpload = 0;
  let redo = 0;

  pages.forEach(p => {
    const slots = S.images[p.slug]?.slots || [];
    slots.forEach(sl => {
      if (sl.approvalStatus === 'removed') return;
      total++;
      if (sl.status === 'done' || sl.status === 'brief_ready') done++;
      if (sl.approvalStatus === 'approved') approved++;
      if (sl.approvalStatus === 'redo') redo++;
      if (sl.sourceType === 'upload' && sl.status !== 'done') needUpload++;
    });
  });

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const countEl = document.getElementById('image-count-label');
  const pctEl = document.getElementById('image-pct-label');
  const fill = document.getElementById('image-progress-fill');
  if (countEl) {
    let label = `${done} of ${total} images`;
    if (approved > 0) label += ` \u00B7 ${approved} approved`;
    if (redo > 0) label += ` \u00B7 ${redo} redo`;
    if (needUpload > 0) label += ` \u00B7 ${needUpload} need upload`;
    countEl.textContent = label;
  }
  if (pctEl) pctEl.textContent = ` ${pct}%`;
  if (fill) fill.style.width = pct + '%';
  const prog = document.getElementById('image-progress');
  if (prog) prog.style.display = total > 0 && done > 0 ? 'block' : 'none';
}

function checkImageAllDone() {
  const pages = S.pages || [];
  const allDone = pages.length > 0 && pages.every(p => {
    const slots = (S.images[p.slug]?.slots || []).filter(s => s.approvalStatus !== 'removed');
    return slots.length > 0 && slots.every(s => s.status === 'done' || s.status === 'brief_ready');
  });
  const el = document.getElementById('image-all-done');
  if (el) el.style.display = allDone ? 'flex' : 'none';
}

// ── LAYOUT WIREFRAME GENERATOR ──────────────────────────────────────────────
let layoutCurrentPage = null;
