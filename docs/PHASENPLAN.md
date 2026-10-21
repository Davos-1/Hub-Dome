# Hub Dome – Phasenplan (aktueller Stand, Reihenfolge verbindlich)

Dieses Dokument fasst `PLAN.md`, `PLAN-ERWEITERUNG.md` und `PLAN-ERWEITERUNG-2.md` zu **einer** Reihenfolge zusammen und ergänzt die neue Phase 4c. Details stehen in den jeweiligen Plänen. Stand: 2026-10-22.

| Phase | Inhalt | Quelle | Stand |
|---|---|---|---|
| 0 | Abklärungen (Embed-Test, Limits) | PLAN.md | teilweise offen (Embed-Test braucht einen Artifact-Link) |
| 1–3 | Grundgerüst, DB/Auth, 2D-Funktionen, Einladungen | PLAN.md | fertig |
| 3b | Objekttypen, GitHub-/Gist-Vorschau | PLAN-ERWEITERUNG.md | fertig (MCP-Anteil kommt mit Phase 5) |
| 4, 4b | 3D-Dorf, Gestaltung, eigene Zentrale (GLB) | PLAN.md, docs/PLAN-4B-GESTALTUNG.md | fertig |
| 4-Handoff | Design «3D-Dorf Endfassung» (Quartiere, Haustypen, Vollbild) | docs/design_handoff_dorf3d | fertig, Migration `semester` eingespielt |
| **4c** | **Welt-Shell: Dialoge statt Seiten, Start- und Reise-Dialog** | dieses Dokument | **neu, als Nächstes** |
| 5 | MCP-Connector + Skill (+ Zusatz C: `im_topdorf_zeigen`, erst ab 5b aktiv) | PLAN.md, PLAN-ERWEITERUNG-2.md Teil C | offen |
| 5b | Übernehmen + Nutzungsdaten (`/o/<id>`, `copy_artifact`, `item_events`) | PLAN-ERWEITERUNG-2.md Teil A | offen |
| 6 | Deployment, Pilot (vorher: eigener Mailversand, Google-Freigabe, nDSG-Hinweis, Konto löschen) | PLAN.md | offen |
| 6b | Topdorf (erst ab ca. 10 aktiven Nutzern, bis dahin hinter `NEXT_PUBLIC_TOPDORF=true`) | PLAN-ERWEITERUNG-2.md Teil B | offen |
| 7 | OAuth, Gruppendörfer, Likes, Saison-Bestenliste, Haus-Freigabe | PLAN.md, PLAN-ERWEITERUNG-2.md Teil D | später |
| 8, 9 | Datei-Uploads, Pakete | PLAN-ERWEITERUNG.md | nach dem Pilot |

**Warum 4c vor Phase 5:** Phase 5 bringt Token-Verwaltung und die Anleitungsseite `/einstellungen/claude`, Phase 5b das «In mein Dorf»-Popover und Phase 6b den Topdorf-Eintrag in der Reise-Ansicht. Alle drei sollen von Anfang an in der neuen Dialog-Oberfläche landen und nicht erst auf Seiten gebaut und später umgezogen werden.

---

## Wo ist die Oberfläche heute? (Stand nach dem Handoff)

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

## Offene Entscheidungen für Gian

1. Soll der Start-Dialog **jedes Mal** nach dem Login erscheinen, oder nur beim ersten Mal und dann direkt die Welt (mit Button «Dörfer» in der Leiste)? Vorschlag: jedes Mal nach dem Login, aber nicht bei Deep-Links oder Neuladen.
2. Soll die Listenansicht als Seite bleiben (Vorschlag: ja, als Fallback und für Mobile) oder später auch ein Dialog werden?
3. Soll beim Besuch eines fremden Dorfs dessen Besitzer-Name gross eingeblendet werden (Willkommens-Banner «Dorf von @name»)?
