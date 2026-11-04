-- Project Stages and LOD (tick one or more). Safe to run more than once.
alter table projects add column if not exists stages text[];
alter table projects add column if not exists lods text[];
