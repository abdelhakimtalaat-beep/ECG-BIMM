-- Training > Internal Courses: sections (Revit, Civil 3D, Navisworks, Autodesk Forma (ACC), …) that group the courses; the Administrator can add more
create table if not exists course_sections (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists course_sections_name_uq on course_sections (lower(name));
alter table course_sections enable row level security;
insert into course_sections(name, position) values ('Revit',1),('Civil 3D',2),('Navisworks',3),('Autodesk Forma (ACC)',4) on conflict do nothing;
alter table courses add column if not exists section_id uuid references course_sections(id) on delete set null;
-- courses added before sections existed are filed by their title
update courses set section_id = (select id from course_sections where lower(name)='revit') where section_id is null and title ilike '%revit%';
update courses set section_id = (select id from course_sections where lower(name)='civil 3d') where section_id is null and title ilike '%civil%';
update courses set section_id = (select id from course_sections where lower(name)='navisworks') where section_id is null and title ilike '%navisworks%';
update courses set section_id = (select id from course_sections where lower(name)='autodesk forma (acc)') where section_id is null and (title ilike '%forma%' or title ilike '%acc%');
