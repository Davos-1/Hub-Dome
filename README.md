# Hub Dome

Dein persönliches 3D-Dorf für Claude-Artifacts (HSLU Digital Construction). Spezifikation: [PLAN.md](PLAN.md). Reihenfolge und Stand: [docs/PHASENPLAN.md](docs/PHASENPLAN.md). Entscheidungslog: [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md).

## Setup

```bash
npm install
cp .env.example .env.local   # Werte eintragen (ab Phase 2)
npm run dev                  # http://localhost:3000
```

## Befehle

| Befehl             | Zweck                          |
| ------------------ | ------------------------------ |
| `npm run check`    | Lint, Typecheck und Unit-Tests |
| `npm run test:e2e` | Playwright (Smoke, Freigabe, Objekttypen, 3D) |
| `npm run test:rls` | RLS-Tests gegen das Supabase-Projekt |
| `npm run format`   | Prettier                       |

## Struktur

`src/app` Seiten · `src/components` UI und 3D · `src/lib` Logik · `src/lib/mcp` MCP-Tools (Route `src/app/api/mcp/[token]`) · `supabase` Migrationen und RLS-Tests · `skill` Claude-Skill · `tests/e2e` Playwright · `docs` Doku.

## MCP-Connector (Phase 5)

- Token im Einstellungen-Dialog, Tab «Claude», erzeugen (höchstens 5 aktive, widerrufbar). Die Connector-URL ist `<SITE_URL>/api/mcp/<token>` (Streamable HTTP, zustandslos).
- Tools: `dorf_haeuser_auflisten`, `artifact_platzieren`, `objekt_platzieren` (Alias für alle Linktypen), `haus_erstellen`, `letzte_artifacts`. Höchstens 60 Tool-Aufrufe pro Token und Stunde.
- Skill: `skill/hub-dome-platzieren/SKILL.md`, als ZIP unter `/api/skill` herunterladbar.
- Lokal testen: `npx @modelcontextprotocol/inspector`, Transport «Streamable HTTP», URL `http://localhost:3000/api/mcp/<token>`.
