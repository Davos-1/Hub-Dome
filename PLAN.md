# Hub Dome – Bauplan für Claude Code

> **Stand 2026-10-22:** Reihenfolge und Fortschritt stehen in `docs/PHASENPLAN.md`, Entscheidungen in `docs/ENTSCHEIDUNGEN.md`. Weicht dieser Plan vom Entscheidungslog ab, gilt das Log. Der frühere Arbeitstitel war «Campusdorf».

> **Für Claude Code:** Dieses Dokument ist die verbindliche Spezifikation. Arbeite die Phasen **der Reihe nach** ab. Nach jeder Phase: Abnahmekriterien prüfen, Ergebnis kurz zusammenfassen, auf Freigabe warten. Bei Unklarheiten oder wenn eine Annahme hier nicht stimmt (z.B. Paketname veraltet): **nachfragen statt raten**. Prüfe aktuelle Paketversionen und APIs selbst nach, bevor du sie einsetzt.

---

## 1. Vision in einem Satz

Jede Person aus dem Studiengang hat ein eigenes **3D-Dorf**: In der Mitte steht die **Zentrale**, darum herum ein **Haus pro Modul bzw. Thema**. In den Häusern liegen die **Claude-Artifacts** der Person als anklickbare Objekte. Freunde (Freundschaft gilt gegenseitig) sehen das Dorf im Reise-Dialog, früher «Meine Dörfer».

## 2. Rahmenbedingungen

| Punkt            | Festlegung                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Zielgruppe       | Zuerst nur ein Studiengang (HSLU Digital Construction), ca. 20–80 Personen                                                    |
| Inhalte          | Kern: Claude-Artifact-Links (`https://claude.ai/...`); ab Phase 3b weitere Objekttypen, siehe PLAN-ERWEITERUNG.md                                                                           |
| Login            | Unabhängig von der HSLU-Mail: Mail-Link (Magic Link) + Google                                                                 |
| Sichtbarkeit     | Privat. Nur Freunde sehen das Dorf (gegenseitig, nach angenommener Anfrage). Ausnahme ab 6b: einzelne Objekte mit Topdorf-Opt-in                                                                |
| Darstellung      | 3D ist zentral, dazu eine Listenansicht als Dialog (Mobile, Barrierefreiheit)                                            |
| Kosten           | Gratis-Stufen: Vercel Hobby + Supabase Free                                                                                   |
| Sprache UI       | Deutsch (Schweizer Schreibweise, **kein ß**)                                                                                  |
| Claude-Anbindung | Eigener **Remote-MCP-Connector** + **Skill**. Gratis-Accounts dürfen genau einen eigenen Connector nutzen, Pro beliebig viele |

## 3. Tech-Stack

- **Next.js** (App Router, TypeScript, strict) – ein einziges Repo und Projekt
- **React Three Fiber** + **@react-three/drei** für 3D
- **Tailwind CSS** für die 2D-UI
- **Supabase**: Auth, Postgres, Row Level Security (RLS)
- **Zod** für die Validierung aller Eingaben (Web und MCP)
- **MCP-Server** als Route im selben Next.js-Projekt (Streamable HTTP). Aktuelles Vercel-MCP-Paket (`mcp-handler`, früher `@vercel/mcp-adapter`) oder das offizielle `@modelcontextprotocol/sdk` verwenden. **Aktuellen Stand prüfen.**
- **Tests**: Vitest (Logik), Playwright (Smoke-Tests), SQL-Tests für RLS
- **Deployment**: Vercel (GitHub-Integration), Supabase Cloud

## 4. Repo-Struktur (Ziel)

```
Hub-Dome/  (Repo-Root)
├─ CLAUDE.md                  # Kurzregeln für Claude Code (siehe Abschnitt 13)
├─ PLAN.md                    # dieses Dokument
├─ .env.example
├─ supabase/
│  ├─ migrations/             # SQL-Migrationen (Schema + RLS)
│  ├─ seed.sql                # Modulkatalog + Testdaten
│  └─ tests/                  # RLS-Tests
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/
│  │  ├─ doerfer/             # leitet auf den Reise-Dialog um
│  │  ├─ dorf/[username]/     # Welt-Shell: 3D-Dorf + Dialoge (?d=…), Liste als Dialog ?d=liste
│  │  ├─ freunde/             # Server Actions für Freundschaften
│  │  ├─ freund/[token]/      # Freundschaftslink (Phase 4e)
│  │  ├─ einstellungen/       # leitet auf den Einstellungen-Dialog um
│  │  └─ api/mcp/[token]/route.ts   # MCP-Endpunkt
│  ├─ components/
│  │  ├─ village/             # 3D: Scene, House, Zentrale, ArtifactObject, Camera
│  │  ├─ world/               # Dialoge der Welt-Shell
│  │  └─ ui/
│  ├─ lib/
│  │  ├─ supabase/            # Server- und Browser-Client
│  │  ├─ validation.ts        # Zod-Schemas
│  │  ├─ layout.ts            # Dorf-Layout (Positionen der Häuser)
│  │  └─ tokens.ts            # Token erzeugen und hashen
│  └─ mcp/
│     └─ tools.ts             # MCP-Tool-Definitionen
├─ skill/
│  └─ hub-dome-platzieren/SKILL.md     # Skill zum Installieren für Nutzer
└─ tests/
```

Seit Planstart ergänzt: `docs/` (Phasenplan, Entscheidungslog, Design-Handoff), `src/app/onboarding/`, `src/app/start/`. Geplant: `src/app/o/[id]/` (5b), `src/app/topdorf/` (6b).

## 5. Datenmodell (Supabase / Postgres)

> **Ausgangsstand.** Massgeblich sind die Migrationen in `supabase/migrations/`, unter anderem offizielle Modulkürzel wie `TA.BA_BAUSTATIK1`, `item_type` ab 3b, `houses.semester`, Zentrale-Stile und Freundschaften.

### Tabellen

```sql
-- Profil (1:1 zu auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_-]{3,24}$'),
  display_name text not null,
  avatar_seed text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);

-- Ein Dorf pro Person
create table villages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique not null references profiles on delete cascade,
  name text not null,
  theme text not null default 'standard',
  created_at timestamptz not null default now()
);

-- Modulkatalog des Studiengangs (vom Admin gepflegt)
create table module_catalog (
  code text primary key,           -- z.B. 'BST2'
  title text not null,             -- z.B. 'Baustatik 2'
  semester int
);

-- Häuser im Dorf
create table houses (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages on delete cascade,
  kind text not null check (kind in ('zentrale','modul','thema')),
  title text not null,
  module_code text references module_catalog,
  color text not null default '#8fb3ff',
  position_index int not null default 0,
  created_at timestamptz not null default now()
);
-- Genau eine Zentrale pro Dorf
create unique index one_zentrale_per_village on houses(village_id) where kind = 'zentrale';

-- Artifacts
create table artifacts (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references houses on delete cascade,
  owner_id uuid not null references profiles on delete cascade,
  url text not null check (url ~ '^https://claude\.ai/'),
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 500),
  kind text not null default 'sonstiges'
    check (kind in ('rechner','quiz','zusammenfassung','cheatsheet','tool','visualisierung','sonstiges')),
  tags text[] not null default '{}',
  visibility text not null default 'shared' check (visibility in ('shared','private')),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, url)
);

-- Wer darf welches Dorf sehen (wird nur von den Freundschafts-Funktionen gepflegt)
create table village_access (
  village_id uuid references villages on delete cascade,
  viewer_id uuid references profiles on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (village_id, viewer_id)
);

-- Freundschaften (ersetzen die früheren Einladungslinks, Migration 20261022000100)
create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles on delete cascade,
  addressee_id uuid not null references profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
-- Pro Paar höchstens eine Zeile (eindeutiger Index auf least/greatest der beiden IDs).
-- Freundschaftslinks (Phase 4e) erhalten eine eigene Tabelle mit Token-Hash, Ablauf und Nutzungen.

-- Persönliche Connector-Tokens (nur Hash speichern!)
create table mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  token_hash text unique not null,
  label text not null default 'Claude',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
```

### Row Level Security (Pflicht für alle Tabellen)

Regeln:

- **profiles**: Lesen für alle eingeloggten User (für die Suche nach Benutzernamen). Schreiben nur das eigene Profil.
- **villages / houses**: Lesen, wenn Besitzer **oder** Eintrag in `village_access`. Schreiben nur der Besitzer.
- **artifacts**: Lesen, wenn Besitzer **oder** (Zugriff aufs Dorf **und** `visibility = 'shared'`). Schreiben nur der Besitzer.
- **village_access**: Lesen für Besitzer und den betroffenen Viewer. Einfügen und Löschen nur über die Freundschafts-Funktionen, jeweils für beide Richtungen.
- **friendships**: Lesen nur die beiden Beteiligten. Schreiben nur über die Funktionen.
- **mcp_tokens** und Freundschaftslinks: nur der Besitzer.

Hilfsfunktion:

```sql
create function can_view_village(v uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from villages where id = v and owner_id = auth.uid())
      or exists (select 1 from village_access where village_id = v and viewer_id = auth.uid());
$$;
```

Server-Funktionen (security definer): `send_friend_request(p_username)`, `respond_friend_request(p_id, p_accept)`, `cancel_friend_request(p_id)`, `remove_friend(p_other)`. Beim Annehmen setzt `grant_mutual_access` den Zugriff in beide Richtungen, `remove_friend` entfernt ihn in beide Richtungen. Phase 4e ergänzt `accept_friend_link(p_token)` (hasht das Token, prüft Ablauf und Nutzungen). Niemand kann sich selbst befreunden.

Trigger `on auth.users insert`: Profil-Platzhalter anlegen. Dorf und Zentrale werden im Onboarding erstellt, sobald der Benutzername gesetzt ist.

## 6. Funktionen (User Stories)

1. **Registrieren/Login** per Magic Link oder Google. Beim ersten Login wählt man Benutzername und Anzeigename. Danach werden Dorf und Zentrale automatisch angelegt.
2. **Häuser verwalten**: Haus aus dem Modulkatalog hinzufügen oder ein eigenes Themenhaus anlegen. Umbenennen, Farbe ändern, löschen (mit Bestätigung, Artifacts werden mitgelöscht oder vorher verschoben).
3. **Artifact hinzufügen (Web)**: Link einfügen, dann Titel, Beschreibung, Typ, Tags, Haus und Sichtbarkeit wählen. Die Validierung erlaubt für Artifacts nur `claude.ai`-Links (weitere Objekttypen: PLAN-ERWEITERUNG.md).
4. **Artifact bearbeiten, verschieben, löschen.**
5. **Freunde**: Anfrage per Benutzername senden, annehmen oder ablehnen, Freund entfernen (wirkt beidseitig). Ab Phase 4e zusätzlich ein Freundschaftslink (7 Tage, 1–100 Nutzungen, widerrufbar), auch für Personen ohne Konto.
6. **Reise-Dialog** (früher Seite «Meine Dörfer»): Karten mit dem eigenen Dorf zuoberst, darunter die Dörfer der Freunde. Pro Karte: Name, Anzahl Häuser und Artifacts, letzte Aktivität.
7. **3D-Dorf ansehen** (siehe Abschnitt 7).
8. **Listenansicht** desselben Dorfs als Dialog (`?d=liste`, Phase 4e): Häuser als Abschnitte, Objekte als Karten.
9. **Connector-Token**: In den Einstellungen Token erzeugen. Es wird **einmal** angezeigt, zusammen mit der fertigen Connector-URL und einer Schritt-für-Schritt-Anleitung. Token sind widerrufbar.

## 7. 3D-Dorf – Gestaltung und Verhalten

- **Stil**: Low-Poly, prozedural aus Grundformen gebaut (Box, Kegel, Zylinder). **Keine externen 3D-Modelle** im MVP, so gibt es keine Lizenzfragen und es bleibt leicht.
- **Layout** (`lib/layout.ts`): Zentrale im Ursprung, Modulhäuser auf einem Ring, ab 8 Häusern auf einem zweiten Ring. Das Layout ist deterministisch (gleiche Daten ergeben gleiches Dorf). Wege von der Zentrale zu jedem Haus.
- **Hausgrösse wächst** mit der Anzahl Artifacts (z.B. 0–2 klein, 3–6 mittel, 7+ gross mit Anbau). Das ist ein Motivationselement.
- **Zentrale**: grösseres Gebäude mit Namensschild (Anzeigename) und einer Figur davor (einfache Figur, Farbe aus `avatar_seed`).
- **Artifact-Objekte**: schwebende Kristalle oder Bücher vor bzw. im Haus, Farbe nach `kind`. Hover zeigt den Titel, Klick öffnet ein Detail-Panel mit Beschreibung und Button «Öffnen» (neuer Tab).
- **Navigation**: OrbitControls mit Grenzen. Klick auf ein Haus lässt die Kamera hinfliegen und öffnet eine Seitenleiste mit allen Artifacts des Hauses. Ein «Zurück»-Button zeigt wieder die Übersicht.
- **Leere Zustände**: Ein Haus ohne Artifacts zeigt eine Baustelle. Ein Dorf ohne Häuser zeigt einen Hinweis «Lege dein erstes Modulhaus an».
- **Performance**: Instancing für wiederholte Objekte, `frameloop="demand"`, Ziel 60 fps auf einem Mittelklasse-Laptop. Auf Mobile automatisch reduzierte Details. Die Listenansicht (Dialog) ist immer erreichbar.
- **Barrierefreiheit**: Alle Inhalte sind über die Listenansicht (Dialog) erreichbar. `prefers-reduced-motion` wird respektiert (keine Kamerafahrten).

## 8. Claude-Anbindung

### 8.1 MCP-Connector

- **Endpunkt**: `https://<domain>/api/mcp/<token>`, Transport Streamable HTTP.
- **Authentifizierung (MVP)**: persönliches Token im URL-Pfad. Der Server hasht es (SHA-256), sucht es in `mcp_tokens` (nicht widerrufen) und setzt `last_used_at`. Alle DB-Zugriffe laufen danach **mit der user_id dieses Tokens** und dürfen nur Daten dieses Users ändern. Weil der Server mit Service-Role-Key arbeitet, **muss jede Query explizit auf `owner_id = user_id` filtern**. Dafür sind Tests Pflicht.
- **Später (Phase 7)**: Umstieg auf OAuth 2.1, das Claude-Connectors ebenfalls unterstützen.
- **Rate-Limit**: einfaches Limit pro Token (z.B. 60 Aufrufe pro Stunde).

**Tools** (Beschreibungen auf Deutsch, präzise, damit Claude sie richtig nutzt):

| Tool                     | Eingabe                                                                                            | Wirkung                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dorf_haeuser_auflisten` | –                                                                                                  | Liefert die Häuser des Users (id, Titel, Art, Anzahl Artifacts)                                                                                                                                                         |
| `artifact_platzieren`    | `url`, `titel`, `beschreibung?`, `typ?`, `tags?`, `haus_id` **oder** `haus_titel`, `sichtbarkeit?` | Legt das Artifact an. Bei unbekanntem `haus_titel` gibt es einen Fehler mit der Liste existierender Häuser zurück (kein automatisches Anlegen). Existiert die URL schon, wird der Eintrag aktualisiert statt dupliziert |
| `haus_erstellen`         | `titel`, `modul_code?`                                                                             | Legt ein Modul- oder Themenhaus an                                                                                                                                                                                      |
| `letzte_artifacts`       | `anzahl?` (max. 20)                                                                                | Die zuletzt platzierten Artifacts                                                                                                                                                                                       |

Jede Rückgabe enthält einen Link zum Dorf (`/dorf/<username>`), damit Claude ihn dem User zeigen kann.

### 8.2 Skill für Nutzer

Datei `skill/hub-dome-platzieren/SKILL.md` im Repo. Nutzer laden sie in claude.ai als eigenen Skill hoch. Inhalt (Vorlage, von Claude Code feinschleifen):

```markdown
---
name: hub-dome-platzieren
description: Nach dem Veröffentlichen eines Artifacts fragen, ob es in Hub Dome soll, und es über den Hub-Dome-Connector im gewählten Haus platzieren.
---

# Artifact in Hub Dome stellen

Gilt nur, wenn die Hub-Dome-Tools (dorf_haeuser_auflisten, artifact_platzieren) verfügbar sind.

1. Nachdem du ein Artifact veröffentlicht hast und dessen Link kennst, rufe `dorf_haeuser_auflisten` auf.
2. Frage einmal kurz: «Soll ich das in Hub Dome stellen?» und schlage das passendste Haus vor (nach Modul oder Thema des Artifacts). Biete die anderen Häuser als Auswahl an.
3. Bei Zustimmung: `artifact_platzieren` mit Link, kurzem Titel, einer Beschreibung in einem Satz, passendem Typ und 1–3 Tags aufrufen.
4. Bei Ablehnung: nichts tun und im selben Chat nicht erneut fragen.
5. Wenn der User «nie fragen» sagt: in diesem Chat nicht mehr fragen.
6. Bei Überarbeitung desselben Artifacts nicht erneut fragen. Der Eintrag bleibt gültig (gleiche URL).
7. Bestätige die Platzierung in einem Satz mit dem Link zum Dorf.
```

> **Nach Phase 0 anpassen:** Gehen für Freunde nur geteilte Artifacts auf, ergänzt der Skill vor Schritt 3 den Hinweis «Teile das Artifact in claude.ai, damit deine Freunde es öffnen können.»

### 8.3 Anleitung für Nutzer (Tab «Claude» im Einstellungen-Dialog, `?d=einstellungen&t=claude`)

1. Token erzeugen und Connector-URL kopieren.
2. In claude.ai unter den Connector-Einstellungen einen eigenen Connector hinzufügen und die URL einfügen.
3. Skill-Datei herunterladen und in claude.ai als Skill hochladen.
4. Hinweis: Gratis-Accounts können nur **einen** eigenen Connector nutzen. Wer schon einen hat, nutzt den Weg «Link einfügen» auf der Website.

## 9. Sicherheit und Datenschutz

- RLS auf **allen** Tabellen. Mit RLS-Tests nachweisen, dass User B ohne Freundschaft nichts von User A sieht.
- Tokens (Freundschaftslink, MCP) nur gehasht speichern. Klartext wird genau einmal angezeigt.
- Für Artifacts nur `claude.ai`-URLs speichern (weitere Objekttypen ab 3b mit eigener Prüfung). Keine Inhalte kopieren oder spiegeln, nur verlinken.
- Kein Service-Role-Key im Browser. Server-Routen validieren alle Eingaben mit Zod.
- Datenschutzhinweis (kurz, Schweizer nDSG): welche Daten, wofür, Löschung des Kontos inklusive aller Daten über die Einstellungen.
- Hinweis in der UI: «Teile keine Lösungen zu bewerteten Leistungsnachweisen.»

## 10. Phasen mit Abnahmekriterien

> **Aktuelle Reihenfolge und Stand: `docs/PHASENPLAN.md`.** Neu hinzugekommen: Phase 4c (Welt-Shell mit Dialogen), 4d (Feinschliff, Freundschaften), 4e (Freundschaftslink, Listen-Dialog), 5b (Übernehmen, `PLAN-ERWEITERUNG-2.md` Teil A) und 6b (Topdorf, Teil B). Die Phasen unten bleiben die Detailbeschreibung. In Phase 2–4 sind die Punkte zu Einladungslinks und zur 2D-Seite durch 4c und 4d ersetzt.

### Phase 0 – Abklärungen (ohne Code) – **Link-Test ist Sperre vor Phase 5**

- [x] **Link-Test (Gian, teilweise erledigt 2026-10-22, Ergebnis in `docs/ENTSCHEIDUNGEN.md`).** Ein Artifact in claude.ai veröffentlichen bzw. teilen und den Link prüfen:
  1. im privaten Browserfenster ohne Login öffnen;
  2. mit einem zweiten claude.ai-Konto (Gratis) öffnen;
  3. mit dem zweiten Konto öffnen, solange das Artifact noch **nicht** geteilt ist;
  4. per iframe einbetten (kleine HTML-Testseite auf localhost);
  5. notieren, welche URL-Formen vorkommen (z.B. `claude.ai/artifact/…`, `claude.ai/code/artifact/…`). Alle müssen durch `artifactUrlSchema` gehen.

  Ergebnis mit Datum in `docs/ENTSCHEIDUNGEN.md` festhalten.
- **Folgen je Ergebnis:**
  - Öffnet ohne Login: wie geplant, nichts zu tun.
  - Öffnet nur mit Login: Hinweis im Objekt-Fenster «Zum Öffnen brauchst du ein claude.ai-Konto» (im Pilot bei allen erfüllt).
  - Öffnet erst, wenn der Besitzer das Artifact geteilt hat: Skill (Phase 5) und Formular «Objekt hinzufügen» erinnern vor dem Platzieren daran, das Artifact in claude.ai zu teilen. Sonst ist ein geteiltes Objekt (`visibility = 'shared'`) für Freunde wertlos.
  - iframe geht nicht: bleibt bei «Öffnen im neuen Tab» (heutiger Stand, kein Umbau nötig).
- [x] Aktuelle Versionen und APIs prüfen (erledigt 2026-10-21, siehe `docs/ENTSCHEIDUNGEN.md` «Paketversionen»).
- [ ] Gratis-Limits von Vercel Hobby und Supabase Free kurz dokumentieren (Supabase pausiert inaktive Projekte).

### Phase 1 – Grundgerüst

- [ ] Next.js-Projekt, TypeScript strict, Tailwind, ESLint/Prettier, Vitest, Playwright
- [ ] `CLAUDE.md`, `.env.example`, README mit Setup-Anleitung
- [ ] Supabase lokal (CLI) oder Cloud-Projekt angebunden
- **Abnahme:** `npm run dev` läuft, Lint, Typecheck und Tests sind grün.

### Phase 2 – Datenbank und Auth

- [ ] Migrationen gemäss Abschnitt 5 inkl. RLS, `can_view_village`, `accept_invite`, Trigger
- [ ] Seed: Modulkatalog (Platzhalter, von Gian zu ergänzen) und zwei Testuser mit Dörfern
- [ ] Login (Magic Link + Google), Onboarding (Benutzername), automatisches Anlegen von Dorf und Zentrale
- [ ] RLS-Tests: Besitzer, freigegebener Viewer, fremder User, private Artifacts
- **Abnahme:** Alle RLS-Tests grün. Ein fremder User erhält leere Ergebnisse.

### Phase 3 – 2D-Funktionalität

- [ ] Häuser und Artifacts verwalten (CRUD), Link-Validierung
- [ ] Einladungslinks erzeugen und annehmen, Zugriff entziehen, Dorf verlassen
- [ ] Seite «Meine Dörfer», 2D-Listenansicht eines Dorfs
- **Abnahme:** Playwright-Szenario: A legt Dorf an, lädt B ein, B sieht A's Artifacts (ausser private), A entzieht den Zugriff, B sieht nichts mehr.

### Phase 4 – 3D-Dorf

- [ ] Scene, prozedurale Häuser, Zentrale, Layout-Funktion (mit Unit-Tests)
- [ ] Hausgrösse nach Anzahl Artifacts, Artifact-Objekte, Hover und Klick, Detail-Panel
- [ ] Kamerafahrt zu Haus, Seitenleiste, leere Zustände, Mobile-Reduktion, reduced motion
- **Abnahme:** Dorf mit 10 Häusern und 60 Artifacts läuft flüssig. Alles aus der 2D-Liste ist auch in 3D erreichbar.

### Phase 5 – MCP-Connector und Skill

- [ ] Vorbedingung: Link-Test aus Phase 0 abgeschlossen und Ergebnis umgesetzt (Hinweise in Skill und Formular), Phase 4e abgeschlossen und alles committet
- [ ] Token-Verwaltung im Tab «Claude» des Einstellungen-Dialogs
- [ ] MCP-Route mit den 4 Tools plus MCP-Anteil aus 3b (`objekt_typ`, Alias `objekt_platzieren`, siehe PLAN-ERWEITERUNG.md), Rate-Limit, Fehlermeldungen auf Deutsch
- [ ] Tests: Token-Validierung, widerrufenes Token, Platzieren nur im eigenen Dorf, Duplikat-URL wird aktualisiert
- [ ] Skill-Datei `skill/hub-dome-platzieren/SKILL.md` und Anleitung im Tab «Claude»
- **Abnahme:** Lokal mit dem MCP Inspector getestet. Nach dem Deployment in claude.ai als Connector hinzugefügt: Artifact erstellen, Claude fragt, das Artifact erscheint im Dorf.

### Phase 6 – Deployment und Pilot

- [ ] Vercel-Projekt, Umgebungsvariablen, Supabase-Cloud-Migrationen, Auth-Redirect-URLs
- [ ] Datenschutzhinweis, Konto löschen
- [ ] Pilot mit 3–5 Mitstudierenden, Feedback sammeln
- **Abnahme:** Produktiv erreichbar, Pilotnutzer haben je mindestens 3 Artifacts platziert.

### Phase 7 – Ausbau (erst nach Pilot)

- OAuth 2.1 statt Token in der URL
- Freigabe pro Haus statt nur pro Dorf (mit gegenseitigen Freundschaften wichtiger, weil Freunde sonst alle geteilten Objekte sehen)
- Eigene Zentrale-Modelle wieder zulassen, nur mit Prüfung oder als kuratierte Auswahl (am 2026-10-22 wegen Missbrauchsrisiko entfernt)
- Dorf-Themes, Figuren-Anpassung, Likes oder Kommentare
- Studiengangs-Übersicht (alle freigegebenen Dörfer auf einer Karte)

## 11. Umgebungsvariablen (`.env.example`)

Massgeblich ist `.env.example` im Repo (Stand 2026-10-22):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # nur serverseitig
NEXT_PUBLIC_SITE_URL=http://localhost:3000
TOKEN_PEPPER=                     # zusätzlicher Geheimwert für Token-Hashes
GITHUB_TOKEN=                     # optional, erhöht das GitHub-API-Limit für Vorschauen
```

`TOKEN_PEPPER` gilt laut Entscheidungslog nur für MCP-Tokens. Tokens, die in der Datenbank gehasht werden (früher Einladung, ab 4e Freundschaftslink), kommen ohne Pepper aus, weil die Datenbank ihn nicht kennt.

## 12. Definition of Done (pro Phase)

- Lint, Typecheck und alle Tests grün
- Keine Secrets im Repo
- README aktualisiert
- Kurze Zusammenfassung: was gebaut wurde, was offen ist, welche Annahmen getroffen wurden

## 13. `CLAUDE.md`

Die gültige Fassung liegt im Repo-Root (`CLAUDE.md`). Sie ersetzt die ursprüngliche Vorlage aus diesem Abschnitt.

## 14. Offene Punkte für Gian

1. **Modulkatalog**: erledigt (129 Module aus dem offiziellen Modulverzeichnis)
2. **Name**: Hub Dome (erledigt). **Domain**: offen, spätestens in Phase 6
3. **Google-Login**: eingerichtet; Freigabe der Google-App vor dem Pilot (Phase 6)
4. **Pilotgruppe**: 3–5 Personen mit gemischten Abos (Gratis und Pro), offen
5. **Link-Test Phase 0**: offen, Sperre vor Phase 5
6. **Freundschaftslink**: Gilt das Erzeugen als Zustimmung des Absenders? Entscheid beim Start von Phase 4e
