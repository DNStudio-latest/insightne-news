"use client";
// Small pieces that run in the reader's browser.
import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";

export function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link:", url);
        }
      }}
    >
      {copied ? "✓ Copied" : "Copy link"}
    </button>
  );
}

// The main menu. "Northeast ▾" opens a row with all eight states (a row, not a pop-up, so it works well on phones).
export function NavBar({ current, generalRegion, states, items, stateLinks, labels = {} }) {
  const inRegion = current === generalRegion || states.includes(current);
  const [open, setOpen] = useState(inRegion);
  return (
    <nav className="navbar" aria-label="Sections">
      <div className="container nav">
        <a href="/" aria-current={!current ? "page" : undefined}>{labels.home || "Home"}</a>
        <button type="button" className={`nav-drop${inRegion ? " active" : ""}`} aria-expanded={open} aria-controls="states-menu" onClick={() => setOpen(!open)}>
          {labels.region || generalRegion} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
        {items.map(([label, href, text]) => (
          <a key={href} href={href} aria-current={current === label ? "page" : undefined}>{text || label}</a>
        ))}
      </div>
      {open && (
        <div id="states-menu" className="subnav">
          <div className="container nav">
            {stateLinks.map(([label, href, text]) => (
              <a key={href} href={href} aria-current={current === label ? "page" : undefined}>
                {label === generalRegion ? labels.all || `All ${generalRegion}` : text || label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

// Checks every minute for newly published stories and offers a button to show them.
export function LiveUpdates({ since }) {
  const [hasNew, setHasNew] = useState(false);
  useEffect(() => {
    if (!since) return;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/latest", { cache: "no-store" });
        const { latest } = await res.json();
        if (latest && new Date(latest) > new Date(since)) setHasNew(true);
      } catch {}
    };
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, [since]);
  if (!hasNew) return null;
  return (
    <button className="new-stories" type="button" onClick={() => window.location.reload()}>
      ↑ New stories — tap to see
    </button>
  );
}

// Counts visitors with Vercel Web Analytics (no cookies). Your own approval pages are not counted.

export function SiteAnalytics() {
  return <Analytics beforeSend={(event) => (new URL(event.url).pathname.startsWith("/admin") ? null : event)} />;
}

// English | বাংলা switch. Sends the reader back to the same page after switching.
export function LangSwitch({ current }) {
  const go = (to) => (e) => {
    e.preventDefault();
    window.location.href = `/lang/${to}?back=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  };
  return (
    <span className="lang-switch">
      <a href="/lang/en" onClick={go("en")} aria-current={current === "en" ? "true" : undefined}>English</a>
      {" | "}
      <a href="/lang/bn" onClick={go("bn")} aria-current={current === "bn" ? "true" : undefined} lang="bn">বাংলা</a>
    </span>
  );
}

// Counts one read per story per visit (kept only in this browser tab, no cookies).
export function ViewCounter({ id }) {
  useEffect(() => {
    try {
      const key = `viewed-${id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch("/api/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
  }, [id]);
  return null;
}
