create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint user_blocks_unique_pair unique (blocker_user_id, blocked_user_id),
  constraint user_blocks_no_self_block check (blocker_user_id <> blocked_user_id)
);

create index if not exists user_blocks_blocker_idx
  on public.user_blocks (blocker_user_id, created_at desc);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_user_id, created_at desc);
