"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/validation";
import { sendMagicLink } from "./actions";

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  // Sitzung aus dem Fragment übernehmen (Mail-Link im alten Format, siehe /auth/callback).
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(async ({ error }) => {
        if (error)
          return setError("Die Anmeldung hat nicht geklappt. Bitte fordere einen neuen Link an.");
        await fetch("/auth/nach-login", { method: "POST" }).catch(() => {});
        window.location.assign(next ?? "/start");
      });
  }, [next]);

  // Nur für Google (PKCE, gleicher Browser); der Mail-Link wird serverseitig angefordert.
  const callback = () => {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next ?? "/start");
    return url.toString();
  };

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) return setError(parsed.error.issues[0].message);

    setStatus("sending");
    const { error } = await sendMagicLink(parsed.data, next);
    if (error) {
      setStatus("idle");
      return setError(error);
    }
    setStatus("sent");
  }

  async function google() {
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback() },
    });
    if (error) setError("Die Anmeldung mit Google ist fehlgeschlagen.");
  }

  if (status === "sent") {
    return (
      <p role="status" className="rounded-xl bg-[#e6efe9] p-4 text-[#1f4132]">
        Wir haben dir einen Anmelde-Link an <strong>{email}</strong> gesendet. Du kannst ihn auch
        auf einem anderen Gerät öffnen.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={sendLink} className="flex flex-col gap-3">
        <label htmlFor="email" className="hd-label">
          E-Mail-Adresse
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="hd-input"
        />
        <button type="submit" disabled={status === "sending"} className="hd-btn hd-btn-primary">
          {status === "sending" ? "Sende…" : "Anmelde-Link senden"}
        </button>
      </form>
      {googleEnabled && (
        <button type="button" onClick={google} className="hd-btn hd-btn-ghost">
          Mit Google anmelden
        </button>
      )}
      {error && (
        <p role="alert" className="hd-error">
          {error}
        </p>
      )}
    </div>
  );
}
