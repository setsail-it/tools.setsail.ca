# SetSailOS — Developer Guide

## What This Is

SetSailOS is Setsail Marketing's internal AI-powered website build pipeline. It is a single-page application that takes a client engagement from initial intake through to a fully export-ready website — producing audience intelligence, competitive strategy, keyword research, page architecture, SEO briefs, full copy, wireframes, structured data, and image assets across 11 sequential stages.

**The 11-stage pipeline:**

1. **Setup** — Client name, URL, primary market, metro/city targeting (for GKP geo data), industry, uploaded strategy docs (auto-extract to client goals), discovery notes, client goals (goal statement, measurable target, baseline, timeline, primary KPI), sales qualification, competitor URLs
2. **Snapshot** — Automated domain authority pull (Ahrefs via DataForSEO), backlink count, top organic pages, competitor DA comparison, Sales Summary card, Brand SERP card (Knowledge Panel presence, owns #1 result, SERP features, People Also Search For, ratings — via `/api/snapshot-brand-serp`), Current Site Architecture (3 tabs: Insights — AI-generated plain-English description of information architecture/URL patterns/hierarchy depth, Tree — indented hierarchy with traffic badges, Diagram — Mermaid flowchart with grouped view for 60+ page sitemaps), Core Web Vitals, Tech Stack, Schema detection, redirect map. Clear All button to reset snapshot data.
3. **Research** — AI-enriched factual data collection across 5 tabs (Business, Audience, Brand, Schema/Local, Competitors) with completeness scorecard, field-level source badges, and unit economics inputs
4. **Strategy** — The strategy engine: 8 AI diagnostics (D0–D7) with keyword pipeline auto-inserted between D3 and D4, scoring engine with anti-inflation caps, positioning direction system, budget-tier channel allocation, audience intelligence, sensitivity analysis, demand validation, interactive Gantt timeline with cost labels, compiled 13-section strategy document with 6 data appendices + revenue projection model, Pricing Engine integration (live service costs, package tier matching, investment summary, internal margin analysis), Service Scope panel (product selection with Low/Mid/High scope, per-service ROI, dual suggested/realistic budget view, scope notes). 9 tabs: Audience, Positioning, Economics, Subtraction, Channels (merged with Growth Plan — includes Gantt, budget allocation, scope panel), Website, Content & Authority, Risks, Output. Keywords panel is persistent above tabs (collapsible). "From here forward" button re-runs current diagnostic through D7. Auto-compiles strategy doc + web brief after full runs. Strategy document download includes website strategy brief.
5. **Sitemap** — Page architecture with keyword-to-page mapping. 5-step workflow strip (Import → Generate → Align → Enrich → Approve) with status dashboard. Strategy-aware build: D5 page injection (vertical/location/content pages), CTA landing page stubs, pages-to-cut annotation, tier page count enforcement, engagement scope awareness. Page triage system (Removed tab) flags parameter pages, utility bloat, team sub-pages, cannibalised keywords, off-strategy pages. Realign button for post-strategy updates without full rebuild. Issues panel with AI-powered Fix buttons (keyword assignment, zero-vol replacement, cannibalisation resolution). Full Build button chains all steps: build → priorities → personas → AI keyword fix → page goals (batched, 12/call) → content pillars → live volumes. Architecture diagram with grouped view for 60+ pages. Source badges (D5/CTA/CUT). Strategy alignment columns, content pillar tags, persona/voice/awareness assignment, positioning direction gap detection, CTA gap detection, persona coverage check, budget-tier priority suggestions, market overrides, active page import from Snapshot, Clear All button
6. **Briefs** — Per-page SEO briefs with SERP-calibrated targets, question injection, competitor context, version control (V1/V2), AI evaluation scorecards, positioning direction injection, subtraction messaging angles, economics-calibrated CTAs, competitive counter context, and persona alignment scoring
7. **Copy** — Full-page HTML generation from approved briefs with multi-pass audit (keyword density, intent match, Canadian spelling, AI fluff detection, persona alignment, positioning direction), human QC checklists with persona/positioning verification, positioning-aware meta tag generation, persona-prioritised E-E-A-T injection, content pillar guidance for blogs, and full worker queue parity
8. **Images** — AI image generation (Gemini) per page with prompt engineering and style controls
9. **Layout** — Wireframe generation with section-level structure and responsive grid suggestions
10. **Schema** — Structured data markup (JSON-LD) per page type with validation
11. **Export** — Final packaging of all assets for handoff: 5 tabs (Sitemap, Copy, Schema, Strategy, Investment) with copy/download per section, full package .txt download including strategy document and investment summary

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
worker.js        — All backend API routes + queue consumer (~3161 lines)
index.html       — Shell + CSS + core JS (state, nav, save/load, AI bar) (~4224 lines)
strategy.js      — Stage 4: strategy engine + scoring + diagnostics + revenue model + data tables (~8469 lines)
keywords.js      — Keyword research (tab within Strategy stage) + GKP integration (~3636 lines)
sitemap.js       — Stage 5: sitemap generation + persona/voice/positioning integration (~2637 lines)
briefs.js        — Stage 6: brief generation + queue + strategy context integration (~1827 lines)
copy.js          — Stage 7: copy generation + audit + strategy context integration (~1486 lines)
research.js      — Stage 3: AI enrichment + field metadata + scorecard (~1827 lines)
layout.js        — Stage 9: wireframe generation (~558 lines)
images.js        — Stage 8: image generation (~1234 lines)
schema.js        — Stage 10: schema markup (~260 lines)
prompts.js       — Shared AI prompt templates (~121 lines)
export.js        — Stage 11: export packaging + strategy/investment tabs (~138 lines)
setsailai.js     — SetsailAI assistant: sidepanel with ask/audit/explain/action modes (~1531 lines)
wrangler.toml    — Cloudflare deployment config
.dev.vars        — Local dev secrets (gitignored)
```

## Architecture

### Frontend State

All app state lives in a single mutable global `S` object (index.html:691). Every stage file reads and writes to `S` directly. Changes trigger `scheduleSave()` which debounces (1500ms) then POSTs the full project to `/api/projects/:id`.

**Key `S` properties:**
- `S.projectId`, `S.stage` — current project and stage
- `S._version` — optimistic locking counter (incremented on each save)
- `S.setup` — client info, docs, voice, competitors, sales qualification, client goals (`goalStatement`, `goalTarget`, `goalBaseline`, `goalTimeline`, `goalKpi`), metro targeting (`metroTarget`)
- `S.snapshot` — DataForSEO domain metrics, `topPages`, `techStack`, `vitals`, `schemas`, `_insights` (cached AI summary)
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
- `S.research._updatedAt` — timestamp for staleness detection (set in research.js)
- `S.strategy._meta._completedAt` — timestamp for staleness detection (set in strategy.js)
- `S._sitemapBuiltAt` — timestamp for staleness detection (set in sitemap.js + setsailai.js)

### Backend (worker.js)

Single Cloudflare Worker handling all API routes via sequential `if` statements. Routes are grouped:
- **Auth routes:** `/api/whoami` (auto-registers new users), `/api/admin/users` (GET/POST/DELETE), `/api/admin/users/:email/approve`
- **Project CRUD:** `/api/projects[/:id]`
- **AI proxy:** `/api/claude` (streaming), `/api/claude-sync` (non-streaming) — model-locked and token-capped
- **DataForSEO:** `/api/kw-expand`, `/api/paa`, `/api/niche-expand`, `/api/competitor-gap`, `/api/organic-competitors`, `/api/gmb`, `/api/serp-intel`, `/api/kw-debug`
- **Google Keyword Planner:** `/api/gkp-ideas` (keyword ideas + bid data from URL), `/api/gkp-forecast` (keyword enrichment: bid ranges, ad competition, monthly volumes), `/api/gkp-status` (credential check) — all gracefully hidden when Google Ads env vars not set. Both routes have 401 token-refresh retry logic.
- **Ahrefs:** `/api/snapshot`, `/api/snapshot-brand-serp` (Knowledge Panel + SERP features), `/api/ahrefs`
- **Queue:** `/api/queue-submit`, `/api/queue-status`
- **Image gen:** `/api/generate-image`
- **Per-slug storage:** `/api/copy/:projectId/:slug`, `/api/images/:projectId/:slug`

**Queue consumer** (`worker.queue()`): processes `brief` and `copy` job types. Loads project → fetches SERP data → calls Claude → writes back with version increment.

### Strategy Engine (strategy.js)

The strategy engine is the most complex subsystem. It runs 8 AI diagnostics sequentially, scores each section on three dimensions, and enforces anti-inflation caps to prevent score gaming.

**Diagnostic pipeline (auto-orchestrated by `generateStrategy()`):**
- **D0 — Audience Intelligence:** Segments, personas (archetype labels, not fictional names), buying motions, purchase triggers, objection maps, vertical coverage (active + parked segments)
- **D1 — Unit Economics:** CPL, CAC, LTV, LTV:CAC ratio, sensitivity analysis (conservative/base/optimistic), CPC intelligence, paid viability
- **D2 — Competitive Position:** Positioning directions (never auto-selects), validated differentiators, messaging hierarchy, brand voice direction with vertical overlays
- **D3 — Subtraction Analysis:** Current activity audit with stop/keep/restructure verdicts, recoverable budget
- **⟳ Keyword Pipeline** (auto-runs between D3 and D4): seeds → DataForSEO expansion → volumes → GKP enrichment (if configured) → AI-Select → clustering. Uses D0-D3 context for better seed generation. Results feed into D4+ for demand-informed channel/budget decisions.
- **D4 — Channel & Lever Viability:** 13 levers scored, three budget tiers (current/growth/optimal), funnel coverage analysis
- **D5 — Website & CRO:** Build type, CTAs, form strategy, page architecture, tracking requirements
- **D6 — Content & Authority:** DR gap analysis, content pillars (vertical-aware), publishing cadence, E-E-A-T strategy
- **D7 — Risk Assessment:** Risks with severity scores, mitigations, dependencies

**D0 runs first** (separate call before the D1–D7 loop). This is because D0=0 is falsy in JavaScript — all `if (diagNum)` checks must use `diagNum !== undefined && diagNum !== null` instead.

**Keyword pipeline within strategy (keywords.js):**
The keyword pipeline has 10 steps: Generate Questions → AI Generate Seeds → Build Mechanical Seeds → Pull Competitor Keywords → Merge All Sources → Fetch Volumes → GKP Enrich (optional, if configured) → AI-Select Top Keywords → Cluster into Pages → Run Audit. When triggered from `generateStrategy()`, it runs automatically between D3 and D4. GKP enrichment adds `low_bid`, `high_bid`, `ad_competition`, `ad_competition_idx` to each keyword. AI-Select uses GKP bid data as a commercial intent signal when available. Keyword table header is clickable to filter showing only selected keywords.

**5 keyword tabs:** Questions, Seeds, Opportunities, Clusters, Google Ads. The Google Ads tab shows credential status, enrichment summary (avg CPC, competition breakdown), and a sortable table of all keywords with bid ranges and ad competition data.

**Mechanical seed generation** (`buildKwSeeds()`): Business-type-aware with 9 category templates (agency, ecommerce, saas, medical, trades, restaurant, legal, realestate, professional). Auto-detected via `_detectBusinessCategory()` from research fields. 10-layer seed generation: service × category modifiers, business type, universal questions, D0 audience segments, D0 perceived alternatives, D2 positioning keywords, snapshot slug mining, secondary geo expansion, research pain points, pinned seeds. Max 700 seeds.

**Scoring engine:** Three dimensions per section:
- Data Completeness (35%) — are all required inputs present?
- Analytical Confidence (40%) — content depth + audit pass rate
- Specificity (25%) — is the output specific to this client?

**Section weights:** Positioning 18%, Channels 22% (merged with Growth), Economics 14%, Subtraction 12%, Audience 10%, Website 10%, Content & Authority 10%, Risks 10%. Sum is 1.06 — divided by `totalWeight` at runtime so a perfect score is still 10.0.

**Anti-inflation caps** prevent score gaming — e.g. no validated differentiators caps positioning confidence at 6, audience score below 5.0 caps overall at 6.0, first-pass scores above 7.0 trigger a warning.

**Positioning direction system:** Founder hypotheses → Evaluate Hypotheses (stress-tests against competitors/demand) → Select Direction → D2 generates full messaging. Without a selected direction, D2 generates competitive analysis but messaging fields are blocked with `direction_required: true`.

**Engagement scope system (strategy.js):**
- `S.strategy.engagement_scope` — human-curated service selection. Auto-populated from D4 levers via `_buildEngagementScope()`. Services deduplicated via `LEVER_SERVICE_MAP` (many-to-one collapse). Each service has `enabled`, `scope` (low/mid/high), `scope_note`, `roi`, `realistic_override`.
- `_renderScopePanel()` / `_mountScopePanel()` — Service Scope panel in Channels tab. Checkboxes to enable/disable, Low/Mid/High scope toggles, scope note inputs, live totals bar. Post-render DOM wiring pattern (same as `_mountGantt`).
- `_computeRealisticOverrides()` — auto-throttles lowest-priority services to fit client budget. Produces `realistic_override` per service.
- `_computeServiceROI(svcEntry)` — per-service ROI from D1 unit economics (LTV, CAC, sensitivity, CPC). Returns multiplier + timeline + confidence.
- `_recalcScopeTotals()` — computes suggested vs realistic monthly/project/year1 totals.

**Compiled strategy document (strategy.js):**
`compileStrategyOutput()` produces a sales-grade strategy document in two layers:

*Layer 1 — AI-generated prose (13 sections):*
1. Executive Summary — market opportunity + revenue projection
2. Goal Alignment — client goals → strategy → projected ROI
3. Market Opportunity & Demand Validation — search volume by service
4. Audience & Buying Behaviour — segments, personas, buying motions
5. Competitive Positioning — comparison table, win path, messaging
6. Unit Economics & Revenue Model — CPL → leads → deals → revenue
7. Keyword & Content Strategy — clusters, pillars, authority plan
8. Site Architecture & Conversion — pages, CTAs, conversion pathway
9. Channel Strategy & Budget Allocation — channel table with $ amounts
10. Execution Roadmap — phased timeline, geo strategy
11. Risk Register & Mitigations — severity-scored table
12. Investment Summary — service costs + ROI
13. Success Metrics & Measurement Plan — 3/6/12 month targets

*Layer 2 — Data appendices (deterministic, no AI):*
- A: Selected Keyword Opportunities (keyword, vol, KD, CPC, score)
- B: Cluster → Page Map (cluster, primary kw, page type, action, slug)
- C: Audience Segments (revenue potential, difficulty, priority)
- D: Channel Scoring Matrix (priority, budget %, timeline)
- E: Risk Register (severity, mitigation)
- F: Competitive Landscape (strength, weakness, our edge)

*Revenue projection model:* `_buildRevenueProjection()` computes leads/month, deals/month, monthly revenue, ROI multiplier from D1 unit economics data. Includes sensitivity analysis. Fed into AI prompt context.

**Pricing pipeline export (strategy.js + export.js):**
- `copyStrategyDoc()` / `downloadStrategyDoc()` — copy/download the compiled strategy document (.md) — includes website strategy brief
- `buildInvestmentText()` — dual-column markdown (Suggested vs Realistic) when engagement_scope exists, with ROI per service and scope notes. Falls back to old lever-based format if no scope.
- `_renderInvestmentSummary()` — dual-column HTML in Output tab. Suggested/Realistic columns with ROI badges, scope notes, 2x3 totals grid. Falls back to old format if no scope.
- `copyInvestmentSummary()` / `downloadInvestmentSummary()` — copy/download the investment summary
- `showMarginModal()` — internal-only margin analysis in a modal (z-index:600, backdrop, Escape to close).
- `recalculateInvestment()` — re-reads live pricing catalog and recomputes snapshot without re-running diagnostics
- `_renderScopeWarning()` (sitemap.js) — compares page count against `TIER_PAGE_RANGES` for the matched engagement tier

**Gantt pricing integration:** `_buildGanttItems()` filters out services disabled in engagement_scope. `_mountGantt()` shows cost labels ($X/mo or $X proj) per bar when scope data exists.

**Export stage (export.js):** 5 tabs — Sitemap, Copy, Schema, Strategy, Investment. Strategy tab renders compiled document with copy/download. Investment tab renders `buildInvestmentText()` as formatted HTML (dual-column when scope exists). `downloadPackage()` prepends Growth Strategy and Investment Summary sections to the .txt export.

### Buyer Intelligence Layer (strategy.js, sitemap.js, briefs.js, copy.js, research.js)

Four additive data signals that feed into brief and copy prompts:

- **Perceived Alternatives (D0):** `S.strategy.audience.perceived_alternatives[]` — what buyers consider *instead* of hiring this type of provider (do nothing, hire in-house, freelancer, DIY). Each entry has `alternative`, `segments_affected`, `threat_level`, `counter_positioning`. Renders in Audience tab, feeds briefs via `_buyerIntelBlock()`.
- **Category Perception Gap (D2):** `S.strategy.positioning.category_perception` — gap between how the market categorises the business vs how the client wants to be perceived. Fields: `buyer_frame`, `actual_frame`, `gap_severity` (none/mild/significant/fundamental), `reframing_language`. Renders in Positioning tab, feeds web strategy brief and briefs.
- **Awareness Stage per Page:** `S.pages[i].awareness_stage` — auto-inferred from page type + keyword intent via `_inferAwarenessStage(page)` in sitemap.js. Values: `unaware`, `problem_aware`, `solution_aware`, `product_aware`, `most_aware`. Editable via dropdown in sitemap edit mode. Injected into brief and copy prompts with stage-specific structural guidance. Copy audit check verifies alignment.
- **VoC Swipe File:** `S.strategy._enrichment.voc_swipe_file[]` (extracted from uploaded docs) + `S.research.voc_swipe_raw` (manual paste in Research Brand tab). Real buyer language injected into diagnostic context and downstream prompts. `source_type: 'extracted' | 'manual'`.

**`_buyerIntelBlock(page)`** (strategy.js) — consolidating helper that combines all 4 signals into one prompt section. Called by briefs.js and copy.js via `typeof _buyerIntelBlock === 'function'` guard. Awareness sets page structure, perception sets opening hook, alternatives set objection handling, VoC sets language texture.

### SetsailAI Assistant (setsailai.js)

AI-powered sidepanel that persists across all 11 stages. Toggle button in the nav bar. State lives in `_sai` (session-only, not stored in `S`). Panel is 400px fixed-right, responsive (overlay on <1100px).

**4 modes:**

1. **Ask Mode** — Chat with Claude using tiered project context. Own streaming fetch to `/api/claude` (does not interfere with AI bar). Supports file attachments (PDFs via `pdfs-2024-09-25` beta, images, text files) — files sent as multimodal content blocks, stored as text descriptions only in history to prevent bloat. 4-layer context assembly:
   - Layer 0 (always): client name, URL, geo, industry, services, positioning direction
   - Layer 1 (always): compiled strategy overview (truncated)
   - Layer 2 (stage-routed): full data for current stage
   - Layer 3 (question-routed): additional context when question mentions keywords/budget/competitor/persona/specific slug
   - Conversation history: last 6 turns included for continuity
   - Grounding system prompt: must cite source tab/diagnostic or say data doesn't exist

2. **Audit Mode** — 30+ pure-JS programmatic checks across all stages including pipeline staleness detection (research→strategy, strategy→sitemap, strategy→briefs, briefs→layout timestamp comparisons). `SAI_AUDIT_CHECKS[]` array. Severities: error (red), warning (orange), info (grey). Results grouped by stage with "Go →" navigation buttons that navigate to the correct stage AND tab (including strategy sub-tabs via `_sTab`). Guards against no-project-loaded state with clear empty states. Runs on: stage change, after generation completes, on demand. Badge on nav button (red for errors, orange for warnings).

3. **Explain Mode** — `data-sai-explain="type:identifier"` attributes on key UI elements (diagnostic sections, positioning direction, page rows, cluster cards, brief containers, copy audit results). Capture-phase click handler intercepts, assembles targeted context, auto-sends explanation request. `body.sai-explain` class enables dashed green outline on hover.

4. **Action Mode** — Claude can propose project modifications via `:::ACTION{json}:::END` blocks. 6 action types:
   - `sitemap_replace` — replace all pages (destructive, red warning)
   - `sitemap_add` — add pages (deduplicates by slug)
   - `sitemap_remove` — remove pages by slug (lists what will be lost)
   - `sitemap_update` — update whitelisted fields on existing pages
   - `research_update` — update whitelisted research fields
   - `strategy_update` — update 5 approved strategy paths only
   - Confirmation card UI: shows exact impact, Apply/Dismiss buttons. Nothing changes without explicit user approval.

**Key functions:** `toggleSai()`, `saiSend()`, `setSaiMode()`, `runSaiAudit()`, `_assembleSaiContext()`, `_renderActionConfirmation()`, `_executeAction()`, `_saiPostGenAudit()`

**Integration hooks in index.html:** `goTo()` calls `runSaiAudit()`, `aiBarEnd()` calls `_saiPostGenAudit()`, `toggleHelpPanel()` closes SetsailAI panel.

### Snapshot Site Architecture (index.html)

Current Site Architecture card has 3 tabs:
- **Insights** (default) — AI-generated plain-English description of the site's information architecture: what the site is, how pages are organised (content axes, URL hierarchy, filtering patterns, depth), and where traffic concentrates. Under 120 words, no recommendations — just describes what exists. Calls Claude once via `_generateSnapInsights()`, result cached in `S.snapshot._insights`. Streams with 300ms throttled DOM updates.
- **Tree** — Styled indented hierarchy built from `_buildSnapArchTree()` with traffic badges and depth indicators.
- **Diagram** — Mermaid flowchart rendered lazily on first tab switch via `_renderSnapshotArchDiagram()`.

Tab switching via `switchSnapArchTab(tab)`. Diagram and insights lazy-load on first view.

### Setup Stage — Client Goals & Geo Targeting (index.html)

**Client Goals** section captures the client's success definition from intake:
- `S.setup.goalStatement` — what success looks like in their words
- `S.setup.goalTarget` — measurable target
- `S.setup.goalBaseline` — current baseline
- `S.setup.goalTimeline` — timeline to achieve
- `S.setup.goalKpi` — primary KPI (select: leads, revenue, traffic, conversions, calls, form_submissions, booked_appointments)

Auto-populated from uploaded discovery documents via Claude extraction (runs once after first doc upload). Goals are injected into strategy compilation and downstream prompts.

**Metro / City Target** — `S.setup.metroTarget` — optional city-level geo targeting for Google Keyword Planner volume data. Dropdown populated from `GKP_METROS` constant (major Canadian + US metros with Google Ads geo criterion IDs).

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
- **Roles:** 4-tier system: `super_admin` (ADMIN_EMAIL, untouchable), `admin` (user management), `strategist` (full pipeline), `viewer` (read-only). Auto-registration: new SSO users get `status: 'pending'`, `role: 'viewer'` until admin approves.
- **User management:** `/api/admin/users` CRUD + `/api/admin/users/:email/approve`. Super admin cannot be demoted/deleted. Admin panel with Pending Approval section + Team section.
- **Cross-user projects:** Strategist+ roles can list/load/save ALL projects across users. Viewers scoped to own prefix only.
- **Save concurrency:** `_saveInFlight` lock prevents concurrent `saveProject()` calls causing 409 version conflicts. Queued saves fire after in-flight save completes.
- **Claude proxy:** model whitelist (`claude-sonnet-4-20250514`, `claude-haiku-4-5-20251001`), max_tokens capped at 8192, payload sanitised
- **Rate limiting:** per-user sliding window — ai (60/5min), data (40/5min), queue (5/1min), image (20/5min)
- **XSS:** all AI-generated HTML sanitised via DOMPurify before innerHTML
- **KV isolation:** all user data prefixed `u:{email}:` — strategist+ can cross-read via lookup
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
Help Panel (z:1000)
SetsailAI panel (z:900), overlay (z:899)
Modals (z:500–601)
Body backdrops (z:499)
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
node --check worker.js strategy.js keywords.js briefs.js sitemap.js copy.js research.js layout.js schema.js images.js export.js prompts.js setsailai.js

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
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token | worker.js `/api/gkp-*` routes | No — GKP features hidden when absent |
| `GOOGLE_ADS_CLIENT_ID` | Google Ads OAuth 2.0 client ID | worker.js `getGoogleAdsToken()` | No — paired with other GOOGLE_ADS vars |
| `GOOGLE_ADS_CLIENT_SECRET` | Google Ads OAuth 2.0 client secret | worker.js `getGoogleAdsToken()` | No — paired with other GOOGLE_ADS vars |
| `GOOGLE_ADS_REFRESH_TOKEN` | Google Ads OAuth 2.0 refresh token | worker.js `getGoogleAdsToken()` | No — paired with other GOOGLE_ADS vars |
| `GOOGLE_ADS_CUSTOMER_ID` | Google Ads customer ID (10-digit, no dashes) | worker.js `/api/gkp-*` routes | No — paired with other GOOGLE_ADS vars |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Google Ads MCC manager ID (optional) | worker.js `gadsHeaders()` | No — only for manager accounts |
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

// Google Ads API — always via getGoogleAdsToken(env) + gadsHeaders(env, token)
const token = await getGoogleAdsToken(env); // caches in KV for 55 min
headers: gadsHeaders(env, token) // Bearer token + developer-token + login-customer-id

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
| `admin:user:{email}` | User profile: `{ email, name, role, status, projects[], createdAt, updatedAt, approvedAt, approvedBy }`. Roles: `super_admin`, `admin`, `strategist`, `viewer`. Status: `pending`, `active`, `suspended`. Auto-created on first `/api/whoami` call. |
| `rl:{email}:{group}` | Rate limit bucket (auto-expiring) |
| `gads:access_token` | Google Ads OAuth access token (55 min TTL) |

**External KV (read-only):**

| KV Namespace | Key | Contents |
|---|---|---|
| `PRICING_KV` | `global:pricing-catalog` | Pricing Engine catalog: 9 services, 3 packages, margin targets, strategy pricing, tracking pricing. **Read-only — owned by Pricing Engine repo.** |

**25MB KV limit per value.** Server rejects at 24MB, warns at 15MB+.

## Contacts

- **Jason Atakhanov** — founder, `jason@setsail.ca`
- **Repo:** `setsail-it/tools.setsail.ca`
- **Live:** `tools.setsail.ca`
