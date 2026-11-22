// 당일 시세(한국투자증권 Open API) 화면 (2026-11-21 사용자 요청 "증권사 API로 실시간 시세")
// - 서버 함수 kis-quotes 가 평일 장중 5분마다 지수 3(코스피·코스닥·코스피200)·종목 200·ETF 61 현재가를 표 live_quotes 에 넣음(종목마다 최신 한 줄).
// - 이 파일: 그 표를 5분마다 읽어, 공식 종가(공공데이터, 다음 영업일 오후)보다 새 날 값이면 (2026-11-21 넓힘: ☀ 요약 창 코스피 칸·뉴스 팝업 종목/ETF 그래프 아래 한 줄도)
//   시세 탭 카드(#px-KOSPI·KOSDAQ·KOSPI200, #px-STK-코드, #px-ETF-코드)와 위쪽 시세 띠(코스피)의 큰 숫자·전일 대비·날짜를 당일 값으로 바꿈
//   (2026-11-22 사용자 요청 — 공식 종가는 카드 아래 작은 줄 "공식 기록 11/19 종가 …", 추세선은 공식 값 그대로).
//   그 카드의 속보 표시(market-news.js .mk-live, stock-today.js .st-live)는 더 정확한 이 값으로 바뀜(지움). 공식 종가가 들어오면 이 표시는 저절로 사라짐.
// - 출처 표기: 한국투자증권 Open API. index.html 수정 없음(list-sort.js 가 이 파일을 불러옴). 표가 없거나 못 읽으면 아무것도 안 함.
(() => {
  if (typeof db === "undefined" || typeof el !== "function") return;
  const H = 3600e3;
  const TX = {
    ko: { head: "📡 당일 시세", src: "한국투자증권", badge: "당일", official: (d, v) => `공식 기록 ${d} 종가 ${v} · 다음 영업일 오후에 새 값으로 바뀌어요`, close: d => `${d} 종가`, intra: t => `장중 ${t}` },
    en: { head: "📡 Same-day quote", src: "Korea Investment & Securities", badge: "today", official: (d, v) => `Official record: ${d} close ${v} · updated the next business afternoon`, close: d => `${d} close`, intra: t => `intraday ${t}` },
    ja: { head: "📡 当日相場", src: "韓国投資証券", badge: "当日", official: (d, v) => `公式記録 ${d}終値 ${v} · 翌営業日の午後に更新`, close: d => `${d}終値`, intra: t => `場中 ${t}` },
  };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];
  const kstDay = t => new Date(t + 9 * H).toISOString().slice(0, 10);
  const when = t => new Intl.DateTimeFormat(undefined, { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(t);

  // 받은 시각 → 그 값의 거래일과 "장중/종가": 평일 09:00~15:30 KST 면 장중, 그 밖(장 뒤·밤·주말)이면 마지막 거래일 종가(공휴일은 모름 — 그 전 거래일 값이 다시 올 뿐)
  function tradeInfo(t) {
    const k = new Date(t + 9 * H), mins = k.getUTCHours() * 60 + k.getUTCMinutes(), wd = k.getUTCDay();
    if (wd >= 1 && wd <= 5 && mins >= 540 && mins < 930) return { day: k.toISOString().slice(0, 10), intra: true, hm: k.toISOString().slice(11, 16) };
    const d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
    if (wd >= 1 && wd <= 5 && mins < 540) d.setUTCDate(d.getUTCDate() - 1);   // 장 시작 전이면 전날
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
    return { day: d.toISOString().slice(0, 10), intra: false };
  }
  const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const label = q => { const ti = tradeInfo(q._t); return ti.intra ? tx("intra")(ti.hm) : tx("close")(md(ti.day)); };
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
  // 2026-11-22 사용자 "당일 시세가 있는데 전일 값을 크게 보일 이유가?" → 큰 숫자·전일 대비·날짜를 당일 값으로 바꾸고, 공식 값은 아래 작은 줄(.lv-live)로
  function decorate() {
    if (!live?.size) return;
    for (const tile of document.querySelectorAll('#market [id^="px-"]')) {
      const id = tile.id.slice(3), code = id.replace(/^(STK|ETF)-/, "");
      if (!/^(KOSPI|KOSDAQ|KOSPI200)$/.test(id) && !/^(STK|ETF)-/.test(id)) continue;
      const q = live.get(code);
      if (!q || q.price == null) continue;
      const od = tile.dataset.lvOd || officialDay(tile, code);                    // 처음 본 공식 날짜를 기억(바꾼 뒤엔 .asof 가 당일 날짜라서)
      if (!od || tradeInfo(q._t).day <= od) continue;                            // 공식 값이 같은 거래일이거나 더 새로우면 그대로
      if (tile.dataset.lvAt === String(q._t) && tile.querySelector(".lv-live")) continue;   // 이미 이 값으로 바꿈(바꾸기 → 감시 → 다시 바꾸기 반복 막기)
      tile.dataset.lvAt = String(q._t);
      const val = tile.querySelector(".val"), dlt = tile.querySelector(".dlt"), asof = tile.querySelector(".asof");
      if (!val) continue;
      if (!tile.dataset.lvOd) {                                                  // 처음: 공식 값 글을 기억
        tile.dataset.lvOd = od;
        tile.dataset.lvOv = val.firstChild?.nodeType === 3 ? val.firstChild.textContent : "";
        tile.dataset.lvOdl = dlt ? (dlt.textContent.match(/^[▲▼–]\s*[\d.,]+%?/) || [""])[0] : "";
      }
      const d = q.kind === "index" ? 2 : 0, v = line(q, d);
      if (val.firstChild?.nodeType === 3) val.firstChild.textContent = fmt(q.price, d); else val.prepend(fmt(q.price, d));
      if (dlt) {
        dlt.className = `dlt ${v.cls}`;
        dlt.textContent = `${v.cls === "down" ? "▼" : v.cls === "up" ? "▲" : "–"} ${q.chg != null ? `${fmt(Math.abs(q.chg), d)} ` : ""}(${fmt(Math.abs(q.pct ?? 0), 2)}%) ${typeof t === "function" ? t("mPrev") : ""}`.trim();
      }
      if (asof) asof.textContent = `📡 ${label(q)} · ${tx("src")}`;
      tile.querySelectorAll(".mk-live, .st-live, .lv-live").forEach(x => x.remove());   // 속보 표시·지난번 작은 줄은 지움
      const off = el("div", "lv-live", tx("official")(md(tile.dataset.lvOd), [tile.dataset.lvOv, tile.dataset.lvOdl].filter(Boolean).join(" ")));
      off.title = `${tx("head")} · ${tx("src")} (${when(q._t)})`;
      if (asof) asof.after(off); else tile.append(off);
    }
    // 위쪽 시세 띠: 코스피 — 값·변동 글을 당일 값으로, 작은 "📡 11/20" 표시
    const q = live.get("KOSPI"), r = typeof market !== "undefined" && market?.latest?.get("KOSPI");
    if (q && r && tradeInfo(q._t).day > new Date(r._t).toISOString().slice(0, 10) && typeof SYM !== "undefined") {
      const sb = [...document.querySelectorAll("#mstrip button")].find(x => x.querySelector(".n")?.textContent === SYM.KOSPI[li()]);
      if (sb) {
        sb.querySelectorAll(".mk-badge, .lv-badge").forEach(x => x.remove());
        const v = line(q, 2), vEl = sb.querySelector(".v");
        if (vEl) vEl.textContent = fmt(q.price, 2);
        let dEl = [...sb.children].find(x => /^(up|down|flat)$/.test(x.className));
        if (!dEl) dEl = sb.appendChild(el("span"));
        dEl.className = v.cls; dEl.textContent = `${v.cls === "down" ? "▼" : v.cls === "up" ? "▲" : "–"}${fmt(Math.abs(q.pct ?? 0), 2)}%`;
        const ti = tradeInfo(q._t), s = sb.appendChild(el("span", "lv-badge", ti.intra ? `📡 ${ti.hm}` : `📡 ${md(ti.day)}`));
        sb.title = s.title = `${tx("head")} · ${label(q)} · ${tx("src")} (${when(q._t)})`;
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
  setInterval(() => { if (document.visibilityState === "visible") load(true).then(() => { decorate(); decorateBrief(true); }).catch(() => {}); }, 5 * 60e3);
  // ☀ 요약 창(#brief) 시세 칸의 코스피: 당일 값이 공식 값보다 새 거래일이면 값·변동·때를 바꿈
  function decorateBrief(again) {
    const pop = document.getElementById("brief"), q = live?.get("KOSPI"), r = typeof market !== "undefined" && market?.latest?.get("KOSPI");
    if (!pop || pop.hidden || !q || !r || typeof SYM === "undefined" || tradeInfo(q._t).day <= new Date(r._t).toISOString().slice(0, 10)) return;
    const b = [...pop.querySelectorAll(".br-px")].find(x => x.querySelector(".br-px-n")?.textContent === SYM.KOSPI[li()]);
    if (!b || (b.dataset.lv && !again)) return;
    b.dataset.lv = "1";
    const v = line(q, 2);
    b.querySelector(".br-px-v").textContent = fmt(q.price, 2);
    const d = b.querySelector(".br-px-d") || b.appendChild(el("span", "br-px-d"));
    d.className = `br-px-d ${v.cls}`; d.textContent = `${q.pct < 0 ? "▼" : "▲"} ${fmt(Math.abs(q.pct), 2)}%`;
    const t = b.querySelector(".br-px-t");
    if (t) t.textContent = `📡 ${label(q)}`;
    b.title = `${tx("head")} · ${label(q)} · ${tx("src")}`;
  }
  // 뉴스 팝업의 종목(.stk-row)·ETF(.etf-row) 그래프 줄: 그래프 끝 날짜보다 새 거래일 값이 있으면 그 아래 한 줄
  function decoratePopups() {
    if (!live?.size) return;
    for (const row of document.querySelectorAll(".maplibregl-popup .stk-row, .maplibregl-popup .etf-row")) {
      if (row.querySelector(".lv-row")) continue;
      const code = (row.querySelector('a[href*="code="]')?.href.match(/code=([0-9A-Z]+)/) || [])[1], q = code && live.get(code);
      const m = (row.querySelector(".stk-val, .etf-val")?.textContent || "").match(/(\d{1,2})[./]\s*(\d{1,2})/);
      if (!q || q.price == null || !m) continue;
      const y = new Date(Date.now() + 9 * H).getUTCFullYear(), od = `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      if (tradeInfo(q._t).day <= od) continue;
      const v = line(q, 0), x = el("div", "lv-row");
      x.append(`${tx("head")} · ${label(q)}: `, el("b", `lv-val ${v.cls}`, v.text), ` · ${tx("src")}`);
      row.append(x);
    }
  }
  let tb = 0, tp = 0;
  (function watchBrief(tries = 0) {
    const pop = document.getElementById("brief");
    if (!pop) { if (tries < 120) setTimeout(() => watchBrief(tries + 1), 500); return; }
    new MutationObserver(() => { clearTimeout(tb); tb = setTimeout(() => load().then(decorateBrief).catch(() => {}), 200); }).observe(pop, { childList: true, attributes: true, attributeFilter: ["hidden"] });
  })();
  (function watchPopups(tries = 0) {
    const mapEl = document.getElementById("map");
    if (!mapEl) { if (tries < 120) setTimeout(() => watchPopups(tries + 1), 500); return; }
    new MutationObserver(() => { clearTimeout(tp); tp = setTimeout(() => load().then(decoratePopups).catch(() => {}), 300); }).observe(mapEl, { childList: true, subtree: true });
  })();
  globalThis.LIVEQ = { load, get: c => live?.get(c) };

  const css = document.createElement("style");
  css.textContent = `
.lv-live { margin-top: 2px; font-size: 10.5px; line-height: 1.35; color: var(--muted); opacity: .85; }
.lv-head { color: #16a34a; font-weight: 700; }
.lv-val { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
.lv-row { margin-top: 3px; font-size: 11.5px; color: var(--muted); } .lv-row .lv-val { font-size: 12.5px; }
.lv-badge { margin-left: 4px; font-size: 10.5px; font-weight: 700; color: #16a34a; }`;
  document.head.append(css);
})();
