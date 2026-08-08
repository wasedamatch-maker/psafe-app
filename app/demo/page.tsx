"use client";
// app/demo/page.tsx
// 運営チーム体験用のダミーページ。Supabaseには一切アクセスせず、
// すべてブラウザ内（メモリ）だけで動く。本番データには影響しない。
import React, { useState, useMemo } from "react";
import { PenLine, Activity, Share2, Check, Copy, RotateCcw, FlaskConical } from "lucide-react";

const ITEMS = [
  { key: "ミス",     text: "ミスをしても、責められたり不利に扱われたりしない" },
  { key: "問題提起", text: "問題や言いにくいことも、口に出せる" },
  { key: "異質性",   text: "人と違っていても、拒絶されない" },
  { key: "リスク",   text: "リスクを取っても、安全だと感じる" },
  { key: "援助要請", text: "困ったとき、まわりに助けを求めやすい" },
  { key: "妨害なし", text: "自分の努力をわざと邪魔する人はいない" },
  { key: "強み",     text: "自分ならではの持ち味が、活かされている" },
];

type Resp = { id: string; recorded_at: string; scores: number[]; memo: string | null };
type Spread = { item_index?: number; week?: string; dispersion: number; n: number };

// 7項目それぞれの線の色（項目別グラフの凡例と共有）
const ITEM_COLORS = ["#3C7B8B", "#B0814F", "#6C8E68", "#9A6FA6", "#C56B5A", "#4E6A9B", "#7A828E"];

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const fmt = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±") + Math.abs(Math.round(n));
const dirColor = (n: number) => (n > 1 ? "var(--up)" : n < -1 ? "var(--down)" : "var(--muted)");

// その日が属する週の月曜日（YYYY-MM-DD）。
function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const dow = (d.getDay() + 6) % 7; // 0=月曜
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 記録を週ごとにまとめる（同じ週に複数回なら平均）。
type WeekAgg = { key: string; label: string; overall: number; items: number[] };
function buildWeekly(sorted: Resp[]): WeekAgg[] {
  const map = new Map<string, Resp[]>();
  for (const r of sorted) {
    const k = weekStart(r.recorded_at);
    (map.get(k) ?? map.set(k, []).get(k)!).push(r);
  }
  return [...map.keys()].sort().map((k) => {
    const rs = map.get(k)!;
    const items = ITEMS.map((_, i) => mean(rs.map((r) => r.scores[i])));
    const d = new Date(k);
    return { key: k, label: `${d.getMonth() + 1}/${d.getDate()}`, overall: mean(items), items };
  });
}

// 班の「週ごと×項目ごとのばらつき」(Spread[]) を、週×7項目の表に組み替える。
type ItemSeries = { weeks: string[]; series: { key: string; values: (number | null)[] }[] };
function pivotItemTimeline(rows: Spread[]): ItemSeries {
  const weekKeys = [...new Set(rows.map((r) => r.week!).filter(Boolean))].sort();
  const weeks = weekKeys.map((w) => {
    const d = new Date(w);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const series = ITEMS.map((it, i) => {
    const values = weekKeys.map((w) => {
      const row = rows.find((r) => r.week === w && r.item_index === i + 1);
      return row ? Number(row.dispersion) : null;
    });
    return { key: it.key, values };
  });
  return { weeks, series };
}

// ── ダミーの初期データ（最初から数回分入っている）─────────────────
const SEED_RESPONSES: Resp[] = [
  { id: "d1", recorded_at: "2026-05-13", scores: [-12, -20, -5, -15, -8, 0, 5], memo: "初回。まだ様子見で、あまり話せていない。" },
  { id: "d2", recorded_at: "2026-05-20", scores: [-5, -10, 0, -8, 2, 5, 10], memo: "少しずつ意見が出るように。" },
  { id: "d3", recorded_at: "2026-05-27", scores: [3, -2, 8, 0, 10, 12, 15], memo: "班で雑談が増えてきた。" },
  { id: "d4", recorded_at: "2026-06-03", scores: [10, 8, 15, 6, 18, 20, 22], memo: "だいぶ安心して発言できる。" },
];
const SEED_ITEMSPREAD: Spread[] = [
  { item_index: 1, dispersion: 18, n: 5 },
  { item_index: 2, dispersion: 24, n: 5 },
  { item_index: 3, dispersion: 9, n: 5 },
  { item_index: 4, dispersion: 15, n: 5 },
  { item_index: 5, dispersion: 7, n: 5 },
  { item_index: 6, dispersion: 11, n: 5 },
  { item_index: 7, dispersion: 6, n: 5 },
];
const SEED_TIMELINE: Spread[] = [
  { week: "2026-05-11", dispersion: 22, n: 5 },
  { week: "2026-05-18", dispersion: 19, n: 5 },
  { week: "2026-05-25", dispersion: 15, n: 5 },
  { week: "2026-06-01", dispersion: 12, n: 5 },
];
// 週ごと×項目ごとのばらつき（体験用ダミー）。項目ごとに揃い方が違う様子を見せる。
const SEED_ITEM_TIMELINE: Spread[] = (() => {
  const weeks = ["2026-05-11", "2026-05-18", "2026-05-25", "2026-06-01"];
  // 各項目の週次ばらつき（だんだん揃う／割れが残る、など項目ごとに違う動き）
  const perItem = [
    [20, 17, 13, 9],   // ミス：順調に揃う
    [26, 24, 22, 20],  // 問題提起：割れが残りやすい
    [12, 10, 9, 7],    // 異質性
    [18, 16, 15, 13],  // リスク
    [10, 9, 7, 6],     // 援助要請：早く揃う
    [15, 14, 12, 11],  // 妨害なし
    [9, 8, 8, 6],      // 強み
  ];
  const rows: Spread[] = [];
  perItem.forEach((vals, i) =>
    vals.forEach((v, wi) => rows.push({ week: weeks[wi], item_index: i + 1, dispersion: v, n: 5 }))
  );
  return rows;
})();

export default function DemoApp() {
  const [view, setView] = useState("record");
  const [draft, setDraft] = useState<number[]>(ITEMS.map(() => 0));
  const [memo, setMemo] = useState("");
  const [toast, setToast] = useState("");
  const [responses, setResponses] = useState<Resp[]>(SEED_RESPONSES);
  const [saving, setSaving] = useState(false);
  const [chkTranslate, setChkTranslate] = useState(false);
  const [chkDevice, setChkDevice] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const handleSave = async () => {
    if (saving) return;
    if (!chkTranslate || !chkDevice) { flash("上の確認事項にチェックしてください"); return; }
    setSaving(true);
    // あえて2秒待つ：送信中だと分かるようにし、誤って何度も送るのを防ぐ
    await new Promise((res) => setTimeout(res, 2000));
    const now = new Date();
    const newResp: Resp = {
      id: "d" + now.getTime(),
      recorded_at: now.toISOString(),
      scores: [...draft],
      memo: memo.trim() || null,
    };
    setResponses((r) => [...r, newResp]);
    setDraft(ITEMS.map(() => 0));
    setMemo("");
    setChkTranslate(false);
    setChkDevice(false);
    setSaving(false);
    flash("この回を記録しました（体験用・保存はされません）");
    setView("self");
  };

  const resetDemo = () => {
    setResponses(SEED_RESPONSES);
    setDraft(ITEMS.map(() => 0));
    setMemo("");
    setChkTranslate(false);
    setChkDevice(false);
    setView("record");
    flash("デモを初期状態に戻しました");
  };

  const sorted = useMemo(() =>
    [...responses].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()),
    [responses]);
  const overall = useMemo(() => sorted.map((s) => mean(s.scores)), [sorted]);

  return (
    <div className="root">
      <style>{CSS}</style>

      <div className="demobar">
        <FlaskConical size={15} />
        <span><b>これは体験用のダミー画面です。</b>入力しても保存されず、本番のデータには一切影響しません。</span>
        <button onClick={resetDemo}><RotateCcw size={13} /> 最初に戻す</button>
      </div>

      <header className="head">
        <div className="topbar">
          <span className="eyebrow">EDMONDSON · 7 ITEMS</span>
          <span className="ctx" style={{ cursor: "default" }}>あお · デモ班</span>
        </div>
        <h1>あなたの感覚に合わせてスライドしてみよう！</h1>
        <p className="lede">「どちらでもない」を基準（0）として、班での「今」の感じ方を左右に置きます。点数ではなく、変化を測るためのもの。<b>数値は誰にも見えません。</b></p>
      </header>

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={view === "record"} className={view === "record" ? "on" : ""} onClick={() => setView("record")}><PenLine size={15} /> 記録する</button>
        <button role="tab" aria-selected={view === "self"} className={view === "self" ? "on" : ""} onClick={() => setView("self")}><Activity size={15} /> 自己理解</button>
        <button role="tab" aria-selected={view === "share"} className={view === "share" ? "on" : ""} onClick={() => setView("share")}><Share2 size={15} /> 班の共有</button>
      </nav>

      <main>
        {view === "record" ? <RecordView draft={draft} setDraft={setDraft} memo={memo} setMemo={setMemo} onSave={handleSave} saving={saving} chkTranslate={chkTranslate} setChkTranslate={setChkTranslate} chkDevice={chkDevice} setChkDevice={setChkDevice} />
          : view === "self" ? <SelfView sorted={sorted} overall={overall} />
          : <ShareView slot={1} itemSpread={SEED_ITEMSPREAD} timeline={SEED_TIMELINE} itemTimeline={SEED_ITEM_TIMELINE} />}
      </main>

      <footer className="foot">
        体験用デモ／このページの入力はどこにも保存されません。
      </footer>

      {toast && <div className="toast"><Check size={14} /> {toast}</div>}
    </div>
  );
}

function RecordView({ draft, setDraft, memo, setMemo, onSave, saving, chkTranslate, setChkTranslate, chkDevice, setChkDevice }: {
  draft: number[]; setDraft: React.Dispatch<React.SetStateAction<number[]>>;
  memo: string; setMemo: React.Dispatch<React.SetStateAction<string>>; onSave: () => void;
  saving: boolean;
  chkTranslate: boolean; setChkTranslate: React.Dispatch<React.SetStateAction<boolean>>;
  chkDevice: boolean; setChkDevice: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const set = (i: number, v: number) => setDraft((d) => d.map((x, k) => (k === i ? v : x)));
  const ready = chkTranslate && chkDevice && !saving;
  return (
    <section className="card">
      <div className="checklist">
        <p className="cl-title">⚠ 記録する前に、下の2つに必ずチェックしてください</p>
        <p className="cl-required">※ 両方にチェックしないと記録できません（必須）</p>
        <label className="cl-item">
          <input type="checkbox" checked={chkTranslate} disabled={saving} onChange={(e) => setChkTranslate(e.target.checked)} />
          <span>ブラウザの<b>翻訳機能はオフ</b>になっていますか？（Chromeなどの自動翻訳がオンだと、正しく動作しないことがあります）</span>
        </label>
        <label className="cl-item">
          <input type="checkbox" checked={chkDevice} disabled={saving} onChange={(e) => setChkDevice(e.target.checked)} />
          <span><b>前回と同じ端末・同じブラウザ</b>で開いていますか？（あなたの過去の記録を引き継ぐために必要です）</span>
        </label>
      </div>
      <div className="axes">
        {ITEMS.map((it, i) => <Axis key={it.key} n={i + 1} text={it.text} value={draft[i]} onChange={(v) => set(i, v)} />)}
      </div>
      <label className="memo">
        <span>今日、班で何があった？<em>（任意・自分用のメモ）</em></span>
        <textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="一行でいい。後で振り返るときの手がかりになります。" />
      </label>
      <button className="primary" onClick={onSave} disabled={!ready}>
        {saving ? "記録しています… そのままお待ちください" : "この回を記録する"}
      </button>
      {!saving && (!chkTranslate || !chkDevice) && (
        <p className="note cl-warn" style={{ textAlign: "center" }}>上の2つの確認にチェックすると、ボタンが押せるようになります。</p>
      )}
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

function SelfView({ sorted, overall }: { sorted: Resp[]; overall: number[] }) {
  const [mode, setMode] = useState<"total" | "weekly">("total");
  const [active, setActive] = useState<boolean[]>(ITEMS.map(() => true));
  const toggle = (i: number) => setActive((a) => a.map((v, k) => (k === i ? !v : v)));
  const weeks = useMemo(() => buildWeekly(sorted), [sorted]);

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

      <div className="seg" role="tablist">
        <button role="tab" aria-selected={mode === "total"} className={mode === "total" ? "on" : ""} onClick={() => setMode("total")}>総合</button>
        <button role="tab" aria-selected={mode === "weekly"} className={mode === "weekly" ? "on" : ""} onClick={() => setMode("weekly")}>週ごと</button>
      </div>

      {mode === "total" ? (
        <>
          <Trend values={overall} caption="総合（7項目の平均）の推移" />
          <h3 className="sub">いまの、項目ごとの振れ（0がどちらでもない）</h3>
          <div className="bars">
            {ITEMS.map((it, i) => <ItemBar key={it.key} label={it.key} v={last.scores[i]} />)}
          </div>
        </>
      ) : (
        <>
          <Trend values={weeks.map((w) => w.overall)} caption="週ごとの総合（その週の平均）の推移" />
          <div className="trendcap"><span>週ごと・項目別の平均（0がどちらでもない）</span><span className="mono">上＝そう思う</span></div>
          <MultiLineChart
            centered
            active={active}
            labels={weeks.map((w) => w.label)}
            series={ITEMS.map((it, i) => ({ key: it.key, values: weeks.map((w) => w.items[i]) }))}
          />
          <ItemLegend active={active} onToggle={toggle} />
          <p className="hint">凡例をタップすると、その項目の線を表示／非表示できます。</p>
          <h3 className="sub">週ごと・項目別の平均（表）</h3>
          <WeeklyItemTable weeks={weeks} />
          <p className="hint">同じ週に複数回記録した場合は、その週の平均です。横にスライドすると全項目が見られます。</p>
        </>
      )}

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

function WeeklyItemTable({ weeks }: { weeks: WeekAgg[] }) {
  return (
    <div className="wtbl-wrap">
      <table className="wtbl">
        <thead>
          <tr>
            <th className="wk">週</th>
            {ITEMS.map((it) => <th key={it.key}>{it.key}</th>)}
            <th>総合</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.key}>
              <td className="wk">{w.label}</td>
              {w.items.map((v, i) => (
                <td key={i} style={{ color: dirColor(v) }}>{fmt(v)}</td>
              ))}
              <td style={{ color: dirColor(w.overall), fontWeight: 700 }}>{fmt(w.overall)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

function Trend({ values, caption = "総合（7項目の平均）の推移" }: { values: number[]; caption?: string }) {
  const W = 640, H = 168, pad = 16, n = values.length;
  const x = (i: number) => pad + (n <= 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => H / 2 - (v / 50) * (H / 2 - pad);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <div className="trendwrap">
      <div className="trendcap"><span>{caption}</span><span className="mono">0 = どちらでもない</span></div>
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

// 7項目を1枚にまとめた折れ線グラフ。
// centered=true: 中央0基準（個人の項目別平均）／ false: 下端0基準（ばらつき）。
function MultiLineChart({ series, labels, centered, maxV, active }: {
  series: { key: string; values: (number | null)[] }[];
  labels: string[];
  centered: boolean;
  maxV?: number;
  active?: boolean[];
}) {
  const W = 640, H = centered ? 168 : 150, pad = 16, n = labels.length;
  const shown = series.filter((_, si) => !active || active[si]);
  const allVals = shown.flatMap((s) => s.values).filter((v): v is number => v != null);
  const top = maxV ?? Math.max(...allVals, 1);
  const x = (i: number) => pad + (n <= 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const y = centered
    ? (v: number) => H / 2 - (v / 50) * (H / 2 - pad)
    : (v: number) => (H - pad) - (v / top) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" preserveAspectRatio="none">
      {centered
        ? <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} className="originline" />
        : <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} className="originline" />}
      {series.map((s, si) => {
        if (active && !active[si]) return null;
        const pts = s.values
          .map((v, i) => (v == null ? null : [x(i), y(v)] as [number, number]))
          .filter((p): p is [number, number] => p != null);
        if (pts.length === 0) return null;
        const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
        return (
          <g key={s.key}>
            <path d={path} fill="none" stroke={ITEM_COLORS[si]} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill={ITEM_COLORS[si]} />)}
          </g>
        );
      })}
    </svg>
  );
}

// タップで各項目の表示/非表示を切り替えられる凡例。
function ItemLegend({ active, onToggle }: { active: boolean[]; onToggle: (i: number) => void }) {
  return (
    <div className="legend">
      {ITEMS.map((it, i) => (
        <button
          key={it.key}
          type="button"
          className={"lg" + (active[i] ? "" : " off")}
          aria-pressed={active[i]}
          onClick={() => onToggle(i)}
        >
          <i style={{ background: active[i] ? ITEM_COLORS[i] : "transparent", borderColor: ITEM_COLORS[i] }} />
          {it.key}
        </button>
      ))}
    </div>
  );
}

function ShareView({ slot, itemSpread, timeline, itemTimeline }: { slot: number | null; itemSpread: Spread[]; timeline: Spread[]; itemTimeline: Spread[] }) {
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"total" | "weekly">("total");
  const [active, setActive] = useState<boolean[]>(ITEMS.map(() => true));
  const toggle = (i: number) => setActive((a) => a.map((v, k) => (k === i ? !v : v)));

  const spreadValues = timeline.map((t) => Number(t.dispersion));
  const itemPivot = useMemo(() => pivotItemTimeline(itemTimeline), [itemTimeline]);
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
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={mode === "total"} className={mode === "total" ? "on" : ""} onClick={() => setMode("total")}>総合</button>
            <button role="tab" aria-selected={mode === "weekly"} className={mode === "weekly" ? "on" : ""} onClick={() => setMode("weekly")}>週ごと</button>
          </div>

          {mode === "total" ? (
            <>
              <h3 className="sub">いま、どの観点が割れている？（全体）</h3>
              <div className="bars">
                {ranked.map((r, i) => <SpreadBar key={r.k} label={r.k} s={Math.min(r.s * 2, 100)} top={i === 0} />)}
              </div>
              <p className="hint">割れている観点ほど「人によって感じ方が違う」場所。揃える対象ではなく、声をかける・確認する手がかりとして。</p>
              <h3 className="sub">クラスSlackへ貼る用</h3>
              <pre className="slack">{text}</pre>
              <button className="ghost" onClick={copy}>{copied ? <><Check size={15} /> コピーしました</> : <><Copy size={15} /> コピー</>}</button>
            </>
          ) : (
            <>
              {itemPivot.weeks.length > 0 ? (
                <>
                  <div className="trendcap"><span>第{slot}班・項目ごとの「ばらつき」の推移（週ごと）</span><span className="mono">下＝揃ってる</span></div>
                  <MultiLineChart centered={false} active={active} labels={itemPivot.weeks} series={itemPivot.series} />
                  <ItemLegend active={active} onToggle={toggle} />
                  <p className="hint">凡例をタップすると項目の線を表示／非表示できます。線が下がっている観点は班の感じ方が揃ってきたサイン。上がっている観点は、人による差が広がっている合図です。</p>
                </>
              ) : spreadValues.length > 0 ? (
                <>
                  <div className="trendcap"><span>第{slot}班・感じ方のばらつきの推移（週ごと・全体）</span><span className="mono">下＝揃ってる</span></div>
                  <SpreadChart values={spreadValues} />
                  <p className="hint">週を追うごとに下がっていれば、班の感じ方が揃ってきているサイン。上がっていれば、割れが広がっている合図です。</p>
                </>
              ) : (
                <p className="note" style={{ textAlign: "center", padding: "20px 0" }}>
                  まだ週ごとの推移を出せる記録がありません。<br />記録がたまると、ここに週ごとの折れ線が出ます。
                </p>
              )}
            </>
          )}
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
.root{width:100%;min-width:0;max-width:720px;margin:0 auto;padding:28px 18px 60px;background:var(--paper);color:var(--ink);font-family:var(--sans);min-height:100vh;-webkit-font-smoothing:antialiased;line-height:1.6}
.demobar{display:flex;align-items:center;gap:9px;background:#fbf3e6;border:1px solid #e6c79b;color:#7a4f16;border-radius:10px;padding:10px 13px;font-size:12.5px;margin-bottom:18px}
.demobar b{color:#5e3d10}
.demobar span{flex:1}
.demobar button{display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #e0c191;border-radius:8px;padding:6px 11px;font-family:var(--sans);font-size:12px;color:#7a4f16;cursor:pointer;white-space:nowrap}
.demobar button:hover{background:#fcf7ee}
.topbar{display:flex;justify-content:space-between;align-items:center}
.eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.22em;color:var(--muted)}
.ctx{background:none;border:1px solid var(--line);border-radius:99px;padding:5px 12px;font-family:var(--sans);font-size:12px;color:var(--ink)}
.head h1{font-size:27px;font-weight:800;letter-spacing:.01em;margin:.4em 0 .3em;line-height:1.25}
.lede{font-size:13.5px;color:#48505c;max-width:54ch;margin:0}
.lede b{color:var(--ink)}
.tabs{display:flex;gap:6px;margin:22px 0 16px;border-bottom:1px solid var(--line)}
.tabs button{display:flex;align-items:center;gap:6px;background:none;border:0;padding:9px 12px;font-family:var(--sans);font-size:13.5px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.tabs button.on{color:var(--ink);border-bottom-color:var(--origin);font-weight:700}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:22px 20px;box-shadow:0 1px 2px rgba(30,34,42,.04)}
.checklist{background:#fdecec;border:1px solid #e6a9a9;border-radius:11px;padding:14px 15px;margin-bottom:22px}
.cl-title{font-size:13px;font-weight:800;color:#c0271b;margin:0 0 4px}
.cl-required{font-size:11.5px;font-weight:700;color:#c0271b;margin:0 0 10px}
.cl-item{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:#5e2b27;line-height:1.6;cursor:pointer;padding:5px 0}
.cl-item input[type=checkbox]{margin-top:2px;width:17px;height:17px;flex:none;accent-color:#c0271b;cursor:pointer}
.cl-item b{color:#c0271b}
.cl-warn{color:#c0271b!important;font-weight:700}
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
.legend{display:flex;flex-wrap:wrap;gap:6px 10px;margin:8px 0 2px}
.legend .lg{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:#48505c;background:none;border:0;padding:3px 5px;border-radius:7px;cursor:pointer;font-family:var(--sans);-webkit-tap-highlight-color:transparent}
.legend .lg:hover{background:#eef0f3}
.legend .lg i{width:11px;height:11px;border-radius:3px;flex:none;display:inline-block;border:1.5px solid transparent}
.legend .lg.off{color:#b3b8c0;text-decoration:line-through}
.seg{display:inline-flex;background:#eef0f3;border:1px solid var(--line);border-radius:99px;padding:3px;gap:2px;margin:0 0 4px}
.seg button{background:none;border:0;padding:7px 18px;font-family:var(--sans);font-size:13px;color:var(--muted);cursor:pointer;border-radius:99px;transition:background .12s,color .12s}
.seg button.on{background:var(--surface);color:var(--ink);font-weight:700;box-shadow:0 1px 2px rgba(30,34,42,.10)}
.wtbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:6px 0 4px;border:1px solid var(--line);border-radius:10px}
.wtbl{border-collapse:collapse;width:max-content;min-width:100%;font-size:12px}
.wtbl th,.wtbl td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:7px 10px;text-align:center;white-space:nowrap;font-family:var(--mono)}
.wtbl tr:last-child th,.wtbl tr:last-child td{border-bottom:0}
.wtbl th:last-child,.wtbl td:last-child{border-right:0}
.wtbl thead th{background:#f5f6f8;font-weight:700;color:#48505c;font-size:11.5px;position:sticky;top:0}
.wtbl .wk{background:#fafbfc;color:var(--muted);position:sticky;left:0;z-index:1}
.wtbl thead th.wk{z-index:2}
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
