-- BIMMers > Vacations: an employee's vacation request
create table if not exists vacation_requests (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references employees(id) on delete cascade,
  start_date      date not null,
  end_date        date not null,
  days            int  not null,
  replacement_id  uuid references employees(id) on delete set null,
  notes           text,
  location        text,
  auto_reply      boolean not null default false,
  created_by      text,
  created_at      timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists vacation_requests_emp_idx on vacation_requests(employee_id, start_date desc);
alter table vacation_requests enable row level security;
