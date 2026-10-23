const date = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" });
const dateTime = new Intl.DateTimeFormat("de-CH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});

/** Datum, z.B. «23. Okt. 2026» (Zeitzone Zürich). */
export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

/** Datum mit Uhrzeit (Zeitzone Zürich). */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
