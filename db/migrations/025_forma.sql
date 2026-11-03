-- Autodesk Forma URL and Forma e-mail address per project. Safe to run more than once.
alter table projects add column if not exists forma_url text;
alter table projects add column if not exists forma_email text;
