/* ============================================================
 * services.js — 常見訂閱服務資料庫 & 取消頁導引
 * ============================================================ */

const SERVICES = [
  // 影音
  { name: 'Netflix',            aliases: ['netflix', '網飛'],           cancel: 'https://www.netflix.com/cancelplan',        typicalPrice: 390,  cycle: 'monthly' },
  { name: 'YouTube Premium',    aliases: ['youtube', 'youtube premium', 'yt premium'], cancel: 'https://www.youtube.com/paid_memberships', typicalPrice: 179, cycle: 'monthly' },
  { name: 'Disney+',            aliases: ['disney', 'disney+', '迪士尼'], cancel: 'https://www.disneyplus.com/account',      typicalPrice: 270,  cycle: 'monthly' },
  { name: 'Spotify',            aliases: ['spotify'],                    cancel: 'https://www.spotify.com/account/subscription/', typicalPrice: 149, cycle: 'monthly' },
  { name: 'Apple TV+',          aliases: ['apple tv', 'appletv', 'tv+'], cancel: 'https://tv.apple.com/settings',            typicalPrice: 170,  cycle: 'monthly' },
  { name: 'LINE Music',         aliases: ['line music', 'linemusic'],   cancel: 'https://music.line.me/account',             typicalPrice: 120,  cycle: 'monthly' },
  { name: 'KKBOX',              aliases: ['kkbox'],                     cancel: 'https://www.kkbox.com/tw/tc/account',       typicalPrice: 149,  cycle: 'monthly' },
  { name: 'friDay影音',         aliases: ['friday', 'friday影音'],      cancel: 'https://video.friday.tw/',                  typicalPrice: 99,   cycle: 'monthly' },
  { name: 'CATCHPLAY+',         aliases: ['catchplay'],                 cancel: 'https://www.catchplay.com/',                typicalPrice: 250,  cycle: 'monthly' },

  // 雲端 / 軟體
  { name: 'Google One 雲端',    aliases: ['google one', 'google drive', '雲端硬碟', 'googledrive'], cancel: 'https://one.google.com/settings', typicalPrice: 65, cycle: 'monthly' },
  { name: 'iCloud+',            aliases: ['icloud', 'icloud+'],          cancel: 'https://support.apple.com/HT207594',       typicalPrice: 75,  cycle: 'monthly' },
  { name: 'Microsoft 365',      aliases: ['microsoft 365', 'office 365', 'microsoft365', 'office'], cancel: 'https://account.microsoft.com/services', typicalPrice: 230, cycle: 'monthly' },
  { name: 'Adobe Creative Cloud', aliases: ['adobe', 'creative cloud', 'photoshop', 'lightroom'], cancel: 'https://account.adobe.com/plans', typicalPrice: 672, cycle: 'monthly' },
  { name: 'Notion Plus',        aliases: ['notion'],                     cancel: 'https://www.notion.so/my-settings',        typicalPrice: 300, cycle: 'monthly' },
  { name: 'ChatGPT Plus',       aliases: ['chatgpt', 'openai'],          cancel: 'https://chat.openai.com/#settings/Subscriptions', typicalPrice: 600, cycle: 'monthly' },
  { name: 'iPASS一卡通',        aliases: ['ipass', '一卡通'],            cancel: 'https://www.i-pass.com.tw/',               typicalPrice: 30,  cycle: 'monthly' },
  { name: 'Dropbox',            aliases: ['dropbox'],                    cancel: 'https://www.dropbox.com/account/plan',     typicalPrice: 330, cycle: 'monthly' },

  // 健身 / 生活
  { name: 'World Gym 健身房',   aliases: ['world gym', 'worldgym', '健身房'], cancel: 'https://www.worldgym.com.tw/',        typicalPrice: 1288, cycle: 'monthly' },
  { name: '健身工廠',           aliases: ['fitness factory', '健身工廠'], cancel: 'https://www.fitnessfactory.com.tw/',       typicalPrice: 1188, cycle: 'monthly' },
  { name: 'Uber One',           aliases: ['uber one', 'uber'],           cancel: 'https://my.uber.com/memberships',          typicalPrice: 120, cycle: 'monthly' },
  { name: 'foodpanda panda+',   aliases: ['foodpanda', 'panda+', '熊貓'], cancel: 'https://www.foodpanda.com.tw/',            typicalPrice: 120, cycle: 'monthly' },
  { name: ' Costco 好市多會員', aliases: ['costco', '好市多'],            cancel: 'https://www.costco.com.tw/',               typicalPrice: 1350, cycle: 'yearly' },
  { name: 'Amazon Prime',       aliases: ['amazon prime', 'prime', '亞馬遜'], cancel: 'https://www.amazon.com/gp/primecentral', typicalPrice: 299, cycle: 'monthly' },
];

/** 比對名稱 → 回傳符合的服務建議（最多 3 筆） */
function matchServices(nameInput) {
  if (!nameInput) return [];
  const q = String(nameInput).trim().toLowerCase();
  if (q.length < 2) return [];
  const scored = [];
  for (const s of SERVICES) {
    const names = [s.name.toLowerCase(), ...s.aliases];
    let score = 0;
    for (const n of names) {
      if (n === q) { score = Math.max(score, 100); }
      else if (n.includes(q)) { score = Math.max(score, 80); }
      else if (q.includes(n)) { score = Math.max(score, 70); }
    }
    if (score > 0) scored.push({ service: s, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.service);
}
