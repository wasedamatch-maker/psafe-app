// lib/adminPsafe.ts
// 管理画面専用のデータ操作関数。SECURITY DEFINER 関数経由のみ。
import { supabase } from "./supabaseClient";

export type TeamStat = {
  team_id: string;
  class_id: number;
  slot: number;
  name: string | null;
  member_count: number;
  response_count: number;
};

export type WeeklySubmission = {
  week: string;          // その週の月曜日（YYYY-MM-DD）
  team_id: string;
  class_id: number;
  slot: number;
  submitter_count: number; // その週に提出した人数（重複なし）
};

/** 全クラス・全チームの参加者数と記録数を取得 */
export async function adminGetTeamStats(): Promise<TeamStat[]> {
  const { data, error } = await supabase.rpc("admin_team_stats");
  if (error) throw error;
  return data as TeamStat[];
}

/** 週ごと・班ごとの提出人数（誰が提出したかではなく、何人提出したか） */
export async function adminGetWeeklySubmissions(): Promise<WeeklySubmission[]> {
  const { data, error } = await supabase.rpc("admin_weekly_submissions");
  if (error) throw error;
  return data as WeeklySubmission[];
}

/** クラス名の変更 */
export async function adminUpdateClassLabel(classId: number, label: string): Promise<void> {
  const { error } = await supabase.rpc("admin_update_class_label", {
    p_class_id: classId,
    p_label: label.trim(),
  });
  if (error) throw error;
}

/** チーム名の変更（管理者権限・班メンバー以外でも可） */
export async function adminUpdateTeamName(teamId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc("admin_update_team_name", {
    p_team_id: teamId,
    p_name: name.trim(),
  });
  if (error) throw error;
}

/** 学期リセット：responses と participants を全削除（パスワード必須） */
export async function adminResetSemester(password: string): Promise<void> {
  const { error } = await supabase.rpc("admin_reset_semester", {
    p_password: password,
  });
  if (error) throw error;
}
