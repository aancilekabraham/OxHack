# Biosecurity Autobalancer – Dashboard

Next.js + React + Recharts frontend for the OxHack biosecurity project.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no backend configured it runs on **mock data**: a fake agent posts risk updates every 4s, runs a full outbreak sequence (alert → reasoning → directive → transfer → containment) after 6s, and repeats every 30s. The **Simulate Pathogen Spike** button triggers one on demand.

## Connect the real backend

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The dashboard then polls every 2s:

| Endpoint | Returns |
|---|---|
| `GET /api/v1/events?since=<id>` | `AgentEvent[]` newer than `id`, oldest first |
| `GET /api/v1/inventory` | `FacilityInventory[]` with `before`, `after` and `role` |
| `GET /api/v1/map-status` | `Zone[]` with coordinates, telemetry, `risk_score` and `status` |
| `POST /api/v1/trigger-outbreak` | Called by the spike button |

The exact shapes are in `lib/types.ts`. The backend needs to return these; they aren't in the original spec yet, and it also needs CORS enabled for the frontend's origin.

## Files

| File | What it is |
|---|---|
| `components/Header.tsx` | Title, system status pill, connection indicator, zone picker + spike button |
| `components/RiskMap.tsx` | Map of Great Britain's 11 regions (NI excluded), each filled by risk (green ≤ 40, yellow 41–79, red ≥ 80); click for telemetry |
| `lib/gbRegions.json` | Region boundaries (Eurostat NUTS 2016 level 1, © EuroGeographics) |
| `components/EventStream.tsx` | Side panel: live event feed, filters, expandable directive cards |
| `components/InventoryPanel.tsx` | Bottom panel: before/after bar chart with resource toggle |
| `lib/useAgentFeed.ts` | Data hook: mock agent or live polling, plus `triggerSpike()` |
| `lib/types.ts` | Shared data contract with the backend |
| `lib/mockData.ts` | Mock regions (codes like `LDN`, `NW`) and one supply hub per region |
| `app/page.tsx` | Page layout tying all four panels together |
