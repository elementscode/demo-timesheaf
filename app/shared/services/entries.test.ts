import { test, equal, assert, fatalf, sql } from "@elements/app";
import { timeEntries } from "#app/shared/services/entries";
import { agency, addEntry, rejects, signInAs } from "#app/shared/testing/fixtures";

test("time entries", () => {
  test("a member tracks time by hand", () => {
    let f = agency();
    signInAs(f.memberId, "member");

    let view = timeEntries.view({ userId: f.memberId });
    let row = view.insert({ projectId: f.projectId, workDate: "2026-09-29", seconds: 5400, note: " Wireframes ", billable: true });

    equal(row.seconds, 5400);
    equal(row.note, "Wireframes");
    equal(row.projectName, "Site");
    equal(row.clientName, "Acme");
  });

  test("a timer starts, and stopping folds in the elapsed time", async () => {
    let f = agency();
    signInAs(f.memberId, "member");

    let view = timeEntries.view({ userId: f.memberId });
    let running = view.insert({ projectId: f.projectId, workDate: "2026-09-30", startedAt: new Date(), note: "" });
    assert(running.startedAt != null, "timer should be running");

    let second = await rejects(() => view.insert({ projectId: f.projectId, workDate: "2026-09-30", startedAt: new Date(), note: "" }));
    equal(second, "Stop the running timer first.");

    sql(`update timeEntries set startedAt = now() - interval '25 minutes' where id = ${running.id}`);
    let stopped = view.update({ ...running, startedAt: null, note: "Call" });

    equal(stopped.startedAt, null);
    assert(stopped.seconds >= 1500 && stopped.seconds < 1510, `expected about 25 minutes, got ${stopped.seconds}`);
    equal(stopped.note, "Call");
  });

  test("nobody tracks time for someone else", async () => {
    let f = agency();
    signInAs(f.memberId, "member");

    let theirs = timeEntries.view({ userId: f.otherId });
    let message = await rejects(() => theirs.insert({ projectId: f.projectId, workDate: "2026-09-29", seconds: 600 }));
    equal(message, "You can only track your own time.");

    let id = addEntry(f.otherId, f.projectId, "2026-09-29", 600);
    let row = sql<any>(`select * from timeEntries where id = ${id}`).firstOrThrow();
    message = await rejects(() => theirs.delete({ ...row, workDate: "2026-09-29" }));
    equal(message, "That entry belongs to someone else.");
  });

  test("invoiced time is locked", async () => {
    let f = agency();
    let id = addEntry(f.memberId, f.projectId, "2026-09-10", 3600);
    sql(`select buildInvoice(${f.clientId}, '2026-09-01', '2026-09-30')`);

    signInAs(f.memberId, "member");
    let view = timeEntries.view({ userId: f.memberId });
    let row = view.find((e) => e.id === id);

    if (!row) {
      fatalf("entry %v not in view", id);
      return;
    }

    let message = await rejects(() => view.delete(row!));
    equal(message, "That time is on an invoice and can no longer change.");
  });
});
