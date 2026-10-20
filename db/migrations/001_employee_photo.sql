-- Adds an optional profile photo to each employee. Safe to run more than once.
-- Run this once in the Supabase SQL Editor on a database created before this feature.
alter table employees add column if not exists photo_id uuid;
