-- ACC: remember the one-time extract request of each project so "Import now" can read it
alter table acc_requests add column if not exists once_request_id text;
