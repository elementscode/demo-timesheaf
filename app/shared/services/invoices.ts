import { ForbiddenError, LiveTable, NotFoundError, ValidationError, email, getAppUrl, sql } from "@elements/app";
import config from "#config";
import { requireAdmin } from "#app/shared/services/auth";
import { addDays, isIsoDate, isoDate, invoiceNumber, money } from "#app/shared/format";
import InvoiceEmail from "#app/emails/invoice";

export type InvoiceStatus = "draft" | "sent" | "paid";

export interface Invoice {
  id: string;
  number: number;
  clientId: string;
  clientName: string;
  clientContact: string;
  clientEmail: string;
  periodStart: string;
  periodEnd: string;
  status: InvoiceStatus;
  totalCents: number;
  token: string;
  sentAt: Date | null;
  paidAt: Date | null;
  dueDate: string | null;
  createdAt: Date;
}

export interface InvoiceLine {
  id: string;
  description: string;
  clientName: string;
  seconds: number;
  rateCents: number;
  amountCents: number;
}

const INVOICE_SELECT = sql.raw(`
  select i.id,
         i.number,
         i.clientId,
         c.name as clientName,
         c.contactName as clientContact,
         c.email as clientEmail,
         i.periodStart::text as periodStart,
         i.periodEnd::text as periodEnd,
         i.status::text as status,
         i.totalCents,
         i.token,
         i.sentAt,
         i.paidAt,
         i.dueDate::text as dueDate,
         i.createdAt
    from invoices i
    join clients c on c.id = i.clientId
`);

/**
 * Invoices change from Stripe as well as from the app, so a trigger announces
 * every write (see the schema migration) and the channel is pinned to match
 * it. Writes go through the rpc below, never the view.
 */
export let invoices: LiveTable<Invoice> = new LiveTable<Invoice>({
  channel: (partition) => (partition ? `invoices:${partition}` : "invoices"),

  select: (partition) => {
    if (partition.token) {
      return sql<Invoice>(`${INVOICE_SELECT} where i.token = ${partition.token}`);
    }

    return sql<Invoice>(`${INVOICE_SELECT}`);
  },

  insert: () => {
    throw new ForbiddenError("Create invoices from the invoices page.");
  },

  update: () => {
    throw new ForbiddenError("Invoices change through their actions.");
  },

  delete: () => {
    throw new ForbiddenError("Invoices change through their actions.");
  },
});

export function invoiceById(id: string): Invoice {
  let invoice = sql<Invoice>(`${INVOICE_SELECT} where i.id = ${id}`).first();

  if (!invoice) {
    throw new NotFoundError("No such invoice.");
  }

  return invoice;
}

export function invoiceByToken(token: string): Invoice {
  let invoice = sql<Invoice>(`${INVOICE_SELECT} where i.token = ${token}`).first();

  if (!invoice) {
    throw new NotFoundError("No such invoice.");
  }

  return invoice;
}

export function invoiceLines(invoiceId: string): InvoiceLine[] {
  return sql<InvoiceLine>(`
      select l.id, l.description, c.name as clientName, l.seconds, l.rateCents, l.amountCents
        from invoiceLines l
        join projects p on p.id = l.projectId
        join clients c on c.id = p.clientId
       where l.invoiceId = ${invoiceId}
    order by l.amountCents desc
  `).all();
}

export function payUrl(invoice: Invoice): string {
  return `/pay/${invoice.token}`;
}

function checkRange(clientId: string, from: string, to: string) {
  if (!clientId) {
    throw new ValidationError("Pick a client.");
  }

  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    throw new ValidationError("Pick a date range.");
  }
}

/** What an invoice for this client and range would contain, without making it. @rpc */
export function previewInvoice(clientId: string, from: string, to: string): InvoiceLine[] {
  requireAdmin();
  checkRange(clientId, from, to);

  // The same grouping buildInvoice() writes, read without writing.
  return sql<InvoiceLine>(`
      select p.id, p.name as description, c.name as clientName,
             sum(e.seconds)::int as seconds,
             p.rateCents,
             round(sum(e.seconds) * p.rateCents / 3600.0)::int as amountCents
        from timeEntries e
        join projects p on p.id = e.projectId
        join clients c on c.id = p.clientId
       where p.clientId = ${clientId}
         and e.invoiceId is null
         and e.billable
         and e.startedAt is null
         and e.seconds > 0
         and e.workDate between ${from}::date and ${to}::date
    group by p.id, p.name, c.name, p.rateCents
    order by amountCents desc
  `).all();
}

/** Gathers the unbilled entries into a draft. Returns its id. @rpc */
export function createInvoice(clientId: string, from: string, to: string): string {
  requireAdmin();
  checkRange(clientId, from, to);

  let row = sql<{ id: string | null }>(`select buildInvoice(${clientId}, ${from}::date, ${to}::date) as id`).firstOrThrow();

  if (!row.id) {
    throw new ValidationError("There is no unbilled billable time for that client in that range.");
  }

  return row.id;
}

/** Marks a draft sent and emails the client a link to view and pay it. @rpc */
export function sendInvoice(id: string) {
  requireAdmin();

  let dueDate = addDays(isoDate(new Date()), 30);
  let sent = sql<{ id: string }>(`
    update invoices
       set status = 'sent', sentAt = now(), dueDate = ${dueDate}::date
     where id = ${id} and status = 'draft'
    returning id
  `).first();

  if (!sent) {
    throw new ValidationError("Only a draft can be sent.");
  }

  let invoice = invoiceById(id);

  emailInvoice(invoice);
}

/** Sends the invoice email again, for a client who lost it. @rpc */
export function resendInvoice(id: string) {
  requireAdmin();

  let invoice = invoiceById(id);

  if (invoice.status !== "sent") {
    throw new ValidationError("Only a sent, unpaid invoice can be resent.");
  }

  emailInvoice(invoice);
}

export function emailInvoice(invoice: Invoice) {
  email({
    to: invoice.clientEmail,
    subject: `Invoice ${invoiceNumber(invoice.number)} from ${config.agency.name}: ${money(invoice.totalCents)}`,
    body: new InvoiceEmail({
      agency: config.agency.name,
      invoice,
      lines: invoiceLines(invoice.id),
      url: `${getAppUrl()}${payUrl(invoice)}`,
    }),
  });
}

/** Deletes a draft; its entries go back to unbilled. @rpc */
export function deleteDraft(id: string) {
  requireAdmin();

  let deleted = sql<{ id: string }>(`delete from invoices where id = ${id} and status = 'draft' returning id`).first();

  if (!deleted) {
    throw new ValidationError("Only a draft can be deleted.");
  }
}
