// 호재뉴스 공통 규칙 (2026-11-27) — 화면 news-map/re-good-core.js 와 서버 supabase/functions/re-good/re-good-core.js 가 글자까지 같은 파일(test.mjs 가 검사).
// 고치면: 서버 것을 고치고 cp → `node supabase/functions/re-good/test.mjs` → 함수 다시 배포. 외부 부품 없음, Deno·Node·브라우저 모두.
// - goodTitle: 호재 제목 = 좋은 쪽 움직임 낱말(GOOD)이 있고 나쁜 낱말(BAD)이 없음 — 주제 낱말(재건축·GTX)만으로는 안 됨("재건축 급랭" "승강장서 쓰러진…"이 섞여서)
// - regions: re_news_days 줄 → 지역(시·구/시 열쇠)마다 호재 제목·주제별 수·점수(최근 7일 1.5배)
// - CLUSTERS: 세계 뉴스 산업(etf_theme_days 주제) → 그 산업 단지·기업이 있는 서울·경기 시·구(알려진 위치, 고정 목록 — 사용자 2026-11-27 "산업 단지 목록도 넓혀줘")
(function (g) {
  const DAY = 864e5;
  const kstDay = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
  const THEME = { transit: "교통", develop: "개발·산업", redevelop: "재건축·재개발", supply: "공급·분양" };
  const ICON = { transit: "🚇", develop: "🏗️", redevelop: "🏢", supply: "🏘️" };
  const BROAD = ["00000", "11000", "41000", "90000"];
  const GOOD = /개통|착공|첫삽|첫 삽|확정|승인|인가|지정|선정|유치|통과|신설|연장|조성|본격|탄력|속도|도입|협약|MOU|시공계약|시공사|분양 돌입|분양 개시|입주 시작|준공|투자 유치|대규모 투자|확충|완화|해제|청사진|마스터플랜|급행|복합개발|첫발|가시화|박차|확대|개발 계획|계획 발표|사업 추진|추진 본격|기공|예타 면제|예타 통과/;
  const BAD = /쓰러|사고|숨져|숨진|사망|부상|화재|폭행|범죄|추락|붕괴|지연|무산|취소|반대|중단|좌초|보류|철회|갈등|민원|부실|하락|미분양|소송|비리|압수수색|의혹|논란|우려|불발|발목|난항|표류|연기|실패|피해|침수|누수|소음|악취|게시판|부고|인사\]|급랭|안 팔|침체|위축|급락|규제 강화|점검|단속|부담|불안|경고|폭탄|재초환|과열|투기|집회|시위|하자|분쟁|적발|횡령/;
  const goodTitle = t => !!t && GOOD.test(t) && !BAD.test(t);
  // 산업 → 단지가 있는 곳. codes = 시·구 코드(화성은 2026 새 구 4곳을 묶어 "화성시"), why = 그 곳에 있는 것(널리 알려진 사실만)
  const CLUSTERS = [
    { id: "semis", themes: ["semis"], icon: "💾", label: "반도체", where: "반도체 생산 단지", places: [
      { name: "용인시 처인구", codes: ["41461"], why: "SK하이닉스 반도체 클러스터·삼성 국가산단" },
      { name: "용인시 기흥구", codes: ["41463"], why: "삼성전자 기흥캠퍼스" },
      { name: "화성시", codes: ["41591", "41593", "41595", "41597"], why: "삼성전자 화성캠퍼스" },
      { name: "평택시", codes: ["41220"], why: "삼성전자 평택캠퍼스" },
      { name: "이천시", codes: ["41500"], why: "SK하이닉스 이천캠퍼스" },
    ] },
    { id: "ai", themes: ["ai", "bigtech"], icon: "🤖", label: "AI·IT", where: "IT·AI 기업이 모인 곳", places: [
      { name: "성남시 분당구", codes: ["41135"], why: "판교 테크노밸리" },
      { name: "수원시 영통구", codes: ["41117"], why: "삼성 디지털시티·광교 테크노밸리" },
      { name: "서울 강남구", codes: ["11680"], why: "테헤란로 IT 기업" },
      { name: "서울 구로·금천", codes: ["11530", "11545"], why: "서울디지털산업단지(G밸리)" },
      { name: "과천시", codes: ["41290"], why: "과천 지식정보타운" },
    ] },
    { id: "bio", themes: ["bio"], icon: "🧬", label: "바이오", where: "바이오·연구 단지", places: [
      { name: "서울 강서구", codes: ["11500"], why: "마곡 R&D 단지(LG사이언스파크 등)" },
      { name: "성남시 분당구", codes: ["41135"], why: "판교 바이오 기업" },
      { name: "시흥시", codes: ["41390"], why: "배곧·월곶 바이오 특화 개발" },
    ] },
    { id: "auto", themes: ["auto", "ev", "battery"], icon: "🚗", label: "자동차·전기차", where: "자동차 공장·연구소", places: [
      { name: "화성시", codes: ["41591", "41593", "41595", "41597"], why: "기아 오토랜드 화성·현대차 남양연구소" },
      { name: "광명시", codes: ["41210"], why: "기아 오토랜드 광명" },
    ] },
    { id: "content", themes: ["game", "ent"], icon: "🎮", label: "게임·콘텐츠", where: "게임·방송 기업이 모인 곳", places: [
      { name: "성남시 분당구", codes: ["41135"], why: "판교 게임 기업" },
      { name: "서울 마포구", codes: ["11440"], why: "상암 디지털미디어시티(방송·콘텐츠)" },
    ] },
    { id: "finance", themes: ["bank", "broker"], icon: "💹", label: "금융", where: "금융 중심지", places: [
      { name: "서울 영등포구", codes: ["11560"], why: "여의도 금융가" },
      { name: "서울 중구", codes: ["11140"], why: "을지로·명동 금융가" },
    ] },
    { id: "defense", themes: ["defense", "space"], icon: "🛰️", label: "방산·우주", where: "방산 기업 연구소", places: [
      { name: "성남시 분당구", codes: ["41135"], why: "판교 방산 기업 연구개발 센터" },
    ] },
  ];
  /** 지역 열쇠 → 그 안의 시·구 코드(시 열쇠 41110 = 41111·41113…) */
  const codesOfKey = (k, allCodes) => (allCodes.includes(k) ? [k] : allCodes.filter(c => c.startsWith(k.slice(0, 4))));
  /** re_news_days 줄 → 지역마다 호재 묶음 */
  function regions(nd, { days = 30, now = Date.now() } = {}) {
    const since = kstDay(now - days * DAY), recent = kstDay(now - 7 * DAY), by = new Map();
    for (const r of nd) {
      if (!THEME[r.theme] || r.day < since) continue;
      const g2 = by.get(r.region) || by.set(r.region, { key: r.region, score: 0, counts: {}, items: [], seen: new Set() }).get(r.region);
      for (const t of r.top || []) {
        if (!t?.u || g2.seen.has(t.u) || !goodTitle(t.t)) continue;
        g2.seen.add(t.u);
        g2.items.push({ t: t.t, u: t.u, s: t.s || "", day: r.day, theme: r.theme });
        g2.counts[r.theme] = (g2.counts[r.theme] || 0) + 1;
        g2.score += r.day >= recent ? 1.5 : 1;
      }
    }
    return [...by.values()].filter(x => x.items.length).map(({ seen, ...x }) => ({ ...x, items: x.items.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)), main: Object.entries(x.counts).sort((a, b) => b[1] - a[1])[0][0] }));
  }
  /** 화면에 보일 지역 8곳(나라·서울·경기·지방 전체 소식 빼고) + 전체 소식 묶음 */
  function pick(groups, max = 8) {
    const local = groups.filter(x => !BROAD.includes(x.key)).sort((a, b) => b.score - a.score || b.items.length - a.items.length || (a.key < b.key ? -1 : 1)).slice(0, max);
    const broadItems = groups.filter(x => BROAD.includes(x.key) && x.key !== "90000").flatMap(x => x.items.map(i => ({ ...i, key: x.key }))).sort((a, b) => (a.day < b.day ? 1 : -1));
    return { local, broadItems };
  }
  /** etf_theme_days 줄 → 산업마다 최근 7일 기사 수, 그 전 기록이 14일 넘게 있으면 '평소의 N배' */
  function world(et, now = Date.now()) {
    const t7 = kstDay(now - 7 * DAY), t35 = kstDay(now - 35 * DAY);
    return CLUSTERS.map(c => {
      const ids = new Set(c.themes);
      let n7 = 0, before = 0; const bd = new Set();
      for (const r of et) { if (!ids.has(r.theme)) continue; if (r.day >= t7) n7 += r.n; else if (r.day >= t35) { before += r.n; bd.add(r.day); } }
      const ratio = bd.size >= 14 && before ? n7 / ((before / bd.size) * 7) : null;
      return { ...c, n7, ratio };
    }).filter(c => c.n7 > 0).sort((a, b) => (b.ratio ?? 1) * b.n7 - (a.ratio ?? 1) * a.n7);
  }
  const themeIds = () => [...new Set(CLUSTERS.flatMap(c => c.themes))];
  g.REGOOD_CORE = { VER: "1", DAY, kstDay, THEME, ICON, BROAD, GOOD, BAD, goodTitle, CLUSTERS, codesOfKey, regions, pick, world, themeIds };
})(globalThis);
