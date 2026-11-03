/* The "install app" buttons and banners were removed. This file stays so every page that loads it keeps working.
   It only stops the browser's own install pop-up from appearing and keeps the offline helper registered. */
(function () {
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); });
  try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
})();
