-- Personal / HR data of each employee (birthday, gender, job start date) and uploaded employee documents
-- (National ID, passport, certificates ...). Documents are stored in `attachments`. Safe to run more than once.
alter table employees add column if not exists birth_date date;
alter table employees add column if not exists gender text;
alter table employees add column if not exists job_start_date date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'employees_gender_check') then
    alter table employees add constraint employees_gender_check check (gender is null or gender in ('Male','Female'));
  end if;
end $$;
create table if not exists employee_documents (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  doc_type      text not null check (doc_type in ('National ID','Passport','University Certificate','Other Certificate','Other')),
  attachment_id uuid not null references attachments(id) on delete cascade,
  created_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists employee_documents_emp_idx on employee_documents(employee_id);
alter table employee_documents enable row level security;
