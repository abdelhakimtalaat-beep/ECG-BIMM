-- Project contents (buildings etc.) and the BIM Process Map (one workflow per building). Safe to run more than once.
create table if not exists project_contents (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name       text not null,
  kind       text not null default 'Building' check (kind in ('Building','Infrastructure','Landscape','Other')),
  created_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists project_contents_name_uq on project_contents(project_id, lower(name));
create table if not exists process_buildings (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  content_id uuid not null references project_contents(id) on delete cascade unique,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists process_buildings_project_idx on process_buildings(project_id);
create table if not exists process_nodes (
  building_id uuid not null references process_buildings(id) on delete cascade,
  node_key    text not null,
  status      text not null default 'Not Started' check (status in ('Not Started','In Progress','On Hold','Completed')),
  comment     text,
  updated_by  text,
  updated_at  timestamptz not null default now(),
  primary key (building_id, node_key)
);
alter table project_contents enable row level security;
alter table process_buildings enable row level security;
alter table process_nodes enable row level security;
