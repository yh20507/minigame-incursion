-- 미니게임-인커젼 Supabase 스키마
-- 다른 프로젝트와 같은 데이터베이스를 써도 겹치지 않도록 모든 이름 앞에 mi_ 를 붙인다.
-- 모든 쓰기는 아래 함수(security definer)로만 하고, 테이블은 본인 행 읽기만 허용한다.

create table if not exists public.mi_characters (
  id text primary key,
  origin text not null default 'original',
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
  items jsonb not null default '{}'::jsonb,
  first_multi text[] not null default '{}',
  tickets text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 예전 버전에서 올릴 때
alter table public.mi_profiles add column if not exists first_multi text[] not null default '{}';

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
  level int not null default 0,
  dupes int not null default 0,
  obtained_at timestamptz not null default now(),
  primary key (user_id, character_id)
);

create table if not exists public.mi_gacha_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  banner_id text not null,
  character_id text not null,
  kind text not null default 'char',
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

-- 중복 1개 처리 (강화). 최대 강화 뒤에는 코인 환급
create or replace function public.mi__add_dupe(p_uid uuid, p_char text, p_rarity int, cfg jsonb,
  out o_level int, out o_dupes int, out o_level_up boolean, out o_refund int)
language plpgsql security definer set search_path = '' as $$
declare
  max_l int := coalesce((cfg -> 'enhance' ->> 'max')::int, 3);
  need int;
begin
  select level, dupes into o_level, o_dupes from public.mi_owned_characters where user_id = p_uid and character_id = p_char for update;
  o_level_up := false;
  o_refund := 0;
  if o_level >= max_l then
    select (e ->> 'refund')::int into o_refund from jsonb_array_elements(cfg -> 'rarities') e where (e ->> 'id')::int = p_rarity;
    o_refund := coalesce(o_refund, 0);
    update public.mi_profiles set coins = coins + o_refund where user_id = p_uid;
    return;
  end if;
  o_dupes := o_dupes + 1;
  need := coalesce((cfg -> 'enhance' -> 'need' ->> o_level)::int, 1);
  if o_dupes >= need then
    o_level := o_level + 1;
    o_dupes := 0;
    o_level_up := true;
  end if;
  update public.mi_owned_characters set level = o_level, dupes = o_dupes where user_id = p_uid and character_id = p_char;
end $$;
revoke execute on function public.mi__add_dupe(uuid, text, int, jsonb) from public, anon, authenticated;

-- 뽑기: 확률·천장·아이템·코인 차감·강화·기록을 한 번에 처리한다.
-- p_pool: 이번 균열에서 나올 수 있는 캐릭터 id 목록 (클라이언트가 균열 설정에서 계산해 보냄)
create or replace function public.mi_pull(p_banner text, p_pool text[], p_multi boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cfg jsonb;
  items_cfg jsonb;
  prof public.mi_profiles;
  cost int;
  cnt int;
  results jsonb := '[]'::jsonb;
  x numeric;
  rr record;
  rar int;
  is_pity boolean;
  got_g boolean := false;
  guarantee int;
  pick text;
  it record;
  total_w numeric;
  d record;
  is_new boolean;
  first boolean;
  i int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select value into cfg from public.mi_config where key = 'gacha';
  select value into items_cfg from public.mi_config where key = 'items';
  if cfg is null or items_cfg is null then raise exception 'gacha config missing'; end if;
  guarantee := coalesce((cfg ->> 'multiGuarantee')::int, 2);
  cost := case when p_multi then (cfg -> 'cost' ->> 'multi')::int else (cfg -> 'cost' ->> 'single')::int end;
  cnt := case when p_multi then (cfg -> 'cost' ->> 'multiCount')::int else 1 end;

  select * into prof from public.mi_profiles where user_id = uid for update;
  if prof is null then raise exception 'profile missing'; end if;
  if prof.coins < cost then raise exception '코인이 부족해요'; end if;
  first := p_multi and not (p_banner = any (prof.first_multi));
  if first then guarantee := greatest(guarantee, coalesce((cfg ->> 'firstMultiGuarantee')::int, 4)); end if;
  update public.mi_profiles set coins = coins - cost where user_id = uid;
  select sum((e ->> 'weight')::numeric) into total_w from jsonb_array_elements(items_cfg) e;

  for i in 1 .. cnt loop
    prof.pity_legend := prof.pity_legend + 1;
    prof.pity_ultra := prof.pity_ultra + 1;
    is_pity := false;
    rar := 0;
    if prof.pity_ultra >= (cfg -> 'pity' ->> 'ultra')::int
       and exists (select 1 from public.mi_characters c where c.id = any (p_pool) and c.pool and c.rarity = 5) then
      rar := 5; is_pity := true;
    elsif prof.pity_legend >= (cfg -> 'pity' ->> 'legend')::int
       and exists (select 1 from public.mi_characters c where c.id = any (p_pool) and c.pool and c.rarity = 4) then
      rar := 4; is_pity := true;
    else
      x := random() * 100;
      for rr in select (e ->> 'id')::int as id, (e ->> 'rate')::numeric as rate
                from jsonb_array_elements(cfg -> 'rarities') e order by (e ->> 'id')::int desc loop
        if x < rr.rate then rar := rr.id; exit; end if;
        x := x - rr.rate;
      end loop;
    end if;
    if p_multi and i = cnt and not got_g and rar < guarantee then rar := guarantee; end if;
    while rar > 0 and not exists (select 1 from public.mi_characters c where c.id = any (p_pool) and c.pool and c.rarity = rar) loop
      rar := rar - 1;
    end loop;
    if rar >= guarantee then got_g := true; end if;
    if rar = 5 then prof.pity_ultra := 0; end if;
    if rar = 4 then prof.pity_legend := 0; end if;

    if rar = 0 then
      -- 아이템
      x := random() * total_w;
      pick := null;
      for it in select e ->> 'id' as id, (e ->> 'weight')::numeric as w, e ->> 'effect' as effect, (e ->> 'value')::int as v
                from jsonb_array_elements(items_cfg) e loop
        if x < it.w then
          pick := it.id;
          if it.effect = 'instant' then
            update public.mi_profiles set coins = coins + it.v where user_id = uid;
          else
            update public.mi_profiles set items = jsonb_set(items, array[it.id], to_jsonb(coalesce((items ->> it.id)::int, 0) + 1))
            where user_id = uid;
          end if;
          exit;
        end if;
        x := x - it.w;
      end loop;
      insert into public.mi_gacha_log (user_id, banner_id, character_id, kind, rarity, pity_legend, pity_ultra)
      values (uid, p_banner, coalesce(pick, '?'), 'item', 0, prof.pity_legend, prof.pity_ultra);
      results := results || jsonb_build_object('kind', 'item', 'id', pick, 'rarity', 0, 'isNew', false, 'b', 0, 'd', 0, 'levelUp', false, 'refund', 0, 'pity', false);
      continue;
    end if;

    select c.id into pick from public.mi_characters c
    where c.id = any (p_pool) and c.pool and c.rarity = rar order by random() limit 1;
    is_new := not exists (select 1 from public.mi_owned_characters where user_id = uid and character_id = pick);
    if is_new then
      insert into public.mi_owned_characters (user_id, character_id) values (uid, pick);
      select 0 as o_level, 0 as o_dupes, false as o_level_up, 0 as o_refund into d;
    else
      select * into d from public.mi__add_dupe(uid, pick, rar, cfg);
    end if;
    insert into public.mi_gacha_log (user_id, banner_id, character_id, kind, rarity, pity_legend, pity_ultra)
    values (uid, p_banner, pick, 'char', rar, prof.pity_legend, prof.pity_ultra);
    results := results || jsonb_build_object('kind', 'char', 'id', pick, 'rarity', rar, 'isNew', is_new,
      'b', d.o_level, 'd', d.o_dupes, 'levelUp', d.o_level_up, 'refund', d.o_refund, 'pity', is_pity);
  end loop;

  update public.mi_profiles set
    pity_legend = prof.pity_legend,
    pity_ultra = prof.pity_ultra,
    total_pulls = total_pulls + cnt,
    first_multi = case when first then array_append(first_multi, p_banner) else first_multi end,
    updated_at = now()
  where user_id = uid
  returning * into prof;

  return jsonb_build_object('results', results, 'coins', prof.coins, 'pity_legend', prof.pity_legend,
    'pity_ultra', prof.pity_ultra, 'total_pulls', prof.total_pulls, 'items', prof.items,
    'first_multi', to_jsonb(prof.first_multi));
end $$;

-- 출전 전 아이템 사용
create or replace function public.mi_use_items(p_items text[])
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  r jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  foreach k in array p_items loop
    update public.mi_profiles set items = jsonb_set(items, array[k], to_jsonb(greatest(coalesce((items ->> k)::int, 0) - 1, 0)))
    where user_id = auth.uid() and coalesce((items ->> k)::int, 0) > 0;
  end loop;
  select items into r from public.mi_profiles where user_id = auth.uid();
  return r;
end $$;

-- 원정 보상 등으로 아이템 받기 (한 번에 최대 10개)
create or replace function public.mi_add_items(p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  n int;
  total int := 0;
  r jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  for k, n in select key, value::int from jsonb_each_text(p_items) loop
    if not exists (select 1 from public.mi_config c, jsonb_array_elements(c.value) e where c.key = 'items' and e ->> 'id' = k) then continue; end if;
    n := greatest(0, least(n, 10 - total));
    total := total + n;
    update public.mi_profiles set items = jsonb_set(items, array[k], to_jsonb(coalesce((items ->> k)::int, 0) + n))
    where user_id = auth.uid();
  end loop;
  select items into r from public.mi_profiles where user_id = auth.uid();
  return r;
end $$;

-- 만능 조각: ★1~★3 캐릭터에 중복 1개로 사용
create or replace function public.mi_use_shard(p_char text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cfg jsonb;
  rar int;
  d record;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select value into cfg from public.mi_config where key = 'gacha';
  select rarity into rar from public.mi_characters where id = p_char;
  if rar is null or rar > 3 then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.mi_owned_characters where user_id = uid and character_id = p_char) then raise exception 'not owned'; end if;
  update public.mi_profiles set items = jsonb_set(items, '{shard}', to_jsonb((items ->> 'shard')::int - 1))
  where user_id = uid and coalesce((items ->> 'shard')::int, 0) > 0;
  if not found then raise exception 'no shard'; end if;
  select * into d from public.mi__add_dupe(uid, p_char, rar, cfg);
  return jsonb_build_object('b', d.o_level, 'd', d.o_dupes, 'levelUp', d.o_level_up, 'refund', d.o_refund);
end $$;

-- 로그인한 사용자만 함수 실행
revoke execute on function public.mi_ensure_profile(int) from public, anon;
revoke execute on function public.mi_submit_result(text, int, int, int) from public, anon;
revoke execute on function public.mi_add_coins(int) from public, anon;
revoke execute on function public.mi_grant_character(text) from public, anon;
revoke execute on function public.mi_save_meta(jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke execute on function public.mi_pull(text, text[], boolean) from public, anon;
revoke execute on function public.mi_use_items(text[]) from public, anon;
revoke execute on function public.mi_use_shard(text) from public, anon;
revoke execute on function public.mi_add_items(jsonb) from public, anon;
grant execute on function public.mi_ensure_profile(int) to authenticated;
grant execute on function public.mi_submit_result(text, int, int, int) to authenticated;
grant execute on function public.mi_add_coins(int) to authenticated;
grant execute on function public.mi_grant_character(text) to authenticated;
grant execute on function public.mi_save_meta(jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.mi_pull(text, text[], boolean) to authenticated;
grant execute on function public.mi_use_items(text[]) to authenticated;
grant execute on function public.mi_use_shard(text) to authenticated;
grant execute on function public.mi_add_items(jsonb) to authenticated;

-- ★5 선택권
alter table public.mi_profiles add column if not exists tickets text[] not null default '{}';

create or replace function public.mi_claim_ticket(p_ticket text, p_char text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cfg jsonb;
  rar int;
  dom text;
  prof public.mi_profiles;
  d record;
  is_new boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select value into cfg from public.mi_config where key = 'gacha';
  select c.rarity, c.domain into rar, dom from public.mi_characters c where c.id = p_char and c.pool;
  if rar is distinct from 5 or p_ticket <> 'tk_' || dom then raise exception 'not allowed'; end if;
  select * into prof from public.mi_profiles where user_id = uid for update;
  if prof is null then raise exception 'profile missing'; end if;
  if p_ticket = any (prof.tickets) then raise exception '이미 쓴 선택권이에요'; end if;
  is_new := not exists (select 1 from public.mi_owned_characters where user_id = uid and character_id = p_char);
  if is_new then
    insert into public.mi_owned_characters (user_id, character_id) values (uid, p_char);
    select 0 as o_level, 0 as o_dupes, false as o_level_up, 0 as o_refund into d;
  else
    select * into d from public.mi__add_dupe(uid, p_char, rar, cfg);
  end if;
  update public.mi_profiles set tickets = array_append(tickets, p_ticket), updated_at = now() where user_id = uid;
  insert into public.mi_gacha_log (user_id, banner_id, character_id, kind, rarity, pity_legend, pity_ultra)
  values (uid, p_ticket, p_char, 'ticket', rar, prof.pity_legend, prof.pity_ultra);
  return jsonb_build_object('isNew', is_new, 'b', d.o_level, 'd', d.o_dupes, 'levelUp', d.o_level_up, 'refund', d.o_refund);
end $$;

revoke execute on function public.mi_claim_ticket(text, text) from public, anon;
grant execute on function public.mi_claim_ticket(text, text) to authenticated;
