import { appendFileSync } from "node:fs";
import { it } from "vitest";
import { generateWorld } from "../lib/world/generate";
import { toLayoutHouses } from "../lib/world/layout-houses";
import { pinsFromSettlement } from "../lib/world/settlement";
import { dragBase, houseGhost } from "../lib/world/free-drag";
import type { House, Artifact } from "../lib/types";
const LOG = (...a: unknown[]) => appendFileSync("/tmp/claude-0/dbg.txt", a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + "\n");
const CODES = ["TA.BA_BAUSTATIK1","TA.BA_NABA","TA.BA_GA","TA.BA_ET","TA.BA_MATH1A","TA.BA_DATA1_MM","TA.BA_SP1","TA.BA_OEK","TA.BA_VWL","TA.BA_BS","TA.BA_DC_STUD1","TA.BA_WISSARB"];
it("dbg", () => {
  const village = "00000000-0000-4000-8000-000000000001";
  const old = "2026-01-01T00:00:00Z";
  const houses: House[] = [
    { id: "z-0", village_id: village, kind: "zentrale", title: "Zentrale", module_code: null, color: "#8fb3ff", semester: null, position_index: 0, created_at: old },
    ...Array.from({ length: 12 }, (_, i): House => ({ id: `h-${i}-abcdef`, village_id: village, kind: "modul", title: `Haus ${i + 1}`, module_code: CODES[i % CODES.length], color: "#8fb3ff", semester: 1, position_index: i + 1, created_at: new Date(Date.parse(old) + i * 86400000).toISOString() })),
  ];
  const lh = toLayoutHouses(houses, [] as Artifact[]);
  const w0 = generateWorld({ seed: "hubdome1", version: 3, houses: lh });
  const quartiere = pinsFromSettlement(w0.settlement).quartiere;
  const roads = Object.fromEntries(Object.keys(quartiere).map((k) => [k, { form: "intelligent" as const }]));
  const doc0 = { v: 1 as const, quartiere, quarterRoads: roads };
  const w1 = generateWorld({ seed: "hubdome1", version: 3, houses: lh, doc: doc0 });
  const doc = { ...doc0, ...pinsFromSettlement(w1.settlement) };
  const w = generateWorld({ seed: "hubdome1", version: 3, houses: lh, doc });
  const list = Object.entries(w.settlement.spurs).filter(([, p]) => p.length > 10);
  const [id, pts] = list[0];
  const m = pts[Math.floor(pts.length / 2)], a = pts[Math.floor(pts.length / 2) - 1];
  const l = Math.hypot(m.x - a.x, m.z - a.z) || 1;
  const n = { x: -(m.z - a.z) / l, z: (m.x - a.x) / l };
  LOG("spur", id, w.settlement.houses[id].slot, pts.length);
  for (const k of [0, 1, -1, 2.5, -2.5]) {
    const bend = { x: m.x + n.x * k, z: m.z + n.z * k };
    const wb = generateWorld({ seed: "hubdome1", version: 3, houses: lh, doc: { ...doc, roadBends: { [id]: bend } } });
    LOG("bend", k, "dropped", wb.settlement.droppedBends, "pins", wb.settlement.droppedPins, "unplaced", wb.settlement.unplaced);
  }
  // Haus ziehen
  const hh = Object.values(w.settlement.houses)[2];
  LOG("house", hh.id, hh.slot, hh.quarterId);
  const input = { seed: "hubdome1", version: 3, houses: lh, doc };
  const base = dragBase(input, w, hh.quarterId, new Set([hh.id]));
  for (const dx of [0, 1, 2, 4]) {
    const g = houseGhost(base, hh.id, hh.x + dx, hh.z);
    LOG("drag", dx, g.ok, g.ok ? "" : g.grund);
  }
});
