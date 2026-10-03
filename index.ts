import { App, getEnv, redirect } from "@elements/app";
import config from "#config";
import home from "#app/pages/home";
import signin from "#app/pages/signin";
import week from "#app/pages/week";
import clients from "#app/pages/clients";
import reports from "#app/pages/reports";
import invoicesPage from "#app/pages/invoices";
import invoice from "#app/pages/invoice";
import pay from "#app/pages/pay";
import payReturn from "#app/pages/pay-return";
import stripeWebhook from "#app/pages/stripe-webhook";
import checkoutTest from "#app/pages/checkout-test";
import { stripeConfigured } from "#app/shared/stripe";
import notFound from "#app/pages/errors/not-found";
import unhandled from "#app/pages/errors/unhandled";

const app = new App();

app.route("/", home);
app.route("/signin", signin);
app.route("/week", week);
app.route("/clients", clients);
app.route("/reports", reports);
app.route("/invoices", invoicesPage);
app.route("/invoices/:id", invoice);
app.route("/pay/return", payReturn);
app.route("/pay/:token", pay);
app.route("/checkout/test/:token", checkoutTest);
app.route({ method: "post", path: "/stripe/webhook", handler: stripeWebhook });

app.error((req, res, err) => {
  switch (err.statusCode) {
    case 401:
      return redirect("/signin");

    case 404:
      return notFound(req, res, err);

    default:
      return unhandled(req, res, err);
  }
});

if (getEnv() === "production" && !stripeConfigured()) {
  throw new Error("STRIPE_SECRET_KEY is required in production.");
}

app.start(config);
