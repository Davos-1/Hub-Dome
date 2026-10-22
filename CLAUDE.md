# Hub Dome – Regeln für Claude Code

- **Reihenfolge und Stand: docs/PHASENPLAN.md (verbindlich).** Als Nächstes: 4e (Lücken aus 4d schliessen: Migrationen, Freundschaftslink, Listen-Dialog, Commit), dann 5 → 5b Übernehmen → 6 Pilot → 6b Topdorf. Phase 5 startet erst, wenn der Link-Test aus Phase 0 (macht Gian) erledigt ist. Details: PLAN.md, PLAN-ERWEITERUNG.md (8 und 9 erst nach dem Pilot), PLAN-ERWEITERUNG-2.md. Phasen der Reihe nach, nach jeder Phase stoppen und zusammenfassen.
- **Fokus bis zum Pilot:** keine neuen 3D-Gestaltungsfunktionen. Erlaubt sind Fehlerbehebungen, Performance, Barrierefreiheit und funktionale Kennzeichnungen, die eine Phase verlangt.
- **Entscheidungslog: docs/ENTSCHEIDUNGEN.md.** Zu Beginn jeder Sitzung lesen. Wichtige Entscheidungen, Fehler und Lehren sofort dort ergänzen (Datum, Kontext, Entscheidung, Grund).
- UI-Texte Deutsch, Schweizer Schreibweise (kein ß).
- Jede neue Tabelle braucht RLS und Tests dazu.
- Service-Role-Key nur serverseitig. Jede Server-Query mit Service Role filtert explizit nach owner_id.
- Eingaben immer mit Zod validieren.
- Vor dem Einsatz eines Pakets die aktuelle Doku prüfen, keine veralteten APIs raten. Next.js 16: Hinweise in AGENTS.md beachten.
- Ordnerstruktur wie in PLAN.md Abschnitt 4 (Projekt liegt direkt im Repo-Root). Tests: Unit neben dem Code (`*.test.ts`), E2E in `tests/e2e`.
- Vor jedem Commit: `npm run check`. Kein Secret im Repo.
- Bei Unklarheit nachfragen statt annehmen.
