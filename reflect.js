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
          const { data, error } = await db.from("rf_daily").select("day,themes,partial,total_w,core_ver").eq("core_ver", RF.VER).order("day", { ascending: false }).limit(13);
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
      const stats = base.length && span >= 24 ? RF.dayStats(rows, base) : null;
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

    // 소식을 새로 받거나(5분마다) 언어를 바꾸면, 열려 있을 때만 다시 그림
    const baseRender = render;
    render = function () { baseRender.apply(this, arguments); if (!pop.hidden) draw(); };

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
.rf-pop .empty { padding: 16px 4px; }`;
    document.head.append(css);
  }
})();
