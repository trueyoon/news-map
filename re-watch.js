// ★ 관심 단지 + 새 소식 알림 (사용자 2026-11-25 "관심 단지 알림부터" — 부동산 아이디어 2차 ①)
// - re-impact.js 가 불러옴(real-estate.html 수정 없음). 단지·건물 상세 화면에 [☆ 관심 단지] 단추(openPlace 감쌈)
// - 첫 화면 요약(re-front.js 가 REWATCH.front 호출) 맨 위 "★ 관심 단지": 단지마다 새로 들어온 거래(collected_at 이 마지막으로 본 뒤)·그중 신고가
//   (아파트는 re_new_highs, 빌라·오피스텔은 그 자리에서 같은 크기 그 전 최고가와 비교)·새로 해제된 거래(cancel_date)·새 신규 전세 계약(rent_key)·그 지역 새 부동산 소식(re_news_days)
//   + 최근 30일 거래 수·마지막 거래. 머리 줄 [📋 이번 주 요약] 단추에 "★ 새 N" 배지
// - "본 것"으로 치는 때: 그 단지 상세 화면을 열 때, 또는 [모두 확인함]. 처음 담을 때는 그때까지를 본 것으로
// - 저장: 이 브라우저에만(localStorage reWatch — 휴대폰·PC 따로). 최대 20곳. 데이터베이스에는 저장하지 않음
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined" || typeof KIND === "undefined") return;
  const MAX = 20, H = 3600e3;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 기억 없음 */ } },
  };
  let list = store.get("reWatch", []);
  const save = () => store.set("reWatch", list);
  const keyOf = p => `${p.kind}|${p.sgg_cd}|${p.umd_nm}|${p.place_key}`;
  const find = p => list.find(x => keyOf(x) === keyOf(p));
  const won = v => (v == null || !Number.isFinite(v) ? "–" : typeof fmtWon === "function" ? fmtWon(Math.round(v)) : `${Math.round(v).toLocaleString()}만`);
  const kstDay = (t = Date.now()) => new Date(t + 9 * H).toISOString().slice(0, 10);
  const daysAgo = n => kstDay(Date.now() - n * 864e5);
  const md = s => String(s).slice(5, 10).replace("-", "/");
  const nameOf = p => (p.kind === "apt" ? p.name || p.place_key : p.name && !String(p.name).startsWith("(") ? p.name : `${p.place_key}번지`);
  const sggName = c => `${SGG[c]?.sido === "서울" ? "서울 " : ""}${SGG[c]?.name || c}`;
  const cityOf = c => (c.startsWith("41") && !c.endsWith("0") ? `${c.slice(0, 4)}0` : null);   // 구가 있는 경기 시(41111 → 41110)

  // ── 자료 ──
  const cache = new Map();                                     // 단지 열쇠 → { at, p: Promise }
  async function loadOne(w) {
    const T = KIND[w.kind]?.table, since = daysAgo(w.kind === "apt" ? 400 : 1100);
    let q = db.from(T).select("deal_date,trade_key,excl_area,floor,price,canceled,cancel_date,collected_at").eq("sgg_cd", w.sgg_cd);
    q = w.kind === "apt" ? q.eq("apt_seq", w.place_key) : q.eq("umd_nm", w.umd_nm).eq("jibun", w.place_key);
    let jq = db.from("re_rent_jeonse").select("deal_date,rent_key,excl_area,deposit,floor").eq("kind", w.kind).eq("sgg_cd", w.sgg_cd).eq("place_key", w.place_key).eq("contract", "new").gte("deal_date", daysAgo(90));
    if (w.kind !== "apt") jq = jq.eq("umd_nm", w.umd_nm);
    const [tr, jr, hr] = await Promise.all([
      q.gte("deal_date", since).order("deal_date", { ascending: false }).limit(1500),
      jq.order("deal_date", { ascending: false }).limit(300),
      w.kind === "apt" ? db.from("re_new_highs").select("trade_key,prev_max").eq("sgg_cd", w.sgg_cd).eq("apt_seq", w.place_key).gte("deal_date", daysAgo(120)) : Promise.resolve({ data: [] })]);
    if (tr.error) throw tr.error;
    return { trades: tr.data || [], jeonse: jr.data || [], highs: new Map((hr.data || []).map(h => [String(h.trade_key), h.prev_max])) };
  }
  function get(w, force) {
    const k = keyOf(w), c = cache.get(k);
    if (!force && c && Date.now() - c.at < 10 * 60e3) return c.p;
    const p = loadOne(w); cache.set(k, { at: Date.now(), p }); p.catch(() => cache.delete(k));
    return p;
  }
  let newsP = null, newsAt = 0;
  function news() {
    if (newsP && Date.now() - newsAt < H) return newsP;
    newsAt = Date.now();
    newsP = db.from("re_news_days").select("day,region,theme,n,top").gte("day", daysAgo(21)).order("day", { ascending: false }).limit(1000).then(r => r.data || [], () => []);
    return newsP;
  }
  /** 단지 하나의 새 소식 계산 */
  function digest(w, d, nd) {
    const seenT = w.seenAt || w.added, seenDay = kstDay(Date.parse(seenT));
    const ok = d.trades.filter(t => !t.canceled);
    const isHigh = t => {
      if (w.kind === "apt") return d.highs.has(String(t.trade_key));
      const a = Math.round(Number(t.excl_area)), prior = ok.filter(x => Math.round(Number(x.excl_area)) === a && x.deal_date < t.deal_date);
      return prior.length >= 3 && t.price > Math.max(...prior.map(x => x.price));
    };
    const recentDeal = kstDay(Date.parse(seenT) - 60 * 864e5);   // 다시 받으면서 번호가 바뀐 옛 거래(계약이 두 달 넘게 지난 것)는 새 거래로 안 셈
    const fresh = d.trades.filter(t => t.collected_at && t.collected_at > seenT && t.deal_date >= recentDeal).map(t => ({ ...t, high: !t.canceled && isHigh(t) }));
    const cancels = d.trades.filter(t => t.canceled && t.cancel_date && t.cancel_date >= seenDay && !(t.collected_at > seenT));
    const seenRent = new Set(w.seenRent || []);
    const rents = d.jeonse.filter(r => !seenRent.has(String(r.rent_key)));
    const keys = new Set([w.sgg_cd, cityOf(w.sgg_cd)].filter(Boolean));
    const nws = nd.filter(x => keys.has(x.region) && x.day >= seenDay);
    const d30 = daysAgo(30), last = ok[0] || null;
    return { fresh, cancels, rents, news: nws, n30: ok.filter(t => t.deal_date >= d30).length, last,
      count: fresh.length + cancels.length + rents.length + (nws.length ? 1 : 0), highs: fresh.filter(t => t.high).length };
  }
  function markSeen(w, d) {
    w.seenAt = new Date().toISOString();
    if (d) w.seenRent = d.jeonse.map(r => String(r.rent_key)).slice(0, 200);
    save(); badge();
  }

  // ── 담기·빼기 ──
  async function toggle(p) {
    const i = list.findIndex(x => keyOf(x) === keyOf(p));
    if (i >= 0) { list.splice(i, 1); save(); badge(); return false; }
    if (list.length >= MAX) { alert(`관심 단지는 ${MAX}곳까지예요. 하나를 먼저 빼 주세요.`); return null; }
    const w = { kind: p.kind, sgg_cd: p.sgg_cd, umd_nm: p.umd_nm, place_key: p.place_key, name: p.name || null, added: new Date().toISOString() };
    list.push(w); save();
    try { const d = await get(w, true); markSeen(w, d); } catch { /* 다음에 */ }
    return true;
  }
  if (typeof openPlace === "function") {
    const baseOpen = openPlace;
    openPlace = async function (p, ...rest) {
      const r = await baseOpen.call(this, p, ...rest);
      try {
        const box = document.getElementById("detail"), sub = box?.querySelector("p.sub");
        if (sub && p?.place_key && !box.querySelector(".rw-star")) {
          const b = el("button", "rf-add rw-star"); b.type = "button";
          const sync = () => { const on = !!find(p); b.textContent = on ? "★ 관심 단지 (빼기)" : "☆ 관심 단지로 담기"; b.classList.toggle("on", on); b.title = on ? "새 거래·신고가·해제·전세·지역 소식을 첫 화면 요약에서 알려 줘요" : `최대 ${MAX}곳 · 이 브라우저에만 저장`; };
          b.addEventListener("click", async () => { await toggle(p); sync(); });
          sync(); sub.after(b);
        }
        const w = find(p);
        if (w) get(w, true).then(d => markSeen(w, d)).catch(() => {});   // 상세를 열면 본 것으로
      } catch (e) { console.warn("re-watch", e); }
      return r;
    };
  }

  // ── 머리 줄 배지 ──
  let lastTotal = 0;
  async function badge() {
    const btn = document.querySelector(".rfn-open");
    if (!btn) return;
    let tag = btn.querySelector(".rw-badge");
    if (!list.length) { tag?.remove(); return; }
    try {
      const nd = await news();
      const ds = await Promise.all(list.map(w => get(w).then(d => digest(w, d, nd)).catch(() => null)));
      lastTotal = ds.reduce((s, x) => s + (x?.count || 0), 0);
      if (!tag) { tag = el("span", "rw-badge"); btn.append(tag); }
      tag.textContent = lastTotal ? ` ★ 새 ${lastTotal}` : " ★";
      tag.classList.toggle("on", lastTotal > 0);
    } catch { /* 배지만 */ }
  }

  // ── 첫 화면 요약 칸 ──
  async function front(host, { sec, close }) {
    if (!list.length) {
      const s = sec("★ 관심 단지", "");
      s.append(el("p", "rfn-note", "단지·건물 상세 화면에서 '☆ 관심 단지로 담기'를 누르면, 새 거래·신고가·해제·새 전세·지역 소식을 여기서 알려 드려요(최대 20곳, 이 브라우저에만 저장)."));
      host.replaceWith(s); return;
    }
    try {
      const nd = await news();
      const rows = await Promise.all(list.map(w => get(w).then(d => ({ w, d, g: digest(w, d, nd) })).catch(() => ({ w, err: true }))));
      if (!host.isConnected) return;
      const total = rows.reduce((s, x) => s + (x.g?.count || 0), 0);
      const s = sec("★ 관심 단지", `${list.length}곳 · 새 소식 ${total}건`);
      const l = el("div", "rw-list");
      rows.sort((a, b) => (b.g?.count || 0) - (a.g?.count || 0));
      for (const { w, d, g, err } of rows) {
        const card = el("div", `rw-card${g?.count ? " new" : ""}`);
        const top = el("div", "rw-top");
        const nm = el("button", "rw-name", nameOf(w)); nm.type = "button"; nm.title = "상세 열기";
        nm.addEventListener("click", () => { close?.(); openPlace({ kind: w.kind, sgg_cd: w.sgg_cd, umd_nm: w.umd_nm, place_key: w.place_key, name: w.name }); });
        const x = el("button", "rw-x", "✕"); x.type = "button"; x.title = "관심 단지에서 빼기"; x.setAttribute("aria-label", `${nameOf(w)} 빼기`);
        x.addEventListener("click", () => { list = list.filter(y => keyOf(y) !== keyOf(w)); save(); badge(); card.remove(); });
        top.append(nm, el("small", null, `${KIND[w.kind]?.name || w.kind} · ${sggName(w.sgg_cd)} ${w.umd_nm}`), x);
        card.append(top);
        if (err) { card.append(el("small", "rfn-note", "불러오지 못했어요")); l.append(card); continue; }
        const info = el("div", "rw-info");
        info.append(el("small", null, `최근 30일 거래 ${g.n30}건${g.last ? ` · 마지막 ${won(g.last.price)} (${Math.round(Number(g.last.excl_area))}㎡ · ${md(g.last.deal_date)})` : ""}`));
        card.append(info);
        const ul = el("ul", "rw-new");
        for (const t of g.fresh.slice(0, 5)) ul.append(el("li", t.canceled ? "cx" : t.high ? "hi" : null,
          `${t.high ? "🔥 신고가 " : t.canceled ? "새 거래(해제됨) " : "새 거래 "}${won(t.price)} · ${Math.round(Number(t.excl_area))}㎡${t.floor != null ? ` · ${t.floor}층` : ""} · 계약 ${md(t.deal_date)}${t.high && d.highs.get(String(t.trade_key)) ? ` (전 최고 ${won(d.highs.get(String(t.trade_key)))})` : ""}`));
        if (g.fresh.length > 5) ul.append(el("li", null, `… 새 거래 ${g.fresh.length - 5}건 더`));
        for (const t of g.cancels.slice(0, 3)) ul.append(el("li", "cx", `⚠ 거래 해제 ${won(t.price)} · ${Math.round(Number(t.excl_area))}㎡ · 계약 ${md(t.deal_date)} → 해제 ${md(t.cancel_date)}`));
        if (g.rents.length) ul.append(el("li", "je", `🏠 새 전세 ${g.rents.length}건 · ${g.rents.slice(0, 2).map(r => `${won(r.deposit)} (${Math.round(Number(r.excl_area))}㎡)`).join(", ")}`));
        if (g.news.length) { const t = g.news.find(x => Array.isArray(x.top) && x.top[0])?.top[0]; const li = el("li", "nw", `📰 이 지역 부동산 소식 ${g.news.reduce((s, x) => s + x.n, 0)}건`); if (t?.t) { const a = el("a", null, ` ${t.t}`); a.href = t.u; a.target = "_blank"; a.rel = "noopener noreferrer"; li.append(a); } ul.append(li); }
        if (ul.childNodes.length) card.append(ul);
        else card.append(el("small", "rfn-note", `${md(w.seenAt || w.added)} 뒤로 새 소식 없음`));
        l.append(card);
      }
      const acts = el("div", "rw-acts");
      const all = el("button", "rfn-link", "모두 확인함"); all.type = "button";
      all.addEventListener("click", async () => { for (const r of rows) if (r.d) markSeen(r.w, r.d); const nx = el("div"); s.replaceWith(nx); front(nx, { sec, close }); });
      acts.append(all, el("small", "rfn-note", " · 단지 이름을 눌러 상세를 열어도 확인한 것으로 쳐요. 신고가는 같은 단지·같은 크기 그 전 최고가보다 비싼 거래."));
      s.append(l, acts);
      host.replaceWith(s);
    } catch (e) { console.warn("re-watch front", e?.message || e); host.remove(); }
  }
  globalThis.REWATCH = { front, toggle, get list() { return list; }, badge };
  // 배지: 요약 단추가 생긴 뒤 + 10분마다
  { let n = 0; const t = setInterval(() => { if (document.querySelector(".rfn-open") && !document.getElementById("app")?.hidden) { clearInterval(t); badge(); setInterval(badge, 10 * 60e3); } else if (++n > 120) clearInterval(t); }, 500); }

  const css = document.createElement("style");
  css.textContent = `
#detail .rw-star { margin: 4px 6px 6px 0; font-size: 12.5px; padding: 4px 12px; }
#detail .rw-star.on { border-color: #eab308; color: #eab308; font-weight: 700; }
.rw-badge { font-weight: 800; } .rw-badge.on { color: #fde047; }
.rw-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 6px; }
.rw-card { border: 1px solid var(--line); border-radius: 10px; padding: 7px 9px; display: grid; gap: 3px; font-size: 12.5px; }
.rw-card.new { border-color: #eab308; box-shadow: 0 0 0 1px color-mix(in srgb, #eab308 40%, transparent) inset; }
.rw-top { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; } .rw-top small { color: var(--muted); font-size: 11px; }
.rw-name { font: inherit; font-weight: 800; background: none; border: 0; padding: 0; color: var(--text); cursor: pointer; text-align: left; } .rw-name:hover { text-decoration: underline; }
.rw-x { margin-left: auto; font: inherit; font-size: 11px; border: 0; background: none; color: var(--muted); cursor: pointer; }
.rw-info small { color: var(--muted); font-size: 11.5px; }
.rw-new { list-style: none; margin: 2px 0 0; padding: 0; display: grid; gap: 2px; font-size: 12px; }
.rw-new li.hi { color: #f97316; font-weight: 700; } .rw-new li.cx { color: #f59e0b; } .rw-new li.nw a { color: var(--muted); text-decoration: none; } .rw-new li.nw a:hover { text-decoration: underline; }
.rw-acts { display: flex; flex-wrap: wrap; gap: 4px; align-items: baseline; }`;
  document.head.append(css);
})();
