import type { House } from "./types";

/**
 * Fachbereiche: Quartiere im Dorf, Haustyp und Farben pro Fachbereich.
 * Die Zuordnung läuft über den Modulcode; seit Phase 4h kann der Besitzer ein anderes Quartier wählen
 * (`houses.quarter_override`).
 */
export type FachType =
  "werkstatt" | "block" | "solar" | "atelier" | "stadt" | "haus" | "turm" | "digital";

export type FachbereichId =
  | "tragwerk"
  | "umwelt"
  | "gebaeude"
  | "projekt"
  | "wirtschaft"
  | "grundlagen"
  | "sprache"
  | "digital"
  | "weitere";

export type FachStyle = { type: FachType; wall: string; roof: string; accent: string };

export const FACHBEREICHE: Record<FachbereichId, { name: string; style: FachStyle }> = {
  tragwerk: {
    name: "Tragwerk & Bau",
    style: { type: "werkstatt", wall: "#e9dccb", roof: "#9c4a32", accent: "#b5523b" },
  },
  umwelt: {
    name: "Umwelt & Nachhaltigkeit",
    style: { type: "block", wall: "#9a6a42", roof: "#5f7a4a", accent: "#4f7d3f" },
  },
  gebaeude: {
    name: "Gebäude & Energie",
    style: { type: "solar", wall: "#eef0ec", roof: "#4b5d6e", accent: "#2f7d8c" },
  },
  projekt: {
    name: "Projekt & Prozess",
    style: { type: "atelier", wall: "#e8d6a6", roof: "#6f6355", accent: "#c08a2b" },
  },
  wirtschaft: {
    name: "Wirtschaft & Recht",
    style: { type: "stadt", wall: "#efe7dc", roof: "#5b4d63", accent: "#7a3b4a" },
  },
  grundlagen: {
    name: "Grundlagen",
    style: { type: "haus", wall: "#e4e9ef", roof: "#5f6f86", accent: "#3f5f8a" },
  },
  sprache: {
    name: "Sprache & Kommunikation",
    style: { type: "turm", wall: "#efe6d8", roof: "#3f7a74", accent: "#2f8a7d" },
  },
  digital: {
    name: "Digital & Daten",
    style: { type: "digital", wall: "#e6e4ee", roof: "#3d3a4f", accent: "#6b4fd8" },
  },
  weitere: {
    name: "Weitere",
    style: { type: "haus", wall: "#ece8e0", roof: "#7a746a", accent: "#6d6a63" },
  },
};

/** Reihenfolge der Fachbereiche im Dorf (und in Filtern). */
export const FACH_ORDER: FachbereichId[] = [
  "tragwerk",
  "umwelt",
  "gebaeude",
  "projekt",
  "wirtschaft",
  "grundlagen",
  "sprache",
  "digital",
  "weitere",
];

const CODES: Record<Exclude<FachbereichId, "weitere">, string[]> = {
  tragwerk: [
    "BAUSTATIK1",
    "BAUSTATIK2",
    "BS",
    "TRL1",
    "TRL2",
    "BETON_STAHL1",
    "HB2_MM",
    "LABO",
    "BEST",
    "IP",
    "CAMPUS",
  ],
  umwelt: ["NABA", "OEK", "OEK_PWG", "SUSC_ISA"],
  gebaeude: [
    "B_GT_MM",
    "BAUKLI_MM",
    "GH_ENERGIE",
    "GT_SYS",
    "GA",
    "HLKS_ENG1",
    "HLKS_ENG2",
    "HLKS_ENG3",
    "HLKS_ENG4",
    "GE_ENG1",
    "GE_ENG2",
    "GE_ENG3",
    "EEVS",
    "ET",
    "ET2",
    "EPO",
    "DT",
    "LAB_EE",
    "GEB_SYS_ISA",
  ],
  projekt: [
    "DC_STUD1",
    "DC_STUD2",
    "DC_STUD3",
    "DC_STUD4",
    "AT_TEAM",
    "BAA_DC",
    "FEI",
    "INNO_PA",
    "B_IW",
    "INTPRO",
    "PRAX_VTZ_DCS",
    "PRAX_DCS_3",
    "PRAX_DCS_6",
    "WISSARB",
    "DC_COLLAB_MM",
    "DC_METH",
    "INTDE",
    "DC_BRIDGE",
    "DC_SR1",
    "INDES1_MM",
    "INDES2_MM",
    "SOCIAL_DCS",
    "OPEN_ISA",
  ],
  wirtschaft: [
    "BRE",
    "MG",
    "EPRS",
    "LEAD",
    "BW+ING",
    "BUSI+ENG",
    "BIZCON",
    "VWL",
    "VWL2",
    "GDF",
    "DIGITRANS",
    "I40_BAS",
  ],
  grundlagen: [
    "MATH1A",
    "MATH2A",
    "MATH3A",
    "PHYSIK1A_MM",
    "PHYSIK2A",
    "LINALG_MM",
    "STOC_MM",
    "OPTIK",
    "PRZ",
    "NANOTECH",
    "DESG",
    "TE+GE_ISA",
    "AFU",
    "TUT",
  ],
  sprache: [
    "LIDE+EG_ISA",
    "EBUSI_SZ",
    "PROF_SZ",
    "PEAK",
    "ECONS",
    "FCE_SZ",
    "EEXP",
    "CAE_SZ",
    "EBP",
    "DEFRC1_1_SZ",
    "DEFRC1_2_SZ",
    "SP1",
    "SP2",
    "SELL",
    "GFK_ISA",
    "KOHEB",
    "SWISS_ISA",
    "AS_ISA",
  ],
  digital: [
    "DT_GRND_MM",
    "DT_PARAM",
    "DT_PROGR",
    "DT_DESIGN",
    "DT_CONST",
    "DT_BETR_LIFE",
    "DATA1_MM",
    "DATA2_MM",
    "DATA3_MM",
    "PYTHON_MM",
    "PYTHON_AD",
    "APROG_MM",
    "APP_MM",
    "PRGC_MM",
    "ML_MM",
    "ADML_MM",
    "BDM",
    "DVIZ_MM",
    "STAT_MM",
    "MO_SIM1_MM",
    "MO_SIM2_MM",
    "USAB",
    "MTIV",
    "DC_GRND1_MM",
    "DC_GRND2_MM",
    "DC_TECH_MM",
    "DDT",
    "IMM_TECH",
  ],
};

const FACH_BY_CODE = new Map<string, FachbereichId>();
for (const [id, codes] of Object.entries(CODES)) {
  for (const c of codes) FACH_BY_CODE.set(c, id as FachbereichId);
}

/** «TA.BA_BRE» → «BRE», «TA.MAA_SUSC_ISA» → «SUSC_ISA». */
export function normalizeModuleCode(code: string): string {
  const afterDot = code.includes(".") ? code.slice(code.indexOf(".") + 1) : code;
  return afterDot.replace(/^(BA|MAA)_/, "");
}

export const FACH_IDS = Object.keys(FACHBEREICHE) as FachbereichId[];

export const isFachId = (v: unknown): v is FachbereichId =>
  typeof v === "string" && (FACH_IDS as string[]).includes(v);

/**
 * Fachbereich (Quartier) eines Hauses: gewähltes Quartier (`quarter_override`), sonst aus dem Modulcode;
 * Themenhäuser und unbekannte Codes → «weitere». Die Zentrale gehört zu keinem Quartier.
 */
export function fachbereichOf(
  house: Pick<House, "kind" | "module_code"> & { quarter_override?: string | null },
): FachbereichId {
  if (house.kind !== "zentrale" && isFachId(house.quarter_override)) return house.quarter_override;
  if (house.kind !== "modul" || !house.module_code) return "weitere";
  return FACH_BY_CODE.get(normalizeModuleCode(house.module_code)) ?? "weitere";
}

/** Kurzes Kürzel für Beschriftungen (z.B. «BAUSTATIK1»), für Themenhäuser die ersten Buchstaben. */
export function houseShortCode(house: Pick<House, "kind" | "module_code" | "title">): string {
  if (house.kind === "modul" && house.module_code) return normalizeModuleCode(house.module_code);
  return house.title.slice(0, 4).toUpperCase();
}

/** FNV-1a-Hash für deterministische Variation pro Id. */
export function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stil eines Hauses; die Wandfarbe variiert pro Haus um den Faktor 0.90–1.09. */
export function houseFachStyle(
  house: Pick<House, "id" | "kind" | "module_code" | "quarter_override">,
): FachStyle & {
  fach: FachbereichId;
} {
  const fach = fachbereichOf(house);
  const base = FACHBEREICHE[fach].style;
  const f = 0.9 + (fnv(house.id) % 20) / 100;
  return { ...base, wall: scaleHex(base.wall, f), fach };
}

function scaleHex(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.min(255, Math.round(((n >> shift) & 255) * f));
  return "#" + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("");
}
