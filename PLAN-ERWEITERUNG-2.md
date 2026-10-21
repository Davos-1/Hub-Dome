# Hub Dome – Erweiterung 2: «Übernehmen» und «Topdorf»

> **Für Claude Code:** Ergänzung zu `PLAN.md` und `PLAN-ERWEITERUNG.md`. Gilt **ab dem aktuellen Stand** (Phase 4 inkl. Design-Handoff abgeschlossen). Reihenfolge:
>
> 1. **Phase 5** (MCP-Connector + Skill) wie geplant, mit den kleinen Zusätzen aus Abschnitt C
> 2. **Phase 5b** – Übernehmen + Nutzungsdaten (dieses Dokument, Teil A)
> 3. **Phase 6** – Deployment und Pilot (unverändert)
> 4. **Phase 6b** – Topdorf (dieses Dokument, Teil B), erst wenn mindestens ca. 10 aktive Nutzer da sind
>
> Alle Änderungen sind **additiv**: neue Migrationsdateien, keine bestehenden ändern. Gian spielt sie im SQL-Editor ein. Vor dem Start jeder Phase `docs/ENTSCHEIDUNGEN.md` lesen und Entscheidungen dort nachtragen. Nach jeder Phase stoppen und zusammenfassen.

---

## Begriffe

| Begriff | Bedeutung |
|---|---|
| **Original** | Objekt, das jemand selbst angelegt hat (`is_copy = false`) |
| **Übernahme** | Eintrag im eigenen Dorf, der auf das Objekt einer anderen Person zeigt (`is_copy = true`). Technisch ein **Lesezeichen mit Herkunft**: gleiche URL, eigene Platzierung, eigener Titel möglich |
| **Eigene Version** | Eine Übernahme, deren Link durch eine eigene, angepasste Version ersetzt wurde (z.B. in Claude neu erstellt). Gilt danach als Original mit dem Vermerk «basiert auf @name» |
| **Topdorf** | Automatisch kuratiertes Dorf mit den meistgenutzten Objekten aller Nutzer, die das erlaubt haben |

## Wichtige technische Grenze (nicht umgehen)

Hub Dome **kann keine echte Kopie eines Claude-Artifacts im claude.ai-Konto einer anderen Person erzeugen**: Es gibt keine Schnittstelle dafür. Der Inhalt bleibt bei claude.ai, und den Zugriff auf den Inhalt regelt die Freigabe auf claude.ai. Darum:

- «Übernehmen» = Verweis im eigenen Dorf (sofort, ein Klick).
- «Eigene Version» = Die Person erstellt in Claude selbst eine angepasste Version und verknüpft danach den neuen Link.
- **Abklärung zu Beginn von 5b:** Prüfen, ob claude.ai bei geteilten Artifacts aktuell eine Funktion zum Anpassen/Remixen anbietet und wie sie heisst. Falls ja, im Hinweistext darauf verweisen. Ergebnis in `docs/ENTSCHEIDUNGEN.md` festhalten. Nichts raten.

---

# Teil A – Phase 5b: Übernehmen + Nutzungsdaten

Ziel: Gute Objekte aus freigegebenen Dörfern mit einem Klick ins eigene Dorf holen. Gleichzeitig wird erfasst, wie viele **verschiedene** Personen ein Objekt öffnen oder übernehmen. Das ist die Datengrundlage für das Topdorf. Die Erfassung startet bewusst **vor dem Pilot**, damit bis zum Topdorf schon Daten vorhanden sind.

## A1 – Migration `…_copy_and_events.sql`

```sql
-- Herkunft und Erlaubnisse pro Objekt
alter table artifacts
  add column is_copy boolean not null default false,
  add column source_artifact_id uuid references artifacts(id) on delete set null,
  add column source_owner_id uuid references profiles(id) on delete set null,
  add column allow_copy boolean not null default true,     -- Besitzer erlaubt Übernehmen
  add column topdorf_ok boolean not null default false;    -- Besitzer erlaubt Topdorf (Opt-in)

alter table artifacts
  add constraint artifacts_copy_private  check (not is_copy or visibility = 'private'),
  add constraint artifacts_copy_no_top   check (not is_copy or topdorf_ok = false),
  add constraint artifacts_no_self_src   check (source_artifact_id is null or source_artifact_id <> id);

create index artifacts_source_idx on artifacts(source_artifact_id);
create index artifacts_topdorf_idx on artifacts(topdorf_ok) where topdorf_ok;
```

**Schutz der Herkunftsfelder (Trigger `artifacts_guard_copy`, before insert/update):**
- Clients dürfen `is_copy`, `source_artifact_id` und `source_owner_id` **nicht selbst setzen**. Nur die Funktion `copy_artifact` darf das. Sie setzt dafür lokal `set_config('hubdome.copying','on', true)`, der Trigger prüft diese Einstellung.
- Beim Insert ohne diese Einstellung werden die drei Felder auf `false`/`null` erzwungen.
- Beim Update bleiben `source_*` unverändert. `is_copy` darf nur von `true` auf `false` wechseln.
- **Automatisch:** Ändert sich bei einer Übernahme die `url`, wird `is_copy = false` gesetzt («eigene Version»). `source_*` bleibt als Herkunft («basiert auf»).

**Nutzungsereignisse** (eine Zeile pro Person, Objekt und Art, also automatisch «verschiedene Nutzer»):

```sql
create table item_events (
  artifact_id uuid not null references artifacts on delete cascade,
  user_id     uuid not null references profiles  on delete cascade,
  event       text not null check (event in ('geoeffnet','uebernommen')),
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  primary key (artifact_id, user_id, event)
);
alter table item_events enable row level security;
-- Keine Policies für Clients: Zugriff nur über die security-definer-Funktionen unten.
```

**Hilfsfunktion Sichtbarkeit** (security definer, stable):

```sql
-- Darf der aktuelle User dieses Objekt sehen?
-- Besitzer, oder geteilt + Dorfzugriff, oder Topdorf-freigegebenes Original.
create function can_view_artifact(a uuid) returns boolean ...
```

Die Policy `artifacts_select` wird **ersetzt** (drop + create in der neuen Migration) durch:
`owner_id = auth.uid() or (visibility = 'shared' and can_view_village(house_village(house_id))) or (topdorf_ok and visibility = 'shared' and not is_copy)`.

> Hinweis für die Doku: `topdorf_ok` bedeutet «für alle angemeldeten Hub-Dome-Nutzer sichtbar». Das ist heute gleichbedeutend mit «Studiengang». Wird Hub Dome später für weitere Studiengänge geöffnet, muss diese Regel um eine Studiengangs-Zuordnung ergänzt werden. In `ENTSCHEIDUNGEN.md` vermerken.

**Funktionen (security definer, `set search_path = public`):**

1. `copy_artifact(p_source uuid, p_house uuid) returns uuid`
   - Fehler `nicht_gefunden`, wenn `not can_view_artifact(p_source)` oder die Quelle selbst eine Übernahme ist
   - Fehler `eigenes_objekt`, wenn die Quelle dem Aufrufer gehört
   - Fehler `nicht_erlaubt`, wenn `allow_copy = false`
   - Fehler `haus_ungueltig`, wenn `not is_village_owner(house_village(p_house))`
   - Fehler `bereits_vorhanden` bei `unique (owner_id, url)`
   - Insert: Titel, Beschreibung, `kind`, `item_type`, `meta`, `tags`, `url` von der Quelle; `owner_id = auth.uid()`, `house_id = p_house`, `visibility = 'private'`, `is_copy = true`, `source_*` gesetzt, `allow_copy = false`, `topdorf_ok = false`
   - Danach Ereignis `uebernommen` für die Quelle erfassen
2. `record_item_event(p_artifact uuid, p_event text) returns void`
   - Nur, wenn `can_view_artifact(p_artifact)`. Eigene Objekte werden nicht gezählt
   - Ist das Objekt eine Übernahme mit noch vorhandener Quelle, wird das Ereignis der **Quelle** gutgeschrieben (Öffnen über die Übernahme zählt fürs Original)
   - Upsert: `first_at` bleibt, `last_at = now()`
3. `item_stats(p_ids uuid[]) returns table(artifact_id uuid, geoeffnet int, uebernommen int)`
   - Liefert **nur Zahlen** und nur für Objekte, die dem Aufrufer gehören. Wer geöffnet hat, wird nie angezeigt (Datensparsamkeit)

## A2 – Öffnen mit Zählung

- Neue Route `src/app/o/[id]/route.ts` (GET): UUID mit Zod prüfen, eingeloggte Session verlangen (sonst `/login?next=…`), `record_item_event(id,'geoeffnet')` per RLS-Client, URL per RLS-Client lesen, **302** auf die Objekt-URL. Nicht sichtbar ergibt 404.
- Alle «Öffnen»-Links (`hud/side-window.tsx`, `components/list/house-section.tsx` und künftige) zeigen auf `/o/<id>`, und zwar als normales `<a target="_blank" rel="noopener noreferrer">`, **nicht** als `next/link` (kein Prefetch, sonst entstehen Phantom-Zählungen).
- `proxy.ts`: `/o/*` ist **nicht** öffentlich.

## A3 – Übernehmen (Oberfläche)

**Wo:** Bei jedem fremden Objekt, das man sieht:
- 3D: Objekt-Detail in `hud/side-window.tsx`
- 2D: Objektkarte in der Listenansicht
- Später auch im Topdorf

Nicht sichtbar bei eigenen Objekten, bei `allow_copy = false` (dann grauer Hinweis «Besitzer hat Übernehmen deaktiviert») und bei bereits übernommenen Objekten (dann «Schon in deinem Dorf · Ansehen»).

**Ablauf «In mein Dorf»** (Button plus Tastenkürzel **K**, wenn ein Objekt angeheftet ist und kein Eingabefeld den Fokus hat):
1. Kleines Popover mit Hausauswahl. **Vorschlag zuoberst:** eigenes Haus mit gleichem `module_code`. Falls keines existiert: Option **«Haus ‹Modultitel› anlegen und übernehmen»** (ein Klick, Server Action legt das Haus an und ruft danach `copy_artifact` auf). Darunter die übrigen eigenen Häuser, gruppiert nach Fachbereich (`fachbereiche.ts`).
2. Erfolgsmeldung «In ‹Haus› übernommen» mit Link «Ansehen». Fehlercodes in Schweizer Deutsch übersetzen.
3. Server Action in `src/app/dorf/actions.ts` (`copyArtifact`), Zod-Validierung, RPC per RLS-Client, danach `revalidatePath`.

**Darstellung von Übernahmen im eigenen Dorf:**
- 2D und Panel: Badge «übernommen von @username» (Link zu deren Dorf, falls Zugriff) bzw. «Original entfernt», wenn `source_artifact_id` null ist.
- 3D: dezente Markierung am Sockel (z.B. schmales Band in Akzentfarbe). Muss zusammengeführte Geometrie bleiben, keine zusätzlichen Draw Calls pro Objekt.
- Aktion **«Eigene Version verknüpfen»**: Feld für neuen Link. Nach dem Speichern wird es per Trigger zum Original mit «basiert auf @username». Hinweistext: «Passe das Objekt in Claude an und füge hier den Link deiner Version ein.» Ergänzen mit dem Ergebnis der Abklärung oben.
- Übernahmen sind immer privat (Constraint). Sichtbarkeitsauswahl im Formular bei Übernahmen ausblenden, mit Hinweis «Übernahmen sind nur für dich sichtbar».

**Für Besitzer (Objektformular `artifact-form.tsx`):**
- Schalter «Andere dürfen übernehmen» (Standard an)
- Schalter «Im Topdorf zeigen» (Standard **aus**, Erklärung: «Für alle angemeldeten Hub-Dome-Nutzer sichtbar, mit deinem Namen»). Nur bei `visibility = 'shared'` aktivierbar.
- Anzeige im Panel und in der Liste: «Von X Personen geöffnet · Y× übernommen» (via `item_stats`)
- In `/einstellungen`: Sammelaktion «Alle meine geteilten Objekte fürs Topdorf freigeben / zurückziehen»

## A4 – Entscheidungen (in `ENTSCHEIDUNGEN.md` übernehmen)

- Entzieht der Besitzer den Dorfzugriff, macht ein Objekt privat oder schaltet `allow_copy` aus, **bleiben bestehende Übernahmen erhalten**. Sie enthalten nur Titel und Link, die die Person schon gesehen hat, ähnlich wie ein Lesezeichen. Ob der Link noch funktioniert, entscheidet claude.ai. → **Gian bestätigt oder ändert diese Regel vor der Umsetzung.**
- Wird das Original gelöscht, bleibt die Übernahme mit dem Vermerk «Original entfernt».
- Eigene Objekte und Übernahmen zählen nie für das Ranking des eigenen Objekts.

## A5 – Tests und Abnahme Phase 5b

**RLS-/DB-Tests (`tests/rls`):**
- [ ] B übernimmt ein geteiltes Objekt von A: Die Übernahme ist privat, gehört B, Quelle gesetzt; A sieht B's Übernahme nicht
- [ ] B ohne Dorfzugriff → `nicht_gefunden`; A übernimmt eigenes Objekt → `eigenes_objekt`; `allow_copy=false` → `nicht_erlaubt`; fremdes Zielhaus → `haus_ungueltig`; zweimal → `bereits_vorhanden`
- [ ] Client kann `is_copy`/`source_*` weder per Insert noch per Update setzen
- [ ] URL-Änderung an einer Übernahme setzt `is_copy=false`, die Quelle bleibt
- [ ] Übernahme kann nicht auf `shared` oder `topdorf_ok` gesetzt werden
- [ ] `record_item_event`: Besitzer zählt nicht; doppeltes Öffnen ergibt eine Zeile; Öffnen über eine Übernahme zählt für die Quelle; ohne Sichtrecht keine Zeile
- [ ] `item_stats` liefert nur eigene Objekte; `item_events` ist für Clients direkt nicht lesbar
- [ ] `topdorf_ok`-Original ist für einen fremden User ohne Dorfzugriff lesbar, ein privates nicht

**E2E (`tests/e2e/uebernehmen.spec.ts`):**
- [ ] B öffnet A's Dorf → Objekt → «In mein Dorf» → Vorschlag «Haus anlegen und übernehmen» → Objekt erscheint in B's Dorf mit Badge
- [ ] B verknüpft eine eigene Version, das Badge wechselt zu «basiert auf»
- [ ] Öffnen über `/o/<id>` erhöht A's Zähler um genau 1, auch bei zweimaligem Öffnen

**Abnahme:** Alle Tests grün, `npm run check` grün, Datenschutzhinweis um «Nutzungszahlen (wer was geöffnet/übernommen hat, nur als Zahl für Besitzer und Ranking)» ergänzt.

---

# Teil B – Phase 6b: Topdorf

Ziel: Ein gemeinsames, **automatisch kuratiertes** Dorf mit den besten Objekten. Jedes Modulhaus hat nur eine **begrenzte Anzahl Plätze**. Wer oben bleiben will, muss genutzt werden.

**Start erst, wenn ca. 10 aktive Nutzer und Daten aus dem Pilot vorhanden sind.** Vorher wäre das Dorf wegen der Mindestschwelle leer. Bauen darf man es früher, die Seite bleibt bis dahin hinter `NEXT_PUBLIC_TOPDORF=true` versteckt.

## B1 – Ranking

Konstanten in **einer** Stelle (`src/lib/ranking.ts`, von SQL gespiegelt und per Test abgeglichen):

| Grösse | Wert (Start) |
|---|---|
| Gewicht «geöffnet» | 1 |
| Gewicht «übernommen» | 3 |
| Halbwertszeit | 30 Tage (auf `last_at`) |
| Mindestens verschiedene Nutzer | 3 (ohne Besitzer) |
| Plätze pro Haus | 5 |
| Max. Objekte pro Person pro Haus | 2 (damit nicht eine Person ein Haus füllt) |

`score = Σ über (Nutzer, Ereignis) Gewicht × 0.5^(Alter_in_Tagen / 30)`

Kandidaten: `topdorf_ok`, `visibility='shared'`, `not is_copy`.

## B2 – Datenbank

Funktion `topdorf_items(p_slots int default 5)` (security definer, stable), liefert pro Objekt:
`artifact_id, title, description, kind, item_type, meta, url-freie Felder, owner_username, owner_display_name, module_code, house_title, score, distinct_users, rank_in_house, created_at`

- Gruppierung nach `houses.module_code` des Originals. Themenhäuser (`module_code is null`) kommen in **ein** Sammelhaus «Themen» (Fachbereich «Weitere»).
- `rank_in_house` per Fensterfunktion, gefiltert auf `<= p_slots` und die Regel «max. 2 pro Person».
- **URL wird nicht mitgeliefert.** Öffnen läuft immer über `/o/<id>`, damit gezählt wird.
- Für Clients ausführbar (`authenticated`). Die Funktion liefert ausschliesslich Topdorf-freigegebene Originale.
- SQL-Tests mit Testdaten: Schwelle, Halbwertszeit, Platzlimit, Regel «max. 2 pro Person», Übernahmen und private Objekte erscheinen nie.

## B3 – Seite `/topdorf`

- Schutz: `requireProfile()`. Daten über `topdorf_items` mit dem RLS-Client. Ergebnis maximal ca. alle 15 min neu berechnen (Cache Components: `"use cache"` + `cacheLife`, gemäss aktueller Next-16-Doku; Regeln aus `ENTSCHEIDUNGEN.md` zu `connection()`/Suspense beachten).
- **Wiederverwendung der bestehenden Szene:** Aus den Ergebnissen ein synthetisches Dorf bauen (Häuser = Module mit stabiler ID `top:<module_code>`, Objekte = Topdorf-Einträge) und an `buildVillageModel` bzw. `VillageScene` übergeben. Quartiere, Haustypen und Farben ergeben sich wie gewohnt aus `fachbereiche.ts`. Keine zweite Szene bauen.
- **Nur-Lese-Modus** (neuer Prop, z.B. `mode: "topdorf"`): keine Baustellenschilder, keine Bearbeiten-Links, keine Kaminrauch-Logik nach «neu», stattdessen:
  - Zentrale mit Namensschild «Topdorf» (Stil: Gian wählt, Vorschlag `leuchtturm`)
  - Objekt-Karte zeigt **Rang** (1–5), Titel, «von @username», «X Personen»
  - Anschlagbrett am Dorfplatz: «Neu im Topdorf» (seit letzter Woche aufgestiegen)
  - Button «In mein Dorf» (Teil A) und «Öffnen» (über `/o/<id>`)
- 2D-Fallback `/topdorf/liste`: Module als Abschnitte, Objekte nach Rang.
- «Meine Dörfer»: Karte **Topdorf** ganz oben (über dem eigenen Dorf), mit Anzahl Objekte und Häuser.
- Leerer Zustand: «Noch zu wenig Daten. Objekte erscheinen hier, sobald mindestens 3 Personen sie genutzt haben.» plus Link zur Freigabe-Einstellung.

## B4 – Abnahme Phase 6b
- [ ] SQL-Tests des Rankings grün
- [ ] E2E: Objekt mit `topdorf_ok`, das von 3 verschiedenen Testnutzern geöffnet wurde, erscheint im passenden Modulhaus; ohne Opt-in erscheint es nicht
- [ ] Ein Haus zeigt nie mehr als 5 Objekte und nie mehr als 2 derselben Person
- [ ] Performance wie Phase 4 (Topdorf mit 30 Häusern × 5 Objekten < 250 Draw Calls)
- [ ] Ein User ohne Zugriff auf A's Dorf kann ein Topdorf-Objekt von A öffnen und übernehmen, aber nicht A's Dorf sehen

---

# Teil C – Zusätze zu Phase 5 (MCP), klein

- `artifact_platzieren` / `objekt_platzieren`: optionaler Parameter `im_topdorf_zeigen` (bool, Standard `false`). Spalte `topdorf_ok` existiert erst ab 5b: Parameter erst nach Migration 5b aktivieren, vorher ignorieren und so dokumentieren.
- Skill-Vorlage: **nicht** von sich aus nach Topdorf fragen. Nur setzen, wenn der User es ausdrücklich sagt.
- Kein MCP-Tool zum Übernehmen fremder Objekte (Claude kennt die IDs nicht, und es ist im Web einfacher).

---

# Teil D – Später (Phase 7, nicht jetzt)

- **Gruppendörfer:** gemeinsames Dorf mit mehreren Besitzern, z.B. für Gruppenarbeiten in DC-Studios. Braucht eine Rollentabelle (`village_members`) und angepasste RLS. Erst nach Topdorf und nur bei Bedarf.
- Ranking-Signal «Gefällt mir» oder «hilfreich», falls Öffnen/Übernehmen im Pilot nicht aussagekräftig genug ist.
- Saisonale Bestenliste (pro Semester) im Topdorf.
