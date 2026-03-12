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

    // ── Per-page image storage ────────────────────────────────────
    // PUT /api/images/:projectId/:slug — save page images (with b64)
    const imgPutMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/([^/]+)$/);
    if (imgPutMatch && request.method === 'PUT') {
      const [, projectId, slug] = imgPutMatch;
      try {
        const body = await request.text();
        await env.SETSAIL_OS.put('img:' + projectId + ':' + slug, body);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // GET /api/images/:projectId/:slug — load page images
    const imgGetMatch = url.pathname.match(/^\/api\/images\/([^/]+)\/([^/]+)$/);
    if (imgGetMatch && request.method === 'GET') {
      const [, projectId, slug] = imgGetMatch;
      try {
        const val = await env.SETSAIL_OS.get('img:' + projectId + ':' + slug);
        if (!val) return new Response(JSON.stringify(null), { headers: { 'Content-Type': 'application/json', ...cors } });
        return new Response(val, { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // GET /api/images/:projectId — list slugs that have saved images
    const imgListMatch = url.pathname.match(/^\/api\/images\/([^/]+)$/);
    if (imgListMatch && request.method === 'GET') {
      const [, projectId] = imgListMatch;
      try {
        const prefix = 'img:' + projectId + ':';
        const list = await env.SETSAIL_OS.list({ prefix });
        const slugs = list.keys.map(k => k.name.slice(prefix.length));
        return new Response(JSON.stringify({ slugs }), { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }


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
        const cc = (country || 'ca').toLowerCase().slice(0, 2);

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
              kwMap[r.keyword] = {
                    volume: r.search_volume || 0,
                    kd: r.competition_index || 0,
                    cpc: r.cpc || 0,
                    monthly: (r.monthly_searches || []).map(m => m.search_volume || 0)
                  };
            });
          });
          // Only return keywords that exist in kwMap (have vol data), plus a debug count
          const withData = kwList.filter(kw => kwMap[kw] && kwMap[kw].volume > 0);
          const allKws = kwList.map(kw => ({
            keyword: kw,
            volume: kwMap[kw]?.volume || 0,
            difficulty: kwMap[kw]?.kd || 0,
            cpc: kwMap[kw]?.cpc || 0,
            monthly: kwMap[kw]?.monthly || []
          }));
          console.log('[kw-expand] kwMap hits:', Object.keys(kwMap).length, 'with vol>0:', withData.length, 'out of', kwList.length, 'seeds');
          const normalized = {
            keywords: allKws,
            debug: { sent: kwList.length, withData: withData.length, kwMapSize: Object.keys(kwMap).length },
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

        // ── keywords_for_keywords is disabled on this plan — seeds arrive pre-expanded from client ──
        // Just run search_volume/live on the full seed list in batches of 200

        console.log('[kw-expand] seeds received:', seeds.length, 'sample:', JSON.stringify(seeds.slice(0,3)));
        const kwList = [...new Set(seeds)].filter(k => k.split(' ').length <= 10 && k.length <= 80).slice(0, 600);
        console.log('[kw-expand] kwList:', kwList.length);
        const kwMap = {};
        let lastTaskDebug = {};
        const batchSize = 200;
        for (let bi = 0; bi < kwList.length; bi += batchSize) {
          const batch = kwList.slice(bi, bi + batchSize);
          try {
            const volRes = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
              method: 'POST',
              headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
              body: JSON.stringify([{ keywords: batch, location_code: locationCode, language_code: 'en' }])
            });
            const volData = await volRes.json();
            // Capture raw task status for debug
            const t0 = (volData.tasks || [])[0] || {};
            const taskStatus = t0.status_code || volData.status_code || '?';
            const taskMsg = t0.status_message || volData.status_message || '';
            const rawSample = (t0.result || []).slice(0, 2);
            lastTaskDebug = { httpStatus: volRes.status, apiCode: volData.status_code, apiMsg: volData.status_message, taskCode: t0.status_code, taskMsg: t0.status_message, resultLen: (t0.result || []).length, rawSample };
            const hits = [];
            (volData.tasks || []).forEach(task => {
              (task.result || []).forEach(r => {
                if (r.keyword) {
                  kwMap[r.keyword] = {
                    volume: r.search_volume || 0,
                    kd: r.competition_index || 0,
                    cpc: r.cpc || 0,
                    monthly: (r.monthly_searches || []).slice(0, 6).map(m => m.search_volume)
                  };
                  hits.push(r.keyword);
                }
              });
            });
            console.log('[kw-expand] batch sent:', batch.length, 'hits:', hits.length, 'api_code:', volData.status_code, 'api_msg:', volData.status_message);
          } catch(e) { console.error('[kw-expand] batch error:', e.message); }
        }

        const keywords = kwList
          .filter(kw => kwMap[kw] !== undefined)
          .map(kw => ({
            keyword: kw,
            volume: kwMap[kw].volume,
            difficulty: kwMap[kw].kd,
            cpc: kwMap[kw].cpc,
            monthly: kwMap[kw].monthly
          }));

        const volHits = keywords.length;
        return new Response(JSON.stringify({ keywords, source: 'dataforseo-volume', debug: { seedCount: seeds.length, kwListCount: kwList.length, volHits, seedSample: seeds.slice(0,5), taskDebug: lastTaskDebug } }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }




    // ── KW DEBUG ───────────────────────────────────────────────────────
    if (url.pathname === '/api/kw-debug' && request.method === 'POST') {
      try {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
          return new Response(JSON.stringify({ error: 'No DataForSEO credentials' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const { seeds } = await request.json();
        const testSeeds = (seeds || ['seo vancouver', 'digital marketing vancouver']).slice(0, 3);
        const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);

        // Test 1: keywords_for_keywords
        let expandResult, expandError;
        try {
          const r = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
            body: JSON.stringify(testSeeds.map(s => ({ keyword: s, location_code: 2124, language_code: 'en', limit: 5 })))
          });
          const raw = await r.text();
          expandResult = { status: r.status, body: JSON.parse(raw) };
        } catch(e) { expandError = e.message; }

        // Test 2: search_volume/live
        let volResult, volError;
        try {
          const r = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
            body: JSON.stringify([{ keywords: testSeeds, location_code: 2124, language_code: 'en' }])
          });
          const raw = await r.text();
          volResult = { status: r.status, body: JSON.parse(raw) };
        } catch(e) { volError = e.message; }

        return new Response(JSON.stringify({ testSeeds, expandResult, expandError, volResult, volError }, null, 2), {
          status: 200, headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // ── CLAUDE SYNC (non-streaming, for large JSON responses) ──────────────
    if (url.pathname === '/api/claude-sync' && request.method === 'POST') {
      try {
        const body = await request.json();
        body.stream = false;
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: { 'Content-Type': 'application/json', ...cors }
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
        // Strip location modifiers so Google returns PAA (not just local pack)
        const cleanKw = kw.replace(/\b(vancouver|victoria|burnaby|surrey|toronto|calgary|edmonton|montreal|canada|bc|ontario|near me)\b/gi, '').replace(/\s+/g, ' ').trim() || kw;
        const body = [{ keyword: cleanKw, location_code: 2124, language_code: 'en', depth: 10, people_also_ask_click_depth: 4 }];
        const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
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
        // Dump first result raw (truncated) to understand the structure
        const firstResult = results[0] || null;
        const firstResultKeys = firstResult ? Object.keys(firstResult) : [];
        // Try to find questions at various paths
        const topItems = firstResult?.items || [];
        const questions = [];
        const walk = (nodes, depth) => {
          (nodes||[]).forEach(n => {
            const q = n.title || n.question || '';
            if (q) questions.push({ q, type: n.type, depth, subItems: (n.items||[]).length });
            if (n.items) walk(n.items, depth+1);
          });
        };
        walk(topItems, 0);
        return new Response(JSON.stringify({
          http_status: res.status,
          task_status: task.status_code,
          task_msg: task.status_message,
          result_count: results.length,
          first_result_keys: firstResultKeys,
          top_item_count: topItems.length,
          all_questions_found: questions.slice(0, 20),
          first_result_raw: JSON.stringify(firstResult).slice(0, 2000)
        }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json', ...cors } });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // ── PEOPLE ALSO ASK (via SERP organic/live/advanced — PAA embedded in results) ──
    if (url.pathname === '/api/paa' && request.method === 'POST') {
      try {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
          return new Response(JSON.stringify({ error: 'No DataForSEO credentials' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const { keywords, country } = await request.json();
        if (!keywords?.length) return new Response(JSON.stringify({ error: 'No keywords' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

        const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);
        const locationCode = (country || 'CA') === 'CA' ? 2124 : 2840;

        // Strip location modifiers — Google shows PAA for informational queries, not local/commercial ones
        const locationWords = /\b(vancouver|victoria|burnaby|surrey|richmond|langley|coquitlam|toronto|calgary|edmonton|montreal|ottawa|canada|bc|ontario|alberta|near me)\b/gi;
        const seeds = [...new Set(
          keywords.slice(0, 6).map(kw => kw.replace(locationWords, '').replace(/\s+/g, ' ').trim()).filter(kw => kw.length > 2)
        )].slice(0, 4);

        // If all seeds stripped to nothing, fall back to raw keywords (better than nothing)
        const finalSeeds = seeds.length ? seeds : keywords.slice(0, 4);

        const body = finalSeeds.map(kw => ({
          keyword: kw,
          location_code: locationCode,
          language_code: 'en',
          depth: 10,
          people_also_ask_click_depth: 4
        }));

        const res = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); } catch(e) {
          return new Response(JSON.stringify({ error: 'PAA parse error: ' + raw.slice(0, 300) }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
        }

        // Extract PAA items from organic SERP results
        const seen = new Set();
        const questions = [];

        // Walk the full item tree — PAA questions are people_also_ask_element at any depth
        const extractPAA = (items, sourceKw) => {
          (items || []).forEach(item => {
            if (item.type === 'people_also_ask_element') {
              const text = (item.title || item.question || '').trim();
              if (text && !seen.has(text.toLowerCase())) {
                seen.add(text.toLowerCase());
                questions.push({ question: text, source: sourceKw });
              }
            }
            // Always recurse — PAA elements can be nested at any depth
            if (item.items?.length) extractPAA(item.items, sourceKw);
          });
        };

        (data.tasks || []).forEach((task, ti) => {
          const sourceKw = finalSeeds[ti] || '';
          (task.result || []).forEach(r => extractPAA(r.items || [], sourceKw));
        });

        if (!questions.length) {
          // Debug info to help diagnose
          const debug = (data.tasks || []).map((t, ti) => ({
            kw: finalSeeds[ti], status: t.status_code, msg: t.status_message,
            resultCount: (t.result || []).length,
            itemTypes: [...new Set((t.result?.[0]?.items || []).map(i => i.type))]
          }));
          return new Response(JSON.stringify({ questions: [], debug, cleanedSeeds: finalSeeds, source: 'dataforseo-paa' }), {
            status: 200, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }

        return new Response(JSON.stringify({ questions, cleanedSeeds: finalSeeds, source: 'dataforseo-paa' }), {
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

    // ── GOOGLE BUSINESS PROFILE (DataForSEO business_data) ──────────
    if (url.pathname === '/api/gmb' && request.method === 'POST') {
      try {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
          return new Response(JSON.stringify({ error: 'No DataForSEO credentials' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const { keyword, location_code } = await request.json();
        if (!keyword) return new Response(JSON.stringify({ error: 'keyword required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

        const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);

        const res = await fetch('https://api.dataforseo.com/v3/business_data/google/my_business_info/live', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            keyword: keyword,
            location_code: location_code || 2840,
            language_code: 'en'
          }])
        });

        const data = await res.json();
        const task = data?.tasks?.[0];
        if (!task || task.status_code >= 40000) {
          return new Response(JSON.stringify({ error: task?.status_message || 'DataForSEO error', result: null }), {
            status: 200, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }

        const item = task?.result?.[0]?.items?.[0];
        if (!item) {
          return new Response(JSON.stringify({ error: 'No GMB listing found', result: null }), {
            status: 200, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }

        // Extract the useful fields
        const gmb = {
          title: item.title || '',
          category: item.category || '',
          address: item.address || '',
          address_parts: item.address_info || {},
          phone: item.phone || '',
          website: item.url || '',
          rating: item.rating?.value || null,
          reviews_count: item.rating?.votes_count || 0,
          price_level: item.price_level || '',
          work_hours: item.work_hours || {},
          social_profiles: [],
          reviews: []
        };

        // Extract reviews (field varies by DataForSEO version)
        const reviewItems = item.reviews || item.review_list || [];
        if (Array.isArray(reviewItems) && reviewItems.length > 0) {
          gmb.reviews = reviewItems.slice(0, 5).map(rv => ({
            author_name: rv.profile_name || rv.author || '',
            rating_value: String(rv.rating?.value || rv.rating || ''),
            review_body_short: (rv.review_text || rv.text || '').slice(0, 200),
            source_url: rv.review_url || ''
          }));
        }

        // Extract social links — DataForSEO uses social_links object
        const socialSrc = item.social_links || item.urls || {};
        const PLATFORM_MAP = {
          facebook: 'Facebook', twitter: 'X', instagram: 'Instagram',
          linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok',
          pinterest: 'Pinterest', yelp: 'Yelp'
        };
        Object.entries(socialSrc).forEach(([key, val]) => {
          if (val) {
            const label = PLATFORM_MAP[key.toLowerCase()] || key;
            gmb.social_profiles.push({ platform: label, url: val });
          }
        });

        // Include raw keys for debugging if social/reviews came back empty
        gmb._debug_keys = Object.keys(item);

        return new Response(JSON.stringify({ result: gmb, source: 'dataforseo-gmb' }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message, result: null }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // ── ORGANIC COMPETITORS (DataForSEO competitors_domain/live) ──
    if (url.pathname === '/api/organic-competitors' && request.method === 'POST') {
      try {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
          return new Response(JSON.stringify({ error: 'No DataForSEO credentials' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const { domain, location_code } = await request.json();
        if (!domain) return new Response(JSON.stringify({ error: 'domain required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

        const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

        const res = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            target: cleanDomain,
            language_code: 'en',
            location_code: location_code || 2840,
            limit: 10,
            filters: ['metrics.organic.count', '>', 0],
            order_by: ['metrics.organic.count,desc']
          }])
        });
        const data = await res.json();
        const task = data?.tasks?.[0];
        if (!task || task.status_code >= 40000) {
          return new Response(JSON.stringify({ error: task?.status_message || 'DataForSEO error', competitors: [] }), {
            status: 200, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }
        const items = task?.result?.[0]?.items || [];
        // Exclude directories, review platforms, tools, and job sites — not real competitors
        const EXCLUDED_DOMAINS = [
          'clutch.co','designrush.com','semrush.com','ahrefs.com','moz.com','hubspot.com',
          'digitalagencynetwork.com','upcity.com','expertise.com','goodfirms.co','g2.com',
          'capterra.com','trustpilot.com','yelp.com','bbb.org','yellowpages.com','bark.com',
          'sortlist.com','agencyspotter.com','wadline.com','featured.com','forbes.com',
          'indeed.com','glassdoor.com','linkedin.com','reddit.com','quora.com','youtube.com',
          'wikipedia.org','wordstream.com','searchengineland.com','searchenginejournal.com',
          'neilpatel.com','backlinko.com','moz.com','sproutsocial.com','hootsuite.com'
        ];
        const competitors = items.map(item => ({
          domain: item.domain || '',
          intersections: item.metrics?.organic?.count || 0,
          etv: Math.round(item.metrics?.organic?.etv || 0),
          keywords: (item.metrics?.organic?.pos_1 || 0) + (item.metrics?.organic?.pos_2_3 || 0) + (item.metrics?.organic?.pos_4_10 || 0)
        })).filter(c => {
          if (!c.domain || c.domain === cleanDomain) return false;
          return !EXCLUDED_DOMAINS.some(ex => c.domain === ex || c.domain.endsWith('.' + ex));
        }).slice(0, 8);

        return new Response(JSON.stringify({ competitors, source: 'dataforseo-competitors', target: cleanDomain }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message, competitors: [] }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // ── SITE SNAPSHOT (Ahrefs) ────────────────────────────────────
    if (url.pathname === '/api/snapshot' && request.method === 'POST') {
      if (!env.DATAFORSEO_LOGIN) return new Response(JSON.stringify({ error: 'DATAFORSEO credentials not set' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...cors }
      });
      try {
        const { domain, country } = await request.json();
        if (!domain) return new Response(JSON.stringify({ error: 'domain required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...cors }
        });
        const locationCode = (country || '').toUpperCase() === 'US' ? 2840 : 2124; // CA=2124, US=2840
        const creds = btoa(env.DATAFORSEO_LOGIN + ':' + env.DATAFORSEO_PASSWORD);
        const dfsPost = async (path, body) => {
          const r = await fetch('https://api.dataforseo.com' + path, {
            method: 'POST',
            headers: { Authorization: 'Basic ' + creds, 'Content-Type': 'application/json' },
            body: JSON.stringify([body]),
          });
          const j = await r.json();
          if (!r.ok || j.status_code >= 40000) throw new Error('DataForSEO ' + path + ': ' + (j.status_message || r.status));
          return j.tasks?.[0]?.result?.[0] || null;
        };

        const [overviewResult, pagesResult, backlinksResult] = await Promise.all([
          dfsPost('/v3/dataforseo_labs/google/domain_rank_overview/live', {
            target: domain, location_code: locationCode, language_code: 'en',
          }).catch(() => null),
          dfsPost('/v3/dataforseo_labs/google/relevant_pages/live', {
            target: domain, location_code: locationCode, language_code: 'en',
            order_by: ['metrics.organic.etv,desc'], limit: 50,
          }),
          dfsPost('/v3/backlinks/summary/live', {
            target: domain, include_subdomains: true, backlinks_status_type: 'live',
          }).catch(() => null),
        ]);

        // Parse top pages from DataForSEO relevant_pages response
        // items[].url_with_params, items[].metrics.organic.etv (traffic), items[].metrics.organic.count (keywords)
        const rawPages = pagesResult?.items || [];
        const topPages = rawPages.map(p => {
          const pageUrl = p.page_address || p.url_with_params || p.url || '';
          let slug = '';
          try { const u = new URL(pageUrl); slug = u.pathname.replace(/\/$/, '') || ''; } catch(e) {}
          return {
            url: pageUrl,
            slug,
            traffic: Math.round(p.metrics?.organic?.etv || 0),
            topKeyword: '',
            topKeywordPosition: null,
            referringDomains: p.metrics?.organic?.etv ? 0 : 0,
            keywords: (p.metrics?.organic?.pos_1||0)+(p.metrics?.organic?.pos_2_3||0)+(p.metrics?.organic?.pos_4_10||0)+(p.metrics?.organic?.pos_11_20||0)+(p.metrics?.organic?.pos_21_30||0)+(p.metrics?.organic?.pos_31_40||0)+(p.metrics?.organic?.pos_41_50||0)+(p.metrics?.organic?.pos_51_60||0)+(p.metrics?.organic?.pos_61_70||0)+(p.metrics?.organic?.pos_71_80||0)+(p.metrics?.organic?.pos_81_90||0)+(p.metrics?.organic?.pos_91_100||0),
            ur: 0,
          };
        });

        // Domain-level metrics from overview
        const orgMetrics = overviewResult?.items?.[0]?.metrics?.organic || {};

        // Fetch sitemap.xml to discover zero-traffic pages (about, contact, services, etc.)
        let sitemapSlugs = [];
        try {
          const sitemapUrls = [
            'https://' + domain + '/sitemap.xml',
            'https://' + domain + '/sitemap_index.xml',
            'https://www.' + domain + '/sitemap.xml',
          ];
          for (const sitemapUrl of sitemapUrls) {
            try {
              const smRes = await fetch(sitemapUrl, { headers: { 'User-Agent': 'SetSailOS/1.0' } });
              if (!smRes.ok) continue;
              const smText = await smRes.text();
              // Extract all <loc> URLs from sitemap
              const locMatches = smText.match(/<loc>([^<]+)<\/loc>/g) || [];
              for (const loc of locMatches) {
                const url = loc.replace(/<\/?loc>/g, '').trim();
                // Skip image/feed/sitemap-index entries
                if (url.match(/\.(jpg|jpeg|png|gif|pdf|xml)$/i)) continue;
                if (url.includes('sitemap')) continue;
                try {
                  const u = new URL(url);
                  const slug = u.pathname.replace(/\/$/, '') || '/';
                  sitemapSlugs.push(slug);
                } catch(e) {}
              }
              if (sitemapSlugs.length > 0) break; // got results, stop trying
            } catch(e) {}
          }
        } catch(e) {}
        console.log('[snapshot] sitemap slugs found:', sitemapSlugs.length);

        // Deduplicate by slug — keep highest traffic entry per slug, merge in sitemap slugs
        const seenSlugs = new Map();
        const dedupedPages = [];
        for (const p of topPages) {
          const key = p.slug;
          if (!seenSlugs.has(key) || p.traffic > seenSlugs.get(key).traffic) {
            seenSlugs.set(key, p);
          }
        }
        // Add sitemap-only pages (zero traffic, but exist on site)
        for (const slug of sitemapSlugs) {
          if (!seenSlugs.has(slug)) {
            seenSlugs.set(slug, {
              url: 'https://' + domain + slug,
              slug,
              traffic: 0,
              topKeyword: '',
              topKeywordPosition: null,
              referringDomains: 0,
              keywords: 0,
              ur: 0,
              rankingKws: [],
              fromSitemap: true
            });
          }
        }
        const finalPages = [...seenSlugs.values()].sort((a, b) => b.traffic - a.traffic);

        // Fetch ranking keywords for top pages (top 20 by traffic)
        const pagesToEnrich = finalPages.filter(p => p.traffic > 0).slice(0, 20);
        if (pagesToEnrich.length > 0) {
          // Batch in groups of 5 to avoid overwhelming the API
          const batchSize = 5;
          for (let bi = 0; bi < pagesToEnrich.length; bi += batchSize) {
            const batch = pagesToEnrich.slice(bi, bi + batchSize);
            await Promise.all(batch.map(async (page) => {
              try {
                const r = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
                  method: 'POST',
                  headers: { Authorization: 'Basic ' + creds, 'Content-Type': 'application/json' },
                  body: JSON.stringify([{
                    target: page.url,
                    location_code: locationCode,
                    language_code: 'en',
                    limit: 15,
                    filters: ['keyword_data.keyword_info.search_volume', '>', 0],
                    order_by: ['keyword_data.keyword_info.search_volume,desc']
                  }])
                });
                const j = await r.json();
                const items = j?.tasks?.[0]?.result?.[0]?.items || [];
                page.rankingKws = items.map(item => ({
                  kw: item.keyword_data?.keyword || '',
                  pos: item.ranked_serp_element?.serp_item?.rank_absolute || item.ranked_serp_element?.serp_item?.rank_group || 0,
                  vol: item.keyword_data?.keyword_info?.search_volume || 0,
                  kd: item.keyword_data?.keyword_properties?.keyword_difficulty || 0
                })).filter(k => k.kw);
                // Set topKeyword from actual ranking data
                if (page.rankingKws.length > 0) {
                  const topKw = page.rankingKws[0];
                  page.topKeyword = topKw.kw;
                  page.topKeywordPosition = topKw.pos;
                }
              } catch(e) {
                page.rankingKws = [];
                console.error('[snapshot] ranked_keywords error for', page.slug, e.message);
              }
            }));
          }
        }

        // Build redirect map from top pages (anything with traffic or backlinks)
        const redirectMap = finalPages
          .filter(p => p.traffic > 0 || p.referringDomains > 0)
          .map(p => ({ oldUrl: p.url, oldSlug: p.slug, newSlug: '', status: 'pending' }));

        const result = {
          capturedAt: Date.now(),
          domain,
          domainMetrics: {
            dr: null,
            orgTraffic: Math.round(overviewResult?.items?.[0]?.metrics?.organic?.etv || 0),
            orgKeywords: (orgMetrics.pos_1||0)+(orgMetrics.pos_2_3||0)+(orgMetrics.pos_4_10||0)+(orgMetrics.pos_11_20||0)+(orgMetrics.pos_21_30||0)+(orgMetrics.pos_31_40||0)+(orgMetrics.pos_41_50||0)+(orgMetrics.pos_51_60||0)+(orgMetrics.pos_61_70||0)+(orgMetrics.pos_71_80||0)+(orgMetrics.pos_81_90||0)+(orgMetrics.pos_91_100||0),
            orgKeywords1_3: (orgMetrics.pos_1||0)+(orgMetrics.pos_2_3||0),
            orgCost: null,
            liveRefdomains: backlinksResult?.referring_domains ?? null,
            liveBacklinks: backlinksResult?.backlinks ?? null,
          },
          topPages: finalPages,
          redirectMap,
        };

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // ── GENERATE IMAGE (Gemini / Nano Banana 2) ──────────────────
    if (url.pathname === '/api/generate-image' && request.method === 'POST') {
      try {
        const geminiKey = env.GEMINI_API_KEY;
        if (!geminiKey) {
          return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured — add it as a Worker secret' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }
        const { prompt } = await request.json();
        if (!prompt) {
          return new Response(JSON.stringify({ error: 'prompt required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }

        // Try Nano Banana 2 first, fall back to 2.5-flash-image
        // Free tier: ~2 req/min — retry up to 3x with backoff on 429
        const models = [
          'gemini-3.1-flash-image-preview',
          'gemini-2.5-flash-image',
        ];

        const sleep = ms => new Promise(r => setTimeout(r, ms));

        async function tryGenerate(model, retries = 3) {
          for (let attempt = 0; attempt < retries; attempt++) {
            if (attempt > 0) await sleep(attempt * 4000);
            const gemRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
                })
              }
            );
            if (gemRes.status === 404) return { skip: true, error: `${model}: not available on this key` };
            if (gemRes.status === 429) {
              if (attempt < retries - 1) continue;
              return { skip: true, error: `${model}: rate limited — trying next model` };
            }
            if (!gemRes.ok) {
              const body = await gemRes.text().catch(() => '');
              return { skip: false, error: `${model}: HTTP ${gemRes.status} — ${body.slice(0, 200)}` };
            }
            const gemData = await gemRes.json();
            const part = gemData.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (part) return { part };
            return { skip: false, error: `${model}: no image part — ${JSON.stringify(gemData).slice(0,150)}` };
          }
          return { skip: false, error: `${model}: all retries exhausted` };
        }

        let imagePart = null;
        let lastError = null;
        for (const model of models) {
          const result = await tryGenerate(model);
          if (result.part) { imagePart = result.part; break; }
          lastError = result.error;
          if (!result.skip) break;
        }

        if (!imagePart) {
          const isRateLimit = lastError && lastError.includes('rate limited');
          return new Response(JSON.stringify({
            error: isRateLimit
              ? 'Rate limited — billing may take a few minutes to activate. Wait 30s and try again.'
              : 'Image generation failed',
            detail: lastError
          }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
        }

        return new Response(JSON.stringify({
          imageData: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType || 'image/png'
        }), { headers: { 'Content-Type': 'application/json', ...cors } });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // Everything else → static assets
    // Force no-cache on HTML so deploys take effect immediately
    const assetRes = await env.ASSETS.fetch(request);
    const ct = assetRes.headers.get('Content-Type') || '';
    if (ct.includes('text/html')) {
      const headers = new Headers(assetRes.headers);
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      return new Response(assetRes.body, { status: assetRes.status, headers });
    }
    return assetRes;
  }
};
