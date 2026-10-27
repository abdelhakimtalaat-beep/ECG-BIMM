-- Mobile / Ext. for BIM engineers, and the Contacts directory (people outside the BIM Department). Safe to run more than once.
alter table employees add column if not exists mobile text;
alter table employees add column if not exists ext text;
create table if not exists contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  department text,
  job_title  text,
  email      text,
  mobile     text,
  ext        text,
  notes      text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table contacts enable row level security;
