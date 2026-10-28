"use client";
// One card per story with a Share button that hands the picture AND the caption to WhatsApp together.
import { useEffect, useState } from "react";

const TYPES = [
  ["live", "🔴 LIVE"],
  ["breaking", "BREAKING"],
  ["news", "NEWS"],
];

const captionFor = (s) => `*${s.headline}*\n\n${s.summary}\n\n👉 Read more: insightnenews.in/s/${s.slug.split("-").pop()}`;

function Post({ story, posted, onPosted }) {
  const [type, setType] = useState(story.type);
  const [state, setState] = useState(""); // "", busy, copied, failed
  const src = `/card/${story.slug}?type=${type}`;
  const caption = captionFor(story);

  const share = async () => {
    setState("busy");
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], `insightne-${story.slug.split("-").pop()}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        // Some phones drop the text when sharing a picture, so it is copied too: just paste it if it's missing.
        await navigator.clipboard?.writeText(caption).catch(() => {});
        await navigator.share({ files: [file], text: caption });
        onPosted();
        setState("");
      } else {
        // Computers: save the picture and copy the caption instead.
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: file.name });
        a.click();
        await navigator.clipboard.writeText(caption);
        setState("copied");
      }
    } catch (err) {
      setState(err?.name === "AbortError" ? "" : "failed"); // AbortError = you closed the share menu
    }
  };

  return (
    <article className={`story wa-post${posted ? " posted" : ""}`}>
      <div className="wa-types">
        {TYPES.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>
        ))}
        {posted && <span className="wa-done">✓ Shared</span>}
      </div>
      <img src={src} alt={`Card: ${story.headline}`} loading="lazy" />
      <p className="wa-caption">{caption}</p>
      <button type="button" className="btn btn-approve wa-send" onClick={share} disabled={state === "busy"}>
        {state === "busy" ? "Preparing…" : posted ? "SHARE AGAIN" : "📲 SHARE TO WHATSAPP"}
      </button>
      {state === "copied" && <p className="note">Picture saved and caption copied. Open WhatsApp, attach the picture and paste the caption.</p>}
      {state === "failed" && <p className="error">Could not share. Long-press the picture to save it, then use “Copy caption” on the main page.</p>}
    </article>
  );
}

export default function WhatsAppPosts({ stories }) {
  // Remembers on this phone which stories you already shared today.
  const day = new Date().toDateString();
  const [posted, setPosted] = useState([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("wa-posted") || "{}");
      if (saved.day === day) setPosted(saved.ids || []);
    } catch {}
  }, [day]);
  const markPosted = (id) => {
    const ids = [...new Set([...posted, id])];
    setPosted(ids);
    try {
      localStorage.setItem("wa-posted", JSON.stringify({ day, ids }));
    } catch {}
  };

  return (
    <div className="stories">
      {stories.map((s) => (
        <Post key={s.id} story={s} posted={posted.includes(s.id)} onPosted={() => markPosted(s.id)} />
      ))}
    </div>
  );
}
