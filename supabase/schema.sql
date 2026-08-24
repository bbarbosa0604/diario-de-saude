create extension if not exists pgcrypto;

create table if not exists public.health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  event_kind text not null check (event_kind in ('meal', 'symptom', 'bowel', 'medication', 'water', 'weight', 'sleep', 'exercise', 'note')),
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
