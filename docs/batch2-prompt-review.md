# Batch 2 — Prompt Changes for Strategist Review

These prompt changes need approval before being coded into SetSailOS.
Review each section and note any adjustments needed.

---

## 1. D1 Economics — Expanded Source Tracking

**Current:** The D1 schema asks for `benchmark_sources` with 3 fields:
```json
"benchmark_sources": {
  "cvr_source": "layer_1_benchmark | layer_2_gkp | layer_3_client | assumption",
  "cpl_source": "layer_1_benchmark | layer_2_gkp | layer_3_client | cpc_derived",
  "close_rate_source": "layer_1_benchmark | layer_3_client | client_provided | assumption"
}
```

**Proposed:** Expand to 6 fields so every key metric has a source label:
```json
"benchmark_sources": {
  "cvr_source": "layer_1_benchmark | layer_2_gkp | layer_3_client | assumption",
  "cpl_source": "layer_1_benchmark | layer_2_gkp | layer_3_client | cpc_derived",
  "close_rate_source": "layer_1_benchmark | layer_3_client | client_provided | assumption",
  "ltv_source": "client_provided | benchmark_derived | calculated | assumption",
  "cac_source": "cpc_derived | benchmark_derived | calculated | assumption",
  "deal_size_source": "client_provided | research_extracted | benchmark_derived | assumption"
}
```

**Why:** The strategist needs to know which numbers are real vs estimated. Currently LTV, CAC, and deal size appear without any source attribution, so there's no way to tell if a $15K deal size came from the client's intake form or was invented by the AI.

---

## 2. D1 Economics — Ecommerce Branch

**Current:** D1 prompt uses only lead-gen metrics (CPL, CAC, LTV, close rate, deal size). No alternative for ecommerce businesses.

**Proposed:** When business is detected as ecommerce, inject this additional prompt block:

```
BUSINESS MODEL: ECOMMERCE
This is an ecommerce/retail business. Use ecommerce-specific unit economics:
- AOV (Average Order Value) instead of deal size
- Site conversion rate (visitors → customers) instead of close rate
- ROAS (Return on Ad Spend) instead of LTV:CAC for paid media viability
- Customer Lifetime Value from: AOV × purchase frequency × retention period
- Repeat purchase rate and customer acquisition cost

Do NOT use lead-gen metrics (CPL, qualified leads, sales cycle) — these do not apply.
```

**Proposed ecommerce JSON schema fields (replace sensitivity section):**
```json
{
  "aov": 0,
  "site_conversion_rate": 0,
  "customer_acquisition_cost": 0,
  "roas_target": 0,
  "roas_current": 0,
  "repeat_purchase_rate": 0,
  "purchase_frequency_annual": 0,
  "customer_lifetime_value": 0,
  "avg_product_margin_pct": 0,
  "break_even_roas": 0,
  "sensitivity": [
    {"scenario": "conservative", "aov": 0, "conversion_rate": 0, "roas": 0, "verdict": "string"},
    {"scenario": "base", "aov": 0, "conversion_rate": 0, "roas": 0, "verdict": "string"},
    {"scenario": "optimistic", "aov": 0, "conversion_rate": 0, "roas": 0, "verdict": "string"}
  ]
}
```

**Why:** Running a Shopify store through the current D1 produces meaningless output — CPL and close rate don't apply to product sales. The ecommerce model centres on AOV, ROAS, and repeat purchase rate.

---

## 3. D3 Subtraction — Persona Context Injection

**Current:** D3 receives unit economics context but NO audience/persona data.

**Proposed:** Add this block to the D3 prompt context (before the TASK instruction):

```
AUDIENCE SEGMENTS (from D0 Audience Intelligence):
[JSON array of segments with name, revenue_potential, acquisition_difficulty]

PERSONAS:
[Comma-separated list of persona archetype labels]

PERSONA CONSIDERATION: When evaluating whether to cut or keep an activity,
consider which audience segment it serves. An activity that serves a
high-revenue-potential segment should not be cut simply because it is
not a core marketing channel. Activities serving low-priority or parked
segments are stronger candidates for removal.
```

**Why:** Without persona context, the subtraction analysis treats all activities equally. A $500/month sponsorship that serves the primary revenue segment gets the same treatment as a $500/month activity serving a deprioritised segment. The strategist ends up manually cross-referencing.

---

## 4. D3 Subtraction — Bias Guard

**Current:** No explicit guard against recommending Setsail's own services.

**Proposed:** Add this instruction to the D3 prompt:

```
BIAS GUARD: This is an objective audit of the CLIENT'S current marketing
activities. Do NOT bias recommendations toward channels that Setsail
Marketing sells (SEO, PPC, web design, etc.). An activity should be kept
if it serves the client's goals effectively, even if Setsail does not
offer that service. Cut/restructure verdicts must be based on ROI and
strategic fit, not on whether Setsail can replace the activity.
```

**Why:** Without this guard, the AI tends to recommend cutting activities that compete with Setsail's service catalogue (e.g., "cut your current SEO agency" when the client has a working relationship). The strategist's judgment should drive those decisions, not AI bias.

---

## 5. D4 Channels — Per-Channel Lead/Traffic Targets

**Current:** D4 outputs abstract 1-10 scores for each lever (fit, economics, competitive_reality, goal_impact) but no concrete lead or traffic expectations.

**Proposed:** Add these fields to each lever in the D4 schema:

```json
{
  "lever": "seo",
  "fit": 8,
  "economics": 7,
  "competitive_reality": 6,
  "goal_impact": 9,
  "priority_score": 7.5,
  "recommendation": "...",
  "budget_allocation_pct": 25,
  "timeline_to_results": "3-6 months",
  "dependencies": ["website"],
  "expected_monthly_leads": 15,
  "expected_monthly_traffic": 2000,
  "contribution_pct": 30
}
```

New fields:
- `expected_monthly_leads` — how many leads this channel should generate at the allocated budget
- `expected_monthly_traffic` — expected monthly visitors/impressions from this channel
- `contribution_pct` — what percentage of the total lead target this channel contributes

**Also add this prompt instruction:**
```
LEAD TARGET ALIGNMENT: The total expected_monthly_leads across all active
channels must align with the D1 unit economics lead target
(budget_supports_leads). If channels sum to more leads than the economics
support, reduce proportionally. If they sum to fewer, flag the gap.
```

**Why:** Abstract scores don't help the strategist set expectations with the client. "SEO is scored 8/10" means nothing. "SEO is expected to generate 15 leads/month at $3,200/month spend" is actionable and verifiable.

---

## Approval

Please review each section above. For each:
- ✅ Approve as-is
- ✏️ Modify (note changes)
- ❌ Reject (explain why)

Changes will not be coded until approved.
