# Stage 8 — Images

## Purpose

The Images stage generates AI-powered images for every page in the sitemap using Google's Gemini API. Each page receives 5 default image slots covering key visual needs (hero, feature, detail, content, CTA). Users can customise prompts, override styles per page, add extra slots, and regenerate individual images. All images are compressed client-side to WebP and persisted in Cloudflare KV separately from the main project JSON (avoiding the 25MB limit).

---

## Pipeline Position

```
Stage 7 (Copy) → ❽ Images → Stage 9 (Layout)
```

Images is a downstream consumer of:

- **Sitemap (Stage 5)** — page list (`S.pages[]`) drives slot initialisation
- **Research (Stage 3)** — geography, primary services feed into prompt context
- **Setup (Stage 1)** — client name, global image style preference

Images feeds into:

- **Layout (Stage 9)** — generated images can be injected into wireframes via the "Reinject" button in the Layout stage

---

## Architecture

### Data Flow

```
User clicks "Generate All"
    ↓
images.js loops pages × 5 slots
    ↓
POST /api/generate-image { prompt }
    ↓
worker.js → Gemini API (model cascade)
    ↓
Base64 image returned
    ↓
Client-side WebP compression (Canvas API)
    ↓
PUT /api/images/:projectId/:slug → KV
    ↓
renderImageQueue() updates UI
```

### File Ownership

| File | Responsibility |
|---|---|
| `images.js` (490 lines) | All frontend logic: init, prompt building, generation, compression, queue UI, persistence |
| `worker.js` lines 617–665 | Per-page image KV storage routes (PUT / GET / LIST) |
| `worker.js` lines 1703–1788 | `/api/generate-image` — Gemini API proxy with model cascade and retry |
| `copy.js` lines 1364–1372 | `IMAGE_SLOTS` constant (5 slot definitions) and `DEFAULT_IMAGE_STYLE` constant |
| `index.html` lines 595–627 | Images stage HTML container (style panel, progress bar, queue div, all-done banner) |

---

## Constants

### IMAGE_SLOTS (defined in `copy.js`)

5 default slots per page, each with a label, aspect ratio hint, and style guidance:

| # | Label | Ratio | Hint |
|---|---|---|---|
| 0 | Hero Banner | 16:9 wide | Main hero banner, dramatic wide composition, professional |
| 1 | Section Feature | 4:3 | Supporting section image, feature highlight, clean background |
| 2 | Detail / Close-up | 1:1 square | Detailed close-up or icon-style visual, square format |
| 3 | Content / Blog | 3:2 | Content illustration or editorial visual, natural lighting |
| 4 | CTA / Closing | 16:9 wide | Call-to-action or closing visual, warm inviting tone |

### DEFAULT_IMAGE_STYLE (defined in `copy.js`)

```
Professional commercial photography style. Clean, modern, well-lit.
Neutral or white backgrounds. No text overlays. No watermarks.
Business-appropriate.
```

This is used when no global style override or page-level style override is set.

---

## State Model

All image data lives in `S.images`, keyed by page slug:

```js
S.images = {
  "digital-marketing-services": {
    styleOverride: null,          // per-page style override (string or null)
    slots: [
      {
        status: "done",           // "empty" | "generating" | "done" | "error"
        prompt: "Professional...", // full prompt sent to Gemini
        b64: "iVBORw0...",       // base64-encoded WebP image data
        mimeType: "image/webp",   // always WebP after compression
        sizeKB: 87,              // compressed file size
        altText: "Digital...",    // SEO alt text (editable, max 125 chars)
        errorMsg: null            // error detail string (when status === "error")
      },
      // ... 4 more slots
    ]
  },
  // ... more pages
};
```

### Separate KV Storage

Images are stored separately from the main project JSON to avoid the 25MB KV value limit:

| KV Key Pattern | Contents |
|---|---|
| `u:{email}:img:{projectId}:{slug}` | Full page image data (slots array with base64) |

When the main project is saved (`scheduleSave()`), base64 data is **not** included — only the slot metadata. The actual image data is persisted independently via `savePageImages(slug)`.

---

## Frontend Functions (images.js)

### Initialisation

#### `initImageStage()`
Entry point called when the user navigates to the Images stage.

1. Iterates all `S.pages` and initialises `S.images[slug]` with 5 default slots if not already present
2. Pre-fills the global style edit textarea from `S.setup.imageStyle`
3. Calls `renderImageQueue()` to render the full page list
4. Calls `updateImageProgress()` for the progress bar
5. Calls `loadAllPageImages()` to restore persisted images from KV in the background

#### `loadAllPageImages()`
Async background loader. Fetches `GET /api/images/:projectId` to get a list of saved slugs, then fetches each slug's image data in parallel via `Promise.all()`. Merges restored base64 data into existing `S.images` slots. Re-renders the queue and progress bar when done. Also refreshes the Layout stage if currently active (for "Reinject" button visibility).

### Prompt Building

#### `buildImagePrompt(page, slotIdx, styleOverride)`
Assembles the full prompt string sent to Gemini for a specific page + slot:

```
{global or page style override}

Create a {slot label} image ({ratio}) for a {page description}.
Business: {client name}. Location: {geo}. Industry: {services}.
Style note: {slot hint}.
```

Context sources:
- **Style:** page-level `styleOverride` → `S.setup.imageStyle` → `DEFAULT_IMAGE_STYLE`
- **Page description:** blog pages get `blog post titled "X" about Y`; others get `{type} page for "X" ({keyword})`
- **Business:** `S.setup.client`
- **Location:** `S.research.geography.primary` or `S.setup.geo`
- **Industry:** first 2 items from `S.research.primary_services` or `page.keyword_cluster`

#### `getGlobalImageStyle()`
Returns `S.setup.imageStyle` (trimmed) or falls back to `DEFAULT_IMAGE_STYLE`.

### Style Management

#### `toggleImageStylePanel()`
Toggles the global style guide panel visibility. Pre-fills textarea with current style.

#### `saveGlobalImageStyle()`
Saves the textarea value to `S.setup.imageStyle`, hides the panel, and rebuilds prompts for all empty slots across all pages.

#### `savePageImageStyle(slug)`
Saves per-page style override from the inline textarea. Rebuilds empty slot prompts for that page. Null if blank (falls back to global).

#### `clearPageImageStyle(slug)`
Clears a page's style override, reverting to global style.

### Image Generation

#### `generateImage(slug, slotIdx, customPrompt?)`
Generates a single image for one slot:

1. Sets slot status to `"generating"`, clears existing base64
2. Re-renders queue to show spinner
3. `POST /api/generate-image` with the prompt
4. On success: compresses via `compressToWebP()`, stores base64, sets status `"done"`
5. On compression failure: keeps original PNG/JPEG data
6. Auto-generates alt text via `buildAltText()` if none exists
7. Saves to KV via `savePageImages(slug)`
8. On error: sets status `"error"`, stores `errorMsg`
9. Updates progress bar and checks all-done state

#### `generateImageWithCustomPrompt(slug, slotIdx)`
Reads the inline prompt editor textarea, saves it to the slot, then calls `generateImage()` with the custom prompt.

#### `generateAllImages(slug)`
Generates all 5 slots for a single page sequentially:

1. Sets `S.imageGenRunning = true`, `S.imageGenStop = false`
2. Shows stop button and progress bar
3. Expands the page's detail panel
4. Loops slots 0–4, calling `generateImage()` with a 500ms delay between each
5. Checks `S.imageGenStop` between iterations for early termination
6. Resets running state and hides stop button when done

#### `generateAllPagesImages()`
Generates all images for all pages in the sitemap:

1. Same running/stop flag pattern as single-page generation
2. Loops all pages, then all 5 slots per page, with 400ms delay
3. Expands each page's panel as it generates
4. Respects `S.imageGenStop` for early termination

> **Note:** The Images stage uses its own stop flag (`S.imageGenStop`) rather than the global `window._aiStopAll` system used by other stages.

#### `stopImageGen()`
Sets `S.imageGenStop = true`, resets running state, hides stop button.

### WebP Compression

#### `compressToWebP(b64, srcMime, targetKB)`
Client-side image compression using the Canvas API:

1. Creates an `Image` element from the source base64
2. Draws onto a `<canvas>` at original dimensions
3. Exports as WebP starting at quality 0.88
4. Iteratively reduces quality by 0.10 (up to 8 iterations, minimum 0.10) until under target size
5. Target size is 100KB
6. Returns `{ b64, sizeKB }` — compressed base64 and final file size
7. Rejects if canvas produces empty output or image has zero dimensions

### Alt Text

#### `buildAltText(prompt)`
Auto-generates alt text from the generation prompt by stripping photography jargon (aspect ratios, style words, "no text", "no watermarks", etc.) and truncating to 97 characters with `...`.

#### `saveAltText(slug, slotIdx, val)`
Saves user-edited alt text (max 125 characters) and triggers project save.

### Queue UI

#### `renderImageQueue()`
Renders the full image management interface:

**Page Groups** (5 categories):
| Group | Icon | Page Types |
|---|---|---|
| Core Pages | `ti-home` | home, about, contact, case-studies, utility |
| Services | `ti-tool` | service |
| Industry & Location | `ti-map-pin` | industry, location |
| Blog Posts | `ti-article` | blog |
| Other | `ti-file` | everything else |

**Per-Page Row (collapsed):**
- Page type icon + name + slug
- 5 mini status dots (green=done, lime=generating, red=error, grey=empty)
- Priority badge (P1/P2/P3)
- "Generate All" button
- Expand/collapse chevron

**Per-Page Row (expanded):**
- **Style Override** — textarea with Save/Clear buttons, "active" badge when set
- **5 Slot Cards** in a responsive grid (`minmax(160px, 1fr)`):
  - Image preview (or spinner/error/placeholder)
  - File size badge (e.g. "87KB WebP") on completed images
  - Slot label (Hero Banner, Section Feature, etc.)
  - Generate/Redo button + Prompt editor button
  - Inline prompt editor (hidden by default, shown on click)
  - Alt text input with character counter (red >100, amber >80) — only shown for completed images
- **"Add Image Slot"** button to add beyond the default 5

#### `toggleImageExpand(slug)`
Toggles a page's expanded state. Only one page can be expanded at a time (`imageExpandedSlug`).

#### `addImageSlot(slug)`
Appends a new empty slot to a page's slot array. Builds a default prompt based on the slot index.

#### `openPromptEditor(slug, slotIdx)`
Toggles the inline prompt editor div for a specific slot.

### Progress Tracking

#### `updateImageProgress()`
Calculates total images (pages × 5) vs completed images. Updates the count label, percentage label, and progress bar fill width. Hides the progress bar if no images have been generated yet.

#### `checkImageAllDone()`
Checks if every page has all slots in `"done"` status. Shows/hides the "All images generated" success banner with the "Generate Layout →" CTA button.

---

## Backend Routes (worker.js)

### `POST /api/generate-image`

**Authentication:** Cloudflare Access (standard auth flow)
**Rate limit:** `image` group — 20 requests per 5 minutes

**Request:**
```json
{ "prompt": "Professional commercial photography..." }
```

**Model Cascade:**
1. `gemini-3.1-flash-image-preview` (primary — Nano Banana 2)
2. `gemini-2.5-flash-image` (fallback)

**Retry Logic:**
- Up to 3 attempts per model with exponential backoff (0s, 4s, 8s)
- On HTTP 404: skip to next model (key doesn't have access)
- On HTTP 429: retry with backoff, then skip to next model
- On other errors: stop (don't try next model)

**Gemini API Call:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}
{
  "contents": [{ "parts": [{ "text": prompt }] }],
  "generationConfig": { "responseModalities": ["TEXT", "IMAGE"] }
}
```

**Success Response:**
```json
{
  "imageData": "iVBORw0...",   // base64 image
  "mimeType": "image/png"      // original format from Gemini
}
```

**Error Response:**
```json
{
  "error": "Rate limited — billing may take a few minutes to activate. Wait 30s and try again.",
  "detail": "gemini-3.1-flash-image-preview: rate limited — trying next model"
}
```

### `PUT /api/images/:projectId/:slug`

Saves page image data (with base64) to KV.

**KV Key:** `u:{email}:img:{projectId}:{slug}`
**Body:** JSON string of the page's image data object

### `GET /api/images/:projectId/:slug`

Loads a single page's image data from KV.

**Returns:** The stored JSON (slots array with base64) or `null` if not found.

### `GET /api/images/:projectId`

Lists all slugs that have saved images for a project.

**KV Prefix:** `u:{email}:img:{projectId}:`
**Returns:**
```json
{ "slugs": ["digital-marketing-services", "about", "contact", ...] }
```

---

## HTML Container (index.html lines 595–627)

```
┌─ Stage Header ──────────────────────────────────────────┐
│  "Image Generation"                                      │
│  "AI generates 5 images per page using Nano Banana 2"   │
│  [Style Guide] [Stop] [Generate All]                    │
├─ Global Style Panel (hidden by default) ─────────────────┤
│  Textarea + Save/Cancel                                  │
├─ Progress Bar ───────────────────────────────────────────┤
│  "X of Y images  Z%"  [████████░░░░]                    │
├─ Image Queue (#image-queue) ─────────────────────────────┤
│  (rendered dynamically by renderImageQueue())            │
├─ All-Done Banner (hidden until complete) ─────────────────┤
│  ✓ "All images generated"  [Generate Layout →]          │
└──────────────────────────────────────────────────────────┘
```

---

## Style Hierarchy

Image prompts follow a three-tier style cascade:

```
Per-Slot Custom Prompt  (user-edited in prompt editor)
         ↓ falls back to
Per-Page Style Override  (textarea in expanded page panel)
         ↓ falls back to
Global Image Style       (S.setup.imageStyle)
         ↓ falls back to
DEFAULT_IMAGE_STYLE      (hardcoded constant in copy.js)
```

When the global style is changed, all **empty** slots across all pages have their prompts rebuilt. When a page style override is changed, only **empty** slots on that page are rebuilt. Already-generated slots retain their original prompts.

---

## Generation Lifecycle

### Single Image
```
empty → generating → done | error
```

### Page Generation (5 slots)
```
Click "Generate All" on page row
  → S.imageGenRunning = true
  → Show stop button + progress bar
  → Expand page panel
  → Loop slots 0-4:
      → generateImage(slug, i)
      → 500ms delay
      → Check S.imageGenStop
  → S.imageGenRunning = false
  → Hide stop button
  → Check all-done
```

### Full Generation (all pages × 5 slots)
```
Click top-level "Generate All"
  → Same pattern as page generation
  → Outer loop: pages
  → Inner loop: slots 0-4
  → 400ms delay between slots
  → Auto-expands current page panel
  → Respects S.imageGenStop
```

### Stop Mechanism
```
Click "Stop" button
  → S.imageGenStop = true
  → Current in-flight request completes (not aborted)
  → Loop exits on next iteration
  → Running state reset
```

---

## WebP Compression Pipeline

```
Gemini returns PNG/JPEG base64
         ↓
Create Image element from base64
         ↓
Draw onto Canvas at original resolution
         ↓
Export as WebP (quality 0.88)
         ↓
Check size > 100KB?
  ├─ Yes → reduce quality by 0.10, re-export (up to 8 iterations)
  └─ No → done
         ↓
Return { b64: compressedBase64, sizeKB: N }
```

Fallback: if Canvas compression fails (e.g. CORS, zero dimensions), the original uncompressed base64 is kept.

---

## KV Storage Strategy

### Why Separate Keys?

The main project JSON (`u:{email}:project:{id}`) has a 25MB KV value limit. With 50+ pages × 5 images × ~100KB each, image data alone could exceed 25MB. Storing images in separate KV keys (`u:{email}:img:{projectId}:{slug}`) isolates this risk.

### Save Trigger

`savePageImages(slug)` is called:
- After each successful image generation
- Not on prompt edits or alt text changes (those go through `scheduleSave()` for the main project JSON — without base64)

### Load Strategy

`loadAllPageImages()` is called once during `initImageStage()`:
1. `GET /api/images/:projectId` — list all slugs with saved images
2. `Promise.all()` — fetch all slug data in parallel
3. Merge base64 into existing `S.images` slots (status set to `"done"`)
4. Re-render queue + progress bar

---

## Layout Stage Integration

The Layout stage (`layout.js`) can inject generated images into wireframes. When `loadAllPageImages()` completes, if the current stage is `layout`, it calls `renderLayoutQueue()` to refresh the "Reinject" button visibility — allowing users to insert their generated images into wireframe mockups.

---

## Known Constraints

| Constraint | Detail |
|---|---|
| **Gemini rate limits** | Free tier: ~2 req/min. Retry logic handles 429s with backoff, but bulk generation for large sitemaps (50+ pages) can take significant time |
| **No abort on stop** | `S.imageGenStop` only prevents the next loop iteration — the currently in-flight Gemini request completes. Unlike other stages, Images does not use `window._aiAbortCtrl` |
| **Client-side compression only** | WebP conversion happens in the browser via Canvas API. Very large images from Gemini may briefly consume significant memory |
| **5-slot hardcoded loop** | `generateAllImages()` and `generateAllPagesImages()` loop `i < 5` regardless of actual slot count. Extra slots added via "Add Image Slot" are not included in bulk generation |
| **IMAGE_SLOTS in copy.js** | The slot definitions live in `copy.js` (historical artifact) rather than `images.js`. Any changes to slot definitions must be made in `copy.js` |
| **No global stop/resume** | Uses `S.imageGenStop` instead of the standard `window._aiStopAll` + `window._aiStopResumeCtx` pattern used by other stages. No "Resume" button after stopping |
| **Alt text auto-generation** | `buildAltText()` is a simple prompt-stripping heuristic, not AI-generated. Quality is basic |

---

## File-by-File Reference

### images.js — Function Index

| Function | Line | Purpose |
|---|---|---|
| `getGlobalImageStyle()` | 2 | Returns active global style or default |
| `initImageStage()` | 6 | Stage entry point — init slots, load persisted images |
| `imgKey(slug)` | 30 | URL-encodes slug for KV key |
| `savePageImages(slug)` | 32 | Persists page image data to KV |
| `loadAllPageImages()` | 44 | Loads all persisted images from KV in parallel |
| `buildImagePrompt(page, slotIdx, styleOverride)` | 82 | Assembles Gemini prompt from context |
| `toggleImageStylePanel()` | 101 | Show/hide global style editor |
| `saveGlobalImageStyle()` | 112 | Save global style + rebuild empty prompts |
| `renderImageQueue()` | 132 | Full queue UI renderer |
| `addImageSlot(slug)` | 268 | Add extra slot beyond default 5 |
| `toggleImageExpand(slug)` | 277 | Expand/collapse page detail panel |
| `openPromptEditor(slug, slotIdx)` | 282 | Toggle inline prompt editor |
| `savePageImageStyle(slug)` | 288 | Save per-page style override |
| `clearPageImageStyle(slug)` | 303 | Clear per-page style override |
| `buildAltText(prompt)` | 310 | Auto-generate alt text from prompt |
| `saveAltText(slug, slotIdx, val)` | 318 | Save user-edited alt text |
| `compressToWebP(b64, srcMime, targetKB)` | 324 | Canvas-based WebP compression |
| `generateImage(slug, slotIdx, customPrompt?)` | 351 | Generate single image via Gemini |
| `generateImageWithCustomPrompt(slug, slotIdx)` | 403 | Generate from inline prompt editor |
| `generateAllImages(slug)` | 413 | Generate all 5 slots for one page |
| `generateAllPagesImages()` | 434 | Generate all images for all pages |
| `stopImageGen()` | 457 | Stop bulk generation |
| `updateImageProgress()` | 463 | Update progress bar counts |
| `checkImageAllDone()` | 480 | Check/show all-done banner |

### worker.js — Route Index

| Route | Method | Lines | Purpose |
|---|---|---|---|
| `/api/generate-image` | POST | 1703–1788 | Gemini image generation proxy |
| `/api/images/:projectId/:slug` | PUT | 617–634 | Save page image data to KV |
| `/api/images/:projectId/:slug` | GET | 636–649 | Load page image data from KV |
| `/api/images/:projectId` | GET | 651–665 | List slugs with saved images |
