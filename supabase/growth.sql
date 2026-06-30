-- justcoffee — growth / ad-attribution schema.
-- Separate from schema.sql so the experiment infra is visually isolated from the
-- product tables. Already applied to the live project via migration
-- "growth_attribution_events"; kept here for the repo record and re-runs.
--
-- One table — the attribution spine. Every funnel step (a visit from an ad, a
-- signup, an activation, and later the email send/click events) is one row tagged
-- with the ad variant + market, so the dashboard is a single GROUP BY.
--
-- Service-role only (RLS enabled, no public policies), exactly like the rest of
-- the schema. Privacy-first like lib/analytics.ts: never store a raw email here.

create table if not exists growth_events (
  id         bigint generated always as identity primary key,
  type       text   not null,             -- visit | signup | activated | (later) sent|delivered|clicked|bounced|complained|unsubscribed
  variant    text   not null default '',  -- which ad  (the ?v= param)
  market     text   not null default '',  -- campus/segment (the ?c= param)
  channel    text   not null default '',  -- email|flyer|ig|reddit|qr|unknown (the ?ch= param)
  contact_id text,                         -- per-recipient id for the email channel (the ?ct= param)
  anon_id    text,                         -- opaque first-party visitor id (cookie) for unique-visitor de-dup
  user_id    text,                         -- justcoffee user id once known
  email_hash text,                         -- HMAC(email) — never the raw email
  meta       jsonb  not null default '{}'::jsonb,
  at         bigint not null               -- epoch ms, matches the app's timestamp convention
);
create index if not exists growth_events_vm_idx   on growth_events (variant, market);
create index if not exists growth_events_type_idx on growth_events (type);
create index if not exists growth_events_at_idx   on growth_events (at);
create index if not exists growth_events_anon_idx on growth_events (anon_id);
alter table growth_events enable row level security;

-- ── Signups (raw email capture) ──────────────────────────────────────────────
-- Unlike growth_events (hash-only) this stores the RAW email submitted at
-- /signin, so the /growth dashboard can show the actual address list. Captured
-- on email submit (verified=false) and flipped to verified when the magic link
-- is clicked. Kept out of `users` on purpose: allUsers() feeds the matcher, so
-- stub rows there would pollute matches. Service-role only (RLS, no policies).
-- Applied live via migration "signup_email_capture".
create table if not exists signups (
  email      text primary key,
  user_id    text,
  verified   boolean not null default false,
  variant    text not null default '',
  market     text not null default '',
  channel    text not null default '',
  requests   integer not null default 1,
  first_seen bigint not null,
  last_seen  bigint not null
);
create index if not exists signups_first_seen_idx on signups (first_seen);
alter table signups enable row level security;

-- One-time backfill of already-collected (verified) emails from the users table:
insert into signups (email, user_id, verified, first_seen, last_seen)
select email, id, true, created_at, created_at
from users
where is_demo = false and email is not null
on conflict (email) do nothing;

-- Pre-aggregated funnel views so the dashboard reads one row per cell (no client
-- 1000-row cap), and so you can inspect results directly in the SQL editor.
-- Unique counts: visitors by anon cookie, signups by HMAC email hash, activations
-- by user id — reloads and re-requests don't inflate the numbers.

create or replace view growth_funnel_by_variant_market as
select
  variant,
  market,
  count(distinct anon_id)    filter (where type = 'visit')     as visits,
  count(distinct email_hash) filter (where type = 'signup')    as signups,
  count(distinct user_id)    filter (where type = 'activated')  as activations
from growth_events
group by variant, market;

create or replace view growth_funnel_by_variant as
select
  variant,
  count(distinct anon_id)    filter (where type = 'visit')     as visits,
  count(distinct email_hash) filter (where type = 'signup')    as signups,
  count(distinct user_id)    filter (where type = 'activated')  as activations
from growth_events
group by variant;

-- ── Email channel ────────────────────────────────────────────────────────────
-- Contacts (CSV import), CAN-SPAM suppression list, and an email funnel view.

create table if not exists growth_contacts (
  id           text   primary key,        -- deterministic id, used as ?ct= in links
  email        text   not null,
  name         text   not null default '',
  market       text   not null default '',
  source       text   not null default '',
  meta         jsonb  not null default '{}'::jsonb,
  unsubscribed boolean not null default false,
  created_at   bigint not null,
  unique (email, market)
);
create index if not exists growth_contacts_market_idx on growth_contacts (market);
create index if not exists growth_contacts_email_idx  on growth_contacts (email);
alter table growth_contacts enable row level security;

create table if not exists growth_unsubscribes (
  email text   primary key,
  at    bigint not null
);
alter table growth_unsubscribes enable row level security;

create or replace view growth_email_funnel as
select
  variant,
  market,
  count(distinct contact_id) filter (where type = 'sent')         as sent,
  count(distinct contact_id) filter (where type = 'delivered')    as delivered,
  count(distinct contact_id) filter (where type = 'bounced')      as bounced,
  count(distinct contact_id) filter (where type = 'complained')   as complained,
  count(distinct contact_id) filter (where type = 'unsubscribed') as unsubscribed,
  count(distinct anon_id)    filter (where type = 'visit')         as site_visits,
  count(distinct email_hash) filter (where type = 'signup')        as signups
from growth_events
where channel = 'email'
group by variant, market;

-- Daily time-series (UTC) for the dashboard chart: clicks (visits) + signups + sent.
create or replace view growth_timeseries as
select
  (to_timestamp(at / 1000) at time zone 'UTC')::date as day,
  count(distinct anon_id)    filter (where type = 'visit')  as visits,
  count(distinct email_hash) filter (where type = 'signup') as signups,
  count(distinct contact_id) filter (where type = 'sent')   as sent
from growth_events
group by 1
order by 1;
