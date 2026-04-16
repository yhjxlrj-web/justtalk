alter table public.messages
add column if not exists message_kind text not null default 'text',
add column if not exists attachment_url text,
add column if not exists attachment_name text,
add column if not exists attachment_content_type text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_message_kind_check'
  ) then
    alter table public.messages
    add constraint messages_message_kind_check
    check (message_kind in ('text', 'image'));
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;
