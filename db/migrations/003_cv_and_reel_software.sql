-- Adds the employee CV upload and the BIM Reels "software" column. Safe to run more than once.
-- Run this once in the Supabase SQL Editor on a database created before these features.
alter table employees add column if not exists cv_id uuid;
alter table reel_sessions add column if not exists software text;
