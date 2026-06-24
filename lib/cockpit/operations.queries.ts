import { createClient } from "@/lib/supabase/server";
import type { TrafficStatus } from "@/components/cockpit/status-badge";

/**
 * Read-only Operations KPIs sourced ONLY from existing safe, RLS-gated views:
 *  - swift_v2.v_cockpit_enrichment_jobs (authenticated SELECT; aggregate only)
 *  - swift_v2.v_daily_run_log           (authenticated SELECT; operational, non-PII)
 *
 * Only aggregate counts, statuses and timestamps are read — never company names,
 * error payloads, raw announcement text or any PII. Each group is wrapped so a
 * missing/forbidden source degrades to `available: false` (placeholder) instead
 * of breaking the page. No raw SQL errors are surfaced.
 */

export interface EnrichmentKpis {
  available: boolean;
  status: TrafficStatus;
  total: number;
  pending: number;
  running: number;
  failed: number;
  succeeded: number;
}

export interface IngestionKpis {
  available: boolean;
  status: TrafficStatus;
  runDate: string | null;
  runStatus: string | null;
  s1Inserted: number | null;
  s1Failed: number | null;
  s2Enriched: number | null;
  s2Failed: number | null;
  durationSeconds: number | null;
}

export interface OpsEventRow {
  run_id: string;
  run_date: string | null;
  status: string | null;
  duration_seconds: number | null;
  triggered_by: string | null;
  triggered_by_run_url: string | null;
}

export interface RecentEventsKpis {
  available: boolean;
  rows: OpsEventRow[];
}

export interface GithubKpis {
  available: boolean;
  status: TrafficStatus;
  triggeredBy: string | null;
  runUrl: string | null;
  runDate: string | null;
  runStatus: string | null;
}

export interface OperationsData {
  enrichment: EnrichmentKpis;
  ingestion: IngestionKpis;
  recentEvents: RecentEventsKpis;
  github: GithubKpis;
}

export interface SystemHealthCheck {
  check_key: string;
  check_group: string | null;
  status: TrafficStatus;
  title: string | null;
  message: string | null;
  // Safe operational metrics only (counts / ages / status labels / booleans /
  // timestamps). Never raw errors, payloads, or PII — enforced by the writer.
  details: Record<string, string | number | boolean | null> | null;
  last_checked_at: string | null;
  resolved_at: string | null;
}

export interface SystemHealthKpis {
  available: boolean;
  status: TrafficStatus;
  checks: SystemHealthCheck[];
}

/** Worst-first ordering for traffic-light rollup. */
const STATUS_RANK: Record<TrafficStatus, number> = {
  red: 3,
  yellow: 2,
  green: 1,
  gray: 0,
};

function rollupStatus(checks: SystemHealthCheck[]): TrafficStatus {
  let worst: TrafficStatus = "green";
  for (const c of checks) {
    if (STATUS_RANK[c.status] > STATUS_RANK[worst]) worst = c.status;
  }
  return worst;
}

/**
 * Defensive check that a value is a real GitHub Actions run URL — used before
 * rendering it as a link. Rejects non-GitHub schemes (e.g. inline:// markers).
 */
export function isSafeGithubRunUrl(url: string | null): boolean {
  if (!url) return false;
  return url.startsWith("https://github.com/") && url.includes("/actions/runs/");
}

const EMPTY_ENRICHMENT: EnrichmentKpis = {
  available: false,
  status: "gray",
  total: 0,
  pending: 0,
  running: 0,
  failed: 0,
  succeeded: 0,
};

// enrichment_jobs status values observed in the cockpit view.
const STATUS_DONE = "done";
const STATUS_DEAD_LETTER = "dead_letter";
const STATUS_PENDING = "pending";
const STATUS_RUNNING = "running";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function countJobs(
  supabase: SupabaseServerClient,
  status?: string,
): Promise<number | null> {
  let query = supabase
    .from("v_cockpit_enrichment_jobs")
    .select("job_id", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
}

async function getEnrichmentKpis(): Promise<EnrichmentKpis> {
  try {
    const supabase = await createClient();
    const [total, succeeded, failed, pending, running] = await Promise.all([
      countJobs(supabase),
      countJobs(supabase, STATUS_DONE),
      countJobs(supabase, STATUS_DEAD_LETTER),
      countJobs(supabase, STATUS_PENDING),
      countJobs(supabase, STATUS_RUNNING),
    ]);

    if (total === null) return EMPTY_ENRICHMENT;

    const failedCount = failed ?? 0;
    return {
      available: true,
      status: failedCount > 0 ? "yellow" : "green",
      total,
      pending: pending ?? 0,
      running: running ?? 0,
      failed: failedCount,
      succeeded: succeeded ?? 0,
    };
  } catch {
    return EMPTY_ENRICHMENT;
  }
}

function ingestionStatus(
  runDate: string | null,
  runStatus: string | null,
  failedTotal: number,
): TrafficStatus {
  if (!runDate) return "yellow";
  const text = (runStatus ?? "").toLowerCase();
  if (text.includes("fail") || text.includes("error")) return "red";

  // Stale if the last run is older than ~2 days.
  const ageMs = Date.now() - new Date(runDate).getTime();
  const stale = Number.isFinite(ageMs) && ageMs > 2 * 24 * 60 * 60 * 1000;

  if (failedTotal > 0 || stale) return "yellow";
  return "green";
}

async function getIngestionKpis(): Promise<IngestionKpis> {
  const empty: IngestionKpis = {
    available: false,
    status: "gray",
    runDate: null,
    runStatus: null,
    s1Inserted: null,
    s1Failed: null,
    s2Enriched: null,
    s2Failed: null,
    durationSeconds: null,
  };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_daily_run_log")
      .select(
        "run_date, status, s1_inserted_count, s1_failed_count, s2_enriched_count, s2_failed_count, duration_seconds",
      )
      .order("run_date", { ascending: false, nullsFirst: false })
      .limit(1);

    if (error) return empty;

    const row = (data ?? [])[0] as
      | {
          run_date: string | null;
          status: string | null;
          s1_inserted_count: number | null;
          s1_failed_count: number | null;
          s2_enriched_count: number | null;
          s2_failed_count: number | null;
          duration_seconds: number | null;
        }
      | undefined;

    if (!row) {
      return { ...empty, available: true, status: "yellow" };
    }

    const failedTotal = (row.s1_failed_count ?? 0) + (row.s2_failed_count ?? 0);
    return {
      available: true,
      status: ingestionStatus(row.run_date, row.status, failedTotal),
      runDate: row.run_date,
      runStatus: row.status,
      s1Inserted: row.s1_inserted_count,
      s1Failed: row.s1_failed_count,
      s2Enriched: row.s2_enriched_count,
      s2Failed: row.s2_failed_count,
      durationSeconds: row.duration_seconds,
    };
  } catch {
    return empty;
  }
}

async function getRecentEvents(): Promise<RecentEventsKpis> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_daily_run_log")
      .select(
        "run_id, run_date, status, duration_seconds, triggered_by, triggered_by_run_url",
      )
      .order("run_date", { ascending: false, nullsFirst: false })
      .limit(5);

    if (error) return { available: false, rows: [] };
    return { available: true, rows: (data ?? []) as OpsEventRow[] };
  } catch {
    return { available: false, rows: [] };
  }
}

function githubStatus(runStatus: string | null): TrafficStatus {
  const text = (runStatus ?? "").toLowerCase();
  if (text.includes("fail") || text.includes("error")) return "red";
  if (text.includes("succeed") || text.includes("success") || text.includes("ok"))
    return "green";
  return "yellow";
}

/**
 * Latest run that carries a safe GitHub Actions run URL, from v_daily_run_log.
 * Reads only safe columns (no report jsonb, error_message, or company name).
 * Falls back to a placeholder when no safe URL is present.
 */
async function getGithubSource(): Promise<GithubKpis> {
  const empty: GithubKpis = {
    available: false,
    status: "gray",
    triggeredBy: null,
    runUrl: null,
    runDate: null,
    runStatus: null,
  };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_daily_run_log")
      .select("run_date, status, triggered_by, triggered_by_run_url")
      .order("run_date", { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) return empty;

    const rows = (data ?? []) as {
      run_date: string | null;
      status: string | null;
      triggered_by: string | null;
      triggered_by_run_url: string | null;
    }[];

    const match = rows.find((r) => isSafeGithubRunUrl(r.triggered_by_run_url));
    if (!match) return empty;

    return {
      available: true,
      status: githubStatus(match.status),
      triggeredBy: match.triggered_by,
      runUrl: match.triggered_by_run_url,
      runDate: match.run_date,
      runStatus: match.status,
    };
  } catch {
    return empty;
  }
}

/**
 * Read-only system/data-pipeline health from the safe view
 * swift_v2.v_cockpit_system_health. The view only exists once migration 0024 is
 * applied; until then this query errors and the card degrades to a gray
 * placeholder (available:false). Reads safe operational columns only.
 */
export async function getSystemHealth(): Promise<SystemHealthKpis> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_system_health")
      .select(
        "check_key, check_group, status, title, message, details, last_checked_at, resolved_at",
      )
      .order("check_group", { ascending: true });

    if (error) return { available: false, status: "gray", checks: [] };

    const checks = (data ?? []) as SystemHealthCheck[];
    if (checks.length === 0) {
      return { available: false, status: "gray", checks: [] };
    }
    return { available: true, status: rollupStatus(checks), checks };
  } catch {
    return { available: false, status: "gray", checks: [] };
  }
}

export async function getOperationsData(): Promise<OperationsData> {
  const [enrichment, ingestion, recentEvents, github] = await Promise.all([
    getEnrichmentKpis(),
    getIngestionKpis(),
    getRecentEvents(),
    getGithubSource(),
  ]);
  return { enrichment, ingestion, recentEvents, github };
}
