create table if not exists public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users (id) on delete cascade,
  receiver_user_id uuid not null references auth.users (id) on delete cascade,
  sender_display_name text,
  sender_avatar_url text,
  type text not null check (type in ('heart')),
  created_at timestamptz not null default timezone('utc', now()),
  constraint community_notifications_unique_sender_receiver_type
    unique (sender_user_id, receiver_user_id, type)
);

create index if not exists community_notifications_receiver_created_at_idx
  on public.community_notifications (receiver_user_id, created_at desc);

alter table public.community_notifications enable row level security;

create policy "community_notifications_select_receiver"
  on public.community_notifications
  for select
  to authenticated
  using (receiver_user_id = auth.uid());
