"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, Marker, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { Zone, ZoneStatus } from "@/lib/types";
import gbRegions from "@/lib/gbRegions.json";
import gbCounties from "@/lib/gbCounties.json";
import gbPlaces from "@/lib/gbPlaces.json";
import styles from "./RiskMap.module.css";

// Spec colours: green ≤ 40, yellow 41–79, red ≥ 80.
const STATUS_COLOR: Record<ZoneStatus, string> = {
  SAFE: "#3fae6a",
  ELEVATED: "#e8b018",
  CRITICAL: "#e5484d",
};

interface RegionProps {
  code: string;
  name: string;
}
interface CountyProps {
  code: string;
  name: string;
  region: string; // region code from gbRegions.json
  lat: number; // label position
  lon: number;
}
interface Place {
  name: string;
  lat: number;
  lon: number;
  population: number;
  county: string;
  region: string;
}
type RegionFeature = Feature<Geometry, RegionProps>;
const REGIONS = (gbRegions as unknown as FeatureCollection<Geometry, RegionProps>).features;
const COUNTIES = (gbCounties as unknown as FeatureCollection<Geometry, CountyProps>).features;
const PLACES = gbPlaces as Place[]; // sorted by population, largest first
const COUNTY_BOUNDS = new Map(COUNTIES.map((f) => [f.properties.code, L.geoJSON(f).getBounds()]));

// Detail levels: zoomed out shows regions, then counties, then cities and towns.
const COUNTY_ZOOM = 6.3;
const PLACE_ZOOM = 7.8;
const MAX_ZOOM = 12;
type Level = "regions" | "counties" | "places";
const LEVELS: { id: Level; label: string }[] = [
  { id: "regions", label: "Regions" },
  { id: "counties", label: "Counties" },
  { id: "places", label: "Towns" },
];
const levelFor = (zoom: number): Level =>
  zoom >= PLACE_ZOOM ? "places" : zoom >= COUNTY_ZOOM ? "counties" : "regions";

// Smallest town shown at each zoom; collision checks thin them out further.
function minPopulation(zoom: number) {
  if (zoom >= 11) return 0;
  if (zoom >= 10) return 10_000;
  if (zoom >= 9) return 25_000;
  return 100_000;
}
const CITY_POPULATION = 100_000;

// Great Britain only (Northern Ireland and Ireland are excluded from the data).
const GB_BOUNDS: L.LatLngBoundsExpression = [
  [49.85, -6.5],
  [58.75, 1.9],
];
const fitGB = (map: L.Map) => map.fitBounds(GB_BOUNDS, { padding: [8, 8] });

// Refit when the panel resizes so the whole of GB stays in view, unless the user has zoomed in.
function FitGB() {
  const map = useMap();
  useEffect(() => {
    fitGB(map);
    let overview = map.getZoom();
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (map.getZoom() <= overview + 0.01) {
        fitGB(map);
        overview = map.getZoom();
      }
    });
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// Tracks zoom and visible area so layers can switch detail level.
function useView() {
  const map = useMap();
  const read = () => ({ zoom: map.getZoom(), bounds: map.getBounds() });
  const [view, setView] = useState(read);
  useMapEvents({ zoomend: () => setView(read()), moveend: () => setView(read()) });
  return view;
}

function regionLabelIcon(z: Zone) {
  return L.divIcon({
    className: styles.labelIcon,
    html: `<div class="${styles.label} ${z.status === "CRITICAL" ? styles.labelCritical : ""}">
             <strong>${z.zone_name}</strong><span>${z.risk_score.toFixed(0)}</span>
           </div>`,
    iconSize: [0, 0],
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function countyLabelIcon(name: string, faint: boolean) {
  return L.divIcon({
    className: styles.labelIcon,
    html: `<div class="${styles.countyLabel} ${faint ? styles.countyLabelFaint : ""}">${escapeHtml(name)}</div>`,
    iconSize: [0, 0],
  });
}

function placeIcon(p: Place) {
  const city = p.population >= CITY_POPULATION;
  return L.divIcon({
    className: styles.labelIcon,
    html: `<div class="${styles.place} ${city ? styles.city : ""}"><i></i><span>${escapeHtml(p.name)}</span></div>`,
    iconSize: [0, 0],
  });
}

function ZoneStats({ z }: { z: Zone }) {
  return (
    <dl>
      <dt>Wastewater</dt>
      <dd>{z.wastewater_copies_per_l.toLocaleString()} copies/L</dd>
      <dt>ER wait</dt>
      <dd>{Math.round(z.er_avg_wait_mins)} min</dd>
      <dt>Mobility</dt>
      <dd>{Math.round(z.mobility_density_score)} / 100</dd>
      <dt>Population</dt>
      <dd>{z.population.toLocaleString()}</dd>
    </dl>
  );
}

function StatusLine({ z, prefix }: { z: Zone; prefix?: string }) {
  return (
    <p className={styles.popupStatus} style={{ color: STATUS_COLOR[z.status] }}>
      {prefix}
      {z.status} · risk {z.risk_score.toFixed(1)}
    </p>
  );
}

function ZonePopup({ z }: { z: Zone }) {
  return (
    <div className={styles.popup}>
      <h3>{z.zone_name}</h3>
      <StatusLine z={z} />
      <ZoneStats z={z} />
    </div>
  );
}

function CountyPopup({ name, z }: { name: string; z: Zone }) {
  return (
    <div className={styles.popup}>
      <h3>{name}</h3>
      <p className={styles.popupSub}>{z.zone_name}</p>
      <StatusLine z={z} prefix="Region " />
      <ZoneStats z={z} />
    </div>
  );
}

function PlacePopup({ p, z }: { p: Place; z?: Zone }) {
  return (
    <div className={styles.popup}>
      <h3>{p.name}</h3>
      <p className={styles.popupSub}>
        {p.county}
        {z ? ` · ${z.zone_name}` : ""}
      </p>
      {z && <StatusLine z={z} prefix="Region " />}
      <dl>
        <dt>Population</dt>
        <dd>{p.population.toLocaleString()}</dd>
      </dl>
    </div>
  );
}

// Greedy label placement: keep a label only if its box doesn't overlap one already placed.
function placeLabels<T>(map: L.Map, items: T[], pos: (t: T) => L.LatLng, box: (t: T) => [number, number], limit: number) {
  const taken: L.Bounds[] = [];
  const out: T[] = [];
  for (const item of items) {
    const pt = map.latLngToContainerPoint(pos(item));
    const [w, h] = box(item);
    const b = L.bounds([pt.x - w / 2, pt.y - h / 2], [pt.x + w / 2, pt.y + h / 2]);
    if (taken.some((t) => t.overlaps(b))) continue;
    taken.push(b);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function DetailLayers({ byCode }: { byCode: Map<string, Zone> }) {
  const map = useMap();
  const { zoom, bounds } = useView();
  const level = levelFor(zoom);

  const { counties, places } = useMemo(() => {
    if (level === "regions") return { counties: [], places: [] };
    const view = bounds.pad(0.1);

    const towns =
      level === "places"
        ? placeLabels(
            map,
            PLACES.filter((p) => p.population >= minPopulation(zoom) && view.contains([p.lat, p.lon])),
            (p) => L.latLng(p.lat, p.lon),
            (p) => [p.name.length * (p.population >= CITY_POPULATION ? 7.5 : 6.5) + 14, 16],
            200,
          )
        : [];

    // Only label counties wide enough on screen to hold their name.
    const candidates = COUNTIES.filter((f) => {
      const b = COUNTY_BOUNDS.get(f.properties.code)!;
      if (!view.intersects(b)) return false;
      const w = map.latLngToContainerPoint(b.getNorthEast()).x - map.latLngToContainerPoint(b.getSouthWest()).x;
      return w > f.properties.name.length * 5;
    });
    const townBoxes = towns.map((p) => ({ lat: p.lat, lon: p.lon, name: p.name, town: true }));
    const countyBoxes = candidates.map((f) => ({ lat: f.properties.lat, lon: f.properties.lon, name: f.properties.name, town: false }));
    const placed = placeLabels(
      map,
      [...townBoxes, ...countyBoxes],
      (t) => L.latLng(t.lat, t.lon),
      (t) => [t.name.length * 6.5 + 14, t.town ? 16 : 14],
      400,
    );
    return { counties: placed.filter((t) => !t.town), places: towns };
  }, [map, level, zoom, bounds]);

  if (level === "regions") return null;

  return (
    <>
      {COUNTIES.map((f) => {
        const z = byCode.get(f.properties.region);
        const critical = z?.status === "CRITICAL";
        return (
          <GeoJSON
            key={`${f.properties.code}-${z?.status}-${level}`}
            data={f}
            style={{
              color: "#ffffff",
              weight: 0.8,
              fillColor: z ? STATUS_COLOR[z.status] : "#9aa3ad",
              fillOpacity: level === "places" ? 0.45 : critical ? 0.85 : 0.7,
              className: critical ? styles.pulse : styles.region,
            }}
            eventHandlers={{
              mouseover: (e) => (e.propagatedFrom as L.Path).setStyle({ weight: 2.5 }),
              mouseout: (e) => (e.propagatedFrom as L.Path).setStyle({ weight: 0.8 }),
            }}
          >
            <Tooltip sticky direction="top" offset={[0, -8]} className={styles.tooltip}>
              {f.properties.name}
            </Tooltip>
            {z && (
              <Popup>
                <CountyPopup name={f.properties.name} z={z} />
              </Popup>
            )}
          </GeoJSON>
        );
      })}

      {/* Region borders stay visible on top of the counties for context. */}
      <GeoJSON key="region-outline" data={gbRegions as unknown as FeatureCollection} interactive={false} style={{ color: "#14171c", weight: 2, opacity: 0.45, fill: false }} />

      {counties.map((c) => (
        <Marker
          key={`county-${c.name}-${level}`}
          position={[c.lat, c.lon]}
          icon={countyLabelIcon(c.name, level === "places")}
          interactive={false}
          keyboard={false}
        />
      ))}

      {places.map((p) => (
        <Marker key={`place-${p.name}-${p.lat}`} position={[p.lat, p.lon]} icon={placeIcon(p)} keyboard={false}>
          <Popup>
            <PlacePopup p={p} z={byCode.get(p.region)} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function RegionLayer({ zones, byCode }: { zones: Zone[]; byCode: Map<string, Zone> }) {
  const { zoom } = useView();
  if (levelFor(zoom) !== "regions") return null;

  return (
    <>
      {REGIONS.map((feature: RegionFeature) => {
        const z = byCode.get(feature.properties.code);
        if (!z) return null;
        const color = STATUS_COLOR[z.status];
        return (
          <GeoJSON
            // Remount when status changes so the style (and pulse) update.
            key={`${z.zip_code}-${z.status}`}
            data={feature}
            style={{
              color: "#ffffff",
              weight: 1.5,
              fillColor: color,
              fillOpacity: z.status === "CRITICAL" ? 0.9 : 0.75,
              className: z.status === "CRITICAL" ? styles.pulse : styles.region,
            }}
          >
            <Tooltip sticky direction="top" offset={[0, -8]} className={styles.tooltip}>
              {z.zone_name}
            </Tooltip>
            <Popup>
              <ZonePopup z={z} />
            </Popup>
          </GeoJSON>
        );
      })}

      {zones.map((z) => (
        <Marker key={`label-${z.zip_code}-${z.status}-${z.risk_score.toFixed(0)}`} position={[z.latitude, z.longitude]} icon={regionLabelIcon(z)} interactive>
          <Popup>
            <ZonePopup z={z} />
          </Popup>
        </Marker>
      ))}
    </>
  );
}

// Reports zoom changes up to RiskMap so the controls and legend (outside the map) can follow.
function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const { zoom } = useView();
  useEffect(() => onZoom(zoom), [zoom, onZoom]);
  return null;
}

function MapControls({ map, zoom }: { map: L.Map; zoom: number }) {
  const level = levelFor(zoom);

  const goToLevel = (l: Level) => {
    if (l === "regions") fitGB(map);
    else map.setZoom((l === "counties" ? COUNTY_ZOOM : PLACE_ZOOM) + 0.4);
  };

  return (
    <>
      <div className={styles.levels} role="group" aria-label="Map detail level">
        {LEVELS.map((l) => (
          <button key={l.id} type="button" className={level === l.id ? styles.levelActive : ""} aria-pressed={level === l.id} onClick={() => goToLevel(l.id)}>
            {l.label}
          </button>
        ))}
      </div>

      <div className={styles.zoom} role="group" aria-label="Zoom">
        <button type="button" onClick={() => map.zoomIn()} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button type="button" onClick={() => map.zoomOut()} disabled={zoom <= map.getMinZoom()} aria-label="Zoom out" title="Zoom out">
          −
        </button>
        <button type="button" onClick={() => fitGB(map)} aria-label="Reset view" title="Show all of Great Britain" className={styles.reset}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </>
  );
}

const LEVEL_HINT: Record<Level, string> = {
  regions: "Zoom in to see counties",
  counties: "Click a county for telemetry · zoom in for towns",
  places: "Click a town or county for details",
};

interface Props {
  zones: Zone[];
}

export default function RiskMap({ zones }: Props) {
  const byCode = new Map(zones.map((z) => [z.zip_code, z]));
  const counts = {
    SAFE: zones.filter((z) => z.status === "SAFE").length,
    ELEVATED: zones.filter((z) => z.status === "ELEVATED").length,
    CRITICAL: zones.filter((z) => z.status === "CRITICAL").length,
  };

  const [map, setMap] = useState<L.Map | null>(null);
  const [zoom, setZoom] = useState(0);

  return (
    <section className={styles.wrap}>
      <MapContainer
        ref={setMap}
        bounds={GB_BOUNDS}
        className={styles.map}
        zoomControl={false}
        attributionControl={false}
        zoomSnap={0.1}
        minZoom={4.5}
        maxZoom={MAX_ZOOM}
        maxBounds={[
          [48.5, -9.5],
          [60.5, 4.5],
        ]}
        scrollWheelZoom
      >
        <FitGB />
        <RegionLayer zones={zones} byCode={byCode} />
        <DetailLayers byCode={byCode} />
        <ZoomWatcher onZoom={setZoom} />
      </MapContainer>

      {map && <MapControls map={map} zoom={zoom} />}

      <div className={styles.legend}>
        <h4>Risk score</h4>
        <div><i style={{ background: STATUS_COLOR.SAFE }} /> Safe ≤ 40 <b>{counts.SAFE}</b></div>
        <div><i style={{ background: STATUS_COLOR.ELEVATED }} /> Elevated 41–79 <b>{counts.ELEVATED}</b></div>
        <div><i style={{ background: STATUS_COLOR.CRITICAL }} /> Critical ≥ 80 <b>{counts.CRITICAL}</b></div>
        <p>{LEVEL_HINT[levelFor(zoom)]}</p>
      </div>

      <p className={styles.credit}>Boundaries © EuroGeographics / Eurostat, ONS · Places © GeoNames</p>
    </section>
  );
}
