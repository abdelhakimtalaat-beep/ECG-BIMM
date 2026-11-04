-- Read-only users (role viewer) can be limited to chosen tabs; NULL = all tabs. Safe to run more than once.
alter table users add column if not exists allowed_tabs text[];
