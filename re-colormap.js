// 🎨 지도 색칠 보기 (사용자 2026-11-25 "지도 색칠" — 부동산 아이디어 2차 ④, 기억해 둔 다음 단계)
// - re-impact.js 가 불러옴(real-estate.html 수정 없음). 지도 오른쪽 위(확대 단추 아래)에 [🎨 지도 색칠] 단추 → 펼치면 무엇으로 칠할지 고름(기억 reColorMode·reColorKind)
// - 시·구 경계선 자료는 가입이 필요해서(V-World 등) 쓰지 않고, 시·구마다 그 동들 가운데(거래 수 가중)에 큰 반투명 동그라미를 깔아 "색 지도"처럼 보이게 함
//   (동그라미는 기존 동 점 밑에, 칠하는 동안 동 점은 조금 흐리게). 동그라미 가운데에 값 글자. 빈 곳(동 점이 없는 곳)을 누르면 그 시·구 목록·지도로
// - 무엇으로 칠하나(새로 받는 표 없음 — 이미 쌓인 표만 읽음):
//   ① 1년 가격 변화: re_monthly_stats 신고 다 모인 최근 3달(이번·지난달 빼고) ㎡당(거래 수 가중) vs 1년 전 같은 3달 — 종류 고르기(아파트·빌라·오피스텔)
//   ② 거래 늘어남: 같은 3달 거래 수 vs 직전 3달 — 종류 고르기
//   ③ 신고가 비율: re_high_stats 최신 날(최근 30일 아파트 거래 중 신고가)
//   ④ 전세가율: re_jeonse_stats 최신 날(같은 단지·건물·크기끼리 맞춘 시·구 중간값) — 종류 고르기
//   ⑤ 금리 내린 뒤 반응: re_rate_reaction 인하 구간들의 전체 대비 평균(아파트)
//   ⑥ 갭(매매 − 전세, 2026-11-26 사용자 "매매가 전세가 지도"): re_gap_stats 최신 날(같은 단지·건물·크기 12개월 매매 중간값 − 신규 전세 중간값의 시·구 중간값, SQL re_gap.sql)
//      예산 단추(1·2·3·5억)를 고르면 "그 돈 이하 갭인 곳 비율"로 칠하고, 설명 칸에 지금 지도에 보이는 시·구의 그런 단지·건물 목록(re_gap_places, 거래 많은 순 + 전세가율 위험 표시)
// - 색: 늘고 줄어드는 값은 빨강(+)·파랑(−), 비율은 옅은 색 → 진한 색(전세가율은 60·70·80% 구간). 표본이 적은 시·구는 회색 점선
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined") return;   // 지도(map)는 로그인 뒤에 만들어질 수 있어서 아래 boot 에서 기다림
  const H = 3600e3, PY = 3.3058;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 기억 없음 */ } },
  };
  const KN = { apt: "아파트", villa: "빌라", offi: "오피스텔" };
  const MODES = {
    off: { label: "끄기" },
    price: { label: "1년 가격 변화", kinds: true, unit: "%" },
    volume: { label: "거래 늘어남", kinds: true, unit: "%" },
    highs: { label: "신고가 비율", unit: "%" },
    jeonse: { label: "전세가율", kinds: true, unit: "%" },
    rate: { label: "금리 내린 뒤 반응", unit: "%p" },
    gap: { label: "갭 (매매−전세)", kinds: true, unit: "억" },
  };
  let mode = store.get("reColorMode", "off"); if (!MODES[mode]) mode = "off";
  let kind = store.get("reColorKind", "apt"); if (!KN[kind]) kind = "apt";
  let budget = store.get("reColorGap", 0); if (![0, 1, 2, 3, 5].includes(budget)) budget = 0;   // 갭 예산(억), 0 = 중간값으로 칠하기
  const eok = man => (man == null || !Number.isFinite(man) ? "–" : Math.abs(man) >= 10000 ? `${man < 0 ? "−" : ""}${(Math.abs(man) / 10000).toFixed(Math.abs(man) >= 100000 ? 0 : 1)}억` : `${man < 0 ? "−" : ""}${Math.round(Math.abs(man)).toLocaleString()}만`);
  const fmtV = (md, v) => (md === "highs" || md === "jeonse" || (md === "gap" && budget) ? `${Math.round(v)}%` : md === "gap" ? eok(v * 10000) : sgn(v, 1, MODES[md].unit));
  const kstNow = () => new Date(Date.now() + 9 * H);
  const monthKey = back => { const d = kstNow(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)).toISOString().slice(0, 10); };
  const ym = s => `${String(s).slice(2, 4)}.${String(s).slice(5, 7)}`;
  const nameOf = c => `${SGG[c]?.sido === "서울" ? "서울 " : ""}${SGG[c]?.name || c}`;
  const sgn = (v, d = 1, u = "%") => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}${u}`);

  // ── 자료(종류·모드마다 1시간 기억) ──
  const cache = new Map();
  async function pageAll(make, max = 8000) {
    const out = [];
    for (let off = 0; off < max; off += 1000) { const { data, error } = await make().range(off, off + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }
  function cached(key, fn) { const c = cache.get(key); if (c && Date.now() - c.at < H) return c.p; const p = fn(); cache.set(key, { at: Date.now(), p }); p.catch(() => cache.delete(key)); return p; }
  const win = (m, backs) => { let s = 0, n = 0; for (const b of backs) { const r = m.get(monthKey(b)); if (r?.trades && r.median_price_m2) { s += r.median_price_m2 * r.trades; n += r.trades; } } return n ? { m2: s / n, n } : null; };
  /** 모드 → Map(sgg → { v, n, sub, thin }) + 기준 설명 */
  async function values(md, kd, opts = {}) {
    const bud = opts.budget ?? budget;   // 순위 탭은 늘 중간값(0)으로 부름
    if (md === "price" || md === "volume") {
      const rows = await cached(`ms|${kd}`, () => pageAll(() => db.from("re_monthly_stats").select("sgg_cd,ym,trades,median_price_m2").eq("kind", kd).gte("ym", monthKey(17)).order("sgg_cd").order("ym")));
      const by = new Map();
      for (const r of rows) (by.get(r.sgg_cd) || by.set(r.sgg_cd, new Map()).get(r.sgg_cd)).set(String(r.ym).slice(0, 10), r);
      const out = new Map();
      for (const [c, m] of by) {
        if (!SGG[c]) continue;
        const now = win(m, [2, 3, 4]); if (!now) continue;
        if (md === "price") { const yr = win(m, [14, 15, 16]); if (!yr) continue; out.set(c, { v: (now.m2 / yr.m2 - 1) * 100, n: now.n, sub: `3.3㎡당 ${Math.round(now.m2 * PY).toLocaleString()}만 · 월 ${Math.round(now.n / 3)}건`, thin: now.n < 30 || yr.n < 30 }); }
        else { const pv = win(m, [5, 6, 7]); if (!pv) continue; out.set(c, { v: (now.n / pv.n - 1) * 100, n: now.n, sub: `월 ${Math.round(pv.n / 3)} → ${Math.round(now.n / 3)}건`, thin: pv.n < 30 }); }
      }
      return { map: out, basis: md === "price" ? `${KN[kd]} ㎡당 중간값(거래 수 가중) ${ym(monthKey(4))}~${ym(monthKey(2))} vs 1년 전 같은 3달 · 이번·지난달은 신고가 덜 모여 뺌` : `${KN[kd]} 거래 수 ${ym(monthKey(4))}~${ym(monthKey(2))} vs 직전 3달` };
    }
    if (md === "highs") {
      const d = await cached("hs", async () => { const l = await db.from("re_high_stats").select("day").order("day", { ascending: false }).limit(1); if (l.error) throw l.error; if (!l.data?.[0]) return { rows: [] }; const r = await db.from("re_high_stats").select("sgg_cd,trades,highs,highs_canceled").eq("day", l.data[0].day); if (r.error) throw r.error; return { day: l.data[0].day, rows: r.data || [] }; });
      const out = new Map(); for (const r of d.rows) if (r.trades) out.set(r.sgg_cd, { v: r.highs / r.trades * 100, n: r.trades, sub: `${r.trades.toLocaleString()}건 중 ${r.highs}건${r.highs_canceled ? ` · 해제 ${r.highs_canceled}` : ""}`, thin: r.trades < 30 });
      return { map: out, basis: `최근 30일 아파트 거래 중 신고가(같은 단지·크기 그 전 3년 최고가보다 비싼 거래)${d.day ? ` · ${String(d.day).slice(5).replace("-", "/")} 계산` : ""}` };
    }
    if (md === "jeonse") {
      const d = await cached("js", async () => { const l = await db.from("re_jeonse_stats").select("day").order("day", { ascending: false }).limit(1); if (l.error) throw l.error; if (!l.data?.[0]) return { rows: [] }; const r = await db.from("re_jeonse_stats").select("kind,sgg_cd,places,ratio_med,share80").eq("day", l.data[0].day); if (r.error) throw r.error; return { day: l.data[0].day, rows: r.data || [] }; });
      const out = new Map(); for (const r of d.rows) if (r.kind === kd && r.ratio_med != null) out.set(r.sgg_cd, { v: r.ratio_med, n: r.places, sub: `${r.places}곳 · 80% 넘는 곳 ${Math.round(r.share80)}%`, thin: r.places < 10 });
      return { map: out, basis: `${KN[kd]} 같은 단지·건물·크기끼리 맞춘 신규 전세 ÷ 매매(12개월)의 시·구 중간값 · 80% 넘으면 깡통전세 위험` };
    }
    if (md === "rate") {
      const d = await cached("rr", async () => {
        const [ep, rx] = await Promise.all([db.from("re_rate_episodes").select("start_month,change"), pageAll(() => db.from("re_rate_reaction").select("start_month,sgg_cd,matched,excess").order("start_month").order("sgg_cd"))]);
        if (ep.error) throw ep.error; return { ep: ep.data || [], rx };
      });
      const cuts = new Set(d.ep.filter(e => e.change < 0).map(e => String(e.start_month).slice(0, 10)));
      const acc = new Map();
      for (const r of d.rx) { if (r.sgg_cd === "ALL" || !cuts.has(String(r.start_month).slice(0, 10)) || r.excess == null || r.matched < 15) continue; const a = acc.get(r.sgg_cd) || { s: 0, k: 0, m: 0 }; a.s += r.excess; a.k++; a.m += r.matched; acc.set(r.sgg_cd, a); }
      const out = new Map(); for (const [c, a] of acc) out.set(c, { v: a.s / a.k, n: a.m, sub: `인하 ${a.k}번 평균 · 같은 단지 ${Math.round(a.m / a.k)}곳`, thin: a.k < Math.min(2, cuts.size) });
      return { map: out, basis: `기준금리 인하 ${cuts.size}번 뒤 90일, 같은 단지·크기 값 변화 − 서울·경기 전체(아파트) · 표본 적고 다른 일도 섞임` };
    }
    if (md === "gap") {
      const d = await cached("gs", async () => { const l = await db.from("re_gap_stats").select("day").order("day", { ascending: false }).limit(1); if (l.error) throw l.error; if (!l.data?.[0]) return { rows: [] }; const r = await db.from("re_gap_stats").select("kind,sgg_cd,places,gap_med,gap_p25,ratio_med,n_le1,n_le2,n_le3,n_le5").eq("day", l.data[0].day); if (r.error) throw r.error; return { day: l.data[0].day, rows: r.data || [] }; });
      const out = new Map();
      for (const r of d.rows) {
        if (r.kind !== kd || r.gap_med == null) continue;
        const v = bud ? r[`n_le${bud}`] / r.places * 100 : r.gap_med / 10000;
        out.set(r.sgg_cd, { v, n: r.places, sub: `갭 중간값 ${eok(r.gap_med)} · 하위 25% ${eok(r.gap_p25)} · 전세가율 ${Math.round(r.ratio_med)}% · ${r.places}곳`, thin: r.places < 8 });
      }
      const when = d.day ? ` · ${String(d.day).slice(5).replace("-", "/")} 계산` : "";
      return { map: out, basis: bud
        ? `${KN[kd]} 같은 단지·건물·크기의 매매 − 신규 전세(12개월 중간값)가 ${bud}억 이하인 곳 비율${when}`
        : `${KN[kd]} 같은 단지·건물·크기의 매매 − 신규 전세(12개월 중간값)의 시·구 중간값${when}` };
    }
    return { map: new Map(), basis: "" };
  }

  // ── 색 ──
  const RED = [239, 68, 68], BLUE = [59, 130, 246], GRAY = [156, 163, 175];
  const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * Math.max(0, Math.min(1, t))));
  const rgb = c => `rgb(${c.join(",")})`;
  function colorFn(md, vals) {
    if (md === "jeonse") return v => (v >= 80 ? "#ef4444" : v >= 70 ? "#f97316" : v >= 60 ? "#eab308" : "#22c55e");
    if (md === "highs") { const hi = q(vals, 0.9) || 1; return v => rgb(mix([254, 215, 170], [194, 65, 12], v / hi)); }
    if (md === "gap" && budget) return v => rgb(mix([233, 213, 255], [109, 40, 217], v / 100));          // 그 돈 이하 갭 비율: 옅은 보라 → 진한 보라
    if (md === "gap") { const hi = q(vals, 0.9) || 1; return v => rgb(mix([20, 184, 166], [226, 232, 240], v / hi)); }   // 갭 중간값: 작을수록 진한 청록
    const lim = q(vals.map(Math.abs), 0.9) || 1;   // 늘고 줄어드는 값: 0 회색 → +빨강 / −파랑
    return v => rgb(v >= 0 ? mix(GRAY, RED, v / lim) : mix(GRAY, BLUE, -v / lim));
  }
  function q(xs, p) { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : null; }
  function legendItems(md, vals, color) {
    if (md === "jeonse") return [["60% 미만", "#22c55e"], ["60~70%", "#eab308"], ["70~80% 주의", "#f97316"], ["80% 넘음 위험", "#ef4444"]];
    if (md === "highs") { const hi = q(vals, 0.9) || 1; return [["0%", color(0)], [`${Math.round(hi / 2)}%`, color(hi / 2)], [`${Math.round(hi)}%+`, color(hi)]]; }
    if (md === "gap" && budget) return [["0%", color(0)], ["50%", color(50)], ["100%", color(100)]];
    if (md === "gap") { const hi = q(vals, 0.9) || 1; return [["작음", color(0)], [eok(hi * 5000), color(hi / 2)], [`${eok(hi * 10000)}+`, color(hi)]]; }
    const lim = q(vals.map(Math.abs), 0.9) || 1, u = MODES[md].unit;
    return [[sgn(-lim, 0, u), color(-lim)], [`0${u}`, color(0)], [sgn(lim, 0, u), color(lim)]];
  }

  // ── 시·구 가운데 ──
  function centers() {
    const acc = new Map();
    for (const d of (typeof dongs !== "undefined" ? dongs : [])) {
      if (d.lat == null || d.lng == null) continue;
      const w = Math.max(1, d.trades_12m || 0), a = acc.get(d.sgg_cd) || { x: 0, y: 0, w: 0 };
      a.x += d.lng * w; a.y += d.lat * w; a.w += w; acc.set(d.sgg_cd, a);
    }
    return new Map([...acc].map(([c, a]) => [c, [a.x / a.w, a.y / a.w]]));
  }

  // ── 지도 층 ──
  const LAYERS = ["cm-fill", "cm-label"];
  function ensureLayers() {
    if (map.getSource("cm-sgg")) return;
    map.addSource("cm-sgg", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    const before = map.getLayer("clusters") ? "clusters" : undefined;
    map.addLayer({ id: "cm-fill", type: "circle", source: "cm-sgg", paint: {
      "circle-color": ["get", "c"],
      "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 7, 10, 9, 30, 11, 90, 13, 300],
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 8, ["case", ["get", "thin"], 0.28, 0.6], 12, ["case", ["get", "thin"], 0.12, 0.3]],
      "circle-stroke-color": ["get", "c"], "circle-stroke-width": ["case", ["get", "thin"], 1.5, 0], "circle-stroke-opacity": 0.8, "circle-blur": 0.15 } }, before);
    map.addLayer({ id: "cm-label", type: "symbol", source: "cm-sgg", minzoom: 8.5, layout: {
      "text-field": ["concat", ["get", "nm"], "\n", ["get", "lbl"]], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 9, 11, 12, 13],
      "text-allow-overlap": false, "text-optional": true, "text-max-width": 9 },
      paint: { "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,.75)", "text-halo-width": 1.8, "text-opacity": ["interpolate", ["linear"], ["zoom"], 12, 1, 13.5, 0] } });
    map.on("click", "cm-fill", e => {
      if (mode === "off") return;
      const p = e.point, near = map.queryRenderedFeatures([[p.x - 10, p.y - 10], [p.x + 10, p.y + 10]], { layers: ["clusters", "points"].filter(id => map.getLayer(id)) });
      if (near.length) return;                                // 동 점이 있으면 원래 동작(동 열기)
      const f = e.features?.[0]; if (!f) return;
      try { if (typeof showTab === "function") showTab("list"); if (typeof pickSgg === "function") pickSgg("list", f.properties.code); } catch (err) { console.warn("re-colormap", err); }
    });
  }
  function setDim(on) {
    for (const [id, prop] of [["clusters", "circle-opacity"], ["points", "circle-opacity"], ["cluster-icons", "icon-opacity"], ["point-icons", "icon-opacity"], ["cluster-count", "text-opacity"]])
      if (map.getLayer(id)) map.setPaintProperty(id, prop, on ? 0.55 : 1);
  }
  let seq = 0;
  async function draw() {
    const my = ++seq;
    syncPanel();
    if (mode === "off") { for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none"); setDim(false); legend(null); return; }
    legend({ loading: true });
    let res;
    try { res = await values(mode, kind); } catch (e) { if (my === seq) legend({ error: e.message || String(e) }); return; }
    if (my !== seq) return;
    if (!res.map.size) { legend({ empty: true, basis: res.basis }); return; }
    const vals = [...res.map.values()].filter(x => !x.thin).map(x => x.v);
    const color = colorFn(mode, vals.length ? vals : [...res.map.values()].map(x => x.v));
    const cs = centers(), feats = [];
    for (const [code, x] of res.map) {
      const xy = cs.get(code); if (!xy) continue;
      feats.push({ type: "Feature", geometry: { type: "Point", coordinates: xy }, properties: { code, c: color(x.v), thin: !!x.thin, nm: (SGG[code]?.name || code).replace(/시 /, " "), lbl: fmtV(mode, x.v) } });
    }
    ensureLayers();
    map.getSource("cm-sgg").setData({ type: "FeatureCollection", features: feats });
    for (const id of LAYERS) map.setLayoutProperty(id, "visibility", "visible");
    setDim(true);
    const ranked = [...res.map].filter(([, x]) => !x.thin).sort((a, b) => b[1].v - a[1].v);
    const gapLow = mode === "gap" && !budget;   // 갭 중간값은 작은 곳이 먼저 궁금함
    legend({ basis: res.basis, items: legendItems(mode, vals.length ? vals : [0], color), top: gapLow ? ranked.slice(-3).reverse() : ranked.slice(0, 3), bottom: gapLow ? ranked.slice(0, 3) : ranked.slice(-3).reverse(),
      topTitle: gapLow ? "갭이 작은 곳" : mode === "gap" ? "그 돈 이하 갭이 많은 곳" : "높은 곳", bottomTitle: gapLow ? "갭이 큰 곳" : mode === "gap" ? "적은 곳" : "낮은 곳", color, count: res.map.size });
    if (mode === "gap" && budget) gapList();
  }

  // ── 단추·고르는 칸·설명 ──
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  const wrap = el("div", "cm-wrap");
  const btn = el("button", "cm-btn"); btn.type = "button"; btn.setAttribute("aria-expanded", "false");
  const panel = el("div", "cm-panel"); panel.hidden = true;
  const leg = el("div", "cm-legend"); leg.hidden = true;
  // 바로 가기(사용자 2026-11-26 "전세가격과 매매가격은 어디에?") — 누르면 갭(매매 − 전세) 색칠 + 3억 이하 목록, 다시 누르면 끄기
  const gapBtn = el("button", "cm-btn cm-gapbtn", "💰 매매·전세"); gapBtn.type = "button"; gapBtn.title = "매매가 − 전세가(갭) 지도 · 단지별 매매·전세 가격 목록";
  gapBtn.addEventListener("click", () => { if (mode === "gap") { mode = "off"; store.set("reColorMode", "off"); } else { mode = "gap"; store.set("reColorMode", "gap"); if (!budget) { budget = 3; store.set("reColorGap", 3); } } draw(); });
  wrap.append(btn, gapBtn, panel); mapEl.append(wrap, leg);
  btn.textContent = "🎨 지도 색칠";
  btn.addEventListener("click", () => { panel.hidden = !panel.hidden; btn.setAttribute("aria-expanded", String(!panel.hidden)); syncPanel(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
  function syncPanel() {
    btn.textContent = mode === "off" ? "🎨 지도 색칠" : `🎨 ${MODES[mode].label}${MODES[mode].kinds ? ` · ${KN[kind]}` : ""}`;
    btn.classList.toggle("on", mode !== "off");
    gapBtn.classList.toggle("on", mode === "gap");
    if (panel.hidden) return;
    const ms = el("div", "cm-modes");
    for (const [k, m] of Object.entries(MODES)) {
      const b = el("button", k === mode ? "on" : null, m.label); b.type = "button";
      b.addEventListener("click", () => { mode = k; store.set("reColorMode", k); draw(); });
      ms.append(b);
    }
    panel.replaceChildren(el("div", "cm-h", "무엇으로 칠할까요?"), ms);
    if (MODES[mode].kinds) {
      const ks = el("div", "cm-kinds");
      for (const [k, n] of Object.entries(KN)) { const b = el("button", k === kind ? "on" : null, n); b.type = "button"; b.addEventListener("click", () => { kind = k; store.set("reColorKind", k); draw(); }); ks.append(b); }
      panel.append(ks);
    }
    if (mode === "gap") {
      const bs = el("div", "cm-kinds");
      bs.append(el("small", "cm-note", "예산(갭):"));
      for (const [b, t] of [[0, "중간값으로"], [1, "1억 이하"], [2, "2억 이하"], [3, "3억 이하"], [5, "5억 이하"]]) { const x = el("button", b === budget ? "on" : null, t); x.type = "button"; x.addEventListener("click", () => { budget = b; store.set("reColorGap", b); draw(); }); bs.append(x); }
      panel.append(bs);
    }
    panel.append(el("p", "cm-note", "시·구마다 큰 동그라미로 칠해요(경계선 자료는 가입이 필요해서). 동 점이 없는 빈 곳을 누르면 그 시·구로 가요."));
  }
  function legend(s) {
    if (!s) { leg.hidden = true; return; }
    leg.hidden = false;
    const head = el("div", "cm-lh");
    const x = el("button", "cm-x", "✕"); x.type = "button"; x.title = "색칠 끄기"; x.setAttribute("aria-label", "색칠 끄기");
    x.addEventListener("click", () => { mode = "off"; store.set("reColorMode", "off"); draw(); });
    const fold = el("button", "cm-fold", leg.classList.contains("folded") ? "펼치기" : "접기"); fold.type = "button";
    fold.addEventListener("click", () => { leg.classList.toggle("folded"); fold.textContent = leg.classList.contains("folded") ? "펼치기" : "접기"; });
    head.append(el("b", null, `🎨 ${MODES[mode].label}${MODES[mode].kinds ? ` · ${KN[kind]}` : ""}`), fold, x);
    if (s.loading) { leg.replaceChildren(head, el("small", null, "불러오는 중…")); return; }
    if (s.error) { leg.replaceChildren(head, el("small", null, `불러오지 못했어요: ${s.error}`)); return; }
    if (s.empty) { leg.replaceChildren(head, el("small", null, "아직 칠할 자료가 없어요."), el("small", null, s.basis || "")); return; }
    const scale = el("div", "cm-scale");
    for (const [t, c] of s.items) { const i = el("span"); const dot = el("i"); dot.style.background = c; i.append(dot, t); scale.append(i); }
    const fmt = v => fmtV(mode, v);
    const rank = (title, xs) => { const d = el("div", "cm-rank"); d.append(el("small", null, title)); for (const [c, v] of xs) { const b = el("button", null, `${nameOf(c)} ${fmt(v.v)}`); b.type = "button"; b.style.borderColor = s.color(v.v); b.title = v.sub; b.addEventListener("click", () => { try { showTab("list"); pickSgg("list", c); } catch { /* 이동만 */ } }); d.append(b); } return d; };
    leg.replaceChildren(head, scale, rank(s.topTitle || "높은 곳", s.top), rank(s.bottomTitle || "낮은 곳", s.bottom), el("small", "cm-basis", `${s.basis} · ${s.count}곳 · 점선 = 표본 적음`));
    if (mode === "gap") { const w = el("small", "cm-warn", "⚠ 갭이 작다 = 전세가율이 높다는 뜻이라 깡통전세 위험과 같은 말이에요. 세입자 보증금은 나중에 돌려줘야 할 빚이에요. 투자 권유가 아니에요."); const gl = el("div", "cm-gaplist"); gl.id = "cmGapList"; leg.append(w, gl); }
  }
  // ── 갭 예산 이하 단지·건물 목록(지금 지도에 보이는 시·구) ──
  let gapSeq = 0, gapTimer = 0;
  async function gapList() {
    const box = document.getElementById("cmGapList");
    if (!box || mode !== "gap" || !budget) return;
    const my = ++gapSeq, bd = map.getBounds(), cs = centers();
    const vis = [...cs].filter(([, xy]) => bd.contains(xy)).map(([c]) => c);
    if (!vis.length) { box.replaceChildren(el("small", null, "지도를 서울·경기 쪽으로 옮겨 주세요.")); return; }
    box.replaceChildren(el("small", null, "불러오는 중…"));
    const { data, error } = await db.from("re_gap_places").select("kind,sgg_cd,umd_nm,place_key,name,build_year,area,sale,jeonse,gap,ratio,n_sale,n_jeonse")
      .eq("kind", kind).in("sgg_cd", vis.slice(0, 72)).gt("gap", 0).lte("gap", budget * 10000).order("n_sale", { ascending: false }).limit(12);
    if (my !== gapSeq) return;
    const b2 = document.getElementById("cmGapList"); if (!b2) return;
    if (error) { b2.replaceChildren(el("small", null, "목록을 불러오지 못했어요.")); return; }
    const head = el("div", "cm-gl-h", `🏠 지금 지도에 보이는 곳 중 갭 ${budget}억 이하 ${KN[kind]} (거래 많은 순)`);
    if (!data?.length) { b2.replaceChildren(head, el("small", null, "없어요. 지도를 옮기거나 예산을 바꿔 보세요.")); return; }
    const ul = el("div", "cm-gl");
    for (const r of data) {
      const bt = el("button", "cm-gl-row"); bt.type = "button"; bt.title = "단지·건물 상세 열기";
      const nm = r.kind === "apt" ? r.name || r.place_key : r.name && !String(r.name).startsWith("(") ? r.name : `${r.place_key}번지`;
      const risk = r.ratio >= 80 ? ["bad", "위험"] : r.ratio >= 70 ? ["warn", "주의"] : ["", ""];
      const l = el("span", "cm-gl-l"); l.append(el("b", null, nm), el("small", null, `${SGG[r.sgg_cd]?.name || ""} ${r.umd_nm} · ${Math.round(r.area)}㎡${r.build_year ? ` · ${r.build_year}년` : ""} · 매매 ${r.n_sale}건`));
      const rt = el("span", "cm-gl-r"); rt.append(el("b", null, `갭 ${eok(r.gap)}`), el("small", null, `매매 ${eok(r.sale)} · 전세 ${eok(r.jeonse)}`), el("small", `cm-risk ${risk[0]}`, `전세가율 ${Math.round(r.ratio)}%${risk[1] ? ` ${risk[1]}` : ""}`));
      bt.append(l, rt);
      bt.addEventListener("click", () => { try { openPlace({ kind: r.kind, sgg_cd: r.sgg_cd, umd_nm: r.umd_nm, place_key: r.place_key, name: r.name, build_year: r.build_year }); } catch (e) { console.warn("re-colormap", e); } });
      ul.append(bt);
    }
    b2.replaceChildren(head, ul, el("small", null, "같은 단지·같은 크기의 12개월 매매 중간값 − 신규 전세 중간값. 층·향·실제 매물가는 달라요. 상세 화면의 '🛡 전세 위험 체크'도 꼭 보세요."));
  }
  const start = () => { syncPanel(); if (mode !== "off") draw(); };
  // 지도가 생길 때까지 기다렸다가 시작(로그인 화면에서 페이지를 연 경우 이 파일이 지도보다 먼저 불러와짐 — 2026-11-26 고침)
  const boot = () => {
    if (typeof map === "undefined" || !map) return void setTimeout(boot, 500);
    map.on("moveend", () => { if (mode === "gap" && budget) { clearTimeout(gapTimer); gapTimer = setTimeout(gapList, 600); } });
    if (map.loaded() && map.getLayer("clusters")) start(); else map.once("idle", start);
  };
  boot();
  globalThis.RECOLOR = { draw, values, setMode(m, k) { if (MODES[m]) { mode = m; store.set("reColorMode", m); } if (k && KN[k]) { kind = k; store.set("reColorKind", k); } draw(); } };

  const css = document.createElement("style");
  css.textContent = `
.cm-wrap { position: absolute; top: 84px; right: 10px; z-index: 3; display: grid; justify-items: end; gap: 6px; }
.cm-btn { font: inherit; font-size: 12.5px; font-weight: 700; padding: 5px 10px; border-radius: 8px; border: 1px solid var(--line); background: rgba(17,24,39,.94); color: #e5e7eb; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.cm-btn.on { border-color: #f59e0b; color: #fde68a; }
.cm-panel { width: 230px; background: rgba(17,24,39,.96); border: 1px solid var(--line); border-radius: 10px; padding: 8px; display: grid; gap: 6px; color: #e5e7eb; box-shadow: 0 6px 18px rgba(0,0,0,.4); }
.cm-h { font-weight: 800; font-size: 12.5px; }
.cm-modes, .cm-kinds { display: flex; flex-wrap: wrap; gap: 4px; }
.cm-modes button, .cm-kinds button { font: inherit; font-size: 12px; padding: 3px 9px; border-radius: 999px; border: 1px solid #374151; background: transparent; color: #cbd5e1; cursor: pointer; }
.cm-modes button.on, .cm-kinds button.on { border-color: #f59e0b; color: #fff; font-weight: 700; background: rgba(245,158,11,.18); }
.cm-kinds { border-top: 1px dashed #374151; padding-top: 6px; }
.cm-note { margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.45; }
.cm-legend { position: absolute; right: 10px; bottom: 30px; z-index: 3; width: min(300px, calc(100% - 20px)); background: rgba(17,24,39,.95); border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; display: grid; gap: 5px; color: #e5e7eb; font-size: 12px; box-shadow: 0 6px 18px rgba(0,0,0,.4); }
.cm-lh { display: flex; align-items: center; gap: 6px; } .cm-x { margin-left: auto; font: inherit; border: 0; background: none; color: #9ca3af; cursor: pointer; }
.cm-scale { display: flex; flex-wrap: wrap; gap: 4px 10px; } .cm-scale i { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 4px; vertical-align: -2px; }
.cm-rank { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; } .cm-rank small { color: #9ca3af; width: 100%; }
.cm-rank button { font: inherit; font-size: 11.5px; padding: 1px 7px; border-radius: 999px; border: 1.5px solid; background: transparent; color: #e5e7eb; cursor: pointer; }
.cm-legend small { color: #9ca3af; } .cm-basis { line-height: 1.45; }
.cm-legend { max-height: calc(100% - 140px); overflow-y: auto; overflow-x: hidden; }
.cm-legend.folded > :not(.cm-lh) { display: none; }
.cm-fold { font: inherit; font-size: 11px; border: 1px solid #374151; border-radius: 999px; background: none; color: #9ca3af; cursor: pointer; padding: 0 7px; }
.cm-warn { color: #fbbf24 !important; line-height: 1.45; }
.cm-gaplist { display: grid; gap: 4px; border-top: 1px dashed #374151; padding-top: 5px; }
.cm-gl-h { font-weight: 800; font-size: 12px; } .cm-gl { display: grid; gap: 2px; }
.cm-gl-row { display: flex; justify-content: space-between; gap: 6px; width: 100%; font: inherit; font-size: 12px; text-align: left; background: transparent; border: 0; border-radius: 6px; padding: 3px 4px; color: #e5e7eb; cursor: pointer; }
.cm-gl-row:hover { background: rgba(255,255,255,.08); }
.cm-gl-l, .cm-gl-r { display: grid; min-width: 0; } .cm-gl-r { justify-items: end; text-align: right; flex: 0 0 auto; max-width: 48%; }
.cm-gl-l small, .cm-gl-r small { font-size: 10.5px; } .cm-gl-l b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cm-risk.bad { color: #f87171 !important; font-weight: 700; } .cm-risk.warn { color: #fbbf24 !important; font-weight: 700; }
@media (max-width: 767px) { .cm-wrap { top: 64px; } .cm-legend { bottom: 8px; font-size: 11.5px; } .cm-panel { width: 210px; } }`;
  document.head.append(css);
})();
