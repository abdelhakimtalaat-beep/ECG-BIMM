-- Workload factors per project (filled by the Administrator). Safe to run more than once.
alter table projects add column if not exists typicality text;
alter table projects add column if not exists function_type text;
alter table projects add column if not exists coordination_type text;
