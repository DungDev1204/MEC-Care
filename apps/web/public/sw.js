const CACHE = 'cliente-shell-v2';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/offline.html', '/icon-192.png']))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cliente-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
// Customer records, photos, credentials and API responses are never cached by this worker.
self.addEventListener('fetch', event => { if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html'))); });
self.addEventListener('push', event => {
  let data = {}; try { data = event.data?.json() || {}; } catch { }
  const url = new URL(data.url || '/agenda', self.location.origin);
  event.waitUntil(self.registration.showNotification(data.title || 'Clienté', { body: data.body || 'Bạn có lịch chăm sóc đến hạn.', icon: '/icon-192.png', badge: '/icon-192.png', tag: data.tag || 'cliente-reminder', data: { url: url.origin === self.location.origin ? url.href : self.location.origin + '/agenda' } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close(); const url = event.notification.data?.url || self.location.origin + '/agenda';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => { const client = clients.find(c => new URL(c.url).origin === self.location.origin); if (client) { await client.navigate(url); return client.focus(); } return self.clients.openWindow(url); }));
});
