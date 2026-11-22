// 뉴스 지도 → 부동산 페이지 잇기 (2026-11-23 사용자 "두 페이지가 연동이 안 됨 → 해결", 부동산 영향 1단계)
// - 뉴스 팝업(card(…, inPopup)) 아래에 "🏠 이 지역 부동산 (분당구) · 재건축·재개발" 단추 → real-estate.html?sgg=41135&from=news (그 시군구로 바로 열림)
// - 언제 보이나: 제목이 부동산 소식(re-signal-core.js RESIG.signalOf)이거나, 경제 기사인데 제목·장소가 서울·경기 72곳 중 하나일 때
// - index.html 수정 없음(list-sort.js 가 이 파일을 불러옴). 규칙 파일 re-signal-core.js 는 이 파일이 불러옴(서버 re-impact 함수와 같은 규칙)
(() => {
  if (typeof card !== "function") return;
  if (!globalThis.RESIG) { const s = document.createElement("script"); s.src = "re-signal-core.js"; document.head.append(s); }
  const TX = {
    ko: { go: "🏠 이 지역 부동산", all: "🏠 부동산 지도", seoul: "서울", gg: "경기", tip: "부동산 페이지에서 이 지역 실거래·시세 보기" },
    en: { go: "🏠 Housing here", all: "🏠 Housing map", seoul: "Seoul", gg: "Gyeonggi", tip: "Open this area on the housing page" },
    ja: { go: "🏠 この地域の不動産", all: "🏠 不動産マップ", seoul: "ソウル", gg: "京畿", tip: "不動産ページでこの地域を見る" },
  };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];
  function nameOf(code) {
    const R = globalThis.RESIG;
    if (code === "11000") return tx("seoul");
    if (code === "41000") return tx("gg");
    if (R.SEOUL_FULL[code]) return R.SEOUL_FULL[code];
    const gu = Object.entries(R.GG_GU).find(([, c]) => c === code);
    if (gu) { const city = Object.entries(R.GG).find(([, c]) => c === `${code.slice(0, 4)}0`); return `${city ? city[0] : ""} ${gu[0]}`.trim(); }
    const city = Object.entries(R.GG).find(([, c]) => c === code);
    return city ? city[0] : code;
  }
  const CAPITAL = c => /^(11|41)\d{3}$/.test(c);
  function target(it) {
    const R = globalThis.RESIG;
    if (!R || !it) return null;
    const sig = R.signalOf(it);
    let regions = R.regionsInTitle(String(it.title || "")).filter(CAPITAL);
    if (!regions.length) { const p = R.regionOfPlace(it.location_name); if (p && CAPITAL(p) && p !== "11000") regions = [p]; }   // "서울"(기관 자리)은 지역으로 안 봄
    if (!sig && !(regions.length && it.category === "economy")) return null;
    const region = regions[0] || (sig && CAPITAL(sig.regions[0]) ? sig.regions[0] : null);
    return { region, theme: sig?.theme || null };
  }
  const base = card;
  card = function (it, inPopup, ...rest) {
    const box = base.call(this, it, inPopup, ...rest);
    try {
      if (!inPopup) return box;
      const t = target(it);
      if (!t) return box;
      const a = el("a", "re-link");
      a.href = `real-estate.html${t.region ? `?sgg=${t.region}&from=news` : ""}`;
      a.title = tx("tip");
      const L = globalThis.RESIG.LABEL[typeof LANG === "string" ? LANG : "ko"] || globalThis.RESIG.LABEL.ko;
      a.textContent = t.region ? `${tx("go")} (${nameOf(t.region)})${t.theme ? ` · ${L[t.theme]}` : ""}` : `${tx("all")}${t.theme ? ` · ${L[t.theme]}` : ""}`;
      box.append(a);
    } catch (e) { console.warn("re-link", e); }
    return box;
  };
  globalThis.RELINK = { target };
  const css = document.createElement("style");
  css.textContent = `
.re-link { display: inline-block; margin-top: 6px; padding: 4px 10px; border-radius: 999px; border: 1px solid #2563eb; color: var(--text); font-size: 12px; font-weight: 700; text-decoration: none; }
.re-link:hover { background: rgba(37,99,235,.15); }`;
  document.head.append(css);
})();
