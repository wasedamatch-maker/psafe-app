"use client";
import React, { useState, useEffect } from "react";
import { BarChart2, Users, RefreshCw, Trash2, ChevronDown, ChevronUp, Lock, LogOut, AlertTriangle } from "lucide-react";
import { ensureAnonSession } from "@/lib/psafe";
import { getTeamSpreadTimeline, getTeamItemSpread } from "@/lib/psafe";
import type { Spread } from "@/lib/psafe";
import { adminGetTeamStats, adminResetSemester } from "@/lib/adminPsafe";
import type { TeamStat } from "@/lib/adminPsafe";
import { CLASSES, classLabel } from "@/lib/constants";

// 管理者パスワード（Vercelの環境変数 NEXT_PUBLIC_ADMIN_PASSWORD で上書き可）
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "psafe2025";

const ITEMS = ["ミス", "問題提起", "異質性", "リスク", "援助要請", "妨害なし", "強み"];

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [stats, setStats] = useState<TeamStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{ timeline: Spread[]; items: Spread[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resetPhase, setResetPhase] = useState<"idle" | "confirm" | "input">("idle");
  const [resetPw, setResetPw] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const login = () => {
    if (pwInput === ADMIN_PASSWORD) {
      setAuthed(true);
      loadStats();
    } else {
      setPwError("パスワードが違います");
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      await ensureAnonSession();
      const s = await adminGetTeamStats();
      setStats(s);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const toggleTeam = async (teamId: string) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
      setDetailData(null);
      return;
    }
    setExpandedTeam(teamId);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const [timeline, items] = await Promise.all([
        getTeamSpreadTimeline(teamId),
        getTeamItemSpread(teamId),
      ]);
      setDetailData({ timeline, items });
    } catch (e) {
      console.error(e);
    }
    setDetailLoading(false);
  };

  const handleReset = async () => {
    setResetBusy(true);
    setResetMsg("");
    try {
      await adminResetSemester(resetPw);
      setResetMsg("✅ 全データを削除しました。新学期の準備完了です。");
      setResetPhase("idle");
      setResetPw("");
      await loadStats();
    } catch (e: unknown) {
      setResetMsg("❌ " + (e instanceof Error ? e.message : "削除に失敗しました"));
    }
    setResetBusy(false);
  };

  // クラスごとにグループ化
  const byClass = CLASSES.map((cls) => ({
    cls,
    teams: stats.filter((s) => s.class_id === cls.id).sort((a, b) => a.slot - b.slot),
  }));

  const totalMembers = stats.reduce((s, t) => s + Number(t.member_count), 0);
  const totalResponses = stats.reduce((s, t) => s + Number(t.response_count), 0);

  if (!authed) {
    return (
      <div style={S.root}>
        <style>{CSS}</style>
        <div style={S.loginBox}>
          <Lock size={28} color="#7A828E" />
          <h2 style={S.loginTitle}>運営管理画面</h2>
          <p style={S.loginSub}>心理的安全性トラッカー</p>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(""); }}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="管理者パスワード"
            style={S.input}
            autoFocus
          />
          {pwError && <p style={S.errMsg}>{pwError}</p>}
          <button style={S.btn} onClick={login}>ログイン</button>
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* ヘッダー */}
      <div style={S.header}>
        <div>
          <div style={S.eyebrow}>ADMIN DASHBOARD</div>
          <h1 style={S.h1}>運営管理画面</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.ghostBtn} onClick={loadStats}><RefreshCw size={14} /> 更新</button>
          <button style={S.ghostBtn} onClick={() => setAuthed(false)}><LogOut size={14} /> ログアウト</button>
        </div>
      </div>

      {/* サマリーカード */}
      <div style={S.summaryRow}>
        <SummaryCard label="総参加者数" value={totalMembers} icon={<Users size={18} />} />
        <SummaryCard label="総記録数" value={totalResponses} icon={<BarChart2 size={18} />} />
        <SummaryCard label="クラス数" value={CLASSES.length} icon={<BarChart2 size={18} />} />
        <SummaryCard label="班数" value={stats.length} icon={<Users size={18} />} />
      </div>

      {/* クラス × 班 テーブル */}
      <h2 style={S.h2}>クラス・班ごとの状況</h2>
      {loading ? <p style={S.muted}>読み込み中…</p> : byClass.map(({ cls, teams }) => (
        <div key={cls.id} style={S.classBlock}>
          <div style={S.classHeader}>
            <span style={S.classLabel}>{cls.label}</span>
            <span style={S.classSub}>{teams.reduce((s, t) => s + Number(t.member_count), 0)}人 / {teams.reduce((s, t) => s + Number(t.response_count), 0)}件</span>
          </div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>班</th>
                <th style={S.th}>チーム名</th>
                <th style={S.th}>参加者</th>
                <th style={S.th}>記録数</th>
                <th style={S.th}>詳細</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <React.Fragment key={t.team_id}>
                  <tr style={S.tr}>
                    <td style={S.td}>第{t.slot}班</td>
                    <td style={S.td}>{t.name ?? <span style={{ color: "var(--muted)", fontStyle: "italic" }}>未設定</span>}</td>
                    <td style={{ ...S.td, textAlign: "center" }}>{Number(t.member_count)}</td>
                    <td style={{ ...S.td, textAlign: "center" }}>{Number(t.response_count)}</td>
                    <td style={{ ...S.td, textAlign: "center" }}>
                      <button style={S.expandBtn} onClick={() => toggleTeam(t.team_id)}>
                        {expandedTeam === t.team_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                  </tr>
                  {expandedTeam === t.team_id && (
                    <tr>
                      <td colSpan={5} style={S.detailCell}>
                        {detailLoading ? (
                          <p style={S.muted}>読み込み中…</p>
                        ) : detailData ? (
                          <TeamDetail timeline={detailData.timeline} items={detailData.items} />
                        ) : null}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {teams.length === 0 && (
                <tr><td colSpan={5} style={{ ...S.td, textAlign: "center", color: "var(--muted)" }}>データなし</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      {/* 学期リセット */}
      <h2 style={{ ...S.h2, marginTop: 40 }}>学期リセット</h2>
      <div style={S.dangerBox}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={20} color="#B0814F" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={S.dangerTitle}>全データを削除する</p>
            <p style={S.dangerDesc}>全クラス・全班の記録（responses）と参加情報（participants）をすべて削除します。<br />学期末・メンバー入れ替え時に使用してください。この操作は取り消せません。</p>
          </div>
        </div>

        {resetPhase === "idle" && (
          <button style={S.dangerBtn} onClick={() => setResetPhase("confirm")}>学期リセットを実行する</button>
        )}
        {resetPhase === "confirm" && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#B0814F", marginBottom: 8 }}>本当に全データを削除しますか？</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.dangerBtn} onClick={() => setResetPhase("input")}>はい、削除します</button>
              <button style={S.ghostBtn} onClick={() => setResetPhase("idle")}>キャンセル</button>
            </div>
          </div>
        )}
        {resetPhase === "input" && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13, color: "#48505c", marginBottom: 8 }}>確認のため管理者パスワードを入力してください</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                placeholder="管理者パスワード"
                style={{ ...S.input, flex: 1, margin: 0 }}
              />
              <button style={S.dangerBtn} disabled={resetBusy} onClick={handleReset}>
                {resetBusy ? "削除中…" : "削除実行"}
              </button>
              <button style={S.ghostBtn} onClick={() => { setResetPhase("idle"); setResetPw(""); }}>キャンセル</button>
            </div>
          </div>
        )}
        {resetMsg && <p style={{ marginTop: 10, fontSize: 13, color: resetMsg.startsWith("✅") ? "#3C7B8B" : "#B0814F" }}>{resetMsg}</p>}
      </div>

      <p style={{ ...S.muted, textAlign: "center", marginTop: 32, fontSize: 11 }}>
        管理画面URL: /admin　　デフォルトPW: psafe2025（Vercel環境変数 NEXT_PUBLIC_ADMIN_PASSWORD で変更可）
      </p>
    </div>
  );
}

// ── チーム詳細（展開時）────────────────────────────────────────
function TeamDetail({ timeline, items }: { timeline: Spread[]; items: Spread[] }) {
  const hasTimeline = timeline.length > 0;
  const hasItems = items.length > 0;
  const minN = hasItems ? Math.min(...items.map((s) => Number(s.n))) : 0;

  if (!hasTimeline && !hasItems) {
    return <p style={{ color: "var(--muted)", fontSize: 13 }}>まだ記録がありません（3人以上で集計開始）</p>;
  }

  return (
    <div style={{ padding: "12px 4px" }}>
      {minN < 3 && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
          ※ {minN}人分のデータがあります（3人以上で集計表示）
        </p>
      )}

      {hasTimeline && (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#48505c", marginBottom: 6 }}>ばらつきの推移（週ごと）</p>
          <MiniSpreadChart timeline={timeline} />
        </>
      )}

      {hasItems && minN >= 3 && (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#48505c", margin: "14px 0 6px" }}>項目ごとのばらつき（最新）</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {ITEMS.map((label, i) => {
              const s = items.find((sp) => sp.item_index === i + 1);
              const val = s ? Math.min(Number(s.dispersion) * 2, 100) : 0;
              return (
                <div key={label} style={{ display: "grid", gridTemplateColumns: "70px 1fr 60px", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#48505c" }}>{label}</span>
                  <div style={{ height: 7, background: "#eef0f3", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: val + "%", background: "#9aa6b2", borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", fontFamily: "monospace" }}>
                    {s ? Number(s.dispersion).toFixed(1) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MiniSpreadChart({ timeline }: { timeline: Spread[] }) {
  const W = 480, H = 80, pad = 12;
  const values = timeline.map((t) => Number(t.dispersion));
  const weeks = timeline.map((t) => t.week ? String(t.week).slice(5, 10) : "");
  const n = values.length;
  const maxV = Math.max(...values, 1);
  const x = (i: number) => pad + (n <= 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => (H - pad) - (v / maxV) * (H - 2 * pad);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} preserveAspectRatio="none">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#D3D7DF" strokeWidth={1} />
        <path d={line} fill="none" stroke="#3a4150" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="#7d6a52" />)}
      </svg>
      {n <= 8 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
          {weeks.map((w, i) => <span key={i}>{w}</span>)}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div style={S.summaryCard}>
      <div style={{ color: "var(--muted)", marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}>{label}</div>
    </div>
  );
}

// ── スタイル定数 ──────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: { maxWidth: 860, margin: "0 auto", padding: "28px 18px 80px", background: "var(--paper)", minHeight: "100vh", fontFamily: "var(--sans)", color: "var(--ink)", lineHeight: 1.6 },
  loginBox: { maxWidth: 340, margin: "80px auto", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: "36px 28px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  loginTitle: { fontSize: 22, fontWeight: 800, margin: 0 },
  loginSub: { fontSize: 13, color: "var(--muted)", margin: 0 },
  input: { width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 12px", fontSize: 14, fontFamily: "var(--sans)", background: "#fff", color: "var(--ink)", margin: "4px 0" },
  btn: { width: "100%", background: "var(--origin)", color: "#fff", border: 0, borderRadius: 9, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)" },
  errMsg: { fontSize: 12, color: "var(--down)", margin: 0 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 },
  eyebrow: { fontFamily: "monospace", fontSize: 11, letterSpacing: ".2em", color: "var(--muted)", marginBottom: 4 },
  h1: { fontSize: 24, fontWeight: 800, margin: 0 },
  h2: { fontSize: 16, fontWeight: 700, color: "#3a414c", margin: "28px 0 12px" },
  muted: { color: "var(--muted)", fontSize: 13 },
  summaryRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 8 },
  summaryCard: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: "16px 14px", textAlign: "center" as const },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontFamily: "var(--sans)", color: "var(--ink)", cursor: "pointer" },
  classBlock: { marginBottom: 20 },
  classHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 },
  classLabel: { fontWeight: 700, fontSize: 15, color: "var(--ink)" },
  classSub: { fontSize: 12, color: "var(--muted)" },
  table: { width: "100%", borderCollapse: "collapse", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" },
  th: { textAlign: "left" as const, fontSize: 12, fontWeight: 700, color: "var(--muted)", padding: "9px 12px", background: "#f3f4f7", borderBottom: "1px solid var(--line)" },
  td: { fontSize: 13, padding: "10px 12px", borderBottom: "1px solid var(--line)" },
  tr: { background: "var(--surface)" },
  expandBtn: { background: "none", border: "1px solid var(--line)", borderRadius: 6, padding: "3px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center" },
  detailCell: { padding: "8px 16px 16px", background: "#f8f9fb", borderBottom: "1px solid var(--line)" },
  dangerBox: { background: "#fdf6f0", border: "1px solid #e8c9a8", borderRadius: 12, padding: "20px 18px" },
  dangerTitle: { fontWeight: 700, fontSize: 15, color: "#7a3c10", margin: "0 0 6px" },
  dangerDesc: { fontSize: 13, color: "#6b4020", lineHeight: 1.7, margin: 0 },
  dangerBtn: { background: "#B0814F", color: "#fff", border: 0, borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)" },
};

const CSS = `
:root {
  --paper:#E7E9ED; --surface:#FCFCFD; --ink:#1E222A; --muted:#7A828E;
  --line:#D3D7DF; --origin:#262A32; --up:#3C7B8B; --down:#B0814F;
  --sans:"Hiragino Kaku Gothic ProN","Yu Gothic",-apple-system,"Noto Sans JP",system-ui,sans-serif;
}
* { box-sizing: border-box; }
@media (max-width: 600px) {
  .summary-row { grid-template-columns: repeat(2, 1fr) !important; }
}
`;
