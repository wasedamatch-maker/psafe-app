-- ════════════════════════════════════════════════════════════════
--  心理的安全性トラッカー ─ 管理画面(/admin)用の RPC 関数
--
--  これらは schema.sql には含まれていない「後から追加した」関数群。
--  新しい Supabase でDBを作り直すときは、schema.sql を流したあとに
--  このファイルを SQL Editor で実行してください。
--
--  すべて SECURITY DEFINER（RLSを越えて全班の集計を読む）だが、
--  戻り値は集計量・件数のみ。生の participant_id / memo は返さない。
--
--  ※ 呼び出し元は匿名authクライアント（anonキー）なので、anon と
--    authenticated の両方に execute 権限を付与している。
--    admin_reset_semester だけはパスワード引数で保護している。
-- ════════════════════════════════════════════════════════════════

-- ── ① 全クラス・全班の参加者数と記録数 ─────────────────────────
-- TeamStat = { team_id, class_id, slot, name, member_count, response_count }
create or replace function public.admin_team_stats()
returns table (
  team_id        uuid,
  class_id       smallint,
  slot           smallint,
  name           text,
  member_count   bigint,
  response_count bigint
)
language sql security definer set search_path = public as $$
  select
    t.id       as team_id,
    t.class_id,
    t.slot,
    t.name,
    (select count(*) from participants p where p.team_id = t.id) as member_count,
    (select count(*) from responses    r where r.team_id = t.id) as response_count
  from teams t
  order by t.class_id, t.slot;
$$;

-- ── ② 週ごと・班ごとの提出人数（重複なし）─────────────────────
-- WeeklySubmission = { week, team_id, class_id, slot, submitter_count }
-- week は date_trunc('week', ...) = その週の月曜日
create or replace function public.admin_weekly_submissions()
returns table (
  week            date,
  team_id         uuid,
  class_id        smallint,
  slot            smallint,
  submitter_count bigint
)
language sql security definer set search_path = public as $$
  select
    date_trunc('week', r.recorded_at)::date as week,
    t.id       as team_id,
    t.class_id,
    t.slot,
    count(distinct r.participant_id) as submitter_count
  from responses r
  join teams t on t.id = r.team_id
  group by date_trunc('week', r.recorded_at)::date, t.id, t.class_id, t.slot
  order by week;
$$;

-- ── ③ 班ごとの数値の偏り（プラス計 / マイナス計 / 差引）───────
-- TeamBalance = { team_id, class_id, slot, pos_sum, neg_sum, total_sum,
--                 value_count, response_count }
-- scores(smallint[]) を unnest して符号ごとに合計する。
create or replace function public.admin_team_score_balance()
returns table (
  team_id        uuid,
  class_id       smallint,
  slot           smallint,
  pos_sum        bigint,
  neg_sum        bigint,
  total_sum      bigint,
  value_count    bigint,
  response_count bigint
)
language sql security definer set search_path = public as $$
  select
    t.id       as team_id,
    t.class_id,
    t.slot,
    coalesce(sum(v.val) filter (where v.val > 0), 0) as pos_sum,
    coalesce(sum(v.val) filter (where v.val < 0), 0) as neg_sum,
    coalesce(sum(v.val), 0)                          as total_sum,
    count(v.val)                                     as value_count,
    count(distinct r.id)                             as response_count
  from teams t
  left join responses r on r.team_id = t.id
  left join lateral unnest(r.scores) as v(val) on true
  group by t.id, t.class_id, t.slot
  order by t.class_id, t.slot;
$$;

-- ── ④ クラス名の変更 ─────────────────────────────────────────
create or replace function public.admin_update_class_label(p_class_id int, p_label text)
returns void
language sql security definer set search_path = public as $$
  update public.classes set label = p_label where id = p_class_id::smallint;
$$;

-- ── ⑤ 班名の変更（班メンバー以外でも管理者として変更可）──────
create or replace function public.admin_update_team_name(p_team_id uuid, p_name text)
returns void
language sql security definer set search_path = public as $$
  update public.teams set name = p_name where id = p_team_id;
$$;

-- ── ⑥ 学期リセット：responses と participants を全削除 ────────
-- パスワード必須。★下の 'CHANGE_ME_RESET_PASSWORD' を運用側で必ず変更すること。
create or replace function public.admin_reset_semester(p_password text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_password is distinct from 'CHANGE_ME_RESET_PASSWORD' then
    raise exception 'invalid password';
  end if;
  delete from public.responses;
  delete from public.participants;
end $$;

-- ── 実行権限（匿名authクライアントから呼べるように）──────────
grant execute on function public.admin_team_stats()                       to anon, authenticated;
grant execute on function public.admin_weekly_submissions()               to anon, authenticated;
grant execute on function public.admin_team_score_balance()               to anon, authenticated;
grant execute on function public.admin_update_class_label(int, text)      to anon, authenticated;
grant execute on function public.admin_update_team_name(uuid, text)       to anon, authenticated;
grant execute on function public.admin_reset_semester(text)               to anon, authenticated;

-- PostgREST にスキーマ変更を反映（関数が404になる時に実行）
notify pgrst, 'reload schema';
