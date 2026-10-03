import { Request, Response, NotFoundError, redirect } from "@elements/app";
import config from "#config";
import { invoiceByToken, invoiceLines } from "#app/shared/services/invoices";
import { testCheckout } from "#app/shared/stripe";
import html from "./template";

/** Stands in for Stripe's hosted checkout in development without a key. */
export default function route(req: Request, res: Response) {
  if (!testCheckout()) {
    throw new NotFoundError();
  }

  let invoice = invoiceByToken(req.params.token);

  if (invoice.status === "draft") {
    throw new NotFoundError("No such invoice.");
  }

  if (invoice.status === "paid") {
    redirect(`/pay/${invoice.token}`);
    return;
  }

  return new html({
    agency: config.agency.name,
    invoice,
    lines: invoiceLines(invoice.id),
  });
}
