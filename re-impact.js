// 부동산 페이지 ← 뉴스 잇기 (2026-11-23 사용자 "두 페이지가 연동이 안 됨 → 해결", 부동산 영향 1단계)
// - 주소 real-estate.html?sgg=41135(&from=news) 로 열면: 목록 탭 + 지도를 그 시·군·구로(구가 있는 경기 시 41110 등은 그 시 전체, 11000·41000 은 서울·경기 전체)
// - 목록 탭 머리 아래 "📰 이 지역 부동산 소식 (최근 14일)": 부동산 뉴스 장부(re_news_days — 서버 re-impact 함수가 매일 계산)의 대표 제목. 동을 누르면 그 시·군·구 소식으로 바뀜
// - real-estate.html 은 맨 아래 <script src="re-impact.js"></script> 한 줄만(사용자 허락 필요). 표가 없거나 못 읽으면 소식 칸만 안 생김
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined") return;
  const THEME = { market: "시장·가격", supply: "공급·분양", redevelop: "재건축·재개발", transit: "교통 호재", develop: "개발·산업", rule: "규제·세금", rate: "금리·대출", risk: "위험" };
  const H = 3600e3;
  const kstDay = t => new Date(t + 9 * H).toISOString().slice(0, 10);
  // 지역 열쇠 → 그 안의 우리 시·군·구 코드들
  function codesOf(code) {
    if (SGG[code]) return [code];
    if (code === "11000") return Object.keys(SGG).filter(c => c.startsWith("11"));
    if (code === "41000") return Object.keys(SGG).filter(c => c.startsWith("41"));
    return Object.keys(SGG).filter(c => c.startsWith(code.slice(0, 4)));             // 수원 41110 → 41111·41113·41115·41117
  }
  // 장부에서 이 지역에 해당하는 열쇠들(구 + 그 구가 속한 시)
  function ledgerKeys(code) {
    const keys = new Set([code]);
    if (/^41\d{3}$/.test(code) && !code.endsWith("0")) keys.add(`${code.slice(0, 4)}0`);
    if (code === "11000" || code === "41000" || code.endsWith("0")) for (const c of codesOf(code)) keys.add(c);
    return [...keys];
  }
  const nameOf = code => SGG[code] ? `${SGG[code].sido} ${SGG[code].name}` : code === "11000" ? "서울" : code === "41000" ? "경기" : (SGG[codesOf(code)[0]]?.name || "").split(" ")[0] || code;

  // ── 소식 칸 ──
  let box = null, seq = 0, current = null;
  function ensureBox() {
    if (box?.isConnected) return box;
    const list = document.getElementById("list");
    if (!list) return null;
    box = el("div", "re-news");
    list.before(box);
    return box;
  }
  async function showNews(code) {
    const b = ensureBox();
    if (!b || !code) return;
    current = code;
    const my = ++seq, keys = ledgerKeys(code);
    b.replaceChildren(el("div", "re-news-h", `📰 ${nameOf(code)} 부동산 소식 (최근 14일)`), el("div", "re-news-empty", "불러오는 중…"));
    const { data, error } = await db.from("re_news_days").select("day,region,theme,n,top").in("region", keys).gte("day", kstDay(Date.now() - 14 * 86400e3))
      .order("day", { ascending: false }).limit(200);
    if (my !== seq) return;
    if (error) { b.remove(); box = null; return; }                                     // 표가 없으면(SQL 전) 칸을 안 보임
    const items = [];
    for (const r of data || []) for (const t of r.top || []) items.push({ day: r.day, theme: r.theme, ...t });
    const seen = new Set(), uniq = items.filter(x => (seen.has(x.u) ? false : seen.add(x.u)));
    const counts = {};
    for (const r of data || []) counts[r.theme] = (counts[r.theme] || 0) + r.n;
    const head = el("div", "re-news-h", `📰 ${nameOf(code)} 부동산 소식 (최근 14일)`);
    const chips = el("div", "re-news-chips");
    for (const [k, n] of Object.entries(counts).sort((a, c) => c[1] - a[1])) chips.append(el("span", "re-chip", `${THEME[k] || k} ${n}`));
    const ul = el("ul", "re-news-list");
    for (const x of uniq.slice(0, 8)) {
      const li = el("li"), a = el("a", null, x.t);
      if (/^https?:\/\//i.test(x.u || "")) { a.href = x.u; a.target = "_blank"; a.rel = "noopener noreferrer"; }
      li.append(el("span", "re-chip", THEME[x.theme] || x.theme), a, el("small", null, ` ${x.day.slice(5).replace("-", "/")} · ${x.s || ""}`));
      ul.append(li);
    }
    b.replaceChildren(head, ...(uniq.length ? [chips, ul] : [el("div", "re-news-empty", "최근 14일 동안 이 지역 이름이 나온 부동산 소식이 없어요.")]),
      el("div", "re-news-note", "뉴스 제목에서 지역·주제를 골라 셌어요(서울 전체·전국 소식은 빼고). 소식 ≠ 가격 원인."));
  }

  // ── 주소로 들어온 지역 열기 ──
  function openFromUrl() {
    const code = new URLSearchParams(location.search).get("sgg");
    if (!code || !/^\d{5}$/.test(code)) return;
    let tries = 0;
    const wait = setInterval(() => {
      if (++tries > 120) return clearInterval(wait);                                    // 1분 기다려도 동 목록이 없으면 포기
      if (document.getElementById("app")?.hidden || typeof dongs === "undefined" || !dongs.length || typeof map === "undefined" || !map) return;
      clearInterval(wait);
      try {
        showTab("list");
        const codes = new Set(codesOf(code)), pts = dongs.filter(d => codes.has(d.sgg_cd) && (typeof shown === "undefined" || shown.has(d.kind)));
        if (SGG[code]) pickSgg("list", code);
        else if (pts.length) {
          listMode = { type: "view" }; popup?.remove();
          const bnd = new maplibregl.LngLatBounds(); pts.forEach(d => bnd.extend([d.x, d.y]));
          map.fitBounds(bnd, { padding: 40, maxZoom: 12, duration: 900 });
          renderList();
        }
        showNews(code);
      } catch (e) { console.warn("re-impact", e); }
    }, 500);
  }
  // 동을 누르면 그 시·군·구 소식으로
  if (typeof openDong === "function") {
    const baseOpen = openDong;
    openDong = function (d, ...rest) { const r = baseOpen.call(this, d, ...rest); try { if (d?.sgg_cd && d.sgg_cd !== current) showNews(d.sgg_cd); } catch { /* 소식 칸만 */ } return r; };
  }
  openFromUrl();
  globalThis.REIMPACT = { showNews, codesOf };
  // 2단계 [영향·예측] 탭(re-impact-tab.js) — 권역표가 든 규칙 파일(re-signal-core.js)을 먼저 불러온 뒤
  (function loadTab() {
    const add = (src, cb) => { const s = document.createElement("script"); s.src = src; s.onload = cb; s.onerror = () => console.warn("re-impact: 못 불러옴", src); document.head.append(s); };
    // [영향·예측] 다음에 [내 집 찾기](re-finder.js, 2026-11-23) — 탭 순서를 지키려고 차례로
    // [내 집 찾기] 다음에 [집 비교](re-homecmp.js, 2026-11-24 — 재산 조건 없이 고른 집끼리)
    // 목록 탭의 시 → 구 → 동 나무(re-tree.js, 2026-11-23) 다음, 맨 끝에 전세 위험 체크(re-jeonse.js) → 동네 대비·비슷한 단지(re-peer.js) → 뉴스 → 집값 기록(re-newsprice.js) → 금리 반응·건설·리츠(re-rate.js) → 지도 색칠(re-colormap.js) → 순위 탭(re-rank.js) → ★ 관심 단지(re-watch.js) → 🔎 검색(re-search.js) → 매매·전세·월세 탭(re-market.js) → 첫 화면 요약(re-front.js, 2026-11-25 — 모든 탭이 붙은 뒤)
    const tab = () => add("re-impact-tab.js", () => add("re-finder.js", () => add("re-homecmp.js", () => add("re-tree.js", () => add("re-stats-link.js", () => add("re-jeonse.js", () => add("re-peer.js", () => add("re-newsprice.js", () => add("re-rate.js", () => add("re-colormap.js", () => add("re-rank.js", () => add("re-watch.js", () => add("re-search.js", () => add("re-market.js", () => add("re-front.js")))))))))))))));
    if (globalThis.RESIG) tab(); else add("re-signal-core.js", tab);
  })();

  const css = document.createElement("style");
  css.textContent = `
.re-news { margin: 6px 0 8px; padding: 8px 10px; border: 1px solid var(--line); border-left: 3px solid #2563eb; border-radius: 8px; font-size: 12.5px; display: grid; gap: 5px; }
.re-news-h { font-weight: 800; font-size: 13px; }
.re-news-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.re-chip { display: inline-block; font-size: 11px; padding: 0 6px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); margin-right: 4px; white-space: nowrap; }
.re-news-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.re-news-list a { color: var(--text); text-decoration: none; } .re-news-list a:hover { text-decoration: underline; }
.re-news-list small { color: var(--muted); }
.re-news-empty, .re-news-note { color: var(--muted); font-size: 11.5px; }`;
  document.head.append(css);
})();
