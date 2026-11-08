// Keeps VyqilAssistant opening fast and usable with a weak connection. Data itself is cached by Firebase.
var V = 'vqa-1', SHELL = ['index.html', 'login.html', 'css/app.css', 'js/core.js', 'js/forms.js', 'js/views.js', 'js/ai.js', 'js/app.js', 'images/logo.svg'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL).catch(function () { /* ok */ }); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x !== V; }).map(function (x) { return caches.delete(x); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(function (res) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); return res; }).catch(function () { return caches.match(r); }));
});
