/*
 * Offline support: keeps the page on the tablet after the first visit, so the
 * demo opens where there is no internet (the ECG itself never needs it).
 * Network first, so a published update shows up whenever the tablet is online;
 * the cache answers when the network is missing or too slow.
 */
'use strict';

const CACHE = 'vitapio-ecg-v2';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const NETWORK_WAIT_MS = 3000; /* venue Wi-Fi without internet can hang for long */

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function fromNetwork(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(reject, NETWORK_WAIT_MS);
    fetch(request).then(
      r => { clearTimeout(timer); resolve(r); },
      err => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fromNetwork(e.request)
    .then(r => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    })
    .catch(() => caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || (e.request.mode === 'navigate' ? caches.match('./') : undefined))
      .then(hit => hit || Response.error())));
});
