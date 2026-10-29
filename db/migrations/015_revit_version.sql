-- Revit version per project (2020-2027). Safe to run more than once.
alter table projects add column if not exists revit_version text;
