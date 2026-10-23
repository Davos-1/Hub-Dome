import { describe, expect, it } from "vitest";
import { filterList } from "./list-filter";

type TestHouse = { id: string; kind: string; title: string };
type TestArtifact = {
  id: string;
  house_id: string;
  item_type: "github_repo" | "gist" | "claude_artifact";
  title: string;
  description: string | null;
  tags: string[];
};

const zentrale: TestHouse = { id: "z", kind: "zentrale", title: "Zentrale" };
const statik: TestHouse = { id: "h1", kind: "modul", title: "Baustatik" };
const wald: TestHouse = { id: "h2", kind: "thema", title: "Waldwege" };
const leer: TestHouse = { id: "h3", kind: "thema", title: "Baustelle" };

const model = {
  houses: [statik, zentrale, wald, leer],
  byId: { z: zentrale, h1: statik, h2: wald, h3: leer },
  layout: {
    quarters: [
      { id: "tragwerk" as const, houseIds: ["h1"] },
      { id: "umwelt" as const, houseIds: ["h2", "h3"] },
    ],
  },
};

function artifact(id: string, houseId: string, extra: Partial<TestArtifact> = {}): TestArtifact {
  return {
    id,
    house_id: houseId,
    item_type: "claude_artifact",
    title: `Objekt ${id}`,
    description: null,
    tags: [],
    ...extra,
  };
}

const artifacts = [
  artifact("a", "h1", { title: "Biegung", tags: ["Balken"] }),
  artifact("b", "h1", { item_type: "github_repo", description: "Rechner für Lasten" }),
  artifact("c", "h2", { item_type: "gist" }),
  artifact("d", "z"),
];

function houseIds(result: ReturnType<typeof filterList<TestHouse, TestArtifact>>): string[][] {
  return result.sections.map((s) => s.houses.map((x) => x.house.id));
}

describe("filterList", () => {
  it("zeigt ohne Filter alle Häuser, Zentrale zuerst, auch Baustellen", () => {
    const result = filterList(model, artifacts, "", "");
    expect(result.sections.map((s) => s.title)).toEqual([
      "Zentrale",
      "Tragwerk & Bau",
      "Umwelt & Nachhaltigkeit",
    ]);
    expect(houseIds(result)).toEqual([["z"], ["h1"], ["h2", "h3"]]);
    expect(result.total).toBe(4);
    expect(result.filtering).toBe(false);
  });

  it("ordnet die Objekte ihrem Haus zu und behält ihre Reihenfolge", () => {
    const result = filterList(model, artifacts, "", "");
    const statikItems = result.sections[1].houses[0].items.map((a) => a.id);
    expect(statikItems).toEqual(["a", "b"]);
    expect(result.sections[2].houses[1].items).toEqual([]);
  });

  it("sucht in Titel, Beschreibung, Tags und Haustitel, ohne Gross-/Kleinschreibung", () => {
    expect(filterList(model, artifacts, "biegung", "").total).toBe(1);
    expect(filterList(model, artifacts, "LASTEN", "").total).toBe(1);
    expect(filterList(model, artifacts, "balken", "").total).toBe(1);
    expect(filterList(model, artifacts, "waldwege", "").total).toBe(1);
  });

  it("blendet bei aktiver Suche Häuser und Quartiere ohne Treffer aus", () => {
    const result = filterList(model, artifacts, "waldwege", "");
    expect(houseIds(result)).toEqual([["h2"]]);
    expect(result.sections.map((s) => s.key)).toEqual(["umwelt"]);
    expect(result.filtering).toBe(true);
  });

  it("filtert nach Objekttyp", () => {
    const result = filterList(model, artifacts, "", "github_repo");
    expect(houseIds(result)).toEqual([["h1"]]);
    expect(result.total).toBe(1);
    expect(result.filtering).toBe(true);
  });

  it("verknüpft Suche und Typ", () => {
    expect(filterList(model, artifacts, "biegung", "github_repo").total).toBe(0);
    expect(filterList(model, artifacts, "objekt", "gist").total).toBe(1);
  });

  it("behandelt eine Suche aus Leerzeichen wie keine Suche", () => {
    const result = filterList(model, artifacts, "   ", "");
    expect(result.filtering).toBe(false);
    expect(houseIds(result)).toEqual([["z"], ["h1"], ["h2", "h3"]]);
  });

  it("liefert ohne Treffer keine Abschnitte", () => {
    const result = filterList(model, artifacts, "gibt-es-nicht", "");
    expect(result.sections).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("lässt die Zentrale weg, wenn das Modell keine hat", () => {
    const ohneZentrale = { ...model, houses: [statik, wald, leer] };
    expect(houseIds(filterList(ohneZentrale, artifacts, "", ""))).toEqual([["h1"], ["h2", "h3"]]);
  });
});
