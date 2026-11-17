-- ACC: one Data Connector request per project (a Project Admin may only extract the projects he administers)
create table if not exists acc_requests (
  acc_project_id text primary key,
  project_name   text,
  request_id     text,
  last_job_id    text,
  last_status    text,
  last_error     text,
  updated_at     timestamptz not null default now()
);
alter table acc_requests enable row level security;
