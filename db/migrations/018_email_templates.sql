-- Emails Template tab. Safe to run more than once.
create table if not exists email_templates (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  body           text not null,
  status         text not null default 'approved' check (status in ('approved','pending','rejected')),
  requested_by   text,
  requested_name text,
  review_note    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists email_templates_status_idx on email_templates(status);
alter table email_templates enable row level security;
