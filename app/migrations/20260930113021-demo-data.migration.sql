-- demo data: a small design agency with a month of tracked time, and invoices in every status

-- Every demo login shares one password; the sign-in page lists them.
insert into users (email, name, role, passwordHash) values
  ('maya@timesheaf.test',  'Maya Okafor',    'admin',  crypt('timesheaf', genSalt('bf', 12))),
  ('jonah@timesheaf.test', 'Jonah Reyes',    'member', crypt('timesheaf', genSalt('bf', 12))),
  ('priya@timesheaf.test', 'Priya Shah',     'member', crypt('timesheaf', genSalt('bf', 12))),
  ('theo@timesheaf.test',  'Theo Lindqvist', 'member', crypt('timesheaf', genSalt('bf', 12)));

insert into clients (name, contactName, email) values
  ('Fernwood Coffee',      'Ada Park',     'ada@fernwood.test'),
  ('Northwind Outfitters', 'Lena Morales', 'lena@northwind.test'),
  ('Harbor Health',        'Sam Whitaker', 'sam@harborhealth.test'),
  ('Lumen Books',          'Iris Chen',    'iris@lumenbooks.test');

insert into projects (clientId, name, rateCents, color)
     select c.id, v.name, v.rateCents, v.color
       from (values
         ('Fernwood Coffee',      'Rebrand',           15000, '#c2410c'),
         ('Fernwood Coffee',      'Packaging',         14000, '#b45309'),
         ('Northwind Outfitters', 'Spring catalog',    12500, '#15803d'),
         ('Harbor Health',        'Patient portal UI', 16500, '#1d4ed8'),
         ('Harbor Health',        'Design system',     15500, '#7c3aed'),
         ('Lumen Books',          'Website refresh',   12000, '#be185d')
       ) as v (clientName, name, rateCents, color)
       join clients c on c.name = v.clientName;

select setseed(0.42);

-- The last thirty days of weekdays. Each person has the projects they work
-- on and the chance, per day, that they log a block of time to each.
with affinity (email, project, chance) as (
  values
    ('maya@timesheaf.test',  'Rebrand',           0.55),
    ('maya@timesheaf.test',  'Design system',     0.45),
    ('jonah@timesheaf.test', 'Patient portal UI', 0.85),
    ('jonah@timesheaf.test', 'Design system',     0.6),
    ('jonah@timesheaf.test', 'Website refresh',   0.35),
    ('priya@timesheaf.test', 'Rebrand',           0.8),
    ('priya@timesheaf.test', 'Packaging',         0.6),
    ('priya@timesheaf.test', 'Spring catalog',    0.4),
    ('theo@timesheaf.test',  'Spring catalog',    0.8),
    ('theo@timesheaf.test',  'Website refresh',   0.65),
    ('theo@timesheaf.test',  'Patient portal UI', 0.3)
),
notes (project, list) as (
  values
    ('Rebrand',           array['Logo explorations', 'Wordmark refinements', 'Brand guidelines draft', 'Color palette review', 'Client presentation prep']),
    ('Packaging',         array['Bag dieline layout', 'Label typography', 'Print vendor proofs', 'Retail mockups']),
    ('Spring catalog',    array['Catalog grid layout', 'Photo selects', 'Product copy fitting', 'Cover concepts', 'Press check notes']),
    ('Patient portal UI', array['Appointment flow wireframes', 'Dashboard hi-fi screens', 'Usability test synthesis', 'Accessibility pass', 'Dev handoff specs']),
    ('Design system',     array['Button and form tokens', 'Component audit', 'Documentation site', 'Icon set cleanup']),
    ('Website refresh',   array['Homepage concepts', 'Author page template', 'Responsive QA', 'CMS content modeling'])
),
days as (
  select g::date as day
    from generate_series(current_date - 29, current_date, interval '1 day') g
   where extract(isodow from g) < 6
)
insert into timeEntries (userId, projectId, workDate, seconds, note, billable, createdAt)
     select userId, projectId, day, seconds, note, billable, day + time '17:30'
       from (
         -- offset 0 keeps the planner from evaluating random() once per
         -- affinity row instead of once per person, project and day.
         select u.id as userId,
                p.id as projectId,
                d.day,
                a.chance,
                random() as roll,
                (2 + floor(random() * 6))::int * 1800 as seconds,
                n.list[1 + floor(random() * array_length(n.list, 1))::int] as note,
                random() > 0.08 as billable
           from affinity a
           join users u on u.email = a.email
           join projects p on p.name = a.project
           join notes n on n.project = a.project
          cross join days d
         offset 0
       ) picks
      where roll < chance;

-- Two timers running right now.
insert into timeEntries (userId, projectId, workDate, startedAt, note)
     select u.id, p.id, current_date, now() - v.ago::interval, v.note
       from (values
         ('jonah@timesheaf.test', 'Patient portal UI', '47 minutes', 'Settings screens'),
         ('priya@timesheaf.test', 'Rebrand',           '12 minutes', 'Signage mockups')
       ) as v (email, project, ago, note)
       join users u on u.email = v.email
       join projects p on p.name = v.project;

-- Two billing periods for three clients, in every status: paid, sent and a
-- draft. Lumen Books stays unbilled, ready for a new one. Numbers follow the
-- order they are built in.
select buildInvoice((select id from clients where name = 'Northwind Outfitters'), current_date - 29, current_date - 23);
select buildInvoice((select id from clients where name = 'Fernwood Coffee'),      current_date - 29, current_date - 22);
select buildInvoice((select id from clients where name = 'Harbor Health'),        current_date - 29, current_date - 20);
select buildInvoice((select id from clients where name = 'Northwind Outfitters'), current_date - 22, current_date - 16);
select buildInvoice((select id from clients where name = 'Fernwood Coffee'),      current_date - 21, current_date - 15);
select buildInvoice((select id from clients where name = 'Harbor Health'),        current_date - 19, current_date - 9);

-- Times are UTC: mid-morning to afternoon in the Americas.
update invoices i
   set status = v.status::invoiceStatus,
       createdAt = current_date - v.sentAgo - 1 + time '22:40',
       sentAt = current_date - v.sentAgo + time '16:30',
       paidAt = case when v.paidAgo is null then null else current_date - v.paidAgo + time '21:22' end,
       dueDate = current_date - v.sentAgo + 30
  from (values
    ('Northwind Outfitters', 29, 'paid', 22, 18),
    ('Fernwood Coffee',      29, 'paid', 21, 15),
    ('Harbor Health',        29, 'sent', 19, null),
    ('Northwind Outfitters', 22, 'paid', 15, 8),
    ('Fernwood Coffee',      21, 'sent', 13, null)
  ) as v (clientName, startAgo, status, sentAgo, paidAgo)
  join clients c on c.name = v.clientName
 where c.id = i.clientId
   and i.periodStart = current_date - v.startAgo;

update invoices set createdAt = current_date - 8 + time '22:15' where status = 'draft';

insert into payments (stripeSessionId, invoiceId, amountTotal, currency)
     select 'cs_test_demo_' || number, id, totalCents, 'usd'
       from invoices
      where status = 'paid';
