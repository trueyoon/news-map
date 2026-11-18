// 아침 한 장 요약 (2026-11-18 사용자 요청). 검색창 옆 "☀ 요약" 버튼 → 지난번 요약을 본 뒤(최소 6시간·최대 24시간) 놓친 것을 한 칸에:
//   ① 시세: 위쪽 띠 품목의 전일 대비 + "평소보다 큰 움직임"(지난 약 3달 하루 움직임 중간값의 2배 넘게) — 띠 밖 품목도 2.5배 넘으면 3개까지
//   ② 큰 뉴스: 한국 3 · 미국 2 (hot-news.js, 일반뉴스 TOP5 와 같은 계산)  ③ 시세에 닿을 만한 소식 3 (reflect-core.js RF.top5, 시세반영 TOP5 와 같은 계산)
//   ④ ★ 관심 새 소식(watch.js)  ⑤ 중요 공시(dart-key.js 종류 규칙 + 과거 같은 종류 공시 뒤 5거래일 시장 대비 중간값 ev_stats)
//   ⑥ 큰 재난(규모 6.5 이상 지진·GDACS 주황/빨강)  ⑦ 오늘·내일 일정(RF.eventsOn)
// - 새로 받는 자료는 ev_stats(종류별 통계 몇십 줄, 1시간마다)뿐. 나머지는 화면이 이미 받아 둔 소식(items)·시세(market)로 계산 → 전송량이 거의 늘지 않음.
// - 하루(한국 날짜) 처음 화면을 열면 소식을 다 받은 뒤 자동으로 한 번 펼침(끌 수 있음, 브라우저 기억 briefAuto). 마지막으로 본 시각 briefAt.
// - 판단·예측 문구는 넣지 않음(매매 신호로 읽히지 않게). list-sort.js 가 불러옴(index.html 수정 없음). 문제가 생겨도 기존 화면은 그대로.
(() => {
  if (typeof card !== "function" || typeof openItem !== "function" || typeof el !== "function" || typeof T !== "object" || typeof showTab !== "function") return;
  const H = 3600e3, MIN_SPAN = 6, MAX_SPAN = 24;
  const TX = {
    ko: { btn: "☀ 요약", head: "아침 한 장 요약", span: h => `최근 ${h}시간`, close: "닫기", loading: "소식을 받는 중…",
      mkt: "시세", big: "평소보다 큰 움직임", bigHelp: "지난 약 3달 하루 움직임 중간값의 2배가 넘어요",
      news: "큰 뉴스 (많이 보도된 주제)", kr: "한국", us: "미국", nArt: (n, s) => `${n}건 · ${s}곳`, noNews: "아직 큰 주제가 없어요.",
      mktNews: "시세에 닿을 만한 소식", watch: "★ 관심 새 소식", watchNone: "이 기간에 관심 소식이 없어요.", watchAdd: "뉴스 목록 위 ★ 관심에서 관심 주제·종목을 더할 수 있어요.",
      watchN: n => `${n}건`, dart: "중요 공시", dartNone: "이 기간에 중요 공시가 없어요.", dartMore: n => `중요 공시 ${n}건 모두 보기 (시세 탭)`,
      past5: v => `과거 같은 종류: 5거래일 뒤 시장 대비 ${v}`, few: "과거 표본 적음", disaster: "큰 재난", cal: "오늘·내일 일정", calNone: "큰 일정이 없어요.",
      today: "오늘", tmr: "내일",
      calN: { FOMC: "미 연준 금리 결정(FOMC)", ECB: "유럽중앙은행 금리 결정", BOJ: "일본은행 금리 결정", EIA: "미 원유 재고 발표(EIA)", KCS: "관세청 10일 수출 발표" },
      note: (h, first) => `${first ? "최근 24시간" : `지난번 요약을 본 뒤 ${h}시간`} 동안의 소식이에요(최소 6시간·최대 24시간). 화면이 이미 받아 둔 자료로 만들어서 전송량이 거의 늘지 않아요. 순서는 보도량·규칙으로 정한 것이고, 오르내림 예측이 아니에요.`,
      auto: "하루 처음 열 때 자동으로 보여 주기", rangeCut: h => `(선택한 기간 ${h}시간 안에서)` },
    en: { btn: "☀ Brief", head: "Morning brief", span: h => `last ${h} h`, close: "Close", loading: "Loading news…",
      mkt: "Prices", big: "Bigger move than usual", bigHelp: "More than twice the median daily move of the last ~3 months",
      news: "Big news (most covered topics)", kr: "Korea", us: "US", nArt: (n, s) => `${n} stories · ${s} outlets`, noNews: "No big topics yet.",
      mktNews: "Market-related stories", watch: "★ Watched topics", watchNone: "No watched news in this period.", watchAdd: "Add topics or stocks with ★ Watch above the news list.",
      watchN: n => `${n}`, dart: "Key filings", dartNone: "No key filings in this period.", dartMore: n => `All ${n} key filings (Prices tab)`,
      past5: v => `Past filings of this kind: 5 days vs market ${v}`, few: "few past cases", disaster: "Major disasters", cal: "Today & tomorrow", calNone: "No major events.",
      today: "Today", tmr: "Tomorrow",
      calN: { FOMC: "Fed rate decision (FOMC)", ECB: "ECB rate decision", BOJ: "Bank of Japan rate decision", EIA: "US crude inventories (EIA)", KCS: "Korea 10-day export data" },
      note: (h, first) => `News from the ${first ? "last 24 hours" : `${h} hours since you last opened the brief`} (min 6, max 24). Built from data the page already loaded, so it adds almost no traffic. Order comes from coverage and rules — not a price forecast.`,
      auto: "Show automatically on the first visit each day", rangeCut: h => `(within the selected ${h} h)` },
    ja: { btn: "☀ まとめ", head: "朝の1枚まとめ", span: h => `直近${h}時間`, close: "閉じる", loading: "ニュースを読み込み中…",
      mkt: "相場", big: "普段より大きな動き", bigHelp: "直近約3か月の1日の動きの中央値の2倍を超えています",
      news: "大きなニュース（多く報じられた話題）", kr: "韓国", us: "米国", nArt: (n, s) => `${n}件 · ${s}社`, noNews: "まだ大きな話題はありません。",
      mktNews: "相場に関わりそうなニュース", watch: "★ 注目の新着", watchNone: "この期間の注目ニュースはありません。", watchAdd: "ニュース一覧の上の ★ 注目 で話題・銘柄を追加できます。",
      watchN: n => `${n}件`, dart: "重要開示", dartNone: "この期間の重要開示はありません。", dartMore: n => `重要開示${n}件をすべて見る（相場タブ）`,
      past5: v => `過去の同種開示：5営業日後 市場比 ${v}`, few: "過去の件数が少ない", disaster: "大規模災害", cal: "今日・明日の予定", calNone: "大きな予定はありません。",
      today: "今日", tmr: "明日",
      calN: { FOMC: "米FRB金利決定（FOMC）", ECB: "欧州中央銀行の金利決定", BOJ: "日本銀行の金利決定", EIA: "米原油在庫（EIA）", KCS: "韓国関税庁10日輸出" },
      note: (h, first) => `${first ? "直近24時間" : `前回まとめを見てから${h}時間`}のニュースです（最短6時間・最長24時間）。画面が読み込み済みのデータで作るので通信量はほぼ増えません。順番は報道量とルールによるもので、値動きの予測ではありません。`,
      auto: "その日最初に開いたとき自動で表示", rangeCut: h => `（選んだ期間${h}時間の中で）` },
  };
  const tx = (k, ...a) => { const v = (TX[LANG] || TX.ko)[k]; return typeof v === "function" ? v(...a) : v; };
  for (const k of Object.keys(TX)) if (T[k]) T[k].brief = TX[k].btn;   // 언어를 바꾸면 applyStatic 이 이름표를 바꿈
  const DK = {   // dart-key.js 의 종류 이름(그 파일은 서버 장부 함수와 글자까지 같아야 해서 건드리지 않고 여기 따로 둠)
    ko: { contract: "수주·공급계약", contractEnd: "계약 해지", rights: "유상증자", bonus: "무상증자", bond: "CB·BW 발행", buyback: "자사주 취득·소각", selfSell: "자사주 처분",
      owner: "최대주주 변경", mna: "합병·인수·자산 거래", halt: "거래정지·상장 관련", earnings: "실적", dividend: "배당", reduce: "감자", risk: "위험 사건", key: "주요 경영사항" },
    en: { contract: "Supply contract", contractEnd: "Contract ended", rights: "Rights offering", bonus: "Bonus issue", bond: "CB/BW issue", buyback: "Buyback/cancel", selfSell: "Treasury sale",
      owner: "New largest holder", mna: "M&A / assets", halt: "Trading halt / listing", earnings: "Earnings", dividend: "Dividend", reduce: "Capital cut", risk: "Risk event", key: "Key mgmt. matter" },
    ja: { contract: "受注・供給契約", contractEnd: "契約解除", rights: "有償増資", bonus: "無償増資", bond: "CB・BW発行", buyback: "自社株取得・消却", selfSell: "自社株処分",
      owner: "筆頭株主変更", mna: "合併・買収・資産取引", halt: "売買停止・上場関連", earnings: "業績", dividend: "配当", reduce: "減資", risk: "リスク事象", key: "主要経営事項" },
  };
  // 공시는 주가에 크게 닿는 종류부터(같은 순서 안에서는 최신)
  const DART_ORDER = ["risk", "halt", "owner", "reduce", "rights", "bond", "mna", "contract", "contractEnd", "buyback", "earnings", "bonus", "selfSell", "dividend", "key"];

  // 필요한 계산 파일: 다른 파일이 이미 불렀으면 그대로, 아니면 여기서 한 번 부름
  function need(name, src) { if (globalThis[name] || document.querySelector(`script[src="${src}"]`)) return; const s = document.createElement("script"); s.src = src; document.head.append(s); }
  need("HOT", "hot-news.js");

  // ── 버튼 + 칸 (오늘의 TOP5 칸과 같은 모양) ──
  const btn = el("button", null, tx("btn"));
  btn.type = "button"; btn.id = "briefBtn"; btn.dataset.i18n = "brief";
  btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "brief");
  ($("rfTop5Btn") || $("q")).after(btn);                // TOP5 버튼이 나중에 생겨도 검색창 바로 뒤로 가므로 순서는 늘 검색창 · TOP5 · 요약
  const pop = el("section", "rf-pop brief");
  pop.id = "brief"; pop.hidden = true; pop.tabIndex = -1; pop.setAttribute("role", "dialog");
  $("app").append(pop);

  // 과거 같은 종류 공시 뒤 주가(ev_stats) — 1시간마다
  let stats = null, statsAt = 0;
  async function loadStats() {
    if (Date.now() - statsAt < H) return;
    statsAt = Date.now();
    try {
      const { data, error } = await db.from("ev_stats").select("type,h,n,med_ab").eq("h", 5);
      if (!error && data) { stats = new Map(data.map(r => [r.type, r])); if (!pop.hidden) draw(); }
    } catch { statsAt = 0; }
  }

  // ── 시세 ──
  const typical = new Map();                            // 품목 → [하루 움직임 중간값, 그때의 자료]
  function usual(sym, unit) {
    const pts = market?.daily.get(sym);
    if (!pts || pts.length < 15) return null;
    const c = typical.get(sym);
    if (c && c[1] === pts) return c[0];
    const ch = [];
    for (let i = Math.max(1, pts.length - 61); i < pts.length; i++) {
      const a = pts[i - 1].v, b = pts[i].v;
      if (unit === "%") ch.push(Math.abs(b - a)); else if (a) ch.push(Math.abs(b / a - 1) * 100);
    }
    const m = ch.filter(x => x > 0).sort((x, y) => x - y);
    const v = m.length >= 10 ? m[Math.floor(m.length / 2)] : null;
    typical.set(sym, [v, pts]);
    return v;
  }
  function moveOf(r) {                                  // 오늘 움직임 크기(금리는 %p, 나머지는 %)
    if (r.prev_close == null || r.unit === "kUSD" || WEEKLY.has(r.unit)) return null;
    return r.unit === "%" ? Math.abs(r.value - r.prev_close) : Math.abs(r.change_pct ?? 0);
  }
  function ratioOf(r) { const m = moveOf(r), u = usual(r.symbol, r.unit); return m != null && u ? m / u : null; }
  function marketPart() {
    if (!market?.latest.size) return null;
    const L = market.latest;
    const syms = STRIP.map(s => (s === "GOLD" ? (L.has("KRXGOLD") ? "KRXGOLD" : "XAUTKRW") : s)).filter(s => L.has(s));
    const extra = [...L.values()].filter(r => !syms.includes(r.symbol) && SYM[r.symbol] && (ratioOf(r) || 0) >= 2.5)
      .sort((a, b) => ratioOf(b) - ratioOf(a)).slice(0, 3).map(r => r.symbol);
    const grid = el("div", "br-mkt");
    for (const s of [...syms, ...extra]) {
      const r = L.get(s), d = delta(r), big = (ratioOf(r) || 0) >= 2;
      const b = grid.appendChild(el("button", "br-px" + (big ? " big" : "")));
      b.type = "button";
      b.append(el("span", "br-px-n", SYM[s]?.[li()] || s), el("span", "br-px-v", `${nf(r.value, r.unit)}${r.unit === "%" ? "%" : ""}`));
      if (d) b.append(el("span", `br-px-d ${d.dir}`, d.txt));
      b.append(el("span", "br-px-t", big ? `⚡ ${tx("big")}` : whenText(r._t)));
      if (big) b.title = tx("bigHelp");
      b.addEventListener("click", () => { toggle(false); showTab("market", s); });
    }
    return section("📈", tx("mkt"), grid);
  }

  // ── 소식 ──
  function row(it, meta, extraCls) {
    const li0 = el("li", extraCls || null);
    const go = li0.appendChild(el("button", "rf-go"));
    go.type = "button";
    go.append(card(it, false, true));                   // 제목 번역은 중요 제목처럼(MyMemory 우선)
    go.addEventListener("click", () => { toggle(false); showTab("news"); openItem(it, true); });
    if (meta) li0.append(meta);
    return li0;
  }
  function section(icon, title, ...body) {
    const s = el("section", "br-sec");
    s.append(el("h4", null, `${icon} ${title}`), ...body.filter(Boolean));
    return s;
  }
  function newsPart(rows, span, shown) {
    if (!globalThis.HOT) return section("📰", tx("news"), el("p", "empty", tx("loading")));
    const ol = el("ol", "rf-list");
    for (const [c, n] of [["kr", 3], ["us", 2]]) {
      let list = [];
      try { list = HOT.top(items, { now: Date.now(), country: c, lang: LANG, span }); } catch (e) { console.warn("brief", e); }
      for (const x of list.slice(0, n)) {
        if (!x.item || shown.has(x.item.url)) continue;
        shown.add(x.item.url);
        const meta = el("div", "rf-meta");
        meta.append(el("span", "rf-theme br-ctry", tx(c)), ...x.chips.slice(0, 2).map(k => el("span", "rf-theme", k)), tx("nArt", x.n, x.srcs));
        ol.append(row(x.item, meta));
      }
    }
    return section("📰", tx("news"), ol.children.length ? ol : el("p", "empty", tx("noNews")));
  }
  function mktNewsPart(rows, shown) {
    if (!globalThis.RF?.top5) return null;
    let list = [];
    try { list = RF.top5(rows, { now: Date.now(), lang: LANG }); } catch (e) { console.warn("brief", e); }
    const ol = el("ol", "rf-list");
    for (const x of list) {
      if (ol.children.length >= 3) break;
      if (!x.item || shown.has(x.item.url)) continue;
      shown.add(x.item.url);
      const meta = el("div", "rf-meta");
      const th = x.theme === "disaster" ? tx("disaster") : (RF.THEMES.find(t => t.id === x.theme)?.label[li()] || x.theme);
      meta.append(el("span", "rf-theme", th), x.syms.map(s => SYM[s]?.[li()] || s).join(" · "));
      ol.append(row(x.item, meta));
    }
    return ol.children.length ? section("💹", tx("mktNews"), ol) : null;
  }
  function watchPart(rows) {
    const W = globalThis.WATCH;
    if (!W) return null;
    const names = W.names();
    if (!names.length) return section("★", tx("watch").replace(/^★\s*/, ""), el("p", "rf-note", tx("watchAdd")));
    const by = new Map();
    for (const it of rows) for (const n of W.hits(it)) (by.get(n) || by.set(n, []).get(n)).push(it);
    const ul = el("ul", "br-watch");
    for (const n of names) {
      const got = by.get(n);
      if (!got?.length) continue;
      const li0 = ul.appendChild(el("li"));
      const b = li0.appendChild(el("button", "br-wname"));
      b.type = "button";
      b.append(el("b", null, n), el("small", null, tx("watchN", got.length)));
      b.addEventListener("click", () => { toggle(false); showTab("news"); W.only(n); });
      const top = got.slice().sort((a, c) => c._t - a._t)[0];
      const t0 = li0.appendChild(el("button", "br-wtitle", top.title));
      t0.type = "button"; t0.title = top.title;
      t0.addEventListener("click", () => { toggle(false); showTab("news"); openItem(top, true); });
    }
    return section("★", tx("watch").replace(/^★\s*/, ""), ul.children.length ? ul : el("p", "empty", tx("watchNone")));
  }
  function dartPart(rows) {
    if (!globalThis.DARTKEY) return null;
    const W = globalThis.WATCH, seen = new Map();
    for (const it of rows) {
      const d = DARTKEY.classify(it);
      if (!d || d.fix) continue;
      const k = `${d.company}|${d.type}`;
      if (!seen.has(k) || seen.get(k).it._t < it._t) seen.set(k, { it, d, mine: !!W?.hits(it).length });
    }
    const all = [...seen.values()].sort((a, b) => (b.mine - a.mine) || DART_ORDER.indexOf(a.d.type) - DART_ORDER.indexOf(b.d.type) || b.it._t - a.it._t);
    if (!all.length) return section("📌", tx("dart"), el("p", "empty", tx("dartNone")));
    const ul = el("ul", "br-dart");
    // 한 종류가 칸을 다 차지하지 않게(소송 공시가 많은 날 등) 종류마다 2개까지 먼저, 남으면 나머지로 채움
    const per = new Map(), pickd = [];
    for (const x of all) if (pickd.length < 6 && (per.get(x.d.type) || 0) < 2) { pickd.push(x); per.set(x.d.type, (per.get(x.d.type) || 0) + 1); }
    for (const x of all) if (pickd.length < 6 && !pickd.includes(x)) pickd.push(x);
    for (const { it, d, mine } of pickd) {
      const li0 = ul.appendChild(el("li"));
      const b = li0.appendChild(el("button"));
      b.type = "button";
      const top = b.appendChild(el("div", "br-dtop"));
      top.append(el("span", "rf-theme", (DK[LANG] || DK.ko)[d.type] || d.type), el("b", null, `${mine ? "★ " : ""}${d.company}`), el("small", null, ago(it._t)));
      b.append(el("div", "br-drep", d.report));
      const st = stats?.get(d.type);
      if (st) b.append(st.n >= 30 ? el("div", "br-dstat", tx("past5", `${st.med_ab > 0 ? "▲" : st.med_ab < 0 ? "▼" : ""}${Math.abs(st.med_ab).toFixed(1)}%`) + ` (${st.n.toLocaleString()})`)
        : el("div", "br-dstat few", tx("few")));
      b.addEventListener("click", () => { toggle(false); showTab("news"); openItem(it, true); });
    }
    const more = el("button", "br-more", tx("dartMore", all.length));
    more.type = "button";
    more.addEventListener("click", () => {
      toggle(false); showTab("market");
      setTimeout(() => $("market").querySelector(".dk-mkt")?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
    });
    return section("📌", tx("dart"), ul, more);
  }
  function disasterPart(rows) {
    const big = rows.filter(it => {
      if (it.category !== "disaster") return false;
      const m = /^M\s?(\d+(?:\.\d+)?)/.exec(it.title || "");
      return (m && Number(m[1]) >= 6.5) || /[?&]alertlevel=(orange|red)\b/i.test(it.url || "");
    }).sort((a, b) => b._t - a._t).slice(0, 3);
    if (!big.length) return null;
    const ol = el("ol", "rf-list");
    for (const it of big) ol.append(row(it));
    return section("⚠", tx("disaster"), ol);
  }
  function calPart() {
    if (!globalThis.RF?.eventsOn) return null;
    const ul = el("ul", "br-cal");
    for (const [k, off] of [["today", 0], ["tmr", 1]]) {
      const day = new Date(Date.now() + 9 * H + off * 24 * H).toISOString().slice(0, 10);
      for (const e of RF.eventsOn(day)) {
        const li0 = ul.appendChild(el("li"));
        li0.append(el("span", "rf-theme", tx(k)));
        const a = li0.appendChild(el("a", null, tx("calN")[e.n] || e.n));
        if (e.url) { a.href = e.url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
      }
    }
    return section("🗓", tx("cal"), ul.children.length ? ul : el("p", "empty", tx("calNone")));
  }

  // ── 그리기 ──
  let from = 0, first = false;                          // 칸을 연 동안은 기간을 고정(5분마다 다시 그려도 같은 기간)
  function draw() {
    if (pop.hidden) return;
    const close = el("button", "rf-x", "×");
    close.type = "button"; close.title = tx("close"); close.setAttribute("aria-label", tx("close"));
    close.addEventListener("click", () => toggle(false));
    const now = Date.now(), range = Number($("range").value) || 72;
    const span = Math.max(1, Math.min(range, Math.round((now - from) / H)));
    const head = el("div", "rf-head");
    head.append(el("strong", null, `☀ ${tx("head")}`), el("span", null, tx("span", span) + (range < MAX_SPAN && span >= range ? ` ${tx("rangeCut", range)}` : "")), close);
    if (!items.length) { pop.replaceChildren(head, el("p", "empty", $("count").textContent === t("loadFail") ? t("loadFail") : tx("loading"))); return place(); }
    const rows = items.filter(it => it._t >= now - span * H && it._t <= now + 10 * 60e3);
    const shown = new Set(), parts = [];
    for (const f of [marketPart, () => newsPart(rows, span, shown), () => mktNewsPart(rows, shown), () => watchPart(rows), () => dartPart(rows), () => disasterPart(rows), calPart]) {
      try { const p = f(); if (p) parts.push(p); } catch (e) { console.warn("brief", e); }
    }
    const auto = el("label", "br-auto");
    const cb = auto.appendChild(el("input"));
    cb.type = "checkbox"; cb.checked = local.get("briefAuto", true) !== false;
    cb.addEventListener("change", () => local.set("briefAuto", cb.checked));
    auto.append(tx("auto"));
    const keep = pop.scrollTop;
    pop.replaceChildren(head, ...parts, el("p", "rf-note", tx("note", span, first)), auto);
    pop.setAttribute("aria-label", tx("head"));
    pop.scrollTop = keep;
    place();
  }
  function place() {                                    // TOP5 칸과 같은 자리(머리글 바로 아래)
    const top = Math.max(8, document.querySelector("header").getBoundingClientRect().bottom + 4);
    pop.style.top = `${top}px`;
    pop.style.maxHeight = `${Math.max(160, Math.min(720, window.innerHeight - top - 12))}px`;
    if (isPhone()) { pop.style.left = "8px"; pop.style.right = "8px"; return; }
    const w = Math.min(520, window.innerWidth - 16), r = btn.getBoundingClientRect();
    pop.style.right = "auto";
    pop.style.left = `${Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))}px`;
  }
  function toggle(open = pop.hidden) {
    if (open === !pop.hidden) return;
    pop.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (!open) return;
    const now = Date.now(), last = Number(local.get("briefAt", 0)) || 0;
    first = !last;
    from = now - Math.max(MIN_SPAN, Math.min(MAX_SPAN, last ? (now - last) / H : MAX_SPAN)) * H;
    local.set("briefAt", now);
    local.set("briefDay", kstDay(now));
    if (!$("rfTop5")?.hidden) $("rfTop5Btn")?.click();   // TOP5 칸이 열려 있으면 닫음(같은 자리)
    pop.scrollTop = 0;
    draw();
    pop.focus({ preventScroll: true });
    loadStats();
  }
  const kstDay = ms => new Date(ms + 9 * H).toISOString().slice(0, 10);
  btn.addEventListener("click", () => toggle());
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) { toggle(false); btn.focus(); } });
  document.addEventListener("pointerdown", e => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) toggle(false); });
  window.addEventListener("resize", () => { if (!pop.hidden) place(); });
  // 열려 있는 동안 화면이 새 소식·시세로 다시 그려지면 같이(1분에 한 번까지)
  let redrawAt = 0;
  const baseRender = render;
  render = function (...a) { const r = baseRender.apply(this, a); if (!pop.hidden && Date.now() - redrawAt > 60e3) { redrawAt = Date.now(); try { draw(); } catch {} } return r; };

  // 하루(한국 날짜) 처음: 소식·시세를 다 받은 뒤 자동으로 한 번(로그인 화면일 땐 기다림, 최대 3분)
  (function autoOpen(tries = 0) {
    if (local.get("briefAuto", true) === false || local.get("briefDay", "") === kstDay(Date.now())) return;
    const ready = !$("app").hidden && items.length && market && globalThis.HOT;
    if (!ready) { if (tries < 180) setTimeout(() => autoOpen(tries + 1), 1000); return; }
    setTimeout(() => toggle(true), 300);
  })();

  const css = document.createElement("style");
  css.textContent = `
.rf-pop.brief { width: min(520px, calc(100vw - 16px)); }
.brief .rf-go { grid-template-columns: 1fr; }
.brief .rf-meta { padding-left: 4px; }
.brief .rf-list > li { padding: 4px 0; }
.br-sec { padding: 8px 0 4px; border-bottom: 1px solid var(--line); }
.br-sec:last-of-type { border-bottom: 0; }
.br-sec h4 { margin: 2px 0 6px; font-size: 13.5px; color: var(--accent); }
.br-mkt { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 6px; }
.br-px { display: grid; gap: 1px; text-align: left; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; color: var(--text); cursor: pointer; font: inherit; }
.br-px.big { border-color: #f59e0b; box-shadow: inset 0 0 0 1px #f59e0b; }
.br-px-n { font-size: 11.5px; color: var(--muted); }
.br-px-v { font-size: 14px; font-weight: 700; }
.br-px-d { font-size: 12px; font-weight: 700; }
.br-px-t { font-size: 10.5px; color: var(--muted); }
.br-px.big .br-px-t { color: #f59e0b; font-weight: 700; }
.br-ctry { background: var(--accent) !important; color: #0b0f17 !important; }
.br-watch, .br-dart, .br-cal { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.br-watch li { display: flex; align-items: center; gap: 8px; min-width: 0; }
.br-wname { flex: none; display: inline-flex; gap: 5px; align-items: baseline; background: var(--panel); border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; color: var(--text); cursor: pointer; font: inherit; font-size: 12.5px; }
.br-wname small { color: #f59e0b; font-weight: 800; }
.br-wtitle { flex: 1; min-width: 0; background: none; border: 0; padding: 0; color: var(--text); text-align: left; font: inherit; font-size: 12.5px; cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.br-wtitle:hover { text-decoration: underline; }
.br-dart button { display: grid; gap: 2px; width: 100%; text-align: left; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; color: var(--text); cursor: pointer; font: inherit; }
.br-dtop .rf-theme { font-size: 11.5px; }
.br-dtop { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.br-dtop b { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.br-dtop small { margin-left: auto; color: var(--muted); font-size: 11px; flex: none; }
.br-drep { font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.br-dstat { font-size: 11.5px; color: var(--text); }
.br-dstat.few { color: var(--muted); }
.br-more { margin-top: 6px; background: none; border: 1px dashed var(--line); border-radius: 8px; padding: 4px 10px; color: var(--muted); cursor: pointer; font: inherit; font-size: 12px; }
.br-cal li { display: flex; gap: 8px; align-items: baseline; font-size: 13px; }
.br-cal a { color: var(--text); }
.br-auto { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--muted); padding: 4px 2px 2px; cursor: pointer; }
@media (max-width: 767px) { #briefBtn { padding-left: 8px; padding-right: 8px; } }`;
  document.head.append(css);
})();
