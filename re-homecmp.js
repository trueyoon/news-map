// 부동산 페이지 [집 비교] 탭 (사용자 2026-11-24 "재산 조건에 상관없이, 내가 선택한 집과 집을 비교하는 탭 — 예: 안양 집과 용인 집")
// - [내 집 찾기]의 ⚖️ 매물 비교(현재 조건으로 필요한 내 돈까지 계산)와 따로: 돈 계산 없이 집 자체만 최대 5개 나란히
// - 담기: 지역(시·구)·동·종류로 고르거나 이름으로 찾기 / 단지·건물 상세 화면의 "☆ 집 비교에 담기" / 이 탭에서 지도의 동을 누르면 그 동의 집 목록
// - 집마다 비교 크기 = 그 집에서 최근 12개월 가장 많이 거래된 크기(크기 단추로 바꿀 수 있음). 다른 크기 거래는 섞지 않음(내 집 찾기·AI 와 같은 크기 규칙)
// - 표: 위치·권역·준공·규모·예상 가격(A 대비 %)·3.3㎡당·1년 변화·3년 최고 분기 대비·거래·해제·마지막 거래·신규 전세·전세가율·그 지역(시·구) 흐름·권역 AI 예측
//   + 분기별 3.3㎡당 선 그래프. 계산만(무료). 집마다 🤖 AI 분석(re-item, 집 정보만 보냄 — 하루 20번, 같은 집 7일 안은 저장본)
// - 저장: localStorage reHomeCmp(담은 집)·reHomeCmpKinds·reHomeCmpTab — 데이터베이스에는 저장하지 않음
// - re-impact.js 가 re-finder.js 다음에 불러옴(real-estate.html 수정 없음). 탭 버튼·칸을 이 파일이 만들고 showTab·openPlace·openDong 을 감쌈
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined" || typeof showTab !== "function" || typeof KIND === "undefined") return;
  const R = () => globalThis.RESIG, F = () => globalThis.REFINDER;
  const PY = 3.3058, MAX = 5;
  const LETTERS = ["A", "B", "C", "D", "E"], COLORS = ["#3b82f6", "#f97316", "#22c55e", "#a855f7", "#eab308"];
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 기억 없음 */ } },
  };
  let list = store.get("reHomeCmp", []);
  let kinds = store.get("reHomeCmpKinds", ["apt", "villa", "offi"]).filter(k => KIND[k]);
  if (!kinds.length) kinds = ["apt"];
  const num = v => { const n = Number(String(v ?? "").replace(/[, ]/g, "")); return Number.isFinite(n) ? n : 0; };
  const won = v => (v == null || !Number.isFinite(v) ? "–" : typeof fmtMan === "function" ? fmtMan(Math.round(v)) : `${Math.round(v).toLocaleString()}만`);
  const med = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const isoAgo = days => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const keyOf = p => `${p.kind}|${p.sgg_cd}|${p.umd_nm}|${p.place_key}`;
  const placeName = p => p.name || p.place_key;

  // ── 지역 고르기: 서울 구 / 경기 시(구가 있는 시는 "시 전체" + 구) ──
  const REG = [];                                           // { label, codes, group }
  {
    const cities = new Map();
    for (const [code, v] of Object.entries(SGG)) {
      if (v.sido === "서울") { REG.push({ label: `서울 ${v.name}`, codes: [code], group: "서울" }); continue; }
      const [city, gu] = v.name.split(" ");
      if (!cities.has(city)) cities.set(city, []);
      cities.get(city).push({ code, gu });
    }
    for (const [city, xs] of cities) {
      if (xs.length > 1 || xs[0].gu) {
        REG.push({ label: `${city} 전체`, codes: xs.map(x => x.code), group: "경기" });
        for (const x of xs) REG.push({ label: `${city} ${x.gu}`, codes: [x.code], group: "경기" });
      } else REG.push({ label: city, codes: [xs[0].code], group: "경기" });
    }
  }
  const regIdxOf = code => REG.findIndex(r => r.codes.length === 1 && r.codes[0] === code);
  let reg = -1, dong = "", q = "", res = null, resSeq = 0, resTimer = 0;

  // ── 탭·칸 ──
  const tabs = document.querySelector(".side-tabs"), anchor = document.getElementById("pane-finder") || document.getElementById("pane-impact") || document.getElementById("pane-stats");
  if (!tabs || !anchor) return;
  const btn = el("button", null, "집 비교"); btn.type = "button"; btn.setAttribute("role", "tab"); btn.dataset.tab = "homecmp";
  tabs.append(btn);
  const pane = el("section", "pane rf hc"); pane.id = "pane-homecmp"; pane.setAttribute("role", "tabpanel"); pane.hidden = true;
  anchor.after(pane);
  let active = false;
  const prevShow = showTab;
  showTab = function (name, ...rest) {
    if (name === "homecmp") {
      const r = prevShow.call(this, name, ...rest);          // 다른 탭(내 집 찾기·영향·예측)을 끄고 기본 칸을 숨김, "← 돌아가기"가 이 탭으로
      active = true; pane.hidden = false;
      for (const b of document.querySelectorAll(".side-tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === "homecmp"));
      store.set("reHomeCmpTab", 1);
      render();
      return r;
    }
    if (name !== "detail" || active) { active = false; pane.hidden = true; }
    if (name !== "detail") { try { localStorage.removeItem("reHomeCmpTab"); } catch { /* 기억 없음 */ } }
    return prevShow.call(this, name, ...rest);
  };
  btn.addEventListener("click", () => showTab("homecmp"));
  // 이 탭에서 지도의 동을 누르면: 목록 탭으로 안 넘어가고, 그 동의 집 목록을 아래 "담을 집 고르기"에
  if (typeof openDong === "function") {
    const baseDong = openDong;
    openDong = function (d, move = true, stay = false, ...rest) {
      const r = baseDong.call(this, d, move, active ? true : stay, ...rest);
      if (active && d?.sgg_cd) {
        const i = regIdxOf(d.sgg_cd);
        if (i >= 0) { reg = i; dong = d.umd_nm || ""; q = ""; if (d.kind && !kinds.includes(d.kind)) { kinds = [...kinds, d.kind]; store.set("reHomeCmpKinds", kinds); } render(); find(); }
      }
      return r;
    };
  }
  // 단지·건물 상세 화면에 "☆ 집 비교에 담기"
  if (typeof openPlace === "function") {
    const baseOpen = openPlace;
    openPlace = async function (p, ...rest) {
      const r = await baseOpen.call(this, p, ...rest);
      try {
        const box = document.getElementById("detail"), sub = box?.querySelector("p.sub");
        if (sub && p?.place_key && !box.querySelector(".hc-add")) {
          const b = el("button", "rf-add hc-add"); b.type = "button";
          const go = el("button", "rf-add hc-add", "🏠 집 비교 보기"); go.type = "button";
          go.addEventListener("click", () => showTab("homecmp"));
          const sync = () => { const inL = list.some(x => keyOf(x) === keyOf(p)); b.textContent = inL ? `🏠 집 비교에 담음 ${list.length}/${MAX} (빼기)` : `🏠 집 비교에 담기 ${list.length}/${MAX}`; b.classList.toggle("on", inL); go.hidden = !list.length; };
          b.addEventListener("click", () => { toggle(p); sync(); });
          sync();
          const after = [...box.querySelectorAll(".rf-add, .rf-ai-detail")].filter(x => !x.classList.contains("rf-ai-detail")).at(-1) || sub;
          after.after(b, go);
        }
      } catch (e) { console.warn("re-homecmp", e); }
      return r;
    };
  }
  function toggle(p) {
    const i = list.findIndex(x => keyOf(x) === keyOf(p));
    if (i >= 0) list.splice(i, 1);
    else {
      if (list.length >= MAX) { alert(`집 비교는 최대 ${MAX}개까지예요. 담은 집 하나를 먼저 빼 주세요.`); return false; }
      list.push({ kind: p.kind, sgg_cd: p.sgg_cd, umd_nm: p.umd_nm, place_key: p.place_key, name: p.name || null, build_year: p.build_year ?? null, pyeong_12m: p.pyeong_12m ?? null, trades_12m: p.trades_12m ?? null });
    }
    store.set("reHomeCmp", list);
    if (active) render();
    return true;
  }

  // ── 그리기 ──
  const aiBox = el("div", "rf-ai"); aiBox.id = "hcAi";
  function render() {
    if (!active) return;
    const parts = [el("p", "rf-note", `재산·대출 조건과 상관없이, 고른 집끼리(최대 ${MAX}개) 나란히 비교해요. 서로 다른 지역(예: 안양 집과 용인 집)도 돼요. 숫자는 국토부 실거래·신규 전세·건축물대장으로 바로 계산해요(무료). 투자 자문이 아니에요.`)];
    parts.push(pickBox());
    const nb = el("div", "rf-cmpnum"); nb.id = "hcNum";
    parts.push(nb, aiBox);
    pane.replaceChildren(...parts);
    if (res) drawRes();
    fill();
  }
  function pickBox() {
    const box = el("div", "rf-box");
    box.append(el("div", "rf-h", `🏠 담을 집 고르기 · 담은 집 ${list.length}/${MAX}`));
    if (list.length) {                                       // 담은 집 칩: ✕ 로 하나씩 빼기 + 모두 빼기
      const bk = el("div", "rf-bchips");
      list.forEach((p, i) => {
        const c = el("span", "rf-bchip"); const tag = el("span", "rf-letter", LETTERS[i] || "·"); tag.style.background = COLORS[i] || "#6b7280";
        const x = el("button", "rf-bx", "✕"); x.type = "button"; x.title = `${placeName(p)} 빼기`; x.setAttribute("aria-label", `${placeName(p)} 빼기`);
        x.addEventListener("click", () => toggle(p));
        c.append(tag, el("span", null, placeName(p)), x); bk.append(c);
      });
      if (list.length > 1) { const all = el("button", "rf-ball", "모두 빼기"); all.type = "button"; all.addEventListener("click", () => { if (!confirm(`담은 집 ${list.length}개를 모두 뺄까요?`)) return; list.splice(0); store.set("reHomeCmp", list); render(); }); bk.append(all); }
      box.append(bk);
    }
    const kc = el("div", "rf-chips");
    for (const k of ["apt", "villa", "offi"]) {
      if (!KIND[k]) continue;
      const b = el("button", kinds.includes(k) ? "on" : null, KIND[k].name); b.type = "button";
      b.addEventListener("click", () => { kinds = kinds.includes(k) ? kinds.filter(x => x !== k) : [...kinds, k]; if (!kinds.length) kinds = [k]; store.set("reHomeCmpKinds", kinds); render(); find(); });
      kc.append(b);
    }
    const row = el("div", "hc-pick");
    const rs = el("select"); rs.setAttribute("aria-label", "지역");
    rs.append(Object.assign(el("option", null, "지역 전체"), { value: "-1" }));
    for (const g of ["서울", "경기"]) {
      const og = el("optgroup"); og.label = g;
      REG.forEach((r, i) => { if (r.group === g) og.append(Object.assign(el("option", null, r.label), { value: String(i) })); });
      rs.append(og);
    }
    rs.value = String(reg);
    const ds = el("select"); ds.setAttribute("aria-label", "동");
    ds.append(Object.assign(el("option", null, "동 전체"), { value: "" }));
    if (reg >= 0 && typeof dongs !== "undefined") {
      const codes = new Set(REG[reg].codes);
      for (const n of [...new Set(dongs.filter(d => codes.has(d.sgg_cd)).map(d => d.umd_nm))].sort((a, b) => a.localeCompare(b, "ko"))) ds.append(Object.assign(el("option", null, n), { value: n }));
    }
    ds.value = dong; ds.disabled = reg < 0;
    rs.addEventListener("change", () => { reg = Number(rs.value); dong = ""; render(); find(); });
    ds.addEventListener("change", () => { dong = ds.value; find(); });
    const inp = el("input", "rf-q"); inp.type = "search"; inp.placeholder = "단지·건물 이름 (비우면 그 지역에서 거래 많은 순)"; inp.value = q; inp.setAttribute("aria-label", "단지·건물 이름");
    inp.addEventListener("input", () => { q = inp.value; clearTimeout(resTimer); resTimer = setTimeout(find, 300); });
    row.append(rs, ds);
    const out = el("div", "rf-addres"); out.id = "hcRes";
    box.append(kc, row, inp, out, el("p", "rf-note", "이 탭에서 지도의 동을 눌러도 그 동의 집이 여기 나와요. 단지 상세 화면의 '🏠 집 비교에 담기'로도 담을 수 있어요."));
    return box;
  }
  async function find() {
    const name = q.trim().replace(/[%_*,()\\]/g, " ").replace(/\s+/g, " ");
    const my = ++resSeq, out = document.getElementById("hcRes");
    if (reg < 0 && name.length < 2) { res = null; if (out) out.replaceChildren(el("p", "rf-note", "지역을 고르거나 이름을 두 글자 이상 넣으세요.")); return; }
    if (out) out.replaceChildren(el("p", "rf-note", "찾는 중…"));
    let qq = db.from("re_places").select("kind,sgg_cd,umd_nm,place_key,name,build_year,trades_12m,last_date,last_price,last_area,pyeong_12m").in("kind", kinds);
    if (reg >= 0) qq = qq.in("sgg_cd", REG[reg].codes);
    if (dong) qq = qq.eq("umd_nm", dong);
    if (name.length >= 1) qq = qq.ilike("name", `%${name}%`);
    const { data, error } = await qq.order("trades_12m", { ascending: false }).limit(40);
    if (my !== resSeq) return;
    res = error ? { error: true } : { rows: data || [] };
    drawRes();
  }
  function drawRes() {
    const out = document.getElementById("hcRes");
    if (!out) return;
    if (res?.error) { out.replaceChildren(el("p", "rf-warn", "찾지 못했어요. 잠시 뒤 다시 해 주세요.")); return; }
    if (!res?.rows?.length) { out.replaceChildren(el("p", "rf-note", "맞는 단지·건물이 없어요.")); return; }
    const ul = el("ul", "rf-list hc-list");
    for (const r of res.rows) {
      const li = el("li"), inL = list.some(x => keyOf(x) === keyOf(r));
      const b = el("button", inL ? "rf-add on" : "rf-add", inL ? "★ 담음" : "＋ 담기"); b.type = "button";
      b.addEventListener("click", () => { toggle(r); drawRes(); });
      const nm = el("button", "rf-link", `${KIND[r.kind]?.name || r.kind} · ${placeName(r)}`); nm.type = "button"; nm.title = "상세 화면 열기";
      nm.addEventListener("click", () => openPlace(r));
      li.append(b, nm, el("small", null, `${SGG[r.sgg_cd]?.name || ""} ${r.umd_nm}${r.build_year ? ` · ${r.build_year}년` : ""} · 12개월 ${r.trades_12m ?? 0}건${r.pyeong_12m ? ` · 3.3㎡당 ${won(r.pyeong_12m)}` : ""}`));
      ul.append(li);
    }
    out.replaceChildren(ul, el("p", "rf-note", `거래 많은 순 ${res.rows.length}곳까지 보여요.`));
  }

  // ── 자료·계산 ──
  const cache = new Map();
  async function loadOne(p) {
    if (F()?.loadOne) return F().loadOne(p);                   // 내 집 찾기와 같은 읽기(10분 기억 공유)
    const k = keyOf(p), c = cache.get(k);
    if (c && Date.now() - c.at < 10 * 60e3) return c.d;
    const T = KIND[p.kind]?.table, since = isoAgo(3 * 365.25);
    const same = x => x.eq("kind", p.kind).eq("sgg_cd", p.sgg_cd).eq("umd_nm", p.umd_nm).eq("place_key", p.place_key);
    let tq = db.from(T).select("deal_date,excl_area,price,canceled").eq("sgg_cd", p.sgg_cd);
    tq = p.kind === "apt" ? tq.eq("apt_seq", p.place_key) : tq.eq("umd_nm", p.umd_nm).eq("jibun", p.place_key);
    const [tr, pl, jr, br] = await Promise.all([tq.gte("deal_date", since).order("deal_date", { ascending: false }).limit(1000),
      same(db.from("re_places").select("name,build_year,trades_12m,pyeong_12m")).maybeSingle(),
      same(db.from("re_rent_jeonse").select("deal_date,excl_area,deposit")).limit(3000),
      same(db.from("re_buildings").select("units,unit_label,dong_cnt,max_floor,use_apr,match")).maybeSingle()]);
    if (tr.error) throw tr.error;
    const d = { trades: tr.data || [], place: pl.data || null, jeonse: jr.data || [], bld: br.error || !br.data || br.data.match === "error" ? null : br.data };
    cache.set(k, { at: Date.now(), d });
    return d;
  }
  // 그 지역(시·구, 같은 종류) 흐름: 신고가 다 모인 최근 3달(이번·지난달 빼고) ㎡당 vs 1년 전 같은 3달 — re_monthly_stats
  const areaCache = new Map();
  function monthKey(back) { const d = new Date(Date.now() + 9 * 3600e3); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)).toISOString().slice(0, 10); }
  async function loadArea(kind, sgg) {
    const k = `${kind}|${sgg}`, c = areaCache.get(k);
    if (c) return c;
    const pr = (async () => {
      const { data, error } = await db.from("re_monthly_stats").select("ym,trades,median_price_m2").eq("kind", kind).eq("sgg_cd", sgg).gte("ym", monthKey(16)).order("ym");
      if (error || !data?.length) return null;
      const by = new Map(data.map(r => [String(r.ym).slice(0, 10), r]));
      const avg = backs => { let s = 0, n = 0; for (const b of backs) { const r = by.get(monthKey(b)); if (r?.trades && r.median_price_m2) { s += r.median_price_m2 * r.trades; n += r.trades; } } return n ? { m2: s / n, n } : null; };
      const now = avg([2, 3, 4]), ago = avg([14, 15, 16]);
      return now ? { ppy: now.m2 * PY, perMonth: now.n / 3, chg: ago ? (now.m2 / ago.m2 - 1) * 100 : null, from: monthKey(4).slice(0, 7), to: monthKey(2).slice(0, 7) } : null;
    })();
    areaCache.set(k, pr);
    return pr;
  }
  function sizeGroups(trades, since12) {
    const xs = trades.filter(t => Number(t.excl_area) > 0).map(t => ({ a: Number(t.excl_area), r: !t.canceled && String(t.deal_date) >= since12 })).sort((x, y) => x.a - y.a);
    const gs = [];
    for (const x of xs) { const g = gs.at(-1); if (g && x.a - g.max <= 3) { g.max = x.a; g.areas.push(x.a); g.n12 += x.r ? 1 : 0; } else gs.push({ min: x.a, max: x.a, areas: [x.a], n12: x.r ? 1 : 0 }); }
    return gs.map(g => ({ min: g.min, max: g.max, n: g.areas.length, n12: g.n12, mid: med(g.areas) }));
  }
  /** 비교 크기: 직접 고른 크기(area)가 있으면 그 크기 묶음, 없으면 최근 12개월 가장 많이 거래된 크기 */
  function sizeOf(p, trades, since12) {
    const groups = sizeGroups(trades, since12);
    if (!groups.length) { const A = Math.round(num(p.area) || 84); return { used: A, lo: A - 8, hi: A + 8, groups, g: null }; }
    const want = num(p.area);
    const dist = g => (want < g.min ? g.min - want : want > g.max ? want - g.max : 0);
    const g = want ? [...groups].sort((x, y) => dist(x) - dist(y) || y.n12 - x.n12 || y.n - x.n)[0]
      : [...groups].sort((x, y) => y.n12 - x.n12 || y.n - x.n)[0];
    const used = want && dist(g) === 0 ? Math.round(want) : Math.round(g.mid), t = used <= 40 ? 5 : 8;
    return { used, lo: Math.max(g.min, used - t) - 0.01, hi: Math.min(g.max, used + t) + 0.01, groups, g };
  }
  function metrics(p, d) {
    const d12 = isoAgo(365), d24 = isoAgo(730), sz = sizeOf(p, d.trades, d12), A = sz.used, inSize = a => Number(a) >= sz.lo && Number(a) <= sz.hi;
    const ok = d.trades.filter(t => !t.canceled && Number(t.excl_area) > 0 && t.price > 0);
    const ppy = t => t.price / Number(t.excl_area) * PY;
    const y1 = ok.filter(t => t.deal_date >= d12), y0 = ok.filter(t => t.deal_date < d12 && t.deal_date >= d24);
    const ppy12 = med(y1.map(ppy)) ?? d.place?.pyeong_12m ?? p.pyeong_12m ?? null, ppyPrev = med(y0.map(ppy));
    const qm = new Map();
    for (const t of ok) { const k = `${t.deal_date.slice(0, 4)}-${Math.floor((Number(t.deal_date.slice(5, 7)) - 1) / 3)}`; (qm.get(k) || qm.set(k, []).get(k)).push(ppy(t)); }
    const quarters = [...qm].map(([k, xs]) => ({ k, v: med(xs), n: xs.length })).sort((a, b) => (a.k < b.k ? -1 : 1));
    const peak = quarters.length ? Math.max(...quarters.map(x => x.v)) : null;
    const near = y1.filter(t => inSize(t.excl_area)), nearAll = ok.filter(t => inSize(t.excl_area));
    const nearMed = near.length >= 3 ? med(near.map(t => t.price / Number(t.excl_area) * A)) : null;
    const price = nearMed ?? (ppy12 ? ppy12 * A / PY : null);
    const jn = d.jeonse.filter(j => Number(j.excl_area) >= sz.lo - 1 && Number(j.excl_area) <= sz.hi + 1);
    const jeonse = jn.length ? med(jn.map(j => j.deposit / Number(j.excl_area))) * A : null;
    const zone = R()?.zoneOf?.(p.sgg_cd);
    return { A, sz, ppy12, chg: ppy12 && ppyPrev ? (ppy12 / ppyPrev - 1) * 100 : null, fromPeak: ppy12 && peak ? (ppy12 / peak - 1) * 100 : null,
      price, priceBasis: nearMed != null ? `이 크기 거래 ${near.length}건 중간값` : "3.3㎡당 × 면적 추정", n12: y1.length, nSize12: near.length, lastSize: nearAll[0] || null,
      cx12: d.trades.filter(t => t.canceled && t.deal_date >= d12).length, last: ok[0] || null, jeonse, jn: jn.length,
      ratio: jeonse && price ? jeonse / price * 100 : null, quarters, zone, bld: d.bld, built: d.place?.build_year ?? p.build_year ?? null };
  }
  // 권역 AI 예측(있으면)
  const forecasts = {};
  const fcReady = (async () => {
    try {
      const n = await db.from("re_ai_notes").select("day").order("day", { ascending: false }).limit(1);
      if (!n.error && n.data?.[0]) { const f = await db.from("re_forecasts").select("zone,call,prob").eq("day", n.data[0].day); for (const x of f.data || []) forecasts[x.zone] = x; }
    } catch { /* 없어도 됨 */ }
  })();

  let seq = 0;
  async function fill() {
    const box = document.getElementById("hcNum");
    if (!box) return;
    if (!list.length) { box.replaceChildren(el("p", "rf-note", "아직 담은 집이 없어요. 위에서 지역·이름으로 찾아 '＋ 담기'를 누르세요.")); return; }
    const my = ++seq, items = list.slice();
    box.replaceChildren(el("p", "rf-note", `담은 집 ${items.length}개 자료 불러오는 중…`));
    let ds, areas;
    try { [ds, areas] = await Promise.all([Promise.all(items.map(loadOne)), Promise.all(items.map(p => loadArea(p.kind, p.sgg_cd).catch(() => null))), fcReady]); }
    catch (e) { if (my === seq) { const b = document.getElementById("hcNum"); if (b) b.replaceChildren(el("p", "rf-warn", `불러오지 못했어요: ${e.message || e}`)); } return; }
    if (my !== seq) return;
    const b = document.getElementById("hcNum");
    if (!b) return;
    const ms = items.map((p, i) => metrics(p, ds[i]));
    b.replaceChildren(table(items, ms, areas), chart(items, ms),
      el("p", "rf-note", "예상 가격 = 최근 12개월 그 집의 같은 크기 거래(3건 이상)를 비교 크기로 맞춘 중간값, 모자라면 3.3㎡당 중간값 × 면적. 신규 전세도 같은 크기. 그 지역 흐름은 시·구 전체(같은 종류)의 ㎡당 중간값 — 이번·지난달은 신고가 덜 모여 뺐어요. 층·향·상태·실제 매물가는 다를 수 있어요."));
  }
  function table(items, ms, areas) {
    const pc = v => (v == null ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);
    const vsA = (v, i, base) => (i && v && base ? el("small", "rf-note", ` (A보다 ${pc((v / base - 1) * 100)})`) : null);
    const tbl = el("table", "rf-cmp-t rf-cmp-num");
    const row = (k, f, cls) => { const tr = el("tr", cls || null); tr.append(el("th", null, k), ...items.map((p, i) => { const td = el("td"); const v = f(p, ms[i], i); if (v instanceof Node) td.append(v); else td.textContent = v ?? "–"; return td; })); tbl.append(tr); };
    const hr = el("tr");
    hr.append(el("th"), ...items.map((p, i) => {
      const th = el("th"), nm = el("button", "rf-link", placeName(p)); nm.type = "button"; nm.title = "상세 화면 열기"; nm.addEventListener("click", () => openPlace(p));
      const tag = el("span", "rf-letter", LETTERS[i]); tag.style.background = COLORS[i];
      const acts = el("div", "rf-acts");
      if (F()?.analyze) { const ai = el("button", "rf-x", "🤖 AI 분석"); ai.type = "button"; ai.title = "이 집 하나를 AI 가 자세히 분석(하루 20번, 같은 집 7일 안은 저장본)"; ai.addEventListener("click", () => { F().analyze({ ...p, area: ms[i].A, areaFromCard: true }, false, "hcAi"); aiBox.scrollIntoView({ behavior: "smooth", block: "start" }); }); acts.append(ai); }
      if (i) { const up = el("button", "rf-x", "◀"); up.type = "button"; up.title = "앞으로"; up.addEventListener("click", () => { list.splice(i - 1, 0, list.splice(i, 1)[0]); store.set("reHomeCmp", list); render(); }); acts.append(up); }
      const rm = el("button", "rf-x rf-rm", "✕ 빼기"); rm.type = "button"; rm.addEventListener("click", () => toggle(p));
      acts.append(rm);
      th.append(tag, nm, acts);
      return th;
    }));
    tbl.append(hr);
    row("종류·위치", p => `${KIND[p.kind]?.name || p.kind} · ${SGG[p.sgg_cd]?.sido || ""} ${SGG[p.sgg_cd]?.name || ""} ${p.umd_nm}`);
    row("권역", (p, m) => m.zone?.name || "–");
    row("준공·규모", (p, m) => [m.built ? `${m.built}년` : null, m.bld?.units ? `${m.bld.units.toLocaleString()}${m.bld.unit_label || "세대"}` : null, m.bld?.dong_cnt ? `${m.bld.dong_cnt}개 동` : null, m.bld?.max_floor ? `최고 ${m.bld.max_floor}층` : null].filter(Boolean).join(" · ") || "–");
    row("비교 크기 (전용)", (p, m, i) => {
      const w = el("span", "hc-size");
      w.append(el("b", null, `${m.A}㎡`), el("small", "rf-note", `${p.kind === "apt" ? ` 약 ${Math.round(m.A * 1.33 / PY)}평형` : ` 약 ${Math.round(m.A / PY)}평`} · 이 크기 12개월 ${m.nSize12}건`));
      const gs = m.sz.groups.filter(g => g.n12 > 0);
      const show = (gs.length ? gs : m.sz.groups).slice(0, 8);
      if (show.length > 1) {
        const ch = el("span", "rf-chips hc-chips");
        for (const g of show) {
          const lab = Math.round(g.min) === Math.round(g.max) ? `${Math.round(g.min)}` : `${Math.round(g.min)}~${Math.round(g.max)}`;
          const on = m.sz.g === g;
          const b = el("button", on ? "on" : null, `${lab}㎡ ${g.n12}건`); b.type = "button"; b.title = "이 크기로 비교";
          b.addEventListener("click", () => { const x = list[i]; if (x) { x.area = Math.round(g.mid); store.set("reHomeCmp", list); fill(); } });
          ch.append(b);
        }
        w.append(ch);
      }
      return w;
    });
    row("예상 매매가 (비교 크기)", (p, m, i) => { const s = el("span"); s.append(el("b", null, won(m.price))); const v = vsA(m.price, i, ms[0].price); if (v) { if (Math.abs(m.A - ms[0].A) > 5) v.textContent = v.textContent.replace(/\)$/, " · 크기 다름)"); s.append(v); } s.append(el("small", "rf-note", ` · ${m.priceBasis}`)); return s; }, "rf-strong");
    row("3.3㎡당 (최근 12개월, 모든 크기)", (p, m, i) => { const s = el("span", null, won(m.ppy12)); const v = vsA(m.ppy12, i, ms[0].ppy12); if (v) s.append(v); return s; });
    row("1년 전보다 (3.3㎡당)", (p, m) => pc(m.chg));
    row("3년 중 가장 높던 분기보다", (p, m) => pc(m.fromPeak));
    row("거래 (12개월 · 해제)", (p, m) => `${m.n12}건 · 해제 ${m.cx12}`);
    row("이 크기 마지막 거래", (p, m) => (m.lastSize ? `${won(m.lastSize.price)} · ${Math.round(Number(m.lastSize.excl_area))}㎡ · ${m.lastSize.deal_date.slice(2).replaceAll("-", ".")}` : "–"));
    row("전세가 (신규, 비교 크기)", (p, m) => (m.jeonse ? `${won(m.jeonse)} (${m.jn}건)` : "거래 없음"));
    row("갭 (매매 − 전세)", (p, m) => (m.price && m.jeonse ? (() => { const g = m.price - m.jeonse, s = el("span", g <= 0 ? "rf-bad" : null, won(g)); if (m.ratio >= 80) s.append(el("small", "rf-bad", " 전세가율 80%↑ 위험")); return s; })() : "–"), "rf-strong");
    row("전세가율", (p, m) => (m.ratio != null ? `${Math.round(m.ratio)}%` : "–"));
    row("그 지역 흐름 (시·구, 같은 종류)", (p, m, i) => {
      const a = areas[i];
      if (!a) return "–";
      const s = el("span");
      s.append(`3.3㎡당 ${won(a.ppy)}`, el("small", "rf-note", ` · 1년 전보다 ${pc(a.chg)} · 월 ${Math.round(a.perMonth).toLocaleString()}건 (${a.from}~${a.to})`));
      return s;
    });
    if (items.some(p => { const z = R()?.zoneOf?.(p.sgg_cd); return z && forecasts[z.id]; })) {
      row("권역 AI 예측 (3개월, 권역 전체)", (p, m) => { const fc = m.zone && forecasts[m.zone.id]; return fc ? el("span", `rf-fc ${fc.call}`, `${fc.call === "up" ? "▲ 상승" : "▼ 하락"} 확률 ${fc.prob}%`) : "–"; });
    }
    const wrap = el("div", "rf-cmp-wrap"); wrap.append(tbl);
    return wrap;
  }
  function chart(items, ms) {
    const keys = [...new Set(ms.flatMap(m => m.quarters.map(x => x.k)))].sort();
    const box = el("div", "rf-chart");
    box.append(el("div", "rf-h", "📈 3.3㎡당 가격 흐름 (분기별 중간값, 최근 3년)"));
    if (keys.length < 2) { box.append(el("p", "rf-note", "그래프를 그릴 거래가 모자라요.")); return box; }
    const vals = ms.flatMap(m => m.quarters.map(x => x.v)), lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.08 || hi * 0.05;
    const W = 640, H = 260, L = 86, Rt = 12, T = 12, B = 30;
    const x = i => L + (W - L - Rt) * (keys.length === 1 ? 0.5 : i / (keys.length - 1)), y = v => T + (H - T - B) * (1 - (v - (lo - pad)) / ((hi + pad) - (lo - pad)));
    const NS = "http://www.w3.org/2000/svg", mk = (t, a) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
    const svg = mk("svg", { viewBox: `0 0 ${W} ${H}`, class: "rf-svg", role: "img", "aria-label": "담은 집 3.3㎡당 가격 흐름" });
    for (let i = 0; i <= 3; i++) {
      const v = lo - pad + ((hi + pad) - (lo - pad)) * i / 3, yy = y(v);
      svg.append(mk("line", { x1: L, x2: W - Rt, y1: yy, y2: yy, class: "rf-grid-l" }));
      const t = mk("text", { x: L - 8, y: yy + 6, "text-anchor": "end", class: "rf-ax" }); t.textContent = typeof fmtShort === "function" ? fmtShort(v) : Math.round(v); svg.append(t);
    }
    keys.forEach((k, i) => { if (k.endsWith("-0")) { const t = mk("text", { x: x(i), y: H - 6, "text-anchor": "start", class: "rf-ax" }); t.textContent = `${k.slice(0, 4)}년`; svg.append(t); } });
    ms.forEach((m, j) => {
      const pts = m.quarters.map(z => [x(keys.indexOf(z.k)), y(z.v), z]);
      if (pts.length > 1) svg.append(mk("polyline", { points: pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "), fill: "none", stroke: COLORS[j], "stroke-width": 3, "stroke-linejoin": "round" }));
      for (const [px, py, z] of pts) { const c = mk("circle", { cx: px, cy: py, r: 4.5, fill: COLORS[j] }); const tt = mk("title", {}); tt.textContent = `${LETTERS[j]} ${placeName(items[j])} · ${z.k.slice(0, 4)}년 ${Number(z.k.slice(5)) + 1}분기 · 3.3㎡당 ${won(z.v)} (${z.n}건)`; c.append(tt); svg.append(c); }
    });
    const lg = el("div", "rf-legend");
    items.forEach((p, j) => { const s = el("span"); const dot = el("i"); dot.style.background = COLORS[j]; s.append(dot, `${LETTERS[j]} ${placeName(p)}`); lg.append(s); });
    box.append(svg, lg, el("p", "rf-note", "점에 마우스를 올리면 그 분기 값·거래 수가 보여요. 거래가 적은 분기는 값이 크게 튈 수 있어요."));
    return box;
  }

  try {
    if (store.get("reHomeCmpTab", 0) && !new URLSearchParams(location.search).get("sgg")) {
      let n = 0;
      const t = setInterval(() => { if (++n > 120) return clearInterval(t); if (document.getElementById("app")?.hidden) return; clearInterval(t); showTab("homecmp"); }, 500);
    }
  } catch { /* 기억 없음 */ }
  globalThis.REHOMECMP = { get list() { return list; }, toggle, render, metrics, sizeOf };

  const css = document.createElement("style");
  css.textContent = `
.hc-pick { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.hc-pick select { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: inherit; font-size: 13px; }
.hc-list { max-height: 320px; overflow-y: auto; }
.hc-list .rf-link { font-weight: 700; font-size: 12.5px; }
.hc-size { display: grid; gap: 3px; }
.hc-chips button { font-size: 11px; padding: 1px 8px; }
#detail .hc-add { margin: 4px 6px 6px 0; font-size: 12.5px; padding: 4px 12px; }
#detail .hc-add.on { border-color: #22c55e; color: #22c55e; font-weight: 700; }`;
  document.head.append(css);
})();
