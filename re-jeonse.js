// 🛡 전세 위험 체크 (사용자 2026-11-25 "전세 위험 체크도 이어서" — 부동산 아이디어 ②)
// - re-impact.js 가 불러옴(real-estate.html 수정 없음). 두 곳에 붙음:
//   ① 단지·건물 상세 화면(re:detail 알림): 숫자 카드들 바로 아래 "🛡 전세 위험 체크" — 고른 면적 타입(안 골랐으면 신규 전세가 가장 많은 크기)으로
//      전세가율(신규 전세 중간값 ÷ 매매 중간값, 12개월) · 집값의 90% 넘는 전세 계약 수 · 매매 거래 수(적으면 집값을 알기 어려움 — 빌라 전세 사고가 많은 경우)
//      · 최근 6달 집값 흐름 · 그 시·구 신규 전세값 1년 흐름(내리면 역전세) · 건물 나이 → 종합 신호(낮음·보통·주의·위험·판단 어려움)
//      + "내 보증금 넣어 보기"(이 브라우저에서만 계산, 저장 안 함) + 계약 전 확인할 것(등기부·선순위·보증보험 등 — 이 자료로는 알 수 없는 것)
//   ② 첫 화면 요약(re-front.js)의 "🛡 전세 위험 신호": 빌라·오피스텔·아파트별 시·구 전세가율 높은 곳 + 같은 집 신규 전세값이 내리는 곳(역전세 신호)
// - 자료: re_rent_jeonse(상세, re-data.js 와 같은 받은 자료 REDATA.rentsOf), re_jeonse_stats(시·구, SQL re_jeonse_risk.sql), re_buildings(건물 나이·세대)
// - 기준(널리 쓰이는 경험칙): 전세가율 80% 이상 위험, 70~80% 주의. 보증보험은 기관·시기마다 기준이 달라 직접 확인 안내. 법률·투자 자문이 아님
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined") return;
  const PY = 3.3058, H = 3600e3;
  const won = v => (v == null || !Number.isFinite(v) ? "–" : typeof fmtWon === "function" ? fmtWon(Math.round(v)) : `${Math.round(v).toLocaleString()}만`);
  const pc = (v, d = 0) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);
  const med = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const kstNow = () => new Date(Date.now() + 9 * H);
  const isoAgo = days => new Date(Date.now() + 9 * H - days * 864e5).toISOString().slice(0, 10);
  const KNAME = { apt: "아파트", villa: "빌라", offi: "오피스텔" };
  // 신호 단계: 0 낮음 1 보통 2 주의 3 위험, -1 판단 어려움
  const LV = { "-1": ["판단 어려움", "na"], 0: ["낮음", "ok"], 1: ["보통", "mid"], 2: ["주의", "warn"], 3: ["위험", "bad"] };
  const ratioLv = r => (r == null ? -1 : r >= 80 ? 3 : r >= 70 ? 2 : r >= 60 ? 1 : 0);

  // ── 시·구 전세 위험 기록(re_jeonse_stats — SQL re_jeonse_risk.sql, 매일 05:30 KST): 같은 단지·건물·크기끼리 맞춘 전세가율, 1시간 기억 ──
  // (시·구 전체 중간값끼리 나누면 새 원룸 전세 vs 오래된 큰 집 매매를 비교하게 돼 200%처럼 엉뚱한 값이 나와서 같은 집끼리만)
  let statsP = null, statsAt = 0;
  function loadStats() {
    if (statsP && Date.now() - statsAt < H) return statsP;
    statsAt = Date.now();
    statsP = (async () => {
      const l = await db.from("re_jeonse_stats").select("day").order("day", { ascending: false }).limit(1);
      if (l.error) throw l.error;
      if (!l.data?.[0]) return null;
      const r = await db.from("re_jeonse_stats").select("day,kind,sgg_cd,places,ratio_med,share80,share70,chg_med,chg_places").eq("day", l.data[0].day);
      if (r.error) throw r.error;
      const m = new Map(); for (const x of r.data || []) m.set(`${x.kind}|${x.sgg_cd}`, x);
      return { day: l.data[0].day, rows: r.data || [], get: (kind, sgg) => m.get(`${kind}|${sgg}`) };
    })();
    statsP.catch(() => { statsP = null; });
    return statsP;
  }

  // ── ① 상세 화면 카드 ──
  function groups(areas) {                                     // 전용면적을 3㎡ 넘게 벌어지면 다른 크기
    const xs = areas.filter(a => a > 0).sort((a, b) => a - b), gs = [];
    for (const a of xs) { const g = gs.at(-1); if (g && a - g.max <= 3) { g.max = a; g.n++; } else gs.push({ lo: a, max: a, n: 1 }); }
    return gs.map(g => ({ lo: g.lo, hi: g.max }));
  }
  let mySeq = 0, myDeposit = "";
  document.addEventListener("re:detail", async e => {
    const { p, sel, live, tiles } = e.detail || {};
    if (!p || !tiles || !globalThis.REDATA?.rentsOf) return;
    const seq = ++mySeq;
    const box = el("section", "panel jr"); box.append(el("div", "jr-h", "🛡 전세 위험 체크"), el("p", "jr-note", "불러오는 중…"));
    tiles.after(box);
    try {
      const [rentsAll, region, bld] = await Promise.all([REDATA.rentsOf(p), loadStats().catch(() => null),
        db.from("re_buildings").select("units,unit_label,use_apr,match").eq("kind", p.kind).eq("sgg_cd", p.sgg_cd).eq("umd_nm", p.umd_nm).eq("place_key", p.place_key).maybeSingle().then(r => r.data, () => null)]);
      if (seq !== mySeq || !box.isConnected) return;
      draw(box, { p, sel, live: live || [], rentsAll, stats: region, bld });
    } catch (err) {
      console.warn("re-jeonse", err);
      if (box.isConnected) box.replaceChildren(el("div", "jr-h", "🛡 전세 위험 체크"), el("p", "jr-note", "불러오지 못했어요. 잠시 뒤 다시 열어 주세요."));
    }
  });
  function draw(box, { p, sel, live, rentsAll, stats, bld }) {
    const cut12 = REDATA.since(), d6 = isoAgo(183), d12 = isoAgo(365);
    // 크기: 고른 타입 → 그 범위 / 아니면 신규 전세가 가장 많은 크기(전세 없으면 매매가 가장 많은 크기)
    let rng = sel ? { lo: sel.lo, hi: sel.hi } : null, auto = false;
    if (!rng) {
      const gs = groups([...rentsAll.map(r => Number(r.excl_area)), ...live.map(r => Number(r.excl_area))]);
      const cnt = g => [rentsAll.filter(r => +r.excl_area >= g.lo && +r.excl_area <= g.hi).length, live.filter(r => +r.excl_area >= g.lo && +r.excl_area <= g.hi && r.deal_date >= cut12).length];
      const best = gs.map(g => ({ g, c: cnt(g) })).sort((a, b) => b.c[0] - a.c[0] || b.c[1] - a.c[1])[0];
      if (best) { rng = best.g; auto = gs.length > 1; }
    }
    const inR = r => rng && +r.excl_area >= rng.lo - 0.01 && +r.excl_area <= rng.hi + 0.01;
    const rents = rentsAll.filter(r => inR(r) && r.deal_date >= cut12);
    const sales = live.filter(r => inR(r) && r.deal_date >= cut12);
    const A = med([...rents, ...sales].map(r => +r.excl_area)) || (rng ? (rng.lo + rng.hi) / 2 : null);
    const per = rs => rs.map(r => (r.price ?? r.deposit) / +r.excl_area);
    const saleM2 = med(per(sales)), rentM2 = med(per(rents));
    const salePrice = saleM2 && A ? saleM2 * A : null, rentPrice = rentM2 && A ? rentM2 * A : null;
    const ratio = sales.length >= 3 && rents.length >= 3 ? rentM2 / saleM2 * 100 : null;
    const items = [];                                          // [단계, 제목, 설명]
    // 1) 전세가율
    if (ratio != null) items.push([ratioLv(ratio), `전세가율 ${ratio.toFixed(0)}%`, `신규 전세 중간값 ${won(rentPrice)} (${rents.length}건) ÷ 매매 중간값 ${won(salePrice)} (${sales.length}건) · 12개월. 80% 넘으면 집값이 조금만 내려도 보증금을 다 돌려받기 어려울 수 있어요.`]);
    else if (rents.length && sales.length < 3) items.push([sales.length ? 2 : 3, `매매 거래가 ${sales.length}건뿐이에요`, `이 크기 신규 전세는 ${rents.length}건 있는데 매매는 12개월 ${sales.length}건이라 집값(시세)을 알기 어려워요. 빌라 전세 사고가 많이 나는 경우예요 — 감정평가·공시가격으로 집값을 따로 확인하세요.`]);
    else items.push([-1, "전세가율을 계산할 거래가 모자라요", `이 크기 12개월 신규 전세 ${rents.length}건 · 매매 ${sales.length}건 (각 3건 이상일 때 계산)`]);
    // 2) 집값의 90% 넘는 전세
    if (saleM2 && rents.length) {
      const hi = rents.filter(r => r.deposit / +r.excl_area >= saleM2 * 0.9).length;
      if (hi) items.push([hi >= 3 || hi / rents.length >= 0.3 ? 3 : 2, `집값의 90% 넘는 전세 ${hi}건`, `12개월 신규 전세 ${rents.length}건 중 ${hi}건이 같은 크기 매매 중간값의 90% 이상이에요(같은 ㎡당으로 비교).`]);
    }
    // 3) 최근 6달 집값 흐름
    {
      const a = live.filter(r => inR(r) && r.deal_date >= d6), b = live.filter(r => inR(r) && r.deal_date < d6 && r.deal_date >= d12);
      if (a.length >= 3 && b.length >= 3) {
        const chg = (med(per(a)) / med(per(b)) - 1) * 100;
        items.push([chg <= -5 ? 2 : chg <= -2 ? 1 : 0, `최근 6달 집값 ${pc(chg, 1)}`, `이 크기 ㎡당 매매 중간값, 최근 6달 ${a.length}건 vs 그 전 6달 ${b.length}건. 집값이 내리면 전세가율이 저절로 올라가요.`]);
      }
    }
    // 4) 그 시·구(같은 종류) 전세가율·전세값 흐름 — 같은 집끼리 맞춘 기록
    const rg = stats?.get(p.kind, p.sgg_cd);
    if (rg) {
      const nm = `${SGG[p.sgg_cd]?.name || ""} ${KNAME[p.kind]}`;
      const lv = Math.min(2, Math.max(ratioLv(rg.ratio_med), rg.chg_med != null && rg.chg_med <= -3 ? 2 : 0));
      items.push([lv, `${nm} 전세가율 중간값 ${Math.round(rg.ratio_med)}% · 80% 넘는 곳 ${Math.round(rg.share80)}%`,
        `같은 단지·건물·크기끼리 맞춰 본 그 지역 ${rg.places}곳 기준(12개월).${rg.chg_med != null ? ` 같은 집 신규 전세값은 최근 3달이 6~9달 전보다 ${pc(rg.chg_med, 1)}${rg.chg_med <= -0.5 ? " — 내리는 중이면 계약이 끝날 때 '역전세'가 생길 수 있어요." : "."}` : ""}`]);
    }
    // 5) 건물
    const yr = bld?.use_apr ? Number(String(bld.use_apr).slice(0, 4)) : null, age = yr ? kstNow().getUTCFullYear() - yr : null;
    if (age != null || bld?.units) items.push([age != null && age >= 30 ? 1 : 0, [age != null ? (age <= 1 ? `새 건물(${yr}년 사용승인)` : `지은 지 ${age}년`) : null, bld?.units ? `${bld.units.toLocaleString()}${bld.unit_label || "세대"}` : null].filter(Boolean).join(" · "),
      `${yr ? `사용승인 ${yr}년. ` : ""}오래된 건물은 수리·재건축 일정, 작은 건물(세대 수 적음)은 시세 확인이 어려운 경우가 많아요. 위반건축물 여부는 건축물대장에서 직접 확인하세요.`]);
    const worst = Math.max(...items.filter(x => x[0] >= 0).map(x => x[0]), -1);
    const known = items.some(x => x[0] >= 0 && (x[1].startsWith("전세가율") || x[1].startsWith("매매 거래가")));
    const verdict = known ? worst : -1;
    // 그리기
    const head = el("div", "jr-head");
    head.append(el("div", "jr-h", "🛡 전세 위험 체크"), el("span", `jr-badge ${LV[verdict][1]}`, `종합 신호: ${LV[verdict][0]}`));
    const sz = el("p", "jr-note", A ? `전용 ${Math.round(A)}㎡ 기준${auto ? " (신규 전세가 가장 많은 크기 — 위 면적 타입을 고르면 그 타입으로 봐요)" : ""}` : "");
    const ul = el("ul", "jr-list");
    for (const [lv, t, d] of items) { const li = el("li", `jr-${LV[lv][1]}`); const dot = el("i"); li.append(dot, el("b", null, t), el("small", null, d)); ul.append(li); }
    // 내 보증금
    const mine = el("div", "jr-mine");
    const inp = el("input"); inp.type = "text"; inp.inputMode = "numeric"; inp.placeholder = "예: 30000 = 3억"; inp.value = myDeposit; inp.setAttribute("aria-label", "내 보증금(만원)");
    const out = el("div", "jr-mine-out");
    const calc = () => {
      myDeposit = inp.value.replace(/[^\d]/g, ""); const D = Number(myDeposit);
      if (!D) { out.replaceChildren(el("small", null, "보증금을 넣으면 이 크기 매매 중간값과 비교해요(이 브라우저에서만 계산, 저장 안 함).")); return; }
      if (!salePrice) { out.replaceChildren(el("small", null, "이 크기 매매 거래가 없어 비교할 집값이 없어요.")); return; }
      const r = D / salePrice * 100, r10 = D / (salePrice * 0.9) * 100;
      out.replaceChildren(el("span", `jr-${LV[ratioLv(r)][1]}`, `내 전세가율 약 ${r.toFixed(0)}% (${LV[ratioLv(r)][0]})`),
        el("small", null, ` · 집값이 10% 내리면 약 ${r10.toFixed(0)}% · 매매 중간값 ${won(salePrice)} 기준(${sales.length}건)`));
    };
    inp.addEventListener("input", calc);
    const lab = el("label", null, "💰 내 보증금(만원) "); lab.append(inp);
    mine.append(lab, out); calc();
    // 계약 전 확인할 것
    const chk = el("details", "jr-chk");
    chk.append(el("summary", null, "✅ 계약 전 꼭 확인할 것 (이 자료로는 알 수 없는 것들)"));
    const cl = el("ol");
    for (const t of ["등기부등본(인터넷등기소)에서 집주인 이름과 근저당(빚)·가압류·신탁 여부 확인 — 계약 당일·잔금 전에 다시 떼 보기",
      "근저당 등 먼저 잡힌 빚 + 내 보증금이 집값의 70~80%를 넘으면 위험",
      "다가구·원룸 건물이면 먼저 들어온 세입자 보증금(선순위 임차보증금) 확인",
      "전세보증금 반환보증(HUG·HF·SGI) 가입이 되는지 먼저 확인 — 기관·시기마다 기준(보증금이 집값의 몇 % 이내 등)이 달라요",
      "집주인 세금 체납(국세·지방세) 확인 — 계약 전 동의 받아 열람",
      "잔금 날 전입신고 + 확정일자 바로 받기, 공인중개사 등록 여부 확인"]) cl.append(el("li", null, t));
    chk.append(cl);
    box.replaceChildren(head, sz, ul, mine, chk,
      el("p", "jr-note", "국토교통부 전월세·매매 실거래가로 만든 참고 신호예요. 실제 위험은 등기부(빚)·집주인 사정에 따라 크게 달라요. 법률·투자 자문이 아니에요."));
  }

  // ── ② 첫 화면 요약 칸 ──
  async function front(host, { sec, regBtn, pc: pcf }) {
    try {
      const st = await loadStats().catch(() => null);
      if (!host.isConnected) return;
      if (!st?.rows?.length) { host.remove(); return; }
      const s = sec("🛡 전세 위험 신호", `시·구 · ${String(st.day).slice(5).replace("-", "/")} 계산`);
      s.append(el("p", "rfn-note", "전세가율 = 같은 단지·건물·같은 크기의 최근 12개월 신규 전세 중간값 ÷ 매매 중간값, 그 지역 곳들의 중간값. 80% 넘으면 집값이 조금만 내려도 보증금을 다 돌려받기 어려울 수 있어요(깡통전세). 단지마다 다르니 단지 상세의 '🛡 전세 위험 체크'를 보세요."));
      const cols = el("div", "rfn-cols");
      const col = (title, rows, right) => { const c = el("div", "rfn-col"); c.append(el("div", "rfn-sub", title)); const l = el("div", "rfn-list"); for (const r of rows) l.append(regBtn(r.sgg_cd, right(r))); if (!rows.length) l.append(el("small", "rfn-note", "해당 없음")); c.append(l); return c; };
      const v = (main, sub, c) => { const x = el("span", "rfn-v"); x.append(el("b", c, main)); if (sub) x.append(el("small", null, ` ${sub}`)); return x; };
      const lvCls = r => (r >= 80 ? "jr-t-bad" : r >= 70 ? "jr-t-warn" : "");
      for (const kind of ["villa", "offi", "apt"]) {
        const rows = st.rows.filter(r => r.kind === kind && r.places >= (kind === "apt" ? 20 : 8)).sort((a, b) => b.ratio_med - a.ratio_med).slice(0, 5);
        cols.append(col(`${KNAME[kind]} 전세가율 높은 곳`, rows, r => v(`${Math.round(r.ratio_med)}%`, `80%↑ ${Math.round(r.share80)}% · ${r.places}곳`, lvCls(r.ratio_med))));
      }
      const down = st.rows.filter(r => r.chg_med != null && r.chg_med < 0).sort((a, b) => a.chg_med - b.chg_med).slice(0, 5);
      cols.append(col("📉 같은 집 신규 전세값이 내리는 곳", down, r => v(pcf(r.chg_med, 1), `${KNAME[r.kind]} · ${r.chg_places}곳`, "down")));
      s.append(cols, el("p", "rfn-note", "전세값 흐름 = 같은 단지·건물·크기의 신규 전세 ㎡당, 최근 3달 vs 6~9달 전. 내리면 '역전세'(집주인이 보증금을 돌려주기 어려워짐) 신호예요."));
      host.replaceWith(s);
    } catch (e) { console.warn("re-jeonse front", e); host.remove(); }
  }
  globalThis.REJEONSE = { front, loadStats, ratioLv, preview(rows) { statsAt = Date.now(); const m = new Map(rows.map(x => [`${x.kind}|${x.sgg_cd}`, x])); statsP = Promise.resolve({ day: rows[0]?.day, rows, get: (k, s) => m.get(`${k}|${s}`) }); } };   // preview: 표가 생기기 전 미리보기용

  const css = document.createElement("style");
  css.textContent = `
.panel.jr { display: grid; gap: 6px; border: 1px solid var(--line); border-left: 4px solid #f59e0b; border-radius: 10px; padding: 10px 12px; margin: 8px 0; }
.jr-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .jr-h { font-weight: 800; font-size: 15px; }
.jr-badge { font-size: 12.5px; font-weight: 800; padding: 2px 10px; border-radius: 999px; border: 1px solid; }
.jr-badge.ok { color: #22c55e; } .jr-badge.mid { color: #a3a3a3; } .jr-badge.warn { color: #f59e0b; } .jr-badge.bad { color: #fff; background: #ef4444; border-color: #ef4444; } .jr-badge.na { color: var(--muted); }
.jr-note { font-size: 11.5px; color: var(--muted); margin: 0; line-height: 1.5; }
.jr-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.jr-list li { display: grid; grid-template-columns: 12px 1fr; gap: 1px 8px; align-items: baseline; font-size: 13px; }
.jr-list li i { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); grid-row: span 2; align-self: start; margin-top: 4px; }
.jr-list li small { grid-column: 2; color: var(--muted); font-size: 11.5px; line-height: 1.45; }
.jr-list .jr-ok i { background: #22c55e; } .jr-list .jr-mid i { background: #a3a3a3; } .jr-list .jr-warn i { background: #f59e0b; } .jr-list .jr-bad i { background: #ef4444; } .jr-list .jr-na i { background: transparent; border: 1px dashed var(--muted); }
.jr-list .jr-bad b { color: #ef4444; } .jr-list .jr-warn b { color: #f59e0b; }
.jr-mine { border-top: 1px dashed var(--line); padding-top: 6px; display: grid; gap: 4px; font-size: 12.5px; }
.jr-mine input { width: 120px; padding: 4px 8px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font: inherit; }
.jr-mine-out small { color: var(--muted); } .jr-mine-out .jr-bad { color: #ef4444; font-weight: 800; } .jr-mine-out .jr-warn { color: #f59e0b; font-weight: 800; } .jr-mine-out .jr-ok, .jr-mine-out .jr-mid { font-weight: 800; }
.jr-chk summary { cursor: pointer; font-size: 12.5px; font-weight: 700; } .jr-chk ol { margin: 4px 0 0; padding-left: 20px; font-size: 12px; line-height: 1.6; }
.jr-t-bad { color: #ef4444; } .jr-t-warn { color: #f59e0b; }`;
  document.head.append(css);
})();
