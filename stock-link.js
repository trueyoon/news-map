// 뉴스 ↔ 종목 연결 (2026-11-18 사용자 요청). 뉴스 팝업에 "관련 종목"과 그 종목의 뉴스 전후 종가 그래프를 붙임.
// - 어떤 말을 어느 종목으로 볼지는 stock-core.js (이 파일이 불러옴). 종목 목록은 DB stk_items(시가총액 상위 200, 매주 갱신), 종가는 stk_daily.
// - 주가는 하루 한 번 종가(다음 영업일 오후에 올라옴) — 실시간 아님. "원인을 뜻하지 않아요"를 함께 적음.
// - index.html 맨 아래 <script src="stock-link.js"></script> 한 줄로 불러옴. index.html 의 card()(소식 카드)를 감싸 팝업일 때만 붙임.
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

    const css = document.createElement("style");
    css.textContent = `
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
.stk-note { font-size: 10.5px; color: var(--muted); line-height: 1.4; }`;
    document.head.append(css);
  }
})();
