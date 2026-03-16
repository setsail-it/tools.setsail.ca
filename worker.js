// ── CF Access JWT verification helpers ──────────────────────────────────
// Validates the Cf-Access-JWT-Assertion token against your team's public keys.
// Set CF_ACCESS_TEAM_DOMAIN env var to your team name (e.g. "setsail" for setsail.cloudflareaccess.com).
// Falls back to header-only auth if env var is not yet configured (logs warning).
let _cfAccessKeysCache = null;
let _cfAccessKeysCachedAt = 0;
const CF_KEYS_TTL = 3600000; // 1 hour

async function getCFAccessPublicKeys(teamDomain) {
  if (_cfAccessKeysCache && Date.now() - _cfAccessKeysCachedAt < CF_KEYS_TTL) return _cfAccessKeysCache;
  const res = await fetch(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('Failed to fetch CF Access certs');
  const data = await res.json();
  _cfAccessKeysCache = data.keys || data.public_certs?.map(c => c.kid) || [];
  _cfAccessKeysCachedAt = Date.now();
  return data;
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function verifyCFAccessJWT(token, teamDomain) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const header = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));

  // Check expiry
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT expired');
  // Check issuer
  const expectedIssuer = `https://${teamDomain}.cloudflareaccess.com`;
  if (payload.iss && payload.iss !== expectedIssuer) throw new Error('JWT issuer mismatch');

  // Fetch public keys and find matching key
  const certsData = await getCFAccessPublicKeys(teamDomain);
  const keys = certsData.keys || [];
  const matchingKey = keys.find(k => k.kid === header.kid);
  if (!matchingKey) throw new Error('No matching public key for kid: ' + header.kid);

  // Import the JWK and verify signature
  const cryptoKey = await crypto.subtle.importKey('jwk', matchingKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signatureBytes = base64urlDecode(parts[2]);
  const dataBytes = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signatureBytes, dataBytes);
  if (!valid) throw new Error('JWT signature invalid');

  return payload;
}
// ── Shared helpers (deduplicated) ────────────────────────────────────────

const LOCATION_CODES = { CA: 2124, US: 2840, GB: 2826, AU: 2036, NZ: 2554, SG: 2702, ZA: 2710 };

function getLocationCode(country, fallback = 'CA') {
  const cc = (country || fallback).toUpperCase().slice(0, 2);
  return LOCATION_CODES[cc] || LOCATION_CODES[fallback] || 2124;
}

function getDFSCreds(env) {
  // Use env secrets if they look valid, otherwise fall back to known-good base64
  if (env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD && env.DATAFORSEO_LOGIN.includes('@')) {
    return btoa(env.DATAFORSEO_LOGIN.trim() + ':' + env.DATAFORSEO_PASSWORD.trim());
  }
  return 'aXRAc2V0c2FpbC5jYToxM2JkNDk4YTgxYWU3MzI1';
}

function detectCountryFromGeo(geo) {
  const g = (geo || '').toLowerCase();
  if (/australia|sydney|melbourne|brisbane|perth|adelaide/.test(g)) return 'AU';
  if (/new zealand|auckland|wellington/.test(g)) return 'NZ';
  if (/united kingdom|uk\b|london|manchester|birmingham|leeds|glasgow|edinburgh/.test(g)) return 'GB';
  if (/singapore/.test(g)) return 'SG';
  if (/south africa|cape town|johannesburg/.test(g)) return 'ZA';
  if (/united states|\bus\b|new york|los angeles|chicago|houston|phoenix|dallas|seattle|denver|miami|boston/.test(g)) return 'US';
  // Default: Canada (primary market)
  return 'CA';
}

async function fetchGoogleSuggest(term, gl) {
  try {
    const r = await fetch(
      'https://suggestqueries.google.com/complete/search?client=firefox&q=' + encodeURIComponent(term) + '&hl=en&gl=' + (gl || 'ca'),
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!r.ok) return [];
    const data = await r.json();
    return (data[1] || []).filter(s => s && s.length <= 70 && s.split(' ').length <= 8).map(s => s.toLowerCase());
  } catch(e) { return []; }
}

const EXCLUDED_DOMAINS = [
  'clutch.co','designrush.com','semrush.com','ahrefs.com','moz.com','hubspot.com',
  'digitalagencynetwork.com','upcity.com','expertise.com','goodfirms.co','g2.com',
  'capterra.com','trustpilot.com','yelp.com','bbb.org','yellowpages.com','bark.com',
  'sortlist.com','agencyspotter.com','wadline.com','featured.com','forbes.com',
  'indeed.com','glassdoor.com','linkedin.com','reddit.com','quora.com','youtube.com',
  'wikipedia.org','wordstream.com','searchengineland.com','searchenginejournal.com',
  'neilpatel.com','backlinko.com','sproutsocial.com','hootsuite.com'
];

// ── Rate limiting (KV-based sliding window per user) ─────────────────────
// Groups: 'ai' (Claude/Gemini), 'data' (DataForSEO/Ahrefs), 'queue' (job submission)
const RATE_LIMITS = {
  ai:    { max: 60,  windowSec: 300 },  // 60 AI calls per 5 min
  data:  { max: 40,  windowSec: 300 },  // 40 data API calls per 5 min
  queue: { max: 5,   windowSec: 60 },   // 5 queue submits per 1 min
  image: { max: 20,  windowSec: 300 },  // 20 image generations per 5 min
};

const ENDPOINT_RATE_GROUP = {
  '/api/claude': 'ai', '/api/claude-sync': 'ai', '/api/page-questions': 'ai',
  '/api/snapshot': 'data', '/api/kw-expand': 'data', '/api/paa': 'data',
  '/api/serp-intel': 'data', '/api/niche-expand': 'data', '/api/competitor-gap': 'data',
  '/api/organic-competitors': 'data', '/api/ahrefs': 'data', '/api/kw-debug': 'data',
  '/api/queue-submit': 'queue',
  '/api/generate-image': 'image',
};

async function checkRateLimit(env, userId, group) {
  if (!RATE_LIMITS[group]) return null; // no limit for this group
  const { max, windowSec } = RATE_LIMITS[group];
  const key = 'rl:' + userId + ':' + group;
  const now = Math.floor(Date.now() / 1000);

  const raw = await env.SETSAIL_OS.get(key);
  let bucket = raw ? JSON.parse(raw) : { count: 0, windowStart: now };

  // Reset window if expired
  if (now - bucket.windowStart >= windowSec) {
    bucket = { count: 0, windowStart: now };
  }

  if (bucket.count >= max) {
    const retryAfter = windowSec - (now - bucket.windowStart);
    return { limited: true, retryAfter, remaining: 0 };
  }

  bucket.count++;
  await env.SETSAIL_OS.put(key, JSON.stringify(bucket), { expirationTtl: windowSec + 60 });
  return { limited: false, remaining: max - bucket.count };
}

// ── Pricing Engine KV (read-only) ────────────────────────────────────────
async function getPricingCatalog(env) {
  try {
    const raw = await env.PRICING_KV.get('global:pricing-catalog');
    if (!raw) {
      console.warn('Pricing catalog not found in KV');
      return null;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading pricing catalog: ${err.message}`);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': url.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    // ── AUTH — Cloudflare Access (JWT-verified) ───────────────────
    // Primary: validate Cf-Access-JWT-Assertion token signature + claims.
    // Fallback: Cf-Access-Authenticated-User-Email header (if JWT env not configured yet).
    let userId = null;
    const teamDomain = env.CF_ACCESS_TEAM_DOMAIN; // e.g. "setsail"
    const jwtToken = request.headers.get('Cf-Access-JWT-Assertion');

    if (url.pathname.startsWith('/api/')) {
      if (teamDomain && jwtToken) {
        try {
          const claims = await verifyCFAccessJWT(jwtToken, teamDomain);
          userId = (claims.email || '').toLowerCase().trim() || null;
        } catch (jwtErr) {
          return new Response(JSON.stringify({ error: 'Auth failed: ' + jwtErr.message, code: 'JWT_INVALID' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }
      } else {
        // Fallback: trust CF Access email header (safe only if *.workers.dev route is disabled)
        const userEmail = request.headers.get('Cf-Access-Authenticated-User-Email') || null;
        userId = userEmail ? userEmail.toLowerCase().trim() : null;
        if (teamDomain && !jwtToken) {
          // JWT expected but missing — reject
          return new Response(JSON.stringify({ error: 'Missing access token', code: 'NO_JWT' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }
      }

      // Local dev bypass: if no CF Access is configured, fall back to ADMIN_EMAIL
      if (!userId && !teamDomain && env.ADMIN_EMAIL) {
        userId = env.ADMIN_EMAIL.toLowerCase().trim();
      }

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized', code: 'NO_AUTH' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // Helper: user-scoped KV prefix for project keys
    // Keeps all data isolated per user. Migration path: swap userId source only.
    const userPrefix = userId ? 'u:' + userId + ':' : '';

    // ── Rate limiting — check before expensive routes ──
    const rateGroup = ENDPOINT_RATE_GROUP[url.pathname];
    if (rateGroup && userId) {
      const rl = await checkRateLimit(env, userId, rateGroup);
      if (rl && rl.limited) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded (' + rateGroup + '). Try again in ' + rl.retryAfter + 's.',
          code: 'RATE_LIMITED', retryAfter: rl.retryAfter
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter), ...cors }
        });
      }
    }

        // ── NICHE EXPAND — Google Suggest on per-page primary keywords ─────────
    // Takes array of {slug, primaryKeyword} → returns {slug, keywords:[]} per page
    if (url.pathname === '/api/niche-expand' && request.method === 'POST') {
      try {
        const { pages, country } = await request.json();
        if (!pages?.length) return new Response(JSON.stringify({ error: 'No pages' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

        const gl = (country || 'ca').toLowerCase().slice(0, 2);
        const locationCode = getLocationCode(gl);
        const creds = getDFSCreds(env);

        // Niche modifiers — commercial + informational intent mix
        const nicheModifiers = ['services', 'company', 'agency', 'cost', 'best', 'for', 'how to', 'what is', 'vs', 'near me'];

        const fetchSuggestNiche = (term) => fetchGoogleSuggest(term, gl);

        const results = [];

        // Process pages in batches of 5 to avoid rate limits
        for (let pi = 0; pi < pages.length; pi += 5) {
          const batch = pages.slice(pi, pi + 5);
          await Promise.all(batch.map(async (pg) => {
            const kw = (pg.primaryKeyword || '').trim().toLowerCase();
            if (!kw) { results.push({ slug: pg.slug, keywords: [] }); return; }

            const expanded = new Set([kw]);
            const suggestCalls = [
              fetchSuggestNiche(kw),
              fetchSuggestNiche(kw + ' ' + gl),
            ];
            for (const mod of nicheModifiers) {
              suggestCalls.push(fetchSuggestNiche(kw + ' ' + mod));
            }
            const allSuggestions = await Promise.all(suggestCalls);
            allSuggestions.flat().forEach(s => expanded.add(s));

            const kwList = [...expanded].filter(k => k.split(' ').length >= 2).slice(0, 100);

            // Get volumes for expanded list
            let withVolumes = [];
            if (kwList.length && env.DATAFORSEO_LOGIN) {
              try {
                const volRes = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
                  method: 'POST',
                  headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
                  body: JSON.stringify([{ keywords: kwList.slice(0, 100), location_code: locationCode, language_code: 'en' }])
                });
                const volData = await volRes.json();
                const volItems = volData?.tasks?.[0]?.result || [];
                withVolumes = volItems
                  .filter(r => r.search_volume != null)
                  .map(r => ({ kw: r.keyword, vol: r.search_volume || 0, kd: r.competition_index || 0 }))
                  .sort((a, b) => b.vol - a.vol);
              } catch(e) {
                withVolumes = kwList.map(k => ({ kw: k, vol: null, kd: null }));
              }
            }

            results.push({ slug: pg.slug, keywords: withVolumes });
          }));

          // Small delay between batches to respect rate limits
          if (pi + 5 < pages.length) await new Promise(r => setTimeout(r, 300));
        }

        return new Response(JSON.stringify({ ok: true, results }), {
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // ── PAGE QUESTIONS — Claude generates targeted FAQs per page ────────────
    if (url.pathname === '/api/page-questions' && request.method === 'POST') {
      try {
        const { pages, siteContext } = await request.json();
        if (!pages?.length) return new Response(JSON.stringify({ error: 'No pages' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

        const pageList = pages.map((p, i) =>
          (i+1) + '. slug:' + p.slug + ' | type:' + p.pageType + ' | primary_kw:"' + p.primaryKeyword + '" | supporting:' + (p.supportingKws || []).slice(0,5).join(', ')
        ).join('\n');

        const systemPrompt = 'You are an SEO strategist generating targeted FAQ questions for each page of a marketing agency website. Return ONLY valid JSON — no markdown, no explanation.';

        const userPrompt = 'Generate 8 targeted FAQ questions for each page below. Questions must:\n'
          + '- Be specific to that page\'s niche and primary keyword\n'
          + '- Match real search intent (things prospects actually ask)\n'
          + '- Include a mix of: what/how/why/cost/compare/best questions\n'
          + '- Be 8-15 words each\n'
          + '- NOT be generic marketing questions\n\n'
          + 'SITE CONTEXT: ' + (siteContext || 'Full-service marketing agency') + '\n\n'
          + 'PAGES:\n' + pageList + '\n\n'
          + 'Return JSON array: [{"slug":"...","questions":["q1","q2","q3","q4","q5","q6","q7","q8"]}, ...]\n'
          + 'Return ONLY the JSON array. No markdown.';

        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 5000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
          })
        });

        const aiData = await aiRes.json();
        const raw = aiData?.content?.[0]?.text || '[]';
        let parsed = [];
        try {
          const clean = raw.replace(/^```json\s*/,'').replace(/```\s*$/,'').trim();
          parsed = JSON.parse(clean);
        } catch(e) {
          return new Response(JSON.stringify({ error: 'Parse failed', raw }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
        }

        return new Response(JSON.stringify({ ok: true, results: parsed }), {
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

        // ── WHOAMI — returns current user identity ──────────────────
    if (url.pathname === '/api/whoami' && request.method === 'GET') {
      let profile = { email: userId, name: null, role: 'strategist' };
      if (userId) {
        const pRaw = await env.SETSAIL_OS.get('admin:user:' + userId);
        if (pRaw) { const p = JSON.parse(pRaw); profile.name = p.name || null; profile.role = p.role || 'strategist'; }
        else if (userId === (env.ADMIN_EMAIL || '').toLowerCase()) profile.role = 'admin';
      }
      return new Response(JSON.stringify({ ...profile, ok: true }), {
        headers: { 'Content-Type': 'application/json', ...cors }
      });
    }

        // ── ANTHROPIC PROXY ──────────────────────────────────────────
    // ── ADMIN — user management ──────────────────────────────────────────────────
    // Only admins (role=admin) or the seeded owner email can access these
    async function isAdmin() {
      if (!userId) return false;
      // Owner email always has admin access
      if (userId === (env.ADMIN_EMAIL || '').toLowerCase()) return true;
      const userRaw = await env.SETSAIL_OS.get('admin:user:' + userId);
      if (!userRaw) return false;
      const u = JSON.parse(userRaw);
      return u.role === 'admin';
    }

    // GET /api/admin/users
    if (url.pathname === '/api/admin/users' && request.method === 'GET') {
      if (!(await isAdmin())) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...cors } });
      const list = await env.SETSAIL_OS.list({ prefix: 'admin:user:' });
      const users = [];
      for (const key of list.keys) {
        const raw = await env.SETSAIL_OS.get(key.name);
        if (raw) users.push(JSON.parse(raw));
      }
      return new Response(JSON.stringify({ users }), { headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // POST /api/admin/users — create or update
    if (url.pathname === '/api/admin/users' && request.method === 'POST') {
      if (!(await isAdmin())) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...cors } });
      const { email, name, role, projects } = await request.json();
      if (!email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
      const key = 'admin:user:' + email.toLowerCase().trim();
      const existing = await env.SETSAIL_OS.get(key);
      const data = existing ? JSON.parse(existing) : {};
      const updated = { ...data, email: email.toLowerCase().trim(), name: name || data.name || '', role: role || 'viewer', projects: projects || '', updatedAt: new Date().toISOString() };
      await env.SETSAIL_OS.put(key, JSON.stringify(updated));
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // DELETE /api/admin/users/:email
    if (url.pathname.startsWith('/api/admin/users/') && request.method === 'DELETE') {
      if (!(await isAdmin())) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...cors } });
      const email = decodeURIComponent(url.pathname.replace('/api/admin/users/', ''));
      await env.SETSAIL_OS.delete('admin:user:' + email.toLowerCase().trim());
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // ── GENERATION QUEUE — submit jobs + poll status ──────────────────────────
    // POST /api/queue-submit  { projectId, jobs: [{type, slug, pageIdx}] }
    if (url.pathname === '/api/queue-submit' && request.method === 'POST') {
      try {
        const { projectId, jobs } = await request.json();
        if (!projectId || !jobs?.length) {
          return new Response(JSON.stringify({ error: 'projectId and jobs required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        // ── Security: whitelist job types + cap batch size ──
        const ALLOWED_JOB_TYPES = ['brief', 'copy'];
        const MAX_JOBS_PER_SUBMIT = 50;
        if (jobs.length > MAX_JOBS_PER_SUBMIT) {
          return new Response(JSON.stringify({ error: 'Too many jobs (max ' + MAX_JOBS_PER_SUBMIT + ')' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const submitted = [];
        for (const job of jobs) {
          if (!ALLOWED_JOB_TYPES.includes(job.type)) {
            return new Response(JSON.stringify({ error: 'Invalid job type: ' + job.type }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
          }
          if (typeof job.pageIdx !== 'number' || job.pageIdx < 0 || job.pageIdx > 500) {
            return new Response(JSON.stringify({ error: 'Invalid pageIdx' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
          }
          const jobId = `${job.type}:${job.slug}:${Date.now()}:${Math.random().toString(36).slice(2,7)}`;
          const jobKey = userPrefix + 'job:' + projectId + ':' + jobId;
          await env.SETSAIL_OS.put(jobKey, JSON.stringify({
            jobId, projectId, userId,
            type: job.type,
            slug: job.slug,
            pageIdx: job.pageIdx,
            status: 'queued',
            createdAt: Date.now(),
          }), { expirationTtl: 86400 });
          // Pass userId (not userPrefix) — consumer re-derives the prefix
          await env.SETSAIL_GEN_QUEUE.send({ jobId, jobKey, userId, projectId, type: job.type, slug: job.slug, pageIdx: job.pageIdx });
          submitted.push(jobId);
        }
        return new Response(JSON.stringify({ ok: true, submitted }), { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // GET /api/queue-status?projectId=xxx
    if (url.pathname === '/api/queue-status' && request.method === 'GET') {
      try {
        const projectId = url.searchParams.get('projectId');
        if (!projectId) return new Response(JSON.stringify({ error: 'projectId required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        const prefix = userPrefix + 'job:' + projectId + ':';
        const list = await env.SETSAIL_OS.list({ prefix });
        const jobs = [];
        for (const key of list.keys) {
          const raw = await env.SETSAIL_OS.get(key.name);
          if (raw) jobs.push(JSON.parse(raw));
        }
        return new Response(JSON.stringify({ jobs }), { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    if (url.pathname === '/api/claude') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      try {
        const body = await request.json();
        // ── Security: lock down proxy to allowed models + cap tokens ──
        const ALLOWED_MODELS = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'];
        const MAX_TOKENS_CAP = 8192;
        if (body.model && !ALLOWED_MODELS.includes(body.model)) {
          return new Response(JSON.stringify({ error: 'Model not allowed' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        if (!body.model) body.model = 'claude-sonnet-4-20250514';
        if (!body.max_tokens || body.max_tokens > MAX_TOKENS_CAP) body.max_tokens = MAX_TOKENS_CAP;
        if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
          return new Response(JSON.stringify({ error: 'messages array required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        // Strip any fields that should not be proxied
        const sanitised = { model: body.model, max_tokens: body.max_tokens, messages: body.messages, stream: body.stream !== false };
        if (body.system) sanitised.system = body.system;
        if (body.temperature != null) sanitised.temperature = Math.min(Math.max(Number(body.temperature) || 0, 0), 1);
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(sanitised),
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
        const list = await env.SETSAIL_OS.list({ prefix: userPrefix + 'project:' });
        const projects = [];
        for (const key of list.keys) {
          const meta = key.metadata || {};
          projects.push({
            id: key.name.replace(userPrefix + 'project:', ''),
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

    // POST /api/projects/:id — save a project (with optimistic locking)
    const saveMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (saveMatch && request.method === 'POST') {
      const id = saveMatch[1];
      try {
        const data = await request.json();
        const kvKey = userPrefix + 'project:' + id;

        // ── Optimistic locking: reject stale writes ──
        const clientVersion = data._version || 0;
        const existing = await env.SETSAIL_OS.get(kvKey, { type: 'json' });
        const serverVersion = existing?._version || 0;
        if (clientVersion > 0 && serverVersion > clientVersion) {
          return new Response(JSON.stringify({
            error: 'Conflict: project was modified (server v' + serverVersion + ', yours v' + clientVersion + ')',
            code: 'VERSION_CONFLICT',
            serverVersion
          }), { status: 409, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        data._version = serverVersion + 1;

        const meta = {
          name: data.setup?.client || id,
          stage: data.stage || 'setup',
          updatedAt: Date.now(),
        };
        const serialized = JSON.stringify(data);
        const sizeKB = Math.round(serialized.length / 1024);
        const sizeMB = Math.round(sizeKB / 10.24) / 100; // 2 decimal places
        console.log('[worker save] payload size:', sizeKB + 'KB', '(' + sizeMB + 'MB)', 'v' + data._version);

        // Hard reject if over 24MB (KV limit is 25MB)
        if (sizeKB > 24000) {
          return new Response(JSON.stringify({
            error: 'Project too large (' + sizeMB + 'MB). Remove some pages or clear keyword data.',
            code: 'PAYLOAD_TOO_LARGE', sizeKB, sizeMB
          }), { status: 413, headers: { 'Content-Type': 'application/json', ...cors } });
        }

        await env.SETSAIL_OS.put(kvKey, serialized, { metadata: meta });
        // Return size info so client can warn proactively
        const sizeWarning = sizeKB > 15000 ? 'approaching' : sizeKB > 20000 ? 'critical' : null;
        return new Response(JSON.stringify({ ok: true, id, _version: data._version, sizeKB, sizeMB, sizeWarning }), {
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
        const raw = await env.SETSAIL_OS.get(userPrefix + 'project:' + id);
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
        await env.SETSAIL_OS.delete(userPrefix + 'project:' + id);
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
        await env.SETSAIL_OS.put(userPrefix + 'img:' + projectId + ':' + slug, body);
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
        const val = await env.SETSAIL_OS.get(userPrefix + 'img:' + projectId + ':' + slug);
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
        const prefix = userPrefix + 'img:' + projectId + ':';
        const list = await env.SETSAIL_OS.list({ prefix });
        const slugs = list.keys.map(k => k.name.slice(prefix.length));
        return new Response(JSON.stringify({ slugs }), { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }



    // ── KEYWORD METRICS (DataForSEO primary, Ahrefs fallback) ────
    if (url.pathname === '/api/ahrefs' && request.method === 'POST') {
      try {
        const { keywords, country } = await request.json();
        if (!keywords?.length) return new Response(JSON.stringify({ error: 'No keywords provided' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...cors }
        });

        const cc = (country || 'ca').toLowerCase().slice(0, 2);
        const glMap = { ca: 'ca', us: 'us', gb: 'gb', au: 'au', nz: 'nz', sg: 'sg', za: 'za' };
        const gl = glMap[cc] || 'us';

        // ── Google Suggest expansion ──
        // Take seeds as head terms → expand with Suggest → get real searched phrases
        const headTerms = [...new Set(keywords)].slice(0, 30); // cap at 30 head terms
        const suggestExpanded = new Set(headTerms);

        const modifiers = ['near me', 'services', 'company', 'cost', 'best', 'local', 'affordable', 'top'];

        async function fetchSuggest(term) {
          const results = await fetchGoogleSuggest(term, gl);
          results.forEach(s => suggestExpanded.add(s));
        }

        // Fire suggest requests: bare term + key modifiers (batched to avoid rate limits)
        const suggestBatch = [];
        for (const term of headTerms) {
          suggestBatch.push(fetchSuggest(term));
          suggestBatch.push(fetchSuggest(term + ' ' + gl));  // geo-specific
          for (const mod of modifiers.slice(0, 4)) {
            suggestBatch.push(fetchSuggest(term + ' ' + mod));
          }
        }
        // Run in chunks of 20 to avoid hammering
        for (let i = 0; i < suggestBatch.length; i += 20) {
          await Promise.all(suggestBatch.slice(i, i + 20));
        }

        console.log('[kw-expand] seeds:', headTerms.length, '→ after suggest expansion:', suggestExpanded.size);
        const kwList = [...suggestExpanded].filter(k => k.split(' ').length <= 10 && k.length <= 80).slice(0, 600);

        // ── DataForSEO (preferred — pay-per-use, ~$0.0005/kw) ──
        if (env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD) {
          const creds = getDFSCreds(env);
          const locationCode = getLocationCode(cc, 'US');
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

        const creds = getDFSCreds(env);
        const locationCode = getLocationCode(country);

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
                    volume: r.search_volume != null ? r.search_volume : null,
                    kd: r.competition_index || 0,
                    cpc: r.cpc || 0,
                    monthly: (r.monthly_searches || []).slice(0, 6).map(m => m.search_volume)
                  };
                  hits.push(r.keyword);
                }
              });
            });
            console.log('[kw-expand] batch sent:', batch.length, 'hits:', hits.length, 'api_code:', volData.status_code, 'api_msg:', volData.status_message);
            // Detect auth failure and abort early
            if (volData.status_code === 40100 || volRes.status === 401) {
              return new Response(JSON.stringify({ error: 'DataForSEO auth failed — check API credentials at https://app.dataforseo.com/api-access', keywords: [], debug: lastTaskDebug }), {
                status: 200, headers: { 'Content-Type': 'application/json', ...cors }
              });
            }
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

    // PUT /api/copy/:projectId/:slug — save page copy HTML
    const copyPutMatch = url.pathname.match(/^\/api\/copy\/([^/]+)\/(.+)$/);
    if (copyPutMatch && request.method === 'PUT') {
      const [, projectId, slug] = copyPutMatch;
      try {
        const body = await request.text();
        await env.SETSAIL_OS.put(userPrefix + 'copy:' + projectId + ':' + slug, body);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json', ...cors }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // GET /api/copy/:projectId/:slug — load page copy HTML
    const copyGetMatch = url.pathname.match(/^\/api\/copy\/([^/]+)\/(.+)$/);
    if (copyGetMatch && request.method === 'GET') {
      const [, projectId, slug] = copyGetMatch;
      try {
        const val = await env.SETSAIL_OS.get(userPrefix + 'copy:' + projectId + ':' + slug);
        if (!val) return new Response(JSON.stringify(null), { headers: { 'Content-Type': 'application/json', ...cors } });
        return new Response(val, { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // GET /api/copy/:projectId — list slugs that have saved copy
    const copyListMatch = url.pathname.match(/^\/api\/copy\/([^/]+)$/);
    if (copyListMatch && request.method === 'GET') {
      const [, projectId] = copyListMatch;
      try {
        const prefix = userPrefix + 'copy:' + projectId + ':';
        const list = await env.SETSAIL_OS.list({ prefix });
        const slugs = list.keys.map(k => k.name.slice(prefix.length));
        return new Response(JSON.stringify({ slugs }), { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
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
        const creds = getDFSCreds(env);

        // Test 1: keywords_for_keywords
        let expandResult, expandError;
        try {
          const r = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
            body: JSON.stringify(testSeeds.map(s => ({ keyword: s, location_code: getLocationCode('CA'), language_code: 'en', limit: 5 })))
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
            body: JSON.stringify([{ keywords: testSeeds, location_code: getLocationCode('CA'), language_code: 'en' }])
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

    // ── FETCH PAGE (scrape website text for enrichment) ──────────────
    // Accepts { url } for single page or { urls: [...] } for multi-page
    if (url.pathname === '/api/fetch-page' && request.method === 'POST') {
      try {
        const body = await request.json();
        const urls = body.urls || (body.url ? [body.url] : []);
        if (!urls.length) return new Response(JSON.stringify({ error: 'url or urls required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

        function stripHtml(html) {
          return html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
            .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
            .replace(/<header[\s\S]*?<\/header>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        // Fetch up to 12 pages in parallel, 5s timeout each
        const results = await Promise.allSettled(urls.slice(0, 12).map(async (pageUrl) => {
          let fetchUrl = pageUrl.trim();
          if (!fetchUrl.startsWith('http')) fetchUrl = 'https://' + fetchUrl;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          try {
            const res = await fetch(fetchUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SetSailOS/1.0; +https://setsail.ca)' },
              redirect: 'follow',
              signal: controller.signal,
              cf: { cacheTtl: 300 },
            });
            clearTimeout(timer);
            if (!res.ok) return { url: pageUrl, text: '' };
            const html = await res.text();
            return { url: pageUrl, text: stripHtml(html) };
          } catch (e) {
            clearTimeout(timer);
            return { url: pageUrl, text: '' };
          }
        }));

        const pages = results.map(r => r.status === 'fulfilled' ? r.value : { url: '', text: '' }).filter(p => p.text);
        // Single-page backward compat: return { text }
        if (!body.urls) {
          return new Response(JSON.stringify({ text: (pages[0] && pages[0].text || '').slice(0, 10000) }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }
        // Multi-page: return { pages: [{ url, text }] }
        const trimmed = [];
        let totalLen = 0;
        for (const p of pages) {
          const avail = Math.max(0, 18000 - totalLen);
          if (avail <= 200) break;
          trimmed.push({ url: p.url, text: p.text.slice(0, Math.min(avail, 8000)) });
          totalLen += trimmed[trimmed.length - 1].text.length;
        }
        return new Response(JSON.stringify({ pages: trimmed }), { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // ── BRAND ASSET EXTRACTION (colours, fonts, logo from website HTML) ────
    if (url.pathname === '/api/brand-extract' && request.method === 'POST') {
      try {
        const { url: siteUrl } = await request.json();
        if (!siteUrl) return new Response(JSON.stringify({ error: 'url required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        let fetchUrl = siteUrl.trim().replace(/\/+$/, '');
        if (!fetchUrl.startsWith('http')) fetchUrl = 'https://' + fetchUrl;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        let html = '';
        try {
          const res = await fetch(fetchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SetSailOS/1.0; +https://setsail.ca)' },
            redirect: 'follow', signal: controller.signal, cf: { cacheTtl: 300 }
          });
          clearTimeout(timer);
          if (res.ok) html = await res.text();
        } catch(e) { clearTimeout(timer); }

        if (!html) {
          return new Response(JSON.stringify({ colours: [], fonts: [], logo_url: '' }), { headers: { 'Content-Type': 'application/json', ...cors } });
        }

        // Extract colours — hex codes from CSS/inline styles
        const colourSet = new Set();
        // CSS custom properties and inline hex values
        const hexMatches = html.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [];
        hexMatches.forEach(h => {
          const lower = h.toLowerCase();
          // Skip common non-brand colours (pure black, white, grey)
          if (['#fff','#ffffff','#000','#000000','#333','#333333','#666','#666666','#999','#999999',
               '#ccc','#cccccc','#ddd','#dddddd','#eee','#eeeeee','#f5f5f5','#fafafa','#f0f0f0',
               '#111','#111111','#222','#222222','#444','#444444','#555','#555555','#777','#777777',
               '#888','#888888','#aaa','#aaaaaa','#bbb','#bbbbbb'].indexOf(lower) === -1) {
            colourSet.add(lower);
          }
        });

        // Extract fonts — Google Fonts URL and font-family declarations
        const fontSet = new Set();
        // Google Fonts
        const gfMatches = html.match(/fonts\.googleapis\.com\/css2?\?[^"'>\s]+/g) || [];
        gfMatches.forEach(gf => {
          const familyMatches = gf.match(/family=([^&"'>\s]+)/g) || [];
          familyMatches.forEach(fm => {
            const name = decodeURIComponent(fm.replace('family=', '').split(':')[0]).replace(/\+/g, ' ');
            if (name) fontSet.add(name);
          });
        });
        // font-family in CSS
        const ffMatches = html.match(/font-family\s*:\s*['"]?([^;}{'"]+)/gi) || [];
        ffMatches.forEach(ff => {
          const val = ff.replace(/font-family\s*:\s*/i, '').trim();
          // Take first font in the stack
          const first = val.split(',')[0].replace(/['"\s]/g, '').trim();
          if (first && first.length > 1 && first.length < 40
            && ['inherit','initial','unset','serif','sans-serif','monospace','cursive','fantasy','system-ui','-apple-system','BlinkMacSystemFont','Segoe UI','Arial','Helvetica','Times','Courier','Verdana','Georgia','Tahoma','Trebuchet MS'].map(s=>s.toLowerCase()).indexOf(first.toLowerCase()) === -1) {
            fontSet.add(first);
          }
        });

        // Extract logo URL — look for common patterns
        let logoUrl = '';
        // <link rel="icon"> or <link rel="shortcut icon">
        const iconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
          || html.match(/<link[^>]*href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
        // <img> with logo in class/id/alt
        const logoImgMatch = html.match(/<img[^>]*(?:class|id|alt)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']/i)
          || html.match(/<img[^>]*src=["']([^"']+)["'][^>]*(?:class|id|alt)=["'][^"']*logo[^"']*["']/i);
        // <a class="logo"> containing <img>
        const logoLinkMatch = html.match(/<a[^>]*(?:class|id)=["'][^"']*logo[^"']*["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i);

        const rawLogo = (logoImgMatch && logoImgMatch[1]) || (logoLinkMatch && logoLinkMatch[1]) || (iconMatch && iconMatch[1]) || '';
        if (rawLogo) {
          // Resolve relative URLs
          if (rawLogo.startsWith('//')) logoUrl = 'https:' + rawLogo;
          else if (rawLogo.startsWith('/')) logoUrl = fetchUrl + rawLogo;
          else if (rawLogo.startsWith('http')) logoUrl = rawLogo;
          else logoUrl = fetchUrl + '/' + rawLogo;
        }

        return new Response(JSON.stringify({
          colours: Array.from(colourSet).slice(0, 12),
          fonts: Array.from(fontSet).slice(0, 6),
          logo_url: logoUrl
        }), { headers: { 'Content-Type': 'application/json', ...cors } });
      } catch(err) {
        return new Response(JSON.stringify({ error: err.message, colours: [], fonts: [], logo_url: '' }), { status: 500, headers: { 'Content-Type': 'application/json', ...cors } });
      }
    }

    // ── CLAUDE SYNC (non-streaming, for large JSON responses) ──────────────
    if (url.pathname === '/api/claude-sync' && request.method === 'POST') {
      try {
        const body = await request.json();
        // ── Security: same lockdown as /api/claude ──
        const ALLOWED_MODELS = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'];
        const MAX_TOKENS_CAP = 8192;
        if (body.model && !ALLOWED_MODELS.includes(body.model)) {
          return new Response(JSON.stringify({ error: 'Model not allowed' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        if (!body.model) body.model = 'claude-sonnet-4-20250514';
        if (!body.max_tokens || body.max_tokens > MAX_TOKENS_CAP) body.max_tokens = MAX_TOKENS_CAP;
        if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
          return new Response(JSON.stringify({ error: 'messages array required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const sanitised = { model: body.model, max_tokens: body.max_tokens, messages: body.messages, stream: false };
        if (body.system) sanitised.system = body.system;
        if (body.temperature != null) sanitised.temperature = Math.min(Math.max(Number(body.temperature) || 0, 0), 1);
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(sanitised),
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


    // ── PEOPLE ALSO ASK (via SERP organic/live/advanced — PAA embedded in results) ──
    if (url.pathname === '/api/paa' && request.method === 'POST') {
      try {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
          return new Response(JSON.stringify({ error: 'No DataForSEO credentials' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });
        }
        const { keywords, country } = await request.json();
        if (!keywords?.length) return new Response(JSON.stringify({ error: 'No keywords' }), { status: 400, headers: { 'Content-Type': 'application/json', ...cors } });

        const creds = getDFSCreds(env);
        const locationCode = getLocationCode(country);

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

        const creds = getDFSCreds(env);
        const locationCode = getLocationCode(country, 'US');
        const cc = (country || 'us').toLowerCase().slice(0, 2);
        const ownSet = new Set((ownKeywords || []).map(k => k.toLowerCase().trim()));

        // Fetch top keywords for each competitor domain
        const allKeywords = [];
        const seen = new Set();

        for (const domain of domains.slice(0, 10)) {
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
        // ── Fallback: Google Suggest using competitor brand names as seeds ──
        // Fires when dataforseo_labs is not on plan or domains return no results
        if (!allKeywords.length) {
          gapDebug = { domainsAttempted: domains.slice(0,3), note: 'dataforseo_labs returned 0 — using Google Suggest fallback' };
          const suggestSet = new Set();
          const gl2 = (cc || 'us').toLowerCase();

          async function fetchSuggestComp(term) {
            const results = await fetchGoogleSuggest(term, gl2);
            results.forEach(s => suggestSet.add(s));
          }

          // For each domain, use its bare name parts as seeds (e.g. oceanicdental → "oceanic dental lab")
          const suggestBatch2 = [];
          for (const domain of domains.slice(0, 10)) {
            const bare = domain.replace(/\.com\.au$|\.com$|\.au$|\.co\.nz$/, '');
            suggestBatch2.push(fetchSuggestComp(bare));
            suggestBatch2.push(fetchSuggestComp(bare + ' services'));
            suggestBatch2.push(fetchSuggestComp(bare + ' dental'));
          }
          // Also suggest around the niche directly
          suggestBatch2.push(fetchSuggestComp('dental laboratory services'));
          suggestBatch2.push(fetchSuggestComp('dental lab services'));
          await Promise.all(suggestBatch2);

          // Convert to keyword objects (no vol data — will be looked up later)
          [...suggestSet].filter(s => !ownSet.has(s)).forEach(s => {
            allKeywords.push({ keyword: s, volume: null, kd: null, source: 'suggest-fallback' });
          });
          gapDebug.suggestCount = allKeywords.length;
        }

        return new Response(JSON.stringify({ keywords: allKeywords.slice(0, 200), debug: gapDebug, source: allKeywords[0]?.source === 'suggest-fallback' ? 'google-suggest' : 'dataforseo-gap' }), {
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

        const creds = getDFSCreds(env);

        const res = await fetch('https://api.dataforseo.com/v3/business_data/google/my_business_info/live', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            keyword: keyword,
            location_code: location_code || getLocationCode('CA'),
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

        const creds = getDFSCreds(env);
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();

        const res = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            target: cleanDomain,
            language_code: 'en',
            location_code: location_code || getLocationCode('CA'),
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
        // Uses shared EXCLUDED_DOMAINS defined at top of file
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
        const locationCode = getLocationCode(country);
        const creds = getDFSCreds(env);
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

        // Convert DataForSEO rank (0-1000) to 0-100 scale using their formula: sin(rank/636.62)*100
        const rawRank = backlinksResult?.rank ?? null;
        const dr100 = rawRank != null ? Math.round(Math.sin(rawRank / 636.62) * 100) : null;
        console.log('[snapshot] backlinks rank raw:', rawRank, '→ DR (0-100):', dr100, 'refdomains:', backlinksResult?.referring_domains);

        const result = {
          capturedAt: Date.now(),
          domain,
          domainMetrics: {
            dr: dr100,
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

    // ── SERP INTEL — top-3 competitor on-page analysis ────────────
    if (url.pathname === '/api/serp-intel' && request.method === 'POST') {
      try {
        if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
          return new Response(JSON.stringify({ error: 'No DataForSEO credentials' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }
        const { keyword, country } = await request.json();
        if (!keyword) return new Response(JSON.stringify({ error: 'keyword required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...cors }
        });

        const creds = getDFSCreds(env);
        const locationCode = getLocationCode(country);

        // Step 1: Get top 20 organic SERP results (depth 20 gives more to filter)
        const serpRes = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ keyword, location_code: locationCode, language_code: 'en', depth: 20 }])
        });
        const serpData = await serpRes.json();
        const serpItems = serpData?.tasks?.[0]?.result?.[0]?.items || [];

        // Exclude directories, aggregators, social platforms
        const EXCLUDED = [
          'clutch.co','designrush.com','semrush.com','ahrefs.com','moz.com','hubspot.com',
          'digitalagencynetwork.com','upcity.com','expertise.com','goodfirms.co','g2.com',
          'capterra.com','trustpilot.com','yelp.com','bbb.org','bark.com','featured.com',
          'sortlist.com','forbes.com','indeed.com','linkedin.com','reddit.com','quora.com',
          'wikipedia.org','wordstream.com','searchengineland.com','searchenginejournal.com',
          'neilpatel.com','backlinko.com','sproutsocial.com','hootsuite.com','agencies.semrush.com',
          'hellodarwin.com','604list.ca','infinitydigital.ca'
        ];

        const allOrganic = serpItems.filter(item => item.type === 'organic' && item.url);


        const filteredItems = allOrganic
          .filter(item => {
            try {
              const host = new URL(item.url).hostname.replace(/^www\./, '');
              return !EXCLUDED.some(ex => host === ex || host.endsWith('.' + ex));
            } catch(e) { return false; }
          })
          .slice(0, 3);

        // If filtering removed everything, fall back to top 3 unfiltered organic results
        // Their word counts, H2s, and density are still valuable SERP Intel

        const usedFallback = !filteredItems.length && allOrganic.length > 0;
        const organicItems = filteredItems.length ? filteredItems : allOrganic.slice(0, 3);


        if (!organicItems.length) {
          return new Response(JSON.stringify({
            error: 'No organic results found',
            _debug: {
              keyword,
              locationCode,
              httpStatus: serpRes.status,
              apiStatusCode: serpData?.status_code,
              apiStatusMessage: serpData?.status_message,
              tasksCount: serpData?.tasks?.length || 0,
              taskStatus: serpData?.tasks?.[0]?.status_code,
              taskMessage: serpData?.tasks?.[0]?.status_message,
              resultCount: serpData?.tasks?.[0]?.result?.length || 0,
              totalItems: serpItems.length,
              itemTypes: [...new Set(serpItems.map(i => i.type))],
              organicCount: allOrganic.length,
              filteredCount: filteredItems.length,
              organicDomains: allOrganic.slice(0, 8).map(i => { try { return new URL(i.url).hostname; } catch(e) { return '?'; } }),
              rawSnippet: JSON.stringify(serpData).slice(0, 500)
            },
            competitors: []
          }), {
            status: 200, headers: { 'Content-Type': 'application/json', ...cors }
          });
        }

        // Step 2: Fetch competitor on-page data via DataForSEO On-Page instant_pages
        // Single batch request for all URLs — faster, cheaper, no third-party dependency
        const kw = keyword.toLowerCase();

        // Build base competitor objects from SERP data
        const competitors = organicItems.map((item, idx) => ({
          position: item.rank_group || item.rank_absolute || idx + 1,
          url: item.url,
          title: item.title || '',
          meta_description: item.description || '',
          domain_rating: null,
          h1: '',
          h2s: [],
          word_count: 0,
          kw_count: 0,
          kw_density: 0,
          fetch_ok: false,
          is_directory: usedFallback
        }));

        try {
          const onPageBody = organicItems.map(item => ({ url: item.url }));
          const onPageRes = await fetch('https://api.dataforseo.com/v3/on_page/instant_pages', {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
            body: JSON.stringify(onPageBody),
            signal: AbortSignal.timeout(25000)
          });

          if (onPageRes.ok) {
            const onPageData = await onPageRes.json();
            // instant_pages returns one task per URL — tasks[0] for URL1, tasks[1] for URL2, etc.
            const tasks = onPageData?.tasks || [];

            tasks.forEach((task, taskIdx) => {
              const comp = competitors[taskIdx];
              if (!comp) return;
              const pageItem = task?.result?.[0]?.items?.[0];
              if (!pageItem || !pageItem.meta) {
                comp.fetch_error = task?.status_message || 'No data returned';
                return;
              }
              const meta = pageItem.meta;
              const htags = meta.htags || {};
              const contentMeta = meta.content || {};

              comp.h1 = (htags.h1 || [])[0] || '';
              comp.h2s = (htags.h2 || []).slice(0, 20);
              comp.word_count = contentMeta.plain_text_word_count || 0;
              comp.fetch_ok = pageItem.status_code === 200;
              if (!comp.fetch_ok) comp.fetch_error = 'HTTP ' + pageItem.status_code;
            });
          } else {
            competitors.forEach(c => { c.fetch_error = 'DataForSEO On-Page HTTP ' + onPageRes.status; });
          }
        } catch(e) {
          competitors.forEach(c => { c.fetch_error = e.message; });
        }

        // Step 3: Derive gap directives
        const fetched = competitors.filter(c => c.fetch_ok);
        const avgWordCount = fetched.length
          ? Math.round(fetched.reduce((s, c) => s + c.word_count, 0) / fetched.length)
          : 0;
        const maxWordCount = fetched.length ? Math.max(...fetched.map(c => c.word_count)) : 0;
        const avgDensity = fetched.length
          ? Math.round(fetched.reduce((s, c) => s + c.kw_density, 0) / fetched.length * 10) / 10
          : 0;
        const maxDensity = fetched.length ? Math.max(...fetched.map(c => c.kw_density)) : 0;

        // Collect all H2s from competitors for topic gap analysis
        const allH2s = [...new Set(fetched.flatMap(c => c.h2s))];

        return new Response(JSON.stringify({
          keyword,
          competitors,
          used_directory_fallback: usedFallback,
          directives: {
            word_count_target: Math.round(maxWordCount * 1.05),
            avg_word_count: avgWordCount,
            avg_kw_density: avgDensity,
            max_kw_density: maxDensity,
            density_ceiling: Math.round((maxDensity + 0.3) * 10) / 10,
            all_competitor_h2s: allH2s
          },
          fetchedAt: Date.now()
        }), { headers: { 'Content-Type': 'application/json', ...cors } });

      } catch(err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...cors }
        });
      }
    }

    // Everything else → static assets
    // Force no-cache on HTML so deploys take effect immediately
    if (!env.ASSETS) {
      return new Response('Not found', { status: 404, headers: cors });
    }
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
  },

  // ── QUEUE CONSUMER — processes brief/copy generation jobs ────────────────
  async queue(batch, env) {
    for (const msg of batch.messages) {
      const job = msg.body;
      const { jobId, jobKey, userId, projectId, type, slug, pageIdx } = job;
      // Security: re-derive userPrefix from userId — never trust it from the message
      const userPrefix = userId ? 'u:' + userId + ':' : '';

      // ── helpers ─────────────────────────────────────────────────────────
      async function setStatus(status, extra = {}) {
        const existing = await env.SETSAIL_OS.get(jobKey);
        const data = existing ? JSON.parse(existing) : { jobId, projectId, type, slug };
        await env.SETSAIL_OS.put(jobKey, JSON.stringify({ ...data, status, updatedAt: Date.now(), ...extra }), { expirationTtl: 86400 });
      }

      async function claudeCall(system, user, maxTokens = 4000) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, stream: false, system, messages: [{ role: 'user', content: user }] }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          const msg2 = e.error?.message || ('Anthropic error ' + res.status);
          // 429 — retry via queue
          if (res.status === 429) throw new RateLimitError(msg2);
          throw new Error(msg2);
        }
        const data = await res.json();
        return data.content?.[0]?.text || '';
      }

      class RateLimitError extends Error {}

      try {
        await setStatus('running');

        // Load project data from KV
        const projectRaw = await env.SETSAIL_OS.get(userPrefix + 'project:' + projectId);
        if (!projectRaw) { await setStatus('failed', { error: 'Project not found' }); msg.ack(); continue; }
        const S = JSON.parse(projectRaw);
        const p = S.pages?.[pageIdx];
        if (!p) { await setStatus('failed', { error: 'Page not found at index ' + pageIdx }); msg.ack(); continue; }

        const R = S.research || {};
        const setup = S.setup || {};

        if (type === 'brief') {
          // ── SERP Intel ──────────────────────────────────────────────────
          if (p.primary_keyword && env.DATAFORSEO_LOGIN) {
            try {
              const geo = ((R.geography?.primary) || setup.geo || '').toLowerCase();
              const country = detectCountryFromGeo(geo);
              const creds = getDFSCreds(env);
              const siRes = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
                method: 'POST', headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
                body: JSON.stringify([{ keyword: p.primary_keyword, location_code: getLocationCode(country), language_code: 'en', depth: 10 }])
              });
              if (siRes.ok) {
                const siData = await siRes.json();
                const items = siData.tasks?.[0]?.result?.[0]?.items?.filter(i => i.type === 'organic') || [];
                const competitors = [];
                for (const item of items.slice(0, 3)) {
                  try {
                    const pageRes = await fetch(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
                    const html = pageRes.ok ? await pageRes.text() : '';
                    const words = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;
                    const h2s = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)].map(m => m[1].trim()).slice(0, 8);
                    competitors.push({ position: item.rank_absolute, url: item.url, title: item.title, word_count: words, h2s, fetch_ok: true });
                  } catch { competitors.push({ position: item.rank_absolute, url: item.url, title: item.title, fetch_ok: false }); }
                }
                S.pages[pageIdx].serpIntel = { competitors, fetchedAt: Date.now() };
              }
            } catch { /* SERP non-fatal */ }
          }

          // ── Build brief prompt (feature-parity with briefs.js generatePageBrief) ──
          const addlKws = (p.supporting_keywords || []).map(k => typeof k === 'object' ? (k.kw || '') : String(k)).filter(Boolean);
          const existingRkws = (p.existing_ranking_kws || []).slice(0, 5).map(k => k.kw || k);
          const assignedQs = p.assignedQuestions || [];
          // Read strategic fields from S.strategy with fallback to S.research
          const ST = S.strategy || {};
          const _wVp = (ST.positioning && ST.positioning.value_proposition) || R.value_proposition || '';
          const _wKd = (ST.positioning && ST.positioning.key_differentiators) || R.key_differentiators || [];
          const _wEp = R.existing_proof || R.proof_points || [];
          const _wBv = (ST.brand_strategy && ST.brand_strategy.voice_style) || R.brand_voice_style || '';
          const _wTv = (ST.brand_strategy && ST.brand_strategy.tone_and_voice) || R.tone_and_voice || '';
          const _wSl = R.current_slogan || R.slogan_or_tagline || '';
          const _wWa = (ST.brand_strategy && ST.brand_strategy.words_to_avoid) || R.words_to_avoid || [];
          const _wWu = (ST.brand_strategy && ST.brand_strategy.words_to_use) || R.words_to_use || [];
          const _wPn = R.current_pricing || R.pricing_notes || '';
          const _wPcta = (ST.positioning && ST.positioning.primary_cta) || R.primary_cta || '';
          const _wScta = (ST.positioning && ST.positioning.secondary_ctas) || (ST.positioning && ST.positioning.secondary_cta) || R.secondary_cta || '';
          const _wLcta = (ST.positioning && ST.positioning.low_commitment_cta) || R.low_commitment_cta || '';

          // Voice overlay (1)
          const _voiceOverlay = p.voice_overlay || 'base';
          let _voiceRules = '';
          if (_voiceOverlay !== 'base' && ST.brand_strategy && ST.brand_strategy.voice_overlays && ST.brand_strategy.voice_overlays[_voiceOverlay]) {
            const _overlay = ST.brand_strategy.voice_overlays[_voiceOverlay];
            _voiceRules = '\nVoice overlay (' + _voiceOverlay + '): ' + (typeof _overlay === 'string' ? _overlay : JSON.stringify(_overlay));
          }

          // Persona context (2)
          let _personaCtx = '';
          if (p.target_persona && ST.audience && ST.audience.personas) {
            const _matchedPersona = (ST.audience.personas || []).find(per => per.name === p.target_persona);
            if (_matchedPersona) {
              const _perParts = ['Target persona: ' + (_matchedPersona.name || '')];
              if (_matchedPersona.role) _perParts.push('Role: ' + _matchedPersona.role);
              if (_matchedPersona.frustrations && _matchedPersona.frustrations.length) _perParts.push('Pains: ' + _matchedPersona.frustrations.slice(0, 3).join('; '));
              if (_matchedPersona.decision_criteria && _matchedPersona.decision_criteria.length) _perParts.push('Evaluates: ' + _matchedPersona.decision_criteria.slice(0, 3).join('; '));
              if (_matchedPersona.language_patterns && _matchedPersona.language_patterns.length) _perParts.push('Language: ' + _matchedPersona.language_patterns.slice(0, 2).join('; '));
              _personaCtx = '\n' + _perParts.join('\n');
            }
          }

          const ctxBusiness = [
            'Client: ' + (R.client_name || setup.client_name || 'Unknown'),
            'Industry: ' + (R.industry || ''),
            'Value proposition: ' + _wVp,
            'Key differentiators: ' + (_wKd.length ? _wKd.join('; ') : 'none provided'),
            'Proof points: ' + (_wEp.length ? _wEp.join('; ') : 'none provided'),
            'Brand voice: ' + (_wBv || _wTv || 'professional') + _voiceRules,
            (_wSl ? 'Slogan: ' + _wSl : ''),
            (_wWa.length ? 'Words to avoid: ' + _wWa.join(', ') : ''),
            (_wWu.length ? 'Words to use: ' + _wWu.join(', ') : ''),
            (R.booking_flow_description ? 'Booking flow: ' + R.booking_flow_description : ''),
            (_wPn ? 'Pricing notes: ' + _wPn : ''),
            _personaCtx,
          ].filter(l => l && l.trim() && (l.indexOf(': ') < 0 || l.split(': ')[1])).join('\n');

          // Positioning direction (12)
          let ctxPositioning = '';
          if (ST.positioning && ST.positioning.selected_direction) {
            const _dir = ST.positioning.selected_direction;
            ctxPositioning = '\n\n## POSITIONING DIRECTION\n' + (_dir.name || '') + ((_dir.thesis) ? ' — ' + _dir.thesis : '');
          }

          // Competitive counter (13)
          let ctxCompCounter = '';
          if (ST.positioning && ST.positioning.competitive_counter) {
            ctxCompCounter = '\nCompetitive counter: ' + ST.positioning.competitive_counter;
          }

          const pt = (p.page_type || 'service').toLowerCase();
          const isService = /^(service|location|industry)$/.test(pt);
          const isBlog = /^(blog|faq|resource)$/.test(pt);
          const isUtility = /^(home|about|team|utility)$/.test(pt);

          // Subtraction context (14) — service/utility only
          let ctxSubtraction = '';
          if ((isService || isUtility) && ST.subtraction) {
            const _subItems = [];
            const _subAudit = ST.subtraction.current_activities_audit || ST.subtraction.verdicts || (Array.isArray(ST.subtraction) ? ST.subtraction : []);
            _subAudit.filter(s => s.verdict === 'cut' || s.verdict === 'stop' || s.verdict === 'restructure').slice(0, 4).forEach(s => {
              const _vLabel = (s.verdict === 'cut' || s.verdict === 'stop') ? 'CUT' : 'RESTRUCTURE';
              _subItems.push('- ' + _vLabel + ': ' + (s.activity || s.name || '') + (s.reason || s.rationale ? ' — ' + (s.reason || s.rationale) : ''));
            });
            if (ST.subtraction.total_recoverable_monthly) _subItems.push('Recoverable budget: $' + ST.subtraction.total_recoverable_monthly + '/mo');
            if (ST.subtraction.subtraction_summary) _subItems.push('Summary: ' + ST.subtraction.subtraction_summary);
            if (_subItems.length) ctxSubtraction = '\n\n## SUBTRACTION INSIGHTS (use as differentiated messaging angle)\n' + _subItems.join('\n');
          }

          // Economics signal (15) — service/utility only
          let ctxEconomics = '';
          if ((isService || isUtility) && ST.unit_economics) {
            const _ue = ST.unit_economics;
            const _eLines = [];
            if (_ue.budget_tier_label || _ue.budget_tier) _eLines.push('Budget tier: ' + (_ue.budget_tier_label || _ue.budget_tier));
            if (_ue.lead_volume_target) _eLines.push('Lead volume target: ' + _ue.lead_volume_target);
            if (_ue.volume_vs_quality) _eLines.push('Posture: ' + _ue.volume_vs_quality);
            if (_eLines.length) ctxEconomics = '\n\n## ECONOMICS SIGNAL\n' + _eLines.join('\n');
          }

          const _webStrat = ((ST.webStrategy) || setup.webStrategy || '').trim();
          const _pageCtx = (p.pageContext || '').trim();
          const _pageGoal = (p.page_goal || '').trim();

          // Proof & E-E-A-T context
          const _proofLines = [];
          if ((R.case_studies || []).length) _proofLines.push('Case studies: ' + R.case_studies.slice(0, 4).map(cs => (cs.client || 'Client') + ' — ' + (cs.result || 'result') + (cs.timeframe ? ' (' + cs.timeframe + ')' : '')).join('; '));
          if ((R.notable_clients || []).length) _proofLines.push('Notable clients: ' + R.notable_clients.slice(0, 6).join(', '));
          if ((R.awards_certifications || []).length) _proofLines.push('Awards/certs: ' + R.awards_certifications.slice(0, 4).join(', '));
          if (R.team_credentials) _proofLines.push('Team credentials: ' + R.team_credentials);
          if (R.founder_bio) _proofLines.push('Founder: ' + R.founder_bio);
          if ((R.publications_media || []).length) _proofLines.push('Media: ' + R.publications_media.slice(0, 3).join(', '));
          const ctxProof = _proofLines.length ? '\n\n## PROOF & E-E-A-T SIGNALS\n' + _proofLines.join('\n') : '';

          // CTA architecture (16 — fixed secondary_ctas)
          const _ctaLines = [];
          if (_wPcta) _ctaLines.push('Primary CTA: ' + _wPcta);
          if (_wScta) _ctaLines.push('Secondary CTA: ' + (Array.isArray(_wScta) ? _wScta.join(', ') : _wScta));
          if (_wLcta) _ctaLines.push('Low-commitment CTA: ' + _wLcta);
          const ctxCTA = _ctaLines.length ? '\n\n## CTA ARCHITECTURE\n' + _ctaLines.join('\n') : '';

          // Services detail (3) — service/utility templates only
          let ctxServicesDetail = '';
          if ((R.services_detail || []).length && (isService || isUtility)) {
            ctxServicesDetail = '\n\n## SERVICES DETAIL\n' + (R.services_detail || []).slice(0, 8).map(sd => '- ' + sd.name + (sd.description ? ' — ' + sd.description : '') + (sd.pricing ? ' (pricing: ' + sd.pricing + ')' : '') + (sd.key_differentiator ? ' [differentiator: ' + sd.key_differentiator + ']' : '')).join('\n');
          }

          // Page geo (11)
          const _pageGeo = (p.targetGeo) || (R.geography && R.geography.primary) || (setup.geo) || '';

          const ctxAudience = [
            'Primary audience: ' + (R.primary_audience_description || ((R.current_customer_profile || R.target_audience || [])[0]) || ''),
            'Best customer example: ' + (R.best_customer_examples || ''),
            'Buyer roles: ' + ((R.buyer_roles_titles || []).join(', ') || ''),
            'Top pain points: ' + ((R.pain_points_top5 || []).slice(0, 3).join('; ') || ''),
            'Top objections: ' + ((R.objections_top5 || []).slice(0, 3).join('; ') || ''),
            'Geography: ' + (_pageGeo || R.target_geography || ''),
          ].filter(l => l.split(': ')[1]).join('\n');

          // Competitors (5)
          const ctxCompetitors = (R.competitors || []).slice(0, 3).map(c => {
            return '- ' + (c.name || c.url || c) + (c.weaknesses ? ' (weakness: ' + c.weaknesses + ')' : '');
          }).join('\n') || 'None identified';

          // Implied keywords for nav pages (8)
          const _impliedKw = (!p.primary_keyword && ['home', 'about', 'contact', 'utility', 'team'].includes(pt))
            ? ((R.client_name || setup.client_name || '') + ' ' + p.page_name).trim() : '';

          // Keywords context (7 — existing ranking kws)
          const ctxKeywords = '**Primary:** ' + (p.primary_keyword || (_impliedKw ? _impliedKw + ' (navigational)' : 'none')) + ' (' + (p.primary_vol || 0) + '/mo, KD:' + (p.primary_kd || 0) + ')\n'
            + (addlKws.length ? '**Supporting:** ' + addlKws.join(', ') : '')
            + (existingRkws.length ? '\n**Currently ranking for:** ' + existingRkws.join(', ') : '');

          const ctxQuestions = assignedQs.length ? assignedQs.map((q, i) => (i + 1) + '. ' + q).join('\n') : 'None assigned — suggest 4-6 questions matched to search intent';

          // Internal links (4)
          const ctxInternalLinks = (S.pages || []).filter(pg => {
            return pg.slug !== p.slug && pg.primary_keyword && (pg.page_type === 'service' || pg.page_type === 'location' || pg.page_type === 'industry');
          }).slice(0, 8).map(pg => '- /' + pg.slug + ' (' + pg.primary_keyword + ')').join('\n') || 'None available yet';

          // SERP Intel block (6) — use the serpIntel data already fetched above
          let serpBriefBlock = '';
          const _si = p.serpIntel || S.pages[pageIdx].serpIntel;
          if (_si && _si.competitors && _si.competitors.length) {
            const _siKw = p.primary_keyword || '';
            const _siLines = [];
            _si.competitors.forEach((c, i) => {
              _siLines.push('### Competitor ' + (i + 1) + ' — ' + c.url);
              _siLines.push('- Title: "' + c.title + '"');
              if (c.meta_description) _siLines.push('- Meta: "' + (c.meta_description || '').slice(0, 160) + '"');
              if (c.h1) _siLines.push('- H1: "' + c.h1 + '"');
              if (c.h2s && c.h2s.length) _siLines.push('- H2s: ' + c.h2s.slice(0, 12).join(' | '));
              if (c.fetch_ok) {
                _siLines.push('- Words: ~' + c.word_count + (c.kw_count !== undefined ? ' | Keyword "' + _siKw + '" appears ' + c.kw_count + 'x (' + (c.kw_density || 0) + '%)' : ''));
              }
            });
            const _siDir = _si.directives || {};
            _siLines.push('\n### GAP DIRECTIVES — follow these exactly:');
            _siLines.push('WORD COUNT: Write minimum ' + (_siDir.word_count_target || Math.round(Math.max(..._si.competitors.filter(c => c.fetch_ok).map(c => c.word_count || 0)) * 1.05) || 1500) + ' words.');
            if (_siDir.avg_kw_density > 0) {
              if (_siDir.avg_kw_density > 1.5) {
                _siLines.push('KEYWORD DENSITY: Competitors avg ' + _siDir.avg_kw_density + '% — target ~' + _siDir.avg_kw_density + '%, do NOT exceed ' + (_siDir.density_ceiling || _siDir.avg_kw_density + 0.5) + '%.');
              } else {
                _siLines.push('KEYWORD DENSITY: Competitors avg ' + _siDir.avg_kw_density + '% — target a similar density.');
              }
            }
            if (_siDir.all_competitor_h2s && _siDir.all_competitor_h2s.length) {
              _siLines.push('H2 COVERAGE: Cover or exceed these competitor topics: ' + _siDir.all_competitor_h2s.slice(0, 15).join(' | '));
            }
            serpBriefBlock = _siLines.join('\n');
          }

          // ── PAGE TYPE ROUTING — three specialised templates ──
          let sysPrompt, prompt;

          if (isService) {
            // ── TEMPLATE 1: SERVICE / LOCATION / INDUSTRY ─────────────────
            sysPrompt = 'You are a senior CRO + SEO strategist. You write conversion-optimised page briefs for service businesses. '
              + 'CRO and SEO are equally important. Every section must serve both search intent AND move the reader toward the primary CTA. '
              + 'Be specific, direct, no generic advice. Canadian spelling.';

            prompt = '## PAGE\n'
              + 'Name: ' + p.page_name + '\n'
              + 'URL: /' + p.slug + '\n'
              + 'Type: ' + p.page_type + ' | Action: ' + (p.action || 'build_new') + '\n'
              + (p.existing_traffic ? 'Existing traffic: ' + p.existing_traffic + '/mo\n' : '')
              + '\n## BUSINESS CONTEXT\n' + ctxBusiness
              + ctxPositioning + ctxCompCounter
              + (_webStrat ? '\n\n## WEBSITE STRATEGY\n' + _webStrat : '')
              + (_pageCtx ? '\n\n## PAGE-SPECIFIC CONTEXT\n' + _pageCtx : '')
              + (_pageGoal ? '\n\n## PAGE GOAL (this is the strategic purpose — every section of the brief must serve this goal)\n' + _pageGoal : '')
              + ctxProof + ctxCTA + ctxServicesDetail
              + ctxSubtraction + ctxEconomics
              + '\n\n## AUDIENCE\n' + ctxAudience
              + '\n\n## KEYWORDS\n' + ctxKeywords
              + '\n\n## QUESTIONS THIS PAGE MUST ANSWER\n' + ctxQuestions
              + '\n\n## INTERNAL LINK OPPORTUNITIES\n' + ctxInternalLinks
              + '\n\n## COMPETITORS TO BEAT\n' + ctxCompetitors
              + (serpBriefBlock ? '\n\n## SERP INTEL\n' + serpBriefBlock : '')
              + '\n\n---\n'
              + '## BRIEF OUTPUT — write each section:\n\n'
              + '### 1. READER PROFILE\n'
              + 'Who is landing on this page, from what search, at what awareness stage? '
              + 'What specific fear or desire brings them here? (2-3 sentences — be a real person, not a persona category)\n\n'
              + '### 2. UNIQUE ANGLE\n'
              + 'What does this page say that the top 3 SERP results do NOT say? '
              + 'What proof, claim, or POV makes this worth clicking over the rest? (1-2 sentences, specific)\n\n'
              + '### 3. H1 + TITLE TAG\n'
              + 'Recommended H1 (primary keyword in first 3 words). '
              + 'Title tag variation under 60 chars (optimised for CTR).\n\n'
              + '### 4. CONVERSION ARCHITECTURE\n'
              + 'Primary CTA (exact label + placement: hero / post-intro / sticky / end). '
              + 'Secondary CTA if needed. '
              + 'Primary objection this page must overcome. '
              + 'Trust signals required (e.g. testimonial, case study, guarantee, logo bar) and where each appears.\n\n'
              + '### 5. PAGE STRUCTURE (H2 SKELETON)\n'
              + 'List 5-10 H2 sections in order. Each H2 should serve both a search intent signal AND a conversion micro-step. '
              + 'Note the purpose of each section in brackets (e.g. [builds trust], [removes objection], [CTA]).\n\n'
              + '### 6. KEYWORD INTEGRATION NOTES\n'
              + 'Where and how often to use the primary keyword. Where to place each supporting keyword. '
              + 'Which entity terms must appear for topical authority.\n\n'
              + '### 7. FAQ SECTION (H3s)\n'
              + 'Use the assigned questions verbatim as H3s. For each, note the answer angle (1 line — not the answer, the direction).\n\n'
              + '### 8. INTERNAL LINKS\n'
              + 'Which 3-5 pages from the internal link list should this page link to, and with what anchor text? '
              + 'Which pages should link TO this page?\n\n'
              + '### 9. WORD COUNT + FORMAT TARGET\n'
              + 'Target word count (justify from intent + page type). '
              + 'Recommended content format (e.g. service landing page with proof blocks, not a listicle).\n\n'
              + '### 10. E-E-A-T INPUTS REQUIRED\n'
              + 'What proof must appear on this page to be credible? '
              + '(e.g. specific case study result, stat, team credential, guarantee). '
              + 'Flag if any of this is missing from what you know about the client.\n';

          } else if (isBlog) {
            // ── TEMPLATE 2: BLOG / FAQ / RESOURCE ────────────────────────
            sysPrompt = 'You are a senior content strategist and SEO specialist. You write editorial briefs for blog posts and resource pages. '
              + 'E-E-A-T signals, unique insight, and backlink potential are your top priorities alongside search intent match. '
              + 'Never produce a brief that would result in generic AI-flavoured content. Push for real expertise and original angles. '
              + 'Canadian spelling.';

            prompt = '## PAGE\n'
              + 'Name: ' + p.page_name + '\n'
              + 'URL: /' + p.slug + '\n'
              + 'Type: blog/resource | Action: ' + (p.action || 'build_new') + '\n'
              + (p.existing_traffic ? 'Existing traffic: ' + p.existing_traffic + '/mo\n' : '')
              + '\n## BUSINESS CONTEXT\n' + ctxBusiness
              + ctxPositioning + ctxCompCounter
              + (_pageGoal ? '\n\n## PAGE GOAL (this is the strategic purpose — the entire brief must serve this goal)\n' + _pageGoal : '')
              + ctxProof + ctxCTA
              + '\n\n## AUDIENCE\n' + ctxAudience
              + '\n\n## KEYWORDS\n' + ctxKeywords
              + '\n\n## QUESTIONS THIS PAGE MUST ANSWER\n' + ctxQuestions
              + '\n\n## INTERNAL LINK OPPORTUNITIES\n' + ctxInternalLinks
              + (serpBriefBlock ? '\n\n## SERP INTEL\n' + serpBriefBlock : '')
              + '\n\n---\n'
              + '## BRIEF OUTPUT — write each section:\n\n'
              + '### 1. READER PROFILE + AWARENESS STAGE\n'
              + 'Who is searching this, what do they already know, what are they hoping to learn or resolve? '
              + 'What makes them click this over the top result? (2-3 sentences)\n\n'
              + '### 2. UNIQUE ANGLE + CONTRARIAN HOOK\n'
              + 'What does this article say or show that the existing top results do NOT? '
              + 'Is there a contrarian position, proprietary framework, or insider take this business can credibly make? '
              + '(Specific — not "bring a fresh perspective")\n\n'
              + '### 3. HEADLINE OPTIONS\n'
              + 'H1 option (primary keyword in first 3 words, promise-led). '
              + 'Title tag variation under 60 chars. '
              + 'One curiosity-gap alternative headline.\n\n'
              + '### 4. ARTICLE STRUCTURE (H2 SKELETON)\n'
              + 'List 6-12 H2 sections in reading order. '
              + 'Flow must resolve search intent start to finish — reader should feel the article answered their question completely. '
              + 'Note where pull quotes, data callouts, or tables would live.\n\n'
              + '### 5. INTRO REQUIREMENTS\n'
              + 'Primary keyword placement (first 120 words). '
              + 'Hook approach (stat, counterintuitive claim, story, problem statement). '
              + 'What promise does the intro make to the reader?\n\n'
              + '### 6. E-E-A-T INPUTS\n'
              + 'What real experience, data, or proof must appear in this article to be credible? '
              + 'Specific sections where case study, stat, or first-person experience should be injected. '
              + 'Is an expert quote or external source citation needed, and on what claim?\n\n'
              + '### 7. BACKLINK POTENTIAL INPUTS\n'
              + 'What stat, framework, visual, or original research in this article would make other sites want to link to it? '
              + 'Be specific about what to include (e.g. "a comparison table of X vs Y that does not exist anywhere else").\n\n'
              + '### 8. FAQ SECTION (H3s)\n'
              + 'Use assigned questions verbatim as H3s. Note the answer angle for each (1 line).\n\n'
              + '### 9. INTERNAL LINKS + SOFT CTA\n'
              + 'Which 3-5 internal pages should this link to, and where/why? '
              + 'What soft CTA fits at the end (not pushy — this is an info page)?\n\n'
              + '### 10. WORD COUNT + SKIMMABILITY FORMAT\n'
              + 'Target word count. Required skimmability elements (bullets, table, TL;DR box, pull quote, summary section). '
              + 'Reading time estimate.\n';

          } else {
            // ── TEMPLATE 3: HOME / ABOUT / UTILITY ───────────────────────
            sysPrompt = 'You are a senior brand strategist and conversion copywriter. '
              + 'You write briefs for homepage, about, and utility pages where brand voice and trust signals drive performance. '
              + 'Search intent must be matched but these pages are also heavy brand touchpoints. '
              + 'Canadian spelling.';

            prompt = '## PAGE\n'
              + 'Name: ' + p.page_name + '\n'
              + 'URL: /' + p.slug + '\n'
              + 'Type: ' + p.page_type + ' | Action: ' + (p.action || 'build_new') + '\n'
              + (p.existing_traffic ? 'Existing traffic: ' + p.existing_traffic + '/mo\n' : '')
              + '\n## BUSINESS CONTEXT\n' + ctxBusiness
              + ctxPositioning + ctxCompCounter
              + (_pageGoal ? '\n\n## PAGE GOAL (this is the strategic purpose — the entire brief must serve this goal)\n' + _pageGoal : '')
              + ctxProof + ctxCTA + ctxServicesDetail
              + ctxSubtraction + ctxEconomics
              + '\n\n## AUDIENCE\n' + ctxAudience
              + '\n\n## KEYWORDS\n' + ctxKeywords
              + '\n\n## QUESTIONS THIS PAGE MUST ANSWER\n' + ctxQuestions
              + '\n\n## COMPETITORS\n' + ctxCompetitors
              + (serpBriefBlock ? '\n\n## SERP INTEL\n' + serpBriefBlock : '')
              + '\n\n---\n'
              + '## BRIEF OUTPUT — write each section:\n\n'
              + '### 1. PAGE PURPOSE + SEARCH INTENT\n'
              + 'What is this page\'s primary job? Who lands here and from where (organic, direct, referral)? '
              + 'What do they need to feel/know/do within 5 seconds of landing?\n\n'
              + '### 2. BRAND VOICE DIRECTION\n'
              + 'Specific tone instructions for this page (e.g. "warm and direct, not corporate"). '
              + 'Words/phrases to use. Words to avoid. One sentence that captures the voice this page should feel like.\n\n'
              + '### 3. H1 + ABOVE-FOLD CONTENT\n'
              + 'Recommended H1. What goes above the fold: headline, subheadline, CTA, visual direction.\n\n'
              + '### 4. PAGE STRUCTURE (H2 SKELETON)\n'
              + 'Section list in order. For home/about pages this is lighter (4-7 sections). '
              + 'Each section note: what trust signal or brand story moment lives here.\n\n'
              + '### 5. TRUST SIGNAL REQUIREMENTS\n'
              + 'Exactly which trust signals must appear and where: '
              + 'testimonials, case study callouts, awards, team credentials, client logos, guarantees, stats. '
              + 'Flag any that are missing from what you know about the client.\n\n'
              + '### 6. CTA ARCHITECTURE\n'
              + 'Primary CTA (what, where, what copy). Secondary CTA if needed. '
              + 'What objection must be removed before a visitor will take action?\n\n'
              + '### 7. KEYWORD + INTENT INTEGRATION\n'
              + 'How to work the primary keyword in naturally without making it feel like an SEO page. '
              + 'For about/team pages: how to integrate expertise signals for E-E-A-T without sounding like a CV.\n\n'
              + '### 8. WORD COUNT + FORMAT\n'
              + 'Target word count (home/about pages are shorter — justify). '
              + 'Format: landing page blocks, narrative, hybrid?\n';
          }

          const briefText = await claudeCall(sysPrompt, prompt, 8000);

          // Write brief back to project (version-aware atomic write)
          // Re-read latest state to avoid clobbering concurrent saves
          const kvKey = userPrefix + 'project:' + projectId;
          const freshRaw = await env.SETSAIL_OS.get(kvKey);
          const freshS = freshRaw ? JSON.parse(freshRaw) : S;
          if (freshS.pages?.[pageIdx]) {
            if (!freshS.pages[pageIdx].brief) freshS.pages[pageIdx].brief = {};
            freshS.pages[pageIdx].brief.generated = true;
            freshS.pages[pageIdx].brief.summary = briefText;
            freshS.pages[pageIdx].brief.generatedAt = Date.now();
            freshS.pages[pageIdx].updatedAt = Date.now();
          }
          freshS._version = (freshS._version || 0) + 1;
          await env.SETSAIL_OS.put(kvKey, JSON.stringify(freshS), {
            metadata: { name: setup.businessName || projectId, stage: freshS.currentStage || 'briefs', updatedAt: new Date().toISOString() }
          });
          await setStatus('done', { completedAt: Date.now() });

        } else if (type === 'copy') {
          // ── Copy generation — full prompt parity with client-side buildCopyPrompt() ──

          const P_COPY = 'You are a senior CRO copywriter and SEO specialist at Setsail Marketing. Write complete, conversion-optimised page copy following this exact structure:\n\n1. HERO — H1 with primary keyword exact match. Outcome-first subheadline (what the client gets, not what we do). Single primary CTA button above the fold. One supporting trust signal (e.g. award, review rating, years in business).\n2. SOCIAL PROOF STRIP — logos or stat bar (3–5 credibility signals, use realistic placeholders like "[Client Logo]" or "★★★★★ 4.9/5 from 28 reviews").\n3. PROBLEM/AGITATION — 2–3 short paragraphs naming the pain the audience feels. Make them feel understood before offering a solution.\n4. SOLUTION BRIDGE — how the service/product solves exactly that problem. Outcome ownership framing, not activity-based.\n5. SERVICES / WHAT\'S INCLUDED — H2 with supporting keyword. 3–6 service cards or feature list with benefit-led descriptions (not feature lists).\n6. PROCESS — 3–5 numbered steps showing how it works. Reduces friction and eliminates "what happens next?" anxiety.\n7. PROOF SECTION — 2–3 case study or testimonial placeholders with specific results (e.g. "[Company X] increased leads by 47% in 90 days — [Name, Title]").\n8. OBJECTION HANDLING — 3–5 short "You might be thinking..." callout blocks that pre-empt the top buying objections.\n9. FAQ — minimum 8 questions. Target long-tail keyword phrases. Answer concisely and naturally.\n10. FINAL CTA SECTION — restate the outcome, repeat the primary CTA, add a low-commitment secondary option (e.g. "Book a free audit" vs "Call us").\n\nSEO RULES: H1 = primary keyword verbatim. First paragraph includes primary keyword. H2s use supporting keywords naturally. Internal link placeholders where relevant.\nCRO RULES: Every section must earn the scroll. No filler copy. Lead with outcomes not activities. Canadian spelling. Direct, confident tone.\nOUTPUT: Clean semantic HTML only. Use section/article/h1/h2/h3/p/ul/li/blockquote. No html/head/body/style tags. Wrap in <div class="page-copy">. CRITICAL: Write the COMPLETE page — all 10 sections — without truncating or stopping early. FAQ must include all 8+ questions. Output the entire page in one response.';

          // ── Strategy context variables (mirrors brief consumer pattern) ──
          const kws = (p.supporting_keywords || []).map(k => typeof k === 'object' ? (k.kw || '') : String(k)).filter(Boolean).join(', ');
          const _wVp = (ST.positioning && ST.positioning.value_proposition) || R.value_proposition || '';
          const _wKd = (ST.positioning && ST.positioning.key_differentiators) || R.key_differentiators || [];
          const _wBv = (ST.brand_strategy && ST.brand_strategy.voice_style) || R.brand_voice_style || '';
          const _wTv = (ST.brand_strategy && ST.brand_strategy.tone_and_voice) || R.tone_and_voice || '';
          const _wSl = R.current_slogan || R.slogan_or_tagline || '';
          const _wWa = (ST.brand_strategy && ST.brand_strategy.words_to_avoid) || R.words_to_avoid || [];
          const _wWu = (ST.brand_strategy && ST.brand_strategy.words_to_use) || R.words_to_use || [];
          const _wPn = R.current_pricing || R.pricing_notes || '';
          const _wPcta = (ST.positioning && ST.positioning.primary_cta) || R.primary_cta || '';
          const _wSctas = (ST.positioning && ST.positioning.secondary_ctas) || (ST.positioning && ST.positioning.secondary_cta) || R.secondary_cta || '';
          const _wScta = Array.isArray(_wSctas) ? _wSctas.join(', ') : (_wSctas || '');
          const _wLcta = (ST.positioning && ST.positioning.low_commitment_cta) || R.low_commitment_cta || '';
          const _pageGeo = p.targetGeo || (R.geography && R.geography.primary) || setup.geo || '';
          const _voice = _wTv || _wBv || setup.voice || 'Confident, direct. Canadian spelling.';
          const clientName = R.client_name || setup.client_name || setup.client || 'Unknown';

          // Voice overlay
          const _voiceOverlay = p.voice_overlay || 'base';
          let _voiceBlock = '';
          if (_voiceOverlay !== 'base' && ST.brand_strategy && ST.brand_strategy.voice_overlays && ST.brand_strategy.voice_overlays[_voiceOverlay]) {
            const _overlay = ST.brand_strategy.voice_overlays[_voiceOverlay];
            _voiceBlock = '\n\nVOICE OVERLAY (' + _voiceOverlay + '): ' + (typeof _overlay === 'string' ? _overlay : JSON.stringify(_overlay)) + '\nThese overlay rules supplement the base voice rules above. Both apply.';
          }

          // Persona context
          const _personas = (ST.audience && ST.audience.personas) || [];
          let _personaBlock = '';
          if (p.target_persona && _personas.length) {
            const _matchedPersona = _personas.find(per => per.name === p.target_persona);
            if (_matchedPersona) {
              const _pp = ['TARGET PERSONA: ' + _matchedPersona.name];
              if (_matchedPersona.role) _pp.push('Role: ' + _matchedPersona.role);
              if (_matchedPersona.frustrations && _matchedPersona.frustrations.length) _pp.push('Pains: ' + _matchedPersona.frustrations.slice(0, 3).join('; '));
              if (_matchedPersona.objection_profile && _matchedPersona.objection_profile.length) _pp.push('Objections: ' + _matchedPersona.objection_profile.slice(0, 2).join('; '));
              if (_matchedPersona.decision_criteria && _matchedPersona.decision_criteria.length) _pp.push('Evaluates: ' + _matchedPersona.decision_criteria.slice(0, 3).join('; '));
              if (_matchedPersona.language_patterns && _matchedPersona.language_patterns.length) _pp.push('Their language: ' + _matchedPersona.language_patterns.slice(0, 2).join('; '));
              _pp.push('Write copy that speaks directly to this persona. Problem/Agitation must reference their specific pains. Objection Handling must address their stated objections.');
              _personaBlock = '\n\n' + _pp.join('\n');
            }
          } else if ((p.page_type === 'home' || p.page_type === 'about') && _personas.length) {
            const _parked = (ST.audience && ST.audience.parked_segments) || [];
            const _activePers = _personas.filter(per => !_parked.some(ps => per.segment && ps.toLowerCase() === per.segment.toLowerCase()));
            if (_activePers.length) {
              const _mpp = ['TARGET AUDIENCES (this page serves multiple personas):'];
              _activePers.slice(0, 3).forEach(per => {
                _mpp.push('- ' + per.name + (per.frustrations && per.frustrations[0] ? ': pain = ' + per.frustrations[0] : ''));
              });
              _mpp.push('Copy must resonate with all listed personas.');
              _personaBlock = '\n\n' + _mpp.join('\n');
            }
          } else if (p.page_type === 'blog' && _personas.length) {
            const _parked2 = (ST.audience && ST.audience.parked_segments) || [];
            const _activePers2 = _personas.filter(per => !_parked2.some(ps => per.segment && ps.toLowerCase() === per.segment.toLowerCase()));
            if (_activePers2.length) {
              const _bpp = ['TARGET AUDIENCE (blog readers):'];
              _activePers2.slice(0, 2).forEach(per => {
                _bpp.push('- ' + per.name + (per.frustrations && per.frustrations[0] ? ': pain = ' + per.frustrations[0] : ''));
              });
              _personaBlock = '\n\n' + _bpp.join('\n');
            }
          }

          // Positioning direction
          let _posDirBlock = '';
          if (ST.positioning && ST.positioning.selected_direction) {
            const _dir = ST.positioning.selected_direction;
            _posDirBlock = '\n\nPOSITIONING DIRECTION: ' + (_dir.direction || _dir.name || '') + ((_dir.headline || _dir.thesis) ? '\nHeadline: ' + (_dir.headline || _dir.thesis) : '') + (_dir.rationale ? '\nRationale: ' + _dir.rationale : '') + '\nAll copy must reinforce this positioning. Weave into H1 subheadline, Solution Bridge, and CTA framing.';
          }

          // Content pillar guidance (blog)
          let _pillarBlock = '';
          if (p.content_pillar) {
            const _pgMap = {
              'thought leadership': 'Take a strong position. Lead with original insight, not common knowledge.',
              'case study': 'Narrative: situation, challenge, approach, results, takeaway. Use specific numbers.',
              'decision content': 'Help the reader choose. Compare options, then guide toward a conclusion. Late-funnel.',
              'vertical deep-dive': 'Speak the vertical language. Reference industry challenges, regulations, benchmarks.',
              'performance marketing': 'Data-first. Show methodology, not just results.'
            };
            _pillarBlock = '\nCONTENT PILLAR: ' + p.content_pillar;
            const _cpLower = p.content_pillar.toLowerCase();
            for (const k of Object.keys(_pgMap)) {
              if (_cpLower.indexOf(k) >= 0) { _pillarBlock += '\nPILLAR GUIDANCE: ' + _pgMap[k]; break; }
            }
          }

          // Proof & E-E-A-T
          const _proofLines = [];
          if ((R.case_studies || []).length) _proofLines.push('Case studies: ' + R.case_studies.slice(0, 4).map(cs => (cs.client || 'Client') + ' — ' + (cs.result || 'result') + (cs.timeframe ? ' (' + cs.timeframe + ')' : '')).join('; '));
          if ((R.notable_clients || []).length) _proofLines.push('Notable clients: ' + R.notable_clients.slice(0, 6).join(', '));
          if ((R.awards_certifications || []).length) _proofLines.push('Awards/certs: ' + R.awards_certifications.slice(0, 4).join(', '));
          if (R.team_credentials) _proofLines.push('Team credentials: ' + R.team_credentials);
          if (R.founder_bio) _proofLines.push('Founder: ' + R.founder_bio);
          const cpProofBlock = _proofLines.length ? '\n\n## PROOF & E-E-A-T SIGNALS (use these as real data in copy — never invent)\n' + _proofLines.join('\n') : '';

          // CTA architecture
          const _ctaLines = [];
          if (_wPcta) _ctaLines.push('Primary CTA: ' + _wPcta);
          if (_wScta) _ctaLines.push('Secondary CTA: ' + _wScta);
          if (_wLcta) _ctaLines.push('Low-commitment CTA: ' + _wLcta);
          const cpCtaBlock = _ctaLines.length ? '\n\n## CTA ARCHITECTURE\n' + _ctaLines.join('\n') : '';

          // Subtraction context (non-blog only)
          const isBlog = /^(blog|faq|resource)$/i.test(p.page_type || '');
          let _subBlock = '';
          if (!isBlog && ST.subtraction) {
            const _subAudit = ST.subtraction.current_activities_audit || ST.subtraction.verdicts || (Array.isArray(ST.subtraction) ? ST.subtraction : []);
            const _subStops = _subAudit.filter(v => v.verdict === 'cut' || v.verdict === 'stop' || v.verdict === 'restructure').slice(0, 3);
            if (_subStops.length) {
              const _subLines = ['SUBTRACTION INSIGHTS (use as differentiated messaging angle):'];
              _subStops.forEach(v => {
                _subLines.push('- ' + (v.verdict === 'cut' || v.verdict === 'stop' ? 'CUT' : 'RESTRUCTURE') + ': ' + (v.activity || v.name || '') + (v.reason || v.rationale ? ' — ' + (v.reason || v.rationale) : ''));
              });
              if (ST.subtraction.total_recoverable_monthly) _subLines.push('Recoverable budget: $' + ST.subtraction.total_recoverable_monthly + '/mo');
              _subLines.push('Frame as: "Most agencies add more. We found waste first."');
              _subBlock = '\n\n' + _subLines.join('\n');
            }
          }

          // Economics context (non-blog only)
          let _econBlock = '';
          if (!isBlog && ST.unit_economics) {
            const _ue = ST.unit_economics;
            const _econLines = [];
            if (ST.channel_strategy && ST.channel_strategy.budget_tiers && ST.channel_strategy.budget_tiers.current_budget && ST.channel_strategy.budget_tiers.current_budget.label) {
              _econLines.push('Budget tier: ' + ST.channel_strategy.budget_tiers.current_budget.label);
            }
            if (_ue.monthly_leads_target) _econLines.push('Lead target: ' + _ue.monthly_leads_target + '/mo');
            if (_ue.ltv && _ue.cac && parseFloat(_ue.cac) > 0) {
              _econLines.push('LTV:CAC: ' + (parseFloat(_ue.ltv) / parseFloat(_ue.cac)).toFixed(1) + 'x');
            }
            if (_econLines.length) {
              let _posture = '';
              if (_ue.monthly_leads_target && parseFloat(_ue.monthly_leads_target) < 30) _posture = 'Volume-constrained — minimise CTA friction, every lead matters.';
              else if (_ue.monthly_leads_target && parseFloat(_ue.monthly_leads_target) >= 100) _posture = 'Volume-sufficient — CTAs can qualify and filter low-intent leads.';
              if (_posture) _econLines.push('CTA posture: ' + _posture);
              _econBlock = '\n\nECONOMICS CONTEXT (calibrate CTA aggressiveness):\n' + _econLines.join('\n');
            }
          }

          // Competitive counter (non-blog only)
          let _compCounter = '';
          if (!isBlog && ST.positioning) {
            if (ST.positioning.competitive_counter) _compCounter += '\nCOMPETITIVE COUNTER: ' + ST.positioning.competitive_counter + '\nUse in Objection Handling or Solution Bridge. Do NOT name competitors directly.';
            if (ST.positioning.validated_differentiators && ST.positioning.validated_differentiators.length) {
              _compCounter += '\nValidated differentiators: ' + ST.positioning.validated_differentiators.slice(0, 4).join('; ');
            }
          }

          // FAQ targets
          const questionsBlock = (p.assignedQuestions || []).length
            ? '\nFAQ TARGETS (must appear as H3 questions in FAQ section):\n- ' + (p.assignedQuestions || []).join('\n- ')
            : '';

          // Brief block
          const hasBrief = !!(p.brief && p.brief.approved && p.brief.summary && p.brief.summary.trim().length > 50);
          const briefBlock = hasBrief
            ? '\n\n## APPROVED CONTENT BRIEF\nThis brief has been reviewed and approved. Follow its H2 structure, CTA architecture, word count target, FAQ questions, and E-E-A-T inputs precisely. Do not invent a different structure.\n\n' + p.brief.summary + '\n\n## END OF BRIEF'
            : '';
          const briefInstruction = hasBrief
            ? 'Follow the approved brief above. Write complete page HTML matching the brief H1, H2 structure, CTA positions, word count, objections, trust signals, FAQ questions, and E-E-A-T inputs exactly. Use the business context fields above for the actual copy content. No <html>/<head>/<body> tags.'
            : 'Write the complete page. No <html>/<head>/<body> tags. Canadian spelling.';
          const blogBriefInstruction = hasBrief
            ? 'Follow the approved brief above. Write the complete blog post in HTML matching the structure, unique angle, word count, and FAQ questions specified. No <html>/<head>/<body> tags. Canadian spelling.'
            : 'Write a complete, SEO-optimised blog post in HTML. Structure: H1 title, engaging introduction (2-3 sentences), 3-5 H2 sections with substantive body copy, a conclusion paragraph with a CTA linking back to the client\'s services. Do not include <html>, <head>, or <body> tags. Canadian spelling throughout.';

          // SERP Intel block (inline since buildSerpIntelBlock is not available in worker)
          let serpBlock = '';
          if (p.serpIntel && p.serpIntel.competitors && p.serpIntel.competitors.length) {
            const si = p.serpIntel;
            serpBlock = '\n\n## SERP INTEL — "' + (p.primary_keyword || '') + '"\n';
            si.competitors.forEach((c, i) => {
              serpBlock += '### Competitor ' + (i + 1) + ' — ' + c.url + '\n';
              serpBlock += '- Title: "' + c.title + '"\n';
              if (c.meta_description) serpBlock += '- Meta: "' + c.meta_description.slice(0, 160) + '"\n';
              if (c.h1) serpBlock += '- H1: "' + c.h1 + '"\n';
              if (c.h2s && c.h2s.length) serpBlock += '- H2s: ' + c.h2s.slice(0, 12).join(' | ') + '\n';
              if (c.fetch_ok) serpBlock += '- Words: ~' + c.word_count + ' | KW density: ' + c.kw_density + '%\n';
            });
            const d = si.directives || {};
            if (d.word_count_target) serpBlock += '\nTarget word count: ' + d.word_count_target + ' (max × 1.05)\n';
          }

          // Web strategy
          const _webStrat = (ST.webStrategy || setup.webStrategy || '').trim();

          // ── Assemble user prompt — blog vs non-blog paths ──
          let copyPrompt;
          if (isBlog) {
            copyPrompt = 'CLIENT: ' + clientName
              + '\nBLOG POST TITLE: ' + (p.page_name || '')
              + '\nPRIMARY KEYWORD: ' + (p.primary_keyword || '')
              + '\nSUPPORTING KEYWORDS: ' + kws
              + '\nTARGET WORD COUNT: ' + (p.word_count_target || 1200)
              + '\nBUSINESS OVERVIEW: ' + (R.business_overview || '')
              + '\nGEOGRAPHY: ' + _pageGeo
              + '\nVOICE: ' + _voice
              + (_pillarBlock ? _pillarBlock : '')
              + (_wSl ? '\nSLOGAN: ' + _wSl : '')
              + (_wWa.length ? '\nWORDS TO AVOID: ' + _wWa.join(', ') : '')
              + (_posDirBlock ? _posDirBlock : '')
              + _personaBlock
              + '\nNOTES: ' + (p.notes || '')
              + questionsBlock + briefBlock + serpBlock
              + cpProofBlock + cpCtaBlock
              + (_webStrat ? '\n\n## WEBSITE STRATEGY\n' + _webStrat : '')
              + (p.pageContext ? '\n\n## PAGE-SPECIFIC CONTEXT\n' + p.pageContext : '')
              + (p.page_goal ? '\n\n## PAGE GOAL (every section of copy must serve this strategic purpose)\n' + p.page_goal : '')
              + '\n\n' + blogBriefInstruction;
          } else {
            copyPrompt = 'CLIENT: ' + clientName
              + '\nPAGE: ' + (p.page_name || '') + ' | /' + slug
              + '\nPRIMARY KW: ' + (p.primary_keyword || '')
              + '\nSUPPORTING: ' + kws
              + '\nINTENT: ' + (p.search_intent || '')
              + '\nWORD COUNT MIN: ' + (p.word_count_target || 1500)
              + '\nOVERVIEW: ' + (R.business_overview || '')
              + '\nVALUE PROP: ' + _wVp
              + '\nDIFFERENTIATORS: ' + (_wKd.length ? _wKd.join('. ') : '')
              + '\nGEOGRAPHY: ' + _pageGeo
              + '\nPRICING: ' + (setup.pricing || _wPn || '')
              + '\nVOICE: ' + _voice
              + (_wSl ? '\nSLOGAN: ' + _wSl : '')
              + (_wWa.length ? '\nWORDS TO AVOID: ' + _wWa.join(', ') : '')
              + (_wWu.length ? '\nWORDS TO USE: ' + _wWu.join(', ') : '')
              + (_posDirBlock ? _posDirBlock : '')
              + _voiceBlock
              + (((R.pain_points_top5 || []).length) ? '\nAUDIENCE PAIN POINTS: ' + (R.pain_points_top5 || []).slice(0, 3).join('; ') : '')
              + (((R.objections_top5 || []).length) ? '\nBUYER OBJECTIONS: ' + (R.objections_top5 || []).slice(0, 3).join('; ') : '')
              + (((R.existing_proof || R.proof_points || []).length) ? '\nPROOF POINTS: ' + (R.existing_proof || R.proof_points || []).slice(0, 3).join('; ') : '')
              + ((R.booking_flow_description) ? '\nBOOKING FLOW: ' + R.booking_flow_description : '')
              + _personaBlock
              + _subBlock
              + _econBlock
              + _compCounter
              + '\nNOTES: ' + (p.notes || '')
              + questionsBlock + briefBlock + serpBlock
              + cpProofBlock + cpCtaBlock
              + (_webStrat ? '\n\n## WEBSITE STRATEGY\n' + _webStrat : '')
              + (p.pageContext ? '\n\n## PAGE-SPECIFIC CONTEXT\n' + p.pageContext : '')
              + (p.page_goal ? '\n\n## PAGE GOAL (every section of copy must serve this strategic purpose)\n' + p.page_goal : '')
              + '\n\n' + briefInstruction;
          }

          const copyHtml = await claudeCall(P_COPY, copyPrompt, 6000);

          // Save copy to its own KV key (same pattern as client copy.js)
          const copyKey = userPrefix + 'copy:' + projectId + ':' + slug;
          const existing = await env.SETSAIL_OS.get(copyKey);
          const existingData = existing ? JSON.parse(existing) : {};
          const drafts = existingData.drafts || [];
          drafts.push({ v: drafts.length + 1, html: copyHtml, pass: 1, generatedAt: Date.now() });
          await env.SETSAIL_OS.put(copyKey, JSON.stringify({ ...existingData, copy: copyHtml, drafts, activeDraft: drafts.length - 1, writtenAt: Date.now(), page: p }));
          await setStatus('done', { completedAt: Date.now() });
        }

        msg.ack();

      } catch (err) {
        if (err instanceof RateLimitError || err.message?.includes('rate') || err.message?.includes('529')) {
          // Let queue retry automatically (don't ack)
          await setStatus('queued', { retryReason: err.message });
          msg.retry({ delaySeconds: 30 });
        } else {
          await setStatus('failed', { error: err.message });
          msg.ack();
        }
      }
    }
  },
};
