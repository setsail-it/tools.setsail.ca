
function showLayoutSettings() {
  const panel = document.getElementById('layout-settings-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  const inp = document.getElementById('layout-figma-url');
  if (inp && S.layout?._figmaUrl) inp.value = S.layout._figmaUrl;
}

function saveFigmaUrl() {
  const url = document.getElementById('layout-figma-url').value.trim();
  if (!S.layout) S.layout = {};
  S.layout._figmaUrl = url;
  scheduleSave();
  const status = document.getElementById('layout-figma-status');
  if (status) status.textContent = url ? '✓ Template URL saved — AI will reference this when generating wireframes.' : 'Cleared.';
  setTimeout(() => { if (status) status.textContent = ''; }, 3000);
}

function initLayout() {
  if (!S.layout) S.layout = {};
  renderLayoutQueue();
}

function renderLayoutQueue() {
  const pages = orderedPages();
  if (!pages.length) {
    document.getElementById('layout-queue').innerHTML = '<div style="color:var(--n2);font-size:13px;padding:20px 0">Complete the Sitemap stage first.</div>';
    return;
  }

  const groups = [
    { key:'core',     label:'Core Pages',         icon:'ti-layout-2',   types:['home','about','utility','contact'] },
    { key:'service',  label:'Services',            icon:'ti-briefcase',  types:['service'] },
    { key:'industry', label:'Industry & Location', icon:'ti-map-pin',    types:['industry','location'] },
    { key:'blog',     label:'Blog Posts',          icon:'ti-article',    types:['blog'] },
    { key:'other',    label:'Other',               icon:'ti-file',       types:[] }
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

  const allDone = pages.every(p => (S.layout[p.slug]||{}).html);
  let html = '';

  if (allDone) {
    html += '<div style="display:flex;gap:8px;margin-bottom:16px">'
      + '<button class="btn btn-primary" onclick="exportWireframes()"><i class="ti ti-download"></i> Export All Wireframes</button>'
      + '<button class="btn btn-ghost" onclick="initSchema();goTo(\'schema\')"><i class="ti ti-arrow-right"></i> Proceed to Schema</button>'
      + '</div>';
  }

  let firstGroup = true;
  let globalIdx = 0;

  groups.forEach(group => {
    const gPages = grouped[group.key];
    if (!gPages.length) return;
    const doneCount = gPages.filter(p => !!(S.layout[p.slug]||{}).html).length;

    html += `<div style="display:flex;align-items:center;gap:7px;margin-top:${firstGroup?'0':'18px'};margin-bottom:7px;padding-bottom:7px;border-bottom:1px solid var(--border)">`;
    html += `<i class="ti ${group.icon}" style="font-size:11px;color:var(--n2)"></i>`;
    html += `<span style="font-size:10.5px;font-weight:500;color:var(--n3);text-transform:uppercase;letter-spacing:.06em">${group.label}</span>`;
    html += `<span style="font-size:10px;color:${doneCount===gPages.length?'var(--green)':'var(--n2)'};background:rgba(0,0,0,0.04);border-radius:10px;padding:0 6px">${doneCount}/${gPages.length}</span>`;
    html += `</div>`;
    firstGroup = false;

    gPages.forEach((p, i) => {
      globalIdx++;
      const r = S.layout[p.slug] || {};
      const isDone = !!r.html, isErr = !!r.error;
      const isRunning = layoutCurrentPage === p.slug;
      const isExpanded = S.layoutExpandedSlug === p.slug;
      const pColor = p.priority==='P1'?'var(--green)':p.priority==='P2'?'var(--warn)':'var(--n2)';
      const cirStyle = isDone?'background:var(--green)':isErr?'background:var(--error)':isRunning?'background:var(--dark)':'background:var(--n1)';
      const cirContent = isDone?'&#10003;':isErr?'!':isRunning?'<span class="spinner" style="width:8px;height:8px;border-top-color:white;border-color:rgba(255,255,255,0.3)"></span>':globalIdx;
      const rowBorder = isExpanded?'border-color:var(--dark);':isDone?'border-color:rgba(21,142,29,0.3);':isErr?'border-color:rgba(229,57,53,0.22);':'';

      html += `<div id="layout-card-${p.slug}" style="border:1px solid var(--border);${rowBorder}border-radius:8px;margin-bottom:5px;overflow:hidden">`;

      // Header row
      html += `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;user-select:none" onclick="toggleLayoutAccordion('${p.slug}')">`;
      html += `<div style="width:20px;height:20px;border-radius:50%;${cirStyle};display:flex;align-items:center;justify-content:center;font-size:9px;color:white;font-weight:600;flex-shrink:0">${cirContent}</div>`;
      html += `<i class="ti ${typeIcon(p.page_type)}" style="font-size:12px;color:${isDone?'var(--green)':'var(--n2)'};flex-shrink:0"></i>`;
      html += `<div style="flex:1;min-width:0">`;
      html += `<div style="display:flex;align-items:baseline;gap:6px">`;
      html += `<span style="font-size:13px;color:${isDone||isExpanded?'var(--dark)':'var(--n3)'};font-weight:${isDone?'500':'400'}">${esc(p.page_name)}</span>`;
      html += `<span style="font-size:10px;color:${pColor};padding:0 5px;background:rgba(0,0,0,0.04);border-radius:3px;flex-shrink:0">${p.priority}</span>`;
      const imgsDone = (S.images?.[p.slug]?.slots||[]).filter(s=>s.b64).length;
      if (imgsDone > 0) html += `<span style="font-size:10px;color:#158E1D;background:rgba(21,142,29,0.1);border-radius:3px;padding:0 5px;flex-shrink:0"><i class="ti ti-photo-check" style="font-size:10px"></i> ${imgsDone} img${imgsDone>1?'s':''}</span>`;
      if (isErr&&!isExpanded) html += `<span style="font-size:11px;color:var(--error)">Error</span>`;
      html += `</div>`;
      html += `<div style="font-size:10px;color:var(--n2);margin-top:1px;font-family:monospace;letter-spacing:-.01em">/${p.slug}</div>`;
      html += `</div>`;
      html += `<i class="ti ti-chevron-${isExpanded?'up':'down'} layout-chevron" style="font-size:12px;color:var(--n2);flex-shrink:0"></i>`;
      html += `</div>`;

      if (isExpanded) {
        html += '<div id="layout-content-'+p.slug+'" style="border-top:1px solid var(--border);padding:14px">';
        if (isRunning) {
          html += '<div style="font-size:12px;color:var(--n2);margin-bottom:8px;display:flex;align-items:center;gap:8px"><span class="spinner" style="width:10px;height:10px"></span> Generating wireframe…</div>'
            + '<div id="layout-stream-'+p.slug+'" style="font-size:11px;color:var(--n2);max-height:80px;overflow:auto;line-height:1.5"></div>'
            + '<button class="btn btn-danger sm" style="margin-top:10px" onclick="stopLayout()"><i class="ti ti-player-stop"></i> Stop</button>';
        } else if (isDone) {
          const hasNewImgs = (S.images?.[p.slug]?.slots||[]).some(s=>s.b64);
          html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">'
            + '<button class="btn btn-ghost sm" onclick="printWireframe(\''+p.slug+'\')"><i class="ti ti-printer"></i> Print / Export PDF</button>'
            + '<button class="btn btn-ghost sm" onclick="toggleLayoutCode(\''+p.slug+'\')"><i class="ti ti-code"></i> Show HTML</button>'
            + '<button class="btn btn-ghost sm" id="layout-edit-btn-'+p.slug+'" onclick="toggleLayoutEdit(\''+p.slug+'\')"><i class="ti ti-edit"></i> Edit</button>'
            + (hasNewImgs ? '<button class="btn btn-ghost sm" onclick="reinjectImages(\''+p.slug+'\')" style="border-color:var(--green);color:var(--green)"><i class="ti ti-photo-check"></i> Reinject Images</button>' : '')
            + '<button class="btn btn-danger sm" onclick="redoWireframe(\''+p.slug+'\')"><i class="ti ti-refresh"></i> Redo</button>'
            + '</div>'
            + '<div id="layout-preview-'+p.slug+'" style="border:1px solid var(--border);border-radius:6px;overflow:hidden;background:white">'
            + makeWireframeIframe(r.html)
            + '</div>'
            + '<div id="layout-code-'+p.slug+'" style="display:none;margin-top:8px;max-height:240px;overflow:auto;font-family:monospace;font-size:11px;color:var(--n3);white-space:pre-wrap;background:var(--bg);border-radius:5px;padding:10px;border:1px solid var(--border)">'+esc(r.html)+'</div>'
            + '<textarea id="layout-edit-'+p.slug+'" style="display:none;width:100%;min-height:340px;background:var(--white);border:1.5px solid var(--green);border-radius:6px;padding:12px;font-family:monospace;font-size:12px;color:var(--dark);line-height:1.7;resize:vertical;outline:none;box-sizing:border-box;margin-top:8px">'+esc(r.html)+'</textarea>';
          const allPages = orderedPages();
          const curIdx = allPages.findIndex(pp => pp.slug === p.slug);
          const nextP = allPages.find((pp,ii) => ii > curIdx && !(S.layout[pp.slug]||{}).html);
          if (nextP) {
            html += '<div style="margin-top:10px;display:flex;gap:8px">'
              + '<button class="btn btn-primary sm" onclick="S.layoutExpandedSlug=\''+nextP.slug+'\';renderLayoutQueue();runWireframe(\''+nextP.slug+'\');"><i class="ti ti-arrow-right"></i> Next: '+esc(nextP.page_name)+'</button>'
              + '</div>';
          }
        } else if (isErr) {
          html += '<div style="color:var(--error);font-size:12px;margin-bottom:8px">'+esc(r.error)+'</div>'
            + '<button class="btn btn-primary sm" onclick="runWireframe(\''+p.slug+'\')"><i class="ti ti-player-play"></i> Retry</button>';
        } else {
          html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
            + '<div style="font-size:12px;color:var(--n2)">'+esc(p.primary_keyword||'')+(p.page_type?' · '+esc(p.page_type):'')+(p.word_count_target?' · '+p.word_count_target+' words':'')+'</div>'
            + '<button class="btn btn-primary sm" onclick="runWireframe(\''+p.slug+'\')"><i class="ti ti-layout"></i> Generate Wireframe</button>'
            + '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    });
  });

  document.getElementById('layout-queue').innerHTML = html;
}

function toggleLayoutAccordion(slug) {
  const prev = S.layoutExpandedSlug;
  const isClosing = prev === slug;
  S.layoutExpandedSlug = isClosing ? null : slug;

  // Surgical update — only touch the 1-2 affected cards, not the full list
  if (prev && prev !== slug) collapseLayoutCard(prev);
  if (!isClosing) expandLayoutCard(slug);
  else collapseLayoutCard(slug);
}

function collapseLayoutCard(slug) {
  const card = document.getElementById('layout-card-' + slug);
  if (!card) { renderLayoutQueue(); return; }
  const content = document.getElementById('layout-content-' + slug);
  if (content) content.remove();
  // Reset border
  const r = S.layout[slug] || {};
  const isDone = !!r.html, isErr = !!r.error;
  card.style.borderColor = isDone ? 'rgba(21,142,29,0.3)' : isErr ? 'rgba(229,57,53,0.22)' : 'var(--border)';
  // Flip chevron
  const chev = card.querySelector('.layout-chevron');
  if (chev) chev.className = 'ti ti-chevron-down layout-chevron';
}

function expandLayoutCard(slug) {
  const card = document.getElementById('layout-card-' + slug);
  if (!card) { renderLayoutQueue(); return; }

  card.style.borderColor = 'var(--dark)';
  const chev = card.querySelector('.layout-chevron');
  if (chev) chev.className = 'ti ti-chevron-up layout-chevron';

  const existing = document.getElementById('layout-content-' + slug);
  if (existing) existing.remove();

  const p = orderedPages().find(pp => pp.slug === slug);
  if (!p) return;
  const r = S.layout[slug] || {};
  const isDone = !!r.html, isErr = !!r.error;
  const isRunning = layoutCurrentPage === slug;
  const sq = JSON.stringify(slug); // safe slug for onclick attrs e.g. "my-slug"

  let inner = '';
  if (isRunning) {
    inner = `<div style="font-size:12px;color:var(--n2);margin-bottom:8px;display:flex;align-items:center;gap:8px"><span class="spinner" style="width:10px;height:10px"></span> Generating wireframe\u2026</div>
      <div id="layout-stream-${slug}" style="font-size:11px;color:var(--n2);max-height:80px;overflow:auto;line-height:1.5"></div>
      <button class="btn btn-danger sm" style="margin-top:10px" onclick="stopLayout()"><i class="ti ti-player-stop"></i> Stop</button>`;
  } else if (isDone) {
    const hasNewImgs = (S.images?.[slug]?.slots||[]).some(s => s.b64);
    inner = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn btn-ghost sm" onclick="printWireframe(${sq})"><i class="ti ti-printer"></i> Print / Export PDF</button>
      <button class="btn btn-ghost sm" onclick="toggleLayoutCode(${sq})"><i class="ti ti-code"></i> Show HTML</button>
      <button class="btn btn-ghost sm" id="layout-edit-btn-${slug}" onclick="toggleLayoutEdit(${sq})"><i class="ti ti-edit"></i> Edit</button>
      ${hasNewImgs ? `<button class="btn btn-ghost sm" onclick="reinjectImages(${sq})" style="border-color:var(--green);color:var(--green)"><i class="ti ti-photo-check"></i> Reinject Images</button>` : ''}
      <button class="btn btn-danger sm" onclick="redoWireframe(${sq})"><i class="ti ti-refresh"></i> Redo</button>
    </div>
    <div id="layout-preview-${slug}" style="border:1px solid var(--border);border-radius:6px;overflow:hidden;background:white">
      <div style="display:flex;align-items:center;justify-content:center;height:80px;color:var(--n2);font-size:12px"><span class="spinner" style="width:12px;height:12px"></span></div>
    </div>
    <div id="layout-code-${slug}" style="display:none;margin-top:8px;max-height:240px;overflow:auto;font-family:monospace;font-size:11px;color:var(--n3);white-space:pre-wrap;background:var(--bg);border-radius:5px;padding:10px;border:1px solid var(--border)"></div>
    <textarea id="layout-edit-${slug}" style="display:none;width:100%;min-height:340px;background:var(--white);border:1.5px solid var(--green);border-radius:6px;padding:12px;font-family:monospace;font-size:12px;color:var(--dark);line-height:1.7;resize:vertical;outline:none;box-sizing:border-box;margin-top:8px"></textarea>`;
    const allPages = orderedPages();
    const curIdx = allPages.findIndex(pp => pp.slug === slug);
    const nextP = allPages.find((pp, ii) => ii > curIdx && !(S.layout[pp.slug]||{}).html);
    if (nextP) {
      const nq = JSON.stringify(nextP.slug);
      inner += `<div style="margin-top:10px;display:flex;gap:8px">
        <button class="btn btn-primary sm" onclick="S.layoutExpandedSlug=${nq};renderLayoutQueue();runWireframe(${nq});"><i class="ti ti-arrow-right"></i> Next: ${esc(nextP.page_name)}</button>
      </div>`;
    }
  } else if (isErr) {
    inner = `<div style="color:var(--error);font-size:12px;margin-bottom:8px">${esc(r.error)}</div>
      <button class="btn btn-primary sm" onclick="runWireframe(${sq})"><i class="ti ti-player-play"></i> Retry</button>`;
  } else {
    inner = `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div style="font-size:12px;color:var(--n2)">${esc(p.primary_keyword||'')}${p.page_type ? ' \xb7 ' + esc(p.page_type) : ''}${p.word_count_target ? ' \xb7 ' + p.word_count_target + ' words' : ''}</div>
      <button class="btn btn-primary sm" onclick="runWireframe(${sq})"><i class="ti ti-layout"></i> Generate Wireframe</button>
    </div>`;
  }

  const contentDiv = document.createElement('div');
  contentDiv.id = 'layout-content-' + slug;
  contentDiv.style.cssText = 'border-top:1px solid var(--border);padding:14px';
  contentDiv.innerHTML = inner;
  card.appendChild(contentDiv);

  // Populate code/textarea via textContent (no escaping needed) + inject iframe via blob
  if (isDone && !isRunning) {
    const codeEl = document.getElementById('layout-code-' + slug);
    const editEl = document.getElementById('layout-edit-' + slug);
    if (codeEl) codeEl.textContent = r.html;
    if (editEl) editEl.value = r.html;
    requestAnimationFrame(() => {
      const preview = document.getElementById('layout-preview-' + slug);
      if (preview && !preview.querySelector('iframe')) {
        preview.innerHTML = makeWireframeIframe(r.html);
      }
    });
  }
}


// Placeholder while iframe loads
function makeWireframeIframe_placeholder(slug) {
  return '<div style="display:flex;align-items:center;justify-content:center;height:80px;color:var(--n2);font-size:12px"><span class=\"spinner\" style=\"width:12px;height:12px\"></span></div>';
}

function toggleLayoutCode(slug) {
  const el = document.getElementById('layout-code-'+slug);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function toggleLayoutEdit(slug) {
  const editEl = document.getElementById('layout-edit-'+slug);
  const previewEl = document.getElementById('layout-preview-'+slug);
  const btn = document.getElementById('layout-edit-btn-'+slug);
  if (!editEl) return;
  const isEditing = editEl.style.display !== 'none';
  if (isEditing) {
    const newHtml = editEl.value;
    S.layout[slug].html = newHtml;
    if (previewEl) previewEl.innerHTML = makeWireframeIframe(newHtml);
    document.getElementById('layout-code-'+slug) && (document.getElementById('layout-code-'+slug).textContent = newHtml);
    scheduleSave();
    editEl.style.display = 'none';
    if (previewEl) previewEl.style.display = 'block';
    if (btn) btn.innerHTML = '<i class="ti ti-edit"></i> Edit';
  } else {
    editEl.style.display = 'block';
    if (previewEl) previewEl.style.display = 'none';
    if (btn) btn.innerHTML = '<i class="ti ti-check"></i> Save';
    editEl.focus();
  }
}

function makeWireframeIframe(html) {
  const clean = sanitiseHTML(html);
  const blob = new Blob([clean], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  return `<iframe src="${url}" style="width:100%;min-height:500px;border:none;display:block" onload="autoResizeFrame(this)"></iframe>`;
}

function autoResizeFrame(iframe) {
  try {
    const h = iframe.contentDocument.body.scrollHeight;
    if (h > 100) iframe.style.minHeight = (h + 20) + 'px';
  } catch(e) {}
}

// ── Image picker for wireframe slots ─────────────────────────────
let _imgPickTarget = null; // { slug, slotKey }

window.addEventListener('message', e => {
  if (e.data?.type === 'img-pick') {
    openImagePicker(e.data.slug, e.data.slotKey);
  }
});

function openImagePicker(slug, slotKey) {
  _imgPickTarget = { slug, slotKey };
  const modal = document.getElementById('img-pick-modal');
  const grid = document.getElementById('img-pick-grid');
  const title = document.getElementById('img-pick-title');
  if (!modal) return;
  title.textContent = 'Select image for: ' + slotKey + ' on /' + (slug || '');

  // Build grid of all available images across all pages
  const slotLabels = ['Hero Banner','Section Feature','Detail / Close-up','Content / Blog','CTA / Closing'];
  let html = '';
  let count = 0;
  (S.pages || []).forEach(p => {
    const imgData = S.images?.[p.slug];
    if (!imgData?.slots) return;
    imgData.slots.forEach((sl, i) => {
      if (!sl?.b64) return;
      count++;
      html += `<div onclick="pickImage('${p.slug}',${i})" style="cursor:pointer;border:2px solid transparent;border-radius:6px;overflow:hidden;background:var(--n1);transition:border-color 0.15s" onmouseover="this.style.borderColor='var(--green)'" onmouseout="this.style.borderColor='transparent'">
        <img src="data:${sl.mimeType};base64,${sl.b64}" style="width:100%;height:110px;object-fit:cover;display:block">
        <div style="padding:5px 7px;font-size:10px;color:var(--n3);line-height:1.3">
          <div style="font-weight:500;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.page_name)}</div>
          <div style="color:var(--n2)">${slotLabels[i]||''}</div>
        </div>
      </div>`;
    });
  });

  if (!count) {
    grid.innerHTML = '<div style="color:var(--n2);font-size:13px;padding:20px;text-align:center">No images generated yet. Go to Stage 5 and generate images first.</div>';
  } else {
    grid.innerHTML = html;
  }
  modal.style.display = 'flex';
}

function pickImage(srcSlug, srcSlotIdx) {
  if (!_imgPickTarget) return;
  const { slug, slotKey } = _imgPickTarget;
  const srcSlot = S.images?.[srcSlug]?.slots?.[srcSlotIdx];
  if (!srcSlot?.b64) return;

  // Ensure target page image data exists
  if (!S.images[slug]) S.images[slug] = { styleOverride: null, slots: IMAGE_SLOTS.map((_,i) => ({ status:'empty', prompt:'', b64:null, mimeType:null })) };

  // Find slot index for this slotKey
  const slotKeyMap = { 'hero-banner':0, 'section-feature':1, 'detail-close-up':2, 'content-blog':3, 'cta-closing':4 };
  const targetIdx = slotKeyMap[slotKey];
  if (targetIdx !== undefined) {
    S.images[slug].slots[targetIdx] = { ...S.images[slug].slots[targetIdx], b64: srcSlot.b64, mimeType: srcSlot.mimeType, status: 'done' };
    savePageImages(slug);
  }

  // Re-inject into wireframe
  const layout = S.layout?.[slug];
  if (layout) {
    const source = layout.rawHtml || layout.html;
    S.layout[slug].html = injectImagesIntoWireframe(slug, source);
    scheduleSave();
  }

  closeImagePicker();
  renderLayoutQueue();
}

function closeImagePicker() {
  const modal = document.getElementById('img-pick-modal');
  if (modal) modal.style.display = 'none';
  _imgPickTarget = null;
}


function redoWireframe(slug) {
  delete S.layout[slug];
  S.layoutExpandedSlug = slug;
  scheduleSave(); renderLayoutQueue();
}

let layoutStopFlag = false;
function stopLayout() { layoutStopFlag = true; }

async function runAllWireframes() {
  const pages = orderedPages().filter(p => !(S.layout[p.slug]||{}).html);
  for (const p of pages) {
    if (layoutStopFlag) break;
    S.layoutExpandedSlug = p.slug;
    renderLayoutQueue();
    await runWireframe(p.slug);
    await sleep(400);
  }
}

async function runWireframe(slug) {
  const page = orderedPages().find(p => p.slug === slug);
  if (!page) return;
  layoutCurrentPage = slug;
  layoutStopFlag = false;
  S.layoutExpandedSlug = slug;
  renderLayoutQueue();

  const copyHtml = (S.copy[slug]||{}).copy || '';
  const figmaUrl = S.layout?._figmaUrl || '';
  const research = S.research || {};

  const templateNote = figmaUrl
    ? `\n\nTEMPLATE REFERENCE: The client uses a Figma template at ${figmaUrl}. Where relevant, note which template section to use (e.g. "[Use: Hero Split variant from template]") as a comment below each wireframe block.`
    : '';

  const systemPrompt = `You are a senior UX/UI designer at Setsail Marketing creating a full-page annotated wireframe document. Output self-contained HTML that renders as a clean printable wireframe with real images, section labels, and annotated content outlines.

WIREFRAME STYLE:
- White background, system font (system-ui, -apple-system, sans-serif)
- Each section = a distinct block with a light grey background (#f5f5f5) or white, separated by subtle borders
- Every section has: a section type label (caps, small, grey), a heading, content outline bullets, and a CRO/layout note at the bottom in a yellow annotation box (#fffde7 background)
- Font sizes: section-label 10px caps tracking, heading 18-24px, body 13px, annotation 11px italic
- Max width 900px, centered, padding 0 40px
- Print-friendly: avoid shadows, keep contrast high

IMAGE PLACEHOLDERS: For every image/photo/visual in the layout, use EXACTLY this HTML (single non-nested div, no children other than text):
<div class="img-slot" data-slot="SLOT_NAME" style="background:#e0e0e0;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:11px;color:#888;font-style:italic;text-align:center;padding:8px;min-height:200px;">SLOT_NAME placeholder</div>

Use these SLOT_NAME values (choose the best fit, one use per slot):
- hero-banner → main hero image (wide, top of page)
- section-feature → mid-page feature or about image
- detail-close-up → close-up detail, icon-style, or testimonial visual
- content-blog → editorial, blog, or supporting content image
- cta-closing → closing CTA or footer visual

Each slot name can only be used ONCE per page. For logo strips, team grids, or decorative elements use standard grey divs without data-slot.${templateNote}

OUTPUT: Complete self-contained HTML file starting with <!DOCTYPE html>. No markdown, no fences.`;

  const userPrompt = `Create a full annotated wireframe for this page:

PAGE: ${page.page_name}
SLUG: /${page.slug}
TYPE: ${page.page_type}
PRIMARY KEYWORD: ${page.primary_keyword}
SUPPORTING KEYWORDS: ${(page.supporting_keywords||[]).map(k=>typeof k==='object'?k.kw:k).join(', ')}
SEARCH INTENT: ${page.search_intent}
WORD COUNT TARGET: ${page.word_count_target}

BUSINESS: ${research.client_name||S.setup?.client||''}
VALUE PROP: ${research.value_proposition||''}
KEY DIFFERENTIATORS: ${(research.key_differentiators||[]).slice(0,3).join(' | ')}

COPY CONTENT (use this to populate wireframe headings and outlines):
${copyHtml ? copyHtml.replace(/<[^>]*>/g,'').slice(0,3000) : 'No copy generated yet — infer from keyword and page type.'}

Generate a complete section-by-section wireframe. Include every section a high-converting ${page.page_type} page needs. Annotate each section with: layout choice rationale, content guidance, and CRO notes.`;

  let full = '';
  try {
    full = await callClaude(
      systemPrompt,
      userPrompt,
      (partial) => {
        const el = document.getElementById('layout-stream-'+slug);
        if (el) el.textContent = partial.slice(-200);
      }
    );
  } catch(e) {
    S.layout[slug] = { error: e.message };
    layoutCurrentPage = null;
    renderLayoutQueue();
    return;
  }

  if (layoutStopFlag) { layoutCurrentPage = null; renderLayoutQueue(); return; }

  // Strip fences if any
  let html = full.replace(/^```html\s*/i,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
  // Ensure it's a full doc
  if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
    html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui,sans-serif;margin:0;padding:40px;max-width:900px;margin:0 auto;color:#111}</style></head><body>' + html + '</body></html>';
  }

  const rawHtml = html;
  html = injectImagesIntoWireframe(slug, html);

  S.layout[slug] = { html, rawHtml, generatedAt: Date.now() };
  layoutCurrentPage = null;
  scheduleSave();
  renderLayoutQueue();
}

function injectImagesIntoWireframe(slug, html) {
  const slotMap = { 'hero-banner': 0, 'section-feature': 1, 'detail-close-up': 2, 'content-blog': 3, 'cta-closing': 4 };
  const imgData = S.images?.[slug];
  let result = html;

  // Replace data-slot divs with clickable imgs (if b64 available) or clickable placeholders
  for (const [slotKey, idx] of Object.entries(slotMap)) {
    const re = new RegExp('<div[^>]*data-slot=["\']' + slotKey + '["\'][^>]*>[^<]*<\\/div>', 'gi');
    const slot = (imgData?.slots || [])[idx];
    const clickAttr = `onclick="window.parent.postMessage({type:'img-pick',slug:'${slug}',slotKey:'${slotKey}'},\'*\')" style="cursor:pointer" title="Click to swap image"`;
    if (slot?.b64) {
      const imgStyle = slotKey === 'hero-banner' || slotKey === 'cta-closing'
        ? 'width:100%;max-height:420px;object-fit:cover;display:block;border-radius:4px;cursor:pointer'
        : 'width:100%;max-height:320px;object-fit:cover;display:block;border-radius:4px;cursor:pointer';
      result = result.replace(re, `<img src="data:${slot.mimeType};base64,${slot.b64}" data-slot="${slotKey}" style="${imgStyle}" alt="${slotKey}" onclick="window.parent.postMessage({type:'img-pick',slug:'${slug}',slotKey:'${slotKey}'},'*')" title="Click to swap image">`);
    } else {
      // Make placeholder clickable too
      result = result.replace(re, `<div class="img-slot" data-slot="${slotKey}" ${clickAttr} style="background:#e0e0e0;border:2px dashed #bbb;display:flex;align-items:center;justify-content:center;font-size:11px;color:#888;font-style:italic;text-align:center;padding:8px;min-height:200px;">📷 Click to assign image<br><small>${slotKey}</small></div>`);
    }
  }

  return result;
}

function reinjectImages(slug) {
  const layout = S.layout?.[slug];
  if (!layout?.html) return;
  // Always inject from rawHtml (pre-injection template) so data-slot divs are always present
  const source = layout.rawHtml || layout.html;
  S.layout[slug].html = injectImagesIntoWireframe(slug, source);
  scheduleSave();
  renderLayoutQueue();
}

function printWireframe(slug) {
  const html = (S.layout[slug]||{}).html;
  if (!html) return;
  const win = window.open('', '_blank');
  win.document.write(sanitiseHTML(html));
  win.document.close();
  setTimeout(() => win.print(), 600);
}

function exportWireframes() {
  const pages = orderedPages().filter(p => (S.layout[p.slug]||{}).html);
  const combined = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(S.setup?.client||'Wireframes')}</title><style>
  body{font-family:system-ui,sans-serif;margin:0;padding:0;background:#fff}
  .page-break{page-break-after:always;border-bottom:3px solid #000;padding-bottom:40px;margin-bottom:40px}
  @media print{.page-break{page-break-after:always}}
  </style></head><body>
  ${pages.map(p => '<div class="page-break">'+((S.layout[p.slug]||{}).html.replace(/<!DOCTYPE[^>]*>/i,'').replace(/<\/?html[^>]*>/gi,'').replace(/<\/?head>[\s\S]*?<\/head>/gi,'').replace(/<\/?body[^>]*>/gi,'').trim())+'</div>').join('\n')}
  </body></html>`;
  const blob = new Blob([combined], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=(S.setup?.client||'wireframes').toLowerCase().replace(/\s+/g,'-')+'-wireframes.html'; a.click();
  URL.revokeObjectURL(url);
}

let schemaStopFlag = false;
S.schemaCurrentSlug = null;
S.schemaExpandedSlug = null;
