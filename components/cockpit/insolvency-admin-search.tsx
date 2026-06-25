"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Keyword box for the Insolvenzverwalter-Datenbank. Server-driven: navigates to
 * /cockpit/dashboard with ?admin_q= (preserves the hash anchor). No data access.
 */
export function InsolvencyAdminSearch({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue ?? "");

  function submit() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("admin_q", q.trim());
    const qs = params.toString();
    router.push(qs ? `/cockpit/dashboard?${qs}#verwalter` : "/cockpit/dashboard#verwalter");
  }

  return (
    <div className="flex gap-2">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Name, Kanzlei, Ort, E-Mail oder Telefon suchen…"
        aria-label="Insolvenzverwalter-Suche"
      />
      <Button type="button" onClick={submit}>
        Suchen
      </Button>
    </div>
  );
}
