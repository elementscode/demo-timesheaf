import { getAppUrl, sql, tx } from "@elements/app";
import { stripe, testCheckout } from "#app/shared/stripe";
import { ensureWebhook } from "#app/shared/stripe-webhook";
import { Invoice, invoiceLines, payUrl } from "#app/shared/services/invoices";
import { invoiceNumber, hours } from "#app/shared/format";

/**
 * Returns the url to send the payer to: Stripe Checkout, priced from the
 * invoice's stored lines, or the in-app test checkout when there is no key.
 */
export async function startCheckout(invoice: Invoice): Promise<string> {
  if (testCheckout()) {
    return `/checkout/test/${invoice.token}`;
  }

  await ensureWebhook();

  let lines = invoiceLines(invoice.id);

  let checkout = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: invoice.clientEmail,
    client_reference_id: invoice.id,
    line_items: lines.map((line) => ({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: line.amountCents,
        product_data: {
          name: `${line.description} (${hours(line.seconds)} h)`,
          description: `Invoice ${invoiceNumber(invoice.number)}`,
        },
      },
    })),
    success_url: `${getAppUrl()}/pay/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getAppUrl()}${payUrl(invoice)}?cancelled=1`,
  });

  return checkout.url!;
}

/**
 * Records a paid session. Idempotent: the return page and the webhook both
 * call it, in either order, any number of times. Returns the invoice's token,
 * so the return page can show it, or null for a session that is not ours.
 */
export async function fulfillCheckout(sessionId: string): Promise<string | null> {
  let checkout = await stripe().checkout.sessions.retrieve(sessionId);
  let invoiceId = checkout.client_reference_id;

  if (!invoiceId) {
    return null;
  }

  let invoice = sql<{ token: string }>(`select token from invoices where id = ${invoiceId}`).first();

  if (!invoice) {
    return null;
  }

  if (checkout.payment_status === "paid") {
    recordPayment(checkout.id, invoiceId, checkout.amount_total!, checkout.currency!);
  }

  return invoice.token;
}

/** The one place a payment is recorded, from Stripe or the test checkout. */
export function recordPayment(sessionId: string, invoiceId: string, amountTotal: number, currency: string) {
  tx(() => {
    sql(`
      insert into payments (stripeSessionId, invoiceId, amountTotal, currency)
           values (${sessionId}, ${invoiceId}, ${amountTotal}, ${currency})
      on conflict (stripeSessionId) do nothing
    `);

    sql(`
      update invoices
         set status = 'paid', paidAt = now()
       where id = ${invoiceId}
         and status = 'sent'
    `);
  });
}
