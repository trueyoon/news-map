// 🔮 AI 예측 창 (2026-11-20 사용자 요청: "요약이 너무 길어서 옆에 '예측' 칸을 따로 — 우리가 모은 상품이 앞으로 어떻게 될지")
// - 검색창 옆 [오늘의 주요뉴스 TOP5][☀ 요약][🔮 예측] — 누르면 요약처럼 창이 열림(같은 자리, 하나가 열리면 다른 것은 닫힘).
// - 내용: 오늘 한 줄 · 성적표(ai_forecast_score: 기간마다 채점된 수·맞은 비율 vs 동전 50%) · [1주 | 1달] ·
//   상품 카드(시세 / 뉴스 주제 ETF / 부동산 3개월): 방향·확률·이유·틀리게 되는 조건·이 상품 지난 성적·근거 펼치기 · 다음에 볼 것 · 주의.
// - 자료: ai-brief.js 의 AINOTE(ai_notes 최신 한 줄) + 성적표(1시간마다). Claude 를 부르지 않음(비용 0). index.html 수정 없음(ai-brief.js 가 이 파일을 불러옴).
// ⚠️ 화면 파일: 정규식에 (?<= (?<! 금지(옛 아이폰).
(() => {
  const A = globalThis.AINOTE;
  if (!A || typeof el !== "function") return;
  const H = 3600e3;
  const TX = {
    ko: { btn: "🔮 예측", head: "AI 예측 (참고용)", none: "아직 AI 예측이 없어요. 매일 아침 7시 반쯤 만들어져요.", loading: "불러오는 중…", close: "닫기",
      hz: { "1w": "1주 뒤", "1m": "1달 뒤" }, g: { price: "시세", etf: "뉴스 주제 ETF", re: "부동산 (3개월 뒤 달)" },
      pend: d => `기준: ${d} 종가(공식 값이 들어오면 채점)`, typ: (h, v) => `(${h} 보통 움직임 ${v})`,
      focus: "🎯 주목할 예측", focusHow: "확률 58% 이상이고 과거 비슷한 상황이 10번 이상 있었던 것만 — 근거가 또렷한 것.",
      noFocus: "🎯 오늘은 근거가 또렷한 예측이 없어요(모두 반반에 가까움). 이런 날은 방향을 단정하지 않는 게 맞아요.",
      hold: n => `😐 판단 보류 — 거의 반반 (${n}개, 눌러서 보기)`, med: "중간값", clamped: "AI 확률을 과거 통계 쪽으로 당김",
      basis: (y, s, h, n, up, p) => `과거 ${Math.round(y)}년, ${s} ${h}: ${n}번 중 ${up}번 상승(${p}%)`,
      how: "읽는 법: \"상승 확률 55%\" = 기간 뒤 값이 지금보다 높을 가능성이 100번 중 55번꼴이라는 뜻(0.5배 오른다는 뜻 아님). \"예상 +1.2%\" = AI가 본 기간 뒤 변화율. 50%에 가까울수록 AI도 잘 모른다는 뜻.",
      score: (h, n, k, p) => `${h} 예측 성적: ${n}번 채점 중 ${k}번 맞음(${p}%) · 동전 던지기 50%`, noScore: "아직 채점된 예측이 없어요 — 1주 예측은 5거래일 뒤부터 매일 밤 9시 반에 채점돼요.",
      mine: (n, k) => `이 상품 지난 성적 ${k}/${n}`, flip: "이러면 틀려요", base: v => `예측할 때 값 ${v}`, watch: "다음에 볼 것",
      note: "AI(Claude)가 이 사이트의 기록 숫자만으로 낸 예측이에요. 확률은 AI 스스로 매긴 것이고, 채점 기록이 쌓이기 전엔 믿을 만한지 몰라요. 상승·하락 = 기간 뒤 값이 예측할 때 값보다 높을지·낮을지, 확률이 50%에 가까울수록 AI도 잘 모른다는 뜻. 사라·팔라는 뜻이 아니에요.",
      old: d => `${d}일 전 예측` },
    en: { btn: "🔮 Forecast", head: "AI forecast (for reference)", none: "No AI forecast yet. It is made every morning around 7:25 KST.", loading: "Loading…", close: "Close",
      hz: { "1w": "1 week", "1m": "1 month" }, g: { price: "Prices", etf: "News-theme ETFs", re: "Real estate (month 3 months later)" },
      pend: d => `baseline: ${d} close (graded once the official value arrives)`, typ: (h, v) => `(usual ${h} move ${v})`,
      focus: "🎯 Forecasts worth noting", focusHow: "Only those at 58%+ with at least 10 similar past situations.",
      noFocus: "🎯 No forecast with clear evidence today (all near 50/50).",
      hold: n => `😐 On hold — near 50/50 (${n}, tap to show)`, med: "median", clamped: "AI probability pulled toward the base rate",
      basis: (y, s, h, n, up, p) => `past ${Math.round(y)} yrs, ${s} (${h}): up ${up} of ${n} (${p}%)`,
      how: "How to read: \"up, 55% likely\" = 55 in 100 chance the value ends higher than now (not +55%). \"exp. +1.2%\" = the AI's expected change. Near 50% means the AI is unsure.",
      score: (h, n, k, p) => `${h} record: ${k} of ${n} graded right (${p}%) · coin flip 50%`, noScore: "No forecast graded yet — 1-week forecasts are graded nightly from 5 trading days on.",
      mine: (n, k) => `this item so far ${k}/${n}`, flip: "Wrong if", base: v => `value at forecast ${v}`, watch: "Check next",
      note: "Forecast by AI (Claude) using only this site's recorded numbers (text in Korean). Probabilities are the AI's own; until graded records pile up, reliability is unknown. Up/down = whether the value will be higher/lower than at forecast time; near 50% means the AI is unsure. Not a recommendation.",
      old: d => `${d} day(s) old` },
    ja: { btn: "🔮 予測", head: "AI予測（参考）", none: "AI予測はまだありません。毎朝7時半ごろ作られます。", loading: "読み込み中…", close: "閉じる",
      hz: { "1w": "1週後", "1m": "1か月後" }, g: { price: "相場", etf: "ニューステーマETF", re: "不動産（3か月後の月）" },
      pend: d => `基準：${d}の終値（公式値が入ったら採点）`, typ: (h, v) => `（${h}の普段の動き ${v}）`,
      focus: "🎯 注目の予測", focusHow: "確率58%以上かつ過去の似た状況が10回以上あるものだけ。",
      noFocus: "🎯 今日は根拠のはっきりした予測がありません（すべて五分五分に近い）。",
      hold: n => `😐 判断保留 — ほぼ五分五分（${n}件、押して表示）`, med: "中央値", clamped: "AIの確率を過去統計側に寄せた",
      basis: (y, s, h, n, up, p) => `過去${Math.round(y)}年、${s}（${h}）：${n}回中${up}回上昇（${p}%）`,
      how: "読み方：「上昇 確率55%」＝期間後の値が今より高い可能性が100回中55回ほど（55%上がるという意味ではない）。「予想 +1.2%」＝AIが見た変化率。50%に近いほどAIも分からないという意味。",
      score: (h, n, k, p) => `${h}の成績：採点${n}回中${k}回的中（${p}%）・コイン投げ50%`, noScore: "採点済みの予測はまだありません。1週予測は5営業日後から毎晩採点されます。",
      mine: (n, k) => `この商品の成績 ${k}/${n}`, flip: "外れる条件", base: v => `予測時の値 ${v}`, watch: "次に見ること",
      note: "AI（Claude）が当サイトの記録の数字だけで出した予測です（韓国語）。確率はAI自身の見立てで、採点記録が貯まるまで信頼性は不明です。上昇・下落＝期間後の値が予測時より高いか低いか。50%に近いほどAIも分からないという意味。売買の勧めではありません。",
      old: d => `${d}日前の予測` },
  };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];
  const kstDay = t => new Date(t + 9 * H).toISOString().slice(0, 10);

  // ── 버튼 + 창 (☀ 요약 바로 뒤) ──
  const btn = el("button", "fc-btn", tx("btn"));
  btn.type = "button"; btn.id = "aiFcBtn"; btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "aiFc");
  const pop = el("section", "rf-pop brief fc");
  pop.id = "aiFc"; pop.hidden = true; pop.tabIndex = -1; pop.setAttribute("role", "dialog");
  (function mount(tries = 0) {                             // ☀ 요약 버튼이 생긴 뒤 그 바로 뒤에(없으면 검색창 뒤)
    const after = document.getElementById("briefBtn");
    if (!after && tries < 40) return setTimeout(() => mount(tries + 1), 250);
    (after || document.getElementById("rfTop5Btn") || document.getElementById("q")).after(btn);
    (document.getElementById("app") || document.body).append(pop);
  })();

  // 성적표(1시간마다)
  let score = null, scoreAt = 0;
  async function loadScore() {
    if (score && Date.now() - scoreAt < H) return score;
    try {
      const { data, error } = await db.from("ai_forecast_score").select("horizon,kind,pid,n,hits,hit_pct,avg_prob");
      if (!error) { score = data || []; scoreAt = Date.now(); }
    } catch { /* 다음에 */ }
    return score;
  }

  let hz = local.get("aiFcHz", "1w");
  if (!["1w", "1m"].includes(hz)) hz = "1w";
  const fmt = v => Number(v).toLocaleString(undefined, { maximumFractionDigits: Math.abs(Number(v)) < 100 ? 2 : 0 });
  function kindOf(pid) { return pid.startsWith("etf:") ? "etf" : pid.startsWith("re:") ? "re" : "price"; }

  function cardOf(n, f) {
    const c = el("article", "fc-card");          // 방향 색은 안 씀(기존 화면의 오름·내림 색이 매매 신호처럼 보여서)
    c.dataset.pid = f.pid;
    const top = c.appendChild(el("div", "fc-top"));
    top.append(el("b", null, f.name || f.pid));
    top.append(el("span", `fc-call fc-${f.call}`, `${A.tx("call")[f.call]} ${A.tx("prob")(f.prob)}`));   // 상승 빨강 · 하락 파랑
    const e = A.expText(f);                              // 예상 변화율 + 그 기간 보통 움직임 크기(판 4부터)
    if (e || f.typical != null) {
      const ex = c.appendChild(el("div", "fc-exp"));
      if (e) ex.append(el("b", `fc-${f.call}`, A.tx("exp")(e)));
      if (f.typical != null) ex.append(el("span", null, ` ${tx("typ")(tx("hz")[f.horizon] || "", `±${f.typical}${f.unit || "%"}`)}`));
    }
    const fact = [...n.factMap.values()].find(x => x.pid === f.pid);
    const baseV = fact ? (fact.value ?? fact.etf_close ?? fact.median_price_per_m2_manwon) : null;
    const meta = [];
    // 오늘 장 소식(M)이 있으면 코스피·국내 ETF 는 오늘 종가가 기준(서버 forecastRows 와 같게)
    const mAt = [...n.factMap.values()].filter(x => x.id?.startsWith("M") && x.at).map(x => Date.parse(x.at)).sort((a, b) => b - a)[0];
    const pendDay = mAt ? kstDay(mAt) : null, baseDay = fact?.as_of || fact?.etf_close_day;
    if ((f.pid === "KOSPI" || f.pid.startsWith("etf:")) && pendDay && baseDay && pendDay > baseDay) meta.push(tx("pend")(pendDay.slice(5).replace("-", "/")));
    else if (baseV != null) meta.push(tx("base")(`${fmt(baseV)}${f.pid.startsWith("re:") ? "만원/㎡" : ""}`));
    const mine = (score || []).find(s => s.pid === f.pid && s.horizon === f.horizon);
    if (mine?.n) meta.push(tx("mine")(mine.n, mine.hits));
    if (meta.length) c.append(el("div", "fc-meta", meta.join(" · ")));
    if (f.basis) {                                       // 과거 통계 근거(판 5부터): "과거 10년, 하루 큰 급락 뒤 1주: 23번 중 15번 상승(65%), 중간값 +2.1%"
      const b = f.basis, med = b.median_pct == null ? "" : `, ${tx("med")} ${b.median_pct > 0 ? "+" : ""}${b.median_pct}%`;
      c.append(el("p", "fc-basis", `📊 ${tx("basis")(b.years, b.situation, A.tx("hz")[f.horizon] || "", b.n, b.up, b.up_pct)}${med}${f.clamped ? ` · ${tx("clamped")}` : ""}`));
    }
    if (f.reason) c.append(el("p", "fc-reason", f.reason));
    if (f.flip) c.append(el("p", "fc-flip", `↩ ${tx("flip")}: ${f.flip}`));
    const nt = n.notes.get(f.pid);
    if (nt) c.append(el("p", "fc-note", `🤖 ${nt.text}`));
    const fb = A.factsBox(n, [...new Set([...(f.fact_ids || []), ...(nt?.fact_ids || [])])]);
    if (fb) c.append(fb);
    return c;
  }

  async function draw(focusPid) {
    const close = el("button", "rf-x", "×");
    close.type = "button"; close.title = tx("close"); close.setAttribute("aria-label", tx("close"));
    close.addEventListener("click", () => toggle(false));
    const head = el("div", "rf-head");
    head.append(el("strong", null, `🔮 ${tx("head")}`), close);
    pop.replaceChildren(head, el("p", "empty", tx("loading")));
    place();
    const [n] = await Promise.all([A.load(), loadScore()]);
    if (pop.hidden) return;
    if (!n || n.empty) { pop.replaceChildren(head, el("p", "empty", tx("none"))); return place(); }
    const ago = Math.round((Date.parse(`${kstDay(Date.now())}T00:00:00Z`) - Date.parse(`${n.day}T00:00:00Z`)) / (24 * H));
    const when = new Intl.DateTimeFormat(undefined, { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(Date.parse(n.created_at));
    head.querySelector("strong").after(el("span", null, `${when}${ago >= 1 ? ` · ${tx("old")(ago)}` : ""}`));
    const parts = [];
    const N = n.note || {};
    if (N.headline) parts.push(el("p", "fc-headline", N.headline));
    // 성적표
    const sAll = (score || []).find(s => s.kind === "all" && !s.pid && s.horizon === hz);
    parts.push(el("p", "fc-score", sAll?.n ? tx("score")(tx("hz")[hz], sAll.n, sAll.hits, sAll.hit_pct) : tx("noScore")));
    parts.push(el("p", "fc-how", tx("how")));
    // [1주 | 1달]
    const seg = el("div", "fc-seg");
    for (const h of ["1w", "1m"]) {
      const b = seg.appendChild(el("button", h === hz ? "on" : null, tx("hz")[h]));
      b.type = "button"; b.setAttribute("aria-pressed", String(h === hz));
      b.addEventListener("click", () => { hz = h; local.set("aiFcHz", h); draw(); });
    }
    parts.push(seg);
    // 상품 카드(2026-11-21 사용자 "50%대는 의미 없음"): 🎯 주목할 예측(확률 58% 이상 + 과거 비슷한 상황 10번 이상) → 시세/ETF/부동산 → 😐 판단 보류(55% 미만, 접어 둠)
    const list = (N.forecasts || []).filter(f => f.horizon === hz || f.horizon === "3m");
    const strong = f => f.prob >= 58 && (!f.basis || f.basis.n >= 10), hold = f => f.prob < 55 && !strong(f);
    const focus = list.filter(strong).sort((a, b) => b.prob - a.prob);
    if (focus.length) {
      const sec = el("section", "br-sec fc-focus");
      sec.append(el("h4", null, tx("focus")), el("p", "fc-how", tx("focusHow")));
      const grid = sec.appendChild(el("div", "fc-grid"));
      for (const f of focus) grid.append(cardOf(n, f));
      parts.push(sec);
    } else parts.push(el("p", "fc-how fc-nofocus", tx("noFocus")));
    for (const k of ["price", "etf", "re"]) {
      const fs = list.filter(f => kindOf(f.pid) === k && !strong(f) && !hold(f));
      if (!fs.length) continue;
      const sec = el("section", "br-sec");
      sec.append(el("h4", null, tx("g")[k]));
      const grid = sec.appendChild(el("div", "fc-grid"));
      for (const f of fs) grid.append(cardOf(n, f));
      parts.push(sec);
    }
    const held = list.filter(hold);
    if (held.length) {
      const det = el("details", "br-sec fc-hold");
      det.append(el("summary", null, tx("hold")(held.length)));
      const grid = det.appendChild(el("div", "fc-grid"));
      for (const f of held) grid.append(cardOf(n, f));
      parts.push(det);
    }
    if (N.watch?.length) {
      const sec = el("section", "br-sec");
      sec.append(el("h4", null, `👀 ${tx("watch")}`));
      const ul = sec.appendChild(el("ul", "fc-watch"));
      for (const w of N.watch) ul.append(el("li", null, w));
      parts.push(sec);
    }
    parts.push(el("p", "rf-note", [N.caveat, tx("note"), n.model].filter(Boolean).join(" · ")));
    pop.replaceChildren(head, ...parts);
    place();
    if (focusPid) {                                      // 시세 칸의 "🔮 …"을 눌러 열었으면 그 상품 카드로
      const c = pop.querySelector(`.fc-card[data-pid="${CSS.escape(focusPid)}"]`);
      if (c) { c.classList.add("focus"); c.scrollIntoView({ block: "center" }); }
    }
  }

  function place() {                                     // ☀ 요약 창과 같은 자리(머리글 바로 아래, 버튼 근처)
    const top = Math.max(8, (document.querySelector("header")?.getBoundingClientRect().bottom || 0) + 4);
    if (isPhone()) { pop.style.top = `${top}px`; pop.style.left = "8px"; pop.style.right = "8px"; }
    else {
      const w = Math.min(560, window.innerWidth - 16), r = btn.getBoundingClientRect();
      pop.style.right = "auto"; pop.style.top = `${top}px`; pop.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;
    }
    pop.style.maxHeight = `${Math.max(160, Math.min(760, window.innerHeight - top - 12))}px`;
  }
  function toggle(open = pop.hidden, focusPid) {
    if (open === !pop.hidden && !focusPid) return;
    pop.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (!open) return;
    if (!document.getElementById("brief")?.hidden) document.getElementById("briefBtn")?.click();   // 요약·TOP5 가 열려 있으면 닫음(같은 자리)
    if (!document.getElementById("rfTop5")?.hidden) document.getElementById("rfTop5Btn")?.click();
    pop.scrollTop = 0;
    draw(focusPid);
    pop.focus({ preventScroll: true });
  }
  btn.addEventListener("click", () => toggle());
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) { toggle(false); btn.focus(); } });
  document.addEventListener("pointerdown", e => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target) && !e.target.closest?.(".ai-fcline")) toggle(false); });
  window.addEventListener("resize", () => { if (!pop.hidden) place(); });
  globalThis.AIFC = { open(pid) { toggle(true, pid); } };

  const css = document.createElement("style");
  css.textContent = `
.rf-pop.fc { width: min(560px, calc(100vw - 16px)); }
.fc-headline { margin: 6px 0 4px; font-size: 13.5px; font-weight: 700; line-height: 1.45; }
.fc-score { margin: 0 0 6px; font-size: 12px; color: var(--muted); }
.fc-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; margin-bottom: 4px; }
.fc-seg button { background: none; border: 0; padding: 4px 14px; color: var(--muted); font: inherit; font-size: 12.5px; cursor: pointer; }
.fc-seg button.on { background: var(--accent); color: #0b0f17; font-weight: 700; }
.fc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 6px; }
.fc-card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; display: grid; gap: 3px; font-size: 12.5px; line-height: 1.45; }
.fc-card.focus { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.fc-top { display: flex; gap: 6px; align-items: baseline; justify-content: space-between; }
.fc-top b { font-size: 13px; }
.fc-call { flex: none; font-weight: 800; font-size: 12.5px; border: 1px solid currentColor; border-radius: 999px; padding: 0 8px; }
.fc-up { color: var(--up); } .fc-down { color: var(--down); }
.fc-exp { font-size: 12px; color: var(--muted); } .fc-exp b { font-size: 13px; }
.fc-basis { margin: 0; font-size: 12px; font-weight: 600; }
.fc-focus h4 { color: #f59e0b; }
.fc-hold > summary { cursor: pointer; font-size: 13px; color: var(--muted); padding: 4px 0; }
.fc-hold .fc-card { opacity: .8; }
.fc-how { margin: 0 0 6px; font-size: 11.5px; color: var(--muted); line-height: 1.45; }
.fc-meta { font-size: 11px; color: var(--muted); }
.fc-reason, .fc-flip, .fc-note { margin: 0; }
.fc-flip { color: var(--muted); }
.fc-watch { margin: 0; padding-left: 18px; font-size: 12.5px; }
.fc-btn { white-space: nowrap; }
@media (max-width: 767px) { #aiFcBtn { padding-left: 8px; padding-right: 8px; } }`;
  document.head.append(css);
})();
