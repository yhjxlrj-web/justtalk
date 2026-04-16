alter table public.profiles
add column if not exists show_last_seen boolean not null default true;
