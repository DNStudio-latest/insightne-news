"use client";
// Small pieces that run in the reader's browser.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { LANGUAGES } from "../lib/languages.js";

// Copies any text (e.g. the Top 5 message) so it can be pasted into your WhatsApp channel.
export function CopyTextButton({ text, label, className }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 4000);
        } catch {
          window.prompt("Copy this text:", text);
        }
      }}
    >
      {copied ? "✓ Copied — now paste it in your channel" : label}
    </button>
  );
}

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

// Language menu (English, বাংলা, हिन्दी, অসমীয়া, नेपाली). Sends the reader back to the same page after switching.
export function LangSwitch({ current, label = "Language" }) {
  return (
    <label className="lang-switch">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">🌐</span>
      <select
        value={current}
        onChange={(e) => {
          window.location.href = `/lang/${e.target.value}?back=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>{l.name}</option>
        ))}
      </select>
    </label>
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

// The front-page poll. Remembers in this browser that you voted, then shows the results.
export function PollBox({ poll, initialCounts, labels }) {
  const key = `poll-${poll.id}`;
  const [mine, setMine] = useState(null);
  const [counts, setCounts] = useState(initialCounts);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) setMine(Number(saved));
    } catch {}
  }, [key]);

  const vote = async (choice) => {
    setBusy(true);
    setFailed(false);
    try {
      let reader = localStorage.getItem("reader-code");
      if (!reader) localStorage.setItem("reader-code", (reader = crypto.randomUUID()));
      const res = await fetch("/api/poll", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: poll.id, choice, reader }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCounts(data.counts);
      localStorage.setItem(key, String(choice));
      setMine(choice);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  };

  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <section className="poll" aria-label={labels.title}>
      <p className="poll-label">📊 {labels.title}</p>
      <h2 className="poll-question">{poll.question}</h2>
      {mine === null ? (
        <div className="poll-options">
          {poll.options.map((o, i) => (
            <button key={i} type="button" disabled={busy} onClick={() => vote(i)}>{o}</button>
          ))}
        </div>
      ) : (
        <ul className="poll-bars">
          {poll.options.map((o, i) => {
            const pct = total ? Math.round((counts[i] / total) * 100) : 0;
            return (
              <li key={i} className={i === mine ? "mine" : undefined}>
                <span className="poll-bar" style={{ width: `${pct}%` }} />
                <span className="poll-text">{o}{i === mine && " ✓"}</span>
                <b>{pct}%</b>
              </li>
            );
          })}
        </ul>
      )}
      {failed && <p className="poll-note">{labels.failed}</p>}
      <p className="poll-note">{mine === null ? labels.note : `${total} ${labels.votes} · ${labels.note}`}</p>
    </section>
  );
}

// "🔔 Alerts" button: asks the browser for permission and signs this phone up for breaking-news alerts.
const toKey = (base64) => {
  const raw = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function AlertsButton({ publicKey, lang, labels }) {
  const [state, setState] = useState("hidden"); // hidden | off | on | busy | blocked | iphone
  useEffect(() => {
    if (!publicKey) return;
    const iphone = /iPhone|iPad/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState(iphone ? "iphone" : "hidden");
    if (Notification.permission === "denied") return setState("blocked");
    navigator.serviceWorker.register("/sw.js").then(async (reg) => setState((await reg.pushManager.getSubscription()) ? "on" : "off")).catch(() => {});
  }, [publicKey]);

  const toggle = async () => {
    if (state === "iphone") return alert(labels.iphone);
    if (state === "blocked") return alert(labels.blocked);
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const current = await reg.pushManager.getSubscription();
      if (current) {
        await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: current.endpoint }) });
        await current.unsubscribe();
        return setState("off");
      }
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription, lang }) });
      if (!res.ok) throw new Error();
      setState("on");
    } catch {
      setState("off");
      alert(labels.failed);
    }
  };

  if (state === "hidden") return null;
  return (
    <button type="button" className={`alerts-btn${state === "on" ? " on" : ""}`} onClick={toggle} disabled={state === "busy"} title={state === "on" ? labels.stop : labels.start}>
      {state === "on" ? `🔔 ${labels.on}` : `🔕 ${labels.start}`}
    </button>
  );
}

// "Get the daily email" box: sends the address; the reader then confirms from their inbox.
export function NewsletterSignup({ lang = "en" }) {
  const bn = lang === "bn";
  const [state, setState] = useState("idle"); // idle | busy | sent | already | bad | failed
  const submit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState("busy");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), website: form.get("website"), lang }),
      });
      const data = await res.json().catch(() => ({}));
      setState(res.ok ? (data.already ? "already" : "sent") : res.status === 400 ? "bad" : "failed");
    } catch {
      setState("failed");
    }
  };
  const messages = bn
    ? { sent: "✓ প্রায় হয়ে গেছে! আপনার ইনবক্সে আমাদের ইমেলের লিংকে চাপুন।", already: "✓ আপনি ইতিমধ্যে সাইন আপ করেছেন।", bad: "সঠিক ইমেল ঠিকানা লিখুন।", failed: "কিছু ভুল হয়েছে। আবার চেষ্টা করুন।" }
    : { sent: "✓ Almost done! Check your inbox and tap the link in our email.", already: "✓ You are already signed up.", bad: "Please type a correct email address.", failed: "Something went wrong. Please try again." };
  if (state === "sent" || state === "already") return <p className="nl-done">{messages[state]}</p>;
  return (
    <form className="nl-form" onSubmit={submit}>
      <strong>{bn ? "প্রতিদিনের সেরা ৫টি খবর, আপনার ইমেলে" : "Top 5 stories every day, in your inbox"}</strong>
      <div className="nl-row">
        <input name="email" type="email" required aria-label="Email address" placeholder={bn ? "আপনার ইমেল" : "Your email"} autoComplete="email" />
        <input name="website" tabIndex={-1} autoComplete="off" className="nl-trap" aria-hidden="true" />
        <button type="submit" disabled={state === "busy"}>{bn ? "সাইন আপ" : "Sign up"}</button>
      </div>
      {messages[state] && <span className="nl-error">{messages[state]}</span>}
      <span className="nl-small">{bn ? "বিনামূল্যে। যেকোনো সময় বন্ধ করা যায়।" : "Free. Unsubscribe any time."}</span>
    </form>
  );
}

// First visit: a small card at the bottom of the screen that tells readers the site is in 5 languages.
// Shown once per browser (until the reader picks a language or closes it). It never covers the whole page.
const WELCOME = {
  en: "Read InsightNE News in your language",
  bn: "আপনার ভাষায় ইনসাইটএনই নিউজ পড়ুন",
  hi: "इनसाइटएनई न्यूज़ अपनी भाषा में पढ़ें",
  as: "আপোনাৰ ভাষাত ইনছাইটএনই নিউজ পঢ়ক",
  ne: "इनसाइटएनई न्युज आफ्नै भाषामा पढ्नुहोस्",
};

export function LanguageWelcome({ current }) {
  const [show, setShow] = useState(false);
  const [suggested, setSuggested] = useState(null);
  useEffect(() => {
    try {
      if (localStorage.getItem("lang-asked") || /(^|;\s*)lang=/.test(document.cookie)) return;
    } catch {
      return;
    }
    // Suggest the language the phone or computer is set to, if we have it.
    const codes = LANGUAGES.map((l) => l.code);
    const fromBrowser = (navigator.languages || [navigator.language]).map((l) => String(l).slice(0, 2).toLowerCase()).find((c) => codes.includes(c) && c !== "en");
    setSuggested(fromBrowser || null);
    const timer = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const remember = () => {
    try {
      localStorage.setItem("lang-asked", "1");
    } catch {}
  };
  const choose = (code) => {
    remember();
    if (code === current) return setShow(false);
    window.location.href = `/lang/${code}?back=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  };
  if (!show) return null;
  const order = suggested ? [suggested, ...LANGUAGES.map((l) => l.code).filter((c) => c !== suggested)] : LANGUAGES.map((l) => l.code);

  return (
    <div className="lang-welcome" role="dialog" aria-label="Choose your language">
      <button type="button" className="lang-welcome-close" aria-label="Close" onClick={() => (remember(), setShow(false))}>✕</button>
      <p className="lang-welcome-title">🌐 {WELCOME[suggested || current] || WELCOME.en}</p>
      {(suggested || current) !== "en" && <p className="lang-welcome-sub">{WELCOME.en}</p>}
      <div className="lang-welcome-options">
        {order.map((code) => {
          const l = LANGUAGES.find((x) => x.code === code);
          return (
            <button key={code} type="button" lang={code} className={code === (suggested || current) ? "on" : undefined} onClick={() => choose(code)}>
              {l.name}
            </button>
          );
        })}
      </div>
      <p className="lang-welcome-note">You can change this any time with the 🌐 button at the top.</p>
    </div>
  );
}

// "Listen to today's top news": the phone or computer reads the top stories aloud with its own voice (free, no audio files).
// items: [{ headline, summary, headline_en, summary_en }]; texts: { intro, outro, intro_en, outro_en, listen, pause, resume, stop, noSound }.
const VOICE_LANGS = { en: ["en-IN", "en"], bn: ["bn-IN", "bn"], hi: ["hi-IN", "hi"], as: ["as-IN", "as", "bn-IN", "bn"], ne: ["ne-NP", "ne", "hi-IN", "hi"] };

function findVoice(code) {
  const voices = window.speechSynthesis.getVoices();
  for (const want of VOICE_LANGS[code] || VOICE_LANGS.en) {
    const voice = voices.find((v) => v.lang.replace("_", "-").toLowerCase() === want.toLowerCase()) || voices.find((v) => v.lang.toLowerCase().startsWith(`${want.toLowerCase()}-`));
    if (voice) return voice;
  }
  return null;
}

// Two sentences at most, split into short pieces (Chrome stops reading long texts after about 15 seconds).
const sentences = (text, max = 2) =>
  String(text || "")
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);

const saveTo = (kind, key, value) => {
  try {
    window[kind].setItem(key, value);
  } catch {}
};

export function ListenBriefing({ items, lang = "en", texts }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState("idle"); // idle | playing | paused
  const [current, setCurrent] = useState(-1);
  const [tip, setTip] = useState(false);
  const [mini, setMini] = useState(false);
  const [closed, setClosed] = useState(false);
  // Where the reader moved the tab, as a share of the free space ({ fx: 0 = left edge … 1 = right edge, fy }); null = default spot.
  const [spot, setSpot] = useState(null);
  const boxRef = useRef(null);
  const run = useRef({ token: 0, pieces: [], index: 0, voice: null, langCode: "en-IN", utter: null, heard: false });
  const drag = useRef(null);
  const justDragged = useRef(false);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    setSupported(true);
    window.speechSynthesis.getVoices(); // starts loading the voice list
    try {
      const saved = JSON.parse(localStorage.getItem("listen-spot") || "null");
      if (typeof saved?.fx === "number" && typeof saved?.fy === "number") setSpot(saved);
      setMini(localStorage.getItem("listen-mini") === "1");
      setClosed(sessionStorage.getItem("listen-closed") === "1");
    } catch {}
    return () => {
      run.current.token += 1;
      window.speechSynthesis.cancel();
    };
  }, []);

  // Puts the tab where the reader left it (also after the screen turns or resizes).
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const place = () => {
      if (!spot) return void (el.style.left = el.style.top = el.style.right = "");
      el.style.left = `${Math.round(spot.fx * Math.max(0, window.innerWidth - el.offsetWidth))}px`;
      el.style.top = `${Math.round(spot.fy * Math.max(0, window.innerHeight - el.offsetHeight))}px`;
      el.style.right = "auto";
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  });

  if (!supported || !items?.length || closed) return null;

  // One sentence at a time; the next starts when the last one ends (reliable on iPhone and Android).
  function speakFrom(n, token) {
    const r = run.current;
    if (token !== r.token) return;
    if (n >= r.pieces.length) return void (setState("idle"), setCurrent(-1), setTip(false));
    r.index = n;
    const piece = r.pieces[n];
    const u = new SpeechSynthesisUtterance(piece.text);
    u.lang = r.langCode;
    if (r.voice) u.voice = r.voice;
    u.rate = 0.95;
    u.onstart = () => {
      r.heard = true;
      if (token === r.token) setCurrent(piece.item);
    };
    const next = () => {
      if (token === r.token) setTimeout(() => speakFrom(n + 1, token), r.pieces[n + 1]?.pause ? 450 : 60);
    };
    u.onend = next;
    u.onerror = (e) => e.error !== "interrupted" && e.error !== "canceled" && next();
    r.utter = u; // keeps it alive: Chrome can drop the "ended" signal of a forgotten sentence
    window.speechSynthesis.speak(u);
  }

  function play(from = 0) {
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.cancel();
    const r = run.current;
    if (from === 0) {
      // The reader's language if the device has a voice for it; otherwise English.
      const own = lang !== "en" ? findVoice(lang) : null;
      const local = lang === "en" || Boolean(own);
      r.voice = own || findVoice("en");
      r.langCode = r.voice?.lang || (local ? VOICE_LANGS[lang]?.[0] : "en-IN") || "en-IN";
      r.pieces = [{ text: local ? texts.intro : texts.intro_en, item: -1 }];
      items.forEach((s, i) => {
        r.pieces.push({ text: local ? s.headline : s.headline_en, item: i, pause: true });
        for (const line of sentences(local ? s.summary : s.summary_en)) r.pieces.push({ text: line, item: i });
      });
      r.pieces.push({ text: local ? texts.outro : texts.outro_en, item: -1, pause: true });
    }
    r.token += 1;
    r.heard = false;
    const token = r.token;
    setState("playing");
    setTip(true);
    speakFrom(from, token); // the first sentence must start inside the tap, or iPhones stay silent
    // The "no sound?" tip goes away once the voice has started.
    setTimeout(() => run.current.token === token && run.current.heard && setTip(false), 6000);
  }

  function halt() {
    run.current.token += 1;
    window.speechSynthesis.cancel();
  }
  function stop() {
    halt();
    setState("idle");
    setCurrent(-1);
    setTip(false);
  }
  const onTap = () => {
    if (state === "idle") play();
    else if (state === "playing") (halt(), setState("paused")); // pausing restarts the sentence later (phones' own pause is unreliable)
    else play(run.current.index);
  };
  const shrink = (value) => (setMini(value), saveTo("localStorage", "listen-mini", value ? "1" : "0"));
  const close = () => (stop(), setClosed(true), saveTo("sessionStorage", "listen-closed", "1"));
  // A tap that ends a drag is not a press.
  const tapped = (fn) => () => !justDragged.current && fn();

  // Dragging: move the finger more than a few pixels to move the tab; let go near a side and it sticks to that edge.
  const onPointerDown = (e) => {
    if (e.button > 0) return;
    const r = boxRef.current.getBoundingClientRect();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: r.left, top: r.top, moved: false, last: null };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      d.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      e.currentTarget.classList.add("is-dragging");
    }
    const el = boxRef.current;
    const maxX = Math.max(0, window.innerWidth - el.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - el.offsetHeight);
    const left = Math.min(maxX, Math.max(0, d.left + dx));
    const top = Math.min(maxY, Math.max(0, d.top + dy));
    Object.assign(el.style, { left: `${left}px`, top: `${top}px`, right: "auto" });
    d.last = { left, top, maxX, maxY };
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    e.currentTarget.classList.remove("is-dragging");
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 50);
    if (!d.last) return;
    let { left, top, maxX, maxY } = d.last;
    if (left < 28) left = 0;
    if (maxX - left < 28) left = maxX;
    const next = { fx: maxX ? left / maxX : 1, fy: maxY ? top / maxY : 0.6 };
    setSpot(next);
    saveTo("localStorage", "listen-spot", JSON.stringify(next));
  };

  const side = !spot || spot.fx >= 0.999 ? "right" : spot.fx <= 0.001 ? "left" : "free";
  const label = state === "idle" ? texts.listen : state === "playing" ? texts.pause : texts.resume;
  const icon = <span className="listen-float-icon" aria-hidden="true">{state === "playing" ? "❚❚" : "▶"}</span>;

  return (
    <div
      ref={boxRef}
      className={`listen-float side-${side}${mini ? " is-mini" : ""}${state !== "idle" ? " is-on" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {mini ? (
        <button type="button" className="listen-float-mini" onClick={tapped(() => shrink(false))} aria-label={texts.listen} title={texts.listen}>
          {icon}
        </button>
      ) : (
        <>
          <div className="listen-float-tools">
            {state !== "idle" && (
              <button type="button" onClick={tapped(stop)} aria-label={texts.stop} title={texts.stop}>■</button>
            )}
            <button type="button" onClick={tapped(() => shrink(true))} aria-label="Make smaller" title="Make smaller">–</button>
            <button type="button" onClick={tapped(close)} aria-label="Close" title="Close">✕</button>
          </div>
          <button type="button" className="listen-float-tab" onClick={tapped(onTap)} aria-label={label}>
            {icon}
            <span className="listen-float-text">{state === "idle" || current < 0 ? label : `${current + 1}/${items.length} · ${label}`}</span>
          </button>
          {tip && <p className="listen-float-tip">🔊 {texts.noSound}</p>}
        </>
      )}
      <p className="sr-only" aria-live="polite">{current >= 0 ? `${current + 1}/${items.length}: ${items[current].headline}` : ""}</p>
    </div>
  );
}
