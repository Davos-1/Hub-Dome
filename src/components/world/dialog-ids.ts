/** Dialoge der Welt-Shell (Wert des URL-Parameters `d`). Eigene Datei, damit auch Server-Code sie nutzen kann. */
export const DIALOG_IDS = [
  "start",
  "reise",
  "einstellungen",
  "objekt",
  "objektedit",
  "haus",
  "hausedit",
] as const;
export type DialogId = (typeof DIALOG_IDS)[number];
