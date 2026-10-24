# Hub Dome – Regeln für Claude Code

- **Reihenfolge und Stand: docs/PHASENPLAN.md (verbindlich).** Fertig: 4e, 5, 5b und der Code von 6. 4f (Welt, `docs/PHASE-4F-KONZEPT.md`) und der Code von 4g (Feinschliff, `docs/PHASE-4G-KONZEPT.md`, Anleitung `docs/WELT-ANLEITUNG.md`, Oberfläche damals «Rauchglas») sind fertig. Der Code von **4h** (Oberfläche «Werkbank», Generator v3 mit Wegformen; `docs/PHASE-4H-KONZEPT.md`, Plan und Prototyp in `docs/design_handoff_4h/`) ist fertig. Offen für 4g/4h: Migrationen `20261023000200_world_v2_default.sql`, `20261024000100_quarter_override.sql`, `20261024000200_time_mode.sql`, `20261024000300_world_v3_default.sql` einspielen, danach RLS-Tests und DB-E2E laufen lassen. Danach 6 Pilot (Deploy, Dashboards) → 6b Topdorf. Details: PLAN.md, PLAN-ERWEITERUNG.md (8 und 9 erst nach dem Pilot), PLAN-ERWEITERUNG-2.md. Phasen der Reihe nach, nach jeder Phase stoppen und zusammenfassen.
- **Fokusregel:** In 4f, 4g und 4h war sie aufgehoben (Entscheide Gian, 2026-10-23 und 2026-10-24); **jetzt gilt sie wieder**: bis zum Pilot-Feedback nur Fehlerbehebungen, Performance, Barrierefreiheit. Für Änderungen an der Welt gilt weiterhin als oberste Regel: keine «komische» Welt (nichts durchdringt sich, schwebt, steht schief, auf Wegen/Wasser oder ausserhalb der Karte); Platzierungsregeln liegen in reinen Funktionen (`src/lib/world/`) mit Property-Tests. Layout- und Regeländerungen nur als neue Generator-Version (v1 und v2 bleiben eingefroren, Golden-Tests; aktuell v3).
- **Entscheidungslog: docs/ENTSCHEIDUNGEN.md.** Zu Beginn jeder Sitzung lesen. Wichtige Entscheidungen, Fehler und Lehren sofort dort ergänzen (Datum, Kontext, Entscheidung, Grund).
- UI-Texte Deutsch, Schweizer Schreibweise (kein ß).
- UI-Farben, Radien und Schatten nur über die Design-Tokens (`--hd-*` in `src/app/globals.css`, Tailwind `bg-hd-surface`, `text-hd-ink` …); keine harten Farbwerte in Komponenten (Datenfarben wie Quartier- oder Objektfarben ausgenommen). Kontrasttest `src/app/theme-contrast.test.ts`.
- Jede neue Tabelle braucht RLS und Tests dazu.
- Service-Role-Key nur serverseitig. Jede Server-Query mit Service Role filtert explizit nach owner_id.
- Eingaben immer mit Zod validieren.
- Vor dem Einsatz eines Pakets die aktuelle Doku prüfen, keine veralteten APIs raten. Next.js 16: Hinweise in AGENTS.md beachten.
- Ordnerstruktur wie in PLAN.md Abschnitt 4 (Projekt liegt direkt im Repo-Root). Tests: Unit neben dem Code (`*.test.ts`), E2E in `tests/e2e`.
- Vor jedem Commit: `npm run check`. Kein Secret im Repo.
- Bei Unklarheit nachfragen statt annehmen.
