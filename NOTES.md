# ACE Windfield — notes

WeDoWind ODE Challenge 5 entry: a public display for the ACE community wind turbine,
Lawrence Weston, Bristol (4.2 MW Enercon). Kick-off 30 Sep 2026, final vote 28 Oct 2026.

Data: Ambition Community Energy (ACE), CC BY 4.0 — cite DOI 10.5281/zenodo.22662372.
API: https://ace-api.duckdns.org (contract snapshots in `api/`, dated 2026.09.23).

## Goals (in order)
1. Curtailment script producing numbers for Aug 2026 — **done 2026.09.23**, see below.
2. Split `ace-windfield.html` into a small static site — **done 2026.09.23**, see Site below.
3. Portrait layout, graceful API-down mode, polite polling with Retry-After backoff — **done
   2026.09.23** (portrait checked at phone size only; still needs a real wall-screen look).
4. Deploy to GitHub Pages — workflow `.github/workflows/pages.yml` publishes `site/` on push to
   `main`. Repo: https://github.com/reejacks2/ace-windfield → https://reejacks2.github.io/ace-windfield/

## API facts (verified 2026.09.23)
- Timestamps are epoch **microseconds** (schema says only `integer`).
- `wecstd` is **asset-scoped** (`compatible_asset_types: [wec]`) — the site-level route 400s.
  Turbine asset id is `wec-1`; site controller is `controller-2`.
- `site_instantaneous` is site-scoped, 1s/60s. `wec_instantaneous` is the per-turbine 1s feed.
- `setpoint_documentation` (site event family) is the control-action log — the independent
  record of external setpoint (ANM) episodes. `status` events (per asset) → why-it's-stopped.
- Polling: follow `next_cursor` sequentially, never in parallel; 1 Hz OK for 1 s dashboards;
  on 429 honour Retry-After, exponential backoff on repeats. Recommended refresh: 10m = 300 s.
- Every response carries an `attribution` block — render it.
- CORS is open (`Access-Control-Allow-Origin: *`): the browser calls the API directly.
- `wecstd` history: **10m starts 2026-07-21 10:40Z**; daily goes back further (≥ 2026-06-26).
  Compare windows only where both exist.
- `energy_produced`: at 10m it's a lifetime kWh counter (~30.5 GWh); at `daily` it's kWh for
  that Bristol-local day (daily buckets start at local midnight). Today = counter delta.
- Sensors not fitted — precipitation, visibility, humidity, brightness read 0xFFFF
  (65.535 / 6553.5 / 65535). Real weather: wind, direction, `air_pressure_mean`,
  `tep3c021.outside_hub_height_temperature_mean` / `outside_ground_temperature_mean`.
- Site config reports `farm_nominal_power` 4245 kW (palette still keyed to 4200).
- **Direction (calibrated 2026.09.24):** `site_instantaneous.aggregate_wind_direction` is the
  NACELLE HEADING (equals `wec_nacelle_position` second by second), not the wind.
  `wec_wind_direction` is the vane angle relative to the nacelle (median ≈ 0 while generating).
  Wind-from = nacelle + relative (the yaw moves toward +rel in 84% of moves). The live feed now
  uses `wec_instantaneous` for this reason; before this the page reported heading as wind.
- `wec_instantaneous` (1 Hz) also gives rotor rpm (tops out ~12–14), heading, wind-only
  available power, and `wec_energy_exported` — a lifetime kWh counter (30,480,221 on 2026-09-24).
- Asset config: `wec_type` EP3-CS02, `wec_nominal_power` 4245, `wec_availability_start`
  2023-03-29. Blade pitch (`blade_angle_mean`, 10m) ≈ 60° feathered at idle, ~0–5° generating.
- Status events: main 0 = running, main 2 = lack of wind (median wind 0.6 m/s across Aug–Sep
  events). Other codes seen (1, 8, 9, 17, 20, 21, 50, 62, 240, 306) are UNLABELLED — ask ACE
  for the Enercon status list before naming them.

## Available-power fields — NOT a cascade
The four fields (`available_power_by_wind`, `technically_available_power`,
`available_power_after_force_majeure`, `available_power_after_external_setpoints`) do not
collapse to identical values here (they differ in 3–7% of Aug records), but they are **not**
an ordered ladder: wind ≥ tech ≥ fm ≥ ext holds in only 93% of records and ext is often
above fm. Treat each as "available power given only this constraint" and measure each loss
as `wind − field`. Losses may overlap; don't sum them.

## Aug 2026 result (`python ace_curtailment_v2.py`)
- Produced 640.3 MWh; wind-only possible 646.8 MWh; net shortfall 6.5 MWh (1.0%).
- Below wind-only by constraint: technical 1.41, force majeure 4.87, **external/ANM 0.20 MWh**.
- ANM active in 4 ten-minute records on 2 days (08-05 ≈ 0.18 MWh incl. a drop to 0%
  setpoint at 11:08Z; 08-30 ≈ 0.02 MWh). Matches the 28 setpoint events on exactly those days.
- CF 20.5%, mean wind 5.5 m/s.
- **Story implication:** August curtailment was negligible. A "curtailment gap" story needs a
  longer/windier window (try winter months) or should fall back to "no curtailment today".

## Last 90 days (to 2026-09-23, daily means)
- Grid held back ≈ 8.2 MWh on 12 days = 0.4% of the wind-only estimate. Matches the 10m data
  on the days both cover (07-25: 336 vs 330 kWh; 08-05: 192 vs 180). Biggest days are before 10m
  history begins: 07-04 (2.1 MWh), 07-18 (2.8), 07-19 (1.9). Daily means are integers, so a
  1 kW (24 kWh) day gap is at rounding level.

## Site (`site/`, plain ES modules, no build step)
- `js/config.js` — every constant a maintainer might change (price, homes factor, cadences).
- `js/data/` — `api.js` (single client: shared 429 gate, Retry-After incl. HTTP-date, doubling
  on repeats, sequential cursors, sentinel filter), `live.js` (1 Hz `site_instantaneous`),
  `slow.js` (status 60 s, today 300 s, hub temp 600 s, 90-day 3600 s; staggered start),
  `store.js` (shared state + change events).
- `js/scenes/` — Silk, Meadow, Bloom, Drift, Mosaic + rotation/crossfade/ribbon in `index.js`.
- `js/stories/` — now / stopped / energy / curtailment / weather, rotated every 12 s with the
  live story between the others; stories without fresh data are skipped.
- API down → `offline`: art keeps moving on synthetic wind, copy says "Waiting for the turbine",
  **never shows an invented number**. `?demo=1` fakes everything (dev only). `?story=<id>` pins.
- Hidden tab → live poll drops to every 5 s, slow feeds to ≥ 5 min.
- Run locally: `python tools/serve.py` → http://127.0.0.1:8765 (no-store headers, so edits show on reload;
  modules don't load from file://). `node tools/flock_shape.mjs` measures the murmuration's spread.
- Rebuild the map: `python tools/build_map.py` (Overpass is often overloaded: it retries across
  mirrors, treats `remark` timeouts as failures, and caches each query in `tools/.cache/`).
  2026-09-24: 3,568 buildings, 4,515 estimated homes, 266 streets, 276 KB.

## Scenes and features (2026.09.24)
- **Live twin** — removed 2026.09.24 (looked literal; Reed's call). In git history at 387bd22.
- **Lights of Lawrence Weston** (lead scene, returns between the others): real OSM rooftops
  (`site/data/lawrence-weston.json`, baked by `tools/build_map.py`, ODbL — attribution shown in
  the scene label). Lit home-by-home for kW ÷ 0.31, entering from the north-west (Avonmouth side);
  pulses run along the streets; light spills past the edges when homes-now > homes on the map.
  OSM has no Lawrence Weston boundary, so the map is a 2.5 × 1.7 km box around the suburb node
  (51.5019 N, 2.6588 W) and copy says "homes on this map". Dwellings per building are ESTIMATED
  (≈ 1 per 50 m² footprint for houses, 70 m² per floor for flats; garages/shops/schools = 0).
  The turbine's exact position isn't placed — only "from the turbine, Avonmouth ↖".
- **Murmuration**: boids on a spatial grid. Power → birds aloft (250 … 3,000); wind → speed and
  sweep; direction → drift; a rise in power → a wave through the flock. Reeds bend downwind.
  Tuned headlessly: at 2.5 MW the flock breathes ~50–165 px wide; calm ≈ 40 px. 1,500 birds max,
  neighbour search on alternate frames. Lights: ~2 ms/frame (roofs batched into 6 brightness levels).
- **Real sky** (`lib/sky.js`): sun/moon position and moon phase for 51.503 N, 2.672 W; checked
  against solstice/equinox noon altitudes (61.9° / 15.0° / 38.5°). Every scene composes over it;
  the art scenes get a dimmed copy so light strokes keep contrast in daylight.
- **Replay**: last 60 days as a 24-hour clock (ring = day, midnight at top), 34 s time-lapse;
  its caption replaces the stories while it plays. 2026-09-24: 1,507 MWh in 61 days (CF 24.5%,
  consistent with the script's 25.0%).
- **Odometer**: the turbine's own lifetime counter; tenths interpolated from live power but
  never past the next real kWh; hidden when offline. Lifetime story: GWh + home-years.
- **Ghost ribbon**: solid = made, outline = wind-only available power, ember = the gap.
- **Kiosk**: cursor hides after 3 s; double-click or `f` = fullscreen; `?kiosk=1` adds wake lock,
  04:00 Bristol reload, hides the sound button. PWA manifest + icon; `og.png` social card.
- **Stories added**: *Clearing the air* — kg CO₂/h = kW × SW England grid intensity (NESO
  Carbon Intensity API, region 11, FORECAST — no regional actuals; AVERAGE mix, so cautious vs
  the marginal gas plant a turbine displaces). *Right now, that's…* — kettles (3 kW), cups of tea
  (0.03 kWh), phone charges (15 Wh), e-bus km (1.2 kWh/km), one per showing.
- **Sound** (opt-in): wind noise by wind speed, blade-pass swish at 3 × rpm / 60 Hz, a power drone.
- URL params: `?scene=lights-of-lawrence-weston|murmuration|silk|meadow|replay|bloom|drift|mosaic`, `?story=<id>`,
  `?demo=1`, `?kiosk=1`.

## Open questions for ACE
- Blessing for 0.31 kW/home (used in "homes now" and "a day's electricity for N homes").
- A £/MWh figure for earnings (`PRICE_GBP_PER_MWH`; the earnings line is hidden while null).
- Enercon status-code labels for the codes listed above.
- The turbine's exact location (not reliably tagged in OSM), for placing it on the Lights map.

## Design decisions carried over
- Palette stops keyed to kW/4200: dusk → estuary → sea green → gold → ember.
- Type: Fraunces (display) + Atkinson Hyperlegible (body).
- Homes figure uses 0.31 kW/home — **needs ACE's blessing** before it ships.
