-- Tasks tab: admin-created teams (with members) and a Building No. on every task. Safe to run more than once.
create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists team_members (
  team_id     uuid not null references teams(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  primary key (team_id, employee_id)
);
alter table task_areas add column if not exists team_id uuid references teams(id) on delete cascade;
alter table task_areas alter column manager_id drop not null;
alter table task_areas drop constraint if exists task_areas_owner_check;
alter table task_areas add constraint task_areas_owner_check check (num_nonnulls(manager_id, team_id) = 1);
create unique index if not exists task_areas_team_project_uq on task_areas(team_id, project_id) where team_id is not null;
alter table tasks add column if not exists building_no text;
alter table teams enable row level security;
alter table team_members enable row level security;
