// 🏆 [순위] 탭 (사용자 2026-11-26 "순위 탭도 이어서" — 부동산 아이디어 2차 ⑤, 기억해 둔 다음 단계)
// - re-impact.js 가 re-colormap.js 다음에 불러옴(real-estate.html 수정 없음). 탭 버튼·칸을 이 파일이 만들고 showTab 을 감쌈(기억 reRankTab·reRankView·reRankKind·reRankCat·reRankReg·reRankArea)
// - [🏢 단지 순위 | 🗺 시·구 순위] 두 칸. 새로 받는 표 없음 — 이미 있는 표만 읽음
//   ① 단지 순위(종류·지역 고르기, 30곳): 거래 많은(re_places 12개월) · 3.3㎡당 비싼 · 3.3㎡당 싼(거래 10건↑) · 신고가 많은(re_new_highs 최근 60일, 아파트)
//      · 전세가율 높은(re_gap_places — 위험 쪽) · 갭 작은(re_gap_places — 전세 끼고 적은 돈, 같은 말이라 경고 함께)
//      줄을 누르면 단지 상세, 줄 끝 ★(관심 단지 REWATCH)·🏠(집 비교 REHOMECMP) 담기
//   ② 시·구 순위: 지도 색칠(RECOLOR.values)과 같은 계산 — 1년 가격 변화·거래 늘어남·신고가 비율·전세가율·갭·금리 내린 뒤 반응, 72곳 막대 + [🎨 지도에 칠하기]
// - 투자 권유가 아님(순위 = 숫자 정렬일 뿐)
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined" || typeof showTab !== "function" || typeof KIND === "undefined") return;
  const H = 3600e3;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 기억 없음 */ } },
  };
  const KN = { apt: "아파트", villa: "빌라", offi: "오피스텔" };
  const won = v => (v == null || !Number.isFinite(v) ? "–" : typeof fmtMan === "function" ? fmtMan(Math.round(v)) : `${Math.round(v).toLocaleString()}만`);
  const eok = man => (man == null || !Number.isFinite(man) ? "–" : Math.abs(man) >= 10000 ? `${man < 0 ? "−" : ""}${(Math.abs(man) / 10000).toFixed(Math.abs(man) >= 100000 ? 0 : 1)}억` : `${man < 0 ? "−" : ""}${Math.round(Math.abs(man)).toLocaleString()}만`);
  const md = s => String(s || "").slice(5, 10).replace("-", "/");
  const nameOf = p => (p.kind === "apt" ? p.name || p.apt_nm || p.place_key : p.name && !String(p.name).startsWith("(") ? p.name : `${p.place_key}번지`);
  const sggName = c => `${SGG[c]?.sido === "서울" ? "서울 " : ""}${SGG[c]?.name || c}`;
  const isoAgo = days => new Date(Date.now() + 9 * H - days * 864e5).toISOString().slice(0, 10);

  // 지역 고르기: 전체 / 서울 전체 / 경기 전체 / 서울 구 / 경기 시 전체·구
  const REG = [{ label: "서울·경기 전체", codes: Object.keys(SGG) }, { label: "서울 전체", codes: Object.keys(SGG).filter(c => c.startsWith("11")) }, { label: "경기 전체", codes: Object.keys(SGG).filter(c => c.startsWith("41")) }];
  {
    const cities = new Map();
    for (const [code, v] of Object.entries(SGG)) {
      if (v.sido === "서울") { REG.push({ label: `서울 ${v.name}`, codes: [code], g: "서울" }); continue; }
      const [city, gu] = v.name.split(" ");
      (cities.get(city) || cities.set(city, []).get(city)).push({ code, gu });
    }
    for (const [city, xs] of cities) {
      if (xs.length > 1 || xs[0].gu) { REG.push({ label: `${city} 전체`, codes: xs.map(x => x.code), g: "경기" }); for (const x of xs) REG.push({ label: `${city} ${x.gu}`, codes: [x.code], g: "경기" }); }
      else REG.push({ label: city, codes: [xs[0].code], g: "경기" });
    }
  }
  const CATS = {
    trades: { label: "🔁 거래 많은", note: "최근 12개월 실거래 수(해제 뺌)" },
    dear: { label: "💎 3.3㎡당 비싼", note: "최근 12개월 3.3㎡당 중간값(모든 크기 — 큰 평형·새 건물이 많으면 높게 나옴), 거래 3건 이상" },
    cheap: { label: "🪙 3.3㎡당 싼", note: "최근 12개월 3.3㎡당 중간값이 낮은 곳, 거래 10건 이상(너무 작은 곳 빼려고)" },
    highs: { label: "🔥 신고가 많은", note: "최근 60일 신고가 거래 수(같은 단지·크기 그 전 3년 최고가보다 비싼 거래, 해제 뺌) — 아파트만", apt: true },
    ratio: { label: "🛡 전세가율 높은", note: "같은 단지·건물·크기의 12개월 신규 전세 ÷ 매매(매매 5건·전세 3건 이상) — 80% 넘으면 깡통전세 위험" },
    gap: { label: "🧮 갭 작은", note: "같은 단지·건물·크기의 매매 − 신규 전세(12개월 중간값, 매매 5건·전세 3건 이상), 0보다 큰 것만 — 갭이 작다 = 전세가율이 높다 = 위험과 같은 말" },
  };
  let view = store.get("reRankView", "place"); if (!["place", "sgg"].includes(view)) view = "place";
  let kind = store.get("reRankKind", "apt"); if (!KN[kind]) kind = "apt";
  let cat = store.get("reRankCat", "trades"); if (!CATS[cat]) cat = "trades";
  let reg = store.get("reRankReg", 0); if (!REG[reg]) reg = 0;
  let smode = store.get("reRankSgg", "price");

  // ── 탭·칸 ──
  const tabs = document.querySelector(".side-tabs");
  const anchor = document.getElementById("pane-homecmp") || document.getElementById("pane-finder") || document.getElementById("pane-stats");
  if (!tabs || !anchor) return;
  const btn = el("button", null, "순위"); btn.type = "button"; btn.setAttribute("role", "tab"); btn.dataset.tab = "rank";
  tabs.append(btn);
  const pane = el("section", "pane rk"); pane.id = "pane-rank"; pane.setAttribute("role", "tabpanel"); pane.hidden = true;
  anchor.after(pane);
  let active = false;
  const prevShow = showTab;
  showTab = function (name, ...rest) {
    if (name === "rank") {
      const r = prevShow.call(this, name, ...rest);
      active = true; pane.hidden = false;
      for (const b of document.querySelectorAll(".side-tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === "rank"));
      store.set("reRankTab", 1);
      render();
      return r;
    }
    if (name !== "detail" || active) { active = false; pane.hidden = true; }
    if (name !== "detail") { try { localStorage.removeItem("reRankTab"); } catch { /* 기억 없음 */ } }
    return prevShow.call(this, name, ...rest);
  };
  btn.addEventListener("click", () => showTab("rank"));

  // ── 그리기 ──
  const chips = (items, cur, onPick, cls = "") => { const d = el("div", `rk-chips ${cls}`); for (const [k, t] of items) { const b = el("button", k === cur ? "on" : null, t); b.type = "button"; b.addEventListener("click", () => onPick(k)); d.append(b); } return d; };
  function render() {
    if (!active) return;
    const parts = [];
    parts.push(chips([["place", "🏢 단지 순위"], ["sgg", "🗺 시·구 순위"]], view, v => { view = v; store.set("reRankView", v); render(); }, "rk-tabs"));
    const out = el("div", "rk-out"); out.id = "rkOut";
    if (view === "place") {
      parts.push(chips(Object.entries(CATS).map(([k, c]) => [k, c.label]), cat, c => { cat = c; store.set("reRankCat", c); render(); }));
      const row = el("div", "rk-row");
      row.append(chips(Object.entries(KN).map(([k, n]) => [k, n]), CATS[cat].apt ? "apt" : kind, k => { kind = k; store.set("reRankKind", k); render(); }, CATS[cat].apt ? "rk-dim" : ""));
      const sel = el("select"); sel.setAttribute("aria-label", "지역");
      REG.forEach((r, i) => sel.append(Object.assign(el("option", null, r.label), { value: String(i) })));
      sel.value = String(reg);
      sel.addEventListener("change", () => { reg = Number(sel.value); store.set("reRankReg", reg); render(); });
      row.append(sel);
      parts.push(row, el("p", "rk-note", CATS[cat].note), out);
      pane.replaceChildren(...parts);
      placeRank(out);
    } else {
      const modes = [["price", "1년 가격 변화"], ["volume", "거래 늘어남"], ["highs", "신고가 비율"], ["jeonse", "전세가율"], ["gap", "갭 (매매−전세)"], ["rate", "금리 내린 뒤 반응"]];
      if (!modes.some(m => m[0] === smode)) smode = "price";
      parts.push(chips(modes, smode, m => { smode = m; store.set("reRankSgg", m); render(); }));
      if (["price", "volume", "jeonse", "gap"].includes(smode)) parts.push(chips(Object.entries(KN).map(([k, n]) => [k, n]), kind, k => { kind = k; store.set("reRankKind", k); render(); }));
      parts.push(out);
      pane.replaceChildren(...parts);
      sggRank(out);
    }
  }
  const placeKey = r => `${r.kind}|${r.sgg_cd}|${r.umd_nm}|${r.place_key}`;
  function actions(p) {
    const d = el("span", "rk-acts");
    if (globalThis.REWATCH?.toggle) {
      const on = () => (REWATCH.list || []).some(x => placeKey(x) === placeKey(p));
      const b = el("button", null); b.type = "button";
      const sync = () => { b.textContent = on() ? "★" : "☆"; b.title = on() ? "관심 단지에서 빼기" : "관심 단지로 담기"; b.classList.toggle("on", on()); };
      b.addEventListener("click", async e => { e.stopPropagation(); await REWATCH.toggle(p); sync(); });
      sync(); d.append(b);
    }
    if (globalThis.REHOMECMP?.toggle) {
      const on = () => (REHOMECMP.list || []).some(x => placeKey(x) === placeKey(p));
      const b = el("button", null, "🏠"); b.type = "button";
      const sync = () => { b.title = on() ? "집 비교에서 빼기" : "집 비교에 담기"; b.classList.toggle("on", on()); };
      b.addEventListener("click", e => { e.stopPropagation(); REHOMECMP.toggle(p); sync(); });
      sync(); d.append(b);
    }
    return d;
  }
  function list(out, rows, metric) {
    if (!rows.length) { out.replaceChildren(el("p", "rk-note", "이 조건에 맞는 곳이 없어요.")); return; }
    const ol = el("ol", "rk-list");
    rows.forEach((r, i) => {
      const li = el("li"), b = el("button", "rk-item"); b.type = "button"; b.title = "상세 열기";
      const m = metric(r);
      const l = el("span", "rk-l"); l.append(el("b", null, nameOf(r)), el("small", null, `${KN[r.kind] || ""} · ${sggName(r.sgg_cd)} ${r.umd_nm}${r.build_year ? ` · ${r.build_year}년` : ""}${m.sub ? ` · ${m.sub}` : ""}`));
      const v = el("span", `rk-v ${m.cls || ""}`); v.append(el("b", null, m.main)); if (m.small) v.append(el("small", null, m.small));
      b.append(el("span", "rk-n", String(i + 1)), l, v);
      b.addEventListener("click", () => { try { openPlace({ kind: r.kind, sgg_cd: r.sgg_cd, umd_nm: r.umd_nm, place_key: r.place_key, name: r.name || r.apt_nm, build_year: r.build_year }); } catch (e) { console.warn("re-rank", e); } });
      li.append(b, actions({ kind: r.kind, sgg_cd: r.sgg_cd, umd_nm: r.umd_nm, place_key: r.place_key, name: r.name || r.apt_nm, build_year: r.build_year, pyeong_12m: r.pyeong_12m, trades_12m: r.trades_12m }));
      ol.append(li);
    });
    out.replaceChildren(ol);
  }
  let seq = 0;
  async function placeRank(out) {
    const my = ++seq, codes = REG[reg].codes, k = CATS[cat].apt ? "apt" : kind;
    out.replaceChildren(el("p", "rk-note", "불러오는 중…"));
    try {
      const COLS = "kind,sgg_cd,umd_nm,place_key,name,build_year,trades_12m,pyeong_12m,last_date,last_price,last_area";
      if (cat === "trades" || cat === "dear" || cat === "cheap") {
        let q = db.from("re_places").select(COLS).eq("kind", k).in("sgg_cd", codes);
        if (cat === "trades") q = q.gt("trades_12m", 0).order("trades_12m", { ascending: false });
        else q = q.not("pyeong_12m", "is", null).gte("trades_12m", cat === "cheap" ? 10 : 3).order("pyeong_12m", { ascending: cat === "cheap" });
        const { data, error } = await q.limit(30);
        if (error) throw error;
        if (my !== seq) return;
        list(out, data || [], r => cat === "trades"
          ? { main: `${r.trades_12m.toLocaleString()}건`, small: r.pyeong_12m ? `3.3㎡당 ${won(r.pyeong_12m)}` : "", sub: r.last_date ? `마지막 ${md(r.last_date)} ${won(r.last_price)}` : "" }
          : { main: won(r.pyeong_12m), small: `3.3㎡당 · ${r.trades_12m}건`, sub: r.last_date ? `마지막 ${md(r.last_date)}` : "" });
      } else if (cat === "highs") {
        const rows = [];
        for (let off = 0; off < 6000; off += 1000) {
          const { data, error } = await db.from("re_new_highs").select("sgg_cd,umd_nm,apt_seq,apt_nm,price,prev_max,deal_date,canceled").in("sgg_cd", codes).gte("deal_date", isoAgo(60)).order("deal_date", { ascending: false }).range(off, off + 999);
          if (error) throw error;
          rows.push(...(data || [])); if (!data || data.length < 1000) break;
        }
        if (my !== seq) return;
        const by = new Map();
        for (const h of rows) {
          if (h.canceled) continue;
          const key = `${h.sgg_cd}|${h.apt_seq}`, a = by.get(key) || { kind: "apt", sgg_cd: h.sgg_cd, umd_nm: h.umd_nm, place_key: h.apt_seq, apt_nm: h.apt_nm, n: 0, top: 0, last: "" };
          a.n++; a.top = Math.max(a.top, (h.price / h.prev_max - 1) * 100); if (h.deal_date > a.last) a.last = h.deal_date; by.set(key, a);
        }
        const top = [...by.values()].sort((a, b) => b.n - a.n || b.top - a.top).slice(0, 30);
        list(out, top, r => ({ main: `${r.n}건`, small: `가장 크게 +${r.top.toFixed(1)}%`, sub: `마지막 ${md(r.last)}`, cls: "hot" }));
      } else {
        let q = db.from("re_gap_places").select("kind,sgg_cd,umd_nm,place_key,name,build_year,area,sale,jeonse,gap,ratio,n_sale,n_jeonse").eq("kind", k).in("sgg_cd", codes).gte("n_sale", 5).gte("n_jeonse", 3);   // 거래가 몇 건뿐인 곳은 값이 크게 튀어서 뺌
        q = cat === "ratio" ? q.order("ratio", { ascending: false }) : q.gt("gap", 0).order("gap", { ascending: true });
        const { data, error } = await q.limit(30);
        if (error) throw error;
        if (my !== seq) return;
        list(out, data || [], r => {
          const risk = r.ratio >= 80 ? "bad" : r.ratio >= 70 ? "warn" : "";
          return cat === "ratio"
            ? { main: `${Math.round(r.ratio)}%`, small: `매매 ${eok(r.sale)} · 전세 ${eok(r.jeonse)}`, sub: `${Math.round(r.area)}㎡ · 매매 ${r.n_sale}건`, cls: risk }
            : { main: `갭 ${eok(r.gap)}`, small: `전세가율 ${Math.round(r.ratio)}%${risk === "bad" ? " 위험" : risk === "warn" ? " 주의" : ""}`, sub: `${Math.round(r.area)}㎡ · 매매 ${eok(r.sale)} · 전세 ${eok(r.jeonse)}`, cls: risk };
        });
        if (data?.length) out.append(el("p", "rk-warn", "⚠ 전세가율이 높을수록(갭이 작을수록) 집값이 조금만 내려도 보증금을 돌려주기 어려워요. 투자 권유가 아니에요. 단지 상세의 '🛡 전세 위험 체크'를 꼭 보세요."));
      }
      if (my === seq && cat !== "ratio" && cat !== "gap") out.append(el("p", "rk-note", "순위는 숫자를 정렬한 것일 뿐이에요. 투자 권유가 아니에요."));
    } catch (e) { if (my === seq) out.replaceChildren(el("p", "rk-warn", `불러오지 못했어요: ${e.message || e}`)); }
  }
  async function sggRank(out) {
    const my = ++seq;
    out.replaceChildren(el("p", "rk-note", "불러오는 중…"));
    if (!globalThis.RECOLOR?.values) { out.replaceChildren(el("p", "rk-note", "지도 색칠 기능이 아직 준비되지 않았어요. 잠시 뒤 다시 눌러 주세요.")); return; }
    try {
      const res = await RECOLOR.values(smode, kind, { budget: 0 });
      if (my !== seq) return;
      const pct = smode === "highs" || smode === "jeonse";
      const fmt = v => (smode === "gap" ? eok(v * 10000) : pct ? `${Math.round(v)}%` : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}${smode === "rate" ? "%p" : "%"}`);
      const rows = [...res.map].map(([code, x]) => ({ code, ...x })).sort((a, b) => (smode === "gap" ? a.v - b.v : b.v - a.v));
      if (!rows.length) { out.replaceChildren(el("p", "rk-note", "아직 자료가 없어요.")); return; }
      const max = Math.max(...rows.map(r => Math.abs(r.v))) || 1;
      const head = el("div", "rk-sgghead");
      const go = el("button", "rk-go", "🎨 지도에 칠하기"); go.type = "button";
      go.addEventListener("click", () => { try { RECOLOR.setMode(smode, kind); } catch { /* 색칠만 */ } });
      head.append(el("small", "rk-note", `${res.basis} · ${rows.length}곳${smode === "gap" ? " · 갭이 작은 순" : " · 높은 순"}`), go);
      const ol = el("ol", "rk-list rk-sgg");
      rows.forEach((r, i) => {
        const li = el("li"), b = el("button", `rk-item${r.thin ? " thin" : ""}`); b.type = "button"; b.title = r.sub || "";
        const bar = el("span", "rk-bar"); const f = el("i"); f.style.width = `${Math.max(3, Math.abs(r.v) / max * 100)}%`; f.classList.add(r.v < 0 ? "neg" : "pos"); bar.append(f);
        const l = el("span", "rk-l"); l.append(el("b", null, sggName(r.code)), el("small", null, r.sub || ""));
        b.append(el("span", "rk-n", String(i + 1)), l, bar, el("span", "rk-v", fmt(r.v)));
        b.addEventListener("click", () => { try { showTab("list"); pickSgg("list", r.code); } catch { /* 이동만 */ } });
        li.append(b); ol.append(li);
      });
      out.replaceChildren(head, ol, el("p", "rk-note", "흐린 줄 = 표본이 적어 흔들릴 수 있는 곳. 시·구를 누르면 목록·지도가 그곳으로 가요. 투자 권유가 아니에요."));
    } catch (e) { if (my === seq) out.replaceChildren(el("p", "rk-warn", `불러오지 못했어요: ${e.message || e}`)); }
  }

  try {
    if (store.get("reRankTab", 0) && !new URLSearchParams(location.search).get("sgg")) {
      let n = 0;
      const t = setInterval(() => { if (++n > 120) return clearInterval(t); if (document.getElementById("app")?.hidden) return; clearInterval(t); showTab("rank"); }, 500);
    }
  } catch { /* 기억 없음 */ }
  globalThis.RERANK = { render, set(o = {}) { if (o.view) view = o.view; if (o.cat) cat = o.cat; if (o.kind) kind = o.kind; if (o.reg != null) reg = o.reg; if (o.smode) smode = o.smode; render(); } };

  const css = document.createElement("style");
  css.textContent = `
.rk { overflow-y: auto; padding: 8px 12px 16px; display: grid; gap: 8px; align-content: start; }
.rk-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.rk-chips button { font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; }
.rk-chips button.on { border-color: var(--accent, #6366f1); color: var(--text); font-weight: 700; background: color-mix(in srgb, var(--accent, #6366f1) 15%, transparent); }
.rk-chips.rk-dim { opacity: .45; pointer-events: none; }
.rk-tabs button { flex: 1; font-size: 13.5px; padding: 7px 8px; border-radius: 8px; } .rk-tabs { display: flex; position: sticky; top: -8px; z-index: 2; background: var(--panel, var(--bg)); padding: 6px 0; border-bottom: 1px solid var(--line); }
.rk-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: space-between; }
.rk-row select { padding: 5px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: inherit; font-size: 13px; }
.rk-note { font-size: 11.5px; color: var(--muted); margin: 0; line-height: 1.5; } .rk-warn { font-size: 12px; color: #f59e0b; margin: 0; line-height: 1.5; }
.rk-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.rk-list li { display: flex; align-items: center; gap: 4px; border-bottom: 1px solid var(--line); }
.rk-item { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; font: inherit; text-align: left; background: transparent; border: 0; padding: 6px 4px; color: var(--text); cursor: pointer; border-radius: 6px; }
.rk-item:hover { background: color-mix(in srgb, var(--accent, #6366f1) 12%, transparent); } .rk-item.thin { opacity: .55; }
.rk-n { width: 22px; flex: 0 0 auto; text-align: right; font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; }
.rk-l { display: grid; min-width: 0; flex: 1; } .rk-l b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .rk-l small { color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk-v { display: grid; justify-items: end; text-align: right; flex: 0 0 auto; } .rk-v b { font-size: 14px; } .rk-v small { color: var(--muted); font-size: 11px; }
.rk-v.bad b { color: #ef4444; } .rk-v.warn b { color: #f59e0b; } .rk-v.hot b { color: #f97316; }
.rk-acts { display: flex; gap: 2px; flex: 0 0 auto; } .rk-acts button { font: inherit; font-size: 13px; border: 1px solid var(--line); background: transparent; color: var(--muted); border-radius: 6px; padding: 1px 5px; cursor: pointer; }
.rk-acts button.on { border-color: #eab308; color: #eab308; }
.rk-sgghead { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: space-between; }
.rk-go { font: inherit; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; border: 1px solid #f59e0b; background: transparent; color: var(--text); cursor: pointer; }
.rk-bar { flex: 0 0 90px; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--line) 60%, transparent); overflow: hidden; }
.rk-bar i { display: block; height: 100%; } .rk-bar i.pos { background: var(--up, #ef4444); } .rk-bar i.neg { background: var(--down, #3b82f6); }
.rk-sgg .rk-v { min-width: 56px; font-weight: 800; }`;
  document.head.append(css);
})();
