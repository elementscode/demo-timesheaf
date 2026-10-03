import { Request, Response } from "@elements/app";
import { requireAdmin } from "#app/shared/services/auth";
import { isIsoDate, isoDate } from "#app/shared/format";
import { buildReport } from "./services";
import html from "./template";

export default function route(req: Request, res: Response) {
  let me = requireAdmin();
  let now = new Date();
  let from = isIsoDate(req.query.from) ? req.query.from : isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  let to = isIsoDate(req.query.to) ? req.query.to : isoDate(now);

  if (from > to) {
    [from, to] = [to, from];
  }

  return new html({ me, report: buildReport(from, to), today: isoDate(now) });
}
