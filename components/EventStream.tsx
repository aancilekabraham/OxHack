"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvent, EventType } from "@/lib/types";
import styles from "./EventStream.module.css";

type Filter = "ALL" | "ALERTS" | "DIRECTIVES" | "TRANSFERS";

const FILTERS: Record<Filter, EventType[] | null> = {
  ALL: null,
  ALERTS: ["ALERT", "RISK_UPDATE"],
  DIRECTIVES: ["DIRECTIVE", "CONTAINMENT"],
  TRANSFERS: ["TRANSFER"],
};

const TYPE_LABEL: Record<EventType, string> = {
  ALERT: "Alert",
  RISK_UPDATE: "Risk",
  DIRECTIVE: "Directive",
  TRANSFER: "Transfer",
  CONTAINMENT: "Containment",
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

interface Props {
  events: AgentEvent[];
  thinking: boolean;
}

export default function EventStream({ events, thinking }: Props) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [hovering, setHovering] = useState(false);
  // Ids the user has clicked. The newest directive starts open, so clicking it closes it.
  const [toggled, setToggled] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  // Newest events are at the top: keep the view pinned there unless the user is reading.
  useEffect(() => {
    if (!hovering && listRef.current) listRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [events, hovering]);

  // The newest directive is open by default so judges see the reasoning without clicking.
  const newestDirective = events.find((e) => e.type === "DIRECTIVE")?.id;
  const isOpen = (id: number) => (id === newestDirective) !== toggled.has(id);

  const toggle = (id: number) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allowed = FILTERS[filter];
  const visible = allowed ? events.filter((e) => allowed.includes(e.type)) : events;

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <h2>Agent Event Stream</h2>
        <span className={styles.live}>
          <span className={styles.dot} /> {hovering ? "Paused" : "Live"}
        </span>
      </header>

      <div className={styles.filters}>
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button
            key={f}
            className={f === filter ? styles.chipActive : styles.chip}
            onClick={() => setFilter(f)}
          >
            {f[0] + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {thinking && (
        <div className={styles.thinking}>
          <span className={styles.spinner} /> Agent reasoning over regional inventory…
        </div>
      )}

      <div
        className={styles.list}
        ref={listRef}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {visible.length === 0 && <p className={styles.empty}>Waiting for telemetry…</p>}

        {visible.map((e) => (
          <article key={e.id} className={`${styles.event} ${styles[e.severity]}`}>
            <div className={styles.meta}>
              <span className={styles.badge}>{TYPE_LABEL[e.type]}</span>
              <span className={styles.zip}>{e.zip_code}</span>
              <time>{time(e.timestamp)}</time>
            </div>
            <p className={styles.message}>{e.message}</p>

            {e.directive && (
              <>
                <button className={styles.expand} onClick={() => toggle(e.id)}>
                  {isOpen(e.id) ? "Hide details ▲" : "Show details ▼"}
                </button>
                {isOpen(e.id) && (
                  <div className={styles.directive}>
                    <div className={styles.route}>
                      <span>{e.directive.donor_facility}</span>
                      <span className={styles.arrow}>→</span>
                      <span>{e.directive.target_facility}</span>
                    </div>
                    <dl className={styles.amounts}>
                      <div><dt>PPE</dt><dd>+{e.directive.transfer.ppe_units.toLocaleString()}</dd></div>
                      <div><dt>Antivirals</dt><dd>+{e.directive.transfer.antiviral_doses.toLocaleString()}</dd></div>
                      <div><dt>Vaccines</dt><dd>+{e.directive.transfer.vaccine_doses.toLocaleString()}</dd></div>
                    </dl>
                    <h4>Containment</h4>
                    <ul>
                      {e.directive.containment.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                    <h4>Rationale</h4>
                    <p className={styles.rationale}>{e.directive.rationale}</p>
                  </div>
                )}
              </>
            )}
          </article>
        ))}
      </div>
    </aside>
  );
}
