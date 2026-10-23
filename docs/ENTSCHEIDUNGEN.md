# Entscheidungen und Lehren

Laufendes Log. Neueste Einträge unten. Format: Datum – Titel, Kontext, Entscheidung/Lehre, Grund.

## 2026-10-21 – Projektname und Struktur

- Projekt heisst **Hub Dome** (nicht «Campusdorf»). Repo: github.com/Davos-1/Hub-Dome. Projekt liegt direkt im Repo-Root.
- Skill-Ordner bleibt vorerst `skill/campusdorf-platzieren` gemäss PLAN.md; Umbenennung in Phase 5 klären. → Erledigt am 2026-10-22: `skill/hub-dome-platzieren`.

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
- **Offen vor Phase 6:** Eigener SMTP-Dienst (z.B. Resend) für Auth-Mails; der eingebaute Supabase-Mailserver hat ein sehr tiefes Stundenlimit (zweiter Testaccount erhielt keine Mail). Ausserdem Google-OAuth-App «veröffentlichen» oder Testnutzer eintragen.

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

## 2026-10-21 – Phase 4b: Gestaltung (Etappen B–E), Konzept in docs/PLAN-4B-GESTALTUNG.md
- **Stile pro Dorf** (nicht pro Haus): `villages.house_style` (haus, blockhuette, marskuppel, werkstatt, tinyhaus, baumhaus) und `villages.zentrale_style` (rathaus, schule, hochhaus, villa, marskuppel, leuchtturm, custom). Migration `20261021000300_village_styles.sql` (Spalten, `safe_uuid`, privater Bucket `village-models`, Storage-Policies). **Von Gian im SQL-Editor einzuspielen**, danach `npm run test:rls`.
- **Modelle** liegen in `src/components/village/models/` (ein File pro Stil, `index.ts` als Verteiler). Jeder Haus-Stil hat drei Grössenstufen und eine **eigene Baustelle** (`house-construction.ts`: passender Rohbau + Gerüst/Kran). Alle Modelle sind zusammengeführte Geometrien mit Vertex-Farben (`Builder` → `mergeParts`), Leuchtteile (Fenster, Laternen) separat.
- **Organische Wege** (Etappe A) siehe oben; Layout wechselte auf zwei **abwechselnde** Ringe ab 8 Häusern.
- **Umgebung/Leben** (`src/lib/environment.ts` deterministisch + `src/components/village/life/`): Fluss mit Brücke (hinterer Bogen), Teich mit Enten, Weide mit Schafen, Hühner, Windmühle, Dorfbewohner auf den Wegen, Vögel, Schmetterlinge, Wolken. Tiere sind Instanzen, deren Bewegung **aus der Zeit berechnet** wird (kein Zustand). `LiveFrames` erzeugt mit 30 fps (Mobile 20) Frames trotz `frameloop="demand"`, nur bei sichtbarem Tab; bei `prefers-reduced-motion` stehen Tiere und Wasser still und es werden keine Frames erzeugt.
- **Eigene Modelle** (Etappe E): Format **GLB**, max. 5 MB, 60 000 Dreiecke, 4 Texturen, keine externen Verweise, keine Draco/Meshopt. `src/lib/glb.ts` prüft Browser (schnell) **und Server** (verbindlich, `registerModel` lädt die Datei aus dem privaten Bucket und löscht ungültige sofort). Anzeige: signierte URL (10 min) nur bei Stil `custom`, `CustomModel` lädt im Hintergrund, sperrt externe URLs (`setURLModifier`), skaliert aufs Dorf und gibt beim Entfernen Geometrien, Materialien und Texturen frei. Bis zur Fertigstellung (oder bei Fehler) zeigt die Szene das Rathaus. Upload direkt vom Browser in den Bucket (kein Server-Body-Limit), RLS erlaubt nur dem Besitzer genau `<village_id>/zentrale.glb`.
- **Entwickler-Routen** `/dev/stile` (Galerie aller Stile) und `/dev/dorf` (Dorf mit erfundenen Daten, ohne DB), nur ausserhalb von Produktion; dienen den Rauchtests `tests/e2e/stile.spec.ts`.
- Lehren: (1) Der erste Wege-Ansatz (der Reihe nach ausweichen) garantierte nichts; erst die Invariante («Korridor»), dann die Form. (2) Mit React-Compiler-Lint dürfen Props/Hook-Rückgaben nicht per Zuweisung geändert werden (`texture.offset.set(...)` statt `.x =`). (3) Shell-Heredocs mit vielen Sonderzeichen scheitern oft: Dateien mit dem Write-Tool schreiben, Python-Skripte als Datei ablegen und ausführen.
- Offen: Marker für Objekttypen im Stil (z.B. Mars-Variante der Sockel) – bewusst weggelassen; Tag-Nacht, Jahreszeiten, Marktstand u.a. siehe Plan-Datei («Später möglich»).

## 2026-10-21 – Design-Handoff «3D-Dorf Endfassung» umgesetzt (docs/design_handoff_dorf3d)
- **Quelle**: `docs/design_handoff_dorf3d/README.md` (massgeblich) und `referenz/dorf-viewer.js` (Zahlen, Farben, Algorithmen). Vollbild-Ansicht, Quartiere pro Fachbereich, Haustyp pro Fachbereich, neue Wege/Plätze/Beschriftung, Navigation Dorf › Quartier › Haus, Suche, Karte, Tageszeit, Filter.
- **Datenmodell**: `houses.semester` (smallint, 1–12, optional) per Migration `20261021000400_house_semester.sql` – **von Gian im SQL-Editor einzuspielen**. Der Code schreibt `semester` beim Anlegen nur, wenn es gesetzt ist (ältere Datenbank bleibt lauffähig). Fachbereich ergibt sich fest aus dem Modulcode (`src/lib/fachbereiche.ts`, Test: jeder Code aus `seed.sql` hat einen Fachbereich ≠ «Weitere»).
- **Haus-Stil-Picker entfällt**: `HOUSE_STYLES` und die alten Haus-Modelle (Blockhütte, Marskuppel, Werkstatt, Tinyhaus, Baumhaus, stilabhängige Baustelle) sind gelöscht; `villages.house_style` bleibt in der DB, wird aber nicht mehr gelesen oder geschrieben. Zentrale-Stile samt eigenem GLB bleiben. Die Kuppel-Bausteine der grossen Marskuppel liegen jetzt in `models/dome-parts.ts`.
- **Neuer Typ `digital`** (Fachbereich «Digital & Daten», nicht im Prototyp): Flachdach-Kubus mit leuchtendem Fensterband, Antenne und Serverkasten; Stufe 2 Vordach, Stufe 3 versetzter Kubus. Zur Abnahme durch Gian vorgesehen (`/dev/stile?fach=digital`).
- **Aufbau** (reine Logik in `src/lib`, Geometrie/Szene in `src/components/village`): `layout.ts`/`paths.ts` (Port, Tests inkl. Grundstücks-Überlappung 5–50 Häuser und «jeder Weg eigene Vieleckseite»), `terrain.ts`, `daytime.ts`, `lamps.ts`, `camera-poses.ts`, `village-model.ts` (abgeleitete Anzeigedaten, «neu» = jünger als 7 Tage). Szene: gemeinsamer Zustand `scene-store.ts` (Nav, Ansicht, Tageszeit, Filter, Hover, angeheftetes Objekt) zwischen Canvas und Oberfläche (`hud/`), Navigation in `scene-actions.ts`, Gärten/Objekte/Hecken dorfweit zusammengeführt (`garden-geometry.ts`), alle Beschriftungen in einem Textur-Atlas (`label-atlas.ts`, `village-atlas.ts`), Schilder in `boards.tsx`.
- **Leistung**: 10 Häuser / 60 Objekte ≈ 180 Draw Calls, 30 Häuser ≈ 215 (Vorgabe < 250); `lowDetail`: kein Waldgürtel, keine Schatten, keine Punktlichter, kein Rauch.
- **Lehren**: (1) **React-StrictMode ruft `useMemo`-Fabriken zweimal auf**: füllt eine Fabrik ein Objekt (z.B. `group.add(sprite)`), das aus einer anderen Fabrik stammt, landen die Kinder in der verworfenen Gruppe (Beschriftungen und Rauch waren unsichtbar). Objekt und Inhalt immer in **einer** Fabrik bauen. (2) Der React-Compiler-Lint verbietet das Ändern von Werten aus Hooks im `useFrame`: veränderlichen Zustand in Klassen mit Methoden kapseln (`label-sprite.ts`). (3) `Date.now()`/`new Date()` in Server-Komponenten brauchen `await connection()` davor (Dev-Vorschau). (4) Unsichtbare Trefferflächen (`visible={false}`) bleiben für R3F-Klicks nutzbar, auch in der Kartenansicht.
- **Abweichungen vom Handoff / offene Punkte**: Baustellenschild-Klick führt zur Listenansicht (Anker auf das Haus) statt in einen Dialog, weil es in der 3D-Ansicht keinen «Objekt hinzufügen»-Dialog gibt. Die Quartiertafel (4.8 × 2.4 m, Mitte des Nebenplatzes) kann bei der Hausansicht die Sicht verdecken, wenn die Kamera auf der Gegenseite steht; falls es stört, Tafel an den Rand des Nebenplatzes verschieben. Esc löst zuerst ein angeheftetes Objekt, dann geht es eine Ebene hoch.

## 2026-10-22 – PLAN-ERWEITERUNG-2 eingebettet, Phase 4c eingeschoben
- Neue Gesamtreihenfolge in `docs/PHASENPLAN.md`: 4c (Welt-Shell) → 5 (MCP) → 5b (Übernehmen) → 6 (Pilot) → 6b (Topdorf) → 7. Phase 4c kommt vor 5, weil Token-Verwaltung (5), «In mein Dorf» (5b) und der Topdorf-Eintrag (6b) direkt in die Dialog-Oberfläche gehören.
- Gians Wunsch: Welt lädt nach dem Login unscharf im Hintergrund, grosse Dialoge für Start, Konfiguration und Reise zu anderen Dörfern. Dialog-Zustand per URL-Parameter (`?d=…`), Szene bleibt gemountet, Listenansicht bleibt als Fallback.
- Punkte aus PLAN-ERWEITERUNG-2, die Gian bestätigen soll (vor 5b): (1) bestehende Übernahmen bleiben bei Entzug von Zugriff/Freigabe/`allow_copy` erhalten (A4); (2) `allow_copy` ist Standard «an», gilt mit der Migration also auch rückwirkend für alle bereits geteilten Objekte; (3) `topdorf_ok` heisst «für alle angemeldeten Nutzer sichtbar» (heute = Studiengang); (4) Abklärung zu Beginn von 5b, ob claude.ai für geteilte Artifacts eine Anpassen-/Remix-Funktion anbietet.
- Zu beachten bei 5b: Die geänderte Policy `artifacts_select` macht Topdorf-Originale ohne Dorfzugriff lesbar. Abfragen, die `houses` joinen, müssen mit fehlendem Haus (kein Zugriff auf das fremde Dorf) umgehen; Topdorf liefert deshalb nur die url-freien Felder und `house_title`/`module_code` aus `topdorf_items`.

## 2026-10-22 – Phase 4c Welt-Shell umgesetzt
- **Entscheidungen Gian:** Start-Dialog bei jedem Login (nicht bei Deep-Links/Neuladen); Listenansicht bleibt zunächst Seite, soll **später auch ein Dialog** werden; Willkommens-Banner «Dorf von …» beim Besuch fremder Dörfer: ja.
- **Technik:** Dialog-Zustand in der URL (`?d=start|reise|einstellungen|objekt|haus|einladung`, `t` = Tab, `h` = Haus), geändert per `history.pushState/replaceState` (kein Seitenneuladen, `useSearchParams` zieht mit). Daten für alle Dialoge lädt `lib/shell-data.ts` (RLS-Client) zusammen mit dem Dorf. Dialoge unter `src/components/world/`, Szene bleibt gemountet; Reise zu anderen Dörfern ist eine normale Navigation mit Ladebild (`Suspense`-Fallback), die Canvas wird dabei neu aufgebaut.
- **Lehren:** (1) Konstanten aus einer `"use client"`-Datei dürfen nicht in Server-Komponenten importiert werden (Seite `/start` lieferte Serverfehler) → `dialog-ids.ts` als eigene Datei. (2) Atlas der Beschriftungen und Dorfmodell müssen zusammenpassen: beim Anlegen eines Hauses aus der Welt crashte die Szene, weil der alte Atlas noch zum alten Modell gehörte; `useAtlas` liefert nur noch einen Atlas zum aktuellen Modell. (3) `inert` allein genügt für Playwright nicht, zusätzlich `aria-hidden` auf dem Hintergrund setzen (auch gut für Screenreader). (4) Bei mehreren gleichzeitig offenen 3D-Seiten (zwei Nutzer im E2E) können Tests langsam werden; Timeouts grosszügig.
- **Offen:** Listenansicht als Dialog (später), Platzhalter-Dorf hinter `/onboarding`, Claude-Tab (Phase 5).

## 2026-10-22 – Freundschaften statt Einladungslinks (von Gian bestätigt)
- **Kontext:** Die einseitigen Einladungslinks (7 Tage, 1–100 Nutzungen) werden durch Freundschaftsanfragen ersetzt. Migration `20261022000100_friendships.sql`: Tabelle `friendships` (eine Zeile pro Paar, `pending`/`accepted`), Funktionen `send_friend_request` (per Benutzername), `respond_friend_request`, `cancel_friend_request`, `remove_friend`, `grant_mutual_access`. `invites` und `accept_invite` entfallen, bestehende Zugriffe werden gelöscht (nur Testdaten). Freunde verwaltet man im Reise-Dialog, Server Actions in `src/app/freunde/actions.ts`.
- **Entscheidung (Gian, 2026-10-22):** Nach dem Annehmen sehen sich **beide gegenseitig** die Dörfer. `village_access` bleibt die Grundlage von `can_view_village`, wird aber nur noch von den Funktionen gepflegt. «Zugriff entziehen» und «Dorf verlassen» heissen jetzt «Freund entfernen» und wirken in beide Richtungen. Private Objekte bleiben auch für Freunde unsichtbar.
- **Lücke gegenüber vorher:** Anfragen gehen nur per exaktem Benutzernamen. Personen ohne Konto lassen sich nicht mehr mit einem Link direkt ins eigene Dorf holen, und ein Link für mehrere Personen fehlt. Ausgleich: Freundschaftslink in Phase 4e (`docs/PHASENPLAN.md`).

## 2026-10-22 – Eigene 3D-Modelle (GLB) entfernt
- Migration `20261022000200_remove_custom_model.sql`: Upload und Anzeige eigener Zentrale-Modelle entfallen (Wunsch Gian, Missbrauchsrisiko). Der Bucket `village-models` bleibt ohne Policies und ohne erlaubte Dateitypen bestehen, Dörfer mit eigenem Modell zeigen wieder das Rathaus. Entfernt: `src/lib/glb.ts`, `model-upload.tsx`, `custom-model.tsx`, `tests/e2e/gestaltung.spec.ts`.
- Die Einträge zu Etappe E weiter oben gelten nur noch als Historie. Eine Wiederaufnahme ist in Phase 7 notiert, dann nur mit Prüfung oder als kuratierte Auswahl.

## 2026-10-22 – Plan bereinigt: Phase-0-Sperre, Listenansicht, Fokus bis zum Pilot
- **Listenansicht:** Die Seite `/dorf/<name>/liste` wurde im selben Umbau entfernt. Häuser und Objekte werden jetzt über die Dialoge `objekt`, `objektedit`, `haus` und `hausedit` verwaltet; ohne WebGL zeigt `FallbackList` eine einfache Liste. Mit WebGL fehlt aber eine vollständige Listenansicht (Barrierefreiheit, Mobile, grosse Dörfer, PLAN.md Abschnitt 7). Sie kommt als Dialog `?d=liste` in Phase 4e zurück; das passt zu Gians Wunsch, alles als Fenster oder Dialog in der Welt zu haben.
- **Phase 0 ist Sperre vor Phase 5:** Der Link-Test (geht ein geteiltes Artifact ohne Login, mit zweitem Konto, per iframe auf?) entscheidet über den Kernnutzen, denn Freunde müssen die Objekte öffnen können. Ohne Ergebnis startet Phase 5 nicht. Ablauf und Folgen je Ergebnis: `PLAN.md` Phase 0.
- **Fokusregel bis zum Pilot:** Keine neuen 3D-Gestaltungsfunktionen (Tiere, Modelle, Effekte, Stile), bis Pilot-Feedback vorliegt. Erlaubt sind Fehlerbehebungen, Performance und Barrierefreiheit. Grund: Die 3D-Welt ist weit, der Alltagsnutzen (Platzieren aus Claude, Phase 5) und die Bestätigung durch echte Nutzer fehlen noch.
- **Name:** In allen Plänen «Hub Dome», der Arbeitstitel «Campusdorf» entfällt. Der Skill heisst `hub-dome-platzieren`, Ordner `skill/hub-dome-platzieren` (bisher `skill/campusdorf-platzieren`, enthielt nur `.gitkeep`). Damit ist der offene Punkt vom 2026-10-21 zum Skill-Ordner erledigt.

## 2026-10-22 – Phase 4d: Feinschliff, Freundschaften, keine Seiten mehr ausser Anmeldung
- **Wunsch Gian:** (1) Dialoge sollen zum Stil der Welt passen; (2) kein Upload eigener Zentrale-Modelle mehr (Missbrauchsrisiko); (3) Teilen als Freundschaft mit Anfrage und gegenseitiger Annahme statt Einladungslinks; (4) Anzeige-Optionen als eigenes kleines Fenster in der Ecke; (5) Hausansicht höher und sicher über der Quartiertafel; (6) alle alten Seiten entfernen, alles als Fenster oder Dialog in der Welt.
- **Stil:** Dialoge wie die Holzschilder der Welt (Kopf aus Brettern mit Symbol und kleiner Kopfzeile, Pergament-Körper, grüne Knöpfe, Klassen `hd-*` in `globals.css`); Anmeldung und Einrichtung nutzen dieselbe Karte (`AuthCard`) auf Himmelsverlauf. `inputClass`, `dangerButton` usw. zeigen auf diese Klassen.
- **Eigene Modelle entfernt:** Code (`glb.ts`, Upload, `CustomModel`, Stil `custom`) gelöscht. Migration `20261022000200_remove_custom_model.sql` entfernt die Storage-Policies (kein Upload, kein Download), sperrt den Bucket und setzt Dörfer mit `custom` auf das Rathaus. Bereits hochgeladene Dateien bleiben als Waisen im Bucket und können im Supabase-Dashboard gelöscht werden.
- **Freundschaften:** Tabelle `friendships` (pending/accepted, ein Eintrag pro Paar), nur lesbar für die Beteiligten, Schreiben nur über `send_friend_request`, `respond_friend_request`, `cancel_friend_request`, `remove_friend` (security definer). Angenommen entsteht gegenseitiger Zugriff über `village_access` (bestehende Policies und `can_view_village` bleiben); gegenseitige Anfragen bestätigen sich sofort; höchstens 20 offene Anfragen pro Person. `village_access` ist für Clients nicht mehr direkt löschbar. Einladungslinks (`invites`, `accept_invite`, Seite `/einladung`) und alle bisherigen Freigaben entfallen (Migration `20261022000100_friendships.sql`, **von Gian einzuspielen**). Anfragen laufen über den exakten Benutzernamen.
- **Oberfläche:** Dialog «Reise und Freunde» (Tabs Dörfer und Freunde, Hinweiszahl bei Anfragen in Leiste und Start-Dialog), Einstellungen nur noch Profil und Dorf (Zentrale-Stil), kleines Fenster «Anzeige» links unten (Tageszeit, Ansicht, Filter). Haus und Objekt lassen sich im Fenster rechts über Dialoge bearbeiten, verschieben und löschen. Ohne WebGL gibt es eine Listenansicht in derselben Oberfläche.
- **Entfernte Seiten:** `/dorf/<name>/liste`, `/einladung/<token>`, `AppHeader`. `/doerfer` und `/einstellungen` leiten auf Dialoge um, `/` leitet auf `/start` bzw. `/login`.
- **Kamera:** `housePose` steht höher und weiter draussen und hebt die Kamera, bis die Blickachse mit 1.3 m Abstand über jeder Quartiertafel liegt (Test über alle Häuser).
- **Lehren:** (1) Nach einer Server Action liefert Next die Seite mit der ursprünglichen URL neu; Dialog-Zustand deshalb zusätzlich in React halten (`useDialog`), sonst geht der Dialog wieder auf. (2) Verschwindet das Objekt eines Bearbeiten-Dialogs (z.B. nach dem Löschen), schliesst sich der Dialog selbst, weil sein Formular mit dem Objekt verschwindet.

## 2026-10-22 – Phase 4e abgeschlossen
- **Freundschaftslink (Entscheid Gian):** Das Erzeugen des Links gilt als Zustimmung des Absenders, Annehmen genügt. Migration `20261022000300_friend_links.sql` (Tabelle `friend_links` mit Hash, Ablauf, Nutzungen; `friend_link_info` zeigt Absender und Zustand ohne etwas zu verbrauchen; `accept_friend_link` erzeugt gegenseitige Freundschaft, nimmt eine offene Anfrage an und verbraucht bei bestehender Freundschaft nichts). Max. 8 Tage Ablauf und 100 Nutzungen per Check bzw. Policy, `uses` nicht von Hand änderbar. Annehmen nur per Knopf, nicht per Seitenaufruf.
- **Listen-Dialog** `?d=liste` (Knopf und Taste L) mit Suche und Typ-Filter; `/dorf/<name>/liste` leitet um.
- **Tests:** RLS 34/34; E2E `freundeslink.spec` und `freigabe.spec` grün. Bei vielen aufeinanderfolgenden Tests wird der Dev-Server langsam (Einzelläufe sind schnell); Timeouts der Aktions-Tests grosszügig gesetzt.
- **Lehre:** Mit `Suspense` ausgelieferte Seiten, die `notFound()` aufrufen, antworten mit Status 200; E2E-Tests prüfen den Text «This page could not be found.» statt den Status.

## 2026-10-22 – Link-Test Phase 0: Ergebnis
- **Getestet (Gian):** Ein geteilter Artifact-Link (`https://claude.ai/artifact/<id>`) lässt sich im privaten Fenster **ohne Login** öffnen und nutzen. Voraussetzung: Beim Teilen in claude.ai ist «Jeder mit dem Link» gewählt. Ein **nicht geteiltes** Artifact kann ein Externer nicht öffnen.
- **Geprüft (Claude, 2026-10-22, `curl -I`):** Der Link antwortet anonym mit 200. Die Antwort setzt `Content-Security-Policy: frame-ancestors 'self' chrome-extension://…`, **Einbetten per iframe in Hub Dome ist damit nicht möglich**. Es bleibt bei «Öffnen im neuen Tab» (`target="_blank" rel="noopener noreferrer"`); kein Umbau nötig.
- **URL-Form:** `claude.ai/artifact/<id>` geht durch `artifactUrlSchema` (Test ergänzt). Weitere Formen (z.B. `claude.ai/public/artifacts/…`, `claude.ai/code/artifact/…`) sind ebenfalls claude.ai-Links und erlaubt.
- **Nicht getestet:** Öffnen mit einem **zweiten eingeloggten Gratis-Konto** (Schritt 2). Da der Link auch ohne Login geht, ist das für Freunde unkritisch; gilt als erledigt.
- **Folgen:** (1) Das Formular «Objekt hinzufügen» weist darauf hin, in claude.ai «Jeder mit dem Link» zu wählen. (2) Der Skill (Phase 5) erinnert vor dem Platzieren daran: «Teile das Artifact in claude.ai mit ‹Jeder mit dem Link›, damit deine Freunde es öffnen können.» (3) Ein Pro-Konto ist für das Öffnen nicht nötig; entscheidend ist die Freigabe des Besitzers.
- **Damit ist die Sperre vor Phase 5 aufgehoben.**

## 2026-10-22 – Phase 5: MCP-Connector und Skill umgesetzt
- **Route** `POST /api/mcp/<token>` (Streamable HTTP, zustandslos, max. 256 KB pro Anfrage). Token nur gehasht mit `TOKEN_PEPPER`; alle Abfragen mit Service Role filtern auf den Token-Besitzer.
- **Tools:** `dorf_haeuser_auflisten`, `artifact_platzieren` (mit `objekt_typ`), Alias `objekt_platzieren`, `haus_erstellen`, `letzte_artifacts`. Unbekanntes Haus legt nichts automatisch an, sondern nennt die vorhandenen Häuser. Gleiche URL aktualisiert den Eintrag.
- **`im_topdorf_zeigen`** wird erst mit Migration 5b (`topdorf_ok`) aktiv, bis dahin ignoriert.
- **Rate-Limit:** Migration `20261022000400_mcp_rate_limit.sql` (`mcp_rate`, `mcp_hit`), 60 `tools/call` pro Token und Stunde; höchstens 5 aktive Tokens pro Person (Trigger).
- **Skill** erinnert an «Jeder mit dem Link» (Ergebnis Link-Test), fragt nicht von sich aus nach Topdorf; Download als ZIP unter `/api/skill`.
- **Tests:** Unit 109/109, RLS 57/57 (Token, widerrufen, nur eigenes Dorf, Duplikat-URL, Protokoll, Limit).
- **Offen:** Abnahme mit dem MCP Inspector (Gian) und in claude.ai nach dem Deployment (Phase 6).

## 2026-10-22 – Phase 5b: Übernehmen und Nutzungsdaten
- **Bestätigt (Gian):** (1) Bestehende Übernahmen bleiben erhalten, wenn der Besitzer die Freundschaft beendet, das Objekt privat macht oder `allow_copy` ausschaltet (wie ein Lesezeichen). Gelöschtes Original → «Original entfernt». (2) `allow_copy` ist Standard an, auch rückwirkend für bestehende Objekte. (3) `topdorf_ok` heisst «für alle angemeldeten Hub-Dome-Nutzer sichtbar» (heute = Studiengang). Wird Hub Dome für weitere Studiengänge geöffnet, braucht die Policy `artifacts_select` eine Studiengangs-Zuordnung.
- **Remix-Abklärung:** Für 2024 ist ein Knopf «Remix» auf veröffentlichten Artifacts belegt (öffnet einen neuen Chat mit dem Inhalt). Ob und wie er 2026 auf geteilten Artifacts heisst, liess sich nicht sicher bestätigen. Der Hinweistext nennt «Remix» deshalb nur mit «falls angeboten». Gian prüft das beim nächsten geteilten Artifact.
- **Migration** `20261022000500_copy_and_events.sql`: Herkunftsfelder, Trigger `artifacts_guard_copy` (Herkunft nur über `copy_artifact`; neue URL → eigene Version; privat → `topdorf_ok = false`), `item_events` ohne Client-Zugriff, `can_view_artifact`, neue Policy `artifacts_select`, `copy_artifact`, `record_item_event`, `item_stats`, zusätzlich `set_topdorf_all` (Sammelaktion) und Constraint `artifacts_top_shared`.
- **Öffnen** läuft über `/o/<id>` (zählt pro Person einmal, Besitzer nie, Übernahmen zählen fürs Original). Links sind normale `<a target="_blank">`.
- **Oberfläche:** «In mein Dorf» (Taste K im Objektfenster) mit Hausvorschlag nach Modul bzw. «Haus anlegen und übernehmen»; Badges «übernommen von» / «basiert auf» / «Original entfernt»; Zähler für Besitzer; 3D-Markierung als flacher Ring am Boden in der zusammengeführten Objekt-Geometrie (kein zusätzlicher Draw Call); Schalter «Andere dürfen übernehmen» und «Im Topdorf zeigen» im Objektformular; Sammelaktion im Tab «Dorf».
- **MCP:** `im_topdorf_zeigen` ist jetzt aktiv (nur bei `shared`). Übernahmen bleiben beim erneuten Platzieren privat.
- **Datenschutzhinweis (Phase 6):** muss «Nutzungszahlen (wer was geöffnet/übernommen hat, nur als Zahl für Besitzer und Ranking)» enthalten. Einen Hinweistext gibt es noch nicht, er entsteht in Phase 6.
- **Tests 5b:** RLS 71/71 (davon 14 neu), E2E `uebernehmen.spec` grün. Im Gesamtlauf stürzt der Dev-Server nach `freigabe.spec` ab bzw. wird so langsam, dass `freundeslink.spec` ins Timeout läuft; einzeln laufen alle Tests grün. **Lehre:** E2E bei Bedarf in Gruppen laufen lassen; vor dem Pilot gegen einen Produktions-Build (`next start`) testen.
- **Lehre:** Der Trigger hält `topdorf_ok` bei privaten Objekten still auf `false` (kein Fehler). Tests prüfen den Wert, nicht einen Fehler.

## 2026-10-22 – Objekte der Zentrale im Ring statt «Haus im Leuchtturm»
- **Fehler:** Objekte der Zentrale wurden gar nicht gezeichnet (die Zentrale hat kein Grundstück). Sichtbar war nur das Wärterhaus des Leuchtturm-Modells, das halb im Turm steckt; es wirkte wie ein neues Haus. Die Objekte waren auch nicht anklickbar, und die Suche konnte nicht zu ihnen springen.
- **Entscheidung (Gian):** Ausnahme von «keine neuen 3D-Gestaltungsfunktionen bis zum Pilot». Die Objekte der Zentrale stehen im Ring um die Zentrale, in einer Form passend zum Stil: Leuchtturm = Bötli im Wasserring, Villa = Golffähnchen und Zierstatuen, Marskuppel = Solarpanels, Rathaus = Fahnenmasten, Hochhaus = Würfelskulpturen, Schule = normale Objektformen im Pausenhof. Die Kategoriefarbe bleibt sichtbar (Segel, Fahne, Rahmen, Band). Das Wärterhaus entfällt.
- **Umsetzung:** `HouseLayout.ring` (nur Zentrale; eigenes Feld statt `plot`, weil `plot` überall als Garten mit Rasen, Weg und Lampen gilt). Ring ab Radius 6.2, vorne bleibt ein Bogen frei, bei vielen Objekten kommen weitere Ringe dazu. Terrasse (`layout.terrace`) und Hauptplatz wachsen mit, Brunnen und Anschlagbrett rücken mit `plazaRadius` nach aussen. Ohne Objekte bleibt das Dorf unverändert.

## 2026-10-22 – Phase 6: Vorbereitung Deployment
- **Entscheide Gian:** Verantwortlich im Datenschutzhinweis: Gian Blaser, gian.blaser@gmail.com. Domain: Vercel-Subdomain. Login-Mails über Gmail-SMTP mit App-Passwort (ca. 500 Mails/Tag). Konto löschen mit **einem Tag Wartefrist**.
- **Konto löschen:** Migration `20261022000600_account_deletion.sql` (`account_deletions`, `request_account_deletion` widerruft sofort alle Connector-Tokens, `cancel_account_deletion`). Antrag → Abmeldung → Hinweis auf der Login-Seite. Anmelden über `/auth/callback` bricht ab. Täglicher Vercel-Cron `/api/cron/konto-loeschen` (geschützt mit `CRON_SECRET`) löscht den Auth-User; alles andere folgt per Cascade. Übernahmen bei anderen bleiben als «Original entfernt». Eine noch offene Sitzung auf einem anderen Gerät bricht die Löschung nicht ab (nur eine neue Anmeldung).
- **Datenschutzseite** `/datenschutz` (öffentlich, verlinkt von Login und Einstellungen), inkl. Nutzungszahlen und Topdorf.
- **Anleitung** für Supabase, Gmail-SMTP, Google-OAuth und Vercel: `docs/DEPLOYMENT.md`.

## 2026-10-22 – Login-Link geräteübergreifend
- **Problem (Pilot-Test Gian):** Magic Link aus dem privaten Fenster angefordert, im normalen Fenster geöffnet → zurück auf der Login-Seite. PKCE-Code braucht den Prüfwert im selben Browser. Vorher: «requested path is invalid» wegen Site URL ohne `https://`.
- **Lösung:** `/auth/callback` akzeptiert zusätzlich `token_hash` + `type` (`verifyOtp`). Mail-Vorlagen «Magic Link» und «Confirm signup» verlinken `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`; das Login-Formular setzt deshalb immer `next` (Standard `/start`). Google bleibt bei PKCE. Redirect URLs mit `/**`.
- **Build-Lehre:** Unter Cache Components darf eine Seite `params` nicht ausserhalb von `Suspense` lesen; reine Umleitungen als Route-Handler (`/dorf/<name>/liste`).
- **Nachtrag:** Der erste Versuch scheiterte trotzdem: Der Browser-Client von `@supabase/ssr` fordert den Link im PKCE-Verfahren an, `{{ .TokenHash }}` beginnt dann mit `pkce_` und gilt nur im selben Browser. Der Mail-Link wird deshalb jetzt per Server Action (`src/app/(auth)/login/actions.ts`) mit `flowType: "implicit"` angefordert. Google bleibt PKCE im Browser.
- **Nachtrag 2:** Mails im alten Format (`/auth/v1/verify?…&type=signup`, z.B. wenn die Vorlage «Confirm signup» nicht umgestellt ist) liefern im Implicit-Flow die Sitzung als `#access_token` an `/auth/callback`. Der Callback leitet dann ohne Fehler auf `/login?next=…`; die Login-Seite übernimmt die Sitzung aus dem Fragment (`setSession`) und bricht über `POST /auth/nach-login` eine beantragte Kontolöschung ab. Der Login funktioniert damit mit beiden Vorlagen.

## 2026-10-22 – Mail-Link per Klick einlösen
- Kontext: Externe Tester landeten nach dem Mail-Link auf /login?fehler=1 (verifyOtp schlug fehl).
- Entscheidung: /auth/callback löst den token_hash nicht mehr per GET ein, sondern leitet auf /bestaetigen; dort löst ein Knopf (POST, Server Action) ihn ein. Fehler werden geloggt.
- Grund: Mail-Scanner/Link-Vorschauen rufen Links vorab auf und verbrauchen den Einmal-Token; ein POST wird von ihnen nicht ausgelöst.


## 2026-10-23 – Phase 4f: Fokusregel aufgehoben, Welt auf das nächste Level
- **Kontext:** Die 3D-Welt soll detaillierter, schöner und individueller werden (jedes Dorf erkennbar anders, verspielt, eigene Handschrift). Bisher galt «keine neuen 3D-Gestaltungsfunktionen bis zum Pilot».
- **Entscheidung (Gian):** Die Fokusregel ist für Phase 4f aufgehoben; danach gilt sie wieder bis zum Pilot-Feedback. Individualität entsteht aus drei Mechanismen zusammen: Raster mit Slots (Footprint, Ausrichtung, Abstände), freies Platzieren mit Live-Prüfung (ungültig = nicht ablegbar oder einrasten) und Automatik mit Seed (bleibt gespeichert, bis der Besitzer «Welt neu würfeln» wählt). Alles prozedural, keine externen Modelle, keine Uploads (Entscheid vom 2026-10-22 bleibt).
- **Oberste Regel:** keine «komische» Welt. Ungültige Zustände (Durchdringen, Schweben, schief im Hang, auf Wegen/Wasser, zugewachsene Türen, verdeckte Schilder, ausserhalb der Karte) dürfen nicht darstellbar sein, nicht nur unerwünscht.
- **Stand korrigiert:** `CLAUDE.md` nannte noch «Als Nächstes: 4e»; tatsächlich sind 4e, 5, 5b und der Code von 6 fertig.
- **Grund:** Die Welt ist das Erlebnis von Hub Dome; vor dem Pilot soll sie stabil, logisch und persönlich sein, sonst prägen Zufallsfehler den ersten Eindruck.

## 2026-10-23 – Phase 4f, Etappe 0: Audit und Konzept
- **Audit (gemessen):** Ein neues Haus verschiebt heute 10 von 11 bestehenden Häusern (Layout passt sich an Anzahl Häuser und Objekte an). Streu-Bäume überlappen sich (0–8 je Dorf) und die Platzbäume (0–5); Büsche/Steine stecken in Bäumen. Die Umgebung (Fluss, Teich, Mühle) hängt von der Dorfgrösse ab und wandert mit. Individualität nur über die Dorf-ID. Mobile: Brotkrumen und Suchfeld überlappen.
- **Entscheide im Konzept** (`docs/PHASE-4F-KONZEPT.md`): (1) Landschaft hängt nur vom Seed ab, die Siedlung passt sich ihr an. (2) Häuser werden inkrementell gesetzt (fixierte zuerst, dann nach `created_at`), jedes Element prüft sich nur gegen Früheres: neue Häuser verschieben dadurch nie bestehende, ohne gespeicherten Zustand. (3) Feste Grundstücksgrösse pro Slot (Haus Stufe 3 + 12 Objekte), Archivschrank ab 13 Objekten. (4) Neue Tabelle `village_worlds` (Seed, `generator_version`, Platzierungen als JSON). Clients dürfen nicht schreiben; nur Server Actions mit Service Role nach Zod- und Regelprüfung (sonst wäre die Serverprüfung per PostgREST umgehbar). (5) Ohne Migration gilt der Ersatz-Seed `md5(village_id)[0:8]`, derselbe Wert wie die Migration ihn setzt.
- **Annahmen A1–A6** als bestätigt übernommen (Gian: «bis zum Schluss durcharbeiten»); offene Fragen gesammelt im Konzept, Abschnitt 10.
- **Lehre (Umgebung):** In dieser Cloud-Umgebung gibt es keine `.env.local`; RLS-Tests und E2E mit Datenbank laufen hier nicht. WebGL rendert headless mit `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` (Chromium von `/opt/pw-browsers`).

## 2026-10-23 – Phase 4f, Etappe 1: Regelwerk, Seed, Siedlung mit Slots
- **Siedlung als «Platz + Gasse»** (statt Häuser rund um den Nebenplatz): Der erste Ansatz (vier Bauplätze rund um jeden Quartierplatz) brauchte wegen fester Grundstücke Ringe von 13–16 m; die Häuser eines Quartiers versperrten dabei die Zuwege der Nachbarrichtungen, ab 10 Häusern blieben Häuser ohne Platz. **Lehre:** erst messen (Kapazität über viele Seeds), dann gestalten. Jetzt: Dorfplatz mit neun Ausgängen; jedes Quartier bekommt einen Ausgang, einen Quartierplatz mit Tafel (je ein Haus links und rechts) und dahinter eine leicht gebogene Gasse mit Häusern abwechselnd links und rechts. Alle neun Gassen sind als Korridor für Häuser reserviert, damit nie ein Haus einen künftigen Zuweg verbaut.
- **Stabilität ohne gespeicherten Zustand:** Häuser werden nach `created_at` gesetzt (bei gleichem Zeitpunkt `position_index`, dann Id), jedes prüft sich nur gegen Früheres. Ein neues Haus kommt zuletzt und verschiebt nie ein bestehendes (Property-Test über 12 Seeds × 22 Häuser). Fixierungen (Bau-Modus) halten den Stand exakt fest.
- **Feste Grundstücke** 6.9 × 8.7 m (Haus Stufe 3 + 12 Objekt-Plätze), Archivschrank ab 13 Objekten. Kapazität gemessen: bis 40 Häuser bekommt in 100 % der Dörfer jedes Haus einen Platz, bei 50 Häusern in 99 % (der Rest bleibt über Liste und Suche erreichbar). Wasser liegt dafür weit draussen (Fluss 76–86 m, See 98–106 m), Teich, Weide und Mühle in den Lücken zwischen den Gassen; Gassen dürfen den Fluss auf Brücken queren (Winkel ≥ 35°).
- **Konsistente Abstände** zwischen Siedlung und Deko (mindestens 0.3 m in beide Richtungen): Sonst kann gespeicherte Deko nachträglich ungültig werden, sobald ein neues Haus dazukommt (Property-Test hat das gefunden).
- **Frontzone** vor jeder Hausfront (3.6 m): keine hohen Elemente (Bäume), damit Häuser und Schilder sichtbar bleiben; ein neues Haus meidet Plätze, vor denen ein eigener Baum steht.
- **Sperrzone um die Zentrale fest** (nicht von der Objektzahl abhängig): Besucher sehen keine privaten Objekte und müssen trotzdem dieselbe Welt rechnen wie der Besitzer.
- **Gleiche Eingabe in Browser und Server:** `toLayoutHouses()` (`src/lib/world/layout-houses.ts`) bildet aus den Datenbankzeilen die Häuser in derselben Reihenfolge; sonst prüft der Server beim Speichern eine andere Welt als die angezeigte.
- **Server Actions** `saveWorld` und `rerollWorld` (`src/app/dorf/welt-actions.ts`): Zod, Besitzer aus der Sitzung, Welt serverseitig neu gerechnet, Schreiben mit Service Role und `owner_id`-Filter. `rerollWorld` erhält den Seed aus der Vorschau, entfernt Fixierungen immer (die Gassen hängen am Seed), behält Deko und Varianten; ungültige Deko nur mit `dropInvalid` (die Vorschau nennt die Anzahl vorher). Fehlende Migration: freundliche Meldung, sonst läuft alles mit dem Ersatz-Seed.
- **Entwickler-Route** `/dev/dorf` mit `seed`, `zeit` (neu auch `nacht`), `kamera`, `bewegung=0`, `besitzer=1`; die Welt-Aktionen sind als Props austauschbar (Attrappen ohne Datenbank), dadurch laufen Würfeln und später der Bau-Modus als E2E ohne Datenbank. `window.__hubDome.ready` meldet, wann die Szene fertig ist (Screenshot-Matrix `tests/visual/`).
- **Tageszeit «Nacht»** (Auto: 22–5 Uhr), Laternen und Punktlichter leuchten bei Abend und Nacht.
- **Lehre (Prettier/Edit):** Nach `prettier --write` ändern sich Einrückungen; Ersetzungen per Skript vorher anwenden oder danach neu lesen.
- **Kamera Nahaufnahme (Nachtrag):** Häuser direkt am Quartierplatz haben die Tafel vor sich; die Pose wird jetzt über die Bildfläche bewertet, die Tafeln einnehmen (`boardClutter`, Ecken projiziert und am Nahpunkt abgeschnitten), plus kleine Strafen für Seitenblick, Höhe und Abstand. Test über 4 Welten.
- **Deko verschiebt Häuser nur ohne Fixierung (Fehler gefunden):** Deko wird vor den automatisch gesetzten Häusern geprüft; ohne Fixierung weichen Häuser einer neuen Bank aus. Deshalb speichert der Bau-Modus immer die aktuellen Quartiere und Häuser als Fixierung mit (`pinsFromSettlement`); die Beispiel-Deko der Entwickler-Route (`sampleDoc`, `deko=1`) tut dasselbe, Test: keine Abweisung, kein Haus bewegt sich.
- **Lehre (Test ohne Wirkung):** Der E2E-Test «reduzierte Bewegung» verglich `frames`, der Zähler wurde aber nie gesetzt (`undefined === undefined`). Jetzt zählt `PerfProbe` jeden Frame, und der Test verlangt zuerst einen Wert > 0.

## 2026-10-23 – Phase 4f, Etappe 2: Visuelle Qualität
- **Nacht lesbar:** Mondlicht heller (1.05, kühl), Himmel mit 700 Sternen (Mobile 260) und Mondscheibe, warme Lichtkreise unter jeder Laterne (ein InstancedMesh, additiv) statt vieler Punktlichter, Quartiertafeln leuchten abends leicht. Glühwürmchen über den Blumeninseln (nur Abend/Nacht, stehen bei reduzierter Bewegung still).
- **Wolken verdecken nichts:** Eine Wolke, die von der Kamera aus vor dem Dorf stünde, schrumpft weg (Bodentreffer des Blicks durch die Wolke liegt im Dorf). Gilt für jede Kamera, auch eingefroren.
- **Echte Blumen** statt flacher Scheiben: Büschel aus Blättern, Stielen und Blüten (zwei Instanz-Meshes, ~170 Dreiecke je Büschel).
- **Ufer:** Sand läuft über Deckkraft weich in die Wiese aus (keine harte Kante, unabhängig von der Grasfarbe), Wasser am Rand heller; Schilf als Büschel mit Kolben statt Kegel; Brücke mit echtem Bogen (Bretter, Träger, Handlauf folgen der Kurve).
- **Fehler gefunden:** Der Wanderweg über die Brücke wurde nie gezeichnet (Brücke führte ins Leere), die Aussichtsbank fehlte. Jetzt Fusspfad (eigene, erdige Farbe) und Bank. Wege mischen ihren Rand mit der Grasfarbe der Stimmung (vorher immer Sommergrün).
- **Häuser detailreicher** (Subagent, von Opus geprüft): Fenster mit Rahmen und Simsen auch seitlich, Türen mit Stufe, Dachüberstände, Sockel; Grundfläche wächst nicht (Test gegen gemessene Ausdehnung).

## 2026-10-23 – Phase 4f, Etappe 3: Baukasten pro Haus, Deko-Katalog
- **Deko-Katalog** (14 Typen) als prozedurale Modelle (`deko-models.ts`), Test: jedes Modell bleibt in seiner Grundfläche aus `catalog.ts` (sonst könnte das Bild eine Überschneidung zeigen, die die Regeln nicht kennen). Gesetzte Deko wird als zwei zusammengeführte Meshes gezeichnet; die Bodenhöhe ist der tiefste Punkt der Grundfläche (nichts schwebt am Hang).
- **Dach als Material statt Form:** Im Konzept stand «Dachform 0–2». Drei Dachformen für acht Haustypen hätten 24 neue Dachgeometrien bedeutet, die jede Stufe und jeden Anbau berühren; der Gewinn an Individualität ist klein. Entscheid: Dach = Farbe/Material (wie Fachbereich, Schiefer, Ziegel). Farbsets (4) ebenso kuratiert, frei wählbare Farben gibt es nicht.
- **Anbau und Gartenfeld neben dem Haus** (`kitLayout`): Plätze aus der grössten Ausdehnung des Haustyps über alle Stufen (Tabelle `HOUSE_EXTENTS`, ein Test hält die Modelle darunter). So verdrängt ein wachsendes Haus nie seinen Anbau. Was nicht passt, wird nicht angeboten (Knopf deaktiviert mit Grund) und vom Server abgewiesen (`checkVarianten`). Bank (Stufe 2) und Baum (Stufe 3) nehmen den Rest; vorher steckte der Baum bei breiten Häusern im Haus (bekannter Fehler aus Etappe 1).
- **Baum im Garten kleiner** (Krone 0.75 m), Stamm innen an der Hecke, die Krone darf darüber hinausragen (liegt höher als die Hecke).

## 2026-10-23 – Phase 4f, Etappe 4: Bau-Modus
- **Bedienung:** «Bauen» in der Leiste (nur Besitzer) ersetzt die Leiste durch eine Werkzeugleiste: Katalog in fünf Gruppen, Klick auf die Wiese setzt, Klick auf Deko oder ein Haus wählt aus. Vorschau grün (passt, ggf. eingerastet) oder rot mit kurzem Grund. Ungültiges lässt sich nicht setzen.
- **Tastatur ohne Maus:** Werkzeug wählen → die Vorschau erscheint an der nächsten gültigen Stelle beim Blickziel; Pfeile verschieben (0.5 m), Q/E drehen (15°), Enter setzt, Entf entfernt, Esc bricht ab, Strg+Z/Y. Ansagen in einer `aria-live`-Region.
- **Speichern** schickt den Entwurf plus Fixierung aller heutigen Quartiere und Häuser (`docForSave`); der Server rechnet die Welt neu und lehnt ab, was nicht passt. Property-Test: 40 zufällige Platzierungen je Seed enden gültig oder werden abgewiesen, gespeicherte Welten haben keine Abweisungen und kein Haus bewegt sich.
- **Entwickler-Vorschau** speichert im Speicher des Dev-Servers (pro Seed), damit Bau-Modus und Neuladen als E2E ohne Datenbank laufen (`tests/e2e/bauen.spec.ts`).

## 2026-10-23 – Phase 4f, Etappe 5/6: UI und Abschluss
- **Mobile:** Leiste einzeilig (3D/Karte, Tageszeit, Reise, Liste, «Mehr» mit Bauen, Haus anlegen, Einstellungen); Kamera im Hochformat weiter weg und steiler, damit das Dorf das Bild füllt (Augenhöhe bleibt); Suchfeld kompakt und klappt beim Tippen auf volle Breite; Bau-Werkzeugleiste als Bottom-Sheet (Desktop: Seitenleiste rechts). Ladehinweis «Das Dorf wird aufgebaut …» statt leerer Fläche.
- **Matrix-Funde (behoben):** Schilf stand auf Brückenbrettern (Uferpunkte prüften die Brücken nicht); Teich- und Seeufer hatten einen harten Sandring; doppelte Modulkürzel auf der Quartiertafel («BAUSTATIK1 · BS · BAUSTATIK1»).
- **Lehre (Uferband):** Ein flaches Band mit beliebigem Umlaufsinn wird unsichtbar (Rückseite) oder mit `DoubleSide` dunkel (three.js dreht die Normale der Rückseite). Richtig: Umlaufsinn über die Fläche des Umrisses bestimmen und die Dreiecke nach oben legen.
- **Lehre (Tests unter Last):** Property-Tests mit vielen Welten brauchen ein eigenes Zeitlimit; neben laufendem Rendering überschreiten sie die 5 s von Vitest.
- **Ergebnis Matrix (230 Bilder, Desktop und Mobile, ohne Seitenfehler):** Desktop 10 Häuser 112–164 Draw Calls / 312–357k Dreiecke, 20 Häuser 117–185 / 402–472k; Mobile 10 Häuser 50–100 / 143–172k, 20 Häuser 50–104 / 178–220k. Frame-Zeiten aus SwiftShader sind nicht aussagekräftig; echte fps auf einem Rechner mit GPU messen.

## 2026-10-23 – E2E bei Gian: Software-Rendering war erzwungen
- **Kontext:** Nach dem Einspielen der Migration liefen 19 von 24 E2E-Tests bei Gian durch; 5 scheiterten an Zeitlimits (Klick in Dialogen «wartet auf stabil», Canvas erscheint nicht in 30 s, Dialog schliesst nicht). Der 3D-Test meldete `frameMs` 191 (≈ 5 Bilder/s).
- **Ursache (Fehler aus 4f):** `playwright.config.ts` erzwang SwiftShader (`--use-angle=swiftshader`), weil die Cloud-Umgebung keine GPU hat. Auf Gians Rechner rendert Chrome damit auf der CPU statt der Grafikkarte; zusammen mit dem Dev-Server ist die CPU ausgelastet.
- **Entscheidung:** Software-Rendering nur noch auf Wunsch (`PW_SOFTWARE_GL=1` oder `PW_CHROMIUM_PATH` gesetzt, also Cloud/CI). Zusätzlich ruht die Animation der Szene, solange ein Dialog über der Welt liegt (spart CPU und Akku auch für Nutzer).
- **Lehre:** Umgebungs-Workarounds (Cloud ohne GPU) nie fest in die gemeinsame Konfiguration schreiben, sondern hinter eine Umgebungsvariable.
