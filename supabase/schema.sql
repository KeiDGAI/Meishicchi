-- Schema for KajiApp

create extension if not exists pgcrypto;

-- Helpers
create or replace function public.generate_invite_code()
returns text
language sql
as $$
  select upper(
    replace(
      replace(encode(gen_random_bytes(5), 'base64'), '/', ''),
      '+',
      ''
    )
  );
$$;

create or replace function public.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select family_id from public.users where id = auth.uid();
$$;

-- Core tables
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_by uuid references auth.users(id) on delete set null,
  invite_code text unique not null default public.generate_invite_code(),
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  display_name text not null,
  current_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists public.chore_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  points integer not null check (points >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chore_completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  task_id uuid not null references public.chore_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null check (points >= 0),
  completed_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  cost_points integer not null check (cost_points >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points_spent integer not null check (points_spent >= 0),
  comment text,
  redeemed_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);

create index if not exists idx_users_family on public.users (family_id);
create index if not exists idx_categories_family on public.categories (family_id);
create index if not exists idx_tasks_family on public.chore_tasks (family_id);
create index if not exists idx_completions_family on public.chore_completions (family_id);
create index if not exists idx_rewards_family on public.rewards (family_id);
create index if not exists idx_redemptions_family on public.reward_redemptions (family_id);
create index if not exists idx_notifications_user on public.notifications (user_id, is_read);
create index if not exists idx_completions_user_completed
  on public.chore_completions (user_id, completed_at desc);
create index if not exists idx_redemptions_user_redeemed
  on public.reward_redemptions (user_id, redeemed_at desc);

-- RLS
alter table public.families enable row level security;
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.chore_tasks enable row level security;
alter table public.chore_completions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.notifications enable row level security;

-- Families
create policy "families_select"
on public.families for select
using (id = public.current_family_id() or created_by = auth.uid());

create policy "families_select_all"
on public.families for select
to authenticated
using (auth.role() = 'authenticated');

create policy "families_insert"
on public.families for insert
to authenticated
with check (auth.role() = 'authenticated');

create policy "families_update"
on public.families for update
using (id = public.current_family_id());

-- Users
create policy "users_select_family"
on public.users for select
using (family_id = public.current_family_id());

create policy "users_select_self"
on public.users for select
using (id = auth.uid());

create policy "users_insert_self"
on public.users for insert
with check (id = auth.uid());

create policy "users_update_self"
on public.users for update
using (id = auth.uid());

-- Categories
create policy "categories_family"
on public.categories for all
using (family_id = public.current_family_id())
with check (family_id = public.current_family_id());

-- Tasks
create policy "tasks_family"
on public.chore_tasks for all
using (family_id = public.current_family_id())
with check (family_id = public.current_family_id());

-- Completions
create policy "completions_family"
on public.chore_completions for all
using (family_id = public.current_family_id())
with check (
  family_id = public.current_family_id()
  and user_id = auth.uid()
);

-- Rewards
create policy "rewards_family"
on public.rewards for all
using (family_id = public.current_family_id())
with check (family_id = public.current_family_id());

-- Redemptions
create policy "redemptions_family"
on public.reward_redemptions for all
using (family_id = public.current_family_id())
with check (
  family_id = public.current_family_id()
  and user_id = auth.uid()
);

-- Notifications
create policy "notifications_select_self"
on public.notifications for select
using (user_id = auth.uid());

create policy "notifications_insert_family"
on public.notifications for insert
with check (family_id = public.current_family_id());

create policy "notifications_update_self"
on public.notifications for update
using (user_id = auth.uid());

-- RPC: record chore completion and update points atomically
create or replace function public.record_chore_completion(
  task_id_input uuid,
  family_id_input uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_points integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if public.current_family_id() is distinct from family_id_input then
    raise exception 'invalid family';
  end if;

  select points into v_points
  from public.chore_tasks
  where id = task_id_input
    and family_id = family_id_input
    and is_active = true;

  if v_points is null then
    raise exception 'task not found';
  end if;

  insert into public.chore_completions (family_id, task_id, user_id, points)
  values (family_id_input, task_id_input, v_user_id, v_points);

  update public.users
  set current_points = current_points + v_points
  where id = v_user_id;

  return v_points;
end;
$$;

revoke all on function public.record_chore_completion(uuid, uuid) from public;
grant execute on function public.record_chore_completion(uuid, uuid) to authenticated;

-- RPC: delete completion and roll back points
create or replace function public.delete_chore_completion(
  completion_id_input uuid
)
returns integer
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_points integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select points into v_points
  from public.chore_completions
  where id = completion_id_input
    and user_id = v_user_id;

  if v_points is null then
    raise exception 'completion not found';
  end if;

  delete from public.chore_completions
  where id = completion_id_input
    and user_id = v_user_id;

  update public.users
  set current_points = current_points - v_points
  where id = v_user_id;

  return v_points;
end;
$$;

revoke all on function public.delete_chore_completion(uuid) from public;
grant execute on function public.delete_chore_completion(uuid) to authenticated;

-- RPC: redeem reward and update points + notify
create or replace function public.redeem_reward(
  reward_id_input uuid,
  family_id_input uuid,
  comment_input text
)
returns void
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_cost integer;
  v_reward_name text;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if public.current_family_id() is distinct from family_id_input then
    raise exception 'invalid family';
  end if;

  select cost_points, name into v_cost, v_reward_name
  from public.rewards
  where id = reward_id_input
    and family_id = family_id_input;

  if v_cost is null then
    raise exception 'reward not found';
  end if;

  if (select current_points from public.users where id = v_user_id) < v_cost then
    raise exception 'insufficient points';
  end if;

  insert into public.reward_redemptions (
    family_id, reward_id, user_id, points_spent, comment
  ) values (
    family_id_input, reward_id_input, v_user_id, v_cost, comment_input
  );

  update public.users
  set current_points = current_points - v_cost
  where id = v_user_id;

  select display_name into v_display_name
  from public.users
  where id = v_user_id;

  insert into public.notifications (family_id, user_id, message)
  select
    family_id_input,
    u.id,
    coalesce(v_display_name, '誰か') || 'が' || v_reward_name || 'をご褒美を交換しました'
  from public.users u
  where u.family_id = family_id_input;
end;
$$;

revoke all on function public.redeem_reward(uuid, uuid, text) from public;
grant execute on function public.redeem_reward(uuid, uuid, text) to authenticated;

-- Seed data (run after creating a family)
-- Replace :family_id with the family uuid.
-- 1) Categories
-- insert into public.categories (family_id, name) values
-- (:family_id, '料理'),
-- (:family_id, '洗濯'),
-- (:family_id, '掃除'),
-- (:family_id, 'その他家事'),
-- (:family_id, '子守');
--
-- 2) Tasks (replace :category_id_* with ids from categories)
-- insert into public.chore_tasks (family_id, category_id, name, points) values
-- (:family_id, :category_id_cooking, '家族のごはん', 100),
-- (:family_id, :category_id_cooking, '1人分皿洗い', 20),
-- (:family_id, :category_id_cooking, '炊飯', 20),
-- (:family_id, :category_id_cooking, '離乳食つくり1品', 100),
-- (:family_id, :category_id_cooking, '料理器具洗い', 20),
-- (:family_id, :category_id_cooking, '炊飯器セット洗い', 20),
-- (:family_id, :category_id_cooking, 'ご飯冷凍', 20),
-- (:family_id, :category_id_cooking, 'ナッツ瓶補充', 10),
-- (:family_id, :category_id_cooking, 'デザート作り', 100),
-- (:family_id, :category_id_cooking, 'お米米びつ入れ', 10),
-- (:family_id, :category_id_cooking, 'お皿片付け', 20),
-- (:family_id, :category_id_cooking, '配膳', 20),
-- (:family_id, :category_id_cooking, 'ディスポーザー処理', 10),
-- (:family_id, :category_id_cooking, '離乳食準備', 50),
-- (:family_id, :category_id_cooking, '離乳食をあげる', 50),
-- (:family_id, :category_id_laundry, '洗濯洗い', 50),
-- (:family_id, :category_id_laundry, '洗濯干し', 50),
-- (:family_id, :category_id_laundry, '洗濯取り込み', 30),
-- (:family_id, :category_id_laundry, '特殊洗い', 300),
-- (:family_id, :category_id_laundry, 'たたみ', 30),
-- (:family_id, :category_id_laundry, 'ベビーベット洗い', 100),
-- (:family_id, :category_id_laundry, '布団干し', 500),
-- (:family_id, :category_id_cleaning, '風呂掃除', 20),
-- (:family_id, :category_id_cleaning, 'ごみ捨て', 20),
-- (:family_id, :category_id_cleaning, 'トイレ便器掃除', 100),
-- (:family_id, :category_id_cleaning, 'トイレ床掃除', 50),
-- (:family_id, :category_id_cleaning, 'コロコロ', 10),
-- (:family_id, :category_id_cleaning, '掃除機充電', 10),
-- (:family_id, :category_id_cleaning, '部屋全体掃除', 100),
-- (:family_id, :category_id_cleaning, '掃除機掃除', 50),
-- (:family_id, :category_id_cleaning, 'ディスポーザー洗', 300),
-- (:family_id, :category_id_other, '加湿器水入れ', 10),
-- (:family_id, :category_id_other, 'パキラ水やり', 10),
-- (:family_id, :category_id_other, '夜の戸締まり', 10),
-- (:family_id, :category_id_other, 'ポスト確認', 10),
-- (:family_id, :category_id_other, '洗剤詰め替え', 10),
-- (:family_id, :category_id_childcare, '授乳', 50),
-- (:family_id, :category_id_childcare, 'オムツ変え', 20),
-- (:family_id, :category_id_childcare, 'ウンチ変え', 50),
-- (:family_id, :category_id_childcare, '沐浴', 50),
-- (:family_id, :category_id_childcare, 'ミルク', 50),
-- (:family_id, :category_id_childcare, '沐浴後ケア', 50),
-- (:family_id, :category_id_childcare, 'お湯作り', 20);
