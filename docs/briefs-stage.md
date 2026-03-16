# Stage 6 — Briefs

> **File:** `briefs.js` (~1751 lines)
> **Renders in:** `#content` via `renderBriefs()`
> **Depends on:** `index.html` (shared helpers), `strategy.js` (`getStrategyField()`, `synthesiseWebStrategy()`), `worker.js` (queue consumer, SERP Intel API)

---

## Purpose

Generates per-page SEO content briefs from the approved sitemap. Each brief is a structured writing plan — not copy — that defines reader profile, unique angle, H1/title tag, conversion architecture, H2 skeleton, keyword integration, FAQ section, internal links, word count target, and E-E-A-T requirements. Briefs are the primary input to the Copy stage (Stage 7).

---

## Data Model

### Per-Page Brief Fields (`S.pages[i].brief`)

| Field | Type | Description |
|---|---|---|
| `generated` | boolean | Whether a brief has been generated |
| `summary` | string | Full brief text (markdown-formatted) |
| `generatedAt` | number | Timestamp of generation |
| `approved` | boolean | Locked for copy generation |
| `score` | object | `{ passed, total, checks[] }` — AI evaluation scorecard |
| `drafts` | array | Version history: `[{ v, summary, score, generatedAt }]` — max 2 kept |
| `activeDraft` | number | Index into `drafts[]` for current version |
| `_requestNewVersion` | boolean | Flag to push a new version instead of overwriting |

### Per-Page Supporting Fields (set by Briefs stage)

| Field | Type | Set By |
|---|---|---|
| `supporting_keywords` | array | AI Assign / manual picker |
| `assignedQuestions` | array | AI Assign / Page Questions / manual picker |
| `serpIntel` | object | SERP Intel fetch (cached per keyword) |
| `serpIntel._keyword` | string | Cache key — skips re-fetch if matches `primary_keyword` |
| `pageContext` | string | Free-text human context per page |
| `pageFiles` | array | Uploaded reference files `[{ name, type, data }]` |
| `updatedAt` | number | Timestamp of last brief edit/generation |
| `nicheKws` | array | Niche keyword expansion results |

---

## UI Architecture

### Layout

The Briefs stage uses an **accordion layout** — pages are grouped by type and collapsed by default. Click a row header to expand the full brief card.

### Page Groups (render order)

| Group | Types | Notes |
|---|---|---|
| Recently Edited | any | Top 3 by `updatedAt`, always shown first |
| Core | home, about, contact, utility | |
| Services | service | |
| Industry | industry | |
| Locations | location | |
| Blog | blog | |
| Other | everything else | Catch-all |

### Collapsed Row Header

Each collapsed row shows:
- **Icon** — type-specific (home, briefcase, map-pin, factory, article, file)
- **Page name** — bold if approved
- **Priority badge** — P1 (green), P2 (amber), P3 (grey)
- **Status badge** — "✓ Approved" (green), score percentage (colour-coded), "Briefed", or "No brief"
- **Keyword count** — e.g. "12 kw"
- **Question count** — e.g. "8 q"
- **Primary keyword + slug** — monospace, below page name
- **Chevron** — up/down toggle indicator

### Expanded Card (`pageCard()`)

When expanded, each page shows:

1. **Action bar** (top right):
   - Generate / Regenerate button
   - + V2 button (creates new version)
   - Evaluate button (AI scorecard)
   - Approve / Unapprove button
   - Prompt viewer button (eye icon)

2. **Score bar** — evaluation result with passed/total checks, colour-coded progress bar, version pills (V1/V2)

3. **Brief content** — editable textarea with auto-save on blur/change

4. **Keywords section** — assigned supporting keywords with remove buttons, "+" picker to add from pool, curate button (AI reviews and optimises assignments)

5. **Questions section** — assigned questions with remove buttons, "+" picker to add from pool

6. **Page Context** — free-text textarea for human notes (e.g. "lead with the Meridian Health case study"), plus file upload

7. **SERP Intel panel** — competitor analysis (word count, H2 structure, keyword density from top 3 organic results)

---

## Toolbar Buttons

| Button | Function | Description |
|---|---|---|
| Niche KW | `expandNicheKeywords()` | Runs Google Suggest on each page's primary keyword with 10 modifiers, gets DataForSEO volumes |
| Questions | `generateAllPageQuestions()` | One Claude call per page generates 8 targeted FAQs based on primary keyword + page type |
| AI Assign | `aiAssignKeywordsAndQuestions()` | Distributes remaining global PAA questions and keyword pool across pages |
| Write All | `generateAllBriefs()` | Sequential client-side generation for all un-briefed pages |
| Queue All | `queueAllBriefs()` | Submits to Cloudflare Queue for server-side generation (tab-close safe) |

---

## Brief Generation Pipeline

### Pre-Generation Validation

Before generating, warnings are shown (non-blocking) if:
- No primary keyword assigned (non-structural pages)
- No questions assigned
- No business overview or value proposition in research/strategy
- No primary CTA defined in strategy

### Context Assembly

The brief prompt is built from multiple context blocks:

| Context Block | Source | Content |
|---|---|---|
| `ctxBusiness` | `S.research` + `S.strategy` | Client name, industry, value proposition, differentiators, proof points, brand voice, slogan, words to avoid/use, booking flow, pricing |
| `_voiceRules` | `S.strategy.brand_strategy.voice_overlays[overlay]` | Vertical-specific voice rules from page's `voice_overlay` field |
| `_personaCtx` | `S.strategy.audience.personas[]` | Target persona's role, frustrations, decision criteria, language patterns |
| `ctxWebStrategy` | `S.strategy.webStrategy` or `S.setup.webStrategy` | Full website strategy brief |
| `_pageCtx` | `p.pageContext` | Human-written page-specific context |
| `_pageGoal` | `p.page_goal` | Strategic purpose from Sitemap stage |
| `ctxProof` | `S.research` | Case studies, notable clients, awards, team credentials, founder bio, media mentions |
| `ctxCTA` | `S.strategy.positioning` | Primary, secondary, low-commitment CTAs |
| `ctxServicesDetail` | `S.research.services_detail` | Service names, descriptions, pricing, differentiators |
| `ctxAudience` | `S.research` | Primary audience, best customer, buyer roles, pain points, objections, geography |
| `ctxCompetitors` | `S.research.competitors` + `S.strategy.positioning` | Top 3 competitors with weaknesses, plus validated competitive counter and differentiators from Strategy |
| `_directionCtx` | `S.strategy.positioning.selected_direction` | Positioning direction name, thesis, messaging hierarchy — the narrative spine that shapes every brief's angle |
| `ctxSubtraction` | `S.strategy.subtraction` | Cut/restructure verdicts with rationale, recoverable budget — service/utility templates only |
| `ctxEconomics` | `S.strategy.unit_economics` + `S.strategy.channel_strategy.budget_tiers` | Budget tier label, lead volume target, LTV:CAC ratio, volume posture — calibrates CTA aggressiveness. Service/utility templates only |
| `ctxKeywords` | `S.pages[i]` | Primary keyword (vol, KD), supporting keywords, existing ranking keywords |
| `ctxQuestions` | `S.pages[i].assignedQuestions` | Numbered question list |
| `ctxInternalLinks` | `S.pages[]` | Up to 8 service/location/industry pages with slugs and keywords |
| `serpBriefBlock` | `S.pages[i].serpIntel` | Top 3 SERP competitor word counts, H2 structures, KD |

### Three Brief Templates

The system routes to different templates based on page type:

#### Template 1: Service / Location / Industry
- **System:** "Senior CRO + SEO strategist. CRO and SEO equally important."
- **Sections:** Reader Profile, Unique Angle, H1 + Title Tag, Conversion Architecture, Page Structure (H2 Skeleton), Keyword Integration Notes, FAQ Section, Internal Links, Word Count + Format Target, E-E-A-T Inputs Required
- **Focus:** Conversion architecture is the spine — every section serves both search intent AND moves reader toward CTA

#### Template 2: Blog / FAQ / Resource
- **System:** "Senior content strategist and SEO specialist. E-E-A-T, unique insight, backlink potential."
- **Sections:** Reader Profile + Awareness Stage, Unique Angle + Contrarian Hook, Headline Options, Article Structure (H2 Skeleton), Intro Requirements, E-E-A-T Inputs, Backlink Potential Inputs, FAQ Section, Internal Links + Soft CTA, Word Count + Skimmability Format
- **Focus:** Editorial quality, original angles, backlink-worthy content — "never produce a brief that would result in generic AI-flavoured content"

#### Template 3: Home / About / Utility
- **System:** "Senior brand strategist and conversion copywriter. Brand voice and trust signals drive performance."
- **Sections:** Page Purpose + Search Intent, Brand Voice Direction, H1 + Above-Fold Content, Page Structure (H2 Skeleton), Trust Signal Requirements, CTA Architecture, Keyword + Intent Integration, Word Count + Format
- **Focus:** Brand touchpoints — trust signals, voice direction, shorter format (4-7 sections)

### SERP Intel Integration

Before brief generation, SERP Intel is fetched silently:
1. Check cache: if `p.serpIntel._keyword === p.primary_keyword`, use cached data
2. Otherwise, call `/api/serp-intel` with keyword + country
3. Returns top 3 organic competitor pages with: word count, H2 structure, keyword density
4. Word count target is set at max competitor word count × 1.05
5. Non-fatal — brief generates without SERP data if fetch fails

### Post-Generation

1. Brief text stored in `p.brief.summary`
2. Version management: overwrites current draft, or pushes new version if `_requestNewVersion` flag set
3. Max 2 drafts kept — oldest dropped when V3 is pushed
4. Content div updated in-place (no full re-render, preserves scroll)
5. Auto-evaluation triggered after 300ms delay

---

## Version System

| Action | Result |
|---|---|
| Generate (first time) | Creates V1 as `drafts[0]` |
| Regenerate (same version) | Overwrites current `drafts[activeDraft]` |
| + V2 button | Sets `_requestNewVersion = true`, then generates — pushes new draft |
| V3+ | Oldest draft is dropped (max 2 kept) |
| Version pills | Click V1/V2 pills to switch `activeDraft` and display that version's text |

---

## AI Evaluation Scorecard (`scoreBrief()`)

AI evaluates the brief against 9-12 checks depending on page type and data:

1. **Reader profile** — specific person described, not generic
2. **H1** — contains primary keyword in first 3 words
3. **CTA presence** — primary CTA explicitly placed
4. **Objection handling** — at least one objection addressed
5. **Trust signals** — specific proof/evidence referenced
6. **SERP word count** — meets or exceeds competitor target
7. **H2 coverage** — sufficient section depth for page type
8. **Page goal alignment** — brief serves the strategic purpose
9. **Keyword integration** — primary + supporting keywords placed
10. **FAQ section** — uses assigned questions (if any)
11. **Internal links** — cross-links to other pages specified
12. **Persona alignment** *(conditional — only if `p.target_persona` assigned)* — brief addresses target persona's specific frustrations, uses their language patterns, acknowledges their decision criteria

Score displayed as percentage with colour coding:
- **≥ 80%** — green
- **≥ 55%** — amber/warning
- **< 55%** — red

---

## Keyword & Question Assignment

### Keyword Pool (`getBriefKwPool()`)

Available keywords come from:
- `S.kwResearch.keywords` — full keyword research pool
- Minus: already-assigned keywords across all pages
- Minus: primary keywords already claimed by pages

### Question Pool (`getBriefQPool()`)

Available questions come from:
- `S.kwResearch.paaQuestions` — People Also Ask from research
- `S.pages[i].generatedQuestions` — AI-generated per-page questions
- Minus: already-assigned questions across all pages

### AI Assign (`aiAssignKeywordsAndQuestions()`)

Global assignment: Claude distributes remaining keywords and questions across pages based on relevance. Skips already-assigned items (no duplicates).

### Per-Page Curate (`curateBriefAssignments()`)

Per-page curation: Claude reviews what's currently assigned to a specific page, keeps what matches intent, drops what doesn't, replaces with better fits from pool. Shows removal count ("✓ Curated (3 removed)").

### Manual Picker

Each brief card has "+" buttons for keywords and questions that open a searchable dropdown picker. Items can be individually removed with × buttons.

---

## Queue-Based Bulk Generation

### Client-Side (`generateAllBriefs()`)

- Sequential loop through all non-utility pages
- 400ms delay between pages (UI breathing room)
- Stop/Resume supported via `window._aiStopAll`
- Updates button state (spinner → "Regenerate All")

### Server-Side (`queueAllBriefs()`)

1. Collects all un-generated pages as jobs: `{ type: 'brief', slug, pageIdx }`
2. POSTs to `/api/queue-submit`
3. Starts polling `/api/queue-status` every 4 seconds
4. Worker consumer (`worker.queue()` in `worker.js`):
   - Loads full project from KV
   - Fetches SERP data for the page's primary keyword
   - Calls Claude with same prompt structure as client-side
   - Writes brief back to project in KV with version increment
5. Client poll detects completion → reloads project from KV → re-renders
6. Tab-close safe — worker generates even if browser tab is closed
7. Progress shown via `aiBarQueue()` with percentage bar and ETA

---

## Niche Keyword Expansion

### Global (`expandNicheKeywords()`)

For each page with a primary keyword:
1. Calls `/api/niche-expand` — runs Google Suggest with 10 modifier prefixes
2. Gets DataForSEO volumes for discovered terms
3. Stores results in `p.nicheKws[]`
4. Tagged by page slug so AI Assign knows which keywords belong where

### Per-Page (`expandNicheKwsForPage()`)

Same as global but runs for a single page. Triggered by "⌖ Niche KW" button on each brief card.

---

## Page Questions Generation

### Global (`generateAllPageQuestions()`)

One Claude call per page generates 8 targeted FAQs based on:
- Primary keyword
- Page type
- Business context
- Audience pain points

Results stored in `p.generatedQuestions[]` and auto-assigned to `p.assignedQuestions[]`.

### Per-Page

Triggered by "? Questions" button on each brief card.

---

## SERP Intel (`buildSerpIntelBlock()`)

Formats the cached SERP Intel data into a prompt-ready block:

```
Competitor 1: example.com/page — 2,400 words
  H2s: "What is X", "Benefits of X", "How to Choose X"
  KW density: 1.8%

Competitor 2: other.com/guide — 1,900 words
  H2s: "X Overview", "X vs Y", "FAQ"
  KW density: 2.1%

→ Target word count: 2,520 (max competitor × 1.05)
```

---

## Strategy Integration Points

### From Sitemap (Stage 5)

| Field | Used In | Purpose |
|---|---|---|
| `p.page_goal` | Brief prompt (all templates) | Strategic purpose — "every section must serve this goal" |
| `p.target_persona` | `_personaCtx` block | Persona's frustrations, decision criteria, language patterns injected into business context |
| `p.voice_overlay` | `_voiceRules` block | Vertical-specific voice rules appended to brand voice line |
| `p.page_type` | Template routing | Determines which of 3 brief templates is used |
| `p.action` | Brief prompt | "build_new" vs "improve_existing" — affects AI approach |
| `p.primary_keyword` | Keyword context + SERP Intel trigger | Primary SEO target |
| `p.supporting_keywords` | Keyword context | Secondary keyword targets |
| `p.existing_ranking_kws` | Keyword context | Current rankings to preserve |
| `p.existing_traffic` | Brief prompt (service template) | Monthly organic traffic context |

### From Strategy (Stage 4)

| Field Path | Used In | Purpose |
|---|---|---|
| `positioning.value_proposition` | `ctxBusiness` | Core value prop |
| `positioning.key_differentiators` | `ctxBusiness` | Competitive advantages |
| `positioning.primary_cta` | `ctxCTA` | Primary conversion action |
| `positioning.secondary_ctas` | `ctxCTA` | Secondary CTAs (array, joined) |
| `positioning.low_commitment_cta` | `ctxCTA` | Low-friction entry point |
| `brand_strategy.voice_style` | `ctxBusiness` | Brand voice direction |
| `brand_strategy.tone_and_voice` | `ctxBusiness` | Tone guidance |
| `brand_strategy.words_to_avoid` | `ctxBusiness` | Banned terms |
| `brand_strategy.words_to_use` | `ctxBusiness` | Preferred terms |
| `brand_strategy.voice_overlays[overlay]` | `_voiceRules` | Vertical-specific voice rules |
| `audience.personas[]` | `_personaCtx` | Target persona details |
| `positioning.selected_direction` | `_directionCtx` | Strategic positioning direction — name, thesis, messaging hierarchy |
| `positioning.competitive_counter` | `ctxCompetitors` | Validated competitive counter from positioning diagnostic |
| `positioning.validated_differentiators` | `ctxCompetitors` | Strategy-validated differentiators (sharper than research-level) |
| `subtraction.current_activities_audit` | `ctxSubtraction` | Cut/restructure verdicts — service/utility only |
| `subtraction.total_recoverable_monthly` | `ctxSubtraction` | Recoverable budget figure |
| `subtraction.subtraction_summary` | `ctxSubtraction` | Executive summary of waste found |
| `unit_economics` | `ctxEconomics` | CAC, LTV, lead targets — calibrates CTA aggressiveness |
| `channel_strategy.budget_tiers` | `ctxEconomics` | Budget tier label for CTA posture |
| `webStrategy` | `ctxWebStrategy` | Full website strategy brief |

### From Research (Stage 3)

| Field | Used In | Purpose |
|---|---|---|
| `business_overview` | Pre-gen validation | Warns if missing |
| `client_name` | `ctxBusiness` | Client identifier |
| `industry` | `ctxBusiness` | Industry context |
| `existing_proof` / `proof_points` | `ctxBusiness` | Credibility signals |
| `brand_voice_style` | `ctxBusiness` (fallback) | Voice fallback if no strategy |
| `current_slogan` | `ctxBusiness` | Tagline |
| `current_pricing` / `pricing_notes` | `ctxBusiness` | Pricing context |
| `booking_flow_description` | `ctxBusiness` | How customers buy |
| `case_studies` | `ctxProof` | Client + result + timeframe |
| `notable_clients` | `ctxProof` | Social proof |
| `awards_certifications` | `ctxProof` | Authority signals |
| `team_credentials` | `ctxProof` | Expertise proof |
| `founder_bio` | `ctxProof` | Founder authority |
| `publications_media` | `ctxProof` | Media mentions |
| `services_detail` | `ctxServicesDetail` | Service descriptions, pricing, differentiators |
| `primary_audience_description` | `ctxAudience` | Who the audience is |
| `best_customer_examples` | `ctxAudience` | Ideal customer profile |
| `buyer_roles_titles` | `ctxAudience` | Decision-maker roles |
| `pain_points_top5` | `ctxAudience` | Top 3 pain points |
| `objections_top5` | `ctxAudience` | Top 3 objections |
| `target_geography` | `ctxAudience` | Geo targeting |
| `competitors` | `ctxCompetitors` | Top 3 with weaknesses |

---

## Downstream Consumers

| Stage | What It Reads | How |
|---|---|---|
| **Copy (S7)** | `p.brief.summary`, `p.brief.approved` | Copy generation requires approved brief. Full brief text injected into copy prompt. |
| **Layout (S9)** | `p.brief.summary` | H2 skeleton from brief drives wireframe section structure |
| **Schema (S10)** | `p.brief.summary` | FAQ questions from brief → FAQPage schema markup |

---

## Key Functions

| Function | Lines | Description |
|---|---|---|
| `renderBriefs()` | 775-1127 | Main render — toolbar, stats, grouped accordion |
| `pageCard(p, pidx)` | 220-1005 | Full expanded card: action bar, score, content, keywords, questions, context, SERP |
| `generatePageBrief(pageIdx)` | 1130-1516 | Single page brief generation: validation → context assembly → template routing → Claude call → version management → auto-evaluate |
| `scoreBrief(pageIdx)` | ~600-770 | AI evaluation scorecard |
| `generateAllBriefs(startFrom)` | 1644-1668 | Sequential bulk generation with stop/resume |
| `queueAllBriefs()` | 1525-1560 | Server-side queue submission |
| `_pollQueueStatus()` | 1572-1629 | Queue progress polling (4s interval) |
| `assignContentPillars()` | — | (In sitemap.js) Assigns pillars, but brief cards show them |
| `aiAssignKeywordsAndQuestions()` | ~250-400 | Global keyword + question distribution |
| `curateBriefAssignments(pidx)` | ~400-500 | Per-page AI curation of assignments |
| `expandNicheKeywords()` | ~500-580 | Global niche keyword expansion |
| `generateAllPageQuestions()` | ~580-650 | Bulk question generation |
| `briefTogglePicker(pidx, type)` | 2-60 | Keyword/question picker dropdown |
| `getBriefKwPool(pidx)` | ~60-100 | Available keyword pool calculation |
| `getBriefQPool(pidx)` | ~100-140 | Available question pool calculation |
| `buildSerpIntelBlock(p)` | ~140-220 | Formats SERP Intel for prompt injection |

---

## Event Handling

### Delegated Events (document-level)

- **`.brief-row-header` click** — toggles accordion open/close via `window._briefOpen` Set
- **`.brief-ta` blur/input** — saves brief text edits back to `p.brief.summary` + `scheduleSave()`
- **`.brief-pick-item` click** — adds keyword/question from picker
- **`.brief-picker-search` input** — filters picker dropdown items
- **`.brief-ctx-ta` blur/input** — saves page context to `p.pageContext` + `scheduleSave()`

### Auto-Save

All textareas auto-save on blur. Brief text changes update the active draft in `p.brief.drafts[]`.

---

## Input Size Estimation

Before calling Claude, the function estimates input token count:
```
estimatedInputTokens = (sysPrompt + prompt).length / 3.5
```
If > 12,000 tokens, a warning is shown: "Large input (~Xk tokens) — brief may take longer".

Max output tokens: 8,000 per brief.

---

## Error Handling

- **Card-level try/catch** — individual card render errors show inline error message without crashing the whole page
- **Render-level try/catch** — full render errors show error div
- **Generation errors** — shown in stream element, button changes to "↺ Retry"
- **AbortError** — silently returns (user cancelled via Stop button)
- **SERP Intel failure** — non-fatal, brief generates without competitor data
- **Queue errors** — shown in status element, button re-enabled

---

## Known Patterns & Constraints

1. **Approved briefs are locked** — Copy stage will not process a page without `p.brief.approved === true`
2. **Version limit is 2** — V1 is dropped when V3 is pushed. No undo beyond that.
3. **SERP Intel cache** — keyed by `serpIntel._keyword`. Change the primary keyword → cache invalidated → re-fetches on next generation.
4. **Queue consumer mirrors prompt logic** — `worker.js` has its own brief prompt assembly with full feature parity: voice overlay, persona context, positioning direction, competitive counter, subtraction, economics, three templates. Changes to prompt structure must be mirrored in both files.
5. **`getStrategyField()` fallback chain** — reads `S.strategy.{path}` first, falls back to `S.research.{fallback}`. Ensures briefs work even without a completed strategy.
6. **Input filter on `ctxBusiness`** — empty fields are stripped: `.filter(l => l && l.trim() && (l.indexOf(': ') < 0 || l.split(': ')[1]))` — prevents "Value proposition: " with no value from entering the prompt.
7. **Page geo** — uses `getPageGeo(p)` which checks `p.targetGeo`, then falls back to research/setup geo. Multi-market pages get location-appropriate briefs.
8. **Canadian spelling** — explicitly stated in all three template system prompts.
