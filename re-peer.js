// 📍 동네 대비 가격 · 층별 차이 · 비슷한 단지 (사용자 2026-11-25 "2번 이어서" — 부동산 아이디어 2차 ②)
// - re-impact.js 가 불러옴(real-estate.html 수정 없음). 단지·건물 상세 화면(re:detail 알림)의 숫자 카드 아래(전세 위험 체크 다음)에 한 칸
// - ① 동네 대비: 이 단지의 최근 12개월 3.3㎡당(re_places.pyeong_12m) vs 같은 동·같은 시·구·비슷한 연식(±5년, 같은 시·구) 단지들의 중간값 + 시·구 안 순위
//      (거래 3건 이상인 같은 종류만. 단지 전체 크기가 섞인 값이라 큰 평형이 많은 단지는 높게 나올 수 있음)
// - ② 층별 차이: 최근 2년 거래를 같은 크기(전용면적 반올림)끼리 중간값으로 나눈 뒤(크기 섞임 없앰), 저층(1~3층) vs 그 위 층 비교
// - ③ 비슷한 단지 5곳: 가까운 동(동 중심 4km 안) · 같은 종류 · 연식 ±7년 · 거래 3건 이상 중 거리·3.3㎡당·연식이 가까운 순 — 더 싸면 "더 쌈 −12%".
//      누르면 상세, [🏠 집 비교에 담기](re-homecmp.js 의 REHOMECMP.toggle). 위치는 동 단위라 거리도 동 사이 거리(대략)
(() => {
  if (typeof db === "undefined" || typeof el !== "function" || typeof SGG === "undefined" || typeof KIND === "undefined") return;
  const PY = 3.3058;
  const won = v => (v == null || !Number.isFinite(v) ? "–" : typeof fmtMan === "function" ? fmtMan(Math.round(v)) : `${Math.round(v).toLocaleString()}만`);
  const pc = (v, d = 0) => (v == null || !Number.isFinite(v) ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`);
  const med = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  /** 거래 수로 가중한 중간값(작은 나홀로 단지 여럿이 큰 단지 하나와 같은 무게가 되지 않게) */
  const wmed = xs => { const s = xs.filter(x => x.v != null && x.w > 0).sort((a, b) => a.v - b.v), tot = s.reduce((t, x) => t + x.w, 0); let acc = 0; for (const x of s) { acc += x.w; if (acc >= tot / 2) return x.v; } return null; };
  const isoAgo = days => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const COLS = "kind,sgg_cd,umd_nm,place_key,name,build_year,trades,trades_12m,last_date,last_price,last_area,pyeong_12m";
  const dongXY = (kind, sgg, umd) => { const d = (typeof dongs !== "undefined" ? dongs : []).find(x => x.kind === kind && x.sgg_cd === sgg && x.umd_nm === umd) || (typeof dongs !== "undefined" ? dongs : []).find(x => x.sgg_cd === sgg && x.umd_nm === umd); return d ? [d.x ?? d.lng, d.y ?? d.lat] : null; };
  const km = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const nameOf = p => (p.kind === "apt" ? p.name || p.place_key : p.name && !String(p.name).startsWith("(") ? p.name : `${p.place_key}번지`);
  const sggName = c => `${SGG[c]?.sido === "서울" ? "서울 " : ""}${SGG[c]?.name || c}`;

  // 시·구 × 종류 단지 목록(10분 기억) — 거래 3건 이상·3.3㎡당 있는 곳만
  const cache = new Map();
  function placesIn(kind, codes) {
    const k = `${kind}|${codes.join(",")}`, c = cache.get(k);
    if (c && Date.now() - c.at < 10 * 60e3) return c.p;
    const p = (async () => {
      const out = [];
      for (let off = 0; off < 6000; off += 1000) {
        const { data, error } = await db.from("re_places").select(COLS).eq("kind", kind).in("sgg_cd", codes).gte("trades_12m", 3).not("pyeong_12m", "is", null).order("place_key").range(off, off + 999);
        if (error) throw error;
        out.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      return out;
    })();
    cache.set(k, { at: Date.now(), p }); p.catch(() => cache.delete(k));
    return p;
  }

  let seq = 0;
  document.addEventListener("re:detail", async e => {
    const { p, live, tiles } = e.detail || {};
    if (!p?.place_key || !tiles) return;
    const my = ++seq;
    const box = el("section", "panel rp"); box.append(el("div", "rp-h", "📍 동네 대비 가격 · 비슷한 단지"), el("p", "rp-note", "불러오는 중…"));
    const after = tiles.nextElementSibling?.classList.contains("jr") ? tiles.nextElementSibling : tiles;
    after.after(box);
    try {
      const here = dongXY(p.kind, p.sgg_cd, p.umd_nm);
      // 가까운 시·구: 이 동에서 4km 안 동이 있는 시·구
      const near = new Set([p.sgg_cd]);
      if (here && typeof dongs !== "undefined") for (const d of dongs) { if (d.kind !== p.kind) continue; const xy = [d.x ?? d.lng, d.y ?? d.lat]; if (xy[0] != null && km(here, xy) <= 4) near.add(d.sgg_cd); }
      const [all, me, bld] = await Promise.all([
        placesIn(p.kind, [...near].sort()),
        db.from("re_places").select(COLS).eq("kind", p.kind).eq("sgg_cd", p.sgg_cd).eq("umd_nm", p.umd_nm).eq("place_key", p.place_key).maybeSingle().then(r => r.data, () => null),
        db.from("re_buildings").select("max_floor").eq("kind", p.kind).eq("sgg_cd", p.sgg_cd).eq("umd_nm", p.umd_nm).eq("place_key", p.place_key).maybeSingle().then(r => r.data, () => null)]);
      if (my !== seq || !box.isConnected) return;
      draw(box, { p: { ...p, ...(me || {}) }, all, here, live: live || [], maxFloor: bld?.max_floor || null });
    } catch (err) {
      console.warn("re-peer", err);
      if (box.isConnected) box.replaceChildren(el("div", "rp-h", "📍 동네 대비 가격 · 비슷한 단지"), el("p", "rp-note", "불러오지 못했어요. 잠시 뒤 다시 열어 주세요."));
    }
  });

  function draw(box, { p, all, here, live, maxFloor }) {
    const parts = [el("div", "rp-h", "📍 동네 대비 가격 · 비슷한 단지")];
    const kname = KIND[p.kind]?.name || "";
    const mine = p.pyeong_12m;
    const others = all.filter(x => !(x.sgg_cd === p.sgg_cd && x.umd_nm === p.umd_nm && x.place_key === p.place_key));
    // ① 동네 대비
    if (mine) {
      const inSgg = others.filter(x => x.sgg_cd === p.sgg_cd), inDong = inSgg.filter(x => x.umd_nm === p.umd_nm);
      const yr = p.build_year, sameAge = yr ? inSgg.filter(x => x.build_year && Math.abs(x.build_year - yr) <= 5) : [];
      const rows = [];
      const cmp = (label, xs, min) => { if (xs.length < min) return; const m = wmed(xs.map(x => ({ v: x.pyeong_12m, w: x.trades_12m }))); rows.push([label, m, (mine / m - 1) * 100, xs.length, xs.reduce((t, x) => t + x.trades_12m, 0)]); };
      cmp(`같은 동(${p.umd_nm}) ${kname}`, inDong, 2);
      cmp(`${sggName(p.sgg_cd)} ${kname}`, inSgg, 3);
      if (yr) cmp(`${sggName(p.sgg_cd)}의 비슷한 연식(${yr - 5}~${Math.min(yr + 5, new Date().getFullYear())}년)`, sameAge, 3);
      const big = inSgg.filter(x => x.trades_12m >= 10), rank = big.length >= 5 ? (big.filter(x => x.pyeong_12m > mine).length + 1) / (big.length + 1) * 100 : null;   // 순위는 12개월 10건 이상 거래된 곳끼리
      const head = el("div", "rp-big");
      head.append(el("span", null, `이 ${p.kind === "apt" ? "단지" : "건물"} 3.3㎡당 `), el("b", null, won(mine)), el("small", null, " (최근 12개월, 모든 크기)"));
      if (rank != null) head.append(el("span", `rp-rank ${rank <= 30 ? "hi" : rank >= 70 ? "lo" : ""}`, ` · ${sggName(p.sgg_cd)}에서 거래 많은 ${kname} ${big.length + 1}곳 중 비싼 쪽 상위 ${Math.max(1, Math.round(rank))}%`));
      const t = el("table", "rp-t");
      for (const [label, m, d, n, nTr] of rows) {
        const tr = el("tr");
        tr.append(el("th", null, label), el("td", null, won(m)), el("td", `rp-d ${d > 3 ? "up" : d < -3 ? "down" : ""}`, Math.abs(d) <= 3 ? "비슷" : `이 집이 ${Math.abs(d).toFixed(0)}% ${d > 0 ? "비쌈" : "쌈"}`), el("td", "rp-n", `${n}곳 · 거래 ${nTr.toLocaleString()}건`));
        t.append(tr);
      }
      parts.push(head);
      if (rows.length) parts.push(t);
      parts.push(el("p", "rp-note", "비교 값 = 그 범위 단지들의 최근 12개월 3.3㎡당(모든 크기)을 거래 수로 가중한 중간값 — 거래 많은 큰 단지가 더 크게 반영돼요. 거래 3건 이상인 곳만. 큰 평형·새 건물이 많은 단지는 높게 나올 수 있어요."));
    } else parts.push(el("p", "rp-note", "최근 12개월 거래가 적어 동네와 비교할 3.3㎡당 값이 없어요."));
    // ② 층별 차이
    {
      const d2 = isoAgo(730);
      const rs = live.filter(t => t.deal_date >= d2 && t.floor != null && Number(t.excl_area) > 0 && t.price > 0);
      const by = new Map();
      for (const t of rs) { const a = Math.round(Number(t.excl_area)); (by.get(a) || by.set(a, []).get(a)).push(t); }
      const rel = [];
      for (const xs of by.values()) { if (xs.length < 4) continue; const m = med(xs.map(t => t.price)); for (const t of xs) rel.push({ f: t.floor, r: t.price / m }); }
      const top = maxFloor || Math.max(0, ...rs.map(t => t.floor));
      const low = rel.filter(x => x.f >= 1 && x.f <= 3), upper = rel.filter(x => x.f > 3), high = top >= 9 ? rel.filter(x => x.f >= Math.ceil(top * 2 / 3)) : [];
      if (top >= 5 && low.length >= 3 && upper.length >= 3) {
        const dLow = (med(low.map(x => x.r)) / med(upper.map(x => x.r)) - 1) * 100;
        const s = el("div", "rp-floor");
        s.append(el("b", null, "🏢 층별 차이 "), el("span", dLow < 0 ? "down" : "up", `저층(1~3층)은 4층 이상보다 ${dLow < 0 ? `${Math.abs(dLow).toFixed(1)}% 싸게` : `${dLow.toFixed(1)}% 비싸게`}`));
        if (high.length >= 3) { const dHigh = (med(high.map(x => x.r)) / med(upper.map(x => x.r)) - 1) * 100; s.append(el("span", null, ` · 고층(${Math.ceil(top * 2 / 3)}층 이상)은 ${pc(dHigh, 1)}`)); }
        s.append(el("small", null, ` 팔렸어요 (최근 2년, 같은 크기끼리 비교, 저층 ${low.length}건 · 4층 이상 ${upper.length}건)`));
        parts.push(s);
      } else if (top >= 5) parts.push(el("p", "rp-note", "🏢 층별 차이: 최근 2년 저층·그 위 층 거래가 3건씩 안 돼서 비교하지 않았어요."));
    }
    // ③ 비슷한 단지
    if (mine && here) {
      const yr = p.build_year;
      const cand = others.map(x => { const xy = dongXY(x.kind, x.sgg_cd, x.umd_nm); return { x, dist: xy ? km(here, xy) : null }; })
        .filter(c => c.dist != null && c.dist <= 4 && (!yr || !c.x.build_year || Math.abs(c.x.build_year - yr) <= 7) && Math.abs(c.x.pyeong_12m / mine - 1) <= 0.35);
      for (const c of cand) c.score = c.dist / 4 + Math.abs(c.x.pyeong_12m / mine - 1) * 2 + (yr && c.x.build_year ? Math.abs(c.x.build_year - yr) / 14 : 0.3) - Math.min(c.x.trades_12m, 60) / 300;
      cand.sort((a, b) => a.score - b.score);
      const pick = cand.slice(0, 5);
      const cheaper = cand.filter(c => c.x.pyeong_12m < mine * 0.95 && !pick.includes(c)).sort((a, b) => a.score - b.score).slice(0, 2);
      const list = [...pick, ...cheaper];
      if (list.length) {
        parts.push(el("div", "rp-sub", `🔎 비슷한 ${p.kind === "apt" ? "단지" : "건물"} (동 중심 4km 안 · 연식 ±7년 · 3.3㎡당 ±35%)`));
        const ul = el("div", "rp-list");
        for (const { x, dist } of list) {
          const d = (x.pyeong_12m / mine - 1) * 100;
          const row = el("div", "rp-row");
          const nm = el("button", "rp-nm", nameOf(x)); nm.type = "button"; nm.title = "상세 열기";
          nm.addEventListener("click", () => openPlace(x));
          const meta = el("small", null, `${x.sgg_cd === p.sgg_cd ? "" : `${sggName(x.sgg_cd)} `}${x.umd_nm} · 약 ${dist < 1 ? "1km 안" : `${dist.toFixed(1)}km`}${x.build_year ? ` · ${x.build_year}년` : ""} · 12개월 ${x.trades_12m}건`);
          const left = el("div", "rp-l"); left.append(nm, meta);
          const right = el("div", "rp-r");
          right.append(el("b", null, won(x.pyeong_12m)), el("small", `rp-tag ${d < -5 ? "cheap" : d > 5 ? "dear" : ""}`, Math.abs(d) <= 5 ? "비슷" : d < 0 ? `더 쌈 ${pc(d)}` : `더 비쌈 ${pc(d)}`));
          if (globalThis.REHOMECMP?.toggle) {
            const inL = () => (REHOMECMP.list || []).some(y => y.kind === x.kind && y.sgg_cd === x.sgg_cd && y.umd_nm === x.umd_nm && y.place_key === x.place_key);
            const b = el("button", "rp-add"); b.type = "button";
            const sync = () => { b.textContent = inL() ? "🏠 담음" : "🏠 집 비교에 담기"; b.classList.toggle("on", inL()); };
            b.addEventListener("click", () => { REHOMECMP.toggle(x); sync(); });
            sync(); right.append(b);
          }
          row.append(left, right); ul.append(row);
        }
        parts.push(ul);
        if (globalThis.REHOMECMP?.toggle) {
          const meIn = (REHOMECMP.list || []).some(y => y.kind === p.kind && y.sgg_cd === p.sgg_cd && y.umd_nm === p.umd_nm && y.place_key === p.place_key);
          if (!meIn) { const b = el("button", "rp-link", "이 집도 집 비교에 담기 →"); b.type = "button"; b.addEventListener("click", () => { REHOMECMP.toggle(p); b.remove(); }); parts.push(b); }
        }
        parts.push(el("p", "rp-note", "가까운 순·값·연식이 비슷한 순으로 골랐어요(아래 '더 쌈'은 덤). 위치는 동 단위라 실제 거리와 다를 수 있어요. 학군·역 거리·상태는 반영되지 않아요."));
      } else parts.push(el("p", "rp-note", "🔎 근처에 조건이 비슷한 단지가 없어요."));
    }
    box.replaceChildren(...parts);
  }

  const css = document.createElement("style");
  css.textContent = `
.panel.rp { display: grid; gap: 6px; border: 1px solid var(--line); border-left: 4px solid #3b82f6; border-radius: 10px; padding: 10px 12px; margin: 8px 0; }
.rp-h { font-weight: 800; font-size: 15px; } .rp-sub { font-weight: 800; font-size: 13px; margin-top: 4px; }
.rp-note { font-size: 11.5px; color: var(--muted); margin: 0; line-height: 1.5; }
.rp-big { font-size: 13px; } .rp-big b { font-size: 17px; } .rp-big small { color: var(--muted); }
.rp-rank { font-weight: 700; } .rp-rank.hi { color: var(--up, #ef4444); } .rp-rank.lo { color: var(--down, #3b82f6); }
.rp-t { border-collapse: collapse; font-size: 12.5px; width: 100%; }
.rp-t th, .rp-t td { border-bottom: 1px solid var(--line); padding: 3px 6px; text-align: left; } .rp-t th { color: var(--muted); font-weight: 600; }
.rp-d.up { color: var(--up, #ef4444); font-weight: 700; } .rp-d.down { color: var(--down, #3b82f6); font-weight: 700; } .rp-n { color: var(--muted); font-size: 11px; }
.rp-floor { font-size: 12.5px; line-height: 1.5; } .rp-floor small { color: var(--muted); } .rp-floor .down { color: var(--down, #3b82f6); font-weight: 700; } .rp-floor .up { color: var(--up, #ef4444); font-weight: 700; }
.rp-list { display: grid; gap: 2px; }
.rp-row { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 4px 2px; border-bottom: 1px solid var(--line); }
.rp-l { display: grid; min-width: 0; } .rp-l small { color: var(--muted); font-size: 11px; }
.rp-nm { font: inherit; font-weight: 800; font-size: 13px; background: none; border: 0; padding: 0; color: var(--text); cursor: pointer; text-align: left; } .rp-nm:hover { text-decoration: underline; }
.rp-r { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; white-space: nowrap; }
.rp-tag { font-size: 11px; color: var(--muted); } .rp-tag.cheap { color: #22c55e; font-weight: 700; } .rp-tag.dear { color: #f59e0b; }
.rp-add { font: inherit; font-size: 11px; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--muted); cursor: pointer; } .rp-add.on { border-color: #22c55e; color: #22c55e; }
.rp-link { justify-self: start; font: inherit; font-size: 12px; font-weight: 700; background: none; border: 0; padding: 0; color: var(--accent, #6366f1); cursor: pointer; }`;
  document.head.append(css);
})();
