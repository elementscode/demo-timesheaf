-- add invoice builder

-- Gathers a client's unbilled, billable, stopped entries in a date range into
-- a draft invoice: one line per project, the entries stamped with the invoice
-- so they are never billed twice. The app and the seed data both call it, so
-- there is one definition of what an invoice contains. Returns null when
-- there is nothing to bill.
create or replace function buildInvoice(forClient uuid, fromDate date, toDate date)
returns uuid
language plpgsql
as $$
declare
  newId uuid;
begin
  if not exists (
    select 1
      from timeEntries e
      join projects p on p.id = e.projectId
     where p.clientId = forClient
       and e.invoiceId is null
       and e.billable
       and e.startedAt is null
       and e.seconds > 0
       and e.workDate between fromDate and toDate
  ) then
    return null;
  end if;

  insert into invoices (clientId, periodStart, periodEnd)
       values (forClient, fromDate, toDate)
    returning id into newId;

  update timeEntries e
     set invoiceId = newId
    from projects p
   where p.id = e.projectId
     and p.clientId = forClient
     and e.invoiceId is null
     and e.billable
     and e.startedAt is null
     and e.seconds > 0
     and e.workDate between fromDate and toDate;

  insert into invoiceLines (invoiceId, projectId, description, seconds, rateCents, amountCents)
       select newId,
              p.id,
              p.name,
              sum(e.seconds)::int,
              p.rateCents,
              round(sum(e.seconds) * p.rateCents / 3600.0)::int
         from timeEntries e
         join projects p on p.id = e.projectId
        where e.invoiceId = newId
     group by p.id, p.name, p.rateCents;

  update invoices
     set totalCents = (select coalesce(sum(amountCents), 0) from invoiceLines where invoiceId = newId)
   where id = newId;

  return newId;
end;
$$;
