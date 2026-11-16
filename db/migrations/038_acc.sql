-- ACC (Autodesk Construction Cloud) connection: project statistics read from the Data Connector
alter table projects add column if not exists acc_project_id text;
create table if not exists acc_connection (
  id               int primary key default 1 check (id = 1),
  account_id       text,
  hub_name         text,
  refresh_token    text,            -- encrypted (AES-256-GCM, key derived from APS_CLIENT_SECRET); never leaves the server
  connected_by     text,
  connected_at     timestamptz,
  request_id       text,            -- the recurring Data Connector request created by the portal
  last_job_id      text,            -- last extract imported
  last_sync_at     timestamptz,
  last_status      text,
  last_error       text
);
create table if not exists acc_project_stats (
  acc_project_id text primary key,
  name           text,
  stats          jsonb not null,
  synced_at      timestamptz not null default now()
);
alter table acc_connection enable row level security;
alter table acc_project_stats enable row level security;
