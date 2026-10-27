-- Wish List: ideas proposed by engineers to develop the platform. Safe to run more than once.
create table if not exists wishes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  area        text,
  author_id   uuid references users(id) on delete set null,
  author_name text not null,
  status      text not null default 'New' check (status in ('New','Under review','Planned','Done','Declined')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists wish_votes (
  wish_id uuid not null references wishes(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (wish_id, user_id)
);
alter table wishes enable row level security;
alter table wish_votes enable row level security;
