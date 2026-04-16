create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  country text,
  preferred_language text,
  avatar_url text,
  profile_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_unique unique (email)
);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')) default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint friendships_unique_pair unique (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  chat_type text not null check (chat_type in ('direct', 'group')) default 'direct',
  title text,
  avatar_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chat_participants (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  last_read_message_id uuid,
  is_muted boolean not null default false,
  unique (chat_id, profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  original_text text not null,
  original_language text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.message_translations (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  target_language text not null,
  translated_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, target_user_id, target_language)
);

alter table public.chat_participants
drop constraint if exists chat_participants_last_read_message_id_fkey;

alter table public.chat_participants
add constraint chat_participants_last_read_message_id_fkey
foreign key (last_read_message_id) references public.messages(id) on delete set null;

create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_friendships_requester on public.friendships(requester_id);
create index if not exists idx_friendships_addressee on public.friendships(addressee_id);
create index if not exists idx_friendships_status on public.friendships(status);
create index if not exists idx_chat_participants_profile on public.chat_participants(profile_id);
create index if not exists idx_chat_participants_chat on public.chat_participants(chat_id);
create index if not exists idx_messages_chat_created_at on public.messages(chat_id, created_at desc);
create index if not exists idx_messages_sender_created_at on public.messages(sender_id, created_at desc);
create index if not exists idx_message_translations_message_user on public.message_translations(message_id, target_user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    preferred_language,
    avatar_url,
    profile_completed
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', null),
    coalesce(new.raw_user_meta_data ->> 'preferred_language', null),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null),
    coalesce((new.raw_user_meta_data ->> 'profile_completed')::boolean, false)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    preferred_language = coalesce(excluded.preferred_language, public.profiles.preferred_language),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute procedure public.set_updated_at();

drop trigger if exists chats_set_updated_at on public.chats;
create trigger chats_set_updated_at
  before update on public.chats
  for each row execute procedure public.set_updated_at();

create or replace function public.touch_chat_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.chats
  set updated_at = timezone('utc', now())
  where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_chat_updated_at on public.messages;
create trigger messages_touch_chat_updated_at
  after insert on public.messages
  for each row execute procedure public.touch_chat_updated_at();

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.chats enable row level security;
alter table public.chat_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_translations enable row level security;

drop policy if exists "profiles_select_own_or_connected" on public.profiles;
create policy "profiles_select_own_or_connected"
on public.profiles
for select
using (
  id = auth.uid()
  or exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = profiles.id)
        or (f.addressee_id = auth.uid() and f.requester_id = profiles.id)
      )
  )
);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own"
on public.friendships
for select
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "friendships_insert_requester" on public.friendships;
create policy "friendships_insert_requester"
on public.friendships
for insert
with check (requester_id = auth.uid());

drop policy if exists "friendships_update_participants" on public.friendships;
create policy "friendships_update_participants"
on public.friendships
for update
using (requester_id = auth.uid() or addressee_id = auth.uid())
with check (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "chats_select_members" on public.chats;
create policy "chats_select_members"
on public.chats
for select
using (
  exists (
    select 1
    from public.chat_participants cp
    where cp.chat_id = chats.id
      and cp.profile_id = auth.uid()
  )
);

drop policy if exists "chats_insert_creator" on public.chats;
create policy "chats_insert_creator"
on public.chats
for insert
with check (created_by = auth.uid() or created_by is null);

drop policy if exists "chat_participants_select_members" on public.chat_participants;
create policy "chat_participants_select_members"
on public.chat_participants
for select
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.chat_participants self_cp
    where self_cp.chat_id = chat_participants.chat_id
      and self_cp.profile_id = auth.uid()
  )
);

drop policy if exists "chat_participants_insert_membership" on public.chat_participants;
create policy "chat_participants_insert_membership"
on public.chat_participants
for insert
with check (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.chats c
    where c.id = chat_participants.chat_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists "chat_participants_update_self" on public.chat_participants;
create policy "chat_participants_update_self"
on public.chat_participants
for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "messages_select_members" on public.messages;
create policy "messages_select_members"
on public.messages
for select
using (
  exists (
    select 1
    from public.chat_participants cp
    where cp.chat_id = messages.chat_id
      and cp.profile_id = auth.uid()
  )
);

drop policy if exists "messages_insert_members" on public.messages;
create policy "messages_insert_members"
on public.messages
for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.chat_participants cp
    where cp.chat_id = messages.chat_id
      and cp.profile_id = auth.uid()
  )
);

drop policy if exists "message_translations_select_target_or_sender" on public.message_translations;
create policy "message_translations_select_target_or_sender"
on public.message_translations
for select
using (
  target_user_id = auth.uid()
  or exists (
    select 1
    from public.messages m
    where m.id = message_translations.message_id
      and m.sender_id = auth.uid()
  )
);

drop policy if exists "message_translations_insert_target_member" on public.message_translations;
create policy "message_translations_insert_target_member"
on public.message_translations
for insert
with check (
  exists (
    select 1
    from public.messages m
    join public.chat_participants cp
      on cp.chat_id = m.chat_id
    where m.id = message_translations.message_id
      and cp.profile_id = auth.uid()
      and message_translations.target_user_id <> auth.uid()
  )
);

alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.chat_participants;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_translations;
