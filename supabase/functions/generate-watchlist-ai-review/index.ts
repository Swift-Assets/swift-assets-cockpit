// Supabase Edge Function: generate-watchlist-ai-review
//
// CORE PHASE 5A scaffold. Generates an internal AI case review for a watchlist
// item from a SAFE snapshot only. Runs server-side; the AI provider key is read
// from Edge Function env (never committed, never in the browser).
//
// Flow:
//   1. Require an authenticated request (user JWT in Authorization header).
//   2. Body: { watch_kind: "company"|"nachlass", watch_id: uuid }.
//   3. RPC cockpit_create_ai_case_review_request -> review_id (status pending).
//   4. RPC cockpit_get_ai_case_review_source_snapshot -> safe snapshot.
//   5. Call AI provider (Gemini primary, OpenAI fallback) with the snapshot.
//   6. RPC cockpit_store_ai_case_review_result (or cockpit_fail_ai_case_review).
//
// Privacy: prompt uses ONLY the safe snapshot. No raw text / PII. No secrets or
// raw provider responses are logged.

// @ts-nocheck — Deno runtime types are not available in the Next.js typecheck.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SYSTEM_PROMPT = `Du bist ein interner Akquisitions-Analyst für Swift Assets UG (haftungsbeschränkt).
Bewerte einen Insolvenz-/Nachlassinsolvenz-Fall AUSSCHLIESSLICH anhand des bereitgestellten JSON-Snapshots.
Regeln:
- Erfinde keine Finanzzahlen. Wenn financial_data_status != vorhanden oder bundesanzeiger_status = retired/unavailable: weise auf fehlende Finanzdaten hin.
- Behaupte nicht, dass Vermögenswerte zum Verkauf stehen. Nutze interne "distressed acquisition lead"-Logik, keine öffentliche Verkaufssprache.
- Für Nachlass: keine Rückschlüsse auf persönliche Identität, keine erfundenen Nachlasswerte; nur "Nachlassinsolvenzverfahren"/"Nachlassmasse".
- acquisition_score (0-100) berücksichtigt: pre_verteilung_relevance, phase_priority, Verwalter-Kontakt, Handelsregister-Verifizierung, Finanzdatenlage, Datenlücken, outreach_ready.
- risk_flags nur wenn durch Snapshot gestützt (z.B. missing email, missing case reference, no financial data, late-stage phase, unverified HR, nachlass sensitivity).
Antworte AUSSCHLIESSLICH mit striktem JSON nach diesem Schema:
{"summary_ar": string, "summary_de": string, "acquisition_score": number, "priority": "low"|"medium"|"high"|"urgent", "reasoning_ar": string, "risk_flags": string[], "recommended_next_action": string, "confidence": "low"|"medium"|"high"}`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function callGemini(apiKey: string, snapshot: unknown) {
  const model = "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(snapshot) }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini_http_${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { text, provider: "gemini", model };
}

async function callOpenAI(apiKey: string, snapshot: unknown) {
  const model = "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(snapshot) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai_http_${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return { text, provider: "openai", model };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ ok: false, error: "not_authenticated" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return jsonResponse({ ok: false, error: "server_misconfigured" }, 500);

  // Client bound to the caller's JWT — all RPCs run under the user's identity.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    db: { schema: "swift_v2" },
  });

  let body: { watch_kind?: string; watch_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400);
  }
  const watchKind = body.watch_kind;
  const watchId = body.watch_id;
  if (watchKind !== "company" && watchKind !== "nachlass") {
    return jsonResponse({ ok: false, error: "invalid_kind" }, 400);
  }
  if (!watchId) return jsonResponse({ ok: false, error: "invalid_request" }, 400);

  // 1) Create the pending review (writer + nachlass gating enforced in RPC).
  const created = await supabase.rpc("cockpit_create_ai_case_review_request", {
    p_watch_kind: watchKind,
    p_watch_id: watchId,
  });
  if (created.error) {
    return jsonResponse({ ok: false, error: created.error.message }, 400);
  }
  const reviewId = created.data as string;

  // 2) Safe snapshot for the prompt.
  const snap = await supabase.rpc("cockpit_get_ai_case_review_source_snapshot", {
    p_review_id: reviewId,
  });
  if (snap.error) {
    await supabase.rpc("cockpit_fail_ai_case_review", {
      p_review_id: reviewId,
      p_error_code: "snapshot_error",
      p_error_message: "snapshot unavailable",
    });
    return jsonResponse({ ok: false, error: "snapshot_error", review_id: reviewId }, 400);
  }
  const snapshot = snap.data;

  // 3) Provider selection (server-side only).
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!geminiKey && !openaiKey) {
    await supabase.rpc("cockpit_fail_ai_case_review", {
      p_review_id: reviewId,
      p_error_code: "ai_provider_not_configured",
      p_error_message: "no provider key configured",
    });
    return jsonResponse({ ok: false, error: "ai_provider_not_configured", review_id: reviewId }, 400);
  }

  // 4) Generate + parse strict JSON.
  let parsed: Record<string, unknown>;
  let provider = "";
  let model = "";
  try {
    const out = geminiKey
      ? await callGemini(geminiKey, snapshot)
      : await callOpenAI(openaiKey as string, snapshot);
    provider = out.provider;
    model = out.model;
    if (!out.text) throw new Error("empty_ai_response");
    parsed = JSON.parse(out.text);
  } catch (_e) {
    await supabase.rpc("cockpit_fail_ai_case_review", {
      p_review_id: reviewId,
      p_error_code: "invalid_ai_response",
      p_error_message: "ai generation/parse failed",
    });
    return jsonResponse({ ok: false, error: "invalid_ai_response", review_id: reviewId }, 502);
  }

  // 5) Store result.
  const stored = await supabase.rpc("cockpit_store_ai_case_review_result", {
    p_review_id: reviewId,
    p_summary_ar: parsed.summary_ar ?? null,
    p_summary_de: parsed.summary_de ?? null,
    p_acquisition_score:
      typeof parsed.acquisition_score === "number" ? parsed.acquisition_score : null,
    p_priority: parsed.priority ?? null,
    p_reasoning_ar: parsed.reasoning_ar ?? null,
    p_risk_flags: parsed.risk_flags ?? [],
    p_recommended_next_action: parsed.recommended_next_action ?? null,
    p_confidence: parsed.confidence ?? null,
    p_model_provider: provider,
    p_model_name: model,
  });
  if (stored.error) {
    await supabase.rpc("cockpit_fail_ai_case_review", {
      p_review_id: reviewId,
      p_error_code: "store_error",
      p_error_message: "could not store result",
    });
    return jsonResponse({ ok: false, error: "store_error", review_id: reviewId }, 400);
  }

  return jsonResponse({ ok: true, review_id: reviewId, status: "generated" });
});
