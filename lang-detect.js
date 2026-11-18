// 제목 언어 알아보기 넓히기 (2026-11-18, 각국 현지어 경제 기사 — 수집기 GDELT 번역판 "B: 아시아+주요국")
// index.html 의 srcLang() 은 한국어·일본어·중국어만 가리고 나머지는 모두 영어("en")로 봄 → 베트남어·태국어·독일어 제목을 영어로 번역하려다 실패.
// 그래서 srcLang 을 감싸서, 원래 답이 "en" 일 때만 글자·자주 쓰는 낱말로 다시 봄:
//   글자로 확실한 것: 태국 문자 th · 아랍 문자 ar · 베트남어 성조 글자 vi · 터키어 ı ğ ş tr · 폴란드어 ł ą ę ś ź ż ń pl
//   나머지(de·fr·es·pt·it·id)는 자주 쓰는 낱말·글자 점수 — 2점 이상이고 영어 점수보다 높을 때만(애매하면 원래대로 "en").
// globalThis.LANGX = { detect(제목) → 언어 코드, foreign(제목) → 새로 넣은 언어(반영 탭 계산에서 뺄 것)인지 }
// list-sort.js 가 이 파일을 불러옴(index.html 수정 없음). Node 로도 시험할 수 있게 srcLang 이 없으면 LANGX 만 만듦.
(function (g) {
  if (g.LANGX) return;
  const NEW = new Set(["vi", "th", "ar", "tr", "pl", "de", "fr", "es", "pt", "it", "id"]);   // 수집기 번역판에서 새로 들어오는 언어(중국어·일본어는 예전부터)
  const W = s => new Set(s.split(" "));
  const WORDS = {
    en: W("the of and to in for on with is at by from as an be this that are will after over new its has have was says"),
    de: W("der die das und mit für von zu im ist auf nicht ein eine einen bei nach über wie wird werden sich auch des dem den zum zur vom aus gegen mehr unter wer jetzt kommt viel könnten mehrere setzt nennt"),
    fr: W("le la les des du et pour dans sur une un est au aux pas avec qui que ne plus par ce cette son ses entre après selon sont"),
    es: W("el los las del y en para con por una un es al se su sus más que como sin sobre tras ante hasta desde según entre hay dijo pero menos hoy millones dólares nuevos nueva"),
    pt: W("o os as da do das dos e em para com por uma um é ao à não mais que como sem sobre após até pelo pela entre bilhões milhões"),
    it: W("il lo la gli le dei degli delle della dello di e per con una un è al alla nel nella sul sulla più che come non tra dal dalla sui ai agli nelle contro torna"),
    id: W("dan yang di ke dari untuk dengan ini itu pada dalam akan tidak juga oleh jadi naik turun harga hari bisa ada sebesar persen miliar triliun juta rp ri saham ekonomi tumbuh catat jelang lewat sudah kali uji coba jaga ikut usul pakai kurang"),
  };
  const MARK = { de: /[äöüß]/i, fr: /[àâçèêëîïôûùœ]/i, es: /[ñ¿¡]/i, pt: /[ãõ]/i, it: /\p{L}(?:tà|ò)(?!\p{L})|(?<!\p{L})(?:è|più|perché)(?!\p{L})/iu };
  // 낱말 끝·앞(제목엔 짧은 낱말이 적어서): 하나 맞을 때마다 1점(영어는 0.5 — 영어 제목이 다른 언어로 넘어가지 않게)
  const SUF = {
    en: /^(?:\p{L}+(?:ing|ed|ly|ness)|\p{L}+'s)$/u,
    de: /^(?:\p{L}+(?:ung|ungen|keit|heit|lich|schaft|chen|ieren|iert|sch)|\p{L}*sch\p{L}+)$/u,
    es: /^\p{L}+(?:ción|ciones|dad|dades|ados|idos|ales)$/u,
    pt: /^\p{L}+(?:ção|ções|ões|dade|dades|ados|idos|eiro|eira)$/u,
    it: /^\p{L}+(?:zione|zioni|ità|mente|ento|enti|ato|ata|ati)$/u,
    fr: /^\p{L}+(?:ement|ements|eux|euse|ière|ières|tés)$/u,
    id: /^(?:\p{L}+(?:kan|nya)|(?:mem|men|meng|ber|ter|per)\p{L}{4,})$/u,
  };
  const cache = new Map();
  function detect(s) {
    s = String(s || "");
    if (cache.has(s)) return cache.get(s);
    let out = null;
    if (/[฀-๿]/.test(s)) out = "th";
    else if (/[؀-ۿ]/.test(s)) out = "ar";
    else if (/[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(s)) out = "vi";
    else if (/[ığşİĞŞ]/.test(s)) out = "tr";
    else if (/[łąęśźżńŁĄĘŚŹŻŃ]/.test(s)) out = "pl";
    else {
      // 대문자 약자(AI·UN·BI)는 빼고 셈 — 영어 제목의 "AI" 가 이탈리아어 ai, "UN" 이 프랑스어 un 으로 잡혀서
      const toks = (s.match(/\p{L}+/gu) || []).filter(w => !(w.length <= 3 && w === w.toUpperCase())).map(w => w.toLowerCase());
      const sc = {};
      for (const [lang, set] of Object.entries(WORDS)) sc[lang] = toks.reduce((n, w) => n + (set.has(w) ? 1 : 0), 0);
      for (const [lang, re] of Object.entries(MARK)) if (re.test(s)) sc[lang] += 1.5;
      for (const w of toks) for (const [lang, re] of Object.entries(SUF)) if (w.length > 4 && re.test(w)) sc[lang] += lang === "en" ? 0.5 : 1;
      let best = "en";
      for (const lang of Object.keys(WORDS)) if (sc[lang] > sc[best]) best = lang;
      out = best !== "en" && sc[best] >= 2 && sc[best] > sc.en ? best : null;
    }
    if (cache.size > 20000) cache.clear();
    cache.set(s, out);
    return out;
  }
  g.LANGX = { detect, foreign: s => NEW.has(detect(s)) };
  if (typeof g.srcLang !== "function") return;
  const base = g.srcLang;
  g.srcLang = function (s) { const b = base(s); return b === "en" ? detect(s) || "en" : b; };
})(typeof globalThis !== "undefined" ? globalThis : this);
