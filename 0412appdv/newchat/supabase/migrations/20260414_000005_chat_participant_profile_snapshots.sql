alter table public.chat_participants
add column if not exists display_name_snapshot text,
add column if not exists email_snapshot text,
add column if not exists avatar_url_snapshot text;

update public.chat_participants cp
set
  display_name_snapshot = coalesce(cp.display_name_snapshot, p.display_name),
  email_snapshot = coalesce(cp.email_snapshot, p.email),
  avatar_url_snapshot = coalesce(cp.avatar_url_snapshot, p.avatar_url)
from public.profiles p
where p.id = cp.user_id;
