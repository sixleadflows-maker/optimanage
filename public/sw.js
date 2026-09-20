/*
 * Keeps the till usable when the shop's internet drops.
 *
 * - The app's code and images are kept once fetched (their file names change
 *   with every release, so a kept copy is never stale).
 * - The pages staff need to keep serving customers -- the till, sales,
 *   customers, prescriptions, dashboard -- are fetched fresh whenever there's
 *   a connection, and the last copy is kept for when there isn't. The till's
 *   copy carries the product and customer lists, so bills can still be made.
 * - Any other page opened offline shows a short "you're offline" page that
 *   points back to the till.
 *
 * Bills made offline are held by the till itself (localStorage) and sent when
 * the connection returns; nothing here sends or stores sales.
 *
 * Bump VERSION to drop everything kept by an older release.
 */
const VERSION = "v1";
const ASSETS = `assets-${VERSION}`;
const PAGES = `pages-${VERSION}`;

const PRECACHE = ["/offline.html", "/eyespy-logo-black.png", "/eyespy-logo.png", "/favicon.svg"];

// Pages kept for offline use. Analytics is deliberately left out: its figures
// are the owner's and shouldn't sit on a shared shop computer.
const OFFLINE_PAGES = [
  /^\/dashboard\/?$/,
  /^\/dashboard\/pos\/?$/,
  /^\/dashboard\/sales\/?$/,
  /^\/dashboard\/customers(\/[^/]+)?\/?$/,
  /^\/dashboard\/prescriptions\/?$/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(ASSETS).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== ASSETS && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Sign-out wipes the kept pages: they hold the signed-in user's view.
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(ASSETS)).put(request, response.clone());
  return response;
}

async function pageNetworkFirst(request, key) {
  try {
    const response = await fetch(request);
    // A redirect (e.g. to the sign-in page) or an error isn't the page itself.
    if (response.ok && !response.redirected && response.type === "basic") {
      (await caches.open(PAGES)).put(key, response.clone());
    }
    return response;
  } catch {
    const kept = await caches.match(key, { cacheName: PAGES });
    return kept ?? (await caches.match("/offline.html"));
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || PRECACHE.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    if (OFFLINE_PAGES.some((re) => re.test(url.pathname))) {
      // One kept copy per page, whatever the query string.
      event.respondWith(pageNetworkFirst(request, url.origin + url.pathname));
    } else {
      event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    }
  }
  // Moving between pages inside the app (React Server Component requests) is
  // left alone: offline it fails, and the app falls back to a full page load,
  // which lands in the navigate branch above.
});
