"""ACE turbine curtailment check — how much wind energy is being held back, and why.

Usage:
  pip install requests pandas pyarrow
  python ace_curtailment.py                       # pulls Aug 2026 10-min data from the live API
  python ace_curtailment.py --start 2026-06-01 --end 2026-09-01
  python ace_curtailment.py --parquet ace-wind-2026-10m.parquet   # uses the Zenodo dump instead

Data: Ambition Community Energy (ACE), CC BY 4.0, https://doi.org/10.5281/zenodo.22662372
"""
import argparse, time, sys
import pandas as pd

API = "https://ace-api.duckdns.org"
FIELDS = ["wind_speed_mean", "active_power_mean",
          "available_power_by_wind_mean", "technically_available_power_mean",
          "available_power_after_force_majeure_mean", "available_power_after_external_setpoints_mean"]
NOMINAL_KW = 4200

def get(url, params=None):
    import requests
    while True:
        r = requests.get(url, params=params, timeout=60)
        if r.status_code == 429:
            time.sleep(float(r.headers.get("Retry-After", 5))); continue
        if not r.ok:
            sys.exit(f"HTTP {r.status_code} from {r.url}\n{r.text[:800]}")
        return r.json()

def from_api(start, end):
    # wecstd is asset-scoped: find the wind turbine asset id first
    assets = get(f"{API}/v1/sites/ace/assets")["assets"]
    wec = next((a for a in assets if a.get("asset_type") == "wec" and a.get("is_active")), None) \
          or next((a for a in assets if a.get("asset_type") == "wec"), None)
    if not wec: sys.exit(f"no 'wec' asset found; assets are {assets}")
    print(f"Using asset {wec['id']} ({wec.get('display_name')})")
    base = f"{API}/v1/sites/ace/assets/{wec['id']}/data/wecstd/range"
    rows, cursor = [], None
    while True:
        p = {"resolution": "10m", "fields": ",".join(FIELDS), "start": start + "T00:00:00Z",
             "end": end + "T00:00:00Z", "page_size": 5000}
        if cursor: p["cursor"] = cursor
        d = get(base, p)
        # API returns epoch MICROseconds (schema doesn't say; 1785542400000000 = 2026-08-01Z).
        # Normalise by magnitude so s/ms/us all land correctly.
        ts = [t * 1_000_000 if t < 1e11 else t * 1000 if t < 1e14 else t for t in d["timestamps"]]
        page = pd.DataFrame({k: d["series"].get(k) for k in FIELDS}, index=pd.to_datetime(ts, unit="us", utc=True))
        page["quality"] = d.get("quality") or [None] * len(ts)
        rows.append(page)
        if not d["page"].get("has_more"): break
        cursor = d["page"]["next_cursor"]
    return pd.concat(rows).sort_index()

def setpoint_events(start, end):
    """Site-level control-action log — independent confirmation of external setpoint episodes."""
    out, cursor = [], None
    while True:
        p = {"start": start + "T00:00:00Z", "end": end + "T00:00:00Z", "page_size": 1000}
        if cursor: p["cursor"] = cursor
        d = get(f"{API}/v1/sites/ace/events/setpoint_documentation/range", p)
        out += [pd.to_datetime(e["observed_at"], unit="us", utc=True) for e in d["events"]]
        if not d["page"].get("has_more"): return out
        cursor = d["page"]["next_cursor"]

def from_parquet(path):
    df = pd.read_parquet(path)
    tcol = next(c for c in df.columns if "time" in c.lower() or "observed" in c.lower())
    df = df.set_index(pd.to_datetime(df[tcol], utc=True))
    missing = [f for f in FIELDS if f not in df.columns]
    if missing: sys.exit(f"parquet is missing {missing}; columns are {list(df.columns)[:40]}")
    return df[FIELDS].sort_index()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2026-08-01"); ap.add_argument("--end", default="2026-09-01")
    ap.add_argument("--parquet")
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252; we print → and ≥
    df = from_parquet(a.parquet) if a.parquet else from_api(a.start, a.end)
    if "quality" in df:
        print("Quality flags:", df["quality"].value_counts(dropna=False).to_dict())
        df = df[df["quality"].isna() | (df["quality"] == "good")]
    df = df.dropna(subset=["active_power_mean", "available_power_by_wind_mean"])
    h = 10 / 60  # hours per 10-min record

    wind_avail = df["available_power_by_wind_mean"].clip(lower=0)
    tech = df["technically_available_power_mean"].clip(lower=0)
    fm = df["available_power_after_force_majeure_mean"].clip(lower=0)
    ext = df["available_power_after_external_setpoints_mean"].clip(lower=0)
    actual = df["active_power_mean"].clip(lower=0)

    # The four fields are NOT a cascade (wind >= tech >= fm >= ext holds in only ~93% of Aug 2026
    # records; ext is often ABOVE fm). Each reads as "available power given only this constraint
    # category", so each loss is measured independently against wind. They can overlap in the
    # same record, so they are not additive.
    def lost(x): return ((wind_avail - x).clip(lower=0) * h).sum() / 1000
    lost_technical, lost_force_maj, lost_external = lost(tech), lost(fm), lost(ext)
    produced = (actual * h).sum() / 1000
    possible = (wind_avail * h).sum() / 1000
    # Net shortfall vs the wind-only estimate; the 10-min estimate runs both above and below actual.
    shortfall = possible - produced

    print(f"\nACE turbine, {df.index.min():%Y-%m-%d} → {df.index.max():%Y-%m-%d}  ({len(df):,} ten-minute records)")
    print(f"  Produced:                    {produced:8.1f} MWh")
    print(f"  Possible from wind alone:    {possible:8.1f} MWh")
    print(f"  Net shortfall:               {shortfall:8.1f} MWh  ({shortfall / possible * 100:.1f}% of possible)")
    print(f"  Below wind-only estimate by constraint (independent, may overlap):")
    print(f"    turbine unavailable:       {lost_technical:8.2f} MWh")
    print(f"    force majeure:             {lost_force_maj:8.2f} MWh")
    print(f"    external setpoints (ANM):  {lost_external:8.2f} MWh   <-- the curtailment story")

    # How often, and when, is external (ANM) curtailment active?
    gap = (wind_avail - ext).clip(lower=0)
    curt = gap > 50  # >50 kW gap
    print(f"\n  External curtailment active in {curt.sum()} records ({curt.mean() * 100:.2f}%); "
          f"{(curt.groupby(curt.index.date).any()).sum()} of {df.index.normalize().nunique()} days")
    if curt.any():
        deep = (gap * h / 1000).groupby(df.index.date).sum().sort_values(ascending=False).head(3)
        print("  Worst days:", ", ".join(f"{d} ({v:.2f} MWh)" for d, v in deep.items() if v >= 0.005))
    if not a.parquet:
        ev = setpoint_events(a.start, a.end)
        days = sorted({t.date() for t in ev})
        print(f"  Cross-check: {len(ev)} setpoint_documentation events on {len(days)} day(s): "
              + ", ".join(str(d) for d in days))

    # Capacity factor and a sanity check on rated behaviour
    cf = produced / (NOMINAL_KW / 1000 * len(df) * h) * 100
    print(f"\n  Capacity factor: {cf:.1f}%   Mean wind: {df['wind_speed_mean'].mean():.1f} m/s   "
          f"Records at ≥95% of nominal: {(actual >= 0.95 * NOMINAL_KW).mean() * 100:.1f}%")

if __name__ == "__main__":
    main()
