"use client";
// The Listen button on the Top 5 page. The ElevenLabs audio is requested only when a visitor presses it.
// If the server says the limit is reached, the device's own voice reads the same text instead.
import { useState } from "react";

export function ListenButton({ count }) {
  const [state, setState] = useState("idle"); // idle | loading | playing | error
  const [note, setNote] = useState("");

  async function play() {
    setState("loading");
    setNote("");
    try {
      const res = await fetch("/api/listen/today", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      if ((res.headers.get("content-type") || "").includes("audio")) {
        const audio = new Audio(URL.createObjectURL(await res.blob()));
        audio.onended = () => setState("idle");
        setState("playing");
        await audio.play();
        return;
      }
      const data = await res.json();
      if (data.fallback && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(data.text);
        utterance.lang = "en-IN";
        utterance.onend = () => setState("idle");
        window.speechSynthesis.speak(utterance);
        setState("playing");
        setNote("Read by your device's voice, because the AI voice limit has been reached for now.");
        return;
      }
      throw new Error("no audio");
    } catch {
      setState("error");
      setNote("Listening is not available right now. Please try again later.");
    }
  }

  return (
    <div className="listen-today" style={{ margin: "16px 0" }}>
      <button type="button" className="wa-share" onClick={play} disabled={state === "loading" || state === "playing"}>
        {state === "loading" ? "Preparing…" : `Listen to today's Top ${count} news`}
      </button>
      <p className="note">Read by an AI voice.</p>
      {note && <p className="note">{note}</p>}
    </div>
  );
}
