
function getGlobalImageStyle() {
  return (S.setup?.imageStyle || '').trim() || DEFAULT_IMAGE_STYLE;
}

function initImageStage() {
  // Initialise slot state for all content pages (exclude only explicit utility/structural with no keyword)
  (S.pages || []).forEach(p => {
    if (!S.images[p.slug]) {
      S.images[p.slug] = { styleOverride: null, slots: IMAGE_SLOTS.map((sl, i) => ({
        status: 'empty', prompt: buildImagePrompt(p, i, null), b64: null, mimeType: null
      }))};
    } else {
      // Seed defaults if no slots yet (no hard cap)
      const existing = S.images[p.slug];
      if (!existing.slots || existing.slots.length === 0) {
        existing.slots = IMAGE_SLOTS.map((_, i) => ({ status: 'empty', prompt: buildImagePrompt(p, i, existing.styleOverride), b64: null, mimeType: null }));
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
        if (!S.images[slug]) S.images[slug] = data;
        else {
          // Restore b64 into existing slots
          data.slots.forEach((sl, i) => {
            if (sl?.b64 && S.images[slug].slots[i]) {
              S.images[slug].slots[i].b64 = sl.b64;
              S.images[slug].slots[i].mimeType = sl.mimeType || 'image/png';
              S.images[slug].slots[i].status = 'done';
            }
          });
        }
        anyLoaded = true;
      } catch(e) { console.warn('[IMG] load failed for', slug, e); }
    }));
    if (anyLoaded) {
      renderImageQueue();
      updateImageProgress();
      if (S.stage === 'layout') renderLayoutQueue(); // refresh Reinject button visibility
    }
  } catch(e) { console.warn('[IMG] loadAllPageImages failed:', e); }
}


function buildImagePrompt(page, slotIdx, styleOverride) {
  const style = (styleOverride || '').trim() || getGlobalImageStyle();
  const slot = IMAGE_SLOTS[slotIdx] || IMAGE_SLOTS[0];
  const client = S.setup?.client || '';
  const geo = (S.research?.geography?.primary || S.setup?.geo || '').replace(/,.*$/, '').trim();
  const industry = (S.research?.primary_services || []).slice(0,2).join(', ') || page.keyword_cluster || '';
  const pageDesc = page.page_type === 'blog'
    ? `blog post titled "${page.page_name}" about ${page.primary_keyword || page.page_name}`
    : `${page.page_type} page for "${page.page_name}" (${page.primary_keyword || page.page_name})`;

  let prompt = `${style}\n\n`;
  prompt += `Create a ${slot.label.toLowerCase()} image (${slot.ratio}) for a ${pageDesc}.`;
  if (client) prompt += ` Business: ${client}.`;
  if (geo) prompt += ` Location: ${geo}.`;
  if (industry) prompt += ` Industry: ${industry}.`;
  prompt += ` Style note: ${slot.hint}.`;
  return prompt;
}

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
  // Regenerate prompts for any empty slots
  (S.pages || []).forEach(p => {
    if (S.images[p.slug]) {
      const imgData = S.images[p.slug];
      imgData.slots.forEach((sl, i) => {
        if (sl.status === 'empty') sl.prompt = buildImagePrompt(p, i, imgData.styleOverride);
      });
    }
  });
  renderImageQueue();
}

let imageExpandedSlug = null;

function renderImageQueue() {
  const el = document.getElementById('image-queue');
  if (!el) return;
  const pages = (typeof orderedPages === 'function' ? orderedPages() : S.pages) || [];
  if (!pages.length) { el.innerHTML = '<p style="color:var(--n2);font-size:13px">No pages yet — complete Stage 3 first.</p>'; return; }

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
      return imgData && imgData.slots.length > 0 && imgData.slots.every(s => s.status === 'done');
    }).length;

    html += `<div style="margin-bottom:20px">`;
    html += `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:2px solid var(--n1);margin-bottom:8px">`;
    html += `<i class="ti ${group.icon}" style="color:var(--n2);font-size:14px"></i>`;
    html += `<span style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--n2)">${group.label}</span>`;
    html += `<span style="font-size:11px;color:var(--n2);margin-left:auto">${doneCount}/${gPages.length}</span>`;
    html += `</div>`;

    gPages.forEach(p => {
      const imgData = S.images[p.slug] || { slots: [], styleOverride: null };
      const doneSlots = (imgData.slots || []).filter(s => s.status === 'done').length;
      const totalSlots = (imgData.slots || []).length;
      const allDone = totalSlots > 0 && doneSlots === totalSlots;
      const isExpanded = imageExpandedSlug === p.slug;
      const tIcon = typeIconMap[p.page_type] || 'ti-file';
      const pBadgeColor = p.priority === 'P1' ? 'var(--dark)' : p.priority === 'P2' ? 'var(--n2)' : '#bbb';

      html += `<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:6px;overflow:hidden${allDone ? ';border-color:var(--green)' : ''}">`;
      // Row header
      html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;background:var(--white)" onclick="toggleImageExpand('${p.slug}')">`;
      html += `<i class="ti ${tIcon}" style="color:var(--n2);font-size:13px;flex-shrink:0"></i>`;
      html += `<div style="flex:1;min-width:0">`;
      html += `<div style="font-size:13px;font-weight:500;color:var(--dark)">${esc(p.page_name)}</div>`;
      html += `<div style="font-size:11px;color:var(--n2);margin-top:1px">/${esc(p.slug)}</div>`;
      html += `</div>`;
      // Slot mini-previews
      html += `<div style="display:flex;gap:3px;align-items:center">`;
      for (let i = 0; i < 5; i++) {
        const sl = (imgData.slots || [])[i] || { status: 'empty' };
        const dot = sl.status === 'done' ? 'var(--green)' : sl.status === 'generating' ? 'var(--lime)' : sl.status === 'error' ? '#E53935' : 'var(--n1)';
        html += `<div style="width:8px;height:8px;border-radius:2px;background:${dot}"></div>`;
      }
      html += `</div>`;
      html += `<span style="font-size:10px;font-weight:600;color:${pBadgeColor};background:${p.priority==='P1'?'var(--dark)':p.priority==='P2'?'var(--n1)':'var(--n1)'};color:${p.priority==='P1'?'white':'var(--n2)'};padding:2px 6px;border-radius:10px;flex-shrink:0">${p.priority}</span>`;
      html += `<button class="btn btn-ghost sm" style="flex-shrink:0" onclick="event.stopPropagation();generateAllImages('${p.slug}')"><i class="ti ti-player-play"></i> Generate All</button>`;
      html += `<i class="ti ${isExpanded ? 'ti-chevron-up' : 'ti-chevron-down'}" style="color:var(--n2);font-size:13px;flex-shrink:0"></i>`;
      html += `</div>`;

      // Expanded panel
      if (isExpanded) {
        html += `<div style="padding:12px 14px 14px;border-top:1px solid var(--border);background:var(--white)">`;
        // Per-page style override
        html += `<div style="margin-bottom:12px">`;
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">`;
        html += `<span style="font-size:11px;font-weight:500;color:var(--dark)">Page Style Override</span>`;
        if (imgData.styleOverride) html += `<span style="font-size:10px;background:var(--lime);color:var(--dark);padding:1px 6px;border-radius:10px">active</span>`;
        html += `</div>`;
        html += `<div style="display:flex;gap:6px;align-items:flex-start">`;
        html += `<textarea id="img-style-override-${p.slug}" rows="2" style="flex:1;font-size:12px;padding:6px 9px;border-radius:6px;border:1px solid var(--border);background:var(--panel);color:var(--dark);font-family:var(--font);outline:none;resize:vertical;line-height:1.5" placeholder="Leave blank to use global style. Describe specific photography/art direction for this page only...">${esc(imgData.styleOverride || '')}</textarea>`;
        html += `<div style="display:flex;flex-direction:column;gap:4px">`;
        html += `<button class="btn btn-ghost sm" onclick="savePageImageStyle('${p.slug}')"><i class="ti ti-check"></i> Save</button>`;
        if (imgData.styleOverride) html += `<button class="btn btn-ghost sm" onclick="clearPageImageStyle('${p.slug}')"><i class="ti ti-x"></i> Clear</button>`;
        html += `</div></div></div>`;

        // 5 image slots
        html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">`;
        const allSlots = imgData.slots || [];
        allSlots.forEach((sl, i) => {
          const slotDef = IMAGE_SLOTS[i] || { label: 'Image ' + (i+1), ratio: 'Custom', hint: '' };
          html += `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--panel)">`;
          // Image area
          if (sl.status === 'done' && sl.b64) {
            const _szTag = sl.sizeKB ? `<div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.55);color:#fff;font-size:9px;border-radius:3px;padding:1px 5px">${sl.sizeKB}KB WebP</div>` : '';
            html += `<div style="aspect-ratio:1;overflow:hidden;background:#f0f0f0;position:relative"><img src="data:${sl.mimeType||'image/png'};base64,${sl.b64}" style="width:100%;height:100%;object-fit:cover">${_szTag}</div>`;
          } else if (sl.status === 'generating') {
            html += `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--panel)"><span class="spinner" style="width:20px;height:20px"></span></div>`;
          } else if (sl.status === 'error') {
            const errMsg = sl.errorMsg ? esc(sl.errorMsg.slice(0, 80)) : 'Unknown error';
            html += `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#fff0f0;flex-direction:column;gap:4px;padding:6px"><i class="ti ti-alert-circle" style="color:#E53935;font-size:18px"></i><span style="font-size:9px;color:#E53935;text-align:center;line-height:1.3">${errMsg}</span></div>`;
          } else {
            html += `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--panel);flex-direction:column;gap:4px"><i class="ti ti-photo" style="color:var(--n2);font-size:24px"></i><span style="font-size:10px;color:var(--n2)">${slotDef.ratio}</span></div>`;
          }
          // Slot footer
          html += `<div style="padding:7px 8px">`;
          html += `<div style="font-size:10px;font-weight:600;color:var(--dark);margin-bottom:4px">${esc(slotDef.label)}</div>`;
          html += `<div style="display:flex;gap:4px;flex-wrap:wrap">`;
          if (sl.status !== 'generating') {
            html += `<button class="btn btn-ghost sm" style="font-size:10px;padding:3px 7px" onclick="generateImage('${p.slug}',${i})"><i class="ti ti-refresh" style="font-size:10px"></i> ${sl.status === 'done' ? 'Redo' : 'Generate'}</button>`;
          }
          if (sl.status !== 'generating') {
            html += `<button class="btn btn-ghost sm" style="font-size:10px;padding:3px 7px" onclick="openPromptEditor('${p.slug}',${i})"><i class="ti ti-edit" style="font-size:10px"></i> Prompt</button>`;
          }
          html += `</div>`;
          // Prompt editor (inline)
          html += `<div id="prompt-editor-${p.slug}-${i}" style="display:none;margin-top:6px">`;
          html += `<textarea id="prompt-text-${p.slug}-${i}" rows="4" style="width:100%;font-size:10px;padding:5px 7px;border-radius:5px;border:1px solid var(--border);background:var(--white);color:var(--dark);font-family:var(--font);outline:none;resize:vertical;line-height:1.4">${esc(sl.prompt || '')}</textarea>`;
          html += `<div style="display:flex;gap:4px;margin-top:4px">`;
          html += `<button class="btn btn-primary sm" style="font-size:10px;padding:3px 8px" onclick="generateImageWithCustomPrompt('${p.slug}',${i})"><i class="ti ti-player-play" style="font-size:10px"></i> Generate</button>`;
          html += `<button class="btn btn-ghost sm" style="font-size:10px;padding:3px 7px" onclick="document.getElementById('prompt-editor-${p.slug}-${i}').style.display='none'">Cancel</button>`;
          html += `</div></div>`;
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

function addImageSlot(slug) {
  if (!S.images[slug]) return;
  const page = S.pages.find(p => p.slug === slug) || {};
  const i = S.images[slug].slots.length;
  S.images[slug].slots.push({ status: 'empty', prompt: buildImagePrompt(page, i, S.images[slug].styleOverride), b64: null, mimeType: null });
  scheduleSave();
  renderImageQueue();
}

function toggleImageExpand(slug) {
  imageExpandedSlug = imageExpandedSlug === slug ? null : slug;
  renderImageQueue();
}

function openPromptEditor(slug, slotIdx) {
  const editorEl = document.getElementById(`prompt-editor-${slug}-${slotIdx}`);
  if (!editorEl) return;
  editorEl.style.display = editorEl.style.display === 'none' ? 'block' : 'none';
}

function savePageImageStyle(slug) {
  const val = (document.getElementById(`img-style-override-${slug}`)?.value || '').trim();
  if (!S.images[slug]) return;
  S.images[slug].styleOverride = val || null;
  // Rebuild empty slot prompts with new override
  const page = S.pages.find(p => p.slug === slug);
  if (page) {
    S.images[slug].slots.forEach((sl, i) => {
      if (sl.status === 'empty') sl.prompt = buildImagePrompt(page, i, val || null);
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

function buildAltText(prompt) {
  if (!prompt) return '';
  const clean = prompt
    .replace(/\b(professional|commercial|photography|style|clean|modern|well-lit|neutral|white|backgrounds|no text|no watermarks|business-appropriate|dramatic|wide composition|aspect ratio|16:9|4:3|1:1|3:2)\b/gi, '')
    .replace(/\s{2,}/g, ' ').trim().replace(/[.,!]+$/, '');
  return clean.length > 97 ? clean.slice(0, 97) + '...' : clean;
}

function saveAltText(slug, slotIdx, val) {
  if (!S.images[slug]?.slots[slotIdx]) return;
  S.images[slug].slots[slotIdx].altText = val.slice(0, 125);
  scheduleSave();
}

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

async function generateImage(slug, slotIdx, customPrompt) {
  if (!S.images[slug]) return;
  const page = S.pages.find(p => p.slug === slug);
  if (!page) return;
  const slot = S.images[slug].slots[slotIdx];
  if (!slot) return;

  const prompt = customPrompt || slot.prompt || buildImagePrompt(page, slotIdx, S.images[slug].styleOverride);
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
      if (!slot.altText) slot.altText = buildAltText(slot.prompt);
      savePageImages(slug);
    } else {
      slot.status = 'error';
      slot.errorMsg = data.error || 'Unknown error';
      if (data.detail) slot.errorMsg += ' — ' + data.detail;
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

async function generateAllImages(slug) {
  if (S.imageGenRunning) return;
  S.imageGenRunning = true;
  S.imageGenStop = false;
  document.getElementById('image-stop-btn').style.display = '';
  document.getElementById('image-progress').style.display = 'block';
  imageExpandedSlug = slug;
  renderImageQueue();

  for (let i = 0; i < 5; i++) {
    if (S.imageGenStop) break;
    await generateImage(slug, i);
    await new Promise(r => setTimeout(r, 500)); // small delay between requests
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
    for (let i = 0; i < 5; i++) {
      if (S.imageGenStop) break;
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

function updateImageProgress() {
  const pages = S.pages || [];
  const total = pages.length * 5;
  const done = pages.reduce((acc, p) => {
    return acc + ((S.images[p.slug]?.slots || []).filter(s => s.status === 'done').length);
  }, 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const countEl = document.getElementById('image-count-label');
  const pctEl = document.getElementById('image-pct-label');
  const fill = document.getElementById('image-progress-fill');
  if (countEl) countEl.textContent = `${done} of ${total} images`;
  if (pctEl) pctEl.textContent = ` ${pct}%`;
  if (fill) fill.style.width = pct + '%';
  const prog = document.getElementById('image-progress');
  if (prog) prog.style.display = total > 0 && done > 0 ? 'block' : 'none';
}

function checkImageAllDone() {
  const pages = S.pages || [];
  const allDone = pages.length > 0 && pages.every(p =>
    ((S.images[p.slug]?.slots || []).length > 0 && (S.images[p.slug]?.slots || []).every(s => s.status === 'done'))
  );
  const el = document.getElementById('image-all-done');
  if (el) el.style.display = allDone ? 'flex' : 'none';
}

// ── LAYOUT WIREFRAME GENERATOR ──────────────────────────────────
let layoutCurrentPage = null;
