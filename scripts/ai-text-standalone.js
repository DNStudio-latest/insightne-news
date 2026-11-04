// Builds one self-contained HTML file of the AI text checker (page, engine and built-in model inlined).
// It opens by double-click on any PC, with no Python, Node or web server.
//
//   node scripts/ai-text-standalone.js [out.html]

import { readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../public/ai-tools/", import.meta.url);
const page = readFileSync(new URL("index.html", dir), "utf8");
const inline = (file) => readFileSync(new URL(file, dir), "utf8").replace(/^export /gm, "");

let html = page;
for (const file of ["engine.js", "model.js"]) {
  const importLine = new RegExp(`^import \\{[^}]+\\} from "\\./${file.replace(".", "\\.")}";$`, "m");
  if (!importLine.test(html)) throw new Error(`index.html no longer imports ./${file} as expected`);
  html = html.replace(importLine, () => `// ---- ${file} (inlined) ----\n${inline(file)}\n// ---- end of ${file} ----`);
}

const out = process.argv[2] || "ai-text-checker.html";
writeFileSync(out, html);
console.log(`Saved ${out}`);
