-- ════════════════════════════════════════════════════════════════
--  マイグレーション：ニックネーム＋PINで「別端末でも継続」
--
--  目的：本人の識別子を「端末セッション(auth.uid())」から
--        「班の中で一意なニックネーム＋PIN」に切り替える。
--        別端末・別ブラウザでも 名前＋PIN で本人確認して継続できる。
--
--  プライバシー維持のキモ：
--   - 生スコア・メモは「本人だけが読める」を維持する。
--   - そのために auth.uid() 直結だった RLS を、
--     participant_devices（端末→参加者の橋渡し）経由の判定に置き換える。
--   - PIN は pgcrypto(bcrypt) でハッシュ化。平文は保存も返却もしない。
--
--  ★これは「本番の既存DB」に対して流すマイグレーション（ALTER中心）。
--    まっさらな新規構築は db/schema.sql 側に同じ結果が入っている。
--
--  実行順に意味がある：先に橋渡しを作って既存ユーザーを引き継いでから
--  RLS を差し替える（途中でアクセスが切れないように）。
--  Supabase SQL Editor に、このファイルを丸ごと貼って1回で実行する。
-- ════════════════════════════════════════════════════════════════

-- 1) PIN ハッシュ用
create extension if not exists pgcrypto;

-- 2) participants に列追加 ＆ id を端末非依存の人IDへ
alter table public.participants
  add column if not exists nickname text,
  add column if not exists pin_hash text;

-- id は今後 auth.users に縛らない（別端末でも同じ人IDを使えるように）
alter table public.participants
  drop constraint if exists participants_id_fkey;
alter table public.participants
  alter column id set default gen_random_uuid();

-- ニックネームは「班の中で」一意（NULL は既存ユーザー分として許容）
create unique index if not exists participants_team_nickname_uniq
  on public.participants (team_id, nickname)
  where nickname is not null;

-- 3) 端末→参加者の橋渡し
create table if not exists public.participant_devices (
  participant_id uuid not null references public.participants(id) on delete cascade,
  auth_uid       uuid not null,
  linked_at      timestamptz not null default now(),
  primary key (participant_id, auth_uid)
);
create index if not exists participant_devices_auth_uid_idx
  on public.participant_devices (auth_uid);

alter table public.participant_devices enable row level security;
-- 自分の端末リンクだけ参照可。作成/削除は RPC(SECURITY DEFINER)経由のみ。
drop policy if exists "own device links" on public.participant_devices;
create policy "own device links" on public.participant_devices
  for select using (auth_uid = auth.uid());

-- 4) 既存データの引き継ぎ：既存参加者は id = 旧 auth.uid なので、
--    その端末のセッションが新RLS下でも自分の履歴を見続けられるようリンクを張る。
insert into public.participant_devices (participant_id, auth_uid)
  select id, id from public.participants
  on conflict do nothing;

-- 5) responses の RLS を橋渡し経由へ置換
drop policy if exists "own responses select" on public.responses;
drop policy if exists "own responses insert" on public.responses;
drop policy if exists "own responses update" on public.responses;
drop policy if exists "own responses delete" on public.responses;

create policy "own responses select" on public.responses for select
  using (participant_id in (
    select pd.participant_id from public.participant_devices pd
    where pd.auth_uid = auth.uid()));
create policy "own responses insert" on public.responses for insert
  with check (participant_id in (
    select pd.participant_id from public.participant_devices pd
    where pd.auth_uid = auth.uid()));
create policy "own responses update" on public.responses for update
  using (participant_id in (
    select pd.participant_id from public.participant_devices pd
    where pd.auth_uid = auth.uid()))
  with check (participant_id in (
    select pd.participant_id from public.participant_devices pd
    where pd.auth_uid = auth.uid()));
create policy "own responses delete" on public.responses for delete
  using (participant_id in (
    select pd.participant_id from public.participant_devices pd
    where pd.auth_uid = auth.uid()));

-- 6) participants の RLS を橋渡し経由へ置換
drop policy if exists "own participant select" on public.participants;
drop policy if exists "own participant insert" on public.participants;
drop policy if exists "own participant update" on public.participants;

-- 参照：自分がリンクしている参加者行だけ（pin_hash は列権限で別途遮断）
create policy "own participant select" on public.participants for select
  using (id in (
    select pd.participant_id from public.participant_devices pd
    where pd.auth_uid = auth.uid()));
-- 作成/更新は基本 RPC 経由。直接 update は自分の行のみ（班変更・名前編集の予備）。
create policy "own participant update" on public.participants for update
  using (id in (
    select pd.participant_id from public.participant_devices pd
    where pd.auth_uid = auth.uid()))
  with check (id in (
    select pd.participant_id from public.participant_devices pd
    where pd.auth_uid = auth.uid()));

-- teams の「チーム名編集」ポリシーの所属判定も橋渡し経由へ
drop policy if exists "team name editable by members" on public.teams;
create policy "team name editable by members" on public.teams
  for update using (
    exists (select 1
            from public.participant_devices pd
            join public.participants p on p.id = pd.participant_id
            where pd.auth_uid = auth.uid() and p.team_id = teams.id)
  ) with check (
    exists (select 1
            from public.participant_devices pd
            join public.participants p on p.id = pd.participant_id
            where pd.auth_uid = auth.uid() and p.team_id = teams.id)
  );

-- 7) pin_hash はクライアントに一切読ませない
--    ※テーブル全体の SELECT を外し、安全な列だけに限定して付け直す
--    （table 権限を持ったまま列を revoke しても効かないため）
revoke select on public.participants from anon, authenticated;
grant  select (id, team_id, nickname, joined_at) on public.participants to anon, authenticated;

-- 8) 本人確認つき 登録 / 復帰 RPC（SECURITY DEFINER）
--    どちらも成功時に「この端末(auth.uid())」を参加者にひも付けて id を返す。

-- 新規登録：名前＋PINで作成し、この端末をひも付ける
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

  -- この端末の既存リンクは張り替え（1端末＝1アクティブ参加者）
  delete from participant_devices where auth_uid = v_uid;
  insert into participant_devices (participant_id, auth_uid) values (v_pid, v_uid);
  return v_pid;
end $$;

-- 復帰：名前＋PINを照合し、この端末をひも付ける
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

-- 9) PostgREST にスキーマ再読込を通知
notify pgrst, 'reload schema';
