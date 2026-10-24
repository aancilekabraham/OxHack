"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FacilityInventory, Resource } from "@/lib/types";
import styles from "./InventoryPanel.module.css";

const RESOURCES: { key: Resource; label: string }[] = [
  { key: "ppe_units", label: "PPE" },
  { key: "antiviral_doses", label: "Antivirals" },
  { key: "vaccine_doses", label: "Vaccines" },
];

// Fixed hex colours: SVG attributes don't reliably resolve CSS variables.
// These are readable on both the light and dark backgrounds.
const ROLE_COLOR = {
  donor: "#e0a100",
  recipient: "#e5484d",
  none: "#3e7bfa",
};
const BEFORE_COLOR = "#9aa3ae";
const AXIS_COLOR = "#8a929c";
const GRID_COLOR = "rgba(138, 146, 156, 0.25)";

interface Props {
  inventory: FacilityInventory[];
}

export default function InventoryPanel({ inventory }: Props) {
  const [resource, setResource] = useState<Resource>("ppe_units");

  const data = inventory.map((f) => ({
    name: f.facility_name,
    zip: f.zip_code,
    before: f.before[resource],
    after: f.after[resource],
    delta: f.after[resource] - f.before[resource],
    role: (f.role ?? "none") as keyof typeof ROLE_COLOR,
  }));

  const donor = inventory.find((f) => f.role === "donor");
  const recipient = inventory.find((f) => f.role === "recipient");

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Inventory Metrics</h2>
          <p className={styles.sub}>
            {donor && recipient
              ? `Last reallocation: ${donor.facility_name} → ${recipient.facility_name}`
              : "No reallocations yet"}
          </p>
        </div>
        <div className={styles.toggle} role="tablist">
          {RESOURCES.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={r.key === resource}
              className={r.key === resource ? styles.tabActive : styles.tab}
              onClick={() => setResource(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.legend}>
        <span><i style={{ background: BEFORE_COLOR }} /> Before</span>
        <span><i style={{ background: ROLE_COLOR.none }} /> After</span>
        <span><i style={{ background: ROLE_COLOR.donor }} /> Donor</span>
        <span><i style={{ background: ROLE_COLOR.recipient }} /> Recipient</span>
      </div>

      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barGap={1} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis
              dataKey="name"
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              interval={0}
              angle={-28}
              textAnchor="end"
              height={64}
            />
            <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={{ fill: GRID_COLOR }}
              contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(value, name) => [Number(value).toLocaleString(), name === "before" ? "Before" : "After"]}
            />
            <Bar dataKey="before" fill={BEFORE_COLOR} radius={[4, 4, 0, 0]} animationDuration={600} />
            <Bar dataKey="after" radius={[4, 4, 0, 0]} animationDuration={900}>
              {data.map((d) => (
                <Cell key={d.name} fill={ROLE_COLOR[d.role]} />
              ))}
              <LabelList
                dataKey="delta"
                position="top"
                formatter={(v) => {
                  const n = Number(v);
                  return n === 0 ? "" : `${n > 0 ? "+" : ""}${n.toLocaleString()}`;
                }}
                style={{ fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
