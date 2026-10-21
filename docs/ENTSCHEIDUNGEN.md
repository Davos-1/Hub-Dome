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

## 2026-10-21 – Phase 2: Auth-Umsetzung und Next-16-Lehren
- Next 16: `middleware.ts` heisst jetzt **`src/proxy.ts`** (Funktion `proxy`). Er erneuert nur die Session und leitet Nicht-Eingeloggte auf `/login` um; der eigentliche Schutz (Onboarding-Pflicht, Daten) liegt in `requireProfile()` (`src/lib/auth.ts`) und in RLS. Öffentliche Pfade: `/`, `/login`, `/auth/*`, `/api/mcp/*`.
- **Cache Components ist aktiv** (`cacheComponents: true`). Regel: Zugriff auf `cookies()`, `searchParams`, `params` nur innerhalb von `<Suspense>`. Muster: Seite = dünne Hülle mit `<Suspense>`, Inhalt in `async function XContent()`.
- `PageProps<"/route">` und `LayoutProps` sind globale Typen; nach neuen Routen `npx next typegen` ausführen, sonst schlägt `tsc` fehl.
- Login: Magic Link (PKCE, `/auth/callback` tauscht Code gegen Session; Link muss im selben Browser geöffnet werden). Google-Button nur sichtbar mit `NEXT_PUBLIC_GOOGLE_LOGIN=true` (noch nicht eingerichtet).
- Onboarding: Route `/onboarding` (nicht unter `/doerfer`), Server Action ruft `complete_onboarding` per RPC.
- `safeNextPath` verhindert Open Redirects im `next`-Parameter.
- Lehre (Shell): Backslashes in Bash-Heredocs gehen verloren (`"/\evil"` wurde `"/evil"`) → Tests/Code mit Backslashes mit dem Write/Edit-Tool schreiben.

## 2026-10-21 – Lehre: Date.now()-Fehler "Blocking Route" im Dev-Overlay
- Supabase-Auth (`getUser`) nutzt intern die aktuelle Zeit; mit Cache Components meldet Next im Dev-Overlay «unstable value Date.now() while prerendering», auch innerhalb von `<Suspense>`. Lösung: `await connection()` (aus `next/server`) am Anfang jeder Server-Komponente/Funktion, die Auth nutzt (`requireProfile`, Onboarding-Seite). Neue auth-abhängige Seiten immer über `requireProfile()` bauen.
- Magic-Link-Login und Onboarding von Gian erfolgreich getestet.

## 2026-10-21 – Lehre: PostgREST-Embed `profiles` ist bei villages mehrdeutig
- `villages` → `profiles` hat zwei Wege (FK `owner_id` und many-to-many über `village_access`). `owner:profiles(...)` liefert Fehler PGRST201 und `data = null` (still!). Immer `profiles!villages_owner_id_fkey(...)` verwenden. Bei Embeds immer `error` mitprüfen, sonst sieht man leere Listen statt Fehler.
- E2E: Hausabschnitte per `getByRole("region", {name, exact:true})` finden (Textfilter trifft sonst auch Select-Optionen anderer Häuser). `<details>` bleibt nach Speichern offen.
- E2E-Login: Session-Cookies mit `@supabase/ssr` im Test erzeugen (`tests/e2e/helpers.ts: loginAs`), kein UI-Login nötig.

## 2026-10-21 – Phase 3: Struktur und Entscheidungen
- Mutationen als Server Actions: `src/app/dorf/actions.ts` (Häuser/Artifacts), `src/app/einstellungen/actions.ts` (Einladungen, Zugriff, Name), `src/app/einladung/[token]/actions.ts`, `src/app/doerfer/actions.ts` (Abmelden, Dorf verlassen). Alle: Zod-Validierung, RLS-Client des Users, zusätzlich explizites `owner_id`-Filtern, danach `revalidatePath("/", "layout")`.
- Gemeinsame UI: `src/components/ui/` (ActionForm mit useActionState, AppHeader, CopyField); listenspezifisch `src/components/list/`; `src/components/village/` bleibt für 3D (Phase 4). Typen/Konstanten in `src/lib/types.ts`.
- `/dorf/[username]` leitet vorerst auf `/dorf/[username]/liste` um (3D folgt in Phase 4). Nicht erreichbare Dörfer geben 404 (verrät nicht, ob ein Dorf existiert).
- Einladungslink: nur einmal sichtbar (nach Erstellen), 7 Tage, 1–100 Nutzungen; Annehmen per Button (nicht per GET, wegen Link-Vorschau-Bots). Login-Redirect behält `next`.
- Haus löschen löscht Artifacts mit (Bestätigung nennt die Anzahl); Verschieben geht über das Bearbeiten des Artifacts (Haus wählen).
- Bekannte Einschränkung: Neue Nutzer, die über einen Einladungslink kommen, landen nach dem Onboarding auf «Meine Dörfer» und müssen den Link erneut öffnen.
- E2E-Abnahme `tests/e2e/freigabe.spec.ts` grün (A teilt, B sieht ausser private, Entzug).

## 2026-10-21 – PLAN-ERWEITERUNG.md (Objekttypen)
- Gian hat `PLAN-ERWEITERUNG.md` ergänzt: **Phase 3b** (Objekttypen: github_repo, gist, cloud_ordner, link, …) kommt nach der Abnahme von Phase 3 und **vor** Phase 4; Phase 8 (Uploads) und 9 (Pakete) erst nach dem Pilot. UI-Begriff «Objekte» statt «Artifacts»; Tabelle bleibt `artifacts`. Vor Phase 3b: Constraint-Namen der URL-Prüfung in der DB nachschlagen.
