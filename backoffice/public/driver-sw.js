self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: '會員配送車手', body: '你有新的派單消息。', url: '/driver/home' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: { url: payload.url || '/driver/home' },
      tag: 'driver-dispatch',
      renotify: true,
      vibrate: [140, 70, 140]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/driver/home';
  event.waitUntil(clients.openWindow(url));
});
