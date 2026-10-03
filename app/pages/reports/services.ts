import { sql } from "@elements/app";

export interface ReportRow {
  id: string;
  name: string;
  detail: string;
  color: string;
  seconds: number;
  billableSeconds: number;
  amountCents: number;
}

export interface Report {
  from: string;
  to: string;
  totals: ReportRow;
  unbilledCents: number;
  clients: ReportRow[];
  projects: ReportRow[];
  people: ReportRow[];
}

/**
 * Hours and billable amount in a date range, grouped three ways. Amount is
 * billable time at the project's current rate, invoiced or not.
 */
export function buildReport(from: string, to: string): Report {
  let grouped = (key: string, name: string, detail: string, color: string) => sql<ReportRow>(`
      select ${sql.raw(key)} as id,
             ${sql.raw(name)} as name,
             ${sql.raw(detail)} as detail,
             ${sql.raw(color)} as color,
             sum(e.seconds)::int as seconds,
             (sum(e.seconds) filter (where e.billable))::int as billableSeconds,
             coalesce(round(sum(e.seconds * p.rateCents / 3600.0) filter (where e.billable)), 0)::int as amountCents
        from timeEntries e
        join projects p on p.id = e.projectId
        join clients c on c.id = p.clientId
        join users u on u.id = e.userId
       where e.workDate between ${from}::date and ${to}::date
         and e.startedAt is null
    group by 1, 2, 3, 4
    order by amountCents desc, seconds desc
  `).all().map((row) => ({ ...row, billableSeconds: row.billableSeconds ?? 0 }));

  let clients = grouped("c.id::text", "c.name", "''", "''");
  let projects = grouped("p.id::text", "p.name", "c.name", "p.color");
  let people = grouped("u.id::text", "u.name", "u.role::text", "''");

  let sum = (field: "seconds" | "billableSeconds" | "amountCents") => clients.reduce((total, row) => total + row[field], 0);

  let unbilled = sql<{ cents: number }>(`
    select coalesce(round(sum(e.seconds * p.rateCents / 3600.0)), 0)::int as cents
      from timeEntries e
      join projects p on p.id = e.projectId
     where e.workDate between ${from}::date and ${to}::date
       and e.billable
       and e.invoiceId is null
       and e.startedAt is null
  `).firstOrThrow();

  return {
    from,
    to,
    totals: { id: "total", name: "Total", detail: "", color: "", seconds: sum("seconds"), billableSeconds: sum("billableSeconds"), amountCents: sum("amountCents") },
    unbilledCents: unbilled.cents,
    clients,
    projects,
    people,
  };
}
