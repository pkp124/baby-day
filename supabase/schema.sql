-- Baby Day schema. Run in the Supabase SQL editor as a project owner.
-- Enable Email and (optionally) Google providers in Auth before using the app.

create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key,
  created_at timestamptz not null default now(),
  name text not null default 'Our family',
  timezone text not null default 'UTC',
  care_day_start_hour int not null default 5 check (care_day_start_hour between 0 and 23)
);

create table if not exists public.babies (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  date_of_birth date,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists family_members_family_id_idx on public.family_members (family_id);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references public.family_members(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  baby_id uuid not null references public.babies(id) on delete cascade,
  member_id uuid not null references public.family_members(id),
  member_name text not null default '',
  type text not null check (type in ('feed', 'pump', 'diaper', 'sleep', 'weight', 'note')),
  time timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  rev int not null default 1,
  deleted_at timestamptz,
  data jsonb not null default '{}'::jsonb
);

create index if not exists events_family_time_idx on public.events (family_id, time desc);
create index if not exists events_family_updated_idx on public.events (family_id, updated_at);

alter table public.families enable row level security;
alter table public.babies enable row level security;
alter table public.family_members enable row level security;
alter table public.invites enable row level security;
alter table public.events enable row level security;

create or replace function public.my_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.family_members where user_id = auth.uid();
$$;

create or replace function public.my_family()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  existing public.family_members%rowtype;
  baby public.babies%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into existing from public.family_members where user_id = auth.uid();
  if not found then
    return null;
  end if;
  select * into baby from public.babies where family_id = existing.family_id order by created_at asc limit 1;
  return json_build_object(
    'family_id', existing.family_id,
    'baby_id', baby.id,
    'member_id', existing.id
  );
end;
$$;

create or replace function public.ensure_family(
  p_family_id uuid,
  p_baby_id uuid,
  p_member_id uuid,
  p_display_name text,
  p_baby_name text,
  p_timezone text,
  p_care_day_start_hour int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.family_members%rowtype;
  baby public.babies%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into existing from public.family_members where user_id = auth.uid();
  if found then
    select * into baby from public.babies where family_id = existing.family_id order by created_at asc limit 1;
    update public.family_members
      set display_name = coalesce(nullif(p_display_name, ''), display_name)
      where id = existing.id;
    return json_build_object(
      'family_id', existing.family_id,
      'baby_id', baby.id,
      'member_id', existing.id
    );
  end if;

  insert into public.families (id, timezone, care_day_start_hour)
    values (p_family_id, coalesce(nullif(p_timezone, ''), 'UTC'), coalesce(p_care_day_start_hour, 5));
  insert into public.babies (id, family_id, name)
    values (p_baby_id, p_family_id, coalesce(nullif(p_baby_name, ''), 'Baby'));
  insert into public.family_members (id, family_id, user_id, display_name)
    values (p_member_id, p_family_id, auth.uid(), coalesce(nullif(p_display_name, ''), 'Parent'));

  return json_build_object(
    'family_id', p_family_id,
    'baby_id', p_baby_id,
    'member_id', p_member_id
  );
end;
$$;

create or replace function public.create_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.family_members%rowtype;
  token text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into member from public.family_members where user_id = auth.uid();
  if not found then
    raise exception 'join or create a family first';
  end if;
  token := substr(encode(gen_random_bytes(6), 'hex'), 1, 10);
  insert into public.invites (family_id, created_by, token_hash, expires_at)
    values (member.family_id, member.id, encode(digest(token, 'sha256'), 'hex'), now() + interval '7 days');
  return token;
end;
$$;

create or replace function public.accept_invite(p_token text, p_display_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invites%rowtype;
  baby public.babies%rowtype;
  new_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'already in a family';
  end if;

  select * into invite
    from public.invites
    where token_hash = encode(digest(p_token, 'sha256'), 'hex')
      and used_at is null
      and expires_at > now();
  if not found then
    raise exception 'invite is invalid or expired';
  end if;

  select * into baby from public.babies where family_id = invite.family_id order by created_at asc limit 1;
  new_member_id := gen_random_uuid();
  insert into public.family_members (id, family_id, user_id, display_name)
    values (new_member_id, invite.family_id, auth.uid(), coalesce(nullif(p_display_name, ''), 'Parent'));
  update public.invites set used_at = now() where id = invite.id;

  return json_build_object(
    'family_id', invite.family_id,
    'baby_id', baby.id,
    'member_id', new_member_id
  );
end;
$$;

drop policy if exists families_select on public.families;
create policy families_select on public.families
  for select using (id in (select public.my_family_ids()));

drop policy if exists babies_select on public.babies;
create policy babies_select on public.babies
  for select using (family_id in (select public.my_family_ids()));

drop policy if exists members_select on public.family_members;
create policy members_select on public.family_members
  for select using (family_id in (select public.my_family_ids()));

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select using (family_id in (select public.my_family_ids()));

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert with check (family_id in (select public.my_family_ids()));

drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update using (family_id in (select public.my_family_ids()));

grant usage on schema public to authenticated;
grant select on public.families, public.babies, public.family_members to authenticated;
grant select, insert, update on public.events to authenticated;
grant execute on function public.ensure_family(uuid, uuid, uuid, text, text, text, int) to authenticated;
grant execute on function public.create_invite() to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.my_family_ids() to authenticated;
grant execute on function public.my_family() to authenticated;

alter table public.events replica identity full;
do $$
begin
  begin
    alter publication supabase_realtime add table public.events;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
