// VyqilContractor phone alerts: shows the notification the alerts service sent and opens the right page when tapped.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = {}; }
  e.waitUntil(self.registration.showNotification(String(d.t || 'Vyqil').slice(0, 100), { body: String(d.b || '').slice(0, 200), icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { u: typeof d.u === 'string' && /^\/contractor\/[A-Za-z0-9_.\-]*\.html$/.test(d.u) ? d.u : '/contractor/app.html' } }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.u) || '/contractor/app.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf('/contractor/') > -1 && 'focus' in list[i]) { if ('navigate' in list[i]) list[i].navigate(url); return list[i].focus(); } }
    return self.clients.openWindow(url);
  }));
});
