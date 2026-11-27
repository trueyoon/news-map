// 부동산 페이지 [내 집 찾기] 탭 (2026-11-23 사용자 "지역·아파트·빌라·오피스텔을 지목했을 때 자세한 분석, 최대 5개 비교로 현재 조건에 맞는 방향, 자산(대출 포함)·지역 입력 칸")
// 1단계(이 파일): 현재 조건 입력(이 브라우저에만 저장) → 살 수 있는 가격 계산 → 조건에 맞는 집 찾기 → 최대 5개 담기. 계산만, AI 없음.
// 2단계(2026-11-23): 담은 집·상세 화면의 [🤖 AI 분석] → 서버 re-item(로그인한 주인만, 하루 20번, 같은 집 7일 안은 저장본) — 보내는 건 집 정보뿐.
//   현재 조건 대비 계산(필요한 내 돈·월 상환)은 AI 답의 숫자로 이 브라우저에서 따로 — 자산·소득은 서버로 안 감
// 3단계(2026-11-23): [⚖️ 담은 집 비교] → ① 집마다 사실 자료(mode=facts, 무료) ② 브라우저가 집마다 필요한 내 돈·여유·월 상환·소득 대비 % 계산
//   ③ 그 숫자 + 목적 + 중요하게 보는 것만 서버로(현금·소득 자체는 안 보냄) → AI 비교(조건 적합도·주고받는 점·상담 질문). 결과는 이 브라우저에만(reFinderCompare)
//   2단계: 담은 집 하나 AI 상세 분석 · 3단계: 담은 집 최대 5개 AI 비교·조건 적합도 정리(투자 자문이 아님 — 최종 판단은 본인·전문가 상담)
// - re-impact.js 가 불러옴(real-estate.html 수정 없음). 탭 버튼·칸을 이 파일이 만들고 showTab·openPlace·openDong 을 감쌈
// - 2026-11-23 사용자: "내 형편" → "현재 조건", 목록 탭과 따로(이 탭에서 지도 동을 눌러도 목록 탭으로 안 넘어감, 상세 화면의 🤖 AI 분석은 그 화면 안에),
//   탭 안에 작은 탭 [🔎 집 찾기 | ⚖️ 매물 비교] — 매물 비교: 이름으로 찾아 담기 + 최대 5개 숫자 표(예상 가격·3.3㎡당·1년 변화·거래·전세가율·필요한 내 돈)
//   + 분기별 3.3㎡당 선 그래프(무료, 계산만) + 원하면 AI 비교. 기억 reFinderView
// - 저장: localStorage reFinderProfile(현재 조건)·reFinderCond(조건)·reFinderBasket(담은 집) — 데이터베이스에는 저장하지 않음(사용자 결정 2026-11-23)
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
  const DEF_COND = { kinds: ["apt"], zones: [], area: 84, tol: 10, minYear: "", minTrades: 3, sort: "fit", priorities: [] };
  const PRIOR = { rise: "가격이 오를 가능성", stable: "가격이 안정적", liquid: "나중에 팔기 쉬움", jeonse: "전세가 잘 나감", newer: "새 건물", low_burden: "대출 부담이 적음", transit: "교통·개발 호재", big: "대단지" };
  let profile = { ...DEF_PROFILE, ...store.get("reFinderProfile", {}) };
  let cond = { ...DEF_COND, ...store.get("reFinderCond", {}) };
  let basket = store.get("reFinderBasket", []);
  const num = v => { const n = Number(String(v ?? "").replace(/[, ]/g, "")); return Number.isFinite(n) ? n : 0; };
  /** 평수(2026-11-26): 아파트는 흔히 부르는 공급 기준 평형(전용 × 1.33 ÷ 3.3 추정, ±1평), 빌라·오피스텔은 전용 평 */
  const pyOf = (kd, a) => (!a ? "" : kd === "apt" ? `${Math.round(a * 1.33 / PY)}평형` : `${Math.round(a / PY)}평`);
  /** 매매가·전세가 크게(사용자 2026-11-26 "내 집 찾기 탭도 매매가·전세가 크게") — 검색 탭 '💰 가격'·집 비교와 같은 차분한 금색·청록 */
  const priceBox = (cls, label, v, sub) => { const x = el("div", `rp-v ${cls}`); x.append(el("small", null, label), el("b", null, v == null ? "–" : won(v))); if (sub) x.append(el("small", null, sub)); return x; };
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
  // 목록 탭과 따로(사용자 2026-11-23): 이 탭에서 지도의 동을 눌러도 목록 탭으로 넘어가지 않음(말풍선의 "목록 보기"를 누를 때만)
  if (typeof openDong === "function") {
    const baseDong = openDong;
    openDong = function (d, move = true, stay = false, ...rest) { return baseDong.call(this, d, move, active ? true : stay, ...rest); };
  }
  // 단지·건물 상세 화면에 "☆ 비교에 담기" + "🤖 AI 분석"(결과는 그 상세 화면 안에 — 다른 탭으로 안 넘어감)
  if (typeof openPlace === "function") {
    const baseOpen = openPlace;
    openPlace = async function (p, ...rest) {
      const r = await baseOpen.call(this, p, ...rest);
      try {
        const box = document.getElementById("detail"), sub = box?.querySelector("p.sub");
        if (sub && p?.place_key && !box.querySelector(".rf-add")) {
          const b = el("button", "rf-add"); b.type = "button";
          const go = el("button", "rf-add rf-go-cmp", "⚖️ 매물 비교 보기"); go.type = "button";
          go.addEventListener("click", () => { view = "compare"; store.set("reFinderView", view); showTab("finder"); });
          const sync = () => { const inB = basket.some(x => keyOf(x) === keyOf(p)); b.textContent = inB ? `★ 매물 비교에 담음 ${basket.length}/5 (빼기)` : `☆ 매물 비교에 담기 ${basket.length}/5`; b.classList.toggle("on", inB); go.hidden = !basket.length; };
          b.addEventListener("click", () => { toggleBasket(p); sync(); });
          sync(); sub.after(b);
          const a = el("button", "rf-add rf-ai-btn", "🤖 AI 분석"); a.type = "button";
          const out = el("div", "rf-ai rf-ai-detail"); out.id = "rfAiDetail";
          a.addEventListener("click", () => analyze(p, false, "rfAiDetail"));
          b.after(a, go, out);
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
  // 탭 안의 작은 탭: [🔎 집 찾기 | ⚖️ 매물 비교] (사용자 2026-11-23 "내 집 찾기 탭 밑에 매물 비교 탭, 5개까지 비교")
  let view = store.get("reFinderView", "find") === "compare" ? "compare" : "find";
  function setView(v) { view = v; store.set("reFinderView", v); render(); pane.scrollTop = 0; }
  function render() {
    if (!active) return;
    const bar = el("div", "rf-tabs"); bar.setAttribute("role", "tablist");
    for (const [k, t] of [["find", "🔎 집 찾기"], ["compare", `⚖️ 매물 비교 ${basket.length}/5`]]) {
      const b = el("button", null, t); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(view === k));
      b.addEventListener("click", () => { if (view !== k) setView(k); });
      bar.append(b);
    }
    if (view === "compare") { pane.replaceChildren(bar, ...compareView()); fillCompare(); return; }
    pane.replaceChildren(bar, ...findView());
    summary();
    if (lastResults) drawResults(lastResults);
  }
  function findView() {
    const parts = [];
    parts.push(el("p", "rf-note", "현재 조건과 원하는 조건으로 집을 찾아요. 마음에 드는 곳은 '☆ 담기'로 최대 5개까지 담아 ⚖️ 매물 비교 탭에서 나란히 봐요. 입력한 숫자는 이 브라우저에만 저장돼요. 계산은 대략이며 투자 자문이 아니에요 — 대출은 은행, 세금은 세무사, 계약은 공인중개사와 꼭 확인하세요."));
    // ① 현재 조건
    const prof = el("details", "rf-box"); prof.open = !num(profile.cash);
    prof.append(el("summary", null, "🧑 현재 조건 (만원 단위)"));
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
    const pri = el("div", "rf-chips");
    pri.append(el("span", "rf-k", "중요하게 보는 것"));
    cond.priorities = cond.priorities || [];
    for (const [k, t] of Object.entries(PRIOR)) {
      const b = el("button", cond.priorities.includes(k) ? "on" : null, t); b.type = "button";
      b.addEventListener("click", () => { cond.priorities = cond.priorities.includes(k) ? cond.priorities.filter(x => x !== k) : [...cond.priorities, k]; save(); render(); });
      pri.append(b);
    }
    const go = el("button", "rf-go", "조건에 맞는 집 찾기"); go.type = "button";
    go.addEventListener("click", () => search());
    cb.append(kinds, zones, cg, pri, go);
    parts.push(cb);
    // ③ 결과
    const res = el("div", "rf-res"); res.id = "rfRes";
    parts.push(res);
    // ④ 담은 집 한 줄(자세한 비교는 매물 비교 탭) ⑤ AI 분석 칸(찾은 집 카드의 🤖 결과)
    const bl = el("div", "rf-basketline");
    bl.append(el("b", null, `★ 담은 집 ${basket.length}/5`), el("span", "rf-note", basket.length ? ` ${basket.map(p => p.name || p.place_key).join(" · ")}` : " 찾은 집의 '☆ 담기'를 누르면 모여요"));
    if (basket.length) { const g = el("button", "rf-add", "⚖️ 매물 비교에서 보기 →"); g.type = "button"; g.addEventListener("click", () => setView("compare")); bl.append(g); }
    const aiOut = el("div", "rf-ai"); aiOut.id = "rfAi";
    if (aiShown) drawAi(aiShown.p, aiShown.r, aiOut);
    parts.push(bl, aiOut);
    return parts;
  }

  // ── ⚖️ 매물 비교 탭: 담은 집 최대 5개를 숫자 표 + 가격 흐름 그래프로 나란히(무료, 계산만) + 원하면 AI 비교 ──
  const LETTERS = ["A", "B", "C", "D", "E"], COLORS = ["#3b82f6", "#f97316", "#22c55e", "#a855f7", "#eab308"];
  const PURPOSE = { live: "실거주로 사기", gap: "전세 끼고 사기", jeonse: "전세 살기" };
  let addQ = "", addRes = null, addSeq = 0, addTimer = 0, cmpSeq = 0;
  function compareView() {
    const parts = [];
    parts.push(el("p", "rf-note", "담은 집을 최대 5개까지 나란히 비교해요. 표·그래프는 국토부 실거래·신규 전세·건축물대장으로 바로 계산해요(무료). 아래 ⚖️ AI 비교는 원할 때만 눌러요. 투자 자문이 아니에요."));
    const cur = el("div", "rf-curcond");
    const cash = num(profile.cash);
    cur.append(el("b", null, "🧑 현재 조건: "), `${PURPOSE[profile.purpose] || ""}${cash ? ` · 보유 현금 ${won(cash)}` : " · 보유 현금 안 넣음"}${num(profile.income) ? ` · 연소득 ${won(num(profile.income))}` : ""} `);
    const ch = el("button", "rf-x", "바꾸기 (🔎 집 찾기)"); ch.type = "button"; ch.addEventListener("click", () => setView("find"));
    cur.append(ch);
    parts.push(cur);
    // 이름으로 찾아 담기
    const ab = el("div", "rf-box");
    const inp = el("input", "rf-q"); inp.type = "search"; inp.placeholder = "단지·건물 이름으로 찾아 담기 (예: 은마, 헬리오시티, 래미안)"; inp.value = addQ; inp.setAttribute("aria-label", "비교할 단지·건물 찾기");
    const out = el("div", "rf-addres"); out.id = "rfAddRes";
    inp.addEventListener("input", () => { addQ = inp.value; clearTimeout(addTimer); addTimer = setTimeout(findToAdd, 300); });
    // 담은 집 칩: 이름 ✕ 로 하나씩 빼기 + 모두 빼기(사용자 2026-11-26 "담은 집을 빼는 기능") — 표 머리의 '빼기'는 집이 많으면 오른쪽으로 밀려 안 보일 때가 있어서
    const bk = el("div", "rf-bchips");
    basket.forEach((p, i) => {
      const c = el("span", "rf-bchip"); const tag = el("span", "rf-letter", LETTERS[i] || "·"); tag.style.background = COLORS[i] || "#6b7280";
      const x = el("button", "rf-bx", "✕"); x.type = "button"; x.title = `${p.name || p.place_key} 빼기`; x.setAttribute("aria-label", `${p.name || p.place_key} 빼기`);
      x.addEventListener("click", () => toggleBasket(p));
      c.append(tag, el("span", null, p.name || p.place_key), x); bk.append(c);
    });
    if (basket.length > 1) { const all = el("button", "rf-ball", "모두 빼기"); all.type = "button"; all.addEventListener("click", () => { if (!confirm(`담은 집 ${basket.length}개를 모두 뺄까요?`)) return; basket.splice(0); store.set("reFinderBasket", basket); render(); }); bk.append(all); }
    ab.append(el("div", "rf-h", `★ 담은 집 ${basket.length}/5`), ...(basket.length ? [bk] : []), inp, out);
    if (addRes) drawAddRes(out);
    parts.push(ab);
    const num0 = el("div", "rf-cmpnum"); num0.id = "rfCmpNum";
    parts.push(num0);
    // AI 비교
    const aib = el("div", "rf-box");
    aib.append(el("div", "rf-h", "⚖️ AI 비교 (원할 때만)"));
    if (basket.length >= 2) {
      const cmp = el("button", "rf-go", `담은 집 ${basket.length}개 AI 비교 (약 $0.15)`); cmp.type = "button";
      cmp.addEventListener("click", () => compare());
      aib.append(cmp, el("p", "rf-note", "AI 에는 브라우저가 계산한 숫자(집마다 필요한 내 돈·여유·월 상환·소득 대비 %)와 목적·중요하게 보는 것만 보내요. 보유 현금·소득 자체는 보내지 않고, 결과는 이 브라우저에만 남아요."));
    } else aib.append(el("p", "rf-note", "2개 이상 담으면 AI 비교를 할 수 있어요."));
    const cmpOut = el("div", "rf-ai"); cmpOut.id = "rfCmp";
    const lastCmp = store.get("reFinderCompare", null);
    if (lastCmp?.r) drawCompare(lastCmp, cmpOut);
    const aiOut = el("div", "rf-ai"); aiOut.id = "rfAi";
    if (aiShown) drawAi(aiShown.p, aiShown.r, aiOut);
    aib.append(cmpOut);
    parts.push(aib, aiOut);
    return parts;
  }
  async function findToAdd() {
    const q = addQ.trim().replace(/[%_*,()\\]/g, " ").replace(/\s+/g, " ");
    const my = ++addSeq, out = document.getElementById("rfAddRes");
    if (q.length < 2) { addRes = null; if (out) out.replaceChildren(); return; }
    if (out) out.replaceChildren(el("p", "rf-note", "찾는 중…"));
    const { data, error } = await db.from("re_places").select("kind,sgg_cd,umd_nm,place_key,name,build_year,trades,trades_12m,last_date,last_price,last_area,pyeong_12m")
      .ilike("name", `%${q}%`).order("trades_12m", { ascending: false }).limit(20);
    if (my !== addSeq) return;
    addRes = error ? { error: true } : { rows: data || [] };
    const o = document.getElementById("rfAddRes");
    if (o) drawAddRes(o);
  }
  function drawAddRes(out) {
    if (addRes?.error) { out.replaceChildren(el("p", "rf-warn", "찾지 못했어요. 잠시 뒤 다시 해 주세요.")); return; }
    if (!addRes?.rows?.length) { out.replaceChildren(el("p", "rf-note", `"${addQ.trim()}"에 맞는 단지·건물이 없어요.`)); return; }
    const ul = el("ul", "rf-list");
    for (const r of addRes.rows) {
      const li = el("li"), inB = basket.some(x => keyOf(x) === keyOf(r));
      const b = el("button", inB ? "rf-add on" : "rf-add", inB ? "★ 담음" : "＋ 담기"); b.type = "button";
      b.addEventListener("click", () => toggleBasket(r));
      li.append(b, el("span", null, `${KIND[r.kind]?.name || r.kind} · ${r.name || r.place_key}`),
        el("small", null, `${SGG[r.sgg_cd]?.name || ""} ${r.umd_nm}${r.build_year ? ` · ${r.build_year}년` : ""} · 12개월 ${r.trades_12m ?? 0}건${r.pyeong_12m ? ` · 3.3㎡당 ${won(r.pyeong_12m)}` : ""}`));
      ul.append(li);
    }
    out.replaceChildren(ul);
  }
  // 집마다 자료(10분 기억): 3년 실거래 · 지도 요약 · 신규 전세(12개월) · 건축물대장
  const cmpCache = new Map();
  async function loadOne(p) {
    const k = keyOf(p), c = cmpCache.get(k);
    if (c && Date.now() - c.at < 10 * 60e3) return c.d;
    const T = KIND[p.kind]?.table, since = new Date(Date.now() - 3 * 365.25 * 864e5).toISOString().slice(0, 10);
    const same = q => q.eq("kind", p.kind).eq("sgg_cd", p.sgg_cd).eq("umd_nm", p.umd_nm).eq("place_key", p.place_key);
    const tradesQ = (async () => {
      const out = [];
      for (let off = 0; off < 6000; off += 1000) {
        let q = db.from(T).select("deal_date,excl_area,price,canceled").eq("sgg_cd", p.sgg_cd);
        q = p.kind === "apt" ? q.eq("apt_seq", p.place_key) : q.eq("umd_nm", p.umd_nm).eq("jibun", p.place_key);
        const { data, error } = await q.gte("deal_date", since).order("deal_date", { ascending: false }).order("trade_key", { ascending: false }).range(off, off + 999);
        if (error) throw error;
        out.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return out;
    })();
    const [trades, pl, jr, br] = await Promise.all([tradesQ,
      same(db.from("re_places").select("name,build_year,trades_12m,pyeong_12m")).maybeSingle(),
      same(db.from("re_rent_jeonse").select("deal_date,excl_area,deposit")).limit(3000),
      same(db.from("re_buildings").select("units,unit_label,dong_cnt,max_floor,use_apr,match")).maybeSingle()]);
    const d = { trades, place: pl.data || null, jeonse: jr.data || [], bld: br.error || !br.data || br.data.match === "error" ? null : br.data };
    cmpCache.set(k, { at: Date.now(), d });
    return d;
  }
  /** 크기 고르기 — 서버 re-item lib.js pickSize 와 같은 규칙(2026-11-24): 거래 전용면적이 3㎡ 넘게 벌어지면 다른 크기,
   *  원하는 면적이 그 집에 없으면(최근 12개월 3건 이상 — 없으면 1건 이상 — 거래된 크기 중 ±5/8㎡ 안에 없음) 가장 가까운 실제 크기로. 다른 크기 거래는 안 섞음 */
  function pickSize(trades, A, since12) {
    const xs = trades.filter(t => Number(t.excl_area) > 0).map(t => ({ a: Number(t.excl_area), r: !t.canceled && String(t.deal_date) >= since12 })).sort((x, y) => x.a - y.a);
    const gs = [];
    for (const x of xs) { const g = gs.at(-1); if (g && x.a - g.max <= 3) { g.max = x.a; g.areas.push(x.a); g.n12 += x.r ? 1 : 0; } else gs.push({ min: x.a, max: x.a, areas: [x.a], n12: x.r ? 1 : 0 }); }
    const groups = gs.map(g => ({ min: g.min, max: g.max, n: g.areas.length, n12: g.n12, mid: med(g.areas) }));
    const tol = A <= 40 ? 5 : 8, busy = groups.filter(g => g.n12 >= 3), live = groups.filter(g => g.n12 > 0), cand = busy.length ? busy : live.length ? live : groups;
    if (!cand.length) return { used: A, requested: A, tol, lo: A - tol, hi: A + tol, groups, moved: false };
    const dist = g => (A < g.min ? g.min - A : A > g.max ? A - g.max : 0);
    const best = [...cand].sort((x, y) => dist(x) - dist(y) || y.n12 - x.n12 || y.n - x.n)[0];
    const moved = dist(best) > tol, used = moved ? Math.round(best.mid) : A, t2 = used <= 40 ? 5 : 8;
    return { used, requested: A, tol: t2, lo: Math.max(best.min, used - t2) - 0.01, hi: Math.min(best.max, used + t2) + 0.01, groups, moved };
  }
  const med = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const isoAgo = days => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  /** 집 하나의 비교 숫자(비교 면적 A 기준) */
  function metrics(p, d) {
    const d12 = isoAgo(365), d24 = isoAgo(730), sz = pickSize(d.trades, areaOf(p), d12), A = sz.used, tol = sz.tol, inSize = a => Number(a) >= sz.lo && Number(a) <= sz.hi;
    const ok = d.trades.filter(t => !t.canceled && Number(t.excl_area) > 0 && t.price > 0);
    const ppy = t => t.price / Number(t.excl_area) * PY;
    const y1 = ok.filter(t => t.deal_date >= d12), y0 = ok.filter(t => t.deal_date < d12 && t.deal_date >= d24);
    const ppy12 = med(y1.map(ppy)) ?? d.place?.pyeong_12m ?? p.pyeong_12m ?? null, ppyPrev = med(y0.map(ppy));
    const q = new Map();                                        // 분기별 3.3㎡당 중간값(그래프·최고점)
    for (const t of ok) { const k = `${t.deal_date.slice(0, 4)}-${Math.floor((Number(t.deal_date.slice(5, 7)) - 1) / 3)}`; (q.get(k) || q.set(k, []).get(k)).push(ppy(t)); }
    const quarters = [...q].map(([k, xs]) => ({ k, v: med(xs), n: xs.length })).sort((a, b) => (a.k < b.k ? -1 : 1));
    const peak = quarters.length ? Math.max(...quarters.map(x => x.v)) : null;
    const near = y1.filter(t => inSize(t.excl_area));
    const nearMed = near.length >= 3 ? med(near.map(t => t.price / Number(t.excl_area) * A)) : null;   // 비슷한 면적 거래를 A㎡로 맞춘 중간값
    const price = nearMed ?? (ppy12 ? ppy12 * A / PY : null);
    const jn = d.jeonse.filter(j => Number(j.excl_area) >= sz.lo - 1 && Number(j.excl_area) <= sz.hi + 1);
    const jeonse = jn.length ? med(jn.map(j => j.deposit / Number(j.excl_area))) * A : null;
    const last = ok[0] || null;
    const cx12 = d.trades.filter(t => t.canceled && t.deal_date >= d12).length;
    // 현재 조건 대비(이 브라우저에서만)
    const cash = num(profile.cash), pr = profile.purpose, m = { need: null, margin: null, monthly: null, ratio: null, loan: null };
    if (cash) {
      if (pr === "jeonse" && jeonse) { const L = num(profile.loanDirect) > 0 ? Math.min(num(profile.loanDirect), jeonse) : Math.min(jeonse * num(profile.jeonseLoanPct) / 100, num(profile.jeonseLoanCap) || Infinity); m.loan = L; m.need = jeonse - L; }
      else if (pr === "gap" && price && jeonse) { m.need = price * (1 + num(profile.costPct) / 100) - jeonse; m.loan = 0; }
      else if (pr === "live" && price) { m.loan = loanFor(price); m.need = ownNeeded(price); m.monthly = pmt(m.loan, num(profile.rate), num(profile.years) || 30); m.ratio = num(profile.income) ? m.monthly * 12 / num(profile.income) * 100 : null; }
      if (m.need != null) m.margin = cash - m.need;
    }
    const zone = R()?.zoneOf?.(p.sgg_cd), fc = zone && forecasts[zone.id];
    return { A, tol, sz, ppy12, chg: ppy12 && ppyPrev ? (ppy12 / ppyPrev - 1) * 100 : null, fromPeak: ppy12 && peak ? (ppy12 / peak - 1) * 100 : null,
      price, priceBasis: nearMed != null ? `같은 크기 거래 ${near.length}건 중간값` : "3.3㎡당 × 면적 추정", n12: y1.length, cx12, last, jeonse, jn: jn.length,
      ratio: jeonse && price ? jeonse / price * 100 : null, quarters, m, zone, fc, bld: d.bld, built: d.place?.build_year ?? p.build_year ?? null };
  }
  async function fillCompare() {
    const box = document.getElementById("rfCmpNum");
    if (!box) return;
    if (!basket.length) { box.replaceChildren(el("p", "rf-note", "아직 담은 집이 없어요. 위에서 이름으로 찾아 담거나, 🔎 집 찾기 결과·목록·통계에서 연 단지 상세 화면의 '☆ 매물 비교에 담기'를 누르세요.")); return; }
    const my = ++cmpSeq, items = basket.slice();
    box.replaceChildren(el("p", "rf-note", `담은 집 ${items.length}개 자료 불러오는 중…`));
    let ds;
    try { ds = await Promise.all(items.map(loadOne)); }
    catch (e) { if (my === cmpSeq) { const b = document.getElementById("rfCmpNum"); if (b) b.replaceChildren(el("p", "rf-warn", `불러오지 못했어요: ${e.message || e}`)); } return; }
    if (my !== cmpSeq) return;
    const b = document.getElementById("rfCmpNum");
    if (!b) return;
    // 비교 면적: 직접 고친 집(areaSet)은 그 면적, 아니면 원하는 전용면적을 물어보고, 그 크기가 그 집에 없으면 pickSize 가 가장 가까운 실제 크기로(AI 서버도 같은 규칙)
    const ms = items.map((p, i) => metrics(p, ds[i]));
    b.replaceChildren(cmpPriceCards(items, ms, ds), cmpTable(items, ms), cmpChart(items, ms),
      el("p", "rf-note", "예상 가격 = 최근 12개월 같은 집의 비슷한 면적 거래(3건 이상)를 비교 면적으로 맞춘 중간값, 없으면 3.3㎡당 중간값 × 면적. 신규 전세는 최근 12개월 비슷한 면적. 층·향·상태·실제 매물가는 다를 수 있어요. '필요한 내 돈'은 🔎 집 찾기의 현재 조건으로 이 브라우저에서만 계산해요."));
  }
  /** 💰 가격 한눈에(사용자 2026-11-26): 담은 집마다 카드 — 크기·평수, 예상 매매가(금색)·전세가(청록) 크게, A보다 %, 평당·전세가율·갭, 현재 조건이면 여유/부족 */
  function cmpPriceCards(items, ms, ds = []) {
    const sec = el("div", "rp-sec");
    sec.append(el("div", "rp-h", "💰 가격 한눈에"));
    const grid = el("div", "rp-cards");
    items.forEach((p, i) => {
      const m = ms[i], c = el("div", "rp-card");
      const top = el("div", "rp-top"), tag = el("span", "rf-letter", LETTERS[i]); tag.style.background = COLORS[i];
      const nm = el("button", "rf-link", p.name || p.place_key); nm.type = "button"; nm.title = "상세 화면 열기"; nm.addEventListener("click", () => openPlace(p));
      top.append(tag, nm);
      const vs = (v, base) => { if (!i || !v || !base) return ""; const d = (v / base - 1) * 100; return `A보다 ${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(0)}%`; };
      // 평수 단추(사용자 2026-11-27 "내 집 찾기에도"): 그 집에서 최근 12개월 거래된 크기마다 — 누르면 비교 면적을 그 크기로(표의 면적 칸과 같은 area·areaSet) → 카드·표·필요한 내 돈 다시 계산
      const d12 = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
      const okT = (ds[i]?.trades || []).filter(t => !t.canceled && t.price > 0 && Number(t.excl_area) > 0);
      const inSz = t => Number(t.excl_area) >= m.sz.lo && Number(t.excl_area) <= m.sz.hi;
      const nSize12 = okT.filter(t => t.deal_date >= d12 && inSz(t)).length;
      const gs = (m.sz?.groups || []).filter(g => g.n12 > 0).sort((a, b) => a.mid - b.mid);
      const chips = el("div", "rp-chips");
      if (gs.length > 1) for (const g of gs) {
        const on = m.A >= g.min - 0.5 && m.A <= g.max + 0.5;
        const b = el("button", on ? "on" : null); b.type = "button"; b.setAttribute("aria-pressed", String(on));
        b.append(el("b", null, pyOf(p.kind, g.mid)), el("small", null, ` ${Math.round(g.mid)}㎡ · ${g.n12}건`));
        b.title = `전용 ${Math.round(g.min)}${Math.round(g.min) !== Math.round(g.max) ? `~${Math.round(g.max)}` : ""}㎡ · 최근 12개월 ${g.n12}건 — 이 크기로 비교`;
        b.addEventListener("click", () => { const x = basket.find(y => keyOf(y) === keyOf(p)); if (x) { x.area = Math.round(g.mid); x.areaSet = true; store.set("reFinderBasket", basket); } fillCompare(); });
        chips.append(b);
      }
      const rec = okT.filter(inSz).slice(0, 3);
      const recBox = el("div", "rp-rec");
      if (rec.length) { recBox.append(el("small", null, "이 평수 최근 거래")); for (const t of rec) { const r = el("div"); r.append(el("small", null, String(t.deal_date).slice(2).replaceAll("-", ".")), el("b", null, won(t.price)), el("small", null, `${Math.round(Number(t.excl_area))}㎡`)); recBox.append(r); } }
      else recBox.append(el("small", null, "이 평수는 최근 3년 거래가 없어 평당 가격으로 추정했어요"));
      c.append(top, el("div", "rp-size", `📐 전용 ${m.A}㎡ · 약 ${pyOf(p.kind, m.A)}${p.kind === "apt" ? "(추정)" : ""} · 이 평수 12개월 ${nSize12}건`));
      if (chips.childElementCount) c.append(chips);
      c.append(
        priceBox("sale", "🏠 예상 매매가", m.price, `${vs(m.price, ms[0].price) || m.priceBasis}${i && Math.abs(m.A - ms[0].A) > 5 ? " · 크기 다름" : ""}`),
        priceBox("jeon", "🔑 전세가 (신규)", m.jeonse, m.jeonse ? `${m.jn}건 중간값${vs(m.jeonse, ms[0].jeonse) ? ` · ${vs(m.jeonse, ms[0].jeonse)}` : ""}` : "전세 기록 없음"),
        el("div", "rp-sub", `평당 ${won(m.ppy12)} · 전세가율 ${m.ratio != null ? `${Math.round(m.ratio)}%` : "–"} · 갭 ${m.price && m.jeonse ? won(m.price - m.jeonse) : "–"}`));
      if (num(profile.cash) > 0 && m.m?.margin != null) c.append(el("div", m.m.margin >= 0 ? "rp-ok" : "rp-bad", m.m.margin >= 0 ? `✓ 현재 조건으로 여유 ${won(m.m.margin)}` : `✗ 현재 조건으로 ${won(-m.m.margin)} 부족`));
      if (m.ratio >= 80) c.append(el("div", "rp-bad", "⚠ 전세가율 80%↑ — 깡통전세 주의"));
      c.append(recBox);
      grid.append(c);
    });
    sec.append(grid);
    return sec;
  }
  function cmpTable(items, ms) {
    const pc = v => (v == null ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`);
    const tbl = el("table", "rf-cmp-t rf-cmp-num");
    const row = (k, f, cls) => { const tr = el("tr", cls || null); tr.append(el("th", null, k), ...items.map((p, i) => { const td = el("td"); const v = f(p, ms[i], i); if (v instanceof Node) td.append(v); else td.textContent = v ?? "–"; return td; })); tbl.append(tr); };
    // 머리: 글자·이름(누르면 상세)·🤖·빼기
    const hr = el("tr");
    hr.append(el("th"), ...items.map((p, i) => {
      const th = el("th"), nm = el("button", "rf-link", p.name || p.place_key); nm.type = "button"; nm.addEventListener("click", () => openPlace(p));
      const tag = el("span", "rf-letter", LETTERS[i]); tag.style.background = COLORS[i];
      const acts = el("div", "rf-acts");
      const ai = el("button", "rf-x", "🤖 AI 분석"); ai.type = "button"; ai.addEventListener("click", () => analyze(p));
      const rm = el("button", "rf-x rf-rm", "✕ 빼기"); rm.type = "button"; rm.addEventListener("click", () => toggleBasket(p));
      acts.append(ai, rm);
      th.append(tag, nm, acts);
      return th;
    }));
    tbl.append(hr);
    row("종류·위치", p => `${KIND[p.kind]?.name || p.kind} · ${SGG[p.sgg_cd]?.name || ""} ${p.umd_nm}`);
    row("준공·규모", (p, m) => [m.built ? `${m.built}년` : null, m.bld?.units ? `${m.bld.units.toLocaleString()}${m.bld.unit_label || "세대"}` : null, m.bld?.dong_cnt ? `${m.bld.dong_cnt}개 동` : null, m.bld?.max_floor ? `최고 ${m.bld.max_floor}층` : null].filter(Boolean).join(" · ") || "–");
    row("비교 면적 (전용㎡)", (p, m) => {
      const w = el("span", "rf-area"), inp = el("input"); inp.type = "text"; inp.inputMode = "numeric"; inp.value = m.A; inp.setAttribute("aria-label", `${p.name || p.place_key} 비교 면적`);
      inp.addEventListener("change", () => { const v = Math.round(num(inp.value)); if (v > 5 && v < 400) { const x = basket.find(y => keyOf(y) === keyOf(p)); if (x) { x.area = v; x.areaSet = true; store.set("reFinderBasket", basket); } } fillCompare(); });
      w.append(inp, `㎡ · 약 ${pyOf(p.kind, m.A)}`);
      const box = el("span", "rf-sizes");
      if (m.sz.moved) box.append(el("small", "rf-bad", `원하는 ${m.sz.requested}㎡ 크기는 이 집에 없어 ${m.A}㎡ 로 봤어요`));
      const types = m.sz.groups.filter(g => g.n12 > 0).map(g => `${Math.round(g.min) === Math.round(g.max) ? Math.round(g.min) : `${Math.round(g.min)}~${Math.round(g.max)}`}㎡(${pyOf(p.kind, g.mid ?? g.min)}) ${g.n12}건`);
      if (types.length) box.append(el("small", "rf-note", `이 집 크기(최근 12개월 거래): ${types.join(" · ")}`));
      if (box.childNodes.length) { const wrap = el("span"); wrap.append(w, box); return wrap; }
      return w;
    });
    row("🏠 예상 매매가", (p, m) => { const s = el("span"); s.append(el("b", null, won(m.price)), el("small", "rf-note", ` ${m.priceBasis}`)); return s; }, "rf-strong rp-row-sale");
    row("🔑 전세가 (신규, 비교 면적)", (p, m) => { if (!m.jeonse) return "거래 없음"; const s = el("span"); s.append(el("b", null, won(m.jeonse)), el("small", "rf-note", ` ${m.jn}건`)); return s; }, "rf-strong rp-row-jeon");
    row("평당 (3.3㎡당, 최근 12개월)", (p, m) => won(m.ppy12));
    row("1년 전보다 (평당)", (p, m) => pc(m.chg));
    row("3년 중 가장 높던 분기보다", (p, m) => pc(m.fromPeak));
    row("거래 (12개월 · 해제)", (p, m) => `${m.n12}건 · 해제 ${m.cx12}`);
    row("마지막 거래", (p, m) => (m.last ? `${won(m.last.price)} · ${Math.round(Number(m.last.excl_area))}㎡(${pyOf(p.kind, Number(m.last.excl_area))}) · ${m.last.deal_date.slice(2).replaceAll("-", ".")}` : "–"));
    row("갭 (매매 − 전세)", (p, m) => (m.price && m.jeonse ? (() => { const g = m.price - m.jeonse, s = el("span", g <= 0 ? "rf-bad" : null, won(g)); if (m.ratio >= 80) s.append(el("small", "rf-bad", " 전세가율 80%↑ 위험")); return s; })() : "–"), "rf-strong");
    row("전세가율", (p, m) => (m.ratio != null ? `${Math.round(m.ratio)}%` : "–"));
    const pr = profile.purpose;
    if (num(profile.cash)) {
      row(pr === "jeonse" ? "필요한 내 돈 (보증금 − 대출)" : pr === "gap" ? "필요한 내 돈 (매매 − 전세 + 비용)" : "필요한 내 돈 (비용 포함)", (p, m) => won(m.m.need), "rf-strong");
      row("여유 / 부족", (p, m) => { const v = m.m.margin; if (v == null) return "–"; return el("span", v >= 0 ? "rf-ok" : "rf-bad", v >= 0 ? `✓ 여유 ${won(v)}` : `✗ ${won(-v)} 부족`); });
      if (pr === "live") row("대출 · 월 상환 (소득 대비)", (p, m) => (m.m.loan != null ? `${won(m.m.loan)} · 월 ${won(m.m.monthly)}${m.m.ratio != null ? ` (${Math.round(m.m.ratio)}%)` : ""}` : "–"));
    } else row("필요한 내 돈", () => "🔎 집 찾기에서 보유 현금을 넣으면 계산해요");
    if (ms.some(m => m.fc)) row("권역 AI 예측 (3개월)", (p, m) => (m.fc ? el("span", `rf-fc ${m.fc.call}`, `${m.zone.name} ${m.fc.call === "up" ? "▲ 상승" : "▼ 하락"} ${m.fc.prob}%`) : m.zone ? `${m.zone.name} · 예측 없음` : "–"));
    const wrap = el("div", "rf-cmp-wrap"); wrap.append(tbl);
    return wrap;
  }
  /** 분기별 3.3㎡당 중간값 선 그래프(최근 3년, 집마다 색·글자) */
  function cmpChart(items, ms) {
    const keys = [...new Set(ms.flatMap(m => m.quarters.map(q => q.k)))].sort();
    const box = el("div", "rf-chart");
    box.append(el("div", "rf-h", "📈 3.3㎡당 가격 흐름 (분기별 중간값, 최근 3년)"));
    if (keys.length < 2) { box.append(el("p", "rf-note", "그래프를 그릴 거래가 모자라요.")); return box; }
    const vals = ms.flatMap(m => m.quarters.map(q => q.v)), lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.08 || hi * 0.05;
    const W = 640, H = 260, L = 86, Rt = 12, T = 12, B = 30, x = i => L + (W - L - Rt) * (keys.length === 1 ? 0.5 : i / (keys.length - 1)), y = v => T + (H - T - B) * (1 - (v - (lo - pad)) / ((hi + pad) - (lo - pad)));
    const NS = "http://www.w3.org/2000/svg", mk = (t, a) => { const e = document.createElementNS(NS, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
    const svg = mk("svg", { viewBox: `0 0 ${W} ${H}`, class: "rf-svg", role: "img", "aria-label": "담은 집 3.3㎡당 가격 흐름" });
    for (let i = 0; i <= 3; i++) {
      const v = lo - pad + ((hi + pad) - (lo - pad)) * i / 3, yy = y(v);
      svg.append(mk("line", { x1: L, x2: W - Rt, y1: yy, y2: yy, class: "rf-grid-l" }));
      const t = mk("text", { x: L - 8, y: yy + 6, "text-anchor": "end", class: "rf-ax" }); t.textContent = typeof fmtShort === "function" ? fmtShort(v) : Math.round(v); svg.append(t);
    }
    keys.forEach((k, i) => { if (k.endsWith("-0")) { const t = mk("text", { x: x(i), y: H - 6, "text-anchor": "start", class: "rf-ax" }); t.textContent = `${k.slice(0, 4)}년`; svg.append(t); } });
    ms.forEach((m, j) => {
      const pts = m.quarters.map(q => [x(keys.indexOf(q.k)), y(q.v), q]);
      if (!pts.length) return;
      if (pts.length > 1) svg.append(mk("polyline", { points: pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "), fill: "none", stroke: COLORS[j], "stroke-width": 3, "stroke-linejoin": "round" }));
      for (const [px, py, q] of pts) { const c = mk("circle", { cx: px, cy: py, r: 4.5, fill: COLORS[j] }); const tt = mk("title", {}); tt.textContent = `${LETTERS[j]} ${items[j].name || items[j].place_key} · ${q.k.slice(0, 4)}년 ${Number(q.k.slice(5)) + 1}분기 · 3.3㎡당 ${won(q.v)} (${q.n}건)`; c.append(tt); svg.append(c); }
    });
    const lg = el("div", "rf-legend");
    items.forEach((p, j) => { const s = el("span"); const dot = el("i"); dot.style.background = COLORS[j]; s.append(dot, `${LETTERS[j]} ${p.name || p.place_key}`); lg.append(s); });
    box.append(svg, lg, el("p", "rf-note", "점에 마우스를 올리면 그 분기 값·거래 수가 보여요. 거래가 적은 분기는 값이 크게 튈 수 있어요."));
    return box;
  }

  // ── 2단계: AI 상세 분석 ──
  let aiShown = null, aiBusy = false;
  // 물어볼 면적: 매물 비교에서 직접 고친 집은 그 값, 찾은 집 카드는 원하는 면적(area 로 넘김), 나머지는 원하는 전용면적 — 실제 크기 고르기는 서버·pickSize 가 함
  const areaOf = p => Math.round((p.areaSet || p.areaFromCard ? num(p.area) : 0) || num(cond.area) || 84);
  async function analyze(p, force = false, outId = "rfAi") {     // outId: 결과 칸(내 집 찾기 탭 rfAi / 단지 상세 화면 rfAiDetail)
    if (aiBusy) return;
    const out = document.getElementById(outId);
    const show = (...xs) => { const o = document.getElementById(outId); if (o) o.replaceChildren(...xs); };
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
      if (outId === "rfAi") aiShown = { p, r: j };
      const o = document.getElementById(outId);
      if (o) drawAi(p, j, o, outId);
    } catch (e) { show(el("div", "rf-warn", `AI 분석을 하지 못했어요: ${e.message || e}`)); }
    finally { aiBusy = false; }
  }
  function drawAi(p, j, out, outId = "rfAi") {
    const n = j.note || {}, F = id => (j.facts || []).find(f => f.id === id) || {};
    const sec = (title, x) => { if (!x?.text) return null; const d = el("div", "rf-ai-sec"); d.append(el("b", null, title), el("span", null, ` ${x.text}`)); return d; };
    const list = (title, xs, cls) => { if (!xs?.length) return null; const d = el("div", `rf-ai-list ${cls || ""}`); d.append(el("b", null, title)); const ul = el("ul"); for (const x of xs) ul.append(el("li", null, x.text || x)); d.append(ul); return d; };
    const head = el("div", "rf-ai-head");
    const f1 = (j.facts || []).find(f => f.id === "F1") || {};
    head.append(el("div", "rf-h", `🤖 ${p.name || p.place_key} · 전용 ${f1.area_m2 || areaOf(p)}㎡`), el("small", "rf-note", `${j.cached ? "저장된 분석" : "새 분석"} · ${String(j.day || "").slice(5).replace("-", "/")} · 확신 ${n.confidence || "–"}${j.cost_usd ? ` · $${j.cost_usd}` : ""}${j.used ? ` · 오늘 ${j.used}/${j.limit}번` : ""}`));
    const again = el("button", "rf-x", "다시 분석(비용 듦)"); again.type = "button"; again.addEventListener("click", () => { if (confirm("새로 분석하면 AI 비용이 들고 하루 20번 중 1번을 써요. 할까요?")) analyze(p, true, outId); });
    head.append(again);
    // 현재 조건 대비(브라우저에서만 계산)
    const f2 = F("F2"), f3 = F("F3"), price = f2.recent_6m?.median_manwon || f2.prev_6m?.median_manwon || null;
    const fit = el("div", "rf-ai-fit");
    if (price && num(profile.cash)) {
      const pr = profile.purpose;
      if (pr === "jeonse") { const j2 = f3.median_manwon, jm = jeonseMax(); fit.append(el("b", null, "🧑 현재 조건으로 보면 "), j2 ? `신규 전세 중간값 약 ${won(j2)} → ${j2 <= jm.max ? `✓ 가능(최대 ${won(jm.max)})` : `✗ 모자람(최대 ${won(jm.max)})`}` : "신규 전세 거래가 없어 계산 못 해요"); }
      else if (pr === "gap") { const j2 = f3.median_manwon; fit.append(el("b", null, "🧑 현재 조건으로 보면 "), j2 ? `매매 ${won(price)} − 전세 ${won(j2)} + 비용 ${profile.costPct}% = 필요한 내 돈 약 ${won(price * (1 + num(profile.costPct) / 100) - j2)} (가진 돈 ${won(num(profile.cash))})` : "신규 전세 거래가 없어 계산 못 해요"); }
      else { const L = loanFor(price), need = ownNeeded(price); fit.append(el("b", null, "🧑 현재 조건으로 보면 "), `최근 거래 중간값 ${won(price)} 기준 — 대출 약 ${won(L)}, 필요한 내 돈 약 ${won(need)} ${need <= num(profile.cash) ? `✓ 가능 (여유 ${won(num(profile.cash) - need)})` : "✗ 모자람"}, 월 상환 약 ${won(pmt(L, num(profile.rate), num(profile.years) || 30))}`); }
      fit.append(el("small", "rf-note", " (이 계산은 이 브라우저에서만 — 서버·AI 로 안 보냄)"));
    } else fit.append(el("span", "rf-note", "🧑 '현재 조건'에 보유 현금을 넣으면 이 집 기준 필요한 내 돈·월 상환을 계산해 드려요(이 브라우저에서만)."));
    const nums = el("div", "rf-ai-nums");
    const pct = v => (v == null ? "–" : `${v > 0 ? "+" : ""}${v}%`);
    nums.append(el("span", null, `최근 6개월 ${f2.recent_6m?.n ?? 0}건 중간값 ${won(f2.recent_6m?.median_manwon)} (직전 6개월 ${pct(f2.change_vs_prev_6m_pct)}, 1년 전 ${pct(f2.change_vs_year_pct)})`),
      el("span", null, `최고점 대비 ${pct(f2.from_peak_pct)} · 12개월 거래 ${f2.trades_12m ?? "–"}건(해제 ${f2.canceled_12m ?? 0})`),
      el("span", null, `신규 전세 ${f3.n_12m ?? 0}건 ${won(f3.median_manwon)} · 전세가율 ${f3.jeonse_ratio_pct ?? "–"}%`));
    const parts = [head, f1.size_note ? el("div", "rf-warn", `📐 ${f1.size_note}${f1.size_types?.length ? ` (이 집 크기: ${f1.size_types.filter(t => t.trades_12m).map(t => `${Math.round(t.area_from) === Math.round(t.area_to) ? Math.round(t.area_from) : `${Math.round(t.area_from)}~${Math.round(t.area_to)}`}㎡ ${t.trades_12m}건`).join(" · ")})` : ""}`) : null,
      n.one_line ? el("div", "rf-ai-one", n.one_line.text) : null, fit, nums,
      sec("💰 가격", n.price), sec("🏠 전세", n.jeonse), sec("🔄 거래(팔기 쉬움)", n.liquidity), sec("🗺️ 지역 흐름", n.area_outlook),
      list("👍 좋은 점", n.strengths, "good"), list("👎 아쉬운 점", n.weaknesses, "bad"), list("⚠️ 위험", n.risks, "bad"),
      list("📰 뉴스 속 전망 (기사 제목 기준)", n.expert_views), list("✅ 알아볼 때 확인할 것", n.checklist),
      el("p", "rf-note", "AI 가 국토부 실거래·전세·건축물대장·청약홈·한국은행·KOSIS·뉴스 제목만 보고 정리한 참고 자료예요. 투자 자문이 아니며, 실제 매물·대출·세금은 공인중개사·은행·세무사와 꼭 확인하세요.")].filter(Boolean);
    out.replaceChildren(...parts);
  }

  // ── 3단계: 담은 집 비교 ──
  let cmpBusy = false;
  async function callFn(mode, body) {
    const token = (await db.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error("로그인이 필요해요");
    const r = await fetch(`${SUPABASE_URL}/functions/v1/re-item?mode=${mode}`, { method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || `서버 오류 ${r.status}`);
    return j;
  }
  const itemBody = p => ({ kind: p.kind, sgg_cd: p.sgg_cd, umd_nm: p.umd_nm, place_key: p.place_key, area: areaOf(p), name: p.name, region: `${SGG[p.sgg_cd]?.sido || ""} ${SGG[p.sgg_cd]?.name || ""}`.trim() });
  /** 집 하나의 내 돈 숫자(브라우저에서만) — 사실 자료(F2·F3)의 최근 중간값 기준 */
  function moneyFor(facts) {
    const F = id => facts.find(f => f.id === id) || {}, f2 = F("F2"), f3 = F("F3"), P = f2.recent_6m?.median_manwon || f2.prev_6m?.median_manwon || null, J = f3.median_manwon || null;
    const income = num(profile.income), cash = num(profile.cash), pr = profile.purpose, out = { price: P, jeonse: J };
    if (pr === "jeonse") {
      if (!J) return out;
      const loanJ = num(profile.loanDirect) > 0 ? Math.min(num(profile.loanDirect), J) : Math.min(J * num(profile.jeonseLoanPct) / 100, num(profile.jeonseLoanCap) || Infinity);
      return { ...out, need: J - loanJ, loan: loanJ, margin: cash - (J - loanJ), monthly: null };
    }
    if (!P) return out;
    if (pr === "gap") { if (!J) return out; const need = P * (1 + num(profile.costPct) / 100) - J; return { ...out, need, loan: 0, margin: cash - need, monthly: 0 }; }
    const L = loanFor(P), need = ownNeeded(P), m = pmt(L, num(profile.rate), num(profile.years) || 30);
    return { ...out, need, loan: L, margin: cash - need, monthly: m, ratio: income ? (m * 12 / income) * 100 : null };
  }
  async function compare(force) {
    if (cmpBusy) return;
    const out = document.getElementById("rfCmp"), show = (...x) => { const o = document.getElementById("rfCmp"); if (o) o.replaceChildren(...x); };
    if (!num(profile.cash)) { show(el("div", "rf-warn", "비교하려면 '현재 조건'에 보유 현금을 먼저 넣어 주세요(이 브라우저에만 저장돼요).")); return; }
    if (!force && !confirm(`담은 집 ${basket.length}개를 AI 로 비교할까요? 약 $0.15, 하루 20번 중 1번을 써요.`)) return;
    cmpBusy = true;
    if (out) out.scrollIntoView({ behavior: "smooth", block: "start" });
    show(el("div", "rf-h", `⚖️ ${basket.length}개 비교 중… ① 집마다 자료 받는 중`));
    try {
      const fs = await Promise.all(basket.map(p => callFn("facts", itemBody(p))));
      const ms = fs.map(f => moneyFor(f.facts || []));
      show(el("div", "rf-h", `⚖️ ${basket.length}개 비교 중… ② AI 가 정리하는 중(30~40초)`));
      const pr = profile.purpose;
      const body = {
        items: basket.map((p, i) => ({ ...itemBody(p), need_manwon: ms[i].need, margin_manwon: ms[i].margin, monthly_payment_manwon: ms[i].monthly, payment_to_income_pct: ms[i].ratio, loan_manwon: ms[i].loan })),
        situation: { purpose: pr, max_price_manwon: pr === "live" ? maxPrice() : pr === "jeonse" ? jeonseMax().max : null, priorities: cond.priorities || [] },
      };
      const r = await callFn("compare", body);
      const saved = { at: new Date().toISOString(), items: basket.map(p => ({ ...p })), money: ms, purpose: pr, priorities: cond.priorities || [], r };
      store.set("reFinderCompare", saved);
      const o = document.getElementById("rfCmp");
      if (o) drawCompare(saved, o);
    } catch (e) { show(el("div", "rf-warn", `비교하지 못했어요: ${e.message || e}`)); }
    finally { cmpBusy = false; }
  }
  function drawCompare(saved, out) {
    const r = saved.r || {}, n = r.note || {}, facts = r.facts || [], L0 = r.letters || [];
    // 담은 집에서 뺀 집은 비교 결과에서도 숨김(사용자 2026-11-26) — 글자(A·B…)는 비교할 때 그대로, 돈 숫자는 원래 순서(i)로 찾음
    const inB = new Set(basket.map(keyOf));
    const L = L0.map((x, i) => ({ ...x, i })).filter(x => !saved.items?.[x.i] || inB.has(keyOf(saved.items[x.i])));
    const keep = new Set(L.map(x => x.letter)), hidden = L0.length - L.length;
    if (!L.length) { out.replaceChildren(el("p", "rf-note", "비교했던 집을 모두 뺐어요. 2개 이상 담고 다시 비교해 주세요.")); return; }
    const F = (letter, id) => facts.find(f => f.id === `${letter}_${id}`) || {};
    const nameOf = id => L.find(x => x.letter === id)?.name || id;
    const head = el("div", "rf-ai-head");
    head.append(el("div", "rf-h", `⚖️ 담은 집 비교 (${L.length}개)`), el("small", "rf-note", `${String(saved.at).slice(5, 10).replace("-", "/")} · ${{ live: "실거주로 사기", gap: "전세 끼고 사기", jeonse: "전세 살기" }[saved.purpose] || ""}${saved.priorities?.length ? ` · 중요: ${saved.priorities.map(k => PRIOR[k]).join("·")}` : ""}${r.cost_usd ? ` · $${r.cost_usd}` : ""}${r.used ? ` · 오늘 ${r.used}/${r.limit}번` : ""}`));
    const again = el("button", "rf-x", "다시 비교(비용 듦)"); again.type = "button"; again.addEventListener("click", () => compare());
    head.append(again);
    if (hidden) head.append(el("small", "rf-warn", `담은 집에서 뺀 ${hidden}곳은 숨겼어요 — 남은 집끼리 새로 정리하려면 '다시 비교'`));
    // 숫자 표(사실 자료 + 브라우저 계산)
    const tbl = el("table", "rf-cmp-t"), tr = (k, f) => { const row = el("tr"); row.append(el("th", null, k), ...L.map(x => el("td", null, f(x.letter, x.i)))); tbl.append(row); };
    const pc = v => (v == null ? "–" : `${v > 0 ? "+" : ""}${v}%`), fitOf = id => n.items?.find(x => x.id === id)?.fit || "–";
    const hr = el("tr"); hr.append(el("th"), ...L.map(x => el("th", null, `${x.letter}. ${x.name}`))); tbl.append(hr);
    tr("조건 맞음", l => fitOf(l));
    tr("최근 6개월 중간값", l => won(F(l, "F2").recent_6m?.median_manwon));
    tr("직전 6개월 대비", l => pc(F(l, "F2").change_vs_prev_6m_pct));
    tr("12개월 거래(해제)", l => `${F(l, "F2").trades_12m ?? "–"}건 (${F(l, "F2").canceled_12m ?? 0})`);
    tr("전세가율", l => (F(l, "F3").jeonse_ratio_pct != null ? `${F(l, "F3").jeonse_ratio_pct}%` : "–"));
    tr("준공·세대", l => `${F(l, "F1").built_year || "–"}년 · ${F(l, "F1").building?.units ? `${F(l, "F1").building.units}세대` : "–"}`);
    tr("비교한 크기", l => { const f = F(l, "F1"); return f.area_m2 ? `전용 ${f.area_m2}㎡${f.size_note ? ` (원하는 ${f.requested_area_m2}㎡ 없음)` : ""}` : "–"; });
    tr(saved.purpose === "jeonse" ? "필요한 내 돈(보증금−대출)" : "필요한 내 돈", (l, i) => won(saved.money?.[i]?.need));
    tr("여유 / 부족", (l, i) => { const m = saved.money?.[i]?.margin; return m == null ? "–" : m >= 0 ? `✓ ${won(m)}` : `✗ ${won(-m)} 부족`; });
    if (saved.purpose === "live") tr("월 상환(소득 대비)", (l, i) => { const m = saved.money?.[i]; return m?.monthly ? `${won(m.monthly)}${m.ratio != null ? ` (${Math.round(m.ratio)}%)` : ""}` : "–"; });
    const wrap = el("div", "rf-cmp-wrap"); wrap.append(tbl);
    const parts = [head, n.summary ? el("div", "rf-ai-one", n.summary.text) : null, wrap];
    if (n.order?.length) { const d = el("div", "rf-ai-list"); d.append(el("b", null, "📋 내가 적은 조건에 맞는 순서 (추천 순위 아님)")); const ol = el("ol"); for (const o of n.order.filter(o => keep.has(o.id))) ol.append(el("li", null, `${o.id}. ${nameOf(o.id)} — ${o.reason?.text || ""}`)); d.append(ol); parts.push(d); }
    const cards = el("div", "rf-cmp-cards");
    for (const it of (n.items || []).filter(it => keep.has(it.id))) {
      const c = el("div", `rf-cmp-card fit-${{ "잘 맞음": "good", "보통": "mid", "덜 맞음": "bad" }[it.fit] || "mid"}`);
      c.append(el("div", "rf-h", `${it.id}. ${nameOf(it.id)} · ${it.fit}`));
      if (it.fit_reason) c.append(el("div", "rf-ai-sec", it.fit_reason.text));
      if (it.money) c.append(el("div", "rf-ai-fit", `💰 ${it.money.text}`));
      const lst = (t, xs, cl) => { if (!xs?.length) return; const d = el("div", `rf-ai-list ${cl}`); d.append(el("b", null, t)); const ul = el("ul"); for (const x of xs) ul.append(el("li", null, x.text)); d.append(ul); c.append(d); };
      lst("👍", it.pros, "good"); lst("👎", it.cons, "bad");
      cards.append(c);
    }
    parts.push(cards);
    const list = (t, xs, cl) => { if (!xs?.length) return null; const d = el("div", `rf-ai-list ${cl || ""}`); d.append(el("b", null, t)); const ul = el("ul"); for (const x of xs) ul.append(el("li", null, x.text || x)); d.append(ul); return d; };
    parts.push(list("⇄ 주고받는 점", n.tradeoffs), list("⚠️ 주의", n.cautions, "bad"));
    if (n.questions?.length) {
      const q = list("🙋 상담 때 물어볼 질문 (은행·공인중개사·세무사)", n.questions);
      const cp = el("button", "rf-x", "질문 복사"); cp.type = "button";
      cp.addEventListener("click", async () => { try { await navigator.clipboard.writeText(n.questions.map((x, i) => `${i + 1}. ${x}`).join("\n")); cp.textContent = "복사했어요"; } catch { cp.textContent = "복사 안 됨"; } });
      q.append(cp); parts.push(q);
    }
    parts.push(el("p", "rf-note", "AI 가 실거래·전세·건축물대장·청약홈·한국은행·KOSIS·뉴스 제목과 브라우저가 계산한 내 돈 숫자만 보고 정리한 비교예요. '조건 맞음'은 적어 주신 조건 기준이고 추천이 아니에요. 실제 결정 전에 전문가와 꼭 확인하세요."));
    out.replaceChildren(...parts.filter(Boolean));
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
  /** 찾은 집 카드의 평수 보기(사용자 2026-11-27 "찾은 집 카드도 평수"): 누를 때만 그 집 3년 거래를 받아(loadOne, 10분 기억) 거래된 크기 단추 → 누르면 카드의 매매가·전세가와 '이 평수로 필요한 내 돈'을 그 크기로 */
  function sizeBox(r, A, pair) {
    const box = el("div", "rp-szbox");
    const open = el("button", "rp-szopen", "📐 평수별 가격 보기"); open.type = "button";
    const area = el("div", "rp-chips");
    const info = el("div", "rf-meta");
    open.addEventListener("click", async () => {
      if (area.childElementCount) { area.hidden = !area.hidden; info.hidden = area.hidden; return; }
      open.disabled = true; open.textContent = "불러오는 중…";
      let d;
      try { d = await loadOne(r); } catch (e) { open.disabled = false; open.textContent = "📐 평수별 가격 보기 (다시)"; return; }
      open.disabled = false; open.textContent = "📐 평수 고르기";
      const d12 = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
      const gs = (pickSize(d.trades, A, d12).groups || []).filter(g => g.n12 > 0).sort((a, b) => a.mid - b.mid);
      if (!gs.length) { info.textContent = "최근 12개월 거래가 없어 평수별로 나눌 수 없어요."; return; }
      const pick = g => {
        const m = metrics({ ...r, area: Math.round(g.mid), areaSet: true }, d);
        for (const b of area.children) b.classList.toggle("on", b._g === g);
        pair.replaceChildren(priceBox("sale", "🏠 예상 매매가", m.price, `${m.A}㎡·${pyOf(r.kind, m.A)} · ${m.priceBasis}`), priceBox("jeon", "🔑 전세가 (신규)", m.jeonse, m.jeonse ? `${m.jn}건 중간값` : "전세 기록 없음"));
        const pr = profile.purpose, cash = num(profile.cash);
        const t = [`평당 ${won(m.ppy12)}`, m.ratio != null ? `전세가율 ${Math.round(m.ratio)}%${m.ratio >= 80 ? " ⚠" : ""}` : null, m.price && m.jeonse ? `갭 ${won(m.price - m.jeonse)}` : null];
        if (cash && m.m?.need != null) t.push(`이 평수로 ${pr === "jeonse" ? "필요한 보증금(대출 뺀)" : "필요한 내 돈"} ${won(m.m.need)} ${m.m.margin >= 0 ? `✓ 여유 ${won(m.m.margin)}` : `✗ ${won(-m.m.margin)} 부족`}`);
        info.textContent = t.filter(Boolean).join(" · ");
      };
      for (const g of gs) {
        const b = el("button"); b.type = "button"; b._g = g;
        b.append(el("b", null, pyOf(r.kind, g.mid)), el("small", null, ` ${Math.round(g.mid)}㎡ · ${g.n12}건`));
        b.addEventListener("click", () => pick(g));
        area.append(b);
      }
      const near = gs.find(g => A >= g.min - 3 && A <= g.max + 3) || [...gs].sort((a, b) => Math.abs(a.mid - A) - Math.abs(b.mid - A))[0];
      pick(near);
    });
    box.append(open, area, info);
    return box;
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
    // 원하는 크기와 가까운 거래가 있는 집 먼저(2026-11-24 — 크기가 없는 집이 위에 오면 AI 분석·비교에서 다른 크기로 보게 됨), 그다음 현재 조건에 맞는 집
    const sorted = items.sort((a, b) => (b.r._nearArea - a.r._nearArea) || (b.fit - a.fit) || (b.r.trades_12m - a.r.trades_12m));
    const head = el("div", "rf-h", `찾은 곳 ${sorted.filter(x => x.fit).length.toLocaleString()}곳이 현재 조건에 맞아요 (조건에 맞는 전체 ${total.toLocaleString()}곳 · 전용 ${A}㎡ 기준)`);
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
      const pair = el("div", "rp-pair"); pair.append(priceBox("sale", "🏠 예상 매매가", r._price, `${A}㎡·${pyOf(r.kind, A)} 추정`), priceBox("jeon", "🔑 전세가 (신규)", r._jeonse ?? null, r._jeonse ? `${r._jn}건 중간값` : "전세 기록 없음"));
      li.append(el("div", "rf-row1", null), el("div", "rf-meta", `${SGG[r.sgg_cd]?.name || ""} ${r.umd_nm}${r.build_year ? ` · ${r.build_year}년` : ""} · 최근 12개월 거래 ${r.trades_12m}건${r._nearArea ? "" : ` · ⚠ 최근 거래 면적 ${Math.round(Number(r.last_area)) || "?"}㎡ — 원하는 ${A}㎡ 크기가 없을 수 있어요(값은 추정)`}`),
        pair,
        el("div", "rf-meta", `평당 ${won(r.pyeong_12m)}${r._jeonse ? ` · 전세가율 약 ${Math.round((r._jeonse / r._price) * 100)}%` : ""}${r._jeonse && r._jeonse / r._price >= 0.8 ? " ⚠ 80%↑" : ""}`),
        el("div", fit ? "rf-fit ok" : "rf-fit", `${purpose === "jeonse" ? "필요한 보증금" : "필요한 내 돈"} ${won(need)} ${fit ? `✓ 가능 (여유 ${won((purpose === "jeonse" ? jm : cash) - need)})` : cash ? "✗ 모자람" : ""}`),
        el("div", "rf-meta", note));
      if (fc) li.append(el("div", `rf-fc ${fc.call}`, `🔮 ${zone.name} 3개월 AI 예측: ${fc.call === "up" ? "▲ 상승" : "▼ 하락"} ${fc.prob}% (권역 전체, 이 집 예측 아님)`));
      li.append(sizeBox(r, A, pair));
      const aiB = el("button", "rf-add rf-ai-btn", "🤖"); aiB.type = "button"; aiB.title = "AI 분석"; aiB.addEventListener("click", () => analyze({ ...r, area: A, areaFromCard: true }));
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
  globalThis.REFINDER = { maxPrice, loanFor, ownNeeded, jeonseMax, get basket() { return basket; }, search, analyze, drawAi, compare, drawCompare, moneyFor, setView, metrics, loadOne };

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
.rp-pair, .rp-sec, .rf-cmp-num { --gold: #eab308; --gold-ink: #facc15; --jc: #2dd4bf; }
html[data-theme=light] .rp-pair, html[data-theme=light] .rp-sec, html[data-theme=light] .rf-cmp-num { --gold: #ca8a04; --gold-ink: #a16207; --jc: #0f766e; }
.rp-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 3px 0 1px; }
.rp-v { border-radius: 8px; padding: 4px 8px; display: grid; gap: 1px; border: 1px solid var(--line); min-width: 0; }
.rp-v small { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .rp-v small:first-child { color: var(--text); font-weight: 700; }
.rp-v b { font-size: 20px; line-height: 1.15; }
.rp-v.sale { background: color-mix(in srgb, var(--gold) 9%, transparent); border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); } .rp-v.sale b { color: var(--gold-ink); }
.rp-v.jeon { background: color-mix(in srgb, var(--jc) 9%, transparent); border-color: color-mix(in srgb, var(--jc) 45%, var(--line)); } .rp-v.jeon b { color: var(--jc); }
.rp-sec { border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--line)); border-radius: 12px; padding: 10px 12px; background: color-mix(in srgb, var(--gold) 5%, transparent); }
.rp-h { font-size: 16px; font-weight: 800; color: var(--gold-ink); margin-bottom: 6px; }
.rp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.rp-card { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; display: grid; gap: 5px; align-content: start; background: color-mix(in srgb, var(--panel, #111827) 60%, transparent); }
.rp-card .rp-v b { font-size: 24px; }
.rp-top { display: flex; align-items: center; gap: 6px; min-width: 0; } .rp-top .rf-link { font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rp-size { font-size: 12.5px; font-weight: 700; }
.rp-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.rp-szbox { display: grid; gap: 4px; --gold: #eab308; --gold-ink: #facc15; } html[data-theme=light] .rp-szbox { --gold: #ca8a04; --gold-ink: #a16207; }
.rp-szopen { justify-self: start; font: inherit; font-size: 11.5px; padding: 2px 10px; border-radius: 999px; border: 1px dashed color-mix(in srgb, var(--gold) 60%, var(--line)); background: transparent; color: var(--text); cursor: pointer; }
.rp-szopen:hover { border-style: solid; }
.rp-chips button { font: inherit; font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--text); cursor: pointer; }
.rp-chips button small { color: var(--muted); font-size: 10.5px; }
.rp-chips button:hover { border-color: var(--gold); }
.rp-chips button.on { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 18%, transparent); } .rp-chips button.on b { color: var(--gold-ink); }
.rp-rec { display: grid; gap: 2px; font-size: 12px; border-top: 1px dashed var(--line); padding-top: 4px; }
.rp-rec > small { color: var(--muted); font-size: 11px; font-weight: 700; }
.rp-rec > div { display: flex; gap: 6px; align-items: baseline; } .rp-rec > div small { color: var(--muted); font-size: 11px; } .rp-sub { font-size: 12px; color: var(--muted); }
.rp-ok { font-size: 12px; color: #22c55e; font-weight: 700; } .rp-bad { font-size: 12px; color: #ef4444; font-weight: 700; }
.rf-cmp-num tr.rp-row-sale td b { font-size: 17px; color: var(--gold-ink); } .rf-cmp-num tr.rp-row-sale th { color: var(--gold-ink); }
.rf-cmp-num tr.rp-row-jeon td b { font-size: 17px; color: var(--jc); } .rf-cmp-num tr.rp-row-jeon th { color: var(--jc); }
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
.rf-ai-list.good b { color: #22c55e; } .rf-ai-list.bad b { color: #f59e0b; }
.rf-ai-list ol { margin: 2px 0 0; padding-left: 20px; line-height: 1.55; }
.rf-cmp-wrap { overflow-x: auto; }
.rf-cmp-t { border-collapse: collapse; font-size: 12px; min-width: 100%; }
.rf-cmp-t th, .rf-cmp-t td { border-bottom: 1px solid var(--line); padding: 4px 6px; text-align: left; vertical-align: top; white-space: nowrap; }
.rf-cmp-t th { color: var(--muted); font-weight: 600; } .rf-cmp-t tr:first-child th { color: var(--text); font-weight: 800; white-space: normal; }
.rf-cmp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 6px; }
.rf-cmp-card { border: 1px solid var(--line); border-radius: 10px; padding: 7px 9px; display: grid; gap: 4px; }
.rf-cmp-card.fit-good { border-color: #22c55e; } .rf-cmp-card.fit-bad { border-color: #f59e0b; }
.rf-tabs { display: flex; gap: 4px; position: sticky; top: -8px; z-index: 2; background: var(--panel, var(--bg)); padding: 6px 0; margin: -8px 0 0; border-bottom: 1px solid var(--line); }
.rf-tabs button { flex: 1; font: inherit; font-size: 13.5px; padding: 7px 8px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; }
.rf-tabs button[aria-selected="true"] { color: var(--text); font-weight: 800; border-color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, transparent); }
.rf-basketline { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; font-size: 12.5px; border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; }
.rf-basketline .rf-add { margin-left: auto; }
.rf-curcond { font-size: 12.5px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.rf-curcond .rf-x { margin-left: 4px; }
.rf-q { width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: inherit; font-size: 13px; }
.rf-addres .rf-list li { gap: 6px; }
.rf-cmpnum { display: grid; gap: 8px; }
.rf-cmp-num th:first-child { position: sticky; left: 0; background: var(--panel, var(--bg)); z-index: 1; }
.rf-cmp-num td { white-space: normal; min-width: 120px; }
.rf-cmp-num tr.rf-strong td { font-weight: 700; }
.rf-cmp-num tr:first-child th { min-width: 120px; vertical-align: top; }
.rf-letter { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 800; margin-right: 4px; vertical-align: 1px; }
.rf-acts { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; } .rf-acts .rf-x { margin-left: 0; white-space: nowrap; }
.rf-area { display: inline-flex; gap: 4px; align-items: center; color: var(--muted); font-size: 11.5px; }
.rf-area input { width: 52px; padding: 3px 6px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: inherit; font-size: 12.5px; }
.rf-bchips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.rf-bchip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 2px 4px 2px 3px; border: 1px solid var(--line); border-radius: 999px; }
.rf-bchip .rf-letter { margin-right: 0; }
.rf-bx { font: inherit; font-size: 11px; border: 0; background: color-mix(in srgb, #ef4444 18%, transparent); color: var(--text); border-radius: 999px; width: 18px; height: 18px; padding: 0; cursor: pointer; }
.rf-bx:hover { background: #ef4444; color: #fff; }
.rf-ball { font: inherit; font-size: 11.5px; padding: 2px 9px; border-radius: 999px; border: 1px solid #ef4444; background: transparent; color: #f87171; cursor: pointer; margin-left: 4px; }
.rf-acts .rf-rm { color: #f87171; border-color: color-mix(in srgb, #ef4444 60%, transparent); }
.rf-sizes { display: grid; gap: 1px; margin-top: 3px; } .rf-sizes small { font-size: 11px; line-height: 1.4; }
.rf-ok { color: #22c55e; font-weight: 700; } .rf-bad { color: #f59e0b; font-weight: 700; }
.rf-chart { display: grid; gap: 4px; }
.rf-svg { width: 100%; height: auto; max-height: 260px; }
.rf-grid-l { stroke: var(--line); stroke-width: 1; } .rf-ax { fill: var(--muted); font-size: 18px; }
.rf-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; }
.rf-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
#detail .rf-ai-detail { margin: 4px 0 8px; }`;
  document.head.append(css);
})();
