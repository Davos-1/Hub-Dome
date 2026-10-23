import { describe, expect, it } from "vitest";
import { frameOverflow, poseFor, type Pose, type Vec3 } from "@/lib/camera-poses";
import { FACH_ORDER } from "@/lib/fachbereiche";
import { ZENTRALE_STYLES } from "@/lib/styles";
import type { Artifact, House } from "@/lib/types";
import { buildVillageModel } from "@/lib/village-model";
import { freeFrame } from "./hud/insets";
import { hullLookup, zentraleBox } from "./hull";

/**
 * P5: Wird die Zentrale (oder ein Haus) angeklickt, liegt das ganze Modell samt Sockel und Objektring im freien
 * Bildausschnitt (Fenster rechts bzw. Blatt unten ausgespart), mit Rand. Geprüft wird mit der Hülle des
 * tatsächlichen Modells und dem echten Seitenverhältnis.
 */

const SCREENS = [
  { name: "Desktop", w: 1280, h: 800 },
  { name: "Laptop schmal", w: 1024, h: 768 },
  { name: "Hochformat", w: 390, h: 844 },
] as const;

function village(ringObjects: number, houses: number) {
  const vid = "v";
  const t0 = Date.parse("2026-01-01T00:00:00Z");
  const hs: House[] = [
    {
      id: "z",
      village_id: vid,
      kind: "zentrale",
      title: "Zentrale",
      module_code: null,
      color: "#8fb3ff",
      semester: null,
      position_index: 0,
      created_at: new Date(t0).toISOString(),
    },
    ...Array.from({ length: houses }, (_, i): House => ({
      id: `h${i}`,
      village_id: vid,
      kind: "modul",
      title: `Haus ${i}`,
      module_code: null,
      color: "#8fb3ff",
      semester: 1,
      position_index: i + 1,
      created_at: new Date(t0 + (i + 1) * 1000).toISOString(),
    })),
  ];
  // Fachbereich ohne Modulcode: über den Titel nicht bestimmbar → Thema-Haus je Fachbereich via kind «thema»
  const arts: Artifact[] = [];
  const add = (houseId: string, n: number) => {
    for (let k = 0; k < n; k++)
      arts.push({
        id: `${houseId}-a${k}`,
        house_id: houseId,
        owner_id: "u",
        url: `https://example.com/${houseId}/${k}`,
        title: `Objekt ${k}`,
        description: null,
        kind: "rechner",
        item_type: "claude_artifact",
        meta: {},
        meta_refreshed_at: null,
        tags: [],
        visibility: "shared",
        sort: k,
        created_at: new Date(t0).toISOString(),
      });
  };
  add("z", ringObjects);
  hs.slice(1).forEach((h, i) => add(h.id, (i * 3) % 13));
  return { hs, arts };
}

const inside = (pts: Vec3[], p: Pose, aspect: number, w: number, h: number) => {
  const f: Vec3 = [
    p.target[0] - p.position[0],
    p.target[1] - p.position[1],
    p.target[2] - p.position[2],
  ];
  const l = Math.hypot(...f);
  // 1 % Toleranz für Rundung; gefordert sind 12 % Rand, geprüft wird «ganz im Bild mit mindestens 10 %»
  return frameOverflow(
    pts,
    p.position,
    [f[0] / l, f[1] / l, f[2] / l],
    aspect,
    freeFrame(w, h, true),
    0.1,
  );
};

describe("Kamera passt Zentrale und Häuser ganz ins Bild (P5)", () => {
  it("die gemessene Hülle des Leuchtturms reicht bis zur Spitze (höher als die Schätzung des Labels)", () => {
    const b = zentraleBox("leuchtturm", 2.3);
    expect(b.max.y).toBeGreaterThan(12);
  });

  for (const ring of [0, 18]) {
    for (const style of ZENTRALE_STYLES) {
      for (const s of SCREENS) {
        it(`${style}, ${s.name}, ${ring ? "mit" : "ohne"} Objektring`, () => {
          const { hs, arts } = village(ring, 6);
          const model = buildVillageModel(hs, arts, Date.now(), {
            seed: "hubdome1",
            version: 1,
            doc: { v: 1 },
          });
          const hullOf = hullLookup(model, style);
          const aspect = s.w / s.h;
          const pose = poseFor(model.layout, { level: "haus", q: null, h: "z" }, "3d", {
            aspect,
            frame: freeFrame(s.w, s.h, true),
            hullOf,
          });
          expect(inside(hullOf("z")!, pose, aspect, s.w, s.h)).toBeLessThanOrEqual(0);
        });
      }
    }
  }

  it("alle Haustypen und Stufen bleiben ganz im Bild (Desktop und Hochformat)", () => {
    const { hs, arts } = village(0, 24);
    // Fachbereiche über Modulcodes verteilen, damit jeder Haustyp vorkommt
    const codes = [
      "TA.BA_BAUSTATIK1",
      "TA.BA_GA",
      "TA.BA_DC_STUD1",
      "TA.BA_VWL",
      "TA.BA_MATH1A",
      "TA.BA_SP1",
      "TA.BA_DATA1_MM",
      "TA.BA_OEK",
    ];
    hs.slice(1).forEach((h, i) => (h.module_code = codes[i % codes.length]));
    const model = buildVillageModel(hs, arts, Date.now(), {
      seed: "b7k2m9qx",
      version: 1,
      doc: { v: 1 },
    });
    const types = new Set(model.houses.filter((h) => h.items.length).map((h) => h.style.type));
    expect(types.size).toBeGreaterThanOrEqual(FACH_ORDER.length - 2);
    const hullOf = hullLookup(model, "rathaus");
    for (const s of SCREENS) {
      const aspect = s.w / s.h;
      for (const h of model.houses.filter((x) => x.kind !== "zentrale")) {
        const l = model.layout.houses[h.id];
        if (!l) continue;
        const pose = poseFor(model.layout, { level: "haus", q: l.quarterId, h: h.id }, "3d", {
          aspect,
          frame: freeFrame(s.w, s.h, true),
          hullOf,
        });
        expect(
          inside(hullOf(h.id)!, pose, aspect, s.w, s.h),
          `${s.name}/${h.id}`,
        ).toBeLessThanOrEqual(0);
      }
    }
  }, 60_000);
});
