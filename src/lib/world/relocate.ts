import type { FachbereichId } from "../fachbereiche";
import type { WorldDoc } from "./doc";
import type { World } from "./generate";
import { pinsFromSettlement } from "./settlement";

/**
 * «Quartier umziehen» (Phase 4h, Haus bearbeiten): Alle anderen Häuser und Quartiere werden an ihrem heutigen
 * Platz fixiert, das umziehende Haus verliert seine Fixierung und sucht sich im Zielquartier einen freien Platz
 * (dieselben Regeln wie ein neues Haus). Die Gasse des alten Quartiers bleibt nur fixiert, solange dort noch
 * andere Häuser stehen. Reine Funktion: Browser (Vorschau) und Server (Speichern) rechnen gleich.
 *
 * `current` ist die Welt vor dem Umzug, `doc` das gespeicherte Dokument (Deko, Varianten bleiben).
 */
export function relocateDoc(current: World, doc: WorldDoc, houseId: string): WorldDoc {
  const pins = pinsFromSettlement(current.settlement);
  delete pins.haeuser[houseId];
  const remaining = new Set<FachbereichId>();
  for (const h of Object.values(current.settlement.houses)) {
    if (h.id !== houseId) remaining.add(h.quarterId);
  }
  const quartiere = Object.fromEntries(
    Object.entries(pins.quartiere).filter(([q]) => remaining.has(q as FachbereichId)),
  ) as typeof pins.quartiere;
  // Der Eckpunkt gehört zum alten Weg (wie beim Versetzen im Bau-Modus)
  const roadBends = { ...(doc.roadBends ?? {}) };
  delete roadBends[houseId];
  const out: WorldDoc = { ...doc, quartiere, haeuser: pins.haeuser, roadBends };
  if (!Object.keys(roadBends).length) delete out.roadBends;
  return out;
}

/** Ergebnis eines Umzugs: wo das Haus jetzt steht bzw. warum es nicht geht. */
export function relocationResult(
  after: World,
  houseId: string,
  to: FachbereichId,
): { ok: true } | { ok: false; grund: string } {
  const h = after.settlement.houses[houseId];
  if (!h || after.settlement.unplaced.includes(houseId))
    return { ok: false, grund: "Im gewählten Quartier ist gerade kein Platz frei." };
  if (h.quarterId !== to)
    return { ok: false, grund: "Das Haus passt nicht ins gewählte Quartier." };
  if (after.settlement.droppedPins.length)
    return { ok: false, grund: "Andere Häuser müssten dafür verschoben werden." };
  return { ok: true };
}
