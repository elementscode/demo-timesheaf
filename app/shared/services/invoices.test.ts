import { test, equal, sql } from "@elements/app";
import { createInvoice, deleteDraft, invoiceById, invoiceLines, previewInvoice, sendInvoice } from "#app/shared/services/invoices";
import { agency, addEntry, rejects, signInAs } from "#app/shared/testing/fixtures";

test("invoices", () => {
  test("gathers only unbilled, billable, stopped time in range", async () => {
    let f = agency();
    addEntry(f.memberId, f.projectId, "2026-09-02", 3600);
    addEntry(f.otherId, f.projectId, "2026-09-03", 1800);
    addEntry(f.memberId, f.projectId, "2026-09-04", 7200, false);
    addEntry(f.memberId, f.projectId, "2026-10-02", 3600);
    signInAs(f.adminId, "admin");

    let preview = previewInvoice(f.clientId, "2026-09-01", "2026-09-30");
    equal(preview.length, 1);
    equal(preview[0].seconds, 5400);
    equal(preview[0].amountCents, 18000);

    let id = createInvoice(f.clientId, "2026-09-01", "2026-09-30");
    let invoice = invoiceById(id);
    equal(invoice.status, "draft");
    equal(invoice.totalCents, 18000);
    equal(invoiceLines(id).length, 1);

    let again = await rejects(() => createInvoice(f.clientId, "2026-09-01", "2026-09-30"));
    equal(again, "There is no unbilled billable time for that client in that range.");
  });

  test("sending marks it sent with a due date", async () => {
    let f = agency();
    addEntry(f.memberId, f.projectId, "2026-09-02", 3600);
    signInAs(f.adminId, "admin");

    let id = createInvoice(f.clientId, "2026-09-01", "2026-09-30");
    sendInvoice(id);

    let invoice = invoiceById(id);
    equal(invoice.status, "sent");
    equal(invoice.dueDate !== null, true);
    equal(await rejects(() => sendInvoice(id)), "Only a draft can be sent.");
    equal(await rejects(() => deleteDraft(id)), "Only a draft can be deleted.");
  });

  test("deleting a draft returns its time to unbilled", () => {
    let f = agency();
    let entry = addEntry(f.memberId, f.projectId, "2026-09-02", 3600);
    signInAs(f.adminId, "admin");

    let id = createInvoice(f.clientId, "2026-09-01", "2026-09-30");
    deleteDraft(id);

    let row = sql<{ invoiceId: string | null }>(`select invoiceId from timeEntries where id = ${entry}`).firstOrThrow();
    equal(row.invoiceId, null);
  });

  test("only an admin can bill", async () => {
    let f = agency();
    addEntry(f.memberId, f.projectId, "2026-09-02", 3600);
    signInAs(f.memberId, "member");

    equal(await rejects(() => createInvoice(f.clientId, "2026-09-01", "2026-09-30")), "Only an admin can do that.");
  });
});
