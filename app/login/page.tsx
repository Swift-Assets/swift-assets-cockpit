"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BirdMark } from "@/components/cockpit/brand";
import { GlassCard } from "@/components/cockpit/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-foreground">
      <GlassCard className="w-full max-w-md p-8 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <BirdMark size={104} priority />

          <h1
            className="mt-8 font-semibold leading-none"
            style={{
              fontSize: "clamp(1.75rem, 6vw, 2.75rem)",
              letterSpacing: "clamp(2px, 1.1vw, 10px)",
            }}
          >
            SWIFT&nbsp;ASSETS
          </h1>
          <p className="mt-4 text-xs font-light uppercase tracking-[0.3em] text-mute-2">
            UG (Haftungsbeschränkt) · Internal Cockpit
          </p>

          <div className="my-8 h-px w-24 bg-ink-mid" aria-hidden />

          <form onSubmit={handleSubmit} className="w-full space-y-5 text-start">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-[0.7rem] font-medium uppercase tracking-[0.3em] text-mute-2"
              >
                E-Mail
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@swift-assets.de"
                className="h-12 px-4"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-[0.7rem] font-medium uppercase tracking-[0.3em] text-mute-2"
              >
                Passwort
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 px-4"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={status === "submitting"}
              className="h-12 w-full gap-3 text-sm uppercase tracking-[0.2em]"
            >
              {status === "submitting" ? "Wird geprüft…" : "Einloggen"}
              <span aria-hidden>→</span>
            </Button>
            {status === "error" ? (
              <p className="text-sm text-status-red">Ungültige Zugangsdaten.</p>
            ) : null}
          </form>

          <p className="mt-8 text-[0.7rem] uppercase tracking-[0.22em] text-mute-2">
            Kein öffentlicher Zugang
          </p>
        </div>
      </GlassCard>
    </main>
  );
}
