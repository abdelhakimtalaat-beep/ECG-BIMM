-- Tasks: "On Hold" becomes "Pending", and tasks get a comment (mandatory when Pending, enforced by the app). Safe to run more than once.
alter table tasks add column if not exists comment text;
alter table tasks drop constraint if exists tasks_status_check;
update tasks set status = 'Pending' where status = 'On Hold';
alter table tasks add constraint tasks_status_check check (status in ('Not Started','In Progress','Pending','Completed'));
