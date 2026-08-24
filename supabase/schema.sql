create extension if not exists pgcrypto;

create table if not exists public.health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  event_kind text not null check (event_kind in ('meal', 'symptom', 'bowel', 'tea', 'medication', 'water', 'weight', 'sleep', 'exercise', 'note')),
  event_time time not null,
  title text not null,
  detail text not null default '',
  badge text,
  tags text[] not null default '{}',
  foods text[] not null default '{}',
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists health_events_user_date_idx on public.health_events(user_id, event_date, event_time);

alter table public.health_events drop constraint if exists health_events_event_kind_check;
alter table public.health_events add constraint health_events_event_kind_check check (event_kind in ('meal', 'symptom', 'bowel', 'tea', 'medication', 'water', 'weight', 'sleep', 'exercise', 'note'));

alter table public.health_events enable row level security;

revoke all on table public.health_events from anon;
grant select, insert, update, delete on table public.health_events to authenticated;

drop policy if exists "Users can view their own health events" on public.health_events;
create policy "Users can view their own health events" on public.health_events for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own health events" on public.health_events;
create policy "Users can create their own health events" on public.health_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own health events" on public.health_events;
create policy "Users can update their own health events" on public.health_events for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own health events" on public.health_events;
create policy "Users can delete their own health events" on public.health_events for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_health_events_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists health_events_updated_at on public.health_events;
create trigger health_events_updated_at before update on public.health_events
for each row execute function public.set_health_events_updated_at();

-- Memória privada das análises diárias. Cada resumo pertence a um único usuário.
create table if not exists public.ai_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  summary text not null,
  model text not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_date)
);

alter table public.ai_daily_summaries enable row level security;
revoke all on table public.ai_daily_summaries from anon;
grant select, insert, update on table public.ai_daily_summaries to authenticated;

drop policy if exists "Users can view their own AI summaries" on public.ai_daily_summaries;
create policy "Users can view their own AI summaries" on public.ai_daily_summaries for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own AI summaries" on public.ai_daily_summaries;
create policy "Users can create their own AI summaries" on public.ai_daily_summaries for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own AI summaries" on public.ai_daily_summaries;
create policy "Users can update their own AI summaries" on public.ai_daily_summaries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Optional photo storage. Run this block after enabling Storage in the project.
insert into storage.buckets (id, name, public) values ('health-event-photos', 'health-event-photos', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own event photos" on storage.objects;
create policy "Users can upload their own event photos" on storage.objects for insert to authenticated
with check (bucket_id = 'health-event-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can view their own event photos" on storage.objects;
create policy "Users can view their own event photos" on storage.objects for select to authenticated
using (bucket_id = 'health-event-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

insert into storage.buckets (id, name, public) values ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own profile photo" on storage.objects;
create policy "Users can upload their own profile photo" on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));

drop policy if exists "Users can update their own profile photo" on storage.objects;
create policy "Users can update their own profile photo" on storage.objects for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'))
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));

drop policy if exists "Users can view their own profile photo" on storage.objects;
create policy "Users can view their own profile photo" on storage.objects for select to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));

-- Exames e documentos de saúde. Os arquivos permanecem privados e não são enviados à IA automaticamente.
create table if not exists public.medical_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exam_type text,
  exam_date date,
  storage_path text not null,
  mime_type text not null,
  size_bytes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists medical_documents_user_date_idx on public.medical_documents(user_id, exam_date desc, created_at desc);
alter table public.medical_documents enable row level security;
revoke all on table public.medical_documents from anon;
grant select, insert, delete on table public.medical_documents to authenticated;

drop policy if exists "Users can view their own medical documents" on public.medical_documents;
create policy "Users can view their own medical documents" on public.medical_documents for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their own medical documents" on public.medical_documents;
create policy "Users can create their own medical documents" on public.medical_documents for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own medical documents" on public.medical_documents;
create policy "Users can delete their own medical documents" on public.medical_documents for delete to authenticated
  using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public) values ('medical-exams', 'medical-exams', false)
on conflict (id) do nothing;
drop policy if exists "Users can upload their own medical documents" on storage.objects;
create policy "Users can upload their own medical documents" on storage.objects for insert to authenticated
with check (bucket_id = 'medical-exams' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));
drop policy if exists "Users can view their own medical documents" on storage.objects;
create policy "Users can view their own medical documents" on storage.objects for select to authenticated
using (bucket_id = 'medical-exams' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));
drop policy if exists "Users can delete their own medical documents" on storage.objects;
create policy "Users can delete their own medical documents" on storage.objects for delete to authenticated
using (bucket_id = 'medical-exams' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub'));
