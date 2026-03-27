# Batch 2 — Post-Ship Audit

Date: 2026-03-26
Commits audited: `78f55c4` → `351d6ed` (Batch 2A/2D/2B/2C)
Fixes applied: `fc4b5ea`

---

## Syntax Check

All files pass `node --check`:

```
worker.js      ✓
strategy.js    ✓
keywords.js    ✓
briefs.js      ✓
sitemap.js     ✓
copy.js        ✓
research.js    ✓
layout.js      ✓
schema.js      ✓
images.js      ✓
export.js      ✓
prompts.js     ✓
setsailai.js   ✓
index.html     ✓ (inline script block)
```

---

## Batch 2 Functions — Verified Present

| Function | Line | Sub-batch |
|---|---|---|
| `_mountAudienceSegmentControls()` | 7330 | 2A (audience add/remove) |
| `_mountSensitivityControls()` | 7374 | 2B (editable sensitivity table) |
| `_mountSubtractionControls()` | 7426 | 2B (editable subtraction activities) |
| `_renderEconomics()` | 7844 | 2A + 2D (ecommerce branch) |
| `_renderAvailableBudget()` | 8248 | 2C (Available Budget card) |
| `_renderMergedFunnel()` | 8293 | 2C (funnel coverage, enabled services only) |
| `_renderBudgetWaterfall()` | 8332 | 2C (priority-ordered cost waterfall) |
| `_renderChannelIntelligence()` | 8396 | 2C (collapsible lever accordion) |
| `_renderUnlockTiers()` | 8447 | 2C (Growth/Optimal unlock framing) |
| `_bCompare()` | 8218 (inline in `_renderEconomics`) | 2A (benchmark comparison indicators) |

---

## Channel Tab Restructure — Verified

`_renderChannels()` call order:
1. `_renderAvailableBudget(st)` — client budget + D3 recoverable card
2. `_renderScopePanel()` — service selection (promoted to position 1)
3. `_renderMergedFunnel(st)` — funnel stages filtered to enabled services

`_renderGrowth()` call order:
1. `_renderBudgetWaterfall(st)` — priority waterfall with funded/unfunded line
2. Existing Gantt (`_mountGantt`)
3. `_renderChannelIntelligence(st)` — lever scoring table (collapsible)
4. `_renderUnlockTiers(st)` — aspirational growth/optimal framing
5. Targets section

---

## Ecommerce Model — Verified

- `_isEcom` detection at D1 prompt builder (~L4062): uses `_detectBusinessCategory()` + business_model field
- `_isEcomModel` detection at `_renderEconomics()` (~L7846): `ue.business_model === 'ecommerce' || ue.aov > 0`
- Ecommerce revenue projection at `_buildRevenueProjection()` (~L10276): `traffic × CVR × AOV`
- `INDUSTRY_BENCHMARKS['ecommerce']` corrected: CVR 1.5-5%, CPA $15-100 mid $45 (Shopify 2025 + Statista 2025)

---

## D3 Prompt Guards — Verified

Both guards present in `buildDiagnosticPrompt(3)`:
- `BIAS GUARD` at ~L4352 — prevents bias toward Setsail services
- `PERSONA CONSIDERATION` at ~L4356 — considers revenue-potential segments when cutting activities
- Audience segments + personas injected into D3 context (~L4338)

---

## Revenue Projection Fallbacks — Verified Removed

Magic number fallbacks (`cpl * 3` for CAC, `ltv * 0.3` for deal size) are gone.
`_buildRevenueProjection()` returns `''` when D1 economics are incomplete — no fabricated numbers.

---

## Bugs Found and Fixed

### BUG 1: Voice Direction Path Mismatch (CRITICAL) — Fixed in `fc4b5ea`

**Problem:** D2 save handler stored `brand_voice_direction` into `brand_strategy.voice_direction` (nested object). But both `briefs.js` and `copy.js` read from `brand_strategy.words_to_avoid`, `brand_strategy.words_to_use`, `brand_strategy.tone_and_voice`, `brand_strategy.voice_style` — top-level fields that were never being set.

**Impact:** Every generated brief and copy page received empty voice arrays. Words-to-avoid and words-to-use instructions from D2 were silently dropped. Tone/style guidance was missing from all brief and copy prompts.

**Fix (strategy.js ~L5002):** D2 save handler now promotes the four key fields to top-level `brand_strategy` immediately after storing the full `voice_direction` object:
```js
if (_bvd.words_to_use)   S.strategy.brand_strategy.words_to_use   = _bvd.words_to_use;
if (_bvd.words_to_avoid) S.strategy.brand_strategy.words_to_avoid = _bvd.words_to_avoid;
if (_bvd.style)          S.strategy.brand_strategy.voice_style     = _bvd.style;
if (_bvd.tone_detail)    S.strategy.brand_strategy.tone_and_voice  = _bvd.tone_detail;
```

**Note:** Existing strategies need D2 re-run to populate the top-level fields. Historical saves only have the nested form.

---

### BUG 2: Escaped-Quote Onclick Concat — Fixed in `fc4b5ea`

**Problem:** Two places used `onclick="_var=\'' + value + '\'"` pattern — the prohibited escaped-quote string concat pattern. While these specific values (tab IDs, lever keys) were safe strings with no injection risk, the pattern violates CLAUDE.md convention and breaks if values ever contain apostrophes.

**Locations:**
- `renderStrategyNav()` ~L6067 — `_sTab='` + t.id
- `_renderExecution()` ~L9510 — `_sSubLever='` + lev

**Fix:** Replaced with `data-stab` / `data-sublever` attributes and post-render `.onclick` wiring loops in `renderStrategyNav()` and `renderStrategyTabContent()`.

---

## Known Pre-existing Issues (not Batch 2 regressions)

### Gap Panel Auto button (L6663)
```js
onclick="_autoResolveGap('" + esc(g.data_needed) + "')"
```
Uses `esc()` on the value which is correct — HTML-encoding prevents injection. This is the acceptable pattern per CLAUDE.md since the parameter is escaped. Not a violation.

### `prompt()` and `confirm()` in Subtraction Controls
- L7464: `prompt('Activity name:')` — used to collect new activity name
- L7488: `confirm('Remove...')` — used to confirm deletion

CLAUDE.md bans `alert()` only. These native dialogs work but block the thread. Acceptable for now; could be replaced with inline form inputs in a future pass.

---

## What Each Batch 2 Sub-batch Built

### Sub-batch 2A: Fix the Math
- **CPC filtering:** D1/D4/Economics/compile prompts now filter to selected + pinned keywords only (fallback to all if <3 selected)
- **Revenue projection guards:** `_buildRevenueProjection()` returns empty string if D1 economics incomplete — no magic fallbacks
- **Source badges expanded:** D1 JSON schema now requests `ltv_source`, `cac_source`, `deal_size_source` in addition to existing 3
- **Benchmark comparison indicators:** `_bCompare()` inline function in `_renderEconomics()` compares client CPL/CVR/close_rate against industry benchmark low/mid/high ranges with colour + tooltip
- **Metric flow bar:** `CPC → CPL → CAC → LTV → LTV:CAC` display at top of Economics tab
- **Pricing table removed from Economics:** Moved to Channels where it has context; Economics tab no longer duplicates it

### Sub-batch 2D: Ecommerce Model
- **D1 prompt branching:** Detects ecommerce via `_detectBusinessCategory()` + `business_model` field; injects AOV/ROAS/CLV schema instead of CPL/close-rate schema
- **`_renderEconomics()` ecommerce branch:** AOV/ROAS/CLV metric flow, site CVR, repeat purchase rate, break-even ROAS, ecommerce sensitivity table
- **`_buildRevenueProjection()` ecommerce path:** `traffic × CVR × AOV = monthly revenue`
- **`INDUSTRY_BENCHMARKS['ecommerce']`:** Corrected CVR 1.5-5% (was wrong), CPA $45 median (was CPL $70), source updated to Shopify 2025 + Statista 2025

### Sub-batch 2B: Editability
- **Editable sensitivity table:** Edit toggle on Economics tab; per-row inputs for close_rate/avg_deal/max_cpl/leads_needed/ltv_cac per scenario; overrides stored in `ue.sensitivity_overrides`; "Strategy built on" dropdown sets `ue.strategy_built_on`
- **Editable subtraction activities:** Edit/Add/Delete rows; original AI output saved as `sub._original_audit`; Reset to AI button; auto-recalculates `total_recoverable_monthly`
- **D3 persona context + bias guard:** D0 audience segments/personas injected into D3 prompt; BIAS GUARD prevents Setsail-service bias; PERSONA CONSIDERATION weights high-revenue segments
- **Break-even floor in Risks tab:** `ue.break_even_floor` surfaced as amber financial risk card at top of Risks tab

### Sub-batch 2C: Channel Tightening
- **`_renderAvailableBudget(st)`:** Client budget + D3 recoverable = total available; package fit badge
- **`_renderBudgetWaterfall(st)`:** Services sorted by priority with running cumulative; green ✓ / amber ⚠ / red ✗ funded/unfunded line
- **`_renderMergedFunnel(st)`:** Single funnel section filtered to enabled services; gap indicators when enabled services miss a stage; replaces duplicated funnel in both Channels and Growth
- **`_renderChannelIntelligence(st)`:** Lever scoring table wrapped in collapsible accordion; collapsed by default; "Channel Intelligence (AI Analysis)" header with toggle
- **`_renderUnlockTiers(st)`:** Aspirational framing for disabled services — "Unlock at Growth Budget" / "Unlock at Optimal Budget" with expected impact
- **`_renderChannels()` restructured:** Available Budget → Scope Panel → Merged Funnel
- **`_renderGrowth()` restructured:** Budget Waterfall → Gantt → Channel Intelligence → Unlock Tiers → Targets

---

## Data Flow Map (Messaging System — for Batch 3 reference)

| Data | Stored at | Rendered in | Read by downstream |
|---|---|---|---|
| Voice direction (full object) | `strategy.brand_strategy.voice_direction` | Content & Authority tab | `_renderBrand()` |
| words_to_use / words_to_avoid | `strategy.brand_strategy.words_to_use/avoid` (**now set by D2 fix**) | Content & Authority tab | `briefs.js` L1593-94, `copy.js` L772-806 |
| tone_and_voice | `strategy.brand_strategy.tone_and_voice` (**now set by D2 fix**) | Content & Authority tab | `briefs.js` L1591, `copy.js` L772 |
| Category perception | `strategy.positioning.category_perception` | Positioning tab | `_buyerIntelBlock()` step 2 |
| Messaging hierarchy | `strategy.positioning.messaging_hierarchy` | Positioning tab | Strategy doc compile |
| StoryBrand arc | `strategy.narrative.storybrand` | Narrative tab | `briefs.js` L1701, `copy.js` |
| Messaging pillars | `strategy.narrative.messaging_pillars` | Narrative tab | `_buyerIntelBlock()` step 5 |
| Objection map | `strategy.narrative.objection_map` | Narrative tab | `_buyerIntelBlock()` step 5 |
| Content hooks | `strategy.narrative.content_hooks` | Narrative tab | `_buyerIntelBlock()` step 5 |
| VoC swipe file | `strategy.narrative.voc_swipe_file` + `strategy._enrichment.voc_swipe_file` | Narrative tab | `_buyerIntelBlock()` step 4 |
| Emotional journey | `strategy.narrative.emotional_journey` | Narrative tab | `copy.js` |
| Emotional veins | `strategy.narrative.emotional_veins` | Narrative tab | `copy.js` |
| Touchpoint messaging | `strategy.narrative.touchpoint_messaging` | Narrative tab | `copy.js` |
| Vertical resonance | `strategy.narrative.vertical_resonance` | Narrative tab | `copy.js` |
| Content pillars (SEO topics) | `strategy.brand_strategy.content_pillars` | Content & Authority tab | Sitemap pillar tagging |
| Perceived alternatives | `strategy.audience.perceived_alternatives` | Audience tab | `_buyerIntelBlock()` step 3 |
| Personas | `strategy.audience.personas` | Audience tab | All downstream stages |

---

## Git Log

```
fc4b5ea  fix: voice direction path mismatch + onclick quote violations
351d6ed  Batch 2C: channel tab restructure — promote services, demote levers
de871f0  Batch 2B: editable sensitivity + subtraction + D3 context + risks floor
1447315  Batch 2D: ecommerce economics model + benchmark corrections
78f55c4  Batch 2A: fix economics math + CPC filtering + metric flow + benchmarks
aad4707  add/remove controls on audience segments
dd1c942  fix D0 audience missing return + sitemap keyword mapping + strategy data quality
```
