// Service Worker สำหรับ Rubik's Cube Timer
// กลยุทธ์: stale-while-revalidate — ใช้ของที่แคชไว้ตอบกลับทันที (เร็ว + ใช้ออฟไลน์ได้)
// แล้วอัปเดตแคชเบื้องหลังจากเน็ตเวิร์กเมื่อออนไลน์อยู่
const CACHE_NAME = 'rubik-timer-cache-v1';

// ไฟล์ที่พยายามแคชไว้ล่วงหน้าตอนติดตั้ง (ชื่อไฟล์ต้องตรงกับที่วางไว้บน GitHub จริง)
const PRECACHE_URLS = [
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          fetch(url).then((res) => {
            if (res && res.ok) return cache.put(url, res);
          }).catch(() => {
            // ไม่ต้องล้มทั้ง install ถ้าไฟล์ใดไฟล์หนึ่งแคชไม่สำเร็จ
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // เฉพาะ same-origin เท่านั้น (ไม่ยุ่งกับคำขอไปโดเมนอื่น)
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      // ถ้ามีแคชอยู่แล้ว ใช้ตอบทันที (เร็ว/ใช้ออฟไลน์ได้) แล้วค่อยอัปเดตเบื้องหลัง
      // ถ้ายังไม่มีแคช (โหลดครั้งแรก) รอผลจากเน็ตเวิร์ก
      return cached || networkFetch;
    })
  );
});
