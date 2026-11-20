// 종목·ETF 카드 "오늘 장 소식" (2026-11-20 사용자: "주식도 오늘 장 마감이 180,900인데 사이트는 아직 오른 것으로 나옴 — 최신 정보로")
// - 원인: 종목·ETF 종가는 금융위원회 공공데이터라 **다음 영업일 오후 1시 이후**에야 들어옴(같은 날 값을 주는 곳은 약관상 자동 수집 금지 또는 증권사 가입 필요).
// - 그래서 공식 종가가 어제 것이면 시세 탭 "뉴스에 많이 나온 종목"(#px-STK-코드)·"뉴스 주제별 ETF"(#px-ETF-코드) 카드에:
//     ⏳ 위 값은 11/19 종가 — 오늘 종가는 다음 영업일 오후 1시 이후
//     📰 오늘 국내 시장: 코스피 4,869.96 ▼5.21% (장 마감 속보)        ← market-news.js 의 정형 속보(MKNEWS.parse)
//     📰 오늘 이 종목: "삼전 中에 칩 출하 중단? 7% 급락…" → 약 −7%   ← 그 종목 이름이 든 통신사 속보 제목의 % (있을 때만)
//   를 붙임. 계산·추정 없음(제목 숫자 그대로). 공식 종가가 들어오면 자동으로 사라짐.
// - 새로 받는 자료: 종목 이름 목록 stk_items(500줄, 1시간마다 — stock-link.js 와 같은 것). index.html 수정 없음(list-sort.js 가 이 파일을 불러옴).
// ⚠️ 화면 파일: 정규식에 (?<= (?<! 금지(옛 아이폰).
(() => {
  if (typeof db === "undefined" || typeof el !== "function") return;
  const H = 3600e3;
  const TX = {
    ko: { stale: (d, n) => `⏳ 위 값은 ${d} 종가예요 — ${n} 종가는 다음 영업일 오후 1시 이후에 들어와요.`, mkt: "📰 오늘 국내 시장", mine: "📰 오늘 이 종목", close: "장 마감 속보", open: "장중 속보", about: v => `약 ${v}` },
    en: { stale: (d, n) => `⏳ The value above is the ${d} close — the ${n} close arrives after 1 p.m. the next business day.`, mkt: "📰 Korean market today", mine: "📰 This stock today", close: "closing flash", open: "intraday flash", about: v => `about ${v}` },
    ja: { stale: (d, n) => `⏳ 上の値は${d}の終値です。${n}の終値は翌営業日の午後1時以降に入ります。`, mkt: "📰 今日の国内市場", mine: "📰 今日のこの銘柄", close: "引け速報", open: "場中速報", about: v => `約 ${v}` },
  };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];
  const WIRE = /^(연합뉴스|뉴시스)$/;
  const kstDay = t => new Date(t + 9 * H).toISOString().slice(0, 10);
  const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  // 줄임말: "삼전" = 삼성전자, "삼전닉스" = 삼성전자 + SK하이닉스 (stock-core.js 는 서버 장부와 같은 파일이라 건드리지 않고 여기서만)
  const SHORT = [[/삼전닉스/, ["005930", "000660"]], [/삼전(?!닉스)/, ["005930"]]];

  // 종목 이름 판정기(stock-core.js 의 STK — stock-link.js 가 이미 불러 둠)
  let dict = null, dictAt = 0, loading = null;
  function loadDict() {
    if (!globalThis.STK) return Promise.resolve(null);
    if (dict && Date.now() - dictAt < H) return Promise.resolve(dict);
    return loading || (loading = (async () => {
      try {
        const { data, error } = await db.from("stk_items").select("code,name,rank,market").eq("active", true).order("rank").limit(500);
        if (!error && data?.length) { dict = STK.build(data); dict.byCode = new Map(data.map(d => [d.code, d])); dictAt = Date.now(); }
      } catch { /* 다음에 */ } finally { loading = null; }
      return dict;
    })());
  }

  // 오늘 국내 시장 정형 속보(코스피·코스닥): 가장 새 것(마감 먼저)
  function marketFlash() {
    const best = {};
    for (const it of typeof items !== "undefined" ? items : []) {
      if (!WIRE.test(it.source_name || "") || !globalThis.MKNEWS) continue;
      for (const p of MKNEWS.parse(it.title)) {
        if (!p.exact || (p.sym !== "KOSPI" && p.sym !== "KOSDAQ")) continue;
        const b = best[p.sym], rank = p.kind === "close" ? 1 : 0;
        if (!b || rank > b.rank || (rank === b.rank && it._t > b.it._t)) best[p.sym] = { it, p, rank };
      }
    }
    return best;
  }
  // 그 종목 이름 뒤 첫 % 와 방향: "삼전 … 7% 급락…하이닉스도 5.9%↓"
  function pctAfter(title, word) {
    const i = title.indexOf(word);
    if (i < 0) return null;
    const m = title.slice(i + word.length).match(/(\d+(?:\.\d+)?)\s*%\s*(대|이상)?\s*([^\s…·,]{0,6})/);
    if (!m) return null;
    // % 바로 뒤에 움직임 말이 있을 때만("7% 급락", "5.9%↓") — "14.1% 보유"·"30% 지분" 같은 건 주가 변동이 아님
    const near = m[3] || "";
    const dir = /락|↓|내렸|내린|하락|떨어|빠졌/.test(near) ? -1 : /등|↑|올랐|오른|상승|뛰/.test(near) ? 1 : 0;
    if (!dir) return null;
    return `${dir < 0 ? "−" : dir > 0 ? "+" : ""}${m[1]}%${m[2] === "대" ? "대" : m[2] === "이상" ? " 이상" : ""}`;
  }
  // 오늘(공식 종가 다음 날 09:00 KST 뒤) 그 종목 이름 + % 가 든 통신사 제목: 마감·종합 먼저, 늦은 것
  // 후보 기사(통신사·제목에 %·최근 4일)마다 종목 판정은 한 번만(주소별 기억)
  const hitCache = new Map();
  function candidates(d) {
    const from = Date.now() - 4 * 24 * H, out = [];
    for (const it of typeof items !== "undefined" ? items : []) {
      if (!(it._t > from) || !WIRE.test(it.source_name || "") || !/%/.test(it.title || "")) continue;
      if (!hitCache.has(it.url)) hitCache.set(it.url, STK.match(d, it));
      out.push(it);
    }
    return out;
  }
  function stockFlash(cands, code, after) {
    let best = null;
    for (const it of cands) {
      if (!(it._t > after)) continue;
      let word = null;
      for (const h of hitCache.get(it.url) || []) if (h.code === code) { word = h.word; break; }
      if (!word) for (const [re, codes] of SHORT) { const m = it.title.match(re); if (m && codes.includes(code)) { word = m[0]; break; } }
      if (!word) continue;
      const pct = pctAfter(it.title, word);
      if (!pct) continue;
      const rank = /마감|종합|장 막판/.test(it.title) ? 1 : 0;
      if (!best || rank > best.rank || (rank === best.rank && it._t > best.it._t)) best = { it, pct, rank };
    }
    return best;
  }
  const fmt = v => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const openIt = it => { showTab("news"); openItem(it, true); };

  async function decorate() {
    const tiles = [...document.querySelectorAll('#market [id^="px-STK-"], #market [id^="px-ETF-"]')].filter(t => !t.querySelector(".st-live") && !t.dataset.st);
    if (!tiles.length) return;
    const d = await loadDict(), mk = marketFlash(), cands = d ? candidates(d) : [];
    for (const tile of tiles) {
      if (tile.querySelector(".st-live")) continue;
      tile.dataset.st = "1";                                                            // 이 칸은 한 번만 봄(다시 그려지면 새 칸)
      const isStk = tile.id.startsWith("px-STK-"), code = tile.id.replace(/^px-(STK|ETF)-/, "");
      // 카드의 종가 날짜: 추세선 점의 마지막 날짜를 알 수 없으니 "asof" 글의 날짜(예: "11. 19.")를 읽음
      const asof = tile.querySelector(".asof")?.textContent || "", m = asof.match(/(\d{1,2})[./]\s*(\d{1,2})/);
      if (!m) continue;
      const now = new Date(Date.now() + 9 * H), y = now.getUTCFullYear();
      let closeDay = `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      if (closeDay > kstDay(Date.now())) closeDay = `${y - 1}${closeDay.slice(4)}`;        // 연말·연초
      const after = Date.parse(`${closeDay}T00:00:00Z`) + 24 * H;                       // 다음 날 09:00 KST
      const market = (d?.byCode.get(code)?.market || "").toUpperCase().includes("KOSDAQ") ? "KOSDAQ" : "KOSPI";
      const f = mk[market] && mk[market].it._t > after ? mk[market] : mk.KOSPI && mk.KOSPI.it._t > after ? mk.KOSPI : null;
      const s = isStk && d ? stockFlash(cands, code, after) : null;
      if (!f && !s) continue;                                                           // 오늘 새 소식이 없으면(주말 등) 그대로
      const box = el("div", "mk-live st-live");
      const today = kstDay((s || f).it._t);
      box.append(el("div", "mk-wait", tx("stale")(md(closeDay), md(today))));
      if (f) {
        const p = f.p, row = box.appendChild(el("div", null));
        row.append(el("b", null, `${tx("mkt")}: `), el("span", `mk-est ${p.dir < 0 ? "down" : "up"}`, `${market === "KOSDAQ" && f === mk.KOSDAQ ? "코스닥" : "코스피"} ${fmt(p.val)} ${p.dir < 0 ? "▼" : "▲"}${fmt(Math.abs(p.pct))}%`),
          el("small", null, ` (${tx(p.kind)})`));
      }
      if (s) {
        const row = box.appendChild(el("div", null));
        row.append(el("b", null, `${tx("mine")}: `), el("span", `mk-est ${s.pct.startsWith("−") ? "down" : s.pct.startsWith("+") ? "up" : "flat"}`, tx("about")(s.pct)), " ");
        const b = row.appendChild(el("button", "mk-title", s.it.title));
        b.type = "button"; b.addEventListener("click", () => openIt(s.it));
      }
      const a = tile.querySelector(".asof");
      if (a) a.after(box); else tile.append(box);
    }
  }
  // 시세 탭이 다시 그려지면(종목·ETF 칸은 늦게 붙음) 다시
  let t0 = 0;
  (function watch(tries = 0) {
    const m = document.getElementById("market");
    if (!m) { if (tries < 120) setTimeout(() => watch(tries + 1), 500); return; }
    new MutationObserver(() => { clearTimeout(t0); t0 = setTimeout(() => decorate().catch(e => console.warn("stock-today", e)), 300); }).observe(m, { childList: true, subtree: true });
  })();
  globalThis.STODAY = { pctAfter };

  const css = document.createElement("style");
  css.textContent = `
.st-live .mk-est { font-size: 12.5px; }
.st-live > div { line-height: 1.45; }
.st-live b { font-weight: 700; }`;
  document.head.append(css);
})();
