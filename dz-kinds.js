// 재난 종류 나누기 (2026-11-22 사용자 요청 "한파·산불·홍수 탭, 재난을 누르면 종류가 자세히") — 뉴스 제목으로 재난 종류를 고름. 화면(disaster-layer.js 가 불러옴)·Node 시험 둘 다.
// 종류: quake 지진 · typhoon 태풍 · flood 홍수 · fire 산불 · cold 한파·폭설 · volcano 화산 · drought 가뭄 · heat 폭염
// 규칙: 제목에 그 종류 낱말이 있고, 빼는 말(예방 캠페인·훈련·보험 상품 등)이 없을 때. 한 제목이 여러 종류면 앞의 것(ORDER)부터 하나만.
// ⚠️ 정규식에 (?<= (?<! 쓰지 말 것(옛 아이폰에서 파일 전체 멈춤).
(function (g) {
  const K = {
    quake: { re: /지진|여진|earthquake|aftershock|tremor|地震|余震/i },
    typhoon: { re: /태풍|열대저압부|typhoon|hurricane|cyclone|tropical storm|台風|台风|颱風|飓风/i },
    volcano: { re: /화산|분화|volcan|eruption|噴火|火山/i },
    // 산불: 건물·차·공장 불은 빼고 산·들·숲 불만 ("야산서 불", "임야 화재")
    fire: { re: /산불|야산[서에]|야산으로 번|야산 화재|임야 ?화재|산림 ?화재|들불|wildfire|forest fire|bush ?fire|brush ?fire|grass ?fire|山火事|林野火災|山火|森林火灾|森林火災/i,
      not: /예방|캠페인|훈련|교육|조심|유의|감시원|모집|채용|보험|기념|홍보|점검 회의|산불감시|진화대원|르포|주의|발대식|방지인력|서식|다람쥐|prevention|risk|lawsuit|insurance|convict|guilty|retrial|verdict|detection|research|prize/i },
    flood: { re: /홍수|침수|범람|물난리|flood|flooding|洪水|浸水|氾濫|泛滥|洪涝|内涝/i,
      not: /침수차 (?:매매|판매)|예방|훈련|보험|캠페인|대비 점검|flood of|flooded with|flooding the market|flood the zone|insurance|"the flood"/i },
    cold: { re: /한파|강추위|동파|한랭질환|폭설|대설|cold wave|cold snap|polar vortex|blizzard|winter storm|snowstorm|heavy snow|寒波|大雪|暴雪|寒潮|大寒流/i,
      not: /캠페인|보험|한파 속 온정|기부|성금|김장|이웃돕기|대비|안내|예방|gas price|heat pump/i },
    drought: { re: /가뭄|drought|干ばつ|干旱|旱灾/i, not: /가뭄에 콩/ },
    heat: { re: /폭염|열대야|heatwave|heat wave|酷暑|猛暑|高温热浪/i, not: /폭염 속 온정|기부|캠페인/ },
  };
  const ORDER = ["quake", "typhoon", "volcano", "fire", "flood", "cold", "drought", "heat"];
  function kindOf(title) {
    const t = String(title || "");
    for (const k of ORDER) { const r = K[k]; if (r.re.test(t) && !(r.not && r.not.test(t))) return k; }
    return null;
  }
  const LABEL = {
    ko: { quake: "지진", typhoon: "태풍", volcano: "화산", fire: "산불", flood: "홍수", cold: "한파·폭설", drought: "가뭄", heat: "폭염" },
    en: { quake: "Quakes", typhoon: "Storms", volcano: "Volcanoes", fire: "Wildfires", flood: "Floods", cold: "Cold & snow", drought: "Drought", heat: "Heat" },
    ja: { quake: "地震", typhoon: "台風", volcano: "火山", fire: "山火事", flood: "洪水", cold: "寒波・大雪", drought: "干ばつ", heat: "猛暑" },
  };
  g.DZKIND = { kindOf, ORDER, LABEL, RULES: K };
})(typeof globalThis !== "undefined" ? globalThis : this);
