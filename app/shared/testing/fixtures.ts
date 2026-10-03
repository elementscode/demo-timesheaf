import { session, sql } from "@elements/app";

export interface Fixture {
  adminId: string;
  memberId: string;
  otherId: string;
  clientId: string;
  projectId: string;
  memberEmail: string;
}

/** A tiny agency: an admin, two members, one client with a $120/h project. */
export function agency(): Fixture {
  let user = (email: string, name: string, role: string) => sql<{ id: string }>(`
    insert into users (email, name, role, passwordHash)
         values (${email}, ${name}, ${role}::userRole, crypt('timesheaf', genSalt('bf', 4)))
      returning id
  `).firstOrThrow().id;

  // Emails are unique, and test files run at once against one database, so
  // each call gets its own.
  let tag = crypto.randomUUID().slice(0, 8);
  let memberEmail = `mem-${tag}@test.test`;
  let adminId = user(`admin-${tag}@test.test`, "Ada Admin", "admin");
  let memberId = user(memberEmail, "Mel Member", "member");
  let otherId = user(`other-${tag}@test.test`, "Oli Other", "member");

  let clientId = sql<{ id: string }>(`
    insert into clients (name, contactName, email) values ('Acme', 'Wile', 'billing@acme.test') returning id
  `).firstOrThrow().id;

  let projectId = sql<{ id: string }>(`
    insert into projects (clientId, name, rateCents) values (${clientId}, 'Site', 12000) returning id
  `).firstOrThrow().id;

  return { adminId, memberId, otherId, clientId, projectId, memberEmail };
}

export function signInAs(id: string, role: "admin" | "member") {
  session.login({ userId: id, userName: role, role });
}

export function addEntry(userId: string, projectId: string, workDate: string, seconds: number, billable = true): string {
  return sql<{ id: string }>(`
    insert into timeEntries (userId, projectId, workDate, seconds, billable)
         values (${userId}, ${projectId}, ${workDate}::date, ${seconds}, ${billable})
      returning id
  `).firstOrThrow().id;
}

/** The message a call throws, or "" when it does not throw. */
export async function rejects(fn: () => unknown | Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (err: any) {
    return err.message;
  }

  return "";
}
