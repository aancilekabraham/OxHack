"""Build the county and town layers for the risk map.

Writes lib/gbCounties.json (ONS counties & unitary authorities, GB only) and
lib/gbPlaces.json (GeoNames towns with population >= 5,000, GB only). Each
county and town is tagged with the region code from lib/gbRegions.json so the
map can colour it by its region's risk status.

Run from the frontend directory:  python3 scripts/build_geo.py
"""

import io
import json
import subprocess
import zipfile
from pathlib import Path

LIB = Path(__file__).resolve().parent.parent / "lib"

COUNTIES_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/ArcGIS/rest/services/"
    "Counties_and_Unitary_Authorities_December_2024_Boundaries_UK_BUC/FeatureServer/0/query"
    "?where=1%3D1&outFields=CTYUA24CD,CTYUA24NM&outSR=4326&f=geojson"
)
PLACES_URL = "https://download.geonames.org/export/dump/cities5000.zip"
PLACE_CODES = {"PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLC"}  # skips sections of cities (PPLX)


def fetch(url):
    # curl rather than urllib: python.org builds on macOS ship without CA certs.
    return subprocess.run(["curl", "-sSfL", url], check=True, capture_output=True).stdout


def polygons(geom):
    return geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][:2]
        xj, yj = ring[j][:2]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def contains(geom, x, y):
    return any(in_ring(x, y, p[0]) and not any(in_ring(x, y, h) for h in p[1:]) for p in polygons(geom))


def nearest(features, x, y):
    def dist(f):
        return min((px - x) ** 2 + (py - y) ** 2 for p in polygons(f["geometry"]) for px, py in p[0])
    return min(features, key=dist)


def locate(features, x, y):
    return next((f for f in features if contains(f["geometry"], x, y)), None) or nearest(features, x, y)


def round_geom(geom):
    def ring(r):
        out = []
        for x, y in r:
            pt = [round(x, 3), round(y, 3)]
            if not out or out[-1] != pt:
                out.append(pt)
        return out

    polys = [[ring(r) for r in p] for p in polygons(geom)]
    polys = [[r for r in p if len(r) >= 4] for p in polys]
    return {"type": "MultiPolygon", "coordinates": [p for p in polys if p]}


def centroid(geom):
    # Area-weighted centroid of the largest polygon, used to place the label.
    def area_c(r):
        a = cx = cy = 0.0
        for (x0, y0), (x1, y1) in zip(r, r[1:]):
            c = x0 * y1 - x1 * y0
            a += c
            cx += (x0 + x1) * c
            cy += (y0 + y1) * c
        return a / 2, (cx / (3 * a) if a else r[0][0]), (cy / (3 * a) if a else r[0][1])

    a, x, y = max((area_c(p[0]) for p in polygons(geom)), key=lambda t: abs(t[0]))
    return round(y, 3), round(x, 3)


def main():
    regions = json.loads((LIB / "gbRegions.json").read_text())["features"]

    counties = []
    for f in json.loads(fetch(COUNTIES_URL))["features"]:
        code, name = f["properties"]["CTYUA24CD"], f["properties"]["CTYUA24NM"]
        if code.startswith("N"):  # Northern Ireland is out of scope
            continue
        geom = round_geom(f["geometry"])
        lat, lon = centroid(geom)
        region = locate(regions, lon, lat)["properties"]["code"]
        counties.append({
            "type": "Feature",
            "properties": {"code": code, "name": name, "region": region, "lat": lat, "lon": lon},
            "geometry": geom,
        })
    (LIB / "gbCounties.json").write_text(
        json.dumps({"type": "FeatureCollection", "features": counties}, separators=(",", ":"))
    )

    places = []
    with zipfile.ZipFile(io.BytesIO(fetch(PLACES_URL))) as z:
        for line in z.read("cities5000.txt").decode("utf-8").splitlines():
            c = line.split("\t")
            if c[8] != "GB" or c[10] == "NIR" or c[7] not in PLACE_CODES:
                continue
            lat, lon, pop = float(c[4]), float(c[5]), int(c[14])
            county = locate(counties, lon, lat)["properties"]
            places.append({
                "name": c[1], "lat": round(lat, 4), "lon": round(lon, 4), "population": pop,
                "county": county["name"], "region": county["region"],
            })
    places.sort(key=lambda p: -p["population"])
    (LIB / "gbPlaces.json").write_text(json.dumps(places, separators=(",", ":")))

    print(f"{len(counties)} counties, {len(places)} places")


if __name__ == "__main__":
    main()
