-- KHALED HANY Digital Identity Platform
-- Apply through Supabase SQL Editor or `supabase db push`.
-- Never commit service_role keys or real user credentials.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin
  create type public.app_role as enum ('registered_user','editor','administrator','owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_status as enum ('draft','review','published','archived');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  preferred_language text not null default 'ar' check (preferred_language in ('ar','en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'registered_user',
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Database invariant: one and only one primary owner row can exist.
create unique index if not exists user_roles_single_owner on public.user_roles ((role)) where role = 'owner';

create table if not exists public.role_permissions (
  role public.app_role not null,
  permission_key text not null,
  primary key (role, permission_key)
);
insert into public.role_permissions(role,permission_key) values
 ('registered_user','profile.read_own'),('registered_user','profile.update_own'),
 ('editor','profile.read_own'),('editor','profile.update_own'),('editor','content.read'),('editor','content.create'),('editor','content.update'),('editor','media.manage'),
 ('administrator','profile.read_own'),('administrator','profile.update_own'),('administrator','content.read'),('administrator','content.create'),('administrator','content.update'),('administrator','content.delete'),('administrator','messages.manage'),('administrator','users.moderate'),('administrator','reports.read'),
 ('owner','*')
on conflict do nothing;

create table if not exists public.site_sections (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_-]{1,48}$'),
  title_ar text not null default '', title_en text not null default '',
  description_ar text not null default '', description_en text not null default '',
  body_ar text not null default '', body_en text not null default '',
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null, title_en text not null,
  summary_ar text not null default '', summary_en text not null default '',
  category text not null default 'other' check (category in ('ai','web','tools','other')),
  image_url text, image_alt text not null default '',
  live_url text, github_url text,
  status public.content_status not null default 'draft',
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint project_live_url_https check (live_url is null or live_url ~ '^https?://'),
  constraint project_github_url_https check (github_url is null or github_url ~ '^https?://')
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='projects_published_matches_status' and conrelid='public.projects'::regclass) then
    alter table public.projects add constraint projects_published_matches_status check (published = (status = 'published'));
  end if;
end $$;
create index if not exists projects_public_order on public.projects(published,sort_order) where published;

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null default 'article' check (item_type in ('video','article','resource','social')),
  title_ar text not null, title_en text not null,
  description_ar text not null default '', description_en text not null default '',
  url text not null check (url ~ '^https?://'),
  image_url text, creator_label text not null default '',
  published boolean not null default false,
  status public.content_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.content_items add column if not exists status public.content_status not null default 'draft';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='content_items_published_matches_status' and conrelid='public.content_items'::regclass) then
    alter table public.content_items add constraint content_items_published_matches_status check (published = (status = 'published'));
  end if;
end $$;
create index if not exists content_items_public_order on public.content_items(published,sort_order) where published;

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null, name_en text not null,
  category text not null default 'interest',
  description_ar text not null default '', description_en text not null default '',
  sort_order integer not null default 0, is_visible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.education_entries (
  id uuid primary key default gen_random_uuid(),
  institution_ar text not null, institution_en text not null,
  program_ar text not null, program_en text not null,
  detail_ar text not null default '', detail_en text not null default '',
  start_date date, end_date date, is_current boolean not null default false,
  sort_order integer not null default 0, is_visible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.journey_milestones (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null, title_en text not null,
  description_ar text not null default '', description_en text not null default '',
  milestone_date date, tag text, sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.personal_goals (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null, title_en text not null,
  description_ar text not null default '', description_en text not null default '',
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'active' check (status in ('active','done','paused')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.site_settings (
  setting_key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text, mime_type text, file_size bigint check (file_size is null or file_size >= 0),
  storage_path text,
  public_url text,
  provider text not null default 'upload',
  provider_asset_id text,
  source_url text,
  creator text,
  license text,
  attribution text,
  asset_kind text not null default 'image' check (asset_kind in ('image','3D model','HDRI','texture','video','font','other')),
  alt_text text not null default '', metadata jsonb not null default '{}'::jsonb,
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint media_source_https check (source_url is null or source_url ~ '^https?://'),
  constraint media_public_https check (public_url is null or public_url ~ '^https?://')
);
create index if not exists media_assets_created on public.media_assets(created_at desc);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email citext not null,
  message text not null check (char_length(message) between 5 and 5000),
  status text not null default 'new' check (status in ('new','read','archived')),
  read_at timestamptz,
  email_notification_sent boolean not null default false,
  email_notification_error text,
  ip_digest text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created on public.contact_messages(created_at desc);
create index if not exists contact_messages_status on public.contact_messages(status,created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null, body text not null default '',
  kind text not null default 'info', is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_created on public.activity_logs(created_at desc);
create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  revision_number integer not null,
  content_snapshot jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(table_name,record_id,revision_number)
);
create unique index if not exists content_revisions_unique_number on public.content_revisions(table_name,record_id,revision_number);
create index if not exists content_revisions_lookup on public.content_revisions(table_name,record_id,revision_number desc);

create table if not exists public.contact_rate_limits (
  ip_digest text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','site_sections','projects','content_items','skills','education_entries','journey_milestones','personal_goals','site_settings','media_assets'] loop
   execute format('drop trigger if exists set_updated_at on public.%I',t);
   execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
 end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'name','')) on conflict(id) do nothing;
 insert into public.user_roles(user_id,role) values(new.id,'registered_user') on conflict(user_id) do nothing;
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.has_role(required_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.user_roles where user_id=auth.uid() and role=required_role);
$$;
create or replace function public.has_any_role(roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.user_roles where user_id=auth.uid() and role=any(roles));
$$;
create or replace function public.can_edit_content()
returns boolean language sql stable security definer set search_path = public as $$
 select public.has_any_role(array['editor','administrator','owner']::public.app_role[]);
$$;

create or replace function public.capture_content_revision()
returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid; rev integer; tbl text;
begin
 tbl := tg_table_name; rid := old.id;
 perform pg_advisory_xact_lock(hashtext(tbl), hashtext(rid::text));
 select coalesce(max(revision_number),0)+1 into rev from public.content_revisions where table_name=tbl and record_id=rid;
 insert into public.content_revisions(table_name,record_id,revision_number,content_snapshot,changed_by)
 values(tbl,rid,rev,to_jsonb(old),auth.uid());
 if tg_op='UPDATE' then new.updated_at=now(); return new; end if;
 return old;
end $$;
drop trigger if exists revisions_site_sections on public.site_sections;
create trigger revisions_site_sections before update on public.site_sections for each row execute function public.capture_content_revision();
drop trigger if exists revisions_projects on public.projects;
create trigger revisions_projects before update on public.projects for each row execute function public.capture_content_revision();
drop trigger if exists revisions_personal_goals on public.personal_goals;
create trigger revisions_personal_goals before update on public.personal_goals for each row execute function public.capture_content_revision();
drop trigger if exists revisions_content_items on public.content_items;
create trigger revisions_content_items before update on public.content_items for each row execute function public.capture_content_revision();
drop trigger if exists revisions_skills on public.skills;
create trigger revisions_skills before update on public.skills for each row execute function public.capture_content_revision();
drop trigger if exists revisions_education_entries on public.education_entries;
create trigger revisions_education_entries before update on public.education_entries for each row execute function public.capture_content_revision();
drop trigger if exists revisions_journey_milestones on public.journey_milestones;
create trigger revisions_journey_milestones before update on public.journey_milestones for each row execute function public.capture_content_revision();

create or replace function public.owner_set_role(target_user_id uuid,new_role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.has_role('owner') then raise exception 'Only the primary owner can assign roles.' using errcode='42501'; end if;
 if new_role='owner' then raise exception 'Use the separately verified ownership transfer procedure.'; end if;
 if target_user_id=auth.uid() then raise exception 'You cannot change your own role.'; end if;
 update public.user_roles set role=new_role,granted_by=auth.uid(),updated_at=now() where user_id=target_user_id;
 if not found then raise exception 'User role record not found.'; end if;
end $$;

create or replace function public.restore_content_revision(target_table text,target_record uuid,target_revision uuid)
returns void language plpgsql security definer set search_path = public as $$
declare snap jsonb;
begin
 if not public.has_any_role(array['administrator','owner']::public.app_role[]) then raise exception 'Only administrators and owner can restore revisions.' using errcode='42501'; end if;
 select content_snapshot into snap from public.content_revisions where id=target_revision and table_name=target_table and record_id=target_record;
 if snap is null then raise exception 'Revision not found.'; end if;
 if target_table='site_sections' then
   update public.site_sections set key=snap->>'key',title_ar=coalesce(snap->>'title_ar',''),title_en=coalesce(snap->>'title_en',''),description_ar=coalesce(snap->>'description_ar',''),description_en=coalesce(snap->>'description_en',''),body_ar=coalesce(snap->>'body_ar',''),body_en=coalesce(snap->>'body_en',''),is_visible=coalesce((snap->>'is_visible')::boolean,true),sort_order=coalesce((snap->>'sort_order')::integer,0),updated_by=auth.uid() where id=target_record;
 elsif target_table='projects' then
   update public.projects set title_ar=snap->>'title_ar',title_en=snap->>'title_en',summary_ar=coalesce(snap->>'summary_ar',''),summary_en=coalesce(snap->>'summary_en',''),category=coalesce(snap->>'category','other'),image_url=snap->>'image_url',image_alt=coalesce(snap->>'image_alt',''),live_url=snap->>'live_url',github_url=snap->>'github_url',published=coalesce((snap->>'published')::boolean,false),status=coalesce((snap->>'status')::public.content_status,'draft'),sort_order=coalesce((snap->>'sort_order')::integer,0),updated_by=auth.uid() where id=target_record;
 elsif target_table='personal_goals' then
   update public.personal_goals set title_ar=snap->>'title_ar',title_en=snap->>'title_en',description_ar=coalesce(snap->>'description_ar',''),description_en=coalesce(snap->>'description_en',''),priority=coalesce((snap->>'priority')::smallint,3),status=coalesce(snap->>'status','active'),sort_order=coalesce((snap->>'sort_order')::integer,0) where id=target_record;
 elsif target_table='content_items' then
   update public.content_items set item_type=coalesce(snap->>'item_type','article'),title_ar=snap->>'title_ar',title_en=snap->>'title_en',description_ar=coalesce(snap->>'description_ar',''),description_en=coalesce(snap->>'description_en',''),url=snap->>'url',image_url=snap->>'image_url',creator_label=coalesce(snap->>'creator_label',''),published=coalesce((snap->>'published')::boolean,false),status=coalesce((snap->>'status')::public.content_status,'draft'),sort_order=coalesce((snap->>'sort_order')::integer,0),updated_by=auth.uid() where id=target_record;
 elsif target_table='skills' then
   update public.skills set name_ar=snap->>'name_ar',name_en=snap->>'name_en',category=coalesce(snap->>'category','interest'),description_ar=coalesce(snap->>'description_ar',''),description_en=coalesce(snap->>'description_en',''),sort_order=coalesce((snap->>'sort_order')::integer,0),is_visible=coalesce((snap->>'is_visible')::boolean,true) where id=target_record;
 elsif target_table='education_entries' then
   update public.education_entries set institution_ar=snap->>'institution_ar',institution_en=snap->>'institution_en',program_ar=snap->>'program_ar',program_en=snap->>'program_en',detail_ar=coalesce(snap->>'detail_ar',''),detail_en=coalesce(snap->>'detail_en',''),start_date=nullif(snap->>'start_date','')::date,end_date=nullif(snap->>'end_date','')::date,is_current=coalesce((snap->>'is_current')::boolean,false),sort_order=coalesce((snap->>'sort_order')::integer,0),is_visible=coalesce((snap->>'is_visible')::boolean,true) where id=target_record;
 elsif target_table='journey_milestones' then
   update public.journey_milestones set title_ar=snap->>'title_ar',title_en=snap->>'title_en',description_ar=coalesce(snap->>'description_ar',''),description_en=coalesce(snap->>'description_en',''),milestone_date=nullif(snap->>'milestone_date','')::date,tag=snap->>'tag',sort_order=coalesce((snap->>'sort_order')::integer,0),is_visible=coalesce((snap->>'is_visible')::boolean,true) where id=target_record;
 else raise exception 'Revision restoration is not enabled for this content type.';
 end if;
 if not found then raise exception 'Target record not found.'; end if;
end $$;

-- Atomic contact rate-limit window. Edge Function calls this using service_role after hashing IP server-side.
create or replace function public.consume_contact_rate_limit(digest text, max_requests integer default 5, window_seconds integer default 3600)
returns boolean language plpgsql security definer set search_path = public as $$
declare allowed boolean;
begin
 insert into public.contact_rate_limits(ip_digest,window_started_at,request_count,updated_at)
 values(digest,now(),1,now())
 on conflict(ip_digest) do update set
   request_count=case when public.contact_rate_limits.window_started_at < now() - make_interval(secs=>window_seconds) then 1 else public.contact_rate_limits.request_count+1 end,
   window_started_at=case when public.contact_rate_limits.window_started_at < now() - make_interval(secs=>window_seconds) then now() else public.contact_rate_limits.window_started_at end,
   updated_at=now();
 select request_count<=max_requests into allowed from public.contact_rate_limits where ip_digest=digest;
 return coalesce(allowed,false);
end $$;

-- RLS is enabled on every table that contains account or owner-managed data.
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','role_permissions','site_sections','projects','skills','education_entries','journey_milestones','personal_goals','site_settings','media_assets','contact_messages','notifications','activity_logs','content_revisions','contact_rate_limits'] loop
   execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

-- Profiles: self-only; owner/admin may read all for administration.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id=auth.uid() or public.has_any_role(array['administrator','owner']::public.app_role[]));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
drop policy if exists profiles_owner_manage on public.profiles;
create policy profiles_owner_manage on public.profiles for all to authenticated using (public.has_role('owner')) with check (public.has_role('owner'));

-- Roles: user may read their own role, owner/admin may read all. Only the owner RPC changes roles.
drop policy if exists roles_read on public.user_roles;
create policy roles_read on public.user_roles for select to authenticated using (user_id=auth.uid() or public.has_any_role(array['administrator','owner']::public.app_role[]));
drop policy if exists roles_owner_update on public.user_roles;
drop policy if exists roles_owner_insert on public.user_roles;
drop policy if exists roles_owner_delete on public.user_roles;
-- No direct browser writes to user_roles. The owner RPC is the only client path
-- and the invite-user Edge Function performs service-role inserts after owner verification.

drop policy if exists role_permissions_read on public.role_permissions;
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);

-- Public content is readable only when published/visible. Editors may read their own drafts.
drop policy if exists sections_public_read on public.site_sections;
drop policy if exists sections_manage on public.site_sections;
drop policy if exists sections_insert on public.site_sections;
drop policy if exists sections_update on public.site_sections;
drop policy if exists sections_delete on public.site_sections;
create policy sections_public_read on public.site_sections for select to anon,authenticated
 using (is_visible or public.has_any_role(array['administrator','owner']::public.app_role[]));
create policy sections_admin_manage on public.site_sections for all to authenticated
 using (public.has_any_role(array['administrator','owner']::public.app_role[]))
 with check (public.has_any_role(array['administrator','owner']::public.app_role[]));

drop policy if exists projects_public_read on public.projects;
drop policy if exists projects_manage on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;
create policy projects_public_read on public.projects for select to anon,authenticated
 using (published or public.has_any_role(array['administrator','owner']::public.app_role[]) or (public.has_role('editor') and created_by=auth.uid()));
create policy projects_admin_manage on public.projects for all to authenticated
 using (public.has_any_role(array['administrator','owner']::public.app_role[]))
 with check (public.has_any_role(array['administrator','owner']::public.app_role[]));
create policy projects_editor_insert on public.projects for insert to authenticated
 with check (public.has_role('editor') and created_by=auth.uid() and published=false and status in ('draft','review'));
create policy projects_editor_update on public.projects for update to authenticated
 using (public.has_role('editor') and created_by=auth.uid() and published=false and status in ('draft','review'))
 with check (public.has_role('editor') and created_by=auth.uid() and published=false and status in ('draft','review'));

drop policy if exists content_items_public_read on public.content_items;
drop policy if exists content_items_insert on public.content_items;
drop policy if exists content_items_update on public.content_items;
drop policy if exists content_items_delete on public.content_items;
create policy content_items_public_read on public.content_items for select to anon,authenticated
 using (published or public.has_any_role(array['administrator','owner']::public.app_role[]) or (public.has_role('editor') and created_by=auth.uid()));
create policy content_items_admin_manage on public.content_items for all to authenticated
 using (public.has_any_role(array['administrator','owner']::public.app_role[]))
 with check (public.has_any_role(array['administrator','owner']::public.app_role[]));
create policy content_items_editor_insert on public.content_items for insert to authenticated
 with check (public.has_role('editor') and created_by=auth.uid() and published=false and status in ('draft','review'));
create policy content_items_editor_update on public.content_items for update to authenticated
 using (public.has_role('editor') and created_by=auth.uid() and published=false and status in ('draft','review'))
 with check (public.has_role('editor') and created_by=auth.uid() and published=false and status in ('draft','review'));

-- Global profile sections/education/skills/journey and goals are owner/admin-controlled.
do $$ declare t text; begin
 foreach t in array array['skills','education_entries','journey_milestones'] loop
   execute format('drop policy if exists %I on public.%I','public_read_'||t,t);
   execute format('drop policy if exists %I on public.%I','manage_'||t,t);
   execute format('drop policy if exists %I on public.%I','insert_'||t,t);
   execute format('drop policy if exists %I on public.%I','update_'||t,t);
   execute format('drop policy if exists %I on public.%I','delete_'||t,t);
   execute format('create policy %I on public.%I for select to anon,authenticated using (is_visible or public.has_any_role(array[''administrator'',''owner'']::public.app_role[]))','public_read_'||t,t);
   execute format('create policy %I on public.%I for all to authenticated using (public.has_any_role(array[''administrator'',''owner'']::public.app_role[])) with check (public.has_any_role(array[''administrator'',''owner'']::public.app_role[]))','admin_manage_'||t,t);
 end loop;
end $$;
drop policy if exists goals_public_read on public.personal_goals;
drop policy if exists goals_manage on public.personal_goals;
create policy goals_admin_read on public.personal_goals for select to authenticated
 using (public.has_any_role(array['administrator','owner']::public.app_role[]));
create policy goals_admin_manage on public.personal_goals for all to authenticated
 using (public.has_any_role(array['administrator','owner']::public.app_role[]))
 with check (public.has_any_role(array['administrator','owner']::public.app_role[]));

drop policy if exists settings_public_read on public.site_settings;
create policy settings_public_read on public.site_settings for select to anon,authenticated using (is_public or public.has_role('owner'));
drop policy if exists settings_owner_manage on public.site_settings;
create policy settings_owner_manage on public.site_settings for all to authenticated using (public.has_role('owner')) with check (public.has_role('owner'));

drop policy if exists media_read on public.media_assets;
drop policy if exists media_manage on public.media_assets;
create policy media_read on public.media_assets for select to authenticated
 using (public.has_any_role(array['administrator','owner']::public.app_role[]) or (public.has_role('editor') and imported_by=auth.uid()));
create policy media_admin_manage on public.media_assets for all to authenticated
 using (public.has_any_role(array['administrator','owner']::public.app_role[]))
 with check (public.has_any_role(array['administrator','owner']::public.app_role[]));
create policy media_editor_insert on public.media_assets for insert to authenticated
 with check (public.has_role('editor') and imported_by=auth.uid());
create policy media_editor_update on public.media_assets for update to authenticated
 using (public.has_role('editor') and imported_by=auth.uid())
 with check (public.has_role('editor') and imported_by=auth.uid());
create policy media_editor_delete on public.media_assets for delete to authenticated
 using (public.has_role('editor') and imported_by=auth.uid());

drop policy if exists messages_manage on public.contact_messages;
create policy messages_manage on public.contact_messages for all to authenticated
 using (public.has_any_role(array['administrator','owner']::public.app_role[]))
 with check (public.has_any_role(array['administrator','owner']::public.app_role[]));

drop policy if exists notifications_self on public.notifications;
create policy notifications_self on public.notifications for select to authenticated using (user_id=auth.uid() or public.has_role('owner'));
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists activity_owner_read on public.activity_logs;
drop policy if exists activity_admin_read on public.activity_logs;
create policy activity_admin_read on public.activity_logs for select to authenticated using (public.has_any_role(array['administrator','owner']::public.app_role[]));
drop policy if exists revisions_authorized_read on public.content_revisions;
create policy revisions_authorized_read on public.content_revisions for select to authenticated
 using (public.has_any_role(array['administrator','owner']::public.app_role[]));

-- No direct browser INSERT/UPDATE policy for contact_messages or rate limit records.
-- Contact Edge Function uses server-side service_role after validation and rate limiting.

-- Storage bucket: private write, public read for published site assets only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('site-media','site-media',true,52428800,array['image/png','image/jpeg','image/webp','model/gltf-binary','image/vnd.radiance','image/x-exr','image/ktx2'])
on conflict(id) do update set public=true,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists site_media_public_read on storage.objects;
create policy site_media_public_read on storage.objects for select to anon,authenticated using(bucket_id='site-media');
drop policy if exists site_media_editor_insert on storage.objects;
drop policy if exists site_media_editor_update on storage.objects;
drop policy if exists site_media_editor_delete on storage.objects;
drop policy if exists site_media_admin_insert on storage.objects;
drop policy if exists site_media_admin_update on storage.objects;
drop policy if exists site_media_admin_delete on storage.objects;
create policy site_media_editor_insert on storage.objects for insert to authenticated
 with check(bucket_id='site-media' and public.has_role('editor') and (storage.foldername(name))[1]=auth.uid()::text);
create policy site_media_editor_update on storage.objects for update to authenticated
 using(bucket_id='site-media' and public.has_role('editor') and (storage.foldername(name))[1]=auth.uid()::text)
 with check(bucket_id='site-media' and public.has_role('editor') and (storage.foldername(name))[1]=auth.uid()::text);
create policy site_media_editor_delete on storage.objects for delete to authenticated
 using(bucket_id='site-media' and public.has_role('editor') and (storage.foldername(name))[1]=auth.uid()::text);
create policy site_media_admin_insert on storage.objects for insert to authenticated
 with check(bucket_id='site-media' and public.has_any_role(array['administrator','owner']::public.app_role[]));
create policy site_media_admin_update on storage.objects for update to authenticated
 using(bucket_id='site-media' and public.has_any_role(array['administrator','owner']::public.app_role[]))
 with check(bucket_id='site-media' and public.has_any_role(array['administrator','owner']::public.app_role[]));
create policy site_media_admin_delete on storage.objects for delete to authenticated
 using(bucket_id='site-media' and public.has_any_role(array['administrator','owner']::public.app_role[]));

-- Anonymous callers may not read private operational tables. Keep function execution restricted.
revoke all on function public.owner_set_role(uuid,public.app_role) from public,anon;
grant execute on function public.owner_set_role(uuid,public.app_role) to authenticated;
revoke all on function public.restore_content_revision(text,uuid,uuid) from public,anon;
grant execute on function public.restore_content_revision(text,uuid,uuid) to authenticated;
revoke all on function public.consume_contact_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_contact_rate_limit(text,integer,integer) to service_role;

-- Default section records reflect content already present in the original uploaded website.
insert into public.site_sections(key,title_ar,title_en,description_ar,description_en,body_ar,body_en,sort_order,is_visible) values
('about','عنّي','About Me','وراء الاسم، حكاية بتتكوّن.','A story still in the making.','أنا طالب في مجال الذكاء الاصطناعي بالأزهر، ومهتم بالبرمجة وهندسة البرمجيات وصناعة المحتوى. أؤمن إن أفضل طريقة للتعلّم هي إنك تفهم الأساسيات، تطبّق بإيدك، وتشارك اللي بتتعلمه.','I am an Artificial Intelligence student at Al-Azhar, interested in programming, software engineering, and content creation. I believe the best way to learn is to understand the fundamentals, build with your own hands, and share what you discover.',10,true),
('education','الدراسة','Education','رحلة أكاديمية في الذكاء الاصطناعي.','An academic path in Artificial Intelligence.','جامعة الأزهر · الذكاء الاصطناعي · طالب','Al-Azhar University · Artificial Intelligence · Student',20,true),
('skills','المهارات والاهتمامات','Skills & Interests','مجالات أتعلمها وأطوّر نفسي فيها.','Areas I am learning and growing in.','البرمجة · الذكاء الاصطناعي · تطوير Backend · صناعة المحتوى','Programming · Artificial Intelligence · Backend Development · Content Creation',30,true),
('projects','المشاريع','Projects','مساحة للمشاريع الفعلية عند اكتمالها.','A space for real projects as they are completed.','لا توجد مشاريع منشورة حتى الآن.','No projects have been published yet.',40,true),
('content','المحتوى والإعلام','Content & Media','أفكار وتجارب في صناعة المحتوى.','Ideas and experiments in content creation.','لا توجد روابط موثّقة مضافة حتى الآن.','No verified content links have been added yet.',50,true),
('journey','رحلتي','My Journey','خطوات صغيرة في رحلة مستمرة.','Small steps in an ongoing journey.','البداية الأكاديمية · تأسيس مهارات البرمجة · بناء معرض الأعمال','Academic beginning · Programming fundamentals · Building a portfolio',60,true),
('now','أهدافي الحالية','Current Goals','ما أركز عليه في المرحلة الحالية.','What I am focusing on right now.','تقوية الأساسيات · التعلّم بالمشاريع · تطوير التواصل التقني','Strengthen fundamentals · Learn by building · Improve technical communication',70,true),
('contact','تواصل','Contact','يسعدني التواصل.','I would be glad to connect.','بيانات التواصل الحقيقية ستضاف بعد التحقق منها.','Verified contact details will be added when available.',80,true)
on conflict(key) do nothing;

insert into public.site_settings(setting_key,value,is_public) values
('site_brand','{"name_ar":"خالد هاني","name_en":"Khaled Hany","first_name_en":"Khaled","last_name_ar":"هاني","hero_ar":"طالب ذكاء اصطناعي، أبني معرفتي في البرمجة والتقنية، وأحوّل فضولي إلى تجارب ومشاريع لها معنى.","hero_en":"An Artificial Intelligence student building my knowledge in programming and technology, turning curiosity into meaningful experiments and projects."}'::jsonb,true),
('appearance','{"cyan":"#67e8f9","violet":"#a78bfa","background":"#070a12"}'::jsonb,true),
('three_scene','{"default_scene":"ai","particle_intensity":1}'::jsonb,true)
on conflict(setting_key) do nothing;

-- Database-generated audit events cannot be forged by a browser-side RPC call.
create or replace function public.audit_managed_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  before_row jsonb;
  after_row jsonb;
  actor uuid;
  record_key text;
  event_details jsonb;
begin
  if tg_op = 'INSERT' then
    after_row := to_jsonb(new);
    record_key := coalesce(after_row->>'id', after_row->>'user_id', after_row->>'setting_key');
    actor := auth.uid();
  elsif tg_op = 'UPDATE' then
    before_row := to_jsonb(old);
    after_row := to_jsonb(new);
    record_key := coalesce(after_row->>'id', after_row->>'user_id', after_row->>'setting_key');
    actor := auth.uid();
  else
    before_row := to_jsonb(old);
    record_key := coalesce(before_row->>'id', before_row->>'user_id', before_row->>'setting_key');
    actor := auth.uid();
  end if;

  if tg_table_name = 'user_roles' then
    actor := coalesce(actor, nullif(after_row->>'granted_by','')::uuid, nullif(before_row->>'granted_by','')::uuid);
    event_details := jsonb_build_object('user_id', record_key, 'role_before', before_row->>'role', 'role_after', after_row->>'role');
  elsif tg_table_name = 'site_settings' then
    event_details := jsonb_build_object('setting_key', coalesce(after_row->>'setting_key', before_row->>'setting_key'), 'is_public_before', before_row->>'is_public', 'is_public_after', after_row->>'is_public');
  else
    actor := coalesce(actor, nullif(after_row->>'updated_by','')::uuid, nullif(after_row->>'created_by','')::uuid, nullif(after_row->>'imported_by','')::uuid);
    event_details := jsonb_build_object('record_id', record_key, 'before', before_row, 'after', after_row);
  end if;

  insert into public.activity_logs(actor_id, action, details)
  values(actor, lower(tg_op) || '_' || tg_table_name, coalesce(event_details, '{}'::jsonb));
  return null;
end $$;

drop trigger if exists audit_site_sections on public.site_sections;
create trigger audit_site_sections after insert or update or delete on public.site_sections for each row execute function public.audit_managed_change();
drop trigger if exists audit_projects on public.projects;
create trigger audit_projects after insert or update or delete on public.projects for each row execute function public.audit_managed_change();
drop trigger if exists audit_content_items on public.content_items;
create trigger audit_content_items after insert or update or delete on public.content_items for each row execute function public.audit_managed_change();
drop trigger if exists audit_skills on public.skills;
create trigger audit_skills after insert or update or delete on public.skills for each row execute function public.audit_managed_change();
drop trigger if exists audit_education_entries on public.education_entries;
create trigger audit_education_entries after insert or update or delete on public.education_entries for each row execute function public.audit_managed_change();
drop trigger if exists audit_journey_milestones on public.journey_milestones;
create trigger audit_journey_milestones after insert or update or delete on public.journey_milestones for each row execute function public.audit_managed_change();
drop trigger if exists audit_personal_goals on public.personal_goals;
create trigger audit_personal_goals after insert or update or delete on public.personal_goals for each row execute function public.audit_managed_change();
drop trigger if exists audit_media_assets on public.media_assets;
create trigger audit_media_assets after insert or update or delete on public.media_assets for each row execute function public.audit_managed_change();
drop trigger if exists audit_site_settings on public.site_settings;
create trigger audit_site_settings after insert or update or delete on public.site_settings for each row execute function public.audit_managed_change();
drop trigger if exists audit_user_roles on public.user_roles;
create trigger audit_user_roles after insert or update or delete on public.user_roles for each row execute function public.audit_managed_change();

-- Primary owner setup is intentionally separated from the migration.
-- After creating and verifying the owner account, follow supabase/bootstrap/primary-owner.sql.
