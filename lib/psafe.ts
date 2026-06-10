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

// ── 班に参加 / 所属の確認・変更 ────────────────────────────────
// participants.id = auth.uid()。upsert なので「班の変更」も同じ関数でOK。
export async function joinTeam(teamId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("no session");
  const { error } = await supabase
    .from("participants")
    .upsert({ id: user.id, team_id: teamId }, { onConflict: "id" });
  if (error) throw error;
}

// 再訪時に所属班を復元。未参加なら null。
export async function getMyTeam() {
  const { data, error } = await supabase
    .from("participants")
    .select("team_id, teams(class_id, slot, name)")
    .maybeSingle();
  if (error) throw error;
  return data; // { team_id, teams: { class_id, slot, name } } | null
}

// ── 記録（1回のセッション）────────────────────────────────────
// scores は長さ7・各 -50..50（中央0 = 初対面）。memo は本人専用。
export async function saveResponse(teamId: string, scores: number[], memo: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("no session");
  if (scores.length !== ITEM_COUNT) throw new Error(`scores must be length ${ITEM_COUNT}`);
  const { error } = await supabase.from("responses").insert({
    participant_id: user.id,
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
export async function getClassSpreadTimeline(classId: number): Promise<Spread[]> {
  const { data, error } = await supabase.rpc("class_spread_timeline", { p_class: classId });
  if (error) throw error;
  return data as Spread[];
}

// ── チーム名（後から決まる。所属メンバーのみ更新可：RLS）────────────
export async function updateTeamName(teamId: string, name: string) {
  const { error } = await supabase
    .from("teams").update({ name: name.trim() || null }).eq("id", teamId);
  if (error) throw error;
}
