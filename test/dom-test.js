/* DOM 整合測試：載入 index.html + 全部腳本，模擬使用者操作
 * 執行：node test/dom-test.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
function t(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else {
    failed++;
    console.error(`  ✗ ${name}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`);
  }
}

// ---- 建立 DOM ----
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  // 拿掉 service worker 註冊（jsdom 不支援）
  .replace(/if \('serviceWorker' in navigator\)[\s\S]*$/, '</script></body></html>');

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
const { document } = window;

window.Notification = { permission: 'denied', requestPermission: async () => 'denied' };
window.confirm = () => true;

// 依序執行頁面引用的腳本（瀏覽器中 <script> 共享全域詞彙環境，這裡合併模擬）
const combined = ['js/services.js', 'js/ocr.js', 'js/app.js']
  .map(src => fs.readFileSync(path.join(ROOT, src), 'utf8')).join('\n;\n');
window.eval(combined);

console.log('■ 啟動狀態');
t('示範資料已載入（4 筆）', JSON.parse(window.localStorage.getItem('eb.items')).length, 4);
t('卡片已渲染', document.querySelectorAll('#list .card').length, 4);
t('統計-本週到期', document.getElementById('statUrgent').textContent, '2'); // +2天、+1天（-4天屬於已過期，不列入本週）
t('統計-訂閱中', document.getElementById('statSubs').textContent, '2');
t('緊急警示 dot 顯示', document.getElementById('notifDot').classList.contains('hidden'), false);

console.log('\n■ 開啟新增 Modal');
document.getElementById('addBtn').click();
t('Modal 開啟', document.getElementById('modalOverlay').classList.contains('hidden'), false);
t('預設提醒天數 3', document.querySelector('#itemForm input[name=warnDays]').value, '3');

console.log('\n■ 新增訂閱項目（含服務建議）');
const form = document.getElementById('itemForm');
form.elements.name.value = 'Netflix';
form.elements.name.dispatchEvent(new window.Event('input', { bubbles: true }));
await0(); // 防抖 250ms

async function await0() {}

setTimeout(() => {
  t('偵測到 Netflix 建議', document.querySelectorAll('.suggestion').length >= 1, true);

  // 點建議 → 自動帶入取消連結與價格
  document.querySelector('.suggestion').click();
  t('取消連結自動帶入', form.elements.cancelUrl.value.includes('netflix.com/cancelplan'), true);
  t('金額自動帶入', form.elements.price.value, '390');

  form.elements.nextDate.value = '2099-01-01';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

  setTimeout(() => {
    console.log('\n■ 送出後驗證');
    t('Modal 關閉', document.getElementById('modalOverlay').classList.contains('hidden'), true);
    const items = JSON.parse(window.localStorage.getItem('eb.items'));
    t('資料已儲存（5 筆）', items.length, 5);
    const nf = items.find(i => i.name === 'Netflix' && i.nextDate === '2099-01-01');
    t('新項目欄位正確', [nf.type, nf.price, !!nf.cancelUrl], ['subscription', 390, true]);

    console.log('\n■ 切換類型 → 效期物品');
    document.getElementById('addBtn').click();
    form.reset();
    document.querySelector('input[name=type][value=expiry]').checked = true;
    document.querySelector('input[name=type][value=expiry]').dispatchEvent(new window.Event('change', { bubbles: true }));
    t('效期欄位顯示', document.getElementById('expFields').classList.contains('hidden'), false);
    t('訂閱欄位隱藏', document.getElementById('subFields').classList.contains('hidden'), true);
    t('expireDate 已變 required', form.elements.expireDate.required, true);
    t('nextDate 取消 required（避免擋送出）', form.elements.nextDate.required, false);

    form.elements.name.value = '優酪乳';
    form.elements.expireDate.value = '2099-05-05';
    form.elements.location.value = '冰箱冷藏';
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

    setTimeout(() => {
      console.log('\n■ 效期項目驗證');
      const items2 = JSON.parse(window.localStorage.getItem('eb.items'));
      t('已儲存（6 筆）', items2.length, 6);
      const y = items2.find(i => i.name === '優酪乳');
      t('類型/位置正確', [y.type, y.location], ['expiry', '冰箱冷藏']);

      console.log('\n■ 卡片互動（委派事件）');
      const cards = [...document.querySelectorAll('#list .card')];
      const yogurtCard = cards.find(c => c.textContent.includes('優酪乳'));
      t('優酪乳卡片存在', !!yogurtCard, true);
      yogurtCard.querySelector('[data-act=toggle]').click();
      const items3 = JSON.parse(window.localStorage.getItem('eb.items'));
      t('標記已處理持久化', items3.find(i => i.name === '優酪乳').done, true);

      console.log('\n■ 分頁篩選');
      const doneTab = document.querySelector('.tab[data-filter=done]');
      doneTab.click();
      t('已處理分頁只顯示1筆', document.querySelectorAll('#list .card').length, 1);
      document.querySelector('.tab[data-filter=expiry]').click();
      t('效期分頁顯示未處理的2筆（鮮奶+維他命C）', document.querySelectorAll('#list .card').length, 2);

      console.log('\n■ 刪除');
      const delCard = [...document.querySelectorAll('#list .card')][0];
      delCard.querySelector('[data-act=del]').click();
      t('刪除後剩餘', JSON.parse(window.localStorage.getItem('eb.items')).filter(i=>!i.done && i.type==='expiry').length, 1);

      console.log(`\n========== DOM 測試：${passed} 通過 / ${failed} 失敗 ==========`);
      process.exit(failed ? 1 : 0);
    }, 20);
  }, 20);
}, 400);
