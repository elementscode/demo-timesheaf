import { ForbiddenError, NotFoundError, ValidationError } from "@elements/app";
import { recordPayment } from "#app/shared/checkout";
import { invoiceByToken } from "#app/shared/services/invoices";
import { testCheckout } from "#app/shared/stripe";

/**
 * Pays a sent invoice through the test checkout, in development without a
 * Stripe key. Records it through the same function a Stripe payment uses. @rpc
 */
export function payTestInvoice(token: string) {
  if (!testCheckout()) {
    throw new ForbiddenError("The test checkout is off.");
  }

  let invoice = invoiceByToken(token);

  if (invoice.status === "draft") {
    throw new NotFoundError("No such invoice.");
  }

  if (invoice.status === "paid") {
    throw new ValidationError("This invoice is already paid.");
  }

  recordPayment(`test_${invoice.id}`, invoice.id, invoice.totalCents, "usd");
}
