-- 3D model of a project: the ACC file (item) opened in the portal's 3D viewer. The newest version is always shown.
alter table projects add column if not exists acc_model_item_id text;
alter table projects add column if not exists acc_model_name text;
