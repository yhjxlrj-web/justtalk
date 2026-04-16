alter table public.chat_participants
add column if not exists preferred_language_snapshot text;

update public.chat_participants cp
set preferred_language_snapshot = p.preferred_language
from public.profiles p
where p.id = cp.user_id
  and cp.preferred_language_snapshot is null;

alter table public.messages
add column if not exists client_message_id text;

create unique index if not exists messages_sender_id_client_message_id_idx
on public.messages (sender_id, client_message_id)
where client_message_id is not null;
