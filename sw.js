/* 每日坚持日历 · service worker
 *
 * 它的作用有两个：
 *   1. 让 Chrome 认这是「可安装的 App」—— 没有它，加到主屏只会是个书签快捷方式，
 *      图标退回成 favicon、名字用网页标题、点开还带地址栏。
 *   2. 离线可用 —— 没网也能打开、也能记，下次联网照常存。
 *
 * 策略：
 *   页面本体走「网络优先」—— 改了要先能立刻看到新的；断网才吃缓存。
 *   图标之类的静态资源走「缓存优先」—— 它们不变，没必要每次拉。
 */

const CACHE = 'habit-v1';

const ASSETS = [
  './habit.html',
  './manifest.json',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  // 有一个文件取不到就整个装上失败 —— 所以这份清单必须都是真实存在的路径。
  // 加了新文件忘了改这儿，表现是「SW 装不上、主屏图标又退回网页图标」。
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())   // 立刻接管，不用等下次刷新
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const wantsHTML = req.mode === 'navigate'
    || (req.headers.get('accept') || '').includes('text/html');

  if (wantsHTML){
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./habit.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic'){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
