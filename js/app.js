/* ============================================================
 * app.js — 效期管家 主邏輯
 * 資料儲存：localStorage（key: eb.items, eb.settings）
 * ============================================================ */
'use strict';

/* ---------- 儲存層 ---------- */
const Store = {
  KEY: 'eb.items',
  load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; } },
  save(items) { localStorage.setItem(this.KEY, JSON.stringify(items)); },
};

let items = Store.load();
let filter = 'all';
let sortMode = 'urgent';
let editingId = null;      // 正在編輯的項目 id
let scanResult = null;     // 最新 OCR 結果

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

/* ---------- 工具 ---------- */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysUntil(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}
function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 0 });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), ms);
}

/** 取得項目的關鍵日期（訂閱=扣款日，效期=到期日）與剩餘天數 */
function keyInfo(it) {
  const date = it.type === 'subscription' ? it.nextDate : it.expireDate;
  return { date, days: daysUntil(date), isSub: it.type === 'subscription' };
}

/* ---------- 狀態分級 ---------- */
function statusOf(it) {
  const { days, isSub } = keyInfo(it);
  if (it.done) return { level: 'done', label: '已處理', cls: 'st-done' };
  if (days < 0) return {
    level: 'over', cls: 'st-over',
    label: isSub ? `已逾期 ${-days} 天` : `已過期 ${-days} 天`,
    action: isSub ? '立即取消！' : '請勿使用！',
  };
  if (days <= it.warnDays) return {
    level: 'warn', cls: 'st-warn',
    label: days === 0 ? '今天到期' : `僅剩 ${days} 天`,
    action: isSub ? '考慮取消，避免扣款' : '即將到期，優先使用',
  };
  return { level: 'ok', cls: 'st-ok',
           label: days > 60 ? `${Math.round(days/30)} 個月後` : `${days} 天後`,
           action: '' };
}

/* ---------- 渲染 ---------- */
function render() {
  renderList();
  renderStats();
}

function visibleItems() {
  let list = items.slice();
  if (filter === 'done') list = list.filter(i => i.done);
  else {
    list = list.filter(i => !i.done);
    if (filter !== 'all') list = list.filter(i => i.type === filter);
  }
  const cmp = {
    urgent: (a, b) => keyInfo(a).days - keyInfo(b).days,
    name:   (a, b) => a.name.localeCompare(b.name, 'zh-Hant'),
    price:  (a, b) => (b.price || 0) - (a.price || 0),
    added:  (a, b) => b.createdAt - a.createdAt,
  }[sortMode];
  return list.sort(cmp);
}

function renderList() {
  const wrap = $('#list');
  const list = visibleItems();
  const empty = $('#emptyState');
  empty.classList.toggle('hidden', list.length > 0);
  if (list.length === 0) {
    empty.querySelector('h2').textContent = filter === 'done' ? '沒有已處理項目' : '這個分類目前是空的';
  }
  $('#itemCount').textContent = list.length ? `共 ${list.length} 項` : '';

  wrap.innerHTML = list.map(it => cardHTML(it)).join('');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function cardHTML(it) {
  const st = statusOf(it);
  const { date, days, isSub } = keyInfo(it);
  const meta = [];
  if (isSub) {
    if (it.price != null && it.price !== '') meta.push(`${fmtMoney(it.price)} / ${cycleLabel(it.cycle)}`);
    if (it.cancelUrl) meta.push(`<a href="${esc(it.cancelUrl)}" target="_blank" rel="noopener" class="cancel-link">🚫 一鍵前往取消頁 ↗</a>`);
  } else {
    if (it.qty > 1) meta.push(`數量 ×${it.qty}`);
    if (it.location) meta.push('📍 ' + esc(it.location));
  }
  if (it.note) meta.push('📝 ' + esc(it.note));

  return `
  <article class="card ${st.cls}" data-id="${it.id}">
    <div class="card-badge">${isSub ? '💳 訂閱' : '🥬 效期'}</div>
    <div class="card-main">
      <div class="card-title-row">
        <h3 class="item-name ${it.done ? 'strike' : ''}">${esc(it.name)}</h3>
        <span class="status-chip ${st.cls}">${st.label}</span>
      </div>
      <p class="item-date">${date} · 提前 ${it.warnDays} 天提醒</p>
      ${meta.length ? `<p class="item-meta">${meta.filter(Boolean).join('<span class="dot">·</span>')}</p>` : ''}
      ${!it.done ? `<p class="item-action ${st.level==='over'||st.level==='warn' ? 'hot' : ''}">${st.action}</p>` : ''}
    </div>
    <div class="card-actions">
      <button class="icon-btn" data-act="toggle" title="${it.done ? '恢復追蹤' : '標記已處理'}">${it.done ? '↩' : '✓'}</button>
      <button class="icon-btn" data-act="edit" title="編輯">✎</button>
      <button class="icon-btn danger" data-act="del" title="刪除">🗑</button>
    </div>
  </article>`;
}

function cycleLabel(c) {
  return { monthly: '月', yearly: '年', weekly: '週' }[c] || '';
}

function renderStats() {
  const active = items.filter(i => !i.done);
  const urgent = active.filter(i => { const k = keyInfo(i); return k.days >= 0 && k.days <= 7; }).length;
  const subs = active.filter(i => i.type === 'subscription');

  // 每月支出估算（年費 ÷12、週費 ×4.33）
  let monthly = 0;
  for (const s of subs) {
    const p = parseFloat(s.price) || 0;
    monthly += s.cycle === 'yearly' ? p / 12 : s.cycle === 'weekly' ? p * 4.33 : p;
  }

  $('#statUrgent').textContent = urgent;
  $('#statSubs').textContent = subs.length;
  $('#statMonthly').textContent = fmtMoney(Math.round(monthly));
  $('#statSaved').textContent = items.filter(i => i.done && i.type === 'subscription').length;
}

/* ---------- 表單 Modal ---------- */
function openModal(item = null, prefill = null) {
  editingId = item ? item.id : null;
  $('#modalTitle').textContent = item ? '編輯項目' : '新增項目';
  const form = $('#itemForm');
  form.reset();

  const type = item?.type || prefill?.type || 'subscription';
  form.querySelector(`input[name=type][value=${type}]`).checked = true;
  toggleTypeFields(type);

  const nameEl = form.elements.name; // 注意：不能用 form.name（會撞到表單原生屬性）
  nameEl.value = item?.name ?? prefill?.name ?? '';

  if (type === 'subscription') {
    form.elements.nextDate.value = item?.nextDate ?? prefill?.date ?? '';
    form.elements.price.value = item?.price ?? prefill?.price ?? '';
    form.elements.cycle.value = item?.cycle ?? 'monthly';
    form.elements.cancelUrl.value = item?.cancelUrl ?? (prefill?.serviceName ? findCancelUrl(prefill.serviceName) : '');
    updateSuggestions(nameEl);
  } else {
    form.elements.expireDate.value = item?.expireDate ?? prefill?.date ?? '';
    form.elements.qty.value = item?.qty ?? 1;
    form.elements.location.value = item?.location ?? '';
  }
  form.elements.warnDays.value = item?.warnDays ?? 3;
  form.elements.note.value = item?.note ?? '';

  $('#modalOverlay').classList.remove('hidden');
  setTimeout(() => nameEl.focus(), 50);
}

function closeModal() {
  $('#modalOverlay').classList.add('hidden');
  editingId = null;
}

function toggleTypeFields(type) {
  const isSub = type === 'subscription';
  $('#subFields').classList.toggle('hidden', !isSub);
  $('#expFields').classList.toggle('hidden', isSub);
  // 隱藏欄位不能帶 required，否則瀏覽器會擋下表單送出
  $('#itemForm').elements.nextDate.required = isSub;
  $('#itemForm').elements.expireDate.required = !isSub;
}

function findCancelUrl(serviceName) {
  return SERVICES.find(s => s.name === serviceName)?.cancel || '';
}

/* 名稱輸入 → 即時建議取消連結（可傳入 input 元素或字串） */
function updateSuggestions(nameSource) {
  const box = $('#suggestBox'), listEl = $('#suggestList');
  // 移除舊建議（動態生成）
  box.querySelectorAll('.suggestion').forEach(e => e.remove());
  const raw = typeof nameSource === 'string' ? nameSource : nameSource.value;
  const matches = matchServices(raw).filter(s => s.cancel);
  if (!matches.length) { box.classList.add('hidden'); return; }
  for (const s of matches) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suggestion';
    btn.innerHTML = `<b>${esc(s.name)}</b><span>${fmtMoney(s.typicalPrice)} / ${cycleLabel(s.cycle)} · 官方管理頁</span>`;
    btn.addEventListener('click', () => {
      const form = $('#itemForm');
      if (!form.elements.price.value) form.elements.price.value = s.typicalPrice;
      if (!form.elements.cycle.value || form.elements.cycle.value === 'monthly') form.elements.cycle.value = s.cycle;
      form.elements.cancelUrl.value = s.cancel;
      toast(`已帶入 ${s.name} 的取消頁連結 ✓`);
      box.classList.add('hidden');
    });
    listEl.appendChild(btn);
  }
  box.classList.remove('hidden');
}

/* ---------- 儲存表單 ---------- */
function submitHandler(e) {
  e.preventDefault();
  const f = e.target;
  const type = f.querySelector('input[name=type]:checked').value;

  const base = {
    name: f.elements.name.value.trim(),
    warnDays: Math.max(0, parseInt(f.elements.warnDays.value) || 3),
    note: f.elements.note.value.trim(),
    done: false,
  };
  if (!base.name) { toast('請填寫名稱'); return; }

  let data;
  if (type === 'subscription') {
    if (!f.elements.nextDate.value) { toast('請選擇下次扣款日'); return; }
    data = { ...base, type,
      nextDate: f.elements.nextDate.value,
      price: f.elements.price.value === '' ? null : parseFloat(f.elements.price.value),
      cycle: f.elements.cycle.value,
      cancelUrl: f.elements.cancelUrl.value.trim(),
    };
  } else {
    if (!f.elements.expireDate.value) { toast('請選擇有效期限'); return; }
    data = { ...base, type,
      expireDate: f.elements.expireDate.value,
      qty: Math.max(1, parseInt(f.elements.qty.value) || 1),
      location: f.elements.location.value,
    };
  }

  if (editingId) {
    const idx = items.findIndex(i => i.id === editingId);
    if (idx >= 0) data.done = items[idx].done;
    items[idx] = { ...items[idx], ...data };
    toast('已更新 ✓');
  } else {
    items.push({ id: uid(), createdAt: Date.now(), ...data });
    toast('已新增 ✓');
  }

  Store.save(items);
  closeModal();
  render();
  checkAndNotify(); // 新增後立即檢查是否需要警示
}

/* ---------- 清單事件（委派） ---------- */
$('#list').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const card = e.target.closest('.card');
  const it = items.find(i => i.id === card.dataset.id);
  if (!it) return;
  const act = btn.dataset.act;

  if (act === 'del') {
    if (confirm(`確定刪除「${it.name}」？`)) {
      items = items.filter(i => i.id !== it.id);
      Store.save(items); render(); toast('已刪除');
    }
  } else if (act === 'toggle') {
    it.done = !it.done;
    if (it.done && it.type === 'subscription') toast(`👍 已標記處理！若為取消訂閱，每年省下約 ${fmtMoney(yearlyCost(it))}`);
    else if (it.done) toast('👍 已標記為已處理');
    Store.save(items); render();
  } else if (act === 'edit') {
    openModal(it);
  }
});

function yearlyCost(it) {
  const p = parseFloat(it.price) || 0;
  if (it.cycle === 'yearly') return p;
  if (it.cycle === 'weekly') return p * 52;
  return p * 12;
}

/* ---------- 推播通知 ---------- */
const Notify = {
  async requestPermission() {
    if (!('Notification' in window)) { toast('此瀏覽器不支援推播通知'); return false; }
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') {
      toast('通知已被封鎖，請至瀏覽器設定開啟'); return false;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') { toast('推播已開啟 ✓ 將在到期前提醒你'); return true; }
    toast('未授權通知，仍會在 App 內顯示警示');
    return false;
  },

  fire(title, body) {
    try {
      new Notification(title, { body, icon: 'icons/icon-192.png', tag: title + body });
    } catch { /* 某些環境限制 */ }
    toast(`🔔 ${title} — ${body}`, 5000);
  },
};

/** 掃描全部項目 → 對進入提醒區間者發送通知（每項每天最多一次） */
function checkAndNotify() {
  const today = todayISO();
  const notifiedMap = JSON.parse(localStorage.getItem('eb.notified') || '{}');
  let changed = false;

  for (const it of items) {
    if (it.done) continue;
    const { days, isSub } = keyInfo(it);
    const shouldWarn =
      (days < 0) ||
      (it.warnDays >= 0 && days >= 0 && days <= it.warnDays);

    if (!shouldWarn) continue;
    const dedupKey = `${it.id}@${today}@${days}`; // 同一天同一狀態只通知一次
    if (notifiedMap[it.id] === dedupKey) continue;

    notifiedMap[it.id] = dedupKey;
    changed = true;
    const when = isSub ? '扣款日' : '到期日';
    Notify.fire(
      `⏰ ${it.name} ${days < 0 ? (isSub ? '已逾期扣款' : '已經過期') : `${when}倒數 ${days} 天`}！`,
      isSub
        ? (it.price ? `將於 ${it.nextDate} 扣款 ${fmtMoney(it.price)}。` : `扣款日：${it.nextDate}`) + (it.cancelUrl ? ' 點此前可先到取消頁面。' : '')
        : `有效期限：${it.expireDate}${it.location ? `（${it.location}）` : ''}，請盡快使用！`
    );
  }
  if (changed) localStorage.setItem('eb.notified', JSON.stringify(notifiedMap));
}

/* ---------- 掃描 OCR ---------- */
async function handlePhoto(file) {
  const img = $('#previewImg');
  img.src = URL.createObjectURL(file);
  img.classList.remove('hidden');
  $('#ocrStatus').classList.remove('hidden');
  $('#ocrResult').classList.add('hidden');
  $('#applyScan').disabled = true;
  $('#applyScan').dataset.ready = '';
  scanResult = null;

  try {
    const text = await OCR.runOCR(file, msg => { $('#ocrStatusText').textContent = msg; });
    $('#ocrStatus').classList.add('hidden');

    scanResult = OCR.analyze(text);
    showScanResult(scanResult);
  } catch (err) {
    console.error(err);
    $('#ocrStatus').classList.add('hidden');
    toast('❌ 辨識失敗：' + err.message);
  }
}

function showScanResult(r) {
  $('#rawText').textContent = r.rawText.trim() || '（未辨識到文字）';

  const fields = $('#parsedFields');
  const rows = [];

  rows.push(fieldRow('類型判斷',
    r.suggestedType === 'subscription'
      ? '💳 訂閱服務（偵測到扣款/續訂資訊或已知服務名稱）'
      : '🥬 效期物品'));

  if (r.serviceName) rows.push(fieldRow('服務識別', r.serviceName));

  if (r.bestDate) {
    const label = r.datePriority === 'billing' ? '下次扣款日' : r.datePriority === 'expiry' ? '有效期限' : '日期';
    rows.push(fieldRow(label, r.bestDate + ' ← 自動辨識'));
    if (r.candidates.length > 1) {
      rows.push(`<label class="field"><span>其他候選日期</span>
        <select id="altDates">${r.candidates.map(c =>
          `<option value="${c.iso}">${c.iso}${c.priority !== 'plain' ? `（${c.priority === 'billing' ? '扣款' : '效期'}）` : ''}</option>`).join('')}
        </select></label>`);
    }
  } else {
    rows.push(fieldRow('日期', '⚠️ 未偵測到日期，請手動補上'));
  }

  if (r.price != null) rows.push(fieldRow('金額', fmtMoney(r.price)));
  else if (r.suggestedType === 'subscription') rows.push(fieldRow('金額', '未偵測到（可手動填）'));

  fields.innerHTML = rows.join('');
  $('#ocrResult').classList.remove('hidden');
  const canApply = !!r.bestDate;
  $('#applyScan').disabled = !canApply;
  if (!canApply) $('#applyScan').textContent = '⚠️ 缺少日期，無法套用';
  else $('#applyScan').textContent = '套用到表單 ✓';

  const alt = $('#altDates');
  if (alt) alt.addEventListener('change', () => {
    r.bestDate = alt.value;
    r.datePriority = r.candidates.find(c => c.iso === alt.value)?.priority || 'plain';
  });
}

function fieldRow(k, v) {
  return `<div class="field-row-result"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
}

$('#applyScan').addEventListener('click', () => {
  if (!scanResult) return;
  closeScan();
  openModal(null, {
    type: scanResult.suggestedType,
    name: scanResult.serviceName || '',
    date: scanResult.bestDate,
    price: scanResult.price,
    serviceName: scanResult.serviceName,
  });
  toast('已填入辨識結果，請確認後送出 ✓');
});

/* ---------- 掃描 Modal 控制 ---------- */
function openScan() {
  $('#scanOverlay').classList.remove('hidden');
  $('#previewImg').classList.add('hidden');
  $('#ocrResult').classList.add('hidden');
  $('#ocrStatus').classList.add('hidden');
  $('#photoInput').value = '';
}
function closeScan() { $('#scanOverlay').classList.add('hidden'); }

/* ---------- 通用事件綁定 ---------- */
$('#addBtn').addEventListener('click', () => openModal());
$('#scanBtn').addEventListener('click', openScan);
$('#photoInput').addEventListener('change', e => {
  if (e.target.files[0]) handlePhoto(e.target.files[0]);
});
$('#itemForm').addEventListener('submit', submitHandler);
$$('[data-close]').forEach(b => b.addEventListener('click', () => { closeModal(); closeScan(); }));
$$('.overlay').forEach(o => o.addEventListener('click', e => {
  if (e.target === o) { closeModal(); closeScan(); }
}));
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeScan(); } });

// 類型切換
$$('input[name=type]').forEach(r => r.addEventListener('change', () => {
  toggleTypeFields(r.value);
  if (r.value === 'subscription') updateSuggestions($('#itemForm').elements.name);
  else $('#suggestBox').classList.add('hidden');
}));

// 名稱輸入 → 服務建議（防抖）
let suggestTimer;
$('#itemForm').elements.name.addEventListener('input', e => {
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(() => updateSuggestions(e.target.value), 250);
});

// 分頁 & 排序
$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  filter = t.dataset.filter;
  renderList();
}));
$('#sortSelect').addEventListener('change', e => { sortMode = e.target.value; renderList(); });

// 通知按鈕
$('#notifBtn').addEventListener('click', async () => {
  const ok = await Notify.requestPermission();
  if (ok) { checkAndNotify(); refreshNotifDot(); }
});
function refreshNotifDot() {
  const hasPending = items.some(i => {
    if (i.done) return false;
    const { days } = keyInfo(i);
    return days < 0 || (days >= 0 && days <= i.warnDays);
  });
  $('#notifDot').classList.toggle('hidden', !hasPending);
}

/* ---------- 啟動 ---------- */
function init() {
  // 首次使用：塞入示範資料
  if (!localStorage.getItem('eb.seeded')) {
    const t = new Date();
    const plus = n => { const d = new Date(t); d.setDate(d.getDate() + n); return toISODate(d); };
    items = [
      { id: uid(), createdAt: Date.now(), type: 'subscription', name: 'Netflix', nextDate: plus(2),
        price: 390, cycle: 'monthly', cancelUrl: SERVICES[0].cancel, warnDays: 3, note: '示範資料', done: false },
      { id: uid(), createdAt: Date.now() + 1, type: 'expiry', name: '鮮奶（大瓶）', expireDate: plus(1),
        qty: 2, location: '冰箱冷藏', warnDays: 3, note: '示範資料', done: false },
      { id: uid(), createdAt: Date.now() + 2, type: 'subscription', name: 'Spotify', nextDate: plus(15),
        price: 149, cycle: 'monthly', cancelUrl: SERVICES.find(s=>s.name==='Spotify')?.cancel || '', warnDays: 3, note: '示範資料', done: false },
      { id: uid(), createdAt: Date.now() + 3, type: 'expiry', name: '維他命C 發泡錠', expireDate: plus(-4),
        qty: 1, location: '藥箱', warnDays: 7, note: '示範資料', done: false },
    ];
    Store.save(items);
    localStorage.setItem('eb.seeded', '1');
    toast('👋 歡迎！已載入示範資料，點擊項目右側 ✎ 可編輯或 🗑 刪除', 5000);
  }

  render();
  refreshNotifDot();

  // 若已授權通知 → 立即檢查；否則每小時檢查一次（頁面存活時）
  if ('Notification' in window && Notification.permission === 'granted') checkAndNotify();
  setInterval(checkAndNotify, 60 * 60 * 1000);
  setInterval(refreshNotifDot, 5 * 60 * 1000);

  // 跨分頁同步
  window.addEventListener('storage', e => {
    if (e.key === Store.KEY) { items = Store.load(); render(); refreshNotifDot(); }
  });
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

init();
