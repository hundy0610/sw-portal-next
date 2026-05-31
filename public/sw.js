// SW Portal Admin — Service Worker
const CACHE_VERSION = 'sw-admin-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  // 구버전 캐시 제거
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 외부 요청(Notion API 등)은 그냥 통과
  if (url.origin !== self.location.origin) return;

  // 네트워크 우선 — 실패 시 오프라인 안내
  event.respondWith(
    fetch(request).catch(() =>
      new Response(
        `<!DOCTYPE html><html lang="ko"><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1C2B4A;color:white;">
          <div style="text-align:center"><div style="font-size:48px">📡</div><h2>오프라인 상태</h2><p style="opacity:.7">네트워크 연결을 확인해주세요</p></div>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    )
  );
});
