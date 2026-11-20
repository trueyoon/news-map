// AI 예측·해설 화면 (2026-11-20 사용자 요청 — 최종 목표: 세계정세 → 투자 상품·부동산까지 이어서 추론)
// - 서버 함수 ai-brief 가 매일 아침(07:25 KST) Claude 에게 우리 기록의 숫자(재료)만 주고 받은 것을 검사해 저장:
//   ai_notes(하루 한 줄: headline · forecasts 상품별 1주·1달 예측 · notes 항목별 한마디 · facts 재료) + ai_forecasts(예측 줄, 기간이 지나면 채점).
// - 이 파일: ① 최신 한 줄을 읽어 globalThis.AINOTE 로 나눠 줌(forecast.js "🔮 예측" 창이 씀 — 이 파일이 불러옴)
//   ② 사용자 요청 "해설을 위에 몰지 말고 하나하나에": 뉴스 팝업(그 기사 주제의 한마디 + 그 주제 ETF 예측) ·
//      시세 탭 카드(#px-기호)·ETF 칸(#px-ETF-코드)마다 "🔮 1주 … · 1달 …" + "🤖 한마디"를 붙임.
//   (판 1에서 ☀ 요약 창 맨 위에 붙이던 AI 해설은 요약이 길어서 뺌.)
// - Claude 를 부르지 않음(화면을 열어도 비용 0). 표가 없거나 못 읽으면 아무것도 안 붙임. index.html·brief.js 수정 없음(list-sort.js 가 이 파일을 불러옴).
// ⚠️ 화면 파일: 정규식에 (?<= (?<! 금지(옛 아이폰).
(() => {
  if (typeof db === "undefined" || typeof el !== "function") return;
  const H = 3600e3;
  const TX = {
    ko: { call: { up: "▲ 상승", down: "▼ 하락", flat: "→ 보합(옛 예측)" }, prob: p => `확률 ${p}%`, exp: v => `예상 ${v}`, hz: { "1w": "1주", "1m": "1달", "3m": "3개월" }, ai: "AI 한마디", fc: "AI 예측",
      kinds: { P: "시세", N: "큰 소식", E: "뉴스 주제 → ETF", D: "공시", R: "부동산" }, tip: "AI(Claude)가 이 사이트의 기록 숫자만으로 쓴 참고용 예측·해설이에요. 틀릴 수 있고, 사라·팔라는 뜻이 아니에요." },
    en: { call: { up: "▲ up", down: "▼ down", flat: "→ flat (old)" }, prob: p => `${p}% likely`, exp: v => `exp. ${v}`, hz: { "1w": "1 wk", "1m": "1 mo", "3m": "3 mo" }, ai: "AI note", fc: "AI forecast",
      kinds: { P: "Price", N: "Top story", E: "News theme → ETF", D: "Filing", R: "Real estate" }, tip: "Reference forecast/notes written by AI (Claude) from this site's recorded numbers only (in Korean). It can be wrong and is not a recommendation." },
    ja: { call: { up: "▲ 上昇", down: "▼ 下落", flat: "→ 横ばい（旧）" }, prob: p => `確率${p}%`, exp: v => `予想 ${v}`, hz: { "1w": "1週", "1m": "1か月", "3m": "3か月" }, ai: "AIひとこと", fc: "AI予測",
      kinds: { P: "相場", N: "大きなニュース", E: "ニューステーマ→ETF", D: "開示", R: "不動産" }, tip: "AI（Claude）が当サイトの記録の数字だけで書いた参考用の予測・解説です（韓国語）。誤りがあり得て、売買の勧めではありません。" },
  };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];

  // 최신 한 줄(1시간마다 다시). 표가 없으면 null, 줄이 없으면 { empty: true }
  let note = undefined, at = 0, loading = null;
  const subs = new Set();                                  // 새로 읽으면 알려 줄 곳(시세 칸 다시 붙이기 등)
  function load() {
    if (note !== undefined && Date.now() - at < H) return Promise.resolve(note);
    return loading || (loading = (async () => {
      try {
        const { data, error } = await db.from("ai_notes").select("day,slot,created_at,model,ver,note,facts,dropped,cost_usd")
          .not("note", "is", null).order("day", { ascending: false }).order("created_at", { ascending: false }).limit(1);
        note = error ? null : data?.length ? index(data[0]) : { empty: true };
        at = Date.now();
      } catch { note = null; at = Date.now() - H + 5 * 60e3; }   // 실패하면 5분 뒤 다시
      finally { loading = null; }
      for (const f of subs) try { f(note); } catch { /* 무시 */ }
      return note;
    })());
  }
  // 찾기 쉽게: 예측은 pid → {1w, 1m, 3m}, 한마디는 target → 글, 재료는 id → 사실, 주제 → 그 주제 ETF pid
  function index(row) {
    const N = row.note || {}, fc = new Map(), notes = new Map(), facts = new Map(), themeEtf = new Map();
    for (const f of N.forecasts || []) (fc.get(f.pid) || fc.set(f.pid, {}).get(f.pid))[f.horizon] = f;
    for (const n of N.notes || []) notes.set(n.target, n);
    for (const f of row.facts || []) { facts.set(f.id, f); if (f.theme_id && f.pid) themeEtf.set(f.theme_id, f.pid); }
    return { ...row, fc, notes, factMap: facts, themeEtf };
  }

  // 재료 한 줄 요약(근거 펼치기용)
  function factLine(f) {
    switch (f.id?.[0]) {
      case "P": return `${f.name} ${Number(f.value).toLocaleString()} (${f.change}, ${f.as_of})`;
      case "N": return `${f.title} — ${f.source || ""}${f.articles ? ` · 기사 ${f.articles}건` : ""}`;
      case "E": return `${f.theme}: 24시간 ${f.articles_24h}건 · 평소의 ${f.vs_usual} → ${f.etf}${f.etf_1y_position ? ` · ${f.etf_1y_position}` : ""}`;
      case "D": return `${f.company} · ${f.kind} · ${f.report}${f.past_same_kind_5d_vs_market ? ` · ${f.past_same_kind_5d_vs_market}` : ""}`;
      case "R": return `${f.area} ${f.month}: 거래 ${f.trades}건 · ㎡당 ${f.median_price_per_m2_manwon}만원(구별 중간값의 중간값)`;
      default: return JSON.stringify(f).slice(0, 120);
    }
  }
  // 소식 근거를 누르면: 화면에 있는 기사면 팝업, 아니면 원문 새 창
  function openUrl(u) {
    const it = typeof items !== "undefined" && items.find(x => x.url === u);
    if (it && typeof openItem === "function") { document.querySelectorAll(".rf-pop:not([hidden]) .rf-x").forEach(b => b.click()); showTab("news"); openItem(it, true); }
    else window.open(u, "_blank", "noopener,noreferrer");
  }
  // 근거 펼치기(<details>)
  function factsBox(n, ids) {
    ids = (ids || []).filter(id => n.factMap.has(id));
    if (!ids.length) return null;
    const d = el("details", "ai-facts");
    d.append(el("summary", null, ({ en: `${ids.length} source fact(s)`, ja: `根拠${ids.length}件` })[LANG] || `근거 ${ids.length}개`));
    const ul = d.appendChild(el("ul"));
    for (const id of ids) {
      const f = n.factMap.get(id), row = ul.appendChild(el("li"));
      row.append(el("span", "ai-fid", `${id} ${tx("kinds")[id[0]] || ""}`));
      const u = f.url || f.headlines?.[0]?.url;
      if (u) { const b = row.appendChild(el("button", "ai-flink", factLine(f))); b.type = "button"; b.addEventListener("click", () => openUrl(u)); }
      else row.append(el("span", null, factLine(f)));
    }
    return d;
  }
  // 예측 한 조각 글: "▲ 상승 확률 58% · 예상 +1.5%" (사용자 2026-11-20 "55%가 0.5배 오른다는 뜻? %를 눈에 보이게" — 확률과 예상 변화율을 나눠 씀)
  const expText = f => f.exp_move == null ? null : `${f.exp_move > 0 ? "+" : "−"}${Math.abs(f.exp_move)}${f.unit || "%"}`;
  function fcText(f) { const e = expText(f); return `${tx("call")[f.call]} ${tx("prob")(f.prob)}${e ? ` · ${tx("exp")(e)}` : ""}`; }
  // 예측 한 줄(색: 상승 빨강 · 하락 파랑 — 사용자 요청, 화면 언어의 오름·내림 색 --up/--down): "🔮 1주 ▲ 상승 확률 58% · 예상 +1.5%  |  1달 ▼ 하락 확률 52% · 예상 −0.8%"
  function fcLine(byH) {
    const hs = ["1w", "1m", "3m"].filter(h => byH?.[h]);
    if (!hs.length) return null;
    const span = el("span");
    span.append("🔮 ");
    hs.forEach((h, i) => { if (i) span.append(el("span", "fc-sep", " | ")); span.append(`${tx("hz")[h]} `, el("span", `fc-${byH[h].call}`, fcText(byH[h]))); });
    return span;
  }
  // 칸에 붙는 작은 상자: 예측 줄 + 한마디 + 근거
  function chip(n, pid, noteKey) {
    const byH = pid ? n.fc.get(pid) : null, nt = n.notes.get(noteKey || pid);
    const line = fcLine(byH);
    if (!line && !nt) return null;
    const box = el("div", "ai-chip");
    box.title = tx("tip");
    if (line) { const b = box.appendChild(el("button", "ai-fcline")); b.append(line); b.type = "button"; b.addEventListener("click", e => { e.stopPropagation(); globalThis.AIFC?.open(pid); }); }
    if (nt) box.append(el("div", "ai-note1", `🤖 ${nt.text}`));
    const ids = [...new Set([...(nt?.fact_ids || []), ...Object.values(byH || {}).flatMap(f => f.fact_ids || [])])];
    const fb = factsBox(n, ids);
    if (fb) box.append(fb);
    return box;
  }

  // ── ① 뉴스 팝업: 그 기사의 주제 한마디 + 그 주제 ETF 예측 ──
  if (typeof card === "function") {
    const base = card;
    card = function (it, inPopup, priority) {
      const box = base(it, inPopup, priority);
      if (!inPopup || !it?.title || !globalThis.ETFX) return box;
      load().then(n => {
        if (!n || n.empty || box.querySelector(".ai-chip")) return;
        for (const id of globalThis.ETFX.themesOf(it)) {
          const pid = n.themeEtf.get(id), c = chip(n, pid, `theme:${id}`);
          if (!c) continue;
          const etfName = pid && [...n.factMap.values()].find(f => f.pid === pid)?.etf, fl = c.querySelector(".ai-fcline");
          if (etfName && fl) fl.append(el("span", "fc-sep", ` (${etfName})`));
          box.append(c);
          if (popup?.getElement()?.contains(box)) popup.setLngLat(popup.getLngLat());
          break;                                           // 한 기사에 하나만
        }
      }).catch(() => {});
      return box;
    };
  }

  // ── ② 시세 탭: 시세 카드(#px-기호)·ETF 칸(#px-ETF-코드)마다 ──
  function attachMarket() {
    const m = document.getElementById("market");
    if (!m || !note || note.empty) return;
    for (const pid of new Set([...note.fc.keys(), ...note.notes.keys()])) {
      const id = pid.startsWith("etf:") ? `px-ETF-${pid.slice(4)}` : pid.startsWith("theme:") || pid.startsWith("re:") ? null : `px-${pid}`;
      const tile = id && document.getElementById(id);
      if (!tile || tile.querySelector(".ai-chip")) continue;
      const c = chip(note, pid);
      if (c) tile.append(c);
    }
  }
  let mo = null, moT = 0;
  (function watchMarket(tries = 0) {
    const m = document.getElementById("market");
    if (!m) { if (tries < 120) setTimeout(() => watchMarket(tries + 1), 500); return; }
    mo = new MutationObserver(() => { clearTimeout(moT); moT = setTimeout(() => load().then(attachMarket), 200); });
    mo.observe(m, { childList: true, subtree: true });
    load().then(attachMarket);
  })();
  subs.add(() => attachMarket());

  globalThis.AINOTE = { load, factLine, factsBox, openUrl, fcLine, fcText, expText, tx, preview(row) { note = index(row); at = Date.now(); for (const f of subs) try { f(note); } catch { /* 무시 */ } }, reload() { note = undefined; } };

  // 🔮 예측 창(forecast.js)
  const s = document.createElement("script");
  s.src = "forecast.js";
  document.head.append(s);

  const css = document.createElement("style");
  css.textContent = `
.ai-chip { margin-top: 6px; padding-top: 5px; border-top: 1px dashed var(--line); display: grid; gap: 2px; font-size: 11.5px; line-height: 1.4; text-align: left; }
.ai-fcline { background: none; border: 0; padding: 0; color: var(--accent); font: inherit; font-weight: 700; text-align: left; cursor: pointer; }
.ai-fcline:hover { text-decoration: underline; }
.ai-fcline .fc-sep { color: var(--muted); font-weight: 400; }
.fc-up { color: var(--up); } .fc-down { color: var(--down); }
.ai-note1 { color: var(--text); }
.ai-facts summary { cursor: pointer; color: var(--muted); font-size: 11px; }
.ai-facts ul { list-style: none; margin: 3px 0 0; padding: 0; display: grid; gap: 2px; }
.ai-facts li { display: flex; gap: 6px; font-size: 11px; color: var(--muted); min-width: 0; }
.ai-fid { flex: none; font-weight: 700; color: var(--text); }
.ai-flink { background: none; border: 0; padding: 0; color: var(--text); text-align: left; font: inherit; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.ai-flink:hover { text-decoration: underline; }`;
  document.head.append(css);
})();
