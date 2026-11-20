// 어두운 화면 / 밝은 화면 버튼 (2026-11-20 사용자 요청). 처음부터 어두운 화면(짙은 남색 바탕 + 밝은 글씨)이 기본이고, 이 버튼으로 밝은 화면으로 바꿀 수 있음.
// - 위쪽 [부동산] 옆 버튼 "☀ 밝게" / "🌙 어둡게". 고른 것은 브라우저에 기억(theme) — 다음에 열어도 그대로.
// - 색은 index.html 의 색 이름표(--bg·--panel·--text…)를 밝은 값으로 덮어씀 + 고정 색으로 칠한 몇 곳(시세 띠·속보 띠·안내 줄·범례·지도 버튼)만 따로.
// - index.html 수정 없음(list-sort.js 가 이 파일을 불러옴). 부동산 페이지(real-estate.html)는 아직 어두운 화면 그대로.
(() => {
  const KEY = "theme";
  const get = () => { try { return localStorage.getItem(KEY) === "light" ? "light" : "dark"; } catch { return "dark"; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch { /* 저장 안 돼도 이번엔 바뀜 */ } };
  const TX = { ko: { light: "☀ 밝게", dark: "🌙 어둡게", tl: "밝은 화면으로 바꾸기", td: "어두운 화면으로 바꾸기" },
    en: { light: "☀ Light", dark: "🌙 Dark", tl: "Switch to light theme", td: "Switch to dark theme" },
    ja: { light: "☀ 明るく", dark: "🌙 暗く", tl: "明るい画面にする", td: "暗い画面にする" } };
  const tx = k => (TX[typeof LANG === "string" ? LANG : "ko"] || TX.ko)[k];

  function apply(v) {
    document.documentElement.dataset.theme = v;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", v === "light" ? "#f5f7fb" : "#0b0f17");
    label();
  }
  const btn = document.createElement("button");
  btn.type = "button"; btn.id = "themeBtn";
  function label() {
    const light = document.documentElement.dataset.theme === "light";
    btn.textContent = light ? tx("dark") : tx("light");
    btn.title = light ? tx("td") : tx("tl");
    btn.setAttribute("aria-pressed", String(light));
  }
  btn.addEventListener("click", () => { const v = document.documentElement.dataset.theme === "light" ? "dark" : "light"; set(v); apply(v); });
  (document.getElementById("logout") || document.querySelector("header")?.lastElementChild)?.before(btn);
  // 언어를 바꾸면 버튼 글자도(언어 버튼 누른 뒤)
  document.addEventListener("click", e => { if (e.target.closest?.(".langs button")) setTimeout(label, 0); });

  const css = document.createElement("style");
  css.textContent = `
html[data-theme="light"] {
  --bg: #f5f7fb; --panel: #ffffff; --panel-2: #f0f3f8; --line: #d5dbe5;
  --text: #0f172a; --muted: #586274; --accent: #6366f1; --danger: #dc2626;
  --up: #dc2626; --down: #2563eb; color-scheme: light;
}
html[data-theme="light"][lang="en"] { --up: #15803d; --down: #dc2626; }
html[data-theme="light"] #ticker, html[data-theme="light"] #mstrip { background: var(--panel-2); }
html[data-theme="light"] #notice { background: #eef2ff; color: #312e81; }
html[data-theme="light"] .maplibregl-ctrl-attrib { background: rgba(255,255,255,.8) !important; }
html[data-theme="light"] .legend, html[data-theme="light"] .dz-ctrl { background: rgba(255,255,255,.94); }
html[data-theme="light"] .maplibregl-popup-content { box-shadow: 0 6px 24px rgba(15,23,42,.18); }
html[data-theme="light"] .rf-pop { box-shadow: 0 12px 32px rgba(15,23,42,.18); }
#themeBtn { white-space: nowrap; }`;
  document.head.append(css);
  apply(get());
})();
