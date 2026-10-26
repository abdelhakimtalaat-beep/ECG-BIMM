-- New workload factor: BIM Standards (Aggressive / Normal / No Standards). Safe to run more than once.
alter table projects add column if not exists bim_standards text;
