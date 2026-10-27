-- 미니게임-인커젼 Supabase 스키마
-- 다른 프로젝트와 같은 데이터베이스를 써도 겹치지 않도록 모든 이름 앞에 mi_ 를 붙인다.
-- 모든 쓰기는 아래 함수(security definer)로만 하고, 테이블은 본인 행 읽기만 허용한다.

create table if not exists public.mi_characters (
  id text primary key,
  domain text not null,
  rarity int not null check (rarity between 1 and 5),
  pool boolean not null default true
);

create table if not exists public.mi_config (
  key text primary key,
  value jsonb not null
);

create table if not exists public.mi_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  coins int not null default 0 check (coins >= 0),
  pity_legend int not null default 0,
  pity_ultra int not null default 0,
  total_pulls int not null default 0,
  team jsonb,
  story jsonb not null default '{}'::jsonb,
  cleared jsonb not null default '{}'::jsonb,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mi_scores (
  user_id uuid not null references auth.users on delete cascade,
  game_id text not null,
  best_score int not null default 0,
  stars int not null default 0,
  plays int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists public.mi_owned_characters (
  user_id uuid not null references auth.users on delete cascade,
  character_id text not null references public.mi_characters (id) on update cascade,
  breakthrough int not null default 0,
  obtained_at timestamptz not null default now(),
  primary key (user_id, character_id)
);

create table if not exists public.mi_gacha_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  banner_id text not null,
  character_id text not null,
  rarity int not null,
  pity_legend int not null,
  pity_ultra int not null,
  created_at timestamptz not null default now()
);
create index if not exists mi_gacha_log_user_idx on public.mi_gacha_log (user_id, created_at desc);
create index if not exists mi_owned_characters_char_idx on public.mi_owned_characters (character_id);

-- ---------- 보안 규칙 ----------
alter table public.mi_characters enable row level security;
alter table public.mi_config enable row level security;
alter table public.mi_profiles enable row level security;
alter table public.mi_scores enable row level security;
alter table public.mi_owned_characters enable row level security;
alter table public.mi_gacha_log enable row level security;

drop policy if exists "mi_characters read" on public.mi_characters;
create policy "mi_characters read" on public.mi_characters for select to authenticated using (true);
drop policy if exists "mi_config read" on public.mi_config;
create policy "mi_config read" on public.mi_config for select to authenticated using (true);
drop policy if exists "mi_profiles own" on public.mi_profiles;
create policy "mi_profiles own" on public.mi_profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "mi_scores own" on public.mi_scores;
create policy "mi_scores own" on public.mi_scores for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "mi_owned own" on public.mi_owned_characters;
create policy "mi_owned own" on public.mi_owned_characters for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "mi_log own" on public.mi_gacha_log;
create policy "mi_log own" on public.mi_gacha_log for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- 함수 ----------
create or replace function public.mi_ensure_profile(p_start_coins int default null)
returns public.mi_profiles
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  start_coins int;
  r public.mi_profiles;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select coalesce((value ->> 'startCoins')::int, 1000) into start_coins from public.mi_config where key = 'gacha';
  insert into public.mi_profiles (user_id, coins) values (uid, coalesce(start_coins, 1000))
  on conflict (user_id) do nothing;
  insert into public.mi_owned_characters (user_id, character_id)
  select uid, 'teumsae' where exists (select 1 from public.mi_characters where id = 'teumsae')
  on conflict do nothing;
  select * into r from public.mi_profiles where user_id = uid;
  return r;
end $$;

create or replace function public.mi_submit_result(p_game text, p_score int, p_stars int, p_coins int)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  c int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into public.mi_scores (user_id, game_id, best_score, stars, plays)
  values (uid, p_game, greatest(p_score, 0), least(greatest(p_stars, 0), 3), 1)
  on conflict (user_id, game_id) do update set
    best_score = greatest(public.mi_scores.best_score, excluded.best_score),
    stars = greatest(public.mi_scores.stars, excluded.stars),
    plays = public.mi_scores.plays + 1,
    updated_at = now();
  update public.mi_profiles set coins = coins + greatest(p_coins, 0), updated_at = now()
  where user_id = uid returning coins into c;
  return c;
end $$;

create or replace function public.mi_add_coins(p_amount int)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  c int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.mi_profiles set coins = greatest(0, coins + greatest(p_amount, 0)), updated_at = now()
  where user_id = auth.uid() returning coins into c;
  return c;
end $$;

create or replace function public.mi_grant_character(p_char text)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.mi_owned_characters (user_id, character_id) values (auth.uid(), p_char)
  on conflict do nothing;
  return found;
end $$;

create or replace function public.mi_save_meta(p_team jsonb, p_story jsonb, p_cleared jsonb, p_extra jsonb)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.mi_profiles set
    team = coalesce(p_team, team),
    story = coalesce(p_story, story),
    cleared = coalesce(p_cleared, cleared),
    extra = coalesce(p_extra, extra),
    updated_at = now()
  where user_id = auth.uid();
end $$;

-- 뽑기: 확률·천장·코인 차감·돌파·기록을 한 번에 처리한다.
create or replace function public.mi_pull(p_banner text, p_pickup text, p_count int, p_domains text[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cfg jsonb;
  prof public.mi_profiles;
  cost int;
  results jsonb := '[]'::jsonb;
  total_rate numeric;
  x numeric;
  rr record;
  rarity int;
  is_pity boolean;
  got_rare boolean := false;
  guarantee int;
  pick text;
  owned_b int;
  is_new boolean;
  b int;
  refund int;
  max_b int;
  i int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_count not in (1, 10) then raise exception 'invalid count'; end if;
  select value into cfg from public.mi_config where key = 'gacha';
  if cfg is null then raise exception 'gacha config missing'; end if;
  guarantee := coalesce((cfg ->> 'tenPullGuarantee')::int, 2);
  max_b := coalesce((cfg ->> 'maxBreakthrough')::int, 5);
  cost := case when p_count >= 10 then (cfg -> 'cost' ->> 'ten')::int else (cfg -> 'cost' ->> 'single')::int * p_count end;

  select * into prof from public.mi_profiles where user_id = uid for update;
  if prof is null then raise exception 'profile missing'; end if;
  if prof.coins < cost then raise exception '코인이 부족해요'; end if;
  prof.coins := prof.coins - cost;

  select sum((e ->> 'rate')::numeric) into total_rate from jsonb_array_elements(cfg -> 'rarities') e;

  for i in 1 .. p_count loop
    prof.pity_legend := prof.pity_legend + 1;
    prof.pity_ultra := prof.pity_ultra + 1;
    is_pity := false;
    rarity := 0;
    if prof.pity_ultra >= (cfg -> 'pity' ->> 'ultra')::int
       and exists (select 1 from public.mi_characters c where c.pool and c.domain = any (p_domains) and c.rarity = 5) then
      rarity := 5; is_pity := true;
    elsif prof.pity_legend >= (cfg -> 'pity' ->> 'legend')::int
       and exists (select 1 from public.mi_characters c where c.pool and c.domain = any (p_domains) and c.rarity = 4) then
      rarity := 4; is_pity := true;
    else
      x := random() * total_rate;
      for rr in select (e ->> 'id')::int as id, (e ->> 'rate')::numeric as rate
                from jsonb_array_elements(cfg -> 'rarities') e order by (e ->> 'id')::int desc loop
        if x < rr.rate then rarity := rr.id; exit; end if;
        x := x - rr.rate;
      end loop;
      if rarity = 0 then rarity := 1; end if;
      if p_count >= 10 and i = p_count and not got_rare and rarity < guarantee then rarity := guarantee; end if;
    end if;
    while rarity > 1 and not exists (select 1 from public.mi_characters c where c.pool and c.domain = any (p_domains) and c.rarity = rarity) loop
      rarity := rarity - 1;
    end loop;
    if rarity >= guarantee then got_rare := true; end if;
    if rarity = 5 then prof.pity_ultra := 0; end if;
    if rarity = 4 then prof.pity_legend := 0; end if;

    pick := null;
    if p_pickup is not null and (is_pity or random() < coalesce((cfg ->> 'pickupChance')::numeric, 0.5)) then
      select c.id into pick from public.mi_characters c
      where c.pool and c.domain = p_pickup and c.domain = any (p_domains) and c.rarity = rarity
      order by random() limit 1;
    end if;
    if pick is null then
      select c.id into pick from public.mi_characters c
      where c.pool and c.domain = any (p_domains) and c.rarity = rarity
      order by random() limit 1;
    end if;
    if pick is null then raise exception 'empty pool'; end if;

    select breakthrough into owned_b from public.mi_owned_characters where user_id = uid and character_id = pick;
    is_new := false; b := 0; refund := 0;
    if not found then
      insert into public.mi_owned_characters (user_id, character_id) values (uid, pick);
      is_new := true;
    elsif owned_b < max_b then
      update public.mi_owned_characters set breakthrough = breakthrough + 1
      where user_id = uid and character_id = pick returning breakthrough into b;
    else
      b := owned_b;
      select (e ->> 'refund')::int into refund from jsonb_array_elements(cfg -> 'rarities') e where (e ->> 'id')::int = rarity;
      prof.coins := prof.coins + coalesce(refund, 0);
    end if;

    insert into public.mi_gacha_log (user_id, banner_id, character_id, rarity, pity_legend, pity_ultra)
    values (uid, p_banner, pick, rarity, prof.pity_legend, prof.pity_ultra);

    results := results || jsonb_build_object('id', pick, 'rarity', rarity, 'isNew', is_new, 'b', b, 'refund', coalesce(refund, 0), 'pity', is_pity);
  end loop;

  update public.mi_profiles set
    coins = prof.coins,
    pity_legend = prof.pity_legend,
    pity_ultra = prof.pity_ultra,
    total_pulls = total_pulls + p_count,
    updated_at = now()
  where user_id = uid;

  return jsonb_build_object(
    'results', results,
    'coins', prof.coins,
    'pity_legend', prof.pity_legend,
    'pity_ultra', prof.pity_ultra,
    'total_pulls', prof.total_pulls + p_count
  );
end $$;

-- 로그인한 사용자만 함수 실행
revoke execute on function public.mi_ensure_profile(int) from public, anon;
revoke execute on function public.mi_submit_result(text, int, int, int) from public, anon;
revoke execute on function public.mi_add_coins(int) from public, anon;
revoke execute on function public.mi_grant_character(text) from public, anon;
revoke execute on function public.mi_save_meta(jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.mi_pull(text, text, int, text[]) from public, anon;
grant execute on function public.mi_ensure_profile(int) to authenticated;
grant execute on function public.mi_submit_result(text, int, int, int) to authenticated;
grant execute on function public.mi_add_coins(int) to authenticated;
grant execute on function public.mi_grant_character(text) to authenticated;
grant execute on function public.mi_save_meta(jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.mi_pull(text, text, int, text[]) to authenticated;
