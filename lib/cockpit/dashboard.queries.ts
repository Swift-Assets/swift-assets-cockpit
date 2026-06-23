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

export interface DashboardData {
  watchlist: WatchlistKpis;
  companyActivity: CompanyActivityKpis;
  reviewQueue: CountKpi;
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

export async function getDashboardData(): Promise<DashboardData> {
  const [watchlist, companyActivity, reviewQueue] = await Promise.all([
    getWatchlistKpis(),
    getCompanyActivity(),
    getReviewQueue(),
  ]);
  return { watchlist, companyActivity, reviewQueue };
}
