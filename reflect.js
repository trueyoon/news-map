// 오늘의 TOP5 (2026-10-11 사용자 요청, 2단계). 검색창 옆 버튼 → 최근 24시간 중 우리 시세에 반영될 만한 사건 5개.
// - 계산은 reflect-core.js(서버 기록장과 같은 파일)의 RF.top5: 시세 관련 주제 × 출처 × 보도한 곳 수 × 최신성 × 크기 낱말 × 일정 × 평소보다 관심.
//   같은 사건은 언어가 달라도 한 묶음, 한 주제는 최대 2개. 원인이나 가격 예측이 아니라 "규칙으로 고른 순서"라고 함께 적음(사용자 결정: 정직한 방식).
// - 새 자료를 거의 읽지 않음: 화면이 이미 읽어 둔 소식(items)을 씀. 평소 대비 관심(지난 13일 기록 rf_daily)만 한 번 읽고 1시간마다 다시.
// - index.html 맨 아래 <script src="reflect.js"></script> 한 줄로 불러오고, 이 파일이 reflect-core.js 를 불러옴. 문제가 생겨도 기존 화면은 그대로.
(() => {
  if (typeof card !== "function" || typeof render !== "function" || typeof openItem !== "function" || typeof T !== "object") return;
  const core = document.createElement("script");
  core.src = "reflect-core.js";
  core.onload = () => { try { if (globalThis.RF && typeof RF.top5 === "function") start(); } catch (e) { console.warn("reflect", e); } };
  document.head.append(core);

  function start() {
    const H = 3600e3;
    const TX = {
      ko: { btn: "오늘의 TOP5", head: "오늘의 TOP5", span: "최근 24시간", spanCut: h => `선택한 기간(${h}시간) 안에서`, loading: "고르는 중…",
        note: "시세에 반영될 만한 소식을 규칙으로 고른 순서예요. 원인이나 가격 예측을 뜻하지 않아요.",
        empty: "오늘은 시세와 관련된 큰 소식이 적어요.", reported: (s, n) => (n > 1 ? `${s} 외 ${n - 1}곳 보도` : `${s} 보도`), first: s => `첫 보도 ${s}`,
        why: "왜 올라왔나", st: { official: "공식 발표", wire: "통신사", media: "언론" }, mag: "속보·사상 최대 같은 말", z1: "평소보다 관심 많음", z2: "평소보다 관심 아주 많음",
        sched: "예정된 일정 가까움", related: "관련 시세", disaster: "큰 재난", close: "닫기" },
      en: { btn: "Today's Top 5", head: "Today's Top 5", span: "last 24 hours", spanCut: h => `within the selected ${h} h`, loading: "Picking…",
        note: "Ranked by rules for likely market relevance. It does not mean cause or a price forecast.",
        empty: "Few big market-related stories today.", reported: (s, n) => (n > 1 ? `${s} and ${n - 1} more` : s), first: s => `first ${s}`,
        why: "Why it's here", st: { official: "official release", wire: "wire service", media: "media" }, mag: "words like breaking/record", z1: "more attention than usual", z2: "far more attention than usual",
        sched: "scheduled event nearby", related: "Related prices", disaster: "Major disaster", close: "Close" },
      ja: { btn: "今日のTOP5", head: "今日のTOP5", span: "直近24時間", spanCut: h => `選んだ期間（${h}時間）の中で`, loading: "選んでいます…",
        note: "相場に反映されそうなニュースをルールで並べた順番です。原因や価格予測を意味しません。",
        empty: "今日は相場に関わる大きなニュースが少ないです。", reported: (s, n) => (n > 1 ? `${s}ほか${n - 1}社` : s), first: s => `初報 ${s}`,
        why: "選ばれた理由", st: { official: "公式発表", wire: "通信社", media: "報道" }, mag: "速報・過去最大などの言葉", z1: "普段より注目多め", z2: "普段よりかなり注目",
        sched: "予定された日程が近い", related: "関連する相場", disaster: "大規模災害", close: "閉じる" },
    };
    const tx = k => (TX[LANG] || TX.ko)[k];
    for (const k of Object.keys(TX)) if (T[k]) T[k].rfTop5 = TX[k].btn;    // 언어를 바꾸면 applyStatic 이 이름표를 바꿈(data-i18n)

    // ── 버튼(검색창 바로 뒤) + 펼쳐지는 칸 ──
    const btn = el("button", null, tx("btn"));
    btn.type = "button"; btn.id = "rfTop5Btn"; btn.dataset.i18n = "rfTop5";
    btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "rfTop5");
    $("q").after(btn);
    const pop = el("section", "rf-pop");
    pop.id = "rfTop5"; pop.hidden = true; pop.tabIndex = -1; pop.setAttribute("role", "dialog");
    $("app").append(pop);                               // 앱 안에 둠 → 자동 로그아웃으로 앱이 숨으면 같이 숨음

    // 평소 대비 관심 계산용 지난 기록(rf_daily, 같은 규칙 판) — 못 읽어도 TOP5 는 나옴(관심 배수만 1). 실패하면 다음에 다시
    let base = [], baseAt = 0, basePending = null;
    function loadBase() {
      if (Date.now() - baseAt < H) return Promise.resolve();
      return basePending || (basePending = (async () => {
        try {
          const { data, error } = await db.from("rf_daily").select("day,themes,partial,total_w,core_ver").eq("core_ver", RF.VER).order("day", { ascending: false }).limit(14);   // 아래에서 오늘과 겹치는 날을 빼도 13일 남게
          if (!error && data) { base = data; baseAt = Date.now(); }
        } catch { /* 다음에 다시 */ } finally { basePending = null; }
      })());
    }

    let lastItems = null, lastLang = null, lastBase = null, lastAt = 0, result = null, span = 24;
    function compute() {
      if (items === lastItems && LANG === lastLang && base === lastBase && result && Date.now() - lastAt < 5 * 60e3) return result;
      const now = Date.now(), range = Number($("range").value) || 72;
      span = Math.min(24, range);
      const rows = items.filter(it => it._t >= now - span * H && it._t <= now + 10 * 60e3);
      // 평소 대비는 하루(24시간) 기록과 비교하므로 24시간을 볼 때만(1·6시간은 하루와 비교하면 엉뚱하게 "관심 많음")
      const liveBase = base.filter(b => Date.parse(`${b.day}T07:00:00+09:00`) <= now - 24 * H);   // 지금 24시간과 겹치는 기록 날은 기준에서 뺌(서버와 같게)
      const stats = liveBase.length && span >= 24 ? RF.dayStats(rows, liveBase) : null;
      result = RF.top5(rows, { now, lang: LANG, stats });
      lastItems = items; lastLang = LANG; lastBase = base; lastAt = now;
      return result;
    }

    const themeName = id => (id === "disaster" ? tx("disaster") : (RF.THEMES.find(x => x.id === id)?.label[li()] || id));
    function draw() {
      if (pop.hidden) return;
      if (!items.length) {                              // 소식을 아직 못 받았으면(로그인 직후·실패) "적어요"라고 하지 않음
        pop.replaceChildren(el("p", "empty", $("count").textContent === t("loadFail") ? t("loadFail") : tx("loading")));
        return place();
      }
      const focused = pop.contains(document.activeElement) ? [...pop.querySelectorAll("button")].indexOf(document.activeElement) : -1;
      const list = compute(), close = el("button", "rf-x", "×");
      close.type = "button"; close.title = tx("close"); close.setAttribute("aria-label", tx("close"));
      close.addEventListener("click", () => toggle(false));
      const head = el("div", "rf-head");
      head.append(el("strong", null, tx("head")), el("span", null, span < 24 ? tx("spanCut")(span) : tx("span")), close);
      const ol = el("ol", "rf-list");
      for (const [i, x] of list.entries()) {
        if (!x.item) continue;
        const li0 = el("li");
        const go = li0.appendChild(el("button", "rf-go"));
        go.type = "button";
        go.append(el("span", "rf-rank", String(i + 1)), card(x.item, false, true));     // 제목은 중요 제목 번역(MyMemory 우선)
        go.addEventListener("click", () => { toggle(false); openItem(x.item, true); });   // 지도가 그 소식으로 + 팝업(같은 시기 시세 그래프)
        const meta = li0.appendChild(el("div", "rf-meta"));
        meta.append(el("span", "rf-theme", themeName(x.theme)), `${tx("reported")(x.rep.src, x.srcs)} · ${tx("first")(ago(x.first))}`);
        const why = [tx("st")[x.why.st]];
        if (x.why.mag) why.push(tx("mag"));
        if (x.why.z != null && x.why.z >= 2) why.push(tx("z2")); else if (x.why.z != null && x.why.z >= 1) why.push(tx("z1"));
        if (x.why.sched) why.push(tx("sched"));
        li0.appendChild(el("div", "rf-why", `${tx("why")}: ${why.join(" · ")}`));
        const rel = li0.appendChild(el("div", "rf-rel"));
        rel.append(el("span", null, `${tx("related")}:`));
        for (const s of x.syms) {                        // 이름만(방향 화살표는 넣지 않음 — 매매 신호로 읽히지 않게)
          const b = rel.appendChild(el("button", null, SYM[s]?.[li()] || s));
          b.type = "button";
          b.addEventListener("click", () => { toggle(false); showTab("market", s); });
        }
        ol.append(li0);
      }
      const few = ol.children.length && ol.children.length < 5 ? el("p", "rf-note", tx("empty")) : null;   // 5개가 안 되면(두 곳 이상 보도한 소식이 적은 날) 그대로 알림
      pop.replaceChildren(...[head, ol.children.length ? ol : el("p", "empty", tx("empty")), few, el("p", "rf-note", tx("note"))].filter(Boolean));
      pop.setAttribute("aria-label", tx("head"));
      if (focused >= 0) pop.querySelectorAll("button")[focused]?.focus();   // 5분마다 다시 그려도 키보드 위치 유지
      place();
    }
    function place() {                                  // 위쪽 머리글 바로 아래, 버튼 근처(화면 밖으로 안 나가게)
      const top = Math.max(8, document.querySelector("header").getBoundingClientRect().bottom + 4);
      pop.style.top = `${top}px`;
      // 실제로 보이는 높이로(휴대폰 100vh 는 주소창이 숨은 높이라 맨 아래 안내문이 가려졌음)
      pop.style.maxHeight = `${Math.max(160, Math.min(640, window.innerHeight - top - 12))}px`;
      if (isPhone()) { pop.style.left = "8px"; pop.style.right = "8px"; return; }
      const w = Math.min(460, window.innerWidth - 16), r = btn.getBoundingClientRect();
      pop.style.right = "auto";
      pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;
    }
    async function toggle(open = pop.hidden) {
      pop.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (!open) return;
      if (!result) { pop.replaceChildren(el("p", "empty", tx("loading"))); place(); }
      const had = base;
      setTimeout(() => { draw(); (pop.querySelector(".rf-go") || pop).focus({ preventScroll: true }); }, 0);   // 버튼 눌림 표시가 먼저 그려지게 + 키보드는 첫 항목으로
      await loadBase();
      if (base !== had) draw();                         // 평소 기준을 받았으면 다시(관심 배수 반영)
    }
    btn.addEventListener("click", () => toggle());
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) { toggle(false); btn.focus(); } });
    document.addEventListener("pointerdown", e => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) toggle(false); });
    window.addEventListener("resize", () => { if (!pop.hidden) place(); });

    // ════════════════════ 반영 탭 (3단계) ════════════════════
    // 시세 9개마다: 매일 07:09 에 미리 남긴 규칙상 기울기(검증 전엔 회색) + 보통 움직임 범위 + 채점 결과, 지금 뉴스 흐름, 일정, 계산 방법.
    // 자료: rf_forecasts(기록·채점, 본인만 읽기) · rf_daily(그날 주제 통계) · 화면이 이미 읽은 소식(items)·시세(market). 방향을 색·화살표로 칠하지 않음(이미 일어난 전일 대비만 색).
    const TXR = {
      ko: { tab: "반영", intro: "규칙과 통계로 만든 참고 자료예요. 뉴스가 원인이라는 뜻도, 사고팔라는 뜻도 아니에요.",
        scoreHead: "미리 남긴 기록의 성적", scoreFew: n => `채점 ${n}건 — 판단하기엔 너무 적어요`, scoreLine: (k, n, p, lo, hi) => `맞음 ${k}/${n} (${p}%, 95% 범위 ${lo}~${hi}%)`,
        baseLine: (up, prev) => `같은 날들로 비교: 동전 50% · 항상 오름 ${up} · 전날 방향 그대로 ${prev}`, better: "동전보다 나음(95% 확신)", worse: "동전보다 못함 — 규칙 점검 필요", unclear: "아직 동전과 구분 안 됨",
        wait60: "거래일 60일(약 2027년 1월)쯤 지나야 의미 있는 성적이 나와요. 주말·휴일에 같은 구간을 맞힌 기록은 하나만 셉니다.",
        cardsHead: "시세별 규칙상 기울기", recAt: s => `${s} 기록`, noRec: "아직 기록 전 — 지금 뉴스로 계산한 값", none: "뚜렷한 방향 없음",
        lean: (up, step) => `규칙상 ${up ? "오름" : "내림"} 쪽 · ${["", "약", "중", "강"][step]}`, unverified: "검증 전", nowLean: s => `지금 뉴스로 다시 계산하면: ${s}`,
        band: (a, b) => `다음 거래일 보통 ±${a}, 드물게 ±${b}`, bandHelp: "지난 약 3달 하루 움직임의 68%·95% 범위", bandNone: "움직임 범위: 자료 부족",
        why: "왜?", noParts: "평소와 다른 뉴스 흐름이 없어요", side: (lab, att) => `${lab} 쪽이 평소보다 많음 · ${att}`,
        att: z => (z == null ? "기준 부족" : z >= 2 ? "관심 아주 많음" : z >= 1 ? "관심 많음" : z <= -1 ? "관심 적음" : "관심 보통"),
        symScore: (k, n) => `이 시세 성적 ${k}/${n}`, symFew: n => `이 시세 채점 ${n}건(판단하기엔 적어요)`,
        out: { 1: "맞음", 0: "틀림", 2: "보합", 3: "자료 점검", 4: "방향 없음", w: "채점 대기" },
        flowHead: "지금 뉴스 흐름 (최근 24시간)", flowRow: (n, att) => `${n}건 · ${att}`, dirPct: (lab, p) => `${lab} ${p}%`,
        ledgerHead: "채점 기록 (최근 20건)", calHead: "다가오는 일정 (7일)", calNone: "7일 안에 예정된 큰 일정이 없어요", calOld: "일정표를 새해 것으로 고칠 때예요",
        cal: { FOMC: "미 연준 금리 결정(FOMC)", ECB: "유럽중앙은행 금리 결정", BOJ: "일본은행 금리 결정", EIA: "미 원유 재고 발표(EIA)", KCS: "관세청 10일 수출 발표" },
        methodHead: "어떻게 계산하나요?",
        method: ["뉴스 제목을 주제 8개(중동·러시아, 미국 금리, 일본, 중국, 반도체, 한국 수출, 코인, 관세)로 나누고, 출처마다 무게를 줘요(정부·중앙은행 > 통신사 > 언론).",
          "주제마다 지난 13일보다 기사가 얼마나 많은지(관심)와, 긴장·완화처럼 한쪽 낱말이 평소보다 얼마나 쏠렸는지를 봐요.",
          "사람이 쓴 영향표(예: 중동 긴장 → 유가·금 오름 쪽, 코스피 내림 쪽)에 곱해 시세마다 '규칙상 기울기'를 내요. 평소와 같은 흐름이면 방향이 없어요.",
          "매일 07:09 에 기울기를 미리 기록하고(나중에 못 고침), 다음 마감 값이 나오면 맞았는지 채점해요. 동전 던지기·항상 오름·전날 방향과 같은 날들로 비교해요.",
          "'보통 움직임'은 뉴스와 상관없이 지난 약 3달 가격만으로 계산한 범위예요. 규칙은 reflect-core.js 맨 위 한 곳에 있어요."],
        loading: "기록을 불러오는 중…", fail: "기록을 불러오지 못했어요 — 지금 뉴스로 계산한 값만 보여요.", weekend: "주말·휴일은 기사 수가 적어 '평소 대비' 값이 덜 정확해요.",
        failOld: "새 기록을 불러오지 못했어요 — 전에 불러온 기록을 보여요.", shortRange: "기간을 24시간이나 3일로 고르면 지금 뉴스 흐름도 계산해요(1·6시간은 하루 기준과 비교할 수 없어요).",
        noBase: n => `기준 부족 (같은 규칙 판 기록 ${n}/5일)`, noLoad: "기록을 못 불러옴", noLive: "아직 기록 전", calNote: "날짜는 발표 기관 현지 날짜예요(미국 발표는 한국 시각으로 다음 날 새벽)." },
      en: { tab: "News × Prices", intro: "Reference built from rules and statistics. It does not mean the news caused a move, and it is not trading advice.",
        scoreHead: "Track record of pre-recorded leans", scoreFew: n => `${n} graded — too few to judge`, scoreLine: (k, n, p, lo, hi) => `Right ${k}/${n} (${p}%, 95% range ${lo}–${hi}%)`,
        baseLine: (up, prev) => `Same days compared: coin 50% · always up ${up} · same as previous day ${prev}`, better: "Better than a coin (95% sure)", worse: "Worse than a coin — rules need a check", unclear: "Not yet distinguishable from a coin",
        wait60: "A meaningful record needs about 60 trading days (around Jan 2027). Records that cover the same weekend/holiday interval count once.",
        cardsHead: "Rule-based lean by price", recAt: s => `recorded ${s}`, noRec: "Not recorded yet — computed from current news", none: "No clear lean",
        lean: (up, step) => `Rule lean: ${up ? "upward" : "downward"} · ${["", "weak", "medium", "strong"][step]}`, unverified: "unverified", nowLean: s => `Recomputed with current news: ${s}`,
        band: (a, b) => `Next trading day usually ±${a}, rarely ±${b}`, bandHelp: "68%/95% range of daily moves over ~3 months", bandNone: "Move range: not enough data",
        why: "Why?", noParts: "No news flow different from usual", side: (lab, att) => `more ${lab} than usual · ${att}`,
        att: z => (z == null ? "no baseline yet" : z >= 2 ? "far more attention" : z >= 1 ? "more attention" : z <= -1 ? "less attention" : "usual attention"),
        symScore: (k, n) => `This price: ${k}/${n}`, symFew: n => `This price: ${n} graded (too few)`,
        out: { 1: "right", 0: "wrong", 2: "flat", 3: "data check", 4: "no lean", w: "pending" },
        flowHead: "Current news flow (last 24 hours)", flowRow: (n, att) => `${n} stories · ${att}`, dirPct: (lab, p) => `${lab} ${p}%`,
        ledgerHead: "Grading log (latest 20)", calHead: "Upcoming events (7 days)", calNone: "No major scheduled events in the next 7 days", calOld: "Time to update the event calendar for the new year",
        cal: { FOMC: "Fed rate decision (FOMC)", ECB: "ECB rate decision", BOJ: "Bank of Japan rate decision", EIA: "US crude inventories (EIA)", KCS: "Korea 10-day export data" },
        methodHead: "How is this calculated?",
        method: ["Headlines are sorted into 8 themes (Middle East/Russia, US rates, Japan, China, chips, Korean exports, crypto, tariffs), weighted by source (government/central bank > wire > media).",
          "For each theme it checks how much more coverage there is than over the past 13 days (attention), and how far one-sided words (tension vs. ceasefire, etc.) lean compared with usual.",
          "These are multiplied by a hand-written impact table (e.g. Middle East tension → oil and gold upward, KOSPI downward) into a 'rule lean' per price. A usual news flow gives no lean.",
          "Every day at 07:09 KST the lean is recorded in advance (it cannot be edited later) and graded after the next close, compared on the same days with a coin flip, 'always up' and 'same as previous day'.",
          "The 'usual move' range comes from ~3 months of prices only, regardless of news. The rules live at the top of reflect-core.js."],
        loading: "Loading records…", fail: "Couldn't load records — showing values computed from current news only.", weekend: "Weekends/holidays have fewer stories, so 'vs. usual' values are less precise.",
        failOld: "Couldn't load new records — showing the ones loaded earlier.", shortRange: "Pick 24 hours or 3 days to compute the current news flow too (1/6 hours can't be compared with daily baselines).",
        noBase: n => `No baseline yet (${n}/5 days under the current rules)`, noLoad: "Records not loaded", noLive: "Not recorded yet", calNote: "Dates are the issuer's local dates (US releases fall early next morning in Korea)." },
      ja: { tab: "反映", intro: "ルールと統計で作った参考資料です。ニュースが原因という意味でも、売買を勧めるものでもありません。",
        scoreHead: "事前記録の成績", scoreFew: n => `採点${n}件 — 判断するには少なすぎます`, scoreLine: (k, n, p, lo, hi) => `的中 ${k}/${n}（${p}%、95%範囲 ${lo}〜${hi}%）`,
        baseLine: (up, prev) => `同じ日で比較: コイン50% · 常に上昇 ${up} · 前日と同じ方向 ${prev}`, better: "コインより良い（95%確信）", worse: "コインより悪い — ルールの点検が必要", unclear: "まだコインと区別できません",
        wait60: "意味のある成績には約60営業日（2027年1月ごろ）が必要です。週末・休日に同じ区間を当てた記録は1つだけ数えます。",
        cardsHead: "相場ごとのルール上の傾き", recAt: s => `${s} 記録`, noRec: "まだ記録前 — 今のニュースで計算した値", none: "はっきりした方向なし",
        lean: (up, step) => `ルール上 ${up ? "上昇" : "下落"}方向 · ${["", "弱", "中", "強"][step]}`, unverified: "検証前", nowLean: s => `今のニュースで再計算すると: ${s}`,
        band: (a, b) => `次の営業日はふつう ±${a}、まれに ±${b}`, bandHelp: "直近約3か月の1日の動きの68%・95%範囲", bandNone: "動きの範囲: データ不足",
        why: "なぜ?", noParts: "普段と違うニュースの流れはありません", side: (lab, att) => `${lab}が普段より多い · ${att}`,
        att: z => (z == null ? "基準不足" : z >= 2 ? "注目かなり多め" : z >= 1 ? "注目多め" : z <= -1 ? "注目少なめ" : "注目ふつう"),
        symScore: (k, n) => `この相場の成績 ${k}/${n}`, symFew: n => `この相場の採点${n}件（少なすぎ）`,
        out: { 1: "的中", 0: "外れ", 2: "横ばい", 3: "データ点検", 4: "方向なし", w: "採点待ち" },
        flowHead: "今のニュースの流れ（直近24時間）", flowRow: (n, att) => `${n}件 · ${att}`, dirPct: (lab, p) => `${lab} ${p}%`,
        ledgerHead: "採点記録（直近20件）", calHead: "今後の日程（7日）", calNone: "7日以内に大きな予定はありません", calOld: "日程表を新年のものに更新する時期です",
        cal: { FOMC: "米FRB金利決定（FOMC）", ECB: "欧州中央銀行の金利決定", BOJ: "日本銀行の金利決定", EIA: "米原油在庫（EIA）", KCS: "韓国関税庁10日輸出" },
        methodHead: "どう計算していますか?",
        method: ["ニュースの見出しを8つのテーマ（中東・ロシア、米金利、日本、中国、半導体、韓国の輸出、暗号資産、関税）に分け、出典ごとに重みを付けます（政府・中央銀行 > 通信社 > 報道）。",
          "テーマごとに直近13日と比べて記事がどれだけ多いか（注目）と、緊張・緩和などの片方の言葉が普段よりどれだけ偏っているかを見ます。",
          "人が書いた影響表（例: 中東の緊張 → 原油・金は上昇方向、KOSPIは下落方向）を掛けて相場ごとの「ルール上の傾き」を出します。普段どおりの流れなら方向なしです。",
          "毎日07:09（韓国時間）に傾きを事前に記録し（後から変更不可）、次の終値が出たら採点します。コイン・常に上昇・前日と同じ方向と同じ日で比べます。",
          "「ふつうの動き」はニュースと関係なく直近約3か月の価格だけで計算した範囲です。ルールはreflect-core.jsの先頭にあります。"],
        loading: "記録を読み込んでいます…", fail: "記録を読み込めませんでした — 今のニュースで計算した値のみ表示します。", weekend: "週末・休日は記事が少なく「普段比」の値は精度が下がります。",
        failOld: "新しい記録を読み込めませんでした — 以前の記録を表示します。", shortRange: "期間を24時間か3日にすると今のニュースの流れも計算します（1・6時間は1日の基準と比べられません）。",
        noBase: n => `基準不足（同じルール版の記録 ${n}/5日）`, noLoad: "記録を読み込めず", noLive: "まだ記録前", calNote: "日付は発表機関の現地日付です（米国の発表は韓国時間で翌日早朝）。" },
    };
    const tr = k => (TXR[LANG] || TXR.ko)[k];
    for (const k of Object.keys(TXR)) if (T[k]) T[k].tabReflect = TXR[k].tab;

    const tabBtn = el("button", null, tr("tab"));
    tabBtn.id = "tabReflect"; tabBtn.type = "button"; tabBtn.dataset.i18n = "tabReflect";
    tabBtn.setAttribute("role", "tab"); tabBtn.setAttribute("aria-controls", "reflect"); tabBtn.setAttribute("aria-selected", "false");
    $("tabMarket").after(tabBtn);
    const panel = el("section");
    panel.id = "reflect"; panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", "tabReflect");
    $("side").append(panel);

    const onTab = () => $("side").dataset.tab === "reflect";
    // 옆 칸 탭 바꾸기를 감쌈: 원래 함수가 뉴스·시세 선택 표시를 정한 뒤, 반영 탭이면 바로잡음. 마지막 탭 기억은 따로(원래 코드가 시작할 때 "뉴스"로 덮어써서)
    const baseShow = showTab;
    showTab = function (tab, symbol) {
      // 휴대폰: 반영 탭은 지도 높이(60vh↔40vh)가 달라 탭 줄이 위아래로 튐 → 바꾸기 전 위치로 맞춤(사파리는 스크롤 고정이 없음)
      const keep = isPhone() && !symbol ? tabBtn.getBoundingClientRect().top : null;
      baseShow.call(this, tab, symbol);
      const on = tab === "reflect";
      $("tabNews").setAttribute("aria-selected", String(tab === "news"));
      tabBtn.setAttribute("aria-selected", String(on));
      local.set("reflectTab", on);
      if (keep != null) { const dy = tabBtn.getBoundingClientRect().top - keep; if (dy) window.scrollBy(0, dy); }
      if (on) { if (!$("filterPanel").hidden) toggleFilter(false); renderReflect(); }
      requestAnimationFrame(() => { try { map?.resize(); } catch { /* 지도 준비 전 */ } });   // 옆 칸 폭이 바뀌면 지구본 크기도 다시
    };
    tabBtn.addEventListener("click", () => showTab("reflect"));

    // 기록 읽기: 기록·채점은 하루 두 번(07:09·07:39 KST)만 바뀌므로 30분마다. 필요한 칸만 받고(1년이면 3천 줄), 주제별 기여(parts)는 마지막 날 9줄만
    const FC_COLS = "day,symbol,made_at,call,band68,band95,outcome,move,prev_move,target_ts,core_ver";
    let rec = null, recAt = 0, recPending = null, recFail = false;
    function loadRec() {
      if (rec && Date.now() - recAt < 30 * 60e3) return Promise.resolve();
      return recPending || (recPending = (async () => {
        try {
          const [f, d] = await Promise.all([
            fetchRows(() => db.from("rf_forecasts").select(FC_COLS).order("day", { ascending: false }).order("symbol"), 20000),
            db.from("rf_daily").select("day,made_at,themes,base_days,partial,core_ver,retro").order("day", { ascending: false }).limit(1),
          ]);
          if (d.error) throw d.error;
          const lastDay = f.length ? f[0].day : null;
          if (lastDay) {
            const p = await db.from("rf_forecasts").select("symbol,parts").eq("day", lastDay);
            if (p.error) throw p.error;
            const pm = new Map((p.data || []).map(x => [x.symbol, x.parts]));
            for (const x of f) if (x.day === lastDay) x.parts = pm.get(x.symbol) || {};
          }
          rec = { fc: f, day: d.data?.[0] || null }; recAt = Date.now(); recFail = false;
        } catch { recFail = true; } finally { recPending = null; }
      })());
    }

    const pct = x => (x == null ? "–" : `${Math.round(x * 100)}%`);
    const unitTxt = (v, sym) => (RF.unitOf(sym) === "bp" ? `${(Math.round(v * 10) / 10).toLocaleString(LOCALE[LANG])}bp` : `${(Math.round(v * 100) / 100).toLocaleString(LOCALE[LANG])}%`);
    const leanTxt = call => (!call ? tr("none") : tr("lean")(call > 0, Math.abs(call)));
    const themeOf = id => RF.THEMES.find(x => x.id === id);
    let drawSeq = 0;
    async function renderReflect() {
      if (!onTab()) return;
      const my = ++drawSeq;
      if (!rec && !recFail) panel.replaceChildren(el("p", "empty", tr("loading")));
      await Promise.all([loadRec(), loadBase()]);
      if (my !== drawSeq || !onTab()) return;
      // 다시 그려도(5분마다) 펼쳐 둔 칸과 키보드 위치는 그대로
      const open = new Set([...panel.querySelectorAll("details[open]")].map(d => d.dataset.k));
      const focusables = () => [...panel.querySelectorAll("summary,a,button")];
      const fi = panel.contains(document.activeElement) ? focusables().indexOf(document.activeElement) : -1;
      const now = Date.now(), parts = [el("p", "rf-intro", tr("intro"))];
      const fc = rec?.fc || [], lastDay = fc.length ? fc[0].day : null, today = fc.filter(r => r.day === lastDay);
      const fcV = fc.filter(x => x.core_ver === RF.VER);      // 성적은 지금 규칙 판의 기록만(판마다 따로 셈)
      // 지금 뉴스로 계산: 최근 24시간. 기간을 1·6시간으로 고르면 하루 기준과 비교할 수 없어 계산하지 않음.
      // 기준은 이 24시간과 겹치지 않는 지난날만(서버가 그날 기록 때 쓴 것과 같게 — 겹치면 오늘이 기준에 섞여 약하게 나옴)
      const span = Math.min(24, Number($("range").value) || 72);
      const rows = items.filter(it => it._t >= now - 24 * H && it._t <= now + 10 * 60e3);
      const liveBase = base.filter(b => Date.parse(`${b.day}T07:00:00+09:00`) <= now - 24 * H);
      const live = span >= 24 && rows.length ? RF.dayStats(rows, liveBase) : null, liveLean = live ? RF.lean(live) : null;
      const noRec = recFail && !rec;                       // 기록을 하나도 못 읽음 → 성적·기록 칩은 빼고 "못 불러옴"
      if (recFail) parts.push(el("p", "rf-warn", rec ? tr("failOld") : tr("fail")));
      if (span < 24) parts.push(el("p", "rf-warn", tr("shortRange")));

      // ① 전체 성적
      if (!noRec) {
        const sc = RF.score(fcV), box = el("section", "rf-box");
        box.append(el("h3", null, tr("scoreHead")));
        if (sc.n < 10) box.append(el("p", null, tr("scoreFew")(sc.n)));
        else {
          box.append(el("p", "rf-big", tr("scoreLine")(sc.k, sc.n, Math.round(sc.rate * 100), Math.round(sc.ci[0] * 100), Math.round(sc.ci[1] * 100))),
            el("p", null, sc.ci[0] > 0.5 ? tr("better") : sc.ci[1] < 0.5 ? tr("worse") : tr("unclear")));
        }
        box.append(el("p", "rf-sub", tr("baseLine")(pct(sc.up), pct(sc.prev))), el("p", "rf-sub", tr("wait60")));
        parts.push(box);
      }

      // ② 시세 카드 9장
      parts.push(el("h3", "rf-h", tr("cardsHead")));
      const grid = el("div", "rf-cards"), dayRow = rec?.day && rec.day.day === lastDay ? rec.day : null;
      for (const sym of RF.SYMBOLS) {
        const r = today.find(x => x.symbol === sym), c = el("article", "rf-card"), head = el("div", "rf-ch");
        const m = market?.latest.get(sym);
        head.append(el("strong", null, SYM[sym]?.[li()] || sym));
        if (m) {
          head.append(el("span", "rf-val", `${nf(m.value, m.unit)}${m.unit === "%" ? "%" : UNITS[m.unit] ? ` ${UNITS[m.unit][li()]}` : ""}`));
          const d = delta(m);
          if (d) head.append(el("span", `rf-d ${d.dir}`, d.txt));       // 이미 일어난 전일 대비만 색
        }
        c.append(head);
        const symRows = fc.filter(x => x.symbol === sym), ss = RF.score(symRows.filter(x => x.core_ver === RF.VER));
        const verified = ss.n >= 30 && ss.ci && ss.ci[0] > 0.5 && (!r || r.core_ver === RF.VER);
        const call = r ? r.call : liveLean ? liveLean[sym].call : 0;
        const stats = r ? dayRow : live;                   // 그 기울기를 낸 하루 통계({themes, base_days})
        const lean = c.appendChild(el("p", verified ? "rf-lean ok" : "rf-lean"));
        lean.append(!call && stats && stats.base_days < 5 ? tr("noBase")(stats.base_days) : leanTxt(call));
        if (!verified && call) lean.append(el("small", null, ` (${tr("unverified")})`));
        c.append(el("p", "rf-sub", r ? tr("recAt")(kst(Date.parse(r.made_at))) : noRec ? tr("noLoad") : live ? tr("noRec") : tr("noLive")));
        if (r && liveLean && r.core_ver === RF.VER && live.base_days >= 5 && liveLean[sym].call !== r.call) c.append(el("p", "rf-sub", tr("nowLean")(leanTxt(liveLean[sym].call))));
        // 보통 움직임 범위: 기록에 남긴 값, 없으면 화면의 하루 값(약 3달)으로
        const bd = r && r.band68 != null ? { band68: r.band68, band95: r.band95 } : RF.bands(sym, market?.daily.get(sym) || []);
        const bandP = c.appendChild(el("p", "rf-band", bd.band68 != null ? tr("band")(unitTxt(bd.band68, sym), unitTxt(bd.band95, sym)) : tr("bandNone")));
        bandP.title = tr("bandHelp");
        // 왜? — 주제별 기여(그날 기록) 또는 지금 계산
        const pr = r ? r.parts || {} : liveLean ? liveLean[sym].parts : {}, st = stats?.themes;
        const ids = Object.keys(pr).filter(id => Math.abs(pr[id]) >= 0.02).sort((a, b) => Math.abs(pr[b]) - Math.abs(pr[a]));
        const det = c.appendChild(el("details", "rf-why2"));
        det.dataset.k = sym;
        det.append(el("summary", null, tr("why")));
        if (!ids.length) det.append(el("p", "rf-sub", stats && stats.base_days < 5 ? tr("noBase")(stats.base_days) : tr("noParts")));
        for (const id of ids) {
          const th = themeOf(id), x = st?.[id], up = x ? (x.de ?? 0) >= 0 : pr[id] * (th.m[sym] || 1) > 0;
          const row = det.appendChild(el("div", "rf-part"));
          row.append(el("b", null, th.label[li()]), el("span", null, ` ${tr("side")((up ? th.upLabel : th.downLabel)[li()], tr("att")(x?.z))}`));
          row.append(el("p", "rf-sub", th.why[li()]));
          for (const h of x?.top || []) {                // 그날 대표 제목(원문 링크, 새 창)
            const a = row.appendChild(el("a", "rf-link", h.title)); a.href = h.url; a.target = "_blank"; a.rel = "noopener noreferrer";
          }
        }
        // 이 시세 최근 기록 5개 + 성적(지금 규칙 판)
        if (!noRec) {
          const chips = c.appendChild(el("div", "rf-chips"));
          for (const x of symRows.slice(0, 5)) {
            const o = x.outcome == null ? "w" : x.outcome, b = chips.appendChild(el("span", `rf-o o${o}`, `${x.day.slice(5).replace("-", "/")} ${tr("out")[o]}`));
            if (x.move != null) b.title = unitTxt(x.move, sym);
          }
          c.append(el("p", "rf-sub", ss.n >= 10 ? `${tr("symScore")(ss.k, ss.n)} (${Math.round(ss.rate * 100)}%)` : tr("symFew")(ss.n)));
        }
        grid.append(c);
      }
      parts.push(grid);

      // ③ 지금 뉴스 흐름
      if (live) {
        parts.push(el("h3", "rf-h", tr("flowHead")));
        const ul = el("ul", "rf-flow");
        for (const th of RF.THEMES) {
          const x = live.themes[th.id], li0 = ul.appendChild(el("li"));
          li0.append(el("b", null, th.label[li()]), el("span", null, ` ${tr("flowRow")(x.n, tr("att")(x.z))}`));
          if (x.up + x.down > 0) {
            const upMore = x.up >= x.down;
            li0.append(el("span", "rf-sub", ` · ${tr("dirPct")((upMore ? th.upLabel : th.downLabel)[li()], Math.round((Math.max(x.up, x.down) / (x.up + x.down)) * 100))}`));
          }
        }
        parts.push(ul);
        const kday = new Date(now + 9 * H).getUTCDay();
        if (kday === 0 || kday === 6 || kday === 1) parts.push(el("p", "rf-sub", tr("weekend")));
      }

      // ④ 채점 기록
      const graded = fc.filter(x => x.outcome != null).slice(0, 20);
      if (graded.length) {
        const det = el("details", "rf-box"), tb = el("table", "rf-tb");
        det.dataset.k = "ledger";
        det.append(el("summary", null, tr("ledgerHead")), tb);
        for (const x of graded) {
          const trw = tb.appendChild(el("tr"));
          trw.append(el("td", null, x.day.slice(5).replace("-", "/")), el("td", null, SYM[x.symbol]?.[li()] || x.symbol), el("td", null, leanTxt(x.call)),
            el("td", "num", x.move != null ? unitTxt(x.move, x.symbol) : "–"), el("td", `o${x.outcome}`, tr("out")[x.outcome]));
        }
        parts.push(det);
      }

      // ⑤ 다가오는 일정 (발표 기관 현지 날짜 — 미국 발표는 한국 시각으로 다음 날 새벽이라 어제 날짜부터 봄)
      parts.push(el("h3", "rf-h", tr("calHead")));
      const cal = el("ul", "rf-flow");
      for (let i = -1; i < 7; i++) {
        const d = new Date(now + 9 * H + i * 86400e3).toISOString().slice(0, 10);
        for (const e of RF.eventsOn(d)) {
          const li0 = cal.appendChild(el("li"));
          li0.append(`${d.slice(5).replace("-", "/")} `);
          const a = li0.appendChild(el("a", "rf-link", tr("cal")[e.n] || e.n)); a.href = e.url; a.target = "_blank"; a.rel = "noopener noreferrer";
        }
      }
      parts.push(cal.children.length ? cal : el("p", "rf-sub", tr("calNone")), el("p", "rf-sub", tr("calNote")));
      if (now > Date.parse(`${RF.CAL_LAST}T00:00:00Z`) - 31 * 86400e3) parts.push(el("p", "rf-warn", tr("calOld")));   // 일정표 끝 한 달 전부터 알림

      // ⑥ 방법
      const how = el("details", "rf-box");
      how.dataset.k = "how";
      how.append(el("summary", null, tr("methodHead")), ...tr("method").map(s => el("p", "rf-sub", s)));
      parts.push(how, el("p", "mnote", t("mNote")));
      panel.replaceChildren(...parts);
      panel.querySelectorAll("details").forEach(d => { if (open.has(d.dataset.k)) d.open = true; });
      if (fi >= 0) focusables()[fi]?.focus({ preventScroll: true });
    }

    // 소식을 새로 받거나(5분마다) 언어를 바꾸면: TOP5 칸이 열려 있으면 다시, 반영 탭이 보이면 다시
    const baseRender = render;
    render = function () { baseRender.apply(this, arguments); if (!pop.hidden) draw(); if (onTab()) renderReflect(); };
    const baseMarket = renderMarket;                   // 시세를 새로 받으면(5분마다) 반영 탭 값도
    renderMarket = function () { baseMarket.apply(this, arguments); if (onTab()) renderReflect(); };
    if (local.get("reflectTab", false)) showTab("reflect");   // 마지막에 반영 탭을 보고 있었으면 다시(위 준비가 다 끝난 뒤에)

    const css = document.createElement("style");
    css.textContent = `
.rf-pop { position: fixed; z-index: 20; width: min(460px, calc(100vw - 16px)); overflow-y: auto; overscroll-behavior: contain;
  background: var(--panel); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 10px 32px rgba(0,0,0,.55); padding: 10px 12px 12px; }
.rf-head { display: flex; align-items: baseline; gap: 8px; padding: 2px 2px 8px; border-bottom: 1px solid var(--line); }
.rf-head strong { font-size: 15px; }
.rf-head span { color: var(--muted); font-size: 12px; flex: 1; }
.rf-x { background: none; border: 0; color: var(--muted); font-size: 20px; line-height: 1; padding: 0 4px; cursor: pointer; }
.rf-list { list-style: none; margin: 0; padding: 0; }
.rf-list > li { border-bottom: 1px solid var(--line); padding: 8px 0; display: grid; gap: 4px; }
.rf-go { display: grid; grid-template-columns: 22px 1fr; gap: 8px; width: 100%; text-align: left; background: none; border: 0; padding: 4px 2px; border-radius: 8px; cursor: pointer; color: inherit; }
.rf-go:hover { background: var(--panel-2); }
.rf-rank { font-size: 18px; font-weight: 800; color: var(--accent); line-height: 1.2; }
.rf-meta, .rf-why, .rf-rel { padding-left: 32px; font-size: 12px; color: var(--muted); line-height: 1.5; }
.rf-theme { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 0 7px; margin-right: 6px; color: var(--text); }
.rf-rel { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.rf-rel button { background: var(--bg); border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; font-size: 12px; color: var(--text); cursor: pointer; }
.rf-rel button:hover { border-color: var(--accent); }
.rf-note { margin: 10px 2px 0; font-size: 11.5px; color: var(--muted); line-height: 1.5; }
.rf-pop .empty { padding: 16px 4px; }
/* 반영 탭: 이 탭일 때만 옆 칸을 넓히고(넓은 화면 절반, 중간 55%) 휴대폰은 지도 높이를 줄임(사용자 결정 2026-10-11) */
#side:not([data-tab="reflect"]) #reflect { display: none; }
#side[data-tab="reflect"] > :not(.side-top):not(#reflect) { display: none !important; }
#side[data-tab="reflect"] #filterBtn { display: none; }
#reflect { overflow-y: auto; flex: 1; padding: 4px 12px 16px; }
@media (min-width: 1024px) { #side[data-tab="reflect"] { width: 50%; } }
@media (min-width: 768px) and (max-width: 1023px) { #side[data-tab="reflect"] { width: 55%; } }
@media (max-width: 767px) { #reflect { overflow: visible; } main:has(#side[data-tab="reflect"]) #map { height: 40vh; } }
#reflect h3 { font-size: 13px; color: var(--muted); font-weight: 700; margin: 16px 2px 8px; }
.rf-intro { font-size: 12.5px; color: var(--muted); line-height: 1.6; margin: 10px 2px; }
.rf-warn { font-size: 12.5px; color: var(--text); background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
.rf-box { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin: 8px 0; }
.rf-box h3 { margin: 0 0 6px; }
.rf-box p { margin: 4px 0; font-size: 13px; }
.rf-box summary { cursor: pointer; font-size: 13px; font-weight: 700; color: var(--muted); }
.rf-big { font-size: 15px !important; font-weight: 700; }
.rf-sub { font-size: 12px !important; color: var(--muted); line-height: 1.5; margin: 3px 0; }
.rf-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; }
.rf-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: grid; gap: 2px; align-content: start; }
.rf-ch { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
.rf-ch strong { font-size: 13.5px; flex: 1 1 auto; }
.rf-val { font-size: 13px; font-variant-numeric: tabular-nums; }
.rf-d { font-size: 12px; font-weight: 600; }
.rf-lean { margin: 6px 0 0; font-size: 14px; font-weight: 700; color: var(--muted); }   /* 검증 전: 회색 */
.rf-lean.ok { color: var(--text); }
.rf-lean small { font-weight: 500; font-size: 11.5px; }
.rf-band { margin: 4px 0 0; font-size: 12.5px; }
.rf-why2 summary { cursor: pointer; font-size: 12px; color: var(--accent); margin-top: 4px; }
.rf-part { margin: 6px 0; font-size: 12.5px; }
.rf-link { display: block; font-size: 12px; color: var(--text); text-decoration: underline; text-decoration-color: var(--line); margin: 2px 0; line-height: 1.4; }
.rf-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.rf-o { font-size: 11px; border: 1px solid var(--line); border-radius: 999px; padding: 0 7px; color: var(--muted); }
.rf-o.o1 { color: var(--text); border-color: var(--accent); }
.rf-flow { list-style: none; margin: 0; padding: 0; font-size: 12.5px; }
.rf-flow li { padding: 5px 2px; border-bottom: 1px solid var(--line); }
.rf-tb { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
.rf-tb td { padding: 4px 4px; border-bottom: 1px solid var(--line); }
.rf-tb td.num { text-align: right; font-variant-numeric: tabular-nums; }`;
    document.head.append(css);
  }
})();
