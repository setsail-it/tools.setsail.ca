export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // ── ANTHROPIC PROXY ──────────────────────────────────────────
    if (url.pathname === '/api/claude') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      try {
        const body = await request.json();
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });
        return new Response(response.body, {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'text/event-stream',
            ...cors,
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: { message: err.message } }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // ── PROJECT STORAGE (KV) ─────────────────────────────────────
    // GET /api/projects — list all projects
    if (url.pathname === '/api/projects' && request.method === 'GET') {
      try {
        const list = await env.SETSAIL_OS.list({ prefix: 'project:' });
        const projects = [];
        for (const key of list.keys) {
          const meta = key.metadata || {};
          projects.push({
            id: key.name.replace('project:', ''),
            name: meta.name || key.name,
            stage: meta.stage || 'setup',
            updatedAt: meta.updatedAt || null,
          });
        }
        projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        return new Response(JSON.stringify(projects), {
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // POST /api/projects/:id — save a project
    const saveMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (saveMatch && request.method === 'POST') {
      const id = saveMatch[1];
      try {
        const data = await request.json();
        const meta = {
          name: data.setup?.client || id,
          stage: data.stage || 'setup',
          updatedAt: Date.now(),
        };
        await env.SETSAIL_OS.put('project:' + id, JSON.stringify(data), { metadata: meta });
        return new Response(JSON.stringify({ ok: true, id }), {
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // GET /api/projects/:id — load a project
    const loadMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (loadMatch && request.method === 'GET') {
      const id = loadMatch[1];
      try {
        const raw = await env.SETSAIL_OS.get('project:' + id);
        if (!raw) return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json', ...cors }
        });
        return new Response(raw, { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // DELETE /api/projects/:id
    const delMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (delMatch && request.method === 'DELETE') {
      const id = delMatch[1];
      try {
        await env.SETSAIL_OS.delete('project:' + id);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }


    // ── DEBUG (secrets check) ─────────────────────────────────────
    if (url.pathname === '/api/debug-env' && request.method === 'GET') {
      return new Response(JSON.stringify({
        has_anthropic: !!env.ANTHROPIC_API_KEY,
        has_dfs_login: !!env.DATAFORSEO_LOGIN,
        has_dfs_pass: !!env.DATAFORSEO_PASSWORD,
        has_ahrefs: !!env.AHREFS_API_KEY,
        dfs_login_len: env.DATAFORSEO_LOGIN ? env.DATAFORSEO_LOGIN.length : 0,
        dfs_pass_len: env.DATAFORSEO_PASSWORD ? env.DATAFORSEO_PASSWORD.length : 0,
      }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // ── KEYWORD METRICS (DataForSEO primary, Ahrefs fallback) ────
    if (url.pathname === '/api/ahrefs' && request.method === 'POST') {
      try {
        const { keywords, country } = await request.json();
        if (!keywords?.length) return new Response(JSON.stringify({ error: 'No keywords provided' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...cors }
        });

        const kwList = keywords.slice(0, 100);
        const cc = (country || 'CA').toUpperCase().slice(0, 2);

        // ── DataForSEO (preferred — pay-per-use, ~$0.0005/kw) ──
        if (env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD) {
          const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);
          const locationCode = cc === 'CA' ? 2124 : cc === 'US' ? 2840 : cc === 'GB' ? 2826 : 2124;
          const body = [{ keywords: kwList, location_code: locationCode, language_code: 'en' }];
          let dfsRes, dfsData, dfsRaw;
          try {
            dfsRes = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
              method: 'POST',
              headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            dfsRaw = await dfsRes.text();
            dfsData = JSON.parse(dfsRaw);
          } catch(e) {
            return new Response(JSON.stringify({ error: 'DataForSEO fetch failed: ' + e.message, raw: dfsRaw?.slice(0,300) }), {
              status: 500, headers: { 'Content-Type': 'application/json', ...cors }
            });
          }

          // DataForSEO uses 20000-range for success, 40xxx for errors — NOT standard HTTP codes
          if (!dfsRes.ok) {
            return new Response(JSON.stringify({
              error: 'DataForSEO HTTP error: ' + dfsRes.status, raw: dfsRaw?.slice(0,300)
            }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
          }
          if (dfsData?.status_code && dfsData.status_code !== 20000) {
            return new Response(JSON.stringify({
              error: 'DataForSEO API error: ' + (dfsData?.status_message || dfsData.status_code),
              status_code: dfsData?.status_code
            }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
          }
          const task0 = dfsData?.tasks?.[0];
          if (task0?.status_code && task0.status_code !== 20000 && task0.status_code !== 20100) {
            return new Response(JSON.stringify({
              error: 'DataForSEO task error: ' + (task0?.status_message || task0.status_code),
              status_code: task0?.status_code
            }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
          }

          const kwMap = {};
          (dfsData?.tasks || []).forEach(task => {
            (task.result || []).forEach(r => {
              kwMap[r.keyword] = { volume: r.search_volume || 0, kd: r.competition_index || 0 };
            });
          });
          const normalized = {
            keywords: kwList.map(kw => ({ keyword: kw, volume: kwMap[kw]?.volume || 0, difficulty: kwMap[kw]?.kd || 0 })),
            source: 'dataforseo'
          };
          return new Response(JSON.stringify(normalized), {
            status: 200, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }

        // ── Ahrefs (fallback — Enterprise only) ──
        if (env.AHREFS_API_KEY) {
          const params = new URLSearchParams();
          params.set('select', 'keyword,volume,difficulty');
          params.set('country', cc.toLowerCase());
          kwList.forEach(k => params.append('keywords[]', k));
          const ahrefsRes = await fetch('https://api.ahrefs.com/v3/keywords-explorer/overview?' + params.toString(), {
            headers: { 'Authorization': 'Bearer ' + env.AHREFS_API_KEY }
          });
          const raw = await ahrefsRes.text();
          let data; try { data = JSON.parse(raw); } catch(e) { data = { error: raw.slice(0,200) }; }
          if (!ahrefsRes.ok) return new Response(JSON.stringify({ error: data?.detail || data?.message || ('Ahrefs error ' + ahrefsRes.status), detail: data }), { status: ahrefsRes.status, headers: { 'Content-Type': 'application/json', ...cors } });
          return new Response(JSON.stringify({ ...data, source: 'ahrefs' }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
        }

        // ── No key configured ──
        return new Response(JSON.stringify({
          error: 'No keyword API configured. Add DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD secrets in Cloudflare Workers (recommended, ~$0.0005/keyword). Sign up at dataforseo.com.',
          code: 'NO_KEY'
        }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }


    // ── KW EXPAND (DataForSEO keyword suggestions from seeds) ────
    if (url.pathname === '/api/kw-expand' && request.method === 'POST') {
      try {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
          return new Response(JSON.stringify({ error: 'No DataForSEO credentials', code: 'NO_KEY' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }
        const { seeds, country } = await request.json();
        if (!seeds?.length) return new Response(JSON.stringify({ error: 'No seeds' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

        const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);
        const locationCode = (country || 'CA') === 'CA' ? 2124 : (country === 'US' ? 2840 : 2124);

        // ── Step 1: Get keyword ideas via keywords_for_keywords ──
        const expandBody = seeds.slice(0, 12).map(seed => ({
          keyword: seed, location_code: locationCode, language_code: 'en', limit: 30
        }));
        let expandData;
        const expandRes = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify(expandBody)
        });
        const expandRaw = await expandRes.text();
        try { expandData = JSON.parse(expandRaw); } catch(e) {
          return new Response(JSON.stringify({ error: 'Expand parse error: ' + expandRaw.slice(0, 200) }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        if (!expandRes.ok || (expandData.status_code && expandData.status_code !== 20000)) {
          return new Response(JSON.stringify({ error: expandData?.status_message || ('Expand HTTP ' + expandRes.status) }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }

        // Collect all unique keyword strings — no volume filter (CA volume can be 0 from this endpoint)
        const kwSet = new Set(seeds); // always include seeds
        (expandData.tasks || []).forEach(task => {
          (task.result || []).forEach(r => {
            if (r.keyword) kwSet.add(r.keyword);
            (r.items || []).forEach(item => { if (item.keyword) kwSet.add(item.keyword); });
          });
        });
        const kwList = [...kwSet].slice(0, 100);

        // ── Step 2: Get real CA volumes via search_volume/live (proven working endpoint) ──
        const volBody = [{ keywords: kwList, location_code: locationCode, language_code: 'en' }];
        const volRes = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify(volBody)
        });
        const volRaw = await volRes.text();
        let volData;
        try { volData = JSON.parse(volRaw); } catch(e) {
          return new Response(JSON.stringify({ error: 'Volume parse error: ' + volRaw.slice(0, 200) }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
        }

        // Build final keyword list with real volumes
        const kwMap = {};
        (volData.tasks || []).forEach(task => {
          (task.result || []).forEach(r => {
            if (r.keyword) kwMap[r.keyword] = { volume: r.search_volume || 0, kd: r.competition_index || 0, cpc: r.cpc || 0 };
          });
        });

        const keywords = kwList
          .filter(kw => kwMap[kw])
          .map(kw => ({ keyword: kw, volume: kwMap[kw].volume, difficulty: kwMap[kw].kd, cpc: kwMap[kw].cpc }));

        return new Response(JSON.stringify({ keywords, source: 'dataforseo-expand' }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }



    // ── PAA DEBUG (temporary — remove after diagnosing) ──────────
    if (url.pathname === '/api/paa-debug' && request.method === 'POST') {
      try {
        const { keywords, country } = await request.json();
        const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);
        const locationCode = (country || 'CA') === 'CA' ? 2124 : 2840;
        const seeds = (keywords || ['seo services vancouver']).slice(0, 2);
        const body = seeds.map(kw => ({ keyword: kw, location_code: locationCode, language_code: 'en', depth: 2 }));
        const res = await fetch('https://api.dataforseo.com/v3/serp/google/people_also_ask/live', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const raw = await res.text();
        // Return first 8000 chars of raw response so we can see the structure
        return new Response(JSON.stringify({ httpStatus: res.status, rawSlice: raw.slice(0, 8000) }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }


    // ── PAA DEBUG ─────────────────────────────────────────────────
    if (url.pathname === '/api/paa-debug' && (request.method === 'GET' || request.method === 'POST')) {
      try {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
          return new Response(JSON.stringify({ error: 'No creds' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);
        const kw = url.searchParams.get('kw') || 'seo services vancouver';
        const body = [{ keyword: kw, location_code: 2124, language_code: 'en', depth: 2 }];
        const res = await fetch('https://api.dataforseo.com/v3/serp/google/people_also_ask/live', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const raw = await res.text();
        let parsed;
        try { parsed = JSON.parse(raw); } catch(e) {
          return new Response(JSON.stringify({ parseError: e.message, raw: raw.slice(0,500) }), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const task = (parsed?.tasks || [])[0] || {};
        const results = task?.result || [];
        // Walk the full result tree to show all types and question titles
        const walk = (nodes, depth) => (nodes||[]).map(n => ({
          type: n.type, title: n.title||null, xpath: n.xpath||null, depth,
          children: n.items ? walk(n.items, depth+1) : undefined
        }));
        return new Response(JSON.stringify({
          http_status: res.status,
          task_status: task.status_code,
          task_msg: task.status_message,
          result_count: results.length,
          result_tree: results.slice(0,3).map(r => ({
            type: r.type, title: r.title||null,
            items_count: (r.items||[]).length,
            items: walk(r.items||[], 0).slice(0,10)
          }))
        }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // ── PEOPLE ALSO ASK (DataForSEO SERP PAA) ────────────────────
    if (url.pathname === '/api/paa' && request.method === 'POST') {
      try {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
          return new Response(JSON.stringify({ error: 'No DataForSEO credentials' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const { keywords, country } = await request.json();
        if (!keywords?.length) return new Response(JSON.stringify({ error: 'No keywords' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

        const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);
        const locationCode = (country || 'CA') === 'CA' ? 2124 : 2840;

        // Fetch PAA for each keyword (max 6 to control cost)
        const seeds = keywords.slice(0, 6);
        const body = seeds.map(kw => ({ keyword: kw, location_code: locationCode, language_code: 'en', depth: 4 }));

        const res = await fetch('https://api.dataforseo.com/v3/serp/google/people_also_ask/live', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); } catch(e) {
          return new Response(JSON.stringify({ error: 'PAA parse error: ' + raw.slice(0, 200) }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
        }

        // Flatten all questions with their source keyword, deduplicate
        const seen = new Set();
        const questions = [];
        (data.tasks || []).forEach((task, ti) => {
          const sourceKw = seeds[ti] || '';
          // DataForSEO PAA: result is an array, items are on each result item
          (task.result || []).forEach(r => {
            // r may be the item itself (title directly) or have an items array
            const flatten = (node, depth) => {
              if (!node) return;
              // Direct question node
              const q = (node.title || node.question || '').trim();
              if (q && !seen.has(q.toLowerCase())) {
                seen.add(q.toLowerCase());
                questions.push({ question: q, source: sourceKw, depth });
              }
              // Recurse into child items
              if (Array.isArray(node.items)) node.items.forEach(child => flatten(child, depth + 1));
            };
            // r itself might be a PAA item or have items[]
            if (r.type === 'people_also_ask_element' || r.title) {
              flatten(r, 0);
            } else {
              (r.items || []).forEach(item => flatten(item, 0));
            }
          });
        });

        // Debug: return raw tasks summary if empty
        if (!questions.length) {
          const debug = (data.tasks || []).map(t => ({
            status: t.status_code,
            msg: t.status_message,
            resultCount: (t.result || []).length,
            firstResultKeys: t.result?.[0] ? Object.keys(t.result[0]) : [],
            firstItemType: t.result?.[0]?.items?.[0]?.type || t.result?.[0]?.type || 'none'
          }));
          return new Response(JSON.stringify({ questions: [], debug, source: 'dataforseo-paa' }), {
            status: 200, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }

        return new Response(JSON.stringify({ questions, source: 'dataforseo-paa' }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // ── COMPETITOR KEYWORD GAP (DataForSEO keywords_for_site) ─────
    if (url.pathname === '/api/competitor-gap' && request.method === 'POST') {
      try {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
          return new Response(JSON.stringify({ error: 'No DataForSEO credentials' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const { domains, ownKeywords, country } = await request.json();
        if (!domains?.length) return new Response(JSON.stringify({ error: 'No domains' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

        const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);
        const locationCode = (country || 'CA') === 'CA' ? 2124 : 2840;
        const ownSet = new Set((ownKeywords || []).map(k => k.toLowerCase().trim()));

        // Fetch top keywords for each competitor domain
        const allKeywords = [];
        const seen = new Set();

        for (const domain of domains.slice(0, 3)) {
          const body = [{ target: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''), location_code: locationCode, language_code: 'en', limit: 100 }];
          const res = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live', {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const raw = await res.text();
          let data;
          try { data = JSON.parse(raw); } catch(e) { continue; }

          (data.tasks || []).forEach(task => {
            (task.result || []).forEach(r => {
              // keywords_for_site returns items[] with keyword_data on each
              const items = r.items || [];
              items.forEach(item => {
                // Two possible structures depending on DataForSEO version
                const kd_obj = item.keyword_data || item;
                const kw = kd_obj.keyword || item.keyword || '';
                const info = kd_obj.keyword_info || kd_obj;
                const props = kd_obj.keyword_properties || kd_obj;
                const vol = info.search_volume || item.search_volume || 0;
                const kd = props.keyword_difficulty ?? item.keyword_difficulty ?? 0;
                if (!kw || seen.has(kw.toLowerCase())) return;
                if (ownSet.has(kw.toLowerCase())) return;
                seen.add(kw.toLowerCase());
                allKeywords.push({ kw, vol, kd, domain, score: vol > 0 && kd > 0 ? Math.round((Math.log(vol+1)*100/kd)*10)/10 : 0 });
              });
              // Also handle flat result (no items wrapper)
              if (!items.length && (r.keyword || r.keyword_data)) {
                const kw = r.keyword || r.keyword_data?.keyword || '';
                const vol = r.search_volume || r.keyword_data?.keyword_info?.search_volume || 0;
                const kd = r.keyword_difficulty || r.keyword_data?.keyword_properties?.keyword_difficulty || 0;
                if (kw && !seen.has(kw.toLowerCase()) && !ownSet.has(kw.toLowerCase())) {
                  seen.add(kw.toLowerCase());
                  allKeywords.push({ kw, vol, kd, domain, score: vol > 0 && kd > 0 ? Math.round((Math.log(vol+1)*100/kd)*10)/10 : 0 });
                }
              }
            });
          });
        }

        // Sort by score desc
        allKeywords.sort((a, b) => b.score - a.score);

        // Debug info if nothing found
        let gapDebug = null;
        if (!allKeywords.length) {
          gapDebug = { domainsAttempted: domains.slice(0,3), ownKwCount: ownSet.size, note: 'check domain format and dataforseo_labs access' };
        }
        return new Response(JSON.stringify({ keywords: allKeywords.slice(0, 120), debug: gapDebug, source: 'dataforseo-gap' }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // Everything else → static assets
    return env.ASSETS.fetch(request);
  }
};
