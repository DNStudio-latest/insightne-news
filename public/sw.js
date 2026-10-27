// Shows InsightNE News alerts on the reader's phone, and opens the story when tapped.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || "InsightNE News", {
      body: data.body || "",
      icon: "/icon",
      badge: "/icon",
      data: { url: data.url || "/" },
      tag: data.url || "insightne",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
