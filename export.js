
function renderExport() {
  const pages = S.pages;
  const copyCount = pages.filter(p => S.copy[p.slug]?.copy).length;
  const schemaCount = pages.filter(p => S.schema[p.slug]?.schema).length;
  document.getElementById('export-subtitle').textContent = S.setup?.client+' — '+pages.length+' pages ready to hand off.';
  document.getElementById('export-stats').innerHTML = [
    {val:pages.length, label:'Pages in Sitemap', icon:'📄'},
    {val:copyCount, label:'Pages with Copy', icon:'✍️', green:true},
    {val:schemaCount, label:'Pages with Schema', icon:'🏷️'},
  ].map(s => '<div class="card" style="display:flex;align-items:center;gap:12px;padding:14px 16px">'
    +'<div style="width:32px;height:32px;border-radius:6px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:14px">'+s.icon+'</div>'
    +'<div><div style="font-size:24px;font-weight:500;letter-spacing:-0.03em;color:'+(s.green?'var(--green)':'var(--dark)')+'">'+s.val+'</div>'
    +'<div style="font-size:11px;color:var(--n2);margin-top:2px">'+s.label+'</div></div></div>'
  ).join('');
  document.querySelectorAll('#export-tab-bar .tab-btn')[0].textContent = 'Sitemap ('+pages.length+')';
  document.querySelectorAll('#export-tab-bar .tab-btn')[1].textContent = 'Copy ('+copyCount+')';
  document.querySelectorAll('#export-tab-bar .tab-btn')[2].textContent = 'Schema ('+schemaCount+')';
  renderSitemapTab(); renderCopyTab(); renderSchemaTab();
}

function renderSitemapTab() {
  const pages = S.pages;
  let html = '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">';
  pages.forEach((p,i) => {
    const pColor = p.priority==='P1'?'var(--green)':p.priority==='P2'?'var(--warn)':'var(--n2)';
    html += '<div style="display:flex;gap:10px;padding:10px 14px;border-bottom:'+(i<pages.length-1?'1px solid var(--border)':'none')+';background:'+(i%2===0?'var(--white)':'rgba(240,239,233,0.5)')+';align-items:center">';
    html += '<span style="color:var(--n2);font-size:11px;width:18px;flex-shrink:0">'+(i+1)+'</span>';
    html += '<div style="flex:1"><span style="color:var(--dark);font-size:13px">'+esc(p.page_name)+'</span><span style="color:var(--n2);font-size:11px;margin-left:8px">/'+esc(p.slug)+'</span><div style="font-size:11px;color:var(--n2);margin-top:2px">'+esc(p.primary_keyword)+'</div></div>';
    html += '<span style="color:'+pColor+';font-size:11px;font-weight:500">'+esc(p.priority)+'</span></div>';
  });
  html += '</div>';
  document.getElementById('export-sitemap-tab').innerHTML = html;
}

function renderCopyTab() {
  const pages = S.pages.filter(p => S.copy[p.slug]?.copy);
  if (!pages.length) { document.getElementById('export-copy-tab').innerHTML = '<p style="color:var(--n2);font-size:13px">No copy generated yet.</p>'; return; }
  exportCopySlug = exportCopySlug || pages[0].slug;
  let html = '<div style="display:flex;gap:4px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px">';
  pages.forEach(p => { html += '<button class="tab-btn '+(exportCopySlug===p.slug?'active':'')+'" style="flex-shrink:0" onclick="switchExportCopy(\''+esc(p.slug)+'\',this)">'+esc(p.page_name)+'</button>'; });
  html += '</div>';
  html += '<div class="card"><div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn btn-ghost sm" onclick="copyToClip2(S.copy[exportCopySlug].copy)"><i class="ti ti-copy"></i> Copy HTML</button></div><div class="code-view" id="export-copy-view">'+esc(S.copy[exportCopySlug]?.copy||'')+'</div></div>';
  document.getElementById('export-copy-tab').innerHTML = html;
}

function switchExportCopy(slug, btn) {
  exportCopySlug = slug;
  document.querySelectorAll('#export-copy-tab .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('export-copy-view').textContent = S.copy[slug]?.copy||'';
}

function switchTab(tab, btn) {
  ['sitemap','copy','schema'].forEach(t => { document.getElementById('export-'+t+'-tab').style.display = t===tab?'block':'none'; });
  document.querySelectorAll('.tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function downloadPackage() {
  const pages = S.pages;
  let out = S.setup.client+' — Website Build Package\nSetSailOS · Setsail Marketing Agency\n'+'='.repeat(60)+'\n\nSITEMAP ('+pages.length+' pages)\n'+'-'.repeat(40)+'\n\n';
  pages.forEach((p,i) => { out += (i+1)+'. '+p.page_name+' (/'+p.slug+') ['+p.priority+']\n   Primary: '+p.primary_keyword+' | KD: '+(p.primary_kd||'?')+'\n\n'; });
  out += '\n'+'='.repeat(60)+'\nCOPY BY PAGE\n'+'-'.repeat(40)+'\n\n';
  pages.forEach(p => { if(S.copy[p.slug]?.copy) out += '\n'+p.page_name.toUpperCase()+' · /'+p.slug+'\n'+'-'.repeat(30)+'\n'+S.copy[p.slug].copy+'\n\n'; });
  out += '\n'+'='.repeat(60)+'\nSCHEMA BY PAGE\n'+'-'.repeat(40)+'\n\n';
  pages.forEach(p => { if(S.schema[p.slug]?.schema) out += '\n'+p.page_name.toUpperCase()+' · /'+p.slug+'\n'+'-'.repeat(30)+'\n'+S.schema[p.slug].schema+'\n\n'; });
  const blob = new Blob([out],{type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=S.setup.client.toLowerCase().replace(/\s+/g,'-')+'-website-build.txt'; a.click();
  URL.revokeObjectURL(url);
}

// ── UTILS ──────────────────────────────────────────────────────────

// ── Keyword Intent Classification ──────────────────────────────────────────
// Rule-based, client-side, no API cost. Priority: local > transactional > commercial > informational > navigational