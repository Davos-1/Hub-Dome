"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { emailSchema } from "@/lib/validation";

const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const callback = () => {
    const url = new URL("/auth/callback", window.location.origin);
    if (next) url.searchParams.set("next", next);
    return url.toString();
  };

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) return setError(parsed.error.issues[0].message);

    setStatus("sending");
    const { error } = await createClient().auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: callback() },
    });
    if (error) {
      setStatus("idle");
      return setError("Der Link konnte nicht gesendet werden. Bitte später erneut versuchen.");
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
      <p role="status" className="rounded-lg bg-green-100 p-4 text-green-900">
        Wir haben dir einen Anmelde-Link an <strong>{email}</strong> gesendet. Öffne ihn im selben
        Browser.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={sendLink} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium">
          E-Mail-Adresse
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-black"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
        >
          {status === "sending" ? "Sende…" : "Anmelde-Link senden"}
        </button>
      </form>
      {googleEnabled && (
        <button
          type="button"
          onClick={google}
          className="rounded-lg border border-zinc-300 px-4 py-2 font-medium"
        >
          Mit Google anmelden
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
