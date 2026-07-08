/**
 * CEO Dashboard — period helpers. Every fact table stores (period_start,
 * granularity); these helpers normalise any date to its period bucket
 * so daily/weekly/monthly/quarterly/yearly views all address the same rows.
 */

export type Granularity =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export const GRANULARITIES: Granularity[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  daily: "Day",
  weekly: "Week",
  monthly: "Month",
  quarterly: "Quarter",
  yearly: "Year",
};

/** YYYY-MM-DD in local time (dates in this module are calendar dates, not instants). */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateString(s: string): Date {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Normalise a date to the start of its period bucket. Weeks start Monday. */
export function periodStartFor(date: Date, g: Granularity): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  switch (g) {
    case "daily":
      return toDateString(d);
    case "weekly": {
      const dow = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
      d.setDate(d.getDate() - dow);
      return toDateString(d);
    }
    case "monthly":
      return toDateString(new Date(d.getFullYear(), d.getMonth(), 1));
    case "quarterly":
      return toDateString(
        new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1),
      );
    case "yearly":
      return toDateString(new Date(d.getFullYear(), 0, 1));
  }
}

/** Inclusive start, exclusive end of the period containing period_start. */
export function periodRange(
  periodStart: string,
  g: Granularity,
): { start: string; end: string } {
  const s = parseDateString(periodStart);
  const e = new Date(s);
  switch (g) {
    case "daily":
      e.setDate(e.getDate() + 1);
      break;
    case "weekly":
      e.setDate(e.getDate() + 7);
      break;
    case "monthly":
      e.setMonth(e.getMonth() + 1);
      break;
    case "quarterly":
      e.setMonth(e.getMonth() + 3);
      break;
    case "yearly":
      e.setFullYear(e.getFullYear() + 1);
      break;
  }
  return { start: toDateString(s), end: toDateString(e) };
}

export function shiftPeriod(
  periodStart: string,
  g: Granularity,
  steps: number,
): string {
  const d = parseDateString(periodStart);
  switch (g) {
    case "daily":
      d.setDate(d.getDate() + steps);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7 * steps);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + steps);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3 * steps);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + steps);
      break;
  }
  return periodStartFor(d, g);
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function periodLabel(periodStart: string, g: Granularity): string {
  const d = parseDateString(periodStart);
  switch (g) {
    case "daily":
      return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    case "weekly":
      return `Week of ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    case "monthly":
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    case "quarterly":
      return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    case "yearly":
      return String(d.getFullYear());
  }
}
