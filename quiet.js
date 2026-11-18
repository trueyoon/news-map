// 전송량 줄이기 (2026-11-18). Supabase 무료 요금제의 전송량(한 달 5GB)을 넘어서(5.07GB) 원인을 조사한 결과:
//   ① 아무도 안 보는 채로 열려 있던 화면(시험용 미리보기 창 등)이 5분마다 계속 받아 감 — 전체의 약 75%
//   ② 시세 탭이 5분마다 90일치 하루 값(price_daily, 하루 한 번만 바뀜)을 통째로 다시 받음
//   ③ 뉴스 4만 건을 1시간마다 통째로 다시 받음(지진 규모 수정 반영용)
// 그래서(기능은 그대로):
//   ① 30분 동안 아무 조작(마우스·키보드·터치·스크롤)이 없거나 화면이 가려져 있으면 자동 새로고침을 쉼. 다시 움직이면 바로 새로 받음. 쉬는 동안 "기준 시각" 옆에 ⏸.
//   ② 90일치 하루 값은 3시간에 한 번만 다시 받음(최신 값 latest_prices 는 그대로 5분마다).
//   ③ 뉴스 전체 다시 받기는 6시간마다. 그 사이엔 새 소식만(예전처럼 5분마다) + 1시간마다 USGS 지진 줄만 다시 받아 규모·피해 등급 수정을 반영.
//   ④ 화면이 가려졌다 보였다를 빠르게 되풀이하면(2026-11-18 기록: 5분에 70번) 그때마다 받던 것 → 새 소식은 30초, 시세는 60초 안에 다시 부르면 건너뜀.
// index.html 의 refresh()·loadMarket()·load()·fetchRows() 를 감쌈(전역 이름이라 시계·화면 복귀 때도 이쪽을 부름). list-sort.js 가 이 파일을 불러옴(index.html 수정 없음).
(function () {
  if (typeof refresh !== "function" || typeof loadMarket !== "function" || typeof load !== "function" || typeof fetchRows !== "function") return;
  const MIN = 60e3, IDLE = 30 * MIN, FULL = 6 * 60 * MIN, DAILY = 3 * 60 * MIN, QUAKE = 60 * MIN;
  const TX = { ko: "자동 새로고침 쉬는 중 — 화면을 움직이면 다시 받아요", en: "Auto-refresh paused — move or tap to resume", ja: "自動更新を一時停止中 — 操作すると再開します" };

  let lastAct = Date.now(), paused = false;
  const idle = () => document.visibilityState === "hidden" || Date.now() - lastAct > IDLE;
  function markPaused(on) {
    paused = on;
    const u = $("updated");
    if (!u) return;
    if (on) { if (!u.textContent.includes("⏸")) u.textContent += " ⏸"; u.title = TX[LANG] || TX.ko; }
    else { u.title = ""; stamp(false); }
  }
  const act = () => {
    const was = paused || Date.now() - lastAct > IDLE;
    lastAct = Date.now();
    if (was && document.visibilityState === "visible" && !$("app").hidden) { markPaused(false); refresh(); loadMarket(); }
  };
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart", "scroll"]) addEventListener(ev, act, { passive: true, capture: true });
  // 다른 탭·앱에서 돌아오면 "방금 움직임"으로(index.html 의 화면 복귀 처리가 refresh 를 부르기 전에 — window 에서 먼저 받음)
  addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { lastAct = Date.now(); if (paused) markPaused(false); } }, { capture: true });
  let moveT = 0;
  addEventListener("pointermove", () => { if (Date.now() - moveT > 5000) { moveT = Date.now(); act(); } }, { passive: true });

  // ③ 전체 다시 받기 6시간마다: 진짜 전체를 받은 시각을 따로 기억하고, 그 전엔 index.html 의 fullAt 을 "방금"으로 맞춰 새 소식만 받게 함
  let realFull = typeof fullAt === "number" ? fullAt : 0, quakeAt = Date.now();
  const baseLoad = load;
  load = async function (...a) { const r = await baseLoad.apply(this, a); realFull = quakeAt = Date.now(); return r; };
  const baseRefresh = refresh;
  let refAt = 0, mktAt = 0;
  refresh = async function (...a) {
    if (idle()) { markPaused(true); return; }
    if (items.length && Date.now() - refAt < 30e3) return;
    refAt = Date.now();
    if (items.length && realFull && Date.now() - realFull < FULL) fullAt = Date.now();
    const r = await baseRefresh.apply(this, a);
    if (items.length && Date.now() - quakeAt > QUAKE) { quakeAt = Date.now(); quakes().catch(() => {}); }
    return r;
  };
  // USGS 지진 줄만 다시 받아 바꿔 끼움(규모·피해 등급이 몇 시간 뒤 수정됨). 사라진 옛 번호는 6시간 전체 다시 받기 때 빠짐.
  async function quakes() {
    const since = sinceIso();
    const { data, error } = await db.from("news").select(COLS).eq("source_name", "USGS").gte("published_at", since).limit(1000);
    if (error || !data) return;
    const byUrl = new Map(items.map(it => [it.url, it]));
    let changed = false;
    for (const r of data) {
      const old = byUrl.get(r.url);
      if (!old || old.summary !== r.summary || old.title !== r.title || old.published_at !== r.published_at) { byUrl.set(r.url, prep(r)); changed = true; }
    }
    if (!changed) return;
    items = [...byUrl.values()].sort((a, b) => b._t - a._t);
    render();
  }

  // ① 시세도 쉬는 동안은 안 받음
  const baseMarket = loadMarket;
  loadMarket = function (...a) {
    if (market && idle()) { markPaused(true); return Promise.resolve(); }
    if (market && Date.now() - mktAt < 60e3) return Promise.resolve();
    mktAt = Date.now();
    return baseMarket.apply(this, a);
  };
  // ② 90일치 하루 값은 3시간 동안 다시 씀
  let dailyCache = null;
  const baseFetch = fetchRows;
  fetchRows = async function (query, cap) {
    let isDaily = false;
    try { isDaily = /\/price_daily$/.test(query()?.url?.pathname || ""); } catch { /* 모르면 그냥 받음 */ }
    if (!isDaily) return baseFetch(query, cap);
    if (dailyCache && Date.now() - dailyCache.at < DAILY) return dailyCache.rows.slice();
    const rows = await baseFetch(query, cap);
    dailyCache = { at: Date.now(), rows };
    return rows.slice();
  };
})();
