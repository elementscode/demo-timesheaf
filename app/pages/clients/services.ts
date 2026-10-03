import { ValidationError, sql } from "@elements/app";
import { requireAdmin } from "#app/shared/services/auth";

export interface ClientProject {
  id: string;
  name: string;
  color: string;
  rateCents: number;
  archived: boolean;
  unbilledSeconds: number;
  totalSeconds: number;
}

export interface ClientSummary {
  id: string;
  name: string;
  contactName: string;
  email: string;
  projects: ClientProject[];
}

export interface NewClient {
  name: string;
  contactName: string;
  email: string;
}

export interface NewProject {
  clientId: string;
  name: string;
  rate: string;
  color: string;
}

export function listClients(): ClientSummary[] {
  return sql<ClientSummary>(`
      select c.id, c.name, c.contactName, c.email,
             coalesce((
               select json_agg(json_build_object(
                        'id', p.id,
                        'name', p.name,
                        'color', p.color,
                        'rateCents', p.rateCents,
                        'archived', p.archived,
                        'unbilledSeconds', coalesce((select sum(seconds) from timeEntries e where e.projectId = p.id and e.invoiceId is null and e.billable), 0),
                        'totalSeconds', coalesce((select sum(seconds) from timeEntries e where e.projectId = p.id), 0)
                      ) order by p.archived, p.name)
                 from projects p
                where p.clientId = c.id
             ), '[]'::json) as projects
        from clients c
    order by c.name
  `).all();
}

/** "150", "$150", "150.50" to cents. */
export function parseRate(text: string): number {
  let cleaned = String(text).replace(/[$,\s]/g, "");

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new ValidationError("Enter an hourly rate like 150 or 142.50.");
  }

  return Math.round(Number(cleaned) * 100);
}

/** @rpc */
export function addClient(form: NewClient): ClientSummary[] {
  requireAdmin();

  let name = form.name.trim();
  let email = form.email.trim().toLowerCase();

  if (!name) {
    throw new ValidationError("Give the client a name.");
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ValidationError("Enter the email invoices should go to.");
  }

  sql(`insert into clients (name, contactName, email) values (${name}, ${form.contactName.trim()}, ${email})`);

  return listClients();
}

/** @rpc */
export function addProject(form: NewProject): ClientSummary[] {
  requireAdmin();

  let name = form.name.trim();

  if (!name) {
    throw new ValidationError("Give the project a name.");
  }

  let rateCents = parseRate(form.rate);
  let color = /^#[0-9a-f]{6}$/i.test(form.color) ? form.color : "#6b7280";

  sql(`
    insert into projects (clientId, name, rateCents, color)
         values (${form.clientId}, ${name}, ${rateCents}, ${color})
  `);

  return listClients();
}

/** @rpc */
export function setRate(projectId: string, rate: string): ClientSummary[] {
  requireAdmin();
  sql(`update projects set rateCents = ${parseRate(rate)} where id = ${projectId}`);

  return listClients();
}

/** @rpc */
export function setArchived(projectId: string, archived: boolean): ClientSummary[] {
  requireAdmin();
  sql(`update projects set archived = ${archived} where id = ${projectId}`);

  return listClients();
}
