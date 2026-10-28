# PRD: Interior Design Agent: Phase 1, "Sample Layout"

| Field | Value |
|---|---|
| Status | Draft for review |
| Owner | ntswarup |
| Last updated | 2026-10-28 |
| Phase in scope | Phase 1 only: turn the inputs into a first sample furniture layout that the user can edit |
| Runtime | Claude Managed Agents (hosted agent loop + sandbox), model `claude-opus-5-5` |
| Companion software | "Layout Editor": a web app we build ahead of time. The agent never writes editor code; it only writes a `layout.json` file that the editor opens. |

Each requirement has an ID (`IN-`, `FR-`, `ED-`, ...) so you can comment on it by ID.

---

## 1. Goals and non-goals

| ID | Type | Statement | How we measure it |
|---|---|---|---|
| G-1 | Goal | Give the agent a home's listing, photos, inspiration, and floorplan, and get back a furnished, editable 2D floorplan layout | ≥ 80% of test projects produce a `layout.json` that passes validation, with no manual fixes |
| G-2 | Goal | The layout is physically plausible: furniture fits, paths are clear, doors open | 0 hard-rule violations (§7) in the delivered layout |
| G-3 | Goal | The layout reflects the user's stated or pinned style | Each style attribute in `design_brief.md` cites its input source (§8, criterion R-8) |
| G-4 | Goal | The user can rearrange the result by hand straight away | The editor opens the agent's `layout.json` without errors, and every ED-P0 feature works (§6) |
| NG-1 | Non-goal | Buying real products, pricing, or retailer links | Phase 2 |
| NG-2 | Non-goal | 3D views, photoreal renders, or AI-generated room images | Phase 3 |
| NG-3 | Non-goal | Changing walls, kitchen cabinetry, or bathroom fixtures | Treated as fixed |
| NG-4 | Non-goal | Pinterest or listing-site API integrations with OAuth | Uploads are the fallback (§3) |
| NG-5 | Non-goal | Multi-floor homes in one layout | One floor per project in Phase 1; multi-floor homes need one project per floor |

## 2. Users and trigger

| ID | Item | Spec |
|---|---|---|
| U-1 | Primary user | A homebuyer, renter, or new owner planning how to furnish a specific home |
| U-2 | Trigger | The user submits the intake form in our web app (§3); that starts one agent session per project |
| U-3 | Kickoff type | `user.define_outcome` with the rubric in §8. This is a one-deliverable job, so the agent keeps revising until the rubric passes or it hits `max_iterations: 4` |
| U-4 | Follow-up | After delivery, the session stays open (idle). In Phase 1, the user edits by hand in the editor. Chat-based revisions ("move the sofa to the window wall") are P1 (FR-14) |

## 3. Inputs

At least one floorplan source (IN-4) **or** a listing with room dimensions (IN-1) is required. Everything else is optional, but recommended.

| ID | Input | Accepted forms | Required? | How it's ingested | What the agent extracts | Fallback if ingestion fails |
|---|---|---|---|---|---|---|
| IN-1 | Listing link | URL (Zillow, Redfin, Realtor.com, StreetEasy, agent/broker sites) **or** upload (PDF/screenshot of the listing) **or** pasted listing text | Optional | URL: the agent reads the page with `web_fetch` (allow-listed domains, §9). Upload: our backend sends it to the Files API and it appears in the sandbox at `/mnt/session/uploads/listing/` | Address, total square footage, number of bedrooms/bathrooms, room list with dimensions when given, floorplan image URL if present, photo URLs | Major listing sites often block automated fetching. If the fetch fails or returns no data, the agent records `IN-1: fetch_failed` in `assumptions.json` and the app asks the user for a PDF/screenshot. The run is **not** blocked |
| IN-2 | Interior photos | URL to an album (Google Drive, Dropbox, or listing photos) **or** image uploads (JPG/PNG/HEIC/WebP, ≤ 40 images, ≤ 20 MB each) | Optional | Our backend turns share links into direct downloads, then sends each image to the Files API → `/mnt/session/uploads/photos/NN.jpg`. Album pages that need JavaScript to load (Google Photos, iCloud) are not supported → the user uploads instead | Fixed features and where they are: fireplace, built-ins, radiators, vents, outlets visible on walls, window sizes/heights, flooring, ceiling features. Existing color palette | If photos can't be matched to a room, the feature is listed as "seen in photo NN, location unknown" and **not** placed |
| IN-3 | Inspiration | Pinterest board URL **or** image uploads (≤ 30) **or** free text (≤ 2,000 characters). Any combination | At least one form is required | Pinterest URL: `web_fetch` on the board page (allow-listed `pinterest.com`, `pinimg.com`). Uploads: Files API → `/mnt/session/uploads/inspiration/`. Text: included in the kickoff message | 3–6 style attributes (e.g., "warm minimalism", "light oak", "boucle textures", "low-profile seating"), a color palette (3–5 hex values), what furniture people prefer (e.g., sectional vs. sofa+chairs), and things to avoid | Pinterest boards usually require login and return little to a fetch. If fewer than 5 pins are readable, the agent uses whatever text and uploads it has and the app asks for uploads or a description |
| IN-4 | Blueprint / floorplan | URL to an image/PDF **or** upload (PDF, PNG, JPG, SVG; ≤ 25 MB; PDF ≤ 10 pages) | Required, unless IN-1 gives room dimensions | Same path as IN-2 → `/mnt/session/uploads/floorplan/` | Walls, rooms (polygons + labels), doors (with which way they swing and which side the hinge is on), windows, fixed fixtures (kitchen run, tub, toilet, vanity), dimension labels | If there's no scale on the plan, see FR-3 for the order of fallbacks |
| IN-5 | Project settings (form fields) | Units (imperial/metric), rooms to furnish (default: every living space, §5), budget level (low/med/high; used only to set furniture density in Phase 1), things that must stay (e.g., "keep my 84-inch sofa") | Units default to imperial | Kickoff message | Constraints for the layout | — |

## 4. Agent pipeline (what happens in one session)

| Step | ID | Done by | Action | Writes (in `/mnt/session/outputs/` unless noted) |
|---|---|---|---|---|
| 0 | FR-0 | Our backend | Checks the form, downloads direct-file URLs, uploads them to the Files API, creates the session with the files attached plus the editor kit (§9, A-7), and sends the `user.define_outcome` kickoff | — |
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
| 12 | FR-12 | Our backend | When the session goes idle: lists the output files for that session, stores them, and opens the editor with `layout.json` | — |
| — | FR-13 | Agent | Never invents dimensions without saying so: every inferred value is listed in `assumptions.json` with its source | — |
| — | FR-14 (P1) | Agent | Accepts a `user.message` with a revision, or an edited `layout.json` from the editor, and returns version `layout.v{n+1}.json`, which must still pass validation | — |

## 5. Rooms in scope and the required furniture for each

| Room type | Furnished in Phase 1? | Required pieces (all must be placed, or explained if they're missing) | Optional pieces (chosen by style, budget level, and space) |
|---|---|---|---|
| Living room | Yes | Main seating (a sofa or sectional), coffee table, ≥ 1 side table, rug, TV/media console **or** a reason for leaving it out | Armchair(s), console table, floor lamp, bookcase, ottoman |
| Bedroom (each) | Yes | Bed (size: primary = queen or king if the room is ≥ 11×12 ft, otherwise full; secondary = full or queen), ≥ 1 nightstand, dresser **or** a reason for leaving it out | 2nd nightstand, bench, armchair, desk, rug |
| Dining area | Yes | Dining table + chairs (number of chairs = table capacity) | Sideboard, pendant-light position, rug |
| Home office / den | Yes, if it's labeled on the plan or the user asks | Desk, desk chair | Bookcase, reading chair |
| Entry / foyer | Yes, if it's ≥ 30 sq ft | — | Console, bench |
| Kitchen | Fixed only | — | Counter stools if there's an island or peninsula |
| Bathrooms, closets, laundry, garage, outdoor | No (drawn but not furnished) | — | — |

## 6. Layout Editor (the pre-built software): what it can do

Stack: React 18 + TypeScript + Vite + `react-konva` (2D canvas). A static site with no backend. It loads `layout.json` from a URL parameter, a file upload, or drag-and-drop.

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
| ED-10 | P0 | Units | Switch between ft-in and cm; data is always stored in cm (§10) |
| ED-11 | P1 | Add from catalog | A side panel of catalog items (§10), searchable by room type; drag an item onto the plan |
| ED-12 | P1 | Resize | Type in width and depth (only within the item's allowed size range from the catalog) |
| ED-13 | P1 | Item details | Hovering or selecting an item shows its label, size, and the agent's explanation |
| ED-14 | P1 | Lock | Locked items can't be moved; the agent must keep them where they are in FR-14 revisions |
| ED-15 | P1 | Autosave | Saves to the browser's localStorage every 5 seconds and on every change; offers to restore the last session |
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
| A-2 | Tools | `agent_toolset_20260401` with `bash`, `read`, `write`, `edit`, `glob`, `grep` on; **`web_fetch` on** with `allowed_domains` = the A-5 list; **`web_search` off** | URLs come from the user, so it needs fetch. Search isn't needed in Phase 1 |
| A-3 | Permission policy | `default_config.permission_policy: {type: auto}` | It runs without human input; there are no outside systems it changes |
| A-4 | Skills | None in Phase 1 (`read` handles PDFs and images). Phase 2 candidate: package the kit (A-7) as a custom skill | Fewer moving parts |
| A-5 | Environment | `cloud`, networking `limited`, `allowed_hosts`: `zillow.com`, `redfin.com`, `realtor.com`, `streeteasy.com`, `pinterest.com`, `pinimg.com`, plus a configurable list of broker domains. `allow_package_managers: true` | Locked down by default. Allowed hosts also open up the sandbox, so the list stays short. **See open question Q-1** |
| A-6 | Sandbox packages | Python: `pillow`, `opencv-python-headless`, `numpy`, `shapely`, `jsonschema`, `cairosvg` | Image processing, geometry, validation, drawing the preview |
| A-7 | Mounted kit (Files API, read-only, `/mnt/session/uploads/kit/`) | `layout.schema.json`, `validate_layout.py`, `render_preview.py`, `furniture_catalog.json`, `rules.json` (§7 thresholds) | The editor and the agent use exactly the same schema, rules, and catalog |
| A-8 | Session budget | Hard cap of $10 per session (list price) to start; adjust after measuring 10 test runs | Prevents runaway outcome loops. Real cost per run hasn't been measured yet |
| A-9 | Outcome `max_iterations` | 4 | Balances quality against cost |
| A-10 | Credentials | None in Phase 1 (no MCP servers, no private APIs) | — |

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
| `items[]` | `{id, catalog_id, room_id, label, x, y, w, d, h, rotation, locked, edited_by: agent\|user, style_tags[], rationale}` | (x, y) is the item's center; w and d are measured before rotation |
| `meta` | `{created_at, agent_session_id, version}` | |

**`furniture_catalog.json`** (made-up generic items, about 40 entries; a sample is shown here):

| catalog_id | Label | Default W × D × H (cm) | Allowed W range (cm) |
|---|---|---|---|
| `sofa_3` | Sofa, 3-seat | 213 × 91 × 84 | 180–240 |
| `sectional_l` | Sectional, L-shape | 274 × 213 × 84 | 240–320 |
| `chair_arm` | Armchair | 81 × 86 × 79 | 70–95 |
| `table_coffee_rect` | Coffee table | 122 × 61 × 43 | 90–150 |
| `table_side` | Side table | 51 × 51 × 56 | 40–60 |
| `console_media` | Media console | 183 × 46 × 56 | 120–240 |
| `rug_8x10` | Rug 8×10 ft | 244 × 305 × 1 | 152–366 |
| `bed_queen` | Queen bed (with frame) | 160 × 213 × 100 | fixed |
| `bed_king` | King bed (with frame) | 198 × 213 × 100 | fixed |
| `nightstand` | Nightstand | 56 × 41 × 61 | 40–70 |
| `dresser_6` | Dresser, 6-drawer | 152 × 46 × 81 | 100–180 |
| `table_dining_6` | Dining table, seats 6 | 183 × 91 × 76 | 150–220 |
| `chair_dining` | Dining chair | 46 × 53 × 86 | fixed |
| `desk` | Desk | 122 × 61 × 76 | 100–160 |

**Other outputs:** `inputs_manifest.json`, `floorplan_extracted.json`, `assumptions.json`, `design_brief.md`, `validation_report.json` (`{schema_errors[], hard[], soft[]}`, each entry being `{rule_id, item_ids, detail}`), `layout_preview.svg/png`.

## 11. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NF-1 | Time to first layout | Target: half of runs finish in ≤ 12 min, and 90% in ≤ 25 min, including the outcome loop. These are estimates; check them in the first 10 test runs |
| NF-2 | Cost | Average ≤ $5 per project; hard cap per A-8 |
| NF-3 | Privacy | Interior photos can identify a person's home: they're stored per project, deleted 30 days after the project is closed, and never used for anyone else's project |
| NF-4 | Copyright / site terms | Listing and Pinterest images are used only within that user's own project and aren't redistributed. The app tells users to only provide links they're allowed to share |
| NF-5 | Observability | Save the session ID and the Console link for every project; record cost and time from the session's usage and the outcome-evaluation result |
| NF-6 | Determinism | `validate_layout.py` and the editor's live warnings (ED-6) produce the same results on the same file (shared `rules.json` + a shared set of test layouts, ≥ 20 cases) |

## 12. Risks

| ID | Risk | Likelihood | Mitigation |
|---|---|---|---|
| RK-1 | Listing sites block `web_fetch` or don't allow scraping in their terms | High | Upload/paste fallback (IN-1); a failed fetch never blocks the run |
| RK-2 | Pinterest boards need a login and return little content | High | Uploads + text fallback (IN-3); a Pinterest API integration is a Phase 2 decision |
| RK-3 | Floorplan scale is wrong (e.g., the plan isn't drawn to scale or is a marketing graphic) | Medium | FR-3 tries scale sources in order + the FR-4 area check; low confidence shows a "confirm one wall length" prompt in the editor |
| RK-4 | Hand-drawn or low-resolution plans → wrong walls | Medium | Vision first, image processing as a backup; record the confidence; the user can correct it in P1 (plan editing is out of scope; re-upload is the path) |
| RK-5 | Photos show features but not where they are | High | R-7 allows "location unknown"; never guess where a fixed feature goes |
| RK-6 | The outcome loop keeps going on rubrics it can't pass (e.g., the room is too small for the required pieces) | Medium | R-5 allows a written reason; A-8 budget; `max_iterations: 4` |

## 13. Milestones

| # | Deliverable | Exit criterion |
|---|---|---|
| M1 | Kit: schema v1, `rules.json`, `validate_layout.py`, catalog, ≥ 20 test layouts | Validator passes all test layouts and correctly flags the deliberately broken ones |
| M2 | Layout Editor P0 (ED-1 to ED-10) | Loads every test layout; all P0 checks pass |
| M3 | Agent + environment set up with `ant apply`; backend ingestion (FR-0, FR-12) | One test project runs end to end |
| M4 | Test set of 10 real projects (different floorplan types, with and without listings) | G-1 to G-4 measured; rubric and budget tuned |
| M5 | Editor P1 + FR-14 revisions | Edit → send to agent → still valid after revision |

## 14. Open questions for the reviewer

| ID | Question | Default if no answer |
|---|---|---|
| Q-1 | Listing URLs can come from any broker site. Should we keep an allow-list (safer, but some links will fail) or allow open networking (every link works, but the sandbox can reach any host)? | Allow-list (A-5) |
| Q-2 | Furnish every living space, or only the rooms the user chooses? | Every living space (§5), with the user able to deselect rooms |
| Q-3 | Imperial or metric by default? | Imperial (data stored in cm) |
| Q-4 | Is a 2D top-down view enough for "sample layout" in Phase 1, or do you want a simple 3D preview? | 2D only |
| Q-5 | Should the furniture catalog be generic items (Phase 1) or real products from a specific retailer? | Generic |
| Q-6 | Where will the editor be hosted (e.g., Vercel)? Do users need accounts? | Static hosting, no accounts in Phase 1 |
