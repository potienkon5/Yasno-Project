-- Ясно / Supabase. Выполнить в SQL Editor нового проекта.
create extension if not exists pgcrypto;
create table if not exists public.classes (
 code text primary key check (code ~ '^[A-Z2-9]{6}$'), name text not null,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 first_name text not null, last_name text not null, middle_name text default '',
 phone text not null, relation text not null, child_first text not null,
 child_last text not null, grade text not null, school text default '', city text default '',
 created_at timestamptz not null default now()
);
create table if not exists public.families (
 id uuid primary key default gen_random_uuid(), class_code text not null references public.classes(code) on delete cascade,
 invite_code text unique not null check (invite_code ~ '^[A-Z2-9]{8}$'),
 created_by uuid not null references auth.users(id)
);
create table if not exists public.members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 class_code text not null references public.classes(code) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 is_admin boolean not null default false, joined_at timestamptz not null default now()
);
create table if not exists public.class_items (
 id uuid primary key default gen_random_uuid(), class_code text not null references public.classes(code) on delete cascade,
 kind text not null check (kind in ('tasks','homework','funds')),
 payload jsonb not null default '{}'::jsonb,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists ix_class_items_class on public.class_items(class_code,kind);
create table if not exists public.push_subscriptions (
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null, subscription jsonb not null,
 updated_at timestamptz not null default now(), primary key(user_id,endpoint)
);

create or replace function public.is_class_member(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.members where user_id=auth.uid() and class_code=p_code)
$$;
create or replace function public.is_class_admin(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.members where user_id=auth.uid() and class_code=p_code and is_admin)
$$;

alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.class_items enable row level security;
alter table public.push_subscriptions enable row level security;

-- Все изменения таблиц, кроме собственного профиля и push-подписок, проходят через RPC.
create policy "classes_read" on public.classes for select to authenticated using (public.is_class_member(code));
create policy "profiles_read" on public.profiles for select to authenticated using (
 id=auth.uid() or exists(select 1 from public.members m where m.user_id=profiles.id and public.is_class_member(m.class_code))
);
create policy "profile_insert" on public.profiles for insert to authenticated with check (id=auth.uid());
create policy "profile_update" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy "families_read" on public.families for select to authenticated using (
 exists(select 1 from public.members m where m.family_id=families.id and m.user_id=auth.uid())
);
create policy "members_read" on public.members for select to authenticated using (public.is_class_member(class_code));
create policy "items_read" on public.class_items for select to authenticated using (public.is_class_member(class_code));
create policy "subscriptions_read" on public.push_subscriptions for select to authenticated using (user_id=auth.uid());
create policy "subscriptions_insert" on public.push_subscriptions for insert to authenticated with check (user_id=auth.uid());
create policy "subscriptions_update" on public.push_subscriptions for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "subscriptions_delete" on public.push_subscriptions for delete to authenticated using (user_id=auth.uid());

create or replace function public.make_code(p_len integer) returns text
language plpgsql volatile set search_path = '' as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; raw bytea; s text := ''; i integer;
begin
 if p_len not in (6,8) then raise exception 'Invalid length'; end if;
 raw := pg_catalog.gen_random_bytes(p_len);
 for i in 0..p_len-1 loop s:=s||substr(chars,(get_byte(raw,i)%length(chars))+1,1); end loop;
 return s;
end $$;

create or replace function public.create_class(p_grade text) returns text
language plpgsql security definer set search_path = '' as $$
declare code text; fcode text; fid uuid; i integer;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Fill profile first'; end if;
 if exists(select 1 from public.members where user_id=auth.uid()) then raise exception 'Already in class'; end if;
 if p_grade !~ '^[0-9]{1,2}[А-ЯA-Zа-яa-z]?$' then raise exception 'Invalid class'; end if;
 for i in 1..20 loop
  code:=public.make_code(6);
  exit when not exists(select 1 from public.classes where classes.code=create_class.code);
 end loop;
 insert into public.classes(code,name,created_by) values(code,upper(p_grade),auth.uid());
 for i in 1..20 loop
  fcode:=public.make_code(8);
  exit when not exists(select 1 from public.families where invite_code=fcode);
 end loop;
 insert into public.families(class_code,invite_code,created_by) values(code,fcode,auth.uid()) returning id into fid;
 insert into public.members(user_id,class_code,family_id,is_admin) values(auth.uid(),code,fid,true);
 return code;
end $$;

create or replace function public.join_class(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare fid uuid; fc text; i integer;
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Fill profile first'; end if;
 if exists(select 1 from public.members where user_id=auth.uid()) then raise exception 'Already in class'; end if;
 if not exists(select 1 from public.classes where code=upper(p_code)) then raise exception 'Class code not found'; end if;
 for i in 1..20 loop
  fc:=public.make_code(8); exit when not exists(select 1 from public.families where invite_code=fc);
 end loop;
 insert into public.families(class_code,invite_code,created_by) values(upper(p_code),fc,auth.uid()) returning id into fid;
 insert into public.members(user_id,class_code,family_id,is_admin) values(auth.uid(),upper(p_code),fid,false);
end $$;

create or replace function public.join_family(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare target record; me record; count_members integer;
begin
 select * into me from public.members where user_id=auth.uid() for update;
 if not found then raise exception 'Join a class first'; end if;
 select * into target from public.families where invite_code=upper(p_code) and class_code=me.class_code for update;
 if not found then raise exception 'Family not found in your class'; end if;
 select count(*) into count_members from public.members where family_id=target.id;
 if count_members>=3 then raise exception 'Family is full (3 accounts)'; end if;
 update public.members set family_id=target.id where user_id=auth.uid();
end $$;

create or replace function public.transfer_admin(p_new_admin uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare cc text;
begin
 select class_code into cc from public.members where user_id=auth.uid() and is_admin;
 if cc is null then raise exception 'Admin only'; end if;
 if not exists(select 1 from public.members where user_id=p_new_admin and class_code=cc) then raise exception 'User not in class'; end if;
 update public.members set is_admin=false where user_id=auth.uid();
 update public.members set is_admin=true where user_id=p_new_admin;
end $$;

create or replace function public.add_class_item(p_kind text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cc text; new_id uuid;
begin
 select class_code into cc from public.members where user_id=auth.uid();
 if cc is null then raise exception 'Join class first'; end if;
 if p_kind not in ('tasks','homework','funds') then raise exception 'Invalid type'; end if;
 if p_kind='funds' and not public.is_class_admin(cc) then raise exception 'Admin only'; end if;
 if length(coalesce(p_payload->>'title',p_payload->>'text','')) not between 1 and 2000 then raise exception 'Invalid content'; end if;
 if p_kind='funds' and (coalesce((p_payload->>'amount')::numeric,0)<=0 or (p_payload->>'amount')::numeric>1000000000) then raise exception 'Invalid amount'; end if;
 insert into public.class_items(class_code,kind,payload,created_by) values(cc,p_kind,p_payload||jsonb_build_object('by',auth.uid()),auth.uid()) returning id into new_id;
 return new_id;
end $$;

create or replace function public.change_class_item(p_id uuid,p_action text,p_value text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare x public.class_items%rowtype; m public.members%rowtype; family text; changed jsonb;
begin
 select * into m from public.members where user_id=auth.uid();
 if not found then raise exception 'Not a member'; end if;
 select * into x from public.class_items where id=p_id and class_code=m.class_code for update;
 if not found then raise exception 'Item not found'; end if;
 changed:=x.payload;
 if p_action='delete' then
  if not (m.is_admin or x.created_by=auth.uid()) then raise exception 'Not allowed'; end if;
  delete from public.class_items where id=p_id; return;
 elsif p_action='toggle_task' and x.kind='tasks' then
  changed:=jsonb_set(changed,'{done}',to_jsonb(not coalesce((changed->>'done')::boolean,false)));
 elsif p_action='take' and x.kind='tasks' then
  changed:=jsonb_set(changed,'{takenBy}',to_jsonb(left(coalesce(p_value,''),120)));
 elsif p_action='toggle_homework' and x.kind='homework' then
  family:=m.family_id::text;
  if (coalesce(changed->'doneBy','[]'::jsonb) ? family) then
   changed:=jsonb_set(changed,'{doneBy}',coalesce((select jsonb_agg(v) from jsonb_array_elements_text(changed->'doneBy') as v where v<>family),'[]'::jsonb));
  else
   changed:=jsonb_set(changed,'{doneBy}',coalesce(changed->'doneBy','[]'::jsonb)||to_jsonb(family));
  end if;
 elsif p_action in ('pay','unpay') and x.kind='funds' then
  family:=coalesce(nullif(p_value,''),m.family_id::text);
  if family<>m.family_id::text and not m.is_admin then raise exception 'Admin only'; end if;
  if not exists(select 1 from public.members where family_id::text=family and class_code=m.class_code) then raise exception 'Family outside class'; end if;
  if p_action='pay' then changed:=jsonb_set(changed,array['paid',family],'true'::jsonb,true);
  else changed:=jsonb_set(changed,'{paid}',coalesce(changed->'paid','{}'::jsonb)-family,true); end if;
 else raise exception 'Invalid action'; end if;
 update public.class_items set payload=changed where id=p_id;
end $$;

create or replace function public.leave_class() returns void
language plpgsql security definer set search_path = '' as $$
declare me public.members%rowtype; remaining integer;
begin
 select * into me from public.members where user_id=auth.uid();
 if not found then return; end if;
 if me.is_admin then
  select count(*) into remaining from public.members where class_code=me.class_code and user_id<>auth.uid();
  if remaining>0 then raise exception 'Transfer admin before leaving'; end if;
  delete from public.classes where code=me.class_code;
 else
  delete from public.members where user_id=auth.uid();
  delete from public.families where id=me.family_id and not exists(select 1 from public.members where family_id=me.family_id);
 end if;
end $$;

revoke all on function public.make_code(integer) from public,anon,authenticated;
grant execute on function public.create_class(text),public.join_class(text),public.join_family(text),public.transfer_admin(uuid),public.add_class_item(text,jsonb),public.change_class_item(uuid,text,text),public.leave_class() to authenticated;
-- Realtime: только участникам класса через RLS; публикация обновлений.
do $$ begin alter publication supabase_realtime add table public.class_items; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; end $$;
