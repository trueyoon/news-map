// 뉴스 목록 정렬 고르기 (2026-11-18 사용자 요청). 옆 칸 뉴스 목록 위 [최신순 | 많이 보도된 순 | 출처 중요도순 | 분야별].
// - 최신순: 예전 그대로(발행 시각, 최신이 위).
// - 많이 보도된 순: 같은 사건 기사끼리 묶어(제목 낱말이 여러 개 겹치고 36시간 안) 보도한 곳 수가 많은 묶음부터, 묶음 안은 최신순. 묶음 머리에 "N곳 보도".
//   계산량 때문에 목록의 최신 4,000건 안에서만 묶고 나머지는 뒤에 최신순.
// - 출처 중요도순: 공식 발표(DART 공시 빼고) → 통신사 → 언론 → DART 공시 → 미확인, 같은 칸 안은 최신순.
// - 분야별: 정치 → 경제 → 외교 → 분쟁 → 재난 → 기타, 분야마다 머리글. 출처·분야는 칸마다 최신 몇 건씩(목록이 120건만 그려서 첫 칸이 다 차지하지 않게).
// - 분야 고르기(사용자 요청 2026-11-18): 정렬 줄 아래에 정치·경제·외교·분쟁·재난·기타 버튼(여러 개 고를 수 있음, 처음엔 [분야별]일 때만 보였다가 늘 보이게 바꿈).
//   고른 분야만 목록에 남고, 다른 정렬(최신순·많이 보도된 순·출처 중요도순)로 바꿔도 그대로 적용. 아무것도 안 고르면 예전처럼 전부.
//   목록에만 적용(지도는 아래 범례 버튼이 따로 정함). 고른 것은 브라우저가 기억(listCats).
// - 2026-11-18 사용자 요청: 분야 줄을 늘 보이게(정렬과 상관없이) + 그 아래 "지역" 줄(시 단위, 지금 목록에 많이 나온 곳 12개 + 고른 곳).
//   지역도 여러 개 고를 수 있고 안 고르면 전부. 지역 이름은 location_name 첫 낱말("서울 여의도"→서울, "Washington, …"→Washington), 나라 이름만 있는 글은 지역 없음.
// - 2026-11-18 사용자 요청 "뉴스 목록이 너무 밑에 있음": 정렬·분야·지역 세 줄을 한 줄 버튼 [정렬: 최신순 ▾] [분야: 전체 ▾] [지역: 전체 ▾] 로 접음.
//   누르면 그 줄이 목록 위에 겹쳐 펼쳐짐(목록은 안 밀림). 정렬은 고르면 닫힘, 분야·지역은 여러 개 고르는 동안 열려 있음. 바깥을 누르거나 Esc 로 닫힘.
// index.html 의 renderList() 를 감싸서 순서만 바꿈(목록 모양·필터·지역·"이 지역 소식"은 그대로). 고른 것은 브라우저가 기억(listSort).
// 낱말 나누기는 hot-news.js 의 HOT.words 를 씀(없으면 간단히 띄어쓰기로). Node 에서 시험할 때는 LSORT.groups 만 씀.
(function (g) {
  const H = 3600e3;
  const simpleWords = t => new Map((String(t).toLowerCase().match(/[가-힣]{2,}|[a-z][a-z'-]{2,}/g) || []).map(w => [w, w]));
  // 같은 사건으로 묶을 때 안 세는 흔한 말(지역 보도자료의 행사 낱말 — "모집", "김장 나눔", "겨울철 대비"가 서로 다른 시청 글을 한 사건으로 묶었음, 2026-11-18 실제 자료)
  const GENERIC = new Set(("모집 공고 실시 나눔 이웃사랑 이웃 사랑 실천 성과 공유 대비 추진 개최 선정 수상 운영 지원 참여 행사 전달 기탁 협약 교육 사업 계획 활동 봉사 김장 김장김치 캠페인 점검 "
    + "강화 마련 홍보 안내 공모 접수 신청 겨울철 한파 대설 폭설 취약계층 주민 새마을 부녀회 새마을회 자원봉사 기부 후원 장학금 위촉 간담회 설명회 워크숍 업무협약 일자리 "
    + "참여자 주민자치 위원 모집공고 장관상 표창 대상 어워드 연속 소통 현장 방문 의견 청취 vs versus stock stocks shares better buy").split(" "));
  // 지방 시·도청·시청 보도자료(출처 이름이 한글인 공식 발표, 중앙 부처 빼고)와 DART 공시는 "보도한 곳"으로 세지 않음(곳마다 따로 내는 글이라)
  const CENTRAL = new Set(["외교부", "행정안전부", "재정경제부"]);
  const isLocal = it => it.source_name === "DART 공시" || (it.source_type === "official" && /[가-힣]/.test(it.source_name || "") && !CENTRAL.has(it.source_name));
  // items(최신순) → [{items, srcs, last}] 묶음들(많이 보도된 순)
  // 묶음의 처음 3개 기사하고만 비교(사슬처럼 번지는 것 막기 — "NVIDIA" 와 "J&J vs Vertex" 가 한 묶음이 됐었음)
  function groups(list, opt = {}) {
    const words = opt.words || g.HOT?.words || simpleWords, MAXN = opt.max || 4000;
    const head = list.slice(0, MAXN), rest = list.slice(MAXN);
    const raw = head.map(it => [...words(it.title || "").keys()].filter(k => !GENERIC.has(k)));
    const df = new Map();
    for (const ts of raw) for (const k of ts) df.set(k, (df.get(k) || 0) + 1);
    const common = Math.max(30, head.length * 0.03);            // 너무 흔한 낱말(트럼프·AI 등)만으로는 같은 사건으로 안 봄
    const toks = raw.map(ts => ts.filter(k => df.get(k) <= common));
    const grs = [], idx = new Map();                             // idx: 낱말 → 그 낱말이 처음 3개 기사에 든 묶음 번호들
    head.forEach((it, i) => {
      const mine = toks[i];
      let home = null;
      if (mine.length >= 2) {
        const cnt = new Map();
        for (const k of mine) for (const gi of idx.get(k) || []) cnt.set(gi, (cnt.get(gi) || 0) + 1);
        for (const [gi, c] of [...cnt].sort((a, b) => b[1] - a[1])) {
          const gr = grs[gi];
          if (Math.abs(gr.seedT - it._t) > 36 * H) continue;
          // 겹치는 낱말 2개 이상 + 짧은 쪽 제목 낱말의 절반 이상 — 묶음 처음 3개 중 하나와
          if (c >= 2 && gr.seeds.some(s => { const n = s.filter(k => mine.includes(k)).length; return n >= 2 && n >= Math.ceil(0.5 * Math.min(mine.length, s.length)); })) { home = gr; break; }
        }
      }
      if (!home) { home = { items: [], seeds: [], seedT: it._t }; grs.push(home); }
      home.items.push(it);
      if (home.seeds.length < 3) { home.seeds.push(mine); const gi = grs.indexOf(home); for (const k of mine) { const a = idx.get(k) || idx.set(k, []).get(k); if (!a.includes(gi)) a.push(gi); } }
    });
    const out = grs.map(gr => {
      const named = new Set(gr.items.filter(it => !isLocal(it)).map(it => it.source_name));
      return { items: gr.items, srcs: named.size || 1, last: gr.items[0]._t };
    });
    out.sort((a, b) => b.srcs - a.srcs || b.items.length - a.items.length || b.last - a.last);
    for (const it of rest) out.push({ items: [it], srcs: 1, last: it._t, tail: true });
    return out;
  }
  const SRC_RANK = it => (it.source_name === "DART 공시" ? 3 : { official: 0, wire: 1, media: 2 }[it.source_type] ?? 4);
  g.LSORT = { groups, SRC_RANK };

  if (typeof document === "undefined" || typeof renderList !== "function" || typeof el !== "function") return;   // Node 시험이거나 화면이 바뀌었으면 여기까지

  const TX = {
    ko: { more2: n => ` 외 ${n}`, cityLbl: "지역", catsLbl: "분야", catsAll: "전체", catsClear: "분야 거르기 끄기", ofN: (n, k) => (n > k ? `${n.toLocaleString()}건 중 최신 ${k}건` : `${n.toLocaleString()}건`), label: "정렬", time: "최신순", hot: "많이 보도된 순", src: "출처 중요도순", cat: "분야별", grp: (s, n) => `📰 ${s}곳 보도 · 기사 ${n}건`, rest: "그 밖의 기사 (최신순)",
      srcHead: ["공식 발표", "통신사", "언론", "DART 공시", "미확인"] },
    en: { more2: n => ` +${n}`, cityLbl: "Area", catsLbl: "Topics", catsAll: "All", catsClear: "Clear topic filter", ofN: (n, k) => (n > k ? `newest ${k} of ${n.toLocaleString()}` : `${n.toLocaleString()}`), label: "Sort", time: "Newest", hot: "Most covered", src: "By source", cat: "By topic", grp: (s, n) => `📰 ${s} outlets · ${n} stories`, rest: "Other stories (newest first)",
      srcHead: ["Official", "Wire services", "Media", "DART filings", "Unverified"] },
    ja: { more2: n => ` ほか${n}`, cityLbl: "地域", catsLbl: "分野", catsAll: "すべて", catsClear: "分野の絞り込みを解除", ofN: (n, k) => (n > k ? `${n.toLocaleString()}件中 最新${k}件` : `${n.toLocaleString()}件`), label: "並び替え", time: "新しい順", hot: "報道が多い順", src: "情報源順", cat: "分野別", grp: (s, n) => `📰 ${s}社が報道 · 記事${n}件`, rest: "その他の記事（新しい順）",
      srcHead: ["公式発表", "通信社", "報道", "DART開示", "未確認"] },
  };
  const tx = k => (TX[LANG] || TX.ko)[k];
  const MODES = ["time", "hot", "src", "cat"];
  let mode = local.get("listSort", "time");
  if (!MODES.includes(mode)) mode = "time";
  const CAT_ORDER = ["politics", "economy", "diplomacy", "conflict", "disaster", "general"];
  const cats = new Set((local.get("listCats", []) || []).filter(c => CAT_ORDER.includes(c)));   // 비어 있으면 거르지 않음
  const catOK = it => !cats.size || cats.has(catOf(it));
  const saveCats = () => { local.set("listCats", [...cats]); renderList(); };
  // 지역(시 단위): location_name 첫 부분. 영어로 적힌 한국 큰 도시는 한국어 이름으로 합침
  const EN_KO = { Seoul: "서울", Busan: "부산", Incheon: "인천", Daegu: "대구", Daejeon: "대전", Gwangju: "광주", Ulsan: "울산", Sejong: "세종", Jeju: "제주", Pyongyang: "평양", Suwon: "수원" };
  const cityCache = new WeakMap();
  function cityOf(it) {
    if (cityCache.has(it)) return cityCache.get(it);
    let s = String(it.location_name || "").replace(/\([^)]*\)/g, "").trim(), c = null;
    if (s && s !== it.country) {
      if (/[가-힣]/.test(s)) c = s.split(/\s+/)[0];
      else { s = s.split(",")[0].trim(); c = s && s !== it.country ? EN_KO[s] || s : null; }
    }
    cityCache.set(it, c);
    return c;
  }
  const cities = new Set(local.get("listCities", []) || []);
  const cityOK = it => !cities.size || cities.has(cityOf(it));
  const saveCities = () => { local.set("listCities", [...cities]); renderList(); };

  // 정렬 칸: 목록 바로 위(지역 소식 줄 아래)
  const bar = el("div", "sortbar"), catRow = el("div", "sortbar sortcats"), cityRow = el("div", "sortbar sortcats");
  for (const r of [bar, catRow, cityRow]) r.setAttribute("role", "group");
  // 한 줄 버튼(tools) + 겹쳐 펼치는 칸(pop): 세 줄 중 하나만 보임
  const wrap = el("div", "sortwrap"), tools = el("div", "sortbar sorttools"), pop = el("div", "sortpop");
  const ROWS = { sort: bar, cat: catRow, city: cityRow };
  let open = null;
  pop.append(bar, catRow, cityRow); pop.hidden = true;
  wrap.append(tools, pop);
  $("list").before(wrap);
  function setOpen(k) {
    open = k;
    pop.hidden = !k;
    for (const [key, r] of Object.entries(ROWS)) r.hidden = key !== k;
    drawTools();
  }
  document.addEventListener("click", e => { if (open && !wrap.contains(e.target) && e.target.isConnected) setOpen(null); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && open) { const k = open; setOpen(null); tools.querySelector(`[data-k="${k}"]`)?.focus(); } });
  const short = (names, n) => (names.length ? names.slice(0, n).join("·") + (names.length > n ? tx("more2")(names.length - n) : "") : tx("catsAll"));
  function drawTools() {
    const parts = [
      ["sort", tx("label"), tx(mode), mode !== "time"],
      ["cat", tx("catsLbl"), short(CAT_ORDER.filter(c => cats.has(c)).map(c => T[LANG].cats[c]), 2), cats.size > 0],
      ["city", tx("cityLbl"), short([...cities], 2), cities.size > 0],
    ].map(([k, lbl, val, set]) => {
      const b = el("button", [set ? "set" : null, open === k ? "on" : null].filter(Boolean).join(" ") || null);
      b.type = "button"; b.dataset.k = k;
      b.setAttribute("aria-expanded", String(open === k));
      b.append(el("span", "lbl2", `${lbl}:`), ` ${val} `, el("span", "caret", open === k ? "▴" : "▾"));
      b.addEventListener("click", () => setOpen(open === k ? null : k));
      return b;
    });
    tools.replaceChildren(...parts);
  }
  function drawBar(cityCount = new Map()) {
    const btns = MODES.map(m => {
      const b = el("button", m === mode ? "on" : null, tx(m));
      b.type = "button"; b.setAttribute("aria-pressed", String(m === mode));
      b.addEventListener("click", () => { if (mode !== m) { mode = m; local.set("listSort", m); } setOpen(null); renderList(); });
      return b;
    });
    bar.setAttribute("aria-label", tx("label"));
    bar.replaceChildren(el("span", "lbl", `${tx("label")}:`), ...btns);
    // 분야 줄(늘 보임): 여러 개 고르기, 안 고르면 전부
    {
      const all = el("button", cats.size ? null : "on", tx("catsAll"));
      all.type = "button"; all.setAttribute("aria-pressed", String(!cats.size));
      all.addEventListener("click", () => { if (cats.size) { cats.clear(); saveCats(); } });
      const chips = CAT_ORDER.map(c => {
        const b = el("button", cats.has(c) ? "on" : null);
        b.type = "button"; b.setAttribute("aria-pressed", String(cats.has(c)));
        b.append(catIcon(c, 14), T[LANG].cats[c]);
        b.addEventListener("click", () => { cats.has(c) ? cats.delete(c) : cats.add(c); saveCats(); });
        return b;
      });
      catRow.replaceChildren(el("span", "lbl", `${tx("catsLbl")}:`), all, ...chips);
    }
    // 지역 줄: 지금 목록(분야를 고른 뒤, 지역을 고르기 전)에 많이 나온 곳 12개 + 이미 고른 곳
    const top = [...cityCount].sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
    for (const c of cities) if (!top.includes(c)) top.push(c);
    const allC = el("button", cities.size ? null : "on", tx("catsAll"));
    allC.type = "button"; allC.setAttribute("aria-pressed", String(!cities.size));
    allC.addEventListener("click", () => { if (cities.size) { cities.clear(); saveCities(); } });
    const cchips = top.map(c => {
      const b = el("button", cities.has(c) ? "on" : null);
      b.type = "button"; b.setAttribute("aria-pressed", String(cities.has(c)));
      b.append(c, el("small", null, (cityCount.get(c) || 0).toLocaleString()));
      b.addEventListener("click", () => { cities.has(c) ? cities.delete(c) : cities.add(c); saveCities(); });
      return b;
    });
    cityRow.hidden = open !== "city";
    cityRow.setAttribute("aria-label", tx("cityLbl"));
    cityRow.replaceChildren(el("span", "lbl", `${tx("cityLbl")}:`), allC, ...cchips);
    drawTools();
  }
  drawBar(); setOpen(null);

  let hotCache = { key: "", res: null };
  const keyOf = arr => `${arr.length}|${arr[0]?.url}|${arr.at(-1)?.url}|${LANG}`;
  const base = renderList;
  renderList = function (all0 = filtered()) {
    const allT = cats.size ? all0.filter(catOK) : all0;          // 고른 분야만(안 골랐으면 그대로)
    // 지역 버튼에 쓸 건수: 지금 보는 범위(지역 탭 또는 "이 지역 소식")에서, 분야를 고른 뒤
    const okT = new Set(allT), pool = pinned ? pinned.filter(it => okT.has(it)) : allT.filter(it => inRegion(it, region));
    const cityCount = new Map();
    for (const it of pool) { const c = cityOf(it); if (c) cityCount.set(c, (cityCount.get(c) || 0) + 1); }
    const all = cities.size ? allT.filter(cityOK) : allT;         // 고른 지역만
    try {
      drawBar(cityCount);                                        // 언어를 바꿨을 때 글자도 같이
      const ok = new Set(all);
      const shown0 = (pinned ? pinned.filter(it => ok.has(it)) : all.filter(it => inRegion(it, region))).slice().sort((a, b) => b._t - a._t);
      let order = shown0, heads = [];                            // heads: [목록 위치, 머리글 글자]
      if (mode === "hot") {
        const k = keyOf(shown0);
        if (hotCache.key !== k) hotCache = { key: k, res: LSORT.groups(shown0) };
        order = [];
        let restMarked = false;
        for (const gr of hotCache.res) {
          if (gr.tail && !restMarked) { heads.push([order.length, tx("rest")]); restMarked = true; }
          else if (!gr.tail && gr.srcs >= 2) heads.push([order.length, tx("grp")(gr.srcs, gr.items.length)]);
          order.push(...gr.items);
        }
      } else if (mode === "src" || mode === "cat") {
        // 칸마다 최신 몇 건씩만(목록은 한 번에 120건만 그리므로, 첫 칸이 120건을 다 차지하지 않게) — 머리글에 전체 건수
        const keyOf2 = mode === "src" ? SRC_RANK : it => CAT_ORDER.indexOf(catOf(it));
        const nameOf = mode === "src" ? k => tx("srcHead")[k] : k => T[LANG].cats[CAT_ORDER[k]];
        const by = new Map();
        for (const it of shown0) { const k = keyOf2(it); (by.get(k) || by.set(k, []).get(k)).push(it); }
        const keys = [...by.keys()].sort((x, y) => x - y), per = Math.max(10, Math.floor(LIST_MAX / keys.length));
        order = []; const later = [];
        for (const k of keys) {
          const arr = by.get(k);
          heads.push([order.length, `${nameOf(k)} · ${tx("ofN")(arr.length, Math.min(per, arr.length))}`]);
          order.push(...arr.slice(0, per)); later.push(...arr.slice(per));
        }
        order.push(...later);
      }
      // 원래 그리기에 순서만 바꿔서 넘김(원래 함수는 받은 순서대로 그림)
      if (pinned) { const set = new Set(order); pinned = order.concat(pinned.filter(it => !set.has(it))); base(all); }
      else base(order.concat(all.filter(it => !inRegion(it, region))));
      // 머리글 끼우기(그려진 120개 안에서만)
      const lis = [...$("list").children];
      for (const [i, text] of heads.slice().reverse()) if (i < LIST_MAX && lis[i]) lis[i].before(el("li", "sort-head", text));
    } catch (e) { console.warn("list-sort", e); base(all); }   // 문제가 생기면 예전 순서 그대로
  };

  const css = document.createElement("style");
  css.textContent = `
.sortbar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 14px; border-bottom: 1px solid var(--line); }
.sortbar .lbl { font-size: 12px; color: var(--muted); margin-right: 2px; }
.sortbar button { background: var(--bg); border: 1px solid var(--line); border-radius: 999px; padding: 3px 11px; font-size: 12px; color: var(--text); cursor: pointer; }
.sortbar button.on { border-color: var(--accent); background: var(--panel-2); font-weight: 700; }
.sortbar.sortcats { padding-top: 0; }
.sortwrap { position: relative; }
.sortbar.sorttools { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
.sortbar.sorttools button { flex: none; white-space: nowrap; }
.sortbar.sorttools button.set { border-color: var(--accent); color: var(--accent); font-weight: 700; }
.sortbar.sorttools button.on { background: var(--panel-2); }
.sortbar.sorttools .lbl2 { color: var(--muted); font-weight: 400; }
.sortbar.sorttools .caret { color: var(--muted); font-size: 10px; }
.sortpop { position: absolute; left: 0; right: 0; top: 100%; z-index: 6; background: var(--panel); border-bottom: 1px solid var(--line);
  box-shadow: 0 10px 24px rgba(0,0,0,.45); max-height: 60vh; overflow-y: auto; }
.sortpop[hidden], .sortpop .sortbar[hidden] { display: none; }
.sortpop .sortbar { padding-top: 10px; padding-bottom: 10px; border-bottom: 0; }
.sortbar.sortcats[hidden] { display: none; }
.sortbar.sortcats button { display: inline-flex; align-items: center; gap: 4px; }
.sortbar.sortcats button small { color: var(--muted); font-size: 10.5px; margin-left: 3px; }
#list li.sort-head { padding: 8px 14px 6px; font-size: 12.5px; font-weight: 800; color: var(--accent); background: var(--panel-2); border-bottom: 1px solid var(--line);
  position: sticky; top: 0; z-index: 1; }`;
  document.head.append(css);
  renderList();
  // 관심 소식 모아보기(watch.js, 2026-11-18) — 이 파일이 불러옴(index.html 수정 없이). 없거나 오류면 관심 줄만 안 생김.
  const w = document.createElement("script");
  w.src = "watch.js";
  document.head.append(w);
  // 전송량 줄이기(quiet.js, 2026-11-18) — 쉬는 화면은 자동 새로고침 멈춤, 90일치 시세 3시간마다, 뉴스 전체 다시 받기 6시간마다
  const q = document.createElement("script");
  q.src = "quiet.js";
  document.head.append(q);
  // 아침 한 장 요약(brief.js, 2026-11-18) — 검색창 옆 "☀ 요약" 버튼
  const br = document.createElement("script");
  br.src = "brief.js";
  document.head.append(br);
  // 제목 언어 알아보기 넓히기(lang-detect.js, 2026-11-18) — 베트남어·태국어·독일어 등 각국 현지어 경제 기사 번역용
  const ld = document.createElement("script");
  ld.src = "lang-detect.js";
  document.head.append(ld);
  // 나라 검색(country-search.js, 2026-11-19) — 검색창에 나라 이름 → 지구본 이동 + 그 나라 관련 기사
  const cs = document.createElement("script");
  cs.src = "country-search.js";
  document.head.append(cs);
  // 뉴스 주제 ↔ 국내 상장 ETF(etf-link.js, 2026-11-19) — 팝업 "관련 ETF" · 시세 탭 "뉴스 주제별 ETF" · 나라 검색 줄 "이 나라 ETF"
  const ef = document.createElement("script");
  ef.src = "etf-link.js";
  document.head.append(ef);
  // AI 해설(ai-brief.js, 2026-11-20) — "☀ 요약" 창 맨 위 "🤖 AI 해설 (참고용)" (서버가 매일 아침 만든 것을 읽기만)
  const ai = document.createElement("script");
  ai.src = "ai-brief.js";
  document.head.append(ai);
  // 코스피·코스닥 오늘 장 소식(market-news.js, 2026-11-20) — 공식 지수가 하루 늦게 올라와서, 속보 제목으로 "오늘 장 소식(잠정)"
  const mn = document.createElement("script");
  mn.src = "market-news.js";
  document.head.append(mn);
  // 종목·ETF 카드 오늘 장 소식(stock-today.js, 2026-11-20) — 종가가 하루 늦어서, 오늘 시장·그 종목 속보를 함께
  const st = document.createElement("script");
  st.src = "stock-today.js";
  document.head.append(st);
  // 어두운/밝은 화면 버튼(theme.js, 2026-11-20)
  const th = document.createElement("script");
  th.src = "theme.js";
  document.head.append(th);
})(typeof globalThis !== "undefined" ? globalThis : this);
