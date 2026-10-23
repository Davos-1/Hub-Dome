/**
 * Deko-Katalog: was der Besitzer selbst setzen kann. Jedes Element hat eine Grundfläche (lokal, vor der
 * Drehung), eine Gruppe für die Bau-Leiste und Regeln (darf auf Plätze, ist hoch und könnte Häuser verdecken,
 * gehört ans Wasser).
 */

export const DEKO_TYPEN = [
  "bank",
  "picknick",
  "laterne",
  "blumenbeet",
  "hochbeet",
  "zaun",
  "brunnen",
  "laubbaum",
  "nadelbaum",
  "obstbaum",
  "busch",
  "findling",
  "feuerstelle",
  "steg",
] as const;
export type DekoTyp = (typeof DEKO_TYPEN)[number];

export type DekoGruppe = "sitzen" | "licht" | "garten" | "natur" | "wasser";

export const DEKO_GRUPPEN: Record<DekoGruppe, string> = {
  sitzen: "Sitzen",
  licht: "Licht",
  garten: "Garten",
  natur: "Natur",
  wasser: "Wasser",
};

export type DekoForm = { kind: "circle"; r: number } | { kind: "box"; hw: number; hd: number };

export type DekoEintrag = {
  label: string;
  gruppe: DekoGruppe;
  form: DekoForm;
  /** Darf auf Dorf- und Quartierplätze. */
  aufPlatz: boolean;
  /** Hoch (Bäume): hält Abstand vor Hausfronten, damit nichts verdeckt wird. */
  hoch: boolean;
  /** Gehört ans Wasser (Steg). */
  wasser?: boolean;
  /** Kurzer Hinweis für die Bau-Leiste. */
  hinweis: string;
};

export const DEKO: Record<DekoTyp, DekoEintrag> = {
  bank: {
    label: "Bank",
    gruppe: "sitzen",
    form: { kind: "box", hw: 0.65, hd: 0.3 },
    aufPlatz: true,
    hoch: false,
    hinweis: "Auf Wiese oder Platz.",
  },
  picknick: {
    label: "Picknicktisch",
    gruppe: "sitzen",
    form: { kind: "box", hw: 0.95, hd: 0.85 },
    aufPlatz: true,
    hoch: false,
    hinweis: "Tisch mit zwei Bänken.",
  },
  laterne: {
    label: "Laterne",
    gruppe: "licht",
    form: { kind: "circle", r: 0.25 },
    aufPlatz: true,
    hoch: false,
    hinweis: "Leuchtet am Abend und in der Nacht.",
  },
  blumenbeet: {
    label: "Blumenbeet",
    gruppe: "garten",
    form: { kind: "box", hw: 0.9, hd: 0.6 },
    aufPlatz: false,
    hoch: false,
    hinweis: "Blüht in den Farben der Stimmung.",
  },
  hochbeet: {
    label: "Hochbeet",
    gruppe: "garten",
    form: { kind: "box", hw: 0.8, hd: 0.45 },
    aufPlatz: false,
    hoch: false,
    hinweis: "Mit Gemüse.",
  },
  zaun: {
    label: "Zaun",
    gruppe: "garten",
    form: { kind: "box", hw: 1.0, hd: 0.1 },
    aufPlatz: false,
    hoch: false,
    hinweis: "Zwei Meter Holzzaun.",
  },
  brunnen: {
    label: "Brunnen",
    gruppe: "wasser",
    form: { kind: "circle", r: 0.95 },
    aufPlatz: true,
    hoch: false,
    hinweis: "Kleiner Brunnen, plätschert.",
  },
  laubbaum: {
    label: "Laubbaum",
    gruppe: "natur",
    form: { kind: "circle", r: 1.3 },
    aufPlatz: false,
    hoch: true,
    hinweis: "Nicht direkt vor Häusern.",
  },
  nadelbaum: {
    label: "Nadelbaum",
    gruppe: "natur",
    form: { kind: "circle", r: 1.0 },
    aufPlatz: false,
    hoch: true,
    hinweis: "Nicht direkt vor Häusern.",
  },
  obstbaum: {
    label: "Obstbaum",
    gruppe: "natur",
    form: { kind: "circle", r: 1.1 },
    aufPlatz: false,
    hoch: true,
    hinweis: "Trägt Früchte.",
  },
  busch: {
    label: "Busch",
    gruppe: "natur",
    form: { kind: "circle", r: 0.6 },
    aufPlatz: false,
    hoch: false,
    hinweis: "Rund und dicht.",
  },
  findling: {
    label: "Findling",
    gruppe: "natur",
    form: { kind: "circle", r: 0.6 },
    aufPlatz: false,
    hoch: false,
    hinweis: "Grosser Stein.",
  },
  feuerstelle: {
    label: "Feuerstelle",
    gruppe: "sitzen",
    form: { kind: "circle", r: 1.0 },
    aufPlatz: false,
    hoch: false,
    hinweis: "Mit Steinkreis und Holzbänken.",
  },
  steg: {
    label: "Steg",
    gruppe: "wasser",
    form: { kind: "box", hw: 0.6, hd: 2.0 },
    aufPlatz: false,
    hoch: false,
    wasser: true,
    hinweis: "Rastet am Ufer ein und zeigt aufs Wasser.",
  },
};

/** Höchstens so viele eigene Deko-Elemente pro Dorf. */
export const MAX_DEKO = 120;
