# Campusdorf – Bauplan für Claude Code

> **Für Claude Code:** Dieses Dokument ist die verbindliche Spezifikation. Arbeite die Phasen **der Reihe nach** ab. Nach jeder Phase: Abnahmekriterien prüfen, Ergebnis kurz zusammenfassen, auf Freigabe warten. Bei Unklarheiten oder wenn eine Annahme hier nicht stimmt (z.B. Paketname veraltet): **nachfragen statt raten**. Prüfe aktuelle Paketversionen und APIs selbst nach, bevor du sie einsetzt.

---

## 1. Vision in einem Satz

Jede Person aus dem Studiengang hat ein eigenes **3D-Dorf**: In der Mitte steht die **Zentrale**, darum herum ein **Haus pro Modul bzw. Thema**. In den Häusern liegen die **Claude-Artifacts** der Person als anklickbare Objekte. Wer Zugriff erhält, sieht das Dorf in seiner Liste «Meine Dörfer».

## 2. Rahmenbedingungen

| Punkt            | Festlegung                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Zielgruppe       | Zuerst nur ein Studiengang (HSLU Digital Construction), ca. 20–80 Personen                                                    |
| Inhalte          | Nur Claude-Artifact-Links (`https://claude.ai/...`)                                                                           |
| Login            | Unabhängig von der HSLU-Mail: Mail-Link (Magic Link) + Google                                                                 |
| Sichtbarkeit     | Privat. Nur wer vom Besitzer freigegeben wurde, sieht das Dorf                                                                |
| Darstellung      | 3D ist zentral, dazu eine 2D-Listenansicht als Fallback (Mobile, Barrierefreiheit)                                            |
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
campusdorf/
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
│  │  ├─ doerfer/             # «Meine Dörfer» (Startseite nach Login)
│  │  ├─ dorf/[username]/     # 3D-Dorf einer Person
│  │  ├─ dorf/[username]/liste/  # 2D-Fallback
│  │  ├─ einladung/[token]/   # Einladung annehmen
│  │  ├─ einstellungen/       # Profil, Freigaben, Connector-Token
│  │  └─ api/mcp/[token]/route.ts   # MCP-Endpunkt
│  ├─ components/
│  │  ├─ village/             # 3D: Scene, House, Zentrale, ArtifactObject, Camera
│  │  └─ ui/
│  ├─ lib/
│  │  ├─ supabase/            # Server- und Browser-Client
│  │  ├─ validation.ts        # Zod-Schemas
│  │  ├─ layout.ts            # Dorf-Layout (Positionen der Häuser)
│  │  └─ tokens.ts            # Token erzeugen und hashen
│  └─ mcp/
│     └─ tools.ts             # MCP-Tool-Definitionen
├─ skill/
│  └─ campusdorf-platzieren/SKILL.md   # Skill zum Installieren für Nutzer
└─ tests/
```

## 5. Datenmodell (Supabase / Postgres)

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

-- Wer darf welches Dorf sehen
create table village_access (
  village_id uuid references villages on delete cascade,
  viewer_id uuid references profiles on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (village_id, viewer_id)
);

-- Einladungslinks
create table invites (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references villages on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null,
  max_uses int not null default 1,
  uses int not null default 0,
  created_at timestamptz not null default now()
);

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
- **village_access**: Lesen für Besitzer und den betroffenen Viewer. Einfügen nur über die Server-Funktion `accept_invite`. Löschen durch Besitzer (Zugriff entziehen) und Viewer (Dorf verlassen).
- **invites / mcp_tokens**: Nur der Besitzer.

Hilfsfunktion:

```sql
create function can_view_village(v uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from villages where id = v and owner_id = auth.uid())
      or exists (select 1 from village_access where village_id = v and viewer_id = auth.uid());
$$;
```

Server-Funktion `accept_invite(token text)` (security definer): hasht das Token, prüft Ablauf und `uses < max_uses`, fügt `village_access` ein und erhöht `uses`. Der Besitzer kann sich nicht selbst einladen.

Trigger `on auth.users insert`: Profil-Platzhalter anlegen. Dorf und Zentrale werden im Onboarding erstellt, sobald der Benutzername gesetzt ist.

## 6. Funktionen (User Stories)

1. **Registrieren/Login** per Magic Link oder Google. Beim ersten Login wählt man Benutzername und Anzeigename. Danach werden Dorf und Zentrale automatisch angelegt.
2. **Häuser verwalten**: Haus aus dem Modulkatalog hinzufügen oder ein eigenes Themenhaus anlegen. Umbenennen, Farbe ändern, löschen (mit Bestätigung, Artifacts werden mitgelöscht oder vorher verschoben).
3. **Artifact hinzufügen (Web)**: Link einfügen, dann Titel, Beschreibung, Typ, Tags, Haus und Sichtbarkeit wählen. Die Validierung erlaubt nur `claude.ai`-Links.
4. **Artifact bearbeiten, verschieben, löschen.**
5. **Freigabe**: Einladungslink erzeugen (Gültigkeit 7 Tage, 1 oder mehrere Nutzungen). Liste «Wer sieht mein Dorf», mit Möglichkeit zum Entziehen.
6. **Meine Dörfer**: Karten mit dem eigenen Dorf zuoberst, darunter die freigegebenen Dörfer. Pro Karte: Name, Anzahl Häuser und Artifacts, letzte Aktivität.
7. **3D-Dorf ansehen** (siehe Abschnitt 7).
8. **2D-Liste** desselben Dorfs: Häuser als Abschnitte, Artifacts als Karten.
9. **Connector-Token**: In den Einstellungen Token erzeugen. Es wird **einmal** angezeigt, zusammen mit der fertigen Connector-URL und einer Schritt-für-Schritt-Anleitung. Token sind widerrufbar.

## 7. 3D-Dorf – Gestaltung und Verhalten

- **Stil**: Low-Poly, prozedural aus Grundformen gebaut (Box, Kegel, Zylinder). **Keine externen 3D-Modelle** im MVP, so gibt es keine Lizenzfragen und es bleibt leicht.
- **Layout** (`lib/layout.ts`): Zentrale im Ursprung, Modulhäuser auf einem Ring, ab 8 Häusern auf einem zweiten Ring. Das Layout ist deterministisch (gleiche Daten ergeben gleiches Dorf). Wege von der Zentrale zu jedem Haus.
- **Hausgrösse wächst** mit der Anzahl Artifacts (z.B. 0–2 klein, 3–6 mittel, 7+ gross mit Anbau). Das ist ein Motivationselement.
- **Zentrale**: grösseres Gebäude mit Namensschild (Anzeigename) und einer Figur davor (einfache Figur, Farbe aus `avatar_seed`).
- **Artifact-Objekte**: schwebende Kristalle oder Bücher vor bzw. im Haus, Farbe nach `kind`. Hover zeigt den Titel, Klick öffnet ein Detail-Panel mit Beschreibung und Button «Öffnen» (neuer Tab).
- **Navigation**: OrbitControls mit Grenzen. Klick auf ein Haus lässt die Kamera hinfliegen und öffnet eine Seitenleiste mit allen Artifacts des Hauses. Ein «Zurück»-Button zeigt wieder die Übersicht.
- **Leere Zustände**: Ein Haus ohne Artifacts zeigt eine Baustelle. Ein Dorf ohne Häuser zeigt einen Hinweis «Lege dein erstes Modulhaus an».
- **Performance**: Instancing für wiederholte Objekte, `frameloop="demand"`, Ziel 60 fps auf einem Mittelklasse-Laptop. Auf Mobile automatisch reduzierte Details. Ein Link zur 2D-Ansicht ist immer sichtbar.
- **Barrierefreiheit**: Alle Inhalte sind über die 2D-Liste erreichbar. `prefers-reduced-motion` wird respektiert (keine Kamerafahrten).

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

Datei `skill/campusdorf-platzieren/SKILL.md` im Repo. Nutzer laden sie in claude.ai als eigenen Skill hoch. Inhalt (Vorlage, von Claude Code feinschleifen):

```markdown
---
name: campusdorf-platzieren
description: Nach dem Veröffentlichen eines Artifacts fragen, ob es ins Campusdorf soll, und es über den Campusdorf-Connector im gewählten Haus platzieren.
---

# Artifact ins Campusdorf stellen

Gilt nur, wenn die Campusdorf-Tools (dorf_haeuser_auflisten, artifact_platzieren) verfügbar sind.

1. Nachdem du ein Artifact veröffentlicht hast und dessen Link kennst, rufe `dorf_haeuser_auflisten` auf.
2. Frage einmal kurz: «Soll ich das ins Campusdorf stellen?» und schlage das passendste Haus vor (nach Modul oder Thema des Artifacts). Biete die anderen Häuser als Auswahl an.
3. Bei Zustimmung: `artifact_platzieren` mit Link, kurzem Titel, einer Beschreibung in einem Satz, passendem Typ und 1–3 Tags aufrufen.
4. Bei Ablehnung: nichts tun und im selben Chat nicht erneut fragen.
5. Wenn der User «nie fragen» sagt: in diesem Chat nicht mehr fragen.
6. Bei Überarbeitung desselben Artifacts nicht erneut fragen. Der Eintrag bleibt gültig (gleiche URL).
7. Bestätige die Platzierung in einem Satz mit dem Link zum Dorf.
```

### 8.3 Anleitung für Nutzer (Seite `/einstellungen/claude`)

1. Token erzeugen und Connector-URL kopieren.
2. In claude.ai unter den Connector-Einstellungen einen eigenen Connector hinzufügen und die URL einfügen.
3. Skill-Datei herunterladen und in claude.ai als Skill hochladen.
4. Hinweis: Gratis-Accounts können nur **einen** eigenen Connector nutzen. Wer schon einen hat, nutzt den Weg «Link einfügen» auf der Website.

## 9. Sicherheit und Datenschutz

- RLS auf **allen** Tabellen. Mit RLS-Tests nachweisen, dass User B ohne Freigabe nichts von User A sieht.
- Tokens (Einladung, MCP) nur gehasht speichern. Klartext wird genau einmal angezeigt.
- Nur `claude.ai`-URLs speichern. Keine Artifact-Inhalte kopieren oder spiegeln, nur verlinken.
- Kein Service-Role-Key im Browser. Server-Routen validieren alle Eingaben mit Zod.
- Datenschutzhinweis (kurz, Schweizer nDSG): welche Daten, wofür, Löschung des Kontos inklusive aller Daten über die Einstellungen.
- Hinweis in der UI: «Teile keine Lösungen zu bewerteten Leistungsnachweisen.»

## 10. Phasen mit Abnahmekriterien

> **Aktuelle Reihenfolge und Stand: `docs/PHASENPLAN.md`.** Neu hinzugekommen: Phase 4c (Welt-Shell mit Dialogen), 5b (Übernehmen, `PLAN-ERWEITERUNG-2.md` Teil A) und 6b (Topdorf, Teil B). Die Phasen unten bleiben die Detailbeschreibung.

### Phase 0 – Abklärungen (ohne Code)

- [ ] Prüfen: Lässt sich ein geteilter Artifact-Link ohne claude.ai-Login öffnen? Lässt er sich per iframe einbetten? Ergebnis dokumentieren. **Annahme bis dahin: nur «Öffnen im neuen Tab».**
- [ ] Aktuelle Versionen und APIs prüfen: Next.js, React Three Fiber, drei, Supabase SSR-Client, MCP-Paket.
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

- [ ] Token-Verwaltung in den Einstellungen
- [ ] MCP-Route mit den 4 Tools, Rate-Limit, Fehlermeldungen auf Deutsch
- [ ] Tests: Token-Validierung, widerrufenes Token, Platzieren nur im eigenen Dorf, Duplikat-URL wird aktualisiert
- [ ] Skill-Datei und Anleitungsseite
- **Abnahme:** Lokal mit dem MCP Inspector getestet. Nach dem Deployment in claude.ai als Connector hinzugefügt: Artifact erstellen, Claude fragt, das Artifact erscheint im Dorf.

### Phase 6 – Deployment und Pilot

- [ ] Vercel-Projekt, Umgebungsvariablen, Supabase-Cloud-Migrationen, Auth-Redirect-URLs
- [ ] Datenschutzhinweis, Konto löschen
- [ ] Pilot mit 3–5 Mitstudierenden, Feedback sammeln
- **Abnahme:** Produktiv erreichbar, Pilotnutzer haben je mindestens 3 Artifacts platziert.

### Phase 7 – Ausbau (erst nach Pilot)

- OAuth 2.1 statt Token in der URL
- Freigabe pro Haus statt nur pro Dorf
- Dorf-Themes, Figuren-Anpassung, Likes oder Kommentare
- Studiengangs-Übersicht (alle freigegebenen Dörfer auf einer Karte)

## 11. Umgebungsvariablen (`.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # nur serverseitig
NEXT_PUBLIC_SITE_URL=http://localhost:3000
TOKEN_PEPPER=                     # zusätzlicher Geheimwert für Token-Hashes
```

## 12. Definition of Done (pro Phase)

- Lint, Typecheck und alle Tests grün
- Keine Secrets im Repo
- README aktualisiert
- Kurze Zusammenfassung: was gebaut wurde, was offen ist, welche Annahmen getroffen wurden

## 13. Inhalt für `CLAUDE.md` (in Phase 1 anlegen)

```markdown
# Campusdorf – Regeln für Claude Code

- Spezifikation: PLAN.md. Phasen der Reihe nach, nach jeder Phase stoppen und zusammenfassen.
- UI-Texte Deutsch, Schweizer Schreibweise (kein ß).
- Jede neue Tabelle braucht RLS und Tests dazu.
- Service-Role-Key nur serverseitig. Jede Server-Query mit Service Role filtert explizit nach owner_id.
- Eingaben immer mit Zod validieren.
- Vor dem Einsatz eines Pakets die aktuelle Doku prüfen, keine veralteten APIs raten.
- Bei Unklarheit nachfragen statt annehmen.
```

## 14. Offene Punkte für Gian

1. **Modulkatalog**: Liste der Module (Code, Titel, Semester) für den Seed
2. **Name** des Projekts und der Domain (Arbeitstitel «Campusdorf»)
3. **Google-Login**: Google-Cloud-Projekt für OAuth anlegen (Anleitung folgt in Phase 2)
4. **Pilotgruppe**: 3–5 Personen mit gemischten Abos (Gratis und Pro)
