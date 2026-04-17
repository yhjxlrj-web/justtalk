create table if not exists public.chat_room_summaries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  peer_user_id uuid references public.profiles(id) on delete set null,
  peer_display_name_snapshot text,
  peer_avatar_snapshot text,
  peer_preferred_language_snapshot text,
  last_message_id uuid references public.messages(id) on delete set null,
  last_message_preview text not null default 'No messages yet.',
  last_message_created_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint chat_room_summaries_room_user_unique unique (room_id, user_id)
);

create index if not exists idx_chat_room_summaries_user_updated
on public.chat_room_summaries(user_id, updated_at desc);

create index if not exists idx_chat_room_summaries_user_latest_message
on public.chat_room_summaries(user_id, last_message_created_at desc nulls last);

create index if not exists idx_chat_room_summaries_room
on public.chat_room_summaries(room_id);

create index if not exists idx_chat_room_summaries_peer_user
on public.chat_room_summaries(peer_user_id);

drop trigger if exists chat_room_summaries_set_updated_at on public.chat_room_summaries;
create trigger chat_room_summaries_set_updated_at
  before update on public.chat_room_summaries
  for each row execute procedure public.set_updated_at();

alter table public.chat_room_summaries enable row level security;

drop policy if exists "chat_room_summaries_select_own" on public.chat_room_summaries;
create policy "chat_room_summaries_select_own"
on public.chat_room_summaries
for select
using (user_id = auth.uid());

drop policy if exists "chat_room_summaries_insert_own" on public.chat_room_summaries;
create policy "chat_room_summaries_insert_own"
on public.chat_room_summaries
for insert
with check (user_id = auth.uid());

drop policy if exists "chat_room_summaries_update_own" on public.chat_room_summaries;
create policy "chat_room_summaries_update_own"
on public.chat_room_summaries
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_room_summaries'
  ) then
    alter publication supabase_realtime add table public.chat_room_summaries;
  end if;
end
$$;

insert into public.chat_room_summaries (
  room_id,
  user_id,
  peer_user_id,
  peer_display_name_snapshot,
  peer_avatar_snapshot,
  peer_preferred_language_snapshot,
  unread_count
)
select
  cp.chat_id as room_id,
  cp.user_id,
  peer.user_id as peer_user_id,
  peer.display_name_snapshot as peer_display_name_snapshot,
  peer.avatar_url_snapshot as peer_avatar_snapshot,
  peer.preferred_language_snapshot as peer_preferred_language_snapshot,
  0 as unread_count
from public.chat_participants cp
left join lateral (
  select
    cp2.user_id,
    cp2.display_name_snapshot,
    cp2.avatar_url_snapshot,
    cp2.preferred_language_snapshot
  from public.chat_participants cp2
  where cp2.chat_id = cp.chat_id
    and cp2.user_id <> cp.user_id
  order by cp2.joined_at asc, cp2.user_id asc
  limit 1
) peer on true
on conflict (room_id, user_id) do update
set
  peer_user_id = excluded.peer_user_id,
  peer_display_name_snapshot = excluded.peer_display_name_snapshot,
  peer_avatar_snapshot = excluded.peer_avatar_snapshot,
  peer_preferred_language_snapshot = excluded.peer_preferred_language_snapshot;

with latest_message as (
  select distinct on (m.chat_id)
    m.chat_id,
    m.id,
    m.created_at,
    m.sender_id,
    m.original_text,
    m.message_kind
  from public.messages m
  order by m.chat_id, m.created_at desc
),
computed as (
  select
    s.room_id,
    s.user_id,
    lm.id as last_message_id,
    lm.created_at as last_message_created_at,
    case
      when lm.id is null then 'No messages yet.'
      when lm.message_kind = 'image' then 'Photo'
      when lm.sender_id = s.user_id then lm.original_text
      else coalesce(mt.translated_text, lm.original_text)
    end as last_message_preview,
    coalesce(unread.total_unread, 0) as unread_count
  from public.chat_room_summaries s
  left join latest_message lm
    on lm.chat_id = s.room_id
  left join public.message_translations mt
    on mt.message_id = lm.id
   and mt.target_user_id = s.user_id
  left join lateral (
    select count(*)::integer as total_unread
    from public.messages m2
    join public.chat_participants cp
      on cp.chat_id = s.room_id
     and cp.user_id = s.user_id
    where m2.chat_id = s.room_id
      and m2.sender_id <> s.user_id
      and (cp.last_seen_at is null or m2.created_at > cp.last_seen_at)
  ) unread on true
)
update public.chat_room_summaries s
set
  last_message_id = c.last_message_id,
  last_message_created_at = c.last_message_created_at,
  last_message_preview = c.last_message_preview,
  unread_count = c.unread_count
from computed c
where s.room_id = c.room_id
  and s.user_id = c.user_id;
