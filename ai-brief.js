// AI 해설 (2026-11-20 사용자 요청 — 최종 목표: 세계정세 → 투자 상품·부동산까지 이어서 추론)
// - 서버 함수 ai-brief 가 매일 아침(07:25 KST) Claude 에게 우리 기록의 숫자(재료)만 주고 "사건 → 상품" 해설을 받아 검사한 뒤 표 ai_notes 에 저장.
//   이 파일은 그 최신 한 줄을 읽어 "☀ 요약" 창(brief.js) 맨 위에 "🤖 AI 해설 (참고용)"으로 붙이기만 함 (Claude 를 부르지 않음 → 화면을 열어도 비용 0).
// - 해설 한 줄마다 근거 재료(번호)를 펼쳐 볼 수 있음. 소식 근거는 누르면 그 기사 팝업.
// - brief.js·index.html 은 고치지 않음: #brief 칸이 다시 그려질 때(MutationObserver) 머리글 바로 아래에 끼워 넣음. list-sort.js 가 이 파일을 불러옴.
// - 표가 없거나 못 읽으면 아무것도 안 붙임. ⚠️ 화면 파일: 정규식에 (?<= (?<! 금지(옛 아이폰).
(() => {
  if (typeof db === "undefined" || typeof el !== "function") return;
  const H = 3600e3;
  const TX = {
    ko: { head: "AI 해설 (참고용)", none: "아직 AI 해설이 없어요. 매일 아침 7시 반쯤 만들어져요.", old: d => `${d}일 전 해설`,
      eff: { up_pressure: "▲ 오를 압력", down_pressure: "▼ 내릴 압력", mixed: "↕ 엇갈림", watch: "👀 지켜볼 것" },
      conf: { low: "확신 낮음", medium: "확신 보통", high: "확신 높음" }, counter: "반대로 되면", facts: n => `근거 ${n}개`, watch: "다음에 볼 것",
      note: "AI(Claude)가 이 사이트의 기록 숫자만 써서 쓴 해설이에요. 틀릴 수 있고, 사라·팔라는 뜻이 아니에요. 재료에 없는 숫자나 근거 없는 줄은 자동으로 뺐어요.",
      dropped: n => `검사에서 뺀 줄 ${n}개`, cost: c => `비용 약 $${c}`, kinds: { P: "시세", N: "큰 소식", E: "뉴스 주제 → ETF", D: "공시", R: "부동산" } },
    en: { head: "AI commentary (for reference)", none: "No AI commentary yet. It is written every morning around 7:25 KST.", old: d => `${d} day(s) old`,
      eff: { up_pressure: "▲ upward pressure", down_pressure: "▼ downward pressure", mixed: "↕ mixed", watch: "👀 watch" },
      conf: { low: "low confidence", medium: "medium confidence", high: "high confidence" }, counter: "If it goes the other way", facts: n => `${n} source fact(s)`, watch: "Check next",
      note: "Written by AI (Claude) using only this site's recorded numbers (in Korean). It can be wrong and is not a recommendation. Lines without sources or with numbers not in the data were removed automatically.",
      dropped: n => `${n} line(s) removed by checks`, cost: c => `cost ≈ $${c}`, kinds: { P: "Price", N: "Top story", E: "News theme → ETF", D: "Filing", R: "Real estate" } },
    ja: { head: "AI解説（参考）", none: "AI解説はまだありません。毎朝7時半ごろ作られます。", old: d => `${d}日前の解説`,
      eff: { up_pressure: "▲ 上昇圧力", down_pressure: "▼ 下落圧力", mixed: "↕ まちまち", watch: "👀 注視" },
      conf: { low: "確度 低", medium: "確度 中", high: "確度 高" }, counter: "逆になる場合", facts: n => `根拠${n}件`, watch: "次に見ること",
      note: "AI（Claude）が当サイトの記録の数字だけで書いた解説です（韓国語）。誤りがあり得て、売買の勧めではありません。根拠のない行やデータにない数字の行は自動で除きました。",
      dropped: n => `検査で除いた行 ${n}件`, cost: c => `費用 約$${c}`, kinds: { P: "相場", N: "大きなニュース", E: "ニューステーマ→ETF", D: "開示", R: "不動産" } },
  };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];
  const kstDay = t => new Date(t + 9 * H).toISOString().slice(0, 10);

  // 최신 해설 한 줄(1시간마다 다시). 표가 없으면 null(아무것도 안 붙임), 줄이 없으면 { empty: true }
  let note = undefined, at = 0, loading = null;
  function load() {
    if (note !== undefined && Date.now() - at < H) return Promise.resolve(note);
    return loading || (loading = (async () => {
      try {
        const { data, error } = await db.from("ai_notes").select("day,slot,created_at,model,note,facts,dropped,cost_usd")
          .not("note", "is", null).order("day", { ascending: false }).order("created_at", { ascending: false }).limit(1);
        note = error ? null : data?.length ? data[0] : { empty: true };
        at = Date.now();
      } catch { note = null; at = Date.now() - H + 5 * 60e3; }   // 실패하면 5분 뒤 다시
      finally { loading = null; }
      return note;
    })());
  }

  // 재료 한 줄 요약
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
    if (it && typeof openItem === "function") { document.getElementById("brief")?.querySelector(".rf-x")?.click(); showTab("news"); openItem(it, true); }
    else window.open(u, "_blank", "noopener,noreferrer");
  }

  function section(n) {
    const s = el("section", "br-sec ai-sec");
    const h = s.appendChild(el("h4", null, `🤖 ${tx("head")}`));
    if (!n || n.empty) { s.append(el("p", "empty", tx("none"))); return s; }
    const ago = Math.round((Date.parse(`${kstDay(Date.now())}T00:00:00Z`) - Date.parse(`${n.day}T00:00:00Z`)) / (24 * H));
    const meta = new Intl.DateTimeFormat(undefined, { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(Date.parse(n.created_at));
    h.append(el("small", "ai-meta", ` ${meta}${ago >= 1 ? ` · ${tx("old")(ago)}` : ""}`));
    const N = n.note || {}, facts = new Map((n.facts || []).map(f => [f.id, f]));
    if (N.headline) s.append(el("p", "ai-headline", N.headline));
    const ol = s.appendChild(el("ol", "ai-links"));
    for (const l of N.links || []) {
      const li = ol.appendChild(el("li"));
      const top = li.appendChild(el("div", "ai-ev"));
      top.append(el("b", null, l.event));
      if (l.confidence) top.append(el("span", `ai-conf ${l.confidence}`, tx("conf")[l.confidence] || l.confidence));
      const ps = li.appendChild(el("div", "ai-prods"));
      for (const p of l.products || []) ps.append(el("span", `ai-prod ${p.effect}`, `${p.name} · ${tx("eff")[p.effect] || p.effect}`));
      if (l.path) li.append(el("p", "ai-path", l.path));
      if (l.counter) li.append(el("p", "ai-counter", `↩ ${tx("counter")}: ${l.counter}`));
      const ids = (l.fact_ids || []).filter(id => facts.has(id));
      if (ids.length) {
        const d = li.appendChild(el("details", "ai-facts"));
        d.append(el("summary", null, tx("facts")(ids.length)));
        const ul = d.appendChild(el("ul"));
        for (const id of ids) {
          const f = facts.get(id), row = ul.appendChild(el("li"));
          row.append(el("span", "ai-fid", `${id} ${tx("kinds")[id[0]] || ""}`));
          const u = f.url || f.headlines?.[0]?.url;
          if (u) { const b = row.appendChild(el("button", "ai-flink", factLine(f))); b.type = "button"; b.addEventListener("click", () => openUrl(u)); }
          else row.append(el("span", null, factLine(f)));
        }
      }
    }
    if (N.watch?.length) {
      s.append(el("div", "ai-sub", `👀 ${tx("watch")}`));
      const ul = s.appendChild(el("ul", "ai-watch"));
      for (const w of N.watch) ul.append(el("li", null, w));
    }
    const foot = [N.caveat, tx("note"), n.dropped?.length ? tx("dropped")(n.dropped.length) : null, n.cost_usd != null ? tx("cost")(Number(n.cost_usd).toFixed(2)) : null, n.model].filter(Boolean);
    s.append(el("p", "ai-note", foot.join(" · ")));
    return s;
  }

  // #brief 칸이 다시 그려질 때마다 머리글 아래에 끼워 넣음
  let token = 0;
  function attach(pop) {
    if (pop.hidden || pop.querySelector(".ai-sec") || !pop.querySelector(".rf-head")) return;
    const my = ++token;
    load().then(n => {
      if (n === null || my !== token || pop.hidden || pop.querySelector(".ai-sec")) return;
      const head = pop.querySelector(".rf-head");
      if (!head) return;
      try { head.after(section(n)); } catch (e) { console.warn("ai-brief", e); }
    });
  }
  // 시험용(화면 모양 확인): AIBRIEF.preview(가짜 줄) 후 ☀ 요약을 다시 열면 그 줄로 그림
  globalThis.AIBRIEF = { preview(n) { note = n; at = Date.now(); }, reload() { note = undefined; } };
  (function wait(tries = 0) {
    const pop = document.getElementById("brief");
    if (!pop) { if (tries < 120) setTimeout(() => wait(tries + 1), 500); return; }
    new MutationObserver(() => attach(pop)).observe(pop, { childList: true, attributes: true, attributeFilter: ["hidden"] });
    attach(pop);
  })();

  const css = document.createElement("style");
  css.textContent = `
.ai-sec h4 .ai-meta { font-weight: 400; color: var(--muted); font-size: 11px; }
.ai-headline { margin: 0 0 6px; font-size: 13.5px; font-weight: 700; line-height: 1.45; }
.ai-links { margin: 0; padding-left: 18px; display: grid; gap: 8px; }
.ai-links > li { font-size: 12.5px; line-height: 1.45; }
.ai-ev { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
.ai-ev b { font-size: 13px; }
.ai-conf { font-size: 10.5px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 0 6px; }
.ai-prods { display: flex; gap: 4px; flex-wrap: wrap; margin: 3px 0; }
.ai-prod { font-size: 11.5px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; }
.ai-path, .ai-counter { margin: 2px 0; }
.ai-counter { color: var(--muted); }
.ai-facts summary { cursor: pointer; color: var(--accent); font-size: 11.5px; }
.ai-facts ul { list-style: none; margin: 3px 0 0; padding: 0; display: grid; gap: 2px; }
.ai-facts li { display: flex; gap: 6px; font-size: 11.5px; color: var(--muted); min-width: 0; }
.ai-fid { flex: none; font-weight: 700; color: var(--text); }
.ai-flink { background: none; border: 0; padding: 0; color: var(--text); text-align: left; font: inherit; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.ai-flink:hover { text-decoration: underline; }
.ai-sub { margin-top: 8px; font-size: 12px; font-weight: 700; }
.ai-watch { margin: 2px 0 0; padding-left: 18px; font-size: 12.5px; }
.ai-note { margin: 8px 0 0; font-size: 10.5px; color: var(--muted); line-height: 1.4; }`;
  document.head.append(css);
})();
