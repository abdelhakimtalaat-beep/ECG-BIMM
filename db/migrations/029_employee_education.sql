-- Education of each employee (up to 4 rows: degree, major, university, year). Shown in the org chart and read by the Evaluation form. Safe to run more than once.
alter table employees add column if not exists education jsonb not null default '[]'::jsonb;
