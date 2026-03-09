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

        const body = seeds.slice(0, 20).map(seed => ({
          keyword: seed,
          location_code: locationCode,
          language_code: 'en',
          limit: 30
        }));

        let raw, data;
        const res = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        raw = await res.text();
        try { data = JSON.parse(raw); } catch(e) {
          return new Response(JSON.stringify({ error: 'Parse error: ' + raw.slice(0,200) }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
        }

        if (!res.ok || (data.status_code && data.status_code !== 20000)) {
          return new Response(JSON.stringify({ error: data?.status_message || ('HTTP ' + res.status) }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }

        // keywords_for_keywords response: tasks[].result[].items[].keyword
        // Each result item = one seed, with an items[] array of related keywords
        // Return raw response for structure inspection
        const taskCount = (data.tasks || []).length;
        const task0 = data.tasks?.[0];
        const result0 = task0?.result?.[0];
        const rawSlice = JSON.stringify(data).slice(0, 3000);

        // Try both possible structures:
        // A) result[] items directly have keyword+search_volume (original assumption)
        // B) result[].items[] has the keywords (nested)
        const kwMap = {};
        (data.tasks || []).forEach(task => {
          (task.result || []).forEach(r => {
            // Structure A: r is a keyword item directly
            if (r.keyword && (r.search_volume || 0) > 0) {
              if (!kwMap[r.keyword] || r.search_volume > kwMap[r.keyword].volume) {
                kwMap[r.keyword] = { volume: r.search_volume || 0, kd: r.competition_index || 0, cpc: r.cpc || 0 };
              }
            }
            // Structure B: r has an items[] array of keyword items
            (r.items || []).forEach(item => {
              if (item.keyword && (item.search_volume || 0) > 0) {
                if (!kwMap[item.keyword] || item.search_volume > kwMap[item.keyword].volume) {
                  kwMap[item.keyword] = { volume: item.search_volume || 0, kd: item.competition_index || 0, cpc: item.cpc || 0 };
                }
              }
            });
          });
        });

        const keywords = Object.entries(kwMap).map(([kw, d]) => ({ keyword: kw, volume: d.volume, difficulty: d.kd, cpc: d.cpc }));
        return new Response(JSON.stringify({
          keywords,
          source: 'dataforseo-expand',
          _debug: {
            taskCount,
            task0keys: task0 ? Object.keys(task0) : [],
            result0keys: result0 ? Object.keys(result0) : [],
            result0type: result0 ? typeof result0 : 'undefined',
            kwMapSize: keywords.length,
            rawSlice
          }
        }), {
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
