"""Bake the Lights-of-Lawrence-Weston map: OSM buildings + streets around the suburb centre,
projected to local metres, simplified, with an estimated dwelling count per building.
Map data © OpenStreetMap contributors, ODbL. Run: python tools/build_map.py
"""
import json, math, sys, urllib.request, urllib.parse

LAT0, LON0 = 51.5019311, -2.6588353          # OSM node 5088295669, place=suburb "Lawrence Weston"
HALF_N, HALF_E = 850, 1250                    # metres either side of the centre
SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
           ]
UA = "ace-windfield/1.0 (https://github.com/reejacks2/ace-windfield)"
M_LAT = 110540.0; M_LON = 111320.0 * math.cos(math.radians(LAT0))
bbox = (LAT0 - HALF_N / M_LAT, LON0 - HALF_E / M_LON, LAT0 + HALF_N / M_LAT, LON0 + HALF_E / M_LON)
def quarters():
    la0, lo0, la1, lo1 = bbox; lam, lom = (la0 + la1) / 2, (lo0 + lo1) / 2
    return [(la0, lo0, lam, lom), (la0, lom, lam, lo1), (lam, lo0, la1, lom), (lam, lom, la1, lo1)]

HW = '^(primary|secondary|tertiary|unclassified|residential|living_street|trunk|motorway)$'
QUERIES = [f'[out:json][timeout:90];way["building"]({a},{b},{c},{d});out tags geom;' for a, b, c, d in quarters()] +           [f'[out:json][timeout:90];way["highway"~"{HW}"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]});out tags geom;']

def fetch():
    import time
    seen, elements = set(), []
    import hashlib, os
    os.makedirs("tools/.cache", exist_ok=True)
    for q in QUERIES:
        cache = f"tools/.cache/{hashlib.sha1(q.encode()).hexdigest()[:12]}.json"
        if os.path.exists(cache):
            for e in json.load(open(cache)):
                if e["id"] not in seen: seen.add(e["id"]); elements.append(e)
            continue
        for attempt in range(8):
            s = SERVERS[attempt % len(SERVERS)]
            try:
                req = urllib.request.Request(s, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": UA})
                d = json.load(urllib.request.urlopen(req, timeout=150))
                if d.get("remark"):                        # 200 OK with "Query timed out" and no data
                    raise RuntimeError(d["remark"][:80])
                json.dump(d["elements"], open(cache, "w"))
                for e in d["elements"]:                    # quarters overlap at their edges
                    if e["id"] not in seen: seen.add(e["id"]); elements.append(e)
                print(f"ok {s.split('/')[2]}: {len(d['elements'])} elements", file=sys.stderr)
                break
            except Exception as e:
                print("server failed:", s.split('/')[2], e, file=sys.stderr); time.sleep(45)
        else:
            sys.exit("no Overpass server answered")
    return {"elements": elements}

def xy(p): return (round((p["lon"] - LON0) * M_LON, 1), round((LAT0 - p["lat"]) * M_LAT, 1))   # y grows south

def rdp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy) or 1e-9
    i, dmax = 0, 0
    for k in range(1, len(pts) - 1):
        d = abs(dy * pts[k][0] - dx * pts[k][1] + x2 * y1 - y2 * x1) / L
        if d > dmax: i, dmax = k, d
    if dmax <= eps: return [pts[0], pts[-1]]
    return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)

def area(pts):
    return abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2

HOMES = {"house", "detached", "semidetached_house", "terrace", "residential", "apartments", "bungalow", "flats", "dormitory"}
NOT_HOMES = {"garage", "garages", "shed", "commercial", "industrial", "retail", "school", "church", "warehouse", "office",
             "public", "civic", "hospital", "community_centre", "roof", "service", "kindergarten", "college", "sports_centre",
             "greenhouse", "hut", "carport", "construction", "supermarket", "transportation", "chapel", "pavilion", "barn"}

d = fetch()
buildings, streets, total_homes = [], [], 0
for e in d["elements"]:
    t = e.get("tags", {}); g = [xy(p) for p in e.get("geometry", [])]
    if "building" in t and len(g) >= 4:
        # a closed ring has identical ends, so simplify it as two open halves
        ring = g[:-1] if g[0] == g[-1] else g
        mid = len(ring) // 2
        poly = (rdp(ring[:mid + 1], 0.6)[:-1] + rdp(ring[mid:] + [ring[0]], 0.6)[:-1])
        if len(poly) < 3: continue
        a = area(poly); kind = t["building"]
        if kind in HOMES or (kind == "yes" and 30 <= a <= 220):
            levels = float(t.get("building:levels", "2") or 2) if kind in ("apartments", "flats", "residential") else 1
            # a detached/semi/terrace house ≈ one dwelling per ~50 m² of footprint; flats ≈ 70 m² per floor
            homes = max(1, round(a / 50)) if kind not in ("apartments", "flats") else max(2, round(a * levels / 70))
        else:
            homes = 0
        total_homes += homes
        buildings.append([homes] + [v for p in poly for v in p])
    elif "highway" in t and len(g) >= 2:
        line = rdp(g, 1.0)
        streets.append([{"motorway": 3, "trunk": 3, "primary": 2, "secondary": 2, "tertiary": 2}.get(t["highway"], 1)] + [v for p in line for v in p])

out = {"source": "© OpenStreetMap contributors (ODbL)", "centre": [LAT0, LON0], "half": [HALF_E, HALF_N],
       "homes": total_homes, "buildings": buildings, "streets": streets}
json.dump(out, open("site/data/lawrence-weston.json", "w"), separators=(",", ":"))
print(f"{len(buildings)} buildings, {total_homes} estimated homes, {len(streets)} streets")
