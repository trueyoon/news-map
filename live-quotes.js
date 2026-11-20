// 당일 시세(한국투자증권 Open API) 화면 (2026-11-21 사용자 요청 "증권사 API로 실시간 시세")
// - 서버 함수 kis-quotes 가 평일 장중 5분마다 지수 3(코스피·코스닥·코스피200)·종목 200·ETF 61 현재가를 표 live_quotes 에 넣음(종목마다 최신 한 줄).
// - 이 파일: 그 표를 5분마다 읽어, 공식 종가(공공데이터, 다음 영업일 오후)보다 새 날 값이면
//   시세 탭 카드(#px-KOSPI·KOSDAQ·KOSPI200, #px-STK-코드, #px-ETF-코드)와 위쪽 시세 띠(코스피)에 "📡 당일 시세"로 먼저 보여 줌.
//   그 카드의 속보 표시(market-news.js .mk-live, stock-today.js .st-live)는 더 정확한 이 값으로 바뀜(지움). 공식 종가가 들어오면 이 표시는 저절로 사라짐.
// - 출처 표기: 한국투자증권 Open API. index.html 수정 없음(list-sort.js 가 이 파일을 불러옴). 표가 없거나 못 읽으면 아무것도 안 함.
(() => {
  if (typeof db === "undefined" || typeof el !== "function") return;
  const H = 3600e3;
  const TX = {
    ko: { head: "📡 당일 시세", src: "한국투자증권", badge: "당일" },
    en: { head: "📡 Same-day quote", src: "Korea Investment & Securities", badge: "today" },
    ja: { head: "📡 当日相場", src: "韓国投資証券", badge: "当日" },
  };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];
  const kstDay = t => new Date(t + 9 * H).toISOString().slice(0, 10);
  const when = t => new Intl.DateTimeFormat(undefined, { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(t);

  let live = null, at = 0, loading = null;
  async function load(force) {
    if (!force && live && Date.now() - at < 5 * 60e3) return live;
    if (loading) return loading;
    loading = (async () => {
      try {
        const { data, error } = await db.from("live_quotes").select("code,kind,name,ts,price,chg,pct").limit(1000);
        if (!error) { live = new Map((data || []).map(r => [r.code, { ...r, _t: Date.parse(r.ts) }])); at = Date.now(); }
      } catch { /* 다음에 */ } finally { loading = null; }
      return live;
    })();
    return loading;
  }
  const fmt = (v, d) => Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  function line(q, d) {
    const dir = (q.pct ?? q.chg ?? 0) < 0 ? -1 : (q.pct ?? q.chg ?? 0) > 0 ? 1 : 0;
    const arrow = dir < 0 ? "▼" : dir > 0 ? "▲" : "–";
    return { cls: dir < 0 ? "down" : dir > 0 ? "up" : "flat",
      text: `${fmt(q.price, d)}${q.chg != null ? ` ${arrow}${fmt(Math.abs(q.chg), d)}` : ""}${q.pct != null ? ` (${q.pct > 0 ? "+" : q.pct < 0 ? "−" : ""}${fmt(Math.abs(q.pct), 2)}%)` : ""}` };
  }
  // 카드의 공식 값 날짜: 지수는 market.latest, 종목·ETF 는 카드의 .asof 글("11. 19." / "11/19")
  function officialDay(tile, code) {
    const r = typeof market !== "undefined" && market?.latest?.get(code);
    if (r) return new Date(r._t).toISOString().slice(0, 10);
    const m = (tile.querySelector(".asof")?.textContent || "").match(/(\d{1,2})[./]\s*(\d{1,2})/);
    if (!m) return null;
    const y = new Date(Date.now() + 9 * H).getUTCFullYear(), d = `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return d > kstDay(Date.now()) ? `${y - 1}${d.slice(4)}` : d;
  }
  function decorate() {
    if (!live?.size) return;
    for (const tile of document.querySelectorAll('#market [id^="px-"]')) {
      if (tile.querySelector(".lv-live")) continue;
      const id = tile.id.slice(3), code = id.replace(/^(STK|ETF)-/, "");
      if (!/^(KOSPI|KOSDAQ|KOSPI200)$/.test(id) && !/^(STK|ETF)-/.test(id)) continue;
      const q = live.get(code), od = q && officialDay(tile, code);
      if (!q || q.price == null || !od || kstDay(q._t) <= od) continue;            // 공식 값이 같은 날이거나 더 새로우면 안 붙임
      const v = line(q, q.kind === "index" ? 2 : 0), box = el("div", "lv-live");
      box.append(el("div", "lv-head", `${tx("head")} · ${when(q._t)} · ${tx("src")}`), el("div", `lv-val ${v.cls}`, v.text));
      tile.querySelectorAll(".mk-live, .st-live").forEach(x => x.remove());          // 속보 표시는 이 값으로 바뀜
      const asof = tile.querySelector(".asof");
      if (asof) asof.after(box); else tile.append(box);
    }
    // 위쪽 시세 띠: 코스피
    const q = live.get("KOSPI"), r = typeof market !== "undefined" && market?.latest?.get("KOSPI");
    if (q && r && kstDay(q._t) > new Date(r._t).toISOString().slice(0, 10) && typeof SYM !== "undefined") {
      const sb = [...document.querySelectorAll("#mstrip button")].find(x => x.querySelector(".n")?.textContent === SYM.KOSPI[li()]);
      if (sb && !sb.querySelector(".lv-badge")) {
        sb.querySelector(".mk-badge")?.remove();
        const v = line(q, 2), s = sb.appendChild(el("span", `lv-badge ${v.cls}`, `${tx("badge")} ${fmt(q.price, 2)} ${q.pct < 0 ? "▼" : "▲"}${fmt(Math.abs(q.pct), 2)}%`));
        s.title = `${tx("head")} · ${when(q._t)} · ${tx("src")}`;
      }
    }
  }
  // 시세 탭이 다시 그려질 때·5분마다 다시
  let t0 = 0;
  (function watch(tries = 0) {
    const m = document.getElementById("market");
    if (!m) { if (tries < 120) setTimeout(() => watch(tries + 1), 500); return; }
    new MutationObserver(() => { clearTimeout(t0); t0 = setTimeout(() => load().then(decorate).catch(() => {}), 250); }).observe(m, { childList: true, subtree: true });
    load().then(decorate).catch(() => {});
  })();
  setInterval(() => { if (document.visibilityState === "visible") load(true).then(() => { document.querySelectorAll(".lv-live, .lv-badge").forEach(x => x.remove()); decorate(); }).catch(() => {}); }, 5 * 60e3);
  globalThis.LIVEQ = { load, get: c => live?.get(c) };

  const css = document.createElement("style");
  css.textContent = `
.lv-live { margin-top: 6px; padding: 6px 8px; border: 1px solid #22c55e; border-radius: 8px; display: grid; gap: 1px; font-size: 11.5px; line-height: 1.4; }
.lv-head { color: #16a34a; font-weight: 700; }
.lv-val { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
.lv-badge { margin-left: 4px; font-size: 11px; font-weight: 800; border: 1px solid #22c55e; border-radius: 6px; padding: 0 4px; }`;
  document.head.append(css);
})();
