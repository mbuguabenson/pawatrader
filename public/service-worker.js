/* Simple Service Worker to pre-cache Free Bots XMLs for instant repeat visits */
const CACHE_NAME = 'freebots-cache-v1';
const getManifestURL = () => {
    try {
        const url = new URL(self.location);
        const params = new URLSearchParams(url.search);
        const override = (params.get('bots_domain') || '').toLowerCase().replace(/^www\./, '');
        const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
        const domain = override || hostname;
        return `/xml/${encodeURIComponent(domain)}/bots.json`;
    } catch (_) {
        return '/xml/bots.json';
    }
};

const MANIFEST_URL = getManifestURL();

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            // Pre-cache the manifest first
            try {
                await cache.add(new Request(MANIFEST_URL, { cache: 'no-cache' }));
            } catch (_) {}

            // Try to fetch manifest and pre-cache XMLs
            try {
                const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
                if (res.ok) {
                    const items = await res.json();
                    const files = Array.isArray(items) ? items.map(i => `/xml/${encodeURIComponent(i.file)}`) : [];
                    // Batch cache XML files to avoid long install stalls
                    for (let i = 0; i < files.length; i += 5) {
                        const batch = files.slice(i, i + 5);
                        await Promise.all(
                            batch.map(async url => {
                                try {
                                    const resp = await fetch(url, { cache: 'no-cache' });
                                    if (resp.ok) await cache.put(url, resp.clone());
                                } catch (_) {}
                            })
                        );
                    }
                }
            } catch (e) {
                // Ignore; caching will happen lazily in fetch handler
            }
        })()
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            // Clean up old caches
            const keys = await caches.keys();
            await Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
            self.clients.claim();
        })()
    );
});

// Cache-first for XML and manifest; network fallback and cache update
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    const isXml = url.pathname.startsWith('/xml/');
    const isManifest = url.pathname === MANIFEST_URL;
    if (!isXml && !isManifest) return; // Only handle XML and manifest

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(request);
            if (cached) {
                // Update cache in background
                event.waitUntil(
                    (async () => {
                        try {
                            const fresh = await fetch(request, { cache: 'no-cache' });
                            if (fresh && fresh.ok) await cache.put(request, fresh.clone());
                        } catch (_) {}
                    })()
                );
                return cached;
            }
            // No cache -> fetch and cache
            try {
                const resp = await fetch(request, { cache: 'no-cache' });
                if (resp && resp.ok) await cache.put(request, resp.clone());
                return resp;
            } catch (e) {
                // Last resort: return cached even if stale (handled above), else error
                return new Response('Offline', { status: 503, statusText: 'Offline' });
            }
        })()
    );
});
