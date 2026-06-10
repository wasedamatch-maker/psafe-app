"use client";
import React, { useState, useEffect, useMemo } from "react";
import { PenLine, Activity, Share2, Check, Copy, ChevronRight } from "lucide-react";
import {
  ensureAnonSession,
  getMyTeam,
  getTeams,
  joinTeam,
  saveResponse,
  getMyResponses,
  getTeamItemSpread,
  getTeamSpreadTimeline,
} from "@/lib/psafe";
import type { MyResponse, Spread, Team } from "@/lib/psafe";

import { CLASSES, classLabel } from "@/lib/constants";

const ITEMS = [
  { key: "ミス",     text: "ミスをしても、責められたり不利に扱われたりしない" },
  { key: "問題提起", text: "問題や言いにくいことも、口に出せる" },
  { key: "異質性",   text: "人と違っていても、拒絶されない" },
  { key: "リスク",   text: "リスクを取っても、安全だと感じる" },
  { key: "援助要請", text: "困ったとき、まわりに助けを求めやすい" },
  { key: "妨害なし", text: "自分の努力をわざと邪魔する人はいない" },
  { key: "強み",     text: "自分ならではの持ち味が、活かされている" },
];

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const fmt = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(Math.round(n));
const dirColor = (n: number) => (n > 1 ? "var(--up)" : n < -1 ? "var(--down)" : "var(--muted)");

export default function App() {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamSlot, setTeamSlot] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("record");
  const [draft, setDraft] = useState<number[]>(ITEMS.map(() => 0));
  const [memo, setMemo] = useState("");
  const [toast, setToast] = useState("");
  const [responses, setResponses] = useState<MyResponse[]>([]);
  const [itemSpread, setItemSpread] = useState<Spread[]>([]);
  const [timeline, setTimeline] = useState<Spread[]>([]);

  useEffect(() => {
    (async () => {
      try {
        await ensureAnonSession();
        const my = await getMyTeam();
        if (my) {
          setTeamId(my.team_id);
          const t = my.teams as unknown as { class_id: number; slot: number; name: string | null };
          setTeamName(t.name);
          setTeamSlot(t.slot);
          setClassId(t.class_id);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        const [r, is, tl] = await Promise.all([
          getMyResponses(),
          getTeamItemSpread(teamId),
          getTeamSpreadTimeline(teamId),
        ]);
        setResponses(r);
        setItemSpread(is);
        setTimeline(tl);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [teamId]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const handleJoinTeam = async (cId: number, slot: number) => {
    try {
      const teams = await getTeams(cId);
      const team = teams.find((t: Team) => t.slot === slot);
      if (!team) { flash("班が見つかりません"); return; }
      await joinTeam(team.id);
      setTeamId(team.id);
      setTeamName(team.name ?? null);
      setTeamSlot(slot);
      setClassId(cId);
    } catch (e) {
      console.error(e);
      flash("班への参加に失敗しました");
    }
  };

  const handleSave = async () => {
    if (!teamId) return;
    try {
      await saveResponse(teamId, draft, memo);
      const r = await getMyResponses();
      setResponses(r);
      setDraft(ITEMS.map(() => 0));
      setMemo("");
      flash("この回を記録しました");
      setView("self");
    } catch (e) {
      console.error(e);
      flash("保存に失敗しました");
    }
  };


  const refreshShare = async () => {
    if (!teamId) return;
    try {
      const [is, tl] = await Promise.all([
        getTeamItemSpread(teamId),
        getTeamSpreadTimeline(teamId),
      ]);
      setItemSpread(is);
      setTimeline(tl);
    } catch (e) { console.error(e); }
  };

  const sorted = useMemo(() =>
    [...responses].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()),
    [responses]);
  const overall = useMemo(() => sorted.map((s) => mean(s.scores)), [sorted]);

  if (loading) return <div className="root"><style>{CSS}</style><div className="empty">読み込み中…</div></div>;
  if (!teamId) return <div className="root"><style>{CSS}</style><Setup onDone={handleJoinTeam} /></div>;

  return (
    <div className="root">
      <style>{CSS}</style>

      <header className="head">
        <div className="topbar">
          <span className="eyebrow">EDMONDSON · 7 ITEMS</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ctx" style={{ cursor: "default" }}>
              {teamName ?? `${classLabel(classId)} · 第${teamSlot}班`}
            </span>
            <button className="ctx" onClick={() => {
              setTeamId(null); setTeamSlot(null); setClassId(null); setTeamName(null);
            }}>変更</button>
          </div>
        </div>
        <h1>あなたの感覚に合わせてスライドしてみよう！</h1>
        <p className="lede">「どちらでもない」を基準（0）として、班での「今」の感じ方を左右に置きます。点数ではなく、変化を測るためのもの。<b>数値は誰にも見えません。</b></p>
      </header>

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={view === "record"} className={view === "record" ? "on" : ""} onClick={() => setView("record")}><PenLine size={15} /> 記録する</button>
        <button role="tab" aria-selected={view === "self"} className={view === "self" ? "on" : ""} onClick={() => setView("self")}><Activity size={15} /> 自己理解</button>
        <button role="tab" aria-selected={view === "share"} className={view === "share" ? "on" : ""} onClick={() => { setView("share"); refreshShare(); }}><Share2 size={15} /> 班の共有</button>
      </nav>

      <main>
        {view === "record" ? <RecordView draft={draft} setDraft={setDraft} memo={memo} setMemo={setMemo} onSave={handleSave} />
          : view === "self" ? <SelfView sorted={sorted} overall={overall} />
          : <ShareView slot={teamSlot} itemSpread={itemSpread} timeline={timeline} />}
      </main>

      <footer className="foot">
        プロトタイプ／データはサーバ側に匿名で保存されます。名前は登録しません。
      </footer>

      {toast && <div className="toast"><Check size={14} /> {toast}</div>}
    </div>
  );
}


function Setup({ onDone }: { onDone: (classId: number, slot: number) => void }) {
  const [cls, setCls] = useState<number | null>(null);
  const [grp, setGrp] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [fetchedTeams, setFetchedTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const handleSelectClass = async (cId: number) => {
    setCls(cId);
    setGrp(null);
    setFetchedTeams([]);
    setTeamsLoading(true);
    try {
      const teams = await getTeams(cId);
      setFetchedTeams(teams);
    } catch (e) {
      console.error(e);
    }
    setTeamsLoading(false);
  };

  const go = async () => {
    if (!cls || !grp) return;
    setBusy(true);
    await onDone(cls, grp);
    setBusy(false);
  };

  const slotCount = CLASSES.find((c) => c.id === cls)?.slots ?? 4;
  const slots = Array.from({ length: slotCount }, (_, i) => i + 1);

  return (
    <section className="setup">
      <div className="eyebrow">SETUP</div>
      <h1>クラスと班を選ぶ</h1>
      <p className="lede">あなたの記録は、選んだ班の<b>匿名の集計</b>にだけ使われます。名前やメールは登録しません。</p>
      <div className="pick">
        <div className="pl">クラス</div>
        <div className="grid">
          {CLASSES.map((c) => (
            <button key={c.id} className={cls === c.id ? "sel" : ""} onClick={() => handleSelectClass(c.id)}>{c.label}</button>
          ))}
        </div>
      </div>
      <div className="pick">
        <div className="pl">班</div>
        <div className="grid">
          {!cls && <span style={{ fontSize: 12, color: "var(--muted)", padding: "10px 4px" }}>先にクラスを選んでください</span>}
          {cls && teamsLoading && <span style={{ fontSize: 12, color: "var(--muted)", padding: "10px 4px" }}>読み込み中…</span>}
          {cls && !teamsLoading && slots.map((g) => {
            const team = fetchedTeams.find((t) => t.slot === g);
            const label = team?.name ?? `第${g}班`;
            return (
              <button key={g} className={grp === g ? "sel" : ""} onClick={() => setGrp(g)}>{label}</button>
            );
          })}
        </div>
      </div>
      <button className="primary" disabled={!cls || !grp || busy} onClick={go}>
        {busy ? "参加中…" : <><span>はじめる</span> <ChevronRight size={16} /></>}
      </button>
      <p className="note">あとから「変更」でいつでも切り替えられます。</p>
    </section>
  );
}

function RecordView({ draft, setDraft, memo, setMemo, onSave }: {
  draft: number[]; setDraft: React.Dispatch<React.SetStateAction<number[]>>;
  memo: string; setMemo: React.Dispatch<React.SetStateAction<string>>; onSave: () => void;
}) {
  const set = (i: number, v: number) => setDraft((d) => d.map((x, k) => (k === i ? v : x)));
  return (
    <section className="card">
      <div className="axes">
        {ITEMS.map((it, i) => <Axis key={it.key} n={i + 1} text={it.text} value={draft[i]} onChange={(v) => set(i, v)} />)}
      </div>
      <label className="memo">
        <span>今日、班で何があった？<em>（任意・自分用のメモ）</em></span>
        <textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="一行でいい。後で振り返るときの手がかりになります。" />
      </label>
      <button className="primary" onClick={onSave}>この回を記録する</button>
    </section>
  );
}

function Axis({ n, text, value, onChange }: { n: number; text: string; value: number; onChange: (v: number) => void }) {
  const col = dirColor(value);
  return (
    <div className="axis">
      <div className="axis-head"><span className="num">{String(n).padStart(2, "0")}</span>{text}</div>
      <div className="track">
        <div className="baseline" />
        <div className="origin" />
        <input type="range" min={-50} max={50} step={1} value={value}
          style={{ "--thumb": col } as React.CSSProperties}
          aria-label={text} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
      <div className="ends"><span>そう思わない</span><span className="ozero">0 · どちらでもない</span><span>そう思う</span></div>
    </div>
  );
}

function SelfView({ sorted, overall }: { sorted: MyResponse[]; overall: number[] }) {
  if (sorted.length === 0) {
    return (
      <section className="card empty-card">
        <p>まだ記録がありません。<br />「記録する」から最初の回を残すと、ここに <b>0からの推移</b> が出ます。</p>
      </section>
    );
  }
  const cur = overall[overall.length - 1];
  const prev = overall.length > 1 ? overall[overall.length - 2] : 0;
  const avg = mean(overall);
  const first = overall[0];
  const last = sorted[sorted.length - 1];
  return (
    <section className="card">
      <div className="deltas">
        <Delta label="前回から" v={cur - prev} />
        <Delta label="自分の平均から" v={cur - avg} />
        <Delta label="初回から" v={cur - first} />
      </div>
      <Trend values={overall} />
      <h3 className="sub">いまの、項目ごとの振れ（0がどちらでもない）</h3>
      <div className="bars">
        {ITEMS.map((it, i) => <ItemBar key={it.key} label={it.key} v={last.scores[i]} />)}
      </div>
      <h3 className="sub">メモの履歴</h3>
      <ul className="log">
        {[...sorted].reverse().map((s) => (
          <li key={s.id}>
            <span className="d">{new Date(s.recorded_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</span>
            <span className="m">{s.memo || <em className="none">（メモなし）</em>}</span>
            <span className="o" style={{ color: dirColor(mean(s.scores)) }}>{fmt(mean(s.scores))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Delta({ label, v }: { label: string; v: number }) {
  return <div className="delta"><div className="dv" style={{ color: dirColor(v) }}>{fmt(v)}</div><div className="dl">{label}</div></div>;
}

function ItemBar({ label, v }: { label: string; v: number }) {
  const pct = (Math.abs(v) / 50) * 50;
  const col = dirColor(v);
  return (
    <div className="ib">
      <span className="ibl">{label}</span>
      <div className="ibt">
        <div className="ibc" />
        <div className="ibf" style={{ width: pct + "%", background: col, ...(v >= 0 ? { left: "50%" } : { right: "50%" }) }} />
      </div>
      <span className="ibv" style={{ color: col }}>{fmt(v)}</span>
    </div>
  );
}

function Trend({ values }: { values: number[] }) {
  const W = 640, H = 168, pad = 16, n = values.length;
  const x = (i: number) => pad + (n <= 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => H / 2 - (v / 50) * (H / 2 - pad);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <div className="trendwrap">
      <div className="trendcap"><span>総合（7項目の平均）の推移</span><span className="mono">0 = どちらでもない</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend" preserveAspectRatio="none">
        <line x1={pad} y1={y(25)} x2={W - pad} y2={y(25)} className="grid" />
        <line x1={pad} y1={y(-25)} x2={W - pad} y2={y(-25)} className="grid" />
        <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} className="originline" />
        <path d={path} className="line" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill={values[i] > 1 ? "var(--up)" : values[i] < -1 ? "var(--down)" : "var(--muted)"} />)}
      </svg>
    </div>
  );
}

function ShareView({ slot, itemSpread, timeline }: { slot: number | null; itemSpread: Spread[]; timeline: Spread[] }) {
  const [copied, setCopied] = useState(false);

  const spreadValues = timeline.map((t) => Number(t.dispersion));
  const minN = itemSpread.length > 0 ? Math.min(...itemSpread.map((s) => Number(s.n))) : 0;
  const hasEnoughData = minN >= 3;

  const ranked = ITEMS.map((it, i) => {
    const s = itemSpread.find((sp) => sp.item_index === i + 1);
    return { k: it.key, s: s ? Number(s.dispersion) : 0 };
  }).sort((a, b) => b.s - a.s);

  const text = `【第${slot}班 心理的安全性・週次サマリー（ばらつき）】
・感じ方のばらつき（標準偏差）を匿名で共有します。
・いま最も割れている観点:「${ranked[0]?.k ?? "—"}」。人による差が大きい。
・揃ってきた観点:「${ranked[ranked.length - 1]?.k ?? "—"}」。
※高い/低い（レベル）は出していません。「どれだけ感じ方が割れているか」だけを共有します。
※個人は特定できません。`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {}
  };

  return (
    <section className="card">
      <div className="banner">レベル（高い/低い）は出しません。班・クラスでは <b>ばらつき（どれだけ割れているか）だけ</b> を匿名で共有します。</div>
      {!hasEnoughData ? (
        <p className="note" style={{ textAlign: "center", padding: "20px 0" }}>
          班のメンバーが3人以上記録すると集計が表示されます。<br />（現在: {minN}人分）
        </p>
      ) : (
        <>
          {spreadValues.length > 0 && (
            <>
              <div className="trendcap"><span>第{slot}班・感じ方のばらつきの推移</span><span className="mono">下＝揃ってる</span></div>
              <SpreadChart values={spreadValues} />
            </>
          )}
          <h3 className="sub">いま、どの観点が割れている？</h3>
          <div className="bars">
            {ranked.map((r, i) => <SpreadBar key={r.k} label={r.k} s={Math.min(r.s * 2, 100)} top={i === 0} />)}
          </div>
          <p className="hint">割れている観点ほど「人によって感じ方が違う」場所。揃える対象ではなく、声をかける・確認する手がかりとして。</p>
          <h3 className="sub">クラスSlackへ貼る用</h3>
          <pre className="slack">{text}</pre>
          <button className="ghost" onClick={copy}>{copied ? <><Check size={15} /> コピーしました</> : <><Copy size={15} /> コピー</>}</button>
        </>
      )}
    </section>
  );
}

function SpreadChart({ values }: { values: number[] }) {
  const W = 640, H = 140, pad = 16, n = values.length;
  const maxV = Math.max(...values, 1);
  const x = (i: number) => pad + (n <= 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => (H - pad) - (v / maxV) * (H - 2 * pad);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `M ${pts[0][0]} ${H - pad} ` + pts.map((p) => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") + ` L ${pts[n - 1][0]} ${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" preserveAspectRatio="none">
      <path d={area} className="sfill" />
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="originline" />
      <path d={line} className="line" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3.5} className="sdot" />)}
    </svg>
  );
}

function SpreadBar({ label, s, top }: { label: string; s: number; top: boolean }) {
  return (
    <div className="ib">
      <span className="ibl">{label}</span>
      <div className="sbt"><div className="sbf" style={{ width: s + "%", background: top ? "var(--down)" : "#9aa6b2" }} /></div>
      <span className="ibv" style={{ color: top ? "var(--down)" : "var(--muted)" }}>{top ? "最も割れている" : ""}</span>
    </div>
  );
}

const CSS = `
:root{
  --paper:#E7E9ED; --surface:#FCFCFD; --ink:#1E222A; --muted:#7A828E;
  --line:#D3D7DF; --origin:#262A32; --up:#3C7B8B; --down:#B0814F;
  --sans:"Hiragino Kaku Gothic ProN","Yu Gothic",-apple-system,"Noto Sans JP",system-ui,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
.root{max-width:720px;margin:0 auto;padding:28px 18px 60px;background:var(--paper);color:var(--ink);font-family:var(--sans);min-height:100vh;-webkit-font-smoothing:antialiased;line-height:1.6}
.topbar{display:flex;justify-content:space-between;align-items:center}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.22em;color:var(--muted)}
.ctx{background:none;border:1px solid var(--line);border-radius:99px;padding:5px 12px;font-family:var(--sans);font-size:12px;color:var(--ink);cursor:pointer}
.ctx span{color:var(--up);margin-left:6px}
.head h1{font-size:27px;font-weight:800;letter-spacing:.01em;margin:.4em 0 .3em;line-height:1.25}
.head h1 .zero{font-family:var(--mono);color:var(--up);font-weight:700}
.lede{font-size:13.5px;color:#48505c;max-width:54ch;margin:0}
.lede b{color:var(--ink)}
.setup{padding:14px 4px}
.setup h1{font-size:26px;font-weight:800;margin:.4em 0 .3em}
.pick{margin:24px 0}
.pl{font-size:12.5px;font-weight:700;color:#48505c;margin-bottom:10px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.grid button{background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:15px 4px;font-family:var(--sans);font-size:14px;color:var(--ink);cursor:pointer;transition:border-color .12s,background .12s}
.grid button:hover{border-color:var(--up)}
.grid button.sel{background:var(--origin);color:#fff;border-color:var(--origin);font-weight:700}
.tabs{display:flex;gap:6px;margin:22px 0 16px;border-bottom:1px solid var(--line)}
.tabs button{display:flex;align-items:center;gap:6px;background:none;border:0;padding:9px 12px;font-family:var(--sans);font-size:13.5px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.tabs button.on{color:var(--ink);border-bottom-color:var(--origin);font-weight:700}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:22px 20px;box-shadow:0 1px 2px rgba(30,34,42,.04)}
.axes{display:flex;flex-direction:column;gap:21px}
.axis-head{font-size:14px;font-weight:600;display:flex;gap:9px;align-items:baseline;margin-bottom:11px}
.axis-head .num{font-family:var(--mono);font-size:11px;color:var(--muted);font-weight:500;flex:none}
.track{position:relative;height:26px;display:flex;align-items:center}
.baseline{position:absolute;left:0;right:0;height:1px;background:var(--line)}
.origin{position:absolute;left:50%;top:3px;bottom:3px;width:2px;background:var(--origin);transform:translateX(-50%);border-radius:1px}
.track input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:26px;background:transparent;margin:0;cursor:pointer}
.track input[type=range]::-webkit-slider-runnable-track{height:26px;background:transparent}
.track input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--surface);border:2.5px solid var(--thumb,var(--muted));box-shadow:0 1px 3px rgba(30,34,42,.18);margin-top:4px;transition:border-color .15s}
.track input[type=range]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--surface);border:2.5px solid var(--thumb,var(--muted));box-shadow:0 1px 3px rgba(30,34,42,.18)}
.track input[type=range]:focus-visible{outline:none}
.track input[type=range]:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px rgba(60,123,139,.25)}
.ends{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10.5px;color:var(--muted);margin-top:6px}
.ends .ozero{color:#9aa1ab}
.memo{display:block;margin:26px 0 18px}
.memo span{font-size:13.5px;font-weight:600;display:block;margin-bottom:7px}
.memo em{font-weight:400;color:var(--muted);font-style:normal;font-size:12px}
.memo textarea{width:100%;border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-family:var(--sans);font-size:13.5px;resize:vertical;background:#fff;color:var(--ink)}
.memo textarea:focus{outline:none;border-color:var(--up)}
.primary{width:100%;display:flex;align-items:center;justify-content:center;gap:6px;background:var(--origin);color:#fff;border:0;border-radius:10px;padding:13px;font-family:var(--sans);font-size:14.5px;font-weight:700;cursor:pointer;letter-spacing:.02em}
.primary:hover{background:#11141a}
.primary:disabled{background:#c4c9d1;cursor:not-allowed}
.deltas{display:flex;gap:10px;margin-bottom:22px}
.delta{flex:1;text-align:center;border:1px solid var(--line);border-radius:10px;padding:13px 6px;background:#fff}
.delta .dv{font-family:var(--mono);font-size:24px;font-weight:700;line-height:1}
.delta .dl{font-size:11px;color:var(--muted);margin-top:6px}
.trendwrap{margin:6px 0 8px}
.trendcap{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:6px}
.trendcap .mono{font-family:var(--mono);font-size:10.5px}
.trend{width:100%;display:block}
.trend .grid{stroke:var(--line);stroke-width:1;stroke-dasharray:2 5}
.trend .originline{stroke:var(--origin);stroke-width:1.5}
.trend .line{fill:none;stroke:#3a4150;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.trend .sfill{fill:rgba(176,129,79,.10)}
.trend .sdot{fill:#7d6a52}
.sub{font-size:13px;font-weight:700;color:#3a414c;margin:26px 0 12px}
.bars{display:flex;flex-direction:column;gap:9px}
.ib{display:grid;grid-template-columns:62px 1fr 78px;align-items:center;gap:10px}
.ibl{font-size:12.5px;color:#48505c}
.ibt{position:relative;height:8px;background:#eef0f3;border-radius:4px}
.ibc{position:absolute;left:50%;top:-3px;bottom:-3px;width:1.5px;background:var(--origin);transform:translateX(-50%)}
.ibf{position:absolute;top:0;bottom:0;border-radius:4px}
.sbt{position:relative;height:8px;background:#eef0f3;border-radius:4px;overflow:hidden}
.sbf{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
.ibv{font-family:var(--mono);font-size:10.5px;text-align:right}
.hint{font-size:12px;color:var(--muted);line-height:1.7;margin:10px 0 0}
.log{list-style:none;padding:0;margin:0;border-top:1px solid var(--line)}
.log li{display:grid;grid-template-columns:46px 1fr 38px;gap:10px;align-items:center;padding:10px 2px;border-bottom:1px solid var(--line)}
.log .d{font-family:var(--mono);font-size:11px;color:var(--muted)}
.log .m{font-size:13px}
.log .none{color:#aeb4bd;font-style:normal}
.log .o{font-family:var(--mono);font-size:12px;text-align:right}
.empty,.empty-card{text-align:center;color:var(--muted);font-size:14px}
.empty-card{padding:40px 20px}
.empty-card p{margin:0 0 18px;line-height:1.7}
.ghost{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid var(--line);border-radius:9px;padding:10px 16px;font-family:var(--sans);font-size:13.5px;color:var(--ink);cursor:pointer}
.ghost:hover{border-color:var(--up);color:var(--up)}
.banner{background:#eef3f4;border:1px solid #cfe0e3;border-radius:9px;padding:11px 13px;font-size:12.5px;color:#34555c;margin-bottom:18px}
.banner b{color:#264449}
.slack{background:#f5f6f8;border:1px solid var(--line);border-radius:9px;padding:13px;font-family:var(--mono);font-size:11.5px;line-height:1.7;white-space:pre-wrap;color:#3a414c;margin:0 0 12px}
.note{font-size:11.5px;color:var(--muted);line-height:1.7;margin:16px 0 0}
.note b{color:#5a616c}
.foot{text-align:center;font-size:11px;color:var(--muted);margin-top:22px;line-height:1.7}
.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--origin);color:#fff;display:flex;align-items:center;gap:7px;padding:10px 16px;border-radius:99px;font-size:13px;box-shadow:0 4px 16px rgba(30,34,42,.25)}
@media (max-width:480px){.head h1{font-size:23px}.deltas{gap:7px}.delta .dv{font-size:20px}.ib{grid-template-columns:56px 1fr 70px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;
