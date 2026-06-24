// Supabase Edge Function: generate-outreach-email-draft
//
// CORE PHASE 6A. Generates a professional German outreach email draft for a
// watchlist item from a SAFE snapshot only, and stores it as a normal editable
// Cockpit outreach draft. Runs server-side; the AI provider key is read from
// Edge Function env (never committed, never in the browser).
//
// Flow:
//   1. Require an authenticated request (user JWT in Authorization header).
//   2. Body: { watch_kind: "company"|"nachlass", watch_id: uuid,
//              replace_existing?: boolean }.
//   3. RPC cockpit_get_outreach_ai_snapshot -> safe snapshot (access-gated).
//   4. Call AI provider (OpenAI primary, Gemini fallback) with the snapshot.
//   5. Strictly validate the German email JSON.
//   6. RPC cockpit_store_ai_outreach_draft -> draft_id (status 'draft').
//
// Privacy: prompt uses ONLY the safe snapshot. No raw announcement text, no
// source excerpt, no detection reasoning, no deceased/person names, no birth
// dates, no private addresses. The recipient stored on the draft is derived
// server-side in the RPC from the authoritative view, NOT from the AI output.
// No email is ever sent. No secrets / raw provider responses / full snapshot
// are logged.

// @ts-nocheck — Deno runtime types are not available in the Next.js typecheck.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROMPT_VERSION = "outreach-v1";

const SYSTEM_PROMPT = `Du verfasst eine professionelle deutsche Geschäfts-E-Mail für die Swift Assets UG (haftungsbeschränkt).
Über Swift Assets UG: Wir identifizieren und bewerten Distressed-Acquisition-Gelegenheiten anhand öffentlicher Insolvenz- und Unternehmensdaten. Sitz: Neuss, Nordrhein-Westfalen. Telefon: +49 212 68989935.
Die E-Mail richtet sich an den/die Insolvenzverwalter(in) und ist eine respektvolle, unverbindliche Anfrage.

Strikte Regeln:
- Die E-Mail ist KEINE Behauptung, dass Vermögenswerte zum Verkauf stehen. Keine Verkaufssprache, kein Verkaufsversprechen.
- Erfinde keine Fakten und keine Finanzzahlen. Wenn financial_data_status nicht "vorhanden" ist oder bundesanzeiger_status = retired/unavailable: erwähne KEINE Finanzzahlen.
- Ton: professionell, präzise, juristisch zurückhaltend, deutscher Geschäftsstil. Kein Druck, keine Rechtsbehauptungen.
- Für company-Fälle: nenne den Firmennamen (display_title) und das Aktenzeichen.
- Für nachlass-Fälle: verwende AUSSCHLIESSLICH die sichere Formulierung "Nachlassinsolvenzverfahren, Az. ..." und das Gericht. Nenne KEINE verstorbene Person, keinen Namen, kein Geburtsdatum, keine Privatadresse, keinen Rohtext.
- Frage höflich, ob es akquise-relevante Vermögenswerte, fortführungsfähige Betriebsteile, Warenbestände, Domains, Ausstattung/Maschinen, Forderungen oder sonstige übertragbare Assets gibt (nur soweit passend).
- Frage, ob der/die Verwalter(in) oder die Kanzlei weitere Informationen oder einen Ansprechpartner/Prozess bereitstellen kann.
- Wenn administrator_email fehlt: verfasse den Text trotzdem, setze recipient_email auf null und füge "missing_recipient_email" zu missing_fields hinzu.
- Verwende für die Anrede administrator_name, falls vorhanden; sonst "Sehr geehrte Damen und Herren".

Antworte AUSSCHLIESSLICH mit striktem JSON nach diesem Schema:
{"subject": string, "recipient_email": string|null, "recipient_name": string|null, "body": string, "language": "de", "confidence": "low"|"medium"|"high", "risk_flags": string[], "missing_fields": string[], "recommended_next_action": string}`;

const SUBJECT_MAX = 200;
const BODY_MAX = 8000;

// Strictly parse + validate the provider's JSON. Throws "invalid_ai_response"
// on any malformed / out-of-contract output so we never store garbage.
function parseAndValidateDraft(text: string) {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("invalid_ai_response");
  }
  if (!raw || typeof raw !== "object") throw new Error("invalid_ai_response");

  const asTrimmed = (v: unknown): string => {
    if (typeof v !== "string") throw new Error("invalid_ai_response");
    return v.trim();
  };

  const subject = asTrimmed(raw.subject);
  const body = asTrimmed(raw.body);
  if (subject.length === 0 || subject.length > SUBJECT_MAX) {
    throw new Error("invalid_ai_response");
  }
  if (body.length === 0 || body.length > BODY_MAX) {
    throw new Error("invalid_ai_response");
  }

  if (raw.language !== "de") throw new Error("invalid_ai_response");
  if (!["low", "medium", "high"].includes(raw.confidence)) {
    throw new Error("invalid_ai_response");
  }

  const asStringArray = (v: unknown): string[] => {
    if (!Array.isArray(v)) throw new Error("invalid_ai_response");
    return v
      .map((x: unknown) => {
        if (typeof x !== "string") throw new Error("invalid_ai_response");
        return x.trim();
      })
      .filter((x: string) => x.length > 0)
      .slice(0, 12);
  };

  // recipient_email may be null or an email-like string.
  let recipientEmail: string | null = null;
  if (raw.recipient_email !== null && raw.recipient_email !== undefined) {
    if (typeof raw.recipient_email !== "string") throw new Error("invalid_ai_response");
    const e = raw.recipient_email.trim();
    recipientEmail = e.length === 0 ? null : e;
    if (recipientEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
      throw new Error("invalid_ai_response");
    }
  }

  let recipientName: string | null = null;
  if (raw.recipient_name !== null && raw.recipient_name !== undefined) {
    if (typeof raw.recipient_name !== "string") throw new Error("invalid_ai_response");
    const n = raw.recipient_name.trim();
    recipientName = n.length === 0 ? null : n;
  }

  return {
    subject,
    body,
    language: "de" as const,
    recipient_email: recipientEmail,
    recipient_name: recipientName,
    confidence: raw.confidence as string,
    risk_flags: asStringArray(raw.risk_flags),
    missing_fields: asStringArray(raw.missing_fields),
    recommended_next_action: asTrimmed(raw.recommended_next_action),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
      temperature: 0.3,
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
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini_http_${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return { text, provider: "gemini", model };
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

  let body: { watch_kind?: string; watch_id?: string; replace_existing?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_request" }, 400);
  }
  const watchKind = body.watch_kind;
  const watchId = body.watch_id;
  const replaceExisting = body.replace_existing === true;
  if (watchKind !== "company" && watchKind !== "nachlass") {
    return jsonResponse({ ok: false, error: "invalid_kind" }, 400);
  }
  if (!watchId) return jsonResponse({ ok: false, error: "invalid_request" }, 400);

  // 1) Safe snapshot (writer role + Nachlass authorization enforced in RPC).
  const snap = await supabase.rpc("cockpit_get_outreach_ai_snapshot", {
    p_watch_kind: watchKind,
    p_watch_id: watchId,
  });
  if (snap.error) {
    return jsonResponse({ ok: false, error: snap.error.message }, 400);
  }
  const snapshot = snap.data;

  // 1b) Preflight: avoid spending AI tokens if an active draft already exists.
  //     Skipped when replacing. The authoritative duplicate guard still lives
  //     inside cockpit_store_ai_outreach_draft (race protection).
  if (!replaceExisting) {
    const pre = await supabase.rpc("cockpit_has_active_outreach_draft", {
      p_watch_kind: watchKind,
      p_watch_id: watchId,
    });
    if (pre.error) {
      return jsonResponse({ ok: false, error: pre.error.message }, 400);
    }
    if (pre.data === true) {
      return jsonResponse({ ok: false, error: "active_draft_exists" }, 400);
    }
  }

  // 2) Provider selection (server-side only). OpenAI primary per phase spec.
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!openaiKey && !geminiKey) {
    return jsonResponse({ ok: false, error: "ai_provider_not_configured" }, 400);
  }

  // 3) Generate + strictly validate JSON (never store malformed output).
  let draft: ReturnType<typeof parseAndValidateDraft>;
  let provider = "";
  let model = "";
  try {
    const out = openaiKey
      ? await callOpenAI(openaiKey, snapshot)
      : await callGemini(geminiKey as string, snapshot);
    provider = out.provider;
    model = out.model;
    if (!out.text) throw new Error("invalid_ai_response");
    draft = parseAndValidateDraft(out.text);
  } catch (_e) {
    return jsonResponse({ ok: false, error: "invalid_ai_response" }, 502);
  }

  // 4) Store as a normal editable draft. Recipient derives server-side from the
  //    authoritative view inside the RPC (AI recipient_email is NOT trusted).
  const stored = await supabase.rpc("cockpit_store_ai_outreach_draft", {
    p_watch_kind: watchKind,
    p_watch_id: watchId,
    p_subject: draft.subject,
    p_body: draft.body,
    p_language: draft.language,
    p_ai_model_provider: provider,
    p_ai_model_name: model,
    p_ai_prompt_version: PROMPT_VERSION,
    p_ai_confidence: draft.confidence,
    p_ai_risk_flags: draft.risk_flags,
    p_ai_missing_fields: draft.missing_fields,
    p_replace_existing: replaceExisting,
  });
  if (stored.error) {
    // active_draft_exists is an expected, non-error outcome surfaced to the UI.
    return jsonResponse({ ok: false, error: stored.error.message }, 400);
  }

  return jsonResponse({ ok: true, draft_id: stored.data as string, status: "generated" });
});
