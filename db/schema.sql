-- ECG BIM Department Management Portal — PostgreSQL schema (Supabase-compatible)
-- Idempotent: safe to run on an empty database. See db/migrate.mjs.

create extension if not exists pgcrypto;

do $$ begin
  create type app_role as enum ('admin', 'bim_manager', 'bim_coordinator', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('Not Started', 'In Progress', 'On Hold', 'Closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reel_status as enum ('Not recorded', 'Planned', 'Completed', 'Postponed', 'Cancelled');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------ people
create table if not exists employees (
  id            uuid primary key default gen_random_uuid(),
  employee_code text unique,                      -- original employee ID (nullable: not all supplied)
  name          text not null,
  job_title     text not null,                    -- as supplied in the org chart
  job_category  text not null check (job_category in ('department_manager','bim_manager','bim_coordinator','bim_specialist','rd_engineer','other')),
  discipline    text,
  year_value    int,                              -- the "-2002" suffix on the org chart card (experience/graduation year, as supplied)
  team_location text,                             -- NC / SV / Alex tag from the org chart
  active        boolean not null default true,
  notes         text,
  photo_id      uuid,                             -- attachments.id of the profile photo (optional)
  cv_id         uuid,                             -- attachments.id of the uploaded CV (optional)
  email         text,                             -- work e-mail; also the sign-in name of the employee's portal user
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table employees add column if not exists photo_id uuid;
alter table employees add column if not exists cv_id uuid;
alter table employees add column if not exists email text;
create unique index if not exists employees_email_uq on employees (lower(email)) where email is not null;   -- upgrades databases created before photos existed

create table if not exists employee_aliases (     -- spellings found in other sources
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  alias       text not null,
  reason      text,
  confirmed   boolean not null default false,
  unique (alias)
);

create table if not exists reporting_relationships (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  manager_id  uuid not null references employees(id) on delete cascade,
  valid_from  date not null default current_date,
  valid_to    date,
  check (employee_id <> manager_id)
);
-- one current reporting line per employee
create unique index if not exists reporting_current_uq on reporting_relationships(employee_id) where valid_to is null;

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  full_name     text,
  password_hash text not null,
  role          app_role not null default 'viewer',
  employee_id   uuid references employees(id) on delete set null,
  active        boolean not null default true,
  must_change_password boolean not null default false,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- projects
create table if not exists status_mappings (
  id             uuid primary key default gen_random_uuid(),
  source_status  text not null,                    -- Open / Hold / Closed / Terminated
  activity_flag  text not null default '',         -- Active / Not Active / '' (column I of the workbook)
  target_status  project_status not null,
  note           text,
  unique (source_status, activity_flag)
);

create table if not exists projects (
  id            uuid primary key default gen_random_uuid(),
  project_no    text,                              -- original number, kept verbatim; nullable
  name          text not null,
  cde           text,
  type          text,
  deltek_number     text,                          -- Deltek project number
  project_manager   text,                          -- free text: usually not a BIM department employee
  technical_manager text,
  client            text,
  built_up_area numeric,                           -- valid numeric values only
  area_raw      text,                              -- original cell content
  area_note     text,
  status_raw    text,                              -- original workbook status
  activity_raw  text,                              -- original Active / Not Active flag
  status        project_status not null default 'Not Started',
  status_source text not null default 'mapping' check (status_source in ('mapping','manual')),
  notes         text,
  photo_id      uuid,
  source_rows   int[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table projects add column if not exists deltek_number text;       -- upgrades databases created before these fields existed
alter table projects add column if not exists project_manager text;
alter table projects add column if not exists technical_manager text;
alter table projects add column if not exists client text;
alter table projects add column if not exists typicality text;
alter table projects add column if not exists function_type text;
alter table projects add column if not exists coordination_type text;
create index if not exists projects_no_idx on projects(project_no);

create table if not exists project_status_history (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  old_status  project_status,
  new_status  project_status not null,
  reason      text,
  changed_by  text,
  changed_at  timestamptz not null default now()
);

create table if not exists project_notes (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  body       text not null,
  author     text,
  created_at timestamptz not null default now()
);

create table if not exists project_assignments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  role        text not null check (role in ('manager','coordinator','member')),
  package     text,                                -- legitimate separate package/discipline, when applicable
  source_row  int,
  created_at  timestamptz not null default now(),
  unique (project_id, employee_id, role)
);
create index if not exists assign_emp_idx on project_assignments(employee_id);

-- --------------------------------------------------------------- BIM Reels
create table if not exists reel_sessions (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid references employees(id) on delete set null,
  presenter_code text,                             -- employee ID as printed on the plan
  presenter_name text not null,
  weekday        text not null,
  session_date   date not null,
  topic          text,
  software       text,                             -- Revit / Navisworks / ACC / Dynamo
  status         reel_status not null default 'Not recorded',
  notes          text,
  link           text,
  attachment_id  uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table reel_sessions add column if not exists software text;  -- upgrades databases created before this column existed
create index if not exists reel_date_idx on reel_sessions(session_date);

-- ----------------------------------------------------------- files, settings
create table if not exists attachments (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,                        -- project_photo | reel_file | logo
  filename   text,
  mime       text not null,
  size_bytes int not null,
  data       bytea not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_email  text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  summary     text,
  before_data jsonb,
  after_data  jsonb
);
create index if not exists audit_at_idx on audit_logs(at desc);

create table if not exists import_runs (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  source     text not null,
  run_by     text,
  summary    jsonb
);

create table if not exists data_issues (
  id         uuid primary key default gen_random_uuid(),
  import_run uuid references import_runs(id) on delete set null,
  severity   text not null,
  kind       text not null,
  entity     text,
  message    text not null,
  resolved   boolean not null default false,
  resolved_by text,
  resolved_at timestamptz
);

-- ------------------------------------------------------------------ security
-- The Next.js server is the only database client and enforces roles in code.
-- Row level security is switched on with no policies so that the Supabase anon /
-- authenticated keys (PostgREST) can never read these tables directly.
do $$
declare t text;
begin
  for t in select unnest(array['employees','employee_aliases','reporting_relationships','users','status_mappings','projects',
    'project_status_history','project_notes','project_assignments','reel_sessions','attachments','app_settings','audit_logs','import_runs','data_issues'])
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
