/** Tageszeit-Presets der 3D-Ansicht (Himmel, Sonne, Licht, Leuchtkraft der Fenster). */

export type TimeKey = "morgen" | "mittag" | "abend" | "nacht";
export type TimeSetting = TimeKey | "auto";

export const TIME_LABELS: Record<TimeSetting, string> = {
  morgen: "Morgen",
  mittag: "Mittag",
  abend: "Abend",
  nacht: "Nacht",
  auto: "Auto",
};

/** Farbpunkt im Knopf der Leiste. */
export const TIME_DOTS: Record<TimeSetting, string> = {
  morgen: "#f6c48f",
  mittag: "#f8d34a",
  abend: "#7a6190",
  nacht: "#2b3566",
  auto: "#9aa2aa",
};

export type TimePreset = {
  /** Himmel oben / Mitte / unten (= Nebel). */
  sky: [string, string, string];
  sun: string;
  sunIntensity: number;
  /** Sonnenposition als Vielfaches von `extent`. */
  sunPosition: [number, number, number];
  hemi: { sky: string; ground: string; intensity: number };
  /** Leuchtstärke von Fenstern und Laternen. */
  glow: number;
  exposure: number;
};

export const TIMES: Record<TimeKey, TimePreset> = {
  morgen: {
    sky: ["#8fb6e0", "#f2d4b8", "#f8e6d4"],
    sun: "#ffd2a1",
    sunIntensity: 1.7,
    sunPosition: [-0.9, 0.5, 0.7],
    hemi: { sky: "#ffe9d6", ground: "#7f9a6a", intensity: 0.85 },
    glow: 0.7,
    exposure: 1.0,
  },
  mittag: {
    sky: ["#6fb1ec", "#b9dcf7", "#e8f3fb"],
    sun: "#fff3dc",
    sunIntensity: 2.1,
    sunPosition: [0.7, 1.2, 0.9],
    hemi: { sky: "#fff7ea", ground: "#7fa56a", intensity: 1.0 },
    glow: 0.85,
    exposure: 1.0,
  },
  abend: {
    sky: ["#24335e", "#7a6190", "#eaa676"],
    sun: "#ffa765",
    sunIntensity: 1.5,
    sunPosition: [0.95, 0.38, 0.55],
    hemi: { sky: "#a3a9d6", ground: "#5a6a52", intensity: 1.05 },
    glow: 2.6,
    exposure: 1.08,
  },
  nacht: {
    sky: ["#08112b", "#1a2a55", "#33457a"],
    // Mondlicht: kühl, hell genug, dass Häuser und Wege lesbar bleiben
    sun: "#c4d3ff",
    sunIntensity: 1.05,
    sunPosition: [-0.6, 0.9, -0.5],
    hemi: { sky: "#6f82c8", ground: "#2a3a34", intensity: 0.85 },
    glow: 3.4,
    exposure: 1.3,
  },
};

/** Auto: Morgen 5–10 Uhr, Mittag 10–18 Uhr, Abend 18–22 Uhr, sonst Nacht. */
export function timeKeyForHour(hour: number): TimeKey {
  if (hour >= 5 && hour < 10) return "morgen";
  if (hour >= 10 && hour < 18) return "mittag";
  if (hour >= 18 && hour < 22) return "abend";
  return "nacht";
}

/** Leuchten Laternen und Fenster (Abend, Nacht)? */
export const isDark = (t: TimeKey) => t === "abend" || t === "nacht";

const ZURICH_HOUR = new Intl.DateTimeFormat("de-CH", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "Europe/Zurich",
});

/** Stunde (0–23) in Zürich: «Auto» folgt der Uhrzeit dort, nicht der des Geräts (Phase 4h). */
export function zurichHour(date: Date = new Date()): number {
  // formatToParts: «de-CH» schreibt «14 Uhr»
  const h = Number(ZURICH_HOUR.formatToParts(date).find((p) => p.type === "hour")?.value);
  return Number.isFinite(h) ? h % 24 : date.getHours();
}

export function resolveTime(setting: TimeSetting, hour: number): TimeKey {
  return setting === "auto" ? timeKeyForHour(hour) : setting;
}
