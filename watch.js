// 관심 소식 모아보기 (2026-11-18 사용자 요청). 옆 칸 뉴스 목록 맨 위 "관심" 줄.
// - 관심 = 이름 + 찾을 말 여러 개(같은 뜻: 반도체, semiconductor, 半导体 …). 자주 쓰는 주제는 같은 뜻 말을 자동으로 더함(SYN).
//   종목 이름이면(stk_items 상위 200) stock-core.js 의 규칙으로도 찾음(Samsung Electronics·하이닉스 같은 다른 이름, 삼성전자서비스 같은 다른 회사는 뺌).
// - 찾는 법: 한글·한자·가나는 제목에 그 글자가 들어 있으면, 영어는 낱말 단위(대소문자 무시, 복수형 s 포함 — 끝에 * 를 붙이면 앞부분만 맞아도).
//   대문자 약자(AI·EV·Fed·BOK)는 대소문자까지 같아야. DART 공시 앞머리 "(유가)"는 빼고 봄(유가 ≠ 유가증권시장). 몇몇 함정 말은 EXCL 로 뺌(유가족·기원전·파인애플).
// - 칩을 누르면 그 관심 소식만 목록에(여러 개 고르기, [★ 관심 전부] = 하나라도 맞는 것). 다른 정렬·분야·지역 줄과 같이 적용. 목록에만(지도는 그대로).
// - 새 소식: 관심마다 마지막으로 눌러 본 뒤 들어온 건수를 칩에 "새 N". 목록 카드에는 "★ 반도체"(새 것은 강조).
// - 저장은 이 브라우저에만(localStorage watchList·watchSel·watchSeen) — 휴대폰과 PC 는 따로.
// list-sort.js 가 이 파일을 불러옴(index.html 수정 없음). renderList()·card() 를 감쌈. 문제가 생기면 예전 목록 그대로.
(function () {
  if (typeof document === "undefined" || typeof renderList !== "function" || typeof card !== "function" || typeof el !== "function") return;

  const TX = {
    ko: { lbl: "관심", off: "전체 뉴스", any: "★ 관심 전부", edit: "✎ 관심 편집", add0: "＋ 관심 추가", close: "닫기", addBtn: "추가", del: "삭제", newN: n => `새 ${n}`, newMark: "새",
      ph: "관심 낱말이나 종목 (예: 반도체, chip, 半导体)", hint: "쉼표로 같은 뜻 말을 이어 쓰면 하나로 묶여요. 영어는 낱말 단위로 찾고, 한글·한자는 글자가 들어 있으면 찾아요. 종목 이름이면 영어 이름·줄임말도 함께 찾아요.",
      sugg: "자주 쓰는 것", none: "아직 관심이 없어요. 아래 칸에 적거나 자주 쓰는 것을 눌러 보세요.", short: "두 글자 이상으로 적어 주세요.", stock: "종목", local: "이 브라우저에만 저장돼요 (휴대폰·PC 따로).", rmWord: w => `"${w}" 빼기` },
    en: { lbl: "Watch", off: "All news", any: "★ All watched", edit: "✎ Edit", add0: "＋ Add a watch", close: "Close", addBtn: "Add", del: "Delete", newN: n => `${n} new`, newMark: "new",
      ph: "Keyword or stock (e.g. 반도체, chip, 半导体)", hint: "Separate words with commas to group synonyms. English matches whole words; Korean/Chinese/Japanese match any title containing the text. Stock names also match their English names and short forms.",
      sugg: "Popular", none: "Nothing watched yet. Type below or tap a popular one.", short: "Use at least two characters.", stock: "stock", local: "Saved in this browser only (phone and PC separately).", rmWord: w => `Remove "${w}"` },
    ja: { lbl: "注目", off: "すべて", any: "★ 注目すべて", edit: "✎ 編集", add0: "＋ 注目を追加", close: "閉じる", addBtn: "追加", del: "削除", newN: n => `新着 ${n}`, newMark: "新",
      ph: "キーワードか銘柄 (例: 반도체, chip, 半导体)", hint: "同じ意味の言葉はカンマで続けると一つにまとまります。英語は単語単位、ハングル・漢字は文字を含めば一致。銘柄名なら英語名・略称も探します。",
      sugg: "よく使うもの", none: "まだ注目がありません。下に入力するか、よく使うものを押してください。", short: "2文字以上で入力してください。", stock: "銘柄", local: "このブラウザにだけ保存されます（スマホとPCは別）。", rmWord: w => `「${w}」を外す` },
  };
  const tx = (k, ...a) => { const v = (TX[LANG] || TX.ko)[k]; return typeof v === "function" ? v(...a) : v; };

  // 자주 쓰는 주제의 같은 뜻 말(한국어·영어·중국어·일본어). 이름(첫 말)으로 고르면 자동으로 더해짐 — 편집 칸에서 하나씩 뺄 수 있음.
  const SYN = {
    "반도체": ["반도체", "HBM", "D램", "낸드", "semiconductor", "chipmaker", "chip", "DRAM", "NAND", "半导体", "芯片", "半導体"],
    "관세": ["관세", "tariff", "关税", "関税"],
    "환율": ["환율", "원/달러", "원·달러", "원달러", "exchange rate", "Korean won", "KRW", "汇率", "為替"],
    "엔화": ["엔화", "엔저", "엔고", "yen", "円安", "円高"],
    "위안화": ["위안화", "yuan", "renminbi", "人民币"],
    "금리": ["금리", "interest rate", "rate cut", "rate hike", "利率", "降息", "加息", "利下げ", "利上げ", "金利"],
    "유가": ["유가", "원유", "oil price", "crude", "OPEC", "油价", "原油"],
    "AI": ["AI", "인공지능", "artificial intelligence", "人工智能"],
    "이차전지": ["이차전지", "2차전지", "배터리", "battery", "batteries", "电池", "電池"],
    "전기차": ["전기차", "EV", "EVs", "electric vehicle", "电动车", "新能源车", "電気自動車"],
    "조선": ["조선업", "조선사", "조선소", "조선주", "조선·", "K-조선", "조선 3사", "조선 빅3", "조선 수주", "shipbuilding", "shipbuilder", "shipyard", "造船"],
    "방산": ["방산", "방위산업", "defense industry", "defence industry", "arms deal", "arms export", "军工", "防衛産業"],
    "원전": ["원전", "원자력", "nuclear power", "nuclear plant", "reactor", "核电", "原発", "原子力"],
    "비트코인": ["비트코인", "가상자산", "암호화폐", "bitcoin", "BTC", "crypto*", "比特币", "加密货币", "ビットコイン", "暗号資産"],
    "금값": ["금값", "금 시세", "금시세", "국제 금", "금 가격", "금 현물", "gold", "黄金", "金価格", "金相場"],
    "부동산": ["부동산", "집값", "아파트값", "아파트 가격", "아파트 매매", "전셋값", "전세가", "주택 가격", "주택시장", "real estate", "home prices", "housing market", "房地产", "楼市", "房价", "不動産"],
    "연준": ["연준", "파월", "Fed", "Federal Reserve", "FOMC", "Powell", "美联储"],
    "한국은행": ["한국은행", "한은", "금통위", "Bank of Korea", "BOK"],
    "수출": ["수출", "export", "出口", "輸出"],
    "물가": ["물가", "인플레이션", "inflation", "CPI", "通胀", "物価"],
    "트럼프": ["트럼프", "Trump", "特朗普", "トランプ"],
    "엔비디아": ["엔비디아", "Nvidia", "英伟达", "エヌビディア"],
    "테슬라": ["테슬라", "Tesla", "特斯拉", "テスラ"],
  };
  const SUGGEST = ["반도체", "관세", "환율", "금리", "유가", "AI", "이차전지", "조선", "방산", "원전", "비트코인", "금값", "부동산", "연준", "삼성전자", "SK하이닉스", "현대차", "엔비디아"];
  // 글자가 들어 있으면 맞는 말의 함정(그 부분을 지우고 봄)
  // (2026-11-18 실제 제목으로 확인: 응원전→원전, 관세사 시험→관세)
  const EXCL = { "유가": /유가족|유가증권/g, "원전": /(기|응|지|복|회|공|정|동|후|병|학|구|초|사|평)원전/g, "애플": /파인애플/g, "전세가": /전세가구/g,
    "금리": /금리단길/g, "한은": /한은행/g, "원유": /원유치|원유니폼/g, "관세": /관세사|관세청|관세국경/g };

  const CJK = /[가-힣぀-ヿ㐀-鿿]/;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const clean = w => String(w || "").replace(/\s+/g, " ").trim();
  const okWord = w => (CJK.test(w) ? w.replace(/\*$/, "").length >= 2 || /[㐀-鿿]/.test(w) : w.replace(/\*$/, "").length >= 2);
  function tester(w) {
    if (CJK.test(w)) {
      const ex = EXCL[w];
      return t => (ex ? t.replace(ex, " ") : t).includes(w);
    }
    const prefix = w.endsWith("*"), core = prefix ? w.slice(0, -1) : w;
    const caps = /^[A-Z0-9&.\-]{1,5}$/.test(core) || core === "Fed";
    const re = new RegExp(`(^|[^A-Za-z0-9])${esc(core)}${prefix ? "" : "(?:s|es|'s|’s)?(?![A-Za-z0-9])"}`, caps ? "" : "i");
    return t => re.test(t);
  }

  // ── 저장 ──
  const load = () => (local.get("watchList", []) || []).filter(w => w && w.name && Array.isArray(w.words)).map(w => ({ name: clean(w.name), words: w.words.map(clean).filter(Boolean) }));
  let list = load();
  let sel = new Set(local.get("watchSel", []) || []);                 // 비어 있음 = 거르지 않음, "*" = 관심 전부
  const seen = local.get("watchSeen", {}) || {};                      // 관심 → 마지막으로 본 시각(ms)
  const mark = { ...seen };                                           // 카드의 "새" 표시용(지금 보는 동안은 본 시각 이전 값)
  const save = () => { local.set("watchList", list); local.set("watchSel", [...sel]); local.set("watchSeen", seen); };
  for (const s of [...sel]) if (s !== "*" && !list.some(w => w.name === s)) sel.delete(s);

  // ── 종목(있으면) ──
  let dict = null;
  (function loadDict(tries = 0) {
    if (!globalThis.STK || typeof db === "undefined") { if (tries < 60) setTimeout(() => loadDict(tries + 1), 1000); return; }
    db.from("stk_items").select("code,name,rank,market").eq("active", true).order("rank").limit(500).then(({ data, error }) => {
      if (error || !data?.length) return;
      try { dict = STK.build(data); version++; compile(); renderList(); } catch (e) { console.warn("watch", e); }
    }, () => {});
  })();
  // 관심 하나의 그 종목 규칙만 모은 작은 판정기(전체 200개 규칙을 기사마다 돌리지 않게)
  function stockOf(w) {
    if (!dict) return null;
    for (const word of w.words) {
      const hit = dict.byName.get(word) || [...dict.byName.values()].find(s => (STK.ALIAS[s.name] || []).some(a => typeof a === "string" && a === word));
      if (hit) return { code: hit.code, name: hit.name, mini: { pats: dict.pats.filter(p => p.it.code === hit.code), byName: new Map([[hit.name, hit]]) } };
    }
    return null;
  }

  // ── 맞추기 ──
  let version = 1, compiled = [];
  function compile() {
    compiled = list.map(w => {
      const stock = stockOf(w);
      const tests = w.words.filter(x => !(stock && x === stock.name)).map(tester);
      return { name: w.name, stock, tests };
    });
  }
  compile();
  const cache = new WeakMap();
  const titleOf = it => String(it.title || "").replace(/^\((유가|코스닥|코넥스|기타)\)\s*/, "");
  function hits(it) {
    const c = cache.get(it);
    if (c && c.v === version) return c.n;
    const t = titleOf(it), n = [];
    for (const w of compiled) {
      let ok = w.tests.some(f => f(t));
      if (!ok && w.stock) { try { ok = STK.match(w.stock.mini, it).length > 0 && STK.match(dict, it).some(h => h.code === w.stock.code); } catch {} }
      if (ok) n.push(w.name);
    }
    cache.set(it, { v: version, n });
    return n;
  }
  const passes = it => { const n = hits(it); return sel.has("*") ? n.length > 0 : n.some(x => sel.has(x)); };

  // ── 줄 + 편집 칸 ──
  const row = el("div", "sortbar sortcats watchrow"), panel = el("div", "watch-edit");
  row.setAttribute("role", "group"); panel.hidden = true;
  const firstBar = document.querySelector("#side .sortbar") || $("list");
  firstBar.before(row, panel);

  function view(names) {   // 칩을 눌러 봄 → 그 관심의 "본 시각"을 지금으로(카드의 새 표시는 이번엔 유지)
    const now = Date.now();
    for (const n of names) { mark[n] = seen[n] || 0; seen[n] = now; }
  }
  function pick(key) {
    if (key === null) sel.clear();
    else if (key === "*") { sel = sel.has("*") ? new Set() : new Set(["*"]); if (sel.size) view(list.map(w => w.name)); }
    else { sel.delete("*"); if (sel.has(key)) sel.delete(key); else { sel.add(key); view([key]); } }
    save(); renderList();
  }
  function chip(label, on, onClick, count, fresh, cls) {
    const b = el("button", [on ? "on" : null, cls].filter(Boolean).join(" ") || null);
    b.type = "button"; b.setAttribute("aria-pressed", String(!!on));
    b.append(label);
    if (count != null) b.append(el("small", null, count.toLocaleString()));
    if (fresh) b.append(el("b", "wnew-n", tx("newN", fresh.toLocaleString())));
    b.addEventListener("click", onClick);
    return b;
  }
  function drawRow(pool) {
    row.setAttribute("aria-label", tx("lbl"));
    const parts = [el("span", "lbl", `★ ${tx("lbl")}:`)];
    if (!list.length) {
      parts.push(chip(tx("add0"), false, () => togglePanel(true), null, 0, "wadd"));
      return row.replaceChildren(...parts);
    }
    const cnt = new Map(), fresh = new Map();
    let anyN = 0, anyNew = 0;
    for (const it of pool) {
      const n = hits(it);
      if (!n.length) continue;
      anyN++;
      let isFresh = false;
      for (const x of n) {
        cnt.set(x, (cnt.get(x) || 0) + 1);
        if (it._c > (seen[x] || 0)) { fresh.set(x, (fresh.get(x) || 0) + 1); isFresh = true; }
      }
      if (isFresh) anyNew++;
    }
    parts.push(chip(tx("off"), !sel.size, () => pick(null)));
    parts.push(chip(tx("any"), sel.has("*"), () => pick("*"), anyN, sel.has("*") ? 0 : anyNew));
    for (const w of list) parts.push(chip(w.name, sel.has(w.name), () => pick(w.name), cnt.get(w.name) || 0, sel.has(w.name) ? 0 : fresh.get(w.name) || 0));
    parts.push(chip(panel.hidden ? tx("edit") : tx("close"), false, () => togglePanel(panel.hidden), null, 0, "wadd"));
    row.replaceChildren(...parts);
  }

  let panelLang = null;
  function togglePanel(open) {
    panel.hidden = !open;
    if (open) { drawPanel(); panel.querySelector("input")?.focus(); }
    renderList();
  }
  function addWatch(text) {
    const words = String(text).split(/[,，、]/).map(clean).filter(Boolean);
    if (!words.length) return "";
    if (!words.every(okWord)) return tx("short");
    const name = words[0];
    const all = words.flatMap(w => SYN[w] || [w]);   // 자주 쓰는 주제는 그 목록으로(이름 자체가 함정일 수 있음: "조선" → 유조선·조선왕실)
    const old = list.find(w => w.name === name);
    if (old) old.words = [...new Set([...old.words, ...all])];
    else { list.push({ name, words: [...new Set(all)] }); seen[name] = Date.now(); mark[name] = seen[name]; }
    version++; compile(); save();
    return "";
  }
  function drawPanel() {
    panelLang = LANG;
    const form = el("form", "watch-form");
    const input = form.appendChild(el("input"));
    input.type = "text"; input.placeholder = tx("ph"); input.setAttribute("aria-label", tx("ph")); input.maxLength = 200;
    const btn = form.appendChild(el("button", null, tx("addBtn"))); btn.type = "submit";
    const msg = el("div", "watch-msg");
    form.addEventListener("submit", e => {
      e.preventDefault();
      const err = addWatch(input.value);
      if (err) { msg.textContent = err; return; }
      drawPanel(); renderList(); panel.querySelector("input")?.focus();
    });
    const sug = el("div", "watch-sugg");
    const left = SUGGEST.filter(s => !list.some(w => w.name === s));
    if (left.length) {
      sug.append(el("span", "lbl", `${tx("sugg")}:`));
      for (const s of left) {
        const b = sug.appendChild(el("button", null, `＋ ${s}`)); b.type = "button";
        b.addEventListener("click", () => { addWatch(s); drawPanel(); renderList(); });
      }
    }
    const rows = list.length ? list.map((w, i) => {
      const r = el("div", "watch-item");
      const head = r.appendChild(el("div", "watch-head"));
      head.append(el("b", null, w.name));
      const st = compiled[i]?.stock;
      if (st) head.append(el("span", "watch-stock", `📈 ${tx("stock")} ${st.name}`));
      const del = head.appendChild(el("button", "watch-del", tx("del"))); del.type = "button";
      del.addEventListener("click", () => {
        list = list.filter(x => x !== w); sel.delete(w.name); delete seen[w.name];
        version++; compile(); save(); drawPanel(); renderList();
      });
      const ws = r.appendChild(el("div", "watch-words"));
      for (const word of w.words) {
        const b = ws.appendChild(el("button", null, `${word} ✕`)); b.type = "button";
        b.title = tx("rmWord", word); b.setAttribute("aria-label", tx("rmWord", word));
        b.addEventListener("click", () => {
          w.words = w.words.filter(x => x !== word);
          if (!w.words.length) { list = list.filter(x => x !== w); sel.delete(w.name); }
          version++; compile(); save(); drawPanel(); renderList();
        });
      }
      return r;
    }) : [el("div", "watch-none", tx("none"))];
    panel.replaceChildren(...rows, form, msg, sug, el("div", "watch-note", `${tx("hint")} ${tx("local")}`));
  }

  // ── 목록 감싸기 ──
  const base = renderList;
  renderList = function (all0 = filtered()) {
    try {
      if (!panel.hidden && panelLang !== LANG && !panel.contains(document.activeElement)) drawPanel();
      const ok0 = new Set(all0), pool = pinned ? pinned.filter(it => ok0.has(it)) : all0.filter(it => inRegion(it, region));
      drawRow(pool);
      if (!sel.size || !list.length) return base(all0);
      return base(all0.filter(passes));
    } catch (e) { console.warn("watch", e); return base(all0); }
  };

  // ── 카드에 "★ 관심" 표시 ──
  const baseCard = card;
  card = function (it, inPopup, priority) {
    const box = baseCard(it, inPopup, priority);
    try {
      const n = list.length && it?.title ? hits(it) : [];
      if (n.length) {
        const fresh = n.some(x => it._c > (mark[x] || 0));
        const c = el("span", `chip watch${fresh ? " fresh" : ""}`, `★ ${n.slice(0, 2).join("·")}${n.length > 2 ? ` +${n.length - 2}` : ""}${fresh ? ` · ${tx("newMark")}` : ""}`);
        box.querySelector(".meta")?.append(c);
      }
    } catch (e) { console.warn("watch", e); }
    return box;
  };

  const css = document.createElement("style");
  css.textContent = `
.sortbar.watchrow { padding-top: 8px; }
.sortbar.watchrow .lbl { color: var(--accent); font-weight: 700; }
@media (max-width: 767px) { .sortbar.watchrow { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; } .sortbar.watchrow > * { flex: none; } }
.sortbar.watchrow button.wadd { border-style: dashed; color: var(--muted); }
.sortbar .wnew-n { margin-left: 4px; background: #f59e0b; color: #111827; border-radius: 999px; padding: 0 6px; font-size: 10.5px; font-weight: 800; }
.watch-edit { padding: 10px 14px 12px; border-bottom: 1px solid var(--line); background: var(--panel-2); display: grid; gap: 8px; font-size: 13px; }
.watch-edit[hidden] { display: none; }
.watch-item { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; background: var(--bg); }
.watch-head { display: flex; align-items: center; gap: 8px; }
.watch-head b { font-size: 14px; }
.watch-stock { font-size: 11.5px; color: var(--muted); }
.watch-del { margin-left: auto; background: none; border: 1px solid var(--line); border-radius: 6px; color: var(--muted); padding: 2px 8px; font-size: 12px; cursor: pointer; }
.watch-words { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.watch-words button, .watch-sugg button { background: var(--panel); border: 1px solid var(--line); border-radius: 999px; padding: 2px 9px; font-size: 12px; color: var(--text); cursor: pointer; }
.watch-sugg { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.watch-sugg .lbl { font-size: 12px; color: var(--muted); margin-right: 2px; }
.watch-form { display: flex; gap: 6px; }
.watch-form input { flex: 1; min-width: 0; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; color: var(--text); font-size: 14px; }
.watch-form button { background: var(--accent); color: #0b0f17; border: 0; border-radius: 8px; padding: 0 14px; font-weight: 700; cursor: pointer; }
.watch-msg:empty { display: none; }
.watch-msg { color: #f59e0b; font-size: 12px; }
.watch-none, .watch-note { color: var(--muted); font-size: 12px; line-height: 1.5; }
.card .chip.watch { border: 1px solid var(--accent); color: var(--accent); background: transparent; font-weight: 700; }
.card .chip.watch.fresh { background: #f59e0b; border-color: #f59e0b; color: #111827; }`;
  document.head.append(css);
  renderList();
})();
