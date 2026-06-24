"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/env";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BirdMark } from "@/components/cockpit/brand";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);
    try {
      const supabase = createClient();
      // Preserve a safe, same-origin deep-link target across the magic link so
      // the user returns to where they were headed. Only relative "/..." paths
      // are kept; the callback re-validates this too.
      let callback = `${getSiteUrl()}/auth/callback`;
      if (typeof window !== "undefined") {
        const from = new URLSearchParams(window.location.search).get(
          "redirectedFrom",
        );
        if (from && from.startsWith("/") && !from.startsWith("//")) {
          callback += `?redirectedFrom=${encodeURIComponent(from)}`;
        }
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // No public signup: only existing cockpit users can receive a link.
          shouldCreateUser: false,
          emailRedirectTo: callback,
        },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error
          ? err.message
          : "Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
      );
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6">
      {/* Brand hero: bird + faded halo */}
      <div className="mb-10 flex flex-col items-center text-center">
        <BirdMark size={84} />
        <h1 className="mt-7 text-2xl font-semibold uppercase tracking-[0.22em] text-foreground">
          Swift Assets
        </h1>
        <p className="mt-2 text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
          UG (haftungsbeschränkt) · Internal Cockpit
        </p>
        <div className="mt-5 h-px w-12 bg-border" aria-hidden />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-base">Interner Zugang</CardTitle>
          <CardDescription>
            Bitte geben Sie Ihre Firmen-E-Mail ein, um einen Anmeldelink zu
            erhalten. Kein öffentlicher Zugang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <p className="text-sm text-status-green">
              Anmeldelink wurde versendet. Bitte prüfen Sie Ihr Postfach.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="eyebrow"
                >
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@swift-assets.de"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Wird gesendet…" : "Anmeldelink senden"}
              </Button>
              {status === "error" && message ? (
                <p className="text-sm text-status-red">{message}</p>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
