// TripMind Service Worker
// — Activity push notifications (15 min before each activity)
// — Offline-first caching: app shell + static assets + fonts

const CACHE = 'tripmind-v3';
const SCHEDULE_KEY = 'tm_notif_schedule';

// ── Notification scheduling ────────────────────────────────────────────────────
let activeTimers = [];
let currentSchedule = [];

function clearTimers() {
  activeTimers.forEach(t => clearTimeout(t));
  activeTimers = [];
}

function scheduleFromList(schedule) {
  clearTimers();
  currentSchedule = schedule || [];

  // Persist schedule in IndexedDB-lite via Cache API so it survives SW restarts
  self.caches.open('tm-data').then(c =>
    c.put(new Request('/__tm_schedule__'),
      new Response(JSON.stringify(currentSchedule), { headers: { 'Content-Type': 'application/json' } })
    )
  ).catch(() => {});

  const now = Date.now();
  // Allow up to 8 days ahead (covers full week trip + buffer)
  const MAX_AHEAD = 8 * 24 * 60 * 60 * 1000;

  schedule.forEach(item => {
    const delay = item.fireAt - now;
    if (delay > 0 && delay < MAX_AHEAD) {
      const t = setTimeout(() => {
        self.registration.showNotification('🗺️ ' + item.name, {
          body: 'Startet in ~15 Min · ' + item.time,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: 'tm-act-' + item.id,
          renotify: false,
          requireInteraction: false,
          vibrate: [200, 100, 200],
          data: { actId: item.id },
        });
      }, delay);
      activeTimers.push(t);
    }
  });
}

// Restore schedule from cache on SW startup (survives browser restart)
async function restoreSchedule() {
  try {
    const cache = await self.caches.open('tm-data');
    const resp = await cache.match(new Request('/__tm_schedule__'));
    if (!resp) return;
    const saved = await resp.json();
    if (Array.isArray(saved) && saved.length > 0) {
      // Only reschedule items that are still in the future
      const future = saved.filter(item => item.fireAt > Date.now() + 60000);
      if (future.length > 0) scheduleFromList(future);
    }
  } catch (_) {}
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(['/'])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'tm-data').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => restoreSchedule())  // ← restore after taking control
  );
});

self.addEventListener('message', event => {
  const type = event.data?.type;
  if (type === 'TM_SCHEDULE') {
    scheduleFromList(event.data.schedule || []);
    // Confirm back to client how many were scheduled
    const now = Date.now();
    const count = (event.data.schedule || []).filter(i => i.fireAt > now).length;
    event.source?.postMessage({ type: 'TM_SCHEDULE_ACK', count });
  }
  if (type === 'TM_CLEAR') {
    clearTimers();
    currentSchedule = [];
    self.caches.open('tm-data').then(c => c.delete(new Request('/__tm_schedule__'))).catch(() => {});
  }
  if (type === 'TM_GET_COUNT') {
    const now = Date.now();
    const count = currentSchedule.filter(i => i.fireAt > now).length;
    event.source?.postMessage({ type: 'TM_COUNT', count });
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if (c.url && 'focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// ── Offline-first caching ──────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = request.url;
  if (!url.startsWith('http')) return;
  // Don't intercept our internal schedule cache
  if (url.includes('__tm_schedule__')) return;

  // 1. Navigation (HTML pages) → network-first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return resp;
        })
        .catch(() => caches.match('/').then(r => r || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // 2. Static Vite assets (JS/CSS with content hash) → cache-first
  if (url.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return resp;
        });
      })
    );
    return;
  }

  // 3. Fonts & picsum images → cache-first, long-lived
  if (
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('picsum.photos') ||
    url.includes('places.googleapis.com/v1') && url.includes('/media')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return resp;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // 4. Everything else → network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(request))
  );
});
