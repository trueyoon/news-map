// 전세가율 (2026-10-10 사용자 요청, 3단계). 부동산 지도의 단지·건물 상세 카드 줄에 "전세가율" 카드를 붙임.
// - 전세가율 = 같은 단지·같은 전용면적 타입의 최근 12개월 "신규 전세 보증금 중간값 ÷ 매매가 중간값"
//   (갱신 계약은 5% 인상 상한이라 시세보다 낮아서 뺌. 신규/갱신 표시가 없는 1~3%도 뺌)
// - 둘 중 하나라도 3건 미만이면 숫자를 숨기고 "거래 부족". 계산에 쓴 기간·건수를 함께 보여 줌
// - 전세 자료: 표 re_rent_jeonse (국토교통부 전월세 실거래가, 수집기 re-data). 매매는 상세 화면이 이미 읽은 거래를 그대로 씀
// real-estate.html: 맨 아래 <script src="re-data.js"></script> + 상세 카드를 만든 직후 알려 주는 한 줄(re:detail)로 연결
(() => {
  const MIN = 3, MONTHS = 12;
  const cache = new Map();                              // 단지 열쇠 → Promise<신규 전세 줄들>
  const keyOf = p => `${p.kind}|${p.sgg_cd}|${p.umd_nm}|${p.place_key}`;
  // 계산 기간: 수집기가 원자료를 남기는 기간과 같게 — 한국 날짜로 11개월 전 달의 1일부터 (이번 달 포함 12개월). 전세·매매 둘 다 같은 날부터
  const since = () => { const d = new Date(Date.now() + 9 * 3600e3); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (MONTHS - 1), 1)).toISOString().slice(0, 10); };
  function rentsOf(p) {
    const k = keyOf(p);
    if (!cache.has(k)) {
      const page = from => {
        let q = db.from("re_rent_jeonse").select("deal_date,excl_area,deposit").eq("kind", p.kind).eq("sgg_cd", p.sgg_cd)
          .eq("place_key", p.place_key).eq("contract", "new").gte("deal_date", since());
        if (p.kind !== "apt") q = q.eq("umd_nm", p.umd_nm);   // 빌라·오피스텔의 열쇠(지번)는 동마다 겹칠 수 있음
        return q.order("deal_date").order("rent_key").range(from, from + 999);
      };
      cache.set(k, (async () => {                         // 서버는 한 번에 1,000줄까지 → 나눠 받음(큰 새 단지도 빠짐없이, 최대 5천 줄)
        const rows = [];
        for (let from = 0; from < 5000; from += 1000) {
          const r = await page(from);
          if (r.error) throw r.error;
          rows.push(...r.data);
          if (r.data.length < 1000) break;
        }
        return rows;
      })());
      cache.get(k).catch(() => cache.delete(k));        // 실패하면 다음에 다시
    }
    return cache.get(k);
  }
  const ym = d => `${d.slice(0, 4)}.${d.slice(5, 7)}`;
  function card(label, value, sub) {
    const t = el("article", "tile"), v = el("div", "val");
    v.append(value);
    t.append(el("div", "lbl", label), v);
    if (sub) t.append(el("div", "dlt", sub));
    return t;
  }

  document.addEventListener("re:detail", async e => {
    const { p, sel, live, tiles } = e.detail || {};
    if (!p || !tiles) return;
    const label = `전세가율 (신규 전세 ÷ 매매, ${MONTHS}개월)`;
    if (!sel) { tiles.append(card(label, "–", "면적 타입을 고르면 계산해요")); return; }
    const slot = card(label, "…", "불러오는 중");
    tiles.append(slot);
    const my = detailSeq;
    try {
      const rows = await rentsOf(p);
      if (my !== detailSeq || !slot.isConnected) return;  // 그새 다른 단지·타입으로 바뀜
      const cut = since();                                  // 전세·매매 같은 기간
      const rents = rows.filter(r => inType(r, sel) && r.deal_date >= cut);
      const sales = live.filter(r => inType(r, sel) && r.deal_date >= cut);
      const rentMed = median(rents.map(r => r.deposit)), saleMed = median(sales.map(r => r.price));
      const dates = [...rents, ...sales].map(r => r.deal_date).sort();
      const span = dates.length ? `${ym(dates[0])}~${ym(dates.at(-1))}` : "";
      let next;
      if (rents.length < MIN || sales.length < MIN)
        next = card(label, "거래 부족", `신규 전세 ${rents.length}건 · 매매 ${sales.length}건 (각 ${MIN}건 이상일 때만 계산)`);
      else
        next = card(label, `${((rentMed / saleMed) * 100).toFixed(1)}%`,
          `전세 중간값 ${fmtWon(Math.round(rentMed))} (${rents.length}건) · 매매 중간값 ${fmtWon(Math.round(saleMed))} (${sales.length}건) · ${span}`);
      next.title = "출처: 국토교통부 전월세·매매 실거래가. 같은 단지·같은 면적 타입의 최근 12개월 신규 전세 보증금 중간값 ÷ 매매가 중간값. 갱신 계약은 뺌";
      slot.replaceWith(next);
    } catch (err) {
      console.warn("re-data", err);
      if (slot.isConnected) slot.replaceWith(card(label, "–", "불러오지 못했어요"));
    }
  });
})();
