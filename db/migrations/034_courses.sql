-- Training > Internal Courses: a course has a title, instructor, a default video link, its folder on the ECG server, and numbered sessions (each with its own video link)
create table if not exists courses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  instructor  text,
  description text,
  video_url   text,
  server_path text,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists course_sessions (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references courses(id) on delete cascade,
  position   int not null default 0,
  title      text not null,
  video_url  text
);
create index if not exists course_sessions_course_idx on course_sessions(course_id, position);
alter table courses enable row level security;
alter table course_sessions enable row level security;
