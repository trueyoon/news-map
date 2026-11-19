// 뉴스 주제 ↔ 국내 상장 ETF 연결 규칙 (2026-11-19 사용자 요청 "① ETF부터" — 최종 목표: 세계정세 → 투자 상품 연결 추론)
// 화면(news-map/etf-link.js)과 서버(news-site/supabase/functions/etf/)가 같이 쓰는 파일 — 서버 것은 이 파일을 글자까지 같게 복사(test.mjs 가 검사).
//   ⚠️ 이 파일을 고치면: cp ../news-map/etf-core.js supabase/functions/etf/etf-core.js → node supabase/functions/etf/test.mjs → etf 함수 다시 배포.
// - 출처: 금융위원회_증권상품시세정보 getETFPriceInfo_V2 (data.go.kr 15094806, 공공누리 4유형 — 출처 표시·비영리·변경 금지 → 값 그대로, 로그인 화면에만)
// - 주제(THEMES)마다: etf = ETF 이름에서 찾을 말, news = 뉴스 제목에서 찾을 말, countries = 그 나라에서 난 경제 기사(news.country), strip = 찾기 전에 지울 함정 말.
// - 서버가 주제마다 순자산이 큰 ETF 를 max 개(같은 지수는 하나만)씩 골라 저장 → 화면은 저장된 목록만 씀.
// - 레버리지·인버스·커버드콜·채권혼합·머니마켓·만기형 채권·TDF 는 뺌(NOISE) — 사건과 값 움직임을 비교하기 어려움.
// ⚠️ 화면 파일이라 정규식에 뒤보기((?<= (?<!) 금지 — 옛 아이폰에서 파일 전체가 멈춤. 앞보기 (?= (?! 는 괜찮음.
(function (g) {
  if (g.ETFX) return;
  const VER = "1";
  const NOISE = /레버리지|인버스|2X|커버드콜|콜매도|채권혼합|국채혼합|미국채혼합|혼합50|밸런스|TDF|TRF|머니마켓|CD금리|CD1년|KOFR|SOFR|타겟|프리미엄|단기채|단기국공채|통안채|전단채|회사채|금융채|은행채|특수은행채|크레딧|\d\d-\d\d|적격|위클리|데일리|자동연장|초단기|변동금리/;
  const MIN_ASSETS = 50e8;   // 순자산 50억 원 미만은 거래가 적어 뺌

  // 주제 목록 — 순서 = 한 뉴스에 여러 주제가 맞을 때 앞의 것을 먼저 보임(좁고 확실한 주제를 앞에)
  const THEMES = [
    // ── 원자재·통화·금리 ──
    { id: "gold", ko: "금", en: "Gold", ja: "金", etf: /금현물|골드|금선물/,
      news: [/금값|금 ?시세|금 ?가격|국제 ?금(?:값|가격|시세)|금 현물|금 선물|黄金|金価格|金相場|金先物/, /\bgold (?:price|prices|futures|rall\w*|hits|record|demand|reserves?|bullion)|\bbullion\b|\bprecious metals?\b|\bgold (?:climbs|falls|rises|slips|jumps|edges|steadies|surges|drops)/i] },
    { id: "silver", ko: "은", en: "Silver", ja: "銀", etf: /은선물|실버/, news: [/은값|은 ?가격|白银(?:价格|期货|跌|涨)|银价|銀価格/, /\bsilver (?:price|prices|futures|rall\w*)/i] },
    { id: "copper", ko: "구리", en: "Copper", ja: "銅", etf: /구리/, news: [/구리 ?(?:값|가격|시세|선물)|전기동|铜价|銅価格/, /\bcopper\b/i] },
    { id: "oil", ko: "원유", en: "Crude oil", ja: "原油", etf: /WTI|원유|브렌트/,
      news: [/국제 ?유가|유가(?![족증])|원유|산유국|감산|석유수출국|油价|原油|オペック/, /\bcrude\b|\b(?:crude |Brent |global )?oil (?:price|prices|futures|market|output|supply|demand)|\bOPEC\b|\bBrent (?:crude|oil|futures|rises|falls)|\bWTI\b/],
      strip: /유가증권|\(유가\)|유가족/g },
    { id: "gas", ko: "천연가스", en: "Natural gas", ja: "天然ガス", etf: /천연가스/, news: [/천연가스|LNG|天然气|天然ガス/, /\bnatural gas\b|\bLNG\b/i] },
    { id: "agri", ko: "농산물", en: "Agriculture", ja: "農産物", etf: /농산물|곡물|콩선물|옥수수/,
      news: [/곡물|옥수수 ?(?:값|가격|수입|선물)|대두 ?(?:값|가격|수입|선물)|소맥|밀 ?가격|粮食|大豆|小麦/, /\bwheat\b|\bsoybeans?\b|\bcorn (?:price|prices|futures|crop|exports?)|\bgrain (?:price|prices|exports?|deal|market)/i] },
    { id: "usd", ko: "달러", en: "US dollar", ja: "ドル", etf: /미국달러선물/,
      news: [/원\/달러|원·달러|원달러|원-달러|달러 ?강세|달러 ?약세|강달러|약달러|달러 ?인덱스|환율|美元指数|美元走强|美元走弱|美元汇率|ドル高|ドル安/, /\bdollar (?:index|rall\w*|strength|weak\w*|slips|gains|falls|rises)|\bKorean won\b|\bwon (?:falls|weakens|strengthens|slides|hits)/i] },
    { id: "jpy", ko: "엔화", en: "Yen", ja: "円", etf: /일본엔선물|일본엔화/, news: [/엔화|엔저|엔고|円安|円高|日元汇率|日元贬值|日元升值/, /\byen (?:weak|strong|slid|slump|fall|rise|gain|hit|plung|rall|rebound|drop|surg|tumbl)\w*|\b(?:weak|strong)(?:er|ening)? yen\b|\bUSD\/JPY\b|\bdollar-yen\b|\b(?:against|versus|vs\.?) (?:the )?yen\b/i] },
    { id: "ust", ko: "미국 국채", en: "US Treasuries", ja: "米国債", etf: /미국.*국채|미국채|미국10년|미국30년/,
      news: [/미 ?국채|미국채|연준|파월|美债|美联储|米国債|米連銀|FRB/, /\bTreasur(?:y|ies) (?:yields?|bonds?|notes?|market)|\bFed\b|\bFederal Reserve\b|\bFOMC\b|\bPowell\b|\brate cuts?\b|\brate hikes?\b/] },
    { id: "ktb", ko: "한국 국채", en: "Korea bonds", ja: "韓国国債", etf: /국고채/,
      news: [/국고채|금통위|한국은행|한은 (?:기준금리|총재|금리)|한은 "|이창용/, /\bBank of Korea\b|\bBOK\b/] },
    // ── 산업 ──
    { id: "semis", ko: "반도체", en: "Semiconductors", ja: "半導体", etf: /반도체|HBM/, max: 3,
      news: [/반도체|HBM|D램|디램|낸드|파운드리|半导体|芯片|半導体/, /\bsemiconductors?\b|\bchipmakers?\b|\bchips? (?:export|exports|ban|curbs|controls|sales|plant|factory|stocks|shares|demand|supply|war|act)|\bAI chips?\b|\bDRAM\b|\bNAND\b|\bfoundry\b|\bTSMC\b|\bNvidia\b|\bASML\b/i] },
    { id: "nvidia", ko: "엔비디아", en: "Nvidia", ja: "エヌビディア", etf: /엔비디아/, news: [/엔비디아|英伟达|エヌビディア/, /\bNvidia\b/i] },
    { id: "tesla", ko: "테슬라", en: "Tesla", ja: "テスラ", etf: /테슬라/, news: [/테슬라|特斯拉|テスラ/, /\bTesla\b/] },
    { id: "battery", ko: "이차전지", en: "Batteries", ja: "二次電池", etf: /2차전지|이차전지|배터리|리튬/, max: 3,
      news: [/이차전지|2차전지|배터리|리튬|양극재|전고체|电池|锂|電池|リチウム/, /\bbatter(?:y|ies)\b|\blithium\b|\bcathode\b/i] },
    { id: "ev", ko: "전기차", en: "EVs", ja: "電気自動車", etf: /전기차|자율주행/, news: [/전기차|电动车|电动汽车|新能源车|電気自動車/, /\bEVs?\b|\belectric vehicles?\b|\belectric cars?\b/] },
    { id: "power", ko: "전력망", en: "Power grid", ja: "電力網", etf: /전력|전기설비|전력기기/,
      news: [/전력망|송전|배전|변압기|전력기기|전력 ?수요|전력난|전기요금|电网|送電網|変圧器/, /\bpower grids?\b|\btransformers?\b|\belectricity (?:demand|prices|grid|supply)|\bpower (?:demand|shortage|supply|prices)/i] },
    { id: "nuclear", ko: "원전", en: "Nuclear power", ja: "原発", etf: /원자력|원전|SMR|우라늄/,
      news: [/(?:^|[^응기])원전|원자력|SMR|소형모듈원자로|우라늄|核电|原発|原子力/, /\bnuclear (?:power|plants?|reactors?|energy|fuel|project)|\bSMRs?\b|\buranium (?:price|prices|supply|mine|mining|demand)|\breactors?\b/i],
      strip: /원자력안전위원회|핵무기|북핵|우라늄 ?농축|nuclear weapons?|uranium enrichment|enrichment/gi },
    { id: "defense", ko: "방산", en: "Defense", ja: "防衛", etf: /방산|방위/,
      news: [/방산|방위산업|무기 ?수출|국방비|국방예산|K-?9|K-?2 ?전차|천무|군함 수주|军工|军费|防衛費|防衛産業/, /\bdefen[cs]e (?:industry|contractors?|stocks?|spending|budgets?|firms?|companies|exports?|deal)|\barms (?:deals?|exports?|sales|makers?|race)|\bmilitary spending\b|\bweapons (?:makers?|exports?|deal)/i] },
    { id: "space", ko: "우주항공", en: "Space", ja: "宇宙", etf: /우주/,
      news: [/(?:^|[^호])우주|위성|발사체|누리호|스페이스X|航天|卫星|宇宙/, /\bSpaceX\b|\bsatellites?\b|\brocket launch|\bspace (?:station|launch|industry|agency|program|race|tourism)|\bNASA\b|\bStarlink\b/i] },
    { id: "ship", ko: "조선", en: "Shipbuilding", ja: "造船", etf: /조선/,
      news: [/조선업|조선사|조선소|조선주|조선 ?3사|조선 ?빅3|K-?조선|선박 수주|LNG ?운반선|컨테이너선 수주|군함|함정 수주|MASGA|마스가|造船|船舶/, /\bshipbuild\w*|\bshipyards?\b|\bnaval ships?\b|\bLNG carriers?\b/i] },
    { id: "shipping", ko: "해운·운송", en: "Shipping", ja: "海運", etf: /해운|운송/,
      news: [/해운(?!대)|운임|컨테이너 ?운임|SCFI|벌크선|항만 물동량|海运|海運/, /\bfreight rates?\b|\bshipping (?:rates?|costs?|lines?|companies|industry|routes?)|\bcontainer (?:rates?|shipping)|\bRed Sea shipping\b/i] },
    { id: "robot", ko: "로봇", en: "Robotics", ja: "ロボット", etf: /로봇/, news: [/로봇|휴머노이드|机器人|ロボット/, /\brobot\w*|\bhumanoids?\b/i] },
    { id: "quantum", ko: "양자컴퓨터", en: "Quantum computing", ja: "量子", etf: /양자/, news: [/양자 ?컴퓨|양자 ?기술|양자 ?암호|量子/, /\bquantum\b/i] },
    { id: "ai", ko: "AI", en: "AI", ja: "AI", etf: /AI|인공지능/, excl: /반도체|전력|로봇|엔비디아|테슬라|팔란티어|구글/, max: 2, need: true,
      news: [/인공지능|생성형|챗GPT|오픈AI|데이터센터|人工智能|大模型|生成AI|データセンター/, /\bAI\b|\bartificial intelligence\b|\bOpenAI\b|\bChatGPT\b|\bdata cent(?:er|re)s?\b|\bAnthropic\b|\bGemini\b/] },
    { id: "bigtech", ko: "미국 빅테크", en: "US Big Tech", ja: "米ビッグテック", etf: /빅테크|테크TOP10|나스닥100$/, max: 2, need: true,
      news: [/빅테크|애플|마이크로소프트|구글|알파벳|아마존|메타 |苹果|微软|谷歌|亚马逊/, /\bBig Tech\b|\bMagnificent Seven\b|\bApple\b|\bMicrosoft\b|\bAlphabet\b|\bGoogle\b|\bAmazon\b|\bMeta\b/] },
    { id: "bio", ko: "바이오", en: "Biotech", ja: "バイオ", etf: /바이오|헬스케어|제약/, max: 2,
      news: [/바이오|제약|신약|임상 ?[123]상|임상시험|품목허가|FDA|비만약|위고비|创新药|医药|製薬|新薬/, /\bbiotech\w*|\bpharma\w*|\bdrugmakers?\b|\bFDA\b|\bclinical trials?\b|\bweight-loss drugs?\b|\bGLP-1\b/i] },
    { id: "auto", ko: "자동차", en: "Autos", ja: "自動車", etf: /자동차|현대차그룹/,
      news: [/자동차|완성차|현대차|기아 |车企|汽车|自動車|トヨタ/, /\bautomakers?\b|\bcarmakers?\b|\bauto (?:sales|tariffs?|industry|exports?|parts|makers?)|\bcar (?:sales|exports?|industry|tariffs?)|\bToyota\b|\bHyundai Motor\b/i] },
    { id: "steel", ko: "철강", en: "Steel", ja: "鉄鋼", etf: /철강/, news: [/철강|포스코|钢铁|鉄鋼/, /\bsteel\w*\b/i], strip: /steel(?:ers|e)\b/gi },
    { id: "chem", ko: "석유화학", en: "Chemicals", ja: "化学", etf: /에너지화학|화학/, news: [/석유화학|화학업|에틸렌|石化|石油化学/, /\bpetrochemicals?\b|\bchemical (?:makers?|industry|companies|plants?)/i] },
    { id: "build", ko: "건설", en: "Construction", ja: "建設", etf: /건설/,
      news: [/건설사|건설업|건설주|해외건설|건설 수주|플랜트 수주|주택 공급|분양|建筑|建設/, /\bconstruction (?:firms?|companies|sector|industry|orders?|spending|output)|\bhomebuild\w*|\bhousing starts\b/i] },
    { id: "reit", ko: "리츠·부동산", en: "REITs / Real estate", ja: "REIT・不動産", etf: /리츠|부동산/, max: 2,
      news: [/부동산|리츠|집값|아파트값|아파트 ?가격|전셋값|전세가|주택 ?가격|주택시장|房地产|楼市|房价|不動産/, /\bREITs?\b|\breal estate\b|\bhome prices\b|\bhousing market\b|\bproperty (?:market|prices|sector|developers?)/i] },
    { id: "bank", ko: "은행·금융", en: "Banks", ja: "銀行", etf: /은행|금융지주/,
      news: [/은행주|은행권|시중은행|금융지주|예대마진|가계대출|银行股|银行业|銀行株|メガバンク/, /\bbanks? (?:shares|stocks|earnings|profits?|lending|deposits|results)|\bbanking (?:sector|stocks|shares|system|crisis)|\blenders?\b|\bbank (?:stocks|shares|earnings)/i],
      strip: /한국은행|한은|중앙은행|세계은행|아시아개발은행|인민은행|일본은행|유럽중앙은행|수출입은행|산업은행|World Bank|Bank of (?:Korea|Japan|England|Canada|America)|central banks?|Asian Development Bank|Reserve Bank|People's Bank|food banks?|bank holiday|West Bank|中央银行|日本銀行|日銀/g },
    { id: "broker", ko: "증권", en: "Brokers", ja: "証券", etf: /증권$|증권고배당/, news: [/증권사|증권주|거래대금|증시 ?활황|券商|証券会社/, /\bbrokerages?\b|\bbrokers?\b/i] },
    { id: "cosme", ko: "화장품", en: "Cosmetics", ja: "化粧品", etf: /화장품|뷰티/, news: [/화장품|K-?뷰티|化妆品|化粧品/, /\bcosmetics\b|\bbeauty (?:brands?|industry|sector|products)|\bK-beauty\b/i] },
    { id: "ent", ko: "엔터·콘텐츠", en: "Entertainment", ja: "エンタメ", etf: /엔터|미디어|콘텐츠|K-?POP/, need: true,
      news: [/K-?팝|케이팝|아이돌|엔터|하이브|드라마|웹툰|한류|넷플릭스|韩流|K-POP/, /\bK-?pop\b|\bK-?drama\b|\bNetflix\b|\bstreaming\b|\bBTS\b|\bBLACKPINK\b|\bHYBE\b/i] },
    { id: "game", ko: "게임", en: "Games", ja: "ゲーム", etf: /게임/, news: [/게임사|게임주|게임업계|신작 게임|넥슨|엔씨소프트|크래프톤|游戏|ゲーム会社/, /\bvideo ?games?\b|\bgaming (?:industry|company|giant|stocks?)|\bgame (?:developers?|publishers?|makers?|studios?)/i] },
    { id: "hydrogen", ko: "수소", en: "Hydrogen", ja: "水素", etf: /수소/, news: [/수소|氢能|水素/, /\bhydrogen\b/i], strip: /수소문/g },
    { id: "green", ko: "신재생에너지", en: "Renewables", ja: "再エネ", etf: /신재생|태양광|풍력|친환경에너지|클린에너지/,
      news: [/태양광|풍력|신재생|재생에너지|탄소중립|光伏|风电|太陽光|風力/, /\bsolar\b|\bwind (?:power|farms?|energy|turbines?)|\brenewables?\b|\brenewable energy\b|\boffshore wind\b/i] },
    // ── 나라·지역 (그 나라에서 난 경제 기사 + 제목에 나라 증시 이야기) ──
    { id: "kr", ko: "한국 증시", en: "Korea stocks", ja: "韓国株", etf: /^KODEX 200$|^TIGER 200$|코스닥150$/, idxEq: ["코스피 200", "코스닥 150"], max: 2,
      news: [/코스피|코스닥|국내 ?증시|외국인 ?순매수|외국인 ?순매도|韩国股市|韓国株/, /\bKOSPI\b|\bKOSDAQ\b|\bKorean (?:stocks|shares|market)/i],
      nation: ["South Korea"] },
    { id: "us", ko: "미국 증시", en: "US stocks", ja: "米国株", etf: /S&P500$|나스닥100$|다우존스$/, idxEq: ["S&P 500", "NASDAQ 100"], max: 2,
      news: [/뉴욕증시|뉴욕 ?증시|미 ?증시|미국 ?증시|S&P ?500|나스닥|다우지수|美股|米国株|ダウ平均/, /\bWall Street\b|\bS&P 500\b|\bNasdaq\b|\bDow Jones\b|\bUS stocks\b|\bU\.S\. stocks\b/i],
      nation: ["United States"] },
    { id: "cn", ko: "중국", en: "China", ja: "中国", etf: /차이나|중국|CSI|항셍|과창판|홍콩/, excl: /전기차|반도체|로봇|휴머노이드|AI/, max: 2,
      news: [/중국 ?(?:경제|증시|경기|부양|수출|성장률)|항셍|상하이 ?증시|A股|港股|恒生|上证/, /\bChina'?s? (?:economy|stocks|exports|growth|stimulus|GDP)|\bChinese (?:economy|stocks|exports)|\bHang Seng\b|\bShanghai Composite\b/i],
      nation: ["China", "Hong Kong"] },
    { id: "jp", ko: "일본", en: "Japan", ja: "日本", etf: /일본|니케이|TOPIX/, excl: /엔선물|엔화/, max: 2,
      news: [/일본 ?(?:경제|증시|경기|수출|성장률)|닛케이|니케이|日经|日経平均|東証|TOPIX/, /\bNikkei\b|\bTopix\b|\bJapan'?s? (?:economy|stocks|exports|GDP)|\bJapanese (?:economy|stocks|exports)/i],
      nation: ["Japan"] },
    { id: "tw", ko: "대만", en: "Taiwan", ja: "台湾", etf: /대만/, news: [/대만 ?(?:경제|증시|수출)|台股|加權指數/, /\bTaiwan'?s? (?:economy|stocks|exports|GDP)|\bTaiex\b/i], countries: ["Taiwan"] },
    { id: "vn", ko: "베트남", en: "Vietnam", ja: "ベトナム", etf: /베트남/, need: "econ", news: [/베트남/, /\bVietnam\w*|\bViet Nam\b|\bVN-?Index\b/i], countries: ["Vietnam"] },
    { id: "in", ko: "인도", en: "India", ja: "インド", etf: /인도(?!네시아)|니프티|Nifty|센섹스/, max: 2,
      news: [/인도 ?(?:경제|증시|경기|수출|성장률|시장)|센섹스|니프티|印度经济|インド経済/, /\bIndia'?s? (?:economy|stocks|exports|GDP|growth|markets?)|\bIndian (?:economy|stocks|markets?)|\bSensex\b|\bNifty\b/i],
      countries: ["India"] },
    { id: "id", ko: "인도네시아", en: "Indonesia", ja: "インドネシア", etf: /인도네시아/, need: "econ", news: [/인도네시아/, /\bIndonesia\w*/i], countries: ["Indonesia"] },
    { id: "eu", ko: "유럽", en: "Europe", ja: "欧州", etf: /유로스탁스|유럽|STOXX/, excl: /탄소배출권|배당/,
      news: [/유럽 ?(?:경제|증시|경기)|유로존|ECB|유럽중앙은행|欧元区|ユーロ圏/, /\beurozone\b|\beuro zone\b|\bECB\b|\bEuropean (?:stocks|shares|economy)|\bSTOXX\b|\bDAX\b|\bCAC 40\b/i],
      countries: ["Germany", "France", "Italy", "Spain", "Netherlands", "Belgium", "Austria", "Ireland", "Portugal", "Finland", "Greece", "European Union"] },
    { id: "latam", ko: "중남미", en: "Latin America", ja: "中南米", etf: /라틴|브라질|멕시코/, max: 2, need: "econ",
      news: [/브라질|멕시코|아르헨티나|중남미|칠레/, /\bBrazil\w*|\bMexic\w*|\bArgentin\w*|\bLatin America\w*|\bChile\b/i],
      countries: ["Brazil", "Mexico", "Argentina", "Chile", "Colombia", "Peru"] },
  ];
  const BY = new Map(THEMES.map(t => [t.id, t]));
  const num = v => (v == null || v === "" ? 0 : Number(String(v).replace(/,/g, "")));
  const isNoise = name => NOISE.test(name || "");
  const normIdx = s => String(s || "").replace(/\((?:PR|TR|NTR|ER|H|원화환산|시장가격(?: 지수)?|총수익(?:지수)?|Price Return|Total Return)\)/gi, "")
    .replace(/Price Return|Total Return|지수|Index|\bTR\b|\bPR\b|\s+/gi, "").toLowerCase();

  // 하루치 ETF 원자료 → 주제마다 고른 ETF (etf_items 줄). 같은 ETF 가 여러 주제에 들면 themes 에 모두.
  function pick(raw) {
    const ok = raw.filter(i => !isNoise(i.itmsNm) && num(i.nPptTotAmt) >= MIN_ASSETS)
      .sort((a, b) => num(b.nPptTotAmt) - num(a.nPptTotAmt));
    const out = new Map();
    for (const t of THEMES) {
      const seenIdx = new Set();
      let n = 0;
      for (const i of ok) {
        if (n >= (t.max || 1)) break;
        const hit = (t.idxEq && t.idxEq.includes(String(i.bssIdxIdxNm || "").trim())) || t.etf.test(i.itmsNm);
        if (!hit || (t.excl && t.excl.test(i.itmsNm))) continue;
        const k = normIdx(i.bssIdxIdxNm) || i.srtnCd;
        if (seenIdx.has(k)) continue;
        seenIdx.add(k); n++;
        const e = out.get(i.srtnCd) || out.set(i.srtnCd, {
          code: i.srtnCd, name: i.itmsNm, idx_name: i.bssIdxIdxNm || null, isin: i.isinCd || null,
          assets: Math.round(num(i.nPptTotAmt)), themes: [], active: true,
          picked_on: `${i.basDt.slice(0, 4)}-${i.basDt.slice(4, 6)}-${i.basDt.slice(6, 8)}` }).get(i.srtnCd);
        e.themes.push(t.id);
      }
    }
    return [...out.values()];
  }

  // 뉴스 한 건 → 맞는 주제 id 목록(THEMES 순서). DART 공시는 안 봄(종목 연결이 따로 있음).
  // need: true 인 넓은 주제(AI·빅테크·엔터)는 투자 낱말도 같이 있어야 — "구글 접속 장애"·"넷플릭스 드라마" 같은 기사를 빼려고
  const NEED = /주가|실적|매출|영업이익|시가총액|투자|관련주|엔터주|급등|급락|상장|수출|수주|인수|상승|하락|shares?\b|stocks?\b|earnings|revenue|profit|results|capex|invest|market (?:cap|value)|valuation|IPO|deal|billion|trillion|rall(?:y|ies)|surge|plunge|slump|股价|股票|财报|营收|投资|涨|跌|株価|決算|投資|上場/i;
  const SKIP = /^\s*\[(?:부고|인사|게시판|포토|사진|부음)\]/;
  function themesOf(it) {
    const title = String(it && it.title || "");
    if (!title || it.source_name === "DART 공시" || SKIP.test(title)) return [];
    const out = [];
    for (const t of THEMES) {
      const s = t.strip ? title.replace(t.strip, " ") : title;
      // need: "econ" (나라 이름만으로 찾는 주제) 는 경제 기사이기만 해도 됨
      if (t.news.some(re => re.test(s)) && (!t.need || NEED.test(s) || (t.need === "econ" && it.category === "economy"))) out.push(t.id);
    }
    return out;
  }
  // 그 주제로 이어진 까닭: 제목에서 맞은 말(코멘트 "제목의 '반도체' 때문에"). 못 찾으면 null
  function whyOf(it, id) {
    const t = BY.get(id), title = String(it && it.title || "");
    if (!t || !title) return null;
    const s = t.strip ? title.replace(t.strip, " ") : title;
    for (const re of t.news) { const m = s.match(re); if (m && m[0].trim()) return m[0].trim().slice(0, 24); }
    return null;
  }
  // 장소로만 맞는 나라 주제: 그 나라에서 난 경제 기사(news.country) — 팝업에서 제목 주제가 모자랄 때만 씀(미국·중국·일본처럼 기사가 많은 나라는 없음)
  function placeTheme(it) {
    if (!it || it.category !== "economy" || it.source_name === "DART 공시") return null;
    return countryTheme(String(it.country || ""));
  }
  // 나라 이름(영어, news.country 표기) → 그 나라 주제 id. all=true 면 미국·중국·일본도(나라 검색에서 씀)
  function countryTheme(country, all) {
    country = String(country || "").split(",")[0].trim();   // GDELT 표기 "Vietnam, Democratic Republic of" → Vietnam
    for (const t of THEMES) if ((t.countries && t.countries.includes(country)) || (all && t.nation && t.nation.includes(country))) return t.id;
    return null;
  }
  g.ETFX = { VER, THEMES, BY, NOISE, MIN_ASSETS, isNoise, normIdx, pick, themesOf, whyOf, placeTheme, countryTheme };
})(typeof globalThis !== "undefined" ? globalThis : this);
