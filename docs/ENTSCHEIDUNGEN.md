# Entscheidungen und Lehren

Laufendes Log. Neueste Einträge unten. Format: Datum – Titel, Kontext, Entscheidung/Lehre, Grund.

## 2026-10-21 – Projektname und Struktur

- Projekt heisst **Hub Dome** (nicht «Campusdorf»). Repo: github.com/Davos-1/Hub-Dome. Projekt liegt direkt im Repo-Root.
- Skill-Ordner bleibt vorerst `skill/campusdorf-platzieren` gemäss PLAN.md; Umbenennung in Phase 5 klären.

## 2026-10-21 – Supabase

- Cloud-Projekt statt lokalem Stack (weder Supabase CLI noch Docker installiert). Migrationen als SQL-Dateien im Repo. Gian wird Schritt für Schritt angeleitet.

## 2026-10-21 – Git

- Gian erlaubt direktes Pushen auf `main` ohne Rückfrage pro Commit. Phasenfreigabe bleibt Pflicht.

## 2026-10-21 – Paketversionen (Phase 0)

- Next.js 16.4.2, React 19.3, R3F 9.8, drei 10.7, three 0.186, supabase-js 2.118, @supabase/ssr 0.12, zod 4.6, Tailwind 4.3, Vitest 5, Playwright 1.64, mcp-handler 2.3, @modelcontextprotocol/sdk 1.32.
- TypeScript bleibt auf 5.9 (von create-next-app gesetzt; 7.x nicht eingesetzt, da Next/ESLint-Kompatibilität ungeprüft).

## 2026-10-21 – Fehler/Lehre: Vitest vs. @types/node

- `npm i vitest` scheiterte (ERESOLVE): create-next-app setzt `@types/node@20`, Vitest 5 verlangt ≥22. Lösung: `@types/node@24` (passt zu Node 24 lokal).

## 2026-10-21 – Fehler/Lehre: .gitignore und .env.example

- create-next-app ignoriert `.env*`; `.env.example` braucht die Ausnahme `!.env.example`.

## 2026-10-21 – Modulkatalog

- Quelle: docs/referenz/DC-Curriculum-2026-27.pdf. Die Semesterzuordnung lässt sich aus dem PDF-Text nicht zuverlässig lesen (Grafik). Codes gibt es keine → selbst vergebene Kürzel, Semester vorerst leer, von Gian zu bestätigen (Phase 2).

## 2026-10-21 – Lehre: Zod-refine läuft auch bei ungültigem Format
- `z.url().refine(...)`: das refine läuft trotzdem und `new URL()` warf bei «kein-link». Lösung: `URL.parse()` (gibt null statt Exception).
- `next typegen` nötig, damit globale Typen wie `LayoutProps` für `tsc` existieren (sonst Typecheck-Fehler vor dem ersten Build).
- Prettier formatiert nur Code; `.prettierignore` schützt PLAN.md und docs.

## 2026-10-21 – Supabase-Keys umbenannt
- Neue Namen: Publishable key (`sb_publishable_…`) = früher anon, Secret key (`sb_secret_…`) = früher service_role. Env-Variable: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (statt ANON_KEY). `SUPABASE_SERVICE_ROLE_KEY` behält den Namen (enthält bei Gian einen alten JWT-Key, funktioniert).

## 2026-10-21 – Phase 2: Datenbank-Entscheidungen
- **Migration**: `supabase/migrations/20261021000000_init.sql`, wird von Gian im Supabase-SQL-Editor ausgeführt (kein CLI/Docker). Seed separat: `supabase/seed.sql`.
- **Onboarding per Funktion** `complete_onboarding(username, display_name)` (security definer): setzt Profil, legt Dorf und Zentrale an. Der Trigger legt nur einen Platzhalter an (`u_<12 hex>`, `onboarded=false`). Dorf-Insert/-Delete für Clients gesperrt.
- **Profil-Update**: Clients dürfen nur `display_name` und `avatar_seed` ändern (Column-Grant); `username`/`onboarded` nur via Funktion.
- **Zentrale** kann per RLS weder manuell angelegt noch gelöscht werden.
- **Einladungs-Hash**: `accept_invite(p_token)` hasht in der DB per SHA-256 ohne Pepper. Grund: Token hat 256 Bit Zufall, Pepper bringt nichts, und die DB kennt `TOKEN_PEPPER` nicht. Der Server hasht beim Erzeugen identisch (`hex(sha256(token))`). Pepper nur für MCP-Tokens (HMAC, Phase 5).
- **Keine Testuser im Seed**: RLS-Tests legen temporäre Nutzer per Admin-API an und löschen sie wieder (`npm run test:rls`, läuft gegen das echte Projekt).
- **Modulkatalog**: 43 Platzhalter-Module aus dem PDF, Semester leer.
- Shell-Lehre: Lange Dateien mit Sonderzeichen nicht per Bash-Heredoc schreiben, sondern mit dem Write-Tool (Heredoc scheiterte an Quoting).

## 2026-10-21 – RLS-Tests grün, offizieller Modulkatalog
- `npm run test:rls`: 20/20 Tests grün gegen das Supabase-Projekt (nach Einspielen von Migration 1 und Seed).
- Gian lieferte das Modulverzeichnis Jahrgang 24 (`docs/referenz/t curricula digital construction dcs 24.pdf`). Es ersetzt die Platzhalter: 129 Module mit **offiziellen Kürzeln** (z.B. `TA.BA_BAUSTATIK1`) als `code`, plus Typ (K/P/E/Z), Niveau (B/I/A), ECTS. Semester bleibt leer (nicht im Verzeichnis).
- Migration `20261021000100_module_catalog_details.sql` leert den Katalog und ergänzt die Spalten (nur möglich, solange noch keine Häuser existieren). `seed.sql` per Skript aus dem PDF erzeugt; Tippfehler korrigiert («Phyton», «Digtial»).
- Wiederkehrend: Änderungen am DB-Schema immer als **neue** Migrationsdatei, nie bestehende ändern (Gian spielt sie manuell ein, Reihenfolge = Dateiname).
