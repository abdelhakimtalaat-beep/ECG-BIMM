-- Workload: new Scope factor (one or more disciplines) and "No Standards" renamed "Minimum Standards". Safe to run more than once.
alter table projects add column if not exists scope_items text[];
update projects set bim_standards = 'Minimum Standards' where bim_standards = 'No Standards';
