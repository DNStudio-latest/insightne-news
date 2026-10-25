"use client";
// Small pieces that run in the reader's browser.
import { useEffect, useState } from "react";

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
export function NavBar({ current, generalRegion, states, items, stateLinks }) {
  const inRegion = current === generalRegion || states.includes(current);
  const [open, setOpen] = useState(inRegion);
  return (
    <nav className="navbar" aria-label="Sections">
      <div className="container nav">
        <a href="/" aria-current={!current ? "page" : undefined}>Home</a>
        <button type="button" className={`nav-drop${inRegion ? " active" : ""}`} aria-expanded={open} aria-controls="states-menu" onClick={() => setOpen(!open)}>
          {generalRegion} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
        {items.map(([label, href]) => (
          <a key={href} href={href} aria-current={current === label ? "page" : undefined}>{label}</a>
        ))}
      </div>
      {open && (
        <div id="states-menu" className="subnav">
          <div className="container nav">
            {stateLinks.map(([label, href]) => (
              <a key={href} href={href} aria-current={current === label ? "page" : undefined}>
                {label === generalRegion ? `All ${generalRegion}` : label}
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
