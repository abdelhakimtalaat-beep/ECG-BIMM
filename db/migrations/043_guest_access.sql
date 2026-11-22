-- General access: anyone with the portal link can sign in with a one-time password (OTP) sent to their e-mail and gets read-only access
-- to the tabs the Administrator enabled. Guests are ordinary read-only users flagged is_guest.
alter table users add column if not exists is_guest boolean not null default false;
create table if not exists otp_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  used        boolean not null default false,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists otp_codes_email_idx on otp_codes (email, created_at desc);
insert into app_settings(key, value) values ('guest_access', '{"enabled": false, "tabs": [], "domains": []}') on conflict (key) do nothing;
