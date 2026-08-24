# ⏰ 效期管家 · Expiry Butler

> **過期與訂閱提醒管家** — 追蹤訂閱扣款與物品效期：扣款前主動推播警示、一鍵跳轉官方取消頁面、拍照 AI 識別效期。
> 純前端 PWA，零後端、零資料庫，資料全部存在你自己的設備上。

[![PWA](https://img.shields.io/badge/PWA-%E5%8F%AF%E5%AE%89%E8%A3%9D-4f6df5)](#-安裝到設備) [![測試](https://img.shields.io/badge/%E6%B8%AC%E8%A9%A6-47%20passed-10b981)](#-測試) [![隱私](https://img.shields.io/badge/%E9%9A%B1%E7%A7%81-%E6%9C%AC%E5%9C%B0%E5%84%B2%E5%AD%98-7c53f4)](#-技術架構)

---

## ✨ 功能總覽

| 功能 | 說明 |
|---|---|
| 💳 **訂閱管理** | 記錄下次扣款日、金額、計費週期，扣款前 N 天（預設 3 天）自動警示 |
| 🥬 **效期管理** | 食材／藥品／保養品的有效期限＋存放位置（冰箱冷藏、藥箱、櫥櫃…） |
| 📷 **拍照識別** | 內建相機拍照 → Tesseract.js OCR 自動辨識發票／包裝上的日期與金額 |
| 🔔 **主動推播** | Web Notification 系統級推播＋App 內警示，逾期／臨期卡片變色提醒 |
| 🚫 **一鍵取消** | 內建 24+ 常見服務官方取消頁；輸入名稱自動提議連結與常見價格 |
| 📊 **支出統計** | 每月訂閱花費估算、本週到期數、取消訂閱省下的年費統計 |
| 🌙 **深色模式** | 自動跟隨系統外觀 |
| 📴 **離線可用** | PWA + Service Worker 快取，安裝後斷網也能管理記錄 |

### 🚫 支援一鍵取消的服務（部分）

Netflix · YouTube Premium · Disney+ · Spotify · Apple TV+ · KKBOX · LINE Music
Google One 雲端 · iCloud+ · Microsoft 365 · Adobe CC · Notion · ChatGPT Plus · Dropbox
World Gym · 健身工廠 · Uber One · foodpanda panda+ · Costco 好市多 · Amazon Prime …

> 輸入名稱時自動模糊比對（支援中英文别名，如「網飛」「健身房」「雲端硬碟」），點一下即帶入取消頁連結與常見價格。

---

## 🚀 快速開始

### 線上直接用（推薦）

部署到任何靜態空間即可，例如 GitHub Pages：

1. Fork 或使用本倉庫
2. **Settings → Pages → Branch 選 `main` → Save**
3. 訪問 `https://<你的用戶名>.github.io/<倉庫名>/`

> 也可部署到 Netlify / Vercel / Cloudflare Pages：直接匯入倉庫，無需任何設定。

### 本機運行

```bash
git clone https://github.com/Toby-TB/expiry-butler.git
cd expiry-butler
python3 -m http.server 8080     # 或 npx serve .
```

打開 http://localhost:8080

> ⚠️ 必須透過 HTTP 存取，直接雙擊 index.html（file:// 協議）會導致 Service Worker 失效。

---

## 📱 安裝到設備

### Windows（Edge / Chrome）
1. 打開網址 → 點地址列右側的 **「⊕ 安裝」** 圖示
2. 桌面／開始選單出現「效期管家」，以獨立視窗運行

### Android（Chrome）
1. 打開網址 → 選單（⋮）→ **「加入主畫面 / 安裝應用」**
2. 主螢幕出現圖標，全螢幕運行

### iOS（Safari）
分享 → **加入主畫面**

### 開啟推播
首次進入點右上角 🔔 → **允許通知**。
（推播需要 HTTPS 或 localhost 環境；GitHub Pages 天然支援）

---

## 📖 使用教學

### ➕ 手動新增項目
1. 點底部 **「＋ 手動新增」**
2. 選類型：💳 訂閱服務 / 🥬 效期物品
3. 輸入名稱 —— 若是常見服務會**自動提議官方取消頁與常見價格**，點一下即帶入
4. 填寫扣款日／有效期限、金額、提前提醒天數 → 儲存

### 📷 拍照識別效期
1. 點底部 **「📷 拍照識別」** → 對準發票或包裝上的日期拍攝
2. AI 辨識出候選日期（含金額、服務名稱猜測）→ 確認或改選 → 「套用到表單」

支援的日期格式：
`2025-08-24` · `2025/8/24` · `24/09/2025` · `EXP 24 AUG 2025` · `AUG 24, 2025` · `民國114.08.24`

### 🔔 提醒機制
- 進入提醒區間（預設到期前 3 天）或已逾期時推送通知
- 卡片狀態色：🟢 正常 → 🟡 即將到期 → 🔴 已逾期／即將扣款
- 同一項目同一狀態每天只提醒一次，不干擾

### 🚫 取消訂閱流程
1. 收到「XX 將於 3 天後扣款」警示
2. 卡片上點 **「🚫 一鍵前往取消頁 ↗」** 直達官方管理頁
3. 取消後回到 App 點 ✓ —— 自動統計今年幫你省了多少錢

### 🗂 分類與排序
頂部分頁切換：全部／💳 訂閱／🥬 效期物品／✓ 已處理；
可按緊急度、名稱、金額、新增時間排序。

---

## 🧪 測試

```bash
npm install    # 安裝 jsdom
npm test       # 23 個單元測試 + 24 個 DOM 整合測試 = 47 tests
```

| 測試檔案 | 涵蓋範圍 |
|---|---|
| `test/run-tests.js` | OCR 日期解析（ISO／斜線／英文月份／民國年）、金額解析、服務模糊比對 |
| `test/dom-test.js` | jsdom 載入整個 App，模擬新增／建議帶入／類型切換／分頁篩選／勾選處理／刪除等真實操作 |

---

## 🏗 技術架構

```
expiry-butler/
├── index.html          # 單頁應用（SPA）
├── manifest.json       # PWA 設定
├── sw.js               # Service Worker（離線快取，cache-first）
├── css/style.css       # 響應式樣式（手機優先、深色模式、安全區域適配）
├── js/
│   ├── services.js     # 訂閱服務資料庫（24+ 服務取消頁、別名、常見價格）+ 模糊比對
│   ├── ocr.js          # Tesseract.js 封裝（eng+chi_tra）+ 效期/金額智慧解析器
│   └── app.js          # 主邏輯：Store 儲存層 / 渲染 / 狀態分級 / 推播去重 / OCR 流程
├── icons/              # SVG 向量圖標 + PNG（192/512，maskable）
├── docs/               # Windows/Android 使用指南
└── test/               # 自動化測試（Node 原生 + jsdom）
```

**技術選型**：原生 HTML/CSS/JavaScript（零框架零構建）· Tesseract.js OCR（CDN 載入，模型快取後離線可用）· localStorage 持久化 · Notification API + Service Worker

**隱私承諾**：所有資料僅存於設備本機 localStorage，不上傳任何伺服器，無追蹤、無廣告。

---

## 🗺 Roadmap

- [ ] 匯出／匯入 JSON 備份
- [ ] 多幣別支援
- [ ] 家庭共享清單
- [ ] 條碼掃描辨識商品效期

## 📄 License

MIT
