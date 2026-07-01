"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/env";
import { Button } from "@/components/ui/button";

/**
 * TEMPORARY: Magic Link disabled during private UI refinement phase.
 *
 * This is the original Supabase Magic-Link sign-in form, preserved and ready to
 * re-enable. It is currently NOT rendered by /login (which uses the access-code
 * gate). To restore Magic Link: render <MagicLinkForm /> on the login page,
 * revert middleware.ts to `updateSession`, and restore the cockpit layout's
 * Supabase-profile redirect.
 */
export function MagicLinkForm() {
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

  if (status === "sent") {
    return (
      <p className="text-sm text-status-green">
        Anmeldelink wurde versendet. Bitte prüfen Sie Ihr Postfach.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="eyebrow">
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
          className="flex h-10 w-full rounded-md border border-input bg-[rgba(255,255,255,0.04)] px-3 py-1 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60"
        />
      </div>
      <Button type="submit" className="w-full" disabled={status === "sending"}>
        {status === "sending" ? "Wird gesendet…" : "Anmeldelink senden"}
      </Button>
      {status === "error" && message ? (
        <p className="text-sm text-status-red">{message}</p>
      ) : null}
    </form>
  );
}
