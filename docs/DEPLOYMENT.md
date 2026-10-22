# Hub Dome – Deployment (Phase 6)

Schritte, die Gian in den Dashboards erledigt. Reihenfolge einhalten; `<SITE>` ist die Vercel-Adresse (z.B. `https://hub-dome.vercel.app`), `<REF>` die Supabase-Projekt-ID.

## 1. Supabase

1. **Migrationen:** Alle Dateien aus `supabase/migrations` sind eingespielt bis `20261022000500`. Neu: `20261022000600_account_deletion.sql` im SQL-Editor ausführen.
2. **Projekt für den Pilot:** Das bestehende Projekt wird weiterverwendet. Hinweis: Die RLS- und E2E-Tests legen darin kurzlebige Testkonten (`@example.test`) an und löschen sie wieder. Für einen sauberen Betrieb später ein zweites Projekt nur für Tests anlegen.
3. **Authentication → URL Configuration:**
   - Site URL: `<SITE>` (mit `https://`, ohne `/` am Ende; sonst Fehler «requested path is invalid»)
   - Redirect URLs: `<SITE>/**`, `http://localhost:3000/**`
4. **Authentication → Emails → SMTP Settings** (Gmail):
   - Zuerst im Google-Konto 2-Schritt-Verifizierung aktivieren, dann unter https://myaccount.google.com/apppasswords ein App-Passwort «Hub Dome» erzeugen.
   - Host `smtp.gmail.com`, Port `465`, Benutzer = Gmail-Adresse, Passwort = App-Passwort, Absender = dieselbe Gmail-Adresse, Name «Hub Dome».
   - Danach unter **Rate Limits** das Limit für E-Mails z.B. auf 100 pro Stunde setzen (Gmail erlaubt ca. 500 pro Tag).
5. **Authentication → Emails → Templates:** In den Vorlagen **«Magic Link»** und **«Confirm signup»** den Link ersetzen durch
   `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Bei Hub Dome anmelden</a>`
   Damit funktioniert der Link auch in einem anderen Browser bzw. Gerät als dem, wo er angefordert wurde. Texte dabei gleich auf Deutsch übersetzen.

## 2. Google-Login

1. Google Cloud Console → APIs & Services → OAuth-Zustimmungsbildschirm: App-Name «Hub Dome», Support-Mail, Link zur Datenschutzseite `<SITE>/datenschutz`.
2. **Veröffentlichungsstatus:** «In Produktion» setzen (nur die Bereiche `email`, `profile`, `openid` → keine Google-Prüfung nötig). Alternativ während des Pilots die Pilot-Personen als Testnutzer eintragen.
3. Anmeldedaten → OAuth-Client (Webanwendung), autorisierte Weiterleitungs-URI: `https://<REF>.supabase.co/auth/v1/callback`.
4. Client-ID und Secret in Supabase unter Authentication → Providers → Google eintragen.
5. In Vercel `NEXT_PUBLIC_GOOGLE_LOGIN=true` setzen (siehe unten).

## 3. Vercel

1. Neues Projekt aus dem GitHub-Repo importieren (Framework: Next.js, Root = Repo-Root).
2. **Umgebungsvariablen** (Production):

   | Name | Wert |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | wie in `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | wie in `.env.local` |
   | `SUPABASE_SERVICE_ROLE_KEY` | wie in `.env.local` (geheim) |
   | `NEXT_PUBLIC_SITE_URL` | `<SITE>` |
   | `TOKEN_PEPPER` | **derselbe** Wert wie lokal, sonst sind bestehende Connector-Tokens ungültig |
   | `CRON_SECRET` | neuer Zufallswert, mind. 32 Zeichen (z.B. `openssl rand -hex 32`) |
   | `GITHUB_TOKEN` | optional |
   | `NEXT_PUBLIC_GOOGLE_LOGIN` | `true`, sobald Schritt 2 erledigt ist |

3. Deploy. Der Cron aus `vercel.json` (`/api/cron/konto-loeschen`, täglich 03:00 UTC) wird automatisch angelegt. Auf dem Hobby-Plan läuft er einmal pro Tag zu einer ungefähren Zeit; eine beantragte Löschung erfolgt also nach 1–2 Tagen.

## 4. Prüfen nach dem Deploy

- [ ] `<SITE>` leitet ohne Anmeldung auf `/login`; `<SITE>/datenschutz` ist ohne Anmeldung lesbar
- [ ] Magic Link kommt an (auch an eine Nicht-Gmail-Adresse) und meldet an
- [ ] Google-Login funktioniert mit einem Konto, das nicht Testnutzer ist
- [ ] Onboarding → eigenes Dorf → Haus und Objekt anlegen
- [ ] Zweites Konto: Freundschaftslink annehmen, Objekt öffnen (`/o/<id>`) und übernehmen
- [ ] Einstellungen → Claude: Token erzeugen; in claude.ai unter Einstellungen → Connectors die URL `<SITE>/api/mcp/<token>` hinzufügen; Skill-ZIP hochladen; Artifact erstellen und platzieren lassen (Abnahme Phase 5)
- [ ] `curl -i <SITE>/api/cron/konto-loeschen` antwortet 401 (ohne Secret)
- [ ] Konto löschen mit einem Testkonto: Abmeldung, Hinweis auf der Login-Seite; erneutes Anmelden bricht ab

## 5. Pilot

3–5 Mitstudierende einladen (Freundschaftslink). Abnahme: Jede Person hat mindestens 3 Objekte platziert. Feedback in `docs/ENTSCHEIDUNGEN.md` festhalten.
