-- Project location (country and city). Safe to run more than once.
alter table projects add column if not exists country text;
alter table projects add column if not exists city text;
