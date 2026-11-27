// A sponsor box for the owner's own test-series platform, Testkart. It sits in the page's own space, below the front page
// and above the InsightNE Originals, and is always labelled "Advertisement" so readers can tell it from news.
export default function AdTestkart() {
  return (
    <aside className="ad-box" aria-label="Advertisement">
      <span className="ad-label">Advertisement</span>
      <div className="ad-body">
        <h2 className="ad-title">Testkart: test series, scheduled tests and live tests</h2>
        <p className="ad-text">Test series, scheduled tests and live tests for students. See what is on now and what is coming.</p>
        <a className="ad-btn" href="https://testkart.in/teacher/test-series" target="_blank" rel="sponsored noopener">See the test series</a>
      </div>
    </aside>
  );
}
