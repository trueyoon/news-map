// 📣 [호재뉴스] 탭 (사용자 2026-11-27 "부동산 소식을 세계 뉴스와 우리나라 소식을 토대로 정리해서, 앞으로 개발이나 집값이 오를 지역의 호재인 곳들을 카드 뉴스처럼")
// - re-impact.js 가 re-rank.js 다음에 불러옴(real-estate.html 수정 없음, SQL 없음 — 이미 있는 표만 읽음). 탭 버튼·칸을 이 파일이 만들고 showTab 을 감쌈(기억 reGoodTab·reGoodDays)
// - 카드 뉴스 모양(초록 모눈 바탕 + 흰 카드 + 왼쪽 노란 띠 + 번호 별 배지 + 노란 화살표 단추), 맨 앞은 표지 카드
// - 자료
//   ① 우리 지역 호재: re_news_days(최근 7·30일) 중 주제 교통(transit)·개발(develop)·재건축·재개발(redevelop)·공급(supply), 시·구/시 단위만(서울·경기·전국 전체 소식 빼고)
//      대표 제목(top)마다 좋은 쪽 움직임 낱말(GOOD: 착공·개통·연장·선정·승인·지정·협약·시공사 등)이 있고 나쁜 낱말(BAD: 사고·지연·무산·급랭·점검·재초환…)이 없는 것만 셈
//      — 주제 분류만 믿으면 "신분당선 승강장서 쓰러진…" 같은 기사도 교통으로 들어와서
//      점수 = 호재 제목 수(최근 7일은 1.5배) → 많은 순 8곳. 카드에 주제별 수·대표 제목·1년 아파트값 변화(RECOLOR price)·권역 AI 예측(REIMPTAB)
//   ② 세계 소식 → 우리 지역: etf_theme_days 의 반도체·AI 기사 수(최근 7일 vs 그 전 4주 평균) + 그 산업 단지가 있는 곳(고정 목록 CLUSTERS)
//   ③ 나라 전체 호재: 서울·경기·전국 단위 호재 제목
// - 카드의 → 를 누르면 자세히(모든 호재 제목·숫자·[🔎 통계·영향][🗺 지도]). 투자 권유 아님 — "호재 소식이 몰린 곳"이지 오른다는 보장이 아님
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined" || typeof showTab !== "function") return;
  const DAY = 864e5;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 기억 없음 */ } },
  };
  const kstDay = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
  const md = s => String(s || "").slice(5, 10).replace("-", "/");
  const pc = v => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`);
  const THEME = { transit: "교통", develop: "개발·산업", redevelop: "재건축·재개발", supply: "공급·분양" };
  const ICON = { transit: "🚇", develop: "🏗️", redevelop: "🏢", supply: "🏘️" };
  const BROAD = new Set(["00000", "11000", "41000", "90000"]);
  // 호재 낱말 / 빼는 낱말 (제목 기준)
  // 호재 = 좋은 쪽 움직임 낱말(착공·개통·선정·승인 등)이 있어야 함 — 주제 낱말(재건축·GTX)만으로는 안 됨("재건축 급랭" 같은 제목이 섞여서, 2026-11-27 미리보기로 확인)
  const GOOD = /개통|착공|첫삽|첫 삽|확정|승인|인가|지정|선정|유치|통과|신설|연장|조성|본격|탄력|속도|도입|협약|MOU|시공계약|시공사|분양 돌입|분양 개시|입주 시작|준공|투자 유치|대규모 투자|확충|완화|해제|청사진|마스터플랜|급행|복합개발|첫발|가시화|박차|확대|개발 계획|계획 발표|사업 추진|추진 본격|기공|예타 면제|예타 통과/;
  const BAD = /쓰러|사고|숨져|숨진|사망|부상|화재|폭행|범죄|추락|붕괴|지연|무산|취소|반대|중단|좌초|보류|철회|갈등|민원|부실|하락|미분양|소송|비리|압수수색|의혹|논란|우려|불발|발목|난항|표류|연기|실패|피해|침수|누수|소음|악취|게시판|부고|인사\]|급랭|안 팔|침체|위축|급락|규제 강화|점검|단속|부담|불안|경고|폭탄|재초환|과열|투기|집회|시위|하자|분쟁|적발|횡령/;
  const goodTitle = t => !!t && GOOD.test(t) && !BAD.test(t);
  // 세계 소식 → 산업 단지가 있는 곳(알려진 위치, 고정 목록)
  const CLUSTERS = [
    { theme: "semis", icon: "💾", label: "반도체", where: "삼성전자·SK하이닉스 반도체 단지", names: ["용인시 처인구", "용인시 기흥구", "평택시", "이천시"] },
    { theme: "ai", icon: "🤖", label: "AI·빅테크", alsoThemes: ["bigtech"], where: "판교 테크노밸리(IT·AI 기업)", names: ["성남시 분당구"] },
  ];
  const codesByName = n => Object.entries(SGG).filter(([, v]) => v.name === n).map(([c]) => c);
  const codesOfKey = k => (SGG[k] ? [k] : Object.keys(SGG).filter(c => c.startsWith(k.slice(0, 4))));
  const nameOfKey = k => {
    if (SGG[k]) return `${SGG[k].sido === "서울" ? "서울 " : ""}${SGG[k].name}`;
    if (k === "11000") return "서울 전체"; if (k === "41000") return "경기 전체"; if (k === "00000") return "전국"; if (k === "90000") return "지방";
    const c = codesOfKey(k)[0];
    return c ? SGG[c].name.split(" ")[0] : k;
  };
  let days = store.get("reGoodDays", 30); if (![7, 30].includes(days)) days = 30;

  // ── 탭·칸 ──
  const tabs = document.querySelector(".side-tabs");
  const anchor = document.getElementById("pane-rank") || document.getElementById("pane-homecmp") || document.getElementById("pane-stats");
  if (!tabs || !anchor) return;
  const btn = el("button", null, "호재뉴스"); btn.type = "button"; btn.setAttribute("role", "tab"); btn.dataset.tab = "good";
  tabs.append(btn);
  const pane = el("section", "pane gn"); pane.id = "pane-good"; pane.setAttribute("role", "tabpanel"); pane.hidden = true;
  anchor.after(pane);
  let active = false;
  const prevShow = showTab;
  // eslint-disable-next-line no-global-assign
  showTab = function (name, ...rest) {
    if (name === "good") {
      const r = prevShow.call(this, name, ...rest);
      active = true; pane.hidden = false;
      for (const b of document.querySelectorAll(".side-tabs button")) b.setAttribute("aria-selected", String(b.dataset.tab === "good"));
      store.set("reGoodTab", 1);
      render();
      return r;
    }
    if (name !== "detail" || active) { active = false; pane.hidden = true; }
    if (name !== "detail") { try { localStorage.removeItem("reGoodTab"); } catch { /* 기억 없음 */ } }
    return prevShow.call(this, name, ...rest);
  };
  btn.addEventListener("click", () => showTab("good"));

  // ── 자료 ──
  let cache = null, cacheAt = 0;
  async function load() {
    if (cache && Date.now() - cacheAt < 30 * 60e3) return cache;
    const from = kstDay(Date.now() - 30 * DAY);
    const nd = [];
    for (let off = 0; off < 6000; off += 1000) {
      const r = await db.from("re_news_days").select("day,region,theme,n,top").gte("day", from).in("theme", Object.keys(THEME)).order("day", { ascending: false }).range(off, off + 999);
      if (r.error) throw r.error;
      nd.push(...(r.data || []));
      if (!r.data || r.data.length < 1000) break;
    }
    const themeIds = [...new Set(CLUSTERS.flatMap(c => [c.theme, ...(c.alsoThemes || [])]))];
    const et = await db.from("etf_theme_days").select("day,theme,n").in("theme", themeIds).gte("day", kstDay(Date.now() - 36 * DAY)).then(r => r.data || [], () => []);
    const [price, imp] = await Promise.all([
      globalThis.RECOLOR?.values ? RECOLOR.values("price", "apt", { budget: 0 }).catch(() => null) : null,
      globalThis.REIMPTAB?.load ? REIMPTAB.load().catch(() => null) : null,
    ]);
    cache = { nd, et, price: price?.map || new Map(), fc: imp?.ai?.fc || {}, fcDay: imp?.ai?.note?.day || null };
    cacheAt = Date.now();
    return cache;
  }
  /** 지역(시·구/시 열쇠)별 호재 묶음 */
  function regions(D) {
    const since = kstDay(Date.now() - days * DAY), recent = kstDay(Date.now() - 7 * DAY);
    const by = new Map();
    for (const r of D.nd) {
      if (r.day < since) continue;
      const k = r.region;
      const g = by.get(k) || by.set(k, { key: k, score: 0, counts: {}, items: [], seen: new Set() }).get(k);
      for (const t of r.top || []) {
        if (!t?.u || g.seen.has(t.u) || !goodTitle(t.t)) continue;
        g.seen.add(t.u);
        g.items.push({ ...t, day: r.day, theme: r.theme });
        g.counts[r.theme] = (g.counts[r.theme] || 0) + 1;
        g.score += r.day >= recent ? 1.5 : 1;
      }
    }
    return [...by.values()].filter(g => g.items.length).map(g => ({ ...g, items: g.items.sort((a, b) => (a.day < b.day ? 1 : -1)) }));
  }
  /** 시·구 열쇠의 1년 아파트값 변화(시 열쇠면 구들의 거래 수 가중) */
  function yoyOf(D, key) {
    let s = 0, n = 0;
    for (const c of codesOfKey(key)) { const v = D.price.get(c); if (v && Number.isFinite(v.v) && v.n) { s += v.v * v.n; n += v.n; } }
    return n ? { v: s / n, n } : null;
  }
  function fcOf(D, key) {
    const z = globalThis.RESIG?.zoneOf?.(key) || globalThis.RESIG?.zoneOf?.(codesOfKey(key)[0]);
    const f = z && D.fc[z.id];
    return f ? { zone: z.name, call: f.call, prob: f.prob } : null;
  }
  function world(D) {
    const t7 = kstDay(Date.now() - 7 * DAY), t35 = kstDay(Date.now() - 35 * DAY);
    return CLUSTERS.map(c => {
      const ids = new Set([c.theme, ...(c.alsoThemes || [])]);
      let now = 0, before = 0; const bd = new Set();
      for (const r of D.et) { if (!ids.has(r.theme)) continue; if (r.day >= t7) now += r.n; else if (r.day >= t35) { before += r.n; bd.add(r.day); } }
      const avg = bd.size >= 14 ? (before / bd.size) * 7 : 0;   // 그 전 기록이 2주 넘게 있을 때만 "평소의 N배"(기록은 2026-11-11부터)
      const codes = c.names.flatMap(codesByName);
      return { ...c, now, ratio: avg ? now / avg : null, codes };
    }).filter(c => c.now > 0 && c.codes.length);
  }

  // ── 그리기 ──
  const STAR = (() => { const pts = []; const N = 14; for (let i = 0; i < N * 2; i++) { const a = (Math.PI * i) / N - Math.PI / 2, r = i % 2 ? 38 : 50; pts.push(`${(50 + r * Math.cos(a)).toFixed(1)}% ${(50 + r * Math.sin(a)).toFixed(1)}%`); } return `polygon(${pts.join(",")})`; })();
  function badge(n) { const b = el("div", "gn-badge"); const i = el("div", "gn-badge-in", String(n).padStart(2, "0")); b.append(i); b.style.clipPath = STAR; i.style.clipPath = STAR; return b; }
  function card({ n, icon, title, desc, foot, onOpen, cover }) {
    const c = el("article", `gn-card${cover ? " cover" : ""}`);
    const inner = el("div", "gn-inner");
    if (!cover) inner.append(el("div", "gn-bar"));
    if (n != null) c.append(badge(n));
    const h = el("h3", "gn-title"); if (title instanceof Node) h.append(title); else h.textContent = title;
    inner.append(el("div", "gn-icon", icon), h);
    if (desc) { const d = el("p", "gn-desc"); if (desc instanceof Node) d.append(desc); else d.textContent = desc; inner.append(d); }
    if (foot) inner.append(el("div", "gn-foot", foot));
    if (onOpen) {
      const a = el("button", cover ? "gn-more" : "gn-arrow", cover ? "자세히 알아보기 >" : "➜"); a.type = "button"; a.title = "자세히 보기";
      a.addEventListener("click", onOpen);
      inner.append(a);
    }
    c.append(inner);
    return c;
  }
  let seq = 0;
  async function render() {
    if (!active) return;
    const my = ++seq;
    const top = el("div", "gn-top");
    const per = el("div", "gn-chips");
    for (const d of [7, 30]) { const b = el("button", d === days ? "on" : null, `최근 ${d}일`); b.type = "button"; b.addEventListener("click", () => { days = d; store.set("reGoodDays", d); render(); }); per.append(b); }
    top.append(el("b", null, "📣 호재 뉴스"), per);
    pane.replaceChildren(top, el("p", "gn-note", "불러오는 중…"));
    let D;
    try { D = await load(); } catch (e) { if (my === seq) pane.replaceChildren(top, el("p", "gn-note", `불러오지 못했어요: ${e.message || e}`)); return; }
    if (my !== seq) return;
    const regs = regions(D);
    const local = regs.filter(g => !BROAD.has(g.key)).sort((a, b) => b.score - a.score).slice(0, 8);
    const broad = regs.filter(g => BROAD.has(g.key) && g.key !== "90000");
    const W = world(D);
    const grid = el("div", "gn-grid");
    const total = local.reduce((a, g) => a + g.items.length, 0);
    const coverT = document.createDocumentFragment();
    coverT.append(el("small", null, `이번 ${days === 7 ? "주" : "달"} 부동산 소식이라면 꼭!`), el("span", null, "지금 뜨는 호재 지역"));
    grid.append(card({ cover: true, icon: "😊", title: coverT, desc: `세계 뉴스와 우리나라 소식으로 서울·경기 호재 ${local.length}곳을 골랐어요 (호재 제목 ${total}건)`, onOpen: () => local[0] && openDetail(D, local[0]) }));
    let n = 1;
    for (const w of W) {
      const rows = w.codes.map(c => { const y = yoyOf(D, c); const loc = regs.find(g => g.key === c || g.key === `${c.slice(0, 4)}0`); return `${nameOfKey(c)} ${y ? pc(y.v) : "–"}${loc ? ` · ${loc.key === c ? "" : `${nameOfKey(loc.key)} 전체 `}호재 ${loc.items.length}건` : ""}`; });
      grid.append(card({
        n: n++, icon: w.icon, title: `세계가 주목: ${w.label}`,
        desc: `최근 7일 ${w.label} 기사 ${w.now.toLocaleString()}건${w.ratio ? ` (평소의 ${w.ratio.toFixed(1)}배)` : ""} → ${w.where} 주변`,
        foot: rows.slice(0, 4).join("\n"),
        onOpen: () => openWorld(D, w, regs),
      }));
    }
    for (const g of local) {
      const main = Object.entries(g.counts).sort((a, b) => b[1] - a[1])[0][0];
      const y = yoyOf(D, g.key), f = fcOf(D, g.key);
      const desc = el("span");
      desc.append(el("span", "gn-head", g.items[0].t));
      grid.append(card({
        n: n++, icon: ICON[main], title: `${nameOfKey(g.key)} · ${THEME[main]} 호재`,
        desc,
        foot: [Object.entries(g.counts).map(([k, v]) => `${THEME[k]} ${v}`).join(" · "), `1년 아파트값 ${y ? pc(y.v) : "–"}${f ? ` · ${f.zone} AI ${f.call === "up" ? "▲" : "▼"}${f.prob}%` : ""}`].join("\n"),
        onOpen: () => openDetail(D, g),
      }));
    }
    if (broad.length) {
      const items = broad.flatMap(g => g.items.map(x => ({ ...x, key: g.key }))).sort((a, b) => (a.day < b.day ? 1 : -1));
      grid.append(card({ n: n++, icon: "🇰🇷", title: "나라·서울·경기 전체 호재", desc: el("span", "gn-head", items[0].t), foot: `${items.length}건 · ${[...new Set(items.map(x => nameOfKey(x.key)))].join("·")}`, onOpen: () => openDetail(D, { key: "broad", items, counts: {} }) }));
    }
    if (!local.length && !W.length) grid.append(el("p", "gn-note", "아직 모인 호재 소식이 없어요."));
    const detail = el("div", "gn-detail"); detail.id = "gnDetail"; detail.hidden = true;
    pane.replaceChildren(top, grid, detail,
      el("p", "gn-note", `호재 = 최근 ${days}일 그 지역 부동산 소식 중 교통·개발·재건축·공급 주제이면서 제목에 좋은 쪽 움직임 낱말(착공·개통·연장·선정·승인·지정·협약 등)이 있고 사고·지연·무산·급랭·점검 같은 말이 없는 것. 세계 소식은 반도체·AI 기사 수와 그 산업 단지가 있는 곳(고정 목록). 1년 아파트값 = 시·구 ㎡당 중간값의 최근 3달 vs 1년 전.`),
      el("p", "gn-warn", "⚠ 호재 소식이 몰린 곳을 모은 것이지 집값이 오른다는 보장이 아니에요. 소식이 이미 값에 반영됐거나 계획이 바뀔 수도 있어요. 투자 권유가 아니에요."));
  }
  function goFind(key) { const c = codesOfKey(key)[0]; if (c && globalThis.REFRONT?.open) REFRONT.open("find", { t: "sgg", code: c }); }
  function goMap(key) {
    try {
      const codes = codesOfKey(key);
      if (codes.length === 1 && typeof pickSgg === "function") { showTab("list"); pickSgg("list", codes[0]); return; }
      showTab("list");
      const set = new Set(codes), pts = (typeof dongs !== "undefined" ? dongs : []).filter(d => set.has(d.sgg_cd));
      if (pts.length && typeof map !== "undefined" && map) { const b = new maplibregl.LngLatBounds(); pts.forEach(d => b.extend([d.x, d.y])); map.fitBounds(b, { padding: 40, maxZoom: 12, duration: 900 }); }
    } catch (e) { console.warn("re-good", e); }
  }
  function showDetail(head, body) {
    const box = document.getElementById("gnDetail");
    if (!box) return;
    const x = el("button", "gn-x", "✕ 닫기"); x.type = "button"; x.addEventListener("click", () => { box.hidden = true; });
    const h = el("div", "gn-dh"); h.append(head, x);
    box.replaceChildren(h, ...body);
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function newsList(items) {
    const ul = el("ul", "gn-list");
    for (const t of items.slice(0, 40)) {
      const li = el("li"), a = el("a", null, t.t); a.href = t.u; a.target = "_blank"; a.rel = "noopener noreferrer";
      li.append(el("small", null, `${md(t.day)} ${THEME[t.theme] || ""}${t.key ? ` · ${nameOfKey(t.key)}` : ""}`), a, t.s ? el("small", "gn-src", ` ${t.s}`) : "");
      ul.append(li);
    }
    return ul;
  }
  function openDetail(D, g) {
    const body = [];
    if (g.key !== "broad") {
      const y = yoyOf(D, g.key), f = fcOf(D, g.key);
      const st = el("div", "gn-stats");
      st.append(el("span", null, `호재 소식 ${g.items.length}건 (${Object.entries(g.counts).map(([k, v]) => `${THEME[k]} ${v}`).join(" · ")})`),
        el("span", null, `1년 아파트값 ${y ? pc(y.v) : "–"}`),
        f ? el("span", null, `${f.zone} AI 예측(3달): ${f.call === "up" ? "▲ 상승" : "▼ 하락"} ${f.prob}%${D.fcDay ? ` · ${md(D.fcDay)}` : ""}`) : "");
      const acts = el("div", "gn-acts");
      const a1 = el("button", null, "🔎 매매·전세·월세 통계·영향 보기"); a1.type = "button"; a1.addEventListener("click", () => goFind(g.key));
      const a2 = el("button", null, "🗺 지도에서 보기"); a2.type = "button"; a2.addEventListener("click", () => goMap(g.key));
      acts.append(a1, a2);
      body.push(st, acts);
    }
    body.push(newsList(g.items));
    showDetail(el("b", null, g.key === "broad" ? "🇰🇷 나라·서울·경기 전체 호재" : `${ICON[Object.entries(g.counts).sort((a, b) => b[1] - a[1])[0]?.[0]] || "📍"} ${nameOfKey(g.key)} 호재 소식`), body);
  }
  function openWorld(D, w, regs) {
    const body = [el("p", "gn-desc2", `최근 7일 세계·국내 뉴스의 ${w.label} 기사 ${w.now.toLocaleString()}건${w.ratio ? ` — 그 전 4주 평균의 ${w.ratio.toFixed(1)}배` : ""}. 산업이 커지면 ${w.where} 주변의 일자리·수요가 늘 수 있어요(반대로 업황이 꺾이면 반대).`)];
    const box = el("div", "gn-wlist");
    for (const c of w.codes) {
      const y = yoyOf(D, c), loc = regs.find(g => g.key === c || g.key === `${c.slice(0, 4)}0`);
      const row = el("div", "gn-wrow");
      row.append(el("b", null, nameOfKey(c)), el("span", null, `1년 아파트값 ${y ? pc(y.v) : "–"} · 최근 ${days}일 ${loc && loc.key !== c ? `${nameOfKey(loc.key)} 전체 ` : ""}호재 ${loc ? loc.items.length : 0}건`));
      const a1 = el("button", null, "🔎 통계·영향"); a1.type = "button"; a1.addEventListener("click", () => goFind(c));
      const a2 = el("button", null, "🗺 지도"); a2.type = "button"; a2.addEventListener("click", () => goMap(c));
      row.append(a1, a2);
      box.append(row);
      if (loc) box.append(newsList(loc.items.slice(0, 3)));
    }
    body.push(box);
    showDetail(el("b", null, `${w.icon} 세계가 주목: ${w.label} → ${w.where}`), body);
  }

  globalThis.REGOOD = { render, load, goodTitle };
  if (store.get("reGoodTab", 0)) setTimeout(() => showTab("good"), 0);

  const css = document.createElement("style");
  css.textContent = `
#pane-good { padding: 12px; display: grid; gap: 12px; align-content: start; overflow-y: auto; }
.gn-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; } .gn-top > b { font-size: 17px; }
.gn-chips { display: flex; gap: 4px; } .gn-chips button { font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; }
.gn-chips button.on { color: var(--text); font-weight: 800; border-color: #f5b800; background: color-mix(in srgb, #f5b800 18%, transparent); }
.gn-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; }
.gn-card { position: relative; aspect-ratio: 1 / 1; min-height: 250px; padding: 18px; box-sizing: border-box; border-radius: 6px;
  background-color: #12873b; background-image: linear-gradient(rgba(0,0,0,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.22) 1px, transparent 1px); background-size: 11px 11px;
  box-shadow: 0 3px 10px rgba(0,0,0,.25); color: #111; }
.gn-inner { position: relative; height: 100%; box-sizing: border-box; background: #fbfbf7; padding: 16px 16px 14px 26px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; overflow: hidden; }
.gn-card.cover .gn-inner { padding: 18px 16px; justify-content: center; }
.gn-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 12px; background: #f5b800; }
.gn-badge { position: absolute; top: -8px; right: -8px; width: 62px; height: 62px; background: #111; z-index: 2; display: grid; place-items: center; }
.gn-badge-in { width: 56px; height: 56px; background: #f5b800; display: grid; place-items: center; font: 900 17px/1 system-ui, sans-serif; color: #111; }
.gn-icon { font-size: 34px; line-height: 1; margin-top: 4px; }
.gn-card.cover .gn-icon { position: absolute; top: -26px; left: 50%; transform: translateX(-50%); width: 54px; height: 54px; border-radius: 50%; background: #f5c518; border: 2px solid #111; display: grid; place-items: center; font-size: 34px; }
.gn-card.cover { overflow: visible; } .gn-card.cover .gn-inner { overflow: visible; }
.gn-title { margin: 2px 0 0; font-size: 17px; font-weight: 900; line-height: 1.3; color: #111; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gn-card.cover .gn-title { display: grid; gap: 4px; -webkit-line-clamp: unset; } .gn-card.cover .gn-title small { font-size: 14px; font-weight: 600; color: #333; } .gn-card.cover .gn-title span { font-size: 22px; }
.gn-desc { margin: 0; font-size: 12px; line-height: 1.5; color: #555; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.gn-head { color: #333; }
.gn-foot { margin-top: auto; font-size: 11.5px; line-height: 1.45; color: #12873b; font-weight: 700; white-space: pre-line; align-self: stretch; text-align: left; padding-right: 40px; }
.gn-arrow { position: absolute; right: 12px; bottom: 12px; width: 34px; height: 26px; border: 0; border-radius: 3px; background: #f5b800; color: #111; font-size: 15px; font-weight: 900; cursor: pointer; }
.gn-arrow:hover, .gn-more:hover { filter: brightness(1.08); }
.gn-more { margin-top: 10px; border: 1px solid #111; border-radius: 3px; background: #f5b800; color: #111; font: 800 12.5px/1 system-ui, sans-serif; padding: 7px 14px; cursor: pointer; }
.gn-detail { border: 2px solid #12873b; border-radius: 10px; padding: 12px 14px; display: grid; gap: 8px; background: var(--panel); }
.gn-dh { display: flex; align-items: center; justify-content: space-between; gap: 8px; } .gn-dh b { font-size: 16px; }
.gn-x { font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--text); cursor: pointer; }
.gn-stats { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; font-weight: 700; }
.gn-acts { display: flex; flex-wrap: wrap; gap: 6px; } .gn-acts button, .gn-wrow button { font: inherit; font-size: 12px; padding: 4px 10px; border-radius: 8px; border: 1px solid #f5b800; background: color-mix(in srgb, #f5b800 14%, transparent); color: var(--text); cursor: pointer; }
.gn-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; font-size: 13px; } .gn-list small { color: var(--muted); margin-right: 6px; } .gn-list a { color: var(--text); } .gn-src { color: var(--muted); }
.gn-desc2 { margin: 0; font-size: 13px; line-height: 1.5; }
.gn-wlist { display: grid; gap: 6px; } .gn-wrow { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: 13px; }
.gn-note { margin: 0; font-size: 11.5px; color: var(--muted); line-height: 1.5; } .gn-warn { margin: 0; font-size: 12px; color: #f59e0b; font-weight: 700; }
@media (max-width: 600px) { .gn-grid { grid-template-columns: 1fr 1fr; gap: 10px; } .gn-card { padding: 10px; min-height: 0; } .gn-inner { padding: 10px 8px 10px 16px; } .gn-bar { width: 8px; } .gn-title { font-size: 14px; } .gn-badge { width: 46px; height: 46px; } .gn-badge-in { width: 41px; height: 41px; font-size: 13px; } .gn-icon { font-size: 26px; } .gn-desc { -webkit-line-clamp: 3; } .gn-foot { font-size: 10.5px; } }`;
  document.head.append(css);
})();
