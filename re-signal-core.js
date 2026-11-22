// 부동산 뉴스 신호 규칙 (2026-11-23 사용자 요청 "뉴스 → 부동산 영향, AI 예측" 1단계) — 화면·서버(re-impact 함수, 글자까지 같은 복사본)·Node 시험 공통. 외부 부품 없음.
// 하는 일: 뉴스 한 건 → { regions: [지역 열쇠…], theme: 주제 } 또는 null
//   지역 열쇠: 서울 구·경기 시군구 5자리(우리 부동산 자료 72곳), 구가 있는 경기 시는 시 열쇠(수원 41110·성남 41130·안양 41170·부천 41190·안산 41270·고양 41280·용인 41460·화성 41590),
//             "11000" 서울 전체 · "41000" 경기 전체 · "00000" 전국(지역 없이 한국 부동산 소식) · "90000" 수도권 밖 지방(인천 포함 — 우리 자료 밖)
//   찾는 순서: ① 제목에 나온 지역·동네 이름(분당·판교·동탄·잠실·목동…) ② 기사 장소(location_name — "서울 여의도"·"서울 청와대" 같은 기관 자리는 서울 전체로)
//   주제(THEMES): market 시장 · supply 공급·분양 · redevelop 재건축·재개발 · transit 교통 호재 · develop 개발·산업 · rule 규제·세금 · rate 금리·대출 · risk 위험(전세사기·PF 등)
// ⚠️ 정규식에 (?<= (?<! 쓰지 말 것(옛 아이폰에서 파일 전체 멈춤) — 앞 글자 검사는 손으로(before).
(function (g) {
  // ── 지역 ──
  const SEOUL = [["11110", "종로"], ["11140", null], ["11170", "용산"], ["11200", "성동"], ["11215", "광진"], ["11230", "동대문"], ["11260", "중랑"], ["11290", "성북"],
    ["11305", null], ["11320", "도봉"], ["11350", "노원"], ["11380", "은평"], ["11410", "서대문"], ["11440", "마포"], ["11470", "양천"], ["11500", null], ["11530", "구로"],
    ["11545", "금천"], ["11560", "영등포"], ["11590", "동작"], ["11620", "관악"], ["11650", "서초"], ["11680", "강남"], ["11710", "송파"], ["11740", "강동"]];
  const SEOUL_FULL = { "11110": "종로구", "11140": "중구", "11170": "용산구", "11200": "성동구", "11215": "광진구", "11230": "동대문구", "11260": "중랑구", "11290": "성북구",
    "11305": "강북구", "11320": "도봉구", "11350": "노원구", "11380": "은평구", "11410": "서대문구", "11440": "마포구", "11470": "양천구", "11500": "강서구", "11530": "구로구",
    "11545": "금천구", "11560": "영등포구", "11590": "동작구", "11620": "관악구", "11650": "서초구", "11680": "강남구", "11710": "송파구", "11740": "강동구" };
  // 경기 시·군 (이름 → 열쇠). 광주는 광주광역시와 헷갈려 "경기 광주"·"광주시"(경기와 함께)만
  const GG = { 수원: "41110", 성남: "41130", 의정부: "41150", 안양: "41170", 부천: "41190", 광명: "41210", 평택: "41220", 동두천: "41250", 안산: "41270", 고양: "41280",
    과천: "41290", 구리: "41310", 남양주: "41360", 오산: "41370", 시흥: "41390", 군포: "41410", 의왕: "41430", 하남: "41450", 용인: "41460", 파주: "41480", 이천: "41500",
    안성: "41550", 김포: "41570", 화성: "41590", 양주: "41630", 포천: "41650", 여주: "41670", 연천: "41800", 가평: "41820", 양평: "41830" };
  // 구 이름(경기) — 시 열쇠보다 자세히
  const GG_GU = { 장안구: "41111", 권선구: "41113", 팔달구: "41115", 영통구: "41117", 수정구: "41131", 중원구: "41133", 분당구: "41135", 만안구: "41171", 동안구: "41173",
    원미구: "41192", 소사구: "41194", 오정구: "41196", 상록구: "41271", 단원구: "41273", 덕양구: "41281", 일산동구: "41285", 일산서구: "41287",
    처인구: "41461", 기흥구: "41463", 수지구: "41465", 만세구: "41591", 효행구: "41593", 병점구: "41595", 동탄구: "41597" };
  // 부동산 기사에 자주 나오는 동네·단지 이름 → 지역
  const PLACES = { 압구정: "11680", 대치: "11680", 개포: "11680", 청담: "11680", 은마: "11680", 반포: "11650", 잠원: "11650", 방배: "11650", 잠실: "11710", 가락: "11710", 문정: "11710",
    위례: "11710", 둔촌: "11740", 고덕: "11740", 목동: "11470", 여의도: "11560", 성수: "11200", 한남: "11170", 이촌: "11170", 흑석: "11590", 노량진: "11590", 상계: "11350",
    신림: "11620", 마곡: "11500", 가양: "11500", 화곡: "11500", 미아: "11305", 수유: "11305", 상암: "11440", 아현: "11440", 공덕: "11440", 왕십리: "11200", 신당: "11140", 장위: "11290",
    분당: "41135", 판교: "41135", 일산: "41280", 동탄: "41597", 광교: "41117", 평촌: "41173", 산본: "41410", 다산신도시: "41360", 별내: "41360", 왕숙: "41360", 운정: "41480",
    교산: "41450", 미사: "41450", 창릉: "41281", 대장지구: "41190", 수지: "41465", 기흥: "41463", 처인: "41461", 영통: "41117", 중동신도시: "41192", 고덕국제신도시: "41220" };
  const before = (s, i) => (i > 0 ? s[i - 1] : "");
  const HANGUL = /[가-힣A-Za-z]/;
  // 이름이 제목에 "따로" 나왔는지: 앞이 한글·영문이면 다른 낱말의 일부(남양주 속 양주, 회사 이름 HS화성 등)
  function findName(t, name) {
    let i = t.indexOf(name);
    while (i >= 0) { if (!HANGUL.test(before(t, i))) return true; i = t.indexOf(name, i + 1); }
    return false;
  }
  function regionsInTitle(t) {
    const out = new Set();
    for (const [code, short] of SEOUL) {
      if (code === "11140" || code === "11500") continue;                                  // 중구·강서구는 다른 도시에도 있어 "서울 중구"일 때만(아래)
      if (findName(t, SEOUL_FULL[code])) out.add(code);
      else if (short && findName(t, short) && !/강남(?:권|3구|4구|역|대로|스타일)/.test(t.slice(t.indexOf(short)))) out.add(code);
    }
    if (/서울\s?(?:시\s?)?중구/.test(t)) out.add("11140");
    if (/서울\s?(?:시\s?)?강서/.test(t)) out.add("11500");
    for (const [name, code] of Object.entries(GG_GU)) if (findName(t, name)) out.add(code);
    for (const [name, code] of Object.entries(GG)) if (findName(t, name)) out.add(code);
    if (/경기\s?광주|광주시 [가-힣]*(?:동|읍|면) /.test(t)) out.add("41610");
    for (const [name, code] of Object.entries(PLACES)) if (findName(t, name)) out.add(code);
    // 구 열쇠가 있으면 같은 시의 시 열쇠는 뺌(성남 + 분당구 → 분당구만)
    for (const c of [...out]) if (/^41\d\d[1-9]$/.test(c)) out.delete(`${c.slice(0, 4)}0`);
    return [...out];
  }
  // 기사 장소 → 지역(기관 자리는 서울 전체)
  function regionOfPlace(loc) {
    const s = String(loc || "").trim();
    if (!s) return null;
    const m = s.match(/^서울\s+([가-힣]+구)/);
    if (m) { const code = Object.keys(SEOUL_FULL).find(k => SEOUL_FULL[k] === m[1]); if (code) return code; }
    if (/^서울|^Seoul/.test(s)) return "11000";
    const first = s.split(/[\s,(]/)[0];
    if (GG[first]) return GG[first];
    if (/^경기/.test(s)) return "41000";
    if (/^(?:세종|한국|South Korea|대한민국)/.test(s)) return "00000";                        // 세종 = 정부 부처 자리 → 전국 소식
    return /[가-힣]/.test(s) ? "90000" : null;                                              // 그 밖의 국내 지명 = 지방
  }

  // ── 주제 ──
  const HOUSE = /아파트|주택|부동산|집값|단지|㎡|평형|오피스텔|빌라|분양|전세|월세|재건축|재개발/;
  const THEMES = {
    risk: { re: /전세사기|깡통전세|역전세|싱크홀|땅꺼짐|부동산 ?PF|PF 부실|브릿지론|건설사 (?:부도|법정관리|워크아웃)|시행사 부도|미분양 (?:증가|급증|쌓|늘)|악성 미분양|준공 후 미분양/ },
    rate: { re: /기준금리|금통위|주담대|주택담보대출|가계대출|대출 ?금리|변동금리|고정금리|전세대출|mortgage rate/i },
    rule: { re: /토지거래허가|토허제|토허구역|조정대상|투기과열|규제지역|LTV|DSR|대출 규제|종부세|종합부동산세|양도세|취득세|재산세|보유세|공시가격|부동산 대책|다주택|실거주 의무|분양가 상한/ },
    redevelop: { re: /재건축|재개발|주택정비|가로주택정비|도시정비|정비사업|정비구역|리모델링|관리처분|이주비|신속통합기획|신통기획|모아타운|모아주택|노후계획도시|선도지구/ },
    transit: { re: /GTX|광역급행|신분당선|연장선|도시철도|광역철도|경전철|트램|복선전철|신설역|역 신설|[0-9]호선 (?:연장|개통|착공|신설)|노선 (?:확정|개통|착공)|예타 (?:통과|면제)/ },
    develop: { re: /산업단지|국가산단|일반산단|클러스터|테크노밸리|도시개발|신도시|복합개발|역세권 개발|그린벨트|개발제한구역|용적률|공공택지|신규 택지|도시계획|지구단위계획/ },
    supply: { re: /분양|청약|입주 ?물량|주택 공급|공급 대책|공공주택|공공분양|임대주택|주택 인허가|착공 물량|사전청약/ },
    market: { re: /집값|아파트값|아파트 가격|매매가|매맷값|전셋값|전세가|월셋값|주택가격|주택 가격|부동산 시장|매수 ?심리|매수세|부동산값|housing price|home price|property market|apartment price/i },
    market2: { re: /거래량|신고가|호가|경매|낙찰가율|월세/, need: HOUSE },              // 주식·미술품에도 쓰는 말 → 집 낱말이 함께 있을 때만
  };
  const ORDER = ["risk", "rate", "rule", "redevelop", "transit", "develop", "supply", "market", "market2"];
  const NOT = /재해|하천|하수|배수|추락|숨져|숨진|사망|중상|부상|수료|아카데미|특강|설명회|교육생|우수상|최우수상|파출소|치안|어린이집|공모주|공모 ?청약|일반청약|유상증자|IPO|상장|미술|작품|소더비|크리스티|반려|분양받은 (?:강아지|고양이)|부고|\[인사\]|\[포토\]|화성 탐사|구리 (?:값|가격|선물)|copper|Mars/;
  function themeOf(title) {
    const t = String(title || "");
    if (NOT.test(t)) return null;
    for (const k of ORDER) {
      const r = THEMES[k];
      if (r.re.test(t) && (!r.need || r.need.test(t))) return k === "market2" ? "market" : k;
    }
    return null;
  }
  // 수도권 밖 도시·도(제목에 나오면 지방 소식). 인천은 우리 실거래 자료 밖이라 지방 쪽으로
  const PROVINCE = /부산|대구|대전|광주광역시|전남광주|울산|인천|제주|강원|충북|충남|전북|전남|경북|경남|창원|청주|천안|전주|포항|김해|세종시/;
  const isKorean = it => /[가-힣]/.test(it.title || "") || /Korea|Seoul/i.test(`${it.country || ""} ${it.location_name || ""}`);
  /** 뉴스 한 건 → { theme, regions } 또는 null. 한국과 관계없는 기사는 null */
  function signalOf(it) {
    if (!it || !isKorean(it)) return null;
    if (it.country && !/Korea/i.test(it.country)) return null;                               // 외국 소식(런던 집값·中 기준금리)은 뺌
    const theme = themeOf(it.title);
    if (!theme) return null;
    if (/^DART/.test(it.source_name || "")) return null;                                   // 공시는 따로(사건 장부)
    let regions = regionsInTitle(String(it.title || ""));
    if (!regions.length && PROVINCE.test(it.title || "")) regions = ["90000"];              // 제목이 지방 도시 이야기(장소가 서울이어도)
    if (!regions.length) { const r = regionOfPlace(it.location_name); regions = r ? [r] : []; }
    if (!regions.length || (regions.length === 1 && regions[0] === "11000" && !/서울/.test(it.title || ""))) regions = ["00000"];   // 장소가 서울(기관 자리)이고 제목에 지역이 없으면 전국 소식
    return { theme, regions: regions.slice(0, 3) };
  }
  const LABEL = {
    ko: { market: "시장·가격", supply: "공급·분양", redevelop: "재건축·재개발", transit: "교통 호재", develop: "개발·산업", rule: "규제·세금", rate: "금리·대출", risk: "위험" },
    en: { market: "Market", supply: "Supply", redevelop: "Redevelopment", transit: "Transit", develop: "Development", rule: "Rules & tax", rate: "Rates & loans", risk: "Risks" },
    ja: { market: "市場・価格", supply: "供給・分譲", redevelop: "再建築・再開発", transit: "交通", develop: "開発・産業", rule: "規制・税", rate: "金利・ローン", risk: "リスク" },
  };
  const THEME_KEYS = ["market", "supply", "redevelop", "transit", "develop", "rule", "rate", "risk"];
  g.RESIG = { signalOf, themeOf, regionsInTitle, regionOfPlace, LABEL, THEME_KEYS, SEOUL_FULL, GG, GG_GU, VER: "1" };
})(typeof globalThis !== "undefined" ? globalThis : this);
