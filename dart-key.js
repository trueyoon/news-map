// 중요 공시 골라내기 (2026-11-18 사용자 요청). DART 공시 중 주가에 크게 닿는 종류만(수주·유상증자·자사주·최대주주 변경·합병·거래정지·실적 …).
// - 대상: 유가증권시장·코스닥 상장사만("(유가)…", "(코스닥)…" — 비상장 "(기타)"·코넥스 빼고). [첨부정정](첨부 서류만 고침)은 뺌, [기재정정]은 "정정" 표시.
// - 종류 규칙은 TYPES 한 곳(보고서 이름 정규식, 위에서부터 먼저 맞는 것). 2026-11-18 실제 3일치 2,727건의 보고서 이름으로 고름 — 분기보고서·일괄신고서·IR 같은 일상 공시는 뺌.
// - 화면: ① 시세 탭 "뉴스에 많이 나온 종목" 아래 "중요 공시" 묶음(종류 버튼으로 거르기, 누르면 뉴스 탭 + 그 공시 팝업 — 상위 200 종목이면 주가 그래프)
//         ② 뉴스 목록 카드에 "📌 수주·계약" 같은 표시. 좋다·나쁘다 판단은 안 붙임(매매 신호로 읽히지 않게).
// - 같은 회사·같은 종류가 기간 안에 여러 번이면 가장 최근 것 하나만(정정 공시가 여러 번 올라오는 것).
// stock-link.js 가 불러옴(index.html 수정 없음). renderMarket()·card() 를 감쌈. 시세 탭 필터의 "중요 공시"로 끌 수 있음.
(function (g) {
  // [이름 열쇠, 보고서 이름 정규식]
  const TYPES = [
    ["contract", /단일판매[ㆍ·]?공급계약체결/],
    ["contractEnd", /단일판매[ㆍ·]?공급계약해지/],
    ["rights", /유상증자결정/],
    ["bonus", /무상증자결정/],
    ["bond", /(전환사채권|신주인수권부사채권|교환사채권)발행결정/],
    ["buyback", /자기주식취득(신탁계약체결)?결정|주식소각결정|자기주식소각결정/],
    ["selfSell", /자기주식처분결정|자기전환사채매도결정/],
    ["owner", /최대주주\s*변경/],
    ["mna", /회사합병결정|회사분할(합병)?결정|주식교환[ㆍ·]?이전결정|영업(양수|양도)결정|타법인주식및출자증권(취득|처분)결정|유형자산(취득|처분|양수|양도)결정|공개매수/],
    ["halt", /주권매매거래정지|상장폐지|관리종목|상장적격성|불성실공시법인|투자주의환기|기업심사위원회|매출액미달/],
    ["earnings", /영업\(?잠정\)?실적|영업실적등에대한전망|매출액또는손익구조/],
    ["dividend", /현금[ㆍ·]?현물배당결정/],
    ["reduce", /감자결정/],
    ["risk", /회생절차|부도발생|해산사유발생|영업정지|생산중단|파산|자본잠식|파생상품거래손실|횡령[ㆍ·]?배임|소송등의제기|중대재해/],
    ["key", /투자판단관련주요경영사항|기업가치제고계획|대표이사변경|풍문또는보도에대한해명|조회공시/],
  ];
  const NAMES = {
    ko: { contract: "수주·공급계약", contractEnd: "계약 해지", rights: "유상증자", bonus: "무상증자", bond: "CB·BW 발행", buyback: "자사주 취득·소각", selfSell: "자사주 처분",
      owner: "최대주주 변경", mna: "합병·인수·자산 거래", halt: "거래정지·상장 관련", earnings: "실적", dividend: "배당", reduce: "감자", risk: "위험 사건", key: "주요 경영사항" },
    en: { contract: "Supply contract", contractEnd: "Contract ended", rights: "Rights offering", bonus: "Bonus issue", bond: "CB/BW issue", buyback: "Buyback/cancel", selfSell: "Treasury sale",
      owner: "New largest holder", mna: "M&A / assets", halt: "Trading halt / listing", earnings: "Earnings", dividend: "Dividend", reduce: "Capital cut", risk: "Risk event", key: "Key mgmt. matter" },
    ja: { contract: "受注・供給契約", contractEnd: "契約解除", rights: "有償増資", bonus: "無償増資", bond: "CB・BW発行", buyback: "自社株取得・消却", selfSell: "自社株処分",
      owner: "筆頭株主変更", mna: "合併・買収・資産取引", halt: "売買停止・上場関連", earnings: "業績", dividend: "配当", reduce: "減資", risk: "リスク事象", key: "主要経営事項" },
  };
  const HEAD = /^\((유가|코스닥|코넥스|기타)\)\s*(.+?)\s+-\s+(.+)$/;
  // DART 공시 하나 → {type, market, company, report, fix} 또는 null
  function classify(it) {
    if (!it || it.source_name !== "DART 공시") return null;
    const m = HEAD.exec(String(it.title || ""));
    if (!m || (m[1] !== "유가" && m[1] !== "코스닥")) return null;
    const report = m[3];
    if (/\[첨부정정\]|\[첨부추가\]/.test(report)) return null;
    const hit = TYPES.find(([, re]) => re.test(report));
    if (!hit) return null;
    return { type: hit[0], market: m[1] === "유가" ? "KOSPI" : "KOSDAQ", company: m[2].trim(), report: report.replace(/\[[^\]]*\]/g, "").trim(), fix: /\[기재정정\]/.test(report) };
  }
  g.DARTKEY = { TYPES, classify };
  if (typeof document === "undefined" || typeof card !== "function" || typeof el !== "function") return;   // Node 시험이면 여기까지

  const TX = {
    ko: { head: "중요 공시", sub: n => `유가증권·코스닥 상장사, 화면에 불러온 기간 ${n}건`, all: "전체", fix: "정정", empty: "이 기간에 중요 공시가 없어요.", more: n => `그 밖에 ${n}건`, filt: "중요 공시",
      note: "DART 공시 중 수주·증자·자사주·최대주주 변경·합병·거래정지·실적 같은 종류만 골랐어요(같은 회사·같은 종류는 가장 최근 것 하나). 좋고 나쁨은 판단하지 않아요. 출처: 금융감독원 DART." },
    en: { head: "Key filings", sub: n => `KOSPI/KOSDAQ companies, ${n} in the loaded period`, all: "All", fix: "amended", empty: "No key filings in this period.", more: n => `${n} more`, filt: "Key filings",
      note: "Only DART filings of high-impact kinds (contracts, share issues, buybacks, control changes, M&A, halts, earnings). Latest one per company and kind. No good/bad judgment. Source: FSS DART." },
    ja: { head: "重要開示", sub: n => `KOSPI・KOSDAQ上場企業、読み込んだ期間で${n}件`, all: "すべて", fix: "訂正", empty: "この期間に重要開示はありません。", more: n => `ほか${n}件`, filt: "重要開示",
      note: "DART開示のうち受注・増資・自社株・筆頭株主変更・合併・売買停止・業績などの種類だけ（同じ会社・種類は最新の1件）。良し悪しは判断しません。出典：金融監督院 DART。" },
  };
  const tx = (k, ...a) => { const v = (TX[LANG] || TX.ko)[k]; return typeof v === "function" ? v(...a) : v; };
  const nameOf = k => (NAMES[LANG] || NAMES.ko)[k];

  const cache = new WeakMap();
  const info = it => { if (!cache.has(it)) cache.set(it, classify(it)); return cache.get(it); };

  // ── 뉴스 카드 표시 ──
  const baseCard = card;
  card = function (it, inPopup, priority) {
    const box = baseCard(it, inPopup, priority);
    try {
      const d = info(it);
      if (d) box.querySelector(".meta")?.append(el("span", "chip dartkey", `📌 ${nameOf(d.type)}${d.fix ? ` · ${tx("fix")}` : ""}`));
    } catch (e) { console.warn("dart-key", e); }
    return box;
  };

  // ── 시세 탭 묶음 ──
  for (const k of Object.keys(TX)) if (T[k]?.mFilt) T[k].mFilt.dart = TX[k].filt;
  if (typeof MKT_FILTER !== "undefined" && !MKT_FILTER.includes("dart")) MKT_FILTER.splice(MKT_FILTER.includes("stocks") ? 1 : 0, 0, "dart");
  let pick = local.get("dartPick", "all");
  const SHOW = 40;
  function pickList() {
    const seen = new Map();
    for (const it of items) {                                   // items 는 최신순 → 같은 회사·종류는 처음 것(가장 최근)만
      const d = info(it);
      if (!d) continue;
      const k = `${d.company}|${d.type}`;
      if (!seen.has(k)) seen.set(k, { it, d });
    }
    return [...seen.values()];
  }
  function draw(sec) {
    const all = pickList();
    const counts = new Map();
    for (const x of all) counts.set(x.d.type, (counts.get(x.d.type) || 0) + 1);
    if (pick !== "all" && !counts.has(pick)) pick = "all";
    const chips = el("div", "dk-chips");
    const mk = (key, label, n) => {
      const b = chips.appendChild(el("button", key === pick ? "on" : null, label));
      b.type = "button"; b.setAttribute("aria-pressed", String(key === pick));
      if (n != null) b.append(el("small", null, n.toLocaleString()));
      b.addEventListener("click", () => { pick = key; local.set("dartPick", key); draw(sec); });
    };
    mk("all", tx("all"), all.length);
    for (const [k] of TYPES) if (counts.has(k)) mk(k, nameOf(k), counts.get(k));
    const shown = pick === "all" ? all : all.filter(x => x.d.type === pick);
    const ul = el("ul", "dk-list");
    for (const { it, d } of shown.slice(0, SHOW)) {
      const li = ul.appendChild(el("li"));
      const b = li.appendChild(el("button"));
      b.type = "button";
      const top = b.appendChild(el("div", "dk-top"));
      top.append(el("span", `dk-type dk-${d.type}`, nameOf(d.type)), el("b", null, d.company), el("small", null, d.market), el("span", "dk-time", `${ago(it._t)} · ${kst(it._t)}`));
      b.append(el("div", "dk-rep", `${d.report}${d.fix ? ` (${tx("fix")})` : ""}`));
      b.title = it.title;
      b.addEventListener("click", () => { showTab("news"); openItem(it, true); });
    }
    const parts = [el("h3", null, tx("head")), el("p", "dk-sub", tx("sub", all.length)), chips];
    parts.push(shown.length ? ul : el("p", "empty", tx("empty")));
    if (shown.length > SHOW) parts.push(el("p", "dk-sub", tx("more", shown.length - SHOW)));
    parts.push(el("p", "mnote", tx("note")));
    sec.replaceChildren(...parts);
  }
  let token = 0;
  async function fill(my) {
    const sec = el("section", "dk-mkt");
    const stk = $("market").querySelector(".stk-mkt");
    stk ? stk.after(sec) : $("market").prepend(sec);
    for (let i = 0; !items.length && i < 30; i++) {             // 뉴스가 아직 안 왔으면 잠깐 기다림(최대 1분)
      await new Promise(r => setTimeout(r, 2000));
      if (my !== token) return sec.remove();
    }
    if (my !== token || !sec.isConnected) return;
    draw(sec);
  }
  if (typeof renderMarket === "function") {
    const baseRender = renderMarket;
    renderMarket = function () {
      baseRender();
      try { const my = ++token; if (market && market.latest.size && !hiddenMkt.has("dart")) fill(my); } catch (e) { console.warn("dart-key", e); }
    };
    if (market) renderMarket();
  }

  const css = document.createElement("style");
  css.textContent = `
.card .chip.dartkey { border: 1px solid #f59e0b; color: #f59e0b; background: transparent; font-weight: 700; }
.dk-sub { margin: -6px 2px 8px; font-size: 12px; color: var(--muted); }
.dk-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 0 0 8px; }
.dk-chips button { background: var(--bg); border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; font-size: 12px; color: var(--text); cursor: pointer; }
.dk-chips button.on { border-color: var(--accent); background: var(--panel-2); font-weight: 700; }
.dk-chips small { color: var(--muted); font-size: 10.5px; margin-left: 4px; }
.dk-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.dk-list li + li { border-top: 1px solid var(--line); }
.dk-list button { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 8px 10px; color: var(--text); cursor: pointer; }
.dk-list button:hover { background: var(--panel-2); }
.dk-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 13px; }
.dk-top small { color: var(--muted); font-size: 10.5px; }
.dk-time { margin-left: auto; color: var(--muted); font-size: 11.5px; }
.dk-type { font-size: 11px; font-weight: 800; border-radius: 6px; padding: 1px 7px; background: var(--panel-2); border: 1px solid var(--line); color: var(--accent); }
.dk-risk, .dk-halt { color: #f87171; border-color: #f87171; }
.dk-rep { font-size: 12px; color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`;
  document.head.append(css);
})(typeof globalThis !== "undefined" ? globalThis : this);
