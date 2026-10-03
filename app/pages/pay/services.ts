import { NotFoundError, ValidationError } from "@elements/app";
import { invoiceByToken } from "#app/shared/services/invoices";
import { startCheckout } from "#app/shared/checkout";

/**
 * Starts checkout for a sent invoice: Stripe, or the test checkout without a
 * key. Anyone holding the link may pay
 * it; the amount always comes from the stored lines. @rpc
 */
export async function payInvoice(token: string): Promise<string> {
  let invoice = invoiceByToken(token);

  if (invoice.status === "draft") {
    throw new NotFoundError("No such invoice.");
  }

  if (invoice.status === "paid") {
    throw new ValidationError("This invoice is already paid.");
  }

  return await startCheckout(invoice);
}
