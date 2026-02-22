-- Meishicchi: contact management + random evolution (v1)
-- ============================================================================

create extension if not exists pg_trgm;

create table if not exists public.business_cards (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  title text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_stats (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  lineage text check (
    lineage in ('ANIMAL', 'ANCIENT', 'SPIRIT', 'ARCHETYPE', 'DATA')
  ),
  stage smallint not null default 0 check (stage between 0 and 3),
  evolution_key text,
  card_count integer not null default 0 check (card_count >= 0),
  growth_points integer not null default 0 check (growth_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.growth_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  business_card_id uuid not null references public.business_cards(id) on delete cascade,
  event_type text not null default 'card_created' check (event_type = 'card_created'),
  points integer not null default 1 check (points > 0),
  created_at timestamptz not null default now(),
  unique (business_card_id)
);

create table if not exists public.evolution_rules (
  id uuid primary key default gen_random_uuid(),
  lineage text not null check (
    lineage in ('ANIMAL', 'ANCIENT', 'SPIRIT', 'ARCHETYPE', 'DATA')
  ),
  from_stage smallint not null check (from_stage between 0 and 2),
  to_stage smallint not null check (to_stage between 1 and 3),
  evolution_key text not null,
  display_name text not null,
  weight integer not null default 1 check (weight > 0),
  rule_type text not null default 'random' check (rule_type in ('random', 'condition')),
  condition_expression jsonb,
  created_at timestamptz not null default now(),
  unique (lineage, from_stage, to_stage, evolution_key)
);

create index if not exists idx_business_cards_owner_created
  on public.business_cards (owner_user_id, created_at desc);
create index if not exists idx_business_cards_name
  on public.business_cards using gin (name gin_trgm_ops);
create index if not exists idx_business_cards_company
  on public.business_cards using gin (company gin_trgm_ops);
create index if not exists idx_business_cards_email
  on public.business_cards using gin (email gin_trgm_ops);
create index if not exists idx_growth_events_owner_created
  on public.growth_events (owner_user_id, created_at desc);
create index if not exists idx_evolution_rules_path
  on public.evolution_rules (lineage, from_stage, to_stage, rule_type);

alter table public.business_cards enable row level security;
alter table public.pet_stats enable row level security;
alter table public.growth_events enable row level security;
alter table public.evolution_rules enable row level security;

drop policy if exists business_cards_owner on public.business_cards;
create policy business_cards_owner
on public.business_cards for all
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists pet_stats_owner_select on public.pet_stats;
create policy pet_stats_owner_select
on public.pet_stats for select
using (owner_user_id = auth.uid());

drop policy if exists pet_stats_owner_insert on public.pet_stats;
create policy pet_stats_owner_insert
on public.pet_stats for insert
with check (owner_user_id = auth.uid());

drop policy if exists pet_stats_owner_update on public.pet_stats;
create policy pet_stats_owner_update
on public.pet_stats for update
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists growth_events_owner_read on public.growth_events;
create policy growth_events_owner_read
on public.growth_events for select
using (owner_user_id = auth.uid());

drop policy if exists growth_events_owner_insert on public.growth_events;
create policy growth_events_owner_insert
on public.growth_events for insert
with check (owner_user_id = auth.uid());

drop policy if exists evolution_rules_read_all on public.evolution_rules;
create policy evolution_rules_read_all
on public.evolution_rules for select
to authenticated
using (true);

create or replace function public.compute_pet_stage(card_count_input integer)
returns smallint
language sql
immutable
as $$
  select case
    when card_count_input >= 25 then 3::smallint
    when card_count_input >= 10 then 2::smallint
    when card_count_input >= 3 then 1::smallint
    else 0::smallint
  end;
$$;

create or replace function public.next_evolution_threshold(stage_input smallint)
returns integer
language sql
immutable
as $$
  select case
    when stage_input <= 0 then 3
    when stage_input = 1 then 10
    when stage_input = 2 then 25
    else null
  end;
$$;

create or replace function public.pick_random_lineage()
returns text
language sql
volatile
as $$
  select (array['ANIMAL', 'ANCIENT', 'SPIRIT', 'ARCHETYPE', 'DATA'])[1 + floor(random() * 5)::int];
$$;

create or replace function public.pick_random_evolution(
  lineage_input text,
  from_stage_input smallint,
  to_stage_input smallint
)
returns text
language plpgsql
volatile
as $$
declare
  v_choice text;
begin
  with candidates as (
    select
      evolution_key,
      greatest(weight, 1)::double precision as w
    from public.evolution_rules
    where lineage = lineage_input
      and from_stage = from_stage_input
      and to_stage = to_stage_input
      and rule_type = 'random'
  )
  select c.evolution_key
  into v_choice
  from candidates c
  order by -ln(greatest(random(), 1e-9)) / c.w
  limit 1;

  if v_choice is null then
    return lower(lineage_input) || '_stage_' || to_stage_input::text;
  end if;

  return v_choice;
end;
$$;

drop function if exists public.advance_pet_on_card_created(uuid);
create or replace function public.advance_pet_on_card_created(
  card_id_input uuid
)
returns table(
  lineage text,
  stage smallint,
  evolution_key text,
  card_count integer,
  next_evolution_at integer
)
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
  v_card_owner uuid;
  v_event_id uuid;
  v_current_stage smallint;
  v_target_stage smallint;
  v_lineage text;
  v_evolution_key text;
  v_card_count integer;
  v_stage_cursor smallint;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select owner_user_id
  into v_card_owner
  from public.business_cards
  where id = card_id_input;

  if v_card_owner is null or v_card_owner <> v_user_id then
    raise exception 'invalid card owner';
  end if;

  insert into public.growth_events (
    owner_user_id,
    business_card_id,
    event_type,
    points
  )
  values (
    v_user_id,
    card_id_input,
    'card_created',
    1
  )
  on conflict (business_card_id) do nothing
  returning id into v_event_id;

  insert into public.pet_stats (
    owner_user_id
  )
  values (
    v_user_id
  )
  on conflict (owner_user_id) do nothing;

  if v_event_id is not null then
    update public.pet_stats
    set
      card_count = card_count + 1,
      growth_points = growth_points + 1,
      updated_at = now()
    where owner_user_id = v_user_id;
  end if;

  select
    ps.lineage,
    ps.stage,
    ps.evolution_key,
    ps.card_count
  into
    v_lineage,
    v_current_stage,
    v_evolution_key,
    v_card_count
  from public.pet_stats ps
  where ps.owner_user_id = v_user_id;

  v_target_stage := public.compute_pet_stage(v_card_count);

  if v_target_stage > v_current_stage then
    v_stage_cursor := v_current_stage;
    while v_stage_cursor < v_target_stage loop
      v_stage_cursor := v_stage_cursor + 1;
      if v_stage_cursor = 1 and v_lineage is null then
        v_lineage := public.pick_random_lineage();
      end if;

      if v_lineage is not null then
        v_evolution_key := public.pick_random_evolution(
          v_lineage,
          v_stage_cursor - 1,
          v_stage_cursor
        );
      end if;
    end loop;

    update public.pet_stats
    set
      lineage = v_lineage,
      stage = v_target_stage,
      evolution_key = v_evolution_key,
      updated_at = now()
    where owner_user_id = v_user_id;

    v_current_stage := v_target_stage;
  end if;

  return query
  select
    ps.lineage,
    ps.stage,
    ps.evolution_key,
    ps.card_count,
    public.next_evolution_threshold(ps.stage) as next_evolution_at
  from public.pet_stats ps
  where ps.owner_user_id = v_user_id;
end;
$$;

revoke all on function public.advance_pet_on_card_created(uuid) from public;
grant execute on function public.advance_pet_on_card_created(uuid) to authenticated;

insert into public.evolution_rules (
  lineage,
  from_stage,
  to_stage,
  evolution_key,
  display_name,
  weight,
  rule_type,
  condition_expression
)
values
  ('ANIMAL', 0, 1, 'animal_hato', 'ハト型', 1, 'random', null),
  ('ANIMAL', 0, 1, 'animal_ookami', 'オオカミ型', 1, 'random', null),
  ('ANIMAL', 0, 1, 'animal_tako', 'タコ型', 1, 'random', null),
  ('ANIMAL', 0, 1, 'animal_ari', 'アリ型', 1, 'random', null),
  ('ANIMAL', 0, 1, 'animal_fukurou', 'フクロウ型', 1, 'random', null),
  ('ANIMAL', 1, 2, 'animal_networker', 'ネットワーク探索体', 1, 'random', null),
  ('ANIMAL', 1, 2, 'animal_cluster', 'クラスター形成体', 1, 'random', null),
  ('ANIMAL', 2, 3, 'animal_hub_master', 'ハブマスター体', 1, 'random', null),
  ('ANIMAL', 2, 3, 'animal_web_lord', 'ウェブロード体', 1, 'random', null),
  ('ANCIENT', 0, 1, 'ancient_small_dragon', '小型竜', 1, 'random', null),
  ('ANCIENT', 0, 1, 'ancient_trilobite', '三葉虫', 1, 'random', null),
  ('ANCIENT', 1, 2, 'ancient_pterosaur', '翼竜', 1, 'random', null),
  ('ANCIENT', 1, 2, 'ancient_ammonite', 'アンモナイト', 1, 'random', null),
  ('ANCIENT', 2, 3, 'ancient_tyrant_dragon', '霸王竜', 1, 'random', null),
  ('ANCIENT', 2, 3, 'ancient_deep_sea_king', '深海王', 1, 'random', null),
  ('SPIRIT', 0, 1, 'spirit_haze', 'もや', 1, 'random', null),
  ('SPIRIT', 1, 2, 'spirit_elemental', '精霊', 1, 'random', null),
  ('SPIRIT', 2, 3, 'spirit_guardian', '守護霊', 1, 'random', null),
  ('SPIRIT', 2, 3, 'spirit_negotiation_god', '交渉神', 1, 'random', null),
  ('ARCHETYPE', 0, 1, 'archetype_strategist', '戦略家型', 1, 'random', null),
  ('ARCHETYPE', 0, 1, 'archetype_inventor', '発明家型', 1, 'random', null),
  ('ARCHETYPE', 1, 2, 'archetype_diplomat', '外交官型', 1, 'random', null),
  ('ARCHETYPE', 1, 2, 'archetype_merchant', '商人型', 1, 'random', null),
  ('ARCHETYPE', 2, 3, 'archetype_reformer', '革命家型', 1, 'random', null),
  ('ARCHETYPE', 2, 3, 'archetype_grand_strategist', '大戦略家型', 1, 'random', null),
  ('DATA', 0, 1, 'data_dot_life', 'ドット生命体', 1, 'random', null),
  ('DATA', 1, 2, 'data_hologram', 'ホログラム体', 1, 'random', null),
  ('DATA', 2, 3, 'data_ai_core', 'AIコア', 1, 'random', null),
  ('DATA', 2, 3, 'data_network_neuron', 'ネットワーク神経体', 1, 'random', null)
on conflict (lineage, from_stage, to_stage, evolution_key) do nothing;
