# PRD: Interior Design Agent: Stage 1, "Layout"

| Field | Value |
|---|---|
| Status | Draft v2: reviewer decisions applied (§0) |
| Owner | ntswarup |
| Last updated | 2026-10-28 |
| Stage in scope | Stage 1 (Layout) only: turn the inputs into a first sample furniture layout that the user can edit. Stages 2–4 are in the roadmap (§0.2) |
| Runtime | Claude Managed Agents (hosted agent loop + sandbox), model `claude-opus-5-5` |
| Companion software | "Layout Editor": a web app we build ahead of time. The agent never writes editor code; it only writes a `layout.json` file that the editor opens. |
| Hosting | One Next.js app on Vercel (intake form + editor + backend routes), behind a shared password, free to use (§H) |

Each requirement has an ID (`IN-`, `FR-`, `ED-`, ...) so you can comment on it by ID.

## 0. Decisions and roadmap

### 0.1 Decisions log (2026-10-28)

| ID | Decision | Where it shows up |
|---|---|---|
| D-1 | The agent may fetch **any website** the user links (no allow-list) | IN-1, IN-3, A-2, A-5, RK-7 |
| D-2 | **Every living space** is furnished; there's no room picker in Stage 1 | IN-5, §5 |
| D-3 | **Imperial** units by default (ft-in); metric is a toggle. Data is still stored in cm so rounding doesn't build up | IN-5, ED-10, §10 |
| D-4 | Stage 1 output is a **2D top-down** layout only | G-1, §6 |
| D-5 | Each furniture category uses **one standard median piece**: the median width, depth, and height of common retail products in that category | §10 catalog |
| D-6 | Editor and backend are hosted on **Vercel** | §H |
| D-7 | Access is a **single shared password**; the tool is **free** for now. Google sign-in (auth) and Stripe (payments) come later | §H, H-3, H-9 |

### 0.2 Roadmap

| Stage | Name | What the user gets | What Stage 1 must leave ready for it |
|---|---|---|---|
| 1 | **Layout** (this PRD) | A furnished, editable 2D floorplan using standard median pieces | — |
| 2 | **Sourcing** | Each placeholder piece swapped for a real product chosen from a list (price, link, dimensions), matching the style brief | Every item has a `category`, footprint (`w`/`d`/`h`), `style_tags`, and the room it's in. Stage 2 matches products to these: footprint within ±10% and no new hard-rule violations (§7). `design_brief.md` palette and attributes are the search criteria |
| 3 | **Renders** | Images showing what the furnished space will look like | `layout.json` has heights (`h`), window and door positions, and sill heights. Photos (IN-2) and the palette give finishes and lighting. Coordinates are real-world, so a 3D scene can be built straight from them |
| 4 | **Agentic buys + delivery** | The agent places the orders and coordinates delivery dates | The listing address (IN-1) is kept on the project. Doorway widths (`openings[]`) are kept so items can be checked to fit through the doors. Needs payments (Stripe, D-7) and real user accounts first |

---

## 1. Goals and non-goals

| ID | Type | Statement | How we measure it |
|---|---|---|---|
| G-1 | Goal | Give the agent a home's listing, photos, inspiration, and floorplan, and get back a furnished, editable 2D floorplan layout | ≥ 80% of test projects produce a `layout.json` that passes validation, with no manual fixes |
| G-2 | Goal | The layout is physically plausible: furniture fits, paths are clear, doors open | 0 hard-rule violations (§7) in the delivered layout |
| G-3 | Goal | The layout reflects the user's stated or pinned style | Each style attribute in `design_brief.md` cites its input source (§8, criterion R-8) |
| G-4 | Goal | The user can rearrange the result by hand straight away | The editor opens the agent's `layout.json` without errors, and every ED-P0 feature works (§6) |
| NG-1 | Non-goal | Real products, pricing, or retailer links | Stage 2 (Sourcing) |
| NG-2 | Non-goal | 3D views, photoreal renders, or AI-generated room images | Stage 3 (Renders) |
| NG-2b | Non-goal | Placing orders, payments, delivery scheduling | Stage 4 (Agentic buys + delivery) |
| NG-3 | Non-goal | Changing walls, kitchen cabinetry, or bathroom fixtures | Treated as fixed |
| NG-4 | Non-goal | Pinterest or listing-site API integrations with OAuth; user accounts; payments | Uploads are the fallback (§3); accounts and payments come later (D-7) |
| NG-5 | Non-goal | Multi-floor homes in one layout | One floor per project in Stage 1; multi-floor homes need one project per floor |

## 2. Users and trigger

| ID | Item | Spec |
|---|---|---|
| U-1 | Primary user | A homebuyer, renter, or new owner planning how to furnish a specific home |
| U-2 | Trigger | The user submits the intake form in our web app (§3); that starts one agent session per project |
| U-3 | Kickoff type | `user.define_outcome` with the rubric in §8. This is a one-deliverable job, so the agent keeps revising until the rubric passes or it hits `max_iterations: 4` |
| U-4 | Follow-up | After delivery, the session stays open (idle). In Stage 1, the user edits by hand in the editor. Chat-based revisions ("move the sofa to the window wall") are P1 (FR-14) |

## 3. Inputs

At least one floorplan source (IN-4) **or** a listing with room dimensions (IN-1) is required. Everything else is optional, but recommended.

| ID | Input | Accepted forms | Required? | How it's ingested | What the agent extracts | Fallback if ingestion fails |
|---|---|---|---|---|---|---|
| IN-1 | Listing link | URL from **any website** (D-1), e.g. Zillow, Redfin, Realtor.com, StreetEasy, broker sites, **or** upload (PDF/screenshot of the listing) **or** pasted listing text | Optional | URL: the agent reads the page with `web_fetch` (no domain restriction, A-2). Upload: the browser uploads it to Vercel Blob, then our backend copies it to the Files API and it appears in the sandbox at `/mnt/session/uploads/listing/` | Address, total square footage, number of bedrooms/bathrooms, room list with dimensions when given, floorplan image URL if present, photo URLs | Major listing sites often block automated fetching. If the fetch fails or returns no data, the agent records `IN-1: fetch_failed` in `assumptions.json` and the app asks the user for a PDF/screenshot. The run is **not** blocked |
| IN-2 | Interior photos | URL to an album (Google Drive, Dropbox, or listing photos) **or** image uploads (JPG/PNG/HEIC/WebP, ≤ 40 images, ≤ 20 MB each) | Optional | Uploads go straight from the browser to Vercel Blob (H-5). For share links, our backend turns them into direct downloads. Each image is then copied to the Files API → `/mnt/session/uploads/photos/NN.jpg`. Album pages that need JavaScript to load (Google Photos, iCloud) are not supported → the user uploads instead | Fixed features and where they are: fireplace, built-ins, radiators, vents, outlets visible on walls, window sizes/heights, flooring, ceiling features. Existing color palette | If photos can't be matched to a room, the feature is listed as "seen in photo NN, location unknown" and **not** placed |
| IN-3 | Inspiration | Pinterest board URL **or** image uploads (≤ 30) **or** free text (≤ 2,000 characters). Any combination | At least one form is required | Pinterest URL: `web_fetch` on the board page. Uploads: Files API → `/mnt/session/uploads/inspiration/`. Text: included in the kickoff message | 3–6 style attributes (e.g., "warm minimalism", "light oak", "boucle textures", "low-profile seating"), a color palette (3–5 hex values), what furniture people prefer (e.g., sectional vs. sofa+chairs), and things to avoid | Pinterest boards usually require login and return little to a fetch. If fewer than 5 pins are readable, the agent uses whatever text and uploads it has and the app asks for uploads or a description |
| IN-4 | Blueprint / floorplan | URL to an image/PDF **or** upload (PDF, PNG, JPG, SVG; ≤ 25 MB; PDF ≤ 10 pages) | Required, unless IN-1 gives room dimensions | Same path as IN-2 → `/mnt/session/uploads/floorplan/` | Walls, rooms (polygons + labels), doors (with which way they swing and which side the hinge is on), windows, fixed fixtures (kitchen run, tub, toilet, vanity), dimension labels | If there's no scale on the plan, see FR-3 for the order of fallbacks |
| IN-5 | Project settings (form fields) | Units: imperial by default, metric toggle (D-3). Budget level (low/med/high; used only to set how many pieces go in each room in Stage 1). Things that must stay (e.g., "keep my 84-inch sofa": placed as a locked item with the given size). There is **no** room picker: every living space is furnished (D-2) | Units default to imperial; the rest is optional | Kickoff message | Constraints for the layout | — |

## 4. Agent pipeline (what happens in one session)

| Step | ID | Done by | Action | Writes (in `/mnt/session/outputs/` unless noted) |
|---|---|---|---|---|
| 0 | FR-0 | Our backend (Vercel route `POST /api/projects`) | Checks the form, copies uploads from Vercel Blob and downloads direct-file URLs, uploads them to the Files API, creates the session with the files attached plus the editor kit (§9, A-7), and sends the `user.define_outcome` kickoff. Saves the session ID on the project row and returns right away; the run itself happens in the background | — |
| 1 | FR-1 | Agent | Lists what it received: every input, whether ingestion succeeded or failed, and what was extracted | `inputs_manifest.json` |
| 2 | FR-2 | Agent | Reads the floorplan (vision via `read`, plus image processing in Python for walls and lines when the plan is clean and vector-like) → rooms, walls, doors, windows, fixtures | `floorplan_extracted.json` |
| 3 | FR-3 | Agent | Works out the scale, using the first of these that's available: (a) dimension labels on the plan; (b) room dimensions from the listing; (c) a standard door width of 32 in / 81 cm as a fallback; (d) total listing square footage to check plausibility. Records which source it used and a confidence of `high`/`med`/`low` | `assumptions.json` → `scale` |
| 4 | FR-4 | Agent | Cross-checks: total room area vs. listing square footage (should be within ±10%; otherwise flag it), and bedroom count vs. listing | `assumptions.json` → `checks` |
| 5 | FR-5 | Agent | Places fixed features found in photos (IN-2) | Adds to `floorplan_extracted.json` |
| 6 | FR-6 | Agent | Writes the style brief from IN-3 | `design_brief.md` |
| 7 | FR-7 | Agent | Picks furniture from the mounted catalog (§10) for each room, using the required set for each room type (§5) + style + budget level | Draft `layout.json` |
| 8 | FR-8 | Agent | Places the furniture following the rules in §7. Each item gets a one- or two-sentence explanation | `layout.json` |
| 9 | FR-9 | Agent | Runs `python /mnt/session/uploads/kit/validate_layout.py layout.json` and fixes problems until there are 0 hard errors | `validation_report.json` |
| 10 | FR-10 | Agent | Draws a picture of the layout from `layout.json` (same coordinate system as the editor) | `layout_preview.svg`, `layout_preview.png` (2,000 px on the long side) |
| 11 | FR-11 | Grader (built-in) | Checks the deliverable against the rubric in §8 and sends the gaps back to the agent; repeats until it passes or 4 attempts are used | — |
| 12 | FR-12 | Our backend (Vercel route `POST /api/webhooks/anthropic`) | Receives the Managed Agents `session.status_idled` webhook, verifies its signature, lists the session's output files, copies them to Vercel Blob, and marks the project `ready`. The project page (polling every 10 s) then opens the editor with `layout.json`. A Vercel function can't stay open for a 25-minute run, so the backend never holds the event stream | — |
| — | FR-13 | Agent | Never invents dimensions without saying so: every inferred value is listed in `assumptions.json` with its source | — |
| — | FR-14 (P1) | Agent | Accepts a `user.message` with a revision, or an edited `layout.json` from the editor, and returns version `layout.v{n+1}.json`, which must still pass validation | — |

## 5. Rooms in scope and the required furniture for each

Every living space on the plan is furnished; the user doesn't choose rooms (D-2).

| Room type | Furnished in Stage 1? | Required pieces (all must be placed, or explained if they're missing) | Optional pieces (chosen by style, budget level, and space) |
|---|---|---|---|
| Living room | Yes | Main seating (a sofa or sectional), coffee table, ≥ 1 side table, rug, TV/media console **or** a reason for leaving it out | Armchair(s), console table, floor lamp, bookcase, ottoman |
| Bedroom (each) | Yes | Bed (size: primary = queen or king if the room is ≥ 11×12 ft, otherwise full; secondary = full or queen), ≥ 1 nightstand, dresser **or** a reason for leaving it out | 2nd nightstand, bench, armchair, desk, rug |
| Dining area | Yes | Dining table + chairs (number of chairs = table capacity) | Sideboard, pendant-light position, rug |
| Home office / den | Yes, if it's labeled on the plan or the user asks | Desk, desk chair | Bookcase, reading chair |
| Entry / foyer | Yes, if it's ≥ 30 sq ft | — | Console, bench |
| Kitchen | Fixed only | — | Counter stools if there's an island or peninsula |
| Bathrooms, closets, laundry, garage, outdoor | No (drawn but not furnished) | — | — |

## 6. Layout Editor (the pre-built software): what it can do

Stack: part of the Next.js (App Router) + TypeScript app on Vercel (§H); the canvas uses `react-konva`, a 2D drawing library. It opens a project's latest `layout.json` from Vercel Blob, and can also open a file by upload or drag-and-drop.

| ID | Priority | Feature | Acceptance criteria |
|---|---|---|---|
| ED-1 | P0 | Load and validate | Opens any `layout.json` that matches schema v1 (§10). If the file is invalid, shows the field path and error message instead of a blank canvas |
| ED-2 | P0 | Draw the plan | Walls drawn to their thickness; doors with an arc showing how they swing; windows as triple lines; room labels with area; fixed fixtures in gray; furniture as labeled shapes drawn from above, to scale |
| ED-3 | P0 | Move furniture by dragging | Furniture snaps to a 1 in / 2.5 cm grid (hold Alt to turn snapping off) and to walls within 2 in / 5 cm. Dragging stays smooth (60 fps) with 200 items on screen |
| ED-4 | P0 | Rotate | R key or a rotate handle: 90° steps by default, 15° steps while holding Shift. Rotates around the item's center |
| ED-5 | P0 | Select / multi-select / delete / duplicate | Click; Shift+click; drag a box to select several; Delete/Backspace; Ctrl/Cmd+D |
| ED-6 | P0 | Live warnings | The same hard rules as the validator (§7), re-checked within 100 ms of dropping an item. Items breaking a rule get a red outline; a warning list shows the rule IDs; clicking a warning selects the item |
| ED-7 | P0 | Undo / redo | Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z, at least 50 steps |
| ED-8 | P0 | Zoom / pan | Scroll to zoom (25%–400%), Space+drag or two-finger drag to pan, "fit to plan" button |
| ED-9 | P0 | Export | Download `layout.json` (still schema v1, with `edited_by: "user"` set on changed items) and a PNG |
| ED-10 | P0 | Units | ft-in by default (D-3); switch to cm. Data is always stored in cm (§10) |
| ED-11 | P1 | Add from catalog | A side panel of catalog items (§10), searchable by room type; drag an item onto the plan |
| ED-12 | P1 | Resize | Type in width and depth (only within the item's allowed size range from the catalog) |
| ED-13 | P1 | Item details | Hovering or selecting an item shows its label, size, and the agent's explanation |
| ED-14 | P1 | Lock | Locked items can't be moved; the agent must keep them where they are in FR-14 revisions |
| ED-15 | P1 | Autosave | Saves to the browser's localStorage every 5 seconds and on every change; offers to restore the last session |
| ED-19 | P0 | Save to project | "Save" writes the edited `layout.json` to Vercel Blob as a new version (`layout.v{n}.json`); the project page lists the versions |
| ED-16 | P1 | "Send to agent" | Sends the edited `layout.json` + a note back to the session (FR-14) |
| ED-17 | P2 | Measure tool | Click two points → distance |
| ED-18 | P2 | Compare | Overlay the agent's version and the user's version |

## 7. Layout rules (checked by both `validate_layout.py` and the editor)

| ID | Severity | Rule | Threshold |
|---|---|---|---|
| L-1 | Hard | Each item sits entirely inside its room, allowing for wall thickness | 0 cm outside |
| L-2 | Hard | No two items overlap. Exception: rugs, and items marked `stackable_on` (e.g., a lamp on a side table) | 0 cm² overlap |
| L-3 | Hard | Nothing sits inside a door's swing arc | Arc radius = door width |
| L-4 | Hard | Main walkway from each door of a room to its main seating, bed, or table | ≥ 36 in / 91 cm wide |
| L-5 | Hard | Bed: space beside each side that has a nightstand, and at the foot of the bed | Sides ≥ 24 in / 61 cm; foot ≥ 30 in / 76 cm |
| L-6 | Hard | Dining: from the table edge to a wall or obstacle on every side that has chairs | ≥ 36 in / 91 cm (≥ 44 in / 112 cm if it's also a walkway) |
| L-7 | Hard | Dresser and media console: open space in front | ≥ 36 in / 91 cm |
| L-8 | Hard | Fixed features (FR-5) aren't covered (a radiator or fireplace hearth can't be hidden by furniture) | Hearth: 20 in / 51 cm clear in front |
| L-9 | Soft | Gap between the sofa and coffee table | 14–18 in / 36–46 cm |
| L-10 | Soft | Coffee table length relative to sofa | ½ to ⅔ of the sofa's length |
| L-11 | Soft | Rug: front legs of all main seating on the rug; rug ≥ 12 in / 30 cm from walls | — |
| L-12 | Soft | Tall pieces (> 36 in / 91 cm) don't block a window | Not on a wall segment with a window |
| L-13 | Soft | TV distance | 1.5–2.5 × the screen diagonal (default 65 in → 8.1–13.5 ft) |
| L-14 | Soft | Desk chair: space behind it | ≥ 36 in / 91 cm |

"Hard" = the layout must have 0 of these violations to be delivered. "Soft" = reported in `validation_report.json` and the editor, and allowed if the reason is written down.

## 8. Outcome rubric (the starter rubric sent with `user.define_outcome`; tune it after the first test runs)

| ID | Criterion (each one is checked on its own) |
|---|---|
| R-1 | `/mnt/session/outputs/layout.json` exists and matches schema v1 (`validation_report.json` → `schema_errors: []`) |
| R-2 | `validation_report.json` shows 0 hard-rule (L-1 to L-8) violations; each soft violation has a written reason |
| R-3 | `assumptions.json` names the scale source and confidence (FR-3) and lists every inferred dimension along with where it came from |
| R-4 | Room polygons are closed and don't cross themselves; if the listing gives square footage, total room area is within ±10% of it, or the gap is explained |
| R-5 | Every room that's furnished in scope (§5) has all its required pieces, or a written reason why one is missing |
| R-6 | Every door and window on the extracted plan appears in `layout.json`, with which way each door swings |
| R-7 | Fixed features seen in photos are either placed or listed as "location unknown" with the photo filename |
| R-8 | `design_brief.md` has 3–6 style attributes and a palette of 3–5 hex values; each one names its source (pin/upload file name or a quote from the user's text) |
| R-9 | Every furniture item has `style_tags` that come from R-8's attributes, and an explanation of 2 sentences or fewer |
| R-10 | `layout_preview.png` exists and is drawn from the final `layout.json` (the item count matches) |

## 9. Agent configuration (Managed Agents)

| ID | Setting | Value | Why |
|---|---|---|---|
| A-1 | Model | `claude-opus-5-5`, effort `high` | Spatial reasoning and reading floorplans need deep reasoning; the default effort (`medium`) is too low for this |
| A-2 | Tools | `agent_toolset_20260401` with `bash`, `read`, `write`, `edit`, `glob`, `grep` on; **`web_fetch` on with no `allowed_domains` list** (any site, D-1); **`web_search` off** | Links come from the user and can be on any site. Search isn't needed until Stage 2 (Sourcing) |
| A-3 | Permission policy | `default_config.permission_policy: {type: auto}` | It runs without human input; there are no outside systems it changes |
| A-4 | Skills | None in Stage 1 (`read` handles PDFs and images). Later candidate: package the kit (A-7) as a custom skill | Fewer moving parts |
| A-5 | Environment | `cloud`, networking **`unrestricted`** (D-1) | Under `limited` networking, `web_fetch` can only reach listed hosts, so "any website" needs `unrestricted`. Trade-off: the sandbox can also reach any host. That's acceptable because the sandbox holds no credentials (A-10) and tool calls run under the `auto` policy (A-3), which denies high-risk calls. See RK-7 |
| A-6 | Sandbox packages | Python: `pillow`, `opencv-python-headless`, `numpy`, `shapely`, `jsonschema`, `cairosvg` | Image processing, geometry, validation, drawing the preview |
| A-7 | Mounted kit (Files API, read-only, `/mnt/session/uploads/kit/`) | `layout.schema.json`, `validate_layout.py`, `render_preview.py`, `furniture_catalog.json`, `rules.json` (§7 thresholds) | The editor and the agent use exactly the same schema, rules, and catalog |
| A-8 | Session budget | Hard cap of $10 per session (list price) to start; adjust after measuring 10 test runs | Prevents runaway outcome loops. Real cost per run hasn't been measured yet |
| A-9 | Outcome `max_iterations` | 4 | Balances quality against cost |
| A-10 | Credentials | None in Stage 1 (no MCP servers, no private APIs). The Anthropic API key and webhook signing secret live only in Vercel environment variables, never in the sandbox | — |

## 10. Data contracts

**`layout.json` (schema v1).** All lengths are in centimeters (decimal numbers, 1 decimal place). Coordinates start at the top-left of the plan, with x going right and y going down. Angles are in degrees, clockwise.

| Path | Type | Notes |
|---|---|---|
| `schema_version` | `"1.0"` | |
| `project_id` | string | |
| `units_display` | `"imperial" \| "metric"` | Display only |
| `scale` | `{source, confidence, px_per_cm}` | From FR-3 |
| `walls[]` | `{id, x1, y1, x2, y2, thickness}` | |
| `openings[]` | `{id, wall_id, type: door\|window\|opening, offset, width, hinge: start\|end, swing: in\|out\|left\|right\|sliding\|none, sill_height?}` | `offset` is measured along the wall from (x1,y1) |
| `rooms[]` | `{id, label, type, polygon: [[x,y]...], area_cm2, furnish: bool}` | `type` comes from the §5 list |
| `fixed[]` | `{id, room_id, kind, polygon, source: plan\|photo:NN}` | Fireplace, radiator, island, tub… |
| `items[]` | `{id, catalog_id, category, room_id, label, x, y, w, d, h, rotation, locked, edited_by: agent\|user, style_tags[], rationale, product: null}` | (x, y) is the item's center; w and d are measured before rotation. `category` and `product` (always `null` in Stage 1) are for Stage 2 sourcing |
| `meta` | `{created_at, agent_session_id, version, address?}` | `address` comes from IN-1, if available (needed in Stage 4) |

**`furniture_catalog.json`: one standard median piece per category (D-5).** For each category, take ≥ 20 common products from mainstream retailers (e.g., IKEA, Wayfair, West Elm, Target, Article), compute the median width, depth, and height, and round to the nearest inch. This is a one-time research task in M1, and the numbers below are **placeholders until then**. Each category has exactly one default piece. The resize range (ED-12) is the 10th–90th percentile width from the same sample. About 40 categories in total; a sample:

| catalog_id | Category | Median W × D × H (in) | Same in cm | Resize range W (in) |
|---|---|---|---|---|
| `sofa_3` | Sofa, 3-seat | 84 × 37 × 33 | 213 × 94 × 84 | 72–96 |
| `loveseat` | Loveseat | 62 × 35 × 33 | 157 × 89 × 84 | 54–70 |
| `sectional_l` | Sectional, L-shape | 110 × 84 × 33 | 279 × 213 × 84 | 96–126 |
| `chair_arm` | Armchair | 32 × 34 × 32 | 81 × 86 × 81 | 27–38 |
| `table_coffee` | Coffee table | 48 × 24 × 17 | 122 × 61 × 43 | 36–60 |
| `table_side` | Side table | 20 × 20 × 23 | 51 × 51 × 58 | 16–24 |
| `console_media` | Media console | 70 × 18 × 22 | 178 × 46 × 56 | 48–84 |
| `rug_area` | Area rug | 96 × 120 × 0.5 (8×10 ft) | 244 × 305 × 1 | sizes 5×8, 6×9, 8×10, 9×12 ft |
| `bed_queen` | Queen bed (with frame) | 64 × 86 × 45 | 163 × 218 × 114 | fixed |
| `bed_king` | King bed (with frame) | 80 × 86 × 45 | 203 × 218 × 114 | fixed |
| `bed_full` | Full bed (with frame) | 58 × 80 × 42 | 147 × 203 × 107 | fixed |
| `nightstand` | Nightstand | 22 × 16 × 24 | 56 × 41 × 61 | 16–28 |
| `dresser` | Dresser, 6-drawer | 60 × 18 × 32 | 152 × 46 × 81 | 40–70 |
| `table_dining` | Dining table, seats 6 | 72 × 38 × 30 | 183 × 97 × 76 | 60–84 |
| `chair_dining` | Dining chair | 19 × 22 × 34 | 48 × 56 × 86 | fixed |
| `desk` | Desk | 48 × 24 × 30 | 122 × 61 × 76 | 40–60 |
| `chair_desk` | Desk chair | 26 × 26 × 38 | 66 × 66 × 97 | fixed |
| `bookcase` | Bookcase | 32 × 13 × 72 | 81 × 33 × 183 | 24–40 |
| `bench` | Bench | 48 × 16 × 18 | 122 × 41 × 46 | 36–60 |
| `stool_counter` | Counter stool | 18 × 18 × 34 | 46 × 46 × 86 | fixed |

**Other outputs:** `inputs_manifest.json`, `floorplan_extracted.json`, `assumptions.json`, `design_brief.md`, `validation_report.json` (`{schema_errors[], hard[], soft[]}`, each entry being `{rule_id, item_ids, detail}`), `layout_preview.svg/png`.

## H. Hosting, access, and app backend (Vercel)

| ID | Item | Spec |
|---|---|---|
| H-1 | App | One Next.js (App Router) + TypeScript app deployed on Vercel: intake form (§3), project page (status + versions), editor (§6), and backend API routes |
| H-2 | Pages | `/login` → `/` (start a new project, list recent projects) → `/p/[projectId]` (status while it runs, then the editor) |
| H-3 | Access (D-7) | One shared password stored in the Vercel environment variable `APP_PASSWORD`. Entering it at `/login` sets a signed, httpOnly cookie that lasts 30 days. Next.js middleware sends any request without a valid cookie to `/login` (pages and `/api/*`, except the webhook route, which is checked by its signature). 5 wrong attempts from one IP → locked out for 15 minutes |
| H-4 | Projects without accounts | Each project has a random, unguessable ID (UUID v4). "Recent projects" are remembered in the browser's localStorage. Anyone with the password **and** a project link can open that project |
| H-5 | File storage | Vercel Blob. Uploads go from the browser straight to Blob ("client uploads"), because Vercel functions accept at most 4.5 MB per request body. Agent outputs are copied to Blob by FR-12 |
| H-6 | Database | Postgres (Neon, through the Vercel Marketplace), one table `projects(id, created_at, status: queued\|running\|ready\|failed, session_id, inputs jsonb, latest_layout_url, cost_usd, error)` |
| H-7 | Run status | The project page polls `GET /api/projects/[id]` every 10 s. The route reads the project row and, while the project is `running`, the session's status from the Managed Agents API |
| H-8 | Cost guard (free tool) | Each run costs real money, so: ≤ 3 new projects per browser per day, ≤ 25 new projects per day across the whole app, plus the per-session cap (A-8). Limits are environment variables so they can be changed without redeploying code. When a limit is reached, the form says so instead of starting a run |
| H-9 | Later: auth + payments | Google sign-in (Auth.js) replaces the shared password; Stripe Checkout adds paid plans. The `projects` table gets a `user_id` column then. Out of scope for Stage 1 |
| H-10 | Secrets | `ANTHROPIC_API_KEY`, `ANTHROPIC_WEBHOOK_SIGNING_KEY`, `APP_PASSWORD`, `COOKIE_SECRET`, `AGENT_ID`, `ENVIRONMENT_ID`, Blob and Postgres tokens: all Vercel environment variables, never sent to the browser or the agent |

## 11. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NF-1 | Time to first layout | Target: half of runs finish in ≤ 12 min, and 90% in ≤ 25 min, including the outcome loop. These are estimates; check them in the first 10 test runs |
| NF-2 | Cost | Average ≤ $5 per project; hard cap per A-8; daily limits per H-8. The tool is free to users, so we pay for every run |
| NF-3 | Privacy | Interior photos can identify a person's home: they're stored per project, deleted 30 days after the project is closed, and never used for anyone else's project |
| NF-4 | Copyright / site terms | Listing and Pinterest images are used only within that user's own project and aren't redistributed. The app tells users to only provide links they're allowed to share |
| NF-5 | Observability | Save the session ID and the Console link for every project; record cost and time from the session's usage and the outcome-evaluation result |
| NF-6 | Determinism | `validate_layout.py` and the editor's live warnings (ED-6) produce the same results on the same file (shared `rules.json` + a shared set of test layouts, ≥ 20 cases) |

## 12. Risks

| ID | Risk | Likelihood | Mitigation |
|---|---|---|---|
| RK-1 | Listing sites block `web_fetch` or don't allow scraping in their terms | High | Upload/paste fallback (IN-1); a failed fetch never blocks the run |
| RK-2 | Pinterest boards need a login and return little content | High | Uploads + text fallback (IN-3); a Pinterest API integration is a later decision |
| RK-3 | Floorplan scale is wrong (e.g., the plan isn't drawn to scale or is a marketing graphic) | Medium | FR-3 tries scale sources in order + the FR-4 area check; low confidence shows a "confirm one wall length" prompt in the editor |
| RK-4 | Hand-drawn or low-resolution plans → wrong walls | Medium | Vision first, image processing as a backup; record the confidence; the user can correct it in P1 (plan editing is out of scope; re-upload is the path) |
| RK-5 | Photos show features but not where they are | High | R-7 allows "location unknown"; never guess where a fixed feature goes |
| RK-7 | Open web access (D-1): a fetched page contains hidden instructions that try to redirect the agent ("prompt injection"), or the sandbox is used to reach unexpected hosts | Medium | No secrets in the sandbox (A-10); the agent's only output goes to its own outputs folder; the `auto` policy denies high-risk calls; the system prompt says to treat fetched pages as data, never as instructions; outputs must still pass the validator and rubric |
| RK-8 | Free tool + shared password gets shared widely → runaway cost | Medium | H-8 limits, A-8 cap, rotate `APP_PASSWORD` if needed; Google sign-in later (H-9) |
| RK-6 | The outcome loop keeps going on rubrics it can't pass (e.g., the room is too small for the required pieces) | Medium | R-5 allows a written reason; A-8 budget; `max_iterations: 4` |

## 13. Milestones

| # | Deliverable | Exit criterion |
|---|---|---|
| M1 | Kit: schema v1, `rules.json`, `validate_layout.py`, median-piece catalog (D-5 research), ≥ 20 test layouts | Validator passes all test layouts and correctly flags the deliberately broken ones |
| M2 | Next.js app on Vercel with password gate (H-1 to H-4) + Layout Editor P0 (ED-1 to ED-10, ED-19) | Loads every test layout; all P0 checks pass |
| M3 | Agent + environment set up with `ant apply`; backend ingestion and webhook (FR-0, FR-12, H-5 to H-8) | One test project runs end to end |
| M4 | Test set of 10 real projects (different floorplan types, with and without listings) | G-1 to G-4 measured; rubric and budget tuned |
| M5 | Editor P1 + FR-14 revisions | Edit → send to agent → still valid after revision |

## 14. Open questions for the reviewer

Questions Q-1 to Q-6 from v1 have been answered (see §0.1). New questions:

| ID | Question | Default if no answer |
|---|---|---|
| Q-7 | Should anyone with the password be able to see every project, or only projects they have the link to? | Only by link (H-4) |
| Q-8 | Are the daily limits OK: 3 new projects per browser, 25 for the whole app? | Yes (H-8) |
| Q-9 | For median pieces: should it be the median across all retailers, or just mid-price retailers (e.g., West Elm, Article)? | All mainstream retailers listed in §10 |
| Q-10 | Should Stage 1 already record the listing address for Stage 4 delivery, or wait until Stage 4 to ask for it? | Record it if the listing has it (`meta.address`) |
