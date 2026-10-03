import { ForbiddenError, LiveTable, NotFoundError, ValidationError, sql } from "@elements/app";
import { currentUser } from "#app/shared/services/auth";
import { isIsoDate } from "#app/shared/format";

export interface Entry {
  id: string;
  userId: string;
  projectId: string;
  workDate: string;
  seconds: number;
  startedAt: Date | null;
  note: string;
  billable: boolean;
  invoiceId: string | null;
  createdAt: Date;
  projectName: string;
  projectColor: string;
  clientName: string;
  userName: string;
}

export interface ProjectOption {
  id: string;
  name: string;
  color: string;
  clientName: string;
  rateCents: number;
}

/** A day, the longest single block of time one entry can hold. */
export const MAX_ENTRY_SECONDS = 24 * 3600;

const ENTRY_SELECT = sql.raw(`
  select e.id,
         e.userId,
         e.projectId,
         e.workDate::text as workDate,
         e.seconds,
         e.startedAt,
         e.note,
         e.billable,
         e.invoiceId,
         e.createdAt,
         p.name as projectName,
         p.color as projectColor,
         c.name as clientName,
         u.name as userName
    from timeEntries e
    join projects p on p.id = e.projectId
    join clients c on c.id = p.clientId
    join users u on u.id = e.userId
`);

export function entryRow(id: string): Entry {
  return sql<Entry>(`${ENTRY_SELECT} where e.id = ${id}`).firstOrThrow("entry not found");
}

export function projectOptions(): ProjectOption[] {
  return sql<ProjectOption>(`
      select p.id, p.name, p.color, p.rateCents, c.name as clientName
        from projects p
        join clients c on c.id = p.clientId
       where not p.archived
    order by c.name, p.name
  `).all();
}

function checkProject(projectId: unknown) {
  if (typeof projectId !== "string" || !projectId) {
    throw new ValidationError("Pick a project.");
  }

  let found = !sql(`select 1 from projects where id = ${projectId} and not archived`).empty();

  if (!found) {
    throw new ValidationError("That project is not open for time.");
  }
}

function checkSeconds(seconds: unknown) {
  if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds < 0 || seconds > MAX_ENTRY_SECONDS) {
    throw new ValidationError("Enter a duration between 0 and 24 hours.");
  }
}

/** The row as stored, for the ownership and invoice checks. */
function storedEntry(id: string) {
  let row = sql<{ userId: string; seconds: number; startedAt: Date | null; invoiceId: string | null }>(`
    select userId, seconds, startedAt, invoiceId from timeEntries where id = ${id}
  `).first();

  if (!row) {
    throw new NotFoundError("That entry no longer exists.");
  }

  let me = currentUser();

  if (row.userId !== me.id && me.role !== "admin") {
    throw new ForbiddenError("That entry belongs to someone else.");
  }

  if (row.invoiceId) {
    throw new ForbiddenError("That time is on an invoice and can no longer change.");
  }

  return row;
}

/**
 * Every time entry, opened per person with `view({ userId })`. The whole-table
 * view is the team's running timers: its select reads only those, and every
 * write still reaches it, so the template keeps the rule with a filter.
 */
export let timeEntries: LiveTable<Entry> = new LiveTable<Entry>({
  select: (partition) => {
    if (partition.userId) {
      return sql<Entry>(`${ENTRY_SELECT} where e.userId = ${partition.userId}`);
    }

    return sql<Entry>(`${ENTRY_SELECT} where e.startedAt is not null`);
  },

  insert: (item) => {
    let me = currentUser();

    if (item.userId !== me.id) {
      throw new ForbiddenError("You can only track your own time.");
    }

    checkProject(item.projectId);

    if (!isIsoDate(item.workDate)) {
      throw new ValidationError("Pick a date.");
    }

    let running = item.startedAt != null;

    if (running) {
      let busy = !sql(`select 1 from timeEntries where userId = ${me.id} and startedAt is not null`).empty();

      if (busy) {
        throw new ValidationError("Stop the running timer first.");
      }
    } else {
      checkSeconds(item.seconds);

      if (!item.seconds) {
        throw new ValidationError("Enter how long you worked.");
      }
    }

    sql(`
      insert into timeEntries (id, userId, projectId, workDate, seconds, startedAt, note, billable)
           values (${item.id}, ${me.id}, ${item.projectId}, ${item.workDate}::date,
                   ${running ? 0 : item.seconds}, ${running ? sql.raw(`now()`) : null},
                   ${(item.note ?? "").trim()}, ${item.billable ?? true})
    `);

    return entryRow(item.id!);
  },

  update: (item) => {
    let stored = storedEntry(item.id);

    // Stopping folds the elapsed time in on the server's clock, whatever the
    // browser computed for its optimistic row.
    if (stored.startedAt && !item.startedAt) {
      sql(`
        update timeEntries
           set seconds = least(${MAX_ENTRY_SECONDS}, seconds + extract(epoch from now() - startedAt)::int),
               startedAt = null,
               note = ${item.note.trim()}
         where id = ${item.id}
      `);

      return entryRow(item.id);
    }

    checkProject(item.projectId);

    if (!isIsoDate(item.workDate)) {
      throw new ValidationError("Pick a date.");
    }

    if (!stored.startedAt) {
      checkSeconds(item.seconds);
    }

    sql(`
      update timeEntries
         set projectId = ${item.projectId},
             workDate = ${item.workDate}::date,
             seconds = ${stored.startedAt ? stored.seconds : item.seconds},
             note = ${item.note.trim()},
             billable = ${item.billable}
       where id = ${item.id}
    `);

    return entryRow(item.id);
  },

  delete: (item) => {
    storedEntry(item.id);
    sql(`delete from timeEntries where id = ${item.id}`);
  },
});
