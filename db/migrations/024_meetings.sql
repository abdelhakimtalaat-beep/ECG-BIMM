-- Meetings: each engineer pastes the ICS link of their published Outlook / Teams calendar; the platform syncs and shows the meetings.
create table if not exists calendar_feeds (
  employee_id    uuid primary key references employees(id) on delete cascade,
  url            text not null,
  share          text not null default 'managers' check (share in ('everyone','managers')),
  last_synced_at timestamptz,
  last_error     text,
  event_count    int not null default 0,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create table if not exists calendar_events (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  uid         text not null,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  all_day     boolean not null default false,
  title       text not null,
  location    text,
  organizer   text,
  teams_url   text,
  is_private  boolean not null default false,
  busy        boolean not null default true
);
create index if not exists calendar_events_start_idx on calendar_events(start_at);
create index if not exists calendar_events_emp_idx on calendar_events(employee_id, start_at);
alter table calendar_feeds enable row level security;
alter table calendar_events enable row level security;
