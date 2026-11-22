-- Client description and client name in Arabic.
alter table clients add column if not exists description text;
alter table clients add column if not exists name_ar text;
