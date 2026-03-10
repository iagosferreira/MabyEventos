// sw.js - Service Worker Básico para PWA

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Apenas repassa a requisição para a internet (não interfere no banco de dados)
    event.respondWith(fetch(event.request));
});