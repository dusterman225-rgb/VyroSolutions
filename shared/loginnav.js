/* Owner sign-in link for the product sign-in pages. Owners have ONE login (/login.html); after signing in they switch
   between their businesses from the list on their dashboard. Put <div id="loginSwitch"></div> on a sign-in page and load this file.
   It hides itself on a business's own sign-in link (?r=name), which is for that business's team. */
(function () {
  function mount() {
    var host = document.getElementById('loginSwitch'); if (!host) return;
    if (new URLSearchParams(location.search).get('r')) { host.style.display = 'none'; return; }
    host.textContent = '';
    var box = document.createElement('div'); box.style.cssText = 'text-align:center;margin:10px 0';
    var a = document.createElement('a'); a.href = '/login.html'; a.textContent = 'Business owner? Log in here';
    a.style.cssText = 'display:inline-block;min-width:240px;padding:12px 18px;border-radius:12px;background:#4B9CD3;color:#05070A;font-weight:800;text-decoration:none';
    box.appendChild(a);
    var n = document.createElement('div'); n.textContent = 'One login for all your businesses.'; n.style.cssText = 'opacity:.7;font-size:.85rem;margin-top:6px'; box.appendChild(n);
    host.appendChild(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
