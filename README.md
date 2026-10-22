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

`src/app` Seiten · `src/components` UI und 3D · `src/lib` Logik · `src/mcp` MCP-Tools · `supabase` Migrationen und RLS-Tests · `skill` Claude-Skill · `tests/e2e` Playwright · `docs` Doku.
