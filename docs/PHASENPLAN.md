# Hub Dome – Phasenplan (aktueller Stand, Reihenfolge verbindlich)

Dieses Dokument fasst `PLAN.md`, `PLAN-ERWEITERUNG.md` und `PLAN-ERWEITERUNG-2.md` zu **einer** Reihenfolge zusammen. Details stehen in den jeweiligen Plänen, Entscheidungen in `docs/ENTSCHEIDUNGEN.md`. Stand: 2026-10-23 (Phase 4f eingefügt).

## Fokusregel bis zum Pilot

Bis Pilot-Feedback vorliegt (Phase 6): **keine neuen 3D-Gestaltungsfunktionen** (Tiere, Modelle, Effekte, neue Stile). Erlaubt sind Fehlerbehebungen, Performance und Barrierefreiheit. Vorrang hat, was den Alltagsnutzen bringt: Freunde verbinden, Objekte aus Claude platzieren, Objekte öffnen. Funktionale Kennzeichnungen, die eine Phase verlangt (z.B. das Übernahme-Band in 5b), gelten nicht als Gestaltung.

**Ausnahme Phase 4f (Entscheid Gian, 2026-10-23):** Für 4f ist die Fokusregel aufgehoben (Begründung im Entscheidungslog). Nach 4f gilt sie wieder bis zum Pilot-Feedback.


## Reihenfolge

| Phase | Inhalt | Quelle | Stand |
|---|---|---|---|
| 0 | Abklärungen: **Link-Test** (Artifact ohne Login, mit zweitem Konto, per iframe), Gratis-Limits | PLAN.md Phase 0 | **erledigt 2026-10-22** (Link geht ohne Login auf, nur wenn geteilt; iframe nicht möglich; Gratis-Limits dokumentieren bleibt offen)|
| 1–3 | Grundgerüst, DB/Auth, 2D-Funktionen, Freigabe | PLAN.md | fertig (Einladungslinks durch Freundschaften ersetzt, siehe 4d) |
| 3b | Objekttypen, GitHub-/Gist-Vorschau | PLAN-ERWEITERUNG.md | fertig (MCP-Anteil kommt mit Phase 5) |
| 4, 4b | 3D-Dorf, Gestaltung | PLAN.md, docs/PLAN-4B-GESTALTUNG.md | fertig (eigene GLB-Modelle am 2026-10-22 entfernt) |
| 4-Handoff | Design «3D-Dorf Endfassung» (Quartiere, Haustypen, Vollbild) | docs/design_handoff_dorf3d | fertig, Migration `semester` eingespielt |
| 4c | Welt-Shell: Dialoge statt Seiten, Start- und Reise-Dialog | dieses Dokument | fertig, committet |
| **4d** | **Feinschliff und Freundschaften:** Holzschild-Stil für alle Dialoge, kleines Anzeige-Fenster, Vogelperspektive beim Haus, keine eigenen Modelle mehr, Freundschaften statt Einladungslinks, alle Seiten in die 3D-Welt eingebettet | docs/ENTSCHEIDUNGEN.md (2026-10-22) | **fertig, committet (`d3c2627`); Migrationen einspielen siehe 4e** |
| **4e** | **Lücken aus 4d schliessen:** Migrationen einspielen, Freundschaftslink, Listen-Dialog, aufräumen, committen | dieses Dokument | **fertig** (Migration 3 eingespielt, RLS 34/34, E2E grün; nur der Link-Test aus Phase 0 steht vor Phase 5 aus) |
| 5 | MCP-Connector + Skill `hub-dome-platzieren` + MCP-Anteil aus 3b (`objekt_typ`, `objekt_platzieren`) + Zusatz C (`im_topdorf_zeigen`, erst ab 5b aktiv) | PLAN.md, PLAN-ERWEITERUNG.md, PLAN-ERWEITERUNG-2.md Teil C | **umgesetzt 2026-10-22** (Tests grün; offen: Abnahme mit MCP Inspector lokal und in claude.ai nach dem Deployment) |
| 5b | Übernehmen + Nutzungsdaten (`/o/<id>`, `copy_artifact`, `item_events`) | PLAN-ERWEITERUNG-2.md Teil A | **fertig 2026-10-22** (Migration eingespielt, RLS 71/71, E2E grün) |
| **4f** | **Die Welt auf das nächste Level:** Regelwerk mit Footprints und Property-Tests, Seed pro Dorf («Welt neu würfeln»), stabile Slots (neue Häuser verschieben nichts), Bau-Modus mit Live-Prüfung, mehr Detail, Nacht, Baukasten pro Haus, Deko-Katalog | docs/PHASE-4F-KONZEPT.md, docs/WELT-ANLEITUNG.md | **Code fertig 2026-10-23**, offen: Freigabe/Commit, Migration `village_worlds` einspielen, `npm run test:rls` und DB-E2E bei Gian |
| 6 | Deployment, Pilot (vorher: eigener Mailversand, Google-Freigabe, nDSG-Hinweis, Konto löschen) | PLAN.md, docs/DEPLOYMENT.md | **Code fertig 2026-10-22** (Datenschutz, Konto löschen, RLS 74/74); offen: Dashboards (Gian), Deploy, Pilot |
| 6b | Topdorf (erst ab ca. 10 aktiven Nutzern, bis dahin hinter `NEXT_PUBLIC_TOPDORF=true`) | PLAN-ERWEITERUNG-2.md Teil B | offen |
| 7 | OAuth, Gruppendörfer, Likes, Saison-Bestenliste, Haus-Freigabe, eigene Modelle nur mit Prüfung | PLAN.md, PLAN-ERWEITERUNG-2.md Teil D | später |
| 8, 9 | Datei-Uploads, Pakete | PLAN-ERWEITERUNG.md | nach dem Pilot |

**Warum 4e vor Phase 5:** 4d ist committet, aber die beiden neuen Migrationen müssen in der Datenbank sein, bevor die Freundschafts-Tests grün laufen. Ausserdem fehlen gegenüber vorher zwei Funktionen (Link für neue Personen, vollständige Liste mit WebGL). Phase 5 baut auf Einstellungen und Freigabe auf; beides soll vorher vollständig und getestet sein.

**Warum Phase 0 jetzt:** Der Kern von Hub Dome sind Links auf claude.ai-Artifacts. Gehen geteilte Links für Freunde nicht auf, verliert die Plattform ihren Kern. Der Test kostet wenig und bestimmt, was Skill und Formular dem Besitzer sagen müssen.

---

# Phase 4e – Lücken aus 4d schliessen

**Ausgangslage nach Phase 4d (committet als `d3c2627`, 2026-10-22):** Freundschaften statt Einladungslinks (Migration `20261022000100_friendships.sql`, `src/app/freunde/actions.ts`, Anfragen im Reise-Dialog), eigene GLB-Modelle entfernt (Migration `20261022000200_remove_custom_model.sql`), Seiten `/einladung/<token>` und `/dorf/<name>/liste` entfernt, neues Anzeige-Fenster (`display-popup.tsx`). Entscheidungen dazu: `docs/ENTSCHEIDUNGEN.md`, Einträge vom 2026-10-22.

## Aufgaben

1. **Migrationen einspielen:** `20261022000100_friendships.sql`, danach `20261022000200_remove_custom_model.sql`, von Gian im SQL-Editor ausführen lassen (falls noch nicht geschehen; im Log ist es als offen vermerkt). Danach `npm run test:rls` und `npm run test:e2e`: Die Freundschafts-Tests aus 4d (RLS und E2E `freigabe`) laufen erst danach grün.
2. **Freundschaftslink** (übernimmt die Aufgabe des alten Einladungslinks, damit keine Funktion verloren geht):
   - Erzeugen im Reise-Dialog: Gültigkeit 7 Tage, 1–100 Nutzungen, widerrufbar. Token nur gehasht speichern, Klartext genau einmal anzeigen (gleiche Regeln wie früher bei der Einladung).
   - Öffnen: `/freund/<token>` zeigt über dem eigenen Dorf den Dialog «@name möchte mit dir befreundet sein». Ohne Konto: Login, dann Onboarding, dann zurück zum Dialog (`next` bleibt erhalten).
   - Annehmen per Button, nicht per GET (Link-Vorschau-Bots). Danach gegenseitiger Zugriff und direkter Sprung ins Dorf des Absenders.
   - **Entscheid Gian beim Start von 4e:** Gilt das Erzeugen des Links als Zustimmung des Absenders, sodass Annehmen genügt (Vorschlag)? Oder entsteht nur eine Anfrage, die der Absender noch bestätigen muss?
   - Technik: eigene Tabelle mit Token-Hash, Ablauf und Nutzungen, Funktion `accept_friend_link(p_token)` (security definer) nutzt `grant_mutual_access`. RLS und Tests wie für jede neue Tabelle (CLAUDE.md).
3. **Listenansicht als Dialog** `?d=liste`: alle Häuser nach Quartier, Objekte pro Haus, mit Icon pro Objekttyp, Filter nach Typ und Suche (Funktionen der früheren 2D-Liste aus Phase 3b). Besitzer sehen Bearbeiten-Knöpfe (öffnen `objektedit`/`hausedit`), Besucher nur Lesen. Immer erreichbar über die Leiste und ein Tastenkürzel, auf Mobile als Vollbild-Sheet. Ersetzt die entfernte Seite; `/dorf/<name>/liste` leitet auf `/dorf/<name>?d=liste` um.
4. **Aufräumen:** Der Kommentar in `src/lib/tokens.ts` verweist noch auf `accept_invite`; beim Bau des Freundschaftslinks anpassen. (`tmp-shots.spec.ts` ist bereits weg, sonst keine Altlasten im Code.)
5. **Prüfen und einchecken:** `npm run check`, `npm run test:e2e` und `npm run test:rls` grün, dann committen.

## Abnahme Phase 4e

- [ ] Migrationen eingespielt, die Freundschafts-Tests aus 4d sind grün (RLS inkl. «keine privaten Objekte für Freunde», E2E `freigabe`).
- [ ] Freundschaftslink: Eine neue Person ohne Konto registriert sich über den Link, kommt nach dem Onboarding zurück zum Dialog und landet nach dem Annehmen direkt im Dorf des Absenders. Ein abgelaufener oder widerrufener Link zeigt eine klare Meldung.
- [ ] Listen-Dialog: Alles, was in 3D erreichbar ist, ist auch dort erreichbar, inklusive Typ-Icons und Typ-Filter. Bedienbar mit Tastatur und Screenreader. `/dorf/<name>/liste` leitet um.
- [ ] Lint, Typecheck, Unit-, E2E- und RLS-Tests grün, alles committet.

## Oberfläche heute (nach 4d)

| Bereich | Stand |
|---|---|
| 3D-Dorf | Vollbild, Leiste unten, Brotkrumen, Suche, Fenster rechts für Details (Quartier, Haus, Objekt), kleines Anzeige-Fenster (Tageszeit, Ansicht, Filter) |
| Dialoge | Start, Reise (Dörfer, Freunde, Anfragen), Einstellungen (Profil, Dorf), Objekt und Haus anlegen bzw. bearbeiten |
| Liste | Seite in 4d entfernt, kommt als Dialog in 4e. Ohne WebGL zeigt das Dorf eine einfache Liste |
| Einrichtung | `/login`, `/onboarding` (Seiten) |

---

## Ausgangslage vor Phase 4c (Historie, Stand nach dem Handoff)

| Bereich | Heute | Erreichbar über |
|---|---|---|
| 3D-Dorf | Vollbild, Leiste unten, Brotkrumen, Suche, Fenster rechts (Einstellungen: Tageszeit, Ansicht, Filter; Details zu Quartier, Haus, Objekt) | `/dorf/<name>` |
| Konfiguration | **eigene Seite** `/einstellungen`: Profilname, Zentrale-Stil mit Vorschau, GLB-Upload, Einladungen, Zugriffe entziehen | Link im rechten Fenster |
| Dörfer | **eigene Seite** `/doerfer`: Karten (eigenes und freigegebene Dörfer) | Link im rechten Fenster, Ziel nach dem Login |
| Verwalten (Häuser, Objekte) | **eigene Seite** `/dorf/<name>/liste` (2D) | Link unten links, Baustellenschild |
| Einrichtung | `/onboarding`, `/einladung/<token>`, `/login` | Login-Ablauf, Einladungslink |

Das 3D-Dorf ist also Vollbild, die Konfiguration steckt aber weiterhin in getrennten Seiten. Genau das löst Phase 4c.

---

# Phase 4c – Welt-Shell (Dialoge statt Seiten)

> **Abgeschlossen, Historie.** Die Teile zu Einladungen, GLB-Upload und Listenseite sind durch Phase 4d überholt.
>
> **Warum 4c vor Phase 5:** Phase 5 bringt Token-Verwaltung und die Anleitung (Tab «Claude»), Phase 5b das «In mein Dorf»-Popover und Phase 6b den Topdorf-Eintrag in der Reise-Ansicht. Alle drei sollen von Anfang an in der Dialog-Oberfläche landen und nicht erst auf Seiten gebaut und später umgezogen werden.

**Ziel:** Nach dem Login lädt die eigene Welt sofort im Hintergrund (unscharf), darüber liegt ein grosser Dialog mit dem Einstieg. Konfiguration, Dörfer-Reise, Teilen und Einladung laufen als Dialoge über derselben Szene. Man verlässt die Welt nie für eine Konfigurationsseite.

## Grundprinzipien

1. **Eine Welt, viele Dialoge.** Die Szene (`VillageView`) bleibt gemountet. Dialoge öffnen darüber, der Hintergrund wird unscharf (CSS `backdrop-filter`, auf Mobile und `lowDetail` nur abgedunkelt statt blur).
2. **Dialog-Zustand liegt in der URL** (`?d=start|reise|einstellungen|teilen|haus-neu|…`). So funktionieren Zurück-Taste, Neuladen und Deep-Links (z.B. Einladungslink, Mail). Technisch Query-Parameter im bestehenden `/dorf/[username]`, keine parallelen Routen.
3. **Seiten bleiben als Fallback.** `/dorf/<name>/liste` bleibt (Barrierefreiheit, Verwaltung grosser Dörfer, Mobile). `/einstellungen`, `/doerfer`, `/onboarding` leiten auf `/dorf/<eigener>?d=…` um. Jeder Dialog ist per Tastatur bedienbar (Fokusfalle, Esc, `aria-modal`, Fokus zurück).
4. **Gleiche Inhalte, gleiche Server Actions.** Die bestehenden Formulare (`ActionForm`, `StyleSettings`, `ModelUpload`, `InviteForm`) werden in Dialoge eingebettet, nicht neu geschrieben.

## Dialoge

| Dialog | Inhalt | Ersetzt |
|---|---|---|
| **Start** (nach Login, jedes Mal wenn man nicht direkt ein Dorf per Link öffnet) | Begrüssung mit Namen, «Mein Dorf betreten» (schliesst den Dialog, Kamera fliegt ein), «Dörfer besuchen», «Einstellungen», Kurzstatus (Häuser, Objekte, neue Objekte seit dem letzten Besuch), Hinweis «Teile keine Lösungen zu bewerteten Leistungsnachweisen.» Beim ersten Login zuerst der Einrichtungs-Dialog (Benutzername, Anzeigename, optional Zentrale-Stil). | `/doerfer` als Einstieg, `/onboarding` |
| **Reise** | Karten aller zugänglichen Dörfer: eigenes zuoberst, später **Topdorf** darüber (6b), dann freigegebene Dörfer mit Besitzer, Häuser, Objekte, letzte Aktivität. Wahl lädt dieses Dorf mit Überblendung (Fade, Kamera fliegt weg und ein), die Szene wird nicht neu gestartet. Eingeladene Dörfer verlassen. «Einladungslink einlösen» als Feld. | `/doerfer` |
| **Einstellungen** (Tabs) | **Profil** (Name, Konto löschen später), **Dorf** (Zentrale-Stil mit Vorschau, GLB-Upload), **Teilen** (Einladungen, Wer sieht mein Dorf, Zugriff entziehen), **Claude** (Phase 5: Token, Connector-URL, Skill, Anleitung), **Anzeige** (Tageszeit, Ansicht, Filter; heute im rechten Fenster) | `/einstellungen`, `/einstellungen/claude` |
| **Haus/Objekt hinzufügen** (Besitzer) | Schnellformular direkt aus dem 3D (Baustellenschild, Button im Haus-Fenster). Phase 5b ergänzt «In mein Dorf» im Objekt-Fenster. | Sprung in die Liste |
| **Einladung annehmen** (`/einladung/<token>`) | Dialog «X lädt dich ein» über der Szene von X (Vorschau, falls erlaubt) oder über dem eigenen Dorf; Annehmen führt direkt in das Dorf (löst den offenen Punkt «Einladung führt nach dem Onboarding nur auf Meine Dörfer»). | Seite `/einladung` |

Das rechte Fenster bleibt für **Details** (Quartier, Haus, Objekt). Einstellungen wandern in den Dialog.

## Ablauf nach dem Login

1. Login (Magic Link/Google) → Callback leitet auf `/dorf/<eigener>?d=start` (neu) statt `/doerfer`.
2. Die Szene lädt sofort im Hintergrund. Ein ruhiger Ladezustand (Fortschritt «Dorf wird aufgebaut») liegt auf dem Start-Dialog, der Dialog ist von Anfang an bedienbar.
3. «Mein Dorf betreten»: Dialog blendet aus, Blur verschwindet, Kamera fliegt von weit aussen in die Übersichtspose.
4. «Dörfer besuchen» öffnet den Reise-Dialog. Wahl eines Dorfs: Dialog zu, Überblendung, neues Dorf lädt, Brotkrumen zeigen «@name › Dorf».
5. Besuchte Dörfer sind **nur lesbar**: keine Bearbeiten-Links, keine Baustellenschilder, dafür (ab 5b) «In mein Dorf».

## Technik (Skizze)

- `scene-store.ts`: neues Feld `dialog: null | { id; … }`; `panel` bleibt für Leiste und Filter. Dialoge als Komponenten unter `src/components/world/` (`dialog-shell.tsx` mit Fokusfalle, `start-dialog.tsx`, `travel-dialog.tsx`, `settings-dialog.tsx`, `invite-dialog.tsx`).
- `VillageView` wird zur Welt-Shell, die auch das Wechseln des Dorfs kennt (neue Daten laden ohne die Canvas-Instanz zu zerstören). Daten kommen weiterhin serverseitig per RLS; zusätzlich ein schlanker Endpunkt bzw. eine Server Action «Dorf laden» für den Wechsel ohne Seitenwechsel. Alternative: normale Navigation innerhalb eines gemeinsamen Layouts, bei der die Canvas im Layout bleibt (`app/dorf/layout.tsx`). **Vorschlag:** gemeinsames Layout, weil damit URLs, Zurück-Taste und Server-Daten ohne Sonderlösung stimmen.
- Cache Components: Dialoge sind Client-Komponenten, Daten für Reise/Einstellungen per Server Components im Layout oder Server Actions (Suspense-Regeln aus `ENTSCHEIDUNGEN.md`).
- `lowDetail`/Mobile: kein Blur, Dialog als Vollbild-Sheet.

## Abnahme Phase 4c

- [ ] Login → Start-Dialog über unscharfer eigener Welt; Szene lädt im Hintergrund; Dialog sofort bedienbar
- [ ] Alle Funktionen der Seiten `/einstellungen` und `/doerfer` sind in Dialogen erreichbar; alte URLs leiten um
- [ ] Reise in ein freigegebenes Dorf und zurück ohne Seitenneuladen der Szene; Besucher sehen keine Bearbeiten-Elemente
- [ ] Einladungslink annehmen führt direkt in das Dorf
- [ ] Tastatur: Fokusfalle, Esc, Fokus kehrt zurück; Screenreader-Beschriftungen; reduced motion ohne Fahrten
- [ ] Performance wie Phase 4 (Dialog offen: Szene rendert nur bei Bedarf, kein Dauer-Blur auf `lowDetail`)
- [ ] E2E angepasst (`dorf3d`, `freigabe`, `gestaltung`) und neuer Test für Start- und Reise-Dialog

## Umsetzung (2026-10-22) und Entscheidungen

- Start-Dialog erscheint **bei jedem Login** (`/start` leitet auf `/dorf/<eigener>?d=start`), nicht bei Deep-Links oder Neuladen. Die Kamera beginnt weit draussen und fliegt nach «Mein Dorf betreten» ein.
- Besuch eines fremden Dorfs zeigt das **Willkommens-Banner «Dorf von …»** (7 s, mit «Zurück in mein Dorf»); Besucher sehen keine Bearbeiten-Knöpfe.
- Dialoge: Start, Reise, Einstellungen (Profil, Dorf, Teilen, Anzeige), Objekt hinzufügen, Haus anlegen, Einladung. Alte Adressen `/doerfer` und `/einstellungen` leiten um; `/einladung/<token>` zeigt den Dialog über dem eigenen Dorf und führt nach dem Annehmen direkt ins Dorf.
- **Listenansicht** bleibt vorerst eine Seite; Gian möchte sie **später auch als Dialog** (offen, nach Phase 5/6 einplanen). → Überholt: Seite in 4d entfernt, Listen-Dialog folgt in Phase 4e.
- `/onboarding` bleibt vorerst eine Seite (vor dem ersten Login existiert noch kein Dorf, das im Hintergrund laden könnte). Idee für später: Platzhalter-Dorf als Hintergrund.
- Noch offen aus dem Konzept: Claude-Tab (kommt mit Phase 5), Konto löschen (Phase 6), Topdorf-Karte im Reise-Dialog (Phase 6b).

## Ursprüngliche Entscheidungen für Gian (beantwortet)

1. Soll der Start-Dialog **jedes Mal** nach dem Login erscheinen, oder nur beim ersten Mal und dann direkt die Welt (mit Button «Dörfer» in der Leiste)? Vorschlag: jedes Mal nach dem Login, aber nicht bei Deep-Links oder Neuladen.
2. Soll die Listenansicht als Seite bleiben (Vorschlag: ja, als Fallback und für Mobile) oder später auch ein Dialog werden?
3. Soll beim Besuch eines fremden Dorfs dessen Besitzer-Name gross eingeblendet werden (Willkommens-Banner «Dorf von @name»)?
