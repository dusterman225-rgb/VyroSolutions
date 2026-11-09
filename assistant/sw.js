// Keeps VyqilAssistant opening fast and usable with a weak connection. Data itself is cached by Firebase.
var V = 'vqa-3', SHELL = ['index.html', 'login.html', 'css/app.css', 'js/core.js', 'js/forms.js', 'js/views.js', 'js/moneyx.js', 'js/trips.js', 'js/ai.js', 'js/push.js', 'js/push-config.js', 'js/app.js', 'images/logo.svg'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL).catch(function () { /* ok */ }); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x !== V; }).map(function (x) { return caches.delete(x); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(function (res) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); return res; }).catch(function () { return caches.match(r); }));
});
// Phone alerts: show the notification the alerts service sent, and open the app when it is tapped.
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = {}; }
  e.waitUntil(self.registration.showNotification(d.t || 'VyqilAssistant', { body: d.b || '', icon: 'images/icon-192.png', badge: 'images/icon-192.png', tag: d.t ? d.t + '|' + (d.b || '') : undefined }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
    return self.clients.openWindow('index.html');
  }));
});
