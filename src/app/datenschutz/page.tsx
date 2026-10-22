import { AuthCard } from "@/components/ui/auth-card";

export const metadata = { title: "Datenschutz – Hub Dome" };

const h = "text-[16px] font-bold mt-2";

/** Datenschutzhinweis nach Schweizer nDSG (öffentlich, auch ohne Anmeldung erreichbar). */
export default function DatenschutzPage() {
  return (
    <AuthCard title="Datenschutz">
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto text-[14px] leading-relaxed">
        <p className="hd-note">Stand: 22. Oktober 2026</p>

        <h2 className={h}>Verantwortlich</h2>
        <p>
          Gian Blaser, <a href="mailto:gian.blaser@gmail.com">gian.blaser@gmail.com</a>. Hub Dome ist
          ein privates, nicht kommerzielles Studienprojekt.
        </p>

        <h2 className={h}>Welche Daten und wofür</h2>
        <ul className="list-disc pl-5">
          <li>
            <strong>Konto:</strong> E-Mail-Adresse (für die Anmeldung), Benutzername, Anzeigename.
          </li>
          <li>
            <strong>Dein Dorf:</strong> Häuser, Objekte mit Titel, Beschreibung, Tags und Link,
            Sichtbarkeit und Einstellungen. Geteilte Objekte sehen deine Freunde; Objekte, die du
            fürs Topdorf freigibst, sehen alle angemeldeten Hub-Dome-Nutzer mit deinem Namen.
          </li>
          <li>
            <strong>Freundschaften:</strong> Anfragen, bestehende Freundschaften und
            Freundschaftslinks (nur als Prüfwert gespeichert).
          </li>
          <li>
            <strong>Nutzungszahlen:</strong> wer welches Objekt geöffnet oder übernommen hat. Besitzer
            sehen davon nur Zahlen, nie Namen; die Zahlen dienen auch dem Ranking im Topdorf.
          </li>
          <li>
            <strong>Claude-Connector:</strong> Connector-Tokens (nur als Prüfwert gespeichert) und ein
            stündlicher Aufrufzähler gegen Missbrauch.
          </li>
          <li>
            <strong>Im Browser:</strong> ein Anmelde-Cookie sowie lokal gespeicherte
            Anzeige-Einstellungen. Keine Werbung, kein Tracking, keine Analyse-Dienste.
          </li>
        </ul>

        <h2 className={h}>Dienste, die Daten bearbeiten</h2>
        <ul className="list-disc pl-5">
          <li>Supabase (Datenbank und Anmeldung)</li>
          <li>Vercel (Hosting der Website)</li>
          <li>Google (Versand der Anmelde-Mails über Gmail; Google-Login, falls du ihn nutzt)</li>
          <li>GitHub (nur der Link von GitHub-Objekten, um eine Vorschau zu laden)</li>
        </ul>
        <p>
          Diese Anbieter können Daten auch ausserhalb der Schweiz bearbeiten, insbesondere in der EU
          und in den USA. Die Inhalte deiner Claude-Artifacts liegen bei claude.ai; Hub Dome speichert
          nur den Link.
        </p>

        <h2 className={h}>Löschen und deine Rechte</h2>
        <p>
          Du kannst dein Konto jederzeit unter Einstellungen → Profil → «Konto löschen» löschen. Nach
          einem Tag Wartefrist werden Konto, Dorf, Objekte, Freundschaften, Tokens und Nutzungszahlen
          endgültig gelöscht; meldest du dich vorher wieder an, wird die Löschung abgebrochen.
          Übernahmen deiner Objekte im Dorf anderer bleiben mit dem Vermerk «Original entfernt».
        </p>
        <p>
          Für Auskunft, Berichtigung oder Fragen schreib an{" "}
          <a href="mailto:gian.blaser@gmail.com">gian.blaser@gmail.com</a>.
        </p>
        <p className="mt-2">
          <a href="/login" className="underline">
            Zur Anmeldung
          </a>
        </p>
      </div>
    </AuthCard>
  );
}
