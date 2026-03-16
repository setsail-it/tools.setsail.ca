# SetSailOS — Developer Guide

## What This Is

SetSailOS is Setsail Marketing's internal AI-powered website build pipeline. It is a single-page application that takes a client engagement from initial intake through to a fully export-ready website — producing audience intelligence, competitive strategy, keyword research, page architecture, SEO briefs, full copy, wireframes, structured data, and image assets across 11 sequential stages.

**The 11-stage pipeline:**

1. **Setup** — Client name, URL, primary market, industry, uploaded strategy docs, discovery notes, sales qualification, competitor URLs
2. **Snapshot** — Automated domain authority pull (Ahrefs via DataForSEO), backlink count, top organic pages, competitor DA comparison
3. **Research** — AI-enriched factual data collection across 5 tabs (Business, Audience, Brand, Schema/Local, Competitors) with completeness scorecard, field-level source badges, and unit economics inputs
4. **Strategy** — The strategy engine: 8 AI diagnostics (D0–D7), scoring engine with anti-inflation caps, positioning direction system, budget-tier channel allocation, audience intelligence, sensitivity analysis, demand validation, interactive Gantt timeline, compiled 15-section strategy document, and Pricing Engine integration (live service costs, package tier matching, investment summary, internal margin analysis)
5. **Sitemap** — Page architecture with keyword-to-page mapping, strategy alignment columns, content pillar tags, persona assignment per page, voice overlay assignment, positioning direction gap detection, CTA landing page gap detection, persona coverage check panel, budget-tier-aware priority suggestions, market overrides, and active page import from Snapshot
6. **Briefs** — Per-page SEO briefs with SERP-calibrated targets, question injection, competitor context, version control (V1/V2), AI evaluation scorecards, positioning direction injection, subtraction messaging angles, economics-calibrated CTAs, competitive counter context, and persona alignment scoring
7. **Copy** — Full-page HTML generation from approved briefs with multi-pass audit (keyword density, intent match, Canadian spelling, AI fluff detection, persona alignment, positioning direction), human QC checklists with persona/positioning verification, positioning-aware meta tag generation, persona-prioritised E-E-A-T injection, content pillar guidance for blogs, and full worker queue parity
8. **Images** — AI image generation (Gemini) per page with prompt engineering and style controls
9. **Layout** — Wireframe generation with section-level structure and responsive grid suggestions
10. **Schema** — Structured data markup (JSON-LD) per page type with validation
11. **Export** — Final packaging of all assets for handoff to development

**Not a framework.** No React, no bundler, no build step. `worker.js` is the backend. `index.html` + external `.js` files are the frontend, served as static assets.

## Stack

| Layer | Tech |
|---|---|
| Hosting | Cloudflare Workers (Paid plan) |
| Storage | Cloudflare KV (`SETSAIL_OS`) + read-only `PRICING_KV` (Pricing Engine) |
| Queue | Cloudflare Queues (`setsailos-gen-queue`) |
| Auth | Cloudflare Access (Google SSO, `@setsail.ca`) + JWT validation |
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) via `/api/claude` proxy |
| Keyword data | DataForSEO REST API |
| Domain data | Ahrefs (via DataForSEO proxy) |
| Images | Gemini API (via `/api/generate-image`) |
| Frontend | Vanilla JS, Geist font, Tabler Icons |

## File Map

```
worker.js        — All backend API routes + queue consumer (~2682 lines)
index.html       — Shell + CSS + core JS (state, nav, save/load, AI bar) (~3249 lines)
strategy.js      — Stage 4: strategy engine + scoring + diagnostics + web strategy brief (~5961 lines)
keywords.js      — Keyword research (tab within Strategy stage) (~3072 lines)
sitemap.js       — Stage 5: sitemap generation + persona/voice/positioning integration (~2379 lines)
briefs.js        — Stage 6: brief generation + queue + strategy context integration (~1751 lines)
copy.js          — Stage 7: copy generation + audit + strategy context integration (~1367 lines)
research.js      — Stage 3: AI enrichment + field metadata + scorecard (~1523 lines)
layout.js        — Stage 9: wireframe generation (~558 lines)
images.js        — Stage 8: image generation (~490 lines)
schema.js        — Stage 10: schema markup (~260 lines)
prompts.js       — Shared AI prompt templates (~121 lines)
export.js        — Stage 11: export packaging (~76 lines)
wrangler.toml    — Cloudflare deployment config
.dev.vars        — Local dev secrets (gitignored)
```

## Architecture

### Frontend State

All app state lives in a single mutable global `S` object (index.html:691). Every stage file reads and writes to `S` directly. Changes trigger `scheduleSave()` which debounces (1500ms) then POSTs the full project to `/api/projects/:id`.

**Key `S` properties:**
- `S.projectId`, `S.stage` — current project and stage
- `S._version` — optimistic locking counter (incremented on each save)
- `S.setup` — client info, docs, voice, competitors, sales qualification
- `S.snapshot` — DataForSEO domain metrics
- `S.research` — AI-enriched research object (business, audience, brand, schema, competitors)
- `S.strategy` — strategy engine output (audience, positioning, unit economics, channels, brand, risks, targets, demand validation)
- `S.strategy.audience` — D0 output: segments, personas, buying motions, triggers, objections, parked segments
- `S.strategy.positioning` — D2 output: hypotheses, evaluations, selected direction, messaging, voice
- `S.strategy.unit_economics` — D1 output: CPL, CAC, LTV, sensitivity analysis, CPC intelligence
- `S.strategy.channel_strategy` — D4 output: lever scores, budget tiers, funnel coverage
- `S.pages[]` — sitemap pages with keywords, briefs, metadata, `target_persona`, `voice_overlay`
- `S.kwResearch` — seeds, keywords, clusters, selected
- `S.copy{}` — per-slug copy data (HTML stored in separate KV keys)
- `S.schema{}`, `S.layout{}`, `S.images{}` — per-slug stage data

### Backend (worker.js)

Single Cloudflare Worker handling all API routes via sequential `if` statements. Routes are grouped:
- **Auth routes:** `/api/whoami`, `/api/admin/users`
- **Project CRUD:** `/api/projects[/:id]`
- **AI proxy:** `/api/claude` (streaming), `/api/claude-sync` (non-streaming) — model-locked and token-capped
- **DataForSEO:** `/api/kw-expand`, `/api/paa`, `/api/niche-expand`, `/api/competitor-gap`, `/api/organic-competitors`, `/api/gmb`, `/api/serp-intel`, `/api/kw-debug`
- **Ahrefs:** `/api/snapshot`, `/api/ahrefs`
- **Queue:** `/api/queue-submit`, `/api/queue-status`
- **Image gen:** `/api/generate-image`
- **Per-slug storage:** `/api/copy/:projectId/:slug`, `/api/images/:projectId/:slug`

**Queue consumer** (`worker.queue()`): processes `brief` and `copy` job types. Loads project → fetches SERP data → calls Claude → writes back with version increment.

### Strategy Engine (strategy.js)

The strategy engine is the most complex subsystem. It runs 8 AI diagnostics sequentially, scores each section on three dimensions, and enforces anti-inflation caps to prevent score gaming.

**Diagnostic pipeline:**
- **D0 — Audience Intelligence:** Segments, personas (archetype labels, not fictional names), buying motions, purchase triggers, objection maps, vertical coverage (active + parked segments)
- **D1 — Unit Economics:** CPL, CAC, LTV, LTV:CAC ratio, sensitivity analysis (conservative/base/optimistic), CPC intelligence, paid viability
- **D2 — Competitive Position:** Positioning directions (never auto-selects), validated differentiators, messaging hierarchy, brand voice direction with vertical overlays
- **D3 — Subtraction Analysis:** Current activity audit with stop/keep/restructure verdicts, recoverable budget
- **D4 — Channel & Lever Viability:** 13 levers scored, three budget tiers (current/growth/optimal), funnel coverage analysis
- **D5 — Website & CRO:** Build type, CTAs, form strategy, page architecture, tracking requirements
- **D6 — Content & Authority:** DR gap analysis, content pillars (vertical-aware), publishing cadence, E-E-A-T strategy
- **D7 — Risk Assessment:** Risks with severity scores, mitigations, dependencies

**D0 runs first** (separate call before the D1–D7 loop). This is because D0=0 is falsy in JavaScript — all `if (diagNum)` checks must use `diagNum !== undefined && diagNum !== null` instead.

**Scoring engine:** Three dimensions per section:
- Data Completeness (35%) — are all required inputs present?
- Analytical Confidence (40%) — content depth + audit pass rate
- Specificity (25%) — is the output specific to this client?

**Section weights:** Positioning 18%, Channels 18%, Economics 14%, Subtraction 12%, Growth 12%, Audience 10%, Risks 10%, Execution 8%, Brand 8%. Sum is 1.10 — divided by `totalWeight` at runtime so a perfect score is still 10.0.

**Anti-inflation caps** prevent score gaming — e.g. no validated differentiators caps positioning confidence at 6, audience score below 5.0 caps overall at 6.0, first-pass scores above 7.0 trigger a warning.

**Positioning direction system:** Founder hypotheses → Evaluate Hypotheses (stress-tests against competitors/demand) → Select Direction → D2 generates full messaging. Without a selected direction, D2 generates competitive analysis but messaging fields are blocked with `direction_required: true`.

### Shared Helpers (worker.js, top of file)

These are defined once and used across all routes:
- `getLocationCode(country, fallback)` — maps country code → DataForSEO location code
- `getDFSCreds(env)` — returns base64-encoded DataForSEO credentials
- `fetchGoogleSuggest(term, gl)` — Google Autocomplete API
- `detectCountryFromGeo(geo)` — regex-based geo string → country code
- `EXCLUDED_DOMAINS` — domains to filter from competitor results
- `checkRateLimit(env, userId, group)` — KV-based sliding window rate limiter
- `getPricingCatalog(env)` — reads `global:pricing-catalog` from `PRICING_KV` (read-only, owned by Pricing Engine). Returns parsed catalog object or null. Schema: `catalog.services[]` (9 services with pricing ranges, margin targets, KPIs), `catalog.packages[]` (3 tiers: Starter/Growth/Scale), `catalog.marginTargets` (default 75%, per-category/service), `catalog.strategy` (Growth Diagnostic $750 credited on sign), `catalog.tracking` (Analytics setup $1,500-4,000). **Never write to PRICING_KV from SetSailOS.**

### Shared Helpers (index.html, available to all stage files)

- `esc(s)` — HTML-escape string
- `sanitiseHTML(html)` — DOMPurify strip for AI-generated HTML
- `detectCountry(geo)` / `detectCountryLower(geo)` — geo → country code
- `callClaude(system, user, onChunk, maxTokens, label)` — streaming Claude wrapper
- `scheduleSave()` / `saveProject()` — debounced project persistence
- `aiBarStart(label)` / `aiBarEnd()` / `aiBarNotify(msg, opts)` — AI progress bar
- `orderedPages()` — display-sorted page list
- `storePrompt(key, system, user, title, subtitle)` / `showPromptModal(key)` — prompt viewer
- `getStrategyField(stratPath, researchFallback)` — reads from `S.strategy` with automatic `S.research` fallback (defined in strategy.js, used by all downstream stages)
- `synthesiseWebStrategy()` — generates website strategy brief from completed strategy + research (defined in strategy.js, output stored in `S.strategy.webStrategy`)

## Security Model

- **Auth:** CF Access JWT validation (when `CF_ACCESS_TEAM_DOMAIN` env var is set) + email header fallback
- **Claude proxy:** model whitelist (`claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001`), max_tokens capped at 8192, payload sanitised
- **Rate limiting:** per-user sliding window — ai (60/5min), data (40/5min), queue (5/1min), image (20/5min)
- **XSS:** all AI-generated HTML sanitised via DOMPurify before innerHTML
- **KV isolation:** all user data prefixed `u:{email}:` — users cannot access each other's data
- **Queue security:** job types whitelisted, pageIdx validated, userPrefix re-derived in consumer
- **Optimistic locking:** `_version` counter prevents stale write clobbering between client and queue
- **Size monitoring:** server rejects >24MB saves (413), warns at 15MB+

## Critical Patterns — Never Break These

### Secrets — never read, log, or hardcode
Never read `.dev.vars`. Never print or log API keys. Never hardcode credentials in source. All secrets accessed via `env.VAR_NAME` in worker.js only. Frontend calls proxy routes — it never sees keys. See the **Secrets Management** section below for the full reference.

### D0 (Audience) is diagnostic number 0 — falsy in JavaScript
`diagNum === 0` is falsy. All checks must use `diagNum !== undefined && diagNum !== null` instead of `if (diagNum)`. This applies in: `scoreSection()` audit adjustment, `improveStrategy()` diagnostic selection, `renderStrategyTabContent()` tab routing, `_versionLearningCtx()` previous output lookup.

### String building in JS HTML
Always use `createElement` + `.onclick = fn`. Never string-concat onclick with IDs:
```js
// WRONG — nested quotes collapse at runtime
'<button onclick="fn(\'' + id + '\')">x</button>'
// RIGHT
var btn = document.createElement('button');
btn.onclick = function() { fn(id); };
```

### AI-generated HTML must use sanitiseHTML()
Never insert Claude/Gemini output via `innerHTML` without `sanitiseHTML()`. Check copy.js and layout.js for the pattern.

### Script tag placement
Never put inline JS inside `<script src="...">` — browsers ignore it. All JS goes in the main `<script>` block or its own file.

### Apostrophes in data-tip strings
These live inside single-quoted JS strings. Use full words: `do not`, `they have`, `it is`. Never `don't`, `they've`, `it's`.

### Tooltip system
- Content area buttons → `[data-tip]` CSS tooltip
- Nav bar elements → `_wireAiFloatTip()` JS floating div
- **Never** `[data-tip]` on nav elements (overflow clips `::after`)

### Stacking contexts
Nav has `z-index:600` creating a stacking context. Never remove `z-index` from `#nav`.
```
Nav (z:600) → Dropdowns (z:300 inside nav)
Body backdrops (z:499)
Modals (z:500–601)
Sidebar (z:150)
```

### Country detection
Always use `detectCountry(geo)` (frontend) or `detectCountryFromGeo(geo)` (worker). Never inline a new regex chain — it will diverge.

### Location codes
Always use `getLocationCode(country, fallback)`. Never hardcode `2124` or `2840`.

### DataForSEO credentials
Always use `getDFSCreds(env)`. Never inline `btoa(login + ':' + password)`.

### Prompt schema ↔ renderer field names must match
When adding new fields to a diagnostic JSON schema in `buildDiagnosticPrompt()`, the field names in the schema must exactly match what the corresponding `_render*()` function reads. Mismatched names cause silent failures (empty cells, missing data). Always verify both sides when adding a new field.

### Stop/Resume system for AI generations
All bulk AI loops must be stoppable and resumable. The system uses three globals in `index.html`:
- `window._aiAbortCtrl` — `AbortController` passed as `signal` to `fetch()`. `aiStopAll()` calls `.abort()` to kill active streams.
- `window._aiStopAll` — boolean flag. Bulk loops must check this between iterations and `return` early if true.
- `window._aiStopResumeCtx` — `{ label, fn, args }` object set by the loop when it stops. `_aiShowResume()` renders Resume/Dismiss buttons in the AI bar.

**Pattern for stoppable bulk loops:**
```js
async function generateAll(startFrom) {
  window._aiStopAll = false;
  var start = startFrom || 0;
  for (var i = start; i < items.length; i++) {
    if (window._aiStopAll) {
      window._aiStopResumeCtx = {
        label: 'Paused (' + i + '/' + items.length + ')',
        fn: function(args) { generateAll(args.startFrom); },
        args: { startFrom: i }
      };
      return;
    }
    // ... do work ...
  }
}
```
Already implemented in: `generateAllBriefs` (briefs.js), `enrichAll` (research.js), `generateAllPageGoals` (sitemap.js), `generateStrategy`/`improveStrategy` (strategy.js).

### Stage navigation
All 11 pipeline stages are always clickable in the sidebar — no stage locking or dependency gating. This is an internal tool for professionals; users can jump to any stage at any time. `navToStage(stage)` calls `goTo(stage)` + `renderStageContent(stage)`.

### Stage eyebrows
Stage counts use `data-stage-num` attributes populated by `STAGES.length` via `_updateStageEyebrows()`. Never hardcode "Stage X of Y" — use `<div class="eyebrow stage-eyebrow" data-stage-num="N"></div>`.

### Guide panel + STAGE_TIPS
Every feature that changes workflow **must update**:
1. `<!-- HELP / WORKFLOW GUIDE PANEL -->` in `index.html`
2. `STAGE_TIPS[stage]` array in `index.html`

## Coding Conventions

- **Canadian spelling** everywhere: optimise, colour, centre, analyse, favour
- **No `alert()`** — use `aiBarNotify()` for all user messages
- **No inline onclick concat** — always `createElement` + `.onclick`
- **Async functions:** `initAuth`, `showProjects`, `loadProjects`, `resumeProject` are all async. Any new function using `await` must be `async`.
- **Commit messages:** lowercase imperative, describe what changed and why
- **Push to `main` directly** — Cloudflare auto-deploys in ~30s

## Before Every Commit

```bash
# Syntax check all JS files
node --check worker.js strategy.js keywords.js briefs.js sitemap.js copy.js research.js layout.js schema.js images.js export.js prompts.js

# Check index.html inline JS
python3 -c "
import re
with open('index.html','rb') as f: c=f.read().decode('utf-8','replace')
scripts=re.findall(r'<script>(.*?)</script>', c, re.DOTALL)
open('/tmp/check.js','w').write(max(scripts,key=len))
"
node --check /tmp/check.js
```

## Local Development

```bash
# Install wrangler (one-time)
npm install -g wrangler

# Create .dev.vars with your API keys (see .dev.vars.example)
cp .dev.vars.example .dev.vars
# Edit .dev.vars with real credentials

# Run locally
wrangler dev
```

Note: Cloudflare Access auth headers are not present locally. The worker falls back to header-only auth, which means `/api/*` routes return 401 unless you set `CF_ACCESS_TEAM_DOMAIN` to empty or test via curl with a fake email header.

## Secrets Management — READ THIS EVERY SESSION

### Golden Rules
1. **NEVER** read, print, log, or expose the contents of `.dev.vars` — it contains live API keys
2. **NEVER** hardcode API keys, tokens, or passwords anywhere in source code
3. **NEVER** commit `.dev.vars` — it is gitignored and must stay that way
4. **NEVER** add secrets to `wrangler.toml` — that file is committed to git
5. **NEVER** create new env vars without updating this section AND `.dev.vars.example`

### Where Secrets Live

| Environment | Location | How to Set |
|---|---|---|
| **Production** (Cloudflare Workers) | Encrypted Worker Secrets | `wrangler secret put VAR_NAME` (already set, do not re-set unless rotating) |
| **Local dev** (`wrangler dev`) | `.dev.vars` file (gitignored) | Copy from `.dev.vars.example`, fill in real values |

### Required Environment Variables

| Variable | Purpose | Used In | Required? |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API (chat, briefs, copy, strategy) | worker.js `/api/claude`, `/api/claude-sync`, queue consumer | **Yes** — app non-functional without it |
| `DATAFORSEO_LOGIN` | DataForSEO username (email) | worker.js `getDFSCreds()` → all `/api/kw-*`, `/api/serp-intel`, `/api/snapshot` | **Yes** — keyword/SERP features break |
| `DATAFORSEO_PASSWORD` | DataForSEO password | worker.js `getDFSCreds()` (same routes) | **Yes** — paired with LOGIN |
| `GEMINI_API_KEY` | Google Gemini image generation | worker.js `/api/generate-image` | **Yes** — images stage breaks |
| `ADMIN_EMAIL` | Owner email — bypasses role check, gets admin by default | worker.js auth + `/api/admin/users` | Recommended |
| `CF_ACCESS_TEAM_DOMAIN` | Cloudflare Access team name (e.g. `setsail`) | worker.js JWT validation | Production only — omit locally |

### How Secrets Flow in Code

```
Production:  CF Worker env bindings → env.VAR_NAME in worker.js
Local dev:   .dev.vars → wrangler dev injects → env.VAR_NAME in worker.js
Frontend:    NEVER has direct access to secrets — all API calls go through worker.js proxy routes
```

**The frontend never touches API keys.** `callClaude()` in index.html hits `/api/claude` which adds the `x-api-key` header server-side. Same for DataForSEO, Ahrefs, and Gemini.

### Worker.js Secret Access Patterns (do not deviate)

```js
// Claude — always via env.ANTHROPIC_API_KEY
headers: { 'x-api-key': env.ANTHROPIC_API_KEY, ... }

// DataForSEO — always via getDFSCreds(env) helper (top of worker.js)
headers: { 'Authorization': 'Basic ' + getDFSCreds(env) }

// Gemini — always via env.GEMINI_API_KEY in query string
fetch(`https://generativelanguage.googleapis.com/...?key=${env.GEMINI_API_KEY}`)

// Auth — always via env.CF_ACCESS_TEAM_DOMAIN + env.ADMIN_EMAIL
```

### Adding a New Secret

If a new API integration is added:
1. Add the variable to this table above
2. Add a placeholder line to `.dev.vars.example`
3. Set it in production: `wrangler secret put NEW_VAR_NAME`
4. Set it locally in `.dev.vars`
5. Access it in worker.js via `env.NEW_VAR_NAME` — never import/require
6. **Never** pass it to the frontend — create a proxy route in worker.js

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| 401 on all `/api/*` locally | `CF_ACCESS_TEAM_DOMAIN` is set but no Access JWT | Comment it out in `.dev.vars` |
| "No keyword API configured" | `DATAFORSEO_LOGIN` or `DATAFORSEO_PASSWORD` missing | Check `.dev.vars` has both |
| "GEMINI_API_KEY not configured" | `GEMINI_API_KEY` missing from env | Add to `.dev.vars` or `wrangler secret put` |
| Claude calls return 401 | `ANTHROPIC_API_KEY` missing or expired | Check `.dev.vars` / rotate key at console.anthropic.com |
| `getDFSCreds()` returns wrong base64 | Login doesn't contain `@` — falls back to hardcoded | Ensure `DATAFORSEO_LOGIN` is a valid email |

## KV Key Schema

All user data prefixed `u:{email}:`.

| Key Pattern | Contents |
|---|---|
| `u:{email}:project:{id}` | Full project JSON (with `_version`) |
| `u:{email}:copy:{projectId}:{slug}` | Copy HTML per page |
| `u:{email}:job:{projectId}:{jobId}` | Queue job status (24h TTL) |
| `u:{email}:img:{projectId}:{slug}` | Image data per page |
| `admin:user:{email}` | User profile: name, role, projects |
| `rl:{email}:{group}` | Rate limit bucket (auto-expiring) |

**External KV (read-only):**

| KV Namespace | Key | Contents |
|---|---|---|
| `PRICING_KV` | `global:pricing-catalog` | Pricing Engine catalog: 9 services, 3 packages, margin targets, strategy pricing, tracking pricing. **Read-only — owned by Pricing Engine repo.** |

**25MB KV limit per value.** Server rejects at 24MB, warns at 15MB+.

## Contacts

- **Jason Atakhanov** — founder, `jason@setsail.ca`
- **Repo:** `setsail-it/tools.setsail.ca`
- **Live:** `tools.setsail.ca`
