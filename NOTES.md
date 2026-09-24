# ACE Windfield — notes

WeDoWind ODE Challenge 5 entry: a public display for the ACE community wind turbine,
Lawrence Weston, Bristol (4.2 MW Enercon). Kick-off 30 Sep 2026, final vote 28 Oct 2026.

Data: Ambition Community Energy (ACE), CC BY 4.0 — cite DOI 10.5281/zenodo.22662372.
API: https://ace-api.duckdns.org (contract snapshots in `api/`, dated 2026.09.23).

## Goals (in order)
1. Curtailment script producing numbers for Aug 2026 — **done 2026.09.23**, see below.
2. Split `ace-windfield.html` into a small static site: data layer, scene layer, stories layer
   (curtailment gap / today's energy & earnings / weather at hub height / why-it's-stopped).
3. Portrait layout, graceful API-down mode, polite polling with Retry-After backoff.
4. Deploy to GitHub Pages.

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

## Design decisions carried over
- Palette stops keyed to kW/4200: dusk → estuary → sea green → gold → ember.
- Type: Fraunces (display) + Atkinson Hyperlegible (body).
- Homes figure uses 0.31 kW/home — **needs ACE's blessing** before it ships.
