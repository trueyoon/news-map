// 뉴스 ↔ 종목 연결 (2026-11-18 사용자 요청). 뉴스 팝업에 "관련 종목"과 그 종목의 뉴스 전후 종가 그래프를 붙임.
// - 어떤 말을 어느 종목으로 볼지는 stock-core.js (이 파일이 불러옴). 종목 목록은 DB stk_items(시가총액 상위 200, 매주 갱신), 종가는 stk_daily.
// - 주가는 하루 한 번 종가(다음 영업일 오후에 올라옴) — 실시간 아님. "원인을 뜻하지 않아요"를 함께 적음.
// - index.html 맨 아래 <script src="stock-link.js"></script> 한 줄로 불러옴. index.html 의 card()(소식 카드)를 감싸 팝업일 때만 붙임.
// - 2026-11-18 사용자 요청: 시세 탭 맨 위에 "뉴스에 많이 나온 종목"(최근 24시간 제목에 이름이 나온 기사 수 순, 최대 12개) 묶음.
//   renderMarket() 을 감싸 붙임(index.html 수정 없음). 필터 버튼에도 "뉴스 속 종목" 칸을 더함(MKT_FILTER 배열에 추가).
//   같은 날: 시세 탭 묶음 제목 글씨를 크고 선명하게(아래 CSS 맨 위).
//   문제가 생기거나 목록을 못 읽으면 아무것도 안 붙이고 뉴스 팝업은 그대로.
(() => {
  if (typeof card !== "function" || typeof db === "undefined") return;
  const core = document.createElement("script");
  core.src = "stock-core.js";
  core.onload = () => { try { if (globalThis.STK) start(); } catch (e) { console.warn("stock-link", e); } };
  document.head.append(core);

  function start() {
    const MAX = 3, DAY = 86400e3, H = 3600e3, CLOSE_H = 6.5;   // 한 뉴스에 종목 최대 3개, 장 마감 15:30 KST = 06:30 UTC
    const TX = {
      ko: { head: "관련 종목", note: "제목에 나온 회사의 주가(하루 종가)예요. 뉴스와 같은 때의 움직임일 뿐, 원인을 뜻하지 않아요.", mark: "뉴스", won: "원", link: "네이버 증권", none: "주가 자료 없음", src: "출처: 금융위원회 주식시세정보" },
      en: { head: "Related stocks", note: "Daily closing prices of companies named in the title. Shown for timing only — this does not imply cause.", mark: "news", won: "KRW", link: "Naver Finance", none: "No price data", src: "Source: FSC stock price data" },
      ja: { head: "関連銘柄", note: "タイトルに出た会社の株価（日次終値）です。時期が重なるだけで、原因を意味しません。", mark: "ニュース", won: "ウォン", link: "Naver証券", none: "株価データなし", src: "出典：金融委員会 株式相場情報" },
    };
    const tx = k => (TX[LANG] || TX.ko)[k];

    // 종목 목록: 처음 필요할 때 읽고 1시간마다 다시 (실패하면 다음 팝업 때 다시)
    let dict = null, dictAt = 0, loading = null;
    function loadDict() {
      if (dict && Date.now() - dictAt < H) return Promise.resolve(dict);
      return loading || (loading = (async () => {
        try {
          const { data, error } = await db.from("stk_items").select("code,name,rank,market").eq("active", true).order("rank").limit(500);
          if (!error && data?.length) { dict = STK.build(data); dictAt = Date.now(); }
        } catch { /* 다음에 다시 */ } finally { loading = null; }
        return dict;
      })());
    }
    // 종가: 종목·기간마다 한 번만 읽음
    const cache = new Map();
    async function prices(codes, lo, hi) {
      const k = `${codes.join(",")}|${lo}|${hi}`;
      if (!cache.has(k)) cache.set(k, (async () => {
        const { data, error } = await db.from("stk_daily").select("code,d,close,chg").in("code", codes).gte("d", lo).lte("d", hi).order("d");
        if (error) { cache.delete(k); throw error; }
        return data || [];
      })());
      return cache.get(k);
    }
    const isoDay = t => new Date(t + 9 * H).toISOString().slice(0, 10);   // 한국 날짜

    // 작은 그래프(news-price-link.js 와 같은 모양): 가로 = 시간, 세로 = 종가, 뉴스 시점 점선
    function chart(s, pts, newsT) {
      const won = v => `${Math.round(v).toLocaleString(LANG === "en" ? "en-US" : LANG === "ja" ? "ja-JP" : "ko-KR")}${LANG === "en" ? " " : ""}${tx("won")}`;
      const last = pts.at(-1), t0 = pts[0].t, t1 = Math.max(last.t, newsT), tspan = t1 - t0 || 1;
      const vs = pts.map(p => p.v), vlo = Math.min(...vs), vhi = Math.max(...vs), vspan = vhi - vlo || 1;
      const X = t => ((t - t0) / tspan) * 100, Y = v => 33 - ((v - vlo) / vspan) * 28;
      const NS = "http://www.w3.org/2000/svg";
      const mk = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
      const line = { fill: "none", "vector-effect": "non-scaling-stroke", "stroke-linecap": "round", "stroke-linejoin": "round" };
      const box = el("div", "stk-row");
      const head = box.appendChild(el("div", "stk-name"));
      const a = head.appendChild(el("a", null, s.name));
      a.href = `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(s.code)}`;   // 외부 사이트(새 창) — 가져오는 것 없음
      a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = `${tx("link")} ↗`;
      const chg = last.chg != null ? ` ${last.chg > 0 ? "▲" : last.chg < 0 ? "▼" : ""}${Math.abs(last.chg).toFixed(2)}%` : "";
      const valEl = head.appendChild(el("span", "stk-val", `${dayText(last.d)} ${won(last.v)}${chg}`));
      const svg = mk("svg", { viewBox: "0 0 100 36", preserveAspectRatio: "none", role: "img",
        "aria-label": `${s.name}: ${dayText(pts[0].d)} ${won(pts[0].v)} → ${dayText(last.d)} ${won(last.v)}` });
      const xn = X(newsT);
      svg.append(
        mk("path", { ...line, d: `M${xn} 2V36`, stroke: "var(--muted)", "stroke-width": 1, "stroke-dasharray": "2 2" }),
        mk("path", { ...line, d: pts.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(2)} ${Y(p.v).toFixed(2)}`).join(""), stroke: "var(--accent)", "stroke-width": 2 }));
      const cross = svg.appendChild(mk("path", { ...line, stroke: "var(--text)", "stroke-width": 1, opacity: 0.4, visibility: "hidden" }));
      const dot = svg.appendChild(mk("path", { ...line, stroke: "var(--text)", "stroke-width": 7, visibility: "hidden" }));
      const wrap = box.appendChild(el("div", "stk-chart"));
      wrap.append(svg);
      const markEl = wrap.appendChild(el("span", "stk-mark", tx("mark")));
      markEl.style.left = `${Math.min(92, Math.max(0, xn))}%`;
      const axis = box.appendChild(el("div", "stk-axis"));
      axis.append(el("span", null, dayText(pts[0].d)), el("span", null, dayText(newsT > last.t ? newsT : last.d)));
      const lastText = valEl.textContent;
      svg.addEventListener("pointermove", e => {
        const r = svg.getBoundingClientRect(), tt = t0 + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * tspan;
        const p = pts.reduce((x, y) => (Math.abs(y.t - tt) < Math.abs(x.t - tt) ? y : x));
        cross.setAttribute("d", `M${X(p.t)} 0V36`); dot.setAttribute("d", `M${X(p.t)} ${Y(p.v)}l0 0`);
        cross.setAttribute("visibility", "visible"); dot.setAttribute("visibility", "visible");
        valEl.textContent = `${dayText(p.d)} · ${won(p.v)}`;
      });
      svg.addEventListener("pointerleave", () => {
        cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); valEl.textContent = lastText;
      });
      return box;
    }

    async function addBlock(box, it, hits) {
      const newsT = it._t, lo = isoDay(newsT - 10 * DAY), hi = isoDay(Math.min(Date.now(), newsT + 10 * DAY));
      let rows = [];
      try { rows = await prices(hits.map(h => h.code), lo, hi); } catch (e) { console.warn("stock-link prices", e); }
      const sec = el("section", "stk");
      sec.append(el("div", "stk-head", tx("head")));
      for (const h of hits) {
        let pts = rows.filter(r => r.code === h.code).map(r => {
          const d = Date.parse(`${r.d}T00:00:00Z`);
          return { t: d + CLOSE_H * H, d, v: Number(r.close), chg: r.chg };
        });
        // 뉴스 전후 7일 안을 먼저, 연휴로 점이 모자라면 10일 안에서
        const near = pts.filter(p => p.t >= newsT - 7 * DAY && p.t <= newsT + 7 * DAY);
        if (near.length >= 3) pts = near;
        if (pts.length >= 2) sec.append(chart(h, pts, newsT));
        else { const r = sec.appendChild(el("div", "stk-name")); r.append(el("span", null, h.name), el("span", "stk-val", tx("none"))); }
      }
      sec.append(el("div", "stk-note", `${tx("note")} ${tx("src")}`));
      box.append(sec);
      if (popup?.getElement()?.contains(box)) popup.setLngLat(popup.getLngLat());   // 늦게 붙으면 팝업 위치를 다시 계산
    }

    const base = card;
    card = function (it, inPopup, priority) {
      const box = base(it, inPopup, priority);
      if (!inPopup || !it || !Number.isFinite(it._t) || !it.title) return box;
      try {
        if (map) document.documentElement.style.setProperty("--npl-max", `${Math.max(200, Math.min(460, map.getContainer().clientHeight / 2 - 24))}px`);
        loadDict().then(d => {
          if (!d) return;
          const hits = STK.match(d, it).slice(0, MAX);
          if (hits.length) addBlock(box, it, hits).catch(e => console.warn("stock-link", e));
        });
      } catch (e) { console.warn("stock-link", e); }   // 문제가 생겨도 뉴스 팝업은 그대로
      return box;
    };

    // ════════ 시세 탭: 뉴스에 많이 나온 종목 ════════
    const MT = {
      ko: { group: "뉴스에 많이 나온 종목 (최근 24시간)", filt: "뉴스 속 종목", n: n => `뉴스 ${n}건`, close: "종가", daily: "하루 1번(다음 영업일 오후)",
        empty: "최근 24시간 뉴스에 이름이 나온 종목이 없어요.", loading: "종목을 고르는 중…",
        note: "시가총액 상위 200종목 중 최근 24시간 뉴스 제목(공시 포함)에 이름이 나온 기사가 많은 순서예요. 주가는 하루 종가이고 추세선은 최근 약 3달이에요. 뉴스가 많다고 오른다는 뜻이 아니에요. 출처: 금융위원회 주식시세정보(공공누리 4유형)." },
      en: { group: "Stocks most in the news (last 24 h)", filt: "Stocks in the news", n: n => `${n} stories`, close: "close", daily: "Once a day (next business day)",
        empty: "No tracked stocks named in the last 24 hours of news.", loading: "Picking stocks…",
        note: "Among the top 200 Korean stocks by market cap, ordered by how many news titles (including filings) named them in the last 24 hours. Prices are daily closes; the trend line covers about 3 months. More news does not mean the price will rise. Source: FSC stock price data (KOGL type 4)." },
      ja: { group: "ニュースによく出た銘柄（直近24時間）", filt: "ニュースの銘柄", n: n => `ニュース${n}件`, close: "終値", daily: "1日1回（翌営業日午後）",
        empty: "直近24時間のニュースに名前が出た銘柄はありません。", loading: "銘柄を選んでいます…",
        note: "時価総額上位200銘柄のうち、直近24時間のニュースのタイトル（開示を含む）に名前が出た記事が多い順です。株価は日次終値、推移線は約3か月です。ニュースが多いから上がるという意味ではありません。出典：金融委員会 株式相場情報（公共ヌリ4類型）。" },
    };
    const mt = k => (MT[LANG] || MT.ko)[k];
    for (const k of Object.keys(MT)) if (T[k]?.mFilt) T[k].mFilt.stocks = MT[k].filt;
    if (typeof MKT_FILTER !== "undefined" && !MKT_FILTER.includes("stocks")) MKT_FILTER.unshift("stocks");

    // 최근 24시간 소식 → 종목별 기사(5분 동안 다시 씀)
    let topAt = 0, topItems = null, topLen = -1, topDict = null, topRes = [];
    function topStocks(d) {   // 같은 소식 목록(배열·건수)·같은 종목 목록이면 5분 동안 다시 씀 — 소식이 늦게 들어오면(건수가 바뀜) 다시 셈
      if (topItems === items && topLen === items.length && topDict === d && Date.now() - topAt < 5 * 60e3) return topRes;
      const now = Date.now(), by = new Map();
      for (const it of items) {
        if (!(it._t >= now - 24 * H && it._t <= now + 10 * 60e3)) continue;
        for (const h of STK.match(d, it)) {
          const e = by.get(h.code) || by.set(h.code, { ...h, news: [] }).get(h.code);
          e.news.push(it);
        }
      }
      topRes = [...by.values()].sort((a, b) => b.news.length - a.news.length || a.rank - b.rank).slice(0, 12);
      for (const e of topRes) e.news.sort((a, b) => b._t - a._t);
      topItems = items; topLen = items.length; topDict = d; topAt = now;
      return topRes;
    }
    // 종목들의 최근 약 95일 종가(30분 동안 다시 씀)
    const histCache = new Map();
    async function history(codes) {
      const k = codes.slice().sort().join(","), c = histCache.get(k);
      if (c && Date.now() - c.at < 30 * 60e3) return c.p;
      const p = (async () => {
        const out = [];
        for (let i = 0; i < codes.length; i += 6) {           // 1,000줄 한도 안으로 나눠 읽음(6종목 × 약 65일)
          const { data, error } = await db.from("stk_daily").select("code,d,close,chg").in("code", codes.slice(i, i + 6))
            .gte("d", isoDay(Date.now() - 95 * DAY)).order("d").limit(1000);
          if (error) throw error;
          out.push(...(data || []));
        }
        return out;
      })();
      histCache.set(k, { at: Date.now(), p });
      p.catch(() => histCache.delete(k));
      return p;
    }
    function stockTile(e, rows) {
      const box = el("article", "tile stk-tile");
      box.id = `px-STK-${e.code}`;
      const lbl = box.appendChild(el("div", "lbl"));
      const a = lbl.appendChild(el("a", null, e.name));
      a.href = `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(e.code)}`;
      a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = `${tx("link")} ↗`;
      lbl.append(el("small", null, ` ${e.market || ""}`));
      const pts = rows.filter(r => r.code === e.code).map(r => ({ t: Date.parse(`${r.d}T00:00:00Z`), v: Number(r.close), chg: r.chg }));
      const last = pts.at(-1);
      if (last) {
        const val = box.appendChild(el("div", "val", nf(last.v, "KRW")));
        val.appendChild(el("small", null, UNITS.KRW[li()]));
        const c = last.chg ?? 0, dir = c > 0 ? "up" : c < 0 ? "down" : "flat";
        box.append(el("div", `dlt ${dir}`, `${c > 0 ? "▲" : c < 0 ? "▼" : "–"} ${Math.abs(c).toFixed(2)}% ${t("mPrev")}`));
        box.append(el("div", "asof", `${dayText(last.t)} ${mt("close")} · ${mt("daily")}`));
        if (pts.length >= 2) box.append(spark(pts, "KRW", box));
      } else box.append(el("div", "asof", tx("none")));
      const news = box.appendChild(el("div", "stk-news"));
      news.append(el("div", "stk-cnt", mt("n")(e.news.length)));
      for (const it of e.news.slice(0, 2)) {
        const b = news.appendChild(el("button", null, it.title));
        b.type = "button"; b.title = it.title;
        b.addEventListener("click", () => { showTab("news"); openItem(it, true); });
      }
      return box;
    }
    let mktToken = 0;
    async function fillStocks(token) {
      const sec = el("section", "stk-mkt");
      sec.append(el("h3", null, mt("group")), el("p", "empty", mt("loading")));
      $("market").prepend(sec);
      try {
        const d = await loadDict();
        if (token !== mktToken || !d) return sec.remove();      // 종목 목록을 못 읽으면 묶음을 안 보임(시세 탭은 그대로)
        for (let i = 0; !items.length && i < 30; i++) {          // 시세가 뉴스보다 먼저 오면 뉴스가 들어올 때까지 잠깐 기다림(최대 1분)
          await new Promise(r => setTimeout(r, 2000));
          if (token !== mktToken) return;
        }
        const top = topStocks(d);
        if (!top.length) { sec.replaceChildren(el("h3", null, mt("group")), el("p", "empty", mt("empty"))); return; }
        const rows = await history(top.map(e => e.code));
        if (token !== mktToken || !sec.isConnected) return;
        const grid = el("div", "tiles");
        grid.append(...top.map(e => stockTile(e, rows)));
        sec.replaceChildren(el("h3", null, mt("group")), grid, el("p", "mnote", mt("note")));
      } catch (e) { console.warn("stock-link market", e); sec.remove(); }
    }
    if (typeof renderMarket === "function") {
      const baseRender = renderMarket;
      renderMarket = function () {
        baseRender();
        try {
          const token = ++mktToken;
          if (market && market.latest.size && !hiddenMkt.has("stocks")) fillStocks(token);
        } catch (e) { console.warn("stock-link market", e); }
      };
      if (market) renderMarket();                                 // 이미 그려져 있으면 한 번 더
    }
    // 중요 공시(dart-key.js, 2026-11-18) — 이 파일이 불러옴. 시세 탭에서 이 묶음 바로 아래 + 뉴스 카드에 "📌 종류"
    const dk = document.createElement("script");
    dk.src = "dart-key.js";
    document.head.append(dk);

    const css = document.createElement("style");
    css.textContent = `
/* 시세 탭 묶음 제목(환율·금리·뉴스에 많이 나온 종목 …)을 더 크고 선명하게 (사용자 요청 2026-11-18: 15.5px → "2배" 24px — index.html 의 12px·흐린 색 규칙을 여기서 덮어씀) */
#market h3 { font-size: 24px; font-weight: 800; color: var(--text); letter-spacing: -.02em; line-height: 1.25;
  margin: 28px 2px 12px; padding-left: 12px; border-left: 4px solid var(--accent); }
#market > h3:first-child, #market > :first-child > h3:first-child { margin-top: 10px; }
@media (max-width: 600px) { #market h3 { font-size: 20px; } }   /* 휴대폰은 조금 작게(긴 제목이 두 줄로 넘치지 않게) */
.maplibregl-popup-content > .card:has(> .stk) { max-height: calc(var(--npl-max, 46vh) - 28px); overflow-y: auto; overscroll-behavior: contain; }
.stk { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 6px; display: grid; gap: 6px; }
.stk-head { font-size: 11.5px; font-weight: 700; color: var(--muted); }
.stk-row { display: grid; gap: 1px; }
.stk-name { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
.stk-name a { color: var(--text); text-decoration: none; font-weight: 600; }
.stk-name a:hover { text-decoration: underline; }
.stk-val { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.stk-chart { position: relative; }
.stk-chart svg { width: 100%; height: 26px; display: block; overflow: visible; touch-action: pan-y; }
.stk-mark { position: absolute; top: -4px; transform: translateX(3px); font-size: 10px; color: var(--muted); pointer-events: none; }
.stk-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); line-height: 1.2; }
.stk-note { font-size: 10.5px; color: var(--muted); line-height: 1.4; }
.stk-tile .lbl a { color: var(--text); font-weight: 700; text-decoration: none; }
.stk-tile .lbl a:hover { text-decoration: underline; }
.stk-tile .lbl small { color: var(--muted); font-size: 10.5px; }
.stk-news { display: grid; gap: 1px; margin-top: 4px; border-top: 1px dashed var(--line); padding-top: 4px; min-width: 0; }
.stk-cnt { font-size: 11px; font-weight: 700; color: var(--accent); }
.stk-news button { background: none; border: 0; padding: 0; text-align: left; color: var(--text); font-size: 11.5px; cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.stk-news button:hover { text-decoration: underline; }`;
    document.head.append(css);
  }
})();
