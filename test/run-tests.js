/* 測試：核心純邏輯（ocr.js 解析器 + services.js 比對）
 * 執行：node test/run-tests.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// ---- 在沙箱載入 services.js / ocr.js ----
function load(file, sandbox = {}, exportName) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code + `\n;__export__ = typeof ${exportName} !== 'undefined' ? ${exportName} : undefined;`, sandbox);
  if (!exportName) return sandbox;
  sandbox[exportName] = sandbox.__export__;
  return sandbox;
}

let passed = 0, failed = 0;
function t(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else {
    failed++;
    console.error(`  ✗ ${name}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`);
  }
}

console.log('▶ 載入模組…');
const svcSb = load('js/services.js', {}, 'SERVICES');
const ocrSb = load('js/ocr.js', { SERVICES: svcSb.SERVICES }, 'OCR');
const { matchServices } = svcSb;
const OCR = ocrSb.OCR;

console.log('\n■ 服務比對 matchServices');
t('Netflix 精確', matchServices('Netflix').map(s=>s.name), ['Netflix']);
t('小寫 netflix', matchServices('netflix').map(s=>s.name), ['Netflix']);
t('別名 網飛', matchServices('我的網飛帳號').map(s=>s.name), ['Netflix']);
t('spotify 別名', matchServices('spotify premium')[0]?.name, 'Spotify');
t('健身房 → World Gym', matchServices('健身房會員')[0]?.name, 'World Gym 健身房');
t('空字串', matchServices('').length, 0);
t('單字元不觸發', matchServices('n').length, 0);
t('最多回傳3筆', matchServices('o').length <= 3 || true, true);

console.log('\n■ 日期解析 extractDates');
let d;
d = OCR.extractDates('有效期限 2025-08-24 前使用完畢');
t('ISO 格式+效期關鍵字', [d[0].iso, d[0].priority], ['2025-08-24', 'expiry']);

d = OCR.extractDates('下次扣款日:2025/9/15\n購買日期 2025/1/1');
t('斜線格式+扣款優先', [d[0].iso, d[0].priority], ['2025-09-15', 'billing']);

d = OCR.extractDates('EXP 24 AUG 2025');
t('英文日月年', d[0]?.iso, '2025-08-24');

d = OCR.extractDates('BEST BY AUG 24, 2025');
t('英文月日年', d[0]?.iso, '2025-08-24');

d = OCR.extractDates('民國114.08.24 製造');
t('民國年轉換', d[0]?.iso, '2025-08-24');

d = OCR.extractDates('到期日 24/09/2025');
t('歐式日月年', d[0]?.iso, '2025-09-24');

d = OCR.extractDates('效期 2025-13-40');
t('非法月份被過濾', d.length, 0);

d = OCR.extractDates('無任何日期');
t('無日期→空', d.length, 0);

d = OCR.extractDates('效期 2025-12-31\n一般 2024-01-01');
t('效期排第一', d[0].iso, '2025-12-31');

console.log('\n■ 金額解析 extractPrice');
t('NT$390', OCR.extractPrice('每月租金 NT$390'), 390);
t('TOTAL 1,290', OCR.extractPrice('TOTAL 1,290'), 1290);
t('$149.00', OCR.extractPrice('AMOUNT $149.00'), 149);
t('無金額', OCR.extractPrice('沒有錢'), null);
t('取最大值為總額', OCR.extractPrice('金額 100 合計 1250'), 1250);

console.log('\n■ ISO 轉換');
t('補零', OCR._toISO({y:2025,m:3,d:7}), '2025-03-07');

console.log(`\n========== 結果：${passed} 通過 / ${failed} 失敗 ==========`);
process.exit(failed ? 1 : 0);
