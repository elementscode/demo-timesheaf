![Timesheaf, a time tracking and invoicing app built with Elements: the invoices page with outstanding, collected and draft totals, six invoices in draft, sent and paid, and the new invoice form.](https://elements.dev/demos/01a0f3c4-aa66-7b70-bf8c-26ee1b0689c3/poster?v=6858c4b5237e)

# Timesheaf

> A demo app built with [Elements](https://elements.dev).

Live timers, a week view of hours per project, billable reports by client and person, and invoices clients pay by card.

**Demo:** [Timesheaf](https://elements.dev/demos/01a0f3c4-aa66-7b70-bf8c-26ee1b0689c3)

## Agent specs

- **Agent:** Claude Code, Opus 5.5 Medium
- **Time:** 25 min
- **Cost:** $8.73 at API rates, September 2026

## Get started

```bash
elements create timesheaf -scaffold=elementscode/demo-timesheaf
```

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

### What Elements gave the app

- **Live timers.** Time entries are a LiveTable opened per person for the week view and as one team-wide view of running timers. Stopping a timer folds the elapsed time in on the server's clock, and every teammate's screen shows it stop.

- **Invoices from time.** `@rpc` functions gather a client's unbilled entries into a draft and email the client a link to view and pay it. Invoices are a LiveTable, so the invoices list shows a payment the moment it lands.

- **Card payments.** Checkout is priced from the invoice's own stored lines. The return page and the webhook share one fulfillment function, so each payment is recorded once, whichever arrives first. Without a Stripe key, the pay button opens a test checkout inside the app that records the payment through that same function, and in production the app registers its own webhook the first time a client starts a checkout.

- **Reports from SQL.** The reports page totals billable hours by client and by person straight from the entries table.

- **Data from SQL files.** Three migrations define the schema and the invoice builder, and seed four teammates, four clients, a month of tracked weekdays, two timers running right now, and invoices in every status.

- **Sessions and roles.** Invoicing is for admins, and each time entry checks that it belongs to the signed-in person.

### What the project server gave the agent

The project server runs alongside the agent and answers as soon as a file is saved: it type-checks the templates, TypeScript and SQL, applies migrations and reruns the tests, so every question came back right away and the agent kept building.

### What shipped

The app type-checks with zero errors and all 21 tests pass. Every page works on desktop and phone, and live updates arrive across tabs, such as a teammate's timer starting or stopping. A real sandbox payment went through Stripe end to end.

## Seed data and demo accounts

The seed loads in every environment: four clients (Fernwood Coffee, Northwind
Outfitters, Harbor Health, Lumen Books), six projects with hourly rates, the
last 30 days of time entries, two timers running, and six invoices: three
paid, two sent and one draft. Lumen Books has no invoice yet, so you can make
one. The dates follow the day you run it.

Every account's password is `timesheaf`, and the sign-in page lists them.

| Email                | Role        |
| -------------------- | ----------- |
| maya@timesheaf.test  | admin       |
| jonah@timesheaf.test | team member |
| priya@timesheaf.test | team member |
| theo@timesheaf.test  | team member |

In development, invoice emails are written to `.elements/logs/program.log`
instead of being sent.

**Demo:** [Timesheaf](https://elements.dev/demos/01a0f3c4-aa66-7b70-bf8c-26ee1b0689c3)

## License

MIT. See [LICENSE](LICENSE).
