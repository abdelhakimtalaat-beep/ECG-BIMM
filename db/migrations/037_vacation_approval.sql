-- Vacations: approval chain (direct manager first, then department manager; department manager only for BIM managers)
alter table vacation_requests add column if not exists status text not null default 'approved' check (status in ('pending_manager','pending_department','approved','rejected'));  -- requests made before this migration count as approved
alter table vacation_requests add column if not exists manager_id uuid references employees(id) on delete set null;
alter table vacation_requests add column if not exists manager_decision text check (manager_decision in ('approved','rejected'));
alter table vacation_requests add column if not exists manager_decided_at timestamptz;
alter table vacation_requests add column if not exists manager_comment text;
alter table vacation_requests add column if not exists dept_decided_by text;
alter table vacation_requests add column if not exists dept_decision text check (dept_decision in ('approved','rejected'));
alter table vacation_requests add column if not exists dept_decided_at timestamptz;
alter table vacation_requests add column if not exists dept_comment text;
