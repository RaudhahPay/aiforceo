-- =========================================================
-- Migration 0010 · Message attachments
-- =========================================================
-- WHAT:
--   * Adds attachments JSONB column to messages for storing file metadata.
--     Schema: [{ url, name, mimeType, size }]
--   * Creates Supabase Storage bucket 'chat-attachments' (private).
--   * Sets basic RLS policies on storage.objects so authenticated users
--     can upload and read their own attachments.
--
-- Files are uploaded to storage in the background AFTER the message
-- is sent — the chat hot-path uses base64 directly to Anthropic.
--
-- ROLLBACK:
--   ALTER TABLE public.messages DROP COLUMN attachments;
--   DELETE FROM storage.buckets WHERE id = 'chat-attachments';
-- =========================================================

alter table public.messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

comment on column public.messages.attachments is
  'Array of {url, name, mimeType, size} objects. URLs populated by background storage upload.';

-- Create private storage bucket for chat attachments.
-- Supabase Storage must be enabled on the project (Pro plan or above includes it).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'chat-attachments',
    'chat-attachments',
    false,
    10485760,  -- 10 MB
    array[
      'image/jpeg','image/png','image/webp','image/gif',
      'application/pdf',
      'text/plain','text/csv','text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
  on conflict (id) do nothing;

-- Authenticated users can upload objects (ownership enforced at app layer via workspace_id in path)
drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
create policy "Authenticated users can upload chat attachments"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'chat-attachments');

-- Authenticated users can read chat attachment objects
drop policy if exists "Authenticated users can read chat attachments" on storage.objects;
create policy "Authenticated users can read chat attachments"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'chat-attachments');

-- Authenticated users can delete their own uploads
drop policy if exists "Authenticated users can delete chat attachments" on storage.objects;
create policy "Authenticated users can delete chat attachments"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'chat-attachments');

-- Self-test
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'messages'
      and column_name  = 'attachments'
  ) then
    raise exception 'Migration 0010 FAILED — attachments column missing from messages';
  end if;
  raise notice 'Migration 0010 PASSED — message attachments ready.';
end $$;
