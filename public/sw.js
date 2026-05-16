/**
 * Zentra Collect — Service Worker
 *
 * Responsibilities:
 * 1. Cache the app shell for offline use (install + activate)
 * 2. Serve cached shell on navigation requests (network-first with cache fallback)
 * 3. Show a dedicated offline page when the network is unreachable
 * 4. Handle Web Push notifications (push event)
 * 5. Handle notification clicks (notificationclick event)
 */

const CACHE_NAME = "zentra-shell-v3";

// App shell — pages that should be available offline or on slow connections.
// These are the minimal set needed to show the UI; data is always fetched live.
const SHELL_URLS = [
  "/",
  "/dashboard",
  "/chase-today",
  "/import",
  "/customers",
  "/settings",
  "/offline",
  "/manifest.json",
  "/favicon.svg",
];

// ── Install ────────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Use { cache: "reload" } so we never reuse a stale HTTP cache during
      // the SW install — important after a deploy.
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map((url) =>
            fetch(new Request(url, { cache: "reload" }))
              .then((response) => {
                if (response.ok) return cache.put(url, response);
              })
              .catch(() => {
                /* shell entry unavailable at install — swallow */
              }),
          ),
        ),
      )
      .then(() => self.skipWaiting()), // activate immediately
  );
});

// ── Activate ───────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()), // take control of existing tabs
  );
});

// ── Fetch — network-first, shell fallback ──────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API and _next (JS/CSS bundles) — always network; don't cache
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    return;
  }

  // Navigation requests — network-first; on failure serve cached page if any,
  // otherwise the dedicated /offline page so the user gets something useful.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match("/offline");
          if (offline) return offline;
          return Response.error();
        }),
    );
    return;
  }

  // Static assets (SVG, fonts, etc.) — cache-first
  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request)),
  );
});

// ── Push Notifications ─────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Zentra Collect", body: event.data.text() };
  }

  const title = payload.title ?? "Zentra Collect";
  const options = {
    body: payload.body ?? "You have updates in your chase plan.",
    icon: "/icon.png",
    badge: "/favicon.svg",
    tag: payload.tag ?? "zentra-notification",
    data: {
      url: payload.url ?? "/dashboard",
    },
    actions: payload.actions ?? [
      { action: "view", title: "View" },
      { action: "dismiss", title: "Dismiss" },
    ],
    requireInteraction: payload.requireInteraction ?? false,
    silent: payload.silent ?? false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ─────────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url ?? "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window if one is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});

// ── Message handler — allow the page to trigger skipWaiting + reload ─────────

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
