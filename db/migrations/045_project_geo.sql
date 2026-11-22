-- Map location of a project. It is read from the project's address in ACC (never typed in the portal).
alter table projects add column if not exists geo_lat double precision;
alter table projects add column if not exists geo_lng double precision;
alter table projects add column if not exists geo_precision text;   -- acc | pluscode | address | city
alter table projects add column if not exists geo_address text;     -- the ACC address the pin was made from
alter table projects add column if not exists geo_key text;         -- fingerprint of that address, so unchanged addresses are not looked up again
alter table projects add column if not exists geo_note text;        -- why a project has no pin yet
alter table projects add column if not exists geo_updated timestamptz;
