-- Tasks tab: a task area per BIM Manager, project sub-areas, and tracked tasks. Safe to run more than once.
create table if not exists task_areas (
  id          uuid primary key default gen_random_uuid(),
  manager_id  uuid not null references employees(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  created_by  text,
  created_at  timestamptz not null default now(),
  unique (manager_id, project_id)
);
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  area_id     uuid not null references task_areas(id) on delete cascade,
  title       text not null,
  start_date  date,
  due_date    date,
  assignee_id uuid references employees(id) on delete set null,
  status      text not null default 'Not Started' check (status in ('Not Started','In Progress','On Hold','Completed')),
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_area_idx on tasks(area_id);
alter table task_areas enable row level security;
alter table tasks enable row level security;
