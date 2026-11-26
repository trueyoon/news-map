// 🏠 매매 · 🔑 전세 · 💵 월세 한눈에 (사용자 2026-11-26 "이번 주 요약 옆에 전세·월세·매매 탭을 나눠서 한 번에 보기 좋게")
// - re-impact.js 가 re-front.js 바로 앞에 불러옴(real-estate.html 수정 없음). re-front.js 의 요약 칸에 [📋 요약 | 🏠 매매 | 🔑 전세 | 💵 월세] 탭이 생기고,
//   매매·전세·월세 탭을 고르면 re-front 가 REMARKET.draw(탭, 칸, 도구) 를 부름. 머리 줄 [📋 이번 주 요약] 옆 작은 단추 [매매][전세][월세]로 바로 열 수도 있음
// - 새로 받는 표 없음(SQL 없음). 시·구 72곳 × 종류(아파트·빌라·오피스텔 — 기억 reMktKind), 신고(계약 후 30일)가 다 모인 최근 3달(이번·지난달 빼고) vs 1년 전 같은 3달
//   ① 매매: re_monthly_stats — 3.3㎡당(㎡당 중간값 × 3.3058, 거래 수 가중)·1년 변화·월 거래·직전 3달 대비 거래 변화 + 신고가 비율(re_high_stats, 아파트)
//   ② 전세: re_rent_monthly(jeonse) — 신규 전세 3.3㎡당·1년 변화·월 신규 건수 + 갱신 비중·갱신 인상률·갱신요구권 사용 비율 + 같은 집끼리 전세가율(re_jeonse_stats)·갭(re_gap_stats)
//   ③ 월세: re_rent_monthly(wolse) — 신규 월세 중간값·보증금 중간값·면적·1년 변화 + 월세 비중(신규 월세 ÷ (신규 월세 + 신규 전세)) "월세로 바뀌는 정도"
//   서울·경기 합계의 1년 변화는 시·구마다 변화를 지금 거래 수로 가중(값싼 곳 거래가 늘면 전체가 내려 보이는 착시 피함). 시·구 중간값은 팔린 집 구성에 흔들림(대략)
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined") return;
  const H = 3600e3, PY = 3.3058;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 기억 없음 */ } },
  };
  const KN = { apt: "아파트", villa: "빌라", offi: "오피스텔" };
  let kind = store.get("reMktKind", "apt"); if (!KN[kind]) kind = "apt";
  let area = store.get("reMktArea", "all"); if (!["all", "11", "41"].includes(area)) area = "all";
  const sorts = store.get("reMktSort", {}) || {};
  const kstNow = () => new Date(Date.now() + 9 * H);
  const monthKey = back => { const d = kstNow(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)).toISOString().slice(0, 10); };
  const ym = s => `${String(s).slice(2, 4)}.${String(s).slice(5, 7)}`;
  const pc = (v, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);
  const pp = (v, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%p`);
  const cls = v => (v > 0 ? "up" : v < 0 ? "down" : "");
  const man = v => (v == null || !Number.isFinite(v) ? "–" : typeof fmtShort === "function" ? fmtShort(v) : `${Math.round(v).toLocaleString()}만`);
  const eok = m => (m == null || !Number.isFinite(m) ? "–" : Math.abs(m) >= 10000 ? `${(m / 10000).toFixed(Math.abs(m) >= 100000 ? 0 : 1)}억` : `${Math.round(m).toLocaleString()}만`);
  const NOW = [2, 3, 4], PREV = [5, 6, 7], YR = [14, 15, 16];

  async function pageAll(make, max = 12000) {
    const out = [];
    for (let off = 0; off < max; off += 1000) { const { data, error } = await make().range(off, off + 999); if (error) throw error; out.push(...(data || [])); if (!data || data.length < 1000) break; }
    return out;
  }
  const cache = new Map();
  function cached(key, fn) { const c = cache.get(key); if (c && Date.now() - c.at < H) return c.p; const p = fn(); cache.set(key, { at: Date.now(), p }); p.catch(() => cache.delete(key)); return p; }
  const latest = (table, cols) => cached(`L|${table}`, async () => { const l = await db.from(table).select("day").order("day", { ascending: false }).limit(1); if (l.error) throw l.error; if (!l.data?.[0]) return []; const r = await db.from(table).select(cols).eq("day", l.data[0].day); if (r.error) throw r.error; return r.data || []; });
  /** 행들 → Map(sgg → Map(ym → 행)) */
  const bySgg = (rows, filt = () => true) => { const m = new Map(); for (const r of rows) { if (!filt(r)) continue; (m.get(r.sgg_cd) || m.set(r.sgg_cd, new Map()).get(r.sgg_cd)).set(String(r.ym).slice(0, 10), r); } return m; };
  /** 달 묶음의 가중 평균: val(행) × w(행) */
  const win = (m, backs, val, w) => { let s = 0, n = 0; for (const b of backs) { const r = m?.get(monthKey(b)); const v = r && val(r), k = r && w(r); if (k && v != null && Number.isFinite(v)) { s += v * k; n += k; } } return n ? { v: s / n, n } : null; };
  /** 서울·경기 합계: 값은 거래 수 가중 평균, 1년 변화는 시·구 변화를 지금 거래 수로 가중 */
  function total(rows, pre) {
    const xs = rows.filter(r => r.code.startsWith(pre) && r.now);
    let s = 0, n = 0, y = 0, ny = 0;
    for (const r of xs) { s += r.now.v * r.now.n; n += r.now.n; if (r.yoy != null && r.thin !== true) { y += r.yoy * r.now.n; ny += r.now.n; } }
    return n ? { v: s / n, n, yoy: ny ? y / ny : null } : null;
  }

  // ── 자료 ──
  async function sale(kd) {
    const rows = await cached(`ms|${kd}`, () => pageAll(() => db.from("re_monthly_stats").select("sgg_cd,ym,trades,median_price_m2").eq("kind", kd).gte("ym", monthKey(17)).order("sgg_cd").order("ym")));
    const hs = kd === "apt" ? await latest("re_high_stats", "sgg_cd,trades,highs").catch(() => []) : [];
    const hmap = new Map(hs.map(h => [h.sgg_cd, h]));
    const m = bySgg(rows), out = [];
    for (const [code, mm] of m) {
      if (!SGG[code]) continue;
      const v = r => r.median_price_m2 * PY, w = r => r.trades;
      const now = win(mm, NOW, v, w); if (!now) continue;
      const yr = win(mm, YR, v, w), pv = win(mm, PREV, v, w), h = hmap.get(code);
      out.push({ code, now, yoy: yr ? (now.v / yr.v - 1) * 100 : null, perMonth: now.n / 3, volChg: pv ? (now.n / pv.n - 1) * 100 : null, highs: h && h.trades ? h.highs / h.trades * 100 : null, thin: now.n < 30 || !yr || yr.n < 30 });
    }
    return out;
  }
  async function rent(kd) {
    const rows = await cached(`rm|${kd}`, () => pageAll(() => db.from("re_rent_monthly").select("sgg_cd,ym,rent_type,contract,cnt,deposit_med,rent_med,deposit_m2_med,area_med,rr_used,raise_med").eq("kind", kd).in("contract", ["new", "renew"]).gte("ym", monthKey(17)).order("sgg_cd").order("ym")));
    return rows;
  }
  async function jeonse(kd) {
    const rows = await rent(kd);
    const [js, gs] = await Promise.all([latest("re_jeonse_stats", "kind,sgg_cd,places,ratio_med,share80").catch(() => []), latest("re_gap_stats", "kind,sgg_cd,places,gap_med").catch(() => [])]);
    const jm = new Map(js.filter(x => x.kind === kd).map(x => [x.sgg_cd, x])), gm = new Map(gs.filter(x => x.kind === kd).map(x => [x.sgg_cd, x]));
    const nw = bySgg(rows, r => r.rent_type === "jeonse" && r.contract === "new"), rn = bySgg(rows, r => r.rent_type === "jeonse" && r.contract === "renew");
    const out = [];
    for (const [code, mm] of nw) {
      if (!SGG[code]) continue;
      const v = r => r.deposit_m2_med * PY, w = r => r.cnt;
      const now = win(mm, NOW, v, w); if (!now) continue;
      const yr = win(mm, YR, v, w), rr = rn.get(code);
      let rc = 0, rused = 0, raise = 0, rw = 0;
      for (const b of NOW) { const r = rr?.get(monthKey(b)); if (r?.cnt) { rc += r.cnt; rused += r.rr_used || 0; if (r.raise_med != null) { raise += r.raise_med * r.cnt; rw += r.cnt; } } }
      const j = jm.get(code), g = gm.get(code);
      out.push({ code, now, yoy: yr ? (now.v / yr.v - 1) * 100 : null, perMonth: now.n / 3, renewShare: rc + now.n ? rc / (rc + now.n) * 100 : null,
        rrShare: rc ? rused / rc * 100 : null, raise: rw ? raise / rw : null, ratio: j?.ratio_med ?? null, gap: g?.gap_med ?? null, thin: now.n < 30 || !yr || yr.n < 30 });
    }
    return out;
  }
  async function wolse(kd) {
    const rows = await rent(kd);
    const wn = bySgg(rows, r => r.rent_type === "wolse" && r.contract === "new"), jn = bySgg(rows, r => r.rent_type === "jeonse" && r.contract === "new");
    const out = [];
    for (const [code, mm] of wn) {
      if (!SGG[code]) continue;
      const w = r => r.cnt;
      const now = win(mm, NOW, r => r.rent_med, w); if (!now) continue;
      const yr = win(mm, YR, r => r.rent_med, w), dep = win(mm, NOW, r => r.deposit_med, w), ar = win(mm, NOW, r => r.area_med, w);
      const jNow = win(jn.get(code), NOW, () => 1, w), jYr = win(jn.get(code), YR, () => 1, w), wYr = win(mm, YR, () => 1, w);
      const share = jNow ? now.n / (now.n + jNow.n) * 100 : 100, shareYr = jYr && wYr ? wYr.n / (wYr.n + jYr.n) * 100 : null;
      out.push({ code, now, yoy: yr ? (now.v / yr.v - 1) * 100 : null, perMonth: now.n / 3, dep: dep?.v ?? null, area: ar?.v ?? null, share, shareChg: shareYr != null ? share - shareYr : null, thin: now.n < 30 || !yr || yr.n < 30 });
    }
    return out;
  }

  // ── 그리기 ──
  const chips = (items, cur, onPick) => { const d = el("div", "mk-chips"); for (const [k, t] of items) { const b = el("button", k === cur ? "on" : null, t); b.type = "button"; b.addEventListener("click", () => onPick(k)); d.append(b); } return d; };
  const kpi = (title, v, sub, c) => { const x = el("div", `rfn-kpi ${c || ""}`); x.append(el("small", null, title), el("b", null, v), el("small", null, sub)); return x; };
  let seq = 0;
  async function draw(tab, host, T) {
    const my = ++seq;
    const top = el("div", "mk-top");
    top.append(chips(Object.entries(KN), kind, k => { kind = k; store.set("reMktKind", k); draw(tab, host, T); }),
      chips([["all", "서울·경기"], ["11", "서울"], ["41", "경기"]], area, a => { area = a; store.set("reMktArea", a); draw(tab, host, T); }));
    host.replaceChildren(top, el("p", "rfn-note", "불러오는 중…"));
    let rows;
    try { rows = tab === "sale" ? await sale(kind) : tab === "jeonse" ? await jeonse(kind) : await wolse(kind); }
    catch (e) { if (my === seq) host.replaceChildren(top, el("p", "rfn-warn", `불러오지 못했어요: ${e.message || e}`)); return; }
    if (my !== seq) return;
    if (!rows.length) { host.replaceChildren(top, el("p", "rfn-note", "아직 자료가 없어요.")); return; }
    const parts = [top];
    const span = `${ym(monthKey(4))}~${ym(monthKey(2))}`;
    // 큰 숫자
    const big = el("div", "rfn-big");
    for (const [pre, nm] of [["11", "서울"], ["41", "경기"]]) {
      const t = total(rows, pre); if (!t) continue;
      if (tab === "sale") big.append(kpi(`${nm} ${KN[kind]} 3.3㎡당`, man(t.v), `1년 전보다 ${pc(t.yoy)} · 월 ${Math.round(t.n / 3).toLocaleString()}건`, cls(t.yoy)));
      else if (tab === "jeonse") big.append(kpi(`${nm} 신규 전세 3.3㎡당`, man(t.v), `1년 전보다 ${pc(t.yoy)} · 월 ${Math.round(t.n / 3).toLocaleString()}건`, cls(t.yoy)));
      else big.append(kpi(`${nm} 신규 월세 중간값`, `${Math.round(t.v).toLocaleString()}만`, `1년 전보다 ${pc(t.yoy)} · 월 ${Math.round(t.n / 3).toLocaleString()}건`, cls(t.yoy)));
    }
    if (tab === "jeonse") {
      const all = rows.filter(r => area === "all" || r.code.startsWith(area));
      const sum = (f, w) => { let s = 0, n = 0; for (const r of all) { const v = f(r), k = w(r); if (v != null && k) { s += v * k; n += k; } } return n ? s / n : null; };
      const rs = sum(r => r.renewShare, r => r.now.n), rai = sum(r => r.raise, r => r.now.n), rr = sum(r => r.rrShare, r => r.now.n);
      big.append(kpi("갱신 계약 비중", rs != null ? `${Math.round(rs)}%` : "–", `갱신 인상률 중간 ${rai != null ? `${rai.toFixed(1)}%` : "–"} · 갱신요구권 ${rr != null ? `${Math.round(rr)}%` : "–"}`));
    }
    if (tab === "wolse") {
      const all = rows.filter(r => area === "all" || r.code.startsWith(area));
      let w = 0, n = 0, c = 0, cn = 0; for (const r of all) { w += r.share * r.now.n; n += r.now.n; if (r.shareChg != null) { c += r.shareChg * r.now.n; cn += r.now.n; } }
      if (n) big.append(kpi("신규 계약 중 월세 비중", `${Math.round(w / n)}%`, `1년 전보다 ${pp(cn ? c / cn : null)} · 높을수록 전세가 월세로 바뀌는 중`, "hot"));
    }
    parts.push(big);
    // 정렬
    const SORTS = tab === "sale" ? [["price", "3.3㎡당 높은"], ["yoy", "1년 많이 오른"], ["yoyLow", "약한·내린"], ["vol", "거래 많은"], ["volChg", "거래 늘어난"], ...(kind === "apt" ? [["highs", "신고가 비율"]] : [])]
      : tab === "jeonse" ? [["price", "전세 비싼"], ["yoy", "1년 많이 오른"], ["yoyLow", "내린(역전세 주의)"], ["ratio", "전세가율 높은"], ["gap", "갭 작은"], ["renew", "갱신 많은"]]
      : [["price", "월세 비싼"], ["yoy", "1년 많이 오른"], ["share", "월세 비중 높은"], ["shareChg", "월세로 빨리 바뀌는"], ["vol", "계약 많은"]];
    let sk = sorts[`${tab}|${kind}`] || SORTS[0][0]; if (!SORTS.some(s => s[0] === sk)) sk = SORTS[0][0];
    const key = r => ({ price: r.now.v, yoy: r.yoy, yoyLow: r.yoy == null ? null : -r.yoy, vol: r.perMonth, volChg: r.volChg, highs: r.highs, ratio: r.ratio, gap: r.gap == null ? null : -r.gap, renew: r.renewShare, share: r.share, shareChg: r.shareChg }[sk]);
    const sec = T.sec(tab === "sale" ? "🏠 시·구별 매매" : tab === "jeonse" ? "🔑 시·구별 전세" : "💵 시·구별 월세", `${KN[kind]} · ${span} · 누르면 그 시·구로`);
    sec.append(chips(SORTS, sk, s => { sorts[`${tab}|${kind}`] = s; store.set("reMktSort", sorts); draw(tab, host, T); }));
    const list = rows.filter(r => (area === "all" || r.code.startsWith(area)) && key(r) != null).sort((a, b) => (a.thin - b.thin) || key(b) - key(a));
    const box = el("div", "rfn-list mk-list");
    for (const r of list) {
      const right = el("span", "rfn-v mk-v");
      if (tab === "sale") right.append(el("b", null, man(r.now.v)), el("small", cls(r.yoy), ` ${pc(r.yoy)}`), el("small", null, ` · 월 ${Math.round(r.perMonth)}건${r.volChg != null ? `(${pc(r.volChg, 0)})` : ""}${r.highs != null ? ` · 신고가 ${Math.round(r.highs)}%` : ""}`));
      else if (tab === "jeonse") right.append(el("b", null, man(r.now.v)), el("small", cls(r.yoy), ` ${pc(r.yoy)}`), el("small", r.ratio >= 80 ? "bad" : r.ratio >= 70 ? "warn" : null, `${r.ratio != null ? ` · 전세가율 ${Math.round(r.ratio)}%` : ""}`), el("small", null, `${r.gap != null ? ` · 갭 ${eok(r.gap)}` : ""}${r.renewShare != null ? ` · 갱신 ${Math.round(r.renewShare)}%` : ""}`));
      else right.append(el("b", null, `${Math.round(r.now.v).toLocaleString()}만`), el("small", cls(r.yoy), ` ${pc(r.yoy)}`), el("small", null, ` · 보증금 ${eok(r.dep)}${r.area ? ` · ${Math.round(r.area)}㎡` : ""} · 월세 비중 ${Math.round(r.share)}%${r.shareChg != null ? `(${pp(r.shareChg, 0)})` : ""}`));
      const b = T.regBtn(r.code, right);
      if (r.thin) b.classList.add("mk-thin");
      box.append(b);
    }
    sec.append(box);
    parts.push(sec);
    const notes = {
      sale: "3.3㎡당 = 시·구 ㎡당 중간값(거래 수 가중) × 3.3058. 1년 변화는 같은 3달끼리. 흐린 줄 = 거래가 적어 흔들릴 수 있는 곳.",
      jeonse: "신규 전세만(갱신은 5% 인상 상한이라 시세보다 낮아 따로 셈). 전세가율·갭은 같은 단지·건물·크기끼리 맞춘 값(지도 색칠·순위 탭과 같음). 전세값이 내리면 역전세 주의.",
      wolse: "신규 월세 계약의 월세·보증금 중간값(시·구 전체, 집 크기 섞임 — 면적도 함께 보세요). 월세 비중 = 신규 월세 ÷ (신규 월세 + 신규 전세).",
    };
    parts.push(el("p", "rfn-note", `${notes[tab]} 이번·지난달은 신고(계약 후 30일)가 덜 모여 뺐어요. 자료: 국토교통부 실거래가·전월세. 투자 권유가 아니에요.`));
    host.replaceChildren(...parts);
  }
  globalThis.REMARKET = { draw, sale, jeonse, wolse };

  const css = document.createElement("style");
  css.textContent = `
.mk-top { display: flex; flex-wrap: wrap; gap: 6px; justify-content: space-between; }
.mk-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.mk-chips button { font: inherit; font-size: 12px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; }
.mk-chips button.on { border-color: var(--accent, #6366f1); color: var(--text); font-weight: 700; background: color-mix(in srgb, var(--accent, #6366f1) 15%, transparent); }
.mk-list { max-height: none; } .mk-thin { opacity: .55; }
.mk-v { flex-wrap: wrap; justify-content: flex-end; white-space: normal; text-align: right; }
.mk-v .up { color: var(--up, #ef4444); } .mk-v .down { color: var(--down, #3b82f6); } .mk-v .bad { color: #ef4444; font-weight: 700; } .mk-v .warn { color: #f59e0b; font-weight: 700; }`;
  document.head.append(css);
})();
