// 코스피·코스닥 "오늘 장 소식" (2026-11-20 사용자 질문: "지금 코스피가 4,900대인데 사이트는 5,000대 — 왜 다르지?")
// - 원인: 지수 값은 금융위원회 공공데이터(지수시세정보)라 **다음 영업일 오후 1시 이후**에야 올라옴 → 오늘 장이 끝나도 화면은 어제 종가.
//   (같은 날 값을 주는 곳은 KRX 정보데이터시스템·포털·해외 시세 사이트인데 약관이 자동 수집을 금지 — 우리 출처 기준에 안 맞음)
// - 그래서: 이미 받고 있는 통신사(연합뉴스·뉴시스) 속보 제목에서 오늘 장 소식을 찾아, 공식 종가보다 새 소식이 있으면
//   시세 탭 코스피·코스닥 카드와 위쪽 시세 띠에 "📰 오늘 장 소식(속보, 잠정)"으로 함께 보여 줌. 공식 종가가 들어오면 자동으로 사라짐.
//   제목에 숫자가 있으면(예: "5,067 마감", "5%대 급락") 그것만 "약 …"으로 보여 주고, 계산·추정은 하지 않음.
// - 새로 받는 자료 없음(화면이 이미 받은 소식 items 만 봄). index.html 수정 없음(list-sort.js 가 이 파일을 불러옴).
// ⚠️ 화면 파일: 정규식에 (?<= (?<! 금지(옛 아이폰).
(() => {
  if (typeof renderMarket !== "function" || typeof el !== "function") return;
  const H = 3600e3;
  const TX = {
    ko: { head: "📰 오늘 장 소식 (속보 · 잠정)", close: "마감", open: "장중", est: s => `속보 기준 ${s}`, wait: "공식 종가는 다음 영업일 오후 1시 이후에 들어와요.", badge: "속보" },
    en: { head: "📰 Today's market news (flash, provisional)", close: "close", open: "intraday", est: s => `per flash: ${s}`, wait: "The official close arrives after 1 p.m. the next business day.", badge: "flash" },
    ja: { head: "📰 今日の相場ニュース（速報・暫定）", close: "引け", open: "場中", est: s => `速報ベース ${s}`, wait: "公式終値は翌営業日の午後1時以降に入ります。", badge: "速報" },
  };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];
  const WIRE = /^(연합뉴스|뉴시스)$/;
  const NAME = { KOSPI: /코스피(?!\s?200)/, KOSDAQ: /코스닥(?!\s?150)/ };
  const CLOSE = /마감/, OPEN = /출발|개장|장중|오전|오후장/;
  const DOWN = /급락|하락|내린|내려|떨어|약세|밀려|빠져|검은/, UP = /급등|상승|오른|올라|강세|반등/;

  // 그 지수의 가장 새 소식(공식 값의 마감 시각 뒤): 마감 소식을 먼저, 없으면 장중 소식
  function latest(sym, after) {
    let best = null;
    for (const it of typeof items !== "undefined" ? items : []) {
      if (!(it._t > after) || !WIRE.test(it.source_name || "") || !NAME[sym].test(it.title || "")) continue;
      const kind = CLOSE.test(it.title) ? "close" : OPEN.test(it.title) ? "open" : null;
      if (!kind) continue;
      const rank = kind === "close" ? 1 : 0;
      if (!best || rank > best.rank || (rank === best.rank && it._t > best.it._t)) best = { it, kind, rank };
    }
    return best;
  }
  // 제목 속 숫자만: 코스피 "5,067"(1,000~9,999) · "5%대"/"2.3%" + 방향
  function parse(sym, title) {
    const dir = DOWN.test(title) ? -1 : UP.test(title) ? 1 : 0;
    const pm = title.match(/(\d+(?:\.\d+)?)\s*%\s*(대|안팎)?/);
    const pct = pm ? `${dir < 0 ? "−" : dir > 0 ? "+" : ""}${pm[1]}%${pm[2] ? (pm[2] === "대" ? "대" : " 안팎") : ""}` : null;
    let val = null;
    if (sym === "KOSPI") { const vm = title.match(/\b(\d),(\d{3})(\.\d+)?\b/); if (vm) val = `${vm[1]},${vm[2]}${vm[3] || ""}`; }
    return { dir, pct, val };
  }
  const when = t => new Intl.DateTimeFormat(undefined, { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(t);
  const openIt = it => { showTab("news"); openItem(it, true); };

  function decorate() {
    if (!market) return;
    for (const sym of ["KOSPI", "KOSDAQ"]) {
      const r = market.latest.get(sym);
      if (!r) continue;
      // 공식 값 날짜 다음 날 09:00 KST(= 그날 24:00 UTC) 뒤의 소식만 — 공식 값과 같은 날 마감 소식은 이미 반영돼 있음
      const b = latest(sym, Math.floor(r._t / (24 * H)) * 24 * H + 24 * H);
      if (!b) continue;
      const p = parse(sym, b.it.title), est = [p.val, p.pct].filter(Boolean).join(" · ");
      // 시세 탭 카드
      const tile = document.getElementById(`px-${sym}`);
      if (tile && !tile.querySelector(".mk-live")) {
        const box = el("div", "mk-live");
        box.append(el("div", "mk-head", `${tx("head")} · ${when(b.it._t)} ${b.it.source_name} · ${tx(b.kind)}`));
        if (est) box.append(el("div", `mk-est ${p.dir < 0 ? "down" : p.dir > 0 ? "up" : "flat"}`, tx("est")(est)));
        const t = box.appendChild(el("button", "mk-title", b.it.title));
        t.type = "button"; t.addEventListener("click", () => openIt(b.it));
        box.append(el("div", "mk-wait", tx("wait")));
        const asof = tile.querySelector(".asof");
        if (asof) asof.after(box); else tile.append(box);
      }
      // 위쪽 시세 띠(코스피만 있음): 버튼 끝에 작은 표시
      if (sym === "KOSPI") {
        const sb = [...document.querySelectorAll("#mstrip button")].find(x => x.querySelector(".n")?.textContent === SYM.KOSPI[li()]);
        if (sb && !sb.querySelector(".mk-badge")) {
          const s = sb.appendChild(el("span", `mk-badge ${p.dir < 0 ? "down" : p.dir > 0 ? "up" : "flat"}`, `${tx("badge")} ${p.pct || p.val || (p.dir < 0 ? "▼" : p.dir > 0 ? "▲" : "•")}`));
          s.title = `${when(b.it._t)} ${b.it.source_name}: ${b.it.title}\n${tx("wait")}`;
        }
      }
    }
  }
  const base = renderMarket;
  renderMarket = function (...a) { const r = base.apply(this, a); try { decorate(); } catch (e) { console.warn("market-news", e); } return r; };
  // 소식이 새로 들어와 목록만 다시 그려질 때도(시세는 그대로) 한 번 더
  if (typeof render === "function") { const br = render; render = function (...a) { const r = br.apply(this, a); try { decorate(); } catch { /* 무시 */ } return r; }; }
  try { decorate(); } catch { /* 아직 시세 전 */ }

  const css = document.createElement("style");
  css.textContent = `
.mk-live { margin-top: 6px; padding: 6px 8px; border: 1px dashed #f59e0b; border-radius: 8px; display: grid; gap: 2px; font-size: 11.5px; line-height: 1.4; }
.mk-head { color: #f59e0b; font-weight: 700; }
.mk-est { font-size: 13px; font-weight: 800; }
.mk-title { background: none; border: 0; padding: 0; color: var(--text); text-align: left; font: inherit; cursor: pointer; }
.mk-title:hover { text-decoration: underline; }
.mk-wait { color: var(--muted); font-size: 10.5px; }
.mk-badge { margin-left: 4px; font-size: 11px; font-weight: 800; border: 1px solid #f59e0b; border-radius: 6px; padding: 0 4px; }`;
  document.head.append(css);
})();
