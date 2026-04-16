alter table public.chat_participants
add column if not exists last_seen_at timestamptz;

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, user_id, emoji)
);

create index if not exists idx_message_reactions_message_id
on public.message_reactions(message_id);

create index if not exists idx_message_reactions_user_id
on public.message_reactions(user_id);

alter table public.message_reactions enable row level security;

drop policy if exists "message_reactions_select_chat_members" on public.message_reactions;
create policy "message_reactions_select_chat_members"
on public.message_reactions
for select
using (
  exists (
    select 1
    from public.messages m
    join public.chat_participants cp
      on cp.chat_id = m.chat_id
    where m.id = message_reactions.message_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "message_reactions_insert_self" on public.message_reactions;
create policy "message_reactions_insert_self"
on public.message_reactions
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.messages m
    join public.chat_participants cp
      on cp.chat_id = m.chat_id
    where m.id = message_reactions.message_id
      and cp.user_id = auth.uid()
  )
);

drop policy if exists "message_reactions_delete_self" on public.message_reactions;
create policy "message_reactions_delete_self"
on public.message_reactions
for delete
using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end
$$;
