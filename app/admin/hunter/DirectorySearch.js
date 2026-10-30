"use client";
// Search the News Hunter's list of key people and official pages. Typing a name, state or platform
// shows matching accounts; each one opens its profile in a new tab so you can read the latest updates.
import { useMemo, useState } from "react";

export default function DirectorySearch({ people, websites }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const found = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return { people: [], websites: [] };
    const match = (item) => {
      const text = `${item.name} ${item.role || ""} ${item.state} ${item.platform || ""} ${item.handle || ""}`.toLowerCase();
      return words.every((w) => text.includes(w));
    };
    return { people: people.filter((p) => p.url && match(p)), websites: websites.filter(match) };
  }, [query, people, websites]);

  const hasResults = found.people.length + found.websites.length > 0;

  return (
    <section className="run-box" aria-label="Search key people and official pages">
      <strong>🔎 Search people and official pages</strong>
      <div className="dir-search">
        <input
          type="search"
          value={query}
          placeholder="Type a name, state or platform, e.g. Sarma, Tripura, Facebook"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && query.trim() && (
        <div className="dir-results">
          {!hasResults && <p className="note">Nothing found. Try a shorter word.</p>}
          {found.people.length > 0 && (
            <>
              <h4>People and accounts</h4>
              <ul>
                {found.people.map((p) => (
                  <li key={`${p.name}-${p.platform}-${p.handle}`}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      {p.name} · {p.platform} {p.handle}
                    </a>
                    <span className="note"> — {p.role}. {p.check === "found" ? "Found in an official source." : "Please confirm on the profile first."}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {found.websites.length > 0 && (
            <>
              <h4>Government websites</h4>
              <ul>
                {found.websites.map((w) => (
                  <li key={w.url}>
                    <a href={w.url} target="_blank" rel="noopener noreferrer">
                      {w.name}
                    </a>{" "}
                    <span className="note">({w.state})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className="btn btn-plain" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      )}
      <p className="note">Opens public profiles only. Nothing is posted or published from here.</p>
    </section>
  );
}
