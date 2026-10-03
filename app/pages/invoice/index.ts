import { Request, Response } from "@elements/app";
import config from "#config";
import { requireAdmin } from "#app/shared/services/auth";
import { invoiceById, invoiceLines, invoices } from "#app/shared/services/invoices";
import html from "./template";

export default function route(req: Request, res: Response) {
  let me = requireAdmin();
  let invoice = invoiceById(req.params.id);

  return new html({
    me,
    agency: config.agency.name,
    id: invoice.id,
    live: invoices.view({ token: invoice.token }),
    lines: invoiceLines(invoice.id),
  });
}
