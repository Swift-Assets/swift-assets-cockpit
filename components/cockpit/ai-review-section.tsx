"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateAiCaseReviewAction } from "@/app/cockpit/ai-reviews/actions";
import type { AiCaseReviewRow } from "@/lib/cockpit/ai-reviews.queries";

function scoreVariant(score: number | null): "red" | "yellow" | "green" | "muted" {
  if (score === null) return "muted";
  if (score >= 70) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

function priorityVariant(p: string | null): "red" | "yellow" | "muted" {
  if (p === "urgent") return "red";
  if (p === "high") return "yellow";
  return "muted";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function AiReviewSection({
  kind,
  watchId,
  review,
}: {
  kind: string;
  watchId: string;
  review: AiCaseReviewRow | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateAiCaseReviewAction(kind, watchId);
      if (!res.ok) setError(res.error);
      else setRequested(true);
    });
  }

  return (
    <div className="space-y-2">
      <p className="font-medium">KI-Bewertung</p>

      {review ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={scoreVariant(review.acquisition_score)}>
              Score: {review.acquisition_score ?? "—"}
            </Badge>
            <Badge variant={priorityVariant(review.priority)}>
              {review.priority ?? "—"}
            </Badge>
            {review.confidence ? (
              <Badge variant="muted">Konfidenz: {review.confidence}</Badge>
            ) : null}
          </div>
          {review.summary_de ? (
            <p className="text-sm">{review.summary_de}</p>
          ) : null}
          {review.summary_ar ? (
            <p dir="rtl" className="text-sm text-muted-foreground">
              {review.summary_ar}
            </p>
          ) : null}
          {review.reasoning_ar ? (
            <p dir="rtl" className="text-xs text-muted-foreground">
              {review.reasoning_ar}
            </p>
          ) : null}
          {review.risk_flags && review.risk_flags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {review.risk_flags.map((f) => (
                <Badge key={f} variant="yellow">
                  {f}
                </Badge>
              ))}
            </div>
          ) : null}
          {review.recommended_next_action ? (
            <p className="text-xs">
              <span className="text-muted-foreground">Nächster Schritt: </span>
              {review.recommended_next_action}
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {review.model_provider ?? "—"}
            {review.model_name ? ` · ${review.model_name}` : ""} ·{" "}
            {formatDateTime(review.updated_at)}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={generate}
          >
            {pending ? "Wird neu bewertet…" : "Neu bewerten"}
          </Button>
        </div>
      ) : requested ? (
        <p className="text-sm text-status-green">
          KI-Bewertung angefordert. Bitte Seite neu laden.
        </p>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={generate}
        >
          {pending ? "Wird erstellt…" : "KI-Bewertung erstellen"}
        </Button>
      )}

      {error ? <p className="text-xs text-status-red">{error}</p> : null}
    </div>
  );
}
