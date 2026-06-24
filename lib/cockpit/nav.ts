import {
  Bell,
  Calendar,
  CheckSquare,
  LayoutDashboard,
  Mail,
  Settings,
  ShieldCheck,
  Star,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface CockpitNavItem {
  /** German UI label (business UI is German). */
  label: string;
  href: string;
  icon: LucideIcon;
  /** Short English description for tooltips / accessibility. */
  description: string;
}

/**
 * The seven Cockpit modules. Lowercase routes; German labels.
 * All are guarded placeholders in this first PR.
 */
export const COCKPIT_NAV: CockpitNavItem[] = [
  {
    label: "Dashboard",
    href: "/cockpit/dashboard",
    icon: LayoutDashboard,
    description: "Executive overview and KPIs",
  },
  {
    label: "Watchlist",
    href: "/cockpit/watchlist",
    icon: Star,
    description: "Acquisition watchlist (companies & Nachlass)",
  },
  {
    label: "Aufgaben",
    href: "/cockpit/tasks",
    icon: CheckSquare,
    description: "Internal tasks & follow-ups",
  },
  {
    label: "Keyword-Alerts",
    href: "/cockpit/keyword-alerts",
    icon: Bell,
    description: "Keyword rules & announcement matches",
  },
  {
    label: "Operations",
    href: "/cockpit/operations",
    icon: Wrench,
    description: "Pipeline, jobs & system health",
  },
  {
    label: "Portal Guard",
    href: "/cockpit/portal-guard",
    icon: ShieldCheck,
    description: "Public portal health & privacy scans",
  },
  {
    label: "Kalender",
    href: "/cockpit/calendar",
    icon: Calendar,
    description: "Follow-ups, deadlines & events",
  },
  {
    label: "E-Mail-Entwürfe",
    href: "/cockpit/email-drafts",
    icon: Mail,
    description: "Outreach email drafts",
  },
  {
    label: "Einstellungen",
    href: "/cockpit/settings",
    icon: Settings,
    description: "Users, roles & authorizations",
  },
];
