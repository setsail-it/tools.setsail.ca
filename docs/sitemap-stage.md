# Stage 5 — Sitemap: Complete Technical Reference

## What This Stage Does

The Sitemap stage converts keyword research clusters into a page-by-page website architecture — each page with a primary keyword, supporting keywords, priority level, search intent, page type, strategy alignment, target market, and a strategic page goal. It is the bridge between research/strategy (what we know) and execution (what we build).

The output — `S.pages[]` — is the single source of truth that drives every downstream stage: Briefs, Copy, Images, Layout, Schema, and Export.

---

## Inputs: What Feeds Into the Sitemap

### From Setup (`S.setup`)
| Field | Used For |
|---|---|
| `S.setup.client` | Client name in prompts and exports |
| `S.setup.url` | Base URL for slug resolution, existing site panel, HTML export |
| `S.setup.geo` | Fallback primary market when Research geo is empty |
| `S.setup.competitors` | Competitor domains fallback for Competitor Gap analysis |

### From Snapshot (`S.snapshot`)
| Field | Used For |
|---|---|
| `S.snapshot.topPages[]` | Existing site pages — auto-imported into the import panel. Each has `slug`, `traffic`, `keywords`, `rankingKws[]`. Used to identify existing pages, assign initial keywords from ranking data, show traffic column, and split the sitemap into "Active Pages" vs "Suggested Pages to Build" |

### From Research (`S.research`)
| Field | Used For |
|---|---|
| `S.research.geography.primary` | Default target market for all pages. Drives `getPageGeo()` → `getPageCountry()` → DataForSEO location code for keyword volume lookups |
| `S.research.geography.secondary` | Listed in AI prompts for geo-aware sitemap generation |
| `S.research.primary_services` | Services list in AI prompts |
| `S.research.primary_audience_description` | Audience context for page goal generation |
| `S.research.competitors[]` | Competitor domains for Competitor Gap panel (preferred over Setup competitors) |
| `S.research.industry` | Client industry context in gap analysis prompt |

### From Strategy (`S.strategy`)
| Field | Used For |
|---|---|
| `S.strategy.positioning.value_proposition` | Injected into sitemap AI prompt and page goal generation (via `getStrategyField()`) |
| `S.strategy.webStrategy` | Full website strategy brief — injected into AI prompt as `## WEBSITE STRATEGY`. Claude uses it to derive `page_goal` for each page |
| `S.strategy.channel_strategy.levers[]` | Strategy alignment: `_computeAlignment()` checks each page's lever score to determine if it is Aligned / Review / Cut |
| `S.strategy.channel_strategy.levers[].priority_score` | Priority suggestion: `_suggestPriority()` maps lever scores to P1/P2/P3 |
| `S.strategy.subtraction.current_activities_audit[]` | Cut detection: pages whose name/slug matches a `stop` or `reduce` activity get Alignment = "Cut" |
| `S.strategy.execution_plan.lever_details.website.architecture_direction.page_types_needed` | Alignment boost: page types listed here are considered "aligned" |
| `S.strategy.growth_plan.accepted_timeline[]` | Priority phasing: pages mapped to Phase 1 levers get P1, Phase 2 get P2, etc. |
| `S.strategy.brand_strategy.content_pillars[]` | Blog pages can be assigned to content pillars via the "Pillars" button |
| `S.strategy.brand_strategy.voice_overlays{}` | Vertical-specific voice rules — read by briefs.js for pages with non-base `voice_overlay` |
| `S.strategy.audience.personas[]` | Persona profiles — auto-assigned to pages during build. Used in page goal generation, persona coverage checks, and persona badge display |
| `S.strategy.audience.segments[]` | Segment status (active/deprioritised) — determines which personas are active vs parked |
| `S.strategy.audience.parked_segments[]` | Parked segment list — personas in these segments are excluded from active assignment |
| `S.strategy.positioning.selected_direction` | Positioning direction — injected into AI prompts (sitemap + page goals). Direction gaps shown in stats bar |
| `S.strategy.execution_plan.primary_cta` | CTA gap detection — checks if landing pages exist for each defined CTA |
| `S.strategy.execution_plan.secondary_ctas[]` | CTA gap detection — secondary CTAs checked alongside primary |
| `S.strategy.execution_plan.low_commitment_cta` | CTA gap detection — low-commitment CTA checked alongside others |
| `S.strategy.channel_strategy.budget_tiers.current_budget` | Budget-aware priority: if a lever is unfunded in the current budget, priority is capped at P3 |
| `S.strategy.unit_economics.average_deal_size` | Revenue estimate tooltip on Review/Cut pages (vol × CTR × close rate × deal size) |
| `S.strategy.unit_economics.close_rate` | Revenue estimate calculation |
| `S.strategy._meta.current_version` | `_hasStrategy` check — strategy alignment features only appear when version > 0 |

### From Keyword Research (`S.kwResearch`)
| Field | Used For |
|---|---|
| `S.kwResearch.clusters[]` | **Primary input.** Each cluster maps to one page. Contains `primaryKw`, `primaryVol`, `primaryKd`, `supportingKws[]`, `suggestedSlug`, `pageType`, `name`, `recommendation`, `existingSlug`, `searchIntent` |
| `S.kwResearch.keywords[]` | Cache for keyword volume/KD lookups. Used by `enrichSitemapWithKwData()` and manual keyword edits. Also used in AI prompt fallback when no clusters exist |

### From Content Intelligence (`S.contentIntel`)
| Field | Used For |
|---|---|
| `S.contentIntel.paa.questions[]` | People Also Ask questions — injectable into page `assignedQuestions[]` after sitemap build. Also available as blog topic candidates |
| `S.contentIntel.gap.keywords[]` | Competitor gap keywords — shown in gap panel, selectable as blog topics |
| `S.contentIntel.blogTopics[]` | Selected blog topics (from PAA + gap) — can be batch-added to the sitemap as blog pages |

---

## How Pages Are Built

There are **two paths** into the sitemap:

### Path A: `buildSitemapFromClusters()` — Deterministic (preferred)

This is the primary path when keyword research has been clustered. It runs entirely client-side with no AI call.

**Step 1 — Structurals (always present):**
- Homepage (`/`), About (`/about`), Contact (`/contact`) are always created
- Slug resolution: checks imported URLs and snapshot pages for variants (e.g. `about-us` vs `about`)
- Structural pages get `priority: 'P1'`, `action: 'improve_existing'`, and ranking keywords from snapshot data

**Step 2 — Clusters → Pages:**
- Each cluster in `S.kwResearch.clusters[]` becomes one page
- Uses exact `primaryKw`, `suggestedSlug`, `pageType` from the cluster
- Score calculated as `log(vol+1) × 100 / max(kd, 5)` (higher is better)
- Priority: strategy-suggested priority (from `_suggestPriority()`) takes precedence over volume-based (vol ≥ 500 = P1, ≥ 100 = P2, else P3)
- Action: `improve_existing` if slug matches an existing page, `build_new` otherwise
- Supporting keywords: up to 10 from cluster, normalised to `{kw, vol, kd}` objects

**Step 3 — Orphan existing pages:**
- Any page from the import list or snapshot that was not matched by a cluster gets added
- Page type guessed from slug pattern (`/blog/` → blog, `/location/` → location, etc.)
- Priority: strategy-suggested or P3 default
- These have `primary_vol: 0` and show as zero-volume warnings

**Step 4 — Sort:**
- Structurals first, then P1 → P2 → P3, then by score descending

**Step 5 — PAA injection:**
- Any PAA questions with `assignedSlug` are injected into matching page's `assignedQuestions[]`

**Step 6 — Enrichment:**
- `enrichSitemapWithKwData()` — immediate: cross-references all page keywords against `S.kwResearch.keywords[]` cache to fill volume/KD/score
- `enrichSitemapWithLiveData()` — async: groups all zero-volume keywords by target country, calls `/api/ahrefs` for live DataForSEO lookups, backfills volume/KD/score. Also adds fetched keywords to the `S.kwResearch.keywords[]` cache for future reuse

### Path B: `runSitemap()` — AI-generated (fallback)

Used when no clusters exist, or for revision/regeneration. Calls Claude with the `P.sitemap` system prompt.

**Prompt construction:**
1. Client context: name, geo, services, value proposition
2. Website strategy brief (first 3000 chars if available)
3. One of three data sections:
   - **Clusters available:** Lists all clusters with primary keyword, volume, KD, supporting keywords, recommendation, and action. Instructs Claude to convert 1:1.
   - **Keywords available (no clusters):** Lists up to 150 keywords. Instructs Claude to cluster into N pages.
   - **No keyword data:** Instructs Claude to build best-guess sitemap from services list.
4. Revision notes (if user typed any)

**Parse and recovery:**
- First attempts `safeParseJSON()` on the full response
- If that fails, `attemptSitemapParseFromText()` tries: extract `[…]` array, fix truncated JSON (find last `}` and append `]`), extract from wrapped object
- If auto-parse succeeds, proceeds to enrichment
- If all parsing fails, shows a "Retry Parse" button

---

## Page Data Model

Each page in `S.pages[]` has these fields:

| Field | Type | Source | Description |
|---|---|---|---|
| `page_name` | string | cluster/AI | Human-readable page name |
| `slug` | string | cluster/AI | URL path (no leading slash) |
| `page_type` | string | cluster/AI | `home`, `service`, `industry`, `location`, `about`, `blog`, `utility`, `contact`, `faq`, `team` |
| `is_structural` | boolean | computed | True for home/about/contact. Set to true only for `utility` type on manual change |
| `priority` | string | computed/AI | `P1`, `P2`, or `P3` |
| `action` | string | computed | `improve_existing` or `build_new` |
| `primary_keyword` | string | cluster/AI | Exact keyword string from research |
| `primary_vol` | number | enrichment | Monthly search volume |
| `primary_kd` | number | enrichment | Keyword difficulty (0-100) |
| `score` | number | computed | `log(vol+1) × 100 / max(kd, 5)` — opportunity score |
| `supporting_keywords` | array | cluster/AI | `[{kw, vol, kd}]` — up to 10 |
| `search_intent` | string | cluster/AI | `commercial`, `transactional`, `informational`, `navigational` |
| `existing_traffic` | number | snapshot | Current monthly organic traffic |
| `existing_ranking_kws` | array | snapshot | Keywords this page currently ranks for |
| `page_goal` | string | AI | 1-2 sentence strategic purpose. Generated by Claude using strategy, persona context, positioning direction, and CRO context |
| `targetGeo` | string | user | Per-page market override (empty = inherits primary market) |
| `content_pillar` | string | AI/user | Blog pages only — assigned content pillar from brand strategy |
| `target_persona` | string | auto/user | Persona name from `S.strategy.audience.personas[]`. Auto-assigned during build (industry→segment match, service→primary persona). Editable via dropdown. Feeds page goal generation and briefs |
| `voice_overlay` | string | auto/user | Voice rule set identifier (`base` or segment slug like `construction`). Auto-assigned from persona segment. Read by briefs.js to inject vertical-specific voice rules |
| `assignedQuestions` | array | PAA | Questions from People Also Ask, injected after build |
| `notes` | string | user/AI | Freeform notes |
| `rationale` | string | AI | AI's reasoning for including this page (AI-generated path only) |

---

## Strategy Alignment System

When a strategy exists (`S.strategy._meta.current_version > 0`), three strategy-driven features activate:

### 1. Alignment Column (`_computeAlignment`)

Each page gets a coloured dot: 🟢 Aligned / 🟡 Review / 🔴 Cut.

**Logic flow:**
1. If the subtraction audit has a `stop` or `reduce` activity matching the page name/slug → **Cut**
2. If `is_structural` → **Aligned** (always)
3. Map page type to lever: service/industry → `seo`, blog → `content_marketing`, location → `local_seo`, core → `_website`
4. Find that lever in `S.strategy.channel_strategy.levers[]` by fuzzy ID match
5. If lever exists and `priority_score ≥ 5` → **Aligned**
6. If page type is in `architecture_direction.page_types_needed` → **Aligned**
7. If lever exists and `priority_score ≥ 3` → **Review**
8. Otherwise → **Review**

Cut-aligned pages also show a revenue estimate tooltip: `vol × 3.5% CTR × close_rate × deal_size = $/mo`.

### 2. Priority Suggestions (`_suggestPriority`)

Compares current priority to what strategy recommends. Shows blue badge count and "Accept All" button.

**Logic flow:**
1. Structural pages: home/contact = P1, others = P2
2. Map page type to lever, get lever's `priority_score`
3. Find lever in growth plan timeline, get its `phase` (0–3)
4. Matrix: Phase ≤1 + score ≥5 → P1, Phase ≤2 + score ≥5 → P2, else P3
5. Alignment boost: aligned pages bump up one tier
6. Cut pages forced to P3
7. High-volume override: vol ≥ 500 always gets P1
8. **Budget tier check:** if lever is unfunded in `current_budget.allocations`, cap at P3. Tooltip shows growth budget threshold.

### 3. Content Pillars (`assignContentPillars`)

Blog/article pages can be assigned to content pillars from `S.strategy.brand_strategy.content_pillars[]` via Claude. Shows as a tag on each blog page row.

### 4. Persona Assignment (`_autoAssignPersona`)

Each page gets a `target_persona` string matching a persona name from `S.strategy.audience.personas[]`. Auto-assigned during `buildSitemapFromClusters()`:
- **Industry pages:** Match persona segment name to page name/slug
- **Service pages:** Assign first active persona (primary segment)
- **Location pages:** Match segment, fallback to primary persona
- **Blog pages:** Left empty — assigned via content pillar or manually
- **Structural pages:** Left empty — serve all personas

Persona status (active vs parked) is derived from `S.strategy.audience.segments[].status` and `S.strategy.audience.parked_segments[]`, not from the persona object itself.

### 5. Voice Overlay (`_autoAssignVoiceOverlay`)

Each page gets a `voice_overlay` string identifying which voice rule set applies:
- Structural pages → `"base"`
- Pages with a target persona → slugified segment name (e.g. `"construction"`)
- Industry pages → derived from slug
- Default → `"base"`

Read by `briefs.js` to inject vertical-specific voice rules from `S.strategy.brand_strategy.voice_overlays[overlay]`.

### 6. Positioning Direction Gaps (`_checkDirectionPageGaps`)

When `S.strategy.positioning.selected_direction` exists, checks if any page directly supports the direction. Gaps shown as purple badges in the stats bar.

### 7. CTA Landing Page Gaps (`_checkCTAPageGaps`)

Checks if pages exist for each CTA defined in `S.strategy.execution_plan` (primary, secondary, low-commitment). Gaps shown as orange badges in the stats bar.

### 8. Persona Coverage Check (`_runPersonaCoverageCheck`)

Panel in Content Intelligence section. For each active persona, verifies:
1. Industry page exists for the persona's segment
2. Case study page mentioning the segment exists
3. Blog content addressing the persona's top objection exists

Missing items show "✕" with a "+ Create" button that adds the page directly to the sitemap.

---

## UI Layout

### Top Section
- **Build Source button** — "Build from Clusters" (when clusters exist) or "Generate with AI"
- **Import panel toggle** — Existing Site Analysis panel (snapshot pages, keyword mapping)
- **Regenerate / Revise & Regenerate** buttons

### Stats Bar
- Total page count, P1/P2/P3 counts, zero-volume warnings
- Alignment stats (when strategy exists): aligned/review/cut counts
- Priority diff count (when strategy suggests changes)
- Positioning gap count (purple, when direction selected but no proof pages exist)
- CTA gap count (orange, when CTA landing pages are missing)

### Category Tabs
Filter the table by page type:
- **All** — every page
- **Services** — service, industry, product
- **Locations** — location pages
- **Blog** — blog, article, recipe, event, portfolio
- **Core** — home, about, contact, utility, faq, team

### Page Performance Map (main table)
11-column grid:
`# | Page | Cluster Anchor | Vol | KD | Score | Intent | Priority | Align | Market | Traffic`

**View mode:** Read-only with badges (STRUCTURAL, IMPROVE, BUILD NEW), page goal preview, content pillar tags, persona badge (purple), intent badges, alignment dots, geo labels, traffic numbers.

**Edit mode:** Inline inputs for page name, slug, page type, content pillar, persona dropdown, voice overlay dropdown, page goal (with AI generate button), primary keyword (with live lookup on blur), supporting keywords (add/remove), intent dropdown, priority dropdown (with strategy suggestion button + budget context tooltip), market override input. Reorder (↑/↓) and delete (✕) buttons per page.

### Supporting Keywords
Expandable sub-rows under each page showing supporting keywords with their own vol/KD/score/intent data.

### Content Intelligence Panel
Card below the table with:
- **People Also Ask panel** — seed keyword selector → `/api/paa` → question list grouped by question word (What/How/Why/etc.). Each question has a "+ Blog" button.
- **Competitor Gap panel** — domain input → `/api/competitor-gap` → gap keyword list with vol/KD/score. Each keyword has a "+ Blog" button.
- **Persona Coverage Check panel** — verifies each active persona has industry page, case study, and objection content. Missing items have "+ Create" buttons. CTA landing page gaps shown below persona checks. Only appears when personas exist.
- **All Blog Opportunities** — unified view of PAA + gap items
- **Blog Topics bucket** — selected items, with "Add N to Copy Queue" button that batch-creates blog pages in the sitemap

### Gate 1 — PM Sitemap Approval
Dark card with:
- Revision notes textarea
- Missing keyword warning (count of non-structural pages without a primary keyword)
- **Approve Sitemap** — locks sitemap, sets `S.sitemapApproved = true`
- **Approve & Build Briefs** — approves and navigates to Briefs stage
- **Revise & Regenerate** — re-runs AI with revision notes

### Export Features
- **Mermaid Export** — generates Mermaid graph diagram with parent/child relationships. Copy button for FigJam.
- **HTML Sitemap** — opens a styled HTML table in a new window with page names, URLs, keywords, and Copy/Schema/Images completion status.

---

## Downstream: What Reads `S.pages[]`

### Briefs (`briefs.js`)
- Iterates `S.pages[]` to generate per-page SEO briefs
- Reads: `page_name`, `slug`, `page_type`, `primary_keyword`, `primary_vol`, `primary_kd`, `supporting_keywords`, `search_intent`, `page_goal`, `assignedQuestions`, `targetGeo`
- Requires `S.sitemapApproved = true` for the "Generate All" flow

### Copy (`copy.js`)
- Generates full-page HTML from approved briefs for each page in `S.pages[]`
- Reads: `slug`, `page_name`, `page_type`, `primary_keyword` for audit checks (keyword density, H1 match)
- Copy HTML stored in `S.copy[slug]` (separate KV key)

### Images (`images.js`)
- Generates image assets per page
- Reads: `slug`, `page_name`, `page_type`
- Image data stored in `S.images[slug]`

### Layout (`layout.js`)
- Generates wireframe per page from copy
- Reads: `slug`, `page_name`
- Layout data stored in `S.layout[slug]`

### Schema (`schema.js`)
- Generates JSON-LD structured data per page
- Reads: `slug`, `page_name`, `page_type`, `primary_keyword`
- Schema data stored in `S.schema[slug]`

### Export (`export.js`)
- Packages all page assets for handoff
- Reads: full `S.pages[]` array with all associated copy/schema/image/layout data

### Strategy (`strategy.js`)
- `compileStrategyOutput()` includes the page list in context for the compiled strategy document
- `synthesiseWebStrategy()` references page architecture

---

## Workflow: How This Should Be Done

### Prerequisites (in order of importance)
1. **Keyword Research completed and clustered** — `S.kwResearch.clusters[]` must exist. Without clusters, the sitemap falls back to AI generation which is less deterministic.
2. **Snapshot completed** — `S.snapshot.topPages[]` provides existing page data for the Active/Suggested split and traffic column.
3. **Strategy completed (at least D4 + D5)** — enables alignment column, priority suggestions, and content pillars. Without strategy, these features are hidden.
4. **Website Strategy brief generated** — `S.strategy.webStrategy` feeds into AI prompt for page goal derivation.

### Recommended Workflow

1. **Import existing pages** — If snapshot data exists, it auto-populates. Verify the import panel shows the correct pages.

2. **Build from Clusters** — Click the primary build button. This deterministically maps clusters to pages, resolves existing slugs, assigns priorities, and runs enrichment. No AI call needed.

3. **Review the table:**
   - Check zero-volume warnings (⚠ 0) — these pages may need keyword reassignment
   - Check alignment dots — 🔴 Cut pages should be removed or justified
   - Check priority diffs (blue badges) — accept strategy suggestions or override

4. **Edit mode adjustments:**
   - Fix any incorrect page types (affects alignment scoring)
   - Override market for location pages (e.g. set `targetGeo: "Toronto, ON"` for a Toronto location page)
   - Reassign primary keywords where the cluster assignment is wrong
   - Use "Find Keywords" button for pages without keywords
   - Generate page goals (AI button per page, or bulk "Goals" button)
   - Assign content pillars for blog pages ("Pillars" button)

5. **Content Intelligence:**
   - Run PAA for key pages to get question opportunities
   - Run Competitor Gap to find keyword opportunities competitors rank for but we do not
   - Select the best items as blog topics
   - "Add to Copy Queue" to create blog pages in the sitemap

6. **Approve** — Once satisfied, click "Approve Sitemap" to lock the architecture. This sets `S.sitemapApproved = true` and allows briefs generation.

### Common Issues

| Issue | Cause | Fix |
|---|---|---|
| All pages show vol: 0 | Keyword research not run, or Ahrefs enrichment failed | Run keyword research in Strategy Keywords tab first, then rebuild |
| No alignment column | Strategy not generated (version = 0) | Run strategy diagnostics D4 + D5 minimum |
| Wrong keyword on a page | Cluster assigned incorrect primary keyword | Edit mode → change primary keyword → blurs to live lookup |
| Location page using wrong market | No `targetGeo` override | Edit mode → set market to the location's geo (e.g. "Sydney, NSW") |
| "Improve existing" on a new page | Slug coincidentally matches an imported URL | Edit mode → change slug to avoid collision |
| Blog pages not showing pillars | D6 Brand diagnostic not run | Run Strategy D6 (Content & Authority) first |
| PAA returns no questions | Keyword too niche or geo has no PAA data | Try a broader seed keyword |

---

## API Calls Made by This Stage

| Endpoint | Trigger | Purpose |
|---|---|---|
| `/api/claude` (streaming) | "Generate with AI", "Revise & Regenerate", Page Goal generation, Content Pillar assignment, Keyword Mapping | AI sitemap generation, per-page goal writing, pillar assignment, keyword-to-page mapping |
| `/api/ahrefs` | `enrichSitemapWithLiveData()`, manual keyword edit | Live keyword volume + KD lookups from DataForSEO, grouped by target country |
| `/api/paa` | "Run" in PAA panel | People Also Ask questions for selected seed keywords |
| `/api/competitor-gap` | "Run" in Competitor Gap panel | Keywords competitors rank for that the client does not |

---

## Key Functions Reference

| Function | File | Purpose |
|---|---|---|
| `buildSitemapFromClusters()` | sitemap.js | Deterministic sitemap build from clusters + snapshot + imports |
| `runSitemap(withRevisions)` | sitemap.js | AI-generated sitemap (fallback path) |
| `enrichSitemapWithKwData()` | sitemap.js | Immediate: cross-ref keywords against local cache |
| `enrichSitemapWithLiveData(forceAll)` | sitemap.js | Async: live DataForSEO lookups for zero-volume keywords |
| `_computeAlignment(page)` | sitemap.js | Strategy alignment: aligned / review / cut |
| `_suggestPriority(page)` | sitemap.js | Strategy-driven priority suggestion |
| `_revenueEstimate(page)` | sitemap.js | Monthly revenue estimate (vol × CTR × close × deal) |
| `generatePageGoal(idx)` | sitemap.js | AI-generate 1-2 sentence page goal for one page |
| `generateAllPageGoals(startFrom)` | sitemap.js | Bulk page goal generation (stoppable/resumable) |
| `assignContentPillars()` | sitemap.js | AI assigns blog pages to brand strategy content pillars |
| `acceptAllPrioritySuggestions()` | sitemap.js | Batch-accept all strategy priority suggestions |
| `renderSitemapResults(approved)` | sitemap.js | Full UI render with error boundary |
| `runPAA()` | sitemap.js | Fetch People Also Ask questions |
| `runCompetitorGap()` | sitemap.js | Fetch competitor gap keywords |
| `addBlogPagesToSitemap()` | sitemap.js | Create blog pages from selected topics |
| `showMermaidModal()` | sitemap.js | Generate Mermaid diagram export |
| `showHtmlSitemapModal()` | sitemap.js | Generate styled HTML sitemap export |
| `runKeywordMapping()` | sitemap.js | AI maps keywords to existing pages + identifies gaps |
| `getPageGeo(page)` | index.html | Resolve target geo: page override → research primary → setup geo |
| `getPageCountry(page)` | index.html | Convert geo to country code via `detectCountry()` |
| `intentBadge(kw, geo)` | index.html | Generate intent badge HTML for a keyword |
| `getStrategyField(path, fallback)` | strategy.js | Read from strategy with research fallback |

---

## State Variables

| Variable | Location | Purpose |
|---|---|---|
| `S.pages[]` | global state | The sitemap — array of page objects |
| `S.sitemapApproved` | global state | Boolean — locks sitemap for downstream stages |
| `S.existingUrlsText` | global state | Persisted import textarea content |
| `S.existingSiteMapping` | global state | Keyword-to-page mapping from AI mapping run |
| `S.contentIntel` | global state | Content intelligence data (PAA, gap, blog topics) |
| `sitemapEditMode` | index.html | Boolean — toggle for inline editing |
| `_sitemapCatTab` | index.html | Current category filter tab (`all`, `service`, `location`, `blog`, `core`) |
