"use client";

import dynamic from "next/dynamic";
import EventStream from "@/components/EventStream";
import Header from "@/components/Header";
import InventoryPanel from "@/components/InventoryPanel";
import { useAgentFeed } from "@/lib/useAgentFeed";
import styles from "./page.module.css";

// Leaflet touches `window`, so the map only renders in the browser.
const RiskMap = dynamic(() => import("@/components/RiskMap"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
});

export default function Home() {
  const { events, inventory, zones, thinking, connection, lastUpdate, triggerSpike } = useAgentFeed();

  return (
    <main className={styles.grid}>
      <div className={styles.header}>
        <Header
          zones={zones}
          connection={connection}
          lastUpdate={lastUpdate}
          thinking={thinking}
          onSpike={triggerSpike}
        />
      </div>

      <div className={styles.map}>
        <RiskMap zones={zones} />
      </div>

      <div className={styles.side}>
        <EventStream events={events} thinking={thinking} />
      </div>

      <div className={styles.bottom}>
        <InventoryPanel inventory={inventory} />
      </div>
    </main>
  );
}
