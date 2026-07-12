self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function broadcastPushSound(payload) {
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.all(
    windowClients.map((client) =>
      client.postMessage({
        type: 'driver_push_sound',
        soundKey: payload.soundKey || 'new_order',
        title: payload.title,
        body: payload.body,
        url: payload.url || '/driver/home'
      })
    )
  );
}

self.addEventListener('push', (event) => {
  let payload = { title: '會員配送車手', body: '你有新的派單消息。', url: '/driver/home', soundKey: 'new_order' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        data: { url: payload.url || '/driver/home', soundKey: payload.soundKey || 'new_order' },
        tag: `driver-dispatch-${payload.soundKey || 'new_order'}`,
        renotify: true,
        vibrate: [140, 70, 140]
      }),
      broadcastPushSound(payload)
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/driver/home';
  event.waitUntil(clients.openWindow(url));
});
