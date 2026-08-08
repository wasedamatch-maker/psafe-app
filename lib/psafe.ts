// lib/psafe.ts
// 心理的安全性トラッカー：Supabaseデータ層。スキーマ(schema.sql)にそのまま対応。
// 個人の値・メモは本人のみ(RLS)、班の共有はばらつきだけ(RPC経由)。
import { supabase } from "./supabaseClient";

export const ITEM_COUNT = 7;

export type Team = { id: string; slot: number; name: string | null };
export type MyResponse = { id: string; recorded_at: string; scores: number[]; memo: string | null };
export type Spread = { item_index?: number; week?: string; dispersion: number; n: number };

// ── 匿名セッションの確保（アプリ起動時に1回だけ呼ぶ）──────────────
// 既存セッションがあればそれを使い、無いときだけ匿名サインイン。
// → 同じ端末では同じ匿名ユーザが保たれ、自己履歴が紐づき続ける（persistSession）。
//   重複した匿名ユーザを作らないよう、必ず getSession で確認してから。
export async function ensureAnonSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user!;
}

// ── 選択画面（クラス・班）──────────────────────────────────────
export async function getClasses() {
  const { data, error } = await supabase.from("classes").select("id,label").order("id");
  if (error) throw error;
  return data;
}
export async function getTeams(classId: number): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams").select("id,slot,name").eq("class_id", classId).order("slot");
  if (error) throw error;
  return data as Team[];
}

// ── 本人確認つき 登録 / 復帰 ───────────────────────────────────
// 本人 = 班の中で一意なニックネーム＋PIN。RPC が成功時にこの端末(auth.uid())を
// 参加者にひも付け、participant_id を返す。別端末でも名前＋PINで継続できる。
export type MyParticipant = {
  participant_id: string;
  team_id: string;
  nickname: string | null;
  teams: { class_id: number; slot: number; name: string | null };
};

// はじめて：名前＋PINで新規登録
export async function registerParticipant(teamId: string, nickname: string, pin: string): Promise<string> {
  const { data, error } = await supabase.rpc("register_participant", {
    p_team: teamId, p_nickname: nickname, p_pin: pin,
  });
  if (error) throw error;
  return data as string;
}

// 別端末から継続：名前＋PINで照合してひも付け
export async function claimParticipant(teamId: string, nickname: string, pin: string): Promise<string> {
  const { data, error } = await supabase.rpc("claim_participant", {
    p_team: teamId, p_nickname: nickname, p_pin: pin,
  });
  if (error) throw error;
  return data as string;
}

// 再訪時に、この端末にひも付く参加者（班・ニックネーム）を復元。未参加なら null。
export async function getMyParticipant(): Promise<MyParticipant | null> {
  const { data, error } = await supabase
    .from("participant_devices")
    .select("participant_id, participants(id, team_id, nickname, teams(class_id, slot, name))")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const p = data.participants as unknown as {
    id: string; team_id: string; nickname: string | null;
    teams: { class_id: number; slot: number; name: string | null };
  };
  return {
    participant_id: p.id,
    team_id: p.team_id,
    nickname: p.nickname,
    teams: p.teams,
  };
}

// ── 記録（1回のセッション）────────────────────────────────────
// scores は長さ7・各 -50..50（中央0 = 初対面）。memo は本人専用。
export async function saveResponse(participantId: string, teamId: string, scores: number[], memo: string) {
  if (!participantId) throw new Error("no participant");
  if (scores.length !== ITEM_COUNT) throw new Error(`scores must be length ${ITEM_COUNT}`);
  const { error } = await supabase.from("responses").insert({
    participant_id: participantId,
    team_id: teamId,
    scores,
    memo: memo.trim() || null,
  });
  if (error) throw error;
}

// ── 自己理解：自分の全回答（RLSで自動的に自分の行だけ返る）──────────
export async function getMyResponses(): Promise<MyResponse[]> {
  const { data, error } = await supabase
    .from("responses")
    .select("id, recorded_at, scores, memo")
    .order("recorded_at", { ascending: true });
  if (error) throw error;
  return data as MyResponse[];
}

// ── 班・クラスの共有：ばらつきのみ（RPC。生データは絶対に返らない）────
export async function getTeamItemSpread(teamId: string): Promise<Spread[]> {
  const { data, error } = await supabase.rpc("team_item_spread", { p_team: teamId });
  if (error) throw error;
  return data as Spread[];
}
export async function getTeamSpreadTimeline(teamId: string): Promise<Spread[]> {
  const { data, error } = await supabase.rpc("team_spread_timeline", { p_team: teamId });
  if (error) throw error;
  return data as Spread[];
}
// 週ごと×項目ごとのばらつき（新規RPC。未作成の環境では [] を返して画面を壊さない）
export async function getTeamItemSpreadTimeline(teamId: string): Promise<Spread[]> {
  const { data, error } = await supabase.rpc("team_item_spread_timeline", { p_team: teamId });
  if (error) { console.error(error); return []; }
  return data as Spread[];
}
export async function getClassSpreadTimeline(classId: number): Promise<Spread[]> {
  const { data, error } = await supabase.rpc("class_spread_timeline", { p_class: classId });
  if (error) throw error;
  return data as Spread[];
}

// ── チーム名（SECURITY DEFINER 関数経由で更新）────────────────────
export async function updateTeamName(teamId: string, name: string) {
  const { error } = await supabase.rpc("admin_update_team_name", {
    p_team_id: teamId,
    p_name: name.trim() || null,
  });
  if (error) throw error;
}
