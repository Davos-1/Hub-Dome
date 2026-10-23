# Hub Dome – Regeln für Claude Code

- **Reihenfolge und Stand: docs/PHASENPLAN.md (verbindlich).** Fertig: 4e, 5, 5b und der Code von 6. Aktuell: **4f** (Welt auf das nächste Level, Konzept `docs/PHASE-4F-KONZEPT.md`, Anleitung `docs/WELT-ANLEITUNG.md`; Code fertig, offen: Migration `village_worlds` einspielen und RLS-/DB-Tests bei Gian), danach 6 Pilot (Deploy, Dashboards) → 6b Topdorf. Details: PLAN.md, PLAN-ERWEITERUNG.md (8 und 9 erst nach dem Pilot), PLAN-ERWEITERUNG-2.md. Phasen der Reihe nach, nach jeder Phase stoppen und zusammenfassen.
- **Fokusregel für Phase 4f aufgehoben** (Entscheid Gian, 2026-10-23): neue 3D-Gestaltungsfunktionen sind in 4f erlaubt. Oberste Regel dabei: keine «komische» Welt (nichts durchdringt sich, schwebt, steht schief, auf Wegen/Wasser oder ausserhalb der Karte); Platzierungsregeln liegen in reinen Funktionen (`src/lib/world/`) mit Property-Tests. Nach 4f gilt wieder: bis zum Pilot-Feedback nur Fehlerbehebungen, Performance, Barrierefreiheit.
- **Entscheidungslog: docs/ENTSCHEIDUNGEN.md.** Zu Beginn jeder Sitzung lesen. Wichtige Entscheidungen, Fehler und Lehren sofort dort ergänzen (Datum, Kontext, Entscheidung, Grund).
- UI-Texte Deutsch, Schweizer Schreibweise (kein ß).
- Jede neue Tabelle braucht RLS und Tests dazu.
- Service-Role-Key nur serverseitig. Jede Server-Query mit Service Role filtert explizit nach owner_id.
- Eingaben immer mit Zod validieren.
- Vor dem Einsatz eines Pakets die aktuelle Doku prüfen, keine veralteten APIs raten. Next.js 16: Hinweise in AGENTS.md beachten.
- Ordnerstruktur wie in PLAN.md Abschnitt 4 (Projekt liegt direkt im Repo-Root). Tests: Unit neben dem Code (`*.test.ts`), E2E in `tests/e2e`.
- Vor jedem Commit: `npm run check`. Kein Secret im Repo.
- Bei Unklarheit nachfragen statt annehmen.
