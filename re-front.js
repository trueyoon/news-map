// 부동산 페이지 첫 화면 "📋 이번 주 부동산" 요약 (사용자 2026-11-25 "부동산 탭을 더 눈에 띄고 도움이 되게 → 첫 화면 요약부터")
// - re-impact.js 가 불러옴(real-estate.html 수정 없음). 머리 줄에 [📋 이번 주 요약] 단추 + 지도 위에 겹쳐 펼치는 칸(#reFront)
// - 한국 날짜로 하루 처음 열면 자동으로 한 번(끌 수 있음 reFrontAuto). ?sgg= 로 뉴스에서 들어왔을 땐 자동으로 안 엶
// - 칸: ① 한 줄 요약(서울·경기 아파트 1년 변화·신고가 비율) ② 금리·대출(re_macro) ③ 🔥 신고가(re_high_stats·re_new_highs — SQL re_highs.sql)
//       ④ 많이 오른 곳·내린 곳·거래 늘어난 곳(re_monthly_stats 아파트, 신고가 다 모인 최근 3달 — 이번·지난달 빼고) ⑤ 📰 소식 몰린 곳(re_news_days 7일)
//       ⑥ 🔮 AI 권역 예측(re_ai_notes·re_forecasts) ⑦ 미분양(re_unsold). 표가 없거나 못 읽으면 그 칸만 빠짐
// - 누르면: 시·구 → 목록 탭 + 지도 그곳으로 / 신고가 단지 → 단지 상세 / AI 예측 → [영향·예측] 탭. 읽는 양은 작음(약 1,500줄), 1시간 안에 다시 열면 받아 둔 것
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined") return;
  const PY = 3.3058, H = 3600e3;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 기억 없음 */ } },
  };
  const won = v => (v == null || !Number.isFinite(v) ? "–" : typeof fmtMan === "function" ? fmtMan(Math.round(v)) : `${Math.round(v).toLocaleString()}만`);
  const short = v => (v == null ? "–" : typeof fmtShort === "function" ? fmtShort(v) : won(v));
  const pc = (v, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);
  const cls = v => (v > 0 ? "up" : v < 0 ? "down" : "");
  const kstNow = () => new Date(Date.now() + 9 * H);
  const kstDay = () => kstNow().toISOString().slice(0, 10);
  const monthKey = back => { const d = kstNow(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)).toISOString().slice(0, 10); };
  const ymTxt = s => `${String(s).slice(2, 4)}.${String(s).slice(5, 7)}`;
  const THEME = { market: "시장·가격", supply: "공급·분양", redevelop: "재건축·재개발", transit: "교통 호재", develop: "개발·산업", rule: "규제·세금", rate: "금리·대출", risk: "위험" };
  const codesOf = code => (globalThis.REIMPACT?.codesOf ? REIMPACT.codesOf(code) : SGG[code] ? [code] : Object.keys(SGG).filter(c => c.startsWith(code.slice(0, 4))));
  const nameOf = code => (SGG[code] ? `${SGG[code].sido === "서울" ? "서울 " : ""}${SGG[code].name}` : code === "11000" ? "서울" : code === "41000" ? "경기" : (SGG[codesOf(code)[0]]?.name || code).split(" ")[0]);
  async function pageAll(make, max = 6000) {
    const out = [];
    for (let off = 0; off < max; off += 1000) {
      const { data, error } = await make().range(off, off + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  const safe = p => p.then(x => x, e => { console.warn("re-front", e?.message || e); return null; });

  // ── 자료 모으기 ──
  let data = null, loadedAt = 0, loading = null;
  async function load() {
    if (data && Date.now() - loadedAt < H) return data;
    if (loading) return loading;
    loading = (async () => {
      const since = monthKey(17), d30 = new Date(Date.now() + 9 * H - 30 * 864e5).toISOString().slice(0, 10), d7 = new Date(Date.now() + 9 * H - 7 * 864e5).toISOString().slice(0, 10);
      const [ms, mac, hs, nh, nd, ai, uns] = await Promise.all([
        safe(pageAll(() => db.from("re_monthly_stats").select("sgg_cd,ym,trades,median_price_m2").eq("kind", "apt").gte("ym", since).order("sgg_cd").order("ym"))),
        safe(pageAll(() => db.from("re_macro").select("series,region,ym,value").in("series", ["BASE_RATE", "MORTGAGE_RATE", "JEONSE_LOAN_RATE"]).eq("region", "00000").gte("ym", monthKey(14)).order("ym"))),
        safe((async () => { const l = await db.from("re_high_stats").select("day").order("day", { ascending: false }).limit(1); if (l.error) throw l.error; if (!l.data?.[0]) return { rows: [] };
          const r = await db.from("re_high_stats").select("day,sgg_cd,trades,highs,highs_canceled").eq("day", l.data[0].day); if (r.error) throw r.error; return { day: l.data[0].day, rows: r.data || [] }; })()),
        safe(pageAll(() => db.from("re_new_highs").select("sgg_cd,deal_date,umd_nm,apt_nm,apt_seq,excl_area,floor,price,prev_max,prev_n,prev_last,canceled,cancel_date").gte("deal_date", d30).order("deal_date", { ascending: false }), 4000)),
        safe(pageAll(() => db.from("re_news_days").select("day,region,theme,n,top").gte("day", d7).order("day", { ascending: false }))),
        safe((async () => { const n = await db.from("re_ai_notes").select("day,note").order("day", { ascending: false }).limit(1); if (n.error) throw n.error; if (!n.data?.[0]) return null;
          const f = await db.from("re_forecasts").select("zone,call,prob").eq("day", n.data[0].day); return { day: n.data[0].day, note: n.data[0].note?.note || n.data[0].note || {}, fc: f.data || [] }; })()),
        safe(pageAll(() => db.from("re_unsold").select("tbl,sido,region_name,ym,units").eq("region_name", "계").gte("ym", monthKey(8)).order("ym"))),
      ]);
      data = { ms, mac, hs, nh, nd, ai, uns };
      loadedAt = Date.now();
      return data;
    })().finally(() => { loading = null; });
    return loading;
  }

  // ── 계산 ──
  function regions(ms) {                                      // 시·구마다 최근 3달(신고 다 모인 달) vs 직전 3달·1년 전
    if (!ms?.length) return null;
    const by = new Map();
    for (const r of ms) { const k = String(r.ym).slice(0, 10); (by.get(r.sgg_cd) || by.set(r.sgg_cd, new Map()).get(r.sgg_cd)).set(k, r); }
    const win = (m, backs) => { let s = 0, n = 0; for (const b of backs) { const r = m.get(monthKey(b)); if (r?.trades && r.median_price_m2) { s += r.median_price_m2 * r.trades; n += r.trades; } } return n ? { m2: s / n, n } : null; };
    const out = [];
    for (const [code, m] of by) {
      if (!SGG[code]) continue;
      const now = win(m, [2, 3, 4]), prev = win(m, [5, 6, 7]), yr = win(m, [14, 15, 16]);
      if (!now) continue;
      out.push({ code, ppy: now.m2 * PY, perMonth: now.n / 3, yoy: yr ? (now.m2 / yr.m2 - 1) * 100 : null, volChg: prev ? (now.n / prev.n - 1) * 100 : null, prevPerMonth: prev ? prev.n / 3 : null, yrN: yr?.n || 0, now, yr });
    }
    // 서울·경기 전체: 시·구마다 1년 변화를 지금 거래 수로 가중 평균(값싼 곳 거래가 늘면 전체 중간값이 내려가 보이는 "구성 착시"를 피함)
    const tot = pre => { const xs = out.filter(r => r.code.startsWith(pre)); let a = 0, n = 0, y = 0, ny = 0; for (const r of xs) { a += r.now.m2 * r.now.n; n += r.now.n; if (r.yoy != null && r.yrN >= 30) { y += r.yoy * r.now.n; ny += r.now.n; } } return n && ny ? { yoy: y / ny, perMonth: n / 3, ppy: a / n * PY } : null; };
    return { list: out, seoul: tot("11"), gg: tot("41"), from: monthKey(4), to: monthKey(2) };
  }

  // ── 그리기 ──
  let panel = null;
  function close() { if (panel) panel.hidden = true; btn?.setAttribute("aria-expanded", "false"); }
  function ensurePanel() {
    if (panel?.isConnected) return panel;
    const mapEl = document.getElementById("map");
    if (!mapEl) return null;
    panel = el("section", "rfront"); panel.id = "reFront"; panel.setAttribute("aria-label", "이번 주 부동산 요약"); panel.hidden = true;
    panel.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    mapEl.append(panel);
    return panel;
  }
  async function open() {
    const p = ensurePanel();
    if (!p) return;
    p.hidden = false; btn?.setAttribute("aria-expanded", "true");
    if (!data || Date.now() - loadedAt >= H) p.replaceChildren(head(), el("p", "rfn-note", "불러오는 중…"));
    try { draw(await load()); } catch (e) { p.replaceChildren(head(), el("p", "rfn-warn", `불러오지 못했어요: ${e.message || e}`)); }
  }
  function head() {
    const h = el("div", "rfn-head");
    h.append(el("b", null, "📋 이번 주 부동산 · 서울·경기 아파트"));
    const auto = el("label", "rfn-auto"), cb = el("input"); cb.type = "checkbox"; cb.checked = store.get("reFrontAuto", true) !== false;
    cb.addEventListener("change", () => store.set("reFrontAuto", cb.checked));
    auto.append(cb, " 하루 처음 열 때 자동으로");
    const x = el("button", "rfn-x", "✕"); x.type = "button"; x.title = "닫기 (Esc)"; x.setAttribute("aria-label", "닫기"); x.addEventListener("click", close);
    h.append(auto, x);
    return h;
  }
  const sec = (title, sub) => { const s = el("div", "rfn-sec"); const t = el("div", "rfn-h", title); if (sub) t.append(el("small", null, ` ${sub}`)); s.append(t); return s; };
  function goRegion(code) {
    close();
    try {
      if (typeof showTab === "function") showTab("list");
      if (SGG[code] && typeof pickSgg === "function") { pickSgg("list", code); }
      else if (typeof dongs !== "undefined" && typeof map !== "undefined" && map) {
        const set = new Set(codesOf(code)), pts = dongs.filter(d => set.has(d.sgg_cd));
        if (pts.length) { const b = new maplibregl.LngLatBounds(); pts.forEach(d => b.extend([d.x, d.y])); map.fitBounds(b, { padding: 40, maxZoom: 12, duration: 900 }); }
      }
      globalThis.REIMPACT?.showNews?.(code);
    } catch (e) { console.warn("re-front", e); }
  }
  async function goApt(h) {
    close();
    try {
      const d = (typeof dongs !== "undefined" ? dongs : []).find(x => x.kind === "apt" && x.sgg_cd === h.sgg_cd && x.umd_nm === h.umd_nm);
      if (d && typeof map !== "undefined" && map) map.flyTo({ center: [d.x, d.y], zoom: Math.max(map.getZoom(), 14), duration: 900 });
      const r = await db.from("re_places").select("kind,sgg_cd,umd_nm,place_key,name,build_year,trades,trades_12m,last_date,last_price,last_area,pyeong_12m")
        .eq("kind", "apt").eq("sgg_cd", h.sgg_cd).eq("umd_nm", h.umd_nm).eq("place_key", h.apt_seq).maybeSingle();
      openPlace(r.data || { kind: "apt", sgg_cd: h.sgg_cd, umd_nm: h.umd_nm, place_key: h.apt_seq, name: h.apt_nm });
    } catch (e) { console.warn("re-front", e); }
  }
  const regBtn = (code, right, sub) => {
    const b = el("button", "rfn-row"); b.type = "button";
    const l = el("span", "rfn-nm", nameOf(code)); if (sub) l.append(el("small", null, sub));
    b.append(l, right); b.addEventListener("click", () => goRegion(code));
    return b;
  };
  function draw(D) {
    const p = ensurePanel();
    const parts = [head()];
    // ★ 관심 단지 새 소식(re-watch.js, 2026-11-25) — 맨 위
    if (globalThis.REWATCH?.front) { const x = el("div", "rfn-ext"); parts.push(x); REWATCH.front(x, { sec, close }); }
    const R = regions(D.ms);
    // ① 한 줄 요약
    const hs = D.hs?.rows?.length ? D.hs : null;
    const hsTot = pre => { if (!hs) return null; let t = 0, h = 0; for (const r of hs.rows) if (r.sgg_cd.startsWith(pre)) { t += r.trades; h += r.highs; } return t ? { t, h, pct: h / t * 100 } : null; };
    const sH = hsTot("11"), gH = hsTot("41");
    const big = el("div", "rfn-big");
    const card = (title, v, sub, c) => { const x = el("div", `rfn-kpi ${c || ""}`); x.append(el("small", null, title), el("b", null, v), el("small", null, sub)); return x; };
    if (R?.seoul) big.append(card("서울 아파트 3.3㎡당", pc(R.seoul.yoy), `1년 전보다 · ${short(R.seoul.ppy)}`, cls(R.seoul.yoy)));
    if (R?.gg) big.append(card("경기 아파트 3.3㎡당", pc(R.gg.yoy), `1년 전보다 · ${short(R.gg.ppy)}`, cls(R.gg.yoy)));
    if (sH) big.append(card("서울 신고가 비율", `${sH.pct.toFixed(0)}%`, `최근 30일 ${sH.t.toLocaleString()}건 중 ${sH.h.toLocaleString()}건`, "hot"));
    if (gH) big.append(card("경기 신고가 비율", `${gH.pct.toFixed(0)}%`, `최근 30일 ${gH.t.toLocaleString()}건 중 ${gH.h.toLocaleString()}건`, "hot"));
    if (big.childNodes.length) parts.push(big);
    if (R) parts.push(el("p", "rfn-note", `가격은 시·구 아파트 ㎡당 중간값(거래 수 가중)의 ${ymTxt(R.from)}~${ymTxt(R.to)} 평균 vs 1년 전 같은 3달. 이번·지난달은 신고(계약 후 30일)가 덜 모여 뺐어요. 팔린 단지 구성에 따라 흔들릴 수 있어요.`));
    // ② 금리·대출
    if (D.mac?.length) {
      const s = sec("💰 금리·대출", "한국은행");
      const row = el("div", "rfn-tiles");
      for (const [k, name, back] of [["BASE_RATE", "기준금리", 12], ["MORTGAGE_RATE", "주담대 금리(신규)", 3], ["JEONSE_LOAN_RATE", "전세대출 금리(신규)", 3]]) {
        const xs = D.mac.filter(r => r.series === k).sort((a, b) => String(a.ym).localeCompare(String(b.ym)));
        if (!xs.length) continue;
        const last = xs.at(-1), prev = xs[xs.length - 1 - back], diff = prev ? last.value - prev.value : null;
        const t = el("div", "rfn-tile");
        t.append(el("small", null, name), el("b", null, `${Number(last.value).toFixed(2)}%`),
          el("small", `rfn-d ${cls(diff)}`, diff == null ? `${ymTxt(last.ym)} 기준` : `${diff > 0 ? "▲" : diff < 0 ? "▼" : ""} ${Math.abs(diff).toFixed(2)}%p (${back}개월 전보다) · ${ymTxt(last.ym)}`));
        row.append(t);
      }
      s.append(row);
      parts.push(s);
    }
    // ③ 신고가
    {
      const s = sec("🔥 신고가", hs ? `최근 30일 계약 · ${String(hs.day).slice(5).replace("-", "/")} 계산` : "");
      if (!hs) s.append(el("p", "rfn-note", "신고가 기록을 준비 중이에요(SQL re_highs.sql 실행 뒤 매일 새벽에 계산돼요)."));
      else {
        s.append(el("p", "rfn-note", "신고가 = 같은 단지·같은 크기에서 그 전 3년 안의 모든 거래(3건 이상)보다 비싸게 팔린 거래. 비율이 높을수록 그 지역 매수세가 강하다는 뜻이에요."));
        const top = hs.rows.filter(r => r.trades >= 30).map(r => ({ ...r, pct: r.highs / r.trades * 100 })).sort((a, b) => b.pct - a.pct).slice(0, 6);
        const max = top[0]?.pct || 1;
        const list = el("div", "rfn-list");
        for (const r of top) {
          const bar = el("span", "rfn-bar"); const fill = el("i"); fill.style.width = `${Math.max(4, r.pct / max * 100)}%`; bar.append(fill);
          const right = el("span", "rfn-v"); right.append(bar, el("b", null, `${r.pct.toFixed(0)}%`), el("small", null, ` ${r.highs}/${r.trades}건`));
          list.append(regBtn(r.sgg_cd, right));
        }
        s.append(el("div", "rfn-sub", "신고가 비율 높은 시·구"), list);
        const nh = (D.nh || []).filter(h => !h.canceled && h.prev_n >= 5 && h.price / h.prev_max <= 1.3);
        const pick = [...nh].sort((a, b) => b.price - a.price).slice(0, 6);
        if (pick.length) {
          const ul = el("div", "rfn-list");
          for (const h of pick) {
            const b = el("button", "rfn-row"); b.type = "button"; b.title = "단지 상세 열기";
            const l = el("span", "rfn-nm", h.apt_nm || h.apt_seq); l.append(el("small", null, `${nameOf(h.sgg_cd)} ${h.umd_nm} · ${Math.round(Number(h.excl_area))}㎡${h.floor != null ? ` · ${h.floor}층` : ""} · ${String(h.deal_date).slice(5).replace("-", "/")}`));
            const r = el("span", "rfn-v"); r.append(el("b", null, won(h.price)), el("small", "up", ` 전 최고 ${won(h.prev_max)}보다 ${pc((h.price / h.prev_max - 1) * 100)}`));
            b.append(l, r); b.addEventListener("click", () => goApt(h));
            ul.append(b);
          }
          s.append(el("div", "rfn-sub", "가장 비싼 신고가 거래"), ul);
        }
        const cx = (D.nh || []).filter(h => h.canceled);
        if (cx.length) {
          const det = el("details", "rfn-cx");
          det.append(el("summary", null, `⚠ 신고가였다가 해제된 거래 ${cx.length}건 (최근 30일) — 시세를 띄우려는 허위 거래일 수 있어요`));
          const ul = el("div", "rfn-list");
          for (const h of cx.slice(0, 12)) {
            const b = el("button", "rfn-row"); b.type = "button";
            const l = el("span", "rfn-nm", h.apt_nm || h.apt_seq); l.append(el("small", null, `${nameOf(h.sgg_cd)} ${h.umd_nm} · ${Math.round(Number(h.excl_area))}㎡ · 계약 ${String(h.deal_date).slice(5).replace("-", "/")}${h.cancel_date ? ` → 해제 ${String(h.cancel_date).slice(5).replace("-", "/")}` : ""}`));
            b.append(l, el("span", "rfn-v", won(h.price))); b.addEventListener("click", () => goApt(h));
            ul.append(b);
          }
          det.append(ul); s.append(det);
        }
      }
      parts.push(s);
    }
    // ④ 오른 곳·내린 곳·거래 늘어난 곳
    if (R?.list?.length) {
      const s = sec("📊 시·구 움직임", `아파트 ${ymTxt(R.from)}~${ymTxt(R.to)}`);
      const cols = el("div", "rfn-cols");
      const col = (title, rows, right) => { const c = el("div", "rfn-col"); c.append(el("div", "rfn-sub", title)); const l = el("div", "rfn-list"); for (const r of rows) l.append(regBtn(r.code, right(r))); c.append(l); return c; };
      const ok = R.list.filter(r => r.perMonth >= 20 && r.yrN >= 45 && r.yoy != null);
      const v = (main, sub, c) => { const x = el("span", "rfn-v"); x.append(el("b", c, main)); if (sub) x.append(el("small", null, ` ${sub}`)); return x; };
      cols.append(
        col("📈 1년 전보다 많이 오른 곳", [...ok].sort((a, b) => b.yoy - a.yoy).slice(0, 5), r => v(pc(r.yoy), short(r.ppy), "up")),
        col("📉 오름이 약하거나 내린 곳", [...ok].sort((a, b) => a.yoy - b.yoy).slice(0, 5), r => v(pc(r.yoy), short(r.ppy), cls(r.yoy))),
        col("🔁 거래가 늘어난 곳 (직전 3달보다)", R.list.filter(r => r.volChg != null && r.prevPerMonth >= 20).sort((a, b) => b.volChg - a.volChg).slice(0, 5), r => v(pc(r.volChg, 0), `월 ${Math.round(r.perMonth)}건`, cls(r.volChg))));
      s.append(cols);
      parts.push(s);
    }
    // ⑤ 소식 몰린 곳
    if (D.nd?.length) {
      const BROAD = new Set(["00000", "11000", "41000", "90000"]);
      const agg = new Map();
      for (const r of D.nd) {
        if (BROAD.has(r.region)) continue;
        const a = agg.get(r.region) || { n: 0, themes: new Map(), top: null };
        a.n += r.n; a.themes.set(r.theme, (a.themes.get(r.theme) || 0) + r.n);
        if (!a.top && Array.isArray(r.top) && r.top[0]) a.top = r.top[0];
        agg.set(r.region, a);
      }
      const top = [...agg].filter(([c]) => SGG[c] || codesOf(c).length).sort((a, b) => b[1].n - a[1].n).slice(0, 5);
      if (top.length) {
        const s = sec("📰 부동산 소식이 몰린 곳", "최근 7일");
        const l = el("div", "rfn-list");
        for (const [code, a] of top) {
          const th = [...a.themes].sort((x, y) => y[1] - x[1])[0]?.[0];
          const right = el("span", "rfn-v"); right.append(el("b", null, `${a.n}건`), el("small", null, ` ${THEME[th] || ""}`));
          l.append(regBtn(code, right, a.top?.t ? ` ${a.top.t}` : ""));
        }
        s.append(l, el("p", "rfn-note", "뉴스 제목에서 지역·주제를 골라 셌어요. 소식이 많다고 값이 오르는 건 아니에요."));
        parts.push(s);
      }
    }
    // ⑥ AI 권역 예측
    if (D.ai?.fc?.length) {
      const s = sec("🔮 AI 권역 예측 (3개월)", `${String(D.ai.day).slice(5).replace("-", "/")} 월요일`);
      const up = D.ai.fc.filter(f => f.call === "up").length, dn = D.ai.fc.length - up;
      if (D.ai.note?.headline) s.append(el("div", "rfn-ai", D.ai.note.headline));
      const zones = globalThis.RESIG?.ZONES || [];
      const chips = el("div", "rfn-chips");
      for (const f of [...D.ai.fc].sort((a, b) => b.prob - a.prob)) {
        const z = zones.find(x => x.id === f.zone);
        chips.append(el("span", `rfn-chip ${f.call === "up" ? "up" : "down"}`, `${z?.name || f.zone} ${f.call === "up" ? "▲" : "▼"}${f.prob}%`));
      }
      const go = el("button", "rfn-link", `상승 ${up} · 하락 ${dn} 권역 — 자세히 (영향·예측 탭) →`); go.type = "button";
      go.addEventListener("click", () => { close(); try { showTab("impact"); } catch { /* 탭 없음 */ } });
      s.append(chips, go, el("p", "rfn-note", "확률 58% = 같은 판단을 100번 하면 58번쯤 맞는다는 뜻. 권역 전체 기준이고 투자 권유가 아니에요."));
      parts.push(s);
    }
    // ⑦ 미분양
    if (D.uns?.length) {
      const line = [];
      for (const [tbl, label] of [["DT_MLTM_2082", "미분양"], ["DT_MLTM_5328", "준공 후 미분양"]]) {
        for (const sido of ["서울", "경기"]) {
          const xs = D.uns.filter(r => r.tbl === tbl && r.sido === sido).sort((a, b) => String(a.ym).localeCompare(String(b.ym)));
          if (!xs.length) continue;
          const last = xs.at(-1), prev = xs[xs.length - 4];
          line.push(`${sido} ${label} ${last.units.toLocaleString()}호${prev ? ` (3달 전보다 ${pc((last.units / prev.units - 1) * 100, 0)})` : ""}`);
        }
      }
      if (line.length) { const s = sec("🏚 미분양", `국토교통부 · ${ymTxt(D.uns.at(-1).ym)}`); s.append(el("p", "rfn-txt", line.join(" · "))); parts.push(s); }
    }
    // 🛡 전세 위험 신호(re-jeonse.js, 2026-11-25) — 따로 받아 채움
    if (globalThis.REJEONSE?.front) { const x = el("div", "rfn-ext"); parts.push(x); REJEONSE.front(x, { sec, regBtn, nameOf, pc }); }
    // 📚 뉴스 → 집값 기록(re-newsprice.js, 2026-11-25)
    if (globalThis.RENEWSPRICE?.front) { const x = el("div", "rfn-ext"); parts.push(x); RENEWSPRICE.front(x, { sec, pc }); }
    parts.push(el("p", "rfn-note rfn-foot", "자료: 국토교통부 실거래가·미분양, 한국은행 ECOS, 뉴스 장부. 누르면 지도·목록이 그곳으로 가요. 투자 권유가 아니에요."));
    p.replaceChildren(...parts);
  }

  // ── 머리 줄 단추 + 자동 열기 ──
  let btn = null;
  try {
    const header = document.querySelector("#app > header");
    if (header) {
      btn = el("button", "rfn-open", "📋 이번 주 요약"); btn.type = "button"; btn.setAttribute("aria-expanded", "false");
      btn.addEventListener("click", () => (panel && !panel.hidden ? close() : open()));
      const brand = header.querySelector(".brand");
      brand ? brand.after(btn) : header.prepend(btn);
    }
  } catch { /* 단추만 */ }
  try {
    if (store.get("reFrontAuto", true) !== false && store.get("reFrontDay", "") !== kstDay() && !new URLSearchParams(location.search).get("sgg")) {
      let n = 0;
      const t = setInterval(() => {
        if (++n > 240) return clearInterval(t);
        if (document.getElementById("app")?.hidden || typeof map === "undefined" || !map) return;
        clearInterval(t); store.set("reFrontDay", kstDay()); open();
      }, 500);
    }
  } catch { /* 자동 열기만 */ }
  globalThis.REFRONT = { open, close, load, regions, async preview(extra) { const D = await load(); Object.assign(D, extra); ensurePanel().hidden = false; draw(D); } };   // preview: 미리보기에서 표가 생기기 전 모양 확인용

  const css = document.createElement("style");
  css.textContent = `
.rfn-open { font: inherit; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--accent, #6366f1); background: color-mix(in srgb, var(--accent, #6366f1) 18%, transparent); color: var(--text); cursor: pointer; }
.rfn-open[aria-expanded="true"] { background: var(--accent, #6366f1); color: #fff; }
.rfront { position: absolute; z-index: 5; top: 10px; left: 10px; width: min(620px, calc(100% - 20px)); max-height: calc(100% - 20px); overflow-y: auto; box-sizing: border-box;
  background: color-mix(in srgb, var(--panel, var(--bg)) 96%, transparent); border: 1px solid var(--line); border-radius: 14px; padding: 10px 14px 12px; box-shadow: 0 10px 30px rgba(0,0,0,.35);
  display: grid; gap: 10px; align-content: start; font-size: 13px; color: var(--text); }
.rfn-head { display: flex; align-items: center; gap: 10px; position: sticky; top: -10px; background: inherit; padding: 4px 0; z-index: 1; }
.rfn-head b { font-size: 15.5px; } .rfn-auto { margin-left: auto; font-size: 11.5px; color: var(--muted); display: flex; gap: 4px; align-items: center; cursor: pointer; }
.rfn-x { font: inherit; border: 1px solid var(--line); background: transparent; color: var(--muted); border-radius: 8px; padding: 2px 9px; cursor: pointer; }
.rfn-big { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 6px; }
.rfn-kpi { border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; display: grid; gap: 1px; background: color-mix(in srgb, var(--line) 25%, transparent); }
.rfn-kpi b { font-size: 24px; line-height: 1.2; } .rfn-kpi small { color: var(--muted); font-size: 11px; }
.rfn-kpi.up b { color: var(--up, #ef4444); } .rfn-kpi.down b { color: var(--down, #3b82f6); } .rfn-kpi.hot b { color: #f97316; }
.rfn-sec { display: grid; gap: 5px; border-top: 1px solid var(--line); padding-top: 8px; }
.rfn-h { font-weight: 800; font-size: 14px; } .rfn-h small { font-weight: 400; color: var(--muted); font-size: 11.5px; }
.rfn-sub { font-size: 12px; font-weight: 700; color: var(--muted); margin-top: 2px; }
.rfn-note { font-size: 11.5px; color: var(--muted); margin: 0; line-height: 1.5; } .rfn-warn { color: #f59e0b; } .rfn-txt { margin: 0; line-height: 1.6; }
.rfn-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px; }
.rfn-tile { border: 1px solid var(--line); border-radius: 10px; padding: 6px 9px; display: grid; } .rfn-tile b { font-size: 18px; } .rfn-tile small { color: var(--muted); font-size: 11px; }
.rfn-d.up { color: var(--up, #ef4444) !important; } .rfn-d.down { color: var(--down, #3b82f6) !important; }
.rfn-list { display: grid; gap: 2px; }
.rfn-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; font: inherit; text-align: left; background: transparent; border: 0; border-radius: 8px; padding: 4px 6px; color: var(--text); cursor: pointer; }
.rfn-row:hover, .rfn-row:focus-visible { background: color-mix(in srgb, var(--accent, #6366f1) 14%, transparent); outline: none; }
.rfn-nm { display: grid; min-width: 0; font-weight: 700; } .rfn-nm small { font-weight: 400; color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rfn-v { display: flex; align-items: center; gap: 4px; white-space: nowrap; } .rfn-v small { color: var(--muted); font-size: 11px; }
.rfn-v .up, .rfn-row .up { color: var(--up, #ef4444); } .rfn-v .down { color: var(--down, #3b82f6); }
.rfn-bar { display: inline-block; width: 90px; height: 8px; border-radius: 4px; background: color-mix(in srgb, var(--line) 60%, transparent); overflow: hidden; }
.rfn-bar i { display: block; height: 100%; background: linear-gradient(90deg, #f59e0b, #ef4444); }
.rfn-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
.rfn-col { border: 1px solid var(--line); border-radius: 10px; padding: 6px; }
.rfn-cx summary { cursor: pointer; font-size: 12px; color: #f59e0b; font-weight: 700; }
.rfn-ai { font-weight: 700; line-height: 1.5; }
.rfn-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.rfn-chip { font-size: 11.5px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); }
.rfn-chip.up { color: var(--up, #ef4444); } .rfn-chip.down { color: var(--down, #3b82f6); }
.rfn-link { justify-self: start; font: inherit; font-size: 12.5px; font-weight: 700; background: none; border: 0; padding: 0; color: var(--accent, #6366f1); cursor: pointer; }
.rfn-foot { border-top: 1px solid var(--line); padding-top: 6px; }
@media (max-width: 700px) { .rfront { top: 6px; left: 6px; width: calc(100% - 12px); max-height: calc(100% - 12px); padding: 8px 10px; } .rfn-kpi b { font-size: 20px; } .rfn-auto { display: none; } }`;
  document.head.append(css);
})();
