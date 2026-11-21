-- Run in a dedicated Supabase project. Enable email/password sign-in.
create table if not exists public.admin_users(user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.site_settings(key text primary key,value text not null,updated_at timestamptz not null default now());
create table if not exists public.events(id uuid primary key default gen_random_uuid(),title text not null,description text,location text,starts_at timestamptz,registration_url text,image_url text,published boolean not null default false,updated_at timestamptz not null default now());
alter table public.admin_users enable row level security;
alter table public.site_settings enable row level security;
alter table public.events enable row level security;
create policy "Read own admin status" on public.admin_users for select to authenticated using(user_id=auth.uid());
create policy "Public read settings" on public.site_settings for select to anon,authenticated using(true);
create policy "Admin write settings" on public.site_settings for all to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid())) with check(exists(select 1 from public.admin_users where user_id=auth.uid()));
create policy "Public read published events" on public.events for select to anon using(published=true);
create policy "Admin read events" on public.events for select to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid()));
create policy "Admin write events" on public.events for all to authenticated using(exists(select 1 from public.admin_users where user_id=auth.uid())) with check(exists(select 1 from public.admin_users where user_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('site-media','site-media',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "Public read site media" on storage.objects for select to anon,authenticated using(bucket_id='site-media');
create policy "Admin upload site media" on storage.objects for insert to authenticated with check(bucket_id='site-media' and exists(select 1 from public.admin_users where user_id=auth.uid()));
-- Manually grant admin after creating user: insert into public.admin_users(user_id) values ('USER-UUID');
