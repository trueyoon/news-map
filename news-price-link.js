// 뉴스 ↔ 시세 연결 (2026-10-10 사용자 요청, 1단계). 뉴스 팝업 아래에 "같은 시기 시세 움직임" 작은 그래프를 붙임.
// - 새 자료 없음: 시세 탭이 이미 읽어 둔 하루 값(market.daily, 최근 95일)만 씀. DB 를 더 읽지 않음.
// - 원인을 단정하지 않음: "같은 시기 움직임"으로만 표시하고 "원인을 뜻하지 않아요"를 함께 적음.
// - 연결할 시세가 없는 뉴스는 아무것도 붙이지 않음.
// index.html 맨 아래 <script src="news-price-link.js"></script> 한 줄로 불러옴. index.html 의 card()(소식 카드)를 감싸서 팝업일 때만 붙임.

// ════════════════════ 연결 규칙 — 여기만 고치면 됨 ════════════════════
// 규칙에 맞으면 show 의 시세를 보여 줌. 여러 규칙에 맞으면 규칙마다 하나씩 번갈아 골라 최대 MAX_CHARTS 개.
//   words     : 제목에 이 낱말이 있으면 맞음. 한글·한자·가나는 글자가 들어 있기만 하면, 영어는 낱말 첫머리가 같으면
//               (예: "Ukrain" → Ukraine·Ukrainian). 엉뚱한 낱말에 걸리면 /정규식/ 으로 — 예: /유가(?!족)/ = "유가" 뒤에 "족"이 오면 빼기
//               (주의: (?<=…) (?<!…) 같은 "앞쪽 조건"은 옛 아이폰에서 파일 전체가 멈추므로 쓰지 말 것)
//   countries : 뉴스의 나라 칸(영어 이름)이 이 중 하나이고, 분야가 cats 중 하나면 맞음 (cats 를 비우면 분야 상관없음)
//   countryLangs : (있으면) 나라 칸으로 맞출 때 제목 언어도 이 중 하나여야 함 — "zh" 중국어(간체) / "zh-Hant" 번체 / "ja" / "ko" / "en"
//   sources   : 출처 이름(예: "Federal Reserve")이 이 중 하나면 맞음
//   show      : 보여 줄 시세. 시세 탭의 품목 이름(WTI, USDKRW …) 또는 아래 CALC 의 계산값 이름(GOLD, SPREAD_KR_US …)
const RULES = [
  { name: "중동·러시아·분쟁",
    words: [/중동(?:\s?전쟁|\s?정세|\s?분쟁|발|\s?위기|\s?평화|\s?지역|\s?국가|\s?사태|\s?리스크)/,   // 그냥 "중동"은 부천 중동 같은 동네 이름도 걸려서
      /(^|[^가-힣])이란/,                                                              // "…이란"(조사)은 빼려고 앞 글자가 한글이 아닐 때만
      "이스라엘", /가자(?:지구|\s?전쟁|\s?휴전|\s?주민|\s?공습)/,                         // 그냥 "가자"는 "참가자"도 걸려서
      "하마스", "헤즈볼라", "후티", "예멘", "시리아", "이라크", "사우디", "호르무즈", "러시아", "우크라이나", "푸틴", "젤렌스키",
      "OPEC", "오펙", /유가(?!족|증권|스|공)/, "브렌트", "WTI",                            // 유가족·유가증권·석유가스 빼기 ("원유"는 우유 원료 뜻도 있어 뺌)
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
      /\bPowell\b.*\b(Fed|rates?|inflation|economy|Treasury)\b/i,                       // 그냥 "Powell"은 다른 사람(Lucy Powell 등)도 걸려서
      "Treasury yield", "Treasuries", /\bFed\b/, "美联储", "鲍威尔", "美债", "FRB", "パウエル", "米国債", "米金利"],     // "rate hike" 만으로는 인도·필리핀 금리 기사도 걸려서 뺌
    sources: ["Federal Reserve"],
    show: ["UST10Y", "USDKRW", "SPREAD_KR_US"] },
  { name: "일본",       // 나라 칸으로는 안 맞춤: 위치만 일본으로 잘못 찍힌 기사(인도 증시·영국 왕실 등)가 많아서 제목 낱말·출처로만
    words: ["일본", "엔화", "엔저", "엔고", "일본은행", "Bank of Japan", /\bBOJ\b/, "Japan", /\byen\b/i, "Nikkei", "日本", "日銀", "円安", "円高", "日元", "日本央行"],
    sources: ["Bank of Japan", "財務省", "首相官邸"],
    show: ["JPYKRW", "SPREAD_US_JP"] },
  { name: "중국",
    words: ["중국", /위안(?!부)/, "시진핑", "China", "Chinese", "Beijing", "Xi Jinping", /\byuan\b/i, "renminbi", "中国", "中國", "人民币", "人民幣", "习近平"],
    countries: ["China"], cats: ["economy", "diplomacy", "politics"], countryLangs: ["zh"],
    // ↑ 중국어 경제 뉴스(GDELT)는 제목에 "중국"이 없어도 나라 칸이 중국. 위치만 중국으로 잘못 찍힌 영어 기사(미국 주식 등)는 빼려고 중국어 제목만
    show: ["CNYKRW", "EXP10_CN"] },
  { name: "반도체",
    words: ["반도체", "HBM", "삼성전자", "하이닉스", /메모리(?!얼)/, "파운드리", "semiconductor", "chipmaker", "Samsung Electronics", "Hynix", "TSMC",
      /\b(AI|memory|computer|advanced|Nvidia|Samsung)[ -]chips?\b/i, "半导体", "芯片", "半導体"],     // 그냥 "chip" 은 사람 이름(Chip …)도 걸려서 뺌
    show: ["EXP10_SEMI", "KOSPI"] },
  { name: "한국 수출",
    words: ["수출", "무역수지", "경상수지", "관세청"],
    show: ["EXP10_TOTAL", "KOSPI"] },
  { name: "코인",
    words: ["비트코인", "가상자산", "가상화폐", "암호화폐", "이더리움", "스테이블코인", /테더(?!링)/, /코인(?!노래|세탁)/,
      "Bitcoin", /\bcrypto(?!graph)/i, "BTC", "Ethereum", "stablecoin", /\bTether\b/, "比特币", "加密货币", "ビットコイン", "暗号資産"],
    show: ["BTCKRW", "USDT_PREMIUM"] },
];
const MAX_CHARTS = 3;          // 한 뉴스에 그래프 최대 몇 개
const DAYS_BEFORE = 7, DAYS_AFTER = 7;   // 뉴스 시점 전후 며칠 (오늘 뉴스는 오늘까지만)

// 계산값: 시세 탭 계산과 같은 식을 날마다 계산 (휴일처럼 한쪽 값이 없는 날은 그 앞 값을 이어 씀 — 10일까지만)
const CALC = {
  GOLD: { name: ["금", "Gold", "金"], pick: ["KRXGOLD", "XAUTKRW"] },     // KRX 금(원/g)이 있으면 그것, 없으면 금 토큰(참고용)
  SPREAD_KR_US: { name: ["한미 금리차 (미 10년 − 한 10년)", "US–Korea 10Y spread", "韓米金利差（米10年−韓10年）"], a: "UST10Y", b: "KTB10Y", op: "diff", unit: "%p" },
  SPREAD_US_JP: { name: ["미일 금리차 (미 10년 − 일 10년)", "US–Japan 10Y spread", "日米金利差（米10年−日10年）"], a: "UST10Y", b: "JGB10Y", op: "diff", unit: "%p" },
  USDT_PREMIUM: { name: ["테더 프리미엄", "Tether premium", "テザー・プレミアム"], a: "USDTKRW", b: "USDKRW", op: "premium", unit: "%" },
};
// 날짜만 있는 하루 값(장 마감·고시 값)을 그날 몇 시(세계 표준시 UTC)에 찍을지. 0시에 찍으면 그날 오후 뉴스보다 앞에 그려져
// "뉴스 전에 움직인 것"처럼 보이므로 실제 마감·발표 무렵에 찍음. 표에 없으면 그날 끝(24시)
const CLOSE_H = { KOSPI: 6.5, KOSDAQ: 6.5, KOSPI200: 6.5, KTB3Y: 6.5, KTB10Y: 6.5, KRXGOLD: 6.5, JGB2Y: 6, JGB10Y: 6, JGB30Y: 6,
  USDKRW: 13, JPYKRW: 13, CNYKRW: 13, EURKRW: 13, DXY_CALC: 13,             // ECB 기준환율(중부유럽 14:15)
  WTI: 19.5, BRENT: 19.5, HENRYHUB: 19.5, UST2Y: 20, UST10Y: 20, UST3M: 20, TIPS5Y: 20, TIPS10Y: 20 };
// ════════════════════════════════════════════════════════════════════

(() => {
  if (typeof card !== "function") return;            // index.html 이 바뀌어 card 가 없으면 아무것도 안 함(뉴스 화면은 그대로)
  const TX = {
    ko: { head: "같은 시기 시세 움직임", note: "뉴스와 같은 때의 움직임일 뿐, 원인을 뜻하지 않아요.", mark: "뉴스", tab: "시세 탭에서 보기", tenDay: "열흘 단위" },
    en: { head: "Prices around the same time", note: "Shown only for timing — this does not imply cause.", mark: "news", tab: "Open in Markets", tenDay: "per 10 days" },
    ja: { head: "同じ時期の相場の動き", note: "時期が重なるだけで、原因を意味しません。", mark: "ニュース", tab: "相場タブで見る", tenDay: "10日単位" },
  };
  const tx = k => (TX[LANG] || TX.ko)[k];
  const DAY = 86400e3, H = 3600e3;
  const dayKey = t => Math.floor(t / DAY) * DAY;     // 그날 0시(UTC)

  // 낱말 → 판정 함수 (영어는 낱말 첫머리, 그 밖의 글자는 들어 있기만 하면)
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const testers = RULES.map(r => ({
    ...r,
    re: (r.words || []).map(w => (w instanceof RegExp ? w : /^[\x20-\x7e]+$/.test(w) ? new RegExp(`\\b${esc(w)}`, "i") : { test: s => s.includes(w) })),
  }));
  // 맞은 규칙들에서 번갈아 하나씩 (예: "비트코인 반등…이란 전쟁 우려" → WTI, 비트코인, 브렌트 …). 그릴 수 없는 품목은 그리기에서 건너뜀
  function symbolsFor(it) {
    const title = it.title || "";
    const lists = testers.filter(r => r.re.some(re => re.test(title))
      || (r.countries?.includes(it.country) && (!r.cats?.length || r.cats.includes(it.category))
        && (!r.countryLangs || r.countryLangs.includes(srcLang(title))))
      || r.sources?.includes(it.source_name)).map(r => r.show);
    const out = [];
    for (let i = 0; lists.some(l => i < l.length); i++)
      for (const l of lists) if (i < l.length && !out.includes(l[i])) out.push(l[i]);
    return out;
  }

  // 품목 하나의 하루 값 → [{t: 그릴 시각, d: 날짜 글자용 시각, v}]. 날짜만 있는 값(0시 UTC)은 마감 시각으로 옮김
  const daily = s => market?.daily.get(s) || [];
  const at = (sym, t) => (t % DAY ? t : t + (CLOSE_H[sym] ?? 24) * H);
  const plain = sym => daily(sym).map(p => ({ t: at(sym, p.t), d: p.t, v: p.v }));
  function seriesOf(sym) {
    const c = CALC[sym];
    if (!c) return { pts: plain(sym), unit: market?.latest.get(sym)?.unit, name: SYM[sym]?.[li()] || sym, sym };
    if (c.pick) {
      const s = c.pick.find(p => daily(p).length >= 3) || c.pick[0];
      return { pts: plain(s), unit: market?.latest.get(s)?.unit, name: SYM[s]?.[li()] || c.name[li()], sym: s };
    }
    // 두 품목을 날짜(UTC 하루)로 맞춤 — 같은 날 여러 값이면 마지막 값. 없는 쪽은 앞 값을 이어 쓰되 10일이 넘으면 그 날은 뺌
    const ma = new Map(daily(c.a).map(p => [dayKey(p.t), p.v])), mb = new Map(daily(c.b).map(p => [dayKey(p.t), p.v]));
    const days = [...new Set([...ma.keys(), ...mb.keys()])].sort((x, y) => x - y);
    const close = Math.max(CLOSE_H[c.a] ?? 24, CLOSE_H[c.b] ?? 24) * H, pts = [];
    let a, b, aT, bT;
    for (const d of days) {
      if (ma.has(d)) { a = ma.get(d); aT = d; }
      if (mb.has(d)) { b = mb.get(d); bT = d; }
      if (a == null || b == null || d - aT > 10 * DAY || d - bT > 10 * DAY) continue;
      pts.push({ t: d + close, d, v: c.op === "diff" ? a - b : (a / b - 1) * 100 });
    }
    return { pts, unit: c.unit, name: c.name[li()], sym: null };
  }
  // 수출(그달 1일부터의 누계, 10일·20일·말일)은 열흘 단위 금액으로 바꿈
  function tenDay(pts) {
    return pts.map((p, i) => {
      const prev = pts[i - 1], same = prev && new Date(prev.d).getUTCMonth() === new Date(p.d).getUTCMonth();
      return { ...p, v: same ? p.v - prev.v : p.v };
    });
  }

  // 작은 그래프: 가로 = 시간(비례), 세로 = 값. 뉴스 시점에 세로 점선 + "뉴스" 글자. 올리면 그날 값
  function chart(s, newsT) {
    const trade = s.unit === "kUSD";
    const lo = newsT - (trade ? 70 : DAYS_BEFORE) * DAY, hi = Math.min(Date.now(), newsT + (trade ? 40 : DAYS_AFTER) * DAY);
    const upto = (trade ? tenDay(s.pts) : s.pts).filter(p => p.t <= hi);
    let pts = upto.filter(p => p.t >= lo);
    if (pts.length < 3) pts = upto.filter(p => p.t >= newsT - 21 * DAY).slice(-3);   // 연휴로 점이 모자라면 조금 더 앞에서 채움(3주 안)
    if (pts.length < 3) return null;                    // 그래도 점이 너무 적으면 그리지 않음
    const big = trade ? (LANG === "en" ? [1e6, "$bn"] : [1e5, LANG === "ja" ? "億ドル" : "억 달러"]) : null;
    const suffix = s.unit === "%p" ? "%p" : s.unit === "%" ? "%" : UNITS[s.unit]?.[li()] ? ` ${UNITS[s.unit][li()]}` : "";
    const show = v => (big ? `${nf(v / big[0], "")} ${big[1]}` : `${nf(v, s.unit === "%p" ? "%" : s.unit)}${suffix}`);
    const last = pts.at(-1), t0 = pts[0].t, t1 = Math.max(last.t, newsT), tspan = t1 - t0 || 1;
    const vs = pts.map(p => p.v), vlo = Math.min(...vs), vhi = Math.max(...vs), vspan = vhi - vlo || 1;
    const X = t => ((t - t0) / tspan) * 100, Y = v => 33 - ((v - vlo) / vspan) * 28;
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
    const line = { fill: "none", "vector-effect": "non-scaling-stroke", "stroke-linecap": "round", "stroke-linejoin": "round" };
    const box = el("div", "npl-row");
    const head = box.appendChild(el("div", "npl-name"));
    head.append(el("span", null, s.name + (trade ? ` · ${tx("tenDay")}` : "")));
    const valEl = head.appendChild(el("span", "npl-val", show(last.v)));
    const svg = mk("svg", { viewBox: "0 0 100 36", preserveAspectRatio: "none", role: "img",
      "aria-label": `${s.name}: ${dayText(pts[0].d)} ${show(pts[0].v)} → ${dayText(last.d)} ${show(last.v)}` });
    const xn = X(newsT);
    svg.append(
      mk("path", { ...line, d: `M${xn} 2V36`, stroke: "var(--muted)", "stroke-width": 1, "stroke-dasharray": "2 2" }),
      mk("path", { ...line, d: pts.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(2)} ${Y(p.v).toFixed(2)}`).join(""), stroke: "var(--accent)", "stroke-width": 2 }));
    const cross = svg.appendChild(mk("path", { ...line, stroke: "var(--text)", "stroke-width": 1, opacity: 0.4, visibility: "hidden" }));
    const dot = svg.appendChild(mk("path", { ...line, stroke: "var(--text)", "stroke-width": 7, visibility: "hidden" }));
    const wrap = box.appendChild(el("div", "npl-chart"));
    wrap.append(svg);
    const mark = wrap.appendChild(el("span", "npl-mark", tx("mark")));
    mark.style.left = `${Math.min(92, Math.max(0, xn))}%`;
    const axis = box.appendChild(el("div", "npl-axis"));        // 양 끝 날짜: 오른쪽 끝이 뉴스 시점이면 뉴스 날짜
    axis.append(el("span", null, dayText(pts[0].d)), el("span", null, dayText(newsT > last.t ? newsT : last.d)));
    // 손가락·마우스를 올리면 가장 가까운 점의 값
    svg.addEventListener("pointermove", e => {
      const r = svg.getBoundingClientRect(), tt = t0 + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * tspan;
      const p = pts.reduce((a, b) => (Math.abs(b.t - tt) < Math.abs(a.t - tt) ? b : a));
      cross.setAttribute("d", `M${X(p.t)} 0V36`); dot.setAttribute("d", `M${X(p.t)} ${Y(p.v)}l0 0`);
      cross.setAttribute("visibility", "visible"); dot.setAttribute("visibility", "visible");
      valEl.textContent = `${dayText(p.d)} · ${show(p.v)}`;
    });
    svg.addEventListener("pointerleave", () => {
      cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); valEl.textContent = show(last.v);
    });
    return box;
  }

  function addBlock(box, it, syms) {
    const rows = [];
    for (const sym of syms) {
      if (rows.length >= MAX_CHARTS) break;
      const s = seriesOf(sym), c = s.pts.length ? chart(s, it._t) : null;
      if (c) { rows.push(c); c.dataset.sym = s.sym || ""; }
    }
    if (!rows.length) return false;                     // 그릴 시세가 없으면 아무것도 안 붙임
    const sec = el("section", "npl");
    const foot = el("div", "npl-foot");
    sec.append(el("div", "npl-head", tx("head")), ...rows, foot);
    foot.append(el("div", "npl-note", tx("note")));
    const go = foot.appendChild(el("button", "npl-go", `${tx("tab")} →`));
    go.type = "button";
    go.addEventListener("click", () => showTab("market", rows[0].dataset.sym || undefined));
    box.append(sec);
    return true;
  }

  const base = card;
  card = function (it, inPopup, priority) {
    const box = base(it, inPopup, priority);
    if (!inPopup || !it || !Number.isFinite(it._t)) return box;
    // 팝업은 점 위나 아래에 붙으므로 지도 높이의 절반쯤까지만 (넘치면 카드 안에서 스크롤)
    if (map) document.documentElement.style.setProperty("--npl-max", `${Math.max(200, Math.min(460, map.getContainer().clientHeight / 2 - 24))}px`);
    try {
      const syms = symbolsFor(it);
      if (!syms.length) return box;
      if (market) addBlock(box, it, syms);
      else {                                            // 시세를 아직 못 받았으면(로그인 직후) 잠깐 기다렸다가 붙임
        let n = 0;
        const wait = setInterval(() => {
          if (market || ++n > 20 || !box.isConnected && n > 2) {
            clearInterval(wait);
            // 늦게 붙으면 팝업 크기가 바뀌므로 위치(위·아래)를 다시 계산하게 함
            if (market && box.isConnected && addBlock(box, it, syms) && popup?.getElement()?.contains(box)) popup.setLngLat(popup.getLngLat());
          }
        }, 500);
      }
    } catch (e) { console.warn("news-price-link", e); }   // 문제가 생겨도 뉴스 팝업은 그대로
    return box;
  };

  const css = document.createElement("style");
  css.textContent = `
/* 그래프가 붙은 팝업만: 지도 밖으로 넘치지 않게 카드 높이 제한 + 카드 안에서 스크롤 (닫기 × 는 그대로 위에, 다른 팝업은 그대로) */
.maplibregl-popup-content > .card:has(> .npl) { max-height: calc(var(--npl-max, 46vh) - 28px); overflow-y: auto; overscroll-behavior: contain; }
.npl { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 6px; display: grid; gap: 6px; }
.npl-head { font-size: 11.5px; font-weight: 700; color: var(--muted); }
.npl-row { display: grid; gap: 1px; }
.npl-name { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
.npl-val { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.npl-chart { position: relative; }
.npl-chart svg { width: 100%; height: 26px; display: block; overflow: visible; touch-action: pan-y; }
.npl-mark { position: absolute; top: -4px; transform: translateX(3px); font-size: 10px; color: var(--muted); pointer-events: none; }
.npl-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); line-height: 1.2; }
.npl-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.npl-note { font-size: 10.5px; color: var(--muted); line-height: 1.4; }
.npl-go { flex: none; background: none; border: 0; padding: 0; color: var(--accent); font-size: 11.5px; cursor: pointer; }
.npl-go:hover { text-decoration: underline; }`;
  document.head.append(css);
})();
