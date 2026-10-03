import { Request, Response, sql } from "@elements/app";
import { requireAdmin } from "#app/shared/services/auth";
import { invoices } from "#app/shared/services/invoices";
import { isoDate } from "#app/shared/format";
import html, { ClientUnbilled } from "./template";

export default function route(req: Request, res: Response) {
  let me = requireAdmin();
  let now = new Date();

  let clients = sql<ClientUnbilled>(`
      select c.id, c.name,
             coalesce(round(sum(e.seconds * p.rateCents / 3600.0)), 0)::int as unbilledCents,
             min(e.workDate)::text as firstDate,
             max(e.workDate)::text as lastDate
        from clients c
   left join projects p on p.clientId = c.id
   left join timeEntries e on e.projectId = p.id
         and e.invoiceId is null
         and e.billable
         and e.startedAt is null
         and e.seconds > 0
    group by c.id, c.name
    order by c.name
  `).all();

  let first = clients.find((c) => c.unbilledCents > 0) ?? clients[0];

  return new html({
    me,
    clients,
    invoices: invoices.view(),
    defaults: {
      clientId: first?.id ?? "",
      from: first?.firstDate ?? isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: isoDate(now),
    },
  });
}
