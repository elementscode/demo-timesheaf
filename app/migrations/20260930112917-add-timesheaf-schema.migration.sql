-- add timesheaf schema

-- Auto-update updatedAt on row changes.
create or replace function touchUpdatedAt()
returns trigger
language plpgsql
as $$
begin
  new.updatedAt = now();
  return new;
end;
$$;

create type userRole as enum ('member', 'admin');

create type invoiceStatus as enum ('draft', 'sent', 'paid');

create table users (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  email text not null unique,
  name text not null,
  passwordHash text not null,
  role userRole not null default 'member'
);

create trigger usersTouchUpdatedAt
  before update on users
  for each row execute function touchUpdatedAt();

create table clients (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  name text not null,
  contactName text not null default '',
  email text not null
);

create trigger clientsTouchUpdatedAt
  before update on clients
  for each row execute function touchUpdatedAt();

-- Rates and amounts are integer cents so sums never drift.
create table projects (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  clientId uuid not null references clients (id) on delete cascade,
  name text not null,
  rateCents integer not null check (rateCents >= 0),
  color text not null default '#6b7280',
  archived boolean not null default false
);

create index projectsClientId on projects (clientId);

create trigger projectsTouchUpdatedAt
  before update on projects
  for each row execute function touchUpdatedAt();

-- A token in the pay link, so the client can open the invoice without an
-- account and nobody can walk invoice ids.
create table invoices (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  number serial not null unique,
  clientId uuid not null references clients (id),
  periodStart date not null,
  periodEnd date not null,
  status invoiceStatus not null default 'draft',
  totalCents integer not null default 0,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  sentAt timestamptz,
  paidAt timestamptz,
  dueDate date
);

create index invoicesClientId on invoices (clientId);

create trigger invoicesTouchUpdatedAt
  before update on invoices
  for each row execute function touchUpdatedAt();

create table invoiceLines (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  invoiceId uuid not null references invoices (id) on delete cascade,
  projectId uuid not null references projects (id),
  description text not null,
  seconds integer not null,
  rateCents integer not null,
  amountCents integer not null
);

create index invoiceLinesInvoiceId on invoiceLines (invoiceId);

create trigger invoiceLinesTouchUpdatedAt
  before update on invoiceLines
  for each row execute function touchUpdatedAt();

-- A running timer is an entry with startedAt set. Stopping it folds the
-- elapsed time into seconds and clears startedAt.
create table timeEntries (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  userId uuid not null references users (id) on delete cascade,
  projectId uuid not null references projects (id),
  workDate date not null,
  seconds integer not null default 0 check (seconds >= 0),
  startedAt timestamptz,
  note text not null default '',
  billable boolean not null default true,
  invoiceId uuid references invoices (id) on delete set null
);

create index timeEntriesUserDate on timeEntries (userId, workDate);
create index timeEntriesProjectDate on timeEntries (projectId, workDate);
create index timeEntriesInvoiceId on timeEntries (invoiceId);
create unique index timeEntriesOneRunning on timeEntries (userId) where startedAt is not null;

create trigger timeEntriesTouchUpdatedAt
  before update on timeEntries
  for each row execute function touchUpdatedAt();

create table payments (
  id uuid primary key default uuidGenerateV7(),
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  stripeSessionId text not null unique,
  invoiceId uuid not null references invoices (id),
  amountTotal integer not null,
  currency text not null
);

create trigger paymentsTouchUpdatedAt
  before update on payments
  for each row execute function touchUpdatedAt();

-- One row per url the app has served from in production. The app registers
-- its own Stripe webhook endpoint and keeps the signing secret here.
create table stripeWebhooks (
  url text primary key,
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now(),
  endpointId text not null,
  secret text not null
);

create trigger stripeWebhooksTouchUpdatedAt
  before update on stripeWebhooks
  for each row execute function touchUpdatedAt();

-- Invoice status changes come from Stripe (the return page and the webhook)
-- as well as from the app, so the table announces its own writes. The payload
-- is the id alone and each app server reads the row back through the view's
-- select, which carries the client name the pages show.
create or replace function invoicesNotify() returns trigger
language plpgsql as $$
declare
  r record;
  payload text;
begin
  r := coalesce(new, old);
  payload := json_build_object('op', lower(tg_op), 'id', r.id)::text;

  perform pg_notify(channel_name('invoices'), payload);
  perform pg_notify(channel_name('invoices:token=' || r.token), payload);

  return r;
end;
$$;

create trigger invoicesNotifyTrigger
  after insert or update or delete on invoices
  for each row execute function invoicesNotify();
