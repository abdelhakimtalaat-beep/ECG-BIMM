-- Rows (disciplines / lanes) removed from a project's Process Map; the project's buildings all share the same set
create table if not exists process_hidden_lanes (
  project_id uuid not null references projects(id) on delete cascade,
  lane_id    text not null,
  primary key (project_id, lane_id)
);
alter table process_hidden_lanes enable row level security;
