-- ════════════════════════════════════════════════════════════════
--  心理的安全性トラッカー  ─ スキーマ / RLS / 集計関数
--  PostgreSQL (Supabase)。匿名認証(supabase.auth.signInAnonymously)前提。
--
--  原則:
--   1. 個人情報を取らない（匿名authユーザ = auth.uid() だけが識別子）
--   2. 個人の生の値・メモは「本人だけ」が読める（RLS）
--   3. 班/クラスに出すのは「ばらつき」だけ。生データを返す経路を一切作らない
--      → 集計は SECURITY DEFINER 関数経由で、戻り値は集計量のみ
--   4. チーム名は後から決まる。所属メンバーが編集できる
-- ════════════════════════════════════════════════════════════════

-- ── マスタ：クラス（4つ）──────────────────────────────────────
create table public.classes (
  id         smallint primary key,            -- 1..4
  label      text not null,                   -- 表示名（編集可）
  created_at timestamptz not null default now()
);

-- ── マスタ：班 ───────────────────────────────────────────────
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  class_id   smallint not null references public.classes(id),
  slot       smallint not null,               -- クラス内の班番号 1..4（不変の識別子）
  name       text,                            -- ★チーム名：後から決まる。NULL可・編集可
  created_at timestamptz not null default now(),
  unique (class_id, slot)
);

-- ── 参加者：本人 = 班の中で一意なニックネーム＋PIN ───────────────
--  id は端末非依存の「人ID」。auth.uid() には縛らない（別端末でも同じ人でいられる）。
--  端末(auth.uid())との対応は participant_devices が持つ。
create table public.participants (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id),
  nickname   text,                            -- 班の中で一意（下の部分ユニークindex）
  pin_hash   text,                            -- bcrypt(pgcrypto)。平文は保存しない・返さない
  joined_at  timestamptz not null default now()
);
-- ニックネームは班の中で一意（NULL可＝旧データ互換）
create unique index participants_team_nickname_uniq
  on public.participants (team_id, nickname) where nickname is not null;

-- ── 端末 ↔ 参加者 の橋渡し（匿名authユーザ = 端末セッション）─────
--  1人が複数端末からアクセスできるよう、auth.uid() を参加者にひも付ける。
--  作成/削除は register/claim RPC(SECURITY DEFINER)経由のみ。
create table public.participant_devices (
  participant_id uuid not null references public.participants(id) on delete cascade,
  auth_uid       uuid not null,
  linked_at      timestamptz not null default now(),
  primary key (participant_id, auth_uid)
);
create index on public.participant_devices (auth_uid);

-- ── 回答（1回の記録 = 1セッション）──────────────────────────
create table public.responses (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  team_id        uuid not null references public.teams(id),
  recorded_at    timestamptz not null default now(),
  scores         smallint[] not null,         -- 長さ7。各 -50..50。0 = 初対面（中央）
  memo           text,                        -- ★本人専用。共有・集計には絶対に使わない
  created_at     timestamptz not null default now(),
  constraint scores_len check (array_length(scores, 1) = 7)
);
create index on public.responses (participant_id, recorded_at);
create index on public.responses (team_id, recorded_at);

-- scores の範囲チェック（CHECKはサブクエリ不可なのでトリガで）
create or replace function public.validate_scores() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from unnest(new.scores) s where s < -50 or s > 50) then
    raise exception 'scores must be between -50 and 50';
  end if;
  return new;
end $$;
create trigger trg_validate_scores before insert or update on public.responses
  for each row execute function public.validate_scores();

-- ════════════════════════════════════════════════════════════════
--  RLS  ─ ここが本体
-- ════════════════════════════════════════════════════════════════
alter table public.classes            enable row level security;
alter table public.teams              enable row level security;
alter table public.participants       enable row level security;
alter table public.participant_devices enable row level security;
alter table public.responses          enable row level security;

-- 端末リンク：自分の端末の行だけ参照可（作成/削除は RPC 経由のみ）
create policy "own device links" on public.participant_devices
  for select using (auth_uid = auth.uid());

-- classes / teams は選択画面で全員が読む
create policy "classes readable" on public.classes for select using (true);
create policy "teams readable"   on public.teams   for select using (true);

-- ★チーム名の編集：その班に所属している人だけ name を更新できる（端末リンク経由で判定）
create policy "team name editable by members" on public.teams
  for update using (
    exists (select 1 from public.participant_devices pd
            join public.participants p on p.id = pd.participant_id
            where pd.auth_uid = auth.uid() and p.team_id = teams.id)
  ) with check (
    exists (select 1 from public.participant_devices pd
            join public.participants p on p.id = pd.participant_id
            where pd.auth_uid = auth.uid() and p.team_id = teams.id)
  );

-- participants：自分がリンクしている参加者行だけ（pin_hash は列権限で別途遮断）
--  作成は register/claim RPC 経由（SECURITY DEFINER）。直接 insert は開けない。
create policy "own participant select" on public.participants for select
  using (id in (select pd.participant_id from public.participant_devices pd
                where pd.auth_uid = auth.uid()));
create policy "own participant update" on public.participants for update
  using (id in (select pd.participant_id from public.participant_devices pd
                where pd.auth_uid = auth.uid()))
  with check (id in (select pd.participant_id from public.participant_devices pd
                     where pd.auth_uid = auth.uid()));

-- pin_hash はクライアントに一切読ませない
--  テーブル全体の SELECT を外し、安全な列だけ付け直す（列 revoke 単独では効かないため）
revoke select on public.participants from anon, authenticated;
grant  select (id, team_id, nickname, joined_at) on public.participants to anon, authenticated;

-- responses：自分の回答だけ。他人の生データ・メモへの経路は存在しない（端末リンク経由で判定）
create policy "own responses select" on public.responses for select
  using (participant_id in (select pd.participant_id from public.participant_devices pd
                            where pd.auth_uid = auth.uid()));
create policy "own responses insert" on public.responses for insert
  with check (participant_id in (select pd.participant_id from public.participant_devices pd
                                 where pd.auth_uid = auth.uid()));
create policy "own responses update" on public.responses for update
  using (participant_id in (select pd.participant_id from public.participant_devices pd
                            where pd.auth_uid = auth.uid()))
  with check (participant_id in (select pd.participant_id from public.participant_devices pd
                                 where pd.auth_uid = auth.uid()));
create policy "own responses delete" on public.responses for delete
  using (participant_id in (select pd.participant_id from public.participant_devices pd
                            where pd.auth_uid = auth.uid()));

-- ════════════════════════════════════════════════════════════════
--  集計関数（SECURITY DEFINER）
--  RLSを越えて全回答を読むが、戻り値は「ばらつき + 件数」だけ。
--  生の値・participant_id・memo は決して返さない。
-- ════════════════════════════════════════════════════════════════

-- 班の「いま、項目ごとの割れ度」：各参加者の最新回答から、項目ごとの標準偏差
create or replace function public.team_item_spread(p_team uuid)
returns table (item_index int, dispersion numeric, n bigint)
language sql security definer set search_path = public as $$
  with latest as (
    select distinct on (participant_id) participant_id, scores
    from responses
    where team_id = p_team
    order by participant_id, recorded_at desc
  ),
  unrolled as (
    select s.idx::int as item_index, s.val::numeric as val
    from latest l, unnest(l.scores) with ordinality as s(val, idx)
  )
  select item_index,
         coalesce(stddev_samp(val), 0) as dispersion,
         count(*) as n
  from unrolled
  group by item_index
  order by item_index;
$$;

-- 班の「ばらつきの推移」：週ごとに、参加者の総合(7平均)の標準偏差
create or replace function public.team_spread_timeline(p_team uuid)
returns table (week date, dispersion numeric, n bigint)
language sql security definer set search_path = public as $$
  with per_resp as (
    select participant_id,
           date_trunc('week', recorded_at)::date as week,
           (select avg(v)::numeric from unnest(scores) v) as overall
    from responses where team_id = p_team
  ),
  per_person_week as (   -- 同じ週に複数回答した人は均して1人1値に
    select week, participant_id, avg(overall) as overall
    from per_resp group by week, participant_id
  )
  select week, coalesce(stddev_samp(overall), 0) as dispersion, count(*) as n
  from per_person_week group by week order by week;
$$;

-- 班の「週ごと×項目ごと」のばらつきの推移
-- 週ごとに、各項目(1..7)について参加者の値の標準偏差を出す。
-- （同じ週に複数回答した人は、その週・その項目で平均して1人1値にしてから偏差を取る）
create or replace function public.team_item_spread_timeline(p_team uuid)
returns table (week date, item_index int, dispersion numeric, n bigint)
language sql security definer set search_path = public as $$
  with per_person_week as (
    select date_trunc('week', recorded_at)::date as week,
           participant_id,
           s.idx::int as item_index,
           avg(s.val::numeric) as val
    from responses, unnest(scores) with ordinality as s(val, idx)
    where team_id = p_team
    group by 1, 2, 3
  )
  select week, item_index,
         coalesce(stddev_samp(val), 0) as dispersion,
         count(*) as n
  from per_person_week
  group by week, item_index
  order by week, item_index;
$$;

-- クラス全体のばらつきの推移（Slackサマリー用）
create or replace function public.class_spread_timeline(p_class smallint)
returns table (week date, dispersion numeric, n bigint)
language sql security definer set search_path = public as $$
  with per_resp as (
    select r.participant_id,
           date_trunc('week', r.recorded_at)::date as week,
           (select avg(v)::numeric from unnest(r.scores) v) as overall
    from responses r join teams t on t.id = r.team_id
    where t.class_id = p_class
  ),
  per_person_week as (
    select week, participant_id, avg(overall) as overall
    from per_resp group by week, participant_id
  )
  select week, coalesce(stddev_samp(overall), 0) as dispersion, count(*) as n
  from per_person_week group by week order by week;
$$;

grant execute on function public.team_item_spread(uuid)          to authenticated;
grant execute on function public.team_spread_timeline(uuid)      to authenticated;
grant execute on function public.team_item_spread_timeline(uuid) to authenticated;
grant execute on function public.class_spread_timeline(smallint) to authenticated;
-- 注: いまは誰でも任意のteam/classのばらつきを呼べる（=ばらつきのみなので低リスク）。
--     班内に限定したいなら、関数冒頭で auth.uid() の所属チェックを足す。

-- ════════════════════════════════════════════════════════════════
--  本人確認つき 登録 / 復帰（SECURITY DEFINER）
--  どちらも成功時に「この端末(auth.uid())」を参加者にひも付けて id を返す。
--  PIN は bcrypt で照合。平文は保存も返却もしない。
-- ════════════════════════════════════════════════════════════════
create or replace function public.register_participant(
  p_team uuid, p_nickname text, p_pin text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := nullif(btrim(p_nickname), '');
  v_pid  uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if v_name is null then raise exception 'nickname required'; end if;
  if p_pin is null or length(p_pin) < 3 then raise exception 'pin too short'; end if;
  if exists (select 1 from participants where team_id = p_team and nickname = v_name) then
    raise exception 'nickname taken';
  end if;

  insert into participants (team_id, nickname, pin_hash)
    values (p_team, v_name, crypt(p_pin, gen_salt('bf')))
    returning id into v_pid;

  delete from participant_devices where auth_uid = v_uid;      -- 1端末＝1アクティブ参加者
  insert into participant_devices (participant_id, auth_uid) values (v_pid, v_uid);
  return v_pid;
end $$;

create or replace function public.claim_participant(
  p_team uuid, p_nickname text, p_pin text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := nullif(btrim(p_nickname), '');
  v_pid  uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if v_name is null then raise exception 'nickname required'; end if;

  select id into v_pid from participants
   where team_id = p_team and nickname = v_name
     and pin_hash is not null and pin_hash = crypt(p_pin, pin_hash);
  if v_pid is null then raise exception 'invalid nickname or pin'; end if;

  delete from participant_devices where auth_uid = v_uid;
  insert into participant_devices (participant_id, auth_uid) values (v_pid, v_uid)
    on conflict do nothing;
  return v_pid;
end $$;

grant execute on function public.register_participant(uuid, text, text) to authenticated;
grant execute on function public.claim_participant(uuid, text, text)   to authenticated;

-- ════════════════════════════════════════════════════════════════
--  初期データ（クラス4 × 班4 = 16班。名前は空のまま、後から命名）
-- ════════════════════════════════════════════════════════════════
insert into public.classes (id, label) values (1,'クラス1'),(2,'クラス2'),(3,'クラス3'),(4,'クラス4');
insert into public.teams (class_id, slot)
  select c.id, g from public.classes c cross join generate_series(1,4) g;

-- ── クライアント側の流れ（参考）────────────────────────────────
--  1. 初回: await supabase.auth.signInAnonymously()（端末セッションの確保）
--  2. クラス・班を選ぶ → 本人確認：
--       はじめて: rpc('register_participant',{p_team,p_nickname,p_pin}) → participant_id
--       別端末で継続: rpc('claim_participant',{p_team,p_nickname,p_pin}) → participant_id
--     （どちらも この auth.uid() を participant_devices にひも付ける）
--  3. 記録: insert into responses (participant_id, team_id, scores, memo)
--          participant_id は 2 で得た自分の人ID。RLSは端末リンク経由で本人を判定。
--  4. 自己理解: select scores, memo, recorded_at from responses（RLSで自分のみ）
--  5. 班の共有: supabase.rpc('team_item_spread',{p_team}) / ('team_spread_timeline',{p_team})
--  6. チーム名編集: update teams set name = '…' where id = team_id（RLSで所属者のみ）
