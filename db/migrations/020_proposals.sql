-- Proposals tab (Administrator adds; everybody reads). Safe to run more than once.
create table if not exists proposals (
  id                 uuid primary key default gen_random_uuid(),
  project_name       text not null,
  proposal_number    text not null,
  client             text,
  proposal_manager   text,
  expected_man_hours numeric,
  calc               jsonb,
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists proposals_number_uq on proposals(lower(proposal_number));
alter table proposals enable row level security;
