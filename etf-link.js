// 뉴스 주제 ↔ 국내 상장 ETF (2026-11-19 사용자 요청 "① ETF부터" — 최종 목표: 세계정세 → 투자 상품·부동산까지 이어서 추론)
// - 어떤 뉴스를 어느 주제로 볼지·주제마다 어떤 ETF 인지는 etf-core.js (이 파일이 불러옴, 서버 수집기와 같은 파일). ETF 목록은 DB etf_items(매주 다시 고름), 종가는 etf_daily.
// - 세 곳에 붙임 (index.html 수정 없음 — list-sort.js 가 이 파일을 불러옴):
//   ① 뉴스 팝업: "관련 ETF" — 제목 주제마다 대표 ETF 1개(최대 3개) + 뉴스 전후 종가 그래프. 제목 주제가 없으면 그 나라 경제 기사일 때 나라 ETF.
//      (stock-link.js 처럼 card() 를 감쌈)
//   ② 시세 탭: "뉴스 주제별 ETF (최근 24시간)" — 기사가 많고 전날보다 늘어난 주제 순 최대 9개(renderMarket 감쌈, 필터 "뉴스 주제 ETF")
//   ③ 나라 검색 줄: "📈 이 나라 ETF" (country-search.js 의 cs:draw 알림)
// - 값은 하루 한 번 종가(다음 영업일 오후) — 실시간 아님. "원인을 뜻하지 않아요 · 사라는 뜻이 아니에요"를 함께 적음.
// - 근거 코멘트(2026-11-19 사용자 요청 "① 근거 코멘트부터"): 팝업 ETF 줄 아래·시세 탭 칸에 우리 기록으로 계산한 사실만 문장으로 —
//   🔗 왜 이어졌나(제목에서 맞은 말 ETFX.whyOf) 📰 최근 24시간 기사 수 vs 지난 7일 하루 평균(DB etf_theme_days) 📈 뉴스 전 종가 대비·1년 중 위치·평소 하루 움직임(보기 etf_code_stats)
//   📊 그 주제 기사가 몰린 날(평소의 2배·10건 이상) 뒤 5거래일 중간값 vs 아무 날(보기 etf_theme_stats). 표가 아직 없거나 못 읽으면 코멘트만 빠짐.
//   현지어 번역판 기사(LANGX.foreign)는 셈에서 뺌 — 서버 기록(2026-11-18 전 날들)과 같은 기준.
// - 문제가 생기거나 목록을 못 읽으면 아무것도 안 붙이고 원래 화면은 그대로.
// ⚠️ 화면 파일: 정규식에 (?<= (?<! 금지(옛 아이폰).
(() => {
  if (typeof card !== "function" || typeof db === "undefined") return;
  const core = document.createElement("script");
  core.src = "etf-core.js";
  core.onload = () => { try { if (globalThis.ETFX) start(); } catch (e) { console.warn("etf-link", e); } };
  document.head.append(core);

  function start() {
    const X = globalThis.ETFX, MAX = 3, DAY = 86400e3, H = 3600e3, CLOSE_H = 6.5;   // 장 마감 15:30 KST = 06:30 UTC
    const TX = {
      ko: { head: "관련 ETF", place: n => `${n} 경제 기사`, note: "뉴스 주제와 이어지는 국내 상장 ETF의 하루 종가예요. 같은 때의 움직임일 뿐 원인을 뜻하지 않고, 사라는 뜻도 아니에요.",
        src: "출처: 금융위원회 증권상품시세정보", link: "네이버 증권", none: "시세 자료 없음", mark: "뉴스", won: "원", country: "📈 이 나라 ETF",
        why: (w, th) => `제목의 ‘${w}’ 때문에 ${th} 주제로 이어졌어요.`, whyPlace: th => `${th} 경제 기사라서 이어졌어요.`,
        vol: (th, n, a, r) => `최근 24시간 ${th} 기사 ${n}건 — 지난 7일 하루 평균(${a}건)${r >= 2 ? `의 ${r.toFixed(1)}배로 많아요` : r <= 0.5 ? "보다 적어요" : "과 비슷해요"}.`,
        after: (x, d) => `뉴스 전 마지막 종가보다 ${x} (${d} 종가 기준).`,
        pos: (k, lo, hi) => `지금 값은 1년 중 ${k} (1년 최저 ${lo} ~ 최고 ${hi}).`, posK: ["가장 낮은 값 근처", "낮은 쪽", "중간쯤", "높은 쪽", "가장 높은 값 근처"],
        big: (c, m, k) => `마지막 하루 ${c}는 평소 하루 움직임(${m})의 ${k}배예요.`,
        stat: (th, r, b, n, up) => `기록상 ${th} 기사가 몰린 날(평소의 2배 이상) 뒤 5거래일: 중간값 ${r} (이 ETF 아무 날 5거래일 중간값 ${b}) · ${n}번 중 ${up}번 올랐어요.`,
        few: "표본 적음", building: (d, k) => `기사가 몰린 날 뒤 값 통계는 기록을 쌓는 중이에요 (기록 ${d}일째, 몰린 날 ${k}번).`,
        tVol: r => `기사 평소의 ${r.toFixed(1)}배`, tVolLow: "기사 평소보다 적음", tVolSame: "기사 평소 수준", tPos: k => `값은 1년 중 ${k}`, tStat: (r, n) => `몰린 날 뒤 5일 중간값 ${r}(${n}번)` },
      en: { head: "Related ETFs", place: n => `${n} economy story`, note: "Daily closes of Korea-listed ETFs linked to the story's theme. Shown for timing only — not a cause, and not a recommendation.",
        src: "Source: FSC securities product prices", link: "Naver Finance", none: "No price data", mark: "news", won: "KRW", country: "📈 ETF for this country",
        why: (w, th) => `Linked to ${th} because the title says “${w}”.`, whyPlace: th => `Linked as a ${th} economy story.`,
        vol: (th, n, a, r) => `${n} ${th} stories in the last 24 h — ${r >= 2 ? `${r.toFixed(1)}× the 7-day daily average (${a})` : r <= 0.5 ? `below the 7-day daily average (${a})` : `about the 7-day daily average (${a})`}.`,
        after: (x, d) => `${x} vs. the last close before the story (as of ${d} close).`,
        pos: (k, lo, hi) => `Now ${k} of its 1-year range (${lo} – ${hi}).`, posK: ["near the bottom", "in the lower part", "in the middle", "in the upper part", "near the top"],
        big: (c, m, k) => `The last day's ${c} is ${k}× its usual daily move (${m}).`,
        stat: (th, r, b, n, up) => `On past days with a ${th} news surge (2× usual), the next 5 trading days: median ${r} (any day: ${b}) · up ${up} of ${n} times.`,
        few: "small sample", building: (d, k) => `Surge-day statistics are still being recorded (day ${d}, ${k} surge days so far).`,
        tVol: r => `stories ${r.toFixed(1)}× usual`, tVolLow: "fewer stories than usual", tVolSame: "usual story count", tPos: k => `price ${k} of 1-year range`, tStat: (r, n) => `after surges, 5-day median ${r} (${n})` },
      ja: { head: "関連ETF", place: n => `${n}の経済記事`, note: "ニュースのテーマにつながる韓国上場ETFの日次終値です。時期が重なるだけで原因を意味せず、購入の勧めでもありません。",
        src: "出典：金融委員会 証券商品相場情報", link: "Naver証券", none: "相場データなし", mark: "ニュース", won: "ウォン", country: "📈 この国のETF",
        why: (w, th) => `タイトルの「${w}」で${th}テーマにつながりました。`, whyPlace: th => `${th}の経済記事なのでつながりました。`,
        vol: (th, n, a, r) => `直近24時間の${th}記事${n}件 — 過去7日の1日平均（${a}件）${r >= 2 ? `の${r.toFixed(1)}倍と多めです` : r <= 0.5 ? "より少なめです" : "並みです"}。`,
        after: (x, d) => `ニュース前の最後の終値より${x}（${d}終値基準）。`,
        pos: (k, lo, hi) => `今の値は1年の中で${k}（1年の最安${lo}〜最高${hi}）。`, posK: ["最安値の近く", "安い側", "中間", "高い側", "最高値の近く"],
        big: (c, m, k) => `最後の1日の${c}は普段の1日の動き（${m}）の${k}倍です。`,
        stat: (th, r, b, n, up) => `記録上、${th}記事が集中した日（普段の2倍以上）の後5営業日：中央値${r}（このETFの任意の日：${b}）・${n}回中${up}回上昇。`,
        few: "標本が少ない", building: (d, k) => `記事集中日の後の統計は記録中です（記録${d}日目、集中日${k}回）。`,
        tVol: r => `記事 普段の${r.toFixed(1)}倍`, tVolLow: "記事 普段より少ない", tVolSame: "記事 普段並み", tPos: k => `値は1年の${k}`, tStat: (r, n) => `集中日後5日 中央値${r}（${n}回）` },
    };
    const tx = k => (TX[LANG] || TX.ko)[k];
    const tname = id => { const t = X.BY.get(id); return t ? (t[LANG] || t.ko) : id; };
    const naver = code => `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(code)}`;   // 외부 사이트(새 창) — 가져오는 것 없음
    const isoDay = t => new Date(t + 9 * H).toISOString().slice(0, 10);   // 한국 날짜

    // ETF 목록: 주제 → ETF(순자산 큰 순). 처음 필요할 때 읽고 1시간마다 다시
    let byTheme = null, listAt = 0, loading = null;
    function loadList() {
      if (byTheme && Date.now() - listAt < H) return Promise.resolve(byTheme);
      return loading || (loading = (async () => {
        try {
          const { data, error } = await db.from("etf_items").select("code,name,idx_name,themes,assets").eq("active", true).order("assets", { ascending: false }).limit(300);
          if (!error && data?.length) {
            const m = new Map();
            for (const e of data) for (const id of e.themes || []) (m.get(id) || m.set(id, []).get(id)).push(e);
            byTheme = m; listAt = Date.now();
          }
        } catch { /* 다음에 다시 */ } finally { loading = null; }
        return byTheme;
      })());
    }
    // 뉴스 한 건 → [{ etf, theme, place }] 최대 3개
    function etfsFor(it, m) {
      const ids = X.themesOf(it), out = [], seen = new Set();
      const add = (id, k, place) => { const e = (m.get(id) || [])[k]; if (e && !seen.has(e.code) && out.length < MAX) { seen.add(e.code); out.push({ etf: e, theme: id, place }); } };
      for (const id of ids) add(id, 0, false);
      if (ids.length === 1) add(ids[0], 1, false);
      if (!ids.length) { const p = X.placeTheme(it); if (p) add(p, 0, true); }
      return out;
    }
    // 종가: 종목·기간마다 한 번만 읽음
    const cache = new Map();
    async function prices(codes, lo, hi) {
      const k = `${codes.join(",")}|${lo}|${hi}`;
      if (!cache.has(k)) cache.set(k, (async () => {
        const { data, error } = await db.from("etf_daily").select("code,d,close,chg").in("code", codes).gte("d", lo).lte("d", hi).order("d");
        if (error) { cache.delete(k); throw error; }
        return data || [];
      })());
      return cache.get(k);
    }

    // ── 근거 코멘트 재료(1시간마다): ETF 값 위치·평소 움직임, 주제 × ETF "몰린 날 뒤" 통계, 지난 7일 주제별 하루 기사 수 ──
    let st = null, stAt = 0, stLoading = null;
    function loadStats() {
      if (st && Date.now() - stAt < H) return Promise.resolve(st);
      return stLoading || (stLoading = (async () => {
        try {
          const today = isoDay(Date.now());
          const [a, b, c] = await Promise.all([
            db.from("etf_code_stats").select("code,last_d,last_close,lo_1y,hi_1y,pos_pct,med_abs_chg,med_r5,n_r5"),
            db.from("etf_theme_stats").select("theme,code,days,spikes,n5,med_r5,up5"),
            db.from("etf_theme_days").select("day,theme,n").gte("day", isoDay(Date.now() - 8 * DAY)).lt("day", today).order("day").limit(1000)]);
          const days = new Map();
          for (const r of c.data || []) (days.get(r.theme) || days.set(r.theme, []).get(r.theme)).push(r.n);
          for (const [k, v] of days) days.set(k, v.slice(-7));
          st = { code: new Map((a.data || []).map(r => [r.code, r])), theme: new Map((b.data || []).map(r => [`${r.theme}|${r.code}`, r])), days };
          stAt = Date.now();
        } catch { /* 다음에 다시 — 코멘트만 빠짐 */ } finally { stLoading = null; }
        return st;
      })());
    }
    // 최근 24시간 주제별 기사 수(5분 동안 다시 씀) — 서버 기록과 같게 현지어 번역판은 뺌
    let c24 = { at: 0, items: null, len: -1, m: null };
    function counts24() {
      if (c24.items === items && c24.len === items.length && Date.now() - c24.at < 5 * 60e3) return c24.m;
      const now = Date.now(), m = new Map();
      for (const it of items) {
        if (!(it._t >= now - 24 * H && it._t <= now + 10 * 60e3) || globalThis.LANGX?.foreign(it.title)) continue;
        for (const id of X.themesOf(it)) m.set(id, (m.get(id) || 0) + 1);
      }
      c24 = { at: now, items, len: items.length, m };
      return m;
    }
    const pct = (v, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`;
    const wonT = v => `${Math.round(v).toLocaleString(LANG === "en" ? "en-US" : LANG === "ja" ? "ja-JP" : "ko-KR")}${LANG === "en" ? " " : ""}${tx("won")}`;
    const posKey = p => tx("posK")[p <= 5 ? 0 : p <= 25 ? 1 : p < 75 ? 2 : p < 95 ? 3 : 4];
    // 지난 7일 하루 평균 대비(기록 3일 이상일 때만) → { n, avg, r } 또는 null
    function volume(id, s) {
      const v = s?.days.get(id);
      if (!v || v.length < 3) return null;
      const n = counts24().get(id) || 0, avg = v.reduce((a, b) => a + b, 0) / v.length;
      return { n, avg: Math.round(avg), r: (n + 1) / (avg + 1) };
    }
    // 팝업 ETF 한 줄 아래 코멘트(사실만, 줄마다 근거 하나)
    function comment(h, it, pts, newsT, s) {
      const lines = [], th = tname(h.theme);
      const w = h.place ? null : X.whyOf(it, h.theme);
      lines.push(["🔗", h.place ? tx("whyPlace")(th) : w ? tx("why")(w, th) : null]);
      const v = volume(h.theme, s);
      if (v) lines.push(["📰", tx("vol")(th, v.n, v.avg, v.r)]);
      const last = pts.at(-1), before = pts.filter(p => p.t < newsT).at(-1);
      if (before && last.t > newsT && before !== last) lines.push(["📈", tx("after")(pct((last.v / before.v - 1) * 100), dayText(last.d))]);
      const cs = s?.code.get(h.etf.code);
      if (cs && cs.pos_pct != null) lines.push(["📈", tx("pos")(posKey(cs.pos_pct), wonT(cs.lo_1y), wonT(cs.hi_1y))]);
      if (cs && cs.med_abs_chg > 0 && last.chg != null && Math.abs(last.chg) >= 2 * cs.med_abs_chg)
        lines.push(["📈", tx("big")(`${last.chg > 0 ? "▲" : "▼"}${Math.abs(last.chg).toFixed(2)}%`, `${Number(cs.med_abs_chg).toFixed(1)}%`, (Math.abs(last.chg) / cs.med_abs_chg).toFixed(1))]);
      const ts = s?.theme.get(`${h.theme}|${h.etf.code}`);
      if (ts && ts.n5 >= 5 && ts.med_r5 != null && cs?.med_r5 != null)
        lines.push(["📊", `${tx("stat")(th, pct(ts.med_r5 * 100), pct(cs.med_r5 * 100), ts.n5, Math.round(ts.up5 * ts.n5))}${ts.n5 < 30 ? ` ⚠️ ${tx("few")}` : ""}`]);
      else if (ts) lines.push(["📊", tx("building")(ts.days, ts.spikes)]);
      const out = el("ul", "etf-cmt");
      for (const [ic, t] of lines) if (t) { const li = out.appendChild(el("li")); li.append(el("span", "ic", ic), el("span", null, t)); }
      return out.children.length ? out : null;
    }
    // 시세 탭 칸의 한 줄 요약
    function tileComment(e, s) {
      const parts = [], v = volume(e.id, s), cs = s?.code.get(e.etf.code), ts = s?.theme.get(`${e.id}|${e.etf.code}`);
      if (v) parts.push(v.r >= 2 ? tx("tVol")(v.r) : v.r <= 0.5 ? tx("tVolLow") : tx("tVolSame"));
      if (cs && cs.pos_pct != null) parts.push(tx("tPos")(posKey(cs.pos_pct)));
      if (ts && ts.n5 >= 5 && ts.med_r5 != null) parts.push(tx("tStat")(pct(ts.med_r5 * 100), ts.n5));
      return parts.length ? el("div", "etf-cmt1", parts.join(" · ")) : null;
    }

    // 작은 그래프(stock-link.js 와 같은 모양): 가로 = 시간, 세로 = 종가, 뉴스 시점 점선
    function chart(h, pts, newsT) {
      const won = v => `${Math.round(v).toLocaleString(LANG === "en" ? "en-US" : LANG === "ja" ? "ja-JP" : "ko-KR")}${LANG === "en" ? " " : ""}${tx("won")}`;
      const last = pts.at(-1), t0 = pts[0].t, t1 = Math.max(last.t, newsT), tspan = t1 - t0 || 1;
      const vs = pts.map(p => p.v), vlo = Math.min(...vs), vhi = Math.max(...vs), vspan = vhi - vlo || 1;
      const Xp = t => ((t - t0) / tspan) * 100, Y = v => 33 - ((v - vlo) / vspan) * 28;
      const NS = "http://www.w3.org/2000/svg";
      const mk = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
      const line = { fill: "none", "vector-effect": "non-scaling-stroke", "stroke-linecap": "round", "stroke-linejoin": "round" };
      const box = el("div", "etf-row");
      const head = box.appendChild(el("div", "etf-name"));
      const left = head.appendChild(el("span", "etf-left"));
      left.append(el("span", "etf-chip", h.place ? tx("place")(tname(h.theme)) : tname(h.theme)));
      const a = left.appendChild(el("a", null, h.etf.name));
      a.href = naver(h.etf.code); a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = `${h.etf.idx_name || ""} · ${tx("link")} ↗`;
      const chg = last.chg != null ? ` ${last.chg > 0 ? "▲" : last.chg < 0 ? "▼" : ""}${Math.abs(last.chg).toFixed(2)}%` : "";
      const valEl = head.appendChild(el("span", "etf-val", `${dayText(last.d)} ${won(last.v)}${chg}`));
      const svg = mk("svg", { viewBox: "0 0 100 36", preserveAspectRatio: "none", role: "img",
        "aria-label": `${h.etf.name}: ${dayText(pts[0].d)} ${won(pts[0].v)} → ${dayText(last.d)} ${won(last.v)}` });
      const xn = Xp(newsT);
      svg.append(
        mk("path", { ...line, d: `M${xn} 2V36`, stroke: "var(--muted)", "stroke-width": 1, "stroke-dasharray": "2 2" }),
        mk("path", { ...line, d: pts.map((p, i) => `${i ? "L" : "M"}${Xp(p.t).toFixed(2)} ${Y(p.v).toFixed(2)}`).join(""), stroke: "var(--accent)", "stroke-width": 2 }));
      const cross = svg.appendChild(mk("path", { ...line, stroke: "var(--text)", "stroke-width": 1, opacity: 0.4, visibility: "hidden" }));
      const dot = svg.appendChild(mk("path", { ...line, stroke: "var(--text)", "stroke-width": 7, visibility: "hidden" }));
      const wrap = box.appendChild(el("div", "etf-chart"));
      wrap.append(svg);
      const markEl = wrap.appendChild(el("span", "etf-mark", tx("mark")));
      markEl.style.left = `${Math.min(92, Math.max(0, xn))}%`;
      const axis = box.appendChild(el("div", "etf-axis"));
      axis.append(el("span", null, dayText(pts[0].d)), el("span", null, dayText(newsT > last.t ? newsT : last.d)));
      const lastText = valEl.textContent;
      svg.addEventListener("pointermove", e => {
        const r = svg.getBoundingClientRect(), tt = t0 + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * tspan;
        const p = pts.reduce((x, y) => (Math.abs(y.t - tt) < Math.abs(x.t - tt) ? y : x));
        cross.setAttribute("d", `M${Xp(p.t)} 0V36`); dot.setAttribute("d", `M${Xp(p.t)} ${Y(p.v)}l0 0`);
        cross.setAttribute("visibility", "visible"); dot.setAttribute("visibility", "visible");
        valEl.textContent = `${dayText(p.d)} · ${won(p.v)}`;
      });
      svg.addEventListener("pointerleave", () => {
        cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); valEl.textContent = lastText;
      });
      return box;
    }

    async function addBlock(box, it, hits) {
      const newsT = it._t, lo = isoDay(newsT - 10 * DAY), hi = isoDay(Math.min(Date.now(), newsT + 10 * DAY));
      let rows = [];
      const sp = loadStats().catch(() => null);
      try { rows = await prices(hits.map(h => h.etf.code), lo, hi); } catch (e) { console.warn("etf-link prices", e); }
      const s = await sp;
      const sec = el("section", "etf");
      sec.append(el("div", "etf-head", tx("head")));
      for (const h of hits) {
        let pts = rows.filter(r => r.code === h.etf.code).map(r => {
          const d = Date.parse(`${r.d}T00:00:00Z`);
          return { t: d + CLOSE_H * H, d, v: Number(r.close), chg: r.chg };
        });
        const near = pts.filter(p => p.t >= newsT - 7 * DAY && p.t <= newsT + 7 * DAY);   // 뉴스 전후 7일 안을 먼저, 연휴면 10일 안
        if (near.length >= 3) pts = near;
        if (pts.length >= 2) {
          sec.append(chart(h, pts, newsT));
          try { const c = comment(h, it, pts, newsT, s); if (c) sec.append(c); } catch (e) { console.warn("etf-link comment", e); }
        }
        else { const r = sec.appendChild(el("div", "etf-name")); r.append(el("span", null, h.etf.name), el("span", "etf-val", tx("none"))); }
      }
      sec.append(el("div", "etf-note", `${tx("note")} ${tx("src")}`));
      box.append(sec);
      if (popup?.getElement()?.contains(box)) popup.setLngLat(popup.getLngLat());   // 늦게 붙으면 팝업 위치를 다시 계산
    }

    const base = card;
    card = function (it, inPopup, priority) {
      const box = base(it, inPopup, priority);
      if (!inPopup || !it || !Number.isFinite(it._t) || !it.title) return box;
      try {
        loadList().then(m => {
          if (!m) return;
          const hits = etfsFor(it, m);
          if (hits.length) addBlock(box, it, hits).catch(e => console.warn("etf-link", e));
        });
      } catch (e) { console.warn("etf-link", e); }   // 문제가 생겨도 뉴스 팝업은 그대로
      return box;
    };

    // ════════ 시세 탭: 뉴스 주제별 ETF (최근 24시간) ════════
    const MT = {
      ko: { group: "뉴스 주제별 ETF (최근 24시간)", filt: "뉴스 주제 ETF", n: (n, p) => `뉴스 ${n}건 · 전날 ${p}건`, close: "종가", daily: "하루 1번(다음 영업일 오후)", d5: "5거래일",
        empty: "최근 24시간 뉴스에 ETF 주제가 거의 없어요.", loading: "주제를 고르는 중…",
        note: "최근 24시간 뉴스 제목을 반도체·원전·금·나라 등 48개 주제로 나눠, 기사가 많고 전날보다 늘어난 주제 순서로 대표 국내 상장 ETF(순자산이 가장 큰 것)를 보여요. 값은 하루 종가, 추세선은 약 3달이에요. 칸 아래 한 줄은 우리 기록으로 계산한 사실이에요(평소 = 지난 7일 하루 평균, 몰린 날 = 평소의 2배 이상·10건 이상, 1년 중 위치 = 최근 1년 종가 중 어디쯤). 뉴스가 많다고 오른다는 뜻도, 사라는 뜻도 아니에요. 출처: 금융위원회 증권상품시세정보(공공누리 4유형)." },
      en: { group: "ETFs by news theme (last 24 h)", filt: "News-theme ETFs", n: (n, p) => `${n} stories · ${p} the day before`, close: "close", daily: "Once a day (next business day)", d5: "5 days",
        empty: "Few ETF themes in the last 24 hours of news.", loading: "Picking themes…",
        note: "News titles from the last 24 hours are sorted into 48 themes (chips, nuclear, gold, countries…). Themes with many and rising stories come first, each with its largest Korea-listed ETF. Daily closes; trend line ≈ 3 months. The line under each tile is computed from our own records (usual = 7-day daily average; surge = 2× usual and 10+ stories; range = last 1 year of closes). Not a forecast or a recommendation. Source: FSC securities product prices (KOGL type 4)." },
      ja: { group: "ニューステーマ別ETF（直近24時間）", filt: "ニューステーマETF", n: (n, p) => `ニュース${n}件・前日${p}件`, close: "終値", daily: "1日1回（翌営業日午後）", d5: "5営業日",
        empty: "直近24時間のニュースにETFテーマがほとんどありません。", loading: "テーマを選んでいます…",
        note: "直近24時間のニュースのタイトルを半導体・原発・金・国など48テーマに分け、記事が多く前日より増えたテーマ順に代表的な韓国上場ETF（純資産が最大のもの）を表示します。日次終値、推移線は約3か月。各枠の下の1行は当サイトの記録から計算した事実です（普段＝過去7日の1日平均、集中日＝普段の2倍以上かつ10件以上、位置＝直近1年の終値の中）。予測や推奨ではありません。出典：金融委員会 証券商品相場情報（公共ヌリ4類型）。" },
    };
    const mt = k => (MT[LANG] || MT.ko)[k];
    for (const k of Object.keys(MT)) if (T[k]?.mFilt) T[k].mFilt.etf = MT[k].filt;
    if (typeof MKT_FILTER !== "undefined" && !MKT_FILTER.includes("etf")) MKT_FILTER.splice(MKT_FILTER.includes("stocks") ? 1 : 0, 0, "etf");

    // 최근 24시간·그 전 24시간 소식 → 주제별 기사(5분 동안 다시 씀)
    let topAt = 0, topItems = null, topLen = -1, topRes = [];
    function topThemes(m) {
      if (topItems === items && topLen === items.length && Date.now() - topAt < 5 * 60e3) return topRes;
      const now = Date.now(), cur = new Map(), prev = new Map();
      for (const it of items) {
        if (!(it._t >= now - 48 * H && it._t <= now + 10 * 60e3)) continue;
        const into = it._t >= now - 24 * H ? cur : prev;
        for (const id of X.themesOf(it)) (into.get(id) || into.set(id, []).get(id)).push(it);
      }
      // 무게 = 기사 수^0.75 × √(늘어난 정도) — 늘 많은 주제(AI·미국)만 위에 있지 않게
      topRes = [...cur.entries()].filter(([id, a]) => a.length >= 3 && (m.get(id) || []).length)
        .map(([id, a]) => { const p = (prev.get(id) || []).length; return { id, news: a.sort((x, y) => y._t - x._t), prev: p, etf: m.get(id)[0], w: Math.pow(a.length, 0.75) * Math.sqrt((a.length + 3) / (p + 3)) }; })
        .sort((a, b) => b.w - a.w).slice(0, 9);
      topItems = items; topLen = items.length; topAt = now;
      return topRes;
    }
    // ETF 들의 최근 약 95일 종가(30분 동안 다시 씀)
    const histCache = new Map();
    async function history(codes) {
      const k = codes.slice().sort().join(","), c = histCache.get(k);
      if (c && Date.now() - c.at < 30 * 60e3) return c.p;
      const p = (async () => {
        const out = [];
        for (let i = 0; i < codes.length; i += 6) {           // 1,000줄 한도 안으로 나눠 읽음(6개 × 약 65일)
          const { data, error } = await db.from("etf_daily").select("code,d,close,chg").in("code", codes.slice(i, i + 6))
            .gte("d", isoDay(Date.now() - 95 * DAY)).order("d").limit(1000);
          if (error) throw error;
          out.push(...(data || []));
        }
        return out;
      })();
      histCache.set(k, { at: Date.now(), p });
      p.catch(() => histCache.delete(k));
      return p;
    }
    function themeTile(e, rows, s) {
      const box = el("article", "tile etf-tile");
      box.id = `px-ETF-${e.etf.code}`;
      const lbl = box.appendChild(el("div", "lbl"));
      lbl.append(el("b", null, tname(e.id)), " ");
      const a = lbl.appendChild(el("a", null, e.etf.name));
      a.href = naver(e.etf.code); a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = `${e.etf.idx_name || ""} · ${tx("link")} ↗`;
      const pts = rows.filter(r => r.code === e.etf.code).map(r => ({ t: Date.parse(`${r.d}T00:00:00Z`), v: Number(r.close), chg: r.chg }));
      const last = pts.at(-1);
      if (last) {
        const val = box.appendChild(el("div", "val", new Intl.NumberFormat(LOCALE[LANG], { maximumFractionDigits: 0 }).format(last.v)));
        val.appendChild(el("small", null, UNITS.KRW[li()]));
        const c = last.chg ?? 0, dir = c > 0 ? "up" : c < 0 ? "down" : "flat";
        let txt = `${c > 0 ? "▲" : c < 0 ? "▼" : "–"} ${Math.abs(c).toFixed(2)}% ${t("mPrev")}`;
        const p5 = pts.at(-6);
        if (p5) { const r5 = (last.v / p5.v - 1) * 100; txt += ` · ${mt("d5")} ${r5 > 0 ? "+" : ""}${r5.toFixed(1)}%`; }
        box.append(el("div", `dlt ${dir}`, txt));
        box.append(el("div", "asof", `${dayText(last.t)} ${mt("close")} · ${mt("daily")}`));
        if (pts.length >= 2) box.append(spark(pts, "KRW", box));
      } else box.append(el("div", "asof", tx("none")));
      const news = box.appendChild(el("div", "etf-news"));
      news.append(el("div", "etf-cnt", mt("n")(e.news.length, e.prev)));
      try { const c = tileComment(e, s); if (c) news.append(c); } catch { /* 코멘트만 빠짐 */ }
      for (const it of e.news.slice(0, 2)) {
        const b = news.appendChild(el("button", null, it.title));
        b.type = "button"; b.title = it.title;
        b.addEventListener("click", () => { showTab("news"); openItem(it, true); });
      }
      return box;
    }
    let mktToken = 0;
    async function fillThemes(token) {
      const sec = el("section", "etf-mkt");
      sec.append(el("h3", null, mt("group")), el("p", "empty", mt("loading")));
      const anchor = $("market").querySelector(".stk-mkt");          // "뉴스에 많이 나온 종목" 바로 아래(없으면 맨 위)
      if (anchor) anchor.after(sec); else $("market").prepend(sec);
      try {
        const m = await loadList();
        if (token !== mktToken || !m) return sec.remove();
        for (let i = 0; !items.length && i < 30; i++) {            // 시세가 뉴스보다 먼저 오면 뉴스가 들어올 때까지 잠깐 기다림(최대 1분)
          await new Promise(r => setTimeout(r, 2000));
          if (token !== mktToken) return;
        }
        const top = topThemes(m);
        if (!top.length) { sec.replaceChildren(el("h3", null, mt("group")), el("p", "empty", mt("empty"))); return; }
        const [rows, s] = await Promise.all([history([...new Set(top.map(e => e.etf.code))]), loadStats().catch(() => null)]);
        if (token !== mktToken || !sec.isConnected) return;
        const grid = el("div", "tiles");
        grid.append(...top.map(e => themeTile(e, rows, s)));
        sec.replaceChildren(el("h3", null, mt("group")), grid, el("p", "mnote", mt("note")));
      } catch (e) { console.warn("etf-link market", e); sec.remove(); }
    }
    if (typeof renderMarket === "function") {
      const baseRender = renderMarket;
      renderMarket = function () {
        baseRender();
        try {
          const token = ++mktToken;
          if (market && market.latest.size && !hiddenMkt.has("etf")) fillThemes(token);
        } catch (e) { console.warn("etf-link market", e); }
      };
      if (market) renderMarket();                                 // 이미 그려져 있으면 한 번 더
    }

    // ════════ 나라 검색 줄: 이 나라 ETF ════════
    let csTok = 0;
    document.addEventListener("cs:draw", ev => {
      const { country, bar } = ev.detail || {};
      if (!bar) return;
      bar.querySelector(".cs-etf")?.remove();
      const id = country && X.countryTheme(country.en, true), tok = ++csTok;
      if (!id) return;
      loadList().then(m => {
        const e = m && (m.get(id) || [])[0];
        if (!e || tok !== csTok || !bar.isConnected) return;
        bar.querySelector(".cs-etf")?.remove();
        const a = el("a", "cs-etf", `${tx("country")}: ${e.name}`);
        a.href = naver(e.code); a.target = "_blank"; a.rel = "noopener noreferrer"; a.title = `${e.idx_name || ""} · ${tx("link")} ↗`;
        bar.querySelector(".cs-off")?.before(a);
      });
    });
    if (globalThis.CSEARCH && $("q").value) $("q").dispatchEvent(new Event("input", { bubbles: true }));   // 이미 나라 검색 중이면 줄을 다시 그림

    const css = document.createElement("style");
    css.textContent = `
.maplibregl-popup-content > .card:has(> .etf) { max-height: calc(var(--npl-max, 46vh) - 28px); overflow-y: auto; overscroll-behavior: contain; }
.etf { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 6px; display: grid; gap: 6px; }
.etf-head { font-size: 11.5px; font-weight: 700; color: var(--muted); }
.etf-row { display: grid; gap: 1px; }
.etf-name { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; align-items: baseline; }
.etf-left { min-width: 0; display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
.etf-chip { font-size: 10.5px; color: var(--accent); border: 1px solid var(--line); border-radius: 999px; padding: 0 6px; white-space: nowrap; }
.etf-name a { color: var(--text); text-decoration: none; font-weight: 600; }
.etf-name a:hover { text-decoration: underline; }
.etf-val { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.etf-chart { position: relative; }
.etf-chart svg { width: 100%; height: 26px; display: block; overflow: visible; touch-action: pan-y; }
.etf-mark { position: absolute; top: -4px; transform: translateX(3px); font-size: 10px; color: var(--muted); pointer-events: none; }
.etf-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); line-height: 1.2; }
.etf-cmt { list-style: none; margin: 2px 0 2px; padding: 0; display: grid; gap: 1px; font-size: 11px; line-height: 1.4; color: var(--text); }
.etf-cmt li { display: flex; gap: 4px; }
.etf-cmt .ic { flex: none; width: 1.3em; }
.etf-cmt1 { font-size: 11px; color: var(--muted); line-height: 1.35; }
.etf-note { font-size: 10.5px; color: var(--muted); line-height: 1.4; }
.etf-tile .lbl b { font-weight: 800; }
.etf-tile .lbl a { color: var(--muted); font-size: 11px; text-decoration: none; }
.etf-tile .lbl a:hover { text-decoration: underline; color: var(--text); }
.etf-news { display: grid; gap: 1px; margin-top: 4px; border-top: 1px dashed var(--line); padding-top: 4px; min-width: 0; }
.etf-cnt { font-size: 11px; font-weight: 700; color: var(--accent); }
.etf-news button { background: none; border: 0; padding: 0; text-align: left; color: var(--text); font-size: 11.5px; cursor: pointer;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.etf-news button:hover { text-decoration: underline; }
.cs-bar .cs-etf { flex: none; color: var(--text); font-size: 11.5px; text-decoration: none; border: 1px solid var(--line); border-radius: 6px; padding: 3px 8px;
  max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cs-bar .cs-etf:hover { text-decoration: underline; }`;
    document.head.append(css);
  }
})();
