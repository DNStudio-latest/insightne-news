"use client";
// The admin's button: "Alert me when a reporter sends a story". Works on a phone once the site is added to the
// Home Screen (iPhone) and notifications are allowed.
import { useEffect, useState } from "react";

const toKey = (base64) => {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export default function AdminAlerts({ publicKey }) {
  const [state, setState] = useState("hidden"); // hidden | off | on | busy | blocked | iphone
  useEffect(() => {
    if (!publicKey) return;
    const iphone = /iPhone|iPad/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState(iphone ? "iphone" : "hidden");
    if (Notification.permission === "denied") return setState("blocked");
    navigator.serviceWorker.register("/sw.js").then(async (reg) => setState((await reg.pushManager.getSubscription()) ? "on" : "off")).catch(() => {});
  }, [publicKey]);

  const toggle = async () => {
    if (state === "iphone") return alert("On iPhone: open the website in Safari, tap Share, choose Add to Home Screen, then open it from the Home Screen and tap this button again.");
    if (state === "blocked") return alert("Notifications are blocked for this site. Allow them in your phone or browser settings, then try again.");
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const current = await reg.pushManager.getSubscription();
      if (current) {
        await fetch("/api/admin-push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: current.endpoint }) });
        await current.unsubscribe();
        return setState("off");
      }
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      const res = await fetch("/api/admin-push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription }) });
      if (!res.ok) throw new Error();
      setState("on");
    } catch {
      setState("off");
      alert("Could not switch the alert on. Please try again.");
    }
  };

  if (state === "hidden") return null;
  return (
    <button type="button" className={`btn ${state === "on" ? "btn-approve" : "btn-plain"}`} onClick={toggle} disabled={state === "busy"} title="A quiet phone alert when a reporter sends a story for approval">
      {state === "on" ? "🔔 Reporter alerts: ON" : "🔕 Alert me about reporters' stories"}
    </button>
  );
}
