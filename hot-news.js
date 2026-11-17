// 일반뉴스 TOP5 (2026-11-17 사용자 요청): 한국·일본·미국마다 최근 24시간 동안 가장 많이 보도된 주제 5개.
// - 시세와 상관없이 "지금 그 나라에서 무슨 이야기를 많이 하나"(예: 수능 AI 커닝 대책). 시세반영 TOP5(reflect-core.js)는 그대로.
// - 화면(reflect.js)과 PC 시험(Node)에서 같이 씀. 외부 자료를 새로 읽지 않음 — 화면이 이미 읽어 둔 소식(items)만.
// 고르는 법(간단히):
//   ① 기사 제목을 낱말로 나눔(한국어는 띄어 쓴 낱말·조사 떼기, "수능장"→"수능"처럼 자주 나오는 앞부분으로 모음, 영어 낱말, 일본어·중국어는 두 글자씩)
//   ② 낱말마다 "얼마나 많이 보도됐나" = 보도한 곳마다 1 + log2(그곳 기사 수) 를 더함(한 곳이 도배해도 크게 안 오름) × 평소(그 전 이틀)보다 늘어난 정도
//   ③ 가장 큰 낱말의 기사들을 한 주제로 묶고, 남은 기사로 다시 ②부터 — 5개까지. 같이 자주 나온 낱말 2~3개를 주제 이름표로.
(g => {
  const H = 3600e3;
  const COUNTRY = { kr: "South Korea", jp: "Japan", us: "United States" };
  const PARTICLE = /(으로|에서|에게|까지|부터|은|는|이|가|을|를|의|에|로|와|과|도|만)$/;
  // 제목 앞 꼬리표는 발신지("[수원=뉴시스]")·종류("[속보]" "[포토]" "[군산소식]")일 때만 뗌 — "[수능 AI부정 대책]" 같은 연재 이름은 주제 낱말이라 남김
  const CLEAN_HEAD = /^\s*(?:\[(?:[^\]]{0,12}=[^\]]{0,12}|속보|단독|종합|포토|영상|사진|인터뷰|르포|사설|칼럼|기고|시론|게시판|부고|인사|그래픽|팩트체크|[가-힣]{1,6}소식|Breaking|Update)\]|\((?:종합|\d보|속보|단독|LEAD|URGENT)\)|【[^】]{1,12}】|<[^>]{1,10}>)\s*/i;
  // 지역 소식(제목이 "임실군, …" "충북교육청, …" 으로 시작) — 무게를 낮춤(지방 예산·일자리 모집이 나라 전체 주제처럼 오르지 않게)
  const LOCAL = /^\s*\[[가-힣]{1,6}소식\]|^\s*(?:\[[^\]]*\]\s*)?[가-힣]{1,6}(?:시|군|구|도|교육청|시의회|군의회|구의회|도의회|경찰청|소방서|소방본부)(?:[,\s·]|가|는|이)/;
  // 일정표·게시판·부고 같은 묶음 글은 주제가 아님
  const JUNK = /^\s*\[(?:오늘의|주요\s?일정|게시판|인사|부고|알림|날씨|운세|이 시각|모닝|간추린)|^\s*(?:오늘의 (?:주요\s?일정|날씨|운세)|daily (?:briefing|digest)|morning (?:briefing|report))/i;
  // 혼자서는 주제의 중심이 될 수 없는 넓은 낱말(이름표에는 나올 수 있음) — "검사" 하나로 조류독감 검사와 수능 안경 검사가 섞였음
  const NOHUB = new Set(("확인 검사 조사 발생 논란 우려 촉구 대응 대책 점검 차단 강화 시작 결정 공개 제기 요구 필요 예정 완료 사고 사건 혐의 체포 구속 기소 선고 징역 재판 의혹 입장 발언 주장 비판 반발 "
    + "경찰 법원 검찰 참여 모집 개최 선정 수상 협력 논의 회의 방문 계획 제도 정책 시장 기업 경제 정치 사회 문화").split(" "));
  // 주제 이름이 되면 안 되는 흔한 낱말(나라 이름·기사 꾸밈말·행정 낱말)
  const STOP_KO = new Set(("한국 국내 정부 오늘 내일 어제 올해 내년 지난해 관련 대한 위해 위한 통해 따라 대해 개최 추진 지원 사업 시민 지역 종합 속보 단독 뉴스 발표 실시 운영 진행 참석 행사 기념 "
    + "협약 체결 우리 전국 국민 확대 강화 계획 마련 최대 최고 이번 오후 오전 현장 강조 당부 대상 기관 이상 이하 만에 가운데 이후 이전 앞두고 등 및 또 더 첫 새 위 중 간 년 월 일 "
    + "기자 사진 영상 포토 인터뷰 일문일답 화보 오피니언 사설 칼럼 미국 일본 중국 시대 소식 이슈 주요 상황").split(" "));
  const STOP_EN = new Set(("the and for with from that this have has was were are will after over into amid says said new its their about more than what when where which while could would should been being "
    + "also just year years week weeks day days says report reports update updates live latest video watch photos photo opinion how why who get gets set make makes here your you our top best "
    + "news today first last next one two three not but can may might all out off his her him she they them there then now still back down up near among under against before since "
    + "monday tuesday wednesday thursday friday saturday sunday january february march april june july august september october november december "
    + "korea korean koreans south seoul japan japanese tokyo america american americans states united u.s usa nation national country countries government officials official people "
    + "world global city county state local").split(" "));
  const cleanTitle = s => {
    let t = String(s || "");
    for (let i = 0; i < 3 && CLEAN_HEAD.test(t); i++) t = t.replace(CLEAN_HEAD, "");
    t = t.replace(/^(World|General|Business|Politics|Economy|Sports)\s?:\s+/, "");
    return t.replace(/\s+[-|–—]\s+[^-|–—]{2,30}$/, "").replace(/\((종합|\d보|속보|단독)\)/g, "").trim();
  };
  // 제목 → 낱말들(겉모양도 같이: 이름표에 "AI"처럼 원래 모양으로)
  function words(title) {
    const t = cleanTitle(title), out = new Map();
    for (const w of t.match(/[가-힣]{2,}/g) || []) {
      const k = w.length >= 3 ? w.replace(PARTICLE, "") : w;
      if (k.length >= 2 && !STOP_KO.has(k)) out.set(k, k);
    }
    for (const w0 of t.match(/[A-Za-z][A-Za-z'.-]{2,}/g) || []) {
      const w = w0.replace(/'s$|['.-]+$/, ""), k = w.toLowerCase();
      if (k.length >= 3 && !STOP_EN.has(k)) out.set(k, /^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase());
    }
    for (const a of t.match(/\b(AI|EV|K-?pop|BTS|NATO|FBI|CIA|ICE|GOP|SNAP|LDP|BOJ|Fed)\b/gi) || []) out.set(a.toLowerCase(), a.toUpperCase() === "K-POP" || a.toUpperCase() === "KPOP" ? "K-pop" : a);
    for (const run of t.match(/[一-鿿぀-ヿ]{2,}/g) || []) for (let i = 0; i + 1 < run.length; i++) { const k = run.slice(i, i + 2); if (!/^(日本|中国|米国|韓国)$/.test(k)) out.set(k, k); }
    return out;
  }
  // 한 곳의 기사 n건 → 무게 n^0.75 (1건 1, 4건 2.8, 64건 22.6) — 한국은 연합뉴스·뉴시스 두 곳이 대부분이라 건수도 어느 정도 세야 함, 그래도 한 곳 도배는 덜 셈
  const sourceW = n => Math.pow(n, 0.75);
  const CENTRAL = new Set(["외교부", "행정안전부", "재정경제부"]);
  // 회사 보도자료 틀(분기 실적 발표·행사 참가 안내 등 — 같은 틀 제목이 수십 곳에 실려 미국 주제 칸을 차지했음)
  const PR = /\breports? (first|second|third|fourth|full[- ]year|q[1-4])\b.{0,40}\b(results|earnings)\b|\b(financial|operating) results\b|\bearnings (call|release|conference)\b|\bto (present|participate) at\b|\bannounces? (pricing|closing|date of|dividend)|\bdeclares? (quarterly )?dividend\b/i;

  // rows: 화면이 읽어 둔 소식들. opt: { now, country: "kr"|"jp"|"us", lang: 화면 언어, span: 시간(기본 24) }
  function top(rows, opt) {
    const now = opt.now || Date.now(), span = (opt.span || 24) * H, name = COUNTRY[opt.country];
    // 시·도청·시청 보도자료(출처 이름이 한글인 공식 발표, 중앙 부처 빼고)와 DART 공시는 뺌 — "함께·모집·나눔" 같은 지역 행사 글이 주제를 차지했음(2026-11-17 실제 자료)
    const mine = rows.filter(it => it.country === name && it._t <= now + 10 * 60e3 && it.source_name !== "DART 공시"
      && !(it.source_type === "official" && /[가-힣]/.test(it.source_name || "") && !CENTRAL.has(it.source_name))
      // 한국은 한국어 기사만(외신 영어 기사는 같은 사건도 낱말이 달라 따로 묶여 같은 주제가 두 번 나왔음 — 수능 / "college exam cheating")
      && (opt.country !== "kr" || /[가-힣]/.test(it.title || ""))
      && !PR.test(it.title || "") && !JUNK.test(it.title || ""));
    const cur = [], old = [];
    let oldest = now;
    for (const it of mine) {
      const t = it._t;
      if (t >= now - span) cur.push(it); else if (t >= now - span - 48 * H) { old.push(it); oldest = Math.min(oldest, t); }
    }
    // 낱말 나누기 + "수능장·수능일 → 수능" 모으기(앞부분이 따로도 5번 넘게 나오고, 뒤에 붙은 게 두 글자 이하일 때)
    const raw = new Map(), df = new Map();
    for (const it of cur.concat(old)) { const w = words(it.title); raw.set(it, w); for (const k of w.keys()) df.set(k, (df.get(k) || 0) + 1); }
    const canon = k => {
      if (!/^[가-힣]{3,}$/.test(k)) return k;
      for (let n = 2; n < k.length; n++) { const p = k.slice(0, n); if (k.length - n <= 2 && (df.get(p) || 0) >= 5) return p; }
      return k;
    };
    const toks = new Map(), surface = new Map();
    for (const [it, w] of raw) {
      const s = new Set();
      for (const [k, v] of w) { const c = canon(k); s.add(c); const m = surface.get(c) || new Map(); m.set(c === k ? v : c, (m.get(c === k ? v : c) || 0) + 1); surface.set(c, m); }
      toks.set(it, s);
    }
    const wt = new Map();
    for (const it of raw.keys()) wt.set(it, LOCAL.test(it.title || "") ? 0.3 : 1);
    const label = k => [...(surface.get(k) || new Map([[k, 1]]))].sort((a, b) => b[1] - a[1])[0][0];
    // 평소: 그 전 이틀(읽어 둔 만큼)의 하루치 무게
    const oldHours = old.length ? Math.max(6, (now - span - oldest) / H) : 0;
    // 낱말 하나("AI", "trump")는 너무 넓어서 다른 사건이 섞임(조류독감 AI + 수능 AI, 2026-11-17 실제 자료) → 한 제목에 같이 나온 낱말 두 개(짝)로 셈
    const keysOf = (it, pairs) => {
      const a = [...toks.get(it)].sort();
      if (!pairs) return a;
      const out = [];
      for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) out.push(a[i] + "\u0001" + a[j]);
      return out;
    };
    const weigh = (list, pairs) => {
      const per = new Map();
      for (const it of list) for (const k of keysOf(it, pairs)) { let m = per.get(k); if (!m) per.set(k, (m = new Map())); m.set(it.source_name, (m.get(it.source_name) || 0) + wt.get(it)); }
      const w = new Map();
      for (const [k, m] of per) { let s = 0; for (const n of m.values()) s += sourceW(n); w.set(k, { w: s, srcs: m.size }); }
      return w;
    };
    const scale = oldHours ? span / H / oldHours : 0;
    const baseT = oldHours ? weigh(old, false) : new Map(), baseP = oldHours ? weigh(old, true) : new Map();
    const liftOf = (base, k, w) => { if (!oldHours) return 1; const b = (base.get(k)?.w || 0) * scale; return Math.max(0.25, Math.min(4, (w + 2) / (b + 2))); };
    // 늘 흔한 낱말(지금 기사의 4% 넘게 나오는데 평소와 비슷함 — "AI"·"trump")은 혼자서는 주제를 못 정함.
    // 평소보다 크게 늘어난 흔한 낱말(이번 주 "수능")은 그 자체가 주제(그러지 않으면 수능이 세 칸으로 갈렸음)
    const curDf = new Map();
    for (const it of cur) for (const k of toks.get(it)) curDf.set(k, (curDf.get(k) || 0) + 1);
    const tokW = weigh(cur, false);
    const oldDf = new Map();
    for (const it of old) for (const k of toks.get(it)) oldDf.set(k, (oldDf.get(k) || 0) + 1);
    const countLift = k => (oldHours ? ((curDf.get(k) || 0) + 2) / ((oldDf.get(k) || 0) * scale + 2) : 1);   // 기사 건수로 본 "평소보다 늘어난 정도"
    const common = k => (curDf.get(k) || 0) > Math.max(8, cur.length * 0.04) && countLift(k) < 1.6;

    const left = new Set(cur), out = [];
    for (let round = 0; round < 12 && out.length < 5 && left.size; round++) {
      const L = [...left], w = weigh(L, true);
      // 짝 점수 상위 25개만 후보로 → 후보마다 실제 묶음을 만들어 그 묶음 전체의 무게로 순위(짝 하나만 보면 제목 표현이 다양한 큰 주제가 작게 셈 — 수능)
      const cand = [];
      for (const [k, v] of w) if (v.srcs >= 2 || v.w >= 4) cand.push({ k, sc: v.w * Math.sqrt(liftOf(baseP, k, v.w)) });
      cand.sort((x, y) => y.sc - x.sc || (x.k < y.k ? -1 : 1));
      let best = null;
      for (const c of cand.slice(0, 25)) {
        // 짝의 두 낱말을 각각 중심으로 묶어 봄: 중심 낱말이 든 기사 모두(흔한 낱말이면 짝이 다 든 기사만).
        // 단 중심 낱말 기사의 30% 이상에 짝도 있어야 함("prices" 처럼 넓은 낱말이 휘발유값·주가를 섞지 않게) → 더 무거운 쪽
        const [a, b] = c.k.split("\u0001");
        const pairN = L.filter(it => { const s = toks.get(it); return s.has(a) && s.has(b); }).length;
        for (const [hub, other] of [[a, b], [b, a]]) {
          if (NOHUB.has(hub)) continue;
          const group = L.filter(it => { const s = toks.get(it); return s.has(hub) && (!common(hub) || s.has(other)); });
          if (pairN < group.length * 0.3) continue;
          const per = new Map();
          for (const it of group) per.set(it.source_name, (per.get(it.source_name) || 0) + wt.get(it));
          if (per.size < 2 && group.length < 4) continue;
          let gw = 0;
          for (const n of per.values()) gw += sourceW(n);
          const sc = gw * Math.sqrt(liftOf(baseT, hub, tokW.get(hub)?.w || 0));   // 평소보다 늘어난 정도는 제곱근만(며칠째 이어지는 큰 이야기도 남게)
          if (!best || sc > best.sc) best = { k: hub, sc, group };
        }
      }
      if (!best) break;
      const group = best.group;
      // 같이 자주 나온 낱말(묶음 기사의 25% 이상) → 이름표
      const co = new Map();
      for (const it of group) for (const k of toks.get(it)) if (k !== best.k) co.set(k, (co.get(k) || 0) + 1);
      const mates = [...co].filter(([, n]) => n >= Math.max(2, group.length * 0.25)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(x => x[0]);
      for (const it of group) left.delete(it);
      // 앞 주제의 이름표 낱말이 다시 1위면(예: 수능 다음에 "AI") 따로 세우지 않고 앞 주제에 합침
      // (반대로 이번 주제의 이름표에 앞 주제의 중심 낱말이 있어도 같은 이야기 — "교육·수능" 은 "수능" 주제로)
      //  또 이름표 낱말이 겹치면(늘 흔한 낱말 빼고 — "AI" 하나만 같은 건 다른 이야기) 같은 이야기: "수험생·수능·AI" 는 "부정행위·AI·수능" 주제로
      const mine3 = [best.k, ...mates];
      const prev = out.find(o => o.keys.slice(0, 3).includes(best.k) || mates.includes(o.key) || o.keys.some(k => !common(k) && mine3.includes(k)));
      if (prev) { prev.items.push(...group); continue; }
      out.push({ key: best.k, keys: [best.k, ...mates], score: best.sc, items: group });
    }
    // 합친 뒤 다시 정리: 이름표 = 묶음 전체에서 가장 많이 나온 낱말 3개(늘 흔한 낱말은 뒤로), 순위 = 묶음 전체 무게
    for (const o of out) {
      const cnt = new Map(), per = new Map();
      for (const it of o.items) { for (const k of toks.get(it)) cnt.set(k, (cnt.get(k) || 0) + 1); per.set(it.source_name, (per.get(it.source_name) || 0) + wt.get(it)); }
      o.keys = [...cnt].sort((a, b) => (common(a[0]) - common(b[0])) || b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(x => x[0]);
      let gw = 0;
      for (const n of per.values()) gw += sourceW(n);
      o.score = gw * Math.sqrt(liftOf(baseT, o.key, tokW.get(o.key)?.w || 0));
    }
    out.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1));
    return out.map(o => {
      const srcs = new Set(o.items.map(it => it.source_name));
      // 대표 기사: 주제 낱말이 많이 들어간 제목 → (한국은) 한국어 통신사·공식 → 화면 언어 → 최신
      const langOf = it => (/[가-힣]/.test(it.title) ? "ko" : /[぀-ヿ]/.test(it.title) ? "ja" : /[一-鿿]/.test(it.title) ? "zh" : "en");
      // 묶음의 중심에 가까운 제목: 묶음에서 자주 나온 낱말 10개를 얼마나 많이 담았나(지역 교육감 한 명 기사보다 "수능 AI 부정행위 대책" 같은 제목이 대표가 되게)
      const freq = new Map();
      for (const it of o.items) for (const k of toks.get(it)) freq.set(k, (freq.get(k) || 0) + 1);
      const top10 = new Map([...freq].sort((x, y) => y[1] - x[1]).slice(0, 10));
      const fit = it => { let s = 0; for (const k of toks.get(it)) s += top10.get(k) || 0; return Math.round(10 * s / o.items.length); };
      const pref = it => (opt.country === "kr" && langOf(it) === "ko" && (it.source_type === "wire" || it.source_type === "official") ? 2 : 0) + (langOf(it) === opt.lang ? 1 : 0);
      const rep = o.items.slice().sort((a, b) => fit(b) - fit(a) || pref(b) - pref(a) || wt.get(b) - wt.get(a) || b._t - a._t)[0];
      return { key: o.key, chips: o.keys.map(label), n: o.items.length, srcs: srcs.size, first: Math.min(...o.items.map(it => it._t)), last: Math.max(...o.items.map(it => it._t)),
        item: rep, more: o.items.filter(it => it !== rep).sort((a, b) => fit(b) - fit(a) || b._t - a._t).slice(0, 2), score: Math.round(o.score * 10) / 10 };
    });
  }
  g.HOT = { COUNTRY, top, words, cleanTitle };
})(typeof globalThis !== "undefined" ? globalThis : this);
