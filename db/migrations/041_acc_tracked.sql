-- ACC: the administrator chooses which projects to track; only those are requested and imported
alter table acc_requests add column if not exists tracked boolean not null default false;
update acc_requests set tracked = true where request_id is not null or once_request_id is not null;
