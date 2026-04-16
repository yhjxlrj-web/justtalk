alter table public.friendships
drop constraint if exists friendships_status_check;

alter table public.friendships
add constraint friendships_status_check
check (status in ('pending', 'accepted', 'rejected', 'blocked'));
