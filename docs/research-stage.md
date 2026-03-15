# Research Stage — Complete Reference

## Overview

The Research stage (Stage 3) is the intelligence-gathering phase of SetSailOS. It collects ~80 structured fields across 5 tabs, which feed directly into Keywords, Sitemap, Briefs, Copy, Layout, and Schema stages downstream.

Every field in Research is stored in `S.research` and persisted to KV on save.

---

## Architecture

### File: `research.js`

| Component | Lines | Purpose |
|---|---|---|
| `RESEARCH_FIELD_META` | 1–90 | Field metadata registry (tab, label, importance, source) |
| `calcResearchCompleteness()` | ~94–131 | Calculates per-tab and overall completeness percentage |
| `renderResearchScorecard()` | ~141–195 | Renders the completeness card with progress bars and missing-field click-to-jump |
| `rField()` | ~95–106 | Renders individual form fields with AI/MANUAL badges |
| `renderRBusiness()` | ~440–469 | Business tab layout |
| `renderRAudience()` | ~471–500 | Audience tab layout |
| `renderRBrand()` | ~500–530 | Brand tab layout |
| `renderRSchema()` | ~594–619 | Schema & Local tab layout |
| `renderRCompetitors()` | ~620–640 | Competitors tab layout |
| `renderRAssets()` | ~640–660 | Assets tab layout |
| `pullGMB()` | ~547–592 | Manual Google Business Profile data pull |
| `enrichOneTab(tab)` | ~659–678 | Single-tab enrichment entry point |
| `enrichAll()` | ~680–710 | Sequential all-tab enrichment |
| `enrichRTab(tab, forceAll)` | ~829–1060 | Core enrichment logic per tab |
| `mergeEnriched()` | ~725–738 | Merges AI results into S.research |
| `_fetchWebsiteText()` | ~779–810 | Multi-page website scraper (cached) |
| `_autoGMB()` | ~812–827 | Silent GMB pull before enrichment |
| `parseEnrichResult()` | ~753–774 | 4-stage JSON repair pipeline |

### File: `index.html`

| Component | Purpose |
|---|---|
| `buildEnrichCtx()` | Builds base context string from setup data (client, URL, strategy doc, reference docs) |
| `callClaude()` | Streaming Claude wrapper used by enrichment |
| `#research-scorecard` div | Container for the completeness scorecard |
| `STAGE_TIPS.research` | Guide panel tips for the Research stage |

### File: `worker.js`

| Route | Purpose |
|---|---|
| `POST /api/fetch-page` | Fetches and strips HTML from 1–6 URLs in parallel. Returns text content for enrichment context. |
| `POST /api/gmb` | DataForSEO Google My Business lookup |
| `POST /api/claude` | Streaming Claude proxy (used by enrichment) |

---

## Tabs and Fields

### Business Tab (17 fields)

| Field Key | Label | Type | Importance | Source |
|---|---|---|---|---|
| `business_overview` | Business Overview | textarea | critical | ai |
| `value_proposition` | Value Proposition | textarea | critical | ai |
| `industry` | Industry | text | critical | ai |
| `sub_industry` | Sub-Industry / Niche | text | normal | ai |
| `business_model` | Business Model | select | normal | ai |
| `years_in_business` | Years in Business | text | optional | ai |
| `team_size` | Team Size | text | optional | ai |
| `locations_count` | Number of Locations | text | optional | ai |
| `pricing_notes` | Pricing Notes | textarea | normal | ai |
| `pricing_model` | Pricing Model | select | normal | ai |
| `capacity_constraints` | Capacity Constraints | text | optional | ai |
| `seasonality_notes` | Seasonality Notes | text | optional | manual |
| `strategic_recommendations` | Strategic Recommendations | textarea-array | normal | ai |
| `services_detail` | Services | repeating group | critical | ai |
| `services_detail[].name` | Service Name | text | — | — |
| `services_detail[].description` | Description | text | — | — |
| `services_detail[].pricing` | Pricing | text | — | — |
| `services_detail[].target_audience` | Target Audience | text | — | — |
| `services_detail[].key_differentiator` | Differentiator | text | — | — |
| `top_offers` | Top Offers | repeating group | normal | ai |
| `top_offers[].offer_name` | Offer Name | text | — | — |
| `top_offers[].priority` | Priority | text | — | — |
| `top_offers[].notes` | Notes | text | — | — |
| `primary_services` | Primary Services | hidden (auto) | normal | auto |

> `primary_services` is auto-derived from `services_detail` names after enrichment. It is not shown in the UI but is used by Keywords, Sitemap, Briefs, and other downstream stages.

### Audience Tab (18 fields)

| Field Key | Label | Type | Importance | Source |
|---|---|---|---|---|
| `primary_audience_description` | Primary Audience | textarea | critical | ai |
| `buyer_roles_titles` | Buyer Roles / Titles | textarea-array | normal | ai |
| `target_geography` | Target Geography | select | normal | ai |
| `best_customer_examples` | Best Customer Examples | textarea | normal | ai |
| `pain_points_top5` | Top 5 Pain Points | textarea-array | critical | ai |
| `objections_top5` | Top 5 Objections | textarea-array | normal | ai |
| `lead_channels_today` | Lead Channels Today | textarea-array | normal | ai |
| `sales_cycle_length` | Sales Cycle Length | select | normal | ai |
| `close_rate_estimate` | Close Rate Estimate | text | optional | ai |
| `lead_qualification_criteria` | Lead Qualification Criteria | textarea | normal | ai |
| `top_reasons_leads_dont_close` | Why Leads Don't Close | textarea | normal | ai |
| `booking_flow_description` | Booking Flow | textarea | normal | ai |
| `primary_goal` | Primary Goal | select | critical | ai |
| `secondary_goals` | Secondary Goals | textarea-array | normal | ai |
| `geography` | Geography | object | normal | ai |
| `target_audience` | Target Audience Personas | repeating group | critical | ai |
| `primary_cta` | Primary CTA | text | critical | ai |
| `secondary_cta` | Secondary CTA | text | normal | ai |
| `low_commitment_cta` | Low-Commitment CTA | text | normal | ai |

### Brand Tab (15 fields)

| Field Key | Label | Type | Importance | Source |
|---|---|---|---|---|
| `brand_name` | Brand Name | text | critical | ai |
| `slogan_or_tagline` | Slogan / Tagline | text | normal | ai |
| `brand_voice_style` | Brand Voice Style | select | critical | ai |
| `tone_and_voice` | Tone and Voice | textarea | critical | ai |
| `words_to_use` | Words to Use | textarea-array | normal | ai |
| `words_to_avoid` | Words to Avoid | textarea-array | normal | ai |
| `key_differentiators` | Key Differentiators | textarea-array | critical | ai |
| `proof_points` | Proof Points | textarea-array | normal | ai |
| `brand_colours` | Brand Colours | textarea-array | normal | manual |
| `fonts` | Fonts | textarea-array | normal | manual |
| `case_studies` | Case Studies | repeating group | normal | ai |
| `notable_clients` | Notable Clients | textarea-array | normal | ai |
| `awards_certifications` | Awards & Certifications | textarea-array | normal | ai |
| `team_credentials` | Team Credentials | textarea | normal | ai |
| `founder_bio` | Founder Bio | textarea | normal | ai |
| `publications_media` | Publications & Media | textarea-array | optional | ai |

### Schema & Local Tab (16 fields)

| Field Key | Label | Type | Importance | Source |
|---|---|---|---|---|
| `schema_business_type` | Business Type | select | normal | ai |
| `schema_primary_category` | Primary Category | text | normal | ai |
| `schema_price_range` | Price Range | text | optional | ai |
| `schema_payment_methods` | Payment Methods | text-csv | optional | ai |
| `schema_injection_method` | Schema Injection Method | select | normal | manual |
| `schema_has_physical_locations` | Has Physical Locations | boolean | normal | ai |
| `schema_street_address` | Street Address | text | normal | ai |
| `schema_city` | City | text | normal | ai |
| `schema_region` | Province / State | text | normal | ai |
| `schema_postal_code` | Postal Code | text | normal | ai |
| `schema_country` | Country | text | normal | ai |
| `has_location_pages` | Location Pages | select | normal | ai |
| `has_service_pages` | Service Pages | select | normal | ai |
| `has_blog` | Blog | select | normal | ai |
| `has_faq_section` | FAQ Section | select | normal | ai |
| `social_profiles` | Social Profiles | repeating group | normal | ai |
| `schema_services` | Schema Services | repeating group | normal | ai |
| `faqs` | FAQs | repeating group | normal | ai |
| `reviews` | Reviews | repeating group | optional | ai |

### Competitors Tab (1 field)

| Field Key | Label | Type | Importance | Source |
|---|---|---|---|---|
| `competitors` | Competitors | repeating group | critical | ai |
| `competitors[].name` | Business Name | text | — | — |
| `competitors[].url` | URL | text | — | — |
| `competitors[].why_they_win` | Why They Win | text | — | — |
| `competitors[].weaknesses` | Weaknesses | text | — | — |
| `competitors[].what_we_do_better` | What We Do Better | text | — | — |

### Assets Tab (7 fields, all manual)

| Field Key | Label | Type | Importance | Source |
|---|---|---|---|---|
| `brand_guidelines_link` | Brand Guidelines Link | text | optional | manual |
| `logo_files_link` | Logo Files Link | text | optional | manual |
| `photo_library_link` | Photo Library Link | text | optional | manual |
| `video_library_link` | Video Library Link | text | optional | manual |
| `existing_ad_creatives_link` | Ad Creatives Link | text | optional | manual |
| `do_not_use_assets_notes` | Do Not Use Notes | textarea | optional | manual |
| `reference_brands` | Reference Brands | repeating group | optional | manual |

---

## Enrichment Flow

### Data Sources

When enrichment runs, it gathers context from multiple sources:

1. **Strategy Document** — pasted by user in Setup stage (up to 12,000 chars)
2. **Reference Documents** — additional docs uploaded in Setup (up to 10,000 chars each)
3. **Website Scrape** — live scrape of up to 11 pages in parallel:
   - Homepage (`/`)
   - `/about`, `/about-us`
   - `/services`, `/our-services`
   - `/pricing`
   - `/our-work`, `/portfolio`
   - `/team`, `/our-team`
   - `/contact`
4. **Google Business Profile** — DataForSEO GMB lookup (address, category, reviews, social profiles)
5. **DataForSEO Organic Competitors** — real competitor domains with search overlap (competitors tab only)
6. **Setup fields** — client name, URL, geo, pricing, voice, known competitors

### Context Distribution by Tab

| Data Source | Business | Audience | Brand | Schema | Competitors |
|---|---|---|---|---|---|
| Strategy doc | Yes | Yes | Yes | Yes | Yes (2000 chars) |
| Reference docs | Yes | Yes | Yes | Yes | No |
| Website scrape | Yes | Yes | Yes | Yes | No |
| GMB data | Yes (auto) | Yes (auto) | Yes (auto) | Yes (auto) | No |
| Cross-tab context | Yes | Yes | Yes | Yes | No |
| DataForSEO competitors | No | No | No | No | Yes |
| Setup fields | Yes | Yes | Yes | Yes | Yes |

### Cross-Tab Context

When a tab enriches, it receives a compact summary of fields already extracted by previous tabs. This prevents duplicate inference and helps later tabs build on established facts:
- Business overview, services, industry, team size
- Audience description, primary goal
- Geography

### Token Budget per Tab

| Tab | max_tokens | Rationale |
|---|---|---|
| Business | 8000 | Many array fields (services_detail, top_offers, strategic_recommendations) |
| Audience | 6000 | Standard field set |
| Brand | 8000 | Case studies array can be large; proof points, clients, credentials |
| Schema | 6000 | Standard field set |
| Competitors | 6000 | Single array of 5-8 entries |

### Enrichment Sequence

```
enrichOneTab(tab)
  ├── Clear website cache (_cachedWebsiteText = null)
  ├── enrichRTab(tab, forceAll=true)
  │     ├── Promise.allSettled([_fetchWebsiteText(), _autoGMB()])
  │     │     ├── _fetchWebsiteText(): POST /api/fetch-page with 9 URLs
  │     │     └── _autoGMB(): POST /api/gmb (if address empty)
  │     ├── buildEnrichCtx() — strategy doc + reference docs
  │     ├── Append website text (up to 14KB)
  │     ├── Build tab-specific prompt with JSON template
  │     ├── callClaude(system, prompt, null, 6000) — streaming
  │     ├── parseEnrichResult() — 4-stage JSON repair
  │     ├── mergeEnriched(S.research, parsed, forceAll)
  │     │     └── Skip empty incoming values (never overwrite with blank)
  │     ├── Auto-derive primary_services from services_detail names
  │     ├── scheduleSave()
  │     └── renderResearchTabContent() + scheduleScorecard()
  └── Update nav tab checkmarks
```

### Merge Behaviour

`mergeEnriched(target, source, forceAll)`:

- **forceAll=true** (re-enrich): Overwrites existing fields with new AI values, EXCEPT:
  - Never overwrites with empty strings or empty arrays
  - Never overwrites `geography` (handled separately)
- **forceAll=false** (first enrich): Only fills empty fields, never touches populated ones

### JSON Repair Pipeline

`parseEnrichResult(result)`:

1. Strip markdown fences (` ```json `)
2. Try `JSON.parse()` directly
3. Extract JSON block (first `{` to last `}`)
4. Repair: strip control chars, fix trailing commas, fix unquoted keys, fix single quotes
5. Aggressive: remove all newlines and retry parse

---

## Completeness Scorecard

Rendered in `#research-scorecard` div above the tab navigation.

### Calculation

- Iterates all fields in `RESEARCH_FIELD_META`
- Strings: filled if `.trim().length > 0`
- Arrays: filled if `.length > 0`
- Objects: filled if has any truthy values
- Returns `{ total: { filled, count, pct }, byTab: { business: {…}, … }, missing: [{ key, label, tab, importance, source }] }`

### Display

- Overall percentage with colour coding: red < 40%, amber < 75%, green >= 75%
- Per-tab mini progress bars (Business, Audience, Brand, Schema, Competitors)
- Expandable missing-fields list grouped by tab
- Each missing field is clickable — jumps to that field and highlights it
- Fields show AI (green) or MANUAL (amber) badge based on source

### Updates

Scorecard re-renders (debounced 300ms) after:
- Initial render
- Any enrichment completes
- Any field input/change event

---

## Downstream Consumers

Research data flows into every subsequent stage:

| Stage | Key Research Fields Used |
|---|---|
| **Keywords** | `primary_services`, `industry`, `geography`, `target_audience`, `client_name` |
| **Sitemap** | `primary_services`, `geography`, `has_service_pages`, `has_location_pages`, `has_blog` |
| **Briefs** | `primary_services`, `industry`, `client_name`, `tone_and_voice`, `key_differentiators` |
| **Copy** | `tone_and_voice`, `brand_voice_style`, `words_to_use`, `words_to_avoid`, `key_differentiators`, `proof_points`, `primary_cta`, `secondary_cta` |
| **Layout** | `primary_services`, `industry` |
| **Schema** | `schema_*` fields, `social_profiles`, `faqs`, `schema_services` |
| **Images** | `primary_services`, `industry` |

---

## Worker Routes

### POST /api/fetch-page

Scrapes website text for enrichment context.

**Request:**
```json
// Single page (backward compat):
{ "url": "https://example.com" }

// Multi-page:
{ "urls": ["https://example.com", "https://example.com/about", ...] }
```

**Behaviour:**
- Fetches up to 6 pages in parallel, 5s timeout each
- Strips `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>` tags
- Returns plain text content

**Response:**
```json
// Single: { "text": "..." } (up to 10KB)
// Multi:  { "pages": [{ "url": "...", "text": "..." }] } (up to 18KB total, 8KB per page)
```

### POST /api/gmb

Google Business Profile lookup via DataForSEO.

**Request:**
```json
{ "keyword": "Setsail Marketing Vancouver" }
```

**Response:**
```json
{
  "result": {
    "address_parts": { "address": "...", "city": "...", "region": "...", "zip": "...", "country_code": "CA" },
    "category": "Marketing agency",
    "price_level": "$$",
    "social_profiles": [{ "platform": "Facebook", "url": "..." }],
    "reviews": [{ "author": "...", "text": "...", "rating": 5 }]
  }
}
```

---

## Field Source Classification

| Source | Count | Meaning |
|---|---|---|
| `ai` | ~60 | Filled by AI enrichment from strategy docs + website scrape |
| `manual` | ~15 | Requires human input (brand colours, fonts, asset links, seasonality) |
| `auto` | ~2 | Auto-populated from other data (`client_name` from Setup, `primary_services` from `services_detail`) |
