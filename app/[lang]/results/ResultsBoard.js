"use client";
// The live counting board (TV style). Reads the results from `endpoint` every 20 seconds and redraws; the numbers shown are
// exactly what the official portal has marked as declared. In rehearsal mode (admin only) it plays a practice counting day.
import { useEffect, useMemo, useRef, useState } from "react";

const WORDS = (n) => Number(n || 0).toLocaleString("en-IN");
const marginText = (m) => (m == null ? "" : m === 0 ? "level on votes" : `${WORDS(m)} votes`);
const timeLabel = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "");

function tally(snapshot, unit) {
  const counts = new Map();
  for (const u of unit ? [unit] : snapshot.units) for (const s of u.seats) if (s.declared && s.winner) counts.set(s.winner.party, (counts.get(s.winner.party) || 0) + 1);
  const colour = (k) => snapshot.parties.find((p) => p.key === k)?.colour || "#9e9e9e";
  const full = (k) => snapshot.parties.find((p) => p.key === k)?.full || k;
  return [...counts.entries()].map(([key, won]) => ({ key, won, colour: colour(key), full: full(key) })).sort((a, b) => b.won - a.won || a.key.localeCompare(b.key));
}

export default function ResultsBoard({ initial, endpoint, rehearsal = false }) {
  const [data, setData] = useState(initial);
  const [connection, setConnection] = useState("ok");
  const [pct, setPct] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [q, setQ] = useState("");
  const [party, setParty] = useState("");
  const timer = useRef(null);

  // Live: read the results every 20 seconds. Rehearsal: read the practice day at the chosen point.
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch(rehearsal ? `${endpoint}?pct=${pct}` : endpoint, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!stop) {
          setData(json);
          setConnection("ok");
        }
      } catch {
        if (!stop) setConnection("issue");
      }
    };
    load();
    if (rehearsal) return () => (stop = true);
    const id = setInterval(load, 20000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [endpoint, rehearsal, pct]);

  // Rehearsal play button: moves the practice day forward by itself.
  useEffect(() => {
    if (!rehearsal || !playing) return;
    timer.current = setInterval(() => setPct((p) => (p >= 100 ? (setPlaying(false), 100) : Math.min(100, p + 1))), 1500);
    return () => clearInterval(timer.current);
  }, [rehearsal, playing]);

  const { election, snapshot, status } = data;
  const view = useMemo(() => {
    if (!snapshot) return null;
    const total = snapshot.totals.seats;
    const declared = snapshot.totals.declared;
    const seats = snapshot.units.flatMap((u) => u.seats.map((s) => ({ ...s, unit: u.name })));
    return {
      total,
      declared,
      pct: total ? Math.round((declared / total) * 1000) / 10 : 0,
      rows: tally(snapshot),
      latest: seats.filter((s) => s.declared && s.winner).sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, 8),
      close: seats.filter((s) => s.declared && s.winner && s.margin != null).sort((a, b) => a.margin - b.margin).slice(0, 5),
    };
  }, [snapshot]);

  const maxWon = view ? Math.max(1, ...view.rows.map((r) => r.won)) : 1;
  const done = view && view.total > 0 && view.declared === view.total;
  const state = !snapshot ? "WAITING" : done ? "FINAL" : election.live ? "LIVE" : "RESULTS";
  const units = useMemo(() => {
    if (!snapshot) return [];
    const needle = q.trim().toLowerCase();
    return snapshot.units.filter((u) => (!needle || `${u.name} ${u.path} ${u.seats.map((s) => s.name).join(" ")}`.toLowerCase().includes(needle)) && (!party || u.seats.some((s) => s.winner?.party === party)));
  }, [snapshot, q, party]);

  return (
    <div className="rb">
      <header className="rb-head">
        <div className="rb-state">
          <span className={`rb-badge rb-${state.toLowerCase()}`}>
            {state === "LIVE" && <i className="rb-dot" />} {state === "WAITING" ? "COUNTING NOT STARTED" : state}
          </span>
          {status?.paused && <span className="rb-flag">Updates paused</span>}
          {status?.delayed && <span className="rb-flag">Update delayed: showing the last confirmed numbers</span>}
          {connection === "issue" && <span className="rb-flag">Connection problem: retrying</span>}
        </div>
        <h1>{election.title}</h1>
        {election.subtitle && <p className="rb-sub">{election.subtitle}</p>}
        <p className="rb-source">
          Source: State Election Commission, Tripura{snapshot?.source?.updatedLabel ? ` · portal updated ${snapshot.source.updatedLabel}` : ""}. Figures are as entered by the Returning Officers at the counting centres; the
          official portal is final. A seat is shown as won only when the official source marks it declared.
        </p>
      </header>

      {rehearsal && (
        <div className="rb-rehearsal">
          <strong>REHEARSAL</strong> · a finished election's results, played back. Nothing here is public or posted.
          <div className="rb-controls">
            <button type="button" onClick={() => setPlaying(!playing)}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
            <input type="range" min="0" max="100" value={pct} onChange={(e) => (setPlaying(false), setPct(Number(e.target.value)))} />
            <span>{pct}% declared</span>
            <button type="button" onClick={() => (setPlaying(false), setPct(0))}>Restart</button>
          </div>
        </div>
      )}

      {!snapshot && (
        <div className="rb-empty">
          <h2>Results will appear here{election.countingDate ? ` on counting day, ${election.countingDate}` : ""}.</h2>
          <p>This page updates by itself. Every figure comes from the State Election Commission's results portal.</p>
        </div>
      )}

      {view && (
        <>
          {view.latest.length > 0 && (
            <div className="rb-ticker" aria-label="Latest declared results">
              <span className="rb-ticker-tag">LATEST</span>
              <div className="rb-ticker-run">
                <div className="rb-ticker-track">
                  {[0, 1].map((n) => (
                    <span key={n} aria-hidden={n === 1}>
                      {view.latest.map((s) => (
                        <b key={s.id + n}>
                          {s.unit}, {s.name}: {s.winner.name} ({s.winner.party}) won{s.margin != null ? ` · ${marginText(s.margin)}` : ""}
                        </b>
                      ))}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <section className="rb-progress">
            <div className="rb-progress-top">
              <span><strong>{WORDS(view.declared)}</strong> of {WORDS(view.total)} seats declared</span>
              <span>{view.pct}%</span>
            </div>
            <div className="rb-bar"><div style={{ width: `${view.pct}%` }} /></div>
            <small>{WORDS(view.total - view.declared)} still counting</small>
          </section>

          <section>
            <h2>Seats won so far</h2>
            {view.rows.length === 0 ? (
              <p className="rb-muted">No result has been declared yet.</p>
            ) : (
              <div className="rb-tally">
                {view.rows.map((r) => (
                  <button type="button" key={r.key} className={`rb-card${party === r.key ? " on" : ""}`} style={{ "--c": r.colour }} onClick={() => setParty(party === r.key ? "" : r.key)} title={`Show only units where ${r.key} won a seat`}>
                    <span className="rb-card-name">{r.key}</span>
                    <span className="rb-card-full">{r.full}</span>
                    <span className="rb-card-num">{WORDS(r.won)}</span>
                    <span className="rb-card-bar"><i style={{ width: `${(r.won / maxWon) * 100}%` }} /></span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <div className="rb-two">
            <section>
              <h2>Latest declared</h2>
              {view.latest.length === 0 ? <p className="rb-muted">Nothing declared yet.</p> : (
                <ul className="rb-list">
                  {view.latest.map((s) => (
                    <li key={s.id}>
                      <i style={{ background: snapshot.parties.find((p) => p.key === s.winner.party)?.colour }} />
                      <div>
                        <b>{s.unit}: {s.name}</b>
                        <span>{s.winner.name} ({s.winner.party}){s.margin != null ? ` · won by ${marginText(s.margin)}` : ""}</span>
                      </div>
                      <time>{timeLabel(s.at)}</time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2>Closest contests</h2>
              {view.close.length === 0 ? <p className="rb-muted">None yet.</p> : (
                <ul className="rb-list">
                  {view.close.map((s) => (
                    <li key={s.id}>
                      <i style={{ background: snapshot.parties.find((p) => p.key === s.winner.party)?.colour }} />
                      <div>
                        <b>{s.unit}: {s.name}</b>
                        <span>{s.winner.name} ({s.winner.party}) over {s.runnerUp?.name} ({s.runnerUp?.party})</span>
                      </div>
                      <strong>{s.margin === 0 ? "TIE" : WORDS(s.margin)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section>
            <h2>Results by ward group</h2>
            <div className="rb-filter">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a place, ward or seat" aria-label="Search" />
              {party && <button type="button" onClick={() => setParty("")}>Showing {party} wins · clear</button>}
            </div>
            <div className="rb-units">
              {units.map((u) => {
                const rows = tally(snapshot, u);
                const need = Math.floor(u.total / 2) + 1;
                return (
                  <details key={u.id} className="rb-unit">
                    <summary>
                      <span className="rb-unit-name">{u.name}<small>{u.path}</small></span>
                      <span className="rb-unit-count">{u.declared}/{u.total}</span>
                      <span className="rb-stack" title={`Majority mark: ${need} seats`}>
                        {rows.map((r) => <i key={r.key} style={{ width: `${(r.won / u.total) * 100}%`, background: r.colour }} />)}
                        <em style={{ left: `${(need / u.total) * 100}%` }} />
                      </span>
                      <span className="rb-unit-lead">{rows[0] ? `${rows[0].key} ${rows[0].won}` : "—"}</span>
                    </summary>
                    <table className="rb-table">
                      <thead><tr><th>Seat</th><th>Status</th><th>Winner</th><th>Votes</th><th>Margin</th></tr></thead>
                      <tbody>
                        {u.seats.map((s) => (
                          <tr key={s.id} className={s.declared ? "" : "pending"}>
                            <td>{s.name}</td>
                            <td>{s.declared ? "Declared" : "Counting"}</td>
                            <td>{s.winner ? <><span className="rb-dotc" style={{ background: snapshot.parties.find((p) => p.key === s.winner.party)?.colour }} /> {s.winner.name} ({s.winner.party})</> : "—"}</td>
                            <td>{s.winner ? WORDS(s.winner.votes) : ""}</td>
                            <td>{s.margin != null ? (s.margin === 0 ? "Tie" : WORDS(s.margin)) : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                );
              })}
              {units.length === 0 && <p className="rb-muted">Nothing matches your search.</p>}
            </div>
          </section>

          {rehearsal && data.wouldPost?.length > 0 && (
            <section className="rb-would">
              <h2>Social posts that would go out at {pct}%</h2>
              <ul>
                {data.wouldPost.map((e) => (
                  <li key={e.key}>
                    <b>{e.title}</b> — {e.text}{" "}
                    <a href={`/poster/result/rehearsal?kind=${e.poster?.kind || "tally"}${e.poster?.unit ? `&unit=${e.poster.unit}` : ""}${e.poster?.seat ? `&seat=${e.poster.seat}` : ""}&shape=landscape&pct=${pct}`} target="_blank" rel="noopener">poster</a>
                    {" · "}
                    <a href={`/poster/result/rehearsal?kind=${e.poster?.kind || "tally"}${e.poster?.unit ? `&unit=${e.poster.unit}` : ""}${e.poster?.seat ? `&seat=${e.poster.seat}` : ""}&shape=portrait&pct=${pct}`} target="_blank" rel="noopener">Instagram shape</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
