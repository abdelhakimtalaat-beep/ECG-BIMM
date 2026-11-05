-- Annual performance evaluation: one form per employee and period, scored in three stages (self -> direct manager -> department manager).
-- Safe to run more than once.
create table if not exists evaluations (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  period      text not null,
  status      text not null default 'self' check (status in ('self','manager','department','completed')),
  info        jsonb not null default '{}'::jsonb,   -- location, employment date, department, section, vacation/sick/late, education rows
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (employee_id, period)
);
create table if not exists evaluation_scores (
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  stage         text not null check (stage in ('self','manager','department')),
  item_key      text not null,
  score         numeric(3,1) check (score is null or (score >= 0 and score <= 10)),
  comment       text,
  primary key (evaluation_id, stage, item_key)
);
create table if not exists evaluation_stages (
  evaluation_id   uuid not null references evaluations(id) on delete cascade,
  stage           text not null check (stage in ('self','manager','department')),
  overall_comment text,
  submitted_at    timestamptz,
  submitted_by    text,
  primary key (evaluation_id, stage)
);
alter table evaluations enable row level security;
alter table evaluation_scores enable row level security;
alter table evaluation_stages enable row level security;
