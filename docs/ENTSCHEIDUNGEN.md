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

## 2026-10-21 – Phase 3b: Objekttypen (abgenommen bis auf MCP)
- Migration `20261021000200_item_types.sql` eingespielt (Constraint-Name wird per `pg_constraint` gesucht, nicht geraten). RLS-Tests 22/22, E2E 5/5 (inkl. GitHub-Vorschau gegen echte API und 24-h-Cache).
- Typerkennung/Validierung: `src/lib/item-types.ts` (spiegelt die DB-Prüfung `artifacts_url_by_type`). Vorschau-Logik: `src/lib/previews.ts` (rein, testbar mit injiziertem fetch) und `previews.server.ts` (Service Role, immer mit `owner_id`-Filter). Aktualisierung per `after()` nach Anlegen/Ändern und beim Öffnen durch den Besitzer (max. 5 pro Aufruf, nur wenn >24 h alt). Viewer lösen nie Abrufe aus.
- README: `react-markdown` + `remark-gfm`, kein rohes HTML, Bilder nur als Text (kein Tracking), Links `noopener noreferrer nofollow`. Code: `highlight.js` (Kernmodul mit 10 Sprachen).
- Gist/Repo nicht erreichbar → `{unavailable:true}`; eine frühere Vorschau bleibt erhalten. Rate-Limit → kein Speichern, späterer neuer Versuch.
- **Offen für Phase 5 (MCP):** `artifact_platzieren` mit optionalem `objekt_typ` (sonst Auto-Erkennung via `detectItemType`), neues Tool `objekt_platzieren` (Alias), Skill-Vorlage um GitHub-Repo/Gist erweitern, Test «neues Tool platziert GitHub-Repo».
- **Offen vor Phase 6:** Eigener SMTP-Dienst (z.B. Resend) für Auth-Mails; der eingebaute Supabase-Mailserver hat ein sehr tiefes Stundenlimit (zweiter Testaccount erhielt keine Mail). Außerdem Google-OAuth-App «veröffentlichen» oder Testnutzer eintragen.

## 2026-10-21 – Phase 4: 3D-Dorf
- **Struktur:** `src/lib/layout.ts` (deterministisch, getestet: Ringe 7/12/18/24 Plätze, Radien 12/22/32/42, Hausgrösse-Stufen 0–2/3–6/7+, Objekt-Slots als Bögen vor dem Haus). `src/lib/village-data.ts` = gemeinsamer Lader für 3D- und 2D-Seite. `src/components/village/`: `village-view` (Zustand, Panel, Media-Queries), `village-scene` (Canvas), `buildings`, `artifact-3d` (Form pro Objekttyp), `decor` (Boden, Wege, Bäume als InstancedMesh), `camera-rig` (Kamerafahrt, Pan-Begrenzung), `label3d`, `village-panel`.
- **Routen:** `/dorf/[username]` = 3D, `/dorf/[username]/liste` = 2D (Link in beide Richtungen immer sichtbar). «Meine Dörfer» und angenommene Einladungen führen in die 3D-Ansicht.
- **Keine DOM-Overlays im Canvas:** drei `Html` verursachte beim Verlassen der Seite `removeChild`-Fehler (React 19). Beschriftungen sind stattdessen Sprites mit Canvas-Textur (`label3d.tsx`, Systemschrift, kein Font-Download).
- **Performance:** `frameloop="demand"`, geteilte Geometrien, Instancing für Bäume/Wege. Gemessen (Headless-Chromium, 10 Häuser + 60 Objekte): ~190–255 Draw Calls, ~5k Dreiecke. Echte fps muss Gian auf seinem Laptop bestätigen. Mobile/Touch (`pointer: coarse` oder <768 px): dpr ≤1.25, kein Antialiasing, 14 statt 42 Bäume.
- **Barrierefreiheit:** Seitenpanel mit echten Buttons (alle Häuser/Objekte per Tastatur erreichbar), Esc = eine Ebene zurück, `prefers-reduced-motion` → Kamera springt, Dämpfung aus.
- **Vorschauen im Panel:** README/Gist-Code werden serverseitig als `ObjectPreview` gerendert und als ReactNode an das Client-Panel übergeben.
- **Test-Hook:** `window.__hubDome` (Draw Calls/Dreiecke der letzten Frame) für E2E-Performanztests.
- **Lehre (Tests):** In Template-Literalen für RegExp `\b` schreiben (`\b` = Backspace). Gerenderte Szene im Test per Screenshot prüfen (`test-results/dorf3d-*.png`).
- **Bekannt/offen:** Objekte direkt vor der Haustür überdecken diese teilweise (Slot-Bogen). THREE.Clock-Deprecation-Warnung stammt aus R3F, nicht von uns.

## 2026-10-21 – Feedback Gian nach Phase 4: Dunkelmodus und 3D-Optik
- **Dunkelmodus-Bug:** Im OS-Dunkelmodus war der Seitenhintergrund dunkel und Eingaben (schwarzer Text auf dunklem Feld) unlesbar. Entscheidung: Oberfläche ist vorerst **nur hell** (`color-scheme: light`, Formularfelder explizit weiss/dunkler Text, kein `prefers-color-scheme: dark`). Echter Dunkelmodus ist ein späteres, bewusstes Design-Thema. E2E-Test deckt es ab.
- **3D-Optik überarbeitet** («zu kantig und generisch»): Stil «gemütlich, stilisiert». Alle Modelle sind jetzt **zusammengeführte Geometrien mit Vertex-Farben** (`geo.ts` → `mergeParts`): abgerundete Kanten (`RoundedBoxGeometry`), Satteldächer, Türbogen, Fenster mit Rahmen/Läden/Blumenkasten, Kamin mit Rauch, Vordach (ab Stufe 2), Anbau + Fahne + Laterne (Stufe 3), Zentrale mit Säulenportal, Uhrturm und Fahne, Baustelle mit Kran/Gerüst, Figur mit Haaren/Armen. Fenster/Laternen leuchten (separates Glow-Mesh). Dachfarbe je Haus stabil aus der ID.
- **Objekte** stehen auf **Sockeln**, Ringfarbe = Inhaltskategorie; Formen: Kristallgruppe (Artifact), echtes Zahnrad mit Zweitrad (GitHub-Repo), Monitor mit grünem Terminal (Gist), Holztruhe mit Eisenbändern, Schloss und Wolke (Cloud-Ordner), Wegweiser mit Pfeilschildern (Link), Buch (Datei), Kiste (Paket). Slots liegen jetzt auf dem Boden (`y = 0`).
- **Umgebung:** Himmel-Farbverlauf, weiche Schatten (aus auf Mobile), Wiese mit Randzonen, Dorfplatz mit Laternen, Wege mit Randstein; Natur als Instanzen (Bäume mit zwei Kronen, Büsche, Blumen, Steine; `density` für Mobile).
- **Beschriftungen** haben konstante Bildschirmgrösse (`sizeAttenuation=false`), damit sie beim Heranzoomen nicht riesig werden.
- Messung (10 Häuser/60 Objekte, Headless): ~250 Draw Calls, ~260k Dreiecke (inkl. Schattenpass). Deutlich mehr Dreiecke als zuvor (~5k), aber für Laptop-GPUs unkritisch; auf Mobile prüfen.

## 2026-10-21 – Phase 4b / Etappe A: Organische Wege (Konzept in docs/PLAN-4B-GESTALTUNG.md)
- Gian-Wunsch: Wege weniger gerade, mehrere Varianten, dürfen sich nicht berühren. Umsetzung `src/lib/paths.ts` («Korridor-Verfahren»): gerade Wege festlegen, pro Punkt den Abstand zu allen anderen Wegen und Häusern messen, die Auslenkung darf höchstens (Abstand − Breite − Lücke)/2 sein. Dadurch berühren sich zwei Kurven **rechnerisch** nie. 4 Kurvenformen × 4 Beläge (Sand, Kies, Platten mit Fugen, Trittsteine), pro Haus aus der ID abgeleitet. Tests bis 30 Häuser.
- Erster Ansatz (Wege der Reihe nach ausweichen lassen) war falsch: er garantiert nichts, wenn spätere Wege keinen Platz mehr finden. Lehre: Zuerst die Invariante beweisen, dann die Form wählen.
- **Layout geändert:** Bis 7 Häuser ein Ring (r=12). Ab 8 Häusern zwei Ringe, **abwechselnd** (gerade Position innen, ungerade aussen) und auf Lücke; Innenradius wächst so, dass jeder Weg ≥5.6 m Abstand zum nächsten Haus samt Objektbogen hat. Der Dorfplatz wächst bei sehr vielen Häusern, damit alle Wege am Rand Platz haben. Frühere Ringe-Kapazitäten (7/12/18/24) entfallen, weil Wege sonst direkt durch Häuser führten.
- Wege sind ein einziges Mesh (ein Draw Call); `buildPathGeometry` in `paths-geometry.ts`.
