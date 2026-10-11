// 반영(뉴스 → 시세) 계산 공통 파일 (2026-10-11 사용자 요청). 화면(site/reflect-core.js — 글자까지 같은 복사본)과 서버 함수(reflect)가 똑같이 씀.
// 사용자 결정: "정직한 방식" — ① 규칙상 기울기(사람이 쓴 영향표 × 오늘 뉴스 흐름, 검증 전엔 회색) ② 보통 움직임 범위(가격만)
//   ③ 매일 07:09 KST 에 미리 남긴 기록 → 다음 마감 뒤 채점(동전·항상 오름·전날 방향과 비교). 학습형 숫자 예측은 기록이 쌓인 뒤(약 2027-01).
// 원인을 단정하지 않음("~하는 경우가 많아요"), 사거나 팔라는 말 없음(test.mjs 가 금지어 검사).
// 옛 아이폰(사파리 15.4 미만)에서 파일 전체가 멈추지 않게: 뒤를 보는 정규식 (?<= (?<! · .at( · findLast · structuredClone · Object.hasOwn 금지.
// 브라우저 일반 script 와 Deno·Node 의 import 에서 모두 동작: 전역에 RF 하나만 만듦.
(function (g) {
  "use strict";
  const VER = "1";   // 규칙·기준값을 바꾸면 올릴 것 — 성적을 판(core_ver)마다 따로 셈

  // ════════════════════ ① news-price-link.js 의 RULES 그대로 복사 (test.mjs 가 같은지 검사 — 고칠 땐 두 곳 같이) ════════════════════
  const RULES = [
    { name: "중동·러시아·분쟁",
      words: [/중동(?:\s?전쟁|\s?정세|\s?분쟁|발|\s?위기|\s?평화|\s?지역|\s?국가|\s?사태|\s?리스크)/,
        /(^|[^가-힣])이란/,
        "이스라엘", /가자(?:지구|\s?전쟁|\s?휴전|\s?주민|\s?공습)/,
        "하마스", "헤즈볼라", "후티", "예멘", "시리아", "이라크", "사우디", "호르무즈", "러시아", "우크라이나", "푸틴", "젤렌스키",
        "OPEC", "오펙", /유가(?!족|증권|스|공|\))/, "브렌트", "WTI",
        "Middle East", "Iran", "Israel", "Gaza", "Hamas", "Hezbollah", "Houthi", "Yemen", "Syria", "Iraq", "Saudi", "Hormuz", "Russia", "Ukrain", "Putin", "Zelensk", "Kremlin",
        /\bcrude\b/i, /\bBrent (crude|oil|futures|price)/i,
        /\b(oil|crude) (price|prices|market|markets|supply|supplies|output|tankers?|exports?|imports?|futures|rises|rose|falls|fell|jumps|jumped|slips|slipped|climbs|climbed|surges|surged|drops|dropped)\b/i,
        "中东", "伊朗", "以色列", "霍尔木兹", "俄罗斯", "乌克兰", "原油", "油价", "欧佩克", "イラン", "イスラエル", "ロシア", "ウクライナ", "中東"],
      countries: ["Iran", "Israel", "Palestine", "Lebanon", "Syria", "Iraq", "Yemen", "Saudi Arabia", "United Arab Emirates", "Qatar", "Kuwait", "Oman", "Bahrain", "Jordan",
        "Russia", "Ukraine"],
      cats: ["conflict", "diplomacy"],
      show: ["WTI", "BRENT", "GOLD"] },
    { name: "미국 금리·연준",
      words: ["연준", "파월", "FOMC", "미 국채", "미국 국채", "미국채", "미국 금리", "Federal Reserve", "Jerome Powell",
        /\bPowell\b.*\b(Fed|rates?|inflation|economy|Treasury)\b/i,
        "Treasury yield", "Treasuries", /\bFed\b/, "美联储", "鲍威尔", "美债", "FRB", "パウエル", "米国債", "米金利"],
      sources: ["Federal Reserve"],
      show: ["UST10Y", "USDKRW", "SPREAD_KR_US"] },
    { name: "일본",
      words: ["일본", "엔화", "엔저", "엔고", "일본은행", "Bank of Japan", /\bBOJ\b/, "Japan", /\byen\b/i, "Nikkei", "日本", "日銀", "円安", "円高", "日元", "日本央行"],
      sources: ["Bank of Japan", "財務省", "首相官邸"],
      show: ["JPYKRW", "SPREAD_US_JP"] },
    { name: "중국",
      words: ["중국", /위안(?!부)/, "시진핑", "China", "Chinese", "Beijing", "Xi Jinping", /\byuan\b/i, "renminbi", "中国", "中國", "人民币", "人民幣", "习近平"],
      countries: ["China"], cats: ["economy", "diplomacy", "politics"], countryLangs: ["zh"],
      show: ["CNYKRW", "EXP10_CN"] },
    { name: "반도체",
      words: ["반도체", "HBM", "삼성전자", "하이닉스", /메모리(?!얼)/, "파운드리", "semiconductor", "chipmaker", "Samsung Electronics", "Hynix", "TSMC",
        /\b(AI|memory|computer|advanced|Nvidia|Samsung)[ -]chips?\b/i, "半导体", "芯片", "半導体"],
      show: ["EXP10_SEMI", "KOSPI"] },
    { name: "한국 수출",
      words: ["수출", "무역수지", "경상수지", "관세청"],
      show: ["EXP10_TOTAL", "KOSPI"] },
    { name: "코인",
      words: ["비트코인", "가상자산", "가상화폐", "암호화폐", "이더리움", "스테이블코인", /테더(?!링)/, /코인(?!노래|세탁)/,
        "Bitcoin", /\bcrypto(?!graph)/i, "BTC", "Ethereum", "stablecoin", /\bTether\b/, "比特币", "加密货币", "ビットコイン", "暗号資産"],
      show: ["BTCKRW", "USDT_PREMIUM"] },
  ];
  // 하루 값의 마감 시각(UTC 시) — news-price-link.js 의 CLOSE_H 그대로 (test.mjs 가 같은지 검사)
  const CLOSE_H = { KOSPI: 6.5, KOSDAQ: 6.5, KOSPI200: 6.5, KTB3Y: 6.5, KTB10Y: 6.5, KRXGOLD: 6.5, JGB2Y: 6, JGB10Y: 6, JGB30Y: 6,
    USDKRW: 13, JPYKRW: 13, CNYKRW: 13, EURKRW: 13, DXY_CALC: 13,
    WTI: 19.5, BRENT: 19.5, HENRYHUB: 19.5, UST2Y: 20, UST10Y: 20, UST3M: 20, TIPS5Y: 20, TIPS10Y: 20 };

  // ════════════════════ ② 영향표 — 규칙을 고칠 곳은 여기 한 곳 ════════════════════
  // rule: 위 RULES 의 이름(낱말은 거기서) / words: 새 주제의 낱말 / up·down: 그 주제에 걸린 기사 안에서만 보는 방향 낱말
  //   (둘 다 있으면 방향 없음 — 단 한쪽 말이 다른 쪽 말 안에 들어 있으면 긴 말이 이김: "제재 해제" ⊃ "제재", "관세 부과 90일 유예" ⊃ "부과")
  // m: up 쪽 뉴스가 많을 때 시세별로 움직이는 경우가 많은 쪽(+1 오름, −1 내림, 0.5 약하게). down 은 반대 부호.
  // base: TOP5 주제 무게 / why: 이유 문장 [ko, en, ja] — 단정하지 않는 말투로
  const THEMES = [
    { id: "geo", rule: "중동·러시아·분쟁", base: 0.9,
      label: ["중동·러시아·분쟁", "Middle East · Russia · conflict", "中東・ロシア・紛争"], upLabel: ["긴장·공급 차질", "tension · supply risk", "緊張・供給不安"], downLabel: ["휴전·증산", "ceasefire · more supply", "停戦・増産"],
      up: [/공습|폭격|미사일|드론|공격(?!적)|봉쇄|확전|격화|침공|나포|보복|교전|피격|제재|감산|공급\s?차질/,
        /\b(attack(s|ed|ing)?|strikes?|airstrikes?|missiles?|drones?|blockade|escalat\w*|invasion|invade\w*|seiz\w*|retaliat\w*|sanctions?|output cuts?|production cuts?|supply disruption)\b/i,
        /袭击|空袭|导弹|封锁|升级|减产|制裁|攻撃|空爆|ミサイル|封鎖|減産/],
      down: [/휴전|정전\s?(협상|합의|협정|회담)|평화\s?(협상|회담|합의|협정)|종전|증산|제재\s?(완화|해제)/,
        /\b(ceasefire|truce|peace (talks|deal|agreement|plan)|de-?escalat\w*|output (hike|increase)|boost(s|ed)? output|raise(s|d)? output|increase production|sanctions relief|lift(s|ed|ing)? sanctions)\b/i,
        /停火|停战|和谈|增产|停戦|和平|増産/],
      m: { WTI: 1, KRXGOLD: 1, USDKRW: 1, JPYKRW: 0.5, KOSPI: -1, UST10Y: -0.5 },
      why: ["중동·러시아는 원유 공급 지역이라 긴장이 커지면 유가·금·달러가 오르고 주식은 약해지는 경우가 많아요",
        "Tension in oil-supplying regions often comes with higher oil, gold and dollar, and weaker stocks",
        "産油地域の緊張は原油・金・ドル高、株安と重なることが多いです"] },
    { id: "fed", rule: "미국 금리·연준", base: 1.0,
      label: ["미국 금리·연준", "US rates · Fed", "米金利・FRB"], upLabel: ["매파(긴축)", "hawkish", "タカ派"], downLabel: ["비둘기(완화)", "dovish", "ハト派"],
      up: [/금리[^가-힣]{0,12}(포인트)?\s?인상|인상\s?(시사|가능성|전망|우려)|매파|긴축|고금리|물가\s?(상승|급등|반등|재점화)|인플레(이션)?\s?(우려|재점화|가속)/,
        /\b(rate hikes?|(rais(e|es|ed|ing)|hik(e|es|ed|ing)) (interest |benchmark |key )?rates?|hawkish|tighten\w*|hot(ter)? inflation|inflation (accelerat\w*|jumps?|surges?|heats? up)|sticky inflation|higher for longer)\b/i,
        /加息|鹰派|紧缩|利上げ|タカ派/],
      down: [/금리[^가-힣]{0,12}(포인트)?\s?인하|인하\s?(시사|가능성|전망|기대)|비둘기|완화|빅컷|물가\s?(둔화|하락|안정)|물가\s?상승(률|세)?\s?(둔화|하락|안정)/,
        /\b(rate cuts?|(cut|cuts|cutting|lower(s|ed|ing)?|slash(es|ed)?) (interest |benchmark |key )?rates?|dovish|easing|inflation (cools?|eases?|slows?))\b/i,
        /降息|鸽派|宽松|利下げ|ハト派/],
      m: { UST10Y: 1, USDKRW: 1, KTB10Y: 0.5, KOSPI: -1, KRXGOLD: -0.5, BTCKRW: -0.5 },
      why: ["미국 금리가 높게 유지될 것 같으면 달러와 금리가 오르고 주식·금·코인은 약해지는 경우가 많아요",
        "Expectations of higher US rates often come with a stronger dollar and yields, and weaker stocks, gold and crypto",
        "米金利の高止まり観測はドル高・金利上昇、株・金・暗号資産安と重なることが多いです"] },
    { id: "japan", rule: "일본", base: 0.65,
      label: ["일본·엔", "Japan · yen", "日本・円"], upLabel: ["엔 강세 쪽", "stronger yen", "円高方向"], downLabel: ["엔 약세 쪽", "weaker yen", "円安方向"],
      up: [/금리[^가-힣]{0,12}(포인트)?\s?인상|긴축|엔고|엔화\s?강세|개입|매파/, /\b(rate hikes?|(rais(e|es|ed|ing)|hik(e|es|ed|ing)) (interest |benchmark |key )?rates?|hawkish|intervention|intervene\w*)\b/i, /利上げ|円高|介入|タカ派|加息|日元升值/],
      down: [/엔저|엔화\s?약세|완화\s?(유지|지속)|비둘기/, /\b(dovish|ultra-?loose)\b/i, /円安|緩和(維持|継続)|ハト派|日元贬值/],
      m: { JPYKRW: 1 },
      why: ["일본 금리 인상·개입 이야기가 많으면 엔화가 강해지는 경우가 많아요",
        "Talk of Japanese rate hikes or intervention often comes with a stronger yen",
        "日本の利上げ・介入観測は円高と重なることが多いです"] },
    { id: "china", rule: "중국", base: 0.7,
      label: ["중국 경기", "China economy", "中国景気"], upLabel: ["부양·회복", "stimulus · recovery", "景気対策・回復"], downLabel: ["둔화", "slowdown", "減速"],
      up: [/부양|지준율\s?인하|금리[^가-힣]{0,12}(포인트)?\s?인하|회복|호조/, /\b(stimulus|RRR cut|rate cuts?|recover\w*|rebound\w*)\b/i, /刺激|降准|降息|稳增长|回升|复苏|增长|景気刺激|景気対策/],
      down: [/둔화|부진|디플레|침체|위축|부동산\s?위기/, /\b(slowdown|slump\w*|deflation\w*|contraction|property crisis|weak(ens|ening|er)?)\b/i, /放缓|下滑|下降|通缩|萎缩|疲软|减少|減速|低迷/],
      m: { KOSPI: 1, CNYKRW: 0.5, USDKRW: -0.5, WTI: 0.5 },
      why: ["중국 경기가 좋아질 것 같으면 한국 수출 기대로 코스피가 오르고 원화가 강해지는 경우가 많아요",
        "Signs of a stronger Chinese economy often come with firmer Korean stocks and won",
        "中国景気の改善は韓国株高・ウォン高と重なることが多いです"] },
    { id: "semi", rule: "반도체", base: 0.75,
      label: ["반도체", "Semiconductors", "半導体"], upLabel: ["호재", "positive", "好材料"], downLabel: ["악재", "negative", "悪材料"],
      up: [/수주|실적\s?개선|호실적|사상\s?최대|역대\s?최대|공급\s?부족|가격\s?인상|투자\s?확대|흑자/,
        /\b(beats?|record (revenue|profit|sales)|shortage|strong demand|price hikes?)\b/i, /短缺|涨价|好調|増益/],
      down: [/수출\s?(규제|통제)|실적\s?부진|적자|공급\s?과잉|어닝\s?쇼크/, /\b(export controls?|curbs?|slump\w*|glut|miss(es|ed)?|weak demand)\b/i, /限制|禁令|过剩|規制|減益/],
      m: { KOSPI: 1, USDKRW: -0.5 },
      why: ["반도체는 코스피에서 비중이 커서 좋은 소식이 많으면 코스피가 오르고 원화가 강해지는 경우가 많아요",
        "Chips are a large part of KOSPI, so good chip news often comes with firmer KOSPI and won",
        "半導体はKOSPIの比重が大きく、好材料はKOSPI高・ウォン高と重なることが多いです"] },
    { id: "export", rule: "한국 수출", base: 0.85,
      label: ["한국 수출", "Korean exports", "韓国の輸出"], upLabel: ["증가", "rising", "増加"], downLabel: ["감소", "falling", "減少"],
      up: [/증가|흑자|호조|최대|급증|늘어|늘었/], down: [/감소|적자|부진|둔화|급감|줄어|줄었|역성장/],
      m: { KOSPI: 1, USDKRW: -1 },
      why: ["수출이 잘되면 달러가 들어와 원화가 강해지고 코스피가 오르는 경우가 많아요",
        "Strong exports often come with a stronger won and firmer KOSPI",
        "輸出好調はウォン高・KOSPI高と重なることが多いです"] },
    { id: "crypto", rule: "코인", base: 0.5,
      label: ["코인", "Crypto", "暗号資産"], upLabel: ["승인·유입", "approval · inflows", "承認・流入"], downLabel: ["해킹·규제", "hacks · crackdowns", "ハッキング・規制"],
      up: [/승인|유입|채택|매입|상장(?!폐지)|규제\s?완화/, /\b(approv\w*|inflows?|adopt\w*|buys?|purchas\w*|deregulat\w*)\b/i, /批准|流入|承認|採用/],
      down: [/해킹|규제|단속|금지|유출|파산|소송|상장폐지/, /\b(hack\w*|bans?|crackdown|outflows?|lawsuit|bankrupt\w*|exploit\w*|sues?|sued)\b/i, /黑客|禁止|监管|打击|流出|ハッキング|規制/],
      m: { BTCKRW: 1 },
      why: ["승인·자금 유입 소식이 많으면 비트코인이 오르고, 해킹·규제 소식이 많으면 내리는 경우가 많아요",
        "Approvals and inflows often come with higher bitcoin; hacks and crackdowns with lower",
        "承認・資金流入はビットコイン高、ハッキング・規制は安と重なることが多いです"] },
    { id: "tariff", words: [/관세(?!청)/, /\btariffs?\b/i, /\btrade (war|deal|talks)\b/i, /무역\s?(전쟁|협상|합의)/, "关税", "関税", "贸易战"], base: 0.85,
      label: ["관세·무역 협상", "Tariffs · trade talks", "関税・通商交渉"], upLabel: ["완화", "easing", "緩和"], downLabel: ["강화", "escalation", "強化"],
      up: [/유예|인하|합의|타결|면제|철회|휴전|(부과|발효|관세)[\s\d일개월년]{0,10}(유예|연기|철회|면제)/,
        // 긴 말을 앞에(정규식은 같은 자리에서 앞의 것부터 맞춤 — "delays new tariffs" 전체가 걸려야 "new tariffs"(강화)를 덮음)
        /\b((delay(s|ed)?|paus(e|es|ed)|suspend(s|ed)?)\s+(\w+\s+){0,3}tariffs?|cuts? tariffs|deal|agreement|truce|exempt\w*|pause[sd]?|delay\w*|lift\w*|roll ?back)\b/i, /达成|暂停|豁免|取消|下调|合意|猶予|撤回|引き下げ/],
      down: [/부과|인상(?!적)|보복|확대|발효|폭탄/, /\b(impos\w*|hikes?|rais\w*|new tariffs|retaliat\w*|escalat\w*)\b/i, /加征|报复|上调|発動|引き上げ|報復/],
      m: { KOSPI: 1, USDKRW: -1 },
      why: ["관세가 완화되면 수출 기대로 코스피가 오르고 원화가 강해지는 경우가 많아요",
        "Tariff relief often comes with firmer KOSPI and a stronger won on export hopes",
        "関税緩和は輸出期待からKOSPI高・ウォン高と重なることが多いです"] },
  ];
  // 예측(기록)할 시세 9개. unit: 금리는 bp(차이×100), 나머지는 %
  const SYMBOLS = ["USDKRW", "JPYKRW", "CNYKRW", "UST10Y", "KTB10Y", "KOSPI", "WTI", "KRXGOLD", "BTCKRW"];
  const RATE = { UST10Y: 1, KTB10Y: 1 };
  const unitOf = s => (RATE[s] ? "bp" : "%");
  // 방향 단계: |L| < 0.12 없음, < 0.25 약(1), < 0.45 중(2), 그 위 강(3). VER 를 올리지 않고는 바꾸지 않음(바꾸면 지난 성적과 섞임)
  const LEAN_CUTS = [0.12, 0.25, 0.45];

  // 출처 가중치(관심도 계산용 a, TOP5 용 q)
  const MACRO = ["Federal Reserve", "ECB", "Bank of Japan", "財務省", "首相官邸", "White House", "US Treasury OFAC", "EU Council", "European Commission", "US State Dept", "재정경제부", "외교부"];
  const NAMED_WIRE = ["연합뉴스", "뉴시스", "Reuters", "Bloomberg", "AFP", "CNBC", "BERNAMA"];
  const EXCLUDED = ["DART 공시"];   // 공시 제목의 "(유가)"는 유가증권시장 — 시세 뉴스가 아님, 양도 많아 비중을 흐림

  // 일정(사실 정보만, 각 기관 공식 일정표에서 옮김 — 해마다 고칠 것). 결정·발표하는 날(그 나라 날짜). 한국은행 금통위는 사용자 결정으로 뺌
  const CAL_SRC = { FOMC: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", ECB: "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html",
    BOJ: "https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm", EIA: "https://www.eia.gov/petroleum/supply/weekly/schedule.php", KCS: "https://www.customs.go.kr" };
  const CAL = [
    ["2026-10-28", "FOMC", "fed"], ["2026-12-09", "FOMC", "fed"], ["2027-01-27", "FOMC", "fed"], ["2027-03-17", "FOMC", "fed"], ["2027-04-28", "FOMC", "fed"],
    ["2027-06-09", "FOMC", "fed"], ["2027-07-28", "FOMC", "fed"], ["2027-09-15", "FOMC", "fed"], ["2027-10-27", "FOMC", "fed"], ["2027-12-08", "FOMC", "fed"],
    ["2026-10-29", "ECB", null], ["2026-12-17", "ECB", null], ["2027-02-04", "ECB", null], ["2027-03-18", "ECB", null], ["2027-04-29", "ECB", null],
    ["2027-06-10", "ECB", null], ["2027-07-22", "ECB", null], ["2027-09-09", "ECB", null], ["2027-10-28", "ECB", null], ["2027-12-16", "ECB", null],
    ["2026-10-30", "BOJ", "japan"], ["2026-12-18", "BOJ", "japan"], ["2027-01-22", "BOJ", "japan"], ["2027-03-18", "BOJ", "japan"], ["2027-04-28", "BOJ", "japan"],
    ["2027-06-11", "BOJ", "japan"], ["2027-07-22", "BOJ", "japan"], ["2027-09-22", "BOJ", "japan"], ["2027-10-29", "BOJ", "japan"], ["2027-12-17", "BOJ", "japan"],
  ].map(([d, n, th]) => ({ d, n, th, url: CAL_SRC[n] }));
  const CAL_LAST = "2027-12-31";   // 이 날짜가 지나면 화면에 "일정표를 고칠 때예요"
  // 날마다 정해진 일정: EIA 주간 원유 재고(수요일, 휴일이면 밀릴 수 있음) · 관세청 10일 수출(1·11·21일)
  // (기록의 events 칸은 "그 날짜에 예정된 일정" 설명용 — 시세마다 채점 구간에 그 일정이 들었는지는 시각이 달라 따로 따져야 함)
  function eventsOn(day) {                         // day = "YYYY-MM-DD"
    const out = CAL.filter(c => c.d === day).map(c => ({ n: c.n, th: c.th, url: c.url }));
    const dt = new Date(day + "T00:00:00Z");
    if (dt.getUTCDay() === 3) out.push({ n: "EIA", th: "geo", url: CAL_SRC.EIA });
    if ([1, 11, 21].includes(dt.getUTCDate())) out.push({ n: "KCS", th: "export", url: CAL_SRC.KCS });
    return out;
  }

  // ════════════════════ ③ 글자 판정 ════════════════════
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // RULES 방식(영어는 낱말 첫머리·대소문자 무시, 그 밖의 글자는 들어 있기만 하면, 정규식은 그대로)을 정규식 몇 개로 합침 — 하나씩 검사와 결과가 같음(test.mjs)
  function compile(words) {
    const out = [], ascii = [], other = [];
    for (const w of words || []) {
      if (w instanceof RegExp) out.push(w);
      else if (/^[\x20-\x7e]+$/.test(w)) ascii.push(esc(w));
      else other.push(esc(w));
    }
    if (ascii.length) out.push(new RegExp(`\\b(?:${ascii.join("|")})`, "i"));
    if (other.length) out.push(new RegExp(other.join("|")));
    return out;
  }
  const any = (res, s) => { for (const re of res) if (re.test(s)) return true; return false; };
  const RULE_BY_NAME = Object.fromEntries(RULES.map(r => [r.name, r]));
  const TH = THEMES.map(t => {
    const r = t.rule ? RULE_BY_NAME[t.rule] : null;
    const g = re => new RegExp(re.source, re.flags.indexOf("g") >= 0 ? re.flags : re.flags + "g");
    return { ...t, re: compile(r ? r.words : t.words), countries: r?.countries, cats: r?.cats, countryLangs: r?.countryLangs, sources: r?.sources,
      upG: t.up.map(g), downG: t.down.map(g) };
  });
  const TH_BY_ID = Object.fromEntries(TH.map(t => [t.id, t]));
  // 방향 낱말이 걸린 자리들 [시작, 끝]
  function spans(res, s) {
    const out = [];
    for (const re of res) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(s))) { if (!m[0]) { re.lastIndex++; continue; } out.push([m.index, m.index + m[0].length]); }
    }
    return out;
  }
  const inside = (a, list) => list.some(b => b[0] <= a[0] && a[1] <= b[1] && b[1] - b[0] > a[1] - a[0]);
  // 이미 일어난 값 움직임만 전하는 제목(시세 보도) — 관심도에만 세고 방향에는 안 넣음.
  // 시세 이름 바로 뒤(8글자 안)에 움직임 말이 오거나("국제유가 급등", "Oil prices fall"), 움직임 꾸밈말 바로 뒤에 시세 이름("치솟는 환율")일 때만
  // (2026-10-11 검토: 아무 데나 함께 있으면 "물가 상승 압력…금리 인상" 같은 정책 기사가 방향을 잃었음. "700억 달러 돌파"의 달러는 시세가 아님)
  const R_NOUN = "유가|환율|원화|원·달러|원/달러|원달러|달러화|엔화|위안화|코스피|코스닥|증시|주가|금값|금 값|국채\\s?금리|금리|비트코인|"
    + "\\b(?:oil|crude|Brent|WTI|stocks?|shares|equities|Treasury yields?|Treasuries|yields?|bitcoin|gold|yen|dollar|won|yuan|Nikkei|KOSPI|Wall Street|S&P ?500|Nasdaq|Dow)\\b|"
    + "油价|股市|A股|金价|汇率|比特币|国债|日元|美元|人民币|株価|円相場|金利|日経平均";
  const R_MOVE = "급등|급락|상승|하락|반등|약세|강세|최고치|최저치|올라|내려|떨어|뛰어|치솟|"
    + "\\b(?:rise[sn]?|rose|falls?|fell|jump(?:s|ed)?|slip(?:s|ped)?|surge[sd]?|drop(?:s|ped)?|gain(?:s|ed)?|climb(?:s|ed)?|tumble[sd]?|plunge[sd]?|rall(?:y|ies|ied)|soar(?:s|ed)?|sinks?|sank|edges? (?:up|down|higher|lower)|clos(?:e|es|ed) (?:higher|lower|up|down))\\b|"
    + "上涨|下跌|大涨|大跌|走高|走低|收涨|收跌|上昇|下落|急騰|急落|続伸|続落";
  const R_PRE = "급등한|급락한|오른|내린|치솟는|치솟은|떨어진|뛰는|상승한|하락한|\\b(?:rising|falling|soaring|surging|plunging|sliding)\\b";
  const REPORT = new RegExp(`(?:${R_NOUN})[^…·."'“”]{0,8}(?:${R_MOVE})|(?:${R_PRE})\\s?(?:${R_NOUN})|(?:코스피|코스닥|증시|지수|Nikkei|KOSPI)[^…·."'“”]{0,10}(?:마감|돌파)`, "i");
  const isReport = s => REPORT.test(s);
  // 제목 언어 — 화면(index.html srcLang)과 같은 갈래: ko / ja / zh / zh-Hant / en
  // ↓ index.html 의 JA_KANJI·HANT·srcLang 과 글자까지 같게 (test.mjs 가 같은 결과인지 검사)
  const JA_KANJI = /令和|[県発済経気歳図対処広変円払売読駅様楽薬権観関覧産険転鉄総戦団営労働込]/;
  const HANT = /[們個國會來時說對經過學發開關與為這後產實應體點當無從現區電視報導灣臺東車門長間問題錄風雲論壇係濟]/;
  function langOf(s) {
    if (/[가-힣]/.test(s)) return "ko";
    if (/[぀-ゟァ-ヺ]/.test(s)) return "ja";
    if ((s.match(/[一-鿿]/g) || []).length <= (s.match(/[A-Za-z]+/g) || []).length) return "en";
    return JA_KANJI.test(s) ? "ja" : HANT.test(s) ? "zh-Hant" : "zh";
  }
  // 출처 가중치: a(관심도 비중) / q(TOP5 출처 점수)
  function weightOf(it, lang) {
    const src = it.source_name || "", st = it.source_type;
    if (EXCLUDED.includes(src)) return { a: 0, q: 0, k: "x" };
    if (MACRO.includes(src)) return { a: 3, q: 1.0, k: "official" };
    if (st === "official") return { a: 1, q: 0.35, k: "official" };
    if (st === "wire") return NAMED_WIRE.includes(src) ? { a: 2, q: 0.9, k: "wire" } : { a: 1.5, q: 0.7, k: "wire" };
    if (st === "media") return lang === "zh" || lang === "zh-Hant" ? { a: 0.5, q: 0.4, k: "media" } : { a: 1, q: 0.6, k: "media" };
    return { a: 0.5, q: 0.3, k: "media" };
  }
  // 기사 하나 판정 → it._rf 에 기억 (같은 기사를 5분마다 다시 판정하지 않게)
  function tag(it) {
    if (it._rf && it._rf.v === VER) return it._rf;
    const title = it.title || "", lang = langOf(title), w = weightOf(it, lang), rep = isReport(title), th = [], dir = {}, weak = {};
    if (w.a > 0) for (const t of TH) {
      const strong = any(t.re, title) || (t.sources && t.sources.includes(it.source_name));
      const hit = strong
        || (t.countries && t.countries.includes(it.country) && (!t.cats || !t.cats.length || t.cats.includes(it.category))
          && (!t.countryLangs || t.countryLangs.includes(lang)));
      if (!hit) continue;
      th.push(t.id);
      if (!strong) weak[t.id] = 1;                       // 나라 칸으로만 맞음(제목에 주제 낱말 없음) → TOP5 무게를 낮춤
      // 한쪽 말이 다른 쪽 말 안에 들어 있으면 그 짧은 말은 무시("제재 해제"의 "제재", "de-escalate"의 "escalate")
      const U = spans(t.upG, title), D = spans(t.downG, title);
      const u = U.some(a => !inside(a, D)), d = D.some(a => !inside(a, U));
      dir[t.id] = rep || u === d ? 0 : u ? 1 : -1;
    }
    it._rf = { v: VER, lang, a: w.a, q: w.q, k: w.k, rep, th, dir, weak };
    return it._rf;
  }
  const isBsky = u => /^https?:\/\/(www\.)?bsky\.app\//.test(u || "");   // Bluesky 글은 지워지면 우리도 지워야 함 → 오래 남기는 복사본에 넣지 않음
  const tms = it => (Number.isFinite(it._t) ? it._t : Date.parse(it.published_at));

  // ════════════════════ ④ 하루 통계 → 주제별 관심도·방향 ════════════════════
  const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = (s.length - 1) / 2; return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2; };
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const r3 = x => (x == null ? null : Math.round(x * 1000) / 1000 || 0);   // −0 은 0 으로
  // rows: 그 기간 기사들. base: 지난 기록(rf_daily 줄들, 최근 것부터, themes 칸 포함). 기준 5일 미만이면 z 없음·관심도 0.5
  function dayStats(rows, base) {
    // 같은 규칙 판(core_ver)의 기록만 기준으로 — 규칙을 바꾼 뒤 옛 낱말 목록의 비중·방향과 섞이지 않게(바꾼 뒤 5일은 "기준 부족")
    const ok = (base || []).filter(b => b && !b.partial && b.themes && (b.core_ver == null || b.core_ver === VER)).slice(0, 13);
    let total = 0, n = 0;
    const acc = Object.fromEntries(TH.map(t => [t.id, { n: 0, w: 0, up: 0, down: 0, top: [] }]));
    for (const it of rows) {
      const f = tag(it);
      if (!f.a) continue;
      total += f.a; n++;
      for (const id of f.th) {
        const x = acc[id];
        x.n++; x.w += f.a;
        if (f.dir[id] > 0) x.up += f.a; else if (f.dir[id] < 0) x.down += f.a;
        if (!isBsky(it.url) && it.title) x.top.push({ title: it.title, url: it.url, src: it.source_name, st: it.source_type, t: tms(it), q: f.q });
      }
    }
    const themes = {};
    for (const t of TH) {
      const x = acc[t.id], share = total ? (x.w / total) * 1000 : 0;   // ‰
      const hist = ok.map(b => b.themes[t.id] && b.themes[t.id].share).filter(v => Number.isFinite(v));
      let z = null;
      if (hist.length >= 5) {
        const med = median(hist), mad = median(hist.map(v => Math.abs(v - med)));
        z = (share - med) / (1.4826 * mad + 0.1 * med + 0.01);
      }
      const att = z == null ? 0.5 : 0.3 + (0.7 * clamp(z, 0, 3)) / 3;
      const d = (x.up - x.down) / (x.up + x.down + 3);
      // 방향은 "평소보다" 쏠린 만큼만: 전쟁 기사처럼 늘 한쪽 낱말이 많은 주제가 날마다 같은 기울기를 내지 않게(2026-10-11 실제 자료로 확인)
      //   r = 오늘 (up−down)/(up+down), r0 = 지난날 r 의 중간값(방향 낱말이 있던 날만) → de = (r − r0) × 오늘 방향 낱말 수/(수 + 3)
      //   방향 낱말이 없는 조용한 날은 de = 0("평소보다 나쁨"이 아님). 그런 날이 5일 미만이면 방향을 쓰지 않음(de 없음 → 화면에 "기준 부족")
      const nd = x.up + x.down, r = nd ? (x.up - x.down) / nd : 0;
      const rh = ok.map(b => b.themes[t.id]).filter(v => v && v.up + v.down > 0).map(v => (v.up - v.down) / (v.up + v.down));
      const d0 = rh.length >= 5 ? median(rh) : null;
      const de = d0 == null ? null : clamp(((r - d0) * nd) / (nd + 3), -1, 1);
      x.top.sort((p, q) => q.q - p.q || q.t - p.t);
      themes[t.id] = { n: x.n, w: r3(x.w), share: r3(share), z: r3(z), a: r3(att), up: r3(x.up), down: r3(x.down), d: r3(d), d0: r3(d0), de: r3(de),
        top: x.top.slice(0, 2).map(({ q, ...o }) => o) };
    }
    return { total_w: r3(total), n_rows: n, base_days: ok.length, themes };
  }
  // 시세별 규칙상 기울기: L = Σ 주제 (부호 M × 평소 대비 방향 de × 관심도 a). call = 단계(−3~3)
  function lean(stats) {
    const out = {};
    for (const s of SYMBOLS) {
      const parts = {};
      let L = 0;
      for (const t of TH) {
        const m = t.m[s], x = stats.themes[t.id];
        if (!m || !x || x.de == null) continue;
        const c = m * x.de * x.a;
        if (Math.abs(c) >= 0.0005) { parts[t.id] = r3(c); L += c; }
      }
      const abs = Math.abs(L), step = abs < LEAN_CUTS[0] ? 0 : abs < LEAN_CUTS[1] ? 1 : abs < LEAN_CUTS[2] ? 2 : 3;
      out[s] = { lean: r3(L), call: Math.sign(L) * step || 0, parts };
    }
    return out;
  }

  // ════════════════════ ⑤ 보통 움직임 범위 (가격만) ════════════════════
  // pts: [{t, v}] 하루 값(오래된 것부터). 금리는 bp, 나머지는 %. 중간값의 6배가 넘는 움직임은 이상치로 빼고 68%·95% 분위수
  function moveOf(sym, a, b) { return RATE[sym] ? (b - a) * 100 : (b / a - 1) * 100; }
  function quantile(sorted, p) { if (!sorted.length) return null; const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }
  function bands(sym, pts) {
    const mv = [];
    for (let i = 1; i < pts.length; i++) if (pts[i - 1].v) mv.push(Math.abs(moveOf(sym, pts[i - 1].v, pts[i].v)));
    const med = median(mv);
    if (med == null || mv.length < 10) return { band68: null, band95: null, med: med, n: mv.length };
    const kept = mv.filter(x => x <= 6 * med).sort((x, y) => x - y);
    return { band68: r3(quantile(kept, 0.68)), band95: r3(quantile(kept, 0.95)), med: r3(med), n: kept.length };
  }

  // ════════════════════ ⑥ 채점 ════════════════════
  // fc: 기록 한 줄(made_at, call, symbol, band68, med_move, seen_value). pts: 그 시세 하루 값 [{t: price_daily ts(ms), v}] 오래된 것부터
  // 날짜만 있는 값(0시 UTC)은 마감 시각(CLOSE_H)으로 봄. ref = 기록 이전 마지막 마감, target = 그다음 마감 → 늦게 올라오는 값도 미래 정보가 안 섞임
  // 비트코인: ref = 기록할 때 본 값(seen_value), target = 기록 + 20시간 뒤 첫 하루 값. 14일 안에 target 이 없으면 결과 3(자료 점검 — 서버가 30일까지는 다시 봄)
  const H = 3600e3, DAY = 86400e3;
  function closeTime(sym, t) { return t % DAY ? t : t + (CLOSE_H[sym] != null ? CLOSE_H[sym] : 24) * H; }
  function grade(fc, pts, now) {
    const made = Date.parse(fc.made_at), sym = fc.symbol;
    const P = pts.map(p => ({ t: closeTime(sym, p.t), v: p.v })).sort((a, b) => a.t - b.t);
    const before = P.filter(p => p.t <= made);
    let ref, target, prev;                            // prev = "전날 방향 그대로" 비교용 직전 움직임(ref 로 끝나는 구간)
    if (sym === "BTCKRW") {
      ref = fc.seen_value != null ? { t: Date.parse(fc.seen_ts || fc.made_at), v: Number(fc.seen_value) } : null;
      target = P.find(p => p.t >= made + 20 * H) || null;
      prev = ref && before.length ? { a: before[before.length - 1], b: ref } : null;
    } else {
      ref = before.length ? before[before.length - 1] : null;
      target = P.find(p => p.t > made) || null;
      prev = before.length > 1 ? { a: before[before.length - 2], b: ref } : null;
    }
    if (!target) return now - made > 14 * DAY ? { outcome: 3, graded_at: new Date(now).toISOString() } : null;   // 아직 기다림
    if (!ref) return { outcome: 3, graded_at: new Date(now).toISOString() };
    const move = moveOf(sym, ref.v, target.v), pm = prev ? moveOf(sym, prev.a.v, prev.b.v) : null;
    const out = { ref_ts: new Date(ref.t).toISOString(), ref_value: ref.v, target_ts: new Date(target.t).toISOString(), target_value: target.v,
      move: r3(move), prev_move: r3(pm), in68: fc.band68 != null ? Math.abs(move) <= fc.band68 : null, in95: fc.band95 != null ? Math.abs(move) <= fc.band95 : null,
      graded_at: new Date(now).toISOString() };
    if (!fc.call) out.outcome = 4;                                                  // 방향 없음
    else if (fc.med_move && Math.abs(move) > 6 * fc.med_move) out.outcome = 3;      // 자료 점검(크게 튐)
    else if (move === 0 || (fc.band68 && Math.abs(move) < 0.25 * fc.band68)) out.outcome = 2;   // 보합
    else out.outcome = Math.sign(move) === Math.sign(fc.call) ? 1 : 0;
    return out;
  }
  // 성적: 주말·휴일엔 여러 기록이 같은 구간(금→월 마감)을 맞히므로 (시세, 결과 시각)마다 가장 늦게 한 기록 하나만 셈(비트코인은 날마다 따로).
  // 맞음/틀림(1/0)만 n 에 넣고, 같은 줄들로 "항상 오름"·"전날 방향 그대로"를 함께 계산
  function score(rows) {
    const last = new Map();
    for (const r of rows) {
      if (r.outcome == null || r.outcome === 3) continue;
      const k = `${r.symbol}|${r.symbol === "BTCKRW" ? r.day : r.target_ts}`, o = last.get(k);
      if (!o || Date.parse(r.made_at) > Date.parse(o.made_at)) last.set(k, r);
    }
    const list = [...last.values()].filter(r => r.outcome === 0 || r.outcome === 1), n = list.length, k = list.filter(r => r.outcome === 1).length;
    const pv = list.filter(r => r.prev_move);
    return { n, k, rate: n ? k / n : null, ci: wilson(k, n), up: n ? list.filter(r => r.move > 0).length / n : null,
      prev: pv.length ? pv.filter(r => Math.sign(r.prev_move) === Math.sign(r.move)).length / pv.length : null, prevN: pv.length,
      calls: [...last.values()].length };
  }
  // 윌슨 95% 범위 (맞음 k / n)
  function wilson(k, n) {
    if (!n) return null;
    const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return [(c - r) / d, (c + r) / d];
  }

  // ════════════════════ ⑦ 오늘의 TOP5 ════════════════════
  // 같은 사건을 언어가 달라도 묶는 별칭 열쇠
  const ENT = [
    [/연준|\bFed\b|Federal Reserve|美联储|FRB|파월|Powell|鲍威尔|パウエル/i, "FED"], [/이란|\bIran|伊朗|イラン/i, "IRAN"], [/이스라엘|Israel|以色列|イスラエル/i, "ISRAEL"],
    [/러시아|Russia|俄罗斯|ロシア|푸틴|Putin|普京|プーチン/i, "RUSSIA"], [/우크라이나|Ukrain|乌克兰|ウクライナ|젤렌스키|Zelensk/i, "UKRAINE"],
    [/트럼프|Trump|特朗普|トランプ/i, "TRUMP"], [/시진핑|Xi Jinping|习近平|習近平/i, "XI"], [/중국|China|Chinese|中国|中國|베이징|Beijing|北京/i, "CHINA"],
    [/일본|Japan|日本|도쿄|Tokyo|東京/i, "JAPAN"], [/일본은행|Bank of Japan|\bBOJ\b|日銀|日本央行/i, "BOJ"], [/엔화|\byen\b|円|日元/i, "YEN"],
    [/OPEC|오펙|欧佩克/i, "OPEC"], [/유가|\boil\b|crude|원유|油价|原油/i, "OIL"], [/호르무즈|Hormuz|霍尔木兹/i, "HORMUZ"], [/가자|Gaza|加沙|ガザ/i, "GAZA"],
    [/하마스|Hamas|哈马斯/i, "HAMAS"], [/헤즈볼라|Hezbollah|真主党/i, "HEZBOLLAH"], [/후티|Houthi|胡塞/i, "HOUTHI"], [/사우디|Saudi|沙特/i, "SAUDI"],
    [/삼성전자|Samsung Electronics|三星电子|サムスン電子/i, "SAMSUNG"], [/하이닉스|Hynix|海力士/i, "HYNIX"], [/TSMC|台积电/i, "TSMC"], [/엔비디아|Nvidia|英伟达/i, "NVIDIA"],
    [/반도체|semiconductor|chip|半导体|芯片|半導体/i, "CHIP"], [/관세(?!청)|tariff|关税|関税/i, "TARIFF"], [/비트코인|Bitcoin|\bBTC\b|比特币|ビットコイン/i, "BTC"],
    [/금리|interest rates?|\brates?\b|利率|金利/i, "RATE"], [/인하|\bcuts?\b|降息|利下げ/i, "CUT"], [/인상(?!적)|\bhikes?\b|加息|利上げ/i, "HIKE"],
    [/수출|export|出口|輸出/i, "EXPORT"], [/휴전|ceasefire|truce|停火|停戦/i, "CEASEFIRE"], [/북한|North Korea|朝鲜|北朝鮮/i, "NK"],
  ];
  const GENERIC_ENT = new Set(["RATE", "CUT", "HIKE", "OIL", "CHINA", "JAPAN", "YEN", "CHIP", "TARIFF", "EXPORT", "CEASEFIRE", "BTC"]);   // 일반 낱말 열쇠(고유 이름 아님)
  const STOP = new Set("the and for with from that this have has was were are will after over into amid says said new its their about more than what when where which while could would should been being also just year years week says report reports update live".split(" "));
  const PARTICLE = /(으로|에서|에게|까지|부터|은|는|이|가|을|를|의|에|로|와|과|도)$/;
  const CLEAN_HEAD = /^\s*(?:\[[^\]]{1,10}\]|\([^)]{1,10}\)|【[^】]{1,10}】)\s*/;
  function cleanTitle(s) {
    let t = String(s || "");
    for (let i = 0; i < 3 && CLEAN_HEAD.test(t); i++) t = t.replace(CLEAN_HEAD, "");
    t = t.replace(/^(World|General|Business|Politics|Economy|Sports)\s?:\s+/, "");          // BERNAMA 제목 앞 분야 표시
    return t.replace(/\s+[-|–—]\s+[^-|–—]{2,30}$/, "").replace(/\((종합|1보|2보|3보|속보|단독)\)/g, "").trim();
  }
  function tokens(title) {
    const t = cleanTitle(title), out = new Set(), ent = new Set();
    for (const [re, k] of ENT) if (re.test(t)) ent.add(k);
    for (const w0 of t.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []) {
      const w = w0.replace(/'s$|['-]+$/, "");             // riyadh's → riyadh, escalation' → escalation
      if (w.length >= 3 && !STOP.has(w)) out.add(w);
    }
    for (const a of t.match(/\b(EU|UN|UK)\b/g) || []) out.add(a.toLowerCase());   // 두 글자 약자 몇 개만(US 는 너무 흔해서 뺌 — 넣으면 다른 기사끼리 묶였음)
    // 한국어는 띄어 쓴 낱말 하나를 조각 하나로(끝의 조사는 떼고) — 두 글자씩 자르면 "이스라엘…공습" 다른 기사끼리도 조각이 많이 겹쳤음(2026-10-11 검토)
    for (const w of t.match(/[가-힣]{2,}/g) || []) out.add(w.length >= 3 ? w.replace(PARTICLE, "") : w);
    // 중국어·일본어는 띄어쓰기가 없어 두 글자씩
    for (const run of t.match(/[一-鿿぀-ヿ]{2,}/g) || []) for (let i = 0; i + 1 < run.length; i++) out.add(run.slice(i, i + 2));
    for (const n of t.match(/\d+(?:\.\d+)?%|\d{2,}(?:[.,]\d+)?/g) || []) out.add(n);
    return { tok: out, ent };
  }
  // 나라 전체 수출 소식: 무역·경상수지, 관세청·산업부 발표, "9월 수출", "수출 증가세" 등 (회사 하나의 "수출 2년 새 4배"는 아님)
  //   (2026-10-11 검토: 그냥 "관세청"·"산업부문"·"10일 수출상담회"는 빼고, "지난달 수출 8.3% 늘어"·"대미 수출 6개월째 감소"는 넣음. 지역 주어로 시작하는 제목은 뺌)
  const NATIONAL_EXPORT = new RegExp("무역수지|경상수지|관세청(?=[^…]{0,20}(수출|수입|무역|잠정|통계))|산업(통상)?(자원)?부(?!문)"
    + "|(\\d+월|10일|20일|1~\\d+월|상반기|하반기|연간|올해|올\\s?들어|지난달|이달|전월|초순|중순|하순)\\s?(수출|무역)(?!\\s?(상담|설명|박람|기업|업체|바우처|지원|유망))"
    + "|(한국|우리나라|전체|대미|대중)\\s?수출|수출\\s?[\\d.,]+\\s?%\\s?(증가|감소|늘|줄|급증|급감)|수출\\s?\\d+개월\\s?(째|연속)"
    + "|수출\\s?(증가|감소|급증|급감|역대|최대|최고|호조|부진|둔화|반등|역성장|늘어|늘었|줄어|줄었)");
  const LOCAL_SUBJ = /^\s*(\[[가-힣]+=[^\]]+\]\s*)?[가-힣]{1,5}(시|군|구)[,\s·]/;   // "창원시, …" "[수원=뉴시스] 수원시 …"
  const DIGEST = /top (markets )?headlines|morning brief|daily brief|live updates?|what to know|, more - bloomberg|주요 뉴스|헤드라인 모음|뉴스 브리핑/i;   // 여러 소식 모음 제목
  // 크기 낱말("Breaking Bad" 같은 제목 속 낱말은 아님 — breaking 은 맨 앞이나 "breaking news" 일 때만)
  //   (비상장·비상근·"Breaking down"·"No surprise" 는 아님 — 2026-10-11 검토)
  const MAG = /속보|긴급|전격|비상(?!장|근|구|대책|대위)|사상\s?(최대|최고|최저)|역대\s?(최대|최고|최저)|^\W*breaking\s*[:|—-]|\b(breaking news|record[- ](high|low)|all-time (high|low)|hits? (a )?record|surprise (rate|cut|hike|move|decision|drop|jump|fall|rise|win)|unexpected|emergency)\b|紧急|突发|速報|過去最高/i;
  // 한 곳만 보도해도 TOP5 에 둘 수 있는 정책 기관(외교부·백악관 등 의례적 발표가 많은 곳은 방향 낱말이 있을 때만)
  const POLICY_SRC = ["Federal Reserve", "ECB", "Bank of Japan", "財務省", "재정경제부", "US Treasury OFAC"];
  const DISASTER_SYM = { Japan: "JPYKRW", Taiwan: "KOSPI", China: "CNYKRW", "South Korea": "KOSPI" };
  // 큰 재난(규모 6.5 이상 지진·GDACS 주황/빨강) 중 우리 시세와 이어지는 나라만
  function disasterOf(it) {
    const sym = DISASTER_SYM[it.country];
    if (!sym || it.category !== "disaster") return null;
    const m = /^M\s?(\d+(?:\.\d+)?)/.exec(it.title || ""), mag = m ? Number(m[1]) : 0, lvl = (/[?&]alertlevel=(orange|red)\b/i.exec(it.url || "") || [])[1];
    if (mag < 6.5 && !lvl) return null;
    return { sym, strong: mag >= 7 || /red/i.test(lvl || "") };   // 규모 7 이상·빨강 경보는 크기 낱말과 같은 무게
  }
  // rows: 기사들(기간은 부르는 쪽이 정함). opt: { now, lang("ko"|"en"|"ja"), stats(오늘 dayStats — z 로 관심 배수 A), store(true면 Bluesky 글을 대표로 안 씀) }
  function top5(rows, opt) {
    const now = opt.now, lang = opt.lang || "ko", z = {}, kst = new Date(now + 9 * H).toISOString().slice(0, 10), tmr = new Date(now + 33 * H).toISOString().slice(0, 10);
    for (const t of TH) z[t.id] = opt.stats && opt.stats.base_days >= 5 && opt.stats.themes[t.id] ? opt.stats.themes[t.id].z : null;
    const evTh = new Set(eventsOn(kst).concat(eventsOn(tmr)).map(e => e.th).filter(Boolean));
    const cands = [];
    for (const it of rows) {
      const title = it.title || "";
      if (it.category === "general" || title.length + (title.match(/[가-힣一-鿿぀-ヿ]/g) || []).length < 12) continue;   // 너무 짧은 제목 빼기(한글·한자·가나는 2칸으로 셈)
      const f = tag(it), dis = f.a ? disasterOf(it) : null;
      // "수출" 주제는 나라 전체 수출 소식일 때만 TOP5 후보(지역 업체 수출상담 같은 기사가 오르지 않게, 2026-10-11 실제 자료)
      const th = f.th.filter(id => id !== "export" || (NATIONAL_EXPORT.test(title) && !LOCAL_SUBJ.test(title)));
      if (!f.a || (!th.length && !dis)) continue;
      const bw = id => TH_BY_ID[id].base * (f.weak[id] ? 0.6 : 1);   // 나라 칸으로만 맞은 주제는 낮게(예: 팔레스타인 노벨상 기사)
      const ths = th.sort((a, b) => bw(b) - bw(a));
      const bases = ths.map(bw).concat(dis ? [0.8] : []).sort((a, b) => b - a);
      const R = bases[0] + 0.15 * Math.min(2, bases.length - 1);
      const h = Math.max(0, (now - tms(it)) / H);
      const T = 0.5 + 0.5 * Math.exp(-h / 8);
      let M = MAG.test(title) || (dis && dis.strong) ? 1.3 : 1;
      if (ths.some(id => f.dir[id])) M = Math.min(1.5, M * 1.15);
      const P = f.rep ? 0.4 : 1;
      const C = ths.some(id => evTh.has(id)) ? 1.2 : 1;
      const zz = ths.map(id => z[id]).filter(v => v != null);
      const A = zz.length ? Math.min(1.6, 1 + 0.15 * Math.max(0, Math.max.apply(null, zz))) : 1;
      const Q = dis ? Math.max(f.q, 0.9) : f.q;                      // 지진·재난 경보는 USGS·GDACS 가 원래 출처
      cands.push({ it, f, ths, dis, s: R * Q * T * M * P * C * A, t: tms(it), ...tokens(title) });
    }
    cands.sort((a, b) => b.s - a.s || a.t - b.t || (a.it.url < b.it.url ? -1 : 1));
    // ponytail: 점수 상위 1,500개만 묶음(하루 1~2만 건 중 시세 주제는 수천) — 더 넓게 보려면 숫자만 올리면 됨(휴대폰 계산 시간 주의)
    const list = cands.slice(0, 1500), clusters = [], index = new Map();
    const common = (a, b) => { let k = 0; for (const x of a) if (b.has(x)) k++; return k; };
    // 서로 상대에게 없는 고유 이름이 하나씩 있으면 다른 사건("이스라엘, 레바논 헤즈볼라 공습" vs "이스라엘, 가자지구 공습", 2026-10-11 검토)
    const distinct = (p, q) => { const only = (a, b) => [...a].some(e => !GENERIC_ENT.has(e) && !b.has(e)); return only(p, q) && only(q, p); };
    const sameLang = (x, y) => {
      if (Math.abs(x.t - y.t) > 12 * H || x.f.lang !== y.f.lang || distinct(x.ent, y.ent)) return false;
      const c = common(x.tok, y.tok), r = c / Math.min(x.tok.size, y.tok.size);
      return (c >= 3 && r >= 0.5) || (c >= 4 && r >= 0.35);           // 긴 제목끼리는 4개 이상 겹치면 비율이 조금 낮아도
    };
    // 언어가 다를 때만: 같은 주제 + 6시간 안 + 방향이 반대가 아님 + 별칭 열쇠가 3개 이상 같거나, 2개 같고(고유 이름 포함) 열쇠가 적은 쪽이 다 겹침
    // (2026-10-11 실제 자료: "트럼프+러시아"만 같은 영어 기사 수십 개가 한 묶음이 되던 것을 막음 — 같은 언어는 낱말 겹침으로만)
    const crossLang = (x, y) => {
      if (x.f.lang === y.f.lang || Math.abs(x.t - y.t) > 6 * H || !x.ths.some(id => y.ths.includes(id))) return false;
      let k = 0, sp = 0;
      for (const e of x.ent) if (y.ent.has(e)) { k++; if (!GENERIC_ENT.has(e)) sp++; }
      if (!sp || !(k >= 3 || (k === 2 && k === Math.min(x.ent.size, y.ent.size)))) return false;   // 고유 이름 없이 일반 열쇠(중국·관세·수출)만 같으면 안 묶음
      if (k === 2) { const p = [...x.ent].filter(e => y.ent.has(e)).sort().join("|"); if ((pairDf.get(p) || 0) > COMMON) return false; }   // "트럼프+러시아"처럼 흔한 짝 둘만으로는 안 묶음
      return !x.ths.some(id => x.f.dir[id] && y.f.dir[id] && x.f.dir[id] === -y.f.dir[id]);
    };
    // 묶음의 첫 기사(+ 같은 언어는 처음 3개)하고만 비교 — 마지막 기사들과 비교하면 묶음이 다른 이야기로 번져 감(2026-10-11 실제 자료: 연준 묶음에 푸틴 기사)
    // 후보 찾기: 같은 언어는 처음 3개 기사의 낱말 조각 색인에서 조각이 3개 이상 겹치는 묶음(많이 겹치는 순), 다른 언어는 첫 기사의 별칭 열쇠 두 개 짝 색인
    const tokIdx = new Map(), pairIdx = new Map();
    const put = (m, k, id) => { let s = m.get(k); if (!s) m.set(k, (s = new Set())); s.add(id); };
    const pairs = ent => { const a = [...ent].sort(), out = []; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) out.push(a[i] + "|" + a[j]); return out; };
    const pairDf = new Map(), COMMON = Math.max(30, list.length * 0.02);   // 별칭 짝이 이 목록에서 몇 기사에 나오는지
    for (const c of list) for (const p of pairs(c.ent)) pairDf.set(p, (pairDf.get(p) || 0) + 1);
    for (const c of list) {
      let home = null;
      const cnt = new Map();
      for (const k of c.tok) {
        const ids = tokIdx.get(k);
        // ponytail: 묶음 400개 넘게 나온 흔한 조각은 후보 세기에서 뺌(계산량) — 그런 조각만 겹치는 기사는 어차피 겹침 비율이 낮음
        if (ids && ids.size <= 400) for (const id of ids) cnt.set(id, (cnt.get(id) || 0) + 1);
      }
      const byTok = [...cnt].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 60);
      for (const [id] of byTok) if (clusters[id].items.slice(0, 3).some(m => sameLang(c, m))) { home = clusters[id]; break; }
      if (!home) {
        const cand = new Set();
        for (const p of pairs(c.ent)) for (const id of pairIdx.get(p) || []) cand.add(id);
        for (const id of [...cand].sort((a, b) => a - b)) if (crossLang(c, clusters[id].items[0])) { home = clusters[id]; break; }
      }
      if (!home) {
        home = { id: clusters.length, items: [] }; clusters.push(home);
        for (const p of pairs(c.ent)) put(pairIdx, p, home.id);
      }
      home.items.push(c);
      if (home.items.length <= 3) for (const k of c.tok) put(tokIdx, k, home.id);
    }
    const events = clusters.map(cl => {
      const lead = cl.items[0], src = { media: new Set(), wire: new Set(), official: new Set() };
      for (const m of cl.items) if (src[m.f.k]) src[m.f.k].add(m.it.source_name);
      const E = Math.min(4.7, 1 + Math.log(1 + src.media.size + 2 * src.wire.size + 2 * src.official.size));
      // 묶음의 주제 = 기사들 점수 합이 가장 큰 주제(첫 기사 하나가 두 소식을 섞은 요약 제목이어도 엉뚱한 주제가 안 붙게)
      const vote = {};
      for (const m of cl.items) for (const id of m.ths) vote[id] = (vote[id] || 0) + m.s;
      const theme = Object.keys(vote).sort((a, b) => vote[b] - vote[a] || TH_BY_ID[b].base - TH_BY_ID[a].base)[0] || "disaster";
      return { cl, lead, theme, E, score: lead.s * E, first: Math.min.apply(null, cl.items.map(m => m.t)), srcs: src.media.size + src.wire.size + src.official.size, src };
    }).filter(e => e.score >= 0.5);
    events.sort((a, b) => b.score - a.score || b.E - a.E || a.first - b.first || (a.lead.it.url < b.lead.it.url ? -1 : 1));
    // 같은 사건이 표현이 달라 두 묶음으로 갈린 경우(예: "Trump establishes committee…Cook" / "Can Trump's bid to fire Lisa Cook succeed?"):
    // 같은 주제이고 드문 낱말(이 목록에서 30개 이하 기사에만 나오는 조각) 2개 이상이 겹치면 앞 사건에 합침
    const df = new Map();
    for (const c of list) for (const k of c.tok) df.set(k, (df.get(k) || 0) + 1);
    const rareOf = e => { const s = new Set(); for (const m of e.cl.items.slice(0, 5)) for (const k of m.tok) { const n = df.get(k) || 0; if (n >= 2 && n <= 30) s.add(k); } return s; };
    // 사건의 방향 = 그 주제 방향을 점수로 가중한 합의 부호
    // 사건의 고유 이름 = 묶음 앞 5개 기사의 별칭 열쇠 합(제목 하나만 보면 "사우디" 쪽과 "후티" 쪽이 다른 사건으로 보였음)
    const entsOf = e => { const s = new Set(); for (const m of e.cl.items.slice(0, 5)) for (const k of m.ent) s.add(k); return s; };
    const evDir = e => { let s = 0; for (const m of e.cl.items) s += (m.f.dir[e.theme] || 0) * m.s; return Math.sign(s); };
    const names = e => new Set(e.cl.items.filter(m => m.f.k !== "x").map(m => m.it.source_name));
    // 큰 사건은 낱말이 흔해져 "드문 낱말"로는 못 잡음(리야드 공항 공격 135건 vs 12건, 2026-10-11) → 묶음마다 가장 자주 나온 낱말 6개(아주 흔한 낱말 빼고)를 비교해
    // 반 이상 같으면(자카드 0.5) 같은 사건
    const sigOf = e => {
      const cnt = new Map();
      for (const m of e.cl.items.slice(0, 40)) for (const k of m.tok) if ((df.get(k) || 0) <= list.length * 0.25) cnt.set(k, (cnt.get(k) || 0) + 1);
      return new Set([...cnt].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 6).map(x => x[0]));
    };
    const jac = (a, b) => { const k = common(a, b); return k / (a.size + b.size - k || 1); };
    const per = {}, out = [], rare = [], dirs = [], srcSets = [], sigs = [], ents = [];
    for (const e of events) {
      if (out.length >= 5) break;
      const rs = rareOf(e), dv = evDir(e), sg = sigOf(e), en = entsOf(e);
      // 합치는 조건: 같은 주제 · 첫 보도 12시간 안 · 방향이 반대가 아님 · 고유 이름이 서로 다르지 않음 + (드문 낱말 2개 / 자주 나온 낱말 절반 / 자주 나온 낱말 3개 + 드문 낱말 1개)
      const dup = out.findIndex((o, i) => o.theme === e.theme && Math.abs(o.first - e.first) <= 12 * H && !(dirs[i] && dv && dirs[i] === -dv) && !distinct(ents[i], en)
        && (common(rare[i], rs) >= 2 || jac(sigs[i], sg) >= 0.5 || (common(sigs[i], sg) >= 3 && common(rare[i], rs) >= 1)));
      if (dup >= 0) { out[dup].n += e.cl.items.length; for (const s of names(e)) srcSets[dup].add(s); out[dup].srcs = srcSets[dup].size; out[dup].first = Math.min(out[dup].first, e.first); continue; }
      if (opt.store && e.cl.items.every(m => isBsky(m.it.url))) continue;   // 보관본: Bluesky 글뿐인 사건은 제목을 남길 수 없으니 뺌
      // 한 곳만 보도한 소식은 빼기(조용한 날 지역 기사가 채워지지 않게) — 거시 공식 발표·큰 재난·속보 같은 말이 있으면 예외
      if (e.srcs < 2 && !(POLICY_SRC.includes(e.lead.it.source_name) || (e.lead.f.a >= 3 && e.lead.f.dir[e.theme]) || e.lead.dis || MAG.test(e.lead.it.title || ""))) continue;
      if ((per[e.theme] || 0) >= 2) continue;
      per[e.theme] = (per[e.theme] || 0) + 1;
      rare.push(rs); dirs.push(dv); srcSets.push(names(e)); sigs.push(sg); ents.push(en);
      // 대표 기사: ① 통신사·공식의 한국어 기사(점수가 최고의 0.6배 이상 — 느슨하게 붙은 기사가 제목이 되지 않게) ② 화면 언어 기사 중 0.8배 이상 ③ 묶음에서 점수가 가장 높은 기사
      const all = e.cl.items.filter(m => !opt.store || !isBsky(m.it.url)), onTheme = all.filter(m => m.ths.includes(e.theme) || (e.theme === "disaster" && m.dis));
      const fit = onTheme.length ? onTheme : all, plain = fit.filter(m => !DIGEST.test(m.it.title || ""));   // 묶음의 주제에 맞는 기사, 여러 소식 모음 제목은 뒤로
      const pool = plain.length ? plain : fit, best = pool.length ? pool[0].s : 0;
      const rep = pool.filter(m => m.f.lang === "ko" && (m.f.k === "wire" || m.f.k === "official") && m.s >= 0.6 * best).sort((a, b) => b.s - a.s)[0]
        || pool.filter(m => m.f.lang === lang && m.s >= 0.8 * best).sort((a, b) => b.s - a.s)[0]
        || pool[0] || null;                                            // ③ 묶음에서 점수가 가장 높은 기사(묶음의 중심)
      const syms = e.theme === "disaster" ? [e.lead.dis.sym] : Object.keys(TH_BY_ID[e.theme].m).sort((a, b) => Math.abs(TH_BY_ID[e.theme].m[b]) - Math.abs(TH_BY_ID[e.theme].m[a])).slice(0, 3);
      const why = { st: e.src.official.size ? "official" : e.src.wire.size ? "wire" : "media", mag: MAG.test(e.lead.it.title || ""),
        dir: dv, z: z[e.theme] != null ? z[e.theme] : null, sched: evTh.has(e.theme) };
      out.push({ theme: e.theme, score: r3(e.score), E: r3(e.E), n: e.cl.items.length, srcs: srcSets[srcSets.length - 1].size, first: e.first, syms, why,
        rep: rep ? { title: rep.it.title, url: rep.it.url, src: rep.it.source_name, st: rep.it.source_type, t: rep.t, lang: rep.f.lang } : null,
        item: opt.store ? undefined : rep ? rep.it : null, dbg: opt.debug ? [`sig ${[...sg].join(",")} | rare ${[...rs].slice(0, 12).join(",")}`].concat(e.cl.items.slice(0, 8).map(m => `${m.f.lang} ${m.ths.join(",")} ${m.s.toFixed(2)} ${[...m.ent].join("+")} | ${m.it.title}`)) : undefined });
    }
    return out;
  }

  g.RF = { VER, RULES, CLOSE_H, THEMES, TH, SYMBOLS, RATE, unitOf, LEAN_CUTS, MACRO, NAMED_WIRE, EXCLUDED, CAL, CAL_SRC, CAL_LAST, eventsOn,
    compile, langOf, isReport, tag, isBsky, dayStats, lean, bands, moveOf, grade, score, wilson, cleanTitle, tokens, top5, median, NATIONAL_EXPORT, LOCAL_SUBJ, MAG };
})(typeof globalThis !== "undefined" ? globalThis : this);
