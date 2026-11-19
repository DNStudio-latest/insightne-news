"use client";
// The compact live-counting panel at the top of the news page (election days only). Same numbers as the full results page.
import { useEffect, useState } from "react";
import { tally } from "../../../lib/results/model.js";

const N = (n) => Number(n || 0).toLocaleString("en-IN");

export default function ResultsStrip({ initial, endpoint, href, rehearsal = false, pct = null }) {
  const [data, setData] = useState(initial);
  useEffect(() => {
    if (rehearsal) return;
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (res.ok && !stop) setData(await res.json());
      } catch {}
    };
    const id = setInterval(load, 20000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [endpoint, rehearsal]);

  const { election, snapshot, status } = rehearsal ? initial : data;
  const turnout = (rehearsal ? initial : data).turnout;
  const counting = Boolean(snapshot) && snapshot.totals.declared > 0;
  if (!counting && !turnout?.updates?.length && !election.polling) return null;
  const rows = snapshot ? tally(snapshot) : [];
  const { seats = 0, declared = 0 } = snapshot?.totals || {};
  const pctDone = seats ? Math.round((declared / seats) * 1000) / 10 : 0;
  const done = seats > 0 && declared === seats;
  const last = turnout?.updates?.at(-1);
  const top = rows.slice(0, 6);
  const rest = rows.slice(6);
  const max = Math.max(1, ...rows.map((r) => r.won));
  return (
    <section className="rb rs" aria-label="Live counting">
      <div className="rs-head">
        <span className={`rb-badge ${done ? "rb-final" : "rb-live"}`}>{!done && <i className="rb-dot" />} {done ? "FINAL" : counting ? "LIVE COUNTING" : "POLLING DAY"}</span>
        <h2>{counting ? election.title : election.title.replace(/: Counting$/, "") + ": Voter turnout"}</h2>
        {counting && <span className="rs-count"><strong>{N(declared)}</strong> of {N(seats)} seats declared · {pctDone}%</span>}
        {status?.delayed && counting && <span className="rb-flag">Update delayed</span>}
      </div>
      {turnout?.updates?.length > 0 && (
        <div className="rs-turnout">
          <div className="rs-turnout-top">
            <span className="rs-turnout-num">{last.percent}%</span>
            <span>voter turnout{last.label ? ` as of ${last.label}` : ""}{turnout.electors ? ` · ${N(turnout.electors)} voters` : ""}{turnout.stations ? ` · ${N(turnout.stations)} polling stations` : ""}</span>
          </div>
          <div className="rb-bar"><div style={{ width: `${last.percent}%` }} /></div>
          {turnout.updates.length > 1 && <p className="rs-rest">Through the day: {turnout.updates.map((u) => `${u.label} ${u.percent}%`).join(" · ")}</p>}
        </div>
      )}
      {!counting && !turnout?.updates?.length && <p className="rb-muted">Polling is under way ({turnout?.date || "today"}). Turnout figures will appear here as the State Election Commission announces them.</p>}
      {counting && <div className="rb-bar"><div style={{ width: `${pctDone}%` }} /></div>}
      {!counting ? null : top.length === 0 ? (
        <p className="rb-muted">Counting has started. The first result will appear here.</p>
      ) : (
        <div className="rb-tally rs-tally">
          {top.map((r) => (
            <div key={r.key} className="rb-card" style={{ "--c": r.colour }}>
              <span className="rb-card-name">{r.name}</span>
              <span className="rb-card-full">{r.full}</span>
              <span className="rb-card-num">{N(r.won)}</span>
              <span className="rb-card-bar"><i style={{ width: `${(r.won / max) * 100}%` }} /></span>
            </div>
          ))}
        </div>
      )}
      {rest.length > 0 && <p className="rs-rest">Others: {rest.map((r) => `${r.name} ${r.won}`).join(" · ")}</p>}
      <div className="rs-foot">
        <span>Source: State Election Commission, Tripura.{counting ? " Seats are shown only when declared." : " Turnout is as announced by the Commission."}</span>
        {!rehearsal && <a href={href}>Full results, seat by seat →</a>}
      </div>
    </section>
  );
}
