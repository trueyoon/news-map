// 뉴스 ↔ 종목 연결 규칙 (2026-11-18 사용자 요청). 화면(stock-link.js)이 쓰고, PC 에서 node 로 시험(news-site/stocks/test.mjs).
// - 종목 목록(이름·코드·시가총액 순위)은 DB 표 stk_items 에서 받음(수집기가 매주 시가총액 상위로 고름).
// - 이 파일은 "제목의 어떤 말을 어느 종목으로 볼지"만 정함: 공식 이름 + 줄임말·영어 이름(ALIAS) − 헷갈리는 이름(SKIP·NOT).
// - DART 공시 제목 "(유가)삼성전자 - …"은 회사 이름이 정확히 적혀 있으므로 그 이름과 똑같은 종목만.
// 정규식에 (?<= (?<! (앞쪽 조건)는 쓰지 말 것 — 옛 아이폰에서 파일 전체가 멈춤.
(function (g) {
  // 공식 이름만으로는 다른 뜻·그룹 전체로 더 자주 쓰여서 이름으로는 안 잇는 종목(별칭이 있으면 그 별칭으로만)
  //   SK·LG·GS·LS·CJ·한화·두산 = 그룹 이름 / 동서·태성·삼현·테스(테스트) = 일반 낱말 / NC = 야구단 / ISC = 일반 약자
  const SKIP = new Set(["SK", "LG", "GS", "LS", "CJ", "한화", "두산", "동서", "태성", "삼현", "테스", "NC", "ISC", "에스원", "효성", "고영"]);
  // 줄임말·다른 표기·영어 이름. 문자열은 그대로, /정규식/ 은 그대로 판정(영어는 낱말 경계 \b 를 직접 씀)
  const ALIAS = {
    "삼성전자": ["Samsung Electronics", /\bSamsung\b(?!\s?(SDI|Biologics|Bioepis|C&T|Heavy|Life|Fire|SDS|Electro|E&A|Securities|Card|Engineering|Epis|Group|Lions))/],
    "SK하이닉스": ["하이닉스", "Hynix"],
    "LG에너지솔루션": ["LG엔솔", "LG Energy Solution", "LGES"],
    "삼성바이오로직스": ["삼성바이오", "Samsung Biologics"],
    "현대차": ["현대자동차", "Hyundai Motor", /\bHyundai\b(?!\s?(Heavy|Mobis|Glovis|Steel|Engineering|E&C|Rotem|Construction|Elevator|Marine|Merchant|Department|Wia|AutoEver|Electric|Oilbank|Development|Doosan|Card|Capital|Bioscience|HD))/],
    "기아": ["Kia"],
    "셀트리온": ["Celltrion"],
    "삼성물산": ["Samsung C&T"],
    "삼성SDI": ["Samsung SDI"],
    "삼성전기": ["Samsung Electro-Mechanics"],
    "삼성생명": ["Samsung Life"],
    "삼성화재": ["Samsung Fire"],
    "삼성중공업": ["Samsung Heavy"],
    "삼성에스디에스": ["삼성SDS", "Samsung SDS"],
    "KB금융": ["KB Financial"],
    "신한지주": ["신한금융", "Shinhan Financial"],
    "하나금융지주": ["하나금융", "Hana Financial"],
    "우리금융지주": ["우리금융", "Woori Financial"],
    "한화에어로스페이스": ["한화에어로", "Hanwha Aerospace"],
    "한화오션": ["Hanwha Ocean"],
    "현대모비스": ["Hyundai Mobis"],
    "두산에너빌리티": ["Doosan Enerbility"],
    "HD현대중공업": ["현대중공업", "HD Hyundai Heavy"],
    "HD한국조선해양": ["한국조선해양", "Korea Shipbuilding"],
    "NAVER": ["네이버", "Naver"],
    "카카오": ["Kakao"],
    "HD현대": ["HD Hyundai"],
    "LG전자": ["LG Electronics"],
    "LG화학": ["LG Chem"],
    "LG디스플레이": ["LGD", "LG Display"],
    "POSCO홀딩스": ["포스코홀딩스", /포스코(?!\s?(퓨처엠|인터내셔널|DX|이앤씨|플로우|엠텍|스틸리온|ICT))/, "POSCO"],
    "HMM": [],
    "KT&G": [],
    "SK이노베이션": ["SK이노", "SK Innovation"],
    "SK텔레콤": ["SKT", "SK Telecom"],
    "고려아연": ["Korea Zinc"],
    "한국전력": [/한전(?!KPS|기술|원자력)/, "KEPCO"],
    "한미반도체": ["Hanmi Semiconductor"],
    "카카오뱅크": ["KakaoBank"],
    "대한항공": ["Korean Air"],
    "아시아나항공": ["아시아나", "Asiana"],
    "크래프톤": ["Krafton"],
    "현대건설": ["Hyundai E&C"],
    "현대제철": ["Hyundai Steel"],
    "현대백화점": ["현대百"],
    "SK": ["SK㈜", "SK(주)"],
    "HD현대일렉트릭": ["현대일렉트릭"],
    "S-Oil": ["에쓰오일", "S-OIL"],
    "한국항공우주": ["KAI", "Korea Aerospace"],
    "NC": ["엔씨소프트", "NCSoft", "NCSOFT"],
    "하이브": ["HYBE"],
    "현대로템": ["Hyundai Rotem"],
    "에코프로비엠": [],
    "LG이노텍": ["LG Innotek"],
    "한국가스공사": ["가스공사", "KOGAS"],
    "한국타이어앤테크놀로지": ["한국타이어", "Hankook Tire"],
    "금호타이어": ["Kumho Tire"],
    "아모레퍼시픽": ["Amorepacific"],
    "LG생활건강": ["LG생건"],
    "CJ제일제당": ["CJ CheilJedang"],
    "롯데케미칼": ["Lotte Chemical"],
    "롯데쇼핑": ["Lotte Shopping"],
    "이마트": ["E-mart", "Emart"],
    "한화솔루션": ["Hanwha Solutions"],
    "두산밥캣": ["Doosan Bobcat"],
    "두산로보틱스": ["Doosan Robotics"],
    "LIG디펜스앤에어로스페이스": ["LIG넥스원", "LIG Nex1"],
    "에스엠": ["SM엔터", "SM엔터테인먼트", "SM Entertainment"],
    "JYP Ent.": ["JYP"],
    "강원랜드": ["Kangwon Land"],
    "호텔신라": ["Hotel Shilla"],
    "한화시스템": ["Hanwha Systems"],
    "현대글로비스": ["Hyundai Glovis"],
    "미래에셋증권": ["Mirae Asset Securities"],
    "삼양식품": ["Samyang Foods"],
    "알테오젠": ["Alteogen"],
    "HL만도": ["만도", "HL Mando"],
    "CJ대한통운": ["CJ Logistics"],
    "넷마블": ["Netmarble"],
    "펄어비스": ["Pearl Abyss"],
    "SK바이오팜": ["SK Biopharm"],
    "유한양행": ["Yuhan"],
    "한미약품": ["Hanmi Pharm"],
    "녹십자": ["GC녹십자", "GC Biopharma"],
    "KT": [],
    "LG유플러스": ["LG U+", "LGU+"],
    "OCI홀딩스": [],
    "효성중공업": [],
  };
  // 이름이 맞아도 바로 뒤가 이 말이면 다른 뜻(야구단·장소·사람·흔한 말)
  const NOT = {
    "기아": /^\s?(사태|위기|선상|인구|문제|퇴치|난민|에\s?(허덕|시달|직면|빠진|처한)|와\s?(빈곤|질병)|타이거즈)/,
    "KT": /^\s?(위즈|wiz)/i, "NC": /^\s?다이노스/, "KCC": /^\s?이지스/, "삼성": /^\s?라이온즈/,
    "녹십자": /^\s?(병원|의료재단)/, "풍산": /^\s?동/, "오리온": /^\s?(자리|성운|우주선)/, "농심": /^\s?(레드포스|레드)/,
    "신세계": /^\s?(사이먼|프라퍼티|건설)/, "LG": /^\s?트윈스/, "SK": /^\s?와이번스/, "에스엠": /^\s?(엔터|C&C)/,
  };
  // 우선주·스팩·리츠·인프라 펀드는 목록에서 뺌(수집기도 같은 규칙)
  const isCommon = name => !/(\d?우[A-C]?|우\(전환\))$/.test(name) && !/스팩|리츠|인프라|REIT|SPAC/i.test(name);

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const HAN = /[가-힣]/;
  // 이름 바로 뒤에 한글이 붙으면 조사·몇몇 말일 때만(다른 회사·다른 말 막기: 삼성전자서비스·우리금융캐피탈·HLB테라퓨틱스·KT알파·테스트·고영표)
  const PARTICLE = /^(은|는|이|가|을|를|의|에|도|와|과|로|으로|만|측|발|장|주가|주식|그룹|에서|에게|까지|부터|보다|처럼|과의|와의|하고|랑)(?![가-힣])/;
  // 짧은 영어 약자(KT·HMM·KCC·KAI…)는 한국 기사(한글 제목)나 Korea 가 들어간 제목에서만(방글라데시 KCC, 이자율 APR 같은 것 막기)
  const SHORT_LATIN = /^[A-Z&+]{2,4}$/;

  // items: [{code, name, rank}] → 판정기
  function build(items) {
    const pats = [], byName = new Map();
    for (const it of items) {
      if (!isCommon(it.name)) continue;
      byName.set(it.name, it);
      const words = [];
      if (!SKIP.has(it.name)) words.push(it.name);
      for (const a of ALIAS[it.name] || []) words.push(a);
      for (const w of words) {
        if (w instanceof RegExp) { pats.push({ it, re: new RegExp(w.source, w.flags.replace("g", "") + "g"), name: w.source }); continue; }
        const latin = /^[\x20-\x7e]+$/.test(w);
        // 영어·숫자 이름: 앞뒤가 영문자·숫자가 아니어야(KT ≠ KTX, SKT ≠ SKTelecomX). 대소문자는 이름 그대로(Kia ≠ kia 단어 일부)
        const re = latin ? new RegExp(`(^|[^A-Za-z0-9&])(${esc(w)})(?![A-Za-z0-9&])`, "g") : new RegExp(`(^|[^가-힣A-Za-z0-9])(${esc(w)})`, "g");
        pats.push({ it, re, latin, abbr: latin && SHORT_LATIN.test(w), name: w });
      }
    }
    return { pats, byName };
  }

  // 제목 하나 → [{code, name, rank, word}] (같은 자리에서는 긴 이름이 이김: "셀트리온제약" > "셀트리온")
  function match(dict, it) {
    const title = it.title || "";
    if (it.source_name === "DART 공시") {                 // "(유가)삼성전자 - 분기보고서" → 이름이 정확히 같은 종목만
      const m = /^\([^)]*\)\s*(.+?)\s+-\s/.exec(title), hit = m && dict.byName.get(m[1].trim());
      return hit ? [{ ...hit, word: hit.name }] : [];
    }
    const found = [], korean = HAN.test(title) || /Korea/i.test(title);
    for (const p of dict.pats) {
      if (p.abbr && !korean) continue;
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(title))) {
        const word = m[2] ?? m[0], start = m.index + (m[2] != null ? m[1].length : 0), end = start + word.length;
        if (!m[0].length) { p.re.lastIndex++; continue; }
        const after = title.slice(end), c = after[0] || "";
        if (HAN.test(c) && !PARTICLE.test(after)) continue;                        // 뒤에 한글이 붙음 → 조사가 아니면 다른 말
        if (HAN.test(word.at(-1)) && /[A-Za-z0-9]/.test(c)) continue;             // 한전KDN 처럼 한글 이름 뒤에 영문이 붙음 → 다른 회사
        const not = NOT[word] || NOT[p.it.name];
        if (not && not.test(after)) continue;
        found.push({ it: p.it, start, end, word });
      }
    }
    found.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    const kept = [], seen = new Set();
    for (const f of found) {
      if (kept.some(k => f.start < k.end && k.start < f.end)) continue;   // 더 긴 이름과 겹치는 자리는 버림
      kept.push(f);
    }
    kept.sort((a, b) => a.start - b.start);
    const out = [];
    for (const k of kept) if (!seen.has(k.it.code)) { seen.add(k.it.code); out.push({ ...k.it, word: k.word }); }
    return out;
  }

  g.STK = { SKIP, ALIAS, NOT, isCommon, build, match };
})(typeof globalThis !== "undefined" ? globalThis : this);
