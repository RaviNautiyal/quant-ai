self.addEventListener("install",  e => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(clients.claim()));

self.addEventListener("push", e => {
  const data = e.data?.json() ?? {};
  const title   = data.title   || "QuantAI Alert";
  const options = {
    body:    data.body    || "A price alert has been triggered.",
    icon:    data.icon    || "/icons/icon-192.png",
    badge:   data.badge   || "/icons/badge-72.png",
    tag:     data.tag     || "quantai-alert",
    vibrate: [200, 100, 200],
    data:    { url: data.url || "/alerts" },
    actions: [
      { action: "view",    title: "View Alert" },
      { action: "dismiss", title: "Dismiss"    },
    ],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  if (e.action === "dismiss") return;
  const url = e.notification.data?.url || "/alerts";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(url) && "focus" in c);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});