// Builds one self-contained HTML file of the AI text checker (page + engine inlined).
// It opens by double-click on any PC, with no Python, Node or web server.
//
//   node scripts/ai-text-standalone.js [out.html]

import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../public/ai-tools/", import.meta.url);
const page = readFileSync(new URL("index.html", dir), "utf8");
const engine = readFileSync(new URL("engine.js", dir), "utf8").replace(/^export /gm, "");
const importLine = /^import \{[^}]+\} from "\.\/engine\.js";$/m;
if (!importLine.test(page)) throw new Error("index.html no longer imports ./engine.js as expected");

const out = process.argv[2] || "ai-text-checker.html";
writeFileSync(out, page.replace(importLine, () => `// ---- engine.js (inlined) ----\n${engine}\n// ---- page ----`));
console.log(`Saved ${out}`);
