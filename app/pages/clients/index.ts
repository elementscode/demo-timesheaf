import { Request, Response } from "@elements/app";
import { requireAdmin } from "#app/shared/services/auth";
import { listClients } from "./services";
import html from "./template";

export default function route(req: Request, res: Response) {
  let me = requireAdmin();

  return new html({ me, clients: listClients() });
}
