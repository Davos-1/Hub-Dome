# Hub Dome

Dein persönliches 3D-Dorf für Claude-Artifacts (HSLU Digital Construction). Spezifikation: [PLAN.md](PLAN.md). Reihenfolge und Stand: [docs/PHASENPLAN.md](docs/PHASENPLAN.md). Entscheidungslog: [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md). Wie die 3D-Welt entsteht und was der Besitzer gestalten kann: [docs/WELT-ANLEITUNG.md](docs/WELT-ANLEITUNG.md).

## Setup

```bash
npm install
cp .env.example .env.local   # Werte eintragen (ab Phase 2)
npm run dev                  # http://localhost:3000
```

## Befehle

| Befehl                                               | Zweck                                                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run check`                                      | Lint, Typecheck und Unit-Tests                                                                        |
| `npm run test:e2e`                                   | Playwright (Smoke, Freigabe, Objekttypen, 3D, Bau-Modus, Landschaft); ohne GPU: `PW_SOFTWARE_GL=1`    |
| `npm run test:rls`                                   | RLS-Tests gegen das Supabase-Projekt                                                                  |
| `npm run format`                                     | Prettier                                                                                              |
| `npx playwright test -c playwright.visual.config.ts` | Visuelle Matrix der 3D-Welt (Screenshots nach `test-results/visual/`, siehe `tests/visual/README.md`) |

## Struktur

`src/app` Seiten · `src/components` UI und 3D · `src/lib` Logik · `src/lib/mcp` MCP-Tools (Route `src/app/api/mcp/[token]`) · `supabase` Migrationen und RLS-Tests · `skill` Claude-Skill · `tests/e2e` Playwright · `docs` Doku.

Oberfläche im Stil «Rauchglas»: alle Farben, Radien und Schatten als Design-Tokens (`--hd-*` in `src/app/globals.css`, Tailwind `bg-hd-surface`, `text-hd-ink` …), Kontrast nach WCAG AA geprüft (`src/app/theme-contrast.test.ts`).

## MCP-Connector (Phase 5)

- Token im Einstellungen-Dialog, Tab «Claude», erzeugen (höchstens 5 aktive, widerrufbar). Die Connector-URL ist `<SITE_URL>/api/mcp/<token>` (Streamable HTTP, zustandslos).
- Tools: `dorf_haeuser_auflisten`, `artifact_platzieren`, `objekt_platzieren` (Alias für alle Linktypen), `haus_erstellen`, `letzte_artifacts`. Höchstens 60 Tool-Aufrufe pro Token und Stunde.
- Skill: `skill/hub-dome-platzieren/SKILL.md`, als ZIP unter `/api/skill` herunterladbar.
- Lokal testen: `npx @modelcontextprotocol/inspector`, Transport «Streamable HTTP», URL `http://localhost:3000/api/mcp/<token>`.
