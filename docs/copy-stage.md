# Stage 7 — Copy: Complete Technical Reference

> **File:** `copy.js` (~1367 lines)
> **Renders in:** `#screen-copy` via `renderCopyQueue()`
> **Depends on:** `index.html` (shared helpers, `countKeywordsInCopy`, `saveCopyHtml`, `copyToClip2`), `prompts.js` (`P.copy` system prompt), `strategy.js` (`getStrategyField()`), `worker.js` (queue consumer for copy jobs)

---

## Purpose

Generates full-page HTML copy from approved content briefs (Stage 6). Each page goes through a multi-pass pipeline: Pass 1 writes initial copy from the brief, an AI audit scores structural/content quality, Pass 2 surgically fixes failed checks, and Pass 3 injects E-E-A-T signals (proof, credentials, case studies). Human QC verifies claims, pricing, and brand voice before approval.

Copy is the largest output artifact — it becomes the actual website content consumed by Layout (wireframes), Schema (FAQ JSON-LD), and Export (final handoff).

---

## Data Model

### Per-Slug Copy Data (`S.copy[slug]`)

| Field | Type | Description |
|---|---|---|
| `copy` | string | Active HTML copy (from currently selected draft) |
| `drafts` | array | Version history: `[{ v, html, pass, generatedAt }]` |
| `activeDraft` | number | Index into `drafts[]` for current version |
| `audit` | object | `{ checks[], passed, total, humanFlags[], auditedAt }` — AI evaluation |
| `humanQC` | object | `{ [key]: boolean }` — human verification checklist state |
| `approved` | boolean | Locked for Schema stage |
| `approvedAt` | number | Timestamp of approval |
| `writtenAt` | number | Timestamp of Pass 1 generation |
| `page` | object | Snapshot of page object at generation time (may be stale) |
| `error` | string | Error message if generation failed |

### Per-Page Meta Tags (set by Copy stage, stored on `S.pages[i]`)

| Field | Type | Set By |
|---|---|---|
| `meta_title` | string | Auto-generated after Pass 1 via `generateMetaTags()` |
| `meta_description` | string | Auto-generated after Pass 1, editable in Copy UI |

---

## UI Architecture

### Layout

The Copy stage uses an **accordion layout** identical to Briefs — pages grouped by type, expand inline on click.

### Page Groups (render order)

| Group | Types | Notes |
|---|---|---|
| Core Pages | home, about, utility, contact | |
| Services | service | |
| Industry & Location | industry, location | |
| Blog Posts | blog | |
| Other | everything else | Catch-all |

### Collapsed Row Header

Each collapsed row shows:
- **Status circle** — green check (done), red ! (error), spinner (running), number (pending)
- **Type icon** — home, briefcase, factory, map-pin, article, file
- **Page name** — bold if done
- **Priority badge** — P1 (green), P2 (amber), P3 (grey)
- **Slug** — monospace below page name
- **Chevron** — expand/collapse indicator

### Expanded Card (pending state)

Shows:
- **Brief badge** — "✓ Brief" (green, approved), "⚠ Not approved" (amber), "No brief" (grey)
- **Primary keyword** — displayed inline
- **SERP Intel button** — "✓ SERP Intel (3)" if loaded, "⟳ SERP Intel" if not
- **Write Copy button** — primary action

### Expanded Card (completed state)

Shows 7 sections stacked vertically:

1. **Info bar** — primary keyword, search intent, word count target, brief status
2. **Stale brief banner** — green alert if brief was approved after copy was written ("Redo to regenerate using the brief")
3. **Meta tags** — editable title (50-60 char counter) and description (150-160 char counter), auto-generated after Pass 1
4. **Draft tabs + toolbar** — version pills (v1, v2, v3...) with pass labels, Copy HTML / Show code / Edit buttons
5. **Preview / Code / Stream** — rendered HTML preview (with scoped styles), raw HTML code view, generation stream view
6. **Keyword density strip** — all keywords with occurrence counts, colour-coded (red=0, amber=1, green=2+)
7. **AI Audit** — score bar with check results, Pass 2 / Pass 3 buttons
8. **Human QC** — checklist with AI-flagged claims + page-type-specific verification items
9. **Bottom bar** — Redo, SERP Intel refresh, Approve for Schema button
10. **Next page** — "Write: [next page name]" + "Skip to Schema" buttons

---

## Copy Generation Pipeline

### System Prompt (`P.copy` in `prompts.js`)

The copy system prompt defines a 10-section page structure:
1. Hero (H1 + primary CTA above fold)
2. Social Proof Strip (logos, ratings)
3. Problem/Agitation (audience pain)
4. Solution Bridge (outcome ownership)
5. Services / What's Included (benefit-led)
6. Process (3-5 numbered steps)
7. Proof Section (case studies, testimonials)
8. Objection Handling (pre-empt buying objections)
9. FAQ (minimum 8 questions, long-tail keywords)
10. Final CTA Section (restate outcome, repeat CTA)

### User Prompt Assembly (`buildCopyPrompt()`)

Two prompt paths based on page type:

#### Blog Pages
| Field | Source |
|---|---|
| CLIENT | `S.setup.client` |
| BLOG POST TITLE | `page.page_name` |
| PRIMARY KEYWORD | `page.primary_keyword` |
| SUPPORTING KEYWORDS | `page.supporting_keywords` joined |
| TARGET WORD COUNT | `page.word_count_target` or 1200 |
| BUSINESS OVERVIEW | `S.research.business_overview` |
| GEOGRAPHY | `getPageGeo(page)` |
| VOICE | `brand_strategy.tone_and_voice` → `S.setup.voice` fallback |
| SLOGAN | `S.research.current_slogan` |
| WORDS TO AVOID | `brand_strategy.words_to_avoid` |
| NOTES | `page.notes` |
| FAQ targets | `page.assignedQuestions` as numbered list |
| Brief | Full approved brief text (if approved) |
| SERP Intel | `buildSerpIntelBlock(page)` — competitor word counts, H2s, gap directives |
| Proof & E-E-A-T | Case studies, notable clients, awards, team credentials, founder bio |
| CTA Architecture | Primary, secondary, low-commitment CTAs from Strategy |
| Website Strategy | Full web strategy brief |
| Page Context | Human-written `page.pageContext` |
| Page Goal | Strategic purpose from Sitemap stage |

#### All Other Pages (service, location, industry, home, about, utility)
Same fields as blog plus:
| Field | Source |
|---|---|
| PAGE | `page_name | /slug` |
| INTENT | `page.search_intent` |
| WORD COUNT MIN | `page.word_count_target` or 1500 |
| VALUE PROP | `positioning.value_proposition` |
| DIFFERENTIATORS | `positioning.key_differentiators` joined |
| PRICING | `S.setup.pricing` → `S.research.current_pricing` fallback |
| WORDS TO USE | `brand_strategy.words_to_use` |
| AUDIENCE PAIN POINTS | `S.research.pain_points_top5` (top 3) |
| BUYER OBJECTIONS | `S.research.objections_top5` (top 3) |
| PROOF POINTS | `S.research.existing_proof` (top 3) |
| BOOKING FLOW | `S.research.booking_flow_description` |

### Brief Integration

If `page.brief.approved` and brief text > 50 chars:
- Full brief text is injected as `## APPROVED CONTENT BRIEF` block
- Instruction changes to: "Follow the approved brief above — H1, H2 structure, CTA positions, word count, objections, trust signals, FAQ questions, and E-E-A-T inputs exactly"

Without an approved brief:
- Generic instruction: "Write the complete page" (service) or full blog structure instructions (blog)

### SERP Intel Integration

`buildSerpIntelBlock(page)` formats cached SERP data into the prompt:
- Per-competitor: URL, title, meta description, H1, H2s (up to 12), word count, keyword density
- Gap directives: word count target (max × 1.05), keyword density guidance, H2 coverage topics, title trust signal instruction, meta description out-sell instruction

### Post-Generation

1. Copy HTML stored in `S.copy[slug].copy`
2. Draft created as `{ v, html, pass: 1, generatedAt }` — Pass 1 replaces all drafts (fresh run)
3. Auto-generates meta tags in background (`generateMetaTags()` — separate Claude call)
4. Auto-advances to next incomplete page
5. Copy HTML also saved to separate KV key via `saveCopyHtml(slug)` (defined in index.html)

---

## Multi-Pass System

### Pass 1 — Initial Generation (`runCopyPage()`)

- Calls Claude with `P.copy` system prompt + `buildCopyPrompt()` user prompt
- Max tokens: 6,000
- Creates fresh draft, resets audit and approval
- Triggers auto meta tag generation

### Pass 2 — Surgical Fix (`runCopyPass2()`)

Triggered when audit has failed checks:
- System prompt: "Fix ONLY the specific failed checks listed below"
- Sends: compact page context, assigned FAQ questions, passing checks (preserve), failed checks (fix), trimmed existing HTML (7,500 chars, styles stripped)
- Instructions emphasise: output COMPLETE HTML, do NOT truncate, fix word count by expanding thin sections, add FAQ if missing
- Max tokens: 6,000
- Validates result is actual HTML (> 500 chars, contains `<`)
- Creates new draft version, clears audit
- Auto-triggers re-audit after 600ms

### Pass 3 — E-E-A-T Enhancement (`runCopyPass3()`)

Triggered when audit passes (100%):
- System prompt: "E-E-A-T specialist — add Experience, Expertise, Authoritativeness, Trust signals"
- Sends: full existing copy + E-E-A-T material (proof points, case studies, team credentials, awards, notable clients, page context)
- Rules: add specific stats/results, make social proof concrete, flag missing material with `<!-- MISSING: -->` comments, never invent proof
- Max tokens: 6,000
- Creates new draft version (keeps up to 3 drafts for Pass 3)
- Clears audit — must re-audit after E-E-A-T injection

---

## AI Copy Audit (`runCopyAudit()`)

### Pre-Calculation (Client-Side)

Before calling Claude, the audit computes:
- **Word count** — stripped HTML → word count
- **Keyword density** — `countKeywordsInCopy()` counts exact primary keyword occurrences, calculates percentage
- These become `_prePass` checks that bypass AI judgment (deterministic)

### Universal Checks (all page types, 8 checks)

| ID | Check |
|---|---|
| `h1_kw` | H1 tag contains primary keyword verbatim (exact match) |
| `pk_intro` | Primary keyword appears within first 120 words |
| `intent` | Page satisfies search intent throughout |
| `no_placeholders` | No [placeholder], [INSERT], [TBD] remaining |
| `wordcount` | Word count ≥ minimum target |
| `canadian` | Canadian spelling (-our, -re, -yse) — NOTE: -ize endings are correct in Canadian English |
| `unique` | Specific differentiating angle, not generic claims |
| `no_fluff` | No filler phrases ("in today's world", "leverage", "synergy") |

### Page-Type Specific Checks

| Page Type | Additional Checks |
|---|---|
| **Blog** | 5-12 H2s, skimmable format, E-E-A-T signals, hook intro, headline promise delivered |
| **Home** | Value prop above fold, CTA above fold, social proof, multiple entry points |
| **Location** | Local signals accurate, CTA references city, social proof, FAQ (6+) |
| **Utility / Contact** | Meta title/description present |
| **Service / Industry / Other** | Specific social proof with measurable results, CTA before fold, objection handling, FAQ (8+), 2+ concrete differentiators |

### SERP Comparison Checks (conditional — when SERP Intel available)

| ID | Check |
|---|---|
| `serp_title` | Title trust signals ≥ top competitor |
| `serp_meta` | Meta description beats competitor CTR |
| `serp_h2_coverage` | H2 structure covers key competitor topics |
| `serp_wordcount` | Word count ≥ competitor-calibrated target (max × 1.05) |
| `serp_kw_density` | Keyword density within competitor range (pre-calculated, deterministic) |

### Universal Density Check (always shown)

| ID | Check |
|---|---|
| `kw_density` | Keyword density 0.3%–3.0% (pre-calculated, deterministic) |

### Audit Output

Claude returns JSON: `{ checks: [{ id, pass: boolean, note }], humanFlags: [{ item, reason, severity }] }`

- `humanFlags` surface specific claims that need human verification (max 5)
- Pre-calculated checks (`_prePass`) bypass AI result — deterministic density/word count
- Score displayed as percentage: ≥80% green, ≥55% amber, <55% red

---

## Human QC System

### Purpose

AI handles structural/content checks. Human QC verifies things AI cannot confirm: real-world accuracy, brand voice, working links, approved proof.

### Universal Items (all page types, 6 items)

| Key | Label | Note |
|---|---|---|
| `stats_verified` | Stats & numbers verified | Every %, $, count confirmed against real source |
| `proof_approved` | Client proof approved for use | Named clients, logos, testimonials have permission |
| `offer_accurate` | Offer & pricing current | Guarantees, pricing anchors match current offering |
| `links_working` | CTAs & links work | Every button and link tested |
| `voice_on_point` | Brand voice on-point | Sounds like us — direct, confident, not generic AI copy |
| `no_stale_content` | No stale content | No outdated team, discontinued services, old events |

### Page-Type Specific Items

| Page Type | Key | Label |
|---|---|---|
| Service / Industry | `pricing_current` | Pricing anchor is current |
| Location | `local_accurate` | Local details accurate (address, phone, service radius) |
| About | `team_accurate` | Team info & photos accurate |
| Blog | `sources_real` | Sources & links are real |
| Contact | `form_tested` | Form tested & working |
| Home | `primary_cta_live` | Primary CTA destination live |

### Approval Gate

When approving copy, if any QC items are unchecked, a confirmation dialog lists them. User can still approve — it's a warning, not a blocker.

---

## Meta Tag Generation (`generateMetaTags()`)

Auto-triggered after Pass 1 completes:
- Sends page name, primary keyword, slug, and first 8,000 chars of stripped copy text
- Claude returns JSON: `{ title, description }`
- Rules: title 50-60 chars with keyword near start + brand at end, description 150-160 chars action-oriented
- Non-fatal — copy renders fine without meta tags
- Editable inline in the Copy UI with character counters

---

## Version System

| Action | Result |
|---|---|
| Pass 1 | Creates fresh `drafts[0]` — replaces all previous drafts |
| Pass 2 | Pushes new draft with `pass: 2` — previous drafts kept |
| Pass 3 | Pushes new draft with `pass: 3` — max 3 kept (oldest dropped) |
| Draft pills | Click to switch `activeDraft`, updates `copy` field to that draft's HTML |

---

## SERP Intel (`buildSerpIntelBlock()`)

Shared function used by both Copy and Briefs. Formats cached SERP data:

```
## SERP INTEL — "keyword" (top organic competitors)

### Competitor 1 — example.com/page
- Title: "..."
- Meta: "..."
- H1: "..."
- H2s: ... | ... | ...
- Words: ~2,400 | Keyword "keyword" appears 12x (1.8%)

### GAP DIRECTIVES — follow these exactly:
WORD COUNT: Write minimum 2,520 words (competitor max × 1.05)
KEYWORD DENSITY: Competitors avg 1.8% — target similar density
H2 COVERAGE: Cover or exceed: topic1 | topic2 | topic3
TITLE & TRUST SIGNALS: Match or beat strongest competitor signal
META DESCRIPTION: Out-sell competitor metas
```

---

## Queue-Based Bulk Generation

### Worker Copy Consumer (`worker.js` line ~2405)

Currently minimal compared to the brief consumer:
- Loads project from KV
- Reads `page.brief.summary` — fails if no brief
- Basic system prompt: "Write complete, publish-ready page HTML from this brief"
- Basic user prompt: brief text + "Write the full page copy as clean HTML"
- Saves to `copy:{projectId}:{slug}` KV key with draft version

**Note:** The worker copy consumer does NOT use `buildCopyPrompt()` — it has a simplified prompt that lacks most of the context the client-side version includes (no research context, no strategy fields, no SERP Intel, no page context, no web strategy, no page goal). This is a known parity gap.

---

## Visual Edit Mode (`toggleCopyEdit()`)

- Makes the preview div `contentEditable`
- Green border + text cursor indicates edit mode
- On save: serialises `innerHTML` back to `S.copy[slug].copy`, syncs code view, saves to KV
- Code view and edit mode are mutually exclusive — entering edit mode hides code view

---

## Strategy Integration Points

### From Briefs (Stage 6)

| Field | Used In | Purpose |
|---|---|---|
| `p.brief.summary` | `buildCopyPrompt()` | Full brief text injected when approved |
| `p.brief.approved` | Pre-check | Required for brief-driven generation |
| `p.brief.approvedAt` | Stale banner | Compared to `writtenAt` for stale detection |

### From Strategy (Stage 4) via `getStrategyField()`

| Field Path | Used In | Purpose |
|---|---|---|
| `positioning.value_proposition` | `buildCopyPrompt()` | Core value prop (non-blog pages) |
| `positioning.key_differentiators` | `buildCopyPrompt()` | Competitive advantages (non-blog) |
| `positioning.primary_cta` | CTA block | Primary conversion action |
| `positioning.secondary_cta` | CTA block | Secondary CTA |
| `positioning.low_commitment_cta` | CTA block | Low-friction entry point |
| `brand_strategy.tone_and_voice` | `buildCopyPrompt()` | Brand voice direction |
| `brand_strategy.words_to_avoid` | `buildCopyPrompt()` | Banned terms |
| `brand_strategy.words_to_use` | `buildCopyPrompt()` | Preferred terms (non-blog) |
| `webStrategy` | `buildCopyPrompt()` | Full website strategy brief |

### From Research (Stage 3)

| Field | Used In | Purpose |
|---|---|---|
| `business_overview` | `buildCopyPrompt()` | Business context |
| `current_slogan` | `buildCopyPrompt()` | Tagline |
| `current_pricing` / `pricing_notes` | `buildCopyPrompt()` | Pricing context (non-blog) |
| `pain_points_top5` | `buildCopyPrompt()` | Top 3 audience pain points (non-blog) |
| `objections_top5` | `buildCopyPrompt()` | Top 3 buyer objections (non-blog) |
| `existing_proof` / `proof_points` | `buildCopyPrompt()` + Pass 3 | Credibility signals |
| `booking_flow_description` | `buildCopyPrompt()` | How customers buy (non-blog) |
| `case_studies` | Pass 3 | Client + result + timeframe |
| `notable_clients` | Pass 3 | Social proof logos |
| `awards_certifications` | Pass 3 | Authority signals |
| `team_credentials` | Pass 3 | Expertise proof |
| `founder_bio` | Pass 3 | Founder authority |

### From Sitemap (Stage 5)

| Field | Used In | Purpose |
|---|---|---|
| `p.page_name` | `buildCopyPrompt()` | Page title |
| `p.slug` | KV key, prompt | URL path |
| `p.primary_keyword` | `buildCopyPrompt()`, audit | Primary SEO target |
| `p.supporting_keywords` | `buildCopyPrompt()`, audit | Secondary keywords |
| `p.search_intent` | `buildCopyPrompt()`, audit | Intent check |
| `p.word_count_target` | `buildCopyPrompt()`, audit | Word count validation |
| `p.page_type` | Template routing, QC items | Determines audit checks |
| `p.page_goal` | `buildCopyPrompt()` | Strategic purpose |
| `p.pageContext` | `buildCopyPrompt()`, Pass 3 | Human context |
| `p.notes` | `buildCopyPrompt()` | Miscellaneous notes |
| `p.serpIntel` | `buildSerpIntelBlock()` | SERP competitor data |
| `p.assignedQuestions` | `buildCopyPrompt()`, Pass 2 | FAQ targets |
| `p.targetGeo` | `getPageGeo()` | Market override |
| `p.existing_ranking_kws` | — | Not used in copy (used in briefs) |

---

## Downstream Consumers

| Stage | What It Reads | How |
|---|---|---|
| **Schema (S10)** | `S.copy[slug].copy`, `S.copy[slug].approved` | Copy must be approved. FAQ section extracted for FAQPage JSON-LD. |
| **Layout (S9)** | `S.copy[slug].copy` | Full HTML drives wireframe section structure |
| **Export (S11)** | `S.copy[slug].copy`, `p.meta_title`, `p.meta_description` | Final copy + meta packaged for handoff |

---

## Key Functions

| Function | Lines | Description |
|---|---|---|
| `buildCopyPrompt(page)` | 109-191 | Assembles full user prompt — blog vs non-blog routing, brief injection, SERP Intel, proof, CTA, web strategy, page context |
| `runCopyPage(slug)` | 193-241 | Pass 1: generates initial copy, creates draft, auto-meta, auto-advance |
| `runCopyAudit(slug)` | 380-578 | AI audit with pre-calculated density + dynamic checks, SERP comparison |
| `runCopyPass2(slug)` | 648-738 | Surgical fix pass — failed checks only, preserves passing sections |
| `runCopyPass3(slug)` | 581-645 | E-E-A-T injection — proof, credentials, case studies into existing copy |
| `generateMetaTags(slug, page, copy)` | 358-378 | Auto-generates title + description from copy content |
| `renderCopyQueue()` | 843-1141 | Main render — grouped accordion, expanded cards, audit display, QC checklist |
| `buildSerpIntelBlock(page)` | 69-107 | Formats SERP Intel data for prompt injection |
| `runSerpIntel(slug)` | 31-67 | Fetches SERP data for a page's primary keyword |
| `copyActivateDraft(slug, idx)` | 255-262 | Switches active draft version |
| `copyApprove(slug)` | 300-319 | Toggle approval with QC completeness check |
| `copyToggleQC(slug, key)` | 292-298 | Toggle individual QC item |
| `copyMarkAllQC(slug)` | 272-281 | Mark all / unmark all QC items |
| `toggleCopyCode(slug)` | 740-769 | Toggle HTML code view |
| `toggleCopyEdit(slug)` | 771-811 | Toggle visual edit mode (contentEditable) |
| `populateCopyPreviews()` | 813-841 | Injects sanitised HTML into preview divs after render |
| `updateCopyProgress()` | 1143-1150 | Updates progress bar (count + percentage) |
| `checkCopyAllDone()` | 1152-1159 | Shows completion banner + "Generate Images" button |
| `initCopy()` | 15-20 | Stage initialisation — shows progress, finds first incomplete page |
| `focusCopyPage(slug)` | 2-5 | Sets current slug and re-renders |
| `redoCopyPage(slug)` | 249-253 | Deletes copy and re-renders for fresh generation |
| `getQCItems(pageType)` | 351-355 | Returns universal + type-specific QC items |

---

## Event Handling

### Inline Events

Copy stage uses inline `onclick` attributes (not delegated events like Briefs):
- **Row header click** → `toggleCopyExpand(slug)` — expand/collapse accordion
- **Write Copy button** → `runCopyPage(slug)` — triggers Pass 1
- **Redo button** → `redoCopyPage(slug)` — delete and re-render
- **Draft pills** → `copyActivateDraft(slug, idx)` — switch version
- **QC checkboxes** → `copyToggleQC(slug, key)` — toggle verification
- **Approve button** → `copyApprove(slug)` — toggle with QC warning
- **Meta inputs** → inline `oninput` — direct mutation to `S.pages[i].meta_title/description`

### Auto-Save

- Meta tag inputs save on `oninput` via inline handlers
- Edit mode saves on toggle (serialises `contentEditable` innerHTML)
- All mutations trigger `scheduleSave()`

---

## Known Patterns & Constraints

1. **Approved copy required for Schema** — Schema stage checks `S.copy[slug].approved === true`
2. **Brief-driven generation** — If an approved brief exists, copy follows it exactly. Without a brief, copy uses the generic `P.copy` 10-section template. The brief is always the better path.
3. **Stale brief detection** — If `brief.approvedAt > copy.writtenAt`, a green banner prompts the user to redo. This catches brief improvements made after copy was already generated.
4. **Live page state preference** — Audit and Pass 2/3 always re-fetch page data from `orderedPages()` rather than relying on the stale `c.page` snapshot taken at write time.
5. **Pre-calculated density checks** — `kw_density` and `serp_kw_density` are computed client-side (deterministic) and use `_prePass` to bypass AI judgment. The AI is told to "always return pass:true" for these — the real pass/fail comes from the pre-calculation.
6. **Canadian spelling rule** — The audit explicitly notes that `-ize` endings (optimize, organize, specialize) are CORRECT in Canadian English. Only `-our/-re/-yse` patterns are checked. This prevents false failures on words like "optimize".
7. **Duplicate `getQCItems()` definition** — The function is defined twice in copy.js (lines 321-325 and 351-355). The second definition wins at runtime. Not a bug — same logic — but a cleanup candidate.
8. **Copy stored in two places** — `S.copy[slug]` (in-memory and in full project JSON) AND `copy:{projectId}:{slug}` (separate KV key via `saveCopyHtml()`). The separate KV key avoids the 25MB project size limit for large sites.
9. **Max tokens capped at 6,000** — All copy passes use 6,000 max output tokens. Long pages may need Pass 2 to complete thin sections.
10. **Queue consumer has full prompt parity** — `worker.js` copy consumer builds identical prompts to client-side `buildCopyPrompt()` with all strategy context blocks. Changes to prompt structure must be mirrored in both files.
11. **Positioning direction shapes all passes** — `selected_direction` is injected into Pass 1 (framing), Pass 2 (fixes maintain positioning), and Pass 3 (E-E-A-T supports positioning). The audit checks positioning consistency.
12. **Persona context injected per page** — `target_persona` is resolved to full persona profile (frustrations, objection_profile, decision_criteria, language_patterns). Home/about get multi-persona context. Blogs without persona get fallback from active personas.
13. **Voice overlay carries through** — `page.voice_overlay` rules are injected into Pass 1, Pass 2, and Pass 3 — vertical voice is maintained across all corrections.
14. **Subtraction + economics for non-blog only** — Subtraction messaging angles and economics CTA calibration are injected for service/industry/location/utility pages but not blog posts (unless page goal is relevant).
15. **Content pillar guides blog writing style** — Blog pages with `content_pillar` get pillar-specific writing guidance (thought leadership, case study, decision content, vertical deep-dive, performance marketing).
16. **Persona-aware Pass 3** — E-E-A-T injection prioritises proof by persona segment. Missing proof flagged with `<!-- PROOF GAP -->` HTML comments for human QC.
17. **Image generation code lives in copy.js** — `IMAGE_SLOTS` constant is defined at the bottom of copy.js despite belonging to the Images stage. This is a historical artifact.
