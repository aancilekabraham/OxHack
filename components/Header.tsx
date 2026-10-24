"use client";

import { useEffect, useState } from "react";
import type { Zone } from "@/lib/types";
import type { Connection } from "@/lib/useAgentFeed";
import styles from "./Header.module.css";

interface Props {
  zones: Zone[];
  connection: Connection;
  lastUpdate: Date | null;
  thinking: boolean;
  onSpike: (zip: string) => void | Promise<void>;
}

const CONNECTION_LABEL: Record<Connection, string> = {
  mock: "Mock data",
  live: "Live",
  offline: "Backend offline",
};

export default function Header({ zones, connection, lastUpdate, thinking, onSpike }: Props) {
  const [target, setTarget] = useState(zones[0]?.zip_code ?? "");
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  // Re-render every second so "updated Xs ago" stays fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const critical = zones.filter((z) => z.status === "CRITICAL");
  const elevated = zones.filter((z) => z.status === "ELEVATED");
  const level = critical.length ? "critical" : elevated.length ? "elevated" : "safe";
  const summary = critical.length
    ? `CRITICAL · ${critical.map((z) => z.zip_code).join(", ")}`
    : elevated.length
      ? `${elevated.length} zone${elevated.length > 1 ? "s" : ""} elevated`
      : "All zones normal";

  const ago = lastUpdate && now ? Math.max(0, Math.round((now - lastUpdate.getTime()) / 1000)) : null;

  const spike = async () => {
    setSending(true);
    try {
      await onSpike(target);
    } finally {
      setSending(false);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden>
          ⬢
        </span>
        <div>
          <h1>Biosecurity Autobalancer</h1>
          <p>Micro-triage &amp; logistics agent · Great Britain</p>
        </div>
      </div>

      <div className={styles.status}>
        <span className={`${styles.pill} ${styles[level]}`}>
          <span className={styles.pillDot} />
          {summary}
        </span>
        {thinking && <span className={styles.agent}>Agent deciding…</span>}
        <span className={styles.conn}>
          <span className={`${styles.connDot} ${styles[connection]}`} />
          {CONNECTION_LABEL[connection]}
          {ago !== null && <span className={styles.ago}> · updated {ago}s ago</span>}
        </span>
      </div>

      <div className={styles.controls}>
        <label className={styles.srOnly} htmlFor="spike-zone">
          Zone to spike
        </label>
        <select id="spike-zone" className={styles.select} value={target} onChange={(e) => setTarget(e.target.value)}>
          {zones.map((z) => (
            <option key={z.zip_code} value={z.zip_code}>
              {z.zip_code} · {z.zone_name}
            </option>
          ))}
        </select>
        <button className={styles.spike} onClick={spike} disabled={sending || thinking}>
          {sending || thinking ? "Agent responding…" : "Simulate Pathogen Spike"}
        </button>
      </div>
    </header>
  );
}
