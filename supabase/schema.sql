-- justcoffee — Supabase schema.
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
-- Coffee spots are kept in application code (lib/cities.ts), so there's no spots table.
-- Timestamps are stored as bigint (JS epoch milliseconds) to match the app's model.

create table if not exists users (
  id           text primary key,
  email        text unique,
  name         text not null default '',
  age          integer not null default 18,
  pseudonym    text not null default '',
  i_am         text not null default '',
  looking_to   text not null default '',
  avatar       jsonb not null default '{"hue":0,"shape":0}'::jsonb,
  photo_url    text,
  verified     boolean not null default false,
  city         text not null default 'austin',
  lat          double precision not null default 0,
  lng          double precision not null default 0,
  availability text not null default 'today',
  is_demo      boolean not null default false,
  openness     double precision not null default 1,
  created_at   bigint not null
);
create index if not exists users_email_idx on users (email);
create index if not exists users_is_demo_idx on users (is_demo);

create table if not exists searches (
  user_id              text primary key references users(id) on delete cascade,
  challenge            double precision not null default 0.5,
  passed               jsonb not null default '[]'::jsonb,
  interested           jsonb not null default '[]'::jsonb,
  current_candidate_id text,
  updated_at           bigint not null
);

create table if not exists interests (
  from_id text not null,
  to_id   text not null,
  at      bigint not null,
  primary key (from_id, to_id)
);

create table if not exists matches (
  id                 text primary key,
  a_id               text not null,
  b_id               text not null,
  created_at         bigint not null,
  expires_at         bigint not null,
  coffee_spot_id     text not null,
  status             text not null default 'active',
  met                jsonb not null default '{}'::jsonb,
  challenge_at_match double precision not null default 0.5
);
create index if not exists matches_a_idx on matches (a_id);
create index if not exists matches_b_idx on matches (b_id);

create table if not exists messages (
  id       text primary key,
  match_id text not null,
  from_id  text not null,
  body     text not null,
  at       bigint not null
);
create index if not exists messages_match_idx on messages (match_id);

create table if not exists reports (
  id        text primary key,
  from_id   text not null,
  target_id text not null,
  reason    text not null default '',
  context   text not null default '',
  at        bigint not null
);

create table if not exists blocks (
  from_id   text not null,
  target_id text not null,
  at        bigint not null,
  primary key (from_id, target_id)
);

-- All access is server-side via the service-role key, so enable RLS and add no
-- public policies: the service role bypasses RLS, the anon key can read nothing.
alter table users    enable row level security;
alter table searches enable row level security;
alter table interests enable row level security;
alter table matches  enable row level security;
alter table messages enable row level security;
alter table reports  enable row level security;
alter table blocks   enable row level security;
