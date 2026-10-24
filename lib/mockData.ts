import type { FacilityInventory, Zone } from "./types";

// Mock monitored zones: the 11 regions of Great Britain (Northern Ireland excluded).
// `zip_code` holds a short region code; boundaries live in lib/gbRegions.json under the same code.
// latitude/longitude is where the region's label sits on the map.
// Populations are rounded real figures; all telemetry is invented.

const zone = (
  zip_code: string,
  zone_name: string,
  latitude: number,
  longitude: number,
  population: number,
  risk_score: number,
  wastewater_copies_per_l: number,
  er_avg_wait_mins: number,
  mobility_density_score: number,
): Zone => ({
  zip_code, zone_name, latitude, longitude, population, risk_score, status: "SAFE",
  wastewater_copies_per_l, er_avg_wait_mins, mobility_density_score,
});

export const INITIAL_ZONES: Zone[] = [
  zone("SCO", "Scotland", 56.9, -4.3, 5_450_000, 10, 8000, 38, 35),
  zone("NE", "North East", 55.05, -1.95, 2_650_000, 16, 11000, 44, 48),
  zone("NW", "North West", 54.45, -2.9, 7_420_000, 24, 14000, 52, 66),
  zone("YH", "Yorkshire & Humber", 53.85, -1.05, 5_480_000, 19, 12000, 47, 58),
  zone("EM", "East Midlands", 52.95, -0.75, 4_880_000, 14, 10000, 41, 50),
  zone("WM", "West Midlands", 52.4, -2.25, 5_950_000, 27, 15000, 55, 68),
  zone("EE", "East of England", 52.4, 0.75, 6_340_000, 12, 9000, 39, 52),
  zone("LDN", "London", 51.52, -0.1, 8_870_000, 33, 19000, 62, 92),
  zone("SE", "South East", 51.0, -1.1, 9_280_000, 18, 11000, 45, 64),
  zone("SW", "South West", 50.75, -3.5, 5_710_000, 9, 7000, 36, 40),
  zone("WAL", "Wales", 52.25, -3.75, 3_110_000, 11, 8500, 40, 38),
];

export const ZONES = INITIAL_ZONES.map((z) => z.zip_code);

const stock = (ppe: number, antivirals: number, vaccines: number) => ({
  ppe_units: ppe,
  antiviral_doses: antivirals,
  vaccine_doses: vaccines,
});

const facility = (zip_code: string, facility_name: string, ppe: number, antivirals: number, vaccines: number): FacilityInventory => ({
  facility_id: `FAC-${zip_code}-01`,
  facility_name,
  zip_code,
  before: stock(ppe, antivirals, vaccines),
  after: stock(ppe, antivirals, vaccines),
});

// One regional supply hub per zone.
export const INITIAL_INVENTORY: FacilityInventory[] = [
  facility("SCO", "Glasgow Hub", 2600, 640, 1400),
  facility("NE", "Newcastle Depot", 1100, 260, 600),
  facility("NW", "Manchester Hub", 2100, 520, 1100),
  facility("YH", "Leeds Hub", 1700, 410, 900),
  facility("EM", "Nottingham Depot", 1500, 360, 800),
  facility("WM", "Birmingham Hub", 1300, 300, 700),
  facility("EE", "Cambridge Depot", 2400, 590, 1250),
  facility("LDN", "London Central", 900, 180, 500),
  facility("SE", "Oxford Hub", 3000, 720, 1600),
  facility("SW", "Bristol Depot", 1900, 450, 1000),
  facility("WAL", "Cardiff Hub", 1200, 280, 650),
];
