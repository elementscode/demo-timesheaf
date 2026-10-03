import { Request, Response, redirect } from "@elements/app";
import { fulfillCheckout } from "#app/shared/checkout";

/** Stripe sends the payer back here. Record the payment, then show the invoice. */
export default async function route(req: Request, res: Response) {
  let token = await fulfillCheckout(String(req.query.session_id ?? ""));

  redirect(token ? `/pay/${token}` : "/");
}
