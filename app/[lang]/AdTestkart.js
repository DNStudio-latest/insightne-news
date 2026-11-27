import { settings } from "../../lib/config.js";

// A sponsor box for the owner's own test-series platform, Testkart. It sits in the page's own space, below the front page
// and above the InsightNE Originals, and is always labelled "Advertisement" so readers can tell it from news.
// It shows only while settings.json has "testkartAd": { "running": true }. The title, text, button and link come from the same block.
const DEFAULT_AD = {
  title: "Testkart: test series, scheduled tests and live tests",
  text: "Test series, scheduled tests and live tests for students. See what is on now and what is coming.",
  button: "See the test series",
  url: "https://testkart.in/teacher/test-series",
};

export default function AdTestkart() {
  const ad = settings.testkartAd;
  if (ad?.running !== true) return null;
  const c = { ...DEFAULT_AD, ...ad };
  return (
    <aside className="ad-box" aria-label="Advertisement">
      <span className="ad-label">Advertisement</span>
      <div className="ad-body">
        <h2 className="ad-title">{c.title}</h2>
        <p className="ad-text">{c.text}</p>
        <a className="ad-btn" href={c.url} target="_blank" rel="sponsored noopener">{c.button}</a>
      </div>
    </aside>
  );
}
