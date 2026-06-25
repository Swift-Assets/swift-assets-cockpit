/**
 * Best-available Insolvenzverwalter contact selection (Phase 0045C).
 *
 * Many inbox rows carry the latest announcement's admin fields, which can be
 * blank even when an EARLIER Bekanntmachung for the same case did capture them.
 * This picks the best available contact from the current row first, then fills
 * each missing field from the timeline events — STRUCTURED fields only. It never
 * parses or exposes raw announcement text and never invents data.
 */

import type { CaseTimelineEvent } from "@/lib/cockpit/case-timeline.queries";

export interface AdministratorContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  /** Where the resulting fields came from. */
  source: "inbox" | "timeline" | "none";
}

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t && t.length > 0 ? t : null;
}

export function chooseBestAdministratorContact(input: {
  inbox: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  timeline: CaseTimelineEvent[];
}): AdministratorContact {
  // Start from the current row.
  const result = {
    name: clean(input.inbox.name),
    email: clean(input.inbox.email),
    phone: clean(input.inbox.phone),
    address: clean(input.inbox.address),
  };

  // Scan timeline newest-first; fill any field still missing.
  const events = [...input.timeline].sort((a, b) => {
    const ta = a.publicationDate ? Date.parse(a.publicationDate) : 0;
    const tb = b.publicationDate ? Date.parse(b.publicationDate) : 0;
    return tb - ta;
  });

  let usedTimeline = false;
  for (const e of events) {
    if (!result.name && clean(e.administratorName)) {
      result.name = clean(e.administratorName);
      usedTimeline = true;
    }
    if (!result.email && clean(e.administratorEmail)) {
      result.email = clean(e.administratorEmail);
      usedTimeline = true;
    }
    if (!result.phone && clean(e.administratorPhone)) {
      result.phone = clean(e.administratorPhone);
      usedTimeline = true;
    }
    if (!result.address && clean(e.administratorAddress)) {
      result.address = clean(e.administratorAddress);
      usedTimeline = true;
    }
    if (result.name && result.email && result.phone && result.address) break;
  }

  const hasAny = Boolean(
    result.name || result.email || result.phone || result.address,
  );
  const source: AdministratorContact["source"] = !hasAny
    ? "none"
    : usedTimeline
      ? "timeline"
      : "inbox";

  return { ...result, source };
}
