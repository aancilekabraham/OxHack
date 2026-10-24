// Shared data contract between the backend and the dashboard panels.
// Keep this file in sync with whatever the FastAPI backend returns.

export type EventType =
  | "ALERT"
  | "RISK_UPDATE"
  | "DIRECTIVE"
  | "TRANSFER"
  | "CONTAINMENT";

export type Severity = "info" | "warning" | "critical";

export interface TransferAmounts {
  ppe_units: number;
  antiviral_doses: number;
  vaccine_doses: number;
}

export interface Directive {
  target_zone: string;
  target_facility: string;
  donor_facility: string;
  transfer: TransferAmounts;
  containment: string[];
  rationale: string;
}

export interface AgentEvent {
  id: number;
  timestamp: string; // ISO 8601
  type: EventType;
  severity: Severity;
  zip_code: string;
  message: string;
  risk_score?: number;
  directive?: Directive; // only on DIRECTIVE events
}

export type Resource = keyof TransferAmounts;

export type ZoneStatus = "SAFE" | "ELEVATED" | "CRITICAL";

// One entry per monitored zone, as returned by GET /api/v1/map-status.
export interface Zone {
  zip_code: string;
  zone_name: string;
  latitude: number;
  longitude: number;
  population: number;
  risk_score: number; // 0–100
  status: ZoneStatus;
  wastewater_copies_per_l: number;
  er_avg_wait_mins: number;
  mobility_density_score: number; // 0–100
}

// Spec thresholds: green ≤ 40, yellow 41–79, red ≥ 80.
export function statusFor(score: number): ZoneStatus {
  if (score >= 80) return "CRITICAL";
  if (score > 40) return "ELEVATED";
  return "SAFE";
}

export interface FacilityInventory {
  facility_id: string;
  facility_name: string;
  zip_code: string;
  before: TransferAmounts; // stock before the latest reallocation
  after: TransferAmounts; // current stock
  role?: "donor" | "recipient"; // set on the facilities touched by the latest transfer
}
