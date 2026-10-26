![Time tracking with billable invoices, built by Claude Code on Elements: the invoices page with outstanding, collected and draft totals, six invoices in draft, sent and paid, and the new invoice form.](https://elements.dev/demos/01a0f3c4-aa66-7b70-bf8c-26ee1b0689c3/poster?v=6858c4b5237e)

# Time tracking with billable invoices, built by Claude Code on Elements

> Timesheaf is a full-stack app built with Claude Code on Elements.

Live timers, a week view of hours per project, billable reports by client and person, and invoices clients pay by card.

[Run this app on your machine](https://elements.dev/demos/01a0f3c4-aa66-7b70-bf8c-26ee1b0689c3). Use this demo as inspiration, or as the starting point for your own app. Your agent creates a new app with this one as the scaffold, and you prompt it to add whatever features you want.

## Payments

Clients pay invoices by card through Stripe Checkout. Without a key, payments
run through the built-in test checkout: the pay button opens a page in the app
that shows the invoice's lines and total and marks it paid, so the whole flow
works before Stripe exists.

For real Stripe Checkout, create a free sandbox at
dashboard.stripe.com/register, copy the secret key from Developers, API keys,
and set it in `config/env/development.env`:

```text
STRIPE_SECRET_KEY=
```

Pay with card 4242 4242 4242 4242, any future expiry and any CVC. Production
requires the key (the app will not start without it) and registers its own
Stripe webhook the first time a client starts a checkout.

## How it's built

Timesheaf needed timers the team can see running, a week of hours per person, invoices built from tracked time, and a way for clients to pay those invoices by card. Each of those is a part of Elements, so the agent spent its 25 minutes on the agency's workflow itself.

- **Live timers.** Time entries are a LiveTable opened per person for the week view and as one team-wide view of running timers. Stopping a timer folds the elapsed time in on the server's clock, and every teammate's screen shows it stop.

- **Invoices from time.** `@rpc` functions gather a client's unbilled entries into a draft and email the client a link to view and pay it. Invoices are a LiveTable, so the invoices list shows a payment the moment it lands.

- **Card payments.** Checkout is priced from the invoice's own stored lines. The return page and the webhook share one fulfillment function, so each payment is recorded once, whichever arrives first. Without a Stripe key, the pay button opens a test checkout inside the app that records the payment through that same function, and in production the app registers its own webhook the first time a client starts a checkout.

- **Reports from SQL.** The reports page totals billable hours by client and by person straight from the entries table.

- **Data from SQL files.** Three migrations define the schema and the invoice builder, and seed four teammates, four clients, a month of tracked weekdays, two timers running right now, and invoices in every status.

- **Sessions and roles.** Invoicing is for admins, and each time entry checks that it belongs to the signed-in person.

## Why Elements

Elements is an integrated full-stack app framework and a project server. The project server checks the agent's work as it builds: it type-checks the server and browser code, analyzes the program, applies migrations and runs the tests, then reports the results to the agent. A security mistake, such as calling a server-only function from the browser, is a compile error. The agent reads the report and fixes its own mistakes before it tells you a feature is done. The same checks run on every feature you ask for next.
