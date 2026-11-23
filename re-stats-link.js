// 부동산 페이지 [통계] 탭의 "최근 거래" 표에서 단지·건물을 누르면 그 단지·건물 상세 화면을 엶 (사용자 2026-11-23 "통계에 나오는 아파트·빌라·오피스텔을 누르면 해당 정보가 나오게")
// - re-impact.js 가 불러옴(real-estate.html 수정 없음). addTrades 를 감싸 새로 붙은 줄만 누를 수 있게 함
// - 누르면: 그 동으로 지도 이동 + 단지·건물 지도 요약(re_places)을 찾아 openPlace (없으면 거래 줄의 정보로). "← 돌아가기"는 통계 탭으로
(() => {
  if (typeof addTrades !== "function" || typeof openPlace !== "function" || typeof db === "undefined") return;
  const base = addTrades;
  const COLS = "kind,sgg_cd,umd_nm,place_key,name,build_year,trades,trades_12m,last_date,last_price,last_area,pyeong_12m";
  async function open(kind, sgg, row) {
    const key = kind === "apt" ? row.apt_seq : row.jibun;
    try {
      const d = (typeof dongs !== "undefined" ? dongs : []).find(x => x.kind === kind && x.sgg_cd === sgg && x.umd_nm === row.umd_nm);
      if (d && typeof map !== "undefined" && map) map.flyTo({ center: [d.x, d.y], zoom: Math.max(map.getZoom(), 14), duration: 900 });
    } catch { /* 지도 이동만 */ }
    let p = null;
    try {
      const r = await db.from("re_places").select(COLS).eq("kind", kind).eq("sgg_cd", sgg).eq("umd_nm", row.umd_nm).eq("place_key", key).maybeSingle();
      p = r.data || null;
    } catch { /* 요약 없음 */ }
    openPlace(p || { kind, sgg_cd: sgg, umd_nm: row.umd_nm, place_key: key, name: row.apt_nm || row.name || null });
  }
  addTrades = function (rows, ...rest) {
    const tb = document.getElementById("trades"), start = tb ? tb.children.length : 0;
    const kind = typeof sKind !== "undefined" ? sKind : null, sgg = typeof sSgg !== "undefined" ? sSgg : null;
    const r = base.call(this, rows, ...rest);
    try {
      if (!tb || !kind || !sgg || !Array.isArray(rows)) return r;
      const trs = [...tb.children].slice(start);
      rows.forEach((row, i) => {
        const tr = trs[i], key = kind === "apt" ? row.apt_seq : row.jibun;
        if (!tr || !key || !row.umd_nm) return;
        tr.classList.add("st-go"); tr.tabIndex = 0;
        tr.title = "눌러서 이 단지·건물 정보 보기";
        tr.addEventListener("click", () => open(kind, sgg, row));
        tr.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(kind, sgg, row); } });
      });
    } catch (e) { console.warn("re-stats-link", e); }
    return r;
  };
  const css = document.createElement("style");
  css.textContent = `
#trades tr.st-go { cursor: pointer; }
#trades tr.st-go:hover, #trades tr.st-go:focus-visible { background: color-mix(in srgb, var(--accent) 12%, transparent); outline: none; }
#trades tr.st-go td.nm2 { text-decoration: underline dotted color-mix(in srgb, var(--muted) 70%, transparent); text-underline-offset: 3px; }
#pane-stats .st-hint { font-size: 11.5px; color: var(--muted); margin: 2px 0 0; }`;
  document.head.append(css);
  // 표 제목 옆에 안내 한 줄
  try {
    const h = document.getElementById("trades")?.closest("section.panel")?.querySelector(".panel-head");
    if (h && !h.querySelector(".st-hint")) h.append(Object.assign(document.createElement("p"), { className: "st-hint", textContent: "단지·건물을 누르면 상세 정보가 열려요" }));
  } catch { /* 안내만 */ }
})();
