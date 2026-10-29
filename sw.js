// Minimal service worker: lets phones offer "Install app". It does not cache anything, so pages are always the newest version.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
