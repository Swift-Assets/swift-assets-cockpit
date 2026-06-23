import { createClient } from "@/lib/supabase/server";
import { getMyWatchlist } from "@/lib/cockpit/watchlist.queries";
import { followUpBucket } from "@/lib/cockpit/watchlist";

/**
 * Read-only dashboard KPIs sourced ONLY from existing safe, RLS-gated views:
 *  - swift_v2.v_cockpit_my_watchlist (per-user, via getMyWatchlist)
 *  - swift_v2.v_cockpit_companies   (company-only, non-sensitive)
 *  - swift_v2.v_cockpit_review_inbox (aggregate: status -> count)
 *
 * Each KPI group is wrapped so a missing/forbidden source degrades to
 * `available: false` (rendered as a "Noch nicht verbunden" placeholder) instead
 * of breaking the page. No raw SQL errors are surfaced. No PII is read.
 */

export interface WatchlistKpis {
  available: boolean;
  total: number;
  companies: number;
  nachlass: number;
  overdue: number;
  today: number;
  watching: number;
  pursuing: number;
  passed: number;
}

export interface CompanyActivityKpis {
  available: boolean;
  today: number | null;
  last24h: number | null;
}

export interface CountKpi {
  available: boolean;
  value: number | null;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface DataCoverage {
  available: boolean;
  companiesTotal: number | null;
  enrichmentJobsTotal: number | null;
  totalCompanyInsolvencies: number | null;
  handelsregisterVerificationRate: number | null;
  byPhase: LabelCount[];
  topBundeslaender: LabelCount[];
  generatedAt: string | null;
  // Rich internal summary from v_cockpit_data_coverage_summary (Phase 6D).
  // null until migration 0025 is applied; UI falls back to the public stats.
  summary: CoverageSummary | null;
}

/**
 * One row of swift_v2.v_cockpit_data_coverage_summary — safe aggregates only.
 * All fields are counts/rates/timestamps/status labels; never PII.
 */
export interface CoverageSummary {
  generated_at: string | null;
  entities_total: number | null;
  entities_company: number | null;
  entities_natural_person: number | null;
  entities_unknown_type: number | null;
  entities_sensitivity_normal: number | null;
  entities_restricted: number | null;
  company_public_eligible: number | null;
  entities_with_source_links: number | null;
  entities_missing_links: number | null;
  company_cases_total: number | null;
  portal_candidate_cases_total: number | null;
  uncertain_cases_total: number | null;
  announcements_total: number | null;
  announcements_latest_date: string | null;
  announcements_latest_scraped_at: string | null;
  announcements_linked: number | null;
  announcements_unlinked: number | null;
  announcements_company: number | null;
  announcements_natural_person: number | null;
  hr_records_total: number | null;
  hr_entities_verified: number | null;
  hr_companies_missing: number | null;
  hr_latest_fetched_at: string | null;
  hr_verification_rate: number | null;
  bundesanzeiger_status: string | null;
  jobs_total: number | null;
  jobs_pending: number | null;
  jobs_running: number | null;
  jobs_done: number | null;
  jobs_dead_letter: number | null;
  jobs_latest_created_at: string | null;
  jobs_latest_updated_at: string | null;
  portal_candidates_ready: number | null;
  portal_candidates_review: number | null;
  natural_person_normal_sensitivity: number | null;
}

export interface DashboardData {
  watchlist: WatchlistKpis;
  companyActivity: CompanyActivityKpis;
  reviewQueue: CountKpi;
  coverage: DataCoverage;
}

const EMPTY_WATCHLIST: WatchlistKpis = {
  available: false,
  total: 0,
  companies: 0,
  nachlass: 0,
  overdue: 0,
  today: 0,
  watching: 0,
  pursuing: 0,
  passed: 0,
};

async function getWatchlistKpis(): Promise<WatchlistKpis> {
  try {
    const { rows, error } = await getMyWatchlist();
    if (error) return EMPTY_WATCHLIST;

    const now = new Date();
    const kpis: WatchlistKpis = { ...EMPTY_WATCHLIST, available: true };
    kpis.total = rows.length;
    for (const row of rows) {
      if (row.kind === "company") kpis.companies += 1;
      else if (row.kind === "nachlass") kpis.nachlass += 1;

      if (row.status === "watching") kpis.watching += 1;
      else if (row.status === "pursuing") kpis.pursuing += 1;
      else if (row.status === "passed") kpis.passed += 1;

      const bucket = followUpBucket(row.next_follow_up_at, now);
      if (bucket === "overdue") kpis.overdue += 1;
      else if (bucket === "today") kpis.today += 1;
    }
    return kpis;
  } catch {
    return EMPTY_WATCHLIST;
  }
}

async function getCompanyActivity(): Promise<CompanyActivityKpis> {
  try {
    const supabase = await createClient();
    const now = new Date();
    const startOfTodayIso = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString();
    const last24hIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [todayRes, last24hRes] = await Promise.all([
      supabase
        .from("v_cockpit_companies")
        .select("entity_id", { count: "exact", head: true })
        .gte("first_seen_at", startOfTodayIso),
      supabase
        .from("v_cockpit_companies")
        .select("entity_id", { count: "exact", head: true })
        .gte("first_seen_at", last24hIso),
    ]);

    if (todayRes.error || last24hRes.error) {
      return { available: false, today: null, last24h: null };
    }
    return {
      available: true,
      today: todayRes.count ?? 0,
      last24h: last24hRes.count ?? 0,
    };
  } catch {
    return { available: false, today: null, last24h: null };
  }
}

async function getReviewQueue(): Promise<CountKpi> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_review_inbox")
      .select("publication_status, count");

    if (error) return { available: false, value: null };

    const total = (data ?? []).reduce(
      (sum, r) => sum + Number((r as { count: number | string }).count ?? 0),
      0,
    );
    return { available: true, value: total };
  } catch {
    return { available: false, value: null };
  }
}

const EMPTY_COVERAGE: DataCoverage = {
  available: false,
  companiesTotal: null,
  enrichmentJobsTotal: null,
  totalCompanyInsolvencies: null,
  handelsregisterVerificationRate: null,
  byPhase: [],
  topBundeslaender: [],
  generatedAt: null,
  summary: null,
};

/**
 * Reads the rich internal summary view (Phase 6D). Returns null if the view is
 * absent (migration 0025 not yet applied) or on any error — the UI then falls
 * back to the public statistics. Safe aggregates only.
 */
async function getCoverageSummary(): Promise<CoverageSummary | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("v_cockpit_data_coverage_summary")
      .select("*")
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0] as CoverageSummary;
  } catch {
    return null;
  }
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Converts a { label: count } object into a count-desc sorted LabelCount[]. */
function recordToLabelCounts(v: unknown): LabelCount[] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  const out: LabelCount[] = [];
  for (const [label, count] of Object.entries(v as Record<string, unknown>)) {
    if (typeof count === "number" && Number.isFinite(count)) {
      out.push({ label, count });
    }
  }
  return out.sort((a, b) => b.count - a.count);
}

/**
 * Data coverage / source quality from safe sources only:
 *  - head counts of v_cockpit_companies and v_cockpit_enrichment_jobs
 *  - the public-safe company-only aggregate v_public_insolvency_statistics
 * No raw/sensitive tables, no PII. Degrades to a placeholder on failure.
 */
async function getDataCoverage(): Promise<DataCoverage> {
  try {
    const supabase = await createClient();
    const [companiesRes, jobsRes, statsRes, summary] = await Promise.all([
      supabase
        .from("v_cockpit_companies")
        .select("entity_id", { count: "exact", head: true }),
      supabase
        .from("v_cockpit_enrichment_jobs")
        .select("job_id", { count: "exact", head: true }),
      supabase.from("v_public_insolvency_statistics").select("statistics").limit(1),
      getCoverageSummary(),
    ]);

    const companiesTotal = companiesRes.error ? null : (companiesRes.count ?? 0);
    const enrichmentJobsTotal = jobsRes.error ? null : (jobsRes.count ?? 0);

    let totalCompanyInsolvencies: number | null = null;
    let handelsregisterVerificationRate: number | null = null;
    let byPhase: LabelCount[] = [];
    let topBundeslaender: LabelCount[] = [];
    let generatedAt: string | null = null;

    if (!statsRes.error && statsRes.data?.[0]) {
      const s =
        ((statsRes.data[0] as { statistics?: Record<string, unknown> })
          .statistics ?? {}) as Record<string, unknown>;
      totalCompanyInsolvencies = numOrNull(s.total_company_insolvencies);
      handelsregisterVerificationRate = numOrNull(
        s.handelsregister_verification_rate,
      );
      byPhase = recordToLabelCounts(s.by_phase);
      topBundeslaender = recordToLabelCounts(s.by_bundesland).slice(0, 6);
      generatedAt = typeof s.generated_at === "string" ? s.generated_at : null;
    }

    const available =
      summary !== null ||
      companiesTotal !== null ||
      enrichmentJobsTotal !== null ||
      totalCompanyInsolvencies !== null;

    return {
      available,
      companiesTotal,
      enrichmentJobsTotal,
      totalCompanyInsolvencies,
      handelsregisterVerificationRate,
      byPhase,
      topBundeslaender,
      generatedAt,
      summary,
    };
  } catch {
    return EMPTY_COVERAGE;
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  const [watchlist, companyActivity, reviewQueue, coverage] = await Promise.all([
    getWatchlistKpis(),
    getCompanyActivity(),
    getReviewQueue(),
    getDataCoverage(),
  ]);
  return { watchlist, companyActivity, reviewQueue, coverage };
}
