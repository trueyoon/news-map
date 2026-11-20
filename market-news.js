// 오늘 장 소식(속보) — 공식 시세가 늦게 들어오는 것을 통신사 속보 제목으로 메움
//   2026-11-20 사용자 질문: "코스피가 지금 4,900대인데 사이트는 5,000대 — 왜 다르지?" → "다른 정보도 늦다면 즉각 반영할 방법?" → "① 속보 방식 넓히기"
// - 원인: 코스피·코스닥·국고채는 금융위원회 공공데이터라 **다음 영업일 오후 1시 이후**에야 올라옴. 원/달러 카드는 유럽중앙은행 기준환율이라 한국 시각 밤 12시쯤에야 그날 값.
//   (같은 날 값을 주는 KRX 정보데이터시스템·포털·해외 시세는 약관이 자동 수집 금지 — 우리 출처 기준에 안 맞음)
// - 그래서: 이미 받고 있는 연합뉴스·뉴시스 속보 제목 중 **숫자가 정확히 적힌 정형 속보**를 읽어 카드·시세 띠에 "📰 오늘 장 소식(속보·잠정)"으로 함께 보여 줌.
//     [코스피] 267.93p(5.21%) 내린 4,869.96(장종료)        → 코스피 4,869.96 ▼267.93 (−5.21%)
//     [코스닥] 39.13p(5.71%) 내린 645.68(장종료)            → 코스닥
//     [외환] 원/달러 환율 6.2원 오른 1,336.2원(15:30 기준가) → 원/달러(서울 외환시장)
//     국고채 금리 일제히 하락…3년물 연 3.642%                → 국고채 3년
//   정형 속보가 없으면(코스피·코스닥만) "5%대 급락 마감" 같은 일반 속보 제목의 숫자만. 계산·추정은 하지 않음. 공식 값이 들어오면 자동으로 사라짐.
// - 국제유가·금값 속보는 제목에 숫자가 거의 없어 뺌. 새로 받는 자료 없음(화면이 이미 받은 소식 items 만 봄). index.html 수정 없음(list-sort.js 가 이 파일을 불러옴).
// - 제목 읽는 규칙은 globalThis.MKNEWS.parse(제목) — Node 로도 시험(scratchpad mk_test.mjs).
// ⚠️ 화면 파일: 정규식에 (?<= (?<! 금지(옛 아이폰).
((g) => {
  const num = s => Number(String(s).replace(/,/g, ""));
  const DOWN = /급락|하락|내린|내려|떨어|약세|밀려|빠져|검은/, UP = /급등|상승|오른|올라|강세|반등/;
  // 정형 속보(정확한 숫자) → [{ sym, val, chg, pct, dir, kind: close|open, exact: true }]
  const RULES = [
    { sym: "KOSPI", re: /^\[코스피\]\s*([\d,.]+)p\(([\d.]+)%\)\s*(오른|내린)\s*([\d,]+(?:\.\d+)?)\(([^)]+)\)/ },
    { sym: "KOSDAQ", re: /^\[코스닥\]\s*([\d,.]+)p\(([\d.]+)%\)\s*(오른|내린)\s*([\d,]+(?:\.\d+)?)\(([^)]+)\)/ },
  ];
  function parse(title) {
    title = String(title || "");
    const out = [];
    for (const r of RULES) {
      const m = title.match(r.re);
      if (!m) continue;
      const dir = m[3] === "오른" ? 1 : -1;
      out.push({ sym: r.sym, val: num(m[4]), chg: dir * num(m[1]), pct: dir * num(m[2]), dir, kind: /장종료|마감/.test(m[5]) ? "close" : "open", exact: true });
    }
    // 원/달러: "[외환] 원/달러 환율 6.2원 오른 1,336.2원(15:30 기준가)" · "환율, 강달러·주가 급락에 6.2원 오른 1,336.2원"
    const fx = title.match(/(?:원\/달러\s*환율|^환율,)[^\d]*?([\d.]+)원\s*(오른|내린)\s*([\d,]+(?:\.\d+)?)원(?:\(([^)]*)\))?/);
    if (fx && num(fx[3]) > 500 && num(fx[3]) < 3000) {
      const dir = fx[2] === "오른" ? 1 : -1;
      out.push({ sym: "USDKRW", val: num(fx[3]), chg: dir * num(fx[1]), pct: null, dir, kind: /개장|출발|오전|장중/.test(fx[4] || title) ? "open" : "close", exact: true });
    }
    // 국고채 3년: "…3년물 연 3.642%" · "…3년물 장중 연 3.669%"
    const kt = title.match(/국고채.*?3년물\s*(장중\s*)?연\s*(\d\.\d+)%/);
    if (kt) out.push({ sym: "KTB3Y", val: num(kt[2]), chg: null, pct: null, dir: DOWN.test(title) ? -1 : UP.test(title) ? 1 : 0, kind: kt[1] ? "open" : "close", exact: true });
    // 일반 속보(코스피·코스닥, 숫자가 대략일 때): "또 '검은 금요일'…코스피·코스닥 5%대 급락 마감"
    if (!out.length && /마감|출발|개장|장중/.test(title)) {
      const dir = DOWN.test(title) ? -1 : UP.test(title) ? 1 : 0, pm = title.match(/(\d+(?:\.\d+)?)\s*%\s*(대|안팎)?/);
      const vm = title.match(/\b(\d),(\d{3})(\.\d+)?\b/);
      for (const [sym, re] of [["KOSPI", /코스피(?!\s?200)/], ["KOSDAQ", /코스닥(?!\s?150)/]]) {
        if (!re.test(title)) continue;
        out.push({ sym, val: sym === "KOSPI" && vm ? num(`${vm[1]}${vm[2]}${vm[3] || ""}`) : null, chg: null,
          pctText: pm ? `${dir < 0 ? "−" : dir > 0 ? "+" : ""}${pm[1]}%${pm[2] === "대" ? "대" : pm[2] ? " 안팎" : ""}` : null,
          pct: null, dir, kind: /마감/.test(title) ? "close" : "open", exact: false });
      }
    }
    return out;
  }
  g.MKNEWS = { parse };
  if (typeof document === "undefined" || typeof renderMarket !== "function" || typeof el !== "function") return;   // Node 시험이면 여기까지

  const H = 3600e3;
  const TX = {
    ko: { head: "📰 오늘 장 소식 (속보 · 잠정)", close: "마감", open: "장중", badge: "속보", est: s => `속보 기준 ${s}`,
      wait: "공식 값은 다음 영업일 오후 1시 이후에 들어와요.", fxNote: "서울 외환시장 값이에요. 카드의 큰 숫자는 유럽중앙은행 기준환율이라 조금 달라요(한국 시각 밤 12시쯤 그날 값)." },
    en: { head: "📰 Today's market news (flash, provisional)", close: "close", open: "intraday", badge: "flash", est: s => `per flash: ${s}`,
      wait: "The official value arrives after 1 p.m. the next business day.", fxNote: "Seoul FX market rate. The card's main number is the ECB reference rate, so it differs slightly (updated around midnight KST)." },
    ja: { head: "📰 今日の相場ニュース（速報・暫定）", close: "引け", open: "場中", badge: "速報", est: s => `速報ベース ${s}`,
      wait: "公式値は翌営業日の午後1時以降に入ります。", fxNote: "ソウル外国為替市場の値です。カードの大きな数字は欧州中央銀行の基準レートなので少し異なります（韓国時間の深夜ごろ当日分）。" },
  };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];
  const WIRE = /^(연합뉴스|뉴시스)$/;
  const SYMS = ["KOSPI", "KOSDAQ", "USDKRW", "KTB3Y"];
  const UNIT = { USDKRW: "원", KTB3Y: "%" };

  // 지수마다 가장 새 소식(공식 값 날짜 다음 날 09:00 KST 뒤): 정확한 숫자 > 대략, 마감 > 장중, 늦은 것
  function latestAll() {
    const best = new Map(), after = new Map();
    for (const s of SYMS) { const r = market.latest.get(s); if (r) after.set(s, Math.floor(r._t / (24 * H)) * 24 * H + 24 * H); }
    for (const it of typeof items !== "undefined" ? items : []) {
      if (!WIRE.test(it.source_name || "")) continue;
      for (const p of parse(it.title)) {
        if (!after.has(p.sym) || !(it._t > after.get(p.sym))) continue;
        const rank = (p.exact ? 2 : 0) + (p.kind === "close" ? 1 : 0), b = best.get(p.sym);
        if (!b || rank > b.rank || (rank === b.rank && it._t > b.it._t)) best.set(p.sym, { it, p, rank });
      }
    }
    return best;
  }
  const when = t => new Intl.DateTimeFormat(undefined, { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(t);
  const fmt = (v, d = 2) => Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  function valueText(sym, p) {
    if (p.val == null) return p.pctText || "";
    const d = sym === "KTB3Y" ? 3 : sym === "USDKRW" ? 1 : 2, arrow = p.dir < 0 ? "▼" : p.dir > 0 ? "▲" : "";
    const unit = UNIT[sym] || "", head = sym === "KTB3Y" ? `연 ${fmt(p.val, d)}%` : `${fmt(p.val, d)}${unit}`;
    const chg = p.chg != null ? ` ${arrow}${fmt(Math.abs(p.chg), d === 3 ? 2 : d)}${sym === "USDKRW" ? "원" : ""}` : arrow ? ` ${arrow}` : "";
    const pct = p.pct != null ? ` (${p.pct > 0 ? "+" : "−"}${fmt(Math.abs(p.pct))}%)` : p.pctText ? ` (${p.pctText})` : "";
    return `${head}${chg}${pct}`;
  }
  const openIt = it => { showTab("news"); openItem(it, true); };

  function decorate() {
    if (!market) return;
    for (const [sym, b] of latestAll()) {
      const { it, p } = b, cls = p.dir < 0 ? "down" : p.dir > 0 ? "up" : "flat", vt = valueText(sym, p);
      const tile = document.getElementById(`px-${sym}`);
      if (tile && !tile.querySelector(".mk-live")) {
        const box = el("div", "mk-live");
        box.append(el("div", "mk-head", `${tx("head")} · ${when(it._t)} ${it.source_name} · ${tx(p.kind)}`));
        if (vt) box.append(el("div", `mk-est ${cls}`, p.exact ? vt : tx("est")(vt)));
        const t = box.appendChild(el("button", "mk-title", it.title));
        t.type = "button"; t.addEventListener("click", () => openIt(it));
        box.append(el("div", "mk-wait", sym === "USDKRW" ? tx("fxNote") : tx("wait")));
        const asof = tile.querySelector(".asof");
        if (asof) asof.after(box); else tile.append(box);
      }
      // 위쪽 시세 띠(코스피·원/달러만 있음)
      if (typeof SYM !== "undefined" && SYM[sym]) {
        const sb = [...document.querySelectorAll("#mstrip button")].find(x => x.querySelector(".n")?.textContent === SYM[sym][li()]);
        if (sb && !sb.querySelector(".mk-badge")) {
          const short = p.val != null ? (sym === "USDKRW" ? fmt(p.val, 1) : fmt(p.val)) : p.pctText || (p.dir < 0 ? "▼" : p.dir > 0 ? "▲" : "•");
          const s = sb.appendChild(el("span", `mk-badge ${cls}`, `${tx("badge")} ${short}${p.pct != null ? ` ${p.pct > 0 ? "▲" : "▼"}${fmt(Math.abs(p.pct))}%` : p.chg != null ? ` ${p.chg > 0 ? "▲" : "▼"}${fmt(Math.abs(p.chg), 1)}` : ""}`));
          s.title = `${when(it._t)} ${it.source_name}: ${it.title}\n${sym === "USDKRW" ? tx("fxNote") : tx("wait")}`;
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
.mk-est { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }
.mk-title { background: none; border: 0; padding: 0; color: var(--text); text-align: left; font: inherit; cursor: pointer; }
.mk-title:hover { text-decoration: underline; }
.mk-wait { color: var(--muted); font-size: 10.5px; }
.mk-badge { margin-left: 4px; font-size: 11px; font-weight: 800; border: 1px solid #f59e0b; border-radius: 6px; padding: 0 4px; }`;
  document.head.append(css);
})(typeof globalThis !== "undefined" ? globalThis : this);
