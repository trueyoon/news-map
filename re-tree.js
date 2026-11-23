// 부동산 [목록] 탭: 시 → 구 → 동 나무 목록 (2026-11-23 사용자 "동 단위로 해 놓으니 너무 많아 — 구로 묶고 누르면 밑에 동들, 시 → 구 → 동, 동을 누르면 지도가 따라가게")
// - 예전 "지도에 보이는 동"(거래 많은 150곳) 대신: 서울특별시 / 경기도의 시·군 → 구 → 동. 누르면 펼치고 접음(브라우저에 기억 reTreeOpen)
// - 시·구를 펼치면 지도가 그 지역으로, 동을 누르면 지도가 그 동으로 날아가고 노란 고리로 표시 + 그 동의 종류(아파트·빌라·오피스텔) 줄 → 누르면 단지·건물 목록(예전 그대로)
// - 숫자는 지금 범례에서 켠 종류만. "아파트 평당 약"은 동별 중간값을 거래 수로 가중한 평균(대략)
// - real-estate.html 수정 없음: re-impact.js 가 불러옴. renderList·pickSgg 를 감쌈(동 목록·겹친 점 목록·검색은 예전 그대로)
(() => {
  if (typeof renderList !== "function" || typeof dongs === "undefined") return;
  const store = { get: (k, d) => { try { return local.get(k, d); } catch { return d; } }, set: (k, v) => { try { local.set(k, v); } catch { /* 기억 못 해도 됨 */ } } };
  const open = new Set(store.get("reTreeOpen", []));
  let sortBy = store.get("reTreeSort", "name") === "trades" ? "trades" : "name", focus = null, sig = "";
  const saveOpen = () => store.set("reTreeOpen", [...open]);
  const list = $("list");
  const tree = el("div", "rt"); tree.hidden = true; list.after(tree);

  // ── 나무 만들기: 시(서울은 서울특별시 하나) → 구(없으면 바로 동) → 동(같은 이름의 종류들을 한 줄로) ──
  function cityOf(code) {
    const g = SGG[code]; if (!g) return null;
    if (g.sido === "서울") return { key: "c:서울", name: "서울특별시", sido: "서울", gu: g.name };
    const [city, gu] = g.name.split(" ");
    return { key: `c:${city}`, name: city, sido: "경기", gu: gu || null };
  }
  function build() {
    const cities = new Map();
    for (const d of dongs) {
      if (!shown.has(d.kind)) continue;
      const c = cityOf(d.sgg_cd); if (!c) continue;
      const city = cities.get(c.key) ?? cities.set(c.key, { key: c.key, name: c.name, sido: c.sido, gus: new Map(), dongs: new Map() }).get(c.key);
      let holder = city;
      if (c.gu) {
        const gk = `g:${d.sgg_cd}`;
        holder = city.gus.get(gk) ?? city.gus.set(gk, { key: gk, name: c.gu, code: d.sgg_cd, dongs: new Map() }).get(gk);
      }
      const dk = `d:${d.sgg_cd}:${d.umd_nm}`;
      const dong = holder.dongs.get(dk) ?? holder.dongs.set(dk, { key: dk, name: d.umd_nm, code: d.sgg_cd, items: [] }).get(dk);
      dong.items.push(d);
    }
    return cities;
  }
  // 묶음 숫자: 동 수·12개월 거래·아파트 평당(대략)
  function sum(items) {
    let t = 0, w = 0, pw = 0;
    for (const d of items) { t += d.trades_12m || 0; if (d.kind === "apt" && d.pyeong_12m && d.trades_12m) { w += d.trades_12m; pw += d.pyeong_12m * d.trades_12m; } }
    return { t, apt: w ? pw / w : null };
  }
  const allItems = node => node.gus ? [...node.dongs.values(), ...[...node.gus.values()].flatMap(g => [...g.dongs.values()])].flatMap(x => x.items) : [...node.dongs.values()].flatMap(x => x.items);
  const dongCount = node => node.dongs.size + (node.gus ? [...node.gus.values()].reduce((n, g) => n + g.dongs.size, 0) : 0);
  const order = (arr, tradesOf) => arr.sort((a, b) => sortBy === "trades" ? tradesOf(b) - tradesOf(a) || a.name.localeCompare(b.name, "ko") : a.name.localeCompare(b.name, "ko"));

  // ── 지도 따라가기 ──
  function fit(items, maxZoom) {
    if (!map || !items.length) return;
    const b = new maplibregl.LngLatBounds(); items.forEach(d => b.extend([d.lng, d.lat]));
    map.fitBounds(b, { padding: 40, maxZoom, duration: 900 });
  }
  function ring(dong) {
    if (!map) return;
    const lng = dong.items.reduce((s, d) => s + d.lng, 0) / dong.items.length, lat = dong.items.reduce((s, d) => s + d.lat, 0) / dong.items.length;
    const data = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: { n: dong.name } }] };
    try {                                                 // 지도 그림이 아직 준비 중이면 고리만 건너뜀(이동은 함)
      if (!map.getSource("rt-focus")) {
        map.addSource("rt-focus", { type: "geojson", data });
        map.addLayer({ id: "rt-focus", type: "circle", source: "rt-focus", paint: { "circle-radius": 24, "circle-color": "rgba(251,191,36,.12)", "circle-stroke-color": "#fbbf24", "circle-stroke-width": 3 } });
      } else map.getSource("rt-focus").setData(data);
    } catch (e) { console.warn("re-tree ring", e); }
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14), duration: 900 });
  }
  const clearRing = () => map?.getSource("rt-focus")?.setData({ type: "FeatureCollection", features: [] });

  // ── 그리기 ──
  const caret = (isOpen, leaf) => el("span", "rt-caret", leaf ? "•" : isOpen ? "▾" : "▸");
  function row(depth, key, name, sub, right, { leaf = false, onClick } = {}) {
    const b = el("button", `rt-row rt-d${depth}${focus === key ? " rt-focus" : ""}`); b.type = "button"; b.dataset.k = key;
    if (!leaf) b.setAttribute("aria-expanded", String(open.has(key)));
    const nm = el("div", "nm", name); if (sub) nm.append(el("small", null, sub));
    b.append(caret(open.has(key), leaf), nm, right);
    b.addEventListener("click", onClick);
    return b;
  }
  const num = (a, b2) => { const n = el("div", "num"); if (a) n.append(el("b", null, a)); if (b2) { if (a) n.append(el("br")); n.append(b2); } return n; };
  const toggle = (key, after) => { const now = !open.has(key); now ? open.add(key) : open.delete(key); saveOpen(); draw(true); if (now) after?.(); };

  function draw(force = false) {
    const s = [dongs.length, [...shown].join(), [...open].join("|"), sortBy, focus].join("~");
    if (!force && s === sig && !tree.hidden) return false;
    sig = s;
    const cities = build(), out = [];
    const head = $("listHead");
    const sortBtn = (v, t) => { const b = el("button", "rt-sort", t); b.type = "button"; b.setAttribute("aria-pressed", String(sortBy === v)); b.addEventListener("click", () => { sortBy = v; store.set("reTreeSort", v); draw(true); }); return b; };
    const fold = el("button", "rt-sort", "모두 접기"); fold.type = "button"; fold.addEventListener("click", () => { open.clear(); focus = null; saveOpen(); clearRing(); draw(true); });
    const tools = el("span", "rt-tools"); tools.append(sortBtn("name", "가나다순"), sortBtn("trades", "거래 많은 순"), fold);
    head.replaceChildren(el("b", null, "시 → 구 → 동"), el("span", "rt-hint", "누르면 펼쳐지고 지도가 따라가요"), tools);
    if (!dongs.length) { tree.replaceChildren(el("div", "rt-empty", "지도 자료 불러오는 중…")); return true; }
    for (const sido of ["서울", "경기"]) {
      const cs = order([...cities.values()].filter(c => c.sido === sido), c => sum(allItems(c)).t);
      if (!cs.length) continue;
      if (sido === "경기") out.push(el("h4", "rt-h", "경기도"));
      for (const c of cs) {
        const sm = sum(allItems(c));
        out.push(row(0, c.key, c.name, `${c.gus.size ? `구 ${c.gus.size}곳 · ` : ""}동 ${dongCount(c).toLocaleString()}곳`,
          num(sm.apt ? `아파트 평당 약 ${fmtShort(sm.apt)}` : "", `12개월 ${sm.t.toLocaleString()}건`),
          { onClick: () => toggle(c.key, () => fit(allItems(c), 11)) }));
        if (!open.has(c.key)) continue;
        for (const g of order([...c.gus.values()], g => sum([...g.dongs.values()].flatMap(x => x.items)).t)) {
          const items = [...g.dongs.values()].flatMap(x => x.items), gs = sum(items);
          out.push(row(1, g.key, g.name, `동 ${g.dongs.size.toLocaleString()}곳`, num(gs.apt ? `아파트 평당 약 ${fmtShort(gs.apt)}` : "", `12개월 ${gs.t.toLocaleString()}건`),
            { onClick: () => toggle(g.key, () => fit(items, 13)) }));
          if (open.has(g.key)) dongRows(g.dongs, 2, out);
        }
        dongRows(c.dongs, 1, out);
      }
    }
    tree.replaceChildren(...out);
    return true;
  }
  function dongRows(map_, depth, out) {
    for (const d of order([...map_.values()], x => sum(x.items).t)) {
      const ks = KINDS.filter(k => d.items.some(x => x.kind === k)), ds = sum(d.items);
      const apt = d.items.find(x => x.kind === "apt"), main = apt || [...d.items].sort((a, b) => b.trades_12m - a.trades_12m)[0];
      out.push(row(depth, d.key, d.name, ks.map(k => `${KIND[k].name} ${d.items.find(x => x.kind === k).places.toLocaleString()}`).join(" · ") + "곳",
        num(main?.pyeong_12m ? `${apt ? "아파트 " : ""}평당 ${fmtShort(main.pyeong_12m)}` : "", `12개월 ${ds.t.toLocaleString()}건`),
        { onClick: () => { const was = open.has(d.key); focus = d.key; was ? open.delete(d.key) : open.add(d.key); saveOpen(); draw(true); if (!was) ring(d); } }));
      if (!open.has(d.key)) continue;
      for (const x of KINDS.map(k => d.items.find(i => i.kind === k)).filter(Boolean)) {      // 종류 줄 → 단지·건물 목록(예전 동 목록)
        const b = el("button", `rt-row rt-d${depth + 1} rt-kind`); b.type = "button";
        const nm = el("div", "nm", `${KIND[x.kind].name} ${x.places.toLocaleString()}곳 목록`); nm.append(el("small", null, "단지·건물별 최근 거래"));
        b.append(kindIcon(x.kind, 16), nm, num(x.pyeong_12m ? `평당 ${fmtMan(x.pyeong_12m)}` : "–", `12개월 ${x.trades_12m.toLocaleString()}건`));
        b.addEventListener("click", () => openDong(x, true));
        out.push(b);
      }
    }
  }

  // ── 기존 함수 감싸기 ──
  const baseList = renderList;
  renderList = async function (...a) {
    if (listMode?.type === "view") {
      list.hidden = true; tree.hidden = false;
      if (draw() && focus) requestAnimationFrame(() => tree.querySelector(".rt-focus")?.scrollIntoView({ block: "nearest" }));
      return;
    }
    tree.hidden = true; list.hidden = false;
    const r = await baseList.apply(this, a);
    for (const b of $("listHead").querySelectorAll("button")) if (b.textContent === "← 지도에 보이는 동") b.textContent = "← 시·구·동 목록";
    return r;
  };
  // 검색에서 시·군·구를 고르면 나무에서 그 시·구를 펼치고 표시
  if (typeof pickSgg === "function") {
    const basePick = pickSgg;
    pickSgg = function (w, code, ...rest) {
      if (w === "list") { const c = cityOf(code); if (c) { open.add(c.key); if (c.gu) open.add(`g:${code}`); focus = c.gu ? `g:${code}` : c.key; saveOpen(); clearRing(); } }
      return basePick.call(this, w, code, ...rest);
    };
  }
  // 동 목록을 열면(지도 점·검색) 나무에서도 그 동을 표시해 둠 → 돌아오면 그 자리
  if (typeof openDong === "function") {
    const baseOpen = openDong;
    openDong = function (d, ...rest) {
      try { const c = d && cityOf(d.sgg_cd); if (c) { open.add(c.key); if (c.gu) open.add(`g:${d.sgg_cd}`); focus = `d:${d.sgg_cd}:${d.umd_nm}`; saveOpen(); clearRing(); } } catch { /* 표시만 */ }   // 동 말풍선이 자리를 알려 주므로 고리는 지움
      return baseOpen.call(this, d, ...rest);
    };
  }
  renderList();

  const css = document.createElement("style");
  css.textContent = `
.rt { display: block; }
.rt-h { margin: 0; padding: 12px 14px 6px; font-size: 12px; color: var(--muted); border-bottom: 1px solid var(--line); }
.rt-row { display: grid; grid-template-columns: 16px 1fr auto; gap: 4px 10px; align-items: center; width: 100%; text-align: left; background: none; border: 0;
  border-bottom: 1px solid var(--line); padding: 9px 14px; color: var(--text); cursor: pointer; font: inherit; }
.rt-row:hover { background: var(--panel-2); }
.rt-row .nm { font-size: 14px; font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
.rt-row .nm small { display: block; font-weight: 400; color: var(--muted); font-size: 12px; }
.rt-row .num { text-align: right; font-size: 12.5px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.rt-row .num b { color: var(--text); font-size: 13px; }
.rt-caret { color: var(--muted); font-size: 12px; text-align: center; }
.rt-d0 { font-size: 15px; } .rt-d0 .nm { font-size: 15px; }
.rt-d0[aria-expanded="true"] { background: var(--panel-2); }
.rt-d1 { padding-left: 30px; } .rt-d2 { padding-left: 46px; } .rt-d3 { padding-left: 62px; }
.rt-d2 .nm, .rt-d3 .nm { font-size: 13.5px; font-weight: 500; }
.rt-kind { grid-template-columns: auto 1fr auto; background: rgba(255,255,255,.02); }
.rt-kind .nm { font-size: 13px; }
.rt-focus { box-shadow: inset 3px 0 0 #fbbf24; background: rgba(251,191,36,.10); }
.rt-empty { padding: 16px 14px; color: var(--muted); font-size: 13px; }
#listHead .rt-hint { color: var(--muted); font-size: 12px; }
#listHead .rt-tools { display: inline-flex; gap: 4px; flex-wrap: wrap; margin-left: auto; }
#listHead .rt-sort { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); background: none; color: var(--muted); cursor: pointer; }
#listHead .rt-sort[aria-pressed="true"] { color: var(--text); border-color: var(--accent, #6366f1); }`;
  document.head.append(css);
})();
