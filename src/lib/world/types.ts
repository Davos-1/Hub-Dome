import type { WorldDoc } from "./doc";

/** Welt eines Dorfs, wie `loadVillage` sie liefert (Seed, Generator-Version, Platzierungen). */
export type VillageWorld = {
  seed: string;
  version: number;
  doc: WorldDoc;
  /**
   * `false` = Ersatz ohne gespeicherte Zeile (Migration nicht eingespielt oder Zeile fehlt): Seed aus der
   * Dorf-ID, keine Platzierungen. Der Ersatz-Seed ist derselbe, den die Migration später einträgt.
   */
  stored: boolean;
};

/** Elemente, die die Regeln nicht annehmen; `grund` ist ein kurzer deutscher Satz. */
export type Abgewiesen = { id: string; grund: string }[];

/** Ergebnis von `saveWorld` (Server Action). */
export type SaveWorldResult = { ok: true } | { error: string; abgewiesen?: Abgewiesen };

/** Ergebnis von `rerollWorld`; `entfernt` = Anzahl Deko-Elemente, die mit `dropInvalid` entfernt wurden. */
export type RerollWorldResult =
  { ok: true; entfernt: number } | { error: string; abgewiesen?: Abgewiesen };

/** Welt-Aktionen als austauschbare Funktionen (echte Server Actions oder Attrappen der Entwickler-Vorschau). */
export type WorldActions = {
  save: (input: unknown) => Promise<SaveWorldResult>;
  reroll: (input: unknown) => Promise<RerollWorldResult>;
};
