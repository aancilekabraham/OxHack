"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, FacilityInventory, TransferAmounts, Zone } from "./types";
import { statusFor } from "./types";
import { INITIAL_INVENTORY, INITIAL_ZONES } from "./mockData";

// Set NEXT_PUBLIC_API_URL (e.g. http://localhost:8000) to switch from the fake
// agent to the real backend. Leave it unset to run fully on mock data.
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const USE_MOCK = !API_URL;
const POLL_MS = 2000;
const MAX_EVENTS = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export type Connection = "mock" | "live" | "offline";

export function useAgentFeed() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [inventory, setInventory] = useState<FacilityInventory[]>(INITIAL_INVENTORY);
  const [zones, setZones] = useState<Zone[]>(INITIAL_ZONES);
  const [thinking, setThinking] = useState(false);
  const [connection, setConnection] = useState<Connection>(USE_MOCK ? "mock" : "offline");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const nextId = useRef(1);
  const busy = useRef(false);
  const inventoryRef = useRef(inventory);
  const zonesRef = useRef(zones);
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);
  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  const push = useCallback((e: Omit<AgentEvent, "id" | "timestamp">) => {
    const event: AgentEvent = { ...e, id: nextId.current++, timestamp: new Date().toISOString() };
    setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
    setLastUpdate(new Date());
  }, []);

  const setZoneRisk = useCallback((zip: string, score: number, telemetry?: Partial<Zone>) => {
    const s = clamp(score);
    const next = zonesRef.current.map((z) =>
      z.zip_code === zip ? { ...z, ...telemetry, risk_score: s, status: statusFor(s) } : z,
    );
    zonesRef.current = next;
    setZones(next);
  }, []);

  // ---------- Mock agent: full detect → reason → transfer → contain sequence ----------
  const runMockOutbreak = useCallback(
    async (zip: string) => {
      if (busy.current) return;
      busy.current = true;
      const score = rand(82, 97);
      const zone = zonesRef.current.find((z) => z.zip_code === zip);

      setZoneRisk(zip, score, {
        wastewater_copies_per_l: Math.round((zone?.wastewater_copies_per_l ?? 10000) * 4.5),
        er_avg_wait_mins: (zone?.er_avg_wait_mins ?? 45) + 90,
      });
      push({ type: "ALERT", severity: "critical", zip_code: zip, risk_score: score,
        message: `${zip} crossed CRITICAL threshold (risk ${score.toFixed(1)})` });

      setThinking(true);
      await sleep(2200);
      setThinking(false);

      const inv = inventoryRef.current;
      const target = inv.find((f) => f.zip_code === zip) ?? inv[0];
      const donor = inv
        .filter((f) => f.facility_id !== target.facility_id)
        .sort((a, b) => b.after.ppe_units - a.after.ppe_units)[0];

      const transfer: TransferAmounts = {
        ppe_units: Math.round(donor.after.ppe_units * 0.3),
        antiviral_doses: Math.round(donor.after.antiviral_doses * 0.3),
        vaccine_doses: Math.round(donor.after.vaccine_doses * 0.2),
      };
      const containment = [
        `Suspend pooled rideshare within ${zip} perimeter for 72h`,
        `Advise ${zip} facilities to activate surge triage protocol`,
      ];

      push({ type: "DIRECTIVE", severity: "warning", zip_code: zip,
        message: `Agent directive: reinforce ${target.facility_name} from ${donor.facility_name}`,
        directive: {
          target_zone: zip,
          target_facility: target.facility_name,
          donor_facility: donor.facility_name,
          transfer,
          containment,
          rationale: `Wastewater load in ${zip} rose sharply over 3 days alongside longer ER waits. ${donor.facility_name} sits in a low-risk zone with the largest surplus, so it can absorb the transfer without dropping below safety stock.`,
        } });

      await sleep(1200);
      setInventory((prev) =>
        prev.map((f) => {
          const before = { ...f.after };
          if (f.facility_id === donor.facility_id)
            return { ...f, before, role: "donor",
              after: { ppe_units: before.ppe_units - transfer.ppe_units,
                antiviral_doses: before.antiviral_doses - transfer.antiviral_doses,
                vaccine_doses: before.vaccine_doses - transfer.vaccine_doses } };
          if (f.facility_id === target.facility_id)
            return { ...f, before, role: "recipient",
              after: { ppe_units: before.ppe_units + transfer.ppe_units,
                antiviral_doses: before.antiviral_doses + transfer.antiviral_doses,
                vaccine_doses: before.vaccine_doses + transfer.vaccine_doses } };
          return { ...f, before, role: undefined };
        }),
      );
      push({ type: "TRANSFER", severity: "info", zip_code: zip,
        message: `Moved ${transfer.ppe_units} PPE, ${transfer.antiviral_doses} antivirals, ${transfer.vaccine_doses} vaccines → ${target.facility_name}` });

      await sleep(800);
      push({ type: "CONTAINMENT", severity: "warning", zip_code: zip,
        message: `[API MOCK] Disabled pooled rides in ${zip} — biosecurity containment protocol` });

      busy.current = false;
    },
    [push, setZoneRisk],
  );

  // Background telemetry: hot zones cool down slowly, one other zone drifts each tick,
  // and an automatic outbreak runs every 30s so the demo stays alive.
  useEffect(() => {
    if (!USE_MOCK) return;
    const ticker = setInterval(() => {
      // Zones that went critical cool off gradually (containment working).
      for (const z of zonesRef.current) {
        if (z.risk_score > 45) setZoneRisk(z.zip_code, z.risk_score - 2.5);
      }
      const calm = zonesRef.current.filter((z) => z.risk_score <= 45);
      if (!calm.length) return;
      const z = calm[rand(0, calm.length - 1)];
      const score = clamp(z.risk_score + rand(-8, 10));
      setZoneRisk(z.zip_code, score);
      const status = statusFor(score);
      push({ type: "RISK_UPDATE", severity: status === "SAFE" ? "info" : "warning", zip_code: z.zip_code,
        risk_score: score, message: `${z.zip_code} risk recalculated: ${score.toFixed(1)} (${status})` });
    }, 4000);
    const first = setTimeout(() => runMockOutbreak("LDN"), 6000);
    const auto = setInterval(() => {
      const calm = zonesRef.current.filter((z) => z.status !== "CRITICAL");
      if (calm.length) runMockOutbreak(calm[rand(0, calm.length - 1)].zip_code);
    }, 30000);
    return () => { clearInterval(ticker); clearTimeout(first); clearInterval(auto); };
  }, [push, runMockOutbreak, setZoneRisk]);

  // ---------- Live backend: poll events, inventory and map status ----------
  useEffect(() => {
    if (USE_MOCK) return;
    let lastId = 0;
    const poll = async () => {
      try {
        const [evRes, invRes, mapRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/events?since=${lastId}`),
          fetch(`${API_URL}/api/v1/inventory`),
          fetch(`${API_URL}/api/v1/map-status`),
        ]);
        const newEvents: AgentEvent[] = await evRes.json();
        if (newEvents.length) {
          lastId = Math.max(lastId, ...newEvents.map((e) => e.id));
          setEvents((prev) => [...[...newEvents].reverse(), ...prev].slice(0, MAX_EVENTS));
          // Agent is "thinking" if the newest event is a critical alert with no directive yet.
          const newest = newEvents[newEvents.length - 1];
          setThinking(newest.type === "ALERT" && newest.severity === "critical");
        }
        setInventory(await invRes.json());
        const mapZones: Zone[] = await mapRes.json();
        setZones(mapZones.map((z) => ({ ...z, status: z.status ?? statusFor(z.risk_score) })));
        setConnection("live");
        setLastUpdate(new Date());
      } catch (err) {
        setConnection("offline");
        console.warn("Polling failed", err);
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Called by the "Simulate Pathogen Spike" button.
  const triggerSpike = useCallback(
    async (zip: string) => {
      if (USE_MOCK) return runMockOutbreak(zip);
      await fetch(`${API_URL}/api/v1/trigger-outbreak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip_code: zip, wastewater_multiplier: 4.5, er_wait_add_mins: 90 }),
      });
    },
    [runMockOutbreak],
  );

  return { events, inventory, zones, thinking, connection, lastUpdate, triggerSpike, isMock: USE_MOCK };
}
