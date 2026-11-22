// 부동산 페이지 [영향·예측] 탭 (2026-11-23 사용자 "2단계 시작해" — 부동산 영향 2단계. 3단계에서 AI 권역 예측이 이 탭에 붙음)
// - re-impact.js 가 이 파일과 re-signal-core.js(권역 ZONES)를 불러옴. real-estate.html 수정 없음(탭·칸은 이 파일이 만듦)
// - 내용: ① 금리·대출 띠(한국은행 ECOS re_macro) ② 전국·서울·경기 부동산 뉴스(re_news_days 00000·11000·41000)
//   ③ 권역 10곳 카드: 아파트 매매 거래량·㎡당 가격(re_monthly_stats, 신고가 다 모인 달만), 신규 전세 ㎡당·전세가율(re_rent_monthly), 미분양·준공 후 미분양(KOSIS re_unsold), 뉴스 신호(주제별 기사 수·대표 제목)
//   ④ 지도: 이 탭일 때만 시·군·구 동그라미(크기 = 고른 기간 부동산 뉴스 수, 색 = 가장 많은 주제). 동그라미·카드를 누르면 아래 "고른 지역" 칸에 그 지역 소식
// - 숫자는 계산·모으기만(예측·추천 아님). 아파트만(빌라·오피스텔은 다음에)
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined" || typeof showTab !== "function") return;
  const R = () => globalThis.RESIG;
  const THEME = { market: "시장·가격", supply: "공급·분양", redevelop: "재건축·재개발", transit: "교통 호재", develop: "개발·산업", rule: "규제·세금", rate: "금리·대출", risk: "위험" };
  const COLOR = { market: "#a855f7", supply: "#22c55e", redevelop: "#f59e0b", transit: "#06b6d4", develop: "#3b82f6", rule: "#ec4899", rate: "#eab308", risk: "#ef4444" };
  const H = 3600e3, DAY = 86400e3;
  const kstNow = () => new Date(Date.now() + 9 * H);
  const ymOf = (y, m) => `${y}-${String(m).padStart(2, "0")}-01`;
  function monthsBack(n) { const d = kstNow(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - n); return ymOf(d.getUTCFullYear(), d.getUTCMonth() + 1); }
  const kstDay = t => new Date(t + 9 * H).toISOString().slice(0, 10);
  const pct = (a, b) => (a != null && b ? (a / b - 1) * 100 : null);
  const sgn = (v, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "▲ +" : v < 0 ? "▼ −" : ""}${Math.abs(v).toFixed(d)}%`);
  const cls = v => (v == null || !Number.isFinite(v) || Math.abs(v) < 0.05 ? "flat" : v > 0 ? "up" : "down");
  const man = v => (v == null ? "–" : `${Math.round(v).toLocaleString()}만`);
  let days = 14;
  try { days = [7, 14, 30].includes(Number(localStorage.getItem("reImpactDays"))) ? Number(localStorage.getItem("reImpactDays")) : 14; } catch { /* 기억 없음 */ }

  // ── 탭·칸 만들기 ──
  const tabs = document.querySelector(".side-tabs"), statsPane = document.getElementById("pane-stats");
  if (!tabs || !statsPane) return;
  const btn = el("button", null, "영향·예측"); btn.type = "button"; btn.setAttribute("role", "tab"); btn.dataset.tab = "impact";
  tabs.append(btn);
  const pane = el("section", "pane re-imp"); pane.id = "pane-impact"; pane.setAttribute("role", "tabpanel"); pane.hidden = true;
  statsPane.after(pane);
  let active = false;
  const baseShow = showTab;
  showTab = function (name, ...rest) {
    if (name === "impact") {
      active = true;
      for (const b of document.querySelectorAll(".side-tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === "impact"));
      for (const p of ["list", "stats", "detail"]) { const x = document.getElementById(`pane-${p}`); if (x) x.hidden = true; }
      pane.hidden = false;
      try { localStorage.setItem("reImpactTab", "1"); } catch { /* 기억 없음 */ }
      setLayer(true);
      load().then(render).catch(e => { console.warn("re-impact-tab", e); pane.replaceChildren(el("p", "re-imp-note", "자료를 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.")); });
      return;
    }
    active = false; pane.hidden = true; setLayer(false);
    try { localStorage.removeItem("reImpactTab"); } catch { /* 기억 없음 */ }
    return baseShow.call(this, name, ...rest);
  };
  btn.addEventListener("click", () => showTab("impact"));
  // 동을 누를 때(원래는 목록 탭으로 넘어감) 이 탭이면 그대로 두고 아래 "고른 지역"만 바꿈
  if (typeof openDong === "function") {
    const baseOpen = openDong;
    openDong = function (d, move = true, stay = false, ...rest) {
      if (active) { const r = baseOpen.call(this, d, move, true, ...rest); if (d?.sgg_cd) pick(d.sgg_cd); return r; }
      return baseOpen.call(this, d, move, stay, ...rest);
    };
  }

  // ── 자료 ──
  let data = null, at = 0, loading = null;
  async function pageAll(make) {
    const out = [];
    for (let off = 0; off < 20000; off += 1000) {
      const { data: r, error } = await make().range(off, off + 999);
      if (error) throw error;
      out.push(...(r || []));
      if (!r || r.length < 1000) break;
    }
    return out;
  }
  async function load(force) {
    if (!force && data && Date.now() - at < 30 * 60e3 && data.days === days) return data;
    if (loading) return loading;
    loading = (async () => {
      const since = monthsBack(26), since15 = monthsBack(16), dayFrom = kstDay(Date.now() - days * DAY);
      const [ms, rent, uns, mac, nd] = await Promise.all([
        pageAll(() => db.from("re_monthly_stats").select("sgg_cd,ym,trades,median_price_m2").eq("kind", "apt").gte("ym", since).order("sgg_cd").order("ym")),
        pageAll(() => db.from("re_rent_monthly").select("sgg_cd,ym,cnt,deposit_m2_med").eq("kind", "apt").eq("rent_type", "jeonse").eq("contract", "new").gte("ym", since).order("sgg_cd").order("ym")),
        pageAll(() => db.from("re_unsold").select("tbl,sido,region_name,region_cd,ym,units").gte("ym", since15).order("ym").order("region_name")),
        pageAll(() => db.from("re_macro").select("series,region,ym,value").gte("ym", monthsBack(26)).order("series").order("ym")),
        pageAll(() => db.from("re_news_days").select("day,region,theme,n,top").gte("day", dayFrom).order("day", { ascending: false }).order("region")),
      ]);
      // 3단계 AI 권역 예측(표가 없으면 빈칸 — SQL 실행 전)
      let ai = null;
      try {
        const n = await db.from("re_ai_notes").select("day,note,cost_usd,last_confirmed,model").order("day", { ascending: false }).limit(1);
        if (!n.error && n.data?.[0]) {
          const d0 = n.data[0].day;
          const [f, sc] = await Promise.all([db.from("re_forecasts").select("zone,call,prob,up_prob,exp_move,reason,flip,anchor,basis,base_months,target_months").eq("day", d0),
            db.from("re_forecast_score").select("zone,n,hits,hit_pct,avg_prob")]);
          ai = { note: n.data[0], fc: Object.fromEntries((f.data || []).map(x => [x.zone, x])), score: Object.fromEntries((sc.data || []).map(x => [x.zone, x])) };
        }
      } catch { /* 예측 칸만 빔 */ }
      data = { ms, rent, uns, mac, nd, days, ai };
      at = Date.now();
      return data;
    })().finally(() => { loading = null; });
    return loading;
  }

  // 신고 기한(계약 뒤 30일) 때문에 이번 달·지난달은 덜 모인 숫자 → 그 전 달까지만. 최근 3달 / 그 전 3달 / 1년 전 같은 3달
  function windows() {
    const w = k => [k, k + 1, k + 2].map(monthsBack);
    return { recent: w(2), prev: w(5), yoy: w(14), label: `${monthsBack(4).slice(2, 7).replace("-", ".")}~${monthsBack(2).slice(5, 7)}월` };
  }
  function saleOf(codes, months) {
    const set = new Set(codes), ms = new Set(months);
    let t = 0, w = 0;
    for (const r of data.ms) if (set.has(r.sgg_cd) && ms.has(r.ym) && r.trades) { t += r.trades; if (r.median_price_m2) w += Number(r.median_price_m2) * r.trades; }
    return { trades: t / months.length, m2: t ? w / t : null };
  }
  function rentOf(codes, months) {
    const set = new Set(codes), ms = new Set(months);
    let c = 0, w = 0;
    for (const r of data.rent) if (set.has(r.sgg_cd) && ms.has(r.ym) && r.cnt && r.deposit_m2_med) { c += r.cnt; w += Number(r.deposit_m2_med) * r.cnt; }
    return c ? w / c : null;
  }
  // 미분양: KOSIS 지역 코드(서울 구·경기 시) — 권역 열쇠(구 + 그 시)에 든 것만, 가장 최근 달과 3달 전
  function unsoldOf(keys, tbl) {
    const set = new Set(keys), by = new Map();
    for (const r of data.uns) if (r.tbl === tbl && r.region_cd && set.has(r.region_cd) && !/^(계|합계)$/.test(r.region_name)) by.set(r.ym, (by.get(r.ym) || 0) + r.units);
    const ms = [...by.keys()].sort(), last = ms.at(-1);
    if (!last) return null;
    const i = ms.indexOf(last), before = ms[i - 3];
    return { ym: last, units: by.get(last), before: before ? by.get(before) : null };
  }
  function newsOf(keys) {
    const set = new Set(keys), counts = {}, top = [], seen = new Set();
    let n = 0;
    for (const r of data.nd) {
      if (!set.has(r.region)) continue;
      counts[r.theme] = (counts[r.theme] || 0) + r.n; n += r.n;
      for (const t of r.top || []) if (!seen.has(t.u)) { seen.add(t.u); top.push({ ...t, theme: r.theme, day: r.day }); }
    }
    return { n, counts, top };
  }
  function macro(series, region = "00000") {
    const rows = data.mac.filter(r => r.series === series && r.region === region).sort((a, b) => a.ym.localeCompare(b.ym));
    return rows;
  }

  // ── 그리기 ──
  function chips(counts) {
    const box = el("div", "re-chips");
    for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) { const c = el("span", "re-tchip", `${THEME[k] || k} ${n}`); c.style.setProperty("--c", COLOR[k] || "#888"); box.append(c); }
    return box;
  }
  function headlines(list, max) {
    const ul = el("ul", "re-heads");
    for (const x of list.slice(0, max)) {
      const li = el("li"), a = el("a", null, x.t);
      if (/^https?:\/\//i.test(x.u || "")) { a.href = x.u; a.target = "_blank"; a.rel = "noopener noreferrer"; }
      const tag = el("span", "re-tchip", THEME[x.theme] || x.theme); tag.style.setProperty("--c", COLOR[x.theme] || "#888");
      li.append(tag, a, el("small", null, ` ${String(x.day).slice(5).replace("-", "/")} · ${x.s || ""}`));
      ul.append(li);
    }
    return ul;
  }
  const row = (k, v, sub, c) => { const d = el("div", "re-row"); d.append(el("span", "re-k", k), el("b", c ? `re-v ${c}` : "re-v", v)); if (sub) d.append(el("small", null, sub)); return d; };

  function macroStrip() {
    const box = el("div", "re-macro");
    const tile = (name, rows, unit, cmpBack, isPct) => {
      if (!rows.length) return;
      const last = rows.at(-1), prev = rows[rows.length - 1 - cmpBack];
      const t = el("div", "re-mt");
      const diff = prev ? (isPct ? last.value - prev.value : pct(last.value, prev.value)) : null;
      const dtxt = diff == null ? "" : isPct ? `${diff > 0 ? "▲ +" : diff < 0 ? "▼ −" : ""}${Math.abs(diff).toFixed(2)}%p` : sgn(diff);
      t.append(el("div", "re-mn", name), el("div", "re-mv", isPct ? `${last.value.toFixed(2)}${unit}` : `${(last.value / 10000).toFixed(1)}조`),
        el("div", `re-md ${cls(diff)}`, `${dtxt}${dtxt ? ` (${cmpBack}개월 전 대비)` : ""}`), el("small", null, `${last.ym.slice(0, 7).replace("-", ".")} 기준`));
      box.append(t);
    };
    tile("기준금리", macro("BASE_RATE"), "%", 12, true);
    tile("주담대 금리(신규)", macro("MORTGAGE_RATE"), "%", 3, true);
    tile("전세대출 금리(신규)", macro("JEONSE_LOAN_RATE"), "%", 3, true);
    tile("서울 은행 주택대출", macro("HH_HOUSING_LOAN_BANK", "11000"), "", 3, false);
    tile("경기 은행 주택대출", macro("HH_HOUSING_LOAN_BANK", "41000"), "", 3, false);
    return box;
  }

  // ── 3단계: AI 권역 예측 ──
  const ym = d => String(d).slice(2, 7).replace("-", ".");
  function aiTop(ai) {
    const n = ai.note.note || {}, all = ai.score?.all, out = [];
    out.push(el("h3", "re-h", `🔮 AI 권역 예측 · 3개월 뒤 (${String(ai.note.day).slice(5).replace("-", "/")} 월요일)`));
    const box = el("div", "re-ai");
    if (n.headline) box.append(el("div", "re-ai-h", n.headline));
    box.append(el("p", "re-imp-note", "읽는 법: 확률 58% = 같은 판단을 100번 하면 58번쯤 맞는다는 뜻(가격이 58% 오른다는 뜻 아님). 기준은 권역 아파트 ㎡당 중간값(그달 팔린 단지에 따라 흔들림)의 최근 3달 평균 → 다음 3달 평균. "
      + "확률은 과거 3년 통계에서 출발해 뉴스·금리·미분양으로 ±8 안에서만 고쳐요. 투자 권유가 아니에요."));
    box.append(el("div", "re-ai-score", all && all.n ? `📏 지금까지 채점 ${all.n}건 · 맞힌 비율 ${all.hit_pct}% · AI 평균 확률 ${all.avg_prob}% (동전 던지기 50%와 비교)`
      : `📏 아직 채점 전 — 목표 3달의 신고가 다 모이면(약 5달 뒤) 맞았는지 자동으로 채점해요.`));
    if (n.watch?.length) { const ul = el("ul", "re-heads"); for (const w of n.watch) ul.append(el("li", null, `👀 ${w.text}`)); box.append(ul); }
    box.append(el("small", "re-imp-note", `${ai.note.model || "AI"} · 비용 $${ai.note.cost_usd ?? "–"} · 재료 기준 확정 달 ${ym(ai.note.last_confirmed)}`));
    out.push(box);
    return out;
  }
  function fcBlock(f, sc) {
    const box = el("div", "re-fc"), up = f.call === "up";
    box.append(el("div", `re-fc-l ${up ? "up" : "down"}`, `🔮 3개월 뒤 ${up ? "▲ 상승" : "▼ 하락"} 확률 ${f.prob}%${f.exp_move != null ? ` · 예상 ${f.exp_move > 0 ? "+" : "−"}${Math.abs(f.exp_move)}%` : ""}`));
    if (f.reason) box.append(el("div", "re-fc-r", f.reason));
    if (f.flip) box.append(el("div", "re-fc-f", `틀리면: ${f.flip}`));
    const b = f.basis || {};
    if (b.n) box.append(el("div", "re-fc-b", `📊 과거 3년(권역 10곳): ${b.label || "전체 기간"} ${b.n}번 중 ${b.up}번 상승(${b.up_pct}%) → 출발 ${f.anchor}%${b.median_pct != null ? ` · 중간값 ${b.median_pct > 0 ? "+" : ""}${b.median_pct}%` : ""}`));
    if (f.target_months?.length) box.append(el("small", "re-imp-note", `기준 ${ym(f.base_months?.[0])}~${ym(f.base_months?.at(-1))} → 목표 ${ym(f.target_months[0])}~${ym(f.target_months.at(-1))}${sc && sc.n ? ` · 이 권역 성적 ${sc.hits}/${sc.n}` : ""}`));
    return box;
  }

  let picked = null;
  function render() {
    if (!data || !active) return;
    const W = windows(), parts = [];
    parts.push(el("p", "re-imp-note", `뉴스·금리·미분양·실거래(아파트)를 권역별로 모았어요. 실거래는 신고가 다 모인 달(${W.label})까지, 뉴스는 최근 ${days}일. 숫자는 모은 것일 뿐 원인·예측이 아니에요 — AI 권역 예측은 다음 단계에서 이 탭에 붙어요.`));
    if (data.ai) parts.push(...aiTop(data.ai));
    parts.push(el("h3", "re-h", "💰 금리·대출 (한국은행 ECOS)"), macroStrip());
    // 기간
    const per = el("div", "re-per");
    per.append(el("span", null, "뉴스 기간"));
    for (const d of [7, 14, 30]) {
      const b = el("button", d === days ? "on" : null, `${d}일`); b.type = "button";
      b.addEventListener("click", () => { days = d; try { localStorage.setItem("reImpactDays", String(d)); } catch { /* 기억 없음 */ } load(true).then(render); });
      per.append(b);
    }
    // 전국·서울·경기 공통 소식
    const nat = newsOf(["00000", "11000", "41000"]);
    parts.push(el("h3", "re-h", "📰 전국·서울·경기 공통 부동산 소식"), per);
    if (nat.n) parts.push(chips(nat.counts), headlines(nat.top.sort((a, b) => ["rate", "rule", "risk", "market"].indexOf(b.theme) - ["rate", "rule", "risk", "market"].indexOf(a.theme) || String(b.day).localeCompare(String(a.day))), 5));
    else parts.push(el("p", "re-imp-note", "이 기간에 지역이 없는 부동산 소식이 없어요."));
    // 권역 카드
    parts.push(el("h3", "re-h", "🗺️ 권역별 (아파트)"));
    const grid = el("div", "re-zones");
    for (const z of R().ZONES) {
      const keys = R().zoneKeys(z), sr = saleOf(z.codes, W.recent), sp = saleOf(z.codes, W.prev), sy = saleOf(z.codes, W.yoy);
      const jr = rentOf(z.codes, W.recent), jp = rentOf(z.codes, W.prev);
      const un = unsoldOf(keys, "DT_MLTM_2082"), uc = unsoldOf(keys, "DT_MLTM_5328"), nw = newsOf(keys);
      const card = el("article", "re-zone"); card.tabIndex = 0;
      card.append(el("div", "re-zn", z.name));
      if (data.ai?.fc?.[z.id]) card.append(fcBlock(data.ai.fc[z.id], data.ai.score?.[z.id]));
      card.append(row("거래(월평균)", `${Math.round(sr.trades).toLocaleString()}건`, `직전 3달 ${sgn(pct(sr.trades, sp.trades), 0)} · 1년 전 ${sgn(pct(sr.trades, sy.trades), 0)}`, cls(pct(sr.trades, sp.trades))));
      card.append(row("㎡당 매매가", man(sr.m2), `직전 3달 ${sgn(pct(sr.m2, sp.m2))} · 1년 전 ${sgn(pct(sr.m2, sy.m2))}`, cls(pct(sr.m2, sp.m2))));
      card.append(row("㎡당 신규 전세", man(jr), `직전 3달 ${sgn(pct(jr, jp))}${jr && sr.m2 ? ` · 전세가율 약 ${Math.round((jr / sr.m2) * 100)}%` : ""}`, cls(pct(jr, jp))));
      if (un) card.append(row("미분양", `${un.units.toLocaleString()}호`, `${un.ym.slice(2, 7).replace("-", ".")} · 3달 전 ${un.before != null ? `${un.before.toLocaleString()}호` : "–"}${uc ? ` · 준공 후 ${uc.units.toLocaleString()}호` : ""}`,
        un.before != null ? cls(un.units - un.before) : null));
      card.append(row("뉴스 신호", `${nw.n}건`, `최근 ${days}일`));
      if (nw.n) card.append(chips(nw.counts), headlines(nw.top.sort((a, b) => String(b.day).localeCompare(String(a.day))), 2));
      const go = () => { focusCodes(z.codes); pickZone(z); };
      card.addEventListener("click", e => { if (!e.target.closest("a")) go(); });
      card.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
      grid.append(card);
    }
    parts.push(grid);
    const sel = el("div", "re-sel"); sel.id = "reImpSel";
    parts.push(el("h3", "re-h", "📍 고른 지역"), sel);
    parts.push(el("p", "re-imp-note", "출처: 국토교통부 실거래가(아파트 매매·전월세), 한국은행 ECOS(금리·대출), 국토교통부 「미분양주택현황보고」(KOSIS), 뉴스 제목(연합뉴스·뉴시스 등). 미분양은 경기도는 시 단위라 구가 있는 시는 그 시 전체."));
    pane.replaceChildren(...parts);
    if (picked) (picked.zone ? pickZone(picked.zone) : pick(picked.code));
    else sel.append(el("p", "re-imp-note", "권역 카드나 지도의 동그라미·동을 누르면 그 지역 부동산 소식이 여기에 나와요."));
    drawLayer();
  }
  function showSel(title, keys) {
    const sel = document.getElementById("reImpSel");
    if (!sel || !data) return;
    const nw = newsOf(keys);
    sel.replaceChildren(el("div", "re-zn", title), ...(nw.n ? [chips(nw.counts), headlines(nw.top.sort((a, b) => String(b.day).localeCompare(String(a.day))), 10)]
      : [el("p", "re-imp-note", `최근 ${days}일 동안 이 지역 이름이 나온 부동산 소식이 없어요.`)]));
  }
  function pickZone(z) { picked = { zone: z }; showSel(z.name, R().zoneKeys(z)); }
  function pick(code) {
    picked = { code };
    const keys = /^41\d\d[1-9]$/.test(code) ? [code, `${code.slice(0, 4)}0`] : [code];
    const nm = SGG[code] ? `${SGG[code].sido} ${SGG[code].name}` : nameOfKey(code);
    showSel(nm, keys);
  }
  function nameOfKey(code) {
    const first = Object.keys(SGG).find(c => c.startsWith(code.slice(0, 4)));
    return first ? `${SGG[first].sido} ${SGG[first].name.split(" ")[0]}` : code;
  }
  function focusCodes(codes) {
    if (typeof map === "undefined" || !map || typeof dongs === "undefined") return;
    const set = new Set(codes), pts = dongs.filter(d => set.has(d.sgg_cd));
    if (!pts.length) return;
    const b = new maplibregl.LngLatBounds(); pts.forEach(d => b.extend([d.x, d.y]));
    map.fitBounds(b, { padding: 40, maxZoom: 12, duration: 800 });
  }

  // ── 지도 동그라미 ──
  function centroids() {
    const acc = new Map();
    for (const d of dongs || []) { const a = acc.get(d.sgg_cd) || { x: 0, y: 0, n: 0 }; a.x += d.x; a.y += d.y; a.n++; acc.set(d.sgg_cd, a); }
    const at = new Map([...acc].map(([k, a]) => [k, [a.x / a.n, a.y / a.n]]));
    return key => {
      if (at.has(key)) return at.get(key);
      const kids = [...at.keys()].filter(c => c.startsWith(key.slice(0, 4)) && /^41/.test(key));
      if (!kids.length) return null;
      const xs = kids.map(k => at.get(k));
      return [xs.reduce((s, p) => s + p[0], 0) / xs.length, xs.reduce((s, p) => s + p[1], 0) / xs.length];
    };
  }
  function drawLayer() {
    if (typeof map === "undefined" || !map || !data || !map.isStyleLoaded()) return;
    const pos = centroids(), by = new Map();
    for (const r of data.nd) {
      if (["00000", "11000", "41000", "90000"].includes(r.region)) continue;
      const a = by.get(r.region) || { n: 0, c: {} };
      a.n += r.n; a.c[r.theme] = (a.c[r.theme] || 0) + r.n; by.set(r.region, a);
    }
    const feats = [];
    for (const [k, a] of by) {
      const p = pos(k);
      if (!p) continue;
      const top = Object.entries(a.c).sort((x, y) => y[1] - x[1])[0][0];
      feats.push({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: { key: k, n: a.n, color: COLOR[top], theme: THEME[top] } });
    }
    const fc = { type: "FeatureCollection", features: feats };
    if (map.getSource("re-sig")) map.getSource("re-sig").setData(fc);
    else {
      map.addSource("re-sig", { type: "geojson", data: fc });
      map.addLayer({ id: "re-sig", type: "circle", source: "re-sig", layout: { visibility: active ? "visible" : "none" }, paint: {
        "circle-color": ["get", "color"], "circle-opacity": 0.55, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5,
        "circle-radius": ["interpolate", ["linear"], ["get", "n"], 1, 9, 5, 14, 15, 22, 40, 32] } });
      map.addLayer({ id: "re-sig-n", type: "symbol", source: "re-sig", layout: { visibility: active ? "visible" : "none", "text-field": ["to-string", ["get", "n"]],
        "text-font": ["Noto Sans Bold"], "text-size": 12, "text-allow-overlap": true }, paint: { "text-color": "#ffffff", "text-halo-color": "#0b0f17", "text-halo-width": 1.5 } });
      map.on("click", "re-sig", e => { const f = e.features?.[0]; if (f && active) pick(f.properties.key); });
      map.on("mouseenter", "re-sig", () => { if (active) map.getCanvas().style.cursor = "pointer"; });
    }
  }
  function setLayer(on) {
    if (typeof map === "undefined" || !map) return;
    for (const id of ["re-sig", "re-sig-n"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    if (on) drawLayer();
  }

  // 지난번에 이 탭을 보고 있었으면 다시 이 탭으로(로그인·지도 준비 뒤)
  try {
    if (localStorage.getItem("reImpactTab") === "1" && !new URLSearchParams(location.search).get("sgg")) {
      let n = 0;
      const t = setInterval(() => { if (++n > 120) return clearInterval(t); if (document.getElementById("app")?.hidden || typeof map === "undefined" || !map) return; clearInterval(t); showTab("impact"); }, 500);
    }
  } catch { /* 기억 없음 */ }
  globalThis.REIMPTAB = { load, render, pick, pickZone, get data() { return data; } };

  const css = document.createElement("style");
  css.textContent = `
.re-imp { overflow-y: auto; padding: 8px 12px 16px; display: grid; gap: 8px; align-content: start; }
.re-imp-note { font-size: 11.5px; color: var(--muted); margin: 0; line-height: 1.5; }
.re-h { font-size: 15px; margin: 8px 0 0; }
.re-macro { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; }
.re-mt { border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; display: grid; gap: 1px; }
.re-mn { font-size: 11.5px; color: var(--muted); } .re-mv { font-size: 17px; font-weight: 800; } .re-md { font-size: 11.5px; font-weight: 700; }
.re-mt small { font-size: 10.5px; color: var(--muted); }
.re-per { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--muted); }
.re-per button { font: inherit; padding: 1px 10px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; }
.re-per button.on { border-color: var(--accent); color: var(--text); font-weight: 700; }
.re-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.re-tchip { display: inline-block; font-size: 11px; padding: 0 7px; border-radius: 999px; border: 1px solid var(--c); color: var(--text); background: color-mix(in srgb, var(--c) 18%, transparent); margin-right: 4px; white-space: nowrap; }
.re-heads { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px; }
.re-heads a { color: var(--text); text-decoration: none; } .re-heads a:hover { text-decoration: underline; } .re-heads small { color: var(--muted); }
.re-zones { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
.re-zone { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; display: grid; gap: 4px; cursor: pointer; }
.re-zone:hover, .re-zone:focus { border-color: var(--accent); outline: none; }
.re-zn { font-weight: 800; font-size: 14px; }
.re-row { display: grid; grid-template-columns: 92px 1fr; column-gap: 6px; font-size: 12.5px; align-items: baseline; }
.re-row small { grid-column: 2; color: var(--muted); font-size: 11px; }
.re-k { color: var(--muted); } .re-v { font-weight: 800; } .re-v.up { color: var(--up, #ef4444); } .re-v.down { color: var(--down, #3b82f6); }
.re-md.up { color: var(--up, #ef4444); } .re-md.down { color: var(--down, #3b82f6); } .re-md.flat { color: var(--muted); }
.re-sel { border: 1px dashed var(--line); border-radius: 10px; padding: 8px 10px; display: grid; gap: 6px; }
.re-ai { border: 1px solid var(--accent); border-radius: 10px; padding: 8px 10px; display: grid; gap: 6px; }
.re-ai-h { font-weight: 800; font-size: 14px; line-height: 1.5; }
.re-ai-score { font-size: 12px; font-weight: 700; }
.re-fc { border-top: 1px dashed var(--line); border-bottom: 1px dashed var(--line); padding: 5px 0; display: grid; gap: 3px; }
.re-fc-l { font-weight: 800; font-size: 13.5px; } .re-fc-l.up { color: var(--up, #ef4444); } .re-fc-l.down { color: var(--down, #3b82f6); }
.re-fc-r { font-size: 12px; line-height: 1.5; } .re-fc-f { font-size: 11.5px; color: var(--muted); } .re-fc-b { font-size: 11.5px; color: var(--muted); }`;
  document.head.append(css);
})();
