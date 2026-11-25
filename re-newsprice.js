// 📚 뉴스 → 집값 기록 (사용자 2026-11-25 "뉴스에서 집값 기록도 이어서" — 부동산 아이디어 ③, 최종 목표 "사건 → 부동산 추론"의 재료)
// - re-impact.js 가 불러옴(real-estate.html 수정 없음). 자료는 SQL re_news_price.sql 의 표(매일 06:10 KST 계산):
//   re_news_events(지역 부동산 소식 = 한 시·구에 한 주제가 처음 나온 날, 30일 안 같은 지역·주제는 하나) · re_event_outcomes(그 뒤 30·90·180일 그 지역 아파트값,
//   같은 단지·크기끼리 비교, 같은 시·도 전체를 빼서 "시장 대비") · re_event_stats(주제별 다 끝난 기록의 성적)
// - 붙는 곳: ① [영향·예측] 탭의 권역 카드 아래 "📚 뉴스 → 집값 기록"(주제별 성적표 + 최근 소식과 진행 중 숫자, 주제 고르기 — 기억 reNpTheme)
//   ② 첫 화면 요약(re-front.js 가 RENEWSPRICE.front 호출) 한 칸. 표가 없으면 아무것도 안 붙음
// - 기간이 끝나고 신고(계약 후 30일)가 다 모이면(+35일) 확정. 그 전 숫자는 "진행 중"(거래가 덜 모여 흔들림). 원인을 뜻하지 않음 — 기록이 쌓여야 의미가 생김
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined") return;
  const H = 3600e3;
  const THEME = { market: "시장·가격", supply: "공급·분양", redevelop: "재건축·재개발", transit: "교통 호재", develop: "개발·산업", rule: "규제·세금", rate: "금리·대출", risk: "위험" };
  const COLOR = { market: "#a855f7", supply: "#22c55e", redevelop: "#f59e0b", transit: "#06b6d4", develop: "#3b82f6", rule: "#ec4899", rate: "#eab308", risk: "#ef4444" };
  const HZ = [30, 90, 180];
  const pc = (v, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);
  const pp = (v, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%p`);
  const cls = v => (v > 0 ? "up" : v < 0 ? "down" : "");
  const md = s => String(s).slice(5).replace("-", "/");
  const addDays = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  const codesOf = code => (SGG[code] ? [code] : Object.keys(SGG).filter(c => c.startsWith(code.slice(0, 4))));
  const nameOf = code => (SGG[code] ? `${SGG[code].sido === "서울" ? "서울 " : ""}${SGG[code].name}` : (SGG[codesOf(code)[0]]?.name || code).split(" ")[0]);
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 기억 없음 */ } },
  };

  // ── 자료(1시간 기억) ──
  let dataP = null, dataAt = 0;
  function load() {
    if (dataP && Date.now() - dataAt < H) return dataP;
    dataAt = Date.now();
    dataP = (async () => {
      const since = new Date(Date.now() + 9 * H - 60 * 864e5).toISOString().slice(0, 10);
      const ev = await db.from("re_news_events").select("id,day,region,theme,n7,n_src7,top").gte("day", since).order("day", { ascending: false }).limit(400);
      if (ev.error) throw ev.error;
      const [oc, st, first] = await Promise.all([
        db.from("re_event_outcomes").select("event_id,horizon,matched,chg,mkt_chg,excess,vol_before,vol_after,final,computed_at").in("event_id", (ev.data || []).map(e => e.id).slice(0, 400)),
        db.from("re_event_stats").select("theme,horizon,n_final,n_pending,excess_med,up_vs_mkt_pct,chg_med"),
        db.from("re_news_events").select("day").order("day").limit(1)]);
      const out = new Map();
      for (const o of oc.data || []) { if (!out.has(o.event_id)) out.set(o.event_id, {}); out.get(o.event_id)[o.horizon] = o; }
      return { events: ev.data || [], out, stats: st.data || [], firstDay: first.data?.[0]?.day || null };
    })();
    dataP.catch(() => { dataP = null; });
    return dataP;
  }

  // ── ① [영향·예측] 탭 칸 ──
  let theme = store.get("reNpTheme", "");
  function section(D) {
    const box = el("section", "np-box"); box.id = "npBox";
    box.append(el("h3", "re-h", "📚 뉴스 → 집값 기록"));
    box.append(el("p", "re-imp-note", "지역 부동산 소식(교통·재건축·개발·공급 등)이 나온 뒤 그 지역 아파트값이 같은 시·도(서울/경기) 전체보다 더 올랐는지 계속 기록해요. "
      + "같은 단지·같은 크기끼리 '소식 전 180일 → 소식 뒤 N일' 중간값을 비교해서, 팔린 단지 구성에 덜 흔들려요. 30·90·180일 결과는 기간이 끝나고 신고가 다 모이면(+35일) 확정돼요. 기록이 쌓일수록 '이런 소식 뒤엔 보통 이랬다'가 보여요 — 원인을 뜻하지는 않아요."));
    // 성적표
    const tbl = el("table", "np-t");
    const hr = el("tr"); hr.append(el("th", null, "주제"), ...HZ.map(h => el("th", null, `${h}일 뒤 (시장 대비)`))); tbl.append(hr);
    const themes = [...new Set(D.stats.map(s => s.theme))].sort((a, b) => Object.keys(THEME).indexOf(a) - Object.keys(THEME).indexOf(b));
    for (const t of themes) {
      const tr = el("tr"), th = el("th"), tag = el("span", "re-tchip", THEME[t] || t); tag.style.setProperty("--c", COLOR[t] || "#888"); th.append(tag); tr.append(th);
      for (const h of HZ) {
        const s = D.stats.find(x => x.theme === t && x.horizon === h), td = el("td");
        if (s?.n_final) { td.append(el("b", cls(s.excess_med), pp(s.excess_med)), el("small", null, ` ${s.n_final}건 중 시장보다 오른 곳 ${Math.round(s.up_vs_mkt_pct)}%${s.n_final < 20 ? " · 표본 적음" : ""}`)); }
        else td.append(el("small", null, s?.n_pending ? `진행 중 ${s.n_pending}건` : "–"));
        tr.append(td);
      }
      tbl.append(tr);
    }
    const anyFinal = D.stats.some(s => s.n_final);
    if (themes.length) { const w = el("div", "np-twrap"); w.append(tbl); box.append(w); }
    if (!anyFinal && D.firstDay) box.append(el("p", "re-imp-note", `아직 확정된 기록이 없어요. 첫 30일 결과는 ${md(addDays(D.firstDay, 65))}쯤, 90일은 ${md(addDays(D.firstDay, 125))}쯤, 180일은 ${addDays(D.firstDay, 215).slice(0, 7).replace("-", ".")}쯤부터 확정돼요.`));
    // 주제 고르기
    const chips = el("div", "np-chips");
    const counts = {}; for (const e of D.events) counts[e.theme] = (counts[e.theme] || 0) + 1;
    for (const [k, label] of [["", `전체 ${D.events.length}`], ...Object.keys(THEME).filter(k => counts[k]).map(k => [k, `${THEME[k]} ${counts[k]}`])]) {
      const b = el("button", theme === k ? "on" : null, label); b.type = "button";
      if (k) b.style.setProperty("--c", COLOR[k]);
      b.addEventListener("click", () => { theme = k; store.set("reNpTheme", k); const nb = section(D); box.replaceWith(nb); });
      chips.append(b);
    }
    box.append(el("div", "re-imp-note", "최근 60일 소식 (진행 중 숫자는 30일 칸 — 아직 거래가 덜 모였어요)"), chips);
    const list = el("div", "np-list");
    const evs = D.events.filter(e => !theme || e.theme === theme).slice(0, 40);
    for (const e of evs) {
      const o = D.out.get(e.id) || {}, o30 = o[30];
      const row = el("div", "np-row");
      const left = el("div", "np-l");
      const tag = el("span", "re-tchip", THEME[e.theme] || e.theme); tag.style.setProperty("--c", COLOR[e.theme] || "#888");
      const where = el("button", "np-where", nameOf(e.region)); where.type = "button"; where.title = "지도·목록에서 이 지역 보기";
      where.addEventListener("click", () => goRegion(e.region));
      left.append(el("small", "np-day", md(e.day)), where, tag, el("small", null, ` 기사 ${e.n7 || "–"}건`));
      const t = Array.isArray(e.top) ? e.top[0] : null;
      if (t?.t) { const a = el("a", "np-title", t.t); a.href = t.u; a.target = "_blank"; a.rel = "noopener noreferrer"; left.append(a); }
      const right = el("div", "np-r");
      if (!o30 || o30.chg == null) right.append(el("small", null, Date.parse(`${e.day}T00:00:00Z`) > Date.now() - 7 * 864e5 ? "소식 뒤 7일부터 계산" : "같은 단지 거래 없음"));
      else {
        right.append(el("b", cls(o30.excess), o30.excess != null ? `시장 대비 ${pp(o30.excess)}` : pc(o30.chg)),
          el("small", null, `그 지역 ${pc(o30.chg)} · 시장 ${pc(o30.mkt_chg)} · 같은 단지 ${o30.matched}곳${o30.matched < 10 ? "(적어서 흔들림)" : ""}${o30.final ? " · 확정" : " · 진행 중"}`));
        if (o30.matched < 10) row.classList.add("np-thin");
        if (o30.vol_before) right.append(el("small", null, `거래 월 ${Math.round(o30.vol_before)} → ${o30.vol_after != null ? Math.round(o30.vol_after) : "–"}건${o30.final ? "" : "(덜 모임)"}`));
      }
      row.append(left, right);
      list.append(row);
    }
    if (!evs.length) list.append(el("p", "re-imp-note", "이 주제의 소식이 없어요."));
    box.append(list);
    return box;
  }
  function goRegion(code) {
    try {
      if (typeof showTab === "function") showTab("list");
      if (SGG[code] && typeof pickSgg === "function") pickSgg("list", code);
      else if (typeof dongs !== "undefined" && typeof map !== "undefined" && map) {
        const set = new Set(codesOf(code)), pts = dongs.filter(d => set.has(d.sgg_cd));
        if (pts.length) { const b = new maplibregl.LngLatBounds(); pts.forEach(d => b.extend([d.x, d.y])); map.fitBounds(b, { padding: 40, maxZoom: 12, duration: 900 }); }
      }
      globalThis.REIMPACT?.showNews?.(code);
    } catch (e) { console.warn("re-newsprice", e); }
  }
  // [영향·예측] 칸이 다시 그려질 때마다 권역 카드 아래에 붙임
  let busy = false;
  async function attach() {
    const pane = document.getElementById("pane-impact");
    if (!pane || pane.hidden || busy || pane.querySelector("#npBox")) return;
    const grid = pane.querySelector(".re-zones");
    if (!grid) return;
    busy = true;
    try {
      const D = await load();
      if (!pane.querySelector("#npBox") && grid.isConnected) grid.after(section(D));
    } catch (e) { console.warn("re-newsprice", e?.message || e); }
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

  // ── ② 첫 화면 요약 칸 ──
  async function front(host, { sec, pc: pcf }) {
    try {
      const D = await load();
      if (!host.isConnected) return;
      if (!D.events.length) { host.remove(); return; }
      const s = sec("📚 뉴스 → 집값 기록", `기록 중 ${D.events.length}건 (최근 60일)`);
      const fin = D.stats.filter(x => x.n_final >= 5 && x.horizon === 90).sort((a, b) => b.excess_med - a.excess_med);
      if (fin.length) {
        const l = el("div", "rfn-list");
        for (const x of fin.slice(0, 4)) { const r = el("div", "rfn-row"); r.append(el("span", "rfn-nm", THEME[x.theme] || x.theme), el("span", "rfn-v", `90일 뒤 시장 대비 ${pp(x.excess_med)} · ${x.n_final}건`)); l.append(r); }
        s.append(l);
      } else if (D.firstDay) s.append(el("p", "rfn-txt", `지역 부동산 소식 뒤 그 지역 집값이 시장보다 더 올랐는지 기록하고 있어요. 첫 확정 결과(30일)는 ${md(addDays(D.firstDay, 65))}쯤 나와요.`));
      const go = el("button", "rfn-link", "기록 보기 (영향·예측 탭) →"); go.type = "button";
      go.addEventListener("click", () => { REFRONT?.close?.(); try { showTab("impact"); setTimeout(() => document.getElementById("npBox")?.scrollIntoView({ behavior: "smooth", block: "start" }), 1500); } catch { /* 탭 없음 */ } });
      s.append(go);
      host.replaceWith(s);
    } catch (e) { console.warn("re-newsprice front", e?.message || e); host.remove(); }
  }
  globalThis.RENEWSPRICE = { front, load, section, preview(raw) {   // 미리보기: 표가 생기기 전 모양 확인용(raw = {events, outcomes, stats, firstDay})
    const out = new Map(); for (const o of raw.outcomes || []) { if (!out.has(o.event_id)) out.set(o.event_id, {}); out.get(o.event_id)[o.horizon] = o; }
    dataAt = Date.now(); dataP = Promise.resolve({ events: raw.events || [], out, stats: raw.stats || [], firstDay: raw.firstDay }); attach(); } };

  const css = document.createElement("style");
  css.textContent = `
.np-box { display: grid; gap: 8px; margin-top: 6px; } .np-twrap { overflow-x: auto; }
.np-t { border-collapse: collapse; font-size: 12px; width: 100%; }
.np-t th, .np-t td { border-bottom: 1px solid var(--line); padding: 4px 6px; text-align: left; vertical-align: top; }
.np-t th { color: var(--muted); font-weight: 600; } .np-t td small { color: var(--muted); font-size: 11px; }
.np-t b.up { color: var(--up, #ef4444); } .np-t b.down { color: var(--down, #3b82f6); }
.np-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.np-chips button { font: inherit; font-size: 12px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--c, var(--line)); background: transparent; color: var(--muted); cursor: pointer; }
.np-chips button.on { color: var(--text); font-weight: 700; background: color-mix(in srgb, var(--c, var(--accent, #6366f1)) 20%, transparent); }
.np-list { display: grid; gap: 2px; }
.np-row { display: flex; justify-content: space-between; gap: 10px; padding: 6px 4px; border-bottom: 1px solid var(--line); font-size: 12.5px; }
.np-l { display: flex; flex-wrap: wrap; gap: 2px 6px; align-items: center; min-width: 0; }
.np-day { color: var(--muted); font-variant-numeric: tabular-nums; }
.np-where { font: inherit; font-weight: 800; background: none; border: 0; padding: 0; color: var(--text); cursor: pointer; } .np-where:hover { text-decoration: underline; }
.np-title { flex-basis: 100%; color: var(--muted); font-size: 11.5px; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .np-title:hover { text-decoration: underline; }
.np-r { display: grid; justify-items: end; text-align: right; white-space: nowrap; } .np-r small { color: var(--muted); font-size: 11px; }
.np-row.np-thin .np-r b { opacity: .6; }
.np-r b.up { color: var(--up, #ef4444); } .np-r b.down { color: var(--down, #3b82f6); }
@media (max-width: 600px) { .np-row { flex-direction: column; } .np-r { justify-items: start; text-align: left; } }`;
  document.head.append(css);
})();
