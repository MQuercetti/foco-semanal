var V = 'foco-v1';
var SHELL = ['./', 'index.html', 'supabase.js', 'shim.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
function netFirst(req, fallbackKey) {
  return new Promise(function (resolve) {
    var settled = false;
    function fromCache() { return caches.match(req).then(function (m) { return m || (fallbackKey ? caches.match(fallbackKey) : null); }); }
    var timer = setTimeout(function () { fromCache().then(function (m) { if (m && !settled) { settled = true; resolve(m); } }); }, 4000);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) { var copy = res.clone(); caches.open(V).then(function (c) { c.put(req, copy); }); }
      if (!settled) { settled = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache().then(function (m) { if (!settled) { settled = true; resolve(m || Response.error()); } });
    });
  });
}
function swr(req) {
  return caches.open(V).then(function (c) {
    return c.match(req).then(function (m) {
      var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(function () { return m; });
      return m || net;
    });
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var u = new URL(req.url);
  if (u.origin === self.location.origin) { e.respondWith(netFirst(req, req.mode === 'navigate' ? 'index.html' : null)); return; }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') e.respondWith(swr(req));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) return cs[i].focus(); }
    return self.clients.openWindow('./');
  }));
});
