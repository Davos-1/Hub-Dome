# Hub Dome – Erweiterung «Weitere Objekttypen»

> **Für Claude Code:** Ergänzung zu `PLAN.md`. **Stand 2026-10-22: Phase 3b ist abgeschlossen, der MCP-Anteil kommt mit Phase 5.** Die laufende Phase **nicht unterbrechen**. Phase 3b erst starten, wenn Phase 3 abgenommen ist, und **vor** Phase 4. Die Phasen 8 und 9 kommen erst nach dem Pilot (Phase 6). Alle Änderungen sind **additiv**: bestehende Daten, Tabellen, Routen und MCP-Tools bleiben gültig.

## Grundsätze

- Die Tabelle `artifacts` wird **nicht umbenannt**. In der UI heissen die Einträge ab jetzt **«Objekte»**. Code-intern ist der Begriff `item` erlaubt, die Tabelle bleibt `artifacts`.
- Jedes Objekt erhält einen **Objekttyp**. Bestehende Einträge erhalten automatisch `claude_artifact`.
- Externe Inhalte werden **nur verlinkt oder als Metadaten zwischengespeichert**. Nie wird fremder Code ausgeführt.

---

## Phase 3b – Objekttypen und Links (vor Phase 4)

### Migration (neue Datei, bestehende Migrationen nicht ändern)

```sql
alter table artifacts
  add column item_type text not null default 'claude_artifact'
    check (item_type in ('claude_artifact','github_repo','gist','cloud_ordner','link','datei','paket')),
  add column meta jsonb not null default '{}'::jsonb,
  add column meta_refreshed_at timestamptz;

-- Bisherige URL-Prüfung (nur claude.ai) ersetzen.
-- Tatsächlichen Constraint-Namen vorher in der DB nachschlagen.
alter table artifacts drop constraint <bestehender_url_check>;
alter table artifacts add constraint artifacts_url_by_type check (
  url ~ '^https://' and (
    (item_type = 'claude_artifact' and url ~ '^https://claude\.ai/')
    or (item_type = 'github_repo' and url ~ '^https://github\.com/[^/]+/[^/]+/?$')
    or (item_type = 'gist' and url ~ '^https://gist\.github\.com/')
    or item_type in ('cloud_ordner','link')
    or item_type in ('datei','paket')   -- wird in Phase 8/9 präzisiert
  )
);
```

- Die `kind`-Werte (rechner, quiz, …) bleiben als **Inhaltskategorie** bestehen. `item_type` beschreibt die **Form** des Objekts.
- RLS bleibt unverändert, die neuen Spalten fallen unter die bestehenden Policies. RLS-Tests um einen Fall mit `github_repo` ergänzen.

### Funktionen

1. **Automatische Typerkennung** beim Einfügen eines Links:
   - `claude.ai` wird zu `claude_artifact`
   - `github.com/<owner>/<repo>` wird zu `github_repo`
   - `gist.github.com` wird zu `gist`
   - OneDrive, SharePoint, Google Drive, SWITCHdrive und Dropbox werden zu `cloud_ordner`
   - Alles andere wird zu `link`

   Der User kann den Typ manuell ändern.
2. **GitHub-Vorschau** (serverseitige Route): Repo-Name, Beschreibung, Hauptsprache, Sterne, letzter Push und README (gerendertes Markdown, sanitisiert). Die Daten werden in `meta` gespeichert und höchstens alle 24 h aktualisiert.
   - Die GitHub-API erlaubt ohne Token nur wenige Anfragen pro Stunde, daher ist **Caching Pflicht**. Optional kommt `GITHUB_TOKEN` in `.env.example`.
   - Private oder nicht gefundene Repos zeigen den Hinweis «Vorschau nicht verfügbar». Der Link bleibt gültig.
3. **Gist-Vorschau**: Dateinamen und die ersten Zeilen mit Syntax-Hervorhebung, gleiches Caching.
4. **Externe Links**: Domain sichtbar anzeigen, `rel="noopener noreferrer"`, neuer Tab.
5. **2D-Liste**: Icon pro Objekttyp und ein Filter nach Typ (heute: Listen-Dialog, Phase 4d).

### MCP-Connector (rückwärtskompatibel)

- `artifact_platzieren` erhält den optionalen Parameter `objekt_typ`. Ohne Angabe wird der Typ automatisch aus der URL erkannt.
- Neues Tool `objekt_platzieren` als Alias mit neutraler Beschreibung: «Platziert einen Link (Claude-Artifact, GitHub-Repo, Gist, Cloud-Ordner, Website) in einem Haus des Dorfs.»
- Skill-Vorlage ergänzen: Die Frage «Soll ich das in Hub Dome stellen?» gilt auch, wenn im Chat ein GitHub-Repo oder Gist entstanden ist und dessen URL bekannt ist.

### Abnahme Phase 3b
- [ ] Bestehende Artifacts funktionieren unverändert, ihr Typ ist `claude_artifact`
- [ ] GitHub-Repo per Link hinzufügen zeigt die Vorschau inklusive README. Bei einem zweiten Aufruf innerhalb von 24 h erfolgt kein neuer API-Call
- [ ] Ungültige Kombinationen (z.B. Typ `github_repo` mit einer claude.ai-URL) werden abgelehnt
- [ ] MCP: altes Tool weiterhin funktionsfähig, neues Tool platziert ein GitHub-Repo
- [ ] Lint, Typecheck und Tests grün

---

## Anpassung Phase 4 – 3D-Objekte pro Typ

Ergänzt Abschnitt 7 von `PLAN.md`:

| Objekttyp | 3D-Form (prozedural) |
|---|---|
| `claude_artifact` | schwebender Kristall (Farbe nach `kind`) |
| `github_repo` / `gist` | Zahnrad oder Terminal-Würfel |
| `cloud_ordner` | Truhe |
| `link` | Wegweiser oder Schild |
| `datei` (ab Phase 8) | je nach Dateityp: Buch (PDF), kleines Modell (3D-Dateien), Schriftrolle (Code) |
| `paket` (ab Phase 9) | Kiste mit Deckel |

Das Detail-Panel zeigt je nach Typ die passende Vorschau (Artifact-Link, GitHub-README, Gist-Code).

---

## Phase 8 – Datei-Uploads (nach dem Pilot)

### Vorabklärung
- [ ] Aktuelle Gratis-Limits prüfen und dokumentieren: **Supabase Storage** (Gesamtspeicher, max. Dateigrösse) vs. **Cloudflare R2** (Gratis-Kontingent, keine Egress-Kosten). Entscheidung mit Gian treffen.

### Migration
```sql
alter table artifacts
  alter column url drop not null,
  add column storage_path text,
  add column file_name text,
  add column file_size bigint,
  add column mime_type text,
  add column sha256 text,
  add constraint artifacts_url_or_file check (
    (item_type in ('datei','paket') and storage_path is not null)
    or (item_type not in ('datei','paket') and url is not null)
  );
```

### Funktionen
- Upload auf der Website (Drag and Drop): ein Dateilimit pro Datei, ein Speicherlimit pro User und eine Erlaubnisliste von Dateiendungen.
- **Erlaubte Typen (Start):** `.py`, `.txt`, `.md`, `.json`, `.csv`, `.pdf`, `.png`, `.jpg`, `.3dm`, `.gh`, `.ifc`, `.stl`, `.obj`
- **Vorschau:**
  - Code und Text: Syntax-Hervorhebung, nur anzeigen
  - PDF und Bilder: direkt anzeigen
  - `.stl`, `.obj`: three.js-Loader
  - `.3dm`: rhino3dm.js / 3DMLoader
  - `.ifc`: web-ifc bzw. That Open Engine
  - `.gh`: keine Vorschau möglich, dafür optional ein **Screenshot hochladen** (Canvas-Bild) plus Beschreibung
- **Downloads nur über signierte, kurzlebige URLs**, die serverseitig nach RLS-Prüfung erzeugt werden. Kein öffentlicher Bucket.
- **Warnhinweis** beim Download von `.py`, `.gh` und `.3dm`: «Kann beim Öffnen Code ausführen. Nur öffnen, wenn du der Person vertraust.»
- **MCP:** neues Tool `textdatei_platzieren` für kleine Textdateien (z.B. `.py`, max. 200 KB) mit Dateiname und Inhalt. Binärdateien nur über die Website.
- Beim Löschen eines Objekts oder Kontos wird auch die Datei im Storage gelöscht.

### Abnahme Phase 8
- [ ] Ein fremder User ohne Freigabe erhält keine signierte URL
- [ ] Limits greifen (Grösse, Typ, Speicher pro User)
- [ ] Vorschau funktioniert für jeden erlaubten Typ oder zeigt einen sauberen Fallback

---

## Phase 9 – Pakete / Ordnerstrukturen (nur bei Bedarf aus dem Pilot)

- Upload eines ZIP oder mehrerer Dateien. Das Entpacken erfolgt **im Browser** (z.B. JSZip), danach werden die Dateien einzeln hochgeladen. Das umgeht Limits von Serverfunktionen.
- Neue Tabelle `package_files (id, artifact_id, path, storage_path, file_size, mime_type)` mit RLS über das zugehörige Objekt.
- Anzeige als **Ordnerbaum**. Ein Klick auf eine Datei öffnet dieselbe Vorschau wie in Phase 8. Download des ganzen Pakets als ZIP.
- Schutz: maximale Anzahl Dateien und Gesamtgrösse pro Paket, Pfade bereinigen (kein `../`).
- Hinweis in der UI: Für Programme mit vielen Dateien ist ein **GitHub-Repo** meist die bessere Wahl.

### Abnahme Phase 9
- [ ] ZIP mit Unterordnern wird korrekt als Baum angezeigt
- [ ] Bösartige Pfade (`../`, absolute Pfade) werden abgewiesen
- [ ] Löschen entfernt alle Paketdateien aus dem Storage
