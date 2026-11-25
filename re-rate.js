// 💹 금리가 바뀐 뒤 지역별 반응 + 🏗 건설·리츠 주가 (사용자 2026-11-25 "3번도 이어서" — 부동산 아이디어 2차 ③, 최종 목표 "세계정세 → 금리 → 부동산·관련 주식")
// - re-impact.js 가 불러옴(real-estate.html 수정 없음). [영향·예측] 탭 권역 카드(+ 📚 뉴스 → 집값 기록) 아래에 한 칸(#rrBox) — 다시 그려질 때마다 붙임
// - ① 금리 반응: SQL re_rate_reaction.sql 의 re_rate_episodes(기준금리가 바뀐 구간)·re_rate_reaction(구간마다 시·구 72곳 + 전체:
//      같은 단지·크기 "전 180일 → 뒤 90일" 값 변화, 전체 대비, 거래 수 변화) → 내린 뒤 전체보다 더 오른 곳·덜 오른 곳, 올린 뒤 거래가 더 줄어든 곳
//      ⚠ 인하 3번·인상 1번뿐이고 같은 때 대출 규제 등 다른 일도 섞여 있음 — 금리만의 효과가 아님
// - ② 건설·리츠: KODEX 건설·리츠 ETF 2개(etf_daily)·건설사 5곳(stk_daily, 시가총액 상위 200 안) 종가 1달·3달·1년 변화 + 당일 시세(live_quotes)가 더 새것이면 그 값
//      + 1년 그래프(시작 = 100): 건설 ETF·리츠 ETF·서울·경기 아파트 ㎡당(re_monthly_stats 거래 수 가중, 신고 다 모인 달까지 — 대략)
//      + 건설사 이름이 나온 최근 30일 부동산 소식(re_news_days 대표 제목). 원인·추천 아님
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined") return;
  const H = 3600e3;
  const pc = (v, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);
  const pp = (v, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%p`);
  const cls = v => (v > 0 ? "up" : v < 0 ? "down" : "");
  const nameOf = c => (c === "ALL" ? "서울·경기 전체" : `${SGG[c]?.sido === "서울" ? "서울 " : ""}${SGG[c]?.name || c}`);
  const ym = s => `${String(s).slice(2, 4)}.${String(s).slice(5, 7)}`;
  const kstNow = () => new Date(Date.now() + 9 * H);
  const monthKey = back => { const d = kstNow(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)).toISOString().slice(0, 10); };
  const isoAgo = days => new Date(Date.now() + 9 * H - days * 864e5).toISOString().slice(0, 10);
  const ETFS = [["117700", "KODEX 건설"], ["329200", "TIGER 리츠부동산인프라"], ["476800", "KODEX 한국부동산리츠인프라"]];
  const STKS = [["000720", "현대건설"], ["028260", "삼성물산"], ["047040", "대우건설"], ["006360", "GS건설"], ["375500", "DL이앤씨"]];
  // 소식 제목에서 찾는 건설사 이름(상장사는 위 코드와 이어짐)
  const BUILDERS = [["현대건설", "000720"], ["삼성물산", "028260"], ["대우건설", "047040"], ["GS건설", "006360"], ["DL이앤씨", "375500"], ["HDC현대산업개발", null], ["포스코이앤씨", null], ["롯데건설", null], ["SK에코플랜트", null], ["한화 건설부문", null], ["현대엔지니어링", null], ["두산건설", null], ["호반건설", null], ["태영건설", null], ["계룡건설", null], ["코오롱글로벌", null]];
  const LINES = { etf117700: "#f97316", etf329200: "#22c55e", seoul: "#ef4444", gg: "#3b82f6" };

  // ── 자료(1시간 기억) ──
  let dataP = null, dataAt = 0;
  function load() {
    if (dataP && Date.now() - dataAt < H) return dataP;
    dataAt = Date.now();
    dataP = (async () => {
      const y1 = isoAgo(400), codesE = ETFS.map(x => x[0]), codesS = STKS.map(x => x[0]);
      const page = async (make) => { const out = []; for (let off = 0; off < 8000; off += 1000) { const { data, error } = await make().range(off, off + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; } return out; };
      const safe = p => p.then(x => x, e => { console.warn("re-rate", e?.message || e); return null; });
      const [ep, rx, ed, sd, lq, ms, nd] = await Promise.all([
        safe(db.from("re_rate_episodes").select("*").order("start_month").then(r => { if (r.error) throw r.error; return r.data; })),
        safe(page(() => db.from("re_rate_reaction").select("start_month,sgg_cd,matched,chg,excess,vol_before,vol_after,vol_chg,vol_excess,final").order("start_month").order("sgg_cd"))),
        safe(page(() => db.from("etf_daily").select("code,d,close").in("code", codesE).gte("d", y1).order("code").order("d"))),
        safe(page(() => db.from("stk_daily").select("code,d,close").in("code", codesS).gte("d", y1).order("code").order("d"))),
        safe(db.from("live_quotes").select("code,ts,price,pct").in("code", [...codesE, ...codesS]).then(r => { if (r.error) throw r.error; return r.data; })),
        safe(page(() => db.from("re_monthly_stats").select("sgg_cd,ym,trades,median_price_m2").eq("kind", "apt").gte("ym", monthKey(15)).order("sgg_cd").order("ym"))),
        safe(page(() => db.from("re_news_days").select("day,region,theme,top").gte("day", isoAgo(30)).order("day", { ascending: false }), 3000)),
      ]);
      return { ep: ep || [], rx: rx || [], ed: ed || [], sd: sd || [], lq: lq || [], ms: ms || [], nd: nd || [] };
    })();
    dataP.catch(() => { dataP = null; });
    return dataP;
  }

  // ── ① 금리 반응 ──
  function rateBlock(D) {
    const box = el("div", "rr-part");
    box.append(el("h3", "re-h", "💹 금리가 바뀐 뒤 지역별 반응 (아파트)"));
    if (!D.ep.length) { box.append(el("p", "re-imp-note", "금리 반응 기록을 준비 중이에요(SQL re_rate_reaction.sql 실행 뒤 매달 계산).")); return box; }
    box.append(el("p", "re-imp-note", "한국은행 기준금리가 바뀐 달 1일을 기준으로, 시·구마다 같은 단지·같은 크기의 '바뀌기 전 180일 → 바뀐 뒤 90일' 값 변화와 거래 수 변화를 서울·경기 전체와 비교했어요. "
      + "⚠ 아파트 실거래가 3년치라 인하·인상 구간이 몇 번뿐이고, 같은 때 대출 규제·계절 같은 다른 일도 섞여 있어요 — 금리만의 효과로 읽으면 안 돼요."));
    const all = new Map(D.rx.filter(x => x.sgg_cd === "ALL").map(x => [String(x.start_month).slice(0, 10), x]));
    const strip = el("div", "rr-eps");
    for (const e of D.ep) {
      const a = all.get(String(e.start_month).slice(0, 10)), down = e.change < 0;
      const c = el("div", `rr-ep ${down ? "cut" : "hike"}`);
      c.append(el("b", null, `${ym(e.start_month)}${e.end_month !== e.start_month ? `~${ym(e.end_month)}` : ""} ${down ? "▼ 인하" : "▲ 인상"} ${Math.abs(e.change).toFixed(2)}%p`),
        el("small", null, `${e.rate_before}% → ${e.rate_after}%`),
        el("small", null, a ? `뒤 90일 전체: 값 ${pc(a.chg)} · 거래 ${pc(a.vol_chg, 0)}${a.final ? "" : " (진행 중)"}` : "계산 전"));
      strip.append(c);
    }
    box.append(strip);
    // 시·구 요약: 인하 구간 평균 전체 대비, 인상 구간 평균
    const cutStarts = new Set(D.ep.filter(e => e.change < 0).map(e => String(e.start_month).slice(0, 10)));
    const hikeStarts = new Set(D.ep.filter(e => e.change > 0).map(e => String(e.start_month).slice(0, 10)));
    const by = new Map();
    for (const r of D.rx) {
      if (r.sgg_cd === "ALL" || !SGG[r.sgg_cd]) continue;
      const s = by.get(r.sgg_cd) || { code: r.sgg_cd, cut: [], cutV: [], hike: [], hikeV: [], m: 0 };
      const k = String(r.start_month).slice(0, 10);
      if (cutStarts.has(k)) { if (r.excess != null && r.matched >= 15) s.cut.push(r.excess); if (r.vol_excess != null && r.vol_before >= 30) s.cutV.push(r.vol_excess); }
      if (hikeStarts.has(k)) { if (r.excess != null && r.matched >= 15) s.hike.push(r.excess); if (r.vol_excess != null && r.vol_before >= 30) s.hikeV.push(r.vol_excess); }
      by.set(r.sgg_cd, s);
    }
    const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const rows = [...by.values()].map(s => ({ ...s, cutA: avg(s.cut), cutVA: avg(s.cutV), hikeA: avg(s.hike), hikeVA: avg(s.hikeV) }));
    const nCut = cutStarts.size, nHike = hikeStarts.size;
    const cols = el("div", "rr-cols");
    const col = (title, xs, right, note) => { const c = el("div", "rr-col"); c.append(el("div", "rr-sub", title)); for (const r of xs) { const b = el("button", "rr-row"); b.type = "button"; b.append(el("span", null, nameOf(r.code)), right(r)); b.addEventListener("click", () => goRegion(r.code)); c.append(b); } if (!xs.length) c.append(el("small", "re-imp-note", "자료 부족")); if (note) c.append(el("small", "re-imp-note", note)); return c; };
    const v = (main, sub, c) => { const x = el("span", "rr-v"); x.append(el("b", c, main)); if (sub) x.append(el("small", null, ` ${sub}`)); return x; };
    const cutOk = rows.filter(r => r.cutA != null && r.cut.length >= Math.min(2, nCut));
    if (nCut) {
      cols.append(col(`▼ 금리 내린 뒤 전체보다 더 오른 곳 (인하 ${nCut}번 평균)`, [...cutOk].sort((a, b) => b.cutA - a.cutA).slice(0, 5), r => v(pp(r.cutA), `${r.cut.length}번`, "up")));
      cols.append(col("▼ 금리 내려도 덜 오른 곳", [...cutOk].sort((a, b) => a.cutA - b.cutA).slice(0, 5), r => v(pp(r.cutA), `${r.cut.length}번`, "down")));
    }
    if (nHike) {
      const hk = rows.filter(r => r.hikeVA != null);
      cols.append(col(`▲ 금리 올린 뒤 거래가 더 줄어든 곳 (인상 ${nHike}번)`, [...hk].sort((a, b) => a.hikeVA - b.hikeVA).slice(0, 5), r => v(pp(r.hikeVA, 0), "거래, 전체 대비", "down")));
      const hp = rows.filter(r => r.hikeA != null);
      cols.append(col("▲ 금리 올려도 값이 더 오른 곳", [...hp].sort((a, b) => b.hikeA - a.hikeA).slice(0, 5), r => v(pp(r.hikeA), "값, 전체 대비", "up")));
    }
    box.append(cols, el("p", "re-imp-note", "%p = 그 시·구 변화 − 서울·경기 전체 변화. 같은 단지·크기 15곳 이상(값)·전 90일 거래 30건 이상(거래)인 곳만. 시·구를 누르면 지도·목록이 그곳으로 가요."));
    globalThis.RERATE_SENS = new Map(rows.map(r => [r.code, r]));    // 다른 화면(상세 등)에서 쓸 수 있게
    return box;
  }
  function goRegion(code) {
    try { if (typeof showTab === "function") showTab("list"); if (SGG[code] && typeof pickSgg === "function") pickSgg("list", code); globalThis.REIMPACT?.showNews?.(code); } catch (e) { console.warn("re-rate", e); }
  }

  // ── ② 건설·리츠 ──
  function series(rows, code) { return rows.filter(r => r.code === code).map(r => ({ d: String(r.d).slice(0, 10), c: Number(r.close) })).sort((a, b) => a.d.localeCompare(b.d)); }
  const back = (s, days) => { const cut = isoAgo(days); let v = null; for (const x of s) { if (x.d <= cut) v = x.c; else break; } return v; };
  function liveOf(D, code, s) {
    const q = D.lq.find(x => x.code === code), last = s.at(-1);
    if (!q?.price || !last) return null;
    const qd = new Date(Date.parse(q.ts) + 9 * H).toISOString().slice(0, 10);
    return qd > last.d ? { d: qd, c: Number(q.price), pct: q.pct } : null;
  }
  /** 아파트 달별 지수(시작 = 100): 시·구마다 "그달 ㎡당 ÷ 처음 3달 평균"을 처음 3달 거래 수로 고정 가중 평균
   *  (그냥 합치면 값싼 지역 거래가 늘어난 달에 전체가 내려간 것처럼 보임 — 경기 −13% 같은 착시). 신고 다 모인 달(이번·지난달 빼고)까지 */
  function aptIndex(D, pre, from) {
    const by = new Map();
    for (const r of D.ms) { if (!r.sgg_cd.startsWith(pre) || !r.trades || !r.median_price_m2) continue; const k = String(r.ym).slice(0, 10); if (k < from || k > monthKey(2)) continue; (by.get(r.sgg_cd) || by.set(r.sgg_cd, new Map()).get(r.sgg_cd)).set(k, r); }
    const months = [...new Set(D.ms.map(r => String(r.ym).slice(0, 10)).filter(k => k >= from && k <= monthKey(2)))].sort();
    if (months.length < 4) return [];
    const base = new Map();
    for (const [c, m] of by) { const xs = months.slice(0, 3).map(k => m.get(k)).filter(Boolean); const n = xs.reduce((t, x) => t + x.trades, 0); if (xs.length >= 2 && n >= 20) base.set(c, { v: xs.reduce((t, x) => t + x.median_price_m2 * x.trades, 0) / n, w: n }); }
    const out = [];
    for (const k of months) { let s = 0, w = 0; for (const [c, b] of base) { const r = by.get(c).get(k); if (r && r.trades >= 5) { s += b.w * r.median_price_m2 / b.v; w += b.w; } } if (w) out.push({ d: k, c: s / w }); }
    return out;
  }
  function stockBlock(D) {
    const box = el("div", "rr-part");
    box.append(el("h3", "re-h", "🏗 건설·리츠 주가와 집값"));
    box.append(el("p", "re-imp-note", "부동산과 함께 움직이기 쉬운 국내 상장 상품이에요. 건설 ETF·건설사는 분양·수주·재건축 소식에, 리츠는 금리에 민감한 편이에요. 원인·추천이 아니라 나란히 보는 자료예요(종가: 금융위원회 공공데이터, 당일: 한국투자증권)."));
    const t = el("table", "rr-t");
    const hr = el("tr"); hr.append(...["상품", "종가", "1달", "3달", "1년"].map(x => el("th", null, x))); t.append(hr);
    const all = [...ETFS.map(([c, n]) => ({ c, n, s: series(D.ed, c), etf: true })), ...STKS.map(([c, n]) => ({ c, n, s: series(D.sd, c) }))];
    for (const it of all) {
      if (!it.s.length) continue;
      const lv = liveOf(D, it.c, it.s), last = lv || it.s.at(-1);
      const tr = el("tr");
      const a = el("a", null, it.n); a.href = `https://finance.naver.com/item/main.naver?code=${it.c}`; a.target = "_blank"; a.rel = "noopener noreferrer";
      const nm = el("td"); nm.append(a, el("small", null, it.etf ? " ETF" : ""));
      tr.append(nm, el("td", null, `${Math.round(last.c).toLocaleString()}원${lv ? " 📡" : ""}`));
      for (const days of [30, 91, 365]) { const b = back(it.s, days), ch = b ? (last.c / b - 1) * 100 : null; tr.append(el("td", cls(ch), pc(ch))); }
      t.append(tr);
    }
    const w = el("div", "rr-twrap"); w.append(t); box.append(w);
    // 1년 그래프(시작 = 100)
    const S = [
      { k: "etf117700", n: "KODEX 건설", s: series(D.ed, "117700") },
      { k: "etf329200", n: "TIGER 리츠부동산인프라", s: series(D.ed, "329200") },
      { k: "seoul", n: "서울 아파트 ㎡당(달, 시·구 고정 가중)", s: aptIndex(D, "11", monthKey(13)) },
      { k: "gg", n: "경기 아파트 ㎡당(달, 시·구 고정 가중)", s: aptIndex(D, "41", monthKey(13)) }];
    const from = monthKey(13);
    for (const x of S) { x.s = x.s.filter(p => p.d >= from); if (x.s.length) { const b = x.s[0].c; x.s = x.s.map(p => ({ d: p.d, v: p.c / b * 100 })); } }
    const ok = S.filter(x => x.s.length >= 3);
    if (ok.length) {
      const W = 640, Hh = 220, L = 44, R = 8, T = 10, B = 24;
      const d0 = Date.parse(from), d1 = Date.now(), vals = ok.flatMap(x => x.s.map(p => p.v)), lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.08 || 2;
      const X = d => L + (W - L - R) * (Date.parse(d) - d0) / (d1 - d0), Y = v => T + (Hh - T - B) * (1 - (v - (lo - pad)) / ((hi + pad) - (lo - pad)));
      const NS = "http://www.w3.org/2000/svg", mk = (tg, a) => { const e = document.createElementNS(NS, tg); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
      const svg = mk("svg", { viewBox: `0 0 ${W} ${Hh}`, class: "rr-svg", role: "img", "aria-label": "건설·리츠 ETF와 아파트 ㎡당 1년 흐름(시작=100)" });
      for (const v of [lo, 100, hi]) { const y = Y(v); svg.append(mk("line", { x1: L, x2: W - R, y1: y, y2: y, class: v === 100 ? "rr-base" : "rr-grid" })); const tx = mk("text", { x: L - 6, y: y + 4, "text-anchor": "end", class: "rr-ax" }); tx.textContent = Math.round(v); svg.append(tx); }
      for (let i = 0; i <= 12; i += 3) { const d = monthKey(13 - i), tx = mk("text", { x: X(d), y: Hh - 6, "text-anchor": "middle", class: "rr-ax" }); tx.textContent = ym(d); svg.append(tx); }
      for (const x of ok) {
        svg.append(mk("polyline", { points: x.s.map(p => `${X(p.d).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" "), fill: "none", stroke: LINES[x.k], "stroke-width": x.k.startsWith("etf") ? 1.6 : 3, "stroke-linejoin": "round", "stroke-dasharray": x.k.startsWith("etf") ? "" : "0" }));
        const last = x.s.at(-1), tx = mk("text", { x: Math.min(X(last.d) + 3, W - R - 2), y: Y(last.v) - 4, "text-anchor": "end", class: "rr-lbl", fill: LINES[x.k] }); tx.textContent = `${pc(last.v - 100, 0)}`; svg.append(tx);
      }
      const lg = el("div", "rr-legend"); for (const x of ok) { const s = el("span"); const i = el("i"); i.style.background = LINES[x.k]; s.append(i, x.n); lg.append(s); }
      box.append(el("div", "rr-sub", `1년 흐름 (${ym(from)} = 100)`), svg, lg, el("p", "re-imp-note", "아파트는 시·구마다 ㎡당 중간값의 변화를 처음 3달 거래 수로 고정해 가중 평균했어요(대략 — 그 시·구 안에서 팔린 단지 구성에 따라 흔들릴 수 있어요). 처음 3달 평균이 기준이라 처음 점은 100 근처예요. 이번·지난달은 신고가 덜 모여 뺐어요."));
    }
    // 건설사가 나온 부동산 소식
    const seen = new Set(), hits = [];
    for (const r of D.nd) for (const t of Array.isArray(r.top) ? r.top : []) {
      if (!t?.t || seen.has(t.u)) continue;
      const b = BUILDERS.find(([n]) => t.t.includes(n) || (n === "DL이앤씨" && t.t.includes("DL E&C")) || (n === "한화 건설부문" && t.t.includes("한화 건설")));
      if (b) { seen.add(t.u); hits.push({ day: r.day, t, b }); }
    }
    if (hits.length) {
      box.append(el("div", "rr-sub", `🏗 건설사가 나온 부동산 소식 (최근 30일 ${hits.length}건)`));
      const ul = el("ul", "rr-news");
      for (const h of hits.slice(0, 10)) {
        const li = el("li"); const s = all.find(x => x.c === h.b[1]);
        const ch = s?.s.length ? (() => { const b = back(s.s, 30), l = liveOf(D, s.c, s.s) || s.s.at(-1); return b ? (l.c / b - 1) * 100 : null; })() : null;
        li.append(el("small", null, `${String(h.day).slice(5).replace("-", "/")} `), el("span", "rr-b", h.b[0]));
        if (ch != null) li.append(el("small", cls(ch), ` 주가 1달 ${pc(ch)}`));
        const a = el("a", null, ` ${h.t.t}`); a.href = h.t.u; a.target = "_blank"; a.rel = "noopener noreferrer"; li.append(a);
        ul.append(li);
      }
      box.append(ul);
    }
    return box;
  }

  // ── [영향·예측] 탭에 붙이기 ──
  let busy = false;
  async function attach() {
    const pane = document.getElementById("pane-impact");
    if (!pane || pane.hidden || busy || pane.querySelector("#rrBox")) return;
    const grid = pane.querySelector(".re-zones");
    if (!grid) return;
    busy = true;
    try {
      const D = await load();
      if (pane.querySelector("#rrBox") || !grid.isConnected) return;
      const box = el("section", "rr-box"); box.id = "rrBox";
      box.append(rateBlock(D), stockBlock(D));
      (pane.querySelector("#npBox") || grid).after(box);
    } catch (e) { console.warn("re-rate", e?.message || e); }
    finally { busy = false; }
  }
  const watch = () => {
    const pane = document.getElementById("pane-impact");
    if (!pane) return false;
    new MutationObserver(() => attach()).observe(pane, { childList: true });
    new MutationObserver(() => attach()).observe(pane, { attributes: true, attributeFilter: ["hidden"] });
    attach();
    return true;
  };
  if (!watch()) { let n = 0; const t = setInterval(() => { if (watch() || ++n > 60) clearInterval(t); }, 500); }
  globalThis.RERATE = { load, preview(extra) { dataAt = Date.now(); dataP = load().then(D => Object.assign(D, extra)); document.getElementById("rrBox")?.remove(); attach(); } };   // preview: 표가 생기기 전 미리보기용

  const css = document.createElement("style");
  css.textContent = `
.rr-box { display: grid; gap: 12px; margin-top: 8px; } .rr-part { display: grid; gap: 6px; }
.rr-eps { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 6px; }
.rr-ep { border: 1px solid var(--line); border-radius: 10px; padding: 6px 8px; display: grid; gap: 1px; font-size: 12px; }
.rr-ep.cut { border-left: 4px solid var(--down, #3b82f6); } .rr-ep.hike { border-left: 4px solid var(--up, #ef4444); } .rr-ep small { color: var(--muted); font-size: 11px; }
.rr-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; }
.rr-col { border: 1px solid var(--line); border-radius: 10px; padding: 6px; display: grid; gap: 1px; align-content: start; }
.rr-sub { font-size: 12px; font-weight: 800; color: var(--muted); margin: 2px 0; }
.rr-row { display: flex; justify-content: space-between; gap: 6px; font: inherit; font-size: 12.5px; background: none; border: 0; border-radius: 6px; padding: 3px 4px; color: var(--text); cursor: pointer; text-align: left; }
.rr-row:hover { background: color-mix(in srgb, var(--accent, #6366f1) 14%, transparent); }
.rr-v { white-space: nowrap; } .rr-v small { color: var(--muted); font-size: 11px; }
.rr-v b.up, .rr-t td.up, .rr-news .up { color: var(--up, #ef4444); } .rr-v b.down, .rr-t td.down, .rr-news .down { color: var(--down, #3b82f6); }
.rr-twrap { overflow-x: auto; } .rr-t { border-collapse: collapse; font-size: 12.5px; width: 100%; }
.rr-t th, .rr-t td { border-bottom: 1px solid var(--line); padding: 3px 6px; text-align: right; white-space: nowrap; } .rr-t th:first-child, .rr-t td:first-child { text-align: left; }
.rr-t th { color: var(--muted); font-weight: 600; } .rr-t a { color: var(--text); text-decoration: none; } .rr-t a:hover { text-decoration: underline; } .rr-t small { color: var(--muted); }
.rr-svg { width: 100%; height: auto; max-height: 240px; }
.rr-grid { stroke: var(--line); stroke-width: 1; } .rr-base { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 4 3; }
.rr-ax { fill: var(--muted); font-size: 12px; } .rr-lbl { font-size: 12px; font-weight: 700; }
.rr-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; } .rr-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
.rr-news { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 12.5px; }
.rr-news a { color: var(--muted); text-decoration: none; } .rr-news a:hover { text-decoration: underline; } .rr-news small { color: var(--muted); }
.rr-b { font-weight: 800; }`;
  document.head.append(css);
})();
