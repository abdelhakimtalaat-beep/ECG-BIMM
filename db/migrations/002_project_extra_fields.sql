-- Adds Deltek Number, Project Manager, Technical Manager and Client to projects. Safe to run more than once.
-- Run this once in the Supabase SQL Editor on a database created before this feature.
alter table projects add column if not exists deltek_number text;
alter table projects add column if not exists project_manager text;
alter table projects add column if not exists technical_manager text;
alter table projects add column if not exists client text;
