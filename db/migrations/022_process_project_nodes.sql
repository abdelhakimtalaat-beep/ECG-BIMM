-- BIM Process Map: an activity ticked "apply to all buildings" is linked at project level: every building (also those added later) follows it.
create table if not exists process_project_nodes (
  project_id uuid not null references projects(id) on delete cascade,
  node_key   text not null,
  status     text not null check (status in ('Not Started','In Progress','On Hold','Completed')),
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (project_id, node_key)
);
alter table process_project_nodes enable row level security;
