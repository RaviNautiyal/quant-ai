t > /mnt/user-data/outputs/sw.js << 'EOF'
// public/sw.js — Service Worker for Web Push notifications

self.addEventListener('install', e => {
  console.log('[SW] installed');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] activated');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', e => {
  if (!e.data) return;

  let payload;
  try { payload = e.data.json(); }
  catch { payload = { title: 'QuantAI Alert', body: e.data.text(), icon: '/icon.png' }; }

  const title   = payload.title || 'QuantAI Price Alert';
  const options = {
    body:    payload.body    || 'Your price target has been hit.',
    icon:    payload.icon    || '/icon-192.png',
    badge:   '/badge-72.png',
    tag:     payload.tag     || 'quantai-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: payload.url || '/alerts' },
    actions: [
      { action: 'view',    title: 'View Alert' },
      { action: 'dismiss', title: 'Dismiss'    },
    ],
    vibrate: [200, 100, 200],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'dismiss') return;

  const url = (e.notification.data && e.notification.data.url) || '/alerts';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      // Otherwise open new tab
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
