// 재난 레이어 (2026-10-10 사용자 요청, 2단계). 뉴스 지도 위에 켜고 끌 수 있는 지진·재난 경보·위성 열원 점.
// - 지진: USGS 규모 2.5 이상 (표 dz_quakes, 5분마다 수집). 크기 = 규모, 색 = USGS 피해 예상 등급(PAGER). 뉴스 기간 선택(1시간~3일)을 따름
// - 경보: GDACS (태풍·홍수·화산·지진·산불·가뭄). 2026-11-22 사용자 요청으로 "지금 진행 중인 것만" — 서버가 15분마다 GDACS RSS 로 맞추는 표 dz_alerts 를 읽음.
//   (그 표가 없거나 못 읽으면 예전처럼 news 표의 GDACS 줄 — 처음 나온 뒤 7~60일). 색 = 경보 등급, 동그라미 위에 종류 아이콘(태풍·홍수·화산·산불·가뭄·지진)
//   버튼 아이콘: 지진 = 파형, 경보 = 사이렌, 열원 = 불꽃(Lucide 모양 참고, ISC). 열원은 확대 5부터 불꽃 아이콘으로
// - 열원: NASA FIRMS 위성 열원(높은 신뢰도만, 표 dz_hotspots, 1시간마다). 산불만이 아니라 농업 소각·공장 열도 잡혀서 "열원 감지"로 표시 — 최근 24시간
// - 기존 뉴스 점 "아래"에 그려서 가리지 않음. 규모 4.5 이상 지진·GDACS 경보는 같은 자리에 뉴스 점이 있어서 그 바깥에 보이는 고리로 그림.
//   자기 자료만 따로 새로 고쳐서 뉴스 화면이 느려지지 않음. 처음엔 모두 꺼져 있음(누르면 켜짐, 브라우저에 기억)
// index.html 맨 아래 <script src="disaster-layer.js"></script> 한 줄로 불러옴. index.html 의 addNewsLayers()·applyStatic()·load() 를 감쌈.
(() => {
  if (typeof addNewsLayers !== "function") return;     // index.html 이 바뀌어 없으면 아무것도 안 함(뉴스 화면은 그대로)
  const TX = {
    ko: { quake: "지진", alert: "경보", heat: "열원", quakeT: "지진 (USGS, 규모 2.5 이상) — 점 크기 = 규모, 색 = 피해 예상 등급",
      alertT: "진행 중인 재난 경보 (GDACS) — 태풍·홍수·화산·가뭄·큰 산불·큰 지진. 색 = 경보 등급", heatT: "위성 열원 감지 (NASA FIRMS, 최근 24시간) — 산불·농업 소각·공장 열 등",
      mag: "규모", depth: "깊이", pager: "피해 예상 등급", pagerV: { green: "초록(낮음)", yellow: "노랑", orange: "주황", red: "빨강(높음)" }, noPager: "아직 없음",
      tsunami: "바다의 큰 지진 표시 (실제 쓰나미 경보는 아니에요)", src: "출처", open: "원문 보기 ↗", firmsMap: "NASA FIRMS 지도에서 보기 ↗",
      heatTitle: "위성 열원 감지", heatNote: "위성이 감지한 뜨거운 지점이에요. 산불뿐 아니라 농업 소각·공장·가스 불꽃일 수도 있어요.",
      frp: "열 세기", sat: "위성", day: "낮", night: "밤", level: { Green: "초록", Orange: "주황", Red: "빨강" }, alertNote: "자동 경보라 참고용이에요 (각국 공식 경보를 대신하지 않음).",
      types: { EQ: "지진", TC: "태풍", FL: "홍수", VO: "화산", WF: "산불", DR: "가뭄" }, levelK: "경보 등급", first: "처음 나온 때",
      ongoing: "진행 중", since: "시작", lastSeen: "마지막 확인", sevK: "세기", popK: "영향", where: "지역" },
    en: { quake: "Quakes", alert: "Alerts", heat: "Heat", quakeT: "Earthquakes (USGS, M2.5+) — size = magnitude, color = PAGER impact level",
      alertT: "Ongoing disaster alerts (GDACS) — cyclones, floods, volcanoes, droughts, large fires and quakes. Color = alert level", heatT: "Satellite heat detections (NASA FIRMS, last 24 h) — wildfires, crop burning, industry",
      mag: "Magnitude", depth: "Depth", pager: "PAGER level", pagerV: { green: "Green (low)", yellow: "Yellow", orange: "Orange", red: "Red (high)" }, noPager: "not yet",
      tsunami: "Large ocean quake flag (not an actual tsunami warning)", src: "Source", open: "Open source ↗", firmsMap: "View on NASA FIRMS map ↗",
      heatTitle: "Satellite heat detection", heatNote: "A hot spot seen by satellite — may be a wildfire, crop burning, a factory or a gas flare.",
      frp: "Radiative power", sat: "Satellite", day: "day", night: "night", level: { Green: "Green", Orange: "Orange", Red: "Red" }, alertNote: "Automatic alert, for reference only (not an official warning).",
      types: { EQ: "Earthquake", TC: "Cyclone", FL: "Flood", VO: "Volcano", WF: "Wildfire", DR: "Drought" }, levelK: "Alert level", first: "first issued",
      ongoing: "Ongoing", since: "since", lastSeen: "last seen", sevK: "Severity", popK: "Impact", where: "Area" },
    ja: { quake: "地震", alert: "警報", heat: "熱源", quakeT: "地震（USGS、M2.5以上）— 大きさ＝規模、色＝被害予測レベル",
      alertT: "進行中の災害警報（GDACS）— 台風・洪水・火山・干ばつ・大きな山火事・地震。色＝警報レベル", heatT: "衛星による熱源検知（NASA FIRMS、直近24時間）— 山火事・野焼き・工場など",
      mag: "規模", depth: "深さ", pager: "被害予測レベル", pagerV: { green: "緑（低）", yellow: "黄", orange: "橙", red: "赤（高）" }, noPager: "まだなし",
      tsunami: "海域の大きな地震の目印（実際の津波警報ではありません）", src: "出典", open: "元の記事を見る ↗", firmsMap: "NASA FIRMS 地図で見る ↗",
      heatTitle: "衛星による熱源検知", heatNote: "衛星が捉えた高温地点です。山火事のほか、野焼き・工場・ガスの炎の場合もあります。",
      frp: "熱の強さ", sat: "衛星", day: "昼", night: "夜", level: { Green: "緑", Orange: "橙", Red: "赤" }, alertNote: "自動警報のため参考用です（各国の公式警報の代わりではありません）。",
      types: { EQ: "地震", TC: "台風", FL: "洪水", VO: "火山", WF: "山火事", DR: "干ばつ" }, levelK: "警報レベル", first: "初回発表",
      ongoing: "進行中", since: "開始", lastSeen: "最終確認", sevK: "強さ", popK: "影響", where: "地域" },
  };
  const tx = k => (TX[LANG] || TX.ko)[k];
  // 색: 피해 예상·경보 등급은 신호등 색(늘 글자와 함께), 열원은 주황, 등급 없는 지진은 밝은 회색
  const LEVEL = { green: "#22c55e", yellow: "#facc15", orange: "#f97316", red: "#dc2626" };
  const HEAT = "#fb7185";
  // 아이콘(24칸 선 그림, Lucide 참고 — ISC): 버튼·지도 공통
  const IC = {
    siren: "M7 18v-6a5 5 0 1 1 10 0v6M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2zM21 12h1M18.5 4.5 18 5M2 12h1M12 2v1M4.929 4.929l.707.707M12 12v6",
    flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
    quake: "M22 12h-4l-3 9L9 3l-3 9H2",
    TC: "M21 4H3M18 8H6M19 12H9M16 16h-6M11 20H9",
    FL: "M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
    VO: "m8 3 4 8 5-5 5 15H2L8 3z",
    WF: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
    DR: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41",
    EQ: "M22 12h-4l-3 9L9 3l-3 9H2",
  };
  const svgIc = (d, cls) => {
    const NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"), path = document.createElementNS(NS, "path");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); if (cls) svg.setAttribute("class", cls);
    path.setAttribute("d", d); svg.append(path); return svg;
  };
  // 지도 그림: 경보 = 등급 색 동그라미 + 흰 종류 아이콘, 열원 = 불꽃(주황→빨강)
  function badgeImage(type, color) {
    const size = 40, c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d");
    g.beginPath(); g.arc(20, 20, 18, 0, Math.PI * 2); g.fillStyle = color; g.fill(); g.lineWidth = 2.5; g.strokeStyle = "#0b0f17"; g.stroke();
    g.translate(9, 9); g.scale(22 / 24, 22 / 24);
    g.strokeStyle = "#ffffff"; g.lineWidth = 2.4; g.lineCap = g.lineJoin = "round"; g.stroke(new Path2D(IC[type] || IC.siren));
    return g.getImageData(0, 0, size, size);
  }
  function flameImage() {
    const size = 32, c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d"), path = new Path2D(IC.flame);
    g.translate(3, 2); g.scale(26 / 24, 27 / 24);
    const grad = g.createLinearGradient(0, 2, 0, 22); grad.addColorStop(0, "#fde047"); grad.addColorStop(0.45, "#f97316"); grad.addColorStop(1, "#dc2626");
    g.fillStyle = grad; g.fill(path); g.lineWidth = 1.6; g.strokeStyle = "#3b0a0a"; g.lineJoin = "round"; g.stroke(path);
    return g.getImageData(0, 0, size, size);
  }
  const KINDS = ["quake", "alert", "heat"];
  const on = new Set(local.get("dzLayers", []).filter(k => KINDS.includes(k)));
  const data = { quake: null, alert: null, heat: null };   // 마지막으로 받은 GeoJSON
  let ctrlBox = null, timer = null, ready = false;
  const empty = () => ({ type: "FeatureCollection", features: [] });
  const pt = (lng, lat, props) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: props });

  // ── 자료 받기 ──
  async function fetchQuakes() {
    const since = new Date(Math.max(Date.now() - 30 * 86400e3, Date.parse(sinceIso()))).toISOString();
    const rows = await fetchRows(() => db.from("dz_quakes").select("id,mag,place,time,lat,lng,depth,alert,tsunami,url").gte("time", since).order("time", { ascending: false }).order("id"), 5000);
    return { type: "FeatureCollection", features: rows.map(r => pt(r.lng, r.lat, { ...r, alert: r.alert || "" })) };
  }
  // GDACS 경보를 보여 줄 기간(처음 나온 뒤 며칠): 오래가는 재난은 길게
  const ALERT_DAYS = { TC: 7, EQ: 7, WF: 7, FL: 21, VO: 21, DR: 60 };
  let liveAlerts = true;                               // dz_alerts 표가 없으면(SQL 실행 전) false → 예전 방식
  async function fetchAlerts() {
    if (liveAlerts) {
      const { data: rows, error } = await db.from("dz_alerts").select("id,type,level,name,country,title,severity,population,lat,lng,from_date,to_date,updated,url").limit(500);
      if (!error) return { type: "FeatureCollection", features: (rows || []).map(r => pt(r.lng, r.lat,
        { ...r, live: 1, time: r.from_date || r.updated, label: TX[LANG]?.types[r.type] || r.type, icon: `dz-t-${r.type}-${r.level}` })) };
      liveAlerts = false;
    }
    return fetchAlertsOld();
  }
  async function fetchAlertsOld() {                    // GDACS: 같은 사건(eventid)은 가장 높은 등급 하나만
    const since = new Date(Date.now() - Math.max(...Object.values(ALERT_DAYS)) * 86400e3).toISOString();
    const rows = await fetchRows(() => db.from("news").select("title,url,latitude,longitude,published_at").eq("source_name", "GDACS").gte("published_at", since).order("published_at", { ascending: false }), 3000);
    const rank = { Green: 1, Orange: 2, Red: 3 }, best = new Map();
    for (const r of rows) {
      if (typeof r.latitude !== "number" || typeof r.longitude !== "number") continue;
      const u = r.url || "", type = (u.match(/eventtype=(\w+)/i) || [])[1]?.toUpperCase() || "", id = (u.match(/eventid=(\d+)/i) || [])[1] || u;
      const level = (u.match(/alertlevel=(\w+)/i) || [])[1] || "Green";
      if (Date.parse(r.published_at) < Date.now() - (ALERT_DAYS[type] ?? 7) * 86400e3) continue;
      const k = `${type}|${id}`, prev = best.get(k);
      if (!prev || (rank[level] ?? 0) > (rank[prev.level] ?? 0)) best.set(k, { ...r, type, level });
    }
    return { type: "FeatureCollection", features: [...best.values()].map(r => pt(r.longitude, r.latitude,
      { title: r.title, url: r.url, time: r.published_at, type: r.type, level: r.level, label: TX[LANG]?.types[r.type] || r.type, icon: `dz-t-${r.type}-${r.level}` })) };
  }
  async function fetchHeat() {
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    const rows = await fetchRows(() => db.from("dz_hotspots").select("sat,acq,lat,lng,frp,daynight").gte("acq", since).order("acq", { ascending: false }).order("key"), 30000);
    return { type: "FeatureCollection", features: rows.map(r => pt(r.lng, r.lat, r)) };
  }
  const FETCH = { quake: fetchQuakes, alert: fetchAlerts, heat: fetchHeat };

  const seq = {};
  let lastAt = 0;
  async function refresh(kinds = [...on]) {
    if (!map || !ready) return;
    lastAt = Date.now();
    await Promise.all(kinds.filter(k => on.has(k)).map(async k => {
      const n = (seq[k] = (seq[k] || 0) + 1);
      try {
        const fc = await FETCH[k]();
        if (n !== seq[k]) return;                         // 그 사이 더 새 요청(기간 바꿈 등)이 있었으면 버림
        data[k] = fc;
        map.getSource(`dz-${k}`)?.setData(fc);
      } catch (e) { console.warn("disaster-layer", k, e); }     // 못 받아도 뉴스 지도는 그대로(버튼만 켜진 채 점 없음)
    }));
  }
  function show(k, vis) {
    for (const id of LAYERS[k]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis ? "visible" : "none");
  }

  // ── 지도 레이어 (뉴스 묶음 "clusters" 아래에 끼워서 뉴스 점을 가리지 않게) ──
  const LAYERS = { heat: ["dz-heat", "dz-heat-icon"], alert: ["dz-alert", "dz-alert-icon", "dz-alert-label"], quake: ["dz-quake"] };
  const QCOLOR = ["match", ["get", "alert"], "green", LEVEL.green, "yellow", LEVEL.yellow, "orange", LEVEL.orange, "red", LEVEL.red, "#e2e8f0"];
  const QSIZE = ["interpolate", ["linear"], ["get", "mag"], 2.5, 3, 4, 5, 5, 8, 6, 12, 7, 17, 8, 23];
  const BIG = [">=", ["get", "mag"], 4.5];
  const FRP = ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 0], 0, 0.85, 50, 1, 300, 1.35];   // 열이 셀수록 불꽃 크게
  function addLayers() {
    if (map.getSource("dz-quake")) return;
    const before = map.getLayer("clusters") ? "clusters" : undefined;
    map.addSource("dz-heat", { type: "geojson", data: data.heat || empty(), attribution: "NASA FIRMS" });
    map.addSource("dz-alert", { type: "geojson", data: data.alert || empty() });          // GDACS·USGS 출처 표기는 이미 지도 ⓘ에 있음
    map.addSource("dz-quake", { type: "geojson", data: data.quake || empty() });
    for (const ty of ["TC", "FL", "VO", "WF", "DR", "EQ"]) for (const [lv, col] of [["Green", LEVEL.green], ["Orange", LEVEL.orange], ["Red", LEVEL.red]])
      if (!map.hasImage(`dz-t-${ty}-${lv}`)) map.addImage(`dz-t-${ty}-${lv}`, badgeImage(ty, col), { pixelRatio: 2 });
    if (!map.hasImage("dz-flame")) map.addImage("dz-flame", flameImage(), { pixelRatio: 2 });
    map.addLayer({ id: "dz-heat", type: "circle", source: "dz-heat", maxzoom: 5, layout: { visibility: "none" }, paint: {
      "circle-color": HEAT, "circle-opacity": 0.85,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 1.6, 4, 2.4, 8, 4.5, 12, 7] } }, before);
    map.addLayer({ id: "dz-heat-icon", type: "symbol", source: "dz-heat", minzoom: 5, layout: { visibility: "none",       // 확대하면 불꽃 모양(열이 셀수록 크게)
      "icon-image": "dz-flame", "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-anchor": "bottom",
      "icon-size": ["interpolate", ["linear"], ["zoom"], 5, ["*", 0.8, FRP], 8, ["*", 1.05, FRP], 12, ["*", 1.4, FRP]] } }, before);   // 확대 공식은 맨 바깥에만 둘 수 있음
    map.addLayer({ id: "dz-alert", type: "circle", source: "dz-alert", layout: { visibility: "none" }, paint: {
      "circle-color": ["match", ["get", "level"], "Red", LEVEL.red, "Orange", LEVEL.orange, LEVEL.green], "circle-opacity": 0.12,
      "circle-stroke-color": ["match", ["get", "level"], "Red", LEVEL.red, "Orange", LEVEL.orange, LEVEL.green], "circle-stroke-width": 3,
      "circle-radius": ["match", ["get", "level"], "Red", 23, "Orange", 20, 17] } }, before);       // 같은 자리 뉴스 점(약 14px) 바깥으로
    map.addLayer({ id: "dz-alert-icon", type: "symbol", source: "dz-alert", layout: { visibility: "none",                  // 동그라미 위쪽에 종류 아이콘(가운데는 뉴스 점 자리)
      "icon-image": ["get", "icon"], "icon-size": 1.2, "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-anchor": "bottom",
      "icon-offset": ["match", ["get", "level"], "Red", ["literal", [0, -14]], "Orange", ["literal", [0, -12]], ["literal", [0, -10]]] } }, before);
    map.addLayer({ id: "dz-alert-label", type: "symbol", source: "dz-alert", minzoom: 2.5, layout: { visibility: "none",
      "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-offset": [0, 2.1], "text-anchor": "top", "text-allow-overlap": false },
      paint: { "text-color": "#ffffff", "text-halo-color": "#0b0f17", "text-halo-width": 2 } }, before);
    map.addLayer({ id: "dz-quake", type: "circle", source: "dz-quake", layout: { visibility: "none" }, paint: {
      // 규모 4.5 이상은 뉴스에도 같은 자리 점이 있어서(뉴스 수집기) 그 바깥에 보이는 고리로: 테두리 = 피해 예상 등급 색
      "circle-color": QCOLOR, "circle-opacity": ["case", BIG, 0.22, 0.85],
      "circle-stroke-color": ["case", BIG, QCOLOR, "#0b0f17"], "circle-stroke-width": ["case", BIG, 3, 1],
      "circle-radius": ["case", BIG, ["max", 17, QSIZE], QSIZE] } }, before);
    for (const k of on) show(k, true);
    if (!handlersOn) bindHandlers();
  }

  // ── 누르기: 뉴스 점이 있으면 뉴스가 먼저(기존 그대로), 없을 때만 재난 점 ──
  let handlersOn = false;
  const ids = () => KINDS.filter(k => on.has(k)).flatMap(k => LAYERS[k]).filter(id => !id.endsWith("-label") && map.getLayer(id));
  const box = (p, r) => [[p.x - r, p.y - r], [p.x + r, p.y + r]];
  function bindHandlers() {
    handlersOn = true;
    map.on("click", e => {
      if (!ids().length || map.queryRenderedFeatures(box(e.point, 10), { layers: ["clusters", "points"] }).length) return;
      const f = map.queryRenderedFeatures(box(e.point, 7), { layers: ids() })[0];
      if (!f) return;
      popup?.remove();
      popup = new maplibregl.Popup({ maxWidth: "300px", offset: 8, focusAfterOpen: false })
        .setLngLat(f.geometry.coordinates).setDOMContent(cardOf(f)).addTo(map);
    });
    map.on("mousemove", e => {
      if (ids().length && map.queryRenderedFeatures(box(e.point, 7), { layers: ids() }).length) map.getCanvas().style.cursor = "pointer";
    });
  }
  function link(href, text) {
    if (!/^https?:\/\//i.test(href || "")) return null;
    const a = el("a", "dz-link", text); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
    return a;
  }
  function cardOf(f) {
    const p = f.properties, c = el("div", "card dz-card"), lid = f.layer.id;
    const line = (k, v) => { const d = el("div", "dz-row"); d.append(el("span", "dz-k", k), el("span", null, v)); return d; };
    if (lid === "dz-alert-icon") return cardOf({ ...f, layer: { id: "dz-alert" } });
    if (lid === "dz-heat-icon") return cardOf({ ...f, layer: { id: "dz-heat" } });
    if (lid === "dz-quake") {
      const t = Date.parse(p.time);
      c.append(el("div", "title", `M ${(+p.mag).toFixed(1)} · ${tx("quake")}`), el("div", "where", `📍 ${p.place || ""}`),
        el("div", "meta", `${ago(t)} · ${kst(t)}`));
      if (p.depth != null && p.depth !== "") c.append(line(tx("depth"), `${Math.round(+p.depth)} km`));
      const pager = line(tx("pager"), p.alert ? tx("pagerV")[p.alert] : tx("noPager"));
      if (p.alert) { const dot = el("i", "dz-dot"); dot.style.background = LEVEL[p.alert]; pager.lastChild.prepend(dot); }
      c.append(pager);
      if (p.tsunami === true || p.tsunami === "true") c.append(el("div", "dz-note", `🌊 ${tx("tsunami")}`));
      c.append(...[link(p.url, tx("open"))].filter(Boolean), el("div", "dz-src", `${tx("src")}: USGS`));
    } else if (lid === "dz-alert") {
      const t = Date.parse(p.time), lv = line(tx("levelK"), `${tx("level")[p.level] || p.level}`);
      const dot = el("i", "dz-dot"); dot.style.background = LEVEL[(p.level || "green").toLowerCase()] || LEVEL.green; lv.lastChild.prepend(dot);
      const title = el("div", "title"); setText(title, p.title || "");
      if (p.live) {                                     // 진행 중 표(dz_alerts)
        const tf = Date.parse(p.from_date), tu = Date.parse(p.to_date || p.updated);
        c.append(el("div", "meta", `🚨 ${tx("ongoing")} · ${tx("types")[p.type] || p.type}${p.name ? ` ${p.name}` : ""}${Number.isFinite(tf) ? ` · ${tx("since")} ${kst(tf)}` : ""}`), title, lv);
        if (p.country) c.append(line(tx("where"), p.country));
        if (p.severity && !/^Magnitude 0\b/.test(p.severity)) c.append(line(tx("sevK"), p.severity));
        if (p.population && !/^0 deaths/.test(p.population)) c.append(line(tx("popK"), p.population));
        if (Number.isFinite(tu)) c.append(line(tx("lastSeen"), `${ago(tu)} · ${kst(tu)}`));
        c.append(el("div", "dz-note", tx("alertNote")), ...[link(p.url, tx("open"))].filter(Boolean), el("div", "dz-src", `${tx("src")}: Global Disaster Alert and Coordination System, GDACS`));
        return c;
      }
      c.append(el("div", "meta", `${tx("types")[p.type] || p.type} · ${tx("first")} ${ago(t)} · ${kst(t)}`), title, lv, el("div", "dz-note", tx("alertNote")),
        ...[link(p.url, tx("open"))].filter(Boolean), el("div", "dz-src", `${tx("src")}: Global Disaster Alert and Coordination System, GDACS`));
    } else {
      const t = Date.parse(p.acq), [lng, lat] = f.geometry.coordinates;
      const sat = { N20: "NOAA-20 (VIIRS)", N21: "NOAA-21 (VIIRS)" }[p.sat] || p.sat;
      c.append(el("div", "title", tx("heatTitle")), el("div", "meta", `${ago(t)} · ${kst(t)} · ${p.daynight === "N" ? tx("night") : tx("day")}`),
        el("div", "dz-note", tx("heatNote")));
      if (p.frp) c.append(line(tx("frp"), `${Math.round(+p.frp)} MW`));
      c.append(line(tx("sat"), sat),
        link(`https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;@${(+lng).toFixed(3)},${(+lat).toFixed(3)},9.0z`, tx("firmsMap")),
        el("div", "dz-src", `${tx("src")}: NASA FIRMS`));
    }
    return c;
  }

  // ── 켜고 끄기 버튼 (지도 오른쪽 위, 확대 버튼 아래) ──
  function renderCtrl() {
    if (!ctrlBox) return;
    ctrlBox.replaceChildren(...KINDS.map(k => {
      const b = el("button", `dz-btn dz-${k}`);
      b.type = "button"; b.title = tx(`${k}T`); b.setAttribute("aria-label", tx(`${k}T`)); b.setAttribute("aria-pressed", String(on.has(k)));
      b.append(svgIc({ quake: IC.quake, alert: IC.siren, heat: IC.flame }[k], "dz-ic"), el("span", null, tx(k)));
      b.addEventListener("click", () => toggle(k));
      return b;
    }));
  }
  function toggle(k) {
    on.has(k) ? on.delete(k) : on.add(k);
    local.set("dzLayers", [...on]);
    ctrlBox?.querySelector(`.dz-${k}`)?.setAttribute("aria-pressed", String(on.has(k)));
    if (!map) return;
    show(k, on.has(k));
    if (on.has(k)) refresh([k]);
    if (!on.size) { clearInterval(timer); timer = null; } else startTimer();
  }
  function startTimer() {
    if (timer) return;
    timer = setInterval(() => { if (document.visibilityState === "visible" && on.size) refresh(); }, 10 * 60e3);   // 켜져 있을 때만 10분마다
  }

  // ── 기존 함수 감싸기 ──
  const baseLayers = addNewsLayers;
  addNewsLayers = function () {
    baseLayers();
    try {
      addLayers();
      if (!ctrlBox) {
        map.addControl({ onAdd() { ctrlBox = el("div", "maplibregl-ctrl dz-ctrl"); renderCtrl(); return ctrlBox; }, onRemove() { ctrlBox?.remove(); } }, "top-right");
      }
      ready = true;
      if (on.size) { refresh(); startTimer(); }
    } catch (e) { console.warn("disaster-layer", e); }   // 문제가 생겨도 뉴스 지도는 그대로
  };
  const baseStatic = applyStatic;
  applyStatic = function () { baseStatic(); renderCtrl(); if (on.has("alert")) refresh(["alert"]); };   // 언어 바꾸면 버튼 글자·경보 이름도
  $("range").addEventListener("change", () => { if (on.has("quake")) refresh(["quake"]); });          // 지진은 뉴스 기간을 따름
  document.addEventListener("visibilitychange", () => {                                                // 휴대폰을 다시 켰을 때
    if (document.visibilityState === "visible" && on.size && Date.now() - lastAt > 10 * 60e3) refresh();
  });
  // 이 파일을 받는 사이에 지도가 먼저 만들어졌으면(느린 휴대폰 등) 지금 붙임 — 원래 함수는 뉴스 출처가 있으면 바로 끝남
  if (map?.getSource?.("news")) addNewsLayers();

  const css = document.createElement("style");
  css.textContent = `
.dz-ctrl { display: grid; gap: 4px; background: rgba(17,24,39,.92); border: 1px solid var(--line); border-radius: 10px; padding: 5px; }
.dz-btn { display: flex; align-items: center; gap: 6px; background: transparent; border: 1px solid var(--line); border-radius: 999px;
  padding: 4px 10px; font-size: 12px; color: var(--text); white-space: nowrap; cursor: pointer; }
.dz-btn[aria-pressed="false"] { opacity: .45; }
.dz-btn[aria-pressed="true"] { border-color: var(--accent); }
.dz-ic { width: 15px; height: 15px; flex: none; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.dz-quake .dz-ic { color: #e2e8f0; }
.dz-alert .dz-ic { color: #f97316; }
.dz-heat .dz-ic { color: #fb923c; fill: rgba(251,146,60,.35); }
.dz-btn[aria-pressed="true"].dz-alert .dz-ic { animation: dzSiren 1.6s ease-in-out infinite; }
@keyframes dzSiren { 0%, 100% { color: #f97316; } 50% { color: #ef4444; filter: drop-shadow(0 0 3px #ef4444); } }
@media (prefers-reduced-motion: reduce) { .dz-btn .dz-ic { animation: none !important; } }
.dz-card { gap: 4px; }
.dz-row { display: flex; gap: 8px; font-size: 12.5px; align-items: center; }
.dz-k { color: var(--muted); min-width: 64px; }
.dz-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
.dz-note { font-size: 12px; color: var(--muted); line-height: 1.45; }
.dz-link { font-size: 12.5px; color: var(--accent); }
.dz-src { font-size: 11px; color: var(--muted); }
@media (max-width: 767px) { .dz-btn { padding: 6px 10px; } }`;
  document.head.append(css);
})();
