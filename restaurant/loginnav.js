/* "Sign in to a VyroBusiness": one small dropdown of buttons that links every Vyro sign-in together.
   Put <div id="loginSwitch"></div> on a sign-in page and load this file. It hides itself on a business's own sign-in link (?r=name). */
(function () {
  var LINKS = [
    ['Vyro owner account', '/index.html', 'Billing, businesses, all apps'],
    ['VyroRestaurant', '/restaurant/login.html', 'Restaurants'],
    ['VyroTakeout', '/takeout/login.html', 'Takeout and fast food'],
    ['VyroContractor', '/contractor/login.html', 'Contractors'],
    ['VyroRetail', '/retail/login.html', 'Shops and stores']
  ];
  function mount() {
    var host = document.getElementById('loginSwitch'); if (!host) return;
    if (new URLSearchParams(location.search).get('r')) { host.style.display = 'none'; return; }
    var here = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
    host.textContent = '';
    var h = document.createElement('div'); h.textContent = 'Sign in to a VyroBusiness'; h.style.cssText = 'font-weight:800;color:#4B9CD3;font-size:1.05rem;margin:4px 0 8px;text-align:center'; host.appendChild(h);
    var d = document.createElement('details'); d.style.cssText = 'text-align:center';
    var s = document.createElement('summary'); s.textContent = 'Choose where to sign in ▾';
    s.style.cssText = 'list-style:none;cursor:pointer;display:inline-block;min-width:240px;padding:12px 18px;border-radius:12px;background:#4B9CD3;color:#05070A;font-weight:800';
    d.appendChild(s);
    var box = document.createElement('div'); box.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin:8px auto 0;max-width:340px';
    LINKS.forEach(function (l) {
      var a = document.createElement(l[1] ? 'a' : 'div'); if (l[1]) a.href = l[1];
      var on = l[1] && l[1].replace(/\.html$/, '') === here;
      a.style.cssText = 'display:block;padding:11px 14px;border-radius:10px;border:1px solid ' + (on ? '#4B9CD3' : 'rgba(201,209,217,.25)') + ';text-decoration:none;color:inherit;text-align:left;' + (l[1] ? '' : 'opacity:.5');
      var b = document.createElement('b'); b.textContent = l[0]; a.appendChild(b);
      var sm = document.createElement('small'); sm.textContent = ' ' + l[2]; sm.style.opacity = '.7'; a.appendChild(sm); box.appendChild(a);
    });
    d.appendChild(box); host.appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
