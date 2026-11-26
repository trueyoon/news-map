// 🔎 부동산 검색 (사용자 2026-11-26 "매매·월세·전세를 검색해서 볼 수 있게 검색 탭 + 검색하면 통계랑 영향을 같이",
//    "통계 검색에서 아파트·빌라·오피스텔 이름도 — 내가 갖고 있는 매물이 안 나와")
// - re-impact.js 가 re-market.js 바로 앞에 불러옴(real-estate.html 수정 없음, SQL 없음 — 있는 표만 읽음)
// ① 찾기 넓힘(RESEARCH.find) — 목록·통계 탭 검색창(전역 search 를 바꿔 끼움)과 🔎 검색 탭이 같이 씀
//    · 예전: 이름에 검색어가 "그대로 붙어" 있어야 했고(띄어쓰기 하나만 달라도 못 찾음 — "래미안 안양" ≠ "래미안안양메가트리아"), 지도 아래 범례에서 켠 종류만 찾았음
//    · 이제: 띄어쓰기·기호 무시 + 글자 순서만 맞아도 후보("메가트리아" → "래미안안양메가트리아"), 브랜드 표기 둘 다(e편한↔이편한·SK↔에스케이·LG↔엘지·GS↔지에스·IPARK↔아이파크·KCC↔케이씨씨·Xi↔자이),
//      지역 말 + 이름("수지 롯데캐슬" — 수지구 안에서 롯데캐슬), 동 + 번지("응암동 100-1"), 세 종류 모두(범례와 상관없이)
//    · 정확히 맞는 것 → 낱말이 다 들어 있는 것 → 글자 순서만 맞는 것("비슷한 이름") 순, 같은 칸 안은 12개월 거래 많은 순
//    · 한계: 실거래가 한 번도 없었던 집(아파트 3년·빌라·오피스텔 2년 안)은 목록(re_places)에 없음
// ② 🔎 검색 탭(re-front.js 요약 칸의 다섯 번째 탭) — 시·구 / 동 / 단지·건물을 고르면 한 화면에
//    📊 통계: 매매 3.3㎡당·1년 변화·월 거래·신고가 / 신규 전세·전세가율·갭·갱신 / 월세·보증금·월세 비중 + 17달 매매·전세 그래프 + 72곳 중 순위 (re-market.js 와 같은 계산)
//    🔮 영향: 권역 AI 예측 · 최근 30일 그 지역 부동산 소식 · 금리 내린 뒤 반응 · 미분양 · 뉴스 뒤 집값 기록
//    단지·건물이면 맨 위에 그 집 숫자(예상 매매가·전세·전세가율·갭, 집 비교와 같은 계산)
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined") return;
  const DAY = 864e5, PY = 3.3058;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 기억 없음 */ } },
  };
  const KN = { apt: "아파트", villa: "빌라", offi: "오피스텔" };
  const COLS = "kind,sgg_cd,umd_nm,place_key,jibun,name,build_year,trades,trades_12m,last_date,last_price,last_area,pyeong_12m";
  const kstDay = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
  const pc = (v, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);
  const pp = (v, d = 1) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%p`);
  const cls = v => (v > 0 ? "up" : v < 0 ? "down" : "");
  const man = v => (v == null || !Number.isFinite(v) ? "–" : typeof fmtShort === "function" ? fmtShort(v) : `${Math.round(v).toLocaleString()}만`);
  const eok = m => (m == null || !Number.isFinite(m) ? "–" : Math.abs(m) >= 10000 ? `${(m / 10000).toFixed(Math.abs(m) >= 100000 ? 0 : 1)}억` : `${Math.round(m).toLocaleString()}만`);
  /** 평수(사용자 2026-11-26 "평수가 빠져 있어"): 아파트는 흔히 부르는 공급 기준 평형(전용 × 1.33 ÷ 3.3 — 단지마다 ±1평, 추정), 빌라·오피스텔은 전용 평 */
  const pyOf = (kd, a) => (!a ? "" : kd === "apt" ? `약 ${Math.round(a * 1.33 / PY)}평형` : `약 ${Math.round(a / PY)}평`);
  const sizeTxt = (kd, a) => (!a ? "" : `전용 ${Math.round(a)}㎡ · ${pyOf(kd, a)}`);
  const sggName = code => (SGG[code] ? `${SGG[code].sido} ${SGG[code].name}` : code);

  // ════════════ ① 찾기 ════════════
  const ALIAS = [["e편한", "이편한"], ["sk", "에스케이"], ["lg", "엘지"], ["gs", "지에스"], ["ipark", "아이파크"], ["kcc", "케이씨씨"], ["xi", "자이"]];
  /** 비교용: 소문자·띄어쓰기·기호 없앰·브랜드 표기 하나로 */
  const canon = s => { let x = String(s || "").toLowerCase().replace(/[\s\-_.,·()[\]#'"`~!?/&+]/g, ""); for (const [a, ...bs] of ALIAS) for (const b of bs) x = x.split(b).join(a); return x; };
  /** DB 검색식 글자(쉼표·괄호·*·%·\ 등)를 띄어쓰기로 */
  const clean = s => String(s || "").replace(/[,()*%\\:."'`_[\]{}|<>]/g, " ").replace(/\s+/g, " ").trim();
  const isNum = t => /^산?\d+(-\d+)?(번지)?$/.test(t);
  const numOf = t => t.replace(/^산/, "").replace(/번지$/, "");
  /** 이 낱말이 가리키는 시·구 코드들 / 동인지 */
  function sggOfTok(t) {
    if (t.length < 2) return [];
    const b = t.replace(/(특별시|광역시|시|군|구)$/, "");
    if (b.length < 2 && !/[구군]$/.test(t)) return [];
    return Object.entries(SGG).filter(([, v]) => v.name.split(" ").some(w => w === t || w.replace(/(시|군|구)$/, "") === b) || v.sido === t || v.sido === b).map(([c]) => c);
  }
  const allDongs = () => (typeof dongs !== "undefined" && Array.isArray(dongs) ? dongs : []);
  const isDongTok = t => t.length >= 2 && /[동리가읍면]$/.test(t) && allDongs().some(d => d.umd_nm.split(" ").includes(t));
  /** 이름을 찾을 문자열 → 같은 뜻의 브랜드 표기 바꿔 쓴 것들(최대 4개) */
  function variants(s) {
    const low = s.toLowerCase(), out = new Set([s]);
    for (const g of ALIAS) for (const m of g) if (low.includes(m)) for (const o of g) if (o !== m) out.add(low.split(m).join(o));
    return [...out].slice(0, 4);
  }
  const charwise = s => `*${[...s.replace(/[\s-]/g, "")].join("*")}*`;
  const contig = s => `*${s.trim().replace(/\s+/g, "*")}*`;
  const nameOr = (strs, how) => strs.flatMap(variants).map(v => `name.ilike.${how(v)}`).join(",");

  const fcache = new Map();
  async function find(raw) {
    const q = clean(raw);
    if (!q) return null;
    const ck = q.toLowerCase(), c = fcache.get(ck);
    if (c && Date.now() - c.at < 5 * 60e3) return c.r;
    const toks = q.split(" ").filter(Boolean);
    const nums = toks.filter(isNum).map(numOf);
    const words = toks.filter(t => !isNum(t));
    const locS = new Set(), locD = [];
    const nameToks = [];
    for (const t of words) {
      const s = sggOfTok(t);
      if (s.length) { s.forEach(x => locS.add(x)); continue; }
      if (isDongTok(t)) { locD.push(t); continue; }
      nameToks.push(t);
    }
    const plain = words.join(" ");
    // 시·구·동 결과(화면에 있는 목록에서)
    const pj = canon(plain);
    const sggHits = pj ? Object.entries(SGG).filter(([c2, v]) => locS.has(c2) || canon(`${v.sido}${v.name}`).includes(pj)).slice(0, 30) : [];
    const seenD = new Set(), dongHits = [];
    if (pj) for (const d of [...allDongs()].sort((a, b) => b.trades_12m - a.trades_12m)) {
      const ok = canon(d.umd_nm).includes(pj) || (locD.length && locD.some(t => d.umd_nm.split(" ").includes(t)) && (!locS.size || locS.has(d.sgg_cd)) && !nameToks.length);
      if (!ok) continue;
      const k = `${d.sgg_cd}|${d.umd_nm}|${d.kind}`; if (seenD.has(k)) continue; seenD.add(k);
      dongHits.push(d); if (dongHits.length >= 20) break;
    }
    // 단지·건물: 여러 갈래로 물어보고 합침
    const reqs = [];
    const base = () => db.from("re_places").select(COLS);
    const withLoc = qq => { if (locS.size) qq = qq.in("sgg_cd", [...locS]); if (locD.length) qq = qq.ilike("umd_nm", `*${locD[0]}*`); return qq; };
    if (plain.length >= 1) {
      reqs.push(base().or(nameOr([plain], contig)).order("trades_12m", { ascending: false }).limit(80));                  // 그대로(띄어쓰기는 아무 글자)
      if (plain.replace(/\s/g, "").length >= 2) reqs.push(base().or(nameOr([plain], charwise)).order("trades_12m", { ascending: false }).limit(80));   // 글자 순서만
    }
    if (nameToks.length && (locS.size || locD.length)) {
      const nt = nameToks.join(" ");
      reqs.push(withLoc(base().or(nameOr([nt], charwise))).order("trades_12m", { ascending: false }).limit(80));               // 지역 안에서 이름
    }
    for (const n of nums.slice(0, 2)) {
      let qq = base().or(`place_key.ilike.${n}*,jibun.ilike.${n}*`);
      qq = withLoc(qq);
      if (nameToks.length) qq = qq.or(nameOr([nameToks.join(" ")], charwise));
      reqs.push(qq.order("trades_12m", { ascending: false }).limit(60));                                                     // 번지
    }
    const got = await Promise.all(reqs);
    const err = got.find(g => g.error)?.error;
    if (err && typeof signOutIfAuth === "function" && signOutIfAuth(err)) return null;
    const byKey = new Map();
    for (const g of got) for (const p of g.data || []) byKey.set(`${p.kind}|${p.sgg_cd}|${p.umd_nm}|${p.place_key}`, p);
    const nameCanon = canon(nameToks.join("")), allCanon = canon(words.join(""));
    const places = [...byKey.values()].map(p => {
      const nm = canon(p.name), loc = canon(`${SGG[p.sgg_cd]?.sido ?? ""}${SGG[p.sgg_cd]?.name ?? ""}${p.umd_nm}`);
      const jib = String(p.jibun || (p.kind === "apt" ? "" : p.place_key) || "");
      const numOk = !nums.length || nums.some(n => jib === n || jib.startsWith(`${n}-`) || jib.startsWith(n));
      const locOk = (!locS.size || locS.has(p.sgg_cd)) && (!locD.length || locD.some(t => p.umd_nm.includes(t)));
      const tokOk = words.every(t => { const ct = canon(t); return nm.includes(ct) || loc.includes(ct); });
      let score = 0;
      if (nm && (nm === allCanon || (nameCanon && nm === nameCanon))) score = 4;
      else if (tokOk && numOk && locOk) score = 3;
      else if (numOk && locOk && nameCanon && nm.includes(nameCanon)) score = 3;
      else if (nums.length && numOk && locOk && !nameToks.length) score = 3;
      else if (locOk && numOk) score = 1;
      return { ...p, score };
    }).filter(p => p.score > 0).sort((a, b) => b.score - a.score || (b.trades_12m || 0) - (a.trades_12m || 0) || (b.trades || 0) - (a.trades || 0));
    const strong = places.filter(p => p.score >= 3).slice(0, 60), weak = places.filter(p => p.score < 3).slice(0, 15);
    const r = { q, sggHits, dongHits, strong, weak, error: err || null };
    fcache.set(ck, { at: Date.now(), r });
    return r;
  }
  const placeName = p => (p.kind === "apt" ? p.name : (p.name && !p.name.startsWith("(") ? p.name : `${p.place_key}번지`)) || "–";
  const placeSub = p => `${SGG[p.sgg_cd]?.name ?? ""} ${p.umd_nm}${p.jibun ? ` ${p.jibun}` : p.kind !== "apt" && p.place_key ? ` ${p.place_key}` : ""}${p.build_year ? ` · ${p.build_year}년` : ""} · ${KN[p.kind]}`;
  const EMPTY = q => `"${q}"에 맞는 곳이 없어요. 실거래가 있었던 집만 목록에 있어요(아파트 최근 3년·빌라·오피스텔 최근 2년). 띄어쓰기를 바꾸거나, 동 이름과 번지로도 찾아 보세요 (예: 응암동 100-1).`;

  // 목록·통계 탭 검색창: 원래 search(w) 를 넓힌 찾기로 바꿈(그리는 모양은 예전과 같음)
  if (typeof search === "function" && typeof SEARCH !== "undefined") {
    const seqs = {};
    // eslint-disable-next-line no-global-assign
    search = async function (w) {
      const my = (seqs[w] = (seqs[w] || 0) + 1), out = $(SEARCH[w].out);
      const q = clean($(SEARCH[w].input).value);
      if (!q) return clearSearch(w);
      showResults(w, true);
      if (!out.childElementCount) out.replaceChildren(el("p", "sr-wait", "찾는 중…"));
      let r;
      try { r = await find(q); } catch (e) { r = { q, sggHits: [], dongHits: [], strong: [], weak: [], error: e }; }
      if (my !== seqs[w] || !r) return;
      const list = el("ol", "rows");
      if (r.sggHits.length) {
        list.append(el("h4", null, `시·군·구 ${r.sggHits.length}곳`));
        list.append(...r.sggHits.map(([code, v]) => {
          const n = allDongs().filter(d => d.sgg_cd === code && shown.has(d.kind)).reduce((a, d) => a + d.trades_12m, 0);
          const [li, b] = rowBtn(el("span", "sggic", "구"), `${v.sido} ${v.name}`, w === "stats" ? `${KIND[sKind].name} 통계 보기` : "지도에서 보기", numBox(el("b", null, `12개월 ${n.toLocaleString()}건`)));
          b.addEventListener("click", () => pickSgg(w, code));
          return li;
        }));
      }
      if (r.dongHits.length) {
        list.append(el("h4", null, `동 ${r.dongHits.length}곳`));
        list.append(...r.dongHits.map(d => { const li = dongRow(d), b = li.querySelector("button"); b.replaceWith(b.cloneNode(true)); li.querySelector("button").addEventListener("click", () => pickDong(w, d)); return li; }));
      }
      const row = p => {
        const [li, b] = rowBtn(kindIcon(p.kind), placeName(p), placeSub(p), numBox(el("b", null, p.pyeong_12m ? `평당 ${fmtMan(p.pyeong_12m)}` : fmtWon(p.last_price)), `12개월 ${p.trades_12m}건`));
        b.addEventListener("click", () => { if (w === "stats" && KIND[p.kind] && SGG[p.sgg_cd]) { try { statsFollow(p.kind, p.sgg_cd); } catch { /* 통계만 못 따라감 */ } } pickPlace(w, p); });
        return li;
      };
      if (r.strong.length) { list.append(el("h4", null, `단지·건물 ${r.strong.length}곳${r.strong.length >= 60 ? "+ (거래 많은 순)" : ""}`)); list.append(...r.strong.map(row)); }
      if (r.weak.length) { list.append(el("h4", null, `비슷한 이름 ${r.weak.length}곳 (글자 순서만 맞음)`)); list.append(...r.weak.map(row)); }
      if (!r.sggHits.length && !r.dongHits.length && !r.strong.length && !r.weak.length) list.append(el("li", "empty", r.error ? "찾지 못했어요. 잠시 뒤 다시 시도해 주세요." : EMPTY(q)));
      out.replaceChildren(list);
    };
    // 이미 검색어가 들어 있으면 새 방식으로 다시
    for (const w of Object.keys(SEARCH)) if ($(SEARCH[w].input)?.value.trim()) search(w);
    for (const w of Object.keys(SEARCH)) { const inp = $(SEARCH[w].input); if (inp && w === "stats") inp.placeholder = "지역·동·아파트·빌라·오피스텔 이름·번지 (예: 수지, 반포동, 메가트리아)"; else if (inp) inp.placeholder = "동·단지·건물·시군구·번지 찾기 (예: 은마, 역삼동, 응암동 100-1)"; }
  }

  // ════════════ ② 🔎 검색 탭 ════════════
  let pick = store.get("reSrchPick", null), qText = store.get("reSrchQ", ""), kind = store.get("reSrchKind", "apt");
  if (!KN[kind]) kind = "apt";
  let T = null, hostEl = null, seq = 0;
  const savePick = p => { pick = p; store.set("reSrchPick", p); };

  function draw(host, tools, newPick) {
    T = tools; hostEl = host;
    if (newPick) { savePick(newPick); if (newPick.t === "place" && KN[newPick.p?.kind]) kind = newPick.p.kind; }
    const box = el("div", "sr-box");
    const inp = el("input", "sr-in"); inp.type = "search"; inp.value = qText; inp.autocomplete = "off";
    inp.placeholder = "지역·동·아파트·빌라·오피스텔 이름·번지 (예: 분당, 반포동, 메가트리아, 응암동 100-1)";
    inp.setAttribute("aria-label", "부동산 검색");
    const res = el("div", "sr-res"), rep = el("div", "sr-rep");
    let tm = null;
    inp.addEventListener("input", () => { qText = inp.value; store.set("reSrchQ", qText); clearTimeout(tm); tm = setTimeout(() => results(res, rep, inp.value), 250); });
    inp.addEventListener("keydown", e => { if (e.key === "Escape" && inp.value) { e.stopPropagation(); inp.value = ""; qText = ""; store.set("reSrchQ", ""); res.replaceChildren(); rep.hidden = false; } });
    box.append(inp);
    host.replaceChildren(box, res, rep);
    if (pick) report(rep); else rep.append(el("p", "rfn-note", "찾은 곳을 누르면 그곳의 매매·전세·월세 통계와 영향(AI 예측·뉴스·금리·미분양)을 한 화면에 보여 줘요. 매매·전세·월세 탭에서 시·구를 눌러도 여기로 와요."));
    if (!newPick && qText && !pick) results(res, rep, qText);
    setTimeout(() => { if (!pick) inp.focus(); }, 0);
  }
  let rseq = 0;
  async function results(res, rep, raw) {
    const my = ++rseq;
    if (!clean(raw)) { res.replaceChildren(); rep.hidden = false; return; }
    res.replaceChildren(el("p", "rfn-note", "찾는 중…"));
    let r;
    try { r = await find(raw); } catch (e) { if (my === rseq) res.replaceChildren(el("p", "rfn-warn", `찾지 못했어요: ${e.message || e}`)); return; }
    if (my !== rseq || !r) return;
    rep.hidden = true;
    const box = el("div", "rfn-list sr-list");
    const btn = (icon, name, sub, right, on) => { const b = el("button", "rfn-row sr-row"); b.type = "button"; const l = el("span", "rfn-nm"); l.append(icon, ` ${name}`); if (sub) l.append(el("small", null, sub)); b.append(l, el("span", "rfn-v", right)); b.addEventListener("click", on); return b; };
    const go = p => { res.replaceChildren(); rep.hidden = false; savePick(p); if (p.t === "place" && KN[p.p.kind]) { kind = p.p.kind; } report(rep); };
    if (r.sggHits.length) { box.append(el("div", "sr-h", `시·군·구 ${r.sggHits.length}곳`)); for (const [code, v] of r.sggHits.slice(0, 12)) box.append(btn(el("span", "sr-ic", "구"), `${v.sido} ${v.name}`, null, "통계·영향 보기", () => go({ t: "sgg", code }))); }
    if (r.dongHits.length) {
      const seen = new Set(), ds = r.dongHits.filter(d => { const k = `${d.sgg_cd}|${d.umd_nm}`; if (seen.has(k)) return false; seen.add(k); return true; });
      box.append(el("div", "sr-h", `동 ${ds.length}곳`));
      for (const d of ds.slice(0, 12)) box.append(btn(el("span", "sr-ic", "동"), d.umd_nm, ` ${SGG[d.sgg_cd]?.name ?? ""}`, "통계·영향 보기", () => go({ t: "dong", code: d.sgg_cd, umd: d.umd_nm })));
    }
    const prow = p => btn(typeof kindIcon === "function" ? kindIcon(p.kind, 15) : el("span", null, KN[p.kind]), placeName(p), ` ${placeSub(p)}`, p.pyeong_12m ? `평당 ${man(p.pyeong_12m)} · 12개월 ${p.trades_12m}건` : `12개월 ${p.trades_12m}건`,
      () => go({ t: "place", code: p.sgg_cd, p: { kind: p.kind, sgg_cd: p.sgg_cd, umd_nm: p.umd_nm, place_key: p.place_key, jibun: p.jibun, name: p.name, build_year: p.build_year, pyeong_12m: p.pyeong_12m, trades_12m: p.trades_12m } }));
    if (r.strong.length) { box.append(el("div", "sr-h", `아파트·빌라·오피스텔 ${r.strong.length}곳`)); for (const p of r.strong.slice(0, 40)) box.append(prow(p)); }
    if (r.weak.length) { box.append(el("div", "sr-h", `비슷한 이름 ${r.weak.length}곳 (글자 순서만 맞음)`)); for (const p of r.weak) box.append(prow(p)); }
    if (!box.childElementCount) box.append(el("p", "rfn-note", EMPTY(r.q)));
    res.replaceChildren(box);
  }

  // ── 보고서 ──
  const kpi = (title, v, sub, c) => { const x = el("div", `rfn-kpi ${c || ""}`); x.append(el("small", null, title), el("b", null, v)); if (sub) x.append(el("small", null, sub)); return x; };
  const line = (icon, txt, sub) => { const p = el("div", "sr-line"); p.append(el("span", "sr-li", icon), el("span", null, txt)); if (sub) p.append(el("small", null, ` ${sub}`)); return p; };
  const mkBtn = (t, on, title) => { const b = el("button", "sr-act", t); b.type = "button"; if (title) b.title = title; b.addEventListener("click", on); return b; };
  const kstNow = () => new Date(Date.now() + 9 * 3600e3);
  const monthKey = back => { const d = kstNow(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1)).toISOString().slice(0, 10); };
  const ym = s => `${String(s).slice(2, 4)}.${String(s).slice(5, 7)}`;
  const rankOf = (rows, code, key, desc = true) => { const xs = rows.filter(r => key(r) != null && !r.thin); const me = xs.find(r => r.code === code); if (!me) return null; const sorted = [...xs].sort((a, b) => (desc ? key(b) - key(a) : key(a) - key(b))); return { i: sorted.indexOf(me) + 1, n: sorted.length }; };
  const keysOf = code => (/^41\d\d[1-9]$/.test(code) ? [code, `${code.slice(0, 4)}0`] : [code]);

  async function report(rep) {
    const my = ++seq, p = pick;
    if (!p || !SGG[p.code]) { rep.replaceChildren(el("p", "rfn-note", "찾은 곳을 누르면 여기에 보여 줘요.")); return; }
    const code = p.code, kd = p.t === "place" ? p.p.kind : kind;
    rep.replaceChildren(el("p", "rfn-note", "불러오는 중…"));
    const parts = [];
    // 머리
    const head = el("div", "sr-head");
    const ttl = el("div", "sr-ttl");
    if (p.t === "place") { ttl.append(typeof kindIcon === "function" ? kindIcon(kd, 18) : "", el("b", null, ` ${placeName(p.p)}`), el("small", null, ` ${placeSub(p.p)}`)); }
    else if (p.t === "dong") ttl.append(el("b", null, `📍 ${p.umd}`), el("small", null, ` ${sggName(code)}`));
    else ttl.append(el("b", null, `📍 ${sggName(code)}`));
    head.append(ttl);
    const acts = el("div", "sr-acts");
    if (p.t === "place") {
      acts.append(mkBtn("🏢 단지 상세", () => { T?.close?.(); try { openPlace(p.p); } catch (e) { console.warn(e); } }, "실거래 점 그래프·면적 타입·층·전세 위험"));
      if (globalThis.REWATCH?.toggle) acts.append(mkBtn("☆ 관심", () => REWATCH.toggle(p.p)));
      if (globalThis.REHOMECMP?.toggle) acts.append(mkBtn("🏠 집 비교에 담기", () => REHOMECMP.toggle(p.p)));
    }
    if (p.t === "dong") acts.append(mkBtn("🏘 이 동 단지 목록", () => { const d = allDongs().find(x => x.sgg_cd === code && x.umd_nm === p.umd && x.kind === kd) || allDongs().find(x => x.sgg_cd === code && x.umd_nm === p.umd); T?.close?.(); if (d) { try { showTab("list"); openDong(d, true); } catch (e) { console.warn(e); } } }));
    acts.append(mkBtn("📈 통계 탭 그래프", () => { T?.close?.(); try { showTab("stats"); statsFollow(kd, code); } catch (e) { console.warn(e); } }, "월별 가격·거래량 그래프"),
      mkBtn("🔮 영향·예측 탭", () => { T?.close?.(); try { showTab("impact"); globalThis.REIMPTAB?.pick?.(code); } catch (e) { console.warn(e); } }),
      mkBtn("🗺 지도에서", () => (T?.goRegion ? T.goRegion(code) : null)));
    head.append(acts);
    parts.push(head);
    if (p.t !== "place") {
      const kc = el("div", "mk-chips");
      for (const [k, t] of Object.entries(KN)) { const b = el("button", k === kind ? "on" : null, t); b.type = "button"; b.addEventListener("click", () => { kind = k; store.set("reSrchKind", k); report(rep); }); kc.append(b); }
      parts.push(kc);
    }
    // 자료 모으기
    const M = globalThis.REMARKET;
    const safe = pr => pr.catch(e => { console.warn("re-search", e); return null; });
    const [sale, jeon, wol, raw, imp, news, rate, ev, place] = await Promise.all([
      safe(M?.sale ? M.sale(kd) : Promise.resolve(null)), safe(M?.jeonse ? M.jeonse(kd) : Promise.resolve(null)), safe(M?.wolse ? M.wolse(kd) : Promise.resolve(null)),
      safe(M?.raw ? M.raw(kd) : Promise.resolve(null)),
      safe(globalThis.REIMPTAB?.load ? REIMPTAB.load() : Promise.resolve(null)),
      safe((async () => { const r = await db.from("re_news_days").select("day,region,theme,n,top").in("region", keysOf(code)).gte("day", kstDay(Date.now() - 30 * DAY)).order("day", { ascending: false }).limit(300); if (r.error) throw r.error; return r.data || []; })()),
      safe(globalThis.RECOLOR?.values ? RECOLOR.values("rate", "apt", { budget: 0 }) : Promise.resolve(null)),
      safe((async () => {
        const e = await db.from("re_news_events").select("id,day,region,theme,n7,top").in("region", keysOf(code)).order("day", { ascending: false }).limit(6); if (e.error) throw e.error;
        const ids = (e.data || []).map(x => x.id); if (!ids.length) return { ev: [], out: [] };
        const o = await db.from("re_event_outcomes").select("event_id,horizon,matched,excess,final").in("event_id", ids); return { ev: e.data || [], out: o.data || [] };
      })()),
      safe(p.t === "place" && globalThis.REFINDER?.loadOne ? REFINDER.loadOne(p.p) : Promise.resolve(null)),
    ]);
    if (my !== seq) return;
    // 단지·건물 숫자
    if (p.t === "place") {
      // "💰 가격" 칸(사용자 2026-11-26 "이 집 숫자 → 가격, 더 눈에 띄는 색" → "너무 화려함, 조금 덜 + 전세가도 눈에 띄게"): 옅은 금빛 테두리·바탕, 예상 매매가(금색)·전세가(청록) 크게
      const s = el("div", "rfn-sec sr-price"); s.append(el("div", "rfn-h", "💰 가격"));
      let m = null;
      try { if (place && globalThis.REHOMECMP?.metrics) m = REHOMECMP.metrics({ ...p.p, area: null }, place); } catch (e) { console.warn(e); }
      if (m) {
        const kd0 = p.p.kind;
        const sz = el("div", "sr-size");
        sz.append(el("b", null, `📐 ${sizeTxt(kd0, m.A)}`), el("small", null, kd0 === "apt" ? ` · 전용 약 ${Math.round(m.A / PY)}평 · 평형 = 흔히 부르는 공급면적 기준(추정, ±1평)` : " · 전용면적 기준"));
        s.append(sz);
        const g = el("div", "rfn-big sr-big");
        g.append(kpi(`🏠 예상 매매가 (${pyOf(kd0, m.A)})`, eok(m.price), m.priceBasis, "sr-hero"),
          kpi(`🔑 전세가 (신규, ${pyOf(kd0, m.A)})`, eok(m.jeonse), m.jn ? `12개월 ${m.jn}건 중간값` : "전세 기록 없음", "sr-hero sr-hero-j"),   // 전세가도 크게(사용자 2026-11-26)
          kpi("평당 가격 (3.3㎡당, 12개월)", man(m.ppy12), `1년 전보다 ${pc(m.chg)}${m.fromPeak != null ? ` · 3년 최고 대비 ${pc(m.fromPeak)}` : ""}`, cls(m.chg)),
          kpi("전세가율 · 갭", m.ratio != null ? `${Math.round(m.ratio)}%` : "–", m.price && m.jeonse ? `갭 ${eok(m.price - m.jeonse)}${m.ratio >= 80 ? " · ⚠ 깡통전세 주의" : m.ratio >= 70 ? " · 주의" : ""}` : "", m.ratio >= 80 ? "bad" : m.ratio >= 70 ? "warn" : ""),
          kpi("거래 (12개월)", `${m.n12}건`, `${m.cx12 ? `해제 ${m.cx12}건 · ` : ""}${m.last ? `마지막 ${String(m.last.deal_date).slice(2).replaceAll("-", ".")} ${eok(m.last.price)}${m.last.excl_area ? ` (${Math.round(Number(m.last.excl_area))}㎡·${pyOf(kd0, Number(m.last.excl_area)).replace("약 ", "")})` : ""}` : ""}`));
        s.append(g);
        if (m.sz?.groups?.length > 1) s.append(el("p", "rfn-note", `크기별 12개월 거래: ${[...m.sz.groups].sort((a, b) => b.n12 - a.n12).filter(x => x.n12).slice(0, 6).map(x => `${Math.round(x.mid)}㎡(${pyOf(kd0, x.mid).replace("약 ", "")}) ${x.n12}건`).join(" · ")} — 가장 많이 거래된 크기(${m.A}㎡·${pyOf(kd0, m.A).replace("약 ", "")})로 계산했어요. 다른 크기는 '단지 상세'에서.`));
        const qs = (m.quarters || []).filter(x => x.n >= 5);
        if (qs.length >= 3) s.append(spark([{ name: "이 집 평당(분기, 모든 크기·거래 5건 이상 분기)", color: "#2563eb", pts: qs.map(x => ({ k: x.k.replace("-", " Q").replace(/ Q(\d)/, (_, d) => ` ${+d + 1}분기`), v: x.v })) }]));
      } else s.append(el("p", "rfn-note", "이 집 자료를 불러오지 못했어요."));
      parts.push(s);
    }
    // 동
    if (p.t === "dong") {
      const s = el("div", "rfn-sec"); s.append(el("div", "rfn-h", `🏘 ${p.umd} (12개월)`));
      const g = el("div", "rfn-big sr-big");
      for (const d of allDongs().filter(x => x.sgg_cd === code && x.umd_nm === p.umd)) g.append(kpi(`${KN[d.kind]} ${d.places}곳`, d.pyeong_12m ? `평당 ${man(d.pyeong_12m)}` : "–", `거래 ${d.trades_12m.toLocaleString()}건`));
      s.append(g, el("p", "rfn-note", `아래 통계는 ${sggName(code)} 전체예요(동 단위 전월세 통계는 없어요).`));
      parts.push(s);
    }
    // 📊 통계
    const span = `${ym(monthKey(4))}~${ym(monthKey(2))}`;
    const st = el("div", "rfn-sec"); const sh = el("div", "rfn-h", `📊 ${SGG[code].name} ${KN[kd]} 통계`); sh.append(el("small", null, ` 최근 3달(${span}) vs 1년 전`)); st.append(sh);
    const g = el("div", "rfn-big sr-big");
    const S = sale?.find(r => r.code === code), J = jeon?.find(r => r.code === code), W = wol?.find(r => r.code === code);
    if (S) { const rk = rankOf(sale, code, r => r.now.v); g.append(kpi("🏠 매매 평당 (3.3㎡)", man(S.now.v), `1년 ${pc(S.yoy)} · 월 ${Math.round(S.perMonth)}건${S.volChg != null ? `(직전 대비 ${pc(S.volChg, 0)})` : ""}${S.highs != null ? ` · 신고가 ${Math.round(S.highs)}%` : ""}${rk ? ` · ${rk.n}곳 중 ${rk.i}위` : ""}`, cls(S.yoy))); }
    else g.append(kpi("🏠 매매", "–", "최근 3달 거래가 없어요"));
    if (J) { const rk = rankOf(jeon, code, r => r.now.v); g.append(kpi("🔑 신규 전세 평당 (3.3㎡)", man(J.now.v), `1년 ${pc(J.yoy)} · 월 ${Math.round(J.perMonth)}건${rk ? ` · ${rk.n}곳 중 ${rk.i}위` : ""}`, cls(J.yoy))); g.append(kpi("🛡 전세가율 · 갭", J.ratio != null ? `${Math.round(J.ratio)}%` : "–", `${J.gap != null ? `갭 중간 ${eok(J.gap)} · ` : ""}갱신 ${J.renewShare != null ? `${Math.round(J.renewShare)}%` : "–"}${J.raise != null ? ` · 갱신 인상 ${J.raise.toFixed(1)}%` : ""}`, J.ratio >= 80 ? "bad" : J.ratio >= 70 ? "warn" : "")); }
    else g.append(kpi("🔑 신규 전세", "–", "최근 3달 계약이 없어요"));
    if (W) g.append(kpi("💵 신규 월세 중간값", `${Math.round(W.now.v).toLocaleString()}만`, `1년 ${pc(W.yoy)} · 보증금 ${eok(W.dep)}${W.area ? ` · ${Math.round(W.area)}㎡(${Math.round(W.area / PY)}평)` : ""} · 월세 비중 ${Math.round(W.share)}%${W.shareChg != null ? `(${pp(W.shareChg, 0)})` : ""}`, cls(W.yoy)));
    else g.append(kpi("💵 신규 월세", "–", "최근 3달 계약이 없어요"));
    st.append(g);
    if ((S?.thin || J?.thin || W?.thin)) st.append(el("p", "rfn-note", "거래·계약이 적은 곳은 숫자가 크게 흔들릴 수 있어요."));
    // 17달 그래프
    if (raw) {
      const ms = []; for (let b = 17; b >= 2; b--) ms.push(monthKey(b));
      const sm = new Map(raw.sale.filter(r => r.sgg_cd === code).map(r => [String(r.ym).slice(0, 10), r]));
      const jm = new Map(raw.rent.filter(r => r.sgg_cd === code && r.rent_type === "jeonse" && r.contract === "new").map(r => [String(r.ym).slice(0, 10), r]));
      const wm = new Map(raw.rent.filter(r => r.sgg_cd === code && r.rent_type === "wolse" && r.contract === "new").map(r => [String(r.ym).slice(0, 10), r]));
      const ser = [
        { name: "매매 평당", color: "#2563eb", pts: ms.map(k => ({ k: ym(k), v: sm.get(k)?.trades >= 5 ? sm.get(k).median_price_m2 * PY : null })) },
        { name: "신규 전세 평당", color: "#14b8a6", pts: ms.map(k => ({ k: ym(k), v: jm.get(k)?.cnt >= 5 ? jm.get(k).deposit_m2_med * PY : null })) },
      ];
      if (ser.some(s => s.pts.filter(x => x.v != null).length >= 3)) st.append(spark(ser, "만"));
      const wser = [{ name: "신규 월세 중간값", color: "#f97316", pts: ms.map(k => ({ k: ym(k), v: wm.get(k)?.cnt >= 5 ? Number(wm.get(k).rent_med) : null })) }];
      if (wser[0].pts.filter(x => x.v != null).length >= 3) st.append(spark(wser, "만", true));
    }
    parts.push(st);
    // 🔮 영향
    const im = el("div", "rfn-sec"); im.append(el("div", "rfn-h", "🔮 영향"));
    const zone = globalThis.RESIG?.zoneOf?.(code);
    const fc = zone && imp?.ai?.fc?.[zone.id];
    if (fc) {
      const up = fc.call === "up", prob = fc.prob;
      im.append(line("🤖", `${zone.name} AI 예측 (아파트, 다음 3달): ${up ? "▲ 오를" : "▼ 내릴"} 확률 ${prob != null ? `${Math.round(prob)}%` : "–"}${fc.exp_move != null ? ` · 예상 ${pc(fc.exp_move)}` : ""}`, imp.ai.note?.day ? `(${String(imp.ai.note.day).slice(5).replace("-", "/")} 예측)` : ""));
      if (fc.reason) im.append(el("p", "sr-why", fc.reason));
      if (fc.flip) im.append(el("p", "sr-why muted", `틀리게 되는 경우: ${fc.flip}`));
    } else if (zone) im.append(line("🤖", `${zone.name} AI 예측: 아직 없어요(매주 월요일 아침).`));
    // 뉴스
    if (news) {
      const counts = {}, seen = new Set(), top = []; let n = 0;
      for (const r of news) { counts[r.theme] = (counts[r.theme] || 0) + r.n; n += r.n; for (const t of r.top || []) if (t?.u && !seen.has(t.u)) { seen.add(t.u); top.push({ ...t, day: r.day }); } }
      const TH = { market: "시장·가격", supply: "공급·분양", redevelop: "재건축·재개발", transit: "교통 호재", develop: "개발·산업", rule: "규제·세금", rate: "금리·대출", risk: "위험" };
      if (n) {
        im.append(line("📰", `최근 30일 이 지역 부동산 소식 ${n}건`, Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${TH[k] || k} ${v}`).join(" · ")));
        const ul = el("ul", "sr-news");
        for (const t of top.slice(0, 5)) { const li = el("li"), a = el("a", null, t.t || t.u); a.href = t.u; a.target = "_blank"; a.rel = "noopener noreferrer"; li.append(el("small", null, `${String(t.day).slice(5).replace("-", "/")} `), a); ul.append(li); }
        im.append(ul);
      } else im.append(line("📰", "최근 30일 이 지역 부동산 소식은 없어요."));
    }
    // 금리 반응
    const rr = rate?.map?.get(code);
    if (rr) im.append(line("💹", `금리 내린 뒤 이 지역 아파트값: 서울·경기 전체보다 ${pp(rr.v)}`, `${rr.sub || ""}${rr.thin ? " · 표본 적음" : ""}`));
    // 미분양
    if (imp?.uns) {
      const keys = new Set(keysOf(code));
      for (const [tbl, label] of [["DT_MLTM_2082", "미분양"], ["DT_MLTM_5328", "준공 후 미분양"]]) {
        const by = new Map(), names = new Set();
        for (const r of imp.uns) if (r.tbl === tbl && keys.has(r.region_cd) && !/^(계|합계)$/.test(r.region_name)) { by.set(r.ym, (by.get(r.ym) || 0) + r.units); names.add(r.region_cd === code ? "" : r.region_name); }
        const ms = [...by.keys()].sort(), last = ms.at(-1);
        const whole = [...names].filter(Boolean)[0];   // 경기 구가 있는 시는 시 전체 숫자(통계청이 시 단위로만 냄)
        if (last) { const before = ms[ms.indexOf(last) - 3]; const b = before ? by.get(before) : null, d = b != null ? by.get(last) - b : null; im.append(line("🏚", `${label} ${by.get(last).toLocaleString()}호 (${ym(last)}${whole ? `, ${whole} 전체` : ""})`, d != null ? `3달 전 ${b.toLocaleString()}호에서 ${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toLocaleString()}` : "")); }
      }
    }
    // 뉴스 뒤 집값 기록
    if (ev?.ev?.length) {
      const TH = { market: "시장·가격", supply: "공급·분양", redevelop: "재건축·재개발", transit: "교통 호재", develop: "개발·산업", rule: "규제·세금", rate: "금리·대출", risk: "위험" };
      const ul = el("ul", "sr-news");
      for (const e of ev.ev.slice(0, 4)) {
        const o30 = ev.out.find(o => o.event_id === e.id && o.horizon === 30), o90 = ev.out.find(o => o.event_id === e.id && o.horizon === 90);
        const res = [o30, o90].filter(o => o && o.excess != null).map(o => `${o.horizon}일 뒤 전체 대비 ${pp(o.excess)}${o.final ? "" : "(진행 중)"}`).join(" · ");
        const li = el("li"); li.append(el("small", null, `${String(e.day).slice(5).replace("-", "/")} ${TH[e.theme] || e.theme} `), el("span", null, (e.top?.[0]?.t) || ""), el("small", "muted", ` ${res || "결과는 30일 + 신고 기간 뒤에"}`));
        ul.append(li);
      }
      im.append(line("📚", "뉴스 뒤 집값 기록 (이 지역)", "같은 단지·크기끼리 소식 전후 비교"), ul);
    }
    if (im.childElementCount === 1) im.append(el("p", "rfn-note", "영향 자료가 아직 없어요."));
    parts.push(im);
    parts.push(el("p", "rfn-note", `자료: 국토교통부 실거래가·전월세, 한국은행·통계청, 뉴스. 시·구 숫자는 팔린 집 구성에 따라 흔들려요. 이번·지난달은 신고가 덜 모여 뺐어요. 투자 권유가 아니에요.`));
    if (my === seq) rep.replaceChildren(...parts);
  }

  // 작은 선 그래프(여러 줄) — pts: [{k, v}] 같은 길이
  function spark(series, unit = "만", small = false) {
    const W = 560, H = small ? 90 : 130, L = 46, R = 8, Tp = 10, B = 20;
    const vals = series.flatMap(s => s.pts.map(p => p.v)).filter(v => v != null);
    const wrap = el("div", "sr-spark");
    if (!vals.length) return wrap;
    let lo = Math.min(...vals), hi = Math.max(...vals); if (hi === lo) { hi += 1; lo -= 1; } const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const n = series[0].pts.length, X = i => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1)), Y = v => Tp + (H - Tp - B) * (1 - (v - lo) / (hi - lo));
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", series.map(s => s.name).join(", "));
    const mk = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
    for (const v of [lo + pad, (lo + hi) / 2, hi - pad]) { svg.append(mk("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "sr-grid" })); const t = mk("text", { x: L - 4, y: Y(v) + 3, "text-anchor": "end", class: "sr-ax" }); t.textContent = man(v); svg.append(t); }
    for (const i of [0, Math.floor((n - 1) / 2), n - 1]) { const t = mk("text", { x: X(i), y: H - 5, "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle", class: "sr-ax" }); t.textContent = series[0].pts[i].k; svg.append(t); }
    for (const s of series) {
      let d = "", pen = false;
      s.pts.forEach((p, i) => { if (p.v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`; pen = true; });
      svg.append(mk("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round" }));
      const li = [...s.pts.keys()].reverse().find(i => s.pts[i].v != null);
      if (li != null) svg.append(mk("circle", { cx: X(li), cy: Y(s.pts[li].v), r: 3, fill: s.color }));
    }
    const leg = el("div", "sr-leg");
    for (const s of series) { const last = [...s.pts].reverse().find(p => p.v != null); const i = el("span"); i.style.setProperty("--c", s.color); i.append(el("i"), `${s.name} ${last ? man(last.v) : "–"}${unit === "만" ? "" : unit}`); leg.append(i); }
    wrap.append(svg, leg);
    return wrap;
  }

  globalThis.RESEARCH = { find, canon, draw, report: () => hostEl && report(hostEl.querySelector(".sr-rep")) };

  const css = document.createElement("style");
  css.textContent = `
.sr-wait { padding: 10px 14px; color: var(--muted); font-size: 13px; }
.sr-box { position: relative; }
.sr-in { width: 100%; box-sizing: border-box; background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font: inherit; font-size: 15px; }
.sr-list { display: grid; gap: 2px; max-height: none; }
.sr-h { font-size: 12px; font-weight: 800; color: var(--muted); margin: 8px 2px 2px; }
.sr-row .rfn-nm { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; } .sr-row .rfn-nm small { color: var(--muted); font-size: 11.5px; }
.sr-ic { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 5px; font-size: 11px; font-weight: 800; background: color-mix(in srgb, var(--accent, #6366f1) 25%, transparent); }
.sr-rep { display: grid; gap: 10px; }
.sr-head { display: grid; gap: 6px; } .sr-ttl { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 16px; } .sr-ttl small { color: var(--muted); font-size: 12px; }
.sr-acts { display: flex; flex-wrap: wrap; gap: 4px; }
.sr-act { font: inherit; font-size: 12px; padding: 4px 9px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--text); cursor: pointer; }
.sr-act:hover { border-color: var(--accent, #6366f1); }
.sr-big { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
.sr-price { --gold: #eab308; --gold-ink: #facc15; --jc: #2dd4bf; border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--line)); border-radius: 12px; padding: 10px 12px; background: color-mix(in srgb, var(--gold) 5%, transparent); }
html[data-theme=light] .sr-price { --gold: #ca8a04; --gold-ink: #a16207; --jc: #0f766e; }
.sr-size { font-size: 13.5px; margin: 2px 0 6px; } .sr-size b { color: var(--text); } .sr-size small { color: var(--muted); font-size: 11.5px; }
.sr-price > .rfn-h { font-size: 16px; font-weight: 800; color: var(--gold-ink); }
.sr-price .rfn-kpi.sr-hero { background: color-mix(in srgb, var(--gold) 9%, transparent); border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); }
.sr-price .rfn-kpi.sr-hero b { font-size: 28px; color: var(--gold-ink); }
.sr-price .rfn-kpi.sr-hero-j { background: color-mix(in srgb, var(--jc) 9%, transparent); border-color: color-mix(in srgb, var(--jc) 45%, var(--line)); }
.sr-price .rfn-kpi.sr-hero-j b { color: var(--jc); }
.sr-price .rfn-kpi.sr-hero small:first-child { color: var(--text); font-weight: 700; }
@media (max-width: 420px) { .sr-price .rfn-kpi.sr-hero b { font-size: 24px; } }
.sr-big .rfn-kpi.bad b { color: #ef4444; } .sr-big .rfn-kpi.warn b { color: #f59e0b; }
.sr-line { font-size: 13px; line-height: 1.45; } .sr-line small { color: var(--muted); } .sr-li { margin-right: 4px; }
.sr-why { margin: 0 0 0 22px; font-size: 12.5px; line-height: 1.45; } .sr-why.muted, .sr-news .muted { color: var(--muted); }
.sr-news { margin: 2px 0 4px 22px; padding: 0; list-style: none; display: grid; gap: 3px; font-size: 12.5px; } .sr-news small { color: var(--muted); } .sr-news a { color: var(--text); }
.sr-spark svg { width: 100%; height: auto; display: block; } .sr-spark .sr-grid { stroke: var(--line); stroke-width: 1; } .sr-spark .sr-ax { fill: var(--muted); font-size: 10px; }
.sr-leg { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--muted); } .sr-leg i { display: inline-block; width: 12px; height: 3px; border-radius: 2px; background: var(--c); margin-right: 4px; vertical-align: middle; }`;
  document.head.append(css);
})();
