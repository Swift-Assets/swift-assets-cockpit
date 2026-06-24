"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BirdMark } from "@/components/cockpit/brand";
import { safeRedirectPath } from "@/lib/auth/temp-access";

/**
 * Cockpit login — Supabase email/password (signInWithPassword). Establishes a
 * real Supabase session (cookie-based via @supabase/ssr) so all RLS-gated views
 * and RPCs work under auth.uid(). Styled as the Swift Assets website Hero
 * (black, real bird, wordmark, #2d2d2d divider, outlined uppercase CTA).
 *
 * Magic Link and the temporary access-code gate are both retired as the active
 * auth method. No password is hardcoded; accounts are managed in Supabase.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setStatus("error");
        return;
      }
      // Full navigation so middleware/SSR pick up the freshly-set session cookie.
      const from =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirectedFrom")
          : null;
      window.location.assign(safeRedirectPath(from));
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 py-16 text-white">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <BirdMark size={132} priority />

        <h1
          className="mt-10 font-semibold leading-none"
          style={{
            fontSize: "clamp(2rem, 7vw, 3.25rem)",
            letterSpacing: "clamp(2px, 1.2vw, 12px)",
          }}
        >
          SWIFT&nbsp;ASSETS
        </h1>
        <p className="mt-4 text-xs font-light uppercase tracking-[0.3em] text-mute">
          UG (Haftungsbeschränkt) · Internal Cockpit
        </p>

        <div className="my-12 h-px w-24 bg-ink-mid" aria-hidden />

        <form onSubmit={handleSubmit} className="w-full space-y-5 text-left">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-[0.7rem] font-medium uppercase tracking-[0.3em] text-mute"
            >
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@swift-assets.de"
              className="flex h-12 w-full border border-ink-mid bg-transparent px-4 text-sm text-white outline-none transition-colors placeholder:text-mute focus:border-white"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-[0.7rem] font-medium uppercase tracking-[0.3em] text-mute"
            >
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex h-12 w-full border border-ink-mid bg-transparent px-4 text-sm text-white outline-none transition-colors placeholder:text-mute focus:border-white"
            />
          </div>
          <button
            type="submit"
            disabled={status === "submitting"}
            className="inline-flex h-12 w-full items-center justify-center gap-3 border border-white text-sm uppercase tracking-[0.3em] text-white transition-colors hover:bg-white hover:text-ink disabled:opacity-50"
          >
            {status === "submitting" ? "Wird geprüft…" : "Einloggen"}
            <span aria-hidden>→</span>
          </button>
          {status === "error" ? (
            <p className="text-sm text-status-red">Ungültige Zugangsdaten.</p>
          ) : null}
        </form>

        <p className="mt-10 text-[0.7rem] uppercase tracking-[0.22em] text-mute">
          Kein öffentlicher Zugang
        </p>
      </div>
    </main>
  );
}
