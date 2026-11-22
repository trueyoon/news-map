// 금·은 "살 때 · 팔 때 (우리은행)" 카드 꾸미기 (2026-11-22 사용자 요청: "살 때·팔 때가 눈에 안 띔 → 살 때 초록·팔 때 노랑으로 대조, 그래프 더 정교하게, 1g 부분을 화려하게")
// - index.html 의 pairTile() 이 만든 카드(#px-GOLD_WOORI_BUY·#px-GOLDBAR_WOORI_BUY·#px-SILVER_WOORI_BUY)를 그린 뒤에 고침(index.html 수정 없음, list-sort.js 가 불러옴).
//   ① 살 때 줄 초록·팔 때 줄 노랑(꼬리표·글자·옅은 바탕) ② "1g" 칸: 금은 금괴처럼 반짝이는 금빛, 은은 은빛
//   ③ 그래프: 살 때·팔 때 두 선 + 그 사이 차이 띠 + 위·가운데·아래 값 눈금 + 날짜 + 마지막 값 + 누르거나 올리면 그날 두 값·차이, [1달|3달] 고르기(기억 gpRange)
// - 값은 카드와 같은 기준(1g 당, 골드바·실버바 살 때는 부가세 10% 포함). 자료는 화면이 이미 받은 market.daily(하루 마지막 값) — 새로 받는 것 없음.
(() => {
  if (typeof el !== "function") return;
  const PAIRS_GP = [
    { buy: "GOLD_WOORI_BUY", sell: "GOLD_WOORI_SELL", grams: 1, vat: false, metal: "gold" },
    { buy: "GOLDBAR_WOORI_BUY", sell: "GOLDBAR_WOORI_SELL", grams: 10, vat: true, metal: "gold" },
    { buy: "SILVER_WOORI_BUY", sell: "SILVER_WOORI_SELL", grams: 1000, vat: true, metal: "silver" },
  ];
  const TX = {
    ko: { buy: "살 때", sell: "팔 때", gap: "차이", per: "1g 기준", m1: "1달", m3: "3달", chg: (p, v) => `${p} 동안 살 때 ${v}`, aria: "살 때·팔 때 그래프", vat: "부가세 포함" },
    en: { buy: "Buy", sell: "Sell", gap: "Spread", per: "per 1 g", m1: "1M", m3: "3M", chg: (p, v) => `Buy ${v} over ${p}`, aria: "Buy/sell chart", vat: "incl. VAT" },
    ja: { buy: "買い", sell: "売り", gap: "差", per: "1g あたり", m1: "1か月", m3: "3か月", chg: (p, v) => `${p}で買い ${v}`, aria: "買い・売りグラフ", vat: "税込" },
  };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];
  const loc = () => (typeof LOCALE !== "undefined" && LOCALE[LANG]) || undefined;
  const won = v => `${new Intl.NumberFormat(loc(), { maximumFractionDigits: 0 }).format(v)}${typeof UNITS !== "undefined" ? UNITS.KRW[li()] : "원"}`;
  const num = v => new Intl.NumberFormat(loc(), { maximumFractionDigits: 0 }).format(v);
  const md = t => { const d = new Date(t); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
  let range = "3m";
  try { range = localStorage.getItem("gpRange") === "1m" ? "1m" : "3m"; } catch { /* 기억 없음 */ }
  const NS = "http://www.w3.org/2000/svg";
  const mk = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };

  // 살 때·팔 때 하루 값을 날짜로 맞춤 → [{t, b, s}]
  function series(pr) {
    if (typeof market === "undefined" || !market?.daily) return [];
    const perG = (v, buy) => v / pr.grams * (buy && pr.vat ? 1.1 : 1);
    const day = t => Math.floor(t / 86400e3);
    const sm = new Map((market.daily.get(pr.sell) || []).map(q => [day(q.t), perG(q.v, false)]));
    return (market.daily.get(pr.buy) || []).filter(q => sm.has(day(q.t))).map(q => ({ t: q.t, b: perG(q.v, true), s: sm.get(day(q.t)) }));
  }

  function chart(pr, wrap) {
    const all = series(pr);
    wrap.replaceChildren();
    if (all.length < 2) return;
    const cut = all.at(-1).t - (range === "1m" ? 31 : 92) * 86400e3, pts = all.filter(p => p.t >= cut);
    if (pts.length < 2) return;
    // 머리: 범례 + 기간 버튼 + 기간 변화
    const head = wrap.appendChild(el("div", "gp-head"));
    const lg = head.appendChild(el("div", "gp-legend"));
    lg.append(el("span", "gp-k gp-kb", tx("buy")), el("span", "gp-k gp-ks", tx("sell")), el("span", "gp-k gp-kg", tx("gap")), el("span", "gp-per", tx("per")));
    const btns = head.appendChild(el("div", "gp-rng"));
    for (const k of ["1m", "3m"]) {
      const b = btns.appendChild(el("button", k === range ? "on" : null, tx(k === "1m" ? "m1" : "m3")));
      b.type = "button"; b.setAttribute("aria-pressed", String(k === range));
      b.addEventListener("click", e => {
        e.stopPropagation(); range = k;
        try { localStorage.setItem("gpRange", k); } catch { /* 기억 없음 */ }
        document.querySelectorAll(".tile.gp").forEach(t => { const p = PAIRS_GP.find(x => `px-${x.buy}` === t.id), w = t.querySelector(".gp-chart"); if (p && w) chart(p, w); });
      });
    }
    const c0 = pts[0].b, c1 = pts.at(-1).b, ch = (c1 / c0 - 1) * 100;
    head.append(el("div", `gp-chg ${ch > 0 ? "up" : ch < 0 ? "down" : "flat"}`, tx("chg")(tx(range === "1m" ? "m1" : "m3"), `${ch > 0 ? "▲ +" : ch < 0 ? "▼ −" : ""}${Math.abs(ch).toFixed(1)}%`)));

    // 그림: 실제 픽셀 크기로(글자가 늘어나지 않게)
    const W = Math.max(260, Math.round(wrap.clientWidth || 320)), Hh = 150, L = 62, R = 58, T = 10, B = 22;
    const vs = pts.flatMap(p => [p.b, p.s]), lo0 = Math.min(...vs), hi0 = Math.max(...vs), pad = (hi0 - lo0) * 0.08 || hi0 * 0.01;
    const lo = lo0 - pad, hi = hi0 + pad, n = pts.length - 1;
    const X = i => L + (i / n) * (W - L - R), Y = v => T + (1 - (v - lo) / (hi - lo)) * (Hh - T - B);
    const svg = mk("svg", { viewBox: `0 0 ${W} ${Hh}`, width: W, height: Hh, role: "img", "aria-label": tx("aria"), class: "gp-svg" });
    // 눈금 3줄
    for (const f of [0, 0.5, 1]) {
      const v = lo0 + (hi0 - lo0) * f, y = Y(v);
      svg.append(mk("line", { x1: L, x2: W - R, y1: y, y2: y, class: "gp-grid" }));
      const tl = mk("text", { x: L - 6, y: y + 3.5, "text-anchor": "end", class: "gp-ax" }); tl.textContent = num(v); svg.append(tl);
    }
    // 날짜 3개
    for (const i of [0, Math.round(n / 2), n]) {
      const tt = mk("text", { x: X(i), y: Hh - 6, "text-anchor": i === 0 ? "start" : i === n ? "end" : "middle", class: "gp-ax" }); tt.textContent = md(pts[i].t); svg.append(tt);
    }
    // 차이 띠(살 때 선 ~ 팔 때 선)
    const lineD = k => pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join("");
    const band = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.b).toFixed(1)}`).join("") +
      pts.slice().reverse().map((p, j) => `L${X(n - j).toFixed(1)} ${Y(p.s).toFixed(1)}`).join("") + "Z";
    svg.append(mk("path", { d: band, class: "gp-band" }), mk("path", { d: lineD("s"), class: "gp-ls" }), mk("path", { d: lineD("b"), class: "gp-lb" }));
    // 마지막 값 점 + 오른쪽 값 글자(겹치면 벌림)
    const yb = Y(pts[n].b), ys = Y(pts[n].s);
    let lb = yb, ls = ys;
    if (Math.abs(ls - lb) < 13) { const m = (lb + ls) / 2; lb = m - 6.5; ls = m + 6.5; }
    svg.append(mk("circle", { cx: X(n), cy: yb, r: 3.6, class: "gp-db" }), mk("circle", { cx: X(n), cy: ys, r: 3.6, class: "gp-ds" }));
    const vb = mk("text", { x: W - R + 6, y: lb + 3.5, class: "gp-vb" }); vb.textContent = num(pts[n].b);
    const vsT = mk("text", { x: W - R + 6, y: ls + 3.5, class: "gp-vs" }); vsT.textContent = num(pts[n].s);
    svg.append(vb, vsT);
    // 올리면 그날
    const cross = mk("line", { y1: T, y2: Hh - B, class: "gp-cross", visibility: "hidden" });
    const hb = mk("circle", { r: 4, class: "gp-db", visibility: "hidden" }), hs = mk("circle", { r: 4, class: "gp-ds", visibility: "hidden" });
    svg.append(cross, hb, hs);
    const frame = wrap.appendChild(el("div", "gp-frame"));
    frame.append(svg);
    const tip = frame.appendChild(el("div", "gp-tip")); tip.hidden = true;
    const show = e => {
      const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(n, Math.round(((x - L) / (W - L - R)) * n))), p = pts[i], cx = X(i);
      for (const [o, a] of [[cross, { x1: cx, x2: cx }], [hb, { cx, cy: Y(p.b) }], [hs, { cx, cy: Y(p.s) }]]) { for (const k in a) o.setAttribute(k, a[k]); o.setAttribute("visibility", "visible"); }
      tip.replaceChildren(el("b", null, md(p.t)), el("span", "gp-tb", `${tx("buy")} ${won(p.b)}`), el("span", "gp-ts", `${tx("sell")} ${won(p.s)}`),
        el("span", "gp-tg", `${tx("gap")} ${won(p.b - p.s)} (${((p.b / p.s - 1) * 100).toFixed(1)}%)`));
      tip.hidden = false;
      tip.style.left = `${Math.min(Math.max(cx / W * r.width - tip.offsetWidth / 2, 0), r.width - tip.offsetWidth)}px`;
    };
    const hide = () => { tip.hidden = true; [cross, hb, hs].forEach(o => o.setAttribute("visibility", "hidden")); };
    svg.addEventListener("pointermove", show); svg.addEventListener("pointerdown", show); svg.addEventListener("pointerleave", hide);
  }

  function decorate() {
    for (const pr of PAIRS_GP) {
      const box = document.getElementById(`px-${pr.buy}`);
      if (!box || box.dataset.gp) continue;
      box.dataset.gp = "1";
      box.classList.add("gp", `gp-${pr.metal}`);
      const table = box.querySelector("table.pt");
      if (table) {
        const ths = table.tHead?.rows[0]?.cells;
        if (ths?.[1]) { ths[1].classList.add("gp-g1h"); ths[1].replaceChildren(el("span", "gp-ingot", ths[1].textContent)); }
        [...table.rows].slice(1).forEach((row, i) => {                         // 첫 줄은 머리(1g·1돈) — insertRow 가 모든 줄을 thead 에 넣어서 순서로 고름
          row.classList.add(i === 0 ? "gp-rb" : "gp-rs");
          row.querySelector(".tag")?.classList.add(i === 0 ? "gp-tagb" : "gp-tags");
          row.cells[1]?.classList.add("gp-g1");
        });
      }
      box.querySelector("svg")?.remove(); box.querySelector(".tip")?.remove();     // 예전 흐린 한 줄 추세선
      const wrap = box.appendChild(el("div", "gp-chart"));
      chart(pr, wrap);
      // 칸 폭이 바뀌면(시세 탭이 처음 보일 때·창 크기·반영 탭) 다시 그림
      if (typeof ResizeObserver === "function") {
        let w0 = wrap.clientWidth;
        new ResizeObserver(() => { const w = wrap.clientWidth; if (w && Math.abs(w - w0) > 8) { w0 = w; chart(pr, wrap); } }).observe(wrap);
      }
    }
  }
  (function watch(tries = 0) {
    const m = document.getElementById("market");
    if (!m) { if (tries < 120) setTimeout(() => watch(tries + 1), 500); return; }
    let tm = 0;
    new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(decorate, 120); }).observe(m, { childList: true, subtree: true });
    decorate();
  })();
  const css = document.createElement("style");
  css.textContent = `
.tile.gp { --gp-buy: #22c55e; --gp-sell: #facc15; --gp-buy-bg: rgba(34,197,94,.13); --gp-sell-bg: rgba(250,204,21,.13); }
html[data-theme="light"] .tile.gp { --gp-buy: #15803d; --gp-sell: #a16207; --gp-buy-bg: rgba(22,163,74,.10); --gp-sell-bg: rgba(234,179,8,.16); }
.tile.gp-gold { border-color: rgba(212,160,23,.55); background-image: linear-gradient(135deg, rgba(255,215,0,.06), transparent 45%); }
.tile.gp-silver { border-color: rgba(192,192,210,.5); background-image: linear-gradient(135deg, rgba(220,225,235,.06), transparent 45%); }
/* 살 때 초록 · 팔 때 노랑 */
.tile.gp table.pt tr.gp-rb td { background: var(--gp-buy-bg); color: var(--gp-buy); }
.tile.gp table.pt tr.gp-rs td { background: var(--gp-sell-bg); color: var(--gp-sell); }
.tile.gp table.pt tr.gp-rb td:first-child, .tile.gp table.pt tr.gp-rs td:first-child { border-radius: 8px 0 0 8px; padding-left: 6px; }
.tile.gp table.pt tr.gp-rb td:last-child, .tile.gp table.pt tr.gp-rs td:last-child { border-radius: 0 8px 8px 0; padding-right: 8px; }
.tile.gp table.pt { border-collapse: separate; border-spacing: 0 4px; }
.tile.gp table.pt td { font-size: 16px; padding: 6px 0; }
.tile.gp .tag.gp-tagb { background: var(--gp-buy); border-color: var(--gp-buy); color: #04210f; font-weight: 800; }
.tile.gp .tag.gp-tags { background: var(--gp-sell); border-color: var(--gp-sell); color: #2a2000; font-weight: 800; }
html[data-theme="light"] .tile.gp .tag.gp-tagb, html[data-theme="light"] .tile.gp .tag.gp-tags { color: #fff; }
/* 1g 칸: 금괴처럼 반짝이는 금빛(은은 은빛) */
.tile.gp .gp-ingot { display: inline-block; padding: 3px 16px; border-radius: 7px; font-size: 13.5px; font-weight: 900; letter-spacing: .02em; color: #3b2600;
  background: linear-gradient(110deg, #8a6a12 0%, #f7d774 22%, #fff6c8 34%, #e6b422 48%, #b8860b 66%, #ffe9a0 82%, #a07812 100%); background-size: 220% 100%;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 -1px 0 rgba(0,0,0,.25), 0 0 10px rgba(255,200,40,.35); animation: gpShine 4.5s ease-in-out infinite; }
.tile.gp-silver .gp-ingot { color: #1f2430; background-image: linear-gradient(110deg, #6b7280 0%, #d9dde5 22%, #ffffff 34%, #c3c8d2 48%, #8a909c 66%, #eef1f6 82%, #7b8190 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.7), inset 0 -1px 0 rgba(0,0,0,.25), 0 0 10px rgba(220,225,240,.3); }
.tile.gp table.pt td.gp-g1 { font-size: 18px; font-weight: 900; position: relative;
  background-image: linear-gradient(90deg, transparent, rgba(255,215,0,.16) 30%, rgba(255,240,170,.22) 50%, rgba(255,215,0,.16) 70%, transparent); }
.tile.gp-silver table.pt td.gp-g1 { background-image: linear-gradient(90deg, transparent, rgba(220,225,235,.14) 30%, rgba(255,255,255,.2) 50%, rgba(220,225,235,.14) 70%, transparent); }
.tile.gp table.pt tr.gp-rb td.gp-g1 { text-shadow: 0 0 12px rgba(34,197,94,.45); }
.tile.gp table.pt tr.gp-rs td.gp-g1 { text-shadow: 0 0 12px rgba(250,204,21,.45); }
html[data-theme="light"] .tile.gp table.pt td.gp-g1 { text-shadow: none; }
@keyframes gpShine { 0%, 100% { background-position: 100% 0; } 50% { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { .tile.gp .gp-ingot { animation: none; } }
/* 그래프 */
.tile.gp .gp-chart { margin-top: 6px; }
.gp-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 11.5px; }
.gp-legend { display: flex; gap: 10px; align-items: center; color: var(--muted); }
.gp-k::before { content: ""; display: inline-block; width: 14px; height: 3px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
.gp-kb { color: var(--gp-buy); font-weight: 700; } .gp-kb::before { background: var(--gp-buy); }
.gp-ks { color: var(--gp-sell); font-weight: 700; } .gp-ks::before { background: var(--gp-sell); }
.gp-kg::before { height: 9px; width: 12px; background: var(--gp-sell-bg); border: 1px dashed var(--gp-sell); }
.gp-rng { display: flex; gap: 4px; margin-left: auto; }
.gp-rng button { font: inherit; font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; }
.gp-rng button.on { border-color: var(--gp-buy); color: var(--gp-buy); font-weight: 800; }
.gp-chg { width: 100%; font-weight: 700; }
.gp-frame { position: relative; margin-top: 4px; }
.tile.gp svg.gp-svg { display: block; width: 100%; height: auto; margin-top: 0; touch-action: pan-y; overflow: visible; }
.gp-grid { stroke: var(--line); stroke-dasharray: 3 3; }
.gp-ax { font-size: 10px; fill: var(--muted); font-variant-numeric: tabular-nums; }
.gp-band { fill: var(--gp-sell-bg); }
.gp-lb { fill: none; stroke: var(--gp-buy); stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
.gp-ls { fill: none; stroke: var(--gp-sell); stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
.gp-db { fill: var(--gp-buy); stroke: var(--panel-2); stroke-width: 1.5; } .gp-ds { fill: var(--gp-sell); stroke: var(--panel-2); stroke-width: 1.5; }
.gp-vb { font-size: 11px; font-weight: 800; fill: var(--gp-buy); font-variant-numeric: tabular-nums; }
.gp-vs { font-size: 11px; font-weight: 800; fill: var(--gp-sell); font-variant-numeric: tabular-nums; }
.gp-cross { stroke: var(--text); stroke-opacity: .35; stroke-width: 1; }
.gp-tip { position: absolute; top: -4px; transform: translateY(-100%); display: grid; gap: 1px; padding: 5px 8px; border-radius: 8px; font-size: 11.5px; white-space: nowrap;
  background: var(--bg); border: 1px solid var(--line); box-shadow: 0 4px 14px rgba(0,0,0,.3); pointer-events: none; z-index: 2; }
.gp-tb { color: var(--gp-buy); font-weight: 700; } .gp-ts { color: var(--gp-sell); font-weight: 700; } .gp-tg { color: var(--muted); }`;
  document.head.append(css);
})();
