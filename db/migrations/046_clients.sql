-- Clients: one record per client (name, country, logo). Projects are linked by the client name (normalised key), so a renamed client stays linked.
create table if not exists clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  key        text not null unique,
  country    text,
  logo_id    uuid references attachments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
