-- Linked activities may also be linked at "Not Started" (so the tick stays on). Safe to run after 022 whether or not it is already applied.
alter table process_project_nodes drop constraint if exists process_project_nodes_status_check;
alter table process_project_nodes add constraint process_project_nodes_status_check check (status in ('Not Started','In Progress','On Hold','Completed'));
