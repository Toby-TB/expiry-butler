/* ============================================================
 * ocr.js — 拍照識別：Tesseract.js OCR + 效期/金額智慧解析
 * Tesseract.js 由 CDN 載入（首次使用需連網下載語言包，之後快取離線可用）
 * ============================================================ */

const OCR = (() => {

  /* ---------- 日期解析 ---------- */

  // 各種常見日期格式 → {y, m, d}
  const DATE_PATTERNS = [
    // 2025-08-24 / 2025/8/24 / 2025.08.24
    { re: /\b(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\b/,
      fn: m => ({ y: +m[1], m: +m[2], d: +m[3] }) },
    // 24/08/2025 (歐式) 或 08/24/2025 — 優先解讀為 日/月/年
    { re: /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/,
      fn: m => {
        let d = +m[1], mo = +m[2];
        if (d > 12 && mo <= 12) return { y: +m[3], m: mo, d };
        if (mo > 12 && d <= 12) return { y: +m[3], m: d, d: mo };
        return { y: +m[3], m: mo, d }; // 預設 日/月/年
      } },
    // 24 AUG 2025 / AUG 24 2025
    { re: /\b(\d{1,2})[\s\-]?(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s\-]?(20\d{2})\b/i,
      fn: m => ({ y: +m[3], m: MONTHS[m[2].toUpperCase()], d: +m[1] }) },
    { re: /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s\-]?(\d{1,2}),?[\s\-]?(20\d{2})\b/i,
      fn: m => ({ y: +m[3], m: MONTHS[m[1].toUpperCase()], d: +m[2] }) },
    // 民國 114.08.24
    { re: /\b(\d{2,3})[-/.年](\d{1,2})[-/.月](\d{1,2})日?\b/,
      fn: m => ({ y: +m[1] + 1911, m: +m[2], d: +m[3] }) },
  ];

  const MONTHS = { JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12 };

  // 效期關鍵字（出現在同一行時，該行日期優先）
  const EXPIRY_KEYWORDS = /(效期|有效期限|到期|保存期限|最佳賞味|EXP|EXPIR|USE\s*BY|BEST\s*BY|BB\b|VALID)/i;
  const BILLING_KEYWORDS = /(下次扣款|扣款|續訂|renew|billing|next\s*payment|due)/i;
  const PRICE_KEYWORDS = /(NT\$?|\$|金額|總計|合計|TOTAL|AMOUNT|USD|TWD)/i;

  /** 從 OCR 文字中解析所有候選日期，回傳排序後的清單 */
  function extractDates(text) {
    const results = [];
    const lines = String(text).split(/\n+/);

    for (const line of lines) {
      for (const p of DATE_PATTERNS) {
        const match = line.match(p.re);
        if (!match) continue;
        let date = p.fn(match);
        date = normalize(date);
        if (!date) continue;
        results.push({
          iso: toISO(date),
          line,
          priority: EXPIRY_KEYWORDS.test(line) ? 'expiry'
                  : BILLING_KEYWORDS.test(line) ? 'billing' : 'plain',
        });
      }
    }
    // 去重 & 依優先度排序（效期 > 扣款 > 一般）
    const seen = new Set();
    const order = { expiry: 0, billing: 1, plain: 2 };
    return results
      .filter(r => { const k = r.iso; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => order[a.priority] - order[b.priority]);
  }

  function normalize({ y, m, d }) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    if (y < 2000 || y > 2099) return null;
    return { y, m, d };
  }

  function toISO({ y, m, d }) {
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  /* ---------- 金額解析 ---------- */
  const PRICE_RE = /\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/g;
  function extractPrice(text) {
    const vals = [];
    for (const line of String(text).split(/\n+/)) {
      if (!PRICE_KEYWORDS.test(line)) continue;
      for (const m of line.matchAll(PRICE_RE)) {
        const val = parseFloat(m[0].replace(/,/g, ''));
        if (val >= 10 && val <= 100000) vals.push(val);
      }
    }
    return vals.length ? Math.max(...vals) : null; // 發票總額通常是行內最大數字
  }

  /* ---------- 服務名稱猜測 ---------- */
  function guessServiceName(text) {
    const lower = String(text).toLowerCase();
    for (const s of SERVICES) {
      const names = [s.name.toLowerCase(), ...s.aliases];
      if (names.some(n => n.length >= 4 && lower.includes(n))) return s.name;
    }
    return null;
  }

  /* ---------- 主流程 ---------- */

  async function runOCR(imageFile, onProgress) {
    if (typeof Tesseract === 'undefined') {
      await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    }
    const worker = await Tesseract.createWorker(['eng', 'chi_tra'], 1, {
      logger: info => {
        if (info.status && typeof onProgress === 'function') {
          const pct = info.progress != null ? ` (${Math.round(info.progress * 100)}%)` : '';
          onProgress(statusText(info.status) + pct);
        }
      },
    });
    try {
      const { data } = await worker.recognize(imageFile);
      return data.text;
    } finally {
      await worker.terminate();
    }
  }

  /** 完整分析：文字 → 結構化欄位 */
  function analyze(text) {
    const dates = extractDates(text);
    const price = extractPrice(text);
    const serviceName = guessServiceName(text);

    const topDate = dates[0] || null;
    const isSubscription = !!(topDate && topDate.priority === 'billing');

    return {
      rawText: text,
      candidates: dates.slice(0, 5),
      bestDate: topDate ? topDate.iso : null,
      datePriority: topDate ? topDate.priority : null,
      price,
      serviceName,
      suggestedType: isSubscription ? 'subscription'
                   : (serviceName ? 'subscription' : 'expiry'),
    };
  }

  function statusText(s) {
    if (/loading.*lang/i.test(s)) return '載入辨識模型中';
    if (/initializ/i.test(s)) return '初始化引擎';
    if (/recognizing/i.test(s)) return 'AI 辨識中';
    return s;
  }

  function loadScript(src) {
    return new Promise((ok, err) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = () => err(new Error('OCR 腳本載入失敗（需要網路）'));
      document.head.appendChild(s);
    });
  }

  return { runOCR, analyze, extractDates, extractPrice, _toISO: toISO };
})();
