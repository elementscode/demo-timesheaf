import { test, equal, sql } from "@elements/app";
import { payInvoice } from "./services";
import { payTestInvoice } from "#app/pages/checkout-test/services";
import { recordPayment } from "#app/shared/checkout";
import { testCheckout } from "#app/shared/stripe";
import { createInvoice, invoiceById, sendInvoice } from "#app/shared/services/invoices";
import { agency, addEntry, rejects, signInAs } from "#app/shared/testing/fixtures";

function tokenOf(id: string): string {
  return sql<{ token: string }>(`select token from invoices where id = ${id}`).firstOrThrow().token;
}

test("pay page", () => {
  test("a draft or paid invoice cannot be paid", async () => {
    let f = agency();
    addEntry(f.memberId, f.projectId, "2026-09-02", 3600);
    signInAs(f.adminId, "admin");

    let id = createInvoice(f.clientId, "2026-09-01", "2026-09-30");
    let token = tokenOf(id);

    equal(await rejects(() => payInvoice(token)), "No such invoice.");

    sql(`update invoices set status = 'paid' where id = ${id}`);
    equal(await rejects(() => payInvoice(token)), "This invoice is already paid.");

    if (testCheckout()) {
      equal(await rejects(() => payTestInvoice(token)), "This invoice is already paid.");
    } else {
      equal(await rejects(() => payTestInvoice(token)), "The test checkout is off.");
    }
  });

  test("a sent invoice is paid through the test checkout", async () => {
    // With a Stripe key in development.env, payment goes to Stripe instead,
    // and that is checked by hand with a sandbox card.
    if (!testCheckout()) {
      return;
    }

    let f = agency();
    addEntry(f.memberId, f.projectId, "2026-09-02", 5400);
    signInAs(f.adminId, "admin");

    let id = createInvoice(f.clientId, "2026-09-01", "2026-09-30");
    sendInvoice(id);
    let token = tokenOf(id);

    // Without a Stripe key the pay button goes to the in-app test checkout.
    equal(await payInvoice(token), `/checkout/test/${token}`);

    payTestInvoice(token);

    let invoice = invoiceById(id);
    equal(invoice.status, "paid");
    equal(invoice.paidAt !== null, true);

    let payments = sql<{ stripeSessionId: string; amountTotal: number; currency: string }>(`
      select stripeSessionId, amountTotal, currency from payments where invoiceId = ${id}
    `).all();

    equal(payments.length, 1);
    equal(payments[0].stripeSessionId, `test_${id}`);
    equal(payments[0].amountTotal, 18000);
    equal(payments[0].currency, "usd");
  });

  test("recording the same payment twice records it once", () => {
    let f = agency();
    addEntry(f.memberId, f.projectId, "2026-09-02", 3600);
    signInAs(f.adminId, "admin");

    let id = createInvoice(f.clientId, "2026-09-01", "2026-09-30");
    sendInvoice(id);

    recordPayment("cs_return_and_webhook", id, 12000, "usd");
    let paidAt = invoiceById(id).paidAt;
    recordPayment("cs_return_and_webhook", id, 12000, "usd");

    equal(sql<{ n: number }>(`select count(*)::int as n from payments where invoiceId = ${id}`).firstOrThrow().n, 1);
    equal(invoiceById(id).paidAt, paidAt);
  });
});
