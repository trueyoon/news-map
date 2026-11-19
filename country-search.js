// 나라 검색 (사용자 요청 2026-11-19): 검색창에 나라 이름을 치면 ① 지구본이 그 나라로 날아가고 ② 그 나라 관련 기사가 목록에 쭉 나옴.
//   "베트남" "Vietnam" "ベトナム" "미국" "UAE" … 나라 이름·별칭(한·영·일, 202개 나라 — country-data.js, 수집기 사전 gazetteer.js 복사본)
//   "베트남 공항"처럼 나라 이름 뒤에 낱말을 더 치면 그 나라 기사 중 그 낱말이 든 것만.
// 관련 기사 = ① 기사 장소(news.country)가 그 나라 + ② 제목(또는 화면 언어 번역)에 그 나라 이름이 나온 기사(예: 한국에서 쓴 "삼양식품 베트남 공장").
//   한국어 이름이 흔한 낱말과 겹치는 나라(이란·인도·가나·수단·오만…)는 앞에 다른 글자가 붙지 않고 뒤가 조사·띄어쓰기일 때만("인도적"·"인도네시아"·"…이란" 막기).
//   영어 이름이 흔한 낱말인 나라(Georgia·Jordan·Chad…)는 영어 이름만으로는 제목 언급으로 안 셈(별칭·장소로만).
// 나라를 찾으면: 지역 탭은 잠시 "전 세계"로(지도는 안 움직이고 목록만), 관심·분야 필터는 그대로 함께 적용, 목록 위에 "📍 베트남 관련 소식 N건" 줄 + 끄기 버튼.
// 지역 탭을 누르거나 검색창을 비우면 끝남(원래 지역 탭으로). Enter 를 다시 누르면 지도를 다시 그 나라로.
// index.html 수정 없음 — list-sort.js 가 이 파일을 불러옴. filtered()·render() 를 감쌈(watch.js·quiet.js 와 같은 방식).
// 옛 아이폰(사파리 16.3 이하)에서 파일 전체가 멈추지 않게 정규식에 뒤보기((?<= (?<!)를 쓰지 않음.
(function () {
  if (typeof filtered !== "function" || typeof render !== "function" || !$("q")) return;
  const s = document.createElement("script");
  s.src = "country-data.js";
  s.onload = () => { try { init(globalThis.COUNTRY_DATA || []); } catch (e) { console.warn("country-search", e); } };
  document.head.append(s);

  function init(DATA) {
    if (!DATA.length) return;
    const TX = {
      ko: { bar: (n, all, p, m) => `📍 ${n} 관련 소식 ${all}건 · 그 나라에서 ${p} · 제목에 언급 ${m}`, off: "✕ 나라 검색 끄기", fly: "지도를 다시 이 나라로" },
      en: { bar: (n, all, p, m) => `📍 ${n}: ${all} stories · located there ${p} · mentioned ${m}`, off: "✕ Clear country", fly: "Fly the map to this country again" },
      ja: { bar: (n, all, p, m) => `📍 ${n} 関連 ${all}件・現地 ${p}・見出しで言及 ${m}`, off: "✕ 国の検索を解除", fly: "地図をこの国へ" },
    };
    const tx = () => TX[LANG] || TX.ko;
    const norm = v => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
    const esc = v => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // 검색창 낱말 → 나라 (이름·별칭 모두, 소문자)
    const byName = new Map();
    for (const c of DATA) for (const n of [c.en, c.ko, c.ja, ...(c.a || []), ...(c.ak || []), ...(c.aj || []), ...(c.ac || [])]) {
      const k = norm(n);
      if (k && !byName.has(k)) byName.set(k, c);
    }
    const names = [...byName.keys()].sort((a, b) => b.length - a.length);   // 긴 이름 먼저("남수단" > "수단", "인도네시아" > "인도")
    function parseQuery(v) {
      const q = norm(v);
      if (!q) return null;
      for (const k of names) if (q === k || q.startsWith(k + " ")) return { c: byName.get(k), rest: q.slice(k.length).trim() };
      return null;
    }

    // 기사 장소(news.country) 글자 → 나라 코드. GDELT 는 "Vietnam, Democratic Republic of" 처럼 쓰기도 함
    const EXTRA = { czechoslovakia: "CZ", "dr congo": "CD", "democratic republic of the congo": "CD", "korea, south": "KR", "korea, north": "KP", burma: "MM",
      "bosnia-herzegovina": "BA", "cote divoire": "CI", macedonia: "MK", "west bank": "PS", "gaza strip": "PS" };
    const isoCache = new Map();
    function isoOf(country) {
      if (!country) return null;
      if (isoCache.has(country)) return isoCache.get(country);
      const k = norm(country);
      let c = EXTRA[k] || null;
      if (!c) { const hit = DATA.find(d => norm(d.en) === k || (d.a || []).includes(k)); if (hit) c = hit.i; }
      if (!c && k.includes(",")) { const head = k.split(",")[0].trim(); const hit = DATA.find(d => norm(d.en) === head || (d.a || []).includes(head)); if (hit) c = hit.i; }
      isoCache.set(country, c);
      return c;
    }

    // 제목에 그 나라가 나오는지
    const KO_NEXT = /^(?:은|는|이|가|을|를|의|에|와|과|도|로|으로|서|산|측|계|발|행|인|정부|대통령|총리|경제|증시|시장|중앙은행|외교|대사|군|내|전역|현지|정상|당국|국민)/;
    const KATA = /^[ァ-ヺー]+$/;
    function matcher(c) {
      const en = [...(c.amb ? [] : [c.en]), ...(c.a || [])].filter(Boolean);
      const reEn = en.length ? new RegExp(`\\b(?:${en.map(esc).join("|")})\\b`, "i") : null;
      const reCs = c.ac?.length ? new RegExp(`\\b(?:${c.ac.map(esc).join("|")})\\b`) : null;
      const ko = [c.ko, ...(c.ak || [])].filter(Boolean);
      const ja = [c.ja, ...(c.aj || [])].filter(Boolean);
      const koHit = text => ko.some(term => {
        for (let i = text.indexOf(term); i >= 0; i = text.indexOf(term, i + term.length)) {
          if (!(c.ambk && term === c.ko)) return true;
          const prev = text[i - 1] || "", next = text.slice(i + term.length);
          if (!/[가-힣]/.test(prev) && (!/^[가-힣]/.test(next) || KO_NEXT.test(next))) return true;
        }
        return false;
      });
      const jaHit = text => ja.some(term => {
        if (!KATA.test(term)) return text.includes(term);
        for (let i = text.indexOf(term); i >= 0; i = text.indexOf(term, i + term.length)) {
          if (!/[ァ-ヺー]/.test(text[i - 1] || "") && !/[ァ-ヺー]/.test(text[i + term.length] || "")) return true;
        }
        return false;
      });
      // 한국을 찾을 땐 "North Korea" 속 "Korea"는 안 셈
      const pre = c.i === "KR" ? t => t.replace(/north korean?|n\. ?korea/gi, " ") : t => t;
      return text => { const t = pre(text); return (reEn && reEn.test(t)) || (reCs && reCs.test(t)) || koHit(t) || jaHit(t); };
    }

    let sel = null, mention = null, rest = "", prevRegion = null, flewFor = null;
    const why = new Map();   // 기사 → "p"(장소) / "m"(제목 언급) — 나라를 바꾸면 비움
    // 제목 끝의 언론사 이름(" - The Ghanaian Chronicle", " | Korea.net")은 언급으로 안 셈
    const bare = t => String(t || "").replace(/\s+[-|–—]\s+[^-|–—]{2,45}$/, "");
    const textOf = it => `${bare(it.title)} ${bare(good.get(`${LANG}|${it.title}`) || trCache.get(`${LANG}|${it.title}`) || "")}`;
    function about(it) {
      let w = why.get(it);
      if (w === undefined) { w = isoOf(it.country) === sel.i ? "p" : mention(textOf(it)) ? "m" : ""; why.set(it, w); }
      if (!w) return false;
      return !rest || `${textOf(it)} ${it.location_name || ""} ${it.source_name || ""}`.toLowerCase().includes(rest);
    }

    // 검색 줄 고르기: 나라 모드면 원래 검색 글자는 비운 채(관심·분야 필터만) 거른 뒤 그 나라 기사만
    const baseFiltered = filtered;
    let lastShown = [];
    filtered = function (...a) {
      if (!sel) return baseFiltered.apply(this, a);
      const q = $("q"), v = q.value, s0 = q.selectionStart, s1 = q.selectionEnd, focused = document.activeElement === q;
      q.value = "";
      let out;
      try { out = baseFiltered.apply(this, a); } finally { q.value = v; if (focused) try { q.setSelectionRange(s0, s1); } catch { /* 일부 입력칸은 못 함 */ } }
      return (lastShown = out.filter(about));
    };

    // 지구본 이동: 그 나라에 찍힌 기사 위치의 5~95% 범위(+ 수도) — 기사가 적으면 수도로
    function fly(c) {
      if (!map) return;
      const pts = items.filter(it => hasCoords(it) && isoOf(it.country) === c.i).map(it => [it.longitude, it.latitude]);
      if (pts.length >= 5) {
        const q = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.round((arr.length - 1) * p)))];
        const xs = pts.map(p => p[0]).concat(c.lon).sort((a, b) => a - b), ys = pts.map(p => p[1]).concat(c.lat).sort((a, b) => a - b);
        let w = q(xs, 0.05), e = q(xs, 0.95), s2 = q(ys, 0.05), n = q(ys, 0.95);
        if (e - w < 2) { w -= 1; e += 1; }
        if (n - s2 < 2) { s2 -= 1; n += 1; }
        map.fitBounds([[w, s2], [e, n]], { padding: isPhone() ? 30 : 70, maxZoom: 6, duration: 1800, essential: true });
      } else map.flyTo({ center: [c.lon, c.lat], zoom: 4.5, duration: 1800, essential: true });
      flewFor = c.i;
    }

    // 목록 위 안내 줄
    const bar = document.createElement("div");
    bar.className = "cs-bar";
    bar.hidden = true;
    const label = document.createElement("button");
    label.type = "button"; label.className = "cs-label";
    label.addEventListener("click", () => sel && fly(sel));
    const off = document.createElement("button");
    off.type = "button"; off.className = "cs-off";
    off.addEventListener("click", () => { const q = $("q"); q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true })); });
    bar.append(label, off);
    $("list").before(bar);
    function drawBar() {
      bar.hidden = !sel;
      if (!sel) return;
      const p = lastShown.filter(it => why.get(it) === "p").length;
      label.textContent = tx().bar(sel[LANG] || sel.en, lastShown.length.toLocaleString(), p.toLocaleString(), (lastShown.length - p).toLocaleString()) + (rest ? ` · "${rest}"` : "");
      label.title = tx().fly;
      off.textContent = tx().off;
    }
    const baseRender = render;
    render = function (...a) { const r = baseRender.apply(this, a); drawBar(); return r; };

    function check() {
      const hit = parseQuery($("q").value);
      if (hit) {
        const changed = !sel || sel.i !== hit.c.i;
        rest = hit.rest;
        if (changed) {
          sel = hit.c; mention = matcher(sel); why.clear();
          if (prevRegion === null) { prevRegion = region; region = "world"; }   // 목록이 지역 탭에 막히지 않게(지도는 안 움직임)
          pinned = null;
          fly(sel);
        }
      } else if (sel) {
        sel = null; rest = ""; why.clear(); flewFor = null;
        if (prevRegion !== null) { region = prevRegion; prevRegion = null; }
        drawBar();
      }
    }
    const q = $("q");
    q.addEventListener("input", check);
    q.addEventListener("keydown", e => { if (e.key === "Enter") { check(); if (sel) { fly(sel); render(); } } });
    // 지역 탭을 누르면 나라 검색을 끝냄(그 지역 보기로)
    $("regions").addEventListener("click", e => {
      if (!sel || !e.target.closest("button")) return;
      prevRegion = null;           // goRegion 이 고른 지역을 그대로 둠
      q.value = "";
      sel = null; rest = ""; why.clear(); flewFor = null; drawBar();
    }, true);
    // 번역이 늦게 도착하면(제목 언급 판정이 바뀔 수 있어) 다음 그리기 때 다시 봄
    setInterval(() => { if (sel) why.clear(); }, 60e3);

    // 이름 고르기 목록(입력하면 브라우저가 맞는 나라 이름을 보여 줌)
    const dl = document.createElement("datalist");
    dl.id = "csNames";
    const seen = new Set();
    for (const c of DATA) for (const n of [c.ko, c.en, c.ja]) if (n && !seen.has(n)) { seen.add(n); const o = document.createElement("option"); o.value = n; dl.append(o); }
    document.body.append(dl);
    q.setAttribute("list", "csNames");

    const css = document.createElement("style");
    css.textContent = `.cs-bar { display: flex; align-items: center; gap: 8px; padding: 7px 12px; background: var(--panel-2); border-bottom: 1px solid var(--line); font-size: 12.5px; }
.cs-bar .cs-label { flex: 1; min-width: 0; text-align: left; background: none; border: 0; padding: 0; color: var(--accent); font: inherit; font-weight: 700; cursor: pointer; }
.cs-bar .cs-off { flex: none; background: none; border: 1px solid var(--line); border-radius: 6px; padding: 3px 8px; color: var(--muted); font: inherit; font-size: 11.5px; cursor: pointer; }
.cs-bar .cs-off:hover { color: inherit; }`;
    document.head.append(css);

    globalThis.CSEARCH = { parseQuery, isoOf, matcher };   // 시험용
    check();
    if (sel) render();
  }
})();
