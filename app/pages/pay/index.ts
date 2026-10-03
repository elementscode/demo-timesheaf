import { Request, Response, NotFoundError } from "@elements/app";
import config from "#config";
import { invoiceByToken, invoiceLines, invoices } from "#app/shared/services/invoices";
import { testCheckout } from "#app/shared/stripe";
import html from "./template";

export default function route(req: Request, res: Response) {
  let invoice = invoiceByToken(req.params.token);

  if (invoice.status === "draft") {
    throw new NotFoundError("No such invoice.");
  }

  return new html({
    agency: config.agency.name,
    token: invoice.token,
    live: invoices.view({ token: invoice.token }),
    lines: invoiceLines(invoice.id),
    testMode: testCheckout(),
    cancelled: req.query.cancelled === "1",
  });
}
