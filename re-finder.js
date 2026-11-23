// 부동산 페이지 [내 집 찾기] 탭 (2026-11-23 사용자 "지역·아파트·빌라·오피스텔을 지목했을 때 자세한 분석, 최대 5개 비교로 내 형편에 맞는 방향, 자산(대출 포함)·지역 입력 칸")
// 1단계(이 파일): 내 형편 입력(이 브라우저에만 저장) → 살 수 있는 가격 계산 → 조건에 맞는 집 찾기 → 최대 5개 담기. 계산만, AI 없음.
// 2단계(2026-11-23): 담은 집·상세 화면의 [🤖 AI 분석] → 서버 re-item(로그인한 주인만, 하루 20번, 같은 집 7일 안은 저장본) — 보내는 건 집 정보뿐.
//   내 형편 대비 계산(필요한 내 돈·월 상환)은 AI 답의 숫자로 이 브라우저에서 따로 — 자산·소득은 서버로 안 감
//   2단계: 담은 집 하나 AI 상세 분석 · 3단계: 담은 집 최대 5개 AI 비교·조건 적합도 정리(투자 자문이 아님 — 최종 판단은 본인·전문가 상담)
// - re-impact.js 가 불러옴(real-estate.html 수정 없음). 탭 버튼·칸을 이 파일이 만들고 showTab·openPlace 를 감쌈
// - 저장: localStorage reFinderProfile(형편)·reFinderCond(조건)·reFinderBasket(담은 집) — 데이터베이스에는 저장하지 않음(사용자 결정 2026-11-23)
// - 가격 추정: 단지·건물의 최근 12개월 3.3㎡당 중간값(re_places.pyeong_12m) × 원하는 전용면적 — 실제 매물가와 다를 수 있음
// - 대출: 은행에서 들은 한도를 직접 넣으면 그 값, 없으면 DSR·LTV·상한·금리·기간 가정(직접 고칠 수 있음)으로 대략 추정 — 실제 규제·심사와 다를 수 있음
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined" || typeof showTab !== "function") return;
  const R = () => globalThis.RESIG;
  const PY = 3.3058;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 기억 없음 */ } },
  };
  const DEF_PROFILE = { purpose: "live", cash: "", income: "", existingMonthly: "", loanDirect: "", ltv: 50, dsr: 40, rate: 4.88, years: 30, cap: "", costPct: 3, jeonseLoanPct: 80, jeonseLoanCap: 20000 };
  const DEF_COND = { kinds: ["apt"], zones: [], area: 84, tol: 10, minYear: "", minTrades: 3, sort: "fit" };
  let profile = { ...DEF_PROFILE, ...store.get("reFinderProfile", {}) };
  let cond = { ...DEF_COND, ...store.get("reFinderCond", {}) };
  let basket = store.get("reFinderBasket", []);
  const num = v => { const n = Number(String(v ?? "").replace(/[, ]/g, "")); return Number.isFinite(n) ? n : 0; };
  const won = v => (v == null || !Number.isFinite(v) ? "–" : typeof fmtMan === "function" ? fmtMan(Math.round(v)) : `${Math.round(v).toLocaleString()}만`);

  // ── 대출·예산 계산 ──
  const pmt = (loan, ratePct, years) => { const r = ratePct / 100 / 12, n = years * 12; return loan <= 0 ? 0 : r ? loan * r / (1 - (1 + r) ** -n) : loan / n; };
  const pv = (monthly, ratePct, years) => { const r = ratePct / 100 / 12, n = years * 12; return monthly <= 0 ? 0 : r ? monthly * (1 - (1 + r) ** -n) / r : monthly * n; };
  function loanDsr(p) {                                    // 연소득 × DSR − 기존 대출 원리금 → 새 대출로 갚을 수 있는 월 금액 → 원금
    const monthly = (num(p.income) * num(p.dsr) / 100 - num(p.existingMonthly) * 12) / 12;
    return pv(monthly, num(p.rate), num(p.years) || 30);
  }
  /** 집값 P(만원)일 때 받을 수 있는 대출 */
  function loanFor(P, p = profile) {
    if (num(p.loanDirect) > 0) return Math.min(num(p.loanDirect), P);
    let L = Math.min(P * num(p.ltv) / 100, loanDsr(p));
    if (num(p.cap) > 0) L = Math.min(L, num(p.cap));
    return Math.max(0, L);
  }
  /** 이 집값에 필요한 내 돈(취득세·중개 등 비용 포함) */
  const ownNeeded = (P, p = profile) => P * (1 + num(p.costPct) / 100) - loanFor(P, p);
  /** 살 수 있는 가장 비싼 집값(실거주 매매) — 이분 탐색 */
  function maxPrice(p = profile) {
    let lo = 0, hi = 5e6;                                    // 500억
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; ownNeeded(m, p) <= num(p.cash) ? (lo = m) : (hi = m); }
    return lo;
  }
  function jeonseMax(p = profile) {                        // 전세 살기: 보증금 D ≤ 내 돈 + 전세대출(D × 비율, 상한)
    let lo = 0, hi = 5e5;
    const loan = D => (num(p.loanDirect) > 0 ? Math.min(num(p.loanDirect), D) : Math.min(D * num(p.jeonseLoanPct) / 100, num(p.jeonseLoanCap) || Infinity));
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; m - loan(m) <= num(p.cash) ? (lo = m) : (hi = m); }
    return { max: lo, loan: loan(lo) };
  }

  // ── 탭·칸 ──
  const tabs = document.querySelector(".side-tabs"), anchor = document.getElementById("pane-impact") || document.getElementById("pane-stats");
  if (!tabs || !anchor) return;
  const btn = el("button", null, "내 집 찾기"); btn.type = "button"; btn.setAttribute("role", "tab"); btn.dataset.tab = "finder";
  tabs.append(btn);
  const pane = el("section", "pane rf"); pane.id = "pane-finder"; pane.setAttribute("role", "tabpanel"); pane.hidden = true;
  anchor.after(pane);
  let active = false;
  const prevShow = showTab;
  showTab = function (name, ...rest) {
    if (name === "impact" || name === "finder") { try { lastTab = name; } catch { /* 페이지 변수 없음 */ } }   // 상세에서 "← 돌아가기"가 이 탭으로
    if (name === "finder") {
      active = true;
      for (const b of document.querySelectorAll(".side-tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === "finder"));
      for (const id of ["pane-list", "pane-stats", "pane-detail", "pane-impact"]) { const x = document.getElementById(id); if (x) x.hidden = true; }
      if (typeof map !== "undefined" && map) for (const id of ["re-sig", "re-sig-n"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      pane.hidden = false;
      store.set("reFinderTab", 1);
      render();
      return;
    }
    active = false; pane.hidden = true;
    try { localStorage.removeItem("reFinderTab"); } catch { /* 기억 없음 */ }
    return prevShow.call(this, name, ...rest);
  };
  btn.addEventListener("click", () => showTab("finder"));
  // 단지·건물 상세 화면에 "★ 비교에 담기"
  if (typeof openPlace === "function") {
    const baseOpen = openPlace;
    openPlace = async function (p, ...rest) {
      const r = await baseOpen.call(this, p, ...rest);
      try {
        const box = document.getElementById("detail"), sub = box?.querySelector("p.sub");
        if (sub && p?.place_key && !box.querySelector(".rf-add")) {
          const b = el("button", "rf-add"); b.type = "button";
          const sync = () => { const inB = basket.some(x => keyOf(x) === keyOf(p)); b.textContent = inB ? "★ 담은 집 (빼기)" : "☆ 비교에 담기 (최대 5개)"; b.classList.toggle("on", inB); };
          b.addEventListener("click", () => { toggleBasket(p); sync(); });
          sync(); sub.after(b);
          const a = el("button", "rf-add rf-ai-btn", "🤖 AI 분석 (내 집 찾기 탭에서)"); a.type = "button";
          a.addEventListener("click", () => { if (!basket.some(x => keyOf(x) === keyOf(p)) && basket.length < 5) toggleBasket(p); showTab("finder"); analyze(p); });
          b.after(a);
        }
      } catch (e) { console.warn("re-finder", e); }
      return r;
    };
  }
  const keyOf = p => `${p.kind}|${p.sgg_cd}|${p.umd_nm}|${p.place_key}`;
  function toggleBasket(p) {
    const k = keyOf(p), i = basket.findIndex(x => keyOf(x) === k);
    if (i >= 0) basket.splice(i, 1);
    else {
      if (basket.length >= 5) { alert("비교는 최대 5개까지예요. 담은 집 하나를 먼저 빼 주세요."); return; }
      basket.push({ kind: p.kind, sgg_cd: p.sgg_cd, umd_nm: p.umd_nm, place_key: p.place_key, name: p.name, build_year: p.build_year, pyeong_12m: p.pyeong_12m, trades_12m: p.trades_12m,
        last_price: p.last_price, last_area: p.last_area, last_date: p.last_date, area: num(cond.area) || null, added: new Date().toISOString().slice(0, 10) });
    }
    store.set("reFinderBasket", basket);
    if (active) render();
  }

  // ── 그리기 ──
  const field = (label, key, obj, opts = {}) => {
    const w = el("label", "rf-f"), inp = el("input");
    inp.type = "text"; inp.inputMode = "numeric"; inp.value = obj[key] ?? ""; inp.placeholder = opts.ph || "";
    inp.addEventListener("change", () => { obj[key] = inp.value.replace(/[^\d.]/g, ""); inp.value = obj[key]; save(); summary(); });
    w.append(el("span", null, label), inp);
    if (opts.unit) w.append(el("small", null, opts.unit));
    return w;
  };
  function save() { store.set("reFinderProfile", profile); store.set("reFinderCond", cond); }
  let sumBox = null;
  function summary() {
    if (!sumBox) return;
    const p = profile, cash = num(p.cash);
    sumBox.replaceChildren();
    if (!cash) { sumBox.append(el("p", "rf-note", "보유 현금을 넣으면 살 수 있는 가격을 계산해요.")); return; }
    if (p.purpose === "jeonse") {
      const j = jeonseMax(p);
      sumBox.append(el("div", "rf-big", `전세 보증금 최대 약 ${won(j.max)}`), el("div", "rf-note", `내 돈 ${won(cash)} + 전세대출 약 ${won(j.loan)}${num(p.loanDirect) ? " (직접 넣은 한도)" : ` (보증금의 ${p.jeonseLoanPct}%·상한 ${won(num(p.jeonseLoanCap))} 가정)`}`));
      return;
    }
    if (p.purpose === "gap") {
      sumBox.append(el("div", "rf-big", `내 돈 ${won(cash)}로 "매매가 − 전세가 + 비용"이 이 안에 드는 집`), el("div", "rf-note", "전세를 끼고 사는 경우예요(대출 없이 계산). 집마다 신규 전세 중간값으로 필요한 돈을 계산해요. 전세가는 바뀔 수 있고 세입자 보증금은 나중에 돌려줘야 할 돈이에요."));
      return;
    }
    const P = maxPrice(p), L = loanFor(P, p), m = pmt(L, num(p.rate), num(p.years) || 30), dsrL = loanDsr(p);
    sumBox.append(el("div", "rf-big", `살 수 있는 집값 최대 약 ${won(P)}`),
      el("div", "rf-note", `내 돈 ${won(cash)} + 대출 약 ${won(L)}${num(p.loanDirect) ? " (직접 넣은 한도)" : ` (LTV ${p.ltv}%·DSR ${p.dsr}%${num(p.cap) ? `·상한 ${won(num(p.cap))}` : ""} 가정, DSR 기준 최대 ${won(dsrL)})`} − 취득세·중개 등 비용 ${p.costPct}%`),
      el("div", "rf-note", `월 상환 약 ${won(m)} (금리 ${p.rate}%, ${p.years}년 원리금 균등)`));
    if (!num(p.loanDirect) && !num(p.income)) sumBox.append(el("div", "rf-warn", "연소득을 넣지 않아 DSR 한도가 0이에요 — 대출 없이 계산됐어요. 은행 한도를 알면 '은행 대출 한도'에 직접 넣어 주세요."));
  }
  function render() {
    if (!active) return;
    const parts = [];
    parts.push(el("p", "rf-note", "내 형편과 원하는 조건으로 집을 찾고, 마음에 드는 곳을 최대 5개 담아 비교해요. 입력한 숫자는 이 브라우저에만 저장돼요. 계산은 대략이며 투자 자문이 아니에요 — 대출은 은행, 세금은 세무사, 계약은 공인중개사와 꼭 확인하세요."));
    // ① 내 형편
    const prof = el("details", "rf-box"); prof.open = !num(profile.cash);
    prof.append(el("summary", null, "🧑 내 형편 (만원 단위)"));
    const pur = el("div", "rf-chips");
    for (const [k, t] of [["live", "실거주로 사기"], ["gap", "전세 끼고 사기"], ["jeonse", "전세 살기"]]) {
      const b = el("button", profile.purpose === k ? "on" : null, t); b.type = "button";
      b.addEventListener("click", () => { profile.purpose = k; save(); render(); });
      pur.append(b);
    }
    const g1 = el("div", "rf-grid");
    g1.append(field("보유 현금(자기자본)", "cash", profile, { unit: "만원", ph: "예: 50000 = 5억" }), field("연소득(세전, 부부 합산 가능)", "income", profile, { unit: "만원" }),
      field("기존 대출 월 상환액", "existingMonthly", profile, { unit: "만원" }), field("은행 대출 한도(알면)", "loanDirect", profile, { unit: "만원", ph: "모르면 비워 두세요" }));
    const g2 = el("details", "rf-sub");
    g2.append(el("summary", null, "대출 추정 가정 (직접 고칠 수 있어요)"));
    const g2g = el("div", "rf-grid");
    g2g.append(field("LTV", "ltv", profile, { unit: "%" }), field("DSR", "dsr", profile, { unit: "%" }), field("대출 금리", "rate", profile, { unit: "%" }), field("대출 기간", "years", profile, { unit: "년" }),
      field("대출 상한(규제)", "cap", profile, { unit: "만원", ph: "없으면 비움" }), field("취득세·중개 등 비용", "costPct", profile, { unit: "%" }),
      field("전세대출 비율", "jeonseLoanPct", profile, { unit: "%" }), field("전세대출 상한", "jeonseLoanCap", profile, { unit: "만원" }));
    g2.append(g2g, el("p", "rf-note", "LTV·DSR·대출 상한은 정부 규제·지역·주택 수·소득에 따라 달라요(규제지역은 LTV가 더 낮고 한도 상한이 있을 수 있어요). 기본 금리는 한국은행 신규 주담대 평균이에요."));
    sumBox = el("div", "rf-sum");
    prof.append(pur, g1, g2);
    parts.push(prof, sumBox);                                 // 계산 결과는 접어도 보이게 칸 밖에
    // ② 원하는 조건
    const cb = el("div", "rf-box");
    cb.append(el("div", "rf-h", "🔎 원하는 조건"));
    const kinds = el("div", "rf-chips");
    for (const [k, t] of [["apt", "아파트"], ["villa", "빌라"], ["offi", "오피스텔"]]) {
      const b = el("button", cond.kinds.includes(k) ? "on" : null, t); b.type = "button";
      b.addEventListener("click", () => { cond.kinds = cond.kinds.includes(k) ? cond.kinds.filter(x => x !== k) : [...cond.kinds, k]; if (!cond.kinds.length) cond.kinds = [k]; save(); render(); });
      kinds.append(b);
    }
    const zones = el("div", "rf-chips");
    zones.append(el("span", "rf-k", "권역"));
    for (const z of R()?.ZONES || []) {
      const b = el("button", cond.zones.includes(z.id) ? "on" : null, z.name.replace("서울 ", "서울·").replace("경기 ", "경기·")); b.type = "button";
      b.addEventListener("click", () => { cond.zones = cond.zones.includes(z.id) ? cond.zones.filter(x => x !== z.id) : [...cond.zones, z.id]; save(); render(); });
      zones.append(b);
    }
    zones.append(el("small", "rf-note", cond.zones.length ? "" : " (안 고르면 서울·경기 전체)"));
    const cg = el("div", "rf-grid");
    cg.append(field("원하는 전용면적", "area", cond, { unit: "㎡ (59·84 등)" }), field("면적 허용 범위 ±", "tol", cond, { unit: "㎡" }),
      field("준공 연도 이후", "minYear", cond, { unit: "년", ph: "예: 2005" }), field("최근 12개월 거래 최소", "minTrades", cond, { unit: "건" }));
    const go = el("button", "rf-go", "조건에 맞는 집 찾기"); go.type = "button";
    go.addEventListener("click", () => search());
    cb.append(kinds, zones, cg, go);
    parts.push(cb);
    // ③ 결과
    const res = el("div", "rf-res"); res.id = "rfRes";
    parts.push(res);
    // ④ 담은 집
    parts.push(basketBox());
    pane.replaceChildren(...parts);
    summary();
    if (lastResults) drawResults(lastResults);
  }
  function basketBox() {
    const box = el("div", "rf-box");
    box.append(el("div", "rf-h", `★ 담은 집 ${basket.length}/5`));
    if (!basket.length) { box.append(el("p", "rf-note", "찾은 집이나 단지 상세 화면에서 '☆ 담기'를 누르면 여기에 모여요. 다음 단계에서 AI 상세 분석·비교가 붙어요.")); return box; }
    const ul = el("ul", "rf-list");
    for (const p of basket) {
      const li = el("li"), nm = el("button", "rf-link", `${KIND[p.kind]?.name || p.kind} · ${p.name || p.place_key}`); nm.type = "button";
      nm.addEventListener("click", () => openPlace(p));
      const rm = el("button", "rf-x", "빼기"); rm.type = "button"; rm.addEventListener("click", () => toggleBasket(p));
      const ai = el("button", "rf-ai-btn", "🤖 AI 분석"); ai.type = "button"; ai.addEventListener("click", () => analyze(p));
      li.append(nm, el("small", null, ` ${SGG[p.sgg_cd]?.name || ""} ${p.umd_nm}${p.build_year ? ` · ${p.build_year}년` : ""}${p.pyeong_12m ? ` · 3.3㎡당 ${won(p.pyeong_12m)}` : ""}`), ai, rm);
      ul.append(li);
    }
    box.append(ul, el("p", "rf-note", "🤖 AI 분석: 그 집의 가격 흐름·전세·거래·지역 소식·위험을 정리해요(하루 20번, 같은 집은 7일 동안 다시 써서 무료). 자산·소득은 보내지 않아요. 5개 비교는 다음 단계에서 붙어요."));
    const out = el("div", "rf-ai"); out.id = "rfAi";
    if (aiShown) drawAi(aiShown.p, aiShown.r, out);
    box.append(out);
    return box;
  }

  // ── 2단계: AI 상세 분석 ──
  let aiShown = null, aiBusy = false;
  const areaOf = p => Math.round(num(p.area) || num(cond.area) || 84);
  async function analyze(p, force = false) {
    if (aiBusy) return;
    const out = document.getElementById("rfAi");
    const show = (...xs) => { const o = document.getElementById("rfAi"); if (o) o.replaceChildren(...xs); };
    if (out) out.scrollIntoView({ behavior: "smooth", block: "start" });
    aiBusy = true;
    show(el("div", "rf-h", `🤖 ${p.name || p.place_key} 분석 중… (전용 ${areaOf(p)}㎡ 기준, 처음이면 30초쯤)`));
    try {
      const token = (await db.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("로그인이 필요해요");
      const r = await fetch(`${SUPABASE_URL}/functions/v1/re-item?mode=item`, { method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: p.kind, sgg_cd: p.sgg_cd, umd_nm: p.umd_nm, place_key: p.place_key, area: areaOf(p), name: p.name, region: `${SGG[p.sgg_cd]?.sido || ""} ${SGG[p.sgg_cd]?.name || ""}`.trim(), force }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || `서버 오류 ${r.status}`);
      aiShown = { p, r: j };
      const o = document.getElementById("rfAi");
      if (o) drawAi(p, j, o);
    } catch (e) { show(el("div", "rf-warn", `AI 분석을 하지 못했어요: ${e.message || e}`)); }
    finally { aiBusy = false; }
  }
  function drawAi(p, j, out) {
    const n = j.note || {}, F = id => (j.facts || []).find(f => f.id === id) || {};
    const sec = (title, x) => { if (!x?.text) return null; const d = el("div", "rf-ai-sec"); d.append(el("b", null, title), el("span", null, ` ${x.text}`)); return d; };
    const list = (title, xs, cls) => { if (!xs?.length) return null; const d = el("div", `rf-ai-list ${cls || ""}`); d.append(el("b", null, title)); const ul = el("ul"); for (const x of xs) ul.append(el("li", null, x.text || x)); d.append(ul); return d; };
    const head = el("div", "rf-ai-head");
    head.append(el("div", "rf-h", `🤖 ${p.name || p.place_key} · 전용 ${areaOf(p)}㎡`), el("small", "rf-note", `${j.cached ? "저장된 분석" : "새 분석"} · ${String(j.day || "").slice(5).replace("-", "/")} · 확신 ${n.confidence || "–"}${j.cost_usd ? ` · $${j.cost_usd}` : ""}${j.used ? ` · 오늘 ${j.used}/${j.limit}번` : ""}`));
    const again = el("button", "rf-x", "다시 분석(비용 듦)"); again.type = "button"; again.addEventListener("click", () => { if (confirm("새로 분석하면 AI 비용이 들고 하루 20번 중 1번을 써요. 할까요?")) analyze(p, true); });
    head.append(again);
    // 내 형편 대비(브라우저에서만 계산)
    const f2 = F("F2"), f3 = F("F3"), price = f2.recent_6m?.median_manwon || f2.prev_6m?.median_manwon || null;
    const fit = el("div", "rf-ai-fit");
    if (price && num(profile.cash)) {
      const pr = profile.purpose;
      if (pr === "jeonse") { const j2 = f3.median_manwon, jm = jeonseMax(); fit.append(el("b", null, "🧑 내 형편으로 보면 "), j2 ? `신규 전세 중간값 약 ${won(j2)} → ${j2 <= jm.max ? `✓ 가능(최대 ${won(jm.max)})` : `✗ 모자람(최대 ${won(jm.max)})`}` : "신규 전세 거래가 없어 계산 못 해요"); }
      else if (pr === "gap") { const j2 = f3.median_manwon; fit.append(el("b", null, "🧑 내 형편으로 보면 "), j2 ? `매매 ${won(price)} − 전세 ${won(j2)} + 비용 ${profile.costPct}% = 필요한 내 돈 약 ${won(price * (1 + num(profile.costPct) / 100) - j2)} (가진 돈 ${won(num(profile.cash))})` : "신규 전세 거래가 없어 계산 못 해요"); }
      else { const L = loanFor(price), need = ownNeeded(price); fit.append(el("b", null, "🧑 내 형편으로 보면 "), `최근 거래 중간값 ${won(price)} 기준 — 대출 약 ${won(L)}, 필요한 내 돈 약 ${won(need)} ${need <= num(profile.cash) ? `✓ 가능 (여유 ${won(num(profile.cash) - need)})` : "✗ 모자람"}, 월 상환 약 ${won(pmt(L, num(profile.rate), num(profile.years) || 30))}`); }
      fit.append(el("small", "rf-note", " (이 계산은 이 브라우저에서만 — 서버·AI 로 안 보냄)"));
    } else fit.append(el("span", "rf-note", "🧑 '내 형편'에 보유 현금을 넣으면 이 집 기준 필요한 내 돈·월 상환을 계산해 드려요(이 브라우저에서만)."));
    const nums = el("div", "rf-ai-nums");
    const pct = v => (v == null ? "–" : `${v > 0 ? "+" : ""}${v}%`);
    nums.append(el("span", null, `최근 6개월 ${f2.recent_6m?.n ?? 0}건 중간값 ${won(f2.recent_6m?.median_manwon)} (직전 6개월 ${pct(f2.change_vs_prev_6m_pct)}, 1년 전 ${pct(f2.change_vs_year_pct)})`),
      el("span", null, `최고점 대비 ${pct(f2.from_peak_pct)} · 12개월 거래 ${f2.trades_12m ?? "–"}건(해제 ${f2.canceled_12m ?? 0})`),
      el("span", null, `신규 전세 ${f3.n_12m ?? 0}건 ${won(f3.median_manwon)} · 전세가율 ${f3.jeonse_ratio_pct ?? "–"}%`));
    const parts = [head, n.one_line ? el("div", "rf-ai-one", n.one_line.text) : null, fit, nums,
      sec("💰 가격", n.price), sec("🏠 전세", n.jeonse), sec("🔄 거래(팔기 쉬움)", n.liquidity), sec("🗺️ 지역 흐름", n.area_outlook),
      list("👍 좋은 점", n.strengths, "good"), list("👎 아쉬운 점", n.weaknesses, "bad"), list("⚠️ 위험", n.risks, "bad"),
      list("📰 뉴스 속 전망 (기사 제목 기준)", n.expert_views), list("✅ 알아볼 때 확인할 것", n.checklist),
      el("p", "rf-note", "AI 가 국토부 실거래·전세·건축물대장·청약홈·한국은행·KOSIS·뉴스 제목만 보고 정리한 참고 자료예요. 투자 자문이 아니며, 실제 매물·대출·세금은 공인중개사·은행·세무사와 꼭 확인하세요.")].filter(Boolean);
    out.replaceChildren(...parts);
  }

  // ── 찾기 ──
  let lastResults = null, seq = 0;
  async function search() {
    const res = document.getElementById("rfRes");
    if (!res) return;
    const my = ++seq;
    res.replaceChildren(el("p", "rf-note", "찾는 중…"));
    const codes = cond.zones.length ? (R().ZONES.filter(z => cond.zones.includes(z.id)).flatMap(z => z.codes)) : Object.keys(SGG);
    const rows = [];
    try {
      for (const kind of cond.kinds) {
        for (let off = 0; off < 20000; off += 1000) {
          let q = db.from("re_places").select("kind,sgg_cd,umd_nm,place_key,name,build_year,trades,trades_12m,last_date,last_price,last_area,pyeong_12m")
            .eq("kind", kind).in("sgg_cd", codes).gte("trades_12m", Math.max(0, num(cond.minTrades))).not("pyeong_12m", "is", null);
          if (num(cond.minYear)) q = q.gte("build_year", num(cond.minYear));
          const { data, error } = await q.order("trades_12m", { ascending: false }).range(off, off + 999);
          if (error) throw error;
          rows.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
      }
    } catch (e) { if (my === seq) res.replaceChildren(el("p", "rf-warn", `불러오지 못했어요: ${e.message || e}`)); return; }
    if (my !== seq) return;
    // 원하는 면적에 가까운 거래가 있었던 곳 우선(최근 거래 면적이 범위 밖이면 추정만)
    const A = num(cond.area) || 84, tol = num(cond.tol) || 10;
    for (const r of rows) {
      r._price = r.pyeong_12m * A / PY;
      r._nearArea = r.last_area != null && Math.abs(Number(r.last_area) - A) <= tol;
    }
    // 전세: 후보(가격 순 앞쪽)만 신규 전세 원자료로 ㎡당 중간값
    const purpose = profile.purpose;
    let cand = rows;
    if (purpose === "live") { const P = maxPrice(); cand = rows.filter(r => r._price <= P * 1.05); }
    cand.sort((a, b) => (b._nearArea - a._nearArea) || (b.trades_12m - a.trades_12m));
    cand = cand.slice(0, 300);
    await addJeonse(cand, A, tol);
    if (my !== seq) return;
    lastResults = { rows: cand, total: rows.length, A };
    drawResults(lastResults);
  }
  async function addJeonse(list, A, tol) {
    const byKind = {};
    for (const r of list) (byKind[r.kind] ||= []).push(r);
    for (const [kind, rs] of Object.entries(byKind)) {
      for (let i = 0; i < rs.length; i += 80) {
        const part = rs.slice(i, i + 80), keys = [...new Set(part.map(r => r.place_key))], sggs = [...new Set(part.map(r => r.sgg_cd))];
        const { data } = await db.from("re_rent_jeonse").select("sgg_cd,umd_nm,place_key,excl_area,deposit").eq("kind", kind).in("sgg_cd", sggs).in("place_key", keys)
          .gte("excl_area", A - tol).lte("excl_area", A + tol).limit(5000);
        const m = new Map();
        for (const d of data || []) { const k = `${d.sgg_cd}|${d.umd_nm}|${d.place_key}`; (m.get(k) || m.set(k, []).get(k)).push(d.deposit / Number(d.excl_area)); }
        for (const r of part) {
          const xs = (m.get(`${r.sgg_cd}|${r.umd_nm}|${r.place_key}`) || []).sort((a, b) => a - b);
          if (xs.length) { r._jeonse = xs[xs.length >> 1] * A; r._jn = xs.length; }
        }
      }
    }
  }
  function drawResults({ rows, total, A }) {
    const res = document.getElementById("rfRes");
    if (!res) return;
    const p = profile, cash = num(p.cash), purpose = p.purpose, jm = purpose === "jeonse" ? jeonseMax(p).max : null;
    const items = rows.map(r => {
      let need, fit, note;
      if (purpose === "jeonse") { need = r._jeonse; fit = r._jeonse != null && r._jeonse <= jm; note = r._jeonse != null ? `전세 약 ${won(r._jeonse)} (${r._jn}건)` : "신규 전세 거래 없음"; }
      else if (purpose === "gap") { need = r._jeonse != null ? r._price * (1 + num(p.costPct) / 100) - r._jeonse : null; fit = need != null && need <= cash; note = r._jeonse != null ? `매매 ${won(r._price)} − 전세 ${won(r._jeonse)} + 비용` : "전세 거래 없어 계산 못 함"; }
      else { need = ownNeeded(r._price); fit = cash > 0 && need <= cash; note = `대출 약 ${won(loanFor(r._price))} · 월 ${won(pmt(loanFor(r._price), num(p.rate), num(p.years) || 30))}`; }
      return { r, need, fit, note };
    }).filter(x => purpose === "live" || x.need != null);
    const sorted = items.sort((a, b) => (b.fit - a.fit) || (b.r._nearArea - a.r._nearArea) || (b.r.trades_12m - a.r.trades_12m));
    const head = el("div", "rf-h", `찾은 곳 ${sorted.filter(x => x.fit).length.toLocaleString()}곳이 내 형편에 맞아요 (조건에 맞는 전체 ${total.toLocaleString()}곳 · 전용 ${A}㎡ 기준)`);
    const ul = el("ul", "rf-cards");
    for (const { r, need, fit, note } of sorted.slice(0, 60)) {
      const li = el("li", fit ? "rf-card fit" : "rf-card");
      const nm = el("button", "rf-link", `${KIND[r.kind]?.name || r.kind} · ${r.name || r.place_key}`); nm.type = "button";
      nm.addEventListener("click", () => openPlace(r));
      const add = el("button", "rf-add"); add.type = "button";
      const inB = () => basket.some(x => keyOf(x) === keyOf(r));
      add.textContent = inB() ? "★ 담음" : "☆ 담기"; add.classList.toggle("on", inB());
      add.addEventListener("click", () => { toggleBasket(r); add.textContent = inB() ? "★ 담음" : "☆ 담기"; add.classList.toggle("on", inB()); });
      const zone = R()?.zoneOf(r.sgg_cd), fc = zone && forecasts[zone.id];
      li.append(el("div", "rf-row1", null), el("div", "rf-meta", `${SGG[r.sgg_cd]?.name || ""} ${r.umd_nm}${r.build_year ? ` · ${r.build_year}년` : ""} · 최근 12개월 거래 ${r.trades_12m}건${r._nearArea ? "" : " · ⚠ 최근 거래 면적이 달라 추정"}`),
        el("div", "rf-price", `${A}㎡ 추정 ${won(r._price)} · 3.3㎡당 ${won(r.pyeong_12m)}${r._jeonse ? ` · 전세가율 약 ${Math.round((r._jeonse / r._price) * 100)}%` : ""}`),
        el("div", fit ? "rf-fit ok" : "rf-fit", `${purpose === "jeonse" ? "필요한 보증금" : "필요한 내 돈"} ${won(need)} ${fit ? `✓ 가능 (여유 ${won((purpose === "jeonse" ? jm : cash) - need)})` : cash ? "✗ 모자람" : ""}`),
        el("div", "rf-meta", note));
      if (fc) li.append(el("div", `rf-fc ${fc.call}`, `🔮 ${zone.name} 3개월 AI 예측: ${fc.call === "up" ? "▲ 상승" : "▼ 하락"} ${fc.prob}% (권역 전체, 이 집 예측 아님)`));
      const aiB = el("button", "rf-add rf-ai-btn", "🤖"); aiB.type = "button"; aiB.title = "AI 분석"; aiB.addEventListener("click", () => analyze({ ...r, area: A }));
      li.firstChild.append(nm, el("span", "rf-btns"));
      li.firstChild.lastChild.append(aiB, add);
      ul.append(li);
    }
    res.replaceChildren(head, ul, el("p", "rf-note", "추정가 = 그 단지·건물의 최근 12개월 3.3㎡당 중간값 × 원하는 면적. 층·향·동·상태와 실제 매물가는 다를 수 있어요. 앞쪽 60곳만 보여요."));
  }
  // 권역 AI 예측(있으면 결과 카드에 한 줄)
  const forecasts = {};
  (async () => {
    try {
      const n = await db.from("re_ai_notes").select("day").order("day", { ascending: false }).limit(1);
      if (!n.error && n.data?.[0]) { const f = await db.from("re_forecasts").select("zone,call,prob").eq("day", n.data[0].day); for (const x of f.data || []) forecasts[x.zone] = x; }
      const m = await db.from("re_macro").select("value,ym").eq("series", "MORTGAGE_RATE").eq("region", "00000").order("ym", { ascending: false }).limit(1);
      if (!m.error && m.data?.[0] && !store.get("reFinderProfile", null)?.rate) { profile.rate = m.data[0].value; }
    } catch { /* 없어도 됨 */ }
  })();
  try {
    if (store.get("reFinderTab", 0) && !new URLSearchParams(location.search).get("sgg")) {
      let n = 0;
      const t = setInterval(() => { if (++n > 120) return clearInterval(t); if (document.getElementById("app")?.hidden) return; clearInterval(t); showTab("finder"); }, 500);
    }
  } catch { /* 기억 없음 */ }
  globalThis.REFINDER = { maxPrice, loanFor, ownNeeded, jeonseMax, get basket() { return basket; }, search, analyze, drawAi };

  const css = document.createElement("style");
  css.textContent = `
.rf { overflow-y: auto; padding: 8px 12px 16px; display: grid; gap: 8px; align-content: start; }
.rf-note { font-size: 11.5px; color: var(--muted); margin: 0; line-height: 1.5; }
.rf-warn { font-size: 12px; color: #f59e0b; }
.rf-box { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; display: grid; gap: 8px; }
.rf-box > summary, .rf-h { font-weight: 800; font-size: 14px; cursor: pointer; }
.rf-sub > summary { font-size: 12.5px; color: var(--muted); cursor: pointer; }
.rf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px 10px; }
.rf-f { display: grid; grid-template-columns: 1fr auto; gap: 2px 6px; font-size: 12px; align-items: center; }
.rf-f span { grid-column: 1 / -1; color: var(--muted); }
.rf-f input { width: 100%; box-sizing: border-box; padding: 5px 8px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: inherit; font-size: 13px; }
.rf-f small { color: var(--muted); font-size: 11px; }
.rf-chips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.rf-chips button { font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; }
.rf-chips button.on { border-color: var(--accent); color: var(--text); font-weight: 700; background: color-mix(in srgb, var(--accent) 15%, transparent); }
.rf-k { font-size: 12px; color: var(--muted); margin-right: 2px; }
.rf-sum { border-top: 1px dashed var(--line); padding-top: 6px; display: grid; gap: 2px; }
.rf-big { font-size: 16px; font-weight: 800; }
.rf-go { justify-self: start; font: inherit; font-weight: 800; padding: 6px 16px; border-radius: 8px; border: 0; background: var(--accent); color: #fff; cursor: pointer; }
.rf-res { display: grid; gap: 6px; }
.rf-cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 6px; }
.rf-card { border: 1px solid var(--line); border-radius: 10px; padding: 7px 9px; display: grid; gap: 2px; font-size: 12.5px; }
.rf-card.fit { border-color: #22c55e; }
.rf-row1 { display: flex; justify-content: space-between; gap: 6px; align-items: center; }
.rf-link { font: inherit; font-weight: 800; background: none; border: 0; color: var(--text); padding: 0; text-align: left; cursor: pointer; }
.rf-link:hover { text-decoration: underline; }
.rf-add { font: inherit; font-size: 11.5px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; white-space: nowrap; }
.rf-add.on { border-color: #eab308; color: #eab308; font-weight: 700; }
.rf-meta { color: var(--muted); font-size: 11.5px; } .rf-price { font-weight: 700; }
.rf-fit { font-weight: 700; color: var(--muted); } .rf-fit.ok { color: #22c55e; }
.rf-fc { font-size: 11.5px; } .rf-fc.up { color: var(--up, #ef4444); } .rf-fc.down { color: var(--down, #3b82f6); }
.rf-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px; }
.rf-list li { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; } .rf-list small { color: var(--muted); }
.rf-x { font: inherit; font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; margin-left: auto; }
#detail .rf-add { margin: 4px 6px 6px 0; font-size: 12.5px; padding: 4px 12px; }
.rf-btns { display: flex; gap: 4px; }
.rf-ai-btn { border-color: var(--accent) !important; color: var(--text) !important; }
.rf-list li .rf-ai-btn { font: inherit; font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid; background: transparent; cursor: pointer; }
.rf-ai { display: grid; gap: 6px; }
.rf-ai:not(:empty) { border-top: 1px dashed var(--line); padding-top: 8px; }
.rf-ai-head { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
.rf-ai-head .rf-x { margin-left: auto; }
.rf-ai-one { font-weight: 800; font-size: 14px; line-height: 1.5; }
.rf-ai-fit { font-size: 12.5px; line-height: 1.5; padding: 6px 8px; border-radius: 8px; background: color-mix(in srgb, var(--accent) 10%, transparent); }
.rf-ai-nums { display: grid; gap: 1px; font-size: 11.5px; color: var(--muted); }
.rf-ai-sec { font-size: 12.5px; line-height: 1.55; }
.rf-ai-list { font-size: 12.5px; } .rf-ai-list ul { margin: 2px 0 0; padding-left: 18px; line-height: 1.5; }
.rf-ai-list.good b { color: #22c55e; } .rf-ai-list.bad b { color: #f59e0b; }`;
  document.head.append(css);
})();
