"use client";
import React, { useState, useEffect } from "react";
import { BarChart2, Users, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Pencil, CalendarCheck, Scale } from "lucide-react";
import { ensureAnonSession } from "@/lib/psafe";
import { getTeamSpreadTimeline, getTeamItemSpread } from "@/lib/psafe";
import type { Spread } from "@/lib/psafe";
import { adminGetTeamStats, adminGetWeeklySubmissions, adminGetTeamBalance, adminResetSemester, adminUpdateClassLabel, adminUpdateTeamName } from "@/lib/adminPsafe";
import type { TeamStat, WeeklySubmission, TeamBalance } from "@/lib/adminPsafe";
import { CLASSES } from "@/lib/constants";

const ITEMS = ["ミス", "問題提起", "異質性", "リスク", "援助要請", "妨害なし", "強み"];

export default function AdminPage() {
  const [stats, setStats] = useState<TeamStat[]>([]);
  const [weekly, setWeekly] = useState<WeeklySubmission[]>([]);
  const [balance, setBalance] = useState<TeamBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{ timeline: Spread[]; items: Spread[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resetPhase, setResetPhase] = useState<"idle" | "confirm" | "input">("idle");
  const [resetPw, setResetPw] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  // ローカルで編集中のクラスラベル・チーム名を管理
  const [classLabels, setClassLabels] = useState<Record<number, string>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string | null>>({});

  const loadStats = async () => {
    setLoading(true);
    try {
      await ensureAnonSession();
      const [s, w, b] = await Promise.all([
        adminGetTeamStats(),
        adminGetWeeklySubmissions(),
        adminGetTeamBalance(),
      ]);
      setStats(s);
      setWeekly(w);
      setBalance(b);
      // チーム名のローカル状態を初期化
      const names: Record<string, string | null> = {};
      s.forEach((t) => { names[t.team_id] = t.name; });
      setTeamNames(names);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // 画面を開いたら自動でデータ読み込み
  useEffect(() => { loadStats(); }, []);

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
            <InlineEdit
              value={classLabels[cls.id] ?? cls.label}
              labelStyle={S.classLabel}
              onSave={async (val) => {
                await adminUpdateClassLabel(cls.id, val);
                setClassLabels((prev) => ({ ...prev, [cls.id]: val }));
              }}
            />
            <span style={S.classSub}>{teams.reduce((s, t) => s + Number(t.member_count), 0)}人 / {teams.reduce((s, t) => s + Number(t.response_count), 0)}件</span>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ ...S.table, minWidth: 480 }}>
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
                    <td style={S.td}>
                      <InlineEdit
                        value={teamNames[t.team_id] ?? ""}
                        placeholder="未設定"
                        onSave={async (val) => {
                          await adminUpdateTeamName(t.team_id, val);
                          setTeamNames((prev) => ({ ...prev, [t.team_id]: val || null }));
                        }}
                      />
                    </td>
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
        </div>
      ))}

      {/* グループごとの数値の偏り */}
      <h2 style={{ ...S.h2, marginTop: 40, display: "flex", alignItems: "center", gap: 7 }}>
        <Scale size={18} color="#3a414c" /> グループごとの数値の偏り
      </h2>
      <p style={{ ...S.muted, marginTop: -6, marginBottom: 12 }}>
        各班で記録された値を「プラス側（そう思う）」と「マイナス側（そう思わない）」に分けて合計したものです。<br />
        差引合計がプラスなら全体的にポジティブ、マイナスならネガティブ寄りの傾向を表します。
      </p>
      {loading ? <p style={S.muted}>読み込み中…</p> : balance.every((b) => Number(b.value_count) === 0) ? (
        <p style={S.muted}>まだ記録がありません。</p>
      ) : byClass.map(({ cls, teams }) => (
        <BalanceMatrix
          key={cls.id}
          classLabel={classLabels[cls.id] ?? cls.label}
          teams={teams}
          teamNames={teamNames}
          balance={balance.filter((b) => b.class_id === cls.id)}
        />
      ))}

      {/* 週ごとの提出状況 */}
      <h2 style={{ ...S.h2, marginTop: 40, display: "flex", alignItems: "center", gap: 7 }}>
        <CalendarCheck size={18} color="#3a414c" /> 週ごとの提出状況
      </h2>
      <p style={{ ...S.muted, marginTop: -6, marginBottom: 12 }}>
        各回（水曜の授業日）に、班の何人が記録したかを表示します。<br />
        セルの数字＝提出人数／その班の参加者数。色が濃いほど提出率が高い回です。
      </p>
      {loading ? <p style={S.muted}>読み込み中…</p> : weekly.length === 0 ? (
        <p style={S.muted}>まだ記録がありません。</p>
      ) : byClass.map(({ cls, teams }) => (
        <WeeklyMatrix
          key={cls.id}
          classLabel={classLabels[cls.id] ?? cls.label}
          teams={teams}
          teamNames={teamNames}
          weekly={weekly.filter((w) => w.class_id === cls.id)}
        />
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
        管理画面URL: /admin（パスワード不要・URLを知っている人だけアクセスできます）
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

// ── インライン編集コンポーネント ─────────────────────────────────
function InlineEdit({ value, placeholder, labelStyle, onSave }: {
  value: string;
  placeholder?: string;
  labelStyle?: React.CSSProperties;
  onSave: (val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // 親から value が変わったら同期
  React.useEffect(() => { if (!editing) setVal(value); }, [value, editing]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(val);
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message
        : (e && typeof e === "object" && "message" in e) ? String((e as {message: unknown}).message)
        : JSON.stringify(e);
      setErrMsg(msg);
      setSaving(false);
      return; // editingのままにして入力を維持
    }
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input
            autoFocus
            value={val}
            onChange={(e) => { setVal(e.target.value); setErrMsg(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            placeholder={placeholder ?? ""}
            style={{ border: `1px solid ${errMsg ? "#B0814F" : "var(--line)"}`, borderRadius: 6, padding: "3px 8px", fontSize: 13, fontFamily: "var(--sans)", minWidth: 120 }}
          />
          <button style={{ ...S.ghostBtn, padding: "3px 10px", fontSize: 12 }} disabled={saving} onClick={save}>
            {saving ? "…" : "保存"}
          </button>
          <button style={{ ...S.ghostBtn, padding: "3px 8px", fontSize: 12 }} onClick={() => { setEditing(false); setErrMsg(""); }}>✕</button>
        </span>
        {errMsg && <span style={{ fontSize: 11, color: "#B0814F" }}>⚠ {errMsg}</span>}
      </span>
    );
  }

  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", ...labelStyle }}
      onClick={() => setEditing(true)}
      title="クリックして編集"
    >
      {value || <span style={{ color: "var(--muted)", fontStyle: "italic", fontWeight: "normal" }}>{placeholder ?? "未設定"}</span>}
      <Pencil size={11} style={{ color: "var(--muted)", opacity: flash ? 0 : 0.5, flexShrink: 0 }} />
      {flash && <span style={{ fontSize: 11, color: "var(--up)" }}>✓</span>}
    </span>
  );
}

// ── グループごとの数値の偏り（クラス1つ分）───────────────────────
function BalanceMatrix({ classLabel, teams, teamNames, balance }: {
  classLabel: string;
  teams: TeamStat[];
  teamNames: Record<string, string | null>;
  balance: TeamBalance[];
}) {
  const byTeam: Record<string, TeamBalance> = {};
  balance.forEach((b) => { byTeam[b.team_id] = b; });

  // 全班でのプラス側・マイナス側の最大絶対値（バーの正規化用）
  const maxAbs = Math.max(
    1,
    ...teams.map((t) => {
      const b = byTeam[t.team_id];
      return b ? Math.max(Number(b.pos_sum), Math.abs(Number(b.neg_sum))) : 0;
    })
  );

  const hasAny = teams.some((t) => byTeam[t.team_id] && Number(byTeam[t.team_id].value_count) > 0);
  if (!hasAny) {
    return (
      <div style={{ marginBottom: 18 }}>
        <p style={S.classLabel}>{classLabel}</p>
        <p style={{ ...S.muted, marginTop: 4 }}>まだ記録がありません。</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ ...S.classLabel, marginBottom: 6 }}>{classLabel}</p>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ ...S.table, minWidth: 540 }}>
          <thead>
            <tr>
              <th style={S.th}>班</th>
              <th style={{ ...S.th, minWidth: 150 }}>偏り（マイナス ← → プラス）</th>
              <th style={{ ...S.th, textAlign: "right" }}>マイナス計</th>
              <th style={{ ...S.th, textAlign: "right" }}>プラス計</th>
              <th style={{ ...S.th, textAlign: "right" }}>差引合計</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const b = byTeam[t.team_id];
              const pos = b ? Number(b.pos_sum) : 0;
              const neg = b ? Number(b.neg_sum) : 0;   // 負の数
              const total = b ? Number(b.total_sum) : 0;
              const name = teamNames[t.team_id] || `第${t.slot}班`;
              return (
                <tr key={t.team_id} style={S.tr}>
                  <td style={{ ...S.td, whiteSpace: "nowrap" }}>{name}</td>
                  <td style={S.td}>
                    <DivergingBar pos={pos} neg={neg} maxAbs={maxAbs} />
                  </td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", color: "#B0814F" }}>{neg}</td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", color: "#3C7B8B" }}>+{pos}</td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: total > 0 ? "#3C7B8B" : total < 0 ? "#B0814F" : "var(--muted)" }}>
                    {total > 0 ? "+" : ""}{total}
                  </td>
                </tr>
              );
            })}
            {/* クラス合計 */}
            {(() => {
              const sumPos = teams.reduce((s, t) => s + (byTeam[t.team_id] ? Number(byTeam[t.team_id].pos_sum) : 0), 0);
              const sumNeg = teams.reduce((s, t) => s + (byTeam[t.team_id] ? Number(byTeam[t.team_id].neg_sum) : 0), 0);
              const sumTotal = sumPos + sumNeg;
              return (
                <tr style={{ background: "#f3f4f7" }}>
                  <td style={{ ...S.td, fontWeight: 700, whiteSpace: "nowrap" }}>クラス合計</td>
                  <td style={S.td}></td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#B0814F" }}>{sumNeg}</td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#3C7B8B" }}>+{sumPos}</td>
                  <td style={{ ...S.td, textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: sumTotal > 0 ? "#3C7B8B" : sumTotal < 0 ? "#B0814F" : "var(--muted)" }}>
                    {sumTotal > 0 ? "+" : ""}{sumTotal}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 0を中心に、左＝マイナス側、右＝プラス側に伸びる横棒
function DivergingBar({ pos, neg, maxAbs }: { pos: number; neg: number; maxAbs: number }) {
  const posPct = (pos / maxAbs) * 50;
  const negPct = (Math.abs(neg) / maxAbs) * 50;
  return (
    <div style={{ position: "relative", height: 12, background: "#eef0f3", borderRadius: 4, minWidth: 120 }}>
      <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1.5, background: "var(--origin)", transform: "translateX(-50%)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: "50%", width: negPct + "%", background: "#B0814F", borderRadius: "4px 0 0 4px" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: posPct + "%", background: "#3C7B8B", borderRadius: "0 4px 4px 0" }} />
    </div>
  );
}

// ── 週ごとの提出マトリクス（クラス1つ分）─────────────────────────
function WeeklyMatrix({ classLabel, teams, teamNames, weekly }: {
  classLabel: string;
  teams: TeamStat[];
  teamNames: Record<string, string | null>;
  weekly: WeeklySubmission[];
}) {
  // 週（月曜日）の一覧を昇順で
  const weeks = Array.from(new Set(weekly.map((w) => w.week))).sort();
  // 「team_id|week」→ 提出人数 の参照表
  const cell: Record<string, number> = {};
  weekly.forEach((w) => { cell[`${w.team_id}|${w.week}`] = Number(w.submitter_count); });

  // 月曜日 → 水曜日（授業日）の表示文字列
  const wedLabel = (monday: string) => {
    const d = new Date(monday + "T00:00:00");
    d.setDate(d.getDate() + 2); // 水曜
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  if (weeks.length === 0) {
    return (
      <div style={{ marginBottom: 18 }}>
        <p style={S.classLabel}>{classLabel}</p>
        <p style={{ ...S.muted, marginTop: 4 }}>まだ記録がありません。</p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ ...S.classLabel, marginBottom: 6 }}>{classLabel}</p>
      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, position: "sticky", left: 0, background: "#f3f4f7" }}>授業日</th>
              {teams.map((t) => (
                <th key={t.team_id} style={{ ...S.th, textAlign: "center", whiteSpace: "nowrap" }}>
                  {teamNames[t.team_id] || `第${t.slot}班`}
                  <div style={{ fontSize: 10, fontWeight: 400, color: "var(--muted)" }}>{Number(t.member_count)}人</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((wk) => (
              <tr key={wk} style={S.tr}>
                <td style={{ ...S.td, fontWeight: 700, whiteSpace: "nowrap", position: "sticky", left: 0, background: "var(--surface)" }}>
                  {wedLabel(wk)}
                </td>
                {teams.map((t) => {
                  const count = cell[`${t.team_id}|${wk}`] ?? 0;
                  const total = Number(t.member_count);
                  const ratio = total > 0 ? count / total : 0;
                  const bg = count === 0 ? "transparent" : `rgba(60, 123, 139, ${0.12 + ratio * 0.5})`;
                  return (
                    <td key={t.team_id} style={{ ...S.td, textAlign: "center", background: bg, fontFamily: "monospace" }}>
                      {count === 0 ? <span style={{ color: "var(--muted)" }}>—</span> : <><b>{count}</b><span style={{ color: "var(--muted)", fontSize: 11 }}>/{total}</span></>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
