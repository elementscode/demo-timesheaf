/** Formatting shared by pages, emails and tests. Pure, so it runs anywhere. */

export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Hours with one decimal, the way a timesheet reads: 7.5 */
export function hours(seconds: number): string {
  let h = seconds / 3600;

  return h.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** A running clock: 1:07:42 */
export function clock(seconds: number): string {
  let s = Math.max(0, Math.floor(seconds));
  let h = Math.floor(s / 3600);
  let m = Math.floor((s % 3600) / 60);
  let sec = s % 60;

  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** 2h 30m, for a stopped entry. */
export function duration(seconds: number): string {
  let totalMinutes = Math.round(seconds / 60);
  let h = Math.floor(totalMinutes / 60);
  let m = totalMinutes % 60;

  if (h === 0) {
    return `${m}m`;
  }

  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Local calendar date as YYYY-MM-DD, never shifted through UTC. */
export function isoDate(date: Date): string {
  let y = date.getFullYear();
  let m = String(date.getMonth() + 1).padStart(2, "0");
  let d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

export function parseDate(iso: string): Date {
  let [y, m, d] = iso.split("-").map(Number);

  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  let date = parseDate(iso);
  date.setDate(date.getDate() + days);

  return isoDate(date);
}

/** The Monday on or before a date. */
export function weekStart(iso: string): string {
  let date = parseDate(iso);
  let offset = (date.getDay() + 6) % 7;

  return addDays(iso, -offset);
}

export function shortDate(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function longDate(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "Sep 1 – 21, 2026", "Sep 28 – Oct 4, 2026", "Dec 28, 2026 – Jan 3, 2027". */
export function dateRange(from: string, to: string): string {
  let a = parseDate(from);
  let b = parseDate(to);

  if (a.getFullYear() !== b.getFullYear()) {
    let long = { month: "short", day: "numeric", year: "numeric" } as const;

    return `${a.toLocaleDateString("en-US", long)} – ${b.toLocaleDateString("en-US", long)}`;
  }

  let end = a.getMonth() === b.getMonth() ? String(b.getDate()) : shortDate(to);

  return `${shortDate(from)} – ${end}, ${b.getFullYear()}`;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(parseDate(value).getTime());
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
}

export function invoiceNumber(n: number): string {
  return `TS-${String(1000 + n)}`;
}

/**
 * Reads a duration the way people type one: "1.5", "1:30", "90m", "2h 15m".
 * Returns seconds, or null when the text is not a duration.
 */
export function parseDuration(text: string): number | null {
  let value = text.trim().toLowerCase();

  if (!value) {
    return null;
  }

  let colon = /^(\d+):([0-5]?\d)$/.exec(value);

  if (colon) {
    return Number(colon[1]) * 3600 + Number(colon[2]) * 60;
  }

  let decimal = /^(\d+(?:\.\d+)?|\.\d+)\s*h?$/.exec(value);

  if (decimal) {
    return Math.round(Number(decimal[1]) * 3600);
  }

  let parts = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/.exec(value);

  if (parts && (parts[1] || parts[2])) {
    return Math.round(Number(parts[1] ?? 0) * 3600) + Number(parts[2] ?? 0) * 60;
  }

  return null;
}
